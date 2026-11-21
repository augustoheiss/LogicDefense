import type { ConceptId } from './contaContratos'
import type { InfiniteMathChallenge } from './infiniteMathEngine'
import { embaralhar, mdc, mmc2, pl, quatro, randInt, randPick, semente, tentar, type Rng } from './geradoresBase'

/**
 * L7 — GERADORES DE PROBLEMA (graus 3 e 4). Cada um usa CONSTRUÇÃO DIRETA: sorteia a resposta e os fatores e CALCULA o resto,
 * de modo que a conta fecha em inteiro POR CONSTRUÇÃO. O gerador antigo de «engenheiros» tinha 8 pares escritos à mão (8
 * enunciados no total) e foi a causa medida do «as contas muito difíceis estão se repetindo».
 *
 * O jogo NÃO reproduz enunciado de prova: o TIPO de problema (MMC, regra de três, média, conjuntos, razão) vem do repertório
 * de ETEC/SENAI; contextos, nomes e números são próprios.
 *
 * O motor importa este arquivo; este arquivo só importa TIPOS do motor (`import type` some na compilação): sem ciclo.
 */
export type Problema = Omit<InfiniteMathChallenge, 'id' | 'signature' | 'archetypeId' | 'tier' | 'conceptId' | 'codexSlug' | 'lensTitlePt'> & {
  /** Parâmetros que geraram o enunciado. O motor ignora; os testes conferem texto × conta com eles. */
  params?: Record<string, unknown>
}

export interface GeradorDeProblema {
  archetypeId: string
  tier: 3 | 4
  conceptId: ConceptId
  codexSlug: string
  lensTitlePt: string
  synthesize: (rng: Rng) => Problema
  /** Problema fixo, válido e conferido pelo teste, devolvido se o sorteio esgotar MAX_TENTATIVAS (o jogo nunca trava). */
  reserva: () => Problema
}

export const mmcLista = (xs: readonly number[]): number => xs.reduce(mmc2)
const juntar = (partes: readonly string[]): string => (partes.length === 2 ? `${partes[0]} e ${partes[1]}` : `${partes.slice(0, -1).join('; ')} e ${partes[partes.length - 1]}`)
const soma = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)

// ───────────────────────── 1. MMC: «a cada X ... ao mesmo tempo novamente» (grau 3) ─────────────────────────
// L = 2^a · 3^b · 5^c (a em 1..4, b em 0..2, c em 0..1), limitado a 360. Cada período é divisor de L e o conjunto de períodos
// COBRE o expoente máximo de cada primo: assim MMC = L POR CONSTRUÇÃO. O solver de força bruta do teste confere sem usar a fórmula.
interface ContextoMmc {
  abre: (numeral: string) => string
  ident: readonly string[]
  fala: (id: string, p: number) => string
  unidade: 'segundos' | 'minutos'
  feminino: boolean
}
const CONTEXTOS_MMC: readonly ContextoMmc[] = [
  // sinalizadores com letras gregas: «lâmpadas verde/vermelha/amarela» saía quase igual à prova do SENAI (plágio medido: 6/1500)
  { abre: (n) => `Na ponte, ${n} sinalizadores piscam`, ident: ['alfa', 'beta', 'gama', 'delta'], fala: (id, p) => `o sinalizador ${id} a cada ${p} segundos`, unidade: 'segundos', feminino: false },
  { abre: (n) => `No ponto, ${n} linhas de ônibus passam`, ident: ['A', 'B', 'C', 'D'], fala: (id, p) => `a linha ${id} a cada ${p} minutos`, unidade: 'minutos', feminino: true },
  { abre: (n) => `Na vila, ${n} sinos tocam`, ident: ['norte', 'sul', 'leste', 'oeste'], fala: (id, p) => `o sino ${id} a cada ${p} minutos`, unidade: 'minutos', feminino: false },
]

// Numeral por extenso: «dois sinalizadores», «duas linhas», «três sinos». Só 2 a 4 aparecem (o gerador sorteia 2 ou 3 períodos).
const MASC: Record<number, string> = { 2: 'dois', 3: 'três', 4: 'quatro' }
const FEM: Record<number, string> = { 2: 'duas', 3: 'três', 4: 'quatro' }

export const gMMC: GeradorDeProblema = {
  archetypeId: 'g3_mmc_coincidencia',
  tier: 3,
  conceptId: 'divisao_euclidiana_resto',
  codexSlug: 'segredo-divisores',
  lensTitlePt: '🧩 Problema Contextualizado: O Encontro dos Ritmos (MMC)',
  synthesize(rng) {
    const valor = (e: readonly number[]): number => 2 ** e[0] * 3 ** e[1] * 5 ** e[2]
    // `tentar` limita o sorteio (um `while` sem teto congela a aba se a condição ficar impossível)
    const expo = tentar<[number, number, number]>(
      rng,
      (r) => {
        const e: [number, number, number] = [randInt(r, 1, 4), randInt(r, 0, 2), randInt(r, 0, 1)]
        return valor(e) >= 12 && valor(e) <= 360 ? e : null
      },
      () => [3, 1, 0], // 24
    )
    const L = valor(expo)
    const n = randInt(rng, 2, 3)
    const ps = Array.from({ length: n }, () => [randInt(rng, 0, expo[0]), randInt(rng, 0, expo[1]), randInt(rng, 0, expo[2])])
    for (let primo = 0; primo < 3; primo++) {
      if (!ps.some((p) => p[primo] === expo[primo])) ps[randInt(rng, 0, n - 1)][primo] = expo[primo]
    }
    let periodos = [...new Set(ps.map(valor).filter((p) => p >= 2))].sort((a, b) => a - b)
    if (periodos.length < 2) periodos = [...new Set([...periodos, L])].sort((a, b) => a - b)
    if (periodos.length < 2) periodos = [2, 3]
    return montarMmc(rng, periodos, randPick(rng, CONTEXTOS_MMC))
  },
  // 3, 6 e 24 minutos (MMC = 24) na linha de ônibus: o 1º problema da semente 1, congelado
  reserva: () => montarMmc(semente(1), [3, 6, 24], CONTEXTOS_MMC[1]),
}

