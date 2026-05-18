import type { TableMetrics, CostBasedTarget, CoinTable, TableRow } from '../types';
import { formatCurrencyShort, formatCurrencyFull } from '../utils/formatCurrency';

interface MetricsPanelProps {
  metrics: TableMetrics;
  dailyGoal: number;
  costBasedTarget?: CostBasedTarget;
  /** The full table — needed to compute month-scoped expense totals. */
  table: CoinTable;
  /** Currently selected month ("YYYY-MM") from the global month filter. */
  selectedMonth: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Exact calendar days in a given month (1-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Collects expense rows whose `date` falls strictly within `selectedMonth`.
 * This ensures the total changes per month and matches the items the user sees.
 */
function getExpensesForMonth(rows: TableRow[], selectedMonth: string): TableRow[] {
  return rows.filter(
    (r) => r.entryType === 'expense' && r.date.startsWith(selectedMonth + '-'),
  );
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
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${s.wrap}`} title={fullValue}>
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold font-mono ${s.text}`}>{value}</span>
      {sub && <span className="text-xs text-white/30">{sub}</span>}
    </div>
  );
}

export function MetricsPanel({ metrics, dailyGoal, costBasedTarget, table, selectedMonth }: MetricsPanelProps) {
  const sortedMonths = Object.keys(metrics.byMonth).sort().reverse().slice(0, 3);

  // ── Monthly expenses — strict date filter (only expenses dated in selectedMonth) ──
  const [selYear, selMon] = selectedMonth.split('-').map(Number);
  const monthExpenseRows = getExpensesForMonth(table.rows, selectedMonth);
  const monthlyExpenseTotal = monthExpenseRows.reduce((s, r) => s + (r.monthlyValue ?? r.value), 0);
  const monthDays = daysInMonth(selYear, selMon);
  const expenseDailyAvg  = monthDays > 0 ? monthlyExpenseTotal / monthDays : 0;
  const expenseWeeklyAvg = expenseDailyAvg * 7;
  const selectedMonthMetrics = metrics.byMonth[selectedMonth] ?? null;

  function formatMonth(ym: string): string {
    const [y, m] = ym.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  return (
    <div className="space-y-4">
      {/* ── Global averages ── */}
      <div>
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-4 h-px bg-white/20 inline-block" />
          Médias Globais
          <span className="flex-1 h-px bg-white/10 inline-block" />
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Total Bruto"
            value={fmt(metrics.grossTotal)}
            fullValue={formatCurrencyFull(metrics.grossTotal)}
            status="accent"
          />
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
                : 'dias úteis'
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
        </div>

        {/* ── Saldo Líquido (receitas − despesas) — só exibe quando há despesas ── */}
        {metrics.totalExpenses > 0 && (
          <MetricCard
            label="Saldo Líquido Global"
            value={fmt(metrics.netBalance)}
            fullValue={formatCurrencyFull(metrics.netBalance)}
            status={metrics.netBalance >= 0 ? 'success' : 'warning'}
            sub={
              metrics.netBalance >= 0
                ? `✓ Receitas excedem despesas em ${fmt(metrics.netBalance)}`
                : `⚠ Despesas superam receitas em ${fmt(Math.abs(metrics.netBalance))}`
            }
          />
        )}

        {/* ── Time Bank ── */}
        {metrics.grossTotal > 0 && (() => {
          const tb = metrics.timeBankBalance;
          const positive = tb >= 0;
          const absW = Math.abs(tb).toFixed(1);
          return (
            <MetricCard
              label="Banco de Horas"
              value={`${positive ? '+' : ''}${tb.toFixed(1)} sem.`}
              status={positive ? 'success' : 'warning'}
              sub={
                positive
                  ? `✅ ${absW} semana${parseFloat(absW) !== 1 ? 's' : ''} adiantadas`
                  : `🚨 ${absW} semana${parseFloat(absW) !== 1 ? 's' : ''} pendentes`
              }
            />
          );
        })()}

        {/* ── Cost coverage card ── */}
        {costBasedTarget && (() => {
          const currentYear = new Date().getFullYear();
          const yearGross = metrics.byYear[String(currentYear)]?.grossAnnual ?? 0;
          const coveragePct = costBasedTarget.annualCost > 0
            ? Math.round((yearGross / costBasedTarget.annualCost) * 1000) / 10
            : 0;
          const covered = coveragePct >= 100;
          return (
            <MetricCard
              label="Cobertura de Custos"
              value={`${coveragePct.toFixed(1)}%`}
              status={covered ? 'success' : 'warning'}
              sub={
                covered
                  ? `✅ Custos operacionais cobertos! Saldo é lucro líquido`
                  : `⚡ ${formatCurrencyShort(yearGross)} de ${formatCurrencyShort(costBasedTarget.annualCost)} anuais`
              }
            />
          );
        })()}
      </div>

      {/* ── Selected month — Income breakdown ── */}
      {selectedMonthMetrics && (
        <div>
          <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
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

      {/* ── Selected month — Expense breakdown (mirrors income cards) ── */}
      {monthlyExpenseTotal > 0 && (
        <div>
          <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-4 h-px bg-amber-400/30 inline-block" />
            Gastos de {formatMonth(selectedMonth)}
            <span className="flex-1 h-px bg-white/10 inline-block" />
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard
              label="Total Gasto Mensal"
              value={`-${fmt(monthlyExpenseTotal)}`}
              fullValue={`-${formatCurrencyFull(monthlyExpenseTotal)}`}
              status="warning"
              sub={`${monthExpenseRows.length} despesa${monthExpenseRows.length !== 1 ? 's' : ''}`}
            />
            <MetricCard
              label="Média de Gasto Diário"
              value={`-${fmt(expenseDailyAvg)}`}
              fullValue={`-${formatCurrencyFull(expenseDailyAvg)}`}
              status="warning"
              sub={`÷ ${monthDays} dias`}
            />
            <MetricCard
              label="Média de Gasto Semanal"
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
          <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
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
                      <div className="text-xs text-white/30">Bruto</div>
                      <div className="text-sm font-mono text-white/80">{fmt(m.grossMonthly)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/30">Diária</div>
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

      {/* ── Expense totals ── */}
      {metrics.totalExpenses > 0 && (
        <div>
          <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-4 h-px bg-rose-400/30 inline-block" />
            Custos Dinâmicos
            <span className="flex-1 h-px bg-white/10 inline-block" />
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Total de Custos"
              value={fmt(metrics.totalExpenses)}
              fullValue={formatCurrencyFull(metrics.totalExpenses)}
              status="warning"
              sub="soma de todos os custos"
            />
            <MetricCard
              label="Custo Anual"
              value={fmt(metrics.annualExpenses)}
              fullValue={formatCurrencyFull(metrics.annualExpenses)}
              status="warning"
              sub="mensal × meses"
            />
          </div>
        </div>
      )}
    </div>
  );
}
