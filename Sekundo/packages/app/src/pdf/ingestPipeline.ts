/**
 * Sekundo — Streaming PDF-to-YAML Ingestion Pipeline (`ingestPipeline.ts`)
 *
 * Implements Phase F4 + R1/R2 ("Suba seu PDF e veja o YAML nascer"):
 * An `AsyncGenerator` that processes an uploaded PDF binary stage by stage,
 * extracting exact per-page geometry, rotation, XFA/Signature metadata,
 * AcroForm widgets across all pages, text blocks, and vector lines/tables.
 */

import {
  computeTemplateFingerprintSha256,
  inspectPDFForm,
  inspectPDFSecurityAndXfa,
  extractAcroFormStage,
  extractTextStage,
  extractVectorStage,
  synthesizeIngestedSdoc,
  ptToMm,
  type FlatRegistry,
  type IngestReport,
  type RawPdfTextItem,
  type RawPdfVectorOp,
  type SdocDocument,
  type SdocField,
  type SdocPageGeometry,
} from '@sekundo/core';
import { saveBlob } from '../storage/localStorage';
import { loadPdfJsLocalFirst } from './pdfjsLoader';

export interface IngestProgressEvent {
  stage: 'underlay' | 'acroform' | 'text' | 'vectors' | 'complete';
  stageLabel: string;
  yaml: string;
  doc: SdocDocument;
  sha256: string;
  report: IngestReport;
}

/**
 * Extracts vector rectangle/line operators from a PDF.js operator list (`getOperatorList()`).
 */
type Mat2D = [number, number, number, number, number, number];

