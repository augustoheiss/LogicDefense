import {
  ActivePiece,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BuriedCavity,
  GridCell,
  GridMatrix,
  LineClearResult,
  PieceType,
  RotationDirection,
  RotationState,
  SealCavitiesResult,
} from '../types'
import { getNextRotation, getPieceDefinition, getPieceMatrix, getPieceOccupiedCells } from './tetrominoes'

export const GRACE_FLOAT_AFTER_MORPH_MS = 1200

/**
 * SRS Wall-Kick candidate offsets (dx, dy) in priority order.
 * Includes horizontal (-1/+1/-2/+2), upward (-1/-2) for floor kicks,
 * and downward (+1/+2) for ceiling kicks when rotating at y = 0.
 */
const SRS_WALL_KICK_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-2, 0],
  [2, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [0, -2],
  [0, 2],
]

/**
 * Creates a pristine 20x10 Base-10 grid matrix filled with null.
 */
export function createEmptyGrid(
  height: number = BOARD_HEIGHT,
  width: number = BOARD_WIDTH
): GridMatrix {
  const safeHeight =
    height === BOARD_WIDTH && width === BOARD_HEIGHT ? BOARD_HEIGHT : height
  const safeWidth =
    height === BOARD_WIDTH && width === BOARD_HEIGHT ? BOARD_WIDTH : width
  return Array.from({ length: safeHeight }, () =>
    Array.from({ length: safeWidth }, () => null)
  )
}

/**
 * Performs a deep structural clone of a 20x10 GridMatrix.
 */
export function cloneGrid(grid: GridMatrix): GridMatrix {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
}

/**
 * Checks whether placing `piece` with `(offsetX, offsetY)` and `testRotation`
 * collides with walls, ceiling (row < 0), floor (row >= height), or existing locked blocks.
 */
export function hasCollision(
  grid: GridMatrix,
  piece: Pick<ActivePiece, 'type' | 'rotation' | 'x' | 'y'>,
  offsetX: number = 0,
  offsetY: number = 0,
  testRotation?: RotationState
): boolean {
  const height = grid.length
  const width = grid[0]?.length ?? BOARD_WIDTH
  const rotation = testRotation !== undefined ? testRotation : piece.rotation
  const matrix = getPieceMatrix(piece.type, rotation)

  for (let r = 0; r < matrix.length; r++) {
    const rowArr = matrix[r]
    for (let c = 0; c < rowArr.length; c++) {
      if (rowArr[c] !== 1) continue

      const targetCol = piece.x + offsetX + c
      const targetRow = piece.y + offsetY + r

      if (targetCol < 0 || targetCol >= width || targetRow < 0 || targetRow >= height) {
        return true
      }

      if (grid[targetRow][targetCol] !== null) {
        return true
      }
    }
  }

  return false
}

/**
 * Moves an active piece by (dx, dy) if no collision occurs; returns null if blocked.
 */
export function movePieceIfValid(
  grid: GridMatrix,
  piece: ActivePiece,
  dx: number,
  dy: number
): ActivePiece | null {
  if (hasCollision(grid, piece, dx, dy)) {
    return null
  }
  return {
    ...piece,
    x: piece.x + dx,
    y: piece.y + dy,
  }
}

/**
 * Attempts to rotate a piece using SRS Wall-Kicks so rotations near walls,
 * the ceiling (y = 0), or the stack succeed smoothly whenever geometrically possible.
 */
export function tryRotateSRS(
  grid: GridMatrix,
  piece: ActivePiece,
  direction: RotationDirection = 'CW'
): ActivePiece | null {
  const targetRotation = getNextRotation(piece.rotation, direction)

  for (const [dx, dy] of SRS_WALL_KICK_OFFSETS) {
    if (!hasCollision(grid, piece, dx, dy, targetRotation)) {
      return {
        ...piece,
        rotation: targetRotation,
        x: piece.x + dx,
        y: piece.y + dy,
      }
    }
  }

  return null
}

/**
 * Computes the lowest valid Y coordinate directly below `piece` (Ghost Piece projection).
 */
export function computeGhostY(grid: GridMatrix, piece: ActivePiece): number {
  let dropOffset = 0
  while (!hasCollision(grid, piece, 0, dropOffset + 1)) {
    dropOffset++
  }
  return piece.y + dropOffset
}

