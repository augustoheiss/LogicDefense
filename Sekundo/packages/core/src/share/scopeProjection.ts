/**
 * Sekundo — Scoped Data Projection Engine (`Phase F1`)
 *
 * Projects a strict subset of a `FlatRegistry` or `FlatSkeletonEntry[]` according to a `ShareScope`.
 * Enforces Clean-Room & Zero-Trust Data Minimization Invariants (Crash-Early):
 *   1. Every node in the projection matches at least one prefix/filter in `scope.keys` (or `'*'`).
 *   2. `privilegeRoster` is NEVER included in a `ScopedProjection`.
 *   3. `pinVerifierHash`, `pinHash`, and `accessPin` are NEVER present anywhere in the serialized projection.
 *   4. `notes` / `observation` / `observacoes` are stripped from every node unless `scope.includeNotes === true`.
 */

import * as pathKey from '../skeleton/pathKey';
import type { FlatRegistry, FlatSkeletonEntry, PathKey } from '../skeleton/types';
import type { ParticipantProfile } from '../roster/participantDirectory';
import { resolveTerritoryNumber } from '../geo/geoUtils';

export type ShareAccessMode = 'read' | 'edit';
export type ShareScopeKind = 'territories' | 'weeks' | 'group' | 'custom' | 'full';

export interface ShareScope {
  /** Scope category or engine ('territory' | 'schedule' | 'full' | 'territories' | 'weeks' | 'group' | 'custom') */
  engine?: 'territory' | 'schedule' | 'full';
  kind?: ShareScopeKind;
  /** PathKey prefixes, territory numbers, week ISO dates, or group names to include */
  keys: PathKey[];
  /** Access mode ('read' | 'edit') */
  mode?: ShareAccessMode;
  /** Default: false. When false, strips `notes`, `observation`, and `observacoes` from every node. */
  includeNotes?: boolean;
  /** Optional human-readable title for the shared scope (e.g. "Território 04 — Centro"). */
  title?: string;
  eventName?: string;
  eventId?: string;
}

export interface ScopeSourceState {
  eventId?: string;
  title?: string;
  skeleton: FlatSkeletonEntry[] | FlatRegistry;
  privilegeRoster?: ParticipantProfile[];
}

export type ScopedProjectionNode = FlatSkeletonEntry & {
  attributes?: Record<string, string | undefined>;
};

export interface ScopedProjection {
  version: 3;
  eventId?: string;
  title?: string;
  scope: ShareScope;
  nodes: ScopedProjectionNode[];
  createdAtIso: string;
  createdAt: string;
  expiresAtEpochSec: number;
  expiresAt: string;
  /** Present when the capability link is created in `edit` mode (Ed25519 public key Base64URL). */
  verifyPub?: string;
}

const SENSITIVE_META_KEYS_ALWAYS_STRIPPED = new Set([
  'pinVerifierHash',
  'pinHash',
  'accessPin',
  'privilegeRoster',
  'capabilities',
  'hasAdminSeal',
]);

const NOTES_META_KEYS = new Set([
  'notes',
  'observation',
  'observacoes',
  'observacao',
  'privateNotes',
  'internalNotes',
]);

function normalizeEntriesInput(
  input: FlatSkeletonEntry[] | FlatRegistry | ScopeSourceState
): { entries: FlatSkeletonEntry[]; eventId?: string; title?: string } {
  if (Array.isArray(input)) {
    return { entries: input };
  }
  if (input && typeof input === 'object' && 'skeleton' in input) {
    const src = input as ScopeSourceState;
    const raw = src.skeleton;
    const entries: FlatSkeletonEntry[] = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object'
      ? (Object.values(raw) as FlatSkeletonEntry[])
      : [];
    return { entries, eventId: src.eventId, title: src.title };
  }
  if (input && typeof input === 'object') {
    return { entries: Object.values(input as FlatRegistry) as FlatSkeletonEntry[] };
  }
  return { entries: [] };
}

function getMergedNodeMeta(entry: FlatSkeletonEntry & { attributes?: Record<string, any> }): Record<string, any> {
  return {
    ...(entry.attributes || {}),
    ...(entry.meta || {}),
  };
}

const NUMERIC_PATH_KEY_RE = /^\d+(-\d+)*$/;

