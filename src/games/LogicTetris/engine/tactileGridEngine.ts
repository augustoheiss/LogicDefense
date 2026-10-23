import {
  ALL_PIECE_TYPES,
  getPieceDefinition,
  getPieceMatrix,
  STANDARD_PIECE_TYPES,
  TETROMINO_DEFS,
} from './tetrominoes'
import { cloneGrid, createEmptyGrid } from './gridEngine'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GoldenCrossroad,
  GridCell,
  GridMatrix,
  PieceType,
  RotationState,
  SubGameStyle,
  TactileClearResult,
  TactilePieceOption,
  TactilePlacementResult,
  TactileTopologyReport,
} from '../types'

export const PIECE_CATALOG = TETROMINO_DEFS

/**
 * Melhoria V2 (Proportional Uncut 10×10 Stage):
 * A Arena Tátil 10×10 agora ocupa o palco 10×10 inteiro e dedicado nas linhas `0..9` e colunas `0..9`,
 * eliminando o corte ao meio da antiga torre 20×10 e permitindo blocos de 50px!
 */
export const TACTILE_ROW_START = 0
export const TACTILE_ROW_END = 9
export const TACTILE_COL_START = 0
export const TACTILE_COL_END = 9
export const TACTILE_ARENA_SIZE = 10
export const TACTILE_MIN_FREE_CELLS_ON_TRANSITION = 48

const ALL_ROTATIONS: readonly RotationState[] = [0, 1, 2, 3]

/**
 * Checks whether `(row, col)` lies within the canonical 10x10 Tactile Arena
 * (`rows 10..19`, `cols 0..9`).
 */
export function isInsideTactileArena(row: number, col: number): boolean {
  return (
    row >= TACTILE_ROW_START &&
    row <= TACTILE_ROW_END &&
    col >= TACTILE_COL_START &&
    col <= TACTILE_COL_END &&
    col < BOARD_WIDTH &&
    row < BOARD_HEIGHT
  )
}

/**
 * Computes the absolute `(row, col)` coordinates occupied by `type` in `rotation`
 * when placed with its bounding-box top-left anchored at `(anchorCol, anchorRow)`.
 * Normalizing by `(minR, minC)` of the piece matrix ensures that any anchor in
 * `cols 0..9` and `rows 10..19` maps directly to the top-left occupied cell of the piece.
 */
export function getTactilePieceCells(
  type: PieceType,
  rotation: RotationState,
  anchorCol: number,
  anchorRow: number
): Array<{ row: number; col: number }> {
  const matrix = getPieceMatrix(type, rotation)
  const rawOffsets: Array<{ r: number; c: number }> = []
  let minR = Infinity
  let minC = Infinity

  for (let r = 0; r < matrix.length; r++) {
    const rowArr = matrix[r]
    for (let c = 0; c < rowArr.length; c++) {
      if (rowArr[c] === 1) {
        rawOffsets.push({ r, c })
        if (r < minR) minR = r
        if (c < minC) minC = c
      }
    }
  }

  if (rawOffsets.length === 0) {
    return []
  }

  return rawOffsets.map(({ r, c }) => ({
    row: anchorRow + (r - minR),
    col: anchorCol + (c - minC),
  }))
}

/**
 * Checks whether `type` at `rotation` can be placed at `(anchorCol, anchorRow)`
 * inside the 10x10 Tactile Arena with zero collisions.
 */
export function canPlaceTactilePieceAt(
  grid: GridMatrix,
  type: PieceType,
  rotation: RotationState,
  anchorCol: number,
  anchorRow: number
): boolean {
  const cells = getTactilePieceCells(type, rotation, anchorCol, anchorRow)
  if (cells.length === 0) return false

  for (const { row, col } of cells) {
    if (!isInsideTactileArena(row, col)) {
      return false
    }
    if (grid[row]?.[col] !== null) {
      return false
    }
  }

  return true
}

/**
 * Lists all valid `(anchorCol, anchorRow)` coordinates in the 10x10 Tactile Arena
 * where `type` at `rotation` fits without collision.
 */
export function findAllValidPlacementsForPiece(
  grid: GridMatrix,
  type: PieceType,
  rotation: RotationState
): Array<{ anchorCol: number; anchorRow: number }> {
  const validPlacements: Array<{ anchorCol: number; anchorRow: number }> = []

  for (let row = TACTILE_ROW_START; row <= TACTILE_ROW_END; row++) {
    for (let col = TACTILE_COL_START; col <= TACTILE_COL_END; col++) {
      if (canPlaceTactilePieceAt(grid, type, rotation, col, row)) {
        validPlacements.push({ anchorCol: col, anchorRow: row })
      }
    }
  }

  return validPlacements
}

/**
 * Checks whether at least one unused piece in `tray` can fit anywhere in the
 * 10x10 Tactile Arena (testing its current rotation and rotatable orientations).
 * Returns `true` if all tray slots are already used (since a fresh tray will be dealt).
 */
