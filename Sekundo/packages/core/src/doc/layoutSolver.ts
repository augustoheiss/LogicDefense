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
 * Deterministic Helvetica Regular glyph width table (in thousandths of 1 em / fontSizePt).
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
 * Deterministic Helvetica-Bold glyph width table (in thousandths of 1 em / fontSizePt).
 * Matches Adobe Standard Helvetica-Bold AFM metrics used by `pdf-lib` (`StandardFonts.HelveticaBold`).
 */
const HELVETICA_BOLD_CHAR_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 333, '"': 474, '#': 556, '$': 556, '%': 889, '&': 722, "'": 238,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 333, ';': 333, '<': 584, '=': 584, '>': 584, '?': 611,
  '@': 975, A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667,
  T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 333, '\\': 278, ']': 333,
  '^': 584, _: 556, '`': 333, a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611,
  h: 611, i: 278, j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611,
  r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500, '{': 389,
  '|': 280, '}': 389, '~': 584,
};

function lookupHelveticaCharWidth(ch: string, weight: 'normal' | 'bold'): number {
  const table = weight === 'bold' ? HELVETICA_BOLD_CHAR_WIDTHS : HELVETICA_CHAR_WIDTHS;
  const direct = table[ch];
  if (direct !== undefined) return direct;
  // In Adobe Helvetica & Helvetica-Bold AFM, accented Latin-1 characters (Á, É, Í, Ó, Ú, Ç, Ã, ç, ã, etc.)
  // have the exact same glyph width as their NFD base character.
  const base = ch.normalize('NFD')[0];
  if (base && table[base] !== undefined) return table[base];
  return weight === 'bold' ? 584 : 556;
}

/**
 * Measures the physical width in millimeters (`mm`) of a string at `fontSizePt` in Helvetica / Helvetica-Bold.
 */
