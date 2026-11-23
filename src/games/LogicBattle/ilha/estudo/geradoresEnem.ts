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

export const GERADORES_ENEM_PARAMETRICOS: readonly GeradorEnemParametrico[] = [
  gEnemEscala,
  gEnemPorcentagemSucessiva,
  gEnemCombinatoria,
  gEnemFuncaoAfim,
]
