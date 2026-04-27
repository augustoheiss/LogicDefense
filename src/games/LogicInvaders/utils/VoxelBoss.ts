// ============================================================
// LOGIC INVADERS — VOXEL BOSS  (v2 — 4 Unique Pixel-Art Designs)
// Pure-logic module — no React, no canvas dependencies.
// All rendering lives in useGameEngine.ts.
// ============================================================
import type { VoxelBossState, VoxelGrid } from '../types';
import { generateEquation, randInt } from './mathEngine';

// ─── Fixed canvas footprint (never changes — preserves mobile CSS) ─────────
export const BOSS_W = 420;
export const BOSS_H = 168;
export const LOGICAL_COLS = 3;

// Legacy exports kept so existing non-boss render code compiles.
// The renderer should prefer boss.voxelW / boss.voxelH / boss.rows / boss.cols.
export const BOSS_COLS      = 15;
export const BOSS_ROWS      = 10;
export const VOXEL_W        = BOSS_W / BOSS_COLS;
export const VOXEL_H        = BOSS_H / BOSS_ROWS;
export const VOXELS_PER_COL = BOSS_COLS / LOGICAL_COLS;

// ─── Boss design registry ─────────────────────────────────────────────────

interface BossDesign {
  name: string;
  cols: number;  // must be divisible by LOGICAL_COLS (3)
  rows: number;
  palette: [string, string, string]; // [left-col color, center-col, right-col]
  coreBlock: { row: number; col: number };
  matrix: number[][];
}

/**
 * 4 unique pixel-art boss designs.
 * All use 0 = empty, 1 = solid block.
 * Cols must be divisible by 3 for the logical-column system.
 */
const BOSS_DESIGNS: BossDesign[] = [

  // ── Boss 0: DREADNOUGHT ── Fire Orange — 15 cols × 10 rows ───────────
  {
    name: 'DREADNOUGHT',
    cols: 15, rows: 10,
    palette: ['#ff4400', '#ff8800', '#ffaa00'],
    coreBlock: { row: 3, col: 7 },  // dead center — the bridge
    matrix: [
      [0,0,1,0,0,0,0,0,0,0,0,0,1,0,0],  // row 0: horn tips
      [0,1,1,1,0,0,0,0,0,0,0,1,1,1,0],  // row 1: shoulders
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],  // row 2: full chest
      [1,1,0,1,1,1,1,1,1,1,1,1,0,1,1],  // row 3: eye sockets (CORE at col 7)
      [1,1,0,1,1,1,1,1,1,1,1,1,0,1,1],  // row 4: eye sockets (continued)
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],  // row 5: jaw plate
      [0,1,1,0,1,0,1,1,1,0,1,0,1,1,0],  // row 6: cannon ports
      [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],  // row 7: belly
      [0,0,0,1,1,0,1,1,1,0,1,1,0,0,0],  // row 8: landing gear
      [0,0,0,0,1,0,1,0,1,0,1,0,0,0,0],  // row 9: engine nozzles
    ],
  },

  // ── Boss 1: PHANTOM ── Magenta/Purple — 15 cols × 12 rows ────────────
  {
    name: 'PHANTOM',
    cols: 15, rows: 12,
    palette: ['#aa00ff', '#ff00ff', '#ff88cc'],
    coreBlock: { row: 5, col: 7 },  // center face — the soul
    matrix: [
      [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],  // row 0: dome tip
      [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],  // row 1: dome mid
      [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],  // row 2: dome base
      [0,1,1,1,0,0,1,1,1,0,0,1,1,1,0],  // row 3: hollow eye sockets
      [0,1,1,1,0,0,1,1,1,0,0,1,1,1,0],  // row 4: hollow eye sockets
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],  // row 5: full face (CORE at col 7)
      [1,1,1,1,0,1,1,1,1,1,0,1,1,1,1],  // row 6: fang row
      [1,1,0,1,1,1,1,1,1,1,1,1,0,1,1],  // row 7: body
      [1,0,0,0,1,1,1,1,1,1,1,0,0,0,1],  // row 8: waist
      [1,1,0,0,0,1,1,1,1,1,0,0,0,1,1],  // row 9: tentacle base
      [0,1,1,0,0,0,1,1,1,0,0,0,1,1,0],  // row 10: tentacles
      [0,0,1,0,0,0,0,1,0,0,0,0,1,0,0],  // row 11: tentacle tips
    ],
  },

  // ── Boss 2: HYDRA ── Toxic Green — 18 cols × 12 rows ─────────────────
  {
    name: 'HYDRA',
    cols: 18, rows: 12,
    palette: ['#00ff88', '#00ffcc', '#88ff44'],
    coreBlock: { row: 5, col: 9 },  // center of mass — the brain
    matrix: [
      [1,1,0,0,0,1,1,1,0,0,0,1,1,0,0,0,1,1],  // row 0: 3 heads
      [1,1,1,0,1,1,1,1,1,0,1,1,1,1,0,0,1,1],  // row 1: heads widen
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],  // row 2: neck merge
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],  // row 3: upper body
      [0,1,0,1,1,0,1,1,1,1,1,0,1,1,0,1,1,0],  // row 4: eyes/armor pattern
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],  // row 5: main body (CORE at col 9)
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],  // row 6: main body
      [1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1],  // row 7: segment joints
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],  // row 8: full width
      [1,1,0,1,1,1,0,1,1,1,1,0,1,1,1,0,1,1],  // row 9: more joints
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],  // row 10: lower body
      [0,0,1,1,0,0,1,0,1,0,0,1,0,0,1,1,0,0],  // row 11: feet/claws
    ],
  },

  // ── Boss 3: COLOSSUS ── Ice Blue — 15 cols × 15 rows ─────────────────
  {
    name: 'COLOSSUS',
    cols: 15, rows: 15,
    palette: ['#00d4ff', '#0088ff', '#00ffff'],
    coreBlock: { row: 7, col: 7 },  // chest reactor — the heart
    matrix: [
      [0,0,1,0,0,0,0,0,0,0,0,0,1,0,0],  // row 0: shoulder horns
      [0,1,1,1,0,0,0,0,0,0,0,1,1,1,0],  // row 1: pauldrons
      [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],  // row 2: head top
      [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],  // row 3: head
      [0,0,1,0,1,1,1,1,1,1,1,0,1,0,0],  // row 4: visor gap
      [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0],  // row 5: neck
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],  // row 6: chest top
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],  // row 7: full chest (CORE at col 7)
      [1,1,0,1,1,1,1,1,1,1,1,1,0,1,1],  // row 8: ribcage gaps
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],  // row 9: belly plate
      [0,0,1,1,1,0,1,1,1,1,0,1,1,1,0],  // row 10: waist details
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0],  // row 11: upper legs
      [0,0,1,1,1,0,1,1,1,1,0,1,1,1,0],  // row 12: thigh gaps
      [0,0,1,1,0,0,1,1,1,1,0,0,1,1,0],  // row 13: shins
      [0,0,1,0,0,0,0,1,1,0,0,0,0,1,0],  // row 14: feet
    ],
  },
];

