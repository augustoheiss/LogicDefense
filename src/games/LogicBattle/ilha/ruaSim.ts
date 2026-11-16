import { applyGateWithRemainder, clampArmy } from '../domain/armyMath'
import { RIGHT_CORRIDOR_TIER_BUFF_POLICIES } from '../run/bridge3d/bridge3dPolicies'
import { Gate } from '../types'

export const RUA = {
  startZ: 0,
  endZ: 40,
  halfWidth: 3,
  gateZ: 20,
  gateDepth: 2,
  speed: 8,
} as const

const PLUS_TEN: Gate = {
  id: 'arco-mais-10',
  op: '+',
  operand: { value: 10, num: 10, den: 1 },
  label: '+10',
  readingTimeMs: 0,
}

export const ENEMY_COUNT = 20

export const COMBAT = {
  enemySpeed: 2.2,
  hitRadius: 0.9,
  hitDamage: 3,
  aggroZ: 22,
  shootRange: 14,
  shootDot: 0.5,
  shootCooldown: 0.45,
  body: 0.35,
  slowScale: 0.1,
} as const

export interface Obstacle {
  x: number
  z: number
  hx: number
  hz: number
}

export const OBSTACLES: readonly Obstacle[] = [
  { x: -1.65, z: 12, hx: 1.15, hz: 0.7 },
  { x: 1.65, z: 26, hx: 1.15, hz: 0.7 },
  { x: -1.55, z: 33, hx: 1.05, hz: 0.65 },
]

export interface RuaEnemy {
  id: number
  x: number
  z: number
  alive: boolean
}

export interface RuaInput {
  forward: boolean
  back: boolean
  strafe: -1 | 0 | 1
}

export interface RuaState {
  x: number
  z: number
  yaw: number
  army: number
  gateApplied: boolean
  finished: boolean
  defeated: boolean
  aggro: boolean
  shootCooldown: number
  enemiesAlive: number
  enemies: RuaEnemy[]
}

function createEnemies(): RuaEnemy[] {
  return Array.from({ length: ENEMY_COUNT }, (_, index) => ({
    id: index,
    x: -2 + (index % 5) * 1,
    z: 42 + Math.floor(index / 5) * 1.1,
    alive: true,
  }))
}

export function createRua(): RuaState {
  const enemies = createEnemies()
  return {
    x: 0,
    z: 0,
    yaw: 0,
    army: 10,
    gateApplied: false,
    finished: false,
    defeated: false,
    aggro: false,
    shootCooldown: 0,
    enemiesAlive: enemies.length,
    enemies,
  }
}

function overlapsGate(z0: number, z1: number): boolean {
  const lo = Math.min(z0, z1)
  const hi = Math.max(z0, z1)
  return hi >= RUA.gateZ - RUA.gateDepth && lo <= RUA.gateZ + RUA.gateDepth
}

function overlapsObstacle(x: number, z: number): boolean {
  return OBSTACLES.some(
    (obstacle) =>
      Math.abs(x - obstacle.x) < obstacle.hx + COMBAT.body &&
      Math.abs(z - obstacle.z) < obstacle.hz + COMBAT.body,
  )
}

function countAlive(enemies: readonly RuaEnemy[]): number {
  return enemies.reduce((total, enemy) => total + (enemy.alive ? 1 : 0), 0)
}

