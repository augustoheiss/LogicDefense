/**
 * Compound Interest Projection Engine
 *
 * Models the growth of a recurring monthly deposit over time using the
 * standard compound interest with periodic contributions formula:
 *
 *   Each month:
 *     1. Record the balance at the START of the month (previousBalance).
 *     2. Add the month's deposit to get the new principal.
 *     3. Interest accrues on that new total balance.
 *
 * Key derived metric — monthlyYield:
 *   monthlyYield = previousBalance × monthlyRate
 *
 *   This answers: "How much did my accumulated capital earn THIS month,
 *   independent of my new contribution?" It starts at R$ 0 on month 1
 *   and grows toward the monthly deposit value by year 6, visualising the
 *   point where passive income begins to replace physical labor.
 *
 *   Example (R$ 500 / month, 0.8 % / month):
 *     Month  1 → monthlyYield ≈  R$   0     (nothing invested yet)
 *     Month 12 → monthlyYield ≈  R$  48     (~10 % of the deposit)
 *     Month 36 → monthlyYield ≈  R$ 160     (~32 % of the deposit)
 *     Month 72 → monthlyYield ≈  R$ 384     (~77 % of the deposit)
 *
 * Default rate: 0.8 % per month ≈ 10.03 % per year (CDI / Tesouro Selic, 2026)
 */

import type { ProjectionPoint } from '../types';

export const DEFAULT_MONTHLY_RATE = 0.008; // 0.8 % / month
export const DEFAULT_MONTHS       = 72;    // 6 years

/**
 * Computes compound interest growth for a fixed monthly deposit.
 *
 * @param monthlyDeposit  Amount deposited each month (R$)
 * @param months          Total projection horizon (default 72 = 6 years)
 * @param monthlyRate     Monthly interest rate as a decimal (default 0.008)
 * @returns               Array of ProjectionPoint, one entry per month
 */
export function computeProjection(
  monthlyDeposit: number,
  months: number = DEFAULT_MONTHS,
  monthlyRate: number = DEFAULT_MONTHLY_RATE,
): ProjectionPoint[] {
  if (monthlyDeposit <= 0) return [];

  const points: ProjectionPoint[] = [];
  let runningBalance = 0;

  for (let m = 1; m <= months; m++) {
    // ── Step 1: capture balance before this month's deposit ───────────────────
    // This is the capital that "works by itself" this month.
    const previousBalance = runningBalance;

    // ── Step 2: add the month's deposit ──────────────────────────────────────
    runningBalance += monthlyDeposit;

    // ── Step 3: interest accrues on the full new balance ─────────────────────
    const interestThisMonth = runningBalance * monthlyRate;
    runningBalance += interestThisMonth;

    // ── Derived values ────────────────────────────────────────────────────────
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

// ── Summary ───────────────────────────────────────────────────────────────────

export interface ProjectionSummary {
  finalBalance: number;
  totalDeposited: number;
  totalInterest: number;
  /** Final monthly yield: how much the accumulated balance earns in one month */
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
