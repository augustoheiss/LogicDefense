import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { TableMetrics } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RealInvestmentsChartProps {
  metrics: TableMetrics;
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

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  const monthShort = date.toLocaleDateString('pt-BR', { month: 'short' });
  return `${monthShort}/${y.slice(2)}`;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const principal = payload.find(
    (p: { dataKey: string }) => p.dataKey === 'accumulatedPrincipal',
  )?.value as number ?? 0;

  const yieldVal = payload.find(
    (p: { dataKey: string }) => p.dataKey === 'accumulatedYield',
  )?.value as number ?? 0;

  const monthYield = payload[0].payload.currentMonthYield as number ?? 0;

  const total = principal + yieldVal;

  return (
    <div className="bg-[#0d1117] border border-white/15 rounded-lg px-4 py-3 text-xs shadow-2xl min-w-56 space-y-2">
      <p className="text-white/50 font-medium">{label}</p>
      <div className="space-y-1.5 border-b border-white/5 pb-2">
        <div className="flex justify-between gap-6">
          <span className="text-sky-400">Principal Acumulado</span>
          <span className="font-mono font-semibold text-sky-300">{fmtBRL(principal)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-violet-400">Rendimentos</span>
          <span className="font-mono font-semibold text-violet-300">
            + {fmtBRL(yieldVal)}
          </span>
        </div>
        <div className="flex justify-between gap-6 text-[10px] text-violet-300/70">
          <span>Rendimento no Mês</span>
          <span className="font-mono">
            + {fmtBRL(monthYield)}
          </span>
        </div>
      </div>
      <div className="flex justify-between gap-6 text-white font-semibold pt-0.5">
        <span>Saldo Total</span>
        <span className="font-mono">{fmtBRL(total)}</span>
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

export function RealInvestmentsChart({ metrics }: RealInvestmentsChartProps) {
  const chartData = useMemo(() => {
    return metrics.portfolioTimeline.map((pt) => ({
      ...pt,
      monthLabel: formatMonthLabel(pt.month),
    }));
  }, [metrics.portfolioTimeline]);

  if (chartData.length === 0) return <EmptyState />;

  const totalDeposited = metrics.globalTotalDeposited;
  const totalYieldEarned = metrics.globalTotalYield;
  const finalBalance = metrics.globalBalance;
  const lastMonthYield = metrics.portfolioTimeline[metrics.portfolioTimeline.length - 1]?.currentMonthYield ?? 0;

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
          sub="0.8% sobre saldo anterior"
        />
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-5 text-xs text-white/35">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-sky-500/20 border border-sky-400/30" />
          Aportes Acumulados (Principal)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-violet-500/20 border border-violet-400/30" />
          Rendimentos Acumulados (Juros)
        </span>
      </div>

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="gradPrincipal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradYield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
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
            interval={chartData.length > 12 ? Math.ceil(chartData.length / 10) - 1 : 0}
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
            cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1, strokeDasharray: '3 3' }}
          />

          {/* Principal area (sky blue) */}
          <Area
            type="monotone"
            dataKey="accumulatedPrincipal"
            stackId="1"
            stroke="#0ea5e9"
            fill="url(#gradPrincipal)"
            name="Aportes Acumulados"
          />

          {/* Yield area (violet) stacked on top of Principal */}
          <Area
            type="monotone"
            dataKey="accumulatedYield"
            stackId="1"
            stroke="#8b5cf6"
            fill="url(#gradYield)"
            name="Rendimentos Acumulados"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
