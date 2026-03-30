import type { TableGoals, TableMetrics } from '../types';

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

export function GoalsPanel({ goals, metrics }: GoalsPanelProps) {
  // Latest month data for comparison
  const sortedMonths = Object.keys(metrics.byMonth).sort().reverse();
  const latestMonthMetrics = sortedMonths[0] ? metrics.byMonth[sortedMonths[0]] : null;

  // Latest week: last key in byWeek
  const sortedWeeks = Object.keys(metrics.byWeek).sort().reverse();
  const latestWeekGross = sortedWeeks[0] ? metrics.byWeek[sortedWeeks[0]] : 0;

  // Annual progress: use gross total vs annual cost
  const annualProgress = metrics.grossTotal;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-5">
      <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
        <span className="text-base">🎯</span> Metas
      </h3>

      <ProgressBar
        label="Meta Diária"
        current={metrics.globalDailyAvg}
        target={goals.dailyGoal}
        unit="/ dia"
      />

      <ProgressBar
        label="Meta Semanal (última semana)"
        current={latestWeekGross}
        target={goals.weeklyGoal}
        unit="/ semana"
      />

      {latestMonthMetrics && (
        <ProgressBar
          label="Bruto Mensal (último mês)"
          current={latestMonthMetrics.grossMonthly}
          target={goals.weeklyGoal * 4}
          unit="/ mês"
        />
      )}

      <ProgressBar
        label="Custo Anual do Veículo"
        current={annualProgress}
        target={goals.annualCost}
        unit="anual"
      />

      {/* ── Quick stats ── */}
      <div className="pt-1 border-t border-white/10 grid grid-cols-2 gap-3 text-center">
        <div>
          <div className="text-xs text-white/30 mb-1">Meta diária</div>
          <div className="text-sm font-mono font-semibold text-[#a855f7]">
            {fmt(goals.dailyGoal)}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/30 mb-1">Custo anual</div>
          <div className="text-sm font-mono font-semibold text-[#a855f7]">
            {fmt(goals.annualCost)}
          </div>
        </div>
      </div>
    </div>
  );
}
