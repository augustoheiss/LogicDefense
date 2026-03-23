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

// ── Tier 1 — Basic integer PEMDAS ─────────────────────────────────────────────
function genTier1(cycle: number): Question {
  const t = r(0, 5);
  // rA: addend range — grows aggressively each cycle (e.g. cycle 1 → double-digit addends)
  // rM: multiplier range — grows moderately to keep products tractable
  const rA = (lo: number, hi: number) => r(lo + cycle * 2, hi + cycle * 5);
  const rM = (lo: number, hi: number) => r(lo + cycle,     hi + cycle * 3);

  if (t === 0) {  // A + B × C
    const A = rA(2, 9), B = rM(2, 5), C = rM(2, 5);
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
    const B = rM(2, 4), C = rM(2, 4), A = B * C + r(1, 8 + cycle * 4);
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
    const A = rM(2, 6), B = rM(2, 5), C = rA(2, 9);
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
    const A = rM(2, 6), B = rM(2, 5), prod = A * B, C = r(1, prod - 1);
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
    const B = rM(2, 5), M = rM(2, 6), C = rA(2, 8), A = B * M;
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
  const A5 = rM(2, 5), B5 = rM(2, 5), C5 = rM(2, 5), D5 = rM(2, 5);
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

// ── Tier 2 — Negative numbers & sign rules ────────────────────────────────────
function genTier2(cycle: number): Question {
  const t = r(0, 3);
  const rA = (lo: number, hi: number) => r(lo + cycle * 2, hi + cycle * 5);
  const rM = (lo: number, hi: number) => r(lo + cycle,     hi + cycle * 3);

  if (t === 0) {  // −A + B × C
    const A = rA(2, 8), B = rM(2, 5), C = rM(2, 5);
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
    const A = rA(3, 9), B = rM(2, 4), C = rM(2, 4), prod = B * C;
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
    const A = rM(2, 5), B = rM(2, 5), C = A * B + r(1, 12 + cycle * 5);
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
  const A3 = rM(2, 4), B3 = rM(2, 4), C3 = rA(3, 8), D3 = rM(2, 5);
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

// ── Tier 3 — Fraction addition & subtraction ──────────────────────────────────
function genTier3(cycle: number): Question {
  const t = r(0, 5);

  // Cycle 0: classic binary denominators. Cycle 1+: add thirds, sixths, ninths, twelfths.
  // Subtraction pool requires Q ≥ 3 so R < Q − 1 is always satisfiable.
  const addPool = cycle === 0 ? [2, 4, 8]    : [2, 3, 4, 6, 8, 9, 12];
  const subPool = cycle === 0 ? [4, 8]       : [3, 4, 6, 8, 9, 12];

  // Cross-denom pairs for (1/D1) + (A/D2): D1 divides D2, factor = D2/D1
  type DenomPair = { D1: number; D2: number; factor: number };
  const crossPairs: DenomPair[] = cycle === 0
    ? [{ D1: 2, D2: 4, factor: 2 }]
    : [
        { D1: 2, D2: 4,  factor: 2 },
        { D1: 3, D2: 9,  factor: 3 },
        { D1: 4, D2: 8,  factor: 2 },
        { D1: 3, D2: 6,  factor: 2 },
        { D1: 6, D2: 12, factor: 2 },
      ];

  // LCD pairs for (A/D1) + (B/D2): D1 divides D2, general numerators
  const lcdPairs: DenomPair[] = cycle === 0
    ? [{ D1: 4, D2: 8, factor: 2 }]
    : [
        { D1: 4, D2: 8,  factor: 2 },
        { D1: 3, D2: 9,  factor: 3 },
        { D1: 6, D2: 12, factor: 2 },
        { D1: 4, D2: 12, factor: 3 },
      ];

  if (t === 0) {  // (P/Q) + (R/Q)  same denominator
    const Q = addPool[r(0, addPool.length - 1)];
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

  if (t === 1) {  // (P/Q) − (R/Q)  same denominator (P > R, Q ≥ 3)
    const Q = subPool[r(0, subPool.length - 1)];
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

  if (t === 2) {  // (1/D1) + (A/D2)  — convert the unit fraction to the LCD
    const { D1, D2, factor } = crossPairs[r(0, crossPairs.length - 1)];
    const A    = r(1, factor + 1);
    const ans  = fAdd({ n: 1, d: D1 }, { n: A, d: D2 });
    const trap = fSim({ n: 1 + A,  d: D1 + D2 }); // summed numerators AND denominators
    const d1   = fSim({ n: A,      d: D2 });       // forgot to add the converted numerator
    const d2   = fAdd(ans, { n: 1, d: D2 });
    return {
      expression: `(1/${D1}) + (${A}/${D2})`,
      hint: `Denominador comum: converta 1/${D1} → ${factor}/${D2}`,
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      explanation:
        `Passo 1: 1/${D1} = ${factor}/${D2}  (denominador comum = ${D2})\n` +
        `Passo 2: ${factor}/${D2} + ${A}/${D2} = ${factor + A}/${D2} = ${fLbl(ans)}\n` +
        `[≠ Armadilha: ${fLbl(trap)} — somou numeradores E denominadores separadamente]`,
    };
  }

  if (t === 3) {  // (A/D2) + (1/D1)  — same concept, flipped order
    const { D1, D2, factor } = crossPairs[r(0, crossPairs.length - 1)];
    const A    = r(1, factor + 1);
    const ans  = fAdd({ n: A, d: D2 }, { n: 1, d: D1 });
    const trap = fSim({ n: A + 1, d: D1 + D2 });
    const d1   = fSim({ n: A,     d: D2 });
    const d2   = fSub(ans, { n: 1, d: D2 });
    return {
      expression: `(${A}/${D2}) + (1/${D1})`,
      hint: `Denominador comum: converta 1/${D1} → ${factor}/${D2}`,
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      explanation:
        `Passo 1: 1/${D1} = ${factor}/${D2}  (denominador comum = ${D2})\n` +
        `Passo 2: ${A}/${D2} + ${factor}/${D2} = ${A + factor}/${D2} = ${fLbl(ans)}\n` +
        `[≠ Armadilha: ${fLbl(trap)} — somou numeradores E denominadores separadamente]`,
    };
  }

  if (t === 4) {  // (A/D1) + (B/D2)  LCD = D2 — general numerators
    const { D1, D2, factor } = lcdPairs[r(0, lcdPairs.length - 1)];
    const A    = r(1, D1 - 1);
    const B    = r(1, D2 - 1);
    const ans  = fAdd({ n: A, d: D1 }, { n: B, d: D2 });
    const trap = fSim({ n: A + B,      d: D1 + D2 });   // summed both parts naively
    const d1   = fSim({ n: factor * A, d: D2 });         // converted correctly, forgot B
    const d2   = fAdd(ans, { n: 1, d: D2 });
    return {
      expression: `(${A}/${D1}) + (${B}/${D2})`,
      hint: `Denominador comum: converta ${A}/${D1} → ${factor * A}/${D2}`,
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      explanation:
        `Passo 1: ${A}/${D1} = ${factor * A}/${D2}  (denominador comum = ${D2})\n` +
        `Passo 2: ${factor * A}/${D2} + ${B}/${D2} = ${factor * A + B}/${D2} = ${fLbl(ans)}\n` +
        `[≠ Armadilha: ${fLbl(trap)} — somou numeradores E denominadores]`,
    };
  }

  // t === 5: (A/Q) − (B/Q)  same denominator subtraction
  const Q5  = subPool[r(0, subPool.length - 1)];
  const B5  = r(1, Q5 - 2), A5 = r(B5 + 1, Q5 - 1);
  const ans5  = fSim({ n: A5 - B5,     d: Q5 });
  const trap5 = fSim({ n: A5 + B5,     d: Q5 }); // added instead of subtracted
  const d1_5  = fSim({ n: A5 - B5 - 1, d: Q5 });
  const d2_5  = fSim({ n: A5,          d: Q5 });
  return {
    expression: `(${A5}/${Q5}) − (${B5}/${Q5})`,
    hint: 'Mesmo denominador: subtraia apenas os numeradores',
    correctAnswer: fVal(ans5),
    wrongAnswers: wrongs(fVal(ans5), [fVal(trap5), fVal(d1_5), fVal(d2_5)]),
    answerLabels: mkFracLabels([ans5, trap5, d1_5, d2_5]),
    explanation:
      `Passo 1: Denominadores iguais (${Q5}) → subtraia: ${A5}−${B5} = ${A5 - B5}\n` +
      `Passo 2: ${A5 - B5}/${Q5} = ${fLbl(ans5)}\n` +
      `[≠ Armadilha: ${fLbl(trap5)} — somou em vez de subtrair]`,
  };
}

// ── Tier 4 — Fraction multiplication & division ───────────────────────────────
function genTier4(cycle: number): Question {
  const t = r(0, 4);

  if (t <= 1) {  // (A/D) × N → integer result
    // Cycle 0: D ∈ {2,4}. Cycle 1+: expand to {2,4,6,8} for larger integer products.
    const dPool: number[] = cycle === 0 ? [2, 4] : [2, 4, 6, 8];
    const D = dPool[r(0, dPool.length - 1)];
    const k = r(1, 3 + cycle * 2), N = D * k, A = r(1, D - 1);
    const ans:  Frac = { n: A * k,                  d: 1 };
    const trap: Frac = { n: A * N,                  d: 1 }; // forgot to divide by D
    const d1:   Frac = { n: A * k + 1,              d: 1 };
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

  // t = 2,3,4: (A/D1) ÷ (A/D2) → integer result = D2/D1
  // Trap (reversed division) = D1/D2 — always a clean fraction.
  // Cycle 0: classic binary pairs. Cycle 1+: add thirds, sixths and wider ratios.
  type DivPair = [number, number, number]; // [D1, D2, correctInt]
  const basePairs: DivPair[] = [
    [2, 4, 2],   // (A/2)÷(A/4)  = 2,  trap = 1/2
    [4, 8, 2],   // (A/4)÷(A/8)  = 2,  trap = 1/2
    [2, 8, 4],   // (A/2)÷(A/8)  = 4,  trap = 1/4
  ];
  const extPairs: DivPair[] = [
    ...basePairs,
    [3, 9,  3],  // (A/3)÷(A/9)  = 3,  trap = 1/3
    [3, 12, 4],  // (A/3)÷(A/12) = 4,  trap = 1/4
    [4, 16, 4],  // (A/4)÷(A/16) = 4,  trap = 1/4
    [6, 12, 2],  // (A/6)÷(A/12) = 2,  trap = 1/2
  ];
  const divPairs = cycle >= 1 ? extPairs : basePairs;
  const [D1, D2, correctInt] = divPairs[r(0, divPairs.length - 1)];
  const A      = r(1, Math.max(1, Math.min(D1, D2) - 1));
  const lhs:     Frac = { n: A,          d: D1 };
  const rhs:     Frac = { n: A,          d: D2 };
  const ansF:    Frac = { n: correctInt, d: 1  };
  const trapF:   Frac = fDiv(rhs, lhs);            // reversed = D1/D2
  const d1F:     Frac = { n: correctInt + 1, d: 1 };
  const d2F:     Frac = { n: correctInt + 2, d: 1 };
  const invRhs:  Frac = { n: D2, d: A };           // inverted rhs for step-by-step
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
 *
 * The tier mapping repeats every 8 stages (2 stages per tier) in an endless loop:
 *   Tier 1 (stages 1–2, 9–10, 17–18 …): Basic integer PEMDAS.
 *   Tier 2 (stages 3–4, 11–12, 19–20 …): Negative numbers and sign rules.
 *   Tier 3 (stages 5–6, 13–14, 21–22 …): Fraction addition & subtraction (LCD).
 *   Tier 4 (stages 7–8, 15–16, 23–24 …): Fraction multiplication & division (KCF).
 *
 * Each full 8-stage rotation increments the `cycle` counter, which scales number
 * ranges and expands denominator pools so difficulty grows with every New Game+ loop.
 */
export function generateDynamicQuestion(stage: number): Question {
  const cycle = Math.floor((stage - 1) / 8);
  const tier  = Math.floor(((stage - 1) % 8) / 2) + 1;
  switch (tier) {
    case 1:  return genTier1(cycle);
    case 2:  return genTier2(cycle);
    case 3:  return genTier3(cycle);
    default: return genTier4(cycle);
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
