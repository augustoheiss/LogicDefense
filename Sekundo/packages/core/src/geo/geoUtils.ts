/**
 * Sekundo — Shared Geo Utilities
 *
 * Single source of truth for:
 * - Territory number resolution from a path key (used by pins, quadras and filters alike)
 * - Coordinate parsing (number or string, lat/lng or latitude/longitude, comma decimals)
 * - Metric polygon buffering (meters, not scale factors) via a local tangent plane
 */

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG_EQUATOR = 111_320;

/**
 * Resolves the territory identifier of a registry entry.
 *
 * Priority: explicit meta (`territory_number` / `territory`) → path-derived key.
 * Path rule (shared by every screen and by the quadra engine):
 * - Leaf entries belong to their ancestor at depth `min(3, depth - 1)`.
 * - Container entries are truncated to depth 3 (a depth-3 header is its own territory).
 */
export function resolveTerritoryNumber(
  entry: { key: string; meta?: Record<string, unknown> },
  isContainer = false
): string {
  const meta = (entry.meta || {}) as Record<string, unknown>;
  const explicit = meta.territory_number ?? meta.territory;
  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== '') {
    return String(explicit).trim();
  }
  const parts = entry.key.split('-');
  const depth = isContainer ? Math.min(3, parts.length) : Math.min(3, Math.max(1, parts.length - 1));
  return parts.slice(0, depth).join('-') || 'T01';
}

function toCoordinate(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.includes('.') ? trimmed : trimmed.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parses coordinates from node metadata. Accepts `lat`/`lng`, `latitude`/`longitude`
 * and `lon`, as numbers or strings. Returns `null` when missing or out of range —
 * callers must never invent a fallback position.
 */
export function parseLatLng(meta: Record<string, unknown> | undefined): { lat: number; lng: number } | null {
  if (!meta) return null;
  const lat = toCoordinate(meta.lat ?? meta.latitude);
  const lng = toCoordinate(meta.lng ?? meta.longitude ?? meta.lon);
  if (lat === undefined || lng === undefined) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

type LatLng = [number, number];
type XY = [number, number];

function dedupeRing(ring: LatLng[]): LatLng[] {
  const out: LatLng[] = [];
  for (const p of ring) {
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) out.pop();
  }
  return out;
}

/**
 * Buffers a polygon ring by a distance in meters (negative shrinks).
 * Uses a local equirectangular projection and mitred edge offsets, which is exact for
 * convex shapes and well-behaved for mildly concave hand-drawn blocks at city scale.
 * Degenerate inputs (1 or 2 points) become a box / rectangle with a minimum half-size.
 */
export function bufferPolygonMeters(ring: LatLng[], meters: number): LatLng[] {
  const pts = dedupeRing(ring);
  if (pts.length === 0) return [];

  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lng0 = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const kx = M_PER_DEG_LNG_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  const toXY = ([lat, lng]: LatLng): XY => [(lng - lng0) * kx, (lat - lat0) * M_PER_DEG_LAT];
  const toLatLng = ([x, y]: XY): LatLng => [lat0 + y / M_PER_DEG_LAT, lng0 + x / kx];

  if (pts.length === 1) {
    const h = Math.max(15, meters);
    const [x, y] = toXY(pts[0]);
    return ([[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]] as XY[]).map(toLatLng);
  }

  if (pts.length === 2) {
    const h = Math.max(10, meters);
    const [a, b] = pts.map(toXY);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const nx = -uy * h;
    const ny = ux * h;
    const ex = ux * h;
    const ey = uy * h;
    return ([
      [a[0] - ex + nx, a[1] - ey + ny],
      [b[0] + ex + nx, b[1] + ey + ny],
      [b[0] + ex - nx, b[1] + ey - ny],
      [a[0] - ex - nx, a[1] - ey - ny],
    ] as XY[]).map(toLatLng);
  }

  if (meters === 0) return pts.map((p) => [p[0], p[1]] as LatLng);

  const xy = pts.map(toXY);
  let area2 = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    area2 += x1 * y2 - x2 * y1;
  }
  const ccw = area2 > 0;
  const n = xy.length;

  // Offset line for each edge i (from vertex i to i+1): point + direction
  const lines = xy.map((p, i) => {
    const q = xy[(i + 1) % n];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const dx = (q[0] - p[0]) / len;
    const dy = (q[1] - p[1]) / len;
    const nx = ccw ? dy : -dy;
    const ny = ccw ? -dx : dx;
    return { px: p[0] + nx * meters, py: p[1] + ny * meters, dx, dy, nx, ny };
  });

  const miterLimit = Math.abs(meters) * 4;
  const out: XY[] = xy.map((v, i) => {
    const a = lines[(i - 1 + n) % n];
    const b = lines[i];
    const denom = a.dx * b.dy - a.dy * b.dx;
    let x: number;
    let y: number;
    if (Math.abs(denom) < 1e-9) {
      x = v[0] + b.nx * meters;
      y = v[1] + b.ny * meters;
    } else {
      const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / denom;
      x = a.px + a.dx * t;
      y = a.py + a.dy * t;
    }
    const ox = x - v[0];
    const oy = y - v[1];
    const dist = Math.hypot(ox, oy);
    if (dist > miterLimit) {
      x = v[0] + (ox / dist) * miterLimit;
      y = v[1] + (oy / dist) * miterLimit;
    }
    return [x, y];
  });

  return out.map(toLatLng);
}

/** Planar area in square meters (shoelace in a local tangent plane). */
export function polygonAreaM2(ring: LatLng[]): number {
  const pts = dedupeRing(ring);
  if (pts.length < 3) return 0;
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const kx = M_PER_DEG_LNG_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [la1, ln1] = pts[i];
    const [la2, ln2] = pts[(i + 1) % pts.length];
    a += ln1 * kx * (la2 * M_PER_DEG_LAT) - ln2 * kx * (la1 * M_PER_DEG_LAT);
  }
  return Math.abs(a) / 2;
}
