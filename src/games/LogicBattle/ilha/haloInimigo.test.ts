import { haloDoInimigo, RAIO_DO_HALO, type EntradaDoHalo } from './haloInimigo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * Halo de clique em volta das tropas INIMIGAS (pedido do usuário, 22/11, AskUserQuestion: «sim, área maior só para inimigos»). O corpo de uma tropa mede ~0,4 m: na câmera do Império (16 px por metro,
 * medido) são ~7×20 px, e em 346 cliques ao redor de uma tropa inimiga visível nem o botão esquerdo nem o direito a acertaram. O halo é uma malha invisível maior que o corpo, DENTRO do mesmo grupo (herda
 * `onClick`/`onPointerDown`/`onPointerUp`: nenhum caminho de ordem novo).
 *
 * Regra (decisões [D-minha], registradas no ledger): o halo existe só se (1) a tropa é INIMIGA, (2) está viva, (3) é VISÍVEL para o jogo (`inimigoVisivel`: clicar numa tropa que a névoa esconde não pode
 * revelar nem atacar), (4) há SELEÇÃO (tropa ou herói escolhido com corpo: sem seleção o clique tem de continuar indo para o chão, que é o risco que o usuário aceitou ao escolher «só quando há seleção»)
 * e (5) o jogador NÃO está no modo de blocos/linha/consagrar (nesses modos o clique é de construção e o halo o roubaria).
 */
export function run(): void {
  const base: EntradaDoHalo = { lado: 'inimigo', hp: 12, visivel: true, temSelecao: true, modoDeBlocos: false }
  assert(haloDoInimigo(base) === true, 'halo: tropa inimiga viva, visível, com seleção e fora do modo de blocos TEM halo')

  // cada condição sozinha, a partir da base que dá `true`: tirar UMA tem de tirar o halo
  assert(haloDoInimigo({ ...base, lado: 'aliado' }) === false, 'halo: tropa ALIADA não ganha halo (o pedido é só para inimigos)')
  assert(haloDoInimigo({ ...base, hp: 0 }) === false, 'halo: tropa inimiga MORTA (hp 0) não ganha halo')
  assert(haloDoInimigo({ ...base, hp: -3 }) === false, 'halo: hp negativo não ganha halo')
  assert(haloDoInimigo({ ...base, hp: Number.NaN }) === false, 'halo: hp NaN não ganha halo (nunca clicar num estado sujo)')
  assert(haloDoInimigo({ ...base, hp: 0.5 }) === true, 'halo: hp fracionário positivo é vivo')
  assert(haloDoInimigo({ ...base, visivel: false }) === false, 'halo: tropa inimiga NÃO VISÍVEL (névoa) não ganha halo: o clique não pode revelá-la nem atacá-la')
  assert(haloDoInimigo({ ...base, temSelecao: false }) === false, 'halo: SEM seleção o halo não existe (o clique continua indo para o chão)')
  assert(haloDoInimigo({ ...base, modoDeBlocos: true }) === false, 'halo: no modo de blocos/linha/consagrar o halo não existe (o clique é de construção)')

  // combinações: nenhuma outra condição compensa a que falta
  for (const lado of ['aliado', 'inimigo'] as const) for (const hp of [0, 12]) for (const visivel of [true, false]) for (const temSelecao of [true, false]) for (const modoDeBlocos of [true, false]) {
    const esperado = lado === 'inimigo' && hp > 0 && visivel && temSelecao && !modoDeBlocos
    assert(haloDoInimigo({ lado, hp, visivel, temSelecao, modoDeBlocos }) === esperado, `halo: tabela completa falhou em ${JSON.stringify({ lado, hp, visivel, temSelecao, modoDeBlocos })} (esperado ${esperado})`)
  }

  // o raio: maior que o corpo (0,4 m) e menor que a distância entre dois soldados em formação (1,2 m: `tropaEspacoFormacao`), senão o halo de um inimigo cobre o vizinho
  assert(RAIO_DO_HALO > 0.4, `halo: o raio (${RAIO_DO_HALO}) tem de ser MAIOR que o corpo (~0,4 m) senão não ajuda`)
  assert(RAIO_DO_HALO < 1.2, `halo: o raio (${RAIO_DO_HALO}) tem de ser MENOR que o espaçamento da formação (1,2 m) senão o halo de um cobre o vizinho`)
  assert(RAIO_DO_HALO === 0.9, 'halo: o raio é 0,9 m (≈ 29 px de diâmetro na câmera do Império, contra ~7 px do corpo)')
}
