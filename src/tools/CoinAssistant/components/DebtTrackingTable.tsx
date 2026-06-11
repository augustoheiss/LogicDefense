/**
 * DebtTrackingTable — Weekly Saldo Inadimplente tracker.
 *
 * Renders every Mon–Sun week from the first recorded entry to the current week,
 * showing: Meta Semanal, Receita, Δ Semana, and Saldo Inadimplente Acumulado.
 *
 * The cumulative balance matches globalGoalBalance exactly (Option B — Balanço
 * Completo): surpluses generate credit that offsets past/future deficits.
 */

import { useMemo, useState } from 'react';
import type { TableRow, TableGoals } from '../types';
import { computeWeeklyDebtTimeline } from '../utils/computeWeeklyDebtTimeline';
import { formatCurrencyFull, formatBalanceShort } from '../utils/formatCurrency';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DebtTrackingTableProps {
  rows: TableRow[];
  goals: TableGoals;
  cutoffDate?: string;
  /** For cross-check: the globalGoalBalance from metrics engine */
  globalGoalBalance: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return formatCurrencyFull(v);
}

function fmtSigned(v: number): string {
  return formatBalanceShort(v);
}

const PAGE_SIZE = 25;

// ─── Component ────────────────────────────────────────────────────────────────

export function DebtTrackingTable({
  rows,
  goals,
  cutoffDate,
  globalGoalBalance,
}: DebtTrackingTableProps) {
  const [page, setPage] = useState(0);
  const [jumpToEnd, setJumpToEnd] = useState(true); // start at the end (most recent)

  // ── Compute the full timeline ─────────────────────────────────────────────
  const timeline = useMemo(
    () => computeWeeklyDebtTimeline(rows, goals, cutoffDate),
    [rows, goals, cutoffDate],
  );

  // ── Year filter pills (for quick navigation, not filtering) ───────────────
  const years = useMemo(() => {
    const yrs = new Set<number>();
    for (const entry of timeline) {
      yrs.add(parseInt(entry.mondayKey.slice(0, 4), 10));
    }
    return Array.from(yrs).sort();
  }, [timeline]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(timeline.length / PAGE_SIZE));

  // On first render, jump to the last page (most recent weeks)
  const effectivePage = useMemo(() => {
    if (jumpToEnd && timeline.length > 0) {
      return totalPages - 1;
    }
    return Math.min(page, totalPages - 1);
  }, [jumpToEnd, page, totalPages, timeline.length]);

  const pagedEntries = useMemo(() => {
    const start = effectivePage * PAGE_SIZE;
    return timeline.slice(start, start + PAGE_SIZE);
  }, [timeline, effectivePage]);

  function goToPage(p: number) {
    setJumpToEnd(false);
    setPage(Math.max(0, Math.min(totalPages - 1, p)));
  }

  function jumpToYear(year: number) {
    const idx = timeline.findIndex(
      (e) => parseInt(e.mondayKey.slice(0, 4), 10) === year,
    );
    if (idx >= 0) {
      setJumpToEnd(false);
      setPage(Math.floor(idx / PAGE_SIZE));
    }
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalRevenue = useMemo(
    () => timeline.reduce((s, e) => s + e.weeklyRevenue, 0),
    [timeline],
  );
  const totalGoal = useMemo(
    () => timeline.reduce((s, e) => s + e.weeklyGoal, 0),
    [timeline],
  );
  const finalBalance = timeline.length > 0
    ? timeline[timeline.length - 1].cumulativeBalance
    : 0;

  const isDebt = finalBalance < 0;
  const statusLabel = isDebt ? "INADIMPLENTE" : "SUPERÁVIT";

  // ── Cross-check indicator ─────────────────────────────────────────────────
  const crossCheckDiff = Math.abs(finalBalance - globalGoalBalance);
  const crossCheckOk = crossCheckDiff < 1; // tolerance: R$ 1

  if (timeline.length === 0) {
    return (
      <div className="text-center py-12 text-white/30 text-sm space-y-2">
        <p className="text-4xl opacity-20">📄</p>
        <p>Nenhum dado de receita registrado para gerar a tabela.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-base">⚖️</span>
            Demonstrativo de Saldo Acumulado
          </h3>
          <p className="text-xs text-white/30 mt-0.5">
            Balanço completo — semana a semana desde o início do registro
          </p>
        </div>

        {/* Cross-check badge */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              crossCheckOk
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
            title={
              crossCheckOk
                ? `Saldo final (${fmt(finalBalance)}) confere com globalGoalBalance (${fmt(globalGoalBalance)})`
                : `Divergência de ${fmt(crossCheckDiff)}: Tabela=${fmt(finalBalance)}, Métricas=${fmt(globalGoalBalance)}`
            }
          >
            <span>{crossCheckOk ? '✓' : '⚠'}</span>
            <span>
              {crossCheckOk ? 'Conferência OK' : 'Divergência detectada'}
            </span>
          </div>

          {/* Final balance pill */}
          <div
            className={`px-4 py-2 rounded-xl text-sm font-mono font-bold border ${
              !isDebt
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            {statusLabel}: {fmtSigned(finalBalance)}
          </div>
        </div>
      </div>

      {/* ── Year quick-nav pills ── */}
      {years.length > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/25 mr-1">Ir para:</span>
          {years.map((yr) => (
            <button
              key={yr}
              onClick={() => jumpToYear(yr)}
              className="px-2.5 py-1 text-xs font-semibold rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
            >
              {yr}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => {
              setJumpToEnd(true);
              setPage(totalPages - 1);
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded-md text-[#a855f7]/70 hover:text-[#a855f7] hover:bg-[#a855f7]/10 transition-all"
          >
            Semana Atual →
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm" id="debt-tracking-table">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-white/50 font-medium w-14">#</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Semana</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium w-28">
                Meta
              </th>
              <th className="text-right px-4 py-3 text-white/50 font-medium w-28">
                Receita
              </th>
              {/* Show waivers column only if any exist */}
              {timeline.some((e) => e.weeklyWaivers > 0) && (
                <th className="text-right px-4 py-3 text-white/50 font-medium w-24">
                  Waivers
                </th>
              )}
              {timeline.some((e) => e.weeklyPartnerNet !== 0) && (
                <th className="text-right px-4 py-3 text-white/50 font-medium w-24">
                  Parceria
                </th>
              )}
              <th className="text-right px-4 py-3 text-white/50 font-medium w-28">
                Δ Semana
              </th>
              <th className="text-right px-4 py-3 text-white/50 font-medium w-36">
                Saldo Acumulado
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedEntries.map((entry, idx) => {
              const globalIdx = effectivePage * PAGE_SIZE + idx;
              const isDebt = entry.cumulativeBalance < 0;
              const isDelta = entry.weekDelta < 0;
              const hasWaivers = timeline.some((e) => e.weeklyWaivers > 0);
              const hasPartner = timeline.some((e) => e.weeklyPartnerNet !== 0);

              return (
                <tr
                  key={entry.mondayKey}
                  className={`border-b border-white/5 transition-colors hover:bg-white/[0.04] ${
                    idx % 2 === 0 ? '' : 'bg-white/[0.015]'
                  }`}
                  style={{
                    animation: `fadeInRow 0.2s ease-out ${idx * 15}ms both`,
                  }}
                >
                  {/* Week index */}
                  <td className="px-4 py-2.5 text-white/20 text-xs font-mono">
                    {globalIdx + 1}
                  </td>

                  {/* Week label */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-white/70 font-medium text-xs">
                        {entry.weekLabel}
                      </span>
                      <span className="text-[10px] text-white/20 font-mono">
                        S{entry.weekNumber}
                      </span>
                    </div>
                  </td>

                  {/* Meta */}
                  <td className="text-right px-4 py-2.5 font-mono text-white/40 text-xs">
                    {fmt(entry.weeklyGoal)}
                  </td>

                  {/* Revenue */}
                  <td className="text-right px-4 py-2.5 font-mono text-white/70 text-xs">
                    {entry.weeklyRevenue > 0 ? fmt(entry.weeklyRevenue) : (
                      <span className="text-white/15">—</span>
                    )}
                  </td>

                  {/* Waivers (conditional) */}
                  {hasWaivers && (
                    <td className="text-right px-4 py-2.5 font-mono text-amber-400/70 text-xs">
                      {entry.weeklyWaivers > 0 ? (
                        <>+{fmt(entry.weeklyWaivers)}</>
                      ) : (
                        <span className="text-white/10">—</span>
                      )}
                    </td>
                  )}

                  {/* Partner net (conditional) */}
                  {hasPartner && (
                    <td className={`text-right px-4 py-2.5 font-mono text-xs ${
                      entry.weeklyPartnerNet > 0
                        ? 'text-indigo-400/70'
                        : entry.weeklyPartnerNet < 0
                          ? 'text-amber-400/70'
                          : 'text-white/10'
                    }`}>
                      {entry.weeklyPartnerNet !== 0
                        ? fmtSigned(entry.weeklyPartnerNet)
                        : '—'}
                    </td>
                  )}

                  {/* Delta */}
                  <td className={`text-right px-4 py-2.5 font-mono font-semibold text-xs ${
                    isDelta ? 'text-red-400' : entry.weekDelta > 0 ? 'text-emerald-400' : 'text-white/30'
                  }`}>
                    {entry.weekDelta !== 0 ? fmtSigned(entry.weekDelta) : '—'}
                  </td>

                  {/* Cumulative balance */}
                  <td className={`text-right px-4 py-2.5 font-mono font-bold text-xs ${
                    isDebt ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    <div className="flex items-center justify-end gap-2">
                      {/* Mini progress bar */}
                      <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden hidden sm:block">
                        {(() => {
                          // Normalize against max absolute balance in visible page
                          const maxAbs = Math.max(
                            1,
                            ...pagedEntries.map((e) => Math.abs(e.cumulativeBalance)),
                          );
                          const pct = Math.min(100, (Math.abs(entry.cumulativeBalance) / maxAbs) * 100);
                          return (
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isDebt ? 'bg-red-400/60' : 'bg-emerald-400/60'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          );
                        })()}
                      </div>
                      <span>{fmtSigned(entry.cumulativeBalance)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* ── Footer summary ── */}
          <tfoot>
            <tr className="border-t-2 border-white/15 bg-white/[0.04]">
              <td className="px-4 py-3 text-xs text-white/40 font-bold uppercase tracking-wider" colSpan={2}>
                Resumo ({timeline.length} {timeline.length === 1 ? 'semana' : 'semanas'})
              </td>
              <td className="text-right px-4 py-3 font-mono text-white/50 text-xs font-semibold">
                {fmt(totalGoal)}
              </td>
              <td className="text-right px-4 py-3 font-mono text-white/70 text-xs font-semibold">
                {fmt(totalRevenue)}
              </td>
              {timeline.some((e) => e.weeklyWaivers > 0) && (
                <td className="text-right px-4 py-3 font-mono text-amber-400/70 text-xs font-semibold">
                  +{fmt(timeline.reduce((s, e) => s + e.weeklyWaivers, 0))}
                </td>
              )}
              {timeline.some((e) => e.weeklyPartnerNet !== 0) && (
                <td className="text-right px-4 py-3 font-mono text-white/50 text-xs font-semibold">
                  {fmtSigned(timeline.reduce((s, e) => s + e.weeklyPartnerNet, 0))}
                </td>
              )}
              <td className={`text-right px-4 py-3 font-mono font-bold text-xs ${
                totalRevenue - totalGoal >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {fmtSigned(totalRevenue - totalGoal)}
              </td>
              <td className={`text-right px-4 py-3 font-mono font-bold text-sm ${
                finalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {fmtSigned(finalBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/25">
            Exibindo semanas {effectivePage * PAGE_SIZE + 1}–
            {Math.min((effectivePage + 1) * PAGE_SIZE, timeline.length)} de{' '}
            {timeline.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(0)}
              disabled={effectivePage === 0}
              className="px-2.5 py-1.5 rounded-md bg-white/5 text-white/40 hover:text-white text-xs disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              ⟨⟨
            </button>
            <button
              onClick={() => goToPage(effectivePage - 1)}
              disabled={effectivePage === 0}
              className="px-3 py-1.5 rounded-md bg-white/5 text-white/40 hover:text-white text-xs disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              ‹ Anterior
            </button>
            <span className="text-xs text-white/30 px-2">
              {effectivePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => goToPage(effectivePage + 1)}
              disabled={effectivePage >= totalPages - 1}
              className="px-3 py-1.5 rounded-md bg-white/5 text-white/40 hover:text-white text-xs disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              Próximo ›
            </button>
            <button
              onClick={() => goToPage(totalPages - 1)}
              disabled={effectivePage >= totalPages - 1}
              className="px-2.5 py-1.5 rounded-md bg-white/5 text-white/40 hover:text-white text-xs disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              ⟩⟩
            </button>
          </div>
        </div>
      )}

      {/* ── Inline CSS for row animation ── */}
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}
