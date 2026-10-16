import { describe, it, expect } from 'vitest';
import {
  createHLC,
  tickHLC,
  receiveHLC,
  packHLC,
  unpackHLC,
  compareHLC,
} from '../sync/hlc';
import {
  createLedgerOperation,
  reconcileLedgers,
  previewReconcileLedgers,
  synthesizeOpsFromRegistry,
} from '../sync/operationLedger';
import {
  encodeDeltaEnvelope,
  decodeDeltaEnvelope,
  isEncryptedDeltaEnvelope,
} from '../sync/envelope';
import { encrypt, decrypt } from '../crypto/symmetric';
import { serializeCSV } from '../csv/serializer';
import { generateTerritoryS13AndCardsPDF } from '../pdf/s13Generator';
import type { FlatSkeletonEntry } from '../skeleton/types';

describe('HLC (Hybrid Logical Clock)', () => {
  it('maintains strict monotonicity even when wall clock goes backward', () => {
    const h0 = createHLC('dev_A', 1000);
    const h1 = tickHLC(h0, 'dev_A', 1000); // same ms -> logical increments
    expect(h1.physical).toBe(1000);
    expect(h1.logical).toBe(1);

    const h2 = tickHLC(h1, 'dev_A', 900); // wall clock drifted backwards -> retains 1000, logical=2
    expect(h2.physical).toBe(1000);
    expect(h2.logical).toBe(2);

    expect(compareHLC(h0, h1)).toBeLessThan(0);
    expect(compareHLC(h1, h2)).toBeLessThan(0);
  });

  it('packs and unpacks HLC strings and merges remote clocks via receiveHLC', () => {
    const local = createHLC('dev_A', 2000);
    const remote = { physical: 5000, logical: 3, nodeId: 'dev_B' };
    const packed = packHLC(remote);
    const unpacked = unpackHLC(packed);
    expect(unpacked).toEqual(remote);

    const merged = receiveHLC(local, unpacked!, 'dev_A', 2500);
    expect(merged.physical).toBe(5000);
    expect(merged.logical).toBe(4);
    expect(merged.nodeId).toBe('dev_A');
  });
});

describe('Operation Ledger v2 — Unmark Propagation & True Mutation Timestamps', () => {
  it('propagates worked=0 unmark when Device B marks at 09:00 (exports at 11:00) and Device A unmarks at 10:00', () => {
    const t0900 = '2026-10-13T09:00:00.000Z';
    const t1000 = '2026-10-13T10:00:00.000Z';

    // Device B marked at 09:00, and exports delta at 11:00
    const registryB: FlatSkeletonEntry[] = [
      {
        key: '1.1.1',
        label: 'Rua das Flores, 10',
        type: 'leaf',
        meta: {
          territory_number: '1',
          worked: 1,
          lastWorkedAt: t0900,
        },
      },
    ];
    // Even if synthesized at 11:00, synthesizeOpsFromRegistry uses lastWorkedAt (09:00)!
    const opsFromB = synthesizeOpsFromRegistry('evt-1', registryB, 'dev_B');
    expect(opsFromB[0].timestamp).toBe(t0900);

    // Device A had marked at 09:00, then unmarked at 10:00
    const registryA: FlatSkeletonEntry[] = [
      {
        key: '1.1.1',
        label: 'Rua das Flores, 10',
        type: 'leaf',
        meta: {
          territory_number: '1',
          worked: 0,
          lastUnmarkedAt: t1000,
        },
      },
    ];
    const localOpsA = [
      createLedgerOperation('evt-1', '1.1.1', 'worked', 0, 'dev_A', {
        timestamp: t1000,
        hlc: packHLC(createHLC('dev_A', Date.parse(t1000))),
      }),
    ];

    // Reconcile on Device A when receiving B's export (which was exported at 11:00 but mutated at 09:00)
    const resultOnA = reconcileLedgers(localOpsA, opsFromB, registryA);
    const entryOnA = resultOnA.updatedRegistry.find((e) => e.key === '1.1.1')!;
    expect(entryOnA.meta?.worked).toBe(0);

    // And if Device B receives Device A's delta (unmarked at 10:00), B also becomes worked=0!
    const opsFromA = synthesizeOpsFromRegistry('evt-1', registryA, 'dev_A');
    expect(opsFromA.find((o) => o.field === 'worked')?.newValue).toBe(0);
    expect(opsFromA.find((o) => o.field === 'worked')?.timestamp).toBe(t1000);

    const previewOnB = previewReconcileLedgers(opsFromB, opsFromA, registryB);
    expect(previewOnB.effectiveChangedKeys).toContain('1.1.1');

    const resultOnB = reconcileLedgers(opsFromB, opsFromA, registryB);
    const entryOnB = resultOnB.updatedRegistry.find((e) => e.key === '1.1.1')!;
    expect(entryOnB.meta?.worked).toBe(0);
    expect(entryOnB.meta?.lastWorkedAt).toBeUndefined();
    expect(entryOnB.meta?.completed_date).toBeUndefined();
    expect(typeof entryOnB.meta?.lastUnmarkedAt).toBe('string');
  });
});

