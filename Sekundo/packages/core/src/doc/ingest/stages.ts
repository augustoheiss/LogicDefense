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
import type { Mm, SdocDocument, SdocField, SdocLayer, SdocPageGeometry, SdocPrimitive } from '../types';
import { detectPageFormatFromMm, fromPdf, ptToMm } from '../units';
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
  isXfa?: boolean;
  hasSignature?: boolean;
  isEncrypted?: boolean;
  warnings: string[];
}

/**
 * Stage 1: Converts `inspectPDFForm` fields (in PDF points, origin bottom-left)
 * into `SdocField[]` (in mm, origin top-left) with semantic binding inference,
 * rotation normalization (H8, R2-02), per-page geometry (R2-01), and preservation of field metadata (C6, C9, H5, H12).
 */
export function extractAcroFormStage(
  pdfFields: PDFFormField[],
  pageHeightMm: Mm = 297,
  _sampleEntries: FlatSkeletonEntry[] = [],
  pageWidthMm: Mm = 210,
  pagesGeometry?: SdocPageGeometry[]
): SdocField[] {
  return pdfFields.map((field, idx) => {
    const pageNum = Math.max(1, field.page || 1);
    const pageGeom = pagesGeometry?.[pageNum - 1];
    const effRot =
      (((field.pageRotation ?? pageGeom?.rotate ?? 0) % 360) + 360) % 360;

    // Resolve unrotated PDF page dimensions in mm for coordinate conversion
    const geomW = pageGeom?.widthMm ?? pageWidthMm;
    const geomH = pageGeom?.heightMm ?? pageHeightMm;
    const unrotatedW =
      pageGeom && (effRot === 90 || effRot === 270) ? geomH : geomW;
    const unrotatedH =
      pageGeom && (effRot === 90 || effRot === 270) ? geomW : geomH;

    const rawWMm = Number(Math.max(3, ptToMm(field.width || 60)).toFixed(2));
    const rawHMm = Number(Math.max(3, ptToMm(field.height || 14)).toFixed(2));

    let xMm: Mm;
    let yMm: Mm;
    let wMm = rawWMm;
    let hMm = rawHMm;

    if (effRot === 90) {
      // Clockwise 90 deg: bottom-left (xPt, yPt) maps to visual landscape (yPt from left, xPt from top)
      xMm = Number(ptToMm(field.y).toFixed(2));
      yMm = Number(ptToMm(field.x).toFixed(2));
      wMm = rawHMm;
      hMm = rawWMm;
    } else if (effRot === 180) {
      // R2-02: 180 deg rotation: origin is top-right in visual space
      xMm = Number(Math.max(0, unrotatedW - ptToMm(field.x) - rawWMm).toFixed(2));
      yMm = Number(Math.max(0, ptToMm(field.y)).toFixed(2));
      wMm = rawWMm;
      hMm = rawHMm;
    } else if (effRot === 270) {
      xMm = Number(Math.max(0, unrotatedH - ptToMm(field.y) - rawHMm).toFixed(2));
      yMm = Number(Math.max(0, unrotatedW - ptToMm(field.x) - rawWMm).toFixed(2));
      wMm = rawHMm;
      hMm = rawWMm;
    } else {
      const conv = fromPdf(field.x, field.y, unrotatedH, rawHMm);
      xMm = conv.xMm;
      yMm = conv.yMm;
    }

    // C9: Only bind to schedule/registry attributes when semantic confidence is high;
    // otherwise bind to `input.<fieldName>` so arbitrary PDF forms (CPF, Telefone, etc.) stay distinct.
    const sem = classifyFieldSemantics(field.fieldName);
    const bind =
      sem && sem.confidence >= 0.85
        ? semanticKeyToAttribute(sem.semanticKey)
        : `input.${field.fieldName}`;

    return {
      id: `f_${idx + 1}_${field.fieldName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 18)}`,
      from: 'acroform',
      name: field.fieldName,
      page: pageNum,
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
      fieldType: field.fieldType,
      ...(field.options && field.options.length > 0 ? { options: field.options } : {}),
      ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
      ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
      ...(effRot ? { pageRotation: effRot } : {}),
    };
  });
}

/**
 * Stage 2: Converts raw PDF text items into `SdocPrimitive[]` (`type: 'text'`),
 * merging adjacent fragments on the same page and baseline (`|Δy| <= 1.2 mm` and horizontal gap `<= 4.5 mm`).
 */
