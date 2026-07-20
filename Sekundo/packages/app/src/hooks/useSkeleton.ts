/**
 * Hook: useSkeleton
 *
 * Coordinates the flat skeleton registry and computed tree layout.
 * Provides functions to add, update, delete nodes (hierarchically),
 * and commit CSV imports.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FlatRegistry, NodeType, PathKey, SkeletonNode, FlatSkeletonEntry } from '@sekundo/core';
import { skeletonTree, pathKey } from '@sekundo/core';
import * as storage from '../storage/localStorage';

export function useSkeleton(eventId: string) {
  const [flatRegistry, setFlatRegistry] = useState<FlatRegistry>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSkeleton = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const data = await storage.loadSkeleton(eventId);
      setFlatRegistry(data || []);
    } catch (e) {
      console.error('[Sekundo] Failed to load skeleton:', e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const saveSkeleton = async (newRegistry: FlatRegistry) => {
    // Keep registry sorted hierarchically
    const sorted = [...newRegistry].sort((a, b) => pathKey.compare(a.key, b.key));
    setFlatRegistry(sorted);
    await storage.saveSkeleton(eventId, sorted);
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
    const existing = flatRegistry.find((node) => pathKey.equals(node.key, normalizedKey));
    if (existing) {
      throw new Error(`Node with path key "${normalizedKey}" already exists.`);
    }

    const newRegistry = [
      ...flatRegistry,
      { key: normalizedKey, type, label, value, email, meta },
    ];
    await saveSkeleton(newRegistry);
  };

  const updateNode = async (key: PathKey, updates: Partial<Omit<FlatSkeletonEntry, 'key'>>) => {
    const normalizedKey = pathKey.normalize(key);
    const newRegistry = flatRegistry.map((node) => {
      if (pathKey.equals(node.key, normalizedKey)) {
        return { ...node, ...updates };
      }
      return node;
    });
    await saveSkeleton(newRegistry);
  };

  const deleteNode = async (key: PathKey) => {
    const normalizedKey = pathKey.normalize(key);
    // Delete the node and all its descendants!
    const newRegistry = flatRegistry.filter(
      (node) => !pathKey.equals(node.key, normalizedKey) && !pathKey.isDescendant(node.key, normalizedKey)
    );
    await saveSkeleton(newRegistry);
  };

  const commitCSVImport = async (csvRows: any[]) => {
    // Merges rows based on keys. Last import wins (completely overrides with sheet contents).
    const newRegistry: FlatRegistry = [];

    for (const row of csvRows) {
      if (!pathKey.isValid(row._key)) continue;
      const normalized = pathKey.normalize(row._key);
      let parsedMeta: Record<string, unknown> = {};
      if (row._meta_json) {
        try {
          parsedMeta = JSON.parse(row._meta_json);
        } catch {
          // ignore invalid JSON
        }
      }

      newRegistry.push({
        key: normalized,
        type: row._type as NodeType,
        label: row.label,
        value: row.value || '',
        email: row.email || '',
        meta: parsedMeta,
      });
    }

    await saveSkeleton(newRegistry);
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
    deleteNode,
    commitCSVImport,
    reload: loadSkeleton,
  };
}
