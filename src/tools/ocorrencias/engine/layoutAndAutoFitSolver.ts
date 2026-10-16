/**
 * Ocorrências 2.0 PDF Engine — Deterministic Layout & Logarithmic Auto-Fit Solver
 * (`engine/layoutAndAutoFitSolver.ts`)
 *
 * Unifies:
 * 1. Sekundo's Adobe Standard Helvetica AFM Glyph Width Tables (`@sekundo/core/doc/layoutSolver.ts`)
 *    for exact sub-millimeter line breaking without DOM reflow.
 * 2. CV-Maker's Logarithmic Bisection Spatial Budgeting (`DynamicDensityCompressor.ts`)
 *    so long pedagogical reports automatically scale their font size and line height
 *    to fit inside fixed physical boxes `[xMm, yMm, wMm, hMm]` with ZERO silent clipping.
 */

import type {
  ContinuationSectionSpec,
  DisplayList,
  DisplayPage,
  Mm,
  OcorrenciaDocSpec,
} from './types';
import { PT_PER_MM, ptToMm } from './units';
import { sanitizeForWinAnsiWithWarnings } from './unicodeFont';

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
  '|': 260, '}': 334, '~': 584, '–': 556, '—': 1000,
};

/**
 * Deterministic Helvetica-Bold glyph width table (in thousandths of 1 em / fontSizePt).
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
  '|': 280, '}': 389, '~': 584, '–': 556, '—': 1000,
};

function lookupHelveticaCharWidth(ch: string, weight: 'normal' | 'bold'): number {
  const table = weight === 'bold' ? HELVETICA_BOLD_CHAR_WIDTHS : HELVETICA_CHAR_WIDTHS;
  const direct = table[ch];
  if (direct !== undefined) return direct;
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
 * Hard-splits any single token that exceeds `maxWidthMm` so no line ever overflows its box horizontally.
 */
export function breakTextIntoLines(
  text: string,
  maxWidthMm: Mm,
  fontSizePt: number,
  weight: 'normal' | 'bold' = 'normal'
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

  return lines.length > 0 ? lines : [];
}

export interface AutoFitOptions {
  baseFontSizePt?: number;
  minFontSizePt?: number;
  weight?: 'normal' | 'bold';
  multiline?: boolean;
  maxIterations?: number;
}

export interface AutoFitBoxResult {
  lines: string[];
  fontSizePt: number;
  lineHeightMm: Mm;
  autoFitted: boolean;
  overflowed: boolean;
}

/**
 * Executes an $O(\log_2(1/\epsilon))$ binary bisection search (CV-Maker `DynamicDensityCompressor` pattern)
 * combined with Sekundo's exact Helvetica AFM metrics to find the largest `fontSizePt` in `[minPt, maxPt]`
 * that fits `text` inside `[wMm, hMm]` without clipping a single word.
 */
