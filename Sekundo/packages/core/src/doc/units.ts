/**
 * Sekundo Document Engine — Physical Page Units & Coordinate Conversion (`units.ts`)
 *
 * Clean, zero-DOM port of `PageFormatEngine` for `@sekundo/core/doc`.
 * Unifies coordinate conversion between:
 * - Millimeters (`mm`, origin at top-left, y downward — canonical in `.sdoc.yaml` and Canvas)
 * - PostScript Points (`pt`, 72 DPI: 1 inch = 72 pt = 25.4 mm, origin at bottom-left in PDF)
 * - Reference CSS Pixels (`px`, 96 DPI: 1 inch = 96 px = 25.4 mm)
 */

import type { Mm, PageFormatId, PageOrientation, SdocPageConfig } from './types';

export interface PageFormatDimensions {
  id: PageFormatId;
  name: string;
  label: string;
  widthMm: Mm;
  heightMm: Mm;
  widthPt: number;
  heightPt: number;
  widthPx: number;
  heightPx: number;
}

export const PT_PER_MM = 72 / 25.4;
export const PX_PER_MM = 96 / 25.4;

export function mmToPt(mm: Mm): number {
  return Number((mm * PT_PER_MM).toFixed(4));
}

export function ptToMm(pt: number): Mm {
  return Number((pt / PT_PER_MM).toFixed(4));
}

export function mmToPx(mm: Mm, scale: number = 1): number {
  return Number((mm * PX_PER_MM * scale).toFixed(3));
}

export function pxToMm(px: number, scale: number = 1): Mm {
  const effectiveScale = scale > 0 ? scale : 1;
  return Number((px / (PX_PER_MM * effectiveScale)).toFixed(3));
}

/**
 * Converts a top-left millimeter coordinate `(xMm, yMm)` to a bottom-left PostScript point `(xPt, yPt)`
 * for `pdf-lib`. If an object height `hMm` is provided (e.g. for `drawRectangle`), returns the
 * bottom-left corner of the box in PDF points.
 */
export function toPdf(
  xMm: Mm,
  yMm: Mm,
  pageHeightMm: Mm,
  objectHeightMm: Mm = 0
): { xPt: number; yPt: number } {
  const xPt = mmToPt(xMm);
  const yPt = mmToPt(pageHeightMm - yMm - objectHeightMm);
  return { xPt, yPt };
}

/**
 * Inverse of `toPdf`: converts bottom-left PDF points `(xPt, yPt)` back to top-left millimeters `(xMm, yMm)`.
 */
export function fromPdf(
  xPt: number,
  yPt: number,
  pageHeightMm: Mm,
  objectHeightMm: Mm = 0
): { xMm: Mm; yMm: Mm } {
  const xMm = ptToMm(xPt);
  const yMm = Number((pageHeightMm - ptToMm(yPt) - objectHeightMm).toFixed(4));
  return { xMm, yMm };
}

