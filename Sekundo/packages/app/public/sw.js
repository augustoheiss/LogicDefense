/**
 * Sekundo — Sovereign Offline Service Worker
 *
 * Caches:
 * 1. App shell & static vendor assets (`sekundo-shell-v1`)
 * 2. Seen OpenStreetMap tiles (`sekundo-osm-tiles-v1`) for offline field operation
 *
 * Zero telemetry, zero external analytics.
 */

const SHELL_CACHE = 'sekundo-shell-v3';
const TILE_CACHE = 'sekundo-osm-tiles-v1';

const BASE_PATH = self.location.pathname.replace(/\/sw\.js$/, '') || '';

const PRECACHE_URLS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/pdfjs/pdf.min.mjs`,
  `${BASE_PATH}/pdfjs/pdf.worker.min.mjs`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('sekundo-shell-') && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cache-first with background refresh for OSM tiles
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const networkResp = await fetch(req);
          if (networkResp && networkResp.ok) {
            cache.put(req, networkResp.clone());
          }
          return networkResp;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Network-first with cache fallback for same-origin navigation & static assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || (await caches.match(`${BASE_PATH}/`)) || caches.match('/');
        })
    );
  }
});
