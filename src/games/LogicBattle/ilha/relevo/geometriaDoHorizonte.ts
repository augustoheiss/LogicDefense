/**
 * A GEOMETRIA DO HORIZONTE (F2, Task 8, 26/11/2026): um ANEL de passo largo em volta do quadrado atual, de 56 m (a borda) até 104 m do centro. PURA (sem `three`, testada no Node): a altura entra por parâmetro e o módulo não importa o
 * gerador (sem ciclo; testável com alturas sintéticas).
 *
 * POR QUE UM ANEL E NÃO OS 8 CAMPOS (medido, `.superpowers/agua/horizonte-em-anel.mjs`): o plano falava em «17 × 17 dos 8 vizinhos, ≤ 1.500 triângulos», mas 17 × 17 são 512 triângulos por vizinho, 4.096 nos 8 (quase 3× o teto),
 * e gerar os 8 campos custa ~650 ms de CPU. O fog apaga o mundo entre 82 e 102 m em 1ª/3ª pessoa (`fogFarCorpo`), então do vizinho só se vê uma faixa de ~45 m. A altura do mundo PURO (`alturaDeBaseDoMundo`) existe em QUALQUER ponto
 * (a função do ponto global, sem lagoa e sem rio) e custa 7 µs: o anel de 8 m (960 triângulos) leva ~5 ms para calcular as alturas, uma vez, e erra 0,29 m em média contra o campo real do vizinho (silhueta de longe).
 *
 * A EMENDA ENTRE OS VÉRTICES (medido, `.superpowers/agua/fechar-o-vao-do-horizonte-2.mjs`): o contrato do plano «|Δ| ≤ 1e-4» só vale NOS vértices; entre dois vértices do anel (8 m) o terreno ondula a cada 1 m e o anel é uma RETA (vão médio
 * 1–2,4 cm, até 27 cm). O vão é EXATAMENTE 0 quando o passo da primeira fileira do anel é igual ao da MALHA que o GPU desenha (1 m Ultra, 2 m Bonito, 4 m Leve) e volta a 5–15 cm nos outros casos: a primeira fileira usa `passoDaBorda`.
 *
 * COORDENADAS LOCAIS ao quadrado `(i, j)` (como o terreno): o vértice `(x, z)` é o ponto GLOBAL `(112·i + x, 112·j + z)`. `uv.x` é a distância à borda do quadrado normalizada (0 em 56 m do centro, 1 a 48 m dela): o shader
 * mistura a cor do horizonte por ela (perspectiva atmosférica). O buraco do quadrado (|x|, |z| < 56) NÃO tem triângulos: ali o chão é o do relevo, e o anel o TOCA na borda com a altura do mundo puro.
 */

/** O passo do anel (m): 960 triângulos. */
export const PASSO_DO_HORIZONTE = 8
/** Até onde vai o anel (m do centro do quadrado): o fog apaga o mundo entre 82 e 102 m (1ª/3ª pessoa); 104 é o `fogFarCorpo` máximo mais uma folga. */
export const RAIO_DO_HORIZONTE = 104
/** A meia largura do quadrado (m): o buraco do anel. */
export const MEIA_DO_QUADRADO = 56
/** A distância à borda (m) em que `uv.x` chega a 1. */
const DISTANCIA_DA_COR_TOTAL = 48
const LADO = 112

export interface GeometriaDoHorizonte {
  readonly posicoes: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint32Array
}

/**
 * O anel do horizonte do quadrado `quadrado`, com a altura `altura(X, Z)` do mundo PURO em coordenadas GLOBAIS. Os vértices são locais ao quadrado; só as células que NÃO estão inteiras dentro do quadrado entram.
 * `passoDaBorda` (8, 4, 2 ou 1 m) é o passo ao longo da borda do quadrado, na primeira fileira: o da malha do terreno em uso.
 */
