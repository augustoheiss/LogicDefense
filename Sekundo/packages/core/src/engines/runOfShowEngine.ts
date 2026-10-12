/**
 * Sekundo — Live Production Run-of-Show Engine
 *
 * Implements real-time cue-to-cue execution and timing propagation:
 * - Second-accurate planned vs. actual duration tracking
 * - Cumulative time drift variance: Delta = Sum(Actual - Planned)
 * - HARD_START / HARD_OUT immovable anchor protection
 * - Dynamic cut-list suggestions to absorb delays
 */

import type { EventEngine, RunOfShowMetrics, RunOfShowNodeMeta } from './types';
import type { SkeletonNode, NodeType } from '../skeleton/types';

export const runOfShowEngine: EventEngine = {
  id: 'live_production_ros',
  name: 'Produção ao Vivo (Run-of-Show & Régie)',
  description:
    'Roteiro operacional de precisão ao segundo para espetáculos, convenções e transmissões, com cálculo de desvio cumulativo e âncoras HARD_OUT.',
  icon: 'timer-outline',
  allowedNodeTypes: ['header', 'slot', 'territory', 'note'],

  defaultNodeTypeForDepth: (depth: number): NodeType => {
    if (depth <= 2) return 'header'; // Show / Act
    return 'slot';                   // Cue / Segment
  },

  validateNode: (node: SkeletonNode) => {
    const errors: string[] = [];
    const meta = (node.meta || {}) as unknown as Partial<RunOfShowNodeMeta>;

    if (node.type === 'slot' && (meta.plannedDurationSec === undefined || meta.plannedDurationSec < 0)) {
      errors.push(`Nó ${node.key}: Segmento deve possuir plannedDurationSec em segundos.`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  calculateMetrics: (tree: SkeletonNode[]) => {
    let totalPlannedSeconds = 0;
    let totalActualSeconds = 0;
    let cumulativeDriftSec = 0;
    let hardOutThreatened = false;
    const cutListSuggestedKeys: string[] = [];

    function traverse(node: SkeletonNode) {
      const isLeaf = (node.children || []).length === 0;

      if (isLeaf && node.type === 'slot') {
        const meta = (node.meta || {}) as unknown as Partial<RunOfShowNodeMeta>;
        const planned = meta.plannedDurationSec ?? 0;
        totalPlannedSeconds += planned;

        if (meta.actualDurationSec !== undefined) {
          totalActualSeconds += meta.actualDurationSec;
          cumulativeDriftSec += meta.actualDurationSec - planned;
        } else {
          totalActualSeconds += planned;
        }

        // Check for hard stops
        if (meta.timingConstraint === 'HARD_OUT') {
          if (cumulativeDriftSec > 0) {
            hardOutThreatened = true;
          }
        }

        // Candidate for cut list if show is running late
        if (meta.isPadBuffer && cumulativeDriftSec > 0) {
          cutListSuggestedKeys.push(node.key);
        }
      }

      for (const child of node.children || []) {
        traverse(child);
      }
    }

    for (const root of tree) {
      traverse(root);
    }

    const data: RunOfShowMetrics = {
      totalPlannedSeconds,
      totalActualSeconds,
      cumulativeDriftSec,
      hardOutThreatened,
      cutListSuggestedKeys,
    };

    return {
      engineId: 'live_production_ros',
      data,
    };
  },

  supportedExports: ['csv', 'pdf', 'yaml'],
};