function multiplyMat2D(m1: Mat2D, m2: Mat2D): Mat2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMat2D(m: Mat2D, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

/**
 * Extracts vector rectangle/line operators from a PDF.js operator list (`getOperatorList()`).
 * Supports both legacy PDF.js (`args = [[subOps], [coords]]`) and PDF.js 5.x (`args = [opCode, [Float32Array], minMax]`)
 * while tracking the graphics state CTM (`save`, `restore`, `transform`).
 */
export function extractVectorsFromOperatorList(
  opList: { fnArray: number[]; argsArray: any[] },
  opsMap: Record<string, number>,
  pageNum: number
): RawPdfVectorOp[] {
  const result: RawPdfVectorOp[] = [];
  const fnArray = opList?.fnArray || [];
  const argsArray = opList?.argsArray || [];

  const OPS_SAVE = opsMap?.save ?? 10;
  const OPS_RESTORE = opsMap?.restore ?? 11;
  const OPS_TRANSFORM = opsMap?.transform ?? 12;
  const OPS_MOVE_TO = opsMap?.moveTo ?? 13;
  const OPS_LINE_TO = opsMap?.lineTo ?? 14;
  const OPS_RECTANGLE = opsMap?.rectangle ?? 19;
  const OPS_CONSTRUCT_PATH = opsMap?.constructPath ?? 91;

  let ctm: Mat2D = [1, 0, 0, 1, 0, 0];
  const ctmStack: Mat2D[] = [];
  let curX = 0;
  let curY = 0;

  const pushTransformedRect = (rx: number, ry: number, rw: number, rh: number) => {
    const p1 = applyMat2D(ctm, rx, ry);
    const p2 = applyMat2D(ctm, rx + rw, ry + rh);
    const minX = Math.min(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const wPt = Math.abs(p2.x - p1.x);
    const hPt = Math.abs(p2.y - p1.y);
    if (wPt > 0.5 || hPt > 0.5) {
      result.push({
        type: 'rect',
        xPt: minX,
        yPt: minY,
        wPt,
        hPt,
        lineWidthPt: 0.5,
        stroke: '#0F172A',
        page: pageNum,
      });
    }
  };

  const pushTransformedLine = (x1: number, y1: number, x2: number, y2: number) => {
    const p1 = applyMat2D(ctm, x1, y1);
    const p2 = applyMat2D(ctm, x2, y2);
    if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.5) {
      result.push({
        type: 'line',
        xPt: p1.x,
        yPt: p1.y,
        x2Pt: p2.x,
        y2Pt: p2.y,
        lineWidthPt: 0.5,
        stroke: '#0F172A',
        page: pageNum,
      });
    }
  };

  // Legacy PDF.js sub-operator handler
  const processLegacyPathOp = (op: number, coords: number[], offset: { idx: number }) => {
    if (op === OPS_MOVE_TO) {
      curX = Number(coords[offset.idx++] || 0);
      curY = Number(coords[offset.idx++] || 0);
    } else if (op === OPS_LINE_TO) {
      const nx = Number(coords[offset.idx++] || 0);
      const ny = Number(coords[offset.idx++] || 0);
      pushTransformedLine(curX, curY, nx, ny);
      curX = nx;
      curY = ny;
    } else if (op === OPS_RECTANGLE) {
      const rx = Number(coords[offset.idx++] || 0);
      const ry = Number(coords[offset.idx++] || 0);
      const rw = Number(coords[offset.idx++] || 0);
      const rh = Number(coords[offset.idx++] || 0);
      pushTransformedRect(rx, ry, rw, rh);
    }
  };

  // PDF.js 5.x packed DrawOPS buffer handler (0=moveTo, 1=lineTo, 2=curveTo, 3=curveTo2, 4=curveTo3, 5=closePath)
  const processPackedDrawOps = (buf: ArrayLike<number>) => {
    // Check if the buffer is a single closed 4-vertex rectangle: [0, x0,y0, 1, x1,y1, 1, x2,y2, 1, x3,y3, 5]
    if (
      buf.length === 13 &&
      buf[0] === 0 &&
      buf[3] === 1 &&
      buf[6] === 1 &&
      buf[9] === 1 &&
      buf[12] === 5
    ) {
      const xs = [Number(buf[1]), Number(buf[4]), Number(buf[7]), Number(buf[10])];
      const ys = [Number(buf[2]), Number(buf[5]), Number(buf[8]), Number(buf[11])];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      pushTransformedRect(minX, minY, maxX - minX, maxY - minY);
      return;
    }

    let j = 0;
    let startX = 0;
    let startY = 0;
    while (j < buf.length) {
      const drawOp = buf[j++];
      if (drawOp === 0) {
        curX = Number(buf[j++] || 0);
        curY = Number(buf[j++] || 0);
        startX = curX;
        startY = curY;
      } else if (drawOp === 1) {
        const nx = Number(buf[j++] || 0);
        const ny = Number(buf[j++] || 0);
        pushTransformedLine(curX, curY, nx, ny);
        curX = nx;
        curY = ny;
      } else if (drawOp === 2) {
        j += 4;
        curX = Number(buf[j++] || 0);
        curY = Number(buf[j++] || 0);
      } else if (drawOp === 3 || drawOp === 4) {
        j += 2;
        curX = Number(buf[j++] || 0);
        curY = Number(buf[j++] || 0);
      } else if (drawOp === 5) {
        if (Math.hypot(startX - curX, startY - curY) > 0.5) {
          pushTransformedLine(curX, curY, startX, startY);
        }
        curX = startX;
        curY = startY;
      } else {
        break;
      }
    }
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] || [];

    if (fn === OPS_SAVE) {
      ctmStack.push([...ctm] as Mat2D);
    } else if (fn === OPS_RESTORE) {
      const prev = ctmStack.pop();
      if (prev) ctm = prev;
    } else if (fn === OPS_TRANSFORM && args.length >= 6) {
      const m: Mat2D = [
        Number(args[0] ?? 1),
        Number(args[1] ?? 0),
        Number(args[2] ?? 0),
        Number(args[3] ?? 1),
        Number(args[4] ?? 0),
        Number(args[5] ?? 0),
      ];
      ctm = multiplyMat2D(ctm, m);
    } else if (fn === OPS_RECTANGLE && args.length >= 4) {
      pushTransformedRect(
        Number(args[0] || 0),
        Number(args[1] || 0),
        Number(args[2] || 0),
        Number(args[3] || 0)
      );
    } else if (fn === OPS_CONSTRUCT_PATH) {
      if (Array.isArray(args[0]) && Array.isArray(args[1])) {
        const subOps = args[0] as number[];
        const coords = args[1] as number[];
        const offset = { idx: 0 };
        for (const subOp of subOps) {
          processLegacyPathOp(subOp, coords, offset);
        }
      } else if (Array.isArray(args[1]) && args[1][0] && typeof args[1][0].length === 'number') {
        processPackedDrawOps(args[1][0] as ArrayLike<number>);
      } else if (args[0] && typeof args[0].length === 'number' && !Array.isArray(args[0])) {
        processPackedDrawOps(args[0] as ArrayLike<number>);
      }
    }
  }

  return result;
}

