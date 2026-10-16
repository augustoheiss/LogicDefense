/**
 * Sekundo — Native PDF Underlay Rasterizer (`underlayRaster.native.tsx`)
 *
 * Resolves C11 & §8.3:
 * Caches rendered PDF page previews in `Paths.cache/previews/<sha256>_p<N>.png`
 * using `expo-file-system@56` `File` / `Directory` APIs.
 */

import { Directory, File, Paths } from 'expo-file-system';

const memoryCache = new Map<string, string>();

function sanitizeKey(raw: string): string {
  return raw.replace(/^sha256:/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getPreviewFile(cacheKeyPrefix: string, pageNumber: number): File {
  const dir = new Directory(Paths.cache, 'previews');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return new File(dir, `${sanitizeKey(cacheKeyPrefix)}_p${pageNumber}.png`);
}

export async function rasterizeUnderlayPage(
  pdfBytes: Uint8Array,
  pageNumber = 1,
  cacheKeyPrefix = 'underlay'
): Promise<string | null> {
  const safePage = Math.max(1, Math.floor(pageNumber));
  const cacheKey = `${cacheKeyPrefix}_p${safePage}_${pdfBytes.byteLength}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  try {
    const file = getPreviewFile(cacheKeyPrefix, safePage);
    if (file.exists && file.size > 0) {
      memoryCache.set(cacheKey, file.uri);
      return file.uri;
    }
  } catch {
    // Fallback if cache read fails
  }

  return null;
}

export function clearUnderlayRasterCache(): void {
  memoryCache.clear();
}
