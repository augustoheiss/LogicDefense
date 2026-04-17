import { useState } from 'react';
import type { TableRow } from '../types';
import { EditRowModal } from './EditRowModal';

interface SpreadsheetGridProps {
  rows: TableRow[];
  dailyGoal: number;
  /** "YYYY-MM" — only rows in this month are rendered. */
  selectedMonth: string;
  onUpdateRow: (rowId: string, patch: Partial<Omit<TableRow, 'id'>>) => void;
  onDeleteRow: (rowId: string) => void;
}

export function SpreadsheetGrid({
  rows,
  dailyGoal,
  selectedMonth,
  onUpdateRow,
  onDeleteRow,
}: SpreadsheetGridProps) {
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);

  // Show only rows belonging to the selected month
  const visibleRows = rows.filter((r) => r.date.startsWith(selectedMonth + '-'));
  const hiddenCount = rows.length - visibleRows.length;

  function formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function handleSave(rowId: string, patch: Partial<Omit<TableRow, 'id'>>) {
    onUpdateRow(rowId, patch);
    setEditingRow(null);
  }

  // ── Period badge helper ───────────────────────────────────────────────────
  function isPeriodRow(row: TableRow): boolean {
    return !!(row.periodStart && row.periodEnd && row.periodStart !== row.periodEnd);
  }

  function periodDays(row: TableRow): number {
    if (!row.periodStart || !row.periodEnd) return 1;
    const msPerDay = 86_400_000;
    return (
      Math.max(
        1,
        Math.round(
          Math.abs(
            new Date(row.periodEnd   + 'T12:00:00').getTime() -
            new Date(row.periodStart + 'T12:00:00').getTime(),
          ) / msPerDay,
        ) + 1,
      )
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (visibleRows.length === 0) {
    return (
      <div className="text-center py-12 text-white/30 text-sm space-y-1">
        <p>Nenhuma entrada neste mês.</p>
        {hiddenCount > 0 && (
          <p className="text-xs text-white/20">
            {hiddenCount} {hiddenCount === 1 ? 'entrada' : 'entradas'} em outros meses.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* ── Edit modal ── */}
      {editingRow && (
        <EditRowModal
          row={editingRow}
          dailyGoal={dailyGoal}
          onSave={(patch) => handleSave(editingRow.id, patch)}
          onClose={() => setEditingRow(null)}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-white/50 font-medium w-44">Data</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium w-36">
                <span>Valor (R$)</span>
                <span className="ml-2 text-xs font-normal text-white/25 hidden sm:inline">
                  <span className="text-emerald-400/60">● </span>≥ meta
                  <span className="text-amber-400/60 ml-1.5">● </span>&lt; meta
                  <span className="text-sky-400/60 ml-1.5">● </span>aporte
                  <span className="text-orange-400/60 ml-1.5">● </span>justificado
                  <span className="text-rose-400/60 ml-1.5">● </span>custo
                </span>
              </th>
              <th className="text-left px-4 py-3 text-white/50 font-medium">Descrição</th>
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => {
              const isRated   = isPeriodRow(row);
              const spanDays  = isRated ? periodDays(row) : 0;
              const dailyRate = isRated ? row.value / spanDays : null;

              return (
                <tr
                  key={row.id}
                  className={`border-b border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer group ${
                    idx % 2 === 0 ? '' : 'bg-white/[0.02]'
                  }`}
                  onClick={() => setEditingRow(row)}
                  title="Clique para editar"
                >
                  {/* ── Date cell ── */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isRated ? (
                        <>
                          {/* Period badge */}
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded border text-purple-400 bg-purple-500/15 border-purple-500/30 shrink-0">
                            📆
                            <span className="hidden sm:inline">{spanDays}d</span>
                          </span>
                          <span className="text-white/60 text-xs font-mono">
                            {formatDate(row.periodStart!)}
                            <span className="text-white/25 mx-1">→</span>
                            {formatDate(row.periodEnd!)}
                          </span>
                        </>
                      ) : (
                        <span className="text-white/80 group-hover:text-white transition-colors">
                          {formatDate(row.date)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ── Value cell ── */}
                  <td className="px-4 py-2 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className={`font-mono font-medium transition-colors ${
                          row.entryType === 'waiver'
                            ? 'text-orange-400 group-hover:text-orange-300'
                            : row.entryType === 'deposit'
                              ? 'text-sky-400 group-hover:text-sky-300'
                              : row.entryType === 'expense'
                                ? 'text-rose-400 group-hover:text-rose-300'
                                : row.value === 0
                                  ? 'text-white/30'
                                  : row.value >= dailyGoal
                                    ? 'text-emerald-400 group-hover:text-emerald-300'
                                    : 'text-amber-400 group-hover:text-amber-300'
                        }`}
                        title={
                          row.entryType === 'waiver'
                            ? `🛡️ ${row.value} dia${row.value !== 1 ? 's' : ''} justificado${row.value !== 1 ? 's' : ''}`
                            : row.entryType === 'deposit'
                              ? 'Aporte / Investimento'
                              : row.entryType === 'expense'
                                ? `🏷️ Custo: ${formatCurrency(row.value)}`
                                : row.value === 0
                                  ? 'Dia de descanso'
                                  : row.value >= dailyGoal
                                    ? `✓ Meta atingida (R$ ${dailyGoal})`
                                    : `Abaixo da meta (R$ ${dailyGoal})`
                        }
                      >
                        {row.entryType === 'waiver'
                          ? `${row.value}d justif.`
                          : row.entryType === 'expense'
                            ? `-${formatCurrency(row.value)}`
                            : row.value === 0
                              ? '—'
                              : formatCurrency(row.value)}
                      </span>
                      {/* Daily rate sub-text for period rows */}
                      {dailyRate !== null && (
                        <span className="text-xs font-mono text-purple-400/60">
                          ≈ {formatCurrency(dailyRate)}/dia
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ── Description cell ── */}
                  <td className="px-4 py-2">
                    <span className="text-white/50 group-hover:text-white/80 italic flex items-center gap-1.5 flex-wrap transition-colors">
                      {row.entryType === 'waiver' && (
                        <span className="not-italic text-xs bg-orange-500/15 text-orange-400 border border-orange-500/25 px-1.5 py-0.5 rounded font-semibold">
                          🛡️ Justificado
                        </span>
                      )}
                      {row.entryType === 'deposit' && (
                        <span className="not-italic text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 px-1.5 py-0.5 rounded font-semibold">
                          Aporte
                        </span>
                      )}
                      {row.entryType === 'expense' && (
                        <span className="not-italic text-xs bg-rose-500/15 text-rose-400 border border-rose-500/25 px-1.5 py-0.5 rounded font-semibold">
                          🏷️ Custo
                        </span>
                      )}
                      {row.description || <span className="not-italic text-white/20">—</span>}
                      {row.entryType === 'expense' && row.monthlyValue != null && row.monthCount != null && (
                        <span className="not-italic text-xs text-rose-400/50 ml-1">
                          ({row.monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} × {row.monthCount}m)
                        </span>
                      )}
                    </span>
                  </td>

                  {/* ── Delete ── */}
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // don't open modal
                        onDeleteRow(row.id);
                      }}
                      className="text-white/20 hover:text-red-400 transition-colors text-lg leading-none"
                      title="Excluir linha"
                      aria-label="Excluir linha"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