export const PAGE_FORMATS: Record<Exclude<PageFormatId, 'custom'>, PageFormatDimensions> = {
  a4: {
    id: 'a4',
    name: 'A4',
    label: 'A4 (210 × 297 mm)',
    widthMm: 210,
    heightMm: 297,
    widthPt: 595.28,
    heightPt: 841.89,
    widthPx: 793.7,
    heightPx: 1122.52,
  },
  a3: {
    id: 'a3',
    name: 'A3',
    label: 'A3 (297 × 420 mm)',
    widthMm: 297,
    heightMm: 420,
    widthPt: 841.89,
    heightPt: 1190.55,
    widthPx: 1122.52,
    heightPx: 1587.4,
  },
  a5: {
    id: 'a5',
    name: 'A5',
    label: 'A5 (148 × 210 mm)',
    widthMm: 148,
    heightMm: 210,
    widthPt: 419.53,
    heightPt: 595.28,
    widthPx: 559.37,
    heightPx: 793.7,
  },
  letter: {
    id: 'letter',
    name: 'US Letter',
    label: 'Carta / Letter (215.9 × 279.4 mm)',
    widthMm: 215.9,
    heightMm: 279.4,
    widthPt: 612,
    heightPt: 792,
    widthPx: 816,
    heightPx: 1056,
  },
  legal: {
    id: 'legal',
    name: 'US Legal',
    label: 'Ofício / Legal (215.9 × 355.6 mm)',
    widthMm: 215.9,
    heightMm: 355.6,
    widthPt: 612,
    heightPt: 1008,
    widthPx: 816,
    heightPx: 1344,
  },
  tabloid: {
    id: 'tabloid',
    name: 'Tabloid',
    label: 'Tabloid (279.4 × 431.8 mm)',
    widthMm: 279.4,
    heightMm: 431.8,
    widthPt: 792,
    heightPt: 1224,
    widthPx: 1056,
    heightPx: 1632,
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    label: 'Executive (184.15 × 266.7 mm)',
    widthMm: 184.15,
    heightMm: 266.7,
    widthPt: 522,
    heightPt: 756,
    widthPx: 696,
    heightPx: 1008,
  },
};

export function detectPageFormatFromMm(
  widthMm: Mm,
  heightMm: Mm
): { format: PageFormatId; orientation: PageOrientation } {
  const minD = Math.min(widthMm, heightMm);
  const maxD = Math.max(widthMm, heightMm);
  const orientation: PageOrientation = widthMm > heightMm ? 'landscape' : 'portrait';

  for (const [id, def] of Object.entries(PAGE_FORMATS) as [
    Exclude<PageFormatId, 'custom'>,
    PageFormatDimensions,
  ][]) {
    const defMin = Math.min(def.widthMm, def.heightMm);
    const defMax = Math.max(def.widthMm, def.heightMm);
    if (Math.abs(minD - defMin) <= 1.2 && Math.abs(maxD - defMax) <= 1.2) {
      return { format: id, orientation };
    }
  }
  return { format: 'custom', orientation };
}

export function resolvePageDimensions(config?: Partial<SdocPageConfig>): {
  widthMm: Mm;
  heightMm: Mm;
  widthPt: number;
  heightPt: number;
  orientation: PageOrientation;
  format: PageFormatId;
} {
  const hasExplicitDims =
    typeof config?.widthMm === 'number' &&
    config.widthMm > 0 &&
    typeof config?.heightMm === 'number' &&
    config.heightMm > 0;

  const detected = hasExplicitDims
    ? detectPageFormatFromMm(config!.widthMm!, config!.heightMm!)
    : undefined;

  const format: PageFormatId = config?.format || detected?.format || 'a4';
  const orientation: PageOrientation =
    config?.orientation ||
    detected?.orientation ||
    (hasExplicitDims && config!.widthMm! > config!.heightMm! ? 'landscape' : 'portrait');

  let baseW = 210;
  let baseH = 297;

  if (hasExplicitDims) {
    baseW = Math.max(10, Math.min(5000, config!.widthMm!));
    baseH = Math.max(10, Math.min(5000, config!.heightMm!));
  } else if (format === 'custom') {
    baseW = Math.max(30, Math.min(2000, config?.widthMm || 210));
    baseH = Math.max(30, Math.min(2000, config?.heightMm || 297));
  } else {
    const std = PAGE_FORMATS[format] || PAGE_FORMATS.a4;
    baseW = std.widthMm;
    baseH = std.heightMm;
  }

  const widthMm = orientation === 'landscape' ? Math.max(baseW, baseH) : Math.min(baseW, baseH);
  const heightMm = orientation === 'landscape' ? Math.min(baseW, baseH) : Math.max(baseW, baseH);

  return {
    format,
    orientation,
    widthMm,
    heightMm,
    widthPt: mmToPt(widthMm),
    heightPt: mmToPt(heightMm),
  };
}
