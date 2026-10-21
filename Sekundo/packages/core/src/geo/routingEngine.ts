/**
 * Sekundo — Sovereign In-Map Routing & Walking Sequence Engine
 *
 * Provides 3 complementary tiers of field routing with ZERO paid API keys:
 * 1. Tier 1 (Offline Haversine + Azimuth): 0ms local vector route with exact metric
 *    distance, cardinal bearing (`↗ NE`), and walking/driving duration estimate.
 * 2. Tier 2 (OSRM OpenStreetMap Street-Following Route): Queries the public OSRM router
 *    for turn-by-turn street geometry with a strict 3000ms AbortController circuit breaker,
 *    automatically falling back to Tier 1 when offline in the field.
 * 3. Tier 3 (Walking Sequence & Nearest-Neighbor TSP): Builds ordered walking paths
 *    (`1 → 2 → 3...`) across house numbers in a quadra/street (`sidewalk`, `sequential`,
 *    or `nearest_neighbor`).
 */

const EARTH_RADIUS_METERS = 6_371_000;
const DEFAULT_WALKING_SPEED_MPS = 1.25; // ~4.5 km/h
const DEFAULT_DRIVING_SPEED_MPS = 8.33; // ~30 km/h urban average

export interface RouteStepSummary {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface MapRouteResult {
  coordinates: [number, number][]; // Array of [lat, lng]
  distanceMeters: number;
  durationSeconds: number;
  bearingDegrees: number;
  cardinalDirection: string;
  source: 'osrm' | 'offline_haversine';
  profile: 'foot' | 'driving';
  label?: string;
  steps: RouteStepSummary[];
}

export interface WalkingSequenceUnitInput {
  key: string;
  lat?: number | null;
  lng?: number | null;
  numberOrComplement?: string;
  street?: string;
  streetName?: string;
  label?: string;
  worked?: number;
}

export interface WalkingSequenceStop {
  key: string;
  lat: number;
  lng: number;
  order: number;
  label: string;
  street: string;
  numberOrComplement: string;
  worked: number;
  distanceFromPrevMeters: number;
}

export type RouteCalculationResult = MapRouteResult;
export type WalkingSequenceRoute = WalkingSequenceStop[];

export type LatLngLike = [number, number] | { lat: number; lng: number };

function toLatLngTuple(pt: LatLngLike): [number, number] {
  if (Array.isArray(pt)) return [Number(pt[0]), Number(pt[1])];
  return [Number(pt.lat), Number(pt.lng)];
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Computes the great-circle distance in meters between two `[lat, lng]` points using Haversine.
 */
export function computeHaversineMeters(a: [number, number], b: [number, number]): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(rLat1) * Math.cos(rLat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes initial forward azimuth (bearing) in degrees `[0..360)` from `a` to `b`.
 */
export function computeBearingDegrees(a: [number, number], b: [number, number]): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const dLng = toRad(lng2 - lng1);

  const y = Math.sin(dLng) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLng);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Converts a bearing in degrees `[0..360)` to a Portuguese cardinal label with arrow.
 */
export function bearingToCardinalPt(bearingDegrees: number): string {
  const dirs = [
    '↑ N',
    '↗ NE',
    '→ L',
    '↘ SE',
    '↓ S',
    '↙ SO',
    '← O',
    '↖ NO',
  ];
  const normalized = ((bearingDegrees % 360) + 360) % 360;
  const idx = Math.round(normalized / 45) % 8;
  return dirs[idx];
}

/**
 * Formats distance in meters into human-readable Portuguese string (`"185 m"` or `"1,4 km"`).
 */
export function formatRouteDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/**
 * Formats duration in seconds into human-readable Portuguese string (`"~4 min"` or `"1h 12min"`).
 */
export function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '< 1 min';
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `~${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}min` : `${hrs}h`;
}

/**
 * Tier 1: Deterministic 100% Offline Haversine route between two coordinates.
 */
export function computeOfflineRoute(
  originInput: LatLngLike,
  destinationInput: LatLngLike,
  profile: 'foot' | 'driving' = 'foot',
  label?: string
): MapRouteResult {
  const origin = toLatLngTuple(originInput);
  const destination = toLatLngTuple(destinationInput);
  const straightMeters = computeHaversineMeters(origin, destination);
  const bearingDegrees = computeBearingDegrees(origin, destination);
  const cardinalDirection = bearingToCardinalPt(bearingDegrees);

  // Apply 1.2x urban Manhattan factor for realistic walking/driving duration estimate
  const speed = profile === 'driving' ? DEFAULT_DRIVING_SPEED_MPS : DEFAULT_WALKING_SPEED_MPS;
  const durationSeconds = Math.round((straightMeters * 1.2) / speed);

  return {
    coordinates: [origin, destination],
    distanceMeters: Math.round(straightMeters),
    durationSeconds,
    bearingDegrees: Math.round(bearingDegrees),
    cardinalDirection,
    source: 'offline_haversine',
    profile,
    label,
    steps: [
      {
        instruction: `Siga na direção ${cardinalDirection} por ${formatRouteDistance(straightMeters)}${label ? ` até ${label}` : ''}`,
        distanceMeters: Math.round(straightMeters),
        durationSeconds,
      },
    ],
  };
}

/**
 * Tier 2: Street-following route via OpenStreetMap OSRM with automatic 3s Circuit Breaker
 * fallback to Tier 1 (`computeOfflineRoute`) when offline or rate-limited.
 */
export async function calculateMapRoute(
  originInput: LatLngLike,
  destinationInput: LatLngLike,
  optionsOrProfile:
    | {
        profile?: 'foot' | 'driving';
        timeoutMs?: number;
        label?: string;
        fetchImpl?: typeof fetch;
      }
    | 'foot'
    | 'driving' = {},
  timeoutMsOverride?: number
): Promise<MapRouteResult> {
  const origin = toLatLngTuple(originInput);
  const destination = toLatLngTuple(destinationInput);
  const options =
    typeof optionsOrProfile === 'string'
      ? { profile: optionsOrProfile, timeoutMs: timeoutMsOverride }
      : optionsOrProfile;
  const profile = options.profile || 'foot';
  const timeoutMs = options.timeoutMs ?? 3000;
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  const fallback = () => computeOfflineRoute(origin, destination, profile, options.label);

  if (!fetchFn) {
    return fallback();
  }

  const osrmProfile = profile === 'driving' ? 'driving' : 'foot';
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&steps=true`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetchFn(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return fallback();
    const data = await res.json();
    const route = data?.routes?.[0];
    const rawCoords: unknown[] | undefined = route?.geometry?.coordinates;
    if (!route || !Array.isArray(rawCoords) || rawCoords.length < 2) {
      return fallback();
    }

    const coordinates: [number, number][] = rawCoords
      .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length >= 2)
      .map((pt) => [Number(pt[1]), Number(pt[0])] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (coordinates.length < 2) {
      return fallback();
    }

    const distanceMeters = Math.round(Number(route.distance) || computeHaversineMeters(origin, destination));
    const speed = profile === 'driving' ? DEFAULT_DRIVING_SPEED_MPS : DEFAULT_WALKING_SPEED_MPS;
    // OSRM public demo sometimes uses car speed even on foot profile; calibrate walking duration if unrealistic
    const rawDuration = Number(route.duration) || 0;
    const durationSeconds =
      profile === 'foot'
        ? Math.max(rawDuration, Math.round(distanceMeters / DEFAULT_WALKING_SPEED_MPS))
        : rawDuration || Math.round(distanceMeters / speed);

    const bearingDegrees = Math.round(computeBearingDegrees(origin, destination));
    const cardinalDirection = bearingToCardinalPt(bearingDegrees);

    const rawSteps: any[] = route?.legs?.[0]?.steps || [];
    const steps: RouteStepSummary[] = rawSteps
      .filter((s) => s && typeof s.distance === 'number' && s.distance > 0)
      .map((s) => ({
        instruction: s.name ? `${s.name}` : 'Continue no trajeto',
        distanceMeters: Math.round(s.distance),
        durationSeconds: Math.round(s.duration || s.distance / speed),
      }));

    return {
      coordinates,
      distanceMeters,
      durationSeconds,
      bearingDegrees,
      cardinalDirection,
      source: 'osrm',
      profile,
      label: options.label,
      steps: steps.length > 0 ? steps : fallback().steps,
    };
  } catch {
    return fallback();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseHouseNumber(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * Tier 3: Builds an ordered walking tour across located units (`sidewalk`, `sequential`, or `nearest_neighbor`).
 */
export function buildWalkingSequenceRoute(
  units: WalkingSequenceUnitInput[],
  mode: 'sidewalk' | 'sequential' | 'nearest_neighbor' = 'sidewalk',
  startOriginInput?: LatLngLike | null
): WalkingSequenceStop[] {
  const startOrigin = startOriginInput ? toLatLngTuple(startOriginInput) : null;
  const located = units.filter(
    (u): u is WalkingSequenceUnitInput & { lat: number; lng: number } =>
      typeof u.lat === 'number' &&
      typeof u.lng === 'number' &&
      Number.isFinite(u.lat) &&
      Number.isFinite(u.lng) &&
      !(u.lat === 0 && u.lng === 0)
  );

  if (located.length === 0) return [];

  let ordered: (WalkingSequenceUnitInput & { lat: number; lng: number })[] = [];

  if (mode === 'nearest_neighbor') {
    const remaining = [...located];
    let currentPos: [number, number] =
      startOrigin && Number.isFinite(startOrigin[0]) && Number.isFinite(startOrigin[1])
        ? startOrigin
        : [remaining[0].lat, remaining[0].lng];

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = computeHaversineMeters(currentPos, [remaining[i].lat, remaining[i].lng]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      ordered.push(next);
      currentPos = [next.lat, next.lng];
    }
  } else {
    ordered = [...located].sort((a, b) => {
      const sA = (a.street || a.streetName || '').toLowerCase();
      const sB = (b.street || b.streetName || '').toLowerCase();
      if (sA !== sB) return sA.localeCompare(sB);

      const nA = parseHouseNumber(a.numberOrComplement || a.label);
      const nB = parseHouseNumber(b.numberOrComplement || b.label);
      if (nA === null && nB === null) return 0;
      if (nA === null) return 1;
      if (nB === null) return -1;

      if (mode === 'sidewalk') {
        const oddA = nA % 2 !== 0 ? 0 : 1;
        const oddB = nB % 2 !== 0 ? 0 : 1;
        if (oddA !== oddB) return oddA - oddB;
      }
      return nA - nB;
    });
  }

  return ordered.map((u, idx) => {
    const prev = idx > 0 ? ordered[idx - 1] : null;
    const distanceFromPrevMeters = prev
      ? Math.round(computeHaversineMeters([prev.lat, prev.lng], [u.lat, u.lng]))
      : startOrigin
      ? Math.round(computeHaversineMeters(startOrigin, [u.lat, u.lng]))
      : 0;
    const streetStr = u.street || u.streetName || '';

    return {
      key: u.key,
      lat: u.lat,
      lng: u.lng,
      order: idx + 1,
      label: u.label || `${streetStr || 'Endereço'}, ${u.numberOrComplement || 'S/N'}`,
      street: streetStr,
      numberOrComplement: u.numberOrComplement || 'S/N',
      worked: u.worked === 1 ? 1 : 0,
      distanceFromPrevMeters,
    };
  });
}