export function canAnyTrayPieceFit(
  grid: GridMatrix,
  tray: TactilePieceOption[]
): boolean {
  const unusedOptions = tray.filter((opt) => !opt.isUsed)
  if (unusedOptions.length === 0) {
    return true
  }

  for (const option of unusedOptions) {
    // Check current rotation first, then other rotations since player can press [R]
    const rotationsToCheck: RotationState[] = [
      option.rotation,
      ...ALL_ROTATIONS.filter((r) => r !== option.rotation),
    ]
    for (const rot of rotationsToCheck) {
      if (findAllValidPlacementsForPiece(grid, option.type, rot).length > 0) {
        return true
      }
    }
  }

  return false
}

function isTactileArenaEmpty(grid: GridMatrix): boolean {
  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      if (grid[r]?.[c] !== null) {
        return false
      }
    }
  }
  return true
}

/**
 * Melhoria 03-A & 03-B: Simultaneous Horizontal Row (10) AND Vertical Column (10) Clearer
 * with Inclusion-Exclusion arithmetic (`R*10 + C*10 - R*C`) and zero gravity shift.
 */
export function clearTactileRowsAndCols(grid: GridMatrix): TactileClearResult {
  const nextGrid = cloneGrid(grid)
  const clearedRows: number[] = []
  const clearedCols: number[] = []

  // 1. Inspect all 10 horizontal rows (10..19) on the same snapshot
  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
    let rowFull = true
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      if (nextGrid[r]?.[c] === null) {
        rowFull = false
        break
      }
    }
    if (rowFull) {
      clearedRows.push(r)
    }
  }

  // 2. Inspect all 10 vertical columns (0..9) on the same snapshot BEFORE clearing rows
  for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
    let colFull = true
    for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
      if (nextGrid[r]?.[c] === null) {
        colFull = false
        break
      }
    }
    if (colFull) {
      clearedCols.push(c)
    }
  }

  const R = clearedRows.length
  const C = clearedCols.length
  const totalLinesAndCols = R + C

  if (totalLinesAndCols === 0) {
    return {
      grid: nextGrid,
      clearedRows: [],
      clearedCols: [],
      totalLinesAndCols: 0,
      uniqueClearedBlocks: 0,
      isCrossClear: false,
      isAllClear: false,
      mathResonanceFormula: '',
      scoreEarned: 0,
      streakDelta: 0,
    }
  }

  // 3. Clear all completed horizontal rows and vertical columns without gravity
  for (const r of clearedRows) {
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      nextGrid[r][c] = null
    }
  }

  for (const c of clearedCols) {
    for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
      nextGrid[r][c] = null
    }
  }

  const uniqueClearedBlocks = R * 10 + C * 10 - R * C
  const isCrossClear = R >= 1 && C >= 1
  const isAllClear = isTactileArenaEmpty(nextGrid)

  let mathResonanceFormula: string
  if (isCrossClear) {
    if (R === 1 && C === 1) {
      mathResonanceFormula =
        '10 (Linha) + 10 (Coluna) − 1 (Cruzamento) = 19 Blocos!'
    } else {
      mathResonanceFormula = `${R * 10} (${R}L) + ${C * 10} (${C}C) − ${R * C} (Cruzamento) = ${uniqueClearedBlocks} Blocos!`
    }
  } else if (R >= 1) {
    mathResonanceFormula = `${R} × 10 = ${R * 10} Blocos (Linha Horizontal Base-10!)`
  } else {
    mathResonanceFormula = `${C} × 10 = ${C * 10} Blocos (Coluna Vertical Base-10!)`
  }

  const streakDelta = isCrossClear ? R + C + 1 : R + C
  const scoreEarned =
    uniqueClearedBlocks * 30 * totalLinesAndCols * (isCrossClear ? 2 : 1) +
    (isAllClear ? 1500 : 0)

  return {
    grid: nextGrid,
    clearedRows,
    clearedCols,
    totalLinesAndCols,
    uniqueClearedBlocks,
    isCrossClear,
    isAllClear,
    mathResonanceFormula,
    scoreEarned,
    streakDelta,
  }
}

/**
 * Melhoria 03-A: Scans the 10x10 Tactile Arena for horizontal row complements (1..3 missing),
 * vertical column complements (1..3 missing), Golden Crossroads (empty intersections `(r, c)`
 * where BOTH row `r` and column `c` are missing 1..3 blocks!), and Socratic hints.
 */
