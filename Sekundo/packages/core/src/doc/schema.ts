/**
 * Sekundo Document Engine — Schema Validation, CST Mutator & Auto-Template (`schema.ts`)
 *
 * Implements:
 * 1. `.sdoc.yaml` parser and schema validator with readable path errors and `maxAliasCount: 100`.
 * 2. `SdocCstMutator`: Clean port of `ASTSequenceMutator` using `eemeli/yaml` CST (`keepSourceTokens: true`)
 *    so canvas drags, resizes, and vertex edits mutate only the target YAML node while preserving `# comments`.
 * 3. `ProvenanceBus`: Clean port of transactional provenance tracking (`editor | canvas | tree | inspector | system`).
 * 4. `autoGenerateSdocFromRegistry`: Port of `DataShapeClassifier` concept to synthesize a ready-to-edit
 *    `.sdoc.yaml` document from any `FlatRegistry` ("Criar do zero" com 1 clique).
 */

import { parse, stringify, parseDocument, isMap, isSeq } from 'yaml';
import type { FlatRegistry } from '../skeleton/types';
import type { SdocDocument, SdocLayer, SdocPrimitive } from './types';

export interface SdocValidationIssue {
  path: string;
  message: string;
}

export interface SdocParseResult {
  doc: SdocDocument | null;
  issues: SdocValidationIssue[];
}

function normalizePrimitive(raw: Record<string, any>, fallbackId: string): SdocPrimitive {
  const type = String(raw.type || 'text').toLowerCase();
  const id = String(raw.id || fallbackId);

  if (type === 'rect') {
    return {
      type: 'rect',
      id,
      x: Number(raw.x ?? 0),
      y: Number(raw.y ?? 0),
      w: Number(raw.w ?? raw.width ?? 20),
      h: Number(raw.h ?? raw.height ?? 10),
      fill: raw.fill ? String(raw.fill) : undefined,
      stroke: raw.stroke ? String(raw.stroke) : undefined,
      strokeWidth: raw.stroke_width !== undefined ? Number(raw.stroke_width) : raw.strokeWidth !== undefined ? Number(raw.strokeWidth) : 0.4,
      radius: raw.radius !== undefined ? Number(raw.radius) : undefined,
    };
  }

  if (type === 'line') {
    return {
      type: 'line',
      id,
      x1: Number(raw.x1 ?? raw.x ?? 0),
      y1: Number(raw.y1 ?? raw.y ?? 0),
      x2: Number(raw.x2 ?? 20),
      y2: Number(raw.y2 ?? 0),
      stroke: raw.stroke ? String(raw.stroke) : '#333333',
      strokeWidth: raw.stroke_width !== undefined ? Number(raw.stroke_width) : raw.strokeWidth !== undefined ? Number(raw.strokeWidth) : 0.4,
      dash: Array.isArray(raw.dash) ? raw.dash.map(Number) : undefined,
    };
  }

  if (type === 'path') {
    const pts: [number, number][] = Array.isArray(raw.points)
      ? raw.points
          .filter((p: any) => Array.isArray(p) && p.length >= 2)
          .map((p: any) => [Number(p[0]), Number(p[1])] as [number, number])
      : [
          [0, 0],
          [10, 0],
          [10, 10],
        ];
    return {
      type: 'path',
      id,
      points: pts,
      closed: Boolean(raw.closed),
      fill: raw.fill ? String(raw.fill) : undefined,
      stroke: raw.stroke ? String(raw.stroke) : '#333333',
      strokeWidth: raw.stroke_width !== undefined ? Number(raw.stroke_width) : raw.strokeWidth !== undefined ? Number(raw.strokeWidth) : 0.4,
    };
  }

  if (type === 'table') {
    return {
      type: 'table',
      id,
      x: Number(raw.x ?? 10),
      y: Number(raw.y ?? 10),
      cols: Array.isArray(raw.cols) ? raw.cols.map(Number) : [40, 40, 40],
      rows: Array.isArray(raw.rows) ? raw.rows.map(Number) : [8, 8, 8],
      stroke: raw.stroke ? String(raw.stroke) : '#333333',
      strokeWidth: raw.stroke_width !== undefined ? Number(raw.stroke_width) : raw.strokeWidth !== undefined ? Number(raw.strokeWidth) : 0.3,
      headerFill: raw.header_fill || raw.headerFill ? String(raw.header_fill || raw.headerFill) : undefined,
      fontSize: raw.font_size !== undefined ? Number(raw.font_size) : raw.fontSize !== undefined ? Number(raw.fontSize) : 8,
      cells: raw.cells && typeof raw.cells === 'object' ? raw.cells : {},
    };
  }

  if (type === 'image') {
    return {
      type: 'image',
      id,
      x: Number(raw.x ?? 0),
      y: Number(raw.y ?? 0),
      w: Number(raw.w ?? 30),
      h: Number(raw.h ?? 30),
      blob: String(raw.blob || ''),
    };
  }

  // Default: 'text'
  return {
    type: 'text',
    id,
    x: Number(raw.x ?? 0),
    y: Number(raw.y ?? 0),
    w: Number(raw.w ?? raw.width ?? 100),
    h: raw.h !== undefined ? Number(raw.h) : undefined,
    text: String(raw.text ?? ''),
    size: raw.size !== undefined ? Number(raw.size) : 10,
    weight: raw.weight === 'bold' ? 'bold' : 'normal',
    align: raw.align === 'center' || raw.align === 'right' ? raw.align : 'left',
    maxLines: raw.max_lines !== undefined ? Number(raw.max_lines) : raw.maxLines !== undefined ? Number(raw.maxLines) : undefined,
    lineHeight: raw.line_height !== undefined ? Number(raw.line_height) : raw.lineHeight !== undefined ? Number(raw.lineHeight) : undefined,
    color: raw.color ? String(raw.color) : '#111111',
    spans: Array.isArray(raw.spans)
      ? raw.spans.map((s: any, idx: number) => ({
          id: String(s.id || `${id}_sp_${idx}`),
          text: String(s.text ?? ''),
          font: s.font ? String(s.font) : undefined,
          size: s.size !== undefined ? Number(s.size) : undefined,
          weight: s.weight === 'bold' ? 'bold' : 'normal',
          style: s.style === 'italic' ? 'italic' : 'normal',
          color: s.color ? String(s.color) : undefined,
          background: s.background ? String(s.background) : undefined,
        }))
      : undefined,
  };
}

