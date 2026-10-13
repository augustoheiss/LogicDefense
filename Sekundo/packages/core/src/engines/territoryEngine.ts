/**
 * Sekundo — Territory & Logistics Engine
 *
 * Implements the Universal Law for Territory Management:
 * - Hierarchy: Region -> Territory -> Quadra/Block -> Street -> Unit/Address
 * - Bottom-up 0/1 Rollup Calculation (Coverage %)
 * - Top-down Bulk Toggle (e.g. mark entire quadra/street as 1 or 0)
 * - Geolocation and Boundary Support
 */

import type { SkeletonNode, NodeType } from '../skeleton/types';
import type { EventEngine, TerritoryMetrics, EngineMetrics, TerritoryNodeMeta } from './types';

/**
 * Checks if a node is a leaf work unit (e.g., individual house, building number, or endpoint).
 */
export function isWorkUnit(node: SkeletonNode): boolean {
  return node.children.length === 0 && (node.type === 'slot' || node.type === 'territory');
}

/**
 * Traverses a skeleton node tree and calculates territorial metrics.
 */
export function calculateTerritoryMetrics(nodes: SkeletonNode[]): TerritoryMetrics {
  let totalUnits = 0;
  let workedUnits = 0;
  let quadrasCount = 0;
  let streetsCount = 0;

  function visit(node: SkeletonNode, depth: number) {
    if (depth === 3) quadrasCount++;
    if (depth === 4) streetsCount++;

    if (isWorkUnit(node)) {
      totalUnits++;
      const meta = (node.meta || {}) as TerritoryNodeMeta;
      if (meta.worked === 1) {
        workedUnits++;
      }
    }

    for (const child of node.children) {
      visit(child, depth + 1);
    }
  }

  for (const root of nodes) {
    visit(root, 1);
  }

  const coveragePercent =
    totalUnits > 0 ? Math.round((workedUnits / totalUnits) * 1000) / 10 : 0;

  return {
    totalUnits,
    workedUnits,
    coveragePercent,
    isFullyWorked: totalUnits > 0 && workedUnits === totalUnits,
    quadrasCount,
    streetsCount,
  };
}

/**
 * Sets the 'worked' status (0 or 1) on a target node and all its descendants recursively.
 * Returns a new cloned tree with the updated values (immutable update).
 */
export function toggleNodeWorkStatusRecursively(
  nodes: SkeletonNode[],
  targetKey: string,
  newStatus: 0 | 1,
  workerName?: string,
  timestamp: string = new Date().toISOString()
): SkeletonNode[] {
  function updateSubtree(node: SkeletonNode): SkeletonNode {
    const existingMeta = (node.meta || {}) as TerritoryNodeMeta;
    const updatedMeta: TerritoryNodeMeta = {
      ...existingMeta,
      worked: newStatus,
      lastWorkedAt: timestamp,
      workerName: workerName ?? existingMeta.workerName,
    };

    return {
      ...node,
      value: newStatus === 1 ? (workerName || 'Trabalhado') : '',
      meta: updatedMeta as Record<string, unknown>,
      children: node.children.map(updateSubtree),
    };
  }

  function traverseAndApply(node: SkeletonNode): SkeletonNode {
    if (node.key === targetKey) {
      return updateSubtree(node);
    }

    return {
      ...node,
      children: node.children.map(traverseAndApply),
    };
  }

  return nodes.map(traverseAndApply);
}

/**
 * Computes coverage percent for a specific sub-node (e.g. for a specific Quadra or Street).
 */
export function getSubtreeCoverage(node: SkeletonNode): {
  totalUnits: number;
  workedUnits: number;
  percent: number;
} {
  let total = 0;
  let worked = 0;

  function count(n: SkeletonNode) {
    if (isWorkUnit(n)) {
      total++;
      const meta = (n.meta || {}) as TerritoryNodeMeta;
      if (meta.worked === 1) worked++;
    }
    for (const c of n.children) {
      count(c);
    }
  }

  count(node);
  const percent = total > 0 ? Math.round((worked / total) * 1000) / 10 : 0;
  return { totalUnits: total, workedUnits: worked, percent };
}

