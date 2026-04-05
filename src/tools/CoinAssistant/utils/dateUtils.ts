import type { TableRow } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeekGroup {
  weekStartDate: Date;      // Monday (may fall outside the filtered month)
  weekEndDate: Date;        // Sunday (may fall outside the filtered month)
  dailyEntries: TableRow[]; // only the rows passed in — no cross-month data
  weeklyTotal: number;
  /** weeklyTotal − weeklyGoal. Positive = exceeded. Negative = below goal. */
  differenceFromGoal: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns the Monday (at midnight, local time) of the week containing `date`. */
function getMondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun, 1 = Mon … 6 = Sat
  // Distance back to Monday: Sunday → 6 days back, else (day − 1) days back
  const distanceToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - distanceToMonday);
  return d;
}

/** Returns the Sunday of the week starting on `monday`. */
function getSundayOf(monday: Date): Date {
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
}

/** Stable "YYYY-MM-DD" key from a local-time Date (avoids UTC offset issues). */
function toLocalKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Formats a Date object as "DD/MM" using local time.
 * Use `fmtDay` (in WhatsAppExporter) for "YYYY-MM-DD" strings.
 */
export function fmtDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Resolves the goal amount for a specific `year` from a per-year Record.
 *
 * Fallback priority (to avoid returning NaN or 0 when the user hasn't yet
 * configured a goal for a historical year):
 *   1. Exact year match.
 *   2. Closest year BEFORE `year` (most recent prior configuration).
 *   3. Closest year AFTER `year` (earliest future configuration).
 *   4. 0 — only if the record is completely empty.
 */
export function resolveGoalForYear(
  goals: Record<number, number>,
  year: number,
): number {
  if (goals[year] !== undefined) return goals[year];
  const years = Object.keys(goals).map(Number).sort((a, b) => a - b);
  if (years.length === 0) return 0;
  const earlier = years.filter((y) => y < year);
  if (earlier.length > 0) return goals[earlier[earlier.length - 1]];
  return goals[years[0]]; // earliest later year
}

/**
 * Groups revenue rows chronologically into Mon–Sun calendar weeks.
 *
 * Expectations for `rows`:
 *   - already filtered to revenue entries (`entryType !== 'deposit'`)
 *   - already filtered to positive values (`value > 0`) if rest-days should be hidden
 *   - may span a single month or multiple months
 *
 * Each resulting `WeekGroup` has the real Mon–Sun window (which can extend
 * outside the filtered month) but `dailyEntries` only contains the rows supplied.
 */
export function groupRowsByWeek(
  rows: TableRow[],
  weeklyGoals: Record<number, number>,
): WeekGroup[] {
  if (rows.length === 0) return [];

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  // Map: monday-key → rows whose date falls in that Mon–Sun window
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
    .sort(([a], [b]) => a.localeCompare(b)) // chronological
    .map(([mondayStr, entries]) => {
      const [y, mo, d] = mondayStr.split('-').map(Number);
      const monday      = new Date(y, mo - 1, d);
      const sunday      = getSundayOf(monday);
      const weeklyTotal = entries.reduce((sum, r) => sum + r.value, 0);
      // The goal for this week is determined by the year its SUNDAY falls in
      const weekGoal    = resolveGoalForYear(weeklyGoals, sunday.getFullYear());
      return {
        weekStartDate:      monday,
        weekEndDate:        sunday,
        dailyEntries:       [...entries].sort((a, b) => a.date.localeCompare(b.date)),
        weeklyTotal,
        differenceFromGoal: weeklyTotal - weekGoal,
      };
    });
}

/**
 * Returns the WeekGroup whose Mon–Sun window contains `referenceDate`.
 * Falls back to the last group — useful when browsing a past month where
 * today is not inside any of the displayed weeks.
 */
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

/**
 * Strict global goal balance across the ENTIRE timeline from the very first
 * recorded entry up to (and including) the current calendar week.
 *
 * Every Mon–Sun window in that range is scored, even completely empty ones
 * (vacations, illness, etc.). An empty week contributes −weeklyGoal to the
 * running total, making this metric deliberately unforgiving.
 *
 * @param rows       Revenue rows already stripped of deposits
 *                   (`entryType !== 'deposit'`). Rest-day rows (value = 0)
 *                   are ignored inside the function.
 * @param weeklyGoal The target revenue per week (e.g. R$ 600).
 * @returns          Running cumulative balance: positive = excedente,
 *                   negative = dívida pendente.
 */
export function calculateStrictGlobalBalance(
  rows: TableRow[],
  weeklyGoals: Record<number, number>,
): number {
  const activeRows = rows.filter((r) => r.value > 0);
  if (activeRows.length === 0) return 0;

  // Step A — earliest date among all active revenue rows
  const minDate = activeRows.map((r) => r.date).sort()[0];
  const [minY, minMo, minD] = minDate.split('-').map(Number);

  // Step B — Monday of the week that contains minDate (start of timeline)
  const startOfTimeline = getMondayOf(new Date(minY, minMo - 1, minD));

  // Step C — Monday of the CURRENT calendar week (end of timeline, inclusive)
  const today = new Date();
  const endOfTimeline = getMondayOf(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  // Build a fast O(1) lookup: "YYYY-MM-DD" → total revenue for that date
  const dateValueMap = new Map<string, number>();
  for (const row of activeRows) {
    dateValueMap.set(row.date, (dateValueMap.get(row.date) ?? 0) + row.value);
  }

  // Steps D–G — walk each Mon–Sun window from startOfTimeline to endOfTimeline
  let totalBalance = 0;
  let cursor = new Date(
    startOfTimeline.getFullYear(),
    startOfTimeline.getMonth(),
    startOfTimeline.getDate(),
  );

  while (cursor.getTime() <= endOfTimeline.getTime()) {
    let weekSum = 0;
    for (let i = 0; i < 7; i++) {
      // new Date(y, m, d + i) handles month/year overflow correctly in JS
      const dayKey = toLocalKey(
        new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i),
      );
      weekSum += dateValueMap.get(dayKey) ?? 0;
    }
    // Score this week against the goal for the year its SUNDAY falls in.
    // cursor + 6 days = the Sunday of this Mon–Sun window.
    const sunday   = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);
    const weekGoal = resolveGoalForYear(weeklyGoals, sunday.getFullYear());
    totalBalance  += weekSum - weekGoal;
    // Advance exactly 7 days — JS Date constructor handles overflow across
    // month and year boundaries without any manual wrapping needed.
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 7,
    );
  }

  return Math.round(totalBalance * 100) / 100;
}
