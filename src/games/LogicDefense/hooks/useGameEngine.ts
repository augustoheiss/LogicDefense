import { useRef, useState, useCallback, useEffect } from 'react'
import type { GameState, BuffType, MathProblem, GameStats, DifficultyMode } from '../types/game'
import { Enemy } from '../engine/Enemy'
import { Tower } from '../engine/Tower'
import { Bullet } from '../engine/Bullet'
import { Particle } from '../engine/Particle'
import { Hero } from '../engine/Hero'
import { Coin } from '../engine/Coin'
import { TOWER_TYPES, BUFF_PHRASES, TOTAL_TIME, CANVAS_WIDTH, CANVAS_HEIGHT } from '../engine/constants'
import {
  generateMapPaths,
  getRotatedPaths,
  advanceRotation,
  resetMap,
  distToSegment,
} from '../engine/mapGenerator'
import { generateMathProblem, buildQuestionText, generateOptions, generateTip } from '../engine/mathEngine'
import { saveRound } from './useHighScore'

// Re-export for consumers
export { generateTip }

export interface GameEngineState {
  gameState: GameState
  gold: number
  lives: number
  wave: number
  goldMultiplier: number
  totalCorrect: number
  totalWrong: number
  currentBuff: BuffType
  stats: GameStats
  selectedTowerIdx: number
  selectedExistingTower: Tower | null
  aiMode: boolean
  gameSpeed: number
  isAudioMuted: boolean
  uiHidden: boolean
  stressMode: boolean
  // Math phase data
  mathQuestion: string
  mathOptions: number[]
  currentProblem: MathProblem | null
  tipHtml: string
  timeLeft: number
  phraseMessage: string
  // Modal
  showSaveModal: boolean
  // ── NEW: Hero / Difficulty system ──────────────────────────
  difficultyMode: DifficultyMode
  heroCount: number
  selectedHero: Hero | null
}

const initialStats: GameStats = {
  totalGold: 150,
  livesGained: 0,
  livesLost: 0,
  totalMath: 0,
  errors: { '+': 0, '-': 0, 'x': 0, '÷': 0 },
}

function getHeroStartPositions(count: number): Array<{ x: number; y: number }> {
  const cx = CANVAS_WIDTH / 2
  const cy = CANVAS_HEIGHT / 2
  if (count === 1) return [{ x: cx, y: cy }]
  if (count === 2) return [{ x: cx - 65, y: cy }, { x: cx + 65, y: cy }]
  return [{ x: cx, y: cy - 65 }, { x: cx - 75, y: cy + 45 }, { x: cx + 75, y: cy + 45 }]
}

