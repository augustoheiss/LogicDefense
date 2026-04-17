import { useState } from 'react';
import type { TableRow } from '../types';

interface AddRowFormProps {
  onAdd: (row: Omit<TableRow, 'id'>) => void;
}

type EntryType = 'revenue' | 'deposit' | 'waiver' | 'expense';

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
    label:            'Dias Justificados',
    valueLabel:       'Qtd. de Dias',
    valuePlaceholder: '7',
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
};

export function AddRowForm({ onAdd }: AddRowFormProps) {
  const [entryType,   setEntryType]   = useState<EntryType>('revenue');
  const [date,        setDate]        = useState(todayISO());
  const [value,       setValue]       = useState('');
  const [description, setDescription] = useState('');
  const [monthCount,  setMonthCount]  = useState('12');
  // Period mode — revenue only
  const [isPeriod,    setIsPeriod]    = useState(false);
  const [periodStart, setPeriodStart] = useState(todayISO());
  const [periodEnd,   setPeriodEnd]   = useState(todayISO());

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
      // Waivers must have at least 1 day and a reason
      if (entryType === 'waiver' && (numValue < 1 || !description.trim())) return;

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
      {/* ── Entry type toggle ── */}
      <div className="flex items-center gap-1 self-start flex-wrap">
        {([
            'revenue', 'deposit', 'waiver', 'expense',
          ] as EntryType[]).map((type) => {
          const active = type === entryType;
          const c = TYPE_CONFIG[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                setEntryType(type);
                if (type !== 'revenue') setIsPeriod(false);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                active
                  ? `${c.activeBg} ${c.activeText} shadow`
                  : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              {c.icon} {c.label}
            </button>
          );
        })}
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

      {/* ── Waiver hint ── */}
      {entryType === 'waiver' && (
        <p className="text-xs text-amber-400/60 leading-relaxed -mt-1">
          Registre dias de inatividade justificada. O crédito financeiro será calculado
          automaticamente usando a meta semanal do ano correspondente.
        </p>
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
          <label className="text-xs text-white/40 uppercase tracking-wider">{cfg.valueLabel}</label>
          <input
            type="number"
            step={entryType === 'waiver' ? '1' : '0.01'}
            min={entryType === 'waiver' ? '1' : '0'}
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

        <div className="flex flex-col gap-1 flex-1 min-w-36">
          <label className="text-xs text-white/40 uppercase tracking-wider">
            {entryType === 'waiver' ? 'Motivo *' : entryType === 'expense' ? 'Descrição *' : 'Descrição'}
          </label>
          <input
            type="text"
            placeholder={cfg.descPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required={entryType === 'waiver' || entryType === 'expense'}
            className={`bg-white/10 text-white text-sm rounded px-3 py-2 outline-none border border-white/10 w-full ${cfg.ring}`}
          />
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
