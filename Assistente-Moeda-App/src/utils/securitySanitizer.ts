/**
 * Security & Clean-Room Data Hygiene Sanitizer — Assistente Moeda
 *
 * Implements defense-in-depth primitives against:
 *   1. Stored/Reflected DOM XSS in HTML/PDF generators (escapeHtml)
 *   2. CSV Formula Injection (CWE-1236) in Excel/LibreOffice exports (neutralizeCsvFormula)
 *   3. Silent API Key exfiltration in shared CSV files (redactApiKeyForExport)
 *   4. Weak PRNG key generation (generateSecureLocalApiKey via CSPRNG)
 *   5. "Sanitizer Paradox" in AI Analyst payloads (sanitizeTablesForAI / sanitizeTransactionsForAI)
 */

import type { TableRow, CoinTable } from '../core/types';

/**
 * Escapes HTML special characters (`&`, `<`, `>`, `"`, `'`) to prevent DOM XSS
 * when interpolating user descriptions, categories, table names, or custom columns
 * into `popup.document.write(html)` or `Print.printToFileAsync({ html })`.
 */
export function escapeHtml(input: unknown): string {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) by prefixing a single quote `'`
 * when a textual cell begins with `=`, `+`, `-`, `@`, `\t`, or `\r`.
 * Numeric strings (e.g. "-150.50" or "+45") are preserved if they are pure numbers,
 * while formula expressions (e.g. "=SUM(A1:A2)", "+cmd|...", "-2+3+cmd", "@SUM") are escaped.
 */
export function neutralizeCsvFormula(cellValue: string): string {
  if (!cellValue) return '';
  if (cellValue[0] === '\t' || cellValue[0] === '\r') {
    return `'${cellValue}`;
  }
  const trimmed = cellValue.trimStart();
  if (!trimmed) return cellValue;

  const firstChar = trimmed[0];
  if (firstChar === '=' || firstChar === '@' || firstChar === '\t' || firstChar === '\r') {
    return `'${cellValue}`;
  }
  if (firstChar === '+' || firstChar === '-') {
    // Allow pure signed numbers like "-120,50" or "+100.00", escape everything else
    if (!/^[+-]?\d+([.,]\d+)?$/.test(trimmed)) {
      return `'${cellValue}`;
    }
  }
  return cellValue;
}

/**
 * Redacts live API keys (`am_sheet_live_*`) during standard CSV exports so that sharing
 * a CSV file with an accountant or third party does not leak write access to the cloud spreadsheet.
 * Only includes the real key if `includeSecretApiKey === true` is explicitly passed.
 */
export function redactApiKeyForExport(
  apiKey?: string | null,
  includeSecretApiKey: boolean = false
): string {
  if (includeSecretApiKey && apiKey && apiKey.trim().length > 0) {
    return apiKey.trim();
  }
  return 'am_sheet_live_local';
}

/**
 * Generates a high-entropy local fallback API key using Web Crypto CSPRNG (`crypto.getRandomValues`)
 * when available, avoiding predictable `Math.random()` sequences.
 */
export function generateSecureLocalApiKey(tableId?: string): string {
  const cleanId = (tableId || 'default').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  let randomHex = '';

  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(24);
    globalThis.crypto.getRandomValues(bytes);
    randomHex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Fallback when Web Crypto is unavailable in constrained test runtimes
    const ts = Date.now().toString(16);
    const p1 = Math.random().toString(16).slice(2);
    const p2 = Math.random().toString(16).slice(2);
    const p3 = Math.random().toString(16).slice(2);
    randomHex = `${ts}${p1}${p2}${p3}`;
  }

  const combined = `${cleanId}${randomHex}`.padEnd(48, '0').slice(0, 48);
  return `am_sheet_live_${combined}`;
}

/**
 * Sanitizes an array of CoinTables when `allowRawData === false` so that sibling fields
 * in `/api/coin/ai-analyst` do not leak raw transaction descriptions ("Sanitizer Paradox").
 */
