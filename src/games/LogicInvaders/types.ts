// ============================================================
// LOGIC INVADERS — CORE TYPES  (v4 — Boss Mode + Overdrive)
// ============================================================

export interface Vector2 {
  x: number;
  y: number;
}

/** One floating answer bubble attached to an Invader */
export interface AnswerBubble {
  value: number;      // the number shown in the bubble
  isCorrect: boolean; // whether this is the right answer
  /** Relative angle offset (radians) from invader centre for orbit layout */
  angle: number;
}

export interface Invader {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  equation: string;           // e.g. "7 × 8"
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
  answers: AnswerBubble[];    // 3 floating answer choices
  lastShotTime: number;       // ms timestamp of last projectile fired
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  speed: number;
  isLaser: boolean;           // true while laser mode is active
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

/** 15 columns × 8 rows grid; true = voxel alive */
export type VoxelGrid = boolean[][];

/**
 * Three logical columns (0 = left, 1 = center, 2 = right).
 * Each spans 5 voxel columns of the 15-column grid.
 */
export interface VoxelBossState {
  /** 8-row × 15-col alive/dead voxel matrix  [row][col] */
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
  /** Total canvas width of the boss sprite */
  width: number;
  /** Total canvas height of the boss sprite */
  height: number;
  /** 0..1 entry animation progress (1 = fully on screen) */
  entryProgress: number;
  /** Unique ID for the current boss fight */
  id: number;
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
  score: number;
  wave: number;
  difficultyMultiplier: number; // increases on each "Difficulty Surge"
  invaders: Invader[];
  bullets: Bullet[];
  enemyProjectiles: EnemyProjectile[];
  particles: Particle[];
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
  killCount: number;          // total kills this session (for natural wave advancement)
  lastWaveAdvanceTs: number;  // performance.now() timestamp of last natural wave advance
  /** performance.now() timestamp after which the next boss is allowed to spawn.
   *  Set to now+500ms on boss defeat/escape to create a mandatory cooldown gap. */
  bossSpawnCooldownTs: number;
}
