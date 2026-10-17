/**
 * useAuth Hook — Assistente Moeda
 *
 * Manages authentication state across the app in local-first mode:
 *   - Guest mode (no auth required, 100% local storage)
 *   - License Key mode (for unlocking server AI features)
 */

import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { getStoredLicenseKey, validateMobileLicenseKey, type UserProfile } from '../storage/authService';

const API_URL = process.env.EXPO_PUBLIC_AI_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || 'https://ocorrencias-pdf-writer.onrender.com';

export type AuthMode = 'guest' | 'authenticated';

export interface AuthState {
  mode: AuthMode;
  isLoading: boolean;
  user: any | null;
  profile: UserProfile | null;
  session: any | null;
  isPremium: boolean;
  profileFetchError: string | null;
  enterGuestMode: () => void;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [mode, setMode] = useState<AuthMode>('guest');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any | null>({ id: 'local_user', email: 'user@local' });
  const [profile, setProfile] = useState<UserProfile | null>({
    id: 'local_user',
    displayName: 'Usuário Local',
    email: null,
    licenseKey: null,
    premiumTier: 'free',
    tokenBalance: 0,
    tokenCap: 0,
  });

  const loadProfileFromLicense = useCallback(async (key: string): Promise<UserProfile> => {
    const res = await validateMobileLicenseKey(key, API_URL);
    if (res.valid) {
      return {
        id: 'local_user',
        displayName: res.tier === 'godmode_owner' ? 'Usuário God Mode' : 'Usuário Pro',
        email: null,
        licenseKey: key,
        premiumTier: res.tier,
        tokenBalance: res.balance,
        tokenCap: res.cap,
      };
    }
    return {
      id: 'local_user',
      displayName: 'Usuário Local',
      email: null,
      licenseKey: null,
      premiumTier: 'free',
      tokenBalance: 0,
      tokenCap: 0,
    };
  }, []);

  useEffect(() => {
    async function checkLicense() {
      try {
        const key = await getStoredLicenseKey();
        if (key) {
          const prof = await loadProfileFromLicense(key);
          setProfile(prof);
        } else {
          setProfile({
            id: 'local_user',
            displayName: 'Usuário Local',
            email: null,
            licenseKey: null,
            premiumTier: 'free',
            tokenBalance: 0,
            tokenCap: 0,
          });
        }
      } catch (err) {
        console.warn('License check error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkLicense();
  }, [loadProfileFromLicense]);

  const enterGuestMode = useCallback(() => {
    setMode('guest');
  }, []);

  const login = useCallback(async () => {
    return { error: null };
  }, []);

  const register = useCallback(async () => {
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    setMode('guest');
  }, []);

  const refreshProfile = useCallback(async () => {
    const key = await getStoredLicenseKey();
    if (!key) {
      setProfile({
        id: 'local_user',
        displayName: 'Usuário Local',
        email: null,
        licenseKey: null,
        premiumTier: 'free',
        tokenBalance: 0,
        tokenCap: 0,
      });
      return;
    }
    const prof = await loadProfileFromLicense(key);
    setProfile(prof);
  }, [loadProfileFromLicense]);

  const isPremium = Boolean(profile?.licenseKey && profile?.premiumTier && profile?.premiumTier !== 'free');

  return {
    mode,
    isLoading,
    user,
    profile,
    session: null,
    isPremium,
    profileFetchError: null,
    enterGuestMode,
    login,
    register,
    logout,
    refreshProfile,
  };
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = AuthContext.Provider;

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      mode: 'guest',
      isLoading: false,
      user: { id: 'local_user' },
      profile: null,
      session: null,
      isPremium: false,
      profileFetchError: null,
      enterGuestMode: () => {},
      login: async () => ({ error: null }),
      register: async () => ({ error: null }),
      logout: async () => {},
      refreshProfile: async () => {},
    };
  }
  return ctx;
}
