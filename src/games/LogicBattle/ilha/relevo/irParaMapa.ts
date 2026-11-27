import { colocarHeroi, LADO_MAPA, type Atlas, voltarAoCorpo } from '../atlas'

/**
 * O GANCHO DE DEV `irParaMapa` (F2, 25/11/2026, pedido do usuário: «Gancho de DEV irPara»). Leva o HERÓI a `(x, z)` do quadrado `(i, j)` e a CENA junto, para fotografar o herói, a tropa e a câmera num
 * quadrado de relevo FORTE sem andar minutos pelo jogo. É código de DESENVOLVIMENTO: só o `__ILHA_BENCH__` (`import.meta.env.DEV`) o chama. NÃO muda regra nem simulação nem o jogo publicado.
 *
 * Só COMPÕE funções já testadas de `atlas.ts` (`voltarAoCorpo`, `colocarHeroi`; `atlas.ts` fica intocado, com os 30+ testes que usam `colocarHeroi`): `colocarHeroi(x, z)` põe o herói em `(x, z)` RELATIVO ao quadrado
 * onde o corpo está e deixa o `stepAtlas` cruzar as fronteiras (`transferir`, que anda vários quadrados por chamada). Aqui a posição relativa é `(i − heroiI) · 112 + x`. A cena só acompanha o corpo se estiver nele
 * ANTES, por isso `voltarAoCorpo` vem primeiro. Pura: devolve um atlas novo. Entrada que não é inteira/finita devolve o MESMO atlas (nada se move, nenhum NaN no estado).
 */
export function irParaMapa(atlas: Atlas, i: number, j: number, x: number, z: number): Atlas {
  if (!Number.isInteger(i) || !Number.isInteger(j) || !Number.isFinite(x) || !Number.isFinite(z)) return atlas
  const noCorpo = voltarAoCorpo(atlas)
  return colocarHeroi(noCorpo, (i - noCorpo.heroiI) * LADO_MAPA + x, (j - noCorpo.heroiJ) * LADO_MAPA + z)
}
