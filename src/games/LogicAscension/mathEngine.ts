import { PathId } from './types';

// ── Question Interface ─────────────────────────────────────────────────────────
export interface Question {
  expression: string;
  hint: string;
  correctAnswer: number;
  wrongAnswers: [number, number, number];
  explanation: string;
}

// ── Question Bank ──────────────────────────────────────────────────────────────
export const QUESTION_BANK: Question[] = [
  {
    expression: '2 + 2 × 3',
    hint: 'Multiplicação antes da adição',
    correctAnswer: 8,
    wrongAnswers: [12, 9, 7],
    explanation: '2 + (2×3) = 2 + 6 = 8   [≠ (2+2)×3 = 12]',
  },
  {
    expression: '5 + 3 × 2',
    hint: 'Multiplicação antes da adição',
    correctAnswer: 11,
    wrongAnswers: [16, 13, 10],
    explanation: '5 + (3×2) = 5 + 6 = 11   [≠ (5+3)×2 = 16]',
  },
  {
    expression: '10 − 2 × 3',
    hint: 'Multiplicação antes da subtração',
    correctAnswer: 4,
    wrongAnswers: [24, 6, 3],
    explanation: '10 − (2×3) = 10 − 6 = 4   [≠ (10−2)×3 = 24]',
  },
  {
    expression: '4 × 3 − 2',
    hint: 'Multiplicação antes da subtração',
    correctAnswer: 10,
    wrongAnswers: [4, 12, 9],
    explanation: '(4×3) − 2 = 12 − 2 = 10   [≠ 4×(3−2) = 4]',
  },
  {
    expression: '6 ÷ 2 + 1',
    hint: 'Divisão antes da adição',
    correctAnswer: 4,
    wrongAnswers: [2, 5, 3],
    explanation: '(6÷2) + 1 = 3 + 1 = 4   [≠ 6÷(2+1) = 2]',
  },
  {
    expression: '8 − 4 ÷ 2',
    hint: 'Divisão antes da subtração',
    correctAnswer: 6,
    wrongAnswers: [2, 7, 4],
    explanation: '8 − (4÷2) = 8 − 2 = 6   [≠ (8−4)÷2 = 2]',
  },
  {
    expression: '3 + 2 × 4',
    hint: 'Multiplicação antes da adição',
    correctAnswer: 11,
    wrongAnswers: [20, 12, 10],
    explanation: '3 + (2×4) = 3 + 8 = 11   [≠ (3+2)×4 = 20]',
  },
  {
    expression: '15 ÷ 3 + 2',
    hint: 'Divisão antes da adição',
    correctAnswer: 7,
    wrongAnswers: [3, 9, 6],
    explanation: '(15÷3) + 2 = 5 + 2 = 7   [≠ 15÷(3+2) = 3]',
  },
  {
    expression: '2 × 3 + 4 × 2',
    hint: 'Calcule cada produto separadamente',
    correctAnswer: 14,
    wrongAnswers: [20, 16, 18],
    explanation: '(2×3) + (4×2) = 6 + 8 = 14',
  },
  {
    expression: '1 + 2 × 3 − 1',
    hint: 'Multiplicação primeiro, depois ±',
    correctAnswer: 6,
    wrongAnswers: [8, 5, 7],
    explanation: '1 + (2×3) − 1 = 1 + 6 − 1 = 6   [≠ (1+2)×3−1 = 8]',
  },
  {
    expression: '12 ÷ 4 − 1',
    hint: 'Divisão antes da subtração',
    correctAnswer: 2,
    wrongAnswers: [3, 4, 1],
    explanation: '(12÷4) − 1 = 3 − 1 = 2   [≠ 12÷(4−1) = 4]',
  },
  {
    expression: '5 × 2 + 3 × 2',
    hint: 'Calcule cada produto separadamente',
    correctAnswer: 16,
    wrongAnswers: [26, 20, 13],
    explanation: '(5×2) + (3×2) = 10 + 6 = 16',
  },
];

export function getRandomQuestion(): Question {
  return QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
}

