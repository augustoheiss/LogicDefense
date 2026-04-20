// ============================================================
// LOGIC INVADERS — VOXEL BOSS  (v1)
// Pure-logic module — no React, no canvas dependencies.
// All rendering lives in useGameEngine.ts.
// ============================================================
import type { VoxelBossState, VoxelGrid } from '../types';
import { generateEquation, randInt } from './mathEngine';

// ─── Boss grid dimensions ─────────────────────────────────────
export const BOSS_COLS      = 15;   // total voxel columns
export const BOSS_ROWS      = 8;    // total voxel rows
export const LOGICAL_COLS   = 3;    // how many logical (hitbox) columns
export const VOXELS_PER_COL = BOSS_COLS / LOGICAL_COLS; // 5 voxel cols per logical col

// Boss canvas dimensions (fixed — centred horizontally in the engine)
export const BOSS_W = 420;
export const BOSS_H = 168;  // 8 rows × 21px each
export const VOXEL_W = BOSS_W / BOSS_COLS; // 28px
export const VOXEL_H = BOSS_H / BOSS_ROWS; // 21px

// ─── Grid factory ────────────────────────────────────────────
/**
 * Create a fully-alive 8-row × 15-col voxel grid.
 * Rows 0‑1 are intentionally sparser (boss "crown") for visual interest.
 */
function makeGrid(): VoxelGrid {
  const crown = [
    // Row 0 — sparse crown spikes
    [0,0,1,0,0,1,0,1,0,1,0,0,1,0,0],
    // Row 1 — thicker crown
    [0,1,1,0,1,1,1,1,1,1,1,0,1,1,0],
  ];
  const grid: VoxelGrid = [];
  for (let r = 0; r < BOSS_ROWS; r++) {
    if (r < 2) {
      grid.push(crown[r].map(v => v === 1));
    } else {
      // Rows 2-7: fully solid (creates the rectangular body)
      grid.push(Array(BOSS_COLS).fill(true));
    }
  }
  return grid;
}

/** Count live voxels in each of the 3 logical columns */
function countColVoxels(voxels: VoxelGrid): [number, number, number] {
  const counts: [number, number, number] = [0, 0, 0];
  for (let r = 0; r < BOSS_ROWS; r++) {
    for (let vc = 0; vc < BOSS_COLS; vc++) {
      if (voxels[r][vc]) {
        counts[Math.floor(vc / VOXELS_PER_COL) as 0|1|2]++;
      }
    }
  }
  return counts;
}

// ─── Equation + answer generation ────────────────────────────
/**
 * Generate the equation and build 3 answer slots.
 * Returns: correctColIdx, columnAnswers, equation string.
 */
function generateBossEquation(
  wave: number,
  difficulty: number,
): {
  equation: string;
  correctColIdx: 0|1|2;
  columnAnswers: [number, number, number];
} {
  const { display, answer } = generateEquation(wave, difficulty);

  // Build 2 plausible decoys (same logic as generateAnswerBubbles but inline)
  const decoys = new Set<number>();
  const spread = Math.max(3, Math.round(answer * 0.2));
  const offsets = [-1, 1, -2, 2, -3, 3, spread, -spread, spread + 1, -spread - 1];
  for (const off of offsets) {
    const c = answer + off;
    if (c > 0 && c !== answer) { decoys.add(c); if (decoys.size >= 2) break; }
  }
  while (decoys.size < 2) {
    const r = randInt(
      Math.max(1, answer - Math.max(5, spread)),
      answer + Math.max(5, spread),
    );
    if (r !== answer) decoys.add(r);
  }

  const decoyArr = Array.from(decoys).slice(0, 2);
  const correctColIdx = (Math.floor(Math.random() * 3)) as 0|1|2;

  const columnAnswers: [number, number, number] = [0, 0, 0];
  let decoyIdx = 0;
  for (let col = 0; col < 3; col++) {
    columnAnswers[col] = col === correctColIdx ? answer : decoyArr[decoyIdx++];
  }

  return { equation: display, correctColIdx, columnAnswers };
}

// ─── Public API ───────────────────────────────────────────────

