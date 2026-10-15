/**
 * Unified Cross-Platform File Delivery Utility — Sekundo
 *
 * Resolves A6: Ensures generated PDFs, YAMLs, and CSVs are delivered both on
 * Web (via Blob download) and Native iOS/Android (via expo-file-system + expo-sharing).
 */

import { Platform } from 'react-native';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export async function deliverFile(
  content: Uint8Array | string,
  filename: string,
  mimeType: string = 'application/octet-stream'
): Promise<{ delivered: boolean; uri?: string }> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') {
      return { delivered: false };
    }
    const blobPart: BlobPart =
      typeof content === 'string' ? content : (content as unknown as BlobPart);
    const blob = new Blob([blobPart], { type: mimeType });
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

  // Native iOS / Android via expo-file-system + expo-sharing
  const FileSystem = (await import('expo-file-system')) as any;
  const Sharing = await import('expo-sharing');

  const baseDir =
    FileSystem.cacheDirectory ||
    FileSystem.documentDirectory ||
    FileSystem.Paths?.cache?.uri ||
    '';
  const fileUri = `${baseDir}${safeFilename}`;

  if (typeof content === 'string') {
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType?.UTF8 ?? 'utf8',
    });
  } else {
    const base64 = uint8ArrayToBase64(content);
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType?.Base64 ?? 'base64',
    });
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: `Compartilhar ${safeFilename}`,
    });
  }

  return { delivered: true, uri: fileUri };
}