export function solveTextBoxAutoFit(
  text: string,
  wMm: Mm,
  hMm: Mm,
  options: AutoFitOptions = {}
): AutoFitBoxResult {
  const cleanText = (text ?? '').trim();
  const maxPt = options.baseFontSizePt ?? (options.multiline ? 10.5 : 11);
  const minPt = options.minFontSizePt ?? (options.multiline ? 6.5 : 7.0);
  const weight = options.weight ?? 'normal';
  const maxIterations = options.maxIterations ?? 8;
  const usableW = Math.max(2, wMm - 1.2); // 0.6mm horizontal padding per side
  const usableH = Math.max(2, hMm - 0.8); // 0.4mm vertical safety buffer

  if (!cleanText) {
    return {
      lines: [],
      fontSizePt: maxPt,
      lineHeightMm: Number(((maxPt * 1.25) / PT_PER_MM).toFixed(3)),
      autoFitted: false,
      overflowed: false,
    };
  }

  // Single-line mode: shrink font horizontally so `measureTextWidthMm <= usableW`
  if (!options.multiline) {
    const singleLine = cleanText.replace(/\s+/g, ' ');
    const widthAtMax = measureTextWidthMm(singleLine, maxPt, weight);
    if (widthAtMax <= usableW) {
      return {
        lines: [singleLine],
        fontSizePt: maxPt,
        lineHeightMm: Number(((maxPt * 1.2) / PT_PER_MM).toFixed(3)),
        autoFitted: false,
        overflowed: false,
      };
    }

    // Exact linear ratio for single line, clamped to minPt
    const ratio = usableW / Math.max(0.1, widthAtMax);
    const fittedPt = Number(Math.max(minPt, Math.min(maxPt, maxPt * ratio)).toFixed(2));
    const stillOver = measureTextWidthMm(singleLine, fittedPt, weight) > usableW + 0.5;

    // If even at minPt a single line overflows horizontally and box is tall enough for 2 lines, wrap it
    if (stillOver && usableH >= ptToMm(minPt) * 2.1) {
      const wrapped = breakTextIntoLines(singleLine, usableW, minPt, weight);
      const lhMm = Number(((minPt * 1.18) / PT_PER_MM).toFixed(3));
      return {
        lines: wrapped,
        fontSizePt: minPt,
        lineHeightMm: lhMm,
        autoFitted: true,
        overflowed: wrapped.length * lhMm > usableH + 0.5,
      };
    }

    return {
      lines: [singleLine],
      fontSizePt: fittedPt,
      lineHeightMm: Number(((fittedPt * 1.2) / PT_PER_MM).toFixed(3)),
      autoFitted: fittedPt < maxPt - 0.1,
      overflowed: stillOver,
    };
  }

  // Multi-line mode (textarea): Logarithmic Bisection on t in [0, 1]
  // where t = 1.0 -> (maxPt, lineHeightRatio = 1.28)
  //       t = 0.0 -> (minPt, lineHeightRatio = 1.14)
  const evalAtT = (t: number) => {
    const sizePt = Number((minPt + t * (maxPt - minPt)).toFixed(2));
    const lhRatio = 1.14 + t * (1.28 - 1.14);
    const lhMm = Number(((sizePt * lhRatio) / PT_PER_MM).toFixed(3));
    const lines = breakTextIntoLines(cleanText, usableW, sizePt, weight);
    const totalHeightMm = lines.length * lhMm;
    return { sizePt, lhMm, lines, fits: totalHeightMm <= usableH };
  };

  // Fast check at maximum relaxation (t = 1.0)
  const relaxed = evalAtT(1.0);
  if (relaxed.fits) {
    return {
      lines: relaxed.lines,
      fontSizePt: relaxed.sizePt,
      lineHeightMm: relaxed.lhMm,
      autoFitted: false,
      overflowed: false,
    };
  }

  let low = 0.0;
  let high = 1.0;
  let best = evalAtT(0.0);

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const candidate = evalAtT(mid);
    if (candidate.fits) {
      best = candidate;
      low = mid; // Try relaxing slightly more for maximum readability
    } else {
      high = mid; // Compress further
    }
  }

  return {
    lines: best.lines,
    fontSizePt: best.sizePt,
    lineHeightMm: best.lhMm,
    autoFitted: best.sizePt < maxPt - 0.1,
    overflowed: !best.fits,
  };
}

export function isTruthyCheckboxValue(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const norm = val.trim().toLowerCase();
    return ['true', '1', 'yes', 'sim', 'on', 'checked', 's', 'x', '✓', '✔'].includes(norm);
  }
  return Boolean(val);
}

/**
 * Encodes normalized `[0..1, 0..1]` strokes into a compact ASCII string (`sigv1:x1,y1;x2,y2|...`).
 */
