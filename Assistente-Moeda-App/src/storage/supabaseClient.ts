/**
 * Supabase Client — Assistente Moeda
 *
 * Initializes the Supabase client with AsyncStorage for session persistence
 * on React Native. This ensures auth tokens survive app restarts.
 *
 * Storage is lazily resolved to prevent "window is not defined" errors
 * when Expo evaluates modules during static analysis or SSR passes.
 */

export { supabase } from '../lib/supabase';


