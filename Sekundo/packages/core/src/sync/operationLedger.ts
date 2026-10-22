/**
 * Sekundo — Sovereign Local-First Operation Ledger & Conflict-Free P2P Sync
 *
 * Implements:
 * 1. Append-Only Immutable Event Ledger (Audit Trail) with Hybrid Logical Clocks (HLC)
 * 2. Fine-grained Attribute-Level Reconciliation (No Monolithic Overwriting)
 * 3. True Unmark Propagation (`worked = 0` clears completion dates cleanly)
 * 4. 100% Offline / Client-Side Persistence (IndexedDB / localStorage)
 * 5. P2P Delta Serialization for Google STUN / WebRTC DataChannel & File/QR exchange
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import { compareHLC, createHLC, packHLC, unpackHLC } from './hlc';

export interface LedgerOperation {
  opId: string;            // Unique UUID or random nonce
  eventId: string;         // Event container ID
  nodeKey: string;         // Target node (e.g. '02-01-01-05')
  field: string;           // Attribute modified (e.g. 'worked', 'value', 'notes', 'meta.workerName')
  prevValue?: unknown;     // Previous value for rollback auditing
  newValue: unknown;       // New value to apply
  timestamp: string;       // ISO 8601 UTC timestamp
  authorId: string;        // Sovereign device fingerprint
  authorName?: string;     // Operator display name (e.g. 'Participante 01')
  sequence?: number;       // Monotonic sequence number
  hlc?: string;            // Packed Hybrid Logical Clock string for deterministic ordering
}

export interface ReconcileResult {
  updatedRegistry: FlatSkeletonEntry[];
  consolidatedLedger: LedgerOperation[];
  appliedOpsCount: number;
  conflictsResolvedCount: number;
  effectiveChangedKeys: string[];
}

export interface ReconcilePreview {
  incomingOpsCount: number;
  newOpsCount: number;
  conflictsCount: number;
  effectiveChangedKeys: string[];
}

/**
 * Creates an immutable ledger operation.
 */
export function createLedgerOperation(
  eventId: string,
  nodeKey: string,
  field: string,
  newValue: unknown,
  authorId: string,
  options: {
    prevValue?: unknown;
    authorName?: string;
    timestamp?: string;
    sequence?: number;
    hlc?: string;
  } = {}
): LedgerOperation {
  const ts = options.timestamp || new Date().toISOString();
  const parsedTime = Date.parse(ts);
  const nowMs = Number.isFinite(parsedTime) ? parsedTime : Date.now();
  const randomPart = Math.random().toString(36).substring(2, 10);
  const opId = `op_${nowMs}_${randomPart}`;
  const hlc = options.hlc || packHLC({
    ...createHLC(authorId, nowMs),
    logical: options.sequence ?? 0,
  });

  return {
    opId,
    eventId,
    nodeKey,
    field,
    prevValue: options.prevValue,
    newValue,
    timestamp: ts,
    authorId,
    authorName: options.authorName,
    sequence: options.sequence,
    hlc,
  };
}

/**
 * Deterministic total comparator for two operations targeting the same (nodeKey, field).
 * Returns < 0 if `a` is older than `b`, > 0 if `a` is newer than `b`.
 */
export function compareLedgerOperations(a: LedgerOperation, b: LedgerOperation): number {
  const tA = Date.parse(a.timestamp);
  const tB = Date.parse(b.timestamp);
  if (Number.isFinite(tA) && Number.isFinite(tB) && tA !== tB) {
    return tA - tB;
  }
  const hlcA = unpackHLC(a.hlc);
  const hlcB = unpackHLC(b.hlc);
  if (hlcA && hlcB) {
    const cmp = compareHLC(hlcA, hlcB);
    if (cmp !== 0) return cmp;
  }
  if ((a.sequence ?? 0) !== (b.sequence ?? 0)) {
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  }
  if (a.authorId !== b.authorId) {
    return a.authorId.localeCompare(b.authorId);
  }
  return a.opId.localeCompare(b.opId);
}

/**
 * Applies a single operation cleanly to a flat skeleton registry (immutable update).
 */