/** Spawn a fresh boss for the given wave + difficulty. */
export function createBoss(
  wave: number,
  difficulty: number,
  canvasW: number,
  nextId: number,
): VoxelBossState {
  const voxels = makeGrid();
  const { equation, correctColIdx, columnAnswers } = generateBossEquation(wave, difficulty);

  return {
    id: nextId,
    voxels,
    colVoxelCount: countColVoxels(voxels),
    correctColIdx,
    equation,
    columnAnswers,
    phase: 1,
    x: (canvasW - BOSS_W) / 2,
    y: -BOSS_H - 20,          // start off-screen above
    width: BOSS_W,
    height: BOSS_H,
    entryProgress: 0,
  };
}

/**
 * Determine which logical column (0/1/2) a canvas-x coordinate falls into.
 * Returns -1 if outside boss bounds.
 */
export function getBossLogicalCol(boss: VoxelBossState, canvasX: number): -1|0|1|2 {
  if (canvasX < boss.x || canvasX > boss.x + boss.width) return -1;
  const relX = canvasX - boss.x;
  return Math.floor(relX / (boss.width / LOGICAL_COLS)) as 0|1|2;
}

/**
 * Get the canvas x-range for a logical column.
 */
export function getBossColumnBounds(
  boss: VoxelBossState,
  logicalCol: 0|1|2,
): { x: number; w: number } {
  const colW = boss.width / LOGICAL_COLS;
  return { x: boss.x + logicalCol * colW, w: colW };
}

/**
 * Hit a specific canvas position on the boss.
 *
 * BRUTE FORCE RULE: ANY hit on ANY voxel ALWAYS destroys it.
 * The return value tells the caller whether the column was correct
 * so it can decide whether to trigger Overdrive:
 *
 *   'hit_correct' → voxel destroyed; column === correctColIdx  → trigger Overdrive
 *   'hit_wrong'   → voxel destroyed; wrong column              → no Overdrive
 *   'miss'        → bullet outside boss bounds or column empty  → bullet continues
 *
 * isOverdrive: when true, overdrive spread-bullets also apply the same rules
 * (overdrive bullets always use 'hit_correct' semantics regardless of column).
 */
export function hitBossVoxel(
  boss: VoxelBossState,
  bulletX: number,
  bulletY: number,
  isOverdrive: boolean,
): 'hit_correct' | 'hit_wrong' | 'miss' {

  // ── Entry invulnerability (defensive layer) ───────────────────
  // The outer collision block already guards this, but this ensures
  // the function is safe even if called directly during entry.
  if (boss.entryProgress < 1) return 'miss';

  // ── Bounds check (x) ─────────────────────────────────────────
  const logicalCol = getBossLogicalCol(boss, bulletX);
  if (logicalCol === -1) return 'miss';

  // ── Bounds check (y) ─────────────────────────────────────────
  // Allow a 4px top margin so bullets that just reach the crown register
  if (bulletY < boss.y - 4 || bulletY > boss.y + boss.height) return 'miss';

  // ── Map canvas-x → exact voxel column ────────────────────────
  const relX = bulletX - boss.x;
  const voxelCol = Math.floor(relX / VOXEL_W);
  const clampedVC = Math.max(0, Math.min(BOSS_COLS - 1, voxelCol));

  // ── Find topmost alive voxel in this pixel column ─────────────
  let hitRow = -1;
  for (let r = 0; r < BOSS_ROWS; r++) {
    if (boss.voxels[r][clampedVC]) { hitRow = r; break; }
  }
  if (hitRow === -1) return 'miss';  // entire voxel column already dead

  // ── Always destroy the voxel (Brute Force is valid) ──────────
  boss.voxels[hitRow][clampedVC] = false;
  boss.colVoxelCount = countColVoxels(boss.voxels);
  updatePhase(boss);

  // ── Was it the correct logical column? ───────────────────────
  // Overdrive bullets count as correct regardless of column (already earned).
  const isCorrectCol = logicalCol === boss.correctColIdx;
  return (isOverdrive || isCorrectCol) ? 'hit_correct' : 'hit_wrong';
}


/** Sync phase based on remaining voxel count ratio */
function updatePhase(boss: VoxelBossState): void {
  const total   = BOSS_COLS * BOSS_ROWS;
  const alive   = boss.colVoxelCount[0] + boss.colVoxelCount[1] + boss.colVoxelCount[2];
  const ratio   = alive / total;
  boss.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
}

/** True when every voxel has been destroyed. */
export function isBossDefeated(boss: VoxelBossState): boolean {
  return boss.colVoxelCount[0] + boss.colVoxelCount[1] + boss.colVoxelCount[2] === 0;
}
