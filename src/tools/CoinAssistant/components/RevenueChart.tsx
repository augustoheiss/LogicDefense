import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TableRow } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevenueChartProps {
  rows: TableRow[];
  dailyGoal: number;
}

interface ChartPoint {
  dateLabel: string;  // "01/03"
  dateISO: string;    // "YYYY-MM-DD"
  value: number;      // 0 if no entry exists for that day
  rollingAvg: number; // 7-day rolling avg — zeros count in the denominator
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month is 1-indexed
}

function currentYM(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
}

function currentISODate(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

/**
 * Builds a padded ChartPoint array for every calendar day of the given month.
 * Days with no matching row get value = 0.
 * Future days in the current month are excluded.
 * Rolling average uses a 7-day window where zero-value days count in the denominator,
 * matching the useMetricsEngine calendar-elapsed-time invariant.
 */
function buildMonthData(rows: TableRow[], ym: string): ChartPoint[] {
  const [yearStr, monthStr] = ym.split('-');
  const year  = parseInt(yearStr,  10);
  const month = parseInt(monthStr, 10);
  const totalDays  = daysInMonth(year, month);
  const isThisMonth = ym === currentYM();
  const todayDate   = currentISODate();

  // Deposits are not revenue — exclude them so they don't inflate the bars
  const revenueRows = rows.filter((r) => r.entryType !== 'deposit');

  // Value lookup for this month only
  const lookup: Record<string, number> = {};
  for (const row of revenueRows) {
    if (row.date.startsWith(ym + '-')) {
      lookup[row.date] = row.value;
    }
  }

  // Generate one point per calendar day (skip future days in current month)
  const points: ChartPoint[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dateISO = `${yearStr}-${monthStr}-${pad2(d)}`;
    if (isThisMonth && dateISO > todayDate) break;

    points.push({
      dateLabel: `${pad2(d)}/${monthStr}`,
      dateISO,
      value: lookup[dateISO] ?? 0,
      rollingAvg: 0, // filled below
    });
  }

  // 7-day calendar-aware rolling average (zeros are real days)
  const WINDOW = 7;
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - WINDOW + 1);
    const slice = points.slice(start, i + 1);
    const sum   = slice.reduce((s, p) => s + p.value, 0);
    points[i].rollingAvg = Math.round((sum / slice.length) * 100) / 100;
  }

  return points;
}

/**
 * Returns months to show in the selector: current month + any month with at
 * least one active row, sorted newest-first.
 */
function getAvailableMonths(rows: TableRow[]): string[] {
  const months = new Set<string>([currentYM()]);
  for (const row of rows) {
    if (row.value > 0 && row.entryType !== 'deposit') {
      months.add(row.date.slice(0, 7));
    }
  }
  return Array.from(months).sort().reverse();
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload.find((p: { dataKey: string }) => p.dataKey === 'value')?.value as number;
  const avg   = payload.find((p: { dataKey: string }) => p.dataKey === 'rollingAvg')?.value as number;
  const isRest = value === 0;

  return (
    <div className="bg-[#1a1a2e] border border-white/15 rounded-lg px-3 py-2 text-xs shadow-xl min-w-28">
      <p className="text-white/50 mb-1.5 font-medium">{label}</p>
      <p className={isRest ? 'text-white/30 italic' : 'text-white font-semibold font-mono'}>
        {isRest ? 'Sem entrada' : fmtBRL(value)}
      </p>
      {!isRest && avg !== undefined && (
        <p className="text-[#a855f7]/80 mt-1">Média 7d: {fmtBRL(avg)}</p>
      )}
    </div>
  );
}

// ── Month selector sub-component ──────────────────────────────────────────────

interface MonthSelectorProps {
  value: string;
  options: string[];
  onChange: (ym: string) => void;
}

