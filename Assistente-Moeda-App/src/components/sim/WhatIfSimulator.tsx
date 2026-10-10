/**
 * What-If Financial Simulator ("E Se...?") — Assistente Moeda
 *
 * Interactive sandbox for testing hypothetical savings, debt reductions,
 * and emergency fund accumulation without affecting real spreadsheet data.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrencySmart } from '@/core/formatCurrency';

interface WhatIfSimulatorProps {
  currentMonthlyExpense?: number;
  currentMonthlyRevenue?: number;
}

export function WhatIfSimulator({
  currentMonthlyExpense = 3000,
  currentMonthlyRevenue = 4500,
}: WhatIfSimulatorProps) {
  const [activeTab, setActiveTab] = useState<'cut' | 'reserve' | 'income'>('cut');

  // Scenario 1: Expense Cut
  const [monthlyCut, setMonthlyCut] = useState(150);

  // Scenario 2: Emergency Fund
  const [monthlyDeposit, setMonthlyDeposit] = useState(300);
  const [reserveTargetMonths, setReserveTargetMonths] = useState(3);

  // Scenario 3: Extra Income
  const [extraIncome, setExtraIncome] = useState(500);

  // ── Calculation 1: Cut Compound Accumulation ───────────
  // Annual rate ~10.5% a.a. (CDI) -> ~0.83% a.m.
  const cutResults = useMemo(() => {
    const annualSavingsNominal = monthlyCut * 12;
    // Future value formula: PMT * (((1 + i)^n - 1) / i)
    const monthlyRate = 0.0083;
    const n60 = 60; // 5 years
    const futureValue5Years =
      monthlyCut * ((Math.pow(1 + monthlyRate, n60) - 1) / monthlyRate);

    return {
      annualNominal: annualSavingsNominal,
      future5Years: Math.round(futureValue5Years),
      interestGained: Math.round(futureValue5Years - monthlyCut * 60),
    };
  }, [monthlyCut]);

  // ── Calculation 2: Emergency Fund Timeline ─────────────
  const reserveResults = useMemo(() => {
    const targetAmount = currentMonthlyExpense * reserveTargetMonths;
    const monthsNeeded = monthlyDeposit > 0 ? Math.ceil(targetAmount / monthlyDeposit) : 0;
    const yearsNeeded = (monthsNeeded / 12).toFixed(1);

    return {
      targetAmount,
      monthsNeeded,
      yearsNeeded,
    };
  }, [currentMonthlyExpense, reserveTargetMonths, monthlyDeposit]);

  // ── Calculation 3: Extra Income Net Balance ────────────
  const incomeResults = useMemo(() => {
    const newRevenue = currentMonthlyRevenue + extraIncome;
    const newNet = newRevenue - currentMonthlyExpense;
    const newSavingsRate = Math.round((newNet / newRevenue) * 100);

    return {
      newRevenue,
      newNet,
      newSavingsRate,
    };
  }, [currentMonthlyRevenue, currentMonthlyExpense, extraIncome]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Simulador "E Se...?" 🔮</Text>
        <Text style={styles.subtitle}>Teste cenários sem alterar suas contas reais</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tab, activeTab === 'cut' && styles.tabActive]}
          onPress={() => setActiveTab('cut')}
        >
          <Text style={[styles.tabText, activeTab === 'cut' && styles.tabTextActive]}>
            ✂️ Cortar Gasto
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'reserve' && styles.tabActive]}
          onPress={() => setActiveTab('reserve')}
        >
          <Text style={[styles.tabText, activeTab === 'reserve' && styles.tabTextActive]}>
            🛡️ Criar Reserva
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'income' && styles.tabActive]}
          onPress={() => setActiveTab('income')}
        >
          <Text style={[styles.tabText, activeTab === 'income' && styles.tabTextActive]}>
            ⚡ Renda Extra
          </Text>
        </Pressable>
      </View>

      {/* ── TAB 1: CORTAR GASTO ── */}
      {activeTab === 'cut' && (
        <View style={styles.contentBox}>
          <Text style={styles.inputPrompt}>
            E se eu economizar por mês em delivery ou pequenos gastos:
          </Text>

          {/* Quick preset buttons */}
          <View style={styles.presetRow}>
            {[50, 100, 150, 300, 500].map(val => (
              <Pressable
                key={val}
                style={[styles.presetBtn, monthlyCut === val && styles.presetBtnActive]}
                onPress={() => setMonthlyCut(val)}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    monthlyCut === val && styles.presetBtnTextActive,
                  ]}
                >
                  R$ {val}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Projection Results */}
          <View style={styles.resultsGrid}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Sobra em 1 Ano</Text>
              <Text style={styles.resultValueEmerald}>
                {formatCurrencySmart(cutResults.annualNominal)}
              </Text>
              <Text style={styles.resultHint}>Sem render nada</Text>
            </View>

            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Patrimônio em 5 Anos</Text>
              <Text style={styles.resultValuePurple}>
                {formatCurrencySmart(cutResults.future5Years)}
              </Text>
              <Text style={styles.resultHint}>
                + {formatCurrencySmart(cutResults.interestGained)} só de juros
              </Text>
            </View>
          </View>

          <Text style={styles.insightNote}>
            💡 Uma economia de R$ {monthlyCut}/mês rende mais de{' '}
            {formatCurrencySmart(cutResults.interestGained)} de juros no CDI em 5 anos.
          </Text>
        </View>
      )}

      {/* ── TAB 2: CRIAR RESERVA ── */}
      {activeTab === 'reserve' && (
        <View style={styles.contentBox}>
          <Text style={styles.inputPrompt}>
            Meta da Reserva de Emergência Familiar:
          </Text>

          <View style={styles.presetRow}>
            {[3, 6].map(months => (
              <Pressable
                key={months}
                style={[
                  styles.presetBtn,
                  reserveTargetMonths === months && styles.presetBtnActive,
                ]}
                onPress={() => setReserveTargetMonths(months)}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    reserveTargetMonths === months && styles.presetBtnTextActive,
                  ]}
                >
                  {months} Meses ({formatCurrencySmart(currentMonthlyExpense * months)})
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.inputPrompt, { marginTop: spacing.md }]}>
            Aporte mensal que você consegue poupar:
          </Text>

          <View style={styles.presetRow}>
            {[100, 200, 300, 500, 1000].map(val => (
              <Pressable
                key={val}
                style={[
                  styles.presetBtn,
                  monthlyDeposit === val && styles.presetBtnActive,
                ]}
                onPress={() => setMonthlyDeposit(val)}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    monthlyDeposit === val && styles.presetBtnTextActive,
                  ]}
                >
                  R$ {val}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.resultsGrid}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Meta Total</Text>
              <Text style={styles.resultValuePurple}>
                {formatCurrencySmart(reserveResults.targetAmount)}
              </Text>
              <Text style={styles.resultHint}>{reserveTargetMonths} meses de contas</Text>
            </View>

            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Tempo Estimado</Text>
              <Text style={styles.resultValueEmerald}>
                {reserveResults.monthsNeeded} meses
              </Text>
              <Text style={styles.resultHint}>
                (~{reserveResults.yearsNeeded} anos)
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── TAB 3: RENDA EXTRA ── */}
      {activeTab === 'income' && (
        <View style={styles.contentBox}>
          <Text style={styles.inputPrompt}>
            E se eu adicionar uma renda extra mensal de:
          </Text>

          <View style={styles.presetRow}>
            {[200, 500, 800, 1200, 2000].map(val => (
              <Pressable
                key={val}
                style={[
                  styles.presetBtn,
                  extraIncome === val && styles.presetBtnActive,
                ]}
                onPress={() => setExtraIncome(val)}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    extraIncome === val && styles.presetBtnTextActive,
                  ]}
                >
                  + R$ {val}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.resultsGrid}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Novo Saldo Líquido</Text>
              <Text style={styles.resultValueEmerald}>
                {formatCurrencySmart(incomeResults.newNet)}
              </Text>
              <Text style={styles.resultHint}>por mês</Text>
            </View>

            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Taxa de Poupança</Text>
              <Text style={styles.resultValuePurple}>
                {incomeResults.newSavingsRate}%
              </Text>
              <Text style={styles.resultHint}>da renda bruta</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
  },
  headerRow: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.background.elevated,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.text.primary,
  },
  contentBox: {
    marginTop: spacing.xs,
  },
  inputPrompt: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  presetBtn: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  presetBtnActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purple,
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  presetBtnTextActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  resultsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  resultItem: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  resultValueEmerald: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.success.main,
    letterSpacing: -0.2,
  },
  resultValuePurple: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent.purple,
    letterSpacing: -0.2,
  },
  resultHint: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  insightNote: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
});
