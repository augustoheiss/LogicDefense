// ============================================================
// LOGIC INVADERS — GAME ENGINE HOOK  (v4 — Boss Mode + Overdrive)
// ─ No Game Over from invaders reaching bottom → Difficulty Surge
// ─ Enemy projectiles with score multiplier modifiers (×2…÷8)
// ─ Laser auto-fires, all bubbles neutral cyan
// ─ Screen-shake, starfield, HP bars
// ─ Boss Mode: VoxelBoss + column-gated collision + Overdrive
// ============================================================
import { useRef, useEffect, useCallback } from 'react';
import type { GameState, Invader, AnswerBubble, ScoreModifier, VoxelBossState } from '../types';
import { generateEquation, generateAnswerBubbles } from '../utils/mathEngine';
import { formatScore } from '../utils/formatScore';
import {
  createBoss, hitBossVoxel, isBossDefeated,
  getBossColumnBounds, LOGICAL_COLS, BOSS_NAMES,
} from '../utils/VoxelBoss';

// ─── Constants ───────────────────────────────────────────────
const CANVAS_W = 700;
const CANVAS_H = 540;
const PLAYER_W = 52;
const PLAYER_H = 36;
const PLAYER_Y = CANVAS_H - 70;
const PLAYER_SPEED = 4.5;
const BULLET_SPEED = 10;
const BULLET_COOLDOWN_MS = 200;
const INVADER_W = 100;
const INVADER_H = 58;
const INVADER_MAX_HP = 10;
const BASE_INVADER_SPEED = 0.45;
const MAX_INVADERS = 5;
const INITIAL_SPAWN_INTERVAL_MS = 2400;
const MIN_SPAWN_INTERVAL_MS = 800;
const SPAWN_DECREASE_PER_SURGE = 200;      // reduce spawn interval on each surge
const RECOVERY_PER_KILL     = 0.12;        // difficulty drop per Math Kill
const RECOVERY_SPAWN_RESTORE = 120;        // ms restored to spawn interval per kill
const RECOVERY_FLASH_FRAMES = 22;          // frames for cyan recovery flash
const SPEED_LERP_RATE        = 0.04;       // per-frame lerp toward target speed (smooth)
// ── Natural Wave Progression ────────────────────────────────────
const WAVE_ADVANCE_KILLS = 12;             // destroy this many invaders → natural wave up
const WAVE_ADVANCE_MS    = 28_000;        // OR survive this many ms → natural wave up
const NATURAL_WAVE_DIFFICULTY_STEP = 0.15; // lighter than surge (+0.25)
const NATURAL_WAVE_SPAWN_RESTORE   = 80;  // partial spawn interval restore on natural advance
const WAVE_MILESTONE_FLASH_FRAMES  = 30;  // frames for the teal milestone flash
const WRONG_BUBBLE_MULTIPLIER = 1.35;
const LASER_MODE_MS = 5000;
const LASER_DAMAGE_PER_FRAME = 100;
const BUBBLE_ORBIT_R = 80;   // distance from invader centre → bubbles orbit further apart
const BUBBLE_HIT_R   = 40;   // visual + collision radius (2× original 20px)
const SHAKE_FRAMES = 22;
const ENEMY_PROJECTILE_SPEED = 3.5;
const ENEMY_SHOOT_COOLDOWN_MS = 4000;      // each invader shoots every ~4s
const PLAYER_HIT_FLASH_FRAMES = 20;
const PLAYER_HITBOX_R = 16;               // radius for projectile collision
const SURGE_FLASH_FRAMES = 28;            // frames for red surge flash overlay

// ── Boss Mode constants ──────────────────────────────────────────
const BOSS_SPAWN_EVERY_N_WAVES    = 5;     // boss gauntlet on wave 5, 10, 15…
const BOSS_GAUNTLET_COUNT         = 4;     // sequential bosses per gauntlet wave
const BOSS_ENTRY_SPEED            = 1.2;  // px/frame during slide-in
const BOSS_ENTRY_Y_TARGET         = 30;   // final top-of-boss canvas Y
const BOSS_VOXEL_SCORE            = 25;   // score per voxel destroyed
const BOSS_INTER_SPAWN_COOLDOWN_MS = 2000; // ms between sequential boss spawns
const BOSS_DEFEAT_BONUS = 2000;           // lump-sum when boss dies
// ── Overdrive constants ─────────────────────────────────────────
const OVERDRIVE_DURATION_MS      = 5_000;
const OVERDRIVE_SHOOT_INTERVAL_MS = 80;   // ~12.5 shots/sec  
const OVERDRIVE_SPEED_MULT        = 1.6;
// 5-way spread in degrees (converts to radians inside fireBulletOverdrive)
const OVERDRIVE_SPREAD_ANGLES = [-25, -12, 0, 12, 25] as const;

// Score modifier pool: 7 buffs + 7 debuffs + 2 debuffs = 16 total
const MODIFIER_POOL: ScoreModifier[] = [
  { type: 'buff',   factor: 2, label: '×2' },
  { type: 'buff',   factor: 3, label: '×3' },
  { type: 'buff',   factor: 4, label: '×4' },
  { type: 'buff',   factor: 5, label: '×5' },
  { type: 'buff',   factor: 6, label: '×6' },
  { type: 'buff',   factor: 7, label: '×7' },
  { type: 'buff',   factor: 8, label: '×8' },
  { type: 'debuff', factor: 2, label: '/2' },
  { type: 'debuff', factor: 3, label: '/3' },
  { type: 'debuff', factor: 4, label: '/4' },
  { type: 'debuff', factor: 5, label: '/5' },
  { type: 'debuff', factor: 6, label: '/6' },
  { type: 'debuff', factor: 7, label: '/7' },
  { type: 'debuff', factor: 8, label: '/8' },
];

const INVADER_COLORS = ['#00d4ff', '#ff00ff', '#00ff88', '#ffaa00', '#ff4488', '#aa88ff'];

// ─── Initial State ────────────────────────────────────────────
function makeInitialState(): GameState {
  return {
    status: 'idle',
    score: 0,
    wave: 1,
    difficultyMultiplier: 1,
    invaders: [],
    bullets: [],
    enemyProjectiles: [],
    particles: [],
    player: {
      x: CANVAS_W / 2 - PLAYER_W / 2,
      y: PLAYER_Y,
      width: PLAYER_W,
      height: PLAYER_H,
      laserModeTimer: 0,
      shakeTimer: 0,
      hitFlash: 0,
      surgeFlashTimer: 0,
      recoveryFlashTimer: 0,
      isOverdrive: false,
      overdriveTtl: 0,
      lastOverdriveShot: 0,
    },
    boss: undefined,
    nextId: 1,
    keys: new Set(),
    lastBulletTime: 0,
    lastInvaderSpawn: 0,
    spawnIntervalMs: INITIAL_SPAWN_INTERVAL_MS,
    killCount: 0,
    lastWaveAdvanceTs: 0,       // will be set when game starts
    bossSpawnCooldownTs: 0,    // 0 = no cooldown active
    bossesRemainingInWave: 0,  // 0 = no active gauntlet
  };
}

// ─── Particle helpers ─────────────────────────────────────────
function spawnExplosion(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
  scoreText?: string
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 4;
    state.particles.push({
      id: state.nextId++, x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, color,
      size: 3 + Math.random() * 6,
    });
  }
  if (scoreText) {
    state.particles.push({
      id: state.nextId++, x, y: y - 24,
      vx: 0, vy: -1.5, life: 1,
      color: '#ffff00', size: 18, text: scoreText,
    });
  }
}

function spawnWrongEffect(state: GameState, x: number, y: number): void {
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10;
    state.particles.push({
      id: state.nextId++, x, y,
      vx: Math.cos(angle) * 2.5, vy: Math.sin(angle) * 2.5,
      life: 1, color: '#ff2244', size: 5,
    });
  }
}

function spawnModifierHitEffect(state: GameState, x: number, y: number, mod: ScoreModifier): void {
  const color = mod.type === 'buff' ? '#00ff88' : '#ff4444';
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12;
    state.particles.push({
      id: state.nextId++, x, y,
      vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3,
      life: 1, color, size: 5,
    });
  }
  // Floating text feedback
  state.particles.push({
    id: state.nextId++, x, y: y - 28,
    vx: 0, vy: -2, life: 1,
    color, size: 20, text: mod.label,
  });
}

// ─── Natural Wave Progression ────────────────────────────────
function triggerNaturalWave(state: GameState, now: number): void {
  // Advance wave (uncapped)
  state.wave += 1;

  // Lighter difficulty step than a Surge — skill still matters, but time does too
  state.difficultyMultiplier = parseFloat(
    (state.difficultyMultiplier + NATURAL_WAVE_DIFFICULTY_STEP).toFixed(2)
  );

  // Tighten spawn interval (less aggressive than a Surge)
  state.spawnIntervalMs = Math.max(
    MIN_SPAWN_INTERVAL_MS,
    state.spawnIntervalMs - NATURAL_WAVE_SPAWN_RESTORE
  );

  // Reset progression counters
  state.killCount = 0;
  state.lastWaveAdvanceTs = now;

  // ── Milestone visual: teal flash + "ONDA X INICIADA" particle banner ──
  state.player.recoveryFlashTimer = WAVE_MILESTONE_FLASH_FRAMES;

  // Big centred wave title
  state.particles.push({
    id: state.nextId++,
    x: CANVAS_W / 2, y: CANVAS_H / 2 - 20,
    vx: 0, vy: -1.0, life: 1,
    color: '#00ffcc', size: 22,
    text: `▶ ONDA ${state.wave} INICIADA`,
  });
  // Sub-label with new difficulty
  state.particles.push({
    id: state.nextId++,
    x: CANVAS_W / 2, y: CANVAS_H / 2 + 14,
    vx: 0, vy: -0.7, life: 1,
    color: '#aaffee', size: 13,
    text: `DIFICULDADE x${state.difficultyMultiplier.toFixed(2)}`,
  });
}

