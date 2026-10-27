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
  computeShotProfile,
  DynamicShotProfile,
  laneNormToWorldX,
  resolveRouteFromWorldX,
} from './bridge3dPolicies'
import { formatArmy } from '../../domain/notation'

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
    const isMiniBoss = idx % 5 === 0
    const row = Math.floor(idx / 4)
    const col = (idx % 4) - 1.5
    const maxHp = isMiniBoss ? 176 : 18
    return {
      id: idx + 1,
      x: col * 1.6,
      z: -29 - row * 10.5 - (idx % 3) * 1.8,
      hp: maxHp,
      maxHp,
      isMiniBoss,
      speedZ: isMiniBoss ? 2.45 : 3.45 + (idx % 3) * 0.4,
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
    { id: 'rg_1', route: 'RIGHT', z: -28, bonusSoldiers: 50, label: '+50', collectedInPass: false },
    { id: 'rg_2', route: 'RIGHT', z: -48, bonusSoldiers: 99, label: '+99', collectedInPass: false },
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
    heroWorldX: laneNormToWorldX(-0.48),
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
    bossZ: -66,
    bossHitFlashMs: 0,
    bolts,
  }
}

/**
 * Aplica dano de cerco ao bloco congelado da Rota Direita (888 HP) e libera cargas
 * para os buffs mais potentes da Rota Direita quando o jogador resolve um Desafio Matemático (🧮 BÔNUS).
 */
