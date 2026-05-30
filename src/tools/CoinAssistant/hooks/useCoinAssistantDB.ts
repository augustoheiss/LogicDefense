import { useState, useCallback, useMemo } from 'react';
import type { CoinTable, TableRow, TableGoals, TableMetrics, DB, GoalProfile } from '../types';
import type { ImportedTable } from '../utils/csvIO';
import { computeMetrics } from './useMetricsEngine';
import { resolveGoalForYear } from '../utils/dateUtils';

const STORAGE_KEY = 'coin_assistant_db';

const DEFAULT_GOAL_PROFILE: GoalProfile = {
  dailyGoal:  50,
  weeklyGoal: 400,
  annualCost: 15000,
};

const DEFAULT_GOALS: TableGoals = {
  // Legacy flat records — kept for calculateStrictGlobalBalance compatibility
  dailyGoals:  { [new Date().getFullYear()]: DEFAULT_GOAL_PROFILE.dailyGoal  },
  weeklyGoals: { [new Date().getFullYear()]: DEFAULT_GOAL_PROFILE.weeklyGoal },
  annualCosts: { [new Date().getFullYear()]: DEFAULT_GOAL_PROFILE.annualCost },
  // New hierarchical fields
  globalGoals: { ...DEFAULT_GOAL_PROFILE },
  yearlyGoals:  {},
  monthlyGoals: {},
};

// ── Persistence helpers ───────────────────────────────────────────────────────

/**
 * Forward migration applied on every DB load (idempotent):
 *
 *  v1 → v2  Scalar legacy fields (annualCost, dailyGoal, weeklyGoal) promoted
 *            to Record<year, number> flat records.
 *
 *  v2 → v3  Flat year Records synthesized into the new GoalProfile hierarchy:
 *            - yearlyGoals[year] is built from each year present in any of the
 *              three flat records, using resolveGoalForYear as fallback.
 *            - globalGoals is set from the most recent year's data (if not
 *              already present), giving a sensible ultimate fallback.
 */
function migrateDB(db: DB): DB {
  const currentYear = new Date().getFullYear();
  return {
    tables: db.tables.map((table) => {
      // Double-cast through unknown so we can inspect all legacy flat fields
      // (annualCost, dailyGoal, weeklyGoal) without TS2352 errors.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const old = table.goals as unknown as Record<string, any>;

      // ── v1 → v2: scalar → Record ─────────────────────────────────────────

      const annualCosts: Record<number, number> =
        old['annualCosts'] ??
        (typeof old['annualCost'] === 'number'
          ? { [currentYear]: old['annualCost'] as number }
          : {});

      const dailyGoals: Record<number, number> =
        old['dailyGoals'] ??
        (typeof old['dailyGoal'] === 'number'
          ? { [currentYear]: old['dailyGoal'] as number }
          : {});

      const weeklyGoals: Record<number, number> =
        old['weeklyGoals'] ??
        (typeof old['weeklyGoal'] === 'number'
          ? { [currentYear]: old['weeklyGoal'] as number }
          : {});

      // ── v2 → v3: flat Records → GoalProfile hierarchy ────────────────────

      // Collect every year that appears in any of the three flat records
      const allYears = Array.from(
        new Set([
          ...Object.keys(dailyGoals).map(Number),
          ...Object.keys(weeklyGoals).map(Number),
          ...Object.keys(annualCosts).map(Number),
        ]),
      ).sort((a, b) => a - b);

      // yearlyGoals: preserve existing or build from flat records per year
      const yearlyGoals: Record<number, GoalProfile> =
        (old['yearlyGoals'] as Record<number, GoalProfile> | undefined) ?? {};

      if (Object.keys(yearlyGoals).length === 0 && allYears.length > 0) {
        for (const year of allYears) {
          yearlyGoals[year] = {
            dailyGoal:  resolveGoalForYear(dailyGoals,  year),
            weeklyGoal: resolveGoalForYear(weeklyGoals, year),
            annualCost: resolveGoalForYear(annualCosts, year),
          };
        }
      }

      // globalGoals: preserve existing or derive from the most recent year
      const globalGoals: GoalProfile =
        (old['globalGoals'] as GoalProfile | undefined) ??
        (allYears.length > 0
          ? {
              dailyGoal:  resolveGoalForYear(dailyGoals,  allYears[allYears.length - 1]),
              weeklyGoal: resolveGoalForYear(weeklyGoals, allYears[allYears.length - 1]),
              annualCost: resolveGoalForYear(annualCosts, allYears[allYears.length - 1]),
            }
          : { ...DEFAULT_GOAL_PROFILE });

      // monthlyGoals: preserve existing (no legacy equivalent)
      const monthlyGoals: Record<string, GoalProfile> =
        (old['monthlyGoals'] as Record<string, GoalProfile> | undefined) ?? {};

      const migratedGoals: TableGoals = {
        dailyGoals,
        weeklyGoals,
        annualCosts,
        globalGoals,
        yearlyGoals,
        monthlyGoals,
      };
      return { ...table, goals: migratedGoals };
    }),
  };
}

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateDB(JSON.parse(raw) as DB);
  } catch {
    // ignore corrupt data
  }
  return { tables: [] };
}

