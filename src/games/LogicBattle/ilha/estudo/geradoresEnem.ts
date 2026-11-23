/**
 * 4 novos motores parametricos por construcao direta inspirados nos eixos campeoes do ENEM (Fase Q4):
 *   - Grau 5 (Hardcore): `g5_enem_escala_conversao` e `g5_enem_porcentagem_sucessiva`
 *   - Grau 6 (Super Hardcore): `g6_enem_probabilidade_combinatoria`
 *   - Grau 7 (Especialista): `g7_enem_funcao_afim_pa`
 *
 * Cada gerador usa `tentar()` com `MAX_TENTATIVAS = 200` + `reserva()`, tem 3 dicas socraticas zero-spoiler,
 * `tagErro` especifico em cada alternativa errada e `posAcerto` detalhado para leitura pos-resolucao.
 */
import { embaralhar, randInt, randPick, semente, tentar, type Rng } from '../geradoresBase'
import type { AlternativaUnificada, DesafioUnificado, GrauDificuldade, TipoErroPedagogico } from './contratosEstudo'

export interface GeradorEnemParametrico {
  readonly archetypeId: string
  readonly grau: GrauDificuldade
  readonly temaId: string
  readonly temaTituloPt: string
  readonly synthesize: (rng: Rng, seq?: number) => DesafioUnificado
  readonly reserva: () => DesafioUnificado
}

interface DistratorEnem {
  readonly valor: number
  readonly rotulo: string
  readonly diagnosticoPt: string
  readonly tagErro: TipoErroPedagogico
}

function montar4Alternativas(
  rng: Rng,
  certa: { readonly valor: number; readonly rotulo: string; readonly diag: string },
  erradas: readonly DistratorEnem[],
): AlternativaUnificada[] {
  const usados = new Set<number>([certa.valor])
  const lista: DistratorEnem[] = []
  for (const e of erradas) {
    if (Number.isFinite(e.valor) && e.valor > 0 && !usados.has(e.valor)) {
      usados.add(e.valor)
      lista.push(e)
    }
    if (lista.length === 3) break
  }
  let step = 1
  while (lista.length < 3) {
    const v = certa.valor + step
    if (!usados.has(v)) {
      usados.add(v)
      lista.push({
        valor: v,
        rotulo: String(v).replace('.', ','),
        diagnosticoPt: 'Revise cada etapa do raciocinio e confira a unidade final antes de marcar.',
        tagErro: 'calculo_aritmetico',
      })
    }
    step++
  }
  const brutas = embaralhar(rng, [
    { valorNumerico: certa.valor, rotulo: certa.rotulo, correta: true, diagnosticoPt: certa.diag, tagErro: undefined },
    ...lista.map((d) => ({
      valorNumerico: d.valor,
      rotulo: d.rotulo,
      correta: false,
      diagnosticoPt: d.diagnosticoPt,
      tagErro: d.tagErro,
    })),
  ])
  const letras = ['A', 'B', 'C', 'D'] as const
  return brutas.map((b, i) => ({
    id: `c${i + 1}`,
    letra: letras[i],
    rotulo: b.rotulo,
    valorNumerico: b.valorNumerico,
    correta: b.correta,
    diagnosticoPt: b.diagnosticoPt,
    tagErro: b.tagErro,
  }))
}

