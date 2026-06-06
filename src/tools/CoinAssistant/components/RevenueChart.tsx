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
import type { TableRow, TableMetrics } from '../types';
import { rowContributions } from '../hooks/useMetricsEngine';
import { predictMonthly, predictYearly } from '../hooks/useMathematicalPrediction';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevenueChartProps {
  rows: TableRow[];
  metrics: TableMetrics;
  dailyGoal: number;
  /** Controlled from TableEditor — the global month filter. */
  selectedMonth: string;
  /** When cost-based goal is active, shows a second survival reference line. */
  dailySurvivalGoal?: number;
}

type ChartViewMode = 'mensal' | 'anual' | 'global';

/**
 * One data-point per time unit (day / month / year depending on view).
 */
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
  // ── Prediction fields (only on forecast points) ──
  isPrediction?: boolean;
  predMean?:       number;
  predOptimistic?: number;
  predPessimistic?: number;
  /** For Area: [pessimistic, optimistic] range tuple */
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

/** Compact label for bar tops — avoids overlap on narrow columns */
function fmtLabel(v: number): string {
  if (v === 0) return '';
  const abs = Math.abs(v);
  if (abs >= 1000) return `R$${(abs / 1000).toFixed(1)}k`;
  return `R$${Math.round(abs)}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Staggered positive label — 3-step staircase pushing UP from bar top */
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

/** Staggered negative label — 3-step staircase pushing DOWN from bar bottom */
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

const renderRevenueLabel    = makePositiveLabel('#34d399');
const renderDepositLabel    = makePositiveLabel('#38bdf8');
const renderPartnerInLabel  = makePositiveLabel('#818cf8');
const renderWaiverLabel     = makePositiveLabel('#94a3b8');
const renderExpenseLabel    = makeNegativeLabel('#ef4444');
const renderPartnerOutLabel = makeNegativeLabel('#f59e0b');
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Data builders per view ────────────────────────────────────────────────────

/**
 * MENSAL: Daily ChartPoint array for the selected month.
 * Uses rowContributions() to distribute period rows proportionally.
 */
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

/**
 * ANUAL: Monthly ChartPoint array for the selected year.
 * Aggregates values by month from raw rows.
 */
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

/**
 * GLOBAL: Yearly ChartPoint array across all years.
 */
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;

    const rawData = payload[0].payload;

    // ── Prediction tooltip ──
    if (rawData.isPrediction) {
      const predMean       = rawData.predMean ?? 0;
      const predOptimistic = rawData.predOptimistic ?? 0;
      const predPessimistic = rawData.predPessimistic ?? 0;

      return (
        <div className="bg-[#1a1a2e] border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs shadow-2xl min-w-48 space-y-1.5">
          <p className="text-purple-300 font-medium pb-1 border-b border-purple-500/20 flex items-center gap-1.5">
            \uD83D\uDD2E {label}
          </p>
          <div className="space-y-1">
            <p className="font-mono flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-300" />
                <span className="font-sans font-medium text-purple-300">Cenário Otimista:</span>
              </span>
              <span className="font-semibold text-purple-300">{fmtBRL(predOptimistic)}</span>
            </p>
            <p className="font-mono flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400" />
                <span className="font-sans font-medium text-violet-400">Média Esperada:</span>
              </span>
              <span className="font-semibold text-violet-400">{fmtBRL(predMean)}</span>
            </p>
            <p className="font-mono flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500/60" />
                <span className="font-sans font-medium text-purple-400/70">Cenário Pessimista:</span>
              </span>
              <span className="font-semibold text-purple-400/70">{fmtBRL(predPessimistic)}</span>
            </p>
          </div>
          <p className="text-[10px] text-white/20 pt-1 border-t border-white/5">
            ✦ Baseado na média ± 1σ do histórico
          </p>
        </div>
      );
    }

    // ── Standard historical tooltip ──
    const revenue     = rawData.revenue ?? 0;
    const expense     = rawData.expense ? Math.abs(rawData.expense) : 0;
    const partner_in  = rawData.partner_in ?? 0;
    const partner_out = rawData.partner_out ? Math.abs(rawData.partner_out) : 0;
    const deposit     = rawData.deposit ?? 0;
    const waiver      = rawData.waiver ?? 0;

    const dailyNet = revenue - expense;

    // Context-aware header
    let headerLabel = label;
    if (viewMode === 'anual') {
      const idx = MONTH_NAMES_SHORT.indexOf(label);
      if (idx >= 0) headerLabel = MONTH_NAMES_LONG[idx];
    }

    const items = [
      { key: 'revenue', label: 'Receita', value: revenue, color: '#34d399', prefix: '💰' },
      { key: 'deposit', label: 'Aporte', value: deposit, color: '#38bdf8', prefix: '📥' },
      { key: 'partner_in', label: 'Créd. Parceria', value: partner_in, color: '#818cf8', prefix: '🤝' },
      { key: 'waiver', label: 'Justificativa', value: waiver, color: '#94a3b8', prefix: '🛡️' },
      { key: 'expense', label: 'Custo', value: expense, color: '#ef4444', prefix: '🏷️', isNegative: true },
      { key: 'partner_out', label: 'Déb. Parceria', value: partner_out, color: '#f59e0b', prefix: '📤', isNegative: true },
    ].filter(item => item.value !== 0);

    const periodLabel = viewMode === 'mensal' ? 'Saldo do Dia' : viewMode === 'anual' ? 'Saldo do Mês' : 'Saldo do Ano';

    return (
      <div className="bg-[#1a1a2e] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs shadow-2xl min-w-44 space-y-1.5">
        <p className="text-white/50 font-medium pb-1 border-b border-white/10">📅 {headerLabel}</p>

        {items.length === 0 ? (
          <p className="text-white/25 italic">Sem movimentação</p>
        ) : (
          <div className="space-y-1">
            {items.map(item => (
              <p key={item.key} className="font-mono flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-sans font-medium" style={{ color: item.color }}>{item.label}:</span>
                </span>
                <span className="font-semibold" style={{ color: item.color }}>
                  {item.isNegative ? '-' : ''}{fmtBRL(item.value)}
                </span>
              </p>
            ))}
          </div>
        )}

        <div className="pt-1.5 border-t border-white/10 space-y-1">
          <p className={`font-mono font-semibold flex items-center justify-between gap-4 ${dailyNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dailyNet >= 0 ? '#34d399' : '#ef4444' }} />
              <span className="font-sans font-medium">{periodLabel}:</span>
            </span>
            <span>{dailyNet >= 0 ? fmtBRL(dailyNet) : `-${fmtBRL(Math.abs(dailyNet))}`}</span>
          </p>

          {revenue > 0 && dailyGoal > 0 && viewMode === 'mensal' && (() => {
            const performance = Math.round((revenue - dailyGoal) * 100) / 100;
            const perfPositive = performance >= 0;
            return (
              <p className={`font-mono font-semibold flex items-center justify-between gap-4 ${perfPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className="text-white/50 font-sans font-medium">🎯 vs Meta:</span>
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

// ── Y-axis formatter ──────────────────────────────────────────────────────────

function yFmt(v: number): string {
  if (v === 0) return 'R$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  return abs >= 1000 ? `${sign}R$${(abs / 1000).toFixed(1)}k` : `${sign}R$${abs}`;
}

// ── View mode config ──────────────────────────────────────────────────────────

const VIEW_MODES: { id: ChartViewMode; label: string; icon: string }[] = [
  { id: 'mensal', label: 'Visão Mensal',     icon: '📅' },
  { id: 'anual',  label: 'Visão do Ano',     icon: '📆' },
  { id: 'global', label: 'Visão Histórica',  icon: '🌍' },
];

// ── Main component ────────────────────────────────────────────────────────────

export function RevenueChart({ rows, metrics, dailyGoal, selectedMonth, dailySurvivalGoal }: RevenueChartProps) {
  const [chartView, setChartView] = useState<ChartViewMode>('mensal');
  const [showPrediction, setShowPrediction] = useState(false);
  const [predictionHorizon, setPredictionHorizon] = useState(6);

  const selectedYear = selectedMonth.slice(0, 4);

  // Build data for the active view
  const historicalData = useMemo(() => {
    switch (chartView) {
      case 'mensal': return buildDailyData(rows, selectedMonth);
      case 'anual':  return buildMonthlyData(rows, selectedYear);
      case 'global': return buildYearlyData(rows);
    }
  }, [rows, selectedMonth, selectedYear, chartView]);

  // Generate prediction points (only for anual/global views)
  const predictionPoints = useMemo(() => {
    if (!showPrediction) return [];
    if (chartView === 'mensal') return []; // Predictions not meaningful at daily level
    if (chartView === 'anual') return predictMonthly(metrics, selectedYear, predictionHorizon);
    return predictYearly(metrics, predictionHorizon);
  }, [showPrediction, chartView, metrics, selectedYear, predictionHorizon]);

  // Merge historical + prediction into a single array for the chart
  const data: ChartPoint[] = useMemo(() => {
    if (predictionPoints.length === 0) return historicalData;

    // Convert prediction points to ChartPoint shape
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

    // Add a bridge point: the last historical data point gets prediction fields
    // so the line/area seamlessly connects from history to forecast
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

  // Can we show predictions in this view?
  const canPredict = chartView !== 'mensal';

  // Summary stats — scope-aware
  const totalRevenue    = round2(data.reduce((s, p) => s + p.revenue,  0));
  const monthExpenses   = round2(data.reduce((s, p) => s + Math.abs(p.expense),  0));
  const monthPartnerIn  = round2(data.reduce((s, p) => s + p.partner_in, 0));
  const monthPartnerOut = round2(data.reduce((s, p) => s + Math.abs(p.partner_out), 0));
  const monthDeposit    = round2(data.reduce((s, p) => s + p.deposit,  0));
  const monthWaiver     = round2(data.reduce((s, p) => s + p.waiver,   0));
  const netBalance      = round2(totalRevenue - monthExpenses);
  const hasExpenses     = monthExpenses > 0;
  const hasPartnerIn    = monthPartnerIn > 0;
  const hasPartnerOut   = monthPartnerOut > 0;
  const hasDeposits     = monthDeposit > 0;
  const hasWaivers      = monthWaiver > 0;

  // Context label for the scope
  const scopeLabel = chartView === 'mensal'
    ? (() => {
        const l = new Date(parseInt(selectedYear), parseInt(selectedMonth.slice(5)) - 1, 1)
          .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return l.charAt(0).toUpperCase() + l.slice(1);
      })()
    : chartView === 'anual'
      ? selectedYear
      : 'Todo o Histórico';

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-white/25">
        <span className="text-3xl">📊</span>
        <span className="text-sm">Nenhum dado para exibir. Adicione entradas na aba Planilha.</span>
      </div>
    );
  }

  // Goal reference — scaled to the active view's time unit
  const goalRef = chartView === 'mensal' ? dailyGoal
    : chartView === 'anual' ? dailyGoal * 30.44
    : dailyGoal * 365.25;

  const survivalRef = chartView === 'mensal' ? dailySurvivalGoal
    : chartView === 'anual' ? (dailySurvivalGoal ? dailySurvivalGoal * 30.44 : undefined)
    : (dailySurvivalGoal ? dailySurvivalGoal * 365.25 : undefined);

  return (
    <div className="space-y-4">
      {/* ── View mode + Prediction toggle row ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5 w-fit">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setChartView(mode.id)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                chartView === mode.id
                  ? 'bg-emerald-500/20 text-emerald-300 shadow'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {mode.icon} {mode.label}
            </button>
          ))}
        </div>

        {/* Prediction toggle + horizon (only for anual/global) */}
        {canPredict && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrediction((v) => !v)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                showPrediction
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 shadow-lg shadow-purple-500/10'
                  : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60'
              }`}
            >
              🔮 Projetar Futuro
            </button>
            {showPrediction && (
              <select
                value={predictionHorizon}
                onChange={(e) => setPredictionHorizon(parseInt(e.target.value))}
                className="bg-[#1a1f2e] text-white text-[11px] rounded-lg px-2 py-1.5 border border-white/10 outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
              >
                {[3, 6, 12, 24].map((h) => (
                  <option key={h} value={h} style={{ background: '#1a1a2e', color: '#fff' }}>+{h} {chartView === 'global' ? 'anos' : 'meses'}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* ── Summary stats ── */}
      <div className="flex flex-wrap gap-x-6 gap-y-3 justify-end text-right">
        <div>
          <div className="text-xs text-white/30 font-medium">Receita</div>
          <div className="text-sm font-mono font-semibold text-emerald-400">{fmtBRL(totalRevenue)}</div>
        </div>
        <div>
          <div className="text-xs text-white/30 font-medium">Custos</div>
          <div className="text-sm font-mono font-semibold text-rose-400">-{fmtBRL(monthExpenses)}</div>
        </div>
        <div>
          <div className="text-xs text-white/30 font-medium">Saldo Líquido</div>
          <div className={`text-sm font-mono font-semibold ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netBalance >= 0 ? fmtBRL(netBalance) : `-${fmtBRL(Math.abs(netBalance))}`}
          </div>
        </div>
        {chartView === 'mensal' && dailyGoal > 0 && (
          <div>
            <div className="text-xs text-white/30 font-medium">Meta Diária</div>
            <div className="text-sm font-mono font-semibold text-white/60">{fmtBRL(dailyGoal)}</div>
          </div>
        )}
        {chartView === 'mensal' && dailySurvivalGoal && dailySurvivalGoal > 0 && (
          <div>
            <div className="text-xs text-white/30 font-medium">Sobrevivência</div>
            <div className="text-sm font-mono font-semibold text-cyan-400">{fmtBRL(dailySurvivalGoal)}</div>
          </div>
        )}
      </div>

      {/* ── Scope label ── */}
      <div className="text-xs text-white/20 text-center">
        {scopeLabel}
      </div>

      {/* ── Empty data ── */}
      {data.length === 0 && (
        <div className="flex items-center justify-center h-36 text-white/25 text-sm">
          Nenhuma receita registrada neste período.
        </div>
      )}

      {/* ── Legend + Chart ── */}
      {data.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/35">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#34d399' }} /> Receita
            </span>
            {hasDeposits && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#38bdf8' }} /> Aporte
              </span>
            )}
            {hasPartnerIn && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#818cf8' }} /> Créd. Parceria
              </span>
            )}
            {hasWaivers && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#94a3b8' }} /> Justificativa
              </span>
            )}
            {hasExpenses && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} /> Custo
              </span>
            )}
            {hasPartnerOut && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }} /> Déb. Parceria
              </span>
            )}
            {goalRef > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-white/30" />
                Meta {chartView === 'mensal' ? 'diária' : chartView === 'anual' ? 'mensal' : 'anual'}
              </span>
            )}
            {survivalRef && survivalRef > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-cyan-400/50" />
                Sobrevivência
              </span>
            )}
            {showPrediction && predictionPoints.length > 0 && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-purple-500/30 border border-purple-400/40" />
                  Cone de Confiança ± 1σ
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-purple-400" />
                  Média Esperada
                </span>
              </>
            )}
          </div>

          {/* ── Chart (PDF-export friendly: solid backgrounds, no backdrop-filter) ── */}
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 36 }}>
              {/* Zero line */}
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

              {/* Goal reference */}
              {goalRef > 0 && (
                <ReferenceLine
                  y={goalRef}
                  stroke="rgba(255,255,255,0.22)"
                  strokeDasharray="4 3"
                  label={{
                    value: `Meta ${fmtBRL(goalRef)}`,
                    position: 'insideTopRight',
                    fill: 'rgba(255,255,255,0.28)',
                    fontSize: 10,
                  }}
                />
              )}

              {/* Survival reference */}
              {survivalRef && survivalRef > 0 && (
                <ReferenceLine
                  y={survivalRef}
                  stroke="rgba(34,211,238,0.40)"
                  strokeDasharray="6 3"
                  label={{
                    value: `Sobrev. ${fmtBRL(survivalRef)}`,
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
                tickMargin={28}
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

              {/* ── Revenue bars (positive / green) ── */}
              <Bar
                dataKey="revenue"
                name="revenue"
                fill="#34d399"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                stackId="positive"
              >
                <LabelList dataKey="revenue" content={renderRevenueLabel} />
              </Bar>

              {/* ── Deposit bars (positive / sky) ── */}
              <Bar
                dataKey="deposit"
                name="deposit"
                fill="#38bdf8"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                stackId="positive"
              >
                <LabelList dataKey="deposit" content={renderDepositLabel} />
              </Bar>

              {/* ── Partner-in bars (positive / indigo) ── */}
              <Bar
                dataKey="partner_in"
                name="partner_in"
                fill="#818cf8"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                stackId="positive"
              >
                <LabelList dataKey="partner_in" content={renderPartnerInLabel} />
              </Bar>

              {/* ── Waiver bars (positive / slate) ── */}
              <Bar
                dataKey="waiver"
                name="waiver"
                fill="#94a3b8"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                stackId="positive"
              >
                <LabelList dataKey="waiver" content={renderWaiverLabel} />
              </Bar>

              {/* ── Expense bars (negative / rose) ── */}
              <Bar
                dataKey="expense"
                name="expense"
                fill="#ef4444"
                radius={[0, 0, 3, 3]}
                maxBarSize={20}
                stackId="negative"
              >
                <LabelList dataKey="expense" content={renderExpenseLabel} />
              </Bar>

              {/* ── Partner-out bars (negative / amber) ── */}
              <Bar
                dataKey="partner_out"
                name="partner_out"
                fill="#f59e0b"
                radius={[0, 0, 3, 3]}
                maxBarSize={20}
                stackId="negative"
              >
                <LabelList dataKey="partner_out" content={renderPartnerOutLabel} />
              </Bar>

              {/* ── Confidence Cone (Area: pessimistic → optimistic range) ── */}
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

              {/* ── Mean Trend Line (dashed through cone center) ── */}
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

          {/* ── Rateio notice ── */}
          <p className="text-xs text-white/20 text-right">
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
