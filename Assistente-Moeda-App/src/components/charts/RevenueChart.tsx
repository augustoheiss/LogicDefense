/**
 * RevenueChart — Assistente Moeda
 *
 * Bar chart showing revenue with a three-level period filter that mirrors
 * the web version's granularity exactly:
 *
 *   • Mensal  → Daily bars for the selected month  (X-axis: day 01–31)
 *   • Anual   → Monthly bars for the selected year (X-axis: Jan–Dec)
 *   • Global  → Yearly bars across all history      (X-axis: 2024, 2025 …)
 *
 * Data sources (all pre-computed by the core metrics engine):
 *   - Daily:   metrics.byMonth[ym].dailyPayments  (Record<"YYYY-MM-DD", number>)
 *   - Monthly: metrics.byMonth filtered by year    (grossMonthly per YYYY-MM)
 *   - Yearly:  metrics.byYear                      (grossAnnual per YYYY)
 *
 * Uses react-native-gifted-charts BarChart for native performance.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { TableMetrics, TableGoals, TableRow } from '@/core/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChartViewMode = 'monthly' | 'annual' | 'global';

interface RevenueChartProps {
  metrics: TableMetrics;
  goals: TableGoals;
  rows?: TableRow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEW_PILLS: { key: ChartViewMode; label: string }[] = [
  { key: 'monthly', label: 'Mensal' },
  { key: 'annual',  label: 'Anual' },
  { key: 'global',  label: 'Global' },
];

const MONTH_LABELS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const MONTH_NAMES_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function currentYM(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
}

function fmtBarValue(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RevenueChart({ metrics, goals }: RevenueChartProps) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - spacing.lg * 2 - 60, 700);

  const [chartView, setChartView] = useState<ChartViewMode>('monthly');

  // ── Derived: available months and years from metrics ─────────────────────
  const availableMonths = useMemo(() => {
    const list = Object.keys(metrics.byMonth).sort();
    if (list.length === 0) list.push(currentYM());
    return list;
  }, [metrics.byMonth]);

  const availableYears = useMemo(() => {
    const list = Object.keys(metrics.byYear).sort();
    if (list.length === 0) list.push(String(new Date().getFullYear()));
    return list;
  }, [metrics.byYear]);

  // ── Context pickers: selected month / year ──────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(() =>
    availableMonths[availableMonths.length - 1] || currentYM(),
  );
  const [selectedYear, setSelectedYear] = useState(() =>
    availableYears[availableYears.length - 1] || String(new Date().getFullYear()),
  );

  // ── Month navigation ───────────────────────────────────────────────────
  const monthIdx = availableMonths.indexOf(selectedMonth);
  const canPrevMonth = monthIdx > 0;
  const canNextMonth = monthIdx < availableMonths.length - 1;

  const goMonthPrev = useCallback(() => {
    if (canPrevMonth) setSelectedMonth(availableMonths[monthIdx - 1]);
  }, [canPrevMonth, availableMonths, monthIdx]);

  const goMonthNext = useCallback(() => {
    if (canNextMonth) setSelectedMonth(availableMonths[monthIdx + 1]);
  }, [canNextMonth, availableMonths, monthIdx]);

  // ── Year navigation ────────────────────────────────────────────────────
  const yearIdx = availableYears.indexOf(selectedYear);
  const canPrevYear = yearIdx > 0;
  const canNextYear = yearIdx < availableYears.length - 1;

  const goYearPrev = useCallback(() => {
    if (canPrevYear) setSelectedYear(availableYears[yearIdx - 1]);
  }, [canPrevYear, availableYears, yearIdx]);

  const goYearNext = useCallback(() => {
    if (canNextYear) setSelectedYear(availableYears[yearIdx + 1]);
  }, [canNextYear, availableYears, yearIdx]);

  // ── Formatted context label ─────────────────────────────────────────────
  const contextLabel = useMemo(() => {
    if (chartView === 'monthly') {
      const [yStr, mStr] = selectedMonth.split('-');
      const mIdx = parseInt(mStr, 10) - 1;
      return `${MONTH_NAMES_LONG[mIdx]} ${yStr}`;
    }
    if (chartView === 'annual') return selectedYear;
    return 'Todo o Histórico';
  }, [chartView, selectedMonth, selectedYear]);

  // ── Goal line scaled to the active period ────────────────────────────────
  const goalLine = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const weeklyGoal = goals.weeklyGoals?.[currentYear] ?? 0;
    if (weeklyGoal === 0) return 0;

    switch (chartView) {
      case 'monthly':
        // Daily goal: weekly / 7
        return Math.round((weeklyGoal / 7) * 100) / 100;
      case 'annual':
        // Monthly goal: weekly × 4.33
        return Math.round(weeklyGoal * 4.33 * 100) / 100;
      case 'global':
        // Annual goal: weekly × 52
        return Math.round(weeklyGoal * 52 * 100) / 100;
    }
  }, [goals, chartView]);

  // ── Bar data per view mode ──────────────────────────────────────────────

  const { barData, maxValue } = useMemo(() => {
    type BarItem = {
      value: number;
      label: string;
      frontColor: string;
      topLabelComponent: () => React.JSX.Element;
    };
    let data: BarItem[] = [];

    switch (chartView) {
      // ── MENSAL: Daily bars for the selected month ──────────────────────
      case 'monthly': {
        const monthData = metrics.byMonth[selectedMonth];
        if (!monthData) return { barData: [], maxValue: 100 };

        const dailyPayments = monthData.dailyPayments;
        const [yearStr, monthStr] = selectedMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const totalDays = daysInMonth(year, month);
        const isThisMonth = selectedMonth === currentYM();
        const todayDay = new Date().getDate();

        for (let d = 1; d <= totalDays; d++) {
          // For the current month, stop at today
          if (isThisMonth && d > todayDay) break;

          const dateKey = `${yearStr}-${monthStr}-${pad2(d)}`;
          const value = dailyPayments[dateKey] ?? 0;

          data.push({
            value,
            label: String(d),
            frontColor:
              value >= goalLine && goalLine > 0
                ? colors.success.main
                : value > 0
                  ? colors.accent.purple
                  : colors.background.tertiary,
            topLabelComponent: () =>
              value > 0 ? (
                <Text style={styles.barLabel}>{fmtBarValue(value)}</Text>
              ) : <></>,
          });
        }
        break;
      }

      // ── ANUAL: Monthly bars for the selected year ─────────────────────
      case 'annual': {
        for (let m = 1; m <= 12; m++) {
          const ym = `${selectedYear}-${pad2(m)}`;
          const monthData = metrics.byMonth[ym];
          const value = monthData?.grossMonthly ?? 0;

          data.push({
            value,
            label: MONTH_LABELS_SHORT[m - 1],
            frontColor:
              value >= goalLine && goalLine > 0
                ? colors.success.main
                : value > 0
                  ? colors.accent.purple
                  : colors.background.tertiary,
            topLabelComponent: () =>
              value > 0 ? (
                <Text style={styles.barLabel}>{fmtBarValue(value)}</Text>
              ) : <></>,
          });
        }
        break;
      }

      // ── GLOBAL: Yearly bars across all history ─────────────────────────
      case 'global': {
        const years = Object.keys(metrics.byYear).sort();
        if (years.length === 0) return { barData: [], maxValue: 100 };

        data = years.map((yr) => {
          const y = metrics.byYear[yr];
          const value = y.grossAnnual;

          return {
            value,
            label: yr,
            frontColor:
              value >= goalLine && goalLine > 0
                ? colors.success.main
                : colors.accent.purple,
            topLabelComponent: () => (
              <Text style={styles.barLabel}>{fmtBarValue(value)}</Text>
            ),
          };
        });
        break;
      }
    }

    // Filter out months with no data for cleaner annual charts
    // (keep zero-value bars for monthly view to show calendar gaps)
    const displayData = chartView === 'annual'
      ? data.filter((d) => d.value > 0 || data.some((x) => x.value > 0))
      : data;

    // Compute max for axis scaling
    let max = goalLine;
    for (const bar of displayData) {
      if (bar.value > max) max = bar.value;
    }

    return { barData: displayData, maxValue: Math.ceil(max * 1.15) || 100 };
  }, [metrics, chartView, goalLine, selectedMonth, selectedYear]);

  // ── Dynamic sizing ──────────────────────────────────────────────────────
  const barWidth = useMemo(() => {
    const count = barData.length;
    if (count <= 1) return 80;
    if (count <= 6) return 36;
    if (count <= 12) return 28;
    if (count <= 20) return 16;
    return 10; // 31 days
  }, [barData.length]);

  const barSpacing = useMemo(() => {
    const count = barData.length;
    if (count <= 1) return 0;
    if (count <= 6) return 14;
    if (count <= 12) return 10;
    if (count <= 20) return 6;
    return 3; // 31 days
  }, [barData.length]);

  // ── Dynamic chart title ─────────────────────────────────────────────────
  const chartTitle = chartView === 'monthly'
    ? '💰 Receita Diária'
    : chartView === 'annual'
      ? '💰 Receita Mensal'
      : '💰 Receita Anual';

  // ── Goal legend label ──────────────────────────────────────────────────
  const goalLegendLabel = chartView === 'monthly'
    ? `Meta diária: R$ ${goalLine.toLocaleString('pt-BR')}`
    : chartView === 'annual'
      ? `Meta mensal: R$ ${goalLine.toLocaleString('pt-BR')}`
      : `Meta anual: R$ ${goalLine.toLocaleString('pt-BR')}`;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Segmented Control (Pill Buttons) ─────────────────────────── */}
      <View style={styles.pillRow}>
        {VIEW_PILLS.map((pill) => (
          <Pressable
            key={pill.key}
            style={[
              styles.pill,
              chartView === pill.key && styles.pillActive,
            ]}
            onPress={() => setChartView(pill.key)}
          >
            <Text
              style={[
                styles.pillLabel,
                chartView === pill.key && styles.pillLabelActive,
              ]}
            >
              {pill.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Context picker (prev/next) ───────────────────────────────── */}
      {chartView !== 'global' && (
        <View style={styles.pickerRow}>
          <Pressable
            onPress={chartView === 'monthly' ? goMonthPrev : goYearPrev}
            style={[
              styles.pickerArrow,
              !(chartView === 'monthly' ? canPrevMonth : canPrevYear) && styles.pickerArrowDisabled,
            ]}
            disabled={!(chartView === 'monthly' ? canPrevMonth : canPrevYear)}
          >
            <Text style={styles.pickerArrowText}>◂</Text>
          </Pressable>

          <Text style={styles.pickerLabel}>{contextLabel}</Text>

          <Pressable
            onPress={chartView === 'monthly' ? goMonthNext : goYearNext}
            style={[
              styles.pickerArrow,
              !(chartView === 'monthly' ? canNextMonth : canNextYear) && styles.pickerArrowDisabled,
            ]}
            disabled={!(chartView === 'monthly' ? canNextMonth : canNextYear)}
          >
            <Text style={styles.pickerArrowText}>▸</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.title}>{chartTitle}</Text>

      {barData.length === 0 || barData.every((b) => b.value === 0) ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sem dados para este período</Text>
        </View>
      ) : (
        <>
          <View style={styles.chartWrapper}>
            <BarChart
              data={barData}
              width={chartWidth}
              height={200}
              barWidth={barWidth}
              spacing={barSpacing}
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
              <Text style={styles.legendText}>{goalLegendLabel}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },

  // Segmented control
  pillRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm - 1,
  },
  pillActive: {
    backgroundColor: colors.accent.purpleLight,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  pillLabelActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },

  // Context picker
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  pickerArrow: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerArrowDisabled: {
    opacity: 0.25,
  },
  pickerArrowText: {
    fontSize: 16,
    color: colors.accent.purple,
    fontWeight: '700',
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    minWidth: 120,
    textAlign: 'center',
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
