// ─── Goal Hierarchy ───────────────────────────────────────────────────────────

/**
 * A complete set of financial targets for a single scope (global, year, or month).
 */
export interface GoalProfile {
  dailyGoal: number;
  weeklyGoal: number;
  annualCost: number;
}

// ─── Persisted Data ──────────────────────────────────────────────────────────

export interface TableRow {
  id: string;
  date: string;        // "YYYY-MM-DD"
  value: number;       // R$ amount; 0 = rest day (skipped in averages)
  description?: string;
  /**
   * Distinguishes revenue entries (default) from investment deposits.
   * Omitted on legacy rows — treated as 'revenue' for full backward compatibility.
   */
  entryType?: 'revenue' | 'deposit';
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
  dailyAvg: number;
  weeklyAvg: number;
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
   * current calendar week (inclusive), penalising every empty week at the
   * full weeklyGoal rate. Expressed in BRL.
   * Positive = excedente; negative = dívida pendente.
   */
  globalGoalBalance: number;
  /**
   * The exact number of real Mon–Sun calendar weeks that have elapsed since
   * the first recorded entry up to (and including) the current week.
   * Counted by the same strict loop as globalGoalBalance — always consistent.
   */
  totalElapsedWeeks: number;
  /**
   * Time Bank balance expressed in *weeks*.
   *   paidWeeks    = totalHistoricalRevenue / effectiveWeeklyGoal
   *   elapsedWeeks = floor((today − minDate) / 7 days)
   *   timeBankBalance = paidWeeks − elapsedWeeks
   * Positive = weeks of credit (ahead of schedule).
   * Negative = weeks of work still owed.
   */
  timeBankBalance: number;
  byYear: Record<string, YearMetrics>;   // "YYYY" → YearMetrics
  byMonth: Record<string, MonthMetrics>; // "YYYY-MM" → MonthMetrics
  byWeek: Record<string, number>;        // "YYYY-Www" → gross total
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
