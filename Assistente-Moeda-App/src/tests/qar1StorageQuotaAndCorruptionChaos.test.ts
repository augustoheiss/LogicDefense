/**
 * QAR1 Storage Quota, Rolling Backup (.bak) & Corruption Quarantine Chaos Suite
 *
 * Exercises the real `src/storage/asyncStorageAdapter.ts` under:
 *   - QAR1-STOR-01: Normal saveDB() -> loadDB() cycle & rolling backup (.bak) creation
 *   - QAR1-STOR-02: Corrupted primary JSON in AsyncStorage -> automatic quarantine (.quarantine) & recovery from (.bak)
 *   - QAR1-STOR-03: QuotaExceededError during saveDB() -> previous valid snapshot & (.bak) preserved without data loss
 *   - QAR1-STOR-04: Synchronous Privacy Mode & UI View Mode L1 preferences
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadDB,
  saveDB,
  clearDB,
  getDBSizeBytes,
  hasQuarantinedData,
  getPrivacyModeSync,
  setPrivacyModeSync,
  getUIViewModeSync,
  setUIViewModeSync,
} from '../storage/asyncStorageAdapter';
import {
  loadDBFromIndexedDB,
  saveDBToIndexedDB,
  clearIndexedDB,
  saveOpLogToIndexedDB,
  loadOpLogFromIndexedDB,
  resetIndexedDBConnectionForTests,
} from '../storage/indexedDBAdapter';
import { exportRowsToCSV } from '../utils/csvEngine';
import type { DB } from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

function createInMemoryIDBHarness() {
  const stores = new Map<string, Map<string, any>>();
  const storeKeyPaths = new Map<string, string>();

  const fakeDB: any = {
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
    },
    createObjectStore: (name: string, opts?: { keyPath?: string }) => {
      const map = new Map<string, any>();
      stores.set(name, map);
      storeKeyPaths.set(name, opts?.keyPath || 'id');
      return {
        createIndex: () => {},
      };
    },
    transaction: (storeNames: string[], _mode: string) => {
      const tx: any = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        error: null,
        objectStore: (name: string) => {
          const map = stores.get(name)!;
          const kp = storeKeyPaths.get(name) || 'id';
          return {
            clear: () => {
              map.clear();
              return { result: undefined };
            },
            put: (val: any) => {
              const key = String(val[kp]);
              map.set(key, JSON.parse(JSON.stringify(val)));
              return { result: key };
            },
            get: (key: string) => {
              const req = { result: map.get(String(key)) };
              return req;
            },
            getAll: () => {
              const req = { result: Array.from(map.values()) };
              return req;
            },
          };
        },
      };
      Promise.resolve().then(() => {
        if (typeof tx.oncomplete === 'function') {
          tx.oncomplete();
        }
      });
      return tx;
    },
  };

  const indexedDBMock: any = {
    open: (_name: string, _version: number) => {
      const req: any = {
        result: fakeDB,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      Promise.resolve().then(() => {
        if (stores.size === 0 && typeof req.onupgradeneeded === 'function') {
          req.onupgradeneeded({ target: req });
        }
        if (typeof req.onsuccess === 'function') {
          req.onsuccess({ target: req });
        }
      });
      return req;
    },
  };

  return { stores, indexedDBMock };
}

describe('QAR1 Storage Quota, Rolling Backup & Quarantine Chaos Suite (QAR1-STOR-01 to 08)', () => {
  const sampleDB: DB = {
    tables: [
      {
        id: 'tbl_safe_1',
        name: 'Planilha Blindada',
        description: 'Snapshot íntegro',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        rows: [
          {
            id: 'row_1',
            date: '2026-07-10',
            value: 3500,
            description: 'Consultoria Sintética Alpha',
            entryType: 'revenue',
            category: 'Serviços',
          },
        ],
        goals: {
          dailyGoals: { 2026: 150 },
          weeklyGoals: { 2026: 1050 },
          annualCosts: { 2026: 18000 },
        },
      },
    ],
    activeTableIndex: 0,
  };

  it('QAR1-STOR-01: saveDB deve persistir o banco e rotacionar o rolling backup (.bak) na segunda gravação', async () => {
    await clearDB();
    await saveDB(sampleDB);

    const loaded1 = await loadDB();
    expect(loaded1).toBeDefined();
    expect(loaded1?.activeTableIndex).toBe(0);
    expect(loaded1?.tables[0].id).toBe('tbl_safe_1');
    expect(loaded1?.tables[0].rows).toHaveLength(1);

    const updatedDB: DB = {
      ...sampleDB,
      tables: [
        {
          ...sampleDB.tables[0],
          name: 'Planilha Blindada v2',
        },
      ],
    };
    await saveDB(updatedDB);

    const rawBackup = await AsyncStorage.getItem('coin_assistant_db.bak');
    expect(rawBackup).toBeDefined();
    expect(rawBackup).toContain('Planilha Blindada');

    const sizeBytes = await getDBSizeBytes();
    expect(sizeBytes).toBeGreaterThan(100);
  });

  it('QAR1-STOR-02: loadDB deve isolar JSON corrompido em (.quarantine) e restaurar automaticamente do (.bak)', async () => {
    await clearDB();
    await saveDB(sampleDB);
    // Segunda gravação garante que sampleDB foi copiado para coin_assistant_db.bak
    await saveDB(sampleDB);

    // Injeta corrupção catastrófica no arquivo primário
    await AsyncStorage.setItem('coin_assistant_db', '{"tables":[{"id":"corrupted_json_trunc');

    const recovered = await loadDB();
    expect(recovered).toBeDefined();
    expect(recovered?.activeTableIndex).toBe(0);
    expect(recovered?.tables[0].id).toBe('tbl_safe_1');
    expect(recovered?.tables[0].name).toBe('Planilha Blindada');

    const quarantined = await hasQuarantinedData();
    expect(quarantined).toBe(true);

    const quarantinePayload = await AsyncStorage.getItem('coin_assistant_db.quarantine');
    expect(quarantinePayload).toContain('corrupted_json_trunc');
  });

  it('QAR1-STOR-03: saveDB sob QuotaExceededError (5 MB limit) nunca deve corromper o snapshot anterior salvo', async () => {
    await clearDB();
    await saveDB(sampleDB);

    const origSetItem = AsyncStorage.setItem;
    let quotaTriggered = false;

    // Injeta limite rígido de 10 KB simulando QuotaExceededError no meio do saveDB
    AsyncStorage.setItem = async (key: string, value: string) => {
      if (key === 'coin_assistant_db' && value.length > 10_000) {
        quotaTriggered = true;
        const err = new Error('QuotaExceededError: DOM Exception 22');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return origSetItem(key, value);
    };

    try {
      const oversizedDB: DB = {
        ...sampleDB,
        tables: [
          {
            ...sampleDB.tables[0],
            description: 'X'.repeat(25_000),
          },
        ],
      };

      await saveDB(oversizedDB);
      expect(quotaTriggered).toBe(true);

      // O banco anterior precisa continuar 100% legível e intacto
      const afterQuotaLoad = await loadDB();
      expect(afterQuotaLoad).toBeDefined();
      expect(afterQuotaLoad?.activeTableIndex).toBe(0);
      expect(afterQuotaLoad?.tables[0].id).toBe('tbl_safe_1');
      expect(afterQuotaLoad?.tables[0].description).toBe('Snapshot íntegro');
    } finally {
      AsyncStorage.setItem = origSetItem;
    }
  });

  it('QAR1-STOR-04: Preferências síncronas L1 (Privacy Mode & View Mode) devem operar sem drift', () => {
    setPrivacyModeSync(true);
    expect(getPrivacyModeSync()).toBe(true);
    setPrivacyModeSync(false);
    expect(getPrivacyModeSync()).toBe(false);

    setUIViewModeSync('spreadsheet');
    expect(getUIViewModeSync()).toBe('grid');
    setUIViewModeSync('cards');
    expect(getUIViewModeSync()).toBe('cards');
  });

  it('QAR1-STOR-05 (CR-V4-06): loadDB no mobile deve expurgar chaves não verificadas no AsyncStorage via enforceCleanRoomAsyncStorageOnBoot', async () => {
    await clearDB();
    await AsyncStorage.removeItem('app:clean_room_migration_v2');
    await AsyncStorage.setItem('coin_active_api_key', 'legacy_mobile_contaminated_token');
    await AsyncStorage.setItem('coin_api_key_tbl_m1', 'am_sheet_live_local');

    await loadDB();

    const purgedActive = await AsyncStorage.getItem('coin_active_api_key');
    const preservedLocal = await AsyncStorage.getItem('coin_api_key_tbl_m1');
    const migFlag = await AsyncStorage.getItem('app:clean_room_migration_v2');

    expect(purgedActive).toBeNull();
    expect(preservedLocal).toBe('am_sheet_live_local');
    expect(migFlag).toBe('done');
  });

  it('QAR1-STOR-06 (QAR1-DEF-03): saveDB sob falha simultânea em BACKUP_KEY e STORAGE_KEY deve preservar o snapshot anterior', async () => {
    await clearDB();
    await saveDB(sampleDB);

    const origSetItem = AsyncStorage.setItem;
    AsyncStorage.setItem = async (key: string, value: string) => {
      if ((key === 'coin_assistant_db' || key === 'coin_assistant_db.bak') && value.length > 5_000) {
        const err = new Error('QuotaExceededError: Storage full');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return origSetItem(key, value);
    };

    try {
      await saveDB({
        ...sampleDB,
        tables: [{ ...sampleDB.tables[0], description: 'Y'.repeat(15_000) }],
      });

      const intact = await loadDB();
      expect(intact).toBeDefined();
      expect(intact?.tables[0].description).toBe('Snapshot íntegro');
    } finally {
      AsyncStorage.setItem = origSetItem;
    }
  });

  it('QAR1-SQL-01 (QAR1-DEF-05): Migrações SQL de profiles devem declarar ALTER TABLE ADD COLUMN IF NOT EXISTS de forma idempotente', async () => {
    const proc = (globalThis as any).process;
    const fs = proc.getBuiltinModule('fs');
    const path = proc.getBuiltinModule('path');
    const triggerSql = fs.readFileSync(
      path.resolve(proc.cwd(), 'supabase/migrations/20260721_auth_trigger.sql'),
      'utf8'
    );
    const schemaSql = fs.readFileSync(
      path.resolve(proc.cwd(), 'supabase/migrations/20260721_master_sectors_schema.sql'),
      'utf8'
    );

    expect(triggerSql).toContain('ADD COLUMN IF NOT EXISTS email');
    expect(triggerSql).toContain('ADD COLUMN IF NOT EXISTS active_sectors');
    expect(schemaSql).toContain('ADD COLUMN IF NOT EXISTS email');
    expect(schemaSql).toContain('ADD COLUMN IF NOT EXISTS active_sectors');
  });

  it('QAR1-STOR-05 (QAR1-V5-01/02): saveDBToIndexedDB e loadDBFromIndexedDB devem preservar activeTableIndex, isPrivacyMode, múltiplas tabelas e OpLog nas 4 Object Stores', async () => {
    const { indexedDBMock } = createInMemoryIDBHarness();
    const origIDB = (globalThis as any).window?.indexedDB;
    resetIndexedDBConnectionForTests();
    (globalThis as any).window.indexedDB = indexedDBMock;

    try {
      const multiTableDB: DB = {
        tables: [
          {
            ...sampleDB.tables[0],
            id: 'tbl_idx_0',
            name: 'Planilha Setor 01',
          },
          {
            ...sampleDB.tables[0],
            id: 'tbl_idx_1',
            name: 'Planilha Setor 02',
            rows: [
              {
                id: 'row_s2_1',
                date: '2026-08-01',
                value: 4200,
                description: 'Operação Sintética Beta',
                entryType: 'revenue',
                category: 'Operacional',
              },
            ],
          },
          {
            ...sampleDB.tables[0],
            id: 'tbl_idx_2',
            name: 'Planilha Setor 03 (Ativa)',
          },
        ],
        activeTableIndex: 2,
        aiCostCurrentMonth: 14.75,
        aiCostLastReset: '2026-10',
        isPrivacyMode: true,
      };

      await saveDBToIndexedDB(multiTableDB);
      const loaded = await loadDBFromIndexedDB();
      expect(loaded).toBeDefined();
      expect(loaded?.tables.length).toBe(3);
      expect(loaded?.activeTableIndex).toBe(2);
      expect(loaded?.isPrivacyMode).toBe(true);
      expect(loaded?.aiCostCurrentMonth).toBe(14.75);
      expect(loaded?.tables[1].rows[0].description).toBe('Operação Sintética Beta');

      await saveOpLogToIndexedDB(
        [{ action: { type: 'ADD_ROW' } as any, inverseAction: { type: 'DELETE_ROW' } as any, timestamp: '2026-10-17T00:00:00.000Z' }],
        []
      );
      const opLog = await loadOpLogFromIndexedDB();
      expect(opLog).toBeDefined();
      expect(opLog?.undoStack.length).toBe(1);
    } finally {
      (globalThis as any).window.indexedDB = origIDB;
      resetIndexedDBConnectionForTests();
    }
  });

  it('QAR1-STOR-06 (QAR1-V5-02): loadDBFromIndexedDB deve recuperar automaticamente o estado íntegro a partir de snapshots_store quando tables_meta sofrer perda/corrupção', async () => {
    const { stores, indexedDBMock } = createInMemoryIDBHarness();
    const origIDB = (globalThis as any).window?.indexedDB;
    resetIndexedDBConnectionForTests();
    (globalThis as any).window.indexedDB = indexedDBMock;

    try {
      const dbWithActiveTab: DB = {
        ...sampleDB,
        activeTableIndex: 0,
        isPrivacyMode: true,
      };
      await saveDBToIndexedDB(dbWithActiveTab);

      // Simulate primary STORE_META ('tables_meta') corruption/wipe while STORE_SNAPSHOTS remains intact
      const metaMap = stores.get('tables_meta');
      expect(metaMap).toBeDefined();
      metaMap!.clear();

      const recovered = await loadDBFromIndexedDB();
      expect(recovered).toBeDefined();
      expect(recovered?.tables.length).toBe(1);
      expect(recovered?.tables[0].id).toBe('tbl_safe_1');
      expect(recovered?.tables[0].description).toBe('Snapshot íntegro');
      expect(recovered?.isPrivacyMode).toBe(true);
    } finally {
      (globalThis as any).window.indexedDB = origIDB;
      resetIndexedDBConnectionForTests();
    }
  });

  it('QAR1-STOR-07 (QAR1-V5-02): saveDBToIndexedDB deve expurgar a chave monolítica legada do localStorage quando o payload atingir >= 2 MB', async () => {
    const { indexedDBMock } = createInMemoryIDBHarness();
    const origIDB = (globalThis as any).window?.indexedDB;
    resetIndexedDBConnectionForTests();
    (globalThis as any).window.indexedDB = indexedDBMock;

    try {
      // First write a small payload (< 2 MB) -> mirrored in localStorage('coin_assistant_db')
      await saveDBToIndexedDB(sampleDB);
      expect((globalThis as any).window.localStorage.getItem('coin_assistant_db')).toBeDefined();

      // Now write a large payload (>= 2 MB) -> legacy localStorage key must be evicted to prevent stale rollback
      const largeDB: DB = {
        ...sampleDB,
        tables: [
          {
            ...sampleDB.tables[0],
            description: 'L'.repeat(2_100_000),
          },
        ],
      };
      await saveDBToIndexedDB(largeDB);
      expect((globalThis as any).window.localStorage.getItem('coin_assistant_db')).toBeNull();

      const loadedLarge = await loadDBFromIndexedDB();
      expect(loadedLarge?.tables[0].description?.length).toBe(2_100_000);
      await clearIndexedDB();
    } finally {
      (globalThis as any).window.indexedDB = origIDB;
      resetIndexedDBConnectionForTests();
    }
  });

  it('QAR1-STOR-08 (QAR1-V5-03): exportRowsToCSV deve neutralizar fórmulas maliciosas CWE-1236 (=, +, -, @, \\t, \\r) preservando valores monetários negativos', () => {
    const csv = exportRowsToCSV([
      {
        id: '=HYPERLINK("http://evil.invalid")',
        date: '2026-10-17',
        value: -250.5,
        description: '+cmd|\' /C calc\'!A0',
        entryType: 'expense',
        category: '-2+3+cmd',
        tags: '@SUM(1,1)',
        metadataJson: '\t{"evil":true}',
      },
    ]);

    const lines = csv.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain("'=HYPERLINK");
    expect(lines[1]).toContain(',-250.50,');
    expect(lines[1]).toContain('"\'+cmd|');
    expect(lines[1]).toContain('"\'-2+3+cmd"');
    expect(lines[1]).toContain('"\'@SUM(1,1)"');
    expect(lines[1]).toContain('"\'\t{""evil"":true}"');
  });
});