export function extractTextStage(
  rawItems: RawPdfTextItem[],
  pageHeightMm: Mm = 297,
  pagesGeometry?: SdocPageGeometry[]
): SdocPrimitive[] {
  const nonEmpty = rawItems.filter((it) => it && typeof it.str === 'string' && it.str.trim() !== '');
  if (nonEmpty.length === 0) return [];

  const mapped = nonEmpty.map((it) => {
    const pageNum = Math.max(1, it.page || 1);
    const effPageH = pagesGeometry?.[pageNum - 1]?.heightMm ?? pageHeightMm;
    const hPt = it.heightPt > 0 ? it.heightPt : 10;
    const hMm = ptToMm(hPt);
    const wMm = Math.max(2, ptToMm(it.widthPt > 0 ? it.widthPt : it.str.length * hPt * 0.52));
    const { xMm, yMm } = fromPdf(it.xPt, it.yPt, effPageH, hMm);
    const isBold = Boolean(it.fontName && /bold|black|heavy/i.test(it.fontName));
    return {
      page: pageNum,
      text: it.str,
      xMm: Number(Math.max(0, xMm).toFixed(2)),
      yMm: Number(Math.max(0, yMm).toFixed(2)),
      wMm: Number(wMm.toFixed(2)),
      hMm: Number(hMm.toFixed(2)),
      sizePt: Number(Math.max(5, Math.min(36, hPt)).toFixed(1)),
      weight: (isBold ? 'bold' : 'normal') as 'normal' | 'bold',
    };
  });

  // Sort by page, then top-to-bottom, then left-to-right
  mapped.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return Math.abs(a.yMm - b.yMm) <= 1.2 ? a.xMm - b.xMm : a.yMm - b.yMm;
  });

  // Merge adjacent fragments on the same page and baseline
  const merged: typeof mapped = [];
  for (const item of mapped) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.page === item.page &&
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
    page: m.page,
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
 * fusing collinear overlapping or contiguous horizontal/vertical line segments per page.
 */
