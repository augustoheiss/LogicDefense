/**
 * Supabase Sync Service — Assistente Moeda
 *
 * Handles bidirectional sync between local AsyncStorage and Supabase:
 *   1. pushToCloud  — Uploads local DB state to Supabase tables
 *   2. pullFromCloud — Downloads remote data and merges into local DB
 *   3. fullSync     — Push then pull (ensures both sides are aligned)
 *
 * Conflict resolution: last-write-wins based on updated_at timestamp.
 * This is practical and sufficient for a single-user financial tool.
 */

import { supabase } from '@/lib/supabase';
import { loadDB, saveDB } from './asyncStorageAdapter';
import type { CoinTable, TableRow } from '../core/types';

function sanitizeGoals(goals: any): any {
  if (!goals) return { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} };
  const clean: any = {};

  // 1. dailyGoals
  clean.dailyGoals = {};
  if (goals.dailyGoals) {
    for (const [k, v] of Object.entries(goals.dailyGoals)) {
      if (v !== undefined && v !== null) {
        clean.dailyGoals[Number(k)] = Number(v);
      }
    }
  }

  // 2. weeklyGoals
  clean.weeklyGoals = {};
  if (goals.weeklyGoals) {
    for (const [k, v] of Object.entries(goals.weeklyGoals)) {
      if (v !== undefined && v !== null) {
        clean.weeklyGoals[k] = typeof v === 'number' ? Number(v) : v;
      }
    }
  }

  // 3. annualCosts
  clean.annualCosts = {};
  if (goals.annualCosts) {
    for (const [k, v] of Object.entries(goals.annualCosts)) {
      if (v !== undefined && v !== null) {
        clean.annualCosts[Number(k)] = Number(v);
      }
    }
  }

  // 4. globalGoals
  if (goals.globalGoals) {
    clean.globalGoals = {
      dailyGoal: Number(goals.globalGoals.dailyGoal),
      weeklyGoal: Number(goals.globalGoals.weeklyGoal),
      annualCost: Number(goals.globalGoals.annualCost),
    };
  }

  // 5. yearlyGoals
  if (goals.yearlyGoals) {
    clean.yearlyGoals = {};
    for (const [k, v] of Object.entries(goals.yearlyGoals)) {
      const val = v as any;
      if (val) {
        clean.yearlyGoals[Number(k)] = {
          dailyGoal: Number(val.dailyGoal),
          weeklyGoal: Number(val.weeklyGoal),
          annualCost: Number(val.annualCost),
        };
      }
    }
  }

  // 6. monthlyGoals
  if (goals.monthlyGoals) {
    clean.monthlyGoals = {};
    for (const [k, v] of Object.entries(goals.monthlyGoals)) {
      const val = v as any;
      if (val) {
        clean.monthlyGoals[k] = {
          dailyGoal: Number(val.dailyGoal),
          weeklyGoal: Number(val.weeklyGoal),
          annualCost: Number(val.annualCost),
        };
      }
    }
  }

  return clean;
}

async function fetchAll(queryBuilder: any) {
  let allData: any[] = [];
  let hasMore = true;
  let page = 0;
  const pageSize = 1000;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilder.range(from, to);

    if (error) throw error;
    if (data) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
    page++;
  }
  return allData;
}

// ── Push Local → Cloud ───────────────────────────────────────────────────────

/**
 * Uploads the entire local DB to Supabase (including user settings).
 * Uses upsert (ON CONFLICT DO UPDATE) so it's idempotent.
 */
