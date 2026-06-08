import { useMemo } from 'react';
import type { CoinTable, TableRow } from '../types';
import {
  getMondayOf,
  toLocalKey,
  fmtDate,
  getWeeklyGoalForDate,
} from '../utils/dateUtils';

interface YearlyHeatmapProps {
  year: number;
  table: CoinTable;
  rows: TableRow[];
  selectedWeeks: string[];
  onToggleWeek: (mondayKey: string) => void;
  onClearSelection: () => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function daysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function calculateRowContributionForWeek(
  row: TableRow,
  monday: Date,
  sunday: Date
): number {
  if (row.periodStart && row.periodEnd) {
    const msPerDay = 86_400_000;
    const rowStartMs = new Date(row.periodStart + 'T12:00:00').getTime();
    const rowEndMs = new Date(row.periodEnd + 'T12:00:00').getTime();
    const periodDays = Math.max(1, Math.round((rowEndMs - rowStartMs) / msPerDay) + 1);
    const dailyRate = row.value / periodDays;

    const weekStartMs = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 12).getTime();
    const weekEndMs = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 12).getTime();

    const overlapStartMs = Math.max(rowStartMs, weekStartMs);
    const overlapEndMs = Math.min(rowEndMs, weekEndMs);

    if (overlapStartMs <= overlapEndMs) {
      const overlapDays = Math.round((overlapEndMs - overlapStartMs) / msPerDay) + 1;
      return dailyRate * overlapDays;
    }
    return 0;
  } else {
    const rowDateMs = new Date(row.date + 'T12:00:00').getTime();
    const weekStartMs = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 12).getTime();
    const weekEndMs = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 12).getTime();
    if (rowDateMs >= weekStartMs && rowDateMs <= weekEndMs) {
      return row.value;
    }
    return 0;
  }
}

