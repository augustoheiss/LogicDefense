// ============================================================
// LOGIC INVADERS — CORE TYPES  (v5 — 6 Lenses of Basic Math + Boss Mode + Overdrive)
// ============================================================

export interface Vector2 {
  x: number;
  y: number;
}

/** The 6 intuitive ways of understanding basic math */
export type LensType =
  | 'massinha_soma'      // Compensation / rounding to 10s in addition (19 + 7 -> 20 + 6)
  | 'hack_japones'       // Constant difference subtraction without borrowing (32 - 19 -> 33 - 20)
  | 'dobro_metade_mult'  // Visual multiplication: Trick of 5, Trick of 9, Double-Halve, 5+1 blocks
  | 'corta_no_meio_div'  // Halving chain division & inverse multiplication mirror (36 ÷ 4 -> 18 ÷ 2)
  | 'peca_faltando'      // Bridge through 10 / missing addend (13 + [?] = 20)
  | 'alvo_multiplo';     // Flexible number sense: Target number on alien, basic expressions on bubbles

export type GameMode = 'discovery' | 'arcade';

/** Pedagogical insight event sent to the HUD Capsule & Session Grimoire */
export interface MathInsightEvent {
  equation: string;
  lensType?: LensType;
  lensTitle: string;
  shortHint: string;
  fullTip: string;
  isCorrect: boolean;
  streak: number;
  timestamp?: number;
}

/** Visual tactical beam fired from ship to a bubble on click or keys 1/2/3 */
export interface PlasmaBeamEffect {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  life: number; // 0..1
}

/** One floating answer bubble attached to an Invader */
export interface AnswerBubble {
  value: number;       // numeric identifier / answer
  label?: string;      // optional string shown in bubble (e.g. "10 + 6" in alvo_multiplo lens)
  isCorrect: boolean;  // whether this is the right answer
  /** Relative angle offset (radians) from invader centre for orbit layout */
  angle: number;
  /** 0 = Left [1], 1 = Center [2], 2 = Right [3] */
  slotIndex?: 0 | 1 | 2;
}

export interface Invader {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  equation: string;           // e.g. "19 + 7" or "🎯 ALVO: 16"
  answer: number;             // correct answer (ground truth)
  hp: number;                 // current HP  (max = 10)
  maxHp: number;              // always 10
  speed: number;              // current descent speed (px/frame)
  baseSpeed: number;
  speedMultiplier: number;
  flashRed: number;           // countdown frames for red-flash effect
  flashGreen: number;         // countdown for hit-confirm glow
  hit: boolean;
  color: string;
  wobble: number;
  answers: AnswerBubble[];    // 3 floating answer choices ([1] Left, [2] Center, [3] Right)
  lastShotTime: number;       // ms timestamp of last projectile fired
  // ── Pedagogical Lens Metadata ──
  lensType: LensType;
  lensTitle: string;
  shortHint: string;          // 1-line "Luz Guia" shown under equation pill
  fullTip: string;            // Full friendly explanation for HUD & Grimoire
  spawnTimeMs: number;        // performance.now() when spawned
  hintRevealed: boolean;      // true once hesitation scaffolding or wrong hit reveals the hint
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  speed: number;
  isLaser: boolean;           // true while laser mode is active
  isEmpowered?: boolean;
}

/** Enemy projectile — carries a score modifier */
export type ModifierType = 'buff' | 'debuff';

export interface ScoreModifier {
  type: ModifierType;
  factor: number;             // e.g. 2 for ×2 or /2
  label: string;              // e.g. "×3" or "/4"
}

export interface EnemyProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;                 // horizontal velocity (px/frame)
  vy: number;                 // vertical velocity (px/frame)
  modifier: ScoreModifier;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;               // 0..1, decreasing
  color: string;
  size: number;
  text?: string;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'saving';

// ─── Voxel Boss ──────────────────────────────────────────────

/** Variable-size grid; true = voxel alive */
export type VoxelGrid = boolean[][];

/**
 * Three logical columns (0 = left, 1 = center, 2 = right).
 * Each spans `voxelsPerLogicalCol` voxel columns.
 */
