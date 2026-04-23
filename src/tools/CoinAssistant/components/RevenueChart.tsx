import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { TableRow } from '../types';
import { rowContributions } from '../hooks/useMetricsEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevenueChartProps {
  rows: TableRow[];
  dailyGoal: number;
  /** Controlled from TableEditor — the global month filter. */
  selectedMonth: string;
  /** When cost-based goal is active, shows a second survival reference line. */
  dailySurvivalGoal?: number;
}

/**
 * One data-point per calendar day in the selected month.
 *
 * revenue    – prorated revenue contributions for that day (≥ 0)
 * expense    – prorated expense contributions for that day (≥ 0, absolute)
 * expenseNeg – negative mirror of expense, used for the downward bar
 * dayBalance – revenue - expense for that single day
 */
interface ChartPoint {
  dateLabel:  string;  // "01/04"
  dateISO:    string;  // "YYYY-MM-DD"
  revenue:    number;
  expense:    number;
  expenseNeg: number;
  dayBalance: number;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

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

function currentISODate(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Builds a daily ChartPoint array for the selected month.
 *
 * Uses rowContributions() to distribute period rows proportionally,
 * so a 30-day contract for R$ 3.000 appears as R$ 100/day instead
 * of a single R$ 3.000 spike on the payment date.
 *
 * Revenue rows  → positive bars (revenue, cumBalance grows)
 * Expense rows  → negative bars (expenseNeg, cumBalance shrinks)
 */
function buildCashFlowData(rows: TableRow[], ym: string): ChartPoint[] {
  const [yearStr, monthStr] = ym.split('-');
  const year        = parseInt(yearStr,  10);
  const month       = parseInt(monthStr, 10);
  const totalDays   = daysInMonth(year, month);
  const isThisMonth = ym === currentYM();
  const todayDate   = currentISODate();

  // ── Step 1: build daily revenue and expense buckets ──────────────────────
  const revMap: Record<string, number> = {};
  const expMap: Record<string, number> = {};

  for (const row of rows) {
    // Only consider rows whose contributions overlap the selected month
    const isRevenue = row.entryType !== 'deposit' &&
                      row.entryType !== 'expense' &&
                      row.entryType !== 'waiver' &&
                      row.value > 0;
    const isExpense = row.entryType === 'expense' && row.value > 0;
    if (!isRevenue && !isExpense) continue;

    const contributions = rowContributions(row);
    for (const c of contributions) {
      if (!c.date.startsWith(ym + '-')) continue;  // skip days outside this month
      if (isRevenue) revMap[c.date] = round2((revMap[c.date] ?? 0) + c.value);
      if (isExpense) expMap[c.date] = round2((expMap[c.date] ?? 0) + c.value);
    }
  }

  // ── Step 2: build day-by-day ChartPoints with running cumBalance ─────────
  const points: ChartPoint[] = [];

  for (let d = 1; d <= totalDays; d++) {
    const dateISO = `${yearStr}-${monthStr}-${pad2(d)}`;
    if (isThisMonth && dateISO > todayDate) break;

    const revenue    = round2(revMap[dateISO] ?? 0);
    const expense    = round2(expMap[dateISO] ?? 0);
    const dayBalance = round2(revenue - expense);

    points.push({
      dateLabel:  `${pad2(d)}/${monthStr}`,
      dateISO,
      revenue,
      expense,
      expenseNeg: expense > 0 ? -expense : 0,
      dayBalance,
    });
  }

  return points;
}

// ── Custom tooltip factory (receives dailyGoal via closure) ──────────────────

function makeTooltip(dailyGoal: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;

    const get = (key: string): number =>
      (payload.find((p: { dataKey: string }) => p.dataKey === key)?.value as number) ?? 0;

    const revenue    = get('revenue');
    const expense    = get('expense');
    const dayBalance = get('dayBalance');

    const hasActivity  = revenue > 0 || expense > 0;
    const performance  = revenue > 0 ? Math.round((revenue - dailyGoal) * 100) / 100 : null;
    const perfPositive = performance !== null && performance >= 0;

    return (
      <div className="bg-[#1a1a2e] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs shadow-2xl min-w-44 space-y-1">
        <p className="text-white/50 font-medium pb-0.5 border-b border-white/10">📅 {label}</p>

        {!hasActivity ? (
          <p className="text-white/25 italic">Sem movimentação</p>
        ) : (
          <>
            {revenue > 0 && (
              <p className="text-emerald-400 font-mono">
                <span className="text-white/40 not-italic font-sans">💰 Receita:&nbsp;</span>
                {fmtBRL(revenue)}
              </p>
            )}
            {expense > 0 && (
              <p className="text-rose-400 font-mono">
                <span className="text-white/40 not-italic font-sans">🏷️ Custo:&nbsp;</span>
                -{fmtBRL(expense)}
              </p>
            )}
            {(revenue > 0 || expense > 0) && (
              <p className={`font-mono font-semibold pt-0.5 border-t border-white/10 ${
                dayBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}>
                <span className="text-white/40 not-italic font-normal font-sans">📊 Saldo:&nbsp;</span>
                {dayBalance >= 0 ? fmtBRL(dayBalance) : `-${fmtBRL(Math.abs(dayBalance))}`}
              </p>
            )}
            {performance !== null && (
              <p className={`font-mono font-semibold pt-0.5 border-t border-white/10 ${
                perfPositive ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                <span className="text-white/40 not-italic font-normal font-sans">🎯 vs Meta:&nbsp;</span>
                {perfPositive
                  ? `✅ +${fmtBRL(performance)} acima`
                  : `⚠️ -${fmtBRL(Math.abs(performance))} da meta`}
              </p>
            )}
          </>
        )}
      </div>
    );
  };
}

// ── Y-axis formatter ──────────────────────────────────────────────────────────

function yFmt(v: number): string {
  if (v === 0) return 'R$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  return abs >= 1000 ? `${sign}R$${(abs / 1000).toFixed(1)}k` : `${sign}R$${abs}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export function RevenueChart({ rows, dailyGoal, selectedMonth, dailySurvivalGoal }: RevenueChartProps) {
  const data = useMemo(
    () => buildCashFlowData(rows, selectedMonth),
    [rows, selectedMonth],
  );

  // Summary stats
  const monthRevenue  = round2(data.reduce((s, p) => s + p.revenue,  0));
  const monthExpenses = round2(data.reduce((s, p) => s + p.expense,  0));
  const monthBalance  = round2(monthRevenue - monthExpenses);
  const calendarDays  = data.length;
  const monthDailyAvg = calendarDays > 0 ? round2(monthRevenue / calendarDays) : 0;
  const hasExpenses   = monthExpenses > 0;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-white/25">
        <span className="text-3xl">📊</span>
        <span className="text-sm">Nenhum dado para exibir. Adicione entradas na aba Planilha.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Month summary stats ── */}
      <div className="flex flex-wrap gap-4 justify-end text-right">
        <div>
          <div className="text-xs text-white/30">Receita do mês</div>
          <div className="text-sm font-mono font-semibold text-emerald-400">{fmtBRL(monthRevenue)}</div>
        </div>
        {hasExpenses && (
          <div>
            <div className="text-xs text-white/30">Custos do mês</div>
            <div className="text-sm font-mono font-semibold text-rose-400">-{fmtBRL(monthExpenses)}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-white/30">Saldo Líquido</div>
          <div className={`text-sm font-mono font-semibold ${monthBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
            {monthBalance >= 0 ? fmtBRL(monthBalance) : `-${fmtBRL(Math.abs(monthBalance))}`}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/30">Média / dia</div>
          <div className={`text-sm font-mono font-semibold ${monthDailyAvg >= dailyGoal ? 'text-emerald-400' : monthDailyAvg > 0 ? 'text-amber-400' : 'text-white/30'}`}>
            {fmtBRL(monthDailyAvg)}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/30">Dias</div>
          <div className="text-sm font-mono font-semibold text-white/60">{calendarDays}</div>
        </div>
      </div>

      {/* ── Empty month ── */}
      {data.length === 0 && (
        <div className="flex items-center justify-center h-36 text-white/25 text-sm">
          Nenhuma receita registrada neste mês.
        </div>
      )}

      {/* ── Legend ── */}
      {data.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/35">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/70" /> Receita rateada
            </span>
            {hasExpenses && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-rose-500/70" /> Custo rateado
              </span>
            )}
            {dailyGoal > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-white/30" />
                Meta diária
              </span>
            )}
            {dailySurvivalGoal && dailySurvivalGoal > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-cyan-400/50" />
                Sobrevivência
              </span>
            )}
          </div>

          {/* ── Chart ── */}
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
              {/* Zero line — keeps the split between revenue/expense visible */}
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

              {/* Daily goal reference */}
              {dailyGoal > 0 && (
                <ReferenceLine
                  y={dailyGoal}
                  stroke="rgba(255,255,255,0.22)"
                  strokeDasharray="4 3"
                  label={{
                    value: `Meta ${fmtBRL(dailyGoal)}`,
                    position: 'insideTopRight',
                    fill: 'rgba(255,255,255,0.28)',
                    fontSize: 10,
                  }}
                />
              )}

              {/* Survival goal reference (dual-target) */}
              {dailySurvivalGoal && dailySurvivalGoal > 0 && (
                <ReferenceLine
                  y={dailySurvivalGoal}
                  stroke="rgba(34,211,238,0.40)"
                  strokeDasharray="6 3"
                  label={{
                    value: `Sobrev. ${fmtBRL(dailySurvivalGoal)}`,
                    position: 'insideBottomRight',
                    fill: 'rgba(34,211,238,0.50)',
                    fontSize: 10,
                  }}
                />
              )}

              <XAxis
                dataKey="dateLabel"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                interval={data.length > 20 ? Math.ceil(data.length / 15) - 1 : 0}
              />
              <YAxis
                tickFormatter={yFmt}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                content={makeTooltip(dailyGoal)}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />

              {/* ── Revenue bars (positive / above zero) ── */}
              <Bar
                dataKey="revenue"
                name="revenue"
                fill="rgba(52,211,153,0.70)"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
              />

              {/* ── Expense bars (negative / below zero) — only when expenses exist ── */}
              {hasExpenses && (
                <Bar
                  dataKey="expenseNeg"
                  name="expense"
                  fill="rgba(251,113,133,0.70)"
                  radius={[0, 0, 3, 3]}
                  maxBarSize={20}
                />
              )}

            </ComposedChart>
          </ResponsiveContainer>

          {/* ── Rateio notice ── */}
          <p className="text-xs text-white/20 text-right">
            ✦ Valores distribuídos proporcionalmente pelo período de cada lançamento
          </p>
        </>
      )}
    </div>
  );
}
