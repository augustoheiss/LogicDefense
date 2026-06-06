/**
 * Mathematical Prediction Engine
 *
 * Computes a statistical forecast based on historical monthly revenue data.
 * This is a PURE computation layer — it never injects rows into the database.
 *
 * Outputs prediction points for the chart's "Confidence Cone":
 *   - mean:        Simple Moving Average of grossMonthly revenue
 *   - optimistic:  Mean + 1σ (standard deviation)
 *   - pessimistic: Max(0, Mean − 1σ)
 *
 * Supports both monthly (anual view) and yearly (global view) forecasting.
 */

import type { TableMetrics } from '../types';

// ── Output types ──────────────────────────────────────────────────────────────

export interface PredictionPoint {
  /** Label for the X-axis (e.g., "(Prev) Jul" or "(Prev) 2028") */
  label: string;
  /** ISO key for internal use ("YYYY-MM" or "YYYY") */
  key: string;
  /** Simple mean of historical values */
  mean: number;
  /** Mean + 1 × StdDev (upper bound of confidence cone) */
  optimistic: number;
  /** Max(0, Mean − 1 × StdDev) (lower bound of confidence cone) */
  pessimistic: number;
  /** Flag: this is a prediction point, not historical */
  isPrediction: true;
}

// ── Month helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function addMonthsToYM(ym: string, offset: number): { year: number; month: number; key: string } {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + offset;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return { year: newYear, month: newMonth, key: `${newYear}-${pad2(newMonth)}` };
}

// ── Core statistics ───────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Monthly prediction (for "Visão do Ano" / anual view) ──────────────────────

/**
 * Given the metrics object and a selected year, projects `horizon` future months
 * starting from the last month with data.
 *
 * Uses ALL historical grossMonthly values across ALL years to compute mean/stddev.
 */
export function predictMonthly(
  metrics: TableMetrics,
  selectedYear: string,
  horizon: number,
): PredictionPoint[] {
  // Collect all historical monthly revenue values
  const monthlyValues: number[] = [];
  for (const [, m] of Object.entries(metrics.byMonth)) {
    if (m.grossMonthly > 0) {
      monthlyValues.push(m.grossMonthly);
    }
  }

  if (monthlyValues.length < 2) return []; // Need at least 2 data points

  const avg = round2(mean(monthlyValues));
  const sd  = round2(stdDev(monthlyValues, avg));

  // Find the last month with data in the selected year
  const yearMonths = Object.keys(metrics.byMonth)
    .filter((k) => k.startsWith(selectedYear))
    .sort();

  // If no data in selected year, start from January of that year
  const lastDataMonth = yearMonths.length > 0
    ? yearMonths[yearMonths.length - 1]
    : `${selectedYear}-00`; // will become Jan after +1

  const points: PredictionPoint[] = [];

  for (let i = 1; i <= horizon; i++) {
    const { month, key } = addMonthsToYM(lastDataMonth, i);
    const monthIdx = month - 1; // 0-based for MONTH_NAMES_SHORT

    points.push({
      label: `⟨${MONTH_NAMES_SHORT[monthIdx]}⟩`,
      key,
      mean: avg,
      optimistic: round2(avg + sd),
      pessimistic: round2(Math.max(0, avg - sd)),
      isPrediction: true,
    });
  }

  return points;
}

// ── Yearly prediction (for "Visão Histórica" / global view) ───────────────────

/**
 * Projects `horizon` future years based on historical yearly revenue.
 */
export function predictYearly(
  metrics: TableMetrics,
  horizon: number,
): PredictionPoint[] {
  const yearlyValues: { year: number; gross: number }[] = [];
  for (const [yr, y] of Object.entries(metrics.byYear)) {
    if (y.grossAnnual > 0) {
      yearlyValues.push({ year: parseInt(yr), gross: y.grossAnnual });
    }
  }

  if (yearlyValues.length < 2) return [];

  const values = yearlyValues.map((v) => v.gross);
  const avg = round2(mean(values));
  const sd  = round2(stdDev(values, avg));

  const lastYear = Math.max(...yearlyValues.map((v) => v.year));

  const points: PredictionPoint[] = [];

  for (let i = 1; i <= horizon; i++) {
    const futureYear = lastYear + i;
    points.push({
      label: `⟨${futureYear}⟩`,
      key: String(futureYear),
      mean: avg,
      optimistic: round2(avg + sd),
      pessimistic: round2(Math.max(0, avg - sd)),
      isPrediction: true,
    });
  }

  return points;
}
