import { PathId } from './types';

// ── Question Interface ─────────────────────────────────────────────────────────
export interface Question {
  expression:    string;
  hint:          string;
  correctAnswer: number;
  wrongAnswers:  [number, number, number];
  explanation:   string;
  /**
   * Optional button-label overrides for fraction answers.
   * Maps numeric value → display string (e.g. 0.75 → "3/4").
   * When absent the raw number is shown on the button.
   */
  answerLabels?: Record<number, string>;
}

// ── Fraction arithmetic ────────────────────────────────────────────────────────
type Frac = { n: number; d: number };

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

function fSim({ n, d }: Frac): Frac {
  if (n === 0) return { n: 0, d: 1 };
  const g = gcd(Math.abs(n), Math.abs(d));
  return d < 0 ? { n: -n / g, d: -d / g } : { n: n / g, d: d / g };
}
function fAdd(a: Frac, b: Frac): Frac { return fSim({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }); }
function fSub(a: Frac, b: Frac): Frac { return fAdd(a, { n: -b.n, d: b.d }); }
function fMul(a: Frac, b: Frac): Frac { return fSim({ n: a.n * b.n, d: a.d * b.d }); }
function fDiv(a: Frac, b: Frac): Frac { return fMul(a, { n: b.d, d: b.n }); }
function fVal({ n, d }: Frac): number  { return n / d; }
/** "(3/4)" for use inside expression strings. */
function fExpr({ n, d }: Frac): string { return d === 1 ? `${n}` : `(${n}/${d})`; }
/** "3/4" for answer button labels. */
function fLbl({ n, d }: Frac): string  { return d === 1 ? `${n}` : `${n}/${d}`; }

