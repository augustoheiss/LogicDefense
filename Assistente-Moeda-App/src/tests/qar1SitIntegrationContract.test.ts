/**
 * QAR1 System Integration Testing (SIT) Stateful Contract Suite (SIT-01 to SIT-08)
 *
 * Verifies integration contracts between Frontend Services and FastAPI/Turso Backend
 * using a stateful in-memory specification harness:
 *   - SIT-01: GET /api/v1/public/agent-prompt (all 5 profiles & OpenAPI 3.1 contract)
 *   - SIT-02: GET /api/v1/public/analysis-context (X-Spreadsheet-Key header & temporal query params)
 *   - SIT-03: POST /api/v1/public/spreadsheet/append (stateful merge upsert by externalId vs replace)
 *   - SIT-04: GET /api/v1/public/spreadsheet/export (CSV formula neutralization) & POST /api/v1/public/ai-analyst
 *   - SIT-05: API Key Lifecycle (generate -> validate -> revoke Kill-Switch purging RAM state -> 401)
 *   - SIT-06: Permission Matrix Enforcement (read-only allows GET 200, blocks POST with 403 Forbidden)
 *   - SIT-07: TTL Expiration Enforcement (expired key returns HTTP 401 "API Key Expired")
 *   - SIT-08: Cold-Start / Timeout (HTTP 502/504) Graceful Degradation to Offline Manual Synthesis
 */

import {
  getAgentPrompt,
  getAnalysisContext,
  exportSpreadsheetCsv,
  appendToSpreadsheet,
  publicAiAnalyst,
} from '../services/publicApiService';
import {
  validateApiKey,
  generateNewApiKey,
  revokeApiKey,
  getApiStorageItem,
  setApiStorageItem,
  removeApiStorageItem,
  emitCoinSyncRequested,
  subscribeCoinSyncRequested,
} from '../services/apiKeyService';
import { OPENAPI_SPEC_V1, PUBLIC_API_HEADER_NAME } from '../config/publicApiConfig';
import type { PublicAgentPromptResponse } from '../config/publicApiConfig';
import { generateManualAiAnalystSynthesis } from '../core/localAiAnalystSynthesizer';
import { neutralizeCsvFormula } from '../utils/securitySanitizer';
import { mergeRows } from '../utils/csvEngine';
import type { TableRow, TableGoals } from '../core/types';

type AgentPromptProfile = 'native' | 'cfo' | 'operational' | 'goals' | 'dev';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

interface HarnessKeyRecord {
  apiKey: string;
  tableId: string;
  permissions: 'read:write' | 'read-only';
  isActive: boolean;
  isExpired: boolean;
  ttlDays: number;
}