// ─── Difficulty Surge (invader escaped) ──────────────────────
function triggerDifficultySurge(state: GameState): void {
  state.difficultyMultiplier = parseFloat((state.difficultyMultiplier + 0.25).toFixed(2));
  state.wave = Math.min(12, state.wave + 1);
  state.spawnIntervalMs = Math.max(
    MIN_SPAWN_INTERVAL_MS,
    state.spawnIntervalMs - SPAWN_DECREASE_PER_SURGE
  );
  state.score = Math.max(0, state.score - 50);
  state.player.surgeFlashTimer = SURGE_FLASH_FRAMES;
  state.player.shakeTimer = 14;

  // Floating punishment text
  for (let i = 0; i < 3; i++) {
    state.particles.push({
      id: state.nextId++,
      x: CANVAS_W / 2 + (i - 1) * 18,
      y: CANVAS_H - 30,
      vx: (i - 1) * 0.4,
      vy: -2.2,
      life: 1,
      color: '#ff4400',
      size: i === 1 ? 18 : 13,
      text: i === 1 ? '⚠️ CAOS AUMENTOU!' : undefined,
    });
  }
  state.particles.push({
    id: state.nextId++,
    x: CANVAS_W / 2,
    y: CANVAS_H - 55,
    vx: 0, vy: -1.6, life: 1,
    color: '#ffaa00', size: 13,
    text: `DIFICULDADE x${state.difficultyMultiplier.toFixed(2)}`,
  });
}

// ─── Difficulty Recovery (Math Kill) ─────────────────────────
function triggerDifficultyRecovery(state: GameState): void {
  const prev = state.difficultyMultiplier;
  state.difficultyMultiplier = parseFloat(
    Math.max(1.0, state.difficultyMultiplier - RECOVERY_PER_KILL).toFixed(2)
  );
  // Restore spawn interval proportionally (capped at INITIAL)
  state.spawnIntervalMs = Math.min(
    INITIAL_SPAWN_INTERVAL_MS,
    state.spawnIntervalMs + RECOVERY_SPAWN_RESTORE
  );

  // Only trigger the visual flash when there is a real reduction
  if (state.difficultyMultiplier < prev) {
    state.player.recoveryFlashTimer = RECOVERY_FLASH_FRAMES;
    // Floating positive feedback text
    const isStabilised = state.difficultyMultiplier <= 1.0;
    state.particles.push({
      id: state.nextId++,
      x: CANVAS_W / 2,
      y: CANVAS_H - 40,
      vx: 0, vy: -2.0, life: 1,
      color: isStabilised ? '#00ff88' : '#00d4ff',
      size: 17,
      text: isStabilised ? '✅ ESTABILIZADO!' : '▼ VELOCIDADE REDUZIDA',
    });
    state.particles.push({
      id: state.nextId++,
      x: CANVAS_W / 2,
      y: CANVAS_H - 62,
      vx: 0, vy: -1.4, life: 1,
      color: '#aaffff', size: 12,
      text: `DIFICULDADE x${state.difficultyMultiplier.toFixed(2)}`,
    });
  }
}

// ─── Enemy projectile spawner ────────────────────────────────
function spawnEnemyProjectile(state: GameState, inv: Invader): void {
  const mod = MODIFIER_POOL[Math.floor(Math.random() * MODIFIER_POOL.length)];
  // Random trajectory: straight, slight left, slight right
  const angle = (Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 4);
  state.enemyProjectiles.push({
    id: state.nextId++,
    x: inv.x + inv.width / 2,
    y: inv.y + inv.height,
    vx: Math.cos(angle) * ENEMY_PROJECTILE_SPEED,
    vy: Math.sin(angle) * ENEMY_PROJECTILE_SPEED,
    modifier: mod,
  });
}

// ─── Invader spawner ──────────────────────────────────────────
function spawnInvader(state: GameState): void {
  if (state.invaders.length >= MAX_INVADERS) return;

  // Pass difficultyMultiplier so math gets harder with each surge
  const { display, answer } = generateEquation(state.wave, state.difficultyMultiplier);
  const color = INVADER_COLORS[Math.floor(Math.random() * INVADER_COLORS.length)];
  // Speed scales with wave & difficulty but is hard-capped so late-game stays humanly playable.
  // Math difficulty (generateEquation) grows uncapped — only physical speed is limited here.
  const speedBonus = Math.min(1.2, (state.wave - 1) * 0.02 + (state.difficultyMultiplier - 1) * 0.06);
  const baseSpeed = BASE_INVADER_SPEED + speedBonus;
  const answers = generateAnswerBubbles(answer);

  const existingXs = state.invaders.map((inv) => inv.x);
  let x: number;
  let attempts = 0;
  do {
    x = 20 + Math.random() * (CANVAS_W - INVADER_W - 40);
    attempts++;
  } while (existingXs.some((ex) => Math.abs(ex - x) < INVADER_W + 20) && attempts < 20);

  state.invaders.push({
    id: state.nextId++,
    x, y: -INVADER_H - 10,
    width: INVADER_W, height: INVADER_H,
    equation: display, answer,
    hp: INVADER_MAX_HP, maxHp: INVADER_MAX_HP,
    speed: baseSpeed, baseSpeed,
    speedMultiplier: 1,
    flashRed: 0, flashGreen: 0,
    hit: false, color,
    wobble: Math.random() * Math.PI * 2,
    answers,
    lastShotTime: performance.now() + Math.random() * 2000, // stagger initial shots
  });
}

// ─── Destroy invader ─────────────────────────────────────────
function destroyInvader(
  state: GameState,
  ii: number,
  isMathKill: boolean,
  laserKill: boolean
): void {
  const inv = state.invaders[ii];
  const cx = inv.x + inv.width / 2;
  const cy = inv.y + inv.height / 2;

  const bonus = isMathKill ? 300 : laserKill ? 150 : 100;
  const count = isMathKill ? 36 : laserKill ? 24 : 18;
  spawnExplosion(state, cx, cy, inv.color, count, `+${bonus}`);
  state.score += bonus + Math.floor(state.wave * 10);
  state.invaders.splice(ii, 1);
  state.killCount++;  // ── natural progression counter

  if (isMathKill) {
    state.player.laserModeTimer = LASER_MODE_MS;
    state.player.shakeTimer = SHAKE_FRAMES;
    // White starburst explosion
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      state.particles.push({
        id: state.nextId++, x: cx, y: cy,
        vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6,
        life: 1, color: '#ffffff', size: 8,
      });
    }
    // ── Dynamic Difficulty Recovery: correct answer rewards the player ──
    triggerDifficultyRecovery(state);
  }

  // Wave is exclusively owned by the surge system.
}

// ─── Bubble position helper ───────────────────────────────────
function bubblePos(inv: Invader, bubble: AnswerBubble): { bx: number; by: number } {
  const cx = inv.x + inv.width / 2;
  const cy = inv.y + inv.height * 0.65;
  return {
    bx: cx + Math.cos(bubble.angle) * BUBBLE_ORBIT_R,
    by: cy + Math.sin(bubble.angle) * BUBBLE_ORBIT_R,
  };
}

// ─── Boss helper functions ────────────────────────────────────

/** Small voxel-sized explosion when a single boss voxel is destroyed */
function spawnBossVoxelExplosion(state: GameState, vx: number, vy: number, color: string): void {
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
    const speed = 1.5 + Math.random() * 3;
    state.particles.push({
      id: state.nextId++, x: vx, y: vy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, color, size: 3 + Math.random() * 4,
    });
  }
}

/** Dramatic multi-burst explosion when the whole boss is defeated */
function spawnBossDestroyedExplosion(state: GameState, cx: number, cy: number): void {
  const colors = ['#ff4400', '#ffaa00', '#ffdd00', '#ff00ff', '#00ffff', '#ffffff'];
  for (let ring = 0; ring < 5; ring++) {
    const r = colors[ring % colors.length];
    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28;
      const speed = 2 + ring * 1.2 + Math.random() * 2;
      state.particles.push({
        id: state.nextId++,
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, color: r, size: 4 + Math.random() * 8,
      });
    }
  }
  // Giant score text
  state.particles.push({
    id: state.nextId++, x: cx, y: cy - 30,
    vx: 0, vy: -2.5, life: 1,
    color: '#ffdd00', size: 30, text: `+${BOSS_DEFEAT_BONUS}`,
  });
  state.particles.push({
    id: state.nextId++, x: cx, y: cy + 10,
    vx: 0, vy: -1.5, life: 1,
    color: '#ffffff', size: 18, text: '👾 BOSS DERROTADO!',
  });
}

/** Activate Overdrive on the player ship */
function triggerOverdrive(state: GameState): void {
  state.player.isOverdrive = true;
  state.player.overdriveTtl = OVERDRIVE_DURATION_MS;
  state.player.lastOverdriveShot = 0;
  state.player.shakeTimer = SHAKE_FRAMES;
  // Flash + notification particle
  state.player.recoveryFlashTimer = 25;
  state.particles.push({
    id: state.nextId++,
    x: CANVAS_W / 2, y: CANVAS_H / 2,
    vx: 0, vy: -1.8, life: 1,
    color: '#ffdd00', size: 24, text: '⚡ OVERDRIVE!',
  });
  // Starburst around player
  const px = state.player.x + PLAYER_W / 2;
  const py = state.player.y;
  for (let i = 0; i < 20; i++) {
    const angle = (Math.PI * 2 * i) / 20;
    state.particles.push({
      id: state.nextId++, x: px, y: py,
      vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5,
      life: 1, color: '#ffdd00', size: 7,
    });
  }
}

