/**
 * PrintableReport — Light-themed, print-optimized component rendered off-screen.
 * Serialised via .outerHTML into a popup window for native browser print (Save as PDF).
 * This approach preserves clickable <a> links and CSS page-break rules.
 *
 * Layout:
 *   1. Header (logo placeholder + title)
 *   2. Monthly Income Metrics
 *   3. Prorated Expense Metrics
 *   4. Survival Goals (when costBasedTarget is active)
 *   5. Cash-flow chart (Recharts SVG on white background)
 *   6. [PAGE BREAK] Static practical guide / sales pitch
 */

import { forwardRef } from 'react';
import {
  ComposedChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import type { TableRow, TableMetrics, CostBasedTarget, MonthMetrics, TableGoals } from '../types';
import { rowContributions } from '../hooks/useMetricsEngine';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Compact label for bar tops — avoids overlap on narrow columns */
function fmtLabel(v: number): string {
  if (v === 0) return '';
  const abs = Math.abs(v);
  if (abs >= 1000) return `R$${(abs / 1000).toFixed(1)}k`;
  return `R$${Math.round(abs)}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Staggered revenue label — 3-step staircase pushing UP from bar top */
function renderRevenueLabel(props: any) {
  const { x, y, width, value, index } = props;
  if (!value || value === 0) return null;
  const step = (index ?? 0) % 3;
  const yOff = step * 12;
  return (
    <text
      x={x + width / 2}
      y={y - yOff - 4}
      textAnchor="middle"
      fill="#000000"
      fontSize={9}
      fontWeight={600}
      fontFamily="monospace"
    >
      {fmtLabel(value)}
    </text>
  );
}

/** Staggered expense label — 3-step staircase pushing DOWN from bar bottom */
function renderExpenseLabel(props: any) {
  const { x, y, width, height, value, index } = props;
  if (!value || value === 0) return null;
  const step = (index ?? 0) % 3;
  const yOff = step * 12;
  return (
    <text
      x={x + width / 2}
      y={y + (height ?? 0) + yOff + 12}
      textAnchor="middle"
      fill="#000000"
      fontSize={9}
      fontWeight={600}
      fontFamily="monospace"
    >
      {fmtLabel(value)}
    </text>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Build daily chart data (same logic as RevenueChart but inlined) */
function buildChartData(rows: TableRow[], ym: string) {
  const [yearStr, monthStr] = ym.split('-');
  const year      = parseInt(yearStr, 10);
  const month     = parseInt(monthStr, 10);
  const totalDays = daysInMonth(year, month);
  const today     = new Date();
  const todayISO  = `${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
  const isThisMonth = ym === `${today.getFullYear()}-${pad2(today.getMonth()+1)}`;

  const revMap: Record<string, number> = {};
  const expMap: Record<string, number> = {};

  for (const row of rows) {
    const isRevenue = row.entryType !== 'deposit' && row.entryType !== 'expense' && row.entryType !== 'waiver' && row.value > 0;
    const isExpense = row.entryType === 'expense' && row.value > 0;
    if (!isRevenue && !isExpense) continue;

    const contributions = rowContributions(row);
    for (const c of contributions) {
      if (!c.date.startsWith(ym + '-')) continue;
      if (isRevenue) revMap[c.date] = round2((revMap[c.date] ?? 0) + c.value);
      if (isExpense) expMap[c.date] = round2((expMap[c.date] ?? 0) + c.value);
    }
  }

  const points: { dateLabel: string; revenue: number; expenseNeg: number }[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dateISO = `${yearStr}-${monthStr}-${pad2(d)}`;
    if (isThisMonth && dateISO > todayISO) break;
    const revenue = round2(revMap[dateISO] ?? 0);
    const expense = round2(expMap[dateISO] ?? 0);
    points.push({
      dateLabel: `${pad2(d)}/${monthStr}`,
      revenue,
      expenseNeg: expense > 0 ? -expense : 0,
    });
  }
  return points;
}

/** Survival goals from global expense data */
function computeSurvivalForPdf(
  rows: TableRow[],
  selectedMonth: string,
): { daily: number; weekly: number; monthly: number } | null {
  let earliest = '';
  let latest = '';
  let total = 0;

  for (const r of rows) {
    if (r.entryType !== 'expense' || r.value <= 0) continue;
    total += r.value;
    const start = r.periodStart || r.date;
    const end   = r.periodEnd   || r.date;
    if (!earliest || start < earliest) earliest = start;
    if (!latest   || end   > latest)   latest   = end;
  }

  if (total <= 0 || !earliest) return null;
  const msA = new Date(earliest + 'T12:00:00').getTime();
  const msB = new Date(latest   + 'T12:00:00').getTime();
  const globalDays = Math.max(1, Math.round(Math.abs(msB - msA) / 86_400_000) + 1);
  const daily = globalDays > 0 ? total / globalDays : 0;
  if (daily <= 0) return null;

  const [y, m] = selectedMonth.split('-').map(Number);
  const mDays = daysInMonth(y, m);
  return { daily, weekly: daily * 7, monthly: daily * mDays };
}

/** Prorated expense total for a specific month (same accrual logic as MetricsPanel). */
function computeProratedExpenses(rows: TableRow[], selectedMonth: string): number {
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const mStart = `${selectedMonth}-01`;
  const mEnd   = `${selectedMonth}-${pad2(daysInMonth(selY, selM))}`;
  let total = 0;

  for (const r of rows) {
    if (r.entryType !== 'expense' || r.value <= 0) continue;
    const expStart = r.periodStart || r.date;
    const expEnd   = r.periodEnd   || r.date;
    if (expStart > mEnd || expEnd < mStart) continue;
    const overlapStart = expStart < mStart ? mStart : expStart;
    const overlapEnd   = expEnd   > mEnd   ? mEnd   : expEnd;
    const totalDays  = Math.max(1, Math.round(Math.abs(new Date(expEnd + 'T12:00:00').getTime() - new Date(expStart + 'T12:00:00').getTime()) / 86_400_000) + 1);
    const activeDays = Math.max(1, Math.round(Math.abs(new Date(overlapEnd + 'T12:00:00').getTime() - new Date(overlapStart + 'T12:00:00').getTime()) / 86_400_000) + 1);
    total += (r.value / totalDays) * activeDays;
  }
  return round2(total);
}

// ── Props ────────────────────────────────────────────────────────────────────

interface PrintableReportProps {
  tableName: string;
  rows: TableRow[];
  metrics: TableMetrics;
  selectedMonth: string;
  dailyGoal: number;
  goals: TableGoals;
  costBasedTarget?: CostBasedTarget;
}

// ── Component ────────────────────────────────────────────────────────────────

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(
  function PrintableReport({ tableName, rows, metrics, selectedMonth, dailyGoal, goals, costBasedTarget }, ref) {
    const [selY, selM] = selectedMonth.split('-').map(Number);
    const monthName = new Date(selY, selM - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const monthMetrics: MonthMetrics | null = metrics.byMonth[selectedMonth] ?? null;
    const mDays = daysInMonth(selY, selM);

    // Chart data
    const chartData = buildChartData(rows, selectedMonth);
    const hasExpenses = chartData.some(p => p.expenseNeg < 0);

    // Survival goals
    const survival = costBasedTarget ? computeSurvivalForPdf(rows, selectedMonth) : null;

    // Prorated expense metrics
    const expenseTotal = computeProratedExpenses(rows, selectedMonth);
    const expenseDaily  = mDays > 0 ? round2(expenseTotal / mDays) : 0;
    const expenseWeekly = round2(expenseDaily * 7);

    return (
      <div
        ref={ref}
        style={{
          width: '794px', // A4 width at 96 DPI
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          backgroundColor: '#ffffff',
          color: '#1a1a2e',
          padding: '40px',
          fontSize: '13px',
          lineHeight: '1.5',
        }}
      >
        {/* ═══════════════════════════════════════════════════════════════════
            HEADER
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ borderBottom: '2px solid #7c3aed', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const }}>
              💰 Assistente Moeda — Relatório Financeiro
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a2e', margin: '4px 0 0' }}>
              {tableName}
            </h1>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: '12px', color: '#666' }}>Referência</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a2e', textTransform: 'capitalize' as const }}>{monthName}</div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MONTHLY METRICS
            ═══════════════════════════════════════════════════════════════════ */}
        {monthMetrics && (
          <div style={{ marginBottom: '24px', breakInside: 'avoid' as const }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
              Receitas do Mês
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Receita Bruta', value: fmtBRL(monthMetrics.grossMonthly), color: '#059669' },
                { label: 'Média Diária', value: fmtBRL(monthMetrics.dailyAvg), color: monthMetrics.dailyAvg >= dailyGoal ? '#059669' : '#d97706' },
                { label: 'Média Semanal', value: fmtBRL(monthMetrics.weeklyAvg), color: '#1a1a2e' },
                { label: 'Dias no Mês', value: `${mDays} dias`, color: '#1a1a2e' },
              ].map((card) => (
                <div key={card.label} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center' as const,
                }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' as const }}>{card.label}</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: card.color, marginTop: '4px', fontFamily: 'monospace' }}>{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PRORATED EXPENSE METRICS
            ═══════════════════════════════════════════════════════════════════ */}
        {expenseTotal > 0 && (
          <div style={{ marginBottom: '24px', breakInside: 'avoid' as const }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
              💸 Custos Rateados do Mês
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Total de Gastos', value: fmtBRL(expenseTotal), color: '#dc2626' },
                { label: 'Média Semanal', value: fmtBRL(expenseWeekly), color: '#b91c1c' },
                { label: 'Média Diária', value: fmtBRL(expenseDaily), color: '#b91c1c' },
              ].map((card) => (
                <div key={card.label} style={{
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center' as const,
                  backgroundColor: '#fff5f5',
                }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' as const }}>{card.label}</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: card.color, marginTop: '4px', fontFamily: 'monospace' }}>{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SURVIVAL GOALS (only when cost toggle is active)
            ═══════════════════════════════════════════════════════════════════ */}
        {survival && (
          <div style={{ marginBottom: '24px', border: '1px solid #e0e7ff', borderRadius: '8px', padding: '16px', backgroundColor: '#f5f3ff', breakInside: 'avoid' as const }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
              🛡️ Metas de Sobrevivência (Regime de Competência)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Meta Mensal', value: fmtBRL(survival.monthly), sub: `${mDays} dias × ${fmtBRL(survival.daily)}/dia` },
                { label: 'Meta Semanal', value: fmtBRL(survival.weekly), sub: 'diária × 7' },
                { label: 'Meta Diária', value: fmtBRL(survival.daily), sub: 'custo global ÷ dias de parceria' },
              ].map((card) => (
                <div key={card.label} style={{ textAlign: 'center' as const }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' as const }}>{card.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#4c1d95', marginTop: '4px', fontFamily: 'monospace' }}>{card.value}</div>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>{card.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CHART — Recharts with fixed width (no ResponsiveContainer)
            ═══════════════════════════════════════════════════════════════════ */}
        {chartData.length > 0 && (
          <div style={{ marginBottom: '28px', breakInside: 'avoid' as const }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
              Fluxo de Caixa Diário
            </h2>
            <ComposedChart width={714} height={300} data={chartData} margin={{ top: 44, right: 12, left: 0, bottom: 40 }}>
              <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />
              {dailyGoal > 0 && (
                <ReferenceLine y={dailyGoal} stroke="#9ca3af" strokeDasharray="4 3" label={{ value: `Meta ${fmtBRL(dailyGoal)}`, position: 'insideTopRight', fill: '#6b7280', fontSize: 9 }} />
              )}
              {survival && survival.daily > 0 && (
                <ReferenceLine y={survival.daily} stroke="#7c3aed" strokeDasharray="6 3" label={{ value: `Sobrev. ${fmtBRL(survival.daily)}`, position: 'insideBottomRight', fill: '#7c3aed', fontSize: 9 }} />
              )}
              <XAxis dataKey="dateLabel" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval={chartData.length > 20 ? Math.ceil(chartData.length / 15) - 1 : 0} />
              <YAxis tickFormatter={(v: number) => v >= 1000 || v <= -1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`} tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={52} />
              <Bar dataKey="revenue" fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={16}>
                <LabelList dataKey="revenue" content={renderRevenueLabel} />
              </Bar>
              {hasExpenses && (
                <Bar dataKey="expenseNeg" fill="#e11d48" radius={[0, 0, 3, 3]} maxBarSize={16}>
                  <LabelList dataKey="expenseNeg" content={renderExpenseLabel} />
                </Bar>
              )}
            </ComposedChart>
            <div style={{ fontSize: '9px', color: '#9ca3af', textAlign: 'right' as const, marginTop: '4px' }}>
              ✦ Valores distribuídos proporcionalmente pelo período de cada lançamento
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            COMPACT SUMMARY — Must fit on same page as chart above.
            Uses tight 8-9pt fonts and 3-col grids to stay compact.
            ═══════════════════════════════════════════════════════════════════ */}
        {(() => {
          const yr = String(selY);
          const ym = metrics.byYear[yr];
          const weeklyGoal = (goals.weeklyGoals && goals.weeklyGoals[selY]) || 0;
          const dailyG = dailyGoal;
          const monthlyGoal = round2(weeklyGoal * 4.345);

          // Partnership span
          const allDates = rows.filter(r => r.value > 0).map(r => r.periodStart || r.date).sort();
          const firstDate = allDates[0] || selectedMonth + '-01';
          const spanDays = Math.max(1, Math.round(Math.abs(new Date().getTime() - new Date(firstDate + 'T12:00:00').getTime()) / 86_400_000));
          const spanMonths = Math.round(spanDays / 30.44);

          // Compact label style
          const lbl: React.CSSProperties = { fontSize: '8px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.3px' };
          const val: React.CSSProperties = { fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', marginTop: '1px' };
          const cell: React.CSSProperties = { padding: '5px 6px' };

          return (
            <div style={{ marginTop: '12px', breakInside: 'avoid' as const }}>
              {/* ── Section Title ── */}
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#7c3aed', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '6px', borderBottom: '1px solid #e5e7eb', paddingBottom: '3px' }}>
                📋 Painel Consolidado
              </div>

              {/* ── Row 1: Global + Annual Metrics (6-col) ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '6px', backgroundColor: '#fafafa' }}>
                {/* Global */}
                <div style={cell}>
                  <div style={lbl}>Total Bruto</div>
                  <div style={{ ...val, color: '#059669' }}>{fmtBRL(metrics.grossTotal)}</div>
                </div>
                <div style={cell}>
                  <div style={lbl}>Total Custos</div>
                  <div style={{ ...val, color: '#dc2626' }}>{fmtBRL(metrics.totalExpenses)}</div>
                </div>
                <div style={cell}>
                  <div style={lbl}>Saldo Líquido</div>
                  <div style={{ ...val, color: metrics.netBalance >= 0 ? '#059669' : '#dc2626' }}>{fmtBRL(metrics.netBalance)}</div>
                </div>
                {/* Year-scoped */}
                <div style={cell}>
                  <div style={lbl}>Bruto {yr}</div>
                  <div style={{ ...val, color: '#1a1a2e' }}>{fmtBRL(ym?.grossAnnual ?? 0)}</div>
                </div>
                <div style={cell}>
                  <div style={lbl}>Média Diária {yr}</div>
                  <div style={{ ...val, color: '#1a1a2e' }}>{fmtBRL(ym?.dailyAvg ?? 0)}</div>
                </div>
                <div style={cell}>
                  <div style={lbl}>Média Mensal {yr}</div>
                  <div style={{ ...val, color: '#1a1a2e' }}>{fmtBRL(ym?.monthlyAvg ?? 0)}</div>
                </div>
              </div>

              {/* ── Row 2: Survival Goals (3-col) ── */}
              {metrics.survivalDaily > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid #e0e7ff', borderRadius: '6px', marginBottom: '6px', backgroundColor: '#f5f3ff' }}>
                  <div style={cell}>
                    <div style={lbl}>🛡️ Sobrevivência Diária</div>
                    <div style={{ ...val, color: '#4c1d95' }}>{fmtBRL(metrics.survivalDaily)}</div>
                  </div>
                  <div style={cell}>
                    <div style={lbl}>🛡️ Sobrevivência Semanal</div>
                    <div style={{ ...val, color: '#4c1d95' }}>{fmtBRL(metrics.survivalWeekly)}</div>
                  </div>
                  <div style={cell}>
                    <div style={lbl}>🛡️ Sobrevivência Mensal</div>
                    <div style={{ ...val, color: '#4c1d95' }}>{fmtBRL(metrics.survivalMonthly)}</div>
                  </div>
                </div>
              )}

              {/* ── Row 3: Operational & Partnership (6-col) ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                <div style={cell}>
                  <div style={lbl}>Meta Diária</div>
                  <div style={{ ...val, color: '#7c3aed' }}>{dailyG > 0 ? fmtBRL(dailyG) : '—'}</div>
                </div>
                <div style={cell}>
                  <div style={lbl}>Meta Semanal</div>
                  <div style={{ ...val, color: '#7c3aed' }}>{weeklyGoal > 0 ? fmtBRL(weeklyGoal) : '—'}</div>
                </div>
                <div style={cell}>
                  <div style={lbl}>Meta Mensal</div>
                  <div style={{ ...val, color: '#7c3aed' }}>{monthlyGoal > 0 ? fmtBRL(monthlyGoal) : '—'}</div>
                </div>
                <div style={cell}>
                  <div style={lbl}>Parceria</div>
                  <div style={{ ...val, color: '#1a1a2e' }}>{spanMonths} meses ({spanDays}d)</div>
                </div>
                <div style={cell}>
                  <div style={lbl}>Banco de Tempo</div>
                  <div style={{ ...val, color: metrics.timeBankBalance >= 0 ? '#059669' : '#dc2626' }}>
                    {metrics.timeBankBalance >= 0 ? '+' : ''}{metrics.timeBankBalance.toFixed(1)} sem.
                  </div>
                </div>
                <div style={cell}>
                  <div style={lbl}>Saldo Metas</div>
                  <div style={{ ...val, color: metrics.globalGoalBalance >= 0 ? '#059669' : '#dc2626' }}>{fmtBRL(metrics.globalGoalBalance)}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════════
            PAGE BREAK + PRACTICAL GUIDE
            ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'block', breakBefore: 'page' as const, pageBreakBefore: 'always' as const, paddingTop: '32px' }}>
          {/* Hero */}
          <div style={{ textAlign: 'center' as const, marginBottom: '28px' }}>
            <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '999px', backgroundColor: '#f3e8ff', color: '#7c3aed', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', marginBottom: '12px' }}>
              💰 Assistente Moeda — Guia Prático
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1a1a2e', margin: '0 0 8px' }}>
              Assuma o Volante do seu Fluxo de Caixa
            </h2>
            <p style={{ fontSize: '12px', color: '#6b7280', maxWidth: '520px', margin: '0 auto' }}>
              O Assistente Moeda não é apenas uma planilha — é um motor de inteligência financeira. Descubra a sua Meta Diária de Sobrevivência real e pare de ser surpreendido por contas anuais invisíveis.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '14px', flexWrap: 'wrap' as const }}>
              {[
                '⚙️ Rateio Automático de Custos Fixos (Regime de Competência)',
                '📊 Separação inteligente de despesas do dia a dia',
                '🎯 Metas Dinâmicas que se ajustam ao tamanho do mês',
              ].map((t) => (
                <span key={t} style={{ fontSize: '10px', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', backgroundColor: '#f9fafb' }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Section: O Problema */}
          <div style={{ marginBottom: '24px', breakInside: 'avoid' as const }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>O Problema</div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a2e', margin: '0 0 10px' }}>A Ilusão do Lucro e o Pesadelo das Contas Anuais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <PdfCard icon="💸" title="A Falsa Sensação de Riqueza" borderColor="#fecaca" bgColor="#fff5f5">
                Você faz um bom dinheiro na semana, mas esquece que o IPVA e o Seguro estão correndo em silêncio. Quando a conta chega, o lucro desaparece.
              </PdfCard>
              <PdfCard icon="📉" title="Planilhas Que Mentem" borderColor="#fecaca" bgColor="#fff5f5">
                Lançar um gasto de R$ 3.000 em Janeiro faz aquele mês parecer um desastre, e os outros meses parecerem lucrativos demais.
              </PdfCard>
            </div>
            <PdfCard icon="🪞" title="A Verdade Inconveniente" borderColor="#fde68a" bgColor="#fffbeb">
              Muitos motoristas e autônomos acreditam que basta anotar o que entra e o que sai no dia. A verdade é que sem diluir os custos de longo prazo, você está dirigindo de olhos vendados.
            </PdfCard>
          </div>

          {/* Section: O Resultado */}
          <div style={{ marginBottom: '24px', breakInside: 'avoid' as const }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#059669', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>O Resultado</div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a2e', margin: '0 0 10px' }}>A Clareza da "Meta de Sobrevivência"</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <PdfCard icon="🧮" title="Saber Exatamente o Seu Custo Diário" borderColor="#a7f3d0" bgColor="#f0fdf4">
                Imagine ligar o carro sabendo que os primeiros R$ 108,00 do dia já estão comprometidos com o custo rateado do seu ano. O que passar disso, é lucro real.
              </PdfCard>
              <PdfCard icon="📅" title="Previsibilidade Absoluta" borderColor="#a7f3d0" bgColor="#f0fdf4">
                Mês de 28 dias ou 31 dias? O painel ajusta a sua meta de sobrevivência automaticamente para a realidade do calendário.
              </PdfCard>
            </div>
          </div>

          {/* Section: Guia Prático */}
          <div style={{ marginBottom: '24px', breakInside: 'avoid' as const }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>Guia Prático</div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a2e', margin: '0 0 4px' }}>Como Operar o Assistente Moeda</h3>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 12px' }}>3 passos simples para transformar caos financeiro em clareza absoluta.</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
              <StepItem step={1} icon="🛒" title="Lançando Custos Variáveis (O Dia a Dia)">
                Adicione combustível, almoço ou pedágio. Coloque a mesma data no Início e no Fim. O sistema entende que foi um gasto pontual que sangrou o caixa naquele mês.
              </StepItem>
              <StepItem step={2} icon="✨" title="Lançando Custos Fixos (A Mágica do Rateio)">
                Adicionou o IPVA ou o Seguro? Defina a Data Inicial (ex: 01/Jan) e a Data Final (ex: 31/Dez). O motor do Assistente vai fatiar esse valor gigante e cobrar apenas a parcela justa de cada dia trabalhado.
              </StepItem>
              <StepItem step={3} icon="📊" title="Acompanhe as Métricas">
                Deixe o sistema calcular a sua 'Meta Diária Global'. Exporte para o WhatsApp e tenha o relatório perfeito na palma da mão.
              </StepItem>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center' as const, fontSize: '10px', color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: '12px', breakInside: 'avoid' as const }}>
            <div>Todos os dados são salvos localmente no seu navegador. Nada sai do seu dispositivo.</div>
            <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 600 }}>
              Acesse e crie o seu:{' '}
              <a
                href="https://www.heisslab.com.br/laboratorio/assistente-moeda"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7c3aed', textDecoration: 'underline' }}
              >
                heisslab.com.br/laboratorio/assistente-moeda
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

// ── Sub-components ───────────────────────────────────────────────────────────

function PdfCard({ icon, title, children, borderColor, bgColor }: {
  icon: string; title: string; children: React.ReactNode; borderColor: string; bgColor: string;
}) {
  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '12px', backgroundColor: bgColor }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#1a1a2e', marginBottom: '4px' }}>{icon} {title}</div>
      <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.5' }}>{children}</div>
    </div>
  );
}

function StepItem({ step, icon, title, children }: {
  step: number; icon: string; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', backgroundColor: '#fafafa' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px',
        backgroundColor: '#f3e8ff', color: '#7c3aed',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0,
        border: '1px solid #e9d5ff',
      }}>{step}</div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a2e', marginBottom: '2px' }}>{icon} {title}</div>
        <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.5' }}>{children}</div>
      </div>
    </div>
  );
}