/**
 * Finds a 100% safe, non-colliding placement within [0..9] x [0..19] when morphing
 * `currentPiece` into `targetType` (RT-02, AUD-00-02, RT-07).
 *
 * Tests offsets [0, -1, +1, -2, +2] in X and [0, -1, +1, -2, +2] in Y across all 4 rotations.
 * Includes the Circuit Breaker fallback to `DOT_1X1` if the board is 99% full at the top.
 */
export function findSafeMorphPlacement(
  grid: GridMatrix,
  currentPiece: ActivePiece,
  targetType: PieceType
): ActivePiece {
  const deltaCandidates = [0, -1, 1, -2, 2]
  const rotationCandidates: RotationState[] = [0, 1, 2, 3]

  // 1. Search local 5x5 neighborhood around current (x, y)
  for (const rot of rotationCandidates) {
    for (const dy of deltaCandidates) {
      for (const dx of deltaCandidates) {
        const candidate: ActivePiece = {
          type: targetType,
          rotation: rot,
          x: currentPiece.x + dx,
          y: currentPiece.y + dy,
          isMorphed: true,
          graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
        }
        if (!hasCollision(grid, candidate, 0, 0, rot)) {
          return candidate
        }
      }
    }
  }

  // 2. Extended search across upper/mid board rows if local neighborhood was boxed in
  const height = grid.length
  const width = grid[0]?.length ?? BOARD_WIDTH
  const centeredCols = [4, 3, 5, 2, 6, 1, 7, 0, 8, 9].filter((c) => c < width)

  for (const rot of rotationCandidates) {
    for (let row = 0; row < height; row++) {
      for (const col of centeredCols) {
        const candidate: ActivePiece = {
          type: targetType,
          rotation: rot,
          x: col,
          y: row,
          isMorphed: true,
          graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
        }
        if (!hasCollision(grid, candidate, 0, 0, rot)) {
          return candidate
        }
      }
    }
  }

  // 3. Circuit Breaker (Section 5.2): Fallback to Golden Monomino (DOT_1X1) in nearest free cell
  for (const dy of deltaCandidates) {
    for (const dx of deltaCandidates) {
      const fallbackNear: ActivePiece = {
        type: 'DOT_1X1',
        rotation: 0,
        x: currentPiece.x + dx,
        y: currentPiece.y + dy,
        isMorphed: true,
        graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
      }
      if (!hasCollision(grid, fallbackNear, 0, 0, 0)) {
        return fallbackNear
      }
    }
  }

  for (let row = 0; row < height; row++) {
    for (const col of centeredCols) {
      const fallbackAny: ActivePiece = {
        type: 'DOT_1X1',
        rotation: 0,
        x: col,
        y: row,
        isMorphed: true,
        graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
      }
      if (!hasCollision(grid, fallbackAny, 0, 0, 0)) {
        return fallbackAny
      }
    }
  }

  // Ultimate fallback if all 200 cells are occupied
  return {
    type: 'DOT_1X1',
    rotation: 0,
    x: Math.max(0, Math.min(width - 1, currentPiece.x)),
    y: Math.max(0, Math.min(height - 1, currentPiece.y)),
    isMorphed: true,
    graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
  }
}

/**
 * Locks `piece` into a cloned copy of `grid` and returns the updated 20x10 GridMatrix.
 */
export function lockPieceToGrid(grid: GridMatrix, piece: ActivePiece): GridMatrix {
  const nextGrid = cloneGrid(grid)
  const def = getPieceDefinition(piece.type)
  const occupiedCells = getPieceOccupiedCells(piece)
  const height = nextGrid.length
  const width = nextGrid[0]?.length ?? BOARD_WIDTH

  for (const { row, col } of occupiedCells) {
    if (row >= 0 && row < height && col >= 0 && col < width) {
      nextGrid[row][col] = {
        type: piece.type,
        color: def.color,
        glowColor: def.glowColor,
        borderColor: def.borderColor,
        symbol: def.symbol,
        isSealedHole: false,
        isMorphedBlock: Boolean(piece.isMorphed),
      }
    }
  }

  return nextGrid
}

/**
 * Clears all full 10-block rows (Base-10 completion), shifts upper rows down,
 * and preserves the exact 20x10 matrix dimensions.
 */
