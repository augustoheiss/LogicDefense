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
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { CoinDBProvider } from '@/hooks/useCoinDB';
import { SubscriptionProvider } from '@/hooks/useSubscription';
import { colors } from '@/theme/colors';

// Prevent auto-hide so we control it
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const auth = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Android: hide system navigation bar for true fullscreen immersive mode
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      
      // setBehaviorAsync was removed in newer versions of expo-navigation-bar (SDK 56+)
      // because hiding the bar automatically defaults to 'sticky-immersive' behavior.
      // We check for its existence dynamically to satisfy the requirement safely.
      const navBarAny = NavigationBar as any;
      if (typeof navBarAny.setBehaviorAsync === 'function') {
        navBarAny.setBehaviorAsync('sticky-immersive');
      }
    }
  }, []);

  useEffect(() => {
    if (!auth.isLoading) {
      SplashScreen.hideAsync();
    }
  }, [auth.isLoading]);

  useEffect(() => {
    if (auth.isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    const currentPath = segments.join('/');
    const isExplicitAuthPage = currentPath.includes('login') || currentPath.includes('register');

    if (auth.user && inAuthGroup && !isExplicitAuthPage) {
      // Authenticated user lingering in auth flow → send to main app
      router.replace('/(app)/(tabs)');
    } else if (!auth.user && inAppGroup && auth.mode !== 'guest') {
      // Unauthenticated non-guest in the app group (e.g. deep link) → gate via welcome
      router.replace('/(auth)/welcome');
    }
  }, [auth.user, auth.mode, auth.isLoading, segments]);

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