/** Monta o problema a partir dos períodos já escolhidos: pura (sem sorteio de parâmetros, sem laço). */
function montarMmc(rng: Rng, periodos: readonly number[], ctx: ContextoMmc): Problema {
  const ans = mmcLista(periodos)
  // O numeral vem de periodos.length (o defeito medido: «três luzes» fixo com 2 períodos listados, 23% dos enunciados)
  const frases = periodos.map((p, i) => ctx.fala(ctx.ident[i], p))
  const numeral = (ctx.feminino ? FEM : MASC)[periodos.length]
  const questionPt = `${ctx.abre(numeral)}: ${juntar(frases)}. Agora ${ctx.feminino ? 'as' : 'os'} ${numeral} coincidem. Daqui a quanto tempo, no mínimo, voltam a coincidir? (em ${ctx.unidade})`
  const produto = periodos.reduce((a, b) => a * b, 1)
  const maior = Math.max(...periodos)
  const somaPeriodos = soma(periodos)
  const methods = [
    { badge: '🔢 Jeito 1 — Múltiplos do maior', summary: `Liste os múltiplos de ${maior} (${[1, 2, 3, 4, 5].map((k) => k * maior).join(', ')}, …) até achar o primeiro que os outros períodos (${periodos.filter((p) => p !== maior).join(', ')}) dividem sem resto: é ${ans}.` },
    { badge: '🧬 Jeito 2 — Fatores primos', summary: `Decomponha cada período em primos e fique com o MAIOR expoente de cada primo: o produto dá ${ans}.` },
    { badge: '🧱 Jeito 3 — Dois a dois', summary: `Ache o MMC dos dois primeiros (${mmc2(periodos[0], periodos[1])}) e depois o MMC desse resultado com o próximo, até o fim: ${ans}.` },
  ]
  return {
    params: { periodos: [...periodos] },
    expressionBadge: `MMC(${periodos.join(', ')})`,
    questionPt,
    luzGuiaPt: `Quer o PRIMEIRO instante em que todos "caem" num múltiplo de cada período. Isso é o MENOR múltiplo comum (MMC) de ${periodos.join(', ')}. Cuidado: multiplicar tudo (${produto}) dá UM momento comum, mas quase nunca o primeiro!`,
    stepByStepPt: `Passo 1: os períodos são ${periodos.join(', ')}.\nPasso 2: procure o menor número que seja múltiplo de TODOS eles.\nPasso 3: o menor é ${ans} ${ctx.unidade}.`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'O MMC organiza tudo o que se repete em ciclos: horários de ônibus, plantões, luzes e sinais que voltam a coincidir.',
    correctValue: ans,
    choices: quatro(rng, ans, `Isso! ${ans} ${ctx.unidade} é o MENOR múltiplo comum de ${periodos.join(', ')}: o primeiro encontro de todos.`, [
      { value: produto, diagnosticPt: `${produto} é um instante em que todos coincidem, mas NÃO o primeiro. Multiplicar tudo passa do MMC quando os períodos têm fatores em comum.` },
      { value: maior, diagnosticPt: `${maior} é o maior período, mas os outros nem sempre "caem" nele. É preciso um instante que TODOS dividam.` },
      { value: somaPeriodos, diagnosticPt: `Somar os períodos (${somaPeriodos}) não tem a ver com coincidência: procure o menor múltiplo comum.` },
    ]),
  }
}

// ───────────────────────── 2. REGRA DE TRÊS INVERSA: «mais gente, menos tempo» (grau 4) ─────────────────────────
// W = mmc(p1,p2)·k é o trabalho total; t1 = W/p1 e t2 = W/p2 saem INTEIROS por construção. SUBSTITUI o gerador antigo (mesmo
// archetypeId) de 8 pares escritos à mão.
interface Oficio {
  quem: string
  obra: string
  un: { singular: string; plural: string }
}
const HORA = { singular: 'hora', plural: 'horas' }
const DIA = { singular: 'dia', plural: 'dias' }
const OFICIOS: readonly Oficio[] = [
  { quem: 'pedreiros', obra: 'erguem um muro', un: HORA },
  { quem: 'costureiras', obra: 'terminam um lote de uniformes', un: HORA },
  { quem: 'pintores', obra: 'pintam uma fachada', un: HORA },
  { quem: 'técnicos', obra: 'instalam uma rede de internet', un: HORA },
  { quem: 'operários', obra: 'asfaltam um trecho de rua', un: DIA },
  { quem: 'jardineiros', obra: 'plantam um canteiro', un: HORA },
  { quem: 'cozinheiros', obra: 'preparam a comida de um evento', un: HORA },
  { quem: 'padeiros', obra: 'assam o pão da semana', un: HORA },
]
export const gRegra3Inversa: GeradorDeProblema = {
  archetypeId: 'g4_problema_regra3_inversa_equipe',
  tier: 4,
  conceptId: 'divisao_por_fracao',
  codexSlug: 'regra-de-ouro-2',
  lensTitlePt: '⚙️ Problema Contextualizado: Mais Gente, Menos Tempo (Regra de 3 Inversa)',
  synthesize(rng) {
    return tentar(
      rng,
      (r) => {
        const p1 = randInt(r, 2, 12)
        const p2 = randInt(r, 2, 18)
        if (p1 === p2) return null
        const base = mmc2(p1, p2)
        if (base > 180) return null // mantém o serviço total pequeno o bastante para conta de cabeça
        const k = randInt(r, 1, Math.max(1, Math.floor(60 / base)))
        const W = base * k
        const t1 = W / p1
        const ans = W / p2
        // números iguais em papéis diferentes confundem o aluno (5 pessoas e 5 horas); «1 hora» fica fora: o texto ficaria sem graça
        if (t1 === p2 || ans === p1 || t1 === p1 || ans === p2 || t1 < 2 || ans < 2) return null
        return montarInversa(r, p1, t1, p2, randPick(r, OFICIOS))
      },
      reservaInversa,
    )
  },
  reserva: reservaInversa,
}

// 7 pedreiros erguem o muro em 6 horas (serviço total 42); com 2 pedreiros, 21 horas: o 1º problema da semente 1, congelado.
function reservaInversa(): Problema {
  return montarInversa(semente(1), 7, 6, 2, OFICIOS[0])
}

/** Monta o problema a partir de p1 pessoas que levam t1 e de p2 pessoas: pura (sem sorteio de parâmetros, sem laço). */
function montarInversa(rng: Rng, p1: number, t1: number, p2: number, o: Oficio): Problema {
  const W = p1 * t1
  const ans = W / p2
  const maisGente = p2 > p1
  const questionPt = `PROBLEMA (Mais Gente, Menos Tempo): ${p1} ${o.quem} ${o.obra} em ${pl(t1, o.un.singular, o.un.plural)}. Se trabalhassem ${p2} ${o.quem} no mesmo ritmo, em quantas ${o.un.plural} o serviço ficaria pronto?`
  const methods = [
    { badge: '⚡ Jeito 1 — Carga total de trabalho', summary: `${p1} × ${t1} = ${W} de serviço total. Dividindo entre ${p2}: ${W} ÷ ${p2} = ${ans} ${o.un.plural}.` },
    { badge: '🔄 Jeito 2 — Proporção inversa', summary: `${maisGente ? 'Mais' : 'Menos'} gente ⇒ ${maisGente ? 'menos' : 'mais'} tempo. O tempo muda na razão inversa: ${t1} × ${p1}/${p2} = ${ans} ${o.un.plural}.` },
    { badge: '⚖️ Jeito 3 — Produto constante', summary: `${p1} × ${t1} = ${p2} × tempo ⇒ tempo = ${ans} ${o.un.plural}.` },
  ]
  return {
    params: { p1, t1, p2 },
    expressionBadge: `${p1} × ${t1} = ${p2} × ?`,
    questionPt,
    luzGuiaPt: `Pense na quantidade TOTAL de serviço: ${p1} ${o.quem} × ${t1} ${o.un.plural}. Esse total NÃO muda quando o número de pessoas muda; só se reparte de outro jeito. ${maisGente ? 'Mais pessoas dividem o mesmo serviço, então cada uma trabalha MENOS tempo.' : 'Menos pessoas dividem o mesmo serviço, então cada uma trabalha MAIS tempo.'}`,
    stepByStepPt: `Passo 1: serviço total = ${p1} × ${t1} = ${W}.\nPasso 2: reparta entre ${p2}: ${W} ÷ ${p2} = ${ans}.\nPasso 3: o serviço leva ${ans} ${o.un.plural}.`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'A regra de três inversa é a matemática da colaboração: dividir o serviço entre mais pessoas encurta o tempo de cada uma.',
    correctValue: ans,
    choices: quatro(
      rng,
      ans,
      `Isso! O serviço total (${p1} × ${t1} = ${W}) dividido por ${p2} dá ${ans} ${o.un.plural}.`,
      [
        { value: Math.round((t1 * p2) / p1), diagnosticPt: `Armadilha do "multiplica cruzado": com ${maisGente ? 'mais' : 'menos'} gente o tempo ${maisGente ? 'DIMINUI' : 'AUMENTA'} (proporção inversa); não é ${t1} × ${p2} ÷ ${p1}.` },
        { value: Math.max(1, t1 + (p1 - p2)), diagnosticPt: `Somar ou subtrair a diferença de pessoas não funciona: a mudança é PROPORCIONAL (${W} ÷ ${p2}), não uma conta de mais ou menos.` },
        { value: W, diagnosticPt: `${W} é o serviço TOTAL (${p1} × ${t1}); falta repartir entre as ${p2} pessoas.` },
      ],
      o.un,
    ),
  }
}

