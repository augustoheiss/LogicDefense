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

/**
 * Declarative policy metadata for sovereign street routing (Anti-Dodo-Code).
 * Separates durable graph-routing abstractions from volatile upstream policy details.
 */
export const ROUTING_POLICY_CONFIG = {
  maxWaypointsPerRequest: 25,
  dedupeStopRadiusMeters: 6,
  osrmTimeoutMs: 5000,
  maxPinsForAutoSequence: 60,
  endpoints: {
    foot: [
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
      'https://router.project-osrm.org/route/v1/foot',
    ],
    driving: [
      'https://routing.openstreetmap.de/routed-car/route/v1/driving',
      'https://router.project-osrm.org/route/v1/driving',
    ],
  },
} as const;

export interface RouteStepSummary {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
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

export interface RouteWaypointInput {
  key?: string;
  lat: number;
  lng: number;
  label?: string;
  street?: string;
  streetName?: string;
  numberOrComplement?: string;
  worked?: number;
}

export interface MapRouteResult {
  coordinates: [number, number][]; // Array of [lat, lng] following street geometry
  distanceMeters: number;
  durationSeconds: number;
  bearingDegrees: number;
  cardinalDirection: string;
  source: 'osrm' | 'offline_haversine';
  profile: 'foot' | 'driving';
  label?: string;
  steps: RouteStepSummary[];
  origin?: [number, number];
  stops?: WalkingSequenceStop[];
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

function isValidCoordTuple(pt: [number, number]): boolean {
  const [lat, lng] = pt;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

const osrmRouteCache = new Map<string, MapRouteResult>();
const MAX_ROUTE_CACHE_ENTRIES = 64;

function buildRouteCacheKey(waypoints: [number, number][], profile: 'foot' | 'driving'): string {
  return `${profile}:${waypoints.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(';')}`;
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
    origin,
    steps: [
      {
        instruction: `Siga na direção ${cardinalDirection} por ${formatRouteDistance(straightMeters)}${label ? ` até ${label}` : ''}`,
        distanceMeters: Math.round(straightMeters),
        durationSeconds,
      },
    ],
  };
}

function subsampleWaypointsForOsrm(
  origin: [number, number],
  stops: WalkingSequenceStop[],
  maxWaypoints: number
): [number, number][] {
  if (stops.length === 0) return [origin];
  // Deduplicate consecutive stops that are closer than dedupeStopRadiusMeters
  const deduped: [number, number][] = [];
  for (let i = 0; i < stops.length; i++) {
    const pt: [number, number] = [stops[i].lat, stops[i].lng];
    const isLast = i === stops.length - 1;
    if (
      deduped.length === 0 ||
      isLast ||
      computeHaversineMeters(deduped[deduped.length - 1], pt) >= ROUTING_POLICY_CONFIG.dedupeStopRadiusMeters
    ) {
      deduped.push(pt);
    }
  }
  const maxStops = Math.max(1, maxWaypoints - 1);
  if (deduped.length <= maxStops) {
    return [origin, ...deduped];
  }
  const sampled: [number, number][] = [];
  const step = (deduped.length - 1) / (maxStops - 1);
  for (let i = 0; i < maxStops - 1; i++) {
    sampled.push(deduped[Math.round(i * step)]);
  }
  sampled.push(deduped[deduped.length - 1]);
  return [origin, ...sampled];
}

/**
 * Multi-Stop Street-Following Route Engine (GPS Origin -> 1 or N Addresses).
 * Queries cascading OpenStreetMap OSRM street routers (`routing.openstreetmap.de` -> `router.project-osrm.org`)
 * to trace the real street network geometry starting strictly at `originInput` (the user's live GPS).
 */
export async function calculateMultiStopMapRoute(
  originInput: LatLngLike,
  stopsInput: (LatLngLike | RouteWaypointInput)[],
  options: {
    profile?: 'foot' | 'driving';
    optimizeOrder?: boolean;
    walkMode?: 'sidewalk' | 'sequential' | 'nearest_neighbor';
    timeoutMs?: number;
    label?: string;
    fetchImpl?: typeof fetch;
    endpointsOverride?: readonly string[];
  } = {}
): Promise<MapRouteResult> {
  const origin = toLatLngTuple(originInput);
  const profile = options.profile || 'foot';
  const timeoutMs = options.timeoutMs ?? ROUTING_POLICY_CONFIG.osrmTimeoutMs;
  const fetchFn = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  const normalizedUnits: WalkingSequenceUnitInput[] = [];
  for (let idx = 0; idx < stopsInput.length; idx++) {
    const item = stopsInput[idx];
    if (Array.isArray(item)) {
      const lat = Number(item[0]);
      const lng = Number(item[1]);
      if (isValidCoordTuple([lat, lng])) {
        normalizedUnits.push({
          key: `stop-${idx + 1}`,
          lat,
          lng,
          label: options.label && stopsInput.length === 1 ? options.label : `Parada ${idx + 1}`,
        });
      }
    } else if (item && 'lat' in item && 'lng' in item) {
      const wp = item as RouteWaypointInput;
      const lat = Number(wp.lat);
      const lng = Number(wp.lng);
      if (isValidCoordTuple([lat, lng])) {
        normalizedUnits.push({
          key: wp.key || `stop-${idx + 1}`,
          lat,
          lng,
          label: wp.label || (options.label && stopsInput.length === 1 ? options.label : `Parada ${idx + 1}`),
          street: wp.street || wp.streetName,
          streetName: wp.streetName || wp.street,
          numberOrComplement: wp.numberOrComplement,
          worked: wp.worked,
        });
      }
    }
  }

  if (!isValidCoordTuple(origin) || normalizedUnits.length === 0) {
    const safeOrigin: [number, number] = isValidCoordTuple(origin) ? origin : [0, 0];
    const safeDest: [number, number] =
      normalizedUnits.length > 0
        ? [normalizedUnits[0].lat as number, normalizedUnits[0].lng as number]
        : safeOrigin;
    return computeOfflineRoute(safeOrigin, safeDest, profile, options.label);
  }

  // Order stops anchored strictly at the operator's GPS origin
  let orderedStops: WalkingSequenceStop[];
  if (normalizedUnits.length === 1) {
    const single = normalizedUnits[0];
    const singlePt: [number, number] = [single.lat as number, single.lng as number];
    const dist = Math.round(computeHaversineMeters(origin, singlePt));
    orderedStops = [
      {
        key: single.key,
        lat: singlePt[0],
        lng: singlePt[1],
        order: 1,
        label: single.label || options.label || 'Destino',
        street: single.street || single.streetName || '',
        numberOrComplement: single.numberOrComplement || 'S/N',
        worked: single.worked === 1 ? 1 : 0,
        distanceFromPrevMeters: dist,
      },
    ];
  } else if (options.optimizeOrder === false) {
    orderedStops = normalizedUnits.map((u, idx) => {
      const pt: [number, number] = [u.lat as number, u.lng as number];
      const prev: [number, number] =
        idx === 0 ? origin : [normalizedUnits[idx - 1].lat as number, normalizedUnits[idx - 1].lng as number];
      return {
        key: u.key,
        lat: pt[0],
        lng: pt[1],
        order: idx + 1,
        label: u.label || `Parada ${idx + 1}`,
        street: u.street || u.streetName || '',
        numberOrComplement: u.numberOrComplement || 'S/N',
        worked: u.worked === 1 ? 1 : 0,
        distanceFromPrevMeters: Math.round(computeHaversineMeters(prev, pt)),
      };
    });
  } else {
    orderedStops = buildWalkingSequenceRoute(
      normalizedUnits,
      options.walkMode || 'nearest_neighbor',
      origin
    );
  }

  const firstStop: [number, number] = [orderedStops[0].lat, orderedStops[0].lng];
  const lastStop: [number, number] = [
    orderedStops[orderedStops.length - 1].lat,
    orderedStops[orderedStops.length - 1].lng,
  ];
  const routeLabel =
    options.label ||
    (orderedStops.length === 1
      ? orderedStops[0].label
      : `${orderedStops.length} endereços (${orderedStops[0].label} → ${orderedStops[orderedStops.length - 1].label})`);

  const buildOfflineFallback = (): MapRouteResult => {
    if (orderedStops.length === 1) {
      const singleFallback = computeOfflineRoute(origin, firstStop, profile, options.label);
      return {
        ...singleFallback,
        origin,
        stops: orderedStops,
      };
    }
    const coords: [number, number][] = [origin, ...orderedStops.map((s) => [s.lat, s.lng] as [number, number])];
    let totalStraight = 0;
    const steps: RouteStepSummary[] = [];
    const speed = profile === 'driving' ? DEFAULT_DRIVING_SPEED_MPS : DEFAULT_WALKING_SPEED_MPS;
    for (let i = 0; i < orderedStops.length; i++) {
      const prev = i === 0 ? origin : ([orderedStops[i - 1].lat, orderedStops[i - 1].lng] as [number, number]);
      const cur: [number, number] = [orderedStops[i].lat, orderedStops[i].lng];
      const legDist = computeHaversineMeters(prev, cur);
      totalStraight += legDist;
      const legDur = Math.round((legDist * 1.2) / speed);
      const legDir = bearingToCardinalPt(computeBearingDegrees(prev, cur));
      steps.push({
        instruction: `Parada ${orderedStops[i].order}: Siga ${legDir} por ${formatRouteDistance(legDist)} até ${orderedStops[i].label}`,
        distanceMeters: Math.round(legDist),
        durationSeconds: legDur,
      });
    }
    const bearingDegrees = Math.round(computeBearingDegrees(origin, firstStop));
    const cardinalDirection = bearingToCardinalPt(bearingDegrees);
    const durationSeconds = Math.round((totalStraight * 1.2) / speed);
    return {
      coordinates: coords,
      distanceMeters: Math.round(totalStraight),
      durationSeconds,
      bearingDegrees,
      cardinalDirection,
      source: 'offline_haversine',
      profile,
      label: routeLabel,
      steps,
      origin,
      stops: orderedStops,
    };
  };

  if (!fetchFn) {
    return buildOfflineFallback();
  }

  const osrmWaypoints = subsampleWaypointsForOsrm(
    origin,
    orderedStops,
    ROUTING_POLICY_CONFIG.maxWaypointsPerRequest
  );
  const coordQuery = osrmWaypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const cacheKey = !options.fetchImpl ? buildRouteCacheKey(osrmWaypoints, profile) : null;
  if (cacheKey && osrmRouteCache.has(cacheKey)) {
    const cached = osrmRouteCache.get(cacheKey)!;
    return {
      ...cached,
      label: routeLabel,
      origin,
      stops: orderedStops,
    };
  }

  const endpoints = options.endpointsOverride ?? ROUTING_POLICY_CONFIG.endpoints[profile];
  const speed = profile === 'driving' ? DEFAULT_DRIVING_SPEED_MPS : DEFAULT_WALKING_SPEED_MPS;

  for (const baseUrl of endpoints) {
    const url = `${baseUrl}/${coordQuery}?overview=full&geometries=geojson&steps=true`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const res = await fetchFn(url, controller ? { signal: controller.signal } : undefined);
      if (!res.ok) continue;
      const data = await res.json();
      const route = data?.routes?.[0];
      const rawCoords: unknown[] | undefined = route?.geometry?.coordinates;
      if (!route || !Array.isArray(rawCoords) || rawCoords.length < 2) {
        continue;
      }

      const coordinates: [number, number][] = rawCoords
        .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length >= 2)
        .map((pt) => [Number(pt[1]), Number(pt[0])] as [number, number])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

      if (coordinates.length < 2) {
        continue;
      }

      const distanceMeters = Math.round(
        Number(route.distance) || computeHaversineMeters(origin, lastStop)
      );
      const rawDuration = Number(route.duration) || 0;
      const durationSeconds =
        profile === 'foot'
          ? Math.max(rawDuration, Math.round(distanceMeters / DEFAULT_WALKING_SPEED_MPS))
          : rawDuration || Math.round(distanceMeters / speed);

      const bearingDegrees = Math.round(computeBearingDegrees(origin, firstStop));
      const cardinalDirection = bearingToCardinalPt(bearingDegrees);

      const allLegs: any[] = Array.isArray(route.legs) ? route.legs : [];
      const rawSteps: any[] = allLegs.flatMap((leg) => (Array.isArray(leg?.steps) ? leg.steps : []));
      const steps: RouteStepSummary[] = rawSteps
        .filter((s) => s && typeof s.distance === 'number' && s.distance > 0)
        .map((s) => ({
          instruction: s.name ? `${s.name}` : 'Continue no trajeto',
          distanceMeters: Math.round(s.distance),
          durationSeconds: Math.round(s.duration || s.distance / speed),
        }));

      const result: MapRouteResult = {
        coordinates,
        distanceMeters,
        durationSeconds,
        bearingDegrees,
        cardinalDirection,
        source: 'osrm',
        profile,
        label: routeLabel,
        steps: steps.length > 0 ? steps : buildOfflineFallback().steps,
        origin,
        stops: orderedStops,
      };

      if (cacheKey) {
        if (osrmRouteCache.size >= MAX_ROUTE_CACHE_ENTRIES) {
          const oldestKey = osrmRouteCache.keys().next().value;
          if (oldestKey) osrmRouteCache.delete(oldestKey);
        }
        osrmRouteCache.set(cacheKey, result);
      }

      return result;
    } catch {
      // Try next OSRM endpoint in cascade
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return buildOfflineFallback();
}

/**
 * Tier 2: Street-following route via OpenStreetMap OSRM with automatic Circuit Breaker
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
  const options =
    typeof optionsOrProfile === 'string'
      ? { profile: optionsOrProfile, timeoutMs: timeoutMsOverride }
      : optionsOrProfile;
  return calculateMultiStopMapRoute(originInput, [destinationInput], {
    profile: options.profile || 'foot',
    timeoutMs: options.timeoutMs ?? 3000,
    label: options.label,
    fetchImpl: options.fetchImpl,
  });
}

function parseHouseNumber(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function sortUnitsWithinStreet(
  streetUnits: (WalkingSequenceUnitInput & { lat: number; lng: number })[],
  mode: 'sidewalk' | 'sequential'
): (WalkingSequenceUnitInput & { lat: number; lng: number })[] {
  return [...streetUnits].sort((a, b) => {
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

/**
 * Tier 3: Builds an ordered walking tour across located units (`sidewalk`, `sequential`, or `nearest_neighbor`).
 * When `startOriginInput` (operator GPS) is provided, street groups and stops always start from the point
 * closest to the operator's real GPS position rather than blind alphabetical order.
 */
export function buildWalkingSequenceRoute(
  units: WalkingSequenceUnitInput[],
  mode: 'sidewalk' | 'sequential' | 'nearest_neighbor' = 'sidewalk',
  startOriginInput?: LatLngLike | null
): WalkingSequenceStop[] {
  const rawOrigin = startOriginInput ? toLatLngTuple(startOriginInput) : null;
  const startOrigin = rawOrigin && isValidCoordTuple(rawOrigin) ? rawOrigin : null;
  const located = units.filter(
    (u): u is WalkingSequenceUnitInput & { lat: number; lng: number } =>
      typeof u.lat === 'number' &&
      typeof u.lng === 'number' &&
      isValidCoordTuple([u.lat, u.lng])
  );

  if (located.length === 0) return [];

  let ordered: (WalkingSequenceUnitInput & { lat: number; lng: number })[] = [];

  if (mode === 'nearest_neighbor') {
    const remaining = [...located];
    let currentPos: [number, number] = startOrigin ?? [remaining[0].lat, remaining[0].lng];

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
  } else if (startOrigin) {
    // Group by street, then visit street groups in Nearest-Neighbor order starting at `startOrigin` (GPS)
    const streetGroupsMap = new Map<string, (WalkingSequenceUnitInput & { lat: number; lng: number })[]>();
    for (const u of located) {
      const sKey = (u.street || u.streetName || '').toLowerCase().trim();
      if (!streetGroupsMap.has(sKey)) {
        streetGroupsMap.set(sKey, []);
      }
      streetGroupsMap.get(sKey)!.push(u);
    }

    const remainingGroups = Array.from(streetGroupsMap.entries()).map(([sKey, items]) => ({
      sKey,
      sortedItems: sortUnitsWithinStreet(items, mode),
    }));

    let currentPos: [number, number] = startOrigin;
    while (remainingGroups.length > 0) {
      let bestGroupIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remainingGroups.length; i++) {
        for (const item of remainingGroups[i].sortedItems) {
          const d = computeHaversineMeters(currentPos, [item.lat, item.lng]);
          if (d < bestDist) {
            bestDist = d;
            bestGroupIdx = i;
          }
        }
      }
      const chosenGroup = remainingGroups.splice(bestGroupIdx, 1)[0];
      ordered.push(...chosenGroup.sortedItems);
      const lastItem = chosenGroup.sortedItems[chosenGroup.sortedItems.length - 1];
      currentPos = [lastItem.lat, lastItem.lng];
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