function saveDB(db: DB): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function uuid(): string {
  return crypto.randomUUID();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCoinAssistantDB() {
  const [db, setDB] = useState<DB>(() => loadDB());
  const [activeTableId, setActiveTableId] = useState<string | null>(
    () => loadDB().tables[0]?.id ?? null,
  );

  const mutate = useCallback((updater: (prev: DB) => DB) => {
    setDB((prev) => {
      const next = updater(prev);
      saveDB(next);
      return next;
    });
  }, []);

  // ── Table CRUD ────────────────────────────────────────────────────────────

  const createTable = useCallback(
    (name: string, description?: string, goals?: Partial<TableGoals>): CoinTable => {
      const now = new Date().toISOString();
      const table: CoinTable = {
        id: uuid(),
        name: name.trim(),
        description,
        createdAt: now,
        updatedAt: now,
        rows: [],
        goals: { ...DEFAULT_GOALS, ...goals },
      };
      mutate((prev) => ({ tables: [...prev.tables, table] }));
      setActiveTableId(table.id);
      return table;
    },
    [mutate],
  );

  const renameTable = useCallback(
    (id: string, name: string) => {
      mutate((prev) => ({
        tables: prev.tables.map((t) =>
          t.id === id ? { ...t, name: name.trim(), updatedAt: new Date().toISOString() } : t,
        ),
      }));
    },
    [mutate],
  );

  const updateGoals = useCallback(
    (id: string, goals: Partial<TableGoals>) => {
      mutate((prev) => ({
        tables: prev.tables.map((t) =>
          t.id === id
            ? { ...t, goals: { ...t.goals, ...goals }, updatedAt: new Date().toISOString() }
            : t,
        ),
      }));
    },
    [mutate],
  );

  const updateTableDescription = useCallback(
    (id: string, description: string) => {
      mutate((prev) => ({
        tables: prev.tables.map((t) =>
          t.id === id ? { ...t, description, updatedAt: new Date().toISOString() } : t,
        ),
      }));
    },
    [mutate],
  );

  const deleteTable = useCallback(
    (id: string) => {
      mutate((prev) => {
        const next = prev.tables.filter((t) => t.id !== id);
        return { tables: next };
      });
      setActiveTableId((prev) => {
        if (prev !== id) return prev;
        const remaining = loadDB().tables.filter((t) => t.id !== id);
        return remaining[0]?.id ?? null;
      });
    },
    [mutate],
  );

  /**
   * Hydrates a fully-parsed ImportedTable into the DB in a single mutation.
   * New UUIDs are assigned to the table and every row so there are never collisions.
   */
  const importTable = useCallback(
    (data: ImportedTable): CoinTable => {
      const now = new Date().toISOString();
      const table: CoinTable = {
        id: uuid(),
        name: data.name.trim(),
        description: data.description,
        createdAt: now,
        updatedAt: now,
        rows: data.rows.map((r) => ({ ...r, id: uuid() })),
        goals: data.goals,
      };
      mutate((prev) => ({ tables: [...prev.tables, table] }));
      setActiveTableId(table.id);
      return table;
    },
    [mutate],
  );

  // ── Row CRUD ──────────────────────────────────────────────────────────────

  const addRow = useCallback(
    (tableId: string, row: Omit<TableRow, 'id'>): TableRow => {
      const newRow: TableRow = { ...row, id: uuid() };
      mutate((prev) => ({
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                rows: [...t.rows, newRow].sort((a, b) => a.date.localeCompare(b.date)),
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      }));
      return newRow;
    },
    [mutate],
  );

  const updateRow = useCallback(
    (tableId: string, rowId: string, patch: Partial<Omit<TableRow, 'id'>>) => {
      mutate((prev) => ({
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                rows: t.rows
                  .map((r) => (r.id === rowId ? { ...r, ...patch } : r))
                  .sort((a, b) => a.date.localeCompare(b.date)),
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      }));
    },
    [mutate],
  );

  const deleteRow = useCallback(
    (tableId: string, rowId: string) => {
      mutate((prev) => ({
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                rows: t.rows.filter((r) => r.id !== rowId),
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      }));
    },
    [mutate],
  );

  // ── Computed ──────────────────────────────────────────────────────────────

  const getMetrics = useCallback(
    (tableId: string): TableMetrics => {
      const table = db.tables.find((t) => t.id === tableId);
      if (!table) return emptyMetrics();
      return computeMetrics(table.rows, table.goals.weeklyGoals);
    },
    [db],
  );

  const activeTable = useMemo(
    () => db.tables.find((t) => t.id === activeTableId) ?? null,
    [db, activeTableId],
  );

  return {
    tables: db.tables,
    activeTableId,
    activeTable,
    setActiveTableId,
    createTable,
    importTable,
    renameTable,
    updateGoals,
    updateTableDescription,
    deleteTable,
    addRow,
    updateRow,
    deleteRow,
    getMetrics,
  };
}

// ── Empty metrics fallback ────────────────────────────────────────────────────

function emptyMetrics(): TableMetrics {
  return {
    grossTotal: 0,
    globalDailyAvg: 0,
    globalWeeklyAvg: 0,
    globalMonthlyAvg: 0,
    globalAnnualAvg: 0,
    globalGoalBalance: 0,
    totalElapsedWeeks: 0,
    waivedWeeks: 0,
    billableWeeks: 0,
    totalWaiverCredit: 0,
    timeBankBalance: 0,
    byYear: {},
    byMonth: {},
    byWeek: {},
    totalExpenses: 0,
    annualExpenses: 0,
    netBalance: 0,
    survivalDaily: 0,
    survivalWeekly: 0,
    survivalMonthly: 0,
    survivalAnnualCost: 0,
    depositCount: 0,
    totalInvested: 0,
    totalInterestEarned: 0,
    investmentBalance: 0,
  };
}
