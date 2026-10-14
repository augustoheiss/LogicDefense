/**
 * Sekundo — Sovereign Local Operation Ledger Store
 *
 * Persists a cryptographically unique deviceId (`sekundo:device-id`),
 * a Hybrid Logical Clock (`HLC`), and an incremental operation log per event
 * (`sekundo:ledger:<eventId>`) 100% locally on the user's device.
 */

import type { FlatRegistry, LedgerOperation, NodePatch, HLC } from '@sekundo/core';
import {
  createHLC,
  tickHLC,
  packHLC,
  createLedgerOperation,
  compareLedgerOperations,
  pathKey,
} from '@sekundo/core';
import { storage } from './localStorage';

const DEVICE_ID_KEY = 'sekundo:device-id';
const LEDGER_PREFIX = 'sekundo:ledger:';
const MAX_LEDGER_OPS = 2500;

let cachedDeviceId: string | null = null;
let cachedHLC: HLC | null = null;

function generateRandomId(): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `dev_${hex}`;
}

/**
 * Returns a persistent, unique device identifier for this browser/app install.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = await storage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim()) {
      cachedDeviceId = existing.trim();
      return cachedDeviceId;
    }
  } catch {
    // Ignore read error
  }
  const nextId = generateRandomId();
  cachedDeviceId = nextId;
  await storage.setItem(DEVICE_ID_KEY, nextId).catch(() => undefined);
  return nextId;
}

/**
 * Loads the persisted operation ledger for an event.
 */
export async function loadEventLedger(eventId: string): Promise<LedgerOperation[]> {
  if (!eventId) return [];
  try {
    const raw = await storage.getItem(`${LEDGER_PREFIX}${eventId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves and compacts the operation ledger for an event (keeping latest operation per (nodeKey, field)).
 */
export async function saveEventLedger(eventId: string, ops: LedgerOperation[]): Promise<void> {
  if (!eventId) return;
  // Compact by keeping the winning operation per (nodeKey, field) so the ledger stays fast and small
  const latestByField = new Map<string, LedgerOperation>();
  for (const op of ops) {
    const k = `${pathKey.normalize(op.nodeKey)}::${op.field}`;
    const existing = latestByField.get(k);
    if (!existing || compareLedgerOperations(existing, op) <= 0) {
      latestByField.set(k, op);
    }
  }
  const compacted = Array.from(latestByField.values()).slice(-MAX_LEDGER_OPS);
  await storage.setItem(`${LEDGER_PREFIX}${eventId}`, JSON.stringify(compacted));
}

const TRACKED_META_FIELDS = [
  'notes',
  'pinShape',
  'pinColor',
  'customColor',
  'bufferMeters',
  'boundaryPolygon',
  'boundarySource',
  'perimeter_streets',
  'showOutline',
] as const;

/**
 * Records a batch of node patches into the local operation ledger with monotonic HLC timestamps.
 */
export async function recordPatchesInLedger(
  eventId: string,
  prevRegistry: FlatRegistry,
  patches: NodePatch[]
): Promise<void> {
  if (!eventId || patches.length === 0) return;

  const deviceId = await getOrCreateDeviceId();
  const prevByKey = new Map(prevRegistry.map((n) => [pathKey.normalize(n.key), n]));
  const existingLedger = await loadEventLedger(eventId);
  const newOps: LedgerOperation[] = [];
  let seq = existingLedger.length;

  for (const patch of patches) {
    const normKey = pathKey.normalize(patch.key);
    const prevNode = prevByKey.get(normKey);
    const prevMeta = (prevNode?.meta || {}) as Record<string, any>;
    const nextMeta = (patch.updates.meta || prevMeta) as Record<string, any>;

    cachedHLC = cachedHLC ? tickHLC(cachedHLC, deviceId) : createHLC(deviceId);
    const hlcStr = packHLC(cachedHLC);
    const nowIso = new Date(cachedHLC.physical).toISOString();

    if (
      patch.updates.meta &&
      nextMeta.worked !== undefined &&
      Number(nextMeta.worked) !== Number(prevMeta.worked)
    ) {
      const workedVal = Number(nextMeta.worked) === 1 ? 1 : 0;
      const mutTs =
        workedVal === 1
          ? (typeof nextMeta.lastWorkedAt === 'string' && nextMeta.lastWorkedAt) || nowIso
          : (typeof nextMeta.lastUnmarkedAt === 'string' && nextMeta.lastUnmarkedAt) || nowIso;

      newOps.push(
        createLedgerOperation(eventId, normKey, 'worked', workedVal, deviceId, {
          prevValue: prevMeta.worked,
          authorName: String(patch.updates.value ?? prevNode?.value ?? nextMeta.workerName ?? 'Voluntário'),
          timestamp: mutTs,
          sequence: seq++,
          hlc: hlcStr,
        })
      );
    }

    if (patch.updates.meta) {
      for (const field of TRACKED_META_FIELDS) {
        if (JSON.stringify(nextMeta[field]) !== JSON.stringify(prevMeta[field])) {
          cachedHLC = tickHLC(cachedHLC, deviceId);
          const fieldName = field === 'notes' ? 'notes' : `meta.${field}`;
          newOps.push(
            createLedgerOperation(eventId, normKey, fieldName, nextMeta[field], deviceId, {
              prevValue: prevMeta[field],
              timestamp: new Date(cachedHLC.physical).toISOString(),
              sequence: seq++,
              hlc: packHLC(cachedHLC),
            })
          );
        }
      }
    }
  }

  if (newOps.length > 0) {
    await saveEventLedger(eventId, [...existingLedger, ...newOps]);
  }
}
