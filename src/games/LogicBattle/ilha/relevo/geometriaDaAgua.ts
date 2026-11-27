import type { Rio } from './aguaDoMundo'

/**
 * A GEOMETRIA DA FITA D'ÁGUA (F2, 26/11/2026, Task 4): a malha da água de UM rio dentro de UM quadrado. PURA (sem `three`, testada no Node em `geometriaDaAgua.test.ts`): devolve `posicoes`, `uvs` e `indices`
 * prontos para um `BufferGeometry`.
 *
 * A LARGURA vem do gerador real, não do corte do `nivel`: a água VISÍVEL (onde o nível d'água está acima do chão escavado) tem meia-largura 2,70 m (mediana de 154 cortes; largura 5,4 m), enquanto o `nivel`
 * existe até 6,5 m do rio. Uma fita de 13 m seria 2,5× a água real. A PONTA da vala termina arredondada: a água para ~3 m depois do último ponto (2,7 m a 0, 2,5 m a 1, 1,8 m a 2, 0 m a 3: medido); a fita
 * fecha com um LEQUE de meio disco de raio 2,7 m (não com a bacia de 6 × 5 m que o plano previa: o protótipo medido nunca a teve).
 *
 * COMO É FEITA: uma ESTAÇÃO a cada `passo` metros ao longo da poligonal (a primeira e a última sempre entram), cada uma com DOIS vértices (esquerda e direita da normal) em PARES consecutivos, e uma tira
 * de quadriláteros entre estações vizinhas. `uv.x` é TRANSVERSAL (0 na margem esquerda, 1 na direita, 0,5 no eixo) e `uv.y` é a DISTÂNCIA AO LONGO DO RIO em METROS GLOBAIS (contada do começo do rio,
 * não do quadrado): contínua nas emendas, então a fase das ondas fecha entre quadrados. A fita é CORTADA na aresta do quadrado (±56 m): a estação exata na aresta entra nos DOIS quadrados com a mesma
 * posição e o mesmo `uv.y`, e a parte que cai no vizinho é desenhada por ele. As coordenadas são LOCAIS ao quadrado (x, z) e `y` é o NÍVEL d'água do ponto do rio NA ESCALA DO CAMPO: nada somado (o `<mesh>`
 * fica em `Y_SOLO_VISUAL`, como o terreno: somar `Y_AGUA_VISUAL` subiria a água 7,5 cm acima da valeta que o gerador escavou).
 */

/** A largura da fita (m): o dobro da meia-largura da água visível medida no gerador real (2,70 m). */
export const LARGURA_DA_FITA = 5.4
/** Uma estação a cada 4 m: com ele a flecha máxima dos 13 rios fica ≤ 0,06 m (medido). */
export const PASSO_DA_FITA = 4

const LADO = 112
const MEIA = 56
/** Prende uma coordenada LOCAL ao quadrado (±56). O par de vértices é perpendicular ao rio, então numa travessia OBLÍQUA um deles cai até 2,4 cm fora (medido: 25 de 1.160 vértices, nenhum acima de 10 cm); prendê-lo FECHA o contrato «todo vértice dentro do quadrado» e faz as duas metades se encontrarem EXATAMENTE na aresta. */
const preso = (v: number): number => (v < -MEIA ? -MEIA : v > MEIA ? MEIA : v)
/** Quantas fatias do meio disco da ponta. */
const FATIAS_DO_LEQUE = 8

export interface GeometriaDaFita {
  readonly posicoes: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint32Array
}

interface Estacao {
  /** O eixo (global), o nível d'água e a distância acumulada desde o começo do rio (m globais). */
  readonly X: number
  readonly Z: number
  readonly nivel: number
  readonly s: number
  /** A tangente unitária (global). */
  readonly tx: number
  readonly tz: number
}

/**
 * A fita do `rio` dentro do quadrado `quadrado`, com uma estação a cada `passo` metros. Vazia se o rio não toca o quadrado.
 */
