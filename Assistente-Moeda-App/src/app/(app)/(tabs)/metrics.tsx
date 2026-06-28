/**
 * Metrics Tab — Assistente Moeda
 *
 * Displays computed financial metrics in a responsive card grid:
 *   - Gross Revenue, Daily/Weekly/Monthly/Annual averages
 *   - Goal Balance, Time Bank, Net Balance
 *   - Expense survival metrics
 *   - Investment portfolio summary
 *   - Statistical insights (max, min, median, mode, std dev)
 *
 * All metrics come from the pure computeMetrics engine via useCoinDB.
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useCoinDB } from '@/hooks/useCoinDB';
import { MetricCard, MetricGrid } from '@/components/ui/MetricCard';
import { Card } from '@/components/ui/Card';
import { formatCurrencySmart } from '@/core/formatCurrency';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { computeMetrics, emptyMetrics } from '@/core/metricsEngine';
import { getDailyGoalForDate } from '@/core/dateUtils';
import { CategorySummary, AddRowModal } from '@/components/ui';
import type { TableRow } from '@/core/types';
import { PieChart } from 'react-native-gifted-charts';

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T12:00:00').getTime();
  const msB = new Date(b + 'T12:00:00').getTime();
  return Math.max(1, Math.round(Math.abs(msB - msA) / 86_400_000) + 1);
}

function calculateStats(rows: TableRow[], fallbackDays: number) {
  if (rows.length === 0) {
    return { sum: 0, count: 0, mean: 0, median: 0, mode: 0, stdDev: 0, max: 0, min: 0, dailyAvg: 0, weeklyAvg: 0 };
  }
  const values = rows.map(r => r.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const count = values.length;
  const mean = sum / count;

  // Median
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // Mode
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let mode = sorted[0];
  for (const v of sorted) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxCount) {
      maxCount = counts[v];
      mode = v;
    }
  }

  // Std Dev
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  const max = Math.max(...values);
  const min = Math.min(...values);

  // Category average daily rate calculations
  let totalDailyRate = 0;
  for (const row of rows) {
    const hasPeriod = !!(row.periodStart && row.periodEnd);
    if (hasPeriod) {
      const txDays = daysBetween(row.periodStart!, row.periodEnd!);
      totalDailyRate += (row.value / txDays);
    } else {
      totalDailyRate += (row.value / fallbackDays);
    }
  }
  const dailyAvg = totalDailyRate;
  const weeklyAvg = totalDailyRate * 7;

  return { sum, count, mean, median, mode, stdDev, max, min, dailyAvg, weeklyAvg };
}

export default function MetricsScreen() {
  const db = useCoinDB();
  const { metrics, activeTable, selectedMonth, setSelectedMonth, availableMonths, cutoffDate } = db;
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);

  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Reset category selectors when month is changed
  useMemo(() => {
    setSelectedMacro(null);
    setSelectedCategory(null);
  }, [selectedMonth]);

  const handleEditRow = (row: TableRow) => {
    setEditingRow(row);
    setShowAddModal(true);
  };

  // Level 1: Macro categories (Receitas, Custos, Aportes, Parceria, Abonos)
  const macroSums = useMemo(() => {
    let receitas = 0;
    let custos = 0;
    let aportes = 0;
    let parceria = 0;
    let abonos = 0;

    for (const r of db.filteredRows || []) {
      const type = r.entryType || 'revenue';
      if (type === 'revenue') {
        receitas += r.value;
      } else if (type === 'expense') {
        custos += r.value;
      } else if (type === 'deposit') {
        aportes += r.value;
      } else if (type === 'partner_in' || type === 'partner_out') {
        parceria += r.value;
      } else if (type === 'waiver') {
        abonos += r.value;
      }
    }
    return { receitas, custos, aportes, parceria, abonos };
  }, [db.filteredRows]);

  const macroPieData = useMemo(() => {
    const data: any[] = [];
    const { receitas, custos, aportes, parceria, abonos } = macroSums;
    const total = receitas + custos + aportes + parceria + abonos;
    if (total === 0) return [];

    if (receitas > 0) {
      data.push({
        value: receitas,
        color: '#10b981',
        label: 'Receitas',
        text: `${Math.round((receitas / total) * 100)}%`,
        focused: selectedMacro === 'Receitas',
      });
    }
    if (custos > 0) {
      data.push({
        value: custos,
        color: '#ef4444',
        label: 'Custos',
        text: `${Math.round((custos / total) * 100)}%`,
        focused: selectedMacro === 'Custos',
      });
    }
    if (aportes > 0) {
      data.push({
        value: aportes,
        color: '#3b82f6',
        label: 'Aportes',
        text: `${Math.round((aportes / total) * 100)}%`,
        focused: selectedMacro === 'Aportes',
      });
    }
    if (parceria > 0) {
      data.push({
        value: parceria,
        color: '#8b5cf6',
        label: 'Parceria',
        text: `${Math.round((parceria / total) * 100)}%`,
        focused: selectedMacro === 'Parceria',
      });
    }
    if (abonos > 0) {
      data.push({
        value: abonos,
        color: '#f59e0b',
        label: 'Abonos',
        text: `${Math.round((abonos / total) * 100)}%`,
        focused: selectedMacro === 'Abonos',
      });
    }
    return data;
  }, [macroSums, selectedMacro]);

  // Level 2: Micro categories (filtered by selectedMacro and grouped by description)
  const macroFilteredRows = useMemo(() => {
    if (!selectedMacro) return [];
    return (db.filteredRows || []).filter(r => {
      const type = r.entryType || 'revenue';
      if (selectedMacro === 'Receitas') return type === 'revenue';
      if (selectedMacro === 'Custos') return type === 'expense';
      if (selectedMacro === 'Aportes') return type === 'deposit';
      if (selectedMacro === 'Parceria') return type === 'partner_in' || type === 'partner_out';
      if (selectedMacro === 'Abonos') return type === 'waiver';
      return false;
    });
  }, [db.filteredRows, selectedMacro]);

  const microGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const r of macroFilteredRows) {
      const desc = (r.description || 'Sem Descrição').trim() || 'Sem Descrição';
      groups[desc] = (groups[desc] || 0) + r.value;
    }
    return groups;
  }, [macroFilteredRows]);

  const microPieData = useMemo(() => {
    const data: any[] = [];
    const entries = Object.entries(microGroups).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((acc, curr) => acc + curr[1], 0);
    if (total === 0) return [];

    const colorsPalette = ['#ef4444', '#f97316', '#facc15', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#84cc16'];

    entries.forEach(([label, value], idx) => {
      if (value > 0) {
        const color = colorsPalette[idx % colorsPalette.length];
        data.push({
          value,
          color,
          label,
          text: `${Math.round((value / total) * 100)}%`,
          focused: selectedCategory === label,
        });
      }
    });
    return data;
  }, [microGroups, selectedCategory]);

  // Level 3: Category X-Ray calculations
  const categoryRows = useMemo(() => {
    if (!selectedCategory) return [];
    return macroFilteredRows.filter(r => ((r.description || 'Sem Descrição').trim() || 'Sem Descrição') === selectedCategory);
  }, [macroFilteredRows, selectedCategory]);

  const fallbackDays = useMemo(() => {
    if (selectedMonth === 'all') {
      if (!activeTable || activeTable.rows.length === 0) return 1;
      const dates = activeTable.rows.map(r => r.date).filter(Boolean).sort();
      const oldest = dates[0] || new Date().toISOString().slice(0, 10);
      const start = new Date(oldest);
      const end = new Date();
      const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, diff);
    } else {
      const [y, m] = selectedMonth.split('-').map(Number);
      return new Date(y, m, 0).getDate();
    }
  }, [selectedMonth, activeTable]);

  const categoryStats = useMemo(() => {
    if (categoryRows.length === 0) return null;
    return calculateStats(categoryRows, fallbackDays);
  }, [categoryRows, fallbackDays]);

  // Resolve month-scoped metrics if filtered
  const selectedMonthMetrics = selectedMonth !== 'all' ? metrics.byMonth[selectedMonth] || null : null;
  const selectedYearStr = selectedMonth !== 'all' ? selectedMonth.slice(0, 4) : '';
  const yearMetrics = selectedYearStr ? metrics.byYear[selectedYearStr] || null : null;

  // Monthly expense details
  const monthlyExpenseTotal = selectedMonthMetrics?.expense ?? 0;
  const monthDays = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'all') return 0;
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth]);

  const expenseDailyAvg = monthDays > 0 ? monthlyExpenseTotal / monthDays : 0;
  const expenseWeeklyAvg = expenseDailyAvg * 7;

  if (!activeTable || activeTable.rows.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.header}>
          <Text style={styles.title}>📊 Métricas</Text>
          <Text style={styles.subtitle}>Seus indicadores financeiros</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>Adicione dados primeiro</Text>
          <Text style={styles.emptyText}>
            As métricas serão calculadas automaticamente quando você adicionar entradas na Planilha.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const m = metrics;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Métricas</Text>
        <Text style={styles.subtitle}>{activeTable.name}</Text>
      </View>

      {/* Month Picker */}
      {availableMonths.length > 0 && (
        <MonthPicker
          months={availableMonths}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Dashboard BI Interativo (Progressive Drill-Down) ── */}
        <SectionTitle title="📊 Dashboard BI Interativo" />
        <Card style={styles.biCard}>
          {selectedCategory ? (
            /* Level 3: Category X-Ray View */
            <View style={styles.xrayContainer}>
              <View style={styles.xrayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.xrayTitle}>🔍 Raio-X: {selectedCategory}</Text>
                  <Text style={styles.xraySubtitle}>Detalhamento em {selectedMacro}</Text>
                </View>
                <Pressable
                  style={styles.xrayBackBtn}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text style={styles.xrayBackText}>Voltar</Text>
                </Pressable>
              </View>

              {categoryStats && (
                <View style={styles.statsGrid}>
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Soma Total</Text>
                    <Text style={[styles.statValue, { color: selectedMacro === 'Receitas' ? colors.success.main : colors.danger.main }]}>
                      {formatCurrencySmart(categoryStats.sum)}
                    </Text>
                    <Text style={styles.statCellSub}>
                      {(() => {
                        const macroTotal = selectedMacro === 'Receitas' ? macroSums.receitas :
                                           selectedMacro === 'Custos' ? macroSums.custos :
                                           selectedMacro === 'Aportes' ? macroSums.aportes :
                                           selectedMacro === 'Parceria' ? macroSums.parceria :
                                           macroSums.abonos;
                        const pct = macroTotal > 0 ? (categoryStats.sum / macroTotal) * 100 : 0;
                        return `${pct.toFixed(1)}% do macro`;
                      })()}
                    </Text>
                  </View>

                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Média por Entrada</Text>
                    <Text style={styles.statValue}>{formatCurrencySmart(categoryStats.mean)}</Text>
                    <Text style={styles.statCellSub}>{categoryStats.count} registros</Text>
                  </View>

                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Mediana</Text>
                    <Text style={styles.statValue}>{formatCurrencySmart(categoryStats.median)}</Text>
                  </View>

                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Moda</Text>
                    <Text style={styles.statValue}>{formatCurrencySmart(categoryStats.mode)}</Text>
                  </View>

                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Desvio Padrão</Text>
                    <Text style={styles.statValue}>{formatCurrencySmart(categoryStats.stdDev)}</Text>
                  </View>

                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Média Diária</Text>
                    <Text style={styles.statValue}>{formatCurrencySmart(categoryStats.dailyAvg)}</Text>
                  </View>

                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Média Semanal</Text>
                    <Text style={styles.statValue}>{formatCurrencySmart(categoryStats.weeklyAvg)}</Text>
                  </View>

                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>Mín / Máx</Text>
                    <Text style={styles.statValue}>
                      {formatCurrencySmart(categoryStats.min)} / {formatCurrencySmart(categoryStats.max)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Transactions List */}
              <Text style={styles.xrayListTitle}>Transações desta Categoria</Text>
              <View style={styles.xrayList}>
                {categoryRows.map((row) => (
                  <View key={row.id} style={styles.xrayRow}>
                    <View style={styles.xrayRowLeft}>
                      <Text style={styles.xrayRowDate}>{row.date.split('-').reverse().slice(0, 2).join('/')}</Text>
                      <Text style={styles.xrayRowDesc} numberOfLines={1}>{row.description || 'Sem descrição'}</Text>
                    </View>
                    <View style={styles.xrayRowRight}>
                      <Text style={[styles.xrayRowValue, { color: selectedMacro === 'Receitas' ? colors.success.main : colors.danger.main }]}>
                        {selectedMacro === 'Custos' ? '-' : ''}{formatCurrencySmart(row.value)}
                      </Text>
                      <View style={styles.xrayRowActions}>
                        <Pressable style={styles.xrayRowActionBtn} onPress={() => handleEditRow(row)}>
                          <Text style={{ fontSize: 13 }}>✏️</Text>
                        </Pressable>
                        <Pressable style={styles.xrayRowActionBtn} onPress={() => db.deleteRow(row.id)}>
                          <Text style={{ fontSize: 13 }}>🗑️</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : selectedMacro ? (
            /* Level 2: Micro / Category view */
            <View style={styles.chartContainer}>
              <View style={styles.xrayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chartTitle}>🔍 Categorias: {selectedMacro}</Text>
                  <Text style={styles.chartSubtitle}>Clique em uma fatia para abrir o Raio-X</Text>
                </View>
                <Pressable
                  style={styles.xrayBackBtn}
                  onPress={() => setSelectedMacro(null)}
                >
                  <Text style={styles.xrayBackText}>Voltar</Text>
                </Pressable>
              </View>

              {microPieData.length > 0 ? (
                <View style={styles.chartRow}>
                  <View style={styles.pieWrapper}>
                    <PieChart
                      data={microPieData}
                      donut
                      showText
                      textColor="#111"
                      textSize={9}
                      radius={65}
                      innerRadius={40}
                      onPress={(item: any) => setSelectedCategory(item.label)}
                    />
                  </View>
                  <View style={styles.legendList}>
                    {microPieData.map((item, idx) => (
                      <Pressable
                        key={idx}
                        style={styles.legendItem}
                        onPress={() => setSelectedCategory(item.label)}
                      >
                        <View style={[styles.legendIndicator, { backgroundColor: item.color }]} />
                        <Text style={styles.legendLabel} numberOfLines={1}>
                          {item.label} ({item.text})
                        </Text>
                        <Text style={styles.legendValue}>{formatCurrencySmart(item.value)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.noDataText}>Nenhum dado para exibir nesta categoria.</Text>
              )}
            </View>
          ) : (
            /* Level 1: Macro overview */
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>📊 Visão Geral das Finanças</Text>
              <Text style={styles.chartSubtitle}>Selecione um macro-grupo para detalhar</Text>

              {macroPieData.length > 0 ? (
                <View style={styles.chartRow}>
                  <View style={styles.pieWrapper}>
                    <PieChart
                      data={macroPieData}
                      donut
                      showText
                      textColor="#111"
                      textSize={9}
                      radius={65}
                      innerRadius={40}
                      onPress={(item: any) => setSelectedMacro(item.label)}
                    />
                  </View>
                  <View style={styles.legendList}>
                    {macroPieData.map((item, idx) => (
                      <Pressable
                        key={idx}
                        style={styles.legendItem}
                        onPress={() => setSelectedMacro(item.label)}
                      >
                        <View style={[styles.legendIndicator, { backgroundColor: item.color }]} />
                        <Text style={styles.legendLabel}>
                          {item.label} ({item.text})
                        </Text>
                        <Text style={styles.legendValue}>{formatCurrencySmart(item.value)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.noDataText}>Sem dados financeiros no mês selecionado.</Text>
              )}
            </View>
          )}
        </Card>

        {/* ── Month/Year Scoped Metrics (if filtered) ── */}
        {selectedMonth !== 'all' && yearMetrics && (
          <>
            <SectionTitle title={`📅 Métricas de ${selectedYearStr}`} />
            <MetricGrid>
              <MetricCard
                icon="📅"
                label={`Total Anual ${selectedYearStr}`}
                value={formatCurrencySmart(yearMetrics.grossAnnual)}
                accentColor={colors.success.main}
                subtitle={`receitas de ${selectedYearStr}`}
              />
              <MetricCard
                icon="💸"
                label={`Custo Anual ${selectedYearStr}`}
                value={formatCurrencySmart(yearMetrics.yearExpenses)}
                accentColor={yearMetrics.yearExpenses > 0 ? colors.danger.main : colors.text.disabled}
                subtitle="despesas alocadas ao ano"
              />
              <MetricCard
                icon="📅"
                label="Diária do Ano"
                value={formatCurrencySmart(yearMetrics.dailyAvg)}
                accentColor={colors.info.main}
                subtitle={`span do ano ${selectedYearStr}`}
              />
              <MetricCard
                icon="📆"
                label="Semanal do Ano"
                value={formatCurrencySmart(yearMetrics.weeklyAvg)}
                accentColor={colors.info.main}
                subtitle="bruto ÷ semanas ativas"
              />
              <MetricCard
                icon="🗓️"
                label="Mensal do Ano"
                value={formatCurrencySmart(yearMetrics.monthlyAvg)}
                accentColor={colors.info.main}
                subtitle="bruto ÷ meses ativos"
              />
              {metrics.survivalAnnualCost > 0 && (() => {
                const coveragePct = metrics.survivalAnnualCost > 0
                  ? Math.round((yearMetrics.grossAnnual / metrics.survivalAnnualCost) * 1000) / 10
                  : 0;
                const covered = coveragePct >= 100;
                return (
                  <MetricCard
                    icon="🛡️"
                    label="Cobertura de Custos"
                    value={`${coveragePct.toFixed(1)}%`}
                    accentColor={covered ? colors.success.main : colors.warning.main}
                    subtitle={covered ? '✓ Custos cobertos' : `Faltam ${formatCurrencySmart(metrics.survivalAnnualCost - yearMetrics.grossAnnual)}`}
                  />
                );
              })()}
            </MetricGrid>
          </>
        )}

        {selectedMonth !== 'all' && selectedMonthMetrics && (
          <>
            <SectionTitle title={`📈 Receitas de ${formatMonthLabel(selectedMonth)}`} />
            <MetricGrid>
              <MetricCard
                icon="💵"
                label="Total Recebido Mensal"
                value={formatCurrencySmart(selectedMonthMetrics.grossMonthly)}
                accentColor={colors.success.main}
                subtitle="receita operacional"
              />
              {(() => {
                const targetDateKey = `${selectedMonth}-01`;
                const dailyGoal = getDailyGoalForDate(targetDateKey, activeTable.goals);
                const diff = selectedMonthMetrics.dailyAvg - dailyGoal;
                const met = diff >= 0;
                return (
                  <MetricCard
                    icon="📅"
                    label="Receita Diária Média"
                    value={`${formatCurrencySmart(selectedMonthMetrics.dailyAvg)}/dia`}
                    accentColor={dailyGoal === 0 ? colors.text.disabled : met ? colors.success.main : colors.warning.main}
                    subtitle={dailyGoal === 0 ? 'sem meta' : met ? '✓ Meta atingida' : `Faltam ${formatCurrencySmart(Math.abs(diff))}`}
                  />
                );
              })()}
              {(() => {
                const diff = selectedMonthMetrics.dailyAvg - metrics.survivalDaily;
                const met = diff >= 0;
                return (
                  <MetricCard
                    icon="🛡️"
                    label="Receita Semanal Média"
                    value={`${formatCurrencySmart(selectedMonthMetrics.weeklyAvg)}/sem`}
                    accentColor={metrics.survivalDaily === 0 ? colors.text.disabled : met ? colors.success.main : colors.warning.main}
                    subtitle={metrics.survivalDaily === 0 ? 'sem custos' : met ? '🛡️ Sobrevivência atingida' : `Faltam ${formatCurrencySmart(Math.abs(diff * 7))}`}
                  />
                );
              })()}
            </MetricGrid>

            <SectionTitle title={`📉 Gastos de ${formatMonthLabel(selectedMonth)}`} />
            {monthlyExpenseTotal > 0 ? (
              <MetricGrid>
                <MetricCard
                  icon="💸"
                  label="Total Gasto Mensal"
                  value={`-${formatCurrencySmart(monthlyExpenseTotal)}`}
                  accentColor={colors.danger.main}
                  subtitle="despesas rateadas"
                />
                <MetricCard
                  icon="📅"
                  label="Gasto Diário"
                  value={`-${formatCurrencySmart(expenseDailyAvg)}`}
                  accentColor={colors.danger.main}
                  subtitle={`÷ ${monthDays} dias`}
                />
                <MetricCard
                  icon="📆"
                  label="Gasto Semanal"
                  value={`-${formatCurrencySmart(expenseWeeklyAvg)}`}
                  accentColor={colors.danger.main}
                  subtitle="diária × 7"
                />
              </MetricGrid>
            ) : (
              <View style={styles.emptyExpenseBox}>
                <Text style={styles.emptyExpenseText}>
                  Nenhuma despesa rateada para este mês.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Revenue Averages ──────────────────────────────── */}
        <SectionTitle title="💰 Receitas Gerais (Período Total)" />
        <MetricGrid>
          <MetricCard
            icon="📦"
            label="Total Bruto"
            value={formatCurrencySmart(m.grossTotal)}
            accentColor={colors.success.main}
          />
          <MetricCard
            icon="📅"
            label="Média Diária"
            value={formatCurrencySmart(m.globalDailyAvg)}
            accentColor={colors.info.main}
          />
          <MetricCard
            icon="📆"
            label="Média Semanal"
            value={formatCurrencySmart(m.globalWeeklyAvg)}
            accentColor={colors.info.main}
          />
          <MetricCard
            icon="🗓️"
            label="Média Mensal"
            value={formatCurrencySmart(m.globalMonthlyAvg)}
            accentColor={colors.info.main}
          />
          <MetricCard
            icon="📊"
            label="Média Anual"
            value={formatCurrencySmart(m.globalAnnualAvg)}
            accentColor={colors.accent.purple}
          />
          <MetricCard
            icon="🏦"
            label="Saldo Líquido"
            value={formatCurrencySmart(m.netBalance)}
            trend={m.netBalance >= 0 ? 'up' : 'down'}
            accentColor={m.netBalance >= 0 ? colors.success.main : colors.danger.main}
          />
        </MetricGrid>

        {/* ── Goals & Time Bank ─────────────────────────────── */}
        <SectionTitle title="🎯 Meta & Banco de Tempo" />
        <MetricGrid>
          <MetricCard
            icon="🎯"
            label="Saldo Meta (R$)"
            value={formatCurrencySmart(m.globalGoalBalance)}
            trend={m.globalGoalBalance >= 0 ? 'up' : 'down'}
            accentColor={m.globalGoalBalance >= 0 ? colors.success.main : colors.danger.main}
          />
          <MetricCard
            icon="⏱️"
            label="Banco de Tempo"
            value={`${m.timeBankBalance > 0 ? '+' : ''}${m.timeBankBalance.toFixed(1)} sem`}
            trend={m.timeBankBalance >= 0 ? 'up' : 'down'}
            accentColor={m.timeBankBalance >= 0 ? colors.success.main : colors.warning.main}
          />
          <MetricCard
            icon="📐"
            label="Semanas Transcorridas"
            value={`${m.totalElapsedWeeks}`}
            accentColor={colors.text.tertiary}
          />
          <MetricCard
            icon="🎁"
            label="Crédito Abonos"
            value={formatCurrencySmart(m.totalWaiverCredit)}
            accentColor={colors.warning.main}
          />
        </MetricGrid>

        {/* ── Expenses & Survival ───────────────────────────── */}
        <SectionTitle title="💸 Despesas & Sobrevivência" />
        <MetricGrid>
          <MetricCard
            icon="💸"
            label="Total Despesas"
            value={formatCurrencySmart(m.totalExpenses)}
            accentColor={colors.danger.main}
          />
          <MetricCard
            icon="🛡️"
            label="Meta Mensal Sobrevivência"
            value={formatCurrencySmart(m.survivalMonthly)}
            accentColor={colors.warning.main}
            subtitle="para cobrir custos"
          />
          <MetricCard
            icon="📅"
            label="Custo Diário"
            value={formatCurrencySmart(m.survivalDaily)}
            accentColor={colors.warning.main}
          />
          <MetricCard
            icon="📆"
            label="Custo Semanal"
            value={formatCurrencySmart(m.survivalWeekly)}
            accentColor={colors.warning.main}
          />
        </MetricGrid>

        {/* ── Investments ───────────────────────────────────── */}
        {m.depositCount > 0 && (
          <>
            <SectionTitle title="🏦 Investimentos" />
            <MetricGrid>
              <MetricCard
                icon="💰"
                label="Total Investido"
                value={formatCurrencySmart(m.totalInvested)}
                accentColor={colors.info.main}
              />
              <MetricCard
                icon="📈"
                label="Rendimento Acum."
                value={formatCurrencySmart(m.totalInterestEarned)}
                accentColor={colors.success.main}
              />
              <MetricCard
                icon="🏦"
                label="Saldo Portfólio"
                value={formatCurrencySmart(m.investmentBalance)}
                accentColor={colors.accent.purple}
              />
              <MetricCard
                icon="🔢"
                label="Aportes"
                value={`${m.depositCount}`}
                accentColor={colors.info.main}
              />
            </MetricGrid>
          </>
        )}

        {/* ── Statistics ────────────────────────────────────── */}
        <SectionTitle title="📐 Estatísticas" />
        <MetricGrid>
          <MetricCard
            icon="⬆️"
            label="Maior Receita"
            value={formatCurrencySmart(m.maxTransaction)}
            accentColor={colors.success.main}
          />
          <MetricCard
            icon="⬇️"
            label="Menor Receita"
            value={formatCurrencySmart(m.minTransaction)}
            accentColor={colors.warning.main}
          />
          <MetricCard
            icon="📊"
            label="Mediana"
            value={formatCurrencySmart(m.medianTransaction)}
            accentColor={colors.info.main}
          />
          <MetricCard
            icon="🔁"
            label="Moda"
            value={formatCurrencySmart(m.modeTransaction)}
            accentColor={colors.text.tertiary}
          />
          <MetricCard
            icon="📏"
            label="Desvio Padrão"
            value={formatCurrencySmart(m.stdDeviation)}
            accentColor={colors.text.tertiary}
          />
        </MetricGrid>

        {/* ── Partners ──────────────────────────────────────── */}
        {(m.totalPartnerIn > 0 || m.totalPartnerOut > 0) && (
          <>
            <SectionTitle title="🤝 Parceria" />
            <MetricGrid>
              <MetricCard
                icon="🤝"
                label="Recebido Sócio"
                value={formatCurrencySmart(m.totalPartnerIn)}
                accentColor="#06b6d4"
              />
              <MetricCard
                icon="📤"
                label="Pago Sócio"
                value={formatCurrencySmart(m.totalPartnerOut)}
                accentColor="#f97316"
              />
              <MetricCard
                icon="📊"
                label="Saldo c/ Parceria"
                value={formatCurrencySmart(m.netWithPartner)}
                trend={m.netWithPartner >= 0 ? 'up' : 'down'}
                accentColor={m.netWithPartner >= 0 ? colors.success.main : colors.danger.main}
              />
            </MetricGrid>
          </>
        )}

        {/* Category Breakdown Section */}
        <CategorySummary
          allRows={activeTable.rows}
          selectedMonth={selectedMonth}
          cutoffDate={cutoffDate}
          onEditRow={handleEditRow}
          onDeleteRow={db.deleteRow}
        />

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Add / Edit Row Modal */}
      <AddRowModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingRow(null);
        }}
        onAdd={(rowOrRows) => {
          if (editingRow) {
            if (!Array.isArray(rowOrRows)) {
              db.updateRow(editingRow.id, rowOrRows);
            }
          } else {
            if (Array.isArray(rowOrRows)) {
              db.addRows(rowOrRows);
            } else {
              db.addRow(rowOrRows);
            }
          }
          setEditingRow(null);
        }}
        editingRow={editingRow}
      />
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx]} ${y}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },

  /* BI Dashboard */
  biCard: {
    backgroundColor: '#1f2937',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  chartContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  chartSubtitle: {
    fontSize: 11,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  pieWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    minHeight: 140,
  },
  legendList: {
    flex: 1,
    minWidth: 180,
    gap: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  noDataText: {
    fontSize: 13,
    color: colors.text.disabled,
    textAlign: 'center',
    marginVertical: spacing.md,
  },

  /* Level 3: X-Ray View */
  xrayContainer: {
    width: '100%',
  },
  xrayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  xrayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  xraySubtitle: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  xrayBackBtn: {
    backgroundColor: colors.background.tertiary || '#374151',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  xrayBackText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statCellSub: {
    fontSize: 10,
    color: colors.text.disabled,
    marginTop: 2,
  },
  xrayListTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  xrayList: {
    gap: spacing.xs,
  },
  xrayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  xrayRowLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  xrayRowDate: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  xrayRowDesc: {
    fontSize: 13,
    color: colors.text.primary,
    marginTop: 2,
  },
  xrayRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  xrayRowValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  xrayRowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  xrayRowActionBtn: {
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radius.sm,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxxl,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  bottomPad: {
    height: spacing.huge,
  },

  emptyExpenseBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.default,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
    marginTop: spacing.xs,
  },
  emptyExpenseText: {
    fontSize: 12,
    color: colors.text.disabled,
  },
});
