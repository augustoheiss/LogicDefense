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

  return {
    eventId: state.config.id,
    eventName: state.config.name,
    eventFrequency: state.config.frequency,
    skeleton: currentSkeleton,
    recentHistory,
    privilegeRoster: options?.privilegeRoster,
    roomId: options?.roomId,
    activityLog: options?.activityLog,
    generatedAt: new Date().toISOString(),
    version: options?.privilegeRoster ? 2 : 1,
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
  const base = baseUrl.replace(/\/+$/, '');
  const roomQuery = roomId ? `&room=${encodeURIComponent(roomId)}` : '';
  return `${base}/#/view?data=${token}${roomQuery}`;
}

/**
 * Extract the encrypted token from a shareable URL.
 *
 * @param url - The full URL string.
 * @returns The token string, or null if not found.
 */
export function extractTokenFromURL(url: string): string | null {
  try {
    const hashPart = url.split('#')[1];
    if (!hashPart) return null;

    const params = new URLSearchParams(hashPart.replace(/^\/view\?/, ''));
    return params.get('data');
  } catch {
    return null;
  }
}
