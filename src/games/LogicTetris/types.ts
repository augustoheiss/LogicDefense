export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export type GameMode = 'zen' | 'arcade' | 'master'

/** Os 3 estilos de jogo que coexistem dentro do Logic Tetris (O Cordão Tríplice dos Blocos) */
export type SubGameStyle =
  | 'TETRIS_CLASSIC' // Queda clássica de Tetrominós + Linhas horizontais Base-10
  | 'FRUIT_MATCH'    // Pares de Frutas/Cores + Gravidade individual + Cascata de combos (3+ iguais)
  | 'TACTILE_GRID'   // Posicionamento livre sem gravidade + Linhas Horizontais OU Colunas Verticais (10)

/** Modo de alternância entre os 3 estilos durante a partida */
export type StyleRotationMode =
  | 'SIMULTANEOUS'   // Padrão: Troca automaticamente de estilo com animação a cada ciclo de conquistas
  | 'LOCKED'         // Travado: Permanece no estilo escolhido pelo jogador até ele trocar manualmente

export type FruitKind =
  | 'APPLE_RUBY'
  | 'CITRUS_GOLD'
  | 'GRAPE_NEON'
  | 'EMERALD_PEAR'
  | 'BERRY_CYAN'
  | 'STAR_PRISM'

export type FruitColorId = FruitKind

export interface FruitBlockMeta {
  kind: FruitKind
  namePt: string
  emoji: string
  color: string
  glowColor: string
  borderColor: string
  symbol: string
}

export interface FruitPairPiece {
  id: string
  primary: FruitKind
  secondary: FruitKind
  x: number
  y: number
  orientation: 0 | 1 | 2 | 3 // 0 = secondary top, 1 = right, 2 = bottom, 3 = left
  isWildcardPair?: boolean
  graceFloatMs?: number
}

export interface TactilePieceOption {
  slotIndex: 0 | 1 | 2
  type: PieceType
  rotation: RotationState
  isUsed: boolean
}

export type DopamineTier =
  | 'NONE'
  | 'WARMUP_1_3'
  | 'HARMONIC_4_6'
  | 'LYDIAN_7_9'
  | 'SUPERNOVA_10_11'
  | 'GENESIS_ECSTASY_12_PLUS'

/** Estado de Momentum e Dopamina de Sequência (1x até 12x+) */
export interface SequenceDopamineState {
  streakCount: number          // Sequência ativa atual (0, 1, 2 ... 12, 15+)
  maxStreakInSession: number   // Maior sequência atingida na partida atual
  comboGraceDropsLeft: number  // Janela de ritmo (3 encaixes preparatórios antes de esfriar a sequência)
  lastDopamineTier: DopamineTier
}

export type StreakDopamineState = SequenceDopamineState
export type ColComplementMap = Record<number, number>

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
  fruitKind?: FruitKind      // Metadado do Cordão Tríplice quando no estilo FRUIT_MATCH
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

export interface FruitCluster {
  kind: FruitKind            // Cor dominante do cacho (ou 'STAR_PRISM' se 100% estrelas)
  cells: Array<{ row: number; col: number }>
  hasWildcardStar: boolean   // true se incluiu pelo menos 1 bloco STAR_PRISM (✦)
}

export interface CascadeWave {
  waveIndex: number          // 1, 2, 3... até MAX_CASCADE_STEPS (16)
  clusters: FruitCluster[]
  poppedCells: Array<{ row: number; col: number; kind: FruitKind; color: string }>
  totalPoppedInWave: number
  mathResonanceFormula: string // Melhoria 02-A: Ex: "4 × 1 = 4 (Quarteto Maçã Rubi)" ou "(3 + 4) × 2 = 14 (Cascata Dupla ×2!)"
  waveScore: number
}

export interface CascadeResolutionResult {
  grid: GridMatrix           // Tabuleiro final estabilizado após todas as ondas e gravidades
  waves: CascadeWave[]       // Lista ordenada de ondas de explosão (Wave 1, Wave 2...)
  totalPoppedBlocks: number  // Soma de todos os blocos estourados
  totalWaves: number         // Quantidade de ondas em cadeia (0 se nenhum grupo >= 3)
  totalScoreEarned: number   // Soma dos pontos das ondas com multiplicador de cascata
  streakDelta: number        // Melhoria 02-B: Quantos pontos de sequência adicionar (+1 por onda, ou +0 se 0 ondas)
  isAllClear: boolean        // true se o tabuleiro ficou 100% vazio após a cascata
}

export interface FruitCascadeOracleReport {
  recommendedFruit: FruitKind
  recommendedCol: number     // Coluna 0..9 com maior potencial de cascata ou fechamento 2 + 1 = 3
  readyPairsCount: number    // Quantos pares conectados de 2 blocos já existem esperando +1
  mostFragmentedFruit: FruitKind // Cor com mais blocos isolados (alvo ideal do Imã [B])
  fragmentedCount: number    // Quantidade de blocos dessa cor no tabuleiro
  pedagogicalHint: string    // Ex: "💡 2 Maçãs Rubi na col 4: falta +1 para fechar 2 + 1 = 3!"
}

export interface GoldenCrossroad {
  row: number                // Linha da Arena 10x10 (10..19)
  col: number                // Coluna da Arena 10x10 (0..9)
  rowMissing: number         // Quantos blocos faltam na linha horizontal (1..3)
  colMissing: number         // Quantos blocos faltam na coluna vertical (1..3)
}

export interface TactileClearResult {
  grid: GridMatrix
  clearedRows: number[]      // Índices das linhas horizontais limpas (em 10..19)
  clearedCols: number[]      // Índices das colunas verticais limpas (em 0..9)
  totalLinesAndCols: number  // clearedRows.length + clearedCols.length
  uniqueClearedBlocks: number// Total real de células apagadas (aplicando Inclusão-Exclusão R*10 + C*10 - R*C)
  isCrossClear: boolean      // true quando clearedRows.length >= 1 && clearedCols.length >= 1
  isAllClear: boolean        // true quando toda a Arena 10x10 (rows 10..19) ficou vazia
  mathResonanceFormula: string // Melhoria 03-A: Ex: "10 (Linha) + 10 (Coluna) − 1 (Cruzamento) = 19 Blocos!"
  scoreEarned: number
  streakDelta: number        // Melhoria 03-B: +1 por linha/coluna +1 extra se isCrossClear
}

export interface TactilePlacementResult {
  valid: boolean
  grid: GridMatrix
  updatedTray: TactilePieceOption[]
  placedCells: Array<{ row: number; col: number }>
  clearResult: TactileClearResult
  canRemainingTrayFit: boolean // false se ainda restam peças não usadas na bandeja e NENHUMA cabe (aciona Fênix!)
}

export interface TactileTopologyReport {
  occupiedCount: number      // 0..100 na Arena 10x10
  freeCount: number          // 100 - occupiedCount
  rowComplements: Record<number, number> // Mapa row (10..19) -> faltam 1..3 blocos para 10
  colComplements: Record<number, number> // Mapa col (0..9) -> faltam 1..3 blocos para 10
  goldenCrossroads: GoldenCrossroad[]    // Coordenadas (r,c) vazias onde linha E coluna faltam 1..3 blocos!
  bestAxisToSeal: { axis: 'ROW' | 'COL'; index: number; missing: number; targetCells: Array<{ row: number; col: number }> } | null
  recommendedPiece: PieceType
  pedagogicalHint: string    // Dica Socrática Zero-Spoiler sobre linha, coluna ou encruzilhada H×V
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
  colComplements?: Record<number, number> // Mapa coluna -> quantos blocos faltam na vertical (TACTILE_GRID)
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
