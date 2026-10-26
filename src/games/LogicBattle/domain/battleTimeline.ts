// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/battleTimeline.ts — Combate Visível Determinístico (§3.2 & §3.3)
// ──────────────────────────────────────────────────────────────────────────────
import { ArmyCount, BattleResolution, EnemySpec } from '../types'
import { clampArmy } from './armyMath'

export interface BattleTimelineOptions {
  reducedMotion?: boolean
}

export interface BattleTimelineSample {
  /** Fração normalizada [0, 1] da batalha */
  progress: number
  /** Soldados restantes do jogador no instante t */
  playerLeft: ArmyCount
  /** Soldados restantes da horda inimiga no instante t */
  hordeLeft: ArmyCount
  /** HP restante do Chefe no instante t */
  bossLeft: ArmyCount
  /** Força inimiga total restante (hordeLeft + bossLeft) */
  enemyTotalLeft: ArmyCount
  /** Baixas acumuladas até o instante t */
  killsSoFar: ArmyCount
}

export interface BattleTimeline {
  durationMs: number
  cadenceVolleysPerSec: number
  initialPlayer: ArmyCount
  initialHorde: ArmyCount
  initialBoss: ArmyCount
  initialEnemyTotal: ArmyCount
  resolution: BattleResolution
  sampleAt: (elapsedMs: number) => BattleTimelineSample
}

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

/**
 * Constrói a linha do tempo determinística da Batalha Final (§3.2):
 * - Vitória: `T = clamp(6000 * E / P, 1500, 6000)` -> mais forte = derrota mais rápido!
 *   (P = 2E => 3000ms; P = 4E => 1500ms; P = E => 6000ms)
 * - Derrota: `T = clamp(3000 + 3000 * P / E, 3000, 6000)` -> derrota por pouco dura mais e para no déficit exato!
 * - Invariante estrita: `sampleAt(0) = { P, H, B }` e `sampleAt(durationMs)` coincide 100% com `resolveBattle()`.
 */
export function buildBattleTimeline(
  resolution: BattleResolution,
  enemy: EnemySpec,
  opts?: BattleTimelineOptions,
): BattleTimeline {
  const P = clampArmy(resolution.playerArmy)
  const H = clampArmy(enemy.horde)
  const B = clampArmy(enemy.bossHp)
  const E = Math.max(1, H + B)

  let durationMs: number
  if (opts?.reducedMotion) {
    durationMs = 1000
  } else if (resolution.outcome === 'VICTORY') {
    const raw = (6000 * E) / Math.max(1, P)
    durationMs = Math.round(Math.max(1500, Math.min(6000, raw)))
  } else {
    const raw = 3000 + (3000 * P) / E
    durationMs = Math.round(Math.max(3000, Math.min(6000, raw)))
  }

  const cadenceVolleysPerSec = Math.max(
    2,
    Math.min(10, 2 + Math.log10(Math.max(1, P))),
  )

  // Total de baixas 1-para-1 até o fim da batalha
  const totalPlayerLost = P - resolution.survivors
  const totalEnemyKilled = E - resolution.deficit

  const sampleAt = (elapsedMs: number): BattleTimelineSample => {
    if (elapsedMs <= 0) {
      return {
        progress: 0,
        playerLeft: P,
        hordeLeft: H,
        bossLeft: B,
        enemyTotalLeft: E,
        killsSoFar: 0,
      }
    }

    if (elapsedMs >= durationMs) {
      const finalEnemyLeft = resolution.deficit
      const finalHordeLeft = Math.max(0, H - totalEnemyKilled)
      const finalBossLeft = Math.max(0, finalEnemyLeft - finalHordeLeft)
      return {
        progress: 1,
        playerLeft: resolution.survivors,
        hordeLeft: finalHordeLeft,
        bossLeft: finalBossLeft,
        enemyTotalLeft: finalEnemyLeft,
        killsSoFar: totalEnemyKilled,
      }
    }

    const normT = elapsedMs / durationMs
    const eased = smoothstep(normT)

    const enemyKilledNow = Math.min(totalEnemyKilled, Math.floor(totalEnemyKilled * eased))
    const playerLostNow = Math.min(totalPlayerLost, Math.floor(totalPlayerLost * eased))

    const playerLeft = Math.max(resolution.survivors, P - playerLostNow)
    const hordeLeft = Math.max(0, H - enemyKilledNow)
    const bossDamage = Math.max(0, enemyKilledNow - H)
    const bossLeft = Math.max(0, B - bossDamage)
    const enemyTotalLeft = hordeLeft + bossLeft

    return {
      progress: normT,
      playerLeft,
      hordeLeft,
      bossLeft,
      enemyTotalLeft,
      killsSoFar: enemyKilledNow,
    }
  }

  return {
    durationMs,
    cadenceVolleysPerSec,
    initialPlayer: P,
    initialHorde: H,
    initialBoss: B,
    initialEnemyTotal: E,
    resolution,
    sampleAt,
  }
}
