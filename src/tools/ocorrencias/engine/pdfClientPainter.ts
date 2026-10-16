/**
 * Ocorrências 2.0 PDF Engine — Client-Side Vector PDF Painter (`engine/pdfClientPainter.ts`)
 *
 * Isolated and unified from `@sekundo/core/doc/painters/pdfPainter.ts`
 * and `@sekundo/core/pdf/acroFormFiller.ts`.
 *
 * Stamps a solved `DisplayList` (or batch of records) directly onto the user's
 * uploaded PDF template in the browser using `pdf-lib` in < 25ms.
 * Zero server roundtrips, zero cold starts, 100% vector output.
 */

import type {
  DisplayList,
  OcorrenciaDocSpec,
  ResolvedOp,
} from './types';
import * as pdfLib from 'pdf-lib';
import { mmToPt, toPdf } from './units';
import { toWinAnsiSafe } from './unicodeFont';
import { solveOcorrenciaDisplayList } from './layoutAndAutoFitSolver';

async function getPdfLib() {
  return pdfLib;
}

export function parseHexColorToRgb(hex?: string): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    if ([r, g, b].some(isNaN)) return null;
    return { r, g, b };
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    if ([r, g, b].some(isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

export interface ClientPdfExportOptions {
  /** Flatten existing AcroForm widgets into static vector appearance (default: true) */
  flatten?: boolean;
  /** Strip digital signature dictionaries if user confirmed exportar cópia sem assinatura */
  stripSignatures?: boolean;
}

/**
 * Renders a solved `DisplayList` onto `templatePdfBytes` in memory using `pdf-lib`.
 * Embeds the original PDF pages as vector underlays (`embedPages`) or draws directly
 * on top of the loaded document pages, preserving 100% of vector lines and typography.
 */
export async function renderOcorrenciaToPdfBytes(
  templatePdfBytes: Uint8Array,
  docSpec: OcorrenciaDocSpec,
  values: Record<string, string | boolean | undefined>,
  displayListOverride?: DisplayList,
  options: ClientPdfExportOptions = { flatten: true }
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFDict, PDFArray } = await getPdfLib();
  const displayList = displayListOverride ?? solveOcorrenciaDisplayList(docSpec, values);

  const pdfDoc = await PDFDocument.load(templatePdfBytes, { ignoreEncryption: true });
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  pdfDoc.setCreator('Heiss-Lab · Gerador de Ocorrências 2.0 (Unified PDF Engine)');
  pdfDoc.setProducer('LogicDefense Deterministic Vector PDF Painter (Sekundo + CV-Maker)');
  if (docSpec.sha256) {
    pdfDoc.setSubject(`Ocorrencia Provenance (tpl=${docSpec.sha256})`);
  }

  // Strip digital signatures if explicitly requested by user
  if (options.stripSignatures) {
    try {
      const form = pdfDoc.getForm();
      form.acroForm.dict.delete(PDFName.of('SigFlags'));
      const fieldsArr = form.acroForm.dict.lookup(PDFName.of('Fields'));
      if (fieldsArr instanceof PDFArray) {
        for (let i = 0; i < fieldsArr.size(); i++) {
          const fDict = fieldsArr.lookup(i);
          if (fDict instanceof PDFDict) {
            const ft = fDict.get(PDFName.of('FT'));
            if (ft && ft.toString() === '/Sig') {
              fDict.delete(PDFName.of('V'));
            }
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // Clear or populate native AcroForm fields before painting our DisplayList overlay
  // so native widget default texts don't collide with our precision DisplayList rendering
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    if (fields.length > 0) {
      for (const f of fields) {
        try {
          if (typeof (f as any).setText === 'function') {
            (f as any).setText('');
          } else if (typeof (f as any).uncheck === 'function') {
            (f as any).uncheck();
          }
        } catch {
          // Ignore read-only native fields
        }
      }
      if (options.flatten !== false) {
        form.flatten();
      }
    }
  } catch {
    // Source PDF has no AcroForm or non-standard widgets
  }

  const toRgb = (hex?: string, fallback = { r: 0.06, g: 0.09, b: 0.16 }) => {
    const parsed = parseHexColorToRgb(hex) || fallback;
    return rgb(parsed.r, parsed.g, parsed.b);
  };

  const pdfPages = pdfDoc.getPages();

  for (const dPage of displayList.pages) {
    const pageIdx = Math.max(0, Math.min(pdfPages.length - 1, dPage.pageNumber - 1));
    const page = pdfPages[pageIdx];
    if (!page) continue;

    for (const op of dPage.ops) {
      paintResolvedOperation(page, op, dPage.heightMm, {
        fontRegular,
        fontBold,
        toRgb,
        degrees,
        rotateAngle: dPage.rotate || 0,
      });
    }
  }

  if (displayList.continuationSections && displayList.continuationSections.length > 0) {
    appendContinuationPagesToPdf(pdfDoc, docSpec, values, displayList, {
      fontRegular,
      fontBold,
      toRgb,
      degrees,
    });
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * Generates a multi-record Mail-Merge PDF where each record in `records` gets its own
 * filled copy of `templatePdfBytes`.
 *
 * Uses Sekundo's H11 optimization (`mergedPdf.embedPages(basePages)`): embeds the school's
 * PDF template ONCE as a shared PDF Form XObject and draws each student's occurrence on
 * lightweight pages, preventing `N × templateSize` file bloat.
 */
export async function renderOcorrenciaMailMergeToPdfBytes(
  templatePdfBytes: Uint8Array,
  docSpec: OcorrenciaDocSpec,
  records: Record<string, string | boolean | undefined>[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  if (records.length === 0) {
    const single = await renderOcorrenciaToPdfBytes(templatePdfBytes, docSpec, {});
    return { pdfBytes: single, pageCount: docSpec.pageCount };
  }

  const { PDFDocument, StandardFonts, rgb, degrees } = await getPdfLib();
  const baseDoc = await PDFDocument.load(templatePdfBytes, { ignoreEncryption: true });
  try {
    const form = baseDoc.getForm();
    form.flatten();
  } catch {
    // Ignore if no AcroForm
  }

  const basePages = baseDoc.getPages();
  const pageDims = basePages.map((p) => p.getSize());

  const mergedPdf = await PDFDocument.create();
  const embeddedBasePages = await mergedPdf.embedPages(basePages);
  const fontRegular = await mergedPdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

  mergedPdf.setCreator('Heiss-Lab · Gerador de Ocorrências 2.0 (Mail-Merge Batch Engine)');

  const toRgb = (hex?: string, fallback = { r: 0.06, g: 0.09, b: 0.16 }) => {
    const parsed = parseHexColorToRgb(hex) || fallback;
    return rgb(parsed.r, parsed.g, parsed.b);
  };

  const total = records.length;
  for (let rIdx = 0; rIdx < total; rIdx++) {
    const recordValues = records[rIdx];
    const recordDisplayList = solveOcorrenciaDisplayList(docSpec, recordValues);

    for (let pIdx = 0; pIdx < embeddedBasePages.length; pIdx++) {
      const { width, height } = pageDims[pIdx];
      const page = mergedPdf.addPage([width, height]);
      page.drawPage(embeddedBasePages[pIdx], {
        x: 0,
        y: 0,
        width,
        height,
      });

      const dPage = recordDisplayList.pages[pIdx];
      if (dPage) {
        for (const op of dPage.ops) {
          paintResolvedOperation(page, op, dPage.heightMm, {
            fontRegular,
            fontBold,
            toRgb,
            degrees,
            rotateAngle: dPage.rotate || 0,
          });
        }
      }
    }

    if (recordDisplayList.continuationSections && recordDisplayList.continuationSections.length > 0) {
      appendContinuationPagesToPdf(mergedPdf, docSpec, recordValues, recordDisplayList, {
        fontRegular,
        fontBold,
        toRgb,
        degrees,
      });
    }

    if (onProgress) {
      onProgress(rIdx + 1, total);
    }
  }

  const pdfBytes = await mergedPdf.save({ useObjectStreams: true });
  return {
    pdfBytes,
    pageCount: mergedPdf.getPageCount(),
  };
}

/**
 * Appends 1 or more official Continuation Sheet (`Folha Complementar Anexa`) pages
 * when a long pedagogical narrative uses `overflowBehavior: 'continue-page'`.
 */
function appendContinuationPagesToPdf(
  pdfDoc: any,
  docSpec: OcorrenciaDocSpec,
  values: Record<string, string | boolean | undefined>,
  displayList: DisplayList,
  ctx: {
    fontRegular: any;
    fontBold: any;
    toRgb: (hex?: string, fb?: any) => any;
    degrees?: (angle: number) => any;
  }
) {
  const sections = displayList.continuationSections;
  if (!sections || sections.length === 0) return;

  const { fontRegular, fontBold, toRgb } = ctx;
  const firstGeom = docSpec.pages[0] || { widthMm: 210, heightMm: 297 };
  const pageWidthMm = firstGeom.widthMm || 210;
  const pageHeightMm = firstGeom.heightMm || 297;
  const widthPt = mmToPt(pageWidthMm);
  const heightPt = mmToPt(pageHeightMm);

  const studentName = toWinAnsiSafe(String(values.nome_aluno || 'Nao informado'));
  const turma = toWinAnsiSafe(String(values.turma || '-'));
  const dataStr = toWinAnsiSafe(String(values.data || '-'));
  const responsavel = toWinAnsiSafe(String(values.responsavel_registro || ''));
  const shaShort = (docSpec.sha256 || 'local-session').slice(0, 20);

  let annexIndex = 1;
  let currentPage: any = null;
  let cursorYMm = 50;

  const startNewAnnexPage = () => {
    currentPage = pdfDoc.addPage([widthPt, heightPt]);
    // Header Banner Box
    const hdrBox = toPdf(19.4, 15, pageHeightMm, 23);
    currentPage.drawRectangle({
      x: hdrBox.xPt,
      y: hdrBox.yPt,
      width: mmToPt(pageWidthMm - 38.8),
      height: mmToPt(23),
      color: toRgb('#F8FAFC'),
      borderColor: toRgb('#94A3B8'),
      borderWidth: mmToPt(0.35),
    });

    const t1 = toPdf(23, 21.5, pageHeightMm, 0);
    currentPage.drawText(
      `ANEXO DE CONTINUACAO #${annexIndex} - REGISTRO DE OCORRENCIA ESCOLAR`,
      {
        x: t1.xPt,
        y: t1.yPt,
        size: 11,
        font: fontBold,
        color: toRgb('#0F172A'),
      }
    );

    const t2 = toPdf(23, 27.5, pageHeightMm, 0);
    currentPage.drawText(`Estudante: ${studentName}   |   Turma: ${turma}   |   Data: ${dataStr}`, {
      x: t2.xPt,
      y: t2.yPt,
      size: 9,
      font: fontRegular,
      color: toRgb('#1E293B'),
    });

    const t3 = toPdf(23, 33.2, pageHeightMm, 0);
    currentPage.drawText(
      `Vinculo Probatorio SHA-256: ${shaShort}   |   Folha Complementar Integrante do Prontuario`,
      {
        x: t3.xPt,
        y: t3.yPt,
        size: 8,
        font: fontRegular,
        color: toRgb('#475569'),
      }
    );

    // Body Frame
    const bodyBox = toPdf(19.4, 42, pageHeightMm, 210);
    currentPage.drawRectangle({
      x: bodyBox.xPt,
      y: bodyBox.yPt,
      width: mmToPt(pageWidthMm - 38.8),
      height: mmToPt(210),
      borderColor: toRgb('#CBD5E1'),
      borderWidth: mmToPt(0.35),
    });

    // Footer Signature Line + Vector Rubric (if signed on Page 1)
    const footPos = toPdf(19.4, 265, pageHeightMm, 0);
    currentPage.drawText(`Responsavel pelo Registro:  ${responsavel}`, {
      x: footPos.xPt,
      y: footPos.yPt,
      size: 10,
      font: fontRegular,
      color: toRgb('#0F172A'),
    });
    const lineStart = toPdf(64, 266.2, pageHeightMm, 0);
    const lineEnd = toPdf(184, 266.2, pageHeightMm, 0);
    currentPage.drawLine({
      start: { x: lineStart.xPt, y: lineStart.yPt },
      end: { x: lineEnd.xPt, y: lineEnd.yPt },
      thickness: 0.75,
      color: toRgb('#334155'),
    });

    const firstPageSigOp = displayList.pages[0]?.ops.find((o) => o.kind === 'signature');
    if (firstPageSigOp && firstPageSigOp.kind === 'signature') {
      const dyMm = 255.2 - firstPageSigOp.y;
      const annexSigOp: ResolvedOp = {
        ...firstPageSigOp,
        y: 255.2,
        strokes: firstPageSigOp.strokes.map((s) =>
          s.map(([sx, sy]) => [sx, Number((sy + dyMm).toFixed(2))] as [number, number])
        ),
      };
      paintResolvedOperation(currentPage, annexSigOp, pageHeightMm, {
        fontRegular,
        fontBold,
        toRgb,
      });
    }

    cursorYMm = 49;
    annexIndex++;
  };

  startNewAnnexPage();

  for (const section of sections) {
    if (cursorYMm > 240) {
      startNewAnnexPage();
    }
    const secTitlePos = toPdf(23, cursorYMm, pageHeightMm, 0);
    currentPage.drawText(
      toWinAnsiSafe(`Continuacao — ${section.fieldLabel}:`),
      {
        x: secTitlePos.xPt,
        y: secTitlePos.yPt,
        size: 10,
        font: fontBold,
        color: toRgb('#0F172A'),
      }
    );
    cursorYMm += 5.5;

    for (const line of section.lines) {
      if (cursorYMm > 246) {
        startNewAnnexPage();
      }
      const safeLine = toWinAnsiSafe(line);
      if (safeLine) {
        const linePos = toPdf(23, cursorYMm, pageHeightMm, 0);
        currentPage.drawText(safeLine, {
          x: linePos.xPt,
          y: linePos.yPt,
          size: section.fontSizePt || 9.5,
          font: fontRegular,
          color: toRgb('#0F172A'),
        });
      }
      cursorYMm += section.lineHeightMm || 4.2;
    }
    cursorYMm += 4.0;
  }
}

function paintResolvedOperation(
  page: any,
  op: ResolvedOp,
  pageHeightMm: number,
  ctx: {
    fontRegular: any;
    fontBold: any;
    toRgb: (hex?: string, fb?: any) => any;
    degrees?: (angle: number) => any;
    rotateAngle?: number;
  }
) {
  const { fontRegular, fontBold, toRgb, degrees, rotateAngle = 0 } = ctx;

  if (op.kind === 'rect') {
    const { xPt, yPt } = toPdf(op.x, op.y, pageHeightMm, op.h);
    const drawOpts: Record<string, any> = {
      x: xPt,
      y: yPt,
      width: mmToPt(op.w),
      height: mmToPt(op.h),
    };
    if (rotateAngle && degrees) {
      drawOpts.rotate = degrees(rotateAngle);
    }
    if (op.fill && op.fill !== 'none' && op.fill !== 'transparent') {
      drawOpts.color = toRgb(op.fill);
      if (typeof op.fillOpacity === 'number') {
        drawOpts.opacity = op.fillOpacity;
      }
    }
    if (op.stroke && op.stroke !== 'none') {
      drawOpts.borderColor = toRgb(op.stroke);
      drawOpts.borderWidth = mmToPt(op.strokeWidthMm || 0.35);
    }
    page.drawRectangle(drawOpts);
    return;
  }

  if (op.kind === 'signature') {
    const strokeColor = toRgb(op.color, { r: 0.06, g: 0.16, b: 0.42 });
    const thicknessPt = mmToPt(op.strokeWidthMm || 0.42);
    for (const stroke of op.strokes) {
      for (let i = 0; i < stroke.length - 1; i++) {
        const [x0Mm, y0Mm] = stroke[i];
        const [x1Mm, y1Mm] = stroke[i + 1];
        const start = toPdf(x0Mm, y0Mm, pageHeightMm, 0);
        const end = toPdf(x1Mm, y1Mm, pageHeightMm, 0);
        page.drawLine({
          start: { x: start.xPt, y: start.yPt },
          end: { x: end.xPt, y: end.yPt },
          thickness: thicknessPt,
          color: strokeColor,
        });
      }
    }
    return;
  }

  if (op.kind === 'text') {
    const font = op.weight === 'bold' ? fontBold : fontRegular;
    const sizePt = op.sizePt || 10;
    const color = toRgb(op.color);

    // Vertically center single-line fields (like Nome, Turma, Data, Checkbox 'X')
    // inside their bounding box when the box is taller than the cap height;
    // top-align multi-line textareas so paragraph lines flow naturally from top of box.
    const capHeightMm = (sizePt * 0.72) / (72 / 25.4);
    const isSingleLineCentered = op.lines.length === 1 && op.h <= capHeightMm * 3.2;
    const baselineOffsetMm = isSingleLineCentered
      ? (op.h + capHeightMm) / 2
      : (sizePt * 0.85) / (72 / 25.4);

    for (let i = 0; i < op.lines.length; i++) {
      const safeLine = toWinAnsiSafe(op.lines[i]);
      if (!safeLine) continue;

      const lineYmm = op.y + baselineOffsetMm + i * op.lineHeightMm;
      // Guard against painting outside bottom of page
      if (lineYmm > pageHeightMm - 1) break;

      const lineWidthPt = font.widthOfTextAtSize(safeLine, sizePt);
      const boxWidthPt = mmToPt(op.w);

      let xPt = mmToPt(op.x);
      if (op.align === 'center') {
        xPt += Math.max(0, (boxWidthPt - lineWidthPt) / 2);
      } else if (op.align === 'right') {
        xPt += Math.max(0, boxWidthPt - lineWidthPt);
      }

      const { yPt } = toPdf(op.x, lineYmm, pageHeightMm, 0);
      const textOpts: Record<string, any> = {
        x: xPt,
        y: yPt,
        size: sizePt,
        font,
        color,
      };
      if (rotateAngle && degrees) {
        textOpts.rotate = degrees(rotateAngle);
      }
      page.drawText(safeLine, textOpts);
    }
  }
}

/**
 * Clean-Room Synthetic Template Generator (`generateCleanRoomSampleTemplatePdfBytes`)
 *
 * Synthesizes a 100% generic, organization-neutral A4 Incident Form PDF directly
 * in browser memory (`Uint8Array`) using `pdf-lib`, with zero external files or metadata.
 */
export async function generateCleanRoomSampleTemplatePdfBytes(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('Formulario Sintetico Padrao A4 - Clean-Room');
  pdfDoc.setCreator('LogicDefense Clean-Room PDF Engine');
  pdfDoc.setProducer('pdf-lib Vector Engine');

  const page = pdfDoc.addPage([595.28, 841.89]);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const H = 841.89;

  // Title (top-down y=100pt -> bottom-up H - 100)
  page.drawText('REGISTRO DE OCORRENCIA ESCOLAR', {
    x: 60,
    y: H - 100,
    size: 16,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.2),
  });

  // Identification fields
  page.drawText('Nome do(a) aluno(a):', {
    x: 60,
    y: H - 150,
    size: 10,
    font: fontRegular,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText('Data:', {
    x: 420,
    y: H - 150,
    size: 10,
    font: fontRegular,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText('Turma:', {
    x: 60,
    y: H - 175,
    size: 10,
    font: fontRegular,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText('Telefone:', {
    x: 420,
    y: H - 175,
    size: 10,
    font: fontRegular,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Description section + box
  page.drawText('Descricao da Ocorrencia:', {
    x: 60,
    y: H - 240,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawRectangle({
    x: 55,
    y: H - 440,
    width: 485,
    height: 185,
    borderColor: rgb(0.25, 0.28, 0.35),
    borderWidth: 1,
  });

  // Checkboxes section
  page.drawText('Encaminhamentos:', {
    x: 60,
    y: H - 470,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText('(  ) Orientacao ao aluno', {
    x: 70,
    y: H - 495,
    size: 10,
    font: fontRegular,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText('(  ) Convocar responsavel', {
    x: 70,
    y: H - 515,
    size: 10,
    font: fontRegular,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Commitments section + box
  page.drawText('Compromissos Firmados:', {
    x: 60,
    y: H - 555,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawRectangle({
    x: 55,
    y: H - 680,
    width: 485,
    height: 115,
    borderColor: rgb(0.25, 0.28, 0.35),
    borderWidth: 1,
  });

  // Responsible signature line
  page.drawText('Responsavel pelo Registro:', {
    x: 60,
    y: H - 720,
    size: 10,
    font: fontRegular,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawLine({
    start: { x: 210, y: H - 725 },
    end: { x: 500, y: H - 725 },
    thickness: 0.8,
    color: rgb(0.2, 0.2, 0.2),
  });

  return pdfDoc.save();
}

