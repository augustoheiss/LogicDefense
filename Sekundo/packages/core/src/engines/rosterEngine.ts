/**
 * Sekundo — Roster & Assignment Engine
 *
 * Implements the Universal Law for Event Roles and Roster Assignments:
 * - Hierarchy: Event -> Session/Program -> Role/Slot -> Assistant
 * - Slot assignment tracking, attendance confirmation, substitutes
 * - Roster fulfillment metric calculation
 */

import type { SkeletonNode, NodeType } from '../skeleton/types';
import type { EventEngine, RosterMetrics, EngineMetrics, RosterNodeMeta } from './types';

/**
 * Traverses a skeleton node tree and calculates assignment metrics.
 */
export function calculateRosterMetrics(nodes: SkeletonNode[]): RosterMetrics {
  let totalSlots = 0;
  let assignedSlots = 0;
  let confirmedSlots = 0;

  function visit(node: SkeletonNode) {
    if (node.type === 'slot') {
      totalSlots++;
      const hasValue = Boolean(node.value && node.value.trim() !== '');
      const meta = (node.meta || {}) as RosterNodeMeta;
      const isAssigned = hasValue || Boolean(meta.assignedTo);

      if (isAssigned) {
        assignedSlots++;
        if (meta.confirmed === true) {
          confirmedSlots++;
        }
      }
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  for (const root of nodes) {
    visit(root);
  }

  const unassignedSlots = totalSlots - assignedSlots;
  const fulfillmentPercent =
    totalSlots > 0 ? Math.round((assignedSlots / totalSlots) * 1000) / 10 : 0;

  return {
    totalSlots,
    assignedSlots,
    confirmedSlots,
    unassignedSlots,
    fulfillmentPercent,
  };
}

/**
 * The Roster Assignments Engine Definition
 */
export const rosterEngine: EventEngine = {
  id: 'roster_assignments',
  name: 'Designações & Quadro de Responsáveis',
  description:
    'Gerencia eventos, programas, funções, oradores, presidentes, leitores e equipes técnicas. Acompanha confirmações de presença, horários e substitutos com geração de cartões de designação.',
  icon: 'users',
  allowedNodeTypes: ['header', 'slot', 'note'],
  defaultNodeTypeForDepth(depth: number): NodeType {
    if (depth <= 2) return 'header';
    return 'slot';
  },
  validateNode(node: SkeletonNode) {
    const errors: string[] = [];
    const meta = (node.meta || {}) as RosterNodeMeta;

    if (meta.durationMinutes !== undefined && meta.durationMinutes <= 0) {
      errors.push(`Duração do slot ${node.key} deve ser maior que zero minutos.`);
    }

    return { valid: errors.length === 0, errors };
  },
  calculateMetrics(tree: SkeletonNode[]): EngineMetrics {
    return {
      engineId: 'roster_assignments',
      data: calculateRosterMetrics(tree),
    };
  },
  supportedExports: ['csv', 'xlsx', 'pdf', 'yaml'],
};
