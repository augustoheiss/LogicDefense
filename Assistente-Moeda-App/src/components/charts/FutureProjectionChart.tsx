/**
 * FutureProjectionChart — Assistente Moeda
 *
 * Line chart showing compound interest growth over time for investment deposits.
 * Uses react-native-gifted-charts LineChart.
 *
 * Features:
 *   - Two lines: Total Balance (purple) vs Total Deposited (blue)
 *   - The gap between them = accumulated interest (the power of compounding)
 *   - Configurable projection months (default 72 = 6 years)
 *   - Summary card below with final balance, total interest, and multiplier
 */

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TextInput, Pressable } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { computeProjection, getProjectionSummary } from '@/core/projectionEngine';
import { formatCurrencySmart } from '@/core/formatCurrency';
import type { TableMetrics, TableRow } from '@/core/types';

interface FutureProjectionChartProps {
  metrics: TableMetrics;
  rows?: TableRow[];
}

export function FutureProjectionChart({ metrics }: FutureProjectionChartProps) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - spacing.lg * 2 - 60, 700);

  const [months, setMonths] = useState(72);
  const [monthlyDeposit, setMonthlyDeposit] = useState(() => {
    // Default: average monthly deposit from history
    const monthCount = Object.keys(metrics.byMonth).length || 1;
    return Math.round((metrics.totalInvested / monthCount) * 100) / 100;
  });

  const { balanceLine, depositLine, maxValue, summary } = useMemo(() => {
    const deposit = monthlyDeposit > 0 ? monthlyDeposit : 100;
    const points = computeProjection(deposit, months);
    const summaryData = getProjectionSummary(points);

    if (points.length === 0) {
      return { balanceLine: [], depositLine: [], maxValue: 1000, summary: null };
    }

    let max = 0;

    // Sample every Nth point to keep chart readable
    const step = Math.max(1, Math.floor(points.length / 24));

    const bLine = points
      .filter((_, i) => i % step === 0 || i === points.length - 1)
      .map((p) => {
        if (p.totalBalance > max) max = p.totalBalance;
        return {
          value: p.totalBalance,
          label: p.month % 12 === 0 ? `${p.month / 12}a` : '',
          dataPointText: '',
        };
      });

    const dLine = points
      .filter((_, i) => i % step === 0 || i === points.length - 1)
      .map((p) => ({
        value: p.totalDeposited,
        label: '',
        dataPointText: '',
      }));

    return {
      balanceLine: bLine,
      depositLine: dLine,
      maxValue: Math.ceil(max * 1.1),
      summary: summaryData,
    };
  }, [monthlyDeposit, months, metrics]);

  if (metrics.depositCount === 0 && monthlyDeposit <= 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>📈 Projeção de Investimento</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Adicione depósitos para ver a projeção de rendimento composto.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📈 Projeção de Investimento</Text>

      {/* Config */}
      <View style={styles.configRow}>
        <View style={styles.configItem}>
          <Text style={styles.configLabel}>Aporte/mês (R$)</Text>
          <TextInput
            style={styles.configInput}
            value={String(monthlyDeposit)}
            onChangeText={(t) => setMonthlyDeposit(parseFloat(t.replace(',', '.')) || 0)}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.text.disabled}
          />
        </View>
        <View style={styles.configItem}>
          <Text style={styles.configLabel}>Meses</Text>
          <View style={styles.monthButtons}>
            {[24, 48, 72, 120].map((m) => (
              <Pressable
                key={m}
                style={[styles.monthBtn, months === m && styles.monthBtnActive]}
                onPress={() => setMonths(m)}
              >
                <Text style={[styles.monthBtnText, months === m && styles.monthBtnTextActive]}>
                  {m / 12}a
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Chart */}
      {balanceLine.length > 0 && (
        <View style={styles.chartWrapper}>
          <LineChart
            data={balanceLine}
            data2={depositLine}
            width={chartWidth}
            height={180}
            maxValue={maxValue}
            noOfSections={4}
            color1={colors.accent.purple}
            color2={colors.info.main}
            thickness={2}
            thickness2={1.5}
            curved
            hideDataPoints
            hideDataPoints2
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={colors.border.default}
            yAxisTextStyle={styles.axisText}
            xAxisLabelTextStyle={styles.axisText}
            hideRules={false}
            rulesColor={colors.border.subtle}
            rulesType="dashed"
            backgroundColor="transparent"
            isAnimated
            animationDuration={800}
            startFillColor={colors.accent.purpleLight}
            endFillColor="transparent"
            areaChart
          />
        </View>
      )}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent.purple }]} />
          <Text style={styles.legendText}>Saldo Total</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.info.main }]} />
          <Text style={styles.legendText}>Total Depositado</Text>
        </View>
      </View>

      {/* Summary */}
      {summary && (
        <View style={styles.summaryRow}>
          <SummaryItem label="Saldo Final" value={formatCurrencySmart(summary.finalBalance)} color={colors.accent.purple} />
          <SummaryItem label="Juros Acum." value={formatCurrencySmart(summary.totalInterest)} color={colors.success.main} />
          <SummaryItem label="Multiplicador" value={`${summary.multiplier}x`} color={colors.warning.main} />
        </View>
      )}
    </View>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  configRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  configItem: {
    flex: 1,
    gap: spacing.xs,
  },
  configLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  configInput: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  monthButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  monthBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  monthBtnActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  monthBtnText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  monthBtnTextActive: {
    color: colors.accent.purple,
    fontWeight: '600',
  },
  chartWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  axisText: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 3,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.text.disabled,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.disabled,
    textAlign: 'center',
  },
});
