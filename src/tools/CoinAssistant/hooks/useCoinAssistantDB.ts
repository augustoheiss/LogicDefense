import { useState, useCallback, useMemo } from 'react';
import type { CoinTable, TableRow, TableGoals, TableMetrics, DB, GoalProfile } from '../types';
import type { ImportedTable } from '../utils/csvIO';
import { computeMetrics, emptyMetrics } from './useMetricsEngine';
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
      // Universal Category Normalization: enforce uppercase and trim
      const normalizedRows = table.rows.map((row) => ({
        ...row,
        description: (row.description || 'SEM DESCRIÇÃO').toUpperCase().trim(),
      }));

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
      return { ...table, rows: normalizedRows, goals: migratedGoals };
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

  const moveTable = useCallback(
    (id: string, direction: 'up' | 'down') => {
      mutate((prev) => {
        const index = prev.tables.findIndex((t) => t.id === id);
        if (index === -1) return prev;
        if (direction === 'up' && index === 0) return prev;
        if (direction === 'down' && index === prev.tables.length - 1) return prev;

        const nextTables = [...prev.tables];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        const temp = nextTables[index];
        nextTables[index] = nextTables[swapIndex];
        nextTables[swapIndex] = temp;

        return { ...prev, tables: nextTables };
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
      const sanitizedRow = {
        ...row,
        description: (row.description || 'SEM DESCRIÇÃO').toUpperCase().trim(),
      };
      const newRow: TableRow = { ...sanitizedRow, id: uuid() };
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
      const sanitizedPatch = {
        ...patch,
        description: patch.description !== undefined
          ? (patch.description || 'SEM DESCRIÇÃO').toUpperCase().trim()
          : undefined,
      };
      mutate((prev) => ({
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                rows: t.rows
                  .map((r) => (r.id === rowId ? { ...r, ...sanitizedPatch } : r))
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

  /**
   * Insert multiple rows in a single mutation (used by prediction/cloning engine).
   * Each row receives a fresh UUID. Rows are sorted by date after insertion.
   */
  const bulkAddRows = useCallback(
    (tableId: string, newRows: Omit<TableRow, 'id'>[]): void => {
      if (newRows.length === 0) return;
      const sanitizedNewRows = newRows.map((r) => ({
        ...r,
        description: (r.description || 'SEM DESCRIÇÃO').toUpperCase().trim(),
        id: uuid(),
      }));
      mutate((prev) => ({
        tables: prev.tables.map((t) =>
          t.id === tableId
            ? {
                ...t,
                rows: [...t.rows, ...sanitizedNewRows]
                  .sort((a, b) => a.date.localeCompare(b.date)),
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      }));
    },
    [mutate],
  );

  /**
   * Delete all generated/predicted/cloned rows from a table.
   * @param prefix — optional date prefix filter:
   *   "2028"    → delete only generated rows in year 2028
   *   "2028-06" → delete only generated rows in June 2028
   *   undefined → delete ALL generated rows regardless of date
   */
  const deleteGeneratedData = useCallback(
    (tableId: string, prefix?: string): number => {
      let deletedCount = 0;
      mutate((prev) => ({
        tables: prev.tables.map((t) => {
          if (t.id !== tableId) return t;
          const remaining = t.rows.filter((r) => {
            if (!r.generatedBy) return true; // keep real rows
            if (prefix && !r.date.startsWith(prefix)) return true; // keep rows outside prefix
            deletedCount++;
            return false;
          });
          return { ...t, rows: remaining, updatedAt: new Date().toISOString() };
        }),
      }));
      return deletedCount;
    },
    [mutate],
  );

  /**
   * Effectuate ("Make Real") generated rows — strips the generatedBy and clonedFrom
   * flags, turning synthetic data into permanent historical records.
   * @param prefix — optional date prefix filter ("2026-06", "2026", or undefined for all).
   * @returns number of rows effectuated.
   */
  const effectuateGeneratedData = useCallback(
    (tableId: string, prefix?: string): number => {
      let count = 0;
      mutate((prev) => ({
        tables: prev.tables.map((t) => {
          if (t.id !== tableId) return t;
          const updatedRows = t.rows.map((r) => {
            if (!r.generatedBy) return r;
            if (prefix && !r.date.startsWith(prefix)) return r;
            count++;
            // Strip the synthetic flags — row becomes real
            const { generatedBy, clonedFrom, ...realRow } = r;
            return realRow as TableRow;
          });
          return { ...t, rows: updatedRows, updatedAt: new Date().toISOString() };
        }),
      }));
      return count;
    },
    [mutate],
  );

  /**
   * Bulk-delete REAL (non-generated) rows matching a date prefix.
   * @param prefix — date prefix ("2026" or "2026-05").
   * @returns number of rows deleted.
   */
  const deleteRealDataByPeriod = useCallback(
    (tableId: string, prefix: string): number => {
      let deletedCount = 0;
      mutate((prev) => ({
        tables: prev.tables.map((t) => {
          if (t.id !== tableId) return t;
          const remaining = t.rows.filter((r) => {
            // Only target real rows (no generatedBy flag)
            if (r.generatedBy) return true;
            if (!r.date.startsWith(prefix)) return true;
            deletedCount++;
            return false;
          });
          return { ...t, rows: remaining, updatedAt: new Date().toISOString() };
        }),
      }));
      return deletedCount;
    },
    [mutate],
  );

  // ── Computed ──────────────────────────────────────────────────────────────

  const getMetrics = useCallback(
    (tableId: string): TableMetrics => {
      const table = db.tables.find((t) => t.id === tableId);
      if (!table) return emptyMetrics();
      return computeMetrics(table.rows, table.goals);
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
    moveTable,
    addRow,
    updateRow,
    deleteRow,
    bulkAddRows,
    deleteGeneratedData,
    effectuateGeneratedData,
    deleteRealDataByPeriod,
    getMetrics,
  };
}
