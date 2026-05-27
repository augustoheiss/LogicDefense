/**
 * pathfinding.ts
 *
 * Standalone A* pathfinding module for the LogicFriction circular arena.
 * Pure TypeScript — NO React, NO Three.js, NO project imports.
 *
 * Arena: circular, radius 50, cell size 2.
 * Grid indices range from -25 to 25 on each axis.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CELL_SIZE = 2;

const ARENA_RADIUS = 50;
const MAX_ITERATIONS = 5000;
const GRID_MIN = -25;
const GRID_MAX = 25;

/** Cost for orthogonal (N/S/E/W) moves. */
const ORTHO_COST = 1.0;
/** Cost for diagonal moves. */
const DIAG_COST = Math.SQRT2; // ≈ 1.414

/**
 * 8-directional neighbour offsets: [dgx, dgz].
 * Order: N, NE, E, SE, S, SW, W, NW
 */
const DIRECTIONS: ReadonlyArray<[number, number]> = [
  [0, -1],  // N
  [1, -1],  // NE
  [1, 0],   // E
  [1, 1],   // SE
  [0, 1],   // S
  [-1, 1],  // SW
  [-1, 0],  // W
  [-1, -1], // NW
];

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Convert world-space coordinates to grid indices.
 * Grid snapping uses `Math.round(coord / CELL_SIZE)`.
 */
export function worldToGrid(x: number, z: number): [number, number] {
  return [Math.round(x / CELL_SIZE), Math.round(z / CELL_SIZE)];
}

/**
 * Convert grid indices back to world-space centre of that cell.
 */
export function gridToWorld(gx: number, gz: number): [number, number] {
  return [gx * CELL_SIZE, gz * CELL_SIZE];
}

// ---------------------------------------------------------------------------
// Walkability
// ---------------------------------------------------------------------------

/**
 * Check whether a grid cell is walkable.
 *
 * A cell is walkable when:
 * 1. Its world-space centre lies within the circular arena (radius 50).
 * 2. It does not coincide with any obstacle (tower / construction site).
 * 3. It is outside the core exclusion zone (radius 3.5 from origin).
 *
 * @param gx        Grid x index
 * @param gz        Grid z index
 * @param obstacles Array of obstacle world-space positions {x, z}.
 *                  Each obstacle is snapped to the grid for comparison.
 */
export function isWalkable(
  gx: number,
  gz: number,
  obstacles: Array<{ x: number; z: number }>,
): boolean {
  // Bounds check — grid indices must be in valid range
  if (gx < GRID_MIN || gx > GRID_MAX || gz < GRID_MIN || gz > GRID_MAX) {
    return false;
  }

  // World-space centre of this cell
  const wx = gx * CELL_SIZE;
  const wz = gz * CELL_SIZE;

  // 1. Circular arena boundary
  const distFromOriginSq = wx * wx + wz * wz;
  if (distFromOriginSq > ARENA_RADIUS * ARENA_RADIUS) {
    return false;
  }

  // 2. Core is a sensor (phantom) — no exclusion zone for the player.

  // 3. Obstacle collision — exact 1×1 grid cell match.
  //    The player's physics BallCollider handles wall sliding naturally;
  //    grid-level padding just blocks valid corridors.
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const ogx = Math.round(obs.x / CELL_SIZE);
    const ogz = Math.round(obs.z / CELL_SIZE);
    if (ogx === gx && ogz === gz) {
      return false;
    }
  }

  return true;
}

/**
 * Find the nearest walkable grid cell to (gx, gz) via spiral search.
 * Returns the snapped grid coords, or null if nothing found within radius.
 */
