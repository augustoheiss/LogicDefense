// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/sandbox/sandboxVoxelSim.ts
// LogicBattle V13: Motor Determinístico 60Hz do Avatar Voxel 3D, Combate NEXT
// (Espada em Arco, Blaster, Dash, Pulo, Hoverboard KM/H), Pincel Volumétrico
// (Width × Height × Depth) e Transição Diegética por Bloco-Portal (Stepping-Block)
// ──────────────────────────────────────────────────────────────────────────────

import { EngineId } from '../engines/engineContract'
import {
  SANDBOX_ASSET_CATALOG,
  SANDBOX_STEPPING_PORTALS,
  SandboxSteppingPortalSpec,
} from './sandboxCatalog'
import {
  applyVoxelBrush,
  createProceduralVoxelIsland,
  encodeVoxelIslandRLE,
  extractVisibleVoxelInstances,
  resolveSafeAvatarGroundY,
  SandboxZoneKey,
  stampSteppingPortalOnGrid,
  VisibleVoxelInstance,
  VoxelBlockId,
  VoxelBrushMode,
  VoxelBrushSizeWHD,
  VoxelChunkGrid,
  worldToGridCoord,
} from './voxelChunkGrid'

export interface SandboxPlacedEntity3D {
  id: string
  blueprintId: string
  namePt: string
  icon: string
  colorHex: string
  worldX: number
  worldY: number
  worldZ: number
}

export interface SandboxPortalTransitionState {
  active: boolean
  portalId: string
  targetZoneKey: SandboxZoneKey
  targetWorld: 'realm' | 'run'
  targetEngineId?: EngineId
  labelPt: string
  icon: string
  colorHex: string
  portalX: number
  portalZ: number
  startedAtMs: number
  progress: number
  durationMs: number
}

export interface SandboxVoxelSimState {
  zoneKey: SandboxZoneKey
  seed: number
  grid: VoxelChunkGrid
  visibleInstances: VisibleVoxelInstance[]
  lastBuiltGridVersion: number
  rleSnapshot: string

  // Avatar 3D Voxel (The Sandbox NEXT + Studio Hoverboard)
  avatarX: number
  avatarY: number
  avatarZ: number
  avatarTargetX: number
  avatarTargetZ: number
  avatarVelY: number
  avatarYawRad: number
  avatarHp: number
  avatarMaxHp: number
  avatarEnergy: number
  avatarMaxEnergy: number
  swordSlashTimerMs: number
  swordSlashCount: number
  dashTimerMs: number
  dashCount: number
  jumpCount: number
  hoverboardActive: boolean
  speedKmh: number

  // Ferramenta Studio Builder: Voxel Brush (Width × Height × Depth)
  studioBuilderOpen: boolean
  inventoryModalOpen: boolean
  brushSize: VoxelBrushSizeWHD
  selectedBlockId: VoxelBlockId
  brushMode: VoxelBrushMode
  cursorGridX: number
  cursorGridY: number
  cursorGridZ: number
  brushActionsCount: number

  // Entidades colocadas pelo jogador na Ilha Voxel
  placedEntities: SandboxPlacedEntity3D[]

  // Estado de Transição Diegética por Bloco-Portal (Stepping-Block Portal)
  portalArrivalCooldownMs: number
  portalTransitionsCompletedCount: number
  portalTransition: SandboxPortalTransitionState | null
}