export function scanTactileGridTopology(grid: GridMatrix): TactileTopologyReport {
  let occupiedCount = 0
  const rowComplements: Record<number, number> = {}
  const colComplements: Record<number, number> = {}
  const rowEmptyCells: Record<number, Array<{ row: number; col: number }>> = {}
  const colEmptyCells: Record<number, Array<{ row: number; col: number }>> = {}

  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
    const emptyInRow: Array<{ row: number; col: number }> = []
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      if (grid[r]?.[c] !== null) {
        occupiedCount += 1
      } else {
        emptyInRow.push({ row: r, col: c })
      }
    }
    rowEmptyCells[r] = emptyInRow
    const missing = emptyInRow.length
    if (missing >= 1 && missing <= 3) {
      rowComplements[r] = missing
    }
  }

  for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
    const emptyInCol: Array<{ row: number; col: number }> = []
    for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
      if (grid[r]?.[c] === null) {
        emptyInCol.push({ row: r, col: c })
      }
    }
    colEmptyCells[c] = emptyInCol
    const missing = emptyInCol.length
    if (missing >= 1 && missing <= 3) {
      colComplements[c] = missing
    }
  }

  const goldenCrossroads: GoldenCrossroad[] = []
  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
    const rMissing = rowComplements[r]
    if (!rMissing) continue
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      const cMissing = colComplements[c]
      if (!cMissing) continue
      if (grid[r]?.[c] === null) {
        goldenCrossroads.push({
          row: r,
          col: c,
          rowMissing: rMissing,
          colMissing: cMissing,
        })
      }
    }
  }

  goldenCrossroads.sort(
    (a, b) => a.rowMissing + a.colMissing - (b.rowMissing + b.colMissing)
  )

  // Determine bestAxisToSeal (prioritizing axes that participate in a GoldenCrossroad)
  let bestAxisToSeal: TactileTopologyReport['bestAxisToSeal'] = null
  const crossRows = new Set(goldenCrossroads.map((g) => g.row))
  const crossCols = new Set(goldenCrossroads.map((g) => g.col))

  const candidates: Array<{
    axis: 'ROW' | 'COL'
    index: number
    missing: number
    targetCells: Array<{ row: number; col: number }>
    priorityScore: number
  }> = []

  for (const [rStr, missing] of Object.entries(rowComplements)) {
    const r = Number(rStr)
    candidates.push({
      axis: 'ROW',
      index: r,
      missing,
      targetCells: rowEmptyCells[r] ?? [],
      priorityScore: (4 - missing) * 10 + (crossRows.has(r) ? 25 : 0),
    })
  }

  for (const [cStr, missing] of Object.entries(colComplements)) {
    const c = Number(cStr)
    candidates.push({
      axis: 'COL',
      index: c,
      missing,
      targetCells: colEmptyCells[c] ?? [],
      priorityScore: (4 - missing) * 10 + (crossCols.has(c) ? 25 : 0),
    })
  }

  candidates.sort((a, b) => b.priorityScore - a.priorityScore)
  if (candidates.length > 0) {
    const top = candidates[0]
    bestAxisToSeal = {
      axis: top.axis,
      index: top.index,
      missing: top.missing,
      targetCells: top.targetCells,
    }
  }

  // Recommend resonant piece based on missing count
  let recommendedPiece: PieceType = 'I'
  if (bestAxisToSeal) {
    if (bestAxisToSeal.missing === 1) {
      recommendedPiece = 'DOT_1X1'
    } else if (bestAxisToSeal.missing === 2) {
      recommendedPiece = 'DOMINO_1X2'
    } else {
      recommendedPiece = 'TRIO_1X3'
    }
  } else {
    recommendedPiece = occupiedCount > 55 ? 'DOT_1X1' : 'CUBE_3X3'
  }

  let pedagogicalHint: string
  if (goldenCrossroads.length > 0) {
    const gc = goldenCrossroads[0]
    const displayRow = gc.row - TACTILE_ROW_START + 1
    const displayCol = gc.col + 1
    pedagogicalHint = `💡 Encruzilhada Dourada em (L${displayRow}, C${displayCol}): falta +${gc.rowMissing} na Linha e +${gc.colMissing} na Coluna para fechar 10 + 10!`
  } else if (bestAxisToSeal) {
    const filled = 10 - bestAxisToSeal.missing
    if (bestAxisToSeal.axis === 'ROW') {
      const displayRow = bestAxisToSeal.index - TACTILE_ROW_START + 1
      pedagogicalHint = `💡 Linha Horizontal ${displayRow} tem ${filled} blocos: ${filled} + [ ? ] = 10!`
    } else {
      const displayCol = bestAxisToSeal.index + 1
      pedagogicalHint = `💡 Coluna Vertical ${displayCol} tem ${filled} blocos: ${filled} + [ ? ] = 10!`
    }
  } else {
    pedagogicalHint =
      '💡 Arena Base-10 (10×10): use Macro-Blocos (Cubo 3×3 = 9, Viga 1×5 = 5) para fechar 10 na Horizontal OU na Vertical!'
  }

  return {
    occupiedCount,
    freeCount: Math.max(0, 100 - occupiedCount),
    rowComplements,
    colComplements,
    goldenCrossroads,
    bestAxisToSeal,
    recommendedPiece,
    pedagogicalHint,
  }
}

const MACRO_HEAVY_POOL: readonly PieceType[] = [
  'CUBE_3X3',
  'CORNER_3X3',
  'BAR_1X5',
  'RECT_2X3',
]

const TACTILE_MEDIUM_POOL: readonly PieceType[] = [
  ...STANDARD_PIECE_TYPES,
  'TRIO_1X3',
  'CORNER_2X2',
]

const TACTILE_AGILE_POOL: readonly PieceType[] = [
  'DOT_1X1',
  'DOMINO_1X2',
  'TRIO_1X3',
  'CORNER_2X2',
  'O',
  'I',
]

function pickRandomFromPool(pool: readonly PieceType[]): { type: PieceType; rotation: RotationState } {
  const type = pool[Math.floor(Math.random() * pool.length)] ?? 'I'
  const rotation = ALL_ROTATIONS[Math.floor(Math.random() * ALL_ROTATIONS.length)] ?? 0
  return { type, rotation }
}

