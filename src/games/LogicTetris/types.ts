export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export type GameMode = 'zen' | 'arcade' | 'master'

export type GamePhase =
  | 'START_HUB'
  | 'PLAYING'
  | 'MATH_MORPH'      // Mudar a peça atual para o formato que precisamos
  | 'MATH_FILL_HOLE'  // Tapar um buraco soterrado no tabuleiro
  | 'MATH_SECOND_WIND'// Salvar a vida quando ia perder no topo
  | 'PAUSED'
  | 'GAME_OVER'

export type StandardPieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
export type SpecialPieceType = 'DOT_1X1' | 'DOMINO_1X2'
export type PieceType = StandardPieceType | SpecialPieceType

export type RotationState = 0 | 1 | 2 | 3 // 0°, 90°, 180°, 270° (SRS)
export type RotationDirection = 'CW' | 'CCW' | '180'

export interface PieceDefinition {
  type: PieceType
  label: string
  namePt: string
  pedagogicalNote: string
  color: string
  glowColor: string
  borderColor: string
  symbol: string             // Símbolo geométrico de acessibilidade (ex: '━', '■', '▲', '◢', '◣', '┏', '┓', '★', '═')
  areaFormula: string        // Conexão Base-10 / Área (ex: '1 × 4 = 4', '2 × 2 = 4', '1 × 1 = 1')
  blockCount: number
  matrices: Record<RotationState, number[][]>
}

export interface ActivePiece {
  type: PieceType
  rotation: RotationState
  x: number                  // Coluna da âncora da matriz da peça
  y: number                  // Linha da âncora da matriz da peça (0 = topo)
  isMorphed?: boolean        // Se foi transmutada pela Alquimia Matemática
  graceFloatMs?: number      // Escudo pós-metamorfose (1200ms de gravidade suave + reset de lock delay)
}

export interface GridCell {
  type: PieceType | 'SEALED_GOLD'
  color: string
  glowColor: string
  borderColor?: string
  symbol: string             // Símbolo para daltônicos e distinção visual
  isSealedHole?: boolean     // true quando materializado pelo milagre [B] Tapar Buraco
  isMorphedBlock?: boolean   // true quando originado de uma peça transmutada por Matemática
}

export type GridMatrix = (GridCell | null)[][]

export interface LineClearResult {
  grid: GridMatrix
  clearedCount: number
  clearedRows: number[]
  isAllClear: boolean
}

export interface SealCavitiesResult {
  grid: GridMatrix
  sealedCoordinates: Array<{ row: number; col: number }>
  lineClearResult: LineClearResult
}

export type ArithmeticOp = '+' | '-' | 'x' | '÷'

export type TetrisMathLensId =
  | 'massinha_soma'         // + : 18 + 7 -> 20 + 5 = 25
  | 'amigos_do_10_falta'    // + : 7 + [?] = 15 (A peça que falta)
  | 'hack_japones'          // - : 42 - 19 -> 43 - 20 = 23
  | 'regra_elevador'        // - : 50 - 34 -> distância até 40 (+6) e 50 (+10) = 16
  | 'dobro_do_dobro_248'    // x : 15 x 4 -> 30 -> 60
  | 'relogio_5_dobra_meia'  // x : 18 x 5 -> 9 x 10 = 90 | 18 x 15 -> 9 x 30 = 270
  | 'infinito_9_quadrados'  // x : 19 x 6 -> 120 - 6 = 114 | 12 x 8 = 100 - 4 = 96
  | 'corta_no_meio_div'     // ÷ : 36 ÷ 4 -> 18 -> 9 | 85 ÷ 5 -> 170 ÷ 10 = 17

export interface MathChoice {
  value: number
  label: string
  isCorrect: boolean
  trapDiagnosis?: string // Explicação acolhedora caso o jogador escolha este distrator
}

export interface TetrisMathChallenge {
  id: string
  op: ArithmeticOp
  lensId: TetrisMathLensId
  lensBadge: string          // Ex: "🗡️ Hack Japonês (Subtração)"
  expression: string         // Ex: "42 − 19 = ?" ou "6 + [ ? ] = 10"
  correctAnswer: number
  choices: MathChoice[]
  shortHint: string          // Luz Guia sempre visível: "💡 Some +1 nos dois: 43 − 20"
  stepByStep: string[]       // Passos claros para o Códice Pedagógico
  interventionType: 'MORPH' | 'FILL_HOLE' | 'SECOND_WIND'
  targetPiece?: PieceType    // Peça escolhida pelo jogador (ou recomendada pelo Oráculo)
  relatedLessonSlug?: string // Slug da aula em /repositorio/:slug (ex: 'equacao-balanca', 'magia-calculo-mental-multiplicacao')
}

export interface BuriedCavity {
  row: number
  col: number
  depth: number              // Quantos blocos estão empilhados acima deste buraco
  missingInRow: number       // Quantos blocos faltam para esta linha completar 10!
}

export interface BoardTopologyReport {
  buriedCavities: BuriedCavity[]
  maxStackHeight: number     // 0 a 20
  isDangerZone: boolean      // maxStackHeight >= 15
  recommendedPiece: PieceType
  recommendationReason: string // Ex: "Poço de 3+ blocos na coluna 9 → Peça I recomendada!"
  rowComplements: Record<number, number> // Mapa linha -> quantos blocos faltam para 10 (quando entre 1 e 3)
}

export interface FloatingFeedback {
  id: string
  text: string
  subtext?: string
  color: 'cyan' | 'gold' | 'green' | 'purple'
  createdAt: number
}

export interface SolvedChallengeLog {
  challenge: TetrisMathChallenge
  solvedAt: number
  wasFirstTry: boolean
  effectSummary: string
}

export interface LogicTetrisPersistentStats {
  highScore: number
  bestLines: number
  totalMathSolved: number
  totalMorphs: number
  totalHolesSealed: number
  totalSecondWinds: number
  preferredMode: GameMode
}