export function applyOperationToRegistry(
  registry: FlatSkeletonEntry[],
  op: LedgerOperation
): FlatSkeletonEntry[] {
  if (op.field === '__node_delete__') {
    if (op.newValue === true) {
      return registry.filter((entry) => entry.key !== op.nodeKey);
    }
    return registry;
  }

  if (op.field === '__node_upsert__' && op.newValue && typeof op.newValue === 'object') {
    const incomingNode = op.newValue as FlatSkeletonEntry;
    const exists = registry.some((entry) => entry.key === op.nodeKey);
    if (!exists) {
      return [...registry, { ...incomingNode, meta: { ...(incomingNode.meta || {}) } }];
    }
    return registry.map((entry) =>
      entry.key === op.nodeKey
        ? { ...entry, ...incomingNode, meta: { ...(entry.meta || {}), ...(incomingNode.meta || {}) } }
        : entry
    );
  }

  const nextRegistry = registry.map((entry) => {
    if (entry.key !== op.nodeKey) return entry;

    const nextEntry: FlatSkeletonEntry = {
      ...entry,
      meta: { ...(entry.meta || {}) },
    };

    if (op.field === 'value') {
      nextEntry.value = String(op.newValue ?? '');
    } else if (op.field === 'label') {
      nextEntry.label = String(op.newValue ?? '');
    } else if (op.field === 'worked') {
      const val = Number(op.newValue) === 1 ? 1 : 0;
      nextEntry.meta!.worked = val;
      if (val === 1) {
        nextEntry.value = nextEntry.value || op.authorName || 'Trabalhado';
        nextEntry.meta!.lastWorkedAt = op.timestamp;
        const dateOnly = op.timestamp.slice(0, 10);
        if (!nextEntry.meta!.completedAt) nextEntry.meta!.completedAt = dateOnly;
        if (!nextEntry.meta!.completed_date) nextEntry.meta!.completed_date = dateOnly;
        if (!nextEntry.meta!.data_conclusao) nextEntry.meta!.data_conclusao = dateOnly;
        if (op.authorName) nextEntry.meta!.workerName = op.authorName;
      } else {
        // Unmarking a unit must clear completion timestamps so recency & rollup reflect reality
        nextEntry.value = '';
        delete nextEntry.meta!.lastWorkedAt;
        delete nextEntry.meta!.completedAt;
        delete nextEntry.meta!.completed_date;
        delete nextEntry.meta!.data_conclusao;
        nextEntry.meta!.lastUnmarkedAt = op.timestamp;
      }
    } else if (op.field.startsWith('meta.')) {
      const metaKey = op.field.slice(5);
      if (op.newValue === undefined || op.newValue === null) {
        delete nextEntry.meta![metaKey];
      } else {
        nextEntry.meta![metaKey] = op.newValue;
      }
    } else {
      if (op.newValue === undefined || op.newValue === null) {
        delete nextEntry.meta![op.field];
      } else {
        nextEntry.meta![op.field] = op.newValue;
      }
    }

    return nextEntry;
  });

  return nextRegistry;
}

/**
 * Reconciles two independent ledgers (Local vs Incoming Peer).
 * Applies fine-grained Last-Write-Wins per (nodeKey, field) pair.
 * Never overwrites unrelated fields or other nodes!
 */
