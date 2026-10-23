import {
  ArithmeticOp,
  GameMode,
  MathChoice,
  MiraclePowerTier,
  MiracleTierSpec,
  PieceType,
  ProblemTier,
  TetrisMathChallenge,
  TetrisMathLensId,
} from '../types'
import { getPieceDefinition } from './tetrominoes'

export const MIRACLE_TIER_SPECS: Record<MiraclePowerTier, MiracleTierSpec> = {
  1: {
    tier: 1,
    icon: '⚡',
    badge: '⚡ Grau I',
    shortLabel: '3 Buracos',
    shortLabelPt: '3 Buracos',
    title: 'Centelha Ágil (Até 3 Buracos)',
    titlePt: 'Grau I · 3 Buracos',
    rewardPt: 'Tapa até 3 buracos (+150 pts/buraco)',
    descriptionClassic: 'Tapa até 3 buracos soterrados (+150 pts/buraco)',
    descriptionTactile: 'Preenche até 3 casas na Linha ou Coluna H×V (+450 pts)',
    descriptionFruit: 'Colapsa 1 espécie de fruta ou forja 2 Estrelas Coringa (+450 pts)',
    maxHolesToSeal: 3,
    bonusScore: 0,
    grantsPhoenixShield: false,
    mathPreview: 'Amigos do 10, Massinha ou Relógio ×5 Rápido',
    hotkey: 'F1',
  },
  2: {
    tier: 2,
    icon: '🔥',
    badge: '🔥 Grau II',
    shortLabel: '5 Buracos',
    shortLabelPt: '5 Buracos',
    title: 'Forja Dupla (Até 5 Buracos + 400 pts)',
    titlePt: 'Grau II · 5 Buracos',
    rewardPt: 'Tapa até 5 buracos de uma vez (+400 pts bônus)',
    descriptionClassic: 'Tapa até 5 buracos de uma só vez (+200 pts/buraco + 400 pts)',
    descriptionTactile: 'Fecha até 5 casas em Linha/Coluna H×V de uma vez (+600 pts)',
    descriptionFruit: 'Colapsa frutas + forja 2 Estrelas Coringa (+400 pts bônus)',
    maxHolesToSeal: 5,
    bonusScore: 400,
    grantsPhoenixShield: false,
    mathPreview: 'Dobra e Meia (18×15), Regra do 11 (43×11) ou Fator Comum (23×7 + 23×3)',
    hotkey: 'F2',
  },
  3: {
    tier: 3,
    icon: '🌟',
    badge: '🌟 Grau III',
    shortLabel: '10 Buracos',
    shortLabelPt: '10 Buracos',
    title: 'Supernova Simétrica (Até 10 Buracos + 1.000 pts)',
    titlePt: 'Grau III · 10 Buracos',
    rewardPt: 'Tapa até 10 buracos de uma vez (+1.000 pts bônus)',
    descriptionClassic: 'Tapa até 10 buracos de uma só vez (+1.000 pts e explode linhas fechadas!)',
    descriptionTactile: 'Cruzamento H×V: preenche até 10 casas em Linhas/Colunas (+1.200 pts)',
    descriptionFruit: 'Tempestade Solar: colapsa frutas + 3 Estrelas (+1.000 pts bônus)',
    maxHolesToSeal: 10,
    bonusScore: 1000,
    grantsPhoenixShield: false,
    mathPreview: 'Diferença de Quadrados (37 × 43), Quadrados de 5 (65²) ou Trincheira ((36×21)÷(7×9))',
    hotkey: 'F3',
  },
  4: {
    tier: 4,
    icon: '👑',
    badge: '👑 Grau IV',
    shortLabel: 'TODOS + 🛡️',
    shortLabelPt: 'TODOS + 🛡️',
    title: 'Gênesis Absoluto (TODOS os Buracos + 🛡️ Escudo Fênix!)',
    titlePt: 'Grau IV · TODOS + 🛡️ Fênix',
    rewardPt: 'Tapa TODOS os buracos + 2.500 pts + 🛡️ +1 Escudo Fênix!',
    descriptionClassic: 'Tapa TODOS os buracos soterrados do tabuleiro de uma vez +2.500 pts +1 Escudo Fênix!',
    descriptionTactile: 'Purificação Base-10 (até 20 casas H×V) +2.500 pts +1 Escudo Fênix!',
    descriptionFruit: 'Supernova do Pomar + 4 Estrelas Coringa +2.500 pts +1 Escudo Fênix!',
    maxHolesToSeal: 200,
    bonusScore: 2500,
    grantsPhoenixShield: true,
    mathPreview: 'Desafio Supremo: 53² − 47², 37×12 + 37×88, 32 × 125 ou Máquina do Tempo (3x − 5 = 31)',
    hotkey: 'F4',
  },
}

export function getMiracleTierSpec(tier: MiraclePowerTier): MiracleTierSpec {
  return MIRACLE_TIER_SPECS[tier] ?? MIRACLE_TIER_SPECS[1]
}

export function getAllMiracleTierSpecs(): MiracleTierSpec[] {
  return [MIRACLE_TIER_SPECS[1], MIRACLE_TIER_SPECS[2], MIRACLE_TIER_SPECS[3], MIRACLE_TIER_SPECS[4]]
}

export interface MathLensMetadata {
  lensId: TetrisMathLensId
  op: ArithmeticOp
  lensBadge: string
  titlePt: string
  corePrinciple: string
  relatedLessonSlug: string
}

/**
 * Canonical mapping of all 8 Heiss-Lab Lenses to their verified lesson slugs in `src/data/content.ts` (Melhoria 02-D).
 */
export const TETRIS_MATH_LENSES: Record<TetrisMathLensId, MathLensMetadata> = {
  massinha_soma: {
    lensId: 'massinha_soma',
    op: '+',
    lensBadge: '🧱 Massinha da Soma (+)',
    titlePt: 'A Massinha da Soma (Lei do Menor Esforço)',
    corePrinciple:
      'Na soma, você tira de um lado e entrega para o outro para fechar uma dezena redonda: a soma total permanece idêntica!',
    relatedLessonSlug: 'aritmetica-elegante-truques',
  },
  amigos_do_10_falta: {
    lensId: 'amigos_do_10_falta',
    op: '+',
    lensBadge: '⚖️ A Peça que Falta (Base 10)',
    titlePt: 'A Peça que Falta & Amigos do 10',
    corePrinciple:
      'Toda linha do Tetris tem 10 colunas. Descobrir quanto falta para 10 (ou para a próxima dezena) transforma qualquer buraco em equilíbrio visual.',
    relatedLessonSlug: 'equacao-balanca',
  },
  hack_japones: {
    lensId: 'hack_japones',
    op: '-',
    lensBadge: '🗡️ Hack Japonês (−)',
    titlePt: 'O Hack Japonês (O Subtraendo é o Rei)',
    corePrinciple:
      'Nunca peça emprestado! Some a mesma quantidade nos DOIS números até o segundo virar uma dezena redonda. A distância entre eles não muda!',
    relatedLessonSlug: 'aritmetica-elegante-01',
  },
  regra_elevador: {
    lensId: 'regra_elevador',
    op: '-',
    lensBadge: '🛗 Regra do Elevador (−)',
    titlePt: 'A Regra do Elevador & Peso/Alívio',
    corePrinciple:
      'Subtrair é medir a distância entre andares: suba até a dezena redonda mais próxima e depois até o andar final!',
    relatedLessonSlug: 'matematica-sinais-peso-alivio',
  },
  dobro_do_dobro_248: {
    lensId: 'dobro_do_dobro_248',
    op: 'x',
    lensBadge: '⚡ Dobro do Dobro (×2, ×4, ×8)',
    titlePt: 'A Base do Universo (Dobro do Dobro)',
    corePrinciple:
      'Multiplicar por 4 é dobrar duas vezes seguidas (×2 → ×2). Multiplicar por 8 é dobrar três vezes!',
    relatedLessonSlug: 'magia-calculo-mental-multiplicacao',
  },
  relogio_5_dobra_meia: {
    lensId: 'relogio_5_dobra_meia',
    op: 'x',
    lensBadge: '🔄 Dobra e Meia / Relógio ×5',
    titlePt: 'Dobrar e Meiar & O Relógio (×5)',
    corePrinciple:
      'Como transformar o quadrado O (2×2) na barra I (1×4): se você dobra um lado e corta o outro pela metade, a área permanece exatamente a mesma!',
    relatedLessonSlug: 'regra-de-ouro-2',
  },
  infinito_9_quadrados: {
    lensId: 'infinito_9_quadrados',
    op: 'x',
    lensBadge: '♾️ Truque do 9 & Quadrados (×)',
    titlePt: 'O Infinito que Completa (×9) & Diferença de Quadrados',
    corePrinciple:
      'Multiplicar por 9 é multiplicar por 10 e tirar 1 vez o número. E produtos simétricos ao redor de 10 ou 20 viram (Base² − Distância²)!',
    relatedLessonSlug: 'diferenca-quadrados-fator-comum',
  },
  corta_no_meio_div: {
    lensId: 'corta_no_meio_div',
    op: '÷',
    lensBadge: '✂️ Corta no Meio & Divisores (÷)',
    titlePt: 'Corta no Meio (÷2, ÷4, ÷8) & Senhores do Tempo',
    corePrinciple:
      'Dividir por 4 é achar a metade da metade. Dividir por 5 é dobrar o número e cortar o zero final!',
    relatedLessonSlug: 'segredo-divisores',
  },
}

interface RawDistractor {
  value: number
  trapDiagnosis: string
}

interface RawMathTemplate {
  id: string
  lensId: TetrisMathLensId
  tier: ProblemTier // 1 = Centelha (3 buracos), 2 = Forja (5 buracos), 3 = Supernova (10 buracos), 4 = Gênesis (TODOS!)
  expression: string
  correctAnswer: number
  shortHint: string
  stepByStep: string[]
  distractors: [RawDistractor, RawDistractor, RawDistractor]
  missingBlockResonance?: number // 1..9 when linked to row complement
  archetypeId?: string
}