// ─── 1. ESCALA E VOLUME / CONVERSÃO DE UNIDADES (Grau 5) ─────────────────────────────────────────────
function montarEscala(rng: Rng, k: number, volMaqueteCm3: number, consumoDiaL: number, seq: number): DesafioUnificado {
  // volRealCm3 = volMaqueteCm3 * k^3 ; volRealLitros = volRealCm3 / 1000
  const fatorEscala = k // escala 1 : (k * 100), logo k_total = k*100 e (k*100)^3 / 1000 = k^3 * 1000 L
  const totalLitros = volMaqueteCm3 * fatorEscala ** 3 * 1000
  const ansDias = totalLitros / consumoDiaL
  const escalaDen = k * 100
  const linearErrado = Math.max(1, Math.round((volMaqueteCm3 * escalaDen) / 1000 / Math.max(1, consumoDiaL / 1000)))
  const areaErrada = Math.max(1, Math.round(ansDias / escalaDen))
  const erroUnidade = Math.max(1, Math.round(ansDias * 10))
  const fmtBr = (n: number) => n.toLocaleString('pt-BR')

  return {
    id: `enem_gen_escala_${seq}`,
    assinatura: `g5_enem_escala:${escalaDen}:${volMaqueteCm3}:${consumoDiaL}=${ansDias}`,
    origem: 'motor_parametrico',
    grau: 5,
    temaId: 'enem_razoes_escalas',
    temaTituloPt: 'Razões, Escalas e Conversão de Unidades (ENEM)',
    arquetipoOuItemId: 'g5_enem_escala_conversao',
    enunciadoMarkdown:
      `Em uma maquete arquitetônica construída na escala **1 : ${fmtBr(escalaDen)}**, um reservatório tem capacidade de **${volMaqueteCm3} cm³**. ` +
      `Quando construído em tamanho real, abastecerá um condomínio que consome **${fmtBr(consumoDiaL)} litros por dia**.\n\n` +
      `Com o reservatório real totalmente cheio, por quantos dias inteiros ele abastecerá esse condomínio?`,
    alternativas: montar4Alternativas(
      rng,
      { valor: ansDias, rotulo: `${ansDias} dias`, diag: `Exato! Em volume multiplicamos por k³ e 1.000 cm³ = 1 litro.` },
      [
        {
          valor: areaErrada,
          rotulo: `${areaErrada} dias`,
          diagnosticoPt: 'Você aplicou o fator de escala apenas ao quadrado (k²) como se fosse área, mas capacidade é VOLUME (k³)!',
          tagErro: 'unidade_escala',
        },
        {
          valor: linearErrado,
          rotulo: `${linearErrado} dias`,
          diagnosticoPt: 'Cuidado com a conversão de volume e escala: na escala 1:E, o volume real cresce E³ vezes, e cada litro equivale a mil cm³.',
          tagErro: 'unidade_escala',
        },
        {
          valor: erroUnidade,
          rotulo: `${erroUnidade} dias`,
          diagnosticoPt: 'Sobrou uma potência de dez ao converter centímetros cúbicos para litros (cada metro cúbico equivale a mil litros).',
          tagErro: 'calculo_aritmetico',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Note que a escala dada é LINEAR (comprimento), mas o dado do reservatório está em cm³ (VOLUME) e o consumo está em litros.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Se cada dimensão (largura, comprimento, altura) cresce pelo fator E, o volume cresce E × E × E = E³! Depois transforme cm³ em litros dividindo por 1.000.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: `Escreva (${volMaqueteCm3} × ${escalaDen}³) ÷ 1.000 para achar os litros reais, simplificando os zeros antes de dividir pelo consumo diário. Armadilha: usar E ou E² em vez de E³!`,
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Volume real = ${volMaqueteCm3} × (${escalaDen})³ cm³ = ${fmtBr(totalLitros)} L. Dividindo por ${fmtBr(consumoDiaL)} L/dia = ${ansDias} dias.`,
      metodos: [
        { selo: '📐 Razão Volumétrica', resumo: `(V_real / V_maquete) = E³ = ${escalaDen}³. Depois divida por 1.000 (cm³ → L) e pelo consumo.` },
      ],
      dicaVidaRealPt: 'Maquetes e miniaturas sempre enganam o olho: dobrar todas as medidas multiplica o volume por 8, e não por 2.',
    },
  }
}

export const gEnemEscala: GeradorEnemParametrico = {
  archetypeId: 'g5_enem_escala_conversao',
  grau: 5,
  temaId: 'enem_razoes_escalas',
  temaTituloPt: 'Razões, Escalas e Conversão de Unidades (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const k = randInt(r, 2, 5) // escala 1:200 .. 1:500
        const ansDias = randInt(r, 4, 24)
        const baseL = randInt(r, 2, 9) * 5_000 // multiplo redondo de 5.000 L
        const totalLitros = ansDias * baseL
        const divisorK3 = k ** 3 * 1000
        if (totalLitros % divisorK3 !== 0) return null
        const volMaq = totalLitros / divisorK3
        if (volMaq < 12 || volMaq > 240) return null
        return montarEscala(r, k, volMaq, baseL, seq)
      },
      () => gEnemEscala.reserva(),
    )
  },
  reserva: () => montarEscala(semente(1), 2, 45, 30_000, 0),
}

// ─── 2. PORCENTAGEM SUCESSIVA / DESCONTO SOBRE PREÇO NORMAL (Grau 5) ──────────────────────────────────
function montarPorcentagemSucessiva(
  rng: Rng,
  base: number,
  aumentoPct: number,
  descontoPct: number,
  seq: number,
): DesafioUnificado {
  const normal = (base * (100 + aumentoPct)) / 100
  const final = (normal * (100 - descontoPct)) / 100
  const contaIngenuo = (base * (100 + aumentoPct - descontoPct)) / 100
  const diffReal = Math.abs(contaIngenuo - final)
  const pctFinalNum = Math.round((final - base) * 100) / 100
  const erroDescontoSobreBase = Math.round((normal - (base * descontoPct) / 100) * 100) / 100

  return {
    id: `enem_gen_pct_${seq}`,
    assinatura: `g5_enem_pct:${base}:${aumentoPct}:${descontoPct}=${final}`,
    origem: 'motor_parametrico',
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    temaTituloPt: 'Porcentagem, Lucro e Matemática Financeira (ENEM)',
    arquetipoOuItemId: 'g5_enem_porcentagem_sucessiva',
    enunciadoMarkdown:
      `Em uma loja, o preço promocional à vista de um aparelho é **R$ ${base.toLocaleString('pt-BR')},00**. ` +
      `O preço normal da etiqueta é **${aumentoPct}% maior** que o promocional. Para pagamento parcelado sem juros, a loja aplica **${descontoPct}% de desconto sobre o preço normal**.\n\n` +
      `Qual é o valor final cobrado pela loja nessa compra com desconto sobre o preço normal?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: final,
        rotulo: `R$ ${final.toFixed(2).replace('.', ',')}`,
        diag: `Correto! O desconto de ${descontoPct}% incidiu sobre o preço normal, nunca somando/subtraindo porcentagens de bases diferentes.`,
      },
      [
        {
          valor: contaIngenuo,
          rotulo: `R$ ${contaIngenuo.toFixed(2).replace('.', ',')}`,
          diagnosticoPt: `Pegadinha clássica: você fez +${aumentoPct}% − ${descontoPct}% direto sobre o preço promocional, mas o desconto vale sobre o preço NORMAL!`,
          tagErro: 'porcentagem_base',
        },
        {
          valor: erroDescontoSobreBase,
          rotulo: `R$ ${erroDescontoSobreBase.toFixed(2).replace('.', ',')}`,
          diagnosticoPt: 'Você tirou o desconto usando a base antiga promocional em vez do preço normal atualizado.',
          tagErro: 'porcentagem_base',
        },
        {
          valor: normal + Math.max(1, diffReal),
          rotulo: `R$ ${(normal + Math.max(1, diffReal)).toFixed(2).replace('.', ',')}`,
          diagnosticoPt: 'Confira a segunda etapa: é um DESCONTO sobre o preço normal, então o resultado deve ser menor que o preço normal.',
          tagErro: 'calculo_aritmetico',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Separe em duas etapas bem claras: primeiro descubra o preço normal; só depois calcule o desconto sobre ESSE novo valor.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: `Porcentagem não tem memória fixa — ela sempre morde o número onde você está pisando agora! Aumentar ${aumentoPct}% e depois tirar ${descontoPct}% NÃO é a mesma coisa que somar os dois percentuais.`,
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: `Multiplique ${base} por ${(1 + aumentoPct / 100).toFixed(2).replace('.', ',')} para achar a etiqueta normal e depois multiplique esse resultado por ${(1 - descontoPct / 100).toFixed(2).replace('.', ',')}. Armadilha: somar +${aumentoPct}% e −${descontoPct}% direto!`,
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Etapa 1: preço normal = ${base} × (1 + ${aumentoPct}/100) = ${normal}. Etapa 2: preço final = ${normal} × (1 − ${descontoPct}/100) = ${final.toFixed(2).replace('.', ',')} (diferença de ${pctFinalNum} vs promocional).`,
      metodos: [
        { selo: '📈 Fatores Multiplicativos', resumo: `${base} × ${(1 + aumentoPct / 100).toFixed(2)} × ${(1 - descontoPct / 100).toFixed(2)} = ${final.toFixed(2).replace('.', ',')}` },
      ],
      dicaVidaRealPt: 'Toda loja e imposto funciona por fatores multiplicativos sucessivos, jamais somando porcentagens de bases diferentes.',
    },
  }
}

export const gEnemPorcentagemSucessiva: GeradorEnemParametrico = {
  archetypeId: 'g5_enem_porcentagem_sucessiva',
  grau: 5,
  temaId: 'enem_porcentagem_financeira',
  temaTituloPt: 'Porcentagem, Lucro e Matemática Financeira (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const base = randPick(r, [500, 800, 1000, 1200, 1500, 2000, 2500])
        const aum = randPick(r, [10, 15, 20, 25, 30])
        const desc = randPick(r, [2, 4, 5, 8, 10])
        if (aum === desc) return null
        const normal = (base * (100 + aum)) / 100
        const final = (normal * (100 - desc)) / 100
        if (!Number.isInteger(final) && Math.round(final * 100) !== final * 100) return null
        return montarPorcentagemSucessiva(r, base, aum, desc, seq)
      },
      () => gEnemPorcentagemSucessiva.reserva(),
    )
  },
  reserva: () => montarPorcentagemSucessiva(semente(2), 1000, 10, 2, 0),
}

// ─── 3. ANÁLISE COMBINATÓRIA COM RESTRIÇÃO (Grau 6) ──────────────────────────────────────────────────
function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let res = 1
  for (let i = 1; i <= k; i++) {
    res = (res * (n - k + i)) / i
  }
  return Math.round(res)
}

function montarCombinatoriaRestricao(rng: Rng, total: number, k: 3 | 4, seq: number): DesafioUnificado {
  // Formar comissão de `k` pessoas entre `total` participantes, onde Ana e Beto NÃO podem ficar juntos.
  // C(total, k) - C(total - 2, k - 2)
  const totalSemRestricao = comb(total, k)
  const proibidas = comb(total - 2, k - 2)
  const ans = totalSemRestricao - proibidas
  const arranjoErrado = k === 3 ? total * (total - 1) * (total - 2) : total * (total - 1) * (total - 2) * (total - 3)
  const somarErrado = totalSemRestricao + proibidas

  return {
    id: `enem_gen_comb_${seq}`,
    assinatura: `g6_enem_comb:${total}:k${k}=${ans}`,
    origem: 'motor_parametrico',
    grau: 6,
    temaId: 'enem_probabilidade_contagem',
    temaTituloPt: 'Probabilidade e Análise Combinatória (ENEM)',
    arquetipoOuItemId: 'g6_enem_probabilidade_combinatoria',
    enunciadoMarkdown:
      `Em uma equipe escolar há **${total} participantes**, sendo que dois deles (Ana e Beto) não podem trabalhar juntos na mesma comissão por conflito de agenda.\n\n` +
      `De quantas maneiras distintas pode ser formada uma comissão de **${k} pessoas** respeitando essa restrição?`,
    alternativas: montar4Alternativas(
      rng,
      { valor: ans, rotulo: `${ans}`, diag: `Perfeito! Total de combinações possíveis (${totalSemRestricao}) menos os grupos proibidos (${proibidas}).` },
      [
        {
          valor: totalSemRestricao,
          rotulo: `${totalSemRestricao}`,
          diagnosticoPt: `Você calculou todas as comissões de ${k} pessoas sem descontar aquelas em que Ana e Beto caem juntos!`,
          tagErro: 'combinatoria_probabilidade',
        },
        {
          valor: arranjoErrado,
          rotulo: `${arranjoErrado}`,
          diagnosticoPt: 'Comissão não tem ordem hierárquica! Divida pelo fatorial do tamanho do grupo para não contar a mesma equipe repetida.',
          tagErro: 'combinatoria_probabilidade',
        },
        {
          valor: somarErrado,
          rotulo: `${somarErrado}`,
          diagnosticoPt: 'Em vez de subtrair os casos proibidos do total, você acabou somando.',
          tagErro: 'calculo_aritmetico',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'A ordem dos membros na comissão importa ou trocar a ordem das mesmas pessoas continua sendo exatamente a mesma equipe?',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'É muito mais fácil contar TUDO e tirar fora o que é proibido! Calcule todas as comissões possíveis e subtraia aquelas em que os dois proibidos aparecem juntos.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: `Se Ana e Beto já ocuparem duas vagas da equipe proibida, quantas escolhas combinatórias sobram entre os demais participantes para preencher o resto da comissão? Subtraia esse valor do total sem restrição.`,
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Total sem restrição: C(${total},${k}) = ${totalSemRestricao}. Casos com os dois juntos: C(${total - 2},${k - 2}) = ${proibidas}. Resultado = ${totalSemRestricao} − ${proibidas} = ${ans}.`,
      metodos: [
        { selo: '✂️ Complementar', resumo: 'Total − Proibidos evita dividir em vários subcasos e evita dupla contagem.' },
      ],
      dicaVidaRealPt: 'Na combinatória do ENEM, contar tudo e subtrair o proibido quase sempre economiza metade das contas.',
    },
  }
}

export const gEnemCombinatoria: GeradorEnemParametrico = {
  archetypeId: 'g6_enem_probabilidade_combinatoria',
  grau: 6,
  temaId: 'enem_probabilidade_contagem',
  temaTituloPt: 'Probabilidade e Análise Combinatória (ENEM)',
  synthesize(rng, seq = 1) {
    const total = randInt(rng, 7, 16)
    const k = randPick(rng, [3, 4] as const)
    return montarCombinatoriaRestricao(rng, total, k, seq)
  },
  reserva: () => montarCombinatoriaRestricao(semente(3), 8, 3, 0),
}

// ─── 4. FUNÇÃO AFIM / CUSTO FIXO + VARIÁVEL COM INTERPOLAÇÃO LINEAR (Grau 7) ──────────────────────────
function montarFuncaoAfim(rng: Rng, fixo: number, unit: number, q1: number, q2: number, qAlvo: number, seq: number): DesafioUnificado {
  const c1 = fixo + unit * q1
  const c2 = fixo + unit * q2
  const ans = fixo + unit * qAlvo
  const erroProporcaoDireta = Math.round((c1 / q1) * qAlvo)
  const erroSemFixo = unit * qAlvo
  const erroTaxaInvertida = Math.abs(ans - unit * 5)

  return {
    id: `enem_gen_afim_${seq}`,
    assinatura: `g7_enem_afim:${fixo}:${unit}:${q1}:${q2}:${qAlvo}=${ans}`,
    origem: 'motor_parametrico',
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    temaTituloPt: 'Funções, Modelagem e Sequências (ENEM)',
    arquetipoOuItemId: 'g7_enem_funcao_afim_pa',
    enunciadoMarkdown:
      `Uma oficina tem um custo total de produção composto por um **valor fixo** somado a um **custo variável por unidade** (crescimento linear).\n\n` +
      `Produzindo **${q1} peças**, o custo total é **R$ ${c1.toLocaleString('pt-BR')},00**; produzindo **${q2} peças**, sobe para **R$ ${c2.toLocaleString('pt-BR')},00**.\n\n` +
      `Qual será o custo total, em reais, para produzir **${qAlvo} peças**?`,
    alternativas: montar4Alternativas(
      rng,
      { valor: ans, rotulo: `R$ ${ans.toLocaleString('pt-BR')},00`, diag: `Excelente! Descobriu a taxa unitária pela variação e preservou o custo fixo.` },
      [
        {
          valor: erroProporcaoDireta,
          rotulo: `R$ ${erroProporcaoDireta.toLocaleString('pt-BR')},00`,
          diagnosticoPt: 'Você aplicou regra de três direta sobre o custo total, mas há um CUSTO FIXO que não dobra quando a produção dobra!',
          tagErro: 'proporcao_invertida',
        },
        {
          valor: erroSemFixo,
          rotulo: `R$ ${erroSemFixo.toLocaleString('pt-BR')},00`,
          diagnosticoPt: 'Esse valor considera apenas o custo variável das peças e esquece de somar o custo fixo da oficina.',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroTaxaInvertida,
          rotulo: `R$ ${erroTaxaInvertida.toLocaleString('pt-BR')},00`,
          diagnosticoPt: 'Confira a divisão da diferença de custo pela diferença de peças para acertar o preço de 1 peça extra.',
          tagErro: 'calculo_aritmetico',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Como o custo tem uma parte FIXA, você NÃO pode fazer regra de três direta entre custo total e quantidade.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Compare os dois pedidos: o custo fixo é igual nos dois! Então toda a diferença em reais veio só das peças extras. Divida a diferença de preço pela diferença de peças para achar o custo de 1 unidade.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: `Calcule (${c2} − ${c1}) ÷ (${q2} − ${q1}) para achar o custo de cada peça extra; depois parta do pedido de ${q1} ou ${q2} peças e some apenas a diferença até ${qAlvo}.`,
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Taxa unitária = (${c2} − ${c1}) ÷ (${q2} − ${q1}) = R$ ${unit}/peça. Custo fixo = ${c1} − ${unit}×${q1} = R$ ${fixo}. Para ${qAlvo} peças: ${fixo} + ${unit}×${qAlvo} = R$ ${ans.toLocaleString('pt-BR')},00.`,
      metodos: [
        { selo: '📈 Taxa de Variação (Função Afim)', resumo: `ΔC / Δq = coeficiente angular; depois avance Δq × taxa a partir de qualquer ponto conhecido.` },
      ],
      dicaVidaRealPt: 'Tarifas com bandeirada (táxi, energia, produção sob encomenda) seguem exatamente f(x) = ax + b.',
    },
  }
}

export const gEnemFuncaoAfim: GeradorEnemParametrico = {
  archetypeId: 'g7_enem_funcao_afim_pa',
  grau: 7,
  temaId: 'enem_funcoes_sequencias',
  temaTituloPt: 'Funções, Modelagem e Sequências (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const fixo = randInt(r, 2, 9) * 150
        const unit = randInt(r, 8, 25) * 2
        const q1 = randPick(r, [20, 30, 40, 50])
        const deltaQ = randPick(r, [30, 40, 50, 60])
        const q2 = q1 + deltaQ
        const qAlvo = q1 + randPick(r, [15, 20, 25, 35, 80])
        if (qAlvo === q1 || qAlvo === q2) return null
        return montarFuncaoAfim(r, fixo, unit, q1, q2, qAlvo, seq)
      },
      () => gEnemFuncaoAfim.reserva(),
    )
  },
  reserva: () => montarFuncaoAfim(semente(4), 450, 12, 50, 100, 80, 0),
}

// ─── 5. MÉDIA PONDERADA POR SETORES (Grau 5) ──────────────────────────────────────────────────────────
function montarMediaPonderada(
  rng: Rng,
  nA: number,
  salA: number,
  salB: number,
  seq: number,
): DesafioUnificado {
  const nB = 100 - nA
  const ans = (nA * salA + nB * salB) / 100
  const mediaSimples = (salA + salB) / 2
  const pesosInvertidos = (nB * salA + nA * salB) / 100
  const somaSalarios = salA + salB
  const fmt = (n: number) => n.toLocaleString('pt-BR')

  return {
    id: `enem_gen_media_${seq}`,
    assinatura: `g5_enem_media:${nA}:${salA}:${salB}=${ans}`,
    origem: 'motor_parametrico',
    grau: 5,
    temaId: 'enem_estatistica_medias',
    temaTituloPt: 'Médias, Mediana e Interpretação de Dados (ENEM)',
    arquetipoOuItemId: 'g5_enem_media_ponderada_setores',
    enunciadoMarkdown:
      `Uma empresa possui **100 colaboradores** distribuídos em dois setores: Operações e Engenharia. Todos os funcionários de um mesmo setor recebem o mesmo salário.\n\n` +
      `No setor de **Operações**, há **${nA} funcionários** com salário de **R$ ${fmt(salA)},00**; na **Engenharia**, há **${nB} funcionários** com salário de **R$ ${fmt(salB)},00**.\n\n` +
      `Qual é a média salarial dos 100 colaboradores dessa empresa, em reais?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `R$ ${fmt(ans)},00`,
        diag: `Correto! Folha salarial total (${fmt(nA * salA + nB * salB)}) dividida pelos 100 colaboradores.`,
      },
      [
        {
          valor: mediaSimples,
          rotulo: `R$ ${fmt(mediaSimples)},00`,
          diagnosticoPt: 'Você calculou a média simples entre os dois salários, ignorando que os setores têm tamanhos diferentes!',
          tagErro: 'proporcao_invertida',
        },
        {
          valor: pesosInvertidos,
          rotulo: `R$ ${fmt(pesosInvertidos)},00`,
          diagnosticoPt: 'Você trocou os pesos: multiplicou o salário da Engenharia pelo tamanho da Operações e vice-versa.',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: somaSalarios,
          rotulo: `R$ ${fmt(somaSalarios)},00`,
          diagnosticoPt: 'Você apenas somou um salário de cada setor sem ponderar nem dividir pelo total de funcionários.',
          tagErro: 'calculo_aritmetico',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Os dois setores têm a mesma quantidade de pessoas? Se os tamanhos são diferentes, a média não fica bem no meio dos dois salários.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Multiplique quantidade de funcionários pelo salário dentro de cada setor para achar a folha total da empresa, some tudo e divida pelos 100 colaboradores.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: somar os dois salários e dividir por 2, ignorando os pesos de cada setor!',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Folha total = (${nA} × ${fmt(salA)}) + (${nB} × ${fmt(salB)}) = R$ ${fmt(nA * salA + nB * salB)}. Dividindo por 100 colaboradores: R$ ${fmt(ans)},00.`,
      metodos: [
        { selo: '⚖️ Média Ponderada', resumo: `(${nA}/100)·${fmt(salA)} + (${nB}/100)·${fmt(salB)} = R$ ${fmt(ans)},00.` },
      ],
      dicaVidaRealPt: 'Médias salariais e de notas sempre precisam ser ponderadas pelo número de pessoas em cada faixa.',
    },
  }
}

export const gEnemMediaPonderada: GeradorEnemParametrico = {
  archetypeId: 'g5_enem_media_ponderada_setores',
  grau: 5,
  temaId: 'enem_estatistica_medias',
  temaTituloPt: 'Médias, Mediana e Interpretação de Dados (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const nA = randPick(r, [60, 70, 75, 80])
        const salA = randPick(r, [1600, 2000, 2200, 2400, 2800, 3000])
        const delta = randPick(r, [2000, 3000, 4000, 5000, 6000])
        const salB = salA + delta
        const ans = (nA * salA + (100 - nA) * salB) / 100
        if (!Number.isInteger(ans)) return null
        return montarMediaPonderada(r, nA, salA, salB, seq)
      },
      () => gEnemMediaPonderada.reserva(),
    )
  },
  reserva: () => montarMediaPonderada(semente(5), 75, 2000, 6000, 0),
}

// ─── 6. REGRA DE TRÊS COMPOSTA / HOMENS-HORA (Grau 6) ─────────────────────────────────────────────────
function montarRegra3Composta(
  rng: Rng,
  f1: number,
  h1: number,
  taxa: number,
  f2: number,
  h2: number,
  seq: number,
): DesafioUnificado {
  const p1 = taxa * f1 * h1
  const ans = taxa * f2 * h2
  const soFunc = taxa * h1 * f2
  const soHoras = taxa * f1 * h2
  const somaAbsurda = p1 + ans
  const fmt = (n: number) => n.toLocaleString('pt-BR')

  return {
    id: `enem_gen_r3c_${seq}`,
    assinatura: `g6_enem_r3c:${f1}:${h1}:${taxa}:${f2}:${h2}=${ans}`,
    origem: 'motor_parametrico',
    grau: 6,
    temaId: 'enem_razoes_escalas',
    temaTituloPt: 'Razões, Escalas e Conversão de Unidades (ENEM)',
    arquetipoOuItemId: 'g6_enem_regra3_composta_producao',
    enunciadoMarkdown:
      `Uma equipe de montagem com **${f1} técnicos**, trabalhando **${h1} horas por dia** no mesmo ritmo individual, monta **${fmt(p1)} placas por dia**.\n\n` +
      `Para atender a um novo contrato, a equipe passou para **${f2} técnicos**, trabalhando **${h2} horas por dia** com a mesma produtividade por hora.\n\n` +
      `Quantas placas essa equipe passará a montar por dia?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `${fmt(ans)} placas`,
        diag: `Perfeito! Produtividade de ${taxa} placas por técnico-hora multiplicada por ${f2 * h2} técnico-horas.`,
      },
      [
        {
          valor: soFunc,
          rotulo: `${fmt(soFunc)} placas`,
          diagnosticoPt: 'Você escalou apenas o número de técnicos e esqueceu que a carga horária diária também aumentou!',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: soHoras,
          rotulo: `${fmt(soHoras)} placas`,
          diagnosticoPt: 'Você escalou apenas a jornada em horas e esqueceu que entraram mais técnicos na equipe!',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: somaAbsurda,
          rotulo: `${fmt(somaAbsurda)} placas`,
          diagnosticoPt: 'Confira a pergunta: ela pede a produção diária da nova equipe, e não a soma com a antiga.',
          tagErro: 'calculo_aritmetico',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'A produção diária cresce por dois fatores juntos: mais técnicos na bancada E mais horas trabalhadas por dia.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Multiplique técnicos × horas para achar quantas "horas-técnico" existiam antes. Divida a produção inicial por esse produto para achar placas por hora-técnico e depois multiplique pelo novo total de horas-técnico.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: `Descubra primeiro o total inicial de horas-técnico (${f1} × ${h1}) e a taxa unitária por hora. Armadilha: ajustar só os técnicos ou só as horas!`,
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Antes: ${f1} × ${h1} = ${f1 * h1} técnico-horas fazem ${fmt(p1)} placas ⇒ ${taxa} placas/técnico-hora. Depois: ${f2} × ${h2} = ${f2 * h2} técnico-horas ⇒ ${f2 * h2} × ${taxa} = ${fmt(ans)} placas/dia.`,
      metodos: [
        { selo: '⚙️ Produtividade por Hora-Técnico', resumo: `(${fmt(p1)} ÷ (${f1}×${h1})) × (${f2}×${h2}) = ${fmt(ans)}.` },
      ],
      dicaVidaRealPt: 'Medir a produção por unidade de "hora-homem" resolve qualquer regra de três composta sem decoreba de setinhas.',
    },
  }
}

export const gEnemRegra3Composta: GeradorEnemParametrico = {
  archetypeId: 'g6_enem_regra3_composta_producao',
  grau: 6,
  temaId: 'enem_razoes_escalas',
  temaTituloPt: 'Razões, Escalas e Conversão de Unidades (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const f1 = randPick(r, [3, 4, 5, 6])
        const h1 = randPick(r, [4, 5, 6])
        const taxa = randPick(r, [15, 20, 25, 30, 35, 40, 45, 50])
        const f2 = f1 + randInt(r, 1, 3)
        const h2 = h1 + randInt(r, 2, 4)
        const soFunc = taxa * h1 * f2
        const soHoras = taxa * f1 * h2
        if (soFunc === soHoras) return null
        return montarRegra3Composta(r, f1, h1, taxa, f2, h2, seq)
      },
      () => gEnemRegra3Composta.reserva(),
    )
  },
  reserva: () => montarRegra3Composta(semente(6), 3, 6, 40, 5, 9, 0),
}

