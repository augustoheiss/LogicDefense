import {
  ArithmeticOp,
  GameMode,
  MathChoice,
  PieceType,
  TetrisMathChallenge,
  TetrisMathLensId,
} from '../types'
import { getPieceDefinition } from './tetrominoes'

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
  tier: 1 | 2 | 3 // 1 = Zen/Iniciante, 2 = Arcade, 3 = Mestre
  expression: string
  correctAnswer: number
  shortHint: string
  stepByStep: string[]
  distractors: [RawDistractor, RawDistractor, RawDistractor]
  missingBlockResonance?: number // 1..9 when linked to row complement
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
    shortHint: '💡 Massinha: Tire 2 do 7 e dê ao 18 → 20 + 5 = 25',
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
    shortHint: '💡 Massinha: Passe 1 do 8 para o 19 → 20 + 7 = 27',
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
    shortHint: '💡 Massinha: Passe 2 do 6 para o 28 → 30 + 4 = 34',
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
    shortHint: '💡 Massinha: Passe 1 do 16 para o 29 → 30 + 15 = 45',
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
    shortHint: '💡 Massinha: Passe 3 do 38 para o 47 → 50 + 35 = 85',
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
    shortHint: '💡 Massinha: Passe 2 do 35 para o 88 → 90 + 33 = 123',
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
  // LENTE 2: A PEÇA QUE FALTA / AMIGOS DO 10 (+) — 'equacao-balanca'
  // =========================================================================
  {
    id: 'falta_9_10',
    lensId: 'amigos_do_10_falta',
    tier: 1,
    missingBlockResonance: 1,
    expression: '9 + [ ? ] = 10',
    correctAnswer: 1,
    shortHint: '💡 Linha Base-10: 9 colunas cheias + 1 bloco = 10!',
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
    shortHint: '💡 Amigos do 10: 8 colunas cheias + 2 blocos = 10!',
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
    shortHint: '💡 Amigos do 10: De 7 até 10 faltam exatamente 3 blocos!',
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
    shortHint: '💡 Amigos do 10: 6 blocos + 4 blocos (1 Tetrominó) = 10!',
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
    shortHint: '💡 Ponte do 10: De 7 até 10 (+3) e de 10 até 15 (+5) → 3 + 5 = 8',
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
    shortHint: '💡 Amigo do 4 na dezena: Se 4 + 6 = 10, então 14 + 6 = 20!',
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
    shortHint: '💡 Ponte da Dezena: De 37 até 40 (+3) e de 40 até 50 (+10) = 13',
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

  // =========================================================================
  // LENTE 3: O HACK JAPONÊS (−) — 'aritmetica-elegante-01'
  // =========================================================================
  {
    id: 'hack_jap_42_19',
    lensId: 'hack_japones',
    tier: 1,
    expression: '42 − 19 = ?',
    correctAnswer: 23,
    shortHint: '💡 Hack Japonês: Some +1 nos DOIS números → 43 − 20 = 23',
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
    shortHint: '💡 Hack Japonês: Some +1 nos dois lados → 35 − 20 = 15',
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
    shortHint: '💡 Hack Japonês: Some +2 nos dois lados → 65 − 30 = 35',
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
    shortHint: '💡 Hack Japonês: Some +2 nos dois números → 75 − 40 = 35',
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
    shortHint: '💡 Hack Japonês: Some +3 nos dois lados → 88 − 30 = 58',
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
    shortHint: '💡 Hack do 99: Tire 1 dos dois (99 − 36 = 63) ou some +3 (103 − 40 = 63)!',
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
    shortHint: '💡 Elevador: De 34 até 40 (+6) e de 40 até 50 (+10) = 16',
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
    shortHint: '💡 Elevador na Ponte do 20: De 18 até 20 (+2) e de 20 até 25 (+5) = 7',
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
    shortHint: '💡 Balança Base-10: Faça 10 − 8 primeiro (= 2) e some 6 → 2 + 6 = 8!',
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
    shortHint: '💡 Elevador: De 43 até 50 (+7) e de 50 até 70 (+20) = 27',
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
    shortHint: '💡 Elevador: De 76 até 80 (+4), até 100 (+20) e até 110 (+10) = 34',
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

  // =========================================================================
  // LENTE 5: A BASE DO UNIVERSO (×2, ×4, ×8) — 'magia-calculo-mental-multiplicacao'
  // =========================================================================
  {
    id: 'dobro_15_4',
    lensId: 'dobro_do_dobro_248',
    tier: 1,
    expression: '15 × 4 = ?',
    correctAnswer: 60,
    shortHint: '💡 Dobro do Dobro: O dobro de 15 é 30 → o dobro de 30 é 60!',
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
    shortHint: '💡 Dobro do Dobro: 25 → 50 → 100!',
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
    shortHint: '💡 Dobro do Dobro: Dobro de 16 é 32 → Dobro de 32 é 64!',
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
    shortHint: '💡 Dobro do Dobro: Dobro de 35 é 70 → Dobro de 70 é 140!',
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
    shortHint: '💡 Triplo Dobro (×8): 15 → 30 → 60 → 120!',
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

  // =========================================================================
  // LENTE 6: O NOSSO RELÓGIO (×5) & DOBRAR E MEIAR — 'regra-de-ouro-2'
  // =========================================================================
  {
    id: 'relogio_14_5',
    lensId: 'relogio_5_dobra_meia',
    tier: 1,
    expression: '14 × 5 = ?',
    correctAnswer: 70,
    shortHint: '💡 Dobra e Meia: Metade de 14 é 7 → 7 × 10 = 70!',
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
    shortHint: '💡 Dobra e Meia: Metade de 18 é 9 → 9 × 10 = 90!',
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
    shortHint: '💡 Dobra e Meia: Metade de 24 é 12 → 12 × 10 = 120!',
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
    id: 'dobra_meia_18_15',
    lensId: 'relogio_5_dobra_meia',
    tier: 3,
    expression: '18 × 15 = ?',
    correctAnswer: 270,
    shortHint: '💡 Dobra e Meia: Metade de 18 (9) × Dobro de 15 (30) → 9 × 30 = 270!',
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
    shortHint: '💡 Dobra e Meia Duplo: 16 ÷ 4 = 4 e 25 × 4 = 100 → 4 × 100 = 400!',
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
  // LENTE 7: O INFINITO QUE COMPLETA (×9) & DIFERENÇA DE QUADRADOS — 'diferenca-quadrados-fator-comum'
  // =========================================================================
  {
    id: 'nove_9_8',
    lensId: 'infinito_9_quadrados',
    tier: 1,
    expression: '9 × 8 = ?',
    correctAnswer: 72,
    shortHint: '💡 Truque do 9 (Base 10): 10 × 8 = 80, menos 8 → 80 − 8 = 72!',
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
    shortHint: '💡 Simetria na Base 10: (10 + 2) × (10 − 2) = 10² − 2² = 100 − 4 = 96!',
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
    shortHint: '💡 Arredonde para 20: (20 × 6) − 6 = 120 − 6 = 114!',
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
    id: 'quadrados_21_19',
    lensId: 'infinito_9_quadrados',
    tier: 3,
    expression: '21 × 19 = ?',
    correctAnswer: 399,
    shortHint: '💡 Diferença de Quadrados no 20: (20 + 1)(20 − 1) = 400 − 1 = 399!',
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

  // =========================================================================
  // LENTE 8: CORTA NO MEIO & DIVISORES (÷) — 'segredo-divisores'
  // =========================================================================
  {
    id: 'div_36_4',
    lensId: 'corta_no_meio_div',
    tier: 1,
    expression: '36 ÷ 4 = ?',
    correctAnswer: 9,
    shortHint: '💡 Corta no Meio 2×: Metade de 36 é 18 → Metade de 18 é 9!',
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
    shortHint: '💡 Corta no Meio 2×: Metade de 48 é 24 → Metade de 24 é 12!',
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
    shortHint: '💡 Corta no Meio 2×: Metade de 84 é 42 → Metade de 42 é 21!',
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
    shortHint: '💡 Dividir por 5: Dobre o 85 (= 170) e corte o zero final → 17!',
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
    shortHint: '💡 Senhores do Tempo (Relógio): 60 minutos divididos em 12 horas = 5!',
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
    shortHint: '💡 Simplifique Antes de Multiplicar: 24 ÷ 12 = 2 → 2 × 5 = 10!',
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
]

export interface GenerateChallengeOptions {
  mode: GameMode
  interventionType: 'MORPH' | 'FILL_HOLE' | 'SECOND_WIND'
  level?: number
  targetPiece?: PieceType
  missingInRow?: number
  preferredOp?: ArithmeticOp
  preferredLensId?: TetrisMathLensId
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
    if (options.missingInRow !== undefined && options.missingInRow >= 1 && options.missingInRow <= 9) {
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

/**
 * Generates a dynamic, pedagogically grounded math challenge from the 4 operations
 * and 8 Repository Lenses, synchronized with the player's current board intervention.
 */
export function generateMathChallenge(options: GenerateChallengeOptions): TetrisMathChallenge {
  const rng = options.rng ?? Math.random
  const excludeSet = new Set(options.excludeIds ?? [])

  // Determine allowed difficulty tiers based on GameMode and level
  const maxTier: 1 | 2 | 3 =
    options.mode === 'zen'
      ? 2
      : options.mode === 'master'
        ? 3
        : (options.level ?? 1) >= 4
          ? 3
          : 2

  let candidates = RAW_PROBLEM_BANK.filter((p) => p.tier <= maxTier)

  // Filter by explicit preferredLensId or preferredOp if specified
  if (options.preferredLensId) {
    const byLens = candidates.filter((p) => p.lensId === options.preferredLensId)
    if (byLens.length > 0) candidates = byLens
  } else if (options.preferredOp) {
    const byOp = candidates.filter((p) => TETRIS_MATH_LENSES[p.lensId].op === options.preferredOp)
    if (byOp.length > 0) candidates = byOp
  } else {
    // Contextual pedagogical prioritization (Melhoria 02-A)
    if (options.interventionType === 'FILL_HOLE') {
      // When sealing a hole, prioritize Base-10 complement / Japanese Hack / Massinha
      if (options.missingInRow !== undefined) {
        const resonant = candidates.filter(
          (p) => p.missingBlockResonance === options.missingInRow && !excludeSet.has(p.id)
        )
        if (resonant.length > 0) {
          candidates = resonant
        } else {
          const holeLenses = candidates.filter(
            (p) =>
              p.lensId === 'amigos_do_10_falta' ||
              p.lensId === 'hack_japones' ||
              p.lensId === 'massinha_soma'
          )
          if (holeLenses.length > 0) candidates = holeLenses
        }
      } else {
        const holeLenses = candidates.filter(
          (p) =>
            p.lensId === 'amigos_do_10_falta' ||
            p.lensId === 'hack_japones' ||
            p.lensId === 'regra_elevador'
        )
        if (holeLenses.length > 0) candidates = holeLenses
      }
    } else if (
      options.interventionType === 'MORPH' &&
      (options.targetPiece === 'I' || options.targetPiece === 'O') &&
      rng() < 0.65
    ) {
      // Highlight area invariance (Dobrar e Meiar / Dobro do Dobro) when morphing to I or O
      const areaLenses = candidates.filter(
        (p) => p.lensId === 'relogio_5_dobra_meia' || p.lensId === 'dobro_do_dobro_248'
      )
      if (areaLenses.length > 0) candidates = areaLenses
    }
  }

  // Apply anti-repetition filter (`excludeIds` — Melhoria 02-C)
  const nonExcluded = candidates.filter((p) => !excludeSet.has(p.id))
  const pool = nonExcluded.length > 0 ? nonExcluded : candidates

  const chosen = pool[Math.floor(rng() * pool.length)] ?? RAW_PROBLEM_BANK[0]
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
  }
}

/**
 * Helper to retrieve all 8 lenses metadata for the Pedagogical Codex Drawer & Landing Page.
 */
export function getAllMathLenses(): MathLensMetadata[] {
  return Object.values(TETRIS_MATH_LENSES)
}
