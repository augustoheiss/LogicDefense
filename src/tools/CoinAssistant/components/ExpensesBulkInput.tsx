import { useState } from 'react';
import type { TableRow } from '../types';

/** Returns the first day of the current month as YYYY-MM-DD. */
function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Returns the last day of the current month as YYYY-MM-DD. */
function lastOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

interface ExpensesBulkInputProps {
  onAddRows: (rows: Omit<TableRow, 'id'>[]) => void;
}

interface StagedRow {
  value: number;
  description: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Bulk expense input component.
 *
 * Flow:
 *   1. User types comma-separated values in a textarea
 *   2. Clicks "Processar" → sends to POST /api/coin/bulk-input
 *   3. API returns parsed transaction objects
 *   4. User edits descriptions inline in the preview grid
 *   5. Clicks "Salvar Todos" → commits all rows via onAddRows
 */
export function ExpensesBulkInput({ onAddRows }: ExpensesBulkInputProps) {
  const [rawInput,    setRawInput]    = useState('');
  const [periodStart, setPeriodStart] = useState(firstOfMonth());
  const [periodEnd,   setPeriodEnd]   = useState(lastOfMonth());
  const [staged,      setStaged]      = useState<StagedRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleProcess() {
    if (!rawInput.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/coin/bulk-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rawInput.trim(), date: periodStart }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Erro ${res.status}`);
      }

      const data = await res.json();
      const rows: StagedRow[] = (data.transactions ?? []).map(
        (t: { value: number; description: string }) => ({
          value: t.value,
          description: t.description,
        }),
      );

      if (rows.length === 0) {
        setError('Nenhum valor válido encontrado.');
      } else {
        setStaged(rows);
      }
    } catch (err) {
      // Fallback: parse locally if API is unavailable
      console.warn('API indisponível, parsing local:', err);
      const parts = rawInput.split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const localRows: StagedRow[] = [];
      for (const part of parts) {
        const v = parseFloat(part);
        if (isFinite(v) && v > 0) {
          localRows.push({ value: Math.round(v * 100) / 100, description: 'Sem descrição' });
        }
      }
      if (localRows.length === 0) {
        setError('Nenhum valor numérico válido encontrado.');
      } else {
        setStaged(localRows);
        setError('⚠ API offline — parsing local utilizado.');
      }
    } finally {
      setLoading(false);
    }
  }

  function updateStagedDesc(index: number, desc: string) {
    setStaged((prev) =>
      prev.map((r, i) => (i === index ? { ...r, description: desc } : r)),
    );
  }

  function removeStagedRow(index: number) {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCommitAll() {
    if (staged.length === 0) return;
    const [effStart, effEnd] = [periodStart, periodEnd].sort(); // guard reversed dates
    const rows: Omit<TableRow, 'id'>[] = staged.map((r) => ({
      date:        effStart,
      periodStart: effStart,
      periodEnd:   effEnd,
      value:       r.value,
      description: r.description || 'Sem descrição',
      entryType:   'expense' as const,
    }));
    onAddRows(rows);
    setStaged([]);
    setRawInput('');
  }

  const total = staged.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="space-y-4">
      {/* ── Input area ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">⚡</span>
          <h4 className="text-sm font-semibold text-white/70">Entrada em Lote</h4>
        </div>
        <p className="text-xs text-white/30 leading-relaxed">
          Insira valores separados por vírgula. O sistema processará e criará entradas de gasto
          com "Sem descrição" — você poderá editar cada descrição antes de salvar.
        </p>

        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/40 uppercase tracking-wider">Período Início</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="bg-white/10 text-white text-sm rounded px-3 py-2 outline-none border border-white/10 focus:ring-1 focus:ring-rose-400 [color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/40 uppercase tracking-wider">Período Fim</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="bg-white/10 text-white text-sm rounded px-3 py-2 outline-none border border-white/10 focus:ring-1 focus:ring-rose-400 [color-scheme:dark]"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs text-white/40 uppercase tracking-wider">
              Valores (separados por vírgula)
            </label>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="45.50, 120, 33.90, 88, 15.00"
              rows={2}
              className="bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 focus:ring-1 focus:ring-rose-400 resize-none w-full font-mono"
            />
          </div>
          <button
            onClick={handleProcess}
            disabled={loading || !rawInput.trim()}
            className="px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 self-end"
          >
            {loading ? '...' : '⚡ Processar'}
          </button>
        </div>

        {error && (
          <p className="text-xs text-amber-400/80">{error}</p>
        )}
      </div>

      {/* ── Staged rows preview ── */}
      {staged.length > 0 && (
        <div className="bg-white/5 border border-rose-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
              <span>📝</span>
              {staged.length} {staged.length === 1 ? 'gasto' : 'gastos'} para salvar
            </h4>
            <span className="text-sm font-mono font-semibold text-rose-400">
              Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-center px-3 py-2 text-white/40 font-medium w-10">#</th>
                  <th className="text-right px-3 py-2 text-white/40 font-medium w-28">Valor</th>
                  <th className="text-left px-3 py-2 text-white/40 font-medium">Descrição</th>
                  <th className="w-10 px-2" />
                </tr>
              </thead>
              <tbody>
                {staged.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-white/5 hover:bg-white/5 ${
                      idx % 2 === 0 ? '' : 'bg-white/[0.02]'
                    }`}
                  >
                    <td className="text-center px-3 py-2 text-white/20 text-xs">{idx + 1}</td>
                    <td className="text-right px-3 py-2 font-mono font-medium text-rose-400">
                      R$ {row.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateStagedDesc(idx, e.target.value)}
                        placeholder="Descreva este gasto..."
                        className="bg-white/10 text-white text-sm rounded px-2 py-1 w-full outline-none border border-white/10 focus:ring-1 focus:ring-rose-400"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => removeStagedRow(idx)}
                        className="text-white/20 hover:text-red-400 transition-colors text-lg leading-none"
                        title="Remover"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleCommitAll}
              className="px-6 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm transition-colors shadow"
            >
              ✓ Salvar Todos ({staged.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
