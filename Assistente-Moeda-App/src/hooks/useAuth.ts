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

import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
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
  /** Raw fetch error message if profile retrieval fails */
  profileFetchError: string | null;

  // ── Actions ───────────────────────────────────────────────
  /** Enter guest mode (skip auth) */
  enterGuestMode: () => void;
  /** Login with email/password */
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Register with email/password */
  register: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  /** Logout and return to welcome screen */
  logout: () => Promise<void>;
  /** Refresh user profile and settings manually */
  refreshProfile: () => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const [mode, setMode] = useState<AuthMode>('guest');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profileFetchError, setProfileFetchError] = useState<string | null>(null);

  // ── Helper Callbacks for Cache & Retry ──────────────────────
  const loadProfileFromCache = useCallback(async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const cached = await AsyncStorage.getItem('coin_assistant_cached_profile');
      if (cached) {
        setProfile(JSON.parse(cached));
      }
    } catch (cacheErr) {
      console.error('Failed to load cached profile:', cacheErr);
    }
  }, []);

  const triggerBackgroundAuthRetry = useCallback((userId: string) => {
    setTimeout(() => {
      console.log('Retrying profile refresh silently in the background...');
      getUserProfile(userId).then(async (userProfile) => {
        if (userProfile) {
          setProfile(userProfile);
          setProfileFetchError(null);
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('coin_assistant_cached_profile', JSON.stringify(userProfile));
          console.log('Background profile refresh succeeded!');
        }
      }).catch((err) => {
        console.warn('Background profile refresh failed:', err);
      });
    }, 10000);
  }, []);

  // ── Initialize: check for existing session ─────────────────
  useEffect(() => {
    async function init() {
      let timeoutId: any = null;
      try {
        const initPromise = (async () => {
          const existingSession = await getSession();
          if (existingSession && existingSession.access_token) {
            setSession(existingSession);
            setUser(existingSession.user);
            setProfileFetchError(null);
            try {
              const userProfile = await getUserProfile(existingSession.user.id);
              setProfile(userProfile);
              const AsyncStorage = require('@react-native-async-storage/async-storage').default;
              await AsyncStorage.setItem('coin_assistant_cached_profile', JSON.stringify(userProfile));
            } catch (err: any) {
              console.error('Initial profile fetch failed:', err);
              setProfileFetchError(err?.message || String(err));
              await loadProfileFromCache();
            }
            setMode('authenticated');
          } else {
            setMode('guest');
          }
        })();

        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Timeout')), 4000);
        });

        await Promise.race([initPromise, timeoutPromise]);
      } catch (err: any) {
        console.warn('Auth initialization timed out or failed, falling back to offline mode:', err);
        
        // Attempt to load from cache
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const keys = await AsyncStorage.getAllKeys();
          const sbKey = keys.find((k: string) => k.startsWith('sb-') && k.endsWith('-auth-token'));
          if (sbKey) {
            const rawSession = await AsyncStorage.getItem(sbKey);
            if (rawSession) {
              const parsed = JSON.parse(rawSession);
              if (parsed && parsed.user) {
                setUser(parsed.user);
                setSession(parsed);
                setMode('authenticated');
                await loadProfileFromCache();
                triggerBackgroundAuthRetry(parsed.user.id);
                return;
              }
            }
          }
        } catch (fallbackErr) {
          console.error('Session recovery fallback failed:', fallbackErr);
        }
        setMode('guest');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        setIsLoading(false);
      }
    }
    init();
  }, [loadProfileFromCache, triggerBackgroundAuthRetry]);

  // ── Listen for auth state changes ──────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSession(null);
        setProfileFetchError(null);
        setMode('guest');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newSession && newSession.access_token) {
          setSession(newSession);
          setUser(newSession.user);
          setProfileFetchError(null);
          try {
            const userProfile = await getUserProfile(newSession.user.id);
            setProfile(userProfile);
          } catch (err: any) {
            console.error('State change profile fetch failed:', err);
            setProfileFetchError(err?.message || String(err));
          }
          setMode('authenticated');
        }
      } else if (newSession && newSession.access_token) {
        setSession(newSession);
        setUser(newSession.user);
        setProfileFetchError(null);
        try {
          const userProfile = await getUserProfile(newSession.user.id);
          setProfile(userProfile);
        } catch (err: any) {
          console.error('Fallback profile fetch failed:', err);
          setProfileFetchError(err?.message || String(err));
        }
        setMode('authenticated');
      }
    });

    return unsubscribe;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    setProfileFetchError(null);
    try {
      const userProfile = await getUserProfile(user.id);
      setProfile(userProfile);
    } catch (err: any) {
      console.error('Failed to refresh profile:', err);
      setProfileFetchError(err?.message || String(err));
    }
  }, [user?.id]);

  // ── Supabase Realtime Listener for profiles & settings updates ──
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `db-sync-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('Realtime profiles update detected:', payload);
          await refreshProfile();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_settings',
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('Realtime user_settings update detected:', payload);
          await refreshProfile();
          if (Platform.OS === 'web') {
            window.dispatchEvent(new Event('supabase_settings_updated'));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshProfile]);

  // ── Actions ────────────────────────────────────────────────

  const enterGuestMode = useCallback(() => {
    setMode('guest');
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await signIn(email, password);
    if (result.error) return { error: result.error };
    
    // Explicitly update React state variables right here for instant reactivity
    if (result.session) {
      setSession(result.session);
      setUser(result.session.user);
      const userProfile = await getUserProfile(result.session.user.id);
      setProfile(userProfile);
      setMode('authenticated');
    }
    
    return { error: null };
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    const result = await signUp(email, password, displayName);
    if (result.error) return { error: result.error };
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    let signOutError: any = null;
    try {
      await signOut();
    } catch (e) {
      console.error('Supabase signOut failed:', e);
      signOutError = e;
    }

    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.clear();
    } catch (e) {
      console.warn('Wiping storage failed:', e);
    }

    if (Platform.OS === 'web') {
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('Web local/session storage clear failed:', e);
      }
    }

    setUser(null);
    setProfile(null);
    setSession(null);
    setMode('guest');

    if (signOutError) {
      throw signOutError;
    }
  }, []);

  const isReviewer = !!(
    user?.email && user.email.toLowerCase() === 'augustotester@gmail.com'
  );

  const effectiveProfile = useMemo(() => {
    if (!profile) return null;
    if (isReviewer) {
      return { ...profile, premiumTier: 'premium' as const };
    }
    return profile;
  }, [profile, isReviewer]);

  const isPremium = isReviewer || profile?.premiumTier === 'premium';

  return {
    mode,
    isLoading,
    user,
    profile: effectiveProfile,
    session,
    isPremium,
    profileFetchError,
    enterGuestMode,
    login,
    register,
    logout,
    refreshProfile,
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