/**
 * Parses and validates a `.sdoc.yaml` string into a strongly-typed `SdocDocument`.
 */
export function parseSdocYaml(yamlText: string): SdocParseResult {
  const issues: SdocValidationIssue[] = [];
  if (!yamlText || typeof yamlText !== 'string' || yamlText.trim() === '') {
    return {
      doc: null,
      issues: [{ path: 'root', message: 'O documento YAML está vazio.' }],
    };
  }

  let raw: any;
  try {
    raw = parse(yamlText, {
      maxAliasCount: 100,
      schema: 'core',
    });
  } catch (err: any) {
    return {
      doc: null,
      issues: [{ path: 'yaml', message: err?.message || 'Erro de sintaxe YAML.' }],
    };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      doc: null,
      issues: [{ path: 'root', message: 'A raiz do documento deve ser um mapa YAML.' }],
    };
  }

  const layers: SdocLayer[] = [];
  if (Array.isArray(raw.layers)) {
    raw.layers.forEach((l: any, lIdx: number) => {
      if (!l || typeof l !== 'object') return;
      const layerId = String(l.id || `layer_${lIdx + 1}`);
      const items: SdocPrimitive[] = Array.isArray(l.items)
        ? l.items
            .filter((it: any) => it && typeof it === 'object')
            .map((it: any, iIdx: number) => normalizePrimitive(it, `${layerId}_item_${iIdx + 1}`))
        : [];
      layers.push({
        id: layerId,
        name: l.name ? String(l.name) : layerId,
        locked: Boolean(l.locked),
        visible: l.visible !== false,
        items,
      });
    });
  }

  const doc: SdocDocument = {
    sdoc: Number(raw.sdoc || 1),
    name: String(raw.name || 'Documento Sekundo'),
    page: {
      format: raw.page?.format || 'a4',
      orientation: raw.page?.orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      widthMm: raw.page?.widthMm !== undefined ? Number(raw.page.widthMm) : undefined,
      heightMm: raw.page?.heightMm !== undefined ? Number(raw.page.heightMm) : undefined,
      marginMm: raw.page?.marginMm !== undefined ? Number(raw.page.marginMm) : undefined,
      background: raw.page?.background ? String(raw.page.background) : undefined,
    },
    fonts: raw.fonts && typeof raw.fonts === 'object' ? raw.fonts : { body: { family: 'Helvetica' } },
    repeat:
      raw.repeat && typeof raw.repeat === 'object'
        ? {
            over: String(raw.repeat.over || 'all'),
            per_page: raw.repeat.per_page !== undefined ? Number(raw.repeat.per_page) : undefined,
            grid:
              raw.repeat.grid && typeof raw.repeat.grid === 'object'
                ? {
                    cols: Math.max(1, Number(raw.repeat.grid.cols || 1)),
                    rows: Math.max(1, Number(raw.repeat.grid.rows || 1)),
                    gap: raw.repeat.grid.gap !== undefined ? Number(raw.repeat.grid.gap) : 4,
                    gapX: raw.repeat.grid.gapX !== undefined ? Number(raw.repeat.grid.gapX) : undefined,
                    gapY: raw.repeat.grid.gapY !== undefined ? Number(raw.repeat.grid.gapY) : undefined,
                    startX: raw.repeat.grid.startX !== undefined ? Number(raw.repeat.grid.startX) : undefined,
                    startY: raw.repeat.grid.startY !== undefined ? Number(raw.repeat.grid.startY) : undefined,
                    cellW: raw.repeat.grid.cellW !== undefined ? Number(raw.repeat.grid.cellW) : undefined,
                    cellH: raw.repeat.grid.cellH !== undefined ? Number(raw.repeat.grid.cellH) : undefined,
                  }
                : undefined,
          }
        : undefined,
    underlay:
      raw.underlay && typeof raw.underlay === 'object'
        ? {
            source: String(raw.underlay.source || ''),
            pages: Array.isArray(raw.underlay.pages) ? raw.underlay.pages.map(Number) : [1],
            mode: raw.underlay.mode === 'rebuild' ? 'rebuild' : 'overlay',
          }
        : undefined,
    fields: Array.isArray(raw.fields)
      ? raw.fields.map((f: any, idx: number) => ({
          id: String(f.id || `field_${idx + 1}`),
          from: f.from || 'acroform',
          name: f.name ? String(f.name) : undefined,
          page: f.page !== undefined ? Number(f.page) : 1,
          rect: Array.isArray(f.rect) && f.rect.length >= 4
            ? [Number(f.rect[0]), Number(f.rect[1]), Number(f.rect[2]), Number(f.rect[3])]
            : [10, 10, 60, 6],
          bind: String(f.bind || 'value'),
          size: f.size !== undefined ? Number(f.size) : 10,
          weight: f.weight === 'bold' ? 'bold' : 'normal',
          align: f.align === 'center' || f.align === 'right' ? f.align : 'left',
        }))
      : undefined,
    layers,
  };

  if (doc.layers.length === 0 && (!doc.fields || doc.fields.length === 0) && !doc.underlay) {
    issues.push({
      path: 'layers',
      message: 'O documento não possui camadas (layers), campos (fields) nem fundo (underlay).',
    });
  }

  return { doc, issues };
}

