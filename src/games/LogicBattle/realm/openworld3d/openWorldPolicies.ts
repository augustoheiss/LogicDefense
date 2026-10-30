// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/realm/openworld3d/openWorldPolicies.ts
// MASTER_PLAN_V10 (Fase 2): Políticas e Motor Determinístico 60Hz do Mundo Aberto 3D
// da Base Principal (Estilo Logic Friction Evoluído + Guerra Territorial Bidirecional)
// ──────────────────────────────────────────────────────────────────────────────

import { CitadelBuildingId } from '../../types'
import { EngineId } from '../../engines/engineContract'

export interface Vec2XZ {
  x: number
  z: number
}

/**
 * Posições 3D das 5 Construções da Cidadela Aliada no Platô Verde-Menta (Oeste: X < -2).
 */
export const OPEN_WORLD_CITADEL_3D_COORDS: Readonly<
  Record<CitadelBuildingId, { x: number; z: number; color: string; roofColor: string }>
> = {
  quartel: { x: -20.5, z: -1.5, color: '#e7dcc8', roofColor: '#10b981' },
  observatorio: { x: -11.0, z: -4.2, color: '#e7dcc8', roofColor: '#eab308' },
  forja: { x: -8.5, z: 3.5, color: '#e7dcc8', roofColor: '#0284c7' },
  academia: { x: -19.8, z: 8.2, color: '#e7dcc8', roofColor: '#14b8a6' },
  mina_resto: { x: -3.8, z: 8.6, color: '#8d775f', roofColor: '#facc15' },
}

/**
 * 4 Torres Defensivas da Fronteira da Cidadela no Mundo Aberto 3D (sincronizadas com playerBridgeTowerLevels).
 */
export const OPEN_WORLD_FRONTIER_TOWER_SLOTS: readonly {
  slotIndex: 0 | 1 | 2 | 3
  id: string
  x: number
  z: number
}[] = [
  { slotIndex: 0, id: 'ow_tower_nw', x: -2.7, z: -8.4 },
  { slotIndex: 1, id: 'ow_tower_nc', x: -3.1, z: -5.2 },
  { slotIndex: 2, id: 'ow_tower_sc', x: -2.2, z: -2.2 },
  { slotIndex: 3, id: 'ow_tower_sw', x: 2.3, z: 7.1 },
]

/**
 * Coordenadas 3D das 12 Províncias/Fortalezas no Mundo Aberto 3D (mapeadas do layout isométrico).
 */
export const OPEN_WORLD_REGION_3D_COORDS: Readonly<Record<string, Vec2XZ>> = {
  reg_cidadela_origem: { x: -2.2, z: 0.2 },
  reg_ponte_leste: { x: 4.5, z: 0.6 },
  reg_vila_balanca: { x: 6.8, z: 7.4 },
  reg_forte_esteiras: { x: 5.8, z: -6.8 },
  reg_bastião_pedra: { x: 12.2, z: 4.4 },
  reg_porto_fiorde: { x: 10.4, z: -11.2 },
  reg_glaciar_meio: { x: 12.8, z: -3.8 },
  reg_pico_precedencia: { x: 17.2, z: -13.4 },
  reg_oasis_decimais: { x: 18.6, z: -7.2 },
  reg_dunas_ioio: { x: 23.8, z: -10.8 },
  reg_trono_solar: { x: 19.5, z: 0.8 },
  reg_cratera_sinais: { x: 24.2, z: -3.5 },
}

/**
 * Portais 3D das 6 Engines na Arena Principal do Mundo Aberto.
 */
export const OPEN_WORLD_ENGINE_PORTALS: readonly {
  engineId: EngineId
  x: number
  z: number
  color: string
}[] = [
  { engineId: 'ponte_portoes', x: -15.5, z: -11.5, color: '#38bdf8' },
  { engineId: 'cerco_torres', x: -10.5, z: -12.2, color: '#f59e0b' },
  { engineId: 'forte_bandeira', x: -5.5, z: -12.2, color: '#10b981' },
  { engineId: 'pedreira_rei', x: -0.5, z: -12.2, color: '#eab308' },
  { engineId: 'arena_ondas', x: 4.5, z: -12.2, color: '#ec4899' },
  { engineId: 'serpente_numeros', x: 9.5, z: -12.2, color: '#a855f7' },
]

