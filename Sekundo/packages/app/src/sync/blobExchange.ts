/**
 * Sekundo — Content-Addressed Blob Exchange & HLC Delta Helper (`blobExchange.ts`)
 *
 * Resolves Phase R4 & §8.5:
 * Allows devices to verify whether they already possess an underlay PDF binary
 * by its `sha256:<hex>` fingerprint before requesting or transmitting the binary,
 * and packages compact HLC field deltas (`SEKUNDO_DOC_DELTA_v2:`) for WhatsApp/QR.
 */

import {
  computeTemplateFingerprintSha256,
  encodeDocSyncEnvelope,
  decodeDocSyncEnvelope,
  type DocSyncOperation,
} from '@sekundo/core';
import { loadBlob, saveBlob } from '../storage/localStorage';

export async function hasLocalBlob(sha256Ref: string): Promise<boolean> {
  const existing = await loadBlob(sha256Ref);
  return Boolean(existing && existing.byteLength > 0);
}

export async function registerVerifiedBlob(bytes: Uint8Array): Promise<string> {
  const sha256 = await computeTemplateFingerprintSha256(bytes);
  await saveBlob(sha256, bytes);
  return sha256;
}

export function buildShareableDocDelta(
  templateHash: string,
  ops: DocSyncOperation[]
): string {
  return encodeDocSyncEnvelope(templateHash, ops);
}

export function parseReceivedDocDelta(
  payload: string
): { templateHash: string; ops: DocSyncOperation[] } | null {
  return decodeDocSyncEnvelope(payload);
}
