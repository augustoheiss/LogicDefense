import { useState, useEffect } from 'react';
import type { CoinTable, TableGoals } from '../types';

interface TableModalProps {
  mode: 'create' | 'edit';
  table?: CoinTable | null;
  onSave: (data: { name: string; description: string; goals: TableGoals }) => void;
  onClose: () => void;
}

const DEFAULT_GOALS: TableGoals = {
  dailyGoals:  { [new Date().getFullYear()]: 50 },
  weeklyGoals: { [new Date().getFullYear()]: 400 },
  annualCosts: { [new Date().getFullYear()]: 15000 },
};

type GoalRecord = 'dailyGoals' | 'weeklyGoals' | 'annualCosts';

export function TableModal({ mode, table, onSave, onClose }: TableModalProps) {
  const [name, setName] = useState(table?.name ?? '');
  const [description, setDescription] = useState(table?.description ?? '');
  const [goals, setGoals] = useState<TableGoals>(table?.goals ?? DEFAULT_GOALS);

  useEffect(() => {
    if (table) {
      setName(table.name);
      setDescription(table.description ?? '');
      setGoals(table.goals);
    }
  }, [table]);

  // Generalized handlers for any Record<number, number> goal field
  function setYearValue(record: GoalRecord, year: number, raw: string) {
    const v = parseFloat(raw);
    setGoals((prev) => ({
      ...prev,
      [record]: { ...prev[record], [year]: isNaN(v) ? 0 : v },
    }));
  }

  function addYear(record: GoalRecord) {
    const existing = Object.keys(goals[record]).map(Number);
    const next = existing.length > 0 ? Math.max(...existing) + 1 : new Date().getFullYear();
    setGoals((prev) => ({
      ...prev,
      [record]: { ...prev[record], [next]: 0 },
    }));
  }

  function removeYear(record: GoalRecord, year: number) {
    setGoals((prev) => {
      const updated = { ...prev[record] };
      delete updated[year];
      return { ...prev, [record]: updated };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), goals });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">
          {mode === 'create' ? 'Nova Tabela' : 'Editar Tabela'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs text-white/50 uppercase tracking-wider">Nome da Tabela</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Minhas Finanças, Cliente A..."
              required
              autoFocus
              className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#a855f7] border border-white/10"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs text-white/50 uppercase tracking-wider">
              Descrição <span className="text-white/25">(opcional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do objetivo..."
              className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#a855f7] border border-white/10"
            />
          </div>

          {/* Per-year goal sections — reused for daily, weekly, and annual costs */}
          {(
            [
              { record: 'dailyGoals',  label: 'Meta Diária por Ano (R$)'   },
              { record: 'weeklyGoals', label: 'Meta Semanal por Ano (R$)'  },
              { record: 'annualCosts', label: 'Custo Anual por Ano (R$)'   },
            ] as { record: GoalRecord; label: string }[]
          ).map(({ record, label }) => (
            <div key={record} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/50 uppercase tracking-wider">
                  {label}
                </label>
                <button
                  type="button"
                  onClick={() => addYear(record)}
                  className="text-xs text-[#a855f7] hover:text-[#c084fc] transition-colors font-medium"
                >
                  + Adicionar Ano
                </button>
              </div>

              {Object.keys(goals[record]).length === 0 && (
                <p className="text-xs text-white/25 italic">Nenhum valor configurado.</p>
              )}

              {Object.entries(goals[record])
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([year, value]) => (
                  <div key={year} className="flex items-center gap-2">
                    <span className="text-sm text-white/50 w-12 shrink-0 text-right">
                      {year}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={(e) => setYearValue(record, parseInt(year), e.target.value)}
                      className="flex-1 bg-white/10 text-white text-sm rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#a855f7] border border-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => removeYear(record, parseInt(year))}
                      className="text-white/25 hover:text-red-400 transition-colors text-xl leading-none px-1"
                      aria-label={`Remover ${year}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm rounded-lg bg-[#a855f7] hover:bg-[#9333ea] text-white font-semibold transition-colors"
            >
              {mode === 'create' ? 'Criar Tabela' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
