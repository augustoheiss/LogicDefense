/**
 * Hook: useSkeleton
 *
 * Coordinates the flat skeleton registry and computed tree layout.
 * Provides functions to add, update, delete nodes (hierarchically),
 * and commit CSV imports.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FlatRegistry, NodeType, PathKey, SkeletonNode, FlatSkeletonEntry, UpsertOptions, UpsertResult, NodePatch } from '@sekundo/core';
import { skeletonTree, pathKey, upsertRegistry, applyNodeUpdates, createSerialQueue } from '@sekundo/core';
import * as storage from '../storage/localStorage';
import { recordPatchesInLedger } from '../storage/ledgerStore';

export function useSkeleton(eventId: string) {
  const [flatRegistry, setFlatRegistry] = useState<FlatRegistry>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Always-current registry: every write starts from here, never from a stale render closure.
  const registryRef = useRef<FlatRegistry>([]);
  const enqueueRef = useRef(createSerialQueue());

  const loadSkeleton = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await storage.loadSkeleton(eventId);
      registryRef.current = data || [];
      setFlatRegistry(registryRef.current);
    } catch (e) {
      console.error('[Sekundo] Failed to load skeleton:', e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const commit = useCallback(
    (transform: (prev: FlatRegistry) => FlatRegistry) => {
      // Keep registry sorted hierarchically
      const sorted = [...transform(registryRef.current)].sort((a, b) => pathKey.compare(a.key, b.key));
      registryRef.current = sorted;
      setFlatRegistry(sorted);
      return enqueueRef.current(() => storage.saveSkeleton(eventId, sorted));
    },
    [eventId]
  );

  const saveSkeleton = async (newRegistry: FlatRegistry) => {
    await commit(() => newRegistry);
  };

  const tree = useMemo(() => {
    return skeletonTree.buildTree(flatRegistry);
  }, [flatRegistry]);

  const addNode = async (
    key: PathKey,
    type: NodeType,
    label: string,
    value: string = '',
    email: string = '',
    meta: Record<string, unknown> = {}
  ) => {
    const normalizedKey = pathKey.normalize(key);
    const existing = registryRef.current.find((node) => pathKey.equals(node.key, normalizedKey));
    if (existing) {
      throw new Error(`Node with path key "${normalizedKey}" already exists.`);
    }

    await commit((prev) => [...prev, { key: normalizedKey, type, label, value, email, meta }]);
  };

  /** Applies many node patches in a single write (use for any bulk action). */
  const updateNodes = async (patches: NodePatch[]) => {
    const prevSnapshot = registryRef.current;
    await commit((prev) => applyNodeUpdates(prev, patches));
    await recordPatchesInLedger(eventId, prevSnapshot, patches).catch(() => undefined);
  };

  const updateNode = async (key: PathKey, updates: Partial<Omit<FlatSkeletonEntry, 'key'>>) => {
    await updateNodes([{ key, updates }]);
  };

  /**
   * Updates an existing node or creates it if it does not yet exist in flatRegistry
   * (e.g., when customizing an auto-grouped Quadra or Territory header).
   */
  const upsertNode = async (
    key: PathKey,
    defaultType: NodeType,
    defaultLabel: string,
    updates: Partial<Omit<FlatSkeletonEntry, 'key'>>
  ) => {
    const normalizedKey = pathKey.normalize(key);
    const prevSnapshot = registryRef.current;
    const existing = prevSnapshot.find((node) => pathKey.equals(node.key, normalizedKey));
    if (existing) {
      await updateNodes([
        {
          key: existing.key,
          updates: {
            ...updates,
            meta: updates.meta ? { ...(existing.meta || {}), ...updates.meta } : existing.meta,
          },
        },
      ]);
    } else {
      const created: FlatSkeletonEntry = {
        key: normalizedKey,
        type: updates.type || defaultType,
        label: updates.label || defaultLabel,
        value: updates.value ?? '',
        email: updates.email ?? '',
        meta: { ...(updates.meta || {}) },
      };
      await commit((prev) => [...prev, created]);
      await recordPatchesInLedger(eventId, prevSnapshot, [{ key: normalizedKey, updates }]).catch(
        () => undefined
      );
    }
  };

  const deleteNode = async (key: PathKey) => {
    const normalizedKey = pathKey.normalize(key);
    // Delete the node and all its descendants!
    await commit((prev) =>
      prev.filter(
        (node) => !pathKey.equals(node.key, normalizedKey) && !pathKey.isDescendant(node.key, normalizedKey)
      )
    );
  };

  const commitCSVImport = async (
    csvRows: any[],
    options?: UpsertOptions
  ): Promise<UpsertResult> => {
    const result = upsertRegistry(registryRef.current, csvRows, options);
    await commit(() => result.updatedRegistry);
    return result;
  };

  useEffect(() => {
    loadSkeleton();
  }, [loadSkeleton]);

  return {
    flatRegistry,
    tree,
    loading,
    addNode,
    updateNode,
    updateNodes,
    upsertNode,
    deleteNode,
    commitCSVImport,
    saveSkeleton,
    reload: loadSkeleton,
  };
}

