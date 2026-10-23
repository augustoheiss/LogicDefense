import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CascadeResolutionResult,
  CascadeWave,
  FruitBlockMeta,
  FruitCascadeOracleReport,
  FruitCluster,
  FruitKind,
  FruitPairPiece,
  GridCell,
  GridMatrix,
  RotationDirection,
} from '../types'
import { cloneGrid } from './gridEngine'

/**
 * RT-13 Circuit Breaker: Hard cap on cascade waves per move so a chain reaction
 * never locks the main thread.
 */
export const MAX_CASCADE_STEPS = 16

/**
 * 2 + 1 = 3: Three or more orthogonally connected matching fruits (or paired with
 * a STAR_PRISM wildcard) pop and trigger column gravity.
 */
export const MIN_CLUSTER_SIZE = 3

/**
 * Grace float duration granted when morphing a FruitPairPiece via [M].
 */
export const GRACE_FLOAT_AFTER_FRUIT_MORPH_MS = 1400

export const PLAYABLE_FRUITS: readonly FruitKind[] = [
  'APPLE_RUBY',
  'CITRUS_GOLD',
  'GRAPE_NEON',
  'EMERALD_PEAR',
  'BERRY_CYAN',
]

export const ALL_FRUIT_KINDS: readonly FruitKind[] = [
  ...PLAYABLE_FRUITS,
  'STAR_PRISM',
]

export const FRUIT_CATALOG: Record<FruitKind, FruitBlockMeta> = {
  APPLE_RUBY: {
    kind: 'APPLE_RUBY',
    namePt: 'Maçã Rubi',
    emoji: '🍎',
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.55)',
    borderColor: '#fda4af',
    symbol: '🍎',
  },
  CITRUS_GOLD: {
    kind: 'CITRUS_GOLD',
    namePt: 'Laranja Solar',
    emoji: '🍊',
    color: '#f59e0b',
    glowColor: 'rgba(255, 158, 11, 0.55)',
    borderColor: '#fde68a',
    symbol: '🍊',
  },
  GRAPE_NEON: {
    kind: 'GRAPE_NEON',
    namePt: 'Uva Neon',
    emoji: '🍇',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.55)',
    borderColor: '#d8b4fe',
    symbol: '🍇',
  },
  EMERALD_PEAR: {
    kind: 'EMERALD_PEAR',
    namePt: 'Pera Esmeralda',
    emoji: '🍏',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.55)',
    borderColor: '#6ee7b7',
    symbol: '🍏',
  },
  BERRY_CYAN: {
    kind: 'BERRY_CYAN',
    namePt: 'Mirtilo Ciano',
    emoji: '🫐',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.55)',
    borderColor: '#67e8f9',
    symbol: '🫐',
  },
  STAR_PRISM: {
    kind: 'STAR_PRISM',
    namePt: 'Estrela Coringa',
    emoji: '⭐',
    color: '#eab308',
    glowColor: 'rgba(250, 204, 21, 0.85)',
    borderColor: '#fef08a',
    symbol: '✦',
  },
}

let fruitPairSeq = 0

export function getFruitMeta(kind: FruitKind): FruitBlockMeta {
  return FRUIT_CATALOG[kind]
}

/**
 * Infers a deterministic FruitKind for any existing GridCell (e.g. when converting
 * from TETRIS_CLASSIC or TACTILE_GRID).
 */
export function inferFruitKindFromCell(cell: GridCell): FruitKind {
  if (cell.fruitKind && FRUIT_CATALOG[cell.fruitKind]) {
    return cell.fruitKind
  }
  if (cell.isSealedHole || cell.type === 'SEALED_GOLD') {
    return 'STAR_PRISM'
  }
  switch (cell.type) {
    case 'Z':
      return 'APPLE_RUBY'
    case 'L':
    case 'O':
    case 'DOT_1X1':
      return 'CITRUS_GOLD'
    case 'T':
    case 'DOMINO_1X2':
      return 'GRAPE_NEON'
    case 'S':
      return 'EMERALD_PEAR'
    case 'I':
    case 'J':
    default:
      return 'BERRY_CYAN'
  }
}

/**
 * Creates a GridCell decorated with full synesthetic fruit metadata.
 */
export function createFruitGridCell(
  kind: FruitKind,
  isMorphedBlock: boolean = false
): GridCell {
  const meta = FRUIT_CATALOG[kind]
  const isStar = kind === 'STAR_PRISM'
  return {
    type: isStar ? 'SEALED_GOLD' : 'DOT_1X1',
    color: meta.color,
    glowColor: meta.glowColor,
    borderColor: meta.borderColor,
    symbol: meta.symbol,
    isSealedHole: isStar,
    isMorphedBlock: isMorphedBlock || isStar,
    fruitKind: kind,
  }
}

