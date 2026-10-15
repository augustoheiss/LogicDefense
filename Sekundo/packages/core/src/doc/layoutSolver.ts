/**
 * Sekundo Document Engine — Deterministic Layout Solver (`layoutSolver.ts`)
 *
 * Implements the Display List architecture (§1.3 & §3.2 of the Master Plan):
 * - Single geometry computation in pure TypeScript (`@sekundo/core/doc`).
 * - Evaluates `repeat` (imposition 4-Up, multi-column grid, or 1-page-per-item).
 * - Resolves `{{...}}` bindings via the logicless Mustache interpreter (`template.ts`).
 * - Breaks text into `lines[]` deterministically using Helvetica glyph width metrics
 *   so that every `w` box constraint is strictly respected across SVG and PDF painters.
 * - Enforces Red Teaming V3 security limits (`MAX_PAGES = 500`, `MAX_PRIMITIVES = 20000`).
 */

import type { FlatRegistry } from '../skeleton/types';
import type {
  DisplayList,
  DisplayPage,
  Mm,
  ResolvedOp,
  SdocDocument,
  SdocPrimitive,
} from './types';
import { resolvePageDimensions, PT_PER_MM } from './units';
import { renderTemplateString } from './template';
import { evaluateRegistrySelector } from './selector';

export const MAX_SDOC_PAGES = 500;
export const MAX_SDOC_PRIMITIVES = 20000;

export class SdocLimitError extends Error {
  public readonly code: 'LIMIT_PAGES' | 'LIMIT_PRIMITIVES';
  constructor(code: 'LIMIT_PAGES' | 'LIMIT_PRIMITIVES', message: string) {
    super(message);
    this.name = 'SdocLimitError';
    this.code = code;
  }
}

/**
 * Deterministic Helvetica glyph width table (in thousandths of 1 em / fontSizePt).
 * Matches Adobe Standard Helvetica AFM metrics used by `pdf-lib` (`StandardFonts.Helvetica`).
 */
const HELVETICA_CHAR_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667,
  T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 278, '\\': 278, ']': 278,
  '^': 469, _: 556, '`': 333, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556,
  h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556,
  r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, '{': 334,
  '|': 260, '}': 334, '~': 584,
};

/**
 * Measures the physical width in millimeters (`mm`) of a string at `fontSizePt` in Helvetica.
 * Bold adds a 6% metric factor matching `Helvetica-Bold` average glyph expansion.
 */
export function measureTextWidthMm(
  text: string,
  fontSizePt: number,
  weight: 'normal' | 'bold' = 'normal'
): Mm {
  if (!text) return 0;
  const boldFactor = weight === 'bold' ? 1.06 : 1.0;
  let totalEmThousandths = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    totalEmThousandths += HELVETICA_CHAR_WIDTHS[ch] ?? 556;
  }
  const widthPt = (totalEmThousandths / 1000) * fontSizePt * boldFactor;
  return widthPt / PT_PER_MM;
}

/**
 * Breaks `text` into an array of lines such that every line has `measureTextWidthMm(line) <= maxWidthMm`.
 * Hard-splits any single token that exceeds `maxWidthMm` so no line ever overflows its box.
 */