function matchesKeyPrefix(nodeKey: string, prefix: string): boolean {
  const cleanPrefix = (prefix || '').trim();
  if (!cleanPrefix) return false;
  if (cleanPrefix === '*') return true;
  if (
    nodeKey === cleanPrefix ||
    nodeKey.startsWith(`${cleanPrefix}-`) ||
    nodeKey.startsWith(`${cleanPrefix}.`)
  ) {
    return true;
  }
  if (NUMERIC_PATH_KEY_RE.test(nodeKey) && NUMERIC_PATH_KEY_RE.test(cleanPrefix)) {
    try {
      if (pathKey.equals(nodeKey, cleanPrefix) || pathKey.isDescendant(cleanPrefix, nodeKey)) {
        return true;
      }
    } catch {
      // Fallback to string prefix match above
    }
  }
  return false;
}

function matchesScopeEntry(
  entry: FlatSkeletonEntry & { attributes?: Record<string, any> },
  scope: ShareScope,
  cleanPrefixes: string[]
): boolean {
  if (cleanPrefixes.length === 0) return false;
  const meta = getMergedNodeMeta(entry);
  const kind = scope.kind;

  if (kind === 'weeks') {
    const dateVal = String(meta.date || meta.week || '').trim();
    return cleanPrefixes.some(
      (w) =>
        dateVal === w ||
        matchesKeyPrefix(entry.key, w) ||
        matchesKeyPrefix(entry.key, `Semana_${w}`)
    );
  }

  if (kind === 'group') {
    const groupVal = String(meta.group || meta.groupTag || '').trim().toLowerCase();
    return cleanPrefixes.some(
      (g) => groupVal === g.trim().toLowerCase() || matchesKeyPrefix(entry.key, g)
    );
  }

  if (scope.engine && scope.engine !== 'full') {
    const engineId = String(meta.engine_id || meta.engineId || '').trim();
    if (scope.engine === 'territory' && engineId === 'roster_assignments') {
      return false;
    }
    if (
      scope.engine === 'schedule' &&
      (engineId === 'territory_logistics' || engineId === 'canvassing_logistics' || entry.type === 'territory')
    ) {
      return false;
    }
  }

  return cleanPrefixes.some((prefix) => matchesKeyPrefix(entry.key, prefix));
}

function sanitizeNodeForProjection(
  entry: FlatSkeletonEntry & { attributes?: Record<string, any> },
  includeNotes: boolean
): ScopedProjectionNode {
  const rawMeta = (entry.meta || {}) as Record<string, any>;
  const rawAttrs = (entry.attributes || {}) as Record<string, any>;
  const cleanMeta: Record<string, any> = {};
  const cleanAttrs: Record<string, string | undefined> = {};

  for (const [k, v] of Object.entries(rawMeta)) {
    if (SENSITIVE_META_KEYS_ALWAYS_STRIPPED.has(k)) continue;
    if (!includeNotes && NOTES_META_KEYS.has(k)) continue;
    cleanMeta[k] = v;
  }

  for (const [k, v] of Object.entries(rawAttrs)) {
    if (SENSITIVE_META_KEYS_ALWAYS_STRIPPED.has(k)) continue;
    if (!includeNotes && NOTES_META_KEYS.has(k)) continue;
    cleanAttrs[k] = v !== undefined && v !== null ? String(v) : undefined;
    if (cleanMeta[k] === undefined) {
      cleanMeta[k] = v;
    }
  }

  const result: ScopedProjectionNode = {
    key: entry.key,
    type: entry.type,
    label: entry.label,
    value: entry.value,
    email: '',
    meta: cleanMeta,
  };

  if (entry.attributes !== undefined) {
    result.attributes = cleanAttrs;
  }

  return result;
}

/**
 * Helper to resolve root `PathKey` prefixes for a list of territory numbers (e.g. `['01', '02', '05']`).
 */
export function resolveTerritoryKeysForNumbers(
  registry: FlatSkeletonEntry[] | FlatRegistry,
  territoryNumbers: string[]
): PathKey[] {
  const { entries } = normalizeEntriesInput(registry);
  const normalizedTargets = new Set(
    territoryNumbers
      .map((n) => String(n || '').trim())
      .filter(Boolean)
      .map((n) => (/^\d+$/.test(n) && n.length === 1 ? `0${n}` : n))
  );

  if (normalizedTargets.size === 0) return [];

  const matchedRootKeys = new Set<string>();
  for (const entry of entries as Array<FlatSkeletonEntry & { attributes?: Record<string, any> }>) {
    const meta = getMergedNodeMeta(entry);
    const explicitNum = String(
      meta.number || meta.territory_number || meta.territoryNumber || ''
    ).trim();
    const rawNum = explicitNum || resolveTerritoryNumber(entry);
    const normTNum = /^\d+$/.test(rawNum) && rawNum.length === 1 ? `0${rawNum}` : rawNum;

    if (normalizedTargets.has(normTNum) || normalizedTargets.has(rawNum)) {
      const keyStr = String(entry.key || '');
      if (keyStr.includes('.')) {
        matchedRootKeys.add(keyStr.split('.')[0]);
      } else {
        const parts = keyStr.split('-');
        if (parts[0] === '90' && parts.length >= 2) {
          matchedRootKeys.add(`${parts[0]}-${parts[1]}`);
        } else if (parts[0]) {
          matchedRootKeys.add(parts[0]);
        }
      }
    }
  }

  return Array.from(matchedRootKeys);
}

