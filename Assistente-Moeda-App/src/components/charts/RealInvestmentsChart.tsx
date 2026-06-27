/**
 * RealInvestmentsChart — Assistente Moeda
 *
 * Line chart showing historical compound growth for investment deposits.
 * Uses react-native-gifted-charts LineChart.
 *
 * Features:
 *   - Two lines: Saldo Total (violet/purple) vs Aportes (sky blue)
 *   - The gap between them = accumulated real interest yield
 *   - Summary cards displaying totals (Deposited, Yield, Balance, Last Month Yield)
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrencySmart } from '@/core/formatCurrency';
import type { TableMetrics } from '@/core/types';

interface RealInvestmentsChartProps {
  metrics: TableMetrics;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthName = shortMonths[parseInt(m, 10) - 1];
  return `${monthName}/${y.slice(2)}`;
}

export function RealInvestmentsChart({ metrics }: RealInvestmentsChartProps) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - spacing.lg * 2 - 60, 700);

  const { balanceLine, principalLine, maxValue, totalDeposited, totalYieldEarned, finalBalance, lastMonthYield } = useMemo(() => {
    const monthsData = metrics.portfolioTimeline;
    if (monthsData.length === 0) {
      return {
        balanceLine: [],
        principalLine: [],
        maxValue: 1000,
        totalDeposited: 0,
        totalYieldEarned: 0,
        finalBalance: 0,
        lastMonthYield: 0,
      };
    }

    let max = 1000;
    // Step to keep chart labels readable on smaller screens
    const step = Math.max(1, Math.ceil(monthsData.length / 10));

    const bLine = monthsData.map((pt, i) => {
      const val = pt.totalBalance;
      if (val > max) max = val;
      const isLabelVisible = i % step === 0 || i === monthsData.length - 1;
      const label = isLabelVisible ? formatMonthLabel(pt.month) : '';

      return {
        value: val,
        label,
        dataPointText: '',
      };
    });

    const pLine = monthsData.map((pt) => ({
      value: pt.accumulatedPrincipal,
      label: '',
      dataPointText: '',
    }));

    const lastPt = monthsData[monthsData.length - 1];

    return {
      balanceLine: bLine,
      principalLine: pLine,
      maxValue: Math.ceil(max * 1.1),
      totalDeposited: metrics.globalTotalDeposited,
      totalYieldEarned: metrics.globalTotalYield,
      finalBalance: metrics.globalBalance,
      lastMonthYield: lastPt?.currentMonthYield ?? 0,
    };
  }, [metrics]);

  if (metrics.portfolioTimeline.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🏦 Aportes & Evolução Real</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💰</Text>
          <Text style={styles.emptyTextTitle}>Nenhum aporte registrado ainda</Text>
          <Text style={styles.emptyText}>
            Adicione um aporte na aba Planilha (tipo "💰 Aporte") para ver seu histórico de investimentos aqui.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🏦 Aportes & Evolução Real</Text>
        <Text style={styles.description}>
          Acompanhamento histórico dos aportes reais depositados e juros compostos acumulados gerados pela carteira de investimentos (CDI estimado de 0.8% a.m.).
        </Text>
      </View>

      {/* Chart */}
      {balanceLine.length > 0 && (
        <View style={styles.chartWrapper}>
          <LineChart
            data={balanceLine}
            data2={principalLine}
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
          <Text style={styles.legendText}>Saldo Total (c/ juros)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.info.main }]} />
          <Text style={styles.legendText}>Aportes Acumulados</Text>
        </View>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryRow}>
          <SummaryItem
            label="Total depositado"
            value={formatCurrencySmart(totalDeposited)}
            sub="esforço real poupado"
            theme="sky"
          />
          <SummaryItem
            label="Rendimentos"
            value={formatCurrencySmart(totalYieldEarned)}
            sub="juros reais acumulados"
            theme="violet"
          />
        </View>
        <View style={styles.summaryRow}>
          <SummaryItem
            label="Saldo atual"
            value={formatCurrencySmart(finalBalance)}
            sub="principal + rendimentos"
          />
          <SummaryItem
            label="Último mês"
            value={formatCurrencySmart(lastMonthYield)}
            sub="0.8% sobre saldo total"
          />
        </View>
      </View>
    </View>
  );
}

function SummaryItem({
  label, value, sub, theme = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  theme?: 'default' | 'sky' | 'violet';
}) {
  const themes = {
    default: { wrap: styles.itemDefault, text: '#fff' },
    sky:     { wrap: styles.itemSky,     text: '#38bdf8' },
    violet:  { wrap: styles.itemViolet,  text: '#c084fc' },
  };
  const t = themes[theme];
  return (
    <View style={[styles.summaryItem, t.wrap]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: t.text }]}>{value}</Text>
      {sub && <Text style={styles.summarySub}>{sub}</Text>}
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
  header: {
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  description: {
    fontSize: 12,
    color: colors.text.tertiary,
    lineHeight: 16,
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
    flexWrap: 'wrap',
    gap: spacing.md,
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
  summaryGrid: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 2,
  },
  itemDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  itemSky: {
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderColor: 'rgba(14, 165, 233, 0.2)',
  },
  itemViolet: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderColor: 'rgba(139, 92, 246, 0.2)',
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
    fontFamily: 'monospace',
  },
  summarySub: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTextTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  emptyText: {
    fontSize: 12,
    color: colors.text.disabled,
    textAlign: 'center',
    lineHeight: 16,
  },
});
