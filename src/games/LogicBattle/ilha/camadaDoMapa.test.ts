import { camadaDoMapa, fatorDaCamada, FATOR_MAXIMO_DA_CAMADA } from './camadaDoMapa'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * Dificuldade por DISTÂNCIA (pedido do usuário, 20/11 e 22/11): «se for mais longe, fica mais difícil»; na 2ª camada a vida dobra e a QUANTIDADE não.
 * Decisão do usuário (22/11, AskUserQuestion): a curva DOBRA a cada camada: 1×, 2×, 4×, 8×…
 *
 * Decisões [D-minha], registradas no plano:
 *  - a camada é a distância de CHEBYSHEV ao mapa inicial (0,0): `max(|i|, |j|)`. O atlas é uma grade quadrada, e assim os 8 vizinhos de (0,0) são todos a camada 1,
 *    como o usuário espera de «o quadrado em volta». A camada NÃO depende do caminho percorrido: o mesmo mapa nasce igual de qualquer lado (reprodutível e testável);
 *  - o mapa inicial (camada 0) e os vizinhos diretos (camada 1) valem 1×: a CÓPIA da camada 1 é igual à base de origem;
 *  - a partir da camada 2 o fator é 2^(camada−1), com TETO em 64× (a camada 7 em diante): a vida da leva comum é 14–60, e ×64 já é intransponível para um herói com
 *    dezenas de vida; passar daí só estoura números sem informação nova.
 */
export function run(): void {
  // ── camadaDoMapa: Chebyshev ao (0,0) ──────────────────────────────────────────────
  assert(camadaDoMapa(0, 0) === 0, 'o mapa inicial é a camada 0')
  for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
    assert(camadaDoMapa(i, j) === 1, `os 8 vizinhos de (0,0) são a camada 1 (falhou em ${i},${j})`)
  }
  assert(camadaDoMapa(2, 0) === 2 && camadaDoMapa(0, -2) === 2, 'dois quadrados reto = camada 2')
  assert(camadaDoMapa(2, 1) === 2 && camadaDoMapa(-1, 2) === 2 && camadaDoMapa(2, 2) === 2, 'o anel quadrado da camada 2 inclui as pontas (Chebyshev, não Manhattan)')
  assert(camadaDoMapa(3, -2) === 3 && camadaDoMapa(-3, 3) === 3, 'camada 3')
  assert(camadaDoMapa(5, 0) === camadaDoMapa(0, 5) && camadaDoMapa(5, 0) === camadaDoMapa(-5, 0), 'a camada é simétrica: nenhuma direção é mais difícil que outra')
  assert(camadaDoMapa(4, 2) === camadaDoMapa(2, 4), 'trocar i e j não muda a camada')
  assert(camadaDoMapa(-0, 0) === 0, 'o zero negativo é o mapa inicial')

  // ── fatorDaCamada: 1×, 1×, 2×, 4×, 8×… com teto ──────────────────────────────────
  assert(fatorDaCamada(0) === 1, 'camada 0: 1×')
  assert(fatorDaCamada(1) === 1, 'camada 1: 1× (a cópia da camada 1 é igual à origem)')
  assert(fatorDaCamada(2) === 2, 'camada 2: 2× (decisão do usuário: «na 2ª camada dobra»)')
  assert(fatorDaCamada(3) === 4, 'camada 3: 4×')
  assert(fatorDaCamada(4) === 8, 'camada 4: 8×')
  assert(fatorDaCamada(5) === 16, 'camada 5: 16×')
  assert(fatorDaCamada(6) === 32, 'camada 6: 32×')
  for (let c = 2; c <= 7; c += 1) assert(fatorDaCamada(c) === 2 * fatorDaCamada(c - 1), `cada camada DOBRA a anterior (falhou na camada ${c})`)
  assert(FATOR_MAXIMO_DA_CAMADA === 64, 'o teto técnico é 64× (6 dobros)')
  assert(fatorDaCamada(7) === 64, 'camada 7: 64× (o teto)')
  assert(fatorDaCamada(8) === 64 && fatorDaCamada(50) === 64 && fatorDaCamada(10_000) === 64, 'além do teto continua em 64× (não estoura números)')
  assert(fatorDaCamada(1000) <= FATOR_MAXIMO_DA_CAMADA, 'nunca passa do teto')

  // entrada suja NUNCA devolve fator fora de [1, teto] nem NaN: a vida do inimigo não pode zerar, estourar nem virar NaN por um número sujo
  for (const sujo of [-1, -50, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5, 2.9]) {
    const f = fatorDaCamada(sujo)
    assert(Number.isFinite(f) && f >= 1 && f <= FATOR_MAXIMO_DA_CAMADA, `fatorDaCamada(${sujo}) = ${f}: deve ficar em [1, ${FATOR_MAXIMO_DA_CAMADA}]`)
  }
  assert(fatorDaCamada(-3) === 1 && fatorDaCamada(Number.NaN) === 1, 'camada negativa ou NaN vale 1× (não zera nem infla a vida)')
  assert(fatorDaCamada(Number.POSITIVE_INFINITY) === FATOR_MAXIMO_DA_CAMADA, 'camada infinita vale o teto (e não NaN)')
  assert(fatorDaCamada(2.9) === 2, 'camada fracionária arredonda para baixo (camada 2)')

  // a regra inteira do mapa: coordenada → fator, e a simetria que o usuário pediu («mais longe, mais difícil», de qualquer lado)
  const fatorEm = (i: number, j: number) => fatorDaCamada(camadaDoMapa(i, j))
  assert(fatorEm(0, 0) === 1 && fatorEm(1, 0) === 1 && fatorEm(-1, 1) === 1, 'o mapa inicial e os 8 vizinhos valem 1×')
  assert(fatorEm(2, 0) === 2 && fatorEm(0, -2) === 2 && fatorEm(2, 2) === 2, 'a 2ª camada dobra')
  assert(fatorEm(3, 1) === 4 && fatorEm(-3, -3) === 4, 'a 3ª camada quadruplica')
  assert(fatorEm(9, 0) === 64 && fatorEm(0, -40) === 64, 'longe o fator trava no teto')
}
