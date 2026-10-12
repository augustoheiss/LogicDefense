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