function randomPlayableFruit(): FruitKind {
  const idx = Math.floor(Math.random() * PLAYABLE_FRUITS.length)
  return PLAYABLE_FRUITS[idx] ?? 'APPLE_RUBY'
}

/**
 * Spawns a 2-block FruitPairPiece centered at the top of the 20x10 arena
 * (x = 4, y = 1, orientation = 0 -> primary at (4, 1), secondary at (4, 0)).
 */
export function createSpawnFruitPair(
  primary?: FruitKind,
  secondary?: FruitKind
): FruitPairPiece {
  fruitPairSeq += 1
  const chosenPrimary = primary ?? randomPlayableFruit()
  const chosenSecondary = secondary ?? randomPlayableFruit()
  return {
    id: `fruit_pair_${Date.now()}_${fruitPairSeq}`,
    primary: chosenPrimary,
    secondary: chosenSecondary,
    x: 4,
    y: 1,
    orientation: 0,
    isWildcardPair: chosenPrimary === 'STAR_PRISM' || chosenSecondary === 'STAR_PRISM',
  }
}

/**
 * Returns the exact board coordinates (row, col) and fruit kinds of the two blocks
 * in a FruitPairPiece according to its orientation:
 * - 0: secondary above (y - 1, x), primary at (y, x)
 * - 1: secondary right (y, x + 1), primary at (y, x)
 * - 2: secondary below (y + 1, x), primary at (y, x)
 * - 3: secondary left  (y, x - 1), primary at (y, x)
 */
export function getFruitPairCells(
  pair: FruitPairPiece
): Array<{ row: number; col: number; kind: FruitKind; role: 'primary' | 'secondary' }> {
  let secRow = pair.y - 1
  let secCol = pair.x

  if (pair.orientation === 1) {
    secRow = pair.y
    secCol = pair.x + 1
  } else if (pair.orientation === 2) {
    secRow = pair.y + 1
    secCol = pair.x
  } else if (pair.orientation === 3) {
    secRow = pair.y
    secCol = pair.x - 1
  }

  return [
    { row: secRow, col: secCol, kind: pair.secondary, role: 'secondary' },
    { row: pair.y, col: pair.x, kind: pair.primary, role: 'primary' },
  ]
}

/**
 * Checks whether a FruitPairPiece collides with board walls, floor, ceiling,
 * or occupied GridCells.
 */
export function hasFruitPairCollision(
  grid: GridMatrix,
  pair: FruitPairPiece,
  offsetX: number = 0,
  offsetY: number = 0,
  testOrientation?: 0 | 1 | 2 | 3
): boolean {
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH
  const candidate: FruitPairPiece = {
    ...pair,
    x: pair.x + offsetX,
    y: pair.y + offsetY,
    orientation: testOrientation !== undefined ? testOrientation : pair.orientation,
  }

  if (candidate.y < 0 || candidate.y >= height) {
    return true
  }

  const cells = getFruitPairCells(candidate)
  for (const cell of cells) {
    if (cell.col < 0 || cell.col >= width || cell.row >= height) {
      return true
    }
    if (cell.row < 0) {
      return true
    }
    if (grid[cell.row]?.[cell.col] !== null) {
      return true
    }
  }

  return false
}

/**
 * Moves a FruitPairPiece by (dx, dy) if no collision occurs; returns null if blocked.
 */
export function moveFruitPairIfValid(
  grid: GridMatrix,
  pair: FruitPairPiece,
  dx: number,
  dy: number
): FruitPairPiece | null {
  if (hasFruitPairCollision(grid, pair, dx, dy)) {
    return null
  }
  return {
    ...pair,
    x: pair.x + dx,
    y: pair.y + dy,
  }
}

const FRUIT_SRS_KICKS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
]

/**
 * Rotates a FruitPairPiece using SRS wall/floor/ceiling kicks.
 * If boxed into a 1-column-wide well where horizontal orientations (1 and 3) cannot fit,
 * performs a Puyo-style quick-swap (primary <-> secondary) so rotation never locks up.
 */
export function rotateFruitPairSRS(
  grid: GridMatrix,
  pair: FruitPairPiece,
  dir: RotationDirection = 'CW'
): FruitPairPiece {
  const delta = dir === 'CW' ? 1 : dir === 'CCW' ? 3 : 2
  const nextOrientation = ((pair.orientation + delta) % 4) as 0 | 1 | 2 | 3

  for (const kick of FRUIT_SRS_KICKS) {
    if (!hasFruitPairCollision(grid, pair, kick.dx, kick.dy, nextOrientation)) {
      return {
        ...pair,
        x: pair.x + kick.dx,
        y: pair.y + kick.dy,
        orientation: nextOrientation,
      }
    }
  }

  // Fallback quick-swap when trapped in a 1-column vertical shaft
  const flippedOrientation = ((pair.orientation + 2) % 4) as 0 | 1 | 2 | 3
  for (const kick of FRUIT_SRS_KICKS) {
    if (!hasFruitPairCollision(grid, pair, kick.dx, kick.dy, flippedOrientation)) {
      return {
        ...pair,
        x: pair.x + kick.dx,
        y: pair.y + kick.dy,
        orientation: flippedOrientation,
      }
    }
  }

  return {
    ...pair,
    primary: pair.secondary,
    secondary: pair.primary,
  }
}