// ───────────────────────── 3. REGRA DE TRÊS DIRETA: «mais tempo, mais produção» (grau 3) ─────────────────────────
// Taxa inteira r; a = tempo inicial, c = tempo novo; b = a·r e a resposta c·r saem INTEIROS por construção.
// `quantos` («quantos»/«quantas») e `ele` («ele»/«ela») saem do GÊNERO do objeto/sujeito: antes era fixo e saía «quantos bicicletas».
interface Producao {
  sujeito: string
  faz: string
  objeto: string
  quantos: 'quantos' | 'quantas'
  tempo: { singular: string; plural: string }
  ele: 'ele' | 'ela'
}
const MIN = { singular: 'minuto', plural: 'minutos' }
const PRODUCOES: readonly Producao[] = [
  { sujeito: 'Uma máquina', faz: 'produz', objeto: 'peças', quantos: 'quantas', tempo: HORA, ele: 'ela' },
  { sujeito: 'Uma impressora', faz: 'imprime', objeto: 'páginas', quantos: 'quantas', tempo: MIN, ele: 'ela' },
  { sujeito: 'Uma torneira', faz: 'despeja', objeto: 'litros', quantos: 'quantos', tempo: MIN, ele: 'ela' },
  { sujeito: 'Uma padaria', faz: 'assa', objeto: 'pães', quantos: 'quantos', tempo: HORA, ele: 'ela' },
  { sujeito: 'Uma fábrica', faz: 'monta', objeto: 'bicicletas', quantos: 'quantas', tempo: DIA, ele: 'ela' },
  { sujeito: 'Um leitor', faz: 'lê', objeto: 'páginas', quantos: 'quantas', tempo: DIA, ele: 'ele' },
  { sujeito: 'Um torneiro', faz: 'fabrica', objeto: 'parafusos', quantos: 'quantos', tempo: HORA, ele: 'ele' },
  { sujeito: 'Um gerador', faz: 'rende', objeto: 'quilowatts-hora', quantos: 'quantos', tempo: HORA, ele: 'ele' },
]
export const gRegra3Direta: GeradorDeProblema = {
  archetypeId: 'g3_regra3_direta_producao',
  tier: 3,
  conceptId: 'fracao_impropria',
  codexSlug: 'regra-de-ouro-1',
  lensTitlePt: '📏 Problema Contextualizado: Quanto Mais, Mais (Regra de 3 Direta)',
  synthesize(rng) {
    return tentar(
      rng,
      (r) => {
        const taxa = randInt(r, 3, 25)
        const a = randInt(r, 2, 12)
        const c = randInt(r, 2, 16)
        if (a === c) return null
        return montarDireta(r, a, a * taxa, c, randPick(r, PRODUCOES))
      },
      reservaDireta,
    )
  },
  reserva: reservaDireta,
}

// Uma máquina produz 105 peças em 7 horas (15 por hora); em 5 horas: 75. O 1º problema da semente 1, congelado.
function reservaDireta(): Problema {
  return montarDireta(semente(1), 7, 105, 5, PRODUCOES[0])
}

/** Monta o problema: `a` unidades de tempo fazem `b`; quanto se faz em `c`? Pura (sem sorteio de parâmetros, sem laço). */
function montarDireta(rng: Rng, a: number, b: number, c: number, p: Producao): Problema {
  const r = b / a
  const ans = c * r
  const questionPt = `PROBLEMA (Quanto Mais, Mais): ${p.sujeito} ${p.faz} ${b} ${p.objeto} em ${a} ${p.tempo.plural}. No mesmo ritmo, ${p.quantos} ${p.objeto} ${p.ele} faz em ${c} ${p.tempo.plural}?`
  const methods = [
    { badge: '🧮 Jeito 1 — Valor de uma unidade', summary: `Em 1 ${p.tempo.singular}: ${b} ÷ ${a} = ${r}. Em ${c} ${p.tempo.plural}: ${r} × ${c} = ${ans}.` },
    { badge: '✖️ Jeito 2 — Multiplicação cruzada', summary: `${a} está para ${b} assim como ${c} está para ?: ? = ${b} × ${c} ÷ ${a} = ${ans}.` },
    { badge: '🔁 Jeito 3 — Fator de escala', summary: `O tempo foi de ${a} para ${c}, ou seja, multiplicado por ${c}/${a}. A produção também: ${b} × ${c}/${a} = ${ans}.` },
  ]
  return {
    params: { a, b, c },
    expressionBadge: `${a} → ${b}  ⇒  ${c} → ?`,
    questionPt,
    luzGuiaPt: `Mesmo ritmo significa a MESMA taxa por ${p.tempo.singular}. Descubra quanto se faz em 1 ${p.tempo.singular} (${b} ÷ ${a}) e depois multiplique por ${c}.`,
    stepByStepPt: `Passo 1: taxa = ${b} ÷ ${a} = ${r} por ${p.tempo.singular}.\nPasso 2: em ${c} ${p.tempo.plural}: ${r} × ${c} = ${ans}.`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'Regra de três direta: se uma grandeza dobra, a outra dobra junto. É a base de receitas, consumo e produção.',
    correctValue: ans,
    choices: quatro(rng, ans, `Certo! Taxa de ${r} por ${p.tempo.singular} × ${c} = ${ans}.`, [
      { value: Math.round((b * a) / c), diagnosticPt: 'Você inverteu a proporção. Aqui, mais tempo significa MAIS produção (grandezas diretas): multiplique, não divida.' },
      { value: b + (c - a), diagnosticPt: `Somar a diferença de tempo (${c - a}) não funciona: o aumento é PROPORCIONAL, não fixo.` },
      { value: r * (c - a), diagnosticPt: `${r * (c - a)} é só a produção do tempo EXTRA. Falta somar o que já era produzido (${b}).` },
    ]),
  }
}

// ───────────────────────── 4. MÉDIA: «que nota falta para fechar a média?» (grau 3) ─────────────────────────
// Escolhe a média alvo M e as n-1 notas; a nota que falta é x = M·n − soma (inteira, entre 3 e 10 POR CONSTRUÇÃO).
const ALUNOS = ['Beatriz', 'Caio', 'Luana', 'Davi', 'Rafaela', 'Tiago']
export const gMediaQueFalta: GeradorDeProblema = {
  archetypeId: 'g3_media_nota_que_falta',
  tier: 3,
  conceptId: 'precedencia_operacoes',
  codexSlug: 'expressoes-numericas-trincheira',
  lensTitlePt: '📊 Problema Contextualizado: A Nota que Falta (Média Aritmética)',
  synthesize(rng) {
    return tentar(
      rng,
      (r) => {
        const n = randInt(r, 4, 6) // total de avaliações (a última é a que falta)
        const M = randInt(r, 6, 9) // média que quer fechar
        const x = randInt(r, 3, 10) // nota que falta (a resposta)
        // A resposta não pode coincidir com os números que os diagnósticos citam (a média M e a quantidade n): «48 é a soma (8 × 6)» com 8 = resposta
        // entregaria o gabarito a quem errou (medido: 8,4 % das alternativas erradas da média).
        if (x === M || x === n) return null
        const outras = M * n - x // soma das n-1 notas conhecidas
        // reparte `outras` em n-1 notas entre 2 e 10 (por construção), sorteando até caber (teto de 500 tentativas)
        let notas: number[] | null = null
        for (let tentativa = 0; tentativa < 500 && !notas; tentativa++) {
          let resto = outras
          const candidatas: number[] = []
          let coube = true
          for (let i = 0; i < n - 1; i++) {
            const livres = n - 1 - i - 1
            const lo = Math.max(2, resto - livres * 10)
            const hi = Math.min(10, resto - livres * 2)
            if (lo > hi) { coube = false; break }
            const v = randInt(r, lo, hi)
            candidatas.push(v)
            resto -= v
          }
          if (coube && resto === 0) notas = candidatas
        }
        if (!notas) return null
        return montarMedia(r, embaralhar(r, notas), M, n, x, randPick(r, ALUNOS))
      },
      reservaMedia,
    )
  },
  reserva: reservaMedia,
}

