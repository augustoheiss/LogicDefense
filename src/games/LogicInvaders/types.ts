// ============================================================
// LOGIC INVADERS — CORE TYPES  (v3 — Endless Roguelike)
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
  };
  nextId: number;
  keys: Set<string>;
  lastBulletTime: number;
  lastInvaderSpawn: number;
  spawnIntervalMs: number;    // dynamic — decreases on Difficulty Surge
  killCount: number;          // total kills this session (for natural wave advancement)
  lastWaveAdvanceTs: number;  // performance.now() timestamp of last natural wave advance
}