/**
 * Computes the lowest valid Y coordinate directly below `pair` for ghost projection.
 */
export function computeFruitPairGhostY(grid: GridMatrix, pair: FruitPairPiece): number {
  let dropOffset = 0
  while (!hasFruitPairCollision(grid, pair, 0, dropOffset + 1)) {
    dropOffset += 1
  }
  return pair.y + dropOffset
}

/**
 * Melhoria 02-C: Independent Column Gravity.
 * Compacts each column from bottom (row 19) to top (row 0) so any unsupported half-pair
 * resting on a ledge or any fruit left floating after a pop slides smoothly to the lowest
 * free row in its column.
 */
export function applyColumnGravityToFruits(
  grid: GridMatrix
): { grid: GridMatrix; movedCount: number } {
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH
  const nextGrid = cloneGrid(grid)
  let movedCount = 0

  for (let col = 0; col < width; col++) {
    let writeRow = height - 1
    for (let readRow = height - 1; readRow >= 0; readRow--) {
      const cell = nextGrid[readRow]?.[col] ?? null
      if (!cell) continue

      const kind = inferFruitKindFromCell(cell)
      const meta = FRUIT_CATALOG[kind]
      const normalizedCell: GridCell = {
        ...cell,
        fruitKind: kind,
        color: cell.color || meta.color,
        glowColor: cell.glowColor || meta.glowColor,
        borderColor: cell.borderColor || meta.borderColor,
        symbol: cell.symbol || meta.symbol,
      }

      if (writeRow !== readRow) {
        nextGrid[writeRow][col] = normalizedCell
        nextGrid[readRow][col] = null
        movedCount += 1
      } else {
        nextGrid[writeRow][col] = normalizedCell
      }
      writeRow -= 1
    }
  }

  return { grid: nextGrid, movedCount }
}

const ORTHOGONAL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/**
 * Melhoria 02-B: Orthogonal 4-direction BFS detector for connected groups of >= 3 fruits.
 * STAR_PRISM (✦) acts as a universal wildcard, connecting with any adjacent fruit color
 * to complete 2 + 1 = 3+ clusters, as well as forming pure STAR_PRISM clusters if 3+ stars touch.
 */
export function findConnectedFruitClusters(grid: GridMatrix): FruitCluster[] {
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH
  const clusters: FruitCluster[] = []

  const getCellKind = (r: number, c: number): FruitKind | null => {
    const cell = grid[r]?.[c] ?? null
    if (!cell) return null
    return inferFruitKindFromCell(cell)
  }

  // 1. Scan each regular playable fruit color (with STAR_PRISM acting as universal bridge)
  for (const targetKind of PLAYABLE_FRUITS) {
    const visited = Array.from({ length: height }, () => Array<boolean>(width).fill(false))

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (visited[r][c]) continue
        const startKind = getCellKind(r, c)
        if (startKind !== targetKind) continue

        const queue: Array<{ row: number; col: number }> = [{ row: r, col: c }]
        visited[r][c] = true
        const component: Array<{ row: number; col: number }> = []
        let hasWildcardStar = false

        while (queue.length > 0) {
          const current = queue.shift()!
          component.push(current)
          const currentKind = getCellKind(current.row, current.col)
          if (currentKind === 'STAR_PRISM') {
            hasWildcardStar = true
          }

          for (const [dr, dc] of ORTHOGONAL_DIRS) {
            const nr = current.row + dr
            const nc = current.col + dc
            if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue
            if (visited[nr][nc]) continue

            const neighborKind = getCellKind(nr, nc)
            if (neighborKind === targetKind || neighborKind === 'STAR_PRISM') {
              visited[nr][nc] = true
              queue.push({ row: nr, col: nc })
            }
          }
        }

        if (component.length >= MIN_CLUSTER_SIZE) {
          component.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col))
          clusters.push({
            kind: targetKind,
            cells: component,
            hasWildcardStar,
          })
        }
      }
    }
  }

  // 2. Also detect pure STAR_PRISM clusters (>= 3 wildcard stars touching) if not already covered
  const coveredStarKeys = new Set<string>()
  for (const cluster of clusters) {
    for (const cell of cluster.cells) {
      coveredStarKeys.add(`${cell.row},${cell.col}`)
    }
  }

  const visitedStars = Array.from({ length: height }, () => Array<boolean>(width).fill(false))
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (visitedStars[r][c]) continue
      if (getCellKind(r, c) !== 'STAR_PRISM') continue

      const queue: Array<{ row: number; col: number }> = [{ row: r, col: c }]
      visitedStars[r][c] = true
      const starComponent: Array<{ row: number; col: number }> = []

      while (queue.length > 0) {
        const current = queue.shift()!
        starComponent.push(current)

        for (const [dr, dc] of ORTHOGONAL_DIRS) {
          const nr = current.row + dr
          const nc = current.col + dc
          if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue
          if (visitedStars[nr][nc]) continue
          if (getCellKind(nr, nc) === 'STAR_PRISM') {
            visitedStars[nr][nc] = true
            queue.push({ row: nr, col: nc })
          }
        }
      }

      const hasUncoveredStar = starComponent.some(
        (cell) => !coveredStarKeys.has(`${cell.row},${cell.col}`)
      )
      if (starComponent.length >= MIN_CLUSTER_SIZE && hasUncoveredStar) {
        starComponent.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col))
        clusters.push({
          kind: 'STAR_PRISM',
          cells: starComponent,
          hasWildcardStar: true,
        })
      }
    }
  }

  return clusters
}

