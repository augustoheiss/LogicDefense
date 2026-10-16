/**
 * Sekundo — Web PDF Underlay Rasterizer (`underlayRaster.web.ts`)
 *
 * Resolves C11 & §8.3:
 * Renders the requested page (1-indexed) of an underlay PDF binary onto an
 * offscreen HTML5 `<canvas>` via `pdf.js`, returning a cached PNG `data:image/png;base64,...`
 * URL so `SvgPainter.tsx` displays the real PDF background behind vector/field overlays.
 */

import { loadPdfJsLocalFirst } from './pdfjsLoader';

const pageRasterCache = new Map<string, string>();

export async function rasterizeUnderlayPage(
  pdfBytes: Uint8Array,
  pageNumber = 1,
  cacheKeyPrefix = 'underlay'
): Promise<string | null> {
  const safePage = Math.max(1, Math.floor(pageNumber));
  const cacheKey = `${cacheKeyPrefix}_p${safePage}_${pdfBytes.byteLength}`;
  const cached = pageRasterCache.get(cacheKey);
  if (cached) return cached;

  if (typeof document === 'undefined') {
    return null;
  }

  try {
    const pdfjsLib = await loadPdfJsLocalFirst();
    if (!pdfjsLib) return null;

    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    const pdfProxy = await loadingTask.promise;
    const targetPage = Math.min(safePage, pdfProxy.numPages || 1);
    const page = await pdfProxy.getPage(targetPage);

    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      pageRasterCache.set(cacheKey, dataUrl);
      return dataUrl;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearUnderlayRasterCache(): void {
  pageRasterCache.clear();
}
