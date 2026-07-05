/**
 * useCoinDB Hook — Assistente Moeda
 *
 * Unified data access layer that:
 *   1. Loads/saves data from AsyncStorage (local-first)
 *   2. Optionally syncs with Supabase (when authenticated + sync enabled)
 *   3. Exposes CRUD operations for tables and rows
 *   4. Computes derived metrics via the pure metricsEngine
 *
 * This is the single source of truth for all financial data in the app.
 */

import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { loadDB, saveDB, clearDB } from '../storage/asyncStorageAdapter';
import { computeMetrics, emptyMetrics, computeBaselineGoals } from '../core/metricsEngine';
import type { DB, CoinTable, TableRow, TableGoals, TableMetrics } from '../core/types';
import { useAuthContext } from './useAuth';
import { fullSync, pushToCloud, pullFromCloud } from '../storage/supabaseSync';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CoinDBState {
  /** Whether the DB is still loading from AsyncStorage */
  isLoading: boolean;
  /** All coin tables */
  tables: CoinTable[];
  /** Currently active table index */
  activeTableIndex: number;
  /** Currently active table (convenience accessor) */
  activeTable: CoinTable | null;
  /** Computed metrics for the active table */
  metrics: TableMetrics;
  /** Currently selected month filter (YYYY-MM or 'all') */
  selectedMonth: string;

  // ── Table Operations ──────────────────────────────────
  setActiveTableIndex: (index: number) => void;
  addTable: (name: string, description?: string, goals?: TableGoals, rows?: Omit<TableRow, 'id'>[]) => void;
  renameTable: (tableId: string, name: string) => void;
  deleteTable: (tableId: string) => void;

  // ── Row Operations ────────────────────────────────────
  addRow: (row: Omit<TableRow, 'id'>, tableName?: string) => Promise<void> | void;
  addRows: (rows: Omit<TableRow, 'id'>[], tableName?: string) => Promise<void> | void;
  updateRow: (rowId: string, updates: Partial<TableRow>) => void;
  deleteRow: (rowId: string) => void;
  deleteRowsByPrefix: (prefix: string) => number;
  deleteGeneratedRows: (prefix?: string) => number;
  effectuateGeneratedRows: (prefix?: string) => number;

  // ── Goals ─────────────────────────────────────────────
  updateGoals: (goals: Partial<TableGoals>) => void;

  // ── Month Filter ──────────────────────────────────────
  setSelectedMonth: (month: string) => void;

  // ── Time Machine / Cutoff ─────────────────────────────
  cutoffDate: string;
  setCutoffDate: (date: string) => void;

  // ── Filtered rows (by selectedMonth & cutoffDate) ─────
  filteredRows: TableRow[];

  // ── Available months (for picker) ─────────────────────
  availableMonths: string[];

  // ── AI Cost Control ───────────────────────────────────
  aiCostCurrentMonth: number;
  aiCostLastReset: string;
  addAICost: (costInBRL: number) => void;
  /** Manually trigger cloud synchronization */
  syncCloud: () => Promise<{ success: boolean; error?: string }>;
  /** Manually migrate local spreadsheets to cloud */
  migrateLocalToCloud: () => Promise<{ success: boolean; error?: string }>;
  /** Manually clear local AsyncStorage database cache */
  clearLocalState: () => Promise<void>;
  /** Deduct user tokens from Supabase user_settings */
  deductTokens: (amount: number) => Promise<void>;
}

// ── React Context ────────────────────────────────────────────────────────────

const CoinDBContext = createContext<CoinDBState | null>(null);

export function CoinDBProvider({ children }: { children: React.ReactNode }) {
  const state = useCoinDBInternal();
  return React.createElement(CoinDBContext.Provider, { value: state }, children);
}

