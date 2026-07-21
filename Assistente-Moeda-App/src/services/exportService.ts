/**
 * Export Service — Assistente Moeda
 *
 * Handles data export in multiple formats:
 *   - WhatsApp text report (native share)
 *   - PDF export (expo-print + expo-sharing / web print window)
 *   - CSV export (native share as file / web download)
 */

import { Platform, Share, Alert } from 'react-native';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { formatCurrencyFull, formatCurrencySmart } from '../core/formatCurrency';
import type { TableRow, TableMetrics, TableGoals } from '../core/types';
import type { WeekDebtEntry } from '../core/computeWeeklyDebtTimeline';
import { getMondayOf, toLocalKey, getWeeklyGoalForDate, resolveGoalForYear, fmtDate } from '../core/dateUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMonthName(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long' })
    .replace(/^./, (c) => c.toUpperCase());
}

function formatMonthFull(ym: string): string {
  const [y, m] = ym.split('-');
  const label = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fmtDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T12:00:00').getTime();
  const msB = new Date(b + 'T12:00:00').getTime();
  return Math.max(1, Math.round(Math.abs(msB - msA) / 86_400_000) + 1);
}

// ── Prorated Accruals ─────────────────────────────────────────────────────────

function prorateExpensesForMonth(
  rows: TableRow[],
  selectedMonth: string,
): Array<{ row: TableRow; monthlyContribution: number }> {
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const mStart = `${selectedMonth}-01`;
  const mEnd   = `${selectedMonth}-${String(daysInMonth(selY, selM)).padStart(2, '0')}`;

  const results: Array<{ row: TableRow; monthlyContribution: number }> = [];

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

// ── WhatsApp Message Builder ──────────────────────────────────────────────────

export function buildWhatsAppReport(
  tableName: string,
  metrics: TableMetrics,
  goals: TableGoals,
  selectedMonth: string,
  rows: TableRow[],
): string {
  const monthName = formatMonthName(selectedMonth);
  const monthMetrics = metrics.byMonth[selectedMonth];
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const reportYear = selY;

  const reportDailyGoal = resolveGoalForYear(goals.dailyGoals, reportYear);
  const reportWeeklyGoal = resolveGoalForYear(goals.weeklyGoals, reportYear);

  // Revenue rows
  const allRevenueRows = rows
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

  // Sequence of weeks
  const totalDays = daysInMonth(selY, selM);
  const sundays: Date[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(selY, selM - 1, d);
    if (date.getDay() === 0) {
      sundays.push(date);
    }
  }

  const weekGroups = sundays.map((sunday) => {
    const monday = getMondayOf(sunday);
    const mondayKey = toLocalKey(monday);

    const entries = allRevenueRows.filter((r) => {
      const [ry, rmo, rd] = r.date.split('-').map(Number);
      const rDate = new Date(ry, rmo - 1, rd);
      const rMonday = getMondayOf(rDate);
      return toLocalKey(rMonday) === mondayKey;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const weeklyTotal = entries.reduce((sum, r) => sum + r.value, 0);
    const sundayKey = toLocalKey(sunday);
    const weekGoal = getWeeklyGoalForDate(sundayKey, goals);

    const msPerDay = 86_400_000;
    const yearStart = new Date(monday.getFullYear(), 0, 1);
    const yearStartMonday = getMondayOf(yearStart);
    const weekNumber = Math.floor((monday.getTime() - yearStartMonday.getTime()) / (7 * msPerDay)) + 1;

    return {
      weekStartDate: monday,
      weekEndDate: sunday,
      dailyEntries: entries,
      weeklyTotal,
      differenceFromGoal: weeklyTotal - weekGoal,
      weeklyGoal: weekGoal,
      weekNumber,
    };
  });

  const proratedExpenses = prorateExpensesForMonth(rows, selectedMonth);
  const survivalGoals = computeGlobalSurvivalGoals(rows, selectedMonth);

  const staticYearCost = resolveGoalForYear(goals.annualCosts, reportYear);
  const yearRevenue = metrics.byYear[String(reportYear)]?.grossAnnual ?? 0;
  const annualPct = staticYearCost > 0
    ? ((yearRevenue / staticYearCost) * 100).toFixed(1)
    : '0.0';

  const lines: string[] = [];

  // Header
  lines.push(
    `📆 *Relatório Financeiro*`,
    `_Ref: ${monthName} de ${reportYear}_`,
    '',
  );

  // Month summary
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
      `• Receitas do Mês: *${fmtBRL(monthMetrics.grossMonthly)}*`,
      `• Média Diária: ${fmtBRL(monthMetrics.dailyAvg)}`,
      `• Média Semanal: ${fmtBRL(monthMetrics.weeklyAvg)}`,
      `• Meta Diária ${reportYear} (${fmtBRL(reportDailyGoal)}):${goalNote}`,
      '',
    );
  } else {
    lines.push(`📊 *Sem resultados registrados para este mês.*`, '');
  }

  // Extrato de Entradas por Semana
  if (weekGroups.length > 0) {
    lines.push(`📋 *Extrato de Entradas por Semana*`);

    for (const week of weekGroups) {
      lines.push('');
      lines.push(
        `🗓️ *Semana ${week.weekNumber} de ${week.weekStartDate.getFullYear()} (${fmtDate(week.weekStartDate)} a ${fmtDate(week.weekEndDate)})*`,
      );

      if (week.dailyEntries.length === 0) {
        lines.push(
          `📉 Fechamento: *R$ 0,00* _(Faltam ${fmtBRL(week.weeklyGoal)} para a meta)_`,
        );
      } else {
        for (const row of week.dailyEntries) {
          const desc = row.description ? ` — ${row.description}` : '';
          lines.push(`• ${fmtDay(row.date)}: *${fmtBRL(row.value)}*${desc}`);
        }

        const diff = week.differenceFromGoal;
        if (diff === 0) {
          lines.push(
            `🎯 Fechamento: *${fmtBRL(week.weeklyTotal)}* _(Meta cravada!)_`,
          );
        } else if (diff > 0) {
          lines.push(
            `🎯 Fechamento: *${fmtBRL(week.weeklyTotal)}* _(Superou ${fmtBRL(diff)} da meta!)_`,
          );
        } else {
          lines.push(
            `📉 Fechamento: *${fmtBRL(week.weeklyTotal)}* _(Faltam ${fmtBRL(Math.abs(diff))} para a meta)_`,
          );
        }
      }
    }
    lines.push('');
  }

  // Cost items
  if (proratedExpenses.length > 0) {
    lines.push(`💸 *Custos do Período*`);
    lines.push('');
    for (const pe of proratedExpenses) {
      const desc = pe.row.description ?? 'Sem descrição';
      const isProrated = Math.round(pe.monthlyContribution * 100) < Math.round(pe.row.value * 100);
      const suffix = isProrated
        ? ` _(rateado: ${fmtBRL(pe.monthlyContribution)} este mês)_`
        : '';
      lines.push(`• ${desc}: *-${fmtBRL(pe.row.value)}*${suffix}`);
    }
    const monthExpenseTotal = proratedExpenses.reduce((sum, pe) => sum + pe.monthlyContribution, 0);
    const mDays = daysInMonth(selY, selM);
    const expDailyAvg  = mDays > 0 ? monthExpenseTotal / mDays : 0;
    const expWeeklyAvg = expDailyAvg * 7;
    lines.push(`• *Total de Gastos do Mês:* _-${fmtBRL(monthExpenseTotal)}_`);
    lines.push(`• *Média de Gasto Semanal:* _-${fmtBRL(expWeeklyAvg)}_`);
    lines.push(`• *Média de Gasto Diário:* _-${fmtBRL(expDailyAvg)}_`);
    lines.push(`• *Total de Despesas Anuais: ${fmtBRL(staticYearCost)}* _(${annualPct}% coberto em ${reportYear})_`);
    lines.push('');
  }

  // Global views
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
    `• Faturamento Total Histórico: *${fmtBRL(metrics.grossTotal)}*`,
    ...(metrics.totalExpenses > 0
      ? [
        `• Total de Despesas Registradas: *-${fmtBRL(metrics.totalExpenses)}*`,
        `• 💰 Saldo Líquido Global: *${fmtBRL(metrics.netBalance)}*`,
      ]
      : []),
    `• Média Diária Global: ${fmtBRL(metrics.globalDailyAvg)}`,
    `• Meta Semanal ${reportYear}: ${fmtBRL(reportWeeklyGoal)}`,
    ...(survivalGoals
      ? [
        `• 🛡️ Meta de Sobrevivência Mensal: ${fmtBRL(survivalGoals.monthlySurvival)}`,
        `• 🛡️ Meta de Sobrevivência Semanal: ${fmtBRL(survivalGoals.weeklySurvival)}`,
        `• 🛡️ Meta de Sobrevivência Diária: ${fmtBRL(survivalGoals.dailySurvival)}`,
      ]
      : []),
    balanceLine,
    '',
  );

  // Balanço Operacional & Parcerias
  const regularIncome = metrics.grossTotal;
  const goalTarget = metrics.billableWeeks > 0 && reportWeeklyGoal > 0
    ? Math.round(metrics.billableWeeks * reportWeeklyGoal * 100) / 100
    : 0;

  const fmtW = (w: number) => `${w.toFixed(1)} sem`;

  const waiversCount = rows.filter((r) => r.entryType === 'waiver' && r.value > 0).length;
  const waivedWeeks = metrics.waivedWeeks;

  const effectiveWeeksBalance = reportWeeklyGoal > 0 ? metrics.globalGoalBalance / reportWeeklyGoal : 0;
  const absWeeks = Math.abs(effectiveWeeksBalance).toFixed(1);
  const tbLine = effectiveWeeksBalance >= 0
    ? `• ✅ Saldo de Reposição: *+${absWeeks} semanas* _(${absWeeks} semana${parseFloat(absWeeks) !== 1 ? 's' : ''} adiantada${parseFloat(absWeeks) !== 1 ? 's' : ''})_`
    : `• 🚨 Saldo de Reposição: *-${absWeeks} semanas* _(Volume de serviço pendente para recuperar o teto da meta)_`;

  // Netting
  const partnerInRows = rows.filter((r) => r.entryType === 'partner_in' && r.value > 0);
  const partnerOutRows = rows.filter((r) => r.entryType === 'partner_out' && r.value > 0);

  const matchedInIds = new Set<string>();
  const matchedOutIds = new Set<string>();
  const canceledPartnerships: TableRow[] = [];

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

  const unmatchedPartnerOut = partnerOutRows.filter((r) => !matchedOutIds.has(r.id));
  const recentPartnerOut = unmatchedPartnerOut.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  const canceledAmount = Math.min(metrics.totalPartnerIn, metrics.totalPartnerOut);
  const liquidPartnerIn  = metrics.totalPartnerIn  - canceledAmount;
  const liquidPartnerOut = metrics.totalPartnerOut - canceledAmount;
  const totalDevido = goalTarget + liquidPartnerOut;

  const effectiveFinalWeeks = reportWeeklyGoal > 0 ? balance / reportWeeklyGoal : 0;

  lines.push(
    `📊 *Balanço Operacional & Indicadores*`,
    `(+) Receitas Operacionais: ${fmtBRL(regularIncome)} _(${fmtW(metrics.grossTotalWeeks)})_`
  );

  if (metrics.totalWaiverCredit > 0) {
    lines.push(`(+) Justificativas: ${fmtBRL(metrics.totalWaiverCredit)} _(${fmtW(metrics.waiverTotalWeeks)})_`);
  }

  if (liquidPartnerOut > 0) {
    lines.push(`(−) Total Devido (Metas + Parceria Líq.): ${fmtBRL(totalDevido)} _(${fmtW(metrics.goalTotalWeeks)})_`);
    lines.push(`    Metas: ${fmtBRL(goalTarget)} + Parceria Líq.: ${fmtBRL(liquidPartnerOut)}`);
    if (recentPartnerOut.length > 0) {
      lines.push(`🔎 *Déficit Real de Parceria (A pagar):*`);
      for (const row of recentPartnerOut) {
        const desc = row.description ? ` — ${row.description}` : '';
        lines.push(`  • ${fmtDay(row.date)}: *${fmtBRL(row.value)}*${desc}`);
      }
    }
  } else {
    lines.push(`(−) Metas Acumuladas: ${fmtBRL(goalTarget)} _(${fmtW(metrics.goalTotalWeeks)})_`);
  }

  if (liquidPartnerIn > 0) {
    lines.push(`(+) Créditos de Parceria (Líquido): ${fmtBRL(liquidPartnerIn)}`);
  }
  if (canceledAmount > 0) {
    lines.push(`🤝 Parceria cancelada mutuamente: ${fmtBRL(canceledAmount)}`);
  }

  lines.push(
    `(=) *Saldo Final: ${fmtBRL(balance)} (${effectiveFinalWeeks >= 0 ? '+' : ''}${effectiveFinalWeeks.toFixed(1)} sem)*`,
    '',
    `• ⏳ Tempo de Parceria: *${metrics.totalElapsedWeeks} semanas*`
  );

  if (waivedWeeks > 0) {
    lines.push(`• 🛡️ Período Justificado: *${waivedWeeks.toFixed(1)} semanas* (${waiversCount} ocorrência${waiversCount !== 1 ? 's' : ''})`);
  }

  lines.push(
    tbLine,
    '',
    `_Gerado pelo Assistente Moeda · Heiss-Lab 🪙_`
  );

  return lines.join('\n');
}

