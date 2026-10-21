import { describe, it, expect } from 'vitest';
import {
  createLedgerOperation,
  applyOperationToRegistry,
  reconcileLedgers,
  exportLedgerDelta,
  createP2PSyncMessage,
} from '../sync/operationLedger';
import type { FlatSkeletonEntry } from '../skeleton/types';

describe('Sovereign Local-First Operation Ledger & Sync Engine', () => {
  const baseRegistry: FlatSkeletonEntry[] = [
    {
      key: '02-01-01-01',
      type: 'territory',
      label: 'Via Operacional, 202',
      value: '',
      meta: {
        worked: 0,
        notes: '',
      },
    },
    {
      key: '02-01-01-02',
      type: 'territory',
      label: 'Via Operacional, 204',
      value: '',
      meta: {
        worked: 0,
        notes: '',
      },
    },
  ];

  it('creates an immutable operation with unique ID and timestamp', () => {
    const op = createLedgerOperation(
      'event-1',
      '02-01-01-01',
      'worked',
      1,
      'device-author-a',
      { authorName: 'Participante 01' }
    );

    expect(op.eventId).toBe('event-1');
    expect(op.nodeKey).toBe('02-01-01-01');
    expect(op.field).toBe('worked');
    expect(op.newValue).toBe(1);
    expect(op.authorName).toBe('Participante 01');
    expect(op.opId).toMatch(/^op_\d+_/);
  });

  it('applies operation to registry without mutating other nodes', () => {
    const op = createLedgerOperation(
      'event-1',
      '02-01-01-01',
      'worked',
      1,
      'device-a',
      { authorName: 'Participante 01' }
    );

    const updated = applyOperationToRegistry(baseRegistry, op);
    expect(updated[0].meta?.worked).toBe(1);
    expect(updated[0].meta?.workerName).toBe('Participante 01');
    expect(updated[1].meta?.worked).toBe(0); // Unchanged
  });

  it('reconciles non-conflicting concurrent edits from two different peers without data loss', () => {
    // Peer A marks house 1 as worked
    const opA = createLedgerOperation(
      'event-1',
      '02-01-01-01',
      'worked',
      1,
      'device-a',
      { authorName: 'Participante 01', timestamp: '2026-10-13T10:00:00Z' }
    );
    const localLedger = [opA];

    // Peer B writes a note on house 2
    const opB = createLedgerOperation(
      'event-1',
      '02-01-01-02',
      'notes',
      'Reagendado para o turno da tarde',
      'device-b',
      { authorName: 'Participante 02', timestamp: '2026-10-13T10:05:00Z' }
    );
    const incomingLedger = [opB];

    const result = reconcileLedgers(localLedger, incomingLedger, baseRegistry);

    expect(result.appliedOpsCount).toBe(1);
    expect(result.consolidatedLedger.length).toBe(2);

    // Verify both changes are preserved in the reconciled registry
    const house1 = result.updatedRegistry.find((e) => e.key === '02-01-01-01');
    const house2 = result.updatedRegistry.find((e) => e.key === '02-01-01-02');

    expect(house1?.meta?.worked).toBe(1);
    expect(house2?.meta?.notes).toBe('Reagendado para o turno da tarde');
  });

  it('resolves conflicting edits on the same attribute by latest timestamp', () => {
    // Edit 1: Earlier timestamp
    const opEarlier = createLedgerOperation(
      'event-1',
      '02-01-01-01',
      'notes',
      'Primeira nota',
      'device-a',
      { timestamp: '2026-10-13T10:00:00Z' }
    );

    // Edit 2: Later timestamp
    const opLater = createLedgerOperation(
      'event-1',
      '02-01-01-01',
      'notes',
      'Nota corrigida mais recente',
      'device-b',
      { timestamp: '2026-10-13T10:15:00Z' }
    );

    const result = reconcileLedgers([opEarlier], [opLater], baseRegistry);

    expect(result.conflictsResolvedCount).toBe(1);
    const house1 = result.updatedRegistry.find((e) => e.key === '02-01-01-01');
    expect(house1?.meta?.notes).toBe('Nota corrigida mais recente');
  });

  it('exports deltas since a given timestamp', () => {
    const op1 = createLedgerOperation('e1', 'k1', 'worked', 1, 'd1', {
      timestamp: '2026-10-13T08:00:00Z',
    });
    const op2 = createLedgerOperation('e1', 'k2', 'worked', 1, 'd1', {
      timestamp: '2026-10-13T12:00:00Z',
    });

    const delta = exportLedgerDelta([op1, op2], '2026-10-13T10:00:00Z');
    expect(delta.length).toBe(1);
    expect(delta[0].nodeKey).toBe('k2');
  });

  it('creates valid P2P sync messages for WebRTC DataChannel', () => {
    const op = createLedgerOperation('e1', 'k1', 'worked', 1, 'd1');
    const msg = createP2PSyncMessage('e1', 'd1', [op], 'Participante 01');

    expect(msg.type).toBe('SEKUNDO_DELTA_SYNC');
    expect(msg.operations.length).toBe(1);
    expect(msg.senderName).toBe('Participante 01');
  });
});
