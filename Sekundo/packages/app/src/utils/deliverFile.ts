/**
 * Unified Cross-Platform File Delivery Utility — Sekundo (Phase R0)
 *
 * Resolves N1, U3, U4:
 * - Uses modern `expo-file-system` v56 (`File`, `Paths`) instead of legacy `writeAsStringAsync`.
 * - Preserves UTF-8 accents in filenames (`Designação.pdf`), stripping only OS-invalid characters.
 * - Supports Web Share API Level 2 (`navigator.canShare({ files })`) for mobile/PWA alongside `<a download>`.
 * - Zero `Buffer` and zero `as any` casts.
 */

import { Platform } from 'react-native';

export interface DeliverFileOptions {
  preferWebShare?: boolean;
}

export function sanitizeDeliveryFilename(filename: string): string {
  const trimmed = (filename || 'documento').trim();
  const cleaned = trimmed
    .replace(/[/\\:*?"<>|\x00-\x1F]+/g, '_')
    .replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned : 'documento';
}

export async function deliverFile(
  content: Uint8Array | string,
  filename: string,
  mimeType: string = 'application/octet-stream',
  options?: DeliverFileOptions
): Promise<{ delivered: boolean; uri?: string }> {
  const safeFilename = sanitizeDeliveryFilename(filename);

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') {
      return { delivered: false };
    }
    const blobPart: BlobPart =
      typeof content === 'string' ? content : new Uint8Array(content);
    const blob = new Blob([blobPart], { type: mimeType });

    // Web Share API Level 2 (PWA standalone on iOS / Mobile Web)
    if (
      options?.preferWebShare &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      typeof File !== 'undefined'
    ) {
      try {
        const shareFile = new File([blob], safeFilename, { type: mimeType });
        if (navigator.canShare({ files: [shareFile] })) {
          await navigator.share({
            title: safeFilename,
            files: [shareFile],
          });
          return { delivered: true };
        }
      } catch {
        // Fallback to anchor download if user cancels or share fails
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { delivered: true, uri: url };
  }

  // Native iOS / Android via modern expo-file-system v56 (`File`, `Paths`) + expo-sharing
  const { File: ExpoFile, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');

  const file = new ExpoFile(Paths.cache, safeFilename);
  file.write(content);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: `Compartilhar ${safeFilename}`,
    });
  }

  return { delivered: true, uri: file.uri };
}