export async function shareWhatsAppReport(
  tableName: string,
  metrics: TableMetrics,
  goals: TableGoals,
  selectedMonth: string,
  rows: TableRow[],
  availableMonths: string[],
): Promise<void> {
  const reportMonth = selectedMonth === 'all'
    ? (availableMonths[0] ?? new Date().toISOString().slice(0, 7))
    : selectedMonth;

  const report = buildWhatsAppReport(tableName, metrics, goals, reportMonth, rows);

  try {
    await Share.share({
      message: report,
      title: `Relatório — ${tableName}`,
    });
  } catch {
    Alert.alert('Erro', 'Não foi possível compartilhar o relatório.');
  }
}

// ── PDF Export HTML String Builder ────────────────────────────────────────────

export function buildReportHTML(
  tableName: string,
  rows: TableRow[],
  metrics: TableMetrics,
  goals: TableGoals,
  selectedMonth: string,
): string {
  const monthName = formatMonthFull(selectedMonth);
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const reportYear = selY;
  const monthMetrics = metrics.byMonth[selectedMonth];
  const mDays = daysInMonth(selY, selM);

  const reportDailyGoal = resolveGoalForYear(goals.dailyGoals, reportYear);
  const reportWeeklyGoal = resolveGoalForYear(goals.weeklyGoals, reportYear);

  // Group rows for this month
  const monthRows = rows
    .filter((r) => r.date.startsWith(selectedMonth))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Prorated expenses
  const proratedExpenses = prorateExpensesForMonth(rows, selectedMonth);
  const expenseTotal = proratedExpenses.reduce((sum, pe) => sum + pe.monthlyContribution, 0);
  const expDailyAvg  = mDays > 0 ? expenseTotal / mDays : 0;
  const expWeeklyAvg = expDailyAvg * 7;

  // Survival goals
  const survival = computeGlobalSurvivalGoals(rows, selectedMonth);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório — ${tableName} — ${monthName}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm 15mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      border-bottom: 2px solid #a855f7;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-title-label {
      font-size: 10px;
      color: #a855f7;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 800;
      margin: 4px 0 0;
      color: #0f172a;
    }
    .header-meta {
      text-align: right;
    }
    .header-meta .label {
      font-size: 11px;
      color: #64748b;
    }
    .header-meta .value {
      font-size: 16px;
      font-weight: 700;
      color: #a855f7;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #a855f7;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin: 20px 0 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .grid-6 {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .metric-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      background: #f8fafc;
    }
    .metric-card.alert-card {
      border-color: #fecaca;
      background: #fef2f2;
    }
    .metric-card.success-card {
      border-color: #bbf7d0;
      background: #f0fdf4;
    }
    .metric-label {
      font-size: 9px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 15px;
      font-weight: 700;
      font-family: monospace;
    }
    .table-container {
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      font-size: 11px;
      color: #475569;
      text-transform: uppercase;
    }
    .align-right {
      text-align: right;
    }
    .monospace {
      font-family: monospace;
      font-weight: 600;
    }
    .text-success { color: #10b981; }
    .text-danger { color: #ef4444; }
    .text-info { color: #3b82f6; }
    .text-warning { color: #f59e0b; }
    
    .badge {
      display: inline-block;
      padding: 2px 6px;
      font-size: 9px;
      font-weight: 700;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-revenue { background: #d1fae5; color: #065f46; }
    .badge-expense { background: #fee2e2; color: #991b1b; }
    .badge-deposit { background: #dbeafe; color: #1e40af; }
    .badge-waiver { background: #fef3c7; color: #92400e; }
    .badge-partner_in { background: #ecfeff; color: #0891b2; }
    .badge-partner_out { background: #ffedd5; color: #ea580c; }

    .practical-guide {
      page-break-before: always;
      margin-top: 30px;
      padding-top: 20px;
    }
    .guide-title {
      text-align: center;
      margin-bottom: 20px;
    }
    .guide-card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .guide-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      background: #fafafa;
    }
    .guide-card-title {
      font-weight: 700;
      margin-bottom: 4px;
      font-size: 13px;
    }
    .step-item {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #fafafa;
    }
    .step-badge {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: #f3e8ff;
      color: #a855f7;
      display: flex;
      align-items: center;
      justifyContent: center;
      font-weight: 700;
      font-family: monospace;
      flex-shrink: 0;
      border: 1px solid #e9d5ff;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      margin-top: 40px;
      padding-top: 12px;
    }
  </style>
</head>
<body>
  
  <div class="header">
    <div>
      <div class="header-title-label">💰 Assistente Moeda — Relatório Financeiro</div>
      <h1>${tableName}</h1>
    </div>
    <div class="header-meta">
      <div class="label">Referência</div>
      <div class="value">${monthName}</div>
    </div>
  </div>

  <!-- ── SECTION 1: MONTHLY INCOME ── -->
  <div class="section-title">Resumo do Mês</div>
  <div class="grid-4">
    <div class="metric-card">
      <div class="metric-label">Receita Bruta</div>
      <div class="metric-value text-success">${monthMetrics ? fmtBRL(monthMetrics.grossMonthly) : 'R$ 0,00'}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Média Diária</div>
      <div class="metric-value">${monthMetrics ? fmtBRL(monthMetrics.dailyAvg) : 'R$ 0,00'}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Média Semanal</div>
      <div class="metric-value">${monthMetrics ? fmtBRL(monthMetrics.weeklyAvg) : 'R$ 0,00'}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Dias do Período</div>
      <div class="metric-value">${mDays} dias</div>
    </div>
  </div>

  <!-- ── SECTION 2: ACCRUED EXPENSES ── -->
  ${expenseTotal > 0 ? `
  <div class="section-title">Custos Rateados do Mês (Competência)</div>
  <div class="grid-3">
    <div class="metric-card alert-card">
      <div class="metric-label">Custos no Período</div>
      <div class="metric-value text-danger">-${fmtBRL(expenseTotal)}</div>
    </div>
    <div class="metric-card alert-card">
      <div class="metric-label">Média Semanal</div>
      <div class="metric-value text-danger">-${fmtBRL(expWeeklyAvg)}</div>
    </div>
    <div class="metric-card alert-card">
      <div class="metric-label">Média Diária</div>
      <div class="metric-value text-danger">-${fmtBRL(expDailyAvg)}</div>
    </div>
  </div>
  ` : ''}

  <!-- ── SECTION 3: CONSOLIDATED PANEL ── -->
  <div class="section-title">Painel Consolidado</div>
  
  <div class="grid-6" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px;">
    <div style="padding: 4px;">
      <div class="metric-label" style="font-size: 8px;">Faturamento Total</div>
      <div class="metric-value" style="font-size: 11px; color: #10b981;">${fmtBRL(metrics.grossTotal)}</div>
    </div>
    <div style="padding: 4px;">
      <div class="metric-label" style="font-size: 8px;">Total Custos</div>
      <div class="metric-value" style="font-size: 11px; color: #ef4444;">${fmtBRL(metrics.totalExpenses)}</div>
    </div>
    <div style="padding: 4px;">
      <div class="metric-label" style="font-size: 8px;">Saldo Líquido</div>
      <div class="metric-value" style="font-size: 11px; color: ${metrics.netBalance >= 0 ? '#10b981' : '#ef4444'}">${fmtBRL(metrics.netBalance)}</div>
    </div>
    <div style="padding: 4px;">
      <div class="metric-label" style="font-size: 8px;">Banco Tempo</div>
      <div class="metric-value" style="font-size: 11px; color: ${metrics.timeBankBalance >= 0 ? '#10b981' : '#ef4444'}">${metrics.timeBankBalance >= 0 ? '+' : ''}${metrics.timeBankBalance.toFixed(1)} sem.</div>
    </div>
    <div style="padding: 4px;">
      <div class="metric-label" style="font-size: 8px;">Abonos</div>
      <div class="metric-value" style="font-size: 11px; color: #f59e0b;">${fmtBRL(metrics.totalWaiverCredit)}</div>
    </div>
    <div style="padding: 4px;">
      <div class="metric-label" style="font-size: 8px;">Saldo Metas</div>
      <div class="metric-value" style="font-size: 11px; color: ${metrics.globalGoalBalance >= 0 ? '#10b981' : '#ef4444'}">${fmtBRL(metrics.globalGoalBalance)}</div>
    </div>
  </div>

  ${survival ? `
  <div class="grid-3" style="background: #f5f3ff; border: 1px solid #c084fc; border-radius: 8px; padding: 6px;">
    <div style="padding: 4px;">
      <div class="metric-label" style="color: #7c3aed;">🛡️ Sobrevivência Diária</div>
      <div class="metric-value" style="font-size: 12px; color: #5b21b6;">${fmtBRL(survival.dailySurvival)}</div>
    </div>
    <div style="padding: 4px;">
      <div class="metric-label" style="color: #7c3aed;">🛡️ Sobrevivência Semanal</div>
      <div class="metric-value" style="font-size: 12px; color: #5b21b6;">${fmtBRL(survival.weeklySurvival)}</div>
    </div>
    <div style="padding: 4px;">
      <div class="metric-label" style="color: #7c3aed;">🛡️ Sobrevivência Mensal</div>
      <div class="metric-value" style="font-size: 12px; color: #5b21b6;">${fmtBRL(survival.monthlySurvival)}</div>
    </div>
  </div>
  ` : ''}

  <!-- ── SECTION 4: DETAILED LIST ── -->
  <div class="section-title">Lançamentos do Mês</div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Tipo</th>
          <th>Descrição</th>
          <th class="align-right">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${monthRows.length === 0 ? `
          <tr>
            <td colspan="4" style="text-align: center; color: #94a3b8; font-style: italic;">Nenhum lançamento neste mês.</td>
          </tr>
        ` : monthRows.map((r) => {
          const type = r.entryType || 'revenue';
          const isNeg = type === 'expense' || type === 'partner_out';
          return `
            <tr>
              <td class="monospace">${fmtDay(r.date)}</td>
              <td><span class="badge badge-${type}">${type === 'revenue' ? 'Receita' : type === 'expense' ? 'Despesa' : type === 'deposit' ? 'Depósito' : type === 'waiver' ? 'Abono' : type === 'partner_in' ? 'Sócio ↓' : 'Sócio ↑'}</span></td>
              <td>
                ${r.description || 'Sem descrição'}
                ${r.periodStart && r.periodEnd ? `<br><small style="color: #64748b; font-size: 9px;">Período: ${fmtDay(r.periodStart)} → ${fmtDay(r.periodEnd)}</small>` : ''}
                ${r.monthlyValue && r.monthCount ? `<br><small style="color: #64748b; font-size: 9px;">Fator Mensal: ${fmtBRL(r.monthlyValue)} × ${r.monthCount} meses</small>` : ''}
              </td>
              <td class="align-right monospace ${isNeg ? 'text-danger' : 'text-success'}">
                ${isNeg ? '-' : ''}${formatCurrencySmart(r.value)}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- ── PAGE 2: PRACTICAL GUIDE ── -->
  <div class="practical-guide">
    <div class="guide-title">
      <h2 style="font-size: 18px; fontWeight: 800; margin: 0 0 4px; color: #0f172a;">Assuma o Controle do Seu Fluxo de Caixa</h2>
      <div style="font-size: 11px; color: #64748b;">Princípios essenciais do Regime de Competência do Assistente Moeda.</div>
    </div>

    <div class="guide-card-grid">
      <div class="guide-card" style="border-color: #fee2e2; background: #fff5f5;">
        <div class="guide-card-title text-danger">💸 A Ilusão do Faturamento Semanal</div>
        <p style="font-size: 11px; color: #475569; margin: 4px 0 0;">Faturar bem na semana dá uma falsa sensação de lucro. Se você não isolar e diluir custos recorrentes de longo prazo (como IPVA, seguros ou manutenção preventiva), seu capital de giro real desaparece.</p>
      </div>
      <div class="guide-card" style="border-color: #bbf7d0; background: #f0fdf4;">
        <div class="guide-card-title text-success">🛡️ Clareza Operacional e Meta de Sobrevivência</div>
        <p style="font-size: 11px; color: #475569; margin: 4px 0 0;">Lançar despesas rateando-as pelos dias reais de vigência distribui o peso igualmente, mostrando o custo de rodagem diário exato. O lucro do mês se torna limpo e perfeitamente calculável.</p>
      </div>
    </div>

    <div class="section-title" style="margin-top: 15px;">Guia de Operação da Tabela</div>
    <div class="step-item">
      <div class="step-badge">1</div>
      <div>
        <div style="font-weight: 700; font-size: 12px;">Lance o dia a dia (Custos Variáveis)</div>
        <p style="margin: 2px 0 0; color: #475569; font-size: 11px;">Insira receitas operacionais e gastos variáveis normais na mesma data de ocorrência para monitorar as médias exatas do período atual.</p>
      </div>
    </div>
    <div class="step-item">
      <div class="step-badge">2</div>
      <div>
        <div style="font-weight: 700; font-size: 12px;">Dilua Custos Fixos em Períodos (Regime de Competência)</div>
        <p style="margin: 2px 0 0; color: #475569; font-size: 11px;">Ao lançar contratos, seguros ou despesas fixas anuais, ative a opção "Período" com a vigência de meses correspondente. O motor distribui os valores igualmente pelos dias.</p>
      </div>
    </div>
    <div class="step-item">
      <div class="step-badge">3</div>
      <div>
        <div style="font-weight: 700; font-size: 12px;">Monitore o Banco de Tempo</div>
        <p style="margin: 2px 0 0; color: #475569; font-size: 11px;">O Banco de Tempo representa quantas semanas de teto de meta você acumulou de folga (+) ou deve repor de serviço (-) para manter a integridade da meta.</p>
      </div>
    </div>

    <div class="footer">
      <div>Relatório oficial gerado localmente pelo Heiss-Lab Assistente Moeda.</div>
      <div style="font-weight: 700; margin-top: 2px; color: #a855f7;">heisslab.com.br/laboratorio/assistente-moeda</div>
    </div>
  </div>

</body>
</html>
  `;
}

export async function sharePDFReport(
  tableName: string,
  rows: TableRow[],
  metrics: TableMetrics,
  goals: TableGoals,
  selectedMonth: string,
  availableMonths: string[],
): Promise<void> {
  const reportMonth = selectedMonth === 'all'
    ? (availableMonths[0] ?? new Date().toISOString().slice(0, 7))
    : selectedMonth;

  try {
    const html = buildReportHTML(tableName, rows, metrics, goals, reportMonth);

    if (Platform.OS === 'web') {
      const popup = window.open('', '_blank', 'width=840,height=1100');
      if (!popup) {
        Alert.alert('Erro', 'O bloqueador de pop-ups impediu a exportação. Permita pop-ups e tente novamente.');
        return;
      }
      const monthLabel = formatMonthFull(reportMonth);
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.onload = () => {
        setTimeout(() => {
          popup.focus();
          popup.print();
        }, 400);
      };
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Relatório PDF — ${tableName}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (error: any) {
    Alert.alert('Erro na exportação', error.message || 'Não foi possível gerar o PDF.');
  }
}

// ── CSV Export ────────────────────────────────────────────────────────────────

export function buildCSV(
  rows: TableRow[],
  tableName?: string,
  description?: string,
  goals?: TableGoals,
): string {
  if (tableName && goals) {
    const meta: string[] = ['## COIN ASSISTANT BACKUP v2 ##'];
    meta.push(`name,${tableName}`);
    if (description) {
      meta.push(`description,${description}`);
    }

    // 1. Global goals
    if (goals.globalGoals) {
      meta.push(`goal_global_daily,${goals.globalGoals.dailyGoal}`);
      meta.push(`goal_global_weekly,${goals.globalGoals.weeklyGoal}`);
      meta.push(`goal_global_annual,${goals.globalGoals.annualCost}`);
    }

    // 2. Yearly goals
    if (goals.yearlyGoals) {
      Object.entries(goals.yearlyGoals).forEach(([year, g]) => {
        meta.push(`goal_daily_${year},${g.dailyGoal}`);
        meta.push(`goal_weekly_${year},${g.weeklyGoal}`);
        meta.push(`goal_annual_${year},${g.annualCost}`);
      });
    }

    // 3. Monthly goals
    if (goals.monthlyGoals) {
      Object.entries(goals.monthlyGoals).forEach(([month, g]) => {
        meta.push(`goal_monthly_daily_${month},${g.dailyGoal}`);
        meta.push(`goal_monthly_weekly_${month},${g.weeklyGoal}`);
        meta.push(`goal_monthly_annual_${month},${g.annualCost}`);
      });
    }

    // 4. Weekly overrides (manual sprints)
    if (goals.weeklyGoals) {
      Object.entries(goals.weeklyGoals).forEach(([key, val]) => {
        if (typeof key === 'string' && key.includes('-W')) {
          meta.push(`goal_weekly_${key},${val}`);
        }
      });
    }

    meta.push('## ROWS ##');
    const header = 'date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json';
    const lines = rows.map((r) => {
      const cols = [
        r.date,
        r.value,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        r.entryType || 'revenue',
        r.monthlyValue !== undefined ? r.monthlyValue : '',
        r.monthCount !== undefined ? r.monthCount : '',
        r.periodStart || '',
        r.periodEnd || '',
        r.category ? `"${r.category.replace(/"/g, '""')}"` : '',
        r.tags ? `"${r.tags.replace(/"/g, '""')}"` : '',
        r.metadataJson ? `"${r.metadataJson.replace(/"/g, '""')}"` : '',
      ];
      return cols.join(',');
    });

    return [...meta, header, ...lines].join('\n');
  }

  // Fallback to standard semicolon-delimited CSV for plain rows export
  const header = 'Data;Tipo;Valor;Descrição;Período Início;Período Fim;Valor Mensal;Meses;Gerado Por;Categoria;Tags;Metadados';
  const lines = rows.map((r) => {
    const cols = [
      r.date,
      r.entryType || 'revenue',
      r.value.toString().replace('.', ','),
      `"${(r.description || '').replace(/"/g, '""')}"`,
      r.periodStart || '',
      r.periodEnd || '',
      r.monthlyValue?.toString().replace('.', ',') || '',
      r.monthCount?.toString() || '',
      r.generatedBy || '',
      r.category ? `"${r.category.replace(/"/g, '""')}"` : '',
      r.tags ? `"${r.tags.replace(/"/g, '""')}"` : '',
      r.metadataJson ? `"${r.metadataJson.replace(/"/g, '""')}"` : '',
    ];
    return cols.join(';');
  });
  return [header, ...lines].join('\n');
}

export async function shareCSVText(
  csv: string,
  tableName: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName.replace(/\s+/g, '_')}_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o CSV.');
    }
    return;
  }

  try {
    const fileName = `${tableName.replace(/\s+/g, '_')}_export.csv`;
    const filePath = `${cacheDirectory}${fileName}`;

    await writeAsStringAsync(filePath, csv, {
      encoding: EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: `Exportar CSV — ${tableName}`,
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('Erro', 'O compartilhamento não está disponível neste dispositivo.');
    }
  } catch (error: any) {
    Alert.alert('Erro na exportação', error.message || 'Não foi possível exportar o CSV.');
  }
}

export async function shareCSV(
  rows: TableRow[],
  tableName: string,
): Promise<void> {
  const csv = buildCSV(rows);
  return shareCSVText(csv, tableName);
}

// ── WhatsApp Weekly Dossier Builder ──────────────────────────────────────────

export function buildWhatsAppDossie(
  selectedEntries: WeekDebtEntry[],
  globalBalance: number,
  rows: TableRow[],
  goals: TableGoals,
): string {
  const revenueRows = rows.filter(
    (r) =>
      r.value > 0 &&
      r.entryType !== 'deposit' &&
      r.entryType !== 'waiver' &&
      r.entryType !== 'expense' &&
      r.entryType !== 'partner_in' &&
      r.entryType !== 'partner_out',
  );

  const msPerDay = 86_400_000;
  const revenueDayMap = new Map<string, number>();
  for (const row of revenueRows) {
    if (row.periodStart && row.periodEnd) {
      const startMs = new Date(row.periodStart + 'T12:00:00').getTime();
      const endMs = new Date(row.periodEnd + 'T12:00:00').getTime();
      const periodDays = Math.max(1, Math.round((endMs - startMs) / msPerDay) + 1);
      const dailyValue = row.value / periodDays;
      for (let ms = startMs; ms <= endMs; ms += msPerDay) {
        const dayKey = toLocalKey(new Date(ms));
        revenueDayMap.set(dayKey, (revenueDayMap.get(dayKey) ?? 0) + dailyValue);
      }
    } else {
      revenueDayMap.set(row.date, (revenueDayMap.get(row.date) ?? 0) + row.value);
    }
  }

  const lines: string[] = [];
  lines.push(`*📊 DOSSIÊ DE AUDITORIA OPERACIONAL - ASSISTENTE MOEDA*`);
  lines.push(``);

  let sumDelta = 0;

  for (const week of selectedEntries) {
    const monday = new Date(week.mondayKey + 'T12:00:00');
    const sunday = new Date(week.sundayKey + 'T12:00:00');
    
    const dailyValues: number[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dayKey = toLocalKey(day);
      dailyValues.push(revenueDayMap.get(dayKey) ?? 0);
    }
    const minVal = Math.min(...dailyValues);
    const maxVal = Math.max(...dailyValues);
    const dailyAvg = week.weeklyRevenue / 7;

    const startFmt = fmtDate(monday);
    const endFmt = fmtDate(sunday);

    const deltaSign = week.weekDelta >= 0 ? '+' : '';
    
    lines.push(`🗓️ *Semana ${week.weekNumber} de ${monday.getFullYear()} (${startFmt} a ${endFmt})*`);
    lines.push(`• Meta Estabelecida: R$ ${fmtVal(week.weeklyGoal)}`);
    lines.push(`• Faturamento Real: R$ ${fmtVal(week.weeklyRevenue)}`);
    lines.push(`• Média Diária: R$ ${fmtVal(dailyAvg)} (Inconstância: Min R$ ${fmtVal(minVal)} / Max R$ ${fmtVal(maxVal)})`);
    lines.push(`⚖️ *Saldo da Semana:* ${deltaSign}R$ ${fmtVal(week.weekDelta)}`);
    lines.push(`---`);

    sumDelta += week.weekDelta;
  }

  const sumDeltaSign = sumDelta >= 0 ? '+' : '';
  const globalBalanceSign = globalBalance >= 0 ? '+' : '';

  lines.push(`*📉 CONCLUSÃO DO BALANÇO CONSOLIDADO*`);
  lines.push(`• Semanas Auditadas: ${selectedEntries.length}`);
  lines.push(`• Impacto destas semanas: ${sumDeltaSign}R$ ${fmtVal(sumDelta)}`);
  lines.push(`• 🏦 *SALDO GERAL DO SISTEMA:* ${globalBalanceSign}R$ ${fmtVal(globalBalance)}`);
  lines.push(`_(O Saldo Geral já inclui todos os seus superávits, justificativas e histórico total operado)_`);
  lines.push(`_Código Licenciado sob Termos de Uso Aberto e Colaborativo._`);

  return lines.join('\n');
}

function fmtVal(v: number): string {
  return Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function shareWhatsAppDossie(
  selectedEntries: WeekDebtEntry[],
  globalBalance: number,
  rows: TableRow[],
  goals: TableGoals,
  tableName: string,
): Promise<void> {
  const report = buildWhatsAppDossie(selectedEntries, globalBalance, rows, goals);

  try {
    await Share.share({
      message: report,
      title: `Dossiê — ${tableName}`,
    });
  } catch {
    Alert.alert('Erro', 'Não foi possível compartilhar o dossiê.');
  }
}

// ── Tabular PDF Audit Export ──────────────────────────────────────────────────

export function buildTabularAuditHTML(
  tableName: string,
  selectedWeeks: WeekDebtEntry[],
): string {
  const sortedWeeks = [...selectedWeeks].sort((a, b) => a.mondayKey.localeCompare(b.mondayKey));
  
  const count = sortedWeeks.length;
  let spanText = '';
  let globalStatus = 'EQUILIBRADO';
  let isSuperavit = true;

  if (count > 0) {
    const firstMon = new Date(sortedWeeks[0].mondayKey + 'T12:00:00');
    const lastSun = new Date(sortedWeeks[count - 1].sundayKey + 'T12:00:00');
    
    const fmtDayMonth = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}`;
    };

    spanText = `${count} semana${count !== 1 ? 's' : ''} (${fmtDayMonth(firstMon)} a ${fmtDayMonth(lastSun)})`;
    
    const finalBalance = sortedWeeks[count - 1].cumulativeBalance;
    if (finalBalance < -0.01) {
      globalStatus = 'INADIMPLÊNCIA';
      isSuperavit = false;
    } else if (finalBalance > 0.01) {
      globalStatus = 'SUPERÁVIT';
      isSuperavit = true;
    }
  }

  let totalMeta = 0;
  let totalRevenue = 0;
  let totalWaivers = 0;
  let totalPartner = 0;
  let totalDelta = 0;

  for (const w of sortedWeeks) {
    totalMeta += w.weeklyGoal;
    totalRevenue += w.weeklyRevenue;
    totalWaivers += w.weeklyWaivers;
    totalPartner += w.weeklyPartnerNet;
    totalDelta += w.weekDelta;
  }

  const finalAccumulated = count > 0 ? sortedWeeks[count - 1].cumulativeBalance : 0;

  const rowsHtml = sortedWeeks.map((w) => {
    const deltaSign = w.weekDelta >= 0 ? '+' : '';
    const accumSign = w.cumulativeBalance >= 0 ? '+' : '';
    const partnerSign = w.weeklyPartnerNet > 0 ? '+' : '';
    
    const fmtWaivers = w.weeklyWaivers > 0 
      ? `<br><small style="color: #ea580c; font-size: 10px;">(Abono: ${fmtBRL(w.weeklyWaivers)})</small>`
      : '';

    const weekYear = new Date(w.mondayKey + 'T12:00:00').getFullYear();
    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: #0f172a;">Semana ${w.weekNumber} de ${weekYear}</div>
          <div style="font-size: 10px; color: #64748b;">${w.weekLabel}</div>
        </td>
        <td class="align-right monospace">${fmtBRL(w.weeklyGoal)}</td>
        <td class="align-right monospace">
          <span style="color: #16a34a;">${fmtBRL(w.weeklyRevenue)}</span>
          ${fmtWaivers}
        </td>
        <td class="align-right monospace ${w.weeklyPartnerNet > 0 ? 'text-cyan' : w.weeklyPartnerNet < 0 ? 'text-orange' : ''}">
          ${w.weeklyPartnerNet !== 0 ? `${partnerSign}${fmtBRL(w.weeklyPartnerNet)}` : 'R$ 0,00'}
        </td>
        <td class="align-right monospace ${w.weekDelta >= 0 ? 'text-success' : 'text-danger'}">
          ${deltaSign}${fmtBRL(w.weekDelta)}
        </td>
        <td class="align-right monospace ${w.cumulativeBalance >= 0 ? 'text-success' : 'text-danger'}" style="font-weight: 700;">
          ${accumSign}${fmtBRL(w.cumulativeBalance)}
        </td>
      </tr>
    `;
  }).join('');

  const deltaTotalSign = totalDelta >= 0 ? '+' : '';
  const accumTotalSign = finalAccumulated >= 0 ? '+' : '';
  const partnerTotalSign = totalPartner > 0 ? '+' : '';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Demonstrativo de Saldo Acumulado — ${tableName}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      border-bottom: 2px solid #6b21a8;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-title-label {
      font-size: 9px;
      color: #7c3aed;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 4px 0 2px;
      color: #0f172a;
    }
    .header-span {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .header-meta {
      text-align: right;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .status-superavit {
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .status-inadimplencia {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .status-equilibrado {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      font-weight: 700;
      font-size: 10px;
      color: #475569;
      text-transform: uppercase;
      border-top: 1px solid #cbd5e1;
      border-bottom: 2px solid #cbd5e1;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .align-right {
      text-align: right;
    }
    .monospace {
      font-family: monospace;
      font-weight: 600;
      font-size: 11px;
    }
    .text-success { color: #16a34a; }
    .text-danger { color: #dc2626; }
    .text-cyan { color: #0891b2; }
    .text-orange { color: #ea580c; }
    
    .total-row td {
      background: #f1f5f9 !important;
      font-weight: 800;
      border-top: 2px solid #94a3b8;
      border-bottom: 2px solid #94a3b8;
      font-size: 12px;
    }
    .footer {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }
  </style>
</head>
<body>
  
  <div class="header">
    <div>
      <div class="header-title-label">Demonstrativo de Saldo Acumulado</div>
      <h1>${tableName}</h1>
      <div class="header-span">${spanText}</div>
    </div>
    <div class="header-meta">
      <div class="status-badge ${isSuperavit ? 'status-superavit' : 'status-inadimplencia'}">
        ${globalStatus}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Semana</th>
        <th class="align-right">Meta</th>
        <th class="align-right">Receita/Waivers</th>
        <th class="align-right">Parceria</th>
        <th class="align-right">Δ Semana</th>
        <th class="align-right">Saldo Acumulado</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td>TOTAL</td>
        <td class="align-right monospace">${fmtBRL(totalMeta)}</td>
        <td class="align-right monospace">
          <span style="color: #16a34a;">${fmtBRL(totalRevenue)}</span>
          ${totalWaivers > 0 ? `<br><small style="color: #ea580c; font-size: 10px;">(Abono: ${fmtBRL(totalWaivers)})</small>` : ''}
        </td>
        <td class="align-right monospace ${totalPartner > 0 ? 'text-cyan' : totalPartner < 0 ? 'text-orange' : ''}">
          ${totalPartner !== 0 ? `${partnerTotalSign}${fmtBRL(totalPartner)}` : 'R$ 0,00'}
        </td>
        <td class="align-right monospace ${totalDelta >= 0 ? 'text-success' : 'text-danger'}">
          ${deltaTotalSign}${fmtBRL(totalDelta)}
        </td>
        <td class="align-right monospace ${finalAccumulated >= 0 ? 'text-success' : 'text-danger'}">
          ${accumTotalSign}${fmtBRL(finalAccumulated)}
        </td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div>Demonstrativo gerado localmente pelo Heiss-Lab Assistente Moeda.</div>
    <div style="font-weight: 700; margin-top: 2px; color: #7c3aed;">heisslab.com.br/laboratorio/assistente-moeda</div>
  </div>

</body>
</html>
  `;
}

export async function shareTabularPDFReport(
  tableName: string,
  selectedWeeks: WeekDebtEntry[],
): Promise<void> {
  try {
    const html = buildTabularAuditHTML(tableName, selectedWeeks);

    if (Platform.OS === 'web') {
      const popup = window.open('', '_blank', 'width=840,height=1100');
      if (!popup) {
        Alert.alert('Erro', 'O bloqueador de pop-ups impediu a exportação. Permita pop-ups e tente novamente.');
        return;
      }
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.onload = () => {
        setTimeout(() => {
          popup.focus();
          popup.print();
        }, 400);
      };
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Demonstrativo PDF — ${tableName}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (error: any) {
    Alert.alert('Erro na exportação', error.message || 'Não foi possível gerar o PDF.');
  }
}

