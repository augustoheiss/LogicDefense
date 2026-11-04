// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/sandbox/voxelChunkGrid.ts
// LogicBattle V13: Grade Voxel 3D Canônica (48 × 12 × 48 = 27.648 células)
// - Armazenamento plano em Uint16Array + Hidden-Surface Face Culling para InstancedMesh
// - Pincel Volumétrico 3D (Width × Height × Depth) fiel ao vídeo The Sandbox (Aba 52)
// - Compressão Run-Length Encoding (RLE) determinística (< 4 KB por ilha)
// ──────────────────────────────────────────────────────────────────────────────

export const SANDBOX_GRID_W = 48
export const SANDBOX_GRID_H = 12
export const SANDBOX_GRID_D = 48
export const MAX_VOXEL_INSTANCES = 8192

export type VoxelBlockId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export interface VoxelBlockMeta {
  id: VoxelBlockId
  key: string
  namePt: string
  colorHex: string
  isSolid: boolean
  isProtected?: boolean
}

export const VOXEL_BLOCK_PALETTE: Readonly<Record<VoxelBlockId, VoxelBlockMeta>> = {
  0: { id: 0, key: 'AIR', namePt: 'Ar', colorHex: '#000000', isSolid: false },
  1: { id: 1, key: 'GRASS_EMERALD', namePt: 'Grama Voxel', colorHex: '#22c55e', isSolid: true },
  2: { id: 2, key: 'DIRT_EARTH', namePt: 'Terra Voxel', colorHex: '#854d0e', isSolid: true },
  3: { id: 3, key: 'STONE_CITADEL', namePt: 'Pedra Cidadela', colorHex: '#64748b', isSolid: true },
  4: { id: 4, key: 'WATER_MOAT', namePt: 'Água Cristalina', colorHex: '#0ea5e9', isSolid: false },
  5: { id: 5, key: 'LAVA_TRENCH', namePt: 'Lava Vulcânica', colorHex: '#ef4444', isSolid: true },
  6: { id: 6, key: 'GOLD_CRYSTAL', namePt: 'Cristal de Ouro', colorHex: '#facc15', isSolid: true },
  7: { id: 7, key: 'SAND_DESERT', namePt: 'Areia Dourada', colorHex: '#f59e0b', isSolid: true },
  8: {
    id: 8,
    key: 'NEON_PORTAL_PAD',
    namePt: 'Bloco-Portal',
    colorHex: '#a855f7',
    isSolid: true,
    isProtected: true,
  },
  9: { id: 9, key: 'SNOW_GLACIER', namePt: 'Neve Alpina', colorHex: '#e2e8f0', isSolid: true },
  10: { id: 10, key: 'OBSIDIAN_DARK', namePt: 'Obsidiana', colorHex: '#1e293b', isSolid: true },
}

export type SandboxZoneKey =
  | 'cidadela_realm'
  | 'ponte_portoes'
  | 'cerco_torres'
  | 'forte_bandeira'
  | 'pedreira_rei'
  | 'arena_ondas'
  | 'serpente_numeros'

export interface VoxelChunkGrid {
  readonly width: number
  readonly height: number
  readonly depth: number
  readonly zoneKey: SandboxZoneKey
  readonly cells: Uint16Array
  version: number
}

export interface VoxelBrushSizeWHD {
  width: number
  height: number
  depth: number
}

export type VoxelBrushMode = 'ADD' | 'CARVE' | 'PAINT'

export interface VisibleVoxelInstance {
  gx: number
  gy: number
  gz: number
  worldX: number
  worldY: number
  worldZ: number
  blockId: VoxelBlockId
  colorHex: string
}

export function voxelIndex(gx: number, gy: number, gz: number): number {
  return gx + gz * SANDBOX_GRID_W + gy * (SANDBOX_GRID_W * SANDBOX_GRID_D)
}

export function isInsideVoxelGrid(gx: number, gy: number, gz: number): boolean {
  return (
    gx >= 0 &&
    gx < SANDBOX_GRID_W &&
    gy >= 0 &&
    gy < SANDBOX_GRID_H &&
    gz >= 0 &&
    gz < SANDBOX_GRID_D
  )
}

export function getVoxelBlock(
  grid: VoxelChunkGrid,
  gx: number,
  gy: number,
  gz: number,
): VoxelBlockId {
  if (!isInsideVoxelGrid(gx, gy, gz)) return 0
  return (grid.cells[voxelIndex(gx, gy, gz)] ?? 0) as VoxelBlockId
}

export function setVoxelBlock(
  grid: VoxelChunkGrid,
  gx: number,
  gy: number,
  gz: number,
  blockId: VoxelBlockId,
): void {
  if (!isInsideVoxelGrid(gx, gy, gz)) return
  grid.cells[voxelIndex(gx, gy, gz)] = blockId
}