export function reconcileLedgers(
  localLedger: LedgerOperation[],
  incomingLedger: LedgerOperation[],
  currentRegistry: FlatSkeletonEntry[]
): ReconcileResult {
  const knownOpIds = new Set(localLedger.map((op) => op.opId));
  const newOpsFromPeer: LedgerOperation[] = [];

  for (const op of incomingLedger) {
    if (!knownOpIds.has(op.opId)) {
      newOpsFromPeer.push(op);
      knownOpIds.add(op.opId);
    }
  }

  // Combine all operations
  const consolidatedLedger = [...localLedger, ...newOpsFromPeer];

  // Group all operations by Target Property: `${nodeKey}::${field}`
  const targetPropertyMap = new Map<string, LedgerOperation[]>();

  for (const op of consolidatedLedger) {
    const propKey = `${op.nodeKey}::${op.field}`;
    if (!targetPropertyMap.has(propKey)) {
      targetPropertyMap.set(propKey, []);
    }
    targetPropertyMap.get(propKey)!.push(op);
  }

  // Determine winning operation for each property
  let conflictsResolvedCount = 0;
  const winningOperations: LedgerOperation[] = [];

  for (const [, opList] of targetPropertyMap.entries()) {
    if (opList.length === 1) {
      winningOperations.push(opList[0]);
    } else {
      conflictsResolvedCount += opList.length - 1;
      opList.sort(compareLedgerOperations);
      winningOperations.push(opList[opList.length - 1]);
    }
  }

  // Apply all winning operations to current registry
  let updatedRegistry = [...currentRegistry];
  for (const winningOp of winningOperations) {
    updatedRegistry = applyOperationToRegistry(updatedRegistry, winningOp);
  }

  // Compute which nodes effectively changed compared to currentRegistry
  const beforeMap = new Map<string, string>();
  for (const entry of currentRegistry) {
    beforeMap.set(entry.key, JSON.stringify({ v: entry.value, l: entry.label, m: entry.meta || {} }));
  }
  const effectiveChangedKeys: string[] = [];
  for (const entry of updatedRegistry) {
    const snap = JSON.stringify({ v: entry.value, l: entry.label, m: entry.meta || {} });
    if (beforeMap.get(entry.key) !== snap) {
      effectiveChangedKeys.push(entry.key);
    }
  }

  return {
    updatedRegistry,
    consolidatedLedger,
    appliedOpsCount: newOpsFromPeer.length,
    conflictsResolvedCount,
    effectiveChangedKeys,
  };
}

/**
 * Dry-run preview of ledger reconciliation before committing changes.
 */
export function previewReconcileLedgers(
  localLedger: LedgerOperation[],
  incomingLedger: LedgerOperation[],
  currentRegistry: FlatSkeletonEntry[]
): ReconcilePreview {
  const res = reconcileLedgers(localLedger, incomingLedger, currentRegistry);
  return {
    incomingOpsCount: incomingLedger.length,
    newOpsCount: res.appliedOpsCount,
    conflictsCount: res.conflictsResolvedCount,
    effectiveChangedKeys: res.effectiveChangedKeys,
  };
}

/**
 * Synthesizes ledger operations from a registry's current state when incremental ops
 * were not yet recorded or when exporting a full state delta, preserving real edit timestamps
 * and including unmark transitions (`worked = 0`), notes, and manual quadra geometry.
 */
export function synthesizeOpsFromRegistry(
  eventId: string,
  registry: FlatSkeletonEntry[],
  authorId: string,
  options: { excludeNotes?: boolean } = {}
): LedgerOperation[] {
  const ops: LedgerOperation[] = [];
  let seq = 0;

  for (const node of registry) {
    const meta = (node.meta || {}) as Record<string, any>;
    const worked = Number(meta.worked) === 1 ? 1 : 0;
    const workedTs =
      worked === 1
        ? (typeof meta.lastWorkedAt === 'string' && meta.lastWorkedAt) ||
          (typeof meta.completedAt === 'string' && `${meta.completedAt}T12:00:00.000Z`) ||
          undefined
        : (typeof meta.lastUnmarkedAt === 'string' && meta.lastUnmarkedAt) || undefined;

    if (worked === 1 || workedTs) {
      ops.push(
        createLedgerOperation(eventId, node.key, 'worked', worked, authorId, {
          authorName: node.value || meta.workerName || 'Operador',
          timestamp: workedTs || '1970-01-01T00:00:00.000Z',
          sequence: seq++,
        })
      );
    }

    if (!options.excludeNotes && typeof meta.notes === 'string' && meta.notes.trim() !== '') {
      ops.push(
        createLedgerOperation(eventId, node.key, 'notes', meta.notes, authorId, {
          timestamp: (typeof meta.notesUpdatedAt === 'string' && meta.notesUpdatedAt) || workedTs || '1970-01-01T00:00:00.000Z',
          sequence: seq++,
        })
      );
    }

    const syncedMetaFields = [
      'pinShape',
      'pinColor',
      'customColor',
      'bufferMeters',
      'boundaryPolygon',
      'boundarySource',
      'perimeter_streets',
      'showOutline',
    ] as const;

    for (const field of syncedMetaFields) {
      if (meta[field] !== undefined) {
        ops.push(
          createLedgerOperation(eventId, node.key, `meta.${field}`, meta[field], authorId, {
            timestamp: (typeof meta.metaUpdatedAt === 'string' && meta.metaUpdatedAt) || workedTs || '1970-01-01T00:00:00.000Z',
            sequence: seq++,
          })
        );
      }
    }
  }

  return ops;
}

