import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { getRecentMathSignaturesSnapshot, recordSeenMathChallenge, resetSeenMathMemory } from '../infiniteMathEngine'
import { semente } from '../geradoresBase'
import { protegerCifraoMoeda, protegerMarkdownInline, type GrauDificuldade } from './contratosEstudo'
import { validarDesafioZeroSpoiler } from './validadorDicas'
import { ENEM_MATEMATICA_LOTE1 } from './bancos/enemMatematicaLote1'
import { classificarFigurasParaApresentacao } from './figurasEnem'
import { GERADORES_ENEM_PARAMETRICOS } from './geradoresEnem'
import {
  carregarEnemLote1Lazy,
  limparCacheEnemLazy,
  resolverConceitoMotorParaTema,
  selecionarProximoDesafio,
} from './orquestradorQuestoes'
import { aplicarEventoNoEstado, estadoEstudoVazio } from './repositorioEstudo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export async function run(): Promise<void> {
  // 1. Mapeamento tema ENEM -> conceito motor
  assert(resolverConceitoMotorParaTema('enem_porcentagem_financeira') === 'assimetria_porcentagem', 'mapeamento porcentagem falhou')
  assert(resolverConceitoMotorParaTema('ponto_de_virada') === 'ponto_de_virada', 'conceito direto falhou')

  // 2. Grau 1..4 respeita tema fraco do diagnóstico
  let estado = estadoEstudoVazio()
  for (let i = 0; i < 2; i++) {
    estado = aplicarEventoNoEstado(estado, {
      tipo: 'erro_alternativa',
      quando: 1000 + i,
      itemId: `e${i}`,
      origem: 'motor_parametrico',
      temaId: 'assimetria_porcentagem',
      grau: 2,
      alternativaId: 'c1',
      tagErro: 'porcentagem_base',
      tempoDesdeAberturaMs: 6000,
    })
    estado = aplicarEventoNoEstado(estado, {
      tipo: 'acerto',
      quando: 2000 + i,
      itemId: `e${i}`,
      assinatura: `sig-${i}`,
      origem: 'motor_parametrico',
      temaId: 'assimetria_porcentagem',
      grau: 2,
      errosNaConta: 1,
      maiorDicaUsada: 0,
      tempoTotalMs: 7000,
      fatorBuff: 0.5,
    })
  }
  const dGrau2 = await selecionarProximoDesafio({
    grau: 2,
    estadoEstudo: estado,
    seed: 101,
  })
  assert(dGrau2.origem === 'motor_parametrico' && dGrau2.grau === 2, 'grau 2 deve vir do motor')
  assert(dGrau2.temaId === 'assimetria_porcentagem', `esperava reforço de assimetria_porcentagem, veio ${dGrau2.temaId}`)
  assert(dGrau2.altarFisicoCompativel === true && dGrau2.alternativas.length === 4, 'motor deve ter 4 alternativas e altar compatível')
  assert(validarDesafioZeroSpoiler(dGrau2).ok, 'desafio do motor adaptado violou zero spoiler')

  // 3. Grau 5 com temaPreferido escolhe questão oficial ENEM correspondente (5 opções A..E, altarFisicoCompativel=false)
  const dEnem5 = await selecionarProximoDesafio({
    grau: 5,
    estadoEstudo: estadoEstudoVazio(),
    temaPreferido: 'enem_porcentagem_financeira',
    preferirOrigem: 'enem_oficial',
    seed: 77,
    carregarBancoEnem: async () => ENEM_MATEMATICA_LOTE1,
  })
  assert(dEnem5.origem === 'enem_oficial', 'esperava questão oficial ENEM')
  assert(dEnem5.temaId === 'enem_porcentagem_financeira', `esperava tema preferido, veio ${dEnem5.temaId}`)
  assert(dEnem5.alternativas.length === 5 && dEnem5.altarFisicoCompativel === false, 'ENEM deve ter 5 opções e altarFisicoCompativel=false')
  assert(dEnem5.referenciaOficial?.exame === 'ENEM', 'questão ENEM sem referência oficial')

  // 4. Fallback gracioso se o chunk ENEM falhar (nunca trava ou lança exceção!)
  const dFallback = await selecionarProximoDesafio({
    grau: 6,
    estadoEstudo: estadoEstudoVazio(),
    seed: 333,
    carregarBancoEnem: async () => {
      throw new Error('rede offline simulada')
    },
  })
  assert(dFallback.origem === 'motor_parametrico' && dFallback.grau === 6, 'fallback de chunk falho deve usar motor ENEM grau 6')
  assert(dFallback.altarFisicoCompativel === true && dFallback.alternativas.length === 4, 'motor ENEM grau 6 deve ter 4 opções')

  // 5. Esgotamento por assinatura / domínio cai para gerador paramétrico sem repetir item já visto
  const todasGrau7Vistas = new Set(ENEM_MATEMATICA_LOTE1.filter((d) => d.grau === 7).map((d) => d.assinatura))
  const dEsgotado = await selecionarProximoDesafio({
    grau: 7,
    estadoEstudo: estadoEstudoVazio(),
    assinaturasVistas: todasGrau7Vistas,
    seed: 444,
    carregarBancoEnem: async () => ENEM_MATEMATICA_LOTE1,
  })
  assert(!todasGrau7Vistas.has(dEsgotado.assinatura), 'assinatura já vista foi repetida')
  assert(dEsgotado.origem === 'motor_parametrico' && dEsgotado.grau === 7, 'quando ENEM oficial esgota, cai para gerador ENEM grau 7')

  // 6. Real lazy dynamic loader também carrega em Node/SSR Vite
  limparCacheEnemLazy()
  const dLazy = await selecionarProximoDesafio({
    grau: 5,
    estadoEstudo: estadoEstudoVazio(),
    preferirOrigem: 'enem_oficial',
    seed: 12,
  })
  assert(dLazy.origem === 'enem_oficial' && dLazy.grau === 5, 'carregamento dinâmico real falhou')

  // 7. Regressão QAR1: `protegerCifraoMoeda` preserva $R$ e $11 - R$ dentro de LaTeX e escapa R$ monetário fora de math
  const q159Sample =
    'O valor custa R$ 3,00 ou R$ 5,00. Denotando por $R$ esse resto, temos $N_5$ = $11 - R$.'
  const protegido = protegerCifraoMoeda(q159Sample)
  assert(
    protegido === 'O valor custa R\\$ 3,00 ou R\\$ 5,00. Denotando por $R$ esse resto, temos $N_5$ = $11 - R$.',
    `protegerCifraoMoeda corrompeu LaTeX ou moeda: ${protegido}`,
  )

  // 8. Regressão QAR1: `validadorDicas` detecta vazamento parcial de rótulo composto decimal (ENEM Q155)
  const q155 = ENEM_MATEMATICA_LOTE1.find((d) => d.id === 'enem_2019_d2_c5_q155')
  assert(q155 !== undefined && validarDesafioZeroSpoiler(q155).ok, 'ENEM 2019 Q155 devia passar no zero-spoiler após correção')

  // 9. Regressão alternativa em branco: TODAS as alternativas ENEM + paramétricas + casos de borda
  //    renderizam texto visível sem virarem lista ordenada/bloco (<ol>, <ul>, <blockquote>, <hr>, <h1>..<h6>).
  const renderInline = (texto: string): string =>
    renderToStaticMarkup(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
          components: { p: ({ children }) => React.createElement(React.Fragment, null, children) },
        },
        protegerMarkdownInline(texto),
      ),
    )

  const checarRotuloSemBloco = (contexto: string, rotulo: string): string => {
    const html = renderInline(rotulo)
    assert(
      !/<(ol|ul|li|blockquote|hr|h[1-6])\b/i.test(html),
      `${contexto}: rótulo «${rotulo}» virou bloco Markdown (${html})`,
    )
    const textoVisivel = html.replace(/<[^>]+>/g, '').trim()
    assert(textoVisivel.length > 0, `${contexto}: rótulo «${rotulo}» renderizou vazio (${html})`)
    return html
  }

  for (const desafio of ENEM_MATEMATICA_LOTE1) {
    for (const alt of desafio.alternativas) {
      checarRotuloSemBloco(`${desafio.id}[${alt.letra}]`, alt.rotulo)
    }
  }
  for (const gen of GERADORES_ENEM_PARAMETRICOS) {
    for (const item of [gen.reserva(), gen.synthesize(semente(99), 99)]) {
      for (const alt of item.alternativas) {
        checarRotuloSemBloco(`${gen.archetypeId}[${alt.letra}]`, alt.rotulo)
      }
    }
  }
  for (const borda of ['5.', '80.', '0109082.', '10.', '16.', '1) teste', '- item', '> citação', '# título', '---', '$x = 5.$']) {
    checarRotuloSemBloco(`borda(${borda})`, borda)
  }
  const htmlZeroEsquerda = checarRotuloSemBloco('zero-esquerda', '0109082.')
  assert(htmlZeroEsquerda.includes('0109082.'), `esperava preservar 0109082., veio ${htmlZeroEsquerda}`)

  // 10. Regressão anti-repetição e fim do loop eterno na "oficina" (Graus 1..7 + Grau 7 esgotado + temaPreferido)
  resetSeenMathMemory()
  for (const grau of [1, 2, 3, 4, 5, 6, 7] as readonly GrauDificuldade[]) {
    const vistas = new Set<string>()
    let recentes: string[] = []
    const arquetipos: string[] = []
    for (let i = 0; i < 20; i++) {
      const d = await selecionarProximoDesafio({
        grau,
        estadoEstudo: estadoEstudoVazio(),
        assinaturasVistas: vistas,
        arquetiposRecentes: recentes,
        seed: 100 + grau * 31 + i * 17,
        carregarBancoEnem: async () => ENEM_MATEMATICA_LOTE1,
      })
      vistas.add(d.assinatura)
      recentes = [...recentes, d.arquetipoOuItemId].slice(-8)
      arquetipos.push(d.arquetipoOuItemId)
    }
    for (let i = 1; i < arquetipos.length; i++) {
      assert(
        arquetipos[i] !== arquetipos[i - 1],
        `Grau ${grau}: repetiu arquetipo consecutivo «${arquetipos[i]}» na posição ${i}`,
      )
    }
    assert(new Set(arquetipos).size >= 4, `Grau ${grau}: variedade baixa (${new Set(arquetipos).size})`)
  }

  // Grau 7 com TODAS as 12 ENEM já vistas inicialmente: gira pelos 3 geradores paramétricos e recicla ENEM sem travar na oficina
  const g7VistasTodas = new Set(ENEM_MATEMATICA_LOTE1.filter((d) => d.grau === 7).map((d) => d.assinatura))
  let g7Recentes: string[] = []
  const g7Arqs: string[] = []
  for (let i = 0; i < 16; i++) {
    const d = await selecionarProximoDesafio({
      grau: 7,
      estadoEstudo: estadoEstudoVazio(),
      assinaturasVistas: g7VistasTodas,
      arquetiposRecentes: g7Recentes,
      seed: 900 + i * 23,
      carregarBancoEnem: async () => ENEM_MATEMATICA_LOTE1,
    })
    g7VistasTodas.add(d.assinatura)
    g7Recentes = [...g7Recentes, d.arquetipoOuItemId].slice(-8)
    g7Arqs.push(d.arquetipoOuItemId)
  }
  for (let i = 1; i < g7Arqs.length; i++) {
    assert(g7Arqs[i] !== g7Arqs[i - 1], `Grau 7 esgotado repetiu «${g7Arqs[i]}» em sequência (${i})`)
  }
  assert(
    new Set(g7Arqs).size >= 5,
    `Grau 7 esgotado deveria alternar geradores e reciclar ENEM, veio só: ${[...new Set(g7Arqs)].join(', ')}`,
  )
  assert(
    g7Arqs.some((id) => id.startsWith('enem_')),
    'Grau 7 após o ciclo dos geradores deveria reciclar questões oficiais do ENEM em vez de travar nos paramétricos',
  )

  // Grau 7 com temaPreferido='enem_funcoes_sequencias': nunca fica preso na oficina repetidamente
  const g7TemaVistas = new Set<string>()
  let g7TemaRecentes: string[] = []
  const g7TemaArqs: string[] = []
  for (let i = 0; i < 10; i++) {
    const d = await selecionarProximoDesafio({
      grau: 7,
      estadoEstudo: estadoEstudoVazio(),
      temaPreferido: 'enem_funcoes_sequencias',
      assinaturasVistas: g7TemaVistas,
      arquetiposRecentes: g7TemaRecentes,
      seed: 1200 + i * 19,
      carregarBancoEnem: async () => ENEM_MATEMATICA_LOTE1,
    })
    g7TemaVistas.add(d.assinatura)
    g7TemaRecentes = [...g7TemaRecentes, d.arquetipoOuItemId].slice(-8)
    g7TemaArqs.push(d.arquetipoOuItemId)
  }
  for (let i = 1; i < g7TemaArqs.length; i++) {
    assert(g7TemaArqs[i] !== g7TemaArqs[i - 1], `Grau 7 temaPreferido repetiu «${g7TemaArqs[i]}» em sequência (${i})`)
  }

  // 11. Regressão reset de memória do motor infinito
  recordSeenMathChallenge('sig_teste_reset', 'g1_massinha_soma')
  assert(getRecentMathSignaturesSnapshot().length > 0, 'esperava assinatura registrada antes do reset')
  resetSeenMathMemory()
  assert(getRecentMathSignaturesSnapshot().length === 0, 'resetSeenMathMemory não limpou a memória do motor')

  // 12. Acervo completo lazy inclui ENEM Lotes 1..5, ETEC e SENAI e respeita preferirOrigem
  limparCacheEnemLazy()
  const bancoCompleto = await carregarEnemLote1Lazy()
  assert(bancoCompleto.some((d) => d.origem === 'enem_oficial'), 'banco completo deve conter ENEM')
  assert(bancoCompleto.some((d) => d.origem === 'etec_oficial'), 'banco completo deve conter ETEC')
  assert(bancoCompleto.some((d) => d.origem === 'senai_oficial'), 'banco completo deve conter SENAI')
  assert(bancoCompleto.some((d) => d.id.startsWith('enem2024_q144') || d.referenciaOficial?.ano === 2024), 'banco completo deve conter ENEM Lote 5')

  const selEtec = await selecionarProximoDesafio({
    grau: 5,
    estadoEstudo: estadoEstudoVazio(),
    preferirOrigem: 'etec_oficial',
    seed: 123,
  })
  assert(selEtec.origem === 'etec_oficial', `esperava etec_oficial, veio ${selEtec.origem}`)

  const selSenai = await selecionarProximoDesafio({
    grau: 6,
    estadoEstudo: estadoEstudoVazio(),
    preferirOrigem: 'senai_oficial',
    seed: 456,
  })
  assert(selSenai.origem === 'senai_oficial', `esperava senai_oficial, veio ${selSenai.origem}`)

  // 13. Classificação de figuras separa enunciado, alternativas visuais e tabela duplicada
  const classificadasAlt = classificarFigurasParaApresentacao(
    [
      { src: '/a.png', alt: 'Gráfico', largura: 600, altura: 400, papel: 'enunciado', tipoVisual: 'grafico' },
      { src: '/t.png', alt: 'Tabela', largura: 500, altura: 300, papel: 'enunciado', tipoVisual: 'tabela' },
      { src: '/altA.png', alt: 'Alt A', largura: 200, altura: 150, papel: 'alternativa', letra: 'A' },
      { src: '/altB.png', alt: 'Alt B', largura: 200, altura: 150, papel: 'alternativa', letra: 'B' },
      { src: '/altC.png', alt: 'Alt C', largura: 200, altura: 150, papel: 'alternativa', letra: 'C' },
    ],
    { enunciadoTemTabela: true },
  )
  assert(classificadasAlt.enunciado.length === 1, `esperava 1 figura de enunciado (sem tabela duplicada), veio ${classificadasAlt.enunciado.length}`)
  assert(classificadasAlt.modoAlternativaVisual === true, 'esperava modoAlternativaVisual ativo com 3 letras')
  assert(classificadasAlt.alternativasPorLetra.B?.src === '/altB.png', 'faltou alternativa visual B')
}
