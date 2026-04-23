import { useState, useMemo, useCallback } from 'react';
import type { CoinTable, TableRow, CostBasedTarget } from '../types';
import { computeMetrics } from '../hooks/useMetricsEngine';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { AddRowForm } from './AddRowForm';
import { MetricsPanel } from './MetricsPanel';
import { GoalsPanel } from './GoalsPanel';
import { RevenueChart } from './RevenueChart';
import { RealInvestmentsChart } from './RealInvestmentsChart';
import { FutureProjectionChart } from './FutureProjectionChart';
import { WhatsAppExporter } from './WhatsAppExporter';
import { ConfirmDialog } from './ConfirmDialog';
import { ExpensesBulkInput } from './ExpensesBulkInput';
import { ExpensesSummary } from './ExpensesSummary';
import { downloadCSV } from '../utils/csvIO';
import { formatCurrencyShort, formatCurrencyFull } from '../utils/formatCurrency';
import { groupRowsByWeek, findCurrentWeek, fmtDate, resolveGoalForYear } from '../utils/dateUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'spreadsheet' | 'metrics' | 'chart' | 'expenses';

interface TableEditorProps {
  table: CoinTable;
  onUpdateRow: (rowId: string, patch: Partial<Omit<TableRow, 'id'>>) => void;
  onDeleteRow: (rowId: string) => void;
  onAddRow: (row: Omit<TableRow, 'id'>) => void;
  onEditTable: () => void;
}

// ── Month helpers (used by selector + children) ───────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function todayYM(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
}

/** All distinct "YYYY-MM" values in rows + current month, newest first. */
function buildAvailableMonths(rows: TableRow[]): string[] {
  const months = new Set<string>([todayYM()]);
  for (const row of rows) {
    months.add(row.date.slice(0, 7));
  }
  return Array.from(months).sort().reverse();
}

