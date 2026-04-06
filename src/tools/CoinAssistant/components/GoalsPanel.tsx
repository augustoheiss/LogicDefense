import type { TableGoals, TableMetrics } from '../types';
import { resolveGoalForYear } from '../utils/dateUtils';

interface GoalsPanelProps {
  goals: TableGoals;
  metrics: TableMetrics;
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ProgressBar({
  label,
  current,
  target,
  unit,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = target > 0 && current > target;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-white/40">
          {fmt(current)} / {fmt(target)}{' '}
          <span className="text-white/25">{unit}</span>
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            over ? 'bg-emerald-400' : pct >= 80 ? 'bg-yellow-400' : 'bg-[#a855f7]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        <span
          className={`text-xs font-medium ${
            over ? 'text-emerald-400' : pct >= 80 ? 'text-yellow-400' : 'text-[#a855f7]'
          }`}
        >
          {pct.toFixed(1)}%
          {over && ' ✓ Meta superada!'}
        </span>
        {!over && target > current && (
          <span className="text-xs text-white/30">Faltam {fmt(target - current)}</span>
        )}
      </div>
    </div>
  );
}

/** Formats balance as "+R$ X,XX" or "-R$ X,XX" (sign always explicit). */
function fmtBalance(v: number): string {
  const abs = Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return v >= 0 ? `+${abs}` : `-${abs}`;
}

/**
 * Time Bank balance card — shows signed weeks with contextual copy.
 * Positive = credit weeks; negative = debt weeks.
 */
function TimeBankCard({ balance }: { balance: number }) {
  const positive = balance >= 0;
  const absWeeks = Math.abs(balance).toFixed(1);

  return (
    <div
      className={`rounded-xl border p-4 space-y-1.5 ${
        positive
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-red-500/10 border-red-500/25'
      }`}
    >
      <div className="text-xs text-white/40 uppercase tracking-wider">Banco de Horas</div>
      <div className={`text-2xl font-bold font-mono ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {positive ? `+${absWeeks}` : `-${absWeeks}`}{' '}
        <span className="text-base font-semibold">semanas</span>
      </div>
      <div className={`text-xs font-medium leading-snug ${positive ? 'text-emerald-500/80' : 'text-red-400/80'}`}>
        {positive
          ? `✅ Você tem ${absWeeks} semana${parseFloat(absWeeks) !== 1 ? 's' : ''} de folga/adiantadas!`
          : `🚨 Você tem ${absWeeks} semana${parseFloat(absWeeks) !== 1 ? 's' : ''} de serviço pendentes para recuperar a meta`}
      </div>
      <div className="text-xs text-white/20 pt-0.5">
        paidWeeks = receita ÷ meta semanal · elapsedWeeks = semanas desde 1ª entrada
      </div>
    </div>
  );
}

export function GoalsPanel({ goals, metrics }: GoalsPanelProps) {
  // Latest month data for comparison
  const sortedMonths = Object.keys(metrics.byMonth).sort().reverse();
  const latestMonthMetrics = sortedMonths[0] ? metrics.byMonth[sortedMonths[0]] : null;

  // Latest week: last key in byWeek
  const sortedWeeks = Object.keys(metrics.byWeek).sort().reverse();
  const latestWeekGross = sortedWeeks[0] ? metrics.byWeek[sortedWeeks[0]] : 0;

  const currentYear       = new Date().getFullYear();
  // Resolve each goal using the closest configured year (handles gaps gracefully)
  const currentDailyGoal  = resolveGoalForYear(goals.dailyGoals,  currentYear);
  const currentWeeklyGoal = resolveGoalForYear(goals.weeklyGoals, currentYear);
  const currentYearCost   = resolveGoalForYear(goals.annualCosts, currentYear);
  const currentYearGross  = metrics.byYear[String(currentYear)]?.grossAnnual ?? 0;

  const balance = metrics.globalGoalBalance;
  const balancePositive = balance >= 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-5">
      <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
        <span className="text-base">🎯</span> Metas
      </h3>

      {/* ── Strict Global BRL Balance ── */}
      {metrics.grossTotal > 0 && (
        <div
          className={`rounded-xl border p-4 space-y-1 ${
            balancePositive
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/25'
          }`}
        >
          <div className="text-xs text-white/40 uppercase tracking-wider">
            Saldo Acumulado de Metas
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              balancePositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {fmtBalance(balance)}
          </div>
          <div
            className={`text-xs font-medium ${
              balancePositive ? 'text-emerald-500/70' : 'text-red-400/70'
            }`}
          >
            {balancePositive ? 'Banco de Valores / Excedente' : 'Dívida Pendente'}
          </div>
          <div className="text-xs text-white/20 pt-0.5">
            Toda semana desde a 1ª entrada é contabilizada, incluindo semanas
            sem registros.
          </div>
        </div>
      )}

      {/* ── Time Bank (Banco de Horas) ── */}
      {metrics.grossTotal > 0 && (
        <TimeBankCard balance={metrics.timeBankBalance} />
      )}

      <ProgressBar
        label={`Meta Diária ${currentYear}`}
        current={metrics.globalDailyAvg}
        target={currentDailyGoal}
        unit="/ dia"
      />

      <ProgressBar
        label={`Meta Semanal ${currentYear} (última semana)`}
        current={latestWeekGross}
        target={currentWeeklyGoal}
        unit="/ semana"
      />

      {latestMonthMetrics && (
        <ProgressBar
          label="Bruto Mensal (último mês)"
          current={latestMonthMetrics.grossMonthly}
          target={currentWeeklyGoal * 4}
          unit="/ mês"
        />
      )}

      <ProgressBar
        label={`Custo Anual ${currentYear}`}
        current={currentYearGross}
        target={currentYearCost}
        unit="anual"
      />

      {/* ── Quick stats ── */}
      <div className="pt-1 border-t border-white/10 grid grid-cols-2 gap-3 text-center">
        <div>
          <div className="text-xs text-white/30 mb-1">Meta diária {currentYear}</div>
          <div className="text-sm font-mono font-semibold text-[#a855f7]">
            {fmt(currentDailyGoal)}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/30 mb-1">Custo anual {currentYear}</div>
          <div className="text-sm font-mono font-semibold text-[#a855f7]">
            {fmt(currentYearCost)}
          </div>
        </div>
      </div>
    </div>
  );
}
