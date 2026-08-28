import type { CVVersions } from '../types/cv'

/**
 * Returns candidate backend URLs in priority order.
 * Ensures the app works on localhost, on Render, and when statically deployed without proxy.
 */
function getCandidateBackendUrls(): string[] {
  const envUrl = import.meta.env.VITE_BACKEND_URL
  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  const urls: string[] = []
  if (envUrl) urls.push(envUrl.replace(/\/$/, ''))
  if (isLocal) urls.push('http://localhost:8000')
  urls.push('https://ocorrencias-pdf-writer.onrender.com')
  urls.push('https://heiss-cv-engine.onrender.com')
  return Array.from(new Set(urls))
}

export interface GenerateCVRequest {
  raw_text: string
  job_description?: string
  api_key?: string
}

/**
 * Sends raw resume text (and optional job description) to the backend for parallel archetype generation.
 * Iterates through candidate backends with automatic failover to eliminate 404/405/502 errors.
 */
export async function generateCVFromText(req: GenerateCVRequest): Promise<CVVersions> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const storedKey = req.api_key || localStorage.getItem('ld_pro_license_key') || localStorage.getItem('am_license_key') || localStorage.getItem('ld_universal_api_key')
  if (storedKey) {
    headers['X-License-Key'] = storedKey
    headers['Authorization'] = `Bearer ${storedKey}`
    headers['X-API-Key'] = storedKey
    headers['X-Spreadsheet-Key'] = storedKey
    headers['X-CV-Key'] = storedKey
  }

  const candidateUrls = getCandidateBackendUrls()
  let lastError: Error = new Error('Nenhum servidor de IA disponível no momento.')

  for (const baseUrl of candidateUrls) {
    // 1. Try modern /api/v1/cv/generate
    try {
      const response = await fetch(`${baseUrl}/api/v1/cv/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          raw_text: req.raw_text,
          job_description: req.job_description,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return {
          professional: data.professional || '',
          architect: data.architect || data.professional || '',
          historian: data.historian || '',
          didactic: data.didactic || '',
          alien: data.alien || '',
        }
      }

      // If 404/405, attempt legacy /api/generate-cvs on this same server
      if (response.status === 404 || response.status === 405) {
        const legacyRes = await fetch(`${baseUrl}/api/generate-cvs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ raw_text: req.raw_text }),
        })
        if (legacyRes.ok) {
          const data = await legacyRes.json()
          return {
            professional: data.professional || '',
            architect: data.architect || data.professional || '',
            historian: data.historian || '',
            didactic: data.didactic || '',
            alien: data.alien || '',
          }
        }
      }

      const errData = await response.json().catch(() => ({}))
      lastError = new Error(errData.detail || `Erro no servidor (${response.status})`)
    } catch (netErr) {
      // Try legacy endpoint on network exception
      try {
        const legacyRes = await fetch(`${baseUrl}/api/generate-cvs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ raw_text: req.raw_text }),
        })
        if (legacyRes.ok) {
          const data = await legacyRes.json()
          return {
            professional: data.professional || '',
            architect: data.architect || data.professional || '',
            historian: data.historian || '',
            didactic: data.didactic || '',
            alien: data.alien || '',
          }
        }
      } catch (legacyErr) {
        lastError = (netErr as Error) || (legacyErr as Error)
      }
    }
  }

  throw lastError
}

/**
 * Validates an API key against the backend SQLite/Turso database.
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; tableId?: string; expiresAt?: string; error?: string }> {
  const candidateUrls = getCandidateBackendUrls()
  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/api-keys/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })

      if (res.ok) {
        const data = await res.json()
        return {
          valid: Boolean(data.valid),
          tableId: data.tableId,
          expiresAt: data.expiresAt,
        }
      }
    } catch {
      // Continue to next candidate
    }
  }
  return { valid: false, error: 'Não foi possível validar a chave no servidor.' }
}

/**
 * Generates a new temporary API key (1, 7, or 30 days) via the shared API Keys router.
 */
export async function generateNewApiKey(ttlDays: number = 1): Promise<{ apiKey: string; keyHint: string; expiresAt: string; tableId: string }> {
  const candidateUrls = getCandidateBackendUrls()
  let lastErr = new Error('Falha ao conectar com o servidor de chaves.')

  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/api-keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: `cv-maker-${Date.now()}`,
          ttlDays,
          permissions: 'read:write',
        }),
      })

      if (res.ok) {
        return await res.json()
      }
      const err = await res.json().catch(() => ({}))
      lastErr = new Error(err.detail || 'Falha ao gerar nova chave de API.')
    } catch (e) {
      lastErr = e as Error
    }
  }

  throw lastErr
}

/**
 * Instantly revokes an API key in the backend and clears client state.
 */
export async function revokeApiKey(tableId: string, apiKey?: string): Promise<boolean> {
  const candidateUrls = getCandidateBackendUrls()
  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/api-keys/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, apiKey }),
      })
      if (res.ok) return true
    } catch {
      // Continue to next candidate
    }
  }
  return false
}

/**
 * Validates a Pro license key with Turso SQLite backend.
 */
export async function validateLicenseKey(licenseKey: string): Promise<{
  valid: boolean
  tier: string
  token_balance?: number
  token_cap?: number
  tokenBalance?: number
  tokenCap?: number
  expires_at?: string | null
  message?: string
}> {
  const candidateUrls = getCandidateBackendUrls()
  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey.trim() }),
      })

      if (res.ok) {
        return await res.json()
      }
    } catch {
      // Continue to next candidate
    }
  }
  return { valid: false, tier: 'free', message: 'Servidor de validação indisponível.' }
}

/**
 * Sends license recovery email to the user.
 */
export async function recoverLicenseKey(email: string): Promise<{ success: boolean; message: string }> {
  const candidateUrls = getCandidateBackendUrls()
  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/license/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (res.ok) {
        return await res.json()
      }
    } catch {
      // Continue to next candidate
    }
  }
  return { success: false, message: 'Falha ao conectar com o serviço de e-mail.' }
}


