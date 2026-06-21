/**
 * RevenueChart — Assistente Moeda
 *
 * Bar chart showing monthly gross revenue over time.
 * Uses react-native-gifted-charts for native performance.
 *
 * Features:
 *   - Monthly bars color-coded (green for above goal, amber for below)
 *   - Goal line overlay when weekly goal is set
 *   - Responsive width based on screen dimensions
 *   - Dark theme styling matching the app design system
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { TableMetrics, TableGoals, TableRow } from '@/core/types';
import { getWeeklyGoalForDate } from '@/core/dateUtils';

interface RevenueChartProps {
  metrics: TableMetrics;
  goals: TableGoals;
  rows?: TableRow[];
}

export function RevenueChart({ metrics, goals }: RevenueChartProps) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - spacing.lg * 2 - 60, 700);

  const { barData, maxValue, goalLine } = useMemo(() => {
    const months = Object.keys(metrics.byMonth).sort();
    if (months.length === 0) return { barData: [], maxValue: 100, goalLine: 0 };

    // Current weekly goal → monthly
    const currentYear = new Date().getFullYear();
    const weeklyGoal = goals.weeklyGoals?.[currentYear] ?? 0;
    const monthlyGoalLine = Math.round(weeklyGoal * 4.33 * 100) / 100;

    let max = monthlyGoalLine;

    const data = months.map((ym) => {
      const m = metrics.byMonth[ym];
      const value = m.grossMonthly;
      if (value > max) max = value;

      const [, mo] = ym.split('-');
      const shortMonths = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
      const label = shortMonths[parseInt(mo, 10) - 1];

      return {
        value,
        label,
        frontColor: value >= monthlyGoalLine && monthlyGoalLine > 0
          ? colors.success.main
          : colors.accent.purple,
        topLabelComponent: () => (
          <Text style={styles.barLabel}>
            {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`}
          </Text>
        ),
      };
    });

    return { barData: data, maxValue: Math.ceil(max * 1.15), goalLine: monthlyGoalLine };
  }, [metrics, goals]);

  if (barData.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sem dados para exibir o gráfico</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💰 Receita Mensal</Text>
      <View style={styles.chartWrapper}>
        <BarChart
          data={barData}
          width={chartWidth}
          height={200}
          barWidth={barData.length > 12 ? 18 : 28}
          spacing={barData.length > 12 ? 8 : 14}
          maxValue={maxValue}
          noOfSections={4}
          barBorderRadius={4}
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
          animationDuration={600}
          showReferenceLine1={goalLine > 0}
          referenceLine1Position={goalLine}
          referenceLine1Config={{
            color: colors.warning.main,
            dashWidth: 6,
            dashGap: 4,
            thickness: 1.5,
            width: chartWidth,
            type: 'dashed',
            labelText: '',
            labelTextStyle: {},
          } as any}
        />
      </View>
      {goalLine > 0 && (
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning.main }]} />
          <Text style={styles.legendText}>
            Meta mensal: R$ {goalLine.toLocaleString('pt-BR')}
          </Text>
        </View>
      )}
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
  chartWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  barLabel: {
    fontSize: 9,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  axisText: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  legend: {
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
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.disabled,
  },
});