function getClusterTupleLabel(count: number): string {
  if (count === 3) return 'Trio'
  if (count === 4) return 'Quarteto'
  if (count === 5) return 'Quinteto'
  return 'Super Cacho'
}

/**
 * Melhoria 02-A: Builds an agonistic, intuitive mathematical resonance formula
 * for each cascade wave (showing multiplication and distributive addition organically).
 */
export function buildWaveMathResonanceFormula(
  clusters: FruitCluster[],
  waveIndex: number,
  totalPoppedInWave: number
): string {
  if (clusters.length === 0) {
    return ''
  }

  if (clusters.length === 1) {
    const cluster = clusters[0]
    const n = totalPoppedInWave
    const meta = FRUIT_CATALOG[cluster.kind]
    const cachoLabel = getClusterTupleLabel(n)
    if (waveIndex === 1) {
      return `${n} × 1 = ${n} (${cachoLabel} ${meta.namePt})`
    }
    return `${n} × ${waveIndex} = ${n * waveIndex} (Cascata ×${waveIndex} ${meta.namePt}!)`
  }

  const sizes = clusters.map((c) => c.cells.length)
  const sumSizes = sizes.reduce((acc, val) => acc + val, 0)
  const cascadeLabel = clusters.length === 2 ? 'Cascata Dupla' : 'Cascata Múltipla'
  return `(${sizes.join(' + ')}) × ${waveIndex} = ${sumSizes * waveIndex} (${cascadeLabel} ×${waveIndex}!)`
}

function isGridCompletelyEmpty(grid: GridMatrix): boolean {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) return false
    }
  }
  return true
}

/**
 * Multi-wave deterministic cascade resolver (bounded by MAX_CASCADE_STEPS = 16, RT-13).
 * Applies column gravity before Wave 1 and after every pop wave, accumulating
 * CascadeWaves, scores, and streakDelta (+1 per wave).
 */
export function resolveFruitCascades(grid: GridMatrix): CascadeResolutionResult {
  let currentGrid = applyColumnGravityToFruits(grid).grid
  const waves: CascadeWave[] = []
  let totalPoppedBlocks = 0
  let totalScoreEarned = 0

  for (let step = 1; step <= MAX_CASCADE_STEPS; step++) {
    const clusters = findConnectedFruitClusters(currentGrid)
    if (clusters.length === 0) {
      break
    }

    const poppedKeySet = new Set<string>()
    const poppedCells: Array<{ row: number; col: number; kind: FruitKind; color: string }> = []

    for (const cluster of clusters) {
      for (const pos of cluster.cells) {
        const key = `${pos.row},${pos.col}`
        if (poppedKeySet.has(key)) continue
        poppedKeySet.add(key)

        const cell = currentGrid[pos.row]?.[pos.col]
        const cellKind = cell ? inferFruitKindFromCell(cell) : cluster.kind
        const meta = FRUIT_CATALOG[cellKind]
        poppedCells.push({
          row: pos.row,
          col: pos.col,
          kind: cellKind,
          color: cell?.color || meta.color,
        })
        currentGrid[pos.row][pos.col] = null
      }
    }

    const totalPoppedInWave = poppedCells.length
    const mathResonanceFormula = buildWaveMathResonanceFormula(
      clusters,
      step,
      totalPoppedInWave
    )
    const waveScore =
      totalPoppedInWave * 60 * step * (clusters.length > 1 ? 2 : 1)

    waves.push({
      waveIndex: step,
      clusters,
      poppedCells,
      totalPoppedInWave,
      mathResonanceFormula,
      waveScore,
    })

    totalPoppedBlocks += totalPoppedInWave
    totalScoreEarned += waveScore

    currentGrid = applyColumnGravityToFruits(currentGrid).grid
  }

  const isAllClear = totalPoppedBlocks > 0 && isGridCompletelyEmpty(currentGrid)
  if (isAllClear) {
    totalScoreEarned += 1200
  }

  return {
    grid: currentGrid,
    waves,
    totalPoppedBlocks,
    totalWaves: waves.length,
    totalScoreEarned,
    streakDelta: waves.length,
    isAllClear,
  }
}

