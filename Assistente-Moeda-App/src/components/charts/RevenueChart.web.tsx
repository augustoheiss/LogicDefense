import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Area,
  Line,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { TableRow, TableMetrics, TableGoals } from '@/core/types';
import { rowContributions } from '@/core/metricsEngine';
import { predictMonthly, predictYearly } from '@/core/mathematicalPrediction';
import { getDailyGoalForDate } from '@/core/dateUtils';
import { colors } from '@/theme/colors';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevenueChartProps {
  metrics: TableMetrics;
  goals: TableGoals;
  rows?: TableRow[];
}

type ChartViewMode = 'mensal' | 'anual' | 'global';

interface ChartPoint {
  dateLabel:   string;
  dateISO:     string;
  revenue:     number;
  expense:     number;  // negative
  partner_in:  number;
  partner_out: number;  // negative
  deposit:     number;
  waiver:      number;
  dayBalance:  number;
  isPrediction?: boolean;
  predMean?:       number;
  predOptimistic?: number;
  predPessimistic?: number;
  predRange?:      [number, number];
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

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const MONTH_NAMES_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function fmtLabel(v: number): string {
  if (v === 0) return '';
  const abs = Math.abs(v);
  if (abs >= 1000) return `R$${(abs / 1000).toFixed(1)}k`;
  return `R$${Math.round(abs)}`;
}

function makePositiveLabel(color: string) {
  return function PositiveLabel(props: any) {
    const { x, y, width, value, index } = props;
    if (!value || value === 0) return null;
    const step = (index ?? 0) % 3;
    const yOff = step * 14;
    return (
      <text
        x={x + width / 2}
        y={y - yOff - 4}
        textAnchor="middle"
        dominantBaseline="auto"
        fill={color}
        fontSize={9}
        fontWeight={600}
        fontFamily="monospace"
      >
        {fmtLabel(value)}
      </text>
    );
  };
}

function makeNegativeLabel(color: string) {
  return function NegativeLabel(props: any) {
    const { x, y, width, height, value, index } = props;
    if (!value || value === 0) return null;
    const step = (index ?? 0) % 3;
    const yOff = step * 14;
    const barBottom = y + Math.abs(height ?? 0);
    return (
      <text
        x={x + width / 2}
        y={barBottom + yOff + 4}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill={color}
        fontSize={9}
        fontWeight={600}
        fontFamily="monospace"
      >
        {fmtLabel(value)}
      </text>
    );
  };
}

const renderRevenueLabel    = makePositiveLabel('#10b981');
const renderDepositLabel    = makePositiveLabel('#3b82f6');
const renderPartnerInLabel  = makePositiveLabel('#06b6d4');
const renderWaiverLabel     = makePositiveLabel('#f59e0b');
const renderExpenseLabel    = makeNegativeLabel('#ef4444');
const renderPartnerOutLabel = makeNegativeLabel('#f97316');

// ── Data builders per view ────────────────────────────────────────────────────

function buildDailyData(rows: TableRow[], ym: string): ChartPoint[] {
  const [yearStr, monthStr] = ym.split('-');
  const year        = parseInt(yearStr,  10);
  const month       = parseInt(monthStr, 10);
  const totalDays   = daysInMonth(year, month);
  const isThisMonth = ym === currentYM();
  const todayDate   = currentISODate();

  const revMap: Record<string, number> = {};
  const expMap: Record<string, number> = {};
  const pinMap: Record<string, number> = {};
  const poutMap: Record<string, number> = {};
  const depMap: Record<string, number> = {};
  const waiMap: Record<string, number> = {};

  for (const row of rows) {
    const et = row.entryType || 'revenue';
    const isRevenue    = et !== 'deposit' && et !== 'expense' && et !== 'waiver' && et !== 'partner_in' && et !== 'partner_out' && row.value > 0;
    const isExpense    = et === 'expense' && row.value > 0;
    const isPartnerIn  = et === 'partner_in' && row.value > 0;
    const isPartnerOut = et === 'partner_out' && row.value > 0;
    const isDeposit    = et === 'deposit' && row.value > 0;
    const isWaiver     = et === 'waiver' && row.value > 0;
    if (!isRevenue && !isExpense && !isPartnerIn && !isPartnerOut && !isDeposit && !isWaiver) continue;

    const contributions = rowContributions(row);
    for (const c of contributions) {
      if (!c.date.startsWith(ym + '-')) continue;
      if (isRevenue)    revMap[c.date]  = round2((revMap[c.date]  ?? 0) + c.value);
      if (isExpense)    expMap[c.date]  = round2((expMap[c.date]  ?? 0) + c.value);
      if (isPartnerIn)  pinMap[c.date]  = round2((pinMap[c.date]  ?? 0) + c.value);
      if (isPartnerOut) poutMap[c.date] = round2((poutMap[c.date] ?? 0) + c.value);
      if (isDeposit)    depMap[c.date]  = round2((depMap[c.date]  ?? 0) + c.value);
      if (isWaiver)     waiMap[c.date]  = round2((waiMap[c.date]  ?? 0) + c.value);
    }
  }

  const points: ChartPoint[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dateISO = `${yearStr}-${monthStr}-${pad2(d)}`;
    if (isThisMonth && dateISO > todayDate) break;

    const revenue    = round2(revMap[dateISO]  ?? 0);
    const expense    = round2(expMap[dateISO]  ?? 0);
    const partner_in  = round2(pinMap[dateISO]  ?? 0);
    const partner_out = round2(poutMap[dateISO] ?? 0);
    const deposit    = round2(depMap[dateISO]  ?? 0);
    const waiver     = round2(waiMap[dateISO]  ?? 0);
    const dayBalance = round2(revenue + partner_in + deposit + waiver - expense - partner_out);

    points.push({
      dateLabel:     `${pad2(d)}/${monthStr}`,
      dateISO,
      revenue,
      expense:       expense !== 0 ? -Math.abs(expense) : 0,
      partner_in,
      partner_out:   partner_out !== 0 ? -Math.abs(partner_out) : 0,
      deposit,
      waiver,
      dayBalance,
    });
  }
  return points;
}

function buildMonthlyData(rows: TableRow[], yearStr: string): ChartPoint[] {
  const points: ChartPoint[] = [];

  for (let m = 1; m <= 12; m++) {
    const ym = `${yearStr}-${pad2(m)}`;
    let revenue = 0, expense = 0, partner_in = 0, partner_out = 0, deposit = 0, waiver = 0;

    for (const row of rows) {
      if (!row.date.startsWith(ym + '-')) continue;
      const et = row.entryType || 'revenue';
      switch (et) {
        case 'revenue':     revenue += row.value; break;
        case 'expense':     expense += row.value; break;
        case 'partner_in':  partner_in += row.value; break;
        case 'partner_out': partner_out += row.value; break;
        case 'deposit':     deposit += row.value; break;
        case 'waiver':      waiver += row.value; break;
      }
    }

    const hasData = revenue > 0 || expense > 0 || partner_in > 0 || partner_out > 0 || deposit > 0 || waiver > 0;
    if (!hasData) continue;

    const dayBalance = round2(revenue + partner_in + deposit + waiver - expense - partner_out);

    points.push({
      dateLabel: MONTH_NAMES_SHORT[m - 1],
      dateISO: ym,
      revenue: round2(revenue),
      expense: expense !== 0 ? -round2(expense) : 0,
      partner_in: round2(partner_in),
      partner_out: partner_out !== 0 ? -round2(partner_out) : 0,
      deposit: round2(deposit),
      waiver: round2(waiver),
      dayBalance,
    });
  }
  return points;
}

function buildYearlyData(rows: TableRow[]): ChartPoint[] {
  const yearSums: Record<string, { revenue: number; expense: number; partner_in: number; partner_out: number; deposit: number; waiver: number }> = {};

  for (const row of rows) {
    const yr = row.date.slice(0, 4);
    if (!yearSums[yr]) yearSums[yr] = { revenue: 0, expense: 0, partner_in: 0, partner_out: 0, deposit: 0, waiver: 0 };
    const et = row.entryType || 'revenue';
    switch (et) {
      case 'revenue':     yearSums[yr].revenue += row.value; break;
      case 'expense':     yearSums[yr].expense += row.value; break;
      case 'partner_in':  yearSums[yr].partner_in += row.value; break;
      case 'partner_out': yearSums[yr].partner_out += row.value; break;
      case 'deposit':     yearSums[yr].deposit += row.value; break;
      case 'waiver':      yearSums[yr].waiver += row.value; break;
    }
  }

  return Object.keys(yearSums).sort().map((yr) => {
    const s = yearSums[yr];
    return {
      dateLabel: yr,
      dateISO: yr,
      revenue: round2(s.revenue),
      expense: s.expense !== 0 ? -round2(s.expense) : 0,
      partner_in: round2(s.partner_in),
      partner_out: s.partner_out !== 0 ? -round2(s.partner_out) : 0,
      deposit: round2(s.deposit),
      waiver: round2(s.waiver),
      dayBalance: round2(s.revenue + s.partner_in + s.deposit + s.waiver - s.expense - s.partner_out),
    };
  });
}

// ── Custom tooltip factory ───────────────────────────────────────────────────

function makeTooltip(dailyGoal: number, viewMode: ChartViewMode) {
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;

    const rawData = payload[0].payload;

    if (rawData.isPrediction) {
      const predMean       = rawData.predMean ?? 0;
      const predOptimistic = rawData.predOptimistic ?? 0;
      const predPessimistic = rawData.predPessimistic ?? 0;

      return (
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '12px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
          minWidth: '200px',
          color: 'rgba(255, 255, 255, 0.9)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <p style={{
            color: '#c084fc',
            fontWeight: '600',
            borderBottom: '1px solid rgba(168, 85, 247, 0.2)',
            paddingBottom: '6px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            🔮 {label}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, fontFamily: 'monospace' }}>
              <span style={{ color: '#d8b4fe' }}>Cenário Otimista:</span>
              <span style={{ fontWeight: '600', color: '#d8b4fe' }}>{fmtBRL(predOptimistic)}</span>
            </p>
            <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, fontFamily: 'monospace' }}>
              <span style={{ color: '#a855f7' }}>Média Esperada:</span>
              <span style={{ fontWeight: '600', color: '#a855f7' }}>{fmtBRL(predMean)}</span>
            </p>
            <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, fontFamily: 'monospace' }}>
              <span style={{ color: 'rgba(168, 85, 247, 0.7)' }}>Cenário Pessimista:</span>
              <span style={{ fontWeight: '600', color: 'rgba(168, 85, 247, 0.7)' }}>{fmtBRL(predPessimistic)}</span>
            </p>
          </div>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', margin: '8px 0 0 0' }}>
            ✦ Baseado na média ± 1σ do histórico
          </p>
        </div>
      );
    }

    const revenue     = rawData.revenue ?? 0;
    const expense     = rawData.expense ? Math.abs(rawData.expense) : 0;
    const partner_in  = rawData.partner_in ?? 0;
    const partner_out = rawData.partner_out ? Math.abs(rawData.partner_out) : 0;
    const deposit     = rawData.deposit ?? 0;
    const waiver      = rawData.waiver ?? 0;

    const dailyNet = revenue + partner_in + deposit + waiver - expense - partner_out;

    let headerLabel = label;
    if (viewMode === 'anual') {
      const idx = MONTH_NAMES_SHORT.indexOf(label);
      if (idx >= 0) headerLabel = MONTH_NAMES_LONG[idx];
    }

    const items = [
      { key: 'revenue', label: 'Receita', value: revenue, color: '#10b981' },
      { key: 'deposit', label: 'Aporte', value: deposit, color: '#3b82f6' },
      { key: 'partner_in', label: 'Créd. Parceria', value: partner_in, color: '#06b6d4' },
      { key: 'waiver', label: 'Justificativa', value: waiver, color: '#f59e0b' },
      { key: 'expense', label: 'Custo', value: expense, color: '#ef4444', isNegative: true },
      { key: 'partner_out', label: 'Déb. Parceria', value: partner_out, color: '#f97316', isNegative: true },
    ].filter(item => item.value !== 0);

    const periodLabel = viewMode === 'mensal' ? 'Saldo do Dia' : viewMode === 'anual' ? 'Saldo do Mês' : 'Saldo do Ano';

    return (
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '12px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
        minWidth: '180px',
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '500', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', margin: '0 0 8px 0' }}>📅 {headerLabel}</p>

        {items.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', margin: 0 }}>Sem movimentação</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {items.map(item => (
              <p key={item.key} style={{ display: 'flex', justifyContent: 'space-between', margin: 0, fontFamily: 'monospace' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color }} />
                  <span style={{ color: item.color, fontFamily: 'sans-serif' }}>{item.label}:</span>
                </span>
                <span style={{ fontWeight: '600', color: item.color }}>
                  {item.isNegative ? '-' : ''}{fmtBRL(item.value)}
                </span>
              </p>
            ))}
          </div>
        )}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, fontWeight: '600', fontFamily: 'monospace', color: dailyNet >= 0 ? '#10b981' : '#ef4444' }}>
            <span>{periodLabel}:</span>
            <span>{dailyNet >= 0 ? fmtBRL(dailyNet) : `-${fmtBRL(Math.abs(dailyNet))}`}</span>
          </p>

          {revenue > 0 && dailyGoal > 0 && viewMode === 'mensal' && (() => {
            const performance = Math.round((revenue - dailyGoal) * 100) / 100;
            const perfPositive = performance >= 0;
            return (
              <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, fontWeight: '600', fontFamily: 'monospace', color: perfPositive ? '#10b981' : '#f59e0b' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'sans-serif' }}>🎯 vs Meta:</span>
                <span>
                  {perfPositive
                    ? `+${fmtBRL(performance)}`
                    : `-${fmtBRL(Math.abs(performance))}`}
                </span>
              </p>
            );
          })()}
        </div>
      </div>
    );
  };
}

