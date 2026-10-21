/**
 * Sekundo — Persistent Activity Log & Trusted Device Session Store
 *
 * Implements:
 * 1. First-Time Registration Persistence (`sekundo:trusted_session_v1:<scope>`):
 *    - Stores the confirmed `AuthenticatedSessionPrincipal` locally so the user only
 *      needs to confirm Full Name + Group + PIN on their FIRST entry.
 *    - Supports explicit `logoutTrustedSession` ("🚪 Sair / Logout") which wipes the saved
 *      session and forces full registration confirmation for the next person on the device.
 *    - Supports `lockTrustedSessionWithPin` / `unlockTrustedSessionWithPin` ("🔒 Bloquear c/ PIN")
 *      for quick protection when sharing the same phone or computer.
 * 2. Append-Only Activity Log Persistence (`sekundo:activity_log_v1:<eventId>`):
 *    - Persists every access, rejection, consultation, cell edit, privilege change, and export.
 */

import { Platform } from 'react-native';
import {
  type AuthenticatedSessionPrincipal,
  type ActivityLogEntry,
  type CreateActivityLogInput,
  type ParticipantProfile,
  appendActivityLogEntry,
  mergeActivityLogs,
  revalidateSavedSessionPrincipal,
  lockSessionWithPin,
  unlockSessionWithPin,
} from '@sekundo/core';
import { storage } from './localStorage';

const TRUSTED_SESSION_PREFIX = 'sekundo:trusted_session_v1:';
const ACTIVITY_LOG_PREFIX = 'sekundo:activity_log_v1:';

function readSyncWebStorage(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

function writeSyncWebStorage(key: string, value: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore quota
    }
  }
}

function removeSyncWebStorage(key: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/**
 * Loads the persisted `AuthenticatedSessionPrincipal` for a given scope/event
 * (or falls back to the device's default registered session) and re-validates it
 * against the latest Privilege Roster.
 */
export async function loadTrustedSessionPrincipal(
  scopeKey: string,
  roster: ParticipantProfile[]
): Promise<AuthenticatedSessionPrincipal | null> {
  const cleanScope = (scopeKey || 'default').trim();
  const specificKey = `${TRUSTED_SESSION_PREFIX}${cleanScope}`;
  const fallbackKey = `${TRUSTED_SESSION_PREFIX}default`;

  try {
    const raw =
      readSyncWebStorage(specificKey) ??
      (await storage.getItem(specificKey)) ??
      readSyncWebStorage(fallbackKey) ??
      (await storage.getItem(fallbackKey));

    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthenticatedSessionPrincipal;
    if (!parsed || !parsed.fullName) return null;

    if (Array.isArray(roster) && roster.length > 0) {
      const check = revalidateSavedSessionPrincipal(parsed, roster);
      if (!check.allowed || !check.principal) {
        return null;
      }
      return check.principal;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persists a confirmed `AuthenticatedSessionPrincipal` on the device so the user
 * is not prompted for Full Name + Group + PIN on future visits until they Logout.
 */
export async function saveTrustedSessionPrincipal(
  scopeKey: string,
  principal: AuthenticatedSessionPrincipal
): Promise<void> {
  const cleanScope = (scopeKey || 'default').trim();
  const specificKey = `${TRUSTED_SESSION_PREFIX}${cleanScope}`;
  const fallbackKey = `${TRUSTED_SESSION_PREFIX}default`;
  const serialized = JSON.stringify(principal);

  writeSyncWebStorage(specificKey, serialized);
  writeSyncWebStorage(fallbackKey, serialized);
  await storage.setItem(specificKey, serialized).catch(() => undefined);
  await storage.setItem(fallbackKey, serialized).catch(() => undefined);
}

/**
 * Explicit Logout ("🚪 Sair / Trocar Usuário"):
 * Removes the persisted session from the device so the next person accessing
 * the same phone or computer must confirm Full Name, Group, and PIN.
 */
export async function clearTrustedSessionPrincipal(scopeKey: string): Promise<void> {
  const cleanScope = (scopeKey || 'default').trim();
  const specificKey = `${TRUSTED_SESSION_PREFIX}${cleanScope}`;
  const fallbackKey = `${TRUSTED_SESSION_PREFIX}default`;

  removeSyncWebStorage(specificKey);
  removeSyncWebStorage(fallbackKey);
  await storage.removeItem(specificKey).catch(() => undefined);
  await storage.removeItem(fallbackKey).catch(() => undefined);
}

/**
 * Locks the current session with PIN on a shared device.
 */
export async function lockTrustedDeviceSession(
  scopeKey: string,
  principal: AuthenticatedSessionPrincipal
): Promise<AuthenticatedSessionPrincipal> {
  const locked = lockSessionWithPin(principal);
  await saveTrustedSessionPrincipal(scopeKey, locked);
  return locked;
}

/**
 * Unlocks a PIN-locked session on a shared device.
 */
export async function unlockTrustedDeviceSession(
  scopeKey: string,
  principal: AuthenticatedSessionPrincipal,
  pin: string
): Promise<{ unlocked: boolean; principal: AuthenticatedSessionPrincipal; errorMessage?: string }> {
  const res = unlockSessionWithPin(principal, pin);
  if (res.unlocked) {
    await saveTrustedSessionPrincipal(scopeKey, res.principal);
  }
  return res;
}

/**
 * Loads the persisted immutable Activity Log for an event.
 */
export async function loadPersistedActivityLog(eventId: string): Promise<ActivityLogEntry[]> {
  const cleanId = (eventId || 'global').trim();
  const key = `${ACTIVITY_LOG_PREFIX}${cleanId}`;
  try {
    const raw = readSyncWebStorage(key) ?? (await storage.getItem(key));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves an Activity Log array for an event (and mirrors to `global` for unified auditing).
 */
export async function savePersistedActivityLog(
  eventId: string,
  entries: ActivityLogEntry[]
): Promise<void> {
  const cleanId = (eventId || 'global').trim();
  const key = `${ACTIVITY_LOG_PREFIX}${cleanId}`;
  const serialized = JSON.stringify(entries);
  writeSyncWebStorage(key, serialized);
  await storage.setItem(key, serialized).catch(() => undefined);
}

/**
 * Appends a single governance/activity event to the persisted Activity Log and returns
 * both the newly created `entry` and the `updatedLog`.
 */
export async function recordPersistedActivityEvent(
  input: CreateActivityLogInput
): Promise<{ entry: ActivityLogEntry; updatedLog: ActivityLogEntry[] }> {
  const eventId = (input.eventId || 'global').trim();
  const existing = await loadPersistedActivityLog(eventId);
  const { updatedLog, entry } = appendActivityLogEntry(existing, input);
  await savePersistedActivityLog(eventId, updatedLog);
  return { entry, updatedLog };
}

/**
 * Merges incoming remote activity log entries into local storage.
 */
export async function mergeAndSaveActivityLog(
  eventId: string,
  incomingEntries: ActivityLogEntry[]
): Promise<ActivityLogEntry[]> {
  const cleanId = (eventId || 'global').trim();
  const existing = await loadPersistedActivityLog(cleanId);
  const merged = mergeActivityLogs(existing, incomingEntries);
  await savePersistedActivityLog(cleanId, merged);
  return merged;
}