/**
 * Locks a falling FruitPairPiece onto a cloned copy of `grid`, applies independent
 * column gravity so any overhanging half-pair drops to the bottom of its column,
 * and resolves all resulting cascade waves.
 */
export function lockFruitPairAndResolve(
  grid: GridMatrix,
  pair: FruitPairPiece
): CascadeResolutionResult {
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH
  const workingGrid = cloneGrid(grid)
  const pairCells = getFruitPairCells(pair)

  for (const item of pairCells) {
    if (item.row >= 0 && item.row < height && item.col >= 0 && item.col < width) {
      workingGrid[item.row][item.col] = createFruitGridCell(
        item.kind,
        Boolean(pair.isWildcardPair)
      )
    }
  }

  return resolveFruitCascades(workingGrid)
}

/**
 * Melhoria 02-A: Socratic Cascade Oracle.
 * Scans the board to identify:
 * - Orthogonal pairs of 2 matching fruits waiting for +1 to complete 2 + 1 = 3
 * - Which column (0..9) and fruit color produces the strongest immediate cascade
 * - Which fruit color is the most fragmented/populous (ideal target for [B] Fruit Magnet)
 * - A Socratic, Zero-Spoiler pedagogical hint.
 */
export function scanFruitCascadeOracle(grid: GridMatrix): FruitCascadeOracleReport {
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH

  // Count blocks and isolated components per playable fruit
  const fruitCounts: Record<FruitKind, number> = {
    APPLE_RUBY: 0,
    CITRUS_GOLD: 0,
    GRAPE_NEON: 0,
    EMERALD_PEAR: 0,
    BERRY_CYAN: 0,
    STAR_PRISM: 0,
  }

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r]?.[c] ?? null
      if (!cell) continue
      const kind = inferFruitKindFromCell(cell)
      fruitCounts[kind] = (fruitCounts[kind] ?? 0) + 1
    }
  }

  let mostFragmentedFruit: FruitKind = 'APPLE_RUBY'
  let fragmentedCount = 0
  for (const kind of PLAYABLE_FRUITS) {
    if (fruitCounts[kind] > fragmentedCount) {
      fragmentedCount = fruitCounts[kind]
      mostFragmentedFruit = kind
    }
  }

  // Detect connected pairs of size 2 that have at least one open neighbor or column drop
  let readyPairsCount = 0
  let bestFruit: FruitKind = mostFragmentedFruit
  let bestCol = 4
  let bestSimulatedScore = -1

  for (const kind of PLAYABLE_FRUITS) {
    const visited = Array.from({ length: height }, () => Array<boolean>(width).fill(false))
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (visited[r][c]) continue
        const cell = grid[r]?.[c] ?? null
        if (!cell || inferFruitKindFromCell(cell) !== kind) continue

        const queue: Array<{ row: number; col: number }> = [{ row: r, col: c }]
        visited[r][c] = true
        const comp: Array<{ row: number; col: number }> = []

        while (queue.length > 0) {
          const cur = queue.shift()!
          comp.push(cur)
          for (const [dr, dc] of ORTHOGONAL_DIRS) {
            const nr = cur.row + dr
            const nc = cur.col + dc
            if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue
            if (visited[nr][nc]) continue
            const nCell = grid[nr]?.[nc] ?? null
            if (nCell && inferFruitKindFromCell(nCell) === kind) {
              visited[nr][nc] = true
              queue.push({ row: nr, col: nc })
            }
          }
        }

        if (comp.length === 2) {
          const hasFreeNeighbor = comp.some((pos) =>
            ORTHOGONAL_DIRS.some(([dr, dc]) => {
              const nr = pos.row + dr
              const nc = pos.col + dc
              return nr >= 0 && nr < height && nc >= 0 && nc < width && grid[nr][nc] === null
            })
          )
          if (hasFreeNeighbor) {
            readyPairsCount += 1
          }
        }
      }
    }
  }

  // Simulate dropping a single block of each playable fruit in each column 0..9
  // to find the column + fruit with maximum cascade resonance
  for (const kind of PLAYABLE_FRUITS) {
    for (let col = 0; col < width; col++) {
      // Find lowest empty row in column
      let dropRow = -1
      for (let r = height - 1; r >= 0; r--) {
        if (grid[r][col] === null) {
          dropRow = r
          break
        }
      }
      if (dropRow < 0) continue

      const simGrid = cloneGrid(grid)
      simGrid[dropRow][col] = createFruitGridCell(kind)
      const simResult = resolveFruitCascades(simGrid)
      const candidateMetric =
        simResult.totalWaves * 1000 +
        simResult.totalPoppedBlocks * 100 +
        (fruitCounts[kind] > 0 ? 10 : 0)

      if (candidateMetric > bestSimulatedScore) {
        bestSimulatedScore = candidateMetric
        bestFruit = kind
        bestCol = col
      }
    }
  }

  const bestMeta = FRUIT_CATALOG[bestFruit]
  let pedagogicalHint: string
  if (readyPairsCount > 0 || bestSimulatedScore >= 1000) {
    pedagogicalHint = `💡 2 × ${bestMeta.namePt} (${bestMeta.emoji}) na col ${bestCol + 1}: falta +1 para fechar 2 + 1 = 3!`
  } else if (fragmentedCount > 0) {
    const fragMeta = FRUIT_CATALOG[mostFragmentedFruit]
    pedagogicalHint = `💡 ${fragmentedCount} × ${fragMeta.namePt} (${fragMeta.emoji}) no tabuleiro: use [B] Imã ou alinhe 2 + 1 = 3 na col ${bestCol + 1}!`
  } else {
    pedagogicalHint = `💡 Alinhe 3 frutas iguais (2 + 1 = 3) na col ${bestCol + 1} para iniciar uma cascata!`
  }

  return {
    recommendedFruit: bestFruit,
    recommendedCol: bestCol,
    readyPairsCount,
    mostFragmentedFruit,
    fragmentedCount,
    pedagogicalHint,
  }
}

