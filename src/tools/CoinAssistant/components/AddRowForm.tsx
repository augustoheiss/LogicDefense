import { useState } from 'react';
import type { TableRow } from '../types';

interface AddRowFormProps {
  onAdd: (row: Omit<TableRow, 'id'>) => void;
}

type EntryType = 'revenue' | 'deposit';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const TYPE_CONFIG: Record<EntryType, { label: string; placeholder: string; ring: string; activeBg: string; activeText: string }> = {
  revenue: {
    label:      'Recebimento',
    placeholder: 'Corrida, serviço... (opcional)',
    ring:        'focus:ring-[#a855f7]',
    activeBg:    'bg-[#a855f7]',
    activeText:  'text-white',
  },
  deposit: {
    label:      'Aporte',
    placeholder: 'Tesouro Direto, poupança... (opcional)',
    ring:        'focus:ring-sky-500',
    activeBg:    'bg-sky-500',
    activeText:  'text-white',
  },
};

export function AddRowForm({ onAdd }: AddRowFormProps) {
  const [entryType, setEntryType] = useState<EntryType>('revenue');
  const [date,        setDate]        = useState(todayISO());
  const [value,       setValue]       = useState('');
  const [description, setDescription] = useState('');

  const cfg = TYPE_CONFIG[entryType];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numValue = parseFloat(value);
    if (!date || isNaN(numValue) || numValue < 0) return;

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
      <div className="flex items-center gap-1 self-start">
        {(['revenue', 'deposit'] as EntryType[]).map((type) => {
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
              {type === 'revenue' ? '📥 Recebimento' : '💰 Aporte'}
            </button>
          );
        })}
      </div>

      {/* ── Fields row ── */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/40 uppercase tracking-wider">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={`bg-white/10 text-white text-sm rounded px-3 py-2 outline-none border border-white/10 ${cfg.ring}`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/40 uppercase tracking-wider">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            className={`bg-white/10 text-white text-sm rounded px-3 py-2 w-32 outline-none border border-white/10 ${cfg.ring}`}
          />
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-32">
          <label className="text-xs text-white/40 uppercase tracking-wider">Descrição</label>
          <input
            type="text"
            placeholder={cfg.placeholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
