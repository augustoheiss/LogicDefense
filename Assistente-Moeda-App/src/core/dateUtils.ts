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

// ─── Internal helpers ─────────────────────────────────────────────────────────

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
  if (scope !== 'global' && scope.month !== undefined) {
    const monthKey = `${scope.year}-${String(scope.month).padStart(2, '0')}`;
    const monthly = goals.monthlyGoals?.[monthKey];
    if (monthly) return monthly;
  }
  if (scope !== 'global') {
    const yearly = goals.yearlyGoals?.[scope.year];
    if (yearly) return yearly;
  }
  if (goals.globalGoals) return goals.globalGoals;
  const year = scope === 'global' ? new Date().getFullYear() : scope.year;
  return {
    dailyGoal:  resolveGoalForYear(goals.dailyGoals,  year),
    weeklyGoal: resolveGoalForYear(goals.weeklyGoals, year),
    annualCost: resolveGoalForYear(goals.annualCosts, year),
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
