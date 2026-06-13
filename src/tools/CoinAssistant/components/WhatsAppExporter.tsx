import { useState } from 'react';
import type { CoinTable, TableRow, TableMetrics, CostBasedTarget } from '../types';
import {
  fmtDate,
  resolveGoalForYear,
  getMondayOf,
  toLocalKey,
  getWeeklyGoalForDate,
} from '../utils/dateUtils';

interface WhatsAppExporterProps {
  table: CoinTable;
  metrics: TableMetrics;
  /** "YYYY-MM" — the month currently in view; drives the month-specific report. */
  selectedMonth: string;
  onClose: () => void;
  /** When set, the report reflects data up to this date. */
  cutoffDate?: string;
  /** When active, adds cost-coverage messaging to the report. */
  costBasedTarget?: CostBasedTarget;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMonthName(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long' })
    .replace(/^./, (c) => c.toUpperCase());
}

function formatMonthFull(ym: string): string {
  const [y, m] = ym.split('-');
  const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "YYYY-MM-DD" → "DD/MM" */
function fmtDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

// ── Prorated Accrual Helpers (Regime de Competência) ──────────────────────────

/** Exact calendar days in a given month (1-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Inclusive day count between two YYYY-MM-DD strings. */
function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T12:00:00').getTime();
  const msB = new Date(b + 'T12:00:00').getTime();
  return Math.max(1, Math.round(Math.abs(msB - msA) / 86_400_000) + 1);
}

function monthFirstDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
function monthLastDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
}

interface ProratedExpense {
  row: TableRow;
  monthlyContribution: number;
}

/**
 * Prorated accrual engine — identical logic to MetricsPanel.
 * dailyRate = row.value / totalLifespanDays
 * monthlyContribution = dailyRate × activeDaysInMonth
 */
function prorateExpensesForMonth(
  rows: TableRow[],
  selectedMonth: string,
): ProratedExpense[] {
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const mStart = monthFirstDay(selY, selM);
  const mEnd   = monthLastDay(selY, selM);

  const results: ProratedExpense[] = [];

  for (const r of rows) {
    if (r.entryType !== 'expense') continue;

    const expStart = r.periodStart || r.date;
    const expEnd   = r.periodEnd   || r.date;

    if (expStart > mEnd || expEnd < mStart) continue;

    const overlapStart = expStart < mStart ? mStart : expStart;
    const overlapEnd   = expEnd   > mEnd   ? mEnd   : expEnd;

    const totalLifespanDays = daysBetween(expStart, expEnd);
    const activeDaysInMonth = daysBetween(overlapStart, overlapEnd);
    const dailyRate = r.value / totalLifespanDays;

    results.push({ row: r, monthlyContribution: dailyRate * activeDaysInMonth });
  }

  return results;
}

/**
 * Dynamic Survival Goals from global expense daily average.
 * Identical logic to MetricsPanel.
 */
