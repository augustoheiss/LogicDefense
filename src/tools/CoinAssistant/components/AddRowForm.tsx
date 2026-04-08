import { useState } from 'react';
import type { TableRow } from '../types';

interface AddRowFormProps {
  onAdd: (row: Omit<TableRow, 'id'>) => void;
}

type EntryType = 'revenue' | 'deposit' | 'waiver';

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
};

export function AddRowForm({ onAdd }: AddRowFormProps) {
  const [entryType,   setEntryType]   = useState<EntryType>('revenue');
  const [date,        setDate]        = useState(todayISO());
  const [value,       setValue]       = useState('');
  const [description, setDescription] = useState('');

  const cfg = TYPE_CONFIG[entryType];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numValue = parseFloat(value);
    if (!date || isNaN(numValue) || numValue < 0) return;
    // Waivers must have at least 1 day and a reason
    if (entryType === 'waiver' && (numValue < 1 || !description.trim())) return;

    onAdd({
      date,
      value: numValue,
      description: description.trim() || undefined,
      entryType,
    });

    setValue('');
    setDescription('');
    setDate(todayISO());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 bg-white/5 border border-white/10 rounded-lg p-3"
    >
      {/* ── Entry type toggle ── */}
      <div className="flex items-center gap-1 self-start flex-wrap">
        {(['revenue', 'deposit', 'waiver'] as EntryType[]).map((type) => {
          const active = type === entryType;
          const c = TYPE_CONFIG[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => setEntryType(type)}
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

      {/* ── Waiver hint ── */}
      {entryType === 'waiver' && (
        <p className="text-xs text-amber-400/60 leading-relaxed -mt-1">
          Registre dias de inatividade justificada. O crédito financeiro será calculado
          automaticamente usando a meta semanal do ano correspondente.
        </p>
      )}

      {/* ── Fields row ── */}
      <div className="flex flex-wrap gap-2 items-end">
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

        <div className="flex flex-col gap-1 flex-1 min-w-36">
          <label className="text-xs text-white/40 uppercase tracking-wider">
            {entryType === 'waiver' ? 'Motivo *' : 'Descrição'}
          </label>
          <input
            type="text"
            placeholder={cfg.descPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required={entryType === 'waiver'}
            className={`bg-white/10 text-white text-sm rounded px-3 py-2 outline-none border border-white/10 w-full ${cfg.ring}`}
          />
        </div>

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
