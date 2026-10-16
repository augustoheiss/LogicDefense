import { describe, it, expect } from 'vitest';
import { upsertRegistry, rowToFlatEntry } from '../csv/upsert';
import type { FlatRegistry } from '../skeleton/types';
import type { CSVRow } from '../csv/types';

describe('State-Preserving Upsert Engine', () => {
  const currentRegistry: FlatRegistry = [
    {
      key: '01',
      type: 'header',
      label: 'Território Setor Central',
      value: '',
      email: '',
      meta: {},
    },
    {
      key: '01-01',
      type: 'territory',
      label: 'Quadra 01',
      value: '',
      email: '',
      meta: { worked: 1, lastWorkedAt: '2026-10-10T14:00:00Z' },
    },
    {
      key: '01-01-01',
      type: 'territory',
      label: 'Rua das Flores, 100',
      value: 'Alex Nogueira',
      email: '',
      meta: {
        worked: 1,
        lastWorkedAt: '2026-10-10T14:30:00Z',
        notes: 'Unidade visitada, entrega confirmada',
        lat: -23.541,
        lng: -46.368,
      },
    },
    {
      key: '01-01-02',
      type: 'territory',
      label: 'Rua das Flores, 102',
      value: '',
      email: '',
      meta: { worked: 0 },
    },
  ];

  it('preserves worked status, timestamp, and local notes when re-importing updated labels and coordinates', () => {
    const incomingRows: CSVRow[] = [
      {
        _key: '01',
        _type: 'header',
        label: 'Território Setor Central - Bloco A', // Updated label
      },
      {
        _key: '01-01',
        _type: 'territory',
        label: 'Quadra 01 - Bloco A', // Updated label
      },
      {
        _key: '01-01-01',
        _type: 'territory',
        label: 'Rua das Flores, 100 (Casa Alta)', // Updated label
        _meta_json: JSON.stringify({
          worked: 0, // In fresh export this might be 0 or unassigned
          lat: -23.5412, // Fine-tuned GPS coordinate
          lng: -46.3681,
        }),
      },
      {
        _key: '01-01-03', // NEW HOUSE ADDED TO SPREADSHEET
        _type: 'territory',
        label: 'Rua das Flores, 104',
        _meta_json: JSON.stringify({
          lat: -23.5415,
          lng: -46.3683,
        }),
      },
    ];

    const result = upsertRegistry(currentRegistry, incomingRows);

    expect(result.diff.addedCount).toBe(1); // 01-01-03 added
    expect(result.diff.preservedHistoryCount).toBe(2); // 01-01 and 01-01-01 preserved worked: 1

    // Verify 01-01-01 maintained worked: 1 and its note despite incoming having worked: 0!
    const updatedHouse1 = result.updatedRegistry.find((n) => n.key === '01-01-01');
    expect(updatedHouse1).toBeDefined();
    expect(updatedHouse1?.label).toBe('Rua das Flores, 100 (Casa Alta)');
    expect(updatedHouse1?.meta.worked).toBe(1); // PRESERVED!
    expect(updatedHouse1?.meta.lastWorkedAt).toBe('2026-10-10T14:30:00Z'); // PRESERVED!
    expect(updatedHouse1?.meta.notes).toBe('Unidade visitada, entrega confirmada'); // PRESERVED!
    // But coordinates were updated
    expect(updatedHouse1?.meta.lat).toBe(-23.5412);
    expect(updatedHouse1?.meta.lng).toBe(-46.3681);

    // Verify 01-01-02 was preserved because preserveUnmatchedCurrent defaults to true
    const untouchedHouse2 = result.updatedRegistry.find((n) => n.key === '01-01-02');
    expect(untouchedHouse2).toBeDefined();

    // Verify new house 01-01-03 was added with default worked: 0
    const newHouse3 = result.updatedRegistry.find((n) => n.key === '01-01-03');
    expect(newHouse3).toBeDefined();
    expect(newHouse3?.meta.worked).toBe(0);
    expect(newHouse3?.meta.lat).toBe(-23.5415);
  });

  it('supports forceOverwriteState: true when user explicitly wants to reset field records', () => {
    const incomingRows: CSVRow[] = [
      {
        _key: '01-01-01',
        _type: 'territory',
        label: 'Rua das Flores, 100',
        _meta_json: JSON.stringify({
          worked: 0,
        }),
      },
    ];

    const result = upsertRegistry(currentRegistry, incomingRows, {
      forceOverwriteState: true,
    });

    const house1 = result.updatedRegistry.find((n) => n.key === '01-01-01');
    expect(house1?.meta.worked).toBe(0); // Overwritten because forceOverwriteState is true
  });

  it('correctly handles extra CSV columns into meta dictionary', () => {
    const rowWithExtraCols: CSVRow = {
      _key: '02-01-01',
      _type: 'territory',
      label: 'Rua da Estação, 45',
      bairro: 'Centro',
      cep: '08500-000',
      lat: '-23.52',
      lng: '-46.35',
    };

    const entry = rowToFlatEntry(rowWithExtraCols);
    expect(entry.key).toBe('02-01-01');
    expect(entry.meta.bairro).toBe('Centro');
    expect(entry.meta.cep).toBe('08500-000');
    expect(entry.meta.lat).toBe(-23.52);
    expect(entry.meta.lng).toBe(-46.35);
  });
});
