/**
 * computeWeeklyDebtTimeline — Pure calculation engine for the "Tabela" tab.
 *
 * Walks every Mon–Sun calendar week from the first recorded entry to the
 * current week (or asOfDate), computing per-week revenue, waivers,
 * partner credits/debits, the weekly delta, and a **running cumulative
 * balance** — identical to calculateStrictGlobalBalance (Option B).
 *
 * The final entry's cumulativeBalance MUST equal globalGoalBalance
 * from the metrics engine. Any divergence is a bug.
 */

import type { TableRow, TableGoals } from '../types';
import {
  getMondayOf,
  getSundayOf,
  toLocalKey,
  fmtDate,
  getWeeklyGoalForDate,
} from './dateUtils';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface WeekDebtEntry {
  /** Monday key "YYYY-MM-DD" */
  mondayKey: string;
  /** Sunday key "YYYY-MM-DD" */
  sundayKey: string;
  /** Human label "DD/MM – DD/MM" */
  weekLabel: string;
  /** Week number within its year (1-based) */
  weekNumber: number;
  /** The weekly goal in effect for this week (resolved via hierarchy) */
  weeklyGoal: number;
  /** Sum of operational revenue allocated to this week */
  weeklyRevenue: number;
  /** Sum of waiver credits allocated to this week */
  weeklyWaivers: number;
  /** Net partnership effect: partner_in − partner_out for this week */
  weeklyPartnerNet: number;
  /** weeklyRevenue + weeklyWaivers + weeklyPartnerNet − weeklyGoal */
  weekDelta: number;
  /** Running cumulative sum of weekDelta from week 1 to this week.
   *  Option B (Balanço Completo): can go positive (credit) or negative (debt). */
  cumulativeBalance: number;
}

// ─── Main Function ────────────────────────────────────────────────────────────

export function computeWeeklyDebtTimeline(
  rows: TableRow[],
  goals: TableGoals,
  asOfDate?: string,
): WeekDebtEntry[] {
  if (rows.length === 0) return [];

  // ── Step 1: Identify the timeline boundaries ────────────────────────────────

  // Revenue rows (same filter as calculateStrictGlobalBalance)
  const revenueRows = rows.filter(
    (r) =>
      r.value > 0 &&
      r.entryType !== 'deposit' &&
      r.entryType !== 'waiver' &&
      r.entryType !== 'expense' &&
      r.entryType !== 'partner_in' &&
      r.entryType !== 'partner_out',
  );

  // We need at least one revenue row to anchor the timeline start
  // But the global balance in metrics also uses just revenue rows for start
  if (revenueRows.length === 0) return [];

  // Earliest date (use periodStart if available — same as calculateStrictGlobalBalance)
  const minDate = revenueRows.map((r) => r.periodStart ?? r.date).sort()[0];
  const [minY, minMo, minD] = minDate.split('-').map(Number);

  // Monday of the week containing the earliest date
  const startOfTimeline = getMondayOf(new Date(minY, minMo - 1, minD));

  // Monday of the current (or asOfDate) week
  const refDate = asOfDate
    ? new Date(asOfDate + 'T12:00:00')
    : new Date();
  const endOfTimeline = getMondayOf(
    new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()),
  );

  // ── Step 2: Build daily value lookups for each entry type ───────────────────

  const msPerDay = 86_400_000;

  // Revenue lookup (identical to calculateStrictGlobalBalance)
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

  // Waiver lookup (value > 0 waivers, spread by period if applicable)
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

  // Partner_in lookup
  const partnerInDayMap = new Map<string, number>();
  const partnerInRows = rows.filter((r) => r.entryType === 'partner_in' && r.value > 0);
  for (const row of partnerInRows) {
    partnerInDayMap.set(row.date, (partnerInDayMap.get(row.date) ?? 0) + row.value);
  }

  // Partner_out lookup
  const partnerOutDayMap = new Map<string, number>();
  const partnerOutRows = rows.filter((r) => r.entryType === 'partner_out' && r.value > 0);
  for (const row of partnerOutRows) {
    partnerOutDayMap.set(row.date, (partnerOutDayMap.get(row.date) ?? 0) + row.value);
  }

  // ── Step 3: Walk each Mon–Sun window and compute per-week metrics ──────────

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

    // Delta = revenue + waivers + partnerNet − goal
    // This matches globalGoalBalance logic:
    //   rawStrictBalance (revenue − goal) + waiverCredits + partnerIn − partnerOut
    const weekDelta = weeklyRevenue + weeklyWaivers + weeklyPartnerNet - weeklyGoal;

    // Option B — running cumulative (no cap at zero)
    cumulativeBalance += weekDelta;

    // Week number (ISO-ish: count from Monday of first week in this year)
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

    // Advance cursor by 7 days
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 7,
    );
  }

  return timeline;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
