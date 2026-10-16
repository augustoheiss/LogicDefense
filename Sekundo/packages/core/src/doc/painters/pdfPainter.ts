/**
 * Sekundo Document Engine — PDF Painter (`painters/pdfPainter.ts`)
 *
 * Renders a deterministic `DisplayList` (in millimeters, top-left origin) into a
 * binary PDF (`Uint8Array`) using `pdf-lib`.
 * - Single coordinate conversion via `toPdf(xMm, yMm, pageHeightMm, hMm)`.
 * - Sanitizes strings via `toWinAnsiSafe` so emojis never crash `StandardFonts.Helvetica`.
 * - Supports vector PDF underlays (`PDFDocument.embedPage`) for zero-loss user form overlays.
 */

import type { DisplayList, ResolvedOp } from '../types';
import { mmToPt, toPdf } from '../units';
import { sanitizeForWinAnsiWithWarnings } from '../../pdf/unicodeFont';

async function getPdfLib() {
  return await import('pdf-lib');
}

export class UnderlayError extends Error {
  public readonly code: 'UNDERLAY_MISSING' | 'UNDERLAY_CORRUPT';
  public readonly blobKey: string;
  constructor(code: 'UNDERLAY_MISSING' | 'UNDERLAY_CORRUPT', blobKey: string, message: string) {
    super(message);
    this.name = 'UnderlayError';
    this.code = code;
    this.blobKey = blobKey;
  }
}

/**
 * Strips or transliterates characters outside WinAnsi (Latin-1) so StandardFonts.Helvetica
 * never throws on emojis, curly quotes, or Cyrillic while keeping PT/ES/EN accents intact.
 */
