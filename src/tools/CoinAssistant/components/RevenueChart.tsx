import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { TableRow, TableMetrics } from '../types';
import { rowContributions } from '../hooks/useMetricsEngine';

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

/**
 * One data-point per calendar day in the selected month.
 */
interface ChartPoint {
  dateLabel:   string;  // "01/04"
  dateISO:     string;  // "YYYY-MM-DD"
  revenue:     number;
  expense:     number;  // negative
  partner_in:  number;  // positive
  partner_out: number;  // negative
  deposit:     number;  // positive
  waiver:      number;  // positive
  dayBalance:  number;
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

  // ── Step 1: build daily buckets per entry type ────────────────────────────
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

  // ── Step 2: build day-by-day ChartPoints ───────────────────────────────────
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

// ── Custom tooltip factory (receives dailyGoal via closure) ──────────────────

function makeTooltip(dailyGoal: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;

    const rawData = payload[0].payload;
    const revenue     = rawData.revenue ?? 0;
    const expense     = rawData.expense ? Math.abs(rawData.expense) : 0;
    const partner_in  = rawData.partner_in ?? 0;
    const partner_out = rawData.partner_out ? Math.abs(rawData.partner_out) : 0;
    const deposit     = rawData.deposit ?? 0;
    const waiver      = rawData.waiver ?? 0;

    const dailyNet = revenue - expense;

    const items = [
      { key: 'revenue', label: 'Receita', value: revenue, color: '#34d399', prefix: '💰' },
      { key: 'deposit', label: 'Aporte', value: deposit, color: '#38bdf8', prefix: '📥' },
      { key: 'partner_in', label: 'Créd. Parceria', value: partner_in, color: '#818cf8', prefix: '🤝' },
      { key: 'waiver', label: 'Justificativa', value: waiver, color: '#94a3b8', prefix: '🛡️' },
      { key: 'expense', label: 'Custo', value: expense, color: '#ef4444', prefix: '🏷️', isNegative: true },
      { key: 'partner_out', label: 'Déb. Parceria', value: partner_out, color: '#f59e0b', prefix: '📤', isNegative: true },
    ].filter(item => item.value !== 0);

    return (
      <div className="bg-[#1a1a2e] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs shadow-2xl min-w-44 space-y-1.5">
        <p className="text-white/50 font-medium pb-1 border-b border-white/10">📅 {label}</p>

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
              <span className="font-sans font-medium">Saldo do Dia:</span>
            </span>
            <span>{dailyNet >= 0 ? fmtBRL(dailyNet) : `-${fmtBRL(Math.abs(dailyNet))}`}</span>
          </p>

          {revenue > 0 && dailyGoal > 0 && (() => {
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

// ── Main component ────────────────────────────────────────────────────────────

export function RevenueChart({ rows, metrics, dailyGoal, selectedMonth, dailySurvivalGoal }: RevenueChartProps) {
  const data = useMemo(
    () => buildCashFlowData(rows, selectedMonth),
    [rows, selectedMonth],
  );

  // Summary stats
  const monthExpenses = round2(data.reduce((s, p) => s + Math.abs(p.expense),  0));
  const monthPartnerIn  = round2(data.reduce((s, p) => s + p.partner_in, 0));
  const monthPartnerOut = round2(data.reduce((s, p) => s + Math.abs(p.partner_out), 0));
  const monthDeposit  = round2(data.reduce((s, p) => s + p.deposit,  0));
  const monthWaiver   = round2(data.reduce((s, p) => s + p.waiver,   0));
  const hasExpenses   = monthExpenses > 0;
  const hasPartnerIn  = monthPartnerIn > 0;
  const hasPartnerOut = monthPartnerOut > 0;
  const hasDeposits   = monthDeposit > 0;
  const hasWaivers    = monthWaiver > 0;

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
      <div className="flex flex-wrap gap-x-6 gap-y-3 justify-end text-right">
        <div>
          <div className="text-xs text-white/30 font-medium">Receita</div>
          <div className="text-sm font-mono font-semibold text-emerald-400">{fmtBRL(metrics.grossTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-white/30 font-medium">Custos</div>
          <div className="text-sm font-mono font-semibold text-rose-400">-{fmtBRL(metrics.totalExpenses)}</div>
        </div>
        <div>
          <div className="text-xs text-white/30 font-medium">Saldo Líquido</div>
          <div className={`text-sm font-mono font-semibold ${metrics.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {metrics.netBalance >= 0 ? fmtBRL(metrics.netBalance) : `-${fmtBRL(Math.abs(metrics.netBalance))}`}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/30 font-medium">Justificativas</div>
          <div className="text-sm font-mono font-semibold text-slate-400">{fmtBRL(metrics.totalWaiverCredit)}</div>
        </div>
        <div>
          <div className="text-xs text-white/30 font-medium">Crédito Parceria</div>
          <div className="text-sm font-mono font-semibold text-indigo-400">{fmtBRL(metrics.totalPartnerIn)}</div>
        </div>
        <div>
          <div className="text-xs text-white/30 font-medium">Débito Parceria</div>
          <div className="text-sm font-mono font-semibold text-amber-400">-{fmtBRL(metrics.totalPartnerOut)}</div>
        </div>
        <div>
          <div className="text-xs text-white/30 font-medium">Meta Diária</div>
          <div className="text-sm font-mono font-semibold text-white/60">{fmtBRL(dailyGoal)}</div>
        </div>
        {metrics.survivalDaily > 0 && (
          <div>
            <div className="text-xs text-white/30 font-medium">Sobrevivência</div>
            <div className="text-sm font-mono font-semibold text-cyan-400">{fmtBRL(metrics.survivalDaily)}</div>
          </div>
        )}
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
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 36 }}>
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
                content={makeTooltip(dailyGoal)}
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