// ─── 7. VAZÃO, VOLUME E TEMPO COM VARIAÇÕES PERCENTUAIS (Grau 7) ───────────────────────────────────────
function montarVazaoProporcao(
  rng: Rng,
  v1: number,
  q1: number,
  aumVolPct: number,
  aumTempoPct: number,
  seq: number,
): DesafioUnificado {
  const v2 = Math.round((v1 * (100 + aumVolPct)) / 100)
  const ans = Math.round((q1 * (100 + aumVolPct)) / (100 + aumTempoPct))
  const erroMultiplicaAmbos = Math.round((q1 * (100 + aumVolPct) * (100 + aumTempoPct)) / 10_000)
  const erroSubtraiPctTempo = Math.round((q1 * (100 + aumVolPct) * (100 - aumTempoPct)) / 10_000)
  const erroRazaoInvertida = Math.round((q1 * (100 + aumTempoPct)) / (100 + aumVolPct))
  const fmt = (n: number) => n.toLocaleString('pt-BR')

  return {
    id: `enem_gen_vazao_${seq}`,
    assinatura: `g7_enem_vazao:${v1}:${q1}:${aumVolPct}:${aumTempoPct}=${ans}`,
    origem: 'motor_parametrico',
    grau: 7,
    temaId: 'enem_razoes_escalas',
    temaTituloPt: 'Razões, Escalas e Conversão de Unidades (ENEM)',
    arquetipoOuItemId: 'g7_enem_vazao_piscina_proporcao',
    enunciadoMarkdown:
      `Um reservatório A tem capacidade de **${fmt(v1)} litros** e é abastecido com vazão constante de **${fmt(q1)} L/min**.\n\n` +
      `Um segundo reservatório B tem capacidade **${aumVolPct}% maior** que o primeiro (**${fmt(v2)} litros**) e será regulado para encher em um tempo **${aumTempoPct}% maior** que o tempo gasto para encher o reservatório A.\n\n` +
      `Qual deve ser a vazão constante, em L/min, para abastecer o reservatório B?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `${fmt(ans)} L/min`,
        diag: `Correto! Vazão = Volume ÷ Tempo ⇒ Q_B = Q_A × (1 + ${aumVolPct}%) ÷ (1 + ${aumTempoPct}%).`,
      },
      [
        {
          valor: erroMultiplicaAmbos,
          rotulo: `${fmt(erroMultiplicaAmbos)} L/min`,
          diagnosticoPt: 'Se o tempo para encher é maior, a vazão diminui em relação ao fator de tempo (divide por ele, não multiplica)!',
          tagErro: 'proporcao_invertida',
        },
        {
          valor: erroSubtraiPctTempo,
          rotulo: `${fmt(erroSubtraiPctTempo)} L/min`,
          diagnosticoPt: `Dividir por (1 + ${aumTempoPct}%) não é o mesmo que multiplicar por (1 − ${aumTempoPct}%)!`,
          tagErro: 'porcentagem_base',
        },
        {
          valor: erroRazaoInvertida,
          rotulo: `${fmt(erroRazaoInvertida)} L/min`,
          diagnosticoPt: 'Você inverteu os papéis entre a variação do volume e a variação do tempo.',
          tagErro: 'proporcao_invertida',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Lembre da relação física: Vazão = Volume ÷ Tempo. Quando o tempo permitido aumenta, a bomba precisa ser proporcionalmente mais lenta.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Multiplique a vazão antiga pelo fator de aumento do volume e DIVIDA pelo fator de aumento do tempo — assim os dois volumes grandes até simplificam!',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: `Monte a razão (${100 + aumVolPct}/${100 + aumTempoPct}) aplicada à vazão inicial. Armadilha clássica: trocar "dividir por 1 + t%" por "multiplicar por 1 − t%".`,
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Razão de volumes = ${100 + aumVolPct}/100. Razão de tempos = ${100 + aumTempoPct}/100. Nova vazão = ${fmt(q1)} × (${100 + aumVolPct} ÷ ${100 + aumTempoPct}) = ${fmt(ans)} L/min.`,
      metodos: [
        { selo: '💧 Razão de Proporções', resumo: `Q_B = Q_A × (V_B/V_A) ÷ (t_B/t_A) = ${fmt(ans)} L/min.` },
      ],
      dicaVidaRealPt: 'Dividir por (1 + p) nunca é igual a multiplicar por (1 − p); esse atalho errado costuma custar pontos em questões de física e matemática.',
    },
  }
}

