/**
 * Supabase Client — Assistente Moeda
 *
 * Initializes the Supabase client with AsyncStorage for session persistence
 * on React Native/Expo. This ensures auth tokens survive app restarts.
 *
 * Storage is lazily resolved to prevent "window is not defined" errors
 * when Expo evaluates modules during static analysis or SSR passes.
 */

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://build-time-placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'build-time-placeholder-key';

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
    !process.env.EXPO_PUBLIC_SUPABASE_URL.includes('build-time-placeholder')
);

/**
 * Platform-safe storage adapter.
 *
 * - React Native (iOS/Android): uses AsyncStorage directly
 * - Web (browser): uses AsyncStorage's web shim (which wraps localStorage)
 * - Node/SSR: uses an in-memory fallback so imports don't crash
 */
function getStorage() {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return {
      getItem: async (_key: string) => null,
      setItem: async (_key: string, _value: string) => { },
      removeItem: async (_key: string) => { },
    };
  }

  if (typeof require === 'function') {
    try {
      // Importação lazy segura para o build de produção do Metro (iOS/Android)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsyncStorageModule = require('@react-native-async-storage/async-storage');
      return AsyncStorageModule.default || AsyncStorageModule;
    } catch {
      // Fallback below
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: async (key: string) => window.localStorage.getItem(key),
      setItem: async (key: string, value: string) => window.localStorage.setItem(key, value),
      removeItem: async (key: string) => window.localStorage.removeItem(key),
    };
  }

  return {
    getItem: async (_key: string) => null,
    setItem: async (_key: string, _value: string) => { },
    removeItem: async (_key: string) => { },
  };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: isSupabaseConfigured,
    persistSession: isSupabaseConfigured,
    detectSessionInUrl: false, // Disable for React Native (no URL bar)
  },
});
