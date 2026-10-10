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

const STORAGE_KEY = 'coin_assistant_db';
const BACKUP_KEY = 'coin_assistant_db.bak';
const QUARANTINE_KEY = 'coin_assistant_db.quarantine';

/**
 * Load the full DB from AsyncStorage.
 * If primary file is corrupted, attempts to recover from rolling backup (.bak)
 * and quarantines the damaged payload.
 */
export async function loadDB(): Promise<DB | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DB;
  } catch (err) {
    console.error('CRITICAL: Corrupted DB in AsyncStorage!', err);
    // 1. Quarentena preventiva do payload quebrado
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

    // 2. Tentar recuperar do rolling backup (.bak)
    try {
      const backupRaw = await AsyncStorage.getItem(BACKUP_KEY);
      if (backupRaw) {
        const restored = JSON.parse(backupRaw) as DB;
        console.warn('SUCCESS: Recovered database from rolling backup (.bak)!');
        // Restaura a chave principal com os dados do backup
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
 * Save the full DB to AsyncStorage.
 * Keeps a rolling snapshot in BACKUP_KEY before writing the new state.
 */
export async function saveDB(db: DB): Promise<void> {
  const serialized = JSON.stringify(db);
  try {
    // 1. Rotaciona o backup se houver dados válidos prévios
    const current = await AsyncStorage.getItem(STORAGE_KEY);
    if (current && current.length > 10) {
      await AsyncStorage.setItem(BACKUP_KEY, current);
    }
  } catch (bakErr) {
    console.warn('Could not rotate rolling backup:', bakErr);
  }

  // 2. Grava o novo estado
  await AsyncStorage.setItem(STORAGE_KEY, serialized);
}

/**
 * Clear all CoinAssistant data from AsyncStorage.
 * Used during account deletion or full reset.
 */
export async function clearDB(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEY, BACKUP_KEY, QUARANTINE_KEY]);
}

/**
 * Get the raw JSON size of the stored DB (for sync diagnostics).
 * Returns 0 if no data exists.
 */
export async function getDBSizeBytes(): Promise<number> {
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
