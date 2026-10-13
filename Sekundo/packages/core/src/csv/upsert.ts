/**
 * Sekundo — State-Preserving CSV/XLSX Upsert Ingestion Engine
 *
 * Implements intelligent batch ingestion that preserves operational history
 * (e.g. worked: 1, lastWorkedAt, notes, assignments) when re-importing updated
 * spreadsheets. This solves the core pain point of legacy tools (like Hourglass)
 * that either prevent re-importing or wipe out field records upon ingestion.
 */

import type { FlatRegistry, FlatSkeletonEntry, NodeType, PathKey } from '../skeleton/types';
import type { CSVRow } from './types';
import * as pathKey from '../skeleton/pathKey';

// ---------------------------------------------------------------------------
// Types & Options
// ---------------------------------------------------------------------------

export interface UpsertOptions {
  /**
   * If true, forces incoming state values to overwrite current state.
   * Default is false (preserves current state!).
   */
  forceOverwriteState?: boolean;

  /**
   * Metadata keys that must be preserved from the current node if present.
   * Defaults to: ['worked', 'lastWorkedAt', 'workerName', 'notes', 'status', 'history']
   */
  preserveMetaFields?: string[];

  /**
   * If true, existing nodes not present in the incoming data are kept.
   * If false, unmatched existing nodes are removed.
   * Default is true.
   */
  preserveUnmatchedCurrent?: boolean;

  /**
   * If true, updates node label if changed in incoming data.
   * Default is true.
   */
  updateLabels?: boolean;

  /**
   * If true, updates node value if changed in incoming data.
   * Default is true.
   */
  updateValues?: boolean;

  /**
   * If true, updates node email if changed in incoming data.
   * Default is true.
   */
  updateEmails?: boolean;
}

export interface UpsertDetailEntry {
  key: PathKey;
  action: 'added' | 'updated' | 'unchanged' | 'deleted';
  changes: string[];
  preservedHistory: boolean;
  currentLabel?: string;
  incomingLabel?: string;
}

export interface UpsertResult {
  updatedRegistry: FlatRegistry;
  diff: {
    addedCount: number;
    updatedCount: number;
    unchangedCount: number;
    deletedCount: number;
    preservedHistoryCount: number;
    details: UpsertDetailEntry[];
  };
}

