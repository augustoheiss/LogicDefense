import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  computeProjection,
  getProjectionSummary,
  DEFAULT_MONTHLY_RATE,
} from '../hooks/useProjectionEngine';
import type { TableRow } from '../types';

// ── Types & constants ─────────────────────────────────────────────────────────

interface FutureProjectionChartProps {
  rows: TableRow[];
}

const PRESETS = [500, 1000, 2000, 3000];

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtBRLCompact(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
// Shows only the monthly yield for that specific month — no accumulated totals.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const month        = label as number;
  const monthlyYield = payload.find(
    (p: { dataKey: string }) => p.dataKey === 'monthlyYield',
  )?.value as number ?? 0;
  const year  = Math.ceil(month / 12);
  const month_ = ((month - 1) % 12) + 1;

  return (
    <div className="bg-[#0d1117] border border-white/15 rounded-lg px-4 py-3 text-xs shadow-2xl space-y-2 min-w-52">
      <p className="text-white/40 font-medium">
        Mês {month}
        <span className="ml-2 text-white/20">
          (Ano {year}, mês {month_})
        </span>
      </p>
      <div className="flex items-baseline justify-between gap-6">
        <span className="text-violet-300">Rendimento do mês</span>
        <span className="font-mono font-bold text-violet-300 text-sm">
          + {fmtBRL(monthlyYield)}
        </span>
      </div>
      <p className="text-white/20 leading-relaxed border-t border-white/10 pt-2">
        Dinheiro trabalhando para você,<br />
        sem esforço físico adicional.
      </p>
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, theme = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  theme?: 'default' | 'violet' | 'cyan';
}) {
  const themes = {
    default: { wrap: 'bg-white/5 border-white/10',          text: 'text-white' },
    violet:  { wrap: 'bg-violet-500/10 border-violet-500/30', text: 'text-violet-300' },
    cyan:    { wrap: 'bg-cyan-500/10 border-cyan-500/30',     text: 'text-cyan-400' },
  };
  const t = themes[theme];
  return (
    <div className={`rounded-xl border p-3 space-y-0.5 ${t.wrap}`}>
      <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold font-mono ${t.text}`}>{value}</div>
      {sub && <div className="text-xs text-white/30">{sub}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FutureProjectionChart({ rows }: FutureProjectionChartProps) {
  // Derive a sensible default from logged deposit rows, or fall back to R$ 1,000
  const derivedDeposit = useMemo(() => {
    const depositRows = rows.filter((r) => r.entryType === 'deposit' && r.value > 0);
    if (depositRows.length === 0) return 1000;
    const avg = depositRows.reduce((s, r) => s + r.value, 0) / depositRows.length;
    return Math.round(avg / 50) * 50; // snap to nearest R$ 50
  }, [rows]);

  const [monthlyDeposit, setMonthlyDeposit] = useState<number>(derivedDeposit);
  const [customInput,    setCustomInput]    = useState('');

  const projectionData = useMemo(
    () => computeProjection(monthlyDeposit),
    [monthlyDeposit],
  );

  const summary = useMemo(
    () => getProjectionSummary(projectionData),
    [projectionData],
  );

  // What % of the "ceiling" the final yield reaches
  const finalYieldPct = summary
    ? Math.round((summary.finalMonthlyYield / monthlyDeposit) * 100)
    : 0;

  function applyCustom() {
    const v = parseFloat(customInput.replace(',', '.'));
    if (isFinite(v) && v > 0) setMonthlyDeposit(Math.round(v * 100) / 100);
    setCustomInput('');
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>📈</span> Projeção de Futuro — 6 Anos
        </h3>
        <p className="text-xs text-white/35 leading-relaxed">
          O gráfico mostra quanto o seu capital acumulado rende{' '}
          <span className="text-violet-300 font-medium">por mês</span>, crescendo
          em direção ao seu aporte fixo (a linha laranja){' '}
          — o ponto onde o{' '}
          <span className="text-white/60">dinheiro começa a trabalhar tanto quanto você</span>.
          Taxa:{' '}
          <span className="text-cyan-400 font-medium">
            {(DEFAULT_MONTHLY_RATE * 100).toFixed(1)}% a.m.
          </span>{' '}
          (CDI / Tesouro Selic estimado).
        </p>
      </div>

      {/* ── Deposit selector ── */}
      <div className="space-y-2">
        <div className="text-xs text-white/40 uppercase tracking-wider">
          Simular aporte mensal (linha de teto)
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setMonthlyDeposit(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                monthlyDeposit === p
                  ? 'bg-amber-500 text-white shadow'
                  : 'bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-white/25'
              }`}
            >
              {fmtBRL(p)}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              step="50"
              placeholder="Valor personalizado"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
              className="bg-white/8 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 w-36 outline-none focus:ring-1 focus:ring-amber-500"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            />
            <button
              onClick={applyCustom}
              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white rounded-lg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
        {!PRESETS.includes(monthlyDeposit) && (
          <p className="text-xs text-amber-400/70">
            Teto: {fmtBRL(monthlyDeposit)} / mês
          </p>
        )}
      </div>

      {/* ── Summary cards (month-72 accumulated totals for context) ── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Saldo final (mês 72)"
            value={fmtBRL(summary.finalBalance)}
            sub="principal + juros"
            theme="cyan"
          />
          <SummaryCard
            label="Total investido"
            value={fmtBRL(summary.totalDeposited)}
            sub="72 × aporte mensal"
          />
          <SummaryCard
            label="Juros totais gerados"
            value={fmtBRL(summary.totalInterest)}
            sub="dinheiro trabalhando"
            theme="violet"
          />
          <SummaryCard
            label={`Rendimento no mês 72`}
            value={fmtBRL(summary.finalMonthlyYield)}
            sub={`${finalYieldPct}% do seu aporte`}
            theme={finalYieldPct >= 70 ? 'violet' : 'default'}
          />
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-amber-400" />
          Seu esforço físico — aporte fixo mensal ({fmtBRL(monthlyDeposit)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-violet-500/70" />
          Rendimento mensal do capital acumulado
        </span>
      </div>

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={projectionData}
          margin={{ top: 16, right: 20, left: 0, bottom: 4 }}
        >
          <defs>
            {/* Violet area — grows from near-zero toward the ceiling */}
            <linearGradient id="gradYield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#7c3aed" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#5b21b6" stopOpacity={0.25} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />

          <XAxis
            dataKey="month"
            tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
            tickFormatter={(m: number) => m % 12 === 0 ? `Ano ${m / 12}` : ''}
            interval={0}
          />
          <YAxis
            domain={[0, monthlyDeposit * 1.18]}
            tickFormatter={(v: number) => fmtBRLCompact(v)}
            tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
          />

          {/*
            ── THE CEILING: fixed horizontal line at the monthly deposit amount ──
            This is the user's "physical effort" — constant, flat, solid orange.
            The label makes the narrative explicit.
          */}
          <ReferenceLine
            y={monthlyDeposit}
            stroke="#f59e0b"
            strokeWidth={2}
            label={{
              value: `Seu Esforço Físico — ${fmtBRL(monthlyDeposit)}/mês`,
              position: 'insideTopLeft',
              fill: '#f59e0b',
              fontSize: 10,
              fontWeight: 600,
            }}
          />

          {/*
            ── THE GROWING YIELD: monthly interest earned by accumulated capital ──
            Starts at R$ 0 (month 1 — nothing invested yet) and climbs toward
            the ceiling. By month 72 it reaches ~77% of the deposit, showing
            the leverage effect of compound interest compressing over time.
          */}
          <Area
            type="monotone"
            dataKey="monthlyYield"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            fill="url(#gradYield)"
            name="Rendimento mensal"
            dot={false}
            activeDot={{ r: 5, fill: '#8b5cf6', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* ── Closing-gap callout ── */}
      {summary && (
        <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl px-4 py-3 text-xs text-white/50 leading-relaxed">
          <span className="text-violet-300 font-semibold">Em 6 anos</span>, cada mês o seu capital
          gera{' '}
          <span className="text-violet-300 font-semibold font-mono">
            {fmtBRL(summary.finalMonthlyYield)}
          </span>{' '}
          de rendimento passivo — equivalente a{' '}
          <span className="text-violet-300 font-semibold">{finalYieldPct}%</span> do seu aporte
          mensal de{' '}
          <span className="text-amber-400 font-semibold">{fmtBRL(monthlyDeposit)}</span>.
          O capital trabalha enquanto você descansa.
        </div>
      )}

      <p className="text-xs text-white/15 text-center">
        Simulação meramente ilustrativa. Taxa:{' '}
        {(DEFAULT_MONTHLY_RATE * 100).toFixed(1)}% a.m. ≈{' '}
        {(((1 + DEFAULT_MONTHLY_RATE) ** 12 - 1) * 100).toFixed(2)}% a.a.
      </p>
    </div>
  );
}
