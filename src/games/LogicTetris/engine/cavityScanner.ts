import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BoardTopologyReport,
  BuriedCavity,
  GridMatrix,
  PieceType,
} from '../types'
import { getRowMissingCount, getRowOccupiedCount } from './gridEngine'

/**
 * Scans the 20x10 Base-10 grid to detect:
 * 1. All buried cavities (`depth >= 1` — empty cells that have at least 1 locked block above them in the same column),
 *    sorted by lowest `missingInRow` first (closest to completing 10!) and deepest row second (Melhoria 03-A).
 * 2. Base-10 row complements (`rowComplements`) for rows with 7, 8, or 9 blocks (missing 1, 2, or 3 blocks for 10).
 * 3. Stack height telemetry (`maxStackHeight`, `isDangerZone`).
 * 4. The Oracle's recommended piece (`recommendedPiece` + `recommendationReason`) based on surface contour analysis.
 */
export function scanBoardTopology(grid: GridMatrix): BoardTopologyReport {
  const height = grid.length || BOARD_HEIGHT
  const width = grid[0]?.length ?? BOARD_WIDTH

  // 1. Compute per-column top surface row and column stack height
  const firstOccupiedRowPerCol: number[] = Array.from({ length: width }, () => height)
  const colHeights: number[] = Array.from({ length: width }, () => 0)

  for (let c = 0; c < width; c++) {
    for (let r = 0; r < height; r++) {
      if (grid[r]?.[c] !== null) {
        firstOccupiedRowPerCol[c] = r
        colHeights[c] = height - r
        break
      }
    }
  }

  const maxStackHeight = Math.max(0, ...colHeights)
  const isDangerZone = maxStackHeight >= 15

  // 2. Precompute missingInRow for each row and populate rowComplements (for rows missing 1..3 blocks)
  const rowMissingMap: number[] = Array.from({ length: height }, (_, r) =>
    getRowMissingCount(grid, r)
  )
  const rowComplements: Record<number, number> = {}

  for (let r = 0; r < height; r++) {
    const occupied = getRowOccupiedCount(grid, r)
    const missing = width - occupied
    if (occupied >= 7 && occupied <= 9 && missing >= 1 && missing <= 3) {
      rowComplements[r] = missing
    }
  }

  // 3. Detect all buried cavities (empty cells below the highest occupied cell in column `c`)
  const buriedCavities: BuriedCavity[] = []

  for (let c = 0; c < width; c++) {
    const topRow = firstOccupiedRowPerCol[c]
    if (topRow >= height) continue // Column is completely empty

    let blocksAbove = 0
    for (let r = topRow; r < height; r++) {
      if (grid[r]?.[c] !== null) {
        blocksAbove++
      } else if (blocksAbove > 0) {
        buriedCavities.push({
          row: r,
          col: c,
          depth: blocksAbove,
          missingInRow: rowMissingMap[r] ?? width,
        })
      }
    }
  }

  // Sort buried cavities: lowest missingInRow first (closest to 10!), then deepest row (bottom-up)
  buriedCavities.sort((a, b) => {
    if (a.missingInRow !== b.missingInRow) {
      return a.missingInRow - b.missingInRow
    }
    if (b.row !== a.row) {
      return b.row - a.row
    }
    return a.col - b.col
  })

  // 4. Oracle Surface Contour Analysis to recommend the ideal geometric piece
  const { recommendedPiece, recommendationReason } = computeOraclePieceRecommendation(
    colHeights,
    buriedCavities,
    maxStackHeight,
    isDangerZone
  )

  return {
    buriedCavities,
    maxStackHeight,
    isDangerZone,
    recommendedPiece,
    recommendationReason,
    rowComplements,
  }
}

