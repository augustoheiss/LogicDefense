/**
 * Sekundo — Sovereign Local-First Operation Ledger & Conflict-Free P2P Sync
 *
 * Implements:
 * 1. Append-Only Immutable Event Ledger (Audit Trail)
 * 2. Fine-grained Attribute-Level Reconciliation (No Monolithic Overwriting)
 * 3. 100% Offline / Client-Side Persistence (IndexedDB / localStorage)
 * 4. P2P Delta Serialization for Google STUN / WebRTC DataChannel
 */

import type { FlatSkeletonEntry } from '../skeleton/types';

export interface LedgerOperation {
  opId: string;            // Unique UUID or random nonce
  eventId: string;         // Event container ID
  nodeKey: string;         // Target node (e.g. '02-01-01-05')
  field: string;           // Attribute modified (e.g. 'worked', 'value', 'notes', 'meta.workerName')
  prevValue?: unknown;     // Previous value for rollback auditing
  newValue: unknown;       // New value to apply
  timestamp: string;       // ISO 8601 UTC timestamp
  authorId: string;        // Sovereign device fingerprint
  authorName?: string;     // Volunteer display name (e.g. 'Nelson')
  sequence?: number;       // Monotonic sequence number
}

export interface ReconcileResult {
  updatedRegistry: FlatSkeletonEntry[];
  consolidatedLedger: LedgerOperation[];
  appliedOpsCount: number;
  conflictsResolvedCount: number;
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
  } = {}
): LedgerOperation {
  const ts = options.timestamp || new Date().toISOString();
  const randomPart = Math.random().toString(36).substring(2, 10);
  const opId = `op_${Date.now()}_${randomPart}`;

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
  };
}

/**
 * Applies a single operation cleanly to a flat skeleton registry (immutable update).
 */
export function applyOperationToRegistry(
  registry: FlatSkeletonEntry[],
  op: LedgerOperation
): FlatSkeletonEntry[] {
  let matched = false;

  const nextRegistry = registry.map((entry) => {
    if (entry.key !== op.nodeKey) return entry;

    matched = true;
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
        if (op.authorName) nextEntry.meta!.workerName = op.authorName;
      } else {
        nextEntry.value = '';
      }
    } else if (op.field.startsWith('meta.')) {
      const metaKey = op.field.slice(5);
      nextEntry.meta![metaKey] = op.newValue;
    } else {
      nextEntry.meta![op.field] = op.newValue;
    }

    return nextEntry;
  });

  // If node doesn't exist yet, we do not fabricate invalid branches, but keep registry valid
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

  for (const [propKey, opList] of targetPropertyMap.entries()) {
    if (opList.length === 1) {
      winningOperations.push(opList[0]);
    } else {
      conflictsResolvedCount += opList.length - 1;
      // Sort chronologically ascending (latest wins)
      opList.sort((a, b) => {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.opId.localeCompare(b.opId); // Deterministic tie breaker
      });
      winningOperations.push(opList[opList.length - 1]);
    }
  }

  // Apply all winning operations to current registry
  let updatedRegistry = [...currentRegistry];
  for (const winningOp of winningOperations) {
    updatedRegistry = applyOperationToRegistry(updatedRegistry, winningOp);
  }

  return {
    updatedRegistry,
    consolidatedLedger,
    appliedOpsCount: newOpsFromPeer.length,
    conflictsResolvedCount,
  };
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
