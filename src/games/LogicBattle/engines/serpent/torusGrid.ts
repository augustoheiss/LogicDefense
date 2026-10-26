// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/serpent/torusGrid.ts — S1: Labirinto Toroidal 48×48
// MASTER_PLAN_V4 §2.2 & §2.5: Gerado por seed, sem becos sem saída, bordas abertas (mod W/H)
// ──────────────────────────────────────────────────────────────────────────────
import { createRng } from '../../domain/rng'

export const SERPENT_GRID_SIZE = 48

export type MazeCellKind = 'floor' | 'wall'

export interface GridCoord {
  x: number
  y: number
}

export interface TorusMazeGrid {
  readonly seed: number
  readonly width: number
  readonly height: number
  readonly cells: MazeCellKind[][]
  readonly floorCells: GridCoord[]
}

export function wrapCoord(v: number, size = SERPENT_GRID_SIZE): number {
  const m = v % size
  return m < 0 ? m + size : m
}

export function wrapCell(
  x: number,
  y: number,
  width = SERPENT_GRID_SIZE,
  height = SERPENT_GRID_SIZE,
): GridCoord {
  return {
    x: wrapCoord(Math.round(x), width),
    y: wrapCoord(Math.round(y), height),
  }
}

/**
 * Menor deslocamento com sinal no toro de `from` até `to` no intervalo [-size/2, size/2].
 */
export function torusDelta(
  from: number,
  to: number,
  size = SERPENT_GRID_SIZE,
): number {
  let d = wrapCoord(to - from, size)
  if (d > size * 0.5) d -= size
  return d
}

export function torusManhattan(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = SERPENT_GRID_SIZE,
  height = SERPENT_GRID_SIZE,
): number {
  return (
    Math.abs(torusDelta(x1, x2, width)) + Math.abs(torusDelta(y1, y2, height))
  )
}

export function torusEuclidean(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = SERPENT_GRID_SIZE,
  height = SERPENT_GRID_SIZE,
): number {
  const dx = torusDelta(x1, x2, width)
  const dy = torusDelta(y1, y2, height)
  return Math.hypot(dx, dy)
}

export function isWalkableCell(
  grid: TorusMazeGrid,
  x: number,
  y: number,
): boolean {
  const wx = wrapCoord(Math.floor(x), grid.width)
  const wy = wrapCoord(Math.floor(y), grid.height)
  return grid.cells[wy]?.[wx] === 'floor'
}

const CARDINAL_DIRS: readonly GridCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

export function getPassableNeighbors(
  grid: TorusMazeGrid,
  x: number,
  y: number,
): GridCoord[] {
  const res: GridCoord[] = []
  for (const d of CARDINAL_DIRS) {
    const nx = wrapCoord(x + d.x, grid.width)
    const ny = wrapCoord(y + d.y, grid.height)
    if (grid.cells[ny][nx] === 'floor') {
      res.push({ x: nx, y: ny })
    }
  }
  return res
}

/**
 * Gera um labirinto toroidal 48×48 determinístico por seed (DFS + laços trançados extras)
 * garantindo conectividade total e rotas abertas nas 4 bordas (x=0 ↔ W-1, y=0 ↔ H-1).
 */
export function generateToroidalMaze(
  seed: number,
  width = SERPENT_GRID_SIZE,
  height = SERPENT_GRID_SIZE,
): TorusMazeGrid {
  const rng = createRng(seed ^ 0x5f3759df)
  const cells: MazeCellKind[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'wall' as MazeCellKind),
  )

  const coarseW = Math.floor(width / 2)
  const coarseH = Math.floor(height / 2)
  const visited = Array.from({ length: coarseH }, () =>
    Array.from({ length: coarseW }, () => false),
  )

  const stack: GridCoord[] = [{ x: 0, y: 0 }]
  visited[0][0] = true
  cells[0][0] = 'floor'

  while (stack.length > 0) {
    const cur = stack[stack.length - 1]
    const dirs = rng.shuffle([...CARDINAL_DIRS])
    let moved = false

    for (const d of dirs) {
      const ncx = wrapCoord(cur.x + d.x, coarseW)
      const ncy = wrapCoord(cur.y + d.y, coarseH)
      if (!visited[ncy][ncx]) {
        visited[ncy][ncx] = true
        const fx = cur.x * 2
        const fy = cur.y * 2
        const wallX = wrapCoord(fx + d.x, width)
        const wallY = wrapCoord(fy + d.y, height)
        const targetX = ncx * 2
        const targetY = ncy * 2

        cells[fy][fx] = 'floor'
        cells[wallY][wallX] = 'floor'
        cells[targetY][targetX] = 'floor'

        stack.push({ x: ncx, y: ncy })
        moved = true
        break
      }
    }

    if (!moved) {
      stack.pop()
    }
  }

  // Abrir laços extras (~42% das paredes entre corredores) + passagens explícitas nas bordas toroidais
  for (let cy = 0; cy < coarseH; cy++) {
    for (let cx = 0; cx < coarseW; cx++) {
      const fx = cx * 2
      const fy = cy * 2
      cells[fy][fx] = 'floor'

      const isBorder =
        cx === 0 || cx === coarseW - 1 || cy === 0 || cy === coarseH - 1
      const openChance = isBorder ? 0.68 : 0.42

      for (const d of [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]) {
        if (rng.nextFloat() < openChance) {
          const wx = wrapCoord(fx + d.x, width)
          const wy = wrapCoord(fy + d.y, height)
          cells[wy][wx] = 'floor'
        }
      }
    }
  }

  // Eliminar qualquer beco sem saída remanescente (garante ≥ 2 saídas por célula de piso)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (cells[y][x] !== 'floor') continue
      let openCount = 0
      const closedWalls: GridCoord[] = []
      for (const d of CARDINAL_DIRS) {
        const nx = wrapCoord(x + d.x, width)
        const ny = wrapCoord(y + d.y, height)
        if (cells[ny][nx] === 'floor') {
          openCount++
        } else {
          closedWalls.push({ x: nx, y: ny })
        }
      }
      if (openCount < 2 && closedWalls.length > 0) {
        const pick = closedWalls[rng.nextInt(0, closedWalls.length - 1)]
        cells[pick.y][pick.x] = 'floor'
      }
    }
  }

  const floorCells: GridCoord[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (cells[y][x] === 'floor') {
        floorCells.push({ x, y })
      }
    }
  }

  return {
    seed,
    width,
    height,
    cells,
    floorCells,
  }
}

/**
 * Verifica se 100% das células de piso do labirinto são mutuamente alcançáveis no toro (S1).
 */
export function isMazeConnected(grid: TorusMazeGrid): boolean {
  if (grid.floorCells.length === 0) return false
  const start = grid.floorCells[0]
  const seen = new Set<number>()
  const queue: GridCoord[] = [start]
  seen.add(start.y * grid.width + start.x)

  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    for (const nb of getPassableNeighbors(grid, cur.x, cur.y)) {
      const key = nb.y * grid.width + nb.x
      if (!seen.has(key)) {
        seen.add(key)
        queue.push(nb)
      }
    }
  }

  return seen.size === grid.floorCells.length
}
