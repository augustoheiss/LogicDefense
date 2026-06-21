/**
 * AsyncStorage Adapter — Drop-in replacement for localStorage
 *
 * Maps the web CoinAssistant's localStorage API to React Native's
 * AsyncStorage. All operations are async (unlike localStorage),
 * so the useCoinDB hook wraps them with proper loading states.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DB } from '../core/types';

const STORAGE_KEY = 'coin_assistant_db';

/**
 * Load the full DB from AsyncStorage.
 * Returns null if no data exists or data is corrupt.
 */
export async function loadDB(): Promise<DB | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch {
    // Ignore corrupt data — will be treated as fresh start
  }
  return null;
}

/**
 * Save the full DB to AsyncStorage.
 * Serializes the entire state — identical to the web version's saveDB().
 */
export async function saveDB(db: DB): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/**
 * Clear all CoinAssistant data from AsyncStorage.
 * Used during account deletion or full reset.
 */
export async function clearDB(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Get the raw JSON size of the stored DB (for sync diagnostics).
 * Returns 0 if no data exists.
 */
export async function getDBSizeBytes(): Promise<number> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? raw.length : 0;
}
