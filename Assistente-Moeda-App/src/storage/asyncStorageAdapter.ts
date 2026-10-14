/**
 * AsyncStorage Adapter — Drop-in replacement for localStorage
 *
 * Maps the web CoinAssistant's localStorage API to React Native's
 * AsyncStorage. All operations are async (unlike localStorage),
 * so the useCoinDB hook wraps them with proper loading states.
 *
 * Resilient Persistence:
 * - Creates a rolling backup (.bak) on every successful save.
 * - Isolates malformed or corrupted states to quarantine (.quarantine)
 *   instead of silently wiping customer financial records.
 * - Auto-falls back to (.bak) if primary storage is damaged.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DB } from '../core/types';
import {
  isIndexedDBAvailable,
  loadDBFromIndexedDB,
  saveDBToIndexedDB,
  clearIndexedDB,
} from './indexedDBAdapter';

const STORAGE_KEY = 'coin_assistant_db';
const BACKUP_KEY = 'coin_assistant_db.bak';
const QUARANTINE_KEY = 'coin_assistant_db.quarantine';
const PRIVACY_MODE_KEY = 'coin_privacy_mode';
const UI_VIEW_MODE_KEY = 'coin_ui_view_mode';

let _nativePrivacyMode = false;
let _nativeViewMode: 'cards' | 'grid' | null = null;

/**
 * Load the full DB from IndexedDB (on Web) or AsyncStorage (Native / Node test fallback).
 * If primary file is corrupted, attempts to recover from rolling backup (.bak)
 * and quarantines the damaged payload.
 */
export async function loadDB(): Promise<DB | null> {
  // Hydrate native synchronous preference cache on mobile
  if (typeof window === 'undefined' || !window.localStorage) {
    try {
      const [privRaw, viewRaw] = await AsyncStorage.multiGet([PRIVACY_MODE_KEY, UI_VIEW_MODE_KEY]);
      if (privRaw && privRaw[1] !== null) {
        _nativePrivacyMode = privRaw[1] === 'true';
      }
      if (viewRaw && viewRaw[1] !== null) {
        const mode = viewRaw[1];
        if (mode === 'cards' || mode === 'grid') _nativeViewMode = mode;
        else if (mode === 'spreadsheet') _nativeViewMode = 'grid';
      }
    } catch {
      // ignore
    }
  }

  if (isIndexedDBAvailable()) {
    try {
      const idbData = await loadDBFromIndexedDB();
      if (idbData) return idbData;
    } catch (idbErr) {
      console.warn('[Storage] IndexedDB load failed, falling back to AsyncStorage:', idbErr);
    }
  }

  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DB;
  } catch (err) {
    console.error('CRITICAL: Corrupted DB in AsyncStorage!', err);
    if (raw) {
      try {
        await AsyncStorage.setItem(
          QUARANTINE_KEY,
          JSON.stringify({
            quarantinedAt: new Date().toISOString(),
            error: String(err),
            rawPayload: raw,
          })
        );
      } catch (qErr) {
        console.error('Failed to quarantine corrupted DB:', qErr);
      }
    }

    try {
      const backupRaw = await AsyncStorage.getItem(BACKUP_KEY);
      if (backupRaw) {
        const restored = JSON.parse(backupRaw) as DB;
        console.warn('SUCCESS: Recovered database from rolling backup (.bak)!');
        await AsyncStorage.setItem(STORAGE_KEY, backupRaw);
        return restored;
      }
    } catch (bErr) {
      console.error('Backup recovery also failed:', bErr);
    }
  }
  return null;
}

/**
 * Save the full DB to IndexedDB (Web) and AsyncStorage (Native / fallback).
 * Protects against QuotaExceededError on Web localStorage.
 */
export async function saveDB(db: DB): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await saveDBToIndexedDB(db);
      return;
    } catch (idbErr) {
      console.warn('[Storage] IndexedDB save failed, falling back to AsyncStorage:', idbErr);
    }
  }

  const serialized = JSON.stringify(db);
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEY);
    if (current && current.length > 10) {
      await AsyncStorage.setItem(BACKUP_KEY, current);
    }
  } catch (bakErr) {
    console.warn('Could not rotate rolling backup:', bakErr);
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  } catch (writeErr) {
    console.error('Failed to write DB to AsyncStorage:', writeErr);
  }
}

/**
 * Clear all CoinAssistant data from IndexedDB and AsyncStorage.
 */
export async function clearDB(): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await clearIndexedDB();
    } catch (e) {
      console.warn('Failed to clear IndexedDB:', e);
    }
  }
  await AsyncStorage.multiRemove([STORAGE_KEY, BACKUP_KEY, QUARANTINE_KEY]);
}

/**
 * Get the raw JSON size of the stored DB (for sync diagnostics).
 */
export async function getDBSizeBytes(): Promise<number> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await loadDBFromIndexedDB();
      return db ? JSON.stringify(db).length : 0;
    } catch {
      // fallback
    }
  }
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? raw.length : 0;
}

/**
 * Check if quarantine data exists.
 */
export async function hasQuarantinedData(): Promise<boolean> {
  const q = await AsyncStorage.getItem(QUARANTINE_KEY);
  return !!q;
}

// ── Fast L1 Synchronous Preference Helpers (Privacy Mode & View Mode) ────────

export function getPrivacyModeSync(): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
  }
  return _nativePrivacyMode;
}

export function setPrivacyModeSync(enabled: boolean): void {
  _nativePrivacyMode = enabled;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PRIVACY_MODE_KEY, enabled ? 'true' : 'false');
    } catch {
      // ignore
    }
    return;
  }
  AsyncStorage.setItem(PRIVACY_MODE_KEY, enabled ? 'true' : 'false').catch(() => {});
}

export function getUIViewModeSync(fallback: 'cards' | 'grid' = 'cards'): 'cards' | 'grid' {
  if (typeof window !== 'undefined' && window.localStorage) {
    const mode = window.localStorage.getItem(UI_VIEW_MODE_KEY);
    if (mode === 'cards' || mode === 'grid') return mode;
    if (mode === 'spreadsheet') return 'grid';
  }
  if (_nativeViewMode) return _nativeViewMode;
  return fallback;
}

export function setUIViewModeSync(mode: 'cards' | 'grid' | 'spreadsheet'): void {
  _nativeViewMode = mode === 'spreadsheet' ? 'grid' : mode;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(UI_VIEW_MODE_KEY, mode);
    } catch {
      // ignore
    }
    return;
  }
  AsyncStorage.setItem(UI_VIEW_MODE_KEY, mode).catch(() => {});
}

