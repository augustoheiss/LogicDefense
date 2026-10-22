/**
 * Sekundo — Token Generator
 *
 * Generates shareable encrypted tokens for the Hybrid Data Transport
 * Architecture. Handles the Horizon Window packaging and URL construction.
 */

import type { EventState, RolloverSnapshot } from '../events/types';
import type { FlatRegistry } from '../skeleton/types';
import type { ParticipantProfile } from '../roster/participantDirectory';
import type { ActivityLogEntry } from '../audit/activityLogEngine';
import { computePinVerifierHash } from '../auth/privilegeAccessGuard';
import { encryptForURL, decryptFromURL } from './symmetric';

// ---------------------------------------------------------------------------
// Horizon Window
// ---------------------------------------------------------------------------

/** Maximum number of weeks of history included in the Horizon Window. */
const HORIZON_WEEKS = 2;

export interface GenerateTokenOptions {
  /** Privilege Matrix roster embedded in the encrypted payload for zero-trust registration verification */
  privilegeRoster?: ParticipantProfile[];
  /** Ephemeral simultaneous collaboration room ID */
  roomId?: string;
  /** Initial immutable activity log trail */
  activityLog?: ActivityLogEntry[];
}

/**
 * The payload packaged into the shareable link.
 * Contains only what the viewer needs for the immediate context.
 */
export interface HorizonPayload {
  /** Event container ID */
  eventId?: string;
  /** Event configuration. */
  eventName: string;
  eventFrequency: string;

  /** Current active skeleton. */
  skeleton: FlatRegistry;

  /** Recent archive snapshots (last N weeks/periods). */
  recentHistory: RolloverSnapshot[];

  /** Privilege Matrix roster for Identity Gate & `👑 Selo Admin` RBAC enforcement */
  privilegeRoster?: ParticipantProfile[];

  /** Simultaneous collaboration room ID */
  roomId?: string;

  /** Initial activity log entries */
  activityLog?: ActivityLogEntry[];

  /** Timestamp when this token was generated. */
  generatedAt: string;

  /** Version tag for forward compatibility. */
  version: number;
}

/**
 * Build the Horizon Window payload from event state.
 *
 * @param state - The full event state from localStorage.
 * @param currentSkeleton - The current active flat skeleton registry.
 * @param options - Optional privilege roster, roomId, and activity log.
 * @returns The packaged payload ready for encryption.
 */
export function buildHorizonPayload(
  state: EventState,
  currentSkeleton: FlatRegistry,
  options?: GenerateTokenOptions
): HorizonPayload {
  // Take only the most recent N snapshots
  const recentHistory = state.archive.slice(-HORIZON_WEEKS);

  // Redact plaintext accessPin into deterministic pinVerifierHash so viewers cannot inspect other users' PINs
  const sanitizedRoster: ParticipantProfile[] | undefined = options?.privilegeRoster
    ? options.privilegeRoster.map((p) => {
        const { accessPin, ...rest } = p;
        const hash =
          rest.pinVerifierHash ||
          (accessPin ? computePinVerifierHash(accessPin, rest.id) : undefined);
        return hash ? { ...rest, pinVerifierHash: hash } : { ...rest };
      })
    : undefined;

  return {
    eventId: state.config.id,
    eventName: state.config.name,
    eventFrequency: state.config.frequency,
    skeleton: currentSkeleton,
    recentHistory,
    privilegeRoster: sanitizedRoster,
    roomId: options?.roomId,
    activityLog: options?.activityLog,
    generatedAt: new Date().toISOString(),
    version: sanitizedRoster ? 2 : 1,
  };
}

// ---------------------------------------------------------------------------
// Token Generation
// ---------------------------------------------------------------------------

/**
 * Generate an encrypted shareable token from event state.
 *
 * @param state - The full event state.
 * @param skeleton - Current active skeleton.
 * @param passphrase - Admin-chosen passphrase (shared out-of-band).
 * @param options - Optional privilege roster, roomId, and activity log.
 * @returns URL-safe Base64 token string.
 */