export interface VoxelBossState {
  /** Variable-size alive/dead voxel matrix [row][col] */
  voxels: VoxelGrid;
  /** Live voxel count per logical column (used for per-column HP display) */
  colVoxelCount: [number, number, number];
  /** Which logical column (0/1/2) is the correct answer column */
  correctColIdx: 0 | 1 | 2;
  /** Equation string shown at top, e.g. "8 × 7" */
  equation: string;
  /** Answer value shown above each logical column (index = logical column) */
  columnAnswers: [number, number, number];
  /** Visual phase based on remaining HP:  1 = full, 2 = ≤66%, 3 = ≤33% */
  phase: 1 | 2 | 3;
  /** Canvas position — centred horizontally, enters from top */
  x: number;
  y: number;
  /** Total canvas width of the boss sprite (fixed 420px) */
  width: number;
  /** Total canvas height of the boss sprite (fixed 168px) */
  height: number;
  /** 0..1 entry animation progress (1 = fully on screen) */
  entryProgress: number;
  /** Unique ID for the current boss fight */
  id: number;
  // ── Per-boss design fields (v2) ──────────────────────────
  /** Which of the 4 boss designs (0–3) this instance uses */
  bossIndex: number;
  /** Display name, e.g. "DREADNOUGHT" */
  bossName: string;
  /** Three column colors [col0, col1, col2] */
  palette: [string, string, string];
  /** Pixel width of one voxel cell (BOSS_W / cols) */
  voxelW: number;
  /** Pixel height of one voxel cell (BOSS_H / rows) */
  voxelH: number;
  /** Number of voxel rows in this boss's grid */
  rows: number;
  /** Number of voxel cols in this boss's grid (divisible by 3) */
  cols: number;
  /** Voxel columns per logical column (cols / 3) */
  voxelsPerLogicalCol: number;
  /**
   * Core block grid coordinate [row, col].
   * Empowered bullets hitting this cell trigger instant defeat.
   * Standard bullets are deflected.
   */
  coreBlock: { row: number; col: number };
  /**
   * Total alive voxels at spawn — used to compute the 85% defeat threshold.
   * Defeat triggers when alive count falls to ≤ 15% of this value.
   */
  startingVoxelCount: number;
  // ── Pedagogical metadata for Boss Equation ──
  lensTitle: string;
  shortHint: string;
  fullTip: string;
  hintRevealed: boolean;
}

/** One entry stored in localStorage leaderboard */
export interface LeaderboardEntry {
  name: string;
  score: number;
  wave: number;
  date: string;               // ISO date string
}

export interface GameState {
  status: GameStatus;
  mode: GameMode;
  score: number;
  wave: number;
  difficultyMultiplier: number; // increases gently, capped for basic math
  mathStreak: number;
  bestStreak: number;
  mathKillsTotal: number;
  masteredTips: string[];
  invaders: Invader[];
  bullets: Bullet[];
  enemyProjectiles: EnemyProjectile[];
  particles: Particle[];
  plasmaBeams: PlasmaBeamEffect[];
  player: {
    x: number;
    y: number;
    width: number;
    height: number;
    laserModeTimer: number;   // ms remaining in laser mode (0 = inactive)
    shakeTimer: number;       // frames remaining for screen-shake
    hitFlash: number;         // frames of player hit flash
    surgeFlashTimer: number;  // frames for full-screen red surge flash
    recoveryFlashTimer: number; // frames for full-screen cyan recovery flash
    // ── Overdrive ────────────────────────────────────────────
    isOverdrive: boolean;     // true while Overdrive is active
    overdriveTtl: number;     // ms remaining in Overdrive window
    lastOverdriveShot: number; // performance.now() of last auto-fire
  };
  /** Active boss fight, or undefined when not in a boss wave */
  boss?: VoxelBossState;
  nextId: number;
  keys: Set<string>;
  lastBulletTime: number;
  lastInvaderSpawn: number;
  spawnIntervalMs: number;    // dynamic — decreases on Difficulty Surge
  killCount: number;          // kills in current wave (for natural wave advancement)
  lastWaveAdvanceTs: number;  // performance.now() timestamp of last natural wave advance
  /** performance.now() timestamp after which the next boss is allowed to spawn. */
  bossSpawnCooldownTs: number;
  /** How many bosses are still queued in the current boss-wave gauntlet. */
  bossesRemainingInWave: number;
  /** Tracks the last wave number that triggered a boss gauntlet so it is never skipped */
  lastBossWaveTriggered: number;
}