export function snapToWalkable(
  gx: number,
  gz: number,
  obstacles: Array<{ x: number; z: number }>,
  maxRadius = 5,
): [number, number] | null {
  // Check the cell itself first
  if (isWalkable(gx, gz, obstacles)) return [gx, gz];

  // Spiral outward
  for (let r = 1; r <= maxRadius; r++) {
    // Scan the ring at distance r — prefer cells closest to original
    let bestCell: [number, number] | null = null;
    let bestDistSq = Infinity;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // Only ring
        const cx = gx + dx;
        const cz = gz + dz;
        if (isWalkable(cx, cz, obstacles)) {
          const distSq = dx * dx + dz * dz;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestCell = [cx, cz];
          }
        }
      }
    }
    if (bestCell) return bestCell;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Min-Heap (binary heap sorted by fScore)
// ---------------------------------------------------------------------------

interface HeapNode {
  gx: number;
  gz: number;
  f: number;
}

class MinHeap {
  private data: HeapNode[] = [];

  get size(): number {
    return this.data.length;
  }

  /** Insert a node into the heap. */
  push(node: HeapNode): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  /** Remove and return the node with the smallest f value. */
  pop(): HeapNode | undefined {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last !== undefined) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    const node = this.data[idx];
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      if (this.data[parentIdx].f <= node.f) break;
      this.data[idx] = this.data[parentIdx];
      idx = parentIdx;
    }
    this.data[idx] = node;
  }

  private sinkDown(idx: number): void {
    const length = this.data.length;
    const node = this.data[idx];

    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;

      if (left < length && this.data[left].f < this.data[smallest].f) {
        smallest = left;
      }
      if (right < length && this.data[right].f < this.data[smallest].f) {
        smallest = right;
      }
      if (smallest === idx) break;

      this.data[idx] = this.data[smallest];
      this.data[smallest] = node;
      idx = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// Heuristic
// ---------------------------------------------------------------------------

/** Euclidean distance heuristic (admissible for 8-directional movement). */
function heuristic(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/** Encode grid coordinates into a unique string key for Map lookups. */
function key(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

// ---------------------------------------------------------------------------
// A* Pathfinding
// ---------------------------------------------------------------------------

/**
 * Run A* pathfinding from (startX, startZ) to (endX, endZ) in world space.
 *
 * Returns an array of world-space waypoints from the cell *after* the start
 * to the goal cell (inclusive), or `null` if no path exists.
 *
 * @param startX    World-space start X
 * @param startZ    World-space start Z
 * @param endX      World-space goal X
 * @param endZ      World-space goal Z
 * @param obstacles Array of obstacle positions {x, z}
 */
export function findPath(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  obstacles: Array<{ x: number; z: number }>,
): Array<{ x: number; z: number }> | null {
  // Convert start / end to grid coordinates
  const [sgx, sgz] = worldToGrid(startX, startZ);
  const [egx, egz] = worldToGrid(endX, endZ);

  // Trivial case — already at the goal
  if (sgx === egx && sgz === egz) {
    return [];
  }

  // If the goal cell itself is not walkable, snap to nearest walkable neighbor
  let finalGx = egx;
  let finalGz = egz;
  if (!isWalkable(egx, egz, obstacles)) {
    const snapped = snapToWalkable(egx, egz, obstacles);
    if (!snapped) return null; // Truly unreachable
    finalGx = snapped[0];
    finalGz = snapped[1];
    // If snapped goal equals start, we're already there
    if (sgx === finalGx && sgz === finalGz) return [];
  }

  // Update endKey to use snapped goal
  const endKey = key(finalGx, finalGz);

  // ----- Data structures -----

  // gScore: cheapest known cost from start to each node
  const gScore = new Map<string, number>();
  // cameFrom: parent pointer for path reconstruction
  const cameFrom = new Map<string, string>();
  // closedSet: nodes already fully evaluated
  const closedSet = new Set<string>();

  const startKey = key(sgx, sgz);

  gScore.set(startKey, 0);

  const openHeap = new MinHeap();
  openHeap.push({ gx: sgx, gz: sgz, f: heuristic(sgx, sgz, finalGx, finalGz) });

  let iterations = 0;

  // ----- Main loop -----
  while (openHeap.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    const current = openHeap.pop()!;
    const cx = current.gx;
    const cz = current.gz;
    const ck = key(cx, cz);

    // Goal reached — reconstruct & return path
    if (ck === endKey) {
      return reconstructPath(cameFrom, ck, sgx, sgz);
    }

    // Skip if already evaluated (heap may contain stale entries)
    if (closedSet.has(ck)) continue;
    closedSet.add(ck);

    const currentG = gScore.get(ck)!;

    // Explore 8 neighbours
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const [dx, dz] = DIRECTIONS[d];
      const nx = cx + dx;
      const nz = cz + dz;
      const nk = key(nx, nz);

      if (closedSet.has(nk)) continue;
      if (!isWalkable(nx, nz, obstacles)) continue;

      // For diagonal moves, also check that both orthogonal neighbours are
      // walkable to prevent corner-cutting through obstacles.
      if (dx !== 0 && dz !== 0) {
        if (!isWalkable(cx + dx, cz, obstacles) || !isWalkable(cx, cz + dz, obstacles)) {
          continue;
        }
      }

      const moveCost = dx !== 0 && dz !== 0 ? DIAG_COST : ORTHO_COST;
      const tentativeG = currentG + moveCost;

      const prevG = gScore.get(nk);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      // This path is better — record it
      gScore.set(nk, tentativeG);
      cameFrom.set(nk, ck);

      const f = tentativeG + heuristic(nx, nz, finalGx, finalGz);
      openHeap.push({ gx: nx, gz: nz, f });
    }
  }

  // No path found (unreachable or iteration cap hit)
  return null;
}

// ---------------------------------------------------------------------------
// Path reconstruction & smoothing
// ---------------------------------------------------------------------------

/**
 * Reconstruct the grid path from cameFrom pointers, convert to world-space
 * waypoints, and apply simple collinear-point smoothing.
 *
 * The returned path does NOT include the start cell — only the cells the
 * entity needs to move through to reach the goal.
 */
function reconstructPath(
  cameFrom: Map<string, string>,
  endKey: string,
  startGx: number,
  startGz: number,
): Array<{ x: number; z: number }> {
  // 1. Walk backward through cameFrom to build grid-path (reversed)
  const gridPath: Array<[number, number]> = [];
  let currentKey: string | undefined = endKey;

  while (currentKey !== undefined) {
    const [gx, gz] = currentKey.split(",").map(Number) as [number, number];
    gridPath.push([gx, gz]);
    currentKey = cameFrom.get(currentKey);
  }

  // Reverse so it goes from start → end
  gridPath.reverse();

  // 2. Remove the start cell (caller already knows their position)
  // The first entry corresponds to the start grid cell, skip it.
  const startKey = key(startGx, startGz);
  if (gridPath.length > 0 && key(gridPath[0][0], gridPath[0][1]) === startKey) {
    gridPath.shift();
  }

  if (gridPath.length === 0) {
    return [];
  }

  // 3. Path smoothing — remove intermediate collinear waypoints
  const smoothed: Array<[number, number]> = [gridPath[0]];

  for (let i = 1; i < gridPath.length - 1; i++) {
    const prev = smoothed[smoothed.length - 1];
    const curr = gridPath[i];
    const next = gridPath[i + 1];

    // Direction from prev→curr vs curr→next
    const dx1 = curr[0] - prev[0];
    const dz1 = curr[1] - prev[1];
    const dx2 = next[0] - curr[0];
    const dz2 = next[1] - curr[1];

    // If direction changes, keep this waypoint
    if (dx1 !== dx2 || dz1 !== dz2) {
      smoothed.push(curr);
    }
  }

  // Always include the final waypoint (goal)
  smoothed.push(gridPath[gridPath.length - 1]);

  // 4. Convert to world-space
  return smoothed.map(([gx, gz]) => {
    const [wx, wz] = gridToWorld(gx, gz);
    return { x: wx, z: wz };
  });
}
