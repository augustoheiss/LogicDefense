/**
 * Sekundo — Symmetric Encryption Engine
 *
 * AES-256-GCM encryption via the Web Crypto API.
 * Used to encrypt event payloads for secure link sharing.
 *
 * Security design:
 *   - Key derivation: PBKDF2 (passphrase → 256-bit key, 100k iterations, SHA-256)
 *   - Algorithm: AES-GCM with random 12-byte IV per encryption
 *   - Payload format: "<iv_base64>.<ciphertext_base64>" (dot-separated)
 *   - The passphrase NEVER travels with the encrypted payload
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PBKDF2 iteration count for key derivation. */
const PBKDF2_ITERATIONS = 100_000;

/** AES key length in bits. */
const AES_KEY_LENGTH = 256;

/** GCM initialization vector length in bytes. */
const IV_LENGTH = 12;

/** Salt length in bytes for PBKDF2. */
const SALT_LENGTH = 16;

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Get the Web Crypto API instance.
 * Works in both browser and React Native (via polyfill) environments.
 */
function getCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }
  throw new Error(
    'Web Crypto API not available. Ensure you are running in a secure context (HTTPS) or provide a polyfill.'
  );
}

/**
 * Get cryptographically secure random bytes.
 */
function getRandomBytes(length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  globalThis.crypto.getRandomValues(buffer);
  return buffer;
}

/**
 * Encode a Uint8Array to a Base64 string.
 */
function toBase64(bytes: Uint8Array): string {
  // Browser-compatible approach
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a Base64 string to a Uint8Array.
 */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode a Uint8Array to a URL-safe Base64 string.
 * Replaces +/= with -_  (no padding).
 */
export function toBase64URL(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a URL-safe Base64 string to a Uint8Array.
 */
export function fromBase64URL(base64url: string): Uint8Array {
  // Restore standard Base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return fromBase64(base64);
}

// ---------------------------------------------------------------------------
// Key Derivation
// ---------------------------------------------------------------------------

/**
 * Derive an AES-256 key from a passphrase using PBKDF2.
 *
 * @param passphrase - User-provided passphrase string.
 * @param salt - Random salt (must be stored alongside the ciphertext).
 * @returns A CryptoKey ready for AES-GCM operations.
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const subtle = getCrypto();
  const encoder = new TextEncoder();

  // Import the passphrase as raw key material
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-256-GCM key via PBKDF2
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH,
    },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt.
 * @param passphrase - The passphrase used to derive the encryption key.
 * @returns Encoded payload string in format: "<salt_b64>.<iv_b64>.<ciphertext_b64>"
 *
 * @example
 * const encrypted = await encrypt('{"event": "data"}', 'my-secret-phrase');
 * // → "aBcDeFgH.iJkLmNoP.qRsTuVwXyZ..."
 */
export async function encrypt(
  plaintext: string,
  passphrase: string
): Promise<string> {
  const subtle = getCrypto();
  const encoder = new TextEncoder();

  // Generate random salt and IV
  const salt = getRandomBytes(SALT_LENGTH);
  const iv = getRandomBytes(IV_LENGTH);

  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Encrypt
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // Encode components to Base64
  const saltB64 = toBase64(salt);
  const ivB64 = toBase64(iv);
  const cipherB64 = toBase64(new Uint8Array(cipherBuffer));

  // Return dot-separated payload
  return `${saltB64}.${ivB64}.${cipherB64}`;
}

/**
 * Decrypt an encrypted payload string using AES-256-GCM.
 *
 * @param payload - Encrypted payload in format: "<salt_b64>.<iv_b64>.<ciphertext_b64>"
 * @param passphrase - The passphrase used during encryption.
 * @returns The original plaintext string.
 * @throws {Error} If the passphrase is wrong or the payload is corrupted.
 *
 * @example
 * const decrypted = await decrypt(encryptedPayload, 'my-secret-phrase');
 * // → '{"event": "data"}'
 */
export async function decrypt(
  payload: string,
  passphrase: string
): Promise<string> {
  const subtle = getCrypto();
  const decoder = new TextDecoder();

  // Parse the dot-separated payload
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted payload format. Expected "salt.iv.ciphertext".'
    );
  }

  const [saltB64, ivB64, cipherB64] = parts;

  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(cipherB64);

  // Derive the same key from passphrase + salt
  const key = await deriveKey(passphrase, salt);

  try {
    // Decrypt
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return decoder.decode(plainBuffer);
  } catch {
    throw new Error(
      'Decryption failed. Wrong passphrase or corrupted payload.'
    );
  }
}