/**
 * Melhoria 03-B & V2 (Macro-Polyominoes + RT-18 Cap):
 * Generates a 3-piece Tactile Tray (`TactilePieceOption[3]`) featuring:
 * - Slot 0: Macro-Bloco (Cubo 3×3 de 9 quadrados, Grande Esquadro 3×3, Viga 1×5 ou Placa 2×3)
 *   quando couber na Arena 10×10, limitado a no máximo 1 Macro-Bloco (>= 5 blocos) por bandeja (RT-18)!
 * - Slot 1: Peça Padrão ou Ressonante recomendada pelo Oráculo (quando faltam 1..3 blocos).
 * - Slot 2: Peça Ágil (1×1, 1×2, 1×3, Cantoneira 2×2) para garantir fluidez e zero travamento.
 */
export function generateTactilePieceTray(grid: GridMatrix): TactilePieceOption[] {
  const topology = scanTactileGridTopology(grid)

  // Slot 0: Tenta sortear um Macro-Bloco (Cubo 3×3, Canto 3×3, Barra 1×5, Placa 2×3) que caiba no tabuleiro
  let slot0Picked = pickRandomFromPool(MACRO_HEAVY_POOL)
  if (
    findAllValidPlacementsForPiece(grid, slot0Picked.type, slot0Picked.rotation).length === 0
  ) {
    // Tenta outro Macro-Bloco que caiba
    const fittingMacros: Array<{ type: PieceType; rotation: RotationState }> = []
    for (const mType of MACRO_HEAVY_POOL) {
      for (const rot of [0, 1] as RotationState[]) {
        if (findAllValidPlacementsForPiece(grid, mType, rot).length > 0) {
          fittingMacros.push({ type: mType, rotation: rot })
          break
        }
      }
    }
    if (fittingMacros.length > 0) {
      slot0Picked = fittingMacros[Math.floor(Math.random() * fittingMacros.length)]!
    } else {
      slot0Picked = pickRandomFromPool(TACTILE_MEDIUM_POOL)
    }
  }

  const slot1Picked = pickRandomFromPool(TACTILE_MEDIUM_POOL)
  const slot2Picked = pickRandomFromPool(TACTILE_AGILE_POOL)

  const tray: TactilePieceOption[] = [
    {
      slotIndex: 0,
      type: slot0Picked.type,
      rotation: slot0Picked.rotation,
      isUsed: false,
    },
    {
      slotIndex: 1,
      type: slot1Picked.type,
      rotation: slot1Picked.rotation,
      isUsed: false,
    },
    {
      slotIndex: 2,
      type: slot2Picked.type,
      rotation: slot2Picked.rotation,
      isUsed: false,
    },
  ]

  // If the board has a near-complete row or column, inject the recommended resonant piece in slot 1
  if (topology.bestAxisToSeal) {
    const preferredRot: RotationState =
      topology.bestAxisToSeal.axis === 'COL' ? 1 : 0
    const recDef = getPieceDefinition(topology.recommendedPiece)
    const slot0Def = getPieceDefinition(tray[0].type)
    // RT-18: Evita 2 macro-blocos (>= 5) na mesma bandeja
    if (
      (recDef.blockCount < 5 || slot0Def.blockCount < 5) &&
      findAllValidPlacementsForPiece(grid, topology.recommendedPiece, preferredRot)
        .length > 0
    ) {
      tray[1] = {
        slotIndex: 1,
        type: topology.recommendedPiece,
        rotation: preferredRot,
        isUsed: false,
      }
    }
  }

  // Anti-Deadlock guarantee: ensure at least 1 piece in the tray fits if freeCount > 0
  if (!canAnyTrayPieceFit(grid, tray) && topology.freeCount > 0) {
    const fallbackCandidates: Array<{ type: PieceType; rotation: RotationState }> = [
      { type: 'TRIO_1X3', rotation: 0 },
      { type: 'CORNER_2X2', rotation: 0 },
      { type: 'DOMINO_1X2', rotation: 0 },
      { type: 'DOMINO_1X2', rotation: 1 },
      { type: 'DOT_1X1', rotation: 0 },
    ]
    for (const candidate of fallbackCandidates) {
      if (
        findAllValidPlacementsForPiece(grid, candidate.type, candidate.rotation)
          .length > 0
      ) {
        tray[2] = {
          slotIndex: 2,
          type: candidate.type,
          rotation: candidate.rotation,
          isUsed: false,
        }
        break
      }
    }
  }

  return tray
}

/**
 * Places the piece from `tray[slotIndex]` at `(anchorCol, anchorRow)` in the 10x10 Tactile Arena,
 * clears any completed horizontal rows (10) and/or vertical columns (10) simultaneously,
 * auto-refills the tray when all 3 pieces are used, and reports `canRemainingTrayFit`.
 */
