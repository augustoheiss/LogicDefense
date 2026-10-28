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
  computeSectorBossSpec,
  computeShotProfile,
  DynamicShotProfile,
  laneNormToWorldX,
  resolveRouteFromWorldX,
  RIGHT_CORRIDOR_TIMED_POLICIES,
} from './bridge3dPolicies'
import { formatArmy } from '../../domain/notation'

export type BossLifecycleState = 'MARCHING' | 'MELEE_CLASH' | 'INTERMISSION'

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
 * Garante movimento 100% contínuo sem saltos quando `activeSegmentIndex` avança.
 */
export function computeSegmentWorldZ(segZPosition: number, progress: number): number {
  return BRIDGE_3D_DIMENSIONS.zPlayerLine - 1.5 - (segZPosition - progress) * 94.0
}

export function createInitialBridge3DSimState(
  initialBossHp = 150,
  seed = 42,
): Bridge3DSimState {
  const baseBossHp = Math.max(150, initialBossHp)
  const initialRngState = (Math.floor(seed) ^ 0x9e3779b9) >>> 0 || 42
  const enemies: Enemy3DEntity[] = Array.from({ length: INITIAL_ENEMY_COUNT }, (_, idx) => {
    const isMiniBoss = idx === 7 || idx === 14
    const row = Math.floor(idx / 4)
    const col = (idx % 4) - 1.5
    const maxHp = isMiniBoss ? 176 : 14
    return {
      id: idx + 1,
      x: col * 1.6,
      z: -35 - row * 10.5 - (idx % 3) * 1.8,
      hp: maxHp,
      maxHp,
      isMiniBoss,
      speedZ: isMiniBoss ? 2.15 : 2.55 + (idx % 3) * 0.25,
      contactDamage: isMiniBoss ? 3 : 1,
      hitFlashMs: 0,
    }
  })

  const barrels: ExplosiveBarrel3DEntity[] = [
    { id: 1, x: -2.35, z: -27, hp: 112, maxHp: 112, active: true, explosionFlashMs: 0 },
    { id: 2, x: 2.35, z: -38, hp: 112, maxHp: 112, active: true, explosionFlashMs: 0 },
    { id: 3, x: -2.2, z: -50, hp: 112, maxHp: 112, active: true, explosionFlashMs: 0 },
    { id: 4, x: 2.2, z: -62, hp: 112, maxHp: 112, active: true, explosionFlashMs: 0 },
  ]

  const leftGates: SideRouteGate3DEntity[] = [
    { id: 'lg_0', route: 'LEFT', z: -18, bonusSoldiers: 1, label: '+1', collectedInPass: false },
    { id: 'lg_1', route: 'LEFT', z: -28, bonusSoldiers: 2, label: '+2', collectedInPass: false },
    { id: 'lg_2', route: 'LEFT', z: -38, bonusSoldiers: 1, label: '+1', collectedInPass: false },
    { id: 'lg_3', route: 'LEFT', z: -48, bonusSoldiers: 2, label: '+2', collectedInPass: false },
    { id: 'lg_4', route: 'LEFT', z: -58, bonusSoldiers: 3, label: '+3', collectedInPass: false },
  ]

  const rightGates: SideRouteGate3DEntity[] = [
    { id: 'rg_0', route: 'RIGHT', z: -12, bonusSoldiers: 10, label: '+10', collectedInPass: false },
    { id: 'rg_1', route: 'RIGHT', z: -28, bonusSoldiers: 25, label: '+25', collectedInPass: false },
    { id: 'rg_2', route: 'RIGHT', z: -48, bonusSoldiers: 50, label: '+50', collectedInPass: false },
    { id: 'rg_3', route: 'RIGHT', z: -58, bonusSoldiers: 99, label: '+99', collectedInPass: false },
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
    rightAltarZ: -18.0,
    rightAltarCollectedInPass: false,
    rightMathBonusCharges: 0,
    rightBuffActiveTimerMs: 0,
    rightBuffMaxTimerMs: 15000,
    mathChallengesSolved: 0,
    pendingRightGateBonus: 0,
    timeInRightRouteSec: 0,
    rightRoutePromptCooldownMs: 0,
    leftFrozenBlock: {
      hp: 5,
      maxHp: 5,
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
  }
}

/**
 * V8 Fase 2: Ativa por alguns segundos (12s a 24s conforme o grau da conta) as cores,
 * os buffs e a Metralhadora da Rota Direita quando o jogador resolve um Desafio Matemático (🧮).
 */
export function applyMathBonusToRightWeapon(
  sim: Bridge3DSimState,
  siegeDamage = 296,
  tier: 1 | 2 | 3 | 4 = 2,
): { unlockedWeapon: boolean; bonusSoldiersFromPendingGate: number; activeDurationMs: number } {
  sim.mathChallengesSolved += 1
  const durationMs = RIGHT_CORRIDOR_TIMED_POLICIES.durationMsByTier[tier] ?? 15000
  sim.rightBuffActiveTimerMs = durationMs
  sim.rightBuffMaxTimerMs = durationMs
  sim.rightMathBonusCharges = Math.max(2, Math.ceil(durationMs / 4000))

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

  return {
    unlockedWeapon,
    bonusSoldiersFromPendingGate: pendingBonus,
    activeDurationMs: durationMs,
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
  },
  callbacks: Bridge3DSimCallbacks,
): void {
  const clampedDt = Math.min(0.05, Math.max(0.001, dtSec))
  const dtMs = clampedDt * 1000
  const timerDtMs = Math.min(250, Math.max(1, dtSec * 1000))

  // 1. Posição 3D horizontal livre do Herói e rota ativa (LEFT, CENTER, RIGHT)
  const targetWorldX = laneNormToWorldX(input.laneNormX)
  sim.heroWorldX += (targetWorldX - sim.heroWorldX) * Math.min(1, clampedDt * 18)
  sim.activeRoute = resolveRouteFromWorldX(sim.heroWorldX)

  // V8 Fase 2: Decrementar janela ativa da Rota Direita em tempo real (timerDtMs). Quando zera, volta para gelo/cinza desativado!
  if (input.isRunningOrBattle && sim.rightBuffActiveTimerMs > 0) {
    sim.rightBuffActiveTimerMs = Math.max(0, sim.rightBuffActiveTimerMs - timerDtMs)
    sim.rightMathBonusCharges =
      sim.rightBuffActiveTimerMs > 0
        ? Math.max(1, Math.ceil(sim.rightBuffActiveTimerMs / 4000))
        : 0
    if (sim.rightBuffActiveTimerMs <= 0) {
      sim.rightFrozenWeapon.unlocked = false
    }
  } else if (sim.rightBuffActiveTimerMs <= 0) {
    sim.rightMathBonusCharges = 0
    sim.rightFrozenWeapon.unlocked = false
  }

  if (sim.activeRoute === 'RIGHT') {
    sim.timeInRightRouteSec += clampedDt
  } else {
    sim.timeInRightRouteSec = 0
  }
  if (sim.rightRoutePromptCooldownMs > 0) {
    sim.rightRoutePromptCooldownMs = Math.max(0, sim.rightRoutePromptCooldownMs - dtMs)
  }

  // 2. Perfil dinâmico de tiro escalado pelos pontos atuais + bônus de armas coletadas nas rotas laterais
  const baseProfile = computeShotProfile(input.currentArmy)
  const hasLeftBoost = sim.leftFrozenBlock.unlocked || sim.leftCannonLevel > 0
  const hasRightBoost = sim.rightBuffActiveTimerMs > 0 && (sim.rightFrozenWeapon.unlocked || sim.rightWeaponLevel > 0)
  const extraBarrels = (hasLeftBoost ? 1 : 0) + (hasRightBoost ? 1 : 0)
  const dmgMult =
    (hasRightBoost ? 2.0 + sim.rightWeaponLevel * 0.45 : 1.0) *
    (hasLeftBoost ? 1.15 + sim.leftCannonLevel * 0.15 : 1.0)
  const fireRateBonus = hasLeftBoost ? 1.6 + Math.min(2.4, sim.leftCannonLevel * 0.35) : 0

  sim.shotProfile = {
    ...baseProfile,
    damagePerShot: Math.max(1, baseProfile.damagePerShot * dmgMult),
    shotsPerSecond: Math.min(18, baseProfile.shotsPerSecond + fireRateBonus),
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

  if (!input.isRunningOrBattle) {
    return
  }

  let attritionLossThisFrame = 0
  let coinsEarnedThisFrame = 0
  let damageDealtThisFrame = 0

  // V8 Fase 3: Ciclo de Vida Real do Mega-Boss (MARCHING -> MELEE_CLASH -> INTERMISSION 7.5s com Caravana Dourada)
  const currentSectorSpec = computeSectorBossSpec(sim.sectorIndex)
  const meleeLineZ = BRIDGE_3D_DIMENSIONS.zPlayerLine - 2.8 // Z = +7.7 (frente do esquadrão)
  const marchDt = timerDtMs / 1000

  if (sim.bossLifecycle === 'INTERMISSION') {
    sim.bossHp = 0
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
    // Boss vivo: caminha continuamente em direção ao jogador (+Z) e golpeia pesado ao encostar!
    sim.bossArchetypeIndex = currentSectorSpec.archetype.index
    sim.bossArchetypeId = currentSectorSpec.archetype.id
    sim.bossArchetypeName = currentSectorSpec.archetype.namePt

    if (sim.bossZ < meleeLineZ) {
      sim.bossLifecycle = 'MARCHING'
      sim.bossZ = Math.min(
        meleeLineZ,
        sim.bossZ + currentSectorSpec.marchSpeedZ * marchDt,
      )
    } else {
      sim.bossZ = meleeLineZ
      sim.bossLifecycle = 'MELEE_CLASH'
      sim.bossMeleeCooldownMs -= timerDtMs
      if (sim.bossMeleeCooldownMs <= 0) {
        sim.bossMeleeCooldownMs = 1000
        const isPlayerInCenter = sim.activeRoute === 'CENTER'
        const strikeDmg = isPlayerInCenter
          ? currentSectorSpec.meleeDamagePerStrike
          : Math.max(3, Math.round(currentSectorSpec.meleeDamagePerStrike * 0.65))
        attritionLossThisFrame += strikeDmg
        sim.playerHitFlashMs = 360
        sim.bossHitFlashMs = 220
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
    }
  }

  // 4. Evolução Dinâmica & Movimento da Esteira nas Rotas Laterais (Esquerda e Direita)
  const sideScrollSpeed = 7.2

  // 4a. Rota Esquerda: Evoluir valores dos portões conforme exército/setor/canhão cresce
  const baseLeftVals = [1, 2, 1, 2, 3]
  const shouldScaleLeft =
    input.currentArmy > 5 || sim.sectorIndex > 1 || sim.leftCannonLevel > 0
  if (shouldScaleLeft) {
    const leftScaleBase = Math.max(
      2,
      input.currentArmy * (0.14 + sim.leftCannonLevel * 0.06) +
        (sim.sectorIndex - 1) * 5 +
        sim.leftCannonLevel * 3,
    )
    for (let i = 0; i < sim.leftGates.length; i++) {
      const g = sim.leftGates[i]
      const evolvedLeft = Math.max(
        baseLeftVals[i] ?? 1,
        Math.round(leftScaleBase * (0.6 + i * 0.28)),
      )
      g.bonusSoldiers = evolvedLeft
      g.label = `+${formatArmy(evolvedLeft, 'compact')}`
    }
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
    const cannonSoldiers = Math.max(
      3 + sim.leftCannonLevel * 2,
      Math.round(input.currentArmy * 0.22),
    )
    callbacks.onSideRouteReward(
      'LEFT',
      cannonSoldiers,
      `❄️ Canhão Nv.${sim.leftCannonLevel} Coletado! +${formatArmy(cannonSoldiers, 'compact')}`,
    )
  }
  if (sim.leftFrozenBlock.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
    sim.leftFrozenBlock.z -= 60.0
    const nextLvl = sim.leftCannonLevel + 1
    const nextMaxHp = Math.max(
      5,
      Math.round(5 * nextLvl + input.currentArmy * 0.35),
    )
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
      const effectiveBonus =
        sim.leftFrozenBlock.unlocked || sim.leftCannonLevel > 0
          ? Math.max(g.bonusSoldiers + 1, Math.round(g.bonusSoldiers * (1 + sim.leftCannonLevel * 0.25)))
          : g.bonusSoldiers
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

  // 4b. Rota Direita: Buffs evoluem de forma equilibrada sem efeito composto explosivo intra-passagem!
  const baseRightVals = [10, 25, 50, 99]
  const shouldScaleRight =
    input.currentArmy > 5 || sim.sectorIndex > 1 || sim.mathChallengesSolved > 0
  if (shouldScaleRight) {
    const refForce = Math.max(input.currentArmy, sim.bossMaxHp * 0.85, 25)
    const mathEvolutionMult = 1 + Math.min(12, sim.mathChallengesSolved) * 0.18
    for (let i = 0; i < sim.rightGates.length; i++) {
      const g = sim.rightGates[i]
      const potencyMult = (0.35 + i * 0.22) * mathEvolutionMult
      const targetRightVal = Math.max(
        baseRightVals[i] ?? 99,
        Math.round(refForce * potencyMult),
      )
      // Evitar que coletar o portão i multiplique instantaneamente o portão i+1 no mesmo passe ativo,
      // a menos que a escala do exército tenha mudado em mais de 4x (ex: novo setor ou salto exponencial).
      const isCollectingActiveRight =
        sim.activeRoute === 'RIGHT' && sim.rightBuffActiveTimerMs > 0
      const ratioChange =
        g.bonusSoldiers > 0 ? targetRightVal / g.bonusSoldiers : 999
      if (!isCollectingActiveRight || ratioChange > 4.0 || ratioChange < 0.25) {
        g.bonusSoldiers = targetRightVal
        g.label = `+${formatArmy(targetRightVal, 'compact')}`
      }
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
    const targetBonus = sim.rightGates[2]?.bonusSoldiers ?? 99
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
        input.currentArmy * 1.5,
      )
      callbacks.onSideRouteReward(
        'RIGHT',
        weaponBonus,
        `🔥 Metralhadora Nv.${sim.rightWeaponLevel} Coletada! +${formatArmy(weaponBonus, 'compact')}`,
      )
    } else {
      // V8 Fase 2: Rota Direita cinza/congelada por padrão — permanece visível/congelada sem coletar nem abrir modal!
      const weaponPending = Math.max(
        sim.rightGates[2]?.bonusSoldiers ?? 99,
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
          `⚡ Super Buff ${g.label} (${remSec}s Ativo!)`,
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

    // 5a. Colisão na Rota Esquerda: Pedestal/Canhão Congelado
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
        const unlockBonus = Math.max(3, Math.round(input.currentArmy * 0.12))
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

    // 5c. Colisão na Rota Central: Barris Explosivos (112 HP) com Detonação AoE
    if (boltRoute === 'CENTER') {
      let hitBarrel = false
      for (const barrel of sim.barrels) {
        if (!barrel.active) continue
        if (Math.abs(bolt.z - barrel.z) < 1.35 && Math.abs(bolt.x - barrel.x) < 1.25) {
          barrel.hp -= bolt.damage
          barrel.explosionFlashMs = 180
          bolt.active = false
          hitBarrel = true
          if (barrel.hp <= 0) {
            barrel.active = false
            barrel.explosionFlashMs = 450
            coinsEarnedThisFrame += 3
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
          }
          break
        }
      }
      if (hitBarrel) continue

      // 5d. Colisão na Rota Central: Horda Rubra e Mini-Bosses (176 HP)
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
          bolt.active = false
          hitEnemy = true
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
        const effectiveBossDmg = Math.max(1, bolt.damage)
        const minBossHpFloor = input.isBattlePhase
          ? Math.max(18, Math.round(sim.bossMaxHp * 0.2))
          : 0
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

  // 6. Avanço da Horda e Mini-Bosses (+Z) e Dano Real de Contato nos Soldados do Jogador
  let hordeContactLoss = 0
  for (const en of sim.enemies) {
    en.z += en.speedZ * clampedDt
    if (en.z >= BRIDGE_3D_DIMENSIONS.zPlayerLine - 0.6) {
      // Se o monstro alcançar a linha do jogador, causa dano real de contato!
      const isDirectHitOnHero =
        sim.activeRoute === 'CENTER' && Math.abs(en.x - sim.heroWorldX) < 2.6
      const contactDmg = isDirectHitOnHero
        ? en.contactDamage
        : Math.max(1, Math.floor(en.contactDamage * 0.5))
      hordeContactLoss += contactDmg
      sim.playerHitFlashMs = 280
      // Respawn lá no fundo da ponte perto do castelo
      en.z = -84 - nextSimRandom(sim) * 14
      en.maxHp = en.isMiniBoss
        ? 176 + (sim.sectorIndex - 1) * 90
        : 18 + (sim.sectorIndex - 1) * 10
      en.hp = en.maxHp
    }
  }
  if (hordeContactLoss > 0) {
    // Enquanto o Boss ainda está marchando (antes do MELEE_CLASH), a Horda drena o exército até o piso de 3 soldados,
    // permitindo que o Boss alcance a linha do jogador (+7.7) e desfira o golpe corpo a corpo fatal!
    const effectiveHordeLoss =
      sim.bossLifecycle === 'MELEE_CLASH'
        ? hordeContactLoss
        : Math.min(hordeContactLoss, Math.max(0, input.currentArmy - 3))
    attritionLossThisFrame += effectiveHordeLoss
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
