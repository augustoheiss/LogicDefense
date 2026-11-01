/**
 * Sekundo — Sovereign Google Maps URL & Offline-First Routing Privacy Bridge
 *
 * Unifies zero-key Google Maps URL generation (`googleMapsLinks.ts`) with
 * sovereign offline-first routing & GPS origin privacy controls (`routingEngine.ts`):
 * - `defaultPrivacyMode: 'offline_first'` (100% local Haversine + Azimuth + TSP, 0 OSRM requests)
 * - `roundOriginForPrivacy` / `anonymizeCoordForOsrm` (~110m grid truncation for opt-in OSRM)
 * - `buildGoogleMapsDirectionsUrl` & `buildGoogleMapsSearchUrl`
 */

export {
  type GoogleMapsWaypointItem,
  type GoogleMapsTargetInput,
  type ResolvedGoogleMapsQuery,
  resolveBestAddressQuery,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
} from './googleMapsLinks';

export {
  ROUTING_POLICY_CONFIG,
  type RouteStepSummary,
  type WalkingSequenceUnitInput,
  type WalkingSequenceStop,
  type RouteWaypointInput,
  type MapRouteResult,
  type MultiStopMapRouteOptions,
  type SingleStopMapRouteOptions,
  type StreetSegmentGroup,
  haversineDistanceMeters,
  bearingDegrees,
  bearingToCardinal,
  formatDistanceMetric,
  formatDurationEstimate,
  buildWalkingSequenceRoute,
  groupUnitsIntoStreetSegments,
  calculateMapRoute,
  calculateMultiStopMapRoute,
} from './routingEngine';

import {
  ROUTING_POLICY_CONFIG,
  anonymizeCoordForOsrm as coreAnonymizeCoordForOsrm,
} from './routingEngine';

/**
 * Truncates/rounds an operator GPS origin coordinate to `decimals` decimal places
 * (default `3` = ~110m grid) so exact device/home coordinates are never exposed
 * when the user explicitly opts into external street routing (`osrm_opt_in`)
 * or external directions links.
 *
 * In default `offline_first` mode (`ROUTING_POLICY_CONFIG.defaultPrivacyMode === 'offline_first'`),
 * zero network requests are made to external OSRM servers.
 */
export function roundOriginForPrivacy(
  pt: [number, number],
  decimals: number = ROUTING_POLICY_CONFIG.anonymizeOriginDecimals
): [number, number] {
  return coreAnonymizeCoordForOsrm(pt, decimals);
}

export const anonymizeCoordForOsrm = roundOriginForPrivacy;
export const anonymizeOriginForOsrm = roundOriginForPrivacy;