// Beatriz tirou 6, 6, 9 e 10 e quer média 7 nas 5 avaliações: precisa de 4 (6 + 6 + 9 + 10 + 4 = 35 = 7 × 5). Constante conferida pelo teste.
function reservaMedia(): Problema {
  return montarMedia(semente(1), [6, 6, 9, 10], 7, 5, 4, ALUNOS[0])
}

/** Monta o problema: `notas` já tiradas (n-1), média alvo `M` em `n` avaliações, `x` é a que falta. Pura (sem sorteio de parâmetros, sem laço). */
function montarMedia(rng: Rng, dadas: readonly number[], M: number, n: number, x: number, quem: string): Problema {
  const total = M * n
  const somaConhecida = soma(dadas)
  const questionPt = `PROBLEMA (A Nota que Falta): ${quem} fez ${n - 1} de ${n} avaliações e tirou ${dadas.join(', ')}. Para a média aritmética das ${n} ser ${M}, que nota precisa tirar na última?`
  const methods = [
    { badge: '🎯 Jeito 1 — Soma que precisa fechar', summary: `Média ${M} em ${n} avaliações pede soma ${M} × ${n} = ${total}. Já tem ${somaConhecida}; falta ${total} − ${somaConhecida} = ${x}.` },
    { badge: '⚖️ Jeito 2 — Distância até a média', summary: `Cada nota passou ou ficou abaixo de ${M}. Some as diferenças (${dadas.map((v) => `${v - M >= 0 ? '+' : ''}${v - M}`).join(' ')}) e compense na última: ${M} − (${soma(dadas.map((v) => v - M))}) = ${x}.` },
  ]
  const mediaConhecida = Math.round(somaConhecida / (n - 1))
  return {
    params: { notas: [...dadas], M, n, x },
    expressionBadge: `(${dadas.join(' + ')} + ?) ÷ ${n} = ${M}`,
    questionPt,
    luzGuiaPt: `A média é a soma de tudo dividida pela quantidade. Se a média final deve ser ${M} com ${n} notas, a SOMA de todas precisa ser ${M} × ${n}. Quanto falta para chegar lá?`,
    stepByStepPt: `Passo 1: soma necessária = ${M} × ${n} = ${total}.\nPasso 2: soma que já tem = ${dadas.join(' + ')} = ${somaConhecida}.\nPasso 3: nota que falta = ${total} − ${somaConhecida} = ${x}.`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'Saber a nota de que você precisa é a matemática da média: o mesmo cálculo vale para o saldo, o consumo e a velocidade média.',
    correctValue: x,
    choices: quatro(rng, x, `Isso! Soma necessária ${total} − ${somaConhecida} que já tem = ${x}.`, [
      { value: M, diagnosticPt: `Tirar ${M} na última (a própria média) só fecha a média se as outras notas também forem ${M}. Calcule a SOMA necessária.` },
      { value: mediaConhecida, diagnosticPt: `${mediaConhecida} é a média das notas que ele JÁ tem, não a nota de que precisa.` },
      { value: total, diagnosticPt: `${total} é a SOMA de todas as notas (${M} × ${n}); falta tirar o que ele já tem (${somaConhecida}) para achar só a última.` },
    ]),
  }
}

// ───────────────────────── 5. CONJUNTOS: união e interseção (grau 3) ─────────────────────────
// Constrói DOIS conjuntos reais (contagem): soA só em A, soB só em B, `ambos` nos dois, `nenhum` em nenhum. A resposta é a
// CONTAGEM, e o solver do teste ENUMERA elementos em vez de aplicar |A|+|B|−|A∩B|.
interface Atividade {
  grupo: string
  a: string
  b: string
  ambos: string
}
const ATIVIDADES: readonly Atividade[] = [
  { grupo: 'alunos de uma turma', a: 'jogam futebol', b: 'jogam vôlei', ambos: 'jogam os dois' },
  { grupo: 'moradores de um prédio', a: 'têm cachorro', b: 'têm gato', ambos: 'têm os dois' },
  { grupo: 'participantes de uma oficina', a: 'sabem Scratch', b: 'sabem Python', ambos: 'sabem as duas' },
  { grupo: 'estudantes de um curso', a: 'falam inglês', b: 'falam espanhol', ambos: 'falam os dois' },
  { grupo: 'clientes de uma lanchonete', a: 'pediram suco', b: 'pediram sanduíche', ambos: 'pediram os dois' },
  { grupo: 'alunos de um clube', a: 'tocam violão', b: 'tocam flauta', ambos: 'tocam os dois' },
]
export const gConjuntosUniao: GeradorDeProblema = {
  archetypeId: 'g3_conjuntos_uniao_inter',
  tier: 3,
  conceptId: 'ponto_de_virada',
  codexSlug: 'aritmetica-elegante-02',
  lensTitlePt: '🔵 Problema Contextualizado: Dois Círculos que se Cruzam (Conjuntos)',
  // Todo sorteio é válido (soA, soB >= 2, ambos >= 2, nenhum >= 1): não há condição de aceite, portanto não há laço nem `tentar`.
  synthesize(rng) {
    const soA = randInt(rng, 2, 14)
    const soB = randInt(rng, 2, 14)
    const ambos = randInt(rng, 2, 10) // >= 2: com 1 o verbo do enunciado precisaria ir ao singular
    const nenhum = randInt(rng, 1, 9) // >= 1: com 0 o dado «os outros não fazem nenhuma» seria inútil (resposta = total)
    return montarConjuntos(rng, soA, soB, ambos, nenhum, randPick(rng, ATIVIDADES), randPick(rng, ['quantos', 'nenhum'] as const))
  },
  reserva: () => montarConjuntos(semente(1), 9, 7, 4, 5, ATIVIDADES[0], 'nenhum'),
}

