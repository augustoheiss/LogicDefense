/**
 * Sekundo Document Engine — Pure PDF Ingestion Stages (`ingest/stages.ts`)
 *
 * Implements Phase F4 (§1.5 & Red Teaming V4):
 * - Stage 0: Underlay metadata (`sha256:...`, `mode: 'overlay' | 'rebuild'`)
 * - Stage 1: AcroForm fields (`extractAcroFormStage`) with bottom-left `pt` → top-left `mm` conversion
 *   and automatic semantic binding (`classifyFieldSemantics`).
 * - Stage 2: Text extraction (`extractTextStage`) with baseline collinearity merging so letter-by-letter
 *   PDF kerning is fused into clean readable text primitives.
 * - Stage 3: Vector path & rectangle extraction (`extractVectorStage`) with collinear line segment fusion.
 * - Stage 4: Grid / Table detection (`detectGridStage`) from intersecting horizontal and vertical lines.
 */

import type { PDFFormField } from '../../pdf/types';
import { classifyFieldSemantics, semanticKeyToAttribute } from '../../pdf/templateMatcher';
import type { FlatSkeletonEntry } from '../../skeleton/types';
import type { Mm, SdocDocument, SdocField, SdocLayer, SdocPrimitive } from '../types';
import { fromPdf, ptToMm } from '../units';
import { stringifySdocYaml } from '../schema';

export interface RawPdfTextItem {
  str: string;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  page?: number;
  fontName?: string;
}

export interface RawPdfVectorOp {
  type: 'rect' | 'line';
  xPt: number;
  yPt: number;
  wPt?: number;
  hPt?: number;
  x2Pt?: number;
  y2Pt?: number;
  page?: number;
  stroke?: string;
  fill?: string;
  lineWidthPt?: number;
}

export interface IngestReport {
  mode: 'overlay' | 'rebuild';
  fieldsCount: number;
  textCount: number;
  vectorCount: number;
  tableCount: number;
  isScannedLikely: boolean;
  warnings: string[];
}

/**
 * Stage 1: Converts `inspectPDFForm` fields (in PDF points, origin bottom-left)
 * into `SdocField[]` (in mm, origin top-left) with semantic binding inference.
 */
export function extractAcroFormStage(
  pdfFields: PDFFormField[],
  pageHeightMm: Mm = 297,
  _sampleEntries: FlatSkeletonEntry[] = []
): SdocField[] {
  return pdfFields.map((field, idx) => {
    const wMm = Number(Math.max(4, ptToMm(field.width || 60)).toFixed(2));
    const hMm = Number(Math.max(3, ptToMm(field.height || 14)).toFixed(2));
    const { xMm, yMm } = fromPdf(field.x, field.y, pageHeightMm, hMm);

    const sem = classifyFieldSemantics(field.fieldName);
    const bind = sem ? semanticKeyToAttribute(sem.semanticKey) : 'value';

    return {
      id: `f_${idx + 1}_${field.fieldName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 18)}`,
      from: 'acroform',
      name: field.fieldName,
      page: field.page || 1,
      rect: [
        Number(Math.max(0, xMm).toFixed(2)),
        Number(Math.max(0, yMm).toFixed(2)),
        wMm,
        hMm,
      ],
      bind,
      size: 10,
      weight: 'normal',
      align: 'left',
    };
  });
}

/**
 * Stage 2: Converts raw PDF text items into `SdocPrimitive[]` (`type: 'text'`),
 * merging adjacent fragments on the same baseline (`|Δy| <= 1.2 mm` and horizontal gap `<= 4.5 mm`).
 */