export function measureTextWidthMm(
  text: string,
  fontSizePt: number,
  weight: 'normal' | 'bold' = 'normal'
): Mm {
  if (!text) return 0;
  let totalEmThousandths = 0;
  for (let i = 0; i < text.length; i++) {
    totalEmThousandths += lookupHelveticaCharWidth(text[i], weight);
  }
  const widthPt = (totalEmThousandths / 1000) * fontSizePt;
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
  idSuffix: string,
  warnings?: string[]
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

  const allLines = breakTextIntoLines(rawText, prim.w, sizePt, weight);
  let lines = allLines;
  if (prim.maxLines !== undefined && prim.maxLines > 0 && allLines.length > prim.maxLines) {
    lines = allLines.slice(0, prim.maxLines);
    warnings?.push(
      `Texto "${prim.id}" truncado de "${rawText}" para "${lines.join(' ')}" (maxLines=${prim.maxLines}).`
    );
  }
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
  options?: {
    serviceYear?: string;
    customContexts?: Record<string, unknown>[];
    formValues?: Record<string, unknown>;
  }
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

  const createBlankPage = (pageIndex: number, explicitUnderlayPage?: number): DisplayPage => {
    if (pages.length >= MAX_SDOC_PAGES) {
      throw new SdocLimitError(
        'LIMIT_PAGES',
        `Limite de segurança excedido: mais de ${MAX_SDOC_PAGES} páginas geradas.`
      );
    }
    const targetUnderlayPageNum =
      explicitUnderlayPage ??
      (doc.underlay?.pages?.[pageIndex % (doc.underlay.pages.length || 1)] || 1);

    const underlayPage =
      doc.underlay && doc.underlay.source
        ? {
            blob: doc.underlay.source,
            page: targetUnderlayPageNum,
            mode: doc.underlay.mode || 'overlay',
          }
        : undefined;

    const perPageGeom = doc.pages?.[targetUnderlayPageNum - 1];
    const p: DisplayPage = {
      index: pageIndex,
      widthMm: perPageGeom?.widthMm ?? pageDims.widthMm,
      heightMm: perPageGeom?.heightMm ?? pageDims.heightMm,
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
    const targetUnderlayPage = page.underlay?.page || page.index + 1;
    const isMultiPageTemplate =
      (doc.underlay?.pages && doc.underlay.pages.length > 1) ||
      (doc.pages && doc.pages.length > 1);

    for (const layer of doc.layers) {
      if (layer.visible === false) continue;
      for (const item of layer.items) {
        // C3: Filter page-scoped primitives so page 1's text is not duplicated on pages 2..N
        if (item.page !== undefined && (isMultiPageTemplate || item.page > 1) && item.page !== targetUnderlayPage) {
          continue;
        }
        const resolved = resolvePrimitiveToOps(
          item,
          layer.id,
          context,
          offsetX,
          offsetY,
          idSuffix,
          warnings
        );
        for (const op of resolved) {
          pushOpChecked(page, op);
        }
      }
    }

    // Render any extracted `fields[]` mapped to this page
    if (doc.fields && doc.fields.length > 0) {
      const inputMap =
        context.input && typeof context.input === 'object'
          ? (context.input as Record<string, unknown>)
          : undefined;

      for (const field of doc.fields) {
        const fieldPage = field.page || 1;
        const fieldPages = field.pages && field.pages.length > 0 ? field.pages : [fieldPage];
        if (
          doc.underlay &&
          doc.underlay.pages &&
          doc.underlay.pages.length > 1 &&
          !fieldPages.includes(targetUnderlayPage) &&
          fieldPage !== targetUnderlayPage
        ) {
          continue;
        }
        const [fx, fy, fw, fh] = field.rect;

        // C9 & C6: Resolve from form input map first, then template bind, then PDF defaultValue
        let textVal = '';
        const fieldKey = field.name || field.id;
        const directInputVal =
          (fieldKey && inputMap && inputMap[fieldKey] !== undefined ? inputMap[fieldKey] : undefined) ??
          (fieldKey && context[fieldKey] !== undefined ? context[fieldKey] : undefined) ??
          (fieldKey && options?.formValues && options.formValues[fieldKey] !== undefined
            ? options.formValues[fieldKey]
            : undefined);

        if (directInputVal !== undefined && directInputVal !== null && String(directInputVal) !== '') {
          if (field.fieldType === 'checkbox') {
            const norm = String(directInputVal).trim().toLowerCase();
            textVal = ['true', '1', 'yes', 'sim', 'on', 'checked', 'x', '✓', '✔'].includes(norm)
              ? 'X'
              : '';
          } else {
            textVal = String(directInputVal);
          }
        } else {
          const tpl =
            field.bind.startsWith('=') || field.bind.includes('{{')
              ? field.bind
              : `{{${field.bind}}}`;
          textVal = renderTemplateString(tpl, context);
        }

        if (textVal === '' && field.defaultValue !== undefined) {
          if (field.fieldType === 'checkbox') {
            textVal = field.defaultValue === 'true' ? 'X' : '';
          } else {
            textVal = field.defaultValue;
          }
        }

        if (field.maxLength && field.maxLength > 0 && textVal.length > field.maxLength) {
          const truncated = textVal.slice(0, field.maxLength);
          warnings.push(
            `Campo "${fieldKey}" truncado de "${textVal}" para "${truncated}" (maxLength=${field.maxLength}).`
          );
          textVal = truncated;
        }

        const fSize = field.size ?? 10;
        const fWeight = field.weight ?? 'normal';
        const allLines = breakTextIntoLines(textVal, fw, fSize, fWeight);
        const lines = allLines.slice(0, 1);
        if (allLines.length > 1) {
          warnings.push(
            `Campo "${fieldKey}" truncado de "${textVal}" para "${lines[0]}" (largura ${fw}mm insuficiente).`
          );
        }

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

    // C7: Never inject fake "Voluntário Exemplo" into exports when registry is empty
    let contexts: Record<string, unknown>[];
    if (rawContexts.length > 0) {
      contexts = rawContexts;
    } else {
      warnings.push(
        `Nenhum registro encontrado para o seletor "${doc.repeat.over}". Documento gerado em branco.`
      );
      contexts = [{}];
    }

    const grid = doc.repeat.grid;
    const perPage = Math.max(1, doc.repeat.per_page || (grid ? grid.cols * grid.rows : 1));
    const underlayPages =
      doc.underlay?.pages && doc.underlay.pages.length > 0 ? doc.underlay.pages : [1];

    // Pre-check page count limit before looping
    const pagesPerBatch = perPage === 1 ? underlayPages.length : 1;
    const expectedPages = Math.ceil(contexts.length / perPage) * pagesPerBatch;
    if (expectedPages > MAX_SDOC_PAGES) {
      throw new SdocLimitError(
        'LIMIT_PAGES',
        `Limite de segurança excedido: a repetição geraria ${expectedPages} páginas (máximo ${MAX_SDOC_PAGES}).`
      );
    }

    for (let i = 0; i < contexts.length; i += perPage) {
      const batchIdx = Math.floor(i / perPage);
      const slice = contexts.slice(i, i + perPage);

      // C4: When perPage === 1 and underlay has multiple pages (e.g. [1, 2]),
      // emit ALL underlay pages for each record so no page is skipped.
      if (perPage === 1 && underlayPages.length > 1) {
        const recordCtx = slice[0] || {};
        for (let uIdx = 0; uIdx < underlayPages.length; uIdx++) {
          const uPageNum = underlayPages[uIdx];
          const outPageIdx = pages.length;
          const page = createBlankPage(outPageIdx, uPageNum);
          const ctx = {
            ...recordCtx,
            ...(options?.formValues ? { input: options.formValues } : {}),
            pageNumber: outPageIdx + 1,
            slotIndex: 1,
          };
          emitLayersIntoPage(page, ctx, 0, 0, `r${batchIdx + 1}_p${uPageNum}`);
        }
      } else {
        const outPageIdx = pages.length;
        const page = createBlankPage(outPageIdx);

        for (let slotIdx = 0; slotIdx < slice.length; slotIdx++) {
          const ctx = {
            ...slice[slotIdx],
            ...(options?.formValues ? { input: options.formValues } : {}),
            pageNumber: outPageIdx + 1,
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

          const suffix =
            perPage > 1 || contexts.length > 1 ? `p${outPageIdx + 1}_s${slotIdx + 1}` : '';
          emitLayersIntoPage(page, ctx, offsetX, offsetY, suffix);
        }
      }
    }
  } else {
    // Non-repeating single/multi-page document
    const customCtx = options?.customContexts?.[0];
    const firstEntry = registry.find((e) => e.value && e.value.trim() !== '') || registry[0];
    const baseCtx: Record<string, unknown> = customCtx
      ? { ...customCtx }
      : firstEntry
        ? {
            key: firstEntry.key,
            label: firstEntry.label,
            value: firstEntry.value,
            email: firstEntry.email,
            meta: firstEntry.meta,
            ...(options?.formValues ? { input: options.formValues } : {}),
          }
        : options?.formValues
          ? { input: options.formValues, ...options.formValues }
          : {};

    const underlayPages =
      doc.underlay?.pages && doc.underlay.pages.length > 0 ? doc.underlay.pages : [1];
    for (let pIdx = 0; pIdx < underlayPages.length; pIdx++) {
      const uPageNum = underlayPages[pIdx];
      const page = createBlankPage(pIdx, uPageNum);
      emitLayersIntoPage(
        page,
        { ...baseCtx, pageNumber: pIdx + 1 },
        0,
        0,
        underlayPages.length > 1 ? `p${pIdx + 1}` : ''
      );
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
