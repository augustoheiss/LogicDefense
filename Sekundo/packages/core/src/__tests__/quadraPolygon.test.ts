import { describe, it, expect } from 'vitest';
import {
  calculateQuadraColor,
  computeConvexHull,
  expandPolygon,
  parseAddressLine,
  extractQuadrasFromRegistry,
  formatQuadraPerimeterDescription,
  computeMergedTerritoryPolygon,
} from '../geo/quadraPolygonEngine';
import type { FlatSkeletonEntry } from '../skeleton/types';

describe('Quadra & Perimeter Streets GIS Engine', () => {
  it('calculates semantic colors according to coverage percent', () => {
    expect(calculateQuadraColor(0, 0)).toBe('#6B7280'); // No units
    expect(calculateQuadraColor(0, 10)).toBe('#EF4444'); // Pending / 0%
    expect(calculateQuadraColor(50, 10)).toBe('#F59E0B'); // In progress
    expect(calculateQuadraColor(99.9, 10)).toBe('#F59E0B'); // In progress
    expect(calculateQuadraColor(100, 10)).toBe('#10B981'); // 100% Completed
  });

  it('computes convex hull correctly for 4 corner points', () => {
    const points: [number, number][] = [
      [-25.41, -49.15],
      [-25.41, -49.14],
      [-25.42, -49.14],
      [-25.42, -49.15],
      [-25.415, -49.145], // Interior point
    ];

    const hull = computeConvexHull(points);
    expect(hull.length).toBe(4); // The 4 outer boundary points
    expect(hull).not.toContainEqual([-25.415, -49.145]);
  });

  it('parses address lines into street and number', () => {
    const r1 = parseAddressLine('Via Operacional 01, 202 (Bloco A)');
    expect(r1.street).toBe('Via Operacional 01');
    expect(r1.number).toBe('202 (Bloco A)');

    const r2 = parseAddressLine('Av. Eixo Central, 1064');
    expect(r2.street).toBe('Av. Eixo Central');
    expect(r2.number).toBe('1064');

    const r3 = parseAddressLine('Rua Sem Virgula - 50');
    expect(r3.street).toBe('Rua Sem Virgula');
    expect(r3.number).toBe('50');
  });

  it('formats perimeter streets description elegantly', () => {
    expect(formatQuadraPerimeterDescription([])).toBe('Quarteirão sem ruas especificadas');
    expect(formatQuadraPerimeterDescription(['Rua A'])).toBe('Rua: Rua A');
    expect(formatQuadraPerimeterDescription(['Rua A', 'Rua B'])).toBe('Delimitada por Rua A e Rua B');
    expect(formatQuadraPerimeterDescription(['Rua A', 'Rua B', 'Rua C', 'Rua D'])).toBe(
      'Delimitada por Rua A, Rua B, Rua C e Rua D (4 vias)'
    );
  });

  it('extracts Quadras from a registry and groups addresses by street with coverage rollup', () => {
    const mockRegistry: FlatSkeletonEntry[] = [
      {
        key: '02-01-01',
        type: 'header',
        label: 'T02.01.01 — Setor Sul - Quadra 01',
        value: '',
        meta: {
          territory_number: 'T02.01.01',
          locality: 'Setor Sul - Quadra 01',
          perimeter_streets: ['Via Operacional 01', 'Via Operacional 02', 'Via Operacional 03', 'Via Operacional 04'],
        },
      },
      {
        key: '02-01-01-01',
        type: 'territory',
        label: 'Via Operacional 01, 202 (AP-1)',
        value: 'Trabalhado',
        meta: {
          line: 'Via Operacional 01, 202 (AP-1)',
          territory_number: 'T02.01.01',
          lat: -25.4175,
          lng: -49.1521,
          worked: 1,
        },
      },
      {
        key: '02-01-01-02',
        type: 'territory',
        label: 'Via Operacional 01, 204',
        value: '',
        meta: {
          line: 'Via Operacional 01, 204',
          territory_number: 'T02.01.01',
          lat: -25.4176,
          lng: -49.1522,
          worked: 0,
        },
      },
      {
        key: '02-01-01-03',
        type: 'territory',
        label: 'Via Operacional 02, 127',
        value: '',
        meta: {
          line: 'Via Operacional 02, 127',
          territory_number: 'T02.01.01',
          lat: -25.4236,
          lng: -49.1504,
          worked: 0,
        },
      },
    ];

    const quadras = extractQuadrasFromRegistry(mockRegistry);
    expect(quadras.length).toBe(1);

    const q = quadras[0];
    expect(q.territoryNumber).toBe('T02.01.01');
    expect(q.totalUnits).toBe(3);
    expect(q.workedUnits).toBe(1);
    expect(q.coveragePercent).toBe(33.3);
    expect(q.isCompleted).toBe(false);
    expect(q.statusColor).toBe('#F59E0B'); // In progress
    expect(q.boundaryPolygon.length).toBeGreaterThanOrEqual(3); // Polygon created around points

    // Check streets group
    expect(q.streets.length).toBe(2); // Via Operacional 01 and Via Operacional 02
    const viaOp01 = q.streets.find((s) => s.streetName === 'Via Operacional 01');
    expect(viaOp01).toBeDefined();
    expect(viaOp01?.totalUnits).toBe(2);
    expect(viaOp01?.workedUnits).toBe(1);
    expect(viaOp01?.coveragePercent).toBe(50);
  });

  it('respects customColor and polygonExpansion overrides', () => {
    const customRegistry: FlatSkeletonEntry[] = [
      {
        key: '02-01-02',
        type: 'header',
        label: 'Quadra Personalizada',
        value: '',
        meta: {
          territory_number: 'T02.01.02',
          customColor: '#8B5CF6',
          polygonExpansion: 1.05,
        },
      },
      {
        key: '02-01-02-01',
        type: 'territory',
        label: 'Rua das Flores, 100',
        value: '',
        meta: {
          line: 'Rua das Flores, 100',
          territory_number: 'T02.01.02',
          lat: -25.41,
          lng: -49.15,
          worked: 0,
        },
      },
      {
        key: '02-01-02-02',
        type: 'territory',
        label: 'Rua das Flores, 102',
        value: '',
        meta: {
          line: 'Rua das Flores, 102',
          territory_number: 'T02.01.02',
          lat: -25.42,
          lng: -49.16,
          worked: 0,
        },
      },
    ];

    const quadras = extractQuadrasFromRegistry(customRegistry);
    expect(quadras.length).toBe(1);
    expect(quadras[0].statusColor).toBe('#8B5CF6'); // Custom color wins over #EF4444
    expect(quadras[0].polygonExpansion).toBe(1.05);
  });

  it('merges multiple quadras into a single territory polygon', () => {
    const mockQuadras = [
      {
        key: 'Q1',
        quadraNumber: '1',
        label: 'Q1',
        territoryNumber: 'T01',
        perimeterStreets: ['Rua 1'],
        boundaryPolygon: [
          [-25.41, -49.15],
          [-25.41, -49.14],
          [-25.42, -49.14],
        ] as [number, number][],
        centroid: [-25.415, -49.145] as [number, number],
        totalUnits: 1,
        workedUnits: 0,
        coveragePercent: 0,
        isCompleted: false,
        statusColor: '#EF4444',
        streets: [],
      },
      {
        key: 'Q2',
        quadraNumber: '2',
        label: 'Q2',
        territoryNumber: 'T01',
        perimeterStreets: ['Rua 2'],
        boundaryPolygon: [
          [-25.43, -49.15],
          [-25.43, -49.16],
          [-25.42, -49.16],
        ] as [number, number][],
        centroid: [-25.425, -49.155] as [number, number],
        totalUnits: 1,
        workedUnits: 0,
        coveragePercent: 0,
        isCompleted: false,
        statusColor: '#EF4444',
        streets: [],
      },
    ];

    const merged = computeMergedTerritoryPolygon(mockQuadras);
    expect(merged.length).toBeGreaterThanOrEqual(3);
  });
});
