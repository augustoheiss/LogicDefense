import { DIMENSOES_OBRA, type Papel } from '../partidaPolicies'
import { createPartida } from '../partidaSim'
import {
  alturaSapataMuralha,
  alturaVisualRecurso,
  calcularCurvaConstrucao,
  classificarSuporteObra,
  configVisualNuvem,
  paisagemNaturalVisivel,
  pegadaEfetivaFundacao,
  posicoesEstacasPier,
  Y_SOLO_VISUAL,
} from './suporteFundacao'
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

  // 5. Pegada efetiva Nível 5 (fortaleza 5,95 × 5,95 m) e blocosLivres
  const pegadaNv1 = pegadaEfetivaFundacao({
    tipo: 'torre',
    x: 10,
    z: 12,
    hp: 40,
    construindoRestante: 0,
  })
  assert(
    pegadaNv1.dim[0] === DIMENSOES_OBRA.torre[0] && pegadaNv1.cx === 10 && pegadaNv1.cz === 12,
    'obra Nível 1–4 preserva DIMENSOES_OBRA',
  )

  const pegadaNv5 = pegadaEfetivaFundacao({
    tipo: 'torre',
    x: 10,
    z: 12,
    hp: 100,
    construindoRestante: 0,
    blocosNv5: new Uint8Array(7 * 5 * 7),
  })
  assert(
    pegadaNv5.dim[0] > 5.9 && pegadaNv5.dim[2] > 5.9,
    `obra Nível 5 expande pegada da fundação para 5,95×5,95m (veio ${pegadaNv5.dim[0]}×${pegadaNv5.dim[2]})`,
  )

  const estacasNv5 = posicoesEstacasPier(pegadaNv5.dim)
  assert(estacasNv5.length === 12, `píer Nível 5 usa 12 estacas de reforço (veio ${estacasNv5.length})`)

  const pegadaLivres = pegadaEfetivaFundacao({
    tipo: 'portao',
    x: 0,
    z: 0,
    hp: 50,
    blocosLivres: [
      { x: 4, z: 6, hp: 20 },
      { x: 6, z: 8, hp: 20 },
      { x: 99, z: 99, hp: 0 },
    ],
  })
  assert(
    pegadaLivres.cx === 5 && pegadaLivres.cz === 7 && pegadaLivres.dim[0] === 3 && pegadaLivres.dim[2] === 3,
    'blocosLivres calcula bounding box ignorando blocos destruídos',
  )

  // 6. Recursos naturais e sapatas de muralha encostam em Y_SOLO_VISUAL (-0.45)
  assert(alturaVisualRecurso(0) === Y_SOLO_VISUAL, 'árvore/ouro na superfície ancora em Y_SOLO_VISUAL')
  assert(alturaVisualRecurso(-3.2) === -3.2, 'veio de ouro no subsolo mantém yBase = -3.2')
  const sapata = alturaSapataMuralha()
  assert(
    sapata.centroY - sapata.altura / 2 <= Y_SOLO_VISUAL + 0.001 && sapata.centroY + sapata.altura / 2 >= 0,
    'sapata da muralha crava no chão (-0.45) e alcança o bloco térreo (y = 0)',
  )

  // 7. Névoa cartográfica translúcida e paisagem natural ao observar outro minimapa (`semCorpo: true`)
  const nuvemObs = configVisualNuvem('imperio', true)
  const nuvemCorpo = configVisualNuvem('imperio', false)
  assert(
    nuvemObs.opacidade < 0.5 && nuvemObs.depthWrite === false && nuvemObs.altura <= 0.4,
    'ao observar outro minimapa, névoa vira véu translúcido rente ao chão',
  )
  assert(
    nuvemCorpo.opacidade > 0.9 && nuvemCorpo.depthWrite === true && nuvemCorpo.altura === 4,
    'no mapa do herói, névoa densa padrão em Império é preservada',
  )

  const semCorpo = createPartida(1, 0, true)
  assert(
    paisagemNaturalVisivel(semCorpo, 35, 35) === true,
    'ao observar outro minimapa (`semCorpo: true`), bioma/árvores/lagos ficam visíveis sob o véu',
  )
  const comCorpo = createPartida(0, 0, false)
  assert(
    paisagemNaturalVisivel(comCorpo, 45, 45) === false,
    'no mapa do herói (`semCorpo: false`), área não explorada permanece oculta',
  )
}
