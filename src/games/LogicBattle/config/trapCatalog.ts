// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/config/trapCatalog.ts — Bíblia das 20 Pegadinhas & Gêmeos
// Fonte da verdade: master-plan/CATALOGO_PEGADINHAS.md
// Todos os codexSlug apontam para aulas reais verificadas em src/data/content.ts
// ──────────────────────────────────────────────────────────────────────────────
import {
  ArmyCount,
  BiomeId,
  ConceptId,
  Gate,
  RedemptionChoice,
  SegmentKind,
  TrapId,
  TwinId,
} from '../types'
import { GATE_POLICIES } from './gatePolicies'

export interface BuiltTrapSegment {
  kind: SegmentKind
  lanes: Gate[][]
  intuitiveLane: number
  betterLane: number
}

export interface BuiltIsomorphicChallenge {
  questionPt: string
  stepByStepPt: string
  guidedWalkthroughPt: string
  choices: RedemptionChoice[]
}

export interface TrapCatalogEntry {
  id: TrapId
  name: string
  biome: BiomeId
  conceptId: ConceptId
  codexSlug: string
  legendary: boolean
  summaryGatesPt: string
  verifiedExamplePt: string
  intuitionTrapPt: string
  luzGuiaPt: string
  /** Verifica se o exército N atual satisfaz a condição de validade estrita da pegadinha */
  isValidForArmy: (n: ArmyCount) => boolean
  /** Constrói as faixas de portões parametrizadas para o exército N atual */
  buildSegment: (n: ArmyCount, randFloat: () => number, laneCount: 2 | 3) => BuiltTrapSegment
  /** Constrói a Conta de Resgate isomórfica (mesmo conceito, outros números) */
  buildRedemption: (randFloat: () => number) => BuiltIsomorphicChallenge
}

export interface TwinCatalogEntry {
  id: TwinId
  name: string
  equivalencePt: string
  codexSlug: string
  buildLanes: (laneCount: 2 | 3) => Gate[][]
}

function makeGate(
  id: string,
  op: Gate['op'],
  value: number,
  num: number,
  den: number,
  label: string,
  complex = false,
  exprKind?: Gate['operand']['exprKind'],
  secondaryValue?: number,
): Gate {
  return {
    id,
    op,
    operand: { value, num, den, exprKind, secondaryValue },
    label,
    readingTimeMs:
      GATE_POLICIES.baseReadingTimeMs +
      (complex ? GATE_POLICIES.complexOperatorReadingBonusMs : 0),
  }
}

/**
 * Garante a invariante geométrica `lanes.length === laneCount`:
 * Quando `laneCount === 3` e o par base da pegadinha possui 2 faixas, adiciona uma 3ª faixa
 * intermediária honesta sem alterar `intuitiveLane` (0/1) nem superar `betterLane`.
 */
export function ensureTrapLaneCardinality(
  base: BuiltTrapSegment,
  laneCount: 2 | 3,
  thirdGate: Gate,
): BuiltTrapSegment {
  if (laneCount === 2 || base.lanes.length >= 3) {
    return base
  }
  return {
    ...base,
    lanes: [...base.lanes, [thirdGate]],
  }
}

export const PROHIBITED_GATE_LABELS: readonly string[] = [
  '× 0',
  '×0',
  '6 ÷ 2(1 + 2)',
  '6÷2(1+2)',
  'a/bc',
  '0,333...',
]

export function isProhibitedGateLabel(label: string): boolean {
  const trimmed = label.trim()
  if (/^×\s*0(?![,\d])/.test(trimmed)) return true
  return (
    trimmed.includes('6 ÷ 2(1 + 2)') ||
    trimmed.includes('6÷2(1+2)') ||
    trimmed.includes('a/bc') ||
    trimmed.includes('0,333...')
  )
}