// ─── Grid factory ─────────────────────────────────────────────────────────

function makeGrid(design: BossDesign): VoxelGrid {
  return design.matrix.map(row => row.map(v => v === 1));
}

function countColVoxels(
  voxels: VoxelGrid,
  rows: number,
  cols: number,
  voxelsPerLogicalCol: number,
): [number, number, number] {
  const counts: [number, number, number] = [0, 0, 0];
  for (let r = 0; r < rows; r++) {
    for (let vc = 0; vc < cols; vc++) {
      if (voxels[r][vc]) {
        counts[Math.floor(vc / voxelsPerLogicalCol) as 0|1|2]++;
      }
    }
  }
  return counts;
}

function countTotalVoxels(voxels: VoxelGrid): number {
  return voxels.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

// ─── Equation + answer generation ─────────────────────────────────────────

function generateBossEquation(
  wave: number,
  difficulty: number,
): { equation: string; correctColIdx: 0|1|2; columnAnswers: [number,number,number] } {
  const { display, answer } = generateEquation(wave, difficulty);
  const decoys = new Set<number>();
  const spread = Math.max(3, Math.round(answer * 0.2));
  const offsets = [-1, 1, -2, 2, -3, 3, spread, -spread, spread + 1, -spread - 1];
  for (const off of offsets) {
    const c = answer + off;
    if (c > 0 && c !== answer) { decoys.add(c); if (decoys.size >= 2) break; }
  }
  while (decoys.size < 2) {
    const r = randInt(Math.max(1, answer - Math.max(5, spread)), answer + Math.max(5, spread));
    if (r !== answer) decoys.add(r);
  }
  const decoyArr = Array.from(decoys).slice(0, 2);
  const correctColIdx = (Math.floor(Math.random() * 3)) as 0|1|2;
  const columnAnswers: [number, number, number] = [0, 0, 0];
  let di = 0;
  for (let col = 0; col < 3; col++) {
    columnAnswers[col] = col === correctColIdx ? answer : decoyArr[di++];
  }
  return { equation: display, correctColIdx, columnAnswers };
}

// ─── Public API ───────────────────────────────────────────────────────────

/** Spawn a boss for the given design index (0–3), wave, and difficulty. */
export function createBoss(
  wave: number,
  difficulty: number,
  canvasW: number,
  nextId: number,
  bossIndex: number,
): VoxelBossState {
  const design = BOSS_DESIGNS[bossIndex % BOSS_DESIGNS.length];
  const voxels = makeGrid(design);
  const voxelsPerLogicalCol = design.cols / LOGICAL_COLS;
  const voxelW = BOSS_W / design.cols;
  const voxelH = BOSS_H / design.rows;
  const colVoxelCount = countColVoxels(voxels, design.rows, design.cols, voxelsPerLogicalCol);
  const startingVoxelCount = countTotalVoxels(voxels);
  const { equation, correctColIdx, columnAnswers } = generateBossEquation(wave, difficulty);

  return {
    id: nextId,
    voxels,
    colVoxelCount,
    correctColIdx,
    equation,
    columnAnswers,
    phase: 1,
    x: (canvasW - BOSS_W) / 2,
    y: -BOSS_H - 20,
    width: BOSS_W,
    height: BOSS_H,
    entryProgress: 0,
    // per-design
    bossIndex,
    bossName: design.name,
    palette: design.palette,
    voxelW,
    voxelH,
    rows: design.rows,
    cols: design.cols,
    voxelsPerLogicalCol,
    coreBlock: design.coreBlock,
    startingVoxelCount,
  };
}

/** Get the logical column (0/1/2) a canvas-x falls into. Returns -1 if outside. */
export function getBossLogicalCol(boss: VoxelBossState, canvasX: number): -1|0|1|2 {
  if (canvasX < boss.x || canvasX > boss.x + boss.width) return -1;
  const relX = canvasX - boss.x;
  return Math.floor(relX / (boss.width / LOGICAL_COLS)) as 0|1|2;
}

/** Get the canvas x-range for a logical column. */
export function getBossColumnBounds(
  boss: VoxelBossState,
  logicalCol: 0|1|2,
): { x: number; w: number } {
  const colW = boss.width / LOGICAL_COLS;
  return { x: boss.x + logicalCol * colW, w: colW };
}

/** Sync phase based on remaining voxel count ratio */
function updatePhase(boss: VoxelBossState): void {
  const alive = boss.colVoxelCount[0] + boss.colVoxelCount[1] + boss.colVoxelCount[2];
  const ratio = alive / boss.startingVoxelCount;
  boss.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
}

/**
 * Instantly zero out all voxels (used for insta-kill after core assassination).
 */
function wipeAllVoxels(boss: VoxelBossState): void {
  for (let r = 0; r < boss.rows; r++)
    for (let vc = 0; vc < boss.cols; vc++)
      boss.voxels[r][vc] = false;
  boss.colVoxelCount = [0, 0, 0];
  boss.phase = 3;
}

/**
 * Hit a specific canvas position on the boss.
 *
 * BRUTE FORCE: any bullet destroys any non-core voxel on contact.
 * CORE BLOCK RULES:
 *   isEmpowered = true  → voxel destroyed + 'insta_kill' returned (assassination!)
 *   isEmpowered = false → bullet deflected, voxel survives → 'deflected_core'
 *
 * Return values:
 *   'hit_correct'   → voxel destroyed; correct col or Overdrive → trigger Overdrive
 *   'hit_wrong'     → voxel destroyed; wrong col              → no Overdrive
 *   'insta_kill'    → core block hit with empowered bullet    → defeat boss NOW
 *   'deflected_core'→ core block hit with standard bullet     → bounce, no damage
 *   'miss'          → outside bounds or column already empty
 */
export function hitBossVoxel(
  boss: VoxelBossState,
  bulletX: number,
  bulletY: number,
  isOverdrive: boolean,
  isEmpowered: boolean,
): 'hit_correct' | 'hit_wrong' | 'insta_kill' | 'deflected_core' | 'miss' {

  if (boss.entryProgress < 1) return 'miss';

  const logicalCol = getBossLogicalCol(boss, bulletX);
  if (logicalCol === -1) return 'miss';

  if (bulletY < boss.y - 4 || bulletY > boss.y + boss.height) return 'miss';

  const relX = bulletX - boss.x;
  const voxelCol = Math.floor(relX / boss.voxelW);
  const clampedVC = Math.max(0, Math.min(boss.cols - 1, voxelCol));

  // Find topmost alive voxel in this pixel column
  let hitRow = -1;
  for (let r = 0; r < boss.rows; r++) {
    if (boss.voxels[r][clampedVC]) { hitRow = r; break; }
  }
  if (hitRow === -1) return 'miss';

  // ── Core block check ────────────────────────────────────────────────────
  const isCore = hitRow === boss.coreBlock.row && clampedVC === boss.coreBlock.col;
  if (isCore) {
    if (isEmpowered || isOverdrive) {
      // Assassination: wipe the boss instantly
      wipeAllVoxels(boss);
      return 'insta_kill';
    } else {
      // Armored deflection — bullet bounces, voxel survives
      return 'deflected_core';
    }
  }

  // ── Normal voxel destruction ─────────────────────────────────────────────
  boss.voxels[hitRow][clampedVC] = false;
  boss.colVoxelCount = countColVoxels(boss.voxels, boss.rows, boss.cols, boss.voxelsPerLogicalCol);
  updatePhase(boss);

  const isCorrectCol = logicalCol === boss.correctColIdx;
  return (isOverdrive || isCorrectCol) ? 'hit_correct' : 'hit_wrong';
}

/**
 * True when ≥85% of starting voxels are destroyed
 * (alive count ≤ 15% of startingVoxelCount).
 */
export function isBossDefeated(boss: VoxelBossState): boolean {
  const alive = boss.colVoxelCount[0] + boss.colVoxelCount[1] + boss.colVoxelCount[2];
  return alive <= Math.floor(boss.startingVoxelCount * 0.15);
}

/** Export design names for use in UI / particles */
export const BOSS_NAMES = BOSS_DESIGNS.map(d => d.name);
