/**
 * Date utilities for CoinAssistant — migrated to React Native.
 * All functions are pure, with ZERO browser/DOM dependencies.
 * Import path updated from '../types' to './types'.
 */

import type { TableRow, TableGoals, GoalProfile } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeekGroup {
  weekStartDate: Date;
  weekEndDate: Date;
  dailyEntries: TableRow[];
  weeklyTotal: number;
  differenceFromGoal: number;
}

export interface MonthCompetenceWeekGroup extends WeekGroup {
  weekIndex: number;
  weekNumber: number;
  clippedStartDate: Date;
  clippedEndDate: Date;
  mondayKey: string;
  sundayKey: string;
  clippedStartKey: string;
  clippedEndKey: string;
  weeklyGoal: number;
}

export interface EffectivePeriodSpan {
  effectiveSpanDays: number;
  activeMonthsCount: number;
  avgDaysPerActiveMonth: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getMondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const distanceToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - distanceToMonday);
  return d;
}

export function getSundayOf(monday: Date): Date {
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
}

export function toLocalKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function fmtDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function resolveGoalForYear(
  goals: Record<number | string, number>,
  year: number,
): number {
  if (goals[year] !== undefined) return goals[year];
  const years = Object.keys(goals)
    .map(Number)
    .filter((k) => !isNaN(k))
    .sort((a, b) => a - b);
  if (years.length === 0) return 0;
  const earlier = years.filter((y) => y < year);
  if (earlier.length > 0) return goals[earlier[earlier.length - 1]];
  return goals[years[0]];
}

export function getISOWeekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getEffectiveGoals(
  scope: { year: number; month?: number } | 'global',
  goals: TableGoals,
): GoalProfile {
  if (!goals) {
    return { dailyGoal: 0, weeklyGoal: 0, annualCost: 0 };
  }
  if (scope !== 'global' && scope.month !== undefined) {
    const monthKey = `${scope.year}-${String(scope.month).padStart(2, '0')}`;
    const monthly = goals.monthlyGoals?.[monthKey];
    if (monthly) return {
      dailyGoal: monthly.dailyGoal ?? 0,
      weeklyGoal: monthly.weeklyGoal ?? 0,
      annualCost: monthly.annualCost ?? 0,
    };
  }
  if (scope !== 'global') {
    const yearly = goals.yearlyGoals?.[scope.year];
    if (yearly) return {
      dailyGoal: yearly.dailyGoal ?? 0,
      weeklyGoal: yearly.weeklyGoal ?? 0,
      annualCost: yearly.annualCost ?? 0,
    };
  }
  if (goals.globalGoals) return {
    dailyGoal: goals.globalGoals.dailyGoal ?? 0,
    weeklyGoal: goals.globalGoals.weeklyGoal ?? 0,
    annualCost: goals.globalGoals.annualCost ?? 0,
  };
  const year = scope === 'global' ? new Date().getFullYear() : scope.year;
  return {
    dailyGoal:  resolveGoalForYear(goals.dailyGoals || {},  year) ?? 0,
    weeklyGoal: resolveGoalForYear(goals.weeklyGoals || {}, year) ?? 0,
    annualCost: resolveGoalForYear(goals.annualCosts || {}, year) ?? 0,
  };
}

export function getWeeklyGoalForDate(dateStr: string, goals: TableGoals): number {
  const weekKey = getISOWeekKey(dateStr);
  if (goals.weeklyGoals && goals.weeklyGoals[weekKey] !== undefined) {
    return goals.weeklyGoals[weekKey];
  }
  const year  = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  return getEffectiveGoals({ year, month }, goals).weeklyGoal;
}

export function getDailyGoalForDate(dateStr: string, goals: TableGoals): number {
  const weekKey = getISOWeekKey(dateStr);
  if (goals.weeklyGoals && goals.weeklyGoals[weekKey] !== undefined) {
    return goals.weeklyGoals[weekKey] / 7;
  }
  const year  = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  return getEffectiveGoals({ year, month }, goals).dailyGoal;
}

