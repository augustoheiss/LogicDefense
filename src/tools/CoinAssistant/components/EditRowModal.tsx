import { useEffect, useRef, useState } from 'react';
import type { TableRow } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Calendar days in [a, b] inclusive (both YYYY-MM-DD strings). */
function daySpan(a: string, b: string): number {
  if (!a || !b) return 1;
  const msPerDay = 86_400_000;
  return (
    Math.max(
      1,
      Math.round(
        Math.abs(
          new Date(b + 'T12:00:00').getTime() -
            new Date(a + 'T12:00:00').getTime(),
        ) / msPerDay,
      ) + 1,
    )
  );
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// ── Type colours ─────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  revenue: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  expense: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
  waiver:  'text-orange-400 bg-orange-500/15 border-orange-500/30',
  deposit: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
  partner_in:  'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
  partner_out: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
};

const TYPE_LABEL: Record<string, string> = {
  revenue: '💰 Receita',
  expense: '🏷️ Custo',
  waiver:  '🛡️ Justificado',
  deposit: '📥 Aporte',
  partner_in:  '🤝 Crédito Parceria',
  partner_out: '📤 Débito Parceria',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface EditRowModalProps {
  row: TableRow;
  dailyGoal: number;
  onSave: (patch: Partial<Omit<TableRow, 'id'>>) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditRowModal({ row, dailyGoal, onSave, onClose }: EditRowModalProps) {
  // ── Form state initialised from the existing row ──────────────────────────
  const [description, setDescription] = useState(row.description ?? '');
  const [value,       setValue]       = useState(String(row.value));
  const [monthlyVal,  setMonthlyVal]  = useState(String(row.monthlyValue ?? ''));
  const [monthCount,  setMonthCount]  = useState(String(row.monthCount  ?? ''));

  // Period / Smart-Date state
  const [isPeriod,    setIsPeriod]    = useState(!!(row.periodStart && row.periodEnd));
  const [periodStart, setPeriodStart] = useState(row.periodStart ?? row.date);
  const [periodEnd,   setPeriodEnd]   = useState(row.periodEnd   ?? row.date);
  const [singleDate,  setSingleDate]  = useState(row.date);

  // Smart-date two-click tracking
  const [clickQueue,  setClickQueue]  = useState<string[]>([]);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Preview calculations
  const numVal    = parseFloat(value) || 0;
  const spanDays  = isPeriod ? daySpan(periodStart, periodEnd) : 1;
  const dailyRate = isPeriod && numVal > 0 ? numVal / spanDays : null;

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Smart-date two-click logic ────────────────────────────────────────────
  /**
   * Called whenever either period date field changes.
   * Implements the two-click pattern:
   *   - If start === end  → single-date mode
   *   - If start !== end  → period mode (Engine Opção-B)
   */
  function handleDateChange(field: 'start' | 'end', newVal: string) {
    const other = field === 'start' ? periodEnd : periodStart;

    if (field === 'start') setPeriodStart(newVal);
    else                    setPeriodEnd(newVal);

    if (newVal === other) {
      // Same date selected: collapse to single-day
      setIsPeriod(false);
      setSingleDate(newVal);
    } else {
      // Two different dates: auto-activate period mode
      setIsPeriod(true);
    }
  }

  /**
   * Smart single-date input: tracks clicks.
   * 1st click = store. 2nd click (same field) keeps single-day.
   * Switching to period mode manually via the toggle button is also supported.
   */
  function handleSmartClick(newVal: string) {
    const queue = [...clickQueue, newVal];
    if (queue.length === 1) {
      setClickQueue(queue);
      setSingleDate(newVal);
      setPeriodStart(newVal);
      setPeriodEnd(newVal);
      setIsPeriod(false);
    } else {
      const [first, second] = queue.slice(-2);
      if (first === second) {
        // Clicked same day twice → stay single
        setIsPeriod(false);
        setSingleDate(second);
        setPeriodStart(second);
        setPeriodEnd(second);
      } else {
        // Two different days → period
        const [s, e] = [first, second].sort();
        setIsPeriod(true);
        setPeriodStart(s);
        setPeriodEnd(e);
      }
      setClickQueue([]);
    }
  }

  // ── Overlay click-to-close ────────────────────────────────────────────────
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    const effectiveDate = isPeriod ? periodStart : singleDate;
    const patch: Partial<Omit<TableRow, 'id'>> = {
      date:        effectiveDate,
      value:       numValue,
      description: description.trim() || undefined,
    };

    if (isPeriod) {
      const [s, e] = [periodStart, periodEnd].sort();
      patch.periodStart = s;
      patch.periodEnd   = e;
    } else {
      // Clearing period fields on a previously-period row
      patch.periodStart = undefined;
      patch.periodEnd   = undefined;
    }

    if (row.entryType === 'expense') {
      const mv = parseFloat(monthlyVal);
      const mc = parseInt(monthCount, 10);
      if (!isNaN(mv) && !isNaN(mc)) {
        patch.monthlyValue = mv;
        patch.monthCount   = mc;
      }
    }

    onSave(patch);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const ringColor = row.entryType === 'expense' ? 'focus:ring-rose-500/60'
    : row.entryType === 'waiver'      ? 'focus:ring-orange-500/60'
    : row.entryType === 'deposit'     ? 'focus:ring-sky-500/60'
    : row.entryType === 'partner_in'  ? 'focus:ring-indigo-500/60'
    : row.entryType === 'partner_out' ? 'focus:ring-amber-500/60'
    : 'focus:ring-[#a855f7]/60';

  const inputCls = `
    w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2
    outline-none border border-white/10 focus:ring-1 ${ringColor}
    transition-all placeholder-white/20
  `;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="relative w-full max-w-md bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Editar linha"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${TYPE_COLOR[row.entryType as string] ?? ''}`}
            >
              {TYPE_LABEL[row.entryType as string] ?? row.entryType}
            </span>
            {isPeriod && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded border text-purple-400 bg-purple-500/15 border-purple-500/30">
                📆 Rateado
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white transition-colors text-xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* ── Description ── */}
        <div className="space-y-1">
          <label className="text-xs text-white/40 uppercase tracking-wider">Descrição</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sem descrição"
            className={inputCls}
            autoFocus
          />
        </div>

        {/* ── Value ── */}
        <div className="space-y-1">
          <label className="text-xs text-white/40 uppercase tracking-wider">
            {row.entryType === 'waiver' ? 'Dias justificados' : 'Valor (R$)'}
          </label>
          <input
            type="number"
            value={value}
            step={row.entryType === 'waiver' ? '1' : '0.01'}
            min="0"
            onChange={(e) => setValue(e.target.value)}
            className={`${inputCls} font-mono`}
          />
          {row.entryType !== 'waiver' && numVal >= dailyGoal && !isPeriod && (
            <p className="text-xs text-emerald-400/70">✓ Acima da meta diária (R$ {dailyGoal})</p>
          )}
        </div>

        {/* ── Expense sub-fields ── */}
        {row.entryType === 'expense' && (
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-white/40 uppercase tracking-wider">Valor Mensal (R$)</label>
              <input
                type="number"
                value={monthlyVal}
                min="0"
                step="0.01"
                onChange={(e) => setMonthlyVal(e.target.value)}
                placeholder="Opcional"
                className={`${inputCls} font-mono`}
              />
            </div>
            <div className="w-24 space-y-1">
              <label className="text-xs text-white/40 uppercase tracking-wider">Meses</label>
              <input
                type="number"
                value={monthCount}
                min="1"
                step="1"
                onChange={(e) => setMonthCount(e.target.value)}
                placeholder="12"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
        )}

        {/* ── Smart Date section ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/40 uppercase tracking-wider">Data / Período</label>
            {/* Mode toggle — only for revenue */}
            {(row.entryType === 'revenue' || row.entryType === 'expense') && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => { setIsPeriod(false); setSingleDate(periodStart); }}
                  className={`px-2 py-0.5 rounded transition-all ${
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
                  className={`px-2 py-0.5 rounded transition-all ${
                    isPeriod
                      ? 'bg-[#a855f7]/20 text-[#a855f7] font-semibold'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  📆 Período
                </button>
              </div>
            )}
          </div>

          {isPeriod ? (
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-white/30">Início</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  className={`${inputCls} [color-scheme:dark]`}
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-white/30">Fim</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  className={`${inputCls} [color-scheme:dark]`}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-white/25">
                Selecione duas datas diferentes para criar um período automaticamente.
              </p>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => handleSmartClick(e.target.value)}
                className={`${inputCls} [color-scheme:dark]`}
              />
              {clickQueue.length === 1 && (
                <p className="text-xs text-[#a855f7]/70 animate-pulse">
                  ✦ 1ª data selecionada — escolha outra para criar um período
                </p>
              )}
            </div>
          )}

          {/* Daily rate preview */}
          {dailyRate !== null && (
            <div className="flex items-center gap-2 text-xs font-mono bg-[#a855f7]/10 border border-[#a855f7]/20 rounded-lg px-3 py-2">
              <span className="text-[#a855f7]">≈</span>
              <span className="text-white/70">
                {fmtBRL(dailyRate)}/dia
                <span className="text-white/30 mx-1.5">·</span>
                {fmtBRL(dailyRate * 7)}/sem.
                <span className="text-white/30 mx-1.5">·</span>
                <span className="text-white/40">{spanDays}d</span>
              </span>
            </div>
          )}

          {/* Period summary */}
          {isPeriod && (
            <p className="text-xs text-white/30">
              {fmtDate(periodStart)} → {fmtDate(periodEnd)}{' '}
              <span className="text-white/20">({spanDays} dias)</span>
            </p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              row.entryType === 'expense'
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : row.entryType === 'waiver'
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : row.entryType === 'deposit'
                    ? 'bg-sky-600 hover:bg-sky-500 text-white'
                    : row.entryType === 'partner_in'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : row.entryType === 'partner_out'
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-[#a855f7] hover:bg-[#9333ea] text-white'
            }`}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