/**
 * Miracle [M] in FRUIT_MATCH: Transmutes the active FruitPairPiece into either a
 * double-wildcard STAR_PRISM pair (✦ + ✦) or a double pair of the target fruit color,
 * granting 1400ms of grace float.
 */
export function morphFruitPairToWildcardOrTarget(
  pair: FruitPairPiece,
  targetKind: FruitKind = 'STAR_PRISM'
): FruitPairPiece {
  return {
    ...pair,
    primary: targetKind,
    secondary: targetKind,
    isWildcardPair: targetKind === 'STAR_PRISM',
    graceFloatMs: GRACE_FLOAT_AFTER_FRUIT_MORPH_MS,
  }
}

/**
 * Melhoria 02-B — Miracle [B] (Imã de Frutas / Magnetic Color Collapse):
 * Identifies `targetKind` (or automatically the most fragmented/populous fruit color
 * on the board), pops all blocks of that color across the entire board in Wave 1
 * (even isolated or buried ones!), applies column gravity, and resolves any secondary cascades!
 */
export function magnetizeSingleFruitColor(
  grid: GridMatrix,
  targetKind?: FruitKind
): CascadeResolutionResult {
  let workingGrid = applyColumnGravityToFruits(grid).grid
  const height = workingGrid.length
  const width = workingGrid[0]?.length ?? BOARD_WIDTH

  const oracle = scanFruitCascadeOracle(workingGrid)
  const chosenKind: FruitKind =
    targetKind && targetKind !== 'STAR_PRISM' ? targetKind : oracle.mostFragmentedFruit

  let matchingCells: Array<{ row: number; col: number }> = []
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = workingGrid[r]?.[c] ?? null
      if (!cell) continue
      if (inferFruitKindFromCell(cell) === chosenKind) {
        matchingCells.push({ row: r, col: c })
      }
    }
  }

  // Fallback if chosenKind had 0 blocks on board: pick any occupied fruit color
  let effectiveKind = chosenKind
  if (matchingCells.length === 0) {
    effectiveKind = oracle.mostFragmentedFruit
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const cell = workingGrid[r]?.[c] ?? null
        if (!cell) continue
        if (inferFruitKindFromCell(cell) === effectiveKind) {
          matchingCells.push({ row: r, col: c })
        }
      }
    }
  }

  if (matchingCells.length === 0) {
    return {
      grid: workingGrid,
      waves: [],
      totalPoppedBlocks: 0,
      totalWaves: 0,
      totalScoreEarned: 0,
      streakDelta: 0,
      isAllClear: isGridCompletelyEmpty(workingGrid),
    }
  }

  const meta = FRUIT_CATALOG[effectiveKind]
  const poppedCells: Array<{ row: number; col: number; kind: FruitKind; color: string }> = []
  for (const pos of matchingCells) {
    const cell = workingGrid[pos.row]?.[pos.col]
    poppedCells.push({
      row: pos.row,
      col: pos.col,
      kind: effectiveKind,
      color: cell?.color || meta.color,
    })
    workingGrid[pos.row][pos.col] = null
  }

  const n = poppedCells.length
  const magnetWave: CascadeWave = {
    waveIndex: 1,
    clusters: [
      {
        kind: effectiveKind,
        cells: matchingCells,
        hasWildcardStar: false,
      },
    ],
    poppedCells,
    totalPoppedInWave: n,
    mathResonanceFormula: `${n} × 1 = ${n} (Imã Magnético ${meta.namePt}!)`,
    waveScore: n * 75,
  }

  workingGrid = applyColumnGravityToFruits(workingGrid).grid
  const secondary = resolveFruitCascades(workingGrid)

  const shiftedWaves: CascadeWave[] = secondary.waves.map((w) => {
    const nextIdx = w.waveIndex + 1
    return {
      ...w,
      waveIndex: nextIdx,
      mathResonanceFormula: buildWaveMathResonanceFormula(
        w.clusters,
        nextIdx,
        w.totalPoppedInWave
      ),
      waveScore:
        w.totalPoppedInWave * 60 * nextIdx * (w.clusters.length > 1 ? 2 : 1),
    }
  })

  const allWaves = [magnetWave, ...shiftedWaves]
  const totalPoppedBlocks = allWaves.reduce((acc, w) => acc + w.totalPoppedInWave, 0)
  const isAllClear = totalPoppedBlocks > 0 && isGridCompletelyEmpty(secondary.grid)
  const totalScoreEarned =
    allWaves.reduce((acc, w) => acc + w.waveScore, 0) + (isAllClear ? 1200 : 0)

  return {
    grid: secondary.grid,
    waves: allWaves,
    totalPoppedBlocks,
    totalWaves: allWaves.length,
    totalScoreEarned,
    streakDelta: allWaves.length,
    isAllClear,
  }
}