export function extractTextStage(
  rawItems: RawPdfTextItem[],
  pageHeightMm: Mm = 297
): SdocPrimitive[] {
  const nonEmpty = rawItems.filter((it) => it && typeof it.str === 'string' && it.str.trim() !== '');
  if (nonEmpty.length === 0) return [];

  const mapped = nonEmpty.map((it) => {
    const hPt = it.heightPt > 0 ? it.heightPt : 10;
    const hMm = ptToMm(hPt);
    const wMm = Math.max(2, ptToMm(it.widthPt > 0 ? it.widthPt : it.str.length * hPt * 0.52));
    const { xMm, yMm } = fromPdf(it.xPt, it.yPt, pageHeightMm, hMm);
    const isBold = Boolean(it.fontName && /bold|black|heavy/i.test(it.fontName));
    return {
      text: it.str,
      xMm: Number(Math.max(0, xMm).toFixed(2)),
      yMm: Number(Math.max(0, yMm).toFixed(2)),
      wMm: Number(wMm.toFixed(2)),
      hMm: Number(hMm.toFixed(2)),
      sizePt: Number(Math.max(5, Math.min(36, hPt)).toFixed(1)),
      weight: (isBold ? 'bold' : 'normal') as 'normal' | 'bold',
    };
  });

  // Sort top-to-bottom, then left-to-right
  mapped.sort((a, b) => (Math.abs(a.yMm - b.yMm) <= 1.2 ? a.xMm - b.xMm : a.yMm - b.yMm));

  // Merge adjacent fragments on the same baseline
  const merged: typeof mapped = [];
  for (const item of mapped) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      Math.abs(prev.yMm - item.yMm) <= 1.2 &&
      item.xMm >= prev.xMm &&
      item.xMm - (prev.xMm + prev.wMm) <= 4.5 &&
      Math.abs(prev.sizePt - item.sizePt) <= 1.5
    ) {
      const gap = item.xMm - (prev.xMm + prev.wMm);
      const sep = gap > 0.6 && !prev.text.endsWith(' ') && !item.text.startsWith(' ') ? ' ' : '';
      prev.text = `${prev.text}${sep}${item.text}`;
      prev.wMm = Number(Math.max(prev.wMm, item.xMm + item.wMm - prev.xMm).toFixed(2));
    } else {
      merged.push({ ...item });
    }
  }

  return merged.map((m, idx) => ({
    type: 'text',
    id: `txt_${idx + 1}`,
    x: m.xMm,
    y: m.yMm,
    w: Number(Math.max(8, m.wMm + 2).toFixed(2)),
    text: m.text.trim(),
    size: m.sizePt,
    weight: m.weight,
    color: '#111111',
  }));
}

/**
 * Stage 3: Converts raw PDF vector operations (`rect` and `line`) into `SdocPrimitive[]`,
 * fusing collinear overlapping or contiguous horizontal/vertical line segments.
 */
export function extractVectorStage(
  rawOps: RawPdfVectorOp[],
  pageHeightMm: Mm = 297
): SdocPrimitive[] {
  const rects: SdocPrimitive[] = [];
  const rawLines: {
    x1: Mm;
    y1: Mm;
    x2: Mm;
    y2: Mm;
    stroke: string;
    strokeWidth: Mm;
  }[] = [];

  for (const op of rawOps) {
    if (op.type === 'rect') {
      const wMm = Number(ptToMm(Math.abs(op.wPt || 0)).toFixed(2));
      const hMm = Number(ptToMm(Math.abs(op.hPt || 0)).toFixed(2));
      if (wMm < 0.5 && hMm < 0.5) continue;

      const { xMm, yMm } = fromPdf(op.xPt, op.yPt, pageHeightMm, hMm);

      // Thin filled rectangles in PDFs are often drawn as horizontal/vertical rules
      if (hMm <= 0.8 && wMm >= 4) {
        rawLines.push({
          x1: Number(xMm.toFixed(2)),
          y1: Number((yMm + hMm / 2).toFixed(2)),
          x2: Number((xMm + wMm).toFixed(2)),
          y2: Number((yMm + hMm / 2).toFixed(2)),
          stroke: op.fill || op.stroke || '#333333',
          strokeWidth: Number(Math.max(0.2, hMm).toFixed(2)),
        });
        continue;
      }
      if (wMm <= 0.8 && hMm >= 4) {
        rawLines.push({
          x1: Number((xMm + wMm / 2).toFixed(2)),
          y1: Number(yMm.toFixed(2)),
          x2: Number((xMm + wMm / 2).toFixed(2)),
          y2: Number((yMm + hMm).toFixed(2)),
          stroke: op.fill || op.stroke || '#333333',
          strokeWidth: Number(Math.max(0.2, wMm).toFixed(2)),
        });
        continue;
      }

      rects.push({
        type: 'rect',
        id: `rect_${rects.length + 1}`,
        x: Number(Math.max(0, xMm).toFixed(2)),
        y: Number(Math.max(0, yMm).toFixed(2)),
        w: wMm,
        h: hMm,
        fill: op.fill,
        stroke: op.stroke || '#333333',
        strokeWidth: Number(ptToMm(op.lineWidthPt || 1).toFixed(2)),
      });
    } else if (op.type === 'line') {
      const p1 = fromPdf(op.xPt, op.yPt, pageHeightMm, 0);
      const p2 = fromPdf(op.x2Pt ?? op.xPt, op.y2Pt ?? op.yPt, pageHeightMm, 0);
      rawLines.push({
        x1: Number(p1.xMm.toFixed(2)),
        y1: Number(p1.yMm.toFixed(2)),
        x2: Number(p2.xMm.toFixed(2)),
        y2: Number(p2.yMm.toFixed(2)),
        stroke: op.stroke || '#333333',
        strokeWidth: Number(ptToMm(op.lineWidthPt || 1).toFixed(2)),
      });
    }
  }

  // Fuse collinear horizontal and vertical segments
  const fusedLines = fuseCollinearLines(rawLines);
  const linePrimitives: SdocPrimitive[] = fusedLines.map((l, idx) => ({
    type: 'line',
    id: `line_${idx + 1}`,
    x1: l.x1,
    y1: l.y1,
    x2: l.x2,
    y2: l.y2,
    stroke: l.stroke,
    strokeWidth: l.strokeWidth,
  }));

  return [...rects, ...linePrimitives];
}