export function stepRua(
  state: RuaState,
  input: RuaInput,
  dtSec: number,
  timeScale = 1,
): RuaState {
  if (state.defeated || state.finished) return state
  const scale = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 0
  const dt = (Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0) * scale
  const yaw = state.yaw
  const drive = (input.forward ? 1 : 0) - (input.back ? 1 : 0)
  const distance = RUA.speed * dt
  const fx = -Math.sin(yaw)
  const fz = Math.cos(yaw)
  const rx = -Math.cos(yaw)
  const rz = -Math.sin(yaw)
  let mx = fx * drive + rx * input.strafe
  let mz = fz * drive + rz * input.strafe
  const mag = Math.hypot(mx, mz)
  if (mag > 1) {
    mx /= mag
    mz /= mag
  }
  // +x fica na esquerda da tela quando a câmera olha no sentido do yaw.
  const zRaw = state.z + mz * distance
  const xRaw = state.x + mx * distance
  let z = Math.min(RUA.endZ, Math.max(RUA.startZ, zRaw))
  let x = Math.min(RUA.halfWidth, Math.max(-RUA.halfWidth, xRaw))
  if (overlapsObstacle(x, z)) {
    if (!overlapsObstacle(state.x, z)) x = state.x
    else if (!overlapsObstacle(x, state.z)) z = state.z
    else {
      x = state.x
      z = state.z
    }
  }

  let army = state.army
  let gateApplied = state.gateApplied
  if (!gateApplied && overlapsGate(state.z, zRaw)) {
    army = applyGateWithRemainder(state.army, PLUS_TEN).nextArmy
    gateApplied = true
  }

  const aggro = state.aggro || z >= COMBAT.aggroZ
  const enemies = state.enemies.map((enemy) => ({ ...enemy }))
  for (const enemy of enemies) {
    if (!enemy.alive) continue
    const dx = x - enemy.x
    const dz = z - enemy.z
    const dist = Math.hypot(dx, dz)
    if (dist > COMBAT.hitRadius && aggro && dist > 0) {
      const step = Math.min(COMBAT.enemySpeed * dt, dist)
      enemy.x += (dx / dist) * step
      enemy.z += (dz / dist) * step
    }
    const after = Math.hypot(x - enemy.x, z - enemy.z)
    if (after <= COMBAT.hitRadius) {
      enemy.alive = false
      army = clampArmy(army - COMBAT.hitDamage)
    }
  }

  return {
    ...state,
    x,
    z,
    yaw,
    army,
    gateApplied,
    aggro,
    enemies,
    enemiesAlive: countAlive(enemies),
    shootCooldown: Math.max(0, state.shootCooldown - dt),
    finished: z >= RUA.endZ,
    defeated: army <= 0,
  }
}

export function restartLoop(state: RuaState): RuaState {
  if (state.defeated || !state.finished) return state
  const enemies = createEnemies()
  return {
    ...state,
    x: 0,
    z: 0,
    yaw: 0,
    gateApplied: false,
    finished: false,
    aggro: false,
    shootCooldown: 0,
    enemies,
    enemiesAlive: enemies.length,
  }
}

export function aimRua(state: RuaState, deltaYaw: number): RuaState {
  if (!Number.isFinite(deltaYaw) || deltaYaw === 0) return state
  return { ...state, yaw: state.yaw + deltaYaw }
}

export function shoot(state: RuaState): RuaState {
  if (state.defeated || state.shootCooldown > 0) return state
  const fx = -Math.sin(state.yaw)
  const fz = Math.cos(state.yaw)
  let target: RuaEnemy | null = null
  let best: number = COMBAT.shootRange
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    const dx = enemy.x - state.x
    const dz = enemy.z - state.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.05 || dist > best) continue
    const dot = (dx * fx + dz * fz) / dist
    if (dot < COMBAT.shootDot) continue
    target = enemy
    best = dist
  }
  if (!target) return { ...state, shootCooldown: COMBAT.shootCooldown }
  const hitId = target.id
  const enemies = state.enemies.map((enemy) =>
    enemy.id === hitId ? { ...enemy, alive: false } : enemy,
  )
  return {
    ...state,
    enemies,
    enemiesAlive: countAlive(enemies),
    shootCooldown: COMBAT.shootCooldown,
  }
}

export function applyTierPower(state: RuaState, tier: 1 | 2 | 3 | 4): RuaState {
  const spec = RIGHT_CORRIDOR_TIER_BUFF_POLICIES[tier]
  const alive = state.enemies.filter((enemy) => enemy.alive)
  const wipe =
    alive.length === 0
      ? 0
      : tier >= 4 || spec.enemyWipeRatio >= 1
        ? alive.length
        : Math.max(1, Math.round(alive.length * spec.enemyWipeRatio))
  const nearest = [...alive].sort((a, b) => {
    const da = (a.x - state.x) ** 2 + (a.z - state.z) ** 2
    const db = (b.x - state.x) ** 2 + (b.z - state.z) ** 2
    return da - db
  })
  const kill = new Set(nearest.slice(0, wipe).map((enemy) => enemy.id))
  const enemies = state.enemies.map((enemy) =>
    kill.has(enemy.id) ? { ...enemy, alive: false } : enemy,
  )
  const bonus = Math.max(Math.floor(state.army * spec.armyBonusRatio), spec.minFlatSoldiers)
  return {
    ...state,
    enemies,
    enemiesAlive: countAlive(enemies),
    army: clampArmy(state.army + bonus),
  }
}

export function pointerToTurn(clientX: number, width: number): -1 | 0 | 1 {
  if (width <= 0) return 0
  return clientX < width / 2 ? -1 : 1
}