export function clearCompletedLines(grid: GridMatrix): LineClearResult {
  const height = grid.length
  const width = grid[0]?.length ?? BOARD_WIDTH
  const remainingRows: (GridCell | null)[][] = []
  const clearedRows: number[] = []

  for (let r = 0; r < height; r++) {
    const row = grid[r]
    const isFull = row.every((cell) => cell !== null)
    if (isFull) {
      clearedRows.push(r)
    } else {
      remainingRows.push(row.map((cell) => (cell ? { ...cell } : null)))
    }
  }

  const clearedCount = clearedRows.length
  if (clearedCount === 0) {
    return {
      grid: remainingRows,
      clearedCount: 0,
      clearedRows: [],
      isAllClear: false,
    }
  }

  const emptyTopRows: (GridCell | null)[][] = Array.from({ length: clearedCount }, () =>
    Array.from({ length: width }, () => null)
  )

  const finalGrid = [...emptyTopRows, ...remainingRows]
  const isAllClear = finalGrid.every((row) => row.every((cell) => cell === null))

  return {
    grid: finalGrid,
    clearedCount,
    clearedRows,
    isAllClear,
  }
}

/**
 * Seals up to `maxToSeal` buried cavities with Golden Balance Crystals (`SEALED_GOLD`),
 * prioritizing rows with the fewest missing blocks (`missingInRow` ascending) so that
 * sealing buried holes immediately triggers cascading line clears (AUD-00-03)!
 */
export function sealBuriedCavities(
  grid: GridMatrix,
  cavities: BuriedCavity[],
  maxToSeal: number = 3
): SealCavitiesResult {
  const workingGrid = cloneGrid(grid)
  const height = workingGrid.length
  const width = workingGrid[0]?.length ?? BOARD_WIDTH

  // Sort by lowest missingInRow first (closest to 10!), then deepest row first
  const prioritized = [...cavities].sort((a, b) => {
    if (a.missingInRow !== b.missingInRow) {
      return a.missingInRow - b.missingInRow
    }
    if (b.row !== a.row) {
      return b.row - a.row
    }
    return a.col - b.col
  })

  const sealedCoordinates: Array<{ row: number; col: number }> = []
  const limit = Math.max(1, maxToSeal)

  for (const cavity of prioritized) {
    if (sealedCoordinates.length >= limit) break
    const { row, col } = cavity
    if (row >= 0 && row < height && col >= 0 && col < width && workingGrid[row][col] === null) {
      workingGrid[row][col] = {
        type: 'SEALED_GOLD',
        color: '#fbbf24',
        glowColor: 'rgba(251, 191, 36, 0.85)',
        borderColor: '#fef08a',
        symbol: '✦',
        isSealedHole: true,
        isMorphedBlock: false,
      }
      sealedCoordinates.push({ row, col })
    }
  }

  const lineClearResult = clearCompletedLines(workingGrid)

  return {
    grid: lineClearResult.grid,
    sealedCoordinates,
    lineClearResult,
  }
}

/**
 * Purifies (removes) up to `rowsToPurify` bottom rows of the stack during a
 * Second Wind Phoenix intervention (`MATH_SECOND_WIND`), dropping the stack height
 * and saving the player from Game Over while maintaining 20x10 dimensions.
 */
export function purifyBottomRows(grid: GridMatrix, rowsToPurify: number = 4): GridMatrix {
  const height = grid.length
  const width = grid[0]?.length ?? BOARD_WIDTH
  const count = Math.max(1, Math.min(height, rowsToPurify))

  const keptUpperRows = grid
    .slice(0, height - count)
    .map((row) => row.map((cell) => (cell ? { ...cell } : null)))

  const newEmptyTopRows: (GridCell | null)[][] = Array.from({ length: count }, () =>
    Array.from({ length: width }, () => null)
  )

  return [...newEmptyTopRows, ...keptUpperRows]
}

/**
 * Returns how many blocks are currently filled in `row` (0 to 10).
 */
export function getRowOccupiedCount(grid: GridMatrix, row: number): number {
  if (row < 0 || row >= grid.length) return 0
  return grid[row].reduce((acc, cell) => acc + (cell !== null ? 1 : 0), 0)
}

/**
 * Returns the Base-10 complement (how many blocks are missing to complete 10 in `row`).
 */
export function getRowMissingCount(grid: GridMatrix, row: number): number {
  const width = grid[0]?.length ?? BOARD_WIDTH
  return Math.max(0, width - getRowOccupiedCount(grid, row))
}
