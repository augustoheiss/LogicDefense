/**
 * Sekundo — Generic Work Breakdown Structure (WBS) Engine
 *
 * Implements the baseline agnostic hierarchy:
 * - Freeform nesting with no rigid domain rules
 * - Supports arbitrary meta properties
 */

import type { SkeletonNode, NodeType } from '../skeleton/types';
import type { EventEngine, EngineMetrics } from './types';

export const genericWbsEngine: EventEngine = {
  id: 'generic_wbs',
  name: 'Estrutura Livre (Agnóstica Universal)',
  description:
    'Motor livre e aberto para qualquer tipo de evento, hierarquia ou organização de tarefas sem regras estritas de domínio.',
  icon: 'folder-tree',
  allowedNodeTypes: ['header', 'slot', 'territory', 'note'],
  defaultNodeTypeForDepth(depth: number): NodeType {
    if (depth === 1) return 'header';
    return 'slot';
  },
  validateNode() {
    return { valid: true, errors: [] };
  },
  calculateMetrics(tree: SkeletonNode[]): EngineMetrics {
    let totalNodes = 0;
    let leafCount = 0;

    function count(node: SkeletonNode) {
      totalNodes++;
      if (node.children.length === 0) {
        leafCount++;
      }
      for (const child of node.children) {
        count(child);
      }
    }

    for (const root of tree) {
      count(root);
    }

    return {
      engineId: 'generic_wbs',
      data: { totalNodes, leafCount },
    };
  },
  supportedExports: ['csv', 'xlsx', 'yaml', 'pdf'],
};
