import type { TableMetrics, CoinTable, TableRow } from '../types';
import { formatCurrencyShort, formatCurrencyFull } from '../utils/formatCurrency';

interface MetricsPanelProps {
  metrics: TableMetrics;
  dailyGoal: number;
  /** The full table — needed to compute month-scoped expense totals. */
  table: CoinTable;
  /** Currently selected month ("YYYY-MM") from the global month filter. */
  selectedMonth: string;
}

// ── Prorated Accrual Helpers (Regime de Competência) ──────────────────────────

/** Exact calendar days in a given month (1-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Inclusive day count between two YYYY-MM-DD strings. */
function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T12:00:00').getTime();
  const msB = new Date(b + 'T12:00:00').getTime();
  return Math.max(1, Math.round(Math.abs(msB - msA) / 86_400_000) + 1);
}

/** YYYY-MM-DD for the first day of a month. */
function monthFirstDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
/** YYYY-MM-DD for the last day of a month. */
function monthLastDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
}

interface ProratedExpense {
  row: TableRow;
  /** This expense's prorated contribution to the selected month. */
  monthlyContribution: number;
}

/**
 * Prorated accrual engine.
 *
 * For each expense row:
 *   1. Resolve lifespan: [periodStart, periodEnd] or single-day at row.date.
 *   2. Check overlap with the target month.
 *   3. dailyRate = row.value / totalLifespanDays
 *   4. activeDays = overlap between expense lifespan and month window
 *   5. monthlyContribution = dailyRate × activeDays
 */
function prorateExpensesForMonth(
  rows: TableRow[],
  selectedMonth: string,
): ProratedExpense[] {
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const mStart = monthFirstDay(selY, selM);
  const mEnd   = monthLastDay(selY, selM);

  const results: ProratedExpense[] = [];

  for (const r of rows) {
    if (r.entryType !== 'expense') continue;

    // Resolve expense lifespan boundaries
    const expStart = r.periodStart || r.date;
    const expEnd   = r.periodEnd   || r.date;

    // Overlap check: expense must touch the month window
    if (expStart > mEnd || expEnd < mStart) continue;

    // Clamp to month boundaries
    const overlapStart = expStart < mStart ? mStart : expStart;
    const overlapEnd   = expEnd   > mEnd   ? mEnd   : expEnd;

    const totalLifespanDays = daysBetween(expStart, expEnd);
    const activeDaysInMonth = daysBetween(overlapStart, overlapEnd);
    const dailyRate = r.value / totalLifespanDays;
    const monthlyContribution = dailyRate * activeDaysInMonth;

    results.push({ row: r, monthlyContribution });
  }

  return results;
}


/** Shorthand used across all metric cards. Full value shown in tooltip via title attr. */
const fmt = formatCurrencyShort;

type CardStatus = 'accent' | 'success' | 'warning' | 'default';

