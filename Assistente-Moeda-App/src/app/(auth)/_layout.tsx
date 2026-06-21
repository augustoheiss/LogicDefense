/**
 * Auth Group Layout — Assistente Moeda
 *
 * Stack navigator for the authentication flow:
 *   - welcome  → Choose Guest or Sign In
 *   - login    → Email/password login
 *   - register → Create account
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