/** Most recent month that has any revenue row, falling back to current month. */
function defaultMonth(rows: TableRow[]): string {
  const last = rows
    .filter((r) => r.entryType !== 'deposit' && r.entryType !== 'waiver')
    .map((r) => r.date.slice(0, 7))
    .sort()
    .reverse()[0];
  return last ?? todayYM();
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ── Month selector ────────────────────────────────────────────────────────────

interface MonthSelectorProps {
  value: string;
  options: string[];
  onChange: (ym: string) => void;
}

function MonthSelector({ value, options, onChange }: MonthSelectorProps) {
  const idx     = options.indexOf(value);
  const hasPrev = idx < options.length - 1; // older = higher index (desc sort)
  const hasNext = idx > 0;                  // newer = lower index

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => hasPrev && onChange(options[idx + 1])}
        disabled={!hasPrev}
        className="px-2 py-1 rounded text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-base leading-none"
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs font-medium text-white rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[#a855f7] cursor-pointer border border-white/15 appearance-none"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
      >
        {options.map((ym) => (
          <option key={ym} value={ym} style={{ background: '#1a1a2e', color: '#fff' }}>
            {formatMonthLabel(ym)}
          </option>
        ))}
      </select>
      <button
        onClick={() => hasNext && onChange(options[idx - 1])}
        disabled={!hasNext}
        className="px-2 py-1 rounded text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-base leading-none"
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TableEditor({
  table,
  onUpdateRow,
  onDeleteRow,
  onAddRow,
  onEditTable,
}: TableEditorProps) {
  const [activeTab,    setActiveTab]    = useState<TabId>('spreadsheet');
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [deleteRowId,  setDeleteRowId]  = useState<string | null>(null);
  const [chartView,    setChartView]    = useState<'history' | 'projection'>('history');

  // ── Time Machine (cutoff date) ──────────────────────────────────────────────
  const [cutoffDate, setCutoffDate] = useState<string>(''); // '' = today (no filter)

  // ── Dual-Target: cost-based goal toggle ─────────────────────────────────────
  const [costGoalActive, setCostGoalActive] = useState(false);

  // ── Filtered rows (Time Machine) ────────────────────────────────────────────
  // When a cutoff date is set, only rows on or before that date are considered.
  const filteredRows = useMemo(() => {
    if (!cutoffDate) return table.rows;
    return table.rows.filter((r) => r.date <= cutoffDate);
  }, [table.rows, cutoffDate]);

  // ── Derived rows ────────────────────────────────────────────────────────────
  // Revenue rows exclude both deposits and waiver ledger entries.
  // computeMetrics receives ALL filtered rows so it can locate waiver rows internally.
  const revenueRows = useMemo(
    () => filteredRows.filter((r) => r.entryType !== 'deposit' && r.entryType !== 'waiver' && r.entryType !== 'expense'),
    [filteredRows],
  );
  const metrics = useMemo(
    () => computeMetrics(filteredRows, table.goals.weeklyGoals, cutoffDate || undefined),
    [filteredRows, table.goals.weeklyGoals, cutoffDate],
  );

  // All-time metrics — always unfiltered, used by the global overview section.
  const allTimeMetrics = useMemo(
    () => computeMetrics(table.rows, table.goals.weeklyGoals),
    [table.rows, table.goals.weeklyGoals],
  );

  // ── Cost-based target derivation (Dynamic Break-Even) ────────────────────────
  // The survival goal absorbs ALL variable costs logged in the system, not just
  // the static annualCost input.  This makes break-even targets adjust to real
  // spending:
  //   dynamicAnnualCost = baseAnnualCost + expenseRows + negativeValueCosts
  //
  // Everything reads from filteredRows so the Time Machine cutoff is respected.
  const currentYear = cutoffDate ? parseInt(cutoffDate.slice(0, 4), 10) : new Date().getFullYear();
  const baseAnnualCost = resolveGoalForYear(table.goals.annualCosts, currentYear);

  const variableCosts = useMemo(() => {
    // 1. Expense-type rows (Gastos tab entries — always positive values)
    const expenseTotal = filteredRows
      .filter((r) => r.entryType === 'expense' && r.value > 0)
      .reduce((sum, r) => sum + r.value, 0);

    // 2. Negative-value rows in the main spreadsheet (inline costs)
    const negativeCosts = filteredRows
      .filter((r) => r.entryType !== 'expense' && r.entryType !== 'deposit' && r.entryType !== 'waiver' && r.value < 0)
      .reduce((sum, r) => sum + Math.abs(r.value), 0);

    return Math.round((expenseTotal + negativeCosts) * 100) / 100;
  }, [filteredRows]);

  const dynamicAnnualCost = baseAnnualCost + variableCosts;

  const costBasedTarget: CostBasedTarget | undefined = costGoalActive && dynamicAnnualCost > 0
    ? {
        weeklySurvival: Math.round((dynamicAnnualCost / 52) * 100) / 100,
        dailySurvival: Math.round((dynamicAnnualCost / 365) * 100) / 100,
        annualCost: dynamicAnnualCost,
      }
    : undefined;

  // ── Global month selector ───────────────────────────────────────────────────
  const availableMonths = useMemo(() => buildAvailableMonths(filteredRows), [filteredRows]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => defaultMonth(table.rows),
  );
  // Guard: if the selected month is no longer in the list, snap to the first
  const effectiveMonth = availableMonths.includes(selectedMonth)
    ? selectedMonth
    : (availableMonths[0] ?? todayYM());

  // Rows visible in the current month view
  const monthRows = useMemo(
    () => filteredRows.filter((r) => r.date.startsWith(effectiveMonth + '-')),
    [filteredRows, effectiveMonth],
  );

  // Current-week data — uses filtered revenue rows so Time Machine is respected.
  const currentWeekData = useMemo(() => {
    const allRevenueRows = filteredRows.filter(
      (r) =>
        r.entryType !== 'deposit' &&
        r.entryType !== 'expense' &&
        r.entryType !== 'waiver' &&
        r.value > 0,
    );
    const allGroups = groupRowsByWeek(allRevenueRows, table.goals.weeklyGoals);
    if (allGroups.length === 0) return null;

    const refDate = cutoffDate ? new Date(cutoffDate + 'T12:00:00') : new Date();
    const [y, m] = effectiveMonth.split('-').map(Number);
    const isCurrentMonth = refDate.getFullYear() === y && refDate.getMonth() + 1 === m;

    if (isCurrentMonth) {
      return findCurrentWeek(allGroups, refDate);
    }

    // Past-month view: show the last week whose SUNDAY falls in this month
    const monthGroups = allGroups.filter((g) => {
      const sun = g.weekEndDate;
      return sun.getFullYear() === y && sun.getMonth() + 1 === m;
    });
    return monthGroups[monthGroups.length - 1] ?? null;
  }, [filteredRows, table.goals.weeklyGoals, effectiveMonth, cutoffDate]);

  function fmt(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'spreadsheet', label: '📋 Planilha' },
    { id: 'metrics',     label: '📊 Métricas' },
    { id: 'chart',       label: '📈 Gráfico'  },
    { id: 'expenses',    label: '💸 Gastos'   },
  ];

  /** Batch-add multiple rows at once (used by ExpensesBulkInput) */
  const handleBulkAdd = useCallback(
    (rows: Omit<TableRow, 'id'>[]) => {
      for (const row of rows) {
        onAddRow(row);
      }
    },
    [onAddRow],
  );

  return (
    <div className="flex flex-col h-full gap-4">
      {/* ── Table header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{table.name}</h2>
          {table.description && (
            <p className="text-sm text-white/40 mt-0.5">{table.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEditTable}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10"
          >
            ✎ Editar
          </button>
          <button
            onClick={() => downloadCSV(table)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/25 transition-colors font-medium"
            title="Exportar tabela como CSV"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
          <button
            onClick={() => setShowWhatsApp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/30 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </button>
        </div>
      </div>

      {/* ── Time Machine + Cost Toggle bar ── */}
      <div className="flex flex-wrap items-center gap-4 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3">
        {/* Date picker */}
        <div className="flex items-center gap-2">
          <span className="text-base">🕰️</span>
          <div className="space-y-0.5">
            <label className="text-xs text-white/40 uppercase tracking-wider block">Máquina do Tempo</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                className="bg-white/10 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-cyan-400 border border-white/10 [color-scheme:dark]"
              />
              {cutoffDate && (
                <button
                  onClick={() => setCutoffDate('')}
                  className="text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
                  title="Voltar para hoje"
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="w-px h-8 bg-white/10 hidden sm:block" />

        {/* Cost-based goal toggle */}
        <div className="flex items-center gap-2.5">
          <span className="text-base">🎯</span>
          <div className="space-y-0.5">
            <label className="text-xs text-white/40 uppercase tracking-wider block">Meta por Custo</label>
            <button
              onClick={() => setCostGoalActive((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                costGoalActive ? 'bg-cyan-500' : 'bg-white/15'
              }`}
              role="switch"
              aria-checked={costGoalActive}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  costGoalActive ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {costGoalActive && costBasedTarget && (
            <div className="flex gap-3 text-xs">
              <div>
                <div className="text-white/30">Sobrev. Diária</div>
                <div className="font-mono font-semibold text-cyan-400">{formatCurrencyShort(costBasedTarget.dailySurvival)}</div>
              </div>
              <div>
                <div className="text-white/30">Sobrev. Semanal</div>
                <div className="font-mono font-semibold text-cyan-400">{formatCurrencyShort(costBasedTarget.weeklySurvival)}</div>
              </div>
            </div>
          )}
        </div>

        {cutoffDate && (
          <span className="text-xs text-cyan-400/60 ml-auto">
            ⚠ Exibindo dados até {cutoffDate.split('-').reverse().join('/')}
          </span>
        )}
      </div>

      {/* ── All-Time Metrics (always unfiltered, visible when cutoff is active) ── */}
      {cutoffDate && allTimeMetrics.grossTotal > 0 && (
        <div className="bg-gradient-to-r from-cyan-500/5 to-transparent border border-cyan-500/20 rounded-xl px-4 py-3">
          <div className="text-xs text-cyan-400/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>📌</span> Métricas Globais (Todo o Período)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Total Histórico', value: formatCurrencyShort(allTimeMetrics.grossTotal), color: 'text-white' },
              { label: 'Média Diária', value: formatCurrencyShort(allTimeMetrics.globalDailyAvg), color: 'text-white/70' },
              { label: 'Média Semanal', value: formatCurrencyShort(allTimeMetrics.globalWeeklyAvg), color: 'text-white/70' },
              { label: 'Saldo Líquido', value: formatCurrencyShort(allTimeMetrics.netBalance), color: allTimeMetrics.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-xs text-white/25">{s.label}</div>
                <div className={`text-sm font-mono font-semibold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick stats (filtered by cutoff) ── */}
      {metrics.grossTotal > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Total',   value: formatCurrencyShort(metrics.grossTotal),      full: formatCurrencyFull(metrics.grossTotal),      color: 'text-white' },
            {
              label: 'Diária',
              value: formatCurrencyShort(metrics.globalDailyAvg),
              full: formatCurrencyFull(metrics.globalDailyAvg),
              color: metrics.globalDailyAvg >= resolveGoalForYear(table.goals.dailyGoals, currentYear)
                ? 'text-emerald-400'
                : 'text-amber-400',
            },
            { label: 'Semanal', value: formatCurrencyShort(metrics.globalWeeklyAvg),  full: formatCurrencyFull(metrics.globalWeeklyAvg),  color: 'text-white' },
            { label: 'Mensal',  value: formatCurrencyShort(metrics.globalMonthlyAvg), full: formatCurrencyFull(metrics.globalMonthlyAvg), color: 'text-white' },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center"
              title={s.full}
            >
              <div className="text-xs text-white/30 uppercase tracking-wider">{s.label}</div>
              <div className={`text-sm font-mono font-semibold mt-0.5 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Semana Atual ── */}
      {currentWeekData && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 border border-[#a855f7]/30 rounded-lg px-4 py-3">
          <div>
            <div className="text-xs text-white/30 uppercase tracking-wider mb-0.5">
              Semana Atual&ensp;
              <span className="normal-case font-normal text-white/20">
                {fmtDate(currentWeekData.weekStartDate)}–{fmtDate(currentWeekData.weekEndDate)}
              </span>
            </div>
            <div className="text-sm font-mono font-semibold text-white">
              {fmt(currentWeekData.weeklyTotal)}
            </div>
          </div>
          <div
            className={`text-sm font-medium ${
              currentWeekData.differenceFromGoal >= 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {currentWeekData.differenceFromGoal >= 0
              ? `✅ Passou ${fmt(currentWeekData.differenceFromGoal)} da meta`
              : `⚡ Faltam ${fmt(Math.abs(currentWeekData.differenceFromGoal))} para a meta`}
          </div>
          <div className="text-xs text-white/25">
            Meta semanal: {fmt(resolveGoalForYear(table.goals.weeklyGoals, currentYear))}
          </div>
        </div>
      )}

      {/* ── Global month filter — controls Planilha, Gráfico, and WhatsApp ── */}
      <div className="flex items-center justify-between gap-3 py-1 border-y border-white/8">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30 hidden sm:block">Visualizando:</span>
          <MonthSelector
            value={effectiveMonth}
            options={availableMonths}
            onChange={setSelectedMonth}
          />
        </div>
        <span className="text-xs text-white/25">
          {monthRows.length} {monthRows.length === 1 ? 'entrada' : 'entradas'} em{' '}
          {formatMonthLabel(effectiveMonth).toLowerCase()}
        </span>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#a855f7] text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-white/20 self-end pb-2 pr-1">
          {table.rows.length} total
        </span>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'spreadsheet' && (
          <div className="flex flex-col gap-4">
            <SpreadsheetGrid
              rows={table.rows}
              dailyGoal={resolveGoalForYear(table.goals.dailyGoals, parseInt(effectiveMonth.slice(0, 4)))}
              selectedMonth={effectiveMonth}
              onUpdateRow={(rowId, patch) => onUpdateRow(rowId, patch)}
              onDeleteRow={(rowId) => setDeleteRowId(rowId)}
            />
            <AddRowForm onAdd={onAddRow} />
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <MetricsPanel metrics={metrics} dailyGoal={resolveGoalForYear(table.goals.dailyGoals, currentYear)} costBasedTarget={costBasedTarget} />
            </div>
            <div className="lg:w-72 shrink-0">
              <GoalsPanel goals={table.goals} metrics={metrics} costBasedTarget={costBasedTarget} />
            </div>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="space-y-4">
            {/* ── Chart view toggle ── */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 self-start w-fit">
              {([
                { id: 'history',    label: '📊 Histórico Mensal' },
                { id: 'projection', label: '💰 Investimentos & Projeção' },
              ] as const).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setChartView(v.id)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    chartView === v.id
                      ? 'bg-[#a855f7] text-white shadow'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {chartView === 'history' && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <RevenueChart
                  rows={revenueRows}
                  dailyGoal={resolveGoalForYear(table.goals.dailyGoals, parseInt(effectiveMonth.slice(0, 4)))}
                  selectedMonth={effectiveMonth}
                  dailySurvivalGoal={costBasedTarget?.dailySurvival}
                />
              </div>
            )}

            {chartView === 'projection' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/8" />
                    <span className="text-xs font-semibold text-sky-400/80 uppercase tracking-wider px-1">
                      Seu Acúmulo Real
                    </span>
                    <div className="flex-1 h-px bg-white/8" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <RealInvestmentsChart rows={table.rows} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-xs text-white/20 uppercase tracking-wider px-1">
                    Simulador de Futuro — 6 Anos
                  </span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <FutureProjectionChart rows={table.rows} />
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <ExpensesBulkInput onAddRows={handleBulkAdd} />
            <ExpensesSummary rows={table.rows} />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showWhatsApp && (
        <WhatsAppExporter
          table={table}
          metrics={metrics}
          selectedMonth={effectiveMonth}
          onClose={() => setShowWhatsApp(false)}
          cutoffDate={cutoffDate || undefined}
          costBasedTarget={costBasedTarget}
        />
      )}

      {deleteRowId && (
        <ConfirmDialog
          title="Excluir linha?"
          message="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          onConfirm={() => {
            onDeleteRow(deleteRowId);
            setDeleteRowId(null);
          }}
          onCancel={() => setDeleteRowId(null)}
        />
      )}
    </div>
  );
}
