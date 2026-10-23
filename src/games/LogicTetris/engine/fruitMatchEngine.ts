import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CascadeResolutionResult,
  CascadeWave,
  FruitBlockMeta,
  FruitCascadeOracleReport,
  FruitCluster,
  FruitCoord,
  FruitKind,
  FruitPairPiece,
  FruitSwapMove,
  FruitSwapResolutionResult,
  GridCell,
  GridMatrix,
  RotationDirection,
} from '../types'
import { cloneGrid, createEmptyGrid } from './gridEngine'

/**
 * Dimensões da Arena 10×10 Cheia de Frutas (Swap & Cascade Match-3).
 * Opera nas linhas 0..9 e colunas 0..9 (100 células visíveis em tela cheia sem cortes!).
 */
export const FRUIT_GRID_ROWS = 10
export const FRUIT_GRID_COLS = 10

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
    case 'CORNER_3X3':
      return 'APPLE_RUBY'
    case 'L':
    case 'O':
    case 'DOT_1X1':
    case 'CUBE_3X3':
      return 'CITRUS_GOLD'
    case 'T':
    case 'DOMINO_1X2':
    case 'RECT_2X3':
      return 'GRAPE_NEON'
    case 'S':
    case 'CORNER_2X2':
      return 'EMERALD_PEAR'
    case 'I':
    case 'J':
    case 'BAR_1X5':
    case 'TRIO_1X3':
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
 * Detecta se o GridMatrix está operando no modo Arena 10×10 Cheia de Frutas (rows 0..9 ativas, rows 10..19 vazias).
 */
export function is10x10FruitArenaGrid(grid: GridMatrix): boolean {
  let top10Count = 0
  let bottom10Count = 0
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r]?.[c] !== null) {
        if (r < FRUIT_GRID_ROWS) {
          top10Count += 1
        } else {
          bottom10Count += 1
        }
      }
    }
  }

  return top10Count > 0 && bottom10Count === 0
}

/**
 * Quebra quaisquer grupos involuntários de 3+ frutas iguais que tenham surgido estaticamente
 * nas linhas 0..9 sem explodi-los, garantindo estado estacionário limpo após reposição ou no Frame 0.
 */
function breakAccidentalFruitClusters10x10(grid: GridMatrix): GridMatrix {
  const working = cloneGrid(grid)
  for (let guard = 0; guard < 16; guard++) {
    const clusters = findConnectedFruitClusters(working)
    if (clusters.length === 0) break

    for (const cluster of clusters) {
      const targetPos = cluster.cells[Math.floor(cluster.cells.length / 2)] ?? cluster.cells[0]
      if (!targetPos) continue
      const { row, col } = targetPos
      const neighborKinds = new Set<FruitKind>()
      for (const [dr, dc] of ORTHOGONAL_DIRS) {
        const nr = row + dr
        const nc = col + dc
        const nCell = working[nr]?.[nc] ?? null
        if (nCell) {
          neighborKinds.add(inferFruitKindFromCell(nCell))
        }
      }

      const safeKind =
        PLAYABLE_FRUITS.find((k) => !neighborKinds.has(k) && k !== cluster.kind) ??
        PLAYABLE_FRUITS[(PLAYABLE_FRUITS.indexOf(cluster.kind) + 1) % PLAYABLE_FRUITS.length]
      working[row][col] = createFruitGridCell(safeKind)
    }
  }
  return working
}

/**
 * Gravidade & Reposição pelo Topo na Arena 10×10 (`rows 0..9, cols 0..9`).
 * Quando um grupo de 3+ frutas explode, as frutas acima descem até a linha 9 (base da Arena 10×10)
 * e novas frutas nascem no topo (linhas 0..k) para manter as 100 células cheias!
 */
