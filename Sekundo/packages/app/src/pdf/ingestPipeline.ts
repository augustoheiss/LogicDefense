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
function extractVectorsFromOperatorList(
  opList: { fnArray: number[]; argsArray: any[] },
  opsMap: Record<string, number>,
  pageNum: number
): RawPdfVectorOp[] {
  const result: RawPdfVectorOp[] = [];
  const fnArray = opList?.fnArray || [];
  const argsArray = opList?.argsArray || [];

  const OPS_RECTANGLE = opsMap?.rectangle ?? 19;
  const OPS_CONSTRUCT_PATH = opsMap?.constructPath ?? 91;
  const OPS_MOVE_TO = opsMap?.moveTo ?? 13;
  const OPS_LINE_TO = opsMap?.lineTo ?? 14;

  let curX = 0;
  let curY = 0;

  const processPathOp = (op: number, coords: number[], offset: { idx: number }) => {
    if (op === OPS_MOVE_TO) {
      curX = Number(coords[offset.idx++] || 0);
      curY = Number(coords[offset.idx++] || 0);
    } else if (op === OPS_LINE_TO) {
      const nx = Number(coords[offset.idx++] || 0);
      const ny = Number(coords[offset.idx++] || 0);
      result.push({
        type: 'line',
        xPt: curX,
        yPt: curY,
        x2Pt: nx,
        y2Pt: ny,
        lineWidthPt: 0.5,
        stroke: '#0F172A',
        page: pageNum,
      });
      curX = nx;
      curY = ny;
    } else if (op === OPS_RECTANGLE) {
      const rx = Number(coords[offset.idx++] || 0);
      const ry = Number(coords[offset.idx++] || 0);
      const rw = Number(coords[offset.idx++] || 0);
      const rh = Number(coords[offset.idx++] || 0);
      if (Math.abs(rw) > 1 && Math.abs(rh) > 1) {
        result.push({
          type: 'rect',
          xPt: rx,
          yPt: ry,
          wPt: rw,
          hPt: rh,
          lineWidthPt: 0.5,
          stroke: '#0F172A',
          page: pageNum,
        });
      }
    }
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] || [];
    if (fn === OPS_RECTANGLE && args.length >= 4) {
      result.push({
        type: 'rect',
        xPt: Number(args[0] || 0),
        yPt: Number(args[1] || 0),
        wPt: Number(args[2] || 0),
        hPt: Number(args[3] || 0),
        lineWidthPt: 0.5,
        stroke: '#0F172A',
        page: pageNum,
      });
    } else if (fn === OPS_CONSTRUCT_PATH && Array.isArray(args[0]) && Array.isArray(args[1])) {
      const subOps = args[0] as number[];
      const coords = args[1] as number[];
      const offset = { idx: 0 };
      for (const subOp of subOps) {
        processPathOp(subOp, coords, offset);
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