function computeGlobalSurvivalGoals(
  rows: TableRow[],
  selectedMonth: string,
): { dailySurvival: number; weeklySurvival: number; monthlySurvival: number } | null {
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

  const globalDays = daysBetween(earliest, latest);
  const dailySurvival = globalDays > 0 ? total / globalDays : 0;
  if (dailySurvival <= 0) return null;

  const [y, m] = selectedMonth.split('-').map(Number);
  const mDays = daysInMonth(y, m);

  return {
    dailySurvival,
    weeklySurvival: dailySurvival * 7,
    monthlySurvival: dailySurvival * mDays,
  };
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildMessage(
  table: CoinTable,
  metrics: TableMetrics,
  selectedMonth: string,
  costBasedTarget?: CostBasedTarget,
): string {
  const monthName = formatMonthName(selectedMonth);
  const monthMetrics = metrics.byMonth[selectedMonth];
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const reportYear = selY;

  // ── Goals for this report period ─────────────────────────────────────────
  const reportDailyGoal = resolveGoalForYear(table.goals.dailyGoals, reportYear);
  const reportWeeklyGoal = resolveGoalForYear(table.goals.weeklyGoals, reportYear);

  // ── Revenue rows (exclude deposits, waivers, expenses, partner entries) ────
  const allRevenueRows = table.rows
    .filter(
      (r) =>
        r.entryType !== 'deposit' &&
        r.entryType !== 'waiver' &&
        r.entryType !== 'expense' &&
        r.entryType !== 'partner_in' &&
        r.entryType !== 'partner_out' &&
        r.value > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  // Generate a continuous chronological sequence of all weeks in the target month
  const totalDays = daysInMonth(selY, selM);
  const sundays: Date[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(selY, selM - 1, d);
    if (date.getDay() === 0) { // Sunday
      sundays.push(date);
    }
  }

  const weekGroups = sundays.map((sunday) => {
    const monday = getMondayOf(sunday);
    const mondayKey = toLocalKey(monday);

    // Find entries for this week from allRevenueRows
    const entries = allRevenueRows.filter((r) => {
      const [ry, rmo, rd] = r.date.split('-').map(Number);
      const rDate = new Date(ry, rmo - 1, rd);
      const rMonday = getMondayOf(rDate);
      return toLocalKey(rMonday) === mondayKey;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const weeklyTotal = entries.reduce((sum, r) => sum + r.value, 0);
    const sundayKey = toLocalKey(sunday);
    const weekGoal = getWeeklyGoalForDate(sundayKey, table.goals);

    return {
      weekStartDate: monday,
      weekEndDate: sunday,
      dailyEntries: entries,
      weeklyTotal,
      differenceFromGoal: weeklyTotal - weekGoal,
      weeklyGoal: weekGoal,
    };
  });

  // ── Expenses prorated for this month (Regime de Competência) ─────────────
  const proratedExpenses = prorateExpensesForMonth(table.rows, selectedMonth);

  // ── Dynamic Survival Goals (global expense daily average) ──────────────
  const survivalGoals = costBasedTarget
    ? computeGlobalSurvivalGoals(table.rows, selectedMonth)
    : null;

  // ── Year-level cost data ────────────────────────────────────────────────
  const staticYearCost = resolveGoalForYear(table.goals.annualCosts, reportYear);
  const yearCost = costBasedTarget && costBasedTarget.annualCost > 0
    ? costBasedTarget.annualCost
    : staticYearCost;
  const yearRevenue = metrics.byYear[String(reportYear)]?.grossAnnual ?? 0;
  const annualPct = yearCost > 0
    ? ((yearRevenue / yearCost) * 100).toFixed(1)
    : '0.0';

  const lines: string[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Header
  // ═══════════════════════════════════════════════════════════════════════════
  lines.push(
    `📆 *Relatório Financeiro*`,
    `_Ref: ${monthName} de ${reportYear}_`,
    '',
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Wins First: Resumo de Resultados do Mês
  // ═══════════════════════════════════════════════════════════════════════════
  if (monthMetrics) {
    const goalPct = reportDailyGoal > 0
      ? ((monthMetrics.dailyAvg / reportDailyGoal) * 100).toFixed(1)
      : '0.0';
    const goalPctNum = parseFloat(goalPct);
    const goalIcon = goalPctNum >= 100 ? '🏆' : '';
    const goalNote = goalPctNum >= 100
      ? ` ${goalIcon} ${goalPct}% atingida!`
      : ` ${goalPct}% atingida`;

    lines.push(
      `📊 *Resumo de Resultados do Mês*`,
      `• Receitas do Mês: *${fmt(monthMetrics.grossMonthly)}*`,
      `• Média Diária: ${fmt(monthMetrics.dailyAvg)}`,
      `• Média Semanal: ${fmt(monthMetrics.weeklyAvg)}`,
      `• Meta Diária ${reportYear} (${fmt(reportDailyGoal)}):${goalNote}`,
      '',
    );
  } else {
    lines.push(`📊 *Sem resultados registrados para este mês.*`, '');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — The Proof: Extrato de Entradas por Semana
  // ═══════════════════════════════════════════════════════════════════════════
  if (weekGroups.length > 0) {
    lines.push(`📋 *Extrato de Entradas por Semana*`);

    for (const week of weekGroups) {
      lines.push('');
      lines.push(
        `🗓️ *Semana ${fmtDate(week.weekStartDate)} a ${fmtDate(week.weekEndDate)}*`,
      );

      if (week.dailyEntries.length === 0) {
        lines.push(
          `📉 Fechamento: *R$ 0,00* _(Faltam ${fmt(week.weeklyGoal)} para a meta)_`,
        );
      } else {
        for (const row of week.dailyEntries) {
          const desc = row.description ? ` — ${row.description}` : '';
          lines.push(`• ${fmtDay(row.date)}: *${fmt(row.value)}*${desc}`);
        }

        const diff = week.differenceFromGoal;
        if (diff === 0) {
          lines.push(
            `🎯 Fechamento: *${fmt(week.weeklyTotal)}* _(Meta cravada!)_`,
          );
        } else if (diff > 0) {
          lines.push(
            `🎯 Fechamento: *${fmt(week.weeklyTotal)}* _(Superou ${fmt(diff)} da meta!)_`,
          );
        } else {
          lines.push(
            `📉 Fechamento: *${fmt(week.weeklyTotal)}* _(Faltam ${fmt(Math.abs(diff))} para a meta)_`,
          );
        }
      }
    }

    lines.push('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — The Reality: Custo Operacional do Veículo
  // ═══════════════════════════════════════════════════════════════════════════
  if (proratedExpenses.length > 0) {
    lines.push(`💸 *Custos do Período*`);
    lines.push('');
    for (const pe of proratedExpenses) {
      const desc = pe.row.description ?? 'Sem descrição';
      // Only show "rateado" when the month's portion is strictly less than the full value
      const isProrated = Math.round(pe.monthlyContribution * 100) < Math.round(pe.row.value * 100);
      const suffix = isProrated
        ? ` _(rateado: ${fmt(pe.monthlyContribution)} este mês)_`
        : '';
      lines.push(`• ${desc}: *-${fmt(pe.row.value)}*${suffix}`);
    }
    // Prorated monthly expense metrics — daily-anchored math
    const monthExpenseTotal = proratedExpenses.reduce(
      (sum, pe) => sum + pe.monthlyContribution,
      0,
    );
    const mDays = daysInMonth(selY, selM);
    const expDailyAvg  = mDays > 0 ? monthExpenseTotal / mDays : 0;
    const expWeeklyAvg = expDailyAvg * 7;
    lines.push(`• *Total de Gastos do Mês:* _-${fmt(monthExpenseTotal)}_`);
    lines.push(`• *Média de Gasto Semanal:* _-${fmt(expWeeklyAvg)}_`);
    lines.push(`• *Média de Gasto Diário:* _-${fmt(expDailyAvg)}_`);
    lines.push(`• *Total de Despesas Anuais: ${fmt(yearCost)}* _(${annualPct}% coberto em ${reportYear})_`);
    lines.push('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — Global View: Visão Global & Metas de Sobrevivência
  // ═══════════════════════════════════════════════════════════════════════════
  const balance = metrics.globalGoalBalance;
  const balanceAbs = Math.abs(balance).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const balanceLine = balance >= 0
    ? `• Saldo Acumulado de Metas: *+${balanceAbs}* _(Excedente Operacional)_`
    : `• Saldo Acumulado de Metas: *-${balanceAbs}* _(Dívida Pendente)_`;

  lines.push(
    `🌎 *Visão Global & Metas de Sobrevivência*`,
    `• Faturamento Total Histórico: *${fmt(metrics.grossTotal)}*`,
    ...(metrics.totalExpenses > 0
      ? [
        `• Total de Despesas Registradas: *-${fmt(metrics.totalExpenses)}*`,
        `• 💰 Saldo Líquido Global: *${fmt(metrics.netBalance)}*`,
      ]
      : []),
    `• Média Diária Global: ${fmt(metrics.globalDailyAvg)}`,
    `• Meta Semanal ${reportYear}: ${fmt(reportWeeklyGoal)}`,
    ...(survivalGoals
      ? [
        `• 🛡️ Meta de Sobrevivência Mensal: ${fmt(survivalGoals.monthlySurvival)}`,
        `• 🛡️ Meta de Sobrevivência Semanal: ${fmt(survivalGoals.weeklySurvival)}`,
        `• 🛡️ Meta de Sobrevivência Diária: ${fmt(survivalGoals.dailySurvival)}`,
      ]
      : []),
    balanceLine,
    '',
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5b + 6 — Unified: Detalhamento & Indicadores
  // ═══════════════════════════════════════════════════════════════════════════
  // FIREWALL: grossTotal is now pure operational (no partner_in)
  const regularIncome = metrics.grossTotal;
  const goalTarget = metrics.billableWeeks > 0 && reportWeeklyGoal > 0
    ? Math.round(metrics.billableWeeks * reportWeeklyGoal * 100) / 100
    : 0;
  // Historically-accumulated week formatter (avoids naive flat division)
  const fmtW = (weeks: number) => `${weeks.toFixed(1)} sem`;

  const waiversCount = table.rows.filter((r) => r.entryType === 'waiver' && r.value > 0).length;
  const waivedWeeks = metrics.waivedWeeks;
  // ── Saldo de Reposição: liquid formula (globalGoalBalance / currentWeeklyGoal)
  // Mirrors the corrected UI in GoalsPanel.tsx and MetricsPanel.tsx.
  const effectiveWeeksBalance = reportWeeklyGoal > 0
    ? metrics.globalGoalBalance / reportWeeklyGoal
    : 0;
  const absWeeks = Math.abs(effectiveWeeksBalance).toFixed(1);
  const tbLine = effectiveWeeksBalance >= 0
    ? `• ✅ Saldo de Reposição: *+${absWeeks} semanas* _(${absWeeks} semana${parseFloat(absWeeks) !== 1 ? 's' : ''} adiantada${parseFloat(absWeeks) !== 1 ? 's' : ''})_`
    : `• 🚨 Saldo de Reposição: *-${absWeeks} semanas* _(Volume de serviço pendente para recuperar o teto da meta)_`;

  const recentWaivers = table.rows
    .filter((r) => r.entryType === 'waiver' && r.value > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  // Group raw partnership arrays for wash detection (matching credited/debited pairs)
  const partnerInRows = table.rows.filter((r) => r.entryType === 'partner_in' && r.value > 0);
  const partnerOutRows = table.rows.filter((r) => r.entryType === 'partner_out' && r.value > 0);

  const matchedInIds = new Set<string>();
  const matchedOutIds = new Set<string>();
  const canceledPartnerships: TableRow[] = [];

  // Identify pairs that have the exact same value
  for (const inRow of partnerInRows) {
    const match = partnerOutRows.find(
      (outRow) =>
        !matchedOutIds.has(outRow.id) &&
        Math.round(outRow.value * 100) === Math.round(inRow.value * 100)
    );

    if (match) {
      matchedInIds.add(inRow.id);
      matchedOutIds.add(match.id);
      canceledPartnerships.push(match);
    }
  }

  // Keep unmatched outstanding rows to accurately represent true outstanding surpluses or liabilities
  const unmatchedPartnerOut = partnerOutRows.filter((r) => !matchedOutIds.has(r.id));

  const recentPartnerOut = unmatchedPartnerOut
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  // ── Partner Netting (Enxugamento de Parceria) ──────────────────────
  const canceledAmount = Math.min(metrics.totalPartnerIn, metrics.totalPartnerOut);
  const liquidPartnerIn  = metrics.totalPartnerIn  - canceledAmount;
  const liquidPartnerOut = metrics.totalPartnerOut - canceledAmount;
  const totalDevido = goalTarget + liquidPartnerOut;

  // Effective weeks balance — same liquid formula used across all UI
  const effectiveFinalWeeks = reportWeeklyGoal > 0
    ? balance / reportWeeklyGoal
    : 0;

  lines.push(
    `📊 *Balanço Operacional & Indicadores*`,
    `(+) Receitas Operacionais: ${fmt(regularIncome)} _(${fmtW(metrics.grossTotalWeeks)})_`
  );

  if (metrics.totalWaiverCredit > 0) {
    lines.push(`(+) Justificativas: ${fmt(metrics.totalWaiverCredit)} _(${fmtW(metrics.waiverTotalWeeks)})_`);
    if (recentWaivers.length > 0) {
      lines.push(`🔎 *Últimas Justificativas:*`);
      for (const row of recentWaivers) {
        const desc = row.description ? ` — ${row.description}` : '';
        lines.push(`  • ${fmtDay(row.date)}: *${fmt(row.value)}*${desc}`);
      }
    }
  }

  // Render Metas row with liquid partner netting
  if (liquidPartnerOut > 0) {
    lines.push(`(−) Total Devido (Metas + Parceria Líq.): ${fmt(totalDevido)} _(${fmtW(metrics.goalTotalWeeks)})_`);
    lines.push(`    Metas: ${fmt(goalTarget)} + Parceria Líq.: ${fmt(liquidPartnerOut)}`);
    if (recentPartnerOut.length > 0) {
      lines.push(`🔎 *Déficit Real de Parceria (A pagar):*`);
      for (const row of recentPartnerOut) {
        const desc = row.description ? ` — ${row.description}` : '';
        lines.push(`  • ${fmtDay(row.date)}: *${fmt(row.value)}*${desc}`);
      }
    }
  } else {
    lines.push(`(−) Metas Acumuladas: ${fmt(goalTarget)} _(${fmtW(metrics.goalTotalWeeks)})_`);
  }

  if (liquidPartnerIn > 0) {
    lines.push(`(+) Créditos de Parceria (Líquido): ${fmt(liquidPartnerIn)}`);
  }

  if (canceledAmount > 0) {
    lines.push(`🤝 Parceria cancelada mutuamente: ${fmt(canceledAmount)}`);
  }

  lines.push(
    `(=) *Saldo Final: ${fmt(balance)} (${effectiveFinalWeeks >= 0 ? '+' : ''}${effectiveFinalWeeks.toFixed(1)} sem)*`,
    '',
    `• ⏳ Tempo de Parceria: *${metrics.totalElapsedWeeks} semanas*`
  );

  if (waivedWeeks > 0) {
    lines.push(`• 🛡️ Período Justificado: *${waivedWeeks.toFixed(1)} semanas* (${waiversCount} ocorrência${waiversCount !== 1 ? 's' : ''})`);
  }

  lines.push(
    tbLine,
    ''
  );

  // Neutralized Section (Wash Transactions)
  const sortedCanceled = canceledPartnerships.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (sortedCanceled.length > 0) {
    lines.push(`🤝 *Parcerias Compensadas (Impacto Zero no Caixa):*`);
    for (const row of sortedCanceled) {
      const desc = row.description ? ` — ${row.description}` : '';
      lines.push(`  • ${fmtDay(row.date)}: *${fmt(row.value)}*${desc} _(Anulado/Compensado)_`);
    }
    lines.push('');
  }

  // ── Cost-based goal coverage message ───────────────────────────────────────
  if (costBasedTarget && costBasedTarget.annualCost > 0 && yearRevenue >= costBasedTarget.annualCost) {
    const netProfit = yearRevenue - costBasedTarget.annualCost;
    lines.push(
      `✅ *Custos operacionais cobertos!* O saldo atual de *${fmt(netProfit)}* em ${reportYear} é lucro líquido puro.`,
      '',
    );
  }

  lines.push(
    `_Gerado pelo Assistente Moeda · Heiss-Lab_`,
  );

  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WhatsAppExporter({
  table,
  metrics,
  selectedMonth,
  onClose,
  costBasedTarget,
}: WhatsAppExporterProps) {
  const [phone, setPhone] = useState('');
  const message = buildMessage(table, metrics, selectedMonth, costBasedTarget);

  function handleSend() {
    const cleaned = phone.replace(/\D/g, '');
    const full = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    const url = `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <h2 className="text-lg font-semibold text-white">Exportar para WhatsApp</h2>
            <p className="text-xs text-white/35 mt-0.5">
              Relatório de {formatMonthFull(selectedMonth)}
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <label className="text-xs text-white/40 uppercase tracking-wider">
            Pré-visualização da mensagem
          </label>
          <pre className="bg-[#0d1117] border border-white/10 rounded-lg px-4 py-3 text-xs text-white/70 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
            {message}
          </pre>
        </div>

        {/* Phone input */}
        <div className="space-y-2">
          <label className="text-xs text-white/50 uppercase tracking-wider">
            Número de telefone
          </label>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-white/40 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              +55
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="flex-1 bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#25D366] border border-white/10"
            />
          </div>
          <p className="text-xs text-white/30">
            Deixe em branco para abrir sem destinatário definido.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Abrir no WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
