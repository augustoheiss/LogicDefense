/**
 * Dificuldade por DISTÂNCIA (pedido do usuário, 20/11 e 22/11): «se for mais longe, fica mais difícil»; na 2ª camada a vida dobra e a QUANTIDADE não.
 * A curva é decisão do usuário (22/11): DOBRA a cada camada, 1×, 2×, 4×, 8×… Função pura de `(i, j)`: o mesmo mapa nasce igual de qualquer lado.
 */

/**
 * Teto técnico [D-minha]: 6 dobros. A vida da leva comum é 14–60, e ×64 já é intransponível para um herói com dezenas de vida; passar daí só estoura números
 * sem informação nova ao jogador. Vale da camada 7 em diante.
 */
export const FATOR_MAXIMO_DA_CAMADA = 64

/** Camada = distância de Chebyshev ao mapa inicial (0,0): `max(|i|, |j|)`. Os 8 vizinhos de (0,0) são a camada 1. */
export function camadaDoMapa(i: number, j: number): number {
  return Math.max(Math.abs(i), Math.abs(j))
}

/**
 * 1× nas camadas 0 e 1 (a cópia da camada 1 é igual à origem); da camada 2 em diante `2^(camada−1)` até o teto. Entrada suja (negativa, NaN) vale 1×: a vida do
 * inimigo não pode zerar nem virar NaN por um número sujo. Camada fracionária arredonda para baixo; infinita vale o teto.
 */
export function fatorDaCamada(camada: number): number {
  if (camada === Number.POSITIVE_INFINITY) return FATOR_MAXIMO_DA_CAMADA
  if (!Number.isFinite(camada) || camada < 2) return 1
  return Math.min(FATOR_MAXIMO_DA_CAMADA, 2 ** (Math.floor(camada) - 1))
}