export function applyFruitGravityAndRefill10x10(
  grid: GridMatrix,
  rng: () => number = Math.random
): { grid: GridMatrix; movedCount: number; spawnedCount: number } {
  const nextGrid = createEmptyGrid(BOARD_HEIGHT, BOARD_WIDTH)
  let movedCount = 0
  let spawnedCount = 0

  for (let col = 0; col < FRUIT_GRID_COLS; col++) {
    let writeRow = FRUIT_GRID_ROWS - 1
    for (let readRow = FRUIT_GRID_ROWS - 1; readRow >= 0; readRow--) {
      const cell = grid[readRow]?.[col] ?? null
      if (!cell) continue

      const kind = inferFruitKindFromCell(cell)
      const meta = FRUIT_CATALOG[kind]
      nextGrid[writeRow][col] = {
        ...cell,
        fruitKind: kind,
        color: cell.color || meta.color,
        glowColor: cell.glowColor || meta.glowColor,
        borderColor: cell.borderColor || meta.borderColor,
        symbol: cell.symbol || meta.symbol,
      }
      if (writeRow !== readRow) {
        movedCount += 1
      }
      writeRow -= 1
    }

    // Reposição pelo topo: preenche as células vazias no topo da coluna (writeRow..0)
    while (writeRow >= 0) {
      const randomBaseIdx = Math.floor(rng() * PLAYABLE_FRUITS.length)
      let chosenKind = PLAYABLE_FRUITS[randomBaseIdx] ?? 'APPLE_RUBY'

      // Evita sequências triviais excessivas na geração de topo mas permite cascatas orgânicas
      const below1 =
        writeRow + 1 < FRUIT_GRID_ROWS && nextGrid[writeRow + 1]?.[col]
          ? inferFruitKindFromCell(nextGrid[writeRow + 1][col]!)
          : null
      const below2 =
        writeRow + 2 < FRUIT_GRID_ROWS && nextGrid[writeRow + 2]?.[col]
          ? inferFruitKindFromCell(nextGrid[writeRow + 2][col]!)
          : null
      if (below1 && below1 === below2 && chosenKind === below1 && rng() < 0.65) {
        chosenKind = PLAYABLE_FRUITS[(randomBaseIdx + 1) % PLAYABLE_FRUITS.length]
      }

      nextGrid[writeRow][col] = createFruitGridCell(chosenKind)
      spawnedCount += 1
      writeRow -= 1
    }
  }

  return { grid: nextGrid, movedCount, spawnedCount }
}

/**
 * Escaneia todas as trocas ortogonais adjacentes nas linhas 0..9 e colunas 0..9
 * que formam imediatamente um grupo >= 3 de frutas iguais (ou usam uma Estrela Coringa ✦).
 */
export function findAllValidFruitSwaps(grid: GridMatrix): FruitSwapMove[] {
  const swaps: FruitSwapMove[] = []
  const maxRow = Math.min(FRUIT_GRID_ROWS, grid.length || BOARD_HEIGHT)
  const maxCol = Math.min(FRUIT_GRID_COLS, grid[0]?.length ?? BOARD_WIDTH)

  const checkCandidateSwap = (r1: number, c1: number, r2: number, c2: number) => {
    const cellA = grid[r1]?.[c1] ?? null
    const cellB = grid[r2]?.[c2] ?? null
    if (!cellA || !cellB) return

    const kindA = inferFruitKindFromCell(cellA)
    const kindB = inferFruitKindFromCell(cellB)
    if (kindA === kindB && kindA !== 'STAR_PRISM') return

    // Se uma das duas células é Estrela Coringa (✦), trocar com qualquer fruta adjacente é sempre válido!
    if (kindA === 'STAR_PRISM' || kindB === 'STAR_PRISM') {
      const targetKind = kindA === 'STAR_PRISM' ? kindB : kindA
      swaps.push({
        from: { row: r1, col: c1 },
        to: { row: r2, col: c2 },
        expectedClusterSize: 4,
        fruitKind: targetKind,
      })
      return
    }

    const simGrid = cloneGrid(grid)
    simGrid[r1][c1] = cellB
    simGrid[r2][c2] = cellA

    const clusters = findConnectedFruitClusters(simGrid)
    if (clusters.length > 0) {
      let bestCluster = clusters[0]
      for (const cl of clusters) {
        if (cl.cells.length > bestCluster.cells.length) {
          bestCluster = cl
        }
      }
      swaps.push({
        from: { row: r1, col: c1 },
        to: { row: r2, col: c2 },
        expectedClusterSize: bestCluster.cells.length,
        fruitKind: bestCluster.kind,
      })
    }
  }

  for (let r = 0; r < maxRow; r++) {
    for (let c = 0; c < maxCol; c++) {
      if (c + 1 < maxCol) {
        checkCandidateSwap(r, c, r, c + 1)
      }
      if (r + 1 < maxRow) {
        checkCandidateSwap(r, c, r + 1, c)
      }
    }
  }

  swaps.sort((a, b) => b.expectedClusterSize - a.expectedClusterSize)
  return swaps
}