export async function pushToCloud(userId: string): Promise<{ success: boolean; error?: string }> {
  const db = await loadDB();
  if (!db) return { success: true };

  try {
    // 1. Upsert user settings
    const settingsPayload = {
      id: String(userId),
      ai_cost_current_month: typeof db.aiCostCurrentMonth === 'number' ? db.aiCostCurrentMonth : 0.00,
      ai_cost_last_reset: db.aiCostLastReset ? String(db.aiCostLastReset) : '',
      updated_at: new Date().toISOString(),
    };
    const { error: settingsError } = await supabase.from('user_settings').upsert(settingsPayload);
    if (settingsError) throw settingsError;

    // 2. Delete remote tables that are not in the local list
    const localTableIds = (db.tables || []).map((t) => t.id);
    if (localTableIds.length > 0) {
      const { error: deleteTablesError } = await supabase
        .from('coin_tables')
        .delete()
        .eq('user_id', userId)
        .not('id', 'in', `(${localTableIds.join(',')})`);
      if (deleteTablesError) throw deleteTablesError;
    } else {
      const { error: deleteTablesError } = await supabase
        .from('coin_tables')
        .delete()
        .eq('user_id', userId);
      if (deleteTablesError) throw deleteTablesError;
    }

    // 3. Upsert tables and manage their transactions
    if (db.tables && db.tables.length > 0) {
      for (const table of db.tables) {
        if (!table) continue;
        // Sanitize Table Payload
        const tablePayload = {
          id: String(table.id),
          user_id: String(userId),
          name: String(table.name),
          description: table.description ? String(table.description) : null,
          goals: sanitizeGoals(table.goals),
          position: db.tables.indexOf(table),
          created_at: String(table.createdAt),
          updated_at: String(table.updatedAt),
          is_deleted: table.isDeleted != null ? !!table.isDeleted : false,
        };
        const { error: tableError } = await supabase.from('coin_tables').upsert(tablePayload);
        if (tableError) throw tableError;

        // Delete remote transactions that are not in the local table rows
        const localRowIds = table.rows.map((r) => r.id);

        // Step A: Fetch existing cloud IDs for the table
        const cloudDataQuery = supabase
          .from('transactions')
          .select('id')
          .eq('table_id', table.id);
        const cloudData = await fetchAll(cloudDataQuery);

        // Step B: Diff in memory to find orphans
        const cloudIds = cloudData?.map((d) => d.id) || [];
        const idsToDelete = cloudIds.filter((id) => !localRowIds.includes(id));

        // Step C: Chunk and Delete safely
        if (idsToDelete.length > 0) {
          for (let i = 0; i < idsToDelete.length; i += 100) {
            const chunk = idsToDelete.slice(i, i + 100);
            const { error: deleteRowsError } = await supabase
              .from('transactions')
              .delete()
              .in('id', chunk);
            if (deleteRowsError) throw deleteRowsError;
          }
        }


        // Upsert all rows to the 'transactions' table
        if (table.rows.length > 0) {
          const rowPayloads = table.rows.map((row) => ({
            id: String(row.id),
            table_id: String(table.id),
            date: String(row.date),
            value: Number(row.value),
            description: row.description ? String(row.description) : null,
            entry_type: row.entryType ? String(row.entryType) : 'revenue',
            monthly_value: row.monthlyValue !== undefined && row.monthlyValue !== null ? Number(row.monthlyValue) : null,
            month_count: row.monthCount !== undefined && row.monthCount !== null ? Number(row.monthCount) : null,
            period_start: row.periodStart ? String(row.periodStart) : null,
            period_end: row.periodEnd ? String(row.periodEnd) : null,
            generated_by: row.generatedBy ? String(row.generatedBy) : null,
            cloned_from: row.clonedFrom ? String(row.clonedFrom) : null,
            updated_at: new Date().toISOString(),
          }));

          // Batch upsert in chunks of 500 to avoid payload limits
          for (let i = 0; i < rowPayloads.length; i += 500) {
            const chunk = rowPayloads.slice(i, i + 500);
            const { error: rowError } = await supabase.from('transactions').upsert(chunk);
            if (rowError) throw rowError;
          }
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Supabase Push Error:", err);
    console.error("Deep Supabase Error:", JSON.stringify(err, null, 2));
    const errorMessage = err?.message || err?.details || JSON.stringify(err) || 'Unknown push error';
    return { success: false, error: errorMessage };
  }
}

// ── Pull Cloud → Local ───────────────────────────────────────────────────────

/**
 * Downloads all data from Supabase for this user (including settings) and saves to local storage.
 * Completely replaces local DB with remote state (server is source of truth).
 */
export async function pullFromCloud(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch settings from user_settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (settingsError) throw settingsError;

    const aiCostCurrentMonth = settings?.ai_cost_current_month ? Number(settings.ai_cost_current_month) : 0.00;
    const aiCostLastReset = settings?.ai_cost_last_reset ?? '';

    // Load local DB state first for conflict resolution merge
    const localDB = await loadDB();
    const localTables = localDB?.tables || [];

    // 2. Fetch all tables for this user
    const tablesQuery = supabase
      .from('coin_tables')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true });
    const tables = await fetchAll(tablesQuery);

    if (!tables || tables.length === 0) {
      // If cloud has no tables, keep local tables rather than wiping them
      await saveDB({
        tables: localTables,
        aiCostCurrentMonth: Math.max(localDB?.aiCostCurrentMonth ?? 0, aiCostCurrentMonth),
        aiCostLastReset: aiCostLastReset || localDB?.aiCostLastReset || '',
      });
      return { success: true };
    }

    // 3. Fetch all rows for all tables in one query
    const tableIds = tables.map((t) => t.id);
    const rowsQuery = supabase
      .from('transactions')
      .select('*')
      .in('table_id', tableIds)
      .order('date', { ascending: true });
    const allRows = await fetchAll(rowsQuery);

    // Build the DB object
    const rowsByTable = new Map<string, TableRow[]>();
    for (const row of allRows ?? []) {
      const tableId = row.table_id;
      if (!rowsByTable.has(tableId)) rowsByTable.set(tableId, []);
      rowsByTable.get(tableId)!.push({
        id: row.id,
        date: row.date,
        value: Number(row.value),
        description: row.description ?? undefined,
        entryType: row.entry_type ?? 'revenue',
        monthlyValue: row.monthly_value != null ? Number(row.monthly_value) : undefined,
        monthCount: row.month_count ?? undefined,
        periodStart: row.period_start ?? undefined,
        periodEnd: row.period_end ?? undefined,
        generatedBy: row.generated_by ?? undefined,
        clonedFrom: row.cloned_from ?? undefined,
      });
    }

    const remoteTables: CoinTable[] = (tables || [])
      .filter((t) => t && t.id)
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? undefined,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        rows: rowsByTable.get(t.id) ?? [],
        goals: t.goals ?? { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
        isDeleted: t.is_deleted != null ? !!t.is_deleted : undefined,
      }));

    const mergedTablesMap = new Map<string, CoinTable>();

    // 1. Add all local tables
    for (const lt of localTables) {
      mergedTablesMap.set(lt.id, lt);
    }

    // 2. Merge remote tables based on updatedAt timestamps
    for (const rt of remoteTables) {
      const lt = mergedTablesMap.get(rt.id);
      if (!lt) {
        // Table only exists on cloud, add it
        mergedTablesMap.set(rt.id, rt);
      } else {
        const localTime = new Date(lt.updatedAt).getTime();
        const remoteTime = new Date(rt.updatedAt).getTime();
        if (remoteTime > localTime) {
          // Cloud version is newer, overwrite local version
          mergedTablesMap.set(rt.id, rt);
        } else {
          // Local version is newer or equal, keep local version
        }
      }
    }

    const finalTables = Array.from(mergedTablesMap.values());

    await saveDB({
      tables: finalTables,
      aiCostCurrentMonth: Math.max(localDB?.aiCostCurrentMonth ?? 0, aiCostCurrentMonth),
      aiCostLastReset: aiCostLastReset || localDB?.aiCostLastReset || '',
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown pull error';
    return { success: false, error: message };
  }
}

// ── Full Sync ────────────────────────────────────────────────────────────────

/**
 * Full bidirectional sync: pull remote changes and merge, then push final state.
 * Prevents local stale state from overwriting newer cloud updates.
 */
export async function fullSync(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Pull and merge from cloud (conflict resolution LWW)
    const pullResult = await pullFromCloud(userId);
    if (!pullResult.success) return pullResult;

    // Step 2: Push merged state back to Supabase
    return await pushToCloud(userId);
  } catch (err: any) {
    console.error("fullSync exception:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Delete all remote data for a user (used during account deletion).
 */
export async function deleteAllCloudData(userId: string): Promise<void> {
  // Rows are CASCADE-deleted when tables are deleted
  await supabase.from('coin_tables').delete().eq('user_id', userId);
  await supabase.from('user_settings').delete().eq('id', userId);
}
