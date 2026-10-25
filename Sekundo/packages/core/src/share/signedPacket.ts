/**
 * Sekundo — Ed25519 Signed Capability Packet Engine (`Phase F2`)
 *
 * Implements RFC 8032 Ed25519 digital signatures + RFC 6234 SHA-512 using pure TypeScript
 * (`BigInt` twisted Edwards arithmetic over $GF(2^{255}-19)$) with zero native/external binary dependencies.
 *
 * Security Guarantees:
 *   - `signSeed` (`w` in URL fragment) is a 256-bit secret held only by authorized editors.
 *   - `verifyPub` is the 32-byte Ed25519 public key stored inside the encrypted `ScopedProjection`.
 *   - Every mutation packet (`DELTA_MUTATION`, `SNAPSHOT_SYNC`, `ActivityLogEntry`) in v3 capability
 *     rooms MUST carry a valid Ed25519 signature verified against `verifyPub`.
 *   - Forging `author.hasAdminSeal = true` without possessing `signSeed` is mathematically infeasible.
 */

import { toBase64URL, fromBase64URL } from '../crypto/symmetric';

// ---------------------------------------------------------------------------
// RFC 6234 Pure-TypeScript SHA-512 (Synchronous, Deterministic, Zero Dependencies)
// ---------------------------------------------------------------------------

const SHA512_K: bigint[] = [
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcBn >> 4n,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
];
SHA512_K[3] = 0xe9b5dba58189dbbcn;

const SHA512_H0: bigint[] = [
  0x6a09e667f3bcc908n,
  0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn,
  0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n,
  0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n,
];

const MASK_64 = 0xffffffffffffffffn;

function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & MASK_64;
}

