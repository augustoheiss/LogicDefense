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
import type { DB } from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

describe('QAR1 Storage Quota, Rolling Backup & Quarantine Chaos Suite (QAR1-STOR-01 to 04)', () => {
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
});

