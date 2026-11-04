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

  // Sem fazer contas matemáticas (exército passivo <= 220, 1/15 da força inimiga),
  // o dano de tiro é propositalmente baixo (1 a 6) para que seja impossível vencer
  // a Horda 10×+ e o Mega-Boss sem resolver as contas (🧮) e pegar o Turbo da Direita (➡️).
  const damagePerShot = Math.max(
    1,
    netGain >= 1e12
      ? netGain * 0.16
      : safePts < 35
        ? Math.max(1, Math.round(1 + netGain * 0.03))
        : safePts <= 220
          ? Math.max(2, Math.round(2 + (safePts - 35) * 0.022))
          : Math.round(8 + netGain * 0.16 + Math.pow(logPower, 1.95) * 5),
  )

  const shotsPerSecond =
    safePts <= 220
      ? Number((2.4 + logPower * 0.65).toFixed(2))
      : Math.min(
          16,
          Number((3.8 + logPower * 2.35 + Math.min(3.0, netGain * 0.02)).toFixed(2)),
        )

  const parallelBarrels =
    safePts >= 1000
      ? 6
      : safePts >= 450
        ? 5
        : safePts >= 240
          ? 4
          : safePts >= 110
            ? 2
            : 1

  const projectileSpeed = Math.min(72, 38 + logPower * 7.5)
  const projectileScale = Math.min(1.85, 0.72 + logPower * 0.24)

  const projectileColor =
    safePts >= 1000
      ? '#facc15' // Ouro Quiliarca (1k+)
      : safePts >= 240
        ? '#f97316' // Plasma Centurião (Pós-Conta)
        : safePts >= 60
          ? '#38bdf8' // Laser Ciano (Esquadrão)
          : '#bae6fd' // Disparo Base

  const tierLabel =
    safePts >= 1000
      ? 'Canhão Titã 1k'
      : safePts >= 240
        ? 'Bateria Centurião Turbo'
        : safePts >= 35
          ? 'Rifle de Pelotão'
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
 * Políticas de ativação temporizada e Buffs Dinâmicos da Rota Direita (V9/V12):
 * Os buffs e armas da Rota Direita ficam congelados/cinzas por padrão e só
 * ativam por alguns segundos após o jogador resolver uma conta matemática (🧮).
 * Além de liberar a Rota Direita, resolver a conta dispara um Golpe Matemático
 * proporcional à dificuldade escolhida (no Grau 4 "Muito Difícil" derrota TODOS os inimigos de uma vez!).
 */
