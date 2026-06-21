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
} from '@/core/projectionEngine';
import type { TableRow, TableMetrics } from '@/core/types';

interface FutureProjectionChartProps {
  metrics: TableMetrics;
  rows?: TableRow[];
}

const PRESETS = [500, 1000, 2000, 3000];

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtBRLCompact(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const month        = label as number;
  const monthlyYield = payload.find(
    (p: { dataKey: string }) => p.dataKey === 'monthlyYield',
  )?.value as number ?? 0;
  const year  = Math.ceil(month / 12);
  const month_ = ((month - 1) % 12) + 1;

  return (
    <div style={{
      backgroundColor: '#0d1117',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '12px',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      minWidth: '220px',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: '500', margin: '0 0 8px 0' }}>
        Mês {month}
        <span style={{ marginLeft: '8px', color: 'rgba(255, 255, 255, 0.2)' }}>
          (Ano {year}, mês {month_})
        </span>
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '24px', margin: '8px 0 0 0' }}>
        <span style={{ color: '#c084fc' }}>Rendimento do mês</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#c084fc', fontSize: '14px' }}>
          + {fmtBRL(monthlyYield)}
        </span>
      </div>
      <p style={{ color: 'rgba(255, 255, 255, 0.2)', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '8px', marginTop: '8px', lineHeight: '1.4', margin: '8px 0 0 0' }}>
        Dinheiro trabalhando para você,<br />
        sem esforço físico adicional.
      </p>
    </div>
  );
}

function SummaryCard({
  label, value, sub, theme = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  theme?: 'default' | 'violet' | 'cyan';
}) {
  const themes = {
    default: { wrap: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' },          text: '#fff' },
    violet:  { wrap: { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' }, text: '#c084fc' },
    cyan:    { wrap: { backgroundColor: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.3)' },     text: '#22d3ee' },
  };
  const t = themes[theme];
  return (
    <div style={{
      borderRadius: '12px',
      borderWidth: '1px',
      borderStyle: 'solid',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      ...t.wrap,
    }}>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: t.text }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{sub}</div>}
    </div>
  );
}

export function FutureProjectionChart({ metrics, rows = [] }: FutureProjectionChartProps) {
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

  const finalYieldPct = summary
    ? Math.round((summary.finalMonthlyYield / monthlyDeposit) * 100)
    : 0;

  function applyCustom() {
    const v = parseFloat(customInput.replace(',', '.'));
    if (isFinite(v) && v > 0) setMonthlyDeposit(Math.round(v * 100) / 100);
    setCustomInput('');
  }

  return (
    <div style={{
      backgroundColor: '#161b22',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '20px',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📈</span> Projeção de Futuro — 6 Anos
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.35)', lineHeight: '1.5' }}>
          O gráfico mostra quanto o seu capital acumulado rende{' '}
          <span style={{ color: '#c084fc', fontWeight: '500' }}>por mês</span>, crescendo
          em direção ao seu aporte fixo (a linha laranja) — o ponto onde o{' '}
          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>dinheiro começa a trabalhar tanto quanto você</span>.
          Taxa:{' '}
          <span style={{ color: '#22d3ee', fontWeight: '500' }}>
            {(DEFAULT_MONTHLY_RATE * 100).toFixed(1)}% a.m.
          </span>{' '}
          (CDI / Tesouro Selic estimado).
        </p>
      </div>

      {/* Deposit Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Simular aporte mensal (linha de teto)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setMonthlyDeposit(p)}
              style={{
                background: monthlyDeposit === p ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                border: monthlyDeposit === p ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
            >
              {fmtBRL(p)}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="number"
              min="1"
              step="50"
              placeholder="Valor personalizado"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '12px',
                borderRadius: '8px',
                padding: '6px 10px',
                width: '130px',
                outline: 'none',
              }}
            />
            <button
              onClick={applyCustom}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.6)',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s',
              }}
            >
              OK
            </button>
          </div>
        </div>
        {!PRESETS.includes(monthlyDeposit) && (
          <p style={{ margin: 0, fontSize: '11px', color: 'rgba(245, 158, 11, 0.7)' }}>
            Teto: {fmtBRL(monthlyDeposit)} / mês
          </p>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
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
            label="Rendimento no mês 72"
            value={fmtBRL(summary.finalMonthlyYield)}
            sub={`${finalYieldPct}% do seu aporte`}
            theme={finalYieldPct >= 70 ? 'violet' : 'default'}
          />
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '16px', height: '0px', borderTop: '2px solid #f59e0b' }} />
          Seu esforço físico — aporte fixo mensal ({fmtBRL(monthlyDeposit)})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'rgba(139, 92, 246, 0.7)' }} />
          Rendimento mensal do capital acumulado
        </span>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={projectionData}
            margin={{ top: 16, right: 20, left: 0, bottom: 4 }}
          >
            <defs>
              <linearGradient id="gradYieldWeb" x1="0" y1="0" x2="0" y2="1">
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

            <ReferenceLine
              y={monthlyDeposit}
              stroke="#f59e0b"
              strokeWidth={2}
            />

            <Area
              type="monotone"
              dataKey="monthlyYield"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              fill="url(#gradYieldWeb)"
              name="Rendimento mensal"
              dot={false}
              activeDot={{ r: 5, fill: '#8b5cf6', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Closing-gap callout */}
      {summary && (
        <div style={{
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.5)',
          lineHeight: '1.5',
        }}>
          <span style={{ color: '#c084fc', fontWeight: '600' }}>Em 6 anos</span>, cada mês o seu capital
          gera{' '}
          <span style={{ color: '#c084fc', fontWeight: '600', fontFamily: 'monospace' }}>
            {fmtBRL(summary.finalMonthlyYield)}
          </span>{' '}
          de rendimento passivo — equivalente a{' '}
          <span style={{ color: '#c084fc', fontWeight: '600' }}>{finalYieldPct}%</span> do seu aporte
          mensal de{' '}
          <span style={{ color: '#f59e0b', fontWeight: '600' }}>{fmtBRL(monthlyDeposit)}</span>.
          O capital trabalha enquanto você descansa.
        </div>
      )}

      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', textAlign: 'center', margin: 0 }}>
        Simulação meramente ilustrativa. Taxa:{' '}
        {(DEFAULT_MONTHLY_RATE * 100).toFixed(1)}% a.m. ≈{' '}
        {(((1 + DEFAULT_MONTHLY_RATE) ** 12 - 1) * 100).toFixed(2)}% a.a.
      </p>
    </div>
  );
}
