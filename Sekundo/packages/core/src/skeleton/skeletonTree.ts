/**
 * Sekundo — Skeleton Tree Builder
 *
 * Transforms a flat registry of skeleton entries into a hierarchical tree.
 * The tree is computed at runtime from path key relationships — it is never
 * stored directly.
 */

import type {
  FlatRegistry,
  FlatSkeletonEntry,
  PathKey,
  SkeletonNode,
} from './types';
import * as pathKey from './pathKey';

// ---------------------------------------------------------------------------
// Build Tree
// ---------------------------------------------------------------------------

/**
 * Build a hierarchical tree from a flat registry of skeleton entries.
 *
 * The algorithm:
 * 1. Sort all entries by path key (integer comparison).
 * 2. Convert each entry to a SkeletonNode (with empty children array).
 * 3. For each node, find its parent in the lookup map and attach as child.
 * 4. Return only root nodes (those with no parent in the registry).
 *
 * @param entries - Flat array of skeleton entries.
 * @returns Array of root-level SkeletonNode trees.
 */
export function buildTree(entries: FlatRegistry): SkeletonNode[] {
  if (entries.length === 0) return [];

  // Sort by path key for deterministic traversal
  const sorted = [...entries].sort((a, b) => pathKey.compare(a.key, b.key));

  // Normalize all keys and create node lookup
  const nodeMap = new Map<string, SkeletonNode>();
  const roots: SkeletonNode[] = [];

  for (const entry of sorted) {
    const normalizedKey = pathKey.normalize(entry.key);
    const node: SkeletonNode = {
      key: normalizedKey,
      type: entry.type,
      label: entry.label,
      value: entry.value,
      email: entry.email,
      meta: entry.meta,
      children: [],
    };
    nodeMap.set(normalizedKey, node);
  }

  // Build parent-child relationships
  for (const [normalizedKey, node] of nodeMap) {
    const parentKey = pathKey.parent(normalizedKey);

    if (parentKey !== null && nodeMap.has(parentKey)) {
      nodeMap.get(parentKey)!.children.push(node);
    } else {
      // No parent in the registry → this is a root node
      roots.push(node);
    }
  }

  return roots;
}

// ---------------------------------------------------------------------------
// Flatten Tree
// ---------------------------------------------------------------------------

/**
 * Flatten a hierarchical tree back to a flat registry.
 * Performs a depth-first traversal.
 *
 * @param roots - Array of root-level SkeletonNode trees.
 * @returns Flat array of skeleton entries in tree order.
 */
export function flattenTree(roots: SkeletonNode[]): FlatRegistry {
  const result: FlatSkeletonEntry[] = [];

  function walk(node: SkeletonNode): void {
    result.push({
      key: node.key,
      type: node.type,
      label: node.label,
      value: node.value,
      email: node.email,
      meta: node.meta,
    });

    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of roots) {
    walk(root);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

/**
 * Find a node by its path key in the tree.
 *
 * @param roots - Root-level tree nodes.
 * @param key - The path key to search for.
 * @returns The matching node, or null if not found.
 */
export function findNode(
  roots: SkeletonNode[],
  key: PathKey
): SkeletonNode | null {
  const normalizedTarget = pathKey.normalize(key);

  function search(nodes: SkeletonNode[]): SkeletonNode | null {
    for (const node of nodes) {
      if (node.key === normalizedTarget) {
        return node;
      }
      const found = search(node.children);
      if (found) return found;
    }
    return null;
  }

  return search(roots);
}

/**
 * Get all leaf nodes (nodes with no children) in the tree.
 * Leaves represent the actual assignable slots.
 *
 * @param roots - Root-level tree nodes.
 * @returns Array of leaf SkeletonNodes.
 */
export function getLeaves(roots: SkeletonNode[]): SkeletonNode[] {
  const leaves: SkeletonNode[] = [];

  function walk(node: SkeletonNode): void {
    if (node.children.length === 0) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const root of roots) {
    walk(root);
  }

  return leaves;
}

/**
 * Get the total count of nodes at each depth level.
 * Useful for rendering statistics.
 *
 * @param roots - Root-level tree nodes.
 * @returns Map of depth (1-indexed) → count.
 */
export function depthCounts(roots: SkeletonNode[]): Map<number, number> {
  const counts = new Map<number, number>();

  function walk(node: SkeletonNode): void {
    const d = pathKey.depth(node.key);
    counts.set(d, (counts.get(d) ?? 0) + 1);

    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of roots) {
    walk(root);
  }

  return counts;
}

/**
 * Collect all unassigned slots (nodes where value is empty).
 *
 * @param roots - Root-level tree nodes.
 * @returns Array of unassigned SkeletonNodes.
 */
export function getUnassigned(roots: SkeletonNode[]): SkeletonNode[] {
  const unassigned: SkeletonNode[] = [];

  function walk(node: SkeletonNode): void {
    if (
      (node.type === 'slot' || node.type === 'territory') &&
      (!node.value || node.value.trim() === '')
    ) {
      unassigned.push(node);
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of roots) {
    walk(root);
  }

  return unassigned;
}
