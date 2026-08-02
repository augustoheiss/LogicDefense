/**
 * TokenProgressBar — Animated, gradient-filled, accessible progress bar
 *
 * Features:
 *   - Smooth animated width via react-native-reanimated (withTiming)
 *   - Adaptive gradient that shifts color based on fill level:
 *       > 50%  → emerald (#10b981) → teal (#06b6d4)
 *       20–50% → orange (#f59e0b) → amber (#f97316)
 *       < 20%  → red (#ef4444) → orange (#f97316)
 *   - Full a11y: progressbar role, min/max/now values, descriptive label
 *   - React.memo for render optimization
 *   - Platform-aware track styling (iOS shadow, Android fallback)
 */

import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/spacing';

// ── Constants ────────────────────────────────────────────────────────────────

const BAR_HEIGHT = 12;
const ANIMATION_DURATION_MS = 600;

const GRADIENT_HIGH:   [string, string] = ['#10b981', '#06b6d4']; // emerald → teal
const GRADIENT_MEDIUM: [string, string] = ['#f59e0b', '#f97316']; // amber → orange
const GRADIENT_LOW:    [string, string] = ['#ef4444', '#f97316']; // red → orange

// ── Props ────────────────────────────────────────────────────────────────────

interface TokenProgressBarProps {
  /** Current token balance */
  current: number;
  /** Maximum token capacity */
  max: number;
}

// ── Component ────────────────────────────────────────────────────────────────

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

function TokenProgressBarInner({ current, max }: TokenProgressBarProps) {
  const isGodMode = max === -1 || current >= 999_000_000;

  // ── Derived values ──────────────────────────────────────────────────────
  const percentage = useMemo(
    () => (isGodMode ? 100 : Math.max(0, Math.min(100, (current / Math.max(max, 1)) * 100))),
    [current, max, isGodMode],
  );

  const gradientColors = useMemo<[string, string]>(() => {
    if (isGodMode) return GRADIENT_HIGH;
    const ratio = current / Math.max(max, 1);
    if (ratio <= 0.2) return GRADIENT_LOW;
    if (ratio <= 0.5) return GRADIENT_MEDIUM;
    return GRADIENT_HIGH;
  }, [current, max, isGodMode]);

  // ── Animated fill width ────────────────────────────────────────────────
  const animatedWidth = useSharedValue(percentage);

  useEffect(() => {
    animatedWidth.value = withTiming(percentage, {
      duration: ANIMATION_DURATION_MS,
      easing: Easing.bezierFn(0.25, 0.1, 0.25, 1), // ease-out cubic
    });
  }, [percentage, animatedWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%` as `${number}%`,
  }));

  // ── Accessibility ──────────────────────────────────────────────────────
  const a11yLabel = useMemo(() => {
    if (isGodMode) return 'Saldo de tokens: Ilimitado (God Mode)';
    const formattedCurrent = current.toLocaleString('pt-BR');
    const formattedMax = max.toLocaleString('pt-BR');
    const pct = Math.round(percentage);
    return `Saldo de tokens: ${formattedCurrent} de ${formattedMax}, ${pct}% restante`;
  }, [current, max, percentage, isGodMode]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={a11yLabel}
      accessibilityValue={{ min: 0, max, now: current }}
    >
      <Animated.View style={[styles.fillWrapper, fillStyle]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
}

export const TokenProgressBar = React.memo(TokenProgressBarInner);

// ── Styles ───────────────────────────────────────────────────────────────────

const trackShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  } as const,
  android: {} as const,
  default: {} as const,
});

const styles = StyleSheet.create({
  track: {
    height: BAR_HEIGHT,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
    ...trackShadow,
  },
  fillWrapper: {
    height: '100%',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    borderRadius: radius.full,
  },
});
