// ============================================================
// LOGIC INVADERS — MATH ENGINE  (v3 — Difficulty Scaling)
// generateEquation now accepts difficultyMultiplier so
// numbers grow MUCH harder as surges accumulate.
// ============================================================

import type { AnswerBubble } from '../types';

export type OperationType = 'addition' | 'subtraction' | 'multiplication' | 'division';

export interface EquationResult {
  display: string;
  answer: number;
}

interface WaveConfig {
  ops: OperationType[];
  maxA: number;
  maxB: number;
}

/**
 * Returns base config for a given wave.
 * difficultyMultiplier then scales maxA/maxB FURTHER
 * so repeated surges genuinely make math harder.
 *
 * Baseline difficulty by wave:
 *   1-2  : addition/subtraction   (1-12)
 *   3-4  : + multiplication       (1-15)
 *   5-6  : + division             (2-20)
 *   7-9  : all ops                (2-25)
 *   10+  : all ops                (5-30)
 */
function getWaveConfig(wave: number, difficultyMultiplier: number): WaveConfig {
  // Base config per wave bracket
  let ops: OperationType[];
  let baseMaxA: number;
  let baseMaxB: number;

  if (wave <= 2) {
    ops = ['addition', 'subtraction'];
    baseMaxA = 12; baseMaxB = 12;
  } else if (wave <= 4) {
    ops = ['addition', 'subtraction', 'multiplication'];
    baseMaxA = 15; baseMaxB = 12;
  } else if (wave <= 6) {
    ops = ['addition', 'subtraction', 'multiplication', 'division'];
    baseMaxA = 20; baseMaxB = 15;
  } else if (wave <= 9) {
    ops = ['addition', 'subtraction', 'multiplication', 'division'];
    baseMaxA = 25; baseMaxB = 20;
  } else {
    ops = ['addition', 'subtraction', 'multiplication', 'division'];
    baseMaxA = 30; baseMaxB = 25;
  }

  // Scale by difficultyMultiplier — each surge/natural advance adds to this.
  // No hard cap here: wave+difficulty drive unbounded number complexity.
  // Multiplication/division each clamp their own factors inside the switch below.
  const maxA = Math.round(baseMaxA * difficultyMultiplier);
  const maxB = Math.round(baseMaxB * difficultyMultiplier);

  return { ops, maxA, maxB };
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOp(ops: OperationType[]): OperationType {
  return ops[Math.floor(Math.random() * ops.length)];
}

/**
 * Generate a single equation based on current wave + difficultyMultiplier.
 * Both parameters affect equation difficulty independently:
 *   - wave   : unlocks new operation types
 *   - multiplier: scales the size of operands
 */
export function generateEquation(wave: number, difficultyMultiplier: number = 1): EquationResult {
  const cfg = getWaveConfig(wave, difficultyMultiplier);
  const op = pickOp(cfg.ops);

  switch (op) {
    case 'addition': {
      const a = randInt(1, cfg.maxA);
      const b = randInt(1, cfg.maxB);
      return { display: `${a} + ${b}`, answer: a + b };
    }
    case 'subtraction': {
      const a = randInt(2, cfg.maxA + 5);
      const b = randInt(1, a);
      return { display: `${a} − ${b}`, answer: a - b };
    }
    case 'multiplication': {
      // Keep one factor smaller to avoid absurd answers
      const a = randInt(2, Math.min(cfg.maxA, 20));
      const b = randInt(2, Math.min(cfg.maxB, 15));
      return { display: `${a} × ${b}`, answer: a * b };
    }
    case 'division': {
      const b = randInt(2, Math.min(cfg.maxB, 20));
      const answer = randInt(2, Math.min(cfg.maxA, 25));
      const a = b * answer;
      return { display: `${a} ÷ ${b}`, answer };
    }
  }
}

/**
 * Build 3 floating-answer bubbles for an invader:
 * 1 correct + 2 plausible decoys, shuffled, each with an orbit angle.
 */
export function generateAnswerBubbles(correctAnswer: number): AnswerBubble[] {
  const decoys = new Set<number>();
  // Spread decoys relative to answer magnitude for realism
  const spread = Math.max(3, Math.round(correctAnswer * 0.2));
  const offsets = [-1, 1, -2, 2, -3, 3, spread, -spread, spread + 1, -spread - 1];

  for (const off of offsets) {
    const candidate = correctAnswer + off;
    if (candidate > 0 && candidate !== correctAnswer) {
      decoys.add(candidate);
      if (decoys.size >= 2) break;
    }
  }

  // Fallback randoms
  while (decoys.size < 2) {
    const r = randInt(Math.max(1, correctAnswer - Math.max(5, spread)), correctAnswer + Math.max(5, spread));
    if (r !== correctAnswer) decoys.add(r);
  }

  const values = [
    { value: correctAnswer, isCorrect: true },
    ...Array.from(decoys)
      .slice(0, 2)
      .map((v) => ({ value: v, isCorrect: false })),
  ];

  // Shuffle
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  // Orbit angles: left (200°), bottom (270°), right (340°)
  const baseAngles = [
    (200 * Math.PI) / 180,
    (270 * Math.PI) / 180,
    (340 * Math.PI) / 180,
  ];

  return values.map((v, i) => ({
    ...v,
    angle: baseAngles[i],
  }));
}