export interface AlliedExpedition3D {
  id: string
  targetRegionId: string
  troopsCommitted: number
  isSurgical: boolean
  startX: number
  startZ: number
  targetX: number
  targetZ: number
  x: number
  z: number
  progress: number
  active: boolean
}

export interface EnemyInvasionWave3D {
  id: string
  originRegionId: string
  threatLevel: number
  hp: number
  maxHp: number
  startX: number
  startZ: number
  targetX: number
  targetZ: number
  x: number
  z: number
  progress: number
  active: boolean
}

export interface OpenWorldDefenseBolt3D {
  id: string
  x: number
  z: number
  targetX: number
  targetZ: number
  vx: number
  vz: number
  damage: number
  active: boolean
}

export interface OpenWorldSimState {
  commanderX: number
  commanderZ: number
  commanderTargetX: number
  commanderTargetZ: number
  enemyRealmThreatLevel: number
  enemyRealmEvolutionTimerMs: number
  enemyCounterWaveTimerMs: number
  towerFireCooldownMs: number
  alliedExpeditions: AlliedExpedition3D[]
  enemyInvasions: EnemyInvasionWave3D[]
  defenseBolts: OpenWorldDefenseBolt3D[]
  expeditionsDispatchedCount: number
  territoriesConqueredInOpenWorld: number
  enemyInvasionsSpawnedCount: number
  enemyInvasionsRepelledCount: number
  enemyInvasionsBreachedCount: number
}

export function createInitialOpenWorldSimState(
  initialThreatLevel = 1,
): OpenWorldSimState {
  return {
    commanderX: 1.2,
    commanderZ: -1.4,
    commanderTargetX: 1.8,
    commanderTargetZ: -1.15,
    enemyRealmThreatLevel: Math.max(1, Math.min(5, initialThreatLevel)),
    enemyRealmEvolutionTimerMs: 0,
    enemyCounterWaveTimerMs: 0,
    towerFireCooldownMs: 0,
    alliedExpeditions: [],
    enemyInvasions: [],
    defenseBolts: [],
    expeditionsDispatchedCount: 0,
    territoriesConqueredInOpenWorld: 0,
    enemyInvasionsSpawnedCount: 0,
    enemyInvasionsRepelledCount: 0,
    enemyInvasionsBreachedCount: 0,
  }
}

export function spawnAlliedExpeditionWave(
  sim: OpenWorldSimState,
  targetRegionId: string,
  troopsCommitted: number,
  isSurgical: boolean,
): AlliedExpedition3D {
  const targetCoord =
    OPEN_WORLD_REGION_3D_COORDS[targetRegionId] ??
    OPEN_WORLD_REGION_3D_COORDS.reg_ponte_leste
  const startX = -2.2
  const startZ = 0.2
  const wave: AlliedExpedition3D = {
    id: `ally_exp_${Date.now()}_${sim.expeditionsDispatchedCount + 1}`,
    targetRegionId,
    troopsCommitted: Math.max(1, Math.round(troopsCommitted)),
    isSurgical,
    startX,
    startZ,
    targetX: targetCoord.x,
    targetZ: targetCoord.z,
    x: startX,
    z: startZ,
    progress: 0,
    active: true,
  }
  sim.expeditionsDispatchedCount += 1
  sim.alliedExpeditions.push(wave)
  // Comandante acompanha pelo flanco norte para não sobrepor visualmente o batalhão 3D esmeralda
  sim.commanderTargetX = Math.min(targetCoord.x * 0.55, 7.5)
  sim.commanderTargetZ = targetCoord.z * 0.55 - 1.35
  return wave
}

export function spawnEnemyCounterInvasionWave(
  sim: OpenWorldSimState,
  originRegionId = 'reg_ponte_leste',
  threatLevel = sim.enemyRealmThreatLevel,
): EnemyInvasionWave3D {
  const originCoord =
    OPEN_WORLD_REGION_3D_COORDS[originRegionId] ??
    OPEN_WORLD_REGION_3D_COORDS.reg_ponte_leste
  const baseHp = Math.max(25, Math.round(35 * Math.pow(1.38, Math.max(0, threatLevel - 1))))
  const wave: EnemyInvasionWave3D = {
    id: `enemy_inv_${Date.now()}_${sim.enemyInvasionsSpawnedCount + 1}`,
    originRegionId,
    threatLevel,
    hp: baseHp,
    maxHp: baseHp,
    startX: originCoord.x,
    startZ: originCoord.z,
    targetX: -2.4,
    targetZ: 0.2,
    x: originCoord.x,
    z: originCoord.z,
    progress: 0,
    active: true,
  }
  sim.enemyInvasionsSpawnedCount += 1
  sim.enemyInvasions.push(wave)
  return wave
}