function computeOraclePieceRecommendation(
  colHeights: number[],
  buriedCavities: BuriedCavity[],
  maxStackHeight: number,
  isDangerZone: boolean
): { recommendedPiece: PieceType; recommendationReason: string } {
  const width = colHeights.length

  // Case 0: Completely empty or nearly empty board
  if (maxStackHeight === 0) {
    return {
      recommendedPiece: 'I',
      recommendationReason:
        'Tabuleiro limpo Base-10 → Barra Solar I (1×4 = 4) inicia uma fundação plana perfeita!',
    }
  }

  // Find deepest vertical well (1-column wide canyon surrounded by higher walls)
  let deepestWellCol = -1
  let deepestWellDepth = 0

  for (let c = 0; c < width; c++) {
    const leftH = c === 0 ? colHeights[c + 1] ?? 0 : colHeights[c - 1]
    const rightH = c === width - 1 ? colHeights[c - 1] ?? 0 : colHeights[c + 1]
    const minWall = Math.min(leftH, rightH)
    const wellDepth = minWall - colHeights[c]

    if (wellDepth > deepestWellDepth) {
      deepestWellDepth = wellDepth
      deepestWellCol = c
    }
  }

  // Case 1: Deep vertical well (>= 3 blocks) -> 'I' Bar is the undisputed hero!
  if (deepestWellDepth >= 3 && deepestWellCol !== -1) {
    return {
      recommendedPiece: 'I',
      recommendationReason: `Poço vertical de ${deepestWellDepth} blocos na coluna ${deepestWellCol + 1} → Barra Solar I (1×4 = 4) limpa múltiplas linhas!`,
    }
  }

  // Case 2: Critical danger zone or 1-block narrow gap where only DOT_1X1 or DOMINO_1X2 fits cleanly
  if (deepestWellDepth === 2 && deepestWellCol !== -1 && isDangerZone) {
    return {
      recommendedPiece: 'DOMINO_1X2',
      recommendationReason: `Poço de 2 blocos na coluna ${deepestWellCol + 1} em zona de alerta → Dominó 1×2 sela sem elevar a pilha!`,
    }
  }

  if (
    (deepestWellDepth === 1 && deepestWellCol !== -1 && isDangerZone) ||
    (isDangerZone && buriedCavities.length > 0 && buriedCavities[0].missingInRow === 1)
  ) {
    const targetCol = deepestWellCol !== -1 ? deepestWellCol + 1 : buriedCavities[0].col + 1
    return {
      recommendedPiece: 'DOT_1X1',
      recommendationReason: `Fresta unitária (1×1) na coluna ${targetCol} → Monominó Dourado (1×1 = 1) fecha a linha com precisão cirúrgica!`,
    }
  }

  // Case 3: Look for a 3-column symmetric valley [h, h-1, h] -> 'T' piece
  for (let c = 0; c <= width - 3; c++) {
    const h0 = colHeights[c]
    const h1 = colHeights[c + 1]
    const h2 = colHeights[c + 2]
    if (h0 === h2 && h0 - h1 === 1) {
      return {
        recommendedPiece: 'T',
        recommendationReason: `Encaixe piramidal nas colunas ${c + 1}–${c + 3} → Tridente Lógico T (3+1 = 4) nivela o degrau central!`,
      }
    }
  }

  // Case 4: Look for a 2-block vertical step alongside a flat base -> 'L' or 'J'
  for (let c = 0; c <= width - 2; c++) {
    const diff = colHeights[c] - colHeights[c + 1]
    if (diff === 2) {
      return {
        recommendedPiece: 'L',
        recommendationReason: `Degrau duplo à direita (colunas ${c + 1}–${c + 2}) → Âncora L (3+1 = 4) compensa a parede esquerda!`,
      }
    }
    if (diff === -2) {
      return {
        recommendedPiece: 'J',
        recommendationReason: `Degrau duplo à esquerda (colunas ${c + 1}–${c + 2}) → Âncora J (3+1 = 4) compensa a parede direita!`,
      }
    }
  }

  // Case 5: Look for a 2-column flat plateau at the lowest height -> 'O' square
  const minHeight = Math.min(...colHeights)
  for (let c = 0; c <= width - 2; c++) {
    if (colHeights[c] === minHeight && colHeights[c + 1] === minHeight) {
      // Check if 4-column flat plateau exists -> 'I' horizontal
      if (
        c <= width - 4 &&
        colHeights[c + 2] === minHeight &&
        colHeights[c + 3] === minHeight
      ) {
        return {
          recommendedPiece: 'I',
          recommendationReason: `Base plana de 4 colunas (${c + 1}–${c + 4}) → Barra Solar I (1×4 = 4) preenche 40% da linha de uma vez!`,
        }
      }
      return {
        recommendedPiece: 'O',
        recommendationReason: `Platô duplo nas colunas ${c + 1}–${c + 2} → Cubo Dourado O (2×2 = 4) estabiliza a fundação!`,
      }
    }
  }

  // Case 6: Staircase / diagonal steps -> 'S' or 'Z'
  for (let c = 0; c <= width - 3; c++) {
    const h0 = colHeights[c]
    const h1 = colHeights[c + 1]
    const h2 = colHeights[c + 2]
    if (h0 === h1 && h2 === h1 + 1) {
      return {
        recommendedPiece: 'S',
        recommendationReason: `Degrau ascendente nas colunas ${c + 1}–${c + 3} → Ponte S (2+2 = 4) harmoniza o desnível!`,
      }
    }
    if (h1 === h2 && h0 === h1 + 1) {
      return {
        recommendedPiece: 'Z',
        recommendationReason: `Degrau descendente nas colunas ${c + 1}–${c + 3} → Ponte Z (2+2 = 4) harmoniza o desnível!`,
      }
    }
  }

  // Fallback for 1-block well in normal zone
  if (deepestWellDepth >= 1 && deepestWellCol !== -1) {
    return {
      recommendedPiece: 'DOT_1X1',
      recommendationReason: `Fresta de 1 coluna na posição ${deepestWellCol + 1} → Monominó Dourado (1×1 = 1) nivela a linha sem deixar buracos!`,
    }
  }

  return {
    recommendedPiece: 'T',
    recommendationReason:
      'Superfície mista → Tridente Lógico T (3+1 = 4) oferece versatilidade máxima de rotação SRS!',
  }
}
