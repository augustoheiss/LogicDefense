/**
 * Local Data Sync & Backup Service — Assistente Moeda Mobile
 * Zero Supabase dependency — local storage persistence + CSV/JSON exports.
 */

import { loadDB, saveDB } from './asyncStorageAdapter';

export async function pushToCloud(): Promise<{ success: boolean; error?: string }> {
  // Local-first: Data is already saved in AsyncStorage
  return { success: true };
}

export async function pullFromCloud(): Promise<{ success: boolean; error?: string }> {
  // Local-first: Read directly from AsyncStorage
  return { success: true };
}

export async function fullSync(): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}

export async function deleteAllCloudData(): Promise<void> {
  await saveDB({ tables: [], aiCostCurrentMonth: 0, aiCostLastReset: '' });
}