export function useGameEngine(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  playSound: (type: string) => void,
  initAudio: () => void,
) {
  // ── Mutable game object refs (no re-renders) ──────────────────────────
  const towersRef    = useRef<Tower[]>([])
  const enemiesRef   = useRef<Enemy[]>([])
  const bulletsRef   = useRef<Bullet[]>([])
  const particlesRef = useRef<Particle[]>([])
  const heroesRef    = useRef<Hero[]>([])
  const coinsRef     = useRef<Coin[]>([])
  const cinematicParticlesRef = useRef<Array<{ x: number; y: number; angle: number; dist: number; speed: number; char: string }>>([])

  // Mouse/touch
  const mouseXRef    = useRef(0)
  const mouseYRef    = useRef(0)
  const physicalXRef = useRef(0)
  const physicalYRef = useRef(0)

  // Game flow control refs
  const isPausedRef              = useRef(false)
  const isGameOverRef            = useRef(false)
  const lastRotatedWaveRef       = useRef(0)
  const waitingForMathRef        = useRef(false)
  const isWaveTransitioningRef   = useRef(false)
  const spinConsumedRef          = useRef(false)
  const lastAnswerCorrectRef     = useRef(true)

  // Math timer
  const mathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeLeftRef  = useRef(TOTAL_TIME)

  // AI mode refs
  const aiModeRef    = useRef(false)
  const stressModeRef = useRef(false)

  // Drag state
  const isDraggingGhostRef = useRef(false)
  const movingTowerRef     = useRef<Tower | null>(null)

  // Enemy spawn
  const totalEnemiesToSpawnRef = useRef(0)
  const enemiesSpawnedRef      = useRef(0)
  const spawnFrameCounterRef   = useRef(0)

  // Phrase queue
  const phraseQueueRef = useRef<string[]>([])

  // ── Hero / Difficulty refs ────────────────────────────────────────────
  const selectedHeroRef      = useRef<Hero | null>(null)
  const difficultyModeRef    = useRef<DifficultyMode>('normal')
  const spawnMultiplierRef   = useRef<number>(1)
  const waveOffsetRef        = useRef<number>(0)
  const heroCountRef         = useRef<number>(0)

  // ── React UI State ─────────────────────────────────────────────────────
  const [uiState, setUiState] = useState<GameEngineState>({
    gameState: 'START',
    gold: 150,
    lives: 20,
    wave: 0,
    goldMultiplier: 1.0,
    totalCorrect: 0,
    totalWrong: 0,
    currentBuff: 'cadeira',
    stats: { ...initialStats },
    selectedTowerIdx: -1,
    selectedExistingTower: null,
    aiMode: false,
    gameSpeed: 1,
    isAudioMuted: false,
    uiHidden: false,
    stressMode: false,
    mathQuestion: '',
    mathOptions: [],
    currentProblem: null,
    tipHtml: '',
    timeLeft: TOTAL_TIME,
    phraseMessage: '',
    showSaveModal: false,
    difficultyMode: 'normal',
    heroCount: 0,
    selectedHero: null,
  })

  // Refs that mirror state for use inside closures/RAF
  const gameStateRef           = useRef<GameState>('START')
  const goldRef                = useRef(150)
  const livesRef               = useRef(20)
  const waveRef                = useRef(0)
  const goldMultiplierRef      = useRef(1.0)
  const totalCorrectRef        = useRef(0)
  const totalWrongRef          = useRef(0)
  const statsRef               = useRef<GameStats>({ ...initialStats })
  const selectedTowerIdxRef    = useRef(-1)
  const selectedExistingTowerRef = useRef<Tower | null>(null)
  const gameSpeedRef           = useRef(1)
  const currentProblemRef      = useRef<MathProblem | null>(null)
  const currentBuffRef         = useRef<BuffType>('cadeira')

  // Feedback message setter (passed from component via ref)
  const feedbackRef = useRef<((msg: string, color: string) => void) | null>(null)

  // ── Helpers ────────────────────────────────────────────────────────────
  function syncUiState(patch: Partial<GameEngineState>) {
    setUiState(prev => ({ ...prev, ...patch }))
  }

  function checkCollision(x: number, y: number, ignoreTower?: Tower): boolean {
    for (const t of towersRef.current) {
      if (t === ignoreTower) continue
      const dist = Math.sqrt((t.x - x) ** 2 + (t.y - y) ** 2)
      if (dist < 35) return false
    }
    const rotatedPaths = getRotatedPaths()
    for (const rp of rotatedPaths) {
      for (let i = 0; i < rp.length - 1; i++) {
        const dist = distToSegment(x, y, rp[i].x, rp[i].y, rp[i + 1].x, rp[i + 1].y)
        if (dist < 30) return false
      }
    }
    return true
  }

  function showFeedback(msg: string, color: string) {
    feedbackRef.current?.(msg, color)
  }

  // ── Game Initialization ────────────────────────────────────────────────
  const initGame = useCallback(() => {
    if (mathTimerRef.current) { clearInterval(mathTimerRef.current); mathTimerRef.current = null }

    generateMapPaths()
    towersRef.current            = []
    enemiesRef.current           = []
    bulletsRef.current           = []
    particlesRef.current         = []
    heroesRef.current            = []
    coinsRef.current             = []
    cinematicParticlesRef.current = []

    // Reset difficulty
    heroesRef.current.forEach(h => h.selected = false)
    selectedHeroRef.current    = null
    difficultyModeRef.current  = 'normal'
    spawnMultiplierRef.current = 1
    waveOffsetRef.current      = 0
    heroCountRef.current       = 0

    goldRef.current          = 150
    livesRef.current         = 20
    waveRef.current          = 0
    goldMultiplierRef.current = 1.0
    totalCorrectRef.current  = 0
    totalWrongRef.current    = 0
    statsRef.current         = { ...initialStats }
    gameStateRef.current     = 'START'
    isGameOverRef.current    = false
    isPausedRef.current      = false
    waitingForMathRef.current         = false
    isWaveTransitioningRef.current    = false
    spinConsumedRef.current           = false
    lastRotatedWaveRef.current        = 0
    resetMap()

    syncUiState({
      gameState: 'START',
      gold: 150,
      lives: 20,
      wave: 0,
      goldMultiplier: 1.0,
      totalCorrect: 0,
      totalWrong: 0,
      stats: { ...initialStats },
      selectedTowerIdx: -1,
      selectedExistingTower: null,
      showSaveModal: false,
      difficultyMode: 'normal',
      heroCount: 0,
      selectedHero: null,
    })
  }, [])

  // ── Difficulty / Hero selection ────────────────────────────────────────
  /**
   * Called from HeroSelectionOverlay.
   * Configures spawn multiplier + wave offset, spawns heroes, then starts SPIN.
   */
  const applyDifficulty = useCallback((count: 1 | 2 | 3) => {
    let mode: DifficultyMode = 'normal'
    let offset = 0
    let multiplier = 1

    if (count === 2) { mode = 'hardcore';  offset = 300;  multiplier = 3 }
    if (count === 3) { mode = 'godmode';   offset = 1000; multiplier = 9 }

    difficultyModeRef.current  = mode
    waveOffsetRef.current      = offset
    spawnMultiplierRef.current = multiplier
    heroCountRef.current       = count

    // Spawn heroes at symmetrical starting positions
    heroesRef.current = getHeroStartPositions(count).map(p => new Hero(p.x, p.y))

    syncUiState({ difficultyMode: mode, heroCount: count, selectedHero: null })

    try { initAudio() } catch { /* audio failure is non-fatal */ }
    gameStateRef.current = 'SPIN'
    syncUiState({ gameState: 'SPIN' })
    spinConsumedRef.current = false  // arm for the upcoming spin
  }, [initAudio])

  // ── Buff / Phrase system ───────────────────────────────────────────────
  function applyBuff(buff: BuffType) {
    currentBuffRef.current = buff
    const phrases = [...BUFF_PHRASES[buff]].sort(() => Math.random() - 0.5)
    phraseQueueRef.current = phrases

    const modal = document.getElementById('math-modal')
    if (modal) {
      const colors: Record<BuffType, string> = {
        amor: '#00ff00', odio: '#ff0000', cadeira: '#00d4ff',
      }
      modal.style.borderColor = colors[buff]
      modal.style.boxShadow = `0 0 50px ${colors[buff]}40`
    }

    syncUiState({ currentBuff: buff })
  }

  function getNextPhrase(): string {
    if (phraseQueueRef.current.length === 0) return 'A Matemática é implacável.'
    return phraseQueueRef.current.pop()!
  }

  // ── SPIN trigger ───────────────────────────────────────────────────────
  const triggerSpin = useCallback(() => {
    spinConsumedRef.current = false
    gameStateRef.current = 'SPIN'
    syncUiState({ gameState: 'SPIN' })
  }, [])

  const onSpinComplete = useCallback((buff: BuffType) => {
    if (spinConsumedRef.current) return
    spinConsumedRef.current = true
    initAudio()
    applyBuff(buff)
    startMathPhase()
  }, [])

  // ── Wave Advance ───────────────────────────────────────────────────────
  function advanceWave() {
    if (isWaveTransitioningRef.current) return
    isWaveTransitioningRef.current = true
    waitingForMathRef.current = false

    if (waveRef.current % 10 === 0) {
      lastRotatedWaveRef.current = waveRef.current
      if (stressModeRef.current) {
        triggerInstantBossTransition()
      } else {
        triggerCinematicRotation()
      }
    } else {
      startMathPhase()
    }
  }

  // ── Math Phase ─────────────────────────────────────────────────────────
  function startMathPhase() {
    if (waveRef.current > 0 && waveRef.current % 10 === 0 && lastRotatedWaveRef.current !== waveRef.current) {
      lastRotatedWaveRef.current = waveRef.current
      triggerCinematicRotation()
      return
    }

    gameStateRef.current = 'MATH'
    waveRef.current++
    isWaveTransitioningRef.current = false
    syncUiState({ gameState: 'MATH', wave: waveRef.current })

    // ← pass waveOffset for difficulty scaling
    const problem = generateMathProblem(waveRef.current, waveOffsetRef.current)
    currentProblemRef.current = problem
    const questionText = buildQuestionText(problem)
    const options = generateOptions(problem.answer)
    const phrase = getNextPhrase()

    timeLeftRef.current = TOTAL_TIME

    if (mathTimerRef.current) clearInterval(mathTimerRef.current)
    mathTimerRef.current = setInterval(() => {
      if (isPausedRef.current) return
      timeLeftRef.current -= 0.1

      syncUiState({ timeLeft: timeLeftRef.current })

      if (stressModeRef.current) {
        clearInterval(mathTimerRef.current!)
        resolveMath(true, false)
        return
      }
      if (timeLeftRef.current <= 0) {
        clearInterval(mathTimerRef.current!)
        resolveMath(false, true)
      }
    }, 100)

    syncUiState({
      mathQuestion: questionText,
      mathOptions: options,
      currentProblem: problem,
      phraseMessage: phrase,
      timeLeft: TOTAL_TIME,
    })
  }

  const resolveMath = useCallback((isCorrect: boolean, isTimeout: boolean) => {
    if (mathTimerRef.current) clearInterval(mathTimerRef.current)

    const problem = currentProblemRef.current
    statsRef.current.totalMath++

    if (isCorrect && !isTimeout) {
      totalCorrectRef.current++
    } else {
      totalWrongRef.current++
      if (problem) {
        statsRef.current.errors[problem.op] = (statsRef.current.errors[problem.op] || 0) + 1
      }
    }

    let earned = 0
    let newMultiplier = goldMultiplierRef.current

    if (isTimeout) {
      newMultiplier = 0.5
      earned = Math.floor(3 * 0.5 * 10)
      playSound('wrong')
      showFeedback('TEMPO ESGOTADO! (0.5x)', '#ff0000')
    } else if (isCorrect) {
      newMultiplier = 1.5
      earned = Math.floor(3 * 1.5 * 10)
      playSound('correct')
      showFeedback('LÓGICA CORRETA! (1.5x)', '#00ff00')
    } else {
      newMultiplier = 0.5
      earned = Math.floor(3 * 0.5 * 10)
      playSound('wrong')
      showFeedback('FALHA! (0.5x)', '#888888')
    }

    goldMultiplierRef.current = newMultiplier
    // Math bonus gold goes directly to bank (not a coin — it's a phase reward, not loot)
    goldRef.current += earned
    statsRef.current.totalGold += earned
    lastAnswerCorrectRef.current = isCorrect && !isTimeout

    const tipHtml = problem ? generateTip(problem) : ''

    gameStateRef.current = 'BUILD'
    syncUiState({
      gameState: 'BUILD',
      gold: goldRef.current,
      goldMultiplier: newMultiplier,
      totalCorrect: totalCorrectRef.current,
      totalWrong: totalWrongRef.current,
      stats: { ...statsRef.current },
      tipHtml,
    })

    if (aiModeRef.current) runAILogic()

    if (stressModeRef.current) {
      setTimeout(() => {
        if (gameStateRef.current === 'BUILD') startWaveCombat()
      }, 50)
    }
  }, [playSound])

  // ── Wave Combat ────────────────────────────────────────────────────────
  const startWaveCombat = useCallback(() => {
    gameStateRef.current = 'COMBAT'
    selectedExistingTowerRef.current = null
    selectedTowerIdxRef.current = -1
    isDraggingGhostRef.current = false
    movingTowerRef.current = null

    syncUiState({
      gameState: 'COMBAT',
      selectedTowerIdx: -1,
      selectedExistingTower: null,
    })

    if (aiModeRef.current) runAILogic()
    spawnEnemies()
  }, [])

  function spawnEnemies() {
    const wave = waveRef.current
    // base count — spawn RATE is multiplied via spawnMultiplierRef (enemies per frame)
    if (wave % 10 === 0) {
      totalEnemiesToSpawnRef.current = (10 + (wave - 1)) * 5
    } else {
      totalEnemiesToSpawnRef.current = 10 + wave
    }
    enemiesSpawnedRef.current    = 0
    spawnFrameCounterRef.current = 0
  }

  // ── Cinematic Rotation ─────────────────────────────────────────────────
  function triggerCinematicRotation() {
    gameStateRef.current = 'CINEMATIC'
    syncUiState({ gameState: 'CINEMATIC' })
    playSound('cinematic')

    const cParticles = []
    for (let i = 0; i < 150; i++) {
      cParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        angle: Math.random() * Math.PI * 2,
        dist: 300 + Math.random() * 200,
        speed: 4 + Math.random() * 8,
        char: ['+', '-', 'x', '÷', '0', '1', '9'][Math.floor(Math.random() * 7)],
      })
    }
    cinematicParticlesRef.current = cParticles

    setTimeout(() => {
      if (gameStateRef.current !== 'CINEMATIC') return

      const angle = Math.PI / 4
      const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2
      const cosA = Math.cos(angle), sinA = Math.sin(angle)

      advanceRotation()

      const MARGIN = 35
      towersRef.current.forEach(t => {
        const nx = cx + (t.x - cx) * cosA - (t.y - cy) * sinA
        const ny = cy + (t.x - cx) * sinA + (t.y - cy) * cosA
        t.x = Math.max(MARGIN, Math.min(CANVAS_WIDTH - MARGIN, nx))
        t.y = Math.max(MARGIN, Math.min(CANVAS_HEIGHT - MARGIN, ny))
      })

      cinematicParticlesRef.current = []
      triggerSpin()
    }, 1500)
  }

  function triggerInstantBossTransition() {
    const angle = Math.PI / 4
    const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2
    const cosA = Math.cos(angle), sinA = Math.sin(angle)

    advanceRotation()

    const MARGIN = 35
    towersRef.current.forEach(t => {
      const nx = cx + (t.x - cx) * cosA - (t.y - cy) * sinA
      const ny = cy + (t.x - cx) * sinA + (t.y - cy) * cosA
      t.x = Math.max(MARGIN, Math.min(CANVAS_WIDTH - MARGIN, nx))
      t.y = Math.max(MARGIN, Math.min(CANVAS_HEIGHT - MARGIN, ny))
    })

    const BUFF_LIST: BuffType[] = ['amor', 'odio', 'cadeira']
    const winner = BUFF_LIST[Math.floor(Math.random() * BUFF_LIST.length)]
    applyBuff(winner)
    startMathPhase()
  }

  // ── AI Logic ───────────────────────────────────────────────────────────
  function runAILogic() {
    if (!aiModeRef.current) return
    const state = gameStateRef.current
    if (state === 'MATH' || state === 'START' || state === 'SPIN' || isGameOverRef.current || state === 'CINEMATIC') return

    const wave  = waveRef.current
    const gold  = goldRef.current
    const towers = towersRef.current

    const baseTarget  = 12 + Math.floor(wave / 10) * 5
    const panicBonus  = statsRef.current.livesLost * 20
    const targetTowers = Math.min(baseTarget + panicBonus, 500)

    let builtSomething = false

    if (towers.length < targetTowers && gold >= 50) {
      let spot: { x: number; y: number } | null = null
      const mapCenterX = 400, mapCenterY = 300
      const searchRadius = Math.min(80 + towers.length * 8, 400)

      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2
        const r = (Math.random() * 0.8 + 0.2) * searchRadius
        const tx = mapCenterX + Math.cos(angle) * r
        const ty = mapCenterY + Math.sin(angle) * r
        if (tx >= 50 && tx <= 750 && ty >= 50 && ty <= 550 && checkCollision(tx, ty)) {
          spot = { x: tx, y: ty }; break
        }
      }
      if (!spot) {
        for (let i = 0; i < 20; i++) {
          const tx = 50 + Math.random() * 700, ty = 50 + Math.random() * 500
          if (checkCollision(tx, ty)) { spot = { x: tx, y: ty }; break }
        }
      }

      if (spot) {
        const posInBlock  = towers.length % 30
        const mustBeSniper = posInBlock >= 25

        let typeToBuild = 0
        if (mustBeSniper && goldRef.current >= TOWER_TYPES[3].cost) {
          typeToBuild = 3
        } else {
          const plusCount = towers.filter(t => t.type.symbol === '+').length
          const iceCount  = towers.filter(t => t.type.symbol === '-').length
          if (plusCount >= 6 && iceCount < Math.floor(plusCount / 6)) typeToBuild = 1
          else if (plusCount >= 10 && Math.random() > 0.8) typeToBuild = 2
        }

        const cost = TOWER_TYPES[typeToBuild].cost
        if (goldRef.current >= cost) {
          towers.push(new Tower(spot.x, spot.y, TOWER_TYPES[typeToBuild]))
          goldRef.current -= cost
          for (let i = 0; i < 5; i++) particlesRef.current.push(new Particle(spot.x, spot.y, '#00ff00'))
          playSound('correct')
          builtSomething = true
          syncUiState({ gold: goldRef.current })
        }
      }
    }

    if (towers.length >= 12 && !builtSomething) {
      const costs = towers.map(t => t.upgradeCost)
      const minCost = Math.min(...costs)
      const upgradable = towers.filter(t => t.upgradeCost === minCost)
      if (upgradable.length > 0) {
        const target = upgradable[Math.floor(Math.random() * upgradable.length)]
        if (goldRef.current >= target.upgradeCost) {
          goldRef.current -= target.upgradeCost
          target.upgrade(pts => { particlesRef.current.push(...pts) })
          playSound('upgrade')
          showFeedback('IA EVOLUIU TORRE!', '#00d4ff')
          syncUiState({ gold: goldRef.current, stats: { ...statsRef.current } })
        }
      }
    }

    const INEFFECTIVE_DIST = 350
    const rotatedPaths = getRotatedPaths()
    for (const tower of towers) {
      let minDist = Infinity
      for (const rp of rotatedPaths) {
        for (const pt of rp) {
          const d = Math.hypot(tower.x - pt.x, tower.y - pt.y)
          if (d < minDist) minDist = d
        }
      }
      if (minDist > INEFFECTIVE_DIST) {
        const rp = rotatedPaths[Math.floor(Math.random() * rotatedPaths.length)]
        const pt = rp[Math.floor(Math.random() * rp.length)]
        for (let i = 0; i < 25; i++) {
          const a = Math.random() * Math.PI * 2
          const r = 45 + Math.random() * 80
          const nx = Math.max(35, Math.min(CANVAS_WIDTH - 35, pt.x + Math.cos(a) * r))
          const ny = Math.max(35, Math.min(CANVAS_HEIGHT - 35, pt.y + Math.sin(a) * r))
          if (checkCollision(nx, ny, tower)) {
            tower.x = nx
            tower.y = ny
            showFeedback('IA REPOSICIONOU TORRE!', '#00d4ff')
            break
          }
        }
      }
    }
  }

  // ── Tower interactions ─────────────────────────────────────────────────
  const selectTowerBtn = useCallback((idx: number) => {
    cancelSelection()
    selectedTowerIdxRef.current = idx
    isDraggingGhostRef.current = true
    syncUiState({ selectedTowerIdx: idx })
  }, [])

  const cancelSelection = useCallback(() => {
    selectedTowerIdxRef.current = -1
    isDraggingGhostRef.current = false
    selectedExistingTowerRef.current = null
    movingTowerRef.current = null
    // Also clear any hero selection
    heroesRef.current.forEach(h => h.selected = false)
    selectedHeroRef.current = null
    syncUiState({ selectedTowerIdx: -1, selectedExistingTower: null, selectedHero: null })
  }, [])

  const upgradeSelectedTower = useCallback(() => {
    const t = selectedExistingTowerRef.current
    if (!t) return
    if (goldRef.current < t.upgradeCost) {
      showFeedback('FALTA OURO!', 'red'); return
    }
    goldRef.current -= t.upgradeCost
    t.upgrade(pts => { particlesRef.current.push(...pts) })
    playSound('upgrade')
    cancelSelection()
    syncUiState({ gold: goldRef.current })
  }, [playSound, cancelSelection])

  const moveSelectedTower = useCallback(() => {
    const t = selectedExistingTowerRef.current
    if (!t) return
    movingTowerRef.current = t
    selectedExistingTowerRef.current = null
    syncUiState({ selectedExistingTower: null })
  }, [])

  const sellSelectedTower = useCallback(() => {
    const t = selectedExistingTowerRef.current
    if (!t) return
    const refund = Math.floor(t.totalCost * 0.5)
    goldRef.current += refund
    towersRef.current = towersRef.current.filter(x => x !== t)
    playSound('hit')
    cancelSelection()
    syncUiState({ gold: goldRef.current })
  }, [playSound, cancelSelection])

  // ── Hero interactions ──────────────────────────────────────────────────
  /** Upgrade the currently selected hero. */
  const upgradeSelectedHero = useCallback(() => {
    const hero = selectedHeroRef.current
    if (!hero) return
    if (goldRef.current < hero.upgradeCost) {
      showFeedback('FALTA OURO!', 'red'); return
    }
    goldRef.current -= hero.upgradeCost
    hero.upgrade(pts => { particlesRef.current.push(...pts) })
    playSound('upgrade')
    showFeedback('HERÓI EVOLUÍDO!', '#00d4ff')
    // Force an object reference update so the panel re-renders
    syncUiState({ gold: goldRef.current, selectedHero: hero })
  }, [playSound])

  /** Deselect any currently selected hero. */
  const cancelHeroSelection = useCallback(() => {
    heroesRef.current.forEach(h => h.selected = false)
    selectedHeroRef.current = null
    syncUiState({ selectedHero: null })
  }, [])

  // ── System toggles ─────────────────────────────────────────────────────
  const toggleSpeed = useCallback(() => {
    const cur = gameSpeedRef.current
    const next = cur === 1 ? 3 : cur === 3 ? 6 : 1
    gameSpeedRef.current = next
    syncUiState({ gameSpeed: next })
  }, [])

  const toggleAIMode = useCallback(() => {
    aiModeRef.current = !aiModeRef.current
    syncUiState({ aiMode: aiModeRef.current })
  }, [])

  const toggleStressMode = useCallback(() => {
    stressModeRef.current = !stressModeRef.current
    if (stressModeRef.current) {
      if (!aiModeRef.current) { aiModeRef.current = true }
      gameSpeedRef.current = 6
      if (gameStateRef.current === 'MATH') resolveMath(true, false)
      if (gameStateRef.current === 'BUILD') startWaveCombat()
      if (gameStateRef.current === 'START') {
        // Auto-apply normal difficulty and start
        applyDifficulty(1)
      }
      syncUiState({ stressMode: true, aiMode: true, gameSpeed: 6 })
    } else {
      gameSpeedRef.current = 1
      syncUiState({ stressMode: false, gameSpeed: 1 })
    }
  }, [resolveMath, startWaveCombat, applyDifficulty])

  const toggleUiHidden = useCallback((hidden: boolean) => {
    syncUiState({ uiHidden: hidden })
  }, [])

  const setAudioMuted = useCallback((muted: boolean) => {
    syncUiState({ isAudioMuted: muted })
  }, [])

  const triggerSaveModal = useCallback(() => {
    isPausedRef.current = true
    syncUiState({ showSaveModal: true })
  }, [])

  const confirmSaveRound = useCallback((playerName: string) => {
    saveRound(playerName, waveRef.current, totalCorrectRef.current, statsRef.current.totalMath)
    initGame()
  }, [initGame])

  const cancelSaveModal = useCallback(() => {
    initGame()
  }, [initGame])

  /** @deprecated — kept for backward compat */
  const restartGame = useCallback(() => {
    triggerSaveModal()
  }, [triggerSaveModal])

  // ── Canvas Input Handlers ──────────────────────────────────────────────
  const updateMousePos = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (e.type === 'touchend') return

    const touch = (e as TouchEvent).touches?.[0]
    const clientX = touch ? touch.clientX : (e as MouseEvent).clientX
    const clientY = touch ? touch.clientY : (e as MouseEvent).clientY

    physicalXRef.current = clientX
    physicalYRef.current = clientY

    const scaleW = window.innerWidth / 820
    const scaleH = window.innerHeight / 620
    const scale  = Math.min(scaleW, scaleH, 1)

    mouseXRef.current = (clientX - rect.left) / scale
    const touchOffset = (e as TouchEvent).touches ? 40 : 0
    mouseYRef.current = (clientY - rect.top) / scale - touchOffset
  }, [canvasRef])

  /**
   * handlePress — fires on mousedown / touchstart.
   *
   * Priority order:
   *  1. Ghost drag (tower placement in progress)
   *  2. Hero click → select hero
   *  3. Tower click → show upgrade panel
   *  4. Empty space + hero selected → RTS MOVE command (mobile tap-to-move)
   *  5. Empty space → cancel all selections
   */
  const handlePress = useCallback(() => {
    const state = gameStateRef.current
    if (state !== 'BUILD' && state !== 'COMBAT') return

    // ── 1. Ghost tower drag ──────────────────────────────────────────────
    if (selectedTowerIdxRef.current > -1) { isDraggingGhostRef.current = true; return }
    if (movingTowerRef.current) return

    const mx = mouseXRef.current, my = mouseYRef.current

    // ── 2. Hero click (radius 22px) ──────────────────────────────────────
    let clickedHero: Hero | null = null
    for (const hero of heroesRef.current) {
      if (Math.hypot(hero.x - mx, hero.y - my) < 22) { clickedHero = hero; break }
    }
    if (clickedHero) {
      heroesRef.current.forEach(h => h.selected = false)
      clickedHero.selected = true
      selectedHeroRef.current = clickedHero
      // Deselect any tower
      selectedExistingTowerRef.current = null
      syncUiState({ selectedHero: clickedHero, selectedExistingTower: null })
      return
    }

    // ── 3. Tower click (radius 30px) ──────────────────────────────────────
    let clickedTower: Tower | null = null
    for (const t of towersRef.current) {
      if (Math.hypot(t.x - mx, t.y - my) < 30) { clickedTower = t; break }
    }
    if (clickedTower) {
      // Deselect heroes, select tower
      heroesRef.current.forEach(h => h.selected = false)
      selectedHeroRef.current = null
      selectedExistingTowerRef.current = clickedTower
      syncUiState({ selectedExistingTower: clickedTower, selectedHero: null })
      return
    }

    // ── 4. Empty ground + hero selected → MOVE COMMAND ───────────────────
    if (selectedHeroRef.current) {
      selectedHeroRef.current.moveTo(mx, my)
      // Hero stays selected (issue multiple commands without re-clicking)
      return
    }

    // ── 5. Cancel all ────────────────────────────────────────────────────
    cancelSelection()
  }, [cancelSelection])

  /** Desktop right-click → issue move command to selected (or first) hero. */
  const handleRightClick = useCallback((e: MouseEvent) => {
    e.preventDefault()
    const state = gameStateRef.current
    if (state !== 'BUILD' && state !== 'COMBAT') return
    updateMousePos(e)
    const mx = mouseXRef.current, my = mouseYRef.current
    const hero = selectedHeroRef.current ?? heroesRef.current[0] ?? null
    if (hero) hero.moveTo(mx, my)
  }, [updateMousePos])

  const handleRelease = useCallback(() => {
    const state = gameStateRef.current
    if (state !== 'BUILD' && state !== 'COMBAT') return

    const mx = mouseXRef.current, my = mouseYRef.current

    if (movingTowerRef.current) {
      const t = movingTowerRef.current
      if (checkCollision(mx, my, t)) {
        t.x = mx; t.y = my
        playSound('correct')
        movingTowerRef.current = null
        cancelSelection()
      } else {
        showFeedback('LOCAL BLOQUEADO!', 'orange')
        playSound('wrong')
      }
      return
    }

    if (selectedTowerIdxRef.current > -1 && isDraggingGhostRef.current) {
      const type = TOWER_TYPES[selectedTowerIdxRef.current]
      if (checkCollision(mx, my)) {
        if (goldRef.current >= type.cost) {
          towersRef.current.push(new Tower(mx, my, type))
          goldRef.current -= type.cost
          for (let i = 0; i < 5; i++) particlesRef.current.push(new Particle(mx, my, '#00ff00'))
          playSound('correct')
          syncUiState({ gold: goldRef.current })
        } else {
          showFeedback('OURO INSUFICIENTE!', 'red')
        }
      } else {
        showFeedback('LOCAL BLOQUEADO!', 'orange')
        playSound('wrong')
      }
      cancelSelection()
    }
  }, [playSound, cancelSelection])

  // ── Update ─────────────────────────────────────────────────────────────
  function update() {
    const state = gameStateRef.current

    if (state === 'CINEMATIC') {
      cinematicParticlesRef.current.forEach(p => { p.dist -= p.speed; p.angle += 0.05 })
      return
    }

    if (state === 'COMBAT') {
      // ── Spawn enemies (multiplied rate: N per frame) ──────────────────
      if (enemiesSpawnedRef.current < totalEnemiesToSpawnRef.current) {
        const mult = spawnMultiplierRef.current
        const toSpawn = Math.min(mult, totalEnemiesToSpawnRef.current - enemiesSpawnedRef.current)
        for (let s = 0; s < toSpawn; s++) {
          const baseHp  = 30
          const hpBonus = waveRef.current * (baseHp * 0.1)
          enemiesRef.current.push(new Enemy(baseHp + hpBonus, lastAnswerCorrectRef.current, waveRef.current))
          enemiesSpawnedRef.current++
        }
      }

      if (
        enemiesRef.current.length === 0 &&
        enemiesSpawnedRef.current >= totalEnemiesToSpawnRef.current &&
        totalEnemiesToSpawnRef.current > 0 &&
        !waitingForMathRef.current
      ) {
        waitingForMathRef.current = true

        if (waveRef.current % 10 === 0 && lastAnswerCorrectRef.current) {
          livesRef.current += 5
          statsRef.current.livesGained += 5
          showFeedback('WAVE PERFEITA! +5 VIDAS', '#00ff00')
          playSound('heal')
          syncUiState({ lives: livesRef.current, stats: { ...statsRef.current } })
        }

        setTimeout(() => {
          if (gameStateRef.current === 'COMBAT') {
            advanceWave()
          }
        }, 1000)
        return
      }
    }

    // ── Enemies ──────────────────────────────────────────────────────────
    enemiesRef.current.forEach(e => {
      e.update(() => {
        livesRef.current--
        statsRef.current.livesLost++
        syncUiState({ lives: livesRef.current, stats: { ...statsRef.current } })

        if (livesRef.current <= 0 && !isGameOverRef.current) {
          isGameOverRef.current = true
          if (mathTimerRef.current) clearInterval(mathTimerRef.current)
          triggerSaveModal()
        }
      })
    })
    enemiesRef.current = enemiesRef.current.filter(e => e.active)

    // ── Towers ───────────────────────────────────────────────────────────
    towersRef.current.forEach(t => {
      t.update(
        enemiesRef.current,
        bullet => { bulletsRef.current.push(bullet) },
        playSound,
        waveRef.current,
      )
    })

    // ── Heroes ───────────────────────────────────────────────────────────
    heroesRef.current.forEach(hero => {
      hero.update(
        enemiesRef.current,
        bullet => { bulletsRef.current.push(bullet) },
        playSound,
        waveRef.current,
      )
    })

    // ── Bullets → spawn Coins instead of direct gold ──────────────────
    const newParticles: Particle[] = []
    bulletsRef.current.forEach(b => {
      b.update(
        enemiesRef.current,
        (enemy, earned) => {
          // Physical coin spawns at enemy death position — must be looted by hero
          coinsRef.current.push(new Coin(enemy.x, enemy.y, earned))
        },
        goldMultiplierRef.current,
        newParticles,
        playSound,
      )
    })
    particlesRef.current.push(...newParticles)
    bulletsRef.current = bulletsRef.current.filter(b => b.active)

    // ── Coins (magnetic loot + lifespan) ─────────────────────────────────
    let goldChanged = false
    coinsRef.current.forEach(coin => {
      coin.update(heroesRef.current, value => {
        goldRef.current          += value
        statsRef.current.totalGold += value
        goldChanged = true
      })
    })
    coinsRef.current = coinsRef.current.filter(c => c.active)
    if (goldChanged) syncUiState({ gold: goldRef.current })

    particlesRef.current.forEach(p => p.update())
    particlesRef.current = particlesRef.current.filter(p => p.life > 0)
  }

  // ── Draw ───────────────────────────────────────────────────────────────
  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    if (gameStateRef.current === 'CINEMATIC') {
      drawCinematic(ctx)
      return
    }

    if (gameStateRef.current !== 'START' && gameStateRef.current !== 'SPIN') {
      drawPath(ctx)
    }

    const mx = mouseXRef.current, my = mouseYRef.current
    const movingTower  = movingTowerRef.current
    const selectedTower = selectedExistingTowerRef.current

    // Draw order: towers → enemies → heroes → bullets → particles → coins
    towersRef.current.forEach(t => {
      t.draw(ctx, mx, my, t === selectedTower, t === movingTower, checkCollision)
    })
    enemiesRef.current.forEach(e => e.draw(ctx))
    heroesRef.current.forEach(h => h.draw(ctx))
    bulletsRef.current.forEach(b => b.draw(ctx))
    particlesRef.current.forEach(p => p.draw(ctx))
    coinsRef.current.forEach(c => c.draw(ctx))

    if (selectedTowerIdxRef.current > -1 && isDraggingGhostRef.current) {
      const type = TOWER_TYPES[selectedTowerIdxRef.current]
      const canBuild = checkCollision(mx, my)
      const color = canBuild ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'
      ctx.beginPath()
      ctx.arc(mx, my, type.range, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.fill()
      ctx.lineWidth = 1; ctx.strokeStyle = color; ctx.stroke()
      ctx.fillStyle = canBuild ? type.color : '#550000'
      ctx.beginPath(); ctx.arc(mx, my, 16, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = goldRef.current >= type.cost ? '#fff' : '#f00'
      ctx.font = '12px Courier'
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(`$${type.cost}`, mx, my - 25)
    }
  }

  function drawPath(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const rotatedPaths = getRotatedPaths()

    ctx.shadowBlur = 30; ctx.shadowColor = '#8a2be2'
    ctx.strokeStyle = 'rgba(138, 43, 226, 0.15)'; ctx.lineWidth = 60
    rotatedPaths.forEach(rp => {
      ctx.beginPath(); ctx.moveTo(rp[0].x, rp[0].y)
      for (let i = 1; i < rp.length; i++) ctx.lineTo(rp[i].x, rp[i].y)
      ctx.stroke()
    })

    ctx.shadowBlur = 15; ctx.shadowColor = '#00ffff'
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'; ctx.lineWidth = 25
    rotatedPaths.forEach(rp => {
      ctx.beginPath(); ctx.moveTo(rp[0].x, rp[0].y)
      for (let i = 1; i < rp.length; i++) ctx.lineTo(rp[i].x, rp[i].y)
      ctx.stroke()
    })

    drawBlackHole(ctx, rotatedPaths[0][0].x, rotatedPaths[0][0].y, '#00ffff')
    drawBlackHole(ctx, rotatedPaths[0][rotatedPaths[0].length - 1].x, rotatedPaths[0][rotatedPaths[0].length - 1].y, '#ff0055')
    ctx.restore()
  }

  function drawBlackHole(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.shadowBlur = 20; ctx.shadowColor = color
    ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2)
    ctx.fillStyle = '#000'; ctx.fill()
    ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 35, Date.now() / 500, Math.PI * 1.5 + Date.now() / 500)
    ctx.stroke()
  }

  function drawCinematic(ctx: CanvasRenderingContext2D) {
    ctx.save()
    drawBlackHole(ctx, 400, 300, '#8a2be2')
    ctx.beginPath()
    ctx.arc(400, 300, 80, Date.now() / 200, Math.PI * 1.8 + Date.now() / 200)
    ctx.lineWidth = 5; ctx.strokeStyle = '#00ffff'; ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = '20px Courier'
    cinematicParticlesRef.current.forEach(p => {
      if (p.dist > 10) {
        const px = 400 + Math.cos(p.angle) * p.dist
        const py = 300 + Math.sin(p.angle) * p.dist
        ctx.globalAlpha = p.dist / 500
        ctx.fillText(p.char, px, py)
      }
    })
    ctx.restore()
  }

  // ── RAF Game Loop ──────────────────────────────────────────────────────
  useEffect(() => {
    generateMapPaths()
    let rafId: number

    function gameLoop() {
      try {
        if (!isPausedRef.current) {
          const state = gameStateRef.current
          if (state !== 'START' && state !== 'SPIN') {
            for (let i = 0; i < gameSpeedRef.current; i++) update()
            runAILogic()
          }
        }
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) draw(ctx)
        }
      } catch (err) { console.error('GameLoop Error:', err) }
      rafId = requestAnimationFrame(gameLoop)
    }

    rafId = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(rafId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize handler ─────────────────────────────────────────────────────
  useEffect(() => {
    function resizeCanvas() {
      const container = document.getElementById('game-container')
      if (!container) return
      const scaleW = window.innerWidth / 820
      const scaleH = window.innerHeight / 620
      const scale  = Math.min(scaleW, scaleH, 1)
      container.style.transform = `translate(-50%, -50%) scale(${scale})`
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    document.addEventListener('fullscreenchange', resizeCanvas)
    document.addEventListener('webkitfullscreenchange', resizeCanvas)
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      document.removeEventListener('fullscreenchange', resizeCanvas)
      document.removeEventListener('webkitfullscreenchange', resizeCanvas)
    }
  }, [])

  // ── Network handlers ───────────────────────────────────────────────────
  useEffect(() => {
    const onOffline = () => { isPausedRef.current = true }
    const onOnline  = () => { isPausedRef.current = false }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online',  onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online',  onOnline)
    }
  }, [])

  // ── Expose ─────────────────────────────────────────────────────────────
  return {
    uiState,
    feedbackRef,
    mouseXRef,
    mouseYRef,
    movingTowerRef,
    isDraggingGhostRef,
    // Game flow
    triggerSpin,
    onSpinComplete,
    startWaveCombat,
    resolveMath,
    restartGame,
    triggerSaveModal,
    confirmSaveRound,
    cancelSaveModal,
    // Tower management
    selectTowerBtn,
    cancelSelection,
    upgradeSelectedTower,
    moveSelectedTower,
    sellSelectedTower,
    // Hero management (NEW)
    applyDifficulty,
    upgradeSelectedHero,
    cancelHeroSelection,
    handleRightClick,
    // System
    toggleSpeed,
    toggleAIMode,
    toggleStressMode,
    toggleUiHidden,
    setAudioMuted,
    updateMousePos,
    handlePress,
    handleRelease,
    initAudio,
    isPausedRef,
  }
}
