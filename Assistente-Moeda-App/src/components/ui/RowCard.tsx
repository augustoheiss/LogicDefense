/**
 * RowCard Component — Assistente Moeda
 *
 * Displays a single financial entry as a swipeable card.
 * Shows: date, description, value (color-coded by entry type), badge.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { Badge } from './Badge';
import { formatCurrencySmart } from '@/core/formatCurrency';
import type { TableRow } from '@/core/types';

interface RowCardProps {
  row: TableRow;
  onPress?: () => void;
  onDelete?: () => void;
}

const entryTypeLabels: Record<string, string> = {
  revenue: 'Receita',
  deposit: 'Depósito',
  waiver: 'Abono',
  expense: 'Despesa',
  partner_in: 'Sócio ↓',
  partner_out: 'Sócio ↑',
};

const entryTypeColors: Record<string, string> = {
  revenue: colors.entryType.revenue,
  deposit: colors.entryType.deposit,
  waiver: colors.entryType.waiver,
  expense: colors.entryType.expense,
  partner_in: colors.entryType.partner_in,
  partner_out: colors.entryType.partner_out,
};

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

export function RowCard({ row, onPress, onDelete }: RowCardProps) {
  const entryType = row.entryType || 'revenue';
  const valueColor = entryTypeColors[entryType] ?? colors.text.primary;
  const isGenerated = !!row.generatedBy;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        isGenerated && styles.generated,
      ]}
      onPress={onPress}
      onLongPress={onDelete}
    >
      {/* Left accent */}
      <View style={[styles.accent, { backgroundColor: valueColor }]} />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.leftCol}>
            <Text style={styles.date}>{formatDateBR(row.date)}</Text>
            <Text style={styles.description} numberOfLines={1}>
              {row.description || 'Sem descrição'}
            </Text>
            {row.entryType === 'expense' && row.monthlyValue && row.monthCount && (
              <Text style={styles.expenseDetail}>
                Mensal: {formatCurrencySmart(row.monthlyValue)} × {row.monthCount}m
              </Text>
            )}
          </View>
          <View style={styles.rightCol}>
            <Text style={[styles.value, { color: valueColor }]}>
              {entryType === 'expense' ? '-' : ''}
              {formatCurrencySmart(row.value)}
            </Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Badge
            label={entryTypeLabels[entryType] ?? entryType}
            variant={entryType as any}
          />
          {row.periodStart && row.periodEnd && (
            <Text style={styles.period}>
              {formatDateBR(row.periodStart)} → {formatDateBR(row.periodEnd)}
            </Text>
          )}
          {isGenerated && (
            <Text style={styles.generatedLabel}>
              {row.generatedBy === 'cloned' ? '📋 Clone' : '🔮 Previsão'}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
  },
  generated: {
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  accent: {
    width: 3,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftCol: {
    flex: 1,
    gap: 2,
    marginRight: spacing.sm,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  date: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  expenseDetail: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  period: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  generatedLabel: {
    fontSize: 10,
    color: colors.text.disabled,
  },
});
