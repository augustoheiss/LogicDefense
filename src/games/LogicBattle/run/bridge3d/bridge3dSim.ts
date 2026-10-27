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
}

export interface Bridge3DSimCallbacks {
  onEnemyKilled: (coinsDelta: number, damageDealt: number, attritionLoss: number) => void
  onSideRouteReward: (
    route: 'LEFT' | 'RIGHT',
    soldiersDelta: number,
    reasonLabel: string,
  ) => void
  onSectorBossDefeated: (newSector: number, bonusSoldiers: number) => void
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
      x: col * 2.1,
      z: -26 - row * 12 - (idx % 3) * 2.0,
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
    { id: 'lg_0', route: 'LEFT', z: -22, bonusSoldiers: 1, label: '+1', collectedInPass: false },
    { id: 'lg_1', route: 'LEFT', z: -34, bonusSoldiers: 2, label: '+2', collectedInPass: false },
    { id: 'lg_2', route: 'LEFT', z: -46, bonusSoldiers: 1, label: '+1', collectedInPass: false },
    { id: 'lg_3', route: 'LEFT', z: -58, bonusSoldiers: 2, label: '+2', collectedInPass: false },
    { id: 'lg_4', route: 'LEFT', z: -70, bonusSoldiers: 3, label: '+3', collectedInPass: false },
  ]

  const rightGates: SideRouteGate3DEntity[] = [
    { id: 'rg_0', route: 'RIGHT', z: -26, bonusSoldiers: 10, label: '+10', collectedInPass: false },
    { id: 'rg_1', route: 'RIGHT', z: -40, bonusSoldiers: 50, label: '+50', collectedInPass: false },
    { id: 'rg_2', route: 'RIGHT', z: -54, bonusSoldiers: 99, label: '+99', collectedInPass: false },
    { id: 'rg_3', route: 'RIGHT', z: -68, bonusSoldiers: 99, label: '+99', collectedInPass: false },
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
    leftFrozenBlock: {
      hp: 5,
      maxHp: 5,
      z: -10.5,
      unlocked: false,
      hitFlashMs: 0,
    },
    rightFrozenWeapon: {
      hp: 888,
      maxHp: 888,
      z: -12.5,
      unlocked: false,
      hitFlashMs: 0,
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
 * Aplica dano de cerco ao bloco congelado da Rota Direita (888 HP) quando o jogador
 * resolve um Desafio Matemático (🧮 BÔNUS).
 */
export function applyMathBonusToRightWeapon(
  sim: Bridge3DSimState,
  siegeDamage = 296,
): boolean {
  if (sim.rightFrozenWeapon.unlocked) return false
  sim.rightFrozenWeapon.hp = Math.max(0, sim.rightFrozenWeapon.hp - siegeDamage)
  sim.rightFrozenWeapon.hitFlashMs = 260
  if (sim.rightFrozenWeapon.hp <= 0) {
    sim.rightFrozenWeapon.unlocked = true
    return true
  }
  return false
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

  // 2. Perfil dinâmico de tiro escalado pelos pontos atuais + bônus de armas desbloqueadas nas rotas laterais
  const baseProfile = computeShotProfile(input.currentArmy)
  const extraBarrels =
    (sim.leftFrozenBlock.unlocked ? 1 : 0) + (sim.rightFrozenWeapon.unlocked ? 1 : 0)
  const dmgMult = sim.rightFrozenWeapon.unlocked ? 2.0 : 1.0
  const fireRateBonus = sim.leftFrozenBlock.unlocked ? 1.6 : 0

  sim.shotProfile = {
    ...baseProfile,
    damagePerShot: Math.max(1, Math.round(baseProfile.damagePerShot * dmgMult)),
    shotsPerSecond: Math.min(16, baseProfile.shotsPerSecond + fireRateBonus),
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

  // 4. Esteira de Portões Laterais (Rota Esquerda +1/+2 e Rota Direita +10/+50/+99)
  const sideScrollSpeed = 7.2
  for (const g of sim.leftGates) {
    g.z += sideScrollSpeed * clampedDt
    if (
      !g.collectedInPass &&
      sim.activeRoute === 'LEFT' &&
      Math.abs(g.z - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.25
    ) {
      g.collectedInPass = true
      const effectiveBonus = sim.leftFrozenBlock.unlocked
        ? g.bonusSoldiers + 1
        : g.bonusSoldiers
      callbacks.onSideRouteReward('LEFT', effectiveBonus, `Rota Esquerda ${g.label}`)
    }
    if (g.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
      g.z -= 60.0
      g.collectedInPass = false
    }
  }

  for (const g of sim.rightGates) {
    g.z += sideScrollSpeed * clampedDt
    if (
      !g.collectedInPass &&
      sim.activeRoute === 'RIGHT' &&
      Math.abs(g.z - BRIDGE_3D_DIMENSIONS.zPlayerLine) <= 1.25
    ) {
      g.collectedInPass = true
      // Se a arma congelada 888 HP já foi quebrada, concede o valor integral (+10/+50/+99);
      // caso contrário, concede um bônus parcial de flanco (+3/+8/+15)
      const effectiveBonus = sim.rightFrozenWeapon.unlocked
        ? g.bonusSoldiers
        : Math.max(3, Math.round(g.bonusSoldiers * 0.15))
      callbacks.onSideRouteReward(
        'RIGHT',
        effectiveBonus,
        sim.rightFrozenWeapon.unlocked
          ? `Arsenal Dourado ${g.label}`
          : `Flanco Direito +${effectiveBonus}`,
      )
    }
    if (g.z > BRIDGE_3D_DIMENSIONS.zPlayerLine + 3.0) {
      g.z -= 56.0
      g.collectedInPass = false
    }
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

    // 5a. Colisão na Rota Esquerda: Pedestal/Canhão Congelado (5 HP)
    if (
      boltRoute === 'LEFT' &&
      !sim.leftFrozenBlock.unlocked &&
      Math.abs(bolt.z - sim.leftFrozenBlock.z) < 1.8 &&
      Math.abs(bolt.x - BRIDGE_3D_ROUTES.LEFT.xCenter) < 2.2
    ) {
      sim.leftFrozenBlock.hp = Math.max(0, sim.leftFrozenBlock.hp - bolt.damage)
      sim.leftFrozenBlock.hitFlashMs = 160
      bolt.active = false
      if (sim.leftFrozenBlock.hp <= 0) {
        sim.leftFrozenBlock.unlocked = true
        callbacks.onSideRouteReward('LEFT', 3, 'Canhão Gélido Desbloqueado! +3')
      }
      continue
    }

    // 5b. Colisão na Rota Direita: Arma Multi-Cano Congelada (888 HP)
    if (
      boltRoute === 'RIGHT' &&
      !sim.rightFrozenWeapon.unlocked &&
      Math.abs(bolt.z - sim.rightFrozenWeapon.z) < 2.1 &&
      Math.abs(bolt.x - BRIDGE_3D_ROUTES.RIGHT.xCenter) < 2.4
    ) {
      sim.rightFrozenWeapon.hp = Math.max(0, sim.rightFrozenWeapon.hp - bolt.damage)
      sim.rightFrozenWeapon.hitFlashMs = 160
      bolt.active = false
      if (sim.rightFrozenWeapon.hp <= 0) {
        sim.rightFrozenWeapon.unlocked = true
        callbacks.onSideRouteReward('RIGHT', 15, 'Metralhadora 888 Desbloqueada! +15')
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
            en.x = ((en.id % 4) - 1.5) * 2.1 + (nextSimRandom(sim) - 0.5) * 0.6
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
        // Durante a fase BATTLE (choque final na muralha), mantém piso de HP ativo
        // para que sim.sectorIndex nunca avance nem dessincronize do HUD no meio da animação final!
        const minBossHpFloor = input.isBattlePhase
          ? Math.max(18, Math.round(sim.bossMaxHp * 0.14))
          : 0
        sim.bossHp = Math.max(minBossHpFloor, sim.bossHp - effectiveBossDmg)
        sim.bossHitFlashMs = 160
        bolt.active = false
        damageDealtThisFrame += Math.min(effectiveBossDmg, 6)
        if (sim.bossHp <= 0 && !input.isBattlePhase) {
          sim.sectorIndex += 1
          const nextBossMax = Math.round(150 * Math.pow(1.85, sim.sectorIndex - 1))
          sim.bossMaxHp = nextBossMax
          sim.bossHp = nextBossMax
          const sectorReward = 10 + sim.sectorIndex * 5
          // Reativar barris para o novo setor
          for (const barrel of sim.barrels) {
            barrel.active = true
            barrel.maxHp = 112 + (sim.sectorIndex - 1) * 45
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
