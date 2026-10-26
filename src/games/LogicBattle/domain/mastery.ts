// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/mastery.ts — Maestria Conceitual & Andaime Vygotskiano
// ──────────────────────────────────────────────────────────────────────────────
import { BIOMES } from '../config/biomes'
import { DIFFICULTY_POLICIES } from '../config/difficulty'
import { TRAP_CATALOG } from '../config/trapCatalog'
import { ArmyCount, BiomeId, ConceptId, ConceptMasteryRecord, TrapId } from '../types'

export const ALL_CONCEPT_IDS: readonly ConceptId[] = [
  'ponto_de_virada',
  'nao_comutatividade',
  'soma_repetida_esteira',
  'visao_caminho_inteiro',
  'fracao_menor_que_um',
  'divisao_por_fracao',
  'fracao_impropria',
  'precedencia_operacoes',
  'divisao_euclidiana_resto',
  'multiplicacao_decimal',
  'assimetria_porcentagem',
  'divisao_decimal',
  'porcentagem_acumulada',
  'notacao_milhar',
  'expoente_zero',
  'crescimento_quadratico',
  'subtracao_negativo',
  'raiz_quadrada',
  'potencia_base_dez',
  'produto_sinais',
  'equivalencia_gemeos',
]

export function createInitialMastery(): Record<ConceptId, ConceptMasteryRecord> {
  const map = {} as Record<ConceptId, ConceptMasteryRecord>
  for (const conceptId of ALL_CONCEPT_IDS) {
    map[conceptId] = {
      conceptId,
      attempts: 0,
      optimalChoices: 0,
      trapHits: 0,
      redemptionsCompleted: 0,
      rollingAccuracy: 0.78, // Inicia dentro da zona de fluxo (75% - 85%)
    }
  }
  return map
}

export function updateConceptMastery(
  record: ConceptMasteryRecord,
  wasOptimal: boolean,
  wasTrapHit: boolean,
  wasRedeemed = false,
): ConceptMasteryRecord {
  const attempts = record.attempts + 1
  const optimalChoices = record.optimalChoices + (wasOptimal ? 1 : 0)
  const trapHits = record.trapHits + (wasTrapHit ? 1 : 0)
  const redemptionsCompleted = record.redemptionsCompleted + (wasRedeemed ? 1 : 0)

  const sampleScore = wasOptimal ? 1 : wasRedeemed ? 0.65 : 0
  const alpha = DIFFICULTY_POLICIES.rollingAlpha
  const rollingAccuracy =
    record.attempts === 0
      ? sampleScore
      : Number(((1 - alpha) * record.rollingAccuracy + alpha * sampleScore).toFixed(4))

  return {
    conceptId: record.conceptId,
    attempts,
    optimalChoices,
    trapHits,
    redemptionsCompleted,
    rollingAccuracy,
  }
}

/**
 * Decide se o Detector de Pegadinha (⚠) do Observatório deve aparecer no segmento:
 * - Sempre aparece na estreia absoluta da pegadinha (`seenCount === 0`).
 * - Desbota sozinho (retorna `false`) quando o aluno já atingiu maestria >= 80% com >= 3 tentativas
 *   no conceito daquela pegadinha (Fade-Out Vygotskiano).
 * - Caso contrário, aparece se ainda houver cargas do Observatório na corrida.
 */
export function shouldShowObservatoryDetector(
  trapId: TrapId,
  observatoryLevel: number,
  trapAlertSeenCount: Readonly<Record<TrapId, number>>,
  mastery: Readonly<Record<ConceptId, ConceptMasteryRecord>>,
  detectorAlertsUsedInRun: number,
): boolean {
  const seenCount = trapAlertSeenCount[trapId] ?? 0
  if (seenCount === 0) {
    return true
  }

  const entry = TRAP_CATALOG[trapId]
  const conceptRecord = mastery[entry.conceptId]
  if (
    conceptRecord &&
    conceptRecord.attempts >= DIFFICULTY_POLICIES.minAttemptsForFadeOut &&
    conceptRecord.rollingAccuracy >= DIFFICULTY_POLICIES.scaffoldingFadeOutMasteryThreshold
  ) {
    return false
  }

  return detectorAlertsUsedInRun < observatoryLevel
}

/**
 * Seleciona uma pegadinha válida para o bioma e exército atual `currentArmy`,
 * priorizando conceitos na Zona de Desenvolvimento Proximal.
 */
export function selectNextTrapForBiome(
  biomeId: BiomeId,
  currentArmy: ArmyCount,
  mastery: Readonly<Record<ConceptId, ConceptMasteryRecord>>,
  randFloat: () => number,
  usedTrapIdsInRun: ReadonlySet<TrapId>,
): TrapId | null {
  const biome = BIOMES[biomeId]
  const validCandidates = biome.trapIds.filter((tid) =>
    TRAP_CATALOG[tid].isValidForArmy(currentArmy),
  )

  if (validCandidates.length === 0) {
    return null
  }

  const unusedValid = validCandidates.filter((tid) => !usedTrapIdsInRun.has(tid))
  const pool = unusedValid.length > 0 ? unusedValid : validCandidates

  // Ordenar por menor maestria para priorizar conceitos que precisam de prática
  const weighted = pool
    .map((tid) => {
      const conceptId = TRAP_CATALOG[tid].conceptId
      const acc = mastery[conceptId]?.rollingAccuracy ?? 0.78
      // Peso maior para acurácia menor
      const weight = Math.max(0.15, 1.15 - acc)
      return { tid, weight }
    })

  const totalWeight = weighted.reduce((acc, item) => acc + item.weight, 0)
  let pickVal = randFloat() * totalWeight
  for (const item of weighted) {
    pickVal -= item.weight
    if (pickVal <= 0) {
      return item.tid
    }
  }

  return weighted[weighted.length - 1].tid
}