export const RIGHT_CORRIDOR_TIMED_POLICIES = {
  durationMsByTier: {
    1: 12000, // Fácil: 12s de Rota Direita ativa
    2: 15000, // Médio: 15s de Rota Direita ativa
    3: 18000, // Difícil: 18s de Rota Direita ativa
    4: 24000, // Muito Difícil: 24s de Rota Direita ativa
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
  readonly enemyWipeRatio: number
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
    armyBonusRatio: 0.65,
    minFlatSoldiers: 260,
    weaponDmgMult: 2.8,
    fireRateMult: 1.3,
    extraParallelBarrels: 1,
    piercingShots: false,
    enemyWipeRatio: 0.35,
    bossRoyalVolleyRatio: 0.2,
    gate0SubLabelPt: '🟢 CONTA · ABATE 35%',
    gate1SubLabelPt: '🟢 +65% EXÉRCITO',
    gate1RatioLabelPt: '+65%',
    activeHudSummaryPt: '🟢 Abate 35% Inimigos + 65% Soldados',
    plaqueBorderColor: '#4ade80',
    plaqueAccentColor: '#bbf7d0',
  },
  2: {
    tier: 2,
    icon: '🔵',
    badgePt: '🔵 Médio',
    durationMs: 15000,
    armyBonusRatio: 1.25,
    minFlatSoldiers: 580,
    weaponDmgMult: 4.2,
    fireRateMult: 1.45,
    extraParallelBarrels: 2,
    piercingShots: false,
    enemyWipeRatio: 0.6,
    bossRoyalVolleyRatio: 0.4,
    gate0SubLabelPt: '🔵 CONTA · ABATE 60%',
    gate1SubLabelPt: '🔵 +125% · TIRO DUPLO',
    gate1RatioLabelPt: '+125%',
    activeHudSummaryPt: '🔵 Abate 60% Inimigos + Tiro Duplo',
    plaqueBorderColor: '#38bdf8',
    plaqueAccentColor: '#bae6fd',
  },
  3: {
    tier: 3,
    icon: '🟣',
    badgePt: '🟣 Difícil',
    durationMs: 18000,
    armyBonusRatio: 2.1,
    minFlatSoldiers: 1250,
    weaponDmgMult: 6.5,
    fireRateMult: 1.65,
    extraParallelBarrels: 3,
    piercingShots: true,
    enemyWipeRatio: 0.85,
    bossRoyalVolleyRatio: 0.7,
    gate0SubLabelPt: '🟣 CONTA · ABATE 85%',
    gate1SubLabelPt: '🟣 +210% · PERFURANTE',
    gate1RatioLabelPt: '+210%',
    activeHudSummaryPt: '🟣 Abate 85% Inimigos + Canhão Perfurante',
    plaqueBorderColor: '#c084fc',
    plaqueAccentColor: '#e9d5ff',
  },
  4: {
    tier: 4,
    icon: '👑',
    badgePt: '👑 Muito Difícil',
    durationMs: 24000,
    armyBonusRatio: 3.5,
    minFlatSoldiers: 2800,
    weaponDmgMult: 9.5,
    fireRateMult: 1.9,
    extraParallelBarrels: 4,
    piercingShots: true,
    enemyWipeRatio: 1.0,
    bossRoyalVolleyRatio: 1.0,
    gate0SubLabelPt: '👑 WIPE 100% · TODOS ABATIDOS',
    gate1SubLabelPt: '👑 ×4,5 SUPER · SALVA TOTAL',
    gate1RatioLabelPt: '×4,5 WIPE',
    activeHudSummaryPt: '👑 DERROTA TODOS DE UMA VEZ + ×4,5 Exército',
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
 * Proporção 10× dos Inimigos vs. Buffs Passivos do Caminho Central e da Esquerda:
 * Os inimigos (Boss + Horda + Mini-Bosses) são 15× mais fortes do que o orçamento
 * passivo da Rota Central e da Rota Esquerda, tornando impossível vencer sem resolver
 * os desafios de lógica (🧮) e coletar os Super-Buffs da Rota Direita!
 */
export const ENEMY_VS_PASSIVE_ROUTE_RATIO = 15

/**
 * V8 Fase 3 + V12: Curva pura de HP do Boss 100% determinada pelo Setor (`sectorIndex`),
 * 15× mais forte que a capacidade passiva da Rota Central/Esquerda e 0% dependente de `currentArmy`.
 * Fazer contas na Rota Direita é indispensável para superar a força inimiga!
 */
export function computeSectorBossHp(sectorIndex: number): number {
  const s = Math.max(
    1,
    Math.floor(Number.isFinite(sectorIndex) ? sectorIndex : 1),
  )
  const basePassiveBossHp = 150
  const scaledBaseBossHp = basePassiveBossHp * ENEMY_VS_PASSIVE_ROUTE_RATIO // 2250 HP no Setor 1
  if (s === 1) return scaledBaseBossHp
  return Math.round(
    scaledBaseBossHp * Math.pow(s, 1.55) * Math.pow(1.26, Math.min(s - 1, 25)),
  )
}

export interface SectorBossDeterministicSpec {
  readonly sectorIndex: number
  readonly bossHp: number
  readonly hordeHp: number
  readonly totalForce: number
  readonly passiveRouteBaselineForce: number
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
  const hordeHp = s === 1 ? 450 : Math.max(400, Math.round(bossHp * 0.28))
  const totalForce = bossHp + hordeHp
  const passiveRouteBaselineForce = Math.max(
    150,
    Math.round(totalForce / ENEMY_VS_PASSIVE_ROUTE_RATIO),
  )
  const archetype =
    BOSS_ARCHETYPES_3D[(s - 1) % BOSS_ARCHETYPES_3D.length] ??
    BOSS_ARCHETYPES_3D[0]
  const marchSpeedZ = Number(Math.min(4.4, 2.85 + (s - 1) * 0.18).toFixed(2))
  const meleeDamagePerStrike = Math.max(48, Math.round(bossHp * 0.095))
  const sectorClearRewardSoldiers = Math.max(
    60,
    Math.round(passiveRouteBaselineForce * 0.55 + s * 25),
  )
  const sectorClearRewardCoins = 45 + s * 30
  return {
    sectorIndex: s,
    bossHp,
    hordeHp,
    totalForce,
    passiveRouteBaselineForce,
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
 * V9 Pilar 2 + V12: Escala da Rota Esquerda mantida em 1/15 da força inimiga
 * (`spec.bossHp / ENEMY_VS_PASSIVE_ROUTE_RATIO`), garantindo que os inimigos sejam
 * 15× mais fortes do que os buffs passivos da esquerda e do centro!
 */
export function computeLeftCorridorMonsterScaling(
  sectorIndex: number,
): LeftCorridorMonsterScaleSpec {
  const spec = computeSectorBossSpec(sectorIndex)
  const passiveBossBaseline = Math.max(
    150,
    Math.round(spec.bossHp / ENEMY_VS_PASSIVE_ROUTE_RATIO),
  )
  const gate0Soldiers = Math.max(2, Math.round(passiveBossBaseline * 0.02))
  const gate1Soldiers = Math.max(
    gate0Soldiers + 2,
    Math.round(passiveBossBaseline * 0.045),
  )
  const cannonHp = Math.max(5, Math.round(passiveBossBaseline * 0.035))
  const cannonUnlockBonus = Math.max(3, Math.round(passiveBossBaseline * 0.03))
  const cannonCollectBonus = Math.max(5, Math.round(passiveBossBaseline * 0.05))
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
 * V9 Pilar 1 + V12: Escala Exponencial Exclusiva da Rota Direita vinculada ao Grau (1..4)
 * e à resposta da questão resolvida (`solvedQuestionValue`).
 * Concede os Super-Buffs capazes de superar a vantagem de 15× dos inimigos!
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
  const expBase = 1.48 + params.activeTier * 0.16
  const exponentialFactor = Math.pow(expBase, Math.min(k, 40))
  const qVal = Math.max(
    6,
    Math.min(100000, Math.abs(Math.round(params.solvedQuestionValue || 18))),
  )
  const monsterSpec = computeSectorBossSpec(params.sectorIndex)
  const safeArmy = Number.isFinite(params.currentArmy) ? params.currentArmy : 5
  const armyRef = Math.max(safeArmy, monsterSpec.bossHp * 0.55, 380)

  const raw0 = Math.round(
    qVal * 2.8 * exponentialFactor +
      armyRef * tierSpec.armyBonusRatio * 0.72 * Math.pow(1.28, Math.min(k, 25)),
  )
  const gate0Soldiers = Math.max(tierSpec.minFlatSoldiers, raw0)

  const raw1 = Math.round(
    armyRef * tierSpec.armyBonusRatio * Math.pow(1.42, Math.min(k, 25)) +
      qVal * 4.0 * exponentialFactor,
  )
  const gate1Soldiers = Math.max(
    gate0Soldiers + 65,
    Math.round(Math.max(raw1, gate0Soldiers * 1.75)),
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
  /** V12: Torres 100× mais caras de construir e evoluir (de 15 para 1500 moedas base, progressão 2.5×). */
  baseUpgradeCost: 1500,
  costGrowthFactor: 2.5,
  shieldInterceptCooldownBaseMs: 4800,
  /** V11: HP estrutural máximo de cada Torre Aliada da Ponte por nível (0..5). */
  towerMaxHpByLevel: [0, 120, 220, 340, 480, 650] as const,
  /** V12: Limite Z da Couraça de Vanguarda do Boss (-16m). Sem Super-Buff da Rota Direita, o Boss tem 80% redução de dano e piso de 45% HP. */
  bossVanguardShieldEndZ: -16.0,
  bossVanguardMinHpRatio: 0.45,
  bossVanguardDamageMultiplier: 0.2,
  /** V11: Zona de Cerco (-6.0m..+7.7m) onde o Boss começa a atacar e destruir as Torres Aliadas da Ponte. */
  bossSiegeStartZ: -6.0,
  /** V11: Dano base por golpe de cerco do Boss contra uma Torre Aliada ativa. */
  bossTowerStrikeDamageBase: 55,
  slots: [
    {
      slotIndex: 0,
      id: 'bridge_tower_0',
      namePt: 'Balista Oeste',
      x: -5.0,
      z: 8.6,
      rolePt: 'Disparo de Suporte + Escudo Anti-Debuff',
    },
    {
      slotIndex: 1,
      id: 'bridge_tower_1',
      namePt: 'Sentinela Centro-Oeste',
      x: -2.8,
      z: 9.4,
      rolePt: 'Suporte Defensivo Central',
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
      rolePt: 'Canhão Defensivo de Suporte',
    },
  ] as const satisfies readonly BridgeTowerSlotSpec[],
} as const

export function getBridgeTowerMaxHp(level: number): number {
  const safeLvl = Math.max(
    0,
    Math.min(
      PLAYER_BRIDGE_BASE_POLICY.maxTowerLevel,
      Math.floor(Number.isFinite(level) ? level : 0),
    ),
  )
  return PLAYER_BRIDGE_BASE_POLICY.towerMaxHpByLevel[safeLvl] ?? 0
}

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
    /** V12: Torres dão suporte leve e jamais substituem o turbo matemático da Rota Direita. */
    bonusProjectilesPerVolley: Math.min(2, Math.floor(totalLevel / 6)),
    bonusDamagePerHit: Math.max(0, Math.floor(totalLevel * 0.2)),
    shieldInterceptCooldownMs: Math.max(
      1400,
      PLAYER_BRIDGE_BASE_POLICY.shieldInterceptCooldownBaseMs - totalLevel * 220,
    ),
  }
}

