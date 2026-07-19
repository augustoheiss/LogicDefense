/**
 * Sekundo — CSV Type Definitions
 */

import type { NodeType, PathKey } from '../skeleton/types';

// ---------------------------------------------------------------------------
// CSV Row
// ---------------------------------------------------------------------------

/**
 * A single row parsed from a CSV file.
 * Maps directly to FlatSkeletonEntry but keeps raw string values
 * before validation.
 */
export interface CSVRow {
  _key: string;
  _type: string;
  label: string;
  value?: string;
  email?: string;
  _meta_json?: string;
  /** Any extra columns the admin added (preserved on export). */
  [extraColumn: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Result of validating a single CSV row. */
export interface RowValidationResult {
  row: number;
  key: string;
  valid: boolean;
  errors: string[];
}

/** Result of validating an entire CSV file. */
export interface CSVValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errors: RowValidationResult[];
}

// ---------------------------------------------------------------------------
// Diff (for conflict resolution UI)
// ---------------------------------------------------------------------------

export type DiffAction = 'add' | 'modify' | 'delete' | 'unchanged';

/** A single diff entry comparing current vs incoming data. */
export interface DiffEntry {
  key: PathKey;
  action: DiffAction;
  currentLabel?: string;
  currentValue?: string;
  incomingLabel?: string;
  incomingValue?: string;
}

/** Full diff result for the conflict resolution UI. */
export interface CSVDiffResult {
  entries: DiffEntry[];
  added: number;
  modified: number;
  deleted: number;
  unchanged: number;
}
