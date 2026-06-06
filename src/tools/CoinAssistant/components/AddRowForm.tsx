import { useState, useRef, useEffect } from 'react';
import type { TableRow } from '../types';
import { useAutocomplete } from '../hooks/useAutocomplete';

interface AddRowFormProps {
  onAdd: (row: Omit<TableRow, 'id'>) => void;
  /** All rows in the current table — used to build the autocomplete index. */
  rows: TableRow[];
}

type EntryType = 'revenue' | 'deposit' | 'waiver' | 'expense' | 'partner_in' | 'partner_out';

/** Calculates calendar days in the range [a, b] inclusive. */
function daySpan(a: string, b: string): number {
  if (!a || !b) return 1;
  const msPerDay = 86_400_000;
  const diff = Math.round(
    Math.abs(new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / msPerDay,
  );
  return Math.max(1, diff + 1);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const TYPE_CONFIG: Record<
  EntryType,
  {
    label: string;
    valueLabel: string;
    valuePlaceholder: string;
    descPlaceholder: string;
    ring: string;
    activeBg: string;
    activeText: string;
    icon: string;
  }
> = {
  revenue: {
    label:            'Recebimento',
    valueLabel:       'Valor (R$)',
    valuePlaceholder: '0,00',
    descPlaceholder:  'Corrida, serviço... (opcional)',
    ring:             'focus:ring-[#a855f7]',
    activeBg:         'bg-[#a855f7]',
    activeText:       'text-white',
    icon:             '📥',
  },
  deposit: {
    label:            'Aporte',
    valueLabel:       'Valor (R$)',
    valuePlaceholder: '0,00',
    descPlaceholder:  'Tesouro Direto, poupança... (opcional)',
    ring:             'focus:ring-sky-500',
    activeBg:         'bg-sky-500',
    activeText:       'text-white',
    icon:             '💰',
  },
  waiver: {
    label:            'Justificativas',
    valueLabel:       'Valor (R$)',
    valuePlaceholder: '0,00',
    descPlaceholder:  'Motivo: placa perdida, manutenção...',
    ring:             'focus:ring-amber-400',
    activeBg:         'bg-amber-500',
    activeText:       'text-white',
    icon:             '🛡️',
  },
  expense: {
    label:            'Custo',
    valueLabel:       'Valor Mensal (R$)',
    valuePlaceholder: '450.00',
    descPlaceholder:  'Seguro, IPVA, Financiamento...',
    ring:             'focus:ring-rose-400',
    activeBg:         'bg-rose-500',
    activeText:       'text-white',
    icon:             '🏷️',
  },
  partner_in: {
    label:            'Crédito Parceria',
    valueLabel:       'Valor (R$)',
    valuePlaceholder: '0,00',
    descPlaceholder:  'Reembolso, crédito de parceiro...',
    ring:             'focus:ring-indigo-400',
    activeBg:         'bg-indigo-500',
    activeText:       'text-white',
    icon:             '🤝',
  },
  partner_out: {
    label:            'Débito Parceria',
    valueLabel:       'Valor (R$)',
    valuePlaceholder: '0,00',
    descPlaceholder:  'Encargo, dívida de parceiro...',
    ring:             'focus:ring-amber-400',
    activeBg:         'bg-amber-500',
    activeText:       'text-white',
    icon:             '📤',
  },
};

export function AddRowForm({ onAdd, rows }: AddRowFormProps) {
  const [entryType,   setEntryType]   = useState<EntryType>('revenue');
  const [date,        setDate]        = useState(todayISO());
  const [value,       setValue]       = useState('');
  const [description, setDescription] = useState('');
  const [monthCount,  setMonthCount]  = useState('12');
  // Period mode — revenue only
  const [isPeriod,    setIsPeriod]    = useState(false);
  const [periodStart, setPeriodStart] = useState(todayISO());
  const [periodEnd,   setPeriodEnd]   = useState(todayISO());

  // ── Autocomplete ────────────────────────────────────────────────────────────
  const { getSuggestions } = useAutocomplete(rows);
  const [suggestions,     setSuggestions]     = useState<ReturnType<typeof getSuggestions>>([]);
  const [showSuggestions,  setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const descInputRef   = useRef<HTMLInputElement>(null);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        descInputRef.current &&
        !descInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleDescriptionChange(val: string) {
    setDescription(val);
    if (val.trim().length >= 1) {
      const results = getSuggestions(val);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setHighlightedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function handleSuggestionSelect(suggestion: (typeof suggestions)[0]) {
    setDescription(suggestion.description);
    // Auto-switch entry type (ruling #4: auto-switch but allow manual override)
    setEntryType(suggestion.entryType);
    setShowSuggestions(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    // Re-focus the value input for fast data entry
    // (description is filled, next step is entering the value)
  }

  function handleDescriptionKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSuggestionSelect(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  const cfg = TYPE_CONFIG[entryType];
  // Helpers for period preview
  const periodDays   = isPeriod && entryType === 'revenue' ? daySpan(periodStart, periodEnd) : 1;
  const dailyPreview = isPeriod && entryType === 'revenue' && value
    ? Math.round((parseFloat(value) / periodDays) * 100) / 100
    : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (entryType === 'expense') {
      // Expense: monthlyValue × monthCount
      const monthlyValue = parseFloat(value);
      const months       = parseInt(monthCount, 10);
      if (!date || isNaN(monthlyValue) || monthlyValue <= 0) return;
      if (isNaN(months) || months < 1) return;
      if (!description.trim()) return;

      onAdd({
        date,
        value: Math.round(monthlyValue * months * 100) / 100,
        description: description.trim(),
        entryType: 'expense',
        monthlyValue,
        monthCount: months,
      });
    } else {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0) return;
      // Waivers must have a positive value and a reason
      if (entryType === 'waiver' && (numValue < 0.01 || !description.trim())) return;

      const isPeriodMode = isPeriod && entryType === 'revenue' && periodStart && periodEnd;
      // Swap if user picked end before start
      const [effStart, effEnd] = isPeriodMode
        ? [periodStart, periodEnd].sort()
        : [date, date];

      if (!effStart) return;

      onAdd({
        date:        isPeriodMode ? effStart : date,
        value:       numValue,
        description: description.trim() || undefined,
        entryType,
        ...(isPeriodMode ? { periodStart: effStart, periodEnd: effEnd } : {}),
      });
    }

    setValue('');
    setDescription('');
    setDate(todayISO());
    setPeriodStart(todayISO());
    setPeriodEnd(todayISO());
    setMonthCount('12');
    setIsPeriod(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 bg-white/5 border border-white/10 rounded-lg p-3"
    >
      {/* ── Entry type selector ── */}
      <div className="flex items-center gap-2 self-start">
        <select
          value={entryType}
          onChange={(e) => {
            const t = e.target.value as EntryType;
            setEntryType(t);
            if (t !== 'revenue') setIsPeriod(false);
          }}
          className={`text-sm font-semibold rounded-lg px-3 py-1.5 outline-none cursor-pointer border appearance-none pr-8 transition-all ${TYPE_CONFIG[entryType].ring} ring-1 ring-transparent focus:ring-1`}
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: '#fff',
            borderColor: 'rgba(255,255,255,0.15)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff40' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          {(['revenue', 'deposit', 'waiver', 'expense', 'partner_in', 'partner_out'] as EntryType[]).map((type) => {
            const c = TYPE_CONFIG[type];
            return (
              <option key={type} value={type} style={{ background: '#1a1a2e', color: '#fff' }}>
                {c.icon} {c.label}
              </option>
            );
          })}
        </select>
      </div>

      {/* ── Period toggle (revenue only) ── */}
      {entryType === 'revenue' && (
        <div className="flex items-center gap-1 self-start text-xs">
          <button
            type="button"
            onClick={() => setIsPeriod(false)}
            className={`px-2 py-1 rounded transition-all ${
              !isPeriod
                ? 'bg-[#a855f7]/20 text-[#a855f7] font-semibold'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            📅 Único
          </button>
          <span className="text-white/20">|</span>
          <button
            type="button"
            onClick={() => setIsPeriod(true)}
            className={`px-2 py-1 rounded transition-all ${
              isPeriod
                ? 'bg-[#a855f7]/20 text-[#a855f7] font-semibold'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            📆 Cobre um Período
          </button>
        </div>
      )}

      {/* ── Waiver info hint ── */}
      {entryType === 'waiver' && (
        <div className="space-y-1 -mt-1">
          <p className="text-xs text-amber-400/60 leading-relaxed">
            Registre o valor financeiro da justificativa. Esse valor será convertido em créditos diretos no seu Banco de Tempo.
          </p>
        </div>
      )}

      {/* ── Fields row ── */}
      <div className="flex flex-wrap gap-2 items-end">
        {/* Date or Period fields */}
        {isPeriod && entryType === 'revenue' ? (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40 uppercase tracking-wider">Início</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
                className={`bg-white/10 text-white text-sm rounded px-3 py-2 outline-none border border-white/10 [color-scheme:dark] ${cfg.ring}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40 uppercase tracking-wider">Fim do Período</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
                className={`bg-white/10 text-white text-sm rounded px-3 py-2 outline-none border border-white/10 [color-scheme:dark] ${cfg.ring}`}
              />
            </div>
            {dailyPreview !== null && (
              <div className="flex flex-col gap-1 self-center">
                <span className="text-xs text-white/40 uppercase tracking-wider">Rateio</span>
                <span className="text-xs font-mono text-[#a855f7]/90 py-2">
                  ≈ R$ {dailyPreview.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/dia
                  &nbsp;·&nbsp;
                  R$ {Math.round(dailyPreview * 7 * 100 / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/sem.
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/40 uppercase tracking-wider">
              {entryType === 'waiver' ? 'Data da Ocorrência' : 'Data'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={`bg-white/10 text-white text-sm rounded px-3 py-2 outline-none border border-white/10 [color-scheme:dark] ${cfg.ring}`}
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/40 uppercase tracking-wider">
            {cfg.valueLabel}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={cfg.valuePlaceholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            className={`bg-white/10 text-white text-sm rounded px-3 py-2 w-28 outline-none border border-white/10 ${cfg.ring}`}
          />
        </div>

        {/* ── Expense: month count field ── */}
        {entryType === 'expense' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/40 uppercase tracking-wider">Meses</label>
            <input
              type="number"
              step="1"
              min="1"
              placeholder="12"
              value={monthCount}
              onChange={(e) => setMonthCount(e.target.value)}
              required
              className={`bg-white/10 text-white text-sm rounded px-3 py-2 w-20 outline-none border border-white/10 ${cfg.ring}`}
            />
          </div>
        )}

        <div className="flex flex-col gap-1 flex-1 min-w-36 relative">
          <label className="text-xs text-white/40 uppercase tracking-wider">
            {entryType === 'waiver' ? 'Motivo *' : entryType === 'expense' ? 'Descrição *' : 'Descrição'}
          </label>
          <input
            ref={descInputRef}
            type="text"
            placeholder={cfg.descPlaceholder}
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            onFocus={() => {
              if (description.trim().length >= 1) {
                const results = getSuggestions(description);
                setSuggestions(results);
                setShowSuggestions(results.length > 0);
              }
            }}
            onKeyDown={handleDescriptionKeyDown}
            required={entryType === 'waiver' || entryType === 'expense'}
            className={`bg-white/10 text-white text-sm rounded px-3 py-2 outline-none border border-white/10 w-full ${cfg.ring}`}
            autoComplete="off"
          />

          {/* ── Autocomplete dropdown ── */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0d1117] border border-white/15 rounded-lg shadow-2xl overflow-hidden backdrop-blur-xl"
            >
              {suggestions.map((s, i) => {
                const isHighlighted = i === highlightedIndex;
                const typeIcon = TYPE_CONFIG[s.entryType]?.icon ?? '📥';
                return (
                  <button
                    key={s.description}
                    type="button"
                    onClick={() => handleSuggestionSelect(s)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                      isHighlighted
                        ? 'bg-[#a855f7]/20 text-white'
                        : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                    }`}
                  >
                    <span className="text-base shrink-0">{typeIcon}</span>
                    <span className="flex-1 truncate">{s.description}</span>
                    <span className="text-xs text-white/25 shrink-0 tabular-nums">
                      {s.count}×
                    </span>
                  </button>
                );
              })}
              <div className="px-3 py-1.5 text-[10px] text-white/20 border-t border-white/5 flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/30 text-[9px]">↑↓</kbd>
                navegar
                <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/30 text-[9px] ml-1">Enter</kbd>
                selecionar
                <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/30 text-[9px] ml-1">Esc</kbd>
                fechar
              </div>
            </div>
          )}
        </div>

        {/* ── Expense preview ── */}
        {entryType === 'expense' && value && monthCount && (
          <div className="flex flex-col gap-1 text-right">
            <span className="text-xs text-white/40 uppercase tracking-wider">Total</span>
            <span className="text-sm font-mono font-semibold text-rose-400 py-2">
              R$ {(parseFloat(value || '0') * parseInt(monthCount || '1', 10)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        <button
          type="submit"
          className={`px-5 py-2 rounded-lg ${cfg.activeBg} hover:opacity-90 text-white text-sm font-semibold transition-opacity shrink-0`}
        >
          + Adicionar
        </button>
      </div>
    </form>
  );
}
