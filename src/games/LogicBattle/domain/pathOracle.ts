// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/pathOracle.ts — Oráculo de Caminhos (§3.2 C2)
// ──────────────────────────────────────────────────────────────────────────────
import {
  ArmyCount,
  LaneSegment,
  PairCounterfactual,
  PathOracleResult,
  RunPlan,
} from '../types'
import { applyGateChain, clampArmy } from './armyMath'

export function evaluateSegmentCounterfactual(
  segment: LaneSegment,
  armyBefore: ArmyCount,
): PairCounterfactual {
  const safeBefore = clampArmy(armyBefore)
  const laneResults = segment.lanes.map((laneGates) => applyGateChain(safeBefore, laneGates))

  let bestLane = 0
  let worstLane = 0
  let bestValue = laneResults[0] ?? safeBefore
  let worstValue = laneResults[0] ?? safeBefore

  for (let i = 1; i < laneResults.length; i++) {
    const val = laneResults[i]
    if (val > bestValue) {
      bestValue = val
      bestLane = i
    }
    if (val < worstValue) {
      worstValue = val
      worstLane = i
    }
  }

  return {
    segmentId: segment.id,
    segmentIndex: segment.index,
    laneResults,
    bestLane,
    worstLane,
    bestValue,
    worstValue,
  }
}

/**
 * Calcula por programação dinâmica o melhor e o pior resultado possíveis da corrida,
 * além da lista de contrafactuais por segmento ao longo da trajetória ótima.
 */
export function pathOracle(
  planOrSegments: Pick<RunPlan, 'segments' | 'n0'>,
  n0Override?: ArmyCount,
): PathOracleResult {
  const segments = planOrSegments.segments
  const initialArmy = clampArmy(n0Override ?? planOrSegments.n0)

  if (segments.length === 0) {
    return {
      best: initialArmy,
      worst: initialArmy,
      bestPath: [],
      worstPath: [],
      perSegment: [],
    }
  }

  let bestArmy = initialArmy
  let worstArmy = initialArmy
  const bestPath: number[] = []
  const worstPath: number[] = []
  const perSegment: PairCounterfactual[] = []

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx]
    const cfBest = evaluateSegmentCounterfactual(seg, bestArmy)
    const cfWorst = evaluateSegmentCounterfactual(seg, worstArmy)

    bestArmy = cfBest.bestValue
    bestPath.push(cfBest.bestLane)

    worstArmy = cfWorst.worstValue
    worstPath.push(cfWorst.worstLane)

    perSegment.push(cfBest)
  }

  return {
    best: bestArmy,
    worst: worstArmy,
    bestPath,
    worstPath,
    perSegment,
  }
}
