/**
 * Sekundo — Registry Batch Operations
 *
 * Pure helpers that make registry writes safe:
 * - `applyNodeUpdates`: apply N node patches in ONE pass (no lost updates in bulk actions)
 * - `buildWorkedMeta`: single rule for marking/unmarking a unit as worked
 * - `createSerialQueue`: serialize async persistence so concurrent writes never interleave
 */

import type { FlatRegistry, FlatSkeletonEntry, PathKey } from './types';
import { normalize } from './pathKey';

export interface NodePatch {
  key: PathKey;
  updates: Partial<Omit<FlatSkeletonEntry, 'key'>>;
}

/** Applies every patch against the same base registry and returns a new registry. */
export function applyNodeUpdates(registry: FlatRegistry, patches: NodePatch[]): FlatRegistry {
  if (patches.length === 0) return registry;
  const byKey = new Map<string, NodePatch['updates']>();
  for (const p of patches) {
    const k = normalize(p.key);
    byKey.set(k, { ...(byKey.get(k) || {}), ...p.updates });
  }
  return registry.map((node) => {
    const u = byKey.get(normalize(node.key));
    return u ? { ...node, ...u } : node;
  });
}

/**
 * Returns the next meta for a worked/unworked transition.
 * Marking keeps an existing completion date; unmarking clears every completion alias.
 */
export function buildWorkedMeta(
  meta: Record<string, unknown> | undefined,
  worked: 0 | 1,
  now: Date = new Date()
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(meta || {}), worked };
  const today = now.toISOString().slice(0, 10);
  if (worked === 1) {
    next.lastWorkedAt = now.toISOString();
    delete next.lastUnmarkedAt;
    if (!next.completedAt) next.completedAt = today;
    if (!next.completed_date) next.completed_date = today;
    if (!next.data_conclusao) next.data_conclusao = today;
  } else {
    delete next.lastWorkedAt;
    delete next.completedAt;
    delete next.completed_date;
    delete next.data_conclusao;
    next.lastUnmarkedAt = now.toISOString();
  }
  return next;
}

/** Runs async tasks strictly one after another, in submission order. */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}
