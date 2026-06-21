/**
 * Card Component — Assistente Moeda
 *
 * Versatile card container with variants:
 *   - default: standard elevated card
 *   - outlined: bordered with no elevation
 *   - accent: purple accent border
 *   - success/warning/danger: semantic colored border
 */

import { View, StyleSheet, type ViewStyle, type ViewProps } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';

export type CardVariant = 'default' | 'outlined' | 'accent' | 'success' | 'warning' | 'danger';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: keyof typeof spacing;
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

export function Card({
  variant = 'default',
  padding = 'lg',
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        { padding: spacing[padding], borderColor: borderColors[variant] },
        variant === 'default' && shadows.sm,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
