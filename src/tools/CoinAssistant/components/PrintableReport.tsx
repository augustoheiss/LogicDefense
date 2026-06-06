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
    // Recharts may pass negative height for downward bars.
    // Math.abs ensures we always move from y to the bar's BOTTOM edge.
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

const renderRevenueLabel    = makePositiveLabel('#059669');
const renderDepositLabel    = makePositiveLabel('#0284c7');
const renderPartnerInLabel  = makePositiveLabel('#6366f1');
const renderWaiverLabel     = makePositiveLabel('#64748b');
const renderExpenseLabel    = makeNegativeLabel('#e11d48');
const renderPartnerOutLabel = makeNegativeLabel('#d97706');
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

  const points: { dateLabel: string; revenue: number; expenseNeg: number; partnerIn: number; partnerOutNeg: number; deposit: number; waiver: number }[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dateISO = `${yearStr}-${monthStr}-${pad2(d)}`;
    if (isThisMonth && dateISO > todayISO) break;
    const revenue    = round2(revMap[dateISO]  ?? 0);
    const expense    = round2(expMap[dateISO]  ?? 0);
    const partnerIn  = round2(pinMap[dateISO]  ?? 0);
    const partnerOut = round2(poutMap[dateISO] ?? 0);
    const deposit    = round2(depMap[dateISO]  ?? 0);
    const waiver     = round2(waiMap[dateISO]  ?? 0);
    points.push({
      dateLabel: `${pad2(d)}/${monthStr}`,
      revenue,
      expenseNeg:    expense !== 0 ? -Math.abs(expense) : 0,
      partnerIn,
      partnerOutNeg: partnerOut !== 0 ? -Math.abs(partnerOut) : 0,
      deposit,
      waiver,
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

/** Text Filtering Logic: parses the AI response and returns max 4-5 strategic bullet points. */
function extractStrategicRecommendations(text: string | undefined): string[] {
  if (!text) return [];

  // 1. Clean up markdown bold tags to avoid regex fragmentation
  const cleanText = text.replace(/\*\*/g, '');

  // 2. High-probability semantic anchors for the final recommendation block
  const structuralAnchors = [
    "Recomendações Estratégicas",
    "Recomendações",
    "Recomendaçoes",
    "Sugestões",
    "Sugestoes",
    "Ações Sugeridas",
    "Ações Recomendadas",
    "Direcionamento",
    "Próximos Passos"
  ];

  let markerIndex = -1;
  let matchedLength = 0;

  // Find the first anchor that appears in the text
  for (const anchor of structuralAnchors) {
    const index = cleanText.search(new RegExp(anchor, "i"));
    if (index !== -1) {
      markerIndex = index;
      matchedLength = anchor.length;
      break; // Lock onto the first matched section header
    }
  }

  let relevantContent = "";

  if (markerIndex !== -1) {
    // Strategy A: Cut the text from the found header forward
    relevantContent = cleanText.substring(markerIndex + matchedLength);
  } else {
    // Strategy B (Fallback): If no headers match, take the last 40% of the entire text 
    // since recommendations naturally live at the bottom of the analyst report.
    relevantContent = cleanText.substring(Math.floor(cleanText.length * 0.6));
  }

  // 3. Split into lines, clean up bullet/numbering prefixes, and filter core action blocks
  const lines = relevantContent
    .split('\n')
    .map(line => line.replace(/^[•\-\*\s\d\.]+\s*/, '').trim()) // Clear bullet trash
    .filter(line => line.length > 45 && (line.includes(':') || line.endsWith('.'))); // Keep structural bullet-like items

  // 4. Cap at 4 items max to fit seamlessly into the A4 PDF bounding box
  return lines.slice(0, 4);
}

interface PrintableReportProps {
  tableName: string;
  rows: TableRow[];
  metrics: TableMetrics;
  selectedMonth: string;
  dailyGoal: number;
  goals: TableGoals;
  costBasedTarget?: CostBasedTarget;
  aiAnalysis?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(
  function PrintableReport({ tableName, rows, metrics, selectedMonth, dailyGoal, goals, costBasedTarget, aiAnalysis }, ref) {
    const [selY, selM] = selectedMonth.split('-').map(Number);
    const monthName = new Date(selY, selM - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const monthMetrics: MonthMetrics | null = metrics.byMonth[selectedMonth] ?? null;
    const mDays = daysInMonth(selY, selM);

    // Chart data
    const chartData = buildChartData(rows, selectedMonth);
    const hasExpenses  = chartData.some(p => p.expenseNeg < 0);
    const hasPartnerIn  = chartData.some(p => p.partnerIn > 0);
    const hasPartnerOut = chartData.some(p => p.partnerOutNeg < 0);
    const hasDeposits  = chartData.some(p => p.deposit > 0);
    const hasWaivers   = chartData.some(p => p.waiver > 0);

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
            CHART — Recharts with fixed width (no ResponsiveContainer)
            ═══════════════════════════════════════════════════════════════════ */}
        {chartData.length > 0 && (
          <div style={{ marginBottom: '28px', breakInside: 'avoid' as const }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
              Fluxo de Caixa Diário
            </h2>
            <ComposedChart width={714} height={340} data={chartData} margin={{ top: 44, right: 12, left: 0, bottom: 70 }}>
              <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />
              {dailyGoal > 0 && (
                <ReferenceLine y={dailyGoal} stroke="#9ca3af" strokeDasharray="4 3" label={{ value: `Meta ${fmtBRL(dailyGoal)}`, position: 'insideTopRight', fill: '#6b7280', fontSize: 9 }} />
              )}
              {survival && survival.daily > 0 && (
                <ReferenceLine y={survival.daily} stroke="#7c3aed" strokeDasharray="6 3" label={{ value: `Sobrev. ${fmtBRL(survival.daily)}`, position: 'insideBottomRight', fill: '#7c3aed', fontSize: 9 }} />
              )}
              <XAxis dataKey="dateLabel" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} tickMargin={30} interval={chartData.length > 20 ? Math.ceil(chartData.length / 15) - 1 : 0} />
              <YAxis tickFormatter={(v: number) => v >= 1000 || v <= -1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`} tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} width={52} />
              <Bar dataKey="revenue" fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={16} stackId="positive">
                <LabelList dataKey="revenue" content={renderRevenueLabel} />
              </Bar>
              {hasDeposits && (
                <Bar dataKey="deposit" fill="#0284c7" radius={[3, 3, 0, 0]} maxBarSize={16} stackId="positive">
                  <LabelList dataKey="deposit" content={renderDepositLabel} />
                </Bar>
              )}
              {hasPartnerIn && (
                <Bar dataKey="partnerIn" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={16} stackId="positive">
                  <LabelList dataKey="partnerIn" content={renderPartnerInLabel} />
                </Bar>
              )}
              {hasWaivers && (
                <Bar dataKey="waiver" fill="#64748b" radius={[3, 3, 0, 0]} maxBarSize={16} stackId="positive">
                  <LabelList dataKey="waiver" content={renderWaiverLabel} />
                </Bar>
              )}
              {hasExpenses && (
                <Bar dataKey="expenseNeg" fill="#e11d48" radius={[0, 0, 3, 3]} maxBarSize={16} stackId="negative">
                  <LabelList dataKey="expenseNeg" content={renderExpenseLabel} />
                </Bar>
              )}
              {hasPartnerOut && (
                <Bar dataKey="partnerOutNeg" fill="#d97706" radius={[0, 0, 3, 3]} maxBarSize={16} stackId="negative">
                  <LabelList dataKey="partnerOutNeg" content={renderPartnerOutLabel} />
                </Bar>
              )}
            </ComposedChart>
            <div style={{ fontSize: '9px', color: '#9ca3af', textAlign: 'right' as const, marginTop: '4px' }}>
              ✦ Valores distribuídos proporcionalmente pelo período de cada lançamento
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            COMPACT SUMMARY — Painel Consolidado
            Uses tight 8-9pt fonts and grid rows to stay compact.
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

              {/* ── Row 1b: Custos Rateados do Mês (3-col) ── */}
              {expenseTotal > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '6px', backgroundColor: '#fff5f5' }}>
                  <div style={cell}>
                    <div style={lbl}>💸 Custos Rateados</div>
                    <div style={{ ...val, color: '#dc2626' }}>{fmtBRL(expenseTotal)}</div>
                  </div>
                  <div style={cell}>
                    <div style={lbl}>💸 Média Semanal</div>
                    <div style={{ ...val, color: '#b91c1c' }}>{fmtBRL(expenseWeekly)}</div>
                  </div>
                  <div style={cell}>
                    <div style={lbl}>💸 Média Diária</div>
                    <div style={{ ...val, color: '#b91c1c' }}>{fmtBRL(expenseDaily)}</div>
                  </div>
                </div>
              )}

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

              {/* ── Row 3: Operational & Partnership + Justificativas (7-col) ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#fafafa' }}>
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
                  <div style={lbl}>🛡️ Justificativas</div>
                  <div style={{ ...val, color: metrics.totalWaiverCredit > 0 ? '#d97706' : '#9ca3af' }}>{fmtBRL(metrics.totalWaiverCredit)}</div>
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

              {/* ── Row 4: Portfólio de Investimentos (3-col) ── */}
              {(metrics.depositCount > 0 || metrics.globalTotalDeposited > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid #bfdbfe', borderRadius: '6px', marginTop: '6px', backgroundColor: '#eff6ff' }}>
                  <div style={cell}>
                    <div style={lbl}>📈 Total Aportado</div>
                    <div style={{ ...val, color: '#1e3a8a' }}>{fmtBRL(metrics.globalTotalDeposited)}</div>
                  </div>
                  <div style={cell}>
                    <div style={lbl}>📈 Rendimentos Acumulados</div>
                    <div style={{ ...val, color: '#059669' }}>{fmtBRL(metrics.globalTotalYield)}</div>
                  </div>
                  <div style={cell}>
                    <div style={lbl}>📈 Saldo Total do Portfólio</div>
                    <div style={{ ...val, color: '#1e3a8a' }}>{fmtBRL(metrics.globalBalance)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════════
            AI STRATEGIC RECOMMENDATIONS BOX
            ═══════════════════════════════════════════════════════════════════ */}
        {(() => {
          const recs = extractStrategicRecommendations(aiAnalysis);
          return (
            <div style={{
              marginTop: '12px',
              border: '1px solid #c084fc',
              borderRadius: '8px',
              padding: '10px 12px',
              backgroundColor: '#faf5ff',
              breakInside: 'avoid' as const
            }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#7c3aed', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>✦</span> RECOMENDAÇÕES ESTRATÉGICAS (ANÁLISE DE IA)
              </div>
              {recs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                  {recs.map((rec, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '11px', color: '#581c87', lineHeight: '1.4' }}>
                      <span style={{ color: '#a855f7', fontWeight: 900 }}>•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic', lineHeight: '1.4' }}>
                  Nenhuma análise de IA foi realizada nesta sessão. Para incluir recomendações estratégicas personalizadas, utilize o Assistente Moeda IA na planilha antes de exportar o PDF.
                </div>
              )}
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

          {/* Section: O Antes */}
          <div style={{ marginBottom: '24px', breakInside: 'avoid' as const }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>
              ✦ O ANTES: A Ilusão do Lucro e o Pesadelo das Contas Anuais
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a2e', margin: '0 0 10px' }}>
              Como os Custos Invisíveis Sabotam seu Negócio
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <PdfCard icon="💸" title="A Falsa Sensação de Riqueza" borderColor="#fecaca" bgColor="#fff5f5">
                Você faz um faturamento excelente na semana, mas esquece que o IPVA, o seguro, a depreciação e a manutenção estão correndo em silêncio debaixo dos seus pés. No fim das contas, o lucro real desaparece.
              </PdfCard>
              <PdfCard icon="📉" title="Planilhas Tradicionais que Mentem" borderColor="#fecaca" bgColor="#fff5f5">
                Lançar um gasto de R$ 3.000 em Janeiro faz aquele mês parecer um desastre completo, e os meses seguintes falsamente lucrativos. Sem diluir custos fixos no tempo, você opera no escuro.
              </PdfCard>
            </div>
            <PdfCard icon="🪞" title="A Necessidade Absoluta do Rateio Diário" borderColor="#fde68a" bgColor="#fffbeb">
              Anotar o fluxo de caixa diário sem ratear custos de longo prazo proporcionalmente pelo calendário cria uma ilusão de lucro. É essencial diluir despesas fixas por regime de competência para proteger seu capital de giro.
            </PdfCard>
          </div>

          {/* Section: O Depois */}
          <div style={{ marginBottom: '24px', breakInside: 'avoid' as const }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#059669', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>
              ✦ O DEPOIS: A Clareza de Marchar Sabendo Onde Pisar
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a2e', margin: '0 0 10px' }}>
              Previsibilidade Operacional e Lucro Líquido Real
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <PdfCard icon="🧮" title="Os Primeiros R$ 108,00 Quitados" borderColor="#a7f3d0" bgColor="#f0fdf4">
                Imagine ligar o carro ou abrir o negócio sabendo que o custo fixo rateado diário já está guardado. Tudo o que ultrapassar essa linha é lucro líquido real no seu bolso.
              </PdfCard>
              <PdfCard icon="📅" title="Previsibilidade no Calendário" borderColor="#a7f3d0" bgColor="#f0fdf4">
                O motor do Assistente ajusta a meta de sobrevivência automaticamente para meses de 28 ou 31 dias, garantindo clareza total sob qualquer cenário ou mês trabalhado.
              </PdfCard>
            </div>
          </div>

          {/* Section: Guia Prático */}
          <div style={{ marginBottom: '24px', breakInside: 'avoid' as const }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>
              ✦ COMO OPERAR O ASSISTENTE-MOEDA
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a2e', margin: '0 0 4px' }}>
              3 Passos Simples para a Clareza Financeira
            </h3>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 12px' }}>
              Siga os passos operacionais abaixo para extrair a inteligência máxima dos seus lançamentos.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
              <StepItem step={1} icon="🛒" title="Lançando o Dia a Dia (Custos Variáveis)">
                Adicione despesas operacionais diárias (ex: combustível ou pedágio sob a categoria 'EH BB' ou 'ALIMENTAÇÃO') com a mesma data de início e de fim para isolar o impacto no mês.
              </StepItem>
              <StepItem step={2} icon="✨" title="A Mágica do Rateio Completo (Custos Fixos)">
                Insira custos fixos anuais/longo prazo (ex: IPVA ou seguro sob a categoria 'AH ITAU') definindo a data inicial e final no calendário para ativar o rateio diário proporcional.
              </StepItem>
              <StepItem step={3} icon="📊" title="Extraia a Inteligência Máxima">
                Monitore gráficos de fluxo diário cronológico, audite os números com o feedback local do Analista de IA e exporte este relatório executivo em PDF oficial com um único clique.
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
