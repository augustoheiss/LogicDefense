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

// ── Lens 1: A Massinha da Soma (Addition by rounding to nearest 10) ─────────
function generateMassinhaSoma(wave: number, gentleScale: number): EquationResult {
  // Choose a base number ending in 7, 8, or 9 so rounding up to the next 10 is super intuitive
  const maxTens = wave <= 2 ? 2 : wave <= 5 ? 3 : 4;
  const tens = randInt(0, maxTens) * 10;
  const unit = pickRandom([7, 8, 9]);
  const a = Math.max(8, tens + unit); // e.g., 8, 9, 17, 18, 19, 28, 29, 38, 39
  const shift = 10 - unit;            // 1, 2, or 3 steps to reach the next 10
  const maxB = Math.min(25, Math.round(12 * gentleScale));
  const b = randInt(shift + 2, Math.max(shift + 5, maxB));

  const roundedA = a + shift;
  const adjustedB = b - shift;
  const answer = a + b;

  return {
    display: `${a} + ${b}`,
    answer,
    lensType: 'massinha_soma',
    lensTitle: 'Massinha da Soma',
    shortHint: `💡 Passe ${shift} pro ${a} ➔ ${roundedA} + ${adjustedB}`,
    fullTip: `Massinha da Soma: Em ${a} + ${b}, tire ${shift} do ${b} e passe para o ${a} virar ${roundedA} redondo! Fica ${roundedA} + ${adjustedB} = ${answer} (sem precisar "subir 1").`,
  };
}

