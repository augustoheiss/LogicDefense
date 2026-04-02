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
export function groupRowsByWeek(rows: TableRow[], weeklyGoal: number): WeekGroup[] {
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
      return {
        weekStartDate:      monday,
        weekEndDate:        sunday,
        dailyEntries:       [...entries].sort((a, b) => a.date.localeCompare(b.date)),
        weeklyTotal,
        differenceFromGoal: weeklyTotal - weeklyGoal,
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
