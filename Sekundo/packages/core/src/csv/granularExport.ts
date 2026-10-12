/**
 * Sekundo — Granular CSV Export Engine (Export by Parts / Subtrees)
 *
 * Inspired by Assistente Moeda's sliced export pipeline.
 * Allows modular, non-destructive export of specific branches (e.g. only '01-01'),
 * specific scopes (leaves only, worked units only), and human-friendly vs canonical formats.
 */

import type { FlatRegistry, FlatSkeletonEntry, SkeletonNode } from '../skeleton/types';
import type { EngineId } from '../engines/types';
import * as pathKey from '../skeleton/pathKey';
import { flattenTree } from '../skeleton/skeletonTree';
import { serializeCSV } from './serializer';
import type { CSVRow } from './types';

export type GranularScope =
  | 'all'
  | 'leaves_only'
  | 'branches_only'
  | 'worked_only'
  | 'pending_only';

export interface GranularExportOptions {
  /**
   * If provided, exports only nodes that equal or are descendants of this key.
   * e.g., '01-01' will export '01-01', '01-01-01', '01-01-02', etc.
   */
  branchPrefix?: string;

  /** Slicing filter */
  scope?: GranularScope;

  /**
   * 'canonical': Standard _key,_type,label,value,email,_meta_json
   * 'clean_human': Clean columns without raw JSON, easy for humans or external spreadsheets
   */
  format?: 'canonical' | 'clean_human';

  /** Engine ID to determine the best human-readable column layout */
  engineId?: EngineId;

  /** CSV delimiter: ',' (default) or ';' */
  delimiter?: ',' | ';';
}

function escapeCsvCell(val: unknown, delim: string): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(delim) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Filter a flat registry according to granular branch and scope rules.
 */
export function filterGranularEntries(
  entries: FlatSkeletonEntry[],
  options?: GranularExportOptions
): FlatSkeletonEntry[] {
  let filtered = [...entries];

  // 1. Branch prefix filter
  if (options?.branchPrefix && options.branchPrefix.trim() !== '') {
    const prefix = pathKey.normalize(options.branchPrefix.trim());
    filtered = filtered.filter((item) => {
      return pathKey.equals(item.key, prefix) || pathKey.isDescendant(item.key, prefix);
    });
  }

  // 2. Scope filter
  if (options?.scope && options.scope !== 'all') {
    switch (options.scope) {
      case 'leaves_only':
        filtered = filtered.filter((item) => {
          // If no other entry is a descendant of this key, it's a leaf
          return !entries.some((other) => pathKey.isDescendant(other.key, item.key));
        });
        break;
      case 'branches_only':
        filtered = filtered.filter((item) => {
          return entries.some((other) => pathKey.isDescendant(other.key, item.key));
        });
        break;
      case 'worked_only':
        filtered = filtered.filter((item) => {
          const worked = (item.meta as any)?.worked;
          return worked === 1 || item.value === '1' || item.value.toLowerCase() === 'trabalhado';
        });
        break;
      case 'pending_only':
        filtered = filtered.filter((item) => {
          const worked = (item.meta as any)?.worked;
          return worked !== 1 && item.value !== '1' && item.value.toLowerCase() !== 'trabalhado';
        });
        break;
    }
  }

  return filtered;
}

/**
 * Serializes a registry or tree into a sliced/granular CSV string.
 */
export function exportGranularCSV(
  data: FlatRegistry | SkeletonNode[],
  options: GranularExportOptions = {}
): string {
  // Convert tree to flat if necessary
  const rawFlat: FlatSkeletonEntry[] =
    data.length > 0 && 'children' in data[0]
      ? flattenTree(data as SkeletonNode[])
      : (data as FlatSkeletonEntry[]);

  const filtered = filterGranularEntries(rawFlat, options);
  const delim = options.delimiter || ',';
  const format = options.format || 'canonical';

  // Format 1: Canonical
  if (format === 'canonical') {
    const csvRows: CSVRow[] = filtered.map((item) => ({
      _key: item.key,
      _type: item.type,
      label: item.label,
      value: item.value,
      email: item.email,
      _meta_json: Object.keys(item.meta).length > 0 ? JSON.stringify(item.meta) : '',
    }));

    if (delim === ',') {
      return serializeCSV(csvRows);
    }

    // If semicolon delimiter requested for canonical
    const headers = ['_key', '_type', 'label', 'value', 'email', '_meta_json'];
    const lines = [headers.join(delim)];
    for (const r of csvRows) {
      lines.push(
        headers.map((h) => escapeCsvCell((r as any)[h], delim)).join(delim)
      );
    }
    return lines.join('\n') + '\n';
  }

  // Format 2: Clean Human (Agent-Friendly / User-Friendly)
  const engineId = options.engineId || 'territory_logistics';

  if (engineId === 'territory_logistics') {
    const headers = ['key', 'tipo', 'nome', 'trabalhado', 'endereco', 'latitude', 'longitude', 'responsavel', 'observacoes'];
    const lines = [headers.join(delim)];
    for (const item of filtered) {
      const m = item.meta as Record<string, any>;
      const row = [
        escapeCsvCell(item.key, delim),
        escapeCsvCell(item.type, delim),
        escapeCsvCell(item.label, delim),
        escapeCsvCell(m.worked !== undefined ? m.worked : item.value, delim),
        escapeCsvCell(m.address || '', delim),
        escapeCsvCell(m.lat !== undefined ? m.lat : '', delim),
        escapeCsvCell(m.lng !== undefined ? m.lng : '', delim),
        escapeCsvCell(m.workerName || '', delim),
        escapeCsvCell(m.notes || '', delim),
      ];
      lines.push(row.join(delim));
    }
    return lines.join('\n') + '\n';
  }

  if (engineId === 'roster_assignments') {
    const headers = ['key', 'tipo', 'parte', 'designado', 'email', 'assistente', 'sala', 'duracao_min', 'confirmado'];
    const lines = [headers.join(delim)];
    for (const item of filtered) {
      const m = item.meta as Record<string, any>;
      const row = [
        escapeCsvCell(item.key, delim),
        escapeCsvCell(item.type, delim),
        escapeCsvCell(item.label, delim),
        escapeCsvCell(m.assignedTo || item.value || '', delim),
        escapeCsvCell(item.email || '', delim),
        escapeCsvCell(m.assistantTo || '', delim),
        escapeCsvCell(m.room || '', delim),
        escapeCsvCell(m.durationMinutes !== undefined ? m.durationMinutes : '', delim),
        escapeCsvCell(m.confirmed ? 'sim' : 'nao', delim),
      ];
      lines.push(row.join(delim));
    }
    return lines.join('\n') + '\n';
  }

  // Default clean human fallback: key, tipo, titulo, valor, email, notas
  const headers = ['key', 'tipo', 'titulo', 'valor', 'email', 'notas'];
  const lines = [headers.join(delim)];
  for (const item of filtered) {
    const m = item.meta as Record<string, any>;
    const row = [
      escapeCsvCell(item.key, delim),
      escapeCsvCell(item.type, delim),
      escapeCsvCell(item.label, delim),
      escapeCsvCell(item.value, delim),
      escapeCsvCell(item.email || '', delim),
      escapeCsvCell(m.notes || m.description || '', delim),
    ];
    lines.push(row.join(delim));
  }
  return lines.join('\n') + '\n';
}
