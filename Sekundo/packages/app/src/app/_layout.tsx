/**
 * Root Layout — Sekundo
 *
 * Configures the top-level Expo Router Stack, dark theme styling,
 * status bar, and splash screen lifecycle.
 *
 * Sekundo is 100% Local-First and serverless (no database/auth context wrapping required).
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { CosmicBackground } from '../components/ui/CosmicBackground';

// Prevent auto-hiding splash screen initially on native
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Sekundo — Recuperação do Sistema</Text>
          <Text style={styles.errorMessage}>{this.state.error.message}</Text>
          <Pressable
            onPress={() => {
              this.setState({ error: null });
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Recarregar Aplicação</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  // Hide splash screen on mount on native
  useEffect(() => {
    if (Platform.OS !== 'web') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  // Configure Android system navigation bar for fullscreen immersive feel
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      const navBarAny = NavigationBar as any;
      if (typeof navBarAny.setBehaviorAsync === 'function') {
        navBarAny.setBehaviorAsync('sticky-immersive');
      }
    }
  }, []);

  return (
    <RootErrorBoundary>
      <View style={styles.rootWrapper}>
        <StatusBar style="light" />
        <CosmicBackground />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' }, // Allows CosmicBackground to shine through!
          }}
        >
          <Stack.Screen name="index" />
        </Stack>
      </View>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    height: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    overflow: 'hidden',
    backgroundColor: '#0C0E15',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#07090E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#FFB800',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FFB800',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#07090E',
    fontWeight: '700',
    fontSize: 14,
  },
});