const RAW_PROBLEM_BANK: ReadonlyArray<RawMathTemplate> = [
  // =========================================================================
  // LENTE 1: MASSINHA DA SOMA (+) — 'aritmetica-elegante-truques'
  // =========================================================================
  {
    id: 'massinha_18_7',
    lensId: 'massinha_soma',
    tier: 1,
    expression: '18 + 7 = ?',
    correctAnswer: 25,
    shortHint: '💡 Massinha da Soma: Empreste do segundo número apenas o que falta para o primeiro virar dezena redonda — quanto fica a soma?',
    stepByStep: [
      'O 18 está a apenas 2 passos de virar a dezena redonda 20.',
      'Tiramos 2 da massinha do 7 (que vira 5) e entregamos ao 18 (que vira 20).',
      'Agora a conta fica transparente: 20 + 5 = 25!',
    ],
    distractors: [
      {
        value: 23,
        trapDiagnosis:
          'Quase! Você tirou 2 do 7 (ficando 5), mas tirou mais 2 em vez de fechar 20 + 5 = 25.',
      },
      {
        value: 26,
        trapDiagnosis:
          'Muito perto! Ao dar 2 do 7 para o 18 virar 20, sobram 5 (7 − 2 = 5), e não 6 → 20 + 5 = 25!',
      },
      {
        value: 27,
        trapDiagnosis:
          'Atenção carinhosa à Massinha: o 18 virou 20 porque ganhou 2 do 7. Então o 7 diminui para 5 → 20 + 5 = 25!',
      },
    ],
  },
  {
    id: 'massinha_19_8',
    lensId: 'massinha_soma',
    tier: 1,
    expression: '19 + 8 = ?',
    correctAnswer: 27,
    shortHint: '💡 Massinha da Soma: Complete o primeiro número até a dezena redonda tirando do segundo — qual é o total?',
    stepByStep: [
      'O 19 só precisa de +1 para virar 20.',
      'Tiramos 1 do 8 (que passa a ser 7) e damos ao 19 (que vira 20).',
      'Somamos sem esforço: 20 + 7 = 27!',
    ],
    distractors: [
      {
        value: 26,
        trapDiagnosis:
          'Quase lá! Você tirou 2 do 8 em vez de 1. O 19 só precisa de 1 para virar 20 → 20 + 7 = 27!',
      },
      {
        value: 28,
        trapDiagnosis:
          'Olhe para a Massinha: o 19 virou 20 porque pegou 1 emprestado do 8. Logo o 8 vira 7 → 20 + 7 = 27!',
      },
      {
        value: 29,
        trapDiagnosis:
          'Cuidado para não somar +1 nos dois lados! Na soma, se um ganha +1 (19→20), o outro entrega −1 (8→7) → 27.',
      },
    ],
  },
  {
    id: 'massinha_28_6',
    lensId: 'massinha_soma',
    tier: 1,
    expression: '28 + 6 = ?',
    correctAnswer: 34,
    shortHint: '💡 Massinha da Soma: Passe unidades da parcela menor para fechar a próxima dezena redonda — quanto dá?',
    stepByStep: [
      'O 28 pede +2 para fechar a dezena 30.',
      'Quebramos o 6 em (2 + 4): o 2 completa o 30 e sobram 4.',
      'Resultado imediato: 30 + 4 = 34!',
    ],
    distractors: [
      {
        value: 32,
        trapDiagnosis:
          'Quase! Tirando 2 do 6 sobram 4 (6 − 2 = 4), e não 2 → 30 + 4 = 34.',
      },
      {
        value: 35,
        trapDiagnosis:
          'Por 1 unidade! O 28 precisava de 2 (e não de 1) para virar 30. Do 6 sobram 4 → 30 + 4 = 34.',
      },
      {
        value: 36,
        trapDiagnosis:
          'Lembre-se da conservação da Massinha: o 6 entregou 2 para o 28 virar 30, então sobram 4 → 30 + 4 = 34!',
      },
    ],
  },
  {
    id: 'massinha_29_16',
    lensId: 'massinha_soma',
    tier: 2,
    expression: '29 + 16 = ?',
    correctAnswer: 45,
    shortHint: '💡 Massinha da Soma: Transfira o que falta para arredondar o primeiro termo e some com o que restou do segundo — qual é o valor?',
    stepByStep: [
      'O 29 está a 1 unidade de virar 30.',
      'Transferimos 1 do 16 para o 29: temos 30 + 15.',
      '30 + 15 = 45 sem precisar armar conta!',
    ],
    distractors: [
      {
        value: 35,
        trapDiagnosis:
          'Olhe as dezenas com calma: 29 virou 30 (e não 20). Somando 30 + 15 chegamos a 45!',
      },
      {
        value: 44,
        trapDiagnosis:
          'Quase! O 29 só precisava de 1 do 16 (16 − 1 = 15), então fica 30 + 15 = 45.',
      },
      {
        value: 46,
        trapDiagnosis:
          'Como o 16 entregou 1 para o 29 virar 30, o 16 diminui para 15 → 30 + 15 = 45!',
      },
    ],
  },
  {
    id: 'massinha_47_38',
    lensId: 'massinha_soma',
    tier: 2,
    expression: '47 + 38 = ?',
    correctAnswer: 85,
    shortHint: '💡 Massinha da Soma: Um lado cede poucas unidades para o outro fechar dezena exata — quanto fica após o equilíbrio?',
    stepByStep: [
      'O 47 precisa de +3 para virar a dezena redonda 50.',
      'Tiramos 3 do 38 (que vira 35) e entregamos ao 47 (que vira 50).',
      '50 + 35 = 85 em 2 segundos!',
    ],
    distractors: [
      {
        value: 75,
        trapDiagnosis:
          'Atenção à subida de dezena: 47 + 3 forma 50 (e não 40). Com os 35 restantes: 50 + 35 = 85!',
      },
      {
        value: 83,
        trapDiagnosis:
          'Quase! De 38 tirando 3 sobram 35 (ou tire 2 do 47 para o 38 virar 40 → 45 + 40 = 85).',
      },
      {
        value: 88,
        trapDiagnosis:
          'Se o 47 ganhou +3 para virar 50, o 38 precisa entregar esses 3 e virar 35 → 50 + 35 = 85!',
      },
    ],
  },
  {
    id: 'massinha_88_35',
    lensId: 'massinha_soma',
    tier: 3,
    expression: '88 + 35 = ?',
    correctAnswer: 123,
    shortHint: '💡 Massinha na Centena: Arredonde o primeiro termo entregando unidades do segundo e atravesse a barreira do 100 — quanto dá?',
    stepByStep: [
      'O 88 pede apenas +2 para fechar 90.',
      'Tiramos 2 do 35 (que vira 33) e formamos 90 + 33.',
      '90 + 10 = 100, mais 23 = 123!',
    ],
    distractors: [
      {
        value: 113,
        trapDiagnosis:
          'Olhe a ponte da centena: 90 + 33 passa de 120 (90 + 30 = 120, mais 3 = 123)!',
      },
      {
        value: 121,
        trapDiagnosis:
          'Quase! Tirando 2 do 35 sobram 33 (e não 31) → 90 + 33 = 123.',
      },
      {
        value: 125,
        trapDiagnosis:
          'Lembre-se de descontar os 2 que saíram do 35 para o 88 virar 90: 90 + 33 = 123!',
      },
    ],
  },

  // =========================================================================
  // LENTE 2: A PEÇA QUE FALTA / AMIGOS DO 10 & MÁQUINA DO TEMPO (+) — 'equacao-balanca'
  // =========================================================================
  {
    id: 'falta_9_10',
    lensId: 'amigos_do_10_falta',
    tier: 1,
    missingBlockResonance: 1,
    expression: '9 + [ ? ] = 10',
    correctAnswer: 1,
    shortHint: '💡 Linha Base-10: A linha inteira tem 10 colunas. Se 9 estão cheias, quantas faltam?',
    stepByStep: [
      'Uma linha completa do Logic Tetris possui exatamente 10 colunas.',
      'Se 9 colunas já estão preenchidas, falta apenas 1 bloco unitário (1×1) para fechar 10!',
    ],
    distractors: [
      {
        value: 0,
        trapDiagnosis:
          'Com 0 blocos continuamos em 9! Falta 1 bloco dourado para completar as 10 colunas (9 + 1 = 10).',
      },
      {
        value: 2,
        trapDiagnosis:
          '9 + 2 passaria para 11! Para fechar exatamente a linha de 10 colunas, 9 precisa apenas do 1.',
      },
      {
        value: 3,
        trapDiagnosis:
          '3 é o amigo do 7 (7 + 3 = 10). O amigo do 9 para fechar 10 é o 1!',
      },
    ],
  },
  {
    id: 'falta_8_10',
    lensId: 'amigos_do_10_falta',
    tier: 1,
    missingBlockResonance: 2,
    expression: '8 + [ ? ] = 10',
    correctAnswer: 2,
    shortHint: '💡 Amigos do 10: Qual é o par complementar que fecha a dezena inteira?',
    stepByStep: [
      'Visualize a linha de 10 colunas no tabuleiro: 8 blocos acesos deixam um espaço de 2.',
      'O par perfeito do 8 na Base 10 é o 2 (8 + 2 = 10)!',
    ],
    distractors: [
      {
        value: 1,
        trapDiagnosis:
          '8 + 1 chega em 9 (ainda faltaria 1 coluna). Para completar 10 a partir do 8, precisamos de 2!',
      },
      {
        value: 3,
        trapDiagnosis:
          '3 é o par do 7 (7 + 3 = 10). Para o 8, faltam apenas 2 blocos (8 + 2 = 10)!',
      },
      {
        value: 4,
        trapDiagnosis:
          '4 é o par do 6 (6 + 4 = 10). De 8 até 10 faltam exatamente 2 passos!',
      },
    ],
  },
  {
    id: 'falta_7_10',
    lensId: 'amigos_do_10_falta',
    tier: 1,
    missingBlockResonance: 3,
    expression: '7 + [ ? ] = 10',
    correctAnswer: 3,
    shortHint: '💡 Amigos do 10: Na grade de 10 colunas, quantas casas vazias restam para completar a linha?',
    stepByStep: [
      'Na grade Base-10 do Tetris, 7 blocos preenchidos deixam 3 casas vazias.',
      '7 e 3 são os Amigos do 10: 7 + 3 = 10!',
    ],
    distractors: [
      {
        value: 2,
        trapDiagnosis:
          '7 + 2 = 9 (quase lá!). Falta mais 1 bloco: 7 + 3 = 10.',
      },
      {
        value: 4,
        trapDiagnosis:
          '4 é o amigo do 6 (6 + 4 = 10). Para o 7 fechar a dezena 10, a peça que falta é 3!',
      },
      {
        value: 5,
        trapDiagnosis:
          '5 é o amigo do próprio 5 (5 + 5 = 10). Para 7 chegar a 10, faltam 3!',
      },
    ],
  },
  {
    id: 'falta_6_10',
    lensId: 'amigos_do_10_falta',
    tier: 1,
    missingBlockResonance: 4,
    expression: '6 + [ ? ] = 10',
    correctAnswer: 4,
    shortHint: '💡 Amigos do 10: Qual complemento fecha exatamente as 10 colunas da linha?',
    stepByStep: [
      'Se uma linha tem 6 blocos, faltam 4 colunas — exatamente a área de 1 Tetrominó!',
      '6 + 4 = 10!',
    ],
    distractors: [
      {
        value: 3,
        trapDiagnosis:
          '6 + 3 = 9! O 3 fecha 10 com o 7; com o 6 precisamos do 4 (6 + 4 = 10).',
      },
      {
        value: 5,
        trapDiagnosis:
          '6 + 5 = 11 (passou 1 da dezena). O complemento exato de 6 para 10 é 4!',
      },
      {
        value: 6,
        trapDiagnosis:
          '6 + 6 = 12 (o dobro de 6). Para parar na dezena 10, somamos 6 + 4 = 10!',
      },
    ],
  },
  {
    id: 'falta_7_15',
    lensId: 'amigos_do_10_falta',
    tier: 2,
    missingBlockResonance: 3,
    expression: '7 + [ ? ] = 15',
    correctAnswer: 8,
    shortHint: '💡 Ponte do 10: Use a dezena 10 como trampolim intermediário e some os dois saltos — qual é a distância total?',
    stepByStep: [
      'Use o 10 como trampolim: de 7 para completar 10 faltam 3.',
      'De 10 para chegar em 15 faltam mais 5.',
      'Juntando os dois saltos: 3 + 5 = 8!',
    ],
    distractors: [
      {
        value: 7,
        trapDiagnosis:
          '7 + 7 = 14 (o dobro de 7). Para chegar em 15, precisamos de 1 a mais: 8!',
      },
      {
        value: 9,
        trapDiagnosis:
          'Quase! 7 + 9 = 16 (porque 7 + 10 = 17, menos 1 = 16). Para dar 15, a peça que falta é 8!',
      },
      {
        value: 12,
        trapDiagnosis:
          'Cuidado para não subtrair invertido: faça a Ponte do 10 → (7 + 3 = 10) + 5 = 15 → 3 + 5 = 8!',
      },
    ],
  },
  {
    id: 'falta_14_20',
    lensId: 'amigos_do_10_falta',
    tier: 2,
    missingBlockResonance: 6,
    expression: '14 + [ ? ] = 20',
    correctAnswer: 6,
    shortHint: '💡 Amigos do 10 na Dezena: Olhe apenas para o algarismo das unidades — qual par fecha a próxima dezena?',
    stepByStep: [
      'Olhe apenas para a unidade 4: quanto falta de 4 para fechar 10?',
      'Como 4 + 6 = 10, então 14 + 6 fecha exatamente a dezena 20!',
    ],
    distractors: [
      {
        value: 4,
        trapDiagnosis:
          '14 + 4 = 18! O amigo do 4 para fechar a dezena é o 6 (14 + 6 = 20).',
      },
      {
        value: 5,
        trapDiagnosis:
          '14 + 5 = 19 (faltou 1 bloco!). Para fechar 20, somamos 14 + 6 = 20.',
      },
      {
        value: 16,
        trapDiagnosis:
          '14 + 16 daria 30! Como já temos 1 dezena no 14, faltam apenas 6 unidades para 20.',
      },
    ],
  },
  {
    id: 'falta_37_50',
    lensId: 'amigos_do_10_falta',
    tier: 3,
    missingBlockResonance: 3,
    expression: '37 + [ ? ] = 50',
    correctAnswer: 13,
    shortHint: '💡 Ponte da Dezena: Complete primeiro até a dezena redonda seguinte e depois suba as dezenas restantes — quanto falta?',
    stepByStep: [
      'Primeiro complete a dezena imediatamente acima: de 37 até 40 faltam 3.',
      'Depois suba de 40 até 50: faltam 10.',
      'Somando os dois degraus: 3 + 10 = 13!',
    ],
    distractors: [
      {
        value: 12,
        trapDiagnosis:
          'Por 1 unidade! O amigo do 7 para fechar 40 é o 3 (37 + 3 = 40), mais 10 = 13.',
      },
      {
        value: 17,
        trapDiagnosis:
          'Pegadinha clássica: 37 + 17 = 54! Como 37 + 3 já sobe para 40, só faltam mais 10 → 13.',
      },
      {
        value: 23,
        trapDiagnosis:
          'Atenção à dezena: quando você soma +3 no 37, ele já vira 40 (e não 30). De 40 para 50 faltam só 10 → 13!',
      },
    ],
  },
  {
    id: 'maquina_tempo_4x_20_60',
    lensId: 'amigos_do_10_falta',
    tier: 3,
    expression: '4x − 20 = 60 → x = ?',
    correctAnswer: 20,
    shortHint: '💡 Máquina do Tempo das Equações: Rebobine o filme de trás para frente! Desfaça primeiro a subtração e depois a multiplicação — quanto vale x?',
    stepByStep: [
      'Na Máquina do Tempo (equacoes-maquina-do-tempo), desfazemos a última operação primeiro.',
      'O oposto de tirar 20 é somar 20: 60 + 20 = 80.',
      'O oposto de multiplicar por 4 é dividir por 4: 80 ÷ 4 = 20!',
    ],
    distractors: [
      {
        value: 10,
        trapDiagnosis:
          'Cuidado! Você fez 60 − 20 = 40 e dividiu por 4 (= 10). Na Máquina do Tempo, o oposto de "− 20" é "+ 20" → (60 + 20) ÷ 4 = 20!',
      },
      {
        value: 15,
        trapDiagnosis:
          '15 é 60 ÷ 4 sem desfazer o "− 20" primeiro! Some 60 + 20 = 80 e depois divida por 4 = 20.',
      },
      {
        value: 25,
        trapDiagnosis:
          'Quase! 60 + 20 = 80, e a quarta parte de 80 (metade de 40) é 20!',
      },
    ],
  },
  {
    id: 'maquina_tempo_3x_5_31',
    lensId: 'amigos_do_10_falta',
    tier: 4,
    expression: '3x − 5 = 31 → x = ?',
    correctAnswer: 12,
    shortHint: '💡 Máquina do Tempo Suprema: Use a operação inversa na ordem reversa para isolar o mistério x — qual número original entrou na máquina?',
    stepByStep: [
      'O número x foi multiplicado por 3 e depois perdeu 5, chegando em 31.',
      '1º Passo Inverso: devolva os 5 que saíram → 31 + 5 = 36.',
      '2º Passo Inverso: desfaça o triplo dividindo por 3 → 36 ÷ 3 = 12!',
    ],
    distractors: [
      {
        value: 8,
        trapDiagnosis:
          'Se x fosse 8, 3 × 8 − 5 daria 19! Lembre-se de SOMAR 5 ao 31 (36) antes de dividir por 3 → 12.',
      },
      {
        value: 9,
        trapDiagnosis:
          'Você fez (31 − 5) = 26, perto de 27 ÷ 3 = 9! O inverso de "− 5" na Máquina do Tempo é "+ 5": (31 + 5) ÷ 3 = 12!',
      },
      {
        value: 14,
        trapDiagnosis:
          'Quase! 31 + 5 = 36, e 36 dividido em 3 partes iguais (30÷3 + 6÷3) é 12!',
      },
    ],
  },

  // =========================================================================
  // LENTE 3: O HACK JAPONÊS (−) — 'aritmetica-elegante-01'
  // =========================================================================
  {
    id: 'hack_jap_42_19',
    lensId: 'hack_japones',
    tier: 1,
    expression: '42 − 19 = ?',
    correctAnswer: 23,
    shortHint: '💡 Hack Japonês: O Subtraendo é o Rei! Some a mesma quantidade nos DOIS números até o segundo virar dezena redonda — qual é a diferença?',
    stepByStep: [
      'O Subtraendo (19) é o Rei: ele só precisa de +1 para virar 20.',
      'Para a distância entre os dois não mudar, somamos +1 também no 42 (que vira 43).',
      '43 − 20 = 23 sem pedir emprestado!',
    ],
    distractors: [
      {
        value: 21,
        trapDiagnosis:
          'Cuidado! Você tirou 1 do 42 (virando 41 − 20 = 21). Na subtração, somamos +1 nos DOIS lados → 43 − 20 = 23!',
      },
      {
        value: 22,
        trapDiagnosis:
          'Armadilha da Balança! Você arredondou o 19 para 20 (+1), mas esqueceu de somar +1 no 42 → 43 − 20 = 23!',
      },
      {
        value: 27,
        trapDiagnosis:
          'Você inverteu as unidades fazendo 9 − 2 = 7! Use o Hack Japonês: some +1 nos dois → 43 − 20 = 23.',
      },
    ],
  },
  {
    id: 'hack_jap_34_19',
    lensId: 'hack_japones',
    tier: 1,
    expression: '34 − 19 = ?',
    correctAnswer: 15,
    shortHint: '💡 Hack Japonês: Desloque ambos os números para frente pela mesma quantidade até zerar a unidade do subtraendo — quanto sobra?',
    stepByStep: [
      'Olhe para o 19: somando +1 ele vira 20.',
      'Some +1 também no 34 para manter a mesma distância: 34 + 1 = 35.',
      '35 − 20 = 15 instantaneamente!',
    ],
    distractors: [
      {
        value: 13,
        trapDiagnosis:
          'Quase! Você subtraiu 1 do 34 em vez de somar. Na diferença, andamos juntos (+1 nos dois): 35 − 20 = 15!',
      },
      {
        value: 14,
        trapDiagnosis:
          'Você transformou 19 em 20 (+1), mas deixou o 34 parado! Some +1 no 34 também: 35 − 20 = 15.',
      },
      {
        value: 25,
        trapDiagnosis:
          'A unidade 5 está perfeita! Só ajuste a dezena: 35 − 20 = 15.',
      },
    ],
  },
  {
    id: 'hack_jap_63_28',
    lensId: 'hack_japones',
    tier: 2,
    expression: '63 − 28 = ?',
    correctAnswer: 35,
    shortHint: '💡 Hack Japonês: Veja quanto falta para o subtraendo fechar dezena redonda e some esse mesmo valor nos dois termos — quanto dá?',
    stepByStep: [
      'O 28 precisa de +2 para virar a dezena redonda 30.',
      'Somamos +2 também no 63 → ele vira 65.',
      'Agora é só fazer 65 − 30 = 35!',
    ],
    distractors: [
      {
        value: 31,
        trapDiagnosis:
          'Você tirou 2 do 63 (61 − 30 = 31)! Na subtração, somamos +2 nos DOIS números: 65 − 30 = 35.',
      },
      {
        value: 33,
        trapDiagnosis:
          'Quase! Você somou +2 no 28 (virando 30), mas esqueceu de somar +2 no 63 → 65 − 30 = 35!',
      },
      {
        value: 45,
        trapDiagnosis:
          'A unidade 5 está certíssima! Mas 65 − 30 tem 3 dezenas: 35.',
      },
    ],
  },
  {
    id: 'hack_jap_73_38',
    lensId: 'hack_japones',
    tier: 2,
    expression: '73 − 38 = ?',
    correctAnswer: 35,
    shortHint: '💡 Hack Japonês: Arredonde o número que está subtraindo somando o mesmo valor nos dois lados da conta — qual é o resultado?',
    stepByStep: [
      'O subtraendo 38 pede +2 para virar 40.',
      'Damos +2 também ao 73, que vira 75.',
      '75 − 40 = 35 sem nenhum risco de erro!',
    ],
    distractors: [
      {
        value: 33,
        trapDiagnosis:
          'Armadilha clássica: você arredondou 38 para 40 (+2), mas deixou o 73 sem os +2 → 75 − 40 = 35!',
      },
      {
        value: 43,
        trapDiagnosis:
          'Cuidado: ao somar +2 no 38 ele sobe para 40 (e não 30). E 73 + 2 = 75 → 75 − 40 = 35!',
      },
      {
        value: 45,
        trapDiagnosis:
          'A unidade 5 veio perfeita (75 − 40)! Só lembre que 7 dezenas menos 4 dezenas são 3 dezenas → 35.',
      },
    ],
  },
  {
    id: 'hack_jap_85_27',
    lensId: 'hack_japones',
    tier: 2,
    expression: '85 − 27 = ?',
    correctAnswer: 58,
    shortHint: '💡 Hack Japonês: Nunca peça emprestado! Avance os dois números juntos até o segundo virar múltiplo de 10 — quanto resta?',
    stepByStep: [
      'O 27 está a +3 de virar 30.',
      'Somamos +3 nos dois termos: (85 + 3) − (27 + 3) = 88 − 30.',
      '88 − 30 = 58!',
    ],
    distractors: [
      {
        value: 52,
        trapDiagnosis:
          'Você subtraiu 3 do 85 (82 − 30 = 52)! Na subtração, ambos caminham para frente (+3): 88 − 30 = 58.',
      },
      {
        value: 55,
        trapDiagnosis:
          'Quase! Você arredondou 27 para 30 (+3), mas esqueceu de somar +3 no 85 → 88 − 30 = 58!',
      },
      {
        value: 62,
        trapDiagnosis:
          'Cuidado com a inversão de unidades (7 − 5 = 2)! Com o Hack Japonês (+3 nos dois), 88 − 30 = 58.',
      },
    ],
  },
  {
    id: 'hack_jap_100_37',
    lensId: 'hack_japones',
    tier: 3,
    expression: '100 − 37 = ?',
    correctAnswer: 63,
    shortHint: '💡 Hack do 99 (Sem Empréstimo): Tire 1 dos dois lados para transformar o 100 em 99 ou suba os dois juntos — quanto dá?',
    stepByStep: [
      'Caminho A (Hack Japonês +3): Some +3 nos dois → 103 − 40 = 63.',
      'Caminho B (Truque do 99): Tire 1 dos dois → 99 − 36 = 63 (9−3=6 e 9−6=3).',
      'Ambos levam a 63 sem pedir emprestado!',
    ],
    distractors: [
      {
        value: 67,
        trapDiagnosis:
          'Quase! O complemento de 7 para 10 é 3 (e não 7). De 37 até 40 (+3) e de 40 até 100 (+60) = 63!',
      },
      {
        value: 73,
        trapDiagnosis:
          'Pegadinha Clássica do 100! Quando completamos 37 + 3, já estamos no 40 (e não no 30). De 40 até 100 faltam 60 → 63!',
      },
      {
        value: 77,
        trapDiagnosis:
          'Dupla armadilha do 100: usando 99 − 36, fazemos 9 − 3 = 6 e 9 − 6 = 3 → 63!',
      },
    ],
  },

  // =========================================================================
  // LENTE 4: A REGRA DO ELEVADOR & PESO/ALÍVIO (−) — 'matematica-sinais-peso-alivio'
  // =========================================================================
  {
    id: 'elevador_50_34',
    lensId: 'regra_elevador',
    tier: 1,
    expression: '50 − 34 = ?',
    correctAnswer: 16,
    shortHint: '💡 Regra do Elevador: Suba primeiro até o próximo andar redondo e depois até o andar final — quantos andares você subiu ao todo?',
    stepByStep: [
      'Imagine que você está no andar 34 e quer subir até o 50.',
      'Do 34 até o 40 o elevador sobe 6 andares.',
      'Do 40 até o 50 sobe mais 10 andares: 6 + 10 = 16!',
    ],
    distractors: [
      {
        value: 14,
        trapDiagnosis:
          'De 34 até 40 faltam 6 andares (pois 4 + 6 = 10), e não 4 → 6 + 10 = 16!',
      },
      {
        value: 24,
        trapDiagnosis:
          'Quando o elevador sobe 6 andares a partir do 34, ele já chega no 40! Do 40 até o 50 faltam só 10 → 16.',
      },
      {
        value: 26,
        trapDiagnosis:
          'A unidade 6 está certíssima! Mas de 40 até 50 há apenas 1 dezena (10), então 6 + 10 = 16.',
      },
    ],
  },
  {
    id: 'elevador_25_18',
    lensId: 'regra_elevador',
    tier: 1,
    expression: '25 − 18 = ?',
    correctAnswer: 7,
    shortHint: '💡 Elevador na Ponte do 20: Meça a distância do andar inicial até o 20 e some com a subida restante — qual é a distância?',
    stepByStep: [
      'Do andar 18 até o andar 20 subimos 2 andares.',
      'Do 20 até o 25 subimos mais 5 andares.',
      'Distância total: 2 + 5 = 7!',
    ],
    distractors: [
      {
        value: 6,
        trapDiagnosis:
          'Quase! De 18 até 20 são 2 passos (e não 1). Somando com os 5 até 25: 2 + 5 = 7!',
      },
      {
        value: 8,
        trapDiagnosis:
          'Por 1 unidade! 18 + 2 = 20, e 20 + 5 = 25 → 2 + 5 = 7.',
      },
      {
        value: 13,
        trapDiagnosis:
          'Você inverteu 8 − 5 = 3 e fez 2 − 1 = 1! Suba de 18 a 20 (+2) e de 20 a 25 (+5) = 7.',
      },
    ],
  },
  {
    id: 'elevador_peso_alivio_10_6_8',
    lensId: 'regra_elevador',
    tier: 2,
    expression: '10 + 6 − 8 = ?',
    correctAnswer: 8,
    shortHint: '💡 Balança Base-10: Em vez de seguir na ordem bruta, resolva primeiro a diferença a partir do 10 e junte com a outra parcela — quanto dá?',
    stepByStep: [
      'Em vez de somar 10 + 6 = 16 para depois subtrair 8, use os Amigos do 10!',
      '10 − 8 sobra 2 imediatamente.',
      'Agora junte com o alívio +6: 2 + 6 = 8!',
    ],
    distractors: [
      {
        value: 6,
        trapDiagnosis:
          'Quase! 10 − 8 deixa +2 de saldo. Somando com +6, chegamos a 8!',
      },
      {
        value: 7,
        trapDiagnosis:
          'Por 1 unidade! Como 16 é o dobro de 8, 16 − 8 = 8 exato.',
      },
      {
        value: 9,
        trapDiagnosis:
          'Olhe pela ponte do 10: 10 − 8 = 2, e 2 + 6 = 8!',
      },
    ],
  },
  {
    id: 'elevador_70_43',
    lensId: 'regra_elevador',
    tier: 2,
    expression: '70 − 43 = ?',
    correctAnswer: 27,
    shortHint: '💡 Regra do Elevador: Suba até a dezena redonda imediatamente acima e depois conte as dezenas até o topo — qual é a subida total?',
    stepByStep: [
      'Do 43 até o 50 o elevador sobe 7 andares (3 + 7 = 10).',
      'Do 50 até o 70 sobe mais 20 andares.',
      'Total da subida: 7 + 20 = 27!',
    ],
    distractors: [
      {
        value: 23,
        trapDiagnosis:
          'O amigo do 3 para fechar a dezena 50 é o 7 (43 + 7 = 50), e não o 3 → 20 + 7 = 27!',
      },
      {
        value: 33,
        trapDiagnosis:
          'Duplo cuidado: de 43 para 50 faltam 7, e de 50 para 70 faltam 20 → 27!',
      },
      {
        value: 37,
        trapDiagnosis:
          'A unidade 7 está perfeita! Mas como 43 + 7 já chega no 50, de 50 até 70 faltam 20 (e não 30) → 27.',
      },
    ],
  },
  {
    id: 'elevador_110_76',
    lensId: 'regra_elevador',
    tier: 3,
    expression: '110 − 76 = ?',
    correctAnswer: 34,
    shortHint: '💡 Elevador em Dois Estágios: Complete primeiro a dezena 80 e depois meça os andares até 110 — qual é a distância?',
    stepByStep: [
      'De 76 até 80 subimos +4.',
      'De 80 até 100 subimos +20, e até 110 mais +10 (total +30).',
      'Juntando tudo: 30 + 4 = 34!',
    ],
    distractors: [
      {
        value: 24,
        trapDiagnosis:
          'A unidade 4 está ótima! Mas de 80 até 110 são 3 dezenas (30), então 30 + 4 = 34.',
      },
      {
        value: 36,
        trapDiagnosis:
          'O amigo do 6 para fechar 80 é o 4 (76 + 4 = 80), e não o 6 → 30 + 4 = 34!',
      },
      {
        value: 44,
        trapDiagnosis:
          'Ao somar +4 no 76, você já chegou no 80. De 80 até 110 são 30 (e não 40) → 34!',
      },
    ],
  },
  {
    id: 'peso_alivio_neg_15_4_5',
    lensId: 'regra_elevador',
    tier: 4,
    expression: '−15 − (−4) × 5 = ?',
    correctAnswer: 5,
    shortHint: '💡 Peso & Alívio de Sinais: Tirar um peso negativo (−(−4)) vira alívio positivo! Resolva primeiro a multiplicação e compare com a dívida — quanto sobra?',
    stepByStep: [
      'Pela regra do Peso & Alívio (matematica-sinais-peso-alivio), tirar um peso negativo −(−4) equivale a ganhar alívio +4.',
      'Multiplicando primeiro: (+4) × 5 = +20 de alívio.',
      'Juntando com o peso inicial: −15 + 20 = 5!',
    ],
    distractors: [
      {
        value: 25,
        trapDiagnosis:
          'Cuidado! Você somou 15 + 20 = 35 ou ignorou o sinal negativo do −15. Com −15 + 20, o saldo positivo é 5!',
      },
      {
        value: 35,
        trapDiagnosis:
          'O 15 inicial é um peso negativo (−15)! Quando entra o alívio +20, abata a dívida de 15 → sobram 5.',
      },
      {
        value: 95,
        trapDiagnosis:
          'Atenção à hierarquia na Trincheira: nunca faça −15 − (−4) antes de multiplicar o (−4) × 5! Primeiro (+4) × 5 = +20, depois −15 + 20 = 5.',
      },
    ],
  },

  // =========================================================================
  // LENTE 5: A BASE DO UNIVERSO (×2, ×4, ×8, ×125) — 'magia-calculo-mental-multiplicacao'
  // =========================================================================
  {
    id: 'dobro_15_4',
    lensId: 'dobro_do_dobro_248',
    tier: 1,
    expression: '15 × 4 = ?',
    correctAnswer: 60,
    shortHint: '💡 Dobro do Dobro: Multiplicar por 4 é dobrar o número duas vezes seguidas — qual é o dobro do dobro?',
    stepByStep: [
      'Multiplicar por 4 (a área de um Tetrominó!) é dobrar duas vezes seguidas.',
      '1º Dobro: 15 × 2 = 30.',
      '2º Dobro: 30 × 2 = 60!',
    ],
    distractors: [
      {
        value: 30,
        trapDiagnosis:
          '30 é apenas o 1º dobro (15 × 2)! Para multiplicar por 4, dobre mais uma vez: 30 × 2 = 60.',
      },
      {
        value: 45,
        trapDiagnosis:
          '45 é 15 × 3! Para 15 × 4, faça o dobro de 30 = 60.',
      },
      {
        value: 50,
        trapDiagnosis:
          'Cuidado com o "vai um": 15 + 15 = 30, e 30 + 30 = 60 (como 4 quartos de hora no relógio)!',
      },
    ],
  },
  {
    id: 'dobro_25_4',
    lensId: 'dobro_do_dobro_248',
    tier: 1,
    expression: '25 × 4 = ?',
    correctAnswer: 100,
    shortHint: '💡 Dobro do Dobro: Dobre o primeiro fator uma vez e depois dobre o resultado novamente — que centena se forma?',
    stepByStep: [
      'Pense em 4 moedas de 25: o dobro de 25 é 50.',
      'O dobro de 50 fecha exatamente a centena: 100!',
    ],
    distractors: [
      {
        value: 50,
        trapDiagnosis:
          '50 é o primeiro dobro (25 × 2)! Dobre mais uma vez para ter ×4: 50 × 2 = 100.',
      },
      {
        value: 75,
        trapDiagnosis:
          '75 equivale a 25 × 3! Com mais 25 (ou dobrando 50), chegamos a 100.',
      },
      {
        value: 90,
        trapDiagnosis:
          '20 × 4 seria 80, mais 5 × 4 (= 20) → 80 + 20 = 100!',
      },
    ],
  },
  {
    id: 'dobro_16_4',
    lensId: 'dobro_do_dobro_248',
    tier: 2,
    expression: '16 × 4 = ?',
    correctAnswer: 64,
    shortHint: '💡 Dobro do Dobro: Encontre o dobro de 16 e dobre mais uma vez — qual potência de 2 aparece?',
    stepByStep: [
      '1º Dobro: 16 + 16 = 32.',
      '2º Dobro: 32 + 32 = 64!',
    ],
    distractors: [
      {
        value: 32,
        trapDiagnosis:
          'Você fez o primeiro dobro (16 × 2 = 32)! Falta apenas dobrar o 32 → 64.',
      },
      {
        value: 54,
        trapDiagnosis:
          'Olhe as dezenas: o dobro de 30 é 60, e o dobro de 2 é 4 → 64!',
      },
      {
        value: 68,
        trapDiagnosis:
          'Quase! O dobro de 16 é 32 (e não 34), então 32 × 2 = 64.',
      },
    ],
  },
  {
    id: 'dobro_35_4',
    lensId: 'dobro_do_dobro_248',
    tier: 2,
    expression: '35 × 4 = ?',
    correctAnswer: 140,
    shortHint: '💡 Dobro do Dobro: Todo número terminado em 5 vira dezena redonda no 1º dobro! Dobre duas vezes seguidas — quanto dá?',
    stepByStep: [
      'Todo número terminado em 5 fica redondo ao dobrar!',
      '1º Dobro: 35 × 2 = 70.',
      '2º Dobro: 70 × 2 = 140!',
    ],
    distractors: [
      {
        value: 70,
        trapDiagnosis:
          '70 é 35 × 2! Dobre o 70 mais uma vez para completar 35 × 4 = 140.',
      },
      {
        value: 120,
        trapDiagnosis:
          '30 × 4 é 120, mas ainda faltam os 5 × 4 (= 20) → 120 + 20 = 140!',
      },
      {
        value: 130,
        trapDiagnosis:
          'O dobro de 35 é 70 (30+30=60 mais 5+5=10). E o dobro de 70 é 140!',
      },
    ],
  },
  {
    id: 'dobro_15_8',
    lensId: 'dobro_do_dobro_248',
    tier: 3,
    expression: '15 × 8 = ?',
    correctAnswer: 120,
    shortHint: '💡 Triplo Dobro (×8): Multiplicar por 8 é dobrar 3 vezes seguidas (×2 → ×2 → ×2) — aonde você chega?',
    stepByStep: [
      'Multiplicar por 8 é dobrar 3 vezes seguidas!',
      '15 × 2 = 30 → 30 × 2 = 60 → 60 × 2 = 120!',
    ],
    distractors: [
      {
        value: 60,
        trapDiagnosis:
          '60 é 15 × 4 (dois dobros)! Para chegar em ×8, faça mais um dobro: 60 × 2 = 120.',
      },
      {
        value: 90,
        trapDiagnosis:
          '90 é 15 × 6! Dobre o 60 (que é 15 × 4) e você chega direto em 120.',
      },
      {
        value: 110,
        trapDiagnosis:
          '10 × 8 = 80 e 5 × 8 = 40 → somando 80 + 40 = 120!',
      },
    ],
  },
  {
    id: 'milenar_24_125',
    lensId: 'dobro_do_dobro_248',
    tier: 4,
    expression: '24 × 125 = ?',
    correctAnswer: 3000,
    shortHint: '💡 Fatoração Milenar (×125): Sabendo que 8 × 125 fecha um milhar exato (1000), divida o primeiro fator por 8 — quantos milhares se formam?',
    stepByStep: [
      'Na Magia do Cálculo Mental, 125 é o amigo milenar do 8 (pois 8 × 125 = 1000).',
      'Quebre o 24 em 3 × 8: temos 3 × (8 × 125).',
      '3 × 1000 = 3000 instantaneamente!',
    ],
    distractors: [
      {
        value: 2000,
        trapDiagnosis:
          '2000 seria 16 × 125 (pois 16 ÷ 8 = 2)! Para 24 × 125, como 24 ÷ 8 = 3, temos 3 × 1000 = 3000.',
      },
      {
        value: 2400,
        trapDiagnosis:
          '2400 é 24 × 100! Ainda faltam os 24 × 25 (= 600) → 2400 + 600 = 3000.',
      },
      {
        value: 4000,
        trapDiagnosis:
          '4000 é 32 × 125 (pois 32 ÷ 8 = 4)! Para 24, temos 24 ÷ 8 = 3 → 3000.',
      },
    ],
  },
  {
    id: 'milenar_32_125',
    lensId: 'dobro_do_dobro_248',
    tier: 4,
    expression: '32 × 125 = ?',
    correctAnswer: 4000,
    shortHint: '💡 Fatoração Milenar (×125): Como 125 × 8 fecha 1000, descubra quantos grupos de 8 cabem no primeiro fator — qual milhar aparece?',
    stepByStep: [
      'O segredo do 125 é que ele é a oitava parte de 1000 (8 × 125 = 1000).',
      'Divida 32 por 8 (= 4) e multiplique o 125 por 8 (= 1000).',
      '4 × 1000 = 4000 de cabeça!',
    ],
    distractors: [
      {
        value: 3000,
        trapDiagnosis:
          '3000 é 24 × 125! Como 32 tem 4 grupos de 8 (4 × 8 = 32), o resultado é 4 × 1000 = 4000.',
      },
      {
        value: 3200,
        trapDiagnosis:
          '3200 é apenas 32 × 100! Somando com 32 × 25 (= 800), fechamos 4000.',
      },
      {
        value: 8000,
        trapDiagnosis:
          '8000 seria 64 × 125! Dividindo 32 por 8 encontramos 4 → 4000.',
      },
    ],
  },

  // =========================================================================
  // LENTE 6: O NOSSO RELÓGIO (×5), DOBRAR E MEIAR & TRUQUE DO 11/101 — 'regra-de-ouro-2'
  // =========================================================================
  {
    id: 'relogio_14_5',
    lensId: 'relogio_5_dobra_meia',
    tier: 1,
    expression: '14 × 5 = ?',
    correctAnswer: 70,
    shortHint: '💡 Lente Dobra e Meia: Multiplicar por 5 é metade de multiplicar por 10! Corte o fator par ao meio e multiplique por 10 — quanto dá?',
    stepByStep: [
      'Assim como esticar um quadrado 2×2 em uma barra 1×4, cortamos o 14 pela metade (= 7) e dobramos o 5 (= 10).',
      'A conta vira 7 × 10 = 70 instantaneamente!',
    ],
    distractors: [
      {
        value: 60,
        trapDiagnosis:
          '60 é 12 × 5 (metade de 12 é 6 → 60). Para 14 × 5, a metade de 14 é 7 → 70!',
      },
      {
        value: 65,
        trapDiagnosis:
          'Quase! Use o truque da metade: metade de 14 é 7, seguido de zero = 70.',
      },
      {
        value: 75,
        trapDiagnosis:
          '75 é 15 × 5! Para o número par 14, basta pegar a metade (7) e multiplicar por 10 = 70.',
      },
    ],
  },
  {
    id: 'relogio_18_5',
    lensId: 'relogio_5_dobra_meia',
    tier: 1,
    expression: '18 × 5 = ?',
    correctAnswer: 90,
    shortHint: '💡 Lente Dobra e Meia: Se você corta o número par pela metade e dobra o 5 para virar dezena, qual área se mantém?',
    stepByStep: [
      'Multiplicar por 5 é multiplicar por 10 e pegar a metade!',
      'Metade de 18 é 9, e o dobro de 5 é 10 → 9 × 10 = 90!',
    ],
    distractors: [
      {
        value: 80,
        trapDiagnosis:
          '80 é 16 × 5 (pois metade de 16 é 8). A metade de 18 é 9 → 90!',
      },
      {
        value: 85,
        trapDiagnosis:
          'Todo número par multiplicado por 5 termina em 0! Metade de 18 é 9 → 90.',
      },
      {
        value: 95,
        trapDiagnosis:
          '95 seria 19 × 5. Para 18 × 5, metade de 18 é 9 → 9 × 10 = 90!',
      },
    ],
  },
  {
    id: 'relogio_24_5',
    lensId: 'relogio_5_dobra_meia',
    tier: 2,
    expression: '24 × 5 = ?',
    correctAnswer: 120,
    shortHint: '💡 Lente Dobra e Meia: Transforme o retângulo tirando a metade do número par e dobrando o 5 — que produto aparece?',
    stepByStep: [
      'Corte o 24 pela metade (= 12) e dobre o 5 (= 10).',
      'A área do retângulo não muda: 12 × 10 = 120!',
    ],
    distractors: [
      {
        value: 100,
        trapDiagnosis:
          '100 é 20 × 5! Ainda faltam os 4 × 5 (= 20) → 100 + 20 = 120.',
      },
      {
        value: 110,
        trapDiagnosis:
          '110 é 22 × 5 (metade de 22 é 11). A metade de 24 é 12 → 120!',
      },
      {
        value: 125,
        trapDiagnosis:
          'Como 24 é par, 24 × 5 termina em zero: metade de 24 é 12 → 120!',
      },
    ],
  },
  {
    id: 'onze_43_11',
    lensId: 'relogio_5_dobra_meia',
    tier: 2,
    expression: '43 × 11 = ?',
    correctAnswer: 473,
    shortHint: '💡 Segredo do 11: Afaste os dois algarismos das pontas e coloque exatamente no meio a soma deles — que número de 3 dígitos surge?',
    stepByStep: [
      'Multiplicar por 11 é somar 10 vezes o número mais 1 vez ele mesmo.',
      'Truque Visual do Repositório: abra o 4 e o 3 nas pontas → 4 [ _ ] 3.',
      'No meio vai a soma dos dois dígitos (4 + 3 = 7) → 473!',
    ],
    distractors: [
      {
        value: 433,
        trapDiagnosis:
          '430 é 43 × 10! Faltou somar mais 1 vez o 43 (430 + 43 = 473), ou colocar 4 + 3 = 7 no meio → 473.',
      },
      {
        value: 443,
        trapDiagnosis:
          'Quase! No meio do 4 e do 3 colocamos a soma 4 + 3 = 7 (e não 4) → 473!',
      },
      {
        value: 483,
        trapDiagnosis:
          'Olhe a soma central: 4 + 3 é 7 (e não 8), formando 473!',
      },
    ],
  },
  {
    id: 'onze_53_11',
    lensId: 'relogio_5_dobra_meia',
    tier: 2,
    expression: '53 × 11 = ?',
    correctAnswer: 583,
    shortHint: '💡 Segredo do 11: Abra os dois dígitos do número e encaixe a soma deles no centro — qual valor aparece?',
    stepByStep: [
      'Pelo Truque do 11 (magia-calculo-mental-multiplicacao), separe a dezena 5 e a unidade 3.',
      'Some os dois algarismos: 5 + 3 = 8.',
      'Coloque o 8 no centro: 583!',
    ],
    distractors: [
      {
        value: 533,
        trapDiagnosis:
          '530 é apenas 53 × 10! Somando mais 53 (ou colocando 5 + 3 = 8 no meio), temos 583.',
      },
      {
        value: 553,
        trapDiagnosis:
          'No centro vai a soma dos dois dígitos (5 + 3 = 8), formando 583!',
      },
      {
        value: 573,
        trapDiagnosis:
          'Quase! 5 + 3 é 8 (e não 7), então o dígito do meio é 8 → 583.',
      },
    ],
  },
  {
    id: 'espelho_101_43',
    lensId: 'relogio_5_dobra_meia',
    tier: 2,
    expression: '101 × 43 = ?',
    correctAnswer: 4343,
    shortHint: '💡 Espelho do 101: Multiplicar por 101 é somar 100 vezes o número com 1 vez ele mesmo — qual número espelhado se forma?',
    stepByStep: [
      '101 é 100 + 1 (o Espelho de 2 dígitos do nosso repositório!).',
      '43 × 100 = 4300, mais 43 × 1 = 43.',
      'O número simplesmente se repete no espelho: 4343!',
    ],
    distractors: [
      {
        value: 4303,
        trapDiagnosis:
          '4300 + 43 preenche tanto a dezena quanto a unidade: o 43 se repete inteiro → 4343!',
      },
      {
        value: 4313,
        trapDiagnosis:
          'Multiplicar por 101 repete o número de 2 dígitos lado a lado: 4300 + 43 = 4343!',
      },
      {
        value: 4443,
        trapDiagnosis:
          '43 × 100 é 4300 (e não 4400). Com mais 43, forma o espelho perfeito 4343!',
      },
    ],
  },
  {
    id: 'dobra_meia_18_15',
    lensId: 'relogio_5_dobra_meia',
    tier: 2,
    expression: '18 × 15 = ?',
    correctAnswer: 270,
    shortHint: '💡 Regra de Ouro (Dobra e Meia): Corte o fator par pela metade e dobre o fator terminado em 5 — quanto dá o novo produto?',
    stepByStep: [
      '18 × 15 parece difícil na vertical, mas observe a Regra de Ouro da Área!',
      'Corte o 18 pela metade (= 9) e dobre o 15 (= 30).',
      '9 × 30 = 270 de cabeça!',
    ],
    distractors: [
      {
        value: 180,
        trapDiagnosis:
          '180 é apenas 18 × 10! Faltou somar a metade (18 × 5 = 90) → 180 + 90 = 270.',
      },
      {
        value: 240,
        trapDiagnosis:
          'Quase! Metade de 18 é 9 (e não 8). Fazendo 9 × 30 chegamos a 270!',
      },
      {
        value: 280,
        trapDiagnosis:
          'Olhe a tabuada do 9: 9 × 3 = 27, então 9 × 30 = 270!',
      },
    ],
  },
  {
    id: 'dobra_meia_16_25',
    lensId: 'relogio_5_dobra_meia',
    tier: 3,
    expression: '16 × 25 = ?',
    correctAnswer: 400,
    shortHint: '💡 Dobra e Meia Duplo (×25): Como 25 × 4 fecha 100, divida o primeiro fator por 4 e multiplique por 100 — quanto dá?',
    stepByStep: [
      'Em vez de multiplicar 16 × 25, transforme o retângulo duas vezes:',
      '16 × 25 = 8 × 50 = 4 × 100.',
      '4 × 100 = 400 instantaneamente!',
    ],
    distractors: [
      {
        value: 200,
        trapDiagnosis:
          '200 é 8 × 25 (apenas metade do caminho)! Como 16 tem quatro grupos de 4, 4 × 100 = 400.',
      },
      {
        value: 300,
        trapDiagnosis:
          '300 é 12 × 25! Para 16 × 25, divida 16 por 4 (= 4) e multiplique por 100 = 400.',
      },
      {
        value: 350,
        trapDiagnosis:
          '350 é 14 × 25! Para 16 × 25, pense em 8 × 50 = 4 × 100 = 400.',
      },
    ],
  },

  // =========================================================================
  // LENTE 7: O INFINITO QUE COMPLETA (×9), DIFERENÇA DE QUADRADOS & FATOR COMUM — 'diferenca-quadrados-fator-comum'
  // =========================================================================
  {
    id: 'nove_9_8',
    lensId: 'infinito_9_quadrados',
    tier: 1,
    expression: '9 × 8 = ?',
    correctAnswer: 72,
    shortHint: '💡 Truque do 9 (Base 10): Multiplique o número por 10 e depois subtraia 1 vez ele mesmo — quanto resta?',
    stepByStep: [
      'O 9 é 10 menos 1 (uma linha quase cheia do Tetris!).',
      '8 linhas de 10 blocos dão 80; tirando 1 bloco de cada uma das 8 linhas: 80 − 8 = 72!',
    ],
    distractors: [
      {
        value: 63,
        trapDiagnosis:
          '63 é 9 × 7 (70 − 7 = 63)! Para 9 × 8, fazemos 80 − 8 = 72.',
      },
      {
        value: 71,
        trapDiagnosis:
          'No Truque do 9, a soma dos dígitos sempre dá 9 (7 + 2 = 9)! 80 − 8 = 72.',
      },
      {
        value: 74,
        trapDiagnosis:
          'O amigo do 8 para fechar 10 é o 2: logo 80 − 8 termina em 2 → 72!',
      },
    ],
  },
  {
    id: 'quadrados_12_8',
    lensId: 'infinito_9_quadrados',
    tier: 2,
    expression: '12 × 8 = ?',
    correctAnswer: 96,
    shortHint: '💡 Diferença de Quadrados na Base 10: Os dois fatores têm o 10 exatamente no meio! Faça (Centro)² − (Distância)² — quanto dá?',
    stepByStep: [
      '12 e 8 estão à mesma distância do centro 10 (10 + 2 e 10 − 2).',
      'Pela Diferença de Quadrados: 10² − 2² = 100 − 4 = 96!',
    ],
    distractors: [
      {
        value: 86,
        trapDiagnosis:
          '10 × 8 é 80, mais 2 × 8 (= 16) → 80 + 16 = 96 (e não 86)!',
      },
      {
        value: 92,
        trapDiagnosis:
          'Quase! O quadrado da distância 2 é 2² = 4 (e não 8) → 100 − 4 = 96.',
      },
      {
        value: 98,
        trapDiagnosis:
          'Na Diferença de Quadrados descontamos 2² = 4 (e não 2) → 100 − 4 = 96!',
      },
    ],
  },
  {
    id: 'nove_19_6',
    lensId: 'infinito_9_quadrados',
    tier: 2,
    expression: '19 × 6 = ?',
    correctAnswer: 114,
    shortHint: '💡 Vizinho da Dezena: Arredonde o 19 para a dezena redonda acima, multiplique e desconte o excesso — qual é o valor?',
    stepByStep: [
      '19 está colado na dezena redonda 20 (19 = 20 − 1).',
      'Multiplique 20 × 6 = 120 e tire 1 vez o 6: 120 − 6 = 114!',
    ],
    distractors: [
      {
        value: 104,
        trapDiagnosis:
          'Cuidado na descida de dezena: 120 − 6 fica na casa dos 110 → 114!',
      },
      {
        value: 112,
        trapDiagnosis:
          'O amigo do 6 para fechar 10 é o 4, então 120 − 6 termina em 4 → 114!',
      },
      {
        value: 116,
        trapDiagnosis:
          'Quase! De 120 tiramos 6 (e não 4), pois estamos multiplicando por 6 → 120 − 6 = 114.',
      },
    ],
  },
  {
    id: 'fator_comum_23_7_3',
    lensId: 'infinito_9_quadrados',
    tier: 2,
    expression: '23 × 7 + 23 × 3 = ?',
    correctAnswer: 230,
    shortHint: '💡 Fator Comum em Evidência: O mesmo número multiplica os dois blocos! Coloque-o em evidência e some primeiro os dois parceiros — quanto dá?',
    stepByStep: [
      'Não multiplique 23 × 7 nem 23 × 3 separadamente!',
      'Coloque o fator comum 23 em evidência: 23 × (7 + 3).',
      'Como 7 + 3 fecha a dezena 10, temos 23 × 10 = 230 na hora!',
    ],
    distractors: [
      {
        value: 207,
        trapDiagnosis:
          '207 seria 23 × 9! Como 7 + 3 fecha exatamente 10 grupos de 23, temos 23 × 10 = 230.',
      },
      {
        value: 210,
        trapDiagnosis:
          'Quase! O fator em evidência é 23 (e não 21). Multiplicando 23 por (7 + 3) chegamos a 230!',
      },
      {
        value: 460,
        trapDiagnosis:
          'Cuidado para não somar o 23 duas vezes (46 × 10)! O 23 fica em evidência uma única vez: 23 × (7 + 3) = 230.',
      },
    ],
  },
  {
    id: 'fator_comum_17_6_4',
    lensId: 'infinito_9_quadrados',
    tier: 2,
    expression: '17 × 6 + 17 × 4 = ?',
    correctAnswer: 170,
    shortHint: '💡 Fator Comum em Evidência: Una os dois blocos pelo fator repetido e some os complementos da Base 10 — qual é o resultado?',
    stepByStep: [
      '6 grupos de 17 mais 4 grupos de 17 formam (6 + 4) grupos de 17.',
      'Como 6 + 4 = 10, a conta inteira vira 17 × 10 = 170!',
    ],
    distractors: [
      {
        value: 153,
        trapDiagnosis:
          '153 seria 17 × 9! Como 6 + 4 = 10, temos 17 × 10 = 170.',
      },
      {
        value: 160,
        trapDiagnosis:
          'O fator comum é 17 (e não 16): 17 × (6 + 4) = 170!',
      },
      {
        value: 340,
        trapDiagnosis:
          'Não duplique o fator comum! 6 pacotes de 17 + 4 pacotes de 17 = 10 pacotes de 17 = 170.',
      },
    ],
  },
  {
    id: 'quadrados_21_19',
    lensId: 'infinito_9_quadrados',
    tier: 3,
    expression: '21 × 19 = ?',
    correctAnswer: 399,
    shortHint: '💡 Diferença de Quadrados (a² − b²): Encontre a dezena redonda no meio dos dois fatores e faça (Centro)² − (Distância)² — quanto dá?',
    stepByStep: [
      '21 e 19 são vizinhos simétricos do 20 (20 + 1 e 20 − 1).',
      'O quadrado de 20 é 400; tirando 1² (= 1), temos 400 − 1 = 399 em 1 segundo!',
    ],
    distractors: [
      {
        value: 389,
        trapDiagnosis:
          '20 × 20 é 400, e a distância até o centro 20 é apenas 1 → 400 − 1 = 399!',
      },
      {
        value: 391,
        trapDiagnosis:
          'Quase! Você tirou 9 de 400, mas 1² = 1 → 400 − 1 = 399.',
      },
      {
        value: 401,
        trapDiagnosis:
          'Lembre-se que na Diferença de Quadrados sempre SUBTRAÍMOS a distância ao quadrado: 400 − 1 = 399!',
      },
    ],
  },
  {
    id: 'quadrados_28_32',
    lensId: 'infinito_9_quadrados',
    tier: 3,
    expression: '28 × 32 = ?',
    correctAnswer: 896,
    shortHint: '💡 Diferença de Quadrados (a² − b²): Descubra a dezena redonda exatamente no meio entre 28 e 32 e calcule (Centro)² − (Distância)² — qual valor surge?',
    stepByStep: [
      'O centro simétrico entre 28 e 32 é a dezena 30, com distância 2 para cada lado (30 − 2 e 30 + 2).',
      'Pela Diferença de Quadrados (diferenca-quadrados-fator-comum): 30² − 2².',
      '900 − 4 = 896 sem armar conta!',
    ],
    distractors: [
      {
        value: 884,
        trapDiagnosis:
          'Quase! O quadrado da distância 2 é 2² = 4 (e não 16) → 900 − 4 = 896.',
      },
      {
        value: 892,
        trapDiagnosis:
          'A distância até o centro 30 é 2, e 2² = 4 (e não 8) → 900 − 4 = 896!',
      },
      {
        value: 904,
        trapDiagnosis:
          'Cuidado com o sinal: (30 − 2)(30 + 2) é 30² MENOS 2², logo subtraímos 4 de 900 → 896!',
      },
    ],
  },
  {
    id: 'quadrados_37_43',
    lensId: 'infinito_9_quadrados',
    tier: 3,
    expression: '37 × 43 = ?',
    correctAnswer: 1591,
    shortHint: '💡 Diferença de Quadrados (a² − b²): Qual dezena redonda mora exatamente no meio entre 37 e 43? Eleve esse centro ao quadrado e subtraia o quadrado da distância!',
    stepByStep: [
      'Joia Clássica do Repositório Heiss-Lab: 37 é (40 − 3) e 43 é (40 + 3)!',
      'Aplicando a Diferença de Quadrados: (40 − 3) × (40 + 3) = 40² − 3².',
      'Como 40² = 1600 e 3² = 9, fazemos 1600 − 9 = 1591 de cabeça!',
    ],
    distractors: [
      {
        value: 1581,
        trapDiagnosis:
          'Muito perto! De 1600 tirando 9 (pois 3² = 9) descemos apenas para a dezena 90: 1600 − 9 = 1591!',
      },
      {
        value: 1594,
        trapDiagnosis:
          'Você tirou 6 (2 × 3) em vez de tirar o quadrado da distância (3² = 9) → 1600 − 9 = 1591!',
      },
      {
        value: 1609,
        trapDiagnosis:
          'Na Diferença de Quadrados sempre SUBTRAÍMOS o quadrado da distância: 1600 − 9 = 1591 (e não + 9)!',
      },
    ],
  },
  {
    id: 'quadrados_47_53',
    lensId: 'infinito_9_quadrados',
    tier: 3,
    expression: '47 × 53 = ?',
    correctAnswer: 2491,
    shortHint: '💡 Diferença de Quadrados (a² − b²): Encontre a dezena redonda no centro entre 47 e 53 e aplique (Centro)² − (Distância)² — quanto dá?',
    stepByStep: [
      '47 e 53 estão ambos a 3 unidades de distância do centro 50: (50 − 3) × (50 + 3).',
      'Elevamos o centro ao quadrado (50² = 2500) e subtraímos a distância ao quadrado (3² = 9).',
      '2500 − 9 = 2491!',
    ],
    distractors: [
      {
        value: 2481,
        trapDiagnosis:
          'Quase! 2500 − 9 permanece na casa dos 2490 → 2491.',
      },
      {
        value: 2494,
        trapDiagnosis:
          'Lembre-se de elevar a distância 3 ao quadrado (3² = 9, e não 6) → 2500 − 9 = 2491!',
      },
      {
        value: 2509,
        trapDiagnosis:
          'Pela identidade (a − b)(a + b) = a² − b², subtraímos 9 de 2500 → 2491!',
      },
    ],
  },
  {
    id: 'quadrados_48_52',
    lensId: 'infinito_9_quadrados',
    tier: 3,
    expression: '48 × 52 = ?',
    correctAnswer: 2496,
    shortHint: '💡 Diferença de Quadrados (a² − b²): Identifique o centro redondo entre 48 e 52 e desconte do quadrado dele o quadrado da distância — qual é o produto?',
    stepByStep: [
      '48 é (50 − 2) e 52 é (50 + 2): simetria perfeita em torno do 50!',
      '50² = 2500 e 2² = 4.',
      '2500 − 4 = 2496 instantaneamente!',
    ],
    distractors: [
      {
        value: 2484,
        trapDiagnosis:
          'A distância até 50 é 2, cujo quadrado é 4 (e não 16) → 2500 − 4 = 2496!',
      },
      {
        value: 2492,
        trapDiagnosis:
          'Quase! O quadrado de 2 é 4 (e não 8) → 2500 − 4 = 2496.',
      },
      {
        value: 2504,
        trapDiagnosis:
          'Subtraia o quadrado da distância: 2500 − 4 = 2496!',
      },
    ],
  },
  {
    id: 'quadrado_5_35',
    lensId: 'infinito_9_quadrados',
    tier: 3,
    expression: '35² (35 × 35) = ?',
    correctAnswer: 1225,
    shortHint: '💡 Quadrados Terminados em 5: Multiplique o algarismo das dezenas pelo seu sucessor imediato n × (n + 1) e cole 25 no final — que número se forma?',
    stepByStep: [
      'Pelo segredo dos Quadrados Perfeitos terminados em 5 (quadrados-perfeitos-ajustes):',
      'Pegue a dezena 3 e multiplique pelo próximo número inteiro (4): 3 × 4 = 12.',
      'Anexe 25 à direita das centenas: 1225!',
    ],
    distractors: [
      {
        value: 925,
        trapDiagnosis:
          'Você fez 3 × 3 = 9 nas centenas! O segredo é multiplicar a dezena 3 pelo SUCESSOR 4 (3 × 4 = 12) → 1225!',
      },
      {
        value: 1025,
        trapDiagnosis:
          'Quase! O produto da dezena 3 pelo seu sucessor 4 é 3 × 4 = 12 → 1225.',
      },
      {
        value: 1525,
        trapDiagnosis:
          '1525 seria se fizéssemos 3 × 5! O sucessor de 3 é 4 → 3 × 4 = 12, formando 1225.',
      },
    ],
  },
  {
    id: 'quadrado_5_65',
    lensId: 'infinito_9_quadrados',
    tier: 3,
    expression: '65² (65 × 65) = ?',
    correctAnswer: 4225,
    shortHint: '💡 Quadrados Terminados em 5: Multiplique a dezena pelo próximo número inteiro após ela e anexe o final clássico de 5² — quanto dá?',
    stepByStep: [
      'Todo quadrado terminado em 5 termina em 25!',
      'Para descobrir as centenas, multiplique a dezena 6 pelo seu sucessor 7: 6 × 7 = 42.',
      'Juntando as duas partes: 4225!',
    ],
    distractors: [
      {
        value: 3625,
        trapDiagnosis:
          '3625 é a armadilha de fazer 6 × 6 = 36! Multiplique o 6 pelo SUCESSOR 7 (6 × 7 = 42) → 4225!',
      },
      {
        value: 4025,
        trapDiagnosis:
          'Quase! Na tabuada, 6 × 7 vale 42 (e não 40) → 4225.',
      },
      {
        value: 4825,
        trapDiagnosis:
          '48 é 6 × 8! O sucessor imediato de 6 é 7 (6 × 7 = 42) → 4225.',
      },
    ],
  },
  {
    id: 'fator_comum_45_18_8',
    lensId: 'infinito_9_quadrados',
    tier: 3,
    expression: '45 × 18 − 45 × 8 = ?',
    correctAnswer: 450,
    shortHint: '💡 Fator Comum na Subtração: Coloque o número repetido em evidência e subtraia primeiro os dois multiplicadores — quanto resta?',
    stepByStep: [
      '18 grupos de 45 menos 8 grupos de 45 deixam exatamente (18 − 8) grupos de 45!',
      'Como 18 − 8 = 10, fazemos 45 × 10 = 450 em 1 segundo!',
    ],
    distractors: [
      {
        value: 360,
        trapDiagnosis:
          '18 − 8 fecha exatamente 10 (e não 8)! Multiplicando 45 × 10 temos 450.',
      },
      {
        value: 405,
        trapDiagnosis:
          '405 seria 45 × 9! Como 18 − 8 = 10, o resultado redondo é 450.',
      },
      {
        value: 900,
        trapDiagnosis:
          '900 seria 45 × 20! Como estamos subtraindo (18 − 8 = 10), fica 45 × 10 = 450.',
      },
    ],
  },
  {
    id: 'quadrados_inv_53_47',
    lensId: 'infinito_9_quadrados',
    tier: 4,
    expression: '53² − 47² = ?',
    correctAnswer: 600,
    shortHint: '💡 Diferença de Quadrados Inversa: Proibido elevar ao quadrado no braço! Use a² − b² = (a + b) × (a − b): multiplique a soma dos dois pela diferença entre eles!',
    stepByStep: [
      'Desafio Supremo do Repositório (diferenca-quadrados-fator-comum): a² − b² = (a + b) × (a − b)!',
      'Soma dos termos: 53 + 47 = 100.',
      'Diferença dos termos: 53 − 47 = 6.',
      'Multiplicando: 100 × 6 = 600 sem sofrer!',
    ],
    distractors: [
      {
        value: 36,
        trapDiagnosis:
          '36 é (53 − 47)² = 6²! Mas a² − b² não é (a − b)²: multiplique a SOMA (100) pela DIFERENÇA (6) → 600!',
      },
      {
        value: 400,
        trapDiagnosis:
          'Quase! A distância entre 47 e 53 é 3 + 3 = 6 (e não 4). Multiplicando pela soma 100: 100 × 6 = 600!',
      },
      {
        value: 1000,
        trapDiagnosis:
          '1000 seria se a diferença fosse 10 (como em 55² − 45²)! Entre 53 e 47 a diferença é 6 → 100 × 6 = 600.',
      },
    ],
  },
  {
    id: 'quadrados_inv_55_45',
    lensId: 'infinito_9_quadrados',
    tier: 4,
    expression: '55² − 45² = ?',
    correctAnswer: 1000,
    shortHint: '💡 Diferença de Quadrados Inversa: Transforme a² − b² em (a + b) × (a − b) — quanto dá a soma multiplicada pela diferença?',
    stepByStep: [
      'Aplicando a lente a² − b² = (a + b) × (a − b):',
      'Soma: 55 + 45 = 100.',
      'Diferença: 55 − 45 = 10.',
      'Produto: 100 × 10 = 1000 em 2 segundos!',
    ],
    distractors: [
      {
        value: 100,
        trapDiagnosis:
          '100 é apenas (55 − 45)² = 10²! Multiplique a soma (100) pela diferença (10) → 100 × 10 = 1000!',
      },
      {
        value: 500,
        trapDiagnosis:
          'De 45 até 55 a distância é 10 (e não 5)! Multiplicando pela soma 100: 100 × 10 = 1000.',
      },
      {
        value: 2000,
        trapDiagnosis:
          '55 + 45 fecha 100 (e não 200). Multiplicado pela diferença 10, resulta em 1000!',
      },
    ],
  },
  {
    id: 'fator_comum_37_12_88',
    lensId: 'infinito_9_quadrados',
    tier: 4,
    expression: '37 × 12 + 37 × 88 = ?',
    correctAnswer: 3700,
    shortHint: '💡 Fator Comum Centenário: Coloque o fator repetido em evidência e some primeiro os dois parceiros que fecham uma centena redonda — qual é o total?',
    stepByStep: [
      'Joia de Ouro do Repositório (diferenca-quadrados-fator-comum): o 37 aparece nos dois blocos!',
      'Colocando o 37 em evidência: 37 × (12 + 88).',
      'Como 12 + 88 = 100, fazemos 37 × 100 = 3700 instantaneamente!',
    ],
    distractors: [
      {
        value: 370,
        trapDiagnosis:
          'Quase! 12 + 88 fecha 100 (uma centena, com dois zeros), e não 10 → 37 × 100 = 3700!',
      },
      {
        value: 3330,
        trapDiagnosis:
          '12 + 88 fecha exatamente 100 (e não 90)! Basta acrescentar dois zeros ao 37 → 3700.',
      },
      {
        value: 7400,
        trapDiagnosis:
          'Cuidado para não somar 37 + 37 = 74! O fator comum 37 fica em evidência uma só vez: 37 × (12 + 88) = 3700.',
      },
    ],
  },
  {
    id: 'quadrado_5_95',
    lensId: 'infinito_9_quadrados',
    tier: 4,
    expression: '95² (95 × 95) = ?',
    correctAnswer: 9025,
    shortHint: '💡 Quadrado Supremo Terminado em 5: Multiplique a dezena pelo seu sucessor imediato e anexe 25 ao final — qual número de 4 dígitos aparece?',
    stepByStep: [
      'Para elevar 95 ao quadrado de cabeça, olhe para a dezena 9.',
      'Multiplique 9 pelo seu sucessor 10: 9 × 10 = 90.',
      'Cole o 25 no final: 9025!',
    ],
    distractors: [
      {
        value: 8125,
        trapDiagnosis:
          '8125 é a armadilha de fazer 9 × 9 = 81! Multiplique o 9 pelo SUCESSOR 10 (9 × 10 = 90) → 9025!',
      },
      {
        value: 8525,
        trapDiagnosis:
          'Multiplique a dezena 9 pelo próximo número inteiro (10): 9 × 10 = 90 → 9025!',
      },
      {
        value: 9525,
        trapDiagnosis:
          '9 × 10 dá 90 nas centenas (e não 95), seguido de 25 → 9025!',
      },
    ],
  },

  // =========================================================================
  // LENTE 8: CORTA NO MEIO, DIVISORES & TRINCHEIRA DE FRAÇÕES (÷) — 'segredo-divisores'
  // =========================================================================
  {
    id: 'div_36_4',
    lensId: 'corta_no_meio_div',
    tier: 1,
    expression: '36 ÷ 4 = ?',
    correctAnswer: 9,
    shortHint: '💡 Corta no Meio 2×: Dividir por 4 é achar a metade da metade! Corte o número ao meio duas vezes seguidas — quanto dá?',
    stepByStep: [
      'Dividir por 4 é cortar ao meio duas vezes seguidas!',
      '1ª Metade: 36 ÷ 2 = 18.',
      '2ª Metade: 18 ÷ 2 = 9!',
    ],
    distractors: [
      {
        value: 8,
        trapDiagnosis:
          '8 × 4 = 32! A metade de 36 é 18, e a metade de 18 é 9 (9 × 4 = 36).',
      },
      {
        value: 12,
        trapDiagnosis:
          '12 é 36 ÷ 3! Para dividir por 4, tire a metade de 18 = 9.',
      },
      {
        value: 18,
        trapDiagnosis:
          '18 é apenas a 1ª metade (36 ÷ 2)! Corte mais uma vez ao meio para dividir por 4: 18 ÷ 2 = 9.',
      },
    ],
  },
  {
    id: 'div_48_4',
    lensId: 'corta_no_meio_div',
    tier: 1,
    expression: '48 ÷ 4 = ?',
    correctAnswer: 12,
    shortHint: '💡 Corta no Meio 2×: Tire a metade do número e depois corte essa metade ao meio novamente — qual é a quarta parte?',
    stepByStep: [
      '1ª Metade: 48 ÷ 2 = 24.',
      '2ª Metade: 24 ÷ 2 = 12!',
    ],
    distractors: [
      {
        value: 11,
        trapDiagnosis:
          '11 × 4 = 44! A metade de 24 é exatamente 12.',
      },
      {
        value: 14,
        trapDiagnosis:
          'Quase! Metade de 40 é 20→10 e metade de 8 é 4→2: 10 + 2 = 12!',
      },
      {
        value: 24,
        trapDiagnosis:
          '24 é a primeira metade (48 ÷ 2)! Corte o 24 ao meio mais uma vez → 12.',
      },
    ],
  },
  {
    id: 'div_84_4',
    lensId: 'corta_no_meio_div',
    tier: 2,
    expression: '84 ÷ 4 = ?',
    correctAnswer: 21,
    shortHint: '💡 Corta no Meio 2×: Divida tanto as dezenas quanto as unidades pela metade duas vezes — quanto resulta?',
    stepByStep: [
      '1ª Metade: 84 ÷ 2 = 42.',
      '2ª Metade: 42 ÷ 2 = 21!',
    ],
    distractors: [
      {
        value: 19,
        trapDiagnosis:
          '80 ÷ 4 já vale 20, mais 4 ÷ 4 (= 1) → 20 + 1 = 21!',
      },
      {
        value: 22,
        trapDiagnosis:
          'Quase! 4 ÷ 4 é 1 (e não 2), então 84 ÷ 4 = 21.',
      },
      {
        value: 42,
        trapDiagnosis:
          '42 é a primeira metade (84 ÷ 2)! Falta cortar o 42 ao meio → 21.',
      },
    ],
  },
  {
    id: 'div_85_5',
    lensId: 'corta_no_meio_div',
    tier: 2,
    expression: '85 ÷ 5 = ?',
    correctAnswer: 17,
    shortHint: '💡 Segredo de Dividir por 5: Dobre o número inteiro primeiro e depois divida por 10 cortando o zero final — quanto sobra?',
    stepByStep: [
      'Dividir por 5 é o mesmo que multiplicar por 2 e dividir por 10!',
      'O dobro de 85 é 170 (80×2=160 + 5×2=10).',
      'Cortando o zero de 170, sobra 17!',
    ],
    distractors: [
      {
        value: 15,
        trapDiagnosis:
          '15 × 5 = 75! Dobre o 85 (= 170) e tire o zero → 17.',
      },
      {
        value: 16,
        trapDiagnosis:
          '16 × 5 = 80 (porque o dobro de 80 é 160). Com mais 5 (85), o dobro é 170 → 17!',
      },
      {
        value: 18,
        trapDiagnosis:
          '18 × 5 = 90! Para 85 ÷ 5, o dobro de 85 é 170 → 17.',
      },
    ],
  },
  {
    id: 'div_60_12',
    lensId: 'corta_no_meio_div',
    tier: 2,
    expression: '60 ÷ 12 = ?',
    correctAnswer: 5,
    shortHint: '💡 Relógio Base-60: Simplifique cortando os dois números ao meio ou pense nos minutos de cada hora do relógio — quantos grupos cabem?',
    stepByStep: [
      'No relógio de 60 minutos com 12 marcações, cada marcação vale 5 minutos!',
      'Ou simplifique cortando ao meio: 60 ÷ 12 = 30 ÷ 6 = 5!',
    ],
    distractors: [
      {
        value: 4,
        trapDiagnosis:
          '4 × 12 = 48! Para completar os 60 minutos do relógio, são 5 grupos de 12.',
      },
      {
        value: 6,
        trapDiagnosis:
          '6 × 12 = 72 (6 × 10 = 60, mais 12 = 72)! Para dar 60, é 5 × 12 = 60.',
      },
      {
        value: 10,
        trapDiagnosis:
          '10 × 12 seria 120! A metade disso é 5 × 12 = 60.',
      },
    ],
  },
  {
    id: 'div_senhores_24_5_12',
    lensId: 'corta_no_meio_div',
    tier: 3,
    expression: '(24 × 5) ÷ 12 = ?',
    correctAnswer: 10,
    shortHint: '💡 Simplifique Antes de Multiplicar: Divida primeiro o fator múltiplo pelo divisor lá fora e só depois multiplique — quanto dá?',
    stepByStep: [
      'Nunca multiplique 24 × 5 primeiro se você pode simplificar os Senhores do Tempo!',
      '24 dividido por 12 dá exatamente 2.',
      'Agora multiplique pelo 5 restante: 2 × 5 = 10!',
    ],
    distractors: [
      {
        value: 5,
        trapDiagnosis:
          'Você dividiu 12 ÷ 12 = 1! Mas 24 é o DOBRO de 12 (24 ÷ 12 = 2), então 2 × 5 = 10.',
      },
      {
        value: 12,
        trapDiagnosis:
          'Simplifique 24 ÷ 12 = 2 primeiro, e depois faça 2 × 5 = 10!',
      },
      {
        value: 20,
        trapDiagnosis:
          '24 ÷ 12 é 2 (e não 4), logo 2 × 5 = 10!',
      },
    ],
  },
  {
    id: 'trincheira_36_21_7_9',
    lensId: 'corta_no_meio_div',
    tier: 3,
    expression: '(36 × 21) ÷ (7 × 9) = ?',
    correctAnswer: 12,
    shortHint: '💡 Trincheira de Frações: Proibido multiplicar 36 × 21! Simplifique cada fator de cima pelo seu divisor amigo lá embaixo — qual produto simples sobra?',
    stepByStep: [
      'Regra de Ouro das Frações (fracoes-operacoes): simplifique antes de multiplicar!',
      'Divida o 36 pelo 9 (= 4) e divida o 21 pelo 7 (= 3).',
      'Agora multiplique os sobreviventes: 4 × 3 = 12!',
    ],
    distractors: [
      {
        value: 7,
        trapDiagnosis:
          'Você somou 4 + 3 = 7 em vez de multiplicar! Como o sinal entre 36 e 21 é ×, fazemos 4 × 3 = 12.',
      },
      {
        value: 9,
        trapDiagnosis:
          'Quase! 36 ÷ 9 = 4 (e não 3). Multiplicando por 21 ÷ 7 (= 3), chegamos a 4 × 3 = 12!',
      },
      {
        value: 16,
        trapDiagnosis:
          '21 ÷ 7 é 3 (e não 4). Então 4 × 3 = 12!',
      },
    ],
  },
  {
    id: 'trincheira_45_16_9_8',
    lensId: 'corta_no_meio_div',
    tier: 3,
    expression: '(45 × 16) ÷ (9 × 8) = ?',
    correctAnswer: 10,
    shortHint: '💡 Corte Cruzado na Trincheira: Cancele cada número do primeiro grupo pelo seu divisor direto no segundo grupo — quanto dá o produto final?',
    stepByStep: [
      'Simplifique cada par compatível antes de multiplicar:',
      '45 ÷ 9 = 5, e 16 ÷ 8 = 2.',
      'Multiplicando os resultados: 5 × 2 = 10!',
    ],
    distractors: [
      {
        value: 7,
        trapDiagnosis:
          '7 é a soma (5 + 2)! Como estamos multiplicando os fatores simplificados, 5 × 2 = 10.',
      },
      {
        value: 15,
        trapDiagnosis:
          '16 ÷ 8 vale 2 (e não 3)! Portanto 5 × 2 = 10.',
      },
      {
        value: 20,
        trapDiagnosis:
          '45 ÷ 9 é 5, e 16 ÷ 8 é 2 → 5 × 2 = 10!',
      },
    ],
  },
]