export const gEnemVazaoProporcao: GeradorEnemParametrico = {
  archetypeId: 'g7_enem_vazao_piscina_proporcao',
  grau: 7,
  temaId: 'enem_razoes_escalas',
  temaTituloPt: 'Razões, Escalas e Conversão de Unidades (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const v1 = randPick(r, [1_200_000, 1_500_000, 1_800_000, 2_000_000, 2_500_000])
        const q1 = randPick(r, [2400, 3000, 3600, 4800, 6000, 7200, 8400])
        const aumVolPct = randPick(r, [5, 10, 15, 20, 30, 35, 40])
        const aumTempoPct = randPick(r, [20, 25, 50])
        if (aumVolPct === aumTempoPct) return null
        if ((q1 * (100 + aumVolPct)) % (100 + aumTempoPct) !== 0) return null
        const ans = (q1 * (100 + aumVolPct)) / (100 + aumTempoPct)
        const erroSub = Math.round((q1 * (100 + aumVolPct) * (100 - aumTempoPct)) / 10_000)
        if (ans === erroSub) return null
        return montarVazaoProporcao(r, v1, q1, aumVolPct, aumTempoPct, seq)
      },
      () => gEnemVazaoProporcao.reserva(),
    )
  },
  reserva: () => montarVazaoProporcao(semente(7), 2_500_000, 6000, 10, 20, 0),
}

// ─── 8. PROBABILIDADE CONJUNTA EM URNAS COM ADIÇÃO DE BOLAS (Grau 7) ──────────────────────────────────
function montarUrnaProbabilidade(
  rng: Rng,
  pAPct: number,
  premB: number,
  pBAtualPct: number,
  pAlvoPct: number,
  seq: number,
): DesafioUnificado {
  const totalAtualB = Math.round((premB * 100) / pBAtualPct)
  const comunsAtualB = totalAtualB - premB
  const pBAlvoDen = Math.round(pAPct / pAlvoPct)
  const totalFinalB = premB * pBAlvoDen
  const ans = totalFinalB - totalAtualB
  const erroTotalFinal = totalFinalB
  const erroSemComuns = totalFinalB - premB
  const erroSomaComTotal = totalFinalB + premB

  return {
    id: `enem_gen_urna_${seq}`,
    assinatura: `g7_enem_urna:${pAPct}:${premB}:${pBAtualPct}:${pAlvoPct}=${ans}`,
    origem: 'motor_parametrico',
    grau: 7,
    temaId: 'enem_probabilidade_contagem',
    temaTituloPt: 'Probabilidade e Análise Combinatória (ENEM)',
    arquetipoOuItemId: 'g7_enem_urna_probabilidade_ajuste',
    enunciadoMarkdown:
      `Em um sorteio, o participante retira ao acaso uma ficha de cada uma das urnas A e B e ganha se ambas forem premiadas.\n\n` +
      `Na urna A, a chance de sair uma ficha premiada é **${pAPct}%**. Na urna B há **${premB} fichas premiadas**, que hoje representam **${pBAtualPct}%** do total dessa urna (as demais são fichas comuns).\n\n` +
      `Quantas fichas comuns extras devem ser adicionadas à urna B para que a probabilidade de ganhar o sorteio caia exatamente para **${pAlvoPct}%**?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `${ans} fichas`,
        diag: `Exato! A urna B precisa chegar a ${totalFinalB} fichas e já continha ${totalAtualB}, faltando ${ans} fichas comuns.`,
      },
      [
        {
          valor: erroTotalFinal,
          rotulo: `${erroTotalFinal} fichas`,
          diagnosticoPt: 'Esse é o TOTAL final de fichas na urna B — faltou descontar as fichas que já estavam lá dentro!',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroSemComuns,
          rotulo: `${erroSemComuns} fichas`,
          diagnosticoPt: 'Você descontou só as fichas premiadas e esqueceu as fichas comuns que já estavam na urna B!',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroSomaComTotal,
          rotulo: `${erroSomaComTotal} fichas`,
          diagnosticoPt: 'Confira quantas fichas a urna B já tem hoje antes de subtrair do total desejado.',
          tagErro: 'calculo_aritmetico',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Para ganhar nas duas urnas independentes ao mesmo tempo, multiplicamos P(A) × P(B). Descubra qual nova porcentagem P(B) precisa ter.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Ache primeiro quantas fichas existem HOJE na urna B usando as fichas premiadas atuais. Depois calcule o total FINAL necessário na urna B mantendo as mesmas premiadas.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: responder o total final de fichas da urna B sem subtrair todas as fichas (premiadas e comuns) que já estavam lá dentro!',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Hoje B tem ${premB} ÷ (${pBAtualPct}/100) = ${totalAtualB} fichas (${premB} premiadas e ${comunsAtualB} comuns). Queremos (${pAPct}/100) × P(B) = ${pAlvoPct}/100 ⇒ P(B) = 1/${pBAlvoDen}. Total final = ${premB} × ${pBAlvoDen} = ${totalFinalB}. Adicionar ${totalFinalB} − ${totalAtualB} = ${ans} fichas comuns.`,
      metodos: [
        { selo: '🎲 Espaço Amostral Ajustado', resumo: `Total final − Total atual = ${totalFinalB} − ${totalAtualB} = ${ans} fichas.` },
      ],
      dicaVidaRealPt: 'Sempre confira se a pergunta pede o novo total ou apenas a quantidade a ADICIONAR ao conjunto existente.',
    },
  }
}

export const gEnemUrnaProbabilidade: GeradorEnemParametrico = {
  archetypeId: 'g7_enem_urna_probabilidade_ajuste',
  grau: 7,
  temaId: 'enem_probabilidade_contagem',
  temaTituloPt: 'Probabilidade e Análise Combinatória (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const pAPct = randPick(r, [20, 25, 40, 50])
        const pAlvoPct = randPick(r, [1, 2, 4, 5])
        if (pAPct % pAlvoPct !== 0) return null
        const pBAlvoDen = pAPct / pAlvoPct
        if (pBAlvoDen < 6) return null
        const pBAtualPct = randPick(r, [20, 25])
        const denAtual = 100 / pBAtualPct
        if (pBAlvoDen <= denAtual + 1) return null
        const premB = randInt(r, 2, 6)
        return montarUrnaProbabilidade(r, pAPct, premB, pBAtualPct, pAlvoPct, seq)
      },
      () => gEnemUrnaProbabilidade.reserva(),
    )
  },
  reserva: () => montarUrnaProbabilidade(semente(8), 20, 4, 25, 1, 0),
}

// ─── 9. GEOMETRIA PLANA: ÁREA COM RECORTE E COBERTURA MODULAR (Grau 5) ────────────────────────────────
interface ContextoAreaRecorte {
  readonly intro: string
  readonly recorteNome: string
  readonly moduloNome: string
  readonly unidadeSingular: string
  readonly unidadePlural: string
}

const CONTEXTOS_AREA_RECORTE: readonly ContextoAreaRecorte[] = [
  {
    intro: 'Em um centro logístico, um galpão retangular de',
    recorteNome: 'área reservada para doca interna de',
    moduloNome: 'cada caixa de piso industrial cobre exatamente',
    unidadeSingular: 'caixa',
    unidadePlural: 'caixas',
  },
  {
    intro: 'Em uma usina fotovoltaica rural, a cobertura retangular de um estábulo mede',
    recorteNome: 'claraboia central de ventilação medindo',
    moduloNome: 'cada módulo solar instalado ocupa área útil de',
    unidadeSingular: 'módulo',
    unidadePlural: 'módulos',
  },
  {
    intro: 'No projeto de uma estufa de agronegócio, um viveiro retangular apresenta',
    recorteNome: 'corredor de passagem sem bancadas medindo',
    moduloNome: 'cada conjunto de mudas hidropônicas ocupa',
    unidadeSingular: 'conjunto',
    unidadePlural: 'conjuntos',
  },
]

