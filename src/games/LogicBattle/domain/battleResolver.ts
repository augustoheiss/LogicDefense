// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/battleResolver.ts — Resolução da Batalha Final
// ──────────────────────────────────────────────────────────────────────────────
import { ArmyCount, BattleResolution, EnemySpec } from '../types'
import { clampArmy } from './armyMath'

/**
 * Resolve o embate final entre o exército do jogador e a Horda + Chefe inimigo.
 * A duração da animação escala logaritmicamente com N em [2.000 ms, 4.000 ms].
 */
export function resolveBattle(
  playerArmy: ArmyCount,
  enemy: EnemySpec,
): BattleResolution {
  const safePlayer = clampArmy(playerArmy)
  const enemyForce = clampArmy(enemy.totalForce)

  const combinedMagnitude = Math.max(10, safePlayer + enemyForce)
  const durationMs = Math.max(
    2000,
    Math.min(4000, Math.round(2000 + Math.log10(combinedMagnitude) * 420)),
  )

  if (safePlayer >= enemyForce) {
    const survivors = Math.max(1, safePlayer - enemyForce)
    return {
      outcome: 'VICTORY',
      playerArmy: safePlayer,
      enemyForce,
      survivors,
      deficit: 0,
      durationMs,
    }
  }

  const deficit = Math.max(1, enemyForce - safePlayer)
  return {
    outcome: 'DEFEAT',
    playerArmy: safePlayer,
    enemyForce,
    survivors: 0,
    deficit,
    durationMs,
  }
}