/** Entry spark effect when boss first appears (called each frame during slide-in) */
function spawnBossEntryParticles(state: GameState, bossX: number, bossY: number, bossW: number): void {
  if (Math.random() > 0.4) return; // only some frames
  const x = bossX + Math.random() * bossW;
  const y = bossY + Math.random() * 20;
  const colors = ['#ff4400', '#ff8800', '#ffdd00', '#ff00ff'];
  state.particles.push({
    id: state.nextId++, x, y,
    vx: (Math.random() - 0.5) * 3,
    vy: -1 - Math.random() * 3,
    life: 0.8, color: colors[Math.floor(Math.random() * colors.length)],
    size: 3 + Math.random() * 5,
  });
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────
// Three-layer parallax starfield
interface StarPoint { x: number; y: number; r: number; speed: number; opacity: number; layer: 0|1|2; twinkle: number; twinkleDir: number }
let starfield: StarPoint[] = [];
function ensureStarfield(): void {
  if (starfield.length > 0) return;
  // Layer 0: distant tiny dots
  for (let i = 0; i < 80; i++) {
    starfield.push({ x: Math.random()*CANVAS_W, y: Math.random()*CANVAS_H, r: 0.4+Math.random()*0.5, speed: 0.08+Math.random()*0.12, opacity: 0.25+Math.random()*0.35, layer: 0, twinkle: Math.random(), twinkleDir: Math.random()>0.5?1:-1 });
  }
  // Layer 1: mid stars
  for (let i = 0; i < 45; i++) {
    starfield.push({ x: Math.random()*CANVAS_W, y: Math.random()*CANVAS_H, r: 0.8+Math.random()*1.0, speed: 0.22+Math.random()*0.28, opacity: 0.4+Math.random()*0.4, layer: 1, twinkle: Math.random(), twinkleDir: Math.random()>0.5?1:-1 });
  }
  // Layer 2: bright foreground sparkle stars
  for (let i = 0; i < 18; i++) {
    starfield.push({ x: Math.random()*CANVAS_W, y: Math.random()*CANVAS_H, r: 1.5+Math.random()*2.0, speed: 0.5+Math.random()*0.7, opacity: 0.7+Math.random()*0.3, layer: 2, twinkle: Math.random(), twinkleDir: Math.random()>0.5?1:-1 });
  }
}

// ── Pixel-art voxel invader templates (11 cols × 8 rows, symmetric) ──────────
// Each row is defined Left→Centre (6 cols), then mirrored right.
// 0 = empty, 1 = body block
const INVADER_PATTERNS: number[][][] = [
  // Type 0 — Classic Crab
  [
    [0,0,0,1,0,0],
    [0,0,1,1,1,0],
    [0,1,1,1,1,1],
    [1,1,0,1,0,1],
    [1,1,1,1,1,1],
    [0,1,0,0,0,1],
    [1,0,0,0,0,0],
    [0,1,0,0,0,0],
  ],
  // Type 1 — Squid
  [
    [0,0,0,0,1,0],
    [0,0,0,1,1,0],
    [0,0,1,1,1,1],
    [0,1,1,0,1,1],
    [1,1,1,1,1,1],
    [1,0,1,1,1,0],
    [1,0,1,0,0,0],
    [0,0,0,1,1,0],
  ],
  // Type 2 — Octopus / UFO
  [
    [0,0,1,1,0,0],
    [0,1,1,1,1,0],
    [1,1,1,1,1,1],
    [1,0,1,1,0,1],
    [1,1,1,1,1,1],
    [0,1,0,0,1,0],
    [1,0,1,1,0,1],
    [0,1,0,0,0,0],
  ],
];

/** Draw one pixel/voxel block with full neon glow */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number,
  bw: number, bh: number,
  color: string,
  glowIntensity: number
): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = glowIntensity;
  ctx.fillStyle = color;
  ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
  // Highlight top-left corner for pseudo-3D voxel feel
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(bx + 1, by + 1, bw - 2, 2);
  ctx.fillRect(bx + 1, by + 1, 2, bh - 2);
}

/** Render a full voxel invader at position with animation frame */
function drawVoxelInvader(
  ctx: CanvasRenderingContext2D,
  inv: Invader,
  wobbleX: number,
  animFrame: number,
  mainColor: string,
  flashingRed: boolean,
  flashingGreen: boolean,
): void {
  const type = inv.id % 3;
  const pattern = INVADER_PATTERNS[type];
  const rows = pattern.length;            // 8
  const cols = 11;                         // mirrored: 6 half → 11 full
  const halfCols = pattern[0].length;     // 6

  const cellW = inv.width / cols;
  const cellH = inv.height / rows;

  // Determine glow color
  const glowColor = flashingRed ? '#ff2244' : flashingGreen ? '#00ff88' : mainColor;
  const glowIntensity = flashingRed ? 24 : flashingGreen ? 22 : 12;

  // Leg animation: alternate last row offset every ~30 frames
  const legShift = animFrame % 2 === 0 ? 0 : 1;

  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowIntensity + 8;
  // Outer body glow rect (translucent)
  ctx.fillStyle = `${glowColor}18`;
  ctx.fillRect(inv.x + wobbleX - 4, inv.y - 2, inv.width + 8, inv.height + 4);
  ctx.shadowBlur = 0;

  for (let row = 0; row < rows; row++) {
    for (let halfCol = 0; halfCol < halfCols; halfCol++) {
      const pixel = pattern[row][halfCol];
      if (!pixel) continue;

      // Animate leg rows (last 2 rows)
      const isLeg = row >= rows - 2;
      const rowOffset = isLeg ? legShift * cellH * 0.3 : 0;

      // Mirror: left half
      const mirrorCol = cols - 1 - halfCol;

      const bxLeft  = inv.x + wobbleX + halfCol * cellW;
      const bxRight = inv.x + wobbleX + mirrorCol * cellW;
      const by = inv.y + row * cellH + rowOffset;

      drawBlock(ctx, bxLeft,  by, cellW, cellH, glowColor, glowIntensity);
      // Only draw right mirror if it's a different column
      if (halfCol < cols - halfCol) {
        drawBlock(ctx, bxRight, by, cellW, cellH, glowColor, glowIntensity);
      }
    }
    // Draw centre column (halfCols - 1 maps to col index halfCols-1 in full grid)
    // Actually centre col is handled by halfCol = 0 if using mirror approach
    // Middle col (col 5) uses halfCol index 5:
    const centrePixel = pattern[row][halfCols - 1];
    if (centrePixel) {
      const bxCentre = inv.x + wobbleX + (halfCols - 1) * cellW;
      const by = inv.y + row * cellH;
      drawBlock(ctx, bxCentre, by, cellW, cellH, glowColor, glowIntensity);
    }
  }
  ctx.restore();
}

/** Sparkle cross effect for bright foreground stars */
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 3;
  ctx.beginPath(); ctx.moveTo(x - r*2, y); ctx.lineTo(x + r*2, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - r*2); ctx.lineTo(x, y + r*2); ctx.stroke();
  ctx.lineWidth = r * 0.25;
  const d = r * 1.4;
  ctx.beginPath(); ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d); ctx.stroke();
  ctx.restore();
}

// Engine exhaust particle pool (separate from game particles for performance)
interface ExhaustParticle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
const exhaustPool: ExhaustParticle[] = [];
function updateExhaust(px: number, py: number, pw: number, ph: number, laserActive: boolean): void {
  // Spawn new exhaust
  const count = laserActive ? 5 : 2;
  for (let i = 0; i < count; i++) {
    const side = Math.random() > 0.5 ? 0.3 : 0.7;
    const colors = laserActive
      ? ['#00ffff', '#00aaff', '#ffffff']
      : ['#ff8800', '#ffaa00', '#ff4400', '#ffdd00'];
    exhaustPool.push({
      x: px + pw * side + (Math.random()-0.5)*8,
      y: py + ph,
      vx: (Math.random()-0.5)*1.5,
      vy: 1.5 + Math.random() * 3,
      life: 0.8 + Math.random()*0.4,
      color: colors[Math.floor(Math.random()*colors.length)],
      size: laserActive ? 4+Math.random()*5 : 2+Math.random()*4,
    });
  }
  // Cap pool
  if (exhaustPool.length > 120) exhaustPool.splice(0, exhaustPool.length - 120);
}
function drawExhaust(ctx: CanvasRenderingContext2D): void {
  for (let i = exhaustPool.length - 1; i >= 0; i--) {
    const e = exhaustPool[i];
    ctx.save();
    ctx.globalAlpha = e.life * 0.85;
    ctx.shadowColor = e.color; ctx.shadowBlur = e.size * 2;
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.size * e.life, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    e.x += e.vx; e.y += e.vy; e.life -= 0.055;
    if (e.life <= 0) exhaustPool.splice(i, 1);
  }
}

// ─── Boss renderer ────────────────────────────────────────────


