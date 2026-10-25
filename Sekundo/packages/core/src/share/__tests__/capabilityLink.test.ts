/**
 * Sekundo — Capability URL v3 & Ed25519 Signed Packets Unit Tests
 *
 * Verifies:
 * - `createCapabilityLink` generates URLs <= 200 chars with keys exclusively after `#`
 * - `encryptBlobWithReadKey` / `decryptBlobWithReadKey` round-trip and wrong-key failure
 * - `signPacket` / `verifyPacket` Ed25519 cryptographic authenticity
 * - `applyIncomingCollabPacket` rejects unsigned, forged, or tampered mutation packets when `verifyPub` is active (`SEC-02`)
 * - `signActivityLogEntry` / `verifyActivityLogEntrySignature` (`SEC-09`)
 */

import { describe, it, expect } from 'vitest';
import {
  createCapabilityLink,
  parseCapabilityUrl,
  encryptBlobWithReadKey,
  decryptBlobWithReadKey,
  generateReadKey,
} from '../capabilityLink';
import {
  generateSignSeed,
  derivePublicKeyFromSeed,
  signPacket,
  verifyPacket,
} from '../signedPacket';
import {
  signCollabPacket,
  applyIncomingCollabPacket,
  type CollabPacketPayloadV2,
} from '../../sync/collabRoomProtocol';
import { createLedgerOperation } from '../../sync/operationLedger';
import {
  createActivityLogEntry,
  verifyActivityLogEntrySignature,
} from '../../audit/activityLogEngine';
import type { FlatSkeletonEntry } from '../../skeleton/types';

const SAMPLE_SKELETON: FlatSkeletonEntry[] = [
  {
    key: 'Territorio_01',
    label: 'Território 01 - Centro',
    type: 'category',
    value: 0,
    attributes: { number: '01', notes: 'Segredo interno' },
  },
  {
    key: 'Territorio_01.Quadra_01',
    label: 'Quadra 01',
    type: 'category',
    value: 0,
    attributes: { territory_number: '01' },
  },
  {
    key: 'Territorio_01.Quadra_01.Casa_01',
    label: 'Rua das Palmeiras, 100',
    type: 'leaf',
    value: 0,
    attributes: { address: 'Rua das Palmeiras, 100', worked: '0', notes: 'Não bater' },
  },
  {
    key: 'Territorio_02',
    label: 'Território 02 - Norte',
    type: 'category',
    value: 0,
    attributes: { number: '02' },
  },
];