export interface GenerateChallengeOptions {
  mode: GameMode
  interventionType: 'MORPH' | 'FILL_HOLE' | 'SECOND_WIND'
  level?: number
  targetPiece?: PieceType
  missingInRow?: number
  preferredOp?: ArithmeticOp
  preferredLensId?: TetrisMathLensId
  miracleTier?: MiraclePowerTier
  excludeIds?: string[]
  rng?: () => number
}

/**
 * Ensures 4 strictly unique, non-negative integer choices sorted in ascending numerical order
 * ([1] < [2] < [3] < [4]) with 100% diagnostic `trapDiagnosis` coverage on distractors
 * (Melhoria 02-B & Melhoria 02-C).
 */
function buildSortedUniqueChoices(
  correctAnswer: number,
  rawDistractors: ReadonlyArray<RawDistractor>
): MathChoice[] {
  const usedValues = new Set<number>([correctAnswer])
  const choices: MathChoice[] = [
    {
      value: correctAnswer,
      label: String(correctAnswer),
      isCorrect: true,
    },
  ]

  for (const d of rawDistractors) {
    if (choices.length >= 4) break
    const candidateVal = Math.max(0, Math.round(d.value))
    if (!usedValues.has(candidateVal)) {
      usedValues.add(candidateVal)
      choices.push({
        value: candidateVal,
        label: String(candidateVal),
        isCorrect: false,
        trapDiagnosis: d.trapDiagnosis,
      })
    }
  }

  // Fallback generator if any distractor collided
  const fallbackOffsets = [1, -1, 2, -2, 3, -3, 5, 10]
  for (const offset of fallbackOffsets) {
    if (choices.length >= 4) break
    const val = Math.max(0, correctAnswer + offset)
    if (!usedValues.has(val)) {
      usedValues.add(val)
      choices.push({
        value: val,
        label: String(val),
        isCorrect: false,
        trapDiagnosis: `Quase lá! Confira o ajuste na dezena pela Luz Guia: o equilíbrio exato da conta leva a ${correctAnswer}.`,
      })
    }
  }

  // Sort strictly ascending so [1] < [2] < [3] < [4] for instant eye-scanning (Melhoria 02-C)
  return choices.sort((a, b) => a.value - b.value)
}