export function useCoinDB(): CoinDBState {
  const context = useContext(CoinDBContext);
  if (!context) {
    throw new Error('useCoinDB must be used within a CoinDBProvider');
  }
  return context;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

function useCoinDBInternal(): CoinDBState {
  const [isLoading, setIsLoading] = useState(true);
  const [tables, setTables] = useState<CoinTable[]>([]);
  const [activeTableIndex, setActiveTableIndex] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [cutoffDate, setCutoffDate] = useState<string>('');
  const [aiCostCurrentMonth, setAiCostCurrentMonth] = useState<number>(0);
  const [aiCostLastReset, setAiCostLastReset] = useState<string>('');

  const auth = useAuthContext();

  // ── Load from AsyncStorage on mount ────────────────────
  useEffect(() => {
    async function init() {
      const db = await loadDB();
      if (db) {
        if (db.tables.length > 0) {
          setTables(db.tables);
        }
        setAiCostCurrentMonth(db.aiCostCurrentMonth ?? 0);
        setAiCostLastReset(db.aiCostLastReset ?? '');
      }
      setIsLoading(false);
    }
    init();
  }, []);

  // ── Hydrate from Cloud on Login (Pull remote data) ───
  const hydrateFromCloud = useCallback(async (userId: string, isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    let timeoutId: any = null;
    try {
      const pullPromise = pullFromCloud(userId);
      const timeoutPromise = new Promise<{ success: boolean; error?: string }>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout')), 4000);
      });

      const res = await Promise.race([pullPromise, timeoutPromise]) as { success: boolean; error?: string };
      if (res.success) {
        const db = await loadDB();
        if (db) {
          setTables(db.tables);
          setAiCostCurrentMonth(db.aiCostCurrentMonth ?? 0);
          setAiCostLastReset(db.aiCostLastReset ?? '');
        }
      } else {
        console.warn('pullFromCloud failed during hydration:', res.error);
        if (!isSilent) {
          setTimeout(() => {
            console.log('Retrying background sync silently...');
            hydrateFromCloud(userId, true).catch((e) => console.error('Background sync failed:', e));
          }, 15000);
        }
      }
    } catch (err: any) {
      console.warn('hydrateFromCloud timed out or encountered an error:', err);
      if (!isSilent) {
        setTimeout(() => {
          console.log('Retrying background sync silently after timeout...');
          hydrateFromCloud(userId, true).catch((e) => console.error('Background sync failed:', e));
        }, 15000);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  // ── Manual Sync trigger (Bidirectional push + pull) ────
  const syncCloud = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (auth.mode !== 'authenticated' || !auth.user) {
      return { success: false, error: 'User is not authenticated' };
    }
    setIsLoading(true);
    const res = await fullSync(auth.user.id);
    if (res.success) {
      const db = await loadDB();
      if (db) {
        setTables(db.tables);
        setAiCostCurrentMonth(db.aiCostCurrentMonth ?? 0);
        setAiCostLastReset(db.aiCostLastReset ?? '');
      }
    }
    setIsLoading(false);
    return res;
  }, [auth.mode, auth.user]);

  // ── Manual Local-to-Cloud Migration ────────────────────
  const migrateLocalToCloud = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (auth.mode !== 'authenticated' || !auth.user) {
      return { success: false, error: 'User is not authenticated' };
    }
    setIsLoading(true);
    const res = await pushToCloud(auth.user.id);
    setIsLoading(false);
    return res;
  }, [auth.mode, auth.user]);

  // ── Clear local database cache ─────────────────────────
  const clearLocalState = useCallback(async () => {
    await clearDB();
    setTables([]);
    setActiveTableIndex(0);
    setAiCostCurrentMonth(0);
    setAiCostLastReset('');
  }, []);

  // ── Sync from Cloud when Authenticated ─────────────────
  useEffect(() => {
    async function sync() {
      if (auth.mode === 'authenticated' && auth.user) {
        await hydrateFromCloud(auth.user.id);
      }
    }
    sync();
  }, [auth.mode, auth.user, hydrateFromCloud]);

  // ── Reset local state on Logout ────────────────────────
  useEffect(() => {
    if (auth.mode === 'guest' && !auth.user) {
      setTables([]);
      setAiCostCurrentMonth(0);
      setAiCostLastReset('');
      setActiveTableIndex(0);
    }
  }, [auth.mode, auth.user]);

  // ── Persist to AsyncStorage and Push to Cloud ──────────
  const persist = useCallback(async (newTables: CoinTable[]) => {
    setTables(newTables);
    const currentDB = await loadDB();
    await saveDB({
      tables: newTables,
      aiCostCurrentMonth: currentDB?.aiCostCurrentMonth ?? 0,
      aiCostLastReset: currentDB?.aiCostLastReset ?? '',
    });
    if (auth.mode === 'authenticated' && auth.user) {
      pushToCloud(auth.user.id).catch((err) => console.error('Cloud push failed:', err));
    }
  }, [auth.mode, auth.user]);

  const updateAICost = useCallback(async (newCost: number, newResetMonth: string) => {
    setAiCostCurrentMonth(newCost);
    setAiCostLastReset(newResetMonth);
    const currentDB = await loadDB();
    await saveDB({
      tables: currentDB?.tables || tables,
      aiCostCurrentMonth: newCost,
      aiCostLastReset: newResetMonth,
    });
    if (auth.mode === 'authenticated' && auth.user) {
      pushToCloud(auth.user.id).catch((err) => console.error('Cloud push failed:', err));
    }
  }, [auth.mode, auth.user, tables]);

  const addAICost = useCallback((costInBRL: number) => {
    const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    let updatedCost = aiCostCurrentMonth;
    if (aiCostLastReset !== currentMonthStr) {
      updatedCost = 0;
    }
    updatedCost += costInBRL;
    updateAICost(updatedCost, currentMonthStr);
  }, [aiCostCurrentMonth, aiCostLastReset, updateAICost]);

  // ── Active table ───────────────────────────────────────
  const activeTable = tables[activeTableIndex] ?? null;

  // ── Metrics (computed from active table) ───────────────
  const metrics = useMemo(() => {
    if (!activeTable) return emptyMetrics();
    const rowsToUse = cutoffDate
      ? activeTable.rows.filter((r) => r.date <= cutoffDate)
      : activeTable.rows;
    return computeMetrics(rowsToUse, activeTable.goals, cutoffDate || undefined);
  }, [activeTable, cutoffDate]);

  // ── Available months ───────────────────────────────────
  const availableMonths = useMemo(() => {
    if (!activeTable) return [];
    const months = new Set<string>();
    const rowsToUse = cutoffDate
      ? activeTable.rows.filter((r) => r.date <= cutoffDate)
      : activeTable.rows;
    for (const row of rowsToUse) {
      months.add(row.date.slice(0, 7));
    }
    return Array.from(months).sort().reverse();
  }, [activeTable, cutoffDate]);

  // ── Filtered rows ─────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!activeTable) return [];
    let rowsToUse = activeTable.rows;
    if (cutoffDate) {
      rowsToUse = rowsToUse.filter((r) => r.date <= cutoffDate);
    }
    if (selectedMonth === 'all') return rowsToUse;
    return rowsToUse.filter((r) => r.date.startsWith(selectedMonth));
  }, [activeTable, selectedMonth, cutoffDate]);

  // ── Table Operations ──────────────────────────────────
  const addTable = useCallback((
    name: string,
    description?: string,
    goals?: TableGoals,
    rows?: Omit<TableRow, 'id'>[]
  ) => {
    // Auto-seed baseline goals from imported rows when no explicit goals are provided
    let effectiveGoals = goals ?? { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} };
    const goalsAreEmpty = (
      Object.keys(effectiveGoals.dailyGoals || {}).length === 0 &&
      Object.keys(effectiveGoals.weeklyGoals || {}).length === 0 &&
      Object.keys(effectiveGoals.annualCosts || {}).length === 0 &&
      !effectiveGoals.globalGoals
    );
    if (goalsAreEmpty && rows && rows.length > 0) {
      const baseline = computeBaselineGoals(rows);
      if (baseline.globalGoals) {
        effectiveGoals = baseline;
      }
    }

    const newTable: CoinTable = {
      id: generateId(),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rows: rows ? rows.map((r) => ({ ...r, id: generateId() })) : [],
      goals: effectiveGoals,
    };
    const newTables = [...tables, newTable];
    persist(newTables);
    setActiveTableIndex(newTables.length - 1);
  }, [tables, persist]);

  const renameTable = useCallback((tableId: string, name: string) => {
    const newTables = tables.map((t) =>
      t.id === tableId ? { ...t, name, updatedAt: new Date().toISOString() } : t,
    );
    persist(newTables);
  }, [tables, persist]);

  const deleteTable = useCallback((tableId: string) => {
    const newTables = tables.filter((t) => t.id !== tableId);
    persist(newTables);
    if (activeTableIndex >= newTables.length) {
      setActiveTableIndex(Math.max(0, newTables.length - 1));
    }
  }, [tables, activeTableIndex, persist]);

  // ── Row Operations ────────────────────────────────────
  const addRow = useCallback(async (row: Omit<TableRow, 'id'>, tableName?: string) => {
    const targetIndex = tableName 
      ? tables.findIndex(t => t.name.toLowerCase().trim() === tableName.toLowerCase().trim())
      : activeTableIndex;

    const actualIndex = targetIndex !== -1 ? targetIndex : activeTableIndex;
    if (actualIndex < 0 || actualIndex >= tables.length) return;

    const normalizedDescription = row.description 
      ? row.description.toUpperCase().trim() 
      : undefined;

    const newRow: TableRow = { ...row, description: normalizedDescription, id: generateId() };
    const newTables = tables.map((t, i) => {
      if (i !== actualIndex) return t;
      return {
        ...t,
        rows: [...t.rows, newRow].sort((a, b) => a.date.localeCompare(b.date)),
        updatedAt: new Date().toISOString(),
      };
    });
    await persist(newTables);
  }, [tables, activeTableIndex, persist]);

  const addRows = useCallback(async (rows: Omit<TableRow, 'id'>[], tableName?: string) => {
    if (rows.length === 0) return;
    const targetIndex = tableName 
      ? tables.findIndex(t => t.name.toLowerCase().trim() === tableName.toLowerCase().trim())
      : activeTableIndex;

    const actualIndex = targetIndex !== -1 ? targetIndex : activeTableIndex;
    if (actualIndex < 0 || actualIndex >= tables.length) return;

    const newRows: TableRow[] = rows.map((r) => ({
      ...r,
      description: r.description ? r.description.toUpperCase().trim() : undefined,
      id: generateId()
    }));
    const newTables = tables.map((t, i) => {
      if (i !== actualIndex) return t;
      return {
        ...t,
        rows: [...t.rows, ...newRows].sort((a, b) => a.date.localeCompare(b.date)),
        updatedAt: new Date().toISOString(),
      };
    });
    await persist(newTables);
  }, [tables, activeTableIndex, persist]);

  const updateRow = useCallback((rowId: string, updates: Partial<TableRow>) => {
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.description) {
      normalizedUpdates.description = normalizedUpdates.description.toUpperCase().trim();
    }
    const newTables = tables.map((t, i) => {
      if (i !== activeTableIndex) return t;
      return {
        ...t,
        rows: t.rows.map((r) => (r.id === rowId ? { ...r, ...normalizedUpdates } : r)),
        updatedAt: new Date().toISOString(),
      };
    });
    persist(newTables);
  }, [tables, activeTableIndex, persist]);

  const deleteRow = useCallback((rowId: string) => {
    const newTables = tables.map((t, i) => {
      if (i !== activeTableIndex) return t;
      return {
        ...t,
        rows: t.rows.filter((r) => r.id !== rowId),
        updatedAt: new Date().toISOString(),
      };
    });
    persist(newTables);
  }, [tables, activeTableIndex, persist]);

  const deleteRowsByPrefix = useCallback((prefix: string): number => {
    if (!activeTable) return 0;
    let deletedCount = 0;
    const newTables = tables.map((t, i) => {
      if (i !== activeTableIndex) return t;
      const originalLength = t.rows.length;
      const keptRows = t.rows.filter((r) => {
        if (r.date.startsWith(prefix)) return false;
        return true;
      });
      deletedCount = originalLength - keptRows.length;
      return {
        ...t,
        rows: keptRows,
        updatedAt: new Date().toISOString(),
      };
    });
    persist(newTables);
    return deletedCount;
  }, [tables, activeTableIndex, activeTable, persist]);

  const deleteGeneratedRows = useCallback((prefix?: string): number => {
    let deletedCount = 0;
    const newTables = tables.map((t, i) => {
      if (i !== activeTableIndex) return t;
      const originalLength = t.rows.length;
      const keptRows = t.rows.filter((r) => {
        if (!r.generatedBy) return true;
        if (prefix && !r.date.startsWith(prefix)) return true;
        return false;
      });
      deletedCount = originalLength - keptRows.length;
      return {
        ...t,
        rows: keptRows,
        updatedAt: new Date().toISOString(),
      };
    });
    persist(newTables);
    return deletedCount;
  }, [tables, activeTableIndex, persist]);

  const effectuateGeneratedRows = useCallback((prefix?: string): number => {
    let effectuatedCount = 0;
    const newTables = tables.map((t, i) => {
      if (i !== activeTableIndex) return t;
      const updatedRows = t.rows.map((r) => {
        if (!r.generatedBy) return r;
        if (prefix && !r.date.startsWith(prefix)) return r;
        effectuatedCount++;
        const { generatedBy, clonedFrom, ...realRow } = r;
        return realRow as TableRow;
      });
      return {
        ...t,
        rows: updatedRows,
        updatedAt: new Date().toISOString(),
      };
    });
    persist(newTables);
    return effectuatedCount;
  }, [tables, activeTableIndex, persist]);

  // ── Goals ─────────────────────────────────────────────
  const updateGoals = useCallback((goalUpdates: Partial<TableGoals>) => {
    const newTables = tables.map((t, i) => {
      if (i !== activeTableIndex) return t;
      return {
        ...t,
        goals: { ...t.goals, ...goalUpdates },
        updatedAt: new Date().toISOString(),
      };
    });
    persist(newTables);
  }, [tables, activeTableIndex, persist]);

  const deductTokens = useCallback(async (amount: number) => {
    if (auth.mode === 'authenticated' && auth.user) {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('token_balance')
          .eq('id', auth.user.id)
          .maybeSingle();

        if (error) throw error;

        const currentBalance = data?.token_balance ? Number(data.token_balance) : 0;
        const newBalance = Math.max(0, currentBalance - amount);

        const { error: updateError } = await supabase
          .from('user_settings')
          .update({ token_balance: newBalance })
          .eq('id', auth.user.id);

        if (updateError) throw updateError;
      } catch (err) {
        console.error('Failed to deduct tokens:', err);
      }
    }
  }, [auth.mode, auth.user]);

  return {
    isLoading,
    tables,
    activeTableIndex,
    activeTable,
    metrics,
    selectedMonth,
    setActiveTableIndex,
    addTable,
    renameTable,
    deleteTable,
    addRow,
    addRows,
    updateRow,
    deleteRow,
    deleteRowsByPrefix,
    deleteGeneratedRows,
    effectuateGeneratedRows,
    updateGoals,
    setSelectedMonth,
    cutoffDate,
    setCutoffDate,
    filteredRows,
    availableMonths,
    aiCostCurrentMonth,
    aiCostLastReset,
    addAICost,
    syncCloud,
    migrateLocalToCloud,
    clearLocalState,
    deductTokens,
  };
}

// ── Utility ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