export const TRAP_CATALOG: Record<TrapId, TrapCatalogEntry> = {
  // ── BIOMA 1: PLANÍCIE DA PONTE DE PEDRA ──────────────────────────────────
  T01: {
    id: 'T01',
    name: 'O Gigante de Papel',
    biome: 'planicie_pedra',
    conceptId: 'ponto_de_virada',
    codexSlug: 'equacao-balanca',
    legendary: false,
    summaryGatesPt: '⚠ + 99  vs  × 2',
    verifiedExamplePt: 'Com N = 120: +99 dá 219, enquanto ×2 dá 240 (perda de 21 soldados).',
    intuitionTrapPt: 'O cérebro vê o número 99 gigante ao lado de um modesto 2 e acha que +99 é maior.',
    luzGuiaPt: 'Quanto o ×2 acrescenta quando você já tem um exército acima do ponto de virada?',
    isValidForArmy: (n) => n >= 25,
    buildSegment: (n, randFloat, laneCount) => {
      // Escolhe 'a' entre 65% e 85% de N para que N > a (logo N * 2 > N + a com perda <= 60%)
      const ratio = 0.68 + randFloat() * 0.16
      const a = Math.max(15, Math.floor(n * ratio))
      const gAdd = makeGate('t01-add', '+', a, a, 1, `+ ${a.toLocaleString('pt-BR')}`)
      const gMul = makeGate('t01-mul', '×', 2, 2, 1, '× 2')
      const midAdd = Math.max(5, Math.floor(a * 0.5))
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gAdd], [gMul]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t01-mid', '+', midAdd, midAdd, 1, `+ ${midAdd.toLocaleString('pt-BR')}`),
      )
    },
    buildRedemption: (randFloat) => {
      const options = [80, 120, 150, 200]
      const a = options[Math.floor(randFloat() * options.length)]
      const half = a / 2
      const double = a * 2
      return {
        questionPt: `Com quantos soldados os portões "+${a}" e "×2" dão exatamente EMPATE?`,
        stepByStepPt: `Dobrar (×2) significa somar o seu próprio exército (N + N). Para empatar com N + ${a}, basta que N = ${a}!`,
        guidedWalkthroughPt: `Passo 1: N × 2 é o mesmo que N + N.\nPasso 2: Compare N + N com N + ${a}.\nPasso 3: Logo, o ponto de virada exato é ${a}!`,
        choices: [
          {
            id: 'c1',
            label: `${half}`,
            value: half,
            isCorrect: false,
            diagnosticPt: `Com ${half} soldados, ×2 dá ${a}, mas +${a} dá ${half + a}. Ainda falta metade!`,
          },
          {
            id: 'c2',
            label: `${a}`,
            value: a,
            isCorrect: true,
            diagnosticPt: `Exato! ${a} + ${a} = ${double} e ${a} × 2 = ${double}. Acima de ${a}, o ×2 sempre vence!`,
          },
          {
            id: 'c3',
            label: `${double}`,
            value: double,
            isCorrect: false,
            diagnosticPt: `${double} é o resultado final após passar pelo portão, não o exército antes dele.`,
          },
        ],
      }
    },
  },

  T07: {
    id: 'T07',
    name: 'A Ordem Importa',
    biome: 'planicie_pedra',
    conceptId: 'nao_comutatividade',
    codexSlug: 'expressoes-numericas-trincheira',
    legendary: false,
    summaryGatesPt: '+ 10 → × 3  vs  ⚠ × 3 → + 10',
    verifiedExamplePt: 'Com N = 5: (+10 → ×3) = 45, mas (×3 → +10) = 25 (perda de 20 soldados).',
    intuitionTrapPt: 'Como os dois caminhos têm exatamente as mesmas placas (+10 e ×3), a intuição acha que tanto faz a ordem.',
    luzGuiaPt: 'Se você soma antes, os novos soldados também passam pelo multiplicador!',
    isValidForArmy: (n) => n >= 4,
    buildSegment: (n, randFloat, laneCount) => {
      const addVal = Math.max(8, Math.round(n * (0.45 + randFloat() * 0.25)))
      const mulVal = 2
      const laneA = [
        makeGate('t07-a1', '+', addVal, addVal, 1, `+ ${addVal}`),
        makeGate('t07-a2', '×', mulVal, mulVal, 1, `× ${mulVal}`),
      ]
      const laneB = [
        makeGate('t07-b1', '×', mulVal, mulVal, 1, `× ${mulVal}`),
        makeGate('t07-b2', '+', addVal, addVal, 1, `+ ${addVal}`),
      ]
      return ensureTrapLaneCardinality(
        {
          kind: 'chain',
          lanes: [laneA, laneB],
          intuitiveLane: 1,
          betterLane: 0,
        },
        laneCount,
        makeGate('t07-mid', '+', addVal, addVal, 1, `+ ${addVal}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Com 4 soldados, qual a diferença final entre os caminhos (+5 → ×2) e (×2 → +5)?',
      stepByStepPt: 'Caminho A: (4 + 5) × 2 = 18. Caminho B: (4 × 2) + 5 = 13. A diferença é 18 − 13 = 5!',
      guidedWalkthroughPt: 'No primeiro caminho, o +5 também é dobrado pelo ×2 (vira +10). Por isso sobram 5 soldados a mais!',
      choices: [
        {
          id: 'c1',
          label: '0',
          value: 0,
          isCorrect: false,
          diagnosticPt: 'Somar e multiplicar não comutam entre si: a ordem altera o resultado!',
        },
        {
          id: 'c2',
          label: '5',
          value: 5,
          isCorrect: true,
          diagnosticPt: 'Perfeito! (4 + 5) × 2 = 18 contra 4 × 2 + 5 = 13. Diferença de 5 soldados!',
        },
        {
          id: 'c3',
          label: '10',
          value: 10,
          isCorrect: false,
          diagnosticPt: '10 é o quanto o +5 rende depois de dobrar, mas no outro caminho você já ganhava +5.',
        },
      ],
    }),
  },

  T19: {
    id: 'T19',
    name: 'A Ilusão da Esteira',
    biome: 'planicie_pedra',
    conceptId: 'soma_repetida_esteira',
    codexSlug: 'magia-calculo-mental-multiplicacao',
    legendary: false,
    summaryGatesPt: '⚠ 5× portões [+1]  vs  portão único [+8]',
    verifiedExamplePt: 'Com N = 30: 5 portões +1 somam +5 (35), enquanto o portão único +8 leva a 38.',
    intuitionTrapPt: 'A fileira cheia de portões brilhando parece muito mais generosa do que uma placa solitária.',
    luzGuiaPt: 'Multiplicar é somar parcelas iguais: some a esteira inteira (5 × valor) antes de decidir!',
    isValidForArmy: (n) => n >= 5,
    buildSegment: (n, _randFloat, laneCount) => {
      const step = Math.max(1, Math.round(n * 0.04))
      const single = step * 7
      const conveyorGates = Array.from({ length: 5 }, (_, idx) =>
        makeGate(`t19-c${idx}`, '+', step, step, 1, `+ ${step}`),
      )
      const singleGate = [makeGate('t19-s', '+', single, single, 1, `+ ${single}`)]
      const midVal = step * 6
      return ensureTrapLaneCardinality(
        {
          kind: 'conveyor',
          lanes: [conveyorGates, singleGate],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t19-mid', '+', midVal, midVal, 1, `+ ${midVal}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Uma esteira de 7 portões "+2" ou um portão único "+12": quanto rende a melhor opção?',
      stepByStepPt: '7 portões de +2 equivalem a 7 × 2 = +14, que supera o portão único de +12!',
      guidedWalkthroughPt: 'Conte a esteira como multiplicação: 7 × 2 = 14. Compare +14 com +12: a melhor rende +14!',
      choices: [
        {
          id: 'c1',
          label: '+9',
          value: 9,
          isCorrect: false,
          diagnosticPt: 'Você somou 7 + 2 = 9 em vez de multiplicar 7 portões × 2 soldados cada!',
        },
        {
          id: 'c2',
          label: '+12',
          value: 12,
          isCorrect: false,
          diagnosticPt: '+12 é o portão único, mas 7 × 2 na esteira entrega +14 soldados!',
        },
        {
          id: 'c3',
          label: '+14',
          value: 14,
          isCorrect: true,
          diagnosticPt: 'Na mosca! 7 portões de +2 = 7 × 2 = +14 soldados.',
        },
      ],
    }),
  },

  T20: {
    id: 'T20',
    name: 'A Corrida Longa',
    biome: 'planicie_pedra',
    conceptId: 'visao_caminho_inteiro',
    codexSlug: 'equacoes-maquina-do-tempo',
    legendary: false,
    summaryGatesPt: '⚠ (+ 99 → ÷ 3)  vs  × 2',
    verifiedExamplePt: 'Com N = 60: (60 + 99) ÷ 3 = 53, enquanto ×2 entrega 120 (perda de 56%).',
    intuitionTrapPt: 'O olhar trava na placa +99 da frente e ignora o divisor ÷3 logo atrás na mesma faixa.',
    luzGuiaPt: 'Olhe o caminho inteiro da faixa, não apenas a primeira placa!',
    isValidForArmy: (n) => n >= 20,
    buildSegment: (n, _randFloat, laneCount) => {
      const addA = Math.max(18, Math.floor(n * 1.5))
      const laneA = [
        makeGate('t20-a1', '+', addA, addA, 1, `+ ${addA}`),
        makeGate('t20-a2', '÷', 3, 3, 1, '÷ 3'),
      ]
      const laneB = [makeGate('t20-b1', '×', 2, 2, 1, '× 2')]
      const midAdd = Math.max(5, Math.floor(n * 0.5))
      return ensureTrapLaneCardinality(
        {
          kind: 'chain',
          lanes: [laneA, laneB],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t20-mid', '+', midAdd, midAdd, 1, `+ ${midAdd}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Com 30 soldados, entre (+60 → ÷2) e (×2), com quantos soldados fica a melhor faixa?',
      stepByStepPt: 'Faixa A: (30 + 60) ÷ 2 = 90 ÷ 2 = 45. Faixa B: 30 × 2 = 60. A melhor deixa 60!',
      guidedWalkthroughPt: 'Calcule os dois finais: (30 + 60) ÷ 2 dá 45; já 30 × 2 dá 60. O melhor resultado é 60!',
      choices: [
        {
          id: 'c1',
          label: '45',
          value: 45,
          isCorrect: false,
          diagnosticPt: '45 é o resultado da faixa (+60 → ÷2), onde o ÷2 corta metade do ganho.',
        },
        {
          id: 'c2',
          label: '60',
          value: 60,
          isCorrect: true,
          diagnosticPt: 'Exato! 30 × 2 = 60 supera (30 + 60) ÷ 2 = 45.',
        },
        {
          id: 'c3',
          label: '90',
          value: 90,
          isCorrect: false,
          diagnosticPt: '90 era o valor antes de passar pelo ÷2 que estava logo atrás na mesma faixa!',
        },
      ],
    }),
  },

  // ── BIOMA 2: FIORDE GELADO ────────────────────────────────────────────────
  T02: {
    id: 'T02',
    name: 'O Multiplicador Encolhedor',
    biome: 'fiorde_gelado',
    conceptId: 'fracao_menor_que_um',
    codexSlug: 'fracoes-operacoes',
    legendary: false,
    summaryGatesPt: '⚠ × ½  vs  − 10',
    verifiedExamplePt: 'Com N = 40: ×½ reduz para 20, enquanto −10 deixa 30 (perda de 33%).',
    intuitionTrapPt: 'O cérebro associa o símbolo × a crescimento e foge do sinal de menos (−10).',
    luzGuiaPt: 'Multiplicar por ½ (meio) significa ficar apenas com a metade do exército!',
    isValidForArmy: (n) => n >= 24,
    buildSegment: (n, _randFloat, laneCount) => {
      const subA = Math.max(4, Math.floor(n * 0.25))
      const gHalf = makeGate('t02-half', '×', 0.5, 1, 2, '× ½', true)
      const gSub = makeGate('t02-sub', '−', subA, subA, 1, `− ${subA}`)
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gHalf], [gSub]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t02-mid', '−', subA + 2, subA + 2, 1, `− ${subA + 2}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Com 60 soldados, entre "× ½" e "− 20", com quantos soldados fica a melhor escolha?',
      stepByStepPt: '60 × ½ = 30 soldados (perde metade!). Já 60 − 20 = 40 soldados.',
      guidedWalkthroughPt: 'Metade de 60 é 30. Subtrair 20 de 60 deixa 40. Portanto, 40 é o melhor resultado!',
      choices: [
        {
          id: 'c1',
          label: '30',
          value: 30,
          isCorrect: false,
          diagnosticPt: '30 é o que sobra em ×½. Multiplicar por ½ corta 30 soldados de uma vez!',
        },
        {
          id: 'c2',
          label: '40',
          value: 40,
          isCorrect: true,
          diagnosticPt: 'Isso! 60 − 20 = 40 preserva 10 soldados a mais do que multiplicar por ½.',
        },
        {
          id: 'c3',
          label: '80',
          value: 80,
          isCorrect: false,
          diagnosticPt: 'Nenhuma das duas opções aumenta o exército; o segredo é escolher a menor perda!',
        },
      ],
    }),
  },

  T03: {
    id: 'T03',
    name: 'A Divisão que Dobra',
    biome: 'fiorde_gelado',
    conceptId: 'divisao_por_fracao',
    codexSlug: 'fracoes-operacoes',
    legendary: false,
    summaryGatesPt: '÷ ½  vs  ⚠ + 20',
    verifiedExamplePt: 'Com N = 30: ÷½ dobra para 60, enquanto +20 entrega 50.',
    intuitionTrapPt: 'A regra decorada diz que "dividir sempre diminui", fazendo o jogador fugir do ÷½.',
    luzGuiaPt: 'Pergunte-se: quantas metades (½) cabem dentro do seu exército inteiro?',
    isValidForArmy: (n) => n >= 16,
    buildSegment: (n, _randFloat, laneCount) => {
      const addA = Math.max(8, Math.floor(n * 0.65))
      const gDivHalf = makeGate('t03-divhalf', '÷', 0.5, 1, 2, '÷ ½', true)
      const gAdd = makeGate('t03-add', '+', addA, addA, 1, `+ ${addA}`)
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gAdd], [gDivHalf]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t03-mid', '+', Math.max(4, Math.floor(addA * 0.5)), Math.max(4, Math.floor(addA * 0.5)), 1, `+ ${Math.max(4, Math.floor(addA * 0.5))}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Quanto é 25 ÷ ½ (quantas metades cabem em 25)?',
      stepByStepPt: 'Cada unidade inteira tem 2 metades. Em 25 unidades cabem 25 × 2 = 50 metades!',
      guidedWalkthroughPt: 'Dividir por ½ é multiplicar pelo inverso (× 2). Logo, 25 × 2 = 50!',
      choices: [
        {
          id: 'c1',
          label: '12',
          value: 12,
          isCorrect: false,
          diagnosticPt: '12 seria dividir por 2 (25 ÷ 2), mas o portão divide por ½ (meio)!',
        },
        {
          id: 'c2',
          label: '25',
          value: 25,
          isCorrect: false,
          diagnosticPt: '25 seria dividir por 1. Dividir por um número menor que 1 faz o resultado crescer!',
        },
        {
          id: 'c3',
          label: '50',
          value: 50,
          isCorrect: true,
          diagnosticPt: 'Brilhante! Em 25 inteiros cabem exatamente 50 metades (25 ÷ ½ = 50).',
        },
      ],
    }),
  },

  T12: {
    id: 'T12',
    name: 'A Fração Maior que Um',
    biome: 'fiorde_gelado',
    conceptId: 'fracao_impropria',
    codexSlug: 'fracoes-operacoes',
    legendary: false,
    summaryGatesPt: '× ³⁄₂  vs  ⚠ + 25',
    verifiedExamplePt: 'Com N = 60: ×³⁄₂ leva a 90, enquanto +25 leva a 85.',
    intuitionTrapPt: 'Ao ver uma fração, o jogador pensa automaticamente em "pedacinho menor que 1".',
    luzGuiaPt: 'Olhe o numerador: ³⁄₂ vale 1 inteiro mais metade (1,5×)!',
    isValidForArmy: (n) => n >= 30,
    buildSegment: (n, _randFloat, laneCount) => {
      const addA = Math.max(10, Math.floor(n * 0.35))
      const gFrac = makeGate('t12-frac', '×', 1.5, 3, 2, '× ³⁄₂', true)
      const gAdd = makeGate('t12-add', '+', addA, addA, 1, `+ ${addA}`)
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gAdd], [gFrac]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t12-mid', '+', Math.max(5, Math.floor(addA * 0.5)), Math.max(5, Math.floor(addA * 0.5)), 1, `+ ${Math.max(5, Math.floor(addA * 0.5))}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Quanto é 40 × ³⁄₂?',
      stepByStepPt: 'Metade de 40 é 20 (1/2). Três metades (3/2) valem 3 × 20 = 60!',
      guidedWalkthroughPt: 'Passo 1: Divida 40 por 2 (= 20).\nPasso 2: Multiplique por 3 (= 60)!',
      choices: [
        {
          id: 'c1',
          label: '20',
          value: 20,
          isCorrect: false,
          diagnosticPt: '20 é apenas 1 metade (40 × ½), mas a fração pede 3 metades (³⁄₂)!',
        },
        {
          id: 'c2',
          label: '60',
          value: 60,
          isCorrect: true,
          diagnosticPt: 'Exato! 40 ÷ 2 = 20, e 20 × 3 = 60 soldados.',
        },
        {
          id: 'c3',
          label: '120',
          value: 120,
          isCorrect: false,
          diagnosticPt: '120 é 40 × 3, faltou dividir pelo denominador 2!',
        },
      ],
    }),
  },

  T13: {
    id: 'T13',
    name: 'A Precedência Escondida',
    biome: 'fiorde_gelado',
    conceptId: 'precedencia_operacoes',
    codexSlug: 'expressoes-numericas-trincheira',
    legendary: false,
    summaryGatesPt: '⚠ + 3 × 3  vs  × 2',
    verifiedExamplePt: 'Com N = 20: N + 3 × 3 = 20 + 9 = 29 (não 69!), enquanto ×2 dá 40.',
    intuitionTrapPt: 'Ler da esquerda para a direita sem respeitar a hierarquia faz pensar em (N + 3) × 3.',
    luzGuiaPt: 'Na expressão + 3 × 3, a multiplicação acontece antes da soma (+ 9)!',
    isValidForArmy: (n) => n >= 14,
    buildSegment: (n, _randFloat, laneCount) => {
      const k = Math.max(3, Math.floor(Math.sqrt(n * 0.55)))
      const prod = k * k
      const gExpr = makeGate('t13-expr', '+', prod, prod, 1, `+ ${k} × ${k}`, true, 'add_mul', k)
      const gMul = makeGate('t13-mul', '×', 2, 2, 1, '× 2')
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gExpr], [gMul]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t13-mid', '+', prod + 1, prod + 1, 1, `+ ${prod + 1}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Pela hierarquia das operações, quanto vale 10 + 2 × 5?',
      stepByStepPt: 'Multiplicação tem prioridade sobre adição: 2 × 5 = 10, e depois 10 + 10 = 20.',
      guidedWalkthroughPt: 'Resolvemos primeiro o produto 2 × 5 = 10. Depois somamos ao 10 inicial: 10 + 10 = 20!',
      choices: [
        {
          id: 'c1',
          label: '17',
          value: 17,
          isCorrect: false,
          diagnosticPt: 'Você somou 10 + 2 + 5 = 17, mas o segundo sinal é de multiplicação (×)!',
        },
        {
          id: 'c2',
          label: '20',
          value: 20,
          isCorrect: true,
          diagnosticPt: 'Perfeito! 2 × 5 = 10 primeiro, depois 10 + 10 = 20.',
        },
        {
          id: 'c3',
          label: '60',
          value: 60,
          isCorrect: false,
          diagnosticPt: '60 seria (10 + 2) × 5 com parênteses. Sem parênteses, a multiplicação vem antes!',
        },
      ],
    }),
  },

  T15: {
    id: 'T15',
    name: 'O Resto Perdido',
    biome: 'fiorde_gelado',
    conceptId: 'divisao_euclidiana_resto',
    codexSlug: 'segredo-divisores',
    legendary: false,
    summaryGatesPt: '⚠ ÷ 3  vs  − 6',
    verifiedExamplePt: 'Com N = 10: 10 ÷ 3 = 3 (resto 1 vai para a Mina do Resto), enquanto 10 − 6 = 4.',
    intuitionTrapPt: 'Tirar 6 de 10 parece agressivo demais, fazendo o ÷3 parecer mais suave do que realmente é.',
    luzGuiaPt: 'Quantos grupos inteiros de 3 cabem no seu exército atual?',
    isValidForArmy: (n) => n >= 10,
    buildSegment: (n, _randFloat, laneCount) => {
      const subVal = Math.max(4, Math.floor(n * 0.52))
      const gDiv = makeGate('t15-div', '÷', 3, 3, 1, '÷ 3')
      const gSub = makeGate('t15-sub', '−', subVal, subVal, 1, `− ${subVal}`)
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gDiv], [gSub]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t15-mid', '−', subVal + 1, subVal + 1, 1, `− ${subVal + 1}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Na divisão inteira 17 ÷ 5, quantos grupos completos de 5 soldados ficam na ponte?',
      stepByStepPt: '3 × 5 = 15 (cabem 3 grupos inteiros) e sobram 2 soldados de resto para a Mina do Resto!',
      guidedWalkthroughPt: '5 × 3 = 15 (cabe em 17). 5 × 4 = 20 (passou de 17). Logo, ficam 3 soldados inteiros!',
      choices: [
        {
          id: 'c1',
          label: '3',
          value: 3,
          isCorrect: true,
          diagnosticPt: 'Exato! 17 = 5 × 3 + 2. Ficam 3 na ponte e o resto 2 vai para a Mina do Resto!',
        },
        {
          id: 'c2',
          label: '3,4',
          value: 3.4,
          isCorrect: false,
          diagnosticPt: 'Soldados na ponte são sempre inteiros! Os 2 que sobram vão para a Mina do Resto.',
        },
        {
          id: 'c3',
          label: '4',
          value: 4,
          isCorrect: false,
          diagnosticPt: 'Para formar 4 grupos de 5 seriam necessários 20 soldados (faltam 3).',
        },
      ],
    }),
  },

  // ── BIOMA 3: DESERTO DOS DECIMAIS ─────────────────────────────────────────
  T04: {
    id: 'T04',
    name: 'O Decimal Disfarçado',
    biome: 'deserto_decimais',
    conceptId: 'multiplicacao_decimal',
    codexSlug: 'dizima',
    legendary: false,
    summaryGatesPt: '⚠ × 0,9  vs  + 5',
    verifiedExamplePt: 'Com N = 100: ×0,9 encolhe para 90, enquanto +5 sobe para 105.',
    intuitionTrapPt: 'O dígito 9 chama atenção e o símbolo × promete multiplicação, escondendo que 0,9 < 1.',
    luzGuiaPt: '0,9 é nove décimos (90%) — um pouco MENOS que 1 inteiro!',
    isValidForArmy: (n) => n >= 20,
    buildSegment: (n, _randFloat, laneCount) => {
      const addVal = Math.max(5, Math.floor(n * 0.08))
      const gDec = makeGate('t04-dec', '×', 0.9, 9, 10, '× 0,9', true)
      const gAdd = makeGate('t04-add', '+', addVal, addVal, 1, `+ ${addVal}`)
      const midAdd = Math.max(2, Math.floor(addVal * 0.5))
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gDec], [gAdd]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t04-mid', '+', midAdd, midAdd, 1, `+ ${midAdd}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Quanto é 200 × 0,9?',
      stepByStepPt: '0,9 equivale a 9/10 (90%). Um décimo de 200 é 20, então 9 décimos valem 9 × 20 = 180!',
      guidedWalkthroughPt: 'Tire 1 décimo (20) de 200: 200 − 20 = 180!',
      choices: [
        {
          id: 'c1',
          label: '180',
          value: 180,
          isCorrect: true,
          diagnosticPt: 'Cálculo cristalino! 200 × 0,9 = 180 (redução de 10%).',
        },
        {
          id: 'c2',
          label: '190',
          value: 190,
          isCorrect: false,
          diagnosticPt: '190 seria tirar 10 unidades fixas, mas ×0,9 tira 10% de 200 (= 20).',
        },
        {
          id: 'c3',
          label: '209',
          value: 209,
          isCorrect: false,
          diagnosticPt: 'Multiplicar por número menor que 1 diminui o valor em vez de somar 9!',
        },
      ],
    }),
  },

  T08: {
    id: 'T08',
    name: 'A Porcentagem Ioiô',
    biome: 'deserto_decimais',
    conceptId: 'assimetria_porcentagem',
    codexSlug: 'magica-porcentagem',
    legendary: false,
    summaryGatesPt: '⚠ (− 50% → + 50%)  vs  − 15',
    verifiedExamplePt: 'Com N = 200: perder 50% (100) e ganhar +50% (150) deixa menos que 200 − 20 = 180.',
    intuitionTrapPt: 'Parece que −50% e +50% se cancelam e devolvem 100% do exército.',
    luzGuiaPt: 'O +50% é calculado sobre a metade que sobrou, não sobre o exército original!',
    isValidForArmy: (n) => n >= 40,
    buildSegment: (n, _randFloat, laneCount) => {
      const subVal = Math.max(5, Math.floor(n * 0.1))
      const laneA = [
        makeGate('t08-a1', '%−', 50, 1, 2, '− 50%', true),
        makeGate('t08-a2', '%+', 50, 3, 2, '+ 50%', true),
      ]
      const laneB = [makeGate('t08-b1', '−', subVal, subVal, 1, `− ${subVal}`)]
      const midSub = subVal + 3
      return ensureTrapLaneCardinality(
        {
          kind: 'chain',
          lanes: [laneA, laneB],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t08-mid', '−', midSub, midSub, 1, `− ${midSub}`),
      )
    },
    buildRedemption: () => ({
      questionPt: '100 soldados passam por "−50%" e em seguida por "+50%". Quantos soldados ficam?',
      stepByStepPt: '100 − 50% = 50 soldados. Depois, +50% de 50 adiciona +25 → total de 75 soldados!',
      guidedWalkthroughPt: 'Passo 1: Metade de 100 é 50.\nPasso 2: Metade de 50 é 25.\nPasso 3: 50 + 25 = 75!',
      choices: [
        {
          id: 'c1',
          label: '50',
          value: 50,
          isCorrect: false,
          diagnosticPt: '50 é o valor após o primeiro portão (−50%), antes de somar a metade de 50.',
        },
        {
          id: 'c2',
          label: '75',
          value: 75,
          isCorrect: true,
          diagnosticPt: 'Isso! 0,5 × 1,5 = 0,75 (75%). As bases das porcentagens são diferentes!',
        },
        {
          id: 'c3',
          label: '100',
          value: 100,
          isCorrect: false,
          diagnosticPt: 'Para voltar de 50 para 100 seria necessário +100% (dobrar), não +50%!',
        },
      ],
    }),
  },

  T14: {
    id: 'T14',
    name: 'A Divisão pelo Quase-Um',
    biome: 'deserto_decimais',
    conceptId: 'divisao_decimal',
    codexSlug: 'fracoes-operacoes',
    legendary: false,
    summaryGatesPt: '⚠ ÷ 1,25  vs  − 10',
    verifiedExamplePt: 'Com N = 100: ÷1,25 reduz para 80, enquanto −10 deixa 90.',
    intuitionTrapPt: 'Como 1,25 parece pertinho de 1, a intuição subestima o corte de 20% que ele provoca.',
    luzGuiaPt: '1,25 é ⁵⁄₄. Dividir por ⁵⁄₄ é o mesmo que multiplicar por ⁴⁄₅ (ficar com 80%)!',
    isValidForArmy: (n) => n >= 40,
    buildSegment: (n, _randFloat, laneCount) => {
      const subVal = Math.max(4, Math.floor(n * 0.1))
      const gDivDec = makeGate('t14-div', '÷', 1.25, 5, 4, '÷ 1,25', true)
      const gSub = makeGate('t14-sub', '−', subVal, subVal, 1, `− ${subVal}`)
      const midSub = subVal + 3
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gDivDec], [gSub]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t14-mid', '−', midSub, midSub, 1, `− ${midSub}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Quanto é 200 ÷ 1,25?',
      stepByStepPt: '1,25 = 5/4. Dividir 200 por 5/4 é calcular 200 × 4 ÷ 5 = 160!',
      guidedWalkthroughPt: 'Dica rápida: multiplique os dois lados por 4 → 800 ÷ 5 = 160!',
      choices: [
        {
          id: 'c1',
          label: '160',
          value: 160,
          isCorrect: true,
          diagnosticPt: 'Perfeito! 200 ÷ (5/4) = 200 × 4/5 = 160.',
        },
        {
          id: 'c2',
          label: '175',
          value: 175,
          isCorrect: false,
          diagnosticPt: '175 seria subtrair 25, mas ÷1,25 retira 20% de 200 (= 40).',
        },
        {
          id: 'c3',
          label: '250',
          value: 250,
          isCorrect: false,
          diagnosticPt: '250 seria multiplicar 200 × 1,25, mas o portão é de divisão (÷)!',
        },
      ],
    }),
  },

  T16: {
    id: 'T16',
    name: 'A Porcentagem Gigante',
    biome: 'deserto_decimais',
    conceptId: 'porcentagem_acumulada',
    codexSlug: 'magica-porcentagem',
    legendary: false,
    summaryGatesPt: '+ 200%  vs  ⚠ × 2',
    verifiedExamplePt: 'Com N = 100: +200% soma 200 aos 100 existentes (= 300), enquanto ×2 dá 200.',
    intuitionTrapPt: 'Muitos confundem "200% de N" com "N + 200%", achando que +200% apenas dobra.',
    luzGuiaPt: 'Ganhar +200% significa manter os seus 100% e ganhar MAIS duas vezes o exército (×3)!',
    isValidForArmy: (n) => n >= 10,
    buildSegment: (_n, _randFloat, laneCount) => {
      const gPct = makeGate('t16-pct', '%+', 200, 3, 1, '+ 200%', true)
      const gMul = makeGate('t16-mul', '×', 2, 2, 1, '× 2')
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gMul], [gPct]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t16-mid', '%+', 150, 5, 2, '+ 150%', true),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Se você tem 50 soldados e passa pelo portão "+ 300%", com quantos soldados fica?',
      stepByStepPt: '+300% de 50 são 3 × 50 = +150 soldados novos. Somados aos 50 iniciais: 50 + 150 = 200!',
      guidedWalkthroughPt: 'Você já tem 50 (100%) e ganha mais 3 × 50 (300% = 150). Total: 50 + 150 = 200!',
      choices: [
        {
          id: 'c1',
          label: '150',
          value: 150,
          isCorrect: false,
          diagnosticPt: '150 é o quanto você GANHA (+300%), mas você também mantém os 50 soldados que já tinha!',
        },
        {
          id: 'c2',
          label: '200',
          value: 200,
          isCorrect: true,
          diagnosticPt: 'Exato! N + 300% de N = 4 × N = 200 soldados.',
        },
        {
          id: 'c3',
          label: '350',
          value: 350,
          isCorrect: false,
          diagnosticPt: '350 seria somar 300 soldados fixos, mas 300% é proporcional aos seus 50 soldados!',
        },
      ],
    }),
  },

  T17: {
    id: 'T17',
    name: 'O Mil Disfarçado',
    biome: 'deserto_decimais',
    conceptId: 'notacao_milhar',
    codexSlug: 'aritmetica-elegante-01',
    legendary: false,
    summaryGatesPt: '⚠ + 1k  vs  × 1,5',
    verifiedExamplePt: 'Com N = 4k (4.000): +1k leva a 5k, enquanto ×1,5 leva a 6k.',
    intuitionTrapPt: 'O sufixo "1k" (mil!) parece muito mais imponente do que o número decimal "1,5".',
    luzGuiaPt: 'Multiplicar por 1,5 é ganhar metade do seu exército atual (+50%). Compare metade do seu exército com 1k!',
    isValidForArmy: (n) => n >= 60,
    buildSegment: (n, _randFloat, laneCount) => {
      const addVal = Math.max(20, Math.floor(n * 0.25))
      const labelAdd = addVal >= 1000 && addVal % 1000 === 0 ? `+ ${addVal / 1000}k` : `+ ${addVal}`
      const gAdd = makeGate('t17-add', '+', addVal, addVal, 1, labelAdd)
      const gMul = makeGate('t17-mul', '×', 1.5, 3, 2, '× 1,5', true)
      const midAdd = Math.max(10, Math.floor(addVal * 0.6))
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gAdd], [gMul]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t17-mid', '+', midAdd, midAdd, 1, `+ ${midAdd}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Com quantos soldados os portões "+ 1k" (1.000) e "× 1,5" dão exatamente EMPATE?',
      stepByStepPt: 'Multiplicar por 1,5 acrescenta metade (0,5 × N). Para metade de N valer 1k, N precisa ser 2k!',
      guidedWalkthroughPt: 'Qual número tem metade igual a 1k? O dobro de 1k é 2k (2.000)!',
      choices: [
        {
          id: 'c1',
          label: '1k',
          value: 1000,
          isCorrect: false,
          diagnosticPt: 'Com 1k, ×1,5 dá 1,5k, enquanto +1k dá 2k.',
        },
        {
          id: 'c2',
          label: '2k',
          value: 2000,
          isCorrect: true,
          diagnosticPt: 'Perfeito! 2k + 1k = 3k e 2k × 1,5 = 3k. Acima de 2k, o ×1,5 sempre vence!',
        },
        {
          id: 'c3',
          label: '3k',
          value: 3000,
          isCorrect: false,
          diagnosticPt: '3k é o exército depois de passar pelos portões no ponto de empate.',
        },
      ],
    }),
  },

  // ── BIOMAS V2: VULCÃO DOS NEGATIVOS & TORRE DAS POTÊNCIAS ─────────────────
  T05: {
    id: 'T05',
    name: 'O Expoente Zero',
    biome: 'torre_potencias',
    conceptId: 'expoente_zero',
    codexSlug: 'regra-de-ouro-1',
    legendary: true,
    summaryGatesPt: '⚠ ^ 0  vs  ÷ 2',
    verifiedExamplePt: 'Com N = 200: N^0 colapsa todo o exército para 1 soldado, enquanto ÷2 preserva 100!',
    intuitionTrapPt: 'O símbolo de potência (^) sugere crescimento explosivo, ocultando que qualquer base elevada a zero vale 1.',
    luzGuiaPt: 'Pegadinha Lendária! Qualquer número positivo elevado a 0 se reduz a apenas 1!',
    isValidForArmy: (n) => n >= 10,
    buildSegment: (_n, _randFloat, laneCount) => {
      const gPow0 = makeGate('t05-pow0', '^', 0, 0, 1, '^ 0', true)
      const gDiv2 = makeGate('t05-div2', '÷', 2, 2, 1, '÷ 2')
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gPow0], [gDiv2]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t05-mid', '÷', 3, 3, 1, '÷ 3'),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Quanto vale 7.000⁰ (sete mil elevado a zero)?',
      stepByStepPt: 'Por definição das potências (aⁿ ÷ aⁿ = a⁰ = 1), todo número não-nulo elevado a 0 vale 1!',
      guidedWalkthroughPt: 'Qualquer número (mesmo 7.000) dividido por ele mesmo dá 1. Por isso 7.000⁰ = 1!',
      choices: [
        {
          id: 'c1',
          label: '0',
          value: 0,
          isCorrect: false,
          diagnosticPt: 'Multiplicar por 0 dá 0, mas elevar ao expoente 0 resulta sempre em 1!',
        },
        {
          id: 'c2',
          label: '1',
          value: 1,
          isCorrect: true,
          diagnosticPt: 'Exato! Todo número não-nulo elevado a zero é igual a 1.',
        },
        {
          id: 'c3',
          label: '7.000',
          value: 7000,
          isCorrect: false,
          diagnosticPt: '7.000 seria o resultado de 7.000¹ (expoente 1).',
        },
      ],
    }),
  },

  T06: {
    id: 'T06',
    name: 'O Quadrado Preguiçoso',
    biome: 'torre_potencias',
    conceptId: 'crescimento_quadratico',
    codexSlug: 'quadrados-perfeitos-ajustes',
    legendary: false,
    summaryGatesPt: '⚠ ²  vs  + 10 (quando N é pequeno)',
    verifiedExamplePt: 'Com N = 3: 3² = 9, enquanto 3 + 10 = 13.',
    intuitionTrapPt: 'Elevar ao quadrado parece imbatível, mas para números pequenos uma boa soma vence.',
    luzGuiaPt: 'Elevar ao quadrado é multiplicar N × N. Com exército pequeno, compare N × N com a soma!',
    isValidForArmy: (n) => n >= 2 && n <= 8,
    buildSegment: (n, _randFloat, laneCount) => {
      const addVal = Math.max(10, n * n - n + 4)
      const gSq = makeGate('t06-sq', '^', 2, 2, 1, '²', true)
      const gAdd = makeGate('t06-add', '+', addVal, addVal, 1, `+ ${addVal}`)
      const midAdd = Math.max(5, addVal - 3)
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gSq], [gAdd]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t06-mid', '+', midAdd, midAdd, 1, `+ ${midAdd}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Com quantos soldados positivos os portões "²" (ao quadrado) e "+ 12" empatam?',
      stepByStepPt: 'Testando: 3² = 9 vs 3+12 = 15; 4² = 16 e 4 + 12 = 16! Empatam com 4 soldados.',
      guidedWalkthroughPt: 'Calcule 4 × 4 = 16 e 4 + 12 = 16. O empate acontece em 4!',
      choices: [
        {
          id: 'c1',
          label: '3',
          value: 3,
          isCorrect: false,
          diagnosticPt: 'Com 3 soldados, 3² = 9 ainda perde para 3 + 12 = 15.',
        },
        {
          id: 'c2',
          label: '4',
          value: 4,
          isCorrect: true,
          diagnosticPt: 'Exato! 4² = 16 e 4 + 12 = 16.',
        },
        {
          id: 'c3',
          label: '6',
          value: 6,
          isCorrect: false,
          diagnosticPt: 'Com 6 soldados, 6² = 36 já supera 6 + 12 = 18 por muito!',
        },
      ],
    }),
  },

  T09: {
    id: 'T09',
    name: 'Menos com Menos',
    biome: 'vulcao_negativos',
    conceptId: 'subtracao_negativo',
    codexSlug: 'matematica-sinais-peso-alivio',
    legendary: false,
    summaryGatesPt: '− (−30)  vs  ⚠ + 20',
    verifiedExamplePt: 'Com N = 50: 50 − (−30) = 80, enquanto 50 + 20 = 70.',
    intuitionTrapPt: 'Dois sinais de menos assustam o jogador, que corre para o conforto do +20.',
    luzGuiaPt: 'Retirar uma dívida (subtrair um negativo) equivale a SOMAR esse valor!',
    isValidForArmy: (n) => n >= 10,
    buildSegment: (n, _randFloat, laneCount) => {
      const gainNeg = Math.max(15, Math.floor(n * 0.6))
      const gainPos = Math.max(10, Math.floor(gainNeg * 0.65))
      const gSubNeg = makeGate('t09-subneg', '+', gainNeg, gainNeg, 1, `− (−${gainNeg})`, true, 'sub_neg')
      const gAdd = makeGate('t09-add', '+', gainPos, gainPos, 1, `+ ${gainPos}`)
      const midAdd = Math.max(5, gainPos - 2)
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gAdd], [gSubNeg]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t09-mid', '+', midAdd, midAdd, 1, `+ ${midAdd}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Quanto vale 40 − (−15)?',
      stepByStepPt: 'Subtrair −15 é cancelar um peso negativo de 15: 40 + 15 = 55!',
      guidedWalkthroughPt: 'Menos com menos na subtração vira soma: 40 + 15 = 55!',
      choices: [
        {
          id: 'c1',
          label: '−55',
          value: -55,
          isCorrect: false,
          diagnosticPt: 'Você começou com +40 e tirou uma dívida de 15; o resultado é positivo!',
        },
        {
          id: 'c2',
          label: '25',
          value: 25,
          isCorrect: false,
          diagnosticPt: '25 seria 40 − 15, mas estamos subtraindo um número negativo (−15)!',
        },
        {
          id: 'c3',
          label: '55',
          value: 55,
          isCorrect: true,
          diagnosticPt: 'Perfeito! Tirar um peso negativo (−(−15)) alivia e soma +15 → 55!',
        },
      ],
    }),
  },

  T10: {
    id: 'T10',
    name: 'A Raiz que Encolhe',
    biome: 'torre_potencias',
    conceptId: 'raiz_quadrada',
    codexSlug: 'quadrados-perfeitos-ajustes',
    legendary: false,
    summaryGatesPt: '⚠ √  vs  − 85',
    verifiedExamplePt: 'Com N = 100: √100 = 10, enquanto 100 − 85 = 15.',
    intuitionTrapPt: 'O símbolo radical √ parece tecnológico e menos ameaçador que perder 85 soldados.',
    luzGuiaPt: 'A raiz quadrada busca o número que multiplicado por si mesmo dá N (√100 = 10)!',
    isValidForArmy: (n) => n >= 64,
    buildSegment: (n, _randFloat, laneCount) => {
      const root = Math.floor(Math.sqrt(n))
      const targetAfterSub = Math.min(n - 1, Math.floor(root * 1.45))
      const subVal = Math.max(1, n - targetAfterSub)
      const gSqrt = makeGate('t10-sqrt', '√', 2, 1, 2, '√N', true)
      const gSub = makeGate('t10-sub', '−', subVal, subVal, 1, `− ${subVal}`)
      const midSub = Math.min(n - 1, subVal + 2)
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gSqrt], [gSub]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t10-mid', '−', midSub, midSub, 1, `− ${midSub}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Quanto vale √144?',
      stepByStepPt: '12 × 12 = 144, portanto a raiz quadrada de 144 é 12!',
      guidedWalkthroughPt: '10 × 10 = 100; 12 × 12 = 144. Logo, √144 = 12!',
      choices: [
        {
          id: 'c1',
          label: '12',
          value: 12,
          isCorrect: true,
          diagnosticPt: 'Exato! 12 × 12 = 144.',
        },
        {
          id: 'c2',
          label: '14',
          value: 14,
          isCorrect: false,
          diagnosticPt: '14 × 14 = 196, que passa de 144.',
        },
        {
          id: 'c3',
          label: '72',
          value: 72,
          isCorrect: false,
          diagnosticPt: '72 é a metade de 144 (144 ÷ 2), não a raiz quadrada!',
        },
      ],
    }),
  },

  T11: {
    id: 'T11',
    name: 'A Notação Traiçoeira',
    biome: 'torre_potencias',
    conceptId: 'potencia_base_dez',
    codexSlug: 'regra-de-ouro-2',
    legendary: false,
    summaryGatesPt: '⚠ × 10⁻¹  vs  ÷ 5',
    verifiedExamplePt: 'Com N = 500: ×10⁻¹ divide por 10 (= 50), enquanto ÷5 deixa 100.',
    intuitionTrapPt: 'Ver "× 10" faz pensar que o exército vai multiplicar por dez, ignorando o expoente −1.',
    luzGuiaPt: '10⁻¹ é o inverso de 10 (¹⁄₁₀ = 0,1). Multiplicar por 10⁻¹ é dividir por 10!',
    isValidForArmy: (n) => n >= 30,
    buildSegment: (_n, _randFloat, laneCount) => {
      const gSci = makeGate('t11-sci', '×', 0.1, 1, 10, '× 10⁻¹', true)
      const gDiv5 = makeGate('t11-div5', '÷', 5, 5, 1, '÷ 5')
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gSci], [gDiv5]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t11-mid', '÷', 6, 6, 1, '÷ 6'),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Quanto vale 3.000 × 10⁻²?',
      stepByStepPt: '10⁻² = 1/100 (desloca a vírgula 2 casas para a esquerda): 3.000 ÷ 100 = 30!',
      guidedWalkthroughPt: 'Expoente −2 corta dois zeros de 3.000 → sobram 30!',
      choices: [
        {
          id: 'c1',
          label: '30',
          value: 30,
          isCorrect: true,
          diagnosticPt: 'Perfeito! 3.000 ÷ 100 = 30.',
        },
        {
          id: 'c2',
          label: '300',
          value: 300,
          isCorrect: false,
          diagnosticPt: '300 seria 3.000 × 10⁻¹ (cortando apenas um zero).',
        },
        {
          id: 'c3',
          label: '300.000',
          value: 300000,
          isCorrect: false,
          diagnosticPt: '300.000 seria com expoente positivo (× 10²), mas o expoente é negativo (−2)!',
        },
      ],
    }),
  },

  T18: {
    id: 'T18',
    name: 'O Inversor Duplo',
    biome: 'vulcao_negativos',
    conceptId: 'produto_sinais',
    codexSlug: 'regras-de-ouro-negativos',
    legendary: false,
    summaryGatesPt: '× (−1)·(−1)  vs  ⚠ − 10',
    verifiedExamplePt: 'Com N = 50: ×(−1)·(−1) = ×1 mantém todos os 50 soldados, enquanto −10 reduz para 40.',
    intuitionTrapPt: 'Dois números negativos assustam, mas (−1) × (−1) = +1 preserva 100% do exército!',
    luzGuiaPt: 'Duas inversões seguidas se anulam: (−1) × (−1) = +1!',
    isValidForArmy: (n) => n >= 20,
    buildSegment: (n, _randFloat, laneCount) => {
      const subVal = Math.max(5, Math.floor(n * 0.2))
      const gDoubleNeg = makeGate('t18-dneg', '×', 1, 1, 1, '× (−1)·(−1)', true, 'double_neg_mul')
      const gSub = makeGate('t18-sub', '−', subVal, subVal, 1, `− ${subVal}`)
      const midSub = Math.max(2, Math.floor(subVal * 0.5))
      return ensureTrapLaneCardinality(
        {
          kind: 'pair',
          lanes: [[gSub], [gDoubleNeg]],
          intuitiveLane: 0,
          betterLane: 1,
        },
        laneCount,
        makeGate('t18-mid', '−', midSub, midSub, 1, `− ${midSub}`),
      )
    },
    buildRedemption: () => ({
      questionPt: 'Quanto vale (−2) × (−3) × 10?',
      stepByStepPt: '(−2) × (−3) = +6 (menos com menos na multiplicação dá mais). Depois, 6 × 10 = 60!',
      guidedWalkthroughPt: 'Passo 1: (−2) × (−3) = +6.\nPasso 2: 6 × 10 = 60!',
      choices: [
        {
          id: 'c1',
          label: '−60',
          value: -60,
          isCorrect: false,
          diagnosticPt: 'Há DOIS fatores negativos (−2 e −3); um par de negativos resulta em positivo!',
        },
        {
          id: 'c2',
          label: '50',
          value: 50,
          isCorrect: false,
          diagnosticPt: 'As operações são todas multiplicações: 2 × 3 × 10 = 60.',
        },
        {
          id: 'c3',
          label: '60',
          value: 60,
          isCorrect: true,
          diagnosticPt: 'Exato! (−2) × (−3) = +6, e +6 × 10 = +60.',
        },
      ],
    }),
  },
}