/**
 * Appends live geometric context from the Tetris board to the pedagogical `stepByStep`
 * explanation (Melhoria 02-A).
 */
function enrichStepsWithBoardGeometry(
  baseSteps: string[],
  options: GenerateChallengeOptions
): string[] {
  const steps = [...baseSteps]

  if (options.interventionType === 'FILL_HOLE') {
    const tierSpec = options.miracleTier ? getMiracleTierSpec(options.miracleTier) : null
    if (tierSpec && tierSpec.tier >= 2) {
      steps.push(
        `👑 Milagre Escalonado (${tierSpec.badge}): Esta conta sela até ${tierSpec.maxHolesToSeal >= 100 ? 'TODOS os' : tierSpec.maxHolesToSeal} buracos de uma só vez!`
      )
    } else if (options.missingInRow !== undefined && options.missingInRow >= 1 && options.missingInRow <= 9) {
      const filled = 10 - options.missingInRow
      steps.push(
        `⚖️ Conexão Base-10 no Tabuleiro: A linha soterrada tem ${filled} blocos preenchidos e ${options.missingInRow} espaço(s) vazio(s) (${filled} + ${options.missingInRow} = 10)!`
      )
    } else {
      steps.push(
        '⚖️ Selo da Balança: Cada linha do Tetris tem 10 colunas. Resolver o complemento materializa cristais dourados nos buracos soterrados!'
      )
    }
  } else if (options.interventionType === 'MORPH' && options.targetPiece) {
    const def = getPieceDefinition(options.targetPiece)
    steps.push(
      `🔷 Alquimia Geométrica (${def.namePt} — Área ${def.areaFormula}): ${def.pedagogicalNote}`
    )
  } else if (options.interventionType === 'SECOND_WIND') {
    steps.push(
      '🔥 Protocolo Fênix 142857: O cálculo correto purifica as linhas inferiores da pilha e salva sua partida!'
    )
  }

  return steps
}

