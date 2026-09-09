/**
 * DataShapeClassifier.ts
 *
 * Motor de Inferência de Forma de Dados (Data-Shape Profiling Engine)
 * do Universal Document Compiler.
 *
 * Analisa a geometria algorítmica, uniformidade de chaves (Similaridade de Jaccard),
 * âncoras temporais e densidade de caracteres de qualquer nó YAML/JSON para classificar
 * determinística e pedagogicamente em um dos 5 Arquétipos Canônicos:
 * - card_grid
 * - timeline
 * - badge_list
 * - key_value_table
 * - prose_flow
 *
 * Garante soberania total ao usuário, permitindo sobreposição (override) a qualquer instante.
 */

import {
  ALL_CANONICAL_ARCHETYPES,
  type ArchetypeClassification,
  type LayoutArchetype,
} from '../types/universalAST'

// Dicionário léxico de âncoras temporais
const TEMPORAL_KEY_TRIGGERS = new Set([
  'date', 'dates', 'startdate', 'enddate', 'period', 'periodo',
  'ano', 'year', 'years', 'data', 'inicio', 'fim', 'start', 'end',
  'since', 'until', 'prazo', 'deadline', 'release_date', 'safra',
  'temporada', 'timestamp', 'mes', 'month', 'semestre',
])

// Padrão regex para detecção de datas, anos e intervalos
const TEMPORAL_VALUE_REGEX = /(?:\b(19|20)\d{2}\b|\b\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}\b|presente|present|atual|current)/i

/**
 * Calcula a similaridade de Jaccard entre dois conjuntos de chaves
 * J(A, B) = |A ∩ B| / |A ∪ B|
 */
export function jaccardSimilarity(keysA: Set<string>, keysB: Set<string>): number {
  if (keysA.size === 0 && keysB.size === 0) return 1.0
  const union = new Set([...keysA, ...keysB])
  if (union.size === 0) return 0

  let intersection = 0
  for (const k of keysA) {
    if (keysB.has(k)) intersection++
  }

  return intersection / union.size
}

/**
 * Calcula a uniformidade média de chaves em um array de objetos
 */
export function calculateKeyUniformity(items: any[]): number {
  const objectItems = items.filter((it) => it && typeof it === 'object' && !Array.isArray(it))
  if (objectItems.length <= 1) return 1.0

  const keySets = objectItems.map((it) => new Set(Object.keys(it).map((k) => k.toLowerCase())))
  let totalScore = 0
  let comparisons = 0

  // Compara pares adjacentes e primeiro com último para eficiência O(N)
  for (let i = 0; i < keySets.length - 1; i++) {
    totalScore += jaccardSimilarity(keySets[i], keySets[i + 1])
    comparisons++
  }
  if (keySets.length > 2) {
    totalScore += jaccardSimilarity(keySets[0], keySets[keySets.length - 1])
    comparisons++
  }

  return comparisons > 0 ? totalScore / comparisons : 1.0
}

/**
 * Verifica se um objeto ou suas chaves/valores contêm âncoras temporais
 */
export function detectTemporalAnchors(item: any): boolean {
  if (!item || typeof item !== 'object') return false

  for (const [rawKey, val] of Object.entries(item)) {
    const key = rawKey.toLowerCase()
    if (TEMPORAL_KEY_TRIGGERS.has(key)) return true
    if (typeof val === 'string' && TEMPORAL_VALUE_REGEX.test(val)) return true
  }

  return false
}

/**
 * Classifica a topologia de um nó de dados em um Arquétipo Canônico de Layout
 *
 * @param sectionKey - A chave do nó (ex: 'experiencia', 'kpis', 'habilidades')
 * @param rawValue   - O valor associado no YAML (array, objeto ou string)
 * @param userOverride - Arquétipo explicitamente escolhido pelo usuário (se houver)
 */