// ── Oracle Constants ───────────────────────────────────────────────────────────
// [PLACEHOLDER] All values require playtest tuning.
const BUFF_SCALE      = 0.60;
const BUFF_ABSORPTION = 0.90;
const SAC_SCALE       = 0.50;
const SAC_ABSORPTION  = 0.70;

function formatMultLabel(mult: number): string {
  const map: Record<number, string> = {
    0.25: '×¼', 0.5: '×½', 0.75: '×¾', 1: '×1',
    1.25: '×1¼', 1.5: '×1.5', 2: '×2', 3: '×3',
  };
  return map[mult] ?? `×${mult}`;
}

// ── Oracle Result ──────────────────────────────────────────────────────────────
export interface OracleResult {
  /** Dynamically-generated levels for [Monster1, Monster2, Monster3]. */
  monsterLevels: [number, number, number];
  /**
   * The BASE room-buff multiplier before the MC transformation is applied.
   * Shown briefly in the UI to trigger the "shrink/grow" buff animation.
   *   Buff path  → base ×0.5  (curse shown first, then punished to ×0.25)
   *   Sac. path  → base ×2.0  (reward shown first, then upgraded to ×3.0)
   */
  baseBuffMultiplier: number;
  /** The FINAL room-buff multiplier after MC punishment / reward. */
  revealedBuffMultiplier: number;
  revealedBuffLabel: string;
  /** The entity order the Oracle identified as optimal. */
  optimalOrder: string[];
  /** One-line human-readable explanation of why this order is optimal. */
  rationale: string;
  /** Lines ready to push into the event log. */
  logLines: string[];
  /**
   * Projected player power at the end of this room, assuming the optimal path
   * is followed at the Oracle's expected absorption rate (90% buff / 70% sac).
   * Used by the Hardcore Oracle to seed Room-2 difficulty and the Boss level.
   */
  projectedPowerAfterRoom: number;
}

/**
 * ══════════════════════════════════════════════════════════════
 *  THE CHAINED ORACLE  —  Sprint 8 ProcGen Difficulty Scaler
 * ══════════════════════════════════════════════════════════════
 *
 * UNIFIED API:
 *   runOracle(playerPower, pathId)
 *     → Room 0 only (Sprint 7 MC-punishment/reward system)
 *       buff path  → room buff ×0.25 (curse first)
 *       sac  path  → room buff ×3.0  (buff last)
 *
 *   runOracle(playerPower, pathId, overrideBuffMult)
 *     → Rooms 1-4 (generic, uses provided buff multiplier)
 *       optimal order: buff first if < 1, buff last if ≥ 1
 *       same pathId scale / absorption constants apply
 *
 * CHAINING (Task 4):
 *   oracle.projectedPowerAfterRoom is fed as the next room's playerPower.
 *   Boss level = 90% of Room 5's projectedPowerAfterRoom (per-game maximum).
 */
