/**
 * Supabase Client — Assistente Moeda
 *
 * Initializes the Supabase client with AsyncStorage for session persistence
 * on React Native. This ensures auth tokens survive app restarts.
 *
 * Storage is lazily resolved to prevent "window is not defined" errors
 * when Expo evaluates modules during static analysis or SSR passes.
 */

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Platform-safe storage adapter.
 *
 * - React Native (iOS/Android): uses AsyncStorage directly
 * - Web (browser): uses AsyncStorage's web shim (which wraps localStorage)
 * - Node/SSR: uses an in-memory fallback so imports don't crash
 */
function getStorage() {
  // In Node.js / SSR contexts, there's no window or RN runtime.
  // Return a no-op storage so the module can be imported safely.
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return {
      getItem: async (_key: string) => null,
      setItem: async (_key: string, _value: string) => {},
      removeItem: async (_key: string) => {},
    };
  }

  // Safe to import AsyncStorage — we're in a browser or RN runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disable for React Native (no URL bar)
  },
});

