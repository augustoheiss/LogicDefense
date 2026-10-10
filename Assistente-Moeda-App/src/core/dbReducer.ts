/**
 * Pure Database Reducer & Inverse Generator — Assistente Moeda
 *
 * (DB, Action) => { nextDB: DB, inverseAction?: Action }
 *
 * Immutably applies state transitions and computes reversible operations
 * for universal undo/redo and auditability.
 */

import type { DB, CoinTable, TableRow, TableGoals } from './types';
import type { Action } from './actions';

function sortRowsByDate(a: TableRow, b: TableRow): number {
  const dateA = a.date || '';
  const dateB = b.date || '';
  return dateA.localeCompare(dateB);
}

function resolveTargetTableIndex(tables: CoinTable[], tableId?: string, tableName?: string): number {
  if (tableId) {
    const idx = tables.findIndex((t) => !t.isDeleted && t.id === tableId);
    if (idx !== -1) return idx;
  }
  if (tableName) {
    const clean = tableName.toLowerCase().trim();
    const idx = tables.findIndex((t) => !t.isDeleted && t.name.toLowerCase().trim() === clean);
    if (idx !== -1) return idx;
  }
  // Fallback to first non-deleted table
  return tables.findIndex((t) => !t.isDeleted);
}

export interface ReducerResult {
  nextDB: DB;
  inverseAction?: Action;
}

