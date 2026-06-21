/**
 * Weekly Debt Timeline — Assistente Moeda (React Native)
 *
 * Walks every Mon–Sun calendar week computing per-week revenue,
 * waivers, partner credits/debits, and cumulative balance.
 * Migrated with import paths updated to './types' and './dateUtils'.
 */

import type { TableRow, TableGoals } from './types';
import {
  getMondayOf,
  getSundayOf,
  toLocalKey,
  fmtDate,
  getWeeklyGoalForDate,
} from './dateUtils';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface WeekDebtEntry {
  mondayKey: string;
  sundayKey: string;
  weekLabel: string;
  weekNumber: number;
  weeklyGoal: number;
  weeklyRevenue: number;
  weeklyWaivers: number;
  weeklyPartnerNet: number;
  weekDelta: number;
  cumulativeBalance: number;
}

// ─── Main Function ────────────────────────────────────────────────────────────

export function computeWeeklyDebtTimeline(
  rows: TableRow[],
  goals: TableGoals,
  asOfDate?: string,
): WeekDebtEntry[] {
  if (rows.length === 0) return [];

  const revenueRows = rows.filter(
    (r) =>
      r.value > 0 &&
      r.entryType !== 'deposit' &&
      r.entryType !== 'waiver' &&
      r.entryType !== 'expense' &&
      r.entryType !== 'partner_in' &&
      r.entryType !== 'partner_out',
  );

  if (revenueRows.length === 0) return [];

  const minDate = revenueRows.map((r) => r.periodStart ?? r.date).sort()[0];
  const [minY, minMo, minD] = minDate.split('-').map(Number);
  const startOfTimeline = getMondayOf(new Date(minY, minMo - 1, minD));

  const refDate = asOfDate
    ? new Date(asOfDate + 'T12:00:00')
    : new Date();
  const endOfTimeline = getMondayOf(
    new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()),
  );

  const msPerDay = 86_400_000;

  // Revenue lookup
  const revenueDayMap = new Map<string, number>();
  for (const row of revenueRows) {
    if (row.periodStart && row.periodEnd) {
      const startMs = new Date(row.periodStart + 'T12:00:00').getTime();
      const endMs = new Date(row.periodEnd + 'T12:00:00').getTime();
      const periodDays = Math.max(1, Math.round((endMs - startMs) / msPerDay) + 1);
      const dailyValue = row.value / periodDays;
      for (let ms = startMs; ms <= endMs; ms += msPerDay) {
        const dayKey = toLocalKey(new Date(ms));
        revenueDayMap.set(dayKey, (revenueDayMap.get(dayKey) ?? 0) + dailyValue);
      }
    } else {
      revenueDayMap.set(row.date, (revenueDayMap.get(row.date) ?? 0) + row.value);
    }
  }

  // Waiver lookup
  const waiverDayMap = new Map<string, number>();
  const waiverRows = rows.filter((r) => r.entryType === 'waiver' && r.value > 0);
  for (const row of waiverRows) {
    if (row.periodStart && row.periodEnd) {
      const startMs = new Date(row.periodStart + 'T12:00:00').getTime();
      const endMs = new Date(row.periodEnd + 'T12:00:00').getTime();
      const periodDays = Math.max(1, Math.round((endMs - startMs) / msPerDay) + 1);
      const dailyValue = row.value / periodDays;
      for (let ms = startMs; ms <= endMs; ms += msPerDay) {
        const dayKey = toLocalKey(new Date(ms));
        waiverDayMap.set(dayKey, (waiverDayMap.get(dayKey) ?? 0) + dailyValue);
      }
    } else {
      waiverDayMap.set(row.date, (waiverDayMap.get(row.date) ?? 0) + row.value);
    }
  }

  // Partner lookups
  const partnerInDayMap = new Map<string, number>();
  const partnerInRows = rows.filter((r) => r.entryType === 'partner_in' && r.value > 0);
  for (const row of partnerInRows) {
    partnerInDayMap.set(row.date, (partnerInDayMap.get(row.date) ?? 0) + row.value);
  }

  const partnerOutDayMap = new Map<string, number>();
  const partnerOutRows = rows.filter((r) => r.entryType === 'partner_out' && r.value > 0);
  for (const row of partnerOutRows) {
    partnerOutDayMap.set(row.date, (partnerOutDayMap.get(row.date) ?? 0) + row.value);
  }

  // Walk each week
  const timeline: WeekDebtEntry[] = [];
  let cumulativeBalance = 0;

  let cursor = new Date(
    startOfTimeline.getFullYear(),
    startOfTimeline.getMonth(),
    startOfTimeline.getDate(),
  );

  while (cursor.getTime() <= endOfTimeline.getTime()) {
    const monday = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const sunday = getSundayOf(monday);
    const mondayKey = toLocalKey(monday);
    const sundayKey = toLocalKey(sunday);

    let weeklyRevenue = 0;
    let weeklyWaivers = 0;
    let weeklyPartnerIn = 0;
    let weeklyPartnerOut = 0;

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dayKey = toLocalKey(day);
      weeklyRevenue += revenueDayMap.get(dayKey) ?? 0;
      weeklyWaivers += waiverDayMap.get(dayKey) ?? 0;
      weeklyPartnerIn += partnerInDayMap.get(dayKey) ?? 0;
      weeklyPartnerOut += partnerOutDayMap.get(dayKey) ?? 0;
    }

    const weeklyGoal = getWeeklyGoalForDate(sundayKey, goals);
    const weeklyPartnerNet = weeklyPartnerIn - weeklyPartnerOut;
    const weekDelta = weeklyRevenue + weeklyWaivers + weeklyPartnerNet - weeklyGoal;
    cumulativeBalance += weekDelta;

    const yearStart = new Date(monday.getFullYear(), 0, 1);
    const yearStartMonday = getMondayOf(yearStart);
    const weekNumber =
      Math.floor(
        (monday.getTime() - yearStartMonday.getTime()) / (7 * msPerDay),
      ) + 1;

    const weekLabel = `${fmtDate(monday)} – ${fmtDate(sunday)}`;

    timeline.push({
      mondayKey,
      sundayKey,
      weekLabel,
      weekNumber,
      weeklyGoal: round2(weeklyGoal),
      weeklyRevenue: round2(weeklyRevenue),
      weeklyWaivers: round2(weeklyWaivers),
      weeklyPartnerNet: round2(weeklyPartnerNet),
      weekDelta: round2(weekDelta),
      cumulativeBalance: round2(cumulativeBalance),
    });

    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 7,
    );
  }

  return timeline;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
