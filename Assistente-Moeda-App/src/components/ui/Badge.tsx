/**
 * Badge Component — Assistente Moeda
 *
 * Small label chips for entry types, status indicators, etc.
 */

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

type BadgeVariant = 'revenue' | 'deposit' | 'waiver' | 'expense' | 'partner_in' | 'partner_out' | 'info' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const badgeConfig: Record<BadgeVariant, { bg: string; text: string }> = {
  revenue:     { bg: colors.success.light,  text: colors.success.main },
  deposit:     { bg: colors.info.light,     text: colors.info.main },
  waiver:      { bg: colors.warning.light,  text: colors.warning.main },
  expense:     { bg: colors.danger.light,   text: colors.danger.main },
  partner_in:  { bg: 'rgba(6, 182, 212, 0.15)',  text: '#06b6d4' },
  partner_out: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  info:        { bg: colors.info.light,     text: colors.info.main },
  success:     { bg: colors.success.light,  text: colors.success.main },
  warning:     { bg: colors.warning.light,  text: colors.warning.main },
  danger:      { bg: colors.danger.light,   text: colors.danger.main },
};

export function Badge({ label, variant = 'info' }: BadgeProps) {
  const config = badgeConfig[variant];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