export function createInitialSandboxVoxelSim(
  seed = 42,
  zoneKey: SandboxZoneKey = 'cerco_torres',
): SandboxVoxelSimState {
  const grid = createProceduralVoxelIsland(seed, zoneKey)
  for (const portal of SANDBOX_STEPPING_PORTALS) {
    stampSteppingPortalOnGrid(grid, portal.worldX, portal.worldZ)
  }

  const visibleInstances = extractVisibleVoxelInstances(grid)
  const startX = 0
  const startZ = 4
  const startY = resolveSafeAvatarGroundY(grid, startX, startZ)

  return {
    zoneKey,
    seed,
    grid,
    visibleInstances,
    lastBuiltGridVersion: grid.version,
    rleSnapshot: encodeVoxelIslandRLE(grid),

    avatarX: startX,
    avatarY: startY,
    avatarZ: startZ,
    avatarTargetX: startX,
    avatarTargetZ: startZ,
    avatarVelY: 0,
    avatarYawRad: 0,
    avatarHp: 100,
    avatarMaxHp: 100,
    avatarEnergy: 100,
    avatarMaxEnergy: 100,
    swordSlashTimerMs: 0,
    swordSlashCount: 0,
    dashTimerMs: 0,
    dashCount: 0,
    jumpCount: 0,
    hoverboardActive: false,
    speedKmh: 0,

    studioBuilderOpen: false,
    inventoryModalOpen: false,
    brushSize: { width: 3, height: 2, depth: 3 },
    selectedBlockId: 1,
    brushMode: 'ADD',
    cursorGridX: 24,
    cursorGridY: 3,
    cursorGridZ: 24,
    brushActionsCount: 0,

    placedEntities: [
      {
        id: 'initial_math_altar_right',
        blueprintId: 'voxel_math_altar',
        namePt: 'Altar da Conta [E]',
        icon: '🧮',
        colorHex: '#facc15',
        worldX: 10,
        worldY: resolveSafeAvatarGroundY(grid, 10, 0),
        worldZ: 0,
      },
    ],

    portalArrivalCooldownMs: 1600,
    portalTransitionsCompletedCount: 0,
    portalTransition: null,
  }
}

export function triggerSandboxSwordSlash(sim: SandboxVoxelSimState): void {
  sim.swordSlashTimerMs = 380
  sim.swordSlashCount += 1
}

export function triggerSandboxDash(sim: SandboxVoxelSimState): void {
  if (sim.avatarEnergy < 12) return
  sim.avatarEnergy = Math.max(0, sim.avatarEnergy - 12)
  sim.dashTimerMs = 320
  sim.dashCount += 1
  const step = 4.2
  sim.avatarTargetX = Math.max(-21, Math.min(21, sim.avatarX + Math.sin(sim.avatarYawRad) * step))
  sim.avatarTargetZ = Math.max(-21, Math.min(21, sim.avatarZ + Math.cos(sim.avatarYawRad) * step))
}

export function triggerSandboxJump(sim: SandboxVoxelSimState): void {
  const groundY = resolveSafeAvatarGroundY(sim.grid, sim.avatarX, sim.avatarZ)
  if (sim.avatarY <= groundY + 0.35) {
    sim.avatarVelY = 7.8
    sim.jumpCount += 1
  }
}

export function toggleSandboxHoverboard(sim: SandboxVoxelSimState): boolean {
  sim.hoverboardActive = !sim.hoverboardActive
  return sim.hoverboardActive
}

export function executeSandboxBrushStroke(
  sim: SandboxVoxelSimState,
  worldX?: number,
  worldZ?: number,
  overrideMode?: VoxelBrushMode,
): { modifiedCount: number; terrainVersion: number; instancedVoxelCount: number } {
  const targetX = worldX ?? sim.avatarX + Math.sin(sim.avatarYawRad) * 3.0
  const targetZ = worldZ ?? sim.avatarZ + Math.cos(sim.avatarYawRad) * 3.0
  const { gx, gz } = worldToGridCoord(targetX, targetZ)
  sim.cursorGridX = gx
  sim.cursorGridZ = gz

  const mode = overrideMode ?? sim.brushMode
  const gy = mode === 'CARVE' ? 2 : 3
  sim.cursorGridY = gy

  const res = applyVoxelBrush(
    sim.grid,
    { gx, gy, gz },
    sim.brushSize,
    sim.selectedBlockId,
    mode,
  )

  if (res.modifiedCount > 0 || sim.lastBuiltGridVersion !== sim.grid.version) {
    sim.visibleInstances = extractVisibleVoxelInstances(sim.grid)
    sim.lastBuiltGridVersion = sim.grid.version
    sim.rleSnapshot = encodeVoxelIslandRLE(sim.grid)
    sim.brushActionsCount += 1
    // Garante que o Avatar nunca fique preso dentro de um bloco recém-construído
    const safeY = resolveSafeAvatarGroundY(sim.grid, sim.avatarX, sim.avatarZ)
    if (sim.avatarY < safeY) {
      sim.avatarY = safeY
    }
  }

  return {
    modifiedCount: res.modifiedCount,
    terrainVersion: sim.grid.version,
    instancedVoxelCount: sim.visibleInstances.length,
  }
}