export function reduceDB(state: DB, action: Action): ReducerResult {
  const now = new Date().toISOString();
  const tables = state.tables || [];

  switch (action.type) {
    case 'ADD_TABLE': {
      const newTable: CoinTable = {
        ...action.payload.table,
        createdAt: action.payload.table.createdAt || now,
        updatedAt: now,
        rows: [...(action.payload.table.rows || [])].sort(sortRowsByDate),
      };
      const nextTables = [...tables, newTable];
      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'DELETE_TABLE',
          payload: { tableId: newTable.id },
        },
      };
    }

    case 'RENAME_TABLE': {
      const { tableId, name } = action.payload;
      const target = tables.find((t) => t.id === tableId);
      if (!target) return { nextDB: state };

      const oldName = target.name;
      const nextTables = tables.map((t) =>
        t.id === tableId ? { ...t, name, updatedAt: now } : t
      );
      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'RENAME_TABLE',
          payload: { tableId, name: oldName },
        },
      };
    }

    case 'DELETE_TABLE': {
      const { tableId } = action.payload;
      const deletedTable = tables.find((t) => t.id === tableId);
      if (!deletedTable) return { nextDB: state };

      const nextTables = tables.filter((t) => t.id !== tableId);
      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'ADD_TABLE',
          payload: { table: deletedTable },
        },
      };
    }

    case 'REORDER_TABLES': {
      const { fromIndex, toIndex } = action.payload;
      if (
        fromIndex < 0 ||
        fromIndex >= tables.length ||
        toIndex < 0 ||
        toIndex >= tables.length ||
        fromIndex === toIndex
      ) {
        return { nextDB: state };
      }
      const nextTables = [...tables];
      const [moved] = nextTables.splice(fromIndex, 1);
      nextTables.splice(toIndex, 0, moved);

      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'REORDER_TABLES',
          payload: { fromIndex: toIndex, toIndex: fromIndex },
        },
      };
    }

    case 'ADD_ROWS': {
      const { tableId, tableName, rows } = action.payload;
      if (!rows || rows.length === 0) return { nextDB: state };

      let targetIndex = resolveTargetTableIndex(tables, tableId, tableName);
      let baseTables = tables;

      if (targetIndex === -1) {
        // Auto-create initial table if none exists
        const created: CoinTable = {
          id: tableId || 'table_' + Date.now(),
          name: tableName || 'Minha Planilha',
          description: 'Planilha principal',
          createdAt: now,
          updatedAt: now,
          rows: [],
          goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
          activeSectors: ['personal_finance'],
        };
        baseTables = [...tables, created];
        targetIndex = baseTables.length - 1;
      }

      const targetTable = baseTables[targetIndex];
      const addedRowIds = rows.map((r) => r.id);

      const updatedRows = [...targetTable.rows, ...rows].sort(sortRowsByDate);
      const nextTables = baseTables.map((t, idx) =>
        idx === targetIndex ? { ...t, rows: updatedRows, updatedAt: now } : t
      );

      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'DELETE_ROWS',
          payload: {
            tableId: targetTable.id,
            rowIds: addedRowIds,
          },
        },
      };
    }

    case 'DELETE_ROWS': {
      const { tableId, rowIds } = action.payload;
      const targetIndex = resolveTargetTableIndex(tables, tableId);
      if (targetIndex === -1 || !rowIds || rowIds.length === 0) return { nextDB: state };

      const targetTable = tables[targetIndex];
      const idsSet = new Set(rowIds);
      const deletedRowsSnapshot = targetTable.rows.filter((r) => idsSet.has(r.id));
      const keptRows = targetTable.rows.filter((r) => !idsSet.has(r.id));

      const nextTables = tables.map((t, idx) =>
        idx === targetIndex ? { ...t, rows: keptRows, updatedAt: now } : t
      );

      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'ADD_ROWS',
          payload: {
            tableId: targetTable.id,
            rows: deletedRowsSnapshot,
          },
        },
      };
    }

    case 'UPDATE_ROW': {
      const { tableId, rowId, updates } = action.payload;
      const targetIndex = resolveTargetTableIndex(tables, tableId);
      if (targetIndex === -1) return { nextDB: state };

      const targetTable = tables[targetIndex];
      const originalRow = targetTable.rows.find((r) => r.id === rowId);
      if (!originalRow) return { nextDB: state };

      const previousSnapshot: Partial<TableRow> = {};
      for (const k of Object.keys(updates) as (keyof TableRow)[]) {
        previousSnapshot[k] = originalRow[k] as any;
      }

      const updatedRows = targetTable.rows
        .map((r) => (r.id === rowId ? { ...r, ...updates } : r))
        .sort(sortRowsByDate);

      const nextTables = tables.map((t, idx) =>
        idx === targetIndex ? { ...t, rows: updatedRows, updatedAt: now } : t
      );

      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'UPDATE_ROW',
          payload: {
            tableId: targetTable.id,
            rowId,
            updates: previousSnapshot,
          },
        },
      };
    }

    case 'SET_TABLE_ROWS': {
      const { tableId, rows } = action.payload;
      const targetIndex = resolveTargetTableIndex(tables, tableId);
      if (targetIndex === -1) return { nextDB: state };

      const targetTable = tables[targetIndex];
      const previousRowsSnapshot = [...targetTable.rows];

      const nextTables = tables.map((t, idx) =>
        idx === targetIndex
          ? { ...t, rows: [...rows].sort(sortRowsByDate), updatedAt: now }
          : t
      );

      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'SET_TABLE_ROWS',
          payload: {
            tableId: targetTable.id,
            rows: previousRowsSnapshot,
          },
        },
      };
    }

    case 'UPDATE_GOALS': {
      const { tableId, goals } = action.payload;
      const targetIndex = resolveTargetTableIndex(tables, tableId);
      if (targetIndex === -1) return { nextDB: state };

      const targetTable = tables[targetIndex];
      const currentGoals = targetTable.goals || { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} };
      const previousGoalsSnapshot: TableGoals = JSON.parse(JSON.stringify(currentGoals));

      const mergedGoals: TableGoals = {
        ...currentGoals,
        ...goals,
        dailyGoals: { ...(currentGoals.dailyGoals || {}), ...(goals.dailyGoals || {}) },
        weeklyGoals: { ...(currentGoals.weeklyGoals || {}), ...(goals.weeklyGoals || {}) },
        annualCosts: { ...(currentGoals.annualCosts || {}), ...(goals.annualCosts || {}) },
        yearlyGoals: { ...(currentGoals.yearlyGoals || {}), ...(goals.yearlyGoals || {}) },
      };

      const nextTables = tables.map((t, idx) =>
        idx === targetIndex ? { ...t, goals: mergedGoals, updatedAt: now } : t
      );

      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'UPDATE_GOALS',
          payload: {
            tableId: targetTable.id,
            goals: previousGoalsSnapshot,
          },
        },
      };
    }

    case 'UPDATE_SECTORS': {
      const { tableId, sectors } = action.payload;
      const targetIndex = resolveTargetTableIndex(tables, tableId);
      if (targetIndex === -1) return { nextDB: state };

      const targetTable = tables[targetIndex];
      const previousSectorsSnapshot = [...(targetTable.activeSectors || ['personal_finance'])];

      const nextTables = tables.map((t, idx) =>
        idx === targetIndex
          ? { ...t, activeSectors: sectors, updatedAt: now }
          : t
      );

      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'UPDATE_SECTORS',
          payload: {
            tableId: targetTable.id,
            sectors: previousSectorsSnapshot,
          },
        },
      };
    }

    case 'RENAME_CATEGORY': {
      const { tableId, oldCategory, newCategory, entryType } = action.payload;
      const targetIndex = resolveTargetTableIndex(tables, tableId);
      if (targetIndex === -1) return { nextDB: state };

      const cleanOld = oldCategory.trim().toUpperCase();
      const cleanNew = newCategory.trim().toUpperCase();

      const targetTable = tables[targetIndex];
      const updatedRows = targetTable.rows.map((r) => {
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

      const nextTables = tables.map((t, idx) =>
        idx === targetIndex ? { ...t, rows: updatedRows, updatedAt: now } : t
      );

      return {
        nextDB: { ...state, tables: nextTables },
        inverseAction: {
          type: 'RENAME_CATEGORY',
          payload: {
            tableId: targetTable.id,
            oldCategory: newCategory,
            newCategory: oldCategory,
            entryType,
          },
        },
      };
    }

    default:
      return { nextDB: state };
  }
}
