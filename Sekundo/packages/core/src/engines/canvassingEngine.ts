/**
 * Sekundo — Advanced Canvassing Logistics Engine
 *
 * Implements granular field canvassing logistics:
 * - 8-code contact taxonomy: CNT, NH, REF, DNC, LAN, VAC, INA, HOS
 * - Door-to-door eLOT sequencing
 * - Contact rate and return visit analytics
 */

import type { EventEngine, CanvassingMetrics, CanvassingNodeMeta, CanvassContactCode } from './types';
import type { SkeletonNode, NodeType } from '../skeleton/types';

export const canvassingEngine: EventEngine = {
  id: 'canvassing_logistics',
  name: 'Logística de Campo Avançada (Canvassing & 8 Códigos)',
  description:
    'Rastreamento tático de visitas de campo com taxonomia padronizada de 8 estados de contato (CNT, NH, REF, DNC, LAN, VAC, INA, HOS) e sequenciamento de rota.',
  icon: 'map-marker-path',
  allowedNodeTypes: ['header', 'slot', 'territory', 'note'],

  defaultNodeTypeForDepth: (depth: number): NodeType => {
    if (depth <= 2) return 'header';    // Sector / Territory
    if (depth === 3) return 'territory'; // Quadra / Street
    return 'slot';                      // House / Door
  },

  validateNode: (node: SkeletonNode) => {
    const errors: string[] = [];
    const meta = (node.meta || {}) as CanvassingNodeMeta;

    const validCodes: CanvassContactCode[] = ['CNT', 'NH', 'REF', 'DNC', 'LAN', 'VAC', 'INA', 'HOS'];
    if (meta.contactCode && !validCodes.includes(meta.contactCode)) {
      errors.push(`Nó ${node.key}: Código de contato inválido "${meta.contactCode}".`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  calculateMetrics: (tree: SkeletonNode[]) => {
    let totalDoors = 0;
    let contactedCount = 0;
    let notHomeCount = 0;
    let refusedCount = 0;
    let dncCount = 0;
    let languageCount = 0;

    function traverse(node: SkeletonNode) {
      const isLeaf = (node.children || []).length === 0;

      if (isLeaf && (node.type === 'slot' || node.type === 'territory')) {
        totalDoors++;
        const meta = (node.meta || {}) as CanvassingNodeMeta;

        switch (meta.contactCode) {
          case 'CNT':
            contactedCount++;
            break;
          case 'NH':
            notHomeCount++;
            break;
          case 'REF':
            refusedCount++;
            break;
          case 'DNC':
            dncCount++;
            break;
          case 'LAN':
            languageCount++;
            break;
        }
      }

      for (const child of node.children || []) {
        traverse(child);
      }
    }

    for (const root of tree) {
      traverse(root);
    }

    const contactRatePercent = totalDoors > 0 ? Math.round((contactedCount / totalDoors) * 100) : 0;

    const data: CanvassingMetrics = {
      totalDoors,
      contactedCount,
      notHomeCount,
      refusedCount,
      dncCount,
      languageCount,
      contactRatePercent,
    };

    return {
      engineId: 'canvassing_logistics',
      data,
    };
  },

  supportedExports: ['csv', 'pdf', 'yaml', 'geojson'],
};
