import { useMemo } from 'react';
import type { TableRow } from '../types';
import { formatCurrencyFull } from '../utils/formatCurrency';

interface ExpensesSummaryProps {
  rows: TableRow[];
}

interface GroupedExpense {
  description: string;
  count: number;
  total: number;
  avg: number;
}

/**
 * GroupBy description report for expense rows.
 *
 * Groups all entryType === 'expense' rows by description (case-insensitive, trimmed),
 * shows: Descrição | Nº Entradas | Total | Média.
 * Sorted by total descending.
 */
export function ExpensesSummary({ rows }: ExpensesSummaryProps) {
  const groups: GroupedExpense[] = useMemo(() => {
    const expenseRows = rows.filter((r) => r.entryType === 'expense');
    if (expenseRows.length === 0) return [];

    const map = new Map<string, { count: number; total: number }>();

    for (const row of expenseRows) {
      const key = (row.description ?? 'Sem descrição').trim().toLowerCase();
      const existing = map.get(key) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += row.value;
      map.set(key, existing);
    }

    return Array.from(map.entries())
      .map(([key, data]) => ({
        description: key.charAt(0).toUpperCase() + key.slice(1), // Capitalise
        count: data.count,
        total: Math.round(data.total * 100) / 100,
        avg: Math.round((data.total / data.count) * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  if (groups.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-sm space-y-1">
        <p className="text-3xl opacity-20">📊</p>
        <p>Nenhum gasto registrado ainda.</p>
        <p className="text-xs text-white/20">
          Use a "Entrada em Lote" acima ou adicione gastos na Planilha.
        </p>
      </div>
    );
  }

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const grandCount = groups.reduce((s, g) => s + g.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white/70 flex items-center gap-2">
          <span className="text-base">📊</span>
          Gastos por Categoria
        </h4>
        <span className="text-xs text-white/30">
          {grandCount} {grandCount === 1 ? 'entrada' : 'entradas'} · {groups.length}{' '}
          {groups.length === 1 ? 'categoria' : 'categorias'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-white/50 font-medium">Descrição</th>
              <th className="text-center px-4 py-3 text-white/50 font-medium w-20">Qtd</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium w-36">Total</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium w-36">Média</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium w-20">%</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const pct = grandTotal > 0 ? ((g.total / grandTotal) * 100).toFixed(1) : '0.0';
              return (
                <tr
                  key={g.description}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-rose-500/15 text-rose-400 border border-rose-500/25 px-1.5 py-0.5 rounded font-semibold">
                        🏷️
                      </span>
                      <span className="text-white/80 font-medium">{g.description}</span>
                    </div>
                  </td>
                  <td className="text-center px-4 py-2.5 text-white/50">{g.count}</td>
                  <td className="text-right px-4 py-2.5 font-mono font-semibold text-rose-400">
                    {formatCurrencyFull(g.total)}
                  </td>
                  <td className="text-right px-4 py-2.5 font-mono text-white/50">
                    {formatCurrencyFull(g.avg)}
                  </td>
                  <td className="text-right px-4 py-2.5 text-white/40 text-xs">
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/15 bg-white/5">
              <td className="px-4 py-3 font-semibold text-white/60 uppercase text-xs tracking-wider">
                Total Geral
              </td>
              <td className="text-center px-4 py-3 font-semibold text-white/60">{grandCount}</td>
              <td className="text-right px-4 py-3 font-mono font-bold text-rose-400 text-base">
                {formatCurrencyFull(grandTotal)}
              </td>
              <td className="text-right px-4 py-3 font-mono text-white/40">
                {formatCurrencyFull(grandCount > 0 ? grandTotal / grandCount : 0)}
              </td>
              <td className="text-right px-4 py-3 text-white/40 text-xs">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