/**
 * Garante que a Arena 10×10 tenha pelo menos `minSwaps` trocas adjacentes válidas prontas
 * e 0 grupos auto-explosivos em repouso (Prevenção RT-17 de Deadlock).
 */
export function ensureMinimumValidSwaps(
  grid: GridMatrix,
  minSwaps: number = 4,
  rng: () => number = Math.random
): { grid: GridMatrix; swaps: FruitSwapMove[]; wasReshuffled: boolean } {
  let working = breakAccidentalFruitClusters10x10(grid)
  let swaps = findAllValidFruitSwaps(working)
  if (swaps.length >= minSwaps) {
    return { grid: working, swaps, wasReshuffled: false }
  }

  // Injeta padrões V / L de "2 + 1 a um passo de distância" em regiões espaçadas da Arena 10×10
  const anchorCandidates: Array<{ r: number; c: number; kindIdx: number }> = [
    { r: 1, c: 1, kindIdx: 0 },
    { r: 2, c: 5, kindIdx: 1 },
    { r: 4, c: 2, kindIdx: 2 },
    { r: 5, c: 6, kindIdx: 3 },
    { r: 7, c: 1, kindIdx: 4 },
    { r: 7, c: 5, kindIdx: 0 },
    { r: 3, c: 4, kindIdx: 1 },
    { r: 8, c: 3, kindIdx: 2 },
  ]

  const offsetSeed = Math.floor(rng() * PLAYABLE_FRUITS.length)
  for (const anchor of anchorCandidates) {
    const { r, c, kindIdx } = anchor
    if (r + 1 >= FRUIT_GRID_ROWS || c + 2 >= FRUIT_GRID_COLS) continue

    const targetKind = PLAYABLE_FRUITS[(kindIdx + offsetSeed) % PLAYABLE_FRUITS.length]
    const blockerKind = PLAYABLE_FRUITS[(kindIdx + offsetSeed + 2) % PLAYABLE_FRUITS.length]

    // Padrão: (r, c) = K, (r, c+1) = K, (r, c+2) = Blocker, (r+1, c+2) = K
    // Assim, trocar (r, c+2) <-> (r+1, c+2) fecha a linha (r, c..c+2) de 3 frutas K!
    working[r][c] = createFruitGridCell(targetKind)
    working[r][c + 1] = createFruitGridCell(targetKind)
    working[r][c + 2] = createFruitGridCell(blockerKind)
    working[r + 1][c + 2] = createFruitGridCell(targetKind)

    working = breakAccidentalFruitClusters10x10(working)
    swaps = findAllValidFruitSwaps(working)
    if (swaps.length >= minSwaps) {
      break
    }
  }

  return { grid: working, swaps, wasReshuffled: true }
}

/**
 * Gera uma Arena 10×10 (`rows 0..9, cols 0..9` = 100 células) 100% preenchida com frutas vibrantes!
 * Se `seedGrid` possuir blocos sobreviventes (ex: após eliminar 80% na troca de cenário),
 * preserva-os como sementes de frutas na Arena 10×10 e preenche o restante garantindo:
 * - Zero grupos de >= 3 auto-explosivos no Frame 0
 * - Pelo menos 6 trocas adjacentes válidas prontas para o jogador fazer combos!
 */
