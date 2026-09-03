/**
 * Public API Integration Service — Assistente Moeda
 *
 * Cliente HTTP responsável pelas chamadas de API Pública OpenAPI v1:
 * - GET  /api/v1/public/analysis-context
 * - GET  /api/v1/public/spreadsheet/export
 * - POST /api/v1/public/spreadsheet/append (Lote / Incremental / Replace)
 * - POST /api/v1/public/ai-analyst (God Mode AI Analyst)
 */

import {
  DEFAULT_PUBLIC_API_KEY,
  PUBLIC_API_HEADER_NAME,
  DEFAULT_PUBLIC_API_URL,
  PublicAnalysisContextParams,
  PublicAnalysisContextResponse,
  AppendSpreadsheetPayload,
  AppendSpreadsheetResponse,
  PublicAIAnalystPayload,
  PublicAIAnalystResponse,
  PublicAgentPromptResponse,
} from '@/config/publicApiConfig';

export interface APIExecutionResult<T> {
  success: boolean;
  status: number;
  data: T | null;
  error?: string;
  latencyMs: number;
  rawResponse?: string;
}

/**
 * Retorna os headers padronizados com a chave de API (X-Spreadsheet-Key)
 */
export function getPublicApiHeaders(apiKey: string = DEFAULT_PUBLIC_API_KEY): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    [PUBLIC_API_HEADER_NAME]: apiKey.trim(),
  };
}

/**
 * 1. GET /api/v1/public/analysis-context
 * Obter contexto financeiro formatado em Markdown para IAs.
 */
export async function getAnalysisContext(
  params?: PublicAnalysisContextParams,
  apiKey: string = DEFAULT_PUBLIC_API_KEY,
  baseUrl: string = DEFAULT_PUBLIC_API_URL
): Promise<APIExecutionResult<PublicAnalysisContextResponse>> {
  const startTime = Date.now();
  try {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/public/analysis-context`);
    if (params?.as_of_date) url.searchParams.append('as_of_date', params.as_of_date);
    if (params?.start_date) url.searchParams.append('start_date', params.start_date);
    if (params?.end_date) url.searchParams.append('end_date', params.end_date);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: getPublicApiHeaders(apiKey),
    });

    const latencyMs = Date.now() - startTime;
    const text = await res.text();

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        data: null,
        error: `HTTP ${res.status}: ${text}`,
        latencyMs,
        rawResponse: text,
      };
    }

    const data = JSON.parse(text) as PublicAnalysisContextResponse;
    return {
      success: true,
      status: res.status,
      data,
      latencyMs,
      rawResponse: text,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      data: null,
      error: err?.message || 'Erro de conexão com o servidor',
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * 2. GET /api/v1/public/spreadsheet/export
 * Exportar planilha em formato CSV.
 */
export async function exportSpreadsheetCsv(
  download: boolean = false,
  apiKey: string = DEFAULT_PUBLIC_API_KEY,
  baseUrl: string = DEFAULT_PUBLIC_API_URL
): Promise<APIExecutionResult<string>> {
  const startTime = Date.now();
  try {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/public/spreadsheet/export`);
    if (download) url.searchParams.append('download', 'true');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: getPublicApiHeaders(apiKey),
    });

    const latencyMs = Date.now() - startTime;
    const text = await res.text();

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        data: null,
        error: `HTTP ${res.status}: ${text}`,
        latencyMs,
        rawResponse: text,
      };
    }

    return {
      success: true,
      status: res.status,
      data: text,
      latencyMs,
      rawResponse: text,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      data: null,
      error: err?.message || 'Erro de conexão com o servidor',
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * 3. POST /api/v1/public/spreadsheet/append
 * Enviar transações em lote ou texto CSV bruto para alteração/inserção na planilha.
 */
export async function appendToSpreadsheet(
  payload: AppendSpreadsheetPayload,
  apiKey: string = DEFAULT_PUBLIC_API_KEY,
  baseUrl: string = DEFAULT_PUBLIC_API_URL
): Promise<APIExecutionResult<AppendSpreadsheetResponse>> {
  const startTime = Date.now();
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/public/spreadsheet/append`;

    const res = await fetch(url, {
      method: 'POST',
      headers: getPublicApiHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    const latencyMs = Date.now() - startTime;
    const text = await res.text();

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        data: null,
        error: `HTTP ${res.status}: ${text}`,
        latencyMs,
        rawResponse: text,
      };
    }

    const data = JSON.parse(text) as AppendSpreadsheetResponse;
    return {
      success: true,
      status: res.status,
      data,
      latencyMs,
      rawResponse: text,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      data: null,
      error: err?.message || 'Erro de conexão com o servidor',
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * 4. POST /api/v1/public/ai-analyst
 * Executar IA pública (God Mode) para análise e auto-modificação.
 */
export async function publicAiAnalyst(
  payload: PublicAIAnalystPayload,
  apiKey: string = DEFAULT_PUBLIC_API_KEY,
  baseUrl: string = DEFAULT_PUBLIC_API_URL
): Promise<APIExecutionResult<PublicAIAnalystResponse>> {
  const startTime = Date.now();
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/public/ai-analyst`;

    const res = await fetch(url, {
      method: 'POST',
      headers: getPublicApiHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    const latencyMs = Date.now() - startTime;
    const text = await res.text();

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        data: null,
        error: `HTTP ${res.status}: ${text}`,
        latencyMs,
        rawResponse: text,
      };
    }

    const data = JSON.parse(text) as PublicAIAnalystResponse;
    return {
      success: true,
      status: res.status,
      data,
      latencyMs,
      rawResponse: text,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      data: null,
      error: err?.message || 'Erro de conexão com o servidor',
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * 0. GET /api/v1/public/agent-prompt
 * [ROTA OBRIGATÓRIA #0] Obter instruções e skills financeiras de elite para o agente.
 */
export async function getAgentPrompt(
  profile: string = 'native',
  format: 'json' | 'text' = 'json',
  apiKey: string = DEFAULT_PUBLIC_API_KEY,
  baseUrl: string = DEFAULT_PUBLIC_API_URL
): Promise<APIExecutionResult<PublicAgentPromptResponse | string>> {
  const startTime = Date.now();
  try {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/public/agent-prompt`);
    if (profile) url.searchParams.append('profile', profile);
    if (format) url.searchParams.append('format', format);

    const headers = apiKey ? getPublicApiHeaders(apiKey) : { 'Content-Type': 'application/json' };
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    const latencyMs = Date.now() - startTime;
    const text = await res.text();

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        data: null,
        error: `HTTP ${res.status}: ${text}`,
        latencyMs,
        rawResponse: text,
      };
    }

    if (format === 'text') {
      return {
        success: true,
        status: res.status,
        data: text,
        latencyMs,
        rawResponse: text,
      };
    }

    const data = JSON.parse(text) as PublicAgentPromptResponse;
    return {
      success: true,
      status: res.status,
      data,
      latencyMs,
      rawResponse: text,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      data: null,
      error: err?.message || 'Erro de conexão com o servidor',
      latencyMs: Date.now() - startTime,
    };
  }
}

