/**
 * Sekundo — Advanced Canvassing Logistics Engine (LGPD / GDPR / C-25/17 Safe)
 *
 * Implements granular field coverage logistics focused on Quadras and Public Streets:
 * - Operational Coverage Codes (LGPD Safe): VIS (Visitado), PEN (Pendente), COM (Comercial), INA (Acesso Restrito), VAC (Vago)
 * - Deprecates and sanitizes behavioral/ethnic resident profiling codes (HOS, REF, LAN, DNC)
 *   per LGPD Art. 5º II & Art. 11 and CJEU Judgment C-25/17.
 */

import type {
  EventEngine,
  CanvassingMetrics,
  CanvassingNodeMeta,
  CanvassContactCode,
  CanvassOperationalCode,
} from './types';
import type { SkeletonNode, NodeType } from '../skeleton/types';

export const CANVASS_LOGISTIC_CODES: readonly CanvassOperationalCode[] = [
  'VIS',
  'PEN',
  'COM',
  'INA',
  'VAC',
] as const;

export const FORBIDDEN_PROFILING_CODES = ['HOS', 'REF', 'LAN', 'DNC'] as const;

const BEHAVIORAL_PROFILING_REGEX =
  /\b(hostil|bravo|agressiv[oa]|recusou|n[aã]o\s+visitar|dnc|estrangeir[oa]|idioma\s+[a-zçãõáéíóú]+)\b/gi;

/**
 * Normalizes any legacy or profiling contact code into an LGPD-safe operational code
 * focused strictly on quadra/street coverage.
 */
export function normalizeCanvassOperationalCode(
  code?: string | null
): CanvassOperationalCode {
  const upper = String(code || '').trim().toUpperCase();
  if (upper === 'VIS' || upper === 'CNT') return 'VIS';
  if (upper === 'PEN' || upper === 'NH') return 'PEN';
  if (upper === 'COM') return 'COM';
  if (upper === 'INA') return 'INA';
  if (upper === 'VAC') return 'VAC';
  // Behavioral/refusal/language codes (HOS, REF, LAN, DNC) are collapsed into neutral VIS
  // so no resident profiling is persisted or exported.
  if (upper === 'HOS' || upper === 'REF' || upper === 'LAN' || upper === 'DNC') {
    return 'VIS';
  }
  return 'PEN';
}

/**
 * Scrubs behavioral or ethnic/national origin profiling labels from free-text notes
 * while keeping logistical street/building information intact.
 */
export function sanitizeCanvassNotesForLgpd(notes?: string | null): string {
  if (!notes) return '';
  return String(notes)
    .replace(/\[N[AÃ]O\s+VISITAR\]/gi, '')
    .replace(BEHAVIORAL_PROFILING_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const canvassingEngine: EventEngine = {
  id: 'canvassing_logistics',
  name: 'Logística de Cobertura de Quadras e Ruas (LGPD / C-25/17 Safe)',
  description:
    'Rastreamento logístico de cobertura de quadras e ruas públicas (VIS, PEN, COM, INA, VAC) sem perfilamento comportamental ou étnico de moradores.',
  icon: 'map-marker-path',
  allowedNodeTypes: ['header', 'slot', 'territory', 'note'],

  defaultNodeTypeForDepth: (depth: number): NodeType => {
    if (depth <= 2) return 'header';    // Sector / Territory
    if (depth === 3) return 'territory'; // Quadra / Street
    return 'slot';                      // House / Door
  },

  validateNode: (node: SkeletonNode) => {
    const errors: string[] = [];
    const meta = (node.meta || {}) as CanvassingNodeMeta & { strictLgpd?: boolean };

    const validCodes: CanvassContactCode[] = [
      'VIS',
      'PEN',
      'COM',
      'INA',
      'VAC',
      'CNT',
      'NH',
      'REF',
      'DNC',
      'LAN',
      'HOS',
    ];
    if (meta.contactCode && !validCodes.includes(meta.contactCode)) {
      errors.push(`Nó ${node.key}: Código de contato inválido "${meta.contactCode}".`);
    }
    if (
      meta.strictLgpd &&
      meta.contactCode &&
      (FORBIDDEN_PROFILING_CODES as readonly string[]).includes(meta.contactCode)
    ) {
      errors.push(
        `Nó ${node.key}: Código de perfilamento "${meta.contactCode}" bloqueado por conformidade LGPD / C-25/17. Use códigos logísticos (VIS, PEN, COM, INA, VAC).`
      );
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
    let visitedCount = 0;
    let pendingCount = 0;
    let commercialCount = 0;
    let inaccessibleCount = 0;
    let vacantCount = 0;

    function traverse(node: SkeletonNode) {
      const isLeaf = (node.children || []).length === 0;

      if (isLeaf && (node.type === 'slot' || node.type === 'territory')) {
        totalDoors++;
        const meta = (node.meta || {}) as CanvassingNodeMeta;

        switch (meta.contactCode) {
          case 'VIS':
            visitedCount++;
            contactedCount++;
            break;
          case 'CNT':
            contactedCount++;
            visitedCount++;
            break;
          case 'PEN':
            pendingCount++;
            notHomeCount++;
            break;
          case 'NH':
            notHomeCount++;
            pendingCount++;
            break;
          case 'COM':
            commercialCount++;
            visitedCount++;
            break;
          case 'INA':
            inaccessibleCount++;
            break;
          case 'VAC':
            vacantCount++;
            break;
          case 'REF':
            refusedCount++;
            visitedCount++;
            break;
          case 'DNC':
            dncCount++;
            visitedCount++;
            break;
          case 'LAN':
            languageCount++;
            visitedCount++;
            break;
          case 'HOS':
            visitedCount++;
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
      visitedCount,
      pendingCount,
      commercialCount,
      inaccessibleCount,
      vacantCount,
    };

    return {
      engineId: 'canvassing_logistics',
      data,
    };
  },

  supportedExports: ['csv', 'pdf', 'yaml', 'geojson'],
};
