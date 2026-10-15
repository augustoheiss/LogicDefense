/**
 * Sekundo — Streaming PDF-to-YAML Ingestion Pipeline (`ingestPipeline.ts`)
 *
 * Implements Phase F4 ("Suba seu PDF e veja o YAML nascer"):
 * An `AsyncGenerator` that processes an uploaded PDF binary stage by stage,
 * yielding progressive `.sdoc.yaml` snapshots so the user watches the document
 * structure materialize live in the Studio editor and canvas!
 */

import {
  computeTemplateFingerprintSha256,
  inspectPDFForm,
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
 * Streams progressive YAML synthesis stages from a user-uploaded PDF (`Uint8Array`).
 */
export async function* streamPdfToSdocIngestion(
  pdfBytes: Uint8Array,
  fileName: string,
  mode: 'overlay' | 'rebuild' = 'overlay',
  sampleRegistry: FlatRegistry = []
): AsyncGenerator<IngestProgressEvent, void, unknown> {
  const cleanName = fileName.replace(/\.pdf$/i, '') || 'Formulario_Importado';

  // Stage 0: Compute real SHA-256 & store binary in IndexedDB blob_store
  const sha256 = await computeTemplateFingerprintSha256(pdfBytes);
  await saveBlob(sha256, pdfBytes);

  let pageCount = 1;
  let pageWidthMm = 210;
  let pageHeightMm = 297;

  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    pageCount = Math.max(1, pdfDoc.getPageCount());
    const firstPage = pdfDoc.getPages()[0];
    if (firstPage) {
      const sz = firstPage.getSize();
      pageWidthMm = Number(ptToMm(sz.width).toFixed(2));
      pageHeightMm = Number(ptToMm(sz.height).toFixed(2));
    }
  } catch {
    // Fallback to A4 defaults
  }

  const stage0 = synthesizeIngestedSdoc({
    name: cleanName,
    sha256,
    mode,
    pageCount,
    widthMm: pageWidthMm,
    heightMm: pageHeightMm,
  });

  yield {
    stage: 'underlay',
    stageLabel: `Estágio 0: Camada Base Vetorial (${sha256.slice(0, 18)}…)`,
    yaml: stage0.yaml,
    doc: stage0.doc,
    sha256,
    report: stage0.report,
  };

  // Stage 1: Inspect AcroForm interactive fields
  let fields: SdocField[] = [];
  try {
    const rawFields = await inspectPDFForm(pdfBytes);
    fields = extractAcroFormStage(rawFields, pageHeightMm, sampleRegistry);
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
    fields,
  });

  yield {
    stage: 'acroform',
    stageLabel: `Estágio 1: ${fields.length} campo(s) AcroForm detectado(s)`,
    yaml: stage1.yaml,
    doc: stage1.doc,
    sha256,
    report: stage1.report,
  };

  // Stages 2, 3, 4: Extract Text & Vectors via PDF.js if available
  const rawTextItems: RawPdfTextItem[] = [];
  const rawVectorOps: RawPdfVectorOp[] = [];

  try {
    const pdfjsLib = await loadPdfJsLocalFirst();
    if (pdfjsLib) {
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
      const pdfProxy = await loadingTask.promise;
      const page = await pdfProxy.getPage(1);
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
          });
        }
      }
    }
  } catch {
    // Non-fatal if pdf.js text extraction is unavailable
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
      fields,
      textItems: textPrimitives,
    });
    yield {
      stage: 'text',
      stageLabel: `Estágio 2: ${textPrimitives.length} bloco(s) de texto fundido(s)`,
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
    fields,
    textItems: textPrimitives,
    vectorItems: vectorPrimitives,
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
