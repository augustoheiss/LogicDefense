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

import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthContext } from '@coin/hooks/useAuth';
import { useOnboarding } from '@coin/hooks/useOnboarding';
import { colors } from '@coin/theme/colors';

export default function RootIndex() {
  const auth = useAuthContext();
  const { hasSeenOnboarding, isLoading } = useOnboarding();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent.purple} />
      </View>
    );
  }

  if (!hasSeenOnboarding) {
    return <Redirect href="/coin/login" />;
  }

  if (auth.user) {
    // Authenticated or local-first user who completed onboarding → straight to the main app
    return <Redirect href="/coin" />;
  }

  // Not authenticated → FTUE welcome gate
  return <Redirect href="/coin/login" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
});