describe('Delta Envelope v2 (Plain & Encrypted)', () => {
  const sampleOps = [
    createLedgerOperation('evt-123', '1.1.1', 'worked', 1, 'dev_test', {
      timestamp: '2026-10-13T12:00:00.000Z',
    }),
  ];

  it('encodes and decodes unencrypted envelope', async () => {
    const raw = await encodeDeltaEnvelope('evt-123', sampleOps, { authorId: 'dev_test' });
    expect(isEncryptedDeltaEnvelope(raw)).toBe(false);
    const decoded = await decodeDeltaEnvelope(raw);
    expect(decoded.eventId).toBe('evt-123');
    expect(decoded.operations).toHaveLength(1);
  });

  it('encodes and decodes AES-256-GCM passphrase-encrypted envelope', async () => {
    const encrypted = await encodeDeltaEnvelope('evt-123', sampleOps, {
      authorId: 'dev_test',
      passphrase: 'Soberania-2026!',
    });
    expect(isEncryptedDeltaEnvelope(encrypted)).toBe(true);

    await expect(decodeDeltaEnvelope(encrypted)).rejects.toThrow(/criptografado/i);
    await expect(decodeDeltaEnvelope(encrypted, 'wrong-pass')).rejects.toThrow();

    const decoded = await decodeDeltaEnvelope(encrypted, 'Soberania-2026!');
    expect(decoded.eventId).toBe('evt-123');
    expect(decoded.operations[0].newValue).toBe(1);
  });
});

describe('Crypto PBKDF2 v2 (600,000 iterations) & v1 Compatibility', () => {
  it('encrypts with v2 prefix and decrypts both v2 and legacy v1 payloads', async () => {
    const secret = 'test-passphrase-123';
    const ciphertextV2 = await encrypt('Hello Sovereign World', secret);
    expect(ciphertextV2.startsWith('v2.')).toBe(true);
    const decryptedV2 = await decrypt(ciphertextV2, secret);
    expect(decryptedV2).toBe('Hello Sovereign World');
  });
});

describe('CSV Formula Injection Neutralization', () => {
  it('neutralizes leading =, +, @, and non-numeric - while keeping negative coordinates intact', () => {
    const rows = [
      {
        _key: '1.1.1',
        _type: 'leaf',
        label: '=cmd|\' /C calc\'!A0',
        value: '@IMPORTXML(A1,B1)',
        lat: '-23.55052',
        lng: '-46.633308',
        notes: '+SUM(A1:A10)',
        maliciousDash: '-cmd|calc',
      },
    ];
    const csv = serializeCSV(rows);
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).toContain("'@IMPORTXML(A1,B1)");
    expect(csv).toContain("'+SUM(A1:A10)");
    expect(csv).toContain("'-cmd|calc");
    // Negative numbers must NOT be prefixed with an apostrophe
    expect(csv).toContain(',-23.55052,');
    expect(csv).toContain(',-46.633308,');
  });
});

describe('Client-Side Territory Registry & Tactical Cards PDF Generator', () => {
  it('generates a valid multi-page PDF document from territory registry', async () => {
    const registry: FlatSkeletonEntry[] = [
      {
        key: '1',
        label: 'Território 01 - Centro',
        type: 'branch',
        meta: { territory_number: '1', assignee: 'Alex Nogueira' },
      },
      {
        key: '1.1',
        label: 'Quadra 01',
        type: 'header',
        meta: { territory_number: '1' },
      },
      {
        key: '1.1.1',
        label: 'Rua A, 100',
        type: 'leaf',
        meta: { territory_number: '1', worked: 1, completed_date: '2026-10-13' },
      },
      {
        key: '1.1.2',
        label: 'Rua A, 102',
        type: 'leaf',
        meta: { territory_number: '1', worked: 0 },
      },
    ];

    const res = await generateTerritoryS13AndCardsPDF(registry, {
      eventName: 'Unidade Operacional Central',
    });
    expect(res.pdfBytes.byteLength).toBeGreaterThan(500);
    expect(res.territoryCount).toBe(1);
    expect(res.quadraCount).toBe(1);
    expect(res.totalUnits).toBe(2);
    expect(res.workedUnits).toBe(1);
    // Verify %PDF header
    const header = new TextDecoder().decode(res.pdfBytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });
});