function fuseCollinearLines<
  T extends { x1: Mm; y1: Mm; x2: Mm; y2: Mm; stroke: string; strokeWidth: Mm }
>(lines: T[]): T[] {
  const horiz: T[] = [];
  const vert: T[] = [];
  const other: T[] = [];

  for (const l of lines) {
    if (Math.abs(l.y1 - l.y2) <= 0.35) {
      const minX = Math.min(l.x1, l.x2);
      const maxX = Math.max(l.x1, l.x2);
      horiz.push({ ...l, x1: minX, x2: maxX, y2: l.y1 });
    } else if (Math.abs(l.x1 - l.x2) <= 0.35) {
      const minY = Math.min(l.y1, l.y2);
      const maxY = Math.max(l.y1, l.y2);
      vert.push({ ...l, y1: minY, y2: maxY, x2: l.x1 });
    } else {
      other.push(l);
    }
  }

  horiz.sort((a, b) => (Math.abs(a.y1 - b.y1) <= 0.35 ? a.x1 - b.x1 : a.y1 - b.y1));
  const mergedHoriz: T[] = [];
  for (const h of horiz) {
    const prev = mergedHoriz[mergedHoriz.length - 1];
    if (prev && Math.abs(prev.y1 - h.y1) <= 0.35 && h.x1 <= prev.x2 + 1.0) {
      prev.x2 = Number(Math.max(prev.x2, h.x2).toFixed(2));
    } else {
      mergedHoriz.push({ ...h });
    }
  }

  vert.sort((a, b) => (Math.abs(a.x1 - b.x1) <= 0.35 ? a.y1 - b.y1 : a.x1 - b.x1));
  const mergedVert: T[] = [];
  for (const v of vert) {
    const prev = mergedVert[mergedVert.length - 1];
    if (prev && Math.abs(prev.x1 - v.x1) <= 0.35 && v.y1 <= prev.y2 + 1.0) {
      prev.y2 = Number(Math.max(prev.y2, v.y2).toFixed(2));
    } else {
      mergedVert.push({ ...v });
    }
  }

  return [...mergedHoriz, ...mergedVert, ...other];
}

/**
 * Stage 4: Detects structured tables (`type: 'table'`) from sets of intersecting
 * horizontal and vertical lines (>= 2 horizontal & >= 2 vertical lines forming a grid).
 */
export function detectGridStage(primitives: SdocPrimitive[]): {
  tables: SdocPrimitive[];
  remaining: SdocPrimitive[];
} {
  const lines = primitives.filter((p): p is Extract<SdocPrimitive, { type: 'line' }> => p.type === 'line');
  const hLines = lines.filter((l) => Math.abs(l.y1 - l.y2) <= 0.5 && Math.abs(l.x2 - l.x1) >= 15);
  const vLines = lines.filter((l) => Math.abs(l.x1 - l.x2) <= 0.5 && Math.abs(l.y2 - l.y1) >= 10);

  if (hLines.length < 2 || vLines.length < 2) {
    return { tables: [], remaining: primitives };
  }

  // Extract unique sorted Y coordinates of horizontal lines and X coordinates of vertical lines
  const uniqueCoords = (vals: number[], tol = 1.0): number[] => {
    const sorted = [...vals].sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) {
      if (out.length === 0 || Math.abs(v - out[out.length - 1]) > tol) {
        out.push(Number(v.toFixed(2)));
      }
    }
    return out;
  };

  const yStops = uniqueCoords(hLines.map((l) => l.y1));
  const xStops = uniqueCoords(vLines.map((l) => l.x1));

  if (yStops.length < 2 || xStops.length < 2) {
    return { tables: [], remaining: primitives };
  }

  const cols: Mm[] = [];
  for (let i = 0; i < xStops.length - 1; i++) {
    cols.push(Number((xStops[i + 1] - xStops[i]).toFixed(2)));
  }
  const rows: Mm[] = [];
  for (let j = 0; j < yStops.length - 1; j++) {
    rows.push(Number((yStops[j + 1] - yStops[j]).toFixed(2)));
  }

  const tablePrim: SdocPrimitive = {
    type: 'table',
    id: 'grid_table_1',
    x: xStops[0],
    y: yStops[0],
    cols,
    rows,
    stroke: '#1E293B',
    strokeWidth: 0.35,
    cells: {},
  };

  const usedLineIds = new Set([...hLines.map((l) => l.id), ...vLines.map((l) => l.id)]);
  const remaining = primitives.filter((p) => !usedLineIds.has(p.id));

  return { tables: [tablePrim], remaining };
}