export function sha512Sync(data: Uint8Array): Uint8Array {
  const bitLen = BigInt(data.length) * 8n;
  const padLen = (112 - ((data.length + 1) % 128) + 128) % 128;
  const totalLen = data.length + 1 + padLen + 16;
  const buf = new Uint8Array(totalLen);
  buf.set(data, 0);
  buf[data.length] = 0x80;

  let lenVal = bitLen;
  for (let i = totalLen - 1; i >= totalLen - 16; i--) {
    buf[i] = Number(lenVal & 0xffn);
    lenVal >>= 8n;
  }

  let [h0, h1, h2, h3, h4, h5, h6, h7] = SHA512_H0;
  const W = new Array<bigint>(80).fill(0n);

  for (let offset = 0; offset < totalLen; offset += 128) {
    for (let i = 0; i < 16; i++) {
      let word = 0n;
      const base = offset + i * 8;
      for (let b = 0; b < 8; b++) {
        word = (word << 8n) | BigInt(buf[base + b]);
      }
      W[i] = word;
    }

    for (let i = 16; i < 80; i++) {
      const w15 = W[i - 15];
      const s0 = rotr64(w15, 1n) ^ rotr64(w15, 8n) ^ (w15 >> 7n);
      const w2 = W[i - 2];
      const s1 = rotr64(w2, 19n) ^ rotr64(w2, 61n) ^ (w2 >> 6n);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) & MASK_64;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 80; i++) {
      const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA512_K[i] + W[i]) & MASK_64;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & MASK_64;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) & MASK_64;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) & MASK_64;
    }

    h0 = (h0 + a) & MASK_64;
    h1 = (h1 + b) & MASK_64;
    h2 = (h2 + c) & MASK_64;
    h3 = (h3 + d) & MASK_64;
    h4 = (h4 + e) & MASK_64;
    h5 = (h5 + f) & MASK_64;
    h6 = (h6 + g) & MASK_64;
    h7 = (h7 + h) & MASK_64;
  }

  const out = new Uint8Array(64);
  const words = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let wIdx = 0; wIdx < 8; wIdx++) {
    let w = words[wIdx];
    for (let b = 7; b >= 0; b--) {
      out[wIdx * 8 + b] = Number(w & 0xffn);
      w >>= 8n;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// RFC 8032 Ed25519 Curve Constants ($p = 2^{255} - 19$, $L = 2^{252} + 27742317777372353535851937790883648493$)
// ---------------------------------------------------------------------------

const P = (1n << 255n) - 19n;
const L = (1n << 252n) + 27742317777372353535851937790883648493n;

function mod(a: bigint, m: bigint = P): bigint {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function modPow(base: bigint, exp: bigint, m: bigint = P): bigint {
  let res = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) res = (res * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return res;
}

function modInverse(a: bigint, m: bigint = P): bigint {
  return modPow(a, m - 2n, m);
}

const D = mod(-121665n * modInverse(121666n));
const D2 = mod(2n * D);
const SQRT_M1 = modPow(2n, (P - 1n) / 4n);

const BY = mod(4n * modInverse(5n));
const BX = recoverX(BY, false)!;

interface ExtPoint {
  X: bigint;
  Y: bigint;
  Z: bigint;
  T: bigint;
}

const ZERO_POINT: ExtPoint = { X: 0n, Y: 1n, Z: 1n, T: 0n };
const BASE_POINT: ExtPoint = { X: BX, Y: BY, Z: 1n, T: mod(BX * BY) };

function recoverX(y: bigint, sign: boolean): bigint | null {
  if (y >= P) return null;
  const y2 = mod(y * y);
  const u = mod(y2 - 1n);
  const v = mod(D * y2 + 1n);
  const v3 = mod(v * v * v);
  const v7 = mod(v3 * v3 * v);
  const uv7 = mod(u * v7);
  let x = mod(mod(u * v3) * modPow(uv7, (P - 5n) / 8n));
  const vx2 = mod(v * mod(x * x));
  if (vx2 !== u) {
    if (vx2 === mod(-u)) {
      x = mod(x * SQRT_M1);
    } else {
      return null;
    }
  }
  if (x === 0n && sign) return null;
  if ((x & 1n) !== (sign ? 1n : 0n)) {
    x = P - x;
  }
  return x;
}

function pointAdd(p: ExtPoint, q: ExtPoint): ExtPoint {
  const A = mod((p.Y - p.X) * (q.Y - q.X));
  const B = mod((p.Y + p.X) * (q.Y + q.X));
  const C = mod(p.T * D2 * q.T);
  const D_ = mod(p.Z * 2n * q.Z);
  const E = mod(B - A);
  const F = mod(D_ - C);
  const G = mod(D_ + C);
  const H = mod(B + A);
  return {
    X: mod(E * F),
    Y: mod(G * H),
    Z: mod(F * G),
    T: mod(E * H),
  };
}

function pointMultiply(p: ExtPoint, scalar: bigint): ExtPoint {
  let res = ZERO_POINT;
  let addend = p;
  let n = scalar;
  while (n > 0n) {
    if (n & 1n) {
      res = pointAdd(res, addend);
    }
    addend = pointAdd(addend, addend);
    n >>= 1n;
  }
  return res;
}

function encodePoint(p: ExtPoint): Uint8Array {
  const zInv = modInverse(p.Z);
  const x = mod(p.X * zInv);
  const y = mod(p.Y * zInv);
  const out = bigIntToBytesLE(y, 32);
  out[31] |= Number(x & 1n) << 7;
  return out;
}

function decodePoint(bytes: Uint8Array): ExtPoint | null {
  if (bytes.length !== 32) return null;
  const copy = new Uint8Array(bytes);
  const sign = (copy[31] & 0x80) !== 0;
  copy[31] &= 0x7f;
  const y = bytesLEToBigInt(copy);
  const x = recoverX(y, sign);
  if (x === null) return null;
  return { X: x, Y: y, Z: 1n, T: mod(x * y) };
}

function bytesLEToBigInt(bytes: Uint8Array): bigint {
  let res = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    res = (res << 8n) | BigInt(bytes[i]);
  }
  return res;
}

function bigIntToBytesLE(val: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let v = val;
  for (let i = 0; i < length; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const res = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    res.set(a, offset);
    offset += a.length;
  }
  return res;
}

function ed25519GetPublicKeySync(seed32: Uint8Array): Uint8Array {
  if (seed32.length !== 32) {
    throw new Error('Ed25519 seed must be exactly 32 bytes.');
  }
  const h = sha512Sync(seed32);
  h[0] &= 248;
  h[31] &= 127;
  h[31] |= 64;
  const s = bytesLEToBigInt(h.slice(0, 32));
  const A = pointMultiply(BASE_POINT, s);
  return encodePoint(A);
}

function ed25519SignSync(message: Uint8Array, seed32: Uint8Array): Uint8Array {
  const h = sha512Sync(seed32);
  h[0] &= 248;
  h[31] &= 127;
  h[31] |= 64;
  const s = bytesLEToBigInt(h.slice(0, 32));
  const prefix = h.slice(32, 64);
  const A = encodePoint(pointMultiply(BASE_POINT, s));

  const rHash = sha512Sync(concatBytes(prefix, message));
  const r = mod(bytesLEToBigInt(rHash), L);
  const R = encodePoint(pointMultiply(BASE_POINT, r));

  const kHash = sha512Sync(concatBytes(R, A, message));
  const k = mod(bytesLEToBigInt(kHash), L);
  const S = mod(r + k * s, L);
  const SBytes = bigIntToBytesLE(S, 32);

  return concatBytes(R, SBytes);
}

function ed25519VerifySync(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): boolean {
  if (signature.length !== 64 || publicKey.length !== 32) return false;
  const RBytes = signature.slice(0, 32);
  const SBytes = signature.slice(32, 64);
  const S = bytesLEToBigInt(SBytes);
  if (S >= L) return false;

  const R = decodePoint(RBytes);
  const A = decodePoint(publicKey);
  if (!R || !A) return false;

  const kHash = sha512Sync(concatBytes(RBytes, publicKey, message));
  const k = mod(bytesLEToBigInt(kHash), L);

  const lhs = pointMultiply(BASE_POINT, S);
  const rhs = pointAdd(R, pointMultiply(A, k));
  const lhsEnc = encodePoint(lhs);
  const rhsEnc = encodePoint(rhs);

  if (lhsEnc.length !== rhsEnc.length) return false;
  let diff = 0;
  for (let i = 0; i < lhsEnc.length; i++) {
    diff |= lhsEnc[i] ^ rhsEnc[i];
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization for Packet Signing
// ---------------------------------------------------------------------------

export function canonicalizePacketForSigning(packet: Record<string, any>): string {
  const cleanClone = stripSignatureFields(packet);
  return stableJsonStringify(cleanClone);
}

function stripSignatureFields(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'sig' || k === 'signature' || k === 'verifyPub') continue;
    out[k] = v;
  }
  return out;
}

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${stableJsonStringify(record[k])}`);
  return `{${pairs.join(',')}}`;
}

// ---------------------------------------------------------------------------
// Public API (`generateSignSeed`, `derivePublicKeyFromSeed`, `signPacket`, `verifyPacket`)
// ---------------------------------------------------------------------------

/**
 * Generates a fresh 256-bit (32-byte) Ed25519 `signSeed` encoded as Base64URL (43 chars).
 */
export function generateSignSeed(): string {
  const seed = new Uint8Array(32);
  globalThis.crypto.getRandomValues(seed);
  return toBase64URL(seed);
}

/**
 * Derives the 32-byte Ed25519 `verifyPub` (Base64URL) from a 32-byte `signSeed` (Base64URL).
 */
export function derivePublicKeyFromSeed(signSeedB64Url: string): string {
  const seedBytes = fromBase64URL((signSeedB64Url || '').trim());
  const pubBytes = ed25519GetPublicKeySync(seedBytes);
  return toBase64URL(pubBytes);
}

/**
 * Computes the Base64URL Ed25519 signature string for an arbitrary packet using `signSeedB64Url`.
 */
export function signPacket(
  packet: Record<string, any>,
  signSeedB64Url: string
): string {
  const cleanSeed = (signSeedB64Url || '').trim();
  if (!cleanSeed) {
    throw new Error('signSeed is required to sign a capability packet.');
  }
  const seedBytes = fromBase64URL(cleanSeed);
  const canonical = canonicalizePacketForSigning(packet);
  const msgBytes = new TextEncoder().encode(canonical);
  const sigBytes = ed25519SignSync(msgBytes, seedBytes);
  return toBase64URL(sigBytes);
}

/**
 * Verifies the Ed25519 signature on a packet against `expectedVerifyPubB64Url`.
 * Supports both:
 *   - `verifyPacket(packet, sigB64Url, expectedVerifyPubB64Url)`
 *   - `verifyPacket(signedPacketWithEmbeddedSig, expectedVerifyPubB64Url)`
 * Returns `false` (never throws) if the signature is missing, malformed, signed by a different key,
 * or if any field in the packet was tampered with.
 */
export function verifyPacket(
  packet: Record<string, any> | null | undefined,
  sigOrVerifyPub: string,
  maybeVerifyPub?: string
): boolean {
  try {
    if (!packet || typeof packet !== 'object') return false;
    const hasExplicitSigArg = typeof maybeVerifyPub === 'string';
    const sigStr = hasExplicitSigArg
      ? (sigOrVerifyPub || '').trim()
      : typeof packet.sig === 'string'
      ? packet.sig.trim()
      : '';
    const pubStr = hasExplicitSigArg
      ? (maybeVerifyPub || '').trim()
      : (sigOrVerifyPub || '').trim();

    if (!sigStr || !pubStr) return false;

    if (typeof packet.verifyPub === 'string' && packet.verifyPub.trim() !== pubStr) {
      return false;
    }

    const sigBytes = fromBase64URL(sigStr);
    const pubBytes = fromBase64URL(pubStr);
    if (sigBytes.length !== 64 || pubBytes.length !== 32) return false;

    const canonical = canonicalizePacketForSigning(packet);
    const msgBytes = new TextEncoder().encode(canonical);
    return ed25519VerifySync(sigBytes, msgBytes, pubBytes);
  } catch {
    return false;
  }
}
