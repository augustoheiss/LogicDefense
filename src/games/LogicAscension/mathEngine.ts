import { PathId } from './types';
import { NUM_ROOMS } from './mapData';

// ── Solution Method & Question Interfaces ──────────────────────────────────────
export interface SolutionMethod {
  badge: string;
  summary: string;
}

export interface Question {
  expression:    string;
  hint:          string;
  correctAnswer: number;
  wrongAnswers:  [number, number, number];
  explanation:   string;
  /**
   * Optional button-label overrides for fraction answers.
   * Maps snapped numeric value → display string (e.g. 0.75 → "3/4").
   * When absent the raw number is shown on the button.
   */
  answerLabels?: Record<number, string>;
  /** Pedagogical lens title (e.g. "Massinha da Soma", "Hack Japonês", "Dobra e Metade"). */
  lensTitle?:    string;
  /** Multiple mental pathways to solve the same basic calculation. */
  methods?:      SolutionMethod[];
  /** Practical everyday connection. */
  realLifeTip?:  string;
}

// ── Fraction arithmetic & float-safe snapping ──────────────────────────────────
type Frac = { n: number; d: number };

export function snapVal(v: number): number {
  return Math.round(v * 100000) / 100000;
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

function fSim({ n, d }: Frac): Frac {
  if (n === 0) return { n: 0, d: 1 };
  const g = gcd(Math.abs(n), Math.abs(d));
  return d < 0 ? { n: -n / g, d: -d / g } : { n: n / g, d: d / g };
}
function fAdd(a: Frac, b: Frac): Frac { return fSim({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }); }
function fVal({ n, d }: Frac): number  { return snapVal(n / d); }
/** "3/4" for answer button labels. */
function fLbl({ n, d }: Frac): string  { return d === 1 ? `${n}` : `${n}/${d}`; }

// ── Generator utilities ────────────────────────────────────────────────────────
function r(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Return exactly 3 distinct wrong answers (none equal to `correct`). */
function wrongs(correct: number, candidates: number[]): [number, number, number] {
  const cSnap = snapVal(correct);
  const seen = new Set<number>([cSnap]);
  const out: number[] = [];
  for (const raw of candidates) {
    const v = snapVal(raw);
    if (Number.isFinite(v) && !seen.has(v)) { seen.add(v); out.push(v); }
    if (out.length === 3) break;
  }
  for (let delta = 1; out.length < 3 && delta < 50; delta++) {
    const v = snapVal(cSnap + delta);
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out as [number, number, number];
}

/** Build an answerLabels map from Frac values (guaranteed snapped keys). */
function mkFracLabels(fracs: Frac[]): Record<number, string> {
  const rec: Record<number, string> = {};
  for (const f of fracs) {
    const s = fSim(f);
    rec[fVal(s)] = fLbl(s);
  }
  return rec;
}

function buildQuestion(
  base: Omit<Question, 'explanation'> & { methods: SolutionMethod[]; trapNote?: string }
): Question {
  const lines = base.methods.map(m => `${m.badge}: ${m.summary}`);
  if (base.realLifeTip) lines.push(`🌍 No dia a dia: ${base.realLifeTip}`);
  if (base.trapNote) lines.push(`[≠ Armadilha evitada: ${base.trapNote}]`);
  return {
    ...base,
    correctAnswer: snapVal(base.correctAnswer),
    explanation: lines.join('\n'),
  };
}

// ── Session Anti-Repetition & Subtype Stratification ───────────────────────────
const SEEN_ASCENSION_EXPRESSIONS = new Set<string>();
const SEEN_ASCENSION_QUEUE: string[] = [];
const MAX_SEEN_ASCENSION = 400;
const RECENT_ASCENSION_LENSES: string[] = [];

function recordAscensionQuestion(q: Question): void {
  const sig = `${q.expression}=${q.correctAnswer}`;
  if (!SEEN_ASCENSION_EXPRESSIONS.has(sig)) {
    SEEN_ASCENSION_EXPRESSIONS.add(sig);
    SEEN_ASCENSION_QUEUE.push(sig);
    if (SEEN_ASCENSION_QUEUE.length > MAX_SEEN_ASCENSION) {
      const oldest = SEEN_ASCENSION_QUEUE.shift();
      if (oldest) SEEN_ASCENSION_EXPRESSIONS.delete(oldest);
    }
  }
  if (q.lensTitle) {
    RECENT_ASCENSION_LENSES.push(q.lensTitle);
    if (RECENT_ASCENSION_LENSES.length > 4) RECENT_ASCENSION_LENSES.shift();
  }
}

// ── Tier 1 — Soma & Subtração Inteligente (Massinha, Hack Japonês, Caça-Dezenas) ──
function genTier1(cycle: number): Question {
  const t = r(0, 4);

  // Subtype 0: Massinha da Soma (Compensation to nearest 10)
  if (t === 0) {
    const tensA = r(1 + cycle, 7 + cycle * 2) * 10;
    const unitA = pick([6, 7, 8, 9]);
    const A = tensA + unitA;
    const shift = 10 - unitA; // 1, 2, 3, or 4
    const B = r(11 + cycle * 4, 38 + cycle * 8);
    const roundedA = A + shift;
    const adjustedB = B - shift;
    const ans = A + B;
    const dA = Math.floor(A / 10) * 10, dB = Math.floor(B / 10) * 10;
    const uA = A % 10, uB = B % 10;

    return buildQuestion({
      expression: `${A} + ${B}`,
      lensTitle: 'A Massinha da Soma',
      hint: `Arredonde o ${A} para ${roundedA} passando +${shift} do ${B}`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [ans - 10, ans + shift, roundedA + B]),
      realLifeTip: `Somar preços quebrados (R$ ${A} + R$ ${B}) arredondando para R$ ${roundedA} antes de ajustar.`,
      trapNote: `${roundedA + B} — arredondou o ${A} para ${roundedA} mas esqueceu de tirar ${shift} do ${B}`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Massinha (Compensação)',
          summary: `Tire ${shift} do ${B} e dê para o ${A}: vira ${roundedA} + ${adjustedB} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Dezenas + Unidades',
          summary: `Some as dezenas (${dA}+${dB}=${dA + dB}) e as unidades (${uA}+${uB}=${uA + uB}) → ${dA + dB} + ${uA + uB} = ${ans}!`,
        },
        {
          badge: '🎯 Jeito 3 — Soma Redonda e Desconta',
          summary: `Pense em ${roundedA} + ${B} = ${roundedA + B}, depois desconte os ${shift} extras: ${roundedA + B} − ${shift} = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 1: Hack Japonês (Constant-difference subtraction without borrowing)
  if (t === 1) {
    const tensB = r(1 + cycle, 5 + cycle * 2) * 10;
    const unitB = pick([6, 7, 8, 9]);
    const B = tensB + unitB;
    const shift = 10 - unitB; // +1, +2, +3, or +4 zeroes out B
    const diff = r(12 + cycle * 4, 48 + cycle * 8);
    let A = B + diff;
    // Ensure unit of A < unit of B so traditional subtraction would force borrowing
    if (A % 10 >= unitB) {
      A = Math.floor(A / 10) * 10 + r(0, unitB - 1);
      if (A <= B + 5) A += 10;
    }
    const newA = A + shift;
    const newB = B + shift;
    const ans = A - B;
    const trapBorrow = ans + 10;
    const trapSub = A - newB;

    return buildQuestion({
      expression: `${A} − ${B}`,
      lensTitle: 'Hack Japonês (Sem Emprestar)',
      hint: `Some +${shift} nos DOIS números para zerar o ${B} → ${newA} − ${newB}`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trapSub, trapBorrow, ans - shift]),
      realLifeTip: `Calcular troco ou diferença de idade mantendo a mesma distância na reta numérica.`,
      trapNote: `${trapSub} — arredondou o ${B} para ${newB} mas esqueceu de somar +${shift} no ${A}`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Hack Japonês (Distância Constante)',
          summary: `Some +${shift} nos dois números! A distância não muda: ${newA} − ${newB} = ${ans}!`,
        },
        {
          badge: '🌉 Jeito 2 — A Ponte (Completar até chegar)',
          summary: `Do ${B} até ${newB} faltam +${shift}; de ${newB} até ${A} faltam +${A - newB} → ${shift} + ${A - newB} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 3 — Tira Redondo e Devolve',
          summary: `Tire ${newB} redondo (${A} − ${newB} = ${A - newB}) e devolva os ${shift} que tirou a mais: ${A - newB} + ${shift} = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 2: Caça-Dezenas (Associative Trio Addition: A + B + C where A+C is round)
  if (t === 2) {
    const targetRound = pick([30, 40, 50, 60, 70, 80, 90, 100]) + cycle * 20;
    const uA = pick([3, 4, 6, 7, 8, 9]);
    const A = r(1, Math.max(1, Math.floor(targetRound / 10) - 2)) * 10 + uA;
    const C = targetRound - A;
    const B = r(11 + cycle * 3, 39 + cycle * 6);
    const ans = targetRound + B;

    return buildQuestion({
      expression: `${A} + ${B} + ${C}`,
      lensTitle: 'Caça-Dezenas (Ordem Livre)',
      hint: `Junte primeiro os amigos que fecham dezena redonda: ${A} + ${C} = ${targetRound}`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [ans - 10, ans + 10, A + B]),
      realLifeTip: `Somar 3 itens no mercado começando pelos dois que fecham valor redondo.`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Caça-Dezenas (Associativa)',
          summary: `Junte os extremos primeiro: (${A} + ${C}) = ${targetRound} redondo! Depois ${targetRound} + ${B} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Passo a Passo da Esquerda',
          summary: `${A} + ${B} = ${A + B}, e depois ${A + B} + ${C} = ${ans}!`,
        },
        {
          badge: '🔢 Jeito 3 — Dezenas Separadas',
          summary: `Some todas as dezenas primeiro e junte as unidades no final para fechar ${ans}!`,
        },
      ],
    });
  }

  // Subtype 3: Hack dos Nove na Centena (100 - B / 200 - B)
  if (t === 3) {
    const hundredBase = pick([100, 200, 300]);
    const bTens = r(1, 8);
    const bUnit = r(1, 9);
    const B = bTens * 10 + bUnit;
    const ans = hundredBase - B;
    const nineTens = 9 - bTens;
    const tenUnit = 10 - bUnit;

    return buildQuestion({
      expression: `${hundredBase} − ${B}`,
      lensTitle: 'Hack dos Nove (Troco de Centena)',
      hint: `Para fechar 9 na dezena (9−${bTens}=${nineTens}) e 10 na unidade (10−${bUnit}=${tenUnit})!`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [ans + 10, ans - 10, hundredBase - bTens * 10 + bUnit]),
      realLifeTip: `Dar o troco de uma nota de R$ 100 em 1 segundo sem precisar emprestar de zero em zero.`,
      trapNote: `${ans + 10} — completou a dezena para 10 em vez de 9 ao tirar da centena`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Regra 9 na Dezena, 10 na Unidade',
          summary: `Pense em ${hundredBase - 1} + 1: complete a dezena para 9 (9−${bTens}=${nineTens}) e a unidade para 10 (10−${bUnit}=${tenUnit}) → ${ans}!`,
        },
        {
          badge: '🌉 Jeito 2 — A Ponte até a Centena',
          summary: `Do ${B} até ${(bTens + 1) * 10} faltam +${tenUnit}; até ${hundredBase} faltam +${ans - tenUnit} → ${ans}!`,
        },
        {
          badge: '🧱 Jeito 3 — Hack Japonês (−1 nos Dois)',
          summary: `Tire 1 dos dois números: ${hundredBase - 1} − ${B - 1} = ${ans} sem nenhum empréstimo!`,
        },
      ],
    });
  }

  // Subtype 4: A Peça que Falta / Vai-e-Vem (A + B − C where B and C are close)
  const base = r(22 + cycle * 10, 75 + cycle * 15);
  const delta = r(2, 12);
  const B = r(15 + cycle * 4, 38 + cycle * 6);
  const C = B - delta;
  const ans = base + delta;
  return buildQuestion({
    expression: `${base} + ${B} − ${C}`,
    lensTitle: 'Saldo Líquido (Atalho Lógico)',
    hint: `Simplifique o final primeiro: +${B} − ${C} é só +${delta}!`,
    correctAnswer: ans,
    wrongAnswers: wrongs(ans, [base - delta, base + B, ans + 10]),
    realLifeTip: `Entraram R$ ${B} e saíram R$ ${C} da conta: o saldo subiu apenas R$ ${delta}!`,
    methods: [
      {
        badge: '⚡ Jeito 1 — Saldo Líquido (Mais Rápido)',
        summary: `Veja a diferença entre ${B} e ${C} primeiro (${B} − ${C} = +${delta}). Então ${base} + ${delta} = ${ans}!`,
      },
      {
        badge: '🧱 Jeito 2 — Caminho Tradicional',
        summary: `Some ${base} + ${B} = ${base + B}, depois subtraia ${base + B} − ${C} = ${ans}!`,
      },
      {
        badge: '🔄 Jeito 3 — Subtrair Primeiro',
        summary: `Tire ${C} de ${base} (${base - C}) e some ${B}: ${base - C} + ${B} = ${ans}!`,
      },
    ],
  });
}

// ── Tier 2 — Multiplicação & Divisão Mental (Dobra-Metade, Truque 5/9/11, Corta no Meio) ──
function genTier2(cycle: number): Question {
  const t = r(0, 4);

  // Subtype 0: Dobra e Metade (Friendly Multiplication — Parametric!)
  if (t === 0) {
    const bPool = cycle === 0 ? [5, 12, 15, 25, 35] : [12, 14, 15, 16, 18, 25, 35, 45];
    const B = pick(bPool);
    const maxHalfA = B >= 25 ? 8 : 12;
    const halfA = r(2, maxHalfA);
    const A = halfA * 2;
    const doubleB = B * 2;
    const ans = A * B;
    const bTens = Math.floor(B / 10) * 10;
    const bUnits = B % 10;

    return buildQuestion({
      expression: `${A} × ${B}`,
      lensTitle: 'Dobra e Metade',
      hint: `Corte o ${A} pela metade (${halfA}) e dobre o ${B} (${doubleB}) → ${halfA} × ${doubleB}`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [ans - B, ans + B, halfA * B]),
      realLifeTip: `Comprar ${A} pacotes de ${B} unidades é o mesmo que comprar ${halfA} pacotes duplos de ${doubleB}!`,
      trapNote: `${halfA * B} — cortou o ${A} pela metade mas esqueceu de dobrar o ${B}`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Dobra e Metade',
          summary: `Metade de ${A} é ${halfA}; o dobro de ${B} é ${doubleB}. Conta limpa: ${halfA} × ${doubleB} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Distributiva (Dezenas + Unidades)',
          summary: bTens > 0
            ? `(${A} × ${bTens}) + (${A} × ${bUnits}) = ${A * bTens} + ${A * bUnits} = ${ans}!`
            : `Multiplique por 10 (${A} × 10 = ${A * 10}) e pegue a metade: ${ans}!`,
        },
        {
          badge: '🔟 Jeito 3 — Âncora de Grupos',
          summary: `A cada 2 unidades de ${B} você forma ${doubleB} redondo; repita ${halfA} vezes = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 1: O Truque do 9 (ou 19 / 29 / 99) — Multiplicar pelo Redondo e Tirar 1 Grupo
  if (t === 1) {
    const nineFactor = cycle === 0 ? pick([9, 19]) : pick([9, 19, 29, 99]);
    const roundFactor = nineFactor + 1; // 10, 20, 30, or 100
    const B = nineFactor === 99 ? r(2, 9) : r(4 + cycle * 2, 16 + cycle * 4);
    const roundProd = roundFactor * B;
    const ans = nineFactor * B;

    return buildQuestion({
      expression: `${nineFactor} × ${B}`,
      lensTitle: `O Truque do ${nineFactor} (Base ${roundFactor})`,
      hint: `Faça ${roundFactor} × ${B} = ${roundProd} e tire um grupo de ${B}`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [roundProd - 1, ans + B, ans - 10]),
      realLifeTip: `Comprar ${B} itens de R$ ${nineFactor},00: pague R$ ${roundProd} e receba R$ ${B} de troco!`,
      trapNote: `${roundProd - 1} — tirou apenas 1 unidade em vez de tirar 1 grupo inteiro de ${B}`,
      methods: [
        {
          badge: `⚡ Jeito 1 — Visão pelo Topo (${roundFactor} − 1)`,
          summary: `${roundFactor} × ${B} = ${roundProd}. Agora tire 1 vez o ${B}: ${roundProd} − ${B} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Soma de Blocos Menores',
          summary: `Separe o ${nineFactor} em ${nineFactor - 4} + 4: (${nineFactor - 4}×${B}) + (4×${B}) = ${(nineFactor - 4) * B} + ${4 * B} = ${ans}!`,
        },
        {
          badge: '🔄 Jeito 3 — Proporção Direta',
          summary: `${B} grupos de ${nineFactor} sempre terminam a ${B} passos abaixo de ${roundProd} = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 2: Corta no Meio (Divisão por Simplificação Sucessiva)
  if (t === 2) {
    const divisor = pick([4, 6, 8, 12, 14, 16]);
    const ans = r(9 + cycle * 3, 28 + cycle * 8);
    const dividend = divisor * ans;
    const halfDiv = dividend / 2;
    const halfDivisor = divisor / 2;
    const anchorChunk = divisor * 10;
    const remainderChunk = dividend - anchorChunk;

    return buildQuestion({
      expression: `${dividend} ÷ ${divisor}`,
      lensTitle: 'Corta no Meio (Simplificação)',
      hint: `Ambos são pares! Corte pela metade: ${halfDiv} ÷ ${halfDivisor}`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [ans + 2, ans - 2, halfDiv]),
      realLifeTip: `Dividir uma conta de R$ ${dividend} entre ${divisor} amigos tirando a metade duas vezes.`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Corta no Meio',
          summary: divisor === 4
            ? `Dividir por 4 é tirar a metade duas vezes: metade de ${dividend} é ${halfDiv}, metade de ${halfDiv} é ${ans}!`
            : `Corte os dois pela metade: ${dividend} ÷ ${divisor} vira ${halfDiv} ÷ ${halfDivisor} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Fatiar em Parte Redonda',
          summary: `Separe ${dividend} em ${anchorChunk} + ${remainderChunk}: (${anchorChunk}÷${divisor}) + (${remainderChunk}÷${divisor}) = 10 + ${remainderChunk / divisor} = ${ans}!`,
        },
        {
          badge: '🪞 Jeito 3 — Espelho da Multiplicação',
          summary: `Pense ao contrário: quantos grupos de ${divisor} cabem em ${dividend}? ${divisor} × ${ans} = ${dividend}!`,
        },
      ],
    });
  }

  // Subtype 3: Segredo do 11 (10×N + N / Soma no Meio)
  if (t === 3) {
    const B = r(12 + cycle * 3, 34 + cycle * 6);
    const tenB = B * 10;
    const ans = 11 * B;
    return buildQuestion({
      expression: `11 × ${B}`,
      lensTitle: 'O Segredo do 11 (10 + 1)',
      hint: `Faça 10 × ${B} (${tenB}) e some mais 1 vez o ${B}!`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [tenB + 1, ans - 10, ans + 11]),
      realLifeTip: `Calcular 11 mensalidades ou 11 pacotes somando 10 pacotes + 1 pacote extra.`,
      trapNote: `${tenB + 1} — somou apenas 1 unidade em vez de somar 1 grupo de ${B}`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Dezena + 1 Grupo',
          summary: `11 × ${B} é (10 × ${B}) + ${B} = ${tenB} + ${B} = ${ans}!`,
        },
        {
          badge: '🪄 Jeito 2 — Abre os Dígitos e Soma no Meio',
          summary: `Separe os algarismos de ${B} (${Math.floor(B / 10)} e ${B % 10}) e coloque a soma deles (${Math.floor(B / 10) + (B % 10)}) no meio = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 3 — Dezenas Separadas',
          summary: `11 × ${Math.floor(B / 10) * 10} = ${11 * Math.floor(B / 10) * 10}, mais 11 × ${B % 10} (${11 * (B % 10)}) = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 4: Multiplicação por 5 (Multiplicar por 10 e cortar na metade)
  const evenN = r(6 + cycle * 4, 28 + cycle * 8) * 2;
  const tenTimes = evenN * 10;
  const ans = evenN * 5;
  return buildQuestion({
    expression: `${evenN} × 5`,
    lensTitle: 'O Truque do 5 (Metade de ×10)',
    hint: `Multiplique ${evenN} por 10 (${tenTimes}) e corte na metade!`,
    correctAnswer: ans,
    wrongAnswers: wrongs(ans, [ans + 10, ans - 5, evenN * 4]),
    realLifeTip: `Calcular 5 notas ou moedas: é sempre a metade do valor multiplicado por 10.`,
    methods: [
      {
        badge: '⚡ Jeito 1 — Multiplica por 10 e Corta na Metade',
        summary: `5 é a metade de 10! Faça ${evenN} × 10 = ${tenTimes}, e a metade de ${tenTimes} é ${ans}!`,
      },
      {
        badge: '🧱 Jeito 2 — Corta na Metade e Poe o Zero',
        summary: `Metade de ${evenN} é ${evenN / 2}. Agora multiplique por 10 colocando um zero: ${ans}!`,
      },
      {
        badge: `🖐️ Jeito 3 — Decomposição (${Math.floor(evenN / 10) * 10} + ${evenN % 10})`,
        summary: `(${Math.floor(evenN / 10) * 10} × 5) + (${evenN % 10} × 5) = ${Math.floor(evenN / 10) * 50} + ${(evenN % 10) * 5} = ${ans}!`,
      },
    ],
  });
}

// ── Tier 3 — Ordem das Operações (PEMDAS), Fator Comum & Quadrados Mágicos ────
function genTier3(cycle: number): Question {
  const t = r(0, 4);
  const rA = (lo: number, hi: number) => r(lo + cycle * 3, hi + cycle * 6);
  const rM = (lo: number, hi: number) => r(lo + cycle,     hi + cycle * 2);

  // Subtype 0: Fator Comum / Distributiva (A × C + B × C where A + B = 10 or 20!)
  if (t === 0) {
    const sumTarget = pick([10, 20]);
    const A = r(2, sumTarget - 2);
    const B = sumTarget - A;
    const C = r(4 + cycle * 2, 18 + cycle * 4);
    const ans = (A + B) * C;
    const trap = (A * C + B) * C;

    return buildQuestion({
      expression: `${A} × ${C} + ${B} × ${C}`,
      lensTitle: 'Fator Comum (Juntar Pacotes)',
      hint: `${A} pacotes de ${C} + ${B} pacotes de ${C} = ${A + B} pacotes de ${C}!`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, A * C + B, ans - C]),
      realLifeTip: `${A} caixas com ${C} itens mais ${B} caixas com ${C} itens formam ${sumTarget} caixas de ${C}!`,
      trapNote: `${trap} — somou da esquerda para a direita sem separar os produtos`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Juntar os Pacotes (Distributiva)',
          summary: `Junte os grupos iguais: (${A} + ${B}) × ${C} = ${sumTarget} × ${C} = ${ans} instantâneo!`,
        },
        {
          badge: '🧱 Jeito 2 — PEMDAS Passo a Passo',
          summary: `Calcule cada produto (${A}×${C}=${A * C} e ${B}×${C}=${B * C}) e some: ${A * C} + ${B * C} = ${ans}!`,
        },
        {
          badge: '🔍 Jeito 3 — Conferência por Metades',
          summary: `${sumTarget} vezes ${C} é ${ans}; tirando ${B}×${C} (${B * C}) sobra exatamente ${A}×${C} (${A * C})!`,
        },
      ],
    });
  }

  // Subtype 1: A + B × C (PEMDAS with friendly mental numbers)
  if (t === 1) {
    const A = rA(10, 38);
    const B = rM(3, 9);
    const C = pick([4, 5, 6, 7, 8, 9, 10, 12]);
    const prod = B * C;
    const ans = A + prod;
    const trap = (A + B) * C;

    return buildQuestion({
      expression: `${A} + ${B} × ${C}`,
      lensTitle: 'Hierarquia PEMDAS (Pacotes Primeiro)',
      hint: `Resolva o pacote ${B} × ${C} = ${prod} antes de somar com ${A}`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, A + B + C, A * B + C]),
      realLifeTip: `Você tem R$ ${A} na carteira e ganha ${B} notas de R$ ${C} (+R$ ${prod}).`,
      trapNote: `(${A}+${B})×${C} = ${trap} — somou antes de multiplicar`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Ordem das Operações (PEMDAS)',
          summary: `Multiplicação tem prioridade: ${B} × ${C} = ${prod}. Depois some: ${A} + ${prod} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Visão em Caixas',
          summary: `${A} unidades soltas + ${B} caixas de ${C} (${prod} unidades) = ${ans} no total!`,
        },
        {
          badge: '🎯 Jeito 3 — Decomposição Final',
          summary: `Some as dezenas de ${A} e ${prod} primeiro e feche as unidades = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 2: A − B × C (PEMDAS Subtraction)
  if (t === 2) {
    const B = rM(3, 9);
    const C = pick([4, 5, 6, 7, 8, 9]);
    const prod = B * C;
    const A = prod + rA(8, 36);
    const ans = A - prod;
    const trap = (A - B) * C;

    return buildQuestion({
      expression: `${A} − ${B} × ${C}`,
      lensTitle: 'PEMDAS na Subtração',
      hint: `Descubra o custo total (${B} × ${C} = ${prod}) antes de descontar de ${A}`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, A - B - C, A + prod]),
      realLifeTip: `Pagar ${B} ingressos de R$ ${C} (R$ ${prod}) usando um saldo de R$ ${A}.`,
      trapNote: `(${A}−${B})×${C} = ${trap} — subtraiu antes de multiplicar`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Multiplica e Desconta',
          summary: `Primeiro o produto: ${B} × ${C} = ${prod}. Depois o troco: ${A} − ${prod} = ${ans}!`,
        },
        {
          badge: `🌉 Jeito 2 — A Ponte até ${A}`,
          summary: `Como ${B} × ${C} = ${prod}, pense: quanto falta de ${prod} para chegar em ${A}? Faltam ${ans}!`,
        },
        {
          badge: '🧱 Jeito 3 — Desconto em Etapas',
          summary: `Tire as dezenas de ${prod} (${Math.floor(prod / 10) * 10}) de ${A} e depois tire as ${prod % 10} unidades = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 3: Diferença de Quadrados Simétricos (A² − B² = (A−B)×(A+B))
  if (t === 3) {
    const sumRound = pick([20, 30, 40, 50]);
    const half = sumRound / 2;
    const delta = r(1, Math.min(6, half - 2));
    const A = half + delta;
    const B = half - delta;
    const diff = A - B;
    const ans = diff * sumRound;
    const trap = diff * diff;

    return buildQuestion({
      expression: `${A}² − ${B}²`,
      lensTitle: 'Diferença de Quadrados',
      hint: `Use (A − B) × (A + B): (${A} − ${B}) × (${A} + ${B}) = ${diff} × ${sumRound}!`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, ans - sumRound, ans + sumRound]),
      realLifeTip: `Comparar a área de dois terrenos quadrados (${A}×${A} vs ${B}×${B}) em 2 segundos sem elevar ao quadrado!`,
      trapNote: `${trap} — fez (${A}−${B})² em vez de (${A}−${B})×(${A}+${B})`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Soma × Diferença',
          summary: `${A}² − ${B}² = (${A} − ${B}) × (${A} + ${B}) = ${diff} × ${sumRound} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Quadrados Diretos',
          summary: `${A}² = ${A * A} e ${B}² = ${B * B}. Subtraindo: ${A * A} − ${B * B} = ${ans}!`,
        },
        {
          badge: '📐 Jeito 3 — Faixa Geométrica em L',
          summary: `A borda entre os quadrados tem largura ${diff} e comprimento médio ${sumRound}: ${diff} × ${sumRound} = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 4: (A ÷ B) + C
  const B = pick([3, 4, 5, 6, 7, 8, 9]);
  const M = rM(4, 14);
  const A = B * M;
  const C = rA(10, 35);
  const ans = M + C;
  return buildQuestion({
    expression: `${A} ÷ ${B} + ${C}`,
    lensTitle: 'Divisão Antes da Soma',
    hint: `Divida o pacote ${A} ÷ ${B} = ${M} primeiro, depois some +${C}`,
    correctAnswer: ans,
    wrongAnswers: wrongs(ans, [M * C, A + C, Math.abs(M - C)]),
    realLifeTip: `Repartir R$ ${A} entre ${B} pessoas (R$ ${M} para cada) e somar com R$ ${C} que você já tinha.`,
    methods: [
      {
        badge: '⚡ Jeito 1 — PEMDAS Direto',
        summary: `Passo 1: ${A} ÷ ${B} = ${M}. Passo 2: ${M} + ${C} = ${ans}!`,
      },
      {
        badge: '🪞 Jeito 2 — Espelho da Tabuada + Soma',
        summary: `Como ${B} × ${M} = ${A}, a divisão vale ${M}. Somando com ${C} dá ${ans}!`,
      },
      {
        badge: '🧱 Jeito 3 — Tudo no Mesmo Pacote',
        summary: `${C} equivale a ${C * B}÷${B}. Juntando (${A}+${C * B})÷${B} = ${A + C * B}÷${B} = ${ans}!`,
      },
    ],
  });
}

// ── Tier 4 — Sinais Inteligentes, Frações Práticas & Máquina do Tempo ─────────
function genTier4(cycle: number): Question {
  const t = r(0, 4);

  // Subtype 0: Fração de um Inteiro — (A/D) × N (3 ways to solve!)
  if (t === 0) {
    const dPool = cycle === 0 ? [2, 3, 4, 5, 6, 8, 10] : [3, 4, 5, 6, 8, 9, 10, 12];
    const D = pick(dPool);
    const k = r(2 + cycle, 12 + cycle * 3);
    const N = D * k;
    const A = r(1, D - 1);
    const ans = A * k;
    const trap = A * N; // forgot to divide by D
    const missingParts = D - A;

    return buildQuestion({
      expression: `(${A}/${D}) × ${N}`,
      lensTitle: 'Fração de um Total',
      hint: `Descubra 1/${D} dividindo ${N} ÷ ${D} = ${k}, depois multiplique por ${A}!`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, k, ans + k]),
      realLifeTip: `Calcular ${A}/${D} de uma turma ou conta de ${N}: cada parte de 1/${D} vale ${k}!`,
      trapNote: `${trap} — multiplicou ${A} × ${N} mas esqueceu de dividir por ${D}`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Divide Primeiro (Números Pequenos!)',
          summary: `Divida primeiro: ${N} ÷ ${D} = ${k} (valor de 1 parte). Agora pegue ${A} partes: ${A} × ${k} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Multiplica e Divide',
          summary: `Multiplique em cima (${A} × ${N} = ${A * N}) e divida por ${D}: ${A * N} ÷ ${D} = ${ans}!`,
        },
        {
          badge: '🍕 Jeito 3 — Visão pelo Todo (Complemento)',
          summary: `O todo é ${N}. Faltam ${missingParts}/${D} (${missingParts} × ${k} = ${missingParts * k}). Então ${N} − ${missingParts * k} = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 1: Soma de Frações Práticas (Expanded Denominator Pairs)
  if (t === 1) {
    const pairs: Array<{ D1: number; D2: number; factor: number }> = [
      { D1: 2, D2: 4, factor: 2 },
      { D1: 2, D2: 6, factor: 3 },
      { D1: 2, D2: 8, factor: 4 },
      { D1: 2, D2: 10, factor: 5 },
      { D1: 3, D2: 6, factor: 2 },
      { D1: 3, D2: 9, factor: 3 },
      { D1: 3, D2: 12, factor: 4 },
      { D1: 4, D2: 8, factor: 2 },
      { D1: 4, D2: 12, factor: 3 },
      { D1: 5, D2: 10, factor: 2 },
      { D1: 6, D2: 12, factor: 2 },
    ];
    const { D1, D2, factor } = pick(pairs);
    const A = r(1, Math.max(1, D1 - 1));
    const B = r(1, Math.max(1, D2 - 1));
    const ans = fAdd({ n: A, d: D1 }, { n: B, d: D2 });
    const trap = fSim({ n: A + B, d: D1 + D2 }); // summed denominators!
    const d1 = fSim({ n: factor * A, d: D2 });
    const d2 = fAdd(ans, { n: 1, d: D2 });

    return buildQuestion({
      expression: `(${A}/${D1}) + (${B}/${D2})`,
      lensTitle: 'Fatias do Mesmo Tamanho (Frações)',
      hint: `Transforme ${A}/${D1} em ${factor * A}/${D2} multiplicando em cima e embaixo por ${factor}`,
      correctAnswer: fVal(ans),
      wrongAnswers: wrongs(fVal(ans), [fVal(trap), fVal(d1), fVal(d2)]),
      answerLabels: mkFracLabels([ans, trap, d1, d2]),
      realLifeTip: `Juntar ${A}/${D1} de hora/pizza com ${B}/${D2}: corte as fatias maiores para somar igual com igual!`,
      trapNote: `${fLbl(trap)} — somou os denominadores (${D1}+${D2}=${D1 + D2})`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Igualar o Tamanho da Fatia',
          summary: `Multiplique ${A}/${D1} por ${factor} em cima e embaixo: vira ${factor * A}/${D2}. Agora some: ${factor * A}/${D2} + ${B}/${D2} = ${fLbl(ans)}!`,
        },
        {
          badge: '🍕 Jeito 2 — Visão de Fatias',
          summary: `Cada 1/${D1} vale ${factor} fatias de 1/${D2}. Então ${A}×${factor} + ${B} = ${factor * A + B} fatias de 1/${D2} (${fLbl(ans)})!`,
        },
        {
          badge: '🔍 Jeito 3 — Simplificação Final',
          summary: `${factor * A + B}/${D2} simplificado pelo máximo divisor comum resulta em ${fLbl(ans)}!`,
        },
      ],
    });
  }

  // Subtype 2: Duplo Negativo — Cancelar uma Dívida: A − (−B × C)
  if (t === 2) {
    const A = r(11 + cycle * 5, 42 + cycle * 8);
    const B = r(2 + cycle, 8 + cycle);
    const C = r(2, 8);
    const prod = B * C;
    const ans = A + prod;
    const trap = A - prod;

    return buildQuestion({
      expression: `${A} − (−${B} × ${C})`,
      lensTitle: 'Duplo Negativo (Cancelar Dívida)',
      hint: `Tirar uma dívida de −${prod} é o mesmo que GANHAR +${prod}!`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, -(A + prod), A + B + C]),
      realLifeTip: `Se o banco perdoa (subtrai) uma cobrança negativa de −R$ ${prod}, seu saldo sobe +R$ ${prod}!`,
      trapNote: `${trap} — ignorou o sinal de menos antes do parêntese`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Menos com Menos dá Mais',
          summary: `Dentro do parêntese: −${B} × ${C} = −${prod}. Como −(−${prod}) = +${prod}, fica ${A} + ${prod} = ${ans}!`,
        },
        {
          badge: '🌍 Jeito 2 — Lógica Financeira',
          summary: `Retirar (−) um prejuízo de −${prod} aumenta seu poder em +${prod}: ${A} + ${prod} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 3 — Distributiva do Sinal',
          summary: `−1 × (−${B}) = +${B}. Então a conta vira diretamente ${A} + ${B} × ${C} = ${ans}!`,
        },
      ],
    });
  }

  // Subtype 3: Máquina do Tempo (Equação Inversa: K × [ ? ] + B = C)
  if (t === 3) {
    const K = r(2, 7);
    const ans = r(3, 15 + cycle * 3);
    const B = r(4, 25);
    const isPlus = Math.random() < 0.6;
    const C = isPlus ? K * ans + B : K * ans - B;
    const mid = K * ans;
    const trap = isPlus ? C - B : C + B; // forgot to divide by K

    return buildQuestion({
      expression: isPlus ? `${K} × [ ? ] + ${B} = ${C}` : `${K} × [ ? ] − ${B} = ${C}`,
      lensTitle: 'Máquina do Tempo (Operação Inversa)',
      hint: isPlus
        ? `Desfaça o +${B} primeiro (${C} − ${B} = ${mid}), depois divida por ${K}!`
        : `Desfaça o −${B} primeiro (${C} + ${B} = ${mid}), depois divida por ${K}!`,
      correctAnswer: ans,
      wrongAnswers: wrongs(ans, [trap, ans + K, Math.max(1, ans - 2)]),
      realLifeTip: `Descobrir o preço unitário de ${K} itens sabendo o total final com frete/desconto de R$ ${B}.`,
      trapNote: `${trap} — desfez a soma/subtração mas esqueceu de dividir por ${K}`,
      methods: [
        {
          badge: '⚡ Jeito 1 — Rebobinar o Filme',
          summary: isPlus
            ? `Tire ${B} de ${C} (${mid}) e divida por ${K}: ${mid} ÷ ${K} = ${ans}!`
            : `Devolva ${B} para ${C} (${mid}) e divida por ${K}: ${mid} ÷ ${K} = ${ans}!`,
        },
        {
          badge: '🪞 Jeito 2 — Teste Direto na Caixa',
          summary: `${K} × ${ans} = ${mid}, e ${isPlus ? `${mid} + ${B}` : `${mid} − ${B}`} fecha exatamente ${C}!`,
        },
        {
          badge: '⚖️ Jeito 3 — Balança Equilibrada',
          summary: `Isolando os ${K} pacotes iguais que valem ${mid}, cada pacote vale ${ans}!`,
        },
      ],
    });
  }

  // Subtype 4: Quantas Fatias Cabem? — Divisão de Frações (A/D1) ÷ (A/D2)
  const divPairs: Array<[number, number, number]> = [
    [2, 4, 2],
    [2, 6, 3],
    [2, 8, 4],
    [2, 10, 5],
    [2, 12, 6],
    [3, 6, 2],
    [3, 9, 3],
    [3, 12, 4],
    [4, 8, 2],
    [4, 12, 3],
    [5, 10, 2],
    [6, 12, 2],
  ];
  const [D1, D2, correctInt] = pick(divPairs);
  const A = r(1, Math.max(1, D1 - 1));
  const lhs: Frac = { n: A, d: D1 };
  const rhs: Frac = { n: A, d: D2 };
  const ansF: Frac = { n: correctInt, d: 1 };
  const trapF: Frac = fSim({ n: D1, d: D2 });
  const d1F: Frac = { n: correctInt + 1, d: 1 };
  const d2F: Frac = { n: correctInt + 2, d: 1 };

  return buildQuestion({
    expression: `(${fLbl(lhs)}) ÷ (${fLbl(rhs)})`,
    lensTitle: 'Quantos Cabem? (Divisão de Frações)',
    hint: `Quantas fatias de ${fLbl(rhs)} cabem dentro de ${fLbl(lhs)}? (Ou inverta a 2ª e multiplique)`,
    correctAnswer: fVal(ansF),
    wrongAnswers: wrongs(fVal(ansF), [fVal(trapF), fVal(d1F), fVal(d2F)]),
    answerLabels: mkFracLabels([ansF, trapF, d1F, d2F]),
    realLifeTip: `Quantos copos de 1/${D2} L enchem uma jarra de 1/${D1} L? Exatamente ${correctInt} copos!`,
    trapNote: `${fLbl(trapF)} — inverteu a primeira fração em vez da segunda`,
    methods: [
      {
        badge: '⚡ Jeito 1 — Lógica Intuitiva (Quantos Cabem?)',
        summary: `Como ${D2} é ${correctInt}× maior que ${D1}, cada fatia de ${fLbl(lhs)} contém exatamente ${correctInt} fatias de ${fLbl(rhs)}!`,
      },
      {
        badge: '🔄 Jeito 2 — Multiplica pelo Inverso (KCF)',
        summary: `(${A}/${D1}) × (${D2}/${A}) = os "${A}" se cancelam e sobra ${D2} ÷ ${D1} = ${correctInt}!`,
      },
      {
        badge: `🧱 Jeito 3 — Mesmo Denominador (${D2})`,
        summary: `Converta ${A}/${D1} para ${A * correctInt}/${D2}. Agora divida os numeradores: (${A * correctInt}) ÷ ${A} = ${correctInt}!`,
      },
    ],
  });
}

