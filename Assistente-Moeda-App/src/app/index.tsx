/**
 * Root Index — Assistente Moeda
 *
 * The routing gate. Decides where to send the user on app launch:
 *   - Authenticated → Main app (/(app)/(tabs))
 *   - Not authenticated → Welcome screen (/(auth)/welcome)
 *
 * This ensures every new visitor sees the premium FTUE (onboarding
 * carousel → welcome gate) before they can enter the app.
 * Guest users reach the app via the "Continuar sem conta" button
 * on the welcome screen, which explicitly navigates them there.
 */

import { Redirect } from 'expo-router';
import { useAuthContext } from '@/hooks/useAuth';

export default function RootIndex() {
  const auth = useAuthContext();

  if (auth.user) {
    // Authenticated user → straight to the main app
    return <Redirect href="/(app)/(tabs)" />;
  }

  // Not authenticated → FTUE welcome gate
  return <Redirect href="/(auth)/welcome" />;
}