export function groupRowsByWeek(
  rows: TableRow[],
  goals: TableGoals,
): WeekGroup[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const weekMap = new Map<string, TableRow[]>();
  for (const row of sorted) {
    const [y, mo, d] = row.date.split('-').map(Number);
    const rowDate = new Date(y, mo - 1, d);
    const monday  = getMondayOf(rowDate);
    const key     = toLocalKey(monday);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(row);
  }
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mondayStr, entries]) => {
      const [y, mo, d] = mondayStr.split('-').map(Number);
      const monday      = new Date(y, mo - 1, d);
      const sunday      = getSundayOf(monday);
      const weeklyTotal = entries.reduce((sum, r) => sum + r.value, 0);
      const sundayKey   = toLocalKey(sunday);
      const weekGoal    = getWeeklyGoalForDate(sundayKey, goals);
      return {
        weekStartDate:      monday,
        weekEndDate:        sunday,
        dailyEntries:       [...entries].sort((a, b) => a.date.localeCompare(b.date)),
        weeklyTotal,
        differenceFromGoal: weeklyTotal - weekGoal,
      };
    });
}

export function findCurrentWeek(
  groups: WeekGroup[],
  referenceDate: Date = new Date(),
): WeekGroup | null {
  if (groups.length === 0) return null;
  const ref = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  return (
    groups.find((g) => ref >= g.weekStartDate && ref <= g.weekEndDate) ??
    groups[groups.length - 1]
  );
}

export function calculateStrictGlobalBalance(
  rows: TableRow[],
  goals: TableGoals,
  asOfDate?: Date,
): { balance: number; elapsedWeeks: number } {
  const activeRows = rows.filter((r) => r.value > 0);
  if (activeRows.length === 0) return { balance: 0, elapsedWeeks: 0 };

  const minDate = activeRows.map((r) => r.periodStart ?? r.date).sort()[0];
  const [minY, minMo, minD] = minDate.split('-').map(Number);
  const startOfTimeline = getMondayOf(new Date(minY, minMo - 1, minD));
  const refDate = asOfDate ?? new Date();
  const endOfTimeline = getMondayOf(
    new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()),
  );

  const msPerDay = 86_400_000;
  const dateValueMap = new Map<string, number>();
  for (const row of activeRows) {
    if (row.periodStart && row.periodEnd) {
      const startMs  = new Date(row.periodStart + 'T12:00:00').getTime();
      const endMs    = new Date(row.periodEnd   + 'T12:00:00').getTime();
      const periodDays = Math.max(1, Math.round((endMs - startMs) / msPerDay) + 1);
      const dailyValue = row.value / periodDays;
      for (let ms = startMs; ms <= endMs; ms += msPerDay) {
        const dayKey = toLocalKey(new Date(ms));
        dateValueMap.set(dayKey, (dateValueMap.get(dayKey) ?? 0) + dailyValue);
      }
    } else {
      dateValueMap.set(row.date, (dateValueMap.get(row.date) ?? 0) + row.value);
    }
  }

  let totalBalance = 0;
  let elapsedWeeksCount = 0;
  let cursor = new Date(
    startOfTimeline.getFullYear(),
    startOfTimeline.getMonth(),
    startOfTimeline.getDate(),
  );

  while (cursor.getTime() <= endOfTimeline.getTime()) {
    let weekSum = 0;
    for (let i = 0; i < 7; i++) {
      const dayKey = toLocalKey(
        new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i),
      );
      weekSum += dateValueMap.get(dayKey) ?? 0;
    }
    const sunday    = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);
    const sundayKey = toLocalKey(sunday);
    const weekGoal  = getWeeklyGoalForDate(sundayKey, goals);
    totalBalance   += weekSum - weekGoal;
    elapsedWeeksCount++;
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 7,
    );
  }

  return {
    balance:      Math.round(totalBalance * 100) / 100,
    elapsedWeeks: elapsedWeeksCount,
  };
}

export function calculateTimeBankBalance(
  rows: TableRow[],
  grossTotal: number,
  effectiveWeeklyGoal: number,
): number {
  if (effectiveWeeklyGoal <= 0 || grossTotal <= 0) return 0;
  const activeRows = rows.filter((r) => r.value > 0);
  if (activeRows.length === 0) return 0;
  const minDateStr = activeRows.map((r) => r.date).sort()[0];
  const [minY, minMo, minD] = minDateStr.split('-').map(Number);
  const minDate = new Date(minY, minMo - 1, minD);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const elapsedMs = todayMidnight.getTime() - minDate.getTime();
  const elapsedWeeks = Math.floor(Math.max(0, elapsedMs) / msPerWeek);
  const paidWeeks = grossTotal / effectiveWeeklyGoal;
  const balance = paidWeeks - elapsedWeeks;
  return Math.round(balance * 100) / 100;
}

/**
 * Returns a list of daily contribution objects for a row.
 *
 * Period rows: Distributes row.value / periodDays to each calendar day.
 * Single-day rows: Returns a single entry with full row.value at row.date.
 */