export function geometriaDaFita(rio: Rio, quadrado: { readonly i: number; readonly j: number }, passo: number): GeometriaDaFita {
  const { i, j } = quadrado
  const n = rio.pontos.length
  // Uma poligonal com MENOS DE 2 pontos não tem segmento: `estacaoEm` leria `rio.pontos[1]` e a função LANÇARIA (medido: `Cannot read properties of undefined`), e um erro dentro de um `useMemo` derruba a cena. O módulo da
  // água nunca produz um rio assim (os 13 têm 145–369 pontos); é a guarda do LIMITE do módulo: geometria VAZIA, e o componente já não monta nada com `index.count === 0`.
  if (n < 2) return { posicoes: new Float32Array(0), uvs: new Float32Array(0), indices: new Uint32Array(0) }
  const acumulada = new Float64Array(n)
  for (let k = 1; k < n; k += 1) acumulada[k] = acumulada[k - 1] + Math.hypot(rio.pontos[k].X - rio.pontos[k - 1].X, rio.pontos[k].Z - rio.pontos[k - 1].Z)
  const total = acumulada[n - 1]

  // a estação à distância `s` do começo: interpolada sobre a poligonal (a tangente e o nível também)
  let cursor = 0
  const estacaoEm = (s: number): Estacao => {
    while (cursor > 0 && acumulada[cursor] > s) cursor -= 1
    while (cursor < n - 2 && acumulada[cursor + 1] < s) cursor += 1
    const a = rio.pontos[cursor]
    const b = rio.pontos[cursor + 1]
    const L = acumulada[cursor + 1] - acumulada[cursor] || 1
    const t = Math.min(1, Math.max(0, (s - acumulada[cursor]) / L))
    const dx = b.X - a.X
    const dz = b.Z - a.Z
    const m = Math.hypot(dx, dz) || 1
    return { X: a.X + dx * t, Z: a.Z + dz * t, nivel: rio.niveis[cursor] + (rio.niveis[cursor + 1] - rio.niveis[cursor]) * t, s, tx: dx / m, tz: dz / m }
  }

  // as distâncias das estações: a cada `passo` m; a primeira e a última sempre; e, para o CORTE, a distância EXATA em que o eixo cruza cada aresta do quadrado (as duas metades se encontram nela)
  const alvos = new Set<number>()
  for (let s = 0; s < total; s += passo) alvos.add(s)
  alvos.add(total)
  for (let k = 1; k < n; k += 1) {
    const a = rio.pontos[k - 1]
    const b = rio.pontos[k]
    for (const [ca, cb, borda] of [
      [a.X, b.X, LADO * i - MEIA],
      [a.X, b.X, LADO * i + MEIA],
      [a.Z, b.Z, LADO * j - MEIA],
      [a.Z, b.Z, LADO * j + MEIA],
    ] as const) {
      // `<= 0` e nao `< 0`: um ponto da poligonal que cai EXATAMENTE sobre a aresta (o produto vale 0) tambem e um cruzamento. Com `< 0` esse cruzamento nunca era registrado e a fita ficava com um BURACO de ate 4 m na
      // emenda (medido: a aresta Z = -56 e Z = 56 do rio V-1:-1:-2; so a Z = -168 casava, porque ali o cruzamento caia numa estacao de passo)
      if ((ca - borda) * (cb - borda) <= 0 && ca !== cb) alvos.add(acumulada[k - 1] + (acumulada[k] - acumulada[k - 1]) * ((borda - ca) / (cb - ca)))
    }
  }
  const distancias = [...alvos].sort((p, q) => p - q)
  const estacoes = distancias.map(estacaoEm)

  const posicoes: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const meia = LARGURA_DA_FITA / 2
  const dentro = (e: Estacao): boolean => Math.abs(e.X - LADO * i) <= MEIA + 1e-9 && Math.abs(e.Z - LADO * j) <= MEIA + 1e-9

  /** Os dois vértices da estação (esquerda, direita), num PAR consecutivo; devolve o índice do primeiro. A normal à esquerda do sentido do rio é `(−tz, tx)`. */
  const par = (e: Estacao): number => {
    const base = posicoes.length / 3
    const nx = -e.tz
    const nz = e.tx
    posicoes.push(preso(e.X - LADO * i + nx * meia), e.nivel, preso(e.Z - LADO * j + nz * meia))
    uvs.push(0, e.s)
    posicoes.push(preso(e.X - LADO * i - nx * meia), e.nivel, preso(e.Z - LADO * j - nz * meia))
    uvs.push(1, e.s)
    return base
  }

  // a TIRA: entre duas estações consecutivas, ambas com o eixo dentro do quadrado, um quadrilátero de 2 triângulos voltados para cima (enrolamento anti-horário visto de cima)
  const pares: number[] = new Array(estacoes.length).fill(-1)
  for (let e = 0; e < estacoes.length; e += 1) {
    if (!dentro(estacoes[e])) continue
    pares[e] = par(estacoes[e])
    if (e > 0 && pares[e - 1] >= 0) {
      const a = pares[e - 1]
      const b = pares[e]
      indices.push(a, b + 1, a + 1, a, b, b + 1)
    }
  }

  // o LEQUE da PONTA: um meio disco de raio `meia` na direção do rio (na última estação) e outro, para trás, na primeira. Só se a ponta está DENTRO do quadrado (na aresta o vizinho a continua).
  const leque = (e: Estacao, sentido: 1 | -1): void => {
    if (!dentro(e) || Math.abs(Math.abs(e.X - LADO * i) - MEIA) < 1e-6 || Math.abs(Math.abs(e.Z - LADO * j) - MEIA) < 1e-6) return
    const centro = posicoes.length / 3
    posicoes.push(e.X - LADO * i, e.nivel, e.Z - LADO * j)
    uvs.push(0.5, e.s)
    const nx = -e.tz
    const nz = e.tx
    const primeiro = posicoes.length / 3
    for (let f = 0; f <= FATIAS_DO_LEQUE; f += 1) {
      // do lado ESQUERDO (+normal) ao DIREITO (−normal), passando à frente (sentido = +1) ou atrás (sentido = −1) do eixo
      const ang = (f / FATIAS_DO_LEQUE) * Math.PI
      const lateral = Math.cos(ang) * meia
      const frente = Math.sin(ang) * meia * sentido
      posicoes.push(preso(e.X - LADO * i + nx * lateral + e.tx * frente), e.nivel, preso(e.Z - LADO * j + nz * lateral + e.tz * frente))
      uvs.push(0.5 - Math.cos(ang) * 0.5, e.s + frente)
    }
    for (let f = 0; f < FATIAS_DO_LEQUE; f += 1) {
      // o enrolamento, MEDIDO pelo produto vetorial (`.superpowers/agua/enrolamento-do-leque.mjs`): o leque da FRENTE (`sentido` +1) precisa de `(centro, f, f+1)` e o de TRÁS (−1), que é o espelho, de `(centro, f+1, f)`.
      // (Tentei a mesma ordem nos dois e só um ficou voltado para cima: o espelhamento do arco já inverte o giro.)
      if (sentido === 1) indices.push(centro, primeiro + f, primeiro + f + 1)
      else indices.push(centro, primeiro + f + 1, primeiro + f)
    }
  }
  leque(estacoes[estacoes.length - 1], 1)
  leque(estacoes[0], -1)

  return { posicoes: new Float32Array(posicoes), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) }
}