describe('capabilityLink & signedPacket — Zero-Bureaucracy Capability URLs v3', () => {
  it('generates a capability URL <= 200 chars with keys exclusively in the # fragment', async () => {
    const artifacts = await createCapabilityLink({
      baseUrl: 'https://sekundo.app',
      source: {
        eventId: 'evt_01',
        title: 'Territórios Campo',
        skeleton: SAMPLE_SKELETON,
      },
      scope: {
        kind: 'territories',
        keys: ['Territorio_01'],
        mode: 'edit',
        includeNotes: false,
      },
    });

    expect(artifacts.url.length).toBeLessThanOrEqual(200);
    expect(artifacts.url).toContain(`/s/${artifacts.blobId}#r=${artifacts.readKey}`);
    expect(artifacts.url).toContain(`&w=${artifacts.signSeed}`);

    // The HTTP path/query before '#' must NEVER contain readKey or signSeed
    const [beforeHash, afterHash] = artifacts.url.split('#');
    expect(beforeHash).not.toContain(artifacts.readKey);
    expect(beforeHash).not.toContain(artifacts.signSeed!);
    expect(afterHash).toContain(`r=${artifacts.readKey}`);

    const parsed = parseCapabilityUrl(artifacts.url);
    expect(parsed).not.toBeNull();
    expect(parsed?.blobId).toBe(artifacts.blobId);
    expect(parsed?.readKey).toBe(artifacts.readKey);
    expect(parsed?.signSeed).toBe(artifacts.signSeed);
    expect(parsed?.mode).toBe('edit');

    // Decrypt the blob using the #r key
    const decrypted = await decryptBlobWithReadKey(artifacts.encryptedBlob, artifacts.readKey);
    expect(decrypted.protocol).toBe('SEKUNDO_CAP_v3');
    expect(decrypted.verifyPub).toBe(artifacts.verifyPub);
    expect(decrypted.projection.nodes.every((n) => n.key.startsWith('Territorio_01'))).toBe(true);
    expect(JSON.stringify(decrypted)).not.toContain('Territorio_02');
    expect(JSON.stringify(decrypted)).not.toContain('Segredo interno');
  });

  it('omits #w signSeed on read-only capability links', async () => {
    const artifacts = await createCapabilityLink({
      baseUrl: 'https://sekundo.app',
      source: {
        eventId: 'evt_01',
        title: 'Somente Leitura',
        skeleton: SAMPLE_SKELETON,
      },
      scope: {
        kind: 'territories',
        keys: ['Territorio_01'],
        mode: 'read',
        includeNotes: false,
      },
    });

    expect(artifacts.url.length).toBeLessThanOrEqual(200);
    expect(artifacts.signSeed).toBeUndefined();
    expect(artifacts.url).not.toContain('&w=');

    const parsed = parseCapabilityUrl(artifacts.url);
    expect(parsed?.mode).toBe('read');
    expect(parsed?.signSeed).toBeUndefined();
  });

  it('fails decryption when given a wrong readKey', async () => {
    const readKey = generateReadKey();
    const wrongKey = generateReadKey();
    const blob = await encryptBlobWithReadKey(
      {
        protocol: 'SEKUNDO_CAP_v3',
        blobId: 'blob_test_123456',
        projection: {
          version: 3,
          eventId: 'evt_1',
          title: 'Teste',
          scope: { kind: 'territories', keys: ['Territorio_01'], mode: 'read', includeNotes: false },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          nodes: [],
        },
      },
      readKey
    );

    await expect(decryptBlobWithReadKey(blob, wrongKey)).rejects.toThrow();
  });

  it('signs and verifies packets with Ed25519 and rejects tampered payloads', () => {
    const seed = generateSignSeed();
    const pub = derivePublicKeyFromSeed(seed);
    const otherSeed = generateSignSeed();

    const packet = {
      packetId: 'pkt_01',
      roomId: 'room_01',
      kind: 'DELTA_MUTATION',
      operations: [{ key: 'Territorio_01.Quadra_01.Casa_01', value: 1 }],
    };

    const sig = signPacket(packet, seed);
    expect(verifyPacket(packet, sig, pub)).toBe(true);

    // Wrong public key / wrong seed
    const wrongSig = signPacket(packet, otherSeed);
    expect(verifyPacket(packet, wrongSig, pub)).toBe(false);

    // Tampered payload after signing
    const tampered = {
      ...packet,
      operations: [{ key: 'Territorio_01.Quadra_01.Casa_01', value: 0 }],
    };
    expect(verifyPacket(tampered, sig, pub)).toBe(false);
  });

  it('enforces Ed25519 signature verification in applyIncomingCollabPacket when verifyPub is set (SEC-02)', () => {
    const seed = generateSignSeed();
    const verifyPub = derivePublicKeyFromSeed(seed);
    const attackerSeed = generateSignSeed();

    const baseState = {
      eventId: 'evt_cap',
      skeleton: SAMPLE_SKELETON,
      privilegeRoster: [],
      ledger: [],
      activityLog: [],
      verifyPub,
    };

    const unsignedMutation: CollabPacketPayloadV2 = {
      protocol: 'SEKUNDO_COLLAB_v2',
      packetId: 'pkt_unsigned',
      roomId: 'room_cap',
      eventId: 'evt_cap',
      kind: 'DELTA_MUTATION',
      sentAt: new Date().toISOString(),
      author: {
        peerId: 'peer_1',
        participantId: 'part_1',
        fullName: 'Forjador',
        groupTag: 'G1',
        role: 'ADMIN_SEAL',
        hasAdminSeal: true,
      },
      operations: [
        createLedgerOperation(
          'evt_cap',
          'Territorio_01.Quadra_01.Casa_01',
          'value',
          1,
          'peer_1'
        ),
      ],
    };

    // 1. Unsigned packet must be rejected even if author claims hasAdminSeal: true
    const resUnsigned = applyIncomingCollabPacket(baseState, unsignedMutation);
    expect(resUnsigned.accepted).toBe(false);
    expect(resUnsigned.rejectedReason).toBe('INVALID_ED25519_SIGNATURE');

    // 2. Packet signed with attacker's seed must be rejected
    const forgedPacket = signCollabPacket(unsignedMutation, attackerSeed);
    const resForged = applyIncomingCollabPacket(baseState, forgedPacket);
    expect(resForged.accepted).toBe(false);
    expect(resForged.rejectedReason).toBe('INVALID_ED25519_SIGNATURE');

    // 3. Packet signed with the capability link's legitimate #w seed is accepted!
    const validSignedPacket = signCollabPacket(unsignedMutation, seed);
    const resValid = applyIncomingCollabPacket(baseState, validSignedPacket);
    expect(resValid.accepted).toBe(true);
    const updatedLeaf = resValid.updatedSkeleton.find(
      (n) => n.key === 'Territorio_01.Quadra_01.Casa_01'
    );
    expect(Number(updatedLeaf?.value)).toBe(1);
  });

  it('signs and verifies ActivityLogEntry with Ed25519 (SEC-09)', () => {
    const seed = generateSignSeed();
    const pub = derivePublicKeyFromSeed(seed);

    const entry = createActivityLogEntry({
      eventId: 'evt_01',
      actorId: 'peer_1',
      actorName: 'Participante 01',
      actorRole: 'ADMIN_SEAL',
      actionType: 'CELL_EDITED',
      summary: 'Quadra 01 marcada como concluída',
      signSeed: seed,
    });

    expect(entry.sig).toBeDefined();
    expect(entry.verifyPub).toBe(pub);
    expect(verifyActivityLogEntrySignature(entry, pub)).toBe(true);

    // Tampering with actorName or summary invalidates the Ed25519 signature
    const tampered = { ...entry, actorName: 'Outro Nome' };
    expect(verifyActivityLogEntrySignature(tampered, pub)).toBe(false);
  });
});
