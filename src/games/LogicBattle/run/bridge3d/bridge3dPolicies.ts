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
 * Políticas de ativação temporizada e Buffs Dinâmicos da Rota Direita (V9):
 * Os buffs e armas da Rota Direita ficam congelados/cinzas por padrão e só
 * ativam por alguns segundos após o jogador resolver uma conta matemática (🧮).
 * Quando ativa, os 2 Super-Portões e a Arma da Rota Direita mudam dinamicamente
 * conforme o Grau (1..4), o valor da questão resolvida e o benefício descrito no modal,
 * sendo a ÚNICA rota com crescimento exponencial.
 */
export const RIGHT_CORRIDOR_TIMED_POLICIES = {
  durationMsByTier: {
    1: 12000, // Fácil: 12s de Rota Direita ativa
    2: 15000, // Médio: 15s de Rota Direita ativa
    3: 18000, // Difícil: 18s de Rota Direita ativa
    4: 24000, // Problema: 24s de Rota Direita ativa
  } as Record<1 | 2 | 3 | 4, number>,
} as const

export interface RightTierBuffPolicySpec {
  readonly tier: 1 | 2 | 3 | 4
  readonly icon: string
  readonly badgePt: string
  readonly durationMs: number
  readonly armyBonusRatio: number
  readonly minFlatSoldiers: number
  readonly weaponDmgMult: number
  readonly fireRateMult: number
  readonly extraParallelBarrels: number
  readonly piercingShots: boolean
  readonly bossRoyalVolleyRatio: number
  readonly gate0SubLabelPt: string
  readonly gate1SubLabelPt: string
  readonly gate1RatioLabelPt: string
  readonly activeHudSummaryPt: string
  readonly plaqueBorderColor: string
  readonly plaqueAccentColor: string
}

export const RIGHT_CORRIDOR_TIER_BUFF_POLICIES: Record<
  1 | 2 | 3 | 4,
  RightTierBuffPolicySpec