export function placeTactileTrayPiece(
  grid: GridMatrix,
  tray: TactilePieceOption[],
  slotIndex: 0 | 1 | 2,
  anchorCol: number,
  anchorRow: number,
  overrideRotation?: RotationState
): TactilePlacementResult {
  const option = tray.find((item) => item.slotIndex === slotIndex)
  if (!option || option.isUsed) {
    return {
      valid: false,
      grid,
      updatedTray: tray,
      placedCells: [],
      clearResult: {
        grid,
        clearedRows: [],
        clearedCols: [],
        totalLinesAndCols: 0,
        uniqueClearedBlocks: 0,
        isCrossClear: false,
        isAllClear: false,
        mathResonanceFormula: '',
        scoreEarned: 0,
        streakDelta: 0,
      },
      canRemainingTrayFit: canAnyTrayPieceFit(grid, tray),
    }
  }

  const rotation = overrideRotation !== undefined ? overrideRotation : option.rotation
  if (!canPlaceTactilePieceAt(grid, option.type, rotation, anchorCol, anchorRow)) {
    return {
      valid: false,
      grid,
      updatedTray: tray,
      placedCells: [],
      clearResult: {
        grid,
        clearedRows: [],
        clearedCols: [],
        totalLinesAndCols: 0,
        uniqueClearedBlocks: 0,
        isCrossClear: false,
        isAllClear: false,
        mathResonanceFormula: '',
        scoreEarned: 0,
        streakDelta: 0,
      },
      canRemainingTrayFit: canAnyTrayPieceFit(grid, tray),
    }
  }

  const workingGrid = cloneGrid(grid)
  const placedCells = getTactilePieceCells(option.type, rotation, anchorCol, anchorRow)
  const def = getPieceDefinition(option.type)

  for (const { row, col } of placedCells) {
    workingGrid[row][col] = {
      type: option.type,
      color: def.color,
      glowColor: def.glowColor,
      borderColor: def.borderColor,
      symbol: def.symbol,
    }
  }

  const clearResult = clearTactileRowsAndCols(workingGrid)

  let updatedTray = tray.map((item) =>
    item.slotIndex === slotIndex ? { ...item, rotation, isUsed: true } : item
  )

  // If all 3 pieces in the tray have been placed, deal a fresh 3-piece tray!
  if (updatedTray.every((item) => item.isUsed)) {
    updatedTray = generateTactilePieceTray(clearResult.grid)
  }

  const canRemainingTrayFit = canAnyTrayPieceFit(clearResult.grid, updatedTray)

  return {
    valid: true,
    grid: clearResult.grid,
    updatedTray,
    placedCells,
    clearResult,
    canRemainingTrayFit,
  }
}

/**
 * Miracle [M] in TACTILE_GRID: Transmutes a tray slot into `targetType` (and resets `isUsed = false`
 * so the player can immediately place their newly forged piece!).
 */
export function morphTactileTrayPiece(
  tray: TactilePieceOption[],
  slotIndex: 0 | 1 | 2,
  targetType: PieceType,
  rotation: RotationState = 0
): TactilePieceOption[] {
  const validType = ALL_PIECE_TYPES.includes(targetType) ? targetType : 'DOT_1X1'
  return tray.map((item) =>
    item.slotIndex === slotIndex
      ? {
          ...item,
          type: validType,
          rotation,
          isUsed: false,
        }
      : item
  )
}

function createGoldenTactileCell(): GridCell {
  return {
    type: 'SEALED_GOLD',
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.85)',
    borderColor: '#fef08a',
    symbol: '✦',
    isSealedHole: true,
    isMorphedBlock: true,
  }
}

/**
 * Melhoria 03-B — Miracle [B] in TACTILE_GRID (`sealTactileRowOrColCavities`):
 * Automatically selects the horizontal row (10..19) OR vertical column (0..9) closest to
 * completing 10 blocks (or obeying `preferredAxis` when provided, prioritizing Golden Crossroads),
 * seals up to `maxToSeal` empty cells with Golden Crystals (`SEALED_GOLD` `✦`), and triggers
 * `clearTactileRowsAndCols` immediately!
 */
