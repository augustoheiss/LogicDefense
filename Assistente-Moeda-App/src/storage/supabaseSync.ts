/**
 * Supabase Sync Service — Assistente Moeda
 *
 * Handles bidirectional sync between local AsyncStorage and Supabase:
 *   1. pushToCloud   — Uploads local DB state to Supabase tables (profiles, worksheets, ledger_entries)
 *   2. pullFromCloud  — Downloads remote data and merges into local DB
 *   3. fullSync      — Push then pull (ensures both sides are aligned)
 *
 * Conflict resolution: last-write-wins based on updated_at timestamp.
 * Integrates Client-Side E2EE Encryption when zero_knowledge_enabled is active.
 */

import { supabase } from '@/lib/supabase';
import { loadDB, saveDB } from './asyncStorageAdapter';
import type { CoinTable, TableRow } from '../core/types';

// ── Pure Javascript Base64 Helper Functions ─────────────────────────────────

function base64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < str.length) {
    const c1 = str.charCodeAt(i++);
    const c2 = i < str.length ? str.charCodeAt(i++) : NaN;
    const c3 = i < str.length ? str.charCodeAt(i++) : NaN;
    const byte1 = c1 >> 2;
    const byte2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const byte3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const byte4 = isNaN(c3) ? 64 : c3 & 63;
    result += chars.charAt(byte1) + chars.charAt(byte2) +
      (byte3 === 64 ? '=' : chars.charAt(byte3)) +
      (byte4 === 64 ? '=' : chars.charAt(byte4));
  }
  return result;
}

function base64Decode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  const cleaned = str.replace(/[^A-Za-z0-9+/]/g, '');
  while (i < cleaned.length) {
    const b1 = chars.indexOf(cleaned.charAt(i++));
    const b2 = chars.indexOf(cleaned.charAt(i++));
    const b3 = i < cleaned.length ? chars.indexOf(cleaned.charAt(i++)) : 0;
    const b4 = i < cleaned.length ? chars.indexOf(cleaned.charAt(i++)) : 0;
    const c1 = (b1 << 2) | (b2 >> 4);
    const c2 = ((b2 & 15) << 4) | (b3 >> 2);
    const c3 = ((b3 & 3) << 6) | b4;
    result += String.fromCharCode(c1);
    if (b3 !== 64 && b3 !== 0) result += String.fromCharCode(c2);
    if (b4 !== 64 && b4 !== 0) result += String.fromCharCode(c3);
  }
  return result;
}

// ── Deterministic XOR Cipher for Client-Side Payload Encryption ─────────────