// ── Public API — Dynamic Question Generator ────────────────────────────────────
/**
 * Generates a unique, stage-scaled basic math question with 3 mental solution paths.
 *
 *   Tier 1 (stages 1–2, 9–10 …): Soma & Subtração Inteligente (Massinha, Hack Japonês, Caça-Dezenas)
 *   Tier 2 (stages 3–4, 11–12 …): Multiplicação & Divisão Descomplicada (Dobra-Metade, Truque 5/9/11, Corta no Meio)
 *   Tier 3 (stages 5–6, 13–14 …): Ordem das Operações (PEMDAS), Fator Comum & Diferença de Quadrados
 *   Tier 4 (stages 7–8, 15–16 …): Sinais Práticos, Frações do Dia a Dia & Máquina do Tempo
 */
export function generateDynamicQuestion(stage: number): Question {
  const cycle = Math.floor((stage - 1) / 8);
  const tier  = Math.floor(((stage - 1) % 8) / 2) + 1;

  const generateOnce = (): Question => {
    switch (tier) {
      case 1:  return genTier1(cycle);
      case 2:  return genTier2(cycle);
      case 3:  return genTier3(cycle);
      default: return genTier4(cycle);
    }
  };

  let fallback: Question | null = null;
  for (let attempt = 0; attempt < 48; attempt++) {
    const candidate = generateOnce();
    fallback = candidate;
    const sig = `${candidate.expression}=${candidate.correctAnswer}`;
    const isRecentLens =
      attempt < 16 &&
      candidate.lensTitle !== undefined &&
      RECENT_ASCENSION_LENSES.slice(-2).includes(candidate.lensTitle);
    if (!SEEN_ASCENSION_EXPRESSIONS.has(sig) && !isRecentLens) {
      recordAscensionQuestion(candidate);
      return candidate;
    }
  }

  const chosen = fallback ?? generateOnce();
  recordAscensionQuestion(chosen);
  return chosen;
}

