// ─── Goal Hierarchy ───────────────────────────────────────────────────────────

/**
 * A complete set of financial targets for a single scope (global, year, or month).
 */
export interface GoalProfile {
  dailyGoal: number;
  weeklyGoal: number;
  annualCost: number;
}

/**
 * Cost-based survival targets derived from the actual day span of expense data.
 * These are never persisted — always computed on the fly using:
 *   dailyCost = totalExpenses / daySpan  (earliest→latest expense, inclusive)
 * All other targets are simple multiples of dailyCost.
 */
export interface CostBasedTarget {
  /** dailyCost × 7 — minimum weekly revenue to cover operating costs. */
  weeklySurvival: number;
  /** dailyCost — minimum daily revenue to cover operating costs. */
  dailySurvival: number;
  /** dailyCost × 30 — minimum monthly revenue to cover operating costs. */
  monthlySurvival: number;
  /** dailyCost × 365 — projected annual operating cost. */
  annualCost: number;
}

// ─── Persisted Data ──────────────────────────────────────────────────────────

export interface TableRow {
  id: string;
  date: string;        // "YYYY-MM-DD"
  /**
   * Meaning depends on entryType:
   *   'revenue'  → R$ earned (0 = rest day, skipped in averages)
   *   'deposit'  → R$ invested
   *   'waiver'   → days justified (waiverMode='days') or direct R$ credit (waiverMode='value')
   *   'expense'  → dynamic cost entry; value = monthlyValue × monthCount
   */
  value: number;
  description?: string;
  /**
   *   'revenue'  — operational income (default for legacy rows)
   *   'deposit'  — investment / aporte
   *   'waiver'   — excused downtime period or direct monetary justification.
   *                date = start of the period; description = reason
   *   'expense'  — dynamic cost (e.g. insurance, IPVA, financing);
   *                value = monthlyValue × monthCount (auto-computed on creation)
   *   'partner_in'  — partnership credit / reimbursement. Isolated from grossTotal;
   *                    adds to totalPartnerIn and globalGoalBalance.
   *   'partner_out' — partnership debit / charge. Isolated from totalExpenses;
   *                    adds to totalPartnerOut and subtracts from globalGoalBalance.
   * Omitted on legacy rows — treated as 'revenue' for full backward compatibility.
   */
  entryType?: 'revenue' | 'deposit' | 'waiver' | 'expense' | 'partner_in' | 'partner_out';
  /**
   * For 'waiver' entries only — how to interpret the value field:
   *   'days'  — value = number of justified days (default, backward-compatible)
   *   'value' — value = direct R$ monetary credit
   */
  waiverMode?: 'days' | 'value';
  /**
   * For 'expense' entries only — the monthly cost amount (R$).
   * Used to reconstruct the total: value = monthlyValue × monthCount.
   */
  monthlyValue?: number;
  /**
   * For 'expense' entries only — how many months this cost spans.
   * Used to reconstruct the total: value = monthlyValue × monthCount.
   */
  monthCount?: number;
  /**
   * Optional period start date for 'revenue' (and 'expense') entries.
   * When set alongside periodEnd, the metrics engine distributes row.value
   * across every calendar day in [periodStart, periodEnd] so that lump-sum
   * payments don't inflate daily/weekly/monthly averages.
   * For single-day entries leave undefined.
   */
  periodStart?: string; // "YYYY-MM-DD"
  /**
   * Optional period end date — must be set together with periodStart.
   * row.date is set to periodStart on creation for backward‑compat.
   */
  periodEnd?: string;   // "YYYY-MM-DD"
}

export interface TableGoals {
  // ── Legacy flat records (kept for backward compat with calculateStrictGlobalBalance) ──
  /**
   * Per-calendar-year daily revenue target (e.g. { 2026: 86.00 }).
   * Year-keyed so changing the 2027 target never overwrites 2026 history.
   */
  dailyGoals: Record<number, number>;
  /**
   * Per-calendar-year weekly revenue target (e.g. { 2026: 600.00 }).
   * Used by calculateStrictGlobalBalance to score each historical week
   * against the goal that was in effect for THAT specific year.
   */
  weeklyGoals: Record<number, number>;
  /**
   * Per-calendar-year vehicle/operating cost target.
   * Key = full year number (e.g. 2026), value = cost in BRL.
   */
  annualCosts: Record<number, number>;

  // ── New hierarchical goal system (additive — never replaces legacy records) ──
  /**
   * The ultimate fallback. Applied whenever no yearly or monthly override exists.
   */
  globalGoals?: GoalProfile;
  /**
   * Per-year overrides. Key = year number (can be any year, past or future).
   * Overrides globalGoals for that specific year.
   */
  yearlyGoals?: Record<number, GoalProfile>;
  /**
   * Per-month overrides. Key = "YYYY-MM".
   * Overrides both yearlyGoals and globalGoals for that specific month.
   */
  monthlyGoals?: Record<string, GoalProfile>;
}

export interface CoinTable {
  id: string;
  name: string;
  description?: string;
  createdAt: string;   // ISO timestamp
  updatedAt: string;   // ISO timestamp
  rows: TableRow[];
  goals: TableGoals;
}

export type DB = { tables: CoinTable[] };

// ─── Computed Metrics (never persisted, always derived) ───────────────────────

export interface MonthMetrics {
  grossMonthly: number;
  dailyAvg: number;
  weeklyAvg: number;
  lastWeekGross: number;
  dailyPayments: Record<string, number>; // "YYYY-MM-DD" → value
}

