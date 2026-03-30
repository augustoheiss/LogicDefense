import { useState } from 'react';
import type { TableRow } from '../types';

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
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);

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
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="text-left px-4 py-3 text-white/50 font-medium w-36">Data</th>
            <th className="text-right px-4 py-3 text-white/50 font-medium w-36">
              <span>Valor (R$)</span>
              <span className="ml-2 text-xs font-normal text-white/25 hidden sm:inline">
                <span className="text-emerald-400/60">● </span>≥ meta
                <span className="text-amber-400/60 ml-1.5">● </span>&lt; meta
                <span className="text-sky-400/60 ml-1.5">● </span>aporte
              </span>
            </th>
            <th className="text-left px-4 py-3 text-white/50 font-medium">Descrição</th>
            <th className="w-10 px-2" />
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, idx) => (
            <tr
              key={row.id}
              className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                idx % 2 === 0 ? '' : 'bg-white/[0.02]'
              }`}
            >
              {/* ── Date cell ── */}
              <td className="px-4 py-2">
                {editingCell?.rowId === row.id && editingCell.field === 'date' ? (
                  <input
                    type="date"
                    defaultValue={row.date}
                    autoFocus
                    className="bg-white/10 text-white text-sm rounded px-2 py-1 w-full outline-none focus:ring-1 focus:ring-[#a855f7]"
                    onBlur={(e) => {
                      onUpdateRow(row.id, { date: e.target.value });
                      setEditingCell(null);
                    }}
                    onKeyDown={(e) => e.key === 'Escape' && setEditingCell(null)}
                  />
                ) : (
                  <span
                    className="cursor-pointer text-white/80 hover:text-white"
                    onClick={() => setEditingCell({ rowId: row.id, field: 'date' })}
                    title="Clique para editar"
                  >
                    {formatDate(row.date)}
                  </span>
                )}
              </td>

              {/* ── Value cell ── */}
              <td className="px-4 py-2 text-right">
                {editingCell?.rowId === row.id && editingCell.field === 'value' ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={row.value}
                    autoFocus
                    className="bg-white/10 text-white text-sm rounded px-2 py-1 w-full text-right outline-none focus:ring-1 focus:ring-[#a855f7]"
                    onBlur={(e) => {
                      onUpdateRow(row.id, { value: parseFloat(e.target.value) || 0 });
                      setEditingCell(null);
                    }}
                    onKeyDown={(e) => e.key === 'Escape' && setEditingCell(null)}
                  />
                ) : (
                  <span
                    className={`cursor-pointer font-mono font-medium transition-colors ${
                      row.entryType === 'deposit'
                        ? 'text-sky-400 hover:text-sky-300'
                        : row.value === 0
                          ? 'text-white/30'
                          : row.value >= dailyGoal
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-amber-400 hover:text-amber-300'
                    }`}
                    onClick={() => setEditingCell({ rowId: row.id, field: 'value' })}
                    title={
                      row.entryType === 'deposit'
                        ? 'Aporte / Investimento'
                        : row.value === 0
                          ? 'Dia de descanso'
                          : row.value >= dailyGoal
                            ? `✓ Meta atingida (R$ ${dailyGoal})`
                            : `Abaixo da meta (R$ ${dailyGoal})`
                    }
                  >
                    {row.value === 0 ? '—' : formatCurrency(row.value)}
                  </span>
                )}
              </td>

              {/* ── Description cell ── */}
              <td className="px-4 py-2">
                {editingCell?.rowId === row.id && editingCell.field === 'desc' ? (
                  <input
                    type="text"
                    defaultValue={row.description ?? ''}
                    autoFocus
                    placeholder="Descrição..."
                    className="bg-white/10 text-white text-sm rounded px-2 py-1 w-full outline-none focus:ring-1 focus:ring-[#a855f7]"
                    onBlur={(e) => {
                      onUpdateRow(row.id, { description: e.target.value });
                      setEditingCell(null);
                    }}
                    onKeyDown={(e) => e.key === 'Escape' && setEditingCell(null)}
                  />
                ) : (
                  <span
                    className="cursor-pointer text-white/50 hover:text-white/80 italic flex items-center gap-1.5"
                    onClick={() => setEditingCell({ rowId: row.id, field: 'desc' })}
                    title="Clique para editar"
                  >
                    {row.entryType === 'deposit' && (
                      <span className="not-italic text-xs bg-sky-500/15 text-sky-400 border border-sky-500/25 px-1.5 py-0.5 rounded font-semibold">
                        Aporte
                      </span>
                    )}
                    {row.description || <span className="not-italic text-white/20">—</span>}
                  </span>
                )}
              </td>

              {/* ── Delete ── */}
              <td className="px-2 py-2 text-center">
                <button
                  onClick={() => onDeleteRow(row.id)}
                  className="text-white/20 hover:text-red-400 transition-colors text-lg leading-none"
                  title="Excluir linha"
                  aria-label="Excluir linha"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
