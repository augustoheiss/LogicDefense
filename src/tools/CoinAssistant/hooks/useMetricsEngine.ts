import type { TableRow, TableGoals, TableMetrics, MonthMetrics, YearMetrics } from '../types';
import {
  calculateStrictGlobalBalance,
  getWeeklyGoalForDate,
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
  goals: TableGoals,
  /** When set, the engine treats this date as "today" for all calculations. */
  asOfDate?: string,
): TableMetrics {
  if (rows.length === 0) return emptyMetrics();

  // Waiver rows are ledger entries, not revenue — strip them alongside deposits.
  // FIREWALL: partner_in and partner_out are isolated from operational revenue.
  const revenueRows = rows.filter(
    (r) => r.entryType !== 'deposit' && r.entryType !== 'waiver' && r.entryType !== 'expense' && r.entryType !== 'partner_out' && r.entryType !== 'partner_in',
  );

  // ── Expense metrics — computed before the early-return guard ───────────────
  const expenseRows = rows.filter((r) => r.entryType === 'expense');
  let totalExpenses = 0;

  // Survival goal accumulators: track the global expense date span
  let expEarliest = '';
  let expLatest   = '';

  for (const row of expenseRows) {
    totalExpenses += row.value;

    // Widen global expense span for survival goals
    const expStart = row.periodStart || row.date;
    const expEnd   = row.periodEnd   || row.date;
    if (row.value > 0) {
      if (!expEarliest || expStart < expEarliest) expEarliest = expStart;
      if (!expLatest   || expEnd   > expLatest)   expLatest   = expEnd;
    }
  }
  // ── Partnership ledger — separate tracking for Time Bank + breakdown ────────
  const partnerInRows = rows.filter((r) => r.entryType === 'partner_in');
  const partnerOutRows = rows.filter((r) => r.entryType === 'partner_out');
  const totalPartnerIn = round2(partnerInRows.reduce((s, r) => s + r.value, 0));
  const totalPartnerOut = round2(partnerOutRows.reduce((s, r) => s + r.value, 0));

  // FIREWALL: partner_out does NOT add to totalExpenses.
  // Survival goals are based purely on operational expenses.

  totalExpenses = round2(totalExpenses);
  // annualExpenses = totalExpenses at the global level;
  // per-year breakdown lives in byYear[yr].yearExpenses
  const annualExpenses = totalExpenses;

  // ── Survival / Break-Even Goals (always computed) ──────────────────────────
  const globalExpenseDaySpan = (expEarliest && expLatest)
    ? Math.max(1, calendarDaySpan(expEarliest, expLatest))
    : 0;
  const survivalDaily = globalExpenseDaySpan > 0 ? round2(totalExpenses / globalExpenseDaySpan) : 0;
  const survivalWeekly      = round2(survivalDaily * 7);
  const survivalMonthly     = round2(survivalDaily * 30.44);
  const survivalAnnualCost  = round2(survivalDaily * 365.25);

  const survivalFields = { survivalDaily, survivalWeekly, survivalMonthly, survivalAnnualCost };

  // ── Investment / Deposit compound interest (0.8%/month CDI reference) ──────
  const MONTHLY_RATE = 0.008;
  const depositRows = rows.filter((r) => r.entryType === 'deposit' && r.value > 0);
  const depositCount = depositRows.length;

  // Group deposits by YYYY-MM
  const depositByMonth: Record<string, number> = {};
  for (const row of depositRows) {
    const ym = row.date.slice(0, 7);
    depositByMonth[ym] = (depositByMonth[ym] ?? 0) + row.value;
  }
  const sortedDepositMonths = Object.entries(depositByMonth).sort(([a], [b]) => a.localeCompare(b));

  let investRunning = 0;
  let totalInvested = 0;
  let totalInterestEarned = 0;
  for (const [, rawDeposit] of sortedDepositMonths) {
    const monthYield = round2(investRunning * MONTHLY_RATE);
    totalInterestEarned += monthYield;
    totalInvested += rawDeposit;
    investRunning = round2(investRunning + monthYield + rawDeposit);
  }
  totalInvested = round2(totalInvested);
  totalInterestEarned = round2(totalInterestEarned);
  const investmentBalance = round2(investRunning);

  const investFields = { depositCount, totalInvested, totalInterestEarned, investmentBalance };

  // ── Advanced Statistics (revenue rows only, excludes partner_in/out, value > 0) ─
  const positiveRevenueValues = rows
    .filter((r) => r.entryType !== 'deposit' && r.entryType !== 'waiver' && r.entryType !== 'expense' && r.entryType !== 'partner_out' && r.entryType !== 'partner_in' && r.value > 0)
    .map((r) => r.value);

  let statsFields: { maxTransaction: number; minTransaction: number; medianTransaction: number; modeTransaction: number; stdDeviation: number };

  if (positiveRevenueValues.length === 0) {
    statsFields = { maxTransaction: 0, minTransaction: 0, medianTransaction: 0, modeTransaction: 0, stdDeviation: 0 };
  } else {
    const sorted = [...positiveRevenueValues].sort((a, b) => a - b);
    const n = sorted.length;
    const maxTransaction = round2(sorted[n - 1]);
    const minTransaction = round2(sorted[0]);

    // Median
    const medianTransaction = n % 2 === 1
      ? round2(sorted[Math.floor(n / 2)])
      : round2((sorted[n / 2 - 1] + sorted[n / 2]) / 2);

    // Mode (most frequent value)
    const freqMap = new Map<number, number>();
    for (const v of positiveRevenueValues) {
      freqMap.set(v, (freqMap.get(v) ?? 0) + 1);
    }
    let modeTransaction = 0;
    let maxFreq = 1; // need at least 2 occurrences to have a mode
    for (const [val, freq] of freqMap) {
      if (freq > maxFreq) {
        maxFreq = freq;
        modeTransaction = val;
      }
    }
    modeTransaction = round2(modeTransaction);

    // Population standard deviation
    const mean = positiveRevenueValues.reduce((s, v) => s + v, 0) / n;
    const variance = positiveRevenueValues.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stdDeviation = round2(Math.sqrt(variance));

    statsFields = { maxTransaction, minTransaction, medianTransaction, modeTransaction, stdDeviation };
  }

  if (revenueRows.length === 0) {
    return { ...emptyMetrics(), totalExpenses, annualExpenses, ...survivalFields, ...investFields, ...statsFields };
  }

  const activeRows = revenueRows.filter((r) => r.value > 0);
  if (activeRows.length === 0) return { ...emptyMetrics(), totalExpenses, annualExpenses, ...survivalFields, ...investFields, ...statsFields };

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
  let grossTotalWeeks = 0; // historically-accumulated week equivalent

  const byYearAcc: Record<string, {
    gross: number;
    dates: string[];
    months: Set<string>;
    weeks: Set<string>;
  }> = {};

  const byMonthAcc: Record<string, {
    gross: number;
    payments: Record<string, number>;
    weeks: Set<string>;
  }> = {};

  const byWeekAcc: Record<string, number> = {};

  // ── Single-pass over active rows ──────────────────────────────────────────────
  // grossTotal accumulates full row.value (total earned).
  // byYear, byMonth, byWeek all use rowContributions() so period entries are
  // spread proportionally across their date span.
  for (const row of activeRows) {
    grossTotal += row.value;

    // Accumulate historically-correct week equivalent
    const activeWeeklyGoal = getWeeklyGoalForDate(row.date, goals);
    if (activeWeeklyGoal > 0) {
      grossTotalWeeks += row.value / activeWeeklyGoal;
    }

    // Distribute value across daily contributions into year, month, and week
    for (const contrib of rowContributions(row)) {
      const cYearStr  = contrib.date.slice(0, 4);
      const yearMonth = contrib.date.slice(0, 7);
      const isoWeek   = getISOWeekKey(contrib.date);

      // byYear
      if (!byYearAcc[cYearStr]) {
        byYearAcc[cYearStr] = { gross: 0, dates: [], months: new Set(), weeks: new Set() };
      }
      byYearAcc[cYearStr].gross += contrib.value;
      byYearAcc[cYearStr].dates.push(contrib.date);
      byYearAcc[cYearStr].months.add(yearMonth);
      byYearAcc[cYearStr].weeks.add(isoWeek);

      // byMonth
      if (!byMonthAcc[yearMonth]) {
        byMonthAcc[yearMonth] = { gross: 0, payments: {}, weeks: new Set() };
      }
      byMonthAcc[yearMonth].gross += contrib.value;
      byMonthAcc[yearMonth].payments[contrib.date] =
        (byMonthAcc[yearMonth].payments[contrib.date] ?? 0) + contrib.value;
      byMonthAcc[yearMonth].weeks.add(isoWeek);

      // byWeek
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
    const sortedDates = [...new Set(acc.dates)].sort();
    const span = Math.max(1, calendarDaySpan(sortedDates[0], sortedDates[sortedDates.length - 1]));
    const dailyAvg = round2(acc.gross / span);
    const yearNum  = parseInt(yr, 10);
    byYear[yr] = {
      grossAnnual:  round2(acc.gross),
      yearExpenses: computeYearExpenses(expenseRows, yearNum),
      dailyAvg,
      weeklyAvg:  round2(acc.gross / Math.max(1, acc.weeks.size)),
      monthlyAvg: round2(acc.gross / Math.max(1, acc.months.size)),
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
    calculateStrictGlobalBalance(revenueRows, goals, asOfDate ? today : undefined);

  // ── Waiver credits — derived directly from 'waiver' ledger rows ─────────
  // Strictly monetary values.
  let totalWaiverCredits = 0;
  let totalWaivedDays = 0;
  let waiverTotalWeeks = 0; // historically-accumulated week equivalent for waivers
  const waiverRows = rows.filter((r) => r.entryType === 'waiver' && r.value > 0);

  for (const row of waiverRows) {
    totalWaiverCredits += row.value;
    // Accumulate historically-correct week equivalent for waivers
    const activeWeeklyGoal = getWeeklyGoalForDate(row.date, goals);
    if (activeWeeklyGoal > 0) {
      waiverTotalWeeks += row.value / activeWeeklyGoal;
    }
  }

  // FIREWALL Goal Balance: add partner_in credit since it no longer flows through rawStrictBalance
  const globalGoalBalance = Math.round((rawStrictBalance + totalWaiverCredits + totalPartnerIn - totalPartnerOut) * 100) / 100;
  const waivedWeeks = Math.round((totalWaivedDays / 7) * 100) / 100;
  const billableWeeks = Math.round((totalElapsedWeeks - waivedWeeks) * 100) / 100;

  // ── Time Bank balance (weeks) ─────────────────────────────────────────────
  // Uses the historically-accumulated netBalanceWeeks instead of a naive
  // flat division (globalGoalBalance / currentWeeklyGoal).
  // netBalanceWeeks = grossTotalWeeks + waiverTotalWeeks − goalTotalWeeks
  // and is computed below after the week equivalents are finalized.

  // ── Net balance (cash position after expenses — pure operational) ──────────
  const netBalance = round2(grossTotal - totalExpenses);

  // ── Historically-Accumulated Week Equivalents ──────────────────────────────
  grossTotalWeeks  = round2(grossTotalWeeks);
  waiverTotalWeeks = round2(waiverTotalWeeks);
  const goalTotalWeeks   = totalElapsedWeeks; // 1 calendar week = 1 goal-week
  const netBalanceWeeks  = round2(grossTotalWeeks + waiverTotalWeeks - goalTotalWeeks);

  // timeBankBalance now equals the historically-accumulated netBalanceWeeks.
  const timeBankBalance = netBalanceWeeks;

  // ── Combined metrics (operational + partnership) ──────────────────────────
  const grossWithPartner = round2(grossTotal + totalPartnerIn);
  const expensesWithPartner = round2(totalExpenses + totalPartnerOut);
  const netWithPartner = round2(grossWithPartner - expensesWithPartner);

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
    ...survivalFields,
    ...investFields,
    ...statsFields,
    totalPartnerIn,
    totalPartnerOut,
    grossWithPartner,
    expensesWithPartner,
    netWithPartner,
    grossTotalWeeks,
    waiverTotalWeeks,
    goalTotalWeeks,
    netBalanceWeeks,
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

/**
 * Year-scoped expense allocation with proper overlap logic.
 *
 * - Point-in-time expenses (start === end): full value if date falls in year.
 * - Multi-period expenses: dailyRate × overlapDays with this year.
 */
function computeYearExpenses(expenseRows: TableRow[], year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;
  let total = 0;

  for (const row of expenseRows) {
    if (row.value <= 0) continue;
    const start = row.periodStart || row.date;
    const end   = row.periodEnd   || row.date;

    // No overlap with this year at all
    if (start > yearEnd || end < yearStart) continue;

    if (start === end) {
      // Point-in-time expense — full value
      total += row.value;
    } else {
      // Multi-period: prorate by overlap days
      const totalDays   = Math.max(1, calendarDaySpan(start, end));
      const overlapStart = start < yearStart ? yearStart : start;
      const overlapEnd   = end   > yearEnd   ? yearEnd   : end;
      const overlapDays  = Math.max(1, calendarDaySpan(overlapStart, overlapEnd));
      total += (row.value / totalDays) * overlapDays;
    }
  }
  return round2(total);
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
    survivalDaily: 0,
    survivalWeekly: 0,
    survivalMonthly: 0,
    survivalAnnualCost: 0,
    depositCount: 0,
    totalInvested: 0,
    totalInterestEarned: 0,
    investmentBalance: 0,
    maxTransaction: 0,
    minTransaction: 0,
    medianTransaction: 0,
    modeTransaction: 0,
    stdDeviation: 0,
    totalPartnerIn: 0,
    totalPartnerOut: 0,
    grossWithPartner: 0,
    expensesWithPartner: 0,
    netWithPartner: 0,
    grossTotalWeeks: 0,
    waiverTotalWeeks: 0,
    goalTotalWeeks: 0,
    netBalanceWeeks: 0,
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
