import { create } from 'zustand'
import {
  ActivePiece,
  BoardAnimationChoreography,
  BoardTopologyReport,
  CascadeWave,
  CascadeWaveTiming,
  DopamineTier,
  FloatingFeedback,
  FruitCascadeOracleReport,
  FruitCoord,
  FruitPairPiece,
  GameMode,
  GamePhase,
  GridMatrix,
  HardDropTrailSnapshot,
  LogicTetrisPersistentStats,
  MiraclePowerTier,
  PieceType,
  RotationDirection,
  RotationState,
  SolvedChallengeLog,
  StandardPieceType,
  StyleRotationMode,
  SubGameStyle,
  TactilePieceOption,
  TactileTopologyReport,
  TetrisMathChallenge,
} from '../types'
import {
  clearCompletedLines,
  computeGhostY,
  createEmptyGrid,
  findSafeMorphPlacement,
  GRACE_FLOAT_AFTER_MORPH_MS,
  hasCollision,
  lockPieceToGrid,
  movePieceIfValid,
  purifyBottomRows,
  sealBuriedCavities,
  tryRotateSRS,
} from '../engine/gridEngine'
import {
  createSevenBag,
  createSpawnPiece,
  getPieceDefinition,
  getPieceOccupiedCells,
} from '../engine/tetrominoes'
import {
  createSpawnFruitPair,
  forgeWildcardStarsOnBoard,
  FRUIT_GRID_COLS,
  FRUIT_GRID_ROWS,
  generatePlayableFruitBoard10x10,
  magnetizeSingleFruitColor,
  morphFruitPairToWildcardOrTarget,
  purifyTopTwoFruitColors,
  scanFruitCascadeOracle,
  swapAdjacentFruitsAndResolve,
} from '../engine/fruitMatchEngine'
import {
  generateTactilePieceTray,
  morphTactileTrayPiece,
  normalizeGridForTactileTransition,
  placeTactileTrayPiece,
  purgeMajorityBlocksForTransition,
  purifyTactileGridSecondWind,
  scanTactileGridTopology,
  sealTactileRowOrColCavities,
  TACTILE_COL_END,
  TACTILE_COL_START,
  TACTILE_ROW_END,
  TACTILE_ROW_START,
} from '../engine/tactileGridEngine'
import { scanBoardTopology } from '../engine/cavityScanner'
import { generateMathChallenge, getMiracleTierSpec } from '../engine/mathEngine'
import { getSequenceDopamineTier, soundEngine } from '../audio/soundEngine'

const STATS_STORAGE_KEY = 'logic_tetris_v1_stats'
const RECENT_MATH_IDS_SESSION_KEY = 'logic_tetris_v5_recent_math_ids'
const RECENT_MATH_IDS_MAX = 250
export const LOCK_DELAY_LIMIT_MS = 500
export const MAX_LOCK_RESETS = 15
export const POST_MODAL_INPUT_GUARD_MS = 250
export const STYLE_SHIFT_TARGET = 4
export const STYLE_TRANSITION_DURATION_MS = 900

export const TRINITY_STYLE_CYCLE: readonly SubGameStyle[] = [
  'TETRIS_CLASSIC',
  'FRUIT_MATCH',
  'TACTILE_GRID',
]

export function getSubGameStyleLabelPt(style: SubGameStyle): string {
  if (style === 'FRUIT_MATCH') return 'Frutas 10×10 (Troca & Cascata)'
  if (style === 'TACTILE_GRID') return 'Arena Tátil H×V (10×10)'
  return 'Tetris Clássico (20×10)'
}

export function getSubGameStylePedagogicalSubtitle(style: SubGameStyle): string {
  if (style === 'FRUIT_MATCH') {
    return 'Arena 10×10 Cheia de Frutas — Troque Vizinhas & Cascatas (2 + 1 = 3)'
  }
  if (style === 'TACTILE_GRID') {
    return 'Geometria Base-10 (10×10) — Macro-Blocos 3×3 & Cruzamentos H×V'
  }
  return 'Arquitetura Clássica (20×10) — Área & Encaixe Base-10'
}

function getNextCycleStyle(current: SubGameStyle): SubGameStyle {
  const idx = TRINITY_STYLE_CYCLE.indexOf(current)
  return TRINITY_STYLE_CYCLE[(idx + 1) % TRINITY_STYLE_CYCLE.length] ?? 'TETRIS_CLASSIC'
}

const DEFAULT_PERSISTENT_STATS: LogicTetrisPersistentStats = {
  highScore: 0,
  bestLines: 0,
  totalMathSolved: 0,
  totalMorphs: 0,
  totalHolesSealed: 0,
  totalSecondWinds: 0,
  preferredMode: 'arcade',
}

function loadPersistentStats(): LogicTetrisPersistentStats {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PERSISTENT_STATS }
  }
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PERSISTENT_STATS }
    const parsed = JSON.parse(raw) as Partial<LogicTetrisPersistentStats>
    return {
      highScore: typeof parsed.highScore === 'number' ? parsed.highScore : 0,
      bestLines: typeof parsed.bestLines === 'number' ? parsed.bestLines : 0,
      totalMathSolved: typeof parsed.totalMathSolved === 'number' ? parsed.totalMathSolved : 0,
      totalMorphs: typeof parsed.totalMorphs === 'number' ? parsed.totalMorphs : 0,
      totalHolesSealed: typeof parsed.totalHolesSealed === 'number' ? parsed.totalHolesSealed : 0,
      totalSecondWinds: typeof parsed.totalSecondWinds === 'number' ? parsed.totalSecondWinds : 0,
      preferredMode:
        parsed.preferredMode === 'zen' ||
        parsed.preferredMode === 'arcade' ||
        parsed.preferredMode === 'master'
          ? parsed.preferredMode
          : 'arcade',
    }
  } catch {
    return { ...DEFAULT_PERSISTENT_STATS }
  }
}

function savePersistentStats(stats: LogicTetrisPersistentStats): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // Graceful no-op if storage is restricted
  }
}

function loadRecentChallengeIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(RECENT_MATH_IDS_SESSION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string').slice(-RECENT_MATH_IDS_MAX)
      : []
  } catch {
    return []
  }
}

function appendRecentChallengeId(prev: string[], nextId: string): string[] {
  const updated = [...prev.filter((id) => id !== nextId), nextId].slice(-RECENT_MATH_IDS_MAX)
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(RECENT_MATH_IDS_SESSION_KEY, JSON.stringify(updated))
    } catch {
      // Graceful no-op
    }
  }
  return updated
}

function ensureQueueDepth(queue: StandardPieceType[], minLength: number = 7): StandardPieceType[] {
  const next = [...queue]
  while (next.length < minLength) {
    next.push(...createSevenBag())
  }
  return next
}

function computeBaseGravityIntervalMs(level: number, mode: GameMode): number {
  if (mode === 'zen') {
    return Math.max(420, 950 - (level - 1) * 40)
  }
  if (mode === 'master') {
    return Math.max(130, 680 - (level - 1) * 55)
  }
  return Math.max(160, 820 - (level - 1) * 50)
}

function computeLineClearBaseScore(clearedCount: number): number {
  if (clearedCount <= 0) return 0
  if (clearedCount === 1) return 100
  if (clearedCount === 2) return 300
  if (clearedCount === 3) return 500
  return 800 // Tetris Base-10 (4 lines)!
}

function computeUnifiedOracles(grid: GridMatrix): {
  topology: BoardTopologyReport
  fruitOracle: FruitCascadeOracleReport
  tactileTopology: TactileTopologyReport
} {
  const baseTopology = scanBoardTopology(grid)
  const fruitOracle = scanFruitCascadeOracle(grid)
  const tactileTopology = scanTactileGridTopology(grid)
  return {
    topology: {
      ...baseTopology,
      colComplements: tactileTopology.colComplements,
    },
    fruitOracle,
    tactileTopology,
  }
}

function getTimeNowMs(): number {
  return Date.now()
}