// ── Lens 2: Hack Japonês (Subtraction by constant distance — zero borrowing) ─
function generateHackJapones(wave: number, gentleScale: number): EquationResult {
  // Choose subtrahend (bottom number) ending in 7, 8, or 9 so adding +1, +2, or +3 zeroes it out
  const maxSubTens = wave <= 3 ? 1 : wave <= 6 ? 2 : 3;
  const subTens = randInt(0, maxSubTens) * 10;
  const subUnit = pickRandom([7, 8, 9]);
  const b = Math.max(8, subTens + subUnit); // e.g., 8, 9, 17, 18, 19, 28, 29
  const shift = 10 - subUnit;               // +1, +2, or +3

  // Minuend (top number) has a smaller unit than subUnit so traditional subtraction would force borrowing
  const minDiff = randInt(4, Math.min(28, Math.round(14 * gentleScale)));
  let a = b + minDiff;
  if (a % 10 >= subUnit) {
    a = Math.floor(a / 10) * 10 + randInt(1, subUnit - 1);
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
  const subTypes = wave <= 3
    ? (['truque_5', 'dobra_metade', 'blocos_5_mais_1'] as const)
    : (['truque_5', 'truque_9', 'dobra_metade', 'blocos_5_mais_1'] as const);

  const chosen = pickRandom(subTypes);

  if (chosen === 'truque_5') {
    const evenFactor = pickRandom([4, 6, 8, 12, 14, 16, 18]);
    const tenTimes = evenFactor * 10;
    const answer = evenFactor * 5;
    return {
      display: `${evenFactor} × 5`,
      answer,
      lensType: 'dobro_metade_mult',
      lensTitle: 'O Truque do 5',
      shortHint: `💡 Metade de ${tenTimes} ➔ ${answer}`,
      fullTip: `O Truque do 5: Multiplicar por 5 é só multiplicar por 10 (${evenFactor} × 10 = ${tenTimes}) e cortar na metade: ${answer}!`,
    };
  }

  if (chosen === 'truque_9') {
    const b = randInt(3, 9);
    const tenTimes = b * 10;
    const answer = 9 * b;
    return {
      display: `9 × ${b}`,
      answer,
      lensType: 'dobro_metade_mult',
      lensTitle: 'O Truque do 9',
      shortHint: `💡 10×${b} menos ${b} ➔ ${tenTimes} − ${b}`,
      fullTip: `O Truque do 9: Nove vezes ${b} é igual a dez vezes ${b} (${tenTimes}) menos um ${b}: ${tenTimes} − ${b} = ${answer}!`,
    };
  }

  if (chosen === 'dobra_metade') {
    const pairs: Array<[number, number]> = [
      [4, 15], [6, 15], [4, 12], [6, 12], [8, 5], [4, 25], [6, 5], [12, 5],
    ];
    const [a, b] = pickRandom(pairs);
    const halfA = a / 2;
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

  // 'blocos_5_mais_1': 6 × b or 7 × b decomposed via ×5
  const b = randInt(4, 9);
  const a = pickRandom([6, 7]);
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
  const useHalving = Math.random() < 0.65;

  if (useHalving) {
    const divisor = pickRandom([4, 6, 8]);
    const answer = randInt(3, 12);
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

  const divisor = randInt(3, 9);
  const answer = randInt(3, 10);
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

// ── Lens 5: A Peça que Falta (Bridge through 10 / 20 / 30) ──────────────────
function generatePecaFaltando(wave: number): EquationResult {
  const isRoundTarget = Math.random() < 0.55;

  if (isRoundTarget) {
    const target = pickRandom(wave <= 2 ? [10, 20] : [20, 30, 40, 50]);
    const answer = randInt(2, 9);
    const start = target - answer;
    return {
      display: `${start} + [ ? ] = ${target}`,
      answer,
      lensType: 'peca_faltando',
      lensTitle: 'Amigos da Dezena',
      shortHint: `💡 Do ${start} até ${target} faltam...`,
      fullTip: `Amigos da Dezena: Para ir do ${start} até a dezena redonda ${target}, basta completar a unidade até 10: faltam exatamente ${answer} passos!`,
    };
  }

  // Bridge through 10 (e.g., 8 + [?] = 15 -> +2 to 10, +5 to 15 -> 7)
  const start = pickRandom([6, 7, 8, 9, 16, 17, 18, 19]);
  const bridge = Math.ceil(start / 10) * 10;
  const step1 = bridge - start;
  const step2 = randInt(2, 7);
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

// ── Lens 6: Um Número, Vários Caminhos (Target Number Sense) ─────────────────
function generateAlvoMultiplo(wave: number): EquationResult {
  interface TargetOption {
    target: number;
    correctLabel: string;
    wrongLabels: [string, string];
    hint: string;
    tip: string;
  }

  const poolEasy: TargetOption[] = [
    {
      target: 12,
      correctLabel: '10 + 2',
      wrongLabels: ['8 + 2', '9 + 2'],
      hint: '💡 Dezena + 2 forma o 12',
      tip: 'Vários Caminhos: O número 12 pode ser visto como 10 + 2, 6 + 6 ou 3 × 4! Enxergar o 10 dentro dele deixa tudo instantâneo.',
    },
    {
      target: 15,
      correctLabel: '10 + 5',
      wrongLabels: ['8 + 5', '20 − 3'],
      hint: '💡 Qual continha dá 15?',
      tip: 'Vários Caminhos: 15 é uma dezena inteira (10) mais meia dezena (5): 10 + 5 = 15!',
    },
    {
      target: 16,
      correctLabel: '8 + 8',
      wrongLabels: ['7 + 7', '10 + 4'],
      hint: '💡 Procure o dobro que dá 16',
      tip: 'O Poder dos Dobros: Saber os dobros (6+6=12, 7+7=14, 8+8=16) funciona como uma âncora rápida para todas as outras contas!',
    },
    {
      target: 18,
      correctLabel: '20 − 2',
      wrongLabels: ['20 − 4', '10 + 6'],
      hint: '💡 18 está a 2 passos do 20',
      tip: 'Visão pelo Topo: Em vez de contar até 18, veja que ele é simplesmente 20 tirando 2 (20 − 2 = 18)!',
    },
    {
      target: 20,
      correctLabel: '4 × 5',
      wrongLabels: ['3 × 5', '12 + 6'],
      hint: '💡 4 mãos de 5 dedos = 20',
      tip: 'Vários Caminhos: O 20 é 10 + 10, mas também é 4 grupos de 5 (4 × 5 = 20)!',
    },
  ];

  const poolMid: TargetOption[] = [
    ...poolEasy,
    {
      target: 24,
      correctLabel: '20 + 4',
      wrongLabels: ['18 + 4', '3 × 7'],
      hint: '💡 Qual expressão monta o 24?',
      tip: 'Decomposição Limpa: O 24 é 20 + 4, 12 + 12, 3 × 8 ou 4 × 6. Toda conta grande é feita de pedaços pequenos!',
    },
    {
      target: 30,
      correctLabel: '6 × 5',
      wrongLabels: ['5 × 5', '20 + 8'],
      hint: '💡 6 grupos de 5 formam 30',
      tip: 'Relógio Mental: Assim como no relógio, o 6 na tabuada do 5 marca exatamente 30 minutos (6 × 5 = 30)!',
    },
    {
      target: 25,
      correctLabel: '30 − 5',
      wrongLabels: ['30 − 3', '15 + 5'],
      hint: '💡 30 tirando 5 chega no 25',
      tip: 'Andando de 5 em 5: Pular de 5 em 5 na reta numérica (30 − 5 = 25) é um dos jeitos mais leves de calcular de cabeça!',
    },
    {
      target: 36,
      correctLabel: '30 + 6',
      wrongLabels: ['20 + 6', '5 × 7'],
      hint: '💡 Dezena 30 + unidade 6',
      tip: 'Separar Dezenas e Unidades: 36 é literalmente 30 + 6 (e também 6 × 6 ou 4 × 9)!',
    },
  ];

  const chosen = pickRandom(wave <= 2 ? poolEasy : poolMid);

  return {
    display: `🎯 ALVO: ${chosen.target}`,
    answer: chosen.target,
    lensType: 'alvo_multiplo',
    lensTitle: 'Vários Caminhos',
    shortHint: chosen.hint,
    fullTip: chosen.tip,
    customBubbles: [
      { value: chosen.target, label: chosen.correctLabel, isCorrect: true },
      { value: chosen.target - 2, label: chosen.wrongLabels[0], isCorrect: false },
      { value: chosen.target + 2, label: chosen.wrongLabels[1], isCorrect: false },
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

  const lens = pickRandom(availableLenses);

  switch (lens) {
    case 'massinha_soma':
      return generateMassinhaSoma(wave, gentleScale);
    case 'hack_japones':
      return generateHackJapones(wave, gentleScale);
    case 'dobro_metade_mult':
      return generateFriendlyMult(wave);
    case 'corta_no_meio_div':
      return generateFriendlyDiv();
    case 'peca_faltando':
      return generatePecaFaltando(wave);
    case 'alvo_multiplo':
      return generateAlvoMultiplo(wave);
  }
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