export function generatePlayableFruitBoard10x10(
  seedGrid?: GridMatrix,
  rng: () => number = Math.random
): GridMatrix {
  const board = createEmptyGrid(BOARD_HEIGHT, BOARD_WIDTH)

  // Se houver blocos sementes, traz até 15 blocos sobreviventes para as linhas 0..9
  if (seedGrid) {
    const height = seedGrid.length || BOARD_HEIGHT
    const width = seedGrid[0]?.length ?? BOARD_WIDTH
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < Math.min(FRUIT_GRID_COLS, width); c++) {
        const cell = seedGrid[r]?.[c] ?? null
        if (!cell) continue
        const targetRow = r < FRUIT_GRID_ROWS ? r : r - (height - FRUIT_GRID_ROWS)
        if (targetRow >= 0 && targetRow < FRUIT_GRID_ROWS) {
          const kind = inferFruitKindFromCell(cell)
          board[targetRow][c] = createFruitGridCell(kind, Boolean(cell.isMorphedBlock))
        }
      }
    }
  }

  // Preenche todas as 100 células (rows 0..9, cols 0..9) evitando trios imediatos
  for (let r = 0; r < FRUIT_GRID_ROWS; r++) {
    for (let c = 0; c < FRUIT_GRID_COLS; c++) {
      const existing = board[r][c]
      const baseIdx = existing
        ? Math.max(0, PLAYABLE_FRUITS.indexOf(inferFruitKindFromCell(existing)))
        : Math.floor(rng() * PLAYABLE_FRUITS.length)

      let chosenKind: FruitKind = PLAYABLE_FRUITS[baseIdx % PLAYABLE_FRUITS.length]

      for (let offset = 0; offset < PLAYABLE_FRUITS.length; offset++) {
        const candidate = PLAYABLE_FRUITS[(baseIdx + offset) % PLAYABLE_FRUITS.length]
        const left1 = c >= 1 && board[r][c - 1] ? inferFruitKindFromCell(board[r][c - 1]!) : null
        const left2 = c >= 2 && board[r][c - 2] ? inferFruitKindFromCell(board[r][c - 2]!) : null
        const up1 = r >= 1 && board[r - 1][c] ? inferFruitKindFromCell(board[r - 1][c]!) : null
        const up2 = r >= 2 && board[r - 2][c] ? inferFruitKindFromCell(board[r - 2][c]!) : null

        const formsHoriz3 = left1 === candidate && left2 === candidate
        const formsVert3 = up1 === candidate && up2 === candidate
        const formsCorner3 =
          left1 === candidate &&
          up1 === candidate &&
          ((c >= 1 && r >= 1 && board[r - 1][c - 1] && inferFruitKindFromCell(board[r - 1][c - 1]!) === candidate) ||
            left1 === up1)

        if (!formsHoriz3 && !formsVert3 && !formsCorner3) {
          chosenKind = candidate
          break
        }
      }

      board[r][c] = createFruitGridCell(chosenKind)
    }
  }

  const ensured = ensureMinimumValidSwaps(board, 6, rng)
  return ensured.grid
}

/**
 * Resolve ondas em cascata na Arena 10×10 com gravidade e reposição automática de frutas pelo topo!
 * Limitado por `MAX_CASCADE_STEPS = 16` (RT-13) e garante estado final estável com >= 4 trocas válidas.
 */
export function resolveFruitCascades10x10WithRefill(
  grid: GridMatrix,
  rng: () => number = Math.random
): CascadeResolutionResult {
  let currentGrid = cloneGrid(grid)
  // Limpa linhas 10..19 por segurança na Arena 10×10
  for (let r = FRUIT_GRID_ROWS; r < currentGrid.length; r++) {
    for (let c = 0; c < currentGrid[r].length; c++) {
      currentGrid[r][c] = null
    }
  }

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
        if (pos.row >= FRUIT_GRID_ROWS) continue
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

    if (poppedCells.length === 0) {
      break
    }

    const totalPoppedInWave = poppedCells.length
    const mathResonanceFormula = buildWaveMathResonanceFormula(
      clusters,
      step,
      totalPoppedInWave
    )
    const waveScore =
      totalPoppedInWave * 65 * step * (clusters.length > 1 ? 2 : 1)

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

    // Frutas acima descem e novas frutas entram pelo topo da Arena 10×10!
    currentGrid = applyFruitGravityAndRefill10x10(currentGrid, rng).grid
  }

  // Após todas as cascatas, estabiliza a Arena 10×10 com 0 auto-pops pendentes e >= 4 trocas válidas
  const stabilized = ensureMinimumValidSwaps(currentGrid, 4, rng)

  return {
    grid: stabilized.grid,
    waves,
    totalPoppedBlocks,
    totalWaves: waves.length,
    totalScoreEarned,
    streakDelta: waves.length,
    isAllClear: false,
  }
}