/**
 * The Territory & Logistics Engine Definition
 */
export const territoryEngine: EventEngine = {
  id: 'territory_logistics',
  name: 'Logística de Territórios & Trabalho Presencial',
  description:
    'Gerencia regiões, territórios, quadras, ruas e endereços individuais. Oferece marcação tática 0/1 com rollup automático de cobertura, mapas interativos e proteção de dados de visitas.',
  icon: 'map',
  allowedNodeTypes: ['header', 'territory', 'slot', 'note'],
  defaultNodeTypeForDepth(depth: number): NodeType {
    if (depth <= 2) return 'header';
    if (depth === 3 || depth === 4) return 'territory';
    return 'slot';
  },
  validateNode(node: SkeletonNode) {
    const errors: string[] = [];
    const meta = (node.meta || {}) as TerritoryNodeMeta;

    if (meta.worked !== undefined && meta.worked !== 0 && meta.worked !== 1) {
      errors.push(`Status 'worked' no nó ${node.key} deve ser estritamente 0 ou 1.`);
    }

    if (meta.lat !== undefined && (meta.lat < -90 || meta.lat > 90)) {
      errors.push(`Latitude inválida no nó ${node.key}: ${meta.lat}`);
    }

    if (meta.lng !== undefined && (meta.lng < -180 || meta.lng > 180)) {
      errors.push(`Longitude inválida no nó ${node.key}: ${meta.lng}`);
    }

    return { valid: errors.length === 0, errors };
  },
  calculateMetrics(tree: SkeletonNode[]): EngineMetrics {
    return {
      engineId: 'territory_logistics',
      data: calculateTerritoryMetrics(tree),
    };
  },
  supportedExports: ['csv', 'xlsx', 'geojson', 'pdf', 'yaml'],
};

/**
 * Calculates calendar day difference between now and a reference date (YYYY-MM-DD or ISO).
 * Returns positive integer for past dates (e.g. 15 days ago -> 15), 0 for today, negative for future.
 */
