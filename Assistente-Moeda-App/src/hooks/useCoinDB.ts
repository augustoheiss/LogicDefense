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

import React, { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import { Platform } from 'react-native';
import { loadDB, saveDB, clearDB } from '../storage/asyncStorageAdapter';
import { computeMetrics, emptyMetrics, computeBaselineGoals } from '../core/metricsEngine';
import type { DB, CoinTable, TableRow, TableGoals, TableMetrics } from '../core/types';
import { useAuthContext } from './useAuth';
import { fullSync, pushToCloud, pullFromCloud } from '../storage/supabaseSync';
import { supabase } from '@/lib/supabase';
import { mergeRows } from '../utils/csvEngine';
import { ensureApiKeyForTable, generateLocalApiKey } from '../services/exportService';
import { validateApiKey, generateNewApiKey } from '../services/apiKeyService';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CoinDBState {
  /** Whether the DB is still loading from AsyncStorage */
  isLoading: boolean;
  /** All coin tables */
  tables: CoinTable[];
  /** Active coin tables (excluding deleted) */
  activeTables: CoinTable[];
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
  importSpreadsheet: (payload: {
    rows: (TableRow | Omit<TableRow, 'id'>)[];
    tableId?: string;
    apiKey?: string;
    lastEventSeq?: number;
    name?: string;
    description?: string;
    goals?: TableGoals;
    mode?: 'replace' | 'merge';
  }) => Promise<{
    success: boolean;
    tableId: string;
    keyWasAutoRenewed: boolean;
    message: string;
    apiKey: string;
  }>;
  addTable: (name: string, description?: string, goals?: TableGoals, rows?: Omit<TableRow, 'id'>[]) => void;
  renameTable: (tableId: string, name: string) => void;
  deleteTable: (tableId: string) => void;
  reorderTables: (fromIndex: number, toIndex: number) => Promise<void> | void;

  // ── Row Operations ────────────────────────────────────
  addRow: (row: Omit<TableRow, 'id'>, tableName?: string) => Promise<void> | void;
  addRows: (rows: Omit<TableRow, 'id'>[], tableName?: string) => Promise<void> | void;
  updateActiveTableRows: (rows: (TableRow | Omit<TableRow, 'id'>)[]) => Promise<void> | void;
  updateActiveTableName: (newName: string) => Promise<void> | void;
  updateRow: (rowId: string, updates: Partial<TableRow>) => void;
  renameCategoryInBulk: (oldCategoryName: string, newCategoryName: string, entryType?: string) => Promise<void> | void;
  deleteRow: (rowId: string) => void;
  deleteLastRow: () => Promise<void> | void;
  deleteRowsByPrefix: (prefix: string) => number;
  deleteGeneratedRows: (prefix?: string) => number;
  effectuateGeneratedRows: (prefix?: string) => number;

  // ── Goals ─────────────────────────────────────────────
  updateGoals: (goals: Partial<TableGoals>) => void;
  updateActiveSectors: (sectors: string[]) => void;

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
          // Auto-purge any historical tombstoned/zombie tables
          const cleaned = db.tables.filter((t) => !t.isDeleted);
          setTables(ensureActiveSectors(cleaned));
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
      const pullPromise = pullFromCloud();
      const timeoutPromise = new Promise<{ success: boolean; error?: string }>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout')), 4000);
      });

      const res = await Promise.race([pullPromise, timeoutPromise]) as { success: boolean; error?: string };
      if (res.success) {
        const db = await loadDB();
        if (db) {
          setTables(ensureActiveSectors(db.tables));
          setAiCostCurrentMonth(db.aiCostCurrentMonth ?? 0);
          setAiCostLastReset(db.aiCostLastReset ?? '');
          // Keep active table index within valid bounds of the newly loaded tables
          if (activeTableIndex >= db.tables.length) {
            setActiveTableIndex(Math.max(0, db.tables.length - 1));
          }
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
  }, [activeTableIndex]);

  // ── Manual Sync trigger (Bidirectional push + pull) ────
  const syncCloud = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (auth.mode !== 'authenticated' || !auth.user) {
      return { success: false, error: 'User is not authenticated' };
    }
    setIsLoading(true);
    try {
      const res = await fullSync();
      if (res.success) {
        const db = await loadDB();
        if (db) {
          setTables(ensureActiveSectors(db.tables));
          setAiCostCurrentMonth(db.aiCostCurrentMonth ?? 0);
          setAiCostLastReset(db.aiCostLastReset ?? '');
          // Keep active table index within valid bounds of the newly loaded tables
          if (activeTableIndex >= db.tables.length) {
            setActiveTableIndex(Math.max(0, db.tables.length - 1));
          }
        }
      }
      return res;
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      return { success: false, error: err?.message || 'Sync failed' };
    } finally {
      setIsLoading(false);
    }
  }, [auth.mode, auth.user, activeTableIndex]);

  // ── Manual Local-to-Cloud Migration ────────────────────
  const migrateLocalToCloud = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (auth.mode !== 'authenticated' || !auth.user) {
      return { success: false, error: 'User is not authenticated' };
    }
    setIsLoading(true);
    try {
      const res = await pushToCloud();
      return res;
    } catch (err: any) {
      console.error('Cloud migration failed:', err);
      return { success: false, error: err?.message || 'Migration failed' };
    } finally {
      setIsLoading(false);
    }
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

  const tablesRef = useRef<CoinTable[]>(tables);
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  // ── Persist to AsyncStorage and Push to Cloud ──────────
  const persist = useCallback(async (newTables: CoinTable[]) => {
    const mainTables = ensureActiveSectors(newTables);
    tablesRef.current = mainTables;
    setTables(mainTables);
    const currentDB = await loadDB();
    await saveDB({
      tables: mainTables,
      aiCostCurrentMonth: currentDB?.aiCostCurrentMonth ?? 0,
      aiCostLastReset: currentDB?.aiCostLastReset ?? '',
    });
    if (auth.mode === 'authenticated' && auth.user) {
      // Non-blocking bidirectional background fullSync to pull/merge remote data and push merged state
      fullSync().then(async (res) => {
        if (res.success) {
          const db = await loadDB();
          if (db && db.tables && db.tables.length > 0) {
            setTables((prevTables) => {
              const remoteTables = ensureActiveSectors(db.tables);
              if (remoteTables.length < prevTables.length) {
                return prevTables;
              }
              return remoteTables;
            });
            setAiCostCurrentMonth(db.aiCostCurrentMonth ?? 0);
            setAiCostLastReset(db.aiCostLastReset ?? '');
            if (activeTableIndex >= db.tables.length) {
              setActiveTableIndex(Math.max(0, db.tables.length - 1));
            }
          }
        }
      }).catch((err) => {
        console.error('Cloud background sync failed:', err);
      });
    }
  }, [auth.mode, auth.user, activeTableIndex]);

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
      fullSync().catch((err) => {
        console.error('Cloud background sync failed:', err);
      });
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

  // Filter out tombstoned tables for the UI
  const activeTables = useMemo(() => tables.filter((t) => !t.isDeleted), [tables]);

  // ── Active table ───────────────────────────────────────
  const activeTable = useMemo(() => {
    if (activeTables.length === 0) return null;
    const currentTable = (activeTableIndex >= 0 && activeTableIndex < activeTables.length)
      ? activeTables[activeTableIndex]
      : activeTables[0];
    if (!currentTable) return null;
    return {
      ...currentTable,
      rows: [...currentTable.rows],
    };
  }, [activeTables, activeTableIndex]);

  // ── Reactive API Key Isolation & Self-Healing per Table ─
  useEffect(() => {
    if (activeTables.length > 0 && Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const seenKeys = new Set<string>();
      for (const t of activeTables) {
        const tid = t.id;
        let key = window.localStorage.getItem(`coin_api_key_${tid}`);
        if (!key || !key.startsWith('am_sheet_live_') || seenKeys.has(key)) {
          const newKey = generateLocalApiKey(tid);
          window.localStorage.setItem(`coin_api_key_${tid}`, newKey);
          ensureApiKeyForTable(tid).catch(() => {});
          key = newKey;
        }
        seenKeys.add(key);
      }
    }
  }, [activeTables]);

  useEffect(() => {
    const activeTableId = activeTable?.id;
    if (!activeTableId || Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) return;

    let tableKey = window.localStorage.getItem(`coin_api_key_${activeTableId}`);
    if (tableKey && tableKey.startsWith('am_sheet_live_')) {
      window.localStorage.setItem('coin_active_api_key', tableKey);
      window.dispatchEvent(new CustomEvent('coin_sync_requested', {
        detail: { tableId: activeTableId, apiKey: tableKey }
      }));
    } else {
      ensureApiKeyForTable(activeTableId).then((newKey) => {
        window.localStorage.setItem(`coin_api_key_${activeTableId}`, newKey);
        window.localStorage.setItem('coin_active_api_key', newKey);
        window.dispatchEvent(new CustomEvent('coin_sync_requested', {
          detail: { tableId: activeTableId, apiKey: newKey }
        }));
      });
    }
  }, [activeTable?.id]);

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

    const tableId = generateId();
    const newTable: CoinTable = {
      id: tableId,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rows: rows ? rows.map((r) => ({ ...r, id: generateId() })) : [],
      goals: effectiveGoals,
      activeSectors: ['personal_finance'],
    };
    ensureApiKeyForTable(tableId).catch(() => {});
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
    
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(`coin_api_key_${tableId}`);
      window.localStorage.removeItem(`coin_last_seq_${tableId}`);
      window.localStorage.removeItem(`coin_expires_at_${tableId}`);
    }

    if (activeTableIndex >= newTables.length) {
      setActiveTableIndex(Math.max(0, newTables.length - 1));
    }
  }, [tables, activeTableIndex, persist]);

  // ── Row Operations ────────────────────────────────────
  const addRow = useCallback(async (row: Omit<TableRow, 'id'>, tableName?: string) => {
    const targetTable = tableName 
      ? tables.find(t => !t.isDeleted && t.name.toLowerCase().trim() === tableName.toLowerCase().trim())
      : activeTable;

    if (!targetTable) return;

    const normalizedDescription = row.description 
      ? row.description.toUpperCase().trim() 
      : undefined;

    const newRow: TableRow = { ...row, description: normalizedDescription, id: generateId() };
    const newTables = tables.map((t) => {
      if (t.id !== targetTable.id) return t;
      return {
        ...t,
        rows: [...t.rows, newRow].sort((a, b) => a.date.localeCompare(b.date)),
        updatedAt: new Date().toISOString(),
      };
    });
    await persist(newTables);
  }, [tables, activeTable, persist]);

  const addRows = useCallback(async (rows: Omit<TableRow, 'id'>[], tableName?: string) => {
    if (rows.length === 0) return;
    let targetTable = tableName 
      ? tables.find(t => !t.isDeleted && t.name.toLowerCase().trim() === tableName.toLowerCase().trim())
      : activeTable;

    let baseTables = tables;

    if (!targetTable) {
      const newTable: CoinTable = {
        id: generateId(),
        name: tableName || 'Minha Planilha',
        description: 'Planilha principal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rows: [],
        goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
        activeSectors: ['personal_finance'],
      };
      baseTables = [...tables, newTable];
      targetTable = newTable;
      setActiveTableIndex(baseTables.length - 1);
    }

    const newRows: TableRow[] = rows.map((r) => ({
      ...r,
      description: r.description ? r.description.toUpperCase().trim() : undefined,
      id: generateId()
    }));
    const newTables = baseTables.map((t) => {
      if (t.id !== targetTable!.id) return t;
      return {
        ...t,
        rows: [...t.rows, ...newRows].sort((a, b) => a.date.localeCompare(b.date)),
        updatedAt: new Date().toISOString(),
      };
    });
    await persist(newTables);
  }, [tables, activeTable, persist]);

  const updateRow = useCallback((rowId: string, updates: Partial<TableRow>) => {
    if (!activeTable) return;
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.description) {
      normalizedUpdates.description = normalizedUpdates.description.toUpperCase().trim();
    }
    const newTables = tables.map((t) => {
      if (t.id !== activeTable.id) return t;
      return {
        ...t,
        rows: t.rows.map((r) => (r.id === rowId ? { ...r, ...normalizedUpdates } : r)),
        updatedAt: new Date().toISOString(),
      };
    });
    persist(newTables);
  }, [tables, activeTable, persist]);

  const deleteRow = useCallback((rowId: string) => {
    if (!activeTable) return;
    const newTables = tables.map((t) => {
      if (t.id !== activeTable.id) return t;
      return {
        ...t,
        rows: t.rows.filter((r) => r.id !== rowId),
        updatedAt: new Date().toISOString(),
      };
    });
    persist(newTables);
  }, [tables, activeTable, persist]);

  const updateActiveTableRows = useCallback(async (newRows: (TableRow | Omit<TableRow, 'id'>)[]) => {
    let targetTable = activeTable;
    let baseTables = tables;

    if (!targetTable) {
      const newTable: CoinTable = {
        id: generateId(),
        name: 'Minha Planilha',
        description: 'Planilha principal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rows: [],
        goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
        activeSectors: ['personal_finance'],
      };
      baseTables = [...tables, newTable];
      targetTable = newTable;
      setActiveTableIndex(baseTables.length - 1);
    }

    const formattedRows: TableRow[] = newRows.map((r) => ({
      ...r,
      id: 'id' in r && r.id ? r.id : generateId(),
    }));

    const newTables = baseTables.map((t) => {
      if (t.id !== targetTable!.id) return t;
      return {
        ...t,
        rows: [...formattedRows].sort((a, b) => a.date.localeCompare(b.date)),
        updatedAt: new Date().toISOString(),
      };
    });
    await persist(newTables);
  }, [tables, activeTable, persist]);

  const updateActiveTableName = useCallback(async (newName: string) => {
    if (!activeTable || !newName.trim()) return;
    const newTables = tables.map((t) => {
      if (t.id !== activeTable.id) return t;
      return {
        ...t,
        name: newName.trim(),
        updatedAt: new Date().toISOString(),
      };
    });
    await persist(newTables);
  }, [tables, activeTable, persist]);

  const renameCategoryInBulk = useCallback(async (oldCategoryName: string, newCategoryName: string, entryType?: string) => {
    if (!activeTable || !oldCategoryName.trim() || !newCategoryName.trim()) return;
    const cleanOld = oldCategoryName.trim().toUpperCase();
    const cleanNew = newCategoryName.trim().toUpperCase();

    const newTables = tables.map((t) => {
      if (t.id !== activeTable.id) return t;
      const updatedRows = t.rows.map((r) => {
        const matchesType = !entryType || r.entryType === entryType;
        const matchesCategory = 
          (r.description && r.description.trim().toUpperCase() === cleanOld) ||
          (r.category && r.category.trim().toUpperCase() === cleanOld);

        if (matchesType && matchesCategory) {
          return {
            ...r,
            description: cleanNew,
            category: cleanNew,
          };
        }
        return r;
      });

      return {
        ...t,
        rows: updatedRows,
        updatedAt: new Date().toISOString(),
      };
    });

    await persist(newTables);
  }, [tables, activeTable, persist]);

  const reorderTables = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= tables.length || toIndex < 0 || toIndex >= tables.length) return;
    if (fromIndex === toIndex) return;

    const activeTableId = activeTable?.id;
    const newTables = [...tables];
    const [moved] = newTables.splice(fromIndex, 1);
    newTables.splice(toIndex, 0, moved);

    if (activeTableId) {
      const newActiveIdx = newTables.findIndex(t => t.id === activeTableId);
      if (newActiveIdx !== -1) {
        setActiveTableIndex(newActiveIdx);
      }
    }

    await persist(newTables);
  }, [tables, activeTable, persist]);

  const deleteLastRow = useCallback(async () => {
    if (!activeTable || activeTable.rows.length === 0) return;
    const newRows = activeTable.rows.slice(0, -1);
    const newTables = tables.map((t) => {
      if (t.id !== activeTable.id) return t;
      return {
        ...t,
        rows: newRows,
        updatedAt: new Date().toISOString(),
      };
    });
    await persist(newTables);
  }, [tables, activeTable, persist]);

  const deleteRowsByPrefix = useCallback((prefix: string): number => {
    if (!activeTable) return 0;
    let deletedCount = 0;
    const newTables = tables.map((t) => {
      if (t.id !== activeTable.id) return t;
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
  }, [tables, activeTable, persist]);

  const deleteGeneratedRows = useCallback((prefix?: string): number => {
    if (!activeTable) return 0;
    let deletedCount = 0;
    const newTables = tables.map((t) => {
      if (t.id !== activeTable.id) return t;
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
  }, [tables, activeTable, persist]);

  const effectuateGeneratedRows = useCallback((prefix?: string): number => {
    if (!activeTable) return 0;
    let effectuatedCount = 0;
    const newTables = tables.map((t) => {
      if (t.id !== activeTable.id) return t;
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
  }, [tables, activeTable, persist]);

  // ── Goals ─────────────────────────────────────────────
  const updateGoals = useCallback((goalUpdates: Partial<TableGoals>) => {
    if (!activeTable) return;
    const newTables = tables.map((t) => {
      if (t.id !== activeTable.id) return t;
      const current = t.goals || { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} };
      return {
        ...t,
        goals: {
          ...current,
          ...goalUpdates,
          dailyGoals: { ...(current.dailyGoals || {}), ...(goalUpdates.dailyGoals || {}) },
          weeklyGoals: { ...(current.weeklyGoals || {}), ...(goalUpdates.weeklyGoals || {}) },
          annualCosts: { ...(current.annualCosts || {}), ...(goalUpdates.annualCosts || {}) },
          yearlyGoals: { ...(current.yearlyGoals || {}), ...(goalUpdates.yearlyGoals || {}) },
        },
        updatedAt: new Date().toISOString(),
      };
    });
    persist(newTables);
  }, [tables, activeTable, persist]);

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

  const updateActiveSectors = useCallback((sectors: string[]) => {
    if (!activeTable) return;
    const newTables = tables.map((t) =>
      t.id === activeTable.id
        ? { ...t, activeSectors: sectors, updatedAt: new Date().toISOString() }
        : t,
    );
    persist(newTables);
  }, [tables, activeTable, persist]);

  const changeActiveTableIndex = useCallback((index: number) => {
    setActiveTableIndex(index);
    setSelectedMonth('all');
  }, []);

  const importSpreadsheet = useCallback(async (payload: {
    rows: (TableRow | Omit<TableRow, 'id'>)[];
    tableId?: string;
    apiKey?: string;
    lastEventSeq?: number;
    name?: string;
    description?: string;
    goals?: TableGoals;
    mode?: 'replace' | 'merge';
  }) => {
    const currentTables = tablesRef.current.length > 0 ? tablesRef.current : tables;
    const activeTablesList = currentTables.filter((t: CoinTable) => !t.isDeleted);

    // 1. Preservar table_id: Se tableId for fornecido pelo CSV v3, procurar planilha existente com essa ID
    let targetTable: CoinTable | undefined;
    if (payload.tableId) {
      targetTable = currentTables.find((t: CoinTable) => !t.isDeleted && t.id === payload.tableId);
    }

    if (!targetTable) {
      targetTable = (activeTableIndex >= 0 && activeTableIndex < activeTablesList.length)
        ? activeTablesList[activeTableIndex]
        : activeTablesList[0];
    }

    let baseTables = currentTables;

    if (!targetTable) {
      const newTable: CoinTable = {
        id: payload.tableId || generateId(),
        name: payload.name || 'Minha Planilha',
        description: payload.description || 'Planilha principal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rows: [],
        goals: payload.goals || { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
        activeSectors: ['personal_finance'],
      };
      baseTables = [...currentTables, newTable];
      targetTable = newTable;
    } else if (payload.tableId && targetTable.id !== payload.tableId && payload.mode === 'replace') {
      // Preserva a ID v3 na planilha de destino em modo replace
      targetTable = {
        ...targetTable,
        id: payload.tableId,
      };
    }

    const mode = payload.mode || 'replace';
    const effectiveTableId = targetTable.id;

    // 2. Tratar Chave API com Validação & Auto-Renovação no Import
    let activeApiKey = payload.apiKey || '';
    let keyWasAutoRenewed = false;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      if (activeApiKey) {
        // Valida a chave vinda do CSV contra o servidor backend
        const valCheck = await validateApiKey(activeApiKey);
        if (!valCheck.valid) {
          console.warn(`[CSV Import] Chave API no CSV (${activeApiKey.slice(0, 15)}...) está ${valCheck.expired ? 'EXPIRADA' : 'INVÁLIDA'}. Gerando nova chave API para a planilha ${effectiveTableId}...`);
          const genRes = await generateNewApiKey(effectiveTableId);
          if (genRes && genRes.apiKey) {
            activeApiKey = genRes.apiKey;
            keyWasAutoRenewed = true;
          }
        }
      } else {
        // Caso o CSV não tenha api_key, verifica chave salva no localStorage ou gera nova se expirada/ausente
        const existingKey = window.localStorage.getItem(`coin_api_key_${effectiveTableId}`);
        if (existingKey) {
          const valCheck = await validateApiKey(existingKey);
          if (!valCheck.valid) {
            const genRes = await generateNewApiKey(effectiveTableId);
            if (genRes && genRes.apiKey) {
              activeApiKey = genRes.apiKey;
              keyWasAutoRenewed = true;
            }
          } else {
            activeApiKey = existingKey;
          }
        } else {
          const genRes = await generateNewApiKey(effectiveTableId);
          if (genRes && genRes.apiKey) {
            activeApiKey = genRes.apiKey;
            keyWasAutoRenewed = true;
          }
        }
      }

      if (activeApiKey) {
        window.localStorage.setItem(`coin_api_key_${effectiveTableId}`, activeApiKey);
        window.localStorage.setItem('coin_active_api_key', activeApiKey);
      }
      if (payload.lastEventSeq !== undefined) {
        window.localStorage.setItem(`coin_last_seq_${effectiveTableId}`, String(payload.lastEventSeq));
      }

      // 3. Disparar evento de Sincronia Local com a chave ativa validada
      window.dispatchEvent(new CustomEvent('coin_sync_requested', {
        detail: { tableId: effectiveTableId, apiKey: activeApiKey, lastEventSeq: payload.lastEventSeq }
      }));
    }

    const formattedRows: TableRow[] = payload.rows.map((r) => ({
      ...r,
      id: 'id' in r && r.id ? r.id : generateId(),
    }));

    const updatedTables = baseTables.map((t: CoinTable) => {
      if (t.id !== targetTable!.id) return t;
      const currentGoals: TableGoals = t.goals || { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} };
      const goalUpdates: TableGoals = payload.goals || { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} };

      const finalRows = mode === 'merge'
        ? mergeRows(t.rows || [], formattedRows)
        : [...formattedRows].sort((a, b) => a.date.localeCompare(b.date));

      return {
        ...t,
        id: effectiveTableId,
        name: mode === 'merge' ? t.name : (payload.name && payload.name.trim() ? payload.name : t.name),
        description: mode === 'merge' ? t.description : (payload.description !== undefined ? payload.description : t.description),
        rows: finalRows,
        goals: mode === 'merge' ? (payload.goals ? {
          ...currentGoals,
          ...goalUpdates,
          dailyGoals: { ...(currentGoals.dailyGoals || {}), ...(goalUpdates.dailyGoals || {}) },
          weeklyGoals: { ...(currentGoals.weeklyGoals || {}), ...(goalUpdates.weeklyGoals || {}) },
          annualCosts: { ...(currentGoals.annualCosts || {}), ...(goalUpdates.annualCosts || {}) },
          yearlyGoals: { ...(currentGoals.yearlyGoals || {}), ...(goalUpdates.yearlyGoals || {}) },
          monthlyGoals: { ...(currentGoals.monthlyGoals || {}), ...(goalUpdates.monthlyGoals || {}) },
          globalGoals: goalUpdates.globalGoals || currentGoals.globalGoals,
        } : t.goals) : (payload.goals ? {
          ...currentGoals,
          ...goalUpdates,
          dailyGoals: { ...(currentGoals.dailyGoals || {}), ...(goalUpdates.dailyGoals || {}) },
          weeklyGoals: { ...(currentGoals.weeklyGoals || {}), ...(goalUpdates.weeklyGoals || {}) },
          annualCosts: { ...(currentGoals.annualCosts || {}), ...(goalUpdates.annualCosts || {}) },
          yearlyGoals: { ...(currentGoals.yearlyGoals || {}), ...(goalUpdates.yearlyGoals || {}) },
          monthlyGoals: { ...(currentGoals.monthlyGoals || {}), ...(goalUpdates.monthlyGoals || {}) },
          globalGoals: goalUpdates.globalGoals || currentGoals.globalGoals,
        } : t.goals),
        updatedAt: new Date().toISOString(),
      };
    });

    setSelectedMonth('all');
    await persist(updatedTables);

    return {
      success: true,
      tableId: effectiveTableId,
      keyWasAutoRenewed,
      message: keyWasAutoRenewed
        ? 'Planilha restaurada com sucesso! Uma nova Chave API ativa foi gerada para este ambiente.'
        : 'Planilha restaurada com sucesso!',
      apiKey: activeApiKey,
    };
  }, [tables, activeTableIndex, persist]);

  return {
    isLoading,
    tables,
    activeTables,
    activeTable,
    metrics,
    activeTableIndex,
    selectedMonth,
    setActiveTableIndex: changeActiveTableIndex,
    importSpreadsheet,
    addTable,
    renameTable,
    deleteTable,
    addRow,
    addRows,
    updateActiveTableRows,
    updateActiveTableName,
    renameCategoryInBulk,
    reorderTables,
    updateRow,
    deleteRow,
    deleteLastRow,
    deleteRowsByPrefix,
    deleteGeneratedRows,
    effectuateGeneratedRows,
    updateGoals,
    updateActiveSectors,
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

function ensureActiveSectors(tables: CoinTable[]): CoinTable[] {
  return tables.map((t) => ({
    ...t,
    activeSectors: t.activeSectors !== undefined ? t.activeSectors : ['personal_finance'],
  }));
}