export function sealTactileRowOrColCavities(
  grid: GridMatrix,
  preferredAxis?: 'ROW' | 'COL',
  maxToSeal: number = 3
): {
  grid: GridMatrix
  sealedCoordinates: Array<{ row: number; col: number }>
  clearResult: TactileClearResult
  axisSealed: 'ROW' | 'COL'
} {
  const workingGrid = cloneGrid(grid)
  const topology = scanTactileGridTopology(workingGrid)
  const crossroadSet = new Set(
    topology.goldenCrossroads.map((gc) => `${gc.row},${gc.col}`)
  )

  type AxisCandidate = {
    axis: 'ROW' | 'COL'
    index: number
    emptyCells: Array<{ row: number; col: number }>
    score: number
  }

  const axisCandidates: AxisCandidate[] = []

  if (!preferredAxis || preferredAxis === 'ROW') {
    for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
      const emptyCells: Array<{ row: number; col: number }> = []
      for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
        if (workingGrid[r]?.[c] === null) {
          emptyCells.push({ row: r, col: c })
        }
      }
      if (emptyCells.length >= 1 && emptyCells.length < 10) {
        const hasCross = emptyCells.some((pos) =>
          crossroadSet.has(`${pos.row},${pos.col}`)
        )
        axisCandidates.push({
          axis: 'ROW',
          index: r,
          emptyCells,
          score: (10 - emptyCells.length) * 100 + (hasCross ? 45 : 0),
        })
      }
    }
  }

  if (!preferredAxis || preferredAxis === 'COL') {
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      const emptyCells: Array<{ row: number; col: number }> = []
      for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
        if (workingGrid[r]?.[c] === null) {
          emptyCells.push({ row: r, col: c })
        }
      }
      if (emptyCells.length >= 1 && emptyCells.length < 10) {
        const hasCross = emptyCells.some((pos) =>
          crossroadSet.has(`${pos.row},${pos.col}`)
        )
        axisCandidates.push({
          axis: 'COL',
          index: c,
          emptyCells,
          score: (10 - emptyCells.length) * 100 + (hasCross ? 45 : 0),
        })
      }
    }
  }

  axisCandidates.sort((a, b) => b.score - a.score)

  let chosenAxis: 'ROW' | 'COL' = preferredAxis ?? 'ROW'
  let targetEmptyCells: Array<{ row: number; col: number }> = []

  if (axisCandidates.length > 0) {
    chosenAxis = axisCandidates[0].axis
    const seenCoords = new Set<string>()
    const effectiveLimit = maxToSeal >= 100 ? 20 : Math.max(1, maxToSeal)
    for (const candidate of axisCandidates) {
      if (targetEmptyCells.length >= effectiveLimit) break
      const sortedCells = [...candidate.emptyCells].sort((a, b) => {
        const aCross = crossroadSet.has(`${a.row},${a.col}`) ? 1 : 0
        const bCross = crossroadSet.has(`${b.row},${b.col}`) ? 1 : 0
        return bCross - aCross
      })
      for (const cell of sortedCells) {
        const key = `${cell.row},${cell.col}`
        if (!seenCoords.has(key)) {
          seenCoords.add(key)
          targetEmptyCells.push(cell)
          if (targetEmptyCells.length >= effectiveLimit) break
        }
      }
    }
  } else {
    // Fallback if arena is completely empty: seal up to maxToSeal cells on row 9 or col 0
    if (preferredAxis === 'COL') {
      chosenAxis = 'COL'
      for (let r = TACTILE_ROW_END; r >= TACTILE_ROW_START; r--) {
        if (workingGrid[r]?.[0] === null) {
          targetEmptyCells.push({ row: r, col: 0 })
        }
      }
    } else {
      chosenAxis = 'ROW'
      for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
        if (workingGrid[TACTILE_ROW_END]?.[c] === null) {
          targetEmptyCells.push({ row: TACTILE_ROW_END, col: c })
        }
      }
    }
  }

  const effectiveMax = maxToSeal >= 100 ? 20 : Math.max(1, maxToSeal)
  const sealedCoordinates = targetEmptyCells.slice(0, effectiveMax)
  for (const { row, col } of sealedCoordinates) {
    workingGrid[row][col] = createGoldenTactileCell()
  }

  const clearResult = clearTactileRowsAndCols(workingGrid)

  return {
    grid: clearResult.grid,
    sealedCoordinates,
    clearResult,
    axisSealed: chosenAxis,
  }
}

/**
 * Miracle Phoenix Second Wind in TACTILE_GRID (`purifyTactileGridSecondWind`):
 * Triggered when no remaining piece in the tray fits (`!canAnyTrayPieceFit`).
 * Purifies the most congested rows and columns in the 10x10 Tactile Arena so at least
 * 60% of the arena is open, and ensures `refreshedTray` can immediately be played!
 */
export function purifyTactileGridSecondWind(
  grid: GridMatrix,
  tray?: TactilePieceOption[]
): {
  grid: GridMatrix
  clearedCount: number
  refreshedTray: TactilePieceOption[]
} {
  const workingGrid = cloneGrid(grid)
  let clearedCount = 0

  // Also clear any stray blocks outside the 10x10 Tactile Arena (rows 10..19)
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    if (r >= TACTILE_ROW_START && r <= TACTILE_ROW_END) continue
    for (let c = 0; c < BOARD_WIDTH; c++) {
      if (workingGrid[r]?.[c] !== null) {
        workingGrid[r][c] = null
        clearedCount += 1
      }
    }
  }

  // Rank rows 0..9 by occupancy and clear the 3 most crowded rows + center 4x4 core
  const rowOccupancies: Array<{ row: number; count: number }> = []
  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
    let count = 0
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      if (workingGrid[r]?.[c] !== null) count += 1
    }
    rowOccupancies.push({ row: r, count })
  }
  rowOccupancies.sort((a, b) => b.count - a.count)

  for (const entry of rowOccupancies.slice(0, 3)) {
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      if (workingGrid[entry.row]?.[c] !== null) {
        workingGrid[entry.row][c] = null
        clearedCount += 1
      }
    }
  }

  // Clear central 4x4 sanctuary (rows 3..6, cols 3..6) so any 3x3 Cube or 4-block tetromino fits!
  const centerStart = TACTILE_ROW_START + 3
  const centerEnd = TACTILE_ROW_START + 6
  for (let r = centerStart; r <= centerEnd; r++) {
    for (let c = 3; c <= 6; c++) {
      if (workingGrid[r]?.[c] !== null) {
        workingGrid[r][c] = null
        clearedCount += 1
      }
    }
  }

  // Ensure at least 60 free cells in the 10x10 arena
  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      const currentTopology = scanTactileGridTopology(workingGrid)
      if (currentTopology.freeCount >= 60) break
      if (workingGrid[r]?.[c] !== null) {
        workingGrid[r][c] = null
        clearedCount += 1
      }
    }
  }

  let refreshedTray =
    tray && tray.some((item) => !item.isUsed)
      ? tray.map((item) => ({ ...item }))
      : generateTactilePieceTray(workingGrid)

  if (!canAnyTrayPieceFit(workingGrid, refreshedTray)) {
    refreshedTray = generateTactilePieceTray(workingGrid)
  }

  return {
    grid: workingGrid,
    clearedCount,
    refreshedTray,
  }
}

