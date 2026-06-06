/**
 * Modular Cloning Engine — "Scenario Builder"
 *
 * Extracts historical TableRow entries from a source period and maps them
 * into a target date range, creating synthetic cloned rows.
 *
 * Supports the "stamp" workflow:
 *   - Clone Dec 2026 into all 12 months of 2028
 *   - Clone the entire year of 2025 into 2027
 *   - Clone the last 3 months, repeat 4 times → 12 months of future data
 *
 * All cloned rows receive:
 *   generatedBy: 'cloned'
 *   clonedFrom: the source "YYYY-MM" for audit trail
 *
 * Guardrail: maximum 60 months of output (architectural ruling #3).
 */

import type { TableRow } from '../types';

// ── Date helpers ──────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Parse a "YYYY-MM" string into { year, month }.
 * month is 1-based (January = 1).
 */
function parseYM(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m };
}

/**
 * Shift a YYYY-MM by `offset` months.
 * E.g. addMonths("2025-11", 3) → "2026-02"
 */
function addMonths(ym: string, offset: number): string {
  const { year, month } = parseYM(ym);
  const totalMonths = year * 12 + (month - 1) + offset;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${pad2(newMonth)}`;
}

/** Days in a given YYYY-MM month. */
function daysInMonth(ym: string): number {
  const { year, month } = parseYM(ym);
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate signed difference in months between two YYYY-MM strings.
 * E.g. monthDiff("2025-01", "2025-12") → 11
 *      monthDiff("2026-03", "2026-01") → -2
 */
function monthDiff(fromYM: string, toYM: string): number {
  const from = parseYM(fromYM);
  const to = parseYM(toYM);
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/**
 * Build the list of YYYY-MM keys between start and end (inclusive).
 * E.g. monthRange("2025-10", "2026-02") → ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]
 */
function monthRange(startYM: string, endYM: string): string[] {
  const result: string[] = [];
  let current = startYM;
  while (current <= endYM) {
    result.push(current);
    current = addMonths(current, 1);
  }
  return result;
}

// ── Source period config ──────────────────────────────────────────────────────

export type SourceMode =
  | { type: 'month';      ym: string }        // single month "2025-12"
  | { type: 'year';       year: string }       // full year "2025"
  | { type: 'range';      sourceMonthKeys: string[] } // custom cherry-picked months
  | { type: 'lastN';      months: number };    // last N months from most recent data

export interface CloneConfig {
  /** Which historical period to use as the source. */
  source: SourceMode;
  /** Target start: "YYYY-MM" — where the cloned data begins. */
  targetStart: string;
  /**
   * How many times to repeat the source block sequentially.
   * E.g. if source is 1 month and repeatCount is 12 → 12 months of cloned data.
   * If source is 12 months and repeatCount is 1 → clones the full year once.
   */
  repeatCount: number;
}

/** Max output months (architectural ruling #3: 60 months / 5 years). */
const MAX_OUTPUT_MONTHS = 60;

// ── Core engine ──────────────────────────────────────────────────────────────

/**
 * Resolves the source config into an array of YYYY-MM strings
 * representing the months to clone FROM.
 */
function resolveSourceMonths(rows: TableRow[], source: SourceMode): string[] {
  switch (source.type) {
    case 'month':
      return [source.ym];

    case 'year':
      return monthRange(`${source.year}-01`, `${source.year}-12`);

    case 'range':
      return source.sourceMonthKeys;

    case 'lastN': {
      // Find all distinct months in the dataset, sorted descending
      const allMonths = Array.from(
        new Set(rows.filter((r) => !r.generatedBy).map((r) => r.date.slice(0, 7))),
      ).sort().reverse();
      return allMonths.slice(0, source.months).sort(); // return in chronological order
    }
  }
}

/**
 * Core cloning function.
 *
 * Takes all rows matching the source period, maps each row's date into the
 * target date range (preserving day-of-month, clamped to target month length),
 * and repeats the entire block `repeatCount` times sequentially.
 *
 * @returns Array of new rows ready to be inserted (without `id` — the DB hook adds those).
 */
export function generateClonedData(
  rows: TableRow[],
  config: CloneConfig,
): Omit<TableRow, 'id'>[] {
  const sourceMonths = resolveSourceMonths(rows, config.source);
  if (sourceMonths.length === 0) return [];

  const blockLength = sourceMonths.length;

  // Guardrail: cap at MAX_OUTPUT_MONTHS
  const effectiveRepeat = Math.min(
    config.repeatCount,
    Math.floor(MAX_OUTPUT_MONTHS / blockLength),
  );
  if (effectiveRepeat <= 0) return [];

  // Get all real (non-generated) rows in the source period
  const sourceRows = rows.filter((r) => {
    if (r.generatedBy) return false; // never clone clones
    const ym = r.date.slice(0, 7);
    return sourceMonths.includes(ym);
  });

  if (sourceRows.length === 0) return [];

  const result: Omit<TableRow, 'id'>[] = [];

  for (let rep = 0; rep < effectiveRepeat; rep++) {
    for (const row of sourceRows) {
      const sourceYM = row.date.slice(0, 7);
      const sourceDay = parseInt(row.date.slice(8, 10), 10);

      // Find the index of this source month within the source block
      const sourceIdx = sourceMonths.indexOf(sourceYM);
      if (sourceIdx < 0) continue;

      // Calculate the target month offset
      const targetOffset = rep * blockLength + sourceIdx;
      const targetYM = addMonths(config.targetStart, targetOffset);

      // Clamp day to the target month's max
      const maxDay = daysInMonth(targetYM);
      const targetDay = Math.min(sourceDay, maxDay);
      const targetDate = `${targetYM}-${pad2(targetDay)}`;

      // Build the cloned row
      const cloned: Omit<TableRow, 'id'> = {
        date: targetDate,
        value: row.value,
        description: row.description,
        entryType: row.entryType,
        monthlyValue: row.monthlyValue,
        monthCount: row.monthCount,
        generatedBy: 'cloned',
        clonedFrom: sourceYM,
      };

      // Map period dates if present — use relative month offsets
      // so multi-month spans (e.g., Jan-Dec insurance) are correctly shifted
      if (row.periodStart && row.periodEnd) {
        const rowYM = row.date.slice(0, 7);
        const psYM  = row.periodStart.slice(0, 7);
        const peYM  = row.periodEnd.slice(0, 7);
        const psDay = parseInt(row.periodStart.slice(8, 10), 10);
        const peDay = parseInt(row.periodEnd.slice(8, 10), 10);

        // Calculate month offsets relative to the row's base date
        const psOffset = monthDiff(rowYM, psYM);
        const peOffset = monthDiff(rowYM, peYM);

        // Apply same offsets to the target date
        const tpStartYM = addMonths(targetYM, psOffset);
        const tpEndYM   = addMonths(targetYM, peOffset);

        cloned.periodStart = `${tpStartYM}-${pad2(Math.min(psDay, daysInMonth(tpStartYM)))}`;
        cloned.periodEnd   = `${tpEndYM}-${pad2(Math.min(peDay, daysInMonth(tpEndYM)))}`;
      }

      result.push(cloned);
    }
  }

  return result;
}

/**
 * Count how many generated rows currently exist in the dataset,
 * optionally filtered by a date prefix.
 */
export function countGeneratedRows(rows: TableRow[], prefix?: string): number {
  return rows.filter((r) => {
    if (!r.generatedBy) return false;
    if (prefix && !r.date.startsWith(prefix)) return false;
    return true;
  }).length;
}

// ── Statistical Prediction Engine ─────────────────────────────────────────────

interface CategoryStats {
  description: string;
  entryType: TableRow['entryType'];
  avgMonthlyTotal: number;
  avgFrequency: number; // rounded, minimum 1
  /** True if this category historically uses periodStart/periodEnd (prorated entries). */
  isProrated: boolean;
  /** Average period span in months (for prorated categories). */
  avgPeriodSpanMonths: number;
  /** Average monthlyValue from source rows (for prorated categories). */
  avgMonthlyValue: number;
}

/**
 * Generates synthetic rows based on category averages and frequencies
 * from a source period (not exact copies — statistical projections).
 *
 * Two modes per category:
 *   - DAILY entries (revenue, etc.): spread across 28 days of each target month
 *   - PRORATED entries (expenses with periodStart/periodEnd): single row on day 1
 *     with full-month period span and correct monthlyValue/monthCount
 */
export function generateStatisticalData(
  rows: TableRow[],
  config: CloneConfig,
): Omit<TableRow, 'id'>[] {
  const sourceMonths = resolveSourceMonths(rows, config.source);
  if (sourceMonths.length === 0) return [];

  // ── STRICT GLOBAL DENOMINATOR ──
  // This MUST be the full span of the selected source period, NOT the count
  // of months that happen to have data. A 3-month source where a category
  // only appears in 1 month must still divide by 3 (dilution).
  const globalSourceMonthCount = sourceMonths.length;

  // Get real rows in source period
  const sourceRows = rows.filter((r) => {
    if (r.generatedBy) return false;
    const ym = r.date.slice(0, 7);
    return sourceMonths.includes(ym);
  });

  if (sourceRows.length === 0) return [];

  // Group by description + entryType, track period info
  const groups: Record<string, {
    desc: string;
    et: TableRow['entryType'];
    totalValue: number;
    count: number;
    proratedCount: number;     // how many rows have periodStart
    totalPeriodSpanMonths: number;
    totalMonthlyValue: number; // sum of monthlyValue across prorated rows
  }> = {};

  for (const row of sourceRows) {
    const desc = row.description || 'Sem descrição';
    const et = row.entryType || 'revenue';
    const key = `${desc}|||${et}`;
    if (!groups[key]) {
      groups[key] = { desc, et, totalValue: 0, count: 0, proratedCount: 0, totalPeriodSpanMonths: 0, totalMonthlyValue: 0 };
    }
    groups[key].totalValue += row.value;
    groups[key].count += 1;

    // Track period metadata
    if (row.periodStart && row.periodEnd) {
      groups[key].proratedCount++;
      const spanMonths = Math.max(1, monthDiff(
        row.periodStart.slice(0, 7),
        row.periodEnd.slice(0, 7),
      ) + 1);
      groups[key].totalPeriodSpanMonths += spanMonths;
      groups[key].totalMonthlyValue += (row.monthlyValue ?? row.value);
    }
  }

  // ── Calculate per-category stats (ALL averages use globalSourceMonthCount) ──
  const stats: CategoryStats[] = Object.values(groups).map((g) => {
    const isProrated = g.proratedCount > 0 && (g.proratedCount / g.count) >= 0.5;

    // DILUTED monthly average: totalValue / GLOBAL month count
    // A category with R$300 total in a 3-month source → R$100/month, even if
    // all R$300 came from a single month.
    const trueMonthlyAverage = Math.round((g.totalValue / globalSourceMonthCount) * 100) / 100;

    // DILUTED frequency: total occurrences / GLOBAL month count
    // 2 occurrences in 3 months → 0.67/month → round to 1
    const trueMonthlyFrequency = Math.max(1, Math.round(g.count / globalSourceMonthCount));

    // DILUTED prorated monthlyValue: total monthlyValue sum / GLOBAL month count
    // Insurance with monthlyValue=R$500 appearing once in a 3-month source
    // → trueAvgMonthlyValue = R$500/3 ≈ R$166.67 (not R$500!)
    const trueAvgMonthlyValue = isProrated
      ? Math.round((g.totalMonthlyValue / globalSourceMonthCount) * 100) / 100
      : 0;

    return {
      description: g.desc,
      entryType: g.et,
      avgMonthlyTotal: trueMonthlyAverage,
      avgFrequency: trueMonthlyFrequency,
      isProrated,
      avgPeriodSpanMonths: isProrated
        ? Math.max(1, Math.round(g.totalPeriodSpanMonths / g.proratedCount))
        : 1,
      avgMonthlyValue: trueAvgMonthlyValue,
    };
  });

  // Calculate output months
  const blockLength = sourceMonths.length;
  const effectiveRepeat = Math.min(
    config.repeatCount,
    Math.floor(MAX_OUTPUT_MONTHS / blockLength),
  );
  if (effectiveRepeat <= 0) return [];

  const totalOutputMonths = blockLength * effectiveRepeat;

  const result: Omit<TableRow, 'id'>[] = [];

  // Track which prorated categories have already been emitted
  // (to avoid duplicating multi-month spans)
  const proratedEmitted = new Set<string>();

  for (let monthOffset = 0; monthOffset < totalOutputMonths; monthOffset++) {
    const targetYM = addMonths(config.targetStart, monthOffset);
    const maxDay = daysInMonth(targetYM);

    for (const cat of stats) {
      if (cat.isProrated) {
        // Prorated: emit ONE row per span, only on the first month of the span
        const spanKey = `${cat.description}|||${Math.floor(monthOffset / cat.avgPeriodSpanMonths)}`;
        if (proratedEmitted.has(spanKey)) continue;

        // Only emit on the first month of each span cycle
        if (monthOffset % cat.avgPeriodSpanMonths !== 0) continue;

        proratedEmitted.add(spanKey);

        const periodStartYM = targetYM;
        const periodEndYM   = addMonths(targetYM, cat.avgPeriodSpanMonths - 1);
        const periodEndMaxDay = daysInMonth(periodEndYM);
        const monthCount = cat.avgPeriodSpanMonths;
        const monthlyValue = cat.avgMonthlyValue;
        const totalValue = Math.round(monthlyValue * monthCount * 100) / 100;

        if (totalValue <= 0) continue;

        result.push({
          date: `${periodStartYM}-01`,
          value: totalValue,
          description: cat.description,
          entryType: cat.entryType,
          periodStart: `${periodStartYM}-01`,
          periodEnd: `${periodEndYM}-${pad2(periodEndMaxDay)}`,
          monthlyValue,
          monthCount,
          generatedBy: 'predicted',
          clonedFrom: sourceMonths.join(','),
        });
      } else {
        // Daily: spread across 28 days
        const valuePerRow = Math.round((cat.avgMonthlyTotal / cat.avgFrequency) * 100) / 100;
        if (valuePerRow <= 0) continue;

        for (let i = 0; i < cat.avgFrequency; i++) {
          const spreadDay = Math.min(
            Math.floor((i / cat.avgFrequency) * 28) + 1,
            maxDay,
          );
          const targetDate = `${targetYM}-${pad2(spreadDay)}`;

          result.push({
            date: targetDate,
            value: valuePerRow,
            description: cat.description,
            entryType: cat.entryType,
            generatedBy: 'predicted',
            clonedFrom: sourceMonths.join(','),
          });
        }
      }
    }
  }

  return result;
}

// ── Scenario Management helpers ───────────────────────────────────────────────

export interface GeneratedPeriodInfo {
  /** "YYYY-MM" */
  period: string;
  /** Human-readable label (e.g., "Jun. de 2026") */
  label: string;
  /** Number of synthetic rows in this period */
  count: number;
  /** Whether any are 'cloned' vs 'predicted' */
  hasCloned: boolean;
  hasPredicted: boolean;
}

/**
 * Extract all unique YYYY-MM periods containing at least one generated row.
 * Returns them sorted chronologically with metadata.
 */
export function getGeneratedPeriods(rows: TableRow[]): GeneratedPeriodInfo[] {
  const map: Record<string, { count: number; hasCloned: boolean; hasPredicted: boolean }> = {};

  for (const r of rows) {
    if (!r.generatedBy) continue;
    const ym = r.date.slice(0, 7);
    if (!map[ym]) map[ym] = { count: 0, hasCloned: false, hasPredicted: false };
    map[ym].count++;
    if (r.generatedBy === 'cloned') map[ym].hasCloned = true;
    if (r.generatedBy === 'predicted') map[ym].hasPredicted = true;
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, info]) => {
      const [y, m] = period.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      return {
        period,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        ...info,
      };
    });
}
