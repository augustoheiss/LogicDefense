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
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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

export default function MetricsScreen() {
  const db = useCoinDB();
  const { metrics, activeTable, selectedMonth, setSelectedMonth, availableMonths, cutoffDate } = db;
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);

  const handleEditRow = (row: TableRow) => {
    setEditingRow(row);
    setShowAddModal(true);
  };

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
