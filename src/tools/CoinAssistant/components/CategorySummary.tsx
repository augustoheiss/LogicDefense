import { useState, useMemo } from 'react';
import type { TableRow } from '../types';
import { formatCurrencyFull, formatCurrencyShort } from '../utils/formatCurrency';
import { EditRowModal } from './EditRowModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterableType = 'revenue' | 'expense' | 'deposit' | 'partner_in' | 'partner_out' | 'waiver';

interface CategoryGroup {
  description: string;
  count: number;
  total: number;
  mean: number;
  max: number;
  min: number;
  median: number;
  stdDev: number;
  dailyAvg: number;
  weeklyAvg: number;
  pct: number; // percentage of grand total
  rows: TableRow[];
}

const PAGE_SIZE = 20;

// ── Filter config ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: FilterableType; label: string; icon: string; color: string; textColor: string }[] = [
  { value: 'revenue',     label: 'Recebimentos',     icon: '📥', color: 'bg-purple-500',  textColor: 'text-purple-400' },
  { value: 'expense',     label: 'Custos',            icon: '🏷️', color: 'bg-rose-500',    textColor: 'text-rose-400'   },
  { value: 'deposit',     label: 'Aportes',           icon: '💰', color: 'bg-sky-500',     textColor: 'text-sky-400'    },
  { value: 'waiver',      label: 'Justificativas',    icon: '🛡️', color: 'bg-amber-500',   textColor: 'text-amber-400'  },
  { value: 'partner_in',  label: 'Créd. Parceria',    icon: '🤝', color: 'bg-indigo-500',  textColor: 'text-indigo-400' },
  { value: 'partner_out', label: 'Déb. Parceria',     icon: '📤', color: 'bg-amber-500',   textColor: 'text-amber-400'  },
];

// ── Math helpers ──────────────────────────────────────────────────────────────

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T12:00:00').getTime();
  const msB = new Date(b + 'T12:00:00').getTime();
  return Math.max(1, Math.round(Math.abs(msB - msA) / 86_400_000) + 1);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CategorySummaryProps {
  rows: TableRow[];
  dailyGoal?: number;
  onUpdateRow?: (rowId: string, patch: Partial<TableRow>) => void;
  onDeleteRow?: (rowId: string) => void;
}