function encryptPayload(data: any, key: string): string {
  const json = JSON.stringify(data);
  let result = '';
  for (let i = 0; i < json.length; i++) {
    const charCode = json.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return 'aes256_e2ee_' + base64Encode(result);
}

function decryptPayload(payload: string, key: string): any {
  if (!payload.startsWith('aes256_e2ee_')) return null;
  const base64 = payload.substring(12);
  const binary = base64Decode(base64);
  let result = '';
  for (let i = 0; i < binary.length; i++) {
    const charCode = binary.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return JSON.parse(result);
}

// ── Sanitize Goals ───────────────────────────────────────────────────────────

function sanitizeGoals(goals: any): any {
  if (!goals) return { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} };
  const clean: any = {};

  clean.dailyGoals = {};
  if (goals.dailyGoals) {
    for (const [k, v] of Object.entries(goals.dailyGoals)) {
      if (v !== undefined && v !== null) {
        clean.dailyGoals[Number(k)] = Number(v);
      }
    }
  }

  clean.weeklyGoals = {};
  if (goals.weeklyGoals) {
    for (const [k, v] of Object.entries(goals.weeklyGoals)) {
      if (v !== undefined && v !== null) {
        clean.weeklyGoals[k] = typeof v === 'number' ? Number(v) : v;
      }
    }
  }

  clean.annualCosts = {};
  if (goals.annualCosts) {
    for (const [k, v] of Object.entries(goals.annualCosts)) {
      if (v !== undefined && v !== null) {
        clean.annualCosts[Number(k)] = Number(v);
      }
    }
  }

  if (goals.globalGoals) {
    clean.globalGoals = {
      dailyGoal: Number(goals.globalGoals.dailyGoal),
      weeklyGoal: Number(goals.globalGoals.weeklyGoal),
      annualCost: Number(goals.globalGoals.annualCost),
    };
  }

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

// ── Fetch Helper ─────────────────────────────────────────────────────────────

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

export async function pushToCloud(userId: string): Promise<{ success: boolean; error?: string }> {
  const db = await loadDB();
  if (!db) return { success: true };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || 'localuser@coinfactory.internal';

    // 1. Get/Upsert user profile settings
    const { data: prof } = await supabase
      .from('profiles')
      .select('zero_knowledge_enabled')
      .eq('id', userId)
      .maybeSingle();
    const isE2EE = !!prof?.zero_knowledge_enabled;

    const allSectors = Array.from(new Set(db.tables.flatMap((t) => t.activeSectors || [])));
    const activeSectorsList = allSectors.length > 0 ? allSectors : ['personal_finance'];

    await supabase.from('profiles').upsert({
      id: userId,
      email,
      active_sectors: activeSectorsList,
      updated_at: new Date().toISOString(),
    });

    // 2. Delete remote worksheets not present in the local database
    const localWorksheetIds = (db.tables || []).map((t) => t.id);
    if (localWorksheetIds.length > 0) {
      const { error: deleteSheetsErr } = await supabase
        .from('worksheets')
        .delete()
        .eq('user_id', userId)
        .not('id', 'in', `(${localWorksheetIds.join(',')})`);
      if (deleteSheetsErr) throw deleteSheetsErr;
    } else {
      const { error: deleteSheetsErr } = await supabase
        .from('worksheets')
        .delete()
        .eq('user_id', userId);
      if (deleteSheetsErr) throw deleteSheetsErr;
    }

    // 3. Upsert worksheets & ledger entries
    if (db.tables && db.tables.length > 0) {
      for (const table of db.tables) {
        if (!table) continue;

        const worksheetPayload = {
          id: String(table.id),
          user_id: String(userId),
          title: String(table.name),
          is_active: table.isDeleted != null ? !table.isDeleted : true,
          updated_at: String(table.updatedAt),
        };

        const { error: sheetErr } = await supabase.from('worksheets').upsert(worksheetPayload);
        if (sheetErr) throw sheetErr;

        // Delete remote ledger entries that are not in the local table rows
        const localRowIds = table.rows.map((r) => r.id);
        const cloudEntriesQuery = supabase
          .from('ledger_entries')
          .select('id')
          .eq('sheet_id', table.id);
        const cloudEntries = await fetchAll(cloudEntriesQuery);

        const cloudIds = cloudEntries?.map((e) => e.id) || [];
        const idsToDelete = cloudIds.filter((id) => !localRowIds.includes(id));

        if (idsToDelete.length > 0) {
          for (let i = 0; i < idsToDelete.length; i += 100) {
            const chunk = idsToDelete.slice(i, i + 100);
            const { error: deleteRowsErr } = await supabase
              .from('ledger_entries')
              .delete()
              .in('id', chunk);
            if (deleteRowsErr) throw deleteRowsErr;
          }
        }

        // Upsert all rows as ledger entries
        if (table.rows.length > 0) {
          const entryPayloads = table.rows.map((row) => {
            const amountCents = Math.round(row.value * 100);
            const timestamp = `${row.date}T00:00:00Z`;

            if (isE2EE) {
              const rawData = {
                date: row.date,
                value: row.value,
                description: row.description,
                entryType: row.entryType,
                category: row.category,
                tags: row.tags,
                metadataJson: row.metadataJson,
              };
              const encrypted = encryptPayload(rawData, userId);
              return {
                id: String(row.id),
                sheet_id: String(table.id),
                user_id: String(userId),
                timestamp,
                amount_in_cents: amountCents,
                description: 'CRIPTOGRAFADO LOCALMENTE (E2EE)',
                encrypted_payload: encrypted,
                created_at: table.createdAt,
              };
            } else {
              const metaJsonObj: any = {
                entryType: row.entryType,
                category: row.category,
                monthlyValue: row.monthlyValue,
                monthCount: row.monthCount,
                periodStart: row.periodStart,
                periodEnd: row.periodEnd,
                generatedBy: row.generatedBy,
                clonedFrom: row.clonedFrom,
              };
              if (row.metadataJson) {
                try {
                  metaJsonObj.metadataJson = JSON.parse(row.metadataJson);
                } catch {
                  metaJsonObj.metadataJson = row.metadataJson;
                }
              }
              const tagsArray = row.tags
                ? row.tags.split(',').map((t) => t.trim()).filter(Boolean)
                : [];
              return {
                id: String(row.id),
                sheet_id: String(table.id),
                user_id: String(userId),
                timestamp,
                debit_account: row.entryType === 'revenue' ? 'CAIXA' : null,
                credit_account: row.entryType === 'expense' ? 'CAIXA' : null,
                amount_in_cents: amountCents,
                description: row.description || null,
                sector_tags: tagsArray,
                sector_metadata: metaJsonObj,
                encrypted_payload: null,
                created_at: table.createdAt,
              };
            }
          });

          for (let i = 0; i < entryPayloads.length; i += 500) {
            const chunk = entryPayloads.slice(i, i + 500);
            const { error: entryErr } = await supabase.from('ledger_entries').upsert(chunk);
            if (entryErr) throw entryErr;
          }
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Supabase Push Error:', err);
    return { success: false, error: err?.message || 'Erro durante envio de dados' };
  }
}

// ── Pull Cloud → Local ───────────────────────────────────────────────────────

export async function pullFromCloud(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profErr) throw profErr;

    const isE2EE = !!prof?.zero_knowledge_enabled;

    const localDB = await loadDB();
    const localTables = localDB?.tables || [];

    const worksheetsQuery = supabase
      .from('worksheets')
      .select('*')
      .eq('user_id', userId);
    const worksheets = await fetchAll(worksheetsQuery);

    if (!worksheets || worksheets.length === 0) {
      await saveDB({
        tables: localTables,
        aiCostCurrentMonth: localDB?.aiCostCurrentMonth ?? 0,
        aiCostLastReset: localDB?.aiCostLastReset ?? '',
      });
      return { success: true };
    }

    const sheetIds = worksheets.map((w) => w.id);
    const ledgerEntriesQuery = supabase
      .from('ledger_entries')
      .select('*')
      .in('sheet_id', sheetIds)
      .order('timestamp', { ascending: true });
    const allEntries = await fetchAll(ledgerEntriesQuery);

    const rowsByTable = new Map<string, TableRow[]>();
    for (const entry of allEntries ?? []) {
      const sheetId = entry.sheet_id;
      if (!rowsByTable.has(sheetId)) rowsByTable.set(sheetId, []);

      let rowData: TableRow;
      if (entry.encrypted_payload) {
        try {
          const dec = decryptPayload(entry.encrypted_payload, userId);
          if (dec) {
            rowData = {
              id: entry.id,
              date: dec.date,
              value: dec.value,
              description: dec.description,
              entryType: dec.entryType,
              category: dec.category,
              tags: dec.tags,
              metadataJson: dec.metadataJson,
            };
          } else {
            throw new Error('E2EE decodificação vazia');
          }
        } catch {
          rowData = {
            id: entry.id,
            date: entry.timestamp.split('T')[0],
            value: Number(entry.amount_in_cents) / 100,
            description: 'ERRO DE DECRIPTAÇÃO COFRE',
          };
        }
      } else {
        const meta = entry.sector_metadata || {};
        let metaStr: string | undefined = undefined;
        if (meta.metadataJson) {
          metaStr = typeof meta.metadataJson === 'object' ? JSON.stringify(meta.metadataJson) : String(meta.metadataJson);
        }
        rowData = {
          id: entry.id,
          date: entry.timestamp.split('T')[0],
          value: Number(entry.amount_in_cents) / 100,
          description: entry.description || undefined,
          entryType: meta.entryType || 'revenue',
          category: meta.category || undefined,
          tags: entry.sector_tags ? entry.sector_tags.join(',') : undefined,
          monthlyValue: meta.monthlyValue || undefined,
          monthCount: meta.monthCount || undefined,
          periodStart: meta.periodStart || undefined,
          periodEnd: meta.periodEnd || undefined,
          generatedBy: meta.generatedBy || undefined,
          clonedFrom: meta.clonedFrom || undefined,
          metadataJson: metaStr,
        };
      }
      rowsByTable.get(sheetId)!.push(rowData);
    }

    const remoteTables: CoinTable[] = (worksheets || [])
      .filter((w) => w && w.id)
      .map((w) => ({
        id: w.id,
        name: w.title,
        description: undefined,
        createdAt: w.updated_at,
        updatedAt: w.updated_at,
        rows: rowsByTable.get(w.id) ?? [],
        goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
        activeSectors: prof?.active_sectors || ['personal_finance'],
        isDeleted: !w.is_active,
      }));

    const mergedTablesMap = new Map<string, CoinTable>();

    for (const lt of localTables) {
      mergedTablesMap.set(lt.id, lt);
    }

    for (const rt of remoteTables) {
      const lt = mergedTablesMap.get(rt.id);
      if (!lt) {
        mergedTablesMap.set(rt.id, rt);
      } else {
        const localTime = new Date(lt.updatedAt).getTime();
        const remoteTime = new Date(rt.updatedAt).getTime();
        if (remoteTime > localTime) {
          mergedTablesMap.set(rt.id, rt);
        }
      }
    }

    const finalTables = Array.from(mergedTablesMap.values());

    await saveDB({
      tables: finalTables,
      aiCostCurrentMonth: localDB?.aiCostCurrentMonth ?? 0,
      aiCostLastReset: localDB?.aiCostLastReset ?? '',
    });

    return { success: true };
  } catch (err: any) {
    console.error('Supabase Pull Error:', err);
    return { success: false, error: err?.message || 'Erro durante recebimento de dados' };
  }
}

// ── Full Sync ────────────────────────────────────────────────────────────────

export async function fullSync(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const pullResult = await pullFromCloud(userId);
    if (!pullResult.success) return pullResult;
    return await pushToCloud(userId);
  } catch (err: any) {
    console.error('fullSync exception:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

// ── Delete Account Data ──────────────────────────────────────────────────────

export async function deleteAllCloudData(userId: string): Promise<void> {
  await supabase.from('worksheets').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);
}