export function breakTextIntoLines(
  text: string,
  maxWidthMm: Mm,
  fontSizePt: number,
  weight: 'normal' | 'bold' = 'normal',
  maxLines?: number
): string[] {
  const safeMaxW = Math.max(2, maxWidthMm);
  const rawParagraphs = (text ?? '').split(/\r?\n/);
  const lines: string[] = [];

  const splitLongWord = (word: string): string[] => {
    const parts: string[] = [];
    let current = '';
    for (const ch of word) {
      const candidate = current + ch;
      if (current.length > 0 && measureTextWidthMm(candidate, fontSizePt, weight) > safeMaxW) {
        parts.push(current);
        current = ch;
      } else {
        current = candidate;
      }
    }
    if (current) parts.push(current);
    return parts;
  };

  for (const para of rawParagraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }

    const words = para.split(/\s+/).filter(Boolean);
    let currentLine = '';

    for (const word of words) {
      if (measureTextWidthMm(word, fontSizePt, weight) > safeMaxW) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        const chunks = splitLongWord(word);
        for (let i = 0; i < chunks.length - 1; i++) {
          lines.push(chunks[i]);
        }
        currentLine = chunks[chunks.length - 1] || '';
        continue;
      }

      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (measureTextWidthMm(candidate, fontSizePt, weight) <= safeMaxW) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  if (maxLines !== undefined && maxLines > 0 && lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  return lines.length > 0 ? lines : [''];
}

function resolvePrimitiveToOps(
  prim: SdocPrimitive,
  layerId: string,
  context: Record<string, unknown>,
  offsetX: Mm,
  offsetY: Mm,
  idSuffix: string
): ResolvedOp[] {
  const opId = idSuffix ? `${prim.id}_${idSuffix}` : prim.id;

  if (prim.type === 'rect') {
    return [
      {
        kind: 'rect',
        id: opId,
        layerId,
        x: Number((prim.x + offsetX).toFixed(3)),
        y: Number((prim.y + offsetY).toFixed(3)),
        w: prim.w,
        h: prim.h,
        fill: prim.fill,
        stroke: prim.stroke,
        strokeWidthMm: prim.strokeWidth ?? 0.35,
        radiusMm: prim.radius,
      },
    ];
  }

  if (prim.type === 'line') {
    return [
      {
        kind: 'line',
        id: opId,
        layerId,
        x1: Number((prim.x1 + offsetX).toFixed(3)),
        y1: Number((prim.y1 + offsetY).toFixed(3)),
        x2: Number((prim.x2 + offsetX).toFixed(3)),
        y2: Number((prim.y2 + offsetY).toFixed(3)),
        stroke: prim.stroke || '#333333',
        strokeWidthMm: prim.strokeWidth ?? 0.35,
        dash: prim.dash,
      },
    ];
  }

  if (prim.type === 'path') {
    return [
      {
        kind: 'path',
        id: opId,
        layerId,
        points: prim.points.map(([px, py]) => [
          Number((px + offsetX).toFixed(3)),
          Number((py + offsetY).toFixed(3)),
        ]),
        closed: Boolean(prim.closed),
        fill: prim.fill,
        stroke: prim.stroke,
        strokeWidthMm: prim.strokeWidth ?? 0.35,
      },
    ];
  }

  if (prim.type === 'image') {
    return [
      {
        kind: 'image',
        id: opId,
        layerId,
        x: Number((prim.x + offsetX).toFixed(3)),
        y: Number((prim.y + offsetY).toFixed(3)),
        w: prim.w,
        h: prim.h,
        blob: prim.blob,
      },
    ];
  }

  if (prim.type === 'table') {
    const ops: ResolvedOp[] = [];
    const baseX = prim.x + offsetX;
    const baseY = prim.y + offsetY;
    const stroke = prim.stroke || '#1E293B';
    const sw = prim.strokeWidth ?? 0.3;
    const fontSize = prim.fontSize ?? 7.5;

    let curY = baseY;
    for (let r = 0; r < prim.rows.length; r++) {
      const rh = prim.rows[r];
      let curX = baseX;
      for (let c = 0; c < prim.cols.length; c++) {
        const cw = prim.cols[c];
        const cellKey = `${r},${c}`;
        const rawCellTpl = prim.cells?.[cellKey] || '';
        const resolvedCellText = rawCellTpl ? renderTemplateString(rawCellTpl, context) : '';

        ops.push({
          kind: 'rect',
          id: `${opId}_cell_${r}_${c}`,
          layerId,
          x: Number(curX.toFixed(3)),
          y: Number(curY.toFixed(3)),
          w: cw,
          h: rh,
          fill: r === 0 && prim.headerFill ? prim.headerFill : undefined,
          stroke,
          strokeWidthMm: sw,
        });

        if (resolvedCellText.trim() !== '') {
          const lineHeightMm = (fontSize * 1.2) / PT_PER_MM;
          const lines = breakTextIntoLines(
            resolvedCellText,
            Math.max(2, cw - 2),
            fontSize,
            r === 0 ? 'bold' : 'normal',
            2
          );
          ops.push({
            kind: 'text',
            id: `${opId}_txt_${r}_${c}`,
            layerId,
            x: Number((curX + 1).toFixed(3)),
            y: Number((curY + 1).toFixed(3)),
            w: Math.max(2, cw - 2),
            h: rh,
            lines,
            sizePt: fontSize,
            lineHeightMm,
            weight: r === 0 ? 'bold' : 'normal',
            align: 'left',
            color: '#0F172A',
          });
        }

        curX += cw;
      }
      curY += rh;
    }

    return ops;
  }

  // 'text'
  const sizePt = prim.size ?? 10;
  const weight = prim.weight ?? 'normal';
  const resolvedSpans = prim.spans?.map((sp) => ({
    ...sp,
    text: renderTemplateString(sp.text, context),
  }));
  const rawText =
    resolvedSpans && resolvedSpans.length > 0
      ? resolvedSpans.map((s) => s.text).join(' ')
      : renderTemplateString(prim.text, context);

  const lines = breakTextIntoLines(rawText, prim.w, sizePt, weight, prim.maxLines);
  const lineHeightMm = prim.lineHeight ?? Number(((sizePt * 1.25) / PT_PER_MM).toFixed(3));
  const computedH = prim.h ?? Number((lines.length * lineHeightMm).toFixed(3));

  return [
    {
      kind: 'text',
      id: opId,
      layerId,
      x: Number((prim.x + offsetX).toFixed(3)),
      y: Number((prim.y + offsetY).toFixed(3)),
      w: prim.w,
      h: computedH,
      lines,
      sizePt,
      lineHeightMm,
      weight,
      align: prim.align ?? 'left',
      color: prim.color ?? '#111111',
      spans: resolvedSpans,
    },
  ];
}

/**
 * Solves an `SdocDocument` + `FlatRegistry` into a deterministic `DisplayList` (in mm).
 */
export function solveLayout(
  doc: SdocDocument,
  registry: FlatRegistry = [],
  options?: { serviceYear?: string; customContexts?: Record<string, unknown>[] }
): DisplayList {
  const t0 = Date.now();
  const warnings: string[] = [];
  const pageDims = resolvePageDimensions(doc.page);
  const pages: DisplayPage[] = [];
  let totalPrimitives = 0;

  const pushOpChecked = (page: DisplayPage, op: ResolvedOp) => {
    totalPrimitives++;
    if (totalPrimitives > MAX_SDOC_PRIMITIVES) {
      throw new SdocLimitError(
        'LIMIT_PRIMITIVES',
        `Limite de segurança excedido: mais de ${MAX_SDOC_PRIMITIVES} primitivas geradas.`
      );
    }
    page.ops.push(op);
  };

  const createBlankPage = (pageIndex: number): DisplayPage => {
    if (pages.length >= MAX_SDOC_PAGES) {
      throw new SdocLimitError(
        'LIMIT_PAGES',
        `Limite de segurança excedido: mais de ${MAX_SDOC_PAGES} páginas geradas.`
      );
    }
    const underlayPage =
      doc.underlay && doc.underlay.source
        ? {
            blob: doc.underlay.source,
            page: doc.underlay.pages?.[pageIndex % (doc.underlay.pages.length || 1)] || 1,
            mode: doc.underlay.mode || 'overlay',
          }
        : undefined;

    const p: DisplayPage = {
      index: pageIndex,
      widthMm: pageDims.widthMm,
      heightMm: pageDims.heightMm,
      background: doc.page.background,
      underlay: underlayPage,
      ops: [],
    };
    pages.push(p);
    return p;
  };

  const emitLayersIntoPage = (
    page: DisplayPage,
    context: Record<string, unknown>,
    offsetX: Mm,
    offsetY: Mm,
    idSuffix: string
  ) => {
    for (const layer of doc.layers) {
      if (layer.visible === false) continue;
      for (const item of layer.items) {
        const resolved = resolvePrimitiveToOps(item, layer.id, context, offsetX, offsetY, idSuffix);
        for (const op of resolved) {
          pushOpChecked(page, op);
        }
      }
    }

    // Also render any extracted `fields[]` mapped to this page
    if (doc.fields && doc.fields.length > 0) {
      for (const field of doc.fields) {
        const fieldPage = field.page || 1;
        const targetUnderlayPage = page.underlay?.page || page.index + 1;
        if (doc.underlay && doc.underlay.pages && doc.underlay.pages.length > 1 && fieldPage !== targetUnderlayPage) {
          continue;
        }
        const [fx, fy, fw, fh] = field.rect;
        const tpl = field.bind.includes('{{') ? field.bind : `{{${field.bind}}}`;
        const textVal = renderTemplateString(tpl, context);
        const fSize = field.size ?? 10;
        const fWeight = field.weight ?? 'normal';
        const lines = breakTextIntoLines(textVal, fw, fSize, fWeight, 1);
        pushOpChecked(page, {
          kind: 'text',
          id: idSuffix ? `${field.id}_${idSuffix}` : field.id,
          layerId: 'fields',
          x: Number((fx + offsetX).toFixed(3)),
          y: Number((fy + offsetY).toFixed(3)),
          w: fw,
          h: fh,
          lines,
          sizePt: fSize,
          lineHeightMm: Number(((fSize * 1.2) / PT_PER_MM).toFixed(3)),
          weight: fWeight,
          align: field.align ?? 'left',
          color: '#0F172A',
        });
      }
    }
  };

  if (doc.repeat && doc.repeat.over) {
    const rawContexts =
      options?.customContexts ||
      evaluateRegistrySelector(doc.repeat.over, registry, { serviceYear: options?.serviceYear });

    const contexts =
      rawContexts.length > 0
        ? rawContexts
        : [
            {
              index: 1,
              key: '01-01',
              label: 'Exemplo de Designação',
              value: 'Voluntário Exemplo',
              meta: { date: '2026-10-15', room: 'Salão Principal', assistantTo: 'Ajudante Exemplo' },
            },
          ];

    const grid = doc.repeat.grid;
    const perPage = Math.max(1, doc.repeat.per_page || (grid ? grid.cols * grid.rows : 1));

    // Pre-check page count limit before looping
    const expectedPages = Math.ceil(contexts.length / perPage);
    if (expectedPages > MAX_SDOC_PAGES) {
      throw new SdocLimitError(
        'LIMIT_PAGES',
        `Limite de segurança excedido: a repetição geraria ${expectedPages} páginas (máximo ${MAX_SDOC_PAGES}).`
      );
    }

    for (let i = 0; i < contexts.length; i += perPage) {
      const pageIdx = Math.floor(i / perPage);
      const page = createBlankPage(pageIdx);
      const slice = contexts.slice(i, i + perPage);

      for (let slotIdx = 0; slotIdx < slice.length; slotIdx++) {
        const ctx = {
          ...slice[slotIdx],
          pageNumber: pageIdx + 1,
          slotIndex: slotIdx + 1,
        };

        let offsetX = 0;
        let offsetY = 0;

        if (grid && perPage > 1) {
          const cols = Math.max(1, grid.cols);
          const rows = Math.max(1, grid.rows);
          const col = slotIdx % cols;
          const row = Math.floor(slotIdx / cols);
          const gapX = grid.gapX ?? grid.gap ?? 4;
          const gapY = grid.gapY ?? grid.gap ?? 4;
          const startX = grid.startX ?? 0;
          const startY = grid.startY ?? 0;
          const cellW = grid.cellW ?? (pageDims.widthMm - startX * 2 - gapX * (cols - 1)) / cols;
          const cellH = grid.cellH ?? (pageDims.heightMm - startY * 2 - gapY * (rows - 1)) / rows;

          offsetX = startX + col * (cellW + gapX);
          offsetY = startY + row * (cellH + gapY);
        }

        const suffix = perPage > 1 || contexts.length > 1 ? `p${pageIdx + 1}_s${slotIdx + 1}` : '';
        emitLayersIntoPage(page, ctx, offsetX, offsetY, suffix);
      }
    }
  } else {
    // Non-repeating single/multi-page document
    const firstEntry = registry.find((e) => e.value && e.value.trim() !== '') || registry[0];
    const baseCtx: Record<string, unknown> = firstEntry
      ? {
          key: firstEntry.key,
          label: firstEntry.label,
          value: firstEntry.value,
          email: firstEntry.email,
          meta: firstEntry.meta,
        }
      : {};

    const underlayPages = doc.underlay?.pages && doc.underlay.pages.length > 0 ? doc.underlay.pages : [1];
    for (let pIdx = 0; pIdx < underlayPages.length; pIdx++) {
      const page = createBlankPage(pIdx);
      emitLayersIntoPage(page, { ...baseCtx, pageNumber: pIdx + 1 }, 0, 0, underlayPages.length > 1 ? `p${pIdx + 1}` : '');
    }
  }

  return {
    pages,
    warnings,
    stats: {
      primitives: totalPrimitives,
      pages: pages.length,
      ms: Math.max(1, Date.now() - t0),
    },
  };
}
