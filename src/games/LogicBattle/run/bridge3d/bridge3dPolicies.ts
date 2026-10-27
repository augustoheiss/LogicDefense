// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/bridge3dPolicies.ts
// Políticas geométricas, rotas 3D (Esquerda, Centro, Direita), câmera 3D e
// progressão honesta Zero-to-Hero de poder de tiro para o Mundo 1 (WebGL 3D).
// ──────────────────────────────────────────────────────────────────────────────

export type BridgeRouteId = 'LEFT' | 'CENTER' | 'RIGHT'

export type BridgeCameraMode = 'BALANCED' | 'LOCKED' | 'FREE'

export interface BridgeRouteBounds {
  readonly id: BridgeRouteId
  readonly label: string
  readonly xMin: number
  readonly xMax: number
  readonly xCenter: number
  readonly width: number
  readonly floorColor: string
  readonly trimColor: string
}

/**
 * Geometria oficial das 3 Rotas Paralelas na Ponte 3D Widescreen:
 * - Rota Esquerda (X ∈ [-11.8, -5.5]): Bloco Congelado Inicial (5 HP) + Esteira de Portões (+1, +1, +1, +2...)
 * - Rota Central  (X ∈ [-5.5,  +5.5]): Horda Inimiga, Mini-Bosses, Barris, Portões Centrais e Mega-Boss
 * - Rota Direita  (X ∈ [+5.5, +11.8]): Arma Pesada Congelada (888 HP) + Esteira de Portões (+10, +50, +99) + Bônus 🧮
 */
export const BRIDGE_3D_ROUTES: Record<BridgeRouteId, BridgeRouteBounds> = {
  LEFT: {
    id: 'LEFT',
    label: 'Rota Esquerda (+Soldados)',
    xMin: -11.8,
    xMax: -5.5,
    xCenter: -8.65,
    width: 6.3,
    floorColor: '#1e3a5f',
    trimColor: '#38bdf8',
  },
  CENTER: {
    id: 'CENTER',
    label: 'Rota Central (Guerra & Boss)',
    xMin: -5.5,
    xMax: 5.5,
    xCenter: 0,
    width: 11.0,
    floorColor: '#334155',
    trimColor: '#facc15',
  },
  RIGHT: {
    id: 'RIGHT',
    label: 'Rota Direita (Arsenal +99)',
    xMin: 5.5,
    xMax: 11.8,
    xCenter: 8.65,
    width: 6.3,
    floorColor: '#3b2f1e',
    trimColor: '#fbbf24',
  },
}

export const BRIDGE_3D_DIMENSIONS = {
  totalWidth: 24.8,
  playableHalfWidth: 11.0,
  zPlayerLine: 10.5,
  zFortressLine: -96.0,
  deckLength: 140.0,
  parapetLeftDividerX: -5.5,
  parapetRightDividerX: 5.5,
  outerLeftWallX: -12.15,
  outerRightWallX: 12.15,
} as const

export interface BridgeCameraPreset {
  readonly mode: BridgeCameraMode
  readonly label: string
  readonly icon: string
  readonly baseOffset: readonly [number, number, number]
  readonly lookAtZOffset: number
  readonly fovDesktop: number
  readonly fovMobile: number
  readonly maxYawRad: number
  readonly minPolarAngle: number
  readonly maxPolarAngle: number
  readonly minDistance: number
  readonly maxDistance: number
}

export const BRIDGE_CAMERA_PRESETS: Record<BridgeCameraMode, BridgeCameraPreset> = {
  BALANCED: {
    mode: 'BALANCED',
    label: 'Câmera 3D Equilibrada',
    icon: '⚖️',
    baseOffset: [0, 17.5, 24.5],
    lookAtZOffset: -18.0,
    fovDesktop: 46,
    fovMobile: 56,
    maxYawRad: 0.68, // ~39° para cada lado
    minPolarAngle: 0.42,
    maxPolarAngle: 1.18,
    minDistance: 20,
    maxDistance: 50,
  },
  LOCKED: {
    mode: 'LOCKED',
    label: 'Câmera Arcade Travada',
    icon: '🔒',
    baseOffset: [0, 16.5, 23.0],
    lookAtZOffset: -19.0,
    fovDesktop: 45,
    fovMobile: 55,
    maxYawRad: 0,
    minPolarAngle: 0.68,
    maxPolarAngle: 0.68,
    minDistance: 27,
    maxDistance: 27,
  },
  FREE: {
    mode: 'FREE',
    label: 'Câmera Tática Livre',
    icon: '🎥',
    baseOffset: [0, 21.0, 28.0],
    lookAtZOffset: -22.0,
    fovDesktop: 48,
    fovMobile: 58,
    maxYawRad: 1.35, // ~77° para cada lado
    minPolarAngle: 0.3,
    maxPolarAngle: 1.32,
    minDistance: 16,
    maxDistance: 64,
  },
}

