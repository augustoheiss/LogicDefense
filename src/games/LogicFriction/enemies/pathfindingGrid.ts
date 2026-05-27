/**
 * pathfindingGrid.ts
 *
 * Centralized obstacle grid for ENEMY A* pathfinding.
 *
 * IMPORTANT: This module does NOT reuse the player's findPath() because
 * that function uses 3×3 tower padding (for the player's fat RigidBody).
 * Enemies are small icosahedrons that MUST navigate through 1-cell gaps
 * for tight mazing. So we run our own A* with 1×1 obstacle blocking.
 *
 * The A* grid has a CORE_EXCLUSION_RADIUS (3.5) that marks cells near
 * (0,0) as unwalkable. Enemies pathfind to the edge of the exclusion
 * zone, then Enemy.tsx beelines the final segment.
 */

import { CELL_SIZE, worldToGrid, gridToWorld } from '../player/pathfinding'
export { CELL_SIZE }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARENA_RADIUS = 50
const CORE_EXCLUSION_RADIUS = 3.5
const MAX_ITERATIONS = 5000
const GRID_MIN = -25
const GRID_MAX = 25
const ORTHO_COST = 1.0
const DIAG_COST = Math.SQRT2

const DIRECTIONS: ReadonlyArray<[number, number]> = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
]

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Pre-computed obstacle GRID coords as a Set for O(1) lookup */
let obstacleSet = new Set<string>()
let obstacleCount = 0

/** Monotonically increasing version — bumped on every grid change */
let version = 0

// ---------------------------------------------------------------------------
// Grid key helper
// ---------------------------------------------------------------------------

function gkey(gx: number, gz: number): string {
  return `${gx},${gz}`
}

// ---------------------------------------------------------------------------
// Enemy-specific walkability (NO 3×3 padding — strict 1×1 blocking)
// ---------------------------------------------------------------------------

function isEnemyWalkable(gx: number, gz: number): boolean {
  // Bounds
  if (gx < GRID_MIN || gx > GRID_MAX || gz < GRID_MIN || gz > GRID_MAX) {
    return false
  }

  // Circular arena boundary
  const wx = gx * CELL_SIZE
  const wz = gz * CELL_SIZE
  const distSq = wx * wx + wz * wz
  if (distSq > ARENA_RADIUS * ARENA_RADIUS) return false

  // Core exclusion zone
  if (distSq < CORE_EXCLUSION_RADIUS * CORE_EXCLUSION_RADIUS) return false

  // Obstacle: strict 1×1 — only the exact grid cell is blocked
  if (obstacleSet.has(gkey(gx, gz))) return false

  return true
}

// ---------------------------------------------------------------------------
// Enemy-specific A* (no padding, diagonal corner-cut prevention)
// ---------------------------------------------------------------------------

function heuristic(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx
  const dz = az - bz
  return Math.sqrt(dx * dx + dz * dz)
}

// Min-heap
interface HeapNode { gx: number; gz: number; f: number }

class MinHeap {
  private data: HeapNode[] = []
  get size() { return this.data.length }

  push(node: HeapNode) {
    this.data.push(node)
    this._up(this.data.length - 1)
  }
  pop(): HeapNode | undefined {
    const top = this.data[0]
    const last = this.data.pop()
    if (this.data.length > 0 && last) { this.data[0] = last; this._down(0) }
    return top
  }
  private _up(i: number) {
    const n = this.data[i]
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.data[p].f <= n.f) break
      this.data[i] = this.data[p]; i = p
    }
    this.data[i] = n
  }
  private _down(i: number) {
    const len = this.data.length; const n = this.data[i]
    while (true) {
      const l = 2 * i + 1, r = 2 * i + 2; let s = i
      if (l < len && this.data[l].f < this.data[s].f) s = l
      if (r < len && this.data[r].f < this.data[s].f) s = r
      if (s === i) break
      this.data[i] = this.data[s]; this.data[s] = n; i = s
    }
  }
}

