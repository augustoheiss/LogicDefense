// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/infiniteMathEngine.ts
// Motor de Matemática Infinita Isomórfica (Zero Repetição) — Master Plan V6
// Une todas as 18 Apostilas de `src/data/content.ts` + Lentes Heiss-Lab em
// 4 Graus de Dificuldade Escolhíveis:
//   1 = 🟢 Fácil (Cálculo Mental Ágil: Massinha, Hack Japonês, Dobro×4, Relógio×5, Equação 1-Passo)
//   2 = 🔵 Médio (Aritmética Elegante: Dobra e Meia, ×9/×11/×15, Porcentagem, Elevador, PEMDAS)
//   3 = 🟣 Difícil (Álgebra & Fatoração: Fator Comum, Dif. Quadrados, Frações, Dízimas 99, Máquina do Tempo)
//   4 = 👑 Muito Difícil (Problemas Contextualizados da Coletânea: Tanque, Herança, Regra de 3 Inversa,
//                         Torneiras, Divisores de 60/360, Balança Montar & Resolver, Trincheira de Chaves)
// ──────────────────────────────────────────────────────────────────────────────

import { EngineId } from '../engines/engineContract'
import { ConceptId, RedemptionChoice } from '../types'

export type MathDifficultyTier = 1 | 2 | 3 | 4

export interface MentalSolutionMethod {
  badge: string
  summary: string
}

export interface MathTierPolicySpec {
  tier: MathDifficultyTier
  icon: string
  badgePt: string
  titlePt: string
  subtitlePt: string
  colorHex: string
  armyMultiplier: number
  flatSoldiersBonus: number
  coinsBonus: number
  weaponDmgMultiplier: number
  comboBonusSteps: number
  engineRewardSummary: Record<EngineId, string>
}

export const MATH_CHALLENGE_TIER_POLICIES: Record<MathDifficultyTier, MathTierPolicySpec> = {
  1: {
    tier: 1,
    icon: '🟢',
    badgePt: '🟢 Fácil',
    titlePt: 'Grau I · Cálculo Ágil',
    subtitlePt: 'Massinha da Soma, Hack Japonês, Dobro×4, Relógio×5 e Balança Rápida',
    colorHex: '#10b981',
    armyMultiplier: 1.2,
    flatSoldiersBonus: 8,
    coinsBonus: 22,
    weaponDmgMultiplier: 1.15,
    comboBonusSteps: 1,
    engineRewardSummary: {
      ponte_portoes: '+20% Soldados (+mín. 8), +22 🪙 Ouro e +15% Cadência na Ponte',
      cerco_torres: '+22 🪙 Ouro, Repara +25% da Paliçada e +15% Dano nas Torres',
      forte_bandeira: '+22 🪙 Ouro, Despacha +2 Soldados Aliados e acelera Quartéis',
      pedreira_rei: '+22 🪙 Ouro, +2 Lingotes no Pallet e +1 Operário Rápido',
      arena_ondas: '+22 🪙 Ouro, +1 Atirador no Esquadrão e +15% Dano de Arma',
      serpente_numeros: '+1 Besteiro no Esquadrão, +4 Dano por Flecha e +22 🪙',
    },
  },
  2: {
    tier: 2,
    icon: '🔵',
    badgePt: '🔵 Médio',
    titlePt: 'Grau II · Aritmética Elegante',
    subtitlePt: 'Dobra e Meia, Truque do 9/11/15, Porcentagem, Elevador e PEMDAS',
    colorHex: '#38bdf8',
    armyMultiplier: 1.45,
    flatSoldiersBonus: 18,
    coinsBonus: 45,
    weaponDmgMultiplier: 1.3,
    comboBonusSteps: 2,
    engineRewardSummary: {
      ponte_portoes: '+45% Soldados (+mín. 18), +45 🪙 Ouro e Tiro Duplo na Ponte!',
      cerco_torres: '+45 🪙 Ouro, Ergue 1 Torre de Besteiros 2.5D Grátis + Guarda!',
      forte_bandeira: '+45 🪙 Ouro, Despacha +3 Soldados + 1 Blindado Leve do Quartel!',
      pedreira_rei: '+45 🪙 Ouro, +3 Lingotes de Ouro e +2 Operários Carregadores!',
      arena_ondas: '+45 🪙 Ouro, +2 Atiradores no Esquadrão e Feixe Duplo de Plasma!',
      serpente_numeros: '+2 Besteiros Aliados, Dano de Flecha ×1,5 e Salva Explosiva!',
    },
  },
  3: {
    tier: 3,
    icon: '🟣',
    badgePt: '🟣 Difícil',
    titlePt: 'Grau III · Supernova Algébrica',
    subtitlePt: 'Fator Comum, Diferença de Quadrados, Frações, Dízimas (99) e Máquina do Tempo',
    colorHex: '#a855f7',
    armyMultiplier: 1.75,
    flatSoldiersBonus: 32,
    coinsBonus: 85,
    weaponDmgMultiplier: 1.55,
    comboBonusSteps: 3,
    engineRewardSummary: {
      ponte_portoes: '+75% Soldados (+mín. 32), +85 🪙 Ouro e Canhão Perfurante!',
      cerco_torres: '+85 🪙 Ouro, Evolui Torres para Pedra + Ativa Morteiro Real ÷3!',
      forte_bandeira: '+85 🪙 Ouro, Constrói/Evolui Fábrica + Despacha 1 Tanque + 4 Soldados!',
      pedreira_rei: '+85 🪙 Ouro, +4 Lingotes de Ouro + Contrata 1 Titã Carregador!',
      arena_ondas: '+85 🪙 Ouro, Despacha 1 Sentinela Mecha 360° + 2 Atiradores!',
      serpente_numeros: '+3 Besteiros Aliados, Dano ×2, +1 ❤️ Vida e Detona 20% do Dragão!',
    },
  },
  4: {
    tier: 4,
    icon: '👑',
    badgePt: '👑 Muito Difícil',
    titlePt: 'Grau IV · Problema Mestre',
    subtitlePt: 'Problemas da Coletânea: Tanque, Herança, Regra de 3 Inversa, Divisores e Trincheira',
    colorHex: '#facc15',
    armyMultiplier: 2.0,
    flatSoldiersBonus: 55,
    coinsBonus: 150,
    weaponDmgMultiplier: 2.0,
    comboBonusSteps: 4,
    engineRewardSummary: {
      ponte_portoes: '👑 DOBRA O EXÉRCITO (×2 + 55), +150 🪙 Ouro e Salva Real contra o Boss!',
      cerco_torres: '👑 +150 🪙 Ouro, +2 Torres Nv.3, Morteiro Real e Chuva de Flechas no Boss!',
      forte_bandeira: '👑 +150 🪙 Ouro, Evolui Quartéis + Despacha 2 Tanques Pesados e 6 Soldados!',
      pedreira_rei: '👑 +150 🪙 Ouro, +6 Lingotes de Ouro, +2 Titãs e Britador Turbo ×3!',
      arena_ondas: '👑 +150 🪙 Ouro, +2 Sentinelas Mecha 360°, +4 Atiradores e Supernova!',
      serpente_numeros: '👑 +4 Besteiros Aliados, Dano ×3, +1 ❤️ Vida e Corta 35% do HP do Dragão!',
    },
  },
}

export interface InfiniteMathChallenge {
  id: string
  signature: string
  archetypeId: string
  tier: MathDifficultyTier
  lensTitlePt: string
  conceptId: ConceptId
  codexSlug: string
  questionPt: string
  expressionBadge?: string
  luzGuiaPt: string
  stepByStepPt: string
  guidedWalkthroughPt: string
  methods: MentalSolutionMethod[]
  realLifeTipPt: string
  choices: RedemptionChoice[]
  correctValue: number
}

// ── Anel de Deduplicação em Memória + Sincronização com SaveV1 ────────────────
const SESSION_SEEN_SIGNATURES = new Set<string>()
const SESSION_SIGNATURE_QUEUE: string[] = []
const MAX_SEEN_SIGNATURES = 260

const RECENT_ARCHETYPE_QUEUE: string[] = []
const MAX_RECENT_ARCHETYPES = 6

export function recordSeenMathChallenge(signature: string, archetypeId: string): void {
  if (!SESSION_SEEN_SIGNATURES.has(signature)) {
    SESSION_SEEN_SIGNATURES.add(signature)
    SESSION_SIGNATURE_QUEUE.push(signature)
    if (SESSION_SIGNATURE_QUEUE.length > MAX_SEEN_SIGNATURES) {
      const oldest = SESSION_SIGNATURE_QUEUE.shift()
      if (oldest) SESSION_SEEN_SIGNATURES.delete(oldest)
    }
  }
  RECENT_ARCHETYPE_QUEUE.push(archetypeId)
  if (RECENT_ARCHETYPE_QUEUE.length > MAX_RECENT_ARCHETYPES) {
    RECENT_ARCHETYPE_QUEUE.shift()
  }
}

export function hydrateSeenMathSignatures(signatures: readonly string[] | undefined): void {
  if (!signatures) return
  for (const sig of signatures.slice(-MAX_SEEN_SIGNATURES)) {
    if (!SESSION_SEEN_SIGNATURES.has(sig)) {
      SESSION_SEEN_SIGNATURES.add(sig)
      SESSION_SIGNATURE_QUEUE.push(sig)
    }
  }
}

export function getRecentMathSignaturesSnapshot(): string[] {
  return SESSION_SIGNATURE_QUEUE.slice(-160)
}

// ── Utilitários de Geração Determinística/Paramétrica ────────────────────────
function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function randPick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

interface DistractorCandidate {
  value: number
  label?: string
  diagnosticPt: string
}

function buildFourChoices(
  correctValue: number,
  correctLabel: string | undefined,
  correctDiagnosticPt: string,
  distractors: DistractorCandidate[],
  rng: () => number,
): RedemptionChoice[] {
  const usedValues = new Set<number>([Math.round(correctValue * 10000) / 10000])
  const finalDistractors: DistractorCandidate[] = []

  for (const d of distractors) {
    const snapped = Math.round(d.value * 10000) / 10000
    if (Number.isFinite(snapped) && !usedValues.has(snapped)) {
      usedValues.add(snapped)
      finalDistractors.push({ ...d, value: snapped })
    }
    if (finalDistractors.length === 3) break
  }

  let fallbackDelta = 2
  while (finalDistractors.length < 3) {
    const candidate = Math.round((correctValue + fallbackDelta) * 10000) / 10000
    if (!usedValues.has(candidate)) {
      usedValues.add(candidate)
      finalDistractors.push({
        value: candidate,
        diagnosticPt: `Quase lá! Confira o passo intermediário na Luz-Guia para cravar o valor exato.`,
      })
    }
    fallbackDelta = fallbackDelta > 0 ? -fallbackDelta - 1 : -fallbackDelta + 2
  }

  const rawChoices: Array<Omit<RedemptionChoice, 'id'>> = [
    {
      label: correctLabel ?? `${correctValue}`,
      value: correctValue,
      isCorrect: true,
      diagnosticPt: correctDiagnosticPt,
    },
    ...finalDistractors.map((d) => ({
      label: d.label ?? `${d.value}`,
      value: d.value,
      isCorrect: false,
      diagnosticPt: d.diagnosticPt,
    })),
  ]

  // Embaralhar de forma determinística ou ordenar numericamente quando forem números puros
  const allNumericLabels = rawChoices.every((c) => /^-?\d+(?:[.,]\d+)?%?$/.test(c.label))
  if (allNumericLabels) {
    rawChoices.sort((a, b) => a.value - b.value)
  } else {
    for (let i = rawChoices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = rawChoices[i]
      rawChoices[i] = rawChoices[j]
      rawChoices[j] = tmp
    }
  }

  return rawChoices.map((c, idx) => ({
    ...c,
    id: `c${idx + 1}`,
  }))
}

interface ArchetypeGeneratorSpec {
  archetypeId: string
  tier: MathDifficultyTier
  conceptId: ConceptId
  codexSlug: string
  lensTitlePt: string
  synthesize: (rng: () => number) => Omit<
    InfiniteMathChallenge,
    'id' | 'signature' | 'archetypeId' | 'tier' | 'conceptId' | 'codexSlug' | 'lensTitlePt'
  >
}

