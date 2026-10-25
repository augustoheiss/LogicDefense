/**
 * Local-First Sync Stub — Assistente Moeda
 *
 * All data is stored locally in IndexedDB / AsyncStorage and optionally synced
 * with the user's own Turso database or FastAPI gateway when configured.
 */

export interface SyncResult {
  success: boolean;
  error?: string;
  tablesCount?: number;
}

export async function pushToCloud(_userId?: string): Promise<SyncResult> {
  return { success: true, tablesCount: 0 };
}

export async function pullFromCloud(_userId?: string): Promise<SyncResult> {
  return { success: true, tablesCount: 0 };
}

export async function fullSync(_userId?: string): Promise<SyncResult> {
  return { success: true, tablesCount: 0 };
}

export async function deleteAllCloudData(_userId?: string): Promise<SyncResult> {
  return { success: true, tablesCount: 0 };
}
