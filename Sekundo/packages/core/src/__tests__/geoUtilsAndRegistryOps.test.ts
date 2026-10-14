import { describe, it, expect } from 'vitest';
import {
  resolveTerritoryNumber,
  parseLatLng,
  bufferPolygonMeters,
  polygonAreaM2,
} from '../geo/geoUtils';
import { applyNodeUpdates, buildWorkedMeta, createSerialQueue } from '../skeleton/registryOps';
import { extractQuadrasFromRegistry } from '../geo/quadraPolygonEngine';
import type { FlatRegistry } from '../skeleton/types';

describe('resolveTerritoryNumber', () => {
  it('prefers explicit metadata', () => {
    expect(resolveTerritoryNumber({ key: '02-01-01-05', meta: { territory_number: 'T7' } })).toBe('T7');
  });
  it('leaf at depth 4 belongs to its depth-3 ancestor', () => {
    expect(resolveTerritoryNumber({ key: '02-01-01-05' })).toBe('02-01-01');
  });
  it('depth-3 container is its own territory', () => {
    expect(resolveTerritoryNumber({ key: '02-01-01' }, true)).toBe('02-01-01');
  });
  it('pins and their quadra agree when meta is missing', () => {
    const registry: FlatRegistry = [
      { key: '02-01-01', type: 'header', label: 'Q', value: '', meta: {} },
      { key: '02-01-01-01', type: 'territory', label: 'Rua A, 1', value: '', meta: { lat: -23.5, lng: -46.3 } },
    ];
    const [q] = extractQuadrasFromRegistry(registry);
    expect(q.territoryNumber).toBe(resolveTerritoryNumber(registry[1]));
  });
});

describe('parseLatLng', () => {
  it('accepts numbers and strings with comma decimals', () => {
    expect(parseLatLng({ lat: -23.5, lng: -46.3 })).toEqual({ lat: -23.5, lng: -46.3 });
    expect(parseLatLng({ latitude: '-23,5', longitude: '-46,3' })).toEqual({ lat: -23.5, lng: -46.3 });
  });
  it('returns null instead of inventing a position', () => {
    expect(parseLatLng({})).toBeNull();
    expect(parseLatLng({ lat: 'abc', lng: 1 })).toBeNull();
    expect(parseLatLng({ lat: 0, lng: 0 })).toBeNull();
    expect(parseLatLng({ lat: 120, lng: 0 })).toBeNull();
  });
  it('lets the quadra engine use string coordinates', () => {
    const registry: FlatRegistry = [
      { key: '01-01-01', type: 'header', label: 'Q', value: '', meta: {} },
      { key: '01-01-01-01', type: 'territory', label: 'A, 1', value: '', meta: { latitude: '-23.500', longitude: '-46.300' } },
      { key: '01-01-01-02', type: 'territory', label: 'A, 2', value: '', meta: { latitude: '-23.501', longitude: '-46.300' } },
      { key: '01-01-01-03', type: 'territory', label: 'B, 3', value: '', meta: { latitude: '-23.501', longitude: '-46.301' } },
    ];
    const [q] = extractQuadrasFromRegistry(registry);
    expect(q.boundaryPolygon.length).toBeGreaterThanOrEqual(3);
  });
});

describe('bufferPolygonMeters', () => {
  // ~100 m x ~100 m square near São Paulo
  const square: [number, number][] = [
    [-23.5, -46.3],
    [-23.5, -46.299021],
    [-23.499096, -46.299021],
    [-23.499096, -46.3],
  ];

  it('grows a 100x100 m block visibly with +10 m', () => {
    const base = polygonAreaM2(square);
    const grown = polygonAreaM2(bufferPolygonMeters(square, 10));
    expect(base).toBeGreaterThan(9_000);
    expect(base).toBeLessThan(11_000);
    // (100+20)^2 / 100^2 = 1.44
    expect(grown / base).toBeGreaterThan(1.38);
    expect(grown / base).toBeLessThan(1.5);
  });

  it('shrinks with negative meters and is orientation independent', () => {
    const shrunk = polygonAreaM2(bufferPolygonMeters([...square].reverse(), -10));
    expect(shrunk / polygonAreaM2(square)).toBeGreaterThan(0.6);
    expect(shrunk / polygonAreaM2(square)).toBeLessThan(0.7);
  });

  it('0 m returns the same ring', () => {
    expect(bufferPolygonMeters(square, 0)).toEqual(square);
  });

  it('turns a single point into a box', () => {
    expect(bufferPolygonMeters([[-23.5, -46.3]], 5).length).toBe(4);
  });
});

describe('applyNodeUpdates (bulk toggle regression)', () => {
  const registry: FlatRegistry = Array.from({ length: 10 }, (_, i) => ({
    key: `01-01-01-${String(i + 1).padStart(2, '0')}`,
    type: 'territory' as const,
    label: `Casa ${i + 1}`,
    value: '',
    meta: { worked: 0 },
  }));

  it('applies all 10 patches in one pass (no lost updates)', () => {
    const patches = registry.map((n) => ({ key: n.key, updates: { meta: buildWorkedMeta(n.meta, 1) } }));
    const next = applyNodeUpdates(registry, patches);
    expect(next.filter((n) => (n.meta as any).worked === 1).length).toBe(10);
    expect(registry.every((n) => (n.meta as any).worked === 0)).toBe(true); // input untouched
  });

  it('accepts non-canonical keys', () => {
    const next = applyNodeUpdates(registry, [{ key: '1.1.1.3', updates: { value: 'x' } }]);
    expect(next[2].value).toBe('x');
  });
});

describe('buildWorkedMeta', () => {
  it('marks with dates and unmarks clearing every alias', () => {
    const now = new Date('2026-10-13T12:00:00Z');
    const marked = buildWorkedMeta({ notes: 'n' }, 1, now);
    expect(marked).toMatchObject({ worked: 1, completedAt: '2026-10-13', data_conclusao: '2026-10-13', notes: 'n' });
    const unmarked = buildWorkedMeta(marked, 0, now);
    expect(unmarked.worked).toBe(0);
    expect(unmarked.completedAt).toBeUndefined();
    expect(unmarked.lastWorkedAt).toBeUndefined();
    expect(unmarked.notes).toBe('n');
  });
});

describe('createSerialQueue', () => {
  it('runs tasks in order even when earlier ones are slower', async () => {
    const enqueue = createSerialQueue();
    const order: number[] = [];
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await Promise.all([
      enqueue(async () => { await wait(20); order.push(1); }),
      enqueue(async () => { order.push(2); }),
      enqueue(async () => { await wait(5); order.push(3); }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('keeps running after a failed task', async () => {
    const enqueue = createSerialQueue();
    await expect(enqueue(async () => { throw new Error('x'); })).rejects.toThrow('x');
    await expect(enqueue(async () => 42)).resolves.toBe(42);
  });
});
