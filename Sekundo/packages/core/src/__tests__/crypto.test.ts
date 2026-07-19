/**
 * Sekundo — Crypto Engine Tests
 *
 * Tests cover:
 *   - AES-GCM encrypt/decrypt roundtrip
 *   - Wrong passphrase rejection
 *   - Base64URL encoding/decoding
 *   - Compress/decompress roundtrip
 *   - Full pipeline (encryptForURL / decryptFromURL)
 *   - Token generator (HorizonPayload)
 *   - URL construction & extraction
 *
 * Note: These tests require a runtime with Web Crypto API support.
 * Node 18+ and modern browsers provide this natively.
 * Vitest uses Node which has globalThis.crypto.
 */

import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  compress,
  decompress,
  encryptForURL,
  decryptFromURL,
  toBase64URL,
  fromBase64URL,
} from '../crypto/symmetric';
import {
  buildShareURL,
  extractTokenFromURL,
  buildHorizonPayload,
} from '../crypto/tokenGenerator';
import type { EventState } from '../events/types';
import type { FlatRegistry } from '../skeleton/types';

// ---------------------------------------------------------------------------
// Base64URL
// ---------------------------------------------------------------------------
describe('toBase64URL / fromBase64URL', () => {
  it('roundtrips a simple byte array', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const encoded = toBase64URL(original);
    const decoded = fromBase64URL(encoded);
    expect(decoded).toEqual(original);
  });

  it('produces URL-safe characters (no +, /, or =)', () => {
    // Use bytes that produce + and / in standard Base64
    const bytes = new Uint8Array([255, 254, 253, 252, 251, 250]);
    const encoded = toBase64URL(bytes);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });
});