// ============================================================================
// EXPANSÃO V5: MOTOR DE SÍNTESE ALGÉBRICA ISOMÓRFICA INFINITA (32 ARQUÉTIPOS)
// & BARALHO ESTRATIFICADO ZERO-REPETIÇÃO (Master Plan 2026-10-23-05)
// ============================================================================

function rngInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function rngPick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] ?? arr[0]
}

interface IsomorphicArchetypeSpec {
  archetypeId: string
  tier: ProblemTier
  lensId: TetrisMathLensId
  supportsMissingResonance?: boolean
  synthesize: (rng: () => number, options: GenerateChallengeOptions) => RawMathTemplate
}

const SESSION_SEEN_IDS = new Set<string>()
const SESSION_SEEN_EXPRESSIONS = new Set<string>()
const RECENT_ARCHETYPE_RING: string[] = []
const MAX_SESSION_MEMORY = 400
const MAX_RECENT_ARCHETYPE_COOLDOWN = 4

function recordSeenChallenge(id: string, expression: string, archetypeId?: string): void {
  if (SESSION_SEEN_IDS.size >= MAX_SESSION_MEMORY) {
    const firstId = SESSION_SEEN_IDS.values().next().value
    if (firstId) SESSION_SEEN_IDS.delete(firstId)
  }
  if (SESSION_SEEN_EXPRESSIONS.size >= MAX_SESSION_MEMORY) {
    const firstExpr = SESSION_SEEN_EXPRESSIONS.values().next().value
    if (firstExpr) SESSION_SEEN_EXPRESSIONS.delete(firstExpr)
  }
  SESSION_SEEN_IDS.add(id)
  SESSION_SEEN_EXPRESSIONS.add(expression)

  if (archetypeId) {
    RECENT_ARCHETYPE_RING.push(archetypeId)
    if (RECENT_ARCHETYPE_RING.length > MAX_RECENT_ARCHETYPE_COOLDOWN) {
      RECENT_ARCHETYPE_RING.shift()
    }
  }
}

export function resetMathSessionMemory(): void {
  SESSION_SEEN_IDS.clear()
  SESSION_SEEN_EXPRESSIONS.clear()
  RECENT_ARCHETYPE_RING.length = 0
}

/**
 * 32 Parametric Isomorphic Archetype Generators across Tiers 1, 2, 3, and 4.
 * Generates 14,500+ unique, clean mental-math challenges with 100% Zero-Spoiler Socratic hints
 * and algebraically computed diagnostic distractors.
 */
