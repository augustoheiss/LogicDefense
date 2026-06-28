/**
 * Metrics Engine — Assistente Moeda (React Native)
 *
 * Pure mathematical/business logic for computing all financial metrics.
 * ZERO React dependencies — no useMemo, useState, or hooks.
 *
 * Migrated from web CoinAssistant's useMetricsEngine.ts with import paths
 * updated to use local ./types and ./dateUtils modules.
 *
 * Key invariants:
 *  - grossTotal is always the sum of rows with value > 0 only.
 *  - ALL averages are based on calendar days / elapsed time, never "active day count".
 *  - globalWeeklyAvg  = globalDailyAvg × 7
 *  - globalMonthlyAvg = globalDailyAvg × 30.44
 *  - globalAnnualAvg  = globalDailyAvg × 365.25
 *  - timeBankBalance = grossTotalWeeks + waiverTotalWeeks − goalTotalWeeks
 */

import type { TableRow, TableGoals, TableMetrics, MonthMetrics, YearMetrics } from './types';
import {
  calculateStrictGlobalBalance,
  getWeeklyGoalForDate,
  toLocalKey,
} from './dateUtils';

export function computeMetrics(
  rows: TableRow[],
  goals: TableGoals,
  /** When set, the engine treats this date as "today" for all calculations. */
  asOfDate?: string,
): TableMetrics {
  if (rows.length === 0) return emptyMetrics();

  // Find all YYYY-MM months in the entire rows dataset (including ranges) to populate byMonthAcc
  const allMonths = new Set<string>();
  for (const r of rows) {
    const start = r.periodStart || r.date;
    const end = r.periodEnd || r.date;
    const startYM = start.slice(0, 7);
    const endYM = end.slice(0, 7);
    
    const [startY, startM] = startYM.split('-').map(Number);
    const [endY, endM] = endYM.split('-').map(Number);
    
    let currY = startY;
    let currM = startM;
    while (currY < endY || (currY === endY && currM <= endM)) {
      allMonths.add(`${currY}-${String(currM).padStart(2, '0')}`);
      currM++;
      if (currM > 12) {
        currM = 1;
        currY++;
      }
    }
  }

  // ── Prorated monthly calculations for deposits and expenses ─────────────────
  const depositRows = rows.filter((r) => r.entryType === 'deposit' && r.value > 0);
  const expenseRows = rows.filter((r) => r.entryType === 'expense');

  const depositByMonth: Record<string, number> = {};
  for (const row of depositRows) {
    for (const contrib of rowContributions(row)) {
      const ym = contrib.date.slice(0, 7);
      depositByMonth[ym] = (depositByMonth[ym] ?? 0) + contrib.value;
    }
  }

  const monthlyExpenses: Record<string, number> = {};
  for (const row of expenseRows) {
    for (const contrib of rowContributions(row)) {
      const ym = contrib.date.slice(0, 7);
      monthlyExpenses[ym] = (monthlyExpenses[ym] ?? 0) + contrib.value;
    }
  }

  // FIREWALL: partner_in and partner_out are isolated from operational revenue.
  const revenueRows = rows.filter(
    (r) => r.entryType !== 'deposit' && r.entryType !== 'waiver' && r.entryType !== 'expense' && r.entryType !== 'partner_out' && r.entryType !== 'partner_in',
  );

  // ── Expense metrics ───────────────────────────────────────────────────────
  let totalExpenses = 0;
  let expEarliest = '';
  let expLatest   = '';

  for (const row of expenseRows) {
    totalExpenses += row.value;
    const expStart = row.periodStart || row.date;
    const expEnd   = row.periodEnd   || row.date;
    if (row.value > 0) {
      if (!expEarliest || expStart < expEarliest) expEarliest = expStart;
      if (!expLatest   || expEnd   > expLatest)   expLatest   = expEnd;
    }
  }

  // ── Partnership ledger ────────────────────────────────────────────────────
  const partnerInRows = rows.filter((r) => r.entryType === 'partner_in');
  const partnerOutRows = rows.filter((r) => r.entryType === 'partner_out');
  const totalPartnerIn = round2(partnerInRows.reduce((s, r) => s + r.value, 0));
  const totalPartnerOut = round2(partnerOutRows.reduce((s, r) => s + r.value, 0));

  totalExpenses = round2(totalExpenses);
  const annualExpenses = totalExpenses;

  // ── Survival / Break-Even Goals ──────────────────────────────────────────
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
  const allYMs = Array.from(allMonths).sort();
  let earliestInvestMonth = '';
  for (const ym of allYMs) {
    if ((depositByMonth[ym] ?? 0) > 0) {
      earliestInvestMonth = ym;
      break;
    }
  }

  let portfolioTimeline: Array<{
    month: string;
    monthlyDeposit: number;
    currentMonthYield: number;
    accumulatedPrincipal: number;
    accumulatedYield: number;
    totalBalance: number;
  }> = [];

  let globalTotalDeposited = 0;
  let globalTotalYield = 0;
  let globalBalance = 0;

  if (earliestInvestMonth) {
    const latestMonth = allYMs[allYMs.length - 1] || earliestInvestMonth;
    const consecutiveMonths = getConsecutiveMonths(earliestInvestMonth, latestMonth);

    let accumulatedPrincipal = 0;
    let accumulatedYield = 0;

    for (const ym of consecutiveMonths) {
      const monthlyDeposit = depositByMonth[ym] ?? 0;
      const currentMonthYield = round2((accumulatedPrincipal + accumulatedYield) * MONTHLY_RATE);
      accumulatedYield = round2(accumulatedYield + currentMonthYield);
      accumulatedPrincipal = round2(accumulatedPrincipal + monthlyDeposit);
      const totalBalance = round2(accumulatedPrincipal + accumulatedYield);

      portfolioTimeline.push({
        month: ym,
        monthlyDeposit: round2(monthlyDeposit),
        currentMonthYield,
        accumulatedPrincipal,
        accumulatedYield,
        totalBalance,
      });
    }

    globalTotalDeposited = accumulatedPrincipal;
    globalTotalYield = accumulatedYield;
    globalBalance = accumulatedPrincipal + accumulatedYield;
  }

  const depositCount = depositRows.length;
  const totalInvested = globalTotalDeposited;
  const totalInterestEarned = globalTotalYield;
  const investmentBalance = globalBalance;

  const investFields = {
    depositCount, totalInvested, totalInterestEarned, investmentBalance,
    globalTotalDeposited, globalTotalYield, globalBalance, portfolioTimeline,
  };

  // ── Advanced Statistics ───────────────────────────────────────────────────
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
    const medianTransaction = n % 2 === 1
      ? round2(sorted[Math.floor(n / 2)])
      : round2((sorted[n / 2 - 1] + sorted[n / 2]) / 2);

    const freqMap = new Map<number, number>();
    for (const v of positiveRevenueValues) {
      freqMap.set(v, (freqMap.get(v) ?? 0) + 1);
    }
    let modeTransaction = 0;
    let maxFreq = 1;
    for (const [val, freq] of freqMap) {
      if (freq > maxFreq) {
        maxFreq = freq;
        modeTransaction = val;
      }
    }
    modeTransaction = round2(modeTransaction);

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

  // ── Global date span ────────────────────────────────────────────────────
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

  const today = asOfDate
    ? new Date(asOfDate + 'T12:00:00')
    : new Date();
  const todayYM = isoYearMonth(today);
  const todayDayOfMonth = today.getDate();

  // ── Accumulators ─────────────────────────────────────────────────────────
  let grossTotal = 0;
  let grossTotalWeeks = 0;

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

  for (const ym of allMonths) {
    byMonthAcc[ym] = { gross: 0, payments: {}, weeks: new Set() };
  }

  const byWeekAcc: Record<string, number> = {};

  for (const row of activeRows) {
    grossTotal += row.value;

    const activeWeeklyGoal = getWeeklyGoalForDate(row.date, goals);
    if (activeWeeklyGoal > 0) {
      grossTotalWeeks += row.value / activeWeeklyGoal;
    }

    for (const contrib of rowContributions(row)) {
      const cYearStr  = contrib.date.slice(0, 4);
      const yearMonth = contrib.date.slice(0, 7);
      const isoWeek   = getISOWeekKey(contrib.date);

      if (!byYearAcc[cYearStr]) {
        byYearAcc[cYearStr] = { gross: 0, dates: [], months: new Set(), weeks: new Set() };
      }
      byYearAcc[cYearStr].gross += contrib.value;
      byYearAcc[cYearStr].dates.push(contrib.date);
      byYearAcc[cYearStr].months.add(yearMonth);
      byYearAcc[cYearStr].weeks.add(isoWeek);

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

  // ── Global averages ───────────────────────────────────────────────────────
  let totalDailyRate = 0;
  for (const row of activeRows) {
    if (row.periodStart && row.periodEnd) {
      const txDays = Math.max(1, calendarDaySpan(row.periodStart, row.periodEnd));
      totalDailyRate += (row.value / txDays);
    } else {
      totalDailyRate += (row.value / globalSpanDays);
    }
  }
  const globalDailyAvg   = round2(totalDailyRate);
  const globalWeeklyAvg  = round2(globalDailyAvg * 7);
  const globalMonthlyAvg = round2(globalDailyAvg * 30.44);
  const globalAnnualAvg  = round2(globalDailyAvg * 365.25);

  // ── Per-year metrics ──────────────────────────────────────────────────────
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

  // ── Per-month metrics ─────────────────────────────────────────────────────
  const byMonth: Record<string, MonthMetrics> = {};
  for (const [ym, acc] of Object.entries(byMonthAcc)) {
    const [ymYearStr, ymMonthStr] = ym.split('-');
    const ymYear  = parseInt(ymYearStr, 10);
    const ymMonth = parseInt(ymMonthStr, 10);

    const denominator = ym === todayYM
      ? Math.max(1, todayDayOfMonth)
      : Math.max(1, daysInMonth(ymYear, ymMonth));

    const dailyAvg = round2(acc.gross / denominator);

    const weeklyAvg = ym === todayYM
      ? round2(acc.gross / Math.max(1, Math.ceil(todayDayOfMonth / 7)))
      : round2(dailyAvg * 7);

    const sortedWeeks = Array.from(acc.weeks).sort();
    const lastWeek = sortedWeeks[sortedWeeks.length - 1] ?? '';
    const lastWeekGross = lastWeek ? round2(byWeekAcc[lastWeek] ?? 0) : 0;

    byMonth[ym] = {
      grossMonthly: round2(acc.gross),
      dailyAvg,
      weeklyAvg,
      lastWeekGross,
      dailyPayments: acc.payments,
      investment: round2(depositByMonth[ym] ?? 0),
      expense: round2(monthlyExpenses[ym] ?? 0),
    };
  }

  // ── Week totals ───────────────────────────────────────────────────────────
  const byWeek: Record<string, number> = {};
  for (const [wk, v] of Object.entries(byWeekAcc)) {
    byWeek[wk] = round2(v);
  }

  // ── Strict cumulative BRL balance ─────────────────────────────────────────
  const { balance: rawStrictBalance, elapsedWeeks: totalElapsedWeeks } =
    calculateStrictGlobalBalance(revenueRows, goals, asOfDate ? today : undefined);

  // ── Waiver credits ─────────────────────────────────────────────────────────
  let totalWaiverCredits = 0;
  let totalWaivedDays = 0;
  let waiverTotalWeeks = 0;
  const waiverRows = rows.filter((r) => r.entryType === 'waiver' && r.value > 0);

  for (const row of waiverRows) {
    totalWaiverCredits += row.value;
    const activeWeeklyGoal = getWeeklyGoalForDate(row.date, goals);
    if (activeWeeklyGoal > 0) {
      waiverTotalWeeks += row.value / activeWeeklyGoal;
    }
  }

  const globalGoalBalance = Math.round((rawStrictBalance + totalWaiverCredits + totalPartnerIn - totalPartnerOut) * 100) / 100;
  const waivedWeeks = Math.round((totalWaivedDays / 7) * 100) / 100;
  const billableWeeks = Math.round((totalElapsedWeeks - waivedWeeks) * 100) / 100;

  // ── Net balance ───────────────────────────────────────────────────────────
  const netBalance = round2(grossTotal - totalExpenses);

  // ── Historically-Accumulated Week Equivalents ──────────────────────────────
  grossTotalWeeks  = round2(grossTotalWeeks);
  waiverTotalWeeks = round2(waiverTotalWeeks);
  const goalTotalWeeks   = totalElapsedWeeks;
  const netBalanceWeeks  = round2(grossTotalWeeks + waiverTotalWeeks - goalTotalWeeks);

  // Time Bank balance is calculated strictly as: globalGoalBalance / currentWeeklyGoal
  const targetDateKey = asOfDate || toLocalKey(today);
  const currentWeeklyGoal = getWeeklyGoalForDate(targetDateKey, goals);
  const timeBankBalance = currentWeeklyGoal > 0
    ? Math.round((globalGoalBalance / currentWeeklyGoal) * 100) / 100
    : 0;

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

function calendarDaySpan(dateA: string, dateB: string): number {
  const msPerDay = 86_400_000;
  const a = new Date(dateA + 'T12:00:00').getTime();
  const b = new Date(dateB + 'T12:00:00').getTime();
  return Math.round(Math.abs(b - a) / msPerDay) + 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isoYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getISOWeekKey(dateStr: string): string {
  const d = new Date(
    Date.UTC(
      parseInt(dateStr.slice(0, 4), 10),
      parseInt(dateStr.slice(5, 7), 10) - 1,
      parseInt(dateStr.slice(8, 10), 10),
    ),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function computeYearExpenses(expenseRows: TableRow[], year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;
  let total = 0;

  for (const row of expenseRows) {
    if (row.value <= 0) continue;
    const start = row.periodStart || row.date;
    const end   = row.periodEnd   || row.date;

    if (start > yearEnd || end < yearStart) continue;

    if (start === end) {
      total += row.value;
    } else {
      const totalDays   = Math.max(1, calendarDaySpan(start, end));
      const overlapStart = start < yearStart ? yearStart : start;
      const overlapEnd   = end   > yearEnd   ? yearEnd   : end;
      const overlapDays  = Math.max(1, calendarDaySpan(overlapStart, overlapEnd));
      total += (row.value / totalDays) * overlapDays;
    }
  }
  return round2(total);
}

export function emptyMetrics(): TableMetrics {
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
    globalTotalDeposited: 0,
    globalTotalYield: 0,
    globalBalance: 0,
    portfolioTimeline: [],
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

function getConsecutiveMonths(startYM: string, endYM: string): string[] {
  const [startY, startM] = startYM.split('-').map(Number);
  const [endY, endM] = endYM.split('-').map(Number);
  const result: string[] = [];
  let currY = startY;
  let currM = startM;

  while (currY < endY || (currY === endY && currM <= endM)) {
    result.push(`${currY}-${String(currM).padStart(2, '0')}`);
    currM++;
    if (currM > 12) {
      currM = 1;
      currY++;
    }
  }
  return result;
}

// ── Period distribution helper ──────────────────────────────────────────────

/**
 * Returns a list of daily contribution objects for a row.
 *
 * Period rows: Distributes row.value / periodDays to each calendar day.
 * Single-day rows: Returns a single entry with full row.value at row.date.
 */
export function rowContributions(row: TableRow): Array<{ date: string; value: number }> {
  if (row.periodStart && row.periodEnd && row.periodStart !== row.periodEnd) {
    const msPerDay = 86_400_000;
    const startMs  = new Date(row.periodStart + 'T12:00:00').getTime();
    const endMs    = new Date(row.periodEnd   + 'T12:00:00').getTime();
    if (endMs < startMs) return [{ date: row.date, value: row.value }];

    const periodDays = Math.max(1, Math.round((endMs - startMs) / msPerDay) + 1);
    const dailyValue = row.value / periodDays;
    const contributions: Array<{ date: string; value: number }> = [];

    for (let ms = startMs; ms <= endMs; ms += msPerDay) {
      contributions.push({ date: new Date(ms).toISOString().slice(0, 10), value: dailyValue });
    }
    return contributions;
  }
  return [{ date: row.date, value: row.value }];
}