export function toWinAnsiSafe(text: string): string {
  return sanitizeForWinAnsiWithWarnings(text || '').text.trim();
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

export interface PdfPainterOptions {
  /** Optional resolver for underlay PDF binaries (`sha256:...` -> `Uint8Array`) */
  blobs?: Record<string, Uint8Array>;
  /** Stamp `1/N` page numbers in the bottom right corner */
  stampPageNumbers?: boolean;
  /** Optional cryptographic provenance hashes embedded into PDF metadata (R4) */
  provenance?: {
    templateHash?: string;
    dataHash?: string;
  };
}

export async function renderDisplayListToPdf(
  displayList: DisplayList,
  options: PdfPainterOptions = {}
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await getPdfLib();
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  pdfDoc.setCreator('Sekundo Document Studio');
  pdfDoc.setProducer('Sekundo Deterministic PDF Painter');
  if (options.provenance?.templateHash || options.provenance?.dataHash) {
    const subjParts: string[] = [];
    if (options.provenance.templateHash) subjParts.push(`tpl=${options.provenance.templateHash}`);
    if (options.provenance.dataHash) subjParts.push(`data=${options.provenance.dataHash}`);
    pdfDoc.setSubject(`Sekundo Provenance (${subjParts.join(', ')})`);
    pdfDoc.setKeywords(subjParts);
  }

  const toRgb = (hex?: string, fallback = { r: 0.08, g: 0.08, b: 0.1 }) => {
    const parsed = parseHexColorToRgb(hex) || fallback;
    return rgb(parsed.r, parsed.g, parsed.b);
  };

  // C8: Cache loaded source PDFDocuments and embedded Form XObjects per (blob, pageIndex)
  // so 20-page mail-merge / repeat documents embed the underlay ONCE instead of 20 times.
  const srcDocCache = new Map<string, any>();
  const embeddedPageCache = new Map<string, { emb: any; rot: number; embW: number; embH: number }>();

  for (const dPage of displayList.pages) {
    const pageW = mmToPt(dPage.widthMm);
    const pageH = mmToPt(dPage.heightMm);
    const page = pdfDoc.addPage([pageW, pageH]);

    // Optional page background fill
    if (dPage.background) {
      const bg = parseHexColorToRgb(dPage.background);
      if (bg) {
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageW,
          height: pageH,
          color: rgb(bg.r, bg.g, bg.b),
        });
      }
    }

    // Stage 0: Embed original PDF page as vector underlay if present and mode === 'overlay'
    if (dPage.underlay && dPage.underlay.mode !== 'rebuild') {
      const blobKey = dPage.underlay.blob;
      const srcBytes = options.blobs?.[blobKey];
      if (!srcBytes) {
        throw new UnderlayError(
          'UNDERLAY_MISSING',
          blobKey,
          `Binário de fundo "${blobKey}" não encontrado em options.blobs.`
        );
      }

      let srcDoc = srcDocCache.get(blobKey);
      if (!srcDoc) {
        try {
          srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
          // C6: Clear text/check values if field ops will draw them, then flatten widget borders/backgrounds
          // so static widget appearances (borders/fills) are preserved in the embedded XObject.
          const hasFieldOps = dPage.ops.some((o) => o.layerId === 'fields');
          try {
            const form = srcDoc.getForm();
            if (hasFieldOps) {
              for (const f of form.getFields()) {
                try {
                  if (typeof (f as any).setText === 'function') {
                    (f as any).setText('');
                  } else if (typeof (f as any).uncheck === 'function') {
                    (f as any).uncheck();
                  }
                } catch {
                  // Ignore read-only or non-standard field clear errors
                }
              }
            }
            form.flatten();
          } catch {
            // Ignore if source PDF has no AcroForm or non-standard widgets
          }
          srcDocCache.set(blobKey, srcDoc);
        } catch (err) {
          throw new UnderlayError(
            'UNDERLAY_CORRUPT',
            blobKey,
            `PDF de fundo "${blobKey}" corrompido ou inválido: ${(err as Error)?.message || String(err)}`
          );
        }
      }

      const srcPages = srcDoc.getPages();
      const targetIdx = Math.max(0, Math.min(srcPages.length - 1, (dPage.underlay.page || 1) - 1));
      const cacheKey = `${blobKey}:${targetIdx}`;
      let cachedEmb = embeddedPageCache.get(cacheKey);
      if (!cachedEmb && srcPages[targetIdx]) {
        try {
          const srcPage = srcPages[targetIdx];
          const rot = ((srcPage.getRotation().angle || 0) % 360 + 360) % 360;
          const { width: embW, height: embH } = srcPage.getSize();
          const [emb] = await pdfDoc.embedPages([srcPage]);
          cachedEmb = { emb, rot, embW, embH };
          embeddedPageCache.set(cacheKey, cachedEmb);
        } catch (err) {
          throw new UnderlayError(
            'UNDERLAY_CORRUPT',
            blobKey,
            `Falha ao embutir página ${targetIdx + 1} do fundo "${blobKey}": ${(err as Error)?.message || String(err)}`
          );
        }
      }

      if (cachedEmb) {
        const { emb, rot, embW, embH } = cachedEmb;
        if (rot === 90) {
          page.drawPage(emb, {
            x: 0,
            y: pageH,
            width: embW,
            height: embH,
            rotate: degrees(-90),
          });
        } else if (rot === 180) {
          page.drawPage(emb, {
            x: pageW,
            y: pageH,
            width: embW,
            height: embH,
            rotate: degrees(180),
          });
        } else if (rot === 270) {
          page.drawPage(emb, {
            x: pageW,
            y: 0,
            width: embW,
            height: embH,
            rotate: degrees(90),
          });
        } else {
          page.drawPage(emb, {
            x: 0,
            y: 0,
            width: pageW,
            height: pageH,
          });
        }
      }
    }

    // Paint all resolved operations
    for (const op of dPage.ops) {
      paintOperation(page, op, dPage.heightMm, { fontRegular, fontBold, toRgb });
    }
  }

  if (options.stampPageNumbers) {
    const allPages = pdfDoc.getPages();
    const total = allPages.length;
    allPages.forEach((p, idx) => {
      p.drawText(`${idx + 1}/${total}`, {
        x: p.getWidth() - 52,
        y: 28,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
      });
    });
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

function paintOperation(
  page: any,
  op: ResolvedOp,
  pageHeightMm: number,
  ctx: { fontRegular: any; fontBold: any; toRgb: (hex?: string, fb?: any) => any }
) {
  const { fontRegular, fontBold, toRgb } = ctx;

  if (op.kind === 'rect') {
    const { xPt, yPt } = toPdf(op.x, op.y, pageHeightMm, op.h);
    const drawOpts: Record<string, any> = {
      x: xPt,
      y: yPt,
      width: mmToPt(op.w),
      height: mmToPt(op.h),
    };
    if (op.fill && op.fill !== 'none' && op.fill !== 'transparent') {
      drawOpts.color = toRgb(op.fill);
    }
    if (op.stroke && op.stroke !== 'none') {
      drawOpts.borderColor = toRgb(op.stroke);
      drawOpts.borderWidth = mmToPt(op.strokeWidthMm || 0.35);
    }
    page.drawRectangle(drawOpts);
    return;
  }

  if (op.kind === 'line') {
    const start = toPdf(op.x1, op.y1, pageHeightMm, 0);
    const end = toPdf(op.x2, op.y2, pageHeightMm, 0);
    const lineOpts: Record<string, any> = {
      start: { x: start.xPt, y: start.yPt },
      end: { x: end.xPt, y: end.yPt },
      thickness: mmToPt(op.strokeWidthMm || 0.35),
      color: toRgb(op.stroke),
    };
    if (op.dash && op.dash.length >= 2) {
      lineOpts.dashArray = op.dash.map((d) => mmToPt(d));
    }
    page.drawLine(lineOpts);
    return;
  }

  if (op.kind === 'path' && op.points.length >= 2) {
    for (let i = 0; i < op.points.length - 1; i++) {
      const p1 = toPdf(op.points[i][0], op.points[i][1], pageHeightMm, 0);
      const p2 = toPdf(op.points[i + 1][0], op.points[i + 1][1], pageHeightMm, 0);
      page.drawLine({
        start: { x: p1.xPt, y: p1.yPt },
        end: { x: p2.xPt, y: p2.yPt },
        thickness: mmToPt(op.strokeWidthMm || 0.35),
        color: toRgb(op.stroke),
      });
    }
    if (op.closed && op.points.length >= 3) {
      const pLast = toPdf(
        op.points[op.points.length - 1][0],
        op.points[op.points.length - 1][1],
        pageHeightMm,
        0
      );
      const pFirst = toPdf(op.points[0][0], op.points[0][1], pageHeightMm, 0);
      page.drawLine({
        start: { x: pLast.xPt, y: pLast.yPt },
        end: { x: pFirst.xPt, y: pFirst.yPt },
        thickness: mmToPt(op.strokeWidthMm || 0.35),
        color: toRgb(op.stroke),
      });
    }
    return;
  }

  if (op.kind === 'text') {
    const font = op.weight === 'bold' ? fontBold : fontRegular;
    const sizePt = op.sizePt || 10;
    const color = toRgb(op.color);

    // N-8: Vertically center single-line field text within [op.y, op.y + op.h]; otherwise top-aligned (~0.82 * fontSizePt)
    const capHeightMm = (sizePt * 0.72) / (72 / 25.4);
    const baselineOffsetMm =
      op.layerId === 'fields' && op.lines.length === 1 && op.h > capHeightMm
        ? (op.h + capHeightMm) / 2
        : (sizePt * 0.82) / (72 / 25.4);

    for (let i = 0; i < op.lines.length; i++) {
      const safeLine = toWinAnsiSafe(op.lines[i]);
      if (!safeLine) continue;

      const lineYmm = op.y + baselineOffsetMm + i * op.lineHeightMm;
      const lineWidthPt = font.widthOfTextAtSize(safeLine, sizePt);
      const boxWidthPt = mmToPt(op.w);

      let xPt = mmToPt(op.x);
      if (op.align === 'center') {
        xPt += Math.max(0, (boxWidthPt - lineWidthPt) / 2);
      } else if (op.align === 'right') {
        xPt += Math.max(0, boxWidthPt - lineWidthPt);
      }

      const { yPt } = toPdf(op.x, lineYmm, pageHeightMm, 0);
      page.drawText(safeLine, {
        x: xPt,
        y: yPt,
        size: sizePt,
        font,
        color,
      });
    }
  }
}