export function stringifySdocYaml(doc: SdocDocument): string {
  return stringify(doc, { indent: 2, lineWidth: 120 });
}

// ---------------------------------------------------------------------------
// CST Mutator (Preserves inline comments and formatting during canvas edits)
// ---------------------------------------------------------------------------

export class SdocCstMutator {
  /**
   * Updates properties of a primitive (identified by `itemId` or `[layerIdx, itemIdx]`)
   * in-place inside `yamlSource` using `eemeli/yaml` Concrete Syntax Tree (`keepSourceTokens: true`),
   * preserving all `#` user comments outside the modified scalar.
   */
  public static updatePrimitiveInPlace(
    yamlSource: string,
    itemId: string,
    patch: Record<string, unknown>
  ): string {
    if (!yamlSource || !itemId) return yamlSource;
    try {
      const doc = parseDocument(yamlSource, { keepSourceTokens: true });
      const layersNode = doc.getIn(['layers']);
      if (isSeq(layersNode)) {
        for (let lIdx = 0; lIdx < layersNode.items.length; lIdx++) {
          const itemsNode = doc.getIn(['layers', lIdx, 'items']);
          if (isSeq(itemsNode)) {
            for (let iIdx = 0; iIdx < itemsNode.items.length; iIdx++) {
              const idVal = doc.getIn(['layers', lIdx, 'items', iIdx, 'id']);
              const fallbackId = `${String(doc.getIn(['layers', lIdx, 'id']) || `layer_${lIdx + 1}`)}_item_${iIdx + 1}`;
              if (String(idVal || fallbackId) === itemId) {
                for (const [k, v] of Object.entries(patch)) {
                  doc.setIn(['layers', lIdx, 'items', iIdx, k], v);
                }
                return doc.toString();
              }
            }
          }
        }
      }

      // Also check `fields` array if user dragged an extracted overlay field
      const fieldsNode = doc.getIn(['fields']);
      if (isSeq(fieldsNode)) {
        for (let fIdx = 0; fIdx < fieldsNode.items.length; fIdx++) {
          const fId = String(doc.getIn(['fields', fIdx, 'id']) || `field_${fIdx + 1}`);
          if (fId === itemId) {
            if (typeof patch.x === 'number' || typeof patch.y === 'number' || typeof patch.w === 'number' || typeof patch.h === 'number') {
              const curRect = doc.getIn(['fields', fIdx, 'rect']) as any;
              const r0 = typeof patch.x === 'number' ? patch.x : Number(curRect?.items?.[0]?.value ?? 10);
              const r1 = typeof patch.y === 'number' ? patch.y : Number(curRect?.items?.[1]?.value ?? 10);
              const r2 = typeof patch.w === 'number' ? patch.w : Number(curRect?.items?.[2]?.value ?? 60);
              const r3 = typeof patch.h === 'number' ? patch.h : Number(curRect?.items?.[3]?.value ?? 6);
              doc.setIn(['fields', fIdx, 'rect'], [r0, r1, r2, r3]);
            }
            for (const [k, v] of Object.entries(patch)) {
              if (!['x', 'y', 'w', 'h'].includes(k)) {
                doc.setIn(['fields', fIdx, k], v);
              }
            }
            return doc.toString();
          }
        }
      }

      return yamlSource;
    } catch {
      return yamlSource;
    }
  }

