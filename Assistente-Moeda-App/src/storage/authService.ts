/**
 * Auth Service — Assistente Moeda
 *
 * Wraps Supabase Auth with a clean API for:
 *   - Email/password registration and login
 *   - Google OAuth (deferred to Phase 2)
 *   - Guest mode (no auth, local-only)
 *   - Session management and token refresh
 *
 * The freemium tier is stored in the `profiles` table:
 *   - 'free'    → Guest mode, local storage only
 *   - 'premium' → Cloud sync + AI Analyst access
 */

import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export type PremiumTier = 'free' | 'premium';

export interface UserProfile {
  id: string;
  displayName: string | null;
  email: string | null;
  syncEnabled: boolean;
  premiumTier: PremiumTier;
  subscriptionExpiresAt: string | null;
  subscriptionType?: string | null;
}

// ── Auth Functions ───────────────────────────────────────────────────────────

/**
 * Register a new user with email and password.
 * Automatically creates a profile row via Supabase trigger or manual insert.
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName ?? email.split('@')[0] },
    },
  });

  if (error) return { user: null, error: error.message };

  // Create profile row (RLS allows insert for authenticated users)
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      display_name: displayName ?? email.split('@')[0],
      sync_enabled: true,
      premium_tier: 'free',
    });
  }

  return { user: data.user, error: null };
}

/**
 * Sign in with email and password.
 */
export async function signIn(
  email: string,
  password: string,
): Promise<{ session: Session | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { session: null, error: error.message };
  return { session: data.session, error: null };
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Get the current session (returns null if not logged in).
 */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Get the current user (returns null if not logged in).
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Fetch the user's profile from the `profiles` table.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await getCurrentUser();
  const email = user?.email ?? null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, sync_enabled, premium_tier, subscription_expires_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          email: email || 'user@moeda.app',
          active_sectors: ['personal_finance'],
          sync_enabled: true,
          premium_tier: 'free',
        });
      } catch {
        // ignore auto-creation error
      }

      return {
        id: userId,
        displayName: email ? email.split('@')[0] : 'Usuário',
        email,
        syncEnabled: true,
        premiumTier: 'free',
        subscriptionExpiresAt: null,
        subscriptionType: null,
      };
    }

    let subscriptionType: string | null = null;
    try {
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('subscription_type')
        .eq('id', userId)
        .maybeSingle();
      subscriptionType = settingsData?.subscription_type ?? null;
    } catch {
      // Ignore user_settings errors
    }

    return {
      id: data.id,
      displayName: data.display_name ?? (email ? email.split('@')[0] : 'Usuário'),
      email,
      syncEnabled: data.sync_enabled ?? true,
      premiumTier: (data.premium_tier as PremiumTier) ?? 'free',
      subscriptionExpiresAt: data.subscription_expires_at ?? null,
      subscriptionType,
    };
  } catch (err) {
    console.warn('getUserProfile fallback triggered:', err);
    return {
      id: userId,
      displayName: email ? email.split('@')[0] : 'Usuário',
      email,
      syncEnabled: true,
      premiumTier: 'free',
      subscriptionExpiresAt: null,
      subscriptionType: null,
    };
  }
}

/**
 * Update sync preference in the profile.
 */
export async function setSyncEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await supabase
    .from('profiles')
    .update({ sync_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

/**
 * Listen for auth state changes (login, logout, token refresh).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
