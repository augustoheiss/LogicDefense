/**
 * sw.js — Service Worker do CV Maker (Cache Offline & Fontes Locais)
 * =================================================================
 * Garante disponibilidade 100% offline para renderização tipográfica sem Font Metric Shift.
 */

const CACHE_NAME = 'cv-maker-offline-v2'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/logo-heisslab.png',
  // Fontes WOFF2 locais essenciais
  '/fonts/Inter-400.woff2',
  '/fonts/Inter-600.woff2',
  '/fonts/Inter-700.woff2',
  '/fonts/PlusJakartaSans-500.woff2',
  '/fonts/PlusJakartaSans-600.woff2',
  '/fonts/PlusJakartaSans-700.woff2',
  '/fonts/Merriweather-400.woff2',
  '/fonts/Merriweather-700.woff2',
  '/fonts/FiraCode-400.woff2',
  '/fonts/FiraCode-600.woff2',
  '/fonts/Outfit-400.woff2',
  '/fonts/Outfit-600.woff2',
  '/fonts/Outfit-700.woff2',
  '/fonts/Poppins-400.woff2',
  '/fonts/Poppins-600.woff2',
  '/fonts/Caveat-700.woff2',
  '/fonts/Cinzel-700.woff2',
  '/fonts/Roboto-400.woff2',
  '/fonts/Roboto-500.woff2',
  '/fonts/Roboto-700.woff2',
  '/fonts/CourierPrime-400.woff2',
  '/fonts/CourierPrime-700.woff2',
  '/fonts/Lora-400.woff2',
  '/fonts/Lora-600.woff2',
  '/fonts/Lora-700.woff2',
  '/fonts/OpenSans-400.woff2',
  '/fonts/OpenSans-600.woff2',
  '/fonts/OpenSans-700.woff2',
  '/fonts/Montserrat-500.woff2',
  '/fonts/Montserrat-600.woff2',
  '/fonts/Montserrat-700.woff2'
]

// Instalação: pré-carrega as fontes e shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Aviso ao pré-carregar alguns ativos no cache:', err)
      })
    }).then(() => self.skipWaiting())
  )
})

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    }).then(() => self.clients.claim())
  )
})

// Interceptação: Cache First para fontes e Stale-While-Revalidate para outros ativos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Ignora chamadas de API do backend (geração de IA, validação de chaves)
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // 1. Fontes WOFF2: Cache First rígido para máxima performance e zero dependência de rede
  if (url.pathname.includes('/fonts/') || url.pathname.endsWith('.woff2')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // 2. Outros recursos: Network First com fallback para Cache
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.status === 200 && event.request.method === 'GET') {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
      }
      return response
    }).catch(() => {
      return caches.match(event.request).then((cached) => {
        if (cached) return cached
        if (event.request.destination === 'document') {
          return caches.match('/index.html')
        }
        return Response.error()
      })
    })
  )
})