// ── Oracle Constants ───────────────────────────────────────────────────────────
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
  monsterLevels: [number, number, number];
  baseBuffMultiplier: number;
  revealedBuffMultiplier: number;
  revealedBuffLabel: string;
  optimalOrder: string[];
  rationale: string;
  logLines: string[];
  projectedPowerAfterRoom: number;
}

export function runOracle(
  playerPower:     number,
  pathId:          PathId,
  overrideBuffMult?: number,
): OracleResult {
  const scale  = pathId === 'buff' ? BUFF_SCALE      : SAC_SCALE;
  const absorp = pathId === 'buff' ? BUFF_ABSORPTION : SAC_ABSORPTION;

  let baseMult: number;
  let modMult:  number;

  if (overrideBuffMult === undefined) {
    if (pathId === 'buff') {
      baseMult = 0.5;
      modMult  = 0.25;
    } else {
      baseMult = 2.0;
      modMult  = 3.0;
    }
  } else {
    baseMult = overrideBuffMult;
    modMult  = overrideBuffMult;
  }

  const buffFirst = modMult < 1;

  let pp = Math.max(2, playerPower);
  if (buffFirst) pp = Math.max(2, Math.round(pp * modMult));

  const M1 = Math.max(1, Math.round(pp * scale));
  pp += M1 * absorp;
  const M2 = Math.max(1, Math.round(pp * scale));
  pp += M2 * absorp;
  const M3 = Math.max(1, Math.round(pp * scale));
  pp += M3 * absorp;

  if (!buffFirst) pp = Math.max(2, Math.round(pp * modMult));

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
      ? `Buff ${lbl} < 1 → tome o debuff cedo, enquanto seu poder é menor.`
      : `Buff ${lbl} ≥ 1 → derrote os monstros primeiro e multiplique tudo no final!`,
    projectedPowerAfterRoom,
    logLines: room0
      ? [
          `🔮 Oracle [${pathId}] Sala-1: ${pathId === 'buff' ? 'MC×2 → MALDIÇÃO ×¼' : 'MC×½ → BÔNUS ×3'}`,
          `📊 Monstros [${pct}% abs.]: M1=${M1} · M2=${M2} · M3=${M3}`,
          `📈 Poder proj.: ${projectedPowerAfterRoom}`,
        ]
      : [
          `🔮 Oracle [${pathId}]: Buff ${lbl} | ${buffFirst ? 'debuff cedo' : 'buff no final'}`,
          `📊 Monstros [${pct}% abs.]: M1=${M1} · M2=${M2} · M3=${M3}`,
          `📈 Poder proj.: ${projectedPowerAfterRoom}`,
        ],
  };
}

// ── Global Theoretical Maximum ─────────────────────────────────────────────
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

  // Sacrifice path
  pp = Math.round(pp * 0.5);
  pp = simRoom(pp, SAC_SCALE, 3.0, false);
  for (let k = 1; k < NUM_ROOMS; k++)
    pp = simRoom(pp, SAC_SCALE, 1.5, false);

  // Buff path
  pp = Math.round(pp * 2);
  pp = simRoom(pp, BUFF_SCALE, 0.25, true);
  for (let k = 1; k < NUM_ROOMS; k++)
    pp = simRoom(pp, BUFF_SCALE, 1.5, false);

  return pp;
}