export function geometriaDoHorizonte(
  altura: (X: number, Z: number) => number,
  quadrado: { readonly i: number; readonly j: number },
  passoDaBorda: 1 | 2 | 4 | 8 = PASSO_DO_HORIZONTE,
): GeometriaDoHorizonte {
  const { i, j } = quadrado
  const n = Math.round((2 * RAIO_DO_HORIZONTE) / PASSO_DO_HORIZONTE)
  const posicoes: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  // os vértices, deduplicados por POSIÇÃO (x, z): o mesmo ponto é sempre o mesmo vértice (a emenda interna fica exata)
  const indiceDe = new Map<string, number>()
  const vertice = (x: number, z: number): number => {
    const chave = `${x},${z}`
    const existente = indiceDe.get(chave)
    if (existente !== undefined) return existente
    const novo = posicoes.length / 3
    posicoes.push(x, altura(LADO * i + x, LADO * j + z), z)
    uvs.push(Math.min(1, Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - MEIA_DO_QUADRADO) / DISTANCIA_DA_COR_TOTAL)), 0)
    indiceDe.set(chave, novo)
    return novo
  }
  // a célula de 8 m: 2 triângulos voltados para cima, a MESMA diagonal do terreno (a→c→b e b→c→d)
  const celula = (x0: number, z0: number): void => {
    const p = PASSO_DO_HORIZONTE
    const v00 = vertice(x0, z0)
    const v10 = vertice(x0 + p, z0)
    const v01 = vertice(x0, z0 + p)
    const v11 = vertice(x0 + p, z0 + p)
    indices.push(v00, v01, v10, v10, v01, v11)
  }
  /**
   * Em qual lado a célula TOCA a borda do quadrado (a faixa de 8 m logo fora dele), ou `null` se não toca. As quatro CÉLULAS DE CANTO (que tocam a borda só num ponto) são tratadas como célula comum: a subdivisão é ao longo
   * da borda, e no canto não há borda comum.
   */
  const ladoDaBorda = (x0: number, z0: number): 'L' | 'O' | 'N' | 'S' | null => {
    const p = PASSO_DO_HORIZONTE
    const sobreEmX = x0 >= -MEIA_DO_QUADRADO && x0 + p <= MEIA_DO_QUADRADO // a célula está na faixa de x do quadrado
    const sobreEmZ = z0 >= -MEIA_DO_QUADRADO && z0 + p <= MEIA_DO_QUADRADO
    if (sobreEmZ && x0 === MEIA_DO_QUADRADO) return 'L'
    if (sobreEmZ && x0 + p === -MEIA_DO_QUADRADO) return 'O'
    if (sobreEmX && z0 + p === -MEIA_DO_QUADRADO) return 'N'
    if (sobreEmX && z0 === MEIA_DO_QUADRADO) return 'S'
    return null
  }
  /**
   * A célula de 8 m da PRIMEIRA fileira, subdividida ao longo da borda a cada `passoDaBorda` m SEM T-JUNÇÃO: a linha da borda tem os vértices finos; a linha de FORA (a 8 m da borda) só tem os 2 cantos da célula (os mesmos da
   * célula vizinha da segunda fileira). Cada faixa fina é um triângulo em leque ligando seus 2 vértices ao canto de fora MAIS PRÓXIMO do meio da faixa; um triângulo de canto a canto fecha o trapézio no meio.
   */
  const celulaDaBorda = (x0: number, z0: number, lado: 'L' | 'O' | 'N' | 'S'): void => {
    const p = PASSO_DO_HORIZONTE
    const m = p / passoDaBorda
    // `u` anda AO LONGO da borda (z em L/O, x em N/S); `ponto(u, fundo)`: fundo 0 = sobre a borda, 1 = a 8 m dela
    const ponto = (u: number, fundo: 0 | 1): [number, number] => {
      if (lado === 'L') return [MEIA_DO_QUADRADO + fundo * p, u]
      if (lado === 'O') return [-MEIA_DO_QUADRADO - fundo * p, u]
      if (lado === 'N') return [u, -MEIA_DO_QUADRADO - fundo * p]
      return [u, MEIA_DO_QUADRADO + fundo * p]
    }
    const u0 = lado === 'L' || lado === 'O' ? z0 : x0
    const cantoA = vertice(...ponto(u0, 1))
    const cantoB = vertice(...ponto(u0 + p, 1))
    const triangulo = (a: number, b: number, c: number): void => {
      // o sentido do giro depende do LADO da borda (medido: sem esta correção saem para baixo 84/140/252 triângulos nos lados oeste e sul): o produto vetorial decide e troca a ordem se o triângulo sair para baixo
      const ay = posicoes[a * 3]
      const az = posicoes[a * 3 + 2]
      const ny = (posicoes[b * 3 + 2] - az) * (posicoes[c * 3] - ay) - (posicoes[b * 3] - ay) * (posicoes[c * 3 + 2] - az)
      if (ny > 0) indices.push(a, b, c)
      else indices.push(a, c, b)
    }
    for (let f = 0; f < m; f += 1) {
      const va = vertice(...ponto(u0 + f * passoDaBorda, 0))
      const vb = vertice(...ponto(u0 + (f + 1) * passoDaBorda, 0))
      // o canto de fora mais próximo do meio da faixa fina
      const meio = u0 + (f + 0.5) * passoDaBorda
      triangulo(va, vb, meio < u0 + p / 2 ? cantoA : cantoB)
    }
    // o trapézio se fecha no meio: um triângulo ligando o último vértice fino que ficou do lado de A, o primeiro do lado de B e os dois cantos
    const vMeio0 = vertice(...ponto(u0 + (m / 2) * passoDaBorda, 0))
    triangulo(vMeio0, cantoB, cantoA)
  }
  for (let a = 0; a < n; a += 1) {
    for (let b = 0; b < n; b += 1) {
      const x0 = -RAIO_DO_HORIZONTE + a * PASSO_DO_HORIZONTE
      const z0 = -RAIO_DO_HORIZONTE + b * PASSO_DO_HORIZONTE
      // a célula inteira DENTRO do quadrado é o buraco: o chão dali é o do relevo
      if (x0 >= -MEIA_DO_QUADRADO && x0 + PASSO_DO_HORIZONTE <= MEIA_DO_QUADRADO && z0 >= -MEIA_DO_QUADRADO && z0 + PASSO_DO_HORIZONTE <= MEIA_DO_QUADRADO) continue
      const lado = ladoDaBorda(x0, z0)
      if (lado !== null && passoDaBorda < PASSO_DO_HORIZONTE) celulaDaBorda(x0, z0, lado)
      else celula(x0, z0)
    }
  }
  return { posicoes: new Float32Array(posicoes), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) }
}
