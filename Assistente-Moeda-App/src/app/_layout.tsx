/**
 * Root Layout — Assistente Moeda
 *
 * Top-level layout that wraps the entire app with:
 *   1. Auth context provider (guest vs. authenticated state)
 *   2. Dark theme enforcement
 *   3. Status bar configuration
 *   4. Font loading (if needed in the future)
 *
 * Routes:
 *   /(auth)  → Welcome, Login, Register screens
 *   /(app)   → Main app with bottom tabs (protected)
 */

import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { CoinDBProvider } from '@/hooks/useCoinDB';
import { SubscriptionProvider } from '@/hooks/useSubscription';
import { colors } from '@/theme/colors';

// Prevent auto-hide so we control it
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading) {
      SplashScreen.hideAsync();
    }
  }, [auth.isLoading]);

  if (auth.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent.purple} />
      </View>
    );
  }

  return (
    <AuthProvider value={auth}>
      <SubscriptionProvider>
        <CoinDBProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background.primary },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </CoinDBProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  return <RootNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
});
