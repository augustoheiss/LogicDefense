/**
 * Sekundo — Delta Sync Envelope (Plain & AES-256-GCM Encrypted + Compressed)
 *
 * Allows volunteers and territory coordinators to exchange delta logs over
 * untrusted channels (WhatsApp, email, QR, `.sekundo` files) with optional
 * end-to-end encryption (AES-256-GCM + gzip compression), while remaining
 * backward-compatible with SEKUNDO_DELTA_v1 JSON envelopes.
 */

import { encryptForURL, decryptFromURL } from '../crypto/symmetric';
import type { LedgerOperation } from './operationLedger';

export const ENCRYPTED_DELTA_PREFIX = 'SEKUNDO_ENC_DELTA_v2:';

export interface DeltaEnvelopeV2 {
  protocol: 'SEKUNDO_DELTA_v2' | 'SEKUNDO_DELTA_v1';
  eventId: string;
  authorId?: string;
  exportedAt: string;
  operationsCount: number;
  operations: LedgerOperation[];
}

/**
 * Encodes a list of ledger operations into either a human-readable JSON envelope
 * or a compact, compressed + AES-256-GCM encrypted token string (`SEKUNDO_ENC_DELTA_v2:<token>`).
 */
export async function encodeDeltaEnvelope(
  eventId: string,
  operations: LedgerOperation[],
  options: {
    authorId?: string;
    passphrase?: string;
  } = {}
): Promise<string> {
  const envelope: DeltaEnvelopeV2 = {
    protocol: 'SEKUNDO_DELTA_v2',
    eventId,
    authorId: options.authorId,
    exportedAt: new Date().toISOString(),
    operationsCount: operations.length,
    operations,
  };

  const pass = options.passphrase?.trim();
  if (pass) {
    const token = await encryptForURL(envelope, pass);
    return `${ENCRYPTED_DELTA_PREFIX}${token}`;
  }

  return JSON.stringify(envelope, null, 2);
}

/**
 * Checks whether a raw delta string is encrypted with AES-256-GCM.
 */
export function isEncryptedDeltaEnvelope(rawInput: string): boolean {
  return rawInput.trim().startsWith(ENCRYPTED_DELTA_PREFIX);
}

/**
 * Decodes a delta envelope from plain JSON (`SEKUNDO_DELTA_v1`, `SEKUNDO_DELTA_v2`, or raw array)
 * or from an encrypted `SEKUNDO_ENC_DELTA_v2:<token>` payload.
 */
export async function decodeDeltaEnvelope(
  rawInput: string,
  passphrase?: string
): Promise<{ eventId?: string; authorId?: string; operations: LedgerOperation[] }> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Pacote de sincronização vazio.');
  }

  if (trimmed.startsWith(ENCRYPTED_DELTA_PREFIX)) {
    const cleanPass = passphrase?.trim();
    if (!cleanPass) {
      throw new Error('Este pacote Delta está criptografado. Informe a senha de proteção para descriptografá-lo.');
    }
    const token = trimmed.slice(ENCRYPTED_DELTA_PREFIX.length).trim();
    const decoded = (await decryptFromURL(token, cleanPass)) as Partial<DeltaEnvelopeV2>;
    if (!decoded || !Array.isArray(decoded.operations)) {
      throw new Error('Pacote criptografado decodificado, mas não contém lista de operações válida.');
    }
    return {
      eventId: decoded.eventId,
      authorId: decoded.authorId,
      operations: decoded.operations,
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Formato inválido. Cole o JSON ou token SEKUNDO_ENC_DELTA_v2 completo gerado pelo Sekundo.');
  }

  if (Array.isArray(parsed)) {
    return { operations: parsed };
  }
  if (parsed && Array.isArray(parsed.operations)) {
    return {
      eventId: parsed.eventId,
      authorId: parsed.authorId,
      operations: parsed.operations,
    };
  }

  throw new Error('Nenhuma lista de operações encontrada no pacote fornecido.');
}
