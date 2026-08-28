import type { CVVersions } from '../types/cv'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

export interface GenerateCVRequest {
  raw_text: string
  job_description?: string
  api_key?: string
}

/**
 * Sends raw resume text (and optional job description) to the backend for parallel archetype generation.
 */
export async function generateCVFromText(req: GenerateCVRequest): Promise<CVVersions> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const storedKey = req.api_key || localStorage.getItem('ld_universal_api_key')
  if (storedKey) {
    headers['X-API-Key'] = storedKey
    headers['X-Spreadsheet-Key'] = storedKey
    headers['X-CV-Key'] = storedKey
  }

  // Try the new v1 endpoint first, with automatic fallback to legacy /api/generate-cvs
  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/api/v1/cv/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw_text: req.raw_text,
        job_description: req.job_description,
      }),
    })

    if (response.status === 404) {
      // Fallback to legacy endpoint
      response = await fetch(`${BACKEND_URL}/api/generate-cvs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ raw_text: req.raw_text }),
      })
    }
  } catch (netErr) {
    // If v1 fails by network, try fallback
    response = await fetch(`${BACKEND_URL}/api/generate-cvs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ raw_text: req.raw_text }),
    })
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const detail = errorData.detail || `Erro no servidor (${response.status})`
    throw new Error(detail)
  }

  const data = await response.json()
  return {
    professional: data.professional || '',
    architect: data.architect || data.professional || '',
    historian: data.historian || '',
    didactic: data.didactic || '',
    alien: data.alien || '',
  }
}

/**
 * Validates an API key against the backend SQLite/Turso database.
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; tableId?: string; expiresAt?: string; error?: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/api-keys/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { valid: false, error: err.detail || 'Chave inválida ou expirada.' }
    }

    const data = await res.json()
    return {
      valid: Boolean(data.valid),
      tableId: data.tableId,
      expiresAt: data.expiresAt,
    }
  } catch (err) {
    return { valid: false, error: (err as Error).message }
  }
}

/**
 * Generates a new temporary API key (1, 7, or 30 days) via the shared API Keys router.
 */
export async function generateNewApiKey(ttlDays: number = 1): Promise<{ apiKey: string; keyHint: string; expiresAt: string; tableId: string }> {
  const res = await fetch(`${BACKEND_URL}/api/v1/api-keys/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: `cv-maker-${Date.now()}`,
      ttlDays,
      permissions: 'read:write',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Falha ao gerar nova chave de API.')
  }

  return await res.json()
}

/**
 * Instantly revokes an API key in the backend and clears client state.
 */
export async function revokeApiKey(tableId: string, apiKey?: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/api-keys/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, apiKey }),
    })
    return res.ok
  } catch {
    return false
  }
}
