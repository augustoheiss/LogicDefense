/**
 * Investor Portfolio & Smart Rebalancer Widget — Assistente Moeda
 *
 * Modern financial health widget featuring:
 *   1. Persona selector (Safety, Income, Balanced, Aggressive, SMB Hybrid).
 *   2. Asset allocation visualization (Real vs Target Delta).
 *   3. Emergency Fund runway & FIRE target gauge.
 *   4. Pure cash-in smart rebalancer with zero forced sales.
 *   5. 1-click contribution batch commit into the database.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrencySmart } from '@/core/formatCurrency';
import {
  computeInvestorMetrics,
  DEFAULT_PROFILE_CONFIGS,
} from '@/core/investorMetricsEngine';
import { calculateSmartRebalance } from '@/core/smartRebalancer';
import type {
  TableRow,
  InvestorProfileType,
  InvestorProfileConfig,
  AssetClass,
  TableGoals,
} from '@/core/types';

interface InvestorPortfolioWidgetProps {
  rows: TableRow[];
  activeProfile?: InvestorProfileConfig;
  annualCost?: number;
  monthlyExpenses?: number;
  onUpdateProfile: (profile: InvestorProfileConfig) => void;
  onAddRows?: (newRows: Omit<TableRow, 'id'>[]) => Promise<void>;
}

const PERSONA_LABELS: Record<InvestorProfileType, { label: string; icon: string; desc: string }> = {
  safety: {
    label: 'Conservador / Reserva',
    icon: '🛡️',
    desc: '50% Caixa/Reserva, 40% Renda Fixa IPCA, 10% FIIs. Foco em proteção máxima.',
  },
  income: {
    label: 'Renda Passiva',
    icon: '💵',
    desc: '45% FIIs, 30% IPCA, 15% Ações Dividendo, 10% Caixa. Foco em fluxo mensal.',
  },
  balanced: {
    label: 'Balanceado / Macro',
    icon: '⚖️',
    desc: '30% IPCA, 25% Ações BR, 20% FIIs, 15% Global, 10% Caixa. Diversificação clássica.',
  },
  aggressive: {
    label: 'Crescimento Agressivo',
    icon: '🚀',
    desc: '35% Global, 25% Ações BR, 15% Cripto, 15% FIIs, 10% Caixa. Foco em multiplicação.',
  },
  smb_hybrid: {
    label: 'Híbrido PME / Capital',
    icon: '🏢',
    desc: '40% Capital de Giro PME, 25% Reserva, 20% IPCA, 15% FIIs. Blindagem empresarial.',
  },
};

const ASSET_CLASS_LABELS: Record<AssetClass, { label: string; color: string }> = {
  cash_reserves: { label: 'Reserva de Emergência / CDI', color: '#10b981' },
  fixed_income_ipca: { label: 'Tesouro IPCA+ / Inflação', color: '#06b6d4' },
  real_estate_funds: { label: 'Fundos Imobiliários (FIIs)', color: '#8b5cf6' },
  equities_brazil: { label: 'Ações Brasil (B3)', color: '#3b82f6' },
  equities_global: { label: 'Ações Globais (S&P 500)', color: '#ec4899' },
  crypto: { label: 'Criptoativos (BTC/ETH)', color: '#f59e0b' },
  business_capital: { label: 'Capital de Giro SMB', color: '#6366f1' },
};

function getAssetClassMeta(assetClass: AssetClass): { label: string; color: string } {
  return ASSET_CLASS_LABELS[assetClass] || { label: 'Outros Investimentos', color: '#64748b' };
}

export function InvestorPortfolioWidget({
  rows,
  activeProfile,
  annualCost = 0,
  monthlyExpenses,
  onUpdateProfile,
  onAddRows,
}: InvestorPortfolioWidgetProps) {
  const currentProfile = activeProfile || DEFAULT_PROFILE_CONFIGS.balanced;
  const [contributionInput, setContributionInput] = useState('1000');
  const [isCommitting, setIsCommitting] = useState(false);

  const effectiveMonthlyExpenses = useMemo(() => {
    if (monthlyExpenses !== undefined && monthlyExpenses > 0) return monthlyExpenses;
    if (annualCost > 0) return Math.round((annualCost / 12) * 100) / 100;
    return 0;
  }, [monthlyExpenses, annualCost]);

  // Compute metrics dynamically
  const metrics = useMemo(() => {
    return computeInvestorMetrics(rows, currentProfile, effectiveMonthlyExpenses);
  }, [rows, currentProfile, effectiveMonthlyExpenses]);

  // Compute live smart rebalance based on input
  const parsedCash = parseFloat(contributionInput.replace(',', '.')) || 0;
  const rebalanceSuggestions = useMemo(() => {
    return calculateSmartRebalance(metrics.positions, parsedCash);
  }, [metrics.positions, parsedCash]);

  const handleSelectPersona = (type: InvestorProfileType) => {
    const config = DEFAULT_PROFILE_CONFIGS[type];
    onUpdateProfile(config);
  };

  const handleQuickAdd = (amount: number) => {
    setContributionInput(String(amount));
  };

  const handleCommitRebalance = async () => {
    if (!onAddRows || parsedCash <= 0) return;
    const itemsToBuy = rebalanceSuggestions.filter(
      (s) => s.suggestedAllocationBRL > 0
    );

    if (itemsToBuy.length === 0) {
      const msg = 'Nenhum ativo necessita de aporte no momento para este valor.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Aporte', msg);
      return;
    }

    setIsCommitting(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const newRows: Omit<TableRow, 'id'>[] = itemsToBuy.map((item) => ({
        date: todayStr,
        value: item.suggestedAllocationBRL,
        entryType: 'deposit',
        description: `APORTE INTELIGENTE: ${getAssetClassMeta(item.assetClass).label}`,
        category: 'Investimentos',
        tags: 'smart_rebalance,aporte',
        metadataJson: JSON.stringify({ assetClass: item.assetClass }),
      }));

      await onAddRows(newRows);
      const successMsg = `Sucesso! ${newRows.length} aporte(s) somando ${formatCurrencySmart(parsedCash)} foram registrados na planilha.`;
      Platform.OS === 'web' ? window.alert(successMsg) : Alert.alert('Aportes Concluídos 🎉', successMsg);
    } catch (err: any) {
      const errMsg = err.message || 'Erro ao registrar aportes.';
      Platform.OS === 'web' ? window.alert(errMsg) : Alert.alert('Erro', errMsg);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── 1. Header & Investor Persona Selector ── */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.titleIcon}>🎯</Text>
          <View>
            <Text style={styles.title}>Portfólio & Rebalanceamento Inteligente</Text>
            <Text style={styles.subtitle}>
              Perfil Ativo: {PERSONA_LABELS[currentProfile.profileType].label}
            </Text>
          </View>
        </View>

        {/* Persona Chips */}
        <View style={styles.personaRow}>
          {(['safety', 'income', 'balanced', 'aggressive', 'smb_hybrid'] as InvestorProfileType[]).map((type) => {
            const isSelected = currentProfile.profileType === type;
            const meta = PERSONA_LABELS[type];
            return (
              <Pressable
                key={type}
                style={[styles.personaChip, isSelected && styles.personaChipActive]}
                onPress={() => handleSelectPersona(type)}
              >
                <Text style={styles.personaChipIcon}>{meta.icon}</Text>
                <Text
                  style={[
                    styles.personaChipText,
                    isSelected && styles.personaChipTextActive,
                  ]}
                >
                  {type === 'safety' ? 'Conservador' : type === 'income' ? 'Renda' : type === 'balanced' ? 'Balanceado' : type === 'aggressive' ? 'Agressivo' : 'PME'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.personaDescription}>
          {PERSONA_LABELS[currentProfile.profileType].desc}
        </Text>
      </View>

      {/* ── 2. Health & Milestone Gauges ── */}
      <View style={styles.kpiGrid}>
        {/* Portfolio Health Score */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Score de Saúde</Text>
          <Text
            style={[
              styles.kpiValue,
              {
                color:
                  metrics.portfolioHealthScore >= 80
                    ? colors.success.main
                    : metrics.portfolioHealthScore >= 60
                    ? colors.info.main
                    : colors.warning.main,
              },
            ]}
          >
            {metrics.portfolioHealthScore}
            <Text style={styles.kpiUnit}>/100</Text>
          </Text>
          <Text style={styles.kpiSubtitle}>
            {metrics.portfolioHealthScore >= 80
              ? 'Excelente alocação'
              : metrics.portfolioHealthScore >= 60
              ? 'Portfólio saudável'
              : 'Subalocado / Ajustar'}
          </Text>
        </View>

        {/* Emergency Fund Runway */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Reserva de Emergência</Text>
          <Text style={[styles.kpiValue, { color: colors.info.main }]}>
            {metrics.emergencyFundMonthsAvailable.toFixed(1)}
            <Text style={styles.kpiUnit}> m</Text>
          </Text>
          <Text style={styles.kpiSubtitle}>
            Meta: {currentProfile.emergencyFundMonthsGoal || 6} meses ({metrics.emergencyFundProgressPct.toFixed(0)}%)
          </Text>
        </View>

        {/* FIRE Target */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Meta FIRE (Regra 4%)</Text>
          <Text style={[styles.kpiValue, { color: colors.accent.purple }]}>
            {metrics.fireProgressPercentage.toFixed(1)}
            <Text style={styles.kpiUnit}>%</Text>
          </Text>
          <Text style={styles.kpiSubtitle} numberOfLines={1}>
            Alvo: {formatCurrencySmart(metrics.fireNumberTarget)}
          </Text>
        </View>
      </View>

      {/* ── 3. Asset Allocation Breakdown (Real vs Meta) ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Distribuição Real vs Alvo</Text>
          <Text style={styles.portfolioTotalText}>
            Total: {formatCurrencySmart(metrics.totalNetWorth)}
          </Text>
        </View>

        {metrics.positions.map((pos) => {
          const classMeta = getAssetClassMeta(pos.assetClass);
          const isUnder = pos.deviationPercentage < 0;
          return (
            <View key={pos.assetClass} style={styles.positionRow}>
              <View style={styles.positionHeader}>
                <View style={styles.positionLabelGroup}>
                  <View style={[styles.colorDot, { backgroundColor: classMeta.color }]} />
                  <Text style={styles.positionName}>{classMeta.label}</Text>
                </View>
                <View style={styles.positionValues}>
                  <Text style={styles.positionAmount}>
                    {formatCurrencySmart(pos.currentValue)}
                  </Text>
                  <Text style={styles.positionPct}>
                    {pos.currentPercentage.toFixed(1)}% / Meta {pos.targetPercentage.toFixed(1)}%
                  </Text>
                  <Text
                    style={[
                      styles.deltaBadge,
                      {
                        color: isUnder ? colors.success.main : colors.accent.purple,
                        backgroundColor: isUnder ? 'rgba(16, 185, 129, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                      },
                    ]}
                  >
                    {isUnder ? '' : '+'}{pos.deviationPercentage.toFixed(1)}%
                  </Text>
                </View>
              </View>

              {/* Progress Bar Container */}
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, pos.currentPercentage)}%`,
                      backgroundColor: classMeta.color,
                    },
                  ]}
                />
                {/* Target vertical tick mark */}
                <View
                  style={[
                    styles.targetMarker,
                    { left: `${Math.min(100, pos.targetPercentage)}%` },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* ── 4. Pure Cash-in Smart Rebalancer ── */}
      <View style={styles.rebalancerBox}>
        <View style={styles.rebalancerHeader}>
          <Text style={styles.rebalancerTitle}>⚡ Aporte Inteligente (Sem Vendas Forçadas)</Text>
          <Text style={styles.rebalancerSubtitle}>
            Todo o valor depositado é direcionado para os ativos subalocados até reequilibrar a meta.
          </Text>
        </View>

        {/* Input & Quick Buttons */}
        <View style={styles.inputRow}>
          <Text style={styles.inputPrefix}>R$</Text>
          <TextInput
            style={styles.textInput}
            value={contributionInput}
            onChangeText={setContributionInput}
            keyboardType="numeric"
            placeholder="Valor do aporte"
            placeholderTextColor={colors.text.disabled}
          />
          <View style={styles.quickButtons}>
            {[500, 1000, 2000, 5000].map((amt) => (
              <Pressable
                key={amt}
                style={styles.quickBtn}
                onPress={() => handleQuickAdd(amt)}
              >
                <Text style={styles.quickBtnText}>+{amt}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Rebalance Recommendations */}
        <View style={styles.suggestionsContainer}>
          {rebalanceSuggestions.map((sug) => {
            const classMeta = getAssetClassMeta(sug.assetClass);
            const isBuy = sug.suggestedAllocationBRL > 0;
            return (
              <View
                key={sug.assetClass}
                style={[
                  styles.suggestionCard,
                  isBuy && styles.suggestionCardBuy,
                ]}
              >
                <View style={styles.suggestionTop}>
                  <Text style={styles.suggestionName}>
                    {classMeta.label}
                  </Text>
                  <Text
                    style={[
                      styles.suggestionAmount,
                      { color: isBuy ? colors.success.main : colors.text.disabled },
                    ]}
                  >
                    {isBuy ? `+${formatCurrencySmart(sug.suggestedAllocationBRL)}` : 'Manter (Hold)'}
                  </Text>
                </View>
                <Text style={styles.suggestionReason}>{sug.rationalExplanation}</Text>
              </View>
            );
          })}
        </View>

        {/* Commit Button */}
        {onAddRows && (
          <Pressable
            style={[
              styles.commitBtn,
              (isCommitting || parsedCash <= 0) && styles.disabledBtn,
            ]}
            onPress={handleCommitRebalance}
            disabled={isCommitting || parsedCash <= 0}
          >
            <Text style={styles.commitBtnText}>
              {isCommitting ? 'Registrando Aportes...' : `➕ Registrar Aporte de ${formatCurrencySmart(parsedCash)} na Planilha`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  header: {
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleIcon: {
    fontSize: 22,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.accent.purple,
    fontWeight: '600',
  },
  personaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  personaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full || 16,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  personaChipActive: {
    backgroundColor: colors.accent.purpleLight || 'rgba(168, 85, 247, 0.15)',
    borderColor: colors.accent.purpleBorder || '#c084fc',
  },
  personaChipIcon: {
    fontSize: 11,
  },
  personaChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  personaChipTextActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  personaDescription: {
    fontSize: 10,
    color: colors.text.disabled,
    fontStyle: 'italic',
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  kpiLabel: {
    fontSize: 9,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 2,
  },
  kpiUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  kpiSubtitle: {
    fontSize: 9,
    color: colors.text.disabled,
  },
  section: {
    gap: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  portfolioTotalText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  positionRow: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.sm,
    padding: 8,
    gap: 4,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  positionName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  positionValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  positionAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  positionPct: {
    fontSize: 9,
    color: colors.text.secondary,
  },
  deltaBadge: {
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  targetMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ffffff',
    zIndex: 2,
  },
  rebalancerBox: {
    backgroundColor: 'rgba(168, 85, 247, 0.04)',
    borderColor: colors.accent.purpleBorder || '#c084fc',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rebalancerHeader: {
    gap: 2,
  },
  rebalancerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  rebalancerSubtitle: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inputPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
    width: 100,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    flexWrap: 'wrap',
  },
  quickBtn: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  quickBtnText: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  suggestionsContainer: {
    gap: 6,
  },
  suggestionCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 2,
  },
  suggestionCardBuy: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  suggestionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  suggestionAmount: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  suggestionReason: {
    fontSize: 9,
    color: colors.text.secondary,
    lineHeight: 12,
  },
  commitBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  commitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
