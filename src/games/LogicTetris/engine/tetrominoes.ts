import {
  ActivePiece,
  BOARD_WIDTH,
  PieceDefinition,
  PieceType,
  RotationDirection,
  RotationState,
  SpecialPieceType,
  StandardPieceType,
} from '../types'

export const STANDARD_PIECE_TYPES: StandardPieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
export const SPECIAL_PIECE_TYPES: SpecialPieceType[] = ['DOT_1X1', 'DOMINO_1X2']
export const ALL_PIECE_TYPES: PieceType[] = [...STANDARD_PIECE_TYPES, ...SPECIAL_PIECE_TYPES]

export const TETROMINO_DEFS: Record<PieceType, PieceDefinition> = {
  I: {
    type: 'I',
    label: 'I',
    namePt: 'Barra Solar I',
    pedagogicalNote:
      'Retângulo 1×4 (Área 4): Quando dobramos o comprimento do quadrado 2×2 e cortamos a altura pela metade (Dobrar e Meiar), nasce a Barra I!',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.55)',
    borderColor: '#67e8f9',
    symbol: '━',
    areaFormula: '1 × 4 = 4',
    blockCount: 4,
    matrices: {
      0: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      1: [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
      ],
      2: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ],
      3: [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
      ],
    },
  },
  O: {
    type: 'O',
    label: 'O',
    namePt: 'Cubo Dourado O',
    pedagogicalNote:
      'Quadrado Perfeito 2×2 (Área 4): A forma mais estável da geometria. Invariante sob rotação de 90°!',
    color: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.55)',
    borderColor: '#fde047',
    symbol: '■',
    areaFormula: '2 × 2 = 4',
    blockCount: 4,
    matrices: {
      0: [
        [1, 1],
        [1, 1],
      ],
      1: [
        [1, 1],
        [1, 1],
      ],
      2: [
        [1, 1],
        [1, 1],
      ],
      3: [
        [1, 1],
        [1, 1],
      ],
    },
  },
  T: {
    type: 'T',
    label: 'T',
    namePt: 'Tridente Lógico T',
    pedagogicalNote:
      'Decomposição Simétrica (3 + 1 = 4): Eixo central de equilíbrio perfeito para nivelar degraus piramidais.',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.55)',
    borderColor: '#d8b4fe',
    symbol: '▲',
    areaFormula: '3 + 1 = 4',
    blockCount: 4,
    matrices: {
      0: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      1: [
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 0],
      ],
      2: [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ],
      3: [
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    },
  },
  S: {
    type: 'S',
    label: 'S',
    namePt: 'Ponte Ascendente S',
    pedagogicalNote:
      'Paridade Dupla (2 + 2 = 4): Dois pares deslocados que compensam degraus ascendentes para a direita.',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.55)',
    borderColor: '#6ee7b7',
    symbol: '◢',
    areaFormula: '2 + 2 = 4',
    blockCount: 4,
    matrices: {
      0: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
      ],
      1: [
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 1],
      ],
      2: [
        [0, 0, 0],
        [0, 1, 1],
        [1, 1, 0],
      ],
      3: [
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    },
  },
  Z: {
    type: 'Z',
    label: 'Z',
    namePt: 'Ponte Descendente Z',
    pedagogicalNote:
      'Espelho Simétrico (2 + 2 = 4): Dois pares deslocados que compensam degraus descendentes para a direita.',
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.55)',
    borderColor: '#fda4af',
    symbol: '◣',
    areaFormula: '2 + 2 = 4',
    blockCount: 4,
    matrices: {
      0: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ],
      1: [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
      2: [
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 1],
      ],
      3: [
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
      ],
    },
  },
  J: {
    type: 'J',
    label: 'J',
    namePt: 'Âncora Esquerda J',
    pedagogicalNote:
      'Vetor Angular Esquerdo (3 + 1 = 4): Ideal para selar cantos profundos de 2 blocos na borda esquerda.',
    color: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.55)',
    borderColor: '#93c5fd',
    symbol: '┏',
    areaFormula: '3 + 1 = 4',
    blockCount: 4,
    matrices: {
      0: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      1: [
        [0, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
      ],
      2: [
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 1],
      ],
      3: [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
    },
  },
  L: {
    type: 'L',
    label: 'L',
    namePt: 'Âncora Direita L',
    pedagogicalNote:
      'Vetor Angular Direito (3 + 1 = 4): Ideal para selar cantos profundos de 2 blocos na borda direita.',
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.55)',
    borderColor: '#fdba74',
    symbol: '┓',
    areaFormula: '3 + 1 = 4',
    blockCount: 4,
    matrices: {
      0: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
      1: [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
      ],
      2: [
        [0, 0, 0],
        [1, 1, 1],
        [1, 0, 0],
      ],
      3: [
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ],
    },
  },
  DOT_1X1: {
    type: 'DOT_1X1',
    label: '1×1',
    namePt: 'Monominó Dourado (1×1)',
    pedagogicalNote:
      'Átomo Unitário (1 × 1 = 1): A unidade indivisível da aritmética! Entra em qualquer fresta de 1 coluna onde nenhuma outra peça cabe.',
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.8)',
    borderColor: '#fef08a',
    symbol: '★',
    areaFormula: '1 × 1 = 1',
    blockCount: 1,
    matrices: {
      0: [[1]],
      1: [[1]],
      2: [[1]],
      3: [[1]],
    },
  },
  DOMINO_1X2: {
    type: 'DOMINO_1X2',
    label: '1×2',
    namePt: 'Dominó Harmônico (1×2)',
    pedagogicalNote:
      'Par Primordial (1 × 2 = 2): Metade exata de um tetrominó (4 ÷ 2 = 2). Perfeito para frestas duplas ou poços rasos!',
    color: '#2dd4bf',
    glowColor: 'rgba(45, 212, 191, 0.7)',
    borderColor: '#99f6e4',
    symbol: '═',
    areaFormula: '1 × 2 = 2',
    blockCount: 2,
    matrices: {
      0: [
        [1, 1],
        [0, 0],
      ],
      1: [
        [0, 1],
        [0, 1],
      ],
      2: [
        [0, 0],
        [1, 1],
      ],
      3: [
        [1, 0],
        [1, 0],
      ],
    },
  },
}

