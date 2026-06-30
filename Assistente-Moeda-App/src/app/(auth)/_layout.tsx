/**
 * Auth Group Layout — Assistente Moeda
 *
 * Stack navigator for the authentication flow:
 *   - welcome  → Onboarding carousel (first launch) + choose Guest or Sign In
 *   - login    → Email/password login
 *   - register → Create account
 *
 * Uses `fade_from_bottom` transitions for a premium cinematic feel.
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'fade_from_bottom',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