/** Full VoxelBoss renderer — Two-pass: geometry first, text last (correct z-order) */
function drawVoxelBoss(
  ctx: CanvasRenderingContext2D,
  boss: VoxelBossState,
  _animFrame: number,
  tick: number,
): void {
  const { x: bx, y: by, voxels, palette: bossPalette } = boss;
  const bRows     = boss.rows;
  const bCols     = boss.cols;
  const bVoxelW   = boss.voxelW;
  const bVoxelH   = boss.voxelH;
  const bVoxPerLC = boss.voxelsPerLogicalCol;

  // Phase-based palette comes from the boss design itself
  const palette = bossPalette;

  // Strobe speed: phase 3 = very fast strobe
  const strobeSpeed = boss.phase === 3 ? 3 : boss.phase === 2 ? 8 : 16;
  const strobing = Math.floor(tick / strobeSpeed) % 2 === 0;

  // Subtle shimmer on correct column
  const shimmerAlpha = boss.phase === 3
    ? 0
    : 0.04 + 0.03 * Math.sin(tick * 0.08);

  // Core block pulse (warning beacon for players)
  const corePulse = 0.6 + 0.4 * Math.sin(tick * 0.18);

  // ════ PASS 1 — Geometry ════════════════════════════════

  for (let r = 0; r < bRows; r++) {
    for (let vc = 0; vc < bCols; vc++) {
      if (!voxels[r][vc]) continue;

      const logicalCol = Math.floor(vc / bVoxPerLC) as 0|1|2;
      const vxPx = bx + vc * bVoxelW;
      const vyPx = by + r * bVoxelH;
      const colColor = palette[logicalCol % 3];
      const isCorrectCol = logicalCol === boss.correctColIdx;
      const isCore = r === boss.coreBlock.row && vc === boss.coreBlock.col;

      // Alternating-row flicker in phase 2+
      const flickerAlpha = (boss.phase >= 2 && !strobing && r % 2 === 0) ? 0.5 : 1.0;

      ctx.save();
      ctx.globalAlpha = flickerAlpha;

      if (isCore) {
        // ── Core block: pulsing danger glow (red/white) ─────────────
        const coreColor = tick % 20 < 10 ? '#ff0000' : '#ffffff';
        ctx.shadowColor = coreColor;
        ctx.shadowBlur  = 20 * corePulse;
        ctx.fillStyle   = coreColor;
        ctx.fillRect(vxPx + 1, vyPx + 1, bVoxelW - 2, bVoxelH - 2);
        // Outer danger ring
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth   = 1.5;
        ctx.globalAlpha = corePulse;
        ctx.strokeRect(vxPx - 1, vyPx - 1, bVoxelW + 2, bVoxelH + 2);
      } else {
        ctx.shadowColor = colColor;
        ctx.shadowBlur = boss.phase === 3 ? 18 : 10;
        ctx.fillStyle = colColor;
        ctx.fillRect(vxPx + 1, vyPx + 1, bVoxelW - 2, bVoxelH - 2);
        // Pseudo-3D highlight edge
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(vxPx + 1, vyPx + 1, bVoxelW - 2, 2);
        ctx.fillRect(vxPx + 1, vyPx + 1, 2, bVoxelH - 2);
        // Correct-column shimmer
        if (isCorrectCol && shimmerAlpha > 0) {
          ctx.globalAlpha = shimmerAlpha;
          ctx.fillStyle = '#ffdd00';
          ctx.fillRect(vxPx, vyPx, bVoxelW, bVoxelH);
        }
      }
      ctx.restore();
    }
  }

  // Outer boss glow border
  ctx.save();
  ctx.shadowColor = palette[2]; ctx.shadowBlur = 28;
  ctx.strokeStyle = palette[0]; ctx.lineWidth = 2;
  ctx.strokeRect(bx - 2, by - 2, boss.width + 4, boss.height + 4);
  ctx.restore();

  // Faint column-divider lines
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  for (let lc = 1; lc < LOGICAL_COLS; lc++) {
    const divX = bx + lc * (boss.width / LOGICAL_COLS);
    ctx.beginPath();
    ctx.moveTo(divX, by);
    ctx.lineTo(divX, by + boss.height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // Per-column HP mini-bars (below body)
  const totalVoxelsPerCol = boss.rows * boss.voxelsPerLogicalCol;
  for (let lc = 0; lc < LOGICAL_COLS; lc++) {
    const { x: colX, w: colW } = getBossColumnBounds(boss, lc as 0|1|2);
    const hpR = boss.colVoxelCount[lc] / totalVoxelsPerCol;
    const barX = colX + 5;
    const barY = by + boss.height + 4;
    const barW = colW - 10;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(barX, barY, barW, 5);
    const hpCol = hpR > 0.6 ? '#00ff88' : hpR > 0.3 ? '#ffaa00' : '#ff2244';
    ctx.fillStyle = hpCol; ctx.shadowColor = hpCol; ctx.shadowBlur = 5;
    ctx.fillRect(barX, barY, barW * hpR, 5);
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════
  // PASS 2 — Text: answer labels + equation pill (always on top)
  // ════════════════════════════════════════════════════════

  // ── Answer pills — centred inside each logical column, 1/3 down from boss top ──
  // Positioning: labelY sits at boss.y + boss.height * 0.38
  // so the pill floats clearly inside the voxel grid with room above and below.
  const answerLabelY = by + boss.height * 0.38;

  for (let lc = 0; lc < LOGICAL_COLS; lc++) {
    const { x: colX, w: colW } = getBossColumnBounds(boss, lc as 0|1|2);
    const labelX = colX + colW / 2;
    const answer = boss.columnAnswers[lc];
    const isCorrect = lc === boss.correctColIdx;

    const pillW = colW - 16;  // nearly full column width
    const pillH = 50;
    const pillR = 10;
    const pillX = labelX - pillW / 2;
    const pillY = answerLabelY - pillH / 2;

    ctx.save();
    // Dark opaque pill background — fully covers voxels beneath text
    ctx.shadowBlur = 0;
    ctx.fillStyle = isCorrect ? 'rgba(40, 18, 0, 0.92)' : 'rgba(5, 5, 20, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
    ctx.fill();

    // Coloured border (correct col = thicker, same colour as that column)
    ctx.strokeStyle = palette[lc % 3];
    ctx.lineWidth = isCorrect ? 2.5 : 1.5;
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Answer number — large and readable
    ctx.shadowColor = palette[lc % 3]; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 26px 'Courier New', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(answer), labelX, answerLabelY - 5);

    // Small column indicator (A / B / C) below the number
    ctx.shadowBlur = 0;
    ctx.fillStyle = palette[lc % 3];
    ctx.font = `bold 11px 'Courier New', monospace`;
    ctx.fillText(['A', 'B', 'C'][lc], labelX, answerLabelY + 16);

    ctx.restore();
  }

  // ── Equation pill — pinned at top of canvas, always visible ──
  {
    const EQ_FONT_SIZE = 36;
    const eqFont = `bold ${EQ_FONT_SIZE}px 'Courier New', monospace`;
    const eqX = CANVAS_W / 2;
    // Pill top = 4px from canvas edge; centre of text sits below
    const eqTextY = 36;

    ctx.save();
    ctx.font = eqFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(boss.equation).width;
    const padX = 22, padY = 10;
    const pillW = tw + padX * 2; // no ring offset needed — equation is fixed
    const pillH = EQ_FONT_SIZE + padY * 2;
    const pillX = eqX - pillW / 2;
    const pillY = 4;

    // Background
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.94)';
    ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, 12); ctx.fill();

    // Border
    ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
    ctx.stroke(); ctx.globalAlpha = 1;

    // "👾 BOSS NAME" eyebrow label
    ctx.shadowBlur = 0; ctx.fillStyle = '#ff4400';
    ctx.font = `bold 9px 'Courier New', monospace`;
    ctx.fillText(`👾  ${boss.bossName}`, pillX + pillW / 2, pillY + 7);

    // Equation text — thick stroke then coloured fill (cuts through any bg glow)
    ctx.font = eqFont;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.95)'; ctx.lineJoin = 'round';
    ctx.strokeText(boss.equation, eqX - 10, eqTextY);
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(boss.equation, eqX - 10, eqTextY);

    ctx.restore();
  }
}

// Shared animation frame counter (updated each render call)
let _animFrame = 0;
let _animTick = 0;

