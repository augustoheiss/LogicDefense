/**
 * QAR1 System Integration Testing (SIT) Contract Suite (SIT-01 to SIT-05)
 *
 * Verifies integration contracts between Frontend Services and FastAPI/Turso Backend:
 *   - SIT-01: GET /api/v1/public/agent-prompt (profiles & OpenAPI 3.1 contract)
 *   - SIT-02: GET /api/v1/public/analysis-context (X-Spreadsheet-Key header & temporal query params)
 *   - SIT-03: POST /api/v1/public/spreadsheet/append (idempotency via externalId, merge vs replace)
 *   - SIT-04: GET /api/v1/public/spreadsheet/export & POST /api/v1/public/ai-analyst
 *   - SIT-05: API Key Lifecycle (validateApiKey, generateNewApiKey, revokeApiKey kill-switch)
 */

import {
  getAgentPrompt,
  getAnalysisContext,
  exportSpreadsheetCsv,
  appendToSpreadsheet,
  publicAiAnalyst,
} from '../services/publicApiService';
import { validateApiKey, generateNewApiKey, revokeApiKey } from '../services/apiKeyService';
import { OPENAPI_SPEC_V1, PUBLIC_API_HEADER_NAME } from '../config/publicApiConfig';
import type { PublicAgentPromptResponse } from '../config/publicApiConfig';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