function createStatefulBackendHarness() {
  const keys = new Map<string, HarnessKeyRecord>();
  const tableStorage = new Map<string, any[]>();
  const pendingSyncQueue = new Map<string, any[]>();
  let keyCounter = 0;

  const registerKey = (record: HarnessKeyRecord) => {
    keys.set(record.apiKey, record);
  };

  const parsePublicCsvContent = (csvText: string): any[] => {
    const parsed: any[] = [];
    const lines = csvText
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let inData = false;
    let delimiter = ',';
    for (const line of lines) {
      if (line.startsWith('## ROWS ##') || line.startsWith('id,date,') || line.startsWith('Data;Valor;')) {
        inData = true;
        delimiter = line.includes(';') && !line.startsWith('id,date,') ? ';' : ',';
        continue;
      }
      if (line.startsWith('#')) continue;
      const semiParts = line.split(';').map((p) => p.trim());
      const commaParts = line.split(',').map((p) => p.trim());
      if (!inData && semiParts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(semiParts[0])) {
        inData = true;
        delimiter = ';';
      } else if (!inData && commaParts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(commaParts[0])) {
        inData = true;
        delimiter = ',';
      }
      if (!inData) continue;

      if (delimiter === ';') {
        if (semiParts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(semiParts[0])) {
          const val = Number(semiParts[1].replace(',', '.'));
          if (!Number.isNaN(val)) {
            parsed.push({
              date: semiParts[0],
              value: val,
              description: semiParts[2] || 'Via CSV',
              entryType: semiParts[3] || (val < 0 ? 'expense' : 'revenue'),
              category: semiParts[4] || 'Geral',
              tags: semiParts[5] ? semiParts[5].split(',').map((t) => t.trim()).filter(Boolean) : [],
              externalId: semiParts[6] || undefined,
            });
          }
        }
      } else {
        if (commaParts.length >= 4 && /^\d{4}-\d{2}-\d{2}$/.test(commaParts[1])) {
          const val = Number(commaParts[2]);
          if (!Number.isNaN(val)) {
            parsed.push({
              externalId: commaParts[7] || commaParts[0] || undefined,
              date: commaParts[1],
              value: val,
              description: commaParts[3] || 'Via CSV',
              entryType: commaParts[4] || (val < 0 ? 'expense' : 'revenue'),
              category: commaParts[5] || 'Geral',
            });
          }
        } else if (commaParts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(commaParts[0])) {
          const val = Number(commaParts[1]);
          if (!Number.isNaN(val)) {
            parsed.push({
              date: commaParts[0],
              value: val,
              description: commaParts[2] || 'Via CSV',
              entryType: commaParts[3] || (val < 0 ? 'expense' : 'revenue'),
              category: commaParts[4] || 'Geral',
              externalId: commaParts[6] || undefined,
            });
          }
        }
      }
    }
    return parsed;
  };

  const fetchMock = async (input: any, init?: any) => {
    const urlStr = String(input);
    const urlObj = new URL(urlStr, 'http://localhost:8000');
    const method = (init?.method || 'GET').toUpperCase();
    const headers = init?.headers || {};
    const apiKeyHeader =
      headers[PUBLIC_API_HEADER_NAME] ||
      headers['x-spreadsheet-key'] ||
      headers['X-Spreadsheet-Key'] ||
      '';

    const jsonResponse = (status: number, body: any) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
    });

    // 1. API Keys Management Endpoints
    if (
      (urlObj.pathname.endsWith('/api/v1/api-keys/generate') || urlObj.pathname.endsWith('/api/v1/keys/generate')) &&
      method === 'POST'
    ) {
      const body = init?.body ? JSON.parse(init.body) : {};
      keyCounter++;
      const newKey = `am_sheet_live_test_harness_key_${keyCounter}`;
      const tableId = body.table_id || body.tableId || `tbl_harness_${keyCounter}`;
      const permissions = body.permissions || 'read:write';
      const ttlDays = body.ttl_days || body.ttlDays || 7;
      // Rotate old keys for same tableId
      for (const [k, rec] of keys.entries()) {
        if (rec.tableId === tableId) {
          keys.delete(k);
        }
      }
      registerKey({
        apiKey: newKey,
        tableId,
        permissions,
        isActive: true,
        isExpired: false,
        ttlDays,
      });
      return jsonResponse(200, {
        apiKey: newKey,
        api_key: newKey,
        keyHint: `...${newKey.slice(-4)}`,
        key_hint: `...${newKey.slice(-4)}`,
        tableId,
        table_id: tableId,
        permissions,
        ttlDays,
        ttl_days: ttlDays,
        expiresAt: '2099-12-31T23:59:59Z',
      });
    }

    if (
      (urlObj.pathname.endsWith('/api/v1/api-keys/validate') || urlObj.pathname.endsWith('/api/v1/keys/validate')) &&
      method === 'POST'
    ) {
      const body = init?.body ? JSON.parse(init.body) : {};
      const keyToVal = body.apiKey || body.api_key || '';
      const rec = keys.get(keyToVal);
      if (!rec || !rec.isActive) {
        return jsonResponse(401, { detail: 'Chave de API inválida ou revogada.' });
      }
      if (rec.isExpired) {
        return jsonResponse(401, { detail: 'API Key Expired' });
      }
      return jsonResponse(200, {
        valid: true,
        tableId: rec.tableId,
        keyHint: `...${keyToVal.slice(-4)}`,
        expiresAt: '2099-12-31T23:59:59Z',
      });
    }

    if (
      (urlObj.pathname.endsWith('/api/v1/api-keys/revoke') || urlObj.pathname.endsWith('/api/v1/keys/revoke')) &&
      method === 'POST'
    ) {
      const body = init?.body ? JSON.parse(init.body) : {};
      const tableId = body.tableId || body.table_id || '';
      const rawKey = body.apiKey || body.api_key || apiKeyHeader;
      let wasActive = false;
      for (const [k, rec] of keys.entries()) {
        if (k === rawKey || rec.tableId === tableId) {
          if (rec.isActive) wasActive = true;
          keys.delete(k);
        }
      }
      tableStorage.delete(tableId);
      pendingSyncQueue.delete(tableId);
      return jsonResponse(200, {
        success: true,
        alreadyInactive: !wasActive,
        message: wasActive ? 'Chave revogada com sucesso.' : 'Chave já estava inativa.',
        tableId,
      });
    }

    // 2. Public Agent-Prompt Endpoint (allows anonymous or authenticated)
    if (urlObj.pathname.endsWith('/api/v1/public/agent-prompt') && method === 'GET') {
      const profile = urlObj.searchParams.get('profile') || 'native';
      const profileMap: Record<string, string> = {
        native: 'agent_native_master',
        cfo: 'cfo_fpa',
        operational: 'operational_godmode',
        goals: 'goals_timebank',
        dev: 'developer_script',
      };
      const profileUsed = profileMap[profile] || 'agent_native_master';
      const format = urlObj.searchParams.get('format') || 'json';
      const rec = keys.get(apiKeyHeader);
      const keyStatus = rec && rec.isActive && !rec.isExpired ? 'active' : 'anonymous';
      const payload: PublicAgentPromptResponse = {
        status: 'success',
        version: '2.0.0',
        workflow_steps: [
          { step: 1, name: 'Ingest', route: 'GET /api/v1/public/agent-prompt', status: 'completed' },
          { step: 2, name: 'AI-Analyst', route: 'POST /api/v1/public/ai-analyst', status: 'mandatory_next_step' },
        ],
        skills_integrated: [
          { skill: 'dre', name: 'DRE Regime de Caixa', focus: 'Cashflow' },
          { skill: 'pfm', name: 'PFM Retenção', focus: 'Runway' },
        ],
        prompt: `Prompt executivo para perfil [${profileUsed}]`,
        profile_used: profileUsed,
        mandatory_next_route: 'POST /api/v1/public/ai-analyst',
        api_key_status: keyStatus,
      };
      if (format === 'text' || format === 'markdown') {
        return {
          ok: true,
          status: 200,
          text: async () => payload.prompt,
          json: async () => payload,
        };
      }
      return jsonResponse(200, payload);
    }

    // 3. Authenticated Public Endpoints — Enforce Key & Permissions
    if (!apiKeyHeader.startsWith('am_sheet_live_')) {
      return jsonResponse(401, { detail: "Formato de chave de API inválido. Deve iniciar com 'am_sheet_live_'" });
    }
    const keyRec = keys.get(apiKeyHeader);
    if (!keyRec || !keyRec.isActive) {
      return jsonResponse(401, { detail: 'Chave de API inválida ou revogada.' });
    }
    if (keyRec.isExpired) {
      return jsonResponse(401, { detail: 'API Key Expired' });
    }

    const isWriteRoute =
      method === 'POST' &&
      (urlObj.pathname.endsWith('/spreadsheet/append') ||
        urlObj.pathname.endsWith('/transactions') ||
        urlObj.pathname.endsWith('/transactions/batch-sync') ||
        urlObj.pathname.endsWith('/ai-analyst'));

    if (isWriteRoute && keyRec.permissions === 'read-only') {
      return jsonResponse(403, {
        detail: "Acesso negado: Chave de API possui apenas permissão de leitura ('read-only').",
      });
    }

    const tableId = keyRec.tableId;

    if (urlObj.pathname.endsWith('/api/v1/public/sync/pending') && method === 'GET') {
      const events = pendingSyncQueue.get(tableId) || [];
      pendingSyncQueue.delete(tableId);
      return jsonResponse(200, {
        status: 'success',
        table_id: tableId,
        pending_events: events,
        count: events.length,
      });
    }

    if (
      (urlObj.pathname.endsWith('/api/v1/public/spreadsheet/append') ||
        urlObj.pathname.endsWith('/api/v1/public/transactions/batch-sync') ||
        urlObj.pathname.endsWith('/api/v1/public/transactions')) &&
      method === 'POST'
    ) {
      const body = JSON.parse(init.body);
      const mode = (body.mode || 'merge').toLowerCase();
      let incoming: any[] = body.transactions ? [...body.transactions] : [];
      const csvInput = body.csvContent || body.csv_content;
      if (csvInput) {
        incoming = [...incoming, ...parsePublicCsvContent(csvInput)];
      }
      if (incoming.length === 0) {
        return jsonResponse(400, { detail: 'Nenhuma transação válida foi fornecida.' });
      }

      const merged: any[] = mode === 'merge' ? [...(tableStorage.get(tableId) || [])] : [];
      const extIndex = new Map<string, number>();
      merged.forEach((it, idx) => {
        extIndex.set(it.externalId || `tx_api_${String(idx + 1).padStart(4, '0')}`, idx);
      });

      let insertedCount = 0;
      let updatedCount = 0;
      const processedNormItems: any[] = [];
      for (const item of incoming) {
        const extId =
          item.externalId || item.external_id || `tx_api_${String(merged.length + 1).padStart(4, '0')}`;
        const normItem = {
          ...item,
          externalId: extId,
          entryType: item.entryType || (item.value < 0 ? 'expense' : 'revenue'),
        };
        if (extIndex.has(extId)) {
          merged[extIndex.get(extId)!] = normItem;
          if (mode === 'merge') updatedCount++;
        } else {
          extIndex.set(extId, merged.length);
          merged.push(normItem);
          insertedCount++;
        }
        processedNormItems.push(normItem);
      }

      tableStorage.set(tableId, merged);

      const isFromBrowser =
        String(headers['X-Origin-Browser'] || headers['x-origin-browser'] || '').toLowerCase() === 'true';

      if (!isFromBrowser) {
        // Push to offline sync queue with monotonic IDs matching processedNormItems
        const q = pendingSyncQueue.get(tableId) || [];
        q.push({
          type: 'PUBLIC_API_SYNC',
          mode,
          tableId,
          insertedCount,
          totalCount: merged.length,
          rows: processedNormItems.map((it) => ({
            id: it.externalId,
            date: it.date,
            value: it.value,
            description: it.description,
            entryType: it.entryType,
            category: it.category || 'Geral',
            tags: it.tags || [],
            externalId: it.externalId,
          })),
        });
        pendingSyncQueue.set(tableId, q);
      }

      const csvLines = [
        '## COIN_BACKUP_V2 ##',
        'table_name,Planilha Principal',
        `id,${tableId}`,
        '## ROWS ##',
        'id,date,value,description,entryType,category,tags,external_id',
      ];
      for (const it of merged) {
        const desc = neutralizeCsvFormula(String(it.description || '').replace(/,/g, ' '));
        const cat = neutralizeCsvFormula(String(it.category || 'Geral').replace(/,/g, ' '));
        csvLines.push(
          `${it.externalId},${it.date},${Math.abs(it.value).toFixed(2)},${desc},${it.entryType},${cat},,${it.externalId}`
        );
      }

      const csvContent = csvLines.join('\n');
      return jsonResponse(200, {
        success: true,
        mode,
        insertedCount,
        updatedCount,
        totalCount: merged.length,
        message: `Processed ${merged.length} rows`,
        csvContent,
      });
    }

    if (urlObj.pathname.endsWith('/api/v1/public/analysis-context') && method === 'GET') {
      const asOf = urlObj.searchParams.get('as_of_date') || '2026-10-17';
      const start = urlObj.searchParams.get('start_date');
      const end = urlObj.searchParams.get('end_date');
      const rows = (tableStorage.get(tableId) || []).filter((r) => {
        if (start && r.date < start) return false;
        if (end && r.date > end) return false;
        return true;
      });
      return jsonResponse(200, {
        context: `# CONTEXTO FINANCEIRO (${asOf})\nLinhas ativas: ${rows.length}`,
      });
    }

    if (urlObj.pathname.endsWith('/api/v1/public/spreadsheet/export') && method === 'GET') {
      const rows = tableStorage.get(tableId) || [];
      const csvLines = [
        '## COIN_BACKUP_V2 ##',
        'id,date,value,description,entryType,category,tags,external_id',
        ...rows.map((it) => {
          const desc = neutralizeCsvFormula(String(it.description || '').replace(/,/g, ' '));
          return `${it.externalId},${it.date},${Math.abs(it.value).toFixed(2)},${desc},${it.entryType},Geral,,${it.externalId}`;
        }),
      ];
      const csvText = csvLines.join('\n');
      if (urlObj.searchParams.get('download') === 'true') {
        return {
          ok: true,
          status: 200,
          text: async () => csvText,
        };
      }
      return jsonResponse(200, {
        status: 'success',
        table_name: 'Planilha Principal',
        total_rows: rows.length,
        csv_content: csvText,
      });
    }

    if (urlObj.pathname.endsWith('/api/v1/public/ai-analyst') && method === 'POST') {
      const body = JSON.parse(init.body);
      const start = body.startDate || body.start_date;
      const end = body.endDate || body.end_date;
      const rows = (tableStorage.get(tableId) || []).filter((r) => {
        if (start && r.date < start) return false;
        if (end && r.date > end) return false;
        return true;
      });
      return jsonResponse(200, {
        content: `Diagnóstico IA para "${body.userPrompt}" (${rows.length} lançamentos analisados).`,
        modelUsed: 'gemini-3.7-flash',
      });
    }

    return jsonResponse(404, { detail: 'Route not found' });
  };

  return { registerKey, fetchMock, tableStorage, pendingSyncQueue, keys };
}