/**
 * Phoenix Second Wind Miracle in FRUIT_MATCH:
 * Collapses the 2 most populous fruit colors on the board in a massive purification wave,
 * applies column gravity, and resolves any secondary cascades.
 */
export function purifyTopTwoFruitColors(grid: GridMatrix): CascadeResolutionResult {
  let workingGrid = applyColumnGravityToFruits(grid).grid
  const height = workingGrid.length
  const width = workingGrid[0]?.length ?? BOARD_WIDTH

  const cellsByKind = new Map<FruitKind, Array<{ row: number; col: number }>>()
  for (const kind of ALL_FRUIT_KINDS) {
    cellsByKind.set(kind, [])
  }

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = workingGrid[r]?.[c] ?? null
      if (!cell) continue
      const kind = inferFruitKindFromCell(cell)
      cellsByKind.get(kind)?.push({ row: r, col: c })
    }
  }

  const sortedKinds = [...ALL_FRUIT_KINDS]
    .map((kind) => ({ kind, cells: cellsByKind.get(kind) ?? [] }))
    .filter((entry) => entry.cells.length > 0)
    .sort((a, b) => b.cells.length - a.cells.length)

  const topTwo = sortedKinds.slice(0, 2)
  if (topTwo.length === 0) {
    return {
      grid: workingGrid,
      waves: [],
      totalPoppedBlocks: 0,
      totalWaves: 0,
      totalScoreEarned: 0,
      streakDelta: 0,
      isAllClear: true,
    }
  }

  const clusters: FruitCluster[] = []
  const poppedCells: Array<{ row: number; col: number; kind: FruitKind; color: string }> = []

  for (const entry of topTwo) {
    const meta = FRUIT_CATALOG[entry.kind]
    clusters.push({
      kind: entry.kind,
      cells: entry.cells,
      hasWildcardStar: entry.kind === 'STAR_PRISM',
    })
    for (const pos of entry.cells) {
      const cell = workingGrid[pos.row]?.[pos.col]
      poppedCells.push({
        row: pos.row,
        col: pos.col,
        kind: entry.kind,
        color: cell?.color || meta.color,
      })
      workingGrid[pos.row][pos.col] = null
    }
  }

  const totalInFirstWave = poppedCells.length
  const formula =
    clusters.length >= 2
      ? `(${clusters[0].cells.length} + ${clusters[1].cells.length}) × 1 = ${totalInFirstWave} (Fênix Purificadora!)`
      : `${totalInFirstWave} × 1 = ${totalInFirstWave} (Fênix Purificadora!)`

  const phoenixWave: CascadeWave = {
    waveIndex: 1,
    clusters,
    poppedCells,
    totalPoppedInWave: totalInFirstWave,
    mathResonanceFormula: formula,
    waveScore: totalInFirstWave * 90,
  }

  workingGrid = applyColumnGravityToFruits(workingGrid).grid
  const secondary = resolveFruitCascades(workingGrid)

  const shiftedWaves: CascadeWave[] = secondary.waves.map((w) => {
    const nextIdx = w.waveIndex + 1
    return {
      ...w,
      waveIndex: nextIdx,
      mathResonanceFormula: buildWaveMathResonanceFormula(
        w.clusters,
        nextIdx,
        w.totalPoppedInWave
      ),
      waveScore:
        w.totalPoppedInWave * 60 * nextIdx * (w.clusters.length > 1 ? 2 : 1),
    }
  })

  const allWaves = [phoenixWave, ...shiftedWaves]
  const totalPoppedBlocks = allWaves.reduce((acc, w) => acc + w.totalPoppedInWave, 0)
  const isAllClear = totalPoppedBlocks > 0 && isGridCompletelyEmpty(secondary.grid)
  const totalScoreEarned =
    allWaves.reduce((acc, w) => acc + w.waveScore, 0) + (isAllClear ? 1200 : 0)

  return {
    grid: secondary.grid,
    waves: allWaves,
    totalPoppedBlocks,
    totalWaves: allWaves.length,
    totalScoreEarned,
    streakDelta: allWaves.length,
    isAllClear,
  }
}