// ── Generator utilities ────────────────────────────────────────────────────────
function r(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Return exactly 3 distinct wrong answers (none equal to `correct`). */
function wrongs(correct: number, candidates: number[]): [number, number, number] {
  const snap = (v: number) => Math.round(v * 100000) / 100000;
  const seen = new Set<number>([snap(correct)]);
  const out: number[] = [];
  for (const raw of candidates) {
    const v = snap(raw);
    if (Number.isFinite(v) && !seen.has(v)) { seen.add(v); out.push(v); }
    if (out.length === 3) break;
  }
  for (let delta = 1; out.length < 3 && delta < 50; delta++) {
    const v = snap(correct + delta);
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out as [number, number, number];
}

/** Build an answerLabels map from Frac values (rounded keys for float safety). */
function mkFracLabels(fracs: Frac[]): Record<number, string> {
  const snap = (v: number) => Math.round(v * 100000) / 100000;
  const rec: Record<number, string> = {};
  for (const f of fracs) rec[snap(fVal(f))] = fLbl(f);
  return rec;
}

// ── Tier 1 — Basic integer PEMDAS (stages 1–2) ────────────────────────────────
function genTier1(): Question {
  const t = r(0, 5);

  if (t === 0) {  // A + B × C
    const A = r(2, 9), B = r(2, 5), C = r(2, 5);
    const ans = A + B * C, trap = (A + B) * C;
    return {
      expression: `${A} + ${B} × ${C}`,
      hint: 'Multiplicação antes da adição',
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, A + B + C, A * B + C]),
      explanation:
        `Passo 1: ${B} × ${C} = ${B * C}\n` +
        `Passo 2: ${A} + ${B * C} = ${ans}\n` +
        `[≠ Armadilha esq.→dir.: (${A}+${B})×${C} = ${trap}]`,
    };
  }
  if (t === 1) {  // A − B × C  (A > B×C)
    const B = r(2, 4), C = r(2, 4), A = B * C + r(1, 8);
    const ans = A - B * C, trap = (A - B) * C;
    return {
      expression: `${A} − ${B} × ${C}`,
      hint: 'Multiplicação antes da subtração',
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, A + B * C, A - B - C]),
      explanation:
        `Passo 1: ${B} × ${C} = ${B * C}\n` +
        `Passo 2: ${A} − ${B * C} = ${ans}\n` +
        `[≠ Armadilha: (${A}−${B})×${C} = ${trap} — erro PEMDAS]`,
    };
  }
  if (t === 2) {  // A × B + C
    const A = r(2, 6), B = r(2, 5), C = r(2, 9);
    const ans = A * B + C, trap = A * (B + C);
    return {
      expression: `${A} × ${B} + ${C}`,
      hint: 'Multiplicação antes da adição',
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, A * B - C, A + B + C]),
      explanation:
        `Passo 1: ${A} × ${B} = ${A * B}\n` +
        `Passo 2: ${A * B} + ${C} = ${ans}\n` +
        `[≠ Armadilha: ${A}×(${B}+${C}) = ${trap}]`,
    };
  }
  if (t === 3) {  // A × B − C  (A*B > C)
    const A = r(2, 6), B = r(2, 5), prod = A * B, C = r(1, prod - 1);
    const ans = prod - C, trap = A * (B - C);
    return {
      expression: `${A} × ${B} − ${C}`,
      hint: 'Multiplicação antes da subtração',
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, prod + C, A - B]),
      explanation:
        `Passo 1: ${A} × ${B} = ${prod}\n` +
        `Passo 2: ${prod} − ${C} = ${ans}\n` +
        `[≠ Armadilha: ${A}×(${B}−${C}) = ${trap}]`,
    };
  }
  if (t === 4) {  // (B×M) ÷ B + C
    const B = r(2, 5), M = r(2, 6), C = r(2, 8), A = B * M;
    const ans = M + C;
    return {
      expression: `${A} ÷ ${B} + ${C}`,
      hint: 'Divisão antes da adição',
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [M - C, M * C, A + C]),
      explanation:
        `Passo 1: ${A} ÷ ${B} = ${M}\n` +
        `Passo 2: ${M} + ${C} = ${ans}\n` +
        `[≠ Armadilha: ${M} − ${C} = ${M - C} — trocou + por −]`,
    };
  }
  // t === 5: A × B + C × D
  const [A5, B5, C5, D5] = [r(2, 5), r(2, 5), r(2, 5), r(2, 5)];
  const ans5 = A5 * B5 + C5 * D5, trap5 = (A5 * B5 + C5) * D5;
  return {
    expression: `${A5} × ${B5} + ${C5} × ${D5}`,
    hint: 'Calcule cada produto primeiro, depois some',
    correctAnswer: ans5,
    wrongAnswers: wrongs(ans5, [trap5, A5 * B5 + C5 + D5, A5 + B5 + C5 * D5]),
    explanation:
      `Passo 1: (${A5}×${B5}) = ${A5 * B5}   e   (${C5}×${D5}) = ${C5 * D5}\n` +
      `Passo 2: ${A5 * B5} + ${C5 * D5} = ${ans5}\n` +
      `[≠ Armadilha esq.→dir.: (${A5 * B5}+${C5})×${D5} = ${trap5}]`,
  };
}

