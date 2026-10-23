// ============================================================
// LOGIC INVADERS — PEDAGOGICAL BASIC MATH ENGINE (v5 — The 6 Lenses)
// Focuses 100% on accessible, confidence-building Basic Arithmetic
// with multiple ways of seeing numbers:
//   1. Massinha da Soma (Compensation to 10s — no carrying)
//   2. Hack Japonês (Constant difference subtraction — no borrowing)
//   3. Geometria & Dobro-Metade (Trick of 5, Trick of 9, Double-Halve, 5+1)
//   4. Corta no Meio & Espelho (Halving division & inverse table)
//   5. A Peça que Falta (Bridge through 10 / missing addend)
//   6. Um Número, Vários Caminhos (Target number -> expression bubbles)
// ============================================================

import type { AnswerBubble, LensType } from '../types';

export type OperationType = 'addition' | 'subtraction' | 'multiplication' | 'division';

export interface EquationResult {
  display: string;
  answer: number;
  lensType: LensType;
  lensTitle: string;
  shortHint: string;
  fullTip: string;
  /** Optional custom bubble choices (used by Lens 6 'alvo_multiplo' where bubbles show expressions) */
  customBubbles?: Array<{ value: number; label: string; isCorrect: boolean }>;
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Session Anti-Repetition Memory & Lens Stratification ─────────────────────
const SEEN_INVADER_EQUATIONS = new Set<string>();
const SEEN_INVADER_QUEUE: string[] = [];
const MAX_SEEN_INVADER_HISTORY = 400;
const RECENT_LENS_SUBTYPES: string[] = [];
const MAX_RECENT_LENS_SUBTYPES = 4;

function recordSeenEquation(signature: string, subtypeKey: string): void {
  if (!SEEN_INVADER_EQUATIONS.has(signature)) {
    SEEN_INVADER_EQUATIONS.add(signature);
    SEEN_INVADER_QUEUE.push(signature);
    if (SEEN_INVADER_QUEUE.length > MAX_SEEN_INVADER_HISTORY) {
      const oldest = SEEN_INVADER_QUEUE.shift();
      if (oldest) SEEN_INVADER_EQUATIONS.delete(oldest);
    }
  }
  RECENT_LENS_SUBTYPES.push(subtypeKey);
  if (RECENT_LENS_SUBTYPES.length > MAX_RECENT_LENS_SUBTYPES) {
    RECENT_LENS_SUBTYPES.shift();
  }
}

export function resetInvaderMathSessionHistory(): void {
  SEEN_INVADER_EQUATIONS.clear();
  SEEN_INVADER_QUEUE.length = 0;
  RECENT_LENS_SUBTYPES.length = 0;
}

// ── Lens 1: A Massinha da Soma (Addition by rounding to nearest 10) ─────────
function generateMassinhaSoma(wave: number, gentleScale: number): EquationResult {
  // Choose a base number ending in 6, 7, 8, or 9 so rounding up to the next 10 is super intuitive
  const maxTens = wave <= 2 ? 3 : wave <= 5 ? 6 : 8;
  const tens = randInt(0, maxTens) * 10;
  const unit = pickRandom(wave <= 2 ? [8, 9] : [6, 7, 8, 9]);
  const a = Math.max(8, tens + unit);
  const shift = 10 - unit; // 1, 2, 3, or 4 steps to reach the next 10
  const maxB = Math.min(46, Math.round((16 + wave * 2) * gentleScale));
  const b = randInt(shift + 2, Math.max(shift + 7, maxB));

  const roundedA = a + shift;
  const adjustedB = b - shift;
  const answer = a + b;
  const swapOrder = wave >= 3 && Math.random() < 0.35;
  const display = swapOrder ? `${b} + ${a}` : `${a} + ${b}`;

  return {
    display,
    answer,
    lensType: 'massinha_soma',
    lensTitle: 'Massinha da Soma',
    shortHint: `💡 Passe ${shift} pro ${a} ➔ ${roundedA} + ${adjustedB}`,
    fullTip: `Massinha da Soma: Em ${display}, tire ${shift} do ${b} e passe para o ${a} virar ${roundedA} redondo! Fica ${roundedA} + ${adjustedB} = ${answer} (sem precisar "subir 1").`,
  };
}

// ── Lens 2: Hack Japonês (Subtraction by constant distance — zero borrowing) ─
function generateHackJapones(wave: number, gentleScale: number): EquationResult {
  // Choose subtrahend (bottom number) ending in 6, 7, 8, or 9 so adding +1..+4 zeroes it out
  const maxSubTens = wave <= 3 ? 2 : wave <= 6 ? 4 : 6;
  const subTens = randInt(0, maxSubTens) * 10;
  const subUnit = pickRandom(wave <= 2 ? [8, 9] : [6, 7, 8, 9]);
  const b = Math.max(8, subTens + subUnit);
  const shift = 10 - subUnit;

  // Minuend (top number) has a smaller unit than subUnit so traditional subtraction would force borrowing
  const minDiff = randInt(4, Math.min(48, Math.round((16 + wave * 2) * gentleScale)));
  let a = b + minDiff;
  if (a % 10 >= subUnit) {
    a = Math.floor(a / 10) * 10 + randInt(0, subUnit - 1);
    if (a <= b + 2) a += 10;
  }

  const newA = a + shift;
  const newB = b + shift;
  const answer = a - b;

  return {
    display: `${a} − ${b}`,
    answer,
    lensType: 'hack_japones',
    lensTitle: 'Hack Japonês',
    shortHint: `💡 +${shift} nos dois ➔ ${newA} − ${newB}`,
    fullTip: `Hack Japonês (Sem Emprestar!): Em ${a} − ${b}, some +${shift} nos DOIS números para zerar o de baixo. A distância não muda: ${newA} − ${newB} = ${answer}!`,
  };
}

// ── Lens 3: Geometria & Atalhos da Multiplicação (Friendly Multiplication) ───
function generateFriendlyMult(wave: number): EquationResult {
  const allSubTypes = wave <= 3
    ? (['truque_5', 'dobra_metade', 'blocos_5_mais_1', 'truque_9'] as const)
    : (['truque_5', 'truque_9', 'dobra_metade', 'blocos_5_mais_1', 'segredo_11', 'quadrados_vizinhos'] as const);

  const filtered = allSubTypes.filter((s) => !RECENT_LENS_SUBTYPES.includes(`mult:${s}`));
  const chosen = pickRandom(filtered.length > 0 ? filtered : allSubTypes);

  if (chosen === 'truque_5') {
    const maxHalf = wave <= 3 ? 12 : 24;
    const evenFactor = randInt(2, maxHalf) * 2;
    const tenTimes = evenFactor * 10;
    const answer = evenFactor * 5;
    const swap = Math.random() < 0.3;
    return {
      display: swap ? `5 × ${evenFactor}` : `${evenFactor} × 5`,
      answer,
      lensType: 'dobro_metade_mult',
      lensTitle: 'O Truque do 5',
      shortHint: `💡 ${evenFactor}×10 = ${tenTimes} ➔ corte na metade!`,
      fullTip: `O Truque do 5: Multiplicar por 5 é só multiplicar por 10 (${evenFactor} × 10 = ${tenTimes}) e cortar na metade: ${answer}!`,
    };
  }

  if (chosen === 'truque_9') {
    const nineBase = wave >= 5 && Math.random() < 0.4 ? pickRandom([9, 19, 29]) : 9;
    const roundBase = nineBase + 1;
    const b = nineBase === 9 ? randInt(3, 14) : randInt(2, 7);
    const tenTimes = b * roundBase;
    const answer = nineBase * b;
    return {
      display: `${nineBase} × ${b}`,
      answer,
      lensType: 'dobro_metade_mult',
      lensTitle: `O Truque do ${nineBase}`,
      shortHint: `💡 ${roundBase}×${b} menos ${b} ➔ ${tenTimes} − ${b}`,
      fullTip: `O Truque do ${nineBase}: ${nineBase} vezes ${b} é igual a ${roundBase} vezes ${b} (${tenTimes}) menos um ${b}: ${tenTimes} − ${b} = ${answer}!`,
    };
  }

  if (chosen === 'dobra_metade') {
    const bPool = wave <= 3 ? [5, 12, 15, 25] : [5, 12, 14, 15, 16, 18, 25, 35, 45];
    const b = pickRandom(bPool);
    const maxHalfA = b >= 25 ? 6 : b >= 15 ? 8 : 11;
    const halfA = randInt(2, maxHalfA);
    const a = halfA * 2;
    const doubleB = b * 2;
    const answer = a * b;
    return {
      display: `${a} × ${b}`,
      answer,
      lensType: 'dobro_metade_mult',
      lensTitle: 'Dobra e Metade',
      shortHint: `💡 Corte e dobre ➔ ${halfA} × ${doubleB}`,
      fullTip: `Dobra e Metade: Em ${a} × ${b}, corte o ${a} pela metade (${halfA}) e dobre o ${b} (${doubleB}). Fica muito mais fácil: ${halfA} × ${doubleB} = ${answer}!`,
    };
  }

  if (chosen === 'segredo_11') {
    const b = randInt(11, wave <= 5 ? 18 : 27);
    const tensPart = b * 10;
    const answer = 11 * b;
    return {
      display: `11 × ${b}`,
      answer,
      lensType: 'dobro_metade_mult',
      lensTitle: 'Segredo do 11 (10 + 1)',
      shortHint: `💡 10×${b} + ${b} ➔ ${tensPart} + ${b}`,
      fullTip: `Segredo do 11: Multiplicar por 11 é fazer 10 vezes (${tensPart}) mais 1 vez (${b}): ${tensPart} + ${b} = ${answer}!`,
    };
  }

  if (chosen === 'quadrados_vizinhos') {
    const center = pickRandom([6, 7, 8, 9, 10, 11, 12, 15, 20]);
    const a = center - 1;
    const b = center + 1;
    const sq = center * center;
    const answer = sq - 1;
    return {
      display: `${a} × ${b}`,
      answer,
      lensType: 'dobro_metade_mult',
      lensTitle: 'Vizinhos do Quadrado',
      shortHint: `💡 (${center}−1)×(${center}+1) ➔ ${sq} − 1`,
      fullTip: `Vizinhos Simétricos: ${a} e ${b} cercam o ${center}. O produto deles é sempre ${center}² − 1 = ${sq} − 1 = ${answer}!`,
    };
  }

  // 'blocos_5_mais_1': 6 × b, 7 × b, or 8 × b decomposed via ×5
  const b = randInt(4, 14);
  const a = pickRandom([6, 7, 8]);
  const fivePart = 5 * b;
  const restCount = a - 5;
  const restPart = restCount * b;
  const answer = a * b;
  return {
    display: `${a} × ${b}`,
    answer,
    lensType: 'dobro_metade_mult',
    lensTitle: 'Blocos Voxel (5 + Resto)',
    shortHint: `💡 (5×${b}) + ${restPart} ➔ ${fivePart} + ${restPart}`,
    fullTip: `Visão em Blocos: Quebre o ${a} usando a tabuada fácil do 5! Cinco vezes ${b} é ${fivePart}, mais ${restPart} dá ${answer}!`,
  };
}

// ── Lens 4: Corta no Meio & Espelho (Friendly Division) ─────────────────────
function generateFriendlyDiv(): EquationResult {
  const roll = Math.random();

  if (roll < 0.45) {
    const divisor = pickRandom([4, 6, 8, 12, 14, 16]);
    const answer = randInt(3, 16);
    const dividend = divisor * answer;
    const halfDiv = dividend / 2;
    const halfDivisor = divisor / 2;
    return {
      display: `${dividend} ÷ ${divisor}`,
      answer,
      lensType: 'corta_no_meio_div',
      lensTitle: 'Corta no Meio',
      shortHint: `💡 Metade dos dois ➔ ${halfDiv} ÷ ${halfDivisor}`,
      fullTip: `Corta no Meio: Quando os dois são pares (${dividend} ÷ ${divisor}), corte ambos pela metade sem medo: vira ${halfDiv} ÷ ${halfDivisor} = ${answer}!`,
    };
  }

  if (roll < 0.72) {
    // Divisão por 5 = Dobrar e cortar o zero!
    const answer = randInt(4, 24) * 2;
    const dividend = answer * 5;
    return {
      display: `${dividend} ÷ 5`,
      answer,
      lensType: 'corta_no_meio_div',
      lensTitle: 'Divisão Relâmpago ÷5',
      shortHint: `💡 Dobre ${dividend} e corte o zero final!`,
      fullTip: `Divisão por 5: Dividir por 5 é o mesmo que multiplicar por 2 e dividir por 10! O dobro de ${dividend} é ${dividend * 2}, cortando o zero dá ${answer}!`,
    };
  }

  const divisor = randInt(3, 12);
  const answer = randInt(3, 14);
  const dividend = divisor * answer;
  return {
    display: `${dividend} ÷ ${divisor}`,
    answer,
    lensType: 'corta_no_meio_div',
    lensTitle: 'Espelho da Tabuada',
    shortHint: `💡 Pense: ${divisor} × [ ? ] = ${dividend}`,
    fullTip: `Espelho da Tabuada: Toda divisão é uma multiplicação ao contrário! Quantos bloquinhos de ${divisor} cabem em ${dividend}? ${divisor} × ${answer} = ${dividend}!`,
  };
}

// ── Lens 5: A Peça que Falta (Bridge through 10 / 20 / 30 / 100) ─────────────
function generatePecaFaltando(wave: number): EquationResult {
  const isRoundTarget = Math.random() < 0.55;

  if (isRoundTarget) {
    const targetPool = wave <= 2 ? [10, 20, 30] : [20, 30, 40, 50, 60, 70, 80, 90, 100];
    const target = pickRandom(targetPool);
    const maxAnswer = Math.min(target - 3, wave <= 2 ? 12 : 38);
    const answer = randInt(2, maxAnswer);
    const start = target - answer;
    const nextTen = Math.ceil(start / 10) * 10;
    const unitStep = nextTen - start;
    const tensStep = target - nextTen;
    const hintText =
      tensStep > 0 && unitStep > 0
        ? `💡 +${unitStep} até ${nextTen}, depois +${tensStep} até ${target}`
        : `💡 Complete a dezena do ${start} até ${target}`;
    return {
      display: `${start} + [ ? ] = ${target}`,
      answer,
      lensType: 'peca_faltando',
      lensTitle: 'Amigos da Dezena',
      shortHint: hintText,
      fullTip: `Amigos da Dezena: Para ir do ${start} até ${target}, complete +${unitStep} até ${nextTen} e some +${tensStep}: faltam exatamente ${answer} passos!`,
    };
  }

  // Bridge through next multiple of 10 (e.g., 18 + [?] = 25 -> +2 to 20, +5 to 25 -> 7)
  const maxStartTens = wave <= 2 ? 2 : 6;
  const startTens = randInt(0, maxStartTens) * 10;
  const startUnit = pickRandom([6, 7, 8, 9]);
  const start = Math.max(6, startTens + startUnit);
  const bridge = Math.ceil(start / 10) * 10;
  const step1 = bridge - start;
  const step2 = randInt(2, wave <= 2 ? 8 : 16);
  const target = bridge + step2;
  const answer = step1 + step2;

  return {
    display: `${start} + [ ? ] = ${target}`,
    answer,
    lensType: 'peca_faltando',
    lensTitle: 'A Ponte do 10',
    shortHint: `💡 Pro ${bridge} (+${step1}) e pro ${target} (+${step2})`,
    fullTip: `A Ponte do 10: Use o ${bridge} como trampolim! Do ${start} até ${bridge} são +${step1} passos, e do ${bridge} até ${target} são +${step2} passos: ${step1} + ${step2} = ${answer}!`,
  };
}

// ── Lens 6: Um Número, Vários Caminhos (Parametric Target Number Sense) ──────
function generateAlvoMultiplo(wave: number): EquationResult {
  const styles = ['dezena_unidade', 'dobro_perfeito', 'visao_topo', 'saltos_de_5'] as const;
  const style = pickRandom(styles);

  if (style === 'dobro_perfeito') {
    const half = randInt(5, wave <= 2 ? 12 : 24);
    const target = half * 2;
    const correctLabel = `${half} + ${half}`;
    const wrong1 = `${half - 1} + ${half - 1}`;
    const wrong2 = `${half + 1} + ${half + 2}`;
    return {
      display: `🎯 ALVO: ${target}`,
      answer: target,
      lensType: 'alvo_multiplo',
      lensTitle: 'O Poder dos Dobros',
      shortHint: `💡 Qual dobro exato forma o ${target}?`,
      fullTip: `O Poder dos Dobros: Enxergar que ${target} é o dobro de ${half} (${half} + ${half} = ${target}) cria uma âncora instantânea!`,
      customBubbles: [
        { value: target, label: correctLabel, isCorrect: true },
        { value: target - 2, label: wrong1, isCorrect: false },
        { value: target + 3, label: wrong2, isCorrect: false },
      ],
    };
  }

  if (style === 'visao_topo') {
    const roundTop = randInt(2, wave <= 2 ? 4 : 9) * 10;
    const recoil = randInt(1, 4);
    const target = roundTop - recoil;
    const correctLabel = `${roundTop} − ${recoil}`;
    const wrong1 = `${roundTop} − ${recoil + 2}`;
    const wrong2 = `${roundTop - 10} + ${recoil}`;
    return {
      display: `🎯 ALVO: ${target}`,
      answer: target,
      lensType: 'alvo_multiplo',
      lensTitle: 'Visão pelo Topo',
      shortHint: `💡 ${target} está a ${recoil} passo(s) abaixo do ${roundTop}`,
      fullTip: `Visão pelo Topo: Em vez de contar de baixo, veja que ${target} é simplesmente a dezena ${roundTop} recuando ${recoil} (${roundTop} − ${recoil} = ${target})!`,
      customBubbles: [
        { value: target, label: correctLabel, isCorrect: true },
        { value: target - 2, label: wrong1, isCorrect: false },
        { value: roundTop - 10 + recoil, label: wrong2, isCorrect: false },
      ],
    };
  }

  if (style === 'saltos_de_5') {
    const mult = randInt(3, wave <= 2 ? 7 : 14);
    const target = mult * 5;
    const correctLabel = `${mult} × 5`;
    const wrong1 = `${mult - 1} × 5`;
    const wrong2 = `${mult + 1} × 4`;
    return {
      display: `🎯 ALVO: ${target}`,
      answer: target,
      lensType: 'alvo_multiplo',
      lensTitle: 'Relógio de 5 em 5',
      shortHint: `💡 Quantos grupos de 5 formam ${target}?`,
      fullTip: `Relógio Mental: Contando de 5 em 5, ${mult} grupos de 5 formam exatamente ${target} (${mult} × 5 = ${target})!`,
      customBubbles: [
        { value: target, label: correctLabel, isCorrect: true },
        { value: (mult - 1) * 5, label: wrong1, isCorrect: false },
        { value: (mult + 1) * 4, label: wrong2, isCorrect: false },
      ],
    };
  }

  // 'dezena_unidade'
  const tens = randInt(1, wave <= 2 ? 4 : 8) * 10;
  const unit = randInt(2, 9);
  const target = tens + unit;
  const correctLabel = `${tens} + ${unit}`;
  const wrong1 = `${tens - 10 > 0 ? tens - 10 : tens + 10} + ${unit}`;
  const wrong2 = `${tens} + ${unit === 9 ? 7 : unit + 2}`;
  return {
    display: `🎯 ALVO: ${target}`,
    answer: target,
    lensType: 'alvo_multiplo',
    lensTitle: 'Vários Caminhos',
    shortHint: `💡 Dezena ${tens} + unidade ${unit}`,
    fullTip: `Decomposição Limpa: O número ${target} é formado pela dezena redonda ${tens} mais ${unit} (${tens} + ${unit} = ${target})!`,
    customBubbles: [
      { value: target, label: correctLabel, isCorrect: true },
      { value: target - 10, label: wrong1, isCorrect: false },
      { value: target + 2, label: wrong2, isCorrect: false },
    ],
  };
}

/**
 * Generate a single basic-math equation with rich pedagogical lens metadata.
 * Note: forBoss forces numeric answers (never Lens 6 expression bubbles)
 * because Boss columns display numeric headers.
 */
export function generateEquation(
  wave: number,
  difficultyMultiplier: number = 1,
  forBoss: boolean = false
): EquationResult {
  // Gentle cap: never let difficultyMultiplier turn basic math into scary 3-digit chores
  const gentleScale = Math.min(1.6, Math.max(1.0, difficultyMultiplier));

  let availableLenses: LensType[];
  if (wave <= 1) {
    availableLenses = ['massinha_soma', 'peca_faltando', 'alvo_multiplo'];
  } else if (wave === 2) {
    availableLenses = ['massinha_soma', 'hack_japones', 'peca_faltando', 'alvo_multiplo'];
  } else if (wave === 3) {
    availableLenses = ['massinha_soma', 'hack_japones', 'dobro_metade_mult', 'peca_faltando', 'alvo_multiplo'];
  } else {
    availableLenses = [
      'massinha_soma',
      'hack_japones',
      'dobro_metade_mult',
      'corta_no_meio_div',
      'peca_faltando',
      'alvo_multiplo',
    ];
  }

  if (forBoss) {
    availableLenses = availableLenses.filter((l) => l !== 'alvo_multiplo');
  }

  let lastResult: EquationResult | null = null;
  for (let attempt = 0; attempt < 48; attempt++) {
    const nonRecentLenses = availableLenses.filter(
      (l) => !RECENT_LENS_SUBTYPES.slice(-2).some((k) => k.startsWith(`${l}:`))
    );
    const lens = pickRandom(nonRecentLenses.length > 0 ? nonRecentLenses : availableLenses);

    let candidate: EquationResult;
    switch (lens) {
      case 'massinha_soma':
        candidate = generateMassinhaSoma(wave, gentleScale);
        break;
      case 'hack_japones':
        candidate = generateHackJapones(wave, gentleScale);
        break;
      case 'dobro_metade_mult':
        candidate = generateFriendlyMult(wave);
        break;
      case 'corta_no_meio_div':
        candidate = generateFriendlyDiv();
        break;
      case 'peca_faltando':
        candidate = generatePecaFaltando(wave);
        break;
      case 'alvo_multiplo':
        candidate = generateAlvoMultiplo(wave);
        break;
    }

    lastResult = candidate;
    const signature = `${candidate.display}=${candidate.answer}|${candidate.customBubbles?.[0]?.label ?? ''}`;
    if (!SEEN_INVADER_EQUATIONS.has(signature)) {
      recordSeenEquation(signature, `${lens}:${candidate.lensTitle}`);
      return candidate;
    }
  }

  if (lastResult) {
    const signature = `${lastResult.display}=${lastResult.answer}`;
    recordSeenEquation(signature, `${lastResult.lensType}:${lastResult.lensTitle}`);
    return lastResult;
  }
  return generateMassinhaSoma(wave, gentleScale);
}

/**
 * Build 3 floating-answer bubbles for an invader:
 * Ordered cleanly from Left [1], Center [2], Right [3].
 * Supports both numeric answers and custom expression labels (Lens 6).
 */
export function generateAnswerBubbles(
  correctAnswer: number,
  customBubbles?: Array<{ value: number; label: string; isCorrect: boolean }>
): AnswerBubble[] {
  let values: Array<{ value: number; label: string; isCorrect: boolean }>;

  if (customBubbles && customBubbles.length === 3) {
    values = [...customBubbles];
  } else {
    const decoys = new Set<number>();
    // Friendly, distinct decoys so the player isn't tricked by unfair 1-off noise every time,
    // mixing 1 close number and 1 tens/step offset
    const offsets = [-2, 2, -3, 3, -5, 5, 10, -10, -1, 1, 4, -4];

    for (const off of offsets) {
      const candidate = correctAnswer + off;
      if (candidate > 0 && candidate !== correctAnswer) {
        decoys.add(candidate);
        if (decoys.size >= 2) break;
      }
    }

    while (decoys.size < 2) {
      const r = randInt(Math.max(1, correctAnswer - 6), correctAnswer + 6);
      if (r !== correctAnswer) decoys.add(r);
    }

    values = [
      { value: correctAnswer, label: String(correctAnswer), isCorrect: true },
      ...Array.from(decoys)
        .slice(0, 2)
        .map((v) => ({ value: v, label: String(v), isCorrect: false })),
    ];
  }

  // Shuffle choices across the 3 slots ([1] Left, [2] Center, [3] Right)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  // Clean Canvas-2D angles (where +Y is DOWN, 0 rad is RIGHT, PI/2 is DOWN, PI is LEFT):
  // Slot 0 ([1] Left-wing): 165 deg
  // Slot 1 ([2] Top-Center): 270 deg (clamped inside canvas by bubblePos so it never clips!)
  // Slot 2 ([3] Right-wing): 15 deg
  const baseAngles = [
    (165 * Math.PI) / 180,
    (270 * Math.PI) / 180,
    (15 * Math.PI) / 180,
  ];

  return values.map((v, i) => ({
    value: v.value,
    label: v.label,
    isCorrect: v.isCorrect,
    angle: baseAngles[i],
    slotIndex: i as 0 | 1 | 2,
  }));
}