export function encodeSignatureVector(strokes: Array<Array<[number, number]>>): string {
  const validStrokes = strokes
    .map((stroke) =>
      stroke
        .filter((pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
        .map(([nx, ny]) => `${Math.max(0, Math.min(1, nx)).toFixed(3)},${Math.max(0, Math.min(1, ny)).toFixed(3)}`)
        .join(';')
    )
    .filter((s) => s.length > 0);
  if (validStrokes.length === 0) return '';
  return `sigv1:${validStrokes.join('|')}`;
}

/**
 * Parses a `sigv1:...` vector signature string into normalized `[0..1, 0..1]` strokes.
 */
export function parseSignatureVector(raw: string): Array<Array<[number, number]>> {
  if (!raw || typeof raw !== 'string' || !raw.startsWith('sigv1:')) return [];
  const body = raw.slice('sigv1:'.length).trim();
  if (!body) return [];
  const strokes: Array<Array<[number, number]>> = [];
  for (const rawStroke of body.split('|')) {
    const pts: Array<[number, number]> = [];
    for (const pair of rawStroke.split(';')) {
      const [xs, ys] = pair.split(',');
      const nx = parseFloat(xs);
      const ny = parseFloat(ys);
      if (Number.isFinite(nx) && Number.isFinite(ny)) {
        pts.push([Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))]);
      }
    }
    if (pts.length >= 2) {
      strokes.push(pts);
    }
  }
  return strokes;
}

/**
 * Solves an `OcorrenciaDocSpec` + `values` into a deterministic `DisplayList` (in millimeters).
 * Consumed identically by both `OcorrenciasSvgOverlay` (60fps live screen preview)
 * and `pdfClientPainter` (`pdf-lib` binary vector export).
 */
