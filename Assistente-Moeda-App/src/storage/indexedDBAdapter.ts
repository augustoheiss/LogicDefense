/**
 * IndexedDB Transactional Adapter — Assistente Moeda (Local-First Engine)
 *
 * Provides asynchronous, non-blocking, high-capacity storage on Web via window.indexedDB
 * while keeping a lightweight L1 metadata summary in localStorage for instant boot diagnostics.
 * Automatically migrates legacy monolithic localStorage ('coin_assistant_db') into IndexedDB
 * without data loss.
 */

import type { DB, CoinTable, TableRow } from '../core/types';
import type { OpLogEntry } from '../core/opLog';

const IDB_NAME = 'AssistenteMoedaDB';
const IDB_VERSION = 1;

const STORE_META = 'tables_meta';
const STORE_ROWS = 'rows_store';
const STORE_OPLOG = 'oplog_store';
const STORE_SNAPSHOTS = 'snapshots_store';

const LEGACY_STORAGE_KEY = 'coin_assistant_db';
const LEGACY_BACKUP_KEY = 'coin_assistant_db.bak';
const L1_SUMMARY_KEY = 'coin_assistant_l1_summary';

interface TableMetaRecord {
  id: string;
  orderIndex: number;
  tableWithoutRows: Omit<CoinTable, 'rows'>;
}

interface GlobalSettingsRecord {
  id: '__global_settings__';
  activeTableIndex?: number;
  aiCostCurrentMonth?: number;
  aiCostLastReset?: string;
  isPrivacyMode?: boolean;
  workspacePreset?: string;
  updatedAt: string;
}

let dbInstancePromise: Promise<IDBDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function isIndexedDBAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.indexedDB !== 'undefined' &&
    window.indexedDB !== null
  );
}

export function resetIndexedDBConnectionForTests(): void {
  dbInstancePromise = null;
  writeQueue = Promise.resolve();
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_ROWS)) {
        const rowsStore = db.createObjectStore(STORE_ROWS, { keyPath: 'uid' });
        rowsStore.createIndex('by_table', 'tableId', { unique: false });
        rowsStore.createIndex('by_table_date', ['tableId', 'date'], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_OPLOG)) {
        db.createObjectStore(STORE_OPLOG, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbInstancePromise = null;
      reject(request.error);
    };
  });

  return dbInstancePromise;
}

/**
 * Reads the entire DB from IndexedDB.
 * If primary stores (tables_meta/rows_store) are empty or damaged, attempts automatic
 * recovery from snapshots_store ('latest_rolling_backup') before falling back to legacy localStorage.
 */