  /**
   * Appends a new primitive to the specified layer (or first unlocked layer) via CST.
   */
  public static addPrimitiveInPlace(
    yamlSource: string,
    primitive: Record<string, unknown>,
    targetLayerId?: string
  ): string {
    try {
      const doc = parseDocument(yamlSource, { keepSourceTokens: true });
      const layersNode = doc.getIn(['layers']);
      if (!isSeq(layersNode) || layersNode.items.length === 0) {
        doc.setIn(['layers'], [{ id: targetLayerId || 'camada_1', items: [primitive] }]);
        return doc.toString();
      }

      let targetIdx = 0;
      for (let i = 0; i < layersNode.items.length; i++) {
        const lid = String(doc.getIn(['layers', i, 'id']) || '');
        const locked = Boolean(doc.getIn(['layers', i, 'locked']));
        if (targetLayerId && lid === targetLayerId) {
          targetIdx = i;
          break;
        }
        if (!targetLayerId && !locked) {
          targetIdx = i;
          break;
        }
      }

      const itemsSeq = doc.getIn(['layers', targetIdx, 'items']);
      if (isSeq(itemsSeq)) {
        itemsSeq.items.push(doc.createNode(primitive));
      } else {
        doc.setIn(['layers', targetIdx, 'items'], [primitive]);
      }
      return doc.toString();
    } catch {
      return yamlSource;
    }
  }

  /**
   * Sets any path in-place on the YAML CST while preserving comments.
   */
  public static setInPlace(yamlSource: string, path: (string | number)[], value: unknown): string {
    try {
      const doc = parseDocument(yamlSource, { keepSourceTokens: true });
      if (isMap(doc.contents) || isSeq(doc.contents)) {
        doc.setIn(path, value);
        return doc.toString();
      }
      return yamlSource;
    } catch {
      return yamlSource;
    }
  }
}

// ---------------------------------------------------------------------------
// Transactional Provenance Bus (Ported from cv-maker)
// ---------------------------------------------------------------------------

