import type { TextVariant, ThemeVariant, CVVersions } from '../types/cv'
import { parseYamlToCV } from './yamlService'

export interface CVHistoryItem {
  id: string
  timestamp: string // ISO string
  formattedDate: string // e.g. "28/08/2026 às 23:45"
  name: string
  label: string
  persona: TextVariant
  theme?: ThemeVariant
  source: 'ai_generated' | 'yaml_editor' | 'file_upload' | 'backup_restore'
  yaml: string
  wordCount?: number
}

const STORAGE_HISTORY_KEY = 'ld_cv_history_v2'
const MAX_HISTORY_ITEMS = 20

/**
 * Formats an ISO date into Brazilian Portuguese readable string
 */
function formatDateTime(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} às ${hours}:${mins}`
  } catch {
    return 'Recente'
  }
}

/**
 * Retrieves the current CV history list from localStorage (up to 20 items).
 */
export function getCVHistory(): CVHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_HISTORY_ITEMS)
    }
    return []
  } catch (err) {
    console.error('Falha ao carregar histórico de currículos:', err)
    return []
  }
}

/**
 * Saves a single CV version into the history ledger (FIFO up to 20 items).
 */
export function saveCVToHistory(params: {
  yaml: string
  persona?: TextVariant
  theme?: ThemeVariant
  source?: CVHistoryItem['source']
  customName?: string
  customLabel?: string
}): CVHistoryItem[] {
  try {
    if (!params.yaml || params.yaml.trim().length < 20) {
      return getCVHistory()
    }

    const currentHistory = getCVHistory()
    const parsed = parseYamlToCV(params.yaml)
    const name = params.customName || parsed.data?.basics.name || 'Currículo Sem Nome'
    const label = params.customLabel || parsed.data?.basics.label || 'Profissional'
    const persona = params.persona || 'professional'
    const source = params.source || 'yaml_editor'

    // Evita duplicatas idênticas consecutivas
    if (currentHistory.length > 0 && currentHistory[0].yaml.trim() === params.yaml.trim()) {
      return currentHistory
    }

    const now = new Date().toISOString()
    const newItem: CVHistoryItem = {
      id: `cv_hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      formattedDate: formatDateTime(now),
      name,
      label,
      persona,
      theme: params.theme,
      source,
      yaml: params.yaml,
      wordCount: params.yaml.split(/\s+/).length,
    }

    // Adiciona no topo e remove os mais antigos se passar de 20
    const updated = [newItem, ...currentHistory.filter(i => i.yaml.trim() !== params.yaml.trim())].slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated))
    return updated
  } catch (err) {
    console.error('Falha ao salvar no histórico:', err)
    return getCVHistory()
  }
}

/**
 * Saves all 5 AI-generated personas at once into the history ledger.
 */
export function saveMultipleCVsToHistory(
  versions: CVVersions | Partial<Record<TextVariant, string>>,
  source: CVHistoryItem['source'] = 'ai_generated'
): CVHistoryItem[] {
  try {
    let history = getCVHistory()
    const personas: TextVariant[] = ['professional', 'architect', 'historian', 'didactic', 'alien']
    const now = new Date().toISOString()

    const newItems: CVHistoryItem[] = []

    for (const p of personas) {
      const yaml = versions[p]
      if (yaml && yaml.trim().length > 20) {
        const parsed = parseYamlToCV(yaml)
        const name = parsed.data?.basics.name || 'Candidato'
        const label = parsed.data?.basics.label || 'Especialista'

        newItems.push({
          id: `cv_hist_${Date.now()}_${p}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          formattedDate: formatDateTime(now),
          name,
          label,
          persona: p,
          source,
          yaml,
          wordCount: yaml.split(/\s+/).length,
        })
      }
    }

    // Concatena as novas versões geradas com o histórico existente (filtrando duplicatas)
    const merged = [...newItems, ...history.filter(h => !newItems.some(n => n.yaml.trim() === h.yaml.trim()))].slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(merged))
    return merged
  } catch (err) {
    console.error('Falha ao salvar lote de versões no histórico:', err)
    return getCVHistory()
  }
}

/**
 * Deletes a single item from the history.
 */
export function deleteHistoryItem(id: string): CVHistoryItem[] {
  try {
    const current = getCVHistory()
    const filtered = current.filter(item => item.id !== id)
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(filtered))
    return filtered
  } catch (err) {
    console.error('Falha ao remover item do histórico:', err)
    return getCVHistory()
  }
}

/**
 * Full LGPD & Privacy Reset:
 * Completely wipes history, drafts, last modified timestamps and themes.
 */
export function clearAllCVDataAndHistory(): void {
  try {
    localStorage.removeItem(STORAGE_HISTORY_KEY)
    localStorage.removeItem('ld_cv_draft_v2')
    localStorage.removeItem('ld_cv_theme_v2')
    localStorage.removeItem('ld_cv_last_modified')
  } catch (err) {
    console.error('Falha ao limpar dados do navegador:', err)
  }
}

/**
 * Exports the entire 20-item history ledger as a JSON string.
 */
export function exportHistoryAsJSON(): string {
  const history = getCVHistory()
  const payload = {
    app: 'LogicDefense CV Maker 2.0',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    itemCount: history.length,
    history,
  }
  return JSON.stringify(payload, null, 2)
}

/**
 * Imports a history backup JSON and merges into localStorage.
 */
export function importHistoryFromJSON(jsonString: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString)
    const items = parsed.history || parsed.items || (Array.isArray(parsed) ? parsed : null)

    if (!Array.isArray(items)) {
      return { success: false, count: 0, error: 'Arquivo JSON com estrutura de histórico inválida.' }
    }

    const current = getCVHistory()
    const validItems: CVHistoryItem[] = []

    for (const it of items) {
      if (it && typeof it.yaml === 'string' && it.yaml.trim().length > 10) {
        validItems.push({
          id: it.id || `cv_hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: it.timestamp || new Date().toISOString(),
          formattedDate: it.formattedDate || formatDateTime(it.timestamp || new Date().toISOString()),
          name: it.name || 'Candidato Importado',
          label: it.label || 'Profissional',
          persona: it.persona || 'professional',
          theme: it.theme || 'executive',
          source: 'backup_restore',
          yaml: it.yaml,
          wordCount: it.wordCount || it.yaml.split(/\s+/).length,
        })
      }
    }

    const merged = [...validItems, ...current.filter(c => !validItems.some(v => v.yaml.trim() === c.yaml.trim()))].slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(merged))

    return { success: true, count: validItems.length }
  } catch (err) {
    return { success: false, count: 0, error: (err as Error).message || 'Falha ao processar arquivo JSON.' }
  }
}
