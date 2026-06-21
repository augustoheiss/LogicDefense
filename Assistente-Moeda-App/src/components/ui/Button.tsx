/**
 * Button Component — Assistente Moeda
 *
 * Variants: primary, secondary, ghost, danger
 * Sizes: sm, md, lg
 * Supports loading state with ActivityIndicator.
 */

import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  icon?: string; // emoji icon
}

const bgColors: Record<ButtonVariant, string> = {
  primary: colors.accent.purple,
  secondary: 'transparent',
  ghost: 'transparent',
  danger: colors.danger.main,
};

const textColors: Record<ButtonVariant, string> = {
  primary: '#fff',
  secondary: colors.accent.purple,
  ghost: colors.text.secondary,
  danger: '#fff',
};

const borderStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {},
  secondary: { borderWidth: 1, borderColor: colors.accent.purpleBorder },
  ghost: {},
  danger: {},
};

const sizes: Record<ButtonSize, { paddingV: number; paddingH: number; fontSize: number }> = {
  sm: { paddingV: spacing.xs, paddingH: spacing.md, fontSize: 13 },
  md: { paddingV: spacing.sm, paddingH: spacing.lg, fontSize: 14 },
  lg: { paddingV: spacing.md, paddingH: spacing.xxl, fontSize: 16 },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  icon,
}: ButtonProps) {
  const sizeConfig = sizes[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bgColors[variant],
          paddingVertical: sizeConfig.paddingV,
          paddingHorizontal: sizeConfig.paddingH,
        },
        borderStyles[variant],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColors[variant]} />
      ) : (
        <Text
          style={[
            styles.text,
            { color: textColors[variant], fontSize: sizeConfig.fontSize },
          ]}
        >
          {icon ? `${icon} ${title}` : title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  text: {
    fontWeight: '600',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
});
