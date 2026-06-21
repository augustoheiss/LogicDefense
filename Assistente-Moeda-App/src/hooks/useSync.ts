/**
 * useSync Hook — Assistente Moeda
 *
 * Manages sync state between local storage and Supabase:
 *   - Tracks sync status (idle, syncing, success, error)
 *   - Provides manual sync trigger
 *   - Auto-syncs on app foreground (when authenticated + sync enabled)
 */

import { useState, useCallback } from 'react';
import { fullSync, pushToCloud, pullFromCloud } from '../storage/supabaseSync';

// ── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: Date | null;
  error: string | null;
  /** Trigger a full sync (push + pull) */
  sync: (userId: string) => Promise<void>;
  /** Push local changes to cloud only */
  push: (userId: string) => Promise<void>;
  /** Pull cloud data to local only */
  pull: (userId: string) => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSync(): SyncState {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async (userId: string) => {
    setStatus('syncing');
    setError(null);
    const result = await fullSync(userId);
    if (result.success) {
      setStatus('success');
      setLastSyncAt(new Date());
      // Reset to idle after 3s
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
      setError(result.error ?? 'Sync failed');
    }
  }, []);

  const push = useCallback(async (userId: string) => {
    setStatus('syncing');
    setError(null);
    const result = await pushToCloud(userId);
    if (result.success) {
      setStatus('success');
      setLastSyncAt(new Date());
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
      setError(result.error ?? 'Push failed');
    }
  }, []);

  const pull = useCallback(async (userId: string) => {
    setStatus('syncing');
    setError(null);
    const result = await pullFromCloud(userId);
    if (result.success) {
      setStatus('success');
      setLastSyncAt(new Date());
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
      setError(result.error ?? 'Pull failed');
    }
  }, []);

  return {
    status,
    lastSyncAt,
    error,
    sync,
    push,
    pull,
  };
}
