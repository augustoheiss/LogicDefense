// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/bridge3dSim.ts
// Motor de Simulação 3D Determinístico 60Hz (Master Plan V7 — Fase 2):
// - 3 Rotas Paralelas Interativas (LEFT, CENTER, RIGHT)
// - Tiros 100% Retos para Frente (-Z) com poder escalado pelos pontos
// - Blocos Congelados Destrutíveis (5 HP na Esquerda, 888 HP na Direita)
// - Barris Explosivos 3D (112 HP) com dano em área (AoE) na Horda
// - Monstros Reais, Mini-Bosses (176 HP) e Mega-Boss com dano de contato real
// - Progressão de Setores Infinitos (Setor 1, 2, 3... ∞)
// ──────────────────────────────────────────────────────────────────────────────
import {
  BRIDGE_3D_DIMENSIONS,
  BRIDGE_3D_ROUTES,
  BridgeRouteId,
  CENTER_ROUTE_CADENCE_POLICY,
  computeAlliedBridgeTowerStats,
  computeLeftCorridorMonsterScaling,
  computeRightCorridorExponentialGates,
  computeSectorBossSpec,
  computeShotProfile,
  DynamicShotProfile,
  ENEMY_LIVING_BASE_POLICY,
  getBridgeTowerMaxHp,
  laneNormToWorldX,
  PLAYER_BRIDGE_BASE_POLICY,
  resolveRouteFromWorldX,
  RIGHT_CORRIDOR_TIER_BUFF_POLICIES,
  RIGHT_CORRIDOR_TIMED_POLICIES,
} from './bridge3dPolicies'
import { formatArmy } from '../../domain/notation'

export type BossLifecycleState = 'MARCHING' | 'MELEE_CLASH' | 'INTERMISSION'

export interface AlliedTowerBolt3DEntity {
  id: number
  x: number
  y: number
  z: number
  vx: number
  vz: number
  damage: number
  slotIndex: number
  active: boolean
}

export interface EnemyDebuffTower3DEntity {
  id: number
  x: number
  z: number
  level: number
  active: boolean
  pulseCooldownMs: number
  label: string
  hitFlashMs: number
}

export interface EnemyDebuffBolt3DEntity {
  id: number
  x: number
  y: number
  z: number
  vx: number
  vz: number
  lossRatio: number
  label: string
  active: boolean
}


export interface SupplyCaravan3DState {
  active: boolean
  x: number
  z: number
  hp: number
  maxHp: number
  hitFlashMs: number
  rewardsGrantedCount: number
}

export interface Bolt3DEntity {
  id: number
  x: number
  y: number
  z: number
  vz: number
  damage: number
  scale: number
  active: boolean
  pierceRemaining?: number
}

export interface Enemy3DEntity {
  id: number
  x: number
  z: number
  hp: number
  maxHp: number
  isMiniBoss: boolean
  speedZ: number
  contactDamage: number
  hitFlashMs: number
}

export interface ExplosiveBarrel3DEntity {
  id: number
  x: number
  z: number
  hp: number
  maxHp: number
  active: boolean
  explosionFlashMs: number
}

export interface SideRouteGate3DEntity {
  id: string
  route: 'LEFT' | 'RIGHT'
  z: number
  bonusSoldiers: number
  label: string
  subLabel?: string
  collectedInPass: boolean
}

export interface FrozenBlock3DState {
  hp: number
  maxHp: number
  z: number
  unlocked: boolean
  hitFlashMs: number
  collectedInPass?: boolean
  level?: number
}

export interface Bridge3DSimCallbacks {
  onEnemyKilled: (coinsDelta: number, damageDealt: number, attritionLoss: number) => void
  onSideRouteReward: (
    route: 'LEFT' | 'RIGHT',
    soldiersDelta: number,
    reasonLabel: string,
  ) => void
  onSectorBossDefeated: (newSector: number, bonusSoldiers: number) => void
  onRequireMathChallenge?: (pendingBonusSoldiers: number, gateLabel: string) => void
  onEnemyBaseEvolved?: (newLevel: number, activeTowers: number) => void
  onEnemyDebuffTowerHit?: (lossRatio: number, label: string) => void
  onDebuffBoltIntercepted?: (label: string) => void
  onAlliedTowerDamaged?: (
    slotIndex: 0 | 1 | 2 | 3,
    remainingHp: number,
    maxHp: number,
    damage: number,
  ) => void
  onAlliedTowerDestroyed?: (
    slotIndex: 0 | 1 | 2 | 3,
    newLevel: number,
    towerNamePt: string,
  ) => void
  onBossStrikeHero?: (damage: number, bossNamePt: string) => void
}

export interface Bridge3DSimState {
  rngState: number
  sectorIndex: number
  heroWorldX: number
  activeRoute: BridgeRouteId
  shotProfile: DynamicShotProfile
  fireCooldownSec: number
  boltSeq: number
  activeBoltsCount: number
  playerHitFlashMs: number
  leftCannonLevel: number
  rightWeaponLevel: number
  rightAltarZ: number
  rightAltarCollectedInPass: boolean
  rightMathBonusCharges: number
  /** V8 Fase 2: Cronômetro ativo em ms para os buffs e cores da Rota Direita após resolver conta (0 = cinza/congelado) */
  rightBuffActiveTimerMs: number
  rightBuffMaxTimerMs: number
  /** V9 Pilar 1: Grau ativo (1..4), valor da questão resolvida e benefícios da janela na Rota Direita */
  rightActiveTier: 1 | 2 | 3 | 4
  rightActiveQuestionValue: number
  rightActiveExpressionBadge: string
  rightActiveBuffLabel: string
  rightPiercingShots: boolean
  mathChallengesSolved: number
  pendingRightGateBonus: number
  timeInRightRouteSec: number
  rightRoutePromptCooldownMs: number
  leftFrozenBlock: FrozenBlock3DState
  rightFrozenWeapon: FrozenBlock3DState
  leftGates: SideRouteGate3DEntity[]
  rightGates: SideRouteGate3DEntity[]
  barrels: ExplosiveBarrel3DEntity[]
  enemies: Enemy3DEntity[]
  bossHp: number
  bossMaxHp: number
  bossZ: number
  bossHitFlashMs: number
  bossLifecycle: BossLifecycleState
  bossRespawnTimerMs: number
  bossMeleeCooldownMs: number
  bossArchetypeIndex: 0 | 1 | 2 | 3 | 4
  bossArchetypeId: string
  bossArchetypeName: string
  supplyCaravan: SupplyCaravan3DState
  bolts: Bolt3DEntity[]
  /** V10 Fase 1: Base Viva Inimiga + Torres de Debuff 3D + Base Aliada da Ponte */
  enemyBaseLevel: number
  enemyEvolutionTimerMs: number
  enemyDebuffTowers: EnemyDebuffTower3DEntity[]
  enemyDebuffBolts: EnemyDebuffBolt3DEntity[]
  enemyDebuffHitsCount: number
  debuffBoltsDodgedCount: number
  debuffBoltsInterceptedCount: number
  playerBridgeTowerLevels: [number, number, number, number]
  playerTowerShieldCooldownMs: number
  alliedTowerBolts: AlliedTowerBolt3DEntity[]
  towerFireCooldownsMs: [number, number, number, number]
  towerShotsFiredCount: number
  towerKillsCount: number
  /** V11: Vida estrutural das 4 Torres Aliadas da Ponte, rotação de mira 3D, recuo e Cerco do Boss */
  lastSyncedTowerLevels: [number, number, number, number]
  playerBridgeTowerHp: [number, number, number, number]
  playerBridgeTowerMaxHp: [number, number, number, number]
  playerBridgeTowerHitFlashMs: [number, number, number, number]
  playerBridgeTowerRuinedTimerMs: [number, number, number, number]
  towerTargetYawRad: [number, number, number, number]
  towerRecoilAmount: [number, number, number, number]
  bossVanguardShieldActive: boolean
  bossTowerAttacksCount: number
  bossHeroStrikesCount: number
  playerBridgeTowerDestroyedCount: number
}

export const MAX_SIM_BOLTS = 72
export const INITIAL_ENEMY_COUNT = 16

/**
 * PRNG determinístico (Mulberry32) acoplado ao estado da simulação 3D.
 * Garante 100% de reprodutibilidade para qualquer seed sem depender de Math.random().
 */