export function classifyNode(
  sectionKey: string,
  rawValue: any,
  userOverride?: LayoutArchetype
): ArchetypeClassification {
  const keyLower = String(sectionKey || '').toLowerCase()

  // 1. Caso Primitivo: String simples ou texto longo
  if (typeof rawValue === 'string') {
    const isLongText = rawValue.length > 100 || rawValue.includes('\n')
    const inferred: LayoutArchetype = isLongText ? 'prose_flow' : 'key_value_table'
    return buildClassification(
      inferred,
      userOverride,
      isLongText ? 0.95 : 0.7,
      isLongText ? 'Texto corrido narrativo de múltiplos caracteres' : 'Valor escalar simples'
    )
  }

  // 2. Caso Array: Mapeia sequências de itens
  if (Array.isArray(rawValue)) {
    if (rawValue.length === 0) {
      return buildClassification(
        'card_grid',
        userOverride,
        0.5,
        'Coleção vazia; assumindo grade estrutural padrão'
      )
    }

    // 2.1 Array de strings primitivas (ex: tags, skills, pilares)
    const allPrimitives = rawValue.every((it) => typeof it === 'string' || typeof it === 'number')
    if (allPrimitives) {
      const avgLen = rawValue.reduce((acc, it) => acc + String(it).length, 0) / rawValue.length
      if (avgLen <= 40) {
        return buildClassification(
          'badge_list',
          userOverride,
          0.95,
          `Coleção compacta de termos curtos (comprimento médio: ${avgLen.toFixed(1)} caracteres)`
        )
      } else {
        return buildClassification(
          'prose_flow',
          userOverride,
          0.85,
          `Sequência de parágrafos descritivos (comprimento médio: ${avgLen.toFixed(1)} caracteres)`
        )
      }
    }

    // 2.2 Array de objetos
    const objectItems = rawValue.filter((it) => it && typeof it === 'object' && !Array.isArray(it))
    if (objectItems.length > 0) {
      const uniformity = calculateKeyUniformity(objectItems)
      const hasTemporal = objectItems.some(detectTemporalAnchors) || TEMPORAL_KEY_TRIGGERS.has(keyLower)

      // Se possui datas explícitas e estrutura de eventos ➔ Timeline
      if (hasTemporal) {
        return buildClassification(
          'timeline',
          userOverride,
          0.92,
          `Sequência cronológica detectada com âncoras temporais (uniformidade Jaccard: ${(uniformity * 100).toFixed(0)}%)`
        )
      }

      // Se é homogêneo (Jaccard >= 0.55) com múltiplos campos ➔ Card Grid
      if (uniformity >= 0.55) {
        return buildClassification(
          'card_grid',
          userOverride,
          0.88,
          `Estrutura homogênea de múltiplos campos (Jaccard: ${(uniformity * 100).toFixed(0)}%) ideal para cartões modulares`
        )
      }

      // Se os objetos são pares chave/valor simples (ex: { nome: 'RAM', valor: '32GB' })
      const isSimplePairList = objectItems.every((it) => Object.keys(it).length <= 2)
      if (isSimplePairList) {
        return buildClassification(
          'key_value_table',
          userOverride,
          0.82,
          'Lista de pares associativos compactos, recomendada tabela de especificação'
        )
      }

      // Fallback para Card Grid estruturado
      return buildClassification(
        'card_grid',
        userOverride,
        0.7,
        'Sequência estruturada heterogênea'
      )
    }
  }

  // 3. Caso Objeto Único (Dicionário ou Mapeamento Associativo)
  if (rawValue && typeof rawValue === 'object') {
    const keys = Object.keys(rawValue)
    const values = Object.values(rawValue)

    // Se todos os valores forem primitivos (número, texto curto, booleano) ➔ Key-Value Table
    const allPrimitiveValues = values.every(
      (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null
    )

    if (allPrimitiveValues && keys.length > 0) {
      return buildClassification(
        'key_value_table',
        userOverride,
        0.92,
        `Mapeamento associativo com ${keys.length} pares de parâmetros primitivos`
      )
    }

    // Se tiver texto longo dominante
    const hasLongProse = values.some((v) => typeof v === 'string' && v.length > 150)
    if (hasLongProse) {
      return buildClassification(
        'prose_flow',
        userOverride,
        0.85,
        'Objeto estruturado com seções narrativas densas'
      )
    }

    // Padrão para objetos ricos
    return buildClassification(
      'card_grid',
      userOverride,
      0.75,
      'Bloco de metadados multifacetados'
    )
  }

  // Fallback universal seguro
  return buildClassification(
    'card_grid',
    userOverride,
    0.5,
    'Classificação genérica de dados'
  )
}

/**
 * Monta o objeto de classificação com suporte a override total do usuário
 */
function buildClassification(
  inferred: LayoutArchetype,
  userOverride: LayoutArchetype | undefined,
  confidence: number,
  reason: string
): ArchetypeClassification {
  return {
    inferred,
    userOverride,
    effective: userOverride || inferred,
    confidence,
    reason,
    availableArchetypes: ALL_CANONICAL_ARCHETYPES,
  }
}