export function placeCatalogAssetInSandbox(
  sim: SandboxVoxelSimState,
  blueprintId: string,
  sharedWalletBalance: number,
  spendFromWallet: (cost: number) => boolean,
  worldX?: number,
  worldZ?: number,
): { placed: boolean; reason?: string; costCoins: number; totalPlaced: number } {
  const bp =
    SANDBOX_ASSET_CATALOG.find((item) => item.id === blueprintId) ??
    SANDBOX_ASSET_CATALOG[0]

  if (bp.costCoins > 0) {
    if (sharedWalletBalance < bp.costCoins) {
      return {
        placed: false,
        reason: 'INSUFFICIENT_SHARED_WALLET',
        costCoins: bp.costCoins,
        totalPlaced: sim.placedEntities.length,
      }
    }
    const ok = spendFromWallet(bp.costCoins)
    if (!ok) {
      return {
        placed: false,
        reason: 'WALLET_DEBIT_REJECTED',
        costCoins: bp.costCoins,
        totalPlaced: sim.placedEntities.length,
      }
    }
  }

  const px = Math.max(-18, Math.min(18, worldX ?? sim.avatarX + 2.2))
  const pz = Math.max(-14, Math.min(16, worldZ ?? sim.avatarZ - 2.0))
  const py = resolveSafeAvatarGroundY(sim.grid, px, pz)

  sim.placedEntities.push({
    id: `sbx_ent_${Date.now()}_${sim.placedEntities.length + 1}`,
    blueprintId: bp.id,
    namePt: bp.namePt,
    icon: bp.icon,
    colorHex: bp.colorHex,
    worldX: px,
    worldY: py,
    worldZ: pz,
  })

  if (bp.id === 'voxel_hoverboard_pad') {
    sim.hoverboardActive = true
  }

  return {
    placed: true,
    costCoins: bp.costCoins,
    totalPlaced: sim.placedEntities.length,
  }
}

/**
 * Faz o Avatar caminhar/pisar em um Bloco-Portal específico (por ID, targetZoneKey ou targetEngineId)
 * e inicia imediatamente a Animação 3D de Transição de Portal.
 */
export function walkAndStepOnPortalBlock(
  sim: SandboxVoxelSimState,
  targetPortalOrZone: string,
): SandboxSteppingPortalSpec | null {
  const portal =
    SANDBOX_STEPPING_PORTALS.find(
      (p) =>
        p.id === targetPortalOrZone ||
        p.targetZoneKey === targetPortalOrZone ||
        p.targetEngineId === targetPortalOrZone ||
        (targetPortalOrZone === 'realm' && p.targetWorld === 'realm'),
    ) ?? null

  if (!portal) return null

  sim.portalArrivalCooldownMs = 0
  sim.avatarTargetX = portal.worldX
  sim.avatarTargetZ = portal.worldZ
  sim.avatarX = portal.worldX
  sim.avatarZ = portal.worldZ
  sim.avatarY = resolveSafeAvatarGroundY(sim.grid, portal.worldX, portal.worldZ)

  sim.portalTransition = {
    active: true,
    portalId: portal.id,
    targetZoneKey: portal.targetZoneKey,
    targetWorld: portal.targetWorld,
    targetEngineId: portal.targetEngineId,
    labelPt: portal.labelPt,
    icon: portal.icon,
    colorHex: portal.colorHex,
    portalX: portal.worldX,
    portalZ: portal.worldZ,
    startedAtMs: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    progress: 0.12,
    durationMs: 520,
  }

  return portal
}

export interface StepSandboxVoxelCallbacks {
  onPortalTransitionCompleted?: (portal: SandboxPortalTransitionState) => void
}

/**
 * Passo determinístico 60Hz da simulação Voxel 3D:
 * - Move o Avatar suavemente em (X, Y, Z) sobre os blocos Voxel
 * - Detecta quando o Avatar pisa em um Bloco-Portal (dist <= 1.95) e anima o Warp 3D
 */