export function rowContributions(row: TableRow): Array<{ date: string; value: number }> {
  if (!row) return [];
  const val = typeof row.value === 'number' && !isNaN(row.value) ? row.value : 0;
  const d = typeof row.date === 'string' ? row.date : new Date().toISOString().slice(0, 10);

  if (row.periodStart && row.periodEnd && row.periodStart !== row.periodEnd) {
    const msPerDay = 86_400_000;
    const startMs  = new Date(row.periodStart + 'T12:00:00').getTime();
    const endMs    = new Date(row.periodEnd   + 'T12:00:00').getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return [{ date: d, value: val }];

    const periodDays = Math.max(1, Math.round((endMs - startMs) / msPerDay) + 1);
    const dailyValue = val / periodDays;
    const contributions: Array<{ date: string; value: number }> = [];

    for (let ms = startMs; ms <= endMs; ms += msPerDay) {
      contributions.push({ date: new Date(ms).toISOString().slice(0, 10), value: dailyValue });
    }
    return contributions;
  }
  return [{ date: d, value: val }];
}

/**
 * Computes the Full Monthly Competence Envelope (Precision Lock 1):
 * Sums the calendar days (`daysInMonth(YYYY, MM)`) of all distinct active months,
 * never including empty intermediate gap months and never dividing fixed point
 * entries of the current month by partial elapsed days.
 */
export function getEffectivePeriodSpanDays(activeMonths: Iterable<string>): EffectivePeriodSpan {
  const uniqueMonths = new Set<string>();
  for (const ym of activeMonths) {
    if (typeof ym === 'string' && /^\d{4}-\d{2}$/.test(ym)) {
      uniqueMonths.add(ym);
    }
  }
  const activeMonthsCount = uniqueMonths.size;
  if (activeMonthsCount === 0) {
    return {
      effectiveSpanDays: 0,
      activeMonthsCount: 0,
      avgDaysPerActiveMonth: 30.44,
    };
  }
  let effectiveSpanDays = 0;
  for (const ym of uniqueMonths) {
    const [y, m] = ym.split('-').map(Number);
    effectiveSpanDays += daysInMonth(y, m);
  }
  return {
    effectiveSpanDays,
    activeMonthsCount,
    avgDaysPerActiveMonth: effectiveSpanDays / activeMonthsCount,
  };
}

/**
 * Extracts active competence months from a list of rows (using `rowContributions`)
 * with optional year (`YYYY`) or month (`YYYY-MM`) filtering, and returns the
 * Full Monthly Competence Envelope (`EffectivePeriodSpan`).
 */
export function computeActiveMonthsSpan(
  rows: TableRow[],
  filterYear?: string,
  filterMonth?: string,
): EffectivePeriodSpan {
  const activeMonths = new Set<string>();
  for (const r of rows) {
    if (!r || typeof r.value !== 'number' || isNaN(r.value) || Math.abs(r.value) <= 0) continue;
    const normalizedRow = r.value < 0 ? { ...r, value: Math.abs(r.value) } : r;
    for (const contrib of rowContributions(normalizedRow)) {
      if (!contrib.date || contrib.date.length < 7) continue;
      const ym = contrib.date.slice(0, 7);
      if (filterMonth && ym !== filterMonth) continue;
      if (filterYear && !ym.startsWith(filterYear)) continue;
      activeMonths.add(ym);
    }
  }
  if (activeMonths.size === 0 && filterMonth && /^\d{4}-\d{2}$/.test(filterMonth)) {
    activeMonths.add(filterMonth);
  }
  return getEffectivePeriodSpanDays(activeMonths);
}

/**
 * Unified Competence-Clipped WhatsApp Weekly Closing (Precision Lock 2):
 * Aggregates prorated daily contributions (`rowContributions`) strictly clipped within
 * the boundaries of `selectedMonth` (`YYYY-MM-01` through the last day of the month),
 * guaranteeing the invariant:
 *   Sum of `weeklyTotal` across all week groups === `byMonth[selectedMonth].grossMonthly`.
 */