export function gridToWorldCoord(gx: number, gy: number, gz: number): {
  worldX: number
  worldY: number
  worldZ: number
} {
  return {
    worldX: gx - SANDBOX_GRID_W * 0.5 + 0.5,
    worldY: gy - 1.5,
    worldZ: gz - SANDBOX_GRID_D * 0.5 + 0.5,
  }
}

export function worldToGridCoord(worldX: number, worldZ: number): {
  gx: number
  gz: number
} {
  const gx = Math.max(
    0,
    Math.min(SANDBOX_GRID_W - 1, Math.round(worldX + SANDBOX_GRID_W * 0.5 - 0.5)),
  )
  const gz = Math.max(
    0,
    Math.min(SANDBOX_GRID_D - 1, Math.round(worldZ + SANDBOX_GRID_D * 0.5 - 0.5)),
  )
  return { gx, gz }
}

/**
 * Cria uma Ilha Voxel 3D (48 × 12 × 48) adaptada ao bioma/minigame ativo,
 * compartilhando exatamente o mesmo padrão estético Voxel 3D em todas as zonas.
 */
export function createProceduralVoxelIsland(
  seed = 42,
  zoneKey: SandboxZoneKey = 'cerco_torres',
): VoxelChunkGrid {
  const cells = new Uint16Array(SANDBOX_GRID_W * SANDBOX_GRID_H * SANDBOX_GRID_D)
  const grid: VoxelChunkGrid = {
    width: SANDBOX_GRID_W,
    height: SANDBOX_GRID_H,
    depth: SANDBOX_GRID_D,
    zoneKey,
    cells,
    version: 1,
  }

  const cx = SANDBOX_GRID_W * 0.5
  const cz = SANDBOX_GRID_D * 0.5

  for (let gz = 0; gz < SANDBOX_GRID_D; gz++) {
    for (let gx = 0; gx < SANDBOX_GRID_W; gx++) {
      const dx = (gx - cx) / (SANDBOX_GRID_W * 0.5)
      const dz = (gz - cz) / (SANDBOX_GRID_D * 0.5)
      const radialDist = Math.hypot(dx * 0.92, dz * 0.92)

      // Recorte orgânico de ilha flutuante Voxel (inspirado na Aba 4: Explore New Land)
      const hash = Math.sin((gx * 17 + gz * 31 + seed) * 0.19) * 0.08
      if (radialDist + hash > 1.06) {
        continue
      }

      // Para a Ponte dos Portões, abrimos o canal central da ponte e esculpimos as duas ilhas costeiras Voxel
      if (zoneKey === 'ponte_portoes' && Math.abs(gx - cx) < 13) {
        continue
      }

      // Camada base de rocha (y = 0) e terra (y = 1)
      setVoxelBlock(grid, gx, 0, gz, 10) // Obsidiana/Rocha profunda
      setVoxelBlock(grid, gx, 1, gz, 2) // Terra Voxel

      // Superfície principal (y = 2) de acordo com a zona do Mundo Aberto Voxel
      let topBlock: VoxelBlockId = 1 // Grama Voxel padrão
      if (zoneKey === 'pedreira_rei') {
        topBlock = (gx + gz) % 5 === 0 ? 6 : 7 // Veios de Cristal de Ouro + Areia/Rocha
      } else if (zoneKey === 'arena_ondas') {
        topBlock = radialDist > 0.68 ? 5 : 3 // Arena de Pedra cercada por Fosso de Lava Voxel
      } else if (zoneKey === 'serpente_numeros') {
        topBlock = (gx + gz) % 2 === 0 ? 1 : 3 // Tabuleiro Toroidal Voxel em blocos
      } else if (zoneKey === 'cidadela_realm') {
        topBlock = gx < cx ? 1 : 7 // Oeste Aliado Verde Esmeralda vs Leste Fronteira Terracota/Areia
      } else if (zoneKey === 'cerco_torres') {
        topBlock = Math.abs(gx - cx) <= 2 ? 4 : 1 // Fosso de Água Voxel dividindo as trincheiras
      } else if (zoneKey === 'forte_bandeira') {
        topBlock = radialDist < 0.32 ? 3 : 1 // Pátio de Pedra da Fortaleza no centro
      }
      setVoxelBlock(grid, gx, 2, gz, topBlock)

      // Relevo em degraus Voxel nas bordas da ilha e muralhas/obstáculos (y = 3..5)
      if (radialDist > 0.78 && radialDist <= 0.96 && (gx + gz) % 2 === 0) {
        setVoxelBlock(grid, gx, 3, gz, zoneKey === 'arena_ondas' ? 10 : 3)
        if ((gx * gz + seed) % 7 === 0) {
          setVoxelBlock(grid, gx, 4, gz, zoneKey === 'pedreira_rei' ? 6 : 9)
        }
      }

      // Pilares de labirinto Voxel na Serpente dos Números ou Veios de Ouro na Pedreira
      if (
        zoneKey === 'serpente_numeros' &&
        gx > 8 &&
        gx < SANDBOX_GRID_W - 8 &&
        gz > 10 &&
        gz < SANDBOX_GRID_D - 8 &&
        gx % 7 === 0 &&
        gz % 7 === 0
      ) {
        setVoxelBlock(grid, gx, 3, gz, 3)
        setVoxelBlock(grid, gx, 4, gz, 6)
      } else if (
        zoneKey === 'pedreira_rei' &&
        gx > 10 &&
        gx < SANDBOX_GRID_W - 10 &&
        gz > 10 &&
        gz < SANDBOX_GRID_D - 10 &&
        (gx * 3 + gz * 5) % 19 === 0
      ) {
        setVoxelBlock(grid, gx, 3, gz, 6)
        setVoxelBlock(grid, gx, 4, gz, 6)
      }
    }
  }

  return grid
}

