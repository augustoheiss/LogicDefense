/**
 * Sovereign Web Mercator (EPSG:3857) Cartographic Projection & Spatial Hit-Testing Engine.
 *
 * Pure mathematical functions used by the native mobile map renderer (`TerritoryLeafletMap.tsx`)
 * for projecting WGS84 (lat, lng) coordinates to screen pixels, computing visible 256x256
 * OpenStreetMap slippy tiles, framing bounding boxes (`fitBounds`), and performing
 * deterministic Ray-Casting Point-in-Polygon (PIP) hit-testing on touch devices.
 */

import type { LatLngTuple } from './mapTypes';

export const TILE_SIZE = 256;
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 19;
export const MAX_MERCATOR_LAT = 85.05112878;

export interface WorldPoint {
  x: number;
  y: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface CameraState {
  centerLat: number;
  centerLng: number;
  zoom: number;
}

export interface VisibleTileDescriptor {
  key: string;
  z: number;
  tx: number;
  ty: number;
  left: number;
  top: number;
  size: number;
}

export function clampLat(lat: number): number {
  if (!Number.isFinite(lat)) return 0;
  return Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
}

export function normalizeLng(lng: number): number {
  if (!Number.isFinite(lng)) return 0;
  let n = ((lng + 180) % 360 + 360) % 360 - 180;
  if (n === -180 && lng > 0) n = 180;
  return Math.max(-180, Math.min(180, n));
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 15;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/**
 * Projects WGS84 (lat, lng) to continuous Web Mercator world pixel coordinates at a given zoom.
 */
export function latLngToWorldPx(lat: number, lng: number, zoom: number): WorldPoint {
  const safeLat = clampLat(lat);
  const safeLng = normalizeLng(lng);
  const safeZoom = clampZoom(zoom);
  const worldSize = TILE_SIZE * Math.pow(2, safeZoom);

  const x = ((safeLng + 180) / 360) * worldSize;
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  const clampedSin = Math.max(-0.9999, Math.min(0.9999, sinLat));
  const y = (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * worldSize;

  return { x, y };
}

/**
 * Unprojects Web Mercator world pixel coordinates (x, y) back to WGS84 (lat, lng).
 */
export function worldPxToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const safeZoom = clampZoom(zoom);
  const worldSize = TILE_SIZE * Math.pow(2, safeZoom);

  const lng = normalizeLng((x / worldSize) * 360 - 180);
  const n = Math.PI - (2 * Math.PI * y) / worldSize;
  const lat = clampLat((180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));

  return { lat, lng };
}

/**
 * Projects (lat, lng) to viewport screen coordinates relative to the camera center.
 */
export function latLngToScreenPx(
  lat: number,
  lng: number,
  camera: CameraState,
  viewportWidth: number,
  viewportHeight: number
): ScreenPoint {
  const centerWorld = latLngToWorldPx(camera.centerLat, camera.centerLng, camera.zoom);
  const ptWorld = latLngToWorldPx(lat, lng, camera.zoom);
  return {
    x: viewportWidth / 2 + (ptWorld.x - centerWorld.x),
    y: viewportHeight / 2 + (ptWorld.y - centerWorld.y),
  };
}

/**
 * Unprojects viewport screen coordinates (screenX, screenY) back to WGS84 (lat, lng).
 */
export function screenPxToLatLng(
  screenX: number,
  screenY: number,
  camera: CameraState,
  viewportWidth: number,
  viewportHeight: number
): { lat: number; lng: number } {
  const centerWorld = latLngToWorldPx(camera.centerLat, camera.centerLng, camera.zoom);
  const worldX = centerWorld.x + (screenX - viewportWidth / 2);
  const worldY = centerWorld.y + (screenY - viewportHeight / 2);
  return worldPxToLatLng(worldX, worldY, camera.zoom);
}

/**
 * Ground resolution in meters per pixel at a given latitude and zoom level.
 */
export function metersPerPixel(lat: number, zoom: number): number {
  const safeLat = clampLat(lat);
  const safeZoom = clampZoom(zoom);
  return (156543.03392 * Math.cos((safeLat * Math.PI) / 180)) / Math.pow(2, safeZoom);
}

/**
 * Computes the visible 256x256 slippy tiles covering the current viewport, supporting
 * fractional zoom levels via continuous scale interpolation.
 */
export function computeVisibleTiles(
  camera: CameraState,
  viewportWidth: number,
  viewportHeight: number
): VisibleTileDescriptor[] {
  if (viewportWidth <= 0 || viewportHeight <= 0) return [];

  const safeZoom = clampZoom(camera.zoom);
  const tileZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(safeZoom)));
  const scale = Math.pow(2, safeZoom - tileZ);
  const scaledTileSize = TILE_SIZE * scale;
  const maxTileIndex = Math.pow(2, tileZ) - 1;