function montarGeometriaAreaPerimetro(
  rng: Rng,
  ctxIdx: number,
  comp: number,
  larg: number,
  recComp: number,
  recLarg: number,
  areaMod: number,
  seq: number,
): DesafioUnificado {
  const ctx = CONTEXTOS_AREA_RECORTE[ctxIdx % CONTEXTOS_AREA_RECORTE.length]
  const areaBruta = comp * larg
  const areaRecorte = recComp * recLarg
  const areaLiquida = areaBruta - areaRecorte
  const ans = Math.round(areaLiquida / areaMod)
  const erroSemDesconto = Math.round(areaBruta / areaMod)
  const erroSomouRecorte = Math.round((areaBruta + areaRecorte) / areaMod)
  const erroPerimetro = 2 * (comp + larg)

  return {
    id: `enem_gen_area_${seq}`,
    assinatura: `g5_area:${ctxIdx}:${comp}:${larg}:${recComp}:${recLarg}:${areaMod}=${ans}`,
    origem: 'motor_parametrico',
    grau: 5,
    temaId: 'enem_geometria_medidas',
    temaTituloPt: 'Geometria, Áreas e Volumes (ENEM)',
    arquetipoOuItemId: 'g5_geometria_area_perimetro',
    enunciadoMarkdown:
      `${ctx.intro} **${comp} m × ${larg} m**, mas possui uma ${ctx.recorteNome} **${recComp} m × ${recLarg} m** que não receberá cobertura.\n\n` +
      `Sabendo que ${ctx.moduloNome} **${areaMod} m²**, quantas ${ctx.unidadePlural} completas são necessárias para preencher exatamente a área útil restante?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `${ans} ${ans === 1 ? ctx.unidadeSingular : ctx.unidadePlural}`,
        diag: `Perfeito! Subtraiu o recorte (${areaRecorte} m²) da área bruta (${areaBruta} m²) antes de dividir por ${areaMod} m².`,
      },
      [
        {
          valor: erroSemDesconto,
          rotulo: `${erroSemDesconto} ${ctx.unidadePlural}`,
          diagnosticoPt: 'Você calculou pela área total sem descontar a região excluída do retângulo!',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroSomouRecorte,
          rotulo: `${erroSomouRecorte} ${ctx.unidadePlural}`,
          diagnosticoPt: 'Em vez de subtrair a área não coberta, você acabou somando os dois retângulos.',
          tagErro: 'calculo_aritmetico',
        },
        {
          valor: erroPerimetro,
          rotulo: `${erroPerimetro} ${ctx.unidadePlural}`,
          diagnosticoPt: 'Atenção: o preenchimento depende da ÁREA em m², não do perímetro do contorno!',
          tagErro: 'geometria_escala',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Toda a superfície principal será preenchida, EXCETO a área do recorte interno.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Calcule a área do retângulo grande, desconte a área do retângulo interno excluído e só então divida pela área de cada unidade.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: dividir a área bruta inteira esquecendo de subtrair o trecho vazio, ou confundir área com perímetro.',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Área total = ${comp} × ${larg} = ${areaBruta} m². Recorte = ${recComp} × ${recLarg} = ${areaRecorte} m². Útil = ${areaLiquida} m² ÷ ${areaMod} = ${ans} ${ctx.unidadePlural}.`,
      metodos: [
        { selo: '📐 Área por Diferença', resumo: `(${comp}×${larg} − ${recComp}×${recLarg}) ÷ ${areaMod} = ${ans}.` },
      ],
      dicaVidaRealPt: 'Calcular área líquida por subtração é muito mais rápido do que fatiar a planta em vários retângulos menores.',
    },
  }
}

export const gEnemGeometriaAreaPerimetro: GeradorEnemParametrico = {
  archetypeId: 'g5_geometria_area_perimetro',
  grau: 5,
  temaId: 'enem_geometria_medidas',
  temaTituloPt: 'Geometria, Áreas e Volumes (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const ctxIdx = randInt(r, 0, CONTEXTOS_AREA_RECORTE.length - 1)
        const areaMod = randPick(r, [2, 3, 4, 5])
        const comp = randInt(r, 10, 28)
        const larg = randInt(r, 8, 20)
        const recComp = randInt(r, 2, Math.floor(comp / 2))
        const recLarg = randInt(r, 2, Math.floor(larg / 2))
        const liquida = comp * larg - recComp * recLarg
        if (liquida <= areaMod * 4 || liquida % areaMod !== 0) return null
        return montarGeometriaAreaPerimetro(r, ctxIdx, comp, larg, recComp, recLarg, areaMod, seq)
      },
      () => gEnemGeometriaAreaPerimetro.reserva(),
    )
  },
  reserva: () => montarGeometriaAreaPerimetro(semente(9), 0, 20, 12, 4, 5, 2, 0),
}

// ─── 10. ESTATÍSTICA: MEDIANA COM SÉRIE DESORDENADA (Grau 5) ───────────────────────────────────────────
const CONTEXTOS_MEDIANA: readonly { readonly frase: string; readonly unidade: string }[] = [
  { frase: 'os prazos de entrega (em minutos) de seis pedidos sucessivos no e-commerce foram:', unidade: 'min' },
  { frase: 'o tempo de atendimento (em minutos) dos seis primeiros pacientes na triagem hospitalar foi:', unidade: 'min' },
  { frase: 'a massa colhida (em kg) em seis talhões experimentais de agronegócio foi:', unidade: 'kg' },
]

function montarEstatisticaMediana(
  rng: Rng,
  ctxIdx: number,
  brutos: readonly number[],
  seq: number,
): DesafioUnificado {
  const ctx = CONTEXTOS_MEDIANA[ctxIdx % CONTEXTOS_MEDIANA.length]
  const ordenados = [...brutos].sort((a, b) => a - b)
  const ans = (ordenados[2] + ordenados[3]) / 2
  const meioSemOrdenar = (brutos[2] + brutos[3]) / 2
  const erroApenasTerceiro = ordenados[2]
  const soma = brutos.reduce((acc, v) => acc + v, 0)
  const mediaExata = Math.round(soma / brutos.length)

  return {
    id: `enem_gen_mediana_${seq}`,
    assinatura: `g5_mediana:${ctxIdx}:${brutos.join(',')}=${ans}`,
    origem: 'motor_parametrico',
    grau: 5,
    temaId: 'enem_estatistica_medias',
    temaTituloPt: 'Médias, Mediana e Interpretação de Dados (ENEM)',
    arquetipoOuItemId: 'g5_estatistica_mediana_moda',
    enunciadoMarkdown:
      `Durante um acompanhamento operacional, ${ctx.frase}\n\n` +
      `**${brutos.join(', ')}**\n\n` +
      `Qual é a **mediana** desse conjunto de dados, em ${ctx.unidade}?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `${ans} ${ctx.unidade}`,
        diag: `Exato! Após ordenar (${ordenados.join(', ')}), a mediana é a média dos dois termos centrais (${ordenados[2]} e ${ordenados[3]}).`,
      },
      [
        {
          valor: meioSemOrdenar,
          rotulo: `${meioSemOrdenar} ${ctx.unidade}`,
          diagnosticoPt: 'Você pegou os valores centrais sem colocar a lista em ordem crescente antes!',
          tagErro: 'estatistica_mediana',
        },
        {
          valor: erroApenasTerceiro,
          rotulo: `${erroApenasTerceiro} ${ctx.unidade}`,
          diagnosticoPt: 'Para uma quantidade PAR de dados (6 valores), a mediana é a média entre o 3º e o 4º termo ordenado!',
          tagErro: 'estatistica_mediana',
        },
        {
          valor: mediaExata,
          rotulo: `${mediaExata} ${ctx.unidade}`,
          diagnosticoPt: 'Você calculou a média aritmética da lista, enquanto a questão pede a MEDIANA (posição central ordenada).',
          tagErro: 'leitura_interpretacao',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Antes de olhar para o meio da lista, é obrigatório colocar os seis valores em ordem crescente (do menor para o maior).',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Como há 6 números (quantidade par), nenhum elemento fica sozinho no meio: faça a média aritmética do 3º e do 4º termos ordenados.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: responder os números centrais da ordem original ou calcular a média de todos os seis.',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Ordenando: ${ordenados.join(', ')}. Os dois centrais (3º e 4º) são ${ordenados[2]} e ${ordenados[3]}. Mediana = (${ordenados[2]} + ${ordenados[3]}) ÷ 2 = ${ans} ${ctx.unidade}.`,
      metodos: [
        { selo: '📊 Ordem & Corte', resumo: 'Corte os 2 menores e os 2 maiores; faça a média exata dos dois do meio.' },
      ],
      dicaVidaRealPt: 'Mediana não é afetada por um único pico muito alto ou muito baixo — por isso salários e prazos usam mediana.',
    },
  }
}

export const gEnemEstatisticaMedianaModa: GeradorEnemParametrico = {
  archetypeId: 'g5_estatistica_mediana_moda',
  grau: 5,
  temaId: 'enem_estatistica_medias',
  temaTituloPt: 'Médias, Mediana e Interpretação de Dados (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const ctxIdx = randInt(r, 0, CONTEXTOS_MEDIANA.length - 1)
        const base = Array.from({ length: 6 }, () => randInt(r, 12, 84))
        const ord = [...base].sort((a, b) => a - b)
        if (ord[2] === ord[3]) return null
        if ((ord[2] + ord[3]) % 2 !== 0) return null
        const ans = (ord[2] + ord[3]) / 2
        const semOrd = (base[2] + base[3]) / 2
        if (semOrd === ans || !Number.isInteger(semOrd)) return null
        const soma = base.reduce((a, b) => a + b, 0)
        if (Math.round(soma / 6) === ans) return null
        return montarEstatisticaMediana(r, ctxIdx, base, seq)
      },
      () => gEnemEstatisticaMedianaModa.reserva(),
    )
  },
  reserva: () => montarEstatisticaMediana(semente(10), 0, [48, 22, 64, 30, 52, 40], 0),
}

// ─── 11. JUROS SIMPLES & COMPARAÇÃO À VISTA VS A PRAZO (Grau 5) ────────────────────────────────────────
const CONTEXTOS_JUROS_SIMPLES: readonly string[] = [
  'Para adquirir um **inversor de energia solar**, um produtor analisa a tabela de pagamento cujo preço anunciado é',
  'Na compra de um **monitor multiparamétrico hospitalar**, uma clínica compara condições de pagamento sobre o valor anunciado de',
  'Uma loja de **materiais de construção civil** anuncia uma betoneira com preço de etiqueta de',
]

