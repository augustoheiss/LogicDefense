import { useState, useMemo } from 'react';
import type { CoinTable, TableRow } from '../types';
import {
  toLocalKey,
  fmtDate,
  getWeeklyGoalForDate,
} from '../utils/dateUtils';

interface WeeklyAuditDrawerProps {
  selectedWeeks: string[];
  table: CoinTable;
  rows: TableRow[];
  onClearSelection: () => void;
  globalSystemBalance: number;
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

export function WeeklyAuditDrawer({
  selectedWeeks,
  table,
  rows,
  onClearSelection,
  globalSystemBalance,
}: WeeklyAuditDrawerProps) {
  const [copied, setCopied] = useState(false);

  const selectedWeeksData = useMemo(() => {
    return selectedWeeks
      .map((mondayKey) => {
        const [y, m, d] = mondayKey.split('-').map(Number);
        const monday = new Date(y, m - 1, d);
        const sunday = new Date(y, m - 1, d + 6);
        const sundayKey = toLocalKey(sunday);

        // Filter week entries: map and filter based on positive allocated contribution
        const weekEntries = rows
          .map((r) => {
            const allocatedValue = calculateRowContributionForWeek(r, monday, sunday);
            return {
              row: r,
              allocatedValue,
            };
          })
          .filter((item) => item.allocatedValue > 0)
          .sort((a, b) => a.row.date.localeCompare(b.row.date));

        // Revenue rows: operational revenue only (>0, excluding deposit, waiver, expense, partner_in, partner_out)
        const revenueRows = weekEntries.filter(
          (item) =>
            item.row.entryType !== 'deposit' &&
            item.row.entryType !== 'waiver' &&
            item.row.entryType !== 'expense' &&
            item.row.entryType !== 'partner_in' &&
            item.row.entryType !== 'partner_out' &&
            item.allocatedValue > 0
        );

        const weeklyRevenue = revenueRows.reduce((sum, item) => sum + item.allocatedValue, 0);
        const weeklyGoal = getWeeklyGoalForDate(sundayKey, table.goals);

        const weekWaivers = weekEntries
          .filter((item) => item.row.entryType === 'waiver')
          .reduce((sum, item) => sum + item.allocatedValue, 0);

        const weekPartnerIn = weekEntries
          .filter((item) => item.row.entryType === 'partner_in')
          .reduce((sum, item) => sum + item.allocatedValue, 0);

        const weekPartnerOut = weekEntries
          .filter((item) => item.row.entryType === 'partner_out')
          .reduce((sum, item) => sum + item.allocatedValue, 0);

        const rawDelta = (weeklyRevenue - weeklyGoal) + weekWaivers + (weekPartnerIn - weekPartnerOut);
        const weeklyDelta = isFinite(rawDelta) ? rawDelta : 0;
        const dailyAverage = isFinite(weeklyRevenue / 7) ? weeklyRevenue / 7 : 0;

        // Defensive checks for min/max to avoid Infinity/-Infinity on empty weeks
        const revenues = revenueRows.map((item) => item.allocatedValue);
        const minRevenue = revenues.length > 0 ? Math.min(...revenues) : 0;
        const maxRevenue = revenues.length > 0 ? Math.max(...revenues) : 0;

        // Count how many Sundays occurred in this month up to and including this Sunday to get the correct S1-S5 index
        const sundayDate = sunday.getDate();
        let sundayCount = 0;
        for (let tempD = 1; tempD <= sundayDate; tempD++) {
          const tempDate = new Date(y, m - 1, tempD);
          if (tempDate.getDay() === 0) {
            sundayCount++;
          }
        }
        const weekLabel = `S${sundayCount}`;

        return {
          mondayKey,
          monday,
          sunday,
          weekLabel,
          weekEntries,
          revenueRows,
          weeklyRevenue,
          weeklyGoal,
          weeklyDelta,
          dailyAverage,
          minRevenue,
          maxRevenue,
        };
      })
      .sort((a, b) => a.mondayKey.localeCompare(b.mondayKey)); // Chronological sorting
  }, [selectedWeeks, rows, table.goals]);

  // Overall consolidated delta
  const totalDelta = useMemo(() => {
    return selectedWeeksData.reduce((sum, w) => sum + w.weeklyDelta, 0);
  }, [selectedWeeksData]);

  if (selectedWeeks.length === 0) return null;



  const handleCopyDossier = () => {
    const lines: string[] = [
      '*📊 DOSSIÊ DE AUDITORIA OPERACIONAL - ASSISTENTE MOEDA*',
      ''
    ];

    selectedWeeksData.forEach((week) => {
      lines.push(
        `🗓️ *Semana: ${fmtDate(week.monday)} a ${fmtDate(week.sunday)}*`,
        `• Meta Estabelecida: ${fmt(week.weeklyGoal)}`,
        `• Faturamento Real: ${fmt(week.weeklyRevenue)}`,
        `• Média Diária: ${fmt(week.dailyAverage)} (Inconstância: Min ${fmt(week.minRevenue)} / Max ${fmt(week.maxRevenue)})`
      );

      // Check if week contains partner debits or waivers to list them in the dossier
      const debits = week.weekEntries.filter((item) => item.row.entryType === 'partner_out');
      const waivers = week.weekEntries.filter((item) => item.row.entryType === 'waiver');

      debits.forEach((item) => {
        lines.push(`⚠️ Débito: ${fmt(item.allocatedValue)} - ${item.row.description || 'Sem descrição'}`);
      });
      waivers.forEach((item) => {
        lines.push(`🛡️ Justificativa (Waiver): ${item.row.description || 'Sem descrição'}`);
      });

      const deltaPrefix = week.weeklyDelta >= 0 ? '+' : '';
      lines.push(
        `⚖️ *Saldo da Semana:* ${deltaPrefix}${fmt(week.weeklyDelta)}`,
        '---'
      );
    });

    const sumPrefix = totalDelta >= 0 ? '+' : '';
    const globalPrefix = globalSystemBalance >= 0 ? '+' : '';
    lines.push(
      '',
      '*📉 CONCLUSÃO DO BALANÇO CONSOLIDADO*',
      `• Semanas Auditadas: ${selectedWeeks.length}`,
      `• Impacto destas semanas: ${sumPrefix}${fmt(totalDelta)}`,
      `• 🏦 *SALDO GERAL DO SISTEMA:* ${globalPrefix}${fmt(globalSystemBalance)}`,
      `_(O Saldo Geral já inclui todos os seus superávits, justificativas e histórico total operado)_`,
      '',
      '_Código Licenciado sob Termos de Uso Aberto e Colaborativo._'
    );

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur border border-indigo-500/15 p-5 md:p-6 rounded-xl shadow-2xl mt-4 mb-4 flex flex-col gap-6">
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Painel de Acareação
          </span>
          <h3 className="text-lg font-bold text-white font-outfit mt-1">
            Impacto da Seleção:{' '}
            <span className={totalDelta < 0 ? 'text-red-400' : 'text-emerald-400'}>
              {totalDelta >= 0 ? '+' : ''}
              {fmt(totalDelta)}
            </span>{' '}
            <span className="text-white/30 font-normal">|</span>{' '}
            Saldo Geral Atual:{' '}
            <span className={globalSystemBalance < 0 ? 'text-red-400' : 'text-emerald-400'}>
              {globalSystemBalance >= 0 ? '+' : ''}
              {fmt(globalSystemBalance)}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyDossier}
            className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all duration-200 flex items-center gap-1.5 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
            }`}
          >
            <span>{copied ? '✓ Copiado!' : '🚀 Exportar Dossiê para WhatsApp'}</span>
          </button>

          <button
            onClick={onClearSelection}
            className="px-3.5 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95"
          >
            Limpar Seleção
          </button>
        </div>
      </div>

      {/* Grid of Week Audit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {selectedWeeksData.map((week) => {
          const deltaIsNegative = week.weeklyDelta < 0;
          const deltaColor = deltaIsNegative ? 'text-red-400' : 'text-emerald-400';
          const deltaBg = deltaIsNegative ? 'bg-red-500/10' : 'bg-emerald-500/10';

          return (
            <div
              key={week.mondayKey}
              className="bg-slate-950/60 border border-white/5 rounded-xl p-4 flex flex-col justify-between gap-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Semana {week.weekLabel.slice(1)}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {fmtDate(week.monday)} a {fmtDate(week.sunday)}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${deltaBg} ${deltaColor}`}>
                  {week.weeklyDelta >= 0 ? '+' : ''}
                  {fmt(week.weeklyDelta)}
                </span>
              </div>

              {/* Indicators Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">Meta Semanal</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{fmt(week.weeklyGoal)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">Faturamento Real</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{fmt(week.weeklyRevenue)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">Média Diária</span>
                  <p className="font-semibold text-slate-300 mt-0.5">{fmt(week.dailyAverage)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">Inconstância</span>
                  <p className="font-semibold text-slate-300 mt-0.5">
                    Min {fmt(week.minRevenue)} / Max {fmt(week.maxRevenue)}
                  </p>
                </div>
              </div>

              {/* Transactions List */}
              <div className="border-t border-white/5 pt-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">
                  Transações da Semana
                </span>
                {week.weekEntries.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">Nenhuma transação registrada.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {week.weekEntries.map((item) => {
                      const { row, allocatedValue } = item;
                      const isPartnerOut = row.entryType === 'partner_out';
                      const isWaiver = row.entryType === 'waiver';
                      const isPartnerIn = row.entryType === 'partner_in';
                      const isDeposit = row.entryType === 'deposit';

                      return (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-2 text-[10px] bg-slate-900/50 p-1.5 rounded border border-white/5"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-slate-500 font-mono shrink-0">{fmtDate(new Date(row.date + 'T12:00:00'))}</span>
                            <span className="text-slate-300 truncate" title={row.description}>
                              {row.description || 'Sem descrição'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isPartnerOut && (
                              <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                Débito
                              </span>
                            )}
                            {isWaiver && (
                              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                Waiver
                              </span>
                            )}
                            {isPartnerIn && (
                              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                Crédito
                              </span>
                            )}
                            {isDeposit && (
                              <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                                Aporte
                              </span>
                            )}
                            <span className="font-mono font-semibold text-slate-200">
                              {fmt(allocatedValue)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