export function solveOcorrenciaDisplayList(
  docSpec: OcorrenciaDocSpec,
  values: Record<string, string | boolean | undefined>
): DisplayList {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const warnings: string[] = [];
  const fieldMetrics: DisplayList['fieldMetrics'] = {};
  const continuationSections: ContinuationSectionSpec[] = [];
  let totalPrimitives = 0;

  const pages: DisplayPage[] = (
    docSpec.pages && docSpec.pages.length > 0
      ? docSpec.pages
      : [{ widthMm: 210, heightMm: 297 }]
  ).map((pg, idx) => ({
    pageNumber: idx + 1,
    widthMm: pg.widthMm,
    heightMm: pg.heightMm,
    rotate: pg.rotate,
    ops: [],
  }));

  const getPage = (pageNum1Indexed: number): DisplayPage => {
    const idx = Math.max(0, Math.min(pages.length - 1, (pageNum1Indexed || 1) - 1));
    return pages[idx];
  };

  for (const field of docSpec.fields) {
    const page = getPage(field.page || 1);
    const [x, y, w, h] = field.rect;
    const rawVal = values[field.id] ?? field.defaultValue ?? '';

    // 1. Optional whiteout background rect (ONLY when explicitly set to 'whiteout')
    if (field.backgroundMode === 'whiteout') {
      page.ops.push({
        kind: 'rect',
        id: `bg_${field.id}`,
        fieldId: field.id,
        page: page.pageNumber,
        x,
        y,
        w,
        h,
        fill: '#FFFFFF',
        fillOpacity: 0.88,
      });
      totalPrimitives++;
    }

    // 2. Checkbox resolution
    if (field.type === 'checkbox') {
      const checked = isTruthyCheckboxValue(rawVal);
      if (checked) {
        const boxMinMm = Math.min(w, h);
        const checkFontSizePt = field.fontSizePt ?? Math.max(8, Math.min(14, Math.round(boxMinMm * PT_PER_MM * 0.78)));
        const lhMm = Number(((checkFontSizePt * 1.1) / PT_PER_MM).toFixed(3));
        page.ops.push({
          kind: 'text',
          id: `txt_${field.id}`,
          fieldId: field.id,
          page: page.pageNumber,
          x,
          y,
          w,
          h,
          lines: ['X'],
          sizePt: checkFontSizePt,
          baseSizePt: checkFontSizePt,
          lineHeightMm: lhMm,
          weight: 'bold',
          align: 'center',
          color: field.color || '#0F172A',
          autoFitted: false,
          overflowed: false,
        });
        totalPrimitives++;
        fieldMetrics[field.id] = {
          fontSizePt: checkFontSizePt,
          lineCount: 1,
          autoFitted: false,
          overflowed: false,
        };
      } else {
        fieldMetrics[field.id] = {
          fontSizePt: field.fontSizePt ?? 10,
          lineCount: 0,
          autoFitted: false,
          overflowed: false,
        };
      }
      continue;
    }

    // 2.5. Vector Handwritten Signature resolution (`sigv1:...` or `field.type === 'signature'`)
    const strValRaw = typeof rawVal === 'boolean' ? (rawVal ? 'Sim' : '') : String(rawVal ?? '');
    if (strValRaw.startsWith('sigv1:') || field.type === 'signature') {
      const normStrokes = parseSignatureVector(strValRaw);
      if (normStrokes.length > 0) {
        const padX = 0.6;
        const padY = 0.6;
        const innerW = Math.max(2, w - padX * 2);
        const innerH = Math.max(2, h - padY * 2);
        const mmStrokes: Array<Array<[Mm, Mm]>> = [];
        const pathParts: string[] = [];

        for (const stroke of normStrokes) {
          const mmPts: Array<[Mm, Mm]> = stroke.map(([nx, ny]) => [
            Number((x + padX + nx * innerW).toFixed(2)),
            Number((y + padY + ny * innerH).toFixed(2)),
          ]);
          mmStrokes.push(mmPts);
          const cmds = mmPts.map(([px, py], idx) => `${idx === 0 ? 'M' : 'L'} ${px} ${py}`);
          pathParts.push(cmds.join(' '));
        }

        page.ops.push({
          kind: 'signature',
          id: `sig_${field.id}`,
          fieldId: field.id,
          page: page.pageNumber,
          x,
          y,
          w,
          h,
          strokes: mmStrokes,
          svgPathMm: pathParts.join(' '),
          color: field.color || '#0F296B',
          strokeWidthMm: 0.42,
        });
        totalPrimitives += mmStrokes.length;
        fieldMetrics[field.id] = {
          fontSizePt: field.fontSizePt ?? 10,
          lineCount: mmStrokes.length,
          autoFitted: false,
          overflowed: false,
        };
        continue;
      } else if (field.type === 'signature' && !strValRaw.trim()) {
        fieldMetrics[field.id] = {
          fontSizePt: field.fontSizePt ?? 10,
          lineCount: 0,
          autoFitted: false,
          overflowed: false,
        };
        continue;
      }
    }

    // 3. Text / Textarea / Date resolution
    const strVal = strValRaw;
    if (!strVal.trim()) {
      fieldMetrics[field.id] = {
        fontSizePt: field.fontSizePt ?? (field.type === 'textarea' ? 10 : 11),
        lineCount: 0,
        autoFitted: false,
        overflowed: false,
      };
      continue;
    }

    const sanitized = sanitizeForWinAnsiWithWarnings(strVal, field.label || field.id);
    if (sanitized.warnings.length > 0) {
      warnings.push(...sanitized.warnings);
    }

    const isMultiline =
      field.type === 'textarea' ||
      sanitized.text.includes('\n') ||
      ['descricao', 'compromisso', 'observac', 'relato', 'medida'].some((k) =>
        field.id.toLowerCase().includes(k)
      );

    const baseSizePt = field.fontSizePt ?? (isMultiline ? 10.5 : 11);
    const minSizePt = field.minFontSizePt ?? (isMultiline ? 6.5 : 7.0);
    const weight = field.weight ?? 'normal';

    const autoFit = solveTextBoxAutoFit(sanitized.text, w, h, {
      baseFontSizePt: baseSizePt,
      minFontSizePt: minSizePt,
      weight,
      multiline: isMultiline,
    });

    const overflowPolicy = field.overflowBehavior ?? (isMultiline ? 'continue-page' : 'shrink-clamp');

    // Phase 2 (F2.1): Automatic Continuation Sheet (`continue-page`) when text exceeds box even at minSizePt
    if (autoFit.overflowed && isMultiline && overflowPolicy === 'continue-page') {
      const readablePt = Number(Math.max(minSizePt, Math.min(baseSizePt, 8.2)).toFixed(2));
      const readableLhMm = Number(((readablePt * 1.18) / PT_PER_MM).toFixed(3));
      const usableW = Math.max(2, w - 1.2);
      const usableH = Math.max(2, h - 0.8);
      const allWrappedLines = breakTextIntoLines(sanitized.text, usableW, readablePt, weight);
      const maxLinesPage1 = Math.max(2, Math.floor(usableH / readableLhMm));

      const headLines = allWrappedLines.slice(0, maxLinesPage1 - 1);
      const tailText = allWrappedLines.slice(maxLinesPage1 - 1).join(' ');
      const continuationNotice = '[... Continua na Folha Complementar Anexa (Pag. 2) ...]';
      const page1Lines = [...headLines, continuationNotice];

      const annexFontSizePt = 9.5;
      const annexLhMm = Number(((annexFontSizePt * 1.28) / PT_PER_MM).toFixed(3));
      const annexLines = breakTextIntoLines(tailText, 155, annexFontSizePt, 'normal');

      continuationSections.push({
        fieldId: field.id,
        fieldLabel: field.label || field.id,
        lines: annexLines,
        fontSizePt: annexFontSizePt,
        lineHeightMm: annexLhMm,
      });

      fieldMetrics[field.id] = {
        fontSizePt: readablePt,
        lineCount: page1Lines.length,
        autoFitted: true,
        overflowed: false,
        continuedOnAnnex: true,
        continuationLineCount: annexLines.length,
      };

      page.ops.push({
        kind: 'text',
        id: `txt_${field.id}`,
        fieldId: field.id,
        page: page.pageNumber,
        x: Number((x + 0.6).toFixed(2)),
        y,
        w: Number(usableW.toFixed(2)),
        h,
        lines: page1Lines,
        sizePt: readablePt,
        baseSizePt,
        lineHeightMm: readableLhMm,
        weight,
        align: field.align ?? 'left',
        color: field.color || '#0F172A',
        autoFitted: true,
        overflowed: false,
      });
      totalPrimitives++;
      continue;
    }

    if (autoFit.overflowed) {
      warnings.push(
        `O texto em "${field.label}" excede a altura física da caixa mesmo na fonte mínima (${autoFit.fontSizePt}pt). Aumente a caixa no PDF ou resuma o texto.`
      );
    }

    fieldMetrics[field.id] = {
      fontSizePt: autoFit.fontSizePt,
      lineCount: autoFit.lines.length,
      autoFitted: autoFit.autoFitted,
      overflowed: autoFit.overflowed,
    };

    if (autoFit.lines.length > 0) {
      page.ops.push({
        kind: 'text',
        id: `txt_${field.id}`,
        fieldId: field.id,
        page: page.pageNumber,
        x: Number((x + 0.6).toFixed(2)),
        y,
        w: Number(Math.max(2, w - 1.2).toFixed(2)),
        h,
        lines: autoFit.lines,
        sizePt: autoFit.fontSizePt,
        baseSizePt,
        lineHeightMm: autoFit.lineHeightMm,
        weight,
        align: field.align ?? 'left',
        color: field.color || '#0F172A',
        autoFitted: autoFit.autoFitted,
        overflowed: autoFit.overflowed,
      });
      totalPrimitives++;
    }
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    pages,
    continuationSections: continuationSections.length > 0 ? continuationSections : undefined,
    warnings,
    fieldMetrics,
    stats: {
      primitives: totalPrimitives,
      pages: pages.length + (continuationSections.length > 0 ? 1 : 0),
      ms: Math.max(1, Math.round(t1 - t0)),
    },
  };
}