function montarJurosSimplesParcelamento(
  rng: Rng,
  ctxIdx: number,
  preco: number,
  descPct: number,
  taxaPct: number,
  meses: number,
  seq: number,
): DesafioUnificado {
  const ctx = CONTEXTOS_JUROS_SIMPLES[ctxIdx % CONTEXTOS_JUROS_SIMPLES.length]
  const avista = Math.round(preco * (1 - descPct / 100))
  const juros = Math.round(preco * (taxaPct / 100) * meses)
  const aprazo = preco + juros
  const ans = aprazo - avista
  const erroApenasJuros = juros
  const erroApenasDesconto = preco - avista
  const erroUmMes = Math.round(preco * (taxaPct / 100)) + (preco - avista)
  const fmt = (n: number) => n.toLocaleString('pt-BR')

  return {
    id: `enem_gen_js_${seq}`,
    assinatura: `g5_juros_simples:${ctxIdx}:${preco}:${descPct}:${taxaPct}:${meses}=${ans}`,
    origem: 'motor_parametrico',
    grau: 5,
    temaId: 'enem_porcentagem_financeira',
    temaTituloPt: 'Porcentagem, Lucro e Matemática Financeira (ENEM)',
    arquetipoOuItemId: 'g5_juros_simples_parcelamento',
    enunciadoMarkdown:
      `${ctx} **R$ ${fmt(preco)},00**.\n\n` +
      `- **À vista:** desconto de **${descPct}%** sobre o preço anunciado.\n` +
      `- **A prazo:** acréscimo em **juros simples** de **${taxaPct}% ao mês** durante **${meses} meses**, sobre o preço anunciado.\n\n` +
      `Qual é a diferença, em reais, entre o valor total pago a prazo e o valor pago à vista?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `R$ ${fmt(ans)},00`,
        diag: `Correto! A economia à vista somada aos juros totais de ${meses} meses revela a diferença real entre as duas opções.`,
      },
      [
        {
          valor: erroApenasJuros,
          rotulo: `R$ ${fmt(erroApenasJuros)},00`,
          diagnosticoPt: 'Você calculou apenas os juros do parcelamento sobre o preço cheio e esqueceu que no pagamento imediato ainda há desconto!',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroApenasDesconto,
          rotulo: `R$ ${fmt(erroApenasDesconto)},00`,
          diagnosticoPt: 'Esse é apenas o desconto obtido à vista em relação à etiqueta, sem somar os juros do parcelamento.',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroUmMes,
          rotulo: `R$ ${fmt(erroUmMes)},00`,
          diagnosticoPt: `Atenção ao prazo: a taxa incide durante todos os ${meses} meses em juros simples, e não apenas em 1 mês!`,
          tagErro: 'porcentagem_base',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'A modalidade imediata fica abaixo do preço anunciado e o parcelamento fica acima: a distância entre elas SOMA o desconto + os juros!',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Calcule J = C × i × t (em meses) para achar quanto sobe no prazo e calcule o desconto em reais no pagamento imediato.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: responder apenas os juros sem incluir o benefício perdido do desconto à vista.',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `À vista = ${preco} − ${descPct}% = R$ ${fmt(avista)},00. Juros simples (${meses} meses) = ${preco} × ${taxaPct}% × ${meses} = R$ ${fmt(juros)},00 ⇒ A prazo = R$ ${fmt(aprazo)},00. Diferença = R$ ${fmt(ans)},00.`,
      metodos: [
        { selo: '💳 Soma de Percentuais na Mesma Base', resumo: `Como ambos incidem sobre o preço de etiqueta: diferença = (${descPct}% + ${taxaPct}×${meses}%) de ${preco}.` },
      ],
      dicaVidaRealPt: 'Quando à vista e a prazo usam a mesma base (etiqueta), o desconto renunciado também entra no custo real do parcelamento.',
    },
  }
}

export const gEnemJurosSimplesParcelamento: GeradorEnemParametrico = {
  archetypeId: 'g5_juros_simples_parcelamento',
  grau: 5,
  temaId: 'enem_porcentagem_financeira',
  temaTituloPt: 'Porcentagem, Lucro e Matemática Financeira (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const ctxIdx = randInt(r, 0, CONTEXTOS_JUROS_SIMPLES.length - 1)
        const preco = randPick(r, [1200, 1500, 2000, 2500, 3000, 4000, 5000])
        const descPct = randPick(r, [5, 8, 10, 12, 15])
        const taxaPct = randPick(r, [2, 3, 4, 5])
        const meses = randInt(r, 2, 5)
        if (taxaPct * meses === descPct) return null
        return montarJurosSimplesParcelamento(r, ctxIdx, preco, descPct, taxaPct, meses, seq)
      },
      () => gEnemJurosSimplesParcelamento.reserva(),
    )
  },
  reserva: () => montarJurosSimplesParcelamento(semente(11), 0, 2000, 10, 3, 4, 0),
}

// ─── 12. GEOMETRIA ESPACIAL: RESERVATÓRIO & ENCHIMENTO EM LITROS (Grau 6) ───────────────────────────────
const CONTEXTOS_VOLUME_LITROS: readonly { readonly sujeito: string; readonly liquido: string }[] = [
  { sujeito: 'um tanque de irrigação agrícola', liquido: 'solução nutritiva' },
  { sujeito: 'um reservatório de concreto em um canteiro de construção civil', liquido: 'água' },
  { sujeito: 'uma cuba retangular de laboratório químico', liquido: 'água deionizada' },
]

function montarGeometriaEspacialVolume(
  rng: Rng,
  ctxIdx: number,
  a: number,
  b: number,
  h: number,
  pctCheio: number,
  vazaoLMin: number,
  seq: number,
): DesafioUnificado {
  const ctx = CONTEXTOS_VOLUME_LITROS[ctxIdx % CONTEXTOS_VOLUME_LITROS.length]
  const volTotalL = Math.round(a * b * h * 1000)
  const faltaL = Math.round((volTotalL * (100 - pctCheio)) / 100)
  const ans = Math.round(faltaL / vazaoLMin)
  const erroTanqueTodo = Math.round(volTotalL / vazaoLMin)
  const erroParteJaCheia = Math.round((volTotalL * pctCheio) / 100 / vazaoLMin)
  const erroConversaoDez = Math.max(2, Math.round(ans / 10))

  return {
    id: `enem_gen_vol_${seq}`,
    assinatura: `g6_vol:${ctxIdx}:${a}:${b}:${h}:${pctCheio}:${vazaoLMin}=${ans}`,
    origem: 'motor_parametrico',
    grau: 6,
    temaId: 'enem_geometria_medidas',
    temaTituloPt: 'Geometria, Áreas e Volumes (ENEM)',
    arquetipoOuItemId: 'g6_geometria_espacial_volume',
    enunciadoMarkdown:
      `Em um projeto técnico, ${ctx.sujeito} tem formato de paralelepípedo retangular medindo **${a} m × ${b} m** de base e **${h} m** de altura.\n\n` +
      `Esse reservatório já está preenchido com **${pctCheio}%** da sua capacidade total de ${ctx.liquido} e será completamente abastecido por uma bomba com vazão constante de **${vazaoLMin} L/min**.\n\n` +
      `Quantos **minutos** serão necessários para completar o enchimento do reservatório?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `${ans} min`,
        diag: `Correto! O volume total em litros (${volTotalL.toLocaleString('pt-BR')} L) ainda precisa de ${100 - pctCheio}% (${faltaL.toLocaleString('pt-BR')} L) para encher.`,
      },
      [
        {
          valor: erroTanqueTodo,
          rotulo: `${erroTanqueTodo} min`,
          diagnosticoPt: `Você calculou o tempo para encher 100% do reservatório, esquecendo que ele já estava com ${pctCheio}% cheio!`,
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroParteJaCheia,
          rotulo: `${erroParteJaCheia} min`,
          diagnosticoPt: `Cuidado: você usou os ${pctCheio}% que JÁ estão dentro do tanque em vez dos ${100 - pctCheio}% que FALTAM!`,
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroConversaoDez,
          rotulo: `${erroConversaoDez} min`,
          diagnosticoPt: 'Verifique a conversão de metros cúbicos para litros: $1\\text{ m}^3 = 1\\ 000\\text{ litros}$ (não 100 L).',
          tagErro: 'conversao_unidades',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Lembre que $1\\text{ m}^3 = 1\\ 000\\text{ litros}$. Converta logo o volume total do bloco para litros!',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: `Se ${pctCheio}% já está preenchido, quanto falta em porcentagem para atingir 100%? Multiplique esse percentual restante pelo volume total em litros.`,
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: dividir o volume TOTAL pela vazão ignorando a água que já existia lá dentro.',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Volume total = ${a} × ${b} × ${h} = ${a * b * h} m³ = ${volTotalL.toLocaleString('pt-BR')} L. Falta preencher ${100 - pctCheio}% = ${faltaL.toLocaleString('pt-BR')} L. Tempo = ${faltaL} ÷ ${vazaoLMin} = ${ans} min.`,
      metodos: [
        { selo: '💧 Volume Faltante Direto', resumo: `${a * b * h} × 1000 × ${(100 - pctCheio) / 100} ÷ ${vazaoLMin} = ${ans} min.` },
      ],
      dicaVidaRealPt: 'Guardar a equivalência 1 m³ = 1 000 litros resolve quase metade dos problemas de reservatórios.',
    },
  }
}

export const gEnemGeometriaEspacialVolume: GeradorEnemParametrico = {
  archetypeId: 'g6_geometria_espacial_volume',
  grau: 6,
  temaId: 'enem_geometria_medidas',
  temaTituloPt: 'Geometria, Áreas e Volumes (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const ctxIdx = randInt(r, 0, CONTEXTOS_VOLUME_LITROS.length - 1)
        const a = randInt(r, 2, 5)
        const b = randInt(r, 2, 4)
        const h = randPick(r, [2, 3, 4])
        const pctCheio = randPick(r, [20, 25, 40])
        const vazao = randPick(r, [50, 100, 125, 200, 250])
        const faltaL = (a * b * h * 1000 * (100 - pctCheio)) / 100
        if (faltaL % vazao !== 0) return null
        return montarGeometriaEspacialVolume(r, ctxIdx, a, b, h, pctCheio, vazao, seq)
      },
      () => gEnemGeometriaEspacialVolume.reserva(),
    )
  },
  reserva: () => montarGeometriaEspacialVolume(semente(12), 0, 3, 2, 2, 25, 150, 0),
}

// ─── 13. FUNÇÃO QUADRÁTICA: MÁXIMO PELO VÉRTICE (Grau 6) ────────────────────────────────────────────────
interface ContextoQuadratica {
  readonly frase: string
  readonly varX: string
  readonly varY: string
  readonly simbolo: string
}

const CONTEXTOS_QUADRATICA: readonly ContextoQuadratica[] = [
  {
    frase: 'em uma operação de **e-commerce**, o lucro diário em reais em função de $x$ anúncios patrocinados é modelado por',
    varX: 'anúncios',
    varY: 'o lucro máximo diário, em reais,',
    simbolo: 'L',
  },
  {
    frase: 'em uma usina de **energia solar**, a potência extra gerada (em W) conforme o ângulo $x$ de ajuste é descrita por',
    varX: 'graus de ajuste',
    varY: 'a potência máxima extra atingida, em W,',
    simbolo: 'P',
  },
  {
    frase: 'em uma análise de desempenho **esportivo**, a altura (em metros) da trajetória parabólica de um lançamento após $x$ segundos segue a lei',
    varX: 'segundos',
    varY: 'a altura máxima atingida, em metros,',
    simbolo: 'h',
  },
]

