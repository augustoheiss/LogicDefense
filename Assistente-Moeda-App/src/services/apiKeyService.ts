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
  expiresAt?: string;
  error?: string;
}

export interface GeneratedKeyResult {
  apiKey: string;
  keyHint: string;
  tableId: string;
  expiresAt?: string;
  ttlDays?: number;
}

/**
 * Validates an API Key against backend.
 * Returns { valid: true, expiresAt } if active and unexpired,
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
      return {
        valid: true,
        expired: false,
        tableId: data.tableId,
        expiresAt: data.expiresAt || data.expires_at,
      };
    }

    const detailStr = (data.detail || data.error || '').toString();
    if (res.status === 401 && (detailStr.includes('API Key Expired') || detailStr.includes('expirada'))) {
      return { valid: false, expired: true, error: 'API Key Expired' };
    }

    return { valid: false, expired: false, error: detailStr || 'Chave de API inválida ou revogada.' };
  } catch (err: any) {
    console.warn('[apiKeyService] Erro ao validar chave de API no servidor:', err);
    return { valid: false, expired: false, error: 'Erro de conexão com o servidor.' };
  }
}

/**
 * Generates a new API Key for a given tableId via POST /api/v1/api-keys/generate
 * Accepts custom ttlDays (1, 7, 30 — default: 1 day / 24h)
 */
export async function generateNewApiKey(
  tableId: string,
  licenseKey?: string,
  ttlDays: number = 1
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
        ttl_days: ttlDays,
      }),
    });

    if (!res.ok) {
      console.error('[apiKeyService] Erro HTTP ao gerar chave:', res.status);
      return null;
    }

    const data = await res.json();
    const rawKey = data.api_key || data.apiKey;
    if (rawKey) {
      return {
        apiKey: rawKey,
        keyHint: data.key_hint || data.keyHint || `...${rawKey.slice(-4)}`,
        tableId: data.table_id || data.tableId || tableId,
        expiresAt: data.expires_at || data.expiresAt,
        ttlDays: data.ttl_days || data.ttlDays || ttlDays,
      };
    }
    return null;
  } catch (err: any) {
    console.error('[apiKeyService] Falha ao comunicar com endpoint de geração de chave:', err);
    return null;
  }
}

/**
 * Helper to compute human-readable countdown to expiration.
 */
export function formatTimeRemaining(expiresAtStr?: string | null): {
  formatted: string;
  expired: boolean;
  urgent: boolean;
} {
  if (!expiresAtStr) {
    return { formatted: 'Sem data de expiração', expired: false, urgent: false };
  }

  try {
    const expDate = new Date(expiresAtStr);
    const now = new Date();
    const diffMs = expDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { formatted: 'Expirada (0h 00m)', expired: true, urgent: true };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);

    const minutes = totalMinutes % 60;
    const hours = totalHours % 24;

    const isUrgent = diffMs < 3600_000; // Less than 1 hour

    if (days > 0) {
      return {
        formatted: `Expira em ${days}d ${hours}h ${minutes}min`,
        expired: false,
        urgent: isUrgent,
      };
    }

    if (totalHours > 0) {
      return {
        formatted: `Expira em ${hours}h ${minutes}min`,
        expired: false,
        urgent: isUrgent,
      };
    }

    const seconds = totalSeconds % 60;
    return {
      formatted: `Expira em ${minutes}min ${seconds}s`,
      expired: false,
      urgent: true,
    };
  } catch {
    return { formatted: 'Data inválida', expired: false, urgent: false };
  }
}