const ISOMORPHIC_ARCHETYPE_GENERATORS: ReadonlyArray<IsomorphicArchetypeSpec> = [
  // ==========================================================================
  // ⚡ GRAU I (Tier 1 — Centelha Ágil · 3 Buracos) — 8 Famílias Isomórficas
  // ==========================================================================
  {
    archetypeId: 'arch_t1_falta_base10',
    tier: 1,
    lensId: 'amigos_do_10_falta',
    supportsMissingResonance: true,
    synthesize: (rng, options) => {
      const m =
        options.missingInRow !== undefined &&
        options.missingInRow >= 1 &&
        options.missingInRow <= 9
          ? options.missingInRow
          : rngInt(rng, 1, 9)
      const unitFilled = 10 - m
      const tensBase = rngPick(rng, [0, 10, 20, 30, 40, 50, 60, 70, 80])
      const variant = tensBase === 0 ? rngInt(rng, 0, 2) : rngInt(rng, 0, 1)
      const startVal = tensBase + unitFilled
      const targetVal = tensBase + 10

      const expression =
        variant === 0
          ? `${startVal} + [ ? ] = ${targetVal}`
          : variant === 1
            ? `[ ? ] + ${startVal} = ${targetVal}`
            : `${targetVal} − ${startVal} = ?`

      const d1 = m === 1 ? 2 : m - 1
      const d2 = m + 1
      const d3 = m + 2 === 10 - m ? m + 3 : m + 2

      return {
        id: `iso_arch_t1_falta_base10_${variant}_${startVal}_${targetVal}`,
        archetypeId: 'arch_t1_falta_base10',
        lensId: 'amigos_do_10_falta',
        tier: 1,
        missingBlockResonance: m,
        expression,
        correctAnswer: m,
        shortHint:
          '💡 Amigos do 10 na Linha: Olhe apenas para o algarismo das unidades — qual complemento fecha exatamente a dezena?',
        stepByStep: [
          `De ${startVal} para fechar a dezena redonda ${targetVal}, olhamos para a unidade ${unitFilled}.`,
          `O amigo de ${unitFilled} na Base 10 é ${m} (pois ${unitFilled} + ${m} = 10).`,
          `Logo, ${startVal} + ${m} = ${targetVal}!`,
        ],
        distractors: [
          {
            value: d1,
            trapDiagnosis: `Quase! Somando ${startVal} + ${d1} chegamos a ${startVal + d1}. O complemento exato de ${unitFilled} para fechar a dezena é ${m}!`,
          },
          {
            value: d2,
            trapDiagnosis: `Por 1 unidade! ${startVal} + ${d2} passaria para ${startVal + d2}. Para cravar ${targetVal}, a peça que falta é ${m}!`,
          },
          {
            value: d3,
            trapDiagnosis: `Olhe os Amigos do 10: como a unidade é ${unitFilled}, faltam exatamente ${m} blocos para completar ${targetVal}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t1_massinha',
    tier: 1,
    lensId: 'massinha_soma',
    synthesize: (rng) => {
      const tens = rngPick(rng, [10, 20, 30, 40, 50, 60])
      const unitA = rngPick(rng, [7, 8, 9])
      const A = tens + unitA
      const shift = 10 - unitA
      const B = rngInt(rng, shift + 2, 9)
      const roundA = A + shift
      const remB = B - shift
      const ans = A + B
      const swapOrder = rng() < 0.25

      return {
        id: `iso_arch_t1_massinha_${swapOrder ? `${B}_${A}` : `${A}_${B}`}`,
        archetypeId: 'arch_t1_massinha',
        lensId: 'massinha_soma',
        tier: 1,
        expression: swapOrder ? `${B} + ${A} = ?` : `${A} + ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Massinha da Soma: Empreste da parcela menor apenas o que falta para arredondar a dezena — quanto fica a soma?',
        stepByStep: [
          `O ${A} precisa de apenas +${shift} para virar a dezena redonda ${roundA}.`,
          `Tiramos ${shift} da massinha do ${B} (que vira ${remB}) e entregamos ao ${A} (que vira ${roundA}).`,
          `Agora somamos de cabeça: ${roundA} + ${remB} = ${ans}!`,
        ],
        distractors: [
          {
            value: roundA + B,
            trapDiagnosis: `Atenção à conservação da Massinha: o ${A} virou ${roundA} porque ganhou ${shift} do ${B}. Então o ${B} diminui para ${remB} → ${roundA} + ${remB} = ${ans}!`,
          },
          {
            value: ans - 1,
            trapDiagnosis: `Muito perto! O ${A} só precisava de ${shift} do ${B} (${B} − ${shift} = ${remB}), fechando ${roundA} + ${remB} = ${ans}!`,
          },
          {
            value: ans - 2,
            trapDiagnosis: `Quase lá! Emprestando ${shift} do ${B} para o ${A} virar ${roundA}, sobram ${remB} → ${roundA} + ${remB} = ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t1_hack_jap',
    tier: 1,
    lensId: 'hack_japones',
    synthesize: (rng) => {
      const subTens = rngPick(rng, [10, 20, 30, 40])
      const subUnit = rngPick(rng, [8, 9])
      const B = subTens + subUnit
      const shift = 10 - subUnit
      const minUnit = rngInt(rng, 1, subUnit - 2)
      const diffTens = rngPick(rng, [10, 20, 30])
      const A = subTens + diffTens + minUnit
      const newA = A + shift
      const newB = B + shift
      const ans = A - B

      return {
        id: `iso_arch_t1_hack_jap_${A}_${B}`,
        archetypeId: 'arch_t1_hack_jap',
        lensId: 'hack_japones',
        tier: 1,
        expression: `${A} − ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Hack Japonês: O Subtraendo é o Rei! Some a mesma quantidade nos DOIS números até zerar a unidade do segundo — qual é a diferença?',
        stepByStep: [
          `O subtraendo ${B} só precisa de +${shift} para virar a dezena redonda ${newB}.`,
          `Para manter a mesma distância, somamos +${shift} também no ${A} (que vira ${newA}).`,
          `Agora subtraímos sem pedir emprestado: ${newA} − ${newB} = ${ans}!`,
        ],
        distractors: [
          {
            value: A - newB,
            trapDiagnosis: `Armadilha da Balança! Você arredondou ${B} para ${newB} (+${shift}), mas esqueceu de somar +${shift} no ${A} → ${newA} − ${newB} = ${ans}!`,
          },
          {
            value: ans - 2 * shift,
            trapDiagnosis: `Cuidado! Na subtração, caminhamos na mesma direção: some +${shift} nos DOIS lados → ${newA} − ${newB} = ${ans}!`,
          },
          {
            value: ans + 10,
            trapDiagnosis: `A unidade está perfeita! Só ajuste as dezenas em ${newA} − ${newB} = ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t1_elevador',
    tier: 1,
    lensId: 'regra_elevador',
    synthesize: (rng) => {
      const topFloor = rngPick(rng, [30, 40, 50, 60, 70])
      const unitB = rngPick(rng, [2, 3, 4, 6, 7, 8])
      const tensGap = rngPick(rng, [10, 20])
      const B = topFloor - tensGap - (10 - unitB)
      const nextTen = B + (10 - unitB)
      const step1 = 10 - unitB
      const step2 = topFloor - nextTen
      const ans = topFloor - B

      return {
        id: `iso_arch_t1_elevador_${topFloor}_${B}`,
        archetypeId: 'arch_t1_elevador',
        lensId: 'regra_elevador',
        tier: 1,
        expression: `${topFloor} − ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Regra do Elevador: Suba primeiro até o próximo andar redondo e depois até o andar final — quantos andares você subiu ao todo?',
        stepByStep: [
          `Do andar ${B} até o andar redondo ${nextTen}, o elevador sobe +${step1} andares.`,
          `Do ${nextTen} até o topo ${topFloor}, sobe mais +${step2} andares.`,
          `Total da subida: ${step1} + ${step2} = ${ans}!`,
        ],
        distractors: [
          {
            value: ans + 10,
            trapDiagnosis: `Quando você sobe +${step1} a partir de ${B}, já chega no andar ${nextTen}! De ${nextTen} até ${topFloor} faltam só ${step2} → ${ans}.`,
          },
          {
            value: step2 + unitB,
            trapDiagnosis: `O amigo de ${unitB} para fechar ${nextTen} é ${step1} (pois ${unitB} + ${step1} = 10), e não ${unitB} → ${step2} + ${step1} = ${ans}!`,
          },
          {
            value: ans - 1,
            trapDiagnosis: `Por 1 andar! De ${B} até ${nextTen} são ${step1} andares, mais ${step2} até ${topFloor} = ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t1_dobro24',
    tier: 1,
    lensId: 'dobro_do_dobro_248',
    synthesize: (rng) => {
      const A = rngPick(rng, [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25])
      const firstDouble = A * 2
      const ans = A * 4
      const swap = rng() < 0.25

      return {
        id: `iso_arch_t1_dobro24_${swap ? `4_${A}` : `${A}_4`}`,
        archetypeId: 'arch_t1_dobro24',
        lensId: 'dobro_do_dobro_248',
        tier: 1,
        expression: swap ? `4 × ${A} = ?` : `${A} × 4 = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Dobro do Dobro: Multiplicar por 4 é dobrar o número duas vezes seguidas — qual é o dobro do dobro?',
        stepByStep: [
          `Multiplicar por 4 (a área de um Tetrominó!) é dobrar duas vezes seguidas.`,
          `1º Dobro: ${A} × 2 = ${firstDouble}.`,
          `2º Dobro: ${firstDouble} × 2 = ${ans}!`,
        ],
        distractors: [
          {
            value: firstDouble,
            trapDiagnosis: `${firstDouble} é apenas o 1º dobro (${A} × 2)! Dobre mais uma vez para chegar em ×4: ${firstDouble} × 2 = ${ans}.`,
          },
          {
            value: A * 3,
            trapDiagnosis: `${A * 3} equivale a ${A} × 3! Para ${A} × 4, faça o dobro de ${firstDouble} = ${ans}.`,
          },
          {
            value: ans - 4,
            trapDiagnosis: `Quase! O dobro de ${A} é ${firstDouble}, e o dobro de ${firstDouble} fecha exatamente ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t1_relogio5',
    tier: 1,
    lensId: 'relogio_5_dobra_meia',
    synthesize: (rng) => {
      const half = rngPick(rng, [4, 6, 7, 8, 9, 11, 12, 13, 14])
      const evenFactor = half * 2
      const ans = half * 10
      const swap = rng() < 0.25

      return {
        id: `iso_arch_t1_relogio5_${swap ? `5_${evenFactor}` : `${evenFactor}_5`}`,
        archetypeId: 'arch_t1_relogio5',
        lensId: 'relogio_5_dobra_meia',
        tier: 1,
        expression: swap ? `5 × ${evenFactor} = ?` : `${evenFactor} × 5 = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Lente Dobra e Meia: Multiplicar por 5 é metade de multiplicar por 10! Corte o número par ao meio e multiplique por 10 — quanto dá?',
        stepByStep: [
          `Cortamos o fator par ${evenFactor} pela metade (= ${half}) e dobramos o 5 (= 10).`,
          `A área permanece idêntica: ${half} × 10 = ${ans} instantaneamente!`,
        ],
        distractors: [
          {
            value: ans - 10,
            trapDiagnosis: `${ans - 10} seria ${(half - 1) * 2} × 5! A metade de ${evenFactor} é ${half}, que multiplicado por 10 dá ${ans}.`,
          },
          {
            value: ans - 5,
            trapDiagnosis: `Todo número par multiplicado por 5 termina em zero! Metade de ${evenFactor} é ${half} → ${ans}.`,
          },
          {
            value: ans + 5,
            trapDiagnosis: `${ans + 5} seria ${evenFactor + 1} × 5! Para o par ${evenFactor}, basta pegar a metade (${half}) seguida de zero = ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t1_truque9',
    tier: 1,
    lensId: 'infinito_9_quadrados',
    synthesize: (rng) => {
      const B = rngPick(rng, [4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15])
      const tenTimes = B * 10
      const ans = B * 9
      const swap = rng() < 0.5

      return {
        id: `iso_arch_t1_truque9_${swap ? `9_${B}` : `${B}_9`}`,
        archetypeId: 'arch_t1_truque9',
        lensId: 'infinito_9_quadrados',
        tier: 1,
        expression: swap ? `9 × ${B} = ?` : `${B} × 9 = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Truque do 9 (Base 10): Multiplique o número por 10 e depois subtraia 1 vez ele mesmo — quanto resta?',
        stepByStep: [
          `O 9 é uma linha de 10 colunas menos 1 (10 − 1).`,
          `Multiplicamos ${B} × 10 = ${tenTimes} e descontamos 1 vez o ${B}: ${tenTimes} − ${B} = ${ans}!`,
        ],
        distractors: [
          {
            value: tenTimes - 1,
            trapDiagnosis: `Cuidado! No Truque do 9 tiramos 1 grupo inteiro de ${B} (${tenTimes} − ${B} = ${ans}), e não apenas 1 unidade!`,
          },
          {
            value: ans - 9,
            trapDiagnosis: `${ans - 9} é 9 × ${B - 1}! Para 9 × ${B}, faça ${tenTimes} − ${B} = ${ans}.`,
          },
          {
            value: ans + 2,
            trapDiagnosis: `Quase! Descontando ${B} de ${tenTimes}, chegamos exatamente a ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t1_corta_div4',
    tier: 1,
    lensId: 'corta_no_meio_div',
    synthesize: (rng) => {
      const q = rngPick(rng, [6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18])
      const N = q * 4
      const half1 = q * 2

      return {
        id: `iso_arch_t1_corta_div4_${N}_4`,
        archetypeId: 'arch_t1_corta_div4',
        lensId: 'corta_no_meio_div',
        tier: 1,
        expression: `${N} ÷ 4 = ?`,
        correctAnswer: q,
        shortHint:
          '💡 Corta no Meio 2×: Dividir por 4 é achar a metade da metade! Corte o número ao meio duas vezes seguidas — quanto dá?',
        stepByStep: [
          `Dividir por 4 é cortar ao meio duas vezes seguidas:`,
          `1ª Metade: ${N} ÷ 2 = ${half1}.`,
          `2ª Metade: ${half1} ÷ 2 = ${q}!`,
        ],
        distractors: [
          {
            value: half1,
            trapDiagnosis: `${half1} é apenas a 1ª metade (${N} ÷ 2)! Corte ${half1} ao meio mais uma vez para dividir por 4 → ${q}.`,
          },
          {
            value: q - 1,
            trapDiagnosis: `${q - 1} × 4 daria ${(q - 1) * 4}! A metade de ${half1} é exatamente ${q}.`,
          },
          {
            value: q + 2,
            trapDiagnosis: `Quase! Cortando ${N} ao meio temos ${half1}, e a metade de ${half1} é ${q}!`,
          },
        ],
      }
    },
  },

  // ==========================================================================
  // 🔥 GRAU II (Tier 2 — Forja Dupla · 5 Buracos + 400 pts) — 8 Famílias
  // ==========================================================================
  {
    archetypeId: 'arch_t2_massinha_2d',
    tier: 2,
    lensId: 'massinha_soma',
    synthesize: (rng) => {
      const tensA = rngPick(rng, [20, 30, 40, 50, 60, 70])
      const unitA = rngPick(rng, [7, 8, 9])
      const A = tensA + unitA
      const shift = 10 - unitA
      const tensB = rngPick(rng, [10, 20, 30, 40])
      const unitB = rngInt(rng, shift + 2, 8)
      const B = tensB + unitB
      const roundA = A + shift
      const remB = B - shift
      const ans = A + B

      return {
        id: `iso_arch_t2_massinha_2d_${A}_${B}`,
        archetypeId: 'arch_t2_massinha_2d',
        lensId: 'massinha_soma',
        tier: 2,
        expression: `${A} + ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Massinha da Soma: Transfira o que falta para arredondar o primeiro termo e some com o que restou do segundo — qual é o valor?',
        stepByStep: [
          `O ${A} pede apenas +${shift} para fechar a dezena redonda ${roundA}.`,
          `Tiramos ${shift} do ${B} (que vira ${remB}) e entregamos ao ${A} (que vira ${roundA}).`,
          `Agora a soma fica limpa: ${roundA} + ${remB} = ${ans}!`,
        ],
        distractors: [
          {
            value: roundA + B,
            trapDiagnosis: `Se o ${A} ganhou +${shift} para virar ${roundA}, o ${B} precisa entregar esses ${shift} e virar ${remB} → ${roundA} + ${remB} = ${ans}!`,
          },
          {
            value: ans - 10,
            trapDiagnosis: `Atenção à subida de dezena: ${A} + ${shift} forma ${roundA}. Somando com ${remB} chegamos a ${ans}!`,
          },
          {
            value: ans - 2,
            trapDiagnosis: `Quase! Tirando ${shift} de ${B} sobram ${remB} → ${roundA} + ${remB} = ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t2_ponte_dezena',
    tier: 2,
    lensId: 'amigos_do_10_falta',
    supportsMissingResonance: true,
    synthesize: (rng, options) => {
      const step1 =
        options.missingInRow !== undefined &&
        options.missingInRow >= 1 &&
        options.missingInRow <= 6
          ? options.missingInRow
          : rngPick(rng, [2, 3, 4, 6, 7])
      const unitA = 10 - step1
      const tensA = rngPick(rng, [0, 10, 20, 30, 40])
      const A = tensA + unitA
      const bridge = tensA + 10
      const step2 = rngPick(rng, [0, 4, 5, 6, 7, 8, 10])
      const target = bridge + step2
      const ans = target - A

      return {
        id: `iso_arch_t2_ponte_dezena_${A}_${target}`,
        archetypeId: 'arch_t2_ponte_dezena',
        lensId: 'amigos_do_10_falta',
        tier: 2,
        missingBlockResonance: step1,
        expression: `${A} + [ ? ] = ${target}`,
        correctAnswer: ans,
        shortHint:
          '💡 Ponte da Dezena: Use a próxima dezena redonda como trampolim intermediário e some os saltos — qual é a distância total?',
        stepByStep: [
          `Use a dezena ${bridge} como trampolim: de ${A} até ${bridge} faltam +${step1}.`,
          step2 > 0
            ? `De ${bridge} até ${target} faltam mais +${step2} → somando os dois saltos: ${step1} + ${step2} = ${ans}!`
            : `Como o destino já é ${target}, faltam exatamente ${ans} unidades!`,
        ],
        distractors: [
          {
            value: Math.max(1, ans - 1),
            trapDiagnosis: `Quase! ${A} + ${Math.max(1, ans - 1)} chega em ${A + Math.max(1, ans - 1)}. Para fechar ${target}, faltam ${ans}!`,
          },
          {
            value: ans + 2,
            trapDiagnosis: `Pela Ponte da Dezena: de ${A} até ${bridge} são +${step1}, mais +${step2} até ${target} = ${ans}!`,
          },
          {
            value: ans + 10,
            trapDiagnosis: `Quando você soma +${step1} no ${A}, já sobe para a dezena ${bridge}! Daí até ${target} faltam apenas ${step2} → total ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t2_hack_jap_2d',
    tier: 2,
    lensId: 'hack_japones',
    synthesize: (rng) => {
      const subTens = rngPick(rng, [20, 30, 40, 50, 60])
      const subUnit = rngPick(rng, [7, 8, 9])
      const B = subTens + subUnit
      const shift = 10 - subUnit
      const minUnit = rngInt(rng, 1, subUnit - 2)
      const diffTens = rngPick(rng, [20, 30, 40, 50])
      const A = subTens + diffTens + minUnit
      const newA = A + shift
      const newB = B + shift
      const ans = A - B

      return {
        id: `iso_arch_t2_hack_jap_2d_${A}_${B}`,
        archetypeId: 'arch_t2_hack_jap_2d',
        lensId: 'hack_japones',
        tier: 2,
        expression: `${A} − ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Hack Japonês: Veja quanto falta para o subtraendo fechar dezena redonda e some esse mesmo valor nos dois termos — quanto dá?',
        stepByStep: [
          `O subtraendo ${B} precisa de +${shift} para virar a dezena redonda ${newB}.`,
          `Somamos +${shift} também no ${A} → ele vira ${newA}.`,
          `Agora é só fazer ${newA} − ${newB} = ${ans} sem nenhum empréstimo!`,
        ],
        distractors: [
          {
            value: A - newB,
            trapDiagnosis: `Quase! Você somou +${shift} no ${B} (virando ${newB}), mas esqueceu de somar +${shift} no ${A} → ${newA} − ${newB} = ${ans}!`,
          },
          {
            value: ans - 2 * shift,
            trapDiagnosis: `Você tirou ${shift} do ${A} em vez de somar! Na subtração, ambos avançam +${shift} juntos: ${newA} − ${newB} = ${ans}.`,
          },
          {
            value: ans + 10,
            trapDiagnosis: `A unidade ${ans % 10} está certíssima! Mas ${newA} − ${newB} resulta em ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t2_elevador_2d',
    tier: 2,
    lensId: 'regra_elevador',
    synthesize: (rng) => {
      if (rng() < 0.45) {
        const baseTen = rngPick(rng, [10, 20, 30, 40, 50])
        const sub = rngPick(rng, [6, 7, 8, 9])
        const add = rngPick(rng, [4, 5, 6, 7, 8, 9])
        const ans = baseTen + add - sub
        const bridgeRem = baseTen - sub
        return {
          id: `iso_arch_t2_elevador_bal_${baseTen}_${add}_${sub}`,
          archetypeId: 'arch_t2_elevador_2d',
          lensId: 'regra_elevador',
          tier: 2,
          expression: `${baseTen} + ${add} − ${sub} = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Balança Base-10: Em vez de seguir na ordem bruta, resolva primeiro a diferença a partir da dezena redonda e junte com a outra parcela — quanto dá?',
          stepByStep: [
            `Use a dezena redonda ${baseTen} a seu favor: ${baseTen} − ${sub} deixa ${bridgeRem}.`,
            `Agora junte com o alívio +${add}: ${bridgeRem} + ${add} = ${ans}!`,
          ],
          distractors: [
            {
              value: Math.max(1, ans - 2),
              trapDiagnosis: `Quase! Fazendo ${baseTen} − ${sub} = ${bridgeRem} e somando +${add}, chegamos a ${ans}!`,
            },
            {
              value: ans + 1,
              trapDiagnosis: `Por 1 unidade! ${baseTen} − ${sub} = ${bridgeRem}, mais ${add} = ${ans}.`,
            },
            {
              value: ans + 2,
              trapDiagnosis: `Olhe pela ponte da dezena: (${baseTen} − ${sub}) + ${add} = ${bridgeRem} + ${add} = ${ans}!`,
            },
          ],
        }
      }

      const top = rngPick(rng, [60, 70, 80, 90, 100])
      const unitB = rngPick(rng, [2, 3, 4, 6, 7, 8])
      const tensDiff = rngPick(rng, [20, 30, 40])
      const B = top - tensDiff - (10 - unitB)
      const nextTen = B + (10 - unitB)
      const step1 = 10 - unitB
      const step2 = top - nextTen
      const ans = top - B

      return {
        id: `iso_arch_t2_elevador_2d_${top}_${B}`,
        archetypeId: 'arch_t2_elevador_2d',
        lensId: 'regra_elevador',
        tier: 2,
        expression: `${top} − ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Regra do Elevador: Suba até a dezena redonda imediatamente acima e depois conte as dezenas até o topo — qual é a subida total?',
        stepByStep: [
          `De ${B} até ${nextTen} o elevador sobe +${step1} andares.`,
          `De ${nextTen} até ${top} sobe mais +${step2} andares.`,
          `Total da subida: ${step1} + ${step2} = ${ans}!`,
        ],
        distractors: [
          {
            value: step2 + unitB,
            trapDiagnosis: `O amigo de ${unitB} para fechar ${nextTen} é ${step1} (e não ${unitB}) → ${step2} + ${step1} = ${ans}!`,
          },
          {
            value: ans + 10,
            trapDiagnosis: `A unidade ${step1} está perfeita! Mas como ${B} + ${step1} já chega em ${nextTen}, de ${nextTen} até ${top} faltam ${step2} → ${ans}.`,
          },
          {
            value: Math.max(1, ans - 10),
            trapDiagnosis: `Confira as dezenas: de ${nextTen} até ${top} são ${step2} andares, mais ${step1} = ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t2_dobro_4_8',
    tier: 2,
    lensId: 'dobro_do_dobro_248',
    synthesize: (rng) => {
      const mult = rng() < 0.7 ? 4 : 8
      const A =
        mult === 4
          ? rngPick(rng, [16, 18, 23, 24, 26, 27, 28, 32, 35, 45])
          : rngPick(rng, [11, 12, 13, 14, 16])
      const ans = A * mult
      const d1 = A * 2
      const d2 = A * 4

      return {
        id: `iso_arch_t2_dobro_${A}_${mult}`,
        archetypeId: 'arch_t2_dobro_4_8',
        lensId: 'dobro_do_dobro_248',
        tier: 2,
        expression: `${A} × ${mult} = ?`,
        correctAnswer: ans,
        shortHint:
          mult === 4
            ? '💡 Dobro do Dobro: Dobre o primeiro fator uma vez e dobre o resultado novamente — quanto dá?'
            : '💡 Triplo Dobro (×8): Multiplicar por 8 é dobrar 3 vezes seguidas (×2 → ×2 → ×2) — qual valor surge?',
        stepByStep:
          mult === 4
            ? [
                `1º Dobro: ${A} × 2 = ${d1}.`,
                `2º Dobro: ${d1} × 2 = ${ans}!`,
              ]
            : [
                `1º Dobro: ${A} × 2 = ${d1}.`,
                `2º Dobro: ${d1} × 2 = ${d2}.`,
                `3º Dobro: ${d2} × 2 = ${ans}!`,
              ],
        distractors: [
          {
            value: mult === 4 ? d1 : d2,
            trapDiagnosis:
              mult === 4
                ? `${d1} é apenas o 1º dobro (${A} × 2)! Falta dobrar mais uma vez: ${d1} × 2 = ${ans}.`
                : `${d2} é ${A} × 4 (dois dobros)! Dobre mais uma vez para chegar em ×8: ${d2} × 2 = ${ans}.`,
          },
          {
            value: ans - 10,
            trapDiagnosis: `Olhe as dezenas: dobrando passo a passo chegamos exatamente a ${ans}!`,
          },
          {
            value: ans + 4,
            trapDiagnosis: `Quase! O dobro final fecha cravado em ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t2_dobra_11_101',
    tier: 2,
    lensId: 'relogio_5_dobra_meia',
    synthesize: (rng) => {
      const sub = rngInt(rng, 0, 2)
      if (sub === 0) {
        // Dobra e Meia: even * 15
        const half = rngPick(rng, [6, 7, 8, 9, 11, 12, 13, 14, 16])
        const evenA = half * 2
        const ans = half * 30
        return {
          id: `iso_arch_t2_dobra_meia_${evenA}_15`,
          archetypeId: 'arch_t2_dobra_11_101',
          lensId: 'relogio_5_dobra_meia',
          tier: 2,
          expression: `${evenA} × 15 = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Regra de Ouro (Dobra e Meia): Corte o fator par pela metade e dobre o 15 para virar dezena redonda — quanto dá o novo produto?',
          stepByStep: [
            `Pela conservação da área, cortamos ${evenA} pela metade (= ${half}) e dobramos 15 (= 30).`,
            `Agora multiplicamos sem esforço: ${half} × 30 = ${ans}!`,
          ],
          distractors: [
            {
              value: evenA * 10,
              trapDiagnosis: `${evenA * 10} é apenas ${evenA} × 10! Faltou somar a metade (${evenA} × 5 = ${half * 10}) → ${ans}.`,
            },
            {
              value: (half - 1) * 30,
              trapDiagnosis: `Quase! A metade de ${evenA} é ${half} (e não ${half - 1}). Fazendo ${half} × 30 chegamos a ${ans}!`,
            },
            {
              value: ans + 10,
              trapDiagnosis: `Como ${half} × 3 = ${half * 3}, então ${half} × 30 = ${ans}!`,
            },
          ],
        }
      }
      if (sub === 1) {
        // Segredo do 11: AB * 11 (where A + B <= 9)
        const d = rngInt(rng, 2, 8)
        const u = rngInt(rng, 1, 9 - d)
        const AB = d * 10 + u
        const mid = d + u
        const ans = d * 100 + mid * 10 + u
        return {
          id: `iso_arch_t2_onze_${AB}_11`,
          archetypeId: 'arch_t2_dobra_11_101',
          lensId: 'relogio_5_dobra_meia',
          tier: 2,
          expression: `${AB} × 11 = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Segredo do 11: Afaste os dois algarismos das pontas e coloque exatamente no meio a soma deles — que número de 3 dígitos surge?',
          stepByStep: [
            `No Truque do 11, abrimos os dígitos ${d} e ${u} nas pontas → ${d} [ _ ] ${u}.`,
            `No centro vai a soma dos dois algarismos (${d} + ${u} = ${mid}) → ${ans}!`,
          ],
          distractors: [
            {
              value: d * 100 + d * 10 + u,
              trapDiagnosis: `No centro colocamos a soma dos dígitos (${d} + ${u} = ${mid}), formando ${ans}!`,
            },
            {
              value: AB * 10 + u,
              trapDiagnosis: `${AB * 10} é ${AB} × 10! Somando mais ${AB} (ou colocando ${d} + ${u} = ${mid} no meio), temos ${ans}.`,
            },
            {
              value: ans + 10,
              trapDiagnosis: `Olhe a soma central: ${d} + ${u} vale ${mid} (e não ${mid + 1}), formando ${ans}!`,
            },
          ],
        }
      }
      // Espelho do 101: 101 * AB
      const AB = rngPick(rng, [14, 18, 23, 27, 34, 37, 42, 43, 52, 56, 63, 68, 74, 83, 92])
      const ans = AB * 101
      return {
        id: `iso_arch_t2_espelho_101_${AB}`,
        archetypeId: 'arch_t2_dobra_11_101',
        lensId: 'relogio_5_dobra_meia',
        tier: 2,
        expression: `101 × ${AB} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Espelho do 101: Multiplicar por 101 é somar 100 vezes o número com 1 vez ele mesmo — qual número espelhado se forma?',
        stepByStep: [
          `101 é 100 + 1 (o Espelho de 2 dígitos do Repositório Heiss-Lab!).`,
          `${AB} × 100 = ${AB * 100}, mais ${AB} × 1 = ${AB}.`,
          `O número se repete lado a lado no espelho: ${ans}!`,
        ],
        distractors: [
          {
            value: AB * 100 + (AB % 10),
            trapDiagnosis: `${AB * 100} + ${AB} preenche tanto a dezena quanto a unidade: o ${AB} se repete inteiro → ${ans}!`,
          },
          {
            value: ans + 100,
            trapDiagnosis: `${AB} × 100 é ${AB * 100}. Com mais ${AB}, forma o espelho perfeito ${ans}!`,
          },
          {
            value: ans - 10,
            trapDiagnosis: `Multiplicar por 101 repete os dois dígitos de ${AB} lado a lado: ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t2_fator_vizinho',
    tier: 2,
    lensId: 'infinito_9_quadrados',
    synthesize: (rng) => {
      if (rng() < 0.6) {
        const F = rngPick(rng, [13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28, 31, 32, 34, 36, 38])
        const a = rngPick(rng, [2, 3, 4, 6, 7, 8])
        const b = 10 - a
        const ans = F * 10
        return {
          id: `iso_arch_t2_fator_comum_${F}_${a}_${b}`,
          archetypeId: 'arch_t2_fator_vizinho',
          lensId: 'infinito_9_quadrados',
          tier: 2,
          expression: `${F} × ${a} + ${F} × ${b} = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Fator Comum em Evidência: O mesmo número multiplica os dois blocos! Coloque-o em evidência e some primeiro os dois parceiros — quanto dá?',
          stepByStep: [
            `Coloque o fator repetido ${F} em evidência: ${F} × (${a} + ${b}).`,
            `Como ${a} + ${b} fecha exatamente a dezena 10, temos ${F} × 10 = ${ans}!`,
          ],
          distractors: [
            {
              value: F * 9,
              trapDiagnosis: `${F * 9} seria ${F} × 9! Como ${a} + ${b} = 10, temos ${F} × 10 = ${ans}.`,
            },
            {
              value: F * 20,
              trapDiagnosis: `Não duplique o fator comum! ${a} grupos de ${F} + ${b} grupos de ${F} = 10 grupos de ${F} = ${ans}.`,
            },
            {
              value: (F - 1) * 10,
              trapDiagnosis: `O fator em evidência é ${F}: ${F} × (${a} + ${b}) = ${ans}!`,
            },
          ],
        }
      }

      // Vizinho da dezena: 19 * B or 29 * B
      const nearTen = rngPick(rng, [19, 29])
      const roundTen = nearTen + 1
      const B = rngPick(rng, [4, 5, 6, 7, 8, 9])
      const roundProd = roundTen * B
      const ans = roundProd - B
      return {
        id: `iso_arch_t2_vizinho_${nearTen}_${B}`,
        archetypeId: 'arch_t2_fator_vizinho',
        lensId: 'infinito_9_quadrados',
        tier: 2,
        expression: `${nearTen} × ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Vizinho da Dezena: Arredonde o primeiro fator para a dezena redonda acima, multiplique e desconte 1 grupo — qual é o valor?',
        stepByStep: [
          `${nearTen} está a 1 passo de ${roundTen} (${nearTen} = ${roundTen} − 1).`,
          `Multiplicamos ${roundTen} × ${B} = ${roundProd} e tiramos 1 vez o ${B}: ${roundProd} − ${B} = ${ans}!`,
        ],
        distractors: [
          {
            value: ans - 10,
            trapDiagnosis: `Cuidado na descida de dezena: ${roundProd} − ${B} fica em ${ans}!`,
          },
          {
            value: roundProd - 1,
            trapDiagnosis: `Descontamos 1 grupo inteiro de ${B} (${roundProd} − ${B} = ${ans}), e não apenas 1 unidade!`,
          },
          {
            value: ans + 2,
            trapDiagnosis: `Quase! De ${roundProd} tiramos ${B}, chegando exatamente a ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t2_div_5_4_12',
    tier: 2,
    lensId: 'corta_no_meio_div',
    synthesize: (rng) => {
      if (rng() < 0.6) {
        const q = rngPick(rng, [13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29])
        const N = q * 5
        const doubleN = q * 10
        return {
          id: `iso_arch_t2_div5_${N}_5`,
          archetypeId: 'arch_t2_div_5_4_12',
          lensId: 'corta_no_meio_div',
          tier: 2,
          expression: `${N} ÷ 5 = ?`,
          correctAnswer: q,
          shortHint:
            '💡 Segredo de Dividir por 5: Dobre o número inteiro primeiro e depois divida por 10 cortando o zero final — quanto sobra?',
          stepByStep: [
            `Dividir por 5 equivale a multiplicar por 2 e dividir por 10!`,
            `O dobro de ${N} é ${doubleN}.`,
            `Cortando o zero final de ${doubleN}, temos ${q}!`,
          ],
          distractors: [
            {
              value: q - 1,
              trapDiagnosis: `${q - 1} × 5 = ${(q - 1) * 5}! O dobro de ${N} é ${doubleN}, que sem o zero final vira ${q}.`,
            },
            {
              value: q + 1,
              trapDiagnosis: `${q + 1} × 5 = ${(q + 1) * 5}! Dobrando ${N} (= ${doubleN}) e cortando o zero, encontramos ${q}.`,
            },
            {
              value: q - 2,
              trapDiagnosis: `Use o atalho do dobro: 2 × ${N} = ${doubleN} → corte o zero = ${q}!`,
            },
          ],
        }
      }

      const q = rngPick(rng, [17, 18, 19, 21, 22, 23, 24, 26, 28, 31, 32])
      const N = q * 4
      const half1 = q * 2
      return {
        id: `iso_arch_t2_div4_${N}_4`,
        archetypeId: 'arch_t2_div_5_4_12',
        lensId: 'corta_no_meio_div',
        tier: 2,
        expression: `${N} ÷ 4 = ?`,
        correctAnswer: q,
        shortHint:
          '💡 Corta no Meio 2×: Divida o número pela metade duas vezes seguidas — quanto resulta?',
        stepByStep: [
          `1ª Metade: ${N} ÷ 2 = ${half1}.`,
          `2ª Metade: ${half1} ÷ 2 = ${q}!`,
        ],
        distractors: [
          {
            value: half1,
            trapDiagnosis: `${half1} é a 1ª metade (${N} ÷ 2)! Falta cortar ${half1} ao meio → ${q}.`,
          },
          {
            value: q - 1,
            trapDiagnosis: `Quase! A metade de ${half1} é exatamente ${q}.`,
          },
          {
            value: q + 1,
            trapDiagnosis: `Confira a unidade: ${half1} ÷ 2 fecha cravado em ${q}!`,
          },
        ],
      }
    },
  },

  // ==========================================================================
  // 🌟 GRAU III (Tier 3 — Supernova Simétrica · 10 Buracos + 1.000 pts) — 8 Famílias
  // ==========================================================================
  {
    archetypeId: 'arch_t3_massinha_100',
    tier: 3,
    lensId: 'massinha_soma',
    synthesize: (rng) => {
      const tensA = rngPick(rng, [60, 70, 80, 90, 120, 130, 140])
      const unitA = rngPick(rng, [7, 8, 9])
      const A = tensA + unitA
      const shift = 10 - unitA
      const tensB = rngPick(rng, [30, 40, 50, 60, 70])
      const unitB = rngInt(rng, shift + 2, 8)
      const B = tensB + unitB
      const roundA = A + shift
      const remB = B - shift
      const ans = A + B

      return {
        id: `iso_arch_t3_massinha_100_${A}_${B}`,
        archetypeId: 'arch_t3_massinha_100',
        lensId: 'massinha_soma',
        tier: 3,
        expression: `${A} + ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Massinha na Centena: Arredonde o primeiro termo entregando unidades do segundo e atravesse a centena sem esforço — quanto dá?',
        stepByStep: [
          `O ${A} pede apenas +${shift} para fechar ${roundA}.`,
          `Tiramos ${shift} do ${B} (que vira ${remB}) e formamos ${roundA} + ${remB}.`,
          `Resultado limpo: ${roundA} + ${remB} = ${ans}!`,
        ],
        distractors: [
          {
            value: ans - 10,
            trapDiagnosis: `Olhe a ponte da centena: ${A} + ${shift} sobe para ${roundA}, e ${roundA} + ${remB} = ${ans}!`,
          },
          {
            value: roundA + B,
            trapDiagnosis: `Lembre-se de descontar os ${shift} que saíram do ${B} para o ${A} virar ${roundA}: ${roundA} + ${remB} = ${ans}!`,
          },
          {
            value: ans - 2,
            trapDiagnosis: `Quase! Tirando ${shift} de ${B} sobram ${remB} → ${roundA} + ${remB} = ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t3_maquina_ponte',
    tier: 3,
    lensId: 'amigos_do_10_falta',
    synthesize: (rng) => {
      if (rng() < 0.65) {
        const a = rngPick(rng, [2, 3, 4, 5, 6])
        const x = rngPick(rng, [10, 12, 14, 15, 16, 18, 20, 22, 25])
        const b = rngPick(rng, [10, 12, 15, 20, 24, 30])
        const ax = a * x
        const rhs = ax - b
        return {
          id: `iso_arch_t3_maquina_${a}x_m${b}_${rhs}`,
          archetypeId: 'arch_t3_maquina_ponte',
          lensId: 'amigos_do_10_falta',
          tier: 3,
          expression: `${a}x − ${b} = ${rhs} → x = ?`,
          correctAnswer: x,
          shortHint:
            '💡 Máquina do Tempo das Equações: Rebobine o filme de trás para frente! Desfaça primeiro a subtração e depois a multiplicação — quanto vale x?',
          stepByStep: [
            `Na Máquina do Tempo, desfazemos a última operação primeiro.`,
            `O inverso de tirar ${b} é somar ${b}: ${rhs} + ${b} = ${ax}.`,
            `O inverso de multiplicar por ${a} é dividir por ${a}: ${ax} ÷ ${a} = ${x}!`,
          ],
          distractors: [
            {
              value: Math.max(1, Math.round(Math.abs(rhs - b) / a)),
              trapDiagnosis: `Cuidado! O inverso de "− ${b}" na Máquina do Tempo é "+ ${b}": faça (${rhs} + ${b}) ÷ ${a} = ${x}!`,
            },
            {
              value: Math.max(2, Math.round(rhs / a)),
              trapDiagnosis: `Desfaça o "− ${b}" primeiro somando ${rhs} + ${b} = ${ax}, e só depois divida por ${a} → ${x}!`,
            },
            {
              value: x + 4,
              trapDiagnosis: `Quase! Como ${rhs} + ${b} = ${ax}, dividindo ${ax} por ${a} chegamos a ${x}.`,
            },
          ],
        }
      }

      const target = rngPick(rng, [60, 70, 80, 90, 100])
      const unitA = rngPick(rng, [2, 3, 4, 6, 7, 8])
      const tensGap = rngPick(rng, [20, 30, 40])
      const A = target - tensGap - (10 - unitA)
      const nextTen = A + (10 - unitA)
      const step1 = 10 - unitA
      const step2 = target - nextTen
      const ans = target - A

      return {
        id: `iso_arch_t3_ponte_${A}_${target}`,
        archetypeId: 'arch_t3_maquina_ponte',
        lensId: 'amigos_do_10_falta',
        tier: 3,
        expression: `${A} + [ ? ] = ${target}`,
        correctAnswer: ans,
        shortHint:
          '💡 Ponte da Dezena: Complete primeiro até a dezena redonda seguinte e depois suba as dezenas restantes — quanto falta?',
        stepByStep: [
          `De ${A} até ${nextTen} faltam +${step1}.`,
          `De ${nextTen} até ${target} faltam +${step2}.`,
          `Somando os dois degraus: ${step1} + ${step2} = ${ans}!`,
        ],
        distractors: [
          {
            value: ans + 10,
            trapDiagnosis: `Pegadinha clássica: ao somar +${step1} no ${A}, já subimos para ${nextTen}! Daí até ${target} faltam só ${step2} → ${ans}.`,
          },
          {
            value: step2 + unitA,
            trapDiagnosis: `O amigo de ${unitA} para fechar ${nextTen} é ${step1} (e não ${unitA}) → ${step2} + ${step1} = ${ans}!`,
          },
          {
            value: ans - 1,
            trapDiagnosis: `Por 1 unidade! ${A} + ${step1} = ${nextTen}, mais ${step2} = ${target} → ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t3_hack_99',
    tier: 3,
    lensId: 'hack_japones',
    synthesize: (rng) => {
      const top = rngPick(rng, [100, 200, 300])
      const tensB = rngPick(rng, [20, 30, 40, 50, 60, 70, 80])
      const unitB = rngPick(rng, [2, 3, 4, 6, 7, 8, 9])
      const B = (top === 300 ? 100 : 0) + tensB + unitB
      const shift = 10 - unitB
      const ans = top - B

      return {
        id: `iso_arch_t3_hack_99_${top}_${B}`,
        archetypeId: 'arch_t3_hack_99',
        lensId: 'hack_japones',
        tier: 3,
        expression: `${top} − ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Hack do 99 (Sem Empréstimo): Tire 1 dos dois lados para transformar a centena em 99 ou suba os dois juntos — quanto dá?',
        stepByStep: [
          `Caminho A (Truque do 99): Tire 1 dos dois lados → ${top - 1} − ${B - 1} = ${ans} (sem pedir emprestado!).`,
          `Caminho B (Hack Japonês +${shift}): Some +${shift} nos dois → ${top + shift} − ${B + shift} = ${ans}!`,
        ],
        distractors: [
          {
            value: ans + 10,
            trapDiagnosis: `Pegadinha da Centena! Quando completamos ${B} + ${shift}, já estamos em ${B + shift}. De ${B + shift} até ${top} faltam ${ans - shift} → total ${ans}!`,
          },
          {
            value: ans - shift + unitB,
            trapDiagnosis: `O complemento de ${unitB} para 10 é ${shift} (e não ${unitB}) → ${ans}!`,
          },
          {
            value: ans + 10 - shift + unitB,
            trapDiagnosis: `Usando ${top - 1} − ${B - 1}, subtraímos dígito a dígito sem empréstimo e chegamos a ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t3_elevador_100',
    tier: 3,
    lensId: 'regra_elevador',
    synthesize: (rng) => {
      const top = rngPick(rng, [110, 120, 130, 140, 150])
      const tensB = rngPick(rng, [60, 70, 80, 90])
      const unitB = rngPick(rng, [2, 3, 4, 6, 7, 8])
      const B = tensB + unitB
      const nextTen = tensB + 10
      const step1 = 10 - unitB
      const step2 = top - nextTen
      const ans = top - B

      return {
        id: `iso_arch_t3_elevador_100_${top}_${B}`,
        archetypeId: 'arch_t3_elevador_100',
        lensId: 'regra_elevador',
        tier: 3,
        expression: `${top} − ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Elevador na Centena: Suba até a próxima dezena redonda e depois meça os andares até o topo — qual é a distância total?',
        stepByStep: [
          `De ${B} até ${nextTen} subimos +${step1}.`,
          `De ${nextTen} até ${top} subimos +${step2}.`,
          `Juntando os dois trechos: ${step2} + ${step1} = ${ans}!`,
        ],
        distractors: [
          {
            value: ans - 10,
            trapDiagnosis: `A unidade ${step1} está ótima! Mas de ${nextTen} até ${top} são ${step2} andares → ${step2} + ${step1} = ${ans}.`,
          },
          {
            value: step2 + unitB,
            trapDiagnosis: `O amigo de ${unitB} para fechar ${nextTen} é ${step1} (pois ${unitB} + ${step1} = 10) → ${step2} + ${step1} = ${ans}!`,
          },
          {
            value: ans + 10,
            trapDiagnosis: `Ao somar +${step1} no ${B}, você já chegou em ${nextTen}. De ${nextTen} até ${top} são ${step2} → ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t3_triplo_dobro',
    tier: 3,
    lensId: 'dobro_do_dobro_248',
    synthesize: (rng) => {
      const A = rngPick(rng, [12, 13, 14, 15, 16, 17, 18, 21, 22, 24, 25, 35, 45])
      const d1 = A * 2
      const d2 = A * 4
      const ans = A * 8

      return {
        id: `iso_arch_t3_triplo_dobro_${A}_8`,
        archetypeId: 'arch_t3_triplo_dobro',
        lensId: 'dobro_do_dobro_248',
        tier: 3,
        expression: `${A} × 8 = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Triplo Dobro (×8): Multiplicar por 8 é dobrar 3 vezes seguidas (×2 → ×2 → ×2) — aonde você chega?',
        stepByStep: [
          `Multiplicar por 8 é dobrar 3 vezes seguidas:`,
          `${A} × 2 = ${d1} → ${d1} × 2 = ${d2} → ${d2} × 2 = ${ans}!`,
        ],
        distractors: [
          {
            value: d2,
            trapDiagnosis: `${d2} é ${A} × 4 (apenas dois dobros)! Dobre mais uma vez para chegar em ×8: ${d2} × 2 = ${ans}.`,
          },
          {
            value: A * 6,
            trapDiagnosis: `${A * 6} é ${A} × 6! Dobre o ${d2} (que é ${A} × 4) e você chega direto em ${ans}.`,
          },
          {
            value: ans - 10,
            trapDiagnosis: `Confira o 3º dobro: o dobro de ${d2} fecha exatamente em ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t3_dobra_25_11',
    tier: 3,
    lensId: 'relogio_5_dobra_meia',
    synthesize: (rng) => {
      const k = rngPick(rng, [3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16])
      const A = k * 4
      const ans = k * 100

      return {
        id: `iso_arch_t3_dobra25_${A}_25`,
        archetypeId: 'arch_t3_dobra_25_11',
        lensId: 'relogio_5_dobra_meia',
        tier: 3,
        expression: `${A} × 25 = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Dobra e Meia Duplo (×25): Como 25 × 4 fecha 100, divida o primeiro fator por 4 e multiplique por 100 — quanto dá?',
        stepByStep: [
          `Transforme o retângulo duas vezes (ou divida por 4 e multiplique por 100):`,
          `${A} × 25 = ${A / 2} × 50 = ${k} × 100 = ${ans}!`,
        ],
        distractors: [
          {
            value: (k * 100) / 2,
            trapDiagnosis: `${(k * 100) / 2} é apenas metade do caminho! Como ${A} ÷ 4 = ${k}, temos ${k} × 100 = ${ans}.`,
          },
          {
            value: (k - 1) * 100,
            trapDiagnosis: `${(k - 1) * 100} seria ${(k - 1) * 4} × 25! Dividindo ${A} por 4 temos ${k} → ${ans}.`,
          },
          {
            value: (k + 1) * 100,
            trapDiagnosis: `Divida ${A} por 4 (metade de ${A} é ${A / 2}, metade é ${k}) e multiplique por 100 = ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t3_diff_quad_5',
    tier: 3,
    lensId: 'infinito_9_quadrados',
    synthesize: (rng) => {
      const sub = rngInt(rng, 0, 2)
      if (sub === 0) {
        // Symmetric product around C: (C - d)(C + d) = C^2 - d^2
        const C = rngPick(rng, [20, 30, 40, 50, 60])
        const d = rngPick(rng, [1, 2, 3, 4])
        const f1 = C - d
        const f2 = C + d
        const cSq = C * C
        const dSq = d * d
        const ans = cSq - dSq
        const swap = rng() < 0.4
        return {
          id: `iso_arch_t3_diff_quad_${swap ? `${f2}_${f1}` : `${f1}_${f2}`}`,
          archetypeId: 'arch_t3_diff_quad_5',
          lensId: 'infinito_9_quadrados',
          tier: 3,
          expression: swap ? `${f2} × ${f1} = ?` : `${f1} × ${f2} = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Diferença de Quadrados (a² − b²): Descubra a dezena redonda exatamente no meio dos dois fatores e calcule (Centro)² − (Distância)² — qual valor surge?',
          stepByStep: [
            `${f1} e ${f2} estão à mesma distância (${d}) do centro redondo ${C}: (${C} − ${d}) × (${C} + ${d}).`,
            `Pela Diferença de Quadrados: ${C}² − ${d}² = ${cSq} − ${dSq}.`,
            `Resultado imediato: ${ans}!`,
          ],
          distractors: [
            {
              value: cSq - 2 * d,
              trapDiagnosis: `Quase! Na Diferença de Quadrados subtraímos o QUADRADO da distância (${d}² = ${dSq}), e não o dobro → ${cSq} − ${dSq} = ${ans}!`,
            },
            {
              value: cSq + dSq,
              trapDiagnosis: `Cuidado com o sinal: (${C} − ${d})(${C} + ${d}) é ${C}² MENOS ${d}², logo tiramos ${dSq} de ${cSq} → ${ans}!`,
            },
            {
              value: ans - 10,
              trapDiagnosis: `Muito perto! De ${cSq} tirando ${dSq}, permanecemos em ${ans}!`,
            },
          ],
        }
      }
      if (sub === 1) {
        // Squares ending in 5: (10n + 5)^2
        const n = rngPick(rng, [2, 3, 4, 5, 6, 7, 8])
        const num = n * 10 + 5
        const head = n * (n + 1)
        const ans = head * 100 + 25
        return {
          id: `iso_arch_t3_quad5_${num}`,
          archetypeId: 'arch_t3_diff_quad_5',
          lensId: 'infinito_9_quadrados',
          tier: 3,
          expression: `${num}² (${num} × ${num}) = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Quadrados Terminados em 5: Multiplique o algarismo das dezenas pelo seu sucessor imediato n × (n + 1) e cole 25 no final — que número se forma?',
          stepByStep: [
            `Todo quadrado terminado em 5 termina em 25!`,
            `Multiplique a dezena ${n} pelo seu sucessor imediato (${n + 1}): ${n} × ${n + 1} = ${head}.`,
            `Anexe 25 à direita: ${ans}!`,
          ],
          distractors: [
            {
              value: n * n * 100 + 25,
              trapDiagnosis: `Armadilha clássica: você fez ${n} × ${n} = ${n * n}! O segredo é multiplicar a dezena ${n} pelo SUCESSOR ${n + 1} (${n} × ${n + 1} = ${head}) → ${ans}!`,
            },
            {
              value: (head - 2) * 100 + 25,
              trapDiagnosis: `Quase! O produto da dezena ${n} pelo sucessor ${n + 1} vale ${head} → ${ans}.`,
            },
            {
              value: n * (n + 2) * 100 + 25,
              trapDiagnosis: `O sucessor imediato de ${n} é ${n + 1} (${n} × ${n + 1} = ${head}), formando ${ans}!`,
            },
          ],
        }
      }
      // Subtractive Common Factor: F * (b + 10) - F * b
      const F = rngPick(rng, [18, 24, 27, 32, 35, 42, 45, 54, 63, 75])
      const b = rngPick(rng, [4, 6, 7, 8, 9, 12, 14])
      const a = b + 10
      const ans = F * 10
      return {
        id: `iso_arch_t3_fator_sub_${F}_${a}_${b}`,
        archetypeId: 'arch_t3_diff_quad_5',
        lensId: 'infinito_9_quadrados',
        tier: 3,
        expression: `${F} × ${a} − ${F} × ${b} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Fator Comum na Subtração: Coloque o número repetido em evidência e subtraia primeiro os dois multiplicadores — quanto resta?',
        stepByStep: [
          `${a} grupos de ${F} menos ${b} grupos de ${F} deixam (${a} − ${b}) grupos de ${F}.`,
          `Como ${a} − ${b} = 10, fazemos ${F} × 10 = ${ans} em 1 segundo!`,
        ],
        distractors: [
          {
            value: F * 9,
            trapDiagnosis: `${a} − ${b} fecha exatamente 10 (e não 9)! Multiplicando ${F} × 10 temos ${ans}.`,
          },
          {
            value: F * 20,
            trapDiagnosis: `Como estamos subtraindo (${a} − ${b} = 10), o resultado é ${F} × 10 = ${ans}!`,
          },
          {
            value: F * 8,
            trapDiagnosis: `Coloque o ${F} em evidência: ${F} × (${a} − ${b}) = ${F} × 10 = ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t3_trincheira',
    tier: 3,
    lensId: 'corta_no_meio_div',
    synthesize: (rng) => {
      const pairs: ReadonlyArray<[number, number, number, number]> = [
        [9, 4, 7, 3],
        [9, 5, 8, 2],
        [8, 4, 7, 3],
        [6, 5, 7, 4],
        [9, 3, 5, 4],
        [8, 5, 9, 2],
        [7, 4, 6, 3],
        [12, 3, 5, 4],
        [11, 3, 6, 4],
        [9, 6, 7, 2],
      ]
      const [d1, q1, d2, q2] = rngPick(rng, pairs)
      const N1 = d1 * q1
      const N2 = d2 * q2
      const ans = q1 * q2

      return {
        id: `iso_arch_t3_trincheira_${N1}_${N2}_${d2}_${d1}`,
        archetypeId: 'arch_t3_trincheira',
        lensId: 'corta_no_meio_div',
        tier: 3,
        expression: `(${N1} × ${N2}) ÷ (${d2} × ${d1}) = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Trincheira de Frações: Proibido multiplicar os números grandes! Simplifique cada fator do primeiro grupo pelo seu divisor amigo no segundo — qual produto simples sobra?',
        stepByStep: [
          `Regra de Ouro das Frações: simplifique antes de multiplicar!`,
          `Divida ${N1} por ${d1} (= ${q1}) e divida ${N2} por ${d2} (= ${q2}).`,
          `Agora multiplique os sobreviventes: ${q1} × ${q2} = ${ans}!`,
        ],
        distractors: [
          {
            value: q1 + q2,
            trapDiagnosis: `Você somou ${q1} + ${q2} = ${q1 + q2} em vez de multiplicar! Como o sinal entre os termos é ×, fazemos ${q1} × ${q2} = ${ans}.`,
          },
          {
            value: (q1 - 1) * q2,
            trapDiagnosis: `Quase! ${N1} ÷ ${d1} = ${q1}, e ${N2} ÷ ${d2} = ${q2} → ${q1} × ${q2} = ${ans}!`,
          },
          {
            value: q1 * (q2 + 1),
            trapDiagnosis: `${N2} ÷ ${d2} vale ${q2} (e não ${q2 + 1}). Portanto ${q1} × ${q2} = ${ans}!`,
          },
        ],
      }
    },
  },

  // ==========================================================================
  // 👑 GRAU IV (Tier 4 — Gênesis Absoluto · TODOS os Buracos + 🛡️ Fênix) — 8 Famílias
  // ==========================================================================
  {
    archetypeId: 'arch_t4_diff_sq_inv',
    tier: 4,
    lensId: 'infinito_9_quadrados',
    synthesize: (rng) => {
      const C = rngPick(rng, [30, 40, 50, 60, 70, 80, 90, 100])
      const d = rngPick(rng, [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 15])
      const a = C + d
      const b = C - d
      const sumAB = a + b // 2C
      const diffAB = a - b // 2d
      const ans = sumAB * diffAB

      return {
        id: `iso_arch_t4_diff_sq_inv_${a}_${b}`,
        archetypeId: 'arch_t4_diff_sq_inv',
        lensId: 'infinito_9_quadrados',
        tier: 4,
        expression: `${a}² − ${b}² = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Diferença de Quadrados Inversa: Proibido elevar ao quadrado no braço! Use a² − b² = (a + b) × (a − b): multiplique a soma dos dois pela diferença entre eles — quanto dá?',
        stepByStep: [
          `Pela identidade áurea a² − b² = (a + b) × (a − b):`,
          `Soma dos termos: ${a} + ${b} = ${sumAB}.`,
          `Diferença dos termos: ${a} − ${b} = ${diffAB}.`,
          `Multiplicando de cabeça: ${sumAB} × ${diffAB} = ${ans}!`,
        ],
        distractors: [
          {
            value: diffAB * diffAB,
            trapDiagnosis: `${diffAB * diffAB} é apenas (${a} − ${b})² = ${diffAB}²! Multiplique a SOMA (${sumAB}) pela DIFERENÇA (${diffAB}) → ${ans}!`,
          },
          {
            value: sumAB * d,
            trapDiagnosis: `Quase! A distância total entre ${b} e ${a} é ${d} + ${d} = ${diffAB} (e não ${d}). Multiplicando por ${sumAB}: ${sumAB} × ${diffAB} = ${ans}!`,
          },
          {
            value: sumAB * (diffAB + 2),
            trapDiagnosis: `A soma ${a} + ${b} fecha ${sumAB} e a diferença ${a} − ${b} vale ${diffAB} → ${sumAB} × ${diffAB} = ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t4_fator_100',
    tier: 4,
    lensId: 'infinito_9_quadrados',
    synthesize: (rng) => {
      const F = rngPick(
        rng,
        [
          13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29, 31, 32, 33, 34,
          36, 37, 38, 39, 41, 42, 43, 44, 46, 47, 48, 51, 52, 53, 54, 56, 57, 58,
          61, 62, 63, 64, 67, 68, 71, 72, 73, 74, 76, 78, 81, 82, 83, 84, 86, 87,
          91, 92, 93, 94, 96, 97,
        ]
      )
      const isSubtraction = rng() < 0.35
      if (isSubtraction) {
        const B = rngInt(rng, 12, 48)
        const A = B + 100
        const ans = F * 100
        return {
          id: `iso_arch_t4_fator100_sub_${F}_${A}_${B}`,
          archetypeId: 'arch_t4_fator_100',
          lensId: 'infinito_9_quadrados',
          tier: 4,
          expression: `${F} × ${A} − ${F} × ${B} = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Fator Comum Centenário: Coloque o fator repetido em evidência e subtraia primeiro os dois parceiros que fecham uma centena — qual é o resultado?',
          stepByStep: [
            `O fator ${F} aparece nos dois blocos: coloque-o em evidência → ${F} × (${A} − ${B}).`,
            `Como ${A} − ${B} = 100, basta acrescentar dois zeros ao ${F}: ${ans}!`,
          ],
          distractors: [
            {
              value: F * 10,
              trapDiagnosis: `Quase! ${A} − ${B} fecha 100 (uma centena, com dois zeros), e não 10 → ${F} × 100 = ${ans}!`,
            },
            {
              value: F * 90,
              trapDiagnosis: `${A} − ${B} fecha exatamente 100! Basta multiplicar ${F} × 100 = ${ans}.`,
            },
            {
              value: F * 200,
              trapDiagnosis: `O fator comum ${F} fica em evidência uma única vez: ${F} × (${A} − ${B}) = ${ans}!`,
            },
          ],
        }
      }

      const tensA = rngPick(rng, [10, 20, 30, 40, 60, 70, 80])
      const unitA = rngPick(rng, [1, 2, 3, 4, 6, 7, 8, 9])
      const A = tensA + unitA
      const B = 100 - A
      const ans = F * 100

      return {
        id: `iso_arch_t4_fator100_add_${F}_${A}_${B}`,
        archetypeId: 'arch_t4_fator_100',
        lensId: 'infinito_9_quadrados',
        tier: 4,
        expression: `${F} × ${A} + ${F} × ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Fator Comum Centenário: Coloque o fator repetido em evidência e some primeiro os dois parceiros que fecham uma centena redonda — qual é o total?',
        stepByStep: [
          `O número ${F} multiplica ambos os blocos: coloque-o em evidência → ${F} × (${A} + ${B}).`,
          `Como ${A} + ${B} = 100, fazemos ${F} × 100 = ${ans} instantaneamente!`,
        ],
        distractors: [
          {
            value: F * 10,
            trapDiagnosis: `Quase! ${A} + ${B} fecha 100 (dois zeros), e não 10 → ${F} × 100 = ${ans}!`,
          },
          {
            value: F * 90,
            trapDiagnosis: `As unidades ${unitA} + ${10 - unitA} fecham mais uma dezena, completando ${A} + ${B} = 100 → ${ans}!`,
          },
          {
            value: F * 200,
            trapDiagnosis: `Cuidado para não somar ${F} + ${F}! O fator comum ${F} fica em evidência uma só vez: ${F} × 100 = ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t4_milenar_125',
    tier: 4,
    lensId: 'dobro_do_dobro_248',
    synthesize: (rng) => {
      if (rng() < 0.72) {
        const k = rngPick(rng, [2, 3, 4, 5, 6, 7, 8, 9, 11, 12])
        const A = k * 8
        const ans = k * 1000
        return {
          id: `iso_arch_t4_milenar_${A}_125`,
          archetypeId: 'arch_t4_milenar_125',
          lensId: 'dobro_do_dobro_248',
          tier: 4,
          expression: `${A} × 125 = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Fatoração Milenar (×125): Sabendo que 8 × 125 fecha um milhar exato (1000), descubra quantos grupos de 8 cabem no primeiro fator — qual milhar aparece?',
          stepByStep: [
            `O segredo do 125 é que ele é a oitava parte de 1000 (8 × 125 = 1000).`,
            `Divida ${A} por 8 (= ${k}) e multiplique o 125 por 8 (= 1000).`,
            `${k} × 1000 = ${ans} de cabeça!`,
          ],
          distractors: [
            {
              value: (k - 1) * 1000,
              trapDiagnosis: `${(k - 1) * 1000} seria ${(k - 1) * 8} × 125! Como ${A} ÷ 8 = ${k}, temos ${k} × 1000 = ${ans}.`,
            },
            {
              value: A * 100,
              trapDiagnosis: `${A * 100} é apenas ${A} × 100! Dividindo ${A} por 8 (= ${k}) e multiplicando por 1000, fechamos ${ans}.`,
            },
            {
              value: (k + 1) * 1000,
              trapDiagnosis: `Como ${k} × 8 = ${A}, o produto ${A} × 125 fecha exatamente ${k} × 1000 = ${ans}!`,
            },
          ],
        }
      }

      // A * 250 where 4 * 250 = 1000
      const k = rngPick(rng, [3, 5, 6, 7, 9, 11, 12, 14, 15])
      const A = k * 4
      const ans = k * 1000
      return {
        id: `iso_arch_t4_milenar_${A}_250`,
        archetypeId: 'arch_t4_milenar_125',
        lensId: 'dobro_do_dobro_248',
        tier: 4,
        expression: `${A} × 250 = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Fatoração Milenar (×250): Como 4 × 250 fecha 1000, divida o primeiro fator por 4 — quantos milhares se formam?',
        stepByStep: [
          `4 grupos de 250 formam exatamente 1000 (4 × 250 = 1000).`,
          `Divida ${A} por 4 (= ${k}) e multiplique por 1000 → ${ans}!`,
        ],
        distractors: [
          {
            value: (k - 1) * 1000,
            trapDiagnosis: `Dividindo ${A} por 4 encontramos ${k} (pois 4 × ${k} = ${A}) → ${k} × 1000 = ${ans}!`,
          },
          {
            value: A * 100,
            trapDiagnosis: `Cada grupo de 4 vale 1000: ${A} ÷ 4 = ${k} → ${ans}!`,
          },
          {
            value: (k + 1) * 1000,
            trapDiagnosis: `Quase! ${A} ÷ 4 = ${k}, portanto ${k} × 1000 = ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t4_quad_supremo',
    tier: 4,
    lensId: 'infinito_9_quadrados',
    synthesize: (rng) => {
      if (rng() < 0.5) {
        const n = rngPick(rng, [5, 7, 8, 9, 10, 11])
        const num = n * 10 + 5
        const head = n * (n + 1)
        const ans = head * 100 + 25
        return {
          id: `iso_arch_t4_quad_sup_${num}`,
          archetypeId: 'arch_t4_quad_supremo',
          lensId: 'infinito_9_quadrados',
          tier: 4,
          expression: `${num}² (${num} × ${num}) = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Quadrado Supremo Terminado em 5: Multiplique as dezenas pelo seu sucessor imediato e anexe 25 ao final — qual número aparece?',
          stepByStep: [
            `Para elevar ${num} ao quadrado de cabeça, pegamos o prefixo ${n}.`,
            `Multiplicamos ${n} pelo seu sucessor imediato (${n + 1}): ${n} × ${n + 1} = ${head}.`,
            `Colamos o 25 no final: ${ans}!`,
          ],
          distractors: [
            {
              value: n * n * 100 + 25,
              trapDiagnosis: `${n * n * 100 + 25} é a armadilha de fazer ${n} × ${n}! Multiplique ${n} pelo SUCESSOR ${n + 1} (${n} × ${n + 1} = ${head}) → ${ans}!`,
            },
            {
              value: (head - 5) * 100 + 25,
              trapDiagnosis: `Multiplique ${n} pelo próximo inteiro (${n + 1}): ${n} × ${n + 1} = ${head} → ${ans}!`,
            },
            {
              value: (head + n) * 100 + 25,
              trapDiagnosis: `${n} × ${n + 1} dá ${head} nas centenas, seguido de 25 → ${ans}!`,
            },
          ],
        }
      }

      // Symmetric product around 100: (100 - d)(100 + d) = 10000 - d^2
      const d = rngPick(rng, [2, 3, 4, 5, 6, 7, 8, 9])
      const f1 = 100 - d
      const f2 = 100 + d
      const dSq = d * d
      const ans = 10000 - dSq
      return {
        id: `iso_arch_t4_sim100_${f1}_${f2}`,
        archetypeId: 'arch_t4_quad_supremo',
        lensId: 'infinito_9_quadrados',
        tier: 4,
        expression: `${f1} × ${f2} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Simetria na Centena (100² − d²): Os dois fatores orbitam o centro 100! Eleve 100 ao quadrado (10.000) e desconte o quadrado da distância — quanto dá?',
        stepByStep: [
          `${f1} é (100 − ${d}) e ${f2} é (100 + ${d}).`,
          `Pela Diferença de Quadrados: 100² − ${d}² = 10000 − ${dSq}.`,
          `10000 − ${dSq} = ${ans} em 2 segundos!`,
        ],
        distractors: [
          {
            value: 10000 - 2 * d,
            trapDiagnosis: `Desconte o QUADRADO da distância (${d}² = ${dSq}), e não o dobro → 10000 − ${dSq} = ${ans}!`,
          },
          {
            value: 10000 + dSq,
            trapDiagnosis: `Na Diferença de Quadrados sempre SUBTRAÍMOS ${d}²: 10000 − ${dSq} = ${ans}!`,
          },
          {
            value: ans - 10,
            trapDiagnosis: `Quase! 10000 − ${dSq} fecha exatamente em ${ans}.`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t4_maquina_sup',
    tier: 4,
    lensId: 'amigos_do_10_falta',
    synthesize: (rng) => {
      const a = rngPick(rng, [3, 4, 5, 6, 7, 8, 9])
      const x = rngPick(rng, [7, 8, 9, 11, 12, 13, 14, 15, 16, 18])
      const b = rngPick(rng, [4, 5, 6, 7, 8, 9, 11, 13, 14, 17])
      const isAdd = rng() < 0.35
      const ax = a * x
      const rhs = isAdd ? ax + b : ax - b

      return {
        id: `iso_arch_t4_maquina_${a}x_${isAdd ? 'p' : 'm'}${b}_${rhs}`,
        archetypeId: 'arch_t4_maquina_sup',
        lensId: 'amigos_do_10_falta',
        tier: 4,
        expression: isAdd ? `${a}x + ${b} = ${rhs} → x = ?` : `${a}x − ${b} = ${rhs} → x = ?`,
        correctAnswer: x,
        shortHint:
          '💡 Máquina do Tempo Suprema: Use a operação inversa na ordem reversa para isolar o mistério x — qual número original entrou na máquina?',
        stepByStep: isAdd
          ? [
              `O número x foi multiplicado por ${a} e ganhou +${b}, chegando em ${rhs}.`,
              `1º Passo Inverso: retire os ${b} → ${rhs} − ${b} = ${ax}.`,
              `2º Passo Inverso: divida por ${a} → ${ax} ÷ ${a} = ${x}!`,
            ]
          : [
              `O número x foi multiplicado por ${a} e perdeu ${b}, chegando em ${rhs}.`,
              `1º Passo Inverso: devolva os ${b} que saíram → ${rhs} + ${b} = ${ax}.`,
              `2º Passo Inverso: divida por ${a} → ${ax} ÷ ${a} = ${x}!`,
            ],
        distractors: [
          {
            value: Math.max(1, Math.round((isAdd ? rhs + b : Math.abs(rhs - b)) / a)),
            trapDiagnosis: isAdd
              ? `Na Máquina do Tempo, o inverso de "+ ${b}" é "− ${b}": faça (${rhs} − ${b}) ÷ ${a} = ${x}!`
              : `Na Máquina do Tempo, o inverso de "− ${b}" é "+ ${b}": faça (${rhs} + ${b}) ÷ ${a} = ${x}!`,
          },
          {
            value: Math.max(2, x - 2),
            trapDiagnosis: `Quase! ${isAdd ? `${rhs} − ${b}` : `${rhs} + ${b}`} vale ${ax}, e ${ax} ÷ ${a} = ${x}!`,
          },
          {
            value: x + 2,
            trapDiagnosis: `Dividindo ${ax} em ${a} partes iguais (${ax} ÷ ${a}), encontramos x = ${x}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t4_peso_alivio',
    tier: 4,
    lensId: 'regra_elevador',
    synthesize: (rng) => {
      const A = rngPick(rng, [3, 4, 5, 6, 7, 8, 9])
      const B = rngPick(rng, [4, 5, 6, 7, 8])
      const prod = A * B
      const isNegativeStart = rng() < 0.65

      if (isNegativeStart) {
        const W = rngInt(rng, 10, Math.max(12, prod - 4))
        const ans = prod - W
        return {
          id: `iso_arch_t4_peso_neg_${W}_${A}_${B}`,
          archetypeId: 'arch_t4_peso_alivio',
          lensId: 'regra_elevador',
          tier: 4,
          expression: `−${W} − (−${A}) × ${B} = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Peso & Alívio de Sinais: Tirar um peso negativo vira alívio positivo! Resolva primeiro a multiplicação e compare com a dívida inicial — quanto sobra?',
          stepByStep: [
            `Tirar um peso negativo −(−${A}) equivale a ganhar alívio +${A}.`,
            `Multiplicando primeiro pela hierarquia: (+${A}) × ${B} = +${prod} de alívio.`,
            `Juntando com o peso inicial: −${W} + ${prod} = ${ans}!`,
          ],
          distractors: [
            {
              value: W + prod,
              trapDiagnosis: `O ${W} inicial é um peso negativo (−${W})! Quando entra o alívio +${prod}, abata a dívida de ${W} → sobram ${ans}.`,
            },
            {
              value: Math.abs(W - A) * B,
              trapDiagnosis: `Atenção à hierarquia na Trincheira: multiplique (+${A}) × ${B} = +${prod} antes de somar com −${W} → ${ans}!`,
            },
            {
              value: ans + 10,
              trapDiagnosis: `Quase! Fazendo ${prod} − ${W} chegamos exatamente ao saldo positivo ${ans}.`,
            },
          ],
        }
      }

      const W = rngPick(rng, [15, 20, 24, 25, 30, 35, 40])
      const ans = W + prod
      return {
        id: `iso_arch_t4_peso_pos_${W}_${A}_${B}`,
        archetypeId: 'arch_t4_peso_alivio',
        lensId: 'regra_elevador',
        tier: 4,
        expression: `${W} − (−${A}) × ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Peso & Alívio de Sinais: Cancelar uma dívida negativa equivale a somar um ganho! Calcule o produto e junte ao valor inicial — qual é o total?',
        stepByStep: [
          `Pela regra do Peso & Alívio, −(−${A}) × ${B} transforma-se em +(${A} × ${B}) = +${prod}.`,
          `Somando ao saldo inicial: ${W} + ${prod} = ${ans}!`,
        ],
        distractors: [
          {
            value: Math.max(1, Math.abs(W - prod)),
            trapDiagnosis: `Tirar um negativo −(−${prod}) SOMA ao saldo em vez de subtrair: ${W} + ${prod} = ${ans}!`,
          },
          {
            value: (W + A) * B,
            trapDiagnosis: `Respeite a hierarquia: multiplique ${A} × ${B} = ${prod} primeiro, e depois some com ${W} → ${ans}!`,
          },
          {
            value: ans - 10,
            trapDiagnosis: `Somando o saldo ${W} com o alívio +${prod}, chegamos a ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t4_trincheira_sup',
    tier: 4,
    lensId: 'corta_no_meio_div',
    synthesize: (rng) => {
      const pairs: ReadonlyArray<[number, number, number, number]> = [
        [9, 7, 8, 6],
        [11, 5, 9, 8],
        [12, 7, 9, 5],
        [8, 9, 7, 6],
        [11, 6, 8, 7],
        [12, 6, 7, 8],
        [9, 8, 11, 4],
        [7, 9, 12, 5],
        [8, 7, 9, 6],
        [11, 7, 6, 8],
      ]
      const [d1, q1, d2, q2] = rngPick(rng, pairs)
      const N1 = d1 * q1
      const N2 = d2 * q2
      const ans = q1 * q2

      return {
        id: `iso_arch_t4_trincheira_sup_${N1}_${N2}_${d2}_${d1}`,
        archetypeId: 'arch_t4_trincheira_sup',
        lensId: 'corta_no_meio_div',
        tier: 4,
        expression: `(${N1} × ${N2}) ÷ (${d2} × ${d1}) = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Corte Cruzado Supremo: Simplifique cada fator do primeiro parêntese pelo seu divisor exato no segundo antes de multiplicar — quanto dá?',
        stepByStep: [
          `Jamais multiplique ${N1} × ${N2} no braço! Simplifique os parceiros:`,
          `${N1} ÷ ${d1} = ${q1}, e ${N2} ÷ ${d2} = ${q2}.`,
          `Agora multiplique os quocientes limpos: ${q1} × ${q2} = ${ans}!`,
        ],
        distractors: [
          {
            value: q1 + q2,
            trapDiagnosis: `${q1 + q2} é a soma (${q1} + ${q2})! Como os fatores estão multiplicando, fazemos ${q1} × ${q2} = ${ans}.`,
          },
          {
            value: (q1 - 1) * q2,
            trapDiagnosis: `Quase! ${N1} ÷ ${d1} = ${q1}, e ${q1} × ${q2} = ${ans}!`,
          },
          {
            value: q1 * (q2 - 1),
            trapDiagnosis: `${N2} ÷ ${d2} vale ${q2}, logo ${q1} × ${q2} = ${ans}!`,
          },
        ],
      }
    },
  },
  {
    archetypeId: 'arch_t4_massinha_hack_3d',
    tier: 4,
    lensId: 'hack_japones',
    synthesize: (rng) => {
      if (rng() < 0.5) {
        const B = rngPick(rng, [97, 98, 99, 197, 198, 199, 298, 299])
        const roundB = Math.ceil(B / 100) * 100
        const shift = roundB - B
        const A = roundB + rngInt(rng, 25, 165)
        const newA = A + shift
        const ans = A - B
        return {
          id: `iso_arch_t4_hack3d_${A}_${B}`,
          archetypeId: 'arch_t4_massinha_hack_3d',
          lensId: 'hack_japones',
          tier: 4,
          expression: `${A} − ${B} = ?`,
          correctAnswer: ans,
          shortHint:
            '💡 Hack Japonês na Centena: O subtraendo está colado em uma centena redonda! Some o mesmo ajuste nos dois lados — quanto resta?',
          stepByStep: [
            `O subtraendo ${B} precisa de apenas +${shift} para virar a centena redonda ${roundB}.`,
            `Somamos +${shift} também no ${A} (que vira ${newA}).`,
            `${newA} − ${roundB} = ${ans} instantaneamente!`,
          ],
          distractors: [
            {
              value: A - roundB,
              trapDiagnosis: `Você arredondou ${B} para ${roundB} (+${shift}), mas esqueceu de somar +${shift} no ${A} → ${newA} − ${roundB} = ${ans}!`,
            },
            {
              value: ans - 2 * shift,
              trapDiagnosis: `Na subtração somamos +${shift} nos DOIS termos: ${newA} − ${roundB} = ${ans}!`,
            },
            {
              value: ans + 10,
              trapDiagnosis: `A unidade está perfeita! Confira as dezenas em ${newA} − ${roundB} = ${ans}.`,
            },
          ],
        }
      }

      // 3-digit Massinha addition
      const A = rngPick(rng, [197, 198, 199, 297, 298, 299, 398, 498])
      const roundA = Math.ceil(A / 100) * 100
      const shift = roundA - A
      const B = rngInt(rng, 44, 175)
      const remB = B - shift
      const ans = A + B
      return {
        id: `iso_arch_t4_massinha3d_${A}_${B}`,
        archetypeId: 'arch_t4_massinha_hack_3d',
        lensId: 'massinha_soma',
        tier: 4,
        expression: `${A} + ${B} = ?`,
        correctAnswer: ans,
        shortHint:
          '💡 Massinha Centenária: Empreste poucas unidades da segunda parcela para a primeira fechar centena exata — qual é a soma?',
        stepByStep: [
          `O ${A} está a apenas +${shift} da centena redonda ${roundA}.`,
          `Tiramos ${shift} do ${B} (que vira ${remB}) e entregamos ao ${A} (que vira ${roundA}).`,
          `${roundA} + ${remB} = ${ans} de cabeça!`,
        ],
        distractors: [
          {
            value: roundA + B,
            trapDiagnosis: `Como o ${B} entregou ${shift} para o ${A} virar ${roundA}, o ${B} diminui para ${remB} → ${roundA} + ${remB} = ${ans}!`,
          },
          {
            value: ans - 10,
            trapDiagnosis: `Fechando a centena ${roundA} + ${remB}, chegamos a ${ans}!`,
          },
          {
            value: ans + shift * 2,
            trapDiagnosis: `Transfira apenas ${shift} de ${B} para ${A}: ${roundA} + ${remB} = ${ans}!`,
          },
        ],
      }
    },
  },
]

function extractArchetypeFromChallengeId(id: string): string | null {
  const match = /^iso_(arch_t\d+_[a-z0-9_]+?)_[0-9pms]/.exec(id)
  if (match) return match[1]
  return null
}

/**
 * Synthesizes an infinite, non-repeating stream of isomorphic math problems
 * using the 32 parametric generators + Stratified Archetype Cooldown + Session Deduplication.
 */
function selectOrSynthesizeChallenge(
  options: GenerateChallengeOptions,
  rng: () => number,
  excludeSet: Set<string>
): RawMathTemplate {
  // Determine target tier(s)
  const targetTier: ProblemTier =
    options.miracleTier !== undefined
      ? options.miracleTier
      : options.mode === 'zen'
        ? (rngPick(rng, [1, 2]) as ProblemTier)
        : options.mode === 'master'
          ? (rngPick(rng, [3, 4]) as ProblemTier)
          : (options.level ?? 1) >= 4
            ? (rngPick(rng, [2, 3]) as ProblemTier)
            : (rngPick(rng, [1, 2]) as ProblemTier)

  // Extract recent archetypes from both caller's excludeIds and internal ring
  const recentArchetypes = new Set<string>(RECENT_ARCHETYPE_RING)
  if (options.excludeIds && options.excludeIds.length > 0) {
    for (const rawId of options.excludeIds.slice(-4)) {
      const arch = extractArchetypeFromChallengeId(rawId)
      if (arch) recentArchetypes.add(arch)
    }
  }

  // Filter eligible parametric generators for targetTier
  let eligibleSpecs = ISOMORPHIC_ARCHETYPE_GENERATORS.filter((g) => g.tier === targetTier)

  if (options.preferredLensId) {
    const byLens = eligibleSpecs.filter((g) => g.lensId === options.preferredLensId)
    if (byLens.length > 0) eligibleSpecs = byLens
  } else if (options.preferredOp) {
    const byOp = eligibleSpecs.filter((g) => TETRIS_MATH_LENSES[g.lensId].op === options.preferredOp)
    if (byOp.length > 0) eligibleSpecs = byOp
  } else if (targetTier === 1 && options.interventionType === 'FILL_HOLE' && options.missingInRow !== undefined) {
    // When missingInRow is specified in Tier 1, prioritize base-10 complement or subtraction/addition lenses
    // while still rotating archetypes if base-10 was just used!
    const resonantSpecs = eligibleSpecs.filter(
      (g) =>
        g.supportsMissingResonance ||
        g.lensId === 'amigos_do_10_falta' ||
        g.lensId === 'massinha_soma' ||
        g.lensId === 'hack_japones' ||
        g.lensId === 'regra_elevador'
    )
    if (resonantSpecs.length > 0) eligibleSpecs = resonantSpecs
  } else if (
    targetTier === 1 &&
    options.interventionType === 'MORPH' &&
    (options.targetPiece === 'I' || options.targetPiece === 'O') &&
    rng() < 0.65
  ) {
    const areaSpecs = eligibleSpecs.filter(
      (g) => g.lensId === 'relogio_5_dobra_meia' || g.lensId === 'dobro_do_dobro_248'
    )
    if (areaSpecs.length > 0) eligibleSpecs = areaSpecs
  }

  // Apply Stratified Archetype Cooldown (avoid repeating recent archetypes when alternatives exist)
  const freshArchetypeSpecs = eligibleSpecs.filter((g) => !recentArchetypes.has(g.archetypeId))
  const activeSpecs = freshArchetypeSpecs.length > 0 ? freshArchetypeSpecs : eligibleSpecs

  // Bounded rejection sampling (MAX_SYNTHESIS_ATTEMPTS = 28)
  const MAX_SYNTHESIS_ATTEMPTS = 28
  let lastSynthesized: RawMathTemplate | null = null

  for (let attempt = 0; attempt < MAX_SYNTHESIS_ATTEMPTS; attempt++) {
    const spec = activeSpecs[(attempt + Math.floor(rng() * activeSpecs.length)) % activeSpecs.length]
    if (!spec) break
    const candidate = spec.synthesize(rng, options)
    lastSynthesized = candidate

    const seenInCaller =
      excludeSet.has(candidate.id) || excludeSet.has(candidate.expression)
    const seenInSession =
      SESSION_SEEN_IDS.has(candidate.id) || SESSION_SEEN_EXPRESSIONS.has(candidate.expression)

    if (!seenInCaller && !seenInSession) {
      recordSeenChallenge(candidate.id, candidate.expression, spec.archetypeId)
      return candidate
    }
    // If only seen in global session (e.g. caller passed custom excludeIds in a test), accept after attempt 16
    if (!seenInCaller && attempt >= 16) {
      recordSeenChallenge(candidate.id, candidate.expression, spec.archetypeId)
      return candidate
    }
  }

  if (lastSynthesized) {
    recordSeenChallenge(
      lastSynthesized.id,
      lastSynthesized.expression,
      lastSynthesized.archetypeId
    )
    return lastSynthesized
  }

  // Ultimate fallback to RAW_PROBLEM_BANK
  const bankPool = RAW_PROBLEM_BANK.filter((p) => p.tier === targetTier && !excludeSet.has(p.id))
  const fallback =
    bankPool[Math.floor(rng() * bankPool.length)] ??
    RAW_PROBLEM_BANK.find((p) => p.tier === targetTier) ??
    RAW_PROBLEM_BANK[0]
  recordSeenChallenge(fallback.id, fallback.expression, fallback.id)
  return fallback
}

/**
 * Generates a dynamic, pedagogically grounded math challenge from the 4 operations
 * and 8 Repository Lenses, synchronized with the player's current board intervention,
 * chosen `miracleTier` (Graus I a IV — Master Plan V3), and Infinite Isomorphic Synthesis (Master Plan V5).
 */
export function generateMathChallenge(options: GenerateChallengeOptions): TetrisMathChallenge {
  const rng = options.rng ?? Math.random
  const excludeSet = new Set(options.excludeIds ?? [])

  const chosen = selectOrSynthesizeChallenge(options, rng, excludeSet)
  const lensMeta = TETRIS_MATH_LENSES[chosen.lensId]
  const choices = buildSortedUniqueChoices(chosen.correctAnswer, chosen.distractors)
  const stepByStep = enrichStepsWithBoardGeometry(chosen.stepByStep, options)

  return {
    id: chosen.id,
    op: lensMeta.op,
    lensId: chosen.lensId,
    lensBadge: lensMeta.lensBadge,
    expression: chosen.expression,
    correctAnswer: chosen.correctAnswer,
    choices,
    shortHint: chosen.shortHint,
    stepByStep,
    interventionType: options.interventionType,
    targetPiece: options.targetPiece,
    relatedLessonSlug: lensMeta.relatedLessonSlug,
    tier: chosen.tier,
    miracleTier: options.miracleTier ?? (chosen.tier as MiraclePowerTier),
    archetypeId: chosen.archetypeId,
  }
}

/**
 * Helper to retrieve all 8 lenses metadata for the Pedagogical Codex Drawer & Landing Page.
 */
export function getAllMathLenses(): MathLensMetadata[] {
  return Object.values(TETRIS_MATH_LENSES)
}

function validateSingleZeroSpoilerItem(item: {
  id: string
  correctAnswer: number
  shortHint: string
}): string[] {
  const itemViolations: string[] = []
  const ans = String(item.correctAnswer)
  const hint = item.shortHint.trim()

  // 1. Check if shortHint ends with the correctAnswer
  const endsWithAnsRegex = new RegExp(`(?:^|\\D)${ans}[!?.\\s]*$`)
  if (endsWithAnsRegex.test(hint)) {
    itemViolations.push(`[${item.id}] shortHint termina com a resposta (${ans}): "${hint}"`)
  }

  // 2. Check if shortHint contains spoiler patterns like `= ${ans}`, `→ ${ans}`, `é ${ans}`
  const spoilerPatternRegex = new RegExp(
    `(?:=|→|é|são|vira|dá|sobra|sobram)\\s*${ans}(?:\\b|!|$)`,
    'i'
  )
  if (spoilerPatternRegex.test(hint)) {
    itemViolations.push(`[${item.id}] shortHint contém padrão de spoiler para (${ans}): "${hint}"`)
  }

  // 3. Check if shortHint contains intermediate pre-computed spoilers like `(= 7)` or `→ 7 × 10 = ?`
  if (/\(\s*=\s*\d+\s*\)/.test(hint) || /→\s*\d+\s*[+−×÷]\s*\d+\s*=\s*\?/.test(hint)) {
    itemViolations.push(`[${item.id}] shortHint contém cálculo intermediário mastigado: "${hint}"`)
  }

  // 4. Ensure shortHint contains Socratic question mark '?'
  if (!hint.includes('?')) {
    itemViolations.push(`[${item.id}] shortHint deve conter '?' socrático: "${hint}"`)
  }

  return itemViolations
}

/**
 * Deterministic Zero-Spoiler Invariant Validator (`RT-10`, `RT-V3-02` & `RT-V5-03`).
 * Inspects 100% of items in `RAW_PROBLEM_BANK` AND samples all 32 Isomorphic Archetype Generators
 * across 200 dynamic draws to verify 0% spoiler leakage.
 */
export function verifyZeroSpoilerProblemBank(): { valid: boolean; violations: string[] } {
  const violations: string[] = []

  for (const item of RAW_PROBLEM_BANK) {
    violations.push(...validateSingleZeroSpoilerItem(item))
  }

  for (const spec of ISOMORPHIC_ARCHETYPE_GENERATORS) {
    for (let i = 0; i < 6; i++) {
      const sample = spec.synthesize(Math.random, {
        mode: 'arcade',
        interventionType: 'FILL_HOLE',
        miracleTier: spec.tier as MiraclePowerTier,
      })
      violations.push(...validateSingleZeroSpoilerItem(sample))
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  }
}

export const auditProblemBankZeroSpoilers = verifyZeroSpoilerProblemBank