const DEFAULT_PRESERVE_FIELDS = [
  'worked',
  'lastWorkedAt',
  'assignedAt',
  'assigned_date',
  'data_designacao',
  'completedAt',
  'completed_date',
  'data_conclusao',
  'workerName',
  'notes',
  'status',
  'history',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a CSVRow into a FlatSkeletonEntry.
 * Parses `_meta_json` and gathers any extra custom columns into `meta`.
 */
export function rowToFlatEntry(row: CSVRow): FlatSkeletonEntry {
  let meta: Record<string, unknown> = {};

  if (row._meta_json && row._meta_json.trim() !== '') {
    try {
      meta = JSON.parse(row._meta_json);
    } catch {
      meta = {};
    }
  }

  // Also collect any extra columns in CSVRow not in standard headers
  const standardHeaders = new Set(['_key', '_type', 'label', 'value', 'email', '_meta_json']);
  for (const [col, val] of Object.entries(row)) {
    if (!standardHeaders.has(col) && val !== undefined && val !== '') {
      if (meta[col] === undefined) {
        // Parse numbers if numeric
        const num = Number(val);
        if (!isNaN(num) && val.trim() !== '') {
          meta[col] = num;
        } else if (val.toLowerCase() === 'true') {
          meta[col] = true;
        } else if (val.toLowerCase() === 'false') {
          meta[col] = false;
        } else {
          meta[col] = val;
        }
      }
    }
  }

  // Normalize date aliases
  if (meta.assigned_date || meta.data_designacao) {
    meta.assignedAt = meta.assignedAt || meta.assigned_date || meta.data_designacao;
  }
  if (meta.completed_date || meta.data_conclusao) {
    meta.completedAt = meta.completedAt || meta.completed_date || meta.data_conclusao;
  }

  const rawType = (row._type || '').trim().toLowerCase();
  const validTypes: NodeType[] = ['slot', 'territory', 'header', 'note'];
  const type: NodeType = validTypes.includes(rawType as NodeType)
    ? (rawType as NodeType)
    : 'territory';

  return {
    key: pathKey.normalize(row._key),
    type,
    label: (row.label || '').trim(),
    value: row.value || '',
    email: (row.email || '').trim(),
    meta,
  };
}

// ---------------------------------------------------------------------------
// Core Upsert Function
// ---------------------------------------------------------------------------

/**
 * Ingest incoming records into an existing flat registry while strictly
 * preserving field operational history (e.g. worked status, timestamps, notes)
 * unless explicitly instructed to overwrite.
 */
export function upsertRegistry(
  current: FlatRegistry,
  incoming: CSVRow[] | FlatRegistry,
  options?: UpsertOptions
): UpsertResult {
  const opts: Required<UpsertOptions> = {
    forceOverwriteState: options?.forceOverwriteState ?? false,
    preserveMetaFields: options?.preserveMetaFields ?? DEFAULT_PRESERVE_FIELDS,
    preserveUnmatchedCurrent: options?.preserveUnmatchedCurrent ?? true,
    updateLabels: options?.updateLabels ?? true,
    updateValues: options?.updateValues ?? true,
    updateEmails: options?.updateEmails ?? true,
  };

  // Convert incoming to FlatRegistry format
  const incomingEntries: FlatSkeletonEntry[] = incoming.map((item) => {
    if ('_key' in item) {
      return rowToFlatEntry(item as CSVRow);
    }
    return {
      ...item,
      key: pathKey.normalize(item.key),
    };
  });

  const currentMap = new Map<string, FlatSkeletonEntry>();
  for (const entry of current) {
    currentMap.set(pathKey.normalize(entry.key), entry);
  }

  const incomingMap = new Map<string, FlatSkeletonEntry>();
  for (const entry of incomingEntries) {
    if (pathKey.isValid(entry.key)) {
      incomingMap.set(pathKey.normalize(entry.key), entry);
    }
  }

  const updatedEntriesMap = new Map<string, FlatSkeletonEntry>();
  const details: UpsertDetailEntry[] = [];
  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let deletedCount = 0;
  let preservedHistoryCount = 0;

  // 1. Process all incoming entries (adds & updates)
  for (const [key, inc] of incomingMap.entries()) {
    const cur = currentMap.get(key);

    if (!cur) {
      // BRAND NEW ENTRY
      // Ensure territory nodes have default worked = 0 if unspecified
      const newMeta = { ...inc.meta };
      if (inc.type === 'territory' && newMeta.worked === undefined) {
        newMeta.worked = 0;
      }

      const newEntry: FlatSkeletonEntry = {
        ...inc,
        meta: newMeta,
      };

      updatedEntriesMap.set(key, newEntry);
      addedCount++;
      details.push({
        key,
        action: 'added',
        changes: ['New node added to hierarchy'],
        preservedHistory: false,
        incomingLabel: inc.label,
      });
    } else {
      // EXISTING ENTRY: INTELLIGENT MERGE & STATE PRESERVATION
      const changes: string[] = [];
      let preservedHistory = false;

      // Label
      let finalLabel = cur.label;
      if (opts.updateLabels && inc.label && inc.label !== cur.label) {
        changes.push(`Label updated: "${cur.label}" -> "${inc.label}"`);
        finalLabel = inc.label;
      }

      // Value
      let finalValue = cur.value;
      if (opts.updateValues && inc.value !== undefined && inc.value !== cur.value) {
        changes.push(`Value updated: "${cur.value}" -> "${inc.value}"`);
        finalValue = inc.value;
      }

      // Email
      let finalEmail = cur.email;
      if (opts.updateEmails && inc.email !== undefined && inc.email !== cur.email) {
        changes.push(`Email updated: "${cur.email}" -> "${inc.email}"`);
        finalEmail = inc.email;
      }

      // Type
      const finalType = inc.type || cur.type;
      if (inc.type && inc.type !== cur.type) {
        changes.push(`Type changed: "${cur.type}" -> "${inc.type}"`);
      }

      // Meta merge
      const mergedMeta: Record<string, unknown> = { ...cur.meta, ...inc.meta };

      if (!opts.forceOverwriteState) {
        // Restore protected operational fields from current node
        for (const field of opts.preserveMetaFields) {
          if (cur.meta[field] !== undefined) {
            mergedMeta[field] = cur.meta[field];
            if (cur.meta[field] !== inc.meta[field]) {
              preservedHistory = true;
              changes.push(`Preserved current state for "${field}": ${JSON.stringify(cur.meta[field])}`);
            }
          }
        }
      } else {
        // Force overwrite mode was chosen
        for (const field of opts.preserveMetaFields) {
          if (inc.meta[field] !== undefined && inc.meta[field] !== cur.meta[field]) {
            changes.push(`Overwrote state for "${field}" with incoming value`);
          }
        }
      }

      // Check for new extra meta fields introduced by incoming
      for (const [mKey, mVal] of Object.entries(inc.meta)) {
        if (!opts.preserveMetaFields.includes(mKey) && cur.meta[mKey] !== mVal) {
          changes.push(`Metadata updated for "${mKey}"`);
        }
      }

      const mergedEntry: FlatSkeletonEntry = {
        key,
        type: finalType,
        label: finalLabel,
        value: finalValue,
        email: finalEmail,
        meta: mergedMeta,
      };

      updatedEntriesMap.set(key, mergedEntry);

      if (preservedHistory) {
        preservedHistoryCount++;
      }

      if (changes.length > 0) {
        updatedCount++;
        details.push({
          key,
          action: 'updated',
          changes,
          preservedHistory,
          currentLabel: cur.label,
          incomingLabel: inc.label,
        });
      } else {
        unchangedCount++;
        details.push({
          key,
          action: 'unchanged',
          changes: ['No changes detected'],
          preservedHistory,
          currentLabel: cur.label,
          incomingLabel: inc.label,
        });
      }
    }
  }

  // 2. Process current entries not in incoming
  for (const [key, cur] of currentMap.entries()) {
    if (!incomingMap.has(key)) {
      if (opts.preserveUnmatchedCurrent) {
        // Keep unmatched current entries
        updatedEntriesMap.set(key, cur);
        unchangedCount++;
        details.push({
          key,
          action: 'unchanged',
          changes: ['Retained existing node (not present in incoming file)'],
          preservedHistory: false,
          currentLabel: cur.label,
        });
      } else {
        // Delete unmatched current entries
        deletedCount++;
        details.push({
          key,
          action: 'deleted',
          changes: ['Removed node (missing from incoming file)'],
          preservedHistory: false,
          currentLabel: cur.label,
        });
      }
    }
  }

  // 3. Sort updated registry hierarchically
  const updatedRegistry = Array.from(updatedEntriesMap.values());
  updatedRegistry.sort((a, b) => pathKey.compare(a.key, b.key));
  details.sort((a, b) => pathKey.compare(a.key, b.key));

  return {
    updatedRegistry,
    diff: {
      addedCount,
      updatedCount,
      unchangedCount,
      deletedCount,
      preservedHistoryCount,
      details,
    },
  };
}