/**
 * Carimba um Bloco-Portal 3D (3×3 blocos de NEON_PORTAL_PAD) no terreno Voxel
 * para que o jogador veja e pise fisicamente sobre o Bloco-Portal.
 */
export function stampSteppingPortalOnGrid(
  grid: VoxelChunkGrid,
  worldX: number,
  worldZ: number,
): void {
  const { gx, gz } = worldToGridCoord(worldX, worldZ)
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = gx + dx
      const tz = gz + dz
      if (!isInsideVoxelGrid(tx, 2, tz)) continue
      setVoxelBlock(grid, tx, 0, tz, 10)
      setVoxelBlock(grid, tx, 1, tz, 3)
      setVoxelBlock(grid, tx, 2, tz, 8) // Bloco-Portal protegido
      setVoxelBlock(grid, tx, 3, tz, 0) // Garante espaço livre acima do portal
      setVoxelBlock(grid, tx, 4, tz, 0)
    }
  }
  grid.version += 1
}

/**
 * Aplica a ferramenta Voxel Brush (Width × Height × Depth) inspirada no vídeo da Aba 52.
 * Protege automaticamente blocos de portal (id === 8) e o piso base (y === 0).
 */
export function applyVoxelBrush(
  grid: VoxelChunkGrid,
  centerGrid: { gx: number; gy: number; gz: number },
  sizeWHD: VoxelBrushSizeWHD,
  blockId: VoxelBlockId,
  mode: VoxelBrushMode = 'ADD',
): { modifiedCount: number; newVersion: number } {
  const w = Math.max(1, Math.min(7, Math.round(sizeWHD.width)))
  const h = Math.max(1, Math.min(7, Math.round(sizeWHD.height)))
  const d = Math.max(1, Math.min(7, Math.round(sizeWHD.depth)))

  const halfW = Math.floor(w / 2)
  const halfD = Math.floor(d / 2)
  let modifiedCount = 0

  for (let dy = 0; dy < h; dy++) {
    for (let dz = -halfD; dz <= -halfD + d - 1; dz++) {
      for (let dx = -halfW; dx <= -halfW + w - 1; dx++) {
        const gx = centerGrid.gx + dx
        const gy = centerGrid.gy + dy
        const gz = centerGrid.gz + dz
        if (!isInsideVoxelGrid(gx, gy, gz)) continue
        if (gy === 0 && mode === 'CARVE') continue // Nunca perfura o bedrock y=0

        const current = getVoxelBlock(grid, gx, gy, gz)
        if (current === 8) continue // Bloco-Portal é indestrutível

        if (mode === 'CARVE') {
          if (current !== 0) {
            setVoxelBlock(grid, gx, gy, gz, 0)
            modifiedCount += 1
          }
        } else if (mode === 'PAINT') {
          if (current !== 0 && current !== blockId) {
            setVoxelBlock(grid, gx, gy, gz, blockId)
            modifiedCount += 1
          }
        } else {
          const targetId: VoxelBlockId = blockId === 0 ? 1 : blockId
          if (current !== targetId) {
            setVoxelBlock(grid, gx, gy, gz, targetId)
            modifiedCount += 1
          }
        }
      }
    }
  }

  if (modifiedCount > 0) {
    grid.version += 1
  }
  return { modifiedCount, newVersion: grid.version }
}

/**
 * Invariante de Desempacotamento Vertical: retorna a coordenada Y do mundo segura
 * no topo da coluna Voxel (gx, gz) para que o Avatar jamais fique preso dentro de um bloco.
 */
