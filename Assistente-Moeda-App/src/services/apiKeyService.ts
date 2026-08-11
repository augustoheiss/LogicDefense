/**
 * API Key Service — Assistente Moeda
 *
 * Handles client-side API key validation, TTL expiration checks,
 * and automatic key generation/renewal via backend endpoints.
 */

const API_URL = (
  process.env.EXPO_PUBLIC_AI_BACKEND_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://127.0.0.1:8000'
).replace(/\/+$/, '');

export interface KeyValidationResult {
  valid: boolean;
  expired?: boolean;
  tableId?: string;
  error?: string;
}

export interface GeneratedKeyResult {
  apiKey: string;
  keyHint: string;
  tableId: string;
}

/**
 * Validates an API Key against backend.
 * Returns { valid: true } if active and unexpired,
 * or { valid: false, expired: true } if TTL has expired.
 */
export async function validateApiKey(apiKey: string): Promise<KeyValidationResult> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey || !cleanKey.startsWith('am_sheet_live_')) {
    return { valid: false, expired: false, error: 'Formato de chave inválido.' };
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/api-keys/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: cleanKey }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 200 && data.valid) {
      return { valid: true, expired: false, tableId: data.tableId };
    }

    const detailStr = (data.detail || data.error || '').toString();
    if (res.status === 401 && (detailStr.includes('API Key Expired') || detailStr.includes('expirada'))) {
      return { valid: false, expired: true, error: 'API Key Expired' };
    }

    return { valid: false, expired: false, error: detailStr || 'Chave de API inválida ou revogada.' };
  } catch (err: any) {
    console.warn('[apiKeyService] Erro ao validar chave de API no servidor:', err);
    // Em caso de falha de conexão offline, considera não-validada para forçar renovação se necessário
    return { valid: false, expired: false, error: 'Erro de conexão com o servidor.' };
  }
}

/**
 * Generates a new API Key for a given tableId via POST /api/v1/api-keys/generate
 */
export async function generateNewApiKey(
  tableId: string,
  licenseKey?: string
): Promise<GeneratedKeyResult | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (licenseKey) {
      headers['X-License-Key'] = licenseKey;
    }

    const res = await fetch(`${API_URL}/api/v1/api-keys/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        table_id: tableId,
        license_key: licenseKey || undefined,
        permissions: 'read:write',
      }),
    });

    if (!res.ok) {
      console.error('[apiKeyService] Erro HTTP ao gerar chave:', res.status);
      return null;
    }

    const data = await res.json();
    if (data.api_key) {
      return {
        apiKey: data.api_key,
        keyHint: data.key_hint || `...${data.api_key.slice(-4)}`,
        tableId: data.table_id || tableId,
      };
    }
    return null;
  } catch (err: any) {
    console.error('[apiKeyService] Falha ao comunicar com endpoint de geração de chave:', err);
    return null;
  }
}
