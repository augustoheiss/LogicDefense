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
    horizonYRatio: 0.2,
    playerYRatio: 0.82,
    nearHalfWidthRatio: 0.43,
    farHalfWidthRatio: 0.13,
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
  const clampedZ = Math.max(-0.15, Math.min(1.05, depthZ))
  // Curva de perspectiva suave para dar sensação real de profundidade
  const perspT = Math.pow(Math.max(0, clampedZ), 0.78)
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
    return laneIndex === 0 ? -0.48 : 0.48
  }
  if (laneIndex === 0) return -0.64
  if (laneIndex === 1) return 0
  return 0.64
}

/**
 * Converte a coordenada horizontal da legião `laneX` em [-1, +1] para o índice da faixa ativa.
 */
export function resolveLaneIndexFromNormX(laneNormX: number, laneCount: 2 | 3): number {
  if (laneCount === 2) {
    return laneNormX < 0 ? 0 : 1
  }
  if (laneNormX < -0.22) return 0
  if (laneNormX > 0.22) return 2
  return 1
}
