import { useState, useCallback, useMemo } from 'react';
import type { CoinTable, TableRow, TableGoals, TableMetrics, DB } from '../types';
import type { ImportedTable } from '../utils/csvIO';
import { computeMetrics } from './useMetricsEngine';

const STORAGE_KEY = 'coin_assistant_db';

const DEFAULT_GOALS: TableGoals = {
  dailyGoal: 50,
  weeklyGoal: 400,
  annualCosts: { [new Date().getFullYear()]: 15000 },
};

// ── Persistence helpers ───────────────────────────────────────────────────────

/**
 * One-time forward migration: tables stored with the old `annualCost: number`
 * field are promoted to `annualCosts: { [currentYear]: oldValue }`.
 * This runs on every load but is a no-op for already-migrated data.
 */
function migrateDB(db: DB): DB {
  const currentYear = new Date().getFullYear();
  return {
    tables: db.tables.map((table) => {
      // Double-cast through unknown to inspect the legacy `annualCost` field
      // that existed before the per-year annualCosts refactor.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawGoals = table.goals as unknown as Record<string, any>;
      if (typeof rawGoals['annualCost'] === 'number' && !rawGoals['annualCosts']) {
        const legacyCost = rawGoals['annualCost'] as number;
        const migratedGoals: TableGoals = {
          dailyGoal:   (rawGoals['dailyGoal']  as number) ?? DEFAULT_GOALS.dailyGoal,
          weeklyGoal:  (rawGoals['weeklyGoal'] as number) ?? DEFAULT_GOALS.weeklyGoal,
          annualCosts: { [currentYear]: legacyCost },
        };
        return { ...table, goals: migratedGoals };
      }
      if (!rawGoals['annualCosts']) {
        return {
          ...table,
          goals: { ...table.goals, annualCosts: {} } as TableGoals,
        };
      }
      return table;
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
      return computeMetrics(table.rows, table.goals.weeklyGoal);
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
    byYear: {},
    byMonth: {},
    byWeek: {},
  };
}
