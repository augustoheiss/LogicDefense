import { protegerCifraoMoeda } from './contratosEstudo'
import { validarDesafioZeroSpoiler } from './validadorDicas'
import { ENEM_MATEMATICA_LOTE1 } from './bancos/enemMatematicaLote1'
import {
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
}
