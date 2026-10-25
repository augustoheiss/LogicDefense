/**
 * Sekundo — Capability URL & Encrypted Blob Engine (`Phase F1 & F2`)
 *
 * Implements the v3 Capability URL Architecture inspired by Excalidraw & CryptPad:
 *   - Read-only link: `https://.../s/<id>#r=<readKey>`
 *   - Read-write link: `https://.../s/<id>#r=<readKey>&w=<signSeed>`
 *
 * Cryptographic Design:
 *   - `id` (`blobId`): 128-bit random identifier (22 chars Base64URL). Safe to send to the stateless relay.
 *   - `readKey` (`#r`): 256-bit random AES-256-GCM key (43 chars Base64URL). Lives ONLY in the URL `#` fragment.
 *   - `signSeed` (`&w`): 256-bit random Ed25519 seed (43 chars Base64URL). Lives ONLY in the URL `#` fragment.
 *   - Total URL length is strictly <= 200 characters, preventing WhatsApp/SMS truncation while
 *     keeping 100% of cryptographic secrets out of HTTP requests, server logs, and Referer headers.
 */

import { compress, decompress, toBase64URL, fromBase64URL } from '../crypto/symmetric';
import {
  assertScopedProjectionInvariants,
  projectScope,
  type ScopedProjection,
  type ShareScope,
  type ScopeSourceState,
} from './scopeProjection';
import { generateSignSeed, derivePublicKeyFromSeed } from './signedPacket';

export type CapabilityMode = 'read' | 'edit';

export const CAPABILITY_BLOB_PREFIX = 'SEKUNDO_CAP_v3:';

export interface CapabilitySecret {
  /** 128-bit random ID (22 chars Base64URL) */
  id: string;
  /** 256-bit random AES-GCM key (43 chars Base64URL) */
  readKey: string;
  /** 256-bit Ed25519 private seed (43 chars Base64URL) — present only when `mode === 'edit'` */
  signSeed?: string;
  /** 256-bit Ed25519 public key (43 chars Base64URL) — embedded inside the encrypted projection */
  verifyPub?: string;
  /** Expiration timestamp (Unix epoch seconds) */
  expiresAt: number;
}

export interface CapabilityBlobEnvelopeV3 {
  protocol: 'SEKUNDO_CAP_v3';
  blobId: string;
  verifyPub?: string;
  projection: ScopedProjection;
}

export interface CreateCapabilityLinkInput {
  baseUrl?: string;
  source: ScopeSourceState;
  scope: ShareScope;
  ttlSeconds?: number;
}

export interface ParsedCapabilityUrl {
  id: string;
  blobId: string;
  readKey: string;
  signSeed?: string;
  mode: CapabilityMode;
}

export interface CreateCapabilityLinkResult {
  url: string;
  shortId: string;
  blobId: string;
  readKey: string;
  signSeed?: string;
  verifyPub?: string;
  cipherBlob: string;
  encryptedBlob: string;
  qrSvgData: string;
  expiresAt: string;
  secret: CapabilitySecret;
  projection: ScopedProjection;
  signedProjection: ScopedProjection;
}

export type CapabilityLinkArtifacts = CreateCapabilityLinkResult;

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API is required for Capability URL encryption.');
}

function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

/**
 * Generates a 128-bit random `blobId` encoded as 22 Base64URL chars.
 */
export function generateBlobId(): string {
  return toBase64URL(randomBytes(16));
}

/**
 * Generates a 256-bit random AES-256-GCM `readKey` encoded as 43 Base64URL chars.
 */
export function generateReadKey(): string {
  return toBase64URL(randomBytes(32));
}