function MetricCard({
  label,
  value,
  status = 'default',
  sub,
  fullValue,
}: {
  label: string;
  value: string;
  status?: CardStatus;
  sub?: string;
  /** Tooltip: full-precision value shown on hover */
  fullValue?: string;
}) {
  const styles: Record<CardStatus, { wrap: string; text: string }> = {
    accent:  { wrap: 'bg-[#a855f7]/10 border-[#a855f7]/30', text: 'text-[#a855f7]' },
    success: { wrap: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
    warning: { wrap: 'bg-amber-500/10 border-amber-500/30',   text: 'text-amber-400'  },
    default: { wrap: 'bg-white/5 border-white/10',            text: 'text-white'      },
  };
  const s = styles[status];
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 min-w-0 ${s.wrap}`} title={fullValue}>
      <span className="text-xs text-white/50 uppercase tracking-wider leading-tight">{label}</span>
      <span className={`text-xl font-bold font-mono ${s.text} truncate`}>{value}</span>
      {sub && <span className="text-xs text-white/40 leading-tight">{sub}</span>}
    </div>
  );
}

export function MetricsPanel({ metrics, dailyGoal, table, selectedMonth }: MetricsPanelProps) {
  const sortedMonths = Object.keys(metrics.byMonth).sort().reverse().slice(0, 3);

  // ── Prorated monthly expenses (Regime de Competência) ─────────────────────
  const [selYear, selMon] = selectedMonth.split('-').map(Number);
  const proratedExpenses = prorateExpensesForMonth(table.rows, selectedMonth);
  const monthlyExpenseTotal = proratedExpenses.reduce((s, e) => s + e.monthlyContribution, 0);
  const monthDays = daysInMonth(selYear, selMon);
  const expenseDailyAvg  = monthDays > 0 ? monthlyExpenseTotal / monthDays : 0;
  const expenseWeeklyAvg = expenseDailyAvg * 7;
  const selectedMonthMetrics = metrics.byMonth[selectedMonth] ?? null;

  // ── Annual data for selected year ───────────────────────────────────────
  const selectedYearStr = String(selYear);
  const yearMetrics = metrics.byYear[selectedYearStr] ?? null;

  function formatMonth(ym: string): string {
    const [y, m] = ym.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  return (
    <div className="space-y-4">
      {/* ── Totais Globais — Operacionais (pure revenue/expense) ── */}
      <div>
        <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
          <span className="w-4 h-px bg-white/20 inline-block" />
          Totais Operacionais
          <span className="flex-1 h-px bg-white/10 inline-block" />
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Receita Operacional"
            value={fmt(metrics.grossTotal)}
            fullValue={formatCurrencyFull(metrics.grossTotal)}
            status="accent"
          />
          {metrics.totalExpenses > 0 && (
            <MetricCard
              label="Custos Operacionais"
              value={fmt(metrics.totalExpenses)}
              fullValue={formatCurrencyFull(metrics.totalExpenses)}
              status="warning"
              sub="custos próprios"
            />
          )}
          {metrics.totalExpenses > 0 && (
            <MetricCard
              label="Saldo Operacional"
              value={fmt(metrics.netBalance)}
              fullValue={formatCurrencyFull(metrics.netBalance)}
              status={metrics.netBalance >= 0 ? 'success' : 'warning'}
              sub={metrics.netBalance >= 0 ? '✓ receitas > custos' : '⚠ custos > receitas'}
            />
          )}
        </div>
      </div>

      {/* ── Totais com Parceria (only when partnership entries exist) ── */}
      {(metrics.totalPartnerIn > 0 || metrics.totalPartnerOut > 0) && (
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
            <span className="w-4 h-px bg-white/20 inline-block" />
            Totais com Parceria
            <span className="flex-1 h-px bg-white/10 inline-block" />
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard
              label="Receita + Créditos"
              value={fmt(metrics.grossWithPartner)}
              fullValue={formatCurrencyFull(metrics.grossWithPartner)}
              status="accent"
              sub={`créditos: ${fmt(metrics.totalPartnerIn)}`}
            />
            {metrics.expensesWithPartner > 0 && (
              <MetricCard
                label="Custos + Débitos"
                value={fmt(metrics.expensesWithPartner)}
                fullValue={formatCurrencyFull(metrics.expensesWithPartner)}
                status="warning"
                sub={`débitos: ${fmt(metrics.totalPartnerOut)}`}
              />
            )}
            <MetricCard
              label="Saldo c/ Parceria"
              value={fmt(metrics.netWithPartner)}
              fullValue={formatCurrencyFull(metrics.netWithPartner)}
              status={metrics.netWithPartner >= 0 ? 'success' : 'warning'}
              sub="inclui parceria"
            />
          </div>
        </div>
      )}

      {/* ── Médias Globais (consolidated — single place for averages) ── */}
      <div>
        <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
          <span className="w-4 h-px bg-white/20 inline-block" />
          Médias Globais
          <span className="flex-1 h-px bg-white/10 inline-block" />
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Média Diária"
            value={fmt(metrics.globalDailyAvg)}
            fullValue={formatCurrencyFull(metrics.globalDailyAvg)}
            status={
              metrics.globalDailyAvg === 0
                ? 'default'
                : metrics.globalDailyAvg >= dailyGoal
                  ? 'success'
                  : 'warning'
            }
            sub={
              metrics.globalDailyAvg >= dailyGoal && metrics.globalDailyAvg > 0
                ? '✓ meta atingida'
                : 'base calendário'
            }
          />
          <MetricCard
            label="Média Semanal"
            value={fmt(metrics.globalWeeklyAvg)}
            fullValue={formatCurrencyFull(metrics.globalWeeklyAvg)}
            sub="semanas ISO"
          />
          <MetricCard
            label="Média Mensal"
            value={fmt(metrics.globalMonthlyAvg)}
            fullValue={formatCurrencyFull(metrics.globalMonthlyAvg)}
            sub="meses ativos"
          />
          {/* Time Bank — placed here to avoid isolated card */}
          {metrics.grossTotal > 0 && (() => {
            const tb = metrics.timeBankBalance;
            const positive = tb >= 0;
            const absW = Math.abs(tb).toFixed(1);
            return (
              <MetricCard
                label="Banco de Horas"
                value={`${positive ? '+' : ''}${tb.toFixed(1)} semanas`}
                status={positive ? 'success' : 'warning'}
                sub={
                  positive
                    ? `✅ ${absW} semana${parseFloat(absW) !== 1 ? 's' : ''} adiantadas`
                    : `🚨 ${absW} semana${parseFloat(absW) !== 1 ? 's' : ''} pendentes`
                }
              />
            );
          })()}
        </div>
      </div>

      {/* ── Year-scoped metrics ── */}
      {yearMetrics && (
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
            <span className="w-4 h-px bg-white/20 inline-block" />
            Métricas de {selectedYearStr}
            <span className="flex-1 h-px bg-white/10 inline-block" />
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard
              label={`Total Bruto ${selectedYearStr}`}
              value={fmt(yearMetrics.grossAnnual)}
              fullValue={formatCurrencyFull(yearMetrics.grossAnnual)}
              status="accent"
              sub={`receitas de ${selectedYearStr}`}
            />
            <MetricCard
              label={`Custo Anual ${selectedYearStr}`}
              value={fmt(yearMetrics.yearExpenses)}
              fullValue={formatCurrencyFull(yearMetrics.yearExpenses)}
              status={yearMetrics.yearExpenses > 0 ? 'warning' : 'default'}
              sub="despesas alocadas ao ano"
            />
            <MetricCard
              label="Diária do Ano"
              value={fmt(yearMetrics.dailyAvg)}
              fullValue={formatCurrencyFull(yearMetrics.dailyAvg)}
              sub={`span do ano ${selectedYearStr}`}
            />
            <MetricCard
              label="Semanal do Ano"
              value={fmt(yearMetrics.weeklyAvg)}
              fullValue={formatCurrencyFull(yearMetrics.weeklyAvg)}
              sub="bruto ÷ semanas ativas"
            />
            <MetricCard
              label="Mensal do Ano"
              value={fmt(yearMetrics.monthlyAvg)}
              fullValue={formatCurrencyFull(yearMetrics.monthlyAvg)}
              sub="bruto ÷ meses ativos"
            />
            {/* Cost coverage — placed inside year grid */}
            {metrics.survivalAnnualCost > 0 && (() => {
              const yearGross = yearMetrics.grossAnnual;
              const coveragePct = metrics.survivalAnnualCost > 0
                ? Math.round((yearGross / metrics.survivalAnnualCost) * 1000) / 10
                : 0;
              const covered = coveragePct >= 100;
              return (
                <MetricCard
                  label="Cobertura de Custos"
                  value={`${coveragePct.toFixed(1)}%`}
                  status={covered ? 'success' : 'warning'}
                  sub={
                    covered
                      ? `✅ Custos cobertos! Saldo é lucro`
                      : `⚡ ${formatCurrencyShort(yearGross)} de ${formatCurrencyShort(metrics.survivalAnnualCost)}`
                  }
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Survival Goals (compact row, better contrast) ── */}
      {metrics.survivalDaily > 0 && (
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
            <span className="w-4 h-px bg-white/20 inline-block" />
            🛡️ Metas de Sobrevivência
            <span className="flex-1 h-px bg-white/10 inline-block" />
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="🛡️ Diária"
              value={fmt(metrics.survivalDaily)}
              fullValue={formatCurrencyFull(metrics.survivalDaily)}
              sub="custos globais ÷ dias"
            />
            <MetricCard
              label="🛡️ Semanal"
              value={fmt(metrics.survivalWeekly)}
              fullValue={formatCurrencyFull(metrics.survivalWeekly)}
              sub="diária × 7"
            />
            <MetricCard
              label="🛡️ Mensal"
              value={fmt(metrics.survivalMonthly)}
              fullValue={formatCurrencyFull(metrics.survivalMonthly)}
              sub={`30.44 dias × ${fmt(metrics.survivalDaily)}/dia`}
            />
          </div>
        </div>
      )}

      {/* ── Selected month — Income breakdown ── */}
      {selectedMonthMetrics && (
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
            <span className="w-4 h-px bg-white/20 inline-block" />
            {formatMonth(selectedMonth)}
            <span className="flex-1 h-px bg-white/10 inline-block" />
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Bruto do Mês" value={fmt(selectedMonthMetrics.grossMonthly)} />
            <MetricCard label="Média Diária" value={fmt(selectedMonthMetrics.dailyAvg)} />
            <MetricCard label="Média Semanal" value={fmt(selectedMonthMetrics.weeklyAvg)} />
            <MetricCard
              label="Última Semana"
              value={fmt(selectedMonthMetrics.lastWeekGross)}
              sub="semana ISO"
            />
          </div>
        </div>
      )}

      {/* ── Selected month — Expense breakdown ── */}
      {monthlyExpenseTotal > 0 && (
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
            <span className="w-4 h-px bg-amber-400/30 inline-block" />
            Gastos de {formatMonth(selectedMonth)}
            <span className="flex-1 h-px bg-white/10 inline-block" />
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Total Gasto Mensal"
              value={`-${fmt(monthlyExpenseTotal)}`}
              fullValue={`-${formatCurrencyFull(monthlyExpenseTotal)}`}
              status="warning"
              sub={`${proratedExpenses.length} despesa${proratedExpenses.length !== 1 ? 's' : ''} rateada${proratedExpenses.length !== 1 ? 's' : ''}`}
            />
            <MetricCard
              label="Gasto Diário"
              value={`-${fmt(expenseDailyAvg)}`}
              fullValue={`-${formatCurrencyFull(expenseDailyAvg)}`}
              status="warning"
              sub={`÷ ${monthDays} dias`}
            />
            <MetricCard
              label="Gasto Semanal"
              value={`-${fmt(expenseWeeklyAvg)}`}
              fullValue={`-${formatCurrencyFull(expenseWeeklyAvg)}`}
              status="warning"
              sub="diária × 7"
            />
          </div>
        </div>
      )}

      {/* ── Recent months mini-list ── */}
      {sortedMonths.length > 1 && (
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
            <span className="w-4 h-px bg-white/20 inline-block" />
            Histórico Recente
            <span className="flex-1 h-px bg-white/10 inline-block" />
          </h3>
          <div className="space-y-2">
            {sortedMonths.map((ym) => {
              const m = metrics.byMonth[ym];
              return (
                <div
                  key={ym}
                  className="flex items-center justify-between px-4 py-2 rounded-lg bg-white/5 border border-white/5"
                >
                  <span className="text-sm text-white/60 capitalize">{formatMonth(ym)}</span>
                  <div className="flex gap-6 text-right">
                    <div>
                      <div className="text-xs text-white/40">Bruto</div>
                      <div className="text-sm font-mono text-white/80">{fmt(m.grossMonthly)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/40">Diária</div>
                      <div
                        className={`text-sm font-mono font-medium ${
                          m.dailyAvg >= dailyGoal ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {fmt(m.dailyAvg)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