describe('QAR1 System Integration Testing (SIT) Suite (SIT-01 to SIT-15)', () => {
  it('SIT-01: OPENAPI_SPEC_V1 e getAgentPrompt devem validar todos os 5 perfis executivos (native, cfo, operational, goals, dev)', async () => {
    expect(OPENAPI_SPEC_V1.openapi).toBe('3.1.0');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/agent-prompt');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/analysis-context');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/spreadsheet/export');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/spreadsheet/append');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/ai-analyst');

    const harness = createStatefulBackendHarness();
    harness.registerKey({
      apiKey: 'am_sheet_live_test_key_sit01',
      tableId: 'tbl_sit01',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      const expectedProfileMap: Record<AgentPromptProfile, string> = {
        native: 'agent_native_master',
        cfo: 'cfo_fpa',
        operational: 'operational_godmode',
        goals: 'goals_timebank',
        dev: 'developer_script',
      };
      const profiles: AgentPromptProfile[] = ['native', 'cfo', 'operational', 'goals', 'dev'];
      for (const profile of profiles) {
        const res = await getAgentPrompt(
          profile,
          'json',
          'am_sheet_live_test_key_sit01',
          'http://localhost:8000'
        );
        expect(res.success).toBe(true);
        const data = res.data as PublicAgentPromptResponse;
        expect(data.profile_used).toBe(expectedProfileMap[profile]);
        expect(data.api_key_status).toBe('active');
        expect(data.mandatory_next_route).toBe('POST /api/v1/public/ai-analyst');
      }
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-02: getAnalysisContext deve filtrar transações por intervalo temporal (start_date, end_date, as_of_date)', async () => {
    const harness = createStatefulBackendHarness();
    const apiKey = 'am_sheet_live_test_key_sit02';
    harness.registerKey({
      apiKey,
      tableId: 'tbl_sit02',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      await appendToSpreadsheet(
        {
          mode: 'replace',
          transactions: [
            { date: '2026-06-15', value: 1000, description: 'Junho', entryType: 'revenue', externalId: 'tx_jun' },
            { date: '2026-07-10', value: 2000, description: 'Julho 1', entryType: 'revenue', externalId: 'tx_jul1' },
            { date: '2026-07-25', value: -400, description: 'Julho 2', entryType: 'expense', externalId: 'tx_jul2' },
            { date: '2026-08-05', value: 1500, description: 'Agosto', entryType: 'revenue', externalId: 'tx_aug' },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );

      const res = await getAnalysisContext(
        { as_of_date: '2026-07-31', start_date: '2026-07-01', end_date: '2026-07-31' },
        apiKey,
        'http://localhost:8000'
      );
      expect(res.success).toBe(true);
      expect(res.data?.context).toContain('2026-07-31');
      expect(res.data?.context).toContain('Linhas ativas: 2');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-03: appendToSpreadsheet stateful deve acumular em modo merge, fazer upsert por externalId sem duplicar e substituir em modo replace', async () => {
    const harness = createStatefulBackendHarness();
    const apiKey = 'am_sheet_live_test_key_sit03';
    harness.registerKey({
      apiKey,
      tableId: 'tbl_sit03',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      // 1st batch: insert 2 rows
      const batch1 = await appendToSpreadsheet(
        {
          mode: 'merge',
          transactions: [
            { date: '2026-10-01', value: 3000, description: 'Freela A', entryType: 'revenue', externalId: 'ext_1' },
            { date: '2026-10-02', value: -250, description: 'Cloud AWS', entryType: 'expense', externalId: 'ext_2' },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );
      expect(batch1.success).toBe(true);
      expect(batch1.data?.insertedCount).toBe(2);
      expect(batch1.data?.updatedCount).toBe(0);
      expect(batch1.data?.totalCount).toBe(2);

      // 2nd batch (merge): update ext_2 and insert ext_3 -> total must be 3 (not 2, not 4!)
      const batch2 = await appendToSpreadsheet(
        {
          mode: 'merge',
          transactions: [
            { date: '2026-10-02', value: -310, description: 'Cloud AWS Atualizado', entryType: 'expense', externalId: 'ext_2' },
            { date: '2026-10-05', value: 1200, description: 'Freela B', entryType: 'revenue', externalId: 'ext_3' },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );
      expect(batch2.success).toBe(true);
      expect(batch2.data?.insertedCount).toBe(1);
      expect(batch2.data?.updatedCount).toBe(1);
      expect(batch2.data?.totalCount).toBe(3);

      // 3rd batch (replace): wipe previous 3 rows and replace with 1 row
      const batch3 = await appendToSpreadsheet(
        {
          mode: 'replace',
          transactions: [
            { date: '2026-10-10', value: 5000, description: 'Reset Total', entryType: 'revenue', externalId: 'ext_new' },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );
      expect(batch3.success).toBe(true);
      expect(batch3.data?.insertedCount).toBe(1);
      expect(batch3.data?.totalCount).toBe(1);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-04: exportSpreadsheetCsv deve neutralizar CSV Formula Injection (=CMD) e publicAiAnalyst deve operar sobre o estado em RAM', async () => {
    const harness = createStatefulBackendHarness();
    const apiKey = 'am_sheet_live_test_key_sit04';
    harness.registerKey({
      apiKey,
      tableId: 'tbl_sit04',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      await appendToSpreadsheet(
        {
          mode: 'replace',
          transactions: [
            {
              date: '2026-10-12',
              value: -199.9,
              description: '=CMD|\' /C calc\'!A0',
              entryType: 'expense',
              externalId: 'sec_1',
            },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );

      const csvRes = await exportSpreadsheetCsv(true, apiKey, 'http://localhost:8000');
      expect(csvRes.success).toBe(true);
      expect(csvRes.data).toContain("'=CMD|");

      const aiRes = await publicAiAnalyst(
        { userPrompt: 'Analise minha segurança de caixa' },
        apiKey,
        'http://localhost:8000'
      );
      expect(aiRes.success).toBe(true);
      expect(aiRes.data?.content).toContain('1 lançamentos analisados');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-05: Ciclo de vida completo da API Key — generateNewApiKey -> validateApiKey -> revokeApiKey (Kill-Switch purga RAM e bloqueia com 401)', async () => {
    const harness = createStatefulBackendHarness();
    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      const genRes = await generateNewApiKey('tbl_sit05', 'read:write', 7);
      expect(genRes).toBeDefined();
      const apiKey = genRes!.apiKey;
      expect(apiKey.startsWith('am_sheet_live_test_')).toBe(true);

      const valRes = await validateApiKey(apiKey);
      expect(valRes.valid).toBe(true);
      expect(valRes.tableId).toBe('tbl_sit05');

      // Populate RAM state for tbl_sit05
      await appendToSpreadsheet(
        {
          mode: 'replace',
          transactions: [{ date: '2026-10-01', value: 900, description: 'Teste RAM', entryType: 'revenue' }],
        },
        apiKey,
        'http://localhost:8000'
      );
      expect(harness.tableStorage.has('tbl_sit05')).toBe(true);

      // Trigger Kill-Switch
      const revRes = await revokeApiKey('tbl_sit05', apiKey);
      expect(revRes.success).toBe(true);
      expect(harness.tableStorage.has('tbl_sit05')).toBe(false);

      // Subsequent calls must return 401
      const valAfter = await validateApiKey(apiKey);
      expect(valAfter.valid).toBe(false);

      const ctxAfter = await getAnalysisContext({}, apiKey, 'http://localhost:8000');
      expect(ctxAfter.success).toBe(false);
      expect(ctxAfter.status).toBe(401);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-06: Matriz de Permissões — chave read-only deve permitir GET (200) e bloquear POST com HTTP 403 Forbidden', async () => {
    const harness = createStatefulBackendHarness();
    const roKey = 'am_sheet_live_test_readonly_sit06';
    harness.registerKey({
      apiKey: roKey,
      tableId: 'tbl_sit06',
      permissions: 'read-only',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      // GET routes allowed (200)
      const ctxRes = await getAnalysisContext({}, roKey, 'http://localhost:8000');
      expect(ctxRes.success).toBe(true);
      expect(ctxRes.status).toBe(200);

      const expRes = await exportSpreadsheetCsv(false, roKey, 'http://localhost:8000');
      expect(expRes.success).toBe(true);
      expect(expRes.status).toBe(200);

      // POST routes blocked (403 Forbidden)
      const appendRes = await appendToSpreadsheet(
        {
          mode: 'merge',
          transactions: [{ date: '2026-10-01', value: 100, description: 'Tentativa Escrita' }],
        },
        roKey,
        'http://localhost:8000'
      );
      expect(appendRes.success).toBe(false);
      expect(appendRes.status).toBe(403);
      expect(appendRes.error).toContain('read-only');

      const aiRes = await publicAiAnalyst(
        { userPrompt: 'Tentar executar IA com chave read-only' },
        roKey,
        'http://localhost:8000'
      );
      expect(aiRes.success).toBe(false);
      expect(aiRes.status).toBe(403);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-07: Expiração TTL — chave com expires_at vencido deve retornar HTTP 401 com "API Key Expired"', async () => {
    const harness = createStatefulBackendHarness();
    const expiredKey = 'am_sheet_live_test_expired_sit07';
    harness.registerKey({
      apiKey: expiredKey,
      tableId: 'tbl_sit07',
      permissions: 'read:write',
      isActive: true,
      isExpired: true,
      ttlDays: 1,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      const valRes = await validateApiKey(expiredKey);
      expect(valRes.valid).toBe(false);
      expect(valRes.expired).toBe(true);

      const ctxRes = await getAnalysisContext({}, expiredKey, 'http://localhost:8000');
      expect(ctxRes.success).toBe(false);
      expect(ctxRes.status).toBe(401);
      expect(ctxRes.error).toContain('API Key Expired');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-08: Resiliência a Cold-Start / Timeout (HTTP 502/504) com fallback determinístico para generateManualAiAnalystSynthesis', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway: Render Cold Start Timeout',
    })) as any;

    const localRows: TableRow[] = [
      { id: 'r1', date: '2026-10-01', value: 4500, entryType: 'revenue', category: 'DEV', description: 'Sprint 1' },
      { id: 'e1', date: '2026-10-05', value: 900, entryType: 'expense', category: 'INFRA', description: 'Cloud' },
    ];
    const localGoals: TableGoals = {
      dailyGoals: { 2026: 150 },
      weeklyGoals: { 2026: 1050 },
      annualCosts: { 2026: 18000 },
    };

    try {
      const cloudRes = await publicAiAnalyst(
        { userPrompt: 'Qual meu runway atual?' },
        'am_sheet_live_test_coldstart_sit08',
        'http://localhost:8000'
      );
      expect(cloudRes.success).toBe(false);
      expect(cloudRes.status).toBe(502);

      // Graceful offline fallback when cloud returns 502/504
      const fallbackDossier = generateManualAiAnalystSynthesis(localRows, localGoals, 'Planilha Fallback', {
        format: 'ai_analyst_full_md',
        profile: 'cfo',
        userCustomPrompt: 'Qual meu runway atual?',
        asOfDate: '2026-10-15',
      });

      expect(fallbackDossier.content.length).toBeGreaterThan(500);
      expect(fallbackDossier.content).toContain('4.500,00');
      expect(fallbackDossier.metadata.extension).toBe('md');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-09 (SIT-DEF-02): exportSpreadsheetCsv(false) deve desempacotar csv_content do envelope JSON', async () => {
    const harness = createStatefulBackendHarness();
    const apiKey = 'am_sheet_live_test_key_sit09';
    harness.registerKey({
      apiKey,
      tableId: 'tbl_sit09',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      await appendToSpreadsheet(
        {
          mode: 'replace',
          transactions: [
            { date: '2026-10-03', value: 3200, description: 'Consultoria SIT09', entryType: 'revenue', externalId: 'sit09_1' },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );

      const expJsonMode = await exportSpreadsheetCsv(false, apiKey, 'http://localhost:8000');
      expect(expJsonMode.success).toBe(true);
      expect(expJsonMode.data?.startsWith('## COIN_BACKUP_V2 ##')).toBe(true);
      expect(expJsonMode.data).toContain('Consultoria SIT09');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-10 (SIT-DEF-03): generateNewApiKey deve respeitar permissão read-only quando passada no segundo ou quarto parâmetro', async () => {
    const harness = createStatefulBackendHarness();
    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      const roGen = await generateNewApiKey('tbl_sit10_ro', 'read-only', 7);
      expect(roGen).toBeDefined();
      const roKey = roGen!.apiKey;

      const postAttempt = await appendToSpreadsheet(
        {
          mode: 'merge',
          transactions: [{ date: '2026-10-01', value: 100, description: 'Deve Bloquear 403' }],
        },
        roKey,
        'http://localhost:8000'
      );
      expect(postAttempt.success).toBe(false);
      expect(postAttempt.status).toBe(403);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-11 (SIT-DEF-06): publicAiAnalyst deve filtrar transações por startDate e endDate quando informados', async () => {
    const harness = createStatefulBackendHarness();
    const apiKey = 'am_sheet_live_test_key_sit11';
    harness.registerKey({
      apiKey,
      tableId: 'tbl_sit11',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      await appendToSpreadsheet(
        {
          mode: 'replace',
          transactions: [
            { date: '2026-09-10', value: 1000, description: 'Setembro', entryType: 'revenue', externalId: 's1' },
            { date: '2026-10-05', value: 2000, description: 'Outubro 1', entryType: 'revenue', externalId: 'o1' },
            { date: '2026-10-20', value: -500, description: 'Outubro 2', entryType: 'expense', externalId: 'o2' },
            { date: '2026-11-02', value: 3000, description: 'Novembro', entryType: 'revenue', externalId: 'n1' },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );

      const aiRes = await publicAiAnalyst(
        {
          userPrompt: 'Analise apenas Outubro',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
        },
        apiKey,
        'http://localhost:8000'
      );
      expect(aiRes.success).toBe(true);
      expect(aiRes.data?.content).toContain('2 lançamentos analisados');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-12 (SIT-V5-02): appendToSpreadsheet deve ingerir preset CSV separado por ponto-e-vírgula (;) do APIManagementTester', async () => {
    const harness = createStatefulBackendHarness();
    const apiKey = 'am_sheet_live_test_key_sit12';
    harness.registerKey({
      apiKey,
      tableId: 'tbl_sit12_semi',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      const presetCsv = [
        'Data;Valor;Descrição;Tipo;Categoria;Tags;ID_Externo',
        '2026-06-16;2800.00;Consultoria Estratégica via CSV;revenue;Consultoria;csv,api;csv_001',
        '2026-06-17;-320.00;Licença Software Anual;expense;Tecnologia;saas,anual;csv_002',
      ].join('\n');

      const res = await appendToSpreadsheet(
        {
          mode: 'merge',
          csvContent: presetCsv,
        },
        apiKey,
        'http://localhost:8000'
      );

      expect(res.success).toBe(true);
      expect(res.data?.insertedCount).toBe(2);
      expect(res.data?.totalCount).toBe(2);
      expect(res.data?.csvContent).toContain('Consultoria Estratégica via CSV');
      expect(res.data?.csvContent).toContain('csv_001');
      expect(res.data?.csvContent).toContain('csv_002');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-13 & SIT-14 (SIT-V5-03): Fila offline /sync/pending deve gerar IDs monotônicos tx_api_0001..N sem colisão entre múltiplos lotes', async () => {
    const harness = createStatefulBackendHarness();
    const apiKey = 'am_sheet_live_test_key_sit13';
    harness.registerKey({
      apiKey,
      tableId: 'tbl_sit13_queue',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      // Lote 1 sem externalId -> deve atribuir tx_api_0001 e tx_api_0002
      await appendToSpreadsheet(
        {
          mode: 'merge',
          transactions: [
            { date: '2026-10-01', value: 1000, description: 'Lote 1 Item A', entryType: 'revenue' },
            { date: '2026-10-02', value: -200, description: 'Lote 1 Item B', entryType: 'expense' },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );

      // Lote 2 sem externalId -> deve atribuir tx_api_0003 e tx_api_0004 (sem colidir com tx_api_0001!)
      await appendToSpreadsheet(
        {
          mode: 'merge',
          transactions: [
            { date: '2026-10-03', value: 1500, description: 'Lote 2 Item C', entryType: 'revenue' },
            { date: '2026-10-04', value: -350, description: 'Lote 2 Item D', entryType: 'expense' },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );

      const syncRes = await fetch('http://localhost:8000/api/v1/public/sync/pending', {
        method: 'GET',
        headers: { [PUBLIC_API_HEADER_NAME]: apiKey },
      });
      const syncBody = await syncRes.json();
      expect(syncBody.count).toBe(2);
      const batch1Ids = syncBody.pending_events[0].rows.map((r: any) => r.id);
      const batch2Ids = syncBody.pending_events[1].rows.map((r: any) => r.id);
      expect(batch1Ids).toEqual(['tx_api_0001', 'tx_api_0002']);
      expect(batch2Ids).toEqual(['tx_api_0003', 'tx_api_0004']);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-15 (SIT-V5-04): Kill-Switch revokeApiKey deve purgar tanto a RAM quanto os eventos órfãos da pending_sync_queue', async () => {
    const harness = createStatefulBackendHarness();
    const apiKey = 'am_sheet_live_test_key_sit15';
    harness.registerKey({
      apiKey,
      tableId: 'tbl_sit15_killqueue',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      await appendToSpreadsheet(
        {
          mode: 'merge',
          transactions: [{ date: '2026-10-10', value: 750, description: 'Evento Órfão Antes do Kill-Switch' }],
        },
        apiKey,
        'http://localhost:8000'
      );
      expect(harness.pendingSyncQueue.get('tbl_sit15_killqueue')?.length).toBe(1);

      const revRes = await revokeApiKey('tbl_sit15_killqueue', apiKey);
      expect(revRes.success).toBe(true);
      expect(harness.tableStorage.has('tbl_sit15_killqueue')).toBe(false);
      expect(harness.pendingSyncQueue.has('tbl_sit15_killqueue')).toBe(false);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-16 (SIT-V6-05): Invariante Pull-Before-Push (/sync/pending -> mergeRows -> /transactions/batch-sync com X-Origin-Browser: true) não deve gerar eco infinito', async () => {
    const harness = createStatefulBackendHarness();
    const apiKey = 'am_sheet_live_test_key_sit16_pull_push';
    harness.registerKey({
      apiKey,
      tableId: 'tbl_sit16_sync',
      permissions: 'read:write',
      isActive: true,
      isExpired: false,
      ttlDays: 7,
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = harness.fetchMock as any;

    try {
      // 1. Agente externo injeta transação enquanto browser estava offline
      await appendToSpreadsheet(
        {
          mode: 'merge',
          transactions: [
            {
              date: '2026-10-12',
              value: 2500,
              description: 'Receita Injetada via Agente Externo',
              entryType: 'revenue',
              externalId: 'ext_agent_row_1',
            },
          ],
        },
        apiKey,
        'http://localhost:8000'
      );
      expect(harness.pendingSyncQueue.get('tbl_sit16_sync')?.length).toBe(1);

      // 2. Fase 1 (PULL): Browser drena /api/v1/public/sync/pending ANTES de fazer push
      const pullRes = await fetch('http://localhost:8000/api/v1/public/sync/pending', {
        method: 'GET',
        headers: { [PUBLIC_API_HEADER_NAME]: apiKey },
      });
      const pullData = await pullRes.json();
      expect(pullData.count).toBe(1);
      expect(harness.pendingSyncQueue.get('tbl_sit16_sync')?.length ?? 0).toBe(0);

      // 3. Browser mescla suas linhas locais com as linhas drenadas da fila
      const localBrowserRows: TableRow[] = [
        {
          id: 'local_browser_row_1',
          date: '2026-10-11',
          value: 1800,
          description: 'Receita Local do Browser',
          entryType: 'revenue',
        },
      ];
      let mergedRows = [...localBrowserRows];
      for (const ev of pullData.pending_events) {
        mergedRows = mergeRows(mergedRows, ev.rows);
      }
      expect(mergedRows.length).toBe(2);

      // 4. Fase 2 (PUSH): Browser envia estado consolidado com X-Origin-Browser: true
      const pushRes = await fetch('http://localhost:8000/api/v1/public/transactions/batch-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [PUBLIC_API_HEADER_NAME]: apiKey,
          'X-Origin-Browser': 'true',
        },
        body: JSON.stringify({
          mode: 'replace',
          transactions: mergedRows.map((r) => ({
            date: r.date,
            value: r.value,
            description: r.description || '',
            entryType: (r.entryType as any) || 'revenue',
            externalId: r.id,
          })),
        }),
      });
      expect(pushRes.status).toBe(200);
      const pushData = await pushRes.json();
      expect(pushData.totalCount).toBe(2);

      // Verifica que a fila pending_sync_queue NÃO sofreu re-enfileiramento (zero loop de eco)
      const secondPullRes = await fetch('http://localhost:8000/api/v1/public/sync/pending', {
        method: 'GET',
        headers: { [PUBLIC_API_HEADER_NAME]: apiKey },
      });
      const secondPullData = await secondPullRes.json();
      expect(secondPullData.count).toBe(0);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-17 (SIT-V7-01): Barramento isomórfico (emitCoinSyncRequested / subscribeCoinSyncRequested + AsyncStorage) deve operar com paridade 100% entre Mobile (Android/iOS) e Web sem recursão', async () => {
    const receivedPayloads: Array<Record<string, any> | undefined> = [];
    const unsubscribe = subscribeCoinSyncRequested((detail) => {
      receivedPayloads.push(detail);
    });

    try {
      const mobileKey = 'am_sheet_live_test_mobile_android_ios_parity_9988776655443322';
      await setApiStorageItem('coin_api_key_tbl_mobile_sit17', mobileKey);
      await setApiStorageItem('coin_active_api_key', mobileKey);
      await setApiStorageItem('coin_sync_last_seq_number', '42');

      expect(await getApiStorageItem('coin_api_key_tbl_mobile_sit17')).toBe(mobileKey);
      expect(await getApiStorageItem('coin_active_api_key')).toBe(mobileKey);
      expect(await getApiStorageItem('coin_sync_last_seq_number')).toBe('42');

      // Dispara evento de sincronização via barramento isomórfico (funciona sem window.addEventListener no Android/iOS)
      emitCoinSyncRequested({
        tableId: 'tbl_mobile_sit17',
        apiKey: mobileKey,
        reason: 'importSpreadsheet_mobile',
      });

      // Deve disparar exatamente 1 vez (deduplicação __fromBus evita duplo disparo no Web)
      expect(receivedPayloads.length).toBe(1);
      expect(receivedPayloads[0]?.tableId).toBe('tbl_mobile_sit17');
      expect(receivedPayloads[0]?.apiKey).toBe(mobileKey);

      await removeApiStorageItem('coin_api_key_tbl_mobile_sit17');
      expect(await getApiStorageItem('coin_api_key_tbl_mobile_sit17')).toBeNull();
    } finally {
      unsubscribe();
    }
  });
});