// ── Tier 2 — Negative numbers & sign rules (stages 3–4) ───────────────────────
function genTier2(): Question {
  const t = r(0, 3);

  if (t === 0) {  // −A + B × C
    const A = r(2, 8), B = r(2, 5), C = r(2, 5);
    const ans = -A + B * C, trap = (-A + B) * C;
    return {
      expression: `−${A} + ${B} × ${C}`,
      hint: 'Multiplicação primeiro; aplique o sinal depois',
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, A + B * C, -(A + B * C)]),
      explanation:
        `Passo 1: ${B} × ${C} = ${B * C}\n` +
        `Passo 2: −${A} + ${B * C} = ${ans}\n` +
        `[≠ Armadilha: (−${A}+${B})×${C} = ${trap} — erro PEMDAS com negativo]`,
    };
  }
  if (t === 1) {  // A − (−B × C)  → double negative = +
    const A = r(3, 9), B = r(2, 4), C = r(2, 4), prod = B * C;
    const ans = A + prod, trap = A - prod;
    return {
      expression: `${A} − (−${B} × ${C})`,
      hint: 'Duplo negativo: −(−x) = +x',
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, A + B + C, prod - A]),
      explanation:
        `Passo 1: −${B} × ${C} = −${prod}\n` +
        `Passo 2: ${A} − (−${prod}) = ${A} + ${prod} = ${ans}\n` +
        `[≠ Armadilha: ${trap} — erro: ignorou o duplo negativo]`,
    };
  }
  if (t === 2) {  // A × (−B) + C   (C > A×B so result is positive)
    const A = r(2, 5), B = r(2, 5), C = A * B + r(1, 12);
    const ans = -A * B + C, trap = A * B + C;
    return {
      expression: `${A} × (−${B}) + ${C}`,
      hint: 'Positivo × Negativo = Negativo',
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, -(A * B + C), A * B - C]),
      explanation:
        `Passo 1: ${A} × (−${B}) = −${A * B}\n` +
        `Passo 2: −${A * B} + ${C} = ${ans}\n` +
        `[≠ Armadilha: +${trap} — esqueceu o sinal negativo do produto]`,
    };
  }
  // t === 3: −A × B + C × D
  const [A3, B3, C3, D3] = [r(2, 4), r(2, 4), r(3, 8), r(2, 5)];
  const ans3 = -A3 * B3 + C3 * D3, trap3 = (-A3 * B3 + C3) * D3;
  return {
    expression: `−${A3} × ${B3} + ${C3} × ${D3}`,
    hint: 'Calcule ambos os produtos com seus sinais',
    correctAnswer: ans3,
    wrongAnswers: wrongs(ans3, [trap3, A3 * B3 + C3 * D3, -(A3 * B3 + C3 * D3)]),
    explanation:
      `Passo 1: (−${A3}×${B3}) = −${A3 * B3}   e   (${C3}×${D3}) = ${C3 * D3}\n` +
      `Passo 2: −${A3 * B3} + ${C3 * D3} = ${ans3}\n` +
      `[≠ Armadilha: (−${A3 * B3}+${C3})×${D3} = ${trap3} — erro PEMDAS]`,
  };
}

