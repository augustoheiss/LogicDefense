/**
 * Root Layout — Sekundo
 *
 * Configures the top-level Expo Router Stack, dark theme styling,
 * status bar, and splash screen lifecycle.
 *
 * Sekundo is 100% Local-First and serverless (no database/auth context wrapping required).
 */

import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';

// Prevent auto-hiding splash screen initially on native
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
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
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#12151C' }, // Immersive dark background
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
