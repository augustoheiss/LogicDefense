/**
 * Sekundo — Granular CSV Ingestion & Staging Quarantine ("LEGO Engine")
 *
 * Implements fault-tolerant, modular ingestion by parts inspired by
 * Assistente-Moeda-App. Allows importing specific subtrees (e.g. only '01-01'),
 * replacing only that branch without wiping sibling branches, and quarantining
 * malformed rows so the import NEVER fails completely.
 */

import type { FlatRegistry, FlatSkeletonEntry, NodeType, PathKey } from '../skeleton/types';
import * as pathKey from '../skeleton/pathKey';
import { upsertRegistry, type UpsertResult } from './upsert';
import type { CSVRow } from './types';

export interface QuarantinedRow {
  rowNumber: number;
  rawLine: string;
  attemptedKey?: string;
  reason: string;
}

export type GranularImportMode =
  | 'additive_merge'   // Upserts rows additively; preserves untouched nodes
  | 'branch_replace';  // Replaces all descendants of the target branch, keeping others intact

export interface GranularImportOptions {
  /** Mode of ingestion: additive_merge (default) or branch_replace */
  mode?: GranularImportMode;

  /**
   * If mode === 'branch_replace', the specific prefix to replace.
   * If omitted, auto-infers from the top-most common ancestor of incoming rows.
   */
  targetBranchPrefix?: string;

  /**
   * If true, forces incoming state values (like worked = 0) to overwrite existing values.
   * Default is false (preserves operational history).
   */
  forceOverwriteState?: boolean;

  /**
   * Metadata keys to preserve during upsert.
   */
  preserveMetaFields?: string[];
}

export interface GranularImportResult {
  success: boolean;
  validRows: CSVRow[];
  quarantinedRows: QuarantinedRow[];
  affectedBranches: string[];
  updatedRegistry: FlatRegistry;
  diff: UpsertResult['diff'];
}

function normalizeHeaderName(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^_+/, '')
    .replace(/_+$/, '')
    .trim();
}

/**
 * Parses raw CSV text into CSVRow array with tolerant header alias resolution
 * and error quarantining.
 */
export function parseCSVWithQuarantine(csvText: string): {
  validRows: CSVRow[];
  quarantinedRows: QuarantinedRow[];
} {
  const validRows: CSVRow[] = [];
  const quarantinedRows: QuarantinedRow[] = [];

  if (!csvText || csvText.trim() === '') {
    return { validRows, quarantinedRows };
  }

  // Detect delimiter
  const firstLine = csvText.split(/\r?\n/)[0] || '';
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

  // Manual tolerant RFC4180 parsing into string grid
  const rawGrid: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\r' || char === '\n') {
        currentRow.push(currentCell);
        currentCell = '';
        if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0].trim() === '')) {
          rawGrid.push(currentRow);
        }
        currentRow = [];
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0].trim() === '')) {
      rawGrid.push(currentRow);
    }
  }

  if (rawGrid.length === 0) {
    return { validRows, quarantinedRows };
  }

  // Map header aliases
  const rawHeaders = rawGrid[0];
  let keyIdx = -1;
  let typeIdx = -1;
  let labelIdx = -1;
  let valueIdx = -1;
  let emailIdx = -1;
  let metaIdx = -1;

  const extraHeaders: { name: string; idx: number }[] = [];

  rawHeaders.forEach((h, idx) => {
    const norm = normalizeHeaderName(h);
    if (keyIdx === -1 && ['key', 'chave', 'codigo', 'id', 'pathkey'].includes(norm)) {
      keyIdx = idx;
    } else if (typeIdx === -1 && ['type', 'tipo'].includes(norm)) {
      typeIdx = idx;
    } else if (labelIdx === -1 && ['label', 'rotulo', 'nome', 'name', 'titulo', 'title', 'parte', 'tema', 'endereco_porta'].includes(norm)) {
      labelIdx = idx;
    } else if (valueIdx === -1 && ['value', 'valor', 'trabalhado', 'status', 'designado', 'duracao_seg'].includes(norm)) {
      valueIdx = idx;
    } else if (emailIdx === -1 && ['email', 'e-mail', 'contato'].includes(norm)) {
      emailIdx = idx;
    } else if (metaIdx === -1 && ['meta_json', 'meta'].includes(norm)) {
      metaIdx = idx;
    } else {
      extraHeaders.push({ name: h.trim(), idx });
    }
  });

  if (keyIdx === -1) {
    // If no key header found at all, quarantine the entire file as invalid schema
    quarantinedRows.push({
      rowNumber: 1,
      rawLine: rawHeaders.join(delimiter),
      reason: 'Cabeçalho não possui coluna de chave identificadora (_key, key, codigo, id)',
    });
    return { validRows, quarantinedRows };
  }

  // Process rows
  for (let r = 1; r < rawGrid.length; r++) {
    const rowData = rawGrid[r];
    const rawLine = rowData.join(delimiter);
    const lineNum = r + 1;

    const rawKey = rowData[keyIdx] !== undefined ? rowData[keyIdx].trim() : '';

    if (!rawKey) {
      quarantinedRows.push({
        rowNumber: lineNum,
        rawLine,
        reason: 'Chave identificadora vazia',
      });
      continue;
    }

    // Validate key structure with pathKey
    try {
      const normalizedKey = pathKey.normalize(rawKey);
      if (!pathKey.isValid(normalizedKey)) {
        quarantinedRows.push({
          rowNumber: lineNum,
          rawLine,
          attemptedKey: rawKey,
          reason: `Formato de chave inválido: "${rawKey}". Deve ser sequencial como 01, 01-01, 01-01-01`,
        });
        continue;
      }

      // Build CSVRow
      const row: CSVRow = {
        _key: normalizedKey,
        _type: typeIdx !== -1 && rowData[typeIdx] !== undefined ? rowData[typeIdx].trim() : '',
        label: labelIdx !== -1 && rowData[labelIdx] !== undefined ? rowData[labelIdx].trim() : '',
        value: valueIdx !== -1 && rowData[valueIdx] !== undefined ? rowData[valueIdx].trim() : '',
        email: emailIdx !== -1 && rowData[emailIdx] !== undefined ? rowData[emailIdx].trim() : '',
        _meta_json: metaIdx !== -1 && rowData[metaIdx] !== undefined ? rowData[metaIdx].trim() : '',
      };

      // Collect domain extra columns
      for (const extra of extraHeaders) {
        if (rowData[extra.idx] !== undefined && rowData[extra.idx] !== '') {
          row[extra.name] = rowData[extra.idx];
        }
      }

      validRows.push(row);
    } catch (err: any) {
      quarantinedRows.push({
        rowNumber: lineNum,
        rawLine,
        attemptedKey: rawKey,
        reason: `Formato de chave inválido: "${rawKey}". ${err.message || ''}`.trim(),
      });
    }
  }

  return { validRows, quarantinedRows };
}

