import { create } from 'zustand'
import {
  ActivePiece,
  BoardTopologyReport,
  FloatingFeedback,
  GameMode,
  GamePhase,
  GridMatrix,
  LogicTetrisPersistentStats,
  PieceType,
  RotationDirection,
  SolvedChallengeLog,
  StandardPieceType,
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
import { scanBoardTopology } from '../engine/cavityScanner'
import { generateMathChallenge } from '../engine/mathEngine'
import { soundEngine } from '../audio/soundEngine'

const STATS_STORAGE_KEY = 'logic_tetris_v1_stats'
export const LOCK_DELAY_LIMIT_MS = 500
export const MAX_LOCK_RESETS = 15
export const POST_MODAL_INPUT_GUARD_MS = 250

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

  // Actions
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
}

const initialGrid = createEmptyGrid()
const initialBag = ensureQueueDepth([], 8)
const initialFirstType = initialBag[0]
const initialStats = loadPersistentStats()

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

  const lockActivePieceAndAdvance = () => {
    const state = get()
    if (state.phase !== 'PLAYING') return

    const lockedGrid = lockPieceToGrid(state.grid, state.activePiece)
    const clearResult = clearCompletedLines(lockedGrid)
    const nextGrid = clearResult.grid
    const cleared = clearResult.clearedCount

    const nextLines = state.lines + cleared
    const nextLevel = Math.floor(nextLines / 10) + 1
    const nextCombo = cleared > 0 ? state.combo + 1 : -1
    const comboBonus = nextCombo > 0 ? nextCombo * 50 * state.level : 0
    const allClearBonus = clearResult.isAllClear ? 1200 * state.level : 0
    const lineScore = computeLineClearBaseScore(cleared) * state.level + comboBonus + allClearBonus
    const nextScore = state.score + lineScore + 10

    // Recharge Phoenix Shield every 10 honest lines cleared in Arcade/Master (Melhoria 03-D)
    const prevTenBucket = Math.floor(state.lines / 10)
    const nextTenBucket = Math.floor(nextLines / 10)
    const earnedShield =
      state.mode !== 'zen' && nextTenBucket > prevTenBucket && state.phoenixShields < 3 ? 1 : 0
    const nextPhoenixShields =
      state.mode === 'zen' ? 99 : Math.min(3, state.phoenixShields + earnedShield)

    // Recharge Logic Charge (+25 per line cleared, +8 for locking a piece)
    const chargeGain = cleared > 0 ? cleared * 25 : 8
    const nextLogicCharge = Math.min(100, state.logicCharge + chargeGain)

    // Pull next piece from 7-Bag queue
    const replenishedQueue = ensureQueueDepth(state.nextQueue, 8)
    const [nextPieceType, ...remainingQueue] = replenishedQueue
    const candidateSpawn = createSpawnPiece(nextPieceType)
    const nextTopology = scanBoardTopology(nextGrid)

    const nextFeedbacks = [...state.floatingFeedbacks].slice(-5)
    if (cleared > 0) {
      soundEngine.playLineClear(cleared, Math.max(0, nextCombo))
      const clearLabels: Record<number, string> = {
        1: '✨ Linha Base-10 Completa!',
        2: '⚡ Duplo Equilíbrio (20 Blocos)!',
        3: '🔥 Triplo Harmônico (30 Blocos)!',
        4: '🌟 TETRIS GÊNESIS! (4 × 10 = 40)!',
      }
      nextFeedbacks.push(
        createFeedbackItem(
          clearLabels[cleared] ?? '✨ Linhas Purificadas!',
          `+${lineScore} pts${earnedShield ? ' · 🛡️ +1 Escudo Fênix!' : ''}`,
          cleared >= 4 ? 'gold' : 'green'
        )
      )
    }

    const updatedStats: LogicTetrisPersistentStats = {
      ...state.stats,
      highScore: Math.max(state.stats.highScore, nextScore),
      bestLines: Math.max(state.stats.bestLines, nextLines),
    }
    savePersistentStats(updatedStats)

    // Check Top-Out (collision at spawn) -> Trigger MATH_SECOND_WIND if shields remain!
    if (hasCollision(nextGrid, candidateSpawn, 0, 0)) {
      if (state.mode === 'zen' || nextPhoenixShields > 0) {
        soundEngine.playSecondWindAlert()
        const stepsRequired =
          state.mode === 'zen'
            ? 1
            : Math.min(3, state.secondWindUsedCount + 1)
        const challenge = generateMathChallenge({
          mode: state.mode,
          interventionType: 'SECOND_WIND',
          level: nextLevel,
          excludeIds: state.recentChallengeIds,
        })

        nextFeedbacks.push(
          createFeedbackItem(
            '🔥 PROTOCOLO FÊNIX ATIVADO!',
            'Resolva a conta para purificar a base e salvar a vida!',
            'gold'
          )
        )

        set({
          grid: nextGrid,
          activePiece: candidateSpawn,
          nextQueue: ensureQueueDepth(remainingQueue, 7),
          canHold: true,
          score: nextScore,
          lines: nextLines,
          level: nextLevel,
          combo: nextCombo,
          logicCharge: nextLogicCharge,
          phoenixShields: nextPhoenixShields,
          topology: nextTopology,
          phase: 'MATH_SECOND_WIND',
          activeChallenge: challenge,
          secondWindStepsRemaining: stepsRequired,
          secondWindStepsTotal: stepsRequired,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          recentChallengeIds: [...state.recentChallengeIds.slice(-8), challenge.id],
          floatingFeedbacks: nextFeedbacks,
          lastClearedRows: clearResult.clearedRows,
          lastEventCounter: state.lastEventCounter + 1,
          gravityAccumulatorMs: 0,
          lockDelayMs: 0,
          lockResetCount: 0,
          isSoftDropping: false,
          stats: updatedStats,
        })
        return
      }

      // Game Over when all Phoenix Shields are exhausted in Arcade/Master
      soundEngine.playGameOver()
      set({
        grid: nextGrid,
        activePiece: candidateSpawn,
        nextQueue: ensureQueueDepth(remainingQueue, 7),
        score: nextScore,
        lines: nextLines,
        level: nextLevel,
        combo: nextCombo,
        topology: nextTopology,
        phase: 'GAME_OVER',
        activeChallenge: null,
        floatingFeedbacks: nextFeedbacks,
        lastClearedRows: clearResult.clearedRows,
        lastEventCounter: state.lastEventCounter + 1,
        gravityAccumulatorMs: 0,
        lockDelayMs: 0,
        lockResetCount: 0,
        isSoftDropping: false,
        stats: updatedStats,
      })
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
      logicCharge: nextLogicCharge,
      phoenixShields: nextPhoenixShields,
      topology: nextTopology,
      floatingFeedbacks: nextFeedbacks,
      lastClearedRows: clearResult.clearedRows,
      lastEventCounter: state.lastEventCounter + 1,
      gravityAccumulatorMs: 0,
      lockDelayMs: 0,
      lockResetCount: 0,
      stats: updatedStats,
    })
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
    logicCharge: 100,
    phoenixShields: 2,
    secondWindUsedCount: 0,
    secondWindStepsRemaining: 0,
    secondWindStepsTotal: 0,
    topology: scanBoardTopology(initialGrid),
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
        logicCharge: 100,
        phoenixShields: targetMode === 'zen' ? 99 : targetMode === 'arcade' ? 2 : 1,
        secondWindUsedCount: 0,
        secondWindStepsRemaining: 0,
        secondWindStepsTotal: 0,
        topology: scanBoardTopology(freshGrid),
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
            'Use [M] Mudar Peça ou [B] Tapar Buraco sempre que precisar!',
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

    moveHorizontal: (dir: -1 | 1) => {
      const state = get()
      if (state.phase !== 'PLAYING') return false

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

    rotatePiece: (direction: RotationDirection = 'CW') => {
      const state = get()
      if (state.phase !== 'PLAYING') return false

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
      if (state.phase !== 'PLAYING' || !state.canHold) return false

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

      // Bullet-time (0.12x) visual drift while in voluntary math modal, never locking! (RT-01)
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

      // Update Grace Float shield timer (RT-07: 1200ms gentle gravity after math intervention)
      const currentGrace = state.activePiece.graceFloatMs ?? 0
      const nextGrace = Math.max(0, currentGrace - dtMs)
      const updatedPiece: ActivePiece =
        currentGrace !== nextGrace
          ? { ...state.activePiece, graceFloatMs: nextGrace }
          : state.activePiece

      const isOnFloor = hasCollision(state.grid, updatedPiece, 0, 1)

      if (isOnFloor) {
        // During Grace Float, slow down lock delay accumulation so player can position calmly
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

      // Not on floor: accumulate gravity
      const baseInterval = computeBaseGravityIntervalMs(state.level, state.mode)
      const effectiveInterval = state.isSoftDropping
        ? Math.min(55, baseInterval * 0.12)
        : nextGrace > 0
          ? baseInterval / 0.35 // 0.35x gentle fall speed during Grace Float!
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
      const chosenTarget: PieceType =
        targetPiece ?? state.topology.recommendedPiece ?? 'I'

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
      const missingInRow = topCavity?.missingInRow

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
      // CASE A: ELASTIC FEEDBACK ON DISTRACTOR (RT-09 & Melhoria 03-B / 06-B)
      // Do NOT close the modal! Show warm `trapDiagnosis` inline and let the
      // player click the correct option next to guarantee their reward!
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
      // CASE B: CORRECT ANSWER! Execute the life-saving math miracle!
      // =====================================================================
      const wasFirstTry = state.wrongAttemptsOnCurrentChallenge === 0
      const guardUntil = Date.now() + POST_MODAL_INPUT_GUARD_MS

      // 1. Miracle 1: MATH_MORPH (Transform falling piece into the exact needed shape)
      if (state.phase === 'MATH_MORPH') {
        soundEngine.playMorphSuccess()
        const targetType: PieceType =
          challenge.targetPiece ?? state.topology.recommendedPiece ?? 'I'
        const morphedPiece = findSafeMorphPlacement(
          state.grid,
          state.activePiece,
          targetType
        )
        const def = getPieceDefinition(morphedPiece.type)
        const bonusPoints = (wasFirstTry ? 250 : 150) * state.level
        const nextScore = state.score + bonusPoints

        const logEntry: SolvedChallengeLog = {
          challenge,
          solvedAt: Date.now(),
          wasFirstTry,
          effectSummary: `Peça transmutada para ${def.namePt} (${def.areaFormula})`,
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
          activePiece: {
            ...morphedPiece,
            isMorphed: true,
            graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
          },
          score: nextScore,
          logicCharge: Math.min(100, state.logicCharge + 20),
          activeChallenge: null,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
          floatingFeedbacks: [
            ...state.floatingFeedbacks.slice(-5),
            createFeedbackItem(
              `✨ Alquimia: ${def.namePt}!`,
              `Área ${def.areaFormula} · +${bonusPoints} pts`,
              'cyan'
            ),
          ],
          lastEventCounter: state.lastEventCounter + 1,
          gravityAccumulatorMs: 0,
          lockDelayMs: 0,
          lockResetCount: 0,
          postModalInputGuardUntil: guardUntil,
          stats: updatedStats,
        })
        return 'CORRECT'
      }

      // 2. Miracle 2: MATH_FILL_HOLE (Seal buried cavities directly in the stack!)
      if (state.phase === 'MATH_FILL_HOLE') {
        soundEngine.playSealHoleSuccess()
        const cavities = state.topology.buriedCavities

        if (cavities.length > 0) {
          const maxToSeal = state.mode === 'zen' ? 3 : wasFirstTry ? 3 : 2
          const sealResult = sealBuriedCavities(state.grid, cavities, maxToSeal)
          const sealedCount = sealResult.sealedCoordinates.length
          const cleared = sealResult.lineClearResult.clearedCount
          if (cleared > 0) {
            soundEngine.playLineClear(cleared, Math.max(0, state.combo + 1))
          }
          const nextLines = state.lines + cleared
          const nextLevel = Math.floor(nextLines / 10) + 1
          const clearScore = computeLineClearBaseScore(cleared) * state.level
          const sealBonus = sealedCount * 150 * state.level + clearScore
          const nextScore = state.score + sealBonus

          const nextTopology = scanBoardTopology(sealResult.grid)
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
            topology: nextTopology,
            activeChallenge: null,
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
            floatingFeedbacks: [
              ...state.floatingFeedbacks.slice(-5),
              createFeedbackItem(
                `⚖️ ${sealedCount} Buraco(s) Selado(s) a Ouro!`,
                cleared > 0
                  ? `Cascata Base-10: +${cleared} linha(s) limpa(s)! (+${sealBonus} pts)`
                  : `Cristais da Balança materializados! (+${sealBonus} pts)`,
                'gold'
              ),
            ],
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

        // If the player triggered [B] when there were 0 buried holes, reward them with the Golden Monomino (1x1)!
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
          activeChallenge: null,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
          floatingFeedbacks: [
            ...state.floatingFeedbacks.slice(-5),
            createFeedbackItem(
              '★ Monominó Dourado (1×1) Concedido!',
              'Sem buracos soterrados: peça 1×1 pronta para encaixe cirúrgico!',
              'gold'
            ),
          ],
          lastEventCounter: state.lastEventCounter + 1,
          gravityAccumulatorMs: 0,
          lockDelayMs: 0,
          lockResetCount: 0,
          postModalInputGuardUntil: guardUntil,
          stats: updatedStats,
        })
        return 'CORRECT'
      }

      // 3. Miracle 3: MATH_SECOND_WIND (Phoenix Protocol 142857 — Save life at Top-Out!)
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
            eliminatedChoiceValues: [],
            lastWrongDiagnosis: null,
            wrongAttemptsOnCurrentChallenge: 0,
            recentChallengeIds: [...state.recentChallengeIds.slice(-8), nextChallenge.id],
            solvedHistory: [stepLog, ...state.solvedHistory].slice(0, 30),
            floatingFeedbacks: [
              ...state.floatingFeedbacks.slice(-5),
              createFeedbackItem(
                `🔥 Fênix: Falta(m) ${remainingAfterThis} conta(s)!`,
                'Continue para purificar a base!',
                'gold'
              ),
            ],
            stats: updatedStats,
          })
          return 'CORRECT'
        }

        // Final step of Second Wind completed! Purify bottom rows and save the player!
        soundEngine.playPhoenixSecondWind()
        const rowsToPurify = state.mode === 'zen' ? 6 : 4
        const purifiedGrid = purifyBottomRows(state.grid, rowsToPurify)
        const nextTopology = scanBoardTopology(purifiedGrid)
        const safeSpawn = findSafeMorphPlacement(
          purifiedGrid,
          createSpawnPiece(state.activePiece.type),
          state.activePiece.type
        )
        const phoenixBonus = 500 * state.level
        const nextScore = state.score + phoenixBonus
        const nextShields =
          state.mode === 'zen' ? 99 : Math.max(0, state.phoenixShields - 1)

        const logEntry: SolvedChallengeLog = {
          challenge,
          solvedAt: Date.now(),
          wasFirstTry,
          effectSummary: `Protocolo Fênix 142857: Purificou ${rowsToPurify} linhas e salvou a partida!`,
        }

        const updatedStats: LogicTetrisPersistentStats = {
          ...state.stats,
          highScore: Math.max(state.stats.highScore, nextScore),
          totalMathSolved: state.stats.totalMathSolved + 1,
          totalSecondWinds: state.stats.totalSecondWinds + 1,
        }
        savePersistentStats(updatedStats)

        set({
          phase: 'PLAYING',
          grid: purifiedGrid,
          activePiece: {
            ...safeSpawn,
            isMorphed: false,
            graceFloatMs: GRACE_FLOAT_AFTER_MORPH_MS,
          },
          score: nextScore,
          phoenixShields: nextShields,
          secondWindUsedCount: state.secondWindUsedCount + 1,
          secondWindStepsRemaining: 0,
          secondWindStepsTotal: 0,
          topology: nextTopology,
          activeChallenge: null,
          eliminatedChoiceValues: [],
          lastWrongDiagnosis: null,
          wrongAttemptsOnCurrentChallenge: 0,
          solvedHistory: [logEntry, ...state.solvedHistory].slice(0, 30),
          floatingFeedbacks: [
            ...state.floatingFeedbacks.slice(-5),
            createFeedbackItem(
              '🔥 FÊNIX 142857! VIDA SALVA!',
              `Base purificada em ${rowsToPurify} andares · +${phoenixBonus} pts!`,
              'gold'
            ),
          ],
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
