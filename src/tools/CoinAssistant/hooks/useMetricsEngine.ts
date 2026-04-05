import type { TableRow, TableMetrics, MonthMetrics, YearMetrics } from '../types';
import { calculateStrictGlobalBalance } from '../utils/dateUtils';

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
 */
export function computeMetrics(rows: TableRow[], weeklyGoals: Record<number, number>): TableMetrics {
  if (rows.length === 0) return emptyMetrics();

  // Deposits are investment entries, not operational revenue.
  // Strip them so they never inflate gross totals or skew averages.
  const revenueRows = rows.filter((r) => r.entryType !== 'deposit');

  if (revenueRows.length === 0) return emptyMetrics();

  const activeRows = revenueRows.filter((r) => r.value > 0);
  if (activeRows.length === 0) return emptyMetrics();

  // ── Global date span uses revenue rows only (rest-day entries included) ──────
  const allDates = revenueRows.map((r) => r.date).sort();
  const globalSpanDays = Math.max(1, calendarDaySpan(allDates[0], allDates[allDates.length - 1]));

  // ── Today — used for the current-month partial-month denominator ─────────────
  const today = new Date();
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
  for (const row of activeRows) {
    const { date, value } = row;
    const [yearStr, monthStr] = date.split('-');
    const yearMonth = `${yearStr}-${monthStr}`;
    const isoWeek = getISOWeekKey(date);

    grossTotal += value;

    if (!byYearAcc[yearStr]) byYearAcc[yearStr] = { gross: 0, dates: [] };
    byYearAcc[yearStr].gross += value;
    byYearAcc[yearStr].dates.push(date);

    if (!byMonthAcc[yearMonth]) {
      byMonthAcc[yearMonth] = { gross: 0, payments: {}, weeks: new Set() };
    }
    byMonthAcc[yearMonth].gross += value;
    byMonthAcc[yearMonth].payments[date] = value;
    byMonthAcc[yearMonth].weeks.add(isoWeek);

    byWeekAcc[isoWeek] = (byWeekAcc[isoWeek] ?? 0) + value;
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

  // Strict cumulative balance: every Mon–Sun window from the first entry to
  // today is scored against the year-specific weeklyGoals, including empty weeks.
  const globalGoalBalance = calculateStrictGlobalBalance(revenueRows, weeklyGoals);

  return {
    grossTotal: round2(grossTotal),
    globalDailyAvg,
    globalWeeklyAvg,
    globalMonthlyAvg,
    globalAnnualAvg,
    globalGoalBalance,
    byYear,
    byMonth,
    byWeek,
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
    byYear: {},
    byMonth: {},
    byWeek: {},
  };
}
