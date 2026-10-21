/**
 * Sekundo — Universal Google Maps Deep-Link & Route URL Builder
 *
 * Generates zero-key, cross-platform Google Maps URLs (`api=1`) that work seamlessly
 * on Android (opens native Google Maps app), iOS (opens Google Maps app or Safari),
 * and Desktop Web:
 * - `buildGoogleMapsDirectionsUrl`: Traces a route from the operator's current GPS
 *   location (or explicit origin) to a pin, house number, street, or quadra.
 * - `buildGoogleMapsSearchUrl`: Opens the exact pin or street query on Google Maps.
 * - Cascading Resolution: Prefers exact `(lat, lng)` coordinates when available;
 *   automatically falls back to a clean full-address query (`street, number, neighborhood, city, state, CEP`)
 *   when coordinates are absent (e.g., street headers or ungeocoded addresses).
 */

export type GoogleMapsWaypointItem =
  | [number, number]
  | string
  | {
      lat?: number | string | null;
      lng?: number | string | null;
      label?: string | null;
      street?: string | null;
      streetName?: string | null;
      number?: string | null;
      numberOrComplement?: string | null;
      city?: string | null;
    };

export interface GoogleMapsTargetInput {
  lat?: number | string | null;
  lng?: number | string | null;
  street?: string | null;
  streetName?: string | null;
  number?: string | null;
  numberOrComplement?: string | null;
  line?: string | null;
  line2?: string | null;
  neighborhood?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  postalcode?: string | null;
  label?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  waypoints?: GoogleMapsWaypointItem[] | null;
  travelMode?: 'walking' | 'driving' | 'bicycling' | 'transit';
  mode?: 'directions' | 'search';
}

export interface ResolvedGoogleMapsQuery {
  hasValidCoords: boolean;
  lat?: number;
  lng?: number;
  textQuery: string;
  destinationParam: string;
}

function parseFiniteCoord(val: number | string | null | undefined): number | undefined {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : undefined;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    const normalized = trimmed.includes('.') ? trimmed : trimmed.replace(',', '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

/**
 * Resolves the best destination parameter from coordinates and/or textual address parts.
 * Never emits `undefined`, `null`, or `NaN` tokens.
 */
export function resolveBestAddressQuery(input: GoogleMapsTargetInput): ResolvedGoogleMapsQuery {
  const lat = parseFiniteCoord(input.lat);
  const lng = parseFiniteCoord(input.lng);

  const hasValidCoords =
    lat !== undefined &&
    lng !== undefined &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0);

  // Build street + number primary part
  const cleanLine = (input.line || '').trim();
  const cleanStreet = (input.street || input.streetName || '').trim();
  const cleanNumber = (input.number || input.numberOrComplement || '').trim();
  const cleanLabel = (input.label || '').trim();

  let primaryStreet = cleanLine;
  if (!primaryStreet && cleanStreet) {
    primaryStreet =
      cleanNumber && cleanNumber.toUpperCase() !== 'S/N'
        ? `${cleanStreet}, ${cleanNumber}`
        : cleanStreet;
  }
  if (!primaryStreet && cleanLabel) {
    primaryStreet = cleanLabel;
  }

  const cleanNeighborhood = (
    input.line2 ||
    input.neighborhood ||
    input.locality ||
    ''
  ).trim();
  const cleanCity = (input.city || '').trim();
  const cleanState = (input.state || '').trim();
  const cleanPostal = (input.postalcode || '').trim();

  const cityStatePart =
    cleanCity && cleanState
      ? `${cleanCity} - ${cleanState}`
      : cleanCity || cleanState;

  const textParts = [
    primaryStreet,
    cleanNeighborhood,
    cityStatePart,
    cleanPostal,
  ].filter((part) => Boolean(part && part.length > 0));

  const textQuery = textParts.join(', ');

  const coordString = hasValidCoords
    ? `${Number(lat!.toFixed(6))},${Number(lng!.toFixed(6))}`
    : '';

  const destinationParam = hasValidCoords
    ? coordString
    : textQuery || 'Brasil';

  return {
    hasValidCoords,
    lat: hasValidCoords ? lat : undefined,
    lng: hasValidCoords ? lng : undefined,
    textQuery: textQuery || coordString || 'Brasil',
    destinationParam,
  };
}

/**
 * Builds a universal Google Maps Directions URL (`https://www.google.com/maps/dir/?api=1&destination=...`).
 * Supports optional multi-stop `&waypoints=w1|w2|...` and explicit `origin` (GPS coordinates).
 * When `originLat`/`originLng` are omitted, Google Maps automatically routes from the user's current GPS position.
 */
export function buildGoogleMapsDirectionsUrl(input: GoogleMapsTargetInput): string {
  const resolved = resolveBestAddressQuery(input);
  const params: string[] = [
    'api=1',
    `destination=${encodeURIComponent(resolved.destinationParam)}`,
  ];

  const oLat = parseFiniteCoord(input.originLat);
  const oLng = parseFiniteCoord(input.originLng);
  if (
    oLat !== undefined &&
    oLng !== undefined &&
    oLat >= -90 &&
    oLat <= 90 &&
    oLng >= -180 &&
    oLng <= 180 &&
    !(oLat === 0 && oLng === 0)
  ) {
    params.push(
      `origin=${encodeURIComponent(`${Number(oLat.toFixed(6))},${Number(oLng.toFixed(6))}`)}`
    );
  }

  if (Array.isArray(input.waypoints) && input.waypoints.length > 0) {
    const wpTokens: string[] = [];
    for (const wp of input.waypoints.slice(0, 20)) {
      if (typeof wp === 'string') {
        const trimmed = wp.trim();
        if (trimmed) wpTokens.push(trimmed);
      } else if (Array.isArray(wp) && wp.length >= 2) {
        const wLat = parseFiniteCoord(wp[0]);
        const wLng = parseFiniteCoord(wp[1]);
        if (
          wLat !== undefined &&
          wLng !== undefined &&
          wLat >= -90 &&
          wLat <= 90 &&
          wLng >= -180 &&
          wLng <= 180 &&
          !(wLat === 0 && wLng === 0)
        ) {
          wpTokens.push(`${Number(wLat.toFixed(6))},${Number(wLng.toFixed(6))}`);
        }
      } else if (wp && !Array.isArray(wp) && typeof wp === 'object') {
        const wpResolved = resolveBestAddressQuery({
          lat: wp.lat,
          lng: wp.lng,
          label: wp.label,
          street: wp.street || wp.streetName,
          number: wp.number || wp.numberOrComplement,
          city: wp.city || input.city,
        });
        if (wpResolved.destinationParam && wpResolved.destinationParam !== 'Brasil') {
          wpTokens.push(wpResolved.destinationParam);
        }
      }
    }
    if (wpTokens.length > 0) {
      params.push(`waypoints=${encodeURIComponent(wpTokens.join('|'))}`);
    }
  }

  if (input.travelMode) {
    params.push(`travelmode=${encodeURIComponent(input.travelMode)}`);
  }

  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

/**
 * Builds a universal Google Maps Search/Pin URL (`https://www.google.com/maps/search/?api=1&query=...`).
 */
export function buildGoogleMapsSearchUrl(input: GoogleMapsTargetInput): string {
  const resolved = resolveBestAddressQuery(input);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolved.destinationParam)}`;
}
