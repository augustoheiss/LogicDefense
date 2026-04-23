import type { TableRow, TableMetrics, MonthMetrics, YearMetrics } from '../types';
import {
  calculateStrictGlobalBalance,
  resolveGoalForYear,
} from '../utils/dateUtils';

/**
 * Pure math engine — calendar-elapsed-time averaging.
 *
 * Key invariants:
 *  - grossTotal is always the sum of rows with value > 0 only.
 *  - ALL averages are based on calendar days / elapsed time, never "active day count".
 *    This prevents inflation when the user only records payment days.
 *
 *  Global span  →  (latestDate − earliestDate) + 1 calendar days
 *  Month span   →  daysInMonth for past months; today.getDate() for the current month
 *  Year span    →  (lastEntryInYear − firstEntryInYear) + 1 calendar days
 *
 *  globalWeeklyAvg  = globalDailyAvg × 7
 *  globalMonthlyAvg = globalDailyAvg × 30.44   (avg calendar days per month)
 *  globalAnnualAvg  = globalDailyAvg × 365.25
 *  monthMetrics.weeklyAvg = monthMetrics.dailyAvg × 7
 *
 * New in this version:
 *  - timeBankBalance (weeks): paidWeeks − elapsedWeeks
 *    paidWeeks    = grossTotal / effectiveWeeklyGoal
 *    elapsedWeeks = floor((today − minDate) / 7 days)
 *    effectiveWeeklyGoal = resolveGoalForYear(weeklyGoals, currentYear)
 */