async function importRawAesGcmKey(readKeyB64Url: string): Promise<CryptoKey> {
  const rawKey = fromBase64URL((readKeyB64Url || '').trim());
  if (rawKey.length !== 32) {
    throw new Error(`Invalid readKey length: expected 32 bytes (256-bit), got ${rawKey.length}.`);
  }
  return getSubtleCrypto().importKey(
    'raw',
    rawKey as any,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a `ScopedProjection` or `CapabilityBlobEnvelopeV3` directly with a 256-bit random `readKey`
 * using gzip + AES-256-GCM.
 */
export async function encryptBlobWithReadKey(
  payload: ScopedProjection | CapabilityBlobEnvelopeV3,
  readKeyB64Url: string
): Promise<string> {
  const projection = 'projection' in payload ? payload.projection : payload;
  assertScopedProjectionInvariants(projection);
  const key = await importRawAesGcmKey(readKeyB64Url);
  const iv = randomBytes(12);
  const json = JSON.stringify(payload);
  const compressed = await compress(json);

  const cipherBuf = await getSubtleCrypto().encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    compressed as any
  );

  const ivB64 = toBase64URL(iv);
  const cipherB64 = toBase64URL(new Uint8Array(cipherBuf));
  return `${CAPABILITY_BLOB_PREFIX}${ivB64}.${cipherB64}`;
}

/**
 * Decrypts an opaque `SEKUNDO_CAP_v3:<iv>.<cipher>` blob using the 256-bit `readKey` from `#r=...`.
 * Returns a normalized object containing both `ScopedProjection` fields and `CapabilityBlobEnvelopeV3` fields.
 */
export async function decryptBlobWithReadKey(
  cipherBlob: string,
  readKeyB64Url: string
): Promise<ScopedProjection & CapabilityBlobEnvelopeV3> {
  const trimmed = (cipherBlob || '').trim();
  if (!trimmed.startsWith(CAPABILITY_BLOB_PREFIX)) {
    throw new Error('Invalid capability blob prefix. Expected SEKUNDO_CAP_v3:.');
  }
  const body = trimmed.slice(CAPABILITY_BLOB_PREFIX.length);
  const dotIdx = body.indexOf('.');
  if (dotIdx <= 0) {
    throw new Error('Malformed capability ciphertext.');
  }

  const iv = fromBase64URL(body.slice(0, dotIdx));
  const ciphertext = fromBase64URL(body.slice(dotIdx + 1));
  const key = await importRawAesGcmKey(readKeyB64Url);

  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await getSubtleCrypto().decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext as any
    );
  } catch {
    throw new Error('Capability decryption failed: invalid readKey or tampered ciphertext.');
  }

  const decompressed = await decompress(new Uint8Array(plainBuf));
  const rawParsed = JSON.parse(decompressed);

  const projection: ScopedProjection =
    rawParsed && rawParsed.protocol === 'SEKUNDO_CAP_v3' && rawParsed.projection
      ? rawParsed.projection
      : rawParsed;

  if (!projection || projection.version !== 3 || !Array.isArray(projection.nodes)) {
    throw new Error('Invalid decrypted ScopedProjection structure.');
  }
  assertScopedProjectionInvariants(projection);

  const blobId = (rawParsed && rawParsed.blobId) || 'cap_blob';
  const verifyPub = (rawParsed && rawParsed.verifyPub) || projection.verifyPub;

  return {
    ...projection,
    protocol: 'SEKUNDO_CAP_v3',
    blobId,
    verifyPub,
    projection,
  };
}

/**
 * Creates a compact v3 Capability URL (`/s/<id>#r=<readKey>[&w=<signSeed>]`) and encrypted blob.
 * Supports both:
 *   1. `createCapabilityLink(projection, mode, options)`
 *   2. `createCapabilityLink({ baseUrl, source, scope, ttlSeconds })`
 * Guarantees:
 *   - Total URL length <= 200 chars
 *   - Zero cryptographic keys in path or query string (keys exist strictly after `#`)
 */