export interface DynamicShotProfile {
  readonly damagePerShot: number
  readonly shotsPerSecond: number
  readonly parallelBarrels: number
  readonly projectileSpeed: number
  readonly projectileScale: number
  readonly projectileColor: string
  readonly tierLabel: string
}

/**
 * Calcula dinamicamente o poder de tiro do jogador a partir dos pontos/exército atuais.
 * - Começa com 1 cano simples (Zero-to-Hero real).
 * - Se os pontos sobem, ganha mais canos paralelos, mais cadência e mais dano por tiro.
 * - Se os pontos caem (portão negativo ou dano de monstro), o tiro enfraquece imediatamente.
 */
export function computeShotProfile(armyPoints: number): DynamicShotProfile {
  const safePts = Math.max(1, Number.isFinite(armyPoints) ? armyPoints : 1)
  // Pontos ganhos além da base inicial (5)
  const netGain = Math.max(0, safePts - 5)
  const logPower = Math.log10(Math.max(1, netGain + 1))

  const damagePerShot = Math.max(
    1,
    netGain >= 1e12
      ? netGain * 0.14
      : Math.round(1 + netGain * 0.14 + Math.pow(logPower, 1.85) * 4),
  )

  const shotsPerSecond = Math.min(
    14,
    Number((3.2 + logPower * 2.15 + Math.min(2.5, netGain * 0.02)).toFixed(2)),
  )

  const parallelBarrels =
    safePts >= 1000
      ? 6
      : safePts >= 350
        ? 5
        : safePts >= 100
          ? 4
          : safePts >= 30
            ? 3
            : safePts >= 10
              ? 2
              : 1

  const projectileSpeed = Math.min(72, 38 + logPower * 7.5)
  const projectileScale = Math.min(1.85, 0.72 + logPower * 0.24)

  const projectileColor =
    safePts >= 1000
      ? '#facc15' // Ouro Quiliarca (1k+)
      : safePts >= 100
        ? '#f97316' // Plasma Centurião (0,1k+)
        : safePts >= 25
          ? '#38bdf8' // Laser Ciano (Esquadrão)
          : '#bae6fd' // Disparo Base

  const tierLabel =
    safePts >= 1000
      ? 'Canhão Titã 1k'
      : safePts >= 100
        ? 'Bateria Centurião 0,1k'
        : safePts >= 10
          ? 'Rifle Duplo de Pelotão'
          : 'Atirador Solo'

  return {
    damagePerShot,
    shotsPerSecond,
    parallelBarrels,
    projectileSpeed,
    projectileScale,
    projectileColor,
    tierLabel,
  }
}

/**
 * Converte a posição normalizada do jogador (`laneX` ∈ [-1, +1])
 * para coordenada 3D real no eixo X cobrindo as 3 Rotas (`[-10.4, +10.4]`),
 * alinhando as faixas centrais (`±0.48`) exatamente com os portões da Rota Central (`X = ±2.4`)
 * e evitando que o herói fique em cima das muretas divisórias (`X = ±5.5`).
 */
export function laneNormToWorldX(laneNormX: number): number {
  const clamped = Math.max(-1, Math.min(1, laneNormX))
  const abs = Math.abs(clamped)
  const sign = Math.sign(clamped)
  if (abs <= 0.55) {
    // Faixa Central: ±0.48 mapeia exatamente para X = ±2.40 (centro dos portões da Rota Central)
    return clamped * 5.0
  }
  // Rotas Laterais (Esquerda X ≈ -8.65 e Direita X ≈ +8.65), saltando a mureta em ±5.5
  const sideT = (abs - 0.55) / 0.45
  return sign * (6.4 + sideT * 3.9)
}

/**
 * Identifica em qual das 3 Rotas (LEFT, CENTER, RIGHT) uma coordenada X 3D está.
 */
export function resolveRouteFromWorldX(worldX: number): BridgeRouteId {
  if (worldX < BRIDGE_3D_DIMENSIONS.parapetLeftDividerX) return 'LEFT'
  if (worldX > BRIDGE_3D_DIMENSIONS.parapetRightDividerX) return 'RIGHT'
  return 'CENTER'
}