function renderFrame(ctx: CanvasRenderingContext2D, state: GameState, ts: number): void {
  ensureStarfield();
  _animTick++;
  if (_animTick % 12 === 0) _animFrame++;

  const laserActive = state.player.laserModeTimer > 0;
  const shakeX = state.player.shakeTimer > 0
    ? (Math.random() - 0.5) * 9 * (state.player.shakeTimer / SHAKE_FRAMES) : 0;
  const shakeY = state.player.shakeTimer > 0
    ? (Math.random() - 0.5) * 6 * (state.player.shakeTimer / SHAKE_FRAMES) : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // ── Deep space background ──────────────────────────────────
  ctx.fillStyle = laserActive
    ? `rgba(0,${Math.floor((state.player.laserModeTimer/LASER_MODE_MS)*18)},${Math.floor((state.player.laserModeTimer/LASER_MODE_MS)*28)},1)`
    : '#050510';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle nebula glow
  if (!laserActive) {
    const neb1 = ctx.createRadialGradient(CANVAS_W*0.2, CANVAS_H*0.3, 0, CANVAS_W*0.2, CANVAS_H*0.3, 180);
    neb1.addColorStop(0, 'rgba(80,0,120,0.06)'); neb1.addColorStop(1, 'transparent');
    ctx.fillStyle = neb1; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const neb2 = ctx.createRadialGradient(CANVAS_W*0.8, CANVAS_H*0.6, 0, CANVAS_W*0.8, CANVAS_H*0.6, 160);
    neb2.addColorStop(0, 'rgba(0,40,80,0.07)'); neb2.addColorStop(1, 'transparent');
    ctx.fillStyle = neb2; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Surge flash overlay
  if (state.player.surgeFlashTimer > 0) {
    const ratio = state.player.surgeFlashTimer / SURGE_FLASH_FRAMES;
    ctx.fillStyle = `rgba(255,20,0,${ratio * 0.42})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const vg = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.1, CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.85);
    vg.addColorStop(0, 'rgba(255,0,0,0)');
    vg.addColorStop(1, `rgba(255,0,0,${ratio * 0.6})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    state.player.surgeFlashTimer--;
  }

  // ── Recovery flash overlay (calm cyan — positive reinforcement) ──
  if (state.player.recoveryFlashTimer > 0) {
    const ratio = state.player.recoveryFlashTimer / RECOVERY_FLASH_FRAMES;
    // Centre glow (opposite of surge: bright centre, dark edges)
    const rg = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H/2, 0, CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.85);
    rg.addColorStop(0,   `rgba(0,255,200,${ratio * 0.22})`);
    rg.addColorStop(0.5, `rgba(0,212,255,${ratio * 0.12})`);
    rg.addColorStop(1,   'rgba(0,180,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Hard edge ring for "scan pulse" feel — does NOT need to decrement; game loop owns the counter
  }

  // Laser ambient edge glow
  if (laserActive) {
    const lr = state.player.laserModeTimer / LASER_MODE_MS;
    const eg = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.25, CANVAS_W/2, CANVAS_H/2, CANVAS_H);
    eg.addColorStop(0, 'rgba(0,212,255,0)');
    eg.addColorStop(1, `rgba(0,212,255,${lr*0.22})`);
    ctx.fillStyle = eg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // ── Three-layer parallax starfield ─────────────────────────
  const speedMult = laserActive ? 3.5 : 1;
  for (const star of starfield) {
    star.y += star.speed * speedMult;
    if (star.y > CANVAS_H + 4) { star.y = -4; star.x = Math.random() * CANVAS_W; }
    // Twinkle
    star.twinkle += 0.025 * star.twinkleDir;
    if (star.twinkle > 1 || star.twinkle < 0) star.twinkleDir *= -1;
    const alpha = star.opacity * (0.7 + star.twinkle * 0.3);
    if (star.layer === 2) {
      // Sparkle cross
      const col = laserActive ? '#aaffff' : '#ffffff';
      drawSparkle(ctx, star.x, star.y, star.r, alpha, col);
    } else {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = laserActive ? '#bbffff' : (star.layer === 1 ? '#ddeeff' : '#aabbcc');
      ctx.shadowColor = star.layer === 1 ? '#00aaff' : 'transparent';
      ctx.shadowBlur = star.layer === 1 ? 4 : 0;
      ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // Bottom landing glow strip
  const floorGrad = ctx.createLinearGradient(0, CANVAS_H - 60, 0, CANVAS_H);
  floorGrad.addColorStop(0, 'rgba(0,212,255,0.0)');
  floorGrad.addColorStop(1, laserActive ? 'rgba(0,212,255,0.28)' : 'rgba(0,212,255,0.10)');
  ctx.fillStyle = floorGrad; ctx.fillRect(0, CANVAS_H - 60, CANVAS_W, 60);

  // ── Player ship ────────────────────────────────────────────
  const px = state.player.x, py = state.player.y;
  const pw = state.player.width, ph = state.player.height;
  const cx = px + pw / 2;
  const playerHit = state.player.hitFlash > 0;
  const shipColor = playerHit ? '#ff6600' : laserActive ? '#00ffff' : '#00d4ff';
  const shipGlow  = playerHit ? '#ff4400' : laserActive ? '#00ffff' : '#00aaff';

  // Engine exhaust particles
  updateExhaust(px, py, pw, ph, laserActive);
  drawExhaust(ctx);

  ctx.save();
  ctx.shadowColor = shipGlow;
  ctx.shadowBlur = laserActive ? 36 : playerHit ? 44 : 20;

  // Central fin / fuselage
  ctx.fillStyle = shipColor;
  ctx.beginPath();
  ctx.moveTo(cx, py);                       // nose tip
  ctx.lineTo(cx + pw*0.18, py + ph*0.55);
  ctx.lineTo(cx + pw*0.10, py + ph*0.60);
  ctx.lineTo(cx + pw*0.10, py + ph*0.80);
  ctx.lineTo(cx - pw*0.10, py + ph*0.80);
  ctx.lineTo(cx - pw*0.10, py + ph*0.60);
  ctx.lineTo(cx - pw*0.18, py + ph*0.55);
  ctx.closePath(); ctx.fill();

  // Left wing
  ctx.fillStyle = `${shipColor}cc`;
  ctx.beginPath();
  ctx.moveTo(cx - pw*0.18, py + ph*0.55);
  ctx.lineTo(px,             py + ph);
  ctx.lineTo(cx - pw*0.10,  py + ph*0.80);
  ctx.closePath(); ctx.fill();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(cx + pw*0.18, py + ph*0.55);
  ctx.lineTo(px + pw,      py + ph);
  ctx.lineTo(cx + pw*0.10, py + ph*0.80);
  ctx.closePath(); ctx.fill();

  // Cockpit window
  ctx.shadowBlur = 0;
  const cockpitGrad = ctx.createRadialGradient(cx, py + ph*0.22, 1, cx, py + ph*0.28, 9);
  cockpitGrad.addColorStop(0, '#ffffff');
  cockpitGrad.addColorStop(0.5, laserActive ? '#00ffff' : '#66ddff');
  cockpitGrad.addColorStop(1, `${shipColor}44`);
  ctx.fillStyle = cockpitGrad;
  ctx.beginPath(); ctx.ellipse(cx, py + ph*0.28, 8, 10, 0, 0, Math.PI*2); ctx.fill();

  // Hull outline
  ctx.strokeStyle = laserActive ? '#ffffff' : '#aaeeff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, py); ctx.lineTo(cx+pw*0.18, py+ph*0.55);
  ctx.lineTo(px+pw, py+ph); ctx.lineTo(cx+pw*0.10, py+ph*0.80);
  ctx.lineTo(cx+pw*0.10, py+ph*0.60); ctx.lineTo(cx+pw*0.18, py+ph*0.55);
  ctx.moveTo(cx, py); ctx.lineTo(cx-pw*0.18, py+ph*0.55);
  ctx.lineTo(px, py+ph); ctx.lineTo(cx-pw*0.10, py+ph*0.80);
  ctx.lineTo(cx-pw*0.10, py+ph*0.60); ctx.lineTo(cx-pw*0.18, py+ph*0.55);
  ctx.stroke();
  ctx.restore();

  // ── Laser beam ────────────────────────────────────────────
  if (laserActive) {
    const beamX = cx;
    const beamW = 16;
    const lr = state.player.laserModeTimer / LASER_MODE_MS;
    ctx.save();
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 50;
    // Outer diffuse glow
    const outer = ctx.createLinearGradient(beamX - beamW*3, 0, beamX + beamW*3, 0);
    outer.addColorStop(0, 'rgba(0,212,255,0)');
    outer.addColorStop(0.4, `rgba(0,212,255,${lr*0.25})`);
    outer.addColorStop(0.5, `rgba(0,255,255,${lr*0.35})`);
    outer.addColorStop(0.6, `rgba(0,212,255,${lr*0.25})`);
    outer.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.fillStyle = outer; ctx.fillRect(beamX - beamW*3, 0, beamW*6, py);
    // Core bright beam
    const core = ctx.createLinearGradient(beamX - beamW*0.6, 0, beamX + beamW*0.6, 0);
    core.addColorStop(0, 'rgba(0,200,255,0)');
    core.addColorStop(0.2, `rgba(100,255,255,${lr*0.9})`);
    core.addColorStop(0.5, `rgba(255,255,255,${lr})`);
    core.addColorStop(0.8, `rgba(100,255,255,${lr*0.9})`);
    core.addColorStop(1, 'rgba(0,200,255,0)');
    ctx.fillStyle = core; ctx.fillRect(beamX - beamW*0.6, 0, beamW*1.2, py);
    // Scan line streak
    const scanY = (ts * 0.5) % py;
    ctx.globalAlpha = 0.25 * lr; ctx.fillStyle = '#ffffff';
    ctx.fillRect(beamX - 2, py - scanY, 4, 20); ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Normal bullets ────────────────────────────────────────
  if (!laserActive) {
    for (const b of state.bullets) {
      ctx.save();
      ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 22;
      // Trail
      ctx.fillStyle = 'rgba(255,0,255,0.18)';
      ctx.fillRect(b.x - 2, b.y + 6, 4, 24);
      // Head
      ctx.fillStyle = '#ff44ff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // ── Enemy projectiles ─────────────────────────────────────
  for (const ep of state.enemyProjectiles) {
    ctx.save();
    const isBuff = ep.modifier.type === 'buff';
    const epColor = isBuff ? '#00ff88' : '#ff3333';
    const epInner = isBuff ? '#aaffcc' : '#ffaaaa';
    ctx.shadowColor = epColor; ctx.shadowBlur = 24;
    // Orb
    const orbG = ctx.createRadialGradient(ep.x, ep.y, 0, ep.x, ep.y, 12);
    orbG.addColorStop(0, epInner);
    orbG.addColorStop(0.5, epColor);
    orbG.addColorStop(1, `${epColor}00`);
    ctx.fillStyle = orbG;
    ctx.beginPath(); ctx.arc(ep.x, ep.y, 12, 0, Math.PI*2); ctx.fill();
    // Ring
    ctx.strokeStyle = epColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ep.x, ep.y, 14, 0, Math.PI*2); ctx.stroke();
    // Label
    ctx.shadowBlur = 4; ctx.fillStyle = '#ffffff';
    ctx.font = `bold 9px 'Courier New', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(ep.modifier.label, ep.x, ep.y + 15);
    ctx.restore();
  }

  // ── Voxel Invaders ────────────────────────────────────────
  for (const inv of state.invaders) {
    inv.wobble += 0.038;
    const wobbleX = Math.sin(inv.wobble) * 3.5;
    const flashingRed   = inv.flashRed > 0;
    const flashingGreen = inv.flashGreen > 0;
    const mainColor = flashingRed ? '#ff2244' : flashingGreen ? '#00ff88' : inv.color;

    // ── 1. Voxel Invader body ──────────────────────────────
    drawVoxelInvader(ctx, inv, wobbleX, _animFrame, mainColor, flashingRed, flashingGreen);

    // ── 2. HP bar (flush below sprite) ─────────────────────
    const hpR = inv.hp / inv.maxHp;
    const bW = inv.width - 8, bH = 4;
    const bX = inv.x + 4, bY = inv.y + inv.height + 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bX, bY, bW, bH);
    const hpColor = hpR > 0.6 ? '#00ff88' : hpR > 0.3 ? '#ffaa00' : '#ff2244';
    ctx.fillStyle = hpColor; ctx.shadowColor = hpColor; ctx.shadowBlur = 6;
    ctx.fillRect(bX, bY, bW * hpR, bH); ctx.shadowBlur = 0;

    // ── 3. Equation pill (below feet — large, instantly readable) ─
    {
      const EQ_FONT_SIZE = 36;
      const eqFont = `bold ${EQ_FONT_SIZE}px 'Courier New', monospace`;
      const eqX = inv.x + inv.width / 2 + wobbleX;
      // HP bar bottom edge = inv.y + inv.height + 6 → place pill centre 28px below that
      const eqY = inv.y + inv.height + 28 + EQ_FONT_SIZE / 2;

      ctx.save();
      ctx.font = eqFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Measure at the ACTUAL render font so the pill always fits perfectly
      const metrics = ctx.measureText(inv.equation);
      const tw = metrics.width;
      const th = EQ_FONT_SIZE * 1.15;   // approximate cap-height + descenders
      const padX = 16, padY = 8;
      const pillX = eqX - tw / 2 - padX;
      const pillY = eqY - th / 2 - padY;
      const pillW = tw + padX * 2;
      const pillH = th + padY * 2;
      const pillR = 10;

      // Dark translucent pill background
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.88)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
      ctx.fill();

      // Coloured border matching invader glow (thicker for the bigger pill)
      ctx.strokeStyle = flashingRed ? '#ff2244' : mainColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Thick black stroke so text cuts through any neon glow
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.95)';
      ctx.lineJoin = 'round';
      ctx.strokeText(inv.equation, eqX, eqY);

      // Bright white fill on top with subtle glow
      ctx.shadowColor = flashingRed ? '#ff8888' : '#aaffff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(inv.equation, eqX, eqY);

      ctx.restore();
    }

    // Speed badge (below the new large equation pill)
    if (inv.speedMultiplier > 1) {
      ctx.save();
      ctx.shadowColor = '#ff8844'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff8844'; ctx.font = `bold 11px 'Courier New',monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      // Pill is now ~72px tall total → badge goes below that
      ctx.fillText(`⚡×${inv.speedMultiplier.toFixed(1)}`, inv.x + inv.width/2 + wobbleX, inv.y + inv.height + 28 + 36 + 24);
      ctx.restore();
    }


    // ── 4. Answer bubbles (topmost — always drawn last) ─────
    const BNC = '#00d4ff';
    const invCx = inv.x + inv.width/2 + wobbleX;

    for (const bubble of inv.answers) {
      const { bx, by } = bubblePos(inv, bubble);

      ctx.save();
      ctx.shadowColor = BNC; ctx.shadowBlur = 26;
      // Holographic gradient fill
      const hlGrad = ctx.createRadialGradient(bx, by-6, 4, bx, by, BUBBLE_HIT_R);
      hlGrad.addColorStop(0, 'rgba(0,212,255,0.28)');
      hlGrad.addColorStop(1, 'rgba(0,80,140,0.15)');
      ctx.fillStyle = hlGrad;
      ctx.beginPath(); ctx.arc(bx, by, BUBBLE_HIT_R, 0, Math.PI*2); ctx.fill();
      // Outer ring
      ctx.strokeStyle = BNC; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx, by, BUBBLE_HIT_R, 0, Math.PI*2); ctx.stroke();
      // Inner scan-line ring
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(bx, by, BUBBLE_HIT_R - 8, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
      // Answer number — 2× font size for easy reading and tapping
      ctx.shadowBlur = 12; ctx.shadowColor = BNC;
      ctx.fillStyle = '#e0f8ff';
      ctx.font = `bold 26px 'Courier New', monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(bubble.value), bx, by);
      // Dashed connector to invader centre
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,212,255,0.25)'; ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(invCx, inv.y + inv.height * 0.5); ctx.lineTo(bx, by);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }

    if (inv.flashRed   > 0) inv.flashRed--;
    if (inv.flashGreen > 0) inv.flashGreen--;
  }

  // ── Voxel Boss ────────────────────────────────────────────
  if (state.boss) {
    drawVoxelBoss(ctx, state.boss, _animFrame, _animTick);
  }

  // ── Overdrive bullet render (gold spread trails) ──────────
  if (state.player.isOverdrive) {
    for (const b of state.bullets) {
      ctx.save();
      ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 28;
      // Longer trail for spread feel
      ctx.fillStyle = 'rgba(255,180,0,0.22)';
      ctx.fillRect(b.x - 2, b.y + 8, 4, 30);
      // Core orb
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // ── Overdrive status bar (in-canvas, below boss) ──────────
  if (state.player.isOverdrive && state.player.overdriveTtl > 0) {
    const odr = state.player.overdriveTtl / OVERDRIVE_DURATION_MS;
    const barY = CANVAS_H - 28;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.roundRect(8, barY, CANVAS_W - 16, 14, 7); ctx.fill();
    const odGrad = ctx.createLinearGradient(8, 0, 8 + (CANVAS_W - 16) * odr, 0);
    odGrad.addColorStop(0, '#ffdd00'); odGrad.addColorStop(0.6, '#ff8800'); odGrad.addColorStop(1, '#ff4400');
    ctx.fillStyle = odGrad; ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.roundRect(8, barY, (CANVAS_W - 16) * odr, 14, 7); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff';
    ctx.font = `bold 8px 'Courier New', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡  OVERDRIVE ATIVO  ⚡', CANVAS_W/2, barY + 7);
    ctx.restore();
  }

  // ── Particles ────────────────────────────────────────────
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    ctx.save(); ctx.globalAlpha = Math.pow(p.life, 0.7); // more opaque longer
    if (p.text) {
      ctx.font = `bold ${p.size}px 'Courier New', monospace`;
      ctx.fillStyle = p.color; ctx.textAlign = 'center';
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.shadowColor = p.color; ctx.shadowBlur = p.size * 1.8;
      // Draw as glowing square block for "voxel explosion" feel
      const s = p.size * p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
      // Bright center
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x - s*0.2, p.y - s*0.2, s*0.4, s*0.4);
    }
    ctx.restore();
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.97; p.vy *= 0.97; // slight drag
    p.life -= 0.018;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // ── In-canvas laser charge bar ─────────────────────────
  if (laserActive) {
    const lr = state.player.laserModeTimer / LASER_MODE_MS;
    ctx.save();
    // Track
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath(); ctx.roundRect(8, 6, CANVAS_W - 16, 14, 7); ctx.fill();
    // Fill
    const barGrad = ctx.createLinearGradient(8, 0, 8 + (CANVAS_W-16)*lr, 0);
    barGrad.addColorStop(0, '#00ffff'); barGrad.addColorStop(0.6, '#00aaff'); barGrad.addColorStop(1, '#ff00ff');
    ctx.fillStyle = barGrad; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.roundRect(8, 6, (CANVAS_W-16)*lr, 14, 7); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff';
    ctx.font = `bold 8px 'Courier New', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡  LASER MODE ATIVO  ⚡', CANVAS_W/2, 13);
    ctx.restore();
  }

  void ts;
  ctx.restore(); // end shake
}




// ─── The Hook ─────────────────────────────────────────────────
export interface UseGameEngineOptions {
  onScoreChange: (score: number) => void;
  onStatusChange: (status: string) => void;
  onWaveChange: (wave: number) => void;
  onLaserChange: (active: boolean, ratio: number) => void;
}

export function useGameEngine(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseGameEngineOptions
) {
  const stateRef = useRef<GameState>(makeInitialState());
  const rafRef = useRef<number>(0);
  const lastReportedScore = useRef(-1);
  const lastReportedWave = useRef(1);
  const lastLaserActive = useRef(false);
  // ── Mobile/touch input state ─────────────────────────────────
  // targetX: canvas-space X the player ship should smoothly track
  // isFiring: true while any pointer is held (finger or mouse)
  const touchInputRef = useRef({ targetX: -1, isFiring: false });
  // Legacy compat — kept so existing pHeld check in game loop still compiles
  const pointerHeldRef = useRef<() => boolean>(() => touchInputRef.current.isFiring);

  // ── Canvas Initialization (HiDPI & Mobile Cap) ─────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Detect mobile and cap internal resolution instead of DPR scaling to avoid GPU lag
    const isMobile = window.matchMedia('(max-width: 768px)').matches || /Mobi|Android/i.test(navigator.userAgent);
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    
    // Set actual internal buffer size
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    
    // Scale context so game logic runs in logical CANVAS_W / CANVAS_H coordinates
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false; // ensure crisp lines
    }
  }, [canvasRef]);

  // ── Keyboard input ────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const state = stateRef.current;
      state.keys.add(e.code);
      if (e.code === 'Space' && state.status === 'playing') e.preventDefault();
    }
    function onKeyUp(e: KeyboardEvent) {
      stateRef.current.keys.delete(e.code);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ── Unified pointer input ─────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let pointerHeld = false;

    function toCanvasPoint(clientX: number, clientY: number): { cx: number; cy: number } {
      const rect = canvas!.getBoundingClientRect();
      return {
        cx: (clientX - rect.left) * (CANVAS_W / rect.width),
        cy: (clientY - rect.top) * (CANVAS_H / rect.height),
      };
    }

    function tryBubbleHit(cx: number, cy: number): boolean {
      const state = stateRef.current;
      if (state.status !== 'playing') return false;
      for (let ii = state.invaders.length - 1; ii >= 0; ii--) {
        const inv = state.invaders[ii];
        for (const bubble of inv.answers) {
          const { bx, by } = bubblePos(inv, bubble);
          if (Math.hypot(cx - bx, cy - by) <= BUBBLE_HIT_R + 6) {
            if (bubble.isCorrect) {
              destroyInvader(state, ii, true, false);
            } else {
              spawnWrongEffect(state, inv.x + inv.width / 2, inv.y + inv.height / 2);
              inv.flashRed = 22;
              inv.speedMultiplier = parseFloat((inv.speedMultiplier * WRONG_BUBBLE_MULTIPLIER).toFixed(2));
              inv.speed = inv.baseSpeed * inv.speedMultiplier;
              state.score = Math.max(0, state.score - 20);
            }
            return true;
          }
        }
      }
      return false;
    }

    function onPointerDown(e: PointerEvent) {
      const state = stateRef.current;
      if (state.status !== 'playing') return;
      canvas!.setPointerCapture(e.pointerId);
      const { cx, cy } = toCanvasPoint(e.clientX, e.clientY);
      // Try bubble hit first — if it hits, do NOT start firing/moving
      if (tryBubbleHit(cx, cy)) return;
      // Set the tracking target (do NOT teleport — lerp handles movement)
      touchInputRef.current.targetX = cx - PLAYER_W / 2;
      touchInputRef.current.isFiring = true;
      pointerHeld = true;   // keep legacy flag in sync
    }
    function onPointerMove(e: PointerEvent) {
      const state = stateRef.current;
      if (!pointerHeld || state.status !== 'playing') return;
      const { cx } = toCanvasPoint(e.clientX, e.clientY);
      // Only update the TARGET — the game loop lerps the player toward it
      touchInputRef.current.targetX = cx - PLAYER_W / 2;
    }
    function onPointerUp(_e: PointerEvent) {
      pointerHeld = false;
      touchInputRef.current.isFiring = false;
    }

    pointerHeldRef.current = () => touchInputRef.current.isFiring;

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup',     onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup',     onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [canvasRef]);

  // ── Fire bullet ───────────────────────────────────────────
  // isEmpowered = true when laser mode is active (player solved math correctly)
  function fireBullet(state: GameState): void {
    const now = performance.now();
    if (now - state.lastBulletTime < BULLET_COOLDOWN_MS) return;
    state.lastBulletTime = now;
    const empowered = state.player.laserModeTimer > 0;
    state.bullets.push({
      id: state.nextId++,
      x: state.player.x + state.player.width / 2,
      y: state.player.y,
      speed: BULLET_SPEED,
      isLaser: false,
      isEmpowered: empowered,  // math-validated bullet
    } as any);
  }

  // ── Fire Overdrive spread burst ──────────────────────────
  // Overdrive bullets are always empowered (earned by solving the boss equation)
  function fireBulletOverdrive(state: GameState): void {
    const now = performance.now();
    if (now - state.player.lastOverdriveShot < OVERDRIVE_SHOOT_INTERVAL_MS) return;
    state.player.lastOverdriveShot = now;
    const px = state.player.x + state.player.width / 2;
    const py = state.player.y;
    for (const deg of OVERDRIVE_SPREAD_ANGLES) {
      const rad = (deg * Math.PI) / 180 - Math.PI / 2;
      state.bullets.push({
        id: state.nextId++,
        x: px, y: py,
        speed: BULLET_SPEED * OVERDRIVE_SPEED_MULT,
        isLaser: false,
        isEmpowered: true,  // Overdrive bullets always penetrate core
        _vx: Math.cos(rad) * BULLET_SPEED * OVERDRIVE_SPEED_MULT,
        _vy: Math.sin(rad) * BULLET_SPEED * OVERDRIVE_SPEED_MULT,
      } as any);
    }
  }

  // ── Game loop ─────────────────────────────────────────────
  const loop = useCallback((ts: number) => {
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (state.status === 'playing') {
      const dtMs = 16.67;

      // ── Player movement ──────────────────────────────────────
      // Keyboard: instant directional movement
      if (state.keys.has('ArrowLeft') || state.keys.has('KeyA'))
        state.player.x = Math.max(0, state.player.x - PLAYER_SPEED);
      if (state.keys.has('ArrowRight') || state.keys.has('KeyD'))
        state.player.x = Math.min(CANVAS_W - PLAYER_W, state.player.x + PLAYER_SPEED);

      // Touch/pointer: smooth lerp toward finger position (18% per frame ≈ ~6 frames to close gap)
      const touchIn = touchInputRef.current;
      if (touchIn.isFiring && touchIn.targetX >= 0) {
        const clampedTarget = Math.max(0, Math.min(CANVAS_W - PLAYER_W, touchIn.targetX));
        state.player.x += (clampedTarget - state.player.x) * 0.18;
      }

      // ── Overdrive auto-fire (takes priority over laser and normal fire) ──────
      if (state.player.isOverdrive) {
        fireBulletOverdrive(state);
      // ── Laser auto-damage ────────────────────────────────────
      } else if (state.player.laserModeTimer > 0) {
        const beamX = state.player.x + PLAYER_W / 2;
        for (let ii = state.invaders.length - 1; ii >= 0; ii--) {
          const inv = state.invaders[ii];
          if (beamX >= inv.x && beamX <= inv.x + inv.width) {
            inv.hp -= LASER_DAMAGE_PER_FRAME;
            inv.flashGreen = 4;
            if (inv.hp <= 0) destroyInvader(state, ii, false, true);
          }
        }
      } else {
        // Continuous fire: space, OR touch held
        const spaceHeld = state.keys.has('Space');
        const touchFiring = touchIn.isFiring;
        if (spaceHeld || touchFiring) fireBullet(state);
      }

      // Timers
      if (state.player.laserModeTimer > 0)
        state.player.laserModeTimer = Math.max(0, state.player.laserModeTimer - dtMs);
      if (state.player.shakeTimer > 0) state.player.shakeTimer--;
      if (state.player.hitFlash > 0) state.player.hitFlash--;
      // ── Overdrive timer ──────────────────────────────────────────────────────
      if (state.player.isOverdrive) {
        state.player.overdriveTtl = Math.max(0, state.player.overdriveTtl - dtMs);
        if (state.player.overdriveTtl <= 0) {
          state.player.isOverdrive = false;
          state.particles.push({
            id: state.nextId++,
            x: CANVAS_W / 2, y: CANVAS_H / 2 + 20,
            vx: 0, vy: -1.2, life: 1,
            color: '#ff8800', size: 16, text: '⚡ OVERDRIVE ESGOTADO',
          });
        }
      }

      // Laser change notification
      const laserNowActive = state.player.laserModeTimer > 0;
      if (laserNowActive !== lastLaserActive.current) {
        lastLaserActive.current = laserNowActive;
        options.onLaserChange(laserNowActive, state.player.laserModeTimer / LASER_MODE_MS);
      } else if (laserNowActive) {
        options.onLaserChange(true, state.player.laserModeTimer / LASER_MODE_MS);
      }

      // ════════════════════════════════════════════════════════════
      // BOSS GAUNTLET SPAWN LOGIC
      // ════════════════════════════════════════════════════════════
      // Helper: spawn one boss and reset Overdrive
      // bossIndex cycles 0→1→2→3 based on how many are remaining
      function spawnNextBoss(): void {
        const bossIndex = BOSS_GAUNTLET_COUNT - state.bossesRemainingInWave;
        state.invaders = [];
        state.enemyProjectiles = [];
        state.boss = createBoss(
          state.wave, state.difficultyMultiplier, CANVAS_W, state.nextId++, bossIndex
        );
        // Overdrive is NOT carried between individual bosses
        state.player.isOverdrive       = false;
        state.player.overdriveTtl      = 0;
        state.player.lastOverdriveShot = 0;
        state.lastInvaderSpawn         = ts + 999_999;
        // Boss name announcement particle
        const bossName = BOSS_NAMES[bossIndex % BOSS_NAMES.length];
        const bossColor = state.boss.palette[1];
        const bossNum   = bossIndex + 1;
        state.particles.push({
          id: state.nextId++, x: CANVAS_W / 2, y: CANVAS_H / 2 - 40,
          vx: 0, vy: -1.0, life: 1.4,
          color: bossColor, size: 26,
          text: `👾  BOSS ${bossNum}/${BOSS_GAUNTLET_COUNT} — ${bossName}`,
        });
      }

      // ── Initial gauntlet trigger (wave 5 / 10 / 15…) ─────────────────────
      if (!state.boss && state.bossesRemainingInWave === 0
          && state.wave > 1 && state.wave % BOSS_SPAWN_EVERY_N_WAVES === 0
          && state.killCount === 0 && ts >= state.bossSpawnCooldownTs) {
        state.bossesRemainingInWave = BOSS_GAUNTLET_COUNT;
        state.particles.push({
          id: state.nextId++,
          x: CANVAS_W / 2, y: CANVAS_H / 2 - 80,
          vx: 0, vy: -1.2, life: 1.4,
          color: '#ff4400', size: 30, text: `⚠️  GAUNTLET! ${BOSS_GAUNTLET_COUNT} BOSSES!`,
        });
        spawnNextBoss();
      }

      // ── Sequential re-spawn (cooldown elapsed, gauntlet still running) ────
      if (!state.boss && state.bossesRemainingInWave > 0 && ts >= state.bossSpawnCooldownTs) {
        spawnNextBoss();
      }

      // ── Boss update (entry slide-in + reshuffle + defeat/escape) ─────────────
      if (state.boss) {
        const boss = state.boss;
        if (boss.y < BOSS_ENTRY_Y_TARGET) {
          boss.y = Math.min(BOSS_ENTRY_Y_TARGET, boss.y + BOSS_ENTRY_SPEED);
          boss.entryProgress = Math.min(1, (boss.y + boss.height) / (BOSS_ENTRY_Y_TARGET + boss.height));
          spawnBossEntryParticles(state, boss.x, boss.y, boss.width);
        }
        if (isBossDefeated(boss)) {
          spawnBossDestroyedExplosion(state, boss.x + boss.width / 2, boss.y + boss.height / 2);
          state.score += BOSS_DEFEAT_BONUS + Math.floor(state.wave * 50);
          state.player.shakeTimer = 40;
          // ── Overdrive reset + 2s cooldown (lets explosion particles play out) ──
          state.player.isOverdrive       = false;
          state.player.overdriveTtl      = 0;
          state.player.lastOverdriveShot = 0;
          state.bossSpawnCooldownTs      = ts + BOSS_INTER_SPAWN_COOLDOWN_MS;
          state.boss = undefined;
          // ── Gauntlet counter ──────────────────────────────────────────────────
          state.bossesRemainingInWave = Math.max(0, state.bossesRemainingInWave - 1);
          if (state.bossesRemainingInWave === 0) {
            state.particles.push({
              id: state.nextId++,
              x: CANVAS_W / 2, y: CANVAS_H / 2,
              vx: 0, vy: -1.2, life: 1.8,
              color: '#00ff88', size: 28, text: '★  GAUNTLET COMPLETO!',
            });
            state.score += 5000;
            state.particles.push({
              id: state.nextId++, x: CANVAS_W / 2, y: CANVAS_H / 2 + 30,
              vx: 0, vy: -1.0, life: 1.4,
              color: '#ffdd00', size: 20, text: '+5000 BONUS',
            });
            state.lastInvaderSpawn = ts;
          }

        } else if (boss.y + boss.height >= CANVAS_H - 10) {
          spawnBossDestroyedExplosion(state, boss.x + boss.width / 2, boss.y + boss.height / 2);
          state.player.isOverdrive       = false;
          state.player.overdriveTtl      = 0;
          state.player.lastOverdriveShot = 0;
          state.bossSpawnCooldownTs      = ts + BOSS_INTER_SPAWN_COOLDOWN_MS;
          state.boss = undefined;
          state.bossesRemainingInWave = Math.max(0, state.bossesRemainingInWave - 1);
          triggerDifficultySurge(state);
          if (state.bossesRemainingInWave === 0) {
            state.lastInvaderSpawn = ts;
          }
          // else: sequential re-spawn handled by spawn block after cooldown
        }

      } else {
        if (ts - state.lastInvaderSpawn > state.spawnIntervalMs) {
          spawnInvader(state);
          state.lastInvaderSpawn = ts;
        }
      }

      // ── Tick recovery flash timer ────────────────────────────────────────────
      if (state.player.recoveryFlashTimer > 0) state.player.recoveryFlashTimer--;

      // ───────────────────────────────────────────────────────
      // ── NATURAL WAVE PROGRESSION (time + kills) ───────────────
      // Triggers even if the player is hitting every equation perfectly.
      // Stacks ON TOP of Penalty Surges when enemies escape.
      // ───────────────────────────────────────────────────────
      const nowMs = performance.now();
      const enoughKills = state.killCount >= WAVE_ADVANCE_KILLS;
      // Guard: don't advance on the very first frame (lastWaveAdvanceTs === 0)
      const enoughTime  = state.lastWaveAdvanceTs > 0
        && (nowMs - state.lastWaveAdvanceTs) >= WAVE_ADVANCE_MS;

      if (enoughKills || enoughTime) {
        triggerNaturalWave(state, nowMs);
        // Report updated wave to React
        if (state.wave !== lastReportedWave.current) {
          lastReportedWave.current = state.wave;
          options.onWaveChange(state.wave);
        }
      }


      // Move invaders + enemy shooting + ENDLESS: bottom crossing = Difficulty Surge
      const now = performance.now();
      for (let ii = state.invaders.length - 1; ii >= 0; ii--) {
        const inv = state.invaders[ii];

        // ── Smooth speed lerp toward live difficulty target ──────
        // difficultyMultiplier bonus nerfed (0.55 → 0.15) and absolute speed capped at 3.2 px/frame
        // so the game stays physically playable even at very high wave numbers.
        const targetSpeed = Math.min(
          3.2,
          inv.baseSpeed
            * inv.speedMultiplier                             // wrong-answer penalty multiplier
            * (1 + (state.difficultyMultiplier - 1) * 0.15)  // lighter live-bonus (nerfed)
        );
        // Lerp current speed toward target for buttery-smooth deceleration/acceleration
        inv.speed += (targetSpeed - inv.speed) * SPEED_LERP_RATE;

        inv.y += inv.speed;

        // Enemy shooting
        if (now - inv.lastShotTime > ENEMY_SHOOT_COOLDOWN_MS) {
          spawnEnemyProjectile(state, inv);
          inv.lastShotTime = now;
        }

        // ── ENDLESS MODE: invader escaped → Difficulty Surge (no Game Over) ──
        if (inv.y + inv.height >= CANVAS_H - 10) {
          state.invaders.splice(ii, 1);
          triggerDifficultySurge(state);
          if (state.wave !== lastReportedWave.current) {
            lastReportedWave.current = state.wave;
            options.onWaveChange(state.wave);
          }
        }
      }

      // Move bullets + column-gated boss collision / normal invader collision
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i] as any;
        // Support diagonal overdrive bullets (_vx/_vy overrides vertical-only speed)
        if (b._vx !== undefined) {
          b.x += b._vx;
          b.y += b._vy;
        } else {
          b.y -= b.speed;
        }
        if (b.y < -20 || b.x < -20 || b.x > CANVAS_W + 20) {
          state.bullets.splice(i, 1); continue;
        }

        let consumed = false;

        // ── Boss collision ─────────────────────────────────────────────────
        if (state.boss && !consumed) {

          // ── ENTRY INVULNERABILITY GUARD ────────────────────────────────
          if (state.boss.entryProgress < 1) {
            const bossInRange = b.y >= state.boss.y - 4 && b.y <= state.boss.y + state.boss.height
                             && b.x >= state.boss.x && b.x <= state.boss.x + state.boss.width;
            if (bossInRange) {
              state.particles.push({
                id: state.nextId++, x: b.x, y: b.y,
                vx: (Math.random() - 0.5) * 2, vy: -1.5, life: 0.4,
                color: '#aaaaaa', size: 6,
              });
              state.bullets.splice(i, 1);
              consumed = true;
            }
          } else {
            // ── Full collision ─────────────────────────────────────────
            const isEmpowered: boolean = (b as any).isEmpowered === true;
            const result = hitBossVoxel(
              state.boss, b.x, b.y,
              state.player.isOverdrive, isEmpowered
            );

            if (result === 'insta_kill') {
              // ── Assassination! Core block destroyed by empowered bullet ──
              state.score += BOSS_VOXEL_SCORE * 10;
              spawnBossVoxelExplosion(state, b.x, b.y, '#ffffff');
              // Boss will be detected as defeated on the next isBossDefeated check
              state.bullets.splice(i, 1);
              consumed = true;
              state.particles.push({
                id: state.nextId++, x: CANVAS_W / 2, y: CANVAS_H / 2 - 20,
                vx: 0, vy: -2, life: 1.4,
                color: '#ffffff', size: 28, text: '💀  ASSASSINATION!',
              });

            } else if (result === 'deflected_core') {
              // ── Core armored — standard bullet deflected ───────────────
              // Show a shield-spark effect, consume the bullet
              for (let sp = 0; sp < 8; sp++) {
                const ang = (Math.PI * 2 * sp) / 8;
                state.particles.push({
                  id: state.nextId++, x: b.x, y: b.y,
                  vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3,
                  life: 0.6, color: '#ff4444', size: 4,
                });
              }
              state.particles.push({
                id: state.nextId++, x: b.x, y: b.y - 20,
                vx: 0, vy: -1.8, life: 0.8,
                color: '#ff2222', size: 14, text: '🛡 BLINDADO!',
              });
              state.bullets.splice(i, 1);
              consumed = true;

            } else if (result === 'hit_correct') {
              state.score += BOSS_VOXEL_SCORE;
              spawnBossVoxelExplosion(state, b.x, b.y, '#ffdd00');
              if (!state.player.isOverdrive) triggerOverdrive(state);
              state.bullets.splice(i, 1);
              consumed = true;

            } else if (result === 'hit_wrong') {
              state.score += Math.floor(BOSS_VOXEL_SCORE / 2);
              spawnBossVoxelExplosion(state, b.x, b.y, '#ff8800');
              state.bullets.splice(i, 1);
              consumed = true;
            }
            // 'miss' → bullet keeps flying
          }
        }

        // ── Normal invader collision (only when no boss) ──────────────────────
        if (!consumed && !state.boss) {
          for (let ii = state.invaders.length - 1; ii >= 0; ii--) {
            const inv = state.invaders[ii];
            const hit = b.x > inv.x && b.x < inv.x + inv.width && b.y > inv.y && b.y < inv.y + inv.height;
            if (!hit) continue;
            state.bullets.splice(i, 1);
            consumed = true;
            inv.hp -= 1;
            inv.flashGreen = 5;
            if (inv.hp <= 0) destroyInvader(state, ii, false, false);
            else spawnExplosion(state, b.x, b.y, inv.color, 4);
            break;
          }
        }
        void consumed;
      }

      // ── Enemy projectile movement + player collision ──
      const pcx = state.player.x + PLAYER_W / 2;
      const pcy = state.player.y + PLAYER_H / 2;
      for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
        const ep = state.enemyProjectiles[i];
        ep.x += ep.vx;
        ep.y += ep.vy;

        // Out of bounds
        if (ep.y > CANVAS_H + 20 || ep.x < -20 || ep.x > CANVAS_W + 20) {
          state.enemyProjectiles.splice(i, 1);
          continue;
        }

        // Player collision
        if (Math.hypot(ep.x - pcx, ep.y - pcy) <= PLAYER_HITBOX_R) {
          const mod = ep.modifier;
          const before = state.score;
          if (mod.type === 'buff') {
            state.score = state.score * mod.factor;
          } else {
            // Allow floating-point division — score can shrink to fractions (idle-game style)
            state.score = state.score / mod.factor;
          }
          const delta = state.score - before;
          spawnModifierHitEffect(state, pcx, pcy, mod);
          // Floating delta label — use formatScore so it never overflows the canvas
          state.particles.push({
            id: state.nextId++,
            x: pcx, y: pcy - 50,
            vx: 0, vy: -1.8, life: 1,
            color: mod.type === 'buff' ? '#00ff88' : '#ff4444',
            size: 15,
            text: `${delta >= 0 ? '+' : ''}${formatScore(delta)}`,
          });
          state.player.hitFlash = PLAYER_HIT_FLASH_FRAMES;
          state.enemyProjectiles.splice(i, 1);
        }
      }

      // Report score & wave
      if (state.score !== lastReportedScore.current) {
        lastReportedScore.current = state.score;
        options.onScoreChange(state.score);
      }
      if (state.wave !== lastReportedWave.current) {
        lastReportedWave.current = state.wave;
        options.onWaveChange(state.wave);
      }
    }

    renderFrame(ctx, state, ts);
    rafRef.current = requestAnimationFrame(loop);
  }, [canvasRef, options]);

  // ── Public API ────────────────────────────────────────────
  const startGame = useCallback(() => {
    starfield = [];
    const fresh = makeInitialState();
    fresh.status = 'playing';
    const now = performance.now();
    fresh.lastInvaderSpawn = now - INITIAL_SPAWN_INTERVAL_MS + 900;
    fresh.lastWaveAdvanceTs = now;   // seed the natural wave timer
    stateRef.current = fresh;
    lastReportedScore.current = -1;
    lastReportedWave.current = 1;
    lastLaserActive.current = false;
    options.onStatusChange('playing');
    options.onScoreChange(0);
    options.onWaveChange(1);
    options.onLaserChange(false, 0);
  }, [options]);

  /** Pause the loop for save overlay */
  const pauseGame = useCallback(() => {
    const state = stateRef.current;
    if (state.status === 'playing') {
      state.status = 'paused';
      options.onStatusChange('paused');
    }
  }, [options]);

  /** Resume from paused state */
  const resumeGame = useCallback(() => {
    const state = stateRef.current;
    if (state.status === 'paused') {
      state.status = 'playing';
      options.onStatusChange('playing');
    }
  }, [options]);

  // RAF start/stop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  return { startGame, pauseGame, resumeGame };
}

export { CANVAS_W, CANVAS_H };