export function getPieceDefinition(type: PieceType): PieceDefinition {
  return TETROMINO_DEFS[type]
}

export function getPieceMatrix(type: PieceType, rotation: RotationState): number[][] {
  return TETROMINO_DEFS[type].matrices[rotation]
}

export function getNextRotation(
  current: RotationState,
  direction: RotationDirection = 'CW'
): RotationState {
  if (direction === 'CW') {
    return ((current + 1) % 4) as RotationState
  }
  if (direction === 'CCW') {
    return ((current + 3) % 4) as RotationState
  }
  return ((current + 2) % 4) as RotationState
}

/**
 * Returns the exact board coordinates (row, col) occupied by a piece's filled cells ('1').
 */
export function getPieceOccupiedCells(
  piece: Pick<ActivePiece, 'type' | 'rotation' | 'x' | 'y'>
): Array<{ row: number; col: number }> {
  const matrix = getPieceMatrix(piece.type, piece.rotation)
  const cells: Array<{ row: number; col: number }> = []

  for (let r = 0; r < matrix.length; r++) {
    const rowArr = matrix[r]
    for (let c = 0; c < rowArr.length; c++) {
      if (rowArr[c] === 1) {
        cells.push({
          row: piece.y + r,
          col: piece.x + c,
        })
      }
    }
  }

  return cells
}

/**
 * Generates a fair 7-Bag sequence using Fisher-Yates shuffle on the 7 canonical tetrominoes.
 * Prevents cruel droughts (e.g., waiting 40 pieces for an 'I' bar).
 */
export function createSevenBag(rng: () => number = Math.random): StandardPieceType[] {
  const bag: StandardPieceType[] = [...STANDARD_PIECE_TYPES]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = bag[i]
    bag[i] = bag[j]
    bag[j] = temp
  }
  return bag
}

/**
 * Creates a fresh ActivePiece centered horizontally at the top of the 10-column Base-10 grid.
 */
export function createSpawnPiece(type: PieceType): ActivePiece {
  const matrix = getPieceMatrix(type, 0)
  const matrixWidth = matrix[0]?.length ?? 1
  const spawnX = Math.max(0, Math.floor((BOARD_WIDTH - matrixWidth) / 2))

  return {
    type,
    rotation: 0,
    x: spawnX,
    y: 0,
    isMorphed: false,
    graceFloatMs: 0,
  }
}