export const TWIN_CATALOG: Record<TwinId, TwinCatalogEntry> = {
  G01: {
    id: 'G01',
    name: 'Inverso Quarto',
    equivalencePt: '× ¼  =  ÷ 4 (multiplicar por um quarto é dividir por 4)',
    codexSlug: 'fracoes-operacoes',
    buildLanes: (laneCount) => {
      const lanes: Gate[][] = [
        [makeGate('g01-a', '×', 0.25, 1, 4, '× ¼', true)],
        [makeGate('g01-b', '÷', 4, 4, 1, '÷ 4')],
      ]
      if (laneCount === 3) {
        lanes.push([makeGate('g01-c', '÷', 4, 4, 1, '÷ 4')])
      }
      return lanes
    },
  },
  G02: {
    id: 'G02',
    name: 'Meio Decimal',
    equivalencePt: '× 0,5  =  ÷ 2 (cinco décimos é exatamente metade)',
    codexSlug: 'dizima',
    buildLanes: (laneCount) => {
      const lanes: Gate[][] = [
        [makeGate('g02-a', '×', 0.5, 1, 2, '× 0,5', true)],
        [makeGate('g02-b', '÷', 2, 2, 1, '÷ 2')],
      ]
      if (laneCount === 3) {
        lanes.push([makeGate('g02-c', '×', 0.5, 1, 2, '× ½', true)])
      }
      return lanes
    },
  },
  G03: {
    id: 'G03',
    name: 'Mais Metade',
    equivalencePt: '+ 50%  =  × 1,5 (acrescentar 50% equivale a multiplicar por 1,5)',
    codexSlug: 'magica-porcentagem',
    buildLanes: (laneCount) => {
      const lanes: Gate[][] = [
        [makeGate('g03-a', '%+', 50, 3, 2, '+ 50%', true)],
        [makeGate('g03-b', '×', 1.5, 3, 2, '× 1,5', true)],
      ]
      if (laneCount === 3) {
        lanes.push([makeGate('g03-c', '×', 1.5, 3, 2, '× ³⁄₂', true)])
      }
      return lanes
    },
  },
  G04: {
    id: 'G04',
    name: 'Salto do Quilo',
    equivalencePt: '× 10³  =  × 1k (dez ao cubo é exatamente mil)',
    codexSlug: 'aritmetica-elegante-01',
    buildLanes: (laneCount) => {
      const lanes: Gate[][] = [
        [makeGate('g04-a', '×', 1000, 1000, 1, '× 10³', true)],
        [makeGate('g04-b', '×', 1000, 1000, 1, '× 1k')],
      ]
      if (laneCount === 3) {
        lanes.push([makeGate('g04-c', '×', 1000, 1000, 1, '× 1.000')])
      }
      return lanes
    },
  },
  G05: {
    id: 'G05',
    name: 'Espelho da Metade',
    equivalencePt: '÷ ½  =  × 2 (dividir por meio é dobrar)',
    codexSlug: 'fracoes-operacoes',
    buildLanes: (laneCount) => {
      const lanes: Gate[][] = [
        [makeGate('g05-a', '÷', 0.5, 1, 2, '÷ ½', true)],
        [makeGate('g05-b', '×', 2, 2, 1, '× 2')],
      ]
      if (laneCount === 3) {
        lanes.push([makeGate('g05-c', '%+', 100, 2, 1, '+ 100%', true)])
      }
      return lanes
    },
  },
  G06: {
    id: 'G06',
    name: 'Corte Gêmeo',
    equivalencePt: '− 50%  =  × ½ (descontar 50% é ficar com metade)',
    codexSlug: 'magica-porcentagem',
    buildLanes: (laneCount) => {
      const lanes: Gate[][] = [
        [makeGate('g06-a', '%−', 50, 1, 2, '− 50%', true)],
        [makeGate('g06-b', '×', 0.5, 1, 2, '× ½', true)],
      ]
      if (laneCount === 3) {
        lanes.push([makeGate('g06-c', '÷', 2, 2, 1, '÷ 2')])
      }
      return lanes
    },
  },
}

export const ALL_TRAP_LIST: readonly TrapCatalogEntry[] = Object.values(TRAP_CATALOG)
export const ALL_TWIN_LIST: readonly TwinCatalogEntry[] = Object.values(TWIN_CATALOG)
export const TRAP_LIST: readonly TrapCatalogEntry[] = ALL_TRAP_LIST
export const TWIN_LIST: readonly TwinCatalogEntry[] = ALL_TWIN_LIST