/** Monta o problema a partir das 4 regiões do diagrama: só A, só B, nos dois e em nenhum. Pura (sem sorteio de parâmetros). */
function montarConjuntos(rng: Rng, soA: number, soB: number, ambos: number, nenhum: number, at: Atividade, pergunta: 'quantos' | 'nenhum'): Problema {
  const A = soA + ambos
  const B = soB + ambos
  const uniao = soA + soB + ambos
  const total = uniao + nenhum
  const ans = pergunta === 'quantos' ? uniao : nenhum
  const formula = pergunta === 'quantos' ? `${A} + ${B} − ${ambos} = ${uniao}` : `${total} − (${A} + ${B} − ${ambos}) = ${nenhum}`
  const abertura = `PROBLEMA (Dois Círculos que se Cruzam): Entre ${total} ${at.grupo}, ${A} ${at.a}, ${B} ${at.b} e ${ambos} ${at.ambos}.`
  const questionPt = pergunta === 'quantos' ? `${abertura} Os outros não fazem nenhuma das duas coisas. Quantos fazem PELO MENOS uma das duas?` : `${abertura} Quantos NÃO fazem nenhuma das duas coisas?`
  const methods = [
    { badge: '🔵 Jeito 1 — Diagrama de Venn', summary: `Só A: ${A} − ${ambos} = ${soA}. Só B: ${B} − ${ambos} = ${soB}. Os dois: ${ambos}. Somando as três regiões: ${uniao}.${pergunta === 'nenhum' ? ` Fora dos círculos: ${total} − ${uniao} = ${nenhum}.` : ''}` },
    { badge: '➕ Jeito 2 — Soma e desconta o que contou 2 vezes', summary: `Quem faz os dois foi contado em A E em B (2 vezes). ${A} + ${B} − ${ambos} = ${uniao}.` },
  ]
  return {
    params: { total, A, B, ambos, pergunta, soA, soB, nenhum },
    expressionBadge: `|A ∪ B| = ${A} + ${B} − ${ambos}`,
    questionPt,
    luzGuiaPt: `Desenhe dois círculos que se cruzam. Quem está no cruzamento ${at.ambos} e foi contado DUAS vezes se você só somar ${A} + ${B}. Desconte o cruzamento uma vez.`,
    stepByStepPt: `Passo 1: ${A} + ${B} = ${A + B} (o cruzamento entrou 2 vezes).\nPasso 2: tire o cruzamento uma vez: ${A + B} − ${ambos} = ${uniao}.${pergunta === 'nenhum' ? `\nPasso 3: fora dos círculos = ${total} − ${uniao} = ${nenhum}.` : ''}`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'Contar sem repetir é a base de pesquisas e cadastros: quem aparece em duas listas só pode ser contado uma vez.',
    correctValue: ans,
    choices: quatro(
      rng,
      ans,
      `Certo! ${formula}.`,
      pergunta === 'quantos'
        ? [
            { value: A + B, diagnosticPt: `${A + B} conta quem faz os dois duas vezes. Desconte o cruzamento (${ambos}) uma vez.` },
            { value: A + B - 2 * ambos, diagnosticPt: 'Descontou o cruzamento duas vezes: ele deve sair UMA só vez da soma.' },
            { value: total, diagnosticPt: `${total} é o grupo inteiro, incluindo quem não faz nenhuma das duas coisas.` },
          ]
        : [
            { value: total - (A + B), diagnosticPt: `${A + B} conta o cruzamento duas vezes; ao tirar de ${total} sobra pouco demais. Primeiro ache quem faz PELO MENOS uma das duas, depois tire isso do total.` },
            { value: uniao, diagnosticPt: `${uniao} é quem faz PELO MENOS uma; a pergunta é quem não faz nenhuma.` },
            { value: total - A, diagnosticPt: `${total} − ${A} inclui quem só faz a outra atividade.` },
          ],
    ),
  }
}

// ───────────────────────── 6. RAZÃO E PROPORÇÃO: dividir em partes proporcionais (grau 3) ─────────────────────────
// Escolhe a razão a:b e o valor de UMA parte u (inteiro); total = (a+b)·u; as duas partes saem INTEIRAS por construção.
interface Heranca {
  quem: string
  o: (T: number) => string
  a: string
  b: string
}
const HERANCAS: readonly Heranca[] = [
  { quem: 'Dois irmãos', o: (T) => `dividem R$ ${T} de uma poupança`, a: 'o mais velho', b: 'o mais novo' },
  { quem: 'Duas amigas', o: (T) => `dividem ${T} figurinhas`, a: 'Ana', b: 'Bia' },
  { quem: 'Dois sócios', o: (T) => `dividem um lucro de R$ ${T}`, a: 'o primeiro', b: 'o segundo' },
  { quem: 'Dois times', o: (T) => `dividem ${T} pontos de campeonato`, a: 'o time A', b: 'o time B' },
]
export const gRazaoDividir: GeradorDeProblema = {
  archetypeId: 'g3_razao_dividir_proporcional',
  tier: 3,
  conceptId: 'divisao_por_fracao',
  codexSlug: 'fracoes-operacoes',
  lensTitlePt: '⚖️ Problema Contextualizado: Dividir em Partes Proporcionais (Razão)',
  synthesize(rng) {
    return tentar(
      rng,
      (r) => {
        const a = randInt(r, 2, 8) // >= 2: com 1 saía «1 partes»
        const b = randInt(r, 2, 9)
        if (a === b) return null
        const u = randInt(r, 3, 40)
        const alvo = randPick(r, ['a', 'b'] as const)
        // A resposta não pode coincidir com um número que um diagnóstico cita (a soma das partes, uma das partes, a metade do total): senão o
        // diagnóstico de uma alternativa errada entrega o gabarito («dividindo 27 pela soma das partes (9)» com 9 = resposta).
        const resposta = (alvo === 'a' ? a : b) * u
        if (resposta === a + b || resposta === a || resposta === b || resposta === Math.round(((a + b) * u) / 2)) return null
        return montarRazao(r, a, b, u, randPick(r, HERANCAS), alvo)
      },
      reservaRazao,
    )
  },
  reserva: reservaRazao,
}

// Dois irmãos dividem R$ 324 na razão de 3 para 6 (uma parte vale 36): o mais velho recebe 108. Constante conferida pelo teste.
function reservaRazao(): Problema {
  return montarRazao(semente(1), 3, 6, 36, HERANCAS[0], 'a')
}

/** Monta o problema: razão a:b, valor de UMA parte `u`, e quem é perguntado (`alvo`). Pura (sem sorteio de parâmetros, sem laço). */
function montarRazao(rng: Rng, a: number, b: number, u: number, h: Heranca, alvo: 'a' | 'b'): Problema {
  const T = (a + b) * u
  const parteA = a * u
  const parteB = b * u
  const ans = alvo === 'a' ? parteA : parteB
  const nome = alvo === 'a' ? h.a : h.b
  const partes = alvo === 'a' ? a : b
  const questionPt = `PROBLEMA (Partes Proporcionais): ${h.quem} ${h.o(T)} na razão de ${a} para ${b} (${h.a} fica com ${a} partes e ${h.b}, com ${b}). Quanto ${nome} recebe?`
  const methods = [
    { badge: '🍰 Jeito 1 — Valor de uma parte', summary: `${a} + ${b} = ${a + b} partes no total. Uma parte vale ${T} ÷ ${a + b} = ${u}. ${nome} recebe ${partes} × ${u} = ${ans}.` },
    { badge: '📐 Jeito 2 — Fração do total', summary: `${nome} fica com ${partes}/${a + b} do total: ${T} × ${partes}/${a + b} = ${ans}.` },
  ]
  return {
    params: { a, b, T, alvo },
    expressionBadge: `${a} : ${b}  de ${T}`,
    questionPt,
    luzGuiaPt: `Some as partes (${a} + ${b} = ${a + b}) e descubra quanto vale UMA parte dividindo o total (${T}) por ${a + b}. Depois multiplique pelo que cabe a ${nome}.`,
    stepByStepPt: `Passo 1: partes no total = ${a} + ${b} = ${a + b}.\nPasso 2: uma parte = ${T} ÷ ${a + b} = ${u}.\nPasso 3: ${nome} = ${partes} × ${u} = ${ans}.`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'Dividir em partes proporcionais é a matemática de sociedades, receitas e escalas: cada um recebe de acordo com a sua parte.',
    correctValue: ans,
    choices: quatro(rng, ans, `Isso! Uma parte vale ${u}; ${nome} fica com ${partes} partes = ${ans}.`, [
      { value: Math.round(T / 2), diagnosticPt: `Dividir ao meio (${Math.round(T / 2)}) só vale se a razão for 1:1. Aqui as partes são desiguais (${a}:${b}).` },
      { value: alvo === 'a' ? parteB : parteA, diagnosticPt: `Você trocou quem fica com qual parte: ${nome} fica com ${partes} partes, não ${alvo === 'a' ? b : a}.` },
      { value: partes * Math.round(T / (a * b)), diagnosticPt: `Não multiplique o total pela razão: primeiro ache o valor de UMA parte dividindo ${T} pela soma das partes (${a + b}).` },
    ]),
  }
}