/**
 * Filters and exports delta operations created after a given timestamp.
 */
export function exportLedgerDelta(
  ledger: LedgerOperation[],
  sinceTimestamp?: string
): LedgerOperation[] {
  if (!sinceTimestamp) return ledger;
  const refTime = new Date(sinceTimestamp).getTime();
  return ledger.filter((op) => new Date(op.timestamp).getTime() > refTime);
}

/**
 * Compact delta message contract for WebRTC DataChannel P2P transport.
 */
export interface P2PSyncMessage {
  type: 'SEKUNDO_DELTA_SYNC' | 'SEKUNDO_ACK';
  eventId: string;
  senderAuthorId: string;
  senderName?: string;
  operations: LedgerOperation[];
  sentAt: string;
}

export function createP2PSyncMessage(
  eventId: string,
  senderAuthorId: string,
  operations: LedgerOperation[],
  senderName?: string
): P2PSyncMessage {
  return {
    type: 'SEKUNDO_DELTA_SYNC',
    eventId,
    senderAuthorId,
    senderName,
    operations,
    sentAt: new Date().toISOString(),
  };
}

/**
 * Computes fine-grained HLC `LedgerOperation`s representing the exact attribute-level
 * differences between `prevRegistry` and `nextRegistry`.
 */
export function diffSkeletonToLedgerOperations(
  eventId: string,
  prevRegistry: FlatSkeletonEntry[],
  nextRegistry: FlatSkeletonEntry[],
  authorId: string,
  authorName?: string
): LedgerOperation[] {
  const ops: LedgerOperation[] = [];
  const prevMap = new Map<string, FlatSkeletonEntry>();
  for (const entry of prevRegistry || []) {
    prevMap.set(entry.key, entry);
  }
  const nextKeys = new Set<string>();
  let seq = 0;
  const nowIso = new Date().toISOString();

  for (const nextEntry of nextRegistry || []) {
    nextKeys.add(nextEntry.key);
    const prevEntry = prevMap.get(nextEntry.key);
    if (!prevEntry) {
      ops.push(
        createLedgerOperation(eventId, nextEntry.key, '__node_upsert__', nextEntry, authorId, {
          authorName,
          timestamp: nowIso,
          sequence: seq++,
        })
      );
      continue;
    }

    if ((nextEntry.value ?? '') !== (prevEntry.value ?? '')) {
      ops.push(
        createLedgerOperation(eventId, nextEntry.key, 'value', nextEntry.value ?? '', authorId, {
          prevValue: prevEntry.value ?? '',
          authorName,
          timestamp: nowIso,
          sequence: seq++,
        })
      );
    }

    if ((nextEntry.label ?? '') !== (prevEntry.label ?? '')) {
      ops.push(
        createLedgerOperation(eventId, nextEntry.key, 'label', nextEntry.label ?? '', authorId, {
          prevValue: prevEntry.label ?? '',
          authorName,
          timestamp: nowIso,
          sequence: seq++,
        })
      );
    }

    const prevMeta = (prevEntry.meta || {}) as Record<string, unknown>;
    const nextMeta = (nextEntry.meta || {}) as Record<string, unknown>;
    const allMetaKeys = new Set([...Object.keys(prevMeta), ...Object.keys(nextMeta)]);
    for (const metaKey of allMetaKeys) {
      if (JSON.stringify(prevMeta[metaKey]) !== JSON.stringify(nextMeta[metaKey])) {
        const fieldName = metaKey === 'worked' ? 'worked' : `meta.${metaKey}`;
        ops.push(
          createLedgerOperation(eventId, nextEntry.key, fieldName, nextMeta[metaKey], authorId, {
            prevValue: prevMeta[metaKey],
            authorName,
            timestamp: nowIso,
            sequence: seq++,
          })
        );
      }
    }
  }

  for (const prevEntry of prevRegistry || []) {
    if (!nextKeys.has(prevEntry.key)) {
      ops.push(
        createLedgerOperation(eventId, prevEntry.key, '__node_delete__', true, authorId, {
          prevValue: prevEntry,
          authorName,
          timestamp: nowIso,
          sequence: seq++,
        })
      );
    }
  }

  return ops;
}
