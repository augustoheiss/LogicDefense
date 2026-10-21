import { describe, it, expect } from 'vitest';
import {
  resolveBestAddressQuery,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
} from '../geo/googleMapsLinks';
import {
  computeHaversineMeters,
  computeBearingDegrees,
  bearingToCardinalPt,
  formatRouteDistance,
  formatRouteDuration,
  computeOfflineRoute,
  calculateMapRoute,
  buildWalkingSequenceRoute,
} from '../geo/routingEngine';

describe('Google Maps Universal Deep-Links & Sovereign Routing Engine', () => {
  it('builds Google Maps directions URL using exact coordinates when valid lat/lng exist', () => {
    const url = buildGoogleMapsDirectionsUrl({
      lat: -25.4321,
      lng: -49.1823,
      line: 'Via Operacional, 202',
      city: 'Município Central',
      state: 'PR',
      travelMode: 'walking',
    });

    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-25.4321%2C-49.1823&travelmode=walking'
    );
  });

  it('falls back to full formatted address query when coordinates are missing or (0,0)', () => {
    const resolved = resolveBestAddressQuery({
      lat: null,
      lng: undefined,
      street: 'Via Operacional',
      number: '202',
      neighborhood: 'Bairro Sintético 01',
      city: 'Município Central',
      state: 'PR',
      postalcode: '80000-000',
    });

    expect(resolved.hasValidCoords).toBe(false);
    expect(resolved.destinationParam).toBe(
      'Via Operacional, 202, Bairro Sintético 01, Município Central - PR, 80000-000'
    );

    const dirUrl = buildGoogleMapsDirectionsUrl({
      street: 'Via Operacional',
      city: 'Município Central',
      state: 'PR',
    });
    expect(dirUrl).toContain('https://www.google.com/maps/dir/?api=1&destination=');
    expect(decodeURIComponent(dirUrl)).toContain('Via Operacional, Município Central - PR');
    expect(dirUrl).not.toContain('undefined');
    expect(dirUrl).not.toContain('null');

    const searchUrl = buildGoogleMapsSearchUrl({
      street: 'Av. Central',
      number: '1050',
      city: 'Município Central',
    });
    expect(searchUrl).toContain('https://www.google.com/maps/search/?api=1&query=');
    expect(decodeURIComponent(searchUrl)).toContain('Av. Central, 1050, Município Central');
  });

  it('includes explicit origin when operator GPS is passed to buildGoogleMapsDirectionsUrl', () => {
    const url = buildGoogleMapsDirectionsUrl({
      lat: -23.55052,
      lng: -46.633308,
      originLat: -23.5489,
      originLng: -46.6388,
      travelMode: 'walking',
    });
    expect(decodeURIComponent(url)).toContain('destination=-23.55052,-46.633308');
    expect(decodeURIComponent(url)).toContain('origin=-23.5489,-46.6388');
  });

  it('computes Haversine distance, bearing, cardinal directions, and offline routes accurately', () => {
    const origin: [number, number] = [-23.5505, -46.6333];
    const destNorthEast: [number, number] = [-23.5485, -46.6313];

    const dist = computeHaversineMeters(origin, destNorthEast);
    expect(dist).toBeGreaterThan(250);
    expect(dist).toBeLessThan(350);

    const bearing = computeBearingDegrees(origin, destNorthEast);
    expect(bearing).toBeGreaterThan(30);
    expect(bearing).toBeLessThan(60);
    expect(bearingToCardinalPt(bearing)).toBe('↗ NE');

    const offline = computeOfflineRoute(origin, destNorthEast, 'foot', 'Casa 102');
    expect(offline.source).toBe('offline_haversine');
    expect(offline.coordinates).toEqual([origin, destNorthEast]);
    expect(offline.distanceMeters).toBe(Math.round(dist));
    expect(offline.durationSeconds).toBeGreaterThan(180);
    expect(offline.steps[0].instruction).toContain('Casa 102');
    expect(formatRouteDistance(offline.distanceMeters)).toMatch(/^\d+ m$/);
    expect(formatRouteDuration(offline.durationSeconds)).toMatch(/^~\d+ min$/);
  });

  it('resolves OSRM street route when online and gracefully degrades to offline_haversine on network error', async () => {
    const origin: [number, number] = [-23.5505, -46.6333];
    const dest: [number, number] = [-23.5475, -46.6303];

    // 1. Simulated OSRM success
    const mockFetchOk = async () =>
      ({
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [
            {
              distance: 540.2,
              duration: 390,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-46.6333, -23.5505],
                  [-46.632, -23.549],
                  [-46.6303, -23.5475],
                ],
              },
              legs: [
                {
                  steps: [
                    { name: 'Rua Central', distance: 320, duration: 230 },
                    { name: 'Rua das Flores', distance: 220, duration: 160 },
                  ],
                },
              ],
            },
          ],
        }),
      }) as unknown as Response;

    const onlineRoute = await calculateMapRoute(origin, dest, {
      profile: 'foot',
      label: 'Nº 205',
      fetchImpl: mockFetchOk,
    });
    expect(onlineRoute.source).toBe('osrm');
    expect(onlineRoute.coordinates.length).toBe(3);
    expect(onlineRoute.coordinates[0]).toEqual([-23.5505, -46.6333]);
    expect(onlineRoute.distanceMeters).toBe(540);
    expect(onlineRoute.steps.length).toBe(2);

    // 2. Simulated offline failure -> Circuit breaker fallback
    const mockFetchFail = async () => {
      throw new Error('Network offline');
    };
    const fallbackRoute = await calculateMapRoute(origin, dest, {
      profile: 'foot',
      label: 'Nº 205',
      fetchImpl: mockFetchFail,
    });
    expect(fallbackRoute.source).toBe('offline_haversine');
    expect(fallbackRoute.coordinates).toEqual([origin, dest]);
    expect(fallbackRoute.distanceMeters).toBeGreaterThan(400);
  });

  it('orders walking sequence by sidewalk (odd numbers first, then even) or nearest neighbor', () => {
    const units = [
      { key: '1', lat: -23.5504, lng: -46.6334, street: 'Rua A', numberOrComplement: '102', worked: 0 },
      { key: '2', lat: -23.5501, lng: -46.6331, street: 'Rua A', numberOrComplement: '101', worked: 0 },
      { key: '3', lat: -23.5506, lng: -46.6336, street: 'Rua A', numberOrComplement: '104', worked: 0 },
      { key: '4', lat: -23.5503, lng: -46.6333, street: 'Rua A', numberOrComplement: '103', worked: 1 },
    ];

    const sidewalkOrder = buildWalkingSequenceRoute(units, 'sidewalk');
    expect(sidewalkOrder.map((s) => s.numberOrComplement)).toEqual(['101', '103', '102', '104']);
    expect(sidewalkOrder.map((s) => s.order)).toEqual([1, 2, 3, 4]);

    const seqOrder = buildWalkingSequenceRoute(units, 'sequential');
    expect(seqOrder.map((s) => s.numberOrComplement)).toEqual(['101', '102', '103', '104']);

    const nnOrder = buildWalkingSequenceRoute(units, 'nearest_neighbor', [-23.5501, -46.6331]);
    expect(nnOrder[0].numberOrComplement).toBe('101');
    expect(nnOrder.length).toBe(4);
  });
});