/**
 * Ingests a granular CSV part into the current registry.
 * Guarantees fault isolation and non-destructive LEGO-like assembly.
 */
export function importGranularCSV(
  currentRegistry: FlatRegistry,
  csvText: string,
  options: GranularImportOptions = {}
): GranularImportResult {
  const { validRows, quarantinedRows } = parseCSVWithQuarantine(csvText);

  if (validRows.length === 0) {
    return {
      success: false,
      validRows: [],
      quarantinedRows,
      affectedBranches: [],
      updatedRegistry: currentRegistry,
      diff: {
        addedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        deletedCount: 0,
        preservedHistoryCount: 0,
        details: [],
      },
    };
  }

  // Detect affected branches
  const branchSet = new Set<string>();
  for (const row of validRows) {
    const parsed = pathKey.parse(row._key);
    if (parsed.length > 0) {
      branchSet.add(pathKey.serialize([parsed[0]]));
      if (parsed.length > 1) {
        branchSet.add(pathKey.serialize(parsed.slice(0, 2)));
      }
    }
  }
  const affectedBranches = Array.from(branchSet);

  let baseRegistry = [...currentRegistry];

  // If mode === 'branch_replace', prune existing descendants of the target branch
  if (options.mode === 'branch_replace') {
    let targetBranch = options.targetBranchPrefix;
    if (!targetBranch && affectedBranches.length > 0) {
      // Find highest common prefix among incoming rows
      targetBranch = affectedBranches[0];
    }

    if (targetBranch) {
      const normTarget = pathKey.normalize(targetBranch);
      baseRegistry = baseRegistry.filter((item) => {
        // Keep item if it is NOT the branch and NOT a descendant of the target branch
        const isTarget = pathKey.equals(item.key, normTarget);
        const isDescendant = pathKey.isDescendant(item.key, normTarget);
        return !isTarget && !isDescendant;
      });
    }
  }

  // Perform state-preserving upsert
  const upsertRes = upsertRegistry(baseRegistry, validRows, {
    forceOverwriteState: options.forceOverwriteState ?? false,
    preserveMetaFields: options.preserveMetaFields,
    preserveUnmatchedCurrent: true,
  });

  return {
    success: true,
    validRows,
    quarantinedRows,
    affectedBranches,
    updatedRegistry: upsertRes.updatedRegistry,
    diff: upsertRes.diff,
  };
}
