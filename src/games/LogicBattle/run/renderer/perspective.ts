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
 * Retorna a coordenada X normalizada [-1, +1] do centro da faixa `laneIndex` entre `laneCount` faixas.
 */
export function getLaneCenterNormX(laneIndex: number, laneCount: 2 | 3): number {
  if (laneCount === 2) {
    return laneIndex === 0 ? -0.24 : 0.24
  }
  if (laneIndex === 0) return -0.32
  if (laneIndex === 1) return 0
  return 0.32
}

/**
 * Converte a coordenada horizontal da legião `laneX` em [-1, +1] para o índice da faixa ativa.
 */
export function resolveLaneIndexFromNormX(laneNormX: number, laneCount: 2 | 3): number {
  if (laneCount === 2) {
    return laneNormX < 0 ? 0 : 1
  }
  if (laneNormX < -0.14) return 0
  if (laneNormX > 0.14) return 2
  return 1
}