export async function createCapabilityLink(
  projectionOrInput: ScopedProjection | CreateCapabilityLinkInput,
  modeArg: CapabilityMode = 'read',
  optionsArg?: {
    baseUrl?: string;
    ttlSeconds?: number;
  }
): Promise<CreateCapabilityLinkResult> {
  let baseProjection: ScopedProjection;
  let mode: CapabilityMode = modeArg;
  let baseUrl = optionsArg?.baseUrl;
  let ttlSeconds = optionsArg?.ttlSeconds;

  if ('source' in projectionOrInput && 'scope' in projectionOrInput) {
    const input = projectionOrInput as CreateCapabilityLinkInput;
    mode = input.scope.mode || 'read';
    baseUrl = input.baseUrl;
    ttlSeconds = input.ttlSeconds;
    baseProjection = projectScope(input.source, input.scope, { ttlSeconds });
  } else {
    baseProjection = projectionOrInput as ScopedProjection;
    if (baseProjection.scope?.mode) {
      mode = baseProjection.scope.mode;
    }
  }

  assertScopedProjectionInvariants(baseProjection);

  const id = generateBlobId(); // 22 chars
  const readKey = generateReadKey(); // 43 chars
  let signSeed: string | undefined;
  let verifyPub: string | undefined;

  if (mode === 'edit') {
    signSeed = generateSignSeed(); // 43 chars
    verifyPub = derivePublicKeyFromSeed(signSeed);
  }

  const effectiveTtl = ttlSeconds ?? 7 * 24 * 3600;
  const expiresAtEpochSec = Math.floor(Date.now() / 1000) + effectiveTtl;
  const expiresAtIso = new Date(expiresAtEpochSec * 1000).toISOString();

  const signedProjection: ScopedProjection = {
    ...baseProjection,
    scope: {
      ...baseProjection.scope,
      mode,
    },
    expiresAtEpochSec,
    expiresAt: expiresAtIso,
    ...(verifyPub ? { verifyPub } : {}),
  };

  const envelope: CapabilityBlobEnvelopeV3 = {
    protocol: 'SEKUNDO_CAP_v3',
    blobId: id,
    ...(verifyPub ? { verifyPub } : {}),
    projection: signedProjection,
  };

  const cipherBlob = await encryptBlobWithReadKey(envelope, readKey);

  const rawBase = (baseUrl || 'https://sekundo.app').replace(/\/+$/, '');
  const fragment = signSeed ? `r=${readKey}&w=${signSeed}` : `r=${readKey}`;
  const url = `${rawBase}/s/${id}#${fragment}`;

  if (url.length > 200) {
    throw new Error(`Capability URL length (${url.length}) exceeded 200-char limit.`);
  }

  const secret: CapabilitySecret = {
    id,
    readKey,
    ...(signSeed ? { signSeed } : {}),
    ...(verifyPub ? { verifyPub } : {}),
    expiresAt: expiresAtEpochSec,
  };

  return {
    url,
    shortId: id,
    blobId: id,
    readKey,
    ...(signSeed ? { signSeed } : {}),
    ...(verifyPub ? { verifyPub } : {}),
    cipherBlob,
    encryptedBlob: cipherBlob,
    qrSvgData: url,
    expiresAt: expiresAtIso,
    secret,
    projection: signedProjection,
    signedProjection,
  };
}

/**
 * Parses a v3 Capability URL (or hash/path combination) into `{ id, blobId, readKey, signSeed, mode }`.
 * Rejects any URL that attempts to pass `r` or `w` in the query string instead of the `#` fragment.
 */
export function parseCapabilityUrl(
  urlOrPath: string,
  explicitHash?: string
): ParsedCapabilityUrl | null {
  const raw = (urlOrPath || '').trim();
  if (!raw && !explicitHash) return null;

  let hashPart = '';
  let pathAndQuery = raw;
  const hashIdx = raw.indexOf('#');
  if (hashIdx >= 0) {
    pathAndQuery = raw.slice(0, hashIdx);
    hashPart = raw.slice(hashIdx + 1);
  }
  if (explicitHash) {
    hashPart = explicitHash.replace(/^#/, '');
  }

  // Security guard: never accept r= or w= from query string (?r=... or ?w=...)
  const queryIdx = pathAndQuery.indexOf('?');
  if (queryIdx >= 0) {
    const queryParams = new URLSearchParams(pathAndQuery.slice(queryIdx + 1));
    if (queryParams.has('r') || queryParams.has('w')) {
      return null;
    }
  }

  // Extract shortId from /s/<id>
  const pathOnly = queryIdx >= 0 ? pathAndQuery.slice(0, queryIdx) : pathAndQuery;
  const match = pathOnly.match(/\/s\/([A-Za-z0-9_-]{8,64})/);
  const id = match ? match[1] : /^[A-Za-z0-9_-]{16,32}$/.test(pathOnly) ? pathOnly : '';
  if (!id || !hashPart) return null;

  const fragParams = new URLSearchParams(hashPart);
  const readKey = (fragParams.get('r') || '').trim();
  const signSeed = (fragParams.get('w') || '').trim() || undefined;

  if (!readKey || readKey.length < 32) return null;

  return {
    id,
    blobId: id,
    readKey,
    ...(signSeed ? { signSeed } : {}),
    mode: signSeed ? 'edit' : 'read',
  };
}
