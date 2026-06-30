/**
 * Card Component — Assistente Moeda
 *
 * Versatile card container with variants:
 *   - default: standard elevated card
 *   - outlined: bordered with no elevation
 *   - accent: purple accent border
 *   - success/warning/danger: semantic colored border
 *
 * Optional `glow` prop adds a subtle accent-purple tinted shadow
 * for premium subscription / CTA cards.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, type ViewStyle, type ViewProps } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';

export type CardVariant = 'default' | 'outlined' | 'accent' | 'success' | 'warning' | 'danger';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: keyof typeof spacing;
  /** Adds a subtle accent-purple glow shadow for premium / CTA cards */
  glow?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

const borderColors: Record<CardVariant, string> = {
  default: colors.border.default,
  outlined: colors.border.strong,
  accent: colors.accent.purpleBorder,
  success: colors.success.border,
  warning: colors.warning.border,
  danger: colors.danger.border,
};

/** Platform-aware accent glow shadow */
const glowShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.accent.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  android: {
    elevation: 6,
  },
  default: {
    shadowColor: colors.accent.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
}) as ViewStyle;

function CardInner({
  variant = 'default',
  padding = 'lg',
  glow = false,
  style,
  children,
  ...rest
}: CardProps) {
  const composedStyle = useMemo<ViewStyle[]>(() => {
    const result: ViewStyle[] = [
      styles.base,
      { padding: spacing[padding], borderColor: borderColors[variant] },
    ];

    // Default cards get medium shadow; glow overrides with accent tint
    if (glow) {
      result.push(glowShadow);
    } else if (variant === 'default') {
      result.push(shadows.md as ViewStyle);
    }

    if (style) result.push(style);
    return result;
  }, [variant, padding, glow, style]);

  return (
    <View style={composedStyle} {...rest}>
      {children}
    </View>
  );
}

export const Card = React.memo(CardInner);

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