export function CategorySummary({ rows, dailyGoal = 0, onUpdateRow, onDeleteRow }: CategorySummaryProps) {
  const [filterType, setFilterType] = useState<FilterableType>('expense');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);

  const filterOpt = FILTER_OPTIONS.find((o) => o.value === filterType)!;

  // Count how many entries exist per type (for badge counts)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opt of FILTER_OPTIONS) {
      counts[opt.value] = rows.filter((r) =>
        (r.entryType || 'revenue') === opt.value,
      ).length;
    }
    return counts;
  }, [rows]);

  // Global time span (Option A — for daily/weekly averages)
  const globalDaySpan = useMemo(() => {
    const dates = rows.map((r) => r.date).filter(Boolean).sort();
    if (dates.length < 2) return 1;
    return daysBetween(dates[0], dates[dates.length - 1]);
  }, [rows]);

  // Category groups for the selected type
  const groups: CategoryGroup[] = useMemo(() => {
    const typeRows = rows.filter((r) => (r.entryType || 'revenue') === filterType);
    if (typeRows.length === 0) return [];

    const map = new Map<string, TableRow[]>();
    for (const row of typeRows) {
      const key = (row.description ?? 'Sem descrição').trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }

    const grandTotal = typeRows.reduce((s, r) => s + r.value, 0);

    return Array.from(map.entries())
      .map(([key, catRows]) => {
        const values = catRows.map((r) => r.value);
        const total = values.reduce((s, v) => s + v, 0);
        const mean = values.length > 0 ? total / values.length : 0;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const median = computeMedian(values);
        const stdDev = computeStdDev(values, mean);
        const dailyAvg = globalDaySpan > 0 ? total / globalDaySpan : 0;
        const weeklyAvg = dailyAvg * 7;
        const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;

        return {
          description: key.charAt(0).toUpperCase() + key.slice(1),
          count: catRows.length,
          total: Math.round(total * 100) / 100,
          mean: Math.round(mean * 100) / 100,
          max: Math.round(max * 100) / 100,
          min: Math.round(min * 100) / 100,
          median: Math.round(median * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          dailyAvg: Math.round(dailyAvg * 100) / 100,
          weeklyAvg: Math.round(weeklyAvg * 100) / 100,
          pct: Math.round(pct * 10) / 10,
          rows: catRows.sort((a, b) => b.date.localeCompare(a.date)),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rows, filterType, globalDaySpan]);

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const grandCount = groups.reduce((s, g) => s + g.count, 0);

  // Drill-down pagination for the expanded group
  const expandedGroup = expandedCategory
    ? groups.find((g) => g.description === expandedCategory)
    : null;
  const totalPages = expandedGroup ? Math.ceil(expandedGroup.rows.length / PAGE_SIZE) : 0;
  const pagedRows = expandedGroup
    ? expandedGroup.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : [];

  function handleExpand(desc: string) {
    if (expandedCategory === desc) {
      setExpandedCategory(null);
      setPage(0);
    } else {
      setExpandedCategory(desc);
      setPage(0);
    }
  }

  // Check if there's any data at all
  const hasAnyData = FILTER_OPTIONS.some((o) => typeCounts[o.value] > 0);
  if (!hasAnyData) return null;

  // Total columns: Categoria, Qtd, Total, Média, Max, Min, Mediana, DP, Diária, Semanal, %
  const totalCols = 11;

  return (
    <div className="space-y-3">
      {/* ── Section header with type filter ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-white/70 flex items-center gap-2">
          <span className="text-base">📊</span>
          {filterOpt.icon} {filterOpt.label} por Categoria
        </h4>
        <span className="text-xs text-white/30">
          {grandCount} {grandCount === 1 ? 'entrada' : 'entradas'} · {groups.length}{' '}
          {groups.length === 1 ? 'categoria' : 'categorias'}
        </span>
      </div>

      {/* ── Type filter pills ── */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((opt) => {
          const count = typeCounts[opt.value];
          const active = filterType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => {
                setFilterType(opt.value);
                setExpandedCategory(null);
                setPage(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                active
                  ? `${opt.color} text-white shadow`
                  : 'bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/10'
              }`}
            >
              {opt.icon} {opt.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-white/20' : 'bg-white/10'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Category table ── */}
      {groups.length === 0 ? (
        <div className="text-center py-6 text-white/30 text-sm space-y-1">
          <p className="text-3xl opacity-20">📊</p>
          <p>Nenhum registro de <span className="lowercase">{filterOpt.label}</span> encontrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-3 py-2.5 text-white/50 font-medium">Categoria</th>
                <th className="text-center px-2 py-2.5 text-white/50 font-medium w-12">Qtd</th>
                <th className="text-right px-3 py-2.5 text-white/50 font-medium w-28">Total</th>
                <th className="text-right px-3 py-2.5 text-white/50 font-medium w-24">Média</th>
                <th className="text-right px-3 py-2.5 text-white/50 font-medium w-20">Max</th>
                <th className="text-right px-3 py-2.5 text-white/50 font-medium w-20">Min</th>
                <th className="text-right px-3 py-2.5 text-white/50 font-medium w-20">Mediana</th>
                <th className="text-right px-3 py-2.5 text-white/50 font-medium w-20">DP</th>
                <th className="text-right px-3 py-2.5 text-white/50 font-medium w-24">Diária</th>
                <th className="text-right px-3 py-2.5 text-white/50 font-medium w-24">Semanal</th>
                <th className="text-right px-2 py-2.5 text-white/50 font-medium w-14">%</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isExpanded = expandedCategory === g.description;
                return (
                  <>
                    {/* ── Category summary row ── */}
                    <tr
                      key={g.description}
                      onClick={() => handleExpand(g.description)}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-white/5' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${isExpanded ? 'rotate-90' : ''} transition-transform text-white/25`}>▶</span>
                          <span className="text-white/80 font-medium">{g.description}</span>
                        </div>
                      </td>
                      <td className="text-center px-2 py-2 text-white/50">{g.count}</td>
                      <td className={`text-right px-3 py-2 font-mono font-semibold ${filterOpt.textColor}`}>
                        {formatCurrencyShort(g.total)}
                      </td>
                      <td className="text-right px-3 py-2 font-mono text-white/50">{formatCurrencyShort(g.mean)}</td>
                      <td className="text-right px-3 py-2 font-mono text-white/40">{formatCurrencyShort(g.max)}</td>
                      <td className="text-right px-3 py-2 font-mono text-white/40">{formatCurrencyShort(g.min)}</td>
                      <td className="text-right px-3 py-2 font-mono text-white/40">{formatCurrencyShort(g.median)}</td>
                      <td className="text-right px-3 py-2 font-mono text-white/30">{formatCurrencyShort(g.stdDev)}</td>
                      <td className="text-right px-3 py-2 font-mono text-white/40">{formatCurrencyShort(g.dailyAvg)}</td>
                      <td className="text-right px-3 py-2 font-mono text-white/40">{formatCurrencyShort(g.weeklyAvg)}</td>
                      <td className="text-right px-2 py-2 text-white/40 text-xs">{g.pct}%</td>
                    </tr>

                    {/* ── Inline accordion: drill-down rows ── */}
                    {isExpanded && (
                      <tr key={`${g.description}-expanded`}>
                        <td colSpan={totalCols} className="p-0">
                          <div className="bg-white/[0.02] border-y border-white/5">
                            {/* Drill-down header + pagination */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                              <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                                {g.description} — {g.count} registros
                              </span>
                              {totalPages > 1 && (
                                <div className="flex items-center gap-2 text-xs">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setPage(Math.max(0, page - 1)); }}
                                    disabled={page === 0}
                                    className="px-2.5 py-1 rounded bg-white/5 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                  >
                                    ‹ Anterior
                                  </button>
                                  <span className="text-white/30">
                                    {page + 1} / {totalPages}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setPage(Math.min(totalPages - 1, page + 1)); }}
                                    disabled={page >= totalPages - 1}
                                    className="px-2.5 py-1 rounded bg-white/5 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                  >
                                    Próximo ›
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Individual records — fully editable */}
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-white/[0.03]">
                                  <th className="text-left px-4 py-1.5 text-white/30 font-medium w-28">Data</th>
                                  <th className="text-right px-3 py-1.5 text-white/30 font-medium w-28">Valor</th>
                                  <th className="text-left px-3 py-1.5 text-white/30 font-medium">Descrição</th>
                                  <th className="w-24 px-2 py-1.5 text-white/30 font-medium text-center">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pagedRows.map((row, idx) => (
                                  <tr
                                    key={row.id ?? idx}
                                    className={`border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.04] transition-colors ${idx % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
                                    onClick={() => row.id && setEditingRow(row)}
                                    title="Clique para editar"
                                  >
                                    <td className="px-4 py-2 text-white/50">
                                      {row.date.split('-').reverse().join('/')}
                                    </td>
                                    <td className={`text-right px-3 py-2 font-mono ${filterOpt.textColor}`}>
                                      {formatCurrencyFull(row.value)}
                                    </td>
                                    <td className="px-3 py-2 text-white/40">
                                      {row.description || '—'}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        {onUpdateRow && row.id && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setEditingRow(row); }}
                                            className="p-1.5 rounded-md bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                            title="Editar registro"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                          </button>
                                        )}
                                        {onDeleteRow && row.id && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteRow(row.id!); }}
                                            className="p-1.5 rounded-md bg-red-500/10 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                                            title="Excluir registro"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <polyline points="3 6 5 6 21 6" />
                                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                              <line x1="10" y1="11" x2="10" y2="17" />
                                              <line x1="14" y1="11" x2="14" y2="17" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/15 bg-white/5">
                <td className="px-3 py-2.5 font-semibold text-white/60 uppercase text-xs tracking-wider">
                  Total Geral
                </td>
                <td className="text-center px-2 py-2.5 font-semibold text-white/60">{grandCount}</td>
                <td className={`text-right px-3 py-2.5 font-mono font-bold text-base ${filterOpt.textColor}`}>
                  {formatCurrencyFull(grandTotal)}
                </td>
                <td className="text-right px-3 py-2.5 font-mono text-white/40">
                  {formatCurrencyShort(grandCount > 0 ? grandTotal / grandCount : 0)}
                </td>
                <td colSpan={6} />
                <td className="text-right px-2 py-2.5 text-white/40 text-xs">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {/* ── Edit modal (shared with SpreadsheetGrid) ── */}
      {editingRow && onUpdateRow && (
        <EditRowModal
          row={editingRow}
          dailyGoal={dailyGoal}
          onSave={(patch) => {
            onUpdateRow(editingRow.id, patch);
            setEditingRow(null);
          }}
          onClose={() => setEditingRow(null)}
        />
      )}
    </div>
  );
}