/**
 * Melhoria V2 (Purificar a Maioria dos Blocos ao Trocar de Cenário):
 * Quando o jogador (ou a Rotação Automática) troca de cenário entre
 * `TETRIS_CLASSIC`, `FRUIT_MATCH` e `TACTILE_GRID`, elimina de 75% a 85% dos blocos
 * acumulados no cenário anterior (mantendo no máximo 10 a 12 blocos sobreviventes):
 * - Convertendo cada bloco eliminado em `+30 pts` de bônus de transmutação!
 * - Posicionando os poucos blocos sobreviventes na geometria nativa do novo cenário:
 *   - `TETRIS_CLASSIC` (20×10): Acomodados na base (linhas 18..19) com zero linhas completas involuntárias.
 *   - `TACTILE_GRID` (10×10): Acomodados nas linhas `0..9, cols 0..9` com mais de 88 células livres (perfeito para o Cubo 3×3!) e zero blocos nas linhas `10..19`.
 *   - `FRUIT_MATCH` (10×10): Acomodados como sementes nas linhas `0..9` (que em seguida são completadas para 100 frutas por `generatePlayableFruitBoard10x10`).
 */
export function purgeMajorityBlocksForTransition(
  grid: GridMatrix,
  targetStyle: SubGameStyle
): {
  grid: GridMatrix
  purgedBlocksCount: number
  survivingBlocksCount: number
  transmutationBonusPoints: number
} {
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH
  const allOccupied: Array<{ row: number; col: number; cell: GridCell }> = []

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r]?.[c] ?? null
      if (cell !== null) {
        allOccupied.push({ row: r, col: c, cell })
      }
    }
  }

  const totalBefore = allOccupied.length
  if (totalBefore === 0) {
    return {
      grid: createEmptyGrid(BOARD_WIDTH, BOARD_HEIGHT),
      purgedBlocksCount: 0,
      survivingBlocksCount: 0,
      transmutationBonusPoints: 0,
    }
  }

  // Elimina 80% dos blocos (mantendo no máximo 10 blocos sobreviventes)
  const targetKeepCount = Math.min(
    10,
    Math.max(totalBefore >= 4 ? 2 : 0, Math.floor(totalBefore * 0.2))
  )

  // Seleciona blocos bem distribuídos nas linhas e colunas (passo coprimo 13 p/ nunca cair apenas em col=0 — Fix AUD-V2-01)
  const survivors: Array<{ row: number; col: number; cell: GridCell }> = []
  if (targetKeepCount > 0) {
    const usedIndices = new Set<number>()
    const coprimeStep = allOccupied.length >= 20 ? 13 : Math.max(1, Math.floor(allOccupied.length / targetKeepCount))
    for (let k = 0; k < allOccupied.length && survivors.length < targetKeepCount; k++) {
      const idx = (k * coprimeStep + Math.floor(k / 3)) % allOccupied.length
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx)
        survivors.push(allOccupied[idx]!)
      }
    }
  }

  const nextGrid = createEmptyGrid(BOARD_WIDTH, BOARD_HEIGHT)

  if (targetStyle === 'TETRIS_CLASSIC') {
    // Coloca os sobreviventes na base da Torre 20×10 (linhas 19 e 18), sem fechar linha de 10
    let placed = 0
    for (const item of survivors) {
      const targetCol = (item.col + placed) % BOARD_WIDTH
      // Garante que a coluna 9 da linha 19 fique aberta para nunca auto-limpar no Frame 0
      const safeCol = targetCol === 9 ? 8 : targetCol
      const targetRow = nextGrid[19][safeCol] === null ? 19 : 18
      const baseDef =
        item.cell.type !== 'SEALED_GOLD' && TETROMINO_DEFS[item.cell.type]
          ? TETROMINO_DEFS[item.cell.type]
          : TETROMINO_DEFS.I
      nextGrid[targetRow][safeCol] = {
        ...item.cell,
        color: item.cell.color || baseDef.color,
        glowColor: item.cell.glowColor || baseDef.glowColor,
        borderColor: item.cell.borderColor || baseDef.borderColor,
        symbol: item.cell.fruitKind ? baseDef.symbol : item.cell.symbol || baseDef.symbol,
        fruitKind: undefined,
      }
      placed += 1
    }
  } else {
    // TACTILE_GRID ou FRUIT_MATCH: Arena 10×10 dedicada nas linhas 0..9, colunas 0..9
    let placed = 0
    for (const item of survivors) {
      const rawRow =
        item.row <= TACTILE_ROW_END
          ? item.row
          : Math.max(
              TACTILE_ROW_START,
              Math.min(TACTILE_ROW_END, item.row - 10)
            )
      const mappedRow = (rawRow + placed * 2) % TACTILE_ARENA_SIZE
      const mappedCol = (item.col + placed * 3) % TACTILE_ARENA_SIZE
      // Deixa o santuário central (rows 3..6, cols 3..6) livre para Macro-Blocos 3×3!
      const finalRow =
        mappedRow >= 3 && mappedRow <= 6 && mappedCol >= 3 && mappedCol <= 6
          ? 8
          : mappedRow
      if (nextGrid[finalRow][mappedCol] === null) {
        if (targetStyle === 'TACTILE_GRID') {
          const baseDef =
            item.cell.type !== 'SEALED_GOLD' && TETROMINO_DEFS[item.cell.type]
              ? TETROMINO_DEFS[item.cell.type]
              : TETROMINO_DEFS.I
          nextGrid[finalRow][mappedCol] = {
            ...item.cell,
            color: item.cell.fruitKind ? baseDef.color : item.cell.color || baseDef.color,
            glowColor: item.cell.fruitKind ? baseDef.glowColor : item.cell.glowColor || baseDef.glowColor,
            borderColor: item.cell.fruitKind ? baseDef.borderColor : item.cell.borderColor || baseDef.borderColor,
            symbol: item.cell.fruitKind ? baseDef.symbol : item.cell.symbol || baseDef.symbol,
            fruitKind: undefined,
          }
        } else {
          nextGrid[finalRow][mappedCol] = { ...item.cell }
        }
        placed += 1
      }
    }
  }

  const purgedBlocksCount = Math.max(0, totalBefore - survivors.length)
  return {
    grid: nextGrid,
    purgedBlocksCount,
    survivingBlocksCount: survivors.length,
    transmutationBonusPoints: purgedBlocksCount * 30,
  }
}

