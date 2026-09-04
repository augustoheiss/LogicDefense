/**
 * Badge Component — Assistente Moeda
 *
 * Small label chips for entry types, status indicators, etc.
 */

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

export type BadgeVariant =
  | 'revenue'
  | 'deposit'
  | 'waiver'
  | 'expense'
  | 'partner_in'
  | 'partner_out'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | string;

interface BadgeProps {
  label?: string | null;
  variant?: BadgeVariant;
}

const badgeConfig: Record<string, { bg: string; text: string }> = {
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

  // Portuguese & semantic aliases
  receita:     { bg: colors.success.light,  text: colors.success.main },
  renda:       { bg: colors.success.light,  text: colors.success.main },
  despesa:     { bg: colors.danger.light,   text: colors.danger.main },
  custo:       { bg: colors.danger.light,   text: colors.danger.main },
  custos:      { bg: colors.danger.light,   text: colors.danger.main },
  gasto:       { bg: colors.danger.light,   text: colors.danger.main },
  gastos:      { bg: colors.danger.light,   text: colors.danger.main },
  deposito:    { bg: colors.info.light,     text: colors.info.main },
  abono:       { bg: colors.warning.light,  text: colors.warning.main },
  socio_in:    { bg: 'rgba(6, 182, 212, 0.15)',  text: '#06b6d4' },
  socio_out:   { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  diversos:    { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
  estrutural:  { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' },
};

const DEFAULT_CONFIG = {
  bg: colors.info.light || 'rgba(59, 130, 246, 0.15)',
  text: colors.info.main || '#3b82f6',
};

export function Badge({ label, variant = 'info' }: BadgeProps) {
  const key = String(variant || 'info').toLowerCase().trim();
  const config = badgeConfig[key] || DEFAULT_CONFIG;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{label || ''}</Text>
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
