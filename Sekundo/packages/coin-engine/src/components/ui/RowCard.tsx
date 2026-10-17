/**
 * RowCard Component — Assistente Moeda
 *
 * Displays a single financial entry as a card with strict cumulative sector visibility.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import { Badge } from './Badge';
import { formatCurrencySmart } from '@coin/core/formatCurrency';
import type { TableRow } from '@coin/core/types';
import { useSectorRegistry } from '@coin/hooks/useSectorRegistry';

interface RowCardProps {
  row: TableRow;
  runningBalance?: number;
  onPress?: () => void;
  onDelete?: () => void;
  onResolveQuarantine?: (rowId: string, resolvedType: TableRow['entryType']) => void;
}

const entryTypeLabels: Record<string, string> = {
  revenue: 'Receita',
  deposit: 'Depósito',
  waiver: 'Abono',
  expense: 'Despesa',
  partner_in: 'Sócio ↓',
  partner_out: 'Sócio ↑',
  unresolved: '⚠️ Quarentena',
  receita: 'Receita',
  despesa: 'Despesa',
  custo: 'Despesa',
  custos: 'Despesa',
  gasto: 'Despesa',
  gastos: 'Despesa',
  deposito: 'Depósito',
  abono: 'Abono',
};

const entryTypeColors: Record<string, string> = {
  revenue: colors.entryType.revenue,
  deposit: colors.entryType.deposit,
  waiver: colors.entryType.waiver,
  expense: colors.entryType.expense,
  partner_in: colors.entryType.partner_in,
  partner_out: colors.entryType.partner_out,
  unresolved: '#F59E0B',
  receita: colors.entryType.revenue,
  despesa: colors.entryType.expense,
  custo: colors.entryType.expense,
  custos: colors.entryType.expense,
  gasto: colors.entryType.expense,
  gastos: colors.entryType.expense,
  deposito: colors.entryType.deposit,
  abono: colors.entryType.waiver,
};

function normalizeEntryType(type?: string): 'revenue' | 'expense' | 'deposit' | 'waiver' | 'partner_in' | 'partner_out' | 'unresolved' {
  if (!type) return 'revenue';
  const t = String(type).toLowerCase().trim();
  if (t === 'unresolved' || t === 'quarentena') return 'unresolved';
  if (t === 'receita' || t === 'renda' || t === 'revenue') return 'revenue';
  if (t === 'despesa' || t === 'gasto' || t === 'gastos' || t === 'custo' || t === 'custos' || t === 'expense') return 'expense';
  if (t === 'deposito' || t === 'deposit') return 'deposit';
  if (t === 'abono' || t === 'waiver') return 'waiver';
  if (t === 'partner_in' || t === 'socio_in' || t === 'socio ↓') return 'partner_in';
  if (t === 'partner_out' || t === 'socio_out' || t === 'socio ↑') return 'partner_out';
  return 'revenue';
}

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

export function RowCard({ row, runningBalance, onPress, onDelete, onResolveQuarantine }: RowCardProps) {
  const { isSectorActive } = useSectorRegistry();

  if (!row) return null;

  const normalizedType = normalizeEntryType(row.entryType);
  const rawType = row.entryType || normalizedType;
  const entryType = normalizedType;
  const valueColor = (row.entryType && entryTypeColors[row.entryType]) || entryTypeColors[normalizedType] || colors.text.primary;
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

  const customEntries = row.customValues
    ? Object.entries(row.customValues).filter(([, v]) => v !== undefined && v !== null && v !== '')
    : [];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        isGenerated && styles.generated,
        entryType === 'unresolved' && styles.quarantineCard,
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
            {showCosts && entryType === 'expense' && row.monthlyValue && row.monthCount && (
              <Text style={styles.expenseDetail}>
                Mensal: {formatCurrencySmart(row.monthlyValue)} × {row.monthCount}m
              </Text>
            )}

            {/* Investment Ticker Detail */}
            {row.ticker && (
              <Text style={styles.metaPill}>
                📈 {row.ticker}
                {row.quantity != null ? ` (${row.quantity}${row.unitPrice != null ? ` × ${formatCurrencySmart(row.unitPrice)}` : ''})` : ''}
              </Text>
            )}

            {/* Dynamic Custom Columns Detail */}
            {customEntries.length > 0 && (
              <Text style={styles.customFieldsPill} numberOfLines={1}>
                {customEntries.map(([k, v]) => `${k}: ${v}`).join(' • ')}
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
              {formatCurrencySmart(Math.abs(row.value))}
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
          {(showRevenue || showCosts || entryType === 'unresolved' || isSectorActive('personal_finance')) && (
            <Badge
              label={entryTypeLabels[rawType] ?? entryTypeLabels[entryType] ?? rawType}
              variant={entryType}
            />
          )}
          {row.category && (showRevenue || showCosts || entryType === 'unresolved' || isSectorActive('personal_finance')) && (
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

        {/* Inline Quarantine Resolution Bar */}
        {entryType === 'unresolved' && onResolveQuarantine && (
          <View style={styles.quarantineBar}>
            <Text style={styles.quarantineHint}>Classificar em 1 toque:</Text>
            <View style={styles.quarantineBtns}>
              <Pressable
                style={[styles.quarantineBtn, styles.quarantineBtnRev]}
                onPress={() => onResolveQuarantine(row.id, 'revenue')}
              >
                <Text style={styles.quarantineBtnRevText}>+ Receita</Text>
              </Pressable>
              <Pressable
                style={[styles.quarantineBtn, styles.quarantineBtnExp]}
                onPress={() => onResolveQuarantine(row.id, 'expense')}
              >
                <Text style={styles.quarantineBtnExpText}>- Gasto</Text>
              </Pressable>
              <Pressable
                style={[styles.quarantineBtn, styles.quarantineBtnDep]}
                onPress={() => onResolveQuarantine(row.id, 'deposit')}
              >
                <Text style={styles.quarantineBtnDepText}>🏦 Aporte</Text>
              </Pressable>
            </View>
          </View>
        )}
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
  quarantineCard: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
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
  customFieldsPill: {
    fontSize: 10,
    color: colors.text.secondary,
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
  quarantineBar: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quarantineHint: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  quarantineBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  quarantineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  quarantineBtnRev: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  quarantineBtnRevText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success.main,
  },
  quarantineBtnExp: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  quarantineBtnExpText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger.main,
  },
  quarantineBtnDep: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  quarantineBtnDepText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.info.main,
  },
});
