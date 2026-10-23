import { create } from 'zustand'
import {
  ActivePiece,
  BoardTopologyReport,
  CascadeWave,
  DopamineTier,
  FloatingFeedback,
  FruitCascadeOracleReport,
  FruitPairPiece,
  GameMode,
  GamePhase,
  GridMatrix,
  LogicTetrisPersistentStats,
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
} from '../engine/tetrominoes'
import {
  computeFruitPairGhostY,
  createSpawnFruitPair,
  decorateGridWithFruits,
  hasFruitPairCollision,
  lockFruitPairAndResolve,
  magnetizeSingleFruitColor,
  morphFruitPairToWildcardOrTarget,
   moveFruitPairIfValid,
  purifyTopTwoFruitColors,
  rotateFruitPairSRS,
  scanFruitCascadeOracle,
} from '../engine/fruitMatchEngine'
import {
  generateTactilePieceTray,
  morphTactileTrayPiece,
  normalizeGridForTactileTransition,
  placeTactileTrayPiece,
  purifyTactileGridSecondWind,
  scanTactileGridTopology,
  sealTactileRowOrColCavities,
  TACTILE_COL_END,
  TACTILE_COL_START,
  TACTILE_ROW_END,
  TACTILE_ROW_START,
} from '../engine/tactileGridEngine'
import { scanBoardTopology } from '../engine/cavityScanner'
import { generateMathChallenge } from '../engine/mathEngine'
import { getSequenceDopamineTier, soundEngine } from '../audio/soundEngine'

const STATS_STORAGE_KEY = 'logic_tetris_v1_stats'
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
  if (style === 'FRUIT_MATCH') return 'Frutas & Pares em Cascata'
  if (style === 'TACTILE_GRID') return 'Grade Livre H×V (10×10)'
  return 'Tetris Clássico (Base-10)'
}