function enemyAStar(
  sgx: number, sgz: number,
  egx: number, egz: number,
): Array<{ x: number; z: number }> | null {
  if (sgx === egx && sgz === egz) return []

  // If goal isn't walkable, bail
  if (!isEnemyWalkable(egx, egz)) return null

  const gScore = new Map<string, number>()
  const cameFrom = new Map<string, string>()
  const closed = new Set<string>()

  const sk = gkey(sgx, sgz)
  const ek = gkey(egx, egz)
  gScore.set(sk, 0)

  const open = new MinHeap()
  open.push({ gx: sgx, gz: sgz, f: heuristic(sgx, sgz, egx, egz) })

  let iter = 0
  while (open.size > 0 && iter < MAX_ITERATIONS) {
    iter++
    const cur = open.pop()!
    const cx = cur.gx, cz = cur.gz
    const ck = gkey(cx, cz)

    if (ck === ek) {
      // Reconstruct path
      const path: Array<[number, number]> = []
      let k: string | undefined = ck
      while (k) { const [px, pz] = k.split(',').map(Number); path.push([px, pz]); k = cameFrom.get(k) }
      path.reverse()
      // Remove start cell
      if (path.length > 0 && gkey(path[0][0], path[0][1]) === sk) path.shift()
      // Smooth collinear
      if (path.length <= 1) return path.map(([x, z]) => ({ x: x * CELL_SIZE, z: z * CELL_SIZE }))
      const smooth: Array<[number, number]> = [path[0]]
      for (let i = 1; i < path.length - 1; i++) {
        const p = smooth[smooth.length - 1], c = path[i], n = path[i + 1]
        if (c[0] - p[0] !== n[0] - c[0] || c[1] - p[1] !== n[1] - c[1]) smooth.push(c)
      }
      smooth.push(path[path.length - 1])
      return smooth.map(([x, z]) => ({ x: x * CELL_SIZE, z: z * CELL_SIZE }))
    }

    if (closed.has(ck)) continue
    closed.add(ck)
    const cg = gScore.get(ck)!

    for (let d = 0; d < DIRECTIONS.length; d++) {
      const [dx, dz] = DIRECTIONS[d]
      const nx = cx + dx, nz = cz + dz
      const nk = gkey(nx, nz)
      if (closed.has(nk)) continue
      if (!isEnemyWalkable(nx, nz)) continue

      // Diagonal corner-cut prevention: both adjacent orthogonal cells must be free
      if (dx !== 0 && dz !== 0) {
        if (!isEnemyWalkable(cx + dx, cz) || !isEnemyWalkable(cx, cz + dz)) continue
      }

      const cost = dx !== 0 && dz !== 0 ? DIAG_COST : ORTHO_COST
      const tg = cg + cost
      const prev = gScore.get(nk)
      if (prev !== undefined && tg >= prev) continue

      gScore.set(nk, tg)
      cameFrom.set(nk, ck)
      open.push({ gx: nx, gz: nz, f: tg + heuristic(nx, nz, egx, egz) })
    }
  }

  return null // No path found
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rebuild the obstacle set from tower world positions.
 * Each tower blocks exactly its own 1×1 grid cell.
 */
export function rebuildObstacles(towers: Array<{ x: number; z: number }>): void {
  obstacleSet = new Set<string>()
  for (const t of towers) {
    const [gx, gz] = worldToGrid(t.x, t.z)
    obstacleSet.add(gkey(gx, gz))
  }
  obstacleCount = towers.length
  version++
}

export function getPathVersion(): number { return version }
export function getObstacleCount(): number { return obstacleCount }

/**
 * Check if a world-space position is blocked on the enemy grid.
 * Used by EnemyManager for spawn clearance checks.
 */
export function isPositionBlocked(worldX: number, worldZ: number): boolean {
  const [gx, gz] = worldToGrid(worldX, worldZ)
  return !isEnemyWalkable(gx, gz)
}

/**
 * Find an enemy path from (fromX, fromZ) toward the core.
 *
 * Targets a walkable cell on the EDGE of the core exclusion zone
 * along the enemy's approach direction.
 *
 * FAILSAFE: 0 obstacles → always beeline (never null).
 */
export function findEnemyPath(
  fromX: number,
  fromZ: number,
): Array<{ x: number; z: number }> | null {
  // ── FAILSAFE: No obstacles → always beeline ──
  if (obstacleCount === 0) return []

  const dist = Math.sqrt(fromX * fromX + fromZ * fromZ)
  if (dist < 0.01) return [] // Already at core

  // Target: cell just outside core exclusion zone, along approach direction
  const edgeDist = CORE_EXCLUSION_RADIUS + CELL_SIZE * 0.6 // ~4.7
  const dirX = -fromX / dist  // unit vector toward core
  const dirZ = -fromZ / dist
  const rawTargetX = dirX * edgeDist
  const rawTargetZ = dirZ * edgeDist

  // Snap to grid
  const [tgx, tgz] = worldToGrid(rawTargetX, rawTargetZ)

  // If the snapped goal cell is inside exclusion zone, search outward
  let goalGx = tgx, goalGz = tgz
  if (!isEnemyWalkable(goalGx, goalGz)) {
    // Spiral outward to find nearest walkable cell
    let found = false
    for (let r = 1; r <= 4 && !found; r++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dz = -r; dz <= r && !found; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue // Only ring
          const cx = tgx + dx, cz = tgz + dz
          if (isEnemyWalkable(cx, cz)) {
            goalGx = cx; goalGz = cz; found = true
          }
        }
      }
    }
    if (!found) {
      console.warn(`[A*] Cannot find walkable goal cell near core edge`)
      return null
    }
  }

  // Convert start to grid
  const [sgx, sgz] = worldToGrid(fromX, fromZ)

  // If start cell is blocked (spawned inside tower), find nearest walkable
  let startGx = sgx, startGz = sgz
  if (!isEnemyWalkable(startGx, startGz)) {
    let found = false
    for (let r = 1; r <= 3 && !found; r++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dz = -r; dz <= r && !found; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
          const cx = sgx + dx, cz = sgz + dz
          if (isEnemyWalkable(cx, cz)) {
            startGx = cx; startGz = cz; found = true
          }
        }
      }
    }
    if (!found) {
      console.warn(`[A*] Start cell blocked with no nearby walkable! (${fromX.toFixed(1)}, ${fromZ.toFixed(1)})`)
      return [] // Beeline as last resort
    }
  }

  const result = enemyAStar(startGx, startGz, goalGx, goalGz)

  if (result === null) {
    console.warn(
      `[A*] Null! Start grid: (${startGx},${startGz}) → Goal grid: (${goalGx},${goalGz}) | ` +
      `Towers: ${obstacleCount}`
    )
  }

  return result
}

/**
 * Reset the grid (call on game reset/menu).
 */
export function resetGrid(): void {
  obstacleSet = new Set<string>()
  obstacleCount = 0
  version = 0
}