  const centerAtTileZ = latLngToWorldPx(camera.centerLat, camera.centerLng, tileZ);
  const halfW = viewportWidth / 2;
  const halfH = viewportHeight / 2;

  const minWorldX = centerAtTileZ.x - halfW / scale;
  const maxWorldX = centerAtTileZ.x + halfW / scale;
  const minWorldY = centerAtTileZ.y - halfH / scale;
  const maxWorldY = centerAtTileZ.y + halfH / scale;

  const startTx = Math.floor(minWorldX / TILE_SIZE);
  const endTx = Math.floor(maxWorldX / TILE_SIZE);
  const startTy = Math.max(0, Math.floor(minWorldY / TILE_SIZE));
  const endTy = Math.min(maxTileIndex, Math.floor(maxWorldY / TILE_SIZE));

  const tiles: VisibleTileDescriptor[] = [];
  const numTiles = Math.pow(2, tileZ);

  for (let tx = startTx; tx <= endTx; tx++) {
    const wrappedTx = ((tx % numTiles) + numTiles) % numTiles;
    for (let ty = startTy; ty <= endTy; ty++) {
      const left = halfW + (tx * TILE_SIZE - centerAtTileZ.x) * scale;
      const top = halfH + (ty * TILE_SIZE - centerAtTileZ.y) * scale;
      tiles.push({
        key: `${tileZ}/${wrappedTx}/${ty}@${tx}`,
        z: tileZ,
        tx: wrappedTx,
        ty,
        left,
        top,
        size: scaledTileSize + 0.5, // +0.5px subpixel bleed prevents hairline seams during pinch
      });
    }
  }

  return tiles;
}

/**
 * Computes the optimal camera `{ centerLat, centerLng, zoom }` that fits all given coordinates
 * inside `(viewportWidth, viewportHeight)` with a padding margin.
 */
export function computeFitBoundsCamera(
  points: LatLngTuple[],
  viewportWidth: number,
  viewportHeight: number,
  paddingRatio = 0.14
): CameraState | null {
  const valid = points.filter(
    (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
  );
  if (valid.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lat, lng] of valid) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const centerLat = clampLat((minLat + maxLat) / 2);
  const centerLng = normalizeLng((minLng + maxLng) / 2);

  if (Math.abs(maxLat - minLat) < 1e-5 && Math.abs(maxLng - minLng) < 1e-5) {
    return { centerLat, centerLng, zoom: 17 };
  }

  const usableW = Math.max(64, viewportWidth * (1 - paddingRatio * 2));
  const usableH = Math.max(64, viewportHeight * (1 - paddingRatio * 2));

  const topLeftZ0 = latLngToWorldPx(maxLat, minLng, 0);
  const bottomRightZ0 = latLngToWorldPx(minLat, maxLng, 0);

  const dx0 = Math.max(1e-6, Math.abs(bottomRightZ0.x - topLeftZ0.x));
  const dy0 = Math.max(1e-6, Math.abs(bottomRightZ0.y - topLeftZ0.y));

  const zoomX = Math.log2(usableW / dx0);
  const zoomY = Math.log2(usableH / dy0);
  const targetZoom = Math.min(18, Math.max(MIN_ZOOM, Math.floor(Math.min(zoomX, zoomY) * 2) / 2));

  return {
    centerLat,
    centerLng,
    zoom: clampZoom(targetZoom),
  };
}

/**
 * Ray-Casting Point-in-Polygon (PIP) algorithm for deterministic hit-testing of quadra polygons.
 */
export function pointInPolygon(lat: number, lng: number, ring: LatLngTuple[]): boolean {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Formats a polygon/polyline coordinate array into an SVG `points` string `"x1,y1 x2,y2 ..."`.
 */
export function coordsToSvgPoints(
  coords: LatLngTuple[],
  camera: CameraState,
  viewportWidth: number,
  viewportHeight: number
): string {
  if (!coords || coords.length === 0) return '';
  const parts: string[] = [];
  for (const [lat, lng] of coords) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const pt = latLngToScreenPx(lat, lng, camera, viewportWidth, viewportHeight);
    parts.push(`${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
  }
  return parts.join(' ');
}