/**
 * Troca duas frutas ortogonalmente adjacentes (`|dr| + |dc| === 1`) na Arena 10×10 (`rows 0..9, cols 0..9`).
 * - Se formar pelo menos 1 grupo de 3+ frutas iguais (ou envolver Estrela Coringa ✦), explode os grupos,
 *   desce as frutas acima, repõe novas frutas pelo topo e resolve cascatas em cadeia!
 * - Se não formar grupo >= 3, retorna `validSwap: false` mantendo o tabuleiro intacto (bounce elástico).
 */
export function swapAdjacentFruitsAndResolve(
  grid: GridMatrix,
  from: FruitCoord,
  to: FruitCoord,
  rng: () => number = Math.random
): FruitSwapResolutionResult {
  const dr = Math.abs(from.row - to.row)
  const dc = Math.abs(from.col - to.col)
  if (
    dr + dc !== 1 ||
    from.row < 0 ||
    from.row >= FRUIT_GRID_ROWS ||
    to.row < 0 ||
    to.row >= FRUIT_GRID_ROWS ||
    from.col < 0 ||
    from.col >= FRUIT_GRID_COLS ||
    to.col < 0 ||
    to.col >= FRUIT_GRID_COLS
  ) {
    const currentSwaps = findAllValidFruitSwaps(grid)
    return {
      validSwap: false,
      grid: cloneGrid(grid),
      waves: [],
      totalPoppedBlocks: 0,
      totalWaves: 0,
      totalScoreEarned: 0,
      streakDelta: 0,
      remainingValidSwaps: currentSwaps.length,
      wasBoardReshuffled: false,
    }
  }

  const workingGrid = cloneGrid(grid)
  const cellFrom = workingGrid[from.row]?.[from.col] ?? null
  const cellTo = workingGrid[to.row]?.[to.col] ?? null

  if (!cellFrom || !cellTo) {
    const currentSwaps = findAllValidFruitSwaps(grid)
    return {
      validSwap: false,
      grid: cloneGrid(grid),
      waves: [],
      totalPoppedBlocks: 0,
      totalWaves: 0,
      totalScoreEarned: 0,
      streakDelta: 0,
      remainingValidSwaps: currentSwaps.length,
      wasBoardReshuffled: false,
    }
  }

  workingGrid[from.row][from.col] = cellTo
  workingGrid[to.row][to.col] = cellFrom

  const kindFrom = inferFruitKindFromCell(cellFrom)
  const kindTo = inferFruitKindFromCell(cellTo)

  // Se uma das frutas trocadas for Estrela Coringa (✦), garante formação de trio estelar com a cor parceira
  if (kindFrom === 'STAR_PRISM' || kindTo === 'STAR_PRISM') {
    const partnerKind: FruitKind =
      kindFrom === 'STAR_PRISM'
        ? kindTo === 'STAR_PRISM'
          ? 'APPLE_RUBY'
          : kindTo
        : kindFrom
    const initialClusters = findConnectedFruitClusters(workingGrid)
    if (initialClusters.length === 0) {
      let harmonized = 0
      for (const [nrDelta, ncDelta] of ORTHOGONAL_DIRS) {
        const nr = to.row + nrDelta
        const nc = to.col + ncDelta
        if (
          nr >= 0 &&
          nr < FRUIT_GRID_ROWS &&
          nc >= 0 &&
          nc < FRUIT_GRID_COLS &&
          !(nr === from.row && nc === from.col)
        ) {
          workingGrid[nr][nc] = createFruitGridCell(partnerKind, true)
          harmonized += 1
          if (harmonized >= 2) break
        }
      }
    }
  }

  const clustersAfterSwap = findConnectedFruitClusters(workingGrid)
  if (clustersAfterSwap.length === 0) {
    const currentSwaps = findAllValidFruitSwaps(grid)
    return {
      validSwap: false,
      grid: cloneGrid(grid),
      waves: [],
      totalPoppedBlocks: 0,
      totalWaves: 0,
      totalScoreEarned: 0,
      streakDelta: 0,
      remainingValidSwaps: currentSwaps.length,
      wasBoardReshuffled: false,
    }
  }

  const cascadeResult = resolveFruitCascades10x10WithRefill(workingGrid, rng)
  const finalSwaps = findAllValidFruitSwaps(cascadeResult.grid)

  return {
    validSwap: true,
    grid: cascadeResult.grid,
    waves: cascadeResult.waves,
    totalPoppedBlocks: cascadeResult.totalPoppedBlocks,
    totalWaves: cascadeResult.totalWaves,
    totalScoreEarned: cascadeResult.totalScoreEarned,
    streakDelta: cascadeResult.streakDelta,
    remainingValidSwaps: finalSwaps.length,
    wasBoardReshuffled: false,
  }
}