export function YearlyHeatmap({
  year,
  table,
  rows,
  selectedWeeks,
  onToggleWeek,
  onClearSelection,
}: YearlyHeatmapProps) {

  const monthsData = useMemo(() => {
    return MONTH_NAMES.map((monthName, m) => {
      const totalDays = daysInMonth(year, m);
      const sundays: Date[] = [];
      for (let d = 1; d <= totalDays; d++) {
        const date = new Date(year, m, d);
        if (date.getDay() === 0) {
          sundays.push(date);
        }
      }

      const weeks = sundays.map((sunday, index) => {
        const monday = getMondayOf(sunday);
        const mondayKey = toLocalKey(monday);
        const sundayKey = toLocalKey(sunday);

        // Filter week entries: keep rows that have a positive allocated contribution in this week
        const weekEntries = rows.filter((r) => calculateRowContributionForWeek(r, monday, sunday) > 0);

        // Operational revenue only: exclude deposit, waiver, expense, partner_in, partner_out
        const revenueRows = weekEntries.filter(
          (r) =>
            r.entryType !== 'deposit' &&
            r.entryType !== 'waiver' &&
            r.entryType !== 'expense' &&
            r.entryType !== 'partner_in' &&
            r.entryType !== 'partner_out' &&
            r.value > 0
        );

        const weeklyRevenue = revenueRows.reduce(
          (sum, r) => sum + calculateRowContributionForWeek(r, monday, sunday),
          0
        );
        const weeklyGoal = getWeeklyGoalForDate(sundayKey, table.goals);

        // Check for specific transaction entry types to render overlay badges
        const hasPartnerOut = weekEntries.some((r) => r.entryType === 'partner_out');
        const hasWaiver = weekEntries.some((r) => r.entryType === 'waiver');
        const hasPartnerIn = weekEntries.some((r) => r.entryType === 'partner_in');
        const hasDeposit = weekEntries.some((r) => r.entryType === 'deposit');

        return {
          mondayKey,
          sundayKey,
          monday,
          sunday,
          weekLabel: `S${index + 1}`,
          weeklyRevenue,
          weeklyGoal,
          hasPartnerOut,
          hasWaiver,
          hasPartnerIn,
          hasDeposit,
        };
      });

      return {
        monthName,
        weeks,
      };
    });
  }, [year, table.goals, rows]);

  return (
    <div className="w-full bg-slate-900/40 border border-white/10 rounded-xl p-5 md:p-6 backdrop-blur-sm shadow-xl mt-2 mb-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white font-outfit flex items-center gap-2">
            <span className="text-[#a855f7]">📅</span> Mapa de Calor Operacional
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            Progresso semanal contra metas e fluxo de transações para o ano de {year}
          </p>
        </div>
        {selectedWeeks.length > 0 && (
          <div className="flex items-center gap-2 bg-[#a855f7]/10 border border-[#a855f7]/20 rounded-lg px-3 py-1.5 text-xs text-[#d8b4fe] font-medium">
            <span>Selecionadas: {selectedWeeks.length} {selectedWeeks.length === 1 ? 'semana' : 'semanas'}</span>
            <button
              onClick={onClearSelection}
              className="text-[10px] bg-[#a855f7]/20 hover:bg-[#a855f7]/30 text-white px-1.5 py-0.5 rounded transition-colors font-bold uppercase tracking-wider"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* Grid: 3 rows of 4 months on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {monthsData.map(({ monthName, weeks }) => (
          <div
            key={monthName}
            className="bg-slate-950/45 border border-indigo-500/10 hover:border-indigo-500/20 rounded-xl p-4 transition-all duration-300 flex flex-col justify-between"
          >
            {/* Month Header */}
            <h4 className="text-sm font-semibold text-slate-300 font-outfit border-b border-white/5 pb-2 mb-3">
              {monthName}
            </h4>

            {/* Weeks Grid */}
            <div className="grid grid-cols-5 gap-1.5">
              {weeks.map((week) => {
                const isSelected = selectedWeeks.includes(week.mondayKey);
                const isSuccess = week.weeklyRevenue >= week.weeklyGoal;
                const statusColor = isSuccess
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-red-500/20 border-red-500 text-red-300';

                const selectStyle = isSelected
                  ? 'ring-2 ring-white border-white scale-[1.05] z-10 transition-all shadow-lg'
                  : 'border-white/10 hover:scale-[1.02]';

                const titleTooltip = `Semana ${week.weekLabel.slice(1)}: ${fmtDate(week.monday)} a ${fmtDate(week.sunday)}\n` +
                  `Receita: ${fmt(week.weeklyRevenue)} / Meta: ${fmt(week.weeklyGoal)}\n` +
                  `Status: ${isSuccess ? 'Meta Atingida' : 'Abaixo da Meta'}` +
                  (week.hasPartnerOut || week.hasWaiver || week.hasPartnerIn || week.hasDeposit ? '\nTransações:' : '') +
                  (week.hasPartnerOut ? '\n• ⚠️ Débito de Parceria (partner_out)' : '') +
                  (week.hasWaiver ? '\n• 🛡️ Justificativa (waiver)' : '') +
                  (week.hasPartnerIn ? '\n• 🔄 Crédito de Parceria (partner_in)' : '') +
                  (week.hasDeposit ? '\n• 💰 Aporte de Capital (deposit)' : '');

                return (
                  <button
                    key={week.mondayKey}
                    onClick={() => onToggleWeek(week.mondayKey)}
                    className={`relative flex flex-col items-center justify-between p-2 rounded-lg border text-center transition-all duration-200 aspect-square sm:aspect-auto sm:h-16 select-none ${statusColor} ${selectStyle}`}
                    title={titleTooltip}
                  >
                    {/* Floating indicators in the top-right corner */}
                    {(week.hasPartnerOut || week.hasWaiver || week.hasPartnerIn || week.hasDeposit) && (
                      <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 pointer-events-none bg-slate-950/90 rounded px-1 py-0.5 text-[9px] leading-none border border-white/15 shadow-md z-10">
                        {week.hasPartnerOut && <span title="Débito de Parceria">⚠️</span>}
                        {week.hasWaiver && <span title="Justificativa">🛡️</span>}
                        {week.hasPartnerIn && <span title="Crédito de Parceria">🔄</span>}
                        {week.hasDeposit && <span title="Aporte de Capital">💰</span>}
                      </div>
                    )}

                    {/* Week label */}
                    <span className="text-[10px] font-bold opacity-85 uppercase tracking-wider">
                      {week.weekLabel}
                    </span>

                    {/* Date Span */}
                    <span className="text-[9px] font-medium opacity-60">
                      {fmtDate(week.monday)}
                    </span>
                  </button>
                );
              })}

              {/* Pad empty columns if less than 5 weeks to maintain perfect column layout */}
              {Array.from({ length: 5 - weeks.length }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="aspect-square sm:aspect-auto sm:h-16 rounded-lg bg-white/2 border border-dashed border-white/5 opacity-20 pointer-events-none"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
