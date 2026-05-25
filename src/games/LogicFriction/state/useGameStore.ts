// ============================================================
// Logic Friction — Zustand Game Store
// Sprint 5: Tower Types + Levels, Core Level, Upgrade Mode,
//           Construction Site expiry, Math + Divine Buff
// ============================================================
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameStateSnapshot } from './leaderboard'
import {
  CORE_MAX_HP,
  CORE_UPGRADE_BASE_COST,
  PLAYER_MAX_HP,
  PLAYER_RESPAWN_TIME,
  WAVE_BASE_COUNT,
  WAVE_COUNT_SCALE,
  ENEMY_KILL_GOLD,
  TOWER_BLUEPRINTS,
  TOWER_BLUEPRINT_KEYS,
  STARTING_GOLD,
  MAX_TOWERS,
} from '../config/constants'
import type { MathZoneDir } from '../config/constants'
import { generateFrictionProblem, type FrictionProblem } from '../math/mathBridge'
import { enemyRegistry } from '../enemies/EnemyRegistry'

// ── Types ───────────────────────────────────────────────────────────────────────
export type GamePhase = 'MENU' | 'PLAYING' | 'WAVE_CLEAR' | 'GAME_OVER'
export type ActionMode = 'MOVE' | 'BUILD'

/** MOBA-style move target: static point or dynamic entity chase */
export type MoveTarget =
  | { type: 'point'; x: number; z: number }
  | { type: 'entity'; id: string }

/** Stored answer explanation for the Answer Log */
export interface ExplanationEntry {
  wave: number
  question: string
  explanation: string
  wasCorrect: boolean
}

export interface SiteData {
  id: string
  x: number
  z: number
  type: string   // Blueprint key (e.g. 'RAPID', 'HEAVY')
}

export interface TowerData {
  id: string
  x: number
  z: number
  type: string   // Blueprint key
  level: number  // Starts at 1, increments on upgrade
}

export interface SelectedEntity {
  id: string
  type: 'player' | 'tower'
}

// ── Math zone helpers ───────────────────────────────────────────────────────────
const DIRECTIONS: MathZoneDir[] = ['N', 'S', 'E', 'W']

function randomDirection(exclude?: MathZoneDir): MathZoneDir {
  const pool = exclude ? DIRECTIONS.filter(d => d !== exclude) : DIRECTIONS
  return pool[Math.floor(Math.random() * pool.length)]
}

export interface GameStore {
  // ── Game Phase ──
  phase: GamePhase

  // ── Central Core ──
  coreHp: number
  maxCoreHp: number
  coreLevel: number          // Core/Base level — caps tower upgrades

  // ── Player ──
  playerHp: number
  maxPlayerHp: number
  isPlayerDead: boolean

  // ── Economy ──
  gold: number

  // ── Wave System ──
  waveNumber: number
  enemiesAlive: number
  enemiesToSpawn: number
  totalWaveEnemies: number

  // ── Towers & Construction ──
  selectedBlueprint: string  // Key in TOWER_BLUEPRINTS
  isUpgradeMode: boolean     // Global toggle for upgrade interactions
  constructionSites: SiteData[]
  towers: TowerData[]

  // ── Math & Buff ──
  currentProblem: FrictionProblem | null
  isBuffActive: boolean
  mathAnswered: boolean

  // ── Answer Log ──
  explanationLog: ExplanationEntry[]
  mathZonePosition: MathZoneDir

  // ── Transparency Sensor ──
  insideMathZone: boolean

  // ── Contextual Selection ──
  selectedEntity: SelectedEntity | null

  // ── MOBA Movement ──
  actionMode: ActionMode
  moveTarget: MoveTarget | null

  // ── Settings ──
  isMenuOpen: boolean
  isCameraFree: boolean
  isPaused: boolean

  // ── Actions ──
  startGame: () => void
  nextWave: () => void
  gameOver: () => void

  // Core
  takeCoreDamage: (amount: number) => void
  upgradeCore: () => void

  // Player
  takePlayerDamage: (amount: number) => void

  // Enemies
  enemySpawned: () => void
  enemyKilled: () => void

  // Towers
  setSelectedBlueprint: (type: string) => void
  toggleUpgradeMode: () => void
  placeConstructionSite: (x: number, z: number) => void
  removeConstructionSite: (id: string) => void
  fundTower: (siteId: string) => void
  upgradeTower: (id: string) => void

  // Math
  submitAnswer: (isCorrect: boolean) => void
  setInsideMathZone: (inside: boolean) => void

