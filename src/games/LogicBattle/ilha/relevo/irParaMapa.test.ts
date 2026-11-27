import { abrirMapa, criarAtlas, estadoCorpo, estadoCena, fichaEm, LADO_MAPA, MEIO_MAPA, type Atlas } from '../atlas'
import { irParaMapa } from './irParaMapa'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * O GANCHO DE DEV `irParaMapa` (F2, 25/11/2026, pedido do usuário «Gancho de DEV irPara»): leva o HERÓI a `(x, z)` do quadrado `(i, j)` e a CENA junto, para fotografar o herói, a tropa e a câmera num quadrado de
 * relevo FORTE sem andar minutos. É código de DESENVOLVIMENTO (`import.meta.env.DEV`, no `__ILHA_BENCH__`): NÃO muda regra nem simulação nem o jogo publicado. Esta função só COMPÕE funções já testadas de `atlas.ts`
 * (`colocarHeroi`, `voltarAoCorpo`), sem tocar nele (são arquivos de regra, com 30+ testes, fora do escopo do relevo).
 *
 * O que ela promete: (1) o corpo do herói termina no quadrado pedido, na posição pedida; (2) a CENA fica no corpo (senão o jogador veria o herói no quadrado errado); (3) é PURA: devolve um atlas novo e não muda o
 * que recebeu; (4) entrada que não é número finito não move ninguém (sem NaN no estado); (5) o herói não perde a base de origem nem a vida.
 */