export function computeMetrics(
  rows: TableRow[],
  weeklyGoals: Record<number, number>,
  /** When set, the engine treats this date as "today" for all calculations. */
  asOfDate?: string,
): TableMetrics {
  if (rows.length === 0) return emptyMetrics();

  // Waiver rows are ledger entries, not revenue — strip them alongside deposits
  // so they never inflate gross totals or skew averages.
  const revenueRows = rows.filter(
    (r) => r.entryType !== 'deposit' && r.entryType !== 'waiver' && r.entryType !== 'expense',
  );

  // ── Expense metrics — computed before the early-return guard ───────────────
  const expenseRows = rows.filter((r) => r.entryType === 'expense');
  let totalExpenses  = 0;
  let annualExpenses = 0;
  for (const row of expenseRows) {
    totalExpenses += row.value;
    // Prefer explicit monthlyValue × monthCount; fall back to raw value
    annualExpenses += (row.monthlyValue != null && row.monthCount != null)
      ? row.monthlyValue * row.monthCount
      : row.value;
  }
  totalExpenses  = Math.round(totalExpenses  * 100) / 100;
  annualExpenses = Math.round(annualExpenses * 100) / 100;

  if (revenueRows.length === 0) {
    return { ...emptyMetrics(), totalExpenses, annualExpenses };
  }

  const activeRows = revenueRows.filter((r) => r.value > 0);
  if (activeRows.length === 0) return { ...emptyMetrics(), totalExpenses, annualExpenses };

  // ── Global date span — uses periodStart/periodEnd when present ────────────────
  // Including the full period boundaries prevents a single end-of-month payment
  // from collapsing the span to 1 day and exploding the daily average.
  const allEffectiveDates = revenueRows.flatMap((r) => {
    const dates = [r.date];
    if (r.periodStart) dates.push(r.periodStart);
    if (r.periodEnd)   dates.push(r.periodEnd);
    return dates;
  }).sort();
  const globalSpanDays = Math.max(
    1,
    calendarDaySpan(allEffectiveDates[0], allEffectiveDates[allEffectiveDates.length - 1]),
  );

  // ── Today — used for the current-month partial-month denominator ─────────────
  // Time Machine: when asOfDate is provided, treat it as "today".
  const today = asOfDate
    ? new Date(asOfDate + 'T12:00:00')
    : new Date();
  const todayYM = isoYearMonth(today);
  const todayDayOfMonth = today.getDate();

  // ── Accumulators ─────────────────────────────────────────────────────────────
  let grossTotal = 0;

  const byYearAcc: Record<string, { gross: number; dates: string[] }> = {};

  const byMonthAcc: Record<string, {
    gross: number;
    payments: Record<string, number>;
    weeks: Set<string>;
  }> = {};

  const byWeekAcc: Record<string, number> = {};

  // ── Single-pass over active rows ──────────────────────────────────────────────
  // grossTotal and byYear always accumulate the full row.value (total earned).
  // byMonth and byWeek use rowContributions() so that period entries are spread
  // proportionally instead of landing as a lump sum on a single date.
  for (const row of activeRows) {
    const { date, value } = row;
    grossTotal += value;

    // byYear: attribute to the year of periodStart (or payment date as fallback)
    const effectiveStart = row.periodStart ?? date;
    const [yearStr] = effectiveStart.split('-');
    if (!byYearAcc[yearStr]) byYearAcc[yearStr] = { gross: 0, dates: [] };
    byYearAcc[yearStr].gross += value;
    byYearAcc[yearStr].dates.push(effectiveStart);
    if (row.periodEnd) {
      const [endYearStr] = row.periodEnd.split('-');
      if (endYearStr === yearStr) byYearAcc[yearStr].dates.push(row.periodEnd);
    }

    // byMonth + byWeek: distribute value across daily contributions
    for (const contrib of rowContributions(row)) {
      const [cYearStr, cMonthStr] = contrib.date.split('-');
      const yearMonth = `${cYearStr}-${cMonthStr}`;
      const isoWeek = getISOWeekKey(contrib.date);

      if (!byMonthAcc[yearMonth]) {
        byMonthAcc[yearMonth] = { gross: 0, payments: {}, weeks: new Set() };
      }
      byMonthAcc[yearMonth].gross += contrib.value;
      byMonthAcc[yearMonth].payments[contrib.date] =
        (byMonthAcc[yearMonth].payments[contrib.date] ?? 0) + contrib.value;
      byMonthAcc[yearMonth].weeks.add(isoWeek);

      byWeekAcc[isoWeek] = (byWeekAcc[isoWeek] ?? 0) + contrib.value;
    }
  }

  // ── Global averages ───────────────────────────────────────────────────────────
  const globalDailyAvg   = round2(grossTotal / globalSpanDays);
  const globalWeeklyAvg  = round2(globalDailyAvg * 7);
  const globalMonthlyAvg = round2(globalDailyAvg * 30.44);
  const globalAnnualAvg  = round2(globalDailyAvg * 365.25);

  // ── Per-year metrics ──────────────────────────────────────────────────────────
  const byYear: Record<string, YearMetrics> = {};
  for (const [yr, acc] of Object.entries(byYearAcc)) {
    const sorted = [...acc.dates].sort();
    const span = Math.max(1, calendarDaySpan(sorted[0], sorted[sorted.length - 1]));
    const dailyAvg = round2(acc.gross / span);
    byYear[yr] = {
      grossAnnual: round2(acc.gross),
      dailyAvg,
      weeklyAvg:  round2(dailyAvg * 7),
      monthlyAvg: round2(dailyAvg * 30.44),
    };
  }

  // ── Per-month metrics ─────────────────────────────────────────────────────────
  const byMonth: Record<string, MonthMetrics> = {};
  for (const [ym, acc] of Object.entries(byMonthAcc)) {
    const [ymYearStr, ymMonthStr] = ym.split('-');
    const ymYear  = parseInt(ymYearStr, 10);
    const ymMonth = parseInt(ymMonthStr, 10);

    /*
     * Denominator rules:
     *   Current month → how many days have passed so far (today.getDate())
     *   Past month    → full calendar length of that month (28–31)
     * Min = 1 to guard against div-by-zero (e.g. data imported for a future month).
     */
    const denominator = ym === todayYM
      ? Math.max(1, todayDayOfMonth)
      : Math.max(1, daysInMonth(ymYear, ymMonth));

    const dailyAvg = round2(acc.gross / denominator);

    /*
     * Weekly average — two strategies to prevent early-month distortion:
     *
     *   Current month: divide gross by the number of 7-day blocks elapsed
     *     so far (ceil(daysElapsed / 7) ≥ 1).  This avoids the "R$ 600 in
     *     5 days → R$ 840/week" extrapolation, giving R$ 600 instead.
     *
     *   Past month: use dailyAvg × 7 (the full-month pace is stable).
     */
    const weeklyAvg = ym === todayYM
      ? round2(acc.gross / Math.max(1, Math.ceil(todayDayOfMonth / 7)))
      : round2(dailyAvg * 7);

    // Last ISO week that touched this month
    const sortedWeeks = Array.from(acc.weeks).sort();
    const lastWeek = sortedWeeks[sortedWeeks.length - 1] ?? '';
    const lastWeekGross = lastWeek ? round2(byWeekAcc[lastWeek] ?? 0) : 0;

    byMonth[ym] = {
      grossMonthly: round2(acc.gross),
      dailyAvg,
      weeklyAvg,
      lastWeekGross,
      dailyPayments: acc.payments,
    };
  }

  // ── Week totals ───────────────────────────────────────────────────────────────
  const byWeek: Record<string, number> = {};
  for (const [wk, v] of Object.entries(byWeekAcc)) {
    byWeek[wk] = round2(v);
  }

  // ── Strict cumulative BRL balance + real elapsed weeks ───────────────────────
  // Both values come from the same strict Mon–Sun calendar loop — guaranteed
  // to be perfectly consistent with each other.
  const { balance: rawStrictBalance, elapsedWeeks: totalElapsedWeeks } =
    calculateStrictGlobalBalance(revenueRows, weeklyGoals, asOfDate ? today : undefined);

  // ── Waiver credits — derived directly from 'waiver' ledger rows ─────────
  // For each waiver row:
  //   - row.date  = start of the excused period (determines the year's goal rate)
  //   - row.value = number of days justified
  // Per-year goal integrity: a waiver in 2026 uses 2026's weeklyGoal, so a
  // 2027 goal change can never retroactively corrupt 2026's balance.
  let totalWaiverCredits = 0;
  let totalWaivedDays = 0;
  const waiverRows = rows.filter((r) => r.entryType === 'waiver' && r.value > 0);

  for (const row of waiverRows) {
    const waiverYear = parseInt(row.date.slice(0, 4), 10);
    const goalForYear = resolveGoalForYear(weeklyGoals, waiverYear);
    totalWaiverCredits += (row.value / 7) * goalForYear;
    totalWaivedDays    += row.value;
  }

  const globalGoalBalance = Math.round((rawStrictBalance + totalWaiverCredits) * 100) / 100;
  const waivedWeeks = Math.round((totalWaivedDays / 7) * 100) / 100;
  const billableWeeks = Math.round((totalElapsedWeeks - waivedWeeks) * 100) / 100;

  // ── Time Bank balance (weeks) ─────────────────────────────────────────────
  // timeBankBalance = finalGlobalGoalBalance / currentEffectiveWeeklyGoal
  // Guard against div-by-zero when no goal is set.
  const currentYear = today.getFullYear();
  const effectiveWeeklyGoal = resolveGoalForYear(weeklyGoals, currentYear);
  const timeBankBalance = effectiveWeeklyGoal > 0
    ? Math.round((globalGoalBalance / effectiveWeeklyGoal) * 100) / 100
    : 0;

  // ── Net balance (cash position after expenses) ────────────────────────────────
  const netBalance = round2(grossTotal - totalExpenses);

  return {
    grossTotal: round2(grossTotal),
    globalDailyAvg,
    globalWeeklyAvg,
    globalMonthlyAvg,
    globalAnnualAvg,
    globalGoalBalance,
    totalElapsedWeeks,
    waivedWeeks,
    billableWeeks,
    totalWaiverCredit: Math.round(totalWaiverCredits * 100) / 100,
    timeBankBalance,
    byYear,
    byMonth,
    byWeek,
    totalExpenses,
    annualExpenses,
    netBalance,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calendar days between two "YYYY-MM-DD" strings, inclusive.
 * calendarDaySpan("2026-03-01", "2026-03-01") → 1  (single day)
 * calendarDaySpan("2026-03-01", "2026-03-07") → 7  (one full week)
 */
function calendarDaySpan(dateA: string, dateB: string): number {
  const msPerDay = 86_400_000;
  const a = new Date(dateA + 'T12:00:00').getTime();
  const b = new Date(dateB + 'T12:00:00').getTime();
  return Math.round(Math.abs(b - a) / msPerDay) + 1;
}

/**
 * Total calendar days in a given month.
 * daysInMonth(2024, 2) → 29  (leap year)
 * daysInMonth(2025, 2) → 28
 * month is 1-indexed (1 = January).
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * "YYYY-MM" key from a Date object.
 */
function isoYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * ISO 8601 week key "YYYY-Www".
 * Jan 4 is always in week 1 (the standard anchor).
 * Noon is used to avoid DST edge-case shifts.
 */
function getISOWeekKey(dateStr: string): string {
  const d = new Date(
    Date.UTC(
      parseInt(dateStr.slice(0, 4), 10),
      parseInt(dateStr.slice(5, 7), 10) - 1,
      parseInt(dateStr.slice(8, 10), 10),
    ),
  );
  // Shift to nearest Thursday (ISO week anchor)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function emptyMetrics(): TableMetrics {
  return {
    grossTotal: 0,
    globalDailyAvg: 0,
    globalWeeklyAvg: 0,
    globalMonthlyAvg: 0,
    globalAnnualAvg: 0,
    globalGoalBalance: 0,
    totalElapsedWeeks: 0,
    waivedWeeks: 0,
    billableWeeks: 0,
    totalWaiverCredit: 0,
    timeBankBalance: 0,
    byYear: {},
    byMonth: {},
    byWeek: {},
    totalExpenses: 0,
    annualExpenses: 0,
    netBalance: 0,
  };
}

// ── Period distribution helper ──────────────────────────────────────────────────────────

/**
 * Returns a list of daily contribution objects for a revenue row.
 *
 * Period rows (periodStart + periodEnd present and distinct):
 *   Distributes row.value / periodDays to each calendar day in
 *   [periodStart, periodEnd]. This prevents a lump-sum payment
 *   from inflating daily/weekly/monthly averages.
 *
 * Single-day rows (no period fields or periodStart === periodEnd):
 *   Returns a single entry with the full row.value at row.date.
 */
export function rowContributions(row: TableRow): Array<{ date: string; value: number }> {
  if (row.periodStart && row.periodEnd && row.periodStart !== row.periodEnd) {
    const msPerDay = 86_400_000;
    const startMs  = new Date(row.periodStart + 'T12:00:00').getTime();
    const endMs    = new Date(row.periodEnd   + 'T12:00:00').getTime();
    if (endMs < startMs) return [{ date: row.date, value: row.value }]; // guard

    const periodDays = Math.max(1, Math.round((endMs - startMs) / msPerDay) + 1);
    const dailyValue = row.value / periodDays;
    const contributions: Array<{ date: string; value: number }> = [];

    for (let ms = startMs; ms <= endMs; ms += msPerDay) {
      // Use ISO date string sliced to YYYY-MM-DD (noon UTC avoids DST shifts)
      contributions.push({ date: new Date(ms).toISOString().slice(0, 10), value: dailyValue });
    }
    return contributions;
  }
  return [{ date: row.date, value: row.value }];
}