export function runOracle(
  playerPower:     number,
  pathId:          PathId,
  /**
   * Optional: override room buff multiplier (rooms 1-4 use random values).
   * When omitted, falls back to Sprint-7 MC-specific values (Room 0).
   */
  overrideBuffMult?: number,
): OracleResult {
  const scale  = pathId === 'buff' ? BUFF_SCALE      : SAC_SCALE;
  const absorp = pathId === 'buff' ? BUFF_ABSORPTION : SAC_ABSORPTION;

  // ── Determine base / modified buff multipliers ─────────────────────────────
  let baseMult: number;
  let modMult:  number;

  if (overrideBuffMult === undefined) {
    // Sprint-7 MC punishment / reward logic (Room 0 only)
    if (pathId === 'buff') {
      baseMult = 0.5;   // original room curse
      modMult  = 0.25;  // intensified by MC_B's greed (base²)
    } else {
      baseMult = 2.0;   // original room buff
      modMult  = 3.0;   // enhanced by MC_S sacrifice (base + 1)
    }
  } else {
    baseMult = overrideBuffMult;
    modMult  = overrideBuffMult;
  }

  const buffFirst = modMult < 1; // curse → apply early; buff → apply late

  // ── Simulate optimal path ──────────────────────────────────────────────────
  let pp = playerPower;
  if (buffFirst) pp = Math.round(pp * modMult);

  const M1 = Math.max(1, Math.round(pp * scale));
  pp += M1 * absorp;
  const M2 = Math.max(1, Math.round(pp * scale));
  pp += M2 * absorp;
  const M3 = Math.max(1, Math.round(pp * scale));
  pp += M3 * absorp;

  if (!buffFirst) pp = Math.round(pp * modMult);

  const projectedPowerAfterRoom = Math.round(pp);
  const lbl  = formatMultLabel(modMult);
  const pct  = Math.round(absorp * 100);
  const room0 = overrideBuffMult === undefined;

  return {
    monsterLevels:           [M1, M2, M3],
    baseBuffMultiplier:       baseMult,
    revealedBuffMultiplier:   modMult,
    revealedBuffLabel:        lbl,
    optimalOrder:             buffFirst
      ? [`Buff(${lbl})`, 'M1', 'M2', 'M3']
      : ['M1', 'M2', 'M3', `Buff(${lbl})`],
    rationale: buffFirst
      ? `Buff ${lbl} < 1 → tome o debuff cedo, enquanto poder é baixo.`
      : `Buff ${lbl} ≥ 1 → acumule poder, multiplique no final.`,
    projectedPowerAfterRoom,
    logLines: room0
      ? [
          `🔮 Oracle [${pathId}] Sala-1: ${pathId === 'buff' ? 'MC×2 → MALDIÇÃO ×¼' : 'MC×½ → BÔNUS ×3'}`,
          `📊 Monstros [${pct}% abs.]: M1=${M1} · M2=${M2} · M3=${M3}`,
          `📈 Poder proj.: ${projectedPowerAfterRoom}`,
        ]
      : [
          `🔮 Oracle [${pathId}]: Buff ${lbl} | ${buffFirst ? 'debuff cedo' : 'buff tarde'}`,
          `📊 Monstros [${pct}% abs.]: M1=${M1} · M2=${M2} · M3=${M3}`,
          `📈 Poder proj.: ${projectedPowerAfterRoom}`,
        ],
  };
}

// ── Global Theoretical Maximum ─────────────────────────────────────────────
/**
 * Simulates the absolute perfect run through all 10 rooms (5 per path) from
 * `initialPower` (default 10), updated for Sprint-8 ProcGen:
 *   • Corridor TrickyBuff ×2 taken first.
 *   • Meta-optimal room order: Sacrifice FIRST, Buff SECOND.
 *   • Room 0 of each path uses MC punishment/reward buff.
 *   • Rooms 1-4 use ×1.25 as a representative mid-pool buff (taken last).
 *   • 100% monster absorption throughout (theoretical ceiling).
 *
 * Per-game boss level is derived from oracle.projectedPowerAfterRoom instead.
 * This function acts as an emergency fallback.
 */
export function calculateTheoreticalMax(initialPower = 10): number {
  function simRoom(pp: number, scale: number, modMult: number, buffFirst: boolean): number {
    if (buffFirst) pp = Math.round(pp * modMult);
    const m1 = Math.max(1, Math.round(pp * scale)); pp += m1;
    const m2 = Math.max(1, Math.round(pp * scale)); pp += m2;
    const m3 = Math.max(1, Math.round(pp * scale)); pp += m3;
    if (!buffFirst) pp = Math.round(pp * modMult);
    return pp;
  }

  let pp = Math.round(initialPower * 2); // corridor ×2

  // ── Sacrifice path: 5 rooms ────────────────────────────────────────────────
  pp = Math.round(pp * 0.5);                              // MC_S ×0.5
  pp = simRoom(pp, SAC_SCALE, 3.0,  false);               // Room 0: ×3 buff last
  for (let k = 1; k < 5; k++)
    pp = simRoom(pp, SAC_SCALE, 1.25, false);              // Rooms 1-4: ×1.25 buff last

  // ── Buff path: 5 rooms ─────────────────────────────────────────────────────
  pp = Math.round(pp * 2);                                // MC_B ×2
  pp = simRoom(pp, BUFF_SCALE, 0.25, true);               // Room 0: ×0.25 curse first
  for (let k = 1; k < 5; k++)
    pp = simRoom(pp, BUFF_SCALE, 1.25, false);             // Rooms 1-4: ×1.25 buff last

  return pp;
}