  // MOBA Movement
  setActionMode: (mode: ActionMode) => void
  setMoveTarget: (target: MoveTarget | null) => void

  // ── Contextual Selection ──
  setSelectedEntity: (entity: SelectedEntity | null) => void

  // Settings
  toggleMenu: () => void
  toggleCameraFree: () => void
  togglePause: () => void
  setPaused: (v: boolean) => void

  // Reset
  loadGameState: (snapshot: GameStateSnapshot) => void
  reset: () => void
}

// ── Respawn Timer ───────────────────────────────────────────────────────────────
let respawnTimerId: ReturnType<typeof setTimeout> | null = null

function clearRespawnTimer() {
  if (respawnTimerId !== null) {
    clearTimeout(respawnTimerId)
    respawnTimerId = null
  }
}

// ── Auto-Wave Timer (4s delay between waves) ────────────────────────────────────
let autoWaveTimerId: ReturnType<typeof setTimeout> | null = null
const AUTO_WAVE_DELAY = 4000

function clearAutoWaveTimer() {
  if (autoWaveTimerId !== null) {
    clearTimeout(autoWaveTimerId)
    autoWaveTimerId = null
  }
}

// ── ID Generator ────────────────────────────────────────────────────────────────
let nextId = 0
function genId(prefix: string) {
  return `${prefix}_${++nextId}_${Date.now()}`
}

// ── Initial State ───────────────────────────────────────────────────────────────
const initialState = {
  phase: 'MENU' as GamePhase,
  coreHp: CORE_MAX_HP,
  maxCoreHp: CORE_MAX_HP,
  coreLevel: 1,
  playerHp: PLAYER_MAX_HP,
  maxPlayerHp: PLAYER_MAX_HP,
  isPlayerDead: false,
  gold: STARTING_GOLD,
  waveNumber: 0,
  enemiesAlive: 0,
  enemiesToSpawn: 0,
  totalWaveEnemies: 0,
  selectedBlueprint: TOWER_BLUEPRINT_KEYS[0],
  isUpgradeMode: false,
  constructionSites: [] as SiteData[],
  towers: [] as TowerData[],
  currentProblem: null as FrictionProblem | null,
  isBuffActive: false,
  mathAnswered: false,
  explanationLog: [] as ExplanationEntry[],
  mathZonePosition: 'N' as MathZoneDir,
  insideMathZone: false,
  selectedEntity: null as SelectedEntity | null,
  actionMode: 'MOVE' as ActionMode,
  moveTarget: null as MoveTarget | null,
  isMenuOpen: false,
  isCameraFree: false,
  isPaused: false,
}