/**
 * Melhoria 02-C: Bidirectional Polymorphic Converter (`decorateGridWithFruits`).
 * Assigns vibrant, deterministic fruit identities to all existing blocks when transitioning
 * from TETRIS_CLASSIC or TACTILE_GRID into FRUIT_MATCH, ensuring zero involuntary clusters
 * of >= 3 on Frame 0 (`findConnectedFruitClusters(decorated).length === 0`).
 */
export function decorateGridWithFruits(grid: GridMatrix): GridMatrix {
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH
  const decorated = cloneGrid(grid)

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = decorated[r]?.[c] ?? null
      if (!cell) continue

      const basePreferred = inferFruitKindFromCell(cell)
      const baseIdx = Math.max(0, PLAYABLE_FRUITS.indexOf(basePreferred))

      // Count how many matching neighbors each candidate fruit would connect with among already-processed cells
      let chosenKind: FruitKind = PLAYABLE_FRUITS[(baseIdx + r + c) % PLAYABLE_FRUITS.length]

      for (let offset = 0; offset < PLAYABLE_FRUITS.length; offset++) {
        const candidate = PLAYABLE_FRUITS[(baseIdx + r * 2 + c + offset) % PLAYABLE_FRUITS.length]
        const leftKind = c > 0 && decorated[r][c - 1] ? decorated[r][c - 1]!.fruitKind : null
        const upKind = r > 0 && decorated[r - 1][c] ? decorated[r - 1][c]!.fruitKind : null

        if (candidate !== leftKind && candidate !== upKind) {
          chosenKind = candidate
          break
        }
      }

      const meta = FRUIT_CATALOG[chosenKind]
      decorated[r][c] = {
        ...cell,
        fruitKind: chosenKind,
        color: meta.color,
        glowColor: meta.glowColor,
        borderColor: meta.borderColor,
        symbol: meta.symbol,
        isSealedHole: false,
      }
    }
  }

  // Safety pass: guarantee 0 accidental >= 3 clusters on frame 0
  for (let guard = 0; guard < 8; guard++) {
    const accidentalClusters = findConnectedFruitClusters(decorated)
    if (accidentalClusters.length === 0) break

    for (const cluster of accidentalClusters) {
      const targetCellPos = cluster.cells[Math.floor(cluster.cells.length / 2)] ?? cluster.cells[0]
      if (!targetCellPos) continue
      const { row, col } = targetCellPos
      const neighborKinds = new Set<FruitKind>()
      for (const [dr, dc] of ORTHOGONAL_DIRS) {
        const nr = row + dr
        const nc = col + dc
        const nCell = decorated[nr]?.[nc] ?? null
        if (nCell?.fruitKind) {
          neighborKinds.add(nCell.fruitKind)
        }
      }

      const safeKind =
        PLAYABLE_FRUITS.find((k) => !neighborKinds.has(k) && k !== cluster.kind) ??
        PLAYABLE_FRUITS[0]
      const meta = FRUIT_CATALOG[safeKind]
      const existing = decorated[row][col]
      if (existing) {
        decorated[row][col] = {
          ...existing,
          fruitKind: safeKind,
          color: meta.color,
          glowColor: meta.glowColor,
          borderColor: meta.borderColor,
          symbol: meta.symbol,
          isSealedHole: false,
        }
      }
    }
  }

  return decorated
}