// ───────────────────────── 7. DIVISORES: «quantos divisores tem N?» (grau 4) ─────────────────────────
// SUBSTITUI o gerador antigo (6 números fixos: 12, 18, 20, 24, 30, 60 → 6 problemas). N = 2^a · 3^b · 5^c · 7^d, entre 12 e 360.
// A resposta é CONTADA (laço sobre 1..N), nunca pela fórmula dos expoentes; o solver do teste também conta, de forma independente.
interface FormaDivisores {
  nome: string
  pergunta: (n: number) => string
  conta: (n: number, k: number) => boolean
  dica: string
}
const ehPrimo = (k: number): boolean => {
  if (k < 2) return false
  for (let d = 2; d * d <= k; d++) if (k % d === 0) return false
  return true
}
const FORMAS_DIVISORES: readonly FormaDivisores[] = [
  { nome: 'divisores', pergunta: (n) => `quantos divisores naturais o número ${n} possui`, conta: (n, k) => n % k === 0, dica: 'Forme os pares que multiplicados dão o número e conte os dois lados de cada par.' },
  { nome: 'divisores pares', pergunta: (n) => `quantos divisores PARES o número ${n} possui`, conta: (n, k) => n % k === 0 && k % 2 === 0, dica: 'Liste os divisores e conte só os que terminam em 0, 2, 4, 6 ou 8.' },
  { nome: 'divisores ímpares', pergunta: (n) => `quantos divisores ÍMPARES o número ${n} possui`, conta: (n, k) => n % k === 0 && k % 2 === 1, dica: 'Liste os divisores e conte só os ímpares.' },
  { nome: 'divisores primos', pergunta: (n) => `quantos divisores PRIMOS o número ${n} possui`, conta: (n, k) => n % k === 0 && ehPrimo(k), dica: 'Decomponha em fatores primos: cada primo diferente que aparece é um divisor primo.' },
]
const formaComum = (n: number, m: number): { lista: number[]; ans: number } => {
  const lista: number[] = []
  for (let k = 1; k <= Math.min(n, m); k++) if (n % k === 0 && m % k === 0) lista.push(k)
  return { lista, ans: lista.length }
}
const baseDeDivisores = (rng: Rng): number =>
  tentar(
    rng,
    (r) => {
      const n = 2 ** randInt(r, 0, 5) * 3 ** randInt(r, 0, 3) * 5 ** randInt(r, 0, 1) * 7 ** randInt(r, 0, 1)
      return n >= 12 && n <= 360 ? n : null
    },
    () => 60, // 60 = 2^2·3·5: o número que o próprio texto do jogo já usa para falar de tempo (12 divisores)
  )
export const gDivisores: GeradorDeProblema = {
  archetypeId: 'g4_problema_senhores_do_tempo_divisores',
  tier: 4,
  conceptId: 'divisao_euclidiana_resto',
  codexSlug: 'segredo-divisores',
  lensTitlePt: '🕰️ Problema Contextualizado: Os Senhores do Tempo (Divisores)',
  synthesize(rng) {
    // Metade dos problemas pede os divisores COMUNS de dois números (ligado ao MDC): é o que dá a variedade (~1.400 pares).
    if (rng() < 0.5) {
      return tentar(
        rng,
        (r) => {
          const n = baseDeDivisores(r)
          const m = baseDeDivisores(r)
          if (n >= m) return null
          const { lista, ans } = formaComum(n, m)
          const g = lista[lista.length - 1]
          if (ans < 3 || g === 1 || g === n) return null // sem divisor comum interessante (g = n deixaria o problema óbvio: n divide m)
          return montarComum(r, n, m)
        },
        reservaComum,
      )
    }
    return tentar(
      rng,
      (r) => {
        const n = baseDeDivisores(r)
        const f = randPick(r, FORMAS_DIVISORES)
        if (contarDivisores(n, f).length < 3) return null // resposta 1 ou 2 deixa o problema trivial
        return montarSimples(r, n, f)
      },
      reservaSimples,
    )
  },
  // O gerador tem dois ramos; a reserva é a do ramo simples (a do «comum» vale quando o ramo «comum» esgota).
  reserva: reservaSimples,
}

// 140 tem 12 divisores; os ÍMPARES são 1, 5, 7 e 35: resposta 4. Constante conferida pelo teste.
function reservaSimples(): Problema {
  return montarSimples(semente(1), 140, FORMAS_DIVISORES[2])
}
// 24 e 36 têm MDC 12, que tem 6 divisores (1, 2, 3, 4, 6, 12): resposta 6. Constante conferida pelo teste.
function reservaComum(): Problema {
  return montarComum(semente(1), 24, 36)
}

const contarDivisores = (n: number, f: FormaDivisores): number[] => {
  const lista: number[] = []
  for (let k = 1; k <= n; k++) if (f.conta(n, k)) lista.push(k)
  return lista
}

/** Monta «quantos divisores [pares, ímpares, primos] tem n?» a partir de n e da forma. Pura (sem sorteio de parâmetros, sem laço aberto). */
function montarSimples(rng: Rng, n: number, f: FormaDivisores): Problema {
  const lista = contarDivisores(n, f)
  const ans = lista.length
  const mostra = lista.length <= 12 ? lista.join(', ') : `${lista.slice(0, 6).join(', ')}, …, ${lista.slice(-3).join(', ')}`
  const metade = Math.max(1, Math.round(ans / 2))
  const methods = [
    { badge: '🌈 Jeito 1 — Pares de fatores', summary: `${f.dica} Para ${n}, a lista é ${mostra}: são ${ans}.` },
    { badge: '🧬 Jeito 2 — Fatores primos', summary: `Fatorando ${n} em primos, os divisores saem das combinações dos expoentes; contando o que o enunciado pede, dá ${ans}.` },
  ]
  return {
    params: { n, forma: f.nome },
    expressionBadge: `${f.nome}(${n})`,
    questionPt: `PROBLEMA (Os Senhores do Tempo): ${f.pergunta(n)}?`,
    luzGuiaPt: `${f.dica} Comece sempre por 1 e pelo próprio ${n}.`,
    stepByStepPt: `Passo 1: liste os divisores de ${n} em pares que multiplicados dão ${n}.\nPasso 2: fique só com os que o enunciado pede (${f.nome}).\nPasso 3: conte: ${mostra} → ${ans}.`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'Usamos 24 horas e 60 minutos porque esses números têm muitos divisores: dá para repartir o tempo em partes iguais de muitos jeitos.',
    correctValue: ans,
    choices: quatro(rng, ans, `Certo! Contando ${f.nome} de ${n}: ${mostra} → ${ans}.`, [
      { value: ans - 1, diagnosticPt: `Faltou contar um: confira se incluiu o 1 e o próprio ${n} quando eles valem para o que o enunciado pede.` },
      { value: ans + 1, diagnosticPt: `Sobrou um: confira se todos os números da lista são mesmo ${f.nome} de ${n}.` },
      { value: metade, diagnosticPt: `${metade} é só metade dos pares: cada par (a × b) tem DOIS divisores.` },
    ]),
  }
}