// ── Store (persisted) ───────────────────────────────────────────────────────────
export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
  ...initialState,

  // ── Phase transitions ──
  startGame: () => {
    clearRespawnTimer()
    clearAutoWaveTimer()
    const dir = randomDirection()
    const problem = generateFrictionProblem(1)
    set({
      ...initialState,
      phase: 'PLAYING',
      waveNumber: 1,
      gold: STARTING_GOLD,
      enemiesToSpawn: WAVE_BASE_COUNT,
      totalWaveEnemies: WAVE_BASE_COUNT,
      currentProblem: problem,
      isBuffActive: false,
      mathAnswered: false,
      mathZonePosition: dir,
      insideMathZone: false,
      explanationLog: [],
    })
  },

  nextWave: () => {
    clearAutoWaveTimer()
    const wave = get().waveNumber + 1
    const count = WAVE_BASE_COUNT + (wave - 1) * WAVE_COUNT_SCALE
    const problem = generateFrictionProblem(wave)
    const newDir = randomDirection(get().mathZonePosition)
    set({
      waveNumber: wave,
      enemiesToSpawn: count,
      totalWaveEnemies: count,
      enemiesAlive: 0,
      phase: 'PLAYING',
      currentProblem: problem,
      isBuffActive: false,
      mathAnswered: false,
      mathZonePosition: newDir,
      insideMathZone: false,
      isUpgradeMode: false,
      selectedEntity: null,
    })
  },

  gameOver: () => {
    clearRespawnTimer()
    clearAutoWaveTimer()
    set({ phase: 'GAME_OVER' })
  },

  // ── Core damage ──
  takeCoreDamage: (amount) => {
    const newHp = Math.max(0, get().coreHp - amount)
    set({ coreHp: newHp })
    if (newHp <= 0) {
      clearRespawnTimer()
      set({ phase: 'GAME_OVER' })
    }
  },

  // ── Core Upgrade ──
  upgradeCore: () => {
    const state = get()
    const cost = state.coreLevel * CORE_UPGRADE_BASE_COST
    if (state.gold < cost) return
    set({
      gold: state.gold - cost,
      coreLevel: state.coreLevel + 1,
    })
  },

  // ── Player damage + death/respawn ──
  takePlayerDamage: (amount) => {
    if (get().isPlayerDead) return

    const newHp = Math.max(0, get().playerHp - amount)
    set({ playerHp: newHp })

    if (newHp <= 0) {
      set({ isPlayerDead: true })
      clearRespawnTimer()
      respawnTimerId = setTimeout(() => {
        const phase = get().phase
        if (phase === 'PLAYING' || phase === 'WAVE_CLEAR') {
          set({
            playerHp: get().maxPlayerHp,
            isPlayerDead: false,
          })
        }
        respawnTimerId = null
      }, PLAYER_RESPAWN_TIME * 1000)
    }
  },

  // ── Enemy lifecycle ──
  enemySpawned: () => set(s => ({
    enemiesAlive: s.enemiesAlive + 1,
    enemiesToSpawn: Math.max(0, s.enemiesToSpawn - 1),
  })),

  enemyKilled: () => {
    const newAlive = Math.max(0, get().enemiesAlive - 1)
    const newGold = get().gold + ENEMY_KILL_GOLD
    set({ enemiesAlive: newAlive, gold: newGold })

    // Double-check: the enemyRegistry is the ground truth for physically
    // alive enemies. The Zustand counter can desync from React component
    // lifecycle due to batching. Only transition to WAVE_CLEAR when BOTH
    // the counter AND the registry agree that everything is dead.
    if (newAlive <= 0 && get().enemiesToSpawn <= 0) {
      // Defer slightly to let the dying enemy unregister from the registry
      setTimeout(() => {
        const state = get()
        if (state.phase !== 'PLAYING') return // already transitioned
        if (state.enemiesToSpawn > 0) return  // more spawns queued

        // Registry check: if enemies are still physically on the board, retry later
        if (enemyRegistry.size > 0) {
          // Re-check in 500ms — the remaining enemies should die or failsafe
          setTimeout(() => {
            const s2 = get()
            if (s2.phase === 'PLAYING' && s2.enemiesAlive <= 0 && s2.enemiesToSpawn <= 0) {
              set({ phase: 'WAVE_CLEAR', isBuffActive: false, mathAnswered: false })
              clearAutoWaveTimer()
              autoWaveTimerId = setTimeout(() => {
                if (get().phase === 'WAVE_CLEAR') get().nextWave()
                autoWaveTimerId = null
              }, AUTO_WAVE_DELAY)
            }
          }, 500)
          return
        }

        set({ phase: 'WAVE_CLEAR', isBuffActive: false, mathAnswered: false })
        clearAutoWaveTimer()
        autoWaveTimerId = setTimeout(() => {
          if (get().phase === 'WAVE_CLEAR') get().nextWave()
          autoWaveTimerId = null
        }, AUTO_WAVE_DELAY)
      }, 50) // Small defer lets the dying Enemy's cleanup useEffect run
    }
  },

  // ── Tower Selection ──
  setSelectedBlueprint: (type) => set({ selectedBlueprint: type }),
  toggleUpgradeMode: () => set(s => ({ isUpgradeMode: !s.isUpgradeMode })),

  // ── Tower Construction ──
  placeConstructionSite: (x, z) => {
    const state = get()
    if (state.phase !== 'PLAYING' && state.phase !== 'WAVE_CLEAR') return
    if (state.constructionSites.length + state.towers.length >= MAX_TOWERS) return
    // If in upgrade mode, clicking the floor should NOT place a site
    if (state.isUpgradeMode) return

    const bp = TOWER_BLUEPRINTS[state.selectedBlueprint]
    if (!bp) return
    if (state.gold < bp.cost) return

    const site: SiteData = { id: genId('site'), x, z, type: state.selectedBlueprint }
    set({ constructionSites: [...state.constructionSites, site] })
  },

  removeConstructionSite: (id) => {
    set(s => ({
      constructionSites: s.constructionSites.filter(site => site.id !== id),
    }))
  },

  fundTower: (siteId) => {
    const state = get()
    const site = state.constructionSites.find(s => s.id === siteId)
    if (!site) return

    // Defensive: guarantee valid type with fallback
    const safeType = site.type && TOWER_BLUEPRINTS[site.type] ? site.type : 'RAPID'
    const bp = TOWER_BLUEPRINTS[safeType]
    if (state.gold < bp.cost) return

    // Defensive: guarantee valid coordinates (NaN protection)
    const safeX = Number.isFinite(site.x) ? site.x : 0
    const safeZ = Number.isFinite(site.z) ? site.z : 0

    const tower: TowerData = {
      id: genId('tower'),
      x: safeX,
      z: safeZ,
      type: safeType,
      level: 1, // STRICT: always integer 1
    }
    set({
      gold: state.gold - bp.cost,
      constructionSites: state.constructionSites.filter(s => s.id !== siteId),
      towers: [...state.towers, tower],
    })
  },

  // ── Tower Upgrade ──
  // Constraint: tower.level < coreLevel AND gold >= baseCost * tower.level
  upgradeTower: (id) => {
    const state = get()
    const tower = state.towers.find(t => t.id === id)
    if (!tower) return

    const bp = TOWER_BLUEPRINTS[tower.type]
    if (!bp) return

    // Level cap: tower cannot exceed core level
    if (tower.level >= state.coreLevel) return

    const cost = bp.cost * tower.level
    if (state.gold < cost) return

    set({
      gold: state.gold - cost,
      towers: state.towers.map(t =>
        t.id === id ? { ...t, level: t.level + 1 } : t
      ),
    })
  },

  // ── Math — Submit Answer ──
  submitAnswer: (isCorrect) => {
    if (get().mathAnswered) return
    set({ mathAnswered: true })

    // Push to answer log
    const state = get()
    if (state.currentProblem) {
      const entry: ExplanationEntry = {
        wave: state.waveNumber,
        question: state.currentProblem.expression,
        explanation: state.currentProblem.explanation,
        wasCorrect: isCorrect,
      }
      set({ explanationLog: [...state.explanationLog, entry] })
    }

    if (isCorrect) {
      set(s => ({
        coreHp: s.maxCoreHp,
        playerHp: s.maxPlayerHp,
        isPlayerDead: false,
        isBuffActive: true,
      }))
      clearRespawnTimer()
    }
  },

  // ── Transparency Sensor ──
  setInsideMathZone: (inside) => set({ insideMathZone: inside }),

  // ── MOBA Movement ──
  setActionMode: (mode) => set({ actionMode: mode }),
  setMoveTarget: (target) => set({ moveTarget: target }),
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),

  // ── Settings ──
  toggleMenu: () => set(s => ({ isMenuOpen: !s.isMenuOpen })),
  toggleCameraFree: () => set(s => ({ isCameraFree: !s.isCameraFree })),
  togglePause: () => set(s => ({ isPaused: !s.isPaused })),
  setPaused: (v) => set({ isPaused: v }),

  // ── Load from save slot ──
  loadGameState: (snapshot) => {
    clearRespawnTimer()
    clearAutoWaveTimer()
    const dir = randomDirection()
    const problem = generateFrictionProblem(snapshot.waveNumber)
    set({
      ...initialState,
      phase: 'PLAYING',
      waveNumber: snapshot.waveNumber,
      gold: snapshot.gold,
      coreHp: snapshot.coreHp,
      maxCoreHp: snapshot.maxCoreHp,
      coreLevel: snapshot.coreLevel,
      towers: snapshot.towers,
      constructionSites: snapshot.constructionSites,
      enemiesToSpawn: WAVE_BASE_COUNT + (snapshot.waveNumber - 1) * WAVE_COUNT_SCALE,
      totalWaveEnemies: WAVE_BASE_COUNT + (snapshot.waveNumber - 1) * WAVE_COUNT_SCALE,
      currentProblem: problem,
      mathZonePosition: dir,
      isPaused: false,
      explanationLog: [],
    })
  },

  // ── Full reset ──
  reset: () => {
    clearRespawnTimer()
    clearAutoWaveTimer()
    set(initialState)
  },
}),
    {
      name: 'logicFriction_saveData',
      partialize: (state) => ({
        waveNumber: state.waveNumber,
        gold: state.gold,
        coreHp: state.coreHp,
        maxCoreHp: state.maxCoreHp,
        coreLevel: state.coreLevel,
        towers: state.towers,
        constructionSites: state.constructionSites,
        actionMode: state.actionMode,
        selectedBlueprint: state.selectedBlueprint,
      }),
    }
  )
)