function buildFruitCascadeChoreography(
  waves: CascadeWave[],
  options?: {
    kind?: 'FRUIT_SWAP_CASCADE' | 'FRUIT_MAGNET_CASCADE'
    preSwapGrid?: GridMatrix
    swapFrom?: FruitCoord
    swapTo?: FruitCoord
    swapFromCell?: GridMatrix[number][number]
    swapToCell?: GridMatrix[number][number]
  }
): { choreography: BoardAnimationChoreography; waveDelaySeconds: number[] } {
  const startedAtMs = getTimeNowMs()
  const hasSwap = Boolean(options?.swapFrom && options?.swapTo)
  const swapDurationMs = hasSwap ? 170 : 0
  let cursorMs = swapDurationMs
  const waveTimings: CascadeWaveTiming[] = []
  const waveDelaySeconds: number[] = []

  for (let i = 0; i < waves.length; i++) {
    const wave = waves[i]
    const speedFactor = Math.max(0.76, Math.pow(0.9, i))
    const shatterDur = Math.round(265 * speedFactor)
    const gravityDur = Math.round(315 * speedFactor)
    const shatterStartMs = cursorMs
    const shatterEndMs = shatterStartMs + shatterDur
    const gravityStartMs = shatterEndMs
    const gravityEndMs = gravityStartMs + gravityDur
    cursorMs = gravityEndMs

    waveTimings.push({
      waveIndex: wave.waveIndex,
      shatterStartMs,
      shatterEndMs,
      gravityStartMs,
      gravityEndMs,
    })
    waveDelaySeconds.push(Number((shatterStartMs / 1000).toFixed(3)))
  }

  const totalDurationMs = Math.max(cursorMs, swapDurationMs + 320)

  return {
    choreography: {
      id: `anim_fruit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: options?.kind ?? 'FRUIT_SWAP_CASCADE',
      style: 'FRUIT_MATCH',
      startedAtMs,
      totalDurationMs,
      preSwapGrid: options?.preSwapGrid,
      swapFrom: options?.swapFrom,
      swapTo: options?.swapTo,
      swapFromCell: options?.swapFromCell ?? null,
      swapToCell: options?.swapToCell ?? null,
      swapDurationMs,
      waves,
      waveTimings,
    },
    waveDelaySeconds,
  }
}

export interface LogicTetrisStoreState {
  phase: GamePhase
  mode: GameMode
  grid: GridMatrix
  activePiece: ActivePiece
  nextQueue: StandardPieceType[]
  holdPieceType: PieceType | null
  canHold: boolean
  score: number
  lines: number
  level: number
  combo: number
  comboGraceDropsLeft: number
  maxStreakInSession: number
  lastDopamineTier: DopamineTier
  logicCharge: number
  phoenixShields: number
  secondWindUsedCount: number
  secondWindStepsRemaining: number
  secondWindStepsTotal: number
  topology: BoardTopologyReport
  activeChallenge: TetrisMathChallenge | null
  eliminatedChoiceValues: number[]
  lastWrongDiagnosis: string | null
  wrongAttemptsOnCurrentChallenge: number
  recentChallengeIds: string[]
  solvedHistory: SolvedChallengeLog[]
  floatingFeedbacks: FloatingFeedback[]
  lastClearedRows: number[]
  lastSealedCoords: Array<{ row: number; col: number }>
  lastEventCounter: number
  gravityAccumulatorMs: number
  lockDelayMs: number
  lockResetCount: number
  postModalInputGuardUntil: number
  isSoftDropping: boolean
  isCodexOpen: boolean
  isMuted: boolean
  stats: LogicTetrisPersistentStats

  // Phase 04 — Trinity Polymorphic State Properties:
  activeSubGameStyle: SubGameStyle
  styleRotationMode: StyleRotationMode
  styleShiftProgress: number
  styleShiftTarget: number
  isStyleTransitioning: boolean
  styleTransitionRemainingMs: number
  styleTransitionFrom: SubGameStyle | null
  styleTransitionTo: SubGameStyle | null
  totalStyleShiftsCount: number

  // Style #2 (FRUIT_MATCH 10×10 Swap & Cascade) State:
  activeFruitPair: FruitPairPiece
  nextFruitPair: FruitPairPiece
  fruitOracle: FruitCascadeOracleReport
  lastCascadeWaves: CascadeWave[]
  selectedFruitCell: FruitCoord | null
  fruitCursor: FruitCoord
  lastSwappedCells: [FruitCoord, FruitCoord] | null
  invalidSwapBounceUntil: number
  lastPurgedBlocksCount: number
  isFullscreen: boolean

  // Style #3 (TACTILE_GRID) State:
  tactileTray: TactilePieceOption[]
  selectedTraySlot: 0 | 1 | 2
  tactileCursorCol: number
  tactileCursorRow: number
  tactileTopology: TactileTopologyReport
  lastClearedCols: number[]

  // Unified Pedagogical Telemetry (Melhoria 04-A):
  lastMathResonanceFormula: string | null
  lastMiracleToast: string | null
  selectedMiracleTier: MiraclePowerTier

  // Phase 05 (V4) — 60fps Board Choreography & Hard-Drop Trail State:
  activeBoardAnimation: BoardAnimationChoreography | null
  lastHardDropTrail: HardDropTrailSnapshot | null
  pendingAutoStyleShift: {
    targetStyle: SubGameStyle
    remainingMs: number
  } | null

  // Actions:
  setMode: (mode: GameMode) => void
  setMiraclePowerTier: (tier: MiraclePowerTier) => void
  startGame: (mode?: GameMode) => void
  pauseGame: () => void
  resumeGame: () => void
  togglePause: () => void
  returnToHub: () => void
  toggleCodex: (open?: boolean) => void
  toggleMute: () => void
  setSoftDropping: (active: boolean) => void
  moveHorizontal: (dir: -1 | 1) => boolean
  rotatePiece: (direction?: RotationDirection) => boolean
  softDropStep: () => boolean
  hardDrop: () => void
  holdCurrentPiece: () => boolean
  tickLoop: (dtMs: number) => void
  triggerMathMorph: (targetPiece?: PieceType) => void
  setMorphTargetPiece: (targetPiece: PieceType) => void
  triggerMathFillHole: (explicitTier?: MiraclePowerTier) => void
  cancelMathIntervention: () => void
  forfeitSecondWind: () => void
  submitMathChoice: (choiceIndex: number) => 'CORRECT' | 'ELASTIC_BOUNCE' | 'IGNORED'
  pushFloatingFeedback: (
    text: string,
    subtext?: string,
    color?: FloatingFeedback['color']
  ) => void
  pruneFloatingFeedbacks: () => void

  // Phase 04 — Polymorphic Trinity Actions:
  setSubGameStyle: (targetStyle: SubGameStyle, manualLock?: boolean) => void
  cycleSubGameStyle: () => void
  setStyleRotationMode: (rotationMode: StyleRotationMode) => void
  toggleStyleRotationMode: () => void
  selectTactileTraySlot: (slotIndex: 0 | 1 | 2) => void
  moveTactileCursor: (dCol: number, dRow: number) => boolean
  setTactileCursorPosition: (col: number, row: number) => void
  placeSelectedTactilePieceAt: (col?: number, row?: number) => boolean
  moveUp: () => boolean
  selectOrSwapFruitAt: (row: number, col: number) => boolean
  swapFruitCells: (from: FruitCoord, to: FruitCoord) => boolean
  swapFruitInDirection: (dRow: -1 | 0 | 1, dCol: -1 | 0 | 1) => boolean
  moveFruitCursor: (dRow: number, dCol: number) => boolean
  setFullscreen: (active: boolean) => void
}

const initialGrid = createEmptyGrid()
const initialBag = ensureQueueDepth([], 8)
const initialFirstType = initialBag[0]
const initialStats = loadPersistentStats()
const initialOracles = computeUnifiedOracles(initialGrid)

export const useLogicTetrisStore = create<LogicTetrisStoreState>((set, get) => {
  const createFeedbackItem = (
    text: string,
    subtext?: string,
    color: FloatingFeedback['color'] = 'cyan'
  ): FloatingFeedback => ({
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text,
    subtext,
    color,
    createdAt: Date.now(),
  })

  /**
   * Passo 4.2 — Scene Transition Engine (`performStyleShift` — V2 Majority Purge & Full 10×10 Fruit Board):
   * - Elimina a maioria (75%–85%) dos blocos acumulados no cenário anterior (`purgeMajorityBlocksForTransition`),
   *   convertendo cada bloco eliminado em `+30 pts` de bônus!
   * - Ao entrar em `FRUIT_MATCH`, preenche toda a Arena 10×10 (`rows 0..9, cols 0..9` = 100 células) com frutas
   *   prontas para troca ortogonal e combos em cascata (`generatePlayableFruitBoard10x10`).
   * - Ao entrar em `TACTILE_GRID`, adapta para a Arena 10×10 inteira sem cortes (`rows 0..9, cols 0..9`) e sorteia
   *   a bandeja com Macro-Blocos (`CUBE_3X3`, `CORNER_3X3`, `BAR_1X5`, `RECT_2X3`).
   * - Nunca reseta `combo` (`streakCount`) e renova `comboGraceDropsLeft = 3`!
   */
  const performStyleShift = (
    targetStyle: SubGameStyle,
    options?: { manualLock?: boolean; isAutoCycle?: boolean }
  ) => {
    const state = get()
    const nextRotationMode: StyleRotationMode =
      options?.manualLock === true ? 'LOCKED' : state.styleRotationMode

    if (state.phase === 'START_HUB') {
      set({
        activeSubGameStyle: targetStyle,
        styleRotationMode: nextRotationMode,
      })
      return
    }

    if (targetStyle === state.activeSubGameStyle) {
      if (nextRotationMode !== state.styleRotationMode) {
        set({ styleRotationMode: nextRotationMode })
      }
      return
    }

    soundEngine.playStyleShiftFanfare(targetStyle)

    // 1. Elimina a maioria dos blocos (75%–85%) ao trocar de cenário!
    const purgeRes = purgeMajorityBlocksForTransition(state.grid, targetStyle)

    let nextGrid = purgeRes.grid
    let nextActivePiece = state.activePiece
    let nextActiveFruitPair = state.activeFruitPair
    let nextUpcomingFruitPair = state.nextFruitPair
    let nextTactileTray = state.tactileTray
    let nextSelectedTraySlot: 0 | 1 | 2 = state.selectedTraySlot
    let nextCursorCol = state.tactileCursorCol
    let nextCursorRow = state.tactileCursorRow
    let transmutationBonusPoints = purgeRes.transmutationBonusPoints * state.level

    if (targetStyle === 'FRUIT_MATCH') {
      // Preenche 100% da Arena 10×10 (rows 0..9, cols 0..9) com frutas prontas para trocar!
      nextGrid = generatePlayableFruitBoard10x10(purgeRes.grid)
      const oracle = scanFruitCascadeOracle(nextGrid)
      nextActiveFruitPair = {
        ...createSpawnFruitPair(oracle.recommendedFruit),
        graceFloatMs: 1500,
      }
      nextUpcomingFruitPair = createSpawnFruitPair()
    } else if (targetStyle === 'TACTILE_GRID') {
      const norm = normalizeGridForTactileTransition(purgeRes.grid)
      nextGrid = norm.grid
      transmutationBonusPoints += norm.transmutationBonusPoints
      nextTactileTray = generateTactilePieceTray(nextGrid)
      nextSelectedTraySlot = 0
      nextCursorCol = 4
      nextCursorRow = 4
    } else {
      // TETRIS_CLASSIC (Torre 20×10 com a maioria dos blocos eliminados e sobreviventes nas linhas 18..19)
      nextGrid = purgeRes.grid
      const safeSpawn = findSafeMorphPlacement(
        nextGrid,
        createSpawnPiece(state.activePiece.type),
        state.activePiece.type
      )
      nextActivePiece = {
        ...safeSpawn,
        isMorphed: false,
        graceFloatMs: 1500,
      }
    }

    const oracles = computeUnifiedOracles(nextGrid)
    const shiftBonus = 300 * state.level + transmutationBonusPoints
    const nextScore = state.score + shiftBonus
    const styleLabel = getSubGameStyleLabelPt(targetStyle)
    const purgedNote =
      purgeRes.purgedBlocksCount > 0
        ? `💥 ${purgeRes.purgedBlocksCount} blocos eliminados`
        : 'Arena renovada'
    const toastTitle = `🌀 TROCA DE CENÁRIO: ${styleLabel}!`
    const toastSub = `${purgedNote} · +${shiftBonus} pts · Sequência mantida!`

    const updatedStats: LogicTetrisPersistentStats = {
      ...state.stats,
      highScore: Math.max(state.stats.highScore, nextScore),
    }
    savePersistentStats(updatedStats)

    set({
      grid: nextGrid,
      activeSubGameStyle: targetStyle,
      styleRotationMode: nextRotationMode,
      styleShiftProgress: 0,
      isStyleTransitioning: true,
      styleTransitionRemainingMs: STYLE_TRANSITION_DURATION_MS,
      styleTransitionFrom: state.activeSubGameStyle,
      styleTransitionTo: targetStyle,
      totalStyleShiftsCount: state.totalStyleShiftsCount + 1,
      activePiece: nextActivePiece,
      activeFruitPair: nextActiveFruitPair,
      nextFruitPair: nextUpcomingFruitPair,
      selectedFruitCell: null,
      fruitCursor: { row: 4, col: 4 },
      lastSwappedCells: null,
      invalidSwapBounceUntil: 0,
      lastPurgedBlocksCount: purgeRes.purgedBlocksCount,
      tactileTray: nextTactileTray,
      selectedTraySlot: nextSelectedTraySlot,
      tactileCursorCol: nextCursorCol,
      tactileCursorRow: nextCursorRow,
      topology: oracles.topology,
      fruitOracle: oracles.fruitOracle,
      tactileTopology: oracles.tactileTopology,
      score: nextScore,
      comboGraceDropsLeft: 3, // Renews rhythm grace window without ever resetting combo!
      lastMiracleToast: toastTitle,
      activeBoardAnimation: null,
      lastHardDropTrail: null,
      pendingAutoStyleShift: null,
      floatingFeedbacks: [
        ...state.floatingFeedbacks.slice(-5),
        createFeedbackItem(toastTitle, toastSub, 'purple'),
      ],
      lastEventCounter: state.lastEventCounter + 1,
      gravityAccumulatorMs: 0,
      lockDelayMs: 0,
      lockResetCount: 0,
      isSoftDropping: false,
      stats: updatedStats,
    })
  }

  /**
   * Helper to trigger Phoenix Second Wind (or Game Over if shields are 0 in Arcade/Master)
   * when any of the 3 styles encounters a Top-Out / No-Space condition.
   */
  const triggerSecondWindOrGameOver = (
    nextGrid: GridMatrix,
    nextScore: number,
    nextLines: number,
    nextLevel: number,
    nextCombo: number,
    nextGraceDrops: number,
    nextMaxStreak: number,
    nextDopamineTier: DopamineTier,
    nextLogicCharge: number,
    nextPhoenixShields: number,
    nextFeedbacks: FloatingFeedback[],
    updatedStats: LogicTetrisPersistentStats,
    extraPatch?: Partial<LogicTetrisStoreState>
  ) => {
    const state = get()
    const oracles = computeUnifiedOracles(nextGrid)

    if (state.mode === 'zen' || nextPhoenixShields > 0) {
      soundEngine.playSecondWindAlert()
      const stepsRequired =
        state.mode === 'zen' ? 1 : Math.min(3, state.secondWindUsedCount + 1)
      const challenge = generateMathChallenge({
        mode: state.mode,
        interventionType: 'SECOND_WIND',
        level: nextLevel,
        excludeIds: state.recentChallengeIds,
      })

      nextFeedbacks.push(
        createFeedbackItem(
          '🔥 PROTOCOLO FÊNIX ATIVADO!',
          'Resolva a conta para purificar a arena e salvar a vida!',
          'gold'
        )
      )

      set({
        ...extraPatch,
        grid: nextGrid,
        canHold: true,
        score: nextScore,
        lines: nextLines,
        level: nextLevel,
        combo: nextCombo,
        comboGraceDropsLeft: nextGraceDrops,
        maxStreakInSession: nextMaxStreak,
        lastDopamineTier: nextDopamineTier,
        logicCharge: nextLogicCharge,
        phoenixShields: nextPhoenixShields,
        topology: oracles.topology,
        fruitOracle: oracles.fruitOracle,
        tactileTopology: oracles.tactileTopology,
        phase: 'MATH_SECOND_WIND',
        activeChallenge: challenge,
        secondWindStepsRemaining: stepsRequired,
        secondWindStepsTotal: stepsRequired,
        eliminatedChoiceValues: [],
        lastWrongDiagnosis: null,
        wrongAttemptsOnCurrentChallenge: 0,
        recentChallengeIds: appendRecentChallengeId(state.recentChallengeIds, challenge.id),
        floatingFeedbacks: nextFeedbacks,
        lastEventCounter: state.lastEventCounter + 1,
        gravityAccumulatorMs: 0,
        lockDelayMs: 0,
        lockResetCount: 0,
        isSoftDropping: false,
        pendingAutoStyleShift: null,
        stats: updatedStats,
      })
      return
    }

    soundEngine.playGameOver()
    set({
      ...extraPatch,
      grid: nextGrid,
      score: nextScore,
      lines: nextLines,
      level: nextLevel,
      combo: nextCombo,
      comboGraceDropsLeft: nextGraceDrops,
      maxStreakInSession: nextMaxStreak,
      lastDopamineTier: nextDopamineTier,
      topology: oracles.topology,
      fruitOracle: oracles.fruitOracle,
      tactileTopology: oracles.tactileTopology,
      phase: 'GAME_OVER',
      activeChallenge: null,
      floatingFeedbacks: nextFeedbacks,
      lastEventCounter: state.lastEventCounter + 1,
      gravityAccumulatorMs: 0,
      lockDelayMs: 0,
      lockResetCount: 0,
      isSoftDropping: false,
      pendingAutoStyleShift: null,
      stats: updatedStats,
    })
  }

  /**
   * Style #1 (`TETRIS_CLASSIC`) Lock & Line-Clear Handler
   */
  const lockActivePieceAndAdvance = () => {
    const state = get()
    if (state.phase !== 'PLAYING') return

    const lockedCoords = getPieceOccupiedCells(state.activePiece).filter(
      (c) => c.row >= 0 && c.row < 20 && c.col >= 0 && c.col < 10
    )

    const lockedGrid = lockPieceToGrid(state.grid, state.activePiece)
    const clearResult = clearCompletedLines(lockedGrid)
    const nextGrid = clearResult.grid
    const cleared = clearResult.clearedCount

    const boardAnimation: BoardAnimationChoreography =
      cleared > 0
        ? {
            id: `anim_classic_clear_${Date.now()}_${state.lastEventCounter}`,
            kind: 'CLASSIC_LINE_CLEAR',
            style: 'TETRIS_CLASSIC',
            startedAtMs: getTimeNowMs(),
            totalDurationMs: 450,
            laserDurationMs: 205,
            gravityCollapseDurationMs: 245,
            preClearGrid: clearResult.preClearGrid,
            clearedCells: clearResult.clearedCells,
            clearedRows: clearResult.clearedRows,
            rowDropDistances: clearResult.rowDropDistances,
            lockedCells: lockedCoords,
          }
        : {
            id: `anim_classic_lock_${Date.now()}_${state.lastEventCounter}`,
            kind: 'CLASSIC_PIECE_LOCK',
            style: 'TETRIS_CLASSIC',
            startedAtMs: getTimeNowMs(),
            totalDurationMs: 210,
            lockedCells: lockedCoords,
          }

    const nextLines = state.lines + cleared
    const nextLevel = Math.floor(nextLines / 10) + 1

    let nextCombo = state.combo
    let nextGraceDrops = state.comboGraceDropsLeft
    if (cleared > 0) {
      nextCombo = Math.max(0, state.combo) + 1
      nextGraceDrops = 3
    } else if (state.combo > 0) {
      if (state.comboGraceDropsLeft > 0) {
        nextGraceDrops = state.comboGraceDropsLeft - 1
      } else {
        nextCombo = -1
        nextGraceDrops = 3
      }
    } else {
      nextCombo = -1
      nextGraceDrops = 3
    }

    const nextMaxStreak = Math.max(state.maxStreakInSession, Math.max(0, nextCombo))
    const nextDopamineTier = getSequenceDopamineTier(Math.max(0, nextCombo))
    const comboBonus = cleared > 0 && nextCombo > 0 ? nextCombo * 50 * state.level : 0
    const allClearBonus = clearResult.isAllClear ? 1200 * state.level : 0
    const lineScore = computeLineClearBaseScore(cleared) * state.level + comboBonus + allClearBonus
    const nextScore = state.score + lineScore + 10

    const prevTenBucket = Math.floor(state.lines / 10)
    const nextTenBucket = Math.floor(nextLines / 10)
    const earnedShield =
      state.mode !== 'zen' && nextTenBucket > prevTenBucket && state.phoenixShields < 3 ? 1 : 0
    const nextPhoenixShields =
      state.mode === 'zen' ? 99 : Math.min(3, state.phoenixShields + earnedShield)

    const chargeGain = cleared > 0 ? cleared * 25 : 8
    const nextLogicCharge = Math.min(100, state.logicCharge + chargeGain)

    const replenishedQueue = ensureQueueDepth(state.nextQueue, 8)
    const [nextPieceType, ...remainingQueue] = replenishedQueue
    const candidateSpawn = createSpawnPiece(nextPieceType)
    const oracles = computeUnifiedOracles(nextGrid)

    const nextFeedbacks = [...state.floatingFeedbacks].slice(-5)
    let resonanceFormula = state.lastMathResonanceFormula
    if (cleared > 0) {
      soundEngine.playLineClear(cleared, Math.max(1, nextCombo))
      resonanceFormula = `${cleared} × 10 = ${cleared * 10} Blocos (Linha Base-10!)`
      const clearLabels: Record<number, string> = {
        1: '✨ Linha Base-10 Completa!',
        2: '⚡ Duplo Equilíbrio (20 Blocos)!',
        3: '🔥 Triplo Harmônico (30 Blocos)!',
        4: '🌟 TETRIS GÊNESIS! (4 × 10 = 40)!',
      }
      nextFeedbacks.push(
        createFeedbackItem(
          clearLabels[cleared] ?? '✨ Linhas Purificadas!',
          `${resonanceFormula} · +${lineScore} pts${earnedShield ? ' · 🛡️ +1 Escudo Fênix!' : ''}`,
          cleared >= 4 ? 'gold' : 'green'
        )
      )
      if (nextCombo >= 12) {
        nextFeedbacks.push(
          createFeedbackItem(
            `👑 SEQUÊNCIA LENDÁRIA ×${nextCombo}! DOPAMINA MÁXIMA!`,
            `Sinfonia Gênesis 12×+ ativada · +${comboBonus} pts de sequência!`,
            'gold'
          )
        )
      }
    }

    const updatedStats: LogicTetrisPersistentStats = {
      ...state.stats,
      highScore: Math.max(state.stats.highScore, nextScore),
      bestLines: Math.max(state.stats.bestLines, nextLines),
    }
    savePersistentStats(updatedStats)

    const nextShiftProgress =
      cleared > 0 ? state.styleShiftProgress + 1 : state.styleShiftProgress

    if (hasCollision(nextGrid, candidateSpawn, 0, 0)) {
      triggerSecondWindOrGameOver(
        nextGrid,
        nextScore,
        nextLines,
        nextLevel,
        nextCombo,
        nextGraceDrops,
        nextMaxStreak,
        nextDopamineTier,
        nextLogicCharge,
        nextPhoenixShields,
        nextFeedbacks,
        updatedStats,
        {
          activePiece: candidateSpawn,
          nextQueue: ensureQueueDepth(remainingQueue, 7),
          lastClearedRows: clearResult.clearedRows,
          lastClearedCols: [],
          lastMathResonanceFormula: resonanceFormula,
          styleShiftProgress: nextShiftProgress,
          activeBoardAnimation: boardAnimation,
        }
      )
      return
    }

    const shouldAutoShift =
      cleared > 0 &&
      state.styleRotationMode === 'SIMULTANEOUS' &&
      nextShiftProgress >= STYLE_SHIFT_TARGET

    set({
      grid: nextGrid,
      activePiece: candidateSpawn,
      nextQueue: ensureQueueDepth(remainingQueue, 7),
      canHold: true,
      score: nextScore,
      lines: nextLines,
      level: nextLevel,
      combo: nextCombo,
      comboGraceDropsLeft: nextGraceDrops,
      maxStreakInSession: nextMaxStreak,
      lastDopamineTier: nextDopamineTier,
      logicCharge: nextLogicCharge,
      phoenixShields: nextPhoenixShields,
      topology: oracles.topology,
      fruitOracle: oracles.fruitOracle,
      tactileTopology: oracles.tactileTopology,
      floatingFeedbacks: nextFeedbacks,
      lastClearedRows: clearResult.clearedRows,
      lastClearedCols: [],
      lastMathResonanceFormula: resonanceFormula,
      styleShiftProgress: nextShiftProgress,
      activeBoardAnimation: boardAnimation,
      pendingAutoStyleShift: shouldAutoShift
        ? { targetStyle: 'FRUIT_MATCH', remainingMs: 460 }
        : state.pendingAutoStyleShift,
      lastEventCounter: state.lastEventCounter + 1,
      gravityAccumulatorMs: 0,
      lockDelayMs: 0,
      lockResetCount: 0,
      stats: updatedStats,
    })
  }

  /**
   * Style #2 (`FRUIT_MATCH` 10×10 Swap & Cascade) Swap Resolution Handler
   */
  const executeFruitSwapAndAdvance = (from: FruitCoord, to: FruitCoord): boolean => {
    const state = get()
    if (state.phase !== 'PLAYING') return false
    if (Date.now() < state.postModalInputGuardUntil) return false

    const swapFromCell = state.grid[from.row]?.[from.col] ?? null
    const swapToCell = state.grid[to.row]?.[to.col] ?? null

    const swapRes = swapAdjacentFruitsAndResolve(state.grid, from, to)
    if (!swapRes.validSwap) {
      soundEngine.playElasticBounce()
      set({
        selectedFruitCell: null,
        fruitCursor: to,
        lastSwappedCells: [from, to],
        invalidSwapBounceUntil: Date.now() + 380,
        floatingFeedbacks: [
          ...state.floatingFeedbacks.slice(-5),
          createFeedbackItem(
            '🔄 Troca Elástica!',
            'Alinhe 3+ frutas da mesma cor (2 + 1 = 3) ou use uma Estrela ✦!',
            'gold'
          ),
        ],
      })
      return false
    }

    const nextGrid = swapRes.grid
    const wavesCleared = Math.max(1, swapRes.totalWaves)
    const nextLines = state.lines + wavesCleared
    const nextLevel = Math.floor(nextLines / 10) + 1

    const nextCombo = Math.max(0, state.combo) + Math.max(1, swapRes.streakDelta)
    const nextGraceDrops = 3
    const nextMaxStreak = Math.max(state.maxStreakInSession, nextCombo)
    const nextDopamineTier = getSequenceDopamineTier(nextCombo)
    const comboBonus = nextCombo > 0 ? nextCombo * 50 * state.level : 0
    const cascadeScore = swapRes.totalScoreEarned * state.level + comboBonus
    const nextScore = state.score + cascadeScore

    const prevTenBucket = Math.floor(state.lines / 10)
    const nextTenBucket = Math.floor(nextLines / 10)
    const earnedShield =
      state.mode !== 'zen' && nextTenBucket > prevTenBucket && state.phoenixShields < 3 ? 1 : 0
    const nextPhoenixShields =
      state.mode === 'zen' ? 99 : Math.min(3, state.phoenixShields + earnedShield)

    const chargeGain = wavesCleared * 25
    const nextLogicCharge = Math.min(100, state.logicCharge + chargeGain)

    const { choreography, waveDelaySeconds } = buildFruitCascadeChoreography(
      swapRes.waves,
      {
        kind: 'FRUIT_SWAP_CASCADE',
        preSwapGrid: state.grid,
        swapFrom: from,
        swapTo: to,
        swapFromCell,
        swapToCell,
      }
    )

    const oracles = computeUnifiedOracles(nextGrid)
    const nextFeedbacks = [...state.floatingFeedbacks].slice(-5)
    soundEngine.playSequenceDopamine(
      Math.max(1, nextCombo),
      wavesCleared,
      'FRUIT_MATCH'
    )
    soundEngine.playCascadeWaveTimeline(
      waveDelaySeconds,
      Math.max(1, nextCombo),
      'FRUIT_MATCH'
    )

    const lastWave = swapRes.waves[swapRes.waves.length - 1]
    const resonanceFormula =
      lastWave?.mathResonanceFormula ??
      `${swapRes.totalPoppedBlocks} × 1 = ${swapRes.totalPoppedBlocks} Frutas!`

    nextFeedbacks.push(
      createFeedbackItem(
        wavesCleared >= 2
          ? `🍇 Cascata ×${wavesCleared}! (${swapRes.totalPoppedBlocks} Frutas!)`
          : `🍎 Troca Explosiva! (${swapRes.totalPoppedBlocks} Frutas!)`,
        `${resonanceFormula} · +${cascadeScore} pts`,
        wavesCleared >= 2 ? 'gold' : 'green'
      )
    )
    if (nextCombo >= 12) {
      nextFeedbacks.push(
        createFeedbackItem(
          `👑 SEQUÊNCIA LENDÁRIA ×${nextCombo}! DOPAMINA MÁXIMA!`,
          `Sinfonia Gênesis 12×+ em cascata!`,
          'gold'
        )
      )
    }

    const updatedStats: LogicTetrisPersistentStats = {
      ...state.stats,
      highScore: Math.max(state.stats.highScore, nextScore),
      bestLines: Math.max(state.stats.bestLines, nextLines),
    }
    savePersistentStats(updatedStats)

    const nextShiftProgress = state.styleShiftProgress + 1
    const shouldAutoShift =
      state.styleRotationMode === 'SIMULTANEOUS' &&
      nextShiftProgress >= STYLE_SHIFT_TARGET

    set({
      grid: nextGrid,
      selectedFruitCell: null,
      fruitCursor: to,
      lastSwappedCells: [from, to],
      invalidSwapBounceUntil: 0,
      canHold: true,
      score: nextScore,
      lines: nextLines,
      level: nextLevel,
      combo: nextCombo,
      comboGraceDropsLeft: nextGraceDrops,
      maxStreakInSession: nextMaxStreak,
      lastDopamineTier: nextDopamineTier,
      logicCharge: nextLogicCharge,
      phoenixShields: nextPhoenixShields,
      topology: oracles.topology,
      fruitOracle: oracles.fruitOracle,
      tactileTopology: oracles.tactileTopology,
      lastCascadeWaves: swapRes.waves,
      lastMathResonanceFormula: resonanceFormula,
      styleShiftProgress: nextShiftProgress,
      activeBoardAnimation: choreography,
      pendingAutoStyleShift: shouldAutoShift
        ? {
            targetStyle: 'TACTILE_GRID',
            remainingMs: Math.min(1500, choreography.totalDurationMs + 90),
          }
        : state.pendingAutoStyleShift,
      floatingFeedbacks: nextFeedbacks,
      lastEventCounter: state.lastEventCounter + 1,
      gravityAccumulatorMs: 0,
      lockDelayMs: 0,
      lockResetCount: 0,
      stats: updatedStats,
    })

    return true
  }

  return {
    phase: 'START_HUB',
    mode: initialStats.preferredMode,
    grid: initialGrid,
    activePiece: createSpawnPiece(initialFirstType),
    nextQueue: initialBag.slice(1),
    holdPieceType: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    comboGraceDropsLeft: 3,
    maxStreakInSession: 0,
    lastDopamineTier: 'NONE',
    logicCharge: 100,
    phoenixShields: 2,
    secondWindUsedCount: 0,
    secondWindStepsRemaining: 0,
    secondWindStepsTotal: 0,
    topology: initialOracles.topology,
    activeChallenge: null,
    eliminatedChoiceValues: [],
    lastWrongDiagnosis: null,
    wrongAttemptsOnCurrentChallenge: 0,
    recentChallengeIds: loadRecentChallengeIds(),
    solvedHistory: [],
    floatingFeedbacks: [],
    lastClearedRows: [],
    lastSealedCoords: [],
    lastEventCounter: 0,
    gravityAccumulatorMs: 0,
    lockDelayMs: 0,
    lockResetCount: 0,
    postModalInputGuardUntil: 0,
    isSoftDropping: false,
    isCodexOpen: false,
    isMuted: soundEngine.isMuted(),
    stats: initialStats,

    // Phase 04 Initial State:
    activeSubGameStyle: 'TETRIS_CLASSIC',
    styleRotationMode: 'SIMULTANEOUS',
    styleShiftProgress: 0,
    styleShiftTarget: STYLE_SHIFT_TARGET,
    isStyleTransitioning: false,
    styleTransitionRemainingMs: 0,
    styleTransitionFrom: null,
    styleTransitionTo: null,
    totalStyleShiftsCount: 0,
    activeFruitPair: createSpawnFruitPair('APPLE_RUBY', 'CITRUS_GOLD'),
    nextFruitPair: createSpawnFruitPair('GRAPE_NEON', 'BERRY_CYAN'),
    fruitOracle: initialOracles.fruitOracle,
    lastCascadeWaves: [],
    selectedFruitCell: null,
    fruitCursor: { row: 4, col: 4 },
    lastSwappedCells: null,
    invalidSwapBounceUntil: 0,
    lastPurgedBlocksCount: 0,
    isFullscreen: false,
    tactileTray: generateTactilePieceTray(initialGrid),
    selectedTraySlot: 0,
    tactileCursorCol: 4,
    tactileCursorRow: 4,
    tactileTopology: initialOracles.tactileTopology,
    lastClearedCols: [],
    lastMathResonanceFormula: null,
    lastMiracleToast: null,
    selectedMiracleTier: 1,
    activeBoardAnimation: null,
    lastHardDropTrail: null,
    pendingAutoStyleShift: null,

    setMiraclePowerTier: (tier: MiraclePowerTier) => {
      const state = get()
      soundEngine.playRotate()
      if (
        (state.phase === 'MATH_MORPH' || state.phase === 'MATH_FILL_HOLE') &&
        state.activeChallenge
      ) {
        const topCavity = state.topology.buriedCavities[0]
        const missingInRow =
          state.activeSubGameStyle === 'TACTILE_GRID'
            ? state.tactileTopology.bestAxisToSeal?.missing
            : topCavity?.missingInRow
        const nextChallenge = generateMathChallenge({
          mode: state.mode,
          interventionType: state.activeChallenge.interventionType,
          level: state.level,
          targetPiece: state.activeChallenge.targetPiece,
          missingInRow,
          miracleTier: tier,
          excludeIds: state.recentChallengeIds,
        })
        set({
          selectedMiracleTier: tier,
          activeChallenge: nextChallenge,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          recentChallengeIds: appendRecentChallengeId(state.recentChallengeIds, nextChallenge.id),
        })
      } else {
        set({ selectedMiracleTier: tier })
      }
    },

    setMode: (mode: GameMode) => {
      const currentStats = get().stats
      const updatedStats: LogicTetrisPersistentStats = {
        ...currentStats,
        preferredMode: mode,
      }
      savePersistentStats(updatedStats)
      set({
        mode,
        phoenixShields: mode === 'zen' ? 99 : mode === 'arcade' ? 2 : 1,
        stats: updatedStats,
      })
    },

    startGame: (explicitMode?: GameMode) => {
      const state = get()
      const targetMode = explicitMode ?? state.mode
      const startingStyle: SubGameStyle =
        state.phase === 'START_HUB' ? state.activeSubGameStyle : 'TETRIS_CLASSIC'
      const freshGrid =
        startingStyle === 'FRUIT_MATCH'
          ? generatePlayableFruitBoard10x10()
          : createEmptyGrid()
      const freshBag = ensureQueueDepth([], 8)
      const [firstPiece, ...restQueue] = freshBag
      const freshOracles = computeUnifiedOracles(freshGrid)
      const updatedStats: LogicTetrisPersistentStats = {
        ...state.stats,
        preferredMode: targetMode,
      }
      savePersistentStats(updatedStats)
      soundEngine.playStartGame()

      set({
        phase: 'PLAYING',
        mode: targetMode,
        grid: freshGrid,
        activePiece: createSpawnPiece(firstPiece),
        nextQueue: ensureQueueDepth(restQueue, 7),
        holdPieceType: null,
        canHold: true,
        score: 0,
        lines: 0,
        level: 1,
        combo: -1,
        comboGraceDropsLeft: 3,
        maxStreakInSession: 0,
        lastDopamineTier: 'NONE',
        logicCharge: 100,
        phoenixShields: targetMode === 'zen' ? 99 : targetMode === 'arcade' ? 2 : 1,
        secondWindUsedCount: 0,
        secondWindStepsRemaining: 0,
        secondWindStepsTotal: 0,
        topology: freshOracles.topology,
        fruitOracle: freshOracles.fruitOracle,
        tactileTopology: freshOracles.tactileTopology,
        activeSubGameStyle: startingStyle,
        styleShiftProgress: 0,
        isStyleTransitioning: false,
        styleTransitionRemainingMs: 0,
        styleTransitionFrom: null,
        styleTransitionTo: null,
        totalStyleShiftsCount: 0,
        activeFruitPair: createSpawnFruitPair(),
        nextFruitPair: createSpawnFruitPair(),
        lastCascadeWaves: [],
        selectedFruitCell: null,
        fruitCursor: { row: 4, col: 4 },
        lastSwappedCells: null,
        invalidSwapBounceUntil: 0,
        lastPurgedBlocksCount: 0,
        tactileTray: generateTactilePieceTray(freshGrid),
        selectedTraySlot: 0,
        tactileCursorCol: 4,
        tactileCursorRow: 4,
        lastClearedCols: [],
        lastMathResonanceFormula: null,
        lastMiracleToast: null,
        activeBoardAnimation: null,
        lastHardDropTrail: null,
        pendingAutoStyleShift: null,
        activeChallenge: null,
        eliminatedChoiceValues: [],
        lastWrongDiagnosis: null,
        wrongAttemptsOnCurrentChallenge: 0,
        floatingFeedbacks: [
          createFeedbackItem(
            targetMode === 'zen'
              ? '🌱 Modo Zen Iniciado!'
              : targetMode === 'master'
                ? '🔥 Modo Mestre da Balança!'
                : '⚡ Logic Tetris Gênesis!',
            'Use [M] Mudar Peça, [B] Tapar Buraco, [G] Trocar Estilo ou [F] Tela Cheia!',
            'cyan'
          ),
        ],
        lastClearedRows: [],
        lastSealedCoords: [],
        lastEventCounter: state.lastEventCounter + 1,
        gravityAccumulatorMs: 0,
        lockDelayMs: 0,
        lockResetCount: 0,
        postModalInputGuardUntil: Date.now() + 150,
        isSoftDropping: false,
        stats: updatedStats,
      })
    },

    pauseGame: () => {
      if (get().phase === 'PLAYING') {
        set({ phase: 'PAUSED', isSoftDropping: false })
      }
    },

    resumeGame: () => {
      if (get().phase === 'PAUSED') {
        set({
          phase: 'PLAYING',
          postModalInputGuardUntil: Date.now() + 150,
        })
      }
    },

    togglePause: () => {
      const currentPhase = get().phase
      if (currentPhase === 'PLAYING') {
        set({ phase: 'PAUSED', isSoftDropping: false })
      } else if (currentPhase === 'PAUSED') {
        set({ phase: 'PLAYING', postModalInputGuardUntil: Date.now() + 150 })
      }
    },

    returnToHub: () => {
      set({
        phase: 'START_HUB',
        activeChallenge: null,
        isSoftDropping: false,
        isStyleTransitioning: false,
        styleTransitionRemainingMs: 0,
        activeBoardAnimation: null,
        lastHardDropTrail: null,
        pendingAutoStyleShift: null,
      })
    },

    toggleCodex: (open?: boolean) => {
      const current = get().isCodexOpen
      const nextOpen = open !== undefined ? open : !current
      set({ isCodexOpen: nextOpen })
    },

    toggleMute: () => {
      const nextMuted = soundEngine.toggleMuted()
      set({ isMuted: nextMuted })
    },

    setSoftDropping: (active: boolean) => {
      set({ isSoftDropping: active })
    },

    setSubGameStyle: (targetStyle: SubGameStyle, manualLock?: boolean) => {
      performStyleShift(targetStyle, { manualLock })
    },

    cycleSubGameStyle: () => {
      const current = get().activeSubGameStyle
      const nextStyle = getNextCycleStyle(current)
      performStyleShift(nextStyle, { isAutoCycle: false })
    },

    setStyleRotationMode: (rotationMode: StyleRotationMode) => {
      set({ styleRotationMode: rotationMode })
    },

    toggleStyleRotationMode: () => {
      const current = get().styleRotationMode
      const nextMode: StyleRotationMode =
        current === 'SIMULTANEOUS' ? 'LOCKED' : 'SIMULTANEOUS'
      soundEngine.playRotate()
      set({
        styleRotationMode: nextMode,
        floatingFeedbacks: [
          ...get().floatingFeedbacks.slice(-5),
          createFeedbackItem(
            nextMode === 'LOCKED'
              ? `🔒 Estilo Travado: ${getSubGameStyleLabelPt(get().activeSubGameStyle)}`
              : '🌀 Modo Simultâneo Ativado (3 Jogos em 1)!',
            nextMode === 'LOCKED'
              ? 'Troque de estilo quando quiser clicando no HUD ou teclando [G]!'
              : 'O cenário alternará automaticamente a cada 4 conquistas!',
            nextMode === 'LOCKED' ? 'cyan' : 'purple'
          ),
        ],
      })
    },

    selectTactileTraySlot: (slotIndex: 0 | 1 | 2) => {
      const state = get()
      const option = state.tactileTray.find((item) => item.slotIndex === slotIndex)
      if (!option || option.isUsed) return
      soundEngine.playMove()
      set({ selectedTraySlot: slotIndex })
    },

    moveTactileCursor: (dCol: number, dRow: number) => {
      const state = get()
      if (state.phase !== 'PLAYING') return false
      const nextCol = Math.max(
        TACTILE_COL_START,
        Math.min(TACTILE_COL_END, state.tactileCursorCol + dCol)
      )
      const nextRow = Math.max(
        TACTILE_ROW_START,
        Math.min(TACTILE_ROW_END, state.tactileCursorRow + dRow)
      )
      if (nextCol === state.tactileCursorCol && nextRow === state.tactileCursorRow) {
        return false
      }
      soundEngine.playMove()
      set({
        tactileCursorCol: nextCol,
        tactileCursorRow: nextRow,
      })
      return true
    },

    setTactileCursorPosition: (col: number, row: number) => {
      const clampedCol = Math.max(TACTILE_COL_START, Math.min(TACTILE_COL_END, col))
      const clampedRow = Math.max(TACTILE_ROW_START, Math.min(TACTILE_ROW_END, row))
      set({
        tactileCursorCol: clampedCol,
        tactileCursorRow: clampedRow,
      })
    },

    placeSelectedTactilePieceAt: (col?: number, row?: number) => {
      const state = get()
      if (state.phase !== 'PLAYING') return false
      if (Date.now() < state.postModalInputGuardUntil) return false

      const targetCol = col !== undefined ? col : state.tactileCursorCol
      const targetRow = row !== undefined ? row : state.tactileCursorRow

      const res = placeTactileTrayPiece(
        state.grid,
        state.tactileTray,
        state.selectedTraySlot,
        targetCol,
        targetRow
      )

      if (!res.valid) {
        soundEngine.playElasticBounce()
        return false
      }

      soundEngine.playHardDrop()
      const clearedCount = res.clearResult.totalLinesAndCols

      const boardAnimation: BoardAnimationChoreography = {
        id: `anim_tactile_${Date.now()}_${state.lastEventCounter}`,
        kind: 'TACTILE_PLACE_AND_CLEAR',
        style: 'TACTILE_GRID',
        startedAtMs: getTimeNowMs(),
        totalDurationMs: clearedCount > 0 ? 490 : 240,
        placedCells: res.placedCells,
        preClearGrid: res.clearResult.preClearGrid,
        clearedCells: res.clearResult.clearedCells,
        clearedRows: res.clearResult.clearedRows,
        clearedCols: res.clearResult.clearedCols,
        isCrossClear: res.clearResult.isCrossClear,
      }

      const nextLines = state.lines + clearedCount
      const nextLevel = Math.floor(nextLines / 10) + 1

      let nextCombo = state.combo
      let nextGraceDrops = state.comboGraceDropsLeft
      if (clearedCount > 0) {
        nextCombo = Math.max(0, state.combo) + res.clearResult.streakDelta
        nextGraceDrops = 3
      } else if (state.combo > 0) {
        if (state.comboGraceDropsLeft > 0) {
          nextGraceDrops = state.comboGraceDropsLeft - 1
        } else {
          nextCombo = -1
          nextGraceDrops = 3
        }
      } else {
        nextCombo = -1
        nextGraceDrops = 3
      }

      const nextMaxStreak = Math.max(state.maxStreakInSession, Math.max(0, nextCombo))
      const nextDopamineTier = getSequenceDopamineTier(Math.max(0, nextCombo))
      const comboBonus =
        clearedCount > 0 && nextCombo > 0 ? nextCombo * 55 * state.level : 0
      const placementScore =
        res.placedCells.length * 15 +
        res.clearResult.scoreEarned * state.level +
        comboBonus
      const nextScore = state.score + placementScore

      const prevTenBucket = Math.floor(state.lines / 10)
      const nextTenBucket = Math.floor(nextLines / 10)
      const earnedShield =
        state.mode !== 'zen' && nextTenBucket > prevTenBucket && state.phoenixShields < 3
          ? 1
          : 0
      const nextPhoenixShields =
        state.mode === 'zen' ? 99 : Math.min(3, state.phoenixShields + earnedShield)

      const chargeGain = clearedCount > 0 ? clearedCount * 25 : 10
      const nextLogicCharge = Math.min(100, state.logicCharge + chargeGain)

      const oracles = computeUnifiedOracles(res.grid)
      const nextAvailableSlot =
        res.updatedTray.find((item) => !item.isUsed)?.slotIndex ?? 0

      const nextFeedbacks = [...state.floatingFeedbacks].slice(-5)
      let resonanceFormula = state.lastMathResonanceFormula
      if (clearedCount > 0) {
        soundEngine.playSequenceDopamine(
          Math.max(1, nextCombo),
          clearedCount,
          'TACTILE_GRID'
        )
        resonanceFormula = res.clearResult.mathResonanceFormula
        nextFeedbacks.push(
          createFeedbackItem(
            res.clearResult.isCrossClear
              ? '⚔️ CRUZAMENTO DOURADO H×V!'
              : res.clearResult.clearedCols.length > 0
                ? '📐 Coluna Vertical Base-10 Completa!'
                : '📏 Linha Horizontal Base-10 Completa!',
            `${resonanceFormula} · +${placementScore} pts`,
            res.clearResult.isCrossClear ? 'gold' : 'green'
          )
        )
        if (nextCombo >= 12) {
          nextFeedbacks.push(
            createFeedbackItem(
              `👑 SEQUÊNCIA LENDÁRIA ×${nextCombo}! DOPAMINA MÁXIMA!`,
              `Sinfonia Gênesis 12×+ na Grade Livre!`,
              'gold'
            )
          )
        }
      }

      const updatedStats: LogicTetrisPersistentStats = {
        ...state.stats,
        highScore: Math.max(state.stats.highScore, nextScore),
        bestLines: Math.max(state.stats.bestLines, nextLines),
      }
      savePersistentStats(updatedStats)

      const nextShiftProgress =
        clearedCount > 0 ? state.styleShiftProgress + 1 : state.styleShiftProgress

      if (!res.canRemainingTrayFit) {
        triggerSecondWindOrGameOver(
          res.grid,
          nextScore,
          nextLines,
          nextLevel,
          nextCombo,
          nextGraceDrops,
          nextMaxStreak,
          nextDopamineTier,
          nextLogicCharge,
          nextPhoenixShields,
          nextFeedbacks,
          updatedStats,
          {
            tactileTray: res.updatedTray,
            selectedTraySlot: nextAvailableSlot,
            tactileCursorCol: targetCol,
            tactileCursorRow: targetRow,
            lastClearedRows: res.clearResult.clearedRows,
            lastClearedCols: res.clearResult.clearedCols,
            lastMathResonanceFormula: resonanceFormula,
            styleShiftProgress: nextShiftProgress,
            activeBoardAnimation: boardAnimation,
          }
        )
        return true
      }

      const shouldAutoShift =
        clearedCount > 0 &&
        state.styleRotationMode === 'SIMULTANEOUS' &&
        nextShiftProgress >= STYLE_SHIFT_TARGET

      set({
        grid: res.grid,
        tactileTray: res.updatedTray,
        selectedTraySlot: nextAvailableSlot,
        tactileCursorCol: targetCol,
        tactileCursorRow: targetRow,
        score: nextScore,
        lines: nextLines,
        level: nextLevel,
        combo: nextCombo,
        comboGraceDropsLeft: nextGraceDrops,
        maxStreakInSession: nextMaxStreak,
        lastDopamineTier: nextDopamineTier,
        logicCharge: nextLogicCharge,
        phoenixShields: nextPhoenixShields,
        topology: oracles.topology,
        fruitOracle: oracles.fruitOracle,
        tactileTopology: oracles.tactileTopology,
        floatingFeedbacks: nextFeedbacks,
        lastClearedRows: res.clearResult.clearedRows,
        lastClearedCols: res.clearResult.clearedCols,
        lastMathResonanceFormula: resonanceFormula,
        styleShiftProgress: nextShiftProgress,
        activeBoardAnimation: boardAnimation,
        pendingAutoStyleShift: shouldAutoShift
          ? { targetStyle: 'TETRIS_CLASSIC', remainingMs: 520 }
          : state.pendingAutoStyleShift,
        lastEventCounter: state.lastEventCounter + 1,
        stats: updatedStats,
      })

      return true
    },

    setFullscreen: (active: boolean) => {
      set({ isFullscreen: active })
    },

    moveFruitCursor: (dRow: number, dCol: number) => {
      const state = get()
      if (state.phase !== 'PLAYING') return false
      const nextRow = Math.max(
        0,
        Math.min(FRUIT_GRID_ROWS - 1, state.fruitCursor.row + dRow)
      )
      const nextCol = Math.max(
        0,
        Math.min(FRUIT_GRID_COLS - 1, state.fruitCursor.col + dCol)
      )
      if (
        nextRow === state.fruitCursor.row &&
        nextCol === state.fruitCursor.col
      ) {
        return false
      }
      soundEngine.playMove()
      set({
        fruitCursor: { row: nextRow, col: nextCol },
      })
      return true
    },

    swapFruitCells: (from: FruitCoord, to: FruitCoord) => {
      return executeFruitSwapAndAdvance(from, to)
    },

    selectOrSwapFruitAt: (row: number, col: number) => {
      const state = get()
      if (state.phase !== 'PLAYING') return false
      if (Date.now() < state.postModalInputGuardUntil) return false

      const clampedRow = Math.max(0, Math.min(FRUIT_GRID_ROWS - 1, row))
      const clampedCol = Math.max(0, Math.min(FRUIT_GRID_COLS - 1, col))
      const target: FruitCoord = { row: clampedRow, col: clampedCol }

      const currentSel = state.selectedFruitCell
      if (!currentSel) {
        soundEngine.playMove()
        set({
          selectedFruitCell: target,
          fruitCursor: target,
        })
        return true
      }

      if (currentSel.row === target.row && currentSel.col === target.col) {
        soundEngine.playRotate()
        set({
          selectedFruitCell: null,
          fruitCursor: target,
        })
        return true
      }

      const manhattan =
        Math.abs(currentSel.row - target.row) +
        Math.abs(currentSel.col - target.col)

      if (manhattan === 1) {
        return executeFruitSwapAndAdvance(currentSel, target)
      }

      // Clicou em uma fruta não adjacente: transfere a seleção para ela
      soundEngine.playMove()
      set({
        selectedFruitCell: target,
        fruitCursor: target,
      })
      return true
    },

    swapFruitInDirection: (dRow: -1 | 0 | 1, dCol: -1 | 0 | 1) => {
      const state = get()
      if (state.phase !== 'PLAYING') return false
      const origin = state.selectedFruitCell ?? state.fruitCursor
      const targetRow = origin.row + dRow
      const targetCol = origin.col + dCol
      if (
        targetRow < 0 ||
        targetRow >= FRUIT_GRID_ROWS ||
        targetCol < 0 ||
        targetCol >= FRUIT_GRID_COLS
      ) {
        soundEngine.playElasticBounce()
        return false
      }
      return executeFruitSwapAndAdvance(origin, { row: targetRow, col: targetCol })
    },

    moveHorizontal: (dir: -1 | 1) => {
      const state = get()
      if (state.phase !== 'PLAYING') return false

      if (state.activeSubGameStyle === 'TACTILE_GRID') {
        return get().moveTactileCursor(dir, 0)
      }

      if (state.activeSubGameStyle === 'FRUIT_MATCH') {
        if (state.selectedFruitCell) {
          return get().swapFruitInDirection(0, dir)
        }
        return get().moveFruitCursor(0, dir)
      }

      const moved = movePieceIfValid(state.grid, state.activePiece, dir, 0)
      if (!moved) return false

      soundEngine.playMove()
      const isOnFloor = hasCollision(state.grid, moved, 0, 1)
      const canResetLock = state.lockResetCount < MAX_LOCK_RESETS

      set({
        activePiece: moved,
        lockDelayMs: isOnFloor && canResetLock ? 0 : state.lockDelayMs,
        lockResetCount:
          isOnFloor && canResetLock ? state.lockResetCount + 1 : state.lockResetCount,
      })
      return true
    },

    moveUp: () => {
      const state = get()
      if (state.phase !== 'PLAYING') return false
      if (state.activeSubGameStyle === 'TACTILE_GRID') {
        return get().moveTactileCursor(0, -1)
      }
      if (state.activeSubGameStyle === 'FRUIT_MATCH') {
        if (state.selectedFruitCell) {
          return get().swapFruitInDirection(-1, 0)
        }
        return get().moveFruitCursor(-1, 0)
      }
      return get().rotatePiece('CW')
    },

    rotatePiece: (direction: RotationDirection = 'CW') => {
      const state = get()
      if (state.phase !== 'PLAYING') return false

      if (state.activeSubGameStyle === 'TACTILE_GRID') {
        const delta = direction === 'CW' ? 1 : direction === 'CCW' ? 3 : 2
        const nextTray = state.tactileTray.map((item) =>
          item.slotIndex === state.selectedTraySlot
            ? {
                ...item,
                rotation: ((item.rotation + delta) % 4) as RotationState,
              }
            : item
        )
        soundEngine.playRotate()
        set({ tactileTray: nextTray })
        return true
      }

      if (state.activeSubGameStyle === 'FRUIT_MATCH') {
        // Alterna seleção na fruta sob o cursor (ou executa a troca recomendada se já selecionada!)
        if (state.selectedFruitCell) {
          const rightCol = state.selectedFruitCell.col + 1
          if (rightCol < FRUIT_GRID_COLS) {
            return executeFruitSwapAndAdvance(state.selectedFruitCell, {
              row: state.selectedFruitCell.row,
              col: rightCol,
            })
          }
          set({ selectedFruitCell: null })
          return true
        }
        soundEngine.playRotate()
        set({ selectedFruitCell: { ...state.fruitCursor } })
        return true
      }

      const rotated = tryRotateSRS(state.grid, state.activePiece, direction)
      if (!rotated) return false

      soundEngine.playRotate()
      const isOnFloor = hasCollision(state.grid, rotated, 0, 1)
      const canResetLock = state.lockResetCount < MAX_LOCK_RESETS

      set({
        activePiece: rotated,
        lockDelayMs: isOnFloor && canResetLock ? 0 : state.lockDelayMs,
        lockResetCount:
          isOnFloor && canResetLock ? state.lockResetCount + 1 : state.lockResetCount,
      })
      return true
    },

    softDropStep: () => {
      const state = get()
      if (state.phase !== 'PLAYING') return false

      if (state.activeSubGameStyle === 'TACTILE_GRID') {
        return get().moveTactileCursor(0, 1)
      }

      if (state.activeSubGameStyle === 'FRUIT_MATCH') {
        if (state.selectedFruitCell) {
          return get().swapFruitInDirection(1, 0)
        }
        return get().moveFruitCursor(1, 0)
      }

      const moved = movePieceIfValid(state.grid, state.activePiece, 0, 1)
      if (!moved) return false

      soundEngine.playSoftDrop()
      set({
        activePiece: moved,
        score: state.score + 1,
        gravityAccumulatorMs: 0,
      })
      return true
    },

    hardDrop: () => {
      const state = get()
      if (state.phase !== 'PLAYING') return

      // RT-08 Guard: Prevent accidental Space/Enter key bleed-through after closing a math modal
      if (Date.now() < state.postModalInputGuardUntil) {
        return
      }

      if (state.activeSubGameStyle === 'TACTILE_GRID') {
        get().placeSelectedTactilePieceAt(
          state.tactileCursorCol,
          state.tactileCursorRow
        )
        return
      }

      if (state.activeSubGameStyle === 'FRUIT_MATCH') {
        if (!state.selectedFruitCell) {
          soundEngine.playMove()
          set({ selectedFruitCell: { ...state.fruitCursor } })
          return
        }
        // Se já havia uma fruta selecionada e o jogador aperta Espaço/Enter novamente:
        // se o cursor moveu para uma vizinha, troca; senão, desmarca ou usa a melhor troca vizinha!
        const sel = state.selectedFruitCell
        const cur = state.fruitCursor
        if (Math.abs(sel.row - cur.row) + Math.abs(sel.col - cur.col) === 1) {
          executeFruitSwapAndAdvance(sel, cur)
          return
        }
        soundEngine.playRotate()
        set({ selectedFruitCell: null })
        return
      }

      soundEngine.playHardDrop()
      const ghostY = computeGhostY(state.grid, state.activePiece)
      const dropDistance = Math.max(0, ghostY - state.activePiece.y)
      const pieceDef = getPieceDefinition(state.activePiece.type)
      const ghostPiece: ActivePiece = {
        ...state.activePiece,
        y: ghostY,
      }
      const ghostOccupied = getPieceOccupiedCells(ghostPiece).filter(
        (c) => c.row >= 0 && c.row < 20 && c.col >= 0 && c.col < 10
      )
      const hardDropTrail: HardDropTrailSnapshot = {
        id: `hd_${Date.now()}_${state.lastEventCounter}`,
        startedAtMs: getTimeNowMs(),
        durationMs: 320,
        fromY: state.activePiece.y,
        toY: ghostY,
        cells: ghostOccupied,
        color: pieceDef.color,
        glowColor: pieceDef.glowColor,
        symbol: pieceDef.symbol,
      }

      set({
        activePiece: ghostPiece,
        lastHardDropTrail: hardDropTrail,
        score: state.score + dropDistance * 2,
      })

      lockActivePieceAndAdvance()
    },

    holdCurrentPiece: () => {
      const state = get()
      if (state.phase !== 'PLAYING') return false

      if (state.activeSubGameStyle === 'TACTILE_GRID') {
        const availableSlots = state.tactileTray.filter((item) => !item.isUsed)
        if (availableSlots.length <= 1) return false
        const currentIdx = availableSlots.findIndex(
          (item) => item.slotIndex === state.selectedTraySlot
        )
        const nextOption =
          availableSlots[(currentIdx + 1) % availableSlots.length] ?? availableSlots[0]
        soundEngine.playHold()
        set({ selectedTraySlot: nextOption.slotIndex })
        return true
      }

      if (state.activeSubGameStyle === 'FRUIT_MATCH') {
        // Em FRUIT_MATCH 10×10, [C] move o cursor diretamente para a melhor troca disponível do Oráculo!
        const bestSwap = state.fruitOracle.bestSwap
        if (bestSwap) {
          soundEngine.playHold()
          set({
            fruitCursor: { ...bestSwap.from },
            selectedFruitCell: { ...bestSwap.from },
          })
          return true
        }
        return false
      }

      if (!state.canHold) return false

      soundEngine.playHold()
      const currentType = state.activePiece.type
      const existingHold = state.holdPieceType

      if (existingHold === null) {
        const replenished = ensureQueueDepth(state.nextQueue, 8)
        const [nextType, ...restQueue] = replenished
        const spawned = findSafeMorphPlacement(
          state.grid,
          createSpawnPiece(nextType),
          nextType
        )
        set({
          holdPieceType: currentType,
          activePiece: { ...spawned, isMorphed: false, graceFloatMs: 400 },
          nextQueue: ensureQueueDepth(restQueue, 7),
          canHold: false,
          gravityAccumulatorMs: 0,
          lockDelayMs: 0,
          lockResetCount: 0,
        })
        return true
      }

      const swappedSpawn = findSafeMorphPlacement(
        state.grid,
        createSpawnPiece(existingHold),
        existingHold
      )
      set({
        holdPieceType: currentType,
        activePiece: { ...swappedSpawn, isMorphed: false, graceFloatMs: 400 },
        canHold: false,
        gravityAccumulatorMs: 0,
        lockDelayMs: 0,
        lockResetCount: 0,
      })
      return true
    },

    tickLoop: (rawDtMs: number) => {
      const state = get()
      const dtMs = Math.min(Math.max(0, rawDtMs), 100)

      // 1. Handle 900ms Trinity Scene Fold animation countdown
      if (state.styleTransitionRemainingMs > 0) {
        const transitionStepMs = Math.max(0, rawDtMs)
        const nextRem = Math.max(0, state.styleTransitionRemainingMs - transitionStepMs)
        set({
          styleTransitionRemainingMs: nextRem,
          isStyleTransitioning: nextRem > 0,
        })
        return
      }

      // 1b. Handle deferred auto-style shift after 4th combo choreography finishes playing
      if (state.pendingAutoStyleShift) {
        if (state.phase !== 'PLAYING' || state.styleRotationMode !== 'SIMULTANEOUS') {
          set({ pendingAutoStyleShift: null })
        } else {
          const nextRem = state.pendingAutoStyleShift.remainingMs - dtMs
          if (nextRem <= 0) {
            const target = state.pendingAutoStyleShift.targetStyle
            set({ pendingAutoStyleShift: null })
            performStyleShift(target, { isAutoCycle: true })
            return
          }
          set({
            pendingAutoStyleShift: {
              ...state.pendingAutoStyleShift,
              remainingMs: nextRem,
            },
          })
        }
      }

      // 2. Style #2 (`FRUIT_MATCH` 10×10 Swap) & Style #3 (`TACTILE_GRID` 10×10) have zero falling piece timer!
      if (
        state.activeSubGameStyle === 'TACTILE_GRID' ||
        state.activeSubGameStyle === 'FRUIT_MATCH'
      ) {
        return
      }

      // 3. Bullet-time (0.12x) visual drift while in voluntary math modal, never locking! (RT-01)
      if (state.phase === 'MATH_MORPH' || state.phase === 'MATH_FILL_HOLE') {
        const bulletDt = dtMs * 0.12
        const baseInterval = computeBaseGravityIntervalMs(state.level, state.mode)
        const nextAcc = state.gravityAccumulatorMs + bulletDt
        if (nextAcc >= baseInterval) {
          const moved = movePieceIfValid(state.grid, state.activePiece, 0, 1)
          set({
            activePiece: moved ?? state.activePiece,
            gravityAccumulatorMs: 0,
          })
        } else {
          set({ gravityAccumulatorMs: nextAcc })
        }
        return
      }

      if (state.phase !== 'PLAYING') return

      // 4. Style #1 (`TETRIS_CLASSIC`) Falling Tetromino Gravity & Lock Delay
      const currentGrace = state.activePiece.graceFloatMs ?? 0
      const nextGrace = Math.max(0, currentGrace - dtMs)
      const updatedPiece: ActivePiece =
        currentGrace !== nextGrace
          ? { ...state.activePiece, graceFloatMs: nextGrace }
          : state.activePiece

      const isOnFloor = hasCollision(state.grid, updatedPiece, 0, 1)

      if (isOnFloor) {
        const lockDelta = nextGrace > 0 ? dtMs * 0.35 : dtMs
        const nextLockDelay = state.lockDelayMs + lockDelta

        if (nextLockDelay >= LOCK_DELAY_LIMIT_MS) {
          set({ activePiece: updatedPiece, lockDelayMs: 0 })
          lockActivePieceAndAdvance()
          return
        }

        set({
          activePiece: updatedPiece,
          lockDelayMs: nextLockDelay,
          gravityAccumulatorMs: 0,
        })
        return
      }

      const baseInterval = computeBaseGravityIntervalMs(state.level, state.mode)
      const effectiveInterval = state.isSoftDropping
        ? Math.min(55, baseInterval * 0.12)
        : nextGrace > 0
          ? baseInterval / 0.35
          : baseInterval

      const nextAcc = state.gravityAccumulatorMs + dtMs
      if (nextAcc >= effectiveInterval) {
        const moved = movePieceIfValid(state.grid, updatedPiece, 0, 1)
        set({
          activePiece: moved ?? updatedPiece,
          gravityAccumulatorMs: nextAcc - effectiveInterval,
          lockDelayMs: 0,
          score: state.isSoftDropping && moved ? state.score + 1 : state.score,
        })
      } else {
        set({
          activePiece: updatedPiece,
          gravityAccumulatorMs: nextAcc,
        })
      }
    },

    triggerMathMorph: (targetPiece?: PieceType) => {
      const state = get()
      if (state.phase !== 'PLAYING' && state.phase !== 'MATH_MORPH') return

      soundEngine.playOpenIntervention()
      const defaultRecommended =
        state.activeSubGameStyle === 'TACTILE_GRID'
          ? state.tactileTopology.recommendedPiece
          : state.topology.recommendedPiece
      const chosenTarget: PieceType = targetPiece ?? defaultRecommended ?? 'I'

      const challenge = generateMathChallenge({
        mode: state.mode,
        interventionType: 'MORPH',
        level: state.level,
        targetPiece: chosenTarget,
        miracleTier: state.selectedMiracleTier,
        excludeIds: state.recentChallengeIds,
      })

      set({
        phase: 'MATH_MORPH',
        activeChallenge: challenge,
        eliminatedChoiceValues: [],
        lastWrongDiagnosis: null,
        wrongAttemptsOnCurrentChallenge: 0,
        recentChallengeIds: appendRecentChallengeId(state.recentChallengeIds, challenge.id),
        isSoftDropping: false,
      })
    },

    setMorphTargetPiece: (targetPiece: PieceType) => {
      const state = get()
      if (state.phase === 'MATH_MORPH' && state.activeChallenge) {
        soundEngine.playRotate()
        set({
          activeChallenge: {
            ...state.activeChallenge,
            targetPiece,
          },
        })
      }
    },

    triggerMathFillHole: (explicitTier?: MiraclePowerTier) => {
      const state = get()
      if (state.phase !== 'PLAYING' && state.phase !== 'MATH_FILL_HOLE') return

      soundEngine.playOpenIntervention()
      const activeTier: MiraclePowerTier = explicitTier ?? state.selectedMiracleTier
      const topCavity = state.topology.buriedCavities[0]
      const missingInRow =
        state.activeSubGameStyle === 'TACTILE_GRID'
          ? state.tactileTopology.bestAxisToSeal?.missing
          : topCavity?.missingInRow

      const challenge = generateMathChallenge({
        mode: state.mode,
        interventionType: 'FILL_HOLE',
        level: state.level,
        missingInRow,
        miracleTier: activeTier,
        excludeIds: state.recentChallengeIds,
      })

      set({
        phase: 'MATH_FILL_HOLE',
        selectedMiracleTier: activeTier,
        activeChallenge: challenge,
        eliminatedChoiceValues: [],
        lastWrongDiagnosis: null,
        wrongAttemptsOnCurrentChallenge: 0,
        recentChallengeIds: appendRecentChallengeId(state.recentChallengeIds, challenge.id),
        isSoftDropping: false,
      })
    },

    cancelMathIntervention: () => {
      const state = get()
      if (state.phase === 'MATH_MORPH' || state.phase === 'MATH_FILL_HOLE') {
        soundEngine.playCancelIntervention()
        set({
          phase: 'PLAYING',
          activeChallenge: null,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          lockDelayMs: 0,
          activePiece: {
            ...state.activePiece,
            graceFloatMs: Math.max(state.activePiece.graceFloatMs ?? 0, 600),
          },
          activeFruitPair: {
            ...state.activeFruitPair,
            graceFloatMs: Math.max(state.activeFruitPair.graceFloatMs ?? 0, 600),
          },
          postModalInputGuardUntil: Date.now() + POST_MODAL_INPUT_GUARD_MS,
        })
      }
    },

    forfeitSecondWind: () => {
      const state = get()
      if (state.phase === 'MATH_SECOND_WIND') {
        soundEngine.playGameOver()
        set({
          phase: 'GAME_OVER',
          activeChallenge: null,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          secondWindStepsRemaining: 0,
          isSoftDropping: false,
        })
      }
    },

    submitMathChoice: (choiceIndex: number) => {
      const state = get()
      const challenge = state.activeChallenge
      if (!challenge) return 'IGNORED'

      const choice = challenge.choices[choiceIndex]
      if (!choice) return 'IGNORED'

      if (state.eliminatedChoiceValues.includes(choice.value)) {
        return 'IGNORED'
      }

      // =====================================================================
      // CASE A: ELASTIC FEEDBACK ON DISTRACTOR (RT-09)
      // =====================================================================
      if (!choice.isCorrect) {
        soundEngine.playElasticBounce()
        const diagnosis =
          choice.trapDiagnosis ??
          'Quase lá! Observe a Luz Guia acima para enxergar o atalho da dezena.'
        const nextCharge = Math.min(100, state.logicCharge + 15)

        set({
          eliminatedChoiceValues: [...state.eliminatedChoiceValues, choice.value],
          lastWrongDiagnosis: diagnosis,
          wrongAttemptsOnCurrentChallenge: state.wrongAttemptsOnCurrentChallenge + 1,
          logicCharge: nextCharge,
          floatingFeedbacks: [
            ...state.floatingFeedbacks.slice(-5),
            createFeedbackItem(
              '💡 Ajuste na Balança!',
              '+15% Carga Lógica pelo esforço — tente a opção certa!',
              'gold'
            ),
          ],
        })
        return 'ELASTIC_BOUNCE'
      }

      // =====================================================================
      // CASE B: CORRECT ANSWER! Execute the polymorphic math miracle!
      // =====================================================================
      const wasFirstTry = state.wrongAttemptsOnCurrentChallenge === 0
      const guardUntil = Date.now() + POST_MODAL_INPUT_GUARD_MS
      const nextCombo = Math.max(0, state.combo) + 1
      const nextGraceDrops = 3
      const nextMaxStreak = Math.max(state.maxStreakInSession, nextCombo)
      const nextDopamineTier = getSequenceDopamineTier(nextCombo)

      soundEngine.playSequenceDopamine(nextCombo, 2, state.activeSubGameStyle)

      const buildFeedbackListWithLegend = (
        baseList: FloatingFeedback[],
        primaryItem: FloatingFeedback,
        effectiveCombo: number = nextCombo
      ): FloatingFeedback[] => {
        const list = [...baseList.slice(-5), primaryItem]
        if (effectiveCombo >= 12) {
          list.push(
            createFeedbackItem(
              `👑 SEQUÊNCIA LENDÁRIA ×${effectiveCombo}! DOPAMINA MÁXIMA!`,
              'Sinfonia Gênesis 12×+ em chamas!',
              'gold'
            )
          )
        }
        return list
      }

      const miracleSpec = getMiracleTierSpec(
        challenge.miracleTier ?? state.selectedMiracleTier
      )
      const nextPhoenixShields = miracleSpec.grantsPhoenixShield
        ? state.mode === 'zen'
          ? 99
          : Math.min(5, state.phoenixShields + 1)
        : state.phoenixShields
      const shieldBonusSuffix = miracleSpec.grantsPhoenixShield
        ? ' + 🛡️ +1 Escudo Fênix'
        : ''

      // ---------------------------------------------------------------------
      // 1. Miracle 1: MATH_MORPH ([M] — Polymorphic across the 3 Styles!)
      // ---------------------------------------------------------------------
      if (state.phase === 'MATH_MORPH') {
        soundEngine.playMorphSuccess()
        const baseMorphPts = Math.max(wasFirstTry ? 250 : 150, miracleSpec.bonusScore)
        const bonusPoints = baseMorphPts * state.level
        const nextScore = state.score + bonusPoints

        const updatedStats: LogicTetrisPersistentStats = {
          ...state.stats,
          highScore: Math.max(state.stats.highScore, nextScore),
          totalMathSolved: state.stats.totalMathSolved + 1,
          totalMorphs: state.stats.totalMorphs + 1,
        }
        savePersistentStats(updatedStats)

        if (state.activeSubGameStyle === 'FRUIT_MATCH') {
          const wildcardPair = morphFruitPairToWildcardOrTarget(
            state.activeFruitPair,
            'STAR_PRISM'
          )
          const starCount = Math.min(6, 1 + miracleSpec.tier)
          const starredGrid = forgeWildcardStarsOnBoard(
            state.grid,
            starCount,
            state.fruitCursor
          )
          const oracles = computeUnifiedOracles(starredGrid)
          const logEntry: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary:
              `${starCount} Estrelas Coringa Douradas (✦) materializadas na Arena 10×10 (${miracleSpec.titlePt}${shieldBonusSuffix})!`,
          }
          set({
            phase: 'PLAYING',
            grid: starredGrid,
            activeFruitPair: wildcardPair,
            topology: oracles.topology,
            fruitOracle: oracles.fruitOracle,
            tactileTopology: oracles.tactileTopology,
            score: nextScore,
            phoenixShields: nextPhoenixShields,
            combo: nextCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: nextMaxStreak,
            lastDopamineTier: nextDopamineTier,
            logicCharge: Math.min(100, state.logicCharge + 20 * miracleSpec.tier),
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            lastMiracleToast: `⭐ ${starCount} Estrelas Coringa (✦) na Arena${shieldBonusSuffix}!`,
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `⭐ ${starCount} Estrelas Coringa (✦) na Arena!`,
                `${miracleSpec.titlePt} · +${bonusPoints} pts${shieldBonusSuffix}`,
                'gold'
              )
            ),
            lastEventCounter: state.lastEventCounter + 1,
            gravityAccumulatorMs: 0,
            lockDelayMs: 0,
            lockResetCount: 0,
            postModalInputGuardUntil: guardUntil,
            stats: updatedStats,
          })
          return 'CORRECT'
        }

        if (state.activeSubGameStyle === 'TACTILE_GRID') {
          const targetType: PieceType =
            challenge.targetPiece ?? state.tactileTopology.recommendedPiece ?? 'DOT_1X1'
          const updatedTray = morphTactileTrayPiece(
            state.tactileTray,
            state.selectedTraySlot,
            targetType,
            0
          )
          const def = getPieceDefinition(targetType)
          const logEntry: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary: `Bandeja Tátil moldada para ${def.namePt} (${def.areaFormula}) · ${miracleSpec.titlePt}${shieldBonusSuffix}`,
          }
          set({
            phase: 'PLAYING',
            tactileTray: updatedTray,
            score: nextScore,
            phoenixShields: nextPhoenixShields,
            combo: nextCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: nextMaxStreak,
            lastDopamineTier: nextDopamineTier,
            logicCharge: Math.min(100, state.logicCharge + 20 * miracleSpec.tier),
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            lastMiracleToast: `✨ Bandeja Moldada: ${def.namePt}${shieldBonusSuffix}!`,
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `✨ Bandeja Moldada: ${def.namePt}!`,
                `Área ${def.areaFormula} · +${bonusPoints} pts${shieldBonusSuffix}`,
                'cyan'
              )
            ),
            lastEventCounter: state.lastEventCounter + 1,
            postModalInputGuardUntil: guardUntil,
            stats: updatedStats,
          })
          return 'CORRECT'
        }

        // Default: TETRIS_CLASSIC
        const targetType: PieceType =
          challenge.targetPiece ?? state.topology.recommendedPiece ?? 'I'
        const morphedPiece = findSafeMorphPlacement(
          state.grid,
          state.activePiece,
          targetType
        )
        const def = getPieceDefinition(morphedPiece.type)
        const logEntry: SolvedChallengeLog = {
          challenge,
          solvedAt: Date.now(),
          wasFirstTry,
          effectSummary: `Peça transmutada para ${def.namePt} (${def.areaFormula}) · ${miracleSpec.titlePt}${shieldBonusSuffix}`,
        }

        set({
          phase: 'PLAYING',
          activePiece: {
            ...morphedPiece,
            isMorphed: true,
            graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
          },
          score: nextScore,
          phoenixShields: nextPhoenixShields,
          combo: nextCombo,
          comboGraceDropsLeft: nextGraceDrops,
          maxStreakInSession: nextMaxStreak,
          lastDopamineTier: nextDopamineTier,
          logicCharge: Math.min(100, state.logicCharge + 20 * miracleSpec.tier),
          activeChallenge: null,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
          lastMiracleToast: `✨ Alquimia: ${def.namePt}${shieldBonusSuffix}!`,
          floatingFeedbacks: buildFeedbackListWithLegend(
            state.floatingFeedbacks,
            createFeedbackItem(
              `✨ Alquimia: ${def.namePt}!`,
              `Área ${def.areaFormula} · +${bonusPoints} pts${shieldBonusSuffix}`,
              'cyan'
            )
          ),
          lastEventCounter: state.lastEventCounter + 1,
          gravityAccumulatorMs: 0,
          lockDelayMs: 0,
          lockResetCount: 0,
          postModalInputGuardUntil: guardUntil,
          stats: updatedStats,
        })
        return 'CORRECT'
      }

      // ---------------------------------------------------------------------
      // 2. Miracle 2: MATH_FILL_HOLE ([B] — Polymorphic across the 3 Styles!)
      // ---------------------------------------------------------------------
      if (state.phase === 'MATH_FILL_HOLE') {
        soundEngine.playSealHoleSuccess()
        const maxToSeal =
          miracleSpec.tier === 1 && state.mode !== 'zen' && !wasFirstTry
            ? 2
            : miracleSpec.maxHolesToSeal

        if (state.activeSubGameStyle === 'FRUIT_MATCH') {
          const magResult = magnetizeSingleFruitColor(
            state.grid,
            state.fruitOracle.mostFragmentedFruit
          )
          const finalFruitGrid =
            miracleSpec.tier >= 2
              ? forgeWildcardStarsOnBoard(
                  magResult.grid,
                  miracleSpec.tier,
                  state.fruitCursor
                )
              : magResult.grid
          const effectiveCombo = Math.max(
            nextCombo,
            Math.max(0, state.combo) + Math.max(1, magResult.streakDelta)
          )
          const effectiveMaxStreak = Math.max(state.maxStreakInSession, effectiveCombo)
          const effectiveTier = getSequenceDopamineTier(effectiveCombo)
          const magScore =
            Math.max(miracleSpec.bonusScore, magResult.totalScoreEarned + miracleSpec.bonusScore) *
            state.level
          const nextScore = state.score + magScore
          const nextLines = state.lines + Math.max(1, magResult.totalWaves)
          const nextLevel = Math.floor(nextLines / 10) + 1
          const oracles = computeUnifiedOracles(finalFruitGrid)
          const formula =
            magResult.waves[magResult.waves.length - 1]?.mathResonanceFormula ??
            'Imã Magnético de Frutas!'

          const magChoreo =
            magResult.waves.length > 0
              ? buildFruitCascadeChoreography(magResult.waves, {
                  kind: 'FRUIT_MAGNET_CASCADE',
                })
              : null
          if (magChoreo) {
            soundEngine.playCascadeWaveTimeline(
              magChoreo.waveDelaySeconds,
              effectiveCombo,
              'FRUIT_MATCH'
            )
          }

          const logEntry: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary: `Imã de Frutas (${miracleSpec.titlePt}) colapsou ${magResult.totalPoppedBlocks} blocos (${formula})${shieldBonusSuffix}`,
          }

          const updatedStats: LogicTetrisPersistentStats = {
            ...state.stats,
            highScore: Math.max(state.stats.highScore, nextScore),
            bestLines: Math.max(state.stats.bestLines, nextLines),
            totalMathSolved: state.stats.totalMathSolved + 1,
            totalHolesSealed:
              state.stats.totalHolesSealed + Math.max(1, magResult.totalPoppedBlocks),
          }
          savePersistentStats(updatedStats)

          set({
            phase: 'PLAYING',
            grid: finalFruitGrid,
            score: nextScore,
            phoenixShields: nextPhoenixShields,
            lines: nextLines,
            level: nextLevel,
            combo: effectiveCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: effectiveMaxStreak,
            lastDopamineTier: effectiveTier,
            topology: oracles.topology,
            fruitOracle: oracles.fruitOracle,
            tactileTopology: oracles.tactileTopology,
            lastCascadeWaves: magResult.waves,
            lastMathResonanceFormula: formula,
            lastMiracleToast: `🧲 Imã (${miracleSpec.titlePt}): ${formula}${shieldBonusSuffix}`,
            activeBoardAnimation: magChoreo ? magChoreo.choreography : state.activeBoardAnimation,
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `🧲 Imã de Frutas! (${magResult.totalPoppedBlocks} Blocos!)`,
                `${formula} · +${magScore} pts${shieldBonusSuffix}`,
                'gold'
              ),
              effectiveCombo
            ),
            lastEventCounter: state.lastEventCounter + 1,
            gravityAccumulatorMs: 0,
            lockDelayMs: 0,
            lockResetCount: 0,
            postModalInputGuardUntil: guardUntil,
            stats: updatedStats,
          })
          return 'CORRECT'
        }

        if (state.activeSubGameStyle === 'TACTILE_GRID') {
          const sealRes = sealTactileRowOrColCavities(state.grid, undefined, maxToSeal)
          const sealedCount = sealRes.sealedCoordinates.length
          const clearedCount = sealRes.clearResult.totalLinesAndCols
          const tactileSealAnim: BoardAnimationChoreography = {
            id: `anim_tactile_seal_${Date.now()}_${state.lastEventCounter}`,
            kind: 'TACTILE_PLACE_AND_CLEAR',
            style: 'TACTILE_GRID',
            startedAtMs: getTimeNowMs(),
            totalDurationMs: clearedCount > 0 ? 490 : 250,
            placedCells: sealRes.sealedCoordinates,
            preClearGrid: sealRes.clearResult.preClearGrid,
            clearedCells: sealRes.clearResult.clearedCells,
            clearedRows: sealRes.clearResult.clearedRows,
            clearedCols: sealRes.clearResult.clearedCols,
            isCrossClear: sealRes.clearResult.isCrossClear,
          }

          const effectiveCombo = Math.max(
            nextCombo,
            Math.max(0, state.combo) + Math.max(1, sealRes.clearResult.streakDelta)
          )
          const effectiveMaxStreak = Math.max(state.maxStreakInSession, effectiveCombo)
          const effectiveTier = getSequenceDopamineTier(effectiveCombo)
          const nextLines = state.lines + clearedCount
          const nextLevel = Math.floor(nextLines / 10) + 1
          const sealBonus =
            (sealedCount * 150 + sealRes.clearResult.scoreEarned + miracleSpec.bonusScore) *
            state.level
          const nextScore = state.score + sealBonus
          const oracles = computeUnifiedOracles(sealRes.grid)
          const axisLabel = sealRes.axisSealed === 'COL' ? 'Coluna Vertical' : 'Linha Horizontal'
          const formula =
            sealRes.clearResult.mathResonanceFormula ||
            `${sealedCount} Cristal(is) Dourado(s) na ${axisLabel}!`

          const logEntry: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary: `Selou ${sealedCount} buraco(s) (${miracleSpec.titlePt}) na ${axisLabel} (${formula})${shieldBonusSuffix}`,
          }

          const updatedStats: LogicTetrisPersistentStats = {
            ...state.stats,
            highScore: Math.max(state.stats.highScore, nextScore),
            bestLines: Math.max(state.stats.bestLines, nextLines),
            totalMathSolved: state.stats.totalMathSolved + 1,
            totalHolesSealed: state.stats.totalHolesSealed + sealedCount,
          }
          savePersistentStats(updatedStats)

          set({
            phase: 'PLAYING',
            grid: sealRes.grid,
            score: nextScore,
            phoenixShields: nextPhoenixShields,
            lines: nextLines,
            level: nextLevel,
            combo: effectiveCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: effectiveMaxStreak,
            lastDopamineTier: effectiveTier,
            topology: oracles.topology,
            fruitOracle: oracles.fruitOracle,
            tactileTopology: oracles.tactileTopology,
            lastClearedRows: sealRes.clearResult.clearedRows,
            lastClearedCols: sealRes.clearResult.clearedCols,
            lastSealedCoords: sealRes.sealedCoordinates,
            lastMathResonanceFormula: formula,
            lastMiracleToast: `⚖️ ${sealedCount} Casas Seladas (${miracleSpec.titlePt})${shieldBonusSuffix}!`,
            activeBoardAnimation: tactileSealAnim,
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `⚖️ ${sealedCount} Casas Seladas (${miracleSpec.titlePt})!`,
                `${formula} · +${sealBonus} pts${shieldBonusSuffix}`,
                'gold'
              ),
              effectiveCombo
            ),
            lastEventCounter: state.lastEventCounter + 1,
            postModalInputGuardUntil: guardUntil,
            stats: updatedStats,
          })
          return 'CORRECT'
        }

        // Default: TETRIS_CLASSIC
        const cavities = state.topology.buriedCavities

        if (cavities.length > 0) {
          const sealResult = sealBuriedCavities(state.grid, cavities, maxToSeal)
          const sealedCount = sealResult.sealedCoordinates.length
          const cleared = sealResult.lineClearResult.clearedCount
          if (cleared > 0) {
            soundEngine.playLineClear(cleared, nextCombo)
          }
          const classicSealAnim: BoardAnimationChoreography =
            cleared > 0
              ? {
                  id: `anim_classic_seal_${Date.now()}_${state.lastEventCounter}`,
                  kind: 'CLASSIC_LINE_CLEAR',
                  style: 'TETRIS_CLASSIC',
                  startedAtMs: getTimeNowMs(),
                  totalDurationMs: 450,
                  laserDurationMs: 205,
                  gravityCollapseDurationMs: 245,
                  preClearGrid: sealResult.lineClearResult.preClearGrid,
                  clearedCells: sealResult.lineClearResult.clearedCells,
                  clearedRows: sealResult.lineClearResult.clearedRows,
                  rowDropDistances: sealResult.lineClearResult.rowDropDistances,
                  lockedCells: sealResult.sealedCoordinates,
                }
              : {
                  id: `anim_classic_seal_lock_${Date.now()}_${state.lastEventCounter}`,
                  kind: 'CLASSIC_PIECE_LOCK',
                  style: 'TETRIS_CLASSIC',
                  startedAtMs: getTimeNowMs(),
                  totalDurationMs: 220,
                  lockedCells: sealResult.sealedCoordinates,
                }

          const nextLines = state.lines + cleared
          const nextLevel = Math.floor(nextLines / 10) + 1
          const clearScore = computeLineClearBaseScore(cleared) * state.level
          const sealBonus =
            (sealedCount * 150 + miracleSpec.bonusScore) * state.level + clearScore
          const nextScore = state.score + sealBonus

          const oracles = computeUnifiedOracles(sealResult.grid)
          let safeActivePiece: ActivePiece = {
            ...state.activePiece,
            graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
          }
          if (hasCollision(sealResult.grid, safeActivePiece, 0, 0)) {
            safeActivePiece = findSafeMorphPlacement(
              sealResult.grid,
              safeActivePiece,
              safeActivePiece.type
            )
          }

          const logEntry: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary: `Selou ${sealedCount} buraco(s) (${miracleSpec.titlePt})${cleared > 0 ? ` e limpou ${cleared} linha(s)!` : ''}${shieldBonusSuffix}`,
          }

          const updatedStats: LogicTetrisPersistentStats = {
            ...state.stats,
            highScore: Math.max(state.stats.highScore, nextScore),
            bestLines: Math.max(state.stats.bestLines, nextLines),
            totalMathSolved: state.stats.totalMathSolved + 1,
            totalHolesSealed: state.stats.totalHolesSealed + sealedCount,
          }
          savePersistentStats(updatedStats)

          set({
            phase: 'PLAYING',
            grid: sealResult.grid,
            activePiece: safeActivePiece,
            score: nextScore,
            phoenixShields: nextPhoenixShields,
            lines: nextLines,
            level: nextLevel,
            combo: nextCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: nextMaxStreak,
            lastDopamineTier: nextDopamineTier,
            topology: oracles.topology,
            fruitOracle: oracles.fruitOracle,
            tactileTopology: oracles.tactileTopology,
            activeBoardAnimation: classicSealAnim,
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            lastMiracleToast: `⚖️ ${sealedCount} Buraco(s) Selado(s) (${miracleSpec.titlePt})${shieldBonusSuffix}!`,
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `⚖️ ${sealedCount} Buraco(s) Selado(s) (${miracleSpec.titlePt})!`,
                cleared > 0
                  ? `Cascata Base-10: +${cleared} linha(s) limpa(s)! (+${sealBonus} pts${shieldBonusSuffix})`
                  : `Cristais da Balança materializados! (+${sealBonus} pts${shieldBonusSuffix})`,
                'gold'
              )
            ),
            lastClearedRows: sealResult.lineClearResult.clearedRows,
            lastSealedCoords: sealResult.sealedCoordinates,
            lastEventCounter: state.lastEventCounter + 1,
            gravityAccumulatorMs: 0,
            lockDelayMs: 0,
            lockResetCount: 0,
            postModalInputGuardUntil: guardUntil,
            stats: updatedStats,
          })
          return 'CORRECT'
        }

        // If 0 buried holes in TETRIS_CLASSIC, grant Golden Monomino (1x1) + Miracle Bonus
        const goldenDot = findSafeMorphPlacement(
          state.grid,
          state.activePiece,
          'DOT_1X1'
        )
        const nextScore = state.score + (200 + miracleSpec.bonusScore) * state.level
        const logEntry: SolvedChallengeLog = {
          challenge,
          solvedAt: Date.now(),
          wasFirstTry,
          effectSummary: `Tabuleiro sem buracos soterrados → Monominó Dourado (1×1) + ${miracleSpec.titlePt}${shieldBonusSuffix} concedido!`,
        }
        const updatedStats: LogicTetrisPersistentStats = {
          ...state.stats,
          highScore: Math.max(state.stats.highScore, nextScore),
          totalMathSolved: state.stats.totalMathSolved + 1,
          totalMorphs: state.stats.totalMorphs + 1,
        }
        savePersistentStats(updatedStats)

        set({
          phase: 'PLAYING',
          activePiece: goldenDot,
          score: nextScore,
          phoenixShields: nextPhoenixShields,
          combo: nextCombo,
          comboGraceDropsLeft: nextGraceDrops,
          maxStreakInSession: nextMaxStreak,
          lastDopamineTier: nextDopamineTier,
          activeChallenge: null,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
          lastMiracleToast: '★ Monominó Dourado (1×1) Concedido!',
          floatingFeedbacks: buildFeedbackListWithLegend(
            state.floatingFeedbacks,
            createFeedbackItem(
              '★ Monominó Dourado (1×1) Concedido!',
              'Sem buracos soterrados: peça 1×1 pronta para encaixe cirúrgico!',
              'gold'
            )
          ),
          lastEventCounter: state.lastEventCounter + 1,
          gravityAccumulatorMs: 0,
          lockDelayMs: 0,
          lockResetCount: 0,
          postModalInputGuardUntil: guardUntil,
          stats: updatedStats,
        })
        return 'CORRECT'
      }

      // ---------------------------------------------------------------------
      // 3. Miracle 3: MATH_SECOND_WIND (Phoenix Protocol 142857 — Polymorphic!)
      // ---------------------------------------------------------------------
      if (state.phase === 'MATH_SECOND_WIND') {
        const remainingAfterThis = state.secondWindStepsRemaining - 1

        if (remainingAfterThis > 0) {
          soundEngine.playMorphSuccess()
          const nextChallenge = generateMathChallenge({
            mode: state.mode,
            interventionType: 'SECOND_WIND',
            level: state.level,
            excludeIds: [...state.recentChallengeIds, challenge.id],
          })

          const stepLog: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary: `Etapa Fênix concluída (faltam ${remainingAfterThis})`,
          }

          const updatedStats: LogicTetrisPersistentStats = {
            ...state.stats,
            totalMathSolved: state.stats.totalMathSolved + 1,
          }
          savePersistentStats(updatedStats)

          set({
            activeChallenge: nextChallenge,
            secondWindStepsRemaining: remainingAfterThis,
            combo: nextCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: nextMaxStreak,
            lastDopamineTier: nextDopamineTier,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            recentChallengeIds: appendRecentChallengeId(state.recentChallengeIds, nextChallenge.id),
            solvedHistory: [stepLog, ...state.solvedHistory].slice(0, 30),
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `🔥 Fênix: Falta(m) ${remainingAfterThis} conta(s)!`,
                'Continue para purificar a arena!',
                'gold'
              )
            ),
            stats: updatedStats,
          })
          return 'CORRECT'
        }

        // Final step of Second Wind completed! Purify according to active style!
        soundEngine.playPhoenixSecondWind()
        const phoenixBonus = 500 * state.level
        const nextScore = state.score + phoenixBonus
        const nextShields =
          state.mode === 'zen' ? 99 : Math.max(0, state.phoenixShields - 1)

        const updatedStats: LogicTetrisPersistentStats = {
          ...state.stats,
          highScore: Math.max(state.stats.highScore, nextScore),
          totalMathSolved: state.stats.totalMathSolved + 1,
          totalSecondWinds: state.stats.totalSecondWinds + 1,
        }
        savePersistentStats(updatedStats)

        if (state.activeSubGameStyle === 'FRUIT_MATCH') {
          const purFruit = purifyTopTwoFruitColors(state.grid)
          const oracles = computeUnifiedOracles(purFruit.grid)
          const formula =
            purFruit.waves[0]?.mathResonanceFormula ?? 'Fênix Purificadora de Frutas!'
          const purChoreo =
            purFruit.waves.length > 0
              ? buildFruitCascadeChoreography(purFruit.waves, {
                  kind: 'FRUIT_MAGNET_CASCADE',
                })
              : null
          if (purChoreo) {
            soundEngine.playCascadeWaveTimeline(
              purChoreo.waveDelaySeconds,
              nextCombo,
              'FRUIT_MATCH'
            )
          }
          const logEntry: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary: `Protocolo Fênix (Frutas): Colapsou ${purFruit.totalPoppedBlocks} blocos (${formula})!`,
          }
          set({
            phase: 'PLAYING',
            grid: purFruit.grid,
            activeFruitPair: {
              ...createSpawnFruitPair(oracles.fruitOracle.recommendedFruit),
              graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
            },
            score: nextScore,
            combo: nextCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: nextMaxStreak,
            lastDopamineTier: nextDopamineTier,
            phoenixShields: nextShields,
            secondWindUsedCount: state.secondWindUsedCount + 1,
            secondWindStepsRemaining: 0,
            secondWindStepsTotal: 0,
            topology: oracles.topology,
            fruitOracle: oracles.fruitOracle,
            tactileTopology: oracles.tactileTopology,
            lastCascadeWaves: purFruit.waves,
            lastMathResonanceFormula: formula,
            lastMiracleToast: '🔥 FÊNIX 142857! Cachos Purificados!',
            activeBoardAnimation: purChoreo ? purChoreo.choreography : state.activeBoardAnimation,
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                '🔥 FÊNIX 142857! VIDA SALVA!',
                `${formula} · +${phoenixBonus} pts!`,
                'gold'
              )
            ),
            lastEventCounter: state.lastEventCounter + 1,
            gravityAccumulatorMs: 0,
            lockDelayMs: 0,
            lockResetCount: 0,
            postModalInputGuardUntil: guardUntil,
            stats: updatedStats,
          })
          return 'CORRECT'
        }

        if (state.activeSubGameStyle === 'TACTILE_GRID') {
          const purTac = purifyTactileGridSecondWind(state.grid, state.tactileTray)
          const oracles = computeUnifiedOracles(purTac.grid)
          const nextSlot =
            purTac.refreshedTray.find((item) => !item.isUsed)?.slotIndex ?? 0
          const logEntry: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary: `Protocolo Fênix (Grade Livre): Liberou ${purTac.clearedCount} blocos na Arena 10×10!`,
          }
          set({
            phase: 'PLAYING',
            grid: purTac.grid,
            tactileTray: purTac.refreshedTray,
            selectedTraySlot: nextSlot,
            score: nextScore,
            combo: nextCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: nextMaxStreak,
            lastDopamineTier: nextDopamineTier,
            phoenixShields: nextShields,
            secondWindUsedCount: state.secondWindUsedCount + 1,
            secondWindStepsRemaining: 0,
            secondWindStepsTotal: 0,
            topology: oracles.topology,
            fruitOracle: oracles.fruitOracle,
            tactileTopology: oracles.tactileTopology,
            lastMiracleToast: '🔥 FÊNIX 142857! Arena 10×10 Purificada!',
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                '🔥 FÊNIX 142857! VIDA SALVA!',
                `Arena 10×10 purificada (${purTac.clearedCount} blocos limpos) · +${phoenixBonus} pts!`,
                'gold'
              )
            ),
            lastEventCounter: state.lastEventCounter + 1,
            postModalInputGuardUntil: guardUntil,
            stats: updatedStats,
          })
          return 'CORRECT'
        }

        // Default: TETRIS_CLASSIC
        const rowsToPurify = state.mode === 'zen' ? 6 : 4
        const purifiedGrid = purifyBottomRows(state.grid, rowsToPurify)
        const oracles = computeUnifiedOracles(purifiedGrid)
        const safeSpawn = findSafeMorphPlacement(
          purifiedGrid,
          createSpawnPiece(state.activePiece.type),
          state.activePiece.type
        )

        const logEntry: SolvedChallengeLog = {
          challenge,
          solvedAt: Date.now(),
          wasFirstTry,
          effectSummary: `Protocolo Fênix 142857: Purificou ${rowsToPurify} linhas e salvou a partida!`,
        }

        set({
          phase: 'PLAYING',
          grid: purifiedGrid,
          activePiece: {
            ...safeSpawn,
            isMorphed: false,
            graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
          },
          score: nextScore,
          combo: nextCombo,
          comboGraceDropsLeft: nextGraceDrops,
          maxStreakInSession: nextMaxStreak,
          lastDopamineTier: nextDopamineTier,
          phoenixShields: nextShields,
          secondWindUsedCount: state.secondWindUsedCount + 1,
          secondWindStepsRemaining: 0,
          secondWindStepsTotal: 0,
          topology: oracles.topology,
          fruitOracle: oracles.fruitOracle,
          tactileTopology: oracles.tactileTopology,
          lastMiracleToast: '🔥 FÊNIX 142857! VIDA SALVA!',
          activeChallenge: null,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
          floatingFeedbacks: buildFeedbackListWithLegend(
            state.floatingFeedbacks,
            createFeedbackItem(
              '🔥 FÊNIX 142857! VIDA SALVA!',
              `Base purificada em ${rowsToPurify} andares · +${phoenixBonus} pts!`,
              'gold'
            )
          ),
          lastEventCounter: state.lastEventCounter + 1,
          gravityAccumulatorMs: 0,
          lockDelayMs: 0,
          lockResetCount: 0,
          postModalInputGuardUntil: guardUntil,
          stats: updatedStats,
        })
        return 'CORRECT'
      }

      return 'IGNORED'
    },

    pushFloatingFeedback: (
      text: string,
      subtext?: string,
      color: FloatingFeedback['color'] = 'cyan'
    ) => {
      const state = get()
      set({
        floatingFeedbacks: [
          ...state.floatingFeedbacks.slice(-5),
          createFeedbackItem(text, subtext, color),
        ],
      })
    },

    pruneFloatingFeedbacks: () => {
      const cutoff = Date.now() - 2600
      const current = get().floatingFeedbacks
      const filtered = current.filter((item) => item.createdAt >= cutoff)
      if (filtered.length !== current.length) {
        set({ floatingFeedbacks: filtered })
      }
    },
  }
})
