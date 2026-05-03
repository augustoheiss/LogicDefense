import { useState } from 'react';
import type { CoinTable, TableRow, TableMetrics, CostBasedTarget } from '../types';
import { groupRowsByWeek, fmtDate, resolveGoalForYear } from '../utils/dateUtils';

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

/**
 * Determines whether an expense row is active during the report's target month.
 *
 * Uses the start_period / end_period crossover logic:
 *   If the expense has periodStart + periodEnd, the row is included when
 *   any day of the report month falls within [periodStart, periodEnd].
 *   Otherwise, falls back to matching the row's registration date.
 */
function isExpenseActiveInMonth(row: TableRow, selectedMonth: string): boolean {
  if (row.entryType !== 'expense') return false;

  const [selY, selM] = selectedMonth.split('-').map(Number);
  // First and last day of the report month
  const monthStart = new Date(selY, selM - 1, 1);
  const monthEnd = new Date(selY, selM, 0); // last day of month

  if (row.periodStart && row.periodEnd) {
    // Parse period boundaries
    const [psY, psM, psD] = row.periodStart.split('-').map(Number);
    const [peY, peM, peD] = row.periodEnd.split('-').map(Number);
    const periodStart = new Date(psY, psM - 1, psD);
    const periodEnd = new Date(peY, peM - 1, peD);

    // Overlap check: the report month intersects [periodStart, periodEnd]
    return periodStart <= monthEnd && periodEnd >= monthStart;
  }

  // Fallback: match by registration date month
  return row.date.startsWith(selectedMonth);
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

  // ── Revenue rows (exclude deposits, waivers, expenses) ──────────────────
  const allRevenueRows = table.rows
    .filter(
      (r) =>
        r.entryType !== 'deposit' &&
        r.entryType !== 'waiver' &&
        r.entryType !== 'expense' &&
        r.value > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekGroups = groupRowsByWeek(allRevenueRows, table.goals.weeklyGoals).filter(
    (g) => g.weekEndDate.getFullYear() === selY && g.weekEndDate.getMonth() + 1 === selM,
  );

  // ── Expenses active in this month (crossover logic) ─────────────────────
  const activeExpenses = table.rows.filter((r) => isExpenseActiveInMonth(r, selectedMonth));
  const totalExpM = activeExpenses.reduce((s, r) => s + r.value, 0);

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
    `📆 *Relatório de Parceria: Motorista-Executivo*`,
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
      ...(totalExpM > 0 ? [`• Despesas Ativas no Mês: *-${fmt(totalExpM)}*`] : []),
      ...(costBasedTarget && costBasedTarget.annualCost > 0
        ? [
          `• 🛡️ Meta de Sobrevivência Mensal: ${fmt(costBasedTarget.monthlySurvival)}`,
          `• 🛡️ Meta de Sobrevivência Diária: ${fmt(costBasedTarget.dailySurvival)}`,
        ]
        : []),
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

    lines.push('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — The Reality: Custo Operacional do Veículo
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeExpenses.length > 0) {
    lines.push(`💸 *Custo Operacional do Veículo*`);
    lines.push('');
    for (const exp of activeExpenses) {
      const desc = exp.description ?? 'Sem descrição';
      const suffix =
        exp.monthlyValue != null && exp.monthCount != null
          ? ` _(${fmt(exp.monthlyValue)}/mês × ${exp.monthCount}m)_`
          : '';
      lines.push(`• ${desc}: *-${fmt(exp.value)}*${suffix}`);
    }
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
    ...(costBasedTarget && costBasedTarget.annualCost > 0
      ? [`• 🛡️ Meta de Sobrevivência Semanal: ${fmt(costBasedTarget.weeklySurvival)}`]
      : []),
    balanceLine,
    '',
  );

  // ── Cost-based goal coverage message ───────────────────────────────────────
  if (costBasedTarget && costBasedTarget.annualCost > 0 && yearRevenue >= costBasedTarget.annualCost) {
    const netProfit = yearRevenue - costBasedTarget.annualCost;
    lines.push(
      `✅ *Custos operacionais cobertos!* O saldo atual de *${fmt(netProfit)}* em ${reportYear} é lucro líquido puro.`,
      '',
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — Partnership Indicators: Indicadores de Parceria
  // ═══════════════════════════════════════════════════════════════════════════
  const waiversCount = table.rows.filter((r) => r.entryType === 'waiver' && r.value > 0).length;
  const waivedWeeks = metrics.waivedWeeks;

  const tb = metrics.timeBankBalance;
  const absWeeks = Math.abs(tb).toFixed(1);
  const tbLine = tb >= 0
    ? `• ✅ Saldo de Reposição: *+${absWeeks} semanas* _(${absWeeks} semana${parseFloat(absWeeks) !== 1 ? 's' : ''} adiantada${parseFloat(absWeeks) !== 1 ? 's' : ''})_`
    : `• 🚨 Saldo de Reposição: *-${absWeeks} semanas* _(Volume de serviço pendente para recuperar o teto da meta)_`;

  const partnershipTimeLine = `• ⏳ Tempo de Parceria: *${metrics.totalElapsedWeeks} semanas*`;
  const waiverLine = waivedWeeks > 0
    ? `• 🛡️ Período Justificado: *${waivedWeeks.toFixed(1)} semanas* (${waiversCount} ocorrência${waiversCount !== 1 ? 's' : ''})`
    : null;

  lines.push(
    `⏳ *Indicadores de Parceria*`,
    partnershipTimeLine,
    ...(waiverLine ? [waiverLine] : []),
    tbLine,
    '',
  );

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