export function stepSandboxVoxelSim(
  sim: SandboxVoxelSimState,
  dtSec: number,
  callbacks: StepSandboxVoxelCallbacks = {},
): void {
  const safeDt = Math.max(0.004, Math.min(0.35, dtSec))
  const dtMs = safeDt * 1000

  if (sim.portalArrivalCooldownMs > 0) {
    sim.portalArrivalCooldownMs = Math.max(0, sim.portalArrivalCooldownMs - dtMs)
  }

  if (sim.swordSlashTimerMs > 0) {
    sim.swordSlashTimerMs = Math.max(0, sim.swordSlashTimerMs - dtMs)
  }
  if (sim.dashTimerMs > 0) {
    sim.dashTimerMs = Math.max(0, sim.dashTimerMs - dtMs)
  }
  sim.avatarEnergy = Math.min(sim.avatarMaxEnergy, sim.avatarEnergy + safeDt * 9.5)

  // 1. Se uma animação de transição de Bloco-Portal está ativa, avança o progresso 3D em tempo real!
  if (sim.portalTransition && sim.portalTransition.active) {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const elapsedPortalMs =
      sim.portalTransition.startedAtMs > 0
        ? Math.max(8, nowMs - sim.portalTransition.startedAtMs)
        : dtMs
    sim.portalTransition.progress = Math.min(
      1,
      Math.max(0.08, elapsedPortalMs / Math.max(300, sim.portalTransition.durationMs)),
    )
    sim.avatarY += safeDt * 4.5
    sim.avatarYawRad += safeDt * 12.0

    if (sim.portalTransition.progress >= 1) {
      const completedPortal = { ...sim.portalTransition }
      sim.portalTransition = null
      sim.portalTransitionsCompletedCount += 1
      sim.portalArrivalCooldownMs = 1800
      // Reposiciona o Avatar no pad seguro central da nova zona
      sim.avatarX = 0
      sim.avatarZ = 4
      sim.avatarTargetX = 0
      sim.avatarTargetZ = 4
      sim.avatarY = resolveSafeAvatarGroundY(sim.grid, 0, 4)
      callbacks.onPortalTransitionCompleted?.(completedPortal)
    }
    return
  }

  // 2. Movimento horizontal 3D do Avatar Voxel (Hoverboard = 125 KM/H, Dash = 160 KM/H, A pé = 48 KM/H)
  const dx = sim.avatarTargetX - sim.avatarX
  const dz = sim.avatarTargetZ - sim.avatarZ
  const dist = Math.hypot(dx, dz)
  const baseSpeedUnits = sim.dashTimerMs > 0 ? 18.5 : sim.hoverboardActive ? 14.2 : 8.4

  if (dist > 0.06) {
    const step = Math.min(dist, safeDt * baseSpeedUnits)
    sim.avatarX = Math.max(-22, Math.min(22, sim.avatarX + (dx / dist) * step))
    sim.avatarZ = Math.max(-22, Math.min(22, sim.avatarZ + (dz / dist) * step))
    sim.avatarYawRad = Math.atan2(dx, dz)
    sim.speedKmh = Math.round(
      sim.dashTimerMs > 0 ? 160 : sim.hoverboardActive ? 125 : 48,
    )
  } else {
    sim.speedKmh = sim.hoverboardActive ? 35 : 0
  }

  // 3. Gravidade e Colisão Vertical com o topo sólido da coluna Voxel (gx, gz)
  const groundY = resolveSafeAvatarGroundY(sim.grid, sim.avatarX, sim.avatarZ)
  if (sim.avatarY > groundY || sim.avatarVelY > 0) {
    sim.avatarY += sim.avatarVelY * safeDt
    sim.avatarVelY -= 22.0 * safeDt
    if (sim.avatarY <= groundY) {
      sim.avatarY = groundY
      sim.avatarVelY = 0
    }
  } else {
    sim.avatarY = groundY
  }

  // 4. Detecção Diegética de Passo em Bloco-Portal (Stepping-Block Trigger)
  if (sim.portalArrivalCooldownMs <= 0 && !sim.portalTransition) {
    for (const portal of SANDBOX_STEPPING_PORTALS) {
      // Ignora o portal da própria zona atual para não re-entrar nela involuntariamente
      if (portal.targetZoneKey === sim.zoneKey) continue
      const dPortal = Math.hypot(sim.avatarX - portal.worldX, sim.avatarZ - portal.worldZ)
      if (dPortal <= 1.85) {
        sim.portalTransition = {
          active: true,
          portalId: portal.id,
          targetZoneKey: portal.targetZoneKey,
          targetWorld: portal.targetWorld,
          targetEngineId: portal.targetEngineId,
          labelPt: portal.labelPt,
          icon: portal.icon,
          colorHex: portal.colorHex,
          portalX: portal.worldX,
          portalZ: portal.worldZ,
          startedAtMs: typeof performance !== 'undefined' ? performance.now() : Date.now(),
          progress: 0.05,
          durationMs: 360,
        }
        break
      }
    }
  }
}
