/**
 * Sekundo — API Configuration
 *
 * 🚨 ISOLATION NOTICE:
 *    This configuration is COMPLETELY INDEPENDENT from Assistente-Moeda.
 *    - Does NOT read VITE_API_URL
 *    - Does NOT use X-Spreadsheet-Key headers
 *    - Does NOT connect to ocorrencias-pdf-writer.onrender.com
 *    - Targets its own dedicated Render deployment
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
  // Check for explicit env var (set in Expo config)
  const envUrl = process.env.EXPO_PUBLIC_SEKUNDO_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, ''); // Strip trailing slash
  }

  // Development defaults
  if (__DEV__) {
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to reach host machine
      return 'http://10.0.2.2:8001';
    }
    // iOS simulator and web both use localhost
    return 'http://localhost:8001';
  }

  // Production — must be set via EXPO_PUBLIC_SEKUNDO_API_URL
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

  // PDF Processing
  pdf: {
    extractFields: `${SEKUNDO_API_URL}/pdf/extract-fields`,
    detectAnchors: `${SEKUNDO_API_URL}/pdf/detect-anchors`,
    fill: `${SEKUNDO_API_URL}/pdf/fill`,
  },

  // WebRTC Signaling
  signal: {
    createRoom: `${SEKUNDO_API_URL}/signal/room`,
    room: (id: string) => `${SEKUNDO_API_URL}/signal/room/${id}`,
    offer: (id: string) => `${SEKUNDO_API_URL}/signal/room/${id}/offer`,
    answer: (id: string) => `${SEKUNDO_API_URL}/signal/room/${id}/answer`,
    candidates: (id: string, role: 'offer' | 'answer') =>
      `${SEKUNDO_API_URL}/signal/room/${id}/candidates/${role}`,
    state: (id: string) => `${SEKUNDO_API_URL}/signal/room/${id}/state`,
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
