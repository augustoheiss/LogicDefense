/**
 * Sekundo — Sovereign Offline Tile Cache Helper
 *
 * Pre-caches OpenStreetMap tiles for a territory's bounding box (zoom 15–17,
 * capped at 60 tiles per batch to respect OSM tile usage policies) into browser
 * CacheStorage (`sekundo-osm-tiles-v1`), served offline by `/sw.js`.
 */

import { Platform, Image } from 'react-native';
import { storage } from './localStorage';

const TILE_CACHE = 'sekundo-osm-tiles-v1';
const NATIVE_TILE_REGISTRY_KEY = 'sekundo:native-cached-tiles-v1';
const MAX_TILES_PER_BATCH = 60;

export function registerSovereignServiceWorker(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if ('serviceWorker' in navigator) {
    const swUrl = window.location.pathname.startsWith('/laboratorio/sekundo')
      ? '/laboratorio/sekundo/sw.js'
      : '/sw.js';
    navigator.serviceWorker.register(swUrl).catch(() => {});
  }
}

function latLngToTileXY(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

export async function getCachedTileCount(): Promise<number> {
  if (Platform.OS !== 'web') {
    try {
      const raw = await storage.getItem(NATIVE_TILE_REGISTRY_KEY);
      if (!raw) return 0;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  }
  if (typeof window === 'undefined' || !('caches' in window)) {
    return 0;
  }
  try {
    const cache = await window.caches.open(TILE_CACHE);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

export async function cacheBoundingBoxTiles(
  points: [number, number][],
  onProgress?: (done: number, total: number) => void
): Promise<{ cached: number; total: number }> {
  if (points.length === 0) {
    return { cached: 0, total: 0 };
  }
  if (Platform.OS === 'web' && (typeof window === 'undefined' || !('caches' in window))) {
    return { cached: 0, total: 0 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lat, lng] of points) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  if (!Number.isFinite(minLat)) return { cached: 0, total: 0 };

  // Pad bounding box by ~200m (~0.002 deg)
  minLat -= 0.002;
  maxLat += 0.002;
  minLng -= 0.002;
  maxLng += 0.002;

  const urls: string[] = [];
  for (const z of [15, 16, 17]) {
    const topLeft = latLngToTileXY(maxLat, minLng, z);
    const bottomRight = latLngToTileXY(minLat, maxLng, z);
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        const sub = ['a', 'b', 'c'][(x + y) % 3];
        const url =
          Platform.OS === 'web'
            ? `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
            : `https://${sub}.tile.openstreetmap.fr/hot/${z}/${x}/${y}.png`;
        urls.push(url);
        if (urls.length >= MAX_TILES_PER_BATCH) break;
      }
      if (urls.length >= MAX_TILES_PER_BATCH) break;
    }
    if (urls.length >= MAX_TILES_PER_BATCH) break;
  }

  if (Platform.OS !== 'web') {
    let cachedCount = 0;
    const savedSet = new Set<string>();
    try {
      const existingRaw = await storage.getItem(NATIVE_TILE_REGISTRY_KEY);
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) parsed.forEach((u) => savedSet.add(String(u)));
      }
    } catch {
      // ignore
    }

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const ok = await Image.prefetch(url);
        if (ok) {
          cachedCount++;
          savedSet.add(url);
        }
      } catch {
        // Ignore individual tile network error
      }
      onProgress?.(i + 1, urls.length);
    }

    try {
      await storage.setItem(NATIVE_TILE_REGISTRY_KEY, JSON.stringify(Array.from(savedSet)));
    } catch {
      // ignore
    }
    return { cached: cachedCount, total: urls.length };
  }

  const cache = await window.caches.open(TILE_CACHE);
  let cachedCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const existing = await cache.match(url);
      if (existing) {
        cachedCount++;
      } else {
        const resp = await fetch(url, { mode: 'cors' });
        if (resp.ok) {
          await cache.put(url, resp);
          cachedCount++;
        }
      }
    } catch {
      // Ignore individual tile network error
    }
    onProgress?.(i + 1, urls.length);
  }

  return { cached: cachedCount, total: urls.length };
}