// ---------------------------------------------------------------------------
// Encrypt / Decrypt
// ---------------------------------------------------------------------------
describe('encrypt / decrypt', () => {
  const passphrase = 'mermão-this-is-the-way-2026';

  it('roundtrips a simple string', async () => {
    const plaintext = 'Hello, Sekundo!';
    const encrypted = await encrypt(plaintext, passphrase);
    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted).toBe(plaintext);
  });

  it('roundtrips a JSON string', async () => {
    const json = JSON.stringify({ event: 'test', key: '01-01-01' });
    const encrypted = await encrypt(json, passphrase);
    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted).toBe(json);
  });

  it('roundtrips unicode content', async () => {
    const text = 'Irmão Silva — Presidente da Reunião 🌞';
    const encrypted = await encrypt(text, passphrase);
    const decrypted = await decrypt(encrypted, passphrase);
    expect(decrypted).toBe(text);
  });

  it('produces different ciphertext for same plaintext (random IV/salt)', async () => {
    const plaintext = 'Same input, different output';
    const a = await encrypt(plaintext, passphrase);
    const b = await encrypt(plaintext, passphrase);
    expect(a).not.toBe(b); // Random IV ensures uniqueness
  });

  it('rejects wrong passphrase', async () => {
    const plaintext = 'Secret data';
    const encrypted = await encrypt(plaintext, passphrase);
    await expect(decrypt(encrypted, 'wrong-pass')).rejects.toThrow();
  });

  it('rejects corrupted payload', async () => {
    await expect(decrypt('not.a.valid-payload', passphrase)).rejects.toThrow();
  });

  it('encrypted payload has salt.iv.ciphertext format', async () => {
    const encrypted = await encrypt('test', passphrase);
    const parts = encrypted.split('.');
    expect(parts).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Compress / Decompress
// ---------------------------------------------------------------------------
describe('compress / decompress', () => {
  it('roundtrips a string', async () => {
    const input = 'Hello, compressed world!';
    const compressed = await compress(input);
    const decompressed = await decompress(compressed);
    expect(decompressed).toBe(input);
  });

  it('roundtrips a large JSON payload', async () => {
    // Simulate a realistic skeleton payload
    const data = Array.from({ length: 100 }, (_, i) => ({
      key: `01-${String(i).padStart(2, '0')}`,
      type: 'slot',
      label: `Slot ${i}`,
      value: `Person ${i}`,
    }));
    const json = JSON.stringify(data);
    const compressed = await compress(json);
    const decompressed = await decompress(compressed);
    expect(decompressed).toBe(json);
  });

  it('compressed output is smaller than input for large data', async () => {
    const largeInput = 'A'.repeat(10_000);
    const compressed = await compress(largeInput);
    // Gzip should compress this significantly
    expect(compressed.length).toBeLessThan(largeInput.length);
  });
});

// ---------------------------------------------------------------------------
// Full Pipeline (encryptForURL / decryptFromURL)
// ---------------------------------------------------------------------------
describe('encryptForURL / decryptFromURL', () => {
  const passphrase = 'sekundo-sol-energia-pura';

  it('roundtrips a complex object', async () => {
    const data = {
      eventName: 'Reunião Semanal',
      skeletons: [
        { key: '01-01', label: 'Presidente', value: 'Irmão Silva' },
        { key: '01-02', label: 'Leitor', value: 'Irmão Santos' },
      ],
      territories: [
        { key: '03-01', label: 'Quadra Norte', value: 'Irmão Oliveira' },
      ],
    };

    const token = await encryptForURL(data, passphrase);
    const decrypted = await decryptFromURL(token, passphrase);
    expect(decrypted).toEqual(data);
  });

  it('produces a URL-safe string', async () => {
    const token = await encryptForURL({ test: true }, passphrase);
    // Should not contain characters that break URLs
    expect(token).not.toContain(' ');
    expect(token).not.toContain('\n');
  });
});

// ---------------------------------------------------------------------------
// Token Generator
// ---------------------------------------------------------------------------
describe('buildHorizonPayload', () => {
  it('builds payload with recent history only', () => {
    const state: EventState = {
      config: {
        id: 'test-id',
        name: 'Reunião Semanal',
        frequency: 'weekly',
        startDate: '2026-01-01',
        skeletonRoots: ['01', '02'],
        autoRollover: true,
        lastRolloverDate: '2026-07-14',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-07-14T00:00:00Z',
      },
      lifecycle: 'active',
      archive: [
        { date: '2026-06-30', values: { '01-01': 'Person A' } },
        { date: '2026-07-07', values: { '01-01': 'Person B' } },
        { date: '2026-07-14', values: { '01-01': 'Person C' } },
      ],
    };

    const skeleton: FlatRegistry = [
      {
        key: '01-01',
        type: 'slot',
        label: 'Presidente',
        value: 'Person D',
        email: '',
        meta: {},
      },
    ];

    const payload = buildHorizonPayload(state, skeleton);

    expect(payload.eventName).toBe('Reunião Semanal');
    expect(payload.eventFrequency).toBe('weekly');
    expect(payload.skeleton).toEqual(skeleton);
    // Should include only last 2 snapshots (HORIZON_WEEKS = 2)
    expect(payload.recentHistory).toHaveLength(2);
    expect(payload.recentHistory[0].date).toBe('2026-07-07');
    expect(payload.recentHistory[1].date).toBe('2026-07-14');
    expect(payload.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// URL Construction
// ---------------------------------------------------------------------------
describe('buildShareURL', () => {
  it('constructs URL with fragment', () => {
    const url = buildShareURL('https://sekundo.app', 'myToken123');
    expect(url).toBe('https://sekundo.app/#/view?data=myToken123');
  });

  it('strips trailing slash from base URL', () => {
    const url = buildShareURL('https://sekundo.app/', 'token');
    expect(url).toBe('https://sekundo.app/#/view?data=token');
  });
});

describe('extractTokenFromURL', () => {
  it('extracts token from valid URL', () => {
    const token = extractTokenFromURL(
      'https://sekundo.app/#/view?data=myToken123'
    );
    expect(token).toBe('myToken123');
  });

  it('returns null for URL without fragment', () => {
    expect(extractTokenFromURL('https://sekundo.app/')).toBeNull();
  });

  it('returns null for URL without data param', () => {
    expect(extractTokenFromURL('https://sekundo.app/#/view')).toBeNull();
  });
});