export async function loadDBFromIndexedDB(): Promise<DB | null> {
  const idb = await openDatabase();

  const existing = await new Promise<DB | null>((resolve, reject) => {
    const tx = idb.transaction([STORE_META, STORE_ROWS, STORE_SNAPSHOTS], 'readonly');
    const metaStore = tx.objectStore(STORE_META);
    const rowsStore = tx.objectStore(STORE_ROWS);
    const snapshotsStore = tx.objectStore(STORE_SNAPSHOTS);

    const metaReq = metaStore.getAll();
    const rowsReq = rowsStore.getAll();
    const snapReq = snapshotsStore.get('latest_rolling_backup');

    tx.oncomplete = () => {
      const allMeta = metaReq.result || [];
      const allRows = rowsReq.result || [];
      const snapshotRec = snapReq.result as { db?: DB } | undefined;

      const tableRecords = allMeta.filter(
        (m: any): m is TableMetaRecord => m && m.id !== '__global_settings__' && m.tableWithoutRows
      );
      const settings = allMeta.find(
        (m: any): m is GlobalSettingsRecord => m && m.id === '__global_settings__'
      );

      if (tableRecords.length === 0) {
        if (snapshotRec && snapshotRec.db && Array.isArray(snapshotRec.db.tables) && snapshotRec.db.tables.length > 0) {
          resolve({
            ...snapshotRec.db,
            activeTableIndex: snapshotRec.db.activeTableIndex ?? 0,
          });
          return;
        }
        if (!settings) {
          resolve(null);
          return;
        }
      }

      const rowsByTable = new Map<string, TableRow[]>();
      for (const item of allRows) {
        if (!item || !item.tableId || !item.row) continue;
        const list = rowsByTable.get(item.tableId) || [];
        list.push(item.row as TableRow);
        rowsByTable.set(item.tableId, list);
      }

      tableRecords.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

      const tables: CoinTable[] = tableRecords.map((rec) => {
        const rows = (rowsByTable.get(rec.id) || []).sort((a, b) =>
          (a.date || '').localeCompare(b.date || '')
        );
        return {
          ...rec.tableWithoutRows,
          rows,
        };
      });

      const resolvedIdx =
        typeof settings?.activeTableIndex === 'number' &&
        settings.activeTableIndex >= 0 &&
        (tables.length === 0 || settings.activeTableIndex < tables.length)
          ? settings.activeTableIndex
          : 0;

      resolve({
        tables,
        activeTableIndex: resolvedIdx,
        aiCostCurrentMonth: settings?.aiCostCurrentMonth ?? 0,
        aiCostLastReset: settings?.aiCostLastReset ?? '',
        isPrivacyMode: settings?.isPrivacyMode ?? false,
        workspacePreset: (settings?.workspacePreset as any) ?? undefined,
      });
    };

    tx.onerror = () => reject(tx.error);
  });

  if (existing) {
    return existing;
  }

  // Fallback & One-Time Migration from Legacy localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const rawLegacy =
      window.localStorage.getItem(LEGACY_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_BACKUP_KEY);

    if (rawLegacy) {
      try {
        const parsed = JSON.parse(rawLegacy) as DB;
        if (parsed && Array.isArray(parsed.tables)) {
          await saveDBToIndexedDB(parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('[IndexedDB] Failed to migrate legacy localStorage payload:', e);
      }
    }
  }

  return null;
}

/**
 * Serialized transactional write of DB to IndexedDB + L1 lightweight summary in localStorage.
 */
export function saveDBToIndexedDB(db: DB): Promise<void> {
  writeQueue = writeQueue
    .catch(() => {})
    .then(async () => {
      const idb = await openDatabase();

      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction([STORE_META, STORE_ROWS, STORE_SNAPSHOTS], 'readwrite');
        const metaStore = tx.objectStore(STORE_META);
        const rowsStore = tx.objectStore(STORE_ROWS);
        const snapshotsStore = tx.objectStore(STORE_SNAPSHOTS);

        metaStore.clear();
        rowsStore.clear();

        const settingsRecord: GlobalSettingsRecord = {
          id: '__global_settings__',
          activeTableIndex: db.activeTableIndex ?? 0,
          aiCostCurrentMonth: db.aiCostCurrentMonth ?? 0,
          aiCostLastReset: db.aiCostLastReset ?? '',
          isPrivacyMode: db.isPrivacyMode ?? false,
          workspacePreset: db.workspacePreset,
          updatedAt: new Date().toISOString(),
        };
        metaStore.put(settingsRecord);

        const tables = db.tables || [];
        tables.forEach((table, idx) => {
          const { rows, ...tableWithoutRows } = table;
          const metaRecord: TableMetaRecord = {
            id: table.id,
            orderIndex: idx,
            tableWithoutRows,
          };
          metaStore.put(metaRecord);

          for (const row of rows || []) {
            if (!row || !row.id) continue;
            rowsStore.put({
              uid: `${table.id}::${row.id}`,
              tableId: table.id,
              date: row.date || '',
              row,
            });
          }
        });

        snapshotsStore.put({
          id: 'latest_rolling_backup',
          savedAt: new Date().toISOString(),
          tableCount: tables.length,
          db: {
            ...db,
            activeTableIndex: db.activeTableIndex ?? 0,
          },
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Update L1 Cache Summary in localStorage (safe try/catch so QuotaExceeded never crashes)
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const l1Summary = {
            updatedAt: new Date().toISOString(),
            tableCount: (db.tables || []).length,
            totalRows: (db.tables || []).reduce((acc, t) => acc + (t.rows?.length || 0), 0),
            activeTableIds: (db.tables || []).filter((t) => !t.isDeleted).map((t) => t.id),
            activeTableIndex: db.activeTableIndex ?? 0,
            isPrivacyMode: !!db.isPrivacyMode,
          };
          window.localStorage.setItem(L1_SUMMARY_KEY, JSON.stringify(l1Summary));
          // Keep legacy key mirrored only if payload is small (< 2MB); otherwise purge stale copy
          const serialized = JSON.stringify(db);
          if (serialized.length < 2_000_000) {
            window.localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
          } else {
            window.localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        } catch {
          // If localStorage is full, IndexedDB already succeeded transactionally!
        }
      }
    });

  return writeQueue;
}

export async function clearIndexedDB(): Promise<void> {
  const idb = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(
      [STORE_META, STORE_ROWS, STORE_OPLOG, STORE_SNAPSHOTS],
      'readwrite'
    );
    tx.objectStore(STORE_META).clear();
    tx.objectStore(STORE_ROWS).clear();
    tx.objectStore(STORE_OPLOG).clear();
    tx.objectStore(STORE_SNAPSHOTS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveOpLogToIndexedDB(
  undoStack: OpLogEntry[],
  redoStack: OpLogEntry[]
): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  try {
    const idb = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction([STORE_OPLOG], 'readwrite');
      const store = tx.objectStore(STORE_OPLOG);
      store.put({
        id: 'active_oplog',
        updatedAt: new Date().toISOString(),
        undoStack: undoStack.slice(-50),
        redoStack: redoStack.slice(-50),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[IndexedDB] Could not persist OpLog:', e);
  }
}

export async function loadOpLogFromIndexedDB(): Promise<{
  undoStack: OpLogEntry[];
  redoStack: OpLogEntry[];
} | null> {
  if (!isIndexedDBAvailable()) return null;
  try {
    const idb = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction([STORE_OPLOG], 'readonly');
      const req = tx.objectStore(STORE_OPLOG).get('active_oplog');
      tx.oncomplete = () => {
        if (req.result) {
          resolve({
            undoStack: req.result.undoStack || [],
            redoStack: req.result.redoStack || [],
          });
        } else {
          resolve(null);
        }
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return null;
  }
}
