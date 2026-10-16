/**
 * Native Binary Blob Store (`blobStore.native.ts`) — Phase R0 (Resolves N2)
 *
 * Persists uploaded PDF binaries (`Uint8Array`) on iOS/Android in
 * `Paths.document/blobs/<sanitized_hash>.pdf` using the modern `expo-file-system` v56
 * `Directory` and `File` classes.
 */

import { Directory, File, Paths } from 'expo-file-system';

const memoryCache = new Map<string, Uint8Array>();

function hashToSafeFileName(hashKey: string): string {
  const cleaned = hashKey.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

function ensureBlobsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'blobs');
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }
  return dir;
}

export async function saveNativeBlob(hashKey: string, bytes: Uint8Array): Promise<void> {
  memoryCache.set(hashKey, bytes);
  try {
    const dir = ensureBlobsDirectory();
    const file = new File(dir, hashToSafeFileName(hashKey));
    file.write(bytes);
  } catch (err) {
    console.warn('[Sekundo] Failed to persist native blob to disk, kept in memory:', err);
  }
}

export async function loadNativeBlob(hashKey: string): Promise<Uint8Array | null> {
  if (memoryCache.has(hashKey)) {
    return memoryCache.get(hashKey)!;
  }
  try {
    const dir = ensureBlobsDirectory();
    const file = new File(dir, hashToSafeFileName(hashKey));
    if (!file.exists) {
      return null;
    }
    const bytes = await file.bytes();
    const copy = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    memoryCache.set(hashKey, copy);
    return copy;
  } catch {
    return null;
  }
}