export async function generateToken(
  state: EventState,
  skeleton: FlatRegistry,
  passphrase: string,
  options?: GenerateTokenOptions
): Promise<string> {
  const payload = buildHorizonPayload(state, skeleton, options);
  return encryptForURL(payload, passphrase);
}

/**
 * Decode and decrypt a shareable token back to a HorizonPayload.
 *
 * @param token - The URL-safe Base64 token string.
 * @param passphrase - The passphrase shared by the admin.
 * @returns The decrypted HorizonPayload.
 * @throws {Error} If the passphrase is wrong or the token is corrupted.
 */
export async function decodeToken(
  token: string,
  passphrase: string
): Promise<HorizonPayload> {
  const data = await decryptFromURL(token, passphrase);
  return data as HorizonPayload;
}

// ---------------------------------------------------------------------------
// URL Construction
// ---------------------------------------------------------------------------

/**
 * Build a complete shareable URL with the encrypted token in the fragment.
 * The fragment (`#`) ensures the payload never touches the server.
 *
 * @param baseUrl - The app's base URL (e.g., "https://sekundo.app").
 * @param token - The encrypted token from generateToken().
 * @returns Full URL string.
 *
 * @example
 * buildShareURL("https://sekundo.app", token)
 * // → "https://sekundo.app/#/view?data=aBcDeFgH..."
 */
export function buildShareURL(baseUrl: string, token: string, roomId?: string): string {
  // Strip trailing slash
  let base = baseUrl.replace(/\/+$/, '');
  if (/^https?:\/\/(www\.)?heisslab\.com\.br$/i.test(base)) {
    base = `${base}/laboratorio/sekundo`;
  }
  const roomQuery = roomId ? `&room=${encodeURIComponent(roomId)}` : '';
  return `${base}/#/view?data=${token}${roomQuery}`;
}

/**
 * Extract the encrypted token from a shareable URL.
 * Supports `#/view?data=...`, `#data=...`, and `?data=...` query strings.
 *
 * @param url - The full URL string.
 * @returns The token string, or null if not found.
 */
export function extractTokenFromURL(url: string): string | null {
  try {
    const trimmed = (url || '').trim();
    if (!trimmed) return null;

    if (trimmed.includes('#')) {
      const hashPart = trimmed.split('#')[1] || '';
      const cleanHash = hashPart.replace(/^\/?view\??/, '');
      const hashParams = new URLSearchParams(cleanHash);
      const fromHash = hashParams.get('data');
      if (fromHash) return fromHash;
    }

    if (trimmed.includes('?')) {
      const queryPart = trimmed.split('#')[0].split('?')[1] || '';
      const queryParams = new URLSearchParams(queryPart);
      const fromQuery = queryParams.get('data');
      if (fromQuery) return fromQuery;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract the collaborative room ID (`room`) from a shareable URL.
 * Supports `#/view?data=...&room=...` and `?room=...` query strings.
 *
 * @param url - The full URL string.
 * @returns The room ID string, or null if not found.
 */
export function extractRoomFromURL(url: string): string | null {
  try {
    const trimmed = (url || '').trim();
    if (!trimmed) return null;

    if (trimmed.includes('#')) {
      const hashPart = trimmed.split('#')[1] || '';
      const cleanHash = hashPart.replace(/^\/?view\??/, '');
      const hashParams = new URLSearchParams(cleanHash);
      const fromHash = hashParams.get('room');
      if (fromHash) return fromHash;
    }

    if (trimmed.includes('?')) {
      const queryPart = trimmed.split('#')[0].split('?')[1] || '';
      const queryParams = new URLSearchParams(queryPart);
      const fromQuery = queryParams.get('room');
      if (fromQuery) return fromQuery;
    }

    return null;
  } catch {
    return null;
  }
}
