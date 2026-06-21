/**
 * Root Index — Assistente Moeda
 *
 * Redirects to the welcome screen on first launch,
 * or to the app tabs if already authenticated.
 */

import { Redirect } from 'expo-router';
import { useAuthContext } from '@/hooks/useAuth';

export default function RootIndex() {
  const auth = useAuthContext();

  if (auth.mode === 'authenticated') {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
