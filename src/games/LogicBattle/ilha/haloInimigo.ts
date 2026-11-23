/**
 * Halo de clique em volta das tropas INIMIGAS (pedido do usuário, 22/11: «sim, área maior só para inimigos»). O corpo de uma tropa mede ~0,4 m e, na câmera do Império (16 px por metro, medido),
 * ~7×20 px: em 346 cliques ao redor de uma tropa inimiga visível nem o botão esquerdo nem o direito a acertaram. O halo é uma malha invisível maior que o corpo, DENTRO do mesmo grupo: herda
 * `onClick`/`onPointerDown`/`onPointerUp`, então não existe caminho de ordem novo, só um alvo maior.
 */

/**
 * Raio do halo, em metros [D-minha]: maior que o corpo (~0,4 m) para ajudar de verdade (≈ 29 px de diâmetro na câmera do Império, contra ~7 px) e menor que o espaçamento da formação (1,2 m,
 * `tropaEspacoFormacao`) para o halo de um inimigo não cobrir o vizinho.
 */
export const RAIO_DO_HALO = 0.9

export interface EntradaDoHalo {
  lado: 'aliado' | 'inimigo'
  hp: number
  /** `inimigoVisivel` do jogo: a névoa esconde a tropa, e clicar nela não pode revelá-la nem atacá-la. */
  visivel: boolean
  /** Há tropa viva selecionada ou o herói escolhido (com corpo). Sem seleção o clique tem de continuar indo para o chão. */
  temSelecao: boolean
  /** Modo de blocos, linha de blocos ou consagrar: nesses modos o clique é de construção e o halo o roubaria. */
  modoDeBlocos: boolean
}

/** O halo existe só para tropa INIMIGA viva e visível, com seleção, fora do modo de blocos. `hp` inválido (NaN) não é «vivo». */
export function haloDoInimigo(entrada: EntradaDoHalo): boolean {
  return entrada.lado === 'inimigo' && entrada.hp > 0 && entrada.visivel && entrada.temSelecao && !entrada.modoDeBlocos
}