describe('QAR1 System Integration Testing (SIT) Suite (SIT-01 to SIT-05)', () => {
  it('SIT-01: OPENAPI_SPEC_V1 e getAgentPrompt devem respeitar o contrato Agent-Native v3.1', async () => {
    expect(OPENAPI_SPEC_V1.openapi).toBe('3.1.0');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/agent-prompt');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/analysis-context');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/spreadsheet/export');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/spreadsheet/append');
    expect(OPENAPI_SPEC_V1.paths).toHaveProperty('/api/v1/public/ai-analyst');

    let capturedUrl = '';
    let capturedHeaders: any = null;
    const origFetch = globalThis.fetch;

    const mockPayload: PublicAgentPromptResponse = {
      status: 'ok',
      version: '2.0.0',
      workflow_steps: [{ step: 1, name: 'Ingest', route: '/api/v1/public/ai-analyst', status: 'active' }],
      skills_integrated: [{ skill: 'dre', name: 'DRE', focus: 'Cashflow' }],
      prompt: 'System Prompt CFO',
      profile_used: 'cfo',
      mandatory_next_route: '/api/v1/public/ai-analyst',
      api_key_status: 'valid',
    };

    globalThis.fetch = (async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockPayload),
        json: async () => mockPayload,
      } as any;
    }) as any;

    try {
      const res = await getAgentPrompt(
        'cfo',
        'json',
        'am_sheet_live_test_key_sit01',
        'http://localhost:8000'
      );
      expect(capturedUrl).toContain('/api/v1/public/agent-prompt?profile=cfo&format=json');
      expect(capturedHeaders[PUBLIC_API_HEADER_NAME]).toBe('am_sheet_live_test_key_sit01');
      expect(res.success).toBe(true);
      const data = res.data as PublicAgentPromptResponse;
      expect(data.profile_used).toBe('cfo');
      expect(data.mandatory_next_route).toBe('/api/v1/public/ai-analyst');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-02: getAnalysisContext deve propagar filtros temporais (as_of_date, start_date, end_date) e X-Spreadsheet-Key', async () => {
    let capturedUrl = '';
    const origFetch = globalThis.fetch;

    globalThis.fetch = (async (url: any) => {
      capturedUrl = String(url);
      const body = { context: '# Resumo Executivo Markdown' };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
      } as any;
    }) as any;

    try {
      const res = await getAnalysisContext(
        { as_of_date: '2026-07-31', start_date: '2026-07-01', end_date: '2026-07-31' },
        'am_sheet_live_test_sit02',
        'http://localhost:8000'
      );
      expect(capturedUrl).toContain('as_of_date=2026-07-31');
      expect(capturedUrl).toContain('start_date=2026-07-01');
      expect(capturedUrl).toContain('end_date=2026-07-31');
      expect(res.success).toBe(true);
      expect(res.data?.context).toContain('# Resumo Executivo Markdown');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-03: appendToSpreadsheet deve suportar idempotência via externalId e modos merge/replace', async () => {
    let capturedBody: any = null;
    const origFetch = globalThis.fetch;

    globalThis.fetch = (async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body);
      const resp = {
        success: true,
        mode: capturedBody.mode,
        insertedCount: 1,
        updatedCount: 1,
        totalCount: 10,
        message: 'Idempotent upsert completed',
      };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(resp),
        json: async () => resp,
      } as any;
    }) as any;

    try {
      const res = await appendToSpreadsheet(
        {
          mode: 'merge',
          transactions: [
            {
              date: '2026-07-20',
              value: 250.0,
              description: 'Fatura Automação n8n',
              entryType: 'expense',
              category: 'Automação',
              externalId: 'n8n_inv_9001',
            },
          ],
        },
        'am_sheet_live_test_sit03',
        'http://localhost:8000'
      );

      expect(capturedBody.mode).toBe('merge');
      expect(capturedBody.transactions[0].externalId).toBe('n8n_inv_9001');
      expect(res.success).toBe(true);
      expect(res.data?.insertedCount).toBe(1);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-04: exportSpreadsheetCsv e publicAiAnalyst devem validar respostas e tratar erros HTTP 401/422', async () => {
    const origFetch = globalThis.fetch;

    globalThis.fetch = (async (url: any) => {
      if (String(url).includes('/export')) {
        return {
          ok: true,
          status: 200,
          text: async () => '## COIN ASSISTANT BACKUP v3 ##\n## ROWS ##\nid,date,value',
        } as any;
      }
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: 'Invalid X-Spreadsheet-Key' }),
      } as any;
    }) as any;

    try {
      const csvRes = await exportSpreadsheetCsv(
        true,
        'am_sheet_live_test_sit04',
        'http://localhost:8000'
      );
      expect(csvRes.success).toBe(true);
      expect(csvRes.data).toContain('## COIN ASSISTANT BACKUP v3 ##');

      const aiRes = await publicAiAnalyst(
        { userPrompt: 'Qual meu saldo?' },
        'invalid_key',
        'http://localhost:8000'
      );
      expect(aiRes.success).toBe(false);
      expect(aiRes.status).toBe(401);
      expect(aiRes.error).toContain('401');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SIT-05: Ciclo de vida da API Key (validateApiKey, generateNewApiKey e Kill-Switch revokeApiKey)', async () => {
    const origFetch = globalThis.fetch;

    globalThis.fetch = (async (url: any) => {
      const u = String(url);
      if (u.includes('/validate')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ valid: true, tableId: 'tbl_sit05', expiresAt: '2026-12-31T23:59:59Z' }),
        } as any;
      }
      if (u.includes('/generate')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            api_key: 'am_sheet_live_test_generated_sit05_key_123456',
            key_hint: '...3456',
            table_id: 'tbl_sit05',
            ttl_days: 7,
          }),
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: 'Chave revogada no servidor' }),
      } as any;
    }) as any;

    try {
      const valRes = await validateApiKey('am_sheet_live_test_generated_sit05_key_123456');
      expect(valRes.valid).toBe(true);
      expect(valRes.tableId).toBe('tbl_sit05');

      const genRes = await generateNewApiKey('tbl_sit05', undefined, 7);
      expect(genRes?.apiKey).toBe('am_sheet_live_test_generated_sit05_key_123456');

      const revRes = await revokeApiKey('tbl_sit05', 'am_sheet_live_test_generated_sit05_key_123456');
      expect(revRes.success).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