function montarFuncaoQuadraticaVertice(
  rng: Rng,
  ctxIdx: number,
  a: number,
  xv: number,
  yv: number,
  seq: number,
): DesafioUnificado {
  const ctx = CONTEXTOS_QUADRATICA[ctxIdx % CONTEXTOS_QUADRATICA.length]
  // f(x) = -a(x - xv)^2 + yv = -a x^2 + (2*a*xv) x + (yv - a*xv^2)
  const b = 2 * a * xv
  const c = yv - a * xv * xv
  const sinalC = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`
  const ans = yv
  const erroXv = xv
  const erroSemDividirDois = -a * (2 * xv) * (2 * xv) + b * (2 * xv) + c
  const erroC = c > 0 ? c : Math.abs(c) + a * xv

  return {
    id: `enem_gen_quad_${seq}`,
    assinatura: `g6_quad:${ctxIdx}:${a}:${xv}:${yv}=${ans}`,
    origem: 'motor_parametrico',
    grau: 6,
    temaId: 'enem_funcoes_sequencias',
    temaTituloPt: 'Funções, Modelagem e Sequências (ENEM)',
    arquetipoOuItemId: 'g6_funcao_quadratica_vertice',
    enunciadoMarkdown:
      `Segundo um estudo aplicado, ${ctx.frase}\n\n` +
      `$$${ctx.simbolo}(x) = -${a}x^2 + ${b}x ${sinalC}$$\n\n` +
      `De acordo com esse modelo quadrático, qual é ${ctx.varY} que pode ser obtida(o)?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `${ans}`,
        diag: `Correto! O vértice ocorre em $x_V = \\frac{-b}{2a} = ${xv}$, e substituindo na lei obtém-se exatamente o valor máximo ${yv}.`,
      },
      [
        {
          valor: erroXv,
          rotulo: `${erroXv}`,
          diagnosticoPt: `Cuidado: ${xv} é o valor de $x_V$ (${ctx.varX}) que gera o pico, mas a pergunta pede o valor MÁXIMO da função (${ctx.simbolo})!`,
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroSemDividirDois > 0 && erroSemDividirDois !== ans ? erroSemDividirDois : ans + a * xv,
          rotulo: `${erroSemDividirDois > 0 && erroSemDividirDois !== ans ? erroSemDividirDois : ans + a * xv}`,
          diagnosticoPt: 'Lembre-se do fator $2$ no denominador de $x_V = \\frac{-b}{2a}$ antes de substituir de volta na função.',
          tagErro: 'algebra_manipulacao',
        },
        {
          valor: erroC !== ans ? erroC : ans + b,
          rotulo: `${erroC !== ans ? erroC : ans + b}`,
          diagnosticoPt: 'O termo independente isolado representa apenas o valor inicial em $x = 0$, nunca o ponto máximo da parábola.',
          tagErro: 'leitura_interpretacao',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'A parábola tem coeficiente de $x^2$ negativo, logo possui concavidade para baixo e atinge máximo no VÉRTICE.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: `Ache primeiro em qual $x_V$ acontece o máximo usando $x_V = \\frac{-b}{2a}$ e, depois, substitua esse $x_V$ na função ${ctx.simbolo}(x)!`,
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: calcular $x_V$ certinho e esquecer de jogar de volta na fórmula para achar $y_V$.',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `$x_V = \\frac{-${b}}{2 \\cdot (-${a})} = ${xv}$. Substituindo: ${ctx.simbolo}(${xv}) = -${a}(${xv})^2 + ${b}(${xv}) ${sinalC} = ${yv}.`,
      metodos: [
        { selo: '⛰️ Vértice Direto', resumo: `Em toda parábola com $x_V$ inteiro, $y_V = ${yv}$ sai na hora substituindo $x = ${xv}$ ou por $-\\Delta/(4a)$.` },
      ],
      dicaVidaRealPt: 'Conferir sempre se o enunciado pede "quando ocorre" ($x_V$) ou "qual é o valor máximo" ($y_V$).',
    },
  }
}

export const gEnemFuncaoQuadraticaVertice: GeradorEnemParametrico = {
  archetypeId: 'g6_funcao_quadratica_vertice',
  grau: 6,
  temaId: 'enem_funcoes_sequencias',
  temaTituloPt: 'Funções, Modelagem e Sequências (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const ctxIdx = randInt(r, 0, CONTEXTOS_QUADRATICA.length - 1)
        const a = randPick(r, [1, 2, 3, 5])
        const xv = randInt(r, 3, 12)
        const yv = a * xv * xv + randInt(r, 5, 60)
        if (yv === xv || yv <= 0) return null
        return montarFuncaoQuadraticaVertice(r, ctxIdx, a, xv, yv, seq)
      },
      () => gEnemFuncaoQuadraticaVertice.reserva(),
    )
  },
  reserva: () => montarFuncaoQuadraticaVertice(semente(13), 2, 1, 5, 35, 0),
}

// ─── 14. PITÁGORAS & DESNÍVEL DE PLATAFORMA (Grau 6) ────────────────────────────────────────────────────
const CONTEXTOS_PITAGORAS: readonly { readonly sujeito: string; readonly objeto: string }[] = [
  { sujeito: 'Na ala de acessibilidade de um **hospital**', objeto: 'rampa retilínea de acesso' },
  { sujeito: 'Em um canteiro de **construção civil**', objeto: 'escora metálica inclinada' },
  { sujeito: 'Na manutenção de uma **torre eólica/solar**', objeto: 'cabo de aço esticado em linha reta' },
]

function montarPitagorasTrigonometria(
  rng: Rng,
  ctxIdx: number,
  hBase: number,
  hTopo: number,
  horiz: number,
  hipot: number,
  seq: number,
): DesafioUnificado {
  const ctx = CONTEXTOS_PITAGORAS[ctxIdx % CONTEXTOS_PITAGORAS.length]
  const dh = hTopo - hBase
  const ans = hipot
  const erroSoma = horiz + dh
  const erroSemDescontarBase = Math.round(Math.hypot(horiz, hTopo))
  const erroCatetoVertical = dh

  return {
    id: `enem_gen_pit_${seq}`,
    assinatura: `g6_pit:${ctxIdx}:${hBase}:${hTopo}:${horiz}=${ans}`,
    origem: 'motor_parametrico',
    grau: 6,
    temaId: 'enem_geometria_medidas',
    temaTituloPt: 'Geometria, Áreas e Volumes (ENEM)',
    arquetipoOuItemId: 'g6_pitagoras_trigonometria',
    enunciadoMarkdown:
      `${ctx.sujeito}, será instalada uma ${ctx.objeto} ligando uma plataforma inicial a **${hBase} m** de altura do solo até um patamar superior a **${hTopo} m** de altura do solo.\n\n` +
      `Sabendo que a distância horizontal entre os dois pontos de fixação mede **${horiz} m**, qual deve ser o comprimento exato dessa ${ctx.objeto}, em metros?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `${ans} m`,
        diag: `Correto! O desnível real vencido vale ${hTopo} − ${hBase} = ${dh} m, formando o triângulo retângulo de catetos ${horiz} m e ${dh} m.`,
      },
      [
        {
          valor: erroSoma,
          rotulo: `${erroSoma} m`,
          diagnosticoPt: 'Em um triângulo retângulo, a hipotenusa é sempre menor que a soma direta dos dois catetos!',
          tagErro: 'geometria_escala',
        },
        {
          valor: erroSemDescontarBase !== ans ? erroSemDescontarBase : ans + hBase,
          rotulo: `${erroSemDescontarBase !== ans ? erroSemDescontarBase : ans + hBase} m`,
          diagnosticoPt: `Você esqueceu de descontar a altura da plataforma inicial (${hBase} m) antes de aplicar o Teorema de Pitágoras.`,
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroCatetoVertical,
          rotulo: `${erroCatetoVertical} m`,
          diagnosticoPt: 'Esse é apenas o desnível vertical entre os dois apoios, e não o comprimento inclinado da peça.',
          tagErro: 'leitura_interpretacao',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'A peça não parte do chão (nível zero): calcule primeiro o desnível vertical real entre o patamar superior e a plataforma inicial.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Com o desnível vertical e a distância horizontal formando $90^\\circ$, aplique o Teorema de Pitágoras ($L^2 = \\Delta h^2 + d^2$).',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: usar a altura total do topo ignorando os metros iniciais da plataforma de partida.',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Desnível $\\Delta h = ${hTopo} - ${hBase} = ${dh}\\text{ m}$. Logo $L = \\sqrt{${dh}^2 + ${horiz}^2} = \\sqrt{${dh * dh + horiz * horiz}} = ${ans}\\text{ m}$.`,
      metodos: [
        { selo: '📐 Ternos Pitagóricos', resumo: `Reduzindo os catetos (${dh}, ${horiz}) pelo MDC aparece um terno clássico (3-4-5, 5-12-13 ou 8-15-17).` },
      ],
      dicaVidaRealPt: 'Reconhecer múltiplos de (3, 4, 5) e (5, 12, 13) poupa minutos preciosos em cálculo de raízes.',
    },
  }
}

export const gEnemPitagorasTrigonometria: GeradorEnemParametrico = {
  archetypeId: 'g6_pitagoras_trigonometria',
  grau: 6,
  temaId: 'enem_geometria_medidas',
  temaTituloPt: 'Geometria, Áreas e Volumes (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const ctxIdx = randInt(r, 0, CONTEXTOS_PITAGORAS.length - 1)
        const terno = randPick(r, [
          [3, 4, 5],
          [5, 12, 13],
          [8, 15, 17],
          [7, 24, 25],
        ] as const)
        const escala = randInt(r, 1, 4)
        const troca = randInt(r, 0, 1) === 1
        const dh = (troca ? terno[1] : terno[0]) * escala
        const horiz = (troca ? terno[0] : terno[1]) * escala
        const hipot = terno[2] * escala
        const hBase = randInt(r, 2, 7)
        const hTopo = hBase + dh
        return montarPitagorasTrigonometria(r, ctxIdx, hBase, hTopo, horiz, hipot, seq)
      },
      () => gEnemPitagorasTrigonometria.reserva(),
    )
  },
  reserva: () => montarPitagorasTrigonometria(semente(14), 0, 3, 15, 9, 15, 0),
}

// ─── 15. JUROS COMPOSTOS: MONTANTE EXATO (Grau 7) ────────────────────────────────────────────────────────
const CONTEXTOS_JUROS_COMPOSTOS: readonly string[] = [
  'Uma cooperativa de **agronegócio** aplicou seu fundo de safra de',
  'Uma construtora investiu parte da reserva técnica da obra, no valor de',
  'Uma operação de **e-commerce** destinou um caixa de expansão de',
]

