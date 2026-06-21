/**
 * Prediction Engine — Assistente Moeda (React Native)
 *
 * Pure TypeScript cloning and statistical prediction engine.
 * ZERO React dependencies.
 *
 * Migrated from web CoinAssistant's usePredictionEngine.ts with
 * import paths updated to local ./types module.
 *
 * Features:
 *   - Exact cloning (stamp a month/year into future months)
 *   - Statistical prediction (category averages + frequencies)
 *   - Generated period management helpers
 *   - 60-month output guardrail
 */

import type { TableRow } from './types';

// ── Date helpers ──────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseYM(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m };
}

function addMonths(ym: string, offset: number): string {
  const { year, month } = parseYM(ym);
  const totalMonths = year * 12 + (month - 1) + offset;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${pad2(newMonth)}`;
}

function daysInMonth(ym: string): number {
  const { year, month } = parseYM(ym);
  return new Date(year, month, 0).getDate();
}

function monthDiff(fromYM: string, toYM: string): number {
  const from = parseYM(fromYM);
  const to = parseYM(toYM);
  return (to.year - from.year) * 12 + (to.month - from.month);
}

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
  | { type: 'month';      ym: string }
  | { type: 'year';       year: string }
  | { type: 'range';      sourceMonthKeys: string[] }
  | { type: 'lastN';      months: number };

export interface CloneConfig {
  source: SourceMode;
  targetStart: string;
  repeatCount: number;
}

const MAX_OUTPUT_MONTHS = 60;

// ── Core cloning engine ──────────────────────────────────────────────────────

function resolveSourceMonths(rows: TableRow[], source: SourceMode): string[] {
  switch (source.type) {
    case 'month':
      return [source.ym];
    case 'year':
      return monthRange(`${source.year}-01`, `${source.year}-12`);
    case 'range':
      return source.sourceMonthKeys;
    case 'lastN': {
      const allMonths = Array.from(
        new Set(rows.filter((r) => !r.generatedBy).map((r) => r.date.slice(0, 7))),
      ).sort().reverse();
      return allMonths.slice(0, source.months).sort();
    }
  }
}

export function generateClonedData(
  rows: TableRow[],
  config: CloneConfig,
): Omit<TableRow, 'id'>[] {
  const sourceMonths = resolveSourceMonths(rows, config.source);
  if (sourceMonths.length === 0) return [];

  const blockLength = sourceMonths.length;
  const effectiveRepeat = Math.min(
    config.repeatCount,
    Math.floor(MAX_OUTPUT_MONTHS / blockLength),
  );
  if (effectiveRepeat <= 0) return [];

  const sourceRows = rows.filter((r) => {
    if (r.generatedBy) return false;
    const ym = r.date.slice(0, 7);
    return sourceMonths.includes(ym);
  });

  if (sourceRows.length === 0) return [];

  const result: Omit<TableRow, 'id'>[] = [];

  for (let rep = 0; rep < effectiveRepeat; rep++) {
    for (const row of sourceRows) {
      const sourceYM = row.date.slice(0, 7);
      const sourceDay = parseInt(row.date.slice(8, 10), 10);
      const sourceIdx = sourceMonths.indexOf(sourceYM);
      if (sourceIdx < 0) continue;

      const targetOffset = rep * blockLength + sourceIdx;
      const targetYM = addMonths(config.targetStart, targetOffset);
      const maxDay = daysInMonth(targetYM);
      const targetDay = Math.min(sourceDay, maxDay);
      const targetDate = `${targetYM}-${pad2(targetDay)}`;

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

      if (row.periodStart && row.periodEnd) {
        const rowYM = row.date.slice(0, 7);
        const psYM  = row.periodStart.slice(0, 7);
        const peYM  = row.periodEnd.slice(0, 7);
        const psDay = parseInt(row.periodStart.slice(8, 10), 10);
        const peDay = parseInt(row.periodEnd.slice(8, 10), 10);

        const psOffset = monthDiff(rowYM, psYM);
        const peOffset = monthDiff(rowYM, peYM);

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
  avgFrequency: number;
  isProrated: boolean;
  avgPeriodSpanMonths: number;
  avgMonthlyValue: number;
  avgTotalValue?: number;
}

export function generateStatisticalData(
  rows: TableRow[],
  config: CloneConfig,
): Omit<TableRow, 'id'>[] {
  const sourceMonths = resolveSourceMonths(rows, config.source);
  if (sourceMonths.length === 0) return [];

  const globalSourceMonthCount = sourceMonths.length;

  const sourceRows = rows.filter((r) => {
    if (r.generatedBy) return false;
    const ym = r.date.slice(0, 7);
    return sourceMonths.includes(ym);
  });

  if (sourceRows.length === 0) return [];

  const groups: Record<string, {
    desc: string;
    et: TableRow['entryType'];
    totalValue: number;
    count: number;
    proratedCount: number;
    totalPeriodSpanMonths: number;
    totalMonthlyValue: number;
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

  const stats: CategoryStats[] = Object.values(groups).map((g) => {
    const isProrated = g.proratedCount > 0 && (g.proratedCount / g.count) >= 0.5;
    const trueMonthlyAverage = Math.round((g.totalValue / globalSourceMonthCount) * 100) / 100;
    const trueMonthlyFrequency = Math.max(1, Math.round(g.count / globalSourceMonthCount));

    const trueAvgMonthlyValue = isProrated
      ? Math.round((g.totalMonthlyValue / g.proratedCount) * 100) / 100
      : 0;

    const avgTotalValue = isProrated
      ? Math.round((g.totalValue / g.proratedCount) * 100) / 100
      : undefined;

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
      avgTotalValue,
    };
  });

  const blockLength = sourceMonths.length;
  const effectiveRepeat = Math.min(
    config.repeatCount,
    Math.floor(MAX_OUTPUT_MONTHS / blockLength),
  );
  if (effectiveRepeat <= 0) return [];

  const totalOutputMonths = blockLength * effectiveRepeat;

  const result: Omit<TableRow, 'id'>[] = [];
  const proratedEmitted = new Set<string>();

  for (let monthOffset = 0; monthOffset < totalOutputMonths; monthOffset++) {
    const targetYM = addMonths(config.targetStart, monthOffset);
    const maxDay = daysInMonth(targetYM);

    for (const cat of stats) {
      if (cat.isProrated) {
        const spanKey = `${cat.description}|||${Math.floor(monthOffset / cat.avgPeriodSpanMonths)}`;
        if (proratedEmitted.has(spanKey)) continue;
        if (monthOffset % cat.avgPeriodSpanMonths !== 0) continue;

        proratedEmitted.add(spanKey);

        const periodStartYM = targetYM;
        const periodEndYM   = addMonths(targetYM, cat.avgPeriodSpanMonths - 1);
        const periodEndMaxDay = daysInMonth(periodEndYM);
        const monthCount = cat.avgPeriodSpanMonths;
        const monthlyValue = cat.avgMonthlyValue;
        const totalValue = cat.avgTotalValue ?? 0;

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
  period: string;
  label: string;
  count: number;
  hasCloned: boolean;
  hasPredicted: boolean;
}

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
