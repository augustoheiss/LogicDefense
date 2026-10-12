/**
 * Sekundo — Incident Command System (ICS/NIMS) Engine
 *
 * Implements the mathematical laws of emergency response hierarchy:
 * - FEMA NIMS role structures (Command Staff vs. General Staff)
 * - Graicunas Combinatorial Span of Control limit: R = n * (2^(n-1) + n - 1)
 * - Strict span-of-control threshold alerts (ideal: 5, acceptable: 3..7)
 */

import type { EventEngine, ICSMetrics, ICSNodeMeta } from './types';
import type { SkeletonNode, NodeType } from '../skeleton/types';
import { depth } from '../skeleton/pathKey';

/**
 * Calculates Graicunas total relationship complexity for n direct subordinates.
 * R = n * (2^(n - 1) + n - 1)
 */
export function calculateGraicunasComplexity(n: number): number {
  if (n <= 0) return 0;
  return n * (Math.pow(2, n - 1) + n - 1);
}

export const incidentCommandEngine: EventEngine = {
  id: 'incident_command',
  name: 'Comando de Incidentes (ICS / NIMS)',
  description:
    'Estrutura hierárquica modular baseada nos protocolos FEMA NIMS e no limite combinatório de Graicunas (3 a 7 subordinados por supervisor).',
  icon: 'shield-alert-outline',
  allowedNodeTypes: ['header', 'slot', 'territory', 'note'],

  defaultNodeTypeForDepth: (depth: number): NodeType => {
    if (depth <= 2) return 'header'; // Incident Command / General Staff Section
    return 'slot';                   // Unit / Strike Team / Task Force
  },

  validateNode: (node: SkeletonNode) => {
    const errors: string[] = [];
    const nodeDepth = depth(node.key);
    const meta = (node.meta || {}) as ICSNodeMeta;

    if (nodeDepth === 1 && !meta.icsRole) {
      meta.icsRole = 'INCIDENT_COMMANDER';
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  calculateMetrics: (tree: SkeletonNode[]) => {
    let totalUnits = 0;
    let totalPersonnel = 0;
    let spanOfControlBreaches = 0;
    let maxGraicunasRelationships = 0;

    function traverse(node: SkeletonNode) {
      totalUnits++;
      const meta = (node.meta || {}) as ICSNodeMeta;
      totalPersonnel += meta.allocatedPersonnel ?? 1;

      const n = (node.children || []).length;
      if (n > 0) {
        const complexity = calculateGraicunasComplexity(n);
        if (complexity > maxGraicunasRelationships) {
          maxGraicunasRelationships = complexity;
        }

        // Span of control breach: supervisor managing more than 7 subordinates
        if (n > 7) {
          spanOfControlBreaches++;
        }

        for (const child of node.children) {
          traverse(child);
        }
      }
    }

    for (const root of tree) {
      traverse(root);
    }

    const data: ICSMetrics = {
      totalUnits,
      totalPersonnel,
      spanOfControlBreaches,
      maxGraicunasRelationships,
      isSpanHealthy: spanOfControlBreaches === 0,
    };

    return {
      engineId: 'incident_command',
      data,
    };
  },

  supportedExports: ['csv', 'pdf', 'yaml'],
};
