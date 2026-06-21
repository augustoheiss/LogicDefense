/**
 * useAuth Hook — Assistente Moeda
 *
 * Manages authentication state across the app:
 *   - Guest mode (no auth, local-only storage)
 *   - Authenticated mode (Supabase session, cloud sync available)
 *   - Freemium tier awareness (gates premium features)
 *
 * Provides a single source of truth for auth state that the entire
 * app can consume via React context.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  signIn,
  signUp,
  signOut,
  getSession,
  getCurrentUser,
  getUserProfile,
  onAuthStateChange,
  type UserProfile,
  type PremiumTier,
} from '../storage/authService';

// ── Types ────────────────────────────────────────────────────────────────────

export type AuthMode = 'guest' | 'authenticated';

export interface AuthState {
  /** Current auth mode */
  mode: AuthMode;
  /** Whether auth is still loading on startup */
  isLoading: boolean;
  /** Currently authenticated user (null in guest mode) */
  user: User | null;
  /** User profile from Supabase (null in guest mode) */
  profile: UserProfile | null;
  /** Active session (null in guest mode) */
  session: Session | null;
  /** Whether the user has premium tier (cloud sync + AI) */
  isPremium: boolean;

  // ── Actions ───────────────────────────────────────────────
  /** Enter guest mode (skip auth) */
  enterGuestMode: () => void;
  /** Login with email/password */
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Register with email/password */
  register: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  /** Logout and return to welcome screen */
  logout: () => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const [mode, setMode] = useState<AuthMode>('guest');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // ── Initialize: check for existing session ─────────────────
  useEffect(() => {
    async function init() {
      try {
        const existingSession = await getSession();
        if (existingSession) {
          setSession(existingSession);
          const currentUser = await getCurrentUser();
          setUser(currentUser);
          if (currentUser) {
            const userProfile = await getUserProfile(currentUser.id);
            setProfile(userProfile);
          }
          setMode('authenticated');
        }
      } catch {
        // No session found — stay in loading state until user chooses
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // ── Listen for auth state changes ──────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSession(null);
        setMode('guest');
      } else if (newSession) {
        setSession(newSession);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (currentUser) {
          const userProfile = await getUserProfile(currentUser.id);
          setProfile(userProfile);
        }
        setMode('authenticated');
      }
    });

    return unsubscribe;
  }, []);

  // ── Actions ────────────────────────────────────────────────

  const enterGuestMode = useCallback(() => {
    setMode('guest');
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await signIn(email, password);
    if (result.error) return { error: result.error };
    // Auth state listener will handle the rest
    return { error: null };
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    const result = await signUp(email, password, displayName);
    if (result.error) return { error: result.error };
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    // Auth state listener will handle cleanup
  }, []);

  const isPremium = profile?.premiumTier === 'premium';

  return {
    mode,
    isLoading,
    user,
    profile,
    session,
    isPremium,
    enterGuestMode,
    login,
    register,
    logout,
  };
}

// ── React Context ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = AuthContext.Provider;

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within an AuthProvider');
  return ctx;
}