export interface YearMetrics {
  grossAnnual: number;
  /** Year-scoped expenses: sum of expense values prorated to this year.
   *  Point-in-time: full value. Multi-year: dailyRate × overlapDays. */
  yearExpenses: number;
  dailyAvg: number;
  /** grossAnnual / number of active weeks in this year */
  weeklyAvg: number;
  /** grossAnnual / number of active months in this year */
  monthlyAvg: number;
}

export interface TableMetrics {
  grossTotal: number;
  globalDailyAvg: number;
  globalWeeklyAvg: number;
  globalMonthlyAvg: number;
  globalAnnualAvg: number;
  /**
   * Strict cumulative goal balance from the first recorded entry to the
   * current calendar week (inclusive), with waiver credits applied.
   * Positive = excedente; negative = dívida pendente.
   */
  globalGoalBalance: number;
  /**
   * The exact number of real Mon–Sun calendar weeks that have elapsed since
   * the first recorded entry up to (and including) the current week.
   */
  totalElapsedWeeks: number;
  /**
   * Total excused weeks derived from all 'waiver' rows:
   *   waivedWeeks = sum(waiver.value) / 7
   * This does NOT reduce totalElapsedWeeks — it only offsets the debt.
   */
  waivedWeeks: number;
  /**
   * The weeks the driver is actually accountable for:
   *   billableWeeks = totalElapsedWeeks - waivedWeeks
   */
  billableWeeks: number;
  /**
   * The total BRL amount credited back to globalGoalBalance from all waivers.
   * Each waiver row's credit = (row.value / 7) × weeklyGoalForThatYear.
   */
  totalWaiverCredit: number;
  /**
   * Time Bank balance expressed in *weeks*:
   *   timeBankBalance = finalGlobalGoalBalance / currentEffectiveWeeklyGoal
   * Positive = weeks of credit; Negative = weeks of work still owed.
   */
  timeBankBalance: number;
  byYear: Record<string, YearMetrics>;   // "YYYY" → YearMetrics
  byMonth: Record<string, MonthMetrics>; // "YYYY-MM" → MonthMetrics
  byWeek: Record<string, number>;        // "YYYY-Www" → gross total
  /**
   * Sum of all 'expense' row values ONLY (dynamic costs like insurance, IPVA).
   * Partner_out is NOT included — use expensesWithPartner for full outflows.
   */
  totalExpenses: number;
  /**
   * Global expense total — always equals totalExpenses.
   * Per-year breakdowns live in byYear[year].yearExpenses.
   */
  annualExpenses: number;
  /**
   * Net balance = grossTotal − totalExpenses (pure operational).
   * Represents the real cash position after deducting registered operational costs.
   */
  netBalance: number;

  // ─── Survival / Break-Even Goals (always computed, never toggled) ──────────
  /**
   * Break-even daily revenue needed to cover operating costs.
   * Computed from prorated daily expense rate across ALL expense rows.
   *   survivalDaily = totalExpenses / globalExpenseDaySpan
   * Returns 0 when no expenses exist.
   */
  survivalDaily: number;
  /** survivalDaily × 7 */
  survivalWeekly: number;
  /** survivalDaily × 30.44 */
  survivalMonthly: number;
  /** survivalDaily × 365.25 — projected annual cost burden. */
  survivalAnnualCost: number;

  // ─── Investment / Deposit Metrics (compound interest at 0.8%/month) ────────
  /** Number of 'deposit' entries. */
  depositCount: number;
  /** Sum of all 'deposit' row values (the user's physical effort). */
  totalInvested: number;
  /** Total compound interest earned across all months with deposits. */
  totalInterestEarned: number;
  /** Current balance: totalInvested + totalInterestEarned. */
  investmentBalance: number;

  // ─── Advanced Statistics (deterministic, never let the LLM compute these) ──
  /** Largest single revenue transaction value. */
  maxTransaction: number;
  /** Smallest single revenue transaction value (among value > 0). */
  minTransaction: number;
  /** Median revenue transaction value (50th percentile). */
  medianTransaction: number;
  /** Most frequent revenue transaction value. 0 if no repeats. */
  modeTransaction: number;
  /** Population standard deviation of revenue transaction values. */
  stdDeviation: number;

  // ─── Partnership Ledger (isolated third-party transactions) ─────────────────
  /** Sum of all 'partner_in' row values (credits received). */
  totalPartnerIn: number;
  /** Sum of all 'partner_out' row values (debits paid). */
  totalPartnerOut: number;

  // ─── Combined Metrics (operational + partnership) ──────────────────────────
  /** grossTotal + totalPartnerIn — full cash inflow picture. */
  grossWithPartner: number;
  /** totalExpenses + totalPartnerOut — full cash outflow picture. */
  expensesWithPartner: number;
  /** grossWithPartner − expensesWithPartner — net position including partnership. */
  netWithPartner: number;
}

// ─── Projection Engine ────────────────────────────────────────────────────────

export interface ProjectionPoint {
  month: number;               // 1 – 72
  totalDeposited: number;      // cumulative principal (n × monthlyDeposit)
  accumulatedInterest: number; // total yield earned so far
  totalBalance: number;        // totalDeposited + accumulatedInterest
  /**
   * Interest earned in this specific month only.
   * Formula: previousBalance (before this month's deposit) × monthlyRate.
   * Starts at 0 on month 1 (nothing invested yet) and grows toward the monthly
   * deposit value by year 6 — visualising the "money replacing labor" effect.
   */
  monthlyYield: number;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ModalMode = 'create' | 'edit' | null;
