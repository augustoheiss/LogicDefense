/**
 * Sekundo Document Studio — HLC Document & Form Operations (`sync/docOps.ts`)
 *
 * Implements Phase R4 (§8.5):
 * - Asynchronous HLC operations at the field level (`setFieldValue(recordId, fieldKey, value, hlc)`)
 *   and CST layout level (`patchSdoc(path, value, hlc)`).
 * - Transport-agnostic compact serialization (`SEKUNDO_DOC_DELTA_v2:`) for QR Code, WhatsApp link,
 *   file attachment, or future WebRTC DataChannel.
 * - Explicit conflict tracking when two peers modify the same `(recordId, fieldKey)`.
 */

import { compareHLC, packHLC, unpackHLC, type HLC } from './hlc';
import type { FormFieldValue, FormRecordDocument } from '../doc/formRecord';
import { SdocCstMutator } from '../doc/schema';

export const DOC_DELTA_PREFIX = 'SEKUNDO_DOC_DELTA_v2:';

export interface DocFieldOperation {
  kind: 'setFieldValue';
  recordId: string;
  fieldKey: string;
  value: FormFieldValue;
  hlc: string;
  author?: string;
}

export interface DocSdocOperation {
  kind: 'patchSdoc';
  path: (string | number)[];
  value: unknown;
  hlc: string;
  author?: string;
}

export type DocSyncOperation = DocFieldOperation | DocSdocOperation;

export interface DocFieldConflict {
  recordId: string;
  fieldKey: string;
  winnerValue: FormFieldValue;
  loserValue: FormFieldValue;
  winnerHlc: string;
  loserHlc: string;
}

export function createSetFieldValueOp(
  recordId: string,
  fieldKey: string,
  value: FormFieldValue,
  hlc: HLC | string,
  author?: string
): DocFieldOperation {
  return {
    kind: 'setFieldValue',
    recordId: recordId || 'rec_1',
    fieldKey,
    value,
    hlc: typeof hlc === 'string' ? hlc : packHLC(hlc),
    ...(author ? { author } : {}),
  };
}

export function createPatchSdocOp(
  path: (string | number)[],
  value: unknown,
  hlc: HLC | string,
  author?: string
): DocSdocOperation {
  return {
    kind: 'patchSdoc',
    path,
    value,
    hlc: typeof hlc === 'string' ? hlc : packHLC(hlc),
    ...(author ? { author } : {}),
  };
}

function comparePackedHlc(a: string, b: string): number {
  const ua = unpackHLC(a);
  const ub = unpackHLC(b);
  if (ua && ub) return compareHLC(ua, ub);
  return a.localeCompare(b);
}

/**
 * Deterministically reconciles a list of `DocFieldOperation`s into a `FormRecordDocument`
 * using Last-Write-Wins (HLC total order) while reporting any concurrent field conflicts.
 */
export function reconcileDocFieldOps(
  baseDoc: FormRecordDocument,
  ops: DocFieldOperation[],
  initialHlcMap: Record<string, string> = {}
): {
  doc: FormRecordDocument;
  hlcMap: Record<string, string>;
  conflicts: DocFieldConflict[];
} {
  const recordsMap = new Map<string, Record<string, FormFieldValue>>();
  for (const r of baseDoc.records) {
    recordsMap.set(r.id, { ...r.values });
  }
  if (recordsMap.size === 0) {
    recordsMap.set('rec_1', {});
  }

  const hlcMap: Record<string, string> = { ...initialHlcMap };
  const conflicts: DocFieldConflict[] = [];

  const sortedOps = [...ops].sort((a, b) => comparePackedHlc(a.hlc, b.hlc));

  for (const op of sortedOps) {
    if (op.kind !== 'setFieldValue') continue;
    const recId = op.recordId || 'rec_1';
    let recVals = recordsMap.get(recId);
    if (!recVals) {
      recVals = {};
      recordsMap.set(recId, recVals);
    }

    const slotKey = `${recId}::${op.fieldKey}`;
    const prevHlc = hlcMap[slotKey];
    const prevVal = recVals[op.fieldKey];

    if (!prevHlc || comparePackedHlc(op.hlc, prevHlc) >= 0) {
      if (prevHlc && prevVal !== undefined && prevVal !== op.value && prevHlc !== op.hlc) {
        conflicts.push({
          recordId: recId,
          fieldKey: op.fieldKey,
          winnerValue: op.value,
          loserValue: prevVal,
          winnerHlc: op.hlc,
          loserHlc: prevHlc,
        });
      }
      recVals[op.fieldKey] = op.value;
      hlcMap[slotKey] = op.hlc;
    } else if (prevVal !== undefined && prevVal !== op.value) {
      conflicts.push({
        recordId: recId,
        fieldKey: op.fieldKey,
        winnerValue: prevVal,
        loserValue: op.value,
        winnerHlc: prevHlc,
        loserHlc: op.hlc,
      });
    }
  }

  const nextRecords = Array.from(recordsMap.entries()).map(([id, values]) => ({
    id,
    values,
  }));

  return {
    doc: {
      form: 1,
      ...(baseDoc.template ? { template: baseDoc.template } : {}),
      records: nextRecords,
    },
    hlcMap,
    conflicts,
  };
}

/**
 * Applies `DocSdocOperation`s in HLC order to a `.sdoc.yaml` string while preserving comments.
 */
export function applyPatchSdocOps(yamlSource: string, ops: DocSdocOperation[]): string {
  const sorted = [...ops]
    .filter((o) => o.kind === 'patchSdoc')
    .sort((a, b) => comparePackedHlc(a.hlc, b.hlc));

  let current = yamlSource;
  for (const op of sorted) {
    current = SdocCstMutator.setInPlace(current, op.path, op.value);
  }
  return current;
}

/**
 * Encodes a batch of document sync operations into a compact `SEKUNDO_DOC_DELTA_v2:` envelope.
 */
export function encodeDocSyncEnvelope(
  templateHash: string,
  ops: DocSyncOperation[]
): string {
  const payload = JSON.stringify({
    v: 2,
    tpl: templateHash,
    ops,
  });
  return `${DOC_DELTA_PREFIX}${encodeURIComponent(payload)}`;
}

/**
 * Decodes a `SEKUNDO_DOC_DELTA_v2:` envelope back into `{ templateHash, ops }`.
 */
export function decodeDocSyncEnvelope(
  envelope: string
): { templateHash: string; ops: DocSyncOperation[] } | null {
  if (!envelope || typeof envelope !== 'string') return null;
  const trimmed = envelope.trim();
  if (!trimmed.startsWith(DOC_DELTA_PREFIX)) return null;
  try {
    const jsonStr = decodeURIComponent(trimmed.slice(DOC_DELTA_PREFIX.length));
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ops)) {
      return null;
    }
    return {
      templateHash: String(parsed.tpl || ''),
      ops: parsed.ops as DocSyncOperation[],
    };
  } catch {
    return null;
  }
}
