import * as yaml from 'js-yaml'
import type { CVData } from '../types/cv'
import { validateAndNormalizeCV } from './cvValidator'

/**
 * Parses raw YAML text into a validated, safe CVData object.
 */
export function parseYamlToCV(rawYaml: string): { data: CVData | null; error: string | null } {
  try {
    const rawParsed = yaml.load(rawYaml)
    const result = validateAndNormalizeCV(rawParsed)
    if (!result.valid || !result.data) {
      return { data: null, error: result.error || 'Estrutura do YAML inválida.' }
    }
    return { data: result.data, error: null }
  } catch (err) {
    return { data: null, error: (err as Error).message }
  }
}

/**
 * Serializes a CVData object into clean, block-style YAML with stable keys.
 */
export function cvToYaml(data: CVData): string {
  try {
    return yaml.dump(data, {
      indent: 2,
      noArrayIndent: false,
      skipInvalid: true,
      flowLevel: -1,
      quotingType: '"',
      forceQuotes: false,
    })
  } catch (err) {
    console.error('Failed to dump CV to YAML:', err)
    return ''
  }
}

/**
 * Creates a debounced version of a function.
 */
export function debounce<T extends (...args: any[]) => void>(func: T, waitMs: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), waitMs)
  }
}
