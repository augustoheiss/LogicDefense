/**
 * Projection Engine — Assistente Moeda (React Native)
 *
 * Compound interest projection with periodic monthly contributions.
 * Migrated with import path updated to './types'.
 */

import type { ProjectionPoint } from './types';

export const DEFAULT_MONTHLY_RATE = 0.008; // 0.8% / month
export const DEFAULT_MONTHS       = 72;    // 6 years

export function computeProjection(
  monthlyDeposit: number,
  months: number = DEFAULT_MONTHS,
  monthlyRate: number = DEFAULT_MONTHLY_RATE,
): ProjectionPoint[] {
  if (monthlyDeposit <= 0) return [];

  const points: ProjectionPoint[] = [];
  let runningBalance = 0;

  for (let m = 1; m <= months; m++) {
    const previousBalance = runningBalance;
    runningBalance += monthlyDeposit;
    const interestThisMonth = runningBalance * monthlyRate;
    runningBalance += interestThisMonth;

    const monthlyYield        = round2(previousBalance * monthlyRate);
    const totalDeposited      = round2(monthlyDeposit * m);
    const totalBalance        = round2(runningBalance);
    const accumulatedInterest = round2(totalBalance - totalDeposited);

    points.push({
      month: m,
      totalDeposited,
      accumulatedInterest,
      totalBalance,
      monthlyYield,
    });
  }

  return points;
}

export interface ProjectionSummary {
  finalBalance: number;
  totalDeposited: number;
  totalInterest: number;
  finalMonthlyYield: number;
  multiplier: number;
}

export function getProjectionSummary(
  points: ProjectionPoint[],
): ProjectionSummary | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  return {
    finalBalance:      last.totalBalance,
    totalDeposited:    last.totalDeposited,
    totalInterest:     last.accumulatedInterest,
    finalMonthlyYield: last.monthlyYield,
    multiplier:        round2(last.totalBalance / last.totalDeposited),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
