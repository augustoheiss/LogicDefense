// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/perspective.ts — Projeção Pseudo-3D da Ponte
// ──────────────────────────────────────────────────────────────────────────────

export interface BridgeProjectionConfig {
  width: number
  height: number
  horizonYRatio: number
  playerYRatio: number
  nearHalfWidthRatio: number
  farHalfWidthRatio: number
}

export interface ProjectedPoint {
  x: number
  y: number
  scale: number
  halfBridgeWidth: number
}

export function createBridgeProjection(width: number, height: number): BridgeProjectionConfig {
  return {
    width,
    height,
    horizonYRatio: 0.26,
    playerYRatio: 0.84,
    nearHalfWidthRatio: 0.44,
    farHalfWidthRatio: 0.15,
  }
}

/**
 * Projeta uma coordenada normalizada da pista:
 * - `laneNormX` em [-1, +1] (esquerda .. direita da ponte)
 * - `depthZ` em [0, 1] (0 = posição do exército do jogador perto da câmera; 1 = horizonte distante)
 */
export function projectBridgePoint(
  cfg: BridgeProjectionConfig,
  laneNormX: number,
  depthZ: number,
): ProjectedPoint {
  const clampedZ = Math.max(-0.35, Math.min(1.05, depthZ))
  // Curva de perspectiva suave (permite valores negativos de Z irem até a borda inferior da tela)
  const perspT =
    clampedZ >= 0 ? Math.pow(clampedZ, 0.78) : clampedZ * 1.15
  const horizonY = cfg.height * cfg.horizonYRatio
  const playerY = cfg.height * cfg.playerYRatio

  const y = playerY - (playerY - horizonY) * perspT
  const nearHalfW = cfg.width * cfg.nearHalfWidthRatio
  const farHalfW = cfg.width * cfg.farHalfWidthRatio
  const halfBridgeWidth = nearHalfW + (farHalfW - nearHalfW) * perspT

  const centerX = cfg.width * 0.5
  const x = centerX + laneNormX * halfBridgeWidth
  const scale = Math.max(0.28, 1 - 0.68 * perspT)

  return {
    x,
    y,
    scale,
    halfBridgeWidth,
  }
}

/**
 * Retorna a coordenada X 3D real do centro do portão `laneIndex` na Rota Central (`X ∈ [-5.5, +5.5]`).
 * - Para 2 faixas (`laneWidth = 4.8`): Faixa 0 em `X = -2.4`, Faixa 1 em `X = +2.4`.
 * - Para 3 faixas (`laneWidth = 3.2`): Faixa 0 em `X = -3.2`, Faixa 1 em `X = 0.0`, Faixa 2 em `X = +3.2`.
 */
export function getCenterGateWorldX(laneIndex: number, laneCount: 2 | 3): number {
  const cols = laneCount === 3 ? 3 : 2
  const clampedIdx = Math.max(0, Math.min(cols - 1, laneIndex))
  const laneWidth = 9.6 / cols
  return (clampedIdx - (cols - 1) * 0.5) * laneWidth
}

/**
 * Seleciona estritamente o único portão da Rota Central cujo centro 3D (`gateCenterX`)
 * está mais próximo da posição horizontal atual do jogador (`heroWorldX`).
 */
export function resolveClosestCenterGateFromWorldX(
  heroWorldX: number,
  laneCount: 2 | 3,
): { chosenLane: number; gateCenterX: number; distanceToCenter: number } {
  const cols = laneCount === 3 ? 3 : 2
  const safeX = Number.isFinite(heroWorldX) ? heroWorldX : 0
  let bestLane = 0
  let bestCenterX = getCenterGateWorldX(0, cols)
  let bestDist = Math.abs(safeX - bestCenterX)

  for (let i = 1; i < cols; i++) {
    const cx = getCenterGateWorldX(i, cols)
    const dist = Math.abs(safeX - cx)
    if (dist < bestDist) {
      bestDist = dist
      bestLane = i
      bestCenterX = cx
    }
  }

  return {
    chosenLane: bestLane,
    gateCenterX: bestCenterX,
    distanceToCenter: bestDist,
  }
}

/**
 * Retorna a coordenada X normalizada [-1, +1] do centro da faixa `laneIndex` entre `laneCount` faixas.
 * Sincronizada com `getCenterGateWorldX(laneIndex, laneCount) / 10.6`.
 */
export function getLaneCenterNormX(laneIndex: number, laneCount: 2 | 3): number {
  return Number((getCenterGateWorldX(laneIndex, laneCount) / 10.6).toFixed(4))
}

/**
 * Converte a coordenada horizontal da legião `laneX` em [-1, +1] para o índice da faixa ativa,
 * escolhendo sempre o portão cujo centro está mais próximo da posição do jogador.
 */
export function resolveLaneIndexFromNormX(laneNormX: number, laneCount: 2 | 3): number {
  const safeNormX = Number.isFinite(laneNormX) ? laneNormX : 0
  const heroWorldX = safeNormX * 10.6
  return resolveClosestCenterGateFromWorldX(heroWorldX, laneCount).chosenLane
}
