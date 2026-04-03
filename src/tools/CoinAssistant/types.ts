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
  dailyGoal: number;   // e.g. R$ 86.00  — daily revenue target
  weeklyGoal: number;  // e.g. R$ 600.00 — weekly revenue target
  annualCost: number;  // e.g. R$ 34,736.50 — total annual cost to cover
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
   * full weeklyGoal rate. Positive = excedente; negative = dívida pendente.
   */
  globalGoalBalance: number;
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