export function nextSimRandom(sim: Bridge3DSimState): number {
  let t = (sim.rngState += 0x6d2b79f5)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  sim.rngState = t >>> 0
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * Calcula a posição Z 3D contínua de um segmento da Rota Central a partir de `seg.zPosition` e `progress`.
 * V10 Fase 1: utiliza `CENTER_ROUTE_CADENCE_POLICY.worldSpanZ` para que o par único visível
 * atravesse toda a ponte (do Castelo Norte até a linha exata do Herói em `zPlayerLine`) em ~8.5s–10s.
 */
export function computeSegmentWorldZ(segZPosition: number, progress: number): number {
  return (
    BRIDGE_3D_DIMENSIONS.zPlayerLine -
    (segZPosition - progress) * CENTER_ROUTE_CADENCE_POLICY.worldSpanZ
  )
}


export function createInitialBridge3DSimState(
  initialBossHp = 150,
  seed = 42,
): Bridge3DSimState {
  const baseBossHp = Math.max(150, initialBossHp)
  const initialRngState = (Math.floor(seed) ^ 0x9e3779b9) >>> 0 || 42
  const enemies: Enemy3DEntity[] = Array.from({ length: INITIAL_ENEMY_COUNT }, (_, idx) => {
    const isMiniBoss = idx === 2 || idx === 7 || idx === 11 || idx === 14
    const row = Math.floor(idx / 4)
    const col = (idx % 4) - 1.5
    const maxHp = isMiniBoss ? 176 : 14
    return {
      id: idx + 1,
      x: col * 1.6,
      z: isMiniBoss ? -22 - row * 12 : -32 - row * 10.5 - (idx % 3) * 1.8,
      hp: maxHp,
      maxHp,
      isMiniBoss,
      speedZ: isMiniBoss ? 2.55 : 2.65 + (idx % 3) * 0.25,
      contactDamage: isMiniBoss ? 3 : 1,
      hitFlashMs: 0,
    }
  })

  const barrels: ExplosiveBarrel3DEntity[] = [
    { id: 1, x: -3.2, z: -18, hp: 112, maxHp: 112, active: true, explosionFlashMs: 0 },
    { id: 2, x: 3.2, z: -34, hp: 112, maxHp: 112, active: true, explosionFlashMs: 0 },
    { id: 3, x: -3.2, z: -48, hp: 112, maxHp: 112, active: true, explosionFlashMs: 0 },
    { id: 4, x: 3.2, z: -62, hp: 112, maxHp: 112, active: true, explosionFlashMs: 0 },
  ]

  // V9 Pilar 2 & 3: Apenas 2 portões espaçados na Rota Esquerda, 100% ancorados no Nível dos Monstros do Setor
  const initLeftMonsterScale = computeLeftCorridorMonsterScaling(1)
  const leftGates: SideRouteGate3DEntity[] = [
    {
      id: 'lg_0',
      route: 'LEFT',
      z: -24,
      bonusSoldiers: initLeftMonsterScale.gate0Soldiers,
      label: `+${formatArmy(initLeftMonsterScale.gate0Soldiers, 'compact')}`,
      subLabel: 'MONSTROS S1',
      collectedInPass: false,
    },
    {
      id: 'lg_1',
      route: 'LEFT',
      z: -48,
      bonusSoldiers: initLeftMonsterScale.gate1Soldiers,
      label: `+${formatArmy(initLeftMonsterScale.gate1Soldiers, 'compact')}`,
      subLabel: 'REFORÇO S1',
      collectedInPass: false,
    },
  ]

  // V9 Pilar 1 & 3: Apenas 2 Super-Portões espaçados na Rota Direita (Exponencial + Vinculados à Questão)
  const initRightSpec = computeRightCorridorExponentialGates({
    sectorIndex: 1,
    currentArmy: 5,
    mathChallengesSolved: 0,
    activeTier: 2,
    solvedQuestionValue: 18,
  })
  const rightGates: SideRouteGate3DEntity[] = [
    {
      id: 'rg_0',
      route: 'RIGHT',
      z: -14,
      bonusSoldiers: initRightSpec.gate0Soldiers,
      label: `+${formatArmy(initRightSpec.gate0Soldiers, 'compact')}`,
      subLabel: initRightSpec.gate0SubLabel,
      collectedInPass: false,
    },
    {
      id: 'rg_1',
      route: 'RIGHT',
      z: -46,
      bonusSoldiers: initRightSpec.gate1Soldiers,
      label: `+${formatArmy(initRightSpec.gate1Soldiers, 'compact')}`,
      subLabel: initRightSpec.gate1SubLabel,
      collectedInPass: false,
    },
  ]

  const bolts: Bolt3DEntity[] = Array.from({ length: MAX_SIM_BOLTS }, (_, idx) => ({
    id: idx + 1,
    x: 0,
    y: 1.15,
    z: BRIDGE_3D_DIMENSIONS.zPlayerLine,
    vz: -42,
    damage: 1,
    scale: 0.8,
    active: false,
    pierceRemaining: 0,
  }))

  return {
    rngState: initialRngState,
    sectorIndex: 1,
    heroWorldX: laneNormToWorldX(-0.24),
    activeRoute: 'CENTER',
    shotProfile: computeShotProfile(5),
    fireCooldownSec: 0,
    boltSeq: 0,
    activeBoltsCount: 0,
    playerHitFlashMs: 0,
    leftCannonLevel: 0,
    rightWeaponLevel: 0,
    rightAltarZ: -26.0,
    rightAltarCollectedInPass: false,
    rightMathBonusCharges: 0,
    rightBuffActiveTimerMs: 0,
    rightBuffMaxTimerMs: 15000,
    rightActiveTier: 2,
    rightActiveQuestionValue: 18,
    rightActiveExpressionBadge: '',
    rightActiveBuffLabel: RIGHT_CORRIDOR_TIER_BUFF_POLICIES[2].activeHudSummaryPt,
    rightPiercingShots: false,
    mathChallengesSolved: 0,
    pendingRightGateBonus: 0,
    timeInRightRouteSec: 0,
    rightRoutePromptCooldownMs: 0,
    leftFrozenBlock: {
      hp: initLeftMonsterScale.cannonHp,
      maxHp: initLeftMonsterScale.cannonHp,
      z: -8.0,
      unlocked: false,
      hitFlashMs: 0,
      collectedInPass: false,
      level: 1,
    },
    rightFrozenWeapon: {
      hp: 888,
      maxHp: 888,
      z: -38.0,
      unlocked: false,
      hitFlashMs: 0,
      collectedInPass: false,
      level: 1,
    },
    leftGates,
    rightGates,
    barrels,
    enemies,
    bossHp: baseBossHp,
    bossMaxHp: baseBossHp,
    bossZ: -68,
    bossHitFlashMs: 0,
    bossLifecycle: 'MARCHING',
    bossRespawnTimerMs: 0,
    bossMeleeCooldownMs: 1000,
    bossArchetypeIndex: 0,
    bossArchetypeId: 'colosso_rubro',
    bossArchetypeName: 'Brutus, Colosso Rubro',
    supplyCaravan: {
      active: false,
      x: 0,
      z: -48,
      hp: 100,
      maxHp: 100,
      hitFlashMs: 0,
      rewardsGrantedCount: 0,
    },
    bolts,
    enemyBaseLevel: 1,
    enemyEvolutionTimerMs: ENEMY_LIVING_BASE_POLICY.evolutionIntervalMs,
    enemyDebuffTowers: ENEMY_LIVING_BASE_POLICY.debuffTowerSlots.map((slot, idx) => ({
      id: slot.id,
      x: slot.x,
      z: slot.z,
      level: 1,
      active: idx === 0,
      pulseCooldownMs: ENEMY_LIVING_BASE_POLICY.debuffPulseCooldownMs + idx * 1400,
      label: slot.label,
      hitFlashMs: 0,
    })),
    enemyDebuffBolts: Array.from({ length: 8 }, (_, idx) => ({
      id: idx + 1,
      x: 0,
      y: 1.45,
      z: -56,
      vx: 0,
      vz: ENEMY_LIVING_BASE_POLICY.debuffBoltSpeedZ,
      lossRatio: 0.1,
      label: '−10% TORRE',
      active: false,
    })),
    enemyDebuffHitsCount: 0,
    debuffBoltsDodgedCount: 0,
    debuffBoltsInterceptedCount: 0,
    playerBridgeTowerLevels: [1, 0, 0, 0],
    lastSyncedTowerLevels: [1, 0, 0, 0],
    playerBridgeTowerHp: [getBridgeTowerMaxHp(1), 0, 0, 0],
    playerBridgeTowerMaxHp: [getBridgeTowerMaxHp(1), 0, 0, 0],
    playerBridgeTowerHitFlashMs: [0, 0, 0, 0],
    playerBridgeTowerRuinedTimerMs: [0, 0, 0, 0],
    towerTargetYawRad: [0, 0, 0, 0],
    towerRecoilAmount: [0, 0, 0, 0],
    playerTowerShieldCooldownMs: 0,
    alliedTowerBolts: Array.from({ length: 16 }, (_, idx) => ({
      id: idx + 1,
      x: 0,
      y: 2.35,
      z: 9.0,
      vx: 0,
      vz: -38,
      damage: 8,
      slotIndex: idx % 4,
      active: false,
    })),
    towerFireCooldownsMs: [450, 650, 850, 1050],
    towerShotsFiredCount: 0,
    towerKillsCount: 0,
    bossVanguardShieldActive: true,
    bossTowerAttacksCount: 0,
    bossHeroStrikesCount: 0,
    playerBridgeTowerDestroyedCount: 0,
  }
}

/**
 * V10 Fase 1 (SIT-V10-LIVING-BASES-AND-SHARED-WALLET):
 * Evolui autonomamente o nível da Base Inimiga (1..5), ativa novas Torres de Debuff 3D
 * nos parapeitos da ponte, reforça os Mini-Bosses e dispara imediatamente um pulso de debuff.
 */
export function evolveEnemyLivingBase(sim: Bridge3DSimState): {
  enemyBaseLevel: number
  activeTowersCount: number
} {
  sim.enemyBaseLevel = Math.min(
    ENEMY_LIVING_BASE_POLICY.maxEnemyBaseLevel,
    sim.enemyBaseLevel + 1,
  )
  sim.enemyEvolutionTimerMs = ENEMY_LIVING_BASE_POLICY.evolutionIntervalMs

  let activeTowersCount = 0
  for (let i = 0; i < sim.enemyDebuffTowers.length; i++) {
    const tower = sim.enemyDebuffTowers[i]
    const slotSpec = ENEMY_LIVING_BASE_POLICY.debuffTowerSlots[i]
    if (sim.enemyBaseLevel >= slotSpec.unlockAtEnemyLevel) {
      tower.active = true
      tower.level = Math.max(1, sim.enemyBaseLevel - slotSpec.unlockAtEnemyLevel + 1)
      tower.hitFlashMs = 300
      activeTowersCount++
    }
  }

  // Dispara imediatamente um projétil de debuff visível ao evoluir a Base Inimiga
  const slotLoss =
    ENEMY_LIVING_BASE_POLICY.debuffLossRatioByLevel[
      Math.min(
        ENEMY_LIVING_BASE_POLICY.debuffLossRatioByLevel.length - 1,
        Math.max(0, sim.enemyBaseLevel - 1),
      )
    ] ?? 0.12
  const freeDebuffBolt = sim.enemyDebuffBolts.find((b) => !b.active) ?? sim.enemyDebuffBolts[0]
  if (freeDebuffBolt) {
    const srcTower =
      sim.enemyDebuffTowers.filter((t) => t.active).slice(-1)[0] ??
      sim.enemyDebuffTowers[0]
    const spawnX = srcTower ? srcTower.x : -4.2
    const spawnZ = srcTower ? srcTower.z : -44
    const targetXAtLaunch = Math.max(-4.8, Math.min(4.8, sim.heroWorldX))
    const travelSec = Math.max(
      0.5,
      (BRIDGE_3D_DIMENSIONS.zPlayerLine - spawnZ) /
        ENEMY_LIVING_BASE_POLICY.debuffBoltSpeedZ,
    )
    freeDebuffBolt.active = true
    freeDebuffBolt.x = spawnX
    freeDebuffBolt.y = 1.45
    freeDebuffBolt.z = spawnZ
    freeDebuffBolt.vx = (targetXAtLaunch - spawnX) / travelSec
    freeDebuffBolt.vz = ENEMY_LIVING_BASE_POLICY.debuffBoltSpeedZ
    freeDebuffBolt.lossRatio = slotLoss
    freeDebuffBolt.label = srcTower ? srcTower.label : `−${Math.round(slotLoss * 100)}% TORRE`
  }

  // Fortalece a onda da horda inimiga ao evoluir a Base Inimiga
  for (const en of sim.enemies) {
    en.maxHp = Math.round(en.maxHp * 1.12)
    en.hp = Math.min(en.maxHp, en.hp + 6)
    en.speedZ = Math.min(4.2, en.speedZ * 1.05)
  }

  return {
    enemyBaseLevel: sim.enemyBaseLevel,
    activeTowersCount,
  }
}


/**
 * V9 Pilar 1: Ativa por alguns segundos (12s a 24s conforme o grau da conta) as cores,
 * os 2 Super-Portões exponenciais e os benefícios de arma prometidos no modal:
 * - Grau I (🟢 12s): +20% Soldados e +15% Cadência na Ponte
 * - Grau II (🔵 15s): +45% Soldados e Tiro Duplo na Ponte
 * - Grau III (🟣 18s): +75% Soldados e Canhão Perfurante
 * - Grau IV (👑 24s): DOBRA O EXÉRCITO (×2 + 55) e Salva Real contra o Boss
 */
export function applyMathBonusToRightWeapon(
  sim: Bridge3DSimState,
  siegeDamage = 296,
  tier: 1 | 2 | 3 | 4 = 2,
  rewardMeta?: {
    correctValue?: number
    expressionBadge?: string
    currentArmy?: number
  },
): {
  unlockedWeapon: boolean
  bonusSoldiersFromPendingGate: number
  activeDurationMs: number
  royalVolleyBossDamage: number
} {
  sim.mathChallengesSolved += 1
  const tierSpec =
    RIGHT_CORRIDOR_TIER_BUFF_POLICIES[tier] ??
    RIGHT_CORRIDOR_TIER_BUFF_POLICIES[2]
  const durationMs =
    RIGHT_CORRIDOR_TIMED_POLICIES.durationMsByTier[tier] ?? tierSpec.durationMs
  sim.rightBuffActiveTimerMs = durationMs
  sim.rightBuffMaxTimerMs = durationMs
  sim.rightMathBonusCharges = Math.max(2, Math.ceil(durationMs / 4000))
  sim.rightActiveTier = tier
  sim.rightActiveQuestionValue =
    rewardMeta?.correctValue !== undefined
      ? rewardMeta.correctValue
      : tier * 15
  sim.rightActiveExpressionBadge = rewardMeta?.expressionBadge ?? ''
  sim.rightActiveBuffLabel = tierSpec.activeHudSummaryPt
  sim.rightPiercingShots = tierSpec.piercingShots

  // Salva Real contra o Boss (Grau IV): dispara rajada imediata que drena 25% do HP máximo do Boss!
  let royalVolleyBossDamage = 0
  if (
    tierSpec.bossRoyalVolleyRatio > 0 &&
    sim.bossLifecycle !== 'INTERMISSION' &&
    sim.bossHp > 1
  ) {
    royalVolleyBossDamage = Math.max(
      25,
      Math.round(sim.bossMaxHp * tierSpec.bossRoyalVolleyRatio),
    )
    const vanguardFloor =
      sim.bossZ < PLAYER_BRIDGE_BASE_POLICY.bossVanguardShieldEndZ
        ? Math.max(
            18,
            Math.round(sim.bossMaxHp * PLAYER_BRIDGE_BASE_POLICY.bossVanguardMinHpRatio),
          )
        : 1
    sim.bossHp = Math.max(vanguardFloor, sim.bossHp - royalVolleyBossDamage)
    sim.bossHitFlashMs = 420
  }

  // Atualizar imediatamente os 2 Super-Portões da Rota Direita conforme a questão resolvida e o Grau!
  const rightGateSpec = computeRightCorridorExponentialGates({
    sectorIndex: sim.sectorIndex,
    currentArmy: rewardMeta?.currentArmy ?? 25,
    mathChallengesSolved: sim.mathChallengesSolved,
    activeTier: tier,
    solvedQuestionValue: sim.rightActiveQuestionValue,
  })
  if (sim.rightGates[0]) {
    sim.rightGates[0].bonusSoldiers = rightGateSpec.gate0Soldiers
    sim.rightGates[0].label = `+${formatArmy(rightGateSpec.gate0Soldiers, 'compact')}`
    sim.rightGates[0].subLabel = rightGateSpec.gate0SubLabel
  }
  if (sim.rightGates[1]) {
    sim.rightGates[1].bonusSoldiers = rightGateSpec.gate1Soldiers
    sim.rightGates[1].label = `+${formatArmy(rightGateSpec.gate1Soldiers, 'compact')}`
    sim.rightGates[1].subLabel = rightGateSpec.gate1SubLabel
  }

  const pendingBonus = sim.pendingRightGateBonus
  sim.pendingRightGateBonus = 0

  let unlockedWeapon = false
  if (!sim.rightFrozenWeapon.unlocked) {
    sim.rightFrozenWeapon.hp = Math.max(0, sim.rightFrozenWeapon.hp - siegeDamage)
    sim.rightFrozenWeapon.hitFlashMs = 260
    sim.rightFrozenWeapon.unlocked = true
    sim.rightWeaponLevel += 1
    unlockedWeapon = true
  } else {
    sim.rightWeaponLevel += 1
    sim.rightFrozenWeapon.hitFlashMs = 260
    unlockedWeapon = true
  }

  // Garantir que portões/arma da direita ainda na ponte possam ser coletados na janela ativa
  if (sim.leftFrozenBlock.z <= -7.5) {
    sim.leftFrozenBlock.z = -5.5
  }
  if (sim.rightFrozenWeapon.z <= -37.5) {
    sim.rightFrozenWeapon.z = -24.0
  }
  if (sim.rightFrozenWeapon.z <= BRIDGE_3D_DIMENSIONS.zPlayerLine + 1.25) {
    sim.rightFrozenWeapon.collectedInPass = false
  }
  for (const g of sim.rightGates) {
    if (g.z <= BRIDGE_3D_DIMENSIONS.zPlayerLine + 1.25) {
      g.collectedInPass = false
    }
  }
  if (
    sim.rightGates.length > 0 &&
    sim.rightGates.every(
      (g) => g.z < -2.0 || g.z > BRIDGE_3D_DIMENSIONS.zPlayerLine,
    )
  ) {
    sim.rightGates[0].z = -2.5
    sim.rightGates[0].collectedInPass = false
  }

  return {
    unlockedWeapon,
    bonusSoldiersFromPendingGate: pendingBonus,
    activeDurationMs: durationMs,
    royalVolleyBossDamage,
  }
}

/**
 * Avança um passo determinístico de simulação 3D (60Hz) nas 3 rotas.
 */
export function stepBridge3DSim(
  sim: Bridge3DSimState,
  dtSec: number,
  input: {
    laneNormX: number
    currentArmy: number
    progress: number
    isRunningOrBattle: boolean
    isBattlePhase?: boolean
    infiniteBridgeMode?: boolean
    allSegmentsResolved?: boolean
    playerBridgeTowerLevels?: [number, number, number, number]
  },
  callbacks: Bridge3DSimCallbacks,
): void {
  const clampedDt = Math.min(0.05, Math.max(0.001, dtSec))
  const dtMs = clampedDt * 1000
  const timerDtMs = Math.min(250, Math.max(1, dtSec * 1000))

  if (input.playerBridgeTowerLevels) {
    for (let i = 0; i < 4; i++) {
      const incomingLvl = input.playerBridgeTowerLevels[i] ?? 0
      const prevSyncedLvl = sim.lastSyncedTowerLevels[i] ?? 0
      if (incomingLvl !== prevSyncedLvl) {
        sim.playerBridgeTowerLevels[i] = incomingLvl
        sim.lastSyncedTowerLevels[i] = incomingLvl
        const newMaxHp = getBridgeTowerMaxHp(incomingLvl)
        sim.playerBridgeTowerMaxHp[i] = newMaxHp
        if (incomingLvl > prevSyncedLvl) {
          // Jogador construiu ou evoluiu a torre: restaura HP estrutural cheio
          sim.playerBridgeTowerHp[i] = newMaxHp
          sim.playerBridgeTowerRuinedTimerMs[i] = 0
        } else {
          sim.playerBridgeTowerHp[i] = Math.min(sim.playerBridgeTowerHp[i], newMaxHp)
        }
      }
    }
  }
  const alliedTowerStats = computeAlliedBridgeTowerStats(sim.playerBridgeTowerLevels)

  // 1. Posição 3D horizontal livre do Herói e rota ativa (LEFT, CENTER, RIGHT)
  const targetWorldX = laneNormToWorldX(input.laneNormX)
  sim.heroWorldX += (targetWorldX - sim.heroWorldX) * Math.min(1, clampedDt * 18)
  sim.activeRoute = resolveRouteFromWorldX(sim.heroWorldX)

  // V8 Fase 2 / V9: Decrementar janela ativa da Rota Direita em tempo real (timerDtMs). Quando zera, volta para gelo/cinza desativado!
  if (input.isRunningOrBattle && sim.rightBuffActiveTimerMs > 0) {
    sim.rightBuffActiveTimerMs = Math.max(0, sim.rightBuffActiveTimerMs - timerDtMs)
    sim.rightMathBonusCharges =
      sim.rightBuffActiveTimerMs > 0
        ? Math.max(1, Math.ceil(sim.rightBuffActiveTimerMs / 4000))
        : 0
    if (sim.rightBuffActiveTimerMs <= 0) {
      sim.rightFrozenWeapon.unlocked = false
      sim.rightPiercingShots = false
    }
  } else if (sim.rightBuffActiveTimerMs <= 0) {
    sim.rightMathBonusCharges = 0
    sim.rightFrozenWeapon.unlocked = false
    sim.rightPiercingShots = false
  }

  if (sim.activeRoute === 'RIGHT') {
    sim.timeInRightRouteSec += clampedDt
  } else {
    sim.timeInRightRouteSec = 0
  }
  if (sim.rightRoutePromptCooldownMs > 0) {
    sim.rightRoutePromptCooldownMs = Math.max(0, sim.rightRoutePromptCooldownMs - dtMs)
  }

  // 2. Perfil dinâmico de tiro escalado pelos pontos atuais + bônus de armas coletadas nas rotas laterais + Torres Aliadas da Ponte (V10)
  const baseProfile = computeShotProfile(input.currentArmy)
  const hasLeftBoost = sim.leftFrozenBlock.unlocked || sim.leftCannonLevel > 0
  const hasRightBoost =
    sim.rightBuffActiveTimerMs > 0 &&
    (sim.rightFrozenWeapon.unlocked || sim.rightWeaponLevel > 0)
  const activeTierSpec =
    RIGHT_CORRIDOR_TIER_BUFF_POLICIES[sim.rightActiveTier] ??
    RIGHT_CORRIDOR_TIER_BUFF_POLICIES[2]
  const extraBarrels =
    (hasLeftBoost ? 1 : 0) +
    (hasRightBoost ? activeTierSpec.extraParallelBarrels : 0) +
    Math.floor(alliedTowerStats.activeTowersCount / 2)
  const dmgMult =
    (hasRightBoost
      ? activeTierSpec.weaponDmgMult + sim.rightWeaponLevel * 0.45
      : 1.0) * (hasLeftBoost ? 1.15 + sim.leftCannonLevel * 0.12 : 1.0)
  const fireRateBonus =
    (hasLeftBoost ? 1.4 + Math.min(2.0, sim.leftCannonLevel * 0.3) : 0) +
    alliedTowerStats.activeTowersCount * 0.35
  const rightFireRateMult = hasRightBoost ? activeTierSpec.fireRateMult : 1.0

  sim.shotProfile = {
    ...baseProfile,
    damagePerShot: Math.max(
      1,
      baseProfile.damagePerShot * dmgMult + alliedTowerStats.bonusDamagePerHit,
    ),
    shotsPerSecond: Math.min(
      20,
      Number(
        ((baseProfile.shotsPerSecond + fireRateBonus) * rightFireRateMult).toFixed(2),
      ),
    ),
    parallelBarrels: Math.min(6, baseProfile.parallelBarrels + extraBarrels),
  }


  // Decair flashes visuais
  if (sim.playerHitFlashMs > 0) sim.playerHitFlashMs = Math.max(0, sim.playerHitFlashMs - dtMs)
  if (sim.bossHitFlashMs > 0) sim.bossHitFlashMs = Math.max(0, sim.bossHitFlashMs - dtMs)
  if (sim.leftFrozenBlock.hitFlashMs > 0) {
    sim.leftFrozenBlock.hitFlashMs = Math.max(0, sim.leftFrozenBlock.hitFlashMs - dtMs)
  }
  if (sim.rightFrozenWeapon.hitFlashMs > 0) {
    sim.rightFrozenWeapon.hitFlashMs = Math.max(0, sim.rightFrozenWeapon.hitFlashMs - dtMs)
  }
  for (const barrel of sim.barrels) {
    if (barrel.explosionFlashMs > 0) {
      barrel.explosionFlashMs = Math.max(0, barrel.explosionFlashMs - dtMs)
    }
  }
  for (const en of sim.enemies) {
    if (en.hitFlashMs > 0) {
      en.hitFlashMs = Math.max(0, en.hitFlashMs - dtMs)
    }
  }
  if (sim.supplyCaravan.hitFlashMs > 0) {
    sim.supplyCaravan.hitFlashMs = Math.max(0, sim.supplyCaravan.hitFlashMs - dtMs)
  }
  for (let i = 0; i < 4; i++) {
    if (sim.playerBridgeTowerHitFlashMs[i] > 0) {
      sim.playerBridgeTowerHitFlashMs[i] = Math.max(
        0,
        sim.playerBridgeTowerHitFlashMs[i] - dtMs,
      )
    }
    if (sim.playerBridgeTowerRuinedTimerMs[i] > 0) {
      sim.playerBridgeTowerRuinedTimerMs[i] = Math.max(
        0,
        sim.playerBridgeTowerRuinedTimerMs[i] - dtMs,
      )
    }
    if (sim.towerRecoilAmount[i] > 0) {
      sim.towerRecoilAmount[i] = Math.max(0, sim.towerRecoilAmount[i] - clampedDt * 2.8)
    }
  }

  if (!input.isRunningOrBattle) {
    return
  }

  let attritionLossThisFrame = 0
  let coinsEarnedThisFrame = 0
  let damageDealtThisFrame = 0

  // V8 Fase 3 + V11 Fase 3: Ciclo de Vida Real do Mega-Boss (MARCHING -> CERCO NAS TORRES -> MELEE_CLASH -> INTERMISSION 7.5s)
  const currentSectorSpec = computeSectorBossSpec(sim.sectorIndex)
  const meleeLineZ = BRIDGE_3D_DIMENSIONS.zPlayerLine - 2.8 // Z = +7.7 (frente do esquadrão e das torres aliadas)
  const marchDt = timerDtMs / 1000

  if (sim.bossLifecycle === 'INTERMISSION') {
    sim.bossHp = 0
    sim.bossVanguardShieldActive = false
    sim.bossRespawnTimerMs = Math.max(0, sim.bossRespawnTimerMs - timerDtMs)

    // Avançar Caravana / Baú de Suprimentos Dourado na Rota Central durante os 7.5s sem Boss
    if (sim.supplyCaravan.active) {
      sim.supplyCaravan.z += 2.4 * marchDt
      if (
        Math.abs(sim.supplyCaravan.z - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.8 &&
        sim.activeRoute === 'CENTER'
      ) {
        sim.supplyCaravan.active = false
        const chestBonus = Math.max(
          15,
          Math.round(currentSectorSpec.sectorClearRewardSoldiers * 0.45),
        )
        coinsEarnedThisFrame += 20
        callbacks.onSideRouteReward(
          'LEFT',
          chestBonus,
          `🎁 Baú do Setor Coletado! +${formatArmy(chestBonus, 'compact')} 🛡️`,
        )
      } else if (sim.supplyCaravan.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
        sim.supplyCaravan.active = false
      }
    }

    // Quando o intermission de 7.5s termina, nasce o próximo Boss na Fortaleza Norte com arquétipo novo!
    if (sim.bossRespawnTimerMs <= 0) {
      sim.supplyCaravan.active = false
      sim.bossLifecycle = 'MARCHING'
      const nextSpec = computeSectorBossSpec(sim.sectorIndex)
      sim.bossMaxHp = nextSpec.bossHp
      sim.bossHp = nextSpec.bossHp
      sim.bossZ = -72
      sim.bossVanguardShieldActive = true
      sim.bossMeleeCooldownMs = 1000
      sim.bossArchetypeIndex = nextSpec.archetype.index
      sim.bossArchetypeId = nextSpec.archetype.id
      sim.bossArchetypeName = nextSpec.archetype.namePt
      for (const b of sim.bolts) {
        if (b.z < -45) {
          b.active = false
        }
      }
    }
  } else {
    // Boss vivo: caminha continuamente em direção ao jogador (+Z), ataca as Torres Aliadas ao se aproximar e golpeia o Herói!
    sim.bossArchetypeIndex = currentSectorSpec.archetype.index
    sim.bossArchetypeId = currentSectorSpec.archetype.id
    sim.bossArchetypeName = currentSectorSpec.archetype.namePt
    sim.bossVanguardShieldActive =
      sim.bossZ < PLAYER_BRIDGE_BASE_POLICY.bossVanguardShieldEndZ

    if (sim.bossZ < meleeLineZ) {
      sim.bossLifecycle = 'MARCHING'
      sim.bossZ = Math.min(
        meleeLineZ,
        sim.bossZ + currentSectorSpec.marchSpeedZ * marchDt,
      )
    } else {
      sim.bossZ = meleeLineZ
      sim.bossLifecycle = 'MELEE_CLASH'
    }

    // V11 Fase 3: Cerco do Boss contra as Torres Aliadas (Z >= -6.0) e Dano Corpo a Corpo Real no Herói (Z >= +4.5)
    if (sim.bossZ >= PLAYER_BRIDGE_BASE_POLICY.bossSiegeStartZ) {
      sim.bossMeleeCooldownMs -= timerDtMs
      if (sim.bossMeleeCooldownMs <= 0) {
        sim.bossMeleeCooldownMs = 950
        sim.bossHitFlashMs = 240

        // 1. Verificar se existem Torres Aliadas ativas (Lv >= 1) no Bastião Sul para o Boss atacar e destruir!
        const activeTowerSlots: number[] = []
        for (let sIdx = 0; sIdx < 4; sIdx++) {
          if ((sim.playerBridgeTowerLevels[sIdx] ?? 0) > 0) {
            activeTowerSlots.push(sIdx)
          }
        }

        if (activeTowerSlots.length > 0) {
          // Escolhe a torre aliada mais próxima do centro ou com menor HP para demolir
          activeTowerSlots.sort((a, b) => {
            const distA = Math.abs(PLAYER_BRIDGE_BASE_POLICY.slots[a]?.x ?? 5)
            const distB = Math.abs(PLAYER_BRIDGE_BASE_POLICY.slots[b]?.x ?? 5)
            return distA - distB
          })
          const targetSlot = activeTowerSlots[0] as 0 | 1 | 2 | 3
          const prevLevel = sim.playerBridgeTowerLevels[targetSlot] ?? 1
          const towerNamePt =
            PLAYER_BRIDGE_BASE_POLICY.slots[targetSlot]?.namePt ?? 'Torre Aliada'
          const towerSiegeDmg =
            PLAYER_BRIDGE_BASE_POLICY.bossTowerStrikeDamageBase +
            (sim.sectorIndex - 1) * 18
          const currentTowerHp =
            sim.playerBridgeTowerHp[targetSlot] > 0
              ? sim.playerBridgeTowerHp[targetSlot]
              : getBridgeTowerMaxHp(prevLevel)
          const nextTowerHp = Math.max(0, currentTowerHp - towerSiegeDmg)
          sim.playerBridgeTowerHp[targetSlot] = nextTowerHp
          sim.playerBridgeTowerHitFlashMs[targetSlot] = 450
          sim.bossTowerAttacksCount += 1

          if (nextTowerHp <= 0) {
            // A Torre Aliada foi DESTRUÍDA / REBAIXADA pelo golpe de cerco do Boss!
            const newLevel = Math.max(0, prevLevel - 1)
            sim.playerBridgeTowerLevels[targetSlot] = newLevel
            sim.lastSyncedTowerLevels[targetSlot] = newLevel
            const newMax = getBridgeTowerMaxHp(newLevel)
            sim.playerBridgeTowerMaxHp[targetSlot] = newMax
            sim.playerBridgeTowerHp[targetSlot] = newMax
            sim.playerBridgeTowerRuinedTimerMs[targetSlot] = 6500
            sim.playerBridgeTowerDestroyedCount += 1
            callbacks.onAlliedTowerDestroyed?.(
              targetSlot,
              newLevel,
              towerNamePt,
            )
          } else {
            callbacks.onAlliedTowerDamaged?.(
              targetSlot,
              nextTowerHp,
              sim.playerBridgeTowerMaxHp[targetSlot] || getBridgeTowerMaxHp(prevLevel),
              towerSiegeDmg,
            )
          }
        }

        // 2. Quando o Boss chega na linha corpo a corpo (Z >= +4.5) e o Herói está na frente dele, causa dano real SEM trava artificial de 3 soldados!
        const isHeroInBossReach =
          sim.bossZ >= meleeLineZ - 3.2 &&
          sim.activeRoute === 'CENTER' &&
          Math.abs(sim.heroWorldX) <= 3.3
        if (isHeroInBossReach && !input.isBattlePhase) {
          const strikeDmg = Math.max(3, currentSectorSpec.meleeDamagePerStrike)
          attritionLossThisFrame += strikeDmg
          sim.bossHeroStrikesCount += 1
          sim.playerHitFlashMs = 420
          callbacks.onBossStrikeHero?.(strikeDmg, sim.bossArchetypeName)
        }
      }
    }
  }

  // 3. Disparo contínuo 100% reto para frente (-Z) a partir da posição X do Herói
  sim.fireCooldownSec -= clampedDt
  const fireInterval = 1 / Math.max(1.5, sim.shotProfile.shotsPerSecond)
  if (sim.fireCooldownSec <= 0) {
    sim.fireCooldownSec = fireInterval
    const barrelsCount = sim.shotProfile.parallelBarrels
    const spacing = barrelsCount > 1 ? 0.44 : 0

    for (let b = 0; b < barrelsCount; b++) {
      const slot = sim.bolts.find((item) => !item.active)
      if (!slot) break
      const offsetX = (b - (barrelsCount - 1) * 0.5) * spacing
      slot.id = ++sim.boltSeq
      slot.x = sim.heroWorldX + offsetX
      slot.y = 1.15
      slot.z = BRIDGE_3D_DIMENSIONS.zPlayerLine - 1.1
      slot.vz = -sim.shotProfile.projectileSpeed
      slot.damage = sim.shotProfile.damagePerShot
      slot.scale = sim.shotProfile.projectileScale
      slot.active = true
      slot.pierceRemaining =
        sim.rightBuffActiveTimerMs > 0 && sim.rightPiercingShots ? 1 : 0
    }
  }

  // 4. Evolução Dinâmica & Movimento da Esteira nas Rotas Laterais (Esquerda e Direita)
  const sideScrollSpeed = 7.2

  // 4a. Rota Esquerda (V9 Pilar 2): 100% ancorada no Nível dos Monstros do Setor (computeLeftCorridorMonsterScaling)!
  // Zero dependência de input.currentArmy ou sim.mathChallengesSolved!
  const leftMonsterScale = computeLeftCorridorMonsterScaling(sim.sectorIndex)
  if (sim.leftGates[0]) {
    sim.leftGates[0].bonusSoldiers = leftMonsterScale.gate0Soldiers
    sim.leftGates[0].label = `+${formatArmy(leftMonsterScale.gate0Soldiers, 'compact')}`
    sim.leftGates[0].subLabel = `MONSTROS S${sim.sectorIndex}`
  }
  if (sim.leftGates[1]) {
    sim.leftGates[1].bonusSoldiers = leftMonsterScale.gate1Soldiers
    sim.leftGates[1].label = `+${formatArmy(leftMonsterScale.gate1Soldiers, 'compact')}`
    sim.leftGates[1].subLabel = `REFORÇO S${sim.sectorIndex}`
  }

  // Avançar Canhão Gélido da Rota Esquerda (+Z) para o jogador coletar!
  sim.leftFrozenBlock.z += sideScrollSpeed * clampedDt
  if (
    !sim.leftFrozenBlock.collectedInPass &&
    sim.activeRoute === 'LEFT' &&
    Math.abs(sim.leftFrozenBlock.z - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.65
  ) {
    sim.leftFrozenBlock.collectedInPass = true
    sim.leftFrozenBlock.unlocked = true
    sim.leftCannonLevel += 1
    const cannonSoldiers = leftMonsterScale.cannonCollectBonus
    callbacks.onSideRouteReward(
      'LEFT',
      cannonSoldiers,
      `❄️ Canhão Nv.${sim.leftCannonLevel} Coletado! +${formatArmy(cannonSoldiers, 'compact')}`,
    )
  }
  if (sim.leftFrozenBlock.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
    sim.leftFrozenBlock.z -= 60.0
    const nextLvl = sim.leftCannonLevel + 1
    const nextMaxHp = leftMonsterScale.cannonHp
    sim.leftFrozenBlock.level = nextLvl
    sim.leftFrozenBlock.maxHp = nextMaxHp
    sim.leftFrozenBlock.hp = nextMaxHp
    sim.leftFrozenBlock.unlocked = false
    sim.leftFrozenBlock.collectedInPass = false
  }

  for (const g of sim.leftGates) {
    g.z += sideScrollSpeed * clampedDt
    if (
      !g.collectedInPass &&
      sim.activeRoute === 'LEFT' &&
      Math.abs(g.z - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.25
    ) {
      g.collectedInPass = true
      const effectiveBonus = g.bonusSoldiers
      callbacks.onSideRouteReward(
        'LEFT',
        effectiveBonus,
        `Rota Esquerda +${formatArmy(effectiveBonus, 'compact')}`,
      )
    }
    if (g.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
      g.z -= 60.0
      g.collectedInPass = false
    }
  }

  // 4b. Rota Direita (V9 Pilar 1): ÚNICA rota com crescimento exponencial, vinculada ao Grau (1..4) e à questão resolvida!
  const rightExpSpec = computeRightCorridorExponentialGates({
    sectorIndex: sim.sectorIndex,
    currentArmy: input.currentArmy,
    mathChallengesSolved: sim.mathChallengesSolved,
    activeTier: sim.rightActiveTier,
    solvedQuestionValue: sim.rightActiveQuestionValue,
  })
  const targetRightVals = [rightExpSpec.gate0Soldiers, rightExpSpec.gate1Soldiers]
  const targetRightSubs = [rightExpSpec.gate0SubLabel, rightExpSpec.gate1SubLabel]
  for (let i = 0; i < sim.rightGates.length; i++) {
    const g = sim.rightGates[i]
    const targetRightVal = targetRightVals[i] ?? rightExpSpec.gate1Soldiers
    const isCollectingActiveRight =
      sim.activeRoute === 'RIGHT' && sim.rightBuffActiveTimerMs > 0
    const ratioChange =
      g.bonusSoldiers > 0 ? targetRightVal / g.bonusSoldiers : 999
    if (!isCollectingActiveRight || ratioChange > 3.5 || ratioChange < 0.25) {
      g.bonusSoldiers = targetRightVal
      g.label = `+${formatArmy(targetRightVal, 'compact')}`
      g.subLabel = targetRightSubs[i] ?? rightExpSpec.gate1SubLabel
    }
  }

  // Avançar Altar 🧮 FAZER CONTA e Metralhadora 888 na Rota Direita (+Z)
  sim.rightAltarZ += sideScrollSpeed * clampedDt
  if (
    !sim.rightAltarCollectedInPass &&
    sim.activeRoute === 'RIGHT' &&
    Math.abs(sim.rightAltarZ - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.5
  ) {
    sim.rightAltarCollectedInPass = true
    const targetBonus = sim.rightGates[1]?.bonusSoldiers ?? 99
    sim.pendingRightGateBonus = Math.max(sim.pendingRightGateBonus, targetBonus)
  }
  if (sim.rightAltarZ > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
    sim.rightAltarZ -= 60.0
    sim.rightAltarCollectedInPass = false
  }

  sim.rightFrozenWeapon.z += sideScrollSpeed * clampedDt
  if (
    !sim.rightFrozenWeapon.collectedInPass &&
    sim.activeRoute === 'RIGHT' &&
    Math.abs(sim.rightFrozenWeapon.z - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.65
  ) {
    if (sim.rightBuffActiveTimerMs > 0) {
      sim.rightFrozenWeapon.collectedInPass = true
      sim.rightFrozenWeapon.unlocked = true
      sim.rightWeaponLevel += 1
      const weaponBonus = Math.max(
        25 * sim.rightWeaponLevel,
        Math.round(input.currentArmy * activeTierSpec.armyBonusRatio),
      )
      callbacks.onSideRouteReward(
        'RIGHT',
        weaponBonus,
        `🔥 ${activeTierSpec.activeHudSummaryPt} Nv.${sim.rightWeaponLevel}! +${formatArmy(weaponBonus, 'compact')}`,
      )
    } else {
      // V8 Fase 2: Rota Direita cinza/congelada por padrão — permanece visível/congelada sem coletar nem abrir modal!
      const weaponPending = Math.max(
        sim.rightGates[1]?.bonusSoldiers ?? 99,
        input.currentArmy * 1.8,
      )
      sim.pendingRightGateBonus = Math.max(sim.pendingRightGateBonus, weaponPending)
    }
  }
  if (sim.rightFrozenWeapon.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
    sim.rightFrozenWeapon.z -= 60.0
    const nextWepLvl = sim.rightWeaponLevel + 1
    const nextWepHp = Math.max(
      888,
      Math.round(888 * Math.pow(1.5, sim.rightWeaponLevel) + input.currentArmy * 1.2),
    )
    sim.rightFrozenWeapon.level = nextWepLvl
    sim.rightFrozenWeapon.maxHp = nextWepHp
    sim.rightFrozenWeapon.hp = nextWepHp
    sim.rightFrozenWeapon.unlocked = sim.rightBuffActiveTimerMs > 0
    sim.rightFrozenWeapon.collectedInPass = false
  }

  for (const g of sim.rightGates) {
    g.z += sideScrollSpeed * clampedDt
    if (
      !g.collectedInPass &&
      sim.activeRoute === 'RIGHT' &&
      Math.abs(g.z - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.25
    ) {
      // V8 Fase 2: Os buffs da Rota Direita só são coletados e concedem soldados quando a janela temporizada pós-conta está ativa!
      if (sim.rightBuffActiveTimerMs > 0) {
        g.collectedInPass = true
        const remSec = Math.max(1, Math.ceil(sim.rightBuffActiveTimerMs / 1000))
        callbacks.onSideRouteReward(
          'RIGHT',
          g.bonusSoldiers,
          `⚡ Super Buff ${g.label} · ${g.subLabel ?? activeTierSpec.badgePt} (${remSec}s Ativo!)`,
        )
      } else {
        // Quando cinza/congelado: permanece visível como bloqueado, 0 soldados grátis e zero modal intrusivo automático!
        sim.pendingRightGateBonus = Math.max(sim.pendingRightGateBonus, g.bonusSoldiers)
      }
    }
    if (g.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
      g.z -= 60.0
      g.collectedInPass = false
    }
  }

  // 5. Movimento dos Projéteis Retos (-Z) e Colisões 3D nas 3 Rotas
  let activeCount = 0

  for (const bolt of sim.bolts) {
    if (!bolt.active) continue
    bolt.z += bolt.vz * clampedDt

    if (bolt.z < BRIDGE_3D_DIMENSIONS.zFortressLine) {
      bolt.active = false
      continue
    }

    const boltRoute = resolveRouteFromWorldX(bolt.x)

    // 5a. Colisão na Rota Esquerda: Pedestal/Canhão Congelado (V9: Recompensa 100% ancorada no nível dos monstros!)
    if (
      boltRoute === 'LEFT' &&
      !sim.leftFrozenBlock.unlocked &&
      !sim.leftFrozenBlock.collectedInPass &&
      Math.abs(bolt.z - sim.leftFrozenBlock.z) < 1.8 &&
      Math.abs(bolt.x - BRIDGE_3D_ROUTES.LEFT.xCenter) < 2.2
    ) {
      sim.leftFrozenBlock.hp = Math.max(0, sim.leftFrozenBlock.hp - bolt.damage)
      sim.leftFrozenBlock.hitFlashMs = 160
      bolt.active = false
      if (sim.leftFrozenBlock.hp <= 0) {
        sim.leftFrozenBlock.unlocked = true
        const unlockBonus = leftMonsterScale.cannonUnlockBonus
        callbacks.onSideRouteReward(
          'LEFT',
          unlockBonus,
          `❄️ Canhão Descongelado! +${formatArmy(unlockBonus, 'compact')}`,
        )
      }
      continue
    }

    // 5b. Colisão na Rota Direita: Arma Multi-Cano Congelada (888 HP)
    if (
      boltRoute === 'RIGHT' &&
      !sim.rightFrozenWeapon.unlocked &&
      !sim.rightFrozenWeapon.collectedInPass &&
      Math.abs(bolt.z - sim.rightFrozenWeapon.z) < 2.1 &&
      Math.abs(bolt.x - BRIDGE_3D_ROUTES.RIGHT.xCenter) < 2.4
    ) {
      sim.rightFrozenWeapon.hp = Math.max(0, sim.rightFrozenWeapon.hp - bolt.damage)
      sim.rightFrozenWeapon.hitFlashMs = 160
      bolt.active = false
      if (sim.rightFrozenWeapon.hp <= 0) {
        if (sim.rightBuffActiveTimerMs > 0) {
          sim.rightFrozenWeapon.unlocked = true
          const unlockWepBonus = Math.max(15, Math.round(input.currentArmy * 0.5))
          callbacks.onSideRouteReward(
            'RIGHT',
            unlockWepBonus,
            `🔥 Metralhadora 888 Desbloqueada! +${formatArmy(unlockWepBonus, 'compact')}`,
          )
        } else {
          // Permanece congelada em 1 HP até que o jogador resolva uma conta matemática (🧮)!
          sim.rightFrozenWeapon.hp = 1
        }
      }
      continue
    }

    // 5c. Colisão na Rota Central: Demolidores / Barris Blindados em Marcha (112 HP) com Detonação AoE
    if (boltRoute === 'CENTER') {
      let hitBarrel = false
      for (const barrel of sim.barrels) {
        if (!barrel.active) continue
        if (Math.abs(bolt.z - barrel.z) < 1.55 && Math.abs(bolt.x - barrel.x) < 1.35) {
          barrel.hp -= bolt.damage
          barrel.explosionFlashMs = 160
          bolt.active = false
          hitBarrel = true
          damageDealtThisFrame += Math.min(bolt.damage, 4)
          if (barrel.hp <= 0) {
            coinsEarnedThisFrame += 4
            // Detonação AoE: atinge todos os monstros num raio de 10.5m
            for (const en of sim.enemies) {
              const dist = Math.hypot(en.x - barrel.x, en.z - barrel.z)
              if (dist <= 10.5) {
                en.hp -= 140
                en.hitFlashMs = 240
                if (en.hp <= 0) {
                  coinsEarnedThisFrame += en.isMiniBoss ? 5 : 1
                  damageDealtThisFrame += en.isMiniBoss ? 8 : 2
                  en.z = -84 - nextSimRandom(sim) * 14
                  en.maxHp = en.isMiniBoss
                    ? 176 + (sim.sectorIndex - 1) * 90
                    : 18 + (sim.sectorIndex - 1) * 10
                  en.hp = en.maxHp
                }
              }
            }
            // Respawn imediato no fundo da ponte para marchar novamente sem travar nem inflar no lugar!
            barrel.z = -80 - nextSimRandom(sim) * 14
            barrel.maxHp = 112 + (sim.sectorIndex - 1) * 45
            barrel.hp = barrel.maxHp
            barrel.active = true
            barrel.explosionFlashMs = 200
          }
          break
        }
      }
      if (hitBarrel) continue

      // 5d. Colisão na Rota Central: Horda Rubra e Mini-Bosses (176 HP) — Suporta Canhão Perfurante (Grau III/IV)
      let hitEnemy = false
      for (const en of sim.enemies) {
        const hitRadiusX = en.isMiniBoss ? 1.55 : 0.98
        const hitDepthZ = en.isMiniBoss ? 1.65 : 1.15
        if (
          Math.abs(bolt.z - en.z) < hitDepthZ &&
          Math.abs(bolt.x - en.x) < hitRadiusX
        ) {
          en.hp -= bolt.damage
          en.hitFlashMs = 150
          if ((bolt.pierceRemaining ?? 0) > 0) {
            bolt.pierceRemaining = (bolt.pierceRemaining ?? 0) - 1
          } else {
            bolt.active = false
          }
          hitEnemy = !bolt.active
          damageDealtThisFrame += Math.min(bolt.damage, 4)
          if (en.hp <= 0) {
            coinsEarnedThisFrame += en.isMiniBoss ? 5 : 1
            en.z = -84 - nextSimRandom(sim) * 16
            en.x = ((en.id % 4) - 1.5) * 1.6 + (nextSimRandom(sim) - 0.5) * 0.45
            en.maxHp = en.isMiniBoss
              ? 176 + (sim.sectorIndex - 1) * 90
              : 18 + (sim.sectorIndex - 1) * 10
            en.hp = en.maxHp
          }
          break
        }
      }
      if (hitEnemy) continue

      // 5e. Colisão com a Caravana / Baú de Suprimentos Dourado durante o INTERMISSION (7.5s sem Boss)
      if (
        sim.bossLifecycle === 'INTERMISSION' &&
        sim.supplyCaravan.active &&
        Math.abs(bolt.z - sim.supplyCaravan.z) < 2.4 &&
        Math.abs(bolt.x - sim.supplyCaravan.x) < 2.4
      ) {
        sim.supplyCaravan.hp = Math.max(10, sim.supplyCaravan.hp - bolt.damage)
        sim.supplyCaravan.hitFlashMs = 200
        bolt.active = false
        coinsEarnedThisFrame += 4
        if (
          sim.supplyCaravan.rewardsGrantedCount < 6 &&
          sim.boltSeq % 5 === 0
        ) {
          sim.supplyCaravan.rewardsGrantedCount += 1
          const caravanSoldiers = Math.max(
            6,
            Math.round(currentSectorSpec.sectorClearRewardSoldiers * 0.18),
          )
          callbacks.onSideRouteReward(
            'LEFT',
            caravanSoldiers,
            `🎁 Suprimento Real +${formatArmy(caravanSoldiers, 'compact')} 🛡️`,
          )
        }
        continue
      }

      // 5f. Colisão com o Mega-Boss do Setor (somente quando vivo e já emergiu do portão norte: z > -68.5)
      if (
        sim.bossLifecycle !== 'INTERMISSION' &&
        sim.bossZ > -68.5 &&
        Math.abs(bolt.z - sim.bossZ) < 3.4 &&
        Math.abs(bolt.x) < 3.4
      ) {
        const isVanguardShielded =
          sim.bossZ < PLAYER_BRIDGE_BASE_POLICY.bossVanguardShieldEndZ
        const rawBossDmg = Math.max(1, bolt.damage)
        const effectiveBossDmg = isVanguardShielded
          ? Math.max(
              1,
              Math.round(
                rawBossDmg *
                  PLAYER_BRIDGE_BASE_POLICY.bossVanguardDamageMultiplier,
              ),
            )
          : rawBossDmg
        const vanguardHpFloor = isVanguardShielded
          ? Math.max(
              18,
              Math.round(
                sim.bossMaxHp *
                  PLAYER_BRIDGE_BASE_POLICY.bossVanguardMinHpRatio,
              ),
            )
          : 0
        const minBossHpFloor = input.isBattlePhase
          ? Math.max(18, Math.round(sim.bossMaxHp * 0.2))
          : vanguardHpFloor
        sim.bossHp = Math.max(minBossHpFloor, sim.bossHp - effectiveBossDmg)
        sim.bossHitFlashMs = 160
        bolt.active = false
        damageDealtThisFrame += Math.min(effectiveBossDmg, 6)
        if (sim.bossHp <= 0 && !input.isBattlePhase) {
          // V8 Fase 3: O Boss MORRE de verdade e desaparece por 7.5s (INTERMISSION)!
          // Sem curar instantaneamente no mesmo frame e sem rubber-banding com currentArmy!
          const defeatedSpec = computeSectorBossSpec(sim.sectorIndex)
          sim.bossHp = 0
          sim.sectorIndex += 1
          const nextSpec = computeSectorBossSpec(sim.sectorIndex)
          sim.bossLifecycle = 'INTERMISSION'
          sim.bossRespawnTimerMs = 7500
          sim.bossArchetypeIndex = nextSpec.archetype.index
          sim.bossArchetypeId = nextSpec.archetype.id
          sim.bossArchetypeName = nextSpec.archetype.namePt

          // Spawnar Caravana / Baú Dourado de Recompensa bem visível na Rota Central durante os 7.5s de Intermission
          sim.supplyCaravan = {
            active: true,
            x: 0,
            z: Math.max(-24, Math.min(-14, sim.bossZ - 2)),
            hp: Math.max(100, Math.round(defeatedSpec.bossHp * 0.5)),
            maxHp: Math.max(100, Math.round(defeatedSpec.bossHp * 0.5)),
            hitFlashMs: 260,
            rewardsGrantedCount: 0,
          }

          const sectorReward = Math.max(
            defeatedSpec.sectorClearRewardSoldiers,
            Math.round(input.currentArmy * 0.22),
          )
          coinsEarnedThisFrame += defeatedSpec.sectorClearRewardCoins

          // Reativar barris para o novo setor
          for (const barrel of sim.barrels) {
            barrel.active = true
            barrel.maxHp = 112 + (sim.sectorIndex - 1) * 45
            barrel.hp = barrel.maxHp
          }
          callbacks.onSectorBossDefeated(sim.sectorIndex, sectorReward)
          break
        }
        continue
      }
    }

    if (bolt.active) {
      activeCount++
    }
  }

  sim.activeBoltsCount = activeCount

  // 6. Avanço da Horda, Mini-Bosses e Demolidores (+Z) e Dano Real de Contato SOMENTE se acertar a posição X do Herói (permite desviar!)
  let hordeContactLoss = 0
  const barrelMarchSpeedZ = 2.35 + (sim.sectorIndex - 1) * 0.15
  for (const barrel of sim.barrels) {
    if (!barrel.active) continue
    barrel.z += barrelMarchSpeedZ * clampedDt
    if (barrel.z >= BRIDGE_3D_DIMENSIONS.zPlayerLine - 0.55) {
      const isDirectHitOnHero =
        sim.activeRoute === 'CENTER' && Math.abs(barrel.x - sim.heroWorldX) <= 1.35
      if (isDirectHitOnHero) {
        hordeContactLoss += 2
        sim.playerHitFlashMs = 280
      }
      barrel.z = -80 - nextSimRandom(sim) * 14
      barrel.maxHp = 112 + (sim.sectorIndex - 1) * 45
      barrel.hp = barrel.maxHp
      barrel.active = true
    }
  }
  for (const en of sim.enemies) {
    en.z += en.speedZ * clampedDt
    if (en.z >= BRIDGE_3D_DIMENSIONS.zPlayerLine - 0.55) {
      // Se o jogador desviou para o lado (|en.x - sim.heroWorldX| > hitRadiusX), o monstro passa reto sem tirar HP!
      const hitRadiusX = en.isMiniBoss ? 1.45 : 1.05
      const isDirectHitOnHero =
        sim.activeRoute === 'CENTER' && Math.abs(en.x - sim.heroWorldX) <= hitRadiusX
      if (isDirectHitOnHero) {
        hordeContactLoss += en.contactDamage
        sim.playerHitFlashMs = 280
      }
      // Respawn lá no fundo da ponte perto do castelo
      en.z = -84 - nextSimRandom(sim) * 14
      en.x = ((en.id % 4) - 1.5) * 1.6 + (nextSimRandom(sim) - 0.5) * 0.45
      en.maxHp = en.isMiniBoss
        ? 176 + (sim.sectorIndex - 1) * 90
        : 18 + (sim.sectorIndex - 1) * 10
      en.hp = en.maxHp
    }
  }
  if (hordeContactLoss > 0 && !input.isBattlePhase) {
    // Enquanto o Boss ainda está marchando (antes do MELEE_CLASH com segmentos encerrados), a Horda drena o exército até o piso de 5 soldados,
    // permitindo que o jogador escolha portões com base íntegra e o Boss desfira o golpe corpo a corpo fatal!
    const effectiveHordeLoss =
      sim.bossLifecycle === 'MELEE_CLASH' && input.allSegmentsResolved
        ? hordeContactLoss
        : Math.min(hordeContactLoss, Math.max(0, input.currentArmy - 5))
    attritionLossThisFrame += effectiveHordeLoss
  }

  // 6b. Disparos Ativos das 4 Torres Aliadas da Ponte (Miram e Abatem Mini-Bosses, Horda e Boss!)
  if (input.isRunningOrBattle) {
    for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
      const lvl = sim.playerBridgeTowerLevels[slotIdx] ?? 0
      if (lvl <= 0) continue
      sim.towerFireCooldownsMs[slotIdx] -= timerDtMs
      if (sim.towerFireCooldownsMs[slotIdx] <= 0) {
        sim.towerFireCooldownsMs[slotIdx] = Math.max(300, 1020 - lvl * 145)
        const freeTurretBolt = sim.alliedTowerBolts.find((b) => !b.active)
        if (freeTurretBolt) {
          const slotSpec = PLAYER_BRIDGE_BASE_POLICY.slots[slotIdx]
          const spawnX = slotSpec?.x ?? 0
          const spawnZ = slotSpec?.z ?? 9.0
          // Encontrar o alvo mais próximo (priorizando Mini-Bosses e monstros próximos)
          let targetX = 0
          let targetZ = -28
          let bestScore = -99999
          for (const en of sim.enemies) {
            if (en.z < -78 || en.z > BRIDGE_3D_DIMENSIONS.zPlayerLine) continue
            const score = en.z + (en.isMiniBoss ? 14 : 0)
            if (score > bestScore) {
              bestScore = score
              targetX = en.x
              targetZ = en.z
            }
          }
          for (const barrel of sim.barrels) {
            if (!barrel.active || barrel.z < -75) continue
            const score = barrel.z + 10
            if (score > bestScore) {
              bestScore = score
              targetX = barrel.x
              targetZ = barrel.z
            }
          }
          if (bestScore < -5000 && sim.bossLifecycle !== 'INTERMISSION' && sim.bossZ > -68.5) {
            targetX = 0
            targetZ = sim.bossZ
          }
          // Se o Boss está em distância de cerco (Z >= -16), prioriza mirar no Boss!
          if (
            sim.bossLifecycle !== 'INTERMISSION' &&
            sim.bossZ >= PLAYER_BRIDGE_BASE_POLICY.bossVanguardShieldEndZ
          ) {
            targetX = 0
            targetZ = sim.bossZ
          }
          const dxAim = targetX - spawnX
          const dzAim = targetZ - spawnZ
          sim.towerTargetYawRad[slotIdx] = Math.atan2(dxAim, -dzAim)
          sim.towerRecoilAmount[slotIdx] = 0.28
          const vz = -38
          const travelTime = Math.max(0.18, Math.abs(targetZ - spawnZ) / Math.abs(vz))
          freeTurretBolt.active = true
          freeTurretBolt.slotIndex = slotIdx
          freeTurretBolt.x = spawnX
          freeTurretBolt.y = 2.35
          freeTurretBolt.z = spawnZ
          freeTurretBolt.vz = vz
          freeTurretBolt.vx = (targetX - spawnX) / travelTime
          freeTurretBolt.damage = Math.max(
            6,
            lvl * 8 + Math.round(sim.shotProfile.damagePerShot * 0.65 * lvl),
          )
          sim.towerShotsFiredCount += 1
        }
      }
    }

    for (const tBolt of sim.alliedTowerBolts) {
      if (!tBolt.active) continue
      tBolt.x += tBolt.vx * clampedDt
      tBolt.z += tBolt.vz * clampedDt
      if (tBolt.z < BRIDGE_3D_DIMENSIONS.zFortressLine) {
        tBolt.active = false
        continue
      }

      let hitTarget = false
      for (const barrel of sim.barrels) {
        if (!barrel.active) continue
        if (Math.abs(tBolt.z - barrel.z) < 1.65 && Math.abs(tBolt.x - barrel.x) < 1.45) {
          barrel.hp -= tBolt.damage
          barrel.explosionFlashMs = 160
          tBolt.active = false
          hitTarget = true
          damageDealtThisFrame += Math.min(tBolt.damage, 5)
          if (barrel.hp <= 0) {
            sim.towerKillsCount += 1
            coinsEarnedThisFrame += 4
            barrel.z = -80 - nextSimRandom(sim) * 14
            barrel.maxHp = 112 + (sim.sectorIndex - 1) * 45
            barrel.hp = barrel.maxHp
            barrel.active = true
            barrel.explosionFlashMs = 200
            if (sim.towerKillsCount % 2 === 0) {
              const towerReinforce = Math.max(3, alliedTowerStats.totalLevel * 2)
              callbacks.onSideRouteReward(
                'LEFT',
                towerReinforce,
                `🗼 Torre Aliada Abateu Mini-Boss (+${towerReinforce} 🛡️)`,
              )
            }
          }
          break
        }
      }
      if (hitTarget) continue

      for (const en of sim.enemies) {
        const hitRadiusX = en.isMiniBoss ? 1.7 : 1.2
        const hitDepthZ = en.isMiniBoss ? 1.8 : 1.3
        if (Math.abs(tBolt.z - en.z) < hitDepthZ && Math.abs(tBolt.x - en.x) < hitRadiusX) {
          en.hp -= tBolt.damage
          en.hitFlashMs = 160
          tBolt.active = false
          hitTarget = true
          damageDealtThisFrame += Math.min(tBolt.damage, 4)
          if (en.hp <= 0) {
            sim.towerKillsCount += 1
            coinsEarnedThisFrame += en.isMiniBoss ? 5 : 2
            en.z = -84 - nextSimRandom(sim) * 16
            en.x = ((en.id % 4) - 1.5) * 1.6 + (nextSimRandom(sim) - 0.5) * 0.45
            en.maxHp = en.isMiniBoss
              ? 176 + (sim.sectorIndex - 1) * 90
              : 18 + (sim.sectorIndex - 1) * 10
            en.hp = en.maxHp
            if (sim.towerKillsCount % 2 === 0) {
              const towerReinforce = Math.max(3, alliedTowerStats.totalLevel * 2)
              callbacks.onSideRouteReward(
                'LEFT',
                towerReinforce,
                `🗼 Torre Aliada Reforçou Esquadrão (+${towerReinforce} 🛡️)`,
              )
            }
          }
          break
        }
      }
      if (hitTarget) continue

      if (
        sim.bossLifecycle !== 'INTERMISSION' &&
        sim.bossZ > -68.5 &&
        Math.abs(tBolt.z - sim.bossZ) < 3.6 &&
        Math.abs(tBolt.x) < 3.6
      ) {
        const isVanguardShielded =
          sim.bossZ < PLAYER_BRIDGE_BASE_POLICY.bossVanguardShieldEndZ
        const effectiveTowerBossDmg = isVanguardShielded
          ? Math.max(
              1,
              Math.round(
                tBolt.damage *
                  PLAYER_BRIDGE_BASE_POLICY.bossVanguardDamageMultiplier,
              ),
            )
          : tBolt.damage
        const vanguardHpFloor = isVanguardShielded
          ? Math.max(
              18,
              Math.round(
                sim.bossMaxHp *
                  PLAYER_BRIDGE_BASE_POLICY.bossVanguardMinHpRatio,
              ),
            )
          : 1
        const minBossHpFloor = input.isBattlePhase
          ? Math.max(18, Math.round(sim.bossMaxHp * 0.2))
          : vanguardHpFloor
        sim.bossHp = Math.max(minBossHpFloor, sim.bossHp - effectiveTowerBossDmg)
        sim.bossHitFlashMs = 150
        tBolt.active = false
        damageDealtThisFrame += Math.min(effectiveTowerBossDmg, 6)
      }
    }
  }

  // 7. V10 Fase 1: Evolução Autônoma da Base Inimiga + Torres de Debuff 3D + Escudo Aliado + Esquiva Real
  if (sim.playerTowerShieldCooldownMs > 0) {
    sim.playerTowerShieldCooldownMs = Math.max(0, sim.playerTowerShieldCooldownMs - timerDtMs)
  }
  if (!input.isBattlePhase) {
    sim.enemyEvolutionTimerMs = Math.max(0, sim.enemyEvolutionTimerMs - timerDtMs)
    if (
      sim.enemyEvolutionTimerMs <= 0 &&
      sim.enemyBaseLevel < ENEMY_LIVING_BASE_POLICY.maxEnemyBaseLevel
    ) {
      const evolved = evolveEnemyLivingBase(sim)
      callbacks.onEnemyBaseEvolved?.(evolved.enemyBaseLevel, evolved.activeTowersCount)
    }

    // Torres de Debuff ativas disparam projéteis mirados na posição em que o jogador estava no instante do disparo (sem teleguiar!)
    for (const tower of sim.enemyDebuffTowers) {
      if (tower.hitFlashMs > 0) {
        tower.hitFlashMs = Math.max(0, tower.hitFlashMs - dtMs)
      }
      if (!tower.active) continue
      tower.pulseCooldownMs -= timerDtMs
      if (tower.pulseCooldownMs <= 0) {
        tower.pulseCooldownMs = Math.max(
          2800,
          ENEMY_LIVING_BASE_POLICY.debuffPulseCooldownMs - (sim.enemyBaseLevel - 1) * 350,
        )
        const freeBolt = sim.enemyDebuffBolts.find((b) => !b.active)
        if (freeBolt) {
          const lossRatio =
            ENEMY_LIVING_BASE_POLICY.debuffLossRatioByLevel[
              Math.min(
                ENEMY_LIVING_BASE_POLICY.debuffLossRatioByLevel.length - 1,
                Math.max(0, sim.enemyBaseLevel - 1),
              )
            ] ?? 0.1
          const spawnX = tower.x
          const spawnZ = tower.z
          const targetXAtLaunch = Math.max(-4.8, Math.min(4.8, sim.heroWorldX))
          const travelSec = Math.max(
            0.5,
            (BRIDGE_3D_DIMENSIONS.zPlayerLine - spawnZ) /
              ENEMY_LIVING_BASE_POLICY.debuffBoltSpeedZ,
          )
          freeBolt.active = true
          freeBolt.x = spawnX
          freeBolt.y = 1.45
          freeBolt.z = spawnZ
          freeBolt.vx = (targetXAtLaunch - spawnX) / travelSec
          freeBolt.vz = ENEMY_LIVING_BASE_POLICY.debuffBoltSpeedZ
          freeBolt.lossRatio = lossRatio
          freeBolt.label = tower.label
          tower.hitFlashMs = 240
        }
      }
    }

    // Avançar projéteis de debuff inimigo (+Z, trajetória reta fixa) e testar interceptação, impacto real ou esquiva!
    for (const dBolt of sim.enemyDebuffBolts) {
      if (!dBolt.active) continue
      const prevZ = dBolt.z
      dBolt.x += (dBolt.vx ?? 0) * clampedDt
      dBolt.z += dBolt.vz * clampedDt

      // Torres Aliadas Nv.1+ interceptam feixes de debuff quando o escudo tático está pronto
      if (
        alliedTowerStats.activeTowersCount >= 1 &&
        sim.playerTowerShieldCooldownMs <= 0 &&
        dBolt.z >= BRIDGE_3D_DIMENSIONS.zPlayerLine - 5.5
      ) {
        dBolt.active = false
        sim.debuffBoltsInterceptedCount += 1
        sim.playerTowerShieldCooldownMs = alliedTowerStats.shieldInterceptCooldownMs
        callbacks.onDebuffBoltIntercepted?.(dBolt.label)
        continue
      }

      // Colisão física real na linha do jogador: SÓ acerta e reduz HP se atingir o raio horizontal do Herói!
      // Se o jogador se moveu e desviou da trajetória (|dBolt.x - sim.heroWorldX| > 1.25), o tiro passa reto sem tirar HP!
      if (
        prevZ <= BRIDGE_3D_DIMENSIONS.zPlayerLine + 0.65 &&
        dBolt.z >= BRIDGE_3D_DIMENSIONS.zPlayerLine - 0.65
      ) {
        const hitDistX = Math.abs(dBolt.x - sim.heroWorldX)
        if (hitDistX <= 1.25) {
          dBolt.active = false
          sim.enemyDebuffHitsCount += 1
          sim.playerHitFlashMs = 320
          callbacks.onEnemyDebuffTowerHit?.(dBolt.lossRatio, dBolt.label)
          continue
        }
      }

      // Se passou da linha do jogador sem acertar o Herói, o jogador DESVIOU com sucesso!
      if (dBolt.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 1.2) {
        dBolt.active = false
        sim.debuffBoltsDodgedCount += 1
      }
    }
  }

  if (
    coinsEarnedThisFrame > 0 ||
    damageDealtThisFrame > 0 ||
    attritionLossThisFrame > 0
  ) {
    callbacks.onEnemyKilled(
      coinsEarnedThisFrame,
      damageDealtThisFrame,
      attritionLossThisFrame,
    )
  }
}