// ── Tier 3 — Fraction addition & subtraction (stages 5–6) ─────────────────────
function genTier3(): Question {
  const t = r(0, 5);

  if (t === 0) {  // (P/Q) + (R/Q)  same denominator
    const Q = [2, 4, 8][r(0, 2)];
    const P = r(1, Q - 1), R = r(1, Q - P);
    const ans  = fSim({ n: P + R,     d: Q });
    const trap = fSim({ n: P + R,     d: Q + Q }); // sums denominators — common error
    const d1   = fSim({ n: P,         d: Q });
    const d2   = fSim({ n: P + R + 1, d: Q });
    return {
      expression: `(${P}/${Q}) + (${R}/${Q})`,
      hint: 'Mesmo denominador: some apenas os numeradores',
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      explanation:
        `Passo 1: Denominadores iguais (${Q}) → some os numeradores: ${P}+${R} = ${P + R}\n` +
        `Passo 2: ${P + R}/${Q} = ${fLbl(ans)}\n` +
        `[≠ Armadilha: ${fLbl(trap)} — somou os denominadores (${Q}+${Q}=${Q + Q})]`,
    };
  }
  if (t === 1) {  // (P/Q) − (R/Q)  same denominator (P > R, Q ≥ 4)
    const Q = [4, 8][r(0, 1)];
    const R = r(1, Q - 2), P = r(R + 1, Q - 1);
    const ans  = fSim({ n: P - R,     d: Q });
    const trap = fSim({ n: P + R,     d: Q }); // added instead of subtracted
    const d1   = fSim({ n: P - R + 1, d: Q });
    const d2   = fSim({ n: P,         d: Q });
    return {
      expression: `(${P}/${Q}) − (${R}/${Q})`,
      hint: 'Mesmo denominador: subtraia apenas os numeradores',
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      explanation:
        `Passo 1: Denominadores iguais (${Q}) → subtraia: ${P}−${R} = ${P - R}\n` +
        `Passo 2: ${P - R}/${Q} = ${fLbl(ans)}\n` +
        `[≠ Armadilha: ${fLbl(trap)} — somou em vez de subtrair]`,
    };
  }
  if (t === 2) {  // (1/2) + (A/4)
    const A = r(1, 3);
    const ans  = fAdd({ n: 1, d: 2 }, { n: A, d: 4 }); // = (2+A)/4
    const trap = fSim({ n: 1 + A, d: 6 });              // (1+A)/(2+4)
    const d1   = fSim({ n: A,     d: 4 });
    const d2   = fAdd(ans, { n: 1, d: 4 });
    return {
      expression: `(1/2) + (${A}/4)`,
      hint: 'Denominador comum: converta 1/2 → 2/4',
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      explanation:
        `Passo 1: 1/2 = 2/4  (denominador comum = 4)\n` +
        `Passo 2: 2/4 + ${A}/4 = ${2 + A}/4 = ${fLbl(ans)}\n` +
        `[≠ Armadilha: ${fLbl(trap)} — somou numeradores E denominadores separadamente]`,
    };
  }
  if (t === 3) {  // (A/4) + (1/2)
    const A = r(1, 3);
    const ans  = fAdd({ n: A, d: 4 }, { n: 1, d: 2 }); // = (A+2)/4
    const trap = fSim({ n: A + 1, d: 6 });
    const d1   = fSim({ n: A,     d: 4 });
    const d2   = fSub(ans, { n: 1, d: 4 });
    return {
      expression: `(${A}/4) + (1/2)`,
      hint: 'Denominador comum: converta 1/2 → 2/4',
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      explanation:
        `Passo 1: 1/2 = 2/4  (denominador comum = 4)\n` +
        `Passo 2: ${A}/4 + 2/4 = ${A + 2}/4 = ${fLbl(ans)}\n` +
        `[≠ Armadilha: ${fLbl(trap)} — somou numeradores E denominadores separadamente]`,
    };
  }
  if (t === 4) {  // (A/4) + (B/8)  LCD = 8
    const A = r(1, 3), B = r(1, 5);
    const ans  = fAdd({ n: A, d: 4 }, { n: B, d: 8 }); // = (2A+B)/8
    const trap = fSim({ n: A + B, d: 12 });             // (A+B)/(4+8)
    const d1   = fSim({ n: 2 * A, d: 8 });              // forgot to add B
    const d2   = fAdd(ans, { n: 1, d: 8 });
    return {
      expression: `(${A}/4) + (${B}/8)`,
      hint: `Denominador comum: converta ${A}/4 → ${2 * A}/8`,
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      explanation:
        `Passo 1: ${A}/4 = ${2 * A}/8  (denominador comum = 8)\n` +
        `Passo 2: ${2 * A}/8 + ${B}/8 = ${2 * A + B}/8 = ${fLbl(ans)}\n` +
        `[≠ Armadilha: ${fLbl(trap)} — somou numeradores E denominadores]`,
    };
  }
  // t === 5: (A/8) − (B/8)
  const B8 = r(1, 5), A8 = r(B8 + 1, 7);
  const ans8  = fSim({ n: A8 - B8,     d: 8 });
  const trap8 = fSim({ n: A8 + B8,     d: 8 }); // added instead of subtracted
  const d1_8  = fSim({ n: A8 - B8 - 1, d: 8 });
  const d2_8  = fSim({ n: A8,          d: 8 });
  return {
    expression: `(${A8}/8) − (${B8}/8)`,
    hint: 'Mesmo denominador: subtraia apenas os numeradores',
    correctAnswer: fVal(ans8),
    wrongAnswers: wrongs(fVal(ans8), [fVal(trap8), fVal(d1_8), fVal(d2_8)]),
    answerLabels: mkFracLabels([ans8, trap8, d1_8, d2_8]),
    explanation:
      `Passo 1: Denominadores iguais (8) → subtraia: ${A8}−${B8} = ${A8 - B8}\n` +
      `Passo 2: ${A8 - B8}/8 = ${fLbl(ans8)}\n` +
      `[≠ Armadilha: ${fLbl(trap8)} — somou em vez de subtrair]`,
  };
}

