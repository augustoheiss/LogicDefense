/**
 * RowCard Component — Assistente Moeda
 *
 * Displays a single financial entry as a card with strict cumulative sector visibility.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { Badge } from './Badge';
import { formatCurrencySmart } from '@/core/formatCurrency';
import type { TableRow } from '@/core/types';
import { useSectorRegistry } from '@/hooks/useSectorRegistry';

interface RowCardProps {
  row: TableRow;
  runningBalance?: number;
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

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '--/--';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return dateStr;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [, m, d] = parts;
    return `${d}/${m}`;
  }
  return dateStr;
}

export function RowCard({ row, runningBalance, onPress, onDelete }: RowCardProps) {
  const { isSectorActive } = useSectorRegistry();

  if (!row) return null;

  const entryType = row.entryType || 'revenue';
  const valueColor = entryTypeColors[entryType] ?? colors.text.primary;
  const isGenerated = !!row.generatedBy;

  // Strict Sector & Core Module Guards
  const showCashflow = isSectorActive('core_cashflow');
  const showRevenue = isSectorActive('core_revenue') && (entryType === 'revenue' || entryType === 'partner_in' || entryType === 'deposit');
  const showCosts = isSectorActive('core_costs') && (entryType === 'expense' || entryType === 'partner_out');
  const showVehicles = isSectorActive('vehicles');
  const showRealEstate = isSectorActive('real_estate');
  const showLegalTaxes = isSectorActive('legal_taxes');
  const showSMB = isSectorActive('smb_accounting');

  let metaObj: any = null;
  if (row.metadataJson) {
    try {
      metaObj = typeof row.metadataJson === 'object' ? row.metadataJson : JSON.parse(row.metadataJson);
    } catch {
      metaObj = null;
    }
  }

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

            {/* Costs Detail */}
            {showCosts && row.entryType === 'expense' && row.monthlyValue && row.monthCount && (
              <Text style={styles.expenseDetail}>
                Mensal: {formatCurrencySmart(row.monthlyValue)} × {row.monthCount}m
              </Text>
            )}

            {/* Sector Specific Metadata Pills */}
            {showVehicles && metaObj?.perfil_msrp && (
              <Text style={styles.metaPill}>🚗 TCO MSRP: {formatCurrencySmart(metaObj.perfil_msrp)}</Text>
            )}
            {showRealEstate && metaObj?.property_value && (
              <Text style={styles.metaPill}>🏠 Valor Imóvel: {formatCurrencySmart(metaObj.property_value)}</Text>
            )}
            {showLegalTaxes && metaObj?.data_ajuizamento && (
              <Text style={styles.metaPill}>⚖️ Ajuizamento: {metaObj.data_ajuizamento}</Text>
            )}
            {showSMB && metaObj?.receita_bruta_12 && (
              <Text style={styles.metaPill}>🏢 RBT12: {formatCurrencySmart(metaObj.receita_bruta_12)}</Text>
            )}
          </View>

          <View style={styles.rightCol}>
            <Text style={[styles.value, { color: valueColor }]}>
              {entryType === 'expense' ? '-' : ''}
              {formatCurrencySmart(row.value)}
            </Text>
            {showCashflow && runningBalance !== undefined && (
              <Text style={styles.runningBalanceText}>
                Saldo: {formatCurrencySmart(runningBalance)}
              </Text>
            )}
          </View>
        </View>

        {/* Bottom Row */}
        <View style={styles.bottomRow}>
          {(showRevenue || showCosts || isSectorActive('personal_finance')) && (
            <Badge
              label={entryTypeLabels[entryType] ?? entryType}
              variant={entryType as any}
            />
          )}
          {row.category && (showRevenue || showCosts || isSectorActive('personal_finance')) && (
            <Text style={styles.categoryTag}>• {row.category}</Text>
          )}
          {row.tags && (
            <Text style={styles.tagsText}>[{row.tags}]</Text>
          )}
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
  metaPill: {
    fontSize: 10,
    color: colors.accent.purple,
    fontWeight: '600',
    marginTop: 2,
  },
  runningBalanceText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
    marginTop: 2,
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
  categoryTag: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  tagsText: {
    fontSize: 10,
    color: colors.accent.purple,
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