/** Monta «quantos números dividem n e m ao mesmo tempo?». Pura (sem sorteio de parâmetros, sem laço aberto). */
function montarComum(rng: Rng, n: number, m: number): Problema {
  const { lista, ans } = formaComum(n, m)
  const g = lista[lista.length - 1]
  const methods = [
    { badge: '🧬 Jeito 1 — Todos os divisores de cada um', summary: `Liste os divisores de ${n} e de ${m} e fique com os que aparecem nas duas listas: ${lista.join(', ')} → ${ans}.` },
    { badge: '🪄 Jeito 2 — Pelo MDC', summary: `Os divisores comuns de dois números são exatamente os divisores do MDC. MDC(${n}, ${m}) = ${g}, que tem ${ans} divisores: ${lista.join(', ')}.` },
  ]
  const sozinho = formaComum(n, n).ans
  return {
    params: { n, m, forma: 'divisores comuns' },
    expressionBadge: `divisores comuns(${n}, ${m})`,
    questionPt: `PROBLEMA (Os Senhores do Tempo): quantos números dividem, ao mesmo tempo, ${n} e ${m}?`,
    luzGuiaPt: `Um número que divide ${n} e ${m} ao mesmo tempo precisa aparecer na lista de divisores dos DOIS. Comece pelo maior divisor comum.`,
    stepByStepPt: `Passo 1: ache o MDC de ${n} e ${m}: ${g}.\nPasso 2: os divisores comuns são os divisores desse MDC: ${lista.join(', ')}.\nPasso 3: conte: ${ans}.`,
    guidedWalkthroughPt: methods.map((x) => `${x.badge}: ${x.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'Dividir dois grupos em equipes do mesmo tamanho, sem sobrar ninguém, só funciona com um número que divida os dois.',
    correctValue: ans,
    choices: quatro(rng, ans, `Certo! Os divisores comuns de ${n} e ${m} são ${lista.join(', ')}: ${ans} números.`, [
      { value: ans - 1, diagnosticPt: `Faltou um: confira se incluiu o 1 e o MDC (${g}), que dividem os dois.` },
      { value: ans + 1, diagnosticPt: `Sobrou um: todo número da lista precisa dividir ${n} E ${m}, não só um deles.` },
      { value: sozinho, diagnosticPt: `${sozinho} é a quantidade de divisores de ${n} sozinho; falta exigir que dividam ${m} também.` },
    ]),
  }
}

// ───────────────────────── 8. TRABALHANDO JUNTAS: «1/t1 + 1/t2 = 1/T» (grau 4) ─────────────────────────
// SUBSTITUI a subvariante antiga (6 pares fixos). Três jeitos de perguntar sobre o MESMO conceito (taxas somam, tempos não), todos com
// resposta inteira por construção e tempos de cabeça (<= 60):
//   juntas  : duas fontes que ajudam; t1 = T·(p+q)/p e t2 = T·(p+q)/q (p, q coprimos) ⇒ 1/t1 + 1/t2 = 1/T.
//   esvazia : uma enche em t1 e a outra esvazia em t2 > t1; saldo 1/t1 − 1/t2 = 1/T, com T = t1·t2/(t2 − t1) inteiro.
//   inversa : o enunciado dá T e t1 e pergunta t2 (= o mesmo par de «juntas», lido ao contrário).
// O solver do teste usa as frações multiplicadas por t1·t2 (só inteiros), sem reaproveitar estas fórmulas.
interface Fonte {
  /** plural: «duas torneiras» */
  quem: string
  /** o que ajuda a fazer (juntas / inversa) */
  faz: string
  /** só as fontes que têm par «enche/esvazia» entram na variante esvazia */
  par?: { enche: string; esvazia: string; alvo: string }
  un: { singular: string; plural: string }
}
const FONTES: readonly Fonte[] = [
  { quem: 'torneiras', faz: 'enchem um tanque', un: HORA, par: { enche: 'Uma torneira enche', esvazia: 'um ralo o esvazia', alvo: 'o tanque' } },
  { quem: 'bombas', faz: 'enchem uma piscina', un: HORA, par: { enche: 'Uma bomba enche', esvazia: 'um dreno a esvazia', alvo: 'a piscina' } },
  { quem: 'impressoras', faz: 'imprimem um lote de provas', un: HORA },
  { quem: 'operários', faz: 'terminam uma parede', un: DIA },
  { quem: 'máquinas', faz: 'embalam uma remessa', un: HORA },
]
type Variante = 'juntas' | 'esvazia' | 'inversa'
export const gTorneirasParalelo: GeradorDeProblema = {
  archetypeId: 'g4_torneiras_em_paralelo',
  tier: 4,
  conceptId: 'fracao_menor_que_um',
  codexSlug: 'fracoes-operacoes',
  lensTitlePt: '🚰 Problema Contextualizado: Trabalhando Juntas (Soma de Taxas)',
  synthesize(rng) {
    return tentar(
      rng,
      (r) => {
        const variante: Variante = randPick(r, ['juntas', 'inversa', 'esvazia'] as const)
        const f = randPick(r, FONTES)
        if (variante === 'esvazia') {
          if (!f.par) return null
          const t1 = randInt(r, 2, 30)
          const t2 = randInt(r, t1 + 1, 60)
          // diferença 1 faz o produto SER a resposta (T = t1·t2 ÷ 1): o diagnóstico «Produto ÷ Diferença = 12 ÷ 1» entregaria o gabarito
          if (t2 - t1 < 2) return null
          if ((t1 * t2) % (t2 - t1) !== 0) return null
          const T = (t1 * t2) / (t2 - t1)
          if (T < 3 || T > 60 || T === t1 || T === t2) return null
          return montarEsvazia(r, t1, t2, f)
        }
        // juntas e inversa partem do mesmo par (t1, t2, T): só muda o que o enunciado pergunta
        const p = randInt(r, 1, 5)
        const q = randInt(r, 1, 5)
        if (p === q || mdc(p, q) !== 1) return null
        const T = randInt(r, 2, 8)
        const t1 = (T * (p + q)) / p
        const t2 = (T * (p + q)) / q
        if (!Number.isInteger(t1) || !Number.isInteger(t2) || t1 > 60 || t2 > 60 || t1 === t2) return null
        return variante === 'juntas' ? montarJuntas(r, t1, t2, f) : montarInversaTaxa(r, t1, T, f)
      },
      reservaJuntas,
    )
  },
  reserva: reservaJuntas,
}

// 1/9 + 1/18 = 3/18 = 1/6: duas torneiras (9 h e 18 h) enchem o tanque juntas em 6 horas. Constante conferida pelo teste.
function reservaJuntas(): Problema {
  return montarJuntas(semente(1), 9, 18, FONTES[0])
}

/** «juntas»: o tempo T de duas fontes que AJUDAM, dadas t1 e t2. Pura (sem sorteio de parâmetros, sem laço). */
function montarJuntas(rng: Rng, t1: number, t2: number, f: Fonte): Problema {
  const T = (t1 * t2) / (t1 + t2)
  const produto = t1 * t2
  const somaT = t1 + t2
  const methods = [
    { badge: '⚡ Jeito 1 — Fração por unidade de tempo', summary: `Em 1 ${f.un.singular}, a primeira faz 1/${t1} e a segunda 1/${t2}. Juntas: 1/${t1} + 1/${t2} = 1/${T} → ${T} ${f.un.plural}.` },
    { badge: '🪄 Jeito 2 — Produto sobre a soma', summary: `(${t1} × ${t2}) ÷ (${t1} + ${t2}) = ${produto} ÷ ${somaT} = ${T} ${f.un.plural}.` },
  ]
  return {
    params: { t1, t2, T, variante: 'juntas' },
    expressionBadge: `1/${t1} + 1/${t2} = 1/?`,
    questionPt: `PROBLEMA (Trabalhando Juntas): duas ${f.quem} ${f.faz}: a primeira sozinha em ${t1} ${f.un.plural}, a segunda sozinha em ${t2}. Juntas, em quantas ${f.un.plural}?`,
    luzGuiaPt: `Em 1 ${f.un.singular}, a primeira faz 1/${t1} do serviço e a segunda faz 1/${t2}. Some as duas frações (ou use Produto ÷ Soma).`,
    stepByStepPt: `Passo 1: taxas por ${f.un.singular}: 1/${t1} e 1/${t2}.\nPasso 2: some: 1/${t1} + 1/${t2} = 1/${T}.\nPasso 3: juntas levam ${T} ${f.un.plural}.`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'Duas máquinas em paralelo somam as suas velocidades (1/T₁ + 1/T₂), nunca os seus tempos.',
    correctValue: T,
    choices: quatro(
      rng,
      T,
      `Certo! 1/${t1} + 1/${t2} = 1/${T}: juntas terminam em ${T} ${f.un.plural}.`,
      [
        { value: somaT, diagnosticPt: `Duas ${f.quem} juntas terminam MAIS RÁPIDO que a mais rápida sozinha (${Math.min(t1, t2)}), nunca na soma dos tempos (${somaT}).` },
        { value: Math.round(somaT / 2), diagnosticPt: `${Math.round(somaT / 2)} seria a média dos tempos; em paralelo somamos as frações 1/${t1} + 1/${t2}.` },
        { value: Math.abs(t2 - t1), diagnosticPt: `A diferença dos tempos (${Math.abs(t2 - t1)}) não tem sentido aqui: use Produto ÷ Soma = ${produto} ÷ ${somaT}.` },
      ],
      f.un,
    ),
  }
}

/** «esvazia»: uma enche em t1 e a outra esvazia em t2 > t1; o tempo para encher com as duas abertas. Pura (sem sorteio, sem laço). Exige `f.par`. */
function montarEsvazia(rng: Rng, t1: number, t2: number, f: Fonte): Problema {
  const par = f.par ?? FONTES[0].par!
  const T = (t1 * t2) / (t2 - t1)
  const methods = [
    { badge: '⚡ Jeito 1 — Saldo por unidade de tempo', summary: `Em 1 ${f.un.singular}: entra 1/${t1} e sai 1/${t2}. Saldo: 1/${t1} − 1/${t2} = 1/${T} → ${T} ${f.un.plural}.` },
    { badge: '🪄 Jeito 2 — Produto sobre a diferença', summary: `(${t1} × ${t2}) ÷ (${t2} − ${t1}) = ${t1 * t2} ÷ ${t2 - t1} = ${T} ${f.un.plural}.` },
  ]
  return {
    params: { t1, t2, T, variante: 'esvazia' },
    expressionBadge: `1/${t1} − 1/${t2} = 1/?`,
    questionPt: `PROBLEMA (Enche e Esvazia): ${par.enche} ${par.alvo} sozinha em ${t1} ${f.un.plural}, e ${par.esvazia} sozinho em ${t2}. Com os dois abertos, em quantas ${f.un.plural} ${par.alvo} fica cheio?`,
    luzGuiaPt: `Em 1 ${f.un.singular}, entra 1/${t1} e sai 1/${t2}. Quando uma coisa enche e a outra esvazia, as frações se SUBTRAEM.`,
    stepByStepPt: `Passo 1: taxas por ${f.un.singular}: entra 1/${t1}, sai 1/${t2}.\nPasso 2: saldo: 1/${t1} − 1/${t2} = 1/${T}.\nPasso 3: cheio em ${T} ${f.un.plural}.`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'Quando uma coisa enche e outra esvazia, as taxas se subtraem: o saldo por hora é a diferença das duas.',
    correctValue: T,
    choices: quatro(
      rng,
      T,
      `Certo! 1/${t1} − 1/${t2} = 1/${T}: cheio em ${T} ${f.un.plural}.`,
      [
        { value: Math.round((t1 * t2) / (t1 + t2)), diagnosticPt: 'Isso é o tempo de duas fontes que AJUDAM (soma das taxas). Aqui uma delas esvazia: as taxas se subtraem.' },
        { value: t1 + t2, diagnosticPt: `Somar os tempos (${t1 + t2}) nunca funciona com taxas: use 1/${t1} − 1/${t2}.` },
        { value: t2 - t1, diagnosticPt: `A diferença dos tempos (${t2 - t1}) não é o tempo para encher: o certo é Produto ÷ Diferença = ${t1 * t2} ÷ ${t2 - t1}.` },
      ],
      f.un,
    ),
  }
}

/** «inversa»: o enunciado dá T (juntas) e t1 (a primeira sozinha); a resposta é t2. Pura (sem sorteio de parâmetros, sem laço). */
function montarInversaTaxa(rng: Rng, t1: number, T: number, f: Fonte): Problema {
  const t2 = (T * t1) / (t1 - T)
  const methods = [
    { badge: '⚡ Jeito 1 — Taxa que falta', summary: `Juntas fazem 1/${T} por ${f.un.singular}; a primeira faz 1/${t1}. A segunda faz 1/${T} − 1/${t1} = 1/${t2} → ${t2} ${f.un.plural}.` },
    { badge: '🪄 Jeito 2 — Produto sobre a diferença', summary: `(${T} × ${t1}) ÷ (${t1} − ${T}) = ${T * t1} ÷ ${t1 - T} = ${t2} ${f.un.plural}.` },
  ]
  return {
    params: { t1, t2, T, variante: 'inversa' },
    expressionBadge: `1/${t1} + 1/? = 1/${T}`,
    questionPt: `PROBLEMA (A Que Falta): duas ${f.quem} ${f.faz}. Juntas levam ${T} ${f.un.plural}; a primeira, sozinha, leva ${t1}. Em quantas ${f.un.plural} a segunda, sozinha, faria o serviço?`,
    luzGuiaPt: `Juntas fazem 1/${T} por ${f.un.singular}. Tire a parte da primeira (1/${t1}) e sobra a taxa da segunda.`,
    stepByStepPt: `Passo 1: juntas fazem 1/${T} por ${f.un.singular}; a primeira faz 1/${t1}.\nPasso 2: a segunda faz 1/${T} − 1/${t1} = 1/${t2}.\nPasso 3: sozinha leva ${t2} ${f.un.plural}.`,
    guidedWalkthroughPt: methods.map((m) => `${m.badge}: ${m.summary}`).join('\n'),
    methods,
    realLifeTipPt: 'Conhecendo o ritmo do grupo e o de um integrante, a taxa do outro é a diferença das duas.',
    correctValue: t2,
    choices: quatro(
      rng,
      t2,
      `Certo! 1/${T} − 1/${t1} = 1/${t2}: a segunda sozinha leva ${t2} ${f.un.plural}.`,
      [
        { value: t1 - T, diagnosticPt: `${t1 - T} é a diferença dos TEMPOS. Com taxas, a conta é 1/${T} − 1/${t1}, e não ${t1} − ${T}.` },
        { value: t1 + T, diagnosticPt: `Somar os tempos (${t1 + T}) não faz sentido: subtraia as TAXAS 1/${T} − 1/${t1}.` },
        { value: T * 2, diagnosticPt: `Dobrar o tempo de juntas (${T * 2}) só valeria se as duas fossem iguais; aqui a primeira leva ${t1}.` },
      ],
      f.un,
    ),
  }
}

/** Os 8 geradores de problema. O motor os espalha em `ARCHETYPE_GENERATORS`; `gRegra3Inversa` e `gDivisores` SUBSTITUEM os antigos (mesmo id). */
export const GERADORES_PROBLEMAS: readonly GeradorDeProblema[] = [gMMC, gRegra3Inversa, gRegra3Direta, gMediaQueFalta, gConjuntosUniao, gRazaoDividir, gDivisores, gTorneirasParalelo]
