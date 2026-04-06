import { useState, useEffect } from 'react';
import type { CoinTable, TableGoals, GoalProfile } from '../types';

interface TableModalProps {
  mode: 'create' | 'edit';
  table?: CoinTable | null;
  onSave: (data: { name: string; description: string; goals: TableGoals }) => void;
  onClose: () => void;
}

const TODAY_YEAR = new Date().getFullYear();
const TODAY_MONTH = `${TODAY_YEAR}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

const DEFAULT_PROFILE: GoalProfile = { dailyGoal: 50, weeklyGoal: 400, annualCost: 15000 };

const DEFAULT_GOALS: TableGoals = {
  dailyGoals:  { [TODAY_YEAR]: DEFAULT_PROFILE.dailyGoal  },
  weeklyGoals: { [TODAY_YEAR]: DEFAULT_PROFILE.weeklyGoal },
  annualCosts: { [TODAY_YEAR]: DEFAULT_PROFILE.annualCost },
  globalGoals:  { ...DEFAULT_PROFILE },
  yearlyGoals:  {},
  monthlyGoals: {},
};

type ScopeTab = 'global' | 'year' | 'month';

// ── Sub-components ────────────────────────────────────────────────────────────

function ProfileInputs({
  profile,
  onChange,
}: {
  profile: GoalProfile;
  onChange: (p: GoalProfile) => void;
}) {
  const fields: { key: keyof GoalProfile; label: string; placeholder: string }[] = [
    { key: 'dailyGoal',  label: 'Meta Diária (R$)',   placeholder: 'Ex: 86.00'    },
    { key: 'weeklyGoal', label: 'Meta Semanal (R$)',  placeholder: 'Ex: 600.00'   },
    { key: 'annualCost', label: 'Custo Anual (R$)',   placeholder: 'Ex: 15000.00' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {fields.map(({ key, label, placeholder }) => (
        <div key={key} className="space-y-1">
          <label className="text-xs text-white/40 uppercase tracking-wider">{label}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={profile[key]}
            placeholder={placeholder}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onChange({ ...profile, [key]: isNaN(v) ? 0 : v });
            }}
            className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#a855f7] border border-white/10"
          />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TableModal({ mode, table, onSave, onClose }: TableModalProps) {
  const [name, setName] = useState(table?.name ?? '');
  const [description, setDescription] = useState(table?.description ?? '');
  const [goals, setGoals] = useState<TableGoals>(table?.goals ?? DEFAULT_GOALS);

  const [activeTab, setActiveTab] = useState<ScopeTab>('global');

  // Year scope state
  const [yearInput, setYearInput] = useState(String(TODAY_YEAR));

  // Month scope state
  const [monthInput, setMonthInput] = useState(TODAY_MONTH);

  useEffect(() => {
    if (table) {
      setName(table.name);
      setDescription(table.description ?? '');
      setGoals(table.goals);
    }
  }, [table]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  function getGlobalProfile(): GoalProfile {
    return goals.globalGoals ?? DEFAULT_PROFILE;
  }

  function setGlobalProfile(p: GoalProfile) {
    const year = parseInt(yearInput, 10) || TODAY_YEAR;
    setGoals((prev) => ({
      ...prev,
      globalGoals: p,
      // Keep legacy flat records in sync with global so old calc functions work
      dailyGoals:  { ...prev.dailyGoals,  [year]: p.dailyGoal  },
      weeklyGoals: { ...prev.weeklyGoals, [year]: p.weeklyGoal },
      annualCosts: { ...prev.annualCosts, [year]: p.annualCost },
    }));
  }

  function setYearProfile(year: number, p: GoalProfile) {
    setGoals((prev) => ({
      ...prev,
      yearlyGoals:  { ...(prev.yearlyGoals  ?? {}), [year]: p },
      // Sync legacy flat records so calculateStrictGlobalBalance keeps working
      dailyGoals:  { ...prev.dailyGoals,  [year]: p.dailyGoal  },
      weeklyGoals: { ...prev.weeklyGoals, [year]: p.weeklyGoal },
      annualCosts: { ...prev.annualCosts, [year]: p.annualCost },
    }));
  }

  function removeYearProfile(year: number) {
    setGoals((prev) => {
      const yrGoals = { ...(prev.yearlyGoals ?? {}) };
      delete yrGoals[year];
      const daily   = { ...prev.dailyGoals  }; delete daily[year];
      const weekly  = { ...prev.weeklyGoals }; delete weekly[year];
      const annual  = { ...prev.annualCosts }; delete annual[year];
      return { ...prev, yearlyGoals: yrGoals, dailyGoals: daily, weeklyGoals: weekly, annualCosts: annual };
    });
  }

  function setMonthProfile(monthKey: string, p: GoalProfile) {
    setGoals((prev) => ({
      ...prev,
      monthlyGoals: { ...(prev.monthlyGoals ?? {}), [monthKey]: p },
    }));
  }

  function removeMonthProfile(monthKey: string) {
    setGoals((prev) => {
      const mo = { ...(prev.monthlyGoals ?? {}) };
      delete mo[monthKey];
      return { ...prev, monthlyGoals: mo };
    });
  }

  // Parse year input — allow any integer year
  const parsedYear = parseInt(yearInput, 10);
  const yearValid  = !isNaN(parsedYear) && parsedYear > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), goals });
  }

  const tabClass = (t: ScopeTab) =>
    `flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
      activeTab === t
        ? 'bg-[#a855f7] text-white'
        : 'text-white/40 hover:text-white/70 hover:bg-white/5'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white">
          {mode === 'create' ? 'Nova Tabela' : 'Editar Tabela'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Name ── */}
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

          {/* ── Description ── */}
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

          {/* ── Goal Settings ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50 uppercase tracking-wider">
                Configurações de Metas
              </label>
            </div>

            {/* Scope Selector */}
            <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
              <button type="button" className={tabClass('global')} onClick={() => setActiveTab('global')}>
                🌐 Global
              </button>
              <button type="button" className={tabClass('year')} onClick={() => setActiveTab('year')}>
                📅 Ano
              </button>
              <button type="button" className={tabClass('month')} onClick={() => setActiveTab('month')}>
                🗓️ Mês
              </button>
            </div>

            {/* ── Global scope ── */}
            {activeTab === 'global' && (
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-white/30 leading-relaxed">
                  Valores padrão usados quando nenhuma meta anual ou mensal específica está configurada.
                </p>
                <ProfileInputs
                  profile={getGlobalProfile()}
                  onChange={setGlobalProfile}
                />
              </div>
            )}

            {/* ── Year scope ── */}
            {activeTab === 'year' && (
              <div className="space-y-3">
                {/* Year input row */}
                <div className="flex gap-2 items-end">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs text-white/40 uppercase tracking-wider">Ano</label>
                    <input
                      type="number"
                      value={yearInput}
                      onChange={(e) => setYearInput(e.target.value)}
                      placeholder="Ex: 2025"
                      className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#a855f7] border border-white/10"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!yearValid}
                    onClick={() => {
                      if (yearValid && !(goals.yearlyGoals ?? {})[parsedYear]) {
                        setYearProfile(parsedYear, getGlobalProfile());
                      }
                    }}
                    className="px-3 py-2 text-xs rounded-lg bg-[#a855f7]/20 hover:bg-[#a855f7]/40 text-[#c084fc] disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                  >
                    + Adicionar Ano
                  </button>
                </div>

                {/* Configured yearly goals list */}
                {Object.keys(goals.yearlyGoals ?? {}).length === 0 ? (
                  <p className="text-xs text-white/25 italic px-1">
                    Nenhuma meta anual configurada. Digite um ano acima e clique + Adicionar Ano.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(goals.yearlyGoals ?? {})
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([yr, profile]) => (
                        <div
                          key={yr}
                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white/70">{yr}</span>
                            <button
                              type="button"
                              onClick={() => removeYearProfile(parseInt(yr))}
                              className="text-white/25 hover:text-red-400 transition-colors text-sm"
                            >
                              ✕ Remover
                            </button>
                          </div>
                          <ProfileInputs
                            profile={profile}
                            onChange={(p) => setYearProfile(parseInt(yr), p)}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Month scope ── */}
            {activeTab === 'month' && (
              <div className="space-y-3">
                {/* Month input row */}
                <div className="flex gap-2 items-end">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs text-white/40 uppercase tracking-wider">Mês</label>
                    <input
                      type="month"
                      value={monthInput}
                      onChange={(e) => setMonthInput(e.target.value)}
                      className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#a855f7] border border-white/10 [color-scheme:dark]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!monthInput}
                    onClick={() => {
                      if (monthInput && !(goals.monthlyGoals ?? {})[monthInput]) {
                        setMonthProfile(monthInput, getGlobalProfile());
                      }
                    }}
                    className="px-3 py-2 text-xs rounded-lg bg-[#a855f7]/20 hover:bg-[#a855f7]/40 text-[#c084fc] disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                  >
                    + Adicionar Mês
                  </button>
                </div>

                {/* Configured monthly goals list */}
                {Object.keys(goals.monthlyGoals ?? {}).length === 0 ? (
                  <p className="text-xs text-white/25 italic px-1">
                    Nenhuma meta mensal configurada. Selecione um mês acima e clique + Adicionar Mês.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(goals.monthlyGoals ?? {})
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([monthKey, profile]) => {
                        const [y, m] = monthKey.split('-');
                        const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', {
                          month: 'long',
                          year: 'numeric',
                        });
                        return (
                          <div
                            key={monthKey}
                            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-white/70 capitalize">{label}</span>
                              <button
                                type="button"
                                onClick={() => removeMonthProfile(monthKey)}
                                className="text-white/25 hover:text-red-400 transition-colors text-sm"
                              >
                                ✕ Remover
                              </button>
                            </div>
                            <ProfileInputs
                              profile={profile}
                              onChange={(p) => setMonthProfile(monthKey, p)}
                            />
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Actions ── */}
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