export function getSubGameStylePedagogicalSubtitle(style: SubGameStyle): string {
  if (style === 'FRUIT_MATCH') {
    return 'Alquimia dos Cachos — Agrupamento & Multiplicação (2 + 1 = 3)'
  }
  if (style === 'TACTILE_GRID') {
    return 'Geometria Base-10 — Linhas Horizontais & Colunas Verticais H×V'
  }
  return 'Arquitetura Clássica — Área & Encaixe Base-10'
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

  // Style #2 (FRUIT_MATCH) State:
  activeFruitPair: FruitPairPiece
  nextFruitPair: FruitPairPiece
  fruitOracle: FruitCascadeOracleReport
  lastCascadeWaves: CascadeWave[]

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

  // Actions:
  setMode: (mode: GameMode) => void
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
  triggerMathFillHole: () => void
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
   * Passo 4.2 — Scene Transition Engine (`performStyleShift` — Melhorias 04-B, 04-C & RT-12):
   * Morphs the active board into `targetStyle` in real time, playing the style shift fanfare,
   * running RT-12 safe normalizers (`decorateGridWithFruits` / `normalizeGridForTactileTransition`),
   * granting transmutation bonus points, and NEVER resetting `combo` (`streakCount`), renewing
   * `comboGraceDropsLeft = 3` so the player can carry a 12x+ streak across all 3 styles!
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

    let nextGrid = state.grid
    let nextActivePiece = state.activePiece
    let nextActiveFruitPair = state.activeFruitPair
    let nextUpcomingFruitPair = state.nextFruitPair
    let nextTactileTray = state.tactileTray
    let nextSelectedTraySlot: 0 | 1 | 2 = state.selectedTraySlot
    let nextCursorCol = state.tactileCursorCol
    let nextCursorRow = state.tactileCursorRow
    let transmutationBonusPoints = 0

    if (targetStyle === 'FRUIT_MATCH') {
      nextGrid = decorateGridWithFruits(state.grid)
      const oracle = scanFruitCascadeOracle(nextGrid)
      nextActiveFruitPair = {
        ...createSpawnFruitPair(oracle.recommendedFruit),
        graceFloatMs: 1500,
      }
      nextUpcomingFruitPair = createSpawnFruitPair()
    } else if (targetStyle === 'TACTILE_GRID') {
      const norm = normalizeGridForTactileTransition(state.grid)
      nextGrid = norm.grid
      transmutationBonusPoints = norm.transmutationBonusPoints
      nextTactileTray = generateTactilePieceTray(nextGrid)
      nextSelectedTraySlot = 0
      nextCursorCol = 4
      nextCursorRow = 14
    } else {
      // TETRIS_CLASSIC
      nextGrid = state.grid
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
    const toastTitle = `🌀 DOBRA DO CORDÃO TRÍPLICE: ${styleLabel}!`
    const toastSub = `Cenário transmutado em tempo real · +${shiftBonus} pts · Sequência mantida!`

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
        recentChallengeIds: [...state.recentChallengeIds.slice(-8), challenge.id],
        floatingFeedbacks: nextFeedbacks,
        lastEventCounter: state.lastEventCounter + 1,
        gravityAccumulatorMs: 0,
        lockDelayMs: 0,
        lockResetCount: 0,
        isSoftDropping: false,
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
      stats: updatedStats,
    })
  }

  /**
   * Style #1 (`TETRIS_CLASSIC`) Lock & Line-Clear Handler
   */
  const lockActivePieceAndAdvance = () => {
    const state = get()
    if (state.phase !== 'PLAYING') return

    const lockedGrid = lockPieceToGrid(state.grid, state.activePiece)
    const clearResult = clearCompletedLines(lockedGrid)
    const nextGrid = clearResult.grid
    const cleared = clearResult.clearedCount

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
        }
      )
      return
    }

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
      lastEventCounter: state.lastEventCounter + 1,
      gravityAccumulatorMs: 0,
      lockDelayMs: 0,
      lockResetCount: 0,
      stats: updatedStats,
    })

    if (
      cleared > 0 &&
      state.styleRotationMode === 'SIMULTANEOUS' &&
      nextShiftProgress >= STYLE_SHIFT_TARGET
    ) {
      performStyleShift('FRUIT_MATCH', { isAutoCycle: true })
    }
  }

  /**
   * Style #2 (`FRUIT_MATCH`) Lock & Multi-Wave Cascade Handler
   */
  const lockActiveFruitPairAndAdvance = () => {
    const state = get()
    if (state.phase !== 'PLAYING') return

    const cascade = lockFruitPairAndResolve(state.grid, state.activeFruitPair)
    const nextGrid = cascade.grid
    const wavesCleared = cascade.totalWaves

    const nextLines = state.lines + wavesCleared
    const nextLevel = Math.floor(nextLines / 10) + 1

    let nextCombo = state.combo
    let nextGraceDrops = state.comboGraceDropsLeft
    if (wavesCleared > 0) {
      nextCombo = Math.max(0, state.combo) + cascade.streakDelta
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
    const comboBonus = wavesCleared > 0 && nextCombo > 0 ? nextCombo * 45 * state.level : 0
    const cascadeScore = cascade.totalScoreEarned * state.level + comboBonus
    const nextScore = state.score + cascadeScore + 12

    const prevTenBucket = Math.floor(state.lines / 10)
    const nextTenBucket = Math.floor(nextLines / 10)
    const earnedShield =
      state.mode !== 'zen' && nextTenBucket > prevTenBucket && state.phoenixShields < 3 ? 1 : 0
    const nextPhoenixShields =
      state.mode === 'zen' ? 99 : Math.min(3, state.phoenixShields + earnedShield)

    const chargeGain = wavesCleared > 0 ? wavesCleared * 25 : 8
    const nextLogicCharge = Math.min(100, state.logicCharge + chargeGain)

    const oracles = computeUnifiedOracles(nextGrid)
    const candidatePair = state.nextFruitPair
    const upcomingPair = createSpawnFruitPair()

    const nextFeedbacks = [...state.floatingFeedbacks].slice(-5)
    let resonanceFormula = state.lastMathResonanceFormula
    if (wavesCleared > 0) {
      soundEngine.playSequenceDopamine(
        Math.max(1, nextCombo),
        wavesCleared,
        'FRUIT_MATCH'
      )
      const lastWave = cascade.waves[cascade.waves.length - 1]
      resonanceFormula = lastWave?.mathResonanceFormula ?? null
      nextFeedbacks.push(
        createFeedbackItem(
          wavesCleared >= 2
            ? `🍇 Cascata ×${wavesCleared}! (${cascade.totalPoppedBlocks} Frutas!)`
            : `🍎 Cacho Explosivo! (${cascade.totalPoppedBlocks} Frutas!)`,
          `${resonanceFormula ?? ''} · +${cascadeScore} pts`,
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
    }

    const updatedStats: LogicTetrisPersistentStats = {
      ...state.stats,
      highScore: Math.max(state.stats.highScore, nextScore),
      bestLines: Math.max(state.stats.bestLines, nextLines),
    }
    savePersistentStats(updatedStats)

    const nextShiftProgress =
      wavesCleared > 0 ? state.styleShiftProgress + 1 : state.styleShiftProgress

    if (hasFruitPairCollision(nextGrid, candidatePair)) {
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
          activeFruitPair: candidatePair,
          nextFruitPair: upcomingPair,
          lastCascadeWaves: cascade.waves,
          lastMathResonanceFormula: resonanceFormula,
          styleShiftProgress: nextShiftProgress,
        }
      )
      return
    }

    set({
      grid: nextGrid,
      activeFruitPair: candidatePair,
      nextFruitPair: upcomingPair,
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
      lastCascadeWaves: cascade.waves,
      lastMathResonanceFormula: resonanceFormula,
      styleShiftProgress: nextShiftProgress,
      floatingFeedbacks: nextFeedbacks,
      lastEventCounter: state.lastEventCounter + 1,
      gravityAccumulatorMs: 0,
      lockDelayMs: 0,
      lockResetCount: 0,
      stats: updatedStats,
    })

    if (
      wavesCleared > 0 &&
      state.styleRotationMode === 'SIMULTANEOUS' &&
      nextShiftProgress >= STYLE_SHIFT_TARGET
    ) {
      performStyleShift('TACTILE_GRID', { isAutoCycle: true })
    }
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
    recentChallengeIds: [],
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
    tactileTray: generateTactilePieceTray(initialGrid),
    selectedTraySlot: 0,
    tactileCursorCol: 4,
    tactileCursorRow: 14,
    tactileTopology: initialOracles.tactileTopology,
    lastClearedCols: [],
    lastMathResonanceFormula: null,
    lastMiracleToast: null,

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
      const freshGrid = createEmptyGrid()
      const freshBag = ensureQueueDepth([], 8)
      const [firstPiece, ...restQueue] = freshBag
      const freshOracles = computeUnifiedOracles(freshGrid)
      const startingStyle: SubGameStyle =
        state.phase === 'START_HUB' ? state.activeSubGameStyle : 'TETRIS_CLASSIC'
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
        tactileTray: generateTactilePieceTray(freshGrid),
        selectedTraySlot: 0,
        tactileCursorCol: 4,
        tactileCursorRow: 14,
        lastClearedCols: [],
        lastMathResonanceFormula: null,
        lastMiracleToast: null,
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
            'Use [M] Mudar Peça, [B] Tapar Buraco ou [G] Trocar Estilo!',
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
          }
        )
        return true
      }

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
        lastEventCounter: state.lastEventCounter + 1,
        stats: updatedStats,
      })

      if (
        clearedCount > 0 &&
        state.styleRotationMode === 'SIMULTANEOUS' &&
        nextShiftProgress >= STYLE_SHIFT_TARGET
      ) {
        performStyleShift('TETRIS_CLASSIC', { isAutoCycle: true })
      }

      return true
    },

    moveHorizontal: (dir: -1 | 1) => {
      const state = get()
      if (state.phase !== 'PLAYING') return false

      if (state.activeSubGameStyle === 'TACTILE_GRID') {
        return get().moveTactileCursor(dir, 0)
      }

      if (state.activeSubGameStyle === 'FRUIT_MATCH') {
        const movedPair = moveFruitPairIfValid(
          state.grid,
          state.activeFruitPair,
          dir,
          0
        )
        if (!movedPair) return false
        soundEngine.playMove()
        const isOnFloor = hasFruitPairCollision(state.grid, movedPair, 0, 1)
        const canResetLock = state.lockResetCount < MAX_LOCK_RESETS
        set({
          activeFruitPair: movedPair,
          lockDelayMs: isOnFloor && canResetLock ? 0 : state.lockDelayMs,
          lockResetCount:
            isOnFloor && canResetLock ? state.lockResetCount + 1 : state.lockResetCount,
        })
        return true
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
        const rotatedPair = rotateFruitPairSRS(
          state.grid,
          state.activeFruitPair,
          direction
        )
        soundEngine.playRotate()
        const isOnFloor = hasFruitPairCollision(state.grid, rotatedPair, 0, 1)
        const canResetLock = state.lockResetCount < MAX_LOCK_RESETS
        set({
          activeFruitPair: rotatedPair,
          lockDelayMs: isOnFloor && canResetLock ? 0 : state.lockDelayMs,
          lockResetCount:
            isOnFloor && canResetLock ? state.lockResetCount + 1 : state.lockResetCount,
        })
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
        const movedPair = moveFruitPairIfValid(
          state.grid,
          state.activeFruitPair,
          0,
          1
        )
        if (!movedPair) return false
        soundEngine.playSoftDrop()
        set({
          activeFruitPair: movedPair,
          score: state.score + 1,
          gravityAccumulatorMs: 0,
        })
        return true
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
        soundEngine.playHardDrop()
        const ghostY = computeFruitPairGhostY(state.grid, state.activeFruitPair)
        const dropDistance = Math.max(0, ghostY - state.activeFruitPair.y)
        set({
          activeFruitPair: {
            ...state.activeFruitPair,
            y: ghostY,
          },
          score: state.score + dropDistance * 2,
        })
        lockActiveFruitPairAndAdvance()
        return
      }

      soundEngine.playHardDrop()
      const ghostY = computeGhostY(state.grid, state.activePiece)
      const dropDistance = Math.max(0, ghostY - state.activePiece.y)

      set({
        activePiece: {
          ...state.activePiece,
          y: ghostY,
        },
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

      if (!state.canHold) return false

      if (state.activeSubGameStyle === 'FRUIT_MATCH') {
        soundEngine.playHold()
        const swappedActive: FruitPairPiece = {
          ...state.nextFruitPair,
          x: 4,
          y: 1,
          orientation: 0,
          graceFloatMs: 400,
        }
        const swappedNext: FruitPairPiece = {
          ...state.activeFruitPair,
          x: 4,
          y: 1,
          orientation: 0,
        }
        set({
          activeFruitPair: swappedActive,
          nextFruitPair: swappedNext,
          canHold: false,
          gravityAccumulatorMs: 0,
          lockDelayMs: 0,
          lockResetCount: 0,
        })
        return true
      }

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

      // 2. Style #3 (`TACTILE_GRID`) has zero falling gravity!
      if (state.activeSubGameStyle === 'TACTILE_GRID') {
        return
      }

      // 3. Bullet-time (0.12x) visual drift while in voluntary math modal, never locking! (RT-01)
      if (state.phase === 'MATH_MORPH' || state.phase === 'MATH_FILL_HOLE') {
        const bulletDt = dtMs * 0.12
        const baseInterval = computeBaseGravityIntervalMs(state.level, state.mode)
        const nextAcc = state.gravityAccumulatorMs + bulletDt
        if (nextAcc >= baseInterval) {
          if (state.activeSubGameStyle === 'FRUIT_MATCH') {
            const movedPair = moveFruitPairIfValid(
              state.grid,
              state.activeFruitPair,
              0,
              1
            )
            set({
              activeFruitPair: movedPair ?? state.activeFruitPair,
              gravityAccumulatorMs: 0,
            })
          } else {
            const moved = movePieceIfValid(state.grid, state.activePiece, 0, 1)
            set({
              activePiece: moved ?? state.activePiece,
              gravityAccumulatorMs: 0,
            })
          }
        } else {
          set({ gravityAccumulatorMs: nextAcc })
        }
        return
      }

      if (state.phase !== 'PLAYING') return

      // 4. Style #2 (`FRUIT_MATCH`) Falling Pair Gravity & Lock Delay
      if (state.activeSubGameStyle === 'FRUIT_MATCH') {
        const currentGrace = state.activeFruitPair.graceFloatMs ?? 0
        const nextGrace = Math.max(0, currentGrace - dtMs)
        const updatedPair: FruitPairPiece =
          currentGrace !== nextGrace
            ? { ...state.activeFruitPair, graceFloatMs: nextGrace }
            : state.activeFruitPair

        const isOnFloor = hasFruitPairCollision(state.grid, updatedPair, 0, 1)
        if (isOnFloor) {
          const lockDelta = nextGrace > 0 ? dtMs * 0.35 : dtMs
          const nextLockDelay = state.lockDelayMs + lockDelta
          if (nextLockDelay >= LOCK_DELAY_LIMIT_MS) {
            set({ activeFruitPair: updatedPair, lockDelayMs: 0 })
            lockActiveFruitPairAndAdvance()
            return
          }
          set({
            activeFruitPair: updatedPair,
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
          const movedPair = moveFruitPairIfValid(state.grid, updatedPair, 0, 1)
          set({
            activeFruitPair: movedPair ?? updatedPair,
            gravityAccumulatorMs: nextAcc - effectiveInterval,
            lockDelayMs: 0,
            score: state.isSoftDropping && movedPair ? state.score + 1 : state.score,
          })
        } else {
          set({
            activeFruitPair: updatedPair,
            gravityAccumulatorMs: nextAcc,
          })
        }
        return
      }

      // 5. Style #1 (`TETRIS_CLASSIC`) Falling Tetromino Gravity & Lock Delay
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
        excludeIds: state.recentChallengeIds,
      })

      set({
        phase: 'MATH_MORPH',
        activeChallenge: challenge,
        eliminatedChoiceValues: [],
        lastWrongDiagnosis: null,
        wrongAttemptsOnCurrentChallenge: 0,
        recentChallengeIds: [...state.recentChallengeIds.slice(-8), challenge.id],
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

    triggerMathFillHole: () => {
      const state = get()
      if (state.phase !== 'PLAYING' && state.phase !== 'MATH_FILL_HOLE') return

      soundEngine.playOpenIntervention()
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
        excludeIds: state.recentChallengeIds,
      })

      set({
        phase: 'MATH_FILL_HOLE',
        activeChallenge: challenge,
        eliminatedChoiceValues: [],
        lastWrongDiagnosis: null,
        wrongAttemptsOnCurrentChallenge: 0,
        recentChallengeIds: [...state.recentChallengeIds.slice(-8), challenge.id],
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

      // ---------------------------------------------------------------------
      // 1. Miracle 1: MATH_MORPH ([M] — Polymorphic across the 3 Styles!)
      // ---------------------------------------------------------------------
      if (state.phase === 'MATH_MORPH') {
        soundEngine.playMorphSuccess()
        const bonusPoints = (wasFirstTry ? 250 : 150) * state.level
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
          const logEntry: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary: 'Par de Frutas transmutado em Par Coringa Estelar (✦ + ✦)!',
          }
          set({
            phase: 'PLAYING',
            activeFruitPair: wildcardPair,
            score: nextScore,
            combo: nextCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: nextMaxStreak,
            lastDopamineTier: nextDopamineTier,
            logicCharge: Math.min(100, state.logicCharge + 20),
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            lastMiracleToast: '⭐ Par Coringa Estelar (✦ + ✦)!',
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                '⭐ Par Coringa Estelar (✦ + ✦)!',
                `Conecta com qualquer cor para fechar 2 + 1 = 3 · +${bonusPoints} pts`,
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
            effectSummary: `Bandeja Tátil moldada para ${def.namePt} (${def.areaFormula})`,
          }
          set({
            phase: 'PLAYING',
            tactileTray: updatedTray,
            score: nextScore,
            combo: nextCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: nextMaxStreak,
            lastDopamineTier: nextDopamineTier,
            logicCharge: Math.min(100, state.logicCharge + 20),
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            lastMiracleToast: `✨ Bandeja Moldada: ${def.namePt}!`,
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `✨ Bandeja Moldada: ${def.namePt}!`,
                `Área ${def.areaFormula} pronta para encaixe H×V · +${bonusPoints} pts`,
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
          effectSummary: `Peça transmutada para ${def.namePt} (${def.areaFormula})`,
        }

        set({
          phase: 'PLAYING',
          activePiece: {
            ...morphedPiece,
            isMorphed: true,
            graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
          },
          score: nextScore,
          combo: nextCombo,
          comboGraceDropsLeft: nextGraceDrops,
          maxStreakInSession: nextMaxStreak,
          lastDopamineTier: nextDopamineTier,
          logicCharge: Math.min(100, state.logicCharge + 20),
          activeChallenge: null,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
          lastMiracleToast: `✨ Alquimia: ${def.namePt}!`,
          floatingFeedbacks: buildFeedbackListWithLegend(
            state.floatingFeedbacks,
            createFeedbackItem(
              `✨ Alquimia: ${def.namePt}!`,
              `Área ${def.areaFormula} · +${bonusPoints} pts`,
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
        const maxToSeal = state.mode === 'zen' ? 3 : wasFirstTry ? 3 : 2

        if (state.activeSubGameStyle === 'FRUIT_MATCH') {
          const magResult = magnetizeSingleFruitColor(
            state.grid,
            state.fruitOracle.mostFragmentedFruit
          )
          const effectiveCombo = Math.max(
            nextCombo,
            Math.max(0, state.combo) + Math.max(1, magResult.streakDelta)
          )
          const effectiveMaxStreak = Math.max(state.maxStreakInSession, effectiveCombo)
          const effectiveTier = getSequenceDopamineTier(effectiveCombo)
          const magScore = Math.max(250, magResult.totalScoreEarned) * state.level
          const nextScore = state.score + magScore
          const nextLines = state.lines + Math.max(1, magResult.totalWaves)
          const nextLevel = Math.floor(nextLines / 10) + 1
          const oracles = computeUnifiedOracles(magResult.grid)
          const formula =
            magResult.waves[magResult.waves.length - 1]?.mathResonanceFormula ??
            'Imã Magnético de Frutas!'

          const logEntry: SolvedChallengeLog = {
            challenge,
            solvedAt: Date.now(),
            wasFirstTry,
            effectSummary: `Imã de Frutas colapsou ${magResult.totalPoppedBlocks} blocos (${formula})`,
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
            grid: magResult.grid,
            score: nextScore,
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
            lastMiracleToast: `🧲 Imã de Frutas: ${formula}`,
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `🧲 Imã de Frutas! (${magResult.totalPoppedBlocks} Blocos!)`,
                `${formula} · +${magScore} pts`,
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
          const effectiveCombo = Math.max(
            nextCombo,
            Math.max(0, state.combo) + Math.max(1, sealRes.clearResult.streakDelta)
          )
          const effectiveMaxStreak = Math.max(state.maxStreakInSession, effectiveCombo)
          const effectiveTier = getSequenceDopamineTier(effectiveCombo)
          const nextLines = state.lines + clearedCount
          const nextLevel = Math.floor(nextLines / 10) + 1
          const sealBonus =
            (sealedCount * 150 + sealRes.clearResult.scoreEarned) * state.level
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
            effectSummary: `Selou ${sealedCount} buraco(s) na ${axisLabel} (${formula})`,
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
            lastMiracleToast: `⚖️ ${axisLabel} Selada a Ouro!`,
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `⚖️ ${axisLabel} Selada a Ouro!`,
                `${formula} · +${sealBonus} pts`,
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
          const nextLines = state.lines + cleared
          const nextLevel = Math.floor(nextLines / 10) + 1
          const clearScore = computeLineClearBaseScore(cleared) * state.level
          const sealBonus = sealedCount * 150 * state.level + clearScore
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
            effectSummary: `Selou ${sealedCount} buraco(s) soterrado(s)${cleared > 0 ? ` e limpou ${cleared} linha(s)!` : ''}`,
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
            lines: nextLines,
            level: nextLevel,
            combo: nextCombo,
            comboGraceDropsLeft: nextGraceDrops,
            maxStreakInSession: nextMaxStreak,
            lastDopamineTier: nextDopamineTier,
            topology: oracles.topology,
            fruitOracle: oracles.fruitOracle,
            tactileTopology: oracles.tactileTopology,
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            lastMiracleToast: `⚖️ ${sealedCount} Buraco(s) Selado(s) a Ouro!`,
            floatingFeedbacks: buildFeedbackListWithLegend(
              state.floatingFeedbacks,
              createFeedbackItem(
                `⚖️ ${sealedCount} Buraco(s) Selado(s) a Ouro!`,
                cleared > 0
                  ? `Cascata Base-10: +${cleared} linha(s) limpa(s)! (+${sealBonus} pts)`
                  : `Cristais da Balança materializados! (+${sealBonus} pts)`,
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

        // If 0 buried holes in TETRIS_CLASSIC, grant Golden Monomino (1x1)
        const goldenDot = findSafeMorphPlacement(
          state.grid,
          state.activePiece,
          'DOT_1X1'
        )
        const nextScore = state.score + 200 * state.level
        const logEntry: SolvedChallengeLog = {
          challenge,
          solvedAt: Date.now(),
          wasFirstTry,
          effectSummary: 'Tabuleiro sem buracos soterrados → Monominó Dourado (1×1) concedido!',
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
            recentChallengeIds: [...state.recentChallengeIds.slice(-8), nextChallenge.id],
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
