/**
 * Interactive Chart Builder (Native) — Assistente Moeda
 *
 * Native mobile visual analytics engine using react-native-gifted-charts.
 * Provides full dynamic temporal granularity (day, month, year, multi-date, custom-range),
 * metric selection, category distribution (donut), and touch-based drill-down.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import type { TableRow, TableGoals } from '@coin/core/types';
import {
  aggregateChartData,
  getDefaultChartConfig,
  type ChartBuilderConfig,
  type ChartDataPoint,
  type ChartCategorySlice,
  CHART_PALETTE,
} from '@coin/core/chartAggregationEngine';
import { ChartControlPanel } from './ChartControlPanel';

interface InteractiveChartBuilderProps {
  rows: TableRow[];
  goals?: TableGoals;
  onEditRow?: (row: TableRow) => void;
  onDeleteRow?: (rowId: string) => void;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtBRLCompact(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}R$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}R$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}R$${abs.toFixed(0)}`;
}

export function InteractiveChartBuilder({
  rows,
  goals,
  onEditRow,
  onDeleteRow,
}: InteractiveChartBuilderProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [config, setConfig] = useState<ChartBuilderConfig>(() => getDefaultChartConfig());
  const [selectedDrillDownKey, setSelectedDrillDownKey] = useState<string | null>(null);
  const [selectedDrillDownTitle, setSelectedDrillDownTitle] = useState<string | null>(null);

  const chartWidth = Math.max(screenWidth - 64, 280);

  // Compute aggregation
  const aggResult = useMemo(() => {
    return aggregateChartData(rows, config, goals);
  }, [rows, config, goals]);

  // Drill-down transaction list
  const drillDownRows = useMemo<TableRow[]>(() => {
    if (!selectedDrillDownKey) return [];

    const fromMap = aggResult.rowLookupMap.get(selectedDrillDownKey);
    if (fromMap && fromMap.length > 0) return fromMap;

    const upperKey = selectedDrillDownKey.toUpperCase();
    return rows.filter((r) => {
      const cat = (r.category || r.description || '').trim().toUpperCase();
      return cat === upperKey && r.entryType !== 'unresolved';
    });
  }, [selectedDrillDownKey, aggResult.rowLookupMap, rows]);

  const handlePointClick = (point: ChartDataPoint) => {
    setSelectedDrillDownKey(point.dateISO);
    setSelectedDrillDownTitle(`${point.label} (${point.dateISO})`);
  };

  const handlePieSliceClick = (slice: ChartCategorySlice) => {
    setSelectedDrillDownKey(slice.name);
    setSelectedDrillDownTitle(`Categoria: ${slice.name}`);
  };

  const clearDrillDown = () => {
    setSelectedDrillDownKey(null);
    setSelectedDrillDownTitle(null);
  };

  const hasData = rows.length > 0 && aggResult.points.length > 0;

  // ── Prepare gifted-charts data ──────────────────────────────────────────────
  const barData = useMemo(() => {
    if (!hasData) return [];

    const result: any[] = [];
    const showRev = config.activeMetrics.includes('revenue');
    const showExp = config.activeMetrics.includes('expense');
    const isMultiMetric = showRev && showExp;

    aggResult.points.forEach((p) => {
      if (isMultiMetric) {
        // Grouped bars: Rev then Exp
        result.push({
          value: p.revenue,
          label: p.label,
          spacing: 3,
          frontColor: '#10b981',
          onPress: () => handlePointClick(p),
        });
        result.push({
          value: p.expense,
          frontColor: '#ef4444',
          onPress: () => handlePointClick(p),
        });
      } else if (showRev) {
        result.push({
          value: p.revenue,
          label: p.label,
          frontColor: '#10b981',
          onPress: () => handlePointClick(p),
        });
      } else if (showExp) {
        result.push({
          value: p.expense,
          label: p.label,
          frontColor: '#ef4444',
          onPress: () => handlePointClick(p),
        });
      } else {
        // Saldo or another metric
        result.push({
          value: Math.max(0, p.balance),
          label: p.label,
          frontColor: p.balance >= 0 ? '#8b5cf6' : '#ef4444',
          onPress: () => handlePointClick(p),
        });
      }
    });

    return result;
  }, [hasData, aggResult.points, config.activeMetrics]);

  const lineData = useMemo(() => {
    if (!hasData) return [];
    return aggResult.points.map((p) => ({
      value: config.cumulativeBalance
        ? p.cumulativeBalance
        : config.activeMetrics.includes('revenue')
        ? p.revenue
        : p.balance,
      dataPointText: fmtBRLCompact(
        config.cumulativeBalance ? p.cumulativeBalance : p.balance
      ),
      label: p.label,
    }));
  }, [hasData, aggResult.points, config.cumulativeBalance, config.activeMetrics]);

  const pieData = useMemo(() => {
    if (!aggResult.donutSlices.length) return [];
    return aggResult.donutSlices.map((slice, i) => ({
      value: slice.value,
      color: slice.color || CHART_PALETTE[i % CHART_PALETTE.length],
      text: `${slice.pct}%`,
      onPress: () => handlePieSliceClick(slice),
    }));
  }, [aggResult.donutSlices]);

  // Bar sizing
  const barWidth = useMemo(() => {
    const count = barData.length;
    if (count <= 2) return 50;
    if (count <= 8) return 26;
    if (count <= 16) return 16;
    if (count <= 32) return 10;
    return 6;
  }, [barData.length]);

  const barSpacing = useMemo(() => {
    const count = barData.length;
    if (count <= 2) return 30;
    if (count <= 8) return 14;
    if (count <= 16) return 8;
    return 4;
  }, [barData.length]);

  return (
    <View style={styles.container}>
      {/* ── KPI Metrics Bar ── */}
      <View style={styles.kpiBar}>
        <View style={[styles.kpiCard, { borderColor: '#10b981' }]}>
          <Text style={styles.kpiLabel}>Receitas</Text>
          <Text style={[styles.kpiValue, { color: '#10b981' }]}>
            {fmtBRL(aggResult.totalRevenue)}
          </Text>
        </View>

        <View style={[styles.kpiCard, { borderColor: '#ef4444' }]}>
          <Text style={styles.kpiLabel}>Custos</Text>
          <Text style={[styles.kpiValue, { color: '#ef4444' }]}>
            {fmtBRL(aggResult.totalExpense)}
          </Text>
        </View>

        <View
          style={[
            styles.kpiCard,
            { borderColor: aggResult.netBalance >= 0 ? '#8b5cf6' : '#f87171' },
          ]}
        >
          <Text style={styles.kpiLabel}>Saldo</Text>
          <Text
            style={[
              styles.kpiValue,
              { color: aggResult.netBalance >= 0 ? '#c084fc' : '#f87171' },
            ]}
          >
            {fmtBRL(aggResult.netBalance)}
          </Text>
        </View>
      </View>

      {/* ── Dynamic Chart Control Panel ── */}
      <ChartControlPanel
        config={config}
        onChangeConfig={setConfig}
        availableYears={aggResult.availableYears}
        availableMonths={aggResult.availableMonths}
        availableCategories={aggResult.availableCategories}
      />

      {/* ── Main Chart Canvas Container ── */}
      <View style={styles.chartCard} testID="interactive-chart-canvas">
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>
            {config.visualType === 'donut'
              ? '🍩 Distribuição por Categoria'
              : config.scopeType === 'day'
              ? '☀️ Linha do Tempo Diária'
              : config.scopeType === 'month'
              ? '📅 Comparativo Mensal'
              : config.scopeType === 'year'
              ? '🏛️ Evolução Anual'
              : config.scopeType === 'multi_date'
              ? '🎯 Múltiplas Datas Específicas'
              : '⏱️ Intervalo Personalizado'}
          </Text>
          <Text style={styles.chartSubtitle}>
            Toque nos elementos para abrir o Raio-X detalhado
          </Text>
        </View>

        {!hasData ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>Sem dados no período</Text>
            <Text style={styles.emptySubtitle}>
              Selecione outro período ou remova filtros de categoria.
            </Text>
          </View>
        ) : (
          <View style={styles.chartWrapper}>
            {config.visualType === 'donut' ? (
              <View style={styles.pieContainer}>
                <PieChart
                  data={pieData}
                  donut
                  innerRadius={65}
                  radius={110}
                  textColor="#fff"
                  textSize={11}
                  focusOnPress
                />
                <View style={styles.donutLegend}>
                  {aggResult.donutSlices.slice(0, 6).map((sl) => (
                    <Pressable
                      key={sl.name}
                      style={styles.donutLegendItem}
                      onPress={() => handlePieSliceClick(sl)}
                    >
                      <View style={[styles.legendDot, { backgroundColor: sl.color }]} />
                      <Text style={styles.donutLegendLabel} numberOfLines={1}>
                        {sl.name}: {sl.pct}% ({fmtBRL(sl.value)})
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : config.visualType === 'line_area' ? (
              <LineChart
                data={lineData}
                width={chartWidth}
                height={220}
                color="#8b5cf6"
                thickness={2.5}
                startFillColor="rgba(139, 92, 246, 0.4)"
                endFillColor="rgba(139, 92, 246, 0.01)"
                areaChart
                curved
                noOfSections={4}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.axisText}
                xAxisColor={colors.border.default}
                yAxisThickness={0}
                xAxisThickness={1}
                hideRules={false}
                rulesColor="rgba(255,255,255,0.06)"
                rulesType="dashed"
                backgroundColor="transparent"
              />
            ) : (
              <BarChart
                data={barData}
                width={chartWidth}
                height={220}
                barWidth={barWidth}
                spacing={barSpacing}
                noOfSections={4}
                barBorderRadius={4}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border.default}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.axisText}
                hideRules={false}
                rulesColor="rgba(255,255,255,0.06)"
                rulesType="dashed"
                backgroundColor="transparent"
                isAnimated
                animationDuration={400}
              />
            )}
          </View>
        )}
      </View>

      {/* ── X-Ray Drill-down Transaction Panel ── */}
      <View style={styles.drillDownContainer}>
        {selectedDrillDownKey ? (
          <View style={styles.drillDownCard}>
            <View style={styles.drillDownHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.drillDownTitle}>
                  🔬 Raio-X: {selectedDrillDownTitle}
                </Text>
                <Text style={styles.drillDownSubtitle}>
                  {drillDownRows.length} lançamento(s) correspondente(s)
                </Text>
              </View>
              <Pressable style={styles.closeDrillBtn} onPress={clearDrillDown}>
                <Text style={styles.closeDrillBtnText}>✕ Fechar</Text>
              </Pressable>
            </View>

            {drillDownRows.length === 0 ? (
              <Text style={styles.noDrillRowsText}>Nenhum detalhe encontrado.</Text>
            ) : (
              <View style={styles.drillRowsList}>
                {drillDownRows.map((row) => {
                  const isPositive =
                    row.entryType === 'revenue' || row.entryType === 'partner_in';
                  return (
                    <View key={row.id} style={styles.drillRowItem}>
                      <View style={styles.drillRowLeft}>
                        <View style={styles.drillRowBadgeRow}>
                          <Text style={styles.drillRowDate}>{row.date}</Text>
                          <View
                            style={[
                              styles.categoryBadge,
                              { backgroundColor: 'rgba(255,255,255,0.08)' },
                            ]}
                          >
                            <Text style={styles.categoryBadgeText}>
                              {row.category || 'Geral'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.drillRowDesc} numberOfLines={1}>
                          {row.description || 'Sem descrição'}
                        </Text>
                      </View>

                      <View style={styles.drillRowRight}>
                        <Text
                          style={[
                            styles.drillRowValue,
                            { color: isPositive ? '#10b981' : '#ef4444' },
                          ]}
                        >
                          {isPositive ? '+' : '-'} {fmtBRL(row.value)}
                        </Text>
                        <View style={styles.drillRowActions}>
                          {onEditRow && (
                            <Pressable
                              style={styles.drillActionBtn}
                              onPress={() => onEditRow(row)}
                            >
                              <Text style={styles.drillActionText}>✏️</Text>
                            </Pressable>
                          )}
                          {onDeleteRow && (
                            <Pressable
                              style={styles.drillActionBtn}
                              onPress={() => onDeleteRow(row.id)}
                            >
                              <Text style={styles.drillActionText}>🗑️</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.drillHintCard}>
            <Text style={styles.drillHintIcon}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.drillHintTitle}>Toque para Raio-X</Text>
              <Text style={styles.drillHintText}>
                Toque em qualquer barra ou fatia para listar as transações detalhadas daquele período.
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },

  // KPI Bar
  kpiBar: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  kpiLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },

  // Main Chart Card
  chartCard: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  chartHeader: {
    marginBottom: spacing.xs,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  chartSubtitle: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  axisText: {
    color: colors.text.tertiary,
    fontSize: 10,
  },

  // Donut Layout
  pieContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  donutLegend: {
    width: '100%',
    gap: 6,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  donutLegendLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    flex: 1,
  },

  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
  },

  // Drill-down
  drillDownContainer: {
    marginTop: spacing.xs,
  },
  drillDownCard: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  drillDownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingBottom: spacing.xs,
  },
  drillDownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c084fc',
  },
  drillDownSubtitle: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  closeDrillBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  closeDrillBtnText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  noDrillRowsText: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  drillRowsList: {
    gap: spacing.xs,
  },
  drillRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  drillRowLeft: {
    flex: 1,
    marginRight: spacing.sm,
    gap: 2,
  },
  drillRowBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  drillRowDate: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontFamily: 'monospace',
  },
  categoryBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 9,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  drillRowDesc: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '500',
  },
  drillRowRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  drillRowValue: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  drillRowActions: {
    flexDirection: 'row',
    gap: 4,
  },
  drillActionBtn: {
    padding: 2,
  },
  drillActionText: {
    fontSize: 11,
  },

  // Drill Hint
  drillHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  drillHintIcon: {
    fontSize: 20,
  },
  drillHintTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#93c5fd',
  },
  drillHintText: {
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: 14,
  },
});