/**
 * Milagre [M] na Arena 10×10 de Frutas:
 * Materializa `count` Estrelas Coringa Douradas (`STAR_PRISM` ✦) em posições estratégicas
 * nas linhas 0..9, permitindo que o jogador troque a Estrela com qualquer fruta vizinha!
 */
export function forgeWildcardStarsOnBoard(
  grid: GridMatrix,
  count: number = 2,
  focusCoord?: FruitCoord
): GridMatrix {
  const working = cloneGrid(grid)
  const candidates: FruitCoord[] = []

  if (
    focusCoord &&
    focusCoord.row >= 0 &&
    focusCoord.row < FRUIT_GRID_ROWS &&
    focusCoord.col >= 0 &&
    focusCoord.col < FRUIT_GRID_COLS
  ) {
    candidates.push(focusCoord)
  }

  const swaps = findAllValidFruitSwaps(working)
  for (const sw of swaps) {
    candidates.push(sw.from)
  }

  // Adiciona posições centrais caso faltem candidatos
  const fallbackCoords: FruitCoord[] = [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
    { row: 5, col: 4 },
    { row: 3, col: 5 },
  ]
  for (const fb of fallbackCoords) {
    candidates.push(fb)
  }

  let forged = 0
  const usedKeys = new Set<string>()
  for (const coord of candidates) {
    if (forged >= count) break
    const key = `${coord.row},${coord.col}`
    if (usedKeys.has(key)) continue
    usedKeys.add(key)

    const cell = working[coord.row]?.[coord.col]
    if (cell && inferFruitKindFromCell(cell) === 'STAR_PRISM') continue

    working[coord.row][coord.col] = createFruitGridCell('STAR_PRISM', true)
    forged += 1
  }

  return working
}

/**
 * Melhoria 02-A: Socratic Cascade Oracle.
 * Scans the board to identify:
 * - No modo 10×10 Swap-Fruit: Todas as trocas adjacentes válidas (`findAllValidFruitSwaps`),
 *   destacando a melhor troca 2 + 1 = 3 sem dar spoiler automático.
 * - Qual cor de fruta está mais espalhada/populosa (alvo ideal do Imã [B]).
 */
