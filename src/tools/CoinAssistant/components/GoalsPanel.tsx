import type { TableGoals, TableMetrics } from '../types';
import { resolveGoalForYear } from '../utils/dateUtils';
import { formatCurrencyShort, formatCurrencyFull } from '../utils/formatCurrency';

interface GoalsPanelProps {
  goals: TableGoals;
  metrics: TableMetrics;
}

/** Shorthand for compact card values */
const fmt = formatCurrencyShort;

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
  const abs = Math.abs(v);
  return v >= 0 ? `+${formatCurrencyFull(abs)}` : `-${formatCurrencyFull(abs)}`;
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
        Semanas de Saldo = Saldo Final Líquido ÷ Meta Semanal
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

      {/* ── Time Bank Breakdown (always visible) ── */}
      {metrics.grossTotal > 0 && (() => {
        // Decompose the goal balance:
        //   goalBalance = regularIncome + waiverCredits + partnerIn - goalTarget - partnerOut
        //   FIREWALL: grossTotal is now pure operational (no partner_in)
        const regularIncome = metrics.grossTotal;
        const goalTarget = metrics.billableWeeks > 0 && currentWeeklyGoal > 0
          ? Math.round(metrics.billableWeeks * currentWeeklyGoal * 100) / 100
          : 0;

        // ── Partner Netting (Enxugamento de Parceria) ──────────────────────
        // Cancel the overlapping amount so the breakdown shows only liquid values.
        const canceledAmount = Math.min(metrics.totalPartnerIn, metrics.totalPartnerOut);
        const liquidPartnerIn  = metrics.totalPartnerIn  - canceledAmount;
        const liquidPartnerOut = metrics.totalPartnerOut - canceledAmount;
        const totalDevido = goalTarget + liquidPartnerOut;

        // Pre-computed historically-accumulated week equivalents from the engine.
        // These replace the naive (value / currentWeeklyGoal) flat division.
        const fmtW = (weeks: number) => weeks.toFixed(1);

        // Effective time bank: globalGoalBalance / currentWeeklyGoal
        const effectiveWeeksBalance = currentWeeklyGoal > 0
          ? balance / currentWeeklyGoal
          : 0;

        const rows = [
          { sign: '+', label: 'Receitas Operacionais', value: regularIncome, weeks: metrics.grossTotalWeeks, color: 'text-emerald-400' },
          ...(metrics.totalWaiverCredit > 0
            ? [{ sign: '+', label: 'Justificativas', value: metrics.totalWaiverCredit, weeks: metrics.waiverTotalWeeks, color: 'text-orange-400' }]
            : []),
          ...(liquidPartnerIn > 0
            ? [{ sign: '+', label: 'Créditos de Parceria (Líquido)', value: liquidPartnerIn, weeks: 0, color: 'text-indigo-400' }]
            : []),
          { sign: '−', label: liquidPartnerOut > 0 ? 'Total Devido (Metas + Parceria Líq.)' : 'Metas Acumuladas', value: liquidPartnerOut > 0 ? totalDevido : goalTarget, weeks: metrics.goalTotalWeeks, color: 'text-white/50' },
        ];

        return (
          <details className="group" open>
            <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors select-none flex items-center gap-1">
              <span className="text-white/20 group-open:rotate-90 transition-transform inline-block">▶</span>
              Detalhamento do Banco de Valores
            </summary>
            <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 space-y-1 text-xs font-mono overflow-hidden">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-wrap justify-between items-center gap-x-2 gap-y-0.5 min-w-0">
                  <span className={`${r.color} min-w-0`}>
                    <span className="text-white/25 w-4 inline-block">{r.sign}</span> {r.label}
                  </span>
                  <span className={`${r.color} text-right`}>
                    {fmt(r.value)} {r.weeks > 0 && <span className="text-white/20">({fmtW(r.weeks)} sem)</span>}
                  </span>
                </div>
              ))}
              {liquidPartnerOut > 0 && (
                <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-0.5 min-w-0 text-white/20">
                  <span className="min-w-0 pl-4 text-[10px]">
                    Metas: {fmt(goalTarget)} + Parceria Líq.: {fmt(liquidPartnerOut)}
                  </span>
                </div>
              )}
              <div className="border-t border-white/10 pt-1 flex flex-wrap justify-between items-center font-semibold gap-x-2 gap-y-0.5 min-w-0">
                <span className={balancePositive ? 'text-emerald-400' : 'text-red-400'}>
                  <span className="text-white/25 w-4 inline-block">=</span> Saldo Final
                </span>
                <span className={`text-right ${balancePositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(balance)} <span className="text-white/20">({effectiveWeeksBalance >= 0 ? '+' : ''}{effectiveWeeksBalance.toFixed(3)} sem)</span>
                </span>
              </div>
            </div>
          </details>
        );
      })()}

      {/* ── Time Bank (Banco de Horas) ── */}
      {metrics.grossTotal > 0 && (() => {
        const effectiveWeeks = currentWeeklyGoal > 0
          ? metrics.globalGoalBalance / currentWeeklyGoal
          : 0;
        return <TimeBankCard balance={effectiveWeeks} />;
      })()}

      {/* ── Manual goal progress bars (only when targets > 0) ── */}
      {currentDailyGoal > 0 && (
        <ProgressBar
          label={`Meta Diária ${currentYear}`}
          current={metrics.globalDailyAvg}
          target={currentDailyGoal}
          unit="/ dia"
        />
      )}

      {currentWeeklyGoal > 0 && (
        <ProgressBar
          label={`Meta Semanal ${currentYear} (última semana)`}
          current={latestWeekGross}
          target={currentWeeklyGoal}
          unit="/ semana"
        />
      )}

      {currentWeeklyGoal > 0 && latestMonthMetrics && (
        <ProgressBar
          label="Bruto Mensal (último mês)"
          current={latestMonthMetrics.grossMonthly}
          target={currentWeeklyGoal * 4}
          unit="/ mês"
        />
      )}

      {currentYearCost > 0 && (
        <ProgressBar
          label={`Custo Anual ${currentYear}`}
          current={currentYearGross}
          target={currentYearCost}
          unit="anual"
        />
      )}

      {/* ── Survival goals (always-on, from core engine) ── */}
      {metrics.survivalDaily > 0 && (
        <div className="space-y-3 pt-2 border-t border-cyan-500/20">
          <div className="text-xs text-cyan-400/60 uppercase tracking-wider flex items-center gap-1.5">
            <span>🛡️</span> Metas de Sobrevivência
            <span className="text-white/20 normal-case">(break-even diário global)</span>
          </div>
          <ProgressBar
            label="Sobrevivência Diária"
            current={metrics.globalDailyAvg}
            target={metrics.survivalDaily}
            unit="/ dia"
          />
          <ProgressBar
            label="Sobrevivência Semanal"
            current={latestWeekGross}
            target={metrics.survivalWeekly}
            unit="/ semana"
          />
          {latestMonthMetrics && (
            <ProgressBar
              label="Sobrevivência Mensal"
              current={latestMonthMetrics.grossMonthly}
              target={metrics.survivalMonthly}
              unit="/ mês"
            />
          )}
        </div>
      )}

      {/* ── Quick stats ── */}
      <div className="pt-1 border-t border-white/10 grid gap-3 text-center grid-cols-2 sm:grid-cols-4">
        {currentDailyGoal > 0 && (
          <div>
            <div className="text-xs text-white/30 mb-1">Meta diária {currentYear}</div>
            <div className="text-sm font-mono font-semibold text-[#a855f7]">
              {fmt(currentDailyGoal)}
            </div>
          </div>
        )}
        {currentYearCost > 0 && (
          <div>
            <div className="text-xs text-white/30 mb-1">Custo anual {currentYear}</div>
            <div className="text-sm font-mono font-semibold text-[#a855f7]">
              {fmt(currentYearCost)}
            </div>
          </div>
        )}
        <div>
          <div className="text-xs text-white/30 mb-1">Semanas de parceria</div>
          <div className="text-sm font-mono font-semibold text-white/60">
            {metrics.totalElapsedWeeks} sem.
          </div>
        </div>
        {metrics.totalExpenses > 0 && (
          <div>
            <div className="text-xs text-white/30 mb-1">Saldo Líquido</div>
            <div className={`text-sm font-mono font-semibold ${metrics.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {metrics.netBalance >= 0 ? '+' : ''}{fmt(metrics.netBalance)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
