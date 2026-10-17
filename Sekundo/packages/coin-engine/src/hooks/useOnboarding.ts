/**
 * useOnboarding — First-time user experience persistence
 *
 * Reads a flag from AsyncStorage to decide whether the onboarding
 * carousel should be shown. Once the user completes or skips
 * onboarding, the flag is persisted and the carousel never shows again.
 *
 * Usage:
 *   const { hasSeenOnboarding, isLoading, completeOnboarding } = useOnboarding();
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@assistente_moeda:onboarding_complete';

export interface OnboardingState {
  /** Whether the user has already seen the onboarding carousel */
  hasSeenOnboarding: boolean;
  /** Whether the initial AsyncStorage read is in progress */
  isLoading: boolean;
  /** Mark onboarding as complete (persists to AsyncStorage) */
  completeOnboarding: () => Promise<void>;
}

export function useOnboarding(): OnboardingState {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        setHasSeenOnboarding(value === 'true');
      } catch {
        // If read fails, default to showing onboarding
        setHasSeenOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    }
    check();
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Best-effort persistence — silently ignore write failures
    }
    setHasSeenOnboarding(true);
  }, []);

  return { hasSeenOnboarding, isLoading, completeOnboarding };
}