/**
 * Projects a `FlatRegistry`, `FlatSkeletonEntry[]`, or `ScopeSourceState` to the exact subset defined by `scope`.
 * Verifies post-condition invariants before returning (Crash-Early).
 */
export function projectScope(
  registryOrSource: FlatSkeletonEntry[] | FlatRegistry | ScopeSourceState,
  scope: ShareScope,
  options?: { ttlSeconds?: number; nowMs?: number; verifyPub?: string }
): ScopedProjection {
  if (!scope || !Array.isArray(scope.keys)) {
    throw new Error('ScopeProjectionInvariantError: scope.keys must be an array of PathKey prefixes.');
  }

  const { entries, eventId, title } = normalizeEntriesInput(registryOrSource);
  const cleanPrefixes = scope.keys.map((k) => String(k || '').trim()).filter(Boolean);
  const includeNotes = Boolean(scope.includeNotes);

  const projectedNodes: ScopedProjectionNode[] = [];

  if (cleanPrefixes.length > 0) {
    for (const entry of entries as Array<FlatSkeletonEntry & { attributes?: Record<string, any> }>) {
      if (!entry || typeof entry.key !== 'string') continue;
      if (!matchesScopeEntry(entry, scope, cleanPrefixes)) continue;
      projectedNodes.push(sanitizeNodeForProjection(entry, includeNotes));
    }
  }

  const nowMs = options?.nowMs ?? Date.now();
  const ttlSeconds = options?.ttlSeconds ?? 7 * 24 * 3600; // Default: 7 days
  const createdAtIso = new Date(nowMs).toISOString();
  const expiresAtEpochSec = Math.floor(nowMs / 1000) + ttlSeconds;
  const expiresAtIso = new Date(expiresAtEpochSec * 1000).toISOString();

  const projection: ScopedProjection = {
    version: 3,
    eventId: scope.eventId || eventId || 'default',
    title: scope.title || title || 'Compartilhamento Sekundo',
    scope: {
      ...scope,
      keys: cleanPrefixes,
      includeNotes,
    },
    nodes: projectedNodes,
    createdAtIso,
    createdAt: createdAtIso,
    expiresAtEpochSec,
    expiresAt: expiresAtIso,
    ...(options?.verifyPub ? { verifyPub: options.verifyPub } : {}),
  };

  // Crash-Early Post-Condition Invariant Verification
  assertScopedProjectionInvariants(projection, scope, entries.length);

  return projection;
}

/**
 * Crash-Early runtime assertion verifying all data-minimization invariants on a `ScopedProjection`.
 */
export function assertScopedProjectionInvariants(
  projection: ScopedProjection,
  _requestedScope?: ShareScope,
  _sourceTotalCount?: number
): void {
  if (!projection || !Array.isArray(projection.nodes)) {
    throw new Error('ScopeProjectionInvariantError: projection.nodes must be an array.');
  }
  if ('privilegeRoster' in (projection as unknown as Record<string, unknown>)) {
    throw new Error('ScopeProjectionInvariantError: privilegeRoster must never be present in ScopedProjection.');
  }

  const serialized = JSON.stringify(projection);
  if (serialized.includes('pinVerifierHash') || serialized.includes('pvh_')) {
    throw new Error('ScopeProjectionInvariantError: pinVerifierHash leaked into ScopedProjection.');
  }

  const scope = projection.scope;
  const prefixes = scope.keys;
  for (const node of projection.nodes) {
    if (!matchesScopeEntry(node, scope, prefixes)) {
      throw new Error(
        `ScopeProjectionInvariantError: node key "${node.key}" is outside requested scope keys [${prefixes.join(', ')}].`
      );
    }
    if (!scope.includeNotes) {
      const meta = (node.meta || {}) as Record<string, unknown>;
      const attrs = (node.attributes || {}) as Record<string, unknown>;
      if (
        meta.notes !== undefined ||
        meta.observacoes !== undefined ||
        meta.observation !== undefined ||
        attrs.notes !== undefined ||
        attrs.observacoes !== undefined ||
        attrs.observation !== undefined
      ) {
        throw new Error(
          `ScopeProjectionInvariantError: private notes leaked on node "${node.key}" when includeNotes=false.`
        );
      }
    }
  }
}
