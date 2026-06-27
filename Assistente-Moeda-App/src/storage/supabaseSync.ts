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
    const { error: settingsError } = await supabase.from('user_settings').upsert({
      id: userId,
      ai_cost_current_month: db.aiCostCurrentMonth ?? 0.00,
      ai_cost_last_reset: db.aiCostLastReset ?? '',
      updated_at: new Date().toISOString(),
    });
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
        // Upsert table metadata
        const { error: tableError } = await supabase.from('coin_tables').upsert({
          id: table.id,
          user_id: userId,
          name: table.name,
          description: table.description ?? null,
          goals: table.goals,
          position: db.tables.indexOf(table),
          created_at: table.createdAt,
          updated_at: table.updatedAt,
        });

        if (tableError) throw tableError;

        // Delete remote transactions that are not in the local table rows
        const localRowIds = table.rows.map((r) => r.id);
        if (localRowIds.length > 0) {
          const { error: deleteRowsError } = await supabase
            .from('transactions')
            .delete()
            .eq('table_id', table.id)
            .not('id', 'in', `(${localRowIds.join(',')})`);
          if (deleteRowsError) throw deleteRowsError;
        } else {
          const { error: deleteRowsError } = await supabase
            .from('transactions')
            .delete()
            .eq('table_id', table.id);
          if (deleteRowsError) throw deleteRowsError;
        }

        // Upsert all rows to the 'transactions' table
        if (table.rows.length > 0) {
          const rowPayloads = table.rows.map((row) => ({
            id: row.id,
            table_id: table.id,
            date: row.date,
            value: row.value,
            description: row.description ?? null,
            entry_type: row.entryType ?? 'revenue',
            monthly_value: row.monthlyValue ?? null,
            month_count: row.monthCount ?? null,
            period_start: row.periodStart ?? null,
            period_end: row.periodEnd ?? null,
            generated_by: row.generatedBy ?? null,
            cloned_from: row.clonedFrom ?? null,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown push error';
    return { success: false, error: message };
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

    // 2. Fetch all tables for this user
    const { data: tables, error: tablesError } = await supabase
      .from('coin_tables')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true });

    if (tablesError) throw tablesError;
    if (!tables || tables.length === 0) {
      await saveDB({
        tables: [],
        aiCostCurrentMonth,
        aiCostLastReset,
      });
      return { success: true };
    }

    // 3. Fetch all rows for all tables in one query
    const tableIds = tables.map((t) => t.id);
    const { data: allRows, error: rowsError } = await supabase
      .from('transactions')
      .select('*')
      .in('table_id', tableIds)
      .order('date', { ascending: true });

    if (rowsError) throw rowsError;

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

    const coinTables: CoinTable[] = tables.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      rows: rowsByTable.get(t.id) ?? [],
      goals: t.goals ?? { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
    }));

    await saveDB({
      tables: coinTables,
      aiCostCurrentMonth,
      aiCostLastReset,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown pull error';
    return { success: false, error: message };
  }
}

// ── Full Sync ────────────────────────────────────────────────────────────────

/**
 * Full bidirectional sync: push local changes, then pull remote state.
 * The pull always wins (server = source of truth after push).
 */
export async function fullSync(userId: string): Promise<{ success: boolean; error?: string }> {
  const pushResult = await pushToCloud(userId);
  if (!pushResult.success) return pushResult;

  return pullFromCloud(userId);
}

/**
 * Delete all remote data for a user (used during account deletion).
 */
export async function deleteAllCloudData(userId: string): Promise<void> {
  // Rows are CASCADE-deleted when tables are deleted
  await supabase.from('coin_tables').delete().eq('user_id', userId);
  await supabase.from('user_settings').delete().eq('id', userId);
}