/**
 * Synthesizes a complete `SdocDocument` + YAML string + `IngestReport` from the extracted stages.
 */
export function synthesizeIngestedSdoc(params: {
  name: string;
  sha256: string;
  mode: 'overlay' | 'rebuild';
  pageCount: number;
  widthMm?: Mm;
  heightMm?: Mm;
  fields?: SdocField[];
  textItems?: SdocPrimitive[];
  vectorItems?: SdocPrimitive[];
  detectTables?: boolean;
}): { doc: SdocDocument; yaml: string; report: IngestReport } {
  const warnings: string[] = [];
  const fields = params.fields || [];
  const textItems = params.textItems || [];
  const rawVectors = params.vectorItems || [];

  const isScannedLikely = fields.length === 0 && textItems.length === 0 && rawVectors.length <= 2;
  const effectiveMode: 'overlay' | 'rebuild' = isScannedLikely ? 'overlay' : params.mode;

  if (isScannedLikely) {
    warnings.push(
      'PDF aparenta ser imagem escaneada (sem camada de texto ou AcroForm). Modo Overlay ativado automaticamente para preservar o documento original.'
    );
  } else if (effectiveMode === 'rebuild') {
    warnings.push(
      'Modo Rebuild (Experimental): Fontes embutidas, gradientes e máscaras complexas foram simplificados em primitivas vetoriais editáveis.'
    );
  }

  const { tables, remaining: remainingVectors } =
    params.detectTables !== false
      ? detectGridStage(rawVectors)
      : { tables: [], remaining: rawVectors };

  const layers: SdocLayer[] = [];

  if (effectiveMode === 'rebuild') {
    if (remainingVectors.length > 0 || tables.length > 0) {
      layers.push({
        id: 'vetores_extraidos',
        name: 'Vetores & Grades Extraídos',
        locked: false,
        items: [...tables, ...remainingVectors],
      });
    }
    if (textItems.length > 0) {
      layers.push({
        id: 'textos_extraidos',
        name: 'Textos Extraídos',
        locked: false,
        items: textItems,
      });
    }
  }

  // Always include an editable annotations/bindings layer on top
  layers.push({
    id: 'anotacoes',
    name: 'Camada Editável sobre o PDF',
    locked: false,
    items:
      fields.length === 0 && layers.length === 0
        ? [
            {
              type: 'text',
              id: 'campo_exemplo',
              x: 20,
              y: 25,
              w: 120,
              text: '{{value}}',
              size: 11,
              weight: 'bold',
              color: '#0F172A',
            },
          ]
        : [],
  });

  const pagesArray = Array.from({ length: Math.max(1, params.pageCount) }, (_, i) => i + 1);

  const doc: SdocDocument = {
    sdoc: 1,
    name: params.name || 'PDF Importado',
    page: {
      format: 'a4',
      orientation:
        params.widthMm && params.heightMm && params.widthMm > params.heightMm
          ? 'landscape'
          : 'portrait',
      unit: 'mm',
    },
    fonts: {
      body: { family: 'Helvetica' },
    },
    underlay: {
      source: params.sha256,
      pages: pagesArray,
      mode: effectiveMode,
    },
    ...(fields.length > 0 ? { fields } : {}),
    layers,
  };

  const yaml = stringifySdocYaml(doc);
  return {
    doc,
    yaml,
    report: {
      mode: effectiveMode,
      fieldsCount: fields.length,
      textCount: textItems.length,
      vectorCount: remainingVectors.length,
      tableCount: tables.length,
      isScannedLikely,
      warnings,
    },
  };
}
