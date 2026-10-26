// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/trapDetector.ts — Detector Puro de Pegadinhas (§3.2 C3)
// ──────────────────────────────────────────────────────────────────────────────
import { GATE_POLICIES } from '../config/gatePolicies'
import { TRAP_CATALOG } from '../config/trapCatalog'
import { ArmyCount, LaneSegment, TrapHit } from '../types'
import { evaluateSegmentCounterfactual } from './pathOracle'

/**
 * Avalia se a escolha de faixa (`chosenLane`) em `segment` com exército `n`
 * disparou uma Pegadinha Matemática catalogada.
 *
 * Invariantes DbC (§2.1 R4 e §3.2 C3):
 * - Jamais dispara em segmentos que não possuam `trapId` em `TRAP_CATALOG` (Zero Falso Positivo).
 * - Jamais dispara se a faixa escolhida produziu o melhor resultado (`loss <= 0`).
 * - Para pegadinhas não-lendárias (`!entry.legendary`), garante que a perda efetiva reportada
 *   respeita o teto de 60% (`GATE_POLICIES.maxStandardTrapLossRatio`).
 */
export function detectTrap(
  segment: LaneSegment,
  n: ArmyCount,
  chosenLane: number,
): TrapHit | null {
  if (!segment.trapId) {
    return null
  }

  const entry = TRAP_CATALOG[segment.trapId]
  if (!entry) {
    return null
  }

  if (chosenLane < 0 || chosenLane >= segment.lanes.length) {
    return null
  }

  const cf = evaluateSegmentCounterfactual(segment, n)
  const chosenResult = cf.laneResults[chosenLane] ?? n
  const counterfactualResult = cf.bestValue
  const rawLoss = counterfactualResult - chosenResult

  if (rawLoss <= 0 || chosenLane === cf.bestLane) {
    return null
  }

  // Se o segmento define explicitamente a faixa da pegadinha intuitiva (ex.: em biomas de 3 faixas),
  // escolher a 3ª faixa intermediária não deve acusar falso-positivo da pegadinha específica.
  if (
    segment.intuitiveLane !== undefined &&
    chosenLane !== segment.intuitiveLane
  ) {
    return null
  }
  const maxAllowedLoss = entry.legendary
    ? counterfactualResult
    : Math.max(1, Math.floor(counterfactualResult * GATE_POLICIES.maxStandardTrapLossRatio))

  const effectiveLoss = Math.max(1, Math.min(rawLoss, maxAllowedLoss))
  const lossRatio =
    counterfactualResult > 0 ? effectiveLoss / counterfactualResult : 0

  return {
    trapId: entry.id,
    trapName: entry.name,
    conceptId: entry.conceptId,
    segmentId: segment.id,
    chosenLane,
    betterLane: cf.bestLane,
    armyBefore: n,
    chosenResult,
    counterfactualResult,
    loss: effectiveLoss,
    lossRatio,
    intuitionTrapPt: entry.intuitionTrapPt,
    luzGuiaPt: entry.luzGuiaPt,
    codexSlug: entry.codexSlug,
  }
}