// ── Tier 4 — Fraction multiplication & division (stages 7+) ───────────────────
function genTier4(): Question {
  const t = r(0, 4);

  if (t <= 1) {  // (A/D) × N → integer result
    const D = r(0, 1) === 0 ? 2 : 4;
    const k = r(1, 3), N = D * k, A = r(1, D - 1);
    const ans:  Frac = { n: A * k,               d: 1 };
    const trap: Frac = { n: A * N,               d: 1 }; // forgot denominator
    const d1:   Frac = { n: A * k + 1,           d: 1 };
    const d2:   Frac = { n: Math.max(0, A * k - 1), d: 1 };
    return {
      expression: `(${A}/${D}) × ${N}`,
      hint: 'Multiplique: (A/D) × N = (A×N) ÷ D',
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      explanation:
        `Passo 1: (${A}/${D}) × ${N} = (${A}×${N}) ÷ ${D} = ${A * N}/${D}\n` +
        `Passo 2: ${A * N} ÷ ${D} = ${fLbl(ans)}\n` +
        `[≠ Armadilha: ${A * N} — multiplicou sem dividir por ${D}]`,
    };
  }

  // t = 2,3,4: (A/D1) ÷ (A/D2) where D2 > D1 → result = D2/D1 (integer)
  // Trap (reversed division) = D1/D2 — always a clean binary fraction
  const divPairs: Array<[number, number, number]> = [
    [2, 4, 2],  // (A/2)÷(A/4) = 2,  trap = 1/2 = 0.5
    [4, 8, 2],  // (A/4)÷(A/8) = 2,  trap = 1/2 = 0.5
    [2, 8, 4],  // (A/2)÷(A/8) = 4,  trap = 1/4 = 0.25
  ];
  const [D1, D2, correctInt] = divPairs[t - 2];
  const A      = r(1, Math.max(1, Math.min(D1, D2) - 1));
  const lhs:     Frac = { n: A,          d: D1 };
  const rhs:     Frac = { n: A,          d: D2 };
  const ansF:    Frac = { n: correctInt, d: 1  };
  const trapF:   Frac = fDiv(rhs, lhs);           // reversed = D1/D2
  const d1F:     Frac = { n: correctInt + 1, d: 1 };
  const d2F:     Frac = { n: correctInt + 2, d: 1 };
  const invRhs:  Frac = { n: D2, d: A };          // inverted rhs for explanation
  return {
    expression:    `${fExpr(lhs)} ÷ ${fExpr(rhs)}`,
    hint:          'Divisão de frações: Keep × Change × Flip (inverta a 2ª e multiplique)',
    correctAnswer: fVal(ansF),
    wrongAnswers:  wrongs(fVal(ansF), [fVal(trapF), fVal(d1F), fVal(d2F)]),
    answerLabels:  mkFracLabels([ansF, trapF, d1F, d2F]),
    explanation:
      `Regra KCF: ${fExpr(lhs)} ÷ ${fExpr(rhs)}  →  ${fExpr(lhs)} × ${fExpr(invRhs)}\n` +
      `= (${A}×${D2}) / (${D1}×${A}) = ${A * D2}/${D1 * A} = ${fLbl(ansF)}\n` +
      `[≠ Armadilha: ${fLbl(trapF)} — inverteu a fração errada]`,
  };
}

// ── Public API — Dynamic Question Generator ────────────────────────────────────
/**
 * Generates a fully unique, stage-scaled math question on the fly.
 *   Tier 1 (stages 1–2): Basic integer PEMDAS.
 *   Tier 2 (stages 3–4): Negative numbers and sign rules.
 *   Tier 3 (stages 5–6): Fraction addition & subtraction (LCD method).
 *   Tier 4 (stages 7+):  Fraction multiplication & division (KCF rule).
 */
export function generateDynamicQuestion(stage: number): Question {
  const tier = stage <= 2 ? 1 : stage <= 4 ? 2 : stage <= 6 ? 3 : 4;
  switch (tier) {
    case 1:  return genTier1();
    case 2:  return genTier2();
    case 3:  return genTier3();
    default: return genTier4();
  }
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
