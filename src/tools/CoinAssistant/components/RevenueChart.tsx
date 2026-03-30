import { useMemo } from 'react';
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
  /** Controlled from TableEditor — the global month filter. */
  selectedMonth: string;
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
  return new Date(year, month, 0).getDate();
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
 * Deposits are excluded — only revenue rows feed the chart.
 * Future days in the current month are skipped.
 */
function buildMonthData(rows: TableRow[], ym: string): ChartPoint[] {
  const [yearStr, monthStr] = ym.split('-');
  const year  = parseInt(yearStr,  10);
  const month = parseInt(monthStr, 10);
  const totalDays   = daysInMonth(year, month);
  const isThisMonth = ym === currentYM();
  const todayDate   = currentISODate();

  const revenueRows = rows.filter((r) => r.entryType !== 'deposit');

  const lookup: Record<string, number> = {};
  for (const row of revenueRows) {
    if (row.date.startsWith(ym + '-')) {
      lookup[row.date] = row.value;
    }
  }

  const points: ChartPoint[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dateISO = `${yearStr}-${monthStr}-${pad2(d)}`;
    if (isThisMonth && dateISO > todayDate) break;

    points.push({
      dateLabel: `${pad2(d)}/${monthStr}`,
      dateISO,
      value: lookup[dateISO] ?? 0,
      rollingAvg: 0,
    });
  }

  const WINDOW = 7;
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - WINDOW + 1);
    const slice = points.slice(start, i + 1);
    const sum   = slice.reduce((s, p) => s + p.value, 0);
    points[i].rollingAvg = Math.round((sum / slice.length) * 100) / 100;
  }

  return points;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value  = payload.find((p: { dataKey: string }) => p.dataKey === 'value')?.value as number;
  const avg    = payload.find((p: { dataKey: string }) => p.dataKey === 'rollingAvg')?.value as number;
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

// ── Main component ────────────────────────────────────────────────────────────

export function RevenueChart({ rows, dailyGoal, selectedMonth }: RevenueChartProps) {
  const data = useMemo(
    () => buildMonthData(rows, selectedMonth),
    [rows, selectedMonth],
  );

  const monthGross    = data.reduce((s, p) => s + p.value, 0);
  const activeDays    = data.filter((p) => p.value > 0).length;
  const calendarDays  = data.length;
  const monthDailyAvg = calendarDays > 0 ? monthGross / calendarDays : 0;

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
      {/* ── Month summary stats (month selector lives in TableEditor) ── */}
      <div className="flex flex-wrap gap-4 justify-end text-right">
        <div>
          <div className="text-xs text-white/30">Bruto do mês</div>
          <div className="text-sm font-mono font-semibold text-white">{fmtBRL(monthGross)}</div>
        </div>
        <div>
          <div className="text-xs text-white/30">Média / dia</div>
          <div
            className={`text-sm font-mono font-semibold ${
              monthDailyAvg > 0
                ? monthDailyAvg >= dailyGoal ? 'text-emerald-400' : 'text-amber-400'
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

      {/* ── Empty month ── */}
      {data.length === 0 && (
        <div className="flex items-center justify-center h-36 text-white/25 text-sm">
          Nenhuma receita registrada neste mês.
        </div>
      )}

      {/* ── Legend + Chart ── */}
      {data.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/35">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/70" /> Acima da meta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/70" /> Abaixo da meta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-white/15" /> Sem entrada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 bg-[#a855f7]" /> Média 7 dias
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-white/30" />
              Meta diária
            </span>
          </div>

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
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {data.map((entry) => (
                  <Cell
                    key={entry.dateISO}
                    fill={
                      entry.value === 0
                        ? 'rgba(255,255,255,0.08)'
                        : entry.value >= dailyGoal
                          ? 'rgba(52,211,153,0.75)'
                          : 'rgba(251,191,36,0.65)'
                    }
                  />
                ))}
              </Bar>
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