function MonthSelector({ value, options, onChange }: MonthSelectorProps) {
  const idx    = options.indexOf(value);
  const hasPrev = idx < options.length - 1; // older = higher index (sorted desc)
  const hasNext = idx > 0;                  // newer = lower index

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => hasPrev && onChange(options[idx + 1])}
        disabled={!hasPrev}
        className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        aria-label="Mês anterior"
      >
        ‹
      </button>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/8 border border-white/15 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[#a855f7] cursor-pointer appearance-none text-center"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
      >
        {options.map((ym) => (
          <option key={ym} value={ym} style={{ background: '#1a1a2e', color: '#fff' }}>
            {formatMonthLabel(ym)}
          </option>
        ))}
      </select>

      <button
        onClick={() => hasNext && onChange(options[idx - 1])}
        disabled={!hasNext}
        className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RevenueChart({ rows, dailyGoal }: RevenueChartProps) {
  const availableMonths = useMemo(() => getAvailableMonths(rows), [rows]);

  // Default to most recent month with active revenue data, else current month
  const defaultMonth = useMemo(() => {
    const lastActive = rows
      .filter((r) => r.value > 0 && r.entryType !== 'deposit')
      .map((r) => r.date.slice(0, 7))
      .sort()
      .reverse()[0];
    return lastActive ?? currentYM();
  }, [rows]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => defaultMonth);

  // Guard: if selected month vanishes from available list, fall back
  const effectiveMonth = availableMonths.includes(selectedMonth) ? selectedMonth : defaultMonth;

  const data = useMemo(
    () => buildMonthData(rows, effectiveMonth),
    [rows, effectiveMonth],
  );

  // ── Month summary stats ──
  const monthGross   = data.reduce((s, p) => s + p.value, 0);
  const activeDays   = data.filter((p) => p.value > 0).length;
  const calendarDays = data.length;
  const monthDailyAvg = calendarDays > 0 ? monthGross / calendarDays : 0;

  // ── Empty state ──
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-white/25">
        <span className="text-3xl">📊</span>
        <span className="text-sm">Nenhum dado para exibir. Adicione entradas na aba Planilha.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header row: month selector + summary stats ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSelector
          value={effectiveMonth}
          options={availableMonths}
          onChange={setSelectedMonth}
        />

        <div className="flex gap-4 text-right">
          <div>
            <div className="text-xs text-white/30">Bruto do mês</div>
            <div className="text-sm font-mono font-semibold text-white">{fmtBRL(monthGross)}</div>
          </div>
          <div>
            <div className="text-xs text-white/30">Média / dia</div>
            <div
              className={`text-sm font-mono font-semibold ${
                monthDailyAvg > 0
                  ? monthDailyAvg >= dailyGoal
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                  : 'text-white/30'
              }`}
            >
              {fmtBRL(monthDailyAvg)}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/30">Dias ativos</div>
            <div className="text-sm font-mono font-semibold text-white/70">
              {activeDays}/{calendarDays}
            </div>
          </div>
        </div>
      </div>

      {/* ── Empty month state ── */}
      {data.length === 0 && (
        <div className="flex items-center justify-center h-36 text-white/25 text-sm">
          Nenhum dado para {formatMonthLabel(effectiveMonth)}.
        </div>
      )}

      {/* ── Legend ── */}
      {data.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/35">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/70" />
              Acima da meta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/70" />
              Abaixo da meta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-white/15" />
              Sem entrada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 bg-[#a855f7]" />
              Média 7 dias
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-white/30" />
              Meta diária
            </span>
          </div>

          {/* ── Chart ── */}
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                interval={data.length > 20 ? Math.ceil(data.length / 15) - 1 : 0}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  v === 0 ? '' : v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`
                }
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />

              {/* Daily goal reference line */}
              <ReferenceLine
                y={dailyGoal}
                stroke="rgba(255,255,255,0.22)"
                strokeDasharray="4 3"
                label={{
                  value: `Meta ${fmtBRL(dailyGoal)}`,
                  position: 'insideTopRight',
                  fill: 'rgba(255,255,255,0.28)',
                  fontSize: 10,
                }}
              />

              {/* Bars — three colors: emerald above goal, amber below, dim for zero */}
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {data.map((entry) => (
                  <Cell
                    key={entry.dateISO}
                    fill={
                      entry.value === 0
                        ? 'rgba(255,255,255,0.08)'
                        : entry.value >= dailyGoal
                          ? 'rgba(52,211,153,0.75)'   // emerald
                          : 'rgba(251,191,36,0.65)'    // amber
                    }
                  />
                ))}
              </Bar>

              {/* 7-day rolling average — only visible on non-zero days */}
              <Line
                type="monotone"
                dataKey="rollingAvg"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#a855f7', strokeWidth: 0 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