/**
 * Melhoria 03-C & RT-12: Safe Transition Normalizer (`normalizeGridForTactileTransition`).
 * When switching into `TACTILE_GRID`:
 * 1. Translocates any blocks from rows `10..19` into the full-stage `rows 0..9` 10×10 Tactile Arena
 *    while eliminating excess blocks (`prunedBlocksCount`) into `transmutationBonusPoints` (+25 pts/block).
 * 2. Prevents Frame-0 auto-clears by opening 1 cell in any pre-filled 10/10 row or column.
 * 3. Guarantees at least `TACTILE_MIN_FREE_CELLS_ON_TRANSITION` (48) free cells in the 10x10 arena (`rows 0..9`).
 */
export function normalizeGridForTactileTransition(grid: GridMatrix): {
  grid: GridMatrix
  transmutationBonusPoints: number
  prunedBlocksCount: number
} {
  const workingGrid = cloneGrid(grid)
  let prunedBlocksCount = 0

  // 1. Se houver blocos nas linhas 10..19 (vindos da Torre 20×10), migra uma amostra leve para 0..9 e limpa 10..19
  for (let r = TACTILE_ROW_END + 1; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH; c++) {
      const cell = workingGrid[r]?.[c] ?? null
      if (cell !== null) {
        const targetR = r - 10
        if (
          targetR >= TACTILE_ROW_START &&
          targetR <= TACTILE_ROW_END &&
          workingGrid[targetR][c] === null &&
          (r + c) % 3 === 0
        ) {
          workingGrid[targetR][c] = cell
        } else {
          prunedBlocksCount += 1
        }
        workingGrid[r][c] = null
      }
    }
  }

  // 2. Ensure no row (0..9) or column (0..9) starts at 10/10 on Frame 0
  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
    let full = true
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      if (workingGrid[r]?.[c] === null) {
        full = false
        break
      }
    }
    if (full) {
      const colToOpen = (r - TACTILE_ROW_START) % BOARD_WIDTH
      workingGrid[r][colToOpen] = null
      prunedBlocksCount += 1
    }
  }

  for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
    let full = true
    for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
      if (workingGrid[r]?.[c] === null) {
        full = false
        break
      }
    }
    if (full) {
      const rowToOpen = TACTILE_ROW_START + (c % TACTILE_ARENA_SIZE)
      workingGrid[rowToOpen][c] = null
      prunedBlocksCount += 1
    }
  }

  // 3. Guarantee at least 48 free cells in the 10x10 arena (rows 0..9)
  let occupiedInArena = 0
  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END; r++) {
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END; c++) {
      if (workingGrid[r]?.[c] !== null) {
        occupiedInArena += 1
      }
    }
  }

  const maxAllowedOccupied = 100 - TACTILE_MIN_FREE_CELLS_ON_TRANSITION // 52
  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END && occupiedInArena > maxAllowedOccupied; r++) {
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END && occupiedInArena > maxAllowedOccupied; c++) {
      if ((r + c) % 2 === 0 && workingGrid[r]?.[c] !== null) {
        workingGrid[r][c] = null
        occupiedInArena -= 1
        prunedBlocksCount += 1
      }
    }
  }

  for (let r = TACTILE_ROW_START; r <= TACTILE_ROW_END && occupiedInArena > maxAllowedOccupied; r++) {
    for (let c = TACTILE_COL_START; c <= TACTILE_COL_END && occupiedInArena > maxAllowedOccupied; c++) {
      if (workingGrid[r]?.[c] !== null) {
        workingGrid[r][c] = null
        occupiedInArena -= 1
        prunedBlocksCount += 1
      }
    }
  }

  return {
    grid: workingGrid,
    transmutationBonusPoints: prunedBlocksCount * 25,
    prunedBlocksCount,
  }
}