> = {
  1: {
    tier: 1,
    icon: '🟢',
    badgePt: '🟢 Fácil',
    durationMs: 12000,
    armyBonusRatio: 0.2,
    minFlatSoldiers: 8,
    weaponDmgMult: 1.35,
    fireRateMult: 1.15,
    extraParallelBarrels: 1,
    piercingShots: false,
    bossRoyalVolleyRatio: 0,
    gate0SubLabelPt: '🟢 CONTA · CADÊNCIA +15%',
    gate1SubLabelPt: '🟢 +20% EXÉRCITO',
    gate1RatioLabelPt: '+20%',
    activeHudSummaryPt: '🟢 +20% Soldados e +15% Cadência',
    plaqueBorderColor: '#4ade80',
    plaqueAccentColor: '#bbf7d0',
  },
  2: {
    tier: 2,
    icon: '🔵',
    badgePt: '🔵 Médio',
    durationMs: 15000,
    armyBonusRatio: 0.45,
    minFlatSoldiers: 18,
    weaponDmgMult: 1.65,
    fireRateMult: 1.2,
    extraParallelBarrels: 2,
    piercingShots: false,
    bossRoyalVolleyRatio: 0,
    gate0SubLabelPt: '🔵 CONTA · TIRO DUPLO',
    gate1SubLabelPt: '🔵 +45% · TIRO DUPLO',
    gate1RatioLabelPt: '+45%',
    activeHudSummaryPt: '🔵 +45% Soldados e Tiro Duplo',
    plaqueBorderColor: '#38bdf8',
    plaqueAccentColor: '#bae6fd',
  },
  3: {
    tier: 3,
    icon: '🟣',
    badgePt: '🟣 Difícil',
    durationMs: 18000,
    armyBonusRatio: 0.75,
    minFlatSoldiers: 32,
    weaponDmgMult: 2.1,
    fireRateMult: 1.25,
    extraParallelBarrels: 2,
    piercingShots: true,
    bossRoyalVolleyRatio: 0,
    gate0SubLabelPt: '🟣 CONTA · PERFURANTE',
    gate1SubLabelPt: '🟣 +75% · PERFURANTE',
    gate1RatioLabelPt: '+75%',
    activeHudSummaryPt: '🟣 +75% Soldados e Canhão Perfurante',
    plaqueBorderColor: '#c084fc',
    plaqueAccentColor: '#e9d5ff',
  },
  4: {
    tier: 4,
    icon: '👑',
    badgePt: '👑 Problema',
    durationMs: 24000,
    armyBonusRatio: 1.0,
    minFlatSoldiers: 55,
    weaponDmgMult: 2.6,
    fireRateMult: 1.35,
    extraParallelBarrels: 3,
    piercingShots: true,
    bossRoyalVolleyRatio: 0.25,
    gate0SubLabelPt: '👑 PROBLEMA · SALVA REAL',
    gate1SubLabelPt: '👑 DOBRA ×2 · SALVA REAL',
    gate1RatioLabelPt: '×2 DOBRA',
    activeHudSummaryPt: '👑 DOBRA EXÉRCITO (×2) e Salva Real',
    plaqueBorderColor: '#facc15',
    plaqueAccentColor: '#fef08a',
  },
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

export interface LeftCorridorMonsterScaleSpec {
  readonly sectorIndex: number
  readonly gate0Soldiers: number
  readonly gate1Soldiers: number
  readonly cannonHp: number
  readonly cannonUnlockBonus: number
  readonly cannonCollectBonus: number
}

/**
 * V9 Pilar 2: Escala da Rota Esquerda 100% ancorada no Nível dos Monstros do Setor (`computeSectorBossSpec(S)`).
 * Zero dependência de `currentArmy` ou `mathChallengesSolved`!
 */
export function computeLeftCorridorMonsterScaling(
  sectorIndex: number,
): LeftCorridorMonsterScaleSpec {
  const spec = computeSectorBossSpec(sectorIndex)
  const gate0Soldiers = Math.max(2, Math.round(spec.bossHp * 0.02))
  const gate1Soldiers = Math.max(
    gate0Soldiers + 2,
    Math.round(spec.bossHp * 0.045),
  )
  const cannonHp = Math.max(5, Math.round(spec.bossHp * 0.035))
  const cannonUnlockBonus = Math.max(3, Math.round(spec.bossHp * 0.03))
  const cannonCollectBonus = Math.max(5, Math.round(spec.bossHp * 0.05))
  return {
    sectorIndex: spec.sectorIndex,
    gate0Soldiers,
    gate1Soldiers,
    cannonHp,
    cannonUnlockBonus,
    cannonCollectBonus,
  }
}

/**
 * V9 Pilar 1: Escala Exponencial Exclusiva da Rota Direita vinculada ao Grau (1..4)
 * e à resposta da questão resolvida (`solvedQuestionValue`).
 */
export function computeRightCorridorExponentialGates(params: {
  sectorIndex: number
  currentArmy: number
  mathChallengesSolved: number
  activeTier: 1 | 2 | 3 | 4
  solvedQuestionValue: number
}): {
  gate0Soldiers: number
  gate1Soldiers: number
  gate0SubLabel: string
  gate1SubLabel: string
  exponentialFactor: number
} {
  const tierSpec =
    RIGHT_CORRIDOR_TIER_BUFF_POLICIES[params.activeTier] ??
    RIGHT_CORRIDOR_TIER_BUFF_POLICIES[2]
  const k = Math.max(0, Math.floor(params.mathChallengesSolved))
  const expBase = 1.38 + params.activeTier * 0.12
  const exponentialFactor = Math.pow(expBase, Math.min(k, 40))
  const qVal = Math.max(
    4,
    Math.min(100000, Math.abs(Math.round(params.solvedQuestionValue || 15))),
  )
  const monsterSpec = computeSectorBossSpec(params.sectorIndex)
  const safeArmy = Number.isFinite(params.currentArmy) ? params.currentArmy : 5
  const armyRef = Math.max(safeArmy, monsterSpec.bossHp * 0.5, 20)

  const raw0 = Math.round(
    qVal * exponentialFactor +
      armyRef * tierSpec.armyBonusRatio * 0.65 * Math.pow(1.22, Math.min(k, 25)),
  )
  const gate0Soldiers = Math.max(tierSpec.minFlatSoldiers, raw0)

  const raw1 = Math.round(
    armyRef * tierSpec.armyBonusRatio * Math.pow(1.35, Math.min(k, 25)) +
      qVal * 1.8 * exponentialFactor,
  )
  const gate1Soldiers = Math.max(
    gate0Soldiers + 8,
    Math.round(Math.max(raw1, gate0Soldiers * 1.65)),
  )

  return {
    gate0Soldiers,
    gate1Soldiers,
    gate0SubLabel: tierSpec.gate0SubLabelPt,
    gate1SubLabel: tierSpec.gate1SubLabelPt,
    exponentialFactor,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// V10 Fase 1: Cadência de ~8s–10s na Rota Central + Bases Vivas (Inimiga & Aliada)
// ──────────────────────────────────────────────────────────────────────────────

export const CENTER_ROUTE_CADENCE_POLICY = {
  /** Quantidade máxima de segmentos centrais visíveis simultaneamente na ponte 3D. */
  maxSimultaneousVisibleSegments: 1,
  /** Intervalo-alvo entre decisões de portões na Rota Central (em segundos). */
  targetGateIntervalSec: 9.0,
  /** Distância espacial 3D do ciclo de progressão para que o par único cruze toda a ponte. */
  worldSpanZ: 280.0,
} as const

export const ENEMY_LIVING_BASE_POLICY = {
  /** Tempo entre evoluções autônomas da Base Inimiga durante a partida (ms). */
  evolutionIntervalMs: 16000,
  /** Nível máximo de evolução da Base Inimiga dentro de um setor. */
  maxEnemyBaseLevel: 5,
  /** Posições das 4 Torres de Debuff 3D que a Base Inimiga constrói nos parapeitos da ponte. */
  debuffTowerSlots: [
    { id: 0, x: -4.2, z: -56.0, unlockAtEnemyLevel: 1, label: '−10% TORRE' },
    { id: 1, x: 4.2, z: -44.0, unlockAtEnemyLevel: 2, label: '−12% FEIXE' },
    { id: 2, x: -4.2, z: -32.0, unlockAtEnemyLevel: 3, label: '−15% MALDIÇÃO' },
    { id: 3, x: 4.2, z: -20.0, unlockAtEnemyLevel: 4, label: '−18% ABISMO' },
  ],
  /** Intervalo base de disparo de pulso matemático negativo por torre inimiga (ms). */
  debuffPulseCooldownMs: 5200,
  /** Velocidade do projétil de debuff rumo ao esquadrão (+Z m/s). */
  debuffBoltSpeedZ: 18.0,
  /** Redução real de soldados aplicada quando um pulso de Torre de Debuff atinge o esquadrão. */
  debuffLossRatioByLevel: [0.1, 0.12, 0.15, 0.18, 0.22] as const,
} as const

export interface BridgeTowerSlotSpec {
  readonly slotIndex: 0 | 1 | 2 | 3
  readonly id: string
  readonly namePt: string
  readonly x: number
  readonly z: number
  readonly rolePt: string
}

export const PLAYER_BRIDGE_BASE_POLICY = {
  maxTowerLevel: 5,
  baseUpgradeCost: 15,
  costGrowthFactor: 1.75,
  shieldInterceptCooldownBaseMs: 3600,
  slots: [
    {
      slotIndex: 0,
      id: 'bridge_tower_0',
      namePt: 'Balista Oeste',
      x: -5.0,
      z: 8.6,
      rolePt: 'Disparo Automático + Escudo Anti-Debuff',
    },
    {
      slotIndex: 1,
      id: 'bridge_tower_1',
      namePt: 'Sentinela Centro-Oeste',
      x: -2.8,
      z: 9.4,
      rolePt: 'Fogo Rápido na Horda Central',
    },
    {
      slotIndex: 2,
      id: 'bridge_tower_2',
      namePt: 'Sentinela Centro-Leste',
      x: 2.8,
      z: 9.4,
      rolePt: 'Interceptador de Feixes Inimigos',
    },
    {
      slotIndex: 3,
      id: 'bridge_tower_3',
      namePt: 'Balista Leste',
      x: 5.0,
      z: 8.6,
      rolePt: 'Canhão Defensivo de Longo Alcance',
    },
  ] as const satisfies readonly BridgeTowerSlotSpec[],
} as const

export function getBridgeTowerUpgradeCost(currentLevel: number): number {
  const safeLvl = Math.max(0, Math.floor(currentLevel))
  return Math.round(
    PLAYER_BRIDGE_BASE_POLICY.baseUpgradeCost *
      Math.pow(PLAYER_BRIDGE_BASE_POLICY.costGrowthFactor, safeLvl),
  )
}

export function computeAlliedBridgeTowerStats(
  levels: readonly [number, number, number, number],
): {
  totalLevel: number
  activeTowersCount: number
  bonusProjectilesPerVolley: number
  bonusDamagePerHit: number
  shieldInterceptCooldownMs: number
} {
  const safeLevels = levels ?? [1, 0, 0, 0]
  const totalLevel =
    (safeLevels[0] ?? 0) +
    (safeLevels[1] ?? 0) +
    (safeLevels[2] ?? 0) +
    (safeLevels[3] ?? 0)
  const activeTowersCount = safeLevels.filter((lvl) => lvl > 0).length
  return {
    totalLevel,
    activeTowersCount,
    bonusProjectilesPerVolley: Math.min(8, activeTowersCount + Math.floor(totalLevel / 2)),
    bonusDamagePerHit: Math.max(1, Math.ceil(totalLevel * 1.6)),
    shieldInterceptCooldownMs: Math.max(
      900,
      PLAYER_BRIDGE_BASE_POLICY.shieldInterceptCooldownBaseMs - totalLevel * 280,
    ),
  }
}

