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
import type { TableMetrics } from '@/core/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RealInvestmentsChartProps {
  metrics: TableMetrics;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtBRLCompact(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  const monthShort = date.toLocaleDateString('pt-BR', { month: 'short' });
  return `${monthShort}/${y.slice(2)}`;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

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
    <div style={{
      backgroundColor: '#0d1117',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '12px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      minWidth: '220px',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: '500', margin: '0 0 8px 0' }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
          <span style={{ color: '#38bdf8' }}>Principal Acumulado</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'semibold', color: '#7dd3fc' }}>{fmtBRL(principal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
          <span style={{ color: '#a78bfa' }}>Rendimentos</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'semibold', color: '#c084fc' }}>
            + {fmtBRL(yieldVal)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', fontSize: '10px', color: 'rgba(192, 132, 252, 0.7)' }}>
          <span>Rendimento no Mês</span>
          <span style={{ fontFamily: 'monospace' }}>
            + {fmtBRL(monthYield)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', fontWeight: 'bold', color: '#fff' }}>
        <span>Saldo Total</span>
        <span style={{ fontFamily: 'monospace' }}>{fmtBRL(total)}</span>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, theme = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  theme?: 'default' | 'sky' | 'violet';
}) {
  const themes = {
    default: { wrap: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' },          text: '#fff' },
    sky:     { wrap: { backgroundColor: 'rgba(14, 165, 233, 0.1)', borderColor: 'rgba(14, 165, 233, 0.25)' },     text: '#38bdf8' },
    violet:  { wrap: { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.25)' }, text: '#c084fc' },
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
      flex: 1,
      minWidth: '140px',
      ...t.wrap,
    }}>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', color: t.text }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{sub}</div>}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      gap: '20px',
      backgroundColor: '#161b22',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        border: '1px solid rgba(14, 165, 233, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '30px',
      }}>
        💰
      </div>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.5)' }}>
          Nenhum aporte registrado ainda.
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.3)', lineHeight: '1.5' }}>
          Adicione um aporte na aba Planilha — selecione o tipo{' '}
          <span style={{ color: '#0ea5e9', fontWeight: '500' }}>💰 Aporte</span>{' '}
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
          <span>🏦</span> Aportes & Evolução Real
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.35)', lineHeight: '1.5' }}>
          Acompanhamento histórico dos aportes reais depositados e juros compostos acumulados gerados pela carteira de investimentos (CDI estimado de 0.8% a.m.).
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <SummaryCard
          label="Total depositado"
          value={fmtBRL(totalDeposited)}
          sub="esforço real poupado"
          theme="sky"
        />
        <SummaryCard
          label="Rendimentos reais"
          value={fmtBRL(totalYieldEarned)}
          sub="juros reais acumulados"
          theme="violet"
        />
        <SummaryCard
          label="Saldo atual (c/ juros)"
          value={fmtBRL(finalBalance)}
          sub="principal + rendimentos"
        />
        <SummaryCard
          label="Rendimento último mês"
          value={fmtBRL(lastMonthYield)}
          sub="0.8% sobre saldo total"
        />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(14, 165, 233, 0.2)', border: '1px solid rgba(14, 165, 233, 0.3)' }} />
          Aportes Acumulados (Principal)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)' }} />
          Rendimentos Acumulados (Juros)
        </span>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: '240px', overflow: 'hidden' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
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
              stroke="rgba(255, 255, 255, 0.04)"
              vertical={false}
            />

            <XAxis
              dataKey="monthLabel"
              tick={{ fill: 'rgba(255, 255, 255, 0.3)', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => fmtBRLCompact(v)}
              tick={{ fill: 'rgba(255, 255, 255, 0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(255, 255, 255, 0.08)', strokeWidth: 1, strokeDasharray: '3 3' }}
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
    </div>
  );
}
