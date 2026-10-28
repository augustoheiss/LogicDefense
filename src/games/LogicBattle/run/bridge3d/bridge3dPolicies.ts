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
      : safePts < 35
        ? Math.max(1, Math.round(1 + netGain * 0.03))
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
          : safePts >= 45
            ? 3
            : safePts >= 25
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
 * Políticas de ativação temporizada da Rota Direita (V8 Fase 2):
 * Os buffs e armas da Rota Direita ficam congelados/cinzas por padrão e só
 * ativam por alguns segundos após o jogador resolver uma conta matemática (🧮).
 */
export const RIGHT_CORRIDOR_TIMED_POLICIES = {
  durationMsByTier: {
    1: 12000, // Fácil: 12s de Rota Direita ativa
    2: 15000, // Médio: 15s de Rota Direita ativa
    3: 18000, // Difícil: 18s de Rota Direita ativa
    4: 24000, // Problema: 24s de Rota Direita ativa
  } as Record<1 | 2 | 3 | 4, number>,
} as const

/**
 * Converte a posição normalizada do jogador (`laneX` ∈ [-1, +1])
 * para coordenada 3D real no eixo X cobrindo as 3 Rotas (`[-10.6, +10.6]`)
 * através de uma bijeção linear C^∞ 100% contínua e livre (ZERO pulinhos/degraus!).
 */
export function laneNormToWorldX(laneNormX: number): number {
  const clamped = Math.max(
    -1,
    Math.min(1, Number.isFinite(laneNormX) ? laneNormX : 0),
  )
  return clamped * 10.6
}

/**
 * Identifica em qual das 3 Rotas (LEFT, CENTER, RIGHT) uma coordenada X 3D está.
 */
export function resolveRouteFromWorldX(worldX: number): BridgeRouteId {
  if (worldX < BRIDGE_3D_DIMENSIONS.parapetLeftDividerX) return 'LEFT'
  if (worldX > BRIDGE_3D_DIMENSIONS.parapetRightDividerX) return 'RIGHT'
  return 'CENTER'
}

export interface BossArchetype3DSpec {
  readonly index: 0 | 1 | 2 | 3 | 4
  readonly id:
    | 'colosso_rubro'
    | 'tita_crio_gelido'
    | 'senhor_magma'
    | 'aracno_mecha'
    | 'imperador_quiliarca'
  readonly namePt: string
  readonly titlePt: string
  readonly primaryColor: string
  readonly secondaryColor: string
  readonly accentColor: string
  readonly plaqueBgColor: string
  readonly weaponType:
    | 'WARHAMMER'
    | 'ICE_TRIDENT'
    | 'MAGMA_DUAL_CLUB'
    | 'SPIDER_CANNONS'
    | 'SOLAR_LONGSWORD'
}

/**
 * V8 Fase 3: Os 5 Arquétipos 3D Distintos de Mega-Boss que ciclam a cada Setor.
 */
export const BOSS_ARCHETYPES_3D: readonly BossArchetype3DSpec[] = [
  {
    index: 0,
    id: 'colosso_rubro',
    namePt: 'Brutus, Colosso Rubro',
    titlePt: 'Titã da Muralha',
    primaryColor: '#7f1d1d',
    secondaryColor: '#ca8a04',
    accentColor: '#fef08a',
    plaqueBgColor: '#991b1b',
    weaponType: 'WARHAMMER',
  },
  {
    index: 1,
    id: 'tita_crio_gelido',
    namePt: 'Vórtex, Titã Crio-Gélido',
    titlePt: 'Senhor da Geada',
    primaryColor: '#0e7490',
    secondaryColor: '#38bdf8',
    accentColor: '#e0f2fe',
    plaqueBgColor: '#155e75',
    weaponType: 'ICE_TRIDENT',
  },
  {
    index: 2,
    id: 'senhor_magma',
    namePt: 'Ignis, Senhor de Magma',
    titlePt: 'Forja Abissal',
    primaryColor: '#1c1917',
    secondaryColor: '#ea580c',
    accentColor: '#fde047',
    plaqueBgColor: '#9a3412',
    weaponType: 'MAGMA_DUAL_CLUB',
  },
  {
    index: 3,
    id: 'aracno_mecha',
    namePt: 'Aracno-Mecha Imperial',
    titlePt: 'Autômato Blindado',
    primaryColor: '#0f172a',
    secondaryColor: '#10b981',
    accentColor: '#6ee7b7',
    plaqueBgColor: '#065f46',
    weaponType: 'SPIDER_CANNONS',
  },
  {
    index: 4,
    id: 'imperador_quiliarca',
    namePt: 'Imperador Quiliarca Dourado',
    titlePt: 'Soberano Solar',
    primaryColor: '#713f12',
    secondaryColor: '#eab308',
    accentColor: '#c084fc',
    plaqueBgColor: '#6b21a8',
    weaponType: 'SOLAR_LONGSWORD',
  },
] as const

/**
 * V8 Fase 3: Curva pura de HP do Boss 100% determinada pelo Setor (`sectorIndex`)
 * e 0% dependente de `currentArmy` (Fim do Rubber-Banding!).
 * Fazer contas na Rota Direita agora torna o jogador genuinamente mais forte que o Boss!
 */
export function computeSectorBossHp(sectorIndex: number): number {
  const s = Math.max(
    1,
    Math.floor(Number.isFinite(sectorIndex) ? sectorIndex : 1),
  )
  if (s === 1) return 150
  return Math.round(
    150 * Math.pow(s, 1.45) * Math.pow(1.22, Math.min(s - 1, 25)),
  )
}

export interface SectorBossDeterministicSpec {
  readonly sectorIndex: number
  readonly bossHp: number
  readonly hordeHp: number
  readonly totalForce: number
  readonly archetype: BossArchetype3DSpec
  readonly marchSpeedZ: number
  readonly meleeDamagePerStrike: number
  readonly sectorClearRewardSoldiers: number
  readonly sectorClearRewardCoins: number
}

export function computeSectorBossSpec(
  sectorIndex: number,
): SectorBossDeterministicSpec {
  const s = Math.max(
    1,
    Math.floor(Number.isFinite(sectorIndex) ? sectorIndex : 1),
  )
  const bossHp = computeSectorBossHp(s)
  const hordeHp = s === 1 ? 30 : Math.max(25, Math.round(bossHp * 0.25))
  const archetype =
    BOSS_ARCHETYPES_3D[(s - 1) % BOSS_ARCHETYPES_3D.length] ??
    BOSS_ARCHETYPES_3D[0]
  const marchSpeedZ = Number(Math.min(4.2, 2.75 + (s - 1) * 0.16).toFixed(2))
  const meleeDamagePerStrike = Math.max(4, Math.round(bossHp * 0.15))
  const sectorClearRewardSoldiers = Math.max(
    24,
    Math.round(bossHp * 0.32 + s * 15),
  )
  const sectorClearRewardCoins = 25 + s * 20
  return {
    sectorIndex: s,
    bossHp,
    hordeHp,
    totalForce: bossHp + hordeHp,
    archetype,
    marchSpeedZ,
    meleeDamagePerStrike,
    sectorClearRewardSoldiers,
    sectorClearRewardCoins,
  }
}
