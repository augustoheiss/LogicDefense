import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { TableRow } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHLY_RATE = 0.008; // 0.8 % / month — CDI / Tesouro Selic reference

// ── Types ─────────────────────────────────────────────────────────────────────

interface RealInvestmentsChartProps {
  rows: TableRow[];
}

interface MonthlyInvestmentPoint {
  yearMonth: string;       // "2026-01"
  monthLabel: string;      // "jan./26"
  /**
   * Sum of actual deposits recorded in this month.
   * Represents the user's physical effort.
   */
  monthlyDeposit: number;
  /**
   * Interest earned on the PREVIOUS balance before this month's deposit.
   * Formula: previousRunningBalance × MONTHLY_RATE.
   * Starts at R$ 0 on the first recorded month (nothing invested yet).
   */
  monthlyYield: number;
  /** Balance after adding yield + deposit. Used for summary cards only. */
  runningBalance: number;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtBRLCompact(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  const monthShort = date.toLocaleDateString('pt-BR', { month: 'short' });
  return `${monthShort}/${y.slice(2)}`;
}

// ── Data pipeline ─────────────────────────────────────────────────────────────

/**
 * Transforms raw deposit rows into a month-by-month compound interest timeline.
 *
 * Algorithm (matches useProjectionEngine logic but driven by real deposit dates):
 *   For each month in chronological order:
 *     1. monthlyYield = runningBalance × MONTHLY_RATE   ← interest on prior capital
 *     2. monthlyDeposit = Σ deposits recorded this month
 *     3. runningBalance += monthlyYield + monthlyDeposit
 *
 * Months with no recorded deposits are skipped — only the user's actual history
 * is shown, not a forward projection.
 */
function buildInvestmentData(rows: TableRow[]): MonthlyInvestmentPoint[] {
  const depositRows = rows.filter((r) => r.entryType === 'deposit' && r.value > 0);
  if (depositRows.length === 0) return [];

  // Group deposit amounts by "YYYY-MM"
  const byMonth: Record<string, number> = {};
  for (const row of depositRows) {
    const ym = row.date.slice(0, 7);
    byMonth[ym] = (byMonth[ym] ?? 0) + row.value;
  }

  const sortedMonths = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));

  let runningBalance = 0;
  return sortedMonths.map(([ym, rawDeposit]) => {
    // Step 1: interest accrues on the balance that was already there
    const monthlyYield   = round2(runningBalance * MONTHLY_RATE);

    // Step 2: record this month's deposit
    const monthlyDeposit = round2(rawDeposit);

    // Step 3: update balance
    runningBalance = round2(runningBalance + monthlyYield + monthlyDeposit);

    return {
      yearMonth:    ym,
      monthLabel:   formatMonthLabel(ym),
      monthlyDeposit,
      monthlyYield,
      runningBalance,
    };
  });
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
// Shows ONLY the two monthly values — no accumulated totals (those are in cards).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const deposit = payload.find(
    (p: { dataKey: string }) => p.dataKey === 'monthlyDeposit',
  )?.value as number ?? 0;

  const yieldVal = payload.find(
    (p: { dataKey: string }) => p.dataKey === 'monthlyYield',
  )?.value as number ?? 0;

  return (
    <div className="bg-[#0d1117] border border-white/15 rounded-lg px-4 py-3 text-xs shadow-2xl min-w-44 space-y-2">
      <p className="text-white/50 font-medium">{label}</p>
      <div className="space-y-1">
        {deposit > 0 && (
          <div className="flex justify-between gap-6">
            <span className="text-sky-400">Aporte do mês</span>
            <span className="font-mono font-semibold text-sky-300">{fmtBRL(deposit)}</span>
          </div>
        )}
        <div className="flex justify-between gap-6">
          <span className="text-violet-400">Rendimento no mês</span>
          <span className="font-mono font-semibold text-violet-300">
            + {fmtBRL(yieldVal)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, theme = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  theme?: 'default' | 'sky' | 'violet';
}) {
  const themes = {
    default: { wrap: 'bg-white/5 border-white/10',          text: 'text-white' },
    sky:     { wrap: 'bg-sky-500/10 border-sky-500/25',     text: 'text-sky-300' },
    violet:  { wrap: 'bg-violet-500/10 border-violet-500/25', text: 'text-violet-300' },
  };
  const t = themes[theme];
  return (
    <div className={`rounded-xl border p-3 space-y-0.5 ${t.wrap}`}>
      <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
      <div className={`text-base font-bold font-mono ${t.text}`}>{value}</div>
      {sub && <div className="text-xs text-white/30">{sub}</div>}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-5">
      <div className="w-16 h-16 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
        <span className="text-3xl">💰</span>
      </div>
      <div className="text-center space-y-1.5 max-w-xs">
        <p className="text-sm font-semibold text-white/50">
          Nenhum aporte registrado ainda.
        </p>
        <p className="text-xs text-white/30 leading-relaxed">
          Adicione um aporte na aba Planilha — selecione o tipo{' '}
          <span className="text-sky-400 font-medium">💰 Aporte</span>{' '}
          para ver seu histórico de investimentos aqui.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RealInvestmentsChart({ rows }: RealInvestmentsChartProps) {
  const data = useMemo(() => buildInvestmentData(rows), [rows]);

  if (data.length === 0) return <EmptyState />;

  const totalDeposited  = round2(data.reduce((s, p) => s + p.monthlyDeposit, 0));
  const totalYieldEarned = round2(data.reduce((s, p) => s + p.monthlyYield, 0));
  const finalBalance    = data[data.length - 1].runningBalance;
  const lastMonthYield  = data[data.length - 1].monthlyYield;

  return (
    <div className="space-y-4">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total depositado"
          value={fmtBRL(totalDeposited)}
          sub="seu esforço real"
          theme="sky"
        />
        <StatCard
          label="Rendimentos reais"
          value={fmtBRL(totalYieldEarned)}
          sub="juros acumulados"
          theme="violet"
        />
        <StatCard
          label="Saldo atual (c/ juros)"
          value={fmtBRL(finalBalance)}
          sub="principal + rendimentos"
        />
        <StatCard
          label="Rendimento último mês"
          value={fmtBRL(lastMonthYield)}
          sub={`${MONTHLY_RATE * 100}% sobre saldo anterior`}
        />
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-5 text-xs text-white/35">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-sky-500/70" />
          Aporte mensal (seu esforço)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-0.5 bg-violet-400" />
          Rendimento do mês (juros)
        </span>
      </div>

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="gradRealDeposit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#0ea5e9" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#0369a1" stopOpacity={0.35} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />

          <XAxis
            dataKey="monthLabel"
            tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
            interval={data.length > 12 ? Math.ceil(data.length / 10) - 1 : 0}
          />
          <YAxis
            tickFormatter={(v: number) => fmtBRLCompact(v)}
            tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />

          {/* Sky-blue bars: the user's physical deposit each month */}
          <Bar
            dataKey="monthlyDeposit"
            fill="url(#gradRealDeposit)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            name="Aporte mensal"
          />

          {/*
            Violet line: the interest earned on the accumulated balance.
            Starts near R$ 0 and grows as the balance compounds —
            visually identical in concept to the FutureProjectionChart
            monthlyYield line, but driven by real recorded deposits.
          */}
          <Line
            type="monotone"
            dataKey="monthlyYield"
            stroke="#a78bfa"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#a78bfa', strokeWidth: 0 }}
            name="Rendimento do mês"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
