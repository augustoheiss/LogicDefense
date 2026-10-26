// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/runSimulation.ts — Utilitários de Inspeção da Corrida
// ──────────────────────────────────────────────────────────────────────────────
import { evaluateSegmentCounterfactual } from '../domain/pathOracle'
import { ArmyCount, LaneSegment, PairCounterfactual, RunSnapshot } from '../types'

export function getActiveSegment(snapshot: RunSnapshot): LaneSegment | null {
  return snapshot.segments[snapshot.activeSegmentIndex] ?? null
}

export function getActiveSegmentCounterfactual(
  snapshot: RunSnapshot,
): PairCounterfactual | null {
  const seg = getActiveSegment(snapshot)
  if (!seg) return null
  return evaluateSegmentCounterfactual(seg, snapshot.currentArmy)
}

export function getRemainingSegmentsCount(snapshot: RunSnapshot): number {
  return Math.max(0, snapshot.segments.length - snapshot.activeSegmentIndex)
}

export function getEstimatedWinProbability(
  currentArmy: ArmyCount,
  enemyTotal: ArmyCount,
  oracleBest: ArmyCount,
): number {
  if (currentArmy >= enemyTotal) return 0.99
  if (oracleBest <= 0) return 0.5
  const ratio = currentArmy / Math.max(1, enemyTotal)
  return Math.max(0.08, Math.min(0.95, Number((0.25 + ratio * 0.65).toFixed(2))))
}
