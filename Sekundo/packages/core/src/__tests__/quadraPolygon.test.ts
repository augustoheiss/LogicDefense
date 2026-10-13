import { describe, it, expect } from 'vitest';
import {
  calculateQuadraColor,
  computeConvexHull,
  expandPolygon,
  parseAddressLine,
  extractQuadrasFromRegistry,
  formatQuadraPerimeterDescription,
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
    const r1 = parseAddressLine('Rua Azaleias, 202 (AP-2, JD. Karla)');
    expect(r1.street).toBe('Rua Azaleias');
    expect(r1.number).toBe('202 (AP-2, JD. Karla)');

    const r2 = parseAddressLine('R. Mal. Floriano Peixoto, 1064');
    expect(r2.street).toBe('R. Mal. Floriano Peixoto');
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
        label: 'T02.01.01 — Pinhais - Jardim Karla',
        value: '',
        meta: {
          territory_number: 'T02.01.01',
          locality: 'Pinhais - Jardim Karla',
          perimeter_streets: ['Rua Azaleias', 'R. Flor de Lótus', 'R. Alecrim', 'Rua Íris'],
        },
      },
      {
        key: '02-01-01-01',
        type: 'territory',
        label: 'Rua Azaleias, 202 (AP-1)',
        value: 'Trabalhado',
        meta: {
          line: 'Rua Azaleias, 202 (AP-1)',
          territory_number: 'T02.01.01',
          lat: -25.4175,
          lng: -49.1521,
          worked: 1,
        },
      },
      {
        key: '02-01-01-02',
        type: 'territory',
        label: 'Rua Azaleias, 204',
        value: '',
        meta: {
          line: 'Rua Azaleias, 204',
          territory_number: 'T02.01.01',
          lat: -25.4176,
          lng: -49.1522,
          worked: 0,
        },
      },
      {
        key: '02-01-01-03',
        type: 'territory',
        label: 'R. Flor de Lótus, 127',
        value: '',
        meta: {
          line: 'R. Flor de Lótus, 127',
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
    expect(q.streets.length).toBe(2); // Rua Azaleias and R. Flor de Lótus
    const azaleias = q.streets.find((s) => s.streetName === 'Rua Azaleias');
    expect(azaleias).toBeDefined();
    expect(azaleias?.totalUnits).toBe(2);
    expect(azaleias?.workedUnits).toBe(1);
    expect(azaleias?.coveragePercent).toBe(50);
  });
});