export function buildMonthCompetenceWeekGroups(
  rows: TableRow[],
  goals: TableGoals,
  selectedMonth: string,
): MonthCompetenceWeekGroup[] {
  if (!selectedMonth || !/^\d{4}-\d{2}$/.test(selectedMonth)) return [];
  const [selY, selM] = selectedMonth.split('-').map(Number);
  if (isNaN(selY) || isNaN(selM) || selM < 1 || selM > 12) return [];

  const totalDays = daysInMonth(selY, selM);
  const mStart = `${selectedMonth}-01`;
  const mEnd = `${selectedMonth}-${String(totalDays).padStart(2, '0')}`;
  const monthStartObj = new Date(selY, selM - 1, 1);
  const monthEndObj = new Date(selY, selM - 1, totalDays);

  // Collect all chronological Monday keys for weeks touching selectedMonth
  const mondayKeysOrdered: string[] = [];
  const mondayKeySet = new Set<string>();
  for (let d = 1; d <= totalDays; d++) {
    const curDate = new Date(selY, selM - 1, d);
    const mon = getMondayOf(curDate);
    const monKey = toLocalKey(mon);
    if (!mondayKeySet.has(monKey)) {
      mondayKeySet.add(monKey);
      mondayKeysOrdered.push(monKey);
    }
  }

  // Filter operational revenue rows
  const revenueRows = (rows || []).filter(
    (r) =>
      r &&
      r.generatedBy === undefined &&
      r.entryType !== 'deposit' &&
      r.entryType !== 'waiver' &&
      r.entryType !== 'expense' &&
      r.entryType !== 'partner_in' &&
      r.entryType !== 'partner_out' &&
      r.entryType !== 'unresolved' &&
      typeof r.value === 'number' &&
      r.value > 0,
  );

  // Map mondayKey -> { rawTotal, entries }
  const weekBuckets = new Map<string, { rawTotal: number; entries: TableRow[] }>();
  for (const monKey of mondayKeysOrdered) {
    weekBuckets.set(monKey, { rawTotal: 0, entries: [] });
  }

  for (const row of revenueRows) {
    const contribs = rowContributions(row).filter(
      (c) => c.date >= mStart && c.date <= mEnd && c.value > 0,
    );
    if (contribs.length === 0) continue;

    // Group this row's clipped contributions by Monday of each contribution date
    const byWeek = new Map<string, { sum: number; earliestDate: string }>();
    for (const c of contribs) {
      const [cy, cm, cd] = c.date.split('-').map(Number);
      const cMonKey = toLocalKey(getMondayOf(new Date(cy, cm - 1, cd)));
      const existing = byWeek.get(cMonKey);
      if (!existing) {
        byWeek.set(cMonKey, { sum: c.value, earliestDate: c.date });
      } else {
        existing.sum += c.value;
        if (c.date < existing.earliestDate) existing.earliestDate = c.date;
      }
    }

    for (const [monKey, slice] of byWeek.entries()) {
      let bucket = weekBuckets.get(monKey);
      if (!bucket) {
        bucket = { rawTotal: 0, entries: [] };
        weekBuckets.set(monKey, bucket);
      }
      bucket.rawTotal += slice.sum;
      bucket.entries.push({
        ...row,
        date: slice.earliestDate,
        value: Math.round(slice.sum * 100) / 100,
      });
    }
  }

  const msPerDay = 86_400_000;
  return mondayKeysOrdered.map((mondayKey, idx) => {
    const [my, mm, md] = mondayKey.split('-').map(Number);
    const monday = new Date(my, mm - 1, md);
    const sunday = getSundayOf(monday);
    const sundayKey = toLocalKey(sunday);

    const clippedStartDate = monday < monthStartObj ? monthStartObj : monday;
    const clippedEndDate = sunday > monthEndObj ? monthEndObj : sunday;
    const clippedStartKey = toLocalKey(clippedStartDate);
    const clippedEndKey = toLocalKey(clippedEndDate);

    const bucket = weekBuckets.get(mondayKey) || { rawTotal: 0, entries: [] };
    const weeklyTotal = Math.round(bucket.rawTotal * 100) / 100;
    const weekGoal = getWeeklyGoalForDate(clippedEndKey, goals);

    const yearStart = new Date(clippedStartDate.getFullYear(), 0, 1);
    const yearStartMonday = getMondayOf(yearStart);
    const weekNumber = Math.floor((monday.getTime() - yearStartMonday.getTime()) / (7 * msPerDay)) + 1;

    return {
      weekIndex: idx + 1,
      weekNumber,
      weekStartDate: monday,
      weekEndDate: sunday,
      clippedStartDate,
      clippedEndDate,
      mondayKey,
      sundayKey,
      clippedStartKey,
      clippedEndKey,
      dailyEntries: [...bucket.entries].sort((a, b) => a.date.localeCompare(b.date)),
      weeklyTotal,
      weeklyGoal: weekGoal,
      differenceFromGoal: Math.round((weeklyTotal - weekGoal) * 100) / 100,
    };
  });
}