export function resolveSafeAvatarGroundY(
  grid: VoxelChunkGrid,
  worldX: number,
  worldZ: number,
): number {
  const { gx, gz } = worldToGridCoord(worldX, worldZ)
  for (let gy = SANDBOX_GRID_H - 1; gy >= 0; gy--) {
    const id = getVoxelBlock(grid, gx, gy, gz)
    if (id !== 0 && VOXEL_BLOCK_PALETTE[id]?.isSolid) {
      return gy - 1.5 + 0.55
    }
  }
  return 1.05
}

/**
 * Extrai apenas os blocos Voxel visíveis (com pelo menos 1 das 6 faces exposta ao ar/água)
 * para alimentar o THREE.InstancedMesh em um único draw call.
 */
export function extractVisibleVoxelInstances(
  grid: VoxelChunkGrid,
  maxInstances = MAX_VOXEL_INSTANCES,
): VisibleVoxelInstance[] {
  const result: VisibleVoxelInstance[] = []
  const w = grid.width
  const h = grid.height
  const d = grid.depth

  const isTransparentOrAir = (gx: number, gy: number, gz: number): boolean => {
    if (gy < 0) return false // A face inferior do bedrock (y < 0) nunca é visível pela câmera superior
    if (gx < 0 || gx >= w || gy >= h || gz < 0 || gz >= d) return true
    const id = getVoxelBlock(grid, gx, gy, gz)
    return id === 0 || id === 4
  }

  for (let gy = h - 1; gy >= 0; gy--) {
    for (let gz = 0; gz < d; gz++) {
      for (let gx = 0; gx < w; gx++) {
        const blockId = getVoxelBlock(grid, gx, gy, gz)
        if (blockId === 0) continue

        const exposed =
          isTransparentOrAir(gx + 1, gy, gz) ||
          isTransparentOrAir(gx - 1, gy, gz) ||
          isTransparentOrAir(gx, gy + 1, gz) ||
          isTransparentOrAir(gx, gy - 1, gz) ||
          isTransparentOrAir(gx, gy, gz + 1) ||
          isTransparentOrAir(gx, gy, gz - 1)

        if (!exposed) continue

        const { worldX, worldY, worldZ } = gridToWorldCoord(gx, gy, gz)
        const meta = VOXEL_BLOCK_PALETTE[blockId] ?? VOXEL_BLOCK_PALETTE[1]
        result.push({
          gx,
          gy,
          gz,
          worldX,
          worldY,
          worldZ,
          blockId,
          colorHex: meta.colorHex,
        })

        if (result.length >= maxInstances) {
          return result
        }
      }
    }
  }

  return result
}

/**
 * Codifica a grade Voxel inteira em Run-Length Encoding (RLE) compacto ("id:count,id:count...")
 */
export function encodeVoxelIslandRLE(grid: VoxelChunkGrid): string {
  const cells = grid.cells
  if (cells.length === 0) return ''
  const parts: string[] = []
  let currentId = cells[0]
  let runLen = 1

  for (let i = 1; i < cells.length; i++) {
    const val = cells[i]
    if (val === currentId) {
      runLen += 1
    } else {
      parts.push(`${currentId.toString(36)}:${runLen.toString(36)}`)
      currentId = val
      runLen = 1
    }
  }
  parts.push(`${currentId.toString(36)}:${runLen.toString(36)}`)
  return parts.join(',')
}

/**
 * Decodifica uma string RLE de volta para VoxelChunkGrid com validação de integridade.
 */
export function decodeVoxelIslandRLE(
  rle: string,
  fallbackSeed = 42,
  zoneKey: SandboxZoneKey = 'cerco_torres',
): VoxelChunkGrid {
  const totalCells = SANDBOX_GRID_W * SANDBOX_GRID_H * SANDBOX_GRID_D
  if (!rle || typeof rle !== 'string') {
    return createProceduralVoxelIsland(fallbackSeed, zoneKey)
  }

  try {
    const cells = new Uint16Array(totalCells)
    const tokens = rle.split(',')
    let writeIdx = 0

    for (const token of tokens) {
      const [idStr, lenStr] = token.split(':')
      if (!idStr || !lenStr) throw new Error('Invalid RLE token')
      const blockId = parseInt(idStr, 36)
      const count = parseInt(lenStr, 36)
      if (
        !Number.isFinite(blockId) ||
        !Number.isFinite(count) ||
        count <= 0 ||
        writeIdx + count > totalCells
      ) {
        throw new Error('RLE bounds mismatch')
      }
      cells.fill(blockId, writeIdx, writeIdx + count)
      writeIdx += count
    }

    if (writeIdx !== totalCells) {
      throw new Error('Incomplete RLE payload')
    }

    return {
      width: SANDBOX_GRID_W,
      height: SANDBOX_GRID_H,
      depth: SANDBOX_GRID_D,
      zoneKey,
      cells,
      version: 1,
    }
  } catch {
    return createProceduralVoxelIsland(fallbackSeed, zoneKey)
  }
}
