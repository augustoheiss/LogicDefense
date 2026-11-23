import { DIMENSOES_OBRA, type Papel } from '../partidaPolicies'
import { calcularCurvaConstrucao, classificarSuporteObra, posicoesEstacasPier } from './suporteFundacao'
import { perfilVisualDaUnidade } from './perfilUnidadeVisual'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export function run(): void {
  // 1. Classificação de fundação em terra vs sobre lagoa rasa
  const lagoas = [{ x: 14, z: 12, rx: 3.5, rz: 3.0 }]
  assert(
    classificarSuporteObra(lagoas, -10, -10, DIMENSOES_OBRA.torre) === 'terra',
    'obra distante da lagoa usa fundação em terra',
  )
  assert(
    classificarSuporteObra(lagoas, 14, 12, DIMENSOES_OBRA.torre) === 'agua',
    'obra no centro da lagoa usa fundação sobre água',
  )
  assert(
    classificarSuporteObra(lagoas, 11.4, 12, DIMENSOES_OBRA.nucleo) === 'agua',
    'obra cuja pegada cruza majoritariamente a lagoa usa fundação sobre água',
  )
  assert(
    classificarSuporteObra([], 14, 12, DIMENSOES_OBRA.nucleo) === 'terra',
    'mapa sem lagoas sempre usa fundação em terra',
  )

  // 2. Curva determinística da animação de construção no chão
  const inicio = calcularCurvaConstrucao(0, 0)
  const meio = calcularCurvaConstrucao(0.45, 0.25)
  const fim = calcularCurvaConstrucao(1, 0.6)
  assert(
    Math.abs(inicio.escalaAlicerceY - 0.3) < 1e-6 &&
      Math.abs(meio.escalaAlicerceY - 1) < 1e-6 &&
      Math.abs(fim.escalaAlicerceY - 1) < 1e-6,
    'alicerce sobe até 100% nos primeiros 45% da obra',
  )
  assert(
    inicio.pulsoOndaA < 1 && meio.opacidadeOndaA > 0 && fim.opacidadeOndaB >= 0,
    'ondas no chão respeitam faixa positiva de pulso e opacidade',
  )

  // 3. Posições das estacas de píer (compacta vs larga)
  const estacasTorre = posicoesEstacasPier(DIMENSOES_OBRA.torre)
  const estacasNucleo = posicoesEstacasPier(DIMENSOES_OBRA.nucleo)
  assert(estacasTorre.length === 4, `torre compacta usa 4 estacas (veio ${estacasTorre.length})`)
  assert(estacasNucleo.length === 8, `núcleo largo usa 8 estacas (veio ${estacasNucleo.length})`)

  // 4. Perfis visuais distintos entre aliados e classes inimigas
  const aliado = perfilVisualDaUnidade('aliado', 'tropa', false)
  const aliadoSel = perfilVisualDaUnidade('aliado', 'tropa', true)
  const horda = perfilVisualDaUnidade('inimigo', 'horda', false)
  const sitiante = perfilVisualDaUnidade('inimigo', 'sitiante', false)
  const dragao = perfilVisualDaUnidade('inimigo', 'dragao', false)
  const isca = perfilVisualDaUnidade('inimigo', 'isca', false)

  const arquetipos = new Set<string>([
    aliado.arquetipo,
    horda.arquetipo,
    sitiante.arquetipo,
    dragao.arquetipo,
    isca.arquetipo,
  ])
  assert(arquetipos.size === 5, 'cada papel relevante tem arquétipo visual próprio')
  assert(aliado.corDetalhes !== aliadoSel.corDetalhes, 'tropa aliada selecionada destaca penacho')
  assert(sitiante.escala[0] > horda.escala[0], 'sitiante tem porte claramente maior que horda')
  assert(
    horda.intensidadeOlhos > 0 && sitiante.intensidadeOlhos > 0 && dragao.intensidadeOlhos > 0,
    'inimigos possuem visor/olhos incandescentes distintos de aliados',
  )

  const papeis: readonly Papel[] = ['tropa', 'horda', 'sitiante', 'dragao', 'isca']
  for (const papel of papeis) {
    const p = perfilVisualDaUnidade('inimigo', papel, false)
    assert(p.metalness >= 0 && p.roughness > 0, `material PBR válido para papel ${papel}`)
  }
}