export type SdocTransactionOrigin = 'editor' | 'canvas' | 'tree' | 'inspector' | 'ingest' | 'system';

export interface SdocTransaction {
  id: string;
  origin: SdocTransactionOrigin;
  timestamp: number;
  targetId?: string;
}

export class ProvenanceBus {
  private activeTx: SdocTransaction | null = null;
  private listeners = new Set<(tx: SdocTransaction) => void>();

  public execute<T>(origin: SdocTransactionOrigin, action: () => T, targetId?: string): T {
    if (this.activeTx) {
      return action();
    }
    const tx: SdocTransaction = {
      id: `sdoc-tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      origin,
      timestamp: Date.now(),
      targetId,
    };
    this.activeTx = tx;
    try {
      const res = action();
      this.listeners.forEach((fn) => fn(tx));
      return res;
    } finally {
      this.activeTx = null;
    }
  }

  public get currentOrigin(): SdocTransactionOrigin {
    return this.activeTx?.origin || 'system';
  }

  public subscribe(listener: (tx: SdocTransaction) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const sdocProvenanceBus = new ProvenanceBus();

// ---------------------------------------------------------------------------
// Auto-Template Synthesis from Data Shape ("Criar do Zero")
// ---------------------------------------------------------------------------

export function autoGenerateSdocFromRegistry(
  registry: FlatRegistry,
  eventName: string = 'Quadros & Designações Sekundo'
): string {
  const hasTerritories = registry.some((e) => e.type === 'territory');
  const title = eventName || (hasTerritories ? 'Relatório de Territórios' : 'Quadro de Designações');

  return [
    '# Sekundo Document (.sdoc.yaml) — Gerado Automaticamente',
    '# Edite qualquer coordenada (em mm, origem topo-esquerdo) ou arraste no Canvas.',
    'sdoc: 1',
    `name: "${title.replace(/"/g, '\\"')}"`,
    'page:',
    '  format: a4',
    '  orientation: portrait',
    '  unit: mm',
    'fonts:',
    '  body:',
    '    family: Helvetica',
    'repeat:',
    '  over: "slots(where: value != \'\')"',
    '  per_page: 8',
    '  grid:',
    '    cols: 2',
    '    rows: 4',
    '    gap: 4',
    '    startX: 12',
    '    startY: 28',
    '    cellW: 91',
    '    cellH: 60',
    'layers:',
    '  - id: moldura',
    '    name: Moldura & Grade Técnica',
    '    locked: false',
    '    items:',
    '      - id: card_box',
    '        type: rect',
    '        x: 0',
    '        y: 0',
    '        w: 91',
    '        h: 58',
    '        fill: "#F8FAFC"',
    '        stroke: "#334155"',
    '        stroke_width: 0.4',
    '      - id: header_divider',
    '        type: line',
    '        x1: 0',
    '        y1: 12',
    '        x2: 91',
    '        y2: 12',
    '        stroke: "#94A3B8"',
    '        stroke_width: 0.3',
    '        dash: [2, 1]',
    '  - id: campos',
    '    name: Campos Vinculados (Bindings)',
    '    items:',
    '      - id: txt_parte',
    '        type: text',
    '        x: 4',
    '        y: 3',
    '        w: 83',
    '        text: "{{key}} • {{label | truncate:36}}"',
    '        size: 8.5',
    '        weight: bold',
    '        color: "#0F172A"',
    '      - id: txt_nome',
    '        type: text',
    '        x: 4',
    '        y: 16',
    '        w: 83',
    '        text: "Designado: {{value | default:\'—\'}}"',
    '        size: 10',
    '        weight: bold',
    '        color: "#1E293B"',
    '      - id: txt_ajudante',
    '        type: text',
    '        x: 4',
    '        y: 26',
    '        w: 83',
    '        text: "Ajudante: {{meta.assistantTo | default:\'—\'}}"',
    '        size: 8.5',
    '        color: "#475569"',
    '      - id: txt_data_sala',
    '        type: text',
    '        x: 4',
    '        y: 36',
    '        w: 83',
    '        text: "{{meta.date | date:\'dd/MM/yyyy\' | default:\'Hoje\'}} • {{meta.room | default:\'Salão Principal\'}}"',
    '        size: 8',
    '        color: "#334155"',
    '',
  ].join('\n');
}