function yFmt(v: number): string {
  if (v === 0) return 'R$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  return abs >= 1000 ? `${sign}R$${(abs / 1000).toFixed(1)}k` : `${sign}R$${abs}`;
}

const VIEW_MODES: { id: ChartViewMode; label: string; icon: string }[] = [
  { id: 'mensal', label: 'Mensal',     icon: '📅' },
  { id: 'anual',  label: 'Anual',      icon: '📆' },
  { id: 'global', label: 'Global',     icon: '🌍' },
];

export function RevenueChart({ metrics, goals, rows = [] }: RevenueChartProps) {
  const [chartView, setChartView] = useState<ChartViewMode>('mensal');
  const [showPrediction, setShowPrediction] = useState(false);
  const [predictionHorizon, setPredictionHorizon] = useState(6);

  // Dynamic picker options based on actual dates in the rows
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.date) set.add(r.date.slice(0, 7));
    }
    const list = Array.from(set).sort();
    if (list.length === 0) list.push(currentYM());
    return list;
  }, [rows]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.date) set.add(r.date.slice(0, 4));
    }
    const list = Array.from(set).sort();
    if (list.length === 0) list.push(String(new Date().getFullYear()));
    return list;
  }, [rows]);

  const [localSelectedMonth, setLocalSelectedMonth] = useState(() => {
    return availableMonths[availableMonths.length - 1] || currentYM();
  });

  const [localSelectedYear, setLocalSelectedYear] = useState(() => {
    return availableYears[availableYears.length - 1] || String(new Date().getFullYear());
  });

  // Goal reference — scaled to the active view's time unit
  const dailyGoal = useMemo(() => {
    const referenceDate = chartView === 'mensal' 
      ? `${localSelectedMonth}-15` 
      : chartView === 'anual'
        ? `${localSelectedYear}-06-15`
        : currentISODate();
    return getDailyGoalForDate(referenceDate, goals);
  }, [goals, chartView, localSelectedMonth, localSelectedYear]);

  const dailySurvivalGoal = useMemo(() => {
    return metrics.survivalDaily ?? 0;
  }, [metrics]);

  const goalRef = chartView === 'mensal' ? dailyGoal
    : chartView === 'anual' ? dailyGoal * 30.44
    : dailyGoal * 365.25;

  const survivalRef = chartView === 'mensal' ? dailySurvivalGoal
    : chartView === 'anual' ? (dailySurvivalGoal ? dailySurvivalGoal * 30.44 : undefined)
    : (dailySurvivalGoal ? dailySurvivalGoal * 365.25 : undefined);

  const historicalData = useMemo(() => {
    switch (chartView) {
      case 'mensal': return buildDailyData(rows, localSelectedMonth);
      case 'anual':  return buildMonthlyData(rows, localSelectedYear);
      case 'global': return buildYearlyData(rows);
    }
  }, [rows, localSelectedMonth, localSelectedYear, chartView]);

  const predictionPoints = useMemo(() => {
    if (!showPrediction) return [];
    if (chartView === 'mensal') return [];
    if (chartView === 'anual') return predictMonthly(metrics, localSelectedYear, predictionHorizon);
    return predictYearly(metrics, predictionHorizon);
  }, [showPrediction, chartView, metrics, localSelectedYear, predictionHorizon]);

  const data: ChartPoint[] = useMemo(() => {
    if (predictionPoints.length === 0) return historicalData;

    const futurePoints: ChartPoint[] = predictionPoints.map((p) => ({
      dateLabel:   p.label,
      dateISO:     p.key,
      revenue:     0,
      expense:     0,
      partner_in:  0,
      partner_out: 0,
      deposit:     0,
      waiver:      0,
      dayBalance:  0,
      isPrediction: true,
      predMean:       p.mean,
      predOptimistic: p.optimistic,
      predPessimistic: p.pessimistic,
      predRange:      [p.pessimistic, p.optimistic],
    }));

    const bridged = [...historicalData];
    if (bridged.length > 0 && futurePoints.length > 0) {
      const lastHistorical = bridged[bridged.length - 1];
      const lastRevenue = lastHistorical.revenue;
      bridged[bridged.length - 1] = {
        ...lastHistorical,
        predMean: lastRevenue,
        predOptimistic: lastRevenue,
        predPessimistic: lastRevenue,
        predRange: [lastRevenue, lastRevenue],
      };
    }

    return [...bridged, ...futurePoints];
  }, [historicalData, predictionPoints]);

  const canPredict = chartView !== 'mensal';

  // Summary stats
  const totalRevenue    = round2(historicalData.reduce((s, p) => s + p.revenue,  0));
  const monthExpenses   = round2(historicalData.reduce((s, p) => s + Math.abs(p.expense),  0));
  const monthPartnerIn  = round2(historicalData.reduce((s, p) => s + p.partner_in, 0));
  const monthPartnerOut = round2(historicalData.reduce((s, p) => s + Math.abs(p.partner_out), 0));
  const monthDeposit    = round2(historicalData.reduce((s, p) => s + p.deposit,  0));
  const monthWaiver     = round2(historicalData.reduce((s, p) => s + p.waiver,   0));
  const netBalance      = round2(totalRevenue + monthPartnerIn + monthDeposit + monthWaiver - monthExpenses - monthPartnerOut);

  const hasExpenses     = monthExpenses > 0;
  const hasPartnerIn    = monthPartnerIn > 0;
  const hasPartnerOut   = monthPartnerOut > 0;
  const hasDeposits     = monthDeposit > 0;
  const hasWaivers      = monthWaiver > 0;

  const scopeLabel = chartView === 'mensal'
    ? (() => {
        const [yStr, mStr] = localSelectedMonth.split('-');
        const l = new Date(parseInt(yStr), parseInt(mStr) - 1, 1)
          .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return l.charAt(0).toUpperCase() + l.slice(1);
      })()
    : chartView === 'anual'
      ? localSelectedYear
      : 'Todo o Histórico';

  if (rows.length === 0) {
    return (
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        color: 'rgba(255,255,255,0.4)',
        fontSize: '14px',
      }}>
        <span style={{ fontSize: '32px', marginBottom: '8px' }}>📊</span>
        <span>Sem dados para exibir o gráfico de receita</span>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#161b22',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '20px',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>💰 Receita e Fluxo</h3>
        
        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Modes */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {VIEW_MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => setChartView(mode.id)}
                style={{
                  background: chartView === mode.id ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                  color: chartView === mode.id ? '#c084fc' : 'rgba(255,255,255,0.4)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                }}
              >
                {mode.icon} {mode.label}
              </button>
            ))}
          </div>

          {/* Context Picker */}
          {chartView === 'mensal' && (
            <select
              value={localSelectedMonth}
              onChange={(e) => setLocalSelectedMonth(e.target.value)}
              style={{
                backgroundColor: '#1c2128',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {availableMonths.map(m => {
                const [y, mo] = m.split('-');
                const name = MONTH_NAMES_SHORT[parseInt(mo) - 1];
                return <option key={m} value={m}>{name}/{y}</option>;
              })}
            </select>
          )}

          {chartView === 'anual' && (
            <select
              value={localSelectedYear}
              onChange={(e) => setLocalSelectedYear(e.target.value)}
              style={{
                backgroundColor: '#1c2128',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}

          {/* Predictions */}
          {canPredict && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => setShowPrediction(p => !p)}
                style={{
                  background: showPrediction ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: showPrediction ? '#c084fc' : 'rgba(255,255,255,0.4)',
                  border: showPrediction ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                }}
              >
                🔮 Projetar Futuro
              </button>
              {showPrediction && (
                <select
                  value={predictionHorizon}
                  onChange={(e) => setPredictionHorizon(parseInt(e.target.value))}
                  style={{
                    backgroundColor: '#1c2128',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {[3, 6, 12, 24].map((h) => (
                    <option key={h} value={h}>+{h} {chartView === 'global' ? 'anos' : 'meses'}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '12px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Receita</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#10b981', fontFamily: 'monospace' }}>{fmtBRL(totalRevenue)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Custos</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#ef4444', fontFamily: 'monospace' }}>-{fmtBRL(monthExpenses)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Saldo Líquido</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: netBalance >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
            {netBalance >= 0 ? fmtBRL(netBalance) : `-${fmtBRL(Math.abs(netBalance))}`}
          </div>
        </div>
        {chartView === 'mensal' && dailyGoal > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Meta Diária</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{fmtBRL(dailyGoal)}</div>
          </div>
        )}
        {chartView === 'mensal' && dailySurvivalGoal > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Sobrevivência</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#06b6d4', fontFamily: 'monospace' }}>{fmtBRL(dailySurvivalGoal)}</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
        {scopeLabel}
      </div>

      {data.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '150px', fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>
          Nenhuma movimentação registrada neste período.
        </div>
      ) : (
        <>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.35)', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#10b981' }} /> Receita
            </span>
            {hasDeposits && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6' }} /> Aporte
              </span>
            )}
            {hasPartnerIn && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#06b6d4' }} /> Créd. Parceria
              </span>
            )}
            {hasWaivers && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#f59e0b' }} /> Justificativa
              </span>
            )}
            {hasExpenses && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#ef4444' }} /> Custo
              </span>
            )}
            {hasPartnerOut && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#f97316' }} /> Déb. Parceria
              </span>
            )}
            {goalRef > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '16px', height: '0px', borderTop: '2px dashed rgba(255,255,255,0.3)' }} />
                Meta {chartView === 'mensal' ? 'diária' : chartView === 'anual' ? 'mensal' : 'anual'} ({fmtBRL(goalRef)})
              </span>
            )}
            {survivalRef && survivalRef > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '16px', height: '0px', borderTop: '2px dashed rgba(6,182,212,0.5)' }} />
                Sobrevivência ({fmtBRL(survivalRef)})
              </span>
            )}
            {showPrediction && predictionPoints.length > 0 && (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }} />
                  Cone ± 1σ
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '16px', height: '0px', borderTop: '2px dashed #8b5cf6' }} />
                  Média Esperada
                </span>
              </>
            )}
          </div>

          {/* Recharts Container */}
          <div style={{ width: '100%', height: '320px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                
                {goalRef > 0 && (
                  <ReferenceLine
                    y={goalRef}
                    stroke="rgba(255,255,255,0.22)"
                    strokeDasharray="4 3"
                  />
                )}

                {survivalRef && survivalRef > 0 && (
                  <ReferenceLine
                    y={survivalRef}
                    stroke="rgba(6,182,212,0.40)"
                    strokeDasharray="6 3"
                  />
                )}

                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                  tickMargin={8}
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
                  content={makeTooltip(dailyGoal, chartView)}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />

                {/* Positive Bars Stack */}
                <Bar dataKey="revenue" name="revenue" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} stackId="positive">
                  <LabelList dataKey="revenue" content={renderRevenueLabel} />
                </Bar>
                <Bar dataKey="deposit" name="deposit" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={20} stackId="positive">
                  <LabelList dataKey="deposit" content={renderDepositLabel} />
                </Bar>
                <Bar dataKey="partner_in" name="partner_in" fill="#06b6d4" radius={[3, 3, 0, 0]} maxBarSize={20} stackId="positive">
                  <LabelList dataKey="partner_in" content={renderPartnerInLabel} />
                </Bar>
                <Bar dataKey="waiver" name="waiver" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={20} stackId="positive">
                  <LabelList dataKey="waiver" content={renderWaiverLabel} />
                </Bar>

                {/* Negative Bars Stack */}
                <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[0, 0, 3, 3]} maxBarSize={20} stackId="negative">
                  <LabelList dataKey="expense" content={renderExpenseLabel} />
                </Bar>
                <Bar dataKey="partner_out" name="partner_out" fill="#f97316" radius={[0, 0, 3, 3]} maxBarSize={20} stackId="negative">
                  <LabelList dataKey="partner_out" content={renderPartnerOutLabel} />
                </Bar>

                {/* Predictions Area */}
                {showPrediction && predictionPoints.length > 0 && (
                  <Area
                    dataKey="predRange"
                    fill="#8b5cf6"
                    fillOpacity={0.15}
                    stroke="#8b5cf6"
                    strokeOpacity={0.25}
                    strokeWidth={1}
                    type="monotone"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}

                {/* Mean Line */}
                {showPrediction && predictionPoints.length > 0 && (
                  <Line
                    dataKey="predMean"
                    dot={false}
                    stroke="#8b5cf6"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    type="monotone"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', textAlign: 'right', margin: 0 }}>
            {chartView === 'mensal'
              ? '✦ Valores distribuídos proporcionalmente pelo período de cada lançamento'
              : chartView === 'anual'
                ? '✦ Valores agregados por mês do ano selecionado'
                : '✦ Valores totais agregados por ano'}
          </p>
        </>
      )}
    </div>
  );
}