export function sanitizeTablesForAI(
  tables: CoinTable[] | any[] | undefined,
  allowRawData: boolean = false
): any[] {
  if (!tables || !Array.isArray(tables)) return [];
  if (allowRawData) return tables;

  return tables.map((t) => ({
    ...t,
    apiKey: t.apiKey ? 'am_sheet_live_local' : undefined,
    rows: Array.isArray(t.rows)
      ? t.rows.map((r: TableRow) => ({
          ...r,
          description: r.category ? `[${r.category}]` : '[Transação Anonimizada]',
          tags: '',
          ticker: undefined,
          clonedFrom: undefined,
          metadataJson: '{}',
          customValues: undefined,
        }))
      : [],
  }));
}

/**
 * Sanitizes an array of raw transactions when `allowRawData === false`.
 */
export function sanitizeTransactionsForAI(
  transactions: any[] | undefined,
  allowRawData: boolean = false
): any[] {
  if (!transactions || !Array.isArray(transactions)) return [];
  if (allowRawData) return transactions;

  return transactions.map((tx) => ({
    ...tx,
    description: tx.category ? `[${tx.category}]` : '[Transação Anonimizada]',
    tags: '',
    ticker: undefined,
    clonedFrom: undefined,
    metadataJson: '{}',
    customValues: undefined,
  }));
}

export const CLEAN_ROOM_MIGRATION_VERSION = 'app:clean_room_migration_v2';

function isCleanRoomAllowedApiKey(val: string): boolean {
  return (
    val.startsWith('am_sheet_live_local') ||
    val.startsWith('am_sheet_live_e2e_') ||
    val.startsWith('am_sheet_live_test_')
  );
}

/**
 * Versioned Clean-Room storage reset on boot (Web synchronous storage).
 * Purges legacy or unverified API key caches without embedding a PII blacklist in the client bundle.
 */
export function enforceCleanRoomStorageOnBoot(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | null
): { migrated: boolean; purgedKeys: string[] } {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
  if (!targetStorage) {
    return { migrated: false, purgedKeys: [] };
  }

  try {
    if (targetStorage.getItem(CLEAN_ROOM_MIGRATION_VERSION) === 'done') {
      return { migrated: false, purgedKeys: [] };
    }

    const keysToScan: string[] = [];
    for (let i = 0; i < targetStorage.length; i++) {
      const k = targetStorage.key(i);
      if (k) keysToScan.push(k);
    }

    const purgedKeys: string[] = [];
    for (const key of keysToScan) {
      if (key === 'coin_active_api_key' || key.startsWith('coin_api_key_')) {
        const val = targetStorage.getItem(key) || '';
        // Purge any legacy key that is not a valid local/synthetic/session key
        if (val && !isCleanRoomAllowedApiKey(val)) {
          targetStorage.removeItem(key);
          purgedKeys.push(key);
        }
      }
    }

    targetStorage.setItem(CLEAN_ROOM_MIGRATION_VERSION, 'done');
    return { migrated: true, purgedKeys };
  } catch {
    return { migrated: false, purgedKeys: [] };
  }
}

/**
 * Versioned Clean-Room storage reset on boot for React Native AsyncStorage (CR-V4-06).
 */
export async function enforceCleanRoomAsyncStorageOnBoot(asyncStorage: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys?(): Promise<readonly string[] | string[]>;
}): Promise<{ migrated: boolean; purgedKeys: string[] }> {
  try {
    const status = await asyncStorage.getItem(CLEAN_ROOM_MIGRATION_VERSION);
    if (status === 'done') {
      return { migrated: false, purgedKeys: [] };
    }

    const allKeys =
      typeof asyncStorage.getAllKeys === 'function'
        ? await asyncStorage.getAllKeys()
        : ['coin_active_api_key'];

    const purgedKeys: string[] = [];
    for (const key of allKeys) {
      if (key === 'coin_active_api_key' || key.startsWith('coin_api_key_')) {
        const val = (await asyncStorage.getItem(key)) || '';
        if (val && !isCleanRoomAllowedApiKey(val)) {
          await asyncStorage.removeItem(key);
          purgedKeys.push(key);
        }
      }
    }

    await asyncStorage.setItem(CLEAN_ROOM_MIGRATION_VERSION, 'done');
    return { migrated: true, purgedKeys };
  } catch {
    return { migrated: false, purgedKeys: [] };
  }
}