export function scanFruitCascadeOracle(grid: GridMatrix): FruitCascadeOracleReport {
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH

  // Count blocks per playable fruit
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

  // Se estamos na Arena 10×10 Cheia de Frutas (rows 0..9), escaneia as trocas ortogonais diretas!
  if (is10x10FruitArenaGrid(grid)) {
    const swaps = findAllValidFruitSwaps(grid)
    const bestSwap = swaps[0] ?? null
    const bestFruit = bestSwap?.fruitKind ?? mostFragmentedFruit
    const bestCol = bestSwap?.to.col ?? 4
    const bestMeta = FRUIT_CATALOG[bestFruit]

    let pedagogicalHint: string
    if (bestSwap) {
      const rLabel = bestSwap.from.row + 1
      const c1Label = bestSwap.from.col + 1
      const c2Label = bestSwap.to.col + 1
      const axisDesc =
        bestSwap.from.row === bestSwap.to.row
          ? `linha ${rLabel} (col ${c1Label} ↔ col ${c2Label})`
          : `coluna ${c1Label} (linha ${bestSwap.from.row + 1} ↕ linha ${bestSwap.to.row + 1})`
      pedagogicalHint = `💡 Troque ${bestMeta.emoji} ${bestMeta.namePt} na ${axisDesc} para fechar ${bestSwap.expectedClusterSize} frutas (${swaps.length} trocas prontas)!`
    } else {
      const fragMeta = FRUIT_CATALOG[mostFragmentedFruit]
      pedagogicalHint = `💡 ${fragmentedCount} × ${fragMeta.namePt} (${fragMeta.emoji}) na Arena 10×10: use [B] Imã ou troque frutas vizinhas!`
    }

    return {
      recommendedFruit: bestFruit,
      recommendedCol: bestCol,
      readyPairsCount: swaps.length,
      mostFragmentedFruit,
      fragmentedCount,
      pedagogicalHint,
      bestSwap,
      validSwapsCount: swaps.length,
    }
  }

  // Fallback legado para tabuleiros 20×10 com blocos na base (rows 10..19)
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

  for (const kind of PLAYABLE_FRUITS) {
    for (let col = 0; col < width; col++) {
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
    bestSwap: null,
    validSwapsCount: readyPairsCount,
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
 * (even isolated or buried ones!), applies gravity (and top refill in 10×10 mode!),
 * and resolves any secondary cascades!
 */
export function magnetizeSingleFruitColor(
  grid: GridMatrix,
  targetKind?: FruitKind
): CascadeResolutionResult {
  const is10x10 = is10x10FruitArenaGrid(grid)
  let workingGrid = is10x10 ? cloneGrid(grid) : applyColumnGravityToFruits(grid).grid
  const height = is10x10 ? FRUIT_GRID_ROWS : workingGrid.length
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

  if (is10x10) {
    workingGrid = applyFruitGravityAndRefill10x10(workingGrid).grid
    const secondary = resolveFruitCascades10x10WithRefill(workingGrid)
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
          w.totalPoppedInWave * 65 * nextIdx * (w.clusters.length > 1 ? 2 : 1),
      }
    })
    const allWaves = [magnetWave, ...shiftedWaves]
    const totalPoppedBlocks = allWaves.reduce((acc, w) => acc + w.totalPoppedInWave, 0)
    const totalScoreEarned = allWaves.reduce((acc, w) => acc + w.waveScore, 0)

    return {
      grid: secondary.grid,
      waves: allWaves,
      totalPoppedBlocks,
      totalWaves: allWaves.length,
      totalScoreEarned,
      streakDelta: allWaves.length,
      isAllClear: false,
    }
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
 * applies gravity (and top refill in 10×10 mode!), and resolves any secondary cascades.
 */
export function purifyTopTwoFruitColors(grid: GridMatrix): CascadeResolutionResult {
  const is10x10 = is10x10FruitArenaGrid(grid)
  let workingGrid = is10x10 ? cloneGrid(grid) : applyColumnGravityToFruits(grid).grid
  const height = is10x10 ? FRUIT_GRID_ROWS : workingGrid.length
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

  if (is10x10) {
    workingGrid = applyFruitGravityAndRefill10x10(workingGrid).grid
    const secondary = resolveFruitCascades10x10WithRefill(workingGrid)
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
          w.totalPoppedInWave * 65 * nextIdx * (w.clusters.length > 1 ? 2 : 1),
      }
    })
    const allWaves = [phoenixWave, ...shiftedWaves]
    const totalPoppedBlocks = allWaves.reduce((acc, w) => acc + w.totalPoppedInWave, 0)
    const totalScoreEarned = allWaves.reduce((acc, w) => acc + w.waveScore, 0)

    return {
      grid: secondary.grid,
      waves: allWaves,
      totalPoppedBlocks,
      totalWaves: allWaves.length,
      totalScoreEarned,
      streakDelta: allWaves.length,
      isAllClear: false,
    }
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