/**
 * Streams progressive YAML synthesis stages from a user-uploaded PDF (`Uint8Array`).
 */
export async function* streamPdfToSdocIngestion(
  pdfBytes: Uint8Array,
  fileName: string,
  mode: 'overlay' | 'rebuild' = 'overlay',
  sampleRegistry: FlatRegistry = []
): AsyncGenerator<IngestProgressEvent, void, unknown> {
  const cleanName = fileName.replace(/\.pdf$/i, '') || 'Formulario_Importado';

  // Stage 0: Compute real SHA-256 & store binary in blob_store
  const sha256 = await computeTemplateFingerprintSha256(pdfBytes);
  await saveBlob(sha256, pdfBytes);

  let pageCount = 1;
  let pageWidthMm = 210;
  let pageHeightMm = 297;
  let pageRotation = 0;
  const pagesGeometry: SdocPageGeometry[] = [];

  const securityMeta = await inspectPDFSecurityAndXfa(pdfBytes);

  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pdfPages = pdfDoc.getPages();
    pageCount = Math.max(1, pdfPages.length);

    pdfPages.forEach((p, idx) => {
      const sz = p.getSize();
      const rot = (p.getRotation()?.angle ?? 0) % 360;
      const rawW = Number(ptToMm(sz.width).toFixed(2));
      const rawH = Number(ptToMm(sz.height).toFixed(2));
      const effW = rot === 90 || rot === 270 ? rawH : rawW;
      const effH = rot === 90 || rot === 270 ? rawW : rawH;

      pagesGeometry.push({
        widthMm: effW,
        heightMm: effH,
        ...(rot ? { rotate: rot } : {}),
      });

      if (idx === 0) {
        pageWidthMm = rawW;
        pageHeightMm = rawH;
        pageRotation = rot;
      }
    });
  } catch (err: any) {
    if (securityMeta.isEncrypted) {
      throw new Error('PDF protegido por senha/criptografia. Desbloqueie o arquivo antes de importar.');
    }
    throw new Error(`Arquivo PDF inválido ou corrompido: ${err?.message ?? err}`);
  }

  const stage0 = synthesizeIngestedSdoc({
    name: cleanName,
    sha256,
    mode,
    pageCount,
    widthMm: pageWidthMm,
    heightMm: pageHeightMm,
    rotation: pageRotation,
    pages: pagesGeometry,
    isXfa: securityMeta.isXfa,
    hasSignature: securityMeta.hasSignature,
    isEncrypted: securityMeta.isEncrypted,
  });

  yield {
    stage: 'underlay',
    stageLabel: `Estágio 0: Camada Base (${stage0.doc.page.widthMm}×${stage0.doc.page.heightMm}mm, ${pageCount} pág.)`,
    yaml: stage0.yaml,
    doc: stage0.doc,
    sha256,
    report: stage0.report,
  };

  // Stage 1: Inspect AcroForm interactive fields across all pages
  let fields: SdocField[] = [];
  try {
    const rawFields = await inspectPDFForm(pdfBytes);
    fields = extractAcroFormStage(rawFields, pageHeightMm, sampleRegistry, pageWidthMm);
  } catch {
    fields = [];
  }

  const stage1 = synthesizeIngestedSdoc({
    name: cleanName,
    sha256,
    mode,
    pageCount,
    widthMm: pageWidthMm,
    heightMm: pageHeightMm,
    rotation: pageRotation,
    pages: pagesGeometry,
    fields,
    isXfa: securityMeta.isXfa,
    hasSignature: securityMeta.hasSignature,
    isEncrypted: securityMeta.isEncrypted,
  });

  yield {
    stage: 'acroform',
    stageLabel: `Estágio 1: ${fields.length} campo(s) AcroForm detectado(s)`,
    yaml: stage1.yaml,
    doc: stage1.doc,
    sha256,
    report: stage1.report,
  };

  // Stages 2, 3, 4: Extract Text & Vectors across ALL pages via PDF.js
  const rawTextItems: RawPdfTextItem[] = [];
  const rawVectorOps: RawPdfVectorOp[] = [];

  try {
    const pdfjsLib = await loadPdfJsLocalFirst();
    if (pdfjsLib) {
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
      const pdfProxy = await loadingTask.promise;
      const totalPages = Math.min(pdfProxy.numPages || pageCount, 50);

      for (let pNum = 1; pNum <= totalPages; pNum++) {
        const page = await pdfProxy.getPage(pNum);
        const textContent = await page.getTextContent();

        for (const item of textContent.items || []) {
          if (item && typeof item.str === 'string' && item.str.trim() !== '') {
            const tx = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 20, 750];
            const fontHeightPt = Math.hypot(tx[2] || 0, tx[3] || 10) || 10;
            rawTextItems.push({
              str: item.str,
              xPt: Number(tx[4] || 0),
              yPt: Number(tx[5] || 0),
              widthPt: Number(item.width || item.str.length * fontHeightPt * 0.5),
              heightPt: Number(item.height || fontHeightPt),
              fontName: item.fontName,
              page: pNum,
            });
          }
        }

        if (typeof page.getOperatorList === 'function') {
          const opList = await page.getOperatorList();
          const vecOps = extractVectorsFromOperatorList(opList, pdfjsLib.OPS || {}, pNum);
          rawVectorOps.push(...vecOps);
        }
      }
    }
  } catch {
    // Non-fatal if pdf.js text/vector extraction is unavailable
  }

  const textPrimitives = extractTextStage(rawTextItems, pageHeightMm);
  if (mode === 'rebuild' && textPrimitives.length > 0) {
    const stage2 = synthesizeIngestedSdoc({
      name: cleanName,
      sha256,
      mode,
      pageCount,
      widthMm: pageWidthMm,
      heightMm: pageHeightMm,
      rotation: pageRotation,
      pages: pagesGeometry,
      fields,
      textItems: textPrimitives,
      isXfa: securityMeta.isXfa,
      hasSignature: securityMeta.hasSignature,
      isEncrypted: securityMeta.isEncrypted,
    });
    yield {
      stage: 'text',
      stageLabel: `Estágio 2: ${textPrimitives.length} bloco(s) de texto extraído(s)`,
      yaml: stage2.yaml,
      doc: stage2.doc,
      sha256,
      report: stage2.report,
    };
  }

  const vectorPrimitives = extractVectorStage(rawVectorOps, pageHeightMm);
  const finalResult = synthesizeIngestedSdoc({
    name: cleanName,
    sha256,
    mode,
    pageCount,
    widthMm: pageWidthMm,
    heightMm: pageHeightMm,
    rotation: pageRotation,
    pages: pagesGeometry,
    fields,
    textItems: textPrimitives,
    vectorItems: vectorPrimitives,
    isXfa: securityMeta.isXfa,
    hasSignature: securityMeta.hasSignature,
    isEncrypted: securityMeta.isEncrypted,
  });

  yield {
    stage: 'complete',
    stageLabel: `Concluído (${finalResult.report.mode.toUpperCase()}): ${finalResult.report.fieldsCount} campos, ${finalResult.report.textCount} textos, ${finalResult.report.tableCount} tabelas`,
    yaml: finalResult.yaml,
    doc: finalResult.doc,
    sha256,
    report: finalResult.report,
  };
}
