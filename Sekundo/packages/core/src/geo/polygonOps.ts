/**
 * Sekundo — Polygon validation helpers for manually edited boundaries.
 *
 * All rings are `[lat, lng]` tuples, open or closed (a repeated last vertex is ignored).
 * Planar math is fine at block scale (tens to hundreds of meters).
 */

type LatLng = [number, number];

function openRing(ring: LatLng[]): LatLng[] {
  if (ring.length > 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  }
  return ring;
}

/** Ray-casting point-in-polygon test. Points exactly on an edge may go either way. */
export function pointInPolygon(point: LatLng, ring: LatLng[]): boolean {
  const pts = openRing(ring);
  if (pts.length < 3) return false;
  const [y, x] = point;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i];
    const [yj, xj] = pts[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function orientation(a: LatLng, b: LatLng, c: LatLng): number {
  const v = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
  if (Math.abs(v) < 1e-18) return 0;
  return v > 0 ? 1 : -1;
}

function onSegment(a: LatLng, b: LatLng, p: LatLng): boolean {
  return (
    Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1])
  );
}

function segmentsIntersect(p1: LatLng, p2: LatLng, p3: LatLng, p4: LatLng): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, p3)) return true;
  if (o2 === 0 && onSegment(p1, p2, p4)) return true;
  if (o3 === 0 && onSegment(p3, p4, p1)) return true;
  if (o4 === 0 && onSegment(p3, p4, p2)) return true;
  return false;
}

/** True when any two non-adjacent edges of the ring touch or cross. */
export function isSelfIntersecting(ring: LatLng[]): boolean {
  const pts = openRing(ring);
  const n = pts.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Skip edges sharing a vertex with edge i.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsIntersect(a1, a2, pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Rounds every vertex (default 6 decimals ≈ 0.1 m) and drops the closing duplicate. */
export function roundRing(ring: LatLng[], decimals = 6): LatLng[] {
  const f = 10 ** decimals;
  return openRing(ring).map(([lat, lng]) => [Math.round(lat * f) / f, Math.round(lng * f) / f] as LatLng);
}

export interface BoundaryValidation {
  ok: boolean;
  /** Blocking problems (the ring must not be saved). */
  errors: string[];
  /** Keys of units that fall outside the ring (non-blocking, shown as a warning). */
  unitsOutside: string[];
}

/** Validates a manually drawn boundary against the units it should contain. */
export function validateBoundary(
  ring: LatLng[],
  units: { key: string; lat: number; lng: number }[] = []
): BoundaryValidation {
  const pts = openRing(ring);
  const errors: string[] = [];
  if (pts.length < 3) errors.push('O contorno precisa de pelo menos 3 vértices.');
  else if (isSelfIntersecting(pts)) errors.push('O contorno se cruza. Ajuste os vértices para que as bordas não se sobreponham.');
  const unitsOutside = pts.length >= 3 ? units.filter((u) => !pointInPolygon([u.lat, u.lng], pts)).map((u) => u.key) : [];
  return { ok: errors.length === 0, errors, unitsOutside };
}