// ---------------------------------------------------------------------------
// Convenience: Encrypt + Compress for URL sharing
// ---------------------------------------------------------------------------

/**
 * Compress a string using gzip (browser-native CompressionStream).
 * Falls back to no compression if CompressionStream is unavailable.
 *
 * @param input - The string to compress.
 * @returns Compressed bytes as Uint8Array.
 */
export async function compress(input: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(input);

  // Check if CompressionStream is available (modern browsers)
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    // Write input and close
    writer.write(inputBytes);
    writer.close();

    // Read all compressed chunks
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }

    // Concatenate chunks
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  // Fallback: return uncompressed bytes with a marker prefix
  // First byte 0x00 = uncompressed, 0x1F = gzip
  const result = new Uint8Array(inputBytes.length + 1);
  result[0] = 0x00; // uncompressed marker
  result.set(inputBytes, 1);
  return result;
}

/**
 * Decompress a gzip-compressed Uint8Array back to a string.
 *
 * @param compressed - The compressed bytes.
 * @returns The original string.
 */
export async function decompress(compressed: Uint8Array): Promise<string> {
  const decoder = new TextDecoder();

  // Check for uncompressed marker
  if (compressed[0] === 0x00) {
    return decoder.decode(compressed.slice(1));
  }

  // Check if DecompressionStream is available
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    writer.write(compressed);
    writer.close();

    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return decoder.decode(result);
  }

  // If no DecompressionStream and not uncompressed, error
  throw new Error(
    'DecompressionStream not available and payload is compressed.'
  );
}

/**
 * Full pipeline: JSON → compress → encrypt → Base64URL string.
 * Produces a URL-safe token for the Horizon Window link sharing.
 *
 * @param data - Any serializable object.
 * @param passphrase - Encryption passphrase.
 * @returns URL-safe Base64 token string.
 */
export async function encryptForURL(
  data: unknown,
  passphrase: string
): Promise<string> {
  // 1. Serialize to JSON
  const json = JSON.stringify(data);

  // 2. Compress
  const compressed = await compress(json);

  // 3. Encrypt the compressed bytes (as Base64 string intermediate)
  const compressedB64 = toBase64(compressed);
  const encrypted = await encrypt(compressedB64, passphrase);

  // 4. Encode to URL-safe Base64
  const encoder = new TextEncoder();
  return toBase64URL(encoder.encode(encrypted));
}

/**
 * Full pipeline: Base64URL string → decrypt → decompress → JSON parse.
 * Reverses the encryptForURL operation.
 *
 * @param token - URL-safe Base64 token string.
 * @param passphrase - Decryption passphrase.
 * @returns The original data object.
 */
export async function decryptFromURL(
  token: string,
  passphrase: string
): Promise<unknown> {
  // 1. Decode URL-safe Base64
  const bytes = fromBase64URL(token);
  const decoder = new TextDecoder();
  const encrypted = decoder.decode(bytes);

  // 2. Decrypt
  const compressedB64 = await decrypt(encrypted, passphrase);

  // 3. Decode Base64 to compressed bytes
  const compressed = fromBase64(compressedB64);

  // 4. Decompress
  const json = await decompress(compressed);

  // 5. Parse JSON
  return JSON.parse(json);
}
