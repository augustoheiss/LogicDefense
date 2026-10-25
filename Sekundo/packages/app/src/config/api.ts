/**
 * Sekundo — API Configuration
 *
 * 🚨 ISOLATION NOTICE:
 *    This configuration is COMPLETELY INDEPENDENT from Assistente-Moeda.
 *    - Does NOT read VITE_API_URL
 *    - Does NOT use X-Spreadsheet-Key headers
 *    - Does NOT connect to external legacy endpoints
 *    - Targets its own dedicated Sekundo deployment
 *
 * The Sekundo API is a stateless microservice with:
 *    - PDF processing (extract fields, detect anchors, fill)
 *    - WebRTC signaling relay (ephemeral rooms, 5-min TTL)
 *    - Health check endpoint
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// API Base URL
// ---------------------------------------------------------------------------

/**
 * Resolve the Sekundo API base URL.
 *
 * Priority:
 * 1. Expo environment variable EXPO_PUBLIC_SEKUNDO_API_URL (set in app.json or .env)
 * 2. Platform-specific localhost defaults for development
 *
 * ⚠️ This NEVER falls back to any Assistente-Moeda URL.
 */
function resolveApiUrl(): string {
  // 1. If running in browser on localhost / 127.0.0.1:
  //    - On Metro dev ports (8081 / 19006), route to local FastAPI port 8001
  //    - On integrated local SIT/gateway servers (e.g. 8788, 8000, 8001), use window.location.origin
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const hostname = window.location.hostname;
    const port = window.location.port;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (port === '8081' || port === '19006') {
        return 'http://localhost:8001';
      }
      return window.location.origin;
    }
  }

  // 2. Explicit environment variable (EXPO_PUBLIC_SEKUNDO_API_URL or EXPO_PUBLIC_API_URL)
  const envUrl = (
    process.env.EXPO_PUBLIC_SEKUNDO_API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    ''
  ).trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 3. Development defaults for native emulators/simulators
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8001';
    }
    return 'http://localhost:8001';
  }

  // 4. Production web fallback (relies on vercel.json /signal/:path* rewrite)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  console.warn(
    '[Sekundo] EXPO_PUBLIC_SEKUNDO_API_URL not set. PDF and signaling features will not work.'
  );
  return '';
}

/** The resolved Sekundo API base URL. */
export const SEKUNDO_API_URL = resolveApiUrl();

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------

export const API = {
  health: `${SEKUNDO_API_URL}/health`,

  // WebRTC Signaling & Zero-Knowledge Multi-Peer (1:N) Encrypted Relay
  signal: {
    createRoom: `${SEKUNDO_API_URL}/signal/room`,
    room: (id: string) => `${SEKUNDO_API_URL}/signal/room/${id}`,
    offer: (id: string) => `${SEKUNDO_API_URL}/signal/room/${id}/offer`,
    answer: (id: string) => `${SEKUNDO_API_URL}/signal/room/${id}/answer`,
    candidates: (id: string, role: 'offer' | 'answer') =>
      `${SEKUNDO_API_URL}/signal/room/${id}/candidates/${role}`,
    syncPush: (id: string) => `${SEKUNDO_API_URL}/signal/room/${id}/sync-push`,
    syncPull: (id: string, sinceSeq: number = 0, peerId?: string) =>
      `${SEKUNDO_API_URL}/signal/room/${id}/sync-pull?since_seq=${sinceSeq}${
        peerId ? `&peer_id=${encodeURIComponent(peerId)}` : ''
      }`,
  },

  // Zero-Knowledge Scoped Capability Blobs (v3)
  share: {
    blob: (id: string) => `${SEKUNDO_API_URL}/signal/share/blob/${encodeURIComponent(id)}`,
  },
} as const;

// ---------------------------------------------------------------------------
// Request Helpers
// ---------------------------------------------------------------------------

/**
 * Standard headers for Sekundo API requests.
 * NO X-Spreadsheet-Key. NO financial auth. Just Content-Type.
 */
export function getHeaders(adminKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (adminKey) {
    headers['X-Sekundo-Admin-Key'] = adminKey;
  }

  return headers;
}
