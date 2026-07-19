/**
 * Sekundo — CSV Validator & Conflict Resolver
 *
 * Implements validation rules for imported CSV rows and computes
 * side-by-side diffs (add/modify/delete) for the conflict resolution UI.
 */

import type {
  CSVRow,
  CSVValidationResult,
  RowValidationResult,
  CSVDiffResult,
  DiffEntry,
} from './types';
import type { FlatRegistry } from '../skeleton/types';
import * as pathKey from '../skeleton/pathKey';

/**
 * Validate parsed CSV rows against the schema.
 *
 * @param rows - The CSV rows to validate.
 * @returns Comprehensive CSVValidationResult.
 */
export function validateCSV(rows: CSVRow[]): CSVValidationResult {
  const errors: RowValidationResult[] = [];
  let validRowsCount = 0;

  rows.forEach((row, index) => {
    const rowErrors: string[] = [];
    const rowNum = index + 2; // 1-indexed header + 1-indexed row

    // 1. Validate key
    if (!row._key) {
      rowErrors.push('Missing required column: "_key"');
    } else if (!pathKey.isValid(row._key)) {
      rowErrors.push(`Invalid path key: "${row._key}"`);
    }

    // 2. Validate type
    const validTypes = ['slot', 'territory', 'header', 'note'];
    if (!row._type) {
      rowErrors.push('Missing required column: "_type"');
    } else if (!validTypes.includes(row._type)) {
      rowErrors.push(
        `Invalid type: "${row._type}". Must be one of: ${validTypes.join(', ')}`
      );
    }

    // 3. Validate label
    if (!row.label || row.label.trim() === '') {
      rowErrors.push('Missing required column: "label"');
    }

    // 4. Validate meta json
    if (row._meta_json && row._meta_json.trim() !== '') {
      try {
        JSON.parse(row._meta_json);
      } catch {
        rowErrors.push('Invalid JSON format in "_meta_json"');
      }
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNum,
        key: row._key || `row-${rowNum}`,
        valid: false,
        errors: rowErrors,
      });
    } else {
      validRowsCount++;
    }
  });

  return {
    valid: errors.length === 0,
    totalRows: rows.length,
    validRows: validRowsCount,
    errors,
  };
}

/**
 * Build a hierarchical diff comparison between the current local registry
 * and the incoming CSV rows. Used for visual diff preview before confirmation.
 *
 * @param current - Current active flat registry.
 * @param incoming - New incoming CSV rows.
 * @returns CSVDiffResult containing side-by-side differences.
 */
export function buildDiff(
  current: FlatRegistry,
  incoming: CSVRow[]
): CSVDiffResult {
  const entries: DiffEntry[] = [];
  const currentMap = new Map(current.map((c) => [pathKey.normalize(c.key), c]));
  const incomingMap = new Map<string, CSVRow>();

  // Parse and normalize all incoming keys
  for (const row of incoming) {
    if (pathKey.isValid(row._key)) {
      incomingMap.set(pathKey.normalize(row._key), row);
    }
  }

  // Find added and modified
  for (const [key, incRow] of incomingMap.entries()) {
    const cur = currentMap.get(key);
    if (!cur) {
      // Added
      entries.push({
        key,
        action: 'add',
        incomingLabel: incRow.label,
        incomingValue: incRow.value || '',
      });
    } else {
      // Check if modified
      const labelChanged = cur.label !== incRow.label;
      const valueChanged = cur.value !== (incRow.value || '');

      if (labelChanged || valueChanged) {
        entries.push({
          key,
          action: 'modify',
          currentLabel: cur.label,
          currentValue: cur.value,
          incomingLabel: incRow.label,
          incomingValue: incRow.value || '',
        });
      } else {
        entries.push({
          key,
          action: 'unchanged',
          currentLabel: cur.label,
          currentValue: cur.value,
          incomingLabel: incRow.label,
          incomingValue: incRow.value || '',
        });
      }
    }
  }

  // Find deleted
  for (const [key, cur] of currentMap.entries()) {
    if (!incomingMap.has(key)) {
      entries.push({
        key,
        action: 'delete',
        currentLabel: cur.label,
        currentValue: cur.value,
      });
    }
  }

  // Sort diff entries hierarchically by path key
  entries.sort((a, b) => pathKey.compare(a.key, b.key));

  let added = 0;
  let modified = 0;
  let deleted = 0;
  let unchanged = 0;

  for (const entry of entries) {
    if (entry.action === 'add') added++;
    else if (entry.action === 'modify') modified++;
    else if (entry.action === 'delete') deleted++;
    else if (entry.action === 'unchanged') unchanged++;
  }

  return {
    entries,
    added,
    modified,
    deleted,
    unchanged,
  };
}
