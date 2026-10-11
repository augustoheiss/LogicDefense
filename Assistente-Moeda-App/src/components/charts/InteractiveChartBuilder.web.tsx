/**
 * Interactive Chart Builder (Web) — Assistente Moeda
 *
 * Self-service visual analytics engine built with Recharts.
 * Fully interactive: time scopes (day, month, year, multi-date, custom-range),
 * multi-metric selection, category slicing, and instant transaction drill-down.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import {
  ComposedChart,
  BarChart,
  AreaChart,
  PieChart,
  Bar,
  Line,
  Area,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { TableRow, TableGoals } from '@/core/types';
import {
  aggregateChartData,
  getDefaultChartConfig,
  type ChartBuilderConfig,
  type ChartDataPoint,
  type ChartCategorySlice,
  CHART_PALETTE,
} from '@/core/chartAggregationEngine';
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
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1)}k`;
  return `${sign}R$ ${abs.toFixed(0)}`;
}

// ── Custom Tooltips ───────────────────────────────────────────────────────────

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as ChartDataPoint;
  if (!data) return null;

  return (
    <div
      style={{
        backgroundColor: '#0d1117',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '10px',
        padding: '12px 16px',
        fontSize: '12px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        minWidth: '220px',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', color: '#f3f4f6' }}>
        📅 {data.label} <span style={{ opacity: 0.6, fontSize: '11px' }}>({data.dateISO})</span>
      </div>

      {data.revenue > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#10b981' }}>📥 Receitas:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmtBRL(data.revenue)}</span>
        </div>
      )}

      {data.expense > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#ef4444' }}>🏷️ Custos:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmtBRL(data.expense)}</span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '4px',
        }}
      >
        <span style={{ color: data.balance >= 0 ? '#8b5cf6' : '#f87171' }}>📊 Saldo Líquido:</span>
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            color: data.balance >= 0 ? '#c084fc' : '#f87171',
          }}
        >
          {fmtBRL(data.balance)}
        </span>
      </div>

      {data.deposit > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#3b82f6' }}>💰 Aportes:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmtBRL(data.deposit)}</span>
        </div>
      )}

      {data.waiver > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#f59e0b' }}>🛡️ Abonos:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmtBRL(data.waiver)}</span>
        </div>
      )}

      {data.goal && data.goal > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: '#fbbf24' }}>
          <span>🎯 Meta:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmtBRL(data.goal)}</span>
        </div>
      )}

      <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px' }}>
        🔬 Clique para ver os {data.rowCount} lançamentos
      </div>
    </div>
  );
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const slice = payload[0]?.payload as ChartCategorySlice;
  if (!slice) return null;

  return (
    <div
      style={{
        backgroundColor: '#0d1117',
        border: `1px solid ${slice.color}`,
        borderRadius: '10px',
        padding: '12px 16px',
        fontSize: '12px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        minWidth: '200px',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontWeight: 700, color: slice.color, fontSize: '14px', marginBottom: '6px' }}>
        🏷️ {slice.name}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#9ca3af' }}>Total:</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmtBRL(slice.value)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#9ca3af' }}>Proporção:</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{slice.pct}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#9ca3af' }}>Lançamentos:</span>
        <span style={{ fontFamily: 'monospace' }}>{slice.count}</span>
      </div>
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px' }}>
        🔬 Clique para abrir o Raio-X
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function InteractiveChartBuilder({
  rows,
  goals,
  onEditRow,
  onDeleteRow,
}: InteractiveChartBuilderProps) {
  const [config, setConfig] = useState<ChartBuilderConfig>(() => getDefaultChartConfig());
  const [selectedDrillDownKey, setSelectedDrillDownKey] = useState<string | null>(null);
  const [selectedDrillDownTitle, setSelectedDrillDownTitle] = useState<string | null>(null);

  // Compute math aggregation
  const aggResult = useMemo(() => {
    return aggregateChartData(rows, config, goals);
  }, [rows, config, goals]);

  // Drill-down transaction list
  const drillDownRows = useMemo<TableRow[]>(() => {
    if (!selectedDrillDownKey) return [];

    // Check if it's a date lookup in the map
    const fromMap = aggResult.rowLookupMap.get(selectedDrillDownKey);
    if (fromMap && fromMap.length > 0) return fromMap;

    // Check if it's a category name
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

  return (
    <View style={styles.container}>
      {/* ── KPI Metrics Bar ── */}
      <View style={styles.kpiBar}>
        <View style={[styles.kpiCard, { borderColor: '#10b981' }]}>
          <Text style={styles.kpiLabel}>Total Receitas</Text>
          <Text style={[styles.kpiValue, { color: '#10b981' }]}>
            {fmtBRL(aggResult.totalRevenue)}
          </Text>
        </View>

        <View style={[styles.kpiCard, { borderColor: '#ef4444' }]}>
          <Text style={styles.kpiLabel}>Total Custos</Text>
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
          <Text style={styles.kpiLabel}>Saldo Líquido</Text>
          <Text
            style={[
              styles.kpiValue,
              { color: aggResult.netBalance >= 0 ? '#c084fc' : '#f87171' },
            ]}
          >
            {fmtBRL(aggResult.netBalance)}
          </Text>
        </View>

        {aggResult.totalDeposit > 0 && (
          <View style={[styles.kpiCard, { borderColor: '#3b82f6' }]}>
            <Text style={styles.kpiLabel}>Aportes</Text>
            <Text style={[styles.kpiValue, { color: '#3b82f6' }]}>
              {fmtBRL(aggResult.totalDeposit)}
            </Text>
          </View>
        )}

        {aggResult.topCategory && (
          <View style={[styles.kpiCard, { borderColor: '#f59e0b' }]}>
            <Text style={styles.kpiLabel}>Maior Categoria</Text>
            <Text style={[styles.kpiValue, { color: '#fbbf24', fontSize: 14 }]} numberOfLines={1}>
              {aggResult.topCategory.name} ({aggResult.topCategory.pct}%)
            </Text>
          </View>
        )}
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
      <View style={styles.chartCard}>
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
            {aggResult.points.length} pontos plotados • Clique em qualquer elemento para abrir o Raio-X
          </Text>
        </View>

        {!hasData ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>Nenhum dado encontrado para este filtro</Text>
            <Text style={styles.emptySubtitle}>
              Tente selecionar outro mês, ano ou remover filtros de categoria no painel acima.
            </Text>
          </View>
        ) : (
          <div style={{ width: '100%', height: 420, minHeight: 420, position: 'relative' }}>
            <ResponsiveContainer width="100%" height={420}>
              {config.visualType === 'donut' ? (
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(val) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{val}</span>}
                  />
                  <Pie
                    data={aggResult.donutSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={70}
                    outerRadius={125}
                    paddingAngle={3}
                    cursor="pointer"
                    onClick={(entry: any) => {
                      if (entry && (entry.name || entry.payload?.name)) {
                        handlePieSliceClick((entry.payload || entry) as ChartCategorySlice);
                      }
                    }}
                  >
                    {aggResult.donutSlices.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || CHART_PALETTE[index % CHART_PALETTE.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              ) : config.visualType === 'line_area' ? (
                <AreaChart
                  data={aggResult.points}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      handlePointClick(e.activePayload[0].payload as ChartDataPoint);
                    }
                  }}
                  cursor="pointer"
                >
                  <defs>
                    <linearGradient id="areaRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="areaExpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="areaBalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    tickFormatter={fmtBRLCompact}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(val) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{val}</span>}
                  />
                  {config.activeMetrics.includes('revenue') && (
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Receitas"
                      stroke="#10b981"
                      fill="url(#areaRevGrad)"
                      strokeWidth={2}
                    />
                  )}
                  {config.activeMetrics.includes('expense') && (
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Custos"
                      stroke="#ef4444"
                      fill="url(#areaExpGrad)"
                      strokeWidth={2}
                    />
                  )}
                  {config.activeMetrics.includes('balance') && (
                    <Area
                      type="monotone"
                      dataKey="balance"
                      name="Saldo Líquido"
                      stroke="#8b5cf6"
                      fill="url(#areaBalGrad)"
                      strokeWidth={2.5}
                    />
                  )}
                  {config.showGoals && (
                    <ReferenceLine
                      y={aggResult.points[0]?.goal || 0}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: 'Meta', fill: '#f59e0b', fontSize: 11 }}
                    />
                  )}
                </AreaChart>
              ) : config.visualType === 'bar' ? (
                <BarChart
                  data={aggResult.points}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      handlePointClick(e.activePayload[0].payload as ChartDataPoint);
                    }
                  }}
                  cursor="pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    tickFormatter={fmtBRLCompact}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(val) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{val}</span>}
                  />
                  {config.activeMetrics.includes('revenue') && (
                    <Bar
                      dataKey="revenue"
                      name="Receitas"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {config.activeMetrics.includes('expense') && (
                    <Bar
                      dataKey="expense"
                      name="Custos"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {config.activeMetrics.includes('deposit') && (
                    <Bar
                      dataKey="deposit"
                      name="Aportes"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {config.activeMetrics.includes('waiver') && (
                    <Bar
                      dataKey="waiver"
                      name="Abonos"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                </BarChart>
              ) : (
                /* 'composed' default */
                <ComposedChart
                  data={aggResult.points}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      handlePointClick(e.activePayload[0].payload as ChartDataPoint);
                    }
                  }}
                  cursor="pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    tickFormatter={fmtBRLCompact}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(val) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{val}</span>}
                  />
                  {config.activeMetrics.includes('revenue') && (
                    <Bar
                      dataKey="revenue"
                      name="Receitas"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {config.activeMetrics.includes('expense') && (
                    <Bar
                      dataKey="expense"
                      name="Custos"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {config.activeMetrics.includes('deposit') && (
                    <Bar
                      dataKey="deposit"
                      name="Aportes"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {config.activeMetrics.includes('balance') && (
                    <Line
                      type="monotone"
                      dataKey="balance"
                      name="Saldo Líquido"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#8b5cf6' }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                  {config.cumulativeBalance && (
                    <Line
                      type="monotone"
                      dataKey="cumulativeBalance"
                      name="Saldo Acumulado"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  )}
                  {config.showGoals && (
                    <ReferenceLine
                      y={aggResult.points[0]?.goal || 0}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: 'Meta', fill: '#f59e0b', fontSize: 11 }}
                    />
                  )}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </View>

      {/* ── X-Ray Drill-down Transaction Panel ── */}
      <View style={styles.drillDownContainer}>
        {selectedDrillDownKey ? (
          <View style={styles.drillDownCard}>
            <View style={styles.drillDownHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.drillDownTitle}>
                  🔬 Raio-X de Lançamentos: {selectedDrillDownTitle}
                </Text>
                <Text style={styles.drillDownSubtitle}>
                  {drillDownRows.length} lançamento(s) correspondente(s)
                </Text>
              </View>
              <Pressable style={styles.closeDrillBtn} onPress={clearDrillDown}>
                <Text style={styles.closeDrillBtnText}>✕ Fechar Raio-X</Text>
              </Pressable>
            </View>

            {drillDownRows.length === 0 ? (
              <Text style={styles.noDrillRowsText}>Nenhum detalhe de lançamento encontrado.</Text>
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
              <Text style={styles.drillHintTitle}>Exploração Interativa Ativada</Text>
              <Text style={styles.drillHintText}>
                Clique em qualquer barra, linha ou fatia do gráfico para abrir instantaneamente o painel de raio-x e inspecionar todas as transações que compõem aquele valor.
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
    gap: spacing.lg,
  },

  // KPI Bar
  kpiBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'monospace',
  },

  // Main Chart Card
  chartCard: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chartHeader: {
    marginBottom: spacing.xs,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 400,
  },

  // Drill-down Panel
  drillDownContainer: {
    marginTop: spacing.xs,
  },
  drillDownCard: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  drillDownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingBottom: spacing.sm,
  },
  drillDownTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#c084fc',
  },
  drillDownSubtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  closeDrillBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  closeDrillBtnText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  noDrillRowsText: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
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
    gap: 3,
  },
  drillRowBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  drillRowDate: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontFamily: 'monospace',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  drillRowDesc: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  drillRowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  drillRowValue: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  drillRowActions: {
    flexDirection: 'row',
    gap: 4,
  },
  drillActionBtn: {
    padding: 3,
  },
  drillActionText: {
    fontSize: 12,
  },

  // Drill Hint
  drillHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  drillHintIcon: {
    fontSize: 24,
  },
  drillHintTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#93c5fd',
    marginBottom: 2,
  },
  drillHintText: {
    fontSize: 12,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
});