// ──────────────────────────────────────────────────────────────────────────────
// BANCO DOS 32+ GERADORES PARAMÉTRICOS INFINITOS (GRAUS I, II, III e IV)
// ──────────────────────────────────────────────────────────────────────────────
const ARCHETYPE_GENERATORS: readonly ArchetypeGeneratorSpec[] = [
  // ===========================================================================
  // 🟢 GRAU I — CONTAS FÁCEIS (Cálculo Mental Ágil & Balança de 1 Passo)
  // ===========================================================================
  {
    archetypeId: 'g1_massinha_soma',
    tier: 1,
    conceptId: 'ponto_de_virada',
    codexSlug: 'aritmetica-elegante-truques',
    lensTitlePt: '🧱 A Massinha da Soma (Lei do Menor Esforço)',
    synthesize: (rng) => {
      const tensA = randInt(rng, 1, 8) * 10
      const unitA = randPick(rng, [7, 8, 9])
      const A = tensA + unitA
      const falta = 10 - unitA
      const B = randInt(rng, 12, 46)
      const roundA = A + falta
      const remB = B - falta
      const ans = A + B
      const methods: MentalSolutionMethod[] = [
        {
          badge: '⚡ Jeito 1 — Massinha (Compensação)',
          summary: `Tire ${falta} do ${B} e entregue ao ${A}: a conta vira ${roundA} + ${remB} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Dezenas + Unidades',
          summary: `Some as dezenas (${tensA} + ${Math.floor(B / 10) * 10} = ${tensA + Math.floor(B / 10) * 10}) e depois as unidades (${unitA} + ${B % 10} = ${unitA + (B % 10)}) = ${ans}!`,
        },
        {
          badge: '🎯 Jeito 3 — Arredonda e Desconta',
          summary: `Faça ${roundA} + ${B} = ${roundA + B} e tire os ${falta} que colocou a mais = ${ans}!`,
        },
      ]
      return {
        expressionBadge: `${A} + ${B} = ?`,
        questionPt: `Calcule de cabeça usando a Massinha da Soma: quanto é ${A} + ${B}?`,
        luzGuiaPt: `O número ${A} precisa de apenas +${falta} para fechar a dezena redonda ${roundA}. Se tirarmos ${falta} do ${B}, que soma limpa aparece?`,
        stepByStepPt: `Passo 1: ${A} + ${falta} = ${roundA}.\nPasso 2: ${B} − ${falta} = ${remB}.\nPasso 3: Agora some ${roundA} com ${remB}.`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Somar preços quebrados (R$ ${A} + R$ ${B}) transferindo R$ ${falta} para fechar dezena exata.`,
        correctValue: ans,
        choices: buildFourChoices(
          ans,
          `${ans}`,
          `Perfeito! Transferindo ${falta} do ${B} para o ${A}, fazemos ${roundA} + ${remB} = ${ans}!`,
          [
            {
              value: roundA + B,
              diagnosticPt: `Você arredondou ${A} para ${roundA} (+${falta}), mas esqueceu de tirar ${falta} do ${B}!`,
            },
            {
              value: ans - 10,
              diagnosticPt: `Confira a subida de dezena: ${A} + ${falta} fecha ${roundA}, e ${roundA} + ${remB} = ${ans}!`,
            },
            {
              value: ans + falta * 2,
              diagnosticPt: `Na soma, se um lado ganha +${falta}, o outro lado cede −${falta}.`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g1_hack_japones_2d',
    tier: 1,
    conceptId: 'subtracao_negativo',
    codexSlug: 'aritmetica-elegante-01',
    lensTitlePt: '🗡️ O Hack Japonês (Subtração Sem Emprestar)',
    synthesize: (rng) => {
      const tensB = randInt(rng, 1, 6) * 10
      const unitB = randPick(rng, [7, 8, 9])
      const B = tensB + unitB
      const shift = 10 - unitB
      const ans = randInt(rng, 14, 58)
      let A = B + ans
      if (A % 10 >= unitB) {
        A = Math.floor(A / 10) * 10 + randInt(rng, 1, unitB - 1)
      }
      const realAns = A - B
      const newA = A + shift
      const newB = B + shift
      const methods: MentalSolutionMethod[] = [
        {
          badge: '⚡ Jeito 1 — Hack Japonês (+' + shift + ' nos Dois)',
          summary: `Some +${shift} nos DOIS números para zerar o subtraendo: ${newA} − ${newB} = ${realAns}!`,
        },
        {
          badge: '🌉 Jeito 2 — A Ponte (Completar)',
          summary: `De ${B} até ${newB} faltam +${shift}; de ${newB} até ${A} faltam +${A - newB} → ${shift} + ${A - newB} = ${realAns}!`,
        },
        {
          badge: '🧱 Jeito 3 — Tira Redondo e Devolve',
          summary: `Tire ${newB} redondo (${A} − ${newB} = ${A - newB}) e devolva +${shift} = ${realAns}!`,
        },
      ]
      return {
        expressionBadge: `${A} − ${B} = ?`,
        questionPt: `Sem pedir emprestado! Use o Hack Japonês para resolver: ${A} − ${B} = ?`,
        luzGuiaPt: `O subtraendo ${B} está a apenas +${shift} de virar ${newB}. Se você somar +${shift} nos DOIS números, a distância entre eles muda?`,
        stepByStepPt: `Passo 1: Some +${shift} no ${B} → vira ${newB}.\nPasso 2: Some +${shift} também no ${A} → vira ${newA}.\nPasso 3: Calcule ${newA} − ${newB}.`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Calcular troco ou diferença de pontuação mantendo a distância constante na reta numérica.`,
        correctValue: realAns,
        choices: buildFourChoices(
          realAns,
          `${realAns}`,
          `Cirúrgico! Somando +${shift} nos dois lados, ${A} − ${B} vira ${newA} − ${newB} = ${realAns} sem nenhum empréstimo!`,
          [
            {
              value: A - newB,
              diagnosticPt: `Você arredondou o ${B} para ${newB} (+${shift}), mas esqueceu de somar +${shift} também no ${A}!`,
            },
            {
              value: realAns + 10,
              diagnosticPt: `Cuidado com a dezena: ${newA} − ${newB} resulta em ${realAns}.`,
            },
            {
              value: realAns - shift * 2,
              diagnosticPt: `Na subtração somamos +${shift} nos dois termos (e não subtraímos).`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g1_dobro_do_dobro_x4',
    tier: 1,
    conceptId: 'soma_repetida_esteira',
    codexSlug: 'magia-calculo-mental-multiplicacao',
    lensTitlePt: '⚡ O Dobro do Dobro (Multiplicar por 4 e por 8)',
    synthesize: (rng) => {
      const mult = randPick(rng, [4, 8])
      const base = randPick(rng, [15, 25, 35, 45, 55, 65, 75, 120, 140])
      const d1 = base * 2
      const d2 = d1 * 2
      const ans = base * mult
      const methods: MentalSolutionMethod[] = [
        {
          badge: `⚡ Jeito 1 — Dobrar ${mult === 4 ? '2 Vezes' : '3 Vezes'}`,
          summary:
            mult === 4
              ? `Dobro de ${base} é ${d1}; dobro de ${d1} é ${d2}!`
              : `Dobro de ${base} é ${d1} → dobro é ${d2} → dobro é ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Decomposição',
          summary: `(${Math.floor(base / 10) * 10} × ${mult}) + (${base % 10} × ${mult}) = ${Math.floor(base / 10) * 10 * mult} + ${(base % 10) * mult} = ${ans}!`,
        },
        {
          badge: '🔄 Jeito 3 — Pares Redondos',
          summary: `Cada par de ${base} forma ${d1} redondo; junte ${mult / 2} pares = ${ans}!`,
        },
      ]
      return {
        expressionBadge: `${base} × ${mult} = ?`,
        questionPt: `Use a estratégia do "Dobro do Dobro" da Apostila de Multiplicação: quanto é ${base} × ${mult}?`,
        luzGuiaPt: `Em vez de armar a conta por ${mult}, dobre o ${base} (${d1}) e continue dobrando!`,
        stepByStepPt:
          mult === 4
            ? `1º Dobro: ${base} × 2 = ${d1}.\n2º Dobro: ${d1} × 2 = ?`
            : `1º Dobro: ${base} × 2 = ${d1}.\n2º Dobro: ${d1} × 2 = ${d2}.\n3º Dobro: ${d2} × 2 = ?`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `${mult} amigos comprando ingressos de R$ ${base},00 cada.`,
        correctValue: ans,
        choices: buildFourChoices(
          ans,
          `${ans}`,
          `Exato! Dobrando passo a passo chegamos a ${ans} em 2 segundos!`,
          [
            {
              value: d1,
              diagnosticPt: `${d1} é apenas o primeiro dobro (×2). Dobre mais uma vez!`,
            },
            {
              value: ans - base,
              diagnosticPt: `${ans - base} seria ×${mult - 1}. Para ×${mult}, feche o dobro completo!`,
            },
            {
              value: ans + 20,
              diagnosticPt: `Quase! Confira o dobro de ${mult === 4 ? d1 : d2} = ${ans}.`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g1_relogio_x5_corta_meio',
    tier: 1,
    conceptId: 'divisao_euclidiana_resto',
    codexSlug: 'magia-calculo-mental-multiplicacao',
    lensTitlePt: '🖐️ O Relógio do 5 (Vezes 10 e Corta ao Meio)',
    synthesize: (rng) => {
      const half = randInt(rng, 12, 48)
      const evenN = half * 2
      const tenN = evenN * 10
      const ans = evenN * 5
      const methods: MentalSolutionMethod[] = [
        {
          badge: '⚡ Jeito 1 — Corta na Metade e Põe o Zero',
          summary: `A metade de ${evenN} é ${half}. Colocando o zero no final (×10): ${ans}!`,
        },
        {
          badge: '🔟 Jeito 2 — Vezes 10 e Metade',
          summary: `${evenN} × 10 = ${tenN}; a metade de ${tenN} é ${ans}!`,
        },
        {
          badge: '🧱 Jeito 3 — Dezenas + Unidades',
          summary: `(${Math.floor(evenN / 10) * 10} × 5) + (${evenN % 10} × 5) = ${ans}!`,
        },
      ]
      return {
        expressionBadge: `${evenN} × 5 = ?`,
        questionPt: `Como 5 é a metade de 10, resolva rápido de cabeça: ${evenN} × 5 = ?`,
        luzGuiaPt: `Qual é a metade de ${evenN}? Depois de achar a metade, basta multiplicar por 10!`,
        stepByStepPt: `Passo 1: Metade de ${evenN} = ${half}.\nPasso 2: Multiplique ${half} por 10 (acrescente um zero).`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Em 5 horas de marcha a ${evenN} km/h, você percorre ${ans} km!`,
        correctValue: ans,
        choices: buildFourChoices(
          ans,
          `${ans}`,
          `Brilhante! Metade de ${evenN} é ${half}, vezes 10 dá ${ans}!`,
          [
            {
              value: half,
              diagnosticPt: `${half} é a metade de ${evenN}; falta multiplicar por 10 (colocar o zero)!`,
            },
            {
              value: ans + 50,
              diagnosticPt: `Confira a metade de ${evenN}: ${evenN} ÷ 2 = ${half} → ${ans}.`,
            },
            {
              value: ans - 10,
              diagnosticPt: `Como ${evenN} é par, ${evenN} × 5 termina em zero: ${ans}!`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g1_equacao_balanca_1passo',
    tier: 1,
    conceptId: 'ponto_de_virada',
    codexSlug: 'equacao-balanca',
    lensTitlePt: '⚖️ O Segredo da Balança (Sinal de Igual)',
    synthesize: (rng) => {
      const mode = randInt(rng, 0, 2)
      if (mode === 0) {
        const x = randInt(rng, 14, 65)
        const a = randInt(rng, 8, 35)
        const b = x + a
        const methods: MentalSolutionMethod[] = [
          {
            badge: '⚖️ Jeito 1 — Equilíbrio da Balança',
            summary: `Tire ${a} dos dois lados da balança: x = ${b} − ${a} = ${x}!`,
          },
          {
            badge: '🌉 Jeito 2 — Quanto Falta?',
            summary: `Quanto falta de ${a} para chegar em ${b}? Faltam exatamente ${x}!`,
          },
          {
            badge: '🔍 Jeito 3 — Prova Real',
            summary: `Substituindo x por ${x}: ${x} + ${a} = ${b} (balança reta!).`,
          },
        ]
        return {
          expressionBadge: `x + ${a} = ${b}`,
          questionPt: `Na Balança Perfeita, uma caixa tem x munições. Colocamos mais ${a} munições e a balança marcou ${b} (x + ${a} = ${b}). Quanto vale x?`,
          luzGuiaPt: `O que você faz de um lado da balança, precisa fazer do outro! Tire ${a} dos dois lados.`,
          stepByStepPt: `x + ${a} − ${a} = ${b} − ${a}. Calcule ${b} − ${a}!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Descobrir quanto havia no estoque antes da entrega de ${a} unidades.`,
          correctValue: x,
          choices: buildFourChoices(
            x,
            `${x}`,
            `Balança em equilíbrio perfeito! ${b} − ${a} = ${x}.`,
            [
              {
                value: b + a,
                diagnosticPt: `Você somou ${b} + ${a} em vez de tirar os ${a} que foram adicionados!`,
              },
              {
                value: x + 10,
                diagnosticPt: `Quase! Confira a dezena em ${b} − ${a} = ${x}.`,
              },
              {
                value: Math.max(1, x - 5),
                diagnosticPt: `Testando na balança: ${Math.max(1, x - 5)} + ${a} não fecha ${b}.`,
              },
            ],
            rng,
          ),
        }
      } else if (mode === 1) {
        const div = randPick(rng, [3, 4, 5, 6])
        const each = randInt(rng, 12, 35)
        const total = div * each
        const methods: MentalSolutionMethod[] = [
          {
            badge: '⚖️ Jeito 1 — Operação Inversa na Balança',
            summary: `Se x dividido por ${div} dá ${each}, multiplique os dois lados por ${div}: x = ${each} × ${div} = ${total}!`,
          },
          {
            badge: '🧱 Jeito 2 — Juntar os Grupos',
            summary: `${div} pelotões receberam ${each} moedas cada: ${div} × ${each} = ${total}!`,
          },
          {
            badge: '🔍 Jeito 3 — Conferência',
            summary: `${total} ÷ ${div} = ${each} exato!`,
          },
        ]
        return {
          expressionBadge: `x ÷ ${div} = ${each}`,
          questionPt: `Um baú com x moedas foi dividido igualmente entre ${div} capitães, e cada um levou ${each} moedas (x / ${div} = ${each}). Quantas moedas havia no baú?`,
          luzGuiaPt: `Se dividir o baú em ${div} partes iguais deu ${each} para cada parte, como reconstruímos o baú inteiro?`,
          stepByStepPt: `Multiplique os dois lados da balança por ${div}: x = ${each} × ${div}.`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Reconstruir o valor total de uma compra parcelada em ${div} vezes de R$ ${each}.`,
          correctValue: total,
          choices: buildFourChoices(
            total,
            `${total}`,
            `Exato! ${div} partes de ${each} formam ${total} moedas no baú!`,
            [
              {
                value: each + div,
                diagnosticPt: `Você somou ${each} + ${div} em vez de multiplicar ${each} × ${div}!`,
              },
              {
                value: Math.max(1, Math.round(each / div)),
                diagnosticPt: `x é o total do baú antes de dividir por ${div}, logo x é maior que ${each}!`,
              },
              {
                value: total - each,
                diagnosticPt: `${total - each} seriam apenas ${div - 1} capitães. Para ${div} capitães: ${total}!`,
              },
            ],
            rng,
          ),
        }
      } else {
        const c = randInt(rng, 25, 85)
        const gasto = randInt(rng, 12, 38)
        const x = c + gasto
        const methods: MentalSolutionMethod[] = [
          {
            badge: '⚖️ Jeito 1 — Devolver à Balança',
            summary: `Some +${gasto} nos dois lados para desfazer o gasto: x = ${c} + ${gasto} = ${x}!`,
          },
          {
            badge: '🧱 Jeito 2 — Sobrou + Gastou',
            summary: `O total inicial é sempre o que sobrou (${c}) mais o que saiu (${gasto}) = ${x}!`,
          },
          {
            badge: '🔍 Jeito 3 — Prova Real',
            summary: `${x} − ${gasto} = ${c} cravado!`,
          },
        ]
        return {
          expressionBadge: `x − ${gasto} = ${c}`,
          questionPt: `O forte tinha x soldados, enviou ${gasto} em patrulha e ficaram ${c} na muralha (x − ${gasto} = ${c}). Quantos soldados havia antes?`,
          luzGuiaPt: `Se tiraram ${gasto} soldados e ainda restaram ${c}, devolva os ${gasto} para descobrir o total original!`,
          stepByStepPt: `Some ${gasto} aos dois lados da balança: x = ${c} + ${gasto}.`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Descobrir o saldo inicial somando o que restou no caixa com o que foi gasto.`,
          correctValue: x,
          choices: buildFourChoices(
            x,
            `${x}`,
            `Perfeito! Devolvendo ${gasto} aos ${c} restantes, tínhamos ${x} soldados!`,
            [
              {
                value: Math.abs(c - gasto),
                diagnosticPt: `Você subtraiu ${gasto} de ${c}! Para desfazer uma retirada (−${gasto}), devemos SOMAR +${gasto}.`,
              },
              {
                value: x + 10,
                diagnosticPt: `Confira a soma das dezenas: ${c} + ${gasto} = ${x}.`,
              },
              {
                value: x - 10,
                diagnosticPt: `Quase! ${c} + ${gasto} fecha ${x}.`,
              },
            ],
            rng,
          ),
        }
      }
    },
  },

  // ===========================================================================
  // 🔵 GRAU II — CONTAS MÉDIAS (Aritmética Elegante, Porcentagem, Sinais, PEMDAS)
  // ===========================================================================
  {
    archetypeId: 'g2_dobra_e_meia',
    tier: 2,
    conceptId: 'multiplicacao_decimal',
    codexSlug: 'aritmetica-elegante-01',
    lensTitlePt: '🔄 Dobrar e Meiar (Conservação da Área)',
    synthesize: (rng) => {
      const bOptions = [15, 25, 35, 45, 50]
      const B = randPick(rng, bOptions)
      const halfA = randInt(rng, 3, B >= 35 ? 9 : 14)
      const A = halfA * 2
      const doubleB = B * 2
      const ans = A * B
      const methods: MentalSolutionMethod[] = [
        {
          badge: '⚡ Jeito 1 — Meia um Lado, Dobra o Outro',
          summary: `Metade de ${A} é ${halfA}; o dobro de ${B} é ${doubleB}. Agora ${halfA} × ${doubleB} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Distributiva',
          summary: `${A} × ${Math.floor(B / 10) * 10} + ${A} × ${B % 10} = ${ans}!`,
        },
        {
          badge: '📐 Jeito 3 — Geometria do Retângulo',
          summary: `Um retângulo ${A}×${B} tem exatamente a mesma área que um retângulo ${halfA}×${doubleB} = ${ans}!`,
        },
      ]
      return {
        expressionBadge: `${A} × ${B} = ?`,
        questionPt: `Use a técnica "Dobrar e Meiar" da Super Lista 1: quanto vale ${A} × ${B}?`,
        luzGuiaPt: `Se você cortar o ${A} pela metade (${halfA}) e dobrar o ${B} (${doubleB}), a multiplicação fica redonda!`,
        stepByStepPt: `Passo 1: ${A} ÷ 2 = ${halfA}.\nPasso 2: ${B} × 2 = ${doubleB}.\nPasso 3: Multiplique ${halfA} × ${doubleB}!`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `${A} caixas de ${B} kg pesam o mesmo que ${halfA} caixas duplas de ${doubleB} kg!`,
        correctValue: ans,
        choices: buildFourChoices(
          ans,
          `${ans}`,
          `Elegância pura! ${A} × ${B} = ${halfA} × ${doubleB} = ${ans}!`,
          [
            {
              value: halfA * B,
              diagnosticPt: `Você cortou o ${A} pela metade (${halfA}), mas esqueceu de dobrar o ${B} para ${doubleB}!`,
            },
            {
              value: ans - B,
              diagnosticPt: `Quase! ${halfA} × ${doubleB} fecha exatamente ${ans}.`,
            },
            {
              value: ans + doubleB,
              diagnosticPt: `Você somou um grupo duplo a mais: ${halfA} × ${doubleB} = ${ans}.`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g2_segredo_do_11_e_99',
    tier: 2,
    conceptId: 'notacao_milhar',
    codexSlug: 'aritmetica-elegante-01',
    lensTitlePt: '🪄 O Segredo do 11 & O Truque do 99',
    synthesize: (rng) => {
      if (rng() < 0.55) {
        const d1 = randInt(rng, 2, 7)
        const d2 = randInt(rng, 1, 9 - d1)
        const N = d1 * 10 + d2
        const midSum = d1 + d2
        const ans = 11 * N
        const methods: MentalSolutionMethod[] = [
          {
            badge: '🪄 Jeito 1 — Abre os Dígitos e Soma no Meio',
            summary: `Abra o ${d1} e o ${d2}, e coloque a soma (${d1}+${d2}=${midSum}) no meio: ${d1}${midSum}${d2} = ${ans}!`,
          },
          {
            badge: '🔟 Jeito 2 — Distributiva (10 + 1)',
            summary: `10 × ${N} = ${N * 10}, mais 1 × ${N} = ${N * 10} + ${N} = ${ans}!`,
          },
          {
            badge: '🧱 Jeito 3 — Dezenas + Unidades',
            summary: `11 × ${d1 * 10} (${d1 * 110}) + 11 × ${d2} (${d2 * 11}) = ${ans}!`,
          },
        ]
        return {
          expressionBadge: `11 × ${N} = ?`,
          questionPt: `Use a Regra da Soma dos Dígitos no Meio: quanto é 11 × ${N}?`,
          luzGuiaPt: `Separe os algarismos ${d1} e ${d2} de ${N} e coloque a soma deles (${d1} + ${d2}) bem no meio!`,
          stepByStepPt: `Início: ${d1} | Meio: ${d1} + ${d2} = ${midSum} | Fim: ${d2}. Ou faça ${N * 10} + ${N}.`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Multiplicar por 11 em 1 segundo sem precisar armar conta.`,
          correctValue: ans,
          choices: buildFourChoices(
            ans,
            `${ans}`,
            `Mágica pura! Abrindo ${d1} e ${d2} com ${midSum} no meio: ${ans}!`,
            [
              {
                value: N * 10 + 1,
                diagnosticPt: `11 × ${N} é 10×${N} + ${N} (e não + 1)!`,
              },
              {
                value: d1 * 100 + Math.abs(d1 - d2) * 10 + d2,
                diagnosticPt: `No meio colocamos a SOMA (${d1} + ${d2} = ${midSum}), e não a diferença!`,
              },
              {
                value: ans + 10,
                diagnosticPt: `Confira o dígito central: ${d1} + ${d2} = ${midSum} → ${ans}.`,
              },
            ],
            rng,
          ),
        }
      } else {
        const nineBase = randPick(rng, [19, 29, 49, 99])
        const roundBase = nineBase + 1
        const B = nineBase === 99 ? randInt(rng, 4, 18) : randInt(rng, 5, 14)
        const roundProd = roundBase * B
        const ans = nineBase * B
        const methods: MentalSolutionMethod[] = [
          {
            badge: `⚡ Jeito 1 — Arredonda para ${roundBase} e Tira 1 Grupo`,
            summary: `${roundBase} × ${B} = ${roundProd}. Agora tire 1 vez o ${B}: ${roundProd} − ${B} = ${ans}!`,
          },
          {
            badge: '🧱 Jeito 2 — Hack Japonês na Subtração Final',
            summary: `De ${roundProd} tirando ${B} sobra ${ans}!`,
          },
          {
            badge: '🔍 Jeito 3 — Decomposição Direta',
            summary: `(${nineBase - 9} × ${B}) + (9 × ${B}) = ${ans}!`,
          },
        ]
        return {
          expressionBadge: `${nineBase} × ${B} = ?`,
          questionPt: `Use a estratégia "Aproximar e Tirar o Excesso": quanto é ${nineBase} × ${B}?`,
          luzGuiaPt: `O número ${nineBase} é (${roundBase} − 1). Multiplique ${B} por ${roundBase} e depois retire 1 grupo de ${B}!`,
          stepByStepPt: `Passo 1: ${roundBase} × ${B} = ${roundProd}.\nPasso 2: Subtraia ${B} de ${roundProd}.`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Comprar ${B} itens de R$ ${nineBase},00: pague R$ ${roundProd} e receba R$ ${B} de troco!`,
          correctValue: ans,
          choices: buildFourChoices(
            ans,
            `${ans}`,
            `Exato! ${roundBase} × ${B} (${roundProd}) menos ${B} fecha ${ans}!`,
            [
              {
                value: roundProd - 1,
                diagnosticPt: `Você tirou apenas 1 unidade de ${roundProd} em vez de tirar 1 grupo inteiro de ${B}!`,
              },
              {
                value: roundProd + B,
                diagnosticPt: `Como ${nineBase} é ${roundBase} − 1, devemos SUBTRAIR ${B} de ${roundProd}.`,
              },
              {
                value: ans - 10,
                diagnosticPt: `Quase! ${roundProd} − ${B} = ${ans}.`,
              },
            ],
            rng,
          ),
        }
      }
    },
  },
  {
    archetypeId: 'g2_porcentagem_universo_100',
    tier: 2,
    conceptId: 'assimetria_porcentagem',
    codexSlug: 'magica-porcentagem',
    lensTitlePt: '🔢 O Universo em 100 Partes (Os 3 Caminhos da Porcentagem)',
    synthesize: (rng) => {
      const sub = randInt(rng, 0, 2)
      if (sub === 0) {
        // Porcentagem Reversa (ex: 120% de 50 = 50% de 120, ou 28% de 50 = 50% de 28)
        const base = randPick(rng, [20, 25, 50, 200])
        const pct =
          base === 50
            ? randPick(rng, [18, 24, 36, 44, 64, 120, 140, 160])
            : base === 25
              ? randPick(rng, [16, 24, 32, 44, 60, 80, 120])
              : randPick(rng, [15, 25, 35, 45, 75, 150])
        const ans = Math.round((pct * base) / 100)
        const methods: MentalSolutionMethod[] = [
          {
            badge: '🪞 Jeito 1 — Espelho da Porcentagem (A% de B = B% de A)',
            summary: `${pct}% de ${base} é exatamente o mesmo que ${base}% de ${pct} = ${ans}!`,
          },
          {
            badge: '✂️ Jeito 2 — Multiplica e Corta Dois Zeros',
            summary: `${pct} × ${base} = ${pct * base}. Dividindo por 100 = ${ans}!`,
          },
          {
            badge: '🍕 Jeito 3 — Fração Equivalente',
            summary: `${base} é ${base}/100 do cem; aplicando sobre ${pct} obtemos ${ans}!`,
          },
        ]
        return {
          expressionBadge: `${pct}% de ${base} = ?`,
          questionPt: `Use a Inversão Inteligente da Porcentagem (A% de B = B% de A): quanto é ${pct}% de ${base}?`,
          luzGuiaPt: `Calcular ${pct}% de ${base} dá o mesmo resultado que calcular ${base}% de ${pct}!`,
          stepByStepPt:
            base === 50
              ? `50% é a metade! Qual é a metade de ${pct}?`
              : base === 25
                ? `25% é a quarta parte (÷4)! Quanto é ${pct} ÷ 4?`
                : `Multiplique ${pct} × ${base} = ${pct * base} e corte dois zeros (÷100).`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Sempre que a porcentagem parecer difícil, inverta os dois números!`,
          correctValue: ans,
          choices: buildFourChoices(
            ans,
            `${ans}`,
            `Genial! Invertendo para ${base}% de ${pct}, a resposta ${ans} sai na hora!`,
            [
              {
                value: ans * 2,
                diagnosticPt: `Confira a fração: ${base}% de ${pct} resulta em ${ans}.`,
              },
              {
                value: Math.max(1, ans - 5),
                diagnosticPt: `${pct} × ${base} ÷ 100 = ${ans}.`,
              },
              {
                value: pct + base,
                diagnosticPt: `Porcentagem é multiplicação proporcional (${pct} × ${base} ÷ 100), e não soma!`,
              },
            ],
            rng,
          ),
        }
      } else {
        // O Detetive do Universo: "A é quantos % de B?"
        const pctPool = [10, 20, 25, 30, 40, 50, 75]
        const ansPct = randPick(rng, pctPool)
        const mult = randPick(rng, [2, 3, 4, 5, 6, 8])
        const B =
          ansPct === 25 || ansPct === 75
            ? 4 * mult * 5
            : 10 * mult * 2
        const A = (B * ansPct) / 100
        const methods: MentalSolutionMethod[] = [
          {
            badge: '🕵️ Jeito 1 — Fração Simplificada',
            summary: `${A} sobre ${B} simplificado equivale a ${ansPct}/100 = ${ansPct}%!`,
          },
          {
            badge: '🔟 Jeito 2 — Pela Base 10%',
            summary: `10% de ${B} vale ${B / 10}. Como ${A} contém ${ansPct / 10} vezes esse valor, são ${ansPct}%!`,
          },
          {
            badge: '⚖️ Jeito 3 — Escala até 100',
            summary: `Transformando o total ${B} em 100 partes iguais, a parte ${A} vira ${ansPct}%!`,
          },
        ]
        return {
          expressionBadge: `${A} de ${B} = ?%`,
          questionPt: `Missão "O Detetive do Universo": ${A} soldados representam quantos porcento (%) de um batalhão de ${B} soldados?`,
          luzGuiaPt: `Monte a fração ${A}/${B} ou pense: quanto vale 10% (ou 25%) de ${B}?`,
          stepByStepPt: `10% de ${B} é ${B / 10}, e a metade (50%) de ${B} é ${B / 2}. Compare com ${A}!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Descobrir a taxa de acerto ou de desconto comparando a parte (${A}) com o todo (${B}).`,
          correctValue: ansPct,
          choices: buildFourChoices(
            ansPct,
            `${ansPct}%`,
            `Elementar! ${A} em ${B} corresponde exatamente a ${ansPct}%!`,
            [
              {
                value: A,
                label: `${A}%`,
                diagnosticPt: `${A} é a quantidade absoluta, mas o total é ${B} (e não 100)!`,
              },
              {
                value: Math.min(95, ansPct + 15),
                label: `${Math.min(95, ansPct + 15)}%`,
                diagnosticPt: `Dividindo ${A} por ${B} e multiplicando por 100 obtemos ${ansPct}%.`,
              },
              {
                value: Math.max(5, ansPct - 10),
                label: `${Math.max(5, ansPct - 10)}%`,
                diagnosticPt: `Confira: ${ansPct}% de ${B} fecha exatamente ${A}!`,
              },
            ],
            rng,
          ),
        }
      }
    },
  },
  {
    archetypeId: 'g2_sinais_peso_alivio',
    tier: 2,
    conceptId: 'subtracao_negativo',
    codexSlug: 'matematica-sinais-peso-alivio',
    lensTitlePt: '🛗 O Peso e o Alívio (Elevador & Perdão de Dívida)',
    synthesize: (rng) => {
      if (rng() < 0.5) {
        // Elevador / Submarino: Final - Inicial
        const subsolo = randInt(rng, 15, 65)
        const altura = randInt(rng, 12, 48)
        const ans = altura + subsolo
        const methods: MentalSolutionMethod[] = [
          {
            badge: '🛗 Jeito 1 — Final menos Inicial',
            summary: `Deslocamento = ${altura} − (−${subsolo}) = ${altura} + ${subsolo} = ${ans} metros!`,
          },
          {
            badge: '🌊 Jeito 2 — Até o Nível Zero + Subida',
            summary: `De −${subsolo} até o nível 0 são +${subsolo} m; do 0 até +${altura} são mais +${altura} m → ${subsolo} + ${altura} = ${ans} m!`,
          },
          {
            badge: '📏 Jeito 3 — Distância Total na Reta',
            summary: `Somando o trecho abaixo de zero (${subsolo}) com o trecho acima (${altura}) = ${ans}!`,
          },
        ]
        return {
          expressionBadge: `${altura} − (−${subsolo}) = ?`,
          questionPt: `Um mergulhador está a −${subsolo} metros e sobe até um helicóptero a +${altura} metros. Qual foi o deslocamento total (${altura} − (−${subsolo}))?`,
          luzGuiaPt: `Para subir de −${subsolo} até o nível do mar (0) ele já percorre ${subsolo} metros, e depois sobe mais ${altura} metros!`,
          stepByStepPt: `Choque de sinais: −(−${subsolo}) vira +${subsolo}. Calcule ${altura} + ${subsolo}!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Medir variações térmicas ou de altitude que cruzam o marco zero.`,
          correctValue: ans,
          choices: buildFourChoices(
            ans,
            `${ans}`,
            `Perfeito! Subir de −${subsolo} até +${altura} percorre ${altura} − (−${subsolo}) = ${ans} metros!`,
            [
              {
                value: Math.abs(altura - subsolo),
                diagnosticPt: `Você subtraiu os módulos, mas eles estão em lados OPOSTOS do nível zero!`,
              },
              {
                value: -ans,
                diagnosticPt: `Como ele subiu de −${subsolo} para +${altura}, o deslocamento é positivo (+${ans})!`,
              },
              {
                value: ans + 10,
                diagnosticPt: `Somando ${subsolo} + ${altura} fechamos exatamente ${ans}.`,
              },
            ],
            rng,
          ),
        }
      } else {
        // Perdão de dívida: -Saldo - (-Multa) + Bonus
        const dividaInicial = randInt(rng, 120, 450)
        const multaPerdoada = randInt(rng, 80, dividaInicial - 20)
        const bonus = randInt(rng, 150, 400)
        const ans = -dividaInicial + multaPerdoada + bonus
        const methods: MentalSolutionMethod[] = [
          {
            badge: '💳 Jeito 1 — Cancelar Dívida é Ganhar Crédito',
            summary: `−(−${multaPerdoada}) vira +${multaPerdoada}! Então −${dividaInicial} + ${multaPerdoada} + ${bonus} = ${ans}!`,
          },
          {
            badge: '🧱 Jeito 2 — Soma os Alívios Primeiro',
            summary: `Alívios totais: ${multaPerdoada} + ${bonus} = +${multaPerdoada + bonus}. Descontando a dívida de ${dividaInicial} = ${ans}!`,
          },
          {
            badge: '⚖️ Jeito 3 — Abater a Dívida Primeiro',
            summary: `−${dividaInicial} + ${multaPerdoada} reduz a dívida para −${dividaInicial - multaPerdoada}; somando +${bonus} sobram ${ans}!`,
          },
        ]
        return {
          expressionBadge: `−${dividaInicial} − (−${multaPerdoada}) + ${bonus}`,
          questionPt: `Seu tesouro estava em −${dividaInicial} moedas, mas o Reino cancelou (subtraiu) uma multa de −${multaPerdoada} e pagou um bônus de +${bonus}: quanto dá −${dividaInicial} − (−${multaPerdoada}) + ${bonus}?`,
          luzGuiaPt: `Subtrair uma dívida (−(−${multaPerdoada})) tira um peso das costas e vira um ganho positivo (+${multaPerdoada})!`,
          stepByStepPt: `Passo 1: −(−${multaPerdoada}) = +${multaPerdoada}.\nPasso 2: Some os positivos (${multaPerdoada} + ${bonus} = ${multaPerdoada + bonus}) e desconte ${dividaInicial}.`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Estorno bancário: retirar uma cobrança negativa aumenta o seu saldo disponível.`,
          correctValue: ans,
          choices: buildFourChoices(
            ans,
            `${ans}`,
            `Lógica de Brahmagupta impecável! −${dividaInicial} + ${multaPerdoada} + ${bonus} = ${ans}!`,
            [
              {
                value: -dividaInicial - multaPerdoada + bonus,
                diagnosticPt: `Cuidado: a multa de −${multaPerdoada} foi CANCELADA (−(−${multaPerdoada}) = +${multaPerdoada}), e não cobrada de novo!`,
              },
              {
                value: ans + 20,
                diagnosticPt: `Quase! (${multaPerdoada} + ${bonus}) − ${dividaInicial} = ${ans}.`,
              },
              {
                value: -ans,
                diagnosticPt: `Como os ganhos (${multaPerdoada + bonus}) superam ou abatem −${dividaInicial}, confira o sinal final: ${ans}.`,
              },
            ],
            rng,
          ),
        }
      }
    },
  },
  {
    archetypeId: 'g2_pemdas_trincheira',
    tier: 2,
    conceptId: 'precedencia_operacoes',
    codexSlug: 'expressoes-numericas-trincheira',
    lensTitlePt: '🛡️ A Sintaxe da Comunicação (Ordem das Operações)',
    synthesize: (rng) => {
      const B = randInt(rng, 4, 11)
      const C = randPick(rng, [4, 5, 6, 7, 8, 9])
      const prod = B * C
      const isSub = rng() < 0.45
      const A = isSub ? prod + randInt(rng, 12, 48) : randInt(rng, 14, 52)
      const ans = isSub ? A - prod : A + prod
      const trap = isSub ? (A - B) * C : (A + B) * C
      const opSymbol = isSub ? '−' : '+'
      const methods: MentalSolutionMethod[] = [
        {
          badge: '⚡ Jeito 1 — Pacotes Primeiro (Multiplicação)',
          summary: `Resolva o pacote ${B} × ${C} = ${prod} primeiro. Depois: ${A} ${opSymbol} ${prod} = ${ans}!`,
        },
        {
          badge: '📦 Jeito 2 — Visão Física de Caixas',
          summary: `${A} unidades soltas ${opSymbol} ${B} caixas de ${C} (${prod}) resultam em ${ans}!`,
        },
        {
          badge: '🧱 Jeito 3 — Decomposição Final',
          summary: `Operando ${A} ${opSymbol} ${prod} pelas dezenas e unidades chegamos a ${ans}!`,
        },
      ]
      return {
        expressionBadge: `${A} ${opSymbol} ${B} × ${C} = ?`,
        questionPt: `Respeitando a hierarquia das operações (Trincheira do Cérebro), qual é o resultado de ${A} ${opSymbol} ${B} × ${C}?`,
        luzGuiaPt: `A multiplicação (${B} × ${C}) é uma soma repetida de pacotes e deve ser resolvida ANTES de ${isSub ? 'subtrair de' : 'somar com'} ${A}!`,
        stepByStepPt: `Passo 1: ${B} × ${C} = ${prod}.\nPasso 2: Calcule ${A} ${opSymbol} ${prod}.`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Em qualquer nota fiscal, multiplicamos a quantidade pelo preço unitário antes de somar o total.`,
        correctValue: ans,
        choices: buildFourChoices(
          ans,
          `${ans}`,
          `Ordem perfeita! ${B} × ${C} = ${prod}, e ${A} ${opSymbol} ${prod} = ${ans}!`,
          [
            {
              value: trap,
              diagnosticPt: `Armadilha clássica! Você fez (${A} ${opSymbol} ${B}) × ${C} = ${trap}, mas a multiplicação vem antes!`,
            },
            {
              value: isSub ? A - B - C : A + B + C,
              diagnosticPt: `O sinal entre ${B} e ${C} é de multiplicação (×), não de soma/subtração!`,
            },
            {
              value: ans + 10,
              diagnosticPt: `O produto é ${prod}; confira ${A} ${opSymbol} ${prod} = ${ans}.`,
            },
          ],
          rng,
        ),
      }
    },
  },

  // ===========================================================================
  // 🟣 GRAU III — CONTAS DIFÍCEIS (Fatoração, Quadrados, Frações, Dízimas, Equações)
  // ===========================================================================
  {
    archetypeId: 'g3_fator_comum_evidencia',
    tier: 3,
    conceptId: 'precedencia_operacoes',
    codexSlug: 'diferenca-quadrados-fator-comum',
    lensTitlePt: '🧲 O Poder do Fator Comum (Colocar em Evidência)',
    synthesize: (rng) => {
      const isSub = rng() < 0.4
      const roundTarget = randPick(rng, [10, 20, 100])
      const C = randInt(rng, 14, 68)
      const A = isSub
        ? roundTarget + randInt(rng, 3, 18)
        : randInt(rng, 2, roundTarget - 2)
      const B = isSub ? A - roundTarget : roundTarget - A
      const ans = C * roundTarget
      const op = isSub ? '−' : '+'
      const methods: MentalSolutionMethod[] = [
        {
          badge: '⚡ Jeito 1 — Fator Comum em Evidência',
          summary: `Coloque o ${C} em evidência: ${C} × (${A} ${op} ${B}) = ${C} × ${roundTarget} = ${ans}!`,
        },
        {
          badge: '📦 Jeito 2 — Contagem de Pacotes Iguais',
          summary: `${A} pacotes de ${C} ${op} ${B} pacotes de ${C} formam exatos ${roundTarget} pacotes de ${C} = ${ans}!`,
        },
        {
          badge: '🔍 Jeito 3 — Ordem de Grandeza',
          summary: `Multiplicar ${C} por ${roundTarget} é imediato: ${ans}!`,
        },
      ]
      return {
        expressionBadge: `${C} × ${A} ${op} ${C} × ${B} = ?`,
        questionPt: `Não multiplique separado! Use o Fator Comum em Evidência para resolver de cabeça: ${C} × ${A} ${op} ${C} × ${B} = ?`,
        luzGuiaPt: `O número ${C} aparece nos dois blocos! Coloque o ${C} em evidência e calcule (${A} ${op} ${B}) primeiro.`,
        stepByStepPt: `Passo 1: ${A} ${op} ${B} = ${roundTarget}.\nPasso 2: Multiplique ${C} × ${roundTarget}!`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Juntar lotes de mesmo preço unitário (R$ ${C}) antes de multiplicar economiza 90% do esforço mental.`,
        correctValue: ans,
        choices: buildFourChoices(
          ans,
          `${ans}`,
          `Maestria algébrica! ${C} × (${A} ${op} ${B}) = ${C} × ${roundTarget} = ${ans}!`,
          [
            {
              value: C * (isSub ? A + B : Math.abs(A - B)),
              diagnosticPt: `Confira o sinal entre os blocos: (${A} ${op} ${B}) fecha ${roundTarget}!`,
            },
            {
              value: C + roundTarget,
              diagnosticPt: `O fator comum ${C} MULTIPLICA o resultado de (${A} ${op} ${B}): ${C} × ${roundTarget} = ${ans}!`,
            },
            {
              value: ans - C,
              diagnosticPt: `Como ${A} ${op} ${B} = ${roundTarget} redondo, ${C} × ${roundTarget} = ${ans}!`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g3_diferenca_de_quadrados_e_final5',
    tier: 3,
    conceptId: 'crescimento_quadratico',
    codexSlug: 'diferenca-quadrados-fator-comum',
    lensTitlePt: '📐 Diferença de Quadrados & Quadrados Terminados em 5',
    synthesize: (rng) => {
      const mode = randInt(rng, 0, 2)
      if (mode === 0) {
        // A² - B² = (A+B)(A-B)
        const sumRound = randPick(rng, [20, 30, 40, 50, 60, 100])
        const half = sumRound / 2
        const delta = randPick(rng, [1, 2, 3, 4, 5])
        const A = half + delta
        const B = half - delta
        const diff = A - B
        const ans = sumRound * diff
        const methods: MentalSolutionMethod[] = [
          {
            badge: '⚡ Jeito 1 — Produto da Soma pela Diferença',
            summary: `${A}² − ${B}² = (${A} + ${B}) × (${A} − ${B}) = ${sumRound} × ${diff} = ${ans}!`,
          },
          {
            badge: '📐 Jeito 2 — Faixa Geométrica',
            summary: `A diferença entre os quadrados tem comprimento médio ${sumRound} e espessura ${diff}: ${sumRound} × ${diff} = ${ans}!`,
          },
          {
            badge: '🧱 Jeito 3 — Quadrados Diretos',
            summary: `${A}² (${A * A}) − ${B}² (${B * B}) = ${ans}!`,
          },
        ]
        return {
          expressionBadge: `${A}² − ${B}² = ?`,
          questionPt: `Use a identidade da Diferença de Quadrados a² − b² = (a + b)(a − b): quanto vale ${A}² − ${B}²?`,
          luzGuiaPt: `Jamais calcule ${A}×${A} no braço! Quanto dá a soma (${A} + ${B}) vezes a diferença (${A} − ${B})?`,
          stepByStepPt: `Passo 1: Soma = ${A} + ${B} = ${sumRound}.\nPasso 2: Diferença = ${A} − ${B} = ${diff}.\nPasso 3: Multiplique ${sumRound} × ${diff}!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Transformar potências pesadas em uma multiplicação redonda de 2 segundos.`,
          correctValue: ans,
          choices: buildFourChoices(
            ans,
            `${ans}`,
            `Genial! (${A} + ${B}) × (${A} − ${B}) = ${sumRound} × ${diff} = ${ans}!`,
            [
              {
                value: diff * diff,
                diagnosticPt: `${diff * diff} é (${A} − ${B})²! Lembre-se de multiplicar (${A} − ${B}) pela SOMA (${A} + ${B} = ${sumRound}).`,
              },
              {
                value: sumRound + diff,
                diagnosticPt: `Multiplique a soma (${sumRound}) pela diferença (${diff}): ${sumRound} × ${diff} = ${ans}!`,
              },
              {
                value: ans - sumRound,
                diagnosticPt: `A diferença (${A} − ${B}) vale ${diff}, então ${sumRound} × ${diff} = ${ans}.`,
              },
            ],
            rng,
          ),
        }
      } else if (mode === 1) {
        // (Base - d)(Base + d) = Base² - d² (ex: 39 x 41, 48 x 52)
        const base = randPick(rng, [20, 30, 40, 50, 60, 100])
        const d = randPick(rng, [1, 2, 3])
        const A = base - d
        const B = base + d
        const ans = base * base - d * d
        const methods: MentalSolutionMethod[] = [
          {
            badge: '⚡ Jeito 1 — Simetria (Base² − d²)',
            summary: `${A} × ${B} = (${base} − ${d})(${base} + ${d}) = ${base}² − ${d}² = ${base * base} − ${d * d} = ${ans}!`,
          },
          {
            badge: '🧱 Jeito 2 — Distributiva na Dezena',
            summary: `${A} × ${base} + ${A} × ${d} = ${ans}!`,
          },
          {
            badge: '🔍 Jeito 3 — Último Algarismo',
            summary: `${base * base} menos ${d * d} termina em ${ans % 10}: ${ans}!`,
          },
        ]
        return {
          expressionBadge: `${A} × ${B} = ?`,
          questionPt: `Os números ${A} e ${B} são simétricos ao redor de ${base}. Use (${base} − ${d})(${base} + ${d}) = ${base}² − ${d}² para calcular ${A} × ${B}:`,
          luzGuiaPt: `Quanto é ${base}² (${base * base}) menos ${d}² (${d * d})?`,
          stepByStepPt: `Passo 1: ${base}² = ${base * base}.\nPasso 2: ${d}² = ${d * d}.\nPasso 3: Subtraia ${base * base} − ${d * d}!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Qualquer produto simétrico ao redor de uma dezena redonda é sempre (Dezena² − Distância²).`,
          correctValue: ans,
          choices: buildFourChoices(
            ans,
            `${ans}`,
            `Simetria perfeita! ${base}² − ${d}² = ${base * base} − ${d * d} = ${ans}!`,
            [
              {
                value: base * base,
                diagnosticPt: `${base * base} é ${base} × ${base}; falta descontar ${d}² (${d * d})!`,
              },
              {
                value: base * base + d * d,
                diagnosticPt: `Na diferença de quadrados nós SUBTRAÍMOS ${d}² (${base * base} − ${d * d} = ${ans})!`,
              },
              {
                value: base * base - d,
                diagnosticPt: `Subtraímos ${d} ao QUADRADO (${d * d}), ficando ${base * base} − ${d * d} = ${ans}.`,
              },
            ],
            rng,
          ),
        }
      } else {
        // Quadrado de número terminado em 5: N5²
        const n = randPick(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10])
        const num = n * 10 + 5
        const prefix = n * (n + 1)
        const ans = prefix * 100 + 25
        const methods: MentalSolutionMethod[] = [
          {
            badge: '🪄 Jeito 1 — Sucessor na Dezena + 25 no Final',
            summary: `Multiplique ${n} pelo sucessor ${n + 1} (${n} × ${n + 1} = ${prefix}) e anexe 25 no final = ${ans}!`,
          },
          {
            badge: '📐 Jeito 2 — Diferença de Quadrados ((N5−5)(N5+5) + 25)',
            summary: `${n * 10} × ${(n + 1) * 10} + 25 = ${prefix * 100} + 25 = ${ans}!`,
          },
          {
            badge: '🧱 Jeito 3 — Quadrado da Soma',
            summary: `(${n * 10} + 5)² = ${n * n * 100} + ${n * 100} + 25 = ${ans}!`,
          },
        ]
        return {
          expressionBadge: `${num}² = ?`,
          questionPt: `Use o segredo dos Quadrados Terminados em 5 da Super Lista 2: quanto é ${num}² (${num} × ${num})?`,
          luzGuiaPt: `Todo quadrado terminado em 5 acaba em 25! E o começo é a dezena (${n}) multiplicada pelo seu sucessor (${n + 1}).`,
          stepByStepPt: `Passo 1: ${n} × ${n + 1} = ${prefix}.\nPasso 2: Coloque 25 à direita de ${prefix}!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Calcular áreas quadradas de ${num}m × ${num}m instantaneamente.`,
          correctValue: ans,
          choices: buildFourChoices(
            ans,
            `${ans}`,
            `Instantâneo! ${n} × ${n + 1} = ${prefix}, com 25 no final = ${ans}!`,
            [
              {
                value: n * n * 100 + 25,
                diagnosticPt: `Você fez ${n}×${n} no início, mas o truque multiplica ${n} pelo SUCESSOR (${n + 1}): ${n}×${n + 1} = ${prefix} → ${ans}!`,
              },
              {
                value: (n + 1) * (n + 1) * 100 + 25,
                diagnosticPt: `Multiplique ${n} por ${n + 1} (= ${prefix}) e coloque 25 no final: ${ans}.`,
              },
              {
                value: num * 2,
                diagnosticPt: `${num}² é ${num} × ${num} (= ${ans}), e não o dobro de ${num}!`,
              },
            ],
            rng,
          ),
        }
      }
    },
  },
  {
    archetypeId: 'g3_dizima_periodica_noves',
    tier: 3,
    conceptId: 'divisao_por_fracao',
    codexSlug: 'dizima',
    lensTitlePt: '♾️ O Infinito na Palma da Mão (Dízimas Periódicas & Os Noves)',
    synthesize: (rng) => {
      const pairs: Array<{ dec: string; num: number; den: number; simpNum: number; simpDen: number }> = [
        { dec: '0,222...', num: 2, den: 9, simpNum: 2, simpDen: 9 },
        { dec: '0,444...', num: 4, den: 9, simpNum: 4, simpDen: 9 },
        { dec: '0,777...', num: 7, den: 9, simpNum: 7, simpDen: 9 },
        { dec: '0,333...', num: 3, den: 9, simpNum: 1, simpDen: 3 },
        { dec: '0,666...', num: 6, den: 9, simpNum: 2, simpDen: 3 },
        { dec: '0,151515...', num: 15, den: 99, simpNum: 5, simpDen: 33 },
        { dec: '0,232323...', num: 23, den: 99, simpNum: 23, simpDen: 99 },
        { dec: '0,454545...', num: 45, den: 99, simpNum: 5, simpDen: 11 },
        { dec: '0,727272...', num: 72, den: 99, simpNum: 8, simpDen: 11 },
        { dec: '1,222...', num: 11, den: 9, simpNum: 11, simpDen: 9 },
      ]
      const chosen = randPick(rng, pairs)
      const multTarget = chosen.simpDen * randInt(rng, 2, 5)
      const ans = chosen.simpNum * (multTarget / chosen.simpDen)
      const methods: MentalSolutionMethod[] = [
        {
          badge: '♾️ Jeito 1 — Engarrafar o Infinito nos Noves',
          summary: `${chosen.dec} equivale à fração ${chosen.num}/${chosen.den}${chosen.simpDen !== chosen.den ? ` (ou ${chosen.simpNum}/${chosen.simpDen} simplificada)` : ''}. Multiplicando por ${multTarget} dá ${ans}!`,
        },
        {
          badge: '✂️ Jeito 2 — Divide pelo Denominador Primeiro',
          summary: `${multTarget} ÷ ${chosen.simpDen} = ${multTarget / chosen.simpDen}, e ${multTarget / chosen.simpDen} × ${chosen.simpNum} = ${ans}!`,
        },
        {
          badge: '⚖️ Jeito 3 — Prova Algébrica (10x − x = 9x)',
          summary: `Tirando a cauda infinita sobra a fração exata que sobre ${multTarget} resulta em ${ans}!`,
        },
      ]
      return {
        expressionBadge: `${chosen.dec} × ${multTarget} = ?`,
        questionPt: `Engarrafe a dízima periódica usando a regra dos Noves ("O Infinito na Palma da Mão"): quanto vale exatamente (${chosen.dec}) × ${multTarget}?`,
        luzGuiaPt: `Transforme ${chosen.dec} em fração colocando um 9 para cada algarismo do período (${chosen.num}/${chosen.den} = ${chosen.simpNum}/${chosen.simpDen}) e multiplique por ${multTarget}!`,
        stepByStepPt: `Passo 1: ${chosen.dec} = ${chosen.simpNum}/${chosen.simpDen}.\nPasso 2: Calcule (${chosen.simpNum}/${chosen.simpDen}) × ${multTarget} dividindo ${multTarget} por ${chosen.simpDen} primeiro!`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Toda dízima periódica é uma fração racional exata disfarçada de infinito!`,
        correctValue: ans,
        choices: buildFourChoices(
          ans,
          `${ans}`,
          `Infinito domado! ${chosen.dec} = ${chosen.simpNum}/${chosen.simpDen}, que vezes ${multTarget} dá exatamente ${ans}!`,
          [
            {
              value: Math.max(1, Math.round((chosen.num * multTarget) / (chosen.den === 9 ? 10 : 100))),
              diagnosticPt: `Cuidado: dízima periódica tem denominador ${chosen.den} (e não ${chosen.den + 1})!`,
            },
            {
              value: ans + chosen.simpNum,
              diagnosticPt: `${multTarget} ÷ ${chosen.simpDen} = ${multTarget / chosen.simpDen}, vezes ${chosen.simpNum} fecha ${ans}.`,
            },
            {
              value: Math.max(1, ans - chosen.simpNum),
              diagnosticPt: `Pela fração geratriz ${chosen.simpNum}/${chosen.simpDen} × ${multTarget}, o valor exato é ${ans}.`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g3_maquina_do_tempo_equacao',
    tier: 3,
    conceptId: 'precedencia_operacoes',
    codexSlug: 'equacoes-maquina-do-tempo',
    lensTitlePt: '⏳ A Máquina do Tempo das Equações (Rebobinar Ações)',
    synthesize: (rng) => {
      const k = randInt(rng, 3, 8)
      const x = randInt(rng, 6, 25)
      const b = randInt(rng, 8, 45)
      const isMinus = rng() < 0.5
      const c = isMinus ? k * x - b : k * x + b
      const mid = k * x
      const methods: MentalSolutionMethod[] = [
        {
          badge: '⏳ Jeito 1 — Rebobinar o Filme (Máquina do Tempo)',
          summary: isMinus
            ? `Passo 1: Devolva os ${b} (${c} + ${b} = ${mid}). Passo 2: Divida por ${k} (${mid} ÷ ${k} = ${x})!`
            : `Passo 1: Tire os ${b} (${c} − ${b} = ${mid}). Passo 2: Divida por ${k} (${mid} ÷ ${k} = ${x})!`,
        },
        {
          badge: '⚖️ Jeito 2 — Equilíbrio da Balança',
          summary: `Isolando ${k}x = ${mid} nos dois pratos da balança, cada x pesa ${x}!`,
        },
        {
          badge: '🔍 Jeito 3 — Prova Real',
          summary: `${k} × ${x} ${isMinus ? '−' : '+'} ${b} = ${mid} ${isMinus ? '−' : '+'} ${b} = ${c}!`,
        },
      ]
      return {
        expressionBadge: `${k}x ${isMinus ? '−' : '+'} ${b} = ${c}`,
        questionPt: `Use a Máquina do Tempo das Equações: se ${k}x ${isMinus ? '−' : '+'} ${b} = ${c}, qual é o valor de x?`,
        luzGuiaPt: `Rebobine a última ação primeiro: ${isMinus ? `devolva +${b} ao ${c}` : `retire ${b} do ${c}`} e depois divida o resultado por ${k}!`,
        stepByStepPt: `Passo 1: ${k}x = ${c} ${isMinus ? '+' : '−'} ${b} = ${mid}.\nPasso 2: x = ${mid} ÷ ${k}.`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Descobrir o preço de 1 item quando sabemos o total de ${k} itens com frete ou desconto de R$ ${b}.`,
        correctValue: x,
        choices: buildFourChoices(
          x,
          `${x}`,
          `Viagem no tempo perfeita! ${k}x = ${mid} → x = ${x}!`,
          [
            {
              value: mid,
              diagnosticPt: `${mid} é o valor de ${k}x juntos! Falta dividir por ${k} para achar 1 único x.`,
            },
            {
              value: Math.max(1, Math.round((isMinus ? c - b : c + b) / k)),
              diagnosticPt: `Ao voltar no tempo, fazemos a operação INVERSA de ${isMinus ? `−${b} (somamos +${b})` : `+${b} (subtraímos −${b})`}!`,
            },
            {
              value: x + 2,
              diagnosticPt: `Quase! ${mid} ÷ ${k} = ${x}.`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g3_corte_cruzado_trincheira',
    tier: 3,
    conceptId: 'divisao_por_fracao',
    codexSlug: 'aritmetica-elegante-02',
    lensTitlePt: '✂️ Divisão Simplificada (Corte Cruzado antes de Multiplicar)',
    synthesize: (rng) => {
      const d1 = randPick(rng, [6, 7, 8, 9, 11, 12])
      const d2 = randPick(rng, [5, 6, 7, 8, 9])
      const q1 = randInt(rng, 3, 9)
      const q2 = randInt(rng, 3, 8)
      const N1 = d1 * q1
      const N2 = d2 * q2
      const ans = q1 * q2
      const methods: MentalSolutionMethod[] = [
        {
          badge: '✂️ Jeito 1 — Simplificar os Parceiros antes de Multiplicar',
          summary: `Divida ${N1} ÷ ${d1} = ${q1} e ${N2} ÷ ${d2} = ${q2}. Agora multiplique pequenininho: ${q1} × ${q2} = ${ans}!`,
        },
        {
          badge: '🧱 Jeito 2 — Cancelamento de Fatores',
          summary: `(${d1}×${q1} × ${d2}×${q2}) ÷ (${d1}×${d2}) corta ${d1} e ${d2}, sobrando ${q1} × ${q2} = ${ans}!`,
        },
        {
          badge: '🔍 Jeito 3 — Proporção de Pacotes',
          summary: `O primeiro fator é ${q1}× maior e o segundo é ${q2}× maior → ${q1} × ${q2} = ${ans}!`,
        },
      ]
      return {
        expressionBadge: `(${N1} × ${N2}) ÷ (${d1} × ${d2}) = ?`,
        questionPt: `Não multiplique números grandes! Simplifique os fatores primeiro: quanto vale (${N1} × ${N2}) ÷ (${d1} × ${d2})?`,
        luzGuiaPt: `Note que ${N1} é múltiplo de ${d1} e ${N2} é múltiplo de ${d2}! Divida cada par antes de multiplicar.`,
        stepByStepPt: `Passo 1: ${N1} ÷ ${d1} = ${q1}.\nPasso 2: ${N2} ÷ ${d2} = ${q2}.\nPasso 3: Multiplique ${q1} × ${q2}!`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Simplificar frações antes de multiplicar evita contas gigantes e erros de cálculo.`,
        correctValue: ans,
        choices: buildFourChoices(
          ans,
          `${ans}`,
          `Cirúrgico! (${N1}÷${d1}) × (${N2}÷${d2}) = ${q1} × ${q2} = ${ans}!`,
          [
            {
              value: q1 + q2,
              diagnosticPt: `Você somou ${q1} + ${q2}, mas como os termos estão multiplicando, fazemos ${q1} × ${q2} = ${ans}!`,
            },
            {
              value: (q1 - 1) * q2,
              diagnosticPt: `${N1} ÷ ${d1} vale ${q1}, e ${q1} × ${q2} = ${ans}.`,
            },
            {
              value: q1 * (q2 + 1),
              diagnosticPt: `${N2} ÷ ${d2} vale ${q2}, então ${q1} × ${q2} = ${ans}.`,
            },
          ],
          rng,
        ),
      }
    },
  },

  // ===========================================================================
  // 👑 GRAU IV — PROBLEMAS MUITO DIFÍCEIS (Resolução de Problemas da Coletânea)
  // ===========================================================================
  {
    archetypeId: 'g4_problema_tanque_fracoes',
    tier: 4,
    conceptId: 'fracao_impropria',
    codexSlug: 'fracoes-operacoes',
    lensTitlePt: '⛽ Problema Contextualizado: O Tanque e a Construção da Balança',
    synthesize: (rng) => {
      const den = randPick(rng, [8, 10, 12])
      const num1 = randPick(rng, [1, 2, 3])
      const deltaNum = randPick(rng, [2, 3, 4])
      const num2 = num1 + deltaNum
      const unitSliceLiters = randInt(rng, 8, 25)
      const addedLiters = deltaNum * unitSliceLiters
      const totalCapacity = den * unitSliceLiters
      const methods: MentalSolutionMethod[] = [
        {
          badge: `🍕 Jeito 1 — Descobrir o Valor de 1 Fatia (1/${den})`,
          summary: `Subir de ${num1}/${den} para ${num2}/${den} aumentou ${deltaNum}/${den} do tanque = ${addedLiters} L. Logo, cada 1/${den} vale ${addedLiters} ÷ ${deltaNum} = ${unitSliceLiters} L. O tanque inteiro (${den}/${den}) tem ${den} × ${unitSliceLiters} = ${totalCapacity} litros!`,
        },
        {
          badge: '⚖️ Jeito 2 — Equação da Balança',
          summary: `(${deltaNum}/${den}) · x = ${addedLiters} → x = ${addedLiters} × ${den} ÷ ${deltaNum} = ${totalCapacity} L!`,
        },
        {
          badge: '📐 Jeito 3 — Proporção Direta',
          summary: `Se ${deltaNum} partes valem ${addedLiters} L, então ${den} partes valem (${den}/${deltaNum}) × ${addedLiters} = ${totalCapacity} L!`,
        },
      ]
      return {
        expressionBadge: `${num1}/${den} + ${addedLiters}L = ${num2}/${den}`,
        questionPt: `PROBLEMA (Apostila de Frações): O marcador de energia/combustível de um blindado indica ${num1}/${den} da capacidade. Após abastecer com ${addedLiters} litros, o marcador sobe para ${num2}/${den}. Qual é a capacidade TOTAL desse tanque?`,
        luzGuiaPt: `De ${num1}/${den} até ${num2}/${den}, quantas fatias de 1/${den} o tanque subiu com esses ${addedLiters} litros?`,
        stepByStepPt: `Passo 1: ${num2}/${den} − ${num1}/${den} = ${deltaNum}/${den} do tanque.\nPasso 2: Se ${deltaNum} partes valem ${addedLiters} L, 1 parte (1/${den}) vale ${addedLiters} ÷ ${deltaNum} = ${unitSliceLiters} L.\nPasso 3: Multiplique ${unitSliceLiters} L pelo total de ${den} partes!`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Quando você sabe quanto vale uma fração da mudança, descobre o tamanho do sistema inteiro!`,
        correctValue: totalCapacity,
        choices: buildFourChoices(
          totalCapacity,
          `${totalCapacity} L`,
          `Raciocínio Mestre! ${deltaNum}/${den} = ${addedLiters}L → 1/${den} = ${unitSliceLiters}L → Tanque total = ${totalCapacity} L!`,
          [
            {
              value: addedLiters * den,
              label: `${addedLiters * den} L`,
              diagnosticPt: `Você multiplicou ${addedLiters} por ${den}, mas ${addedLiters} L correspondem a ${deltaNum} partes (${deltaNum}/${den}), e não a 1/${den}!`,
            },
            {
              value: num2 * unitSliceLiters,
              label: `${num2 * unitSliceLiters} L`,
              diagnosticPt: `${num2 * unitSliceLiters} L é o volume atual dentro do tanque (${num2}/${den}), mas queremos a capacidade TOTAL (${den}/${den})!`,
            },
            {
              value: totalCapacity - unitSliceLiters * 2,
              label: `${totalCapacity - unitSliceLiters * 2} L`,
              diagnosticPt: `Cada 1/${den} vale ${unitSliceLiters} L; multiplicando por ${den} partes chegamos a ${totalCapacity} L.`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g4_problema_regra3_inversa_equipe',
    tier: 4,
    conceptId: 'divisao_por_fracao',
    codexSlug: 'regra-de-ouro-2',
    lensTitlePt: '⚙️ Problema Contextualizado: A Engrenagem do Tempo (Regra de 3 Inversa)',
    synthesize: (rng) => {
      const pairs: Array<{ p1: number; t1: number; p2: number }> = [
        { p1: 3, t1: 20, p2: 5 },
        { p1: 4, t1: 15, p2: 6 },
        { p1: 2, t1: 18, p2: 6 },
        { p1: 5, t1: 14, p2: 7 },
        { p1: 6, t1: 12, p2: 8 },
        { p1: 4, t1: 12, p2: 8 },
        { p1: 3, t1: 16, p2: 6 },
        { p1: 8, t1: 10, p2: 10 },
      ]
      const { p1, t1, p2 } = randPick(rng, pairs)
      const totalWorkHours = p1 * t1
      const ans = totalWorkHours / p2
      const extraWorkers = p2 - p1
      const methods: MentalSolutionMethod[] = [
        {
          badge: '⚡ Jeito 1 — Carga Total de Trabalho (Invariante)',
          summary: `${p1} engenheiros × ${t1} horas = ${totalWorkHours} horas-engenheiro de obra total. Dividindo entre ${p2} engenheiros: ${totalWorkHours} ÷ ${p2} = ${ans} horas!`,
        },
        {
          badge: '🔄 Jeito 2 — Proporção Inversa (Mais Gente = Menos Tempo)',
          summary: `A equipe aumentou de ${p1} para ${p2}, então o tempo reduz na razão inversa (${p1}/${p2}) × ${t1} = ${ans} horas!`,
        },
        {
          badge: '⚖️ Jeito 3 — Conservação do Retângulo',
          summary: `${p1} × ${t1} = ${p2} × Tempo → Tempo = ${ans} horas!`,
        },
      ]
      return {
        expressionBadge: `${p1} × ${t1}h = ${p2} × ?h`,
        questionPt: `PROBLEMA (A Regra de Ouro – Aula 2): Uma equipe de ${p1} engenheiros ergue uma torre de defesa em ${t1} horas. Se mais ${extraWorkers} engenheiros se juntarem ao grupo (totalizando ${p2} engenheiros no mesmo ritmo), em quantas horas a torre ficará pronta?`,
        luzGuiaPt: `Cuidado para não multiplicar cruzado direto! Mais engenheiros trabalhando juntos levam MENOS tempo. Qual é o total de "horas-engenheiro" da obra (${p1} × ${t1})?`,
        stepByStepPt: `Passo 1: Esforço total da obra = ${p1} × ${t1} = ${totalWorkHours} horas-engenheiro.\nPasso 2: Divida ${totalWorkHours} pelos ${p2} engenheiros trabalhando juntos!`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `A Regra de Três Inversa é a matemática da colaboração: dividir o peso multiplica o tempo livre!`,
        correctValue: ans,
        choices: buildFourChoices(
          ans,
          `${ans} horas`,
          `Mestre da Engrenagem do Tempo! ${p1} × ${t1} = ${totalWorkHours} horas-obra, que divididas por ${p2} engenheiros levam apenas ${ans} horas!`,
          [
            {
              value: Math.round((t1 * p2) / p1),
              label: `${Math.round((t1 * p2) / p1)} horas`,
              diagnosticPt: `Armadilha do "multiplica cruzado"! Com mais pessoas ajudando (${p2}), o tempo DIMINUI (proporção inversa), e não aumenta!`,
            },
            {
              value: Math.max(1, t1 - extraWorkers),
              label: `${Math.max(1, t1 - extraWorkers)} horas`,
              diagnosticPt: `A redução é proporcional (${totalWorkHours} ÷ ${p2} = ${ans}h), e não subtraindo ${extraWorkers} horas!`,
            },
            {
              value: totalWorkHours,
              label: `${totalWorkHours} horas`,
              diagnosticPt: `${totalWorkHours} é o esforço total (${p1}×${t1}); falta dividir pelos ${p2} engenheiros!`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g4_problema_heranca_restante',
    tier: 4,
    conceptId: 'fracao_menor_que_um',
    codexSlug: 'fracoes-operacoes',
    lensTitlePt: '🏰 Problema Contextualizado: A Fração Restante (Arsenal & Herança)',
    synthesize: (rng) => {
      // Ex: 1/2 + 1/3 -> sobra 1/6; ou 2/5 + 1/4 = 13/20 -> sobra 7/20; ou 1/3 + 1/4 = 7/12 -> sobra 5/12
      const configs: Array<{
        f1Label: string
        f2Label: string
        remNum: number
        remDen: number
        unitVal: number
      }> = [
        { f1Label: '1/2', f2Label: '1/3', remNum: 1, remDen: 6, unitVal: randInt(rng, 15, 50) * 10 },
        { f1Label: '1/3', f2Label: '1/4', remNum: 5, remDen: 12, unitVal: randInt(rng, 6, 20) * 10 },
        { f1Label: '2/5', f2Label: '1/4', remNum: 7, remDen: 20, unitVal: randInt(rng, 5, 18) * 10 },
        { f1Label: '1/4', f2Label: '2/5', remNum: 7, remDen: 20, unitVal: randInt(rng, 8, 22) * 10 },
        { f1Label: '1/5', f2Label: '1/2', remNum: 3, remDen: 10, unitVal: randInt(rng, 12, 35) * 10 },
      ]
      const cfg = randPick(rng, configs)
      const remainderCoins = cfg.remNum * cfg.unitVal
      const totalCoins = cfg.remDen * cfg.unitVal
      const usedNum = cfg.remDen - cfg.remNum
      const methods: MentalSolutionMethod[] = [
        {
          badge: `🍕 Jeito 1 — Igualar Denominadores (${cfg.remDen} partes)`,
          summary: `Somando ${cfg.f1Label} + ${cfg.f2Label} temos ${usedNum}/${cfg.remDen}. Logo sobram ${cfg.remNum}/${cfg.remDen} = ${remainderCoins} moedas. Cada 1/${cfg.remDen} vale ${cfg.unitVal}, e o total (${cfg.remDen}/${cfg.remDen}) vale ${totalCoins}!`,
        },
        {
          badge: '⚖️ Jeito 2 — Valor de 1 Parte Unitária',
          summary: `${remainderCoins} ÷ ${cfg.remNum} = ${cfg.unitVal} por parte. Multiplicando por ${cfg.remDen} partes = ${totalCoins}!`,
        },
        {
          badge: '🔍 Jeito 3 — Prova Real das Partes',
          summary: `Calculando ${cfg.f1Label} e ${cfg.f2Label} de ${totalCoins} e somando com ${remainderCoins}, fecha exatamente ${totalCoins}!`,
        },
      ]
      return {
        expressionBadge: `1 − (${cfg.f1Label} + ${cfg.f2Label}) = ${remainderCoins}`,
        questionPt: `PROBLEMA (Apostila de Frações): De todo o ouro do forte, ${cfg.f1Label} foi usado nos Quartéis, ${cfg.f2Label} nas Torres e as ${remainderCoins} moedas restantes foram guardadas no Cofre. Qual era o total de moedas do forte?`,
        luzGuiaPt: `Coloque ${cfg.f1Label} e ${cfg.f2Label} no mesmo denominador (${cfg.remDen}) para descobrir que fração do total sobrou para as ${remainderCoins} moedas!`,
        stepByStepPt: `Passo 1: ${cfg.f1Label} + ${cfg.f2Label} = ${usedNum}/${cfg.remDen}.\nPasso 2: Sobram ${cfg.remNum}/${cfg.remDen}, que valem ${remainderCoins} moedas.\nPasso 3: 1/${cfg.remDen} vale ${remainderCoins} ÷ ${cfg.remNum} = ${cfg.unitVal}. Multiplique por ${cfg.remDen}!`,
        guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
        methods,
        realLifeTipPt: `Quando conhecemos o valor financeiro do que sobrou e sua fração correspondente, reconstruímos o orçamento inteiro!`,
        correctValue: totalCoins,
        choices: buildFourChoices(
          totalCoins,
          `${totalCoins}`,
          `Brilhante! Os ${remainderCoins} restantes representam ${cfg.remNum}/${cfg.remDen} do total, logo o tesouro completo é ${totalCoins}!`,
          [
            {
              value: remainderCoins * 2,
              diagnosticPt: `As ${remainderCoins} moedas não são a metade, e sim ${cfg.remNum}/${cfg.remDen} do total!`,
            },
            {
              value: usedNum * cfg.unitVal,
              diagnosticPt: `${usedNum * cfg.unitVal} é a parte gasta (${usedNum}/${cfg.remDen}); somando com os ${remainderCoins} restantes temos ${totalCoins}!`,
            },
            {
              value: totalCoins + cfg.unitVal * 2,
              diagnosticPt: `Cada 1/${cfg.remDen} vale ${cfg.unitVal}; vezes ${cfg.remDen} fecha ${totalCoins}.`,
            },
          ],
          rng,
        ),
      }
    },
  },
  {
    archetypeId: 'g4_problema_balanca_montar_resolver',
    tier: 4,
    conceptId: 'ponto_de_virada',
    codexSlug: 'equacoes-maquina-do-tempo',
    lensTitlePt: '⚖️ Problema Contextualizado: O Guardião da Balança (Monte e Resolva)',
    synthesize: (rng) => {
      if (rng() < 0.5) {
        // A metade/terça/quarta parte de X, mais/menos B, resulta em C
        const div = randPick(rng, [2, 3, 4, 5])
        const nomeFracao =
          div === 2 ? 'A metade' : div === 3 ? 'A terça parte' : div === 4 ? 'A quarta parte' : 'A quinta parte'
        const q = randInt(rng, 12, 35)
        const totalX = div * q
        const delta = randInt(rng, 6, 24)
        const isMinus = rng() < 0.5
        const finalVal = isMinus ? q - delta : q + delta
        const methods: MentalSolutionMethod[] = [
          {
            badge: '⏳ Jeito 1 — Rebobinar pela Máquina do Tempo',
            summary: isMinus
              ? `Antes de perder ${delta}, tínhamos ${finalVal} + ${delta} = ${q}. Como ${q} é 1/${div} do total, o total inteiro é ${q} × ${div} = ${totalX}!`
              : `Antes do bônus de ${delta}, tínhamos ${finalVal} − ${delta} = ${q}. Como ${q} é 1/${div} do total, o total inteiro é ${q} × ${div} = ${totalX}!`,
          },
          {
            badge: '⚖️ Jeito 2 — Equação da Balança',
            summary: `(x ÷ ${div}) ${isMinus ? '−' : '+'} ${delta} = ${finalVal} → x ÷ ${div} = ${q} → x = ${totalX}!`,
          },
          {
            badge: '🔍 Jeito 3 — Prova Real no Texto',
            summary: `${nomeFracao} de ${totalX} é ${q}; ${isMinus ? `menos ${delta}` : `mais ${delta}`} fecha exatamente ${finalVal}!`,
          },
        ]
        return {
          expressionBadge: `(x ÷ ${div}) ${isMinus ? '−' : '+'} ${delta} = ${finalVal}`,
          questionPt: `PROBLEMA (A Máquina do Tempo das Equações): ${nomeFracao} dos blocos da pedreira, ${isMinus ? `menos ${delta} blocos que quebraram` : `somada com ${delta} blocos de reserva`}, resulta em ${finalVal} blocos prontos. Quantos blocos havia originalmente na pedreira inteira?`,
          luzGuiaPt: `Monte a equação: (x ÷ ${div}) ${isMinus ? '−' : '+'} ${delta} = ${finalVal}. Desfaça primeiro o ${isMinus ? `−${delta}` : `+${delta}`} e depois multiplique por ${div}!`,
          stepByStepPt: `Passo 1: x ÷ ${div} = ${finalVal} ${isMinus ? '+' : '−'} ${delta} = ${q}.\nPasso 2: x = ${q} × ${div}!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Traduzir o português para a linguagem da balança torna qualquer enigma transparente.`,
          correctValue: totalX,
          choices: buildFourChoices(
            totalX,
            `${totalX}`,
            `Mestre da Balança! x ÷ ${div} = ${q} → x = ${totalX} blocos!`,
            [
              {
                value: q,
                diagnosticPt: `${q} é apenas ${nomeFracao.toLowerCase()} (x ÷ ${div})! Falta multiplicar por ${div} para achar o total.`,
              },
              {
                value: finalVal * div,
                diagnosticPt: `Você multiplicou ${finalVal} por ${div} antes de desfazer o ${isMinus ? `−${delta}` : `+${delta}`}!`,
              },
              {
                value: (isMinus ? finalVal - delta : finalVal + delta) * div,
                diagnosticPt: `Para voltar no tempo, usamos a operação INVERSA de ${isMinus ? `−${delta} (+${delta})` : `+${delta} (−${delta})`}!`,
              },
            ],
            rng,
          ),
        }
      } else {
        // Trincheira de Parênteses e Colchetes com Sinais (Apostila 16 #34-#40)
        const a = randInt(rng, 2, 5)
        const b = randInt(rng, 3, 9)
        const d = randPick(rng, [2, 3, 4, 5])
        const q = randInt(rng, 3, 8)
        const c = d * q // c / (-d) = -q
        const e = randInt(rng, 2, 5)
        const f = randInt(rng, 2, 5)
        const prodEF = e * f
        // Expressão: b - [ (-c ÷ d) - (-e × -f) ] * a
        // (-c ÷ d) = -q ; (-e × -f) = +prodEF ; colchete = -q - prodEF = -(q + prodEF)
        // b - [ -(q + prodEF) ] * a = b + (q + prodEF) * a
        const bracketVal = -(q + prodEF)
        const ans = b - bracketVal * a
        const methods: MentalSolutionMethod[] = [
          {
            badge: '🛡️ Jeito 1 — De Dentro para Fora (Parênteses → Colchetes)',
            summary: `1º Parênteses: (−${c} ÷ ${d}) = −${q} e (−${e} · −${f}) = +${prodEF}. 2º Colchete: [−${q} − ${prodEF}] = ${bracketVal}. 3º Final: ${b} − (${bracketVal}) · ${a} = ${b} + ${(q + prodEF) * a} = ${ans}!`,
          },
          {
            badge: '⚖️ Jeito 2 — Choque de Sinais no Colchete',
            summary: `Como o colchete dá ${bracketVal} (negativo) e tem um sinal de menos antes dele, −(${bracketVal})×${a} vira um ganho positivo de +${(q + prodEF) * a}!`,
          },
          {
            badge: '🧱 Jeito 3 — Passo a Passo Auditado',
            summary: `${b} + (${q} + ${prodEF}) × ${a} = ${b} + ${q + prodEF} × ${a} = ${ans}!`,
          },
        ]
        return {
          expressionBadge: `${b} − [ (−${c} ÷ ${d}) − (−${e} · −${f}) ] · ${a}`,
          questionPt: `DESAFIO DA TRINCHEIRA (Expressões Numéricas Nível 4): Resolva de dentro para fora sem calculadora:\n${b} − [ (−${c} ÷ ${d}) − (−${e} · −${f}) ] · ${a} = ?`,
          luzGuiaPt: `Resolva primeiro os dois parênteses internos: quanto dá (−${c} ÷ ${d}) e quanto dá (−${e} · −${f})?`,
          stepByStepPt: `Passo 1: (−${c} ÷ ${d}) = −${q} e (−${e} · −${f}) = +${prodEF}.\nPasso 2: Colchete = [−${q} − ${prodEF}] = ${bracketVal}.\nPasso 3: Calcule ${b} − (${bracketVal} · ${a})!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Organizar parênteses e colchetes exercita a memória de trabalho do córtex pré-frontal.`,
          correctValue: ans,
          choices: buildFourChoices(
            ans,
            `${ans}`,
            `Córtex pré-frontal blindado! O colchete vale ${bracketVal}, e ${b} − (${bracketVal} · ${a}) = ${ans}!`,
            [
              {
                value: b + bracketVal * a,
                diagnosticPt: `Atenção ao duplo sinal: subtraindo o valor negativo (${bracketVal} · ${a}), o sinal vira POSITIVO (+${(q + prodEF) * a})!`,
              },
              {
                value: b + Math.abs(prodEF - q) * a,
                diagnosticPt: `Dentro do colchete temos −${q} − (+${prodEF}) = −${q + prodEF} (duas dívidas se somam)!`,
              },
              {
                value: (b - bracketVal) * a,
                diagnosticPt: `A multiplicação por ${a} aplica-se ao colchete antes de somar/subtrair com ${b}!`,
              },
            ],
            rng,
          ),
        }
      }
    },
  },
  {
    archetypeId: 'g4_problema_senhores_do_tempo_divisores',
    tier: 4,
    conceptId: 'divisao_euclidiana_resto',
    codexSlug: 'segredo-divisores',
    lensTitlePt: '🕰️ Problema Contextualizado: Os Senhores do Tempo & Números Perfeitos',
    synthesize: (rng) => {
      const sub = randInt(rng, 0, 2)
      if (sub === 0) {
        // Contagem de divisores de 12, 18, 20, 24, 28, 30, 36, 60
        const items: Array<{ n: number; count: number; listStr: string; factorHint: string }> = [
          { n: 12, count: 6, listStr: '1, 2, 3, 4, 6 e 12', factorHint: 'Forme os pares que multiplicados dão 12: (1×12), (2×6), (3×4)' },
          { n: 18, count: 6, listStr: '1, 2, 3, 6, 9 e 18', factorHint: 'Forme os pares que multiplicados dão 18: (1×18), (2×9), (3×6)' },
          { n: 20, count: 6, listStr: '1, 2, 4, 5, 10 e 20', factorHint: 'Forme os pares que multiplicados dão 20: (1×20), (2×10), (4×5)' },
          { n: 24, count: 8, listStr: '1, 2, 3, 4, 6, 8, 12 e 24', factorHint: 'Forme os 4 pares que multiplicados dão 24: (1×24), (2×12), (3×8), (4×6)' },
          { n: 30, count: 8, listStr: '1, 2, 3, 5, 6, 10, 15 e 30', factorHint: 'Forme os pares que multiplicados dão 30: (1×30), (2×15), (3×10), (5×6)' },
          { n: 60, count: 12, listStr: '1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30 e 60', factorHint: 'O Senhor do Tempo (60) tem 6 pares de divisores: (1×60), (2×30), (3×20), (4×15), (5×12), (6×10)' },
        ]
        const item = randPick(rng, items)
        const methods: MentalSolutionMethod[] = [
          {
            badge: '🌈 Jeito 1 — Arco-Íris de Pares de Fatores',
            summary: `${item.factorHint} → são exatamente ${item.count} divisores (${item.listStr})!`,
          },
          {
            badge: '🧬 Jeito 2 — Fórmula dos Expoentes Primos',
            summary: `Fatorando ${item.n} em primos e somando +1 a cada expoente, o produto dos expoentes fecha ${item.count} divisores!`,
          },
          {
            badge: '🕰️ Jeito 3 — Divisões Exatas',
            summary: `Há ${item.count} maneiras diferentes de dividir ${item.n} soldados em pelotões iguais sem sobrar resto!`,
          },
        ]
        return {
          expressionBadge: `Divisores(${item.n}) = ?`,
          questionPt: `PROBLEMA (O Segredo dos Divisores): Por que números como ${item.n} são tão usados para organizar tempo e pelotões? De quantas maneiras diferentes podemos dividir ${item.n} soldados em grupos iguais sem sobrar ninguém (ou seja, quantos divisores naturais o número ${item.n} possui)?`,
          luzGuiaPt: `Dica do Arco-Íris: conte os divisores sempre em PARES que multiplicados dão ${item.n}, começando por (1 e ${item.n}), (2 e ${item.n / 2})...`,
          stepByStepPt: `${item.factorHint}. Conte quantos números aparecem nesses pares!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Usamos 24 horas e 60 minutos porque eles têm muito mais divisores exatos do que 10 ou 100!`,
          correctValue: item.count,
          choices: buildFourChoices(
            item.count,
            `${item.count} divisores`,
            `Investigação digna de Sherlock! Os divisores de ${item.n} são ${item.listStr} (total de ${item.count})!`,
            [
              {
                value: item.count - 2,
                label: `${item.count - 2} divisores`,
                diagnosticPt: `Você esqueceu de contar um par (como 1 e ${item.n})! Formando os pares completos temos ${item.count} divisores.`,
              },
              {
                value: item.count + 2,
                label: `${item.count + 2} divisores`,
                diagnosticPt: `Os pares exatos de ${item.n} são (${item.listStr}), totalizando ${item.count} divisores.`,
              },
              {
                value: item.count / 2,
                label: `${item.count / 2} divisores`,
                diagnosticPt: `${item.count / 2} é a quantidade de PARES; como cada par tem 2 números, são ${item.count} divisores!`,
              },
            ],
            rng,
          ),
        }
      } else {
        // Engrenagens / Torneiras em paralelo: T1 e T2 horas -> (T1 * T2) / (T1 + T2)
        const tPairs: Array<{ t1: number; t2: number; together: number }> = [
          { t1: 3, t2: 6, together: 2 },
          { t1: 4, t2: 12, together: 3 },
          { t1: 6, t2: 12, together: 4 },
          { t1: 5, t2: 20, together: 4 },
          { t1: 10, t2: 15, together: 6 },
          { t1: 12, t2: 24, together: 8 },
        ]
        const tp = randPick(rng, tPairs)
        const methods: MentalSolutionMethod[] = [
          {
            badge: '⚡ Jeito 1 — Fração por Hora (1/T₁ + 1/T₂)',
            summary: `Em 1 hora, a Forja A faz 1/${tp.t1} e a Forja B faz 1/${tp.t2}. Juntas fazem 1/${tp.t1} + 1/${tp.t2} = 1/${tp.together} da obra por hora → terminam em ${tp.together} horas!`,
          },
          {
            badge: '🪄 Jeito 2 — Produto sobre a Soma',
            summary: `(T₁ × T₂) ÷ (T₁ + T₂) = (${tp.t1} × ${tp.t2}) ÷ (${tp.t1} + ${tp.t2}) = ${tp.t1 * tp.t2} ÷ ${tp.t1 + tp.t2} = ${tp.together} horas!`,
          },
          {
            badge: '🧱 Jeito 3 — Múltiplo Comum de Horas',
            summary: `Em ${tp.t1 * tp.t2} horas, A faria ${tp.t2} cargas e B faria ${tp.t1} cargas (${tp.t1 + tp.t2} cargas). Logo, 1 carga leva ${tp.t1 * tp.t2} ÷ ${tp.t1 + tp.t2} = ${tp.together} horas!`,
          },
        ]
        return {
          expressionBadge: `1/${tp.t1} + 1/${tp.t2} = 1/?`,
          questionPt: `PROBLEMA (Torneiras e Razões — Apostila de Frações #7): Uma forja abastece o forte sozinha em ${tp.t1} horas, enquanto uma segunda forja leva ${tp.t2} horas. Se ambas forem ligadas juntas ao mesmo tempo, em quantas horas abastecerão tudo?`,
          luzGuiaPt: `Em 1 hora, a primeira faz 1/${tp.t1} e a segunda faz 1/${tp.t2}. Some as duas frações (ou use Produto ÷ Soma)!`,
          stepByStepPt: `1/${tp.t1} + 1/${tp.t2} = (${tp.t2} + ${tp.t1}) / ${tp.t1 * tp.t2} = 1/${tp.together} por hora. Logo levam ${tp.together} horas!`,
          guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
          methods,
          realLifeTipPt: `Duas máquinas trabalhando em paralelo somam suas velocidades (1/T₁ + 1/T₂), e nunca os seus tempos!`,
          correctValue: tp.together,
          choices: buildFourChoices(
            tp.together,
            `${tp.together} horas`,
            `Perfeito! Somando as taxas 1/${tp.t1} + 1/${tp.t2} = 1/${tp.together}, juntas elas terminam em apenas ${tp.together} horas!`,
            [
              {
                value: tp.t1 + tp.t2,
                label: `${tp.t1 + tp.t2} horas`,
                diagnosticPt: `Duas forjas trabalhando juntas terminam MAIS RÁPIDO que a mais rápida sozinha (${tp.t1}h), nunca na soma dos tempos!`,
              },
              {
                value: Math.round((tp.t1 + tp.t2) / 2),
                label: `${Math.round((tp.t1 + tp.t2) / 2)} horas`,
                diagnosticPt: `${Math.round((tp.t1 + tp.t2) / 2)}h seria a média simples; em paralelo somamos as frações 1/${tp.t1} + 1/${tp.t2} = 1/${tp.together} → ${tp.together}h!`,
              },
              {
                value: Math.abs(tp.t2 - tp.t1),
                label: `${Math.abs(tp.t2 - tp.t1)} horas`,
                diagnosticPt: `Usando (Produto ÷ Soma) = (${tp.t1}×${tp.t2}) ÷ (${tp.t1}+${tp.t2}) = ${tp.together} horas!`,
              },
            ],
            rng,
          ),
        }
      }
    },
  },
]

// ──────────────────────────────────────────────────────────────────────────────
// API PÚBLICA: SÍNTESE INFINITA COM ANEL DE COOLDOWN ESTRATIFICADO
// ──────────────────────────────────────────────────────────────────────────────
export interface GenerateInfiniteChallengeOptions {
  tier: MathDifficultyTier
  seed?: number
  preferredConceptId?: ConceptId
  excludeSignatures?: readonly string[]
}

export function generateInfiniteChallenge(
  options: GenerateInfiniteChallengeOptions,
): InfiniteMathChallenge {
  const tier = options.tier
  let s = (options.seed ?? Date.now() + Math.floor(Math.random() * 1_000_000)) >>> 0
  if (s === 0) s = 0x6d2b79f5
  const rng = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const callerExclude = new Set<string>(options.excludeSignatures ?? [])
  const tierSpecs = ARCHETYPE_GENERATORS.filter((g) => g.tier === tier)

  // Filtrar arquétipos que não estão no anel recente
  const recentArchSet = new Set<string>(RECENT_ARCHETYPE_QUEUE)
  const freshSpecs = tierSpecs.filter((g) => !recentArchSet.has(g.archetypeId))
  const pool = freshSpecs.length > 0 ? freshSpecs : tierSpecs

  let bestCandidate: InfiniteMathChallenge | null = null

  for (let attempt = 0; attempt < 36; attempt++) {
    const spec = pool[(attempt + Math.floor(rng() * pool.length)) % pool.length]
    const raw = spec.synthesize(rng)
    const signature = `${spec.archetypeId}:${raw.expressionBadge ?? raw.questionPt.slice(0, 42)}=${raw.correctValue}`
    const challenge: InfiniteMathChallenge = {
      ...raw,
      id: `math_v6_${tier}_${Date.now()}_${attempt}_${Math.floor(rng() * 9999)}`,
      signature,
      archetypeId: spec.archetypeId,
      tier,
      lensTitlePt: spec.lensTitlePt,
      conceptId: spec.conceptId,
      codexSlug: spec.codexSlug,
    }
    bestCandidate = challenge

    const isSeen =
      callerExclude.has(signature) || SESSION_SEEN_SIGNATURES.has(signature)
    if (!isSeen) {
      recordSeenMathChallenge(signature, spec.archetypeId)
      return challenge
    }
  }

  const finalChosen = bestCandidate!
  recordSeenMathChallenge(finalChosen.signature, finalChosen.archetypeId)
  return finalChosen
}