export function run(): void {
  const origem = criarAtlas()
  assert(origem.heroiI === 0 && origem.heroiJ === 0 && origem.cenaI === 0 && origem.cenaJ === 0, 'o atlas inicial tem o herói e a cena em (0, 0)')

  // ── (1) o corpo vai ao quadrado e à posição pedidos, e a cena o acompanha ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 2], [-1, -3], [3, 0], [-2, 2]] as const) {
    const a = irParaMapa(origem, i, j, 7.5, -12.25)
    assert(a.heroiI === i && a.heroiJ === j, `o herói termina no quadrado (${i}, ${j}) (veio ${a.heroiI}, ${a.heroiJ})`)
    assert(a.cenaI === i && a.cenaJ === j, `a CENA acompanha o corpo em (${i}, ${j}) (veio ${a.cenaI}, ${a.cenaJ})`)
    const corpo = estadoCorpo(a)
    assert(Math.abs(corpo.heroi.x - 7.5) < 1e-6 && Math.abs(corpo.heroi.z - -12.25) < 1e-6, `e na posição pedida (7,5; −12,25): veio (${corpo.heroi.x}, ${corpo.heroi.z})`)
    assert(corpo.semCorpo === false, `o corpo está VIVO no quadrado (${i}, ${j}) (semCorpo false)`)
    assert(estadoCena(a) === corpo, `a cena É o estado do corpo (o jogador vê o herói onde ele está)`)
  }

  // ── (2) a posição pedida nas BORDAS do quadrado (±55,9, o limite antes de cruzar) não derruba o herói para o vizinho ───────────────────────────────────────────────────────────────────────────────────────
  {
    const a = irParaMapa(origem, 1, 2, MEIO_MAPA - 0.1, -(MEIO_MAPA - 0.1))
    assert(a.heroiI === 1 && a.heroiJ === 2, 'em (55,9; −55,9) o herói FICA no quadrado pedido (o limite é 56, estrito)')
    const b = irParaMapa(origem, 1, 2, 0, 0)
    assert(estadoCorpo(b).heroi.x === 0 && estadoCorpo(b).heroi.z === 0, 'em (0, 0) fica exatamente em (0, 0)')
  }

  // ── (3) é PURA: o atlas de entrada não muda (a função devolve outro) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const antes = JSON.stringify([origem.heroiI, origem.heroiJ, origem.cenaI, origem.cenaJ, origem.fichas.length, estadoCorpo(origem).heroi.x, estadoCorpo(origem).heroi.z])
    const a = irParaMapa(origem, 2, 1, 3, 4)
    const depois = JSON.stringify([origem.heroiI, origem.heroiJ, origem.cenaI, origem.cenaJ, origem.fichas.length, estadoCorpo(origem).heroi.x, estadoCorpo(origem).heroi.z])
    assert(antes === depois, 'o atlas de ENTRADA não muda (pureza)')
    assert(a !== origem, 'devolve um atlas NOVO (não o mesmo objeto)')
  }

  // ── (4) entrada não finita NÃO move ninguém e NÃO põe NaN no estado ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const [i, j, x, z] of [[Number.NaN, 0, 0, 0], [0, Number.POSITIVE_INFINITY, 0, 0], [1, 1, Number.NaN, 0], [1, 1, 0, Number.NEGATIVE_INFINITY], [1.5, 0, 0, 0]] as const) {
    const a = irParaMapa(origem, i, j, x, z)
    assert(a === origem, `entrada inválida (${i}, ${j}, ${x}, ${z}) devolve o MESMO atlas (nada se move)`)
    assert(Number.isFinite(estadoCorpo(a).heroi.x) && Number.isFinite(estadoCorpo(a).heroi.z), 'e o herói continua com posição finita')
  }

  // ── (5) o herói NÃO perde a vida nem a base ao viajar; a ficha de origem fica sem corpo e COM as obras ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const a = irParaMapa(origem, 1, 2, 5, 5)
    const antiga = fichaEm(a, 0, 0)
    assert(antiga !== undefined, 'a ficha do quadrado (0, 0) continua existindo')
    assert(antiga!.state.obras.length === fichaEm(origem, 0, 0)!.state.obras.length, 'e mantém as MESMAS obras (viajar não destrói a base)')
    assert(antiga!.state.semCorpo === true, 'o quadrado antigo fica SEM corpo (o herói saiu de lá)')
    assert(estadoCorpo(a).heroi.army === estadoCorpo(origem).heroi.army && estadoCorpo(a).heroi.army > 0, 'o herói chega com o mesmo exército (e vivo)')
  }

  // ── (6) viajar duas vezes em sequência: o herói vai de um forte a outro, e a posição é a do ÚLTIMO pedido ───────────────────────────────────────────────────────────────────────────────────────────────
  {
    const a = irParaMapa(irParaMapa(origem, 1, 2, 5, 5), -1, -3, -8, 9)
    assert(a.heroiI === -1 && a.heroiJ === -3 && a.cenaI === -1 && a.cenaJ === -3, 'duas viagens: termina em (−1, −3)')
    assert(Math.abs(estadoCorpo(a).heroi.x - -8) < 1e-6 && Math.abs(estadoCorpo(a).heroi.z - 9) < 1e-6, 'e na posição do último pedido')
  }

  // ── (6b) A CENA ESTAVA EM OUTRO QUADRADO (o jogador olhava o minimapa de (2, 1) com o corpo em (0, 0)): a viagem leva a cena junto, senão o jogador veria o quadrado antigo e o herói «sumiria» (o mutante G1, que
  //      tira `voltarAoCorpo`, SOBREVIVEU na 1ª rodada: nenhum caso tinha a cena fora do corpo antes de viajar). `stepAtlas` só move a cena junto do corpo SE ela já estava nele.
  {
    const olhandoOutro = abrirMapa(origem, 2, 1)
    assert(olhandoOutro.cenaI === 2 && olhandoOutro.cenaJ === 1 && olhandoOutro.heroiI === 0 && olhandoOutro.heroiJ === 0, 'montagem do caso: a CENA está em (2, 1) e o CORPO em (0, 0)')
    const a = irParaMapa(olhandoOutro, 1, 2, 5, 5)
    assert(a.heroiI === 1 && a.heroiJ === 2, 'com a cena fora do corpo, o herói ainda vai a (1, 2)')
    assert(a.cenaI === 1 && a.cenaJ === 2, `e a CENA vai junto para (1, 2), não fica em (2, 1) (veio ${a.cenaI}, ${a.cenaJ})`)
    assert(estadoCena(a) === estadoCorpo(a), 'a cena É o corpo: o jogador vê o herói onde ele está')
  }

  // ── (7) voltar ao ponto de partida funciona (ida e volta) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const a = irParaMapa(irParaMapa(origem, 2, 2, 1, 1), 0, 0, 2, 3)
    assert(a.heroiI === 0 && a.heroiJ === 0 && a.cenaI === 0 && a.cenaJ === 0, 'ida e volta: de novo em (0, 0)')
    assert(Math.abs(estadoCorpo(a).heroi.x - 2) < 1e-6 && Math.abs(estadoCorpo(a).heroi.z - 3) < 1e-6, 'na posição pedida')
  }
  void LADO_MAPA
  void ({} as Atlas)
}
