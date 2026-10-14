import { describe, it, expect } from 'vitest';
import { pointInPolygon, isSelfIntersecting, roundRing, validateBoundary } from '../geo/polygonOps';

const square: [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
];

describe('polygonOps', () => {
  it('pointInPolygon detects inside/outside, open or closed ring', () => {
    expect(pointInPolygon([0.5, 0.5], square)).toBe(true);
    expect(pointInPolygon([1.5, 0.5], square)).toBe(false);
    expect(pointInPolygon([0.5, 0.5], [...square, square[0]])).toBe(true);
    expect(pointInPolygon([0.5, 0.5], square.slice(0, 2))).toBe(false);
  });

  it('isSelfIntersecting flags a bow-tie but not a convex or concave simple ring', () => {
    const bowTie: [number, number][] = [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
    ];
    const concave: [number, number][] = [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 2],
      [2, 0],
    ];
    expect(isSelfIntersecting(bowTie)).toBe(true);
    expect(isSelfIntersecting(square)).toBe(false);
    expect(isSelfIntersecting(concave)).toBe(false);
  });

  it('roundRing rounds to 6 decimals and drops the closing vertex', () => {
    const r = roundRing([
      [-23.12345678, -46.98765432],
      [-23.2, -46.9],
      [-23.3, -46.8],
      [-23.12345678, -46.98765432],
    ]);
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual([-23.123457, -46.987654]);
  });

  it('validateBoundary blocks invalid rings and reports units outside', () => {
    expect(validateBoundary(square.slice(0, 2)).ok).toBe(false);
    const res = validateBoundary(square, [
      { key: 'a', lat: 0.5, lng: 0.5 },
      { key: 'b', lat: 2, lng: 2 },
    ]);
    expect(res.ok).toBe(true);
    expect(res.unitsOutside).toEqual(['b']);
  });
});