export function evolveOpenWorldEnemyThreat(sim: OpenWorldSimState): {
  enemyRealmThreatLevel: number
  spawnedInvasionId: string
} {
  sim.enemyRealmThreatLevel = Math.min(5, sim.enemyRealmThreatLevel + 1)
  const wave = spawnEnemyCounterInvasionWave(
    sim,
    'reg_forte_esteiras',
    sim.enemyRealmThreatLevel,
  )
  return {
    enemyRealmThreatLevel: sim.enemyRealmThreatLevel,
    spawnedInvasionId: wave.id,
  }
}

export interface OpenWorldStepContext {
  selectedRegionId: string
  conqueredRegionIds: string[]
  citadelLevels: Record<CitadelBuildingId, number>
  playerBridgeTowerLevels: [number, number, number, number]
}

export interface OpenWorldStepCallbacks {
  onExpeditionReachedTarget?: (
    regionId: string,
    troopsCommitted: number,
    isSurgical: boolean,
  ) => void
  onEnemyInvasionRepelled?: (bonusTroops: number, originRegionId: string) => void
  onEnemyInvasionBreached?: (tollTroops: number, originRegionId: string) => void
  onEnemyThreatEvolved?: (newThreatLevel: number) => void
}

export function stepOpenWorldRealmSim(
  sim: OpenWorldSimState,
  dtSec: number,
  ctx: OpenWorldStepContext,
  callbacks: OpenWorldStepCallbacks = {},
): void {
  const safeDt = Math.max(0.001, Math.min(0.1, dtSec))
  const dtMs = safeDt * 1000

  // 1. Movimentação suave 3D do Comandante da Ponte no Mundo Aberto
  const dxCmd = sim.commanderTargetX - sim.commanderX
  const dzCmd = sim.commanderTargetZ - sim.commanderZ
  const distCmd = Math.hypot(dxCmd, dzCmd)
  if (distCmd > 0.05) {
    const moveStep = Math.min(distCmd, safeDt * 9.5)
    sim.commanderX += (dxCmd / distCmd) * moveStep
    sim.commanderZ += (dzCmd / distCmd) * moveStep
  }

  // 2. Evolução autônoma do Território Inimigo (a cada ~18s) e ondas de contra-ataque (a cada ~11s)
  sim.enemyRealmEvolutionTimerMs += dtMs
  if (sim.enemyRealmEvolutionTimerMs >= 18000 && sim.enemyRealmThreatLevel < 5) {
    sim.enemyRealmEvolutionTimerMs = 0
    sim.enemyRealmThreatLevel += 1
    callbacks.onEnemyThreatEvolved?.(sim.enemyRealmThreatLevel)
  }

  sim.enemyCounterWaveTimerMs += dtMs
  if (sim.enemyCounterWaveTimerMs >= 11000 && sim.enemyInvasions.length < 2) {
    sim.enemyCounterWaveTimerMs = 0
    const unconqueredIds = Object.keys(OPEN_WORLD_REGION_3D_COORDS).filter(
      (id) => id !== 'reg_cidadela_origem' && !ctx.conqueredRegionIds.includes(id),
    )
    if (unconqueredIds.length > 0) {
      spawnEnemyCounterInvasionWave(
        sim,
        unconqueredIds[0],
        sim.enemyRealmThreatLevel,
      )
    }
  }

  // 3. Marcha das Expedições Aliadas 3D rumo às Fortificações Inimigas
  for (const exp of sim.alliedExpeditions) {
    if (!exp.active) continue
    exp.progress = Math.min(1, exp.progress + safeDt * 1.45)
    exp.x = exp.startX + (exp.targetX - exp.startX) * exp.progress
    exp.z = exp.startZ + (exp.targetZ - exp.startZ) * exp.progress
    if (exp.progress >= 1) {
      exp.active = false
      if (!ctx.conqueredRegionIds.includes(exp.targetRegionId)) {
        sim.territoriesConqueredInOpenWorld += 1
      }
      callbacks.onExpeditionReachedTarget?.(
        exp.targetRegionId,
        exp.troopsCommitted,
        exp.isSurgical,
      )
    }
  }
  sim.alliedExpeditions = sim.alliedExpeditions.filter((e) => e.active)

  // 4. Marcha das Ondas de Contra-Ataque Inimigas 3D rumo à Fronteira Aliada
  for (const inv of sim.enemyInvasions) {
    if (!inv.active) continue
    inv.progress = Math.min(1, inv.progress + safeDt * 0.42)
    inv.x = inv.startX + (inv.targetX - inv.startX) * inv.progress
    inv.z = inv.startZ + (inv.targetZ - inv.startZ) * inv.progress

    // Colisão com expedição aliada ou com o Comandante em patrulha
    const distToCommander = Math.hypot(inv.x - sim.commanderX, inv.z - sim.commanderZ)
    if (distToCommander <= 2.6) {
      inv.hp -= Math.max(8, (ctx.citadelLevels.quartel ?? 1) * 14) * safeDt
    }

    if (inv.hp <= 0) {
      inv.active = false
      sim.enemyInvasionsRepelledCount += 1
      const reward = Math.max(6, inv.threatLevel * 5)
      callbacks.onEnemyInvasionRepelled?.(reward, inv.originRegionId)
      continue
    }

    if (inv.progress >= 1) {
      inv.active = false
      const totalTowerLevels = ctx.playerBridgeTowerLevels.reduce((a, b) => a + b, 0)
      if (totalTowerLevels >= inv.threatLevel) {
        sim.enemyInvasionsRepelledCount += 1
        callbacks.onEnemyInvasionRepelled?.(
          Math.max(5, inv.threatLevel * 4),
          inv.originRegionId,
        )
      } else {
        sim.enemyInvasionsBreachedCount += 1
        callbacks.onEnemyInvasionBreached?.(
          Math.max(3, inv.threatLevel * 3),
          inv.originRegionId,
        )
      }
    }
  }
  sim.enemyInvasions = sim.enemyInvasions.filter((i) => i.active)

  // 5. Disparo Automático das Torres Defensivas da Cidadela contra Ondas Inimigas
  const activeTowerCount = Math.max(
    1,
    ctx.playerBridgeTowerLevels.filter((lvl) => lvl > 0).length,
  )
  const totalTowerPower =
    ctx.playerBridgeTowerLevels.reduce((a, b) => a + b, 0) +
    (ctx.citadelLevels.quartel ?? 1) +
    (ctx.citadelLevels.observatorio ?? 1)

  sim.towerFireCooldownMs = Math.max(0, sim.towerFireCooldownMs - dtMs)
  if (sim.enemyInvasions.length > 0 && sim.towerFireCooldownMs <= 0) {
    sim.towerFireCooldownMs = Math.max(180, 520 - activeTowerCount * 75)
    const targetInv = sim.enemyInvasions[0]
    const slot =
      OPEN_WORLD_FRONTIER_TOWER_SLOTS[
        sim.defenseBolts.length % OPEN_WORLD_FRONTIER_TOWER_SLOTS.length
      ]
    const dx = targetInv.x - slot.x
    const dz = targetInv.z - slot.z
    const dist = Math.max(0.1, Math.hypot(dx, dz))
    const speed = 26
    sim.defenseBolts.push({
      id: `ow_bolt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: slot.x,
      z: slot.z,
      targetX: targetInv.x,
      targetZ: targetInv.z,
      vx: (dx / dist) * speed,
      vz: (dz / dist) * speed,
      damage: Math.max(10, totalTowerPower * 6),
      active: true,
    })
  }

  // 6. Atualização de Projéteis Defensivos 3D
  for (const bolt of sim.defenseBolts) {
    if (!bolt.active) continue
    bolt.x += bolt.vx * safeDt
    bolt.z += bolt.vz * safeDt
    for (const inv of sim.enemyInvasions) {
      if (!inv.active) continue
      if (Math.hypot(bolt.x - inv.x, bolt.z - inv.z) <= 1.6) {
        inv.hp -= bolt.damage
        bolt.active = false
        if (inv.hp <= 0) {
          inv.active = false
          sim.enemyInvasionsRepelledCount += 1
          callbacks.onEnemyInvasionRepelled?.(
            Math.max(6, inv.threatLevel * 5),
            inv.originRegionId,
          )
        }
        break
      }
    }
    if (Math.abs(bolt.x) > 36 || Math.abs(bolt.z) > 24) {
      bolt.active = false
    }
  }
  sim.defenseBolts = sim.defenseBolts.filter((b) => b.active)
}