function montarJurosCompostos(
  rng: Rng,
  ctxIdx: number,
  capital: number,
  taxaPct: number,
  periodos: 2 | 3,
  seq: number,
): DesafioUnificado {
  const ctx = CONTEXTOS_JUROS_COMPOSTOS[ctxIdx % CONTEXTOS_JUROS_COMPOSTOS.length]
  let m = capital
  for (let i = 0; i < periodos; i++) {
    m = Math.round((m * (100 + taxaPct)) / 100)
  }
  const ans = m
  const erroSimples = Math.round(capital * (1 + (taxaPct / 100) * periodos))
  const erroApenasJuros = ans - capital
  const erroUmPeriodoMenos = Math.round(ans / (1 + taxaPct / 100))
  const fmt = (n: number) => n.toLocaleString('pt-BR')

  return {
    id: `enem_gen_jc_${seq}`,
    assinatura: `g7_jc:${ctxIdx}:${capital}:${taxaPct}:${periodos}=${ans}`,
    origem: 'motor_parametrico',
    grau: 7,
    temaId: 'enem_porcentagem_financeira',
    temaTituloPt: 'Porcentagem, Lucro e Matemática Financeira (ENEM)',
    arquetipoOuItemId: 'g7_juros_compostos_montante',
    enunciadoMarkdown:
      `${ctx} **R$ ${fmt(capital)},00** em um investimento com rentabilidade em **juros compostos** à taxa de **${taxaPct}% ao mês**, sem novos aportes nem resgates.\n\n` +
      `Ao final de **${periodos} meses**, qual será o **montante total acumulado** nessa aplicação, em reais?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `R$ ${fmt(ans)},00`,
        diag: `Correto! Aplicando o fator ${(1 + taxaPct / 100).toFixed(2).replace('.', ',')} sucessivamente ${periodos} vezes, o capital sobre juros gera esse montante exato.`,
      },
      [
        {
          valor: erroSimples,
          rotulo: `R$ ${fmt(erroSimples)},00`,
          diagnosticoPt: 'Você calculou juros SIMPLES (multiplicando a taxa pelo número de meses), esquecendo os juros sobre juros!',
          tagErro: 'porcentagem_base',
        },
        {
          valor: erroApenasJuros,
          rotulo: `R$ ${fmt(erroApenasJuros)},00`,
          diagnosticoPt: 'Esse valor corresponde apenas aos JUROS rendidos, e não ao MONTANTE acumulado (capital + juros)!',
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroUmPeriodoMenos,
          rotulo: `R$ ${fmt(erroUmPeriodoMenos)},00`,
          diagnosticoPt: `Você aplicou a capitalização composta por um mês a menos que os ${periodos} meses do enunciado.`,
          tagErro: 'calculo_aritmetico',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'Em juros compostos, a cada mês multiplicamos o saldo inteiro anterior pelo fator (1 + i), isto é, M = C × (1 + i)^t.',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: 'Você pode aplicar o percentual passo a passo mês a mês sobre o novo saldo acumulado.',
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: multiplicar a taxa direto pelos meses (juros simples) ou responder só o lucro sem somar o capital inicial.',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `M = ${fmt(capital)} × ${(1 + taxaPct / 100).toFixed(2).replace('.', ',')}^${periodos} = R$ ${fmt(ans)},00.`,
      metodos: [
        { selo: '📈 Juros Sobre Juros Mês a Mês', resumo: `Para ${periodos} meses curtos, multiplicar passo a passo evita erros com expoentes.` },
      ],
      dicaVidaRealPt: 'Juros compostos crescem em progressão geométrica — o ganho de cada mês rende sobre os ganhos anteriores.',
    },
  }
}

export const gEnemJurosCompostosMontante: GeradorEnemParametrico = {
  archetypeId: 'g7_juros_compostos_montante',
  grau: 7,
  temaId: 'enem_porcentagem_financeira',
  temaTituloPt: 'Porcentagem, Lucro e Matemática Financeira (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const ctxIdx = randInt(r, 0, CONTEXTOS_JUROS_COMPOSTOS.length - 1)
        const capital = randPick(r, [2000, 4000, 5000, 8000, 10000, 20000])
        const taxaPct = randPick(r, [10, 20])
        const periodos = randPick(r, [2, 3] as const)
        return montarJurosCompostos(r, ctxIdx, capital, taxaPct, periodos, seq)
      },
      () => gEnemJurosCompostosMontante.reserva(),
    )
  },
  reserva: () => montarJurosCompostos(semente(15), 0, 10000, 10, 3, 0),
}

// ─── 16. SEQUÊNCIAS: PROGRESSÃO ARITMÉTICA E SOMA ACUMULADA (Grau 7) ──────────────────────────────────
interface ContextoPaPg {
  readonly intro: string
  readonly acao: string
  readonly periodo: string
  readonly unidade: string
}

const CONTEXTOS_PAPG: readonly ContextoPaPg[] = [
  {
    intro: 'Em um programa de **energia solar**, uma equipe instala',
    acao: 'painéis na 1ª semana e aumenta a meta semanal em exatamente',
    periodo: 'semanas',
    unidade: 'painéis',
  },
  {
    intro: 'Um atleta de **esportes de resistência** corre',
    acao: 'km na 1ª semana de treino e acrescenta sempre',
    periodo: 'semanas',
    unidade: 'km',
  },
  {
    intro: 'Um centro de **logística automatizada** despacha',
    acao: 'lotes no 1º mês de operação e amplia a capacidade em exatamente',
    periodo: 'meses',
    unidade: 'lotes',
  },
]

function montarPaPgSequencias(
  rng: Rng,
  ctxIdx: number,
  a1: number,
  razao: number,
  n: number,
  seq: number,
): DesafioUnificado {
  const ctx = CONTEXTOS_PAPG[ctxIdx % CONTEXTOS_PAPG.length]
  const an = a1 + (n - 1) * razao
  const ans = ((a1 + an) * n) / 2
  const erroApenasUltimo = an
  const erroEnesimoSemMenosUm = ((a1 + a1 + n * razao) * n) / 2
  const erroSemCrescimento = n * a1

  return {
    id: `enem_gen_papg_${seq}`,
    assinatura: `g7_pa:${ctxIdx}:${a1}:${razao}:${n}=${ans}`,
    origem: 'motor_parametrico',
    grau: 7,
    temaId: 'enem_funcoes_sequencias',
    temaTituloPt: 'Funções, Modelagem e Sequências (ENEM)',
    arquetipoOuItemId: 'g7_pa_pg_sequencias',
    enunciadoMarkdown:
      `${ctx.intro} **${a1} ${ctx.unidade}** ${ctx.acao} **${razao} ${ctx.unidade}** a cada período seguinte.\n\n` +
      `Mantendo essa progressão aritmética constante, qual será o **total acumulado** nos primeiros **${n} ${ctx.periodo}**?`,
    alternativas: montar4Alternativas(
      rng,
      {
        valor: ans,
        rotulo: `${ans} ${ctx.unidade}`,
        diag: `Correto! O último período chega a ${an} ${ctx.unidade} e a soma da P.A. acumula exatamente o total.`,
      },
      [
        {
          valor: erroApenasUltimo,
          rotulo: `${erroApenasUltimo} ${ctx.unidade}`,
          diagnosticoPt: `Cuidado: ${an} é apenas a marca do ÚLTIMO período ($a_${n}$), enquanto a pergunta pede o TOTAL acumulado de todos os ${n} períodos!`,
          tagErro: 'leitura_interpretacao',
        },
        {
          valor: erroEnesimoSemMenosUm,
          rotulo: `${erroEnesimoSemMenosUm} ${ctx.unidade}`,
          diagnosticoPt: `Atenção ao último termo da P.A.: do 1º ao ${n}º período ocorrem ${n - 1} aumentos, e não ${n} aumentos!`,
          tagErro: 'algebra_manipulacao',
        },
        {
          valor: erroSemCrescimento,
          rotulo: `${erroSemCrescimento} ${ctx.unidade}`,
          diagnosticoPt: 'Você multiplicou o valor inicial pelos períodos ignorando os acréscimos constantes de cada ciclo.',
          tagErro: 'calculo_aritmetico',
        },
      ],
    ),
    altarFisicoCompativel: true,
    dicas: [
      {
        nivel: 1,
        titulo: 'Foco & Leitura',
        textoPt: 'A cada período soma-se o mesmo número: isso forma uma Progressão Aritmética (P.A.).',
      },
      {
        nivel: 2,
        titulo: 'Resumo de Boteco',
        textoPt: `Encontre primeiro o valor do ${n}º período usando $a_n = a_1 + (n - 1)\\cdot r$; depois some todos usando $S_n = \\frac{(a_1 + a_n) \\cdot n}{2}$.`,
      },
      {
        nivel: 3,
        titulo: 'Primeiro Passo & Armadilha',
        textoPt: 'Armadilha clássica: responder apenas o valor atingido no último período sem somar os períodos anteriores.',
      },
    ],
    posAcerto: {
      solucaoCompletaPt: `Último termo $a_{${n}} = ${a1} + (${n} - 1) \\times ${razao} = ${an}$. Soma acumulada $S_{${n}} = \\frac{(${a1} + ${an}) \\times ${n}}{2} = ${ans} ${ctx.unidade}.`,
      metodos: [
        { selo: '🪜 Escada de Gauss', resumo: `Média do primeiro com o último (${(a1 + an) / 2}) multiplicada pelos ${n} períodos.` },
      ],
      dicaVidaRealPt: 'Pense em qualquer P.A. acumulada como "valor médio do período $\\times$ número de períodos".',
    },
  }
}

export const gEnemPaPgSequencias: GeradorEnemParametrico = {
  archetypeId: 'g7_pa_pg_sequencias',
  grau: 7,
  temaId: 'enem_funcoes_sequencias',
  temaTituloPt: 'Funções, Modelagem e Sequências (ENEM)',
  synthesize(rng, seq = 1) {
    return tentar(
      rng,
      (r) => {
        const ctxIdx = randInt(r, 0, CONTEXTOS_PAPG.length - 1)
        const a1 = randInt(r, 10, 40)
        const razao = randInt(r, 2, 12)
        const n = randInt(r, 6, 12)
        const an = a1 + (n - 1) * razao
        if (((a1 + an) * n) % 2 !== 0) return null
        return montarPaPgSequencias(r, ctxIdx, a1, razao, n, seq)
      },
      () => gEnemPaPgSequencias.reserva(),
    )
  },
  reserva: () => montarPaPgSequencias(semente(16), 0, 12, 4, 8, 0),
}

export const GERADORES_ENEM_PARAMETRICOS: readonly GeradorEnemParametrico[] = [
  gEnemEscala,
  gEnemPorcentagemSucessiva,
  gEnemMediaPonderada,
  gEnemCombinatoria,
  gEnemRegra3Composta,
  gEnemFuncaoAfim,
  gEnemVazaoProporcao,
  gEnemUrnaProbabilidade,
  gEnemGeometriaAreaPerimetro,
  gEnemEstatisticaMedianaModa,
  gEnemJurosSimplesParcelamento,
  gEnemGeometriaEspacialVolume,
  gEnemFuncaoQuadraticaVertice,
  gEnemPitagorasTrigonometria,
  gEnemJurosCompostosMontante,
  gEnemPaPgSequencias,
]