export function applyMathBonusToRightWeapon(
  sim: Bridge3DSimState,
  siegeDamage = 296,
): { unlockedWeapon: boolean; bonusSoldiersFromPendingGate: number } {
  sim.mathChallengesSolved += 1
  sim.rightMathBonusCharges += 2

  const pendingBonus = sim.pendingRightGateBonus
  sim.pendingRightGateBonus = 0

  let unlockedWeapon = false
  if (!sim.rightFrozenWeapon.unlocked) {
    sim.rightFrozenWeapon.hp = Math.max(0, sim.rightFrozenWeapon.hp - siegeDamage)
    sim.rightFrozenWeapon.hitFlashMs = 260
    if (sim.rightFrozenWeapon.hp <= 0) {
      sim.rightFrozenWeapon.unlocked = true
      sim.rightWeaponLevel += 1
      unlockedWeapon = true
    }
  } else {
    sim.rightWeaponLevel += 1
    sim.rightFrozenWeapon.hitFlashMs = 260
    unlockedWeapon = true
  }

  return {
    unlockedWeapon,
    bonusSoldiersFromPendingGate: pendingBonus,
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

  // 1. Posição 3D horizontal livre do Herói e rota ativa (LEFT, CENTER, RIGHT)
  const targetWorldX = laneNormToWorldX(input.laneNormX)
  sim.heroWorldX += (targetWorldX - sim.heroWorldX) * Math.min(1, clampedDt * 15)
  sim.activeRoute = resolveRouteFromWorldX(sim.heroWorldX)

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
  const hasRightBoost = sim.rightFrozenWeapon.unlocked || sim.rightWeaponLevel > 0
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

  // Posição Z do Mega-Boss (aproxima-se no final da corrida ou no modo combate)
  sim.bossZ = -68 + input.progress * 42

  if (!input.isRunningOrBattle) {
    return
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
        Math.round(leftScaleBase * (0.65 + (i % 3) * 0.35)),
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

  // 4b. Rota Direita: Buffs SEMPRE evoluem ainda mais que os buffs normais da Rota Central,
  // todos trazem 🧮 FAZER CONTA, e o jogador SÓ ganha se resolver a conta matemática!
  const baseRightVals = [10, 50, 99, 99]
  const shouldScaleRight =
    input.currentArmy > 5 || sim.sectorIndex > 1 || sim.mathChallengesSolved > 0
  if (shouldScaleRight) {
    const refForce = Math.max(input.currentArmy, sim.bossMaxHp * 0.85, 25)
    const mathEvolutionMult = Math.pow(1.45, Math.min(25, sim.mathChallengesSolved))
    for (let i = 0; i < sim.rightGates.length; i++) {
      const g = sim.rightGates[i]
      // Escala de 1.85x a 4.4x acima da referência para ser sempre mais potente que os portões centrais!
      const potencyMult = (1.85 + i * 0.85) * mathEvolutionMult
      const evolvedRight = Math.max(
        baseRightVals[i] ?? 99,
        refForce * potencyMult,
      )
      g.bonusSoldiers = evolvedRight
      g.label = `+${formatArmy(evolvedRight, 'compact')}`
    }
  }

  // Avançar Altar 🧮 FAZER CONTA e Metralhadora 888 na Rota Direita (+Z) para não ficarem parados!
  sim.rightAltarZ += sideScrollSpeed * clampedDt
  if (
    !sim.rightAltarCollectedInPass &&
    sim.activeRoute === 'RIGHT' &&
    Math.abs(sim.rightAltarZ - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.5
  ) {
    sim.rightAltarCollectedInPass = true
    const targetBonus = sim.rightGates[2]?.bonusSoldiers ?? 99
    sim.pendingRightGateBonus = Math.max(sim.pendingRightGateBonus, targetBonus)
    if (sim.timeInRightRouteSec >= 0.85 && sim.rightRoutePromptCooldownMs <= 0) {
      sim.rightRoutePromptCooldownMs = 4500
      callbacks.onRequireMathChallenge?.(sim.pendingRightGateBonus, '🧮 BÔNUS FAZER CONTA')
    }
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
    sim.rightFrozenWeapon.collectedInPass = true
    if (sim.rightFrozenWeapon.unlocked || sim.rightMathBonusCharges > 0) {
      if (sim.rightMathBonusCharges > 0 && !sim.rightFrozenWeapon.unlocked) {
        sim.rightMathBonusCharges -= 1
      }
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
      // Sem fazer conta: não ganha a arma de graça, abre o Desafio Matemático!
      const weaponPending = Math.max(
        sim.rightGates[2]?.bonusSoldiers ?? 99,
        input.currentArmy * 1.8,
      )
      sim.pendingRightGateBonus = Math.max(sim.pendingRightGateBonus, weaponPending)
      if (sim.timeInRightRouteSec >= 0.85 && sim.rightRoutePromptCooldownMs <= 0) {
        sim.rightRoutePromptCooldownMs = 4500
        callbacks.onRequireMathChallenge?.(sim.pendingRightGateBonus, '🔥 METRALHADORA 888')
      }
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
    sim.rightFrozenWeapon.unlocked = false
    sim.rightFrozenWeapon.collectedInPass = false
  }

  for (const g of sim.rightGates) {
    g.z += sideScrollSpeed * clampedDt
    if (
      !g.collectedInPass &&
      sim.activeRoute === 'RIGHT' &&
      Math.abs(g.z - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.25
    ) {
      g.collectedInPass = true
      // REGRA DE OURO DO USUÁRIO: Na Rota Direita, você SÓ ganha os buffs potentes se fizer a conta matemática!
      if (sim.rightMathBonusCharges > 0) {
        sim.rightMathBonusCharges -= 1
        callbacks.onSideRouteReward(
          'RIGHT',
          g.bonusSoldiers,
          `🧮 Super Buff ${g.label} (Conta Resolvida!)`,
        )
      } else {
        // Sem carga de conta resolvida: 0 soldados grátis, guarda o super-buff pendente e abre a conta!
        sim.pendingRightGateBonus = Math.max(sim.pendingRightGateBonus, g.bonusSoldiers)
        if (sim.timeInRightRouteSec >= 0.85 && sim.rightRoutePromptCooldownMs <= 0) {
          sim.rightRoutePromptCooldownMs = 4500
          callbacks.onRequireMathChallenge?.(sim.pendingRightGateBonus, g.label)
        }
      }
    }
    if (g.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
      g.z -= 60.0
      g.collectedInPass = false
    }
  }

  // Se o jogador tocou em algum buff/altar/metralhadora da Rota Direita antes de completar 0.85s na rota,
  // dispara o Desafio Matemático assim que o jogador permanecer >= 0.85s na rota.
  if (
    sim.activeRoute === 'RIGHT' &&
    sim.pendingRightGateBonus > 0 &&
    sim.rightMathBonusCharges === 0 &&
    sim.timeInRightRouteSec >= 0.85 &&
    sim.rightRoutePromptCooldownMs <= 0
  ) {
    sim.rightRoutePromptCooldownMs = 4500
    callbacks.onRequireMathChallenge?.(
      sim.pendingRightGateBonus,
      `+${formatArmy(sim.pendingRightGateBonus, 'compact')}`,
    )
  }

  // 5. Movimento dos Projéteis Retos (-Z) e Colisões 3D nas 3 Rotas
  let activeCount = 0
  let coinsEarnedThisFrame = 0
  let damageDealtThisFrame = 0

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
        if (sim.rightMathBonusCharges > 0) {
          sim.rightFrozenWeapon.unlocked = true
          const unlockWepBonus = Math.max(15, Math.round(input.currentArmy * 0.5))
          callbacks.onSideRouteReward(
            'RIGHT',
            unlockWepBonus,
            `🔥 Metralhadora 888 Desbloqueada! +${formatArmy(unlockWepBonus, 'compact')}`,
          )
        } else {
          // Precisa resolver a conta para destravar definitivamente a Metralhadora da Rota Direita!
          sim.rightFrozenWeapon.hp = 1
          if (sim.timeInRightRouteSec >= 0.5 && sim.rightRoutePromptCooldownMs <= 0) {
            sim.rightRoutePromptCooldownMs = 4500
            sim.pendingRightGateBonus = Math.max(
              sim.pendingRightGateBonus,
              sim.rightGates[2]?.bonusSoldiers ?? 99,
            )
            callbacks.onRequireMathChallenge?.(sim.pendingRightGateBonus, '🔥 METRALHADORA 888')
          }
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

      // 5e. Colisão com o Mega-Boss do Setor
      if (Math.abs(bolt.z - sim.bossZ) < 3.4 && Math.abs(bolt.x) < 3.4) {
        const effectiveBossDmg =
          input.progress >= 0.45 || input.isBattlePhase
            ? bolt.damage
            : Math.max(1, Math.ceil(bolt.damage * 0.25))
        // No Modo Campanha (!infiniteBridgeMode) ou durante a fase BATTLE,
        // o Mega-Boss mantém uma reserva blindada (20% HP) para o embate final na muralha,
        // garantindo que sim.sectorIndex nunca dessincronize do HUD!
        const minBossHpFloor =
          !input.infiniteBridgeMode || input.isBattlePhase
            ? Math.max(18, Math.round(sim.bossMaxHp * 0.2))
            : 0
        sim.bossHp = Math.max(minBossHpFloor, sim.bossHp - effectiveBossDmg)
        sim.bossHitFlashMs = 160
        bolt.active = false
        damageDealtThisFrame += Math.min(effectiveBossDmg, 6)
        if (sim.bossHp <= 0 && !input.isBattlePhase) {
          sim.sectorIndex += 1
          const nextBossMax = Math.max(
            150,
            Math.min(
              Math.round(150 * Math.pow(1.85, sim.sectorIndex - 1)),
              Math.round(input.currentArmy * 12),
            ),
            Math.round(input.currentArmy * 1.85),
          )
          sim.bossMaxHp = nextBossMax
          sim.bossHp = nextBossMax
          const sectorReward = Math.max(
            10 + sim.sectorIndex * 5,
            Math.round(input.currentArmy * 0.12),
          )
          // Reativar barris para o novo setor
          for (const barrel of sim.barrels) {
            barrel.active = true
            barrel.maxHp = Math.max(
              112 + (sim.sectorIndex - 1) * 45,
              Math.round(nextBossMax * 0.08),
            )
            barrel.hp = barrel.maxHp
          }
          callbacks.onSectorBossDefeated(sim.sectorIndex, sectorReward)
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
  let attritionLossThisFrame = 0
  for (const en of sim.enemies) {
    en.z += en.speedZ * clampedDt
    if (en.z >= BRIDGE_3D_DIMENSIONS.zPlayerLine - 0.6) {
      // Se o monstro alcançar a linha do jogador, causa dano real de contato!
      const isDirectHitOnHero =
        sim.activeRoute === 'CENTER' && Math.abs(en.x - sim.heroWorldX) < 2.6
      const contactDmg = isDirectHitOnHero
        ? en.contactDamage
        : Math.max(1, Math.floor(en.contactDamage * 0.5))
      attritionLossThisFrame += contactDmg
      sim.playerHitFlashMs = 280
      // Respawn lá no fundo da ponte perto do castelo
      en.z = -84 - nextSimRandom(sim) * 14
      en.maxHp = en.isMiniBoss
        ? 176 + (sim.sectorIndex - 1) * 90
        : 18 + (sim.sectorIndex - 1) * 10
      en.hp = en.maxHp
    }
  }

  if (
    coinsEarnedThisFrame > 0 ||
    damageDealtThisFrame > 0 ||
    attritionLossThisFrame > 0
  ) {
    callbacks.onEnemyKilled(
      coinsEarnedThisFrame,
      Math.max(1, damageDealtThisFrame),
      attritionLossThisFrame,
    )
  }
}
