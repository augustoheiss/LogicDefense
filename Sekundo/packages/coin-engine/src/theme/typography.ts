/**
 * Typography Scale — Assistente Moeda Design System
 *
 * Uses system fonts on mobile (San Francisco / Roboto) for native feel.
 * Expo SDK 56 uses the default system font; custom fonts can be added via expo-font.
 */

import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: 'System',
});

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  web: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace',
  default: 'monospace',
});

type TypographyVariant = {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  letterSpacing?: number;
};

export const typography: Record<string, TypographyVariant> = {
  // ── Display ──────────────────────────────────────────────
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },

  // ── Body ─────────────────────────────────────────────────
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },

  // ── Labels ───────────────────────────────────────────────
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  labelSmall: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // ── Metric values ────────────────────────────────────────
  metric: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricSmall: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },

  // ── Caption ──────────────────────────────────────────────
  caption: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '400',
  },
} as const;

export { fontFamily, monoFamily };