export function calculateDaysDifference(targetDate?: string, now: Date = new Date()): number | null {
  if (!targetDate || typeof targetDate !== 'string' || !targetDate.trim()) return null;
  const clean = targetDate.trim();
  const d = new Date(clean.includes('T') ? clean : `${clean}T00:00:00`);
  if (isNaN(d.getTime())) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ref = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = today.getTime() - ref.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Computes territory recency statistics and ranking from flat registry or skeleton items.
 */
export function computeTerritoryRecencyList(
  entries: { key: string; label: string; type?: string; value?: string; meta?: Record<string, any> }[],
  sortMode: import('./types').TerritoryRecencySort = 'priority_oldest_first',
  now: Date = new Date()
): import('./types').TerritoryRecencyItem[] {
  const territoryMap = new Map<
    string,
    {
      label: string;
      locality?: string;
      totalUnits: number;
      workedUnits: number;
      assignedAt?: string;
      completedAt?: string;
      latestCompletedAt?: string;
      earliestAssignedAt?: string;
    }
  >();

  // Determine non-parent leaf items
  const allKeys = new Set(entries.map((e) => e.key));
  const parentKeys = new Set<string>();
  entries.forEach((e) => {
    const parts = e.key.split('-');
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        parentKeys.add(parts.slice(0, i).join('-'));
      }
    }
  });

  // 1. First pass: find territory group headers (depth 3 or meta.territory_number)
  entries.forEach((e) => {
    const meta = (e.meta || {}) as Record<string, any>;
    const tNum =
      meta.territory_number ||
      meta.territoryNumber ||
      (e.key.split('-').length === 3 ? e.label.split('—')[0].trim() : undefined);

    if (tNum && !territoryMap.has(tNum)) {
      territoryMap.set(tNum, {
        label: e.label || `Território ${tNum}`,
        locality: meta.locality,
        totalUnits: 0,
        workedUnits: 0,
        assignedAt: meta.assignedAt || meta.assigned_date || meta.data_designacao,
        completedAt: meta.completedAt || meta.completed_date || meta.data_conclusao,
      });
    }
  });

  // 2. Second pass: aggregate leaf addresses
  entries.forEach((e) => {
    if (parentKeys.has(e.key)) return; // skip intermediate containers
    const meta = (e.meta || {}) as Record<string, any>;

    // Infer territory number
    let tNum = meta.territory_number || meta.territoryNumber;
    if (!tNum) {
      const parts = e.key.split('-');
      if (parts.length >= 3) {
        const potentialKey = parts.slice(0, 3).join('-');
        const parentEntry = entries.find((x) => x.key === potentialKey);
        tNum = parentEntry?.meta?.territory_number || parentEntry?.meta?.territoryNumber || `T${potentialKey}`;
      } else {
        tNum = 'Geral';
      }
    }

    if (!territoryMap.has(tNum)) {
      territoryMap.set(tNum, {
        label: `Território ${tNum}`,
        locality: meta.locality,
        totalUnits: 0,
        workedUnits: 0,
      });
    }

    const t = territoryMap.get(tNum)!;
    t.totalUnits++;

    const isWorked = Number(meta.worked) === 1;
    if (isWorked) {
      t.workedUnits++;
    }

    const itemAssigned = meta.assignedAt || meta.assigned_date || meta.data_designacao;
    if (itemAssigned) {
      if (!t.earliestAssignedAt || itemAssigned < t.earliestAssignedAt) {
        t.earliestAssignedAt = itemAssigned;
      }
    }

    const itemCompleted = meta.completedAt || meta.completed_date || meta.data_conclusao || meta.lastWorkedAt;
    if (itemCompleted) {
      if (!t.latestCompletedAt || itemCompleted > t.latestCompletedAt) {
        t.latestCompletedAt = itemCompleted;
      }
    }
  });

  const list: import('./types').TerritoryRecencyItem[] = [];

  territoryMap.forEach((data, tNum) => {
    const isCompleted = data.totalUnits > 0 && data.workedUnits === data.totalUnits;
    const percent = data.totalUnits > 0 ? Math.round((data.workedUnits / data.totalUnits) * 100) : 0;
    const effectiveAssignedAt = data.assignedAt || data.earliestAssignedAt;
    const effectiveCompletedAt = data.completedAt || (isCompleted ? data.latestCompletedAt : undefined);

    const daysSinceCompleted =
      isCompleted && effectiveCompletedAt ? calculateDaysDifference(effectiveCompletedAt, now) : null;

    list.push({
      territoryNumber: tNum,
      label: data.label,
      locality: data.locality,
      totalUnits: data.totalUnits,
      workedUnits: data.workedUnits,
      percent,
      isCompleted,
      assignedAt: effectiveAssignedAt,
      completedAt: effectiveCompletedAt,
      daysSinceCompleted,
    });
  });

  // Sort based on sortMode
  list.sort((a, b) => {
    if (sortMode === 'hierarchical') {
      return a.territoryNumber.localeCompare(b.territoryNumber, undefined, { numeric: true });
    }

    if (sortMode === 'recent_first') {
      // Completed most recently comes first (lower daysSinceCompleted)
      if (a.isCompleted && !b.isCompleted) return -1;
      if (!a.isCompleted && b.isCompleted) return 1;
      if (a.isCompleted && b.isCompleted) {
        const dA = a.daysSinceCompleted ?? 999999;
        const dB = b.daysSinceCompleted ?? 999999;
        return dA - dB;
      }
      return b.percent - a.percent;
    }

    // Default: 'priority_oldest_first'
    // 1. Incomplete / unworked first (urgency: lower percent comes first)
    if (!a.isCompleted && b.isCompleted) return -1;
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && !b.isCompleted) {
      return a.percent - b.percent; // lowest coverage first
    }

    // 2. Both completed: completed longest ago comes first (higher daysSinceCompleted)
    const dA = a.daysSinceCompleted ?? 0;
    const dB = b.daysSinceCompleted ?? 0;
    return dB - dA;
  });

  return list;
}