export function extractVectorStage(
  rawOps: RawPdfVectorOp[],
  pageHeightMm: Mm = 297,
  pagesGeometry?: SdocPageGeometry[]
): SdocPrimitive[] {
  const rects: SdocPrimitive[] = [];
  const rawLines: {
    page: number;
    x1: Mm;
    y1: Mm;
    x2: Mm;
    y2: Mm;
    stroke: string;
    strokeWidth: Mm;
  }[] = [];

  for (const op of rawOps) {
    const pageNum = Math.max(1, op.page || 1);
    const effPageH = pagesGeometry?.[pageNum - 1]?.heightMm ?? pageHeightMm;
    if (op.type === 'rect') {
      const wMm = Number(ptToMm(Math.abs(op.wPt || 0)).toFixed(2));
      const hMm = Number(ptToMm(Math.abs(op.hPt || 0)).toFixed(2));
      if (wMm < 0.5 && hMm < 0.5) continue;

      const { xMm, yMm } = fromPdf(op.xPt, op.yPt, effPageH, hMm);

      // Thin filled rectangles in PDFs are often drawn as horizontal/vertical rules
      if (hMm <= 0.8 && wMm >= 4) {
        rawLines.push({
          page: pageNum,
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
          page: pageNum,
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
        page: pageNum,
        x: Number(Math.max(0, xMm).toFixed(2)),
        y: Number(Math.max(0, yMm).toFixed(2)),
        w: wMm,
        h: hMm,
        fill: op.fill,
        stroke: op.stroke || '#333333',
        strokeWidth: Number(ptToMm(op.lineWidthPt || 1).toFixed(2)),
      });
    } else if (op.type === 'line') {
      const p1 = fromPdf(op.xPt, op.yPt, effPageH, 0);
      const p2 = fromPdf(op.x2Pt ?? op.xPt, op.y2Pt ?? op.yPt, effPageH, 0);
      rawLines.push({
        page: pageNum,
        x1: Number(p1.xMm.toFixed(2)),
        y1: Number(p1.yMm.toFixed(2)),
        x2: Number(p2.xMm.toFixed(2)),
        y2: Number(p2.yMm.toFixed(2)),
        stroke: op.stroke || '#333333',
        strokeWidth: Number(ptToMm(op.lineWidthPt || 1).toFixed(2)),
      });
    }
  }

  // Fuse collinear horizontal and vertical segments per page
  const fusedLines = fuseCollinearLines(rawLines);
  const linePrimitives: SdocPrimitive[] = fusedLines.map((l, idx) => ({
    type: 'line',
    id: `line_${idx + 1}`,
    page: l.page,
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
  T extends { page?: number; x1: Mm; y1: Mm; x2: Mm; y2: Mm; stroke: string; strokeWidth: Mm }
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

  horiz.sort((a, b) => {
    if ((a.page || 1) !== (b.page || 1)) return (a.page || 1) - (b.page || 1);
    return Math.abs(a.y1 - b.y1) <= 0.35 ? a.x1 - b.x1 : a.y1 - b.y1;
  });
  const mergedHoriz: T[] = [];
  for (const h of horiz) {
    const prev = mergedHoriz[mergedHoriz.length - 1];
    if (
      prev &&
      (prev.page || 1) === (h.page || 1) &&
      Math.abs(prev.y1 - h.y1) <= 0.35 &&
      h.x1 <= prev.x2 + 1.0
    ) {
      prev.x2 = Number(Math.max(prev.x2, h.x2).toFixed(2));
    } else {
      mergedHoriz.push({ ...h });
    }
  }

  vert.sort((a, b) => {
    if ((a.page || 1) !== (b.page || 1)) return (a.page || 1) - (b.page || 1);
    return Math.abs(a.x1 - b.x1) <= 0.35 ? a.y1 - b.y1 : a.x1 - b.x1;
  });
  const mergedVert: T[] = [];
  for (const v of vert) {
    const prev = mergedVert[mergedVert.length - 1];
    if (
      prev &&
      (prev.page || 1) === (v.page || 1) &&
      Math.abs(prev.x1 - v.x1) <= 0.35 &&
      v.y1 <= prev.y2 + 1.0
    ) {
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

  const tablePage = hLines[0]?.page || vLines[0]?.page || 1;
  const tablePrim: SdocPrimitive = {
    type: 'table',
    id: 'grid_table_1',
    page: tablePage,
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
 * Preserves source page format (Letter/Legal/A4/Custom), dimensions, rotation (C1, H8),
 * page-scoped primitives (C3), and XFA/Signature/Encryption flags (H4, U2, U8).
 */
export function synthesizeIngestedSdoc(params: {
  name: string;
  sha256: string;
  mode: 'overlay' | 'rebuild';
  pageCount: number;
  widthMm?: Mm;
  heightMm?: Mm;
  rotation?: number;
  pages?: SdocPageGeometry[];
  isXfa?: boolean;
  hasSignature?: boolean;
  isEncrypted?: boolean;
  fields?: SdocField[];
  textItems?: SdocPrimitive[];
  vectorItems?: SdocPrimitive[];
  detectTables?: boolean;
}): { doc: SdocDocument; yaml: string; report: IngestReport } {
  const warnings: string[] = [];
  const fields = params.fields || [];
  // Ensure every extracted text/vector item carries an explicit 1-indexed page number (C3)
  const textItems = (params.textItems || []).map((it) => ({
    ...it,
    page: it.page ?? 1,
  }));
  const rawVectors = (params.vectorItems || []).map((it) => ({
    ...it,
    page: it.page ?? 1,
  }));

  const isXfa = Boolean(params.isXfa);
  const hasSignature = Boolean(params.hasSignature);
  const isEncrypted = Boolean(params.isEncrypted);

  if (isXfa) {
    warnings.push(
      'Formulário XFA (Adobe LiveCycle) detectado. Recomendado converter para PDF AcroForm padrão para garantir compatibilidade universal.'
    );
  }
  if (hasSignature) {
    warnings.push(
      'Assinatura digital criptográfica (/Sig) detectada. Achatar (flatten) o documento invalidará a assinatura original.'
    );
  }
  if (isEncrypted) {
    warnings.push(
      'Documento PDF possui dicionário de criptografia (/Encrypt).'
    );
  }

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

  // Editable overlay layer starts clean (no unrequested fake demo text stamped on flat PDFs — SIT-1)
  layers.push({
    id: 'anotacoes',
    name: 'Camada Editável sobre o PDF',
    locked: false,
    items: [],
  });

  const pagesArray = Array.from({ length: Math.max(1, params.pageCount) }, (_, i) => i + 1);

  // Resolve rotation and physical dimensions (C1, H8)
  const inferredRotation =
    params.rotation ??
    fields.find((f) => typeof f.pageRotation === 'number' && f.pageRotation !== 0)?.pageRotation ??
    0;
  const normRot = ((inferredRotation % 360) + 360) % 360;
  const rawW = params.widthMm ?? 210;
  const rawH = params.heightMm ?? 297;
  const effectiveW = normRot === 90 || normRot === 270 ? Math.max(rawW, rawH) : rawW;
  const effectiveH = normRot === 90 || normRot === 270 ? Math.min(rawW, rawH) : rawH;
  const detectedFormat = detectPageFormatFromMm(effectiveW, effectiveH);

  const doc: SdocDocument = {
    sdoc: 1,
    name: params.name || 'PDF Importado',
    page: {
      format: detectedFormat.format,
      orientation: detectedFormat.orientation,
      unit: 'mm',
      widthMm: Number(effectiveW.toFixed(2)),
      heightMm: Number(effectiveH.toFixed(2)),
    },
    ...(params.pages && params.pages.length > 0 ? { pages: params.pages } : {}),
    fonts: {
      body: { family: 'Helvetica' },
    },
    underlay: {
      source: params.sha256,
      pages: pagesArray,
      mode: effectiveMode,
      ...(isXfa ? { isXfa: true } : {}),
      ...(hasSignature ? { hasSignature: true } : {}),
      ...(isEncrypted ? { isEncrypted: true } : {}),
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
      ...(isXfa ? { isXfa: true } : {}),
      ...(hasSignature ? { hasSignature: true } : {}),
      ...(isEncrypted ? { isEncrypted: true } : {}),
      warnings,
    },
  };
}
