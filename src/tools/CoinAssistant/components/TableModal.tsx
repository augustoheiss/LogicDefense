import { useState, useEffect } from 'react';
import type { CoinTable, TableGoals } from '../types';

interface TableModalProps {
  mode: 'create' | 'edit';
  table?: CoinTable | null;
  onSave: (data: { name: string; description: string; goals: TableGoals }) => void;
  onClose: () => void;
}

const DEFAULT_GOALS: TableGoals = {
  dailyGoal: 50,
  weeklyGoal: 400,
  annualCosts: { [new Date().getFullYear()]: 15000 },
};

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

  function handleGoal(key: 'dailyGoal' | 'weeklyGoal', raw: string) {
    const v = parseFloat(raw);
    setGoals((prev) => ({ ...prev, [key]: isNaN(v) ? 0 : v }));
  }

  function setAnnualCost(year: number, raw: string) {
    const v = parseFloat(raw);
    setGoals((prev) => ({
      ...prev,
      annualCosts: { ...prev.annualCosts, [year]: isNaN(v) ? 0 : v },
    }));
  }

  function addAnnualCostYear() {
    const existing = Object.keys(goals.annualCosts).map(Number);
    const next = existing.length > 0 ? Math.max(...existing) + 1 : new Date().getFullYear();
    setGoals((prev) => ({
      ...prev,
      annualCosts: { ...prev.annualCosts, [next]: 0 },
    }));
  }

  function removeAnnualCostYear(year: number) {
    setGoals((prev) => {
      const updated = { ...prev.annualCosts };
      delete updated[year];
      return { ...prev, annualCosts: updated };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), goals });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
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

          {/* Daily + Weekly goals */}
          <div className="space-y-2">
            <label className="text-xs text-white/50 uppercase tracking-wider">Metas (R$)</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-white/30">Meta Diária</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={goals.dailyGoal}
                  onChange={(e) => handleGoal('dailyGoal', e.target.value)}
                  className="w-full bg-white/10 text-white text-sm rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-[#a855f7] border border-white/10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/30">Meta Semanal</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={goals.weeklyGoal}
                  onChange={(e) => handleGoal('weeklyGoal', e.target.value)}
                  className="w-full bg-white/10 text-white text-sm rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-[#a855f7] border border-white/10"
                />
              </div>
            </div>
          </div>

          {/* Per-year annual costs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50 uppercase tracking-wider">
                Custo Anual por Ano (R$)
              </label>
              <button
                type="button"
                onClick={addAnnualCostYear}
                className="text-xs text-[#a855f7] hover:text-[#c084fc] transition-colors font-medium"
              >
                + Adicionar Ano
              </button>
            </div>

            {Object.keys(goals.annualCosts).length === 0 && (
              <p className="text-xs text-white/25 italic">
                Nenhum custo anual configurado.
              </p>
            )}

            {Object.entries(goals.annualCosts)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([year, cost]) => (
                <div key={year} className="flex items-center gap-2">
                  <span className="text-sm text-white/50 w-12 shrink-0 text-right">
                    {year}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cost}
                    onChange={(e) => setAnnualCost(parseInt(year), e.target.value)}
                    className="flex-1 bg-white/10 text-white text-sm rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#a855f7] border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => removeAnnualCostYear(parseInt(year))}
                    className="text-white/25 hover:text-red-400 transition-colors text-xl leading-none px-1"
                    aria-label={`Remover custo de ${year}`}
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>

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
