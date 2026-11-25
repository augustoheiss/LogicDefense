import type { QualidadeEfetiva } from '../visual/qualidadeGrafica'
import { alturaEm, MEIA_RELEVO, normalEm, type CampoRelevo } from './campoRelevo'

/**
 * A MALHA DO TERRENO (F2, Task 3, 25/11/2026). Funções PURAS (sem `three`, sem DOM): transformam o campo de relevo em arrays que a cena entrega ao `BufferGeometry`. Testadas no Node em
 * `geometriaDoTerreno.test.ts`.
 *
 * O contrato que importa: CADA vértice é `alturaEm(campo, x, z)`. O clique, as obras e os props leem `alturaEm`; se a malha mentisse numa altura, o chão desenhado discordaria deles.
 */

/** O passo da malha em metros, por qualidade. Os três dividem 112, então a borda de ±56 m é sempre um vértice e a emenda entre quadrados vizinhos fecha. */
export function passoDaMalha(qualidade: QualidadeEfetiva): 1 | 2 | 4 {
  return qualidade === 'ultra' ? 1 : qualidade === 'bonito' ? 2 : 4
}

export interface GeometriaDoTerreno {
  /** `x, y, z` por vértice, em metros: `x` e `z` locais ao quadrado (−56 a +56), `y` = `alturaEm` (acima da rua, sem o `Y_SOLO_VISUAL`). Linha por linha de `z`. */
  readonly posicoes: Float32Array
  /** `nx, ny, nz` unitária por vértice, a normal do campo (a mesma de `normalEm`). */
  readonly normais: Float32Array
  /**
   * `u, v` por vértice, o MESMO mapeamento do `PlaneGeometry(112, 112)` com `rotation.x = −π/2` que o chão usa hoje (medido no three real): `u = (x + 56) / 112` e `v = 1 − (z + 56) / 112`.
   * Assim a estrada e a praça (desenhadas por cima, com as próprias texturas) continuam casando com o solo, e o chão não fica espelhado.
   */
  readonly uvs: Float32Array
  /** Três índices por triângulo, na ordem que volta a face PARA CIMA (sentido anti-horário visto de cima, regra da mão direita). */
  readonly indices: Uint32Array
}

/**
 * Constrói a malha de um campo com o `passo` dado (1, 2 ou 4: tem de dividir 112). `2 · (112 / passo)²` triângulos. Passo inválido lança: uma malha que não fecha o quadrado deixaria um vão visível.
 */
export function geometriaDoTerreno(campo: CampoRelevo, passo: number): GeometriaDoTerreno {
  if (!Number.isInteger(passo) || passo <= 0 || (2 * MEIA_RELEVO) % passo !== 0) {
    throw new Error(`o passo da malha (${passo}) tem de ser um inteiro positivo que divide ${2 * MEIA_RELEVO}`)
  }
  const n = (2 * MEIA_RELEVO) / passo // células por lado
  const lado = n + 1 // vértices por lado
  const posicoes = new Float32Array(lado * lado * 3)
  const normais = new Float32Array(lado * lado * 3)
  const uvs = new Float32Array(lado * lado * 2)
  for (let gz = 0; gz < lado; gz += 1) {
    for (let gx = 0; gx < lado; gx += 1) {
      const x = -MEIA_RELEVO + gx * passo
      const z = -MEIA_RELEVO + gz * passo
      const k = (gz * lado + gx) * 3
      posicoes[k] = x
      posicoes[k + 1] = alturaEm(campo, x, z)
      posicoes[k + 2] = z
      uvs[(gz * lado + gx) * 2] = (x + MEIA_RELEVO) / (2 * MEIA_RELEVO)
      uvs[(gz * lado + gx) * 2 + 1] = 1 - (z + MEIA_RELEVO) / (2 * MEIA_RELEVO)
      const [nx, ny, nz] = normalEm(campo, x, z)
      normais[k] = nx
      normais[k + 1] = ny
      normais[k + 2] = nz
    }
  }
  const indices = new Uint32Array(n * n * 6)
  let t = 0
  for (let cz = 0; cz < n; cz += 1) {
    for (let cx = 0; cx < n; cx += 1) {
      const a = cz * lado + cx // (x, z)
      const b = a + 1 // (x+1, z)
      const c = a + lado // (x, z+1)
      const d = c + 1 // (x+1, z+1)
      // Vistos de cima (y para o observador) com x para a direita e z para BAIXO da tela, o sentido que dá normal +y é a→c→b e b→c→d.
      indices[t++] = a
      indices[t++] = c
      indices[t++] = b
      indices[t++] = b
      indices[t++] = c
      indices[t++] = d
    }
  }
  return { posicoes, normais, uvs, indices }
}

export interface SaiaDoTerreno {
  /** `x, y, z` por vértice: `x` e `z` na aresta do quadrado (±56), `y` = `min(quina do terreno, topo)` (base) ou o topo. Dois vértices por posição ao longo da aresta. Onde a quina passa do topo a parede tem altura ZERO. */
  readonly posicoes: Float32Array
  /** Três índices por triângulo, na ordem que volta a face PARA DENTRO do quadrado (quem a vê está dentro dele). */
  readonly indices: Uint32Array
}

/**
 * A SAIA DO TERRENO (F2, 25/11/2026): uma parede vertical em cada uma das quatro arestas, da quina do terreno (`alturaEm`) até `yTopo`, olhando PARA DENTRO do quadrado.
 *
 * POR QUÊ (o «fio azul»): o terreno é uma folha SEM espessura, e o plano da névoa (um plano de ~678 m a `Y_SOLO_VISUAL + 0,33`) tem um FURO no quadrado inteiro, porque o terreno cuida da névoa lá
 * dentro. Um raio da câmera do Império que cruza o furo perto da aresta segue descendo para FORA do quadrado, passa POR CIMA da quina do terreno e por BAIXO do plano, e não acerta nada: vê o céu.
 * MEDIDO em 25/11 com a câmera real (`.superpowers/mut/medir-saia.mjs`): com a quina em 0 m são 7/7/8 pixels de fio nas linhas y = 70/85/100 da tela; com a saia até o plano, 0/0/0; com uma saia
 * CURTA (até −0,30) ainda 4/4/5. Então o topo TEM de ser a altura do plano: `yTopo` é parâmetro (quem sabe a altura do plano é a névoa) e o teste trava o valor.
 *
 * POR QUE PARA DENTRO (corrigido em 25/11, a 1ª versão a voltava para FORA): a saia só é VISTA de dentro do quadrado (a câmera do Império fica em (0, 34, 42), a do corpo no chão). Com a frente para
 * fora o backface culling a descarta, o fundo da cena aparece e o fio azul continua IDÊNTICO (medido: 7/8/8 px com a saia de costas e sem saia; 0/0/0 com a saia em DoubleSide). Medido também:
 * com a ordem antiga 0, 3, 1 e 0 dos 56 triângulos de cada aresta ficavam voltados para a câmera.
 *
 * A BASE é `min(quina, yTopo)`: onde a quina do terreno passa do topo (MEDIDO em 25/11: de 3 a 30 das 452 colunas de aresta, até 0,46 m acima) o próprio terreno já cobre o plano da névoa e não há vão
 * a fechar; com `base = quina` a altura da parede ficava NEGATIVA e a normal invertia (4 de 896 triângulos de costas na clareira).
 *
 * Posições locais ao terreno (mesma origem de `geometriaDoTerreno`: o chão fica em `Y_SOLO_VISUAL` e a malha guarda a altura ACIMA da rua). Sem normais nem UVs: a névoa do terreno calcula a UV pela
 * POSIÇÃO local (`vUvNevoa`), então a saia herda a MESMA névoa do chão, sem material novo.
 */
export function saiaDoTerreno(campo: CampoRelevo, passo: number, yTopo: number): SaiaDoTerreno {
  if (!Number.isInteger(passo) || passo <= 0 || (2 * MEIA_RELEVO) % passo !== 0) {
    throw new Error(`o passo da saia (${passo}) tem de ser um inteiro positivo que divide ${2 * MEIA_RELEVO}`)
  }
  const n = (2 * MEIA_RELEVO) / passo // células por aresta
  const colunas = n + 1 // posições ao longo de uma aresta
  const posicoes = new Float32Array(4 * colunas * 2 * 3)
  const indices = new Uint32Array(4 * n * 2 * 3)
  let v = 0
  let t = 0
  // cada aresta: o ponto (x, z) em função de `s` ao longo dela (de −56 a +56) e QUAL das duas ordens de índices volta a face para DENTRO. `direta` é (base A, topo A, base B); a outra é (base A, base B, topo A).
  // MEDIDO em 25/11 (`.superpowers/mut/medir-ordem-por-aresta.mjs`, a mesma conta u × v do teste): oeste e norte pedem a direta; leste e sul, a inversa. Os sinais NÃO são dedutíveis de cabeça (a 1ª versão
  // errou nas quatro e o teste passou de primeira); o teste que enxerga cada triângulo da câmera é quem decide.
  const arestas: ReadonlyArray<{ ponto: (s: number) => [number, number]; direta: boolean }> = [
    { ponto: (s) => [-MEIA_RELEVO, s], direta: true }, // oeste (x = −56)
    { ponto: (s) => [MEIA_RELEVO, s], direta: false }, // leste (x = +56)
    { ponto: (s) => [s, -MEIA_RELEVO], direta: false }, // sul (z = −56)
    { ponto: (s) => [s, MEIA_RELEVO], direta: true }, // norte (z = +56)
  ]
  for (let a = 0; a < arestas.length; a += 1) {
    const { ponto, direta } = arestas[a]
    const primeiro = v / 3
    for (let k = 0; k < colunas; k += 1) {
      const [x, z] = ponto(-MEIA_RELEVO + k * passo)
      posicoes[v++] = x
      posicoes[v++] = Math.min(alturaEm(campo, x, z), yTopo)
      posicoes[v++] = z
      posicoes[v++] = x
      posicoes[v++] = yTopo
      posicoes[v++] = z
    }
    for (let k = 0; k < n; k += 1) {
      const baseA = primeiro + k * 2
      const topoA = baseA + 1
      const baseB = baseA + 2
      const topoB = baseA + 3
      if (direta) {
        indices[t++] = baseA
        indices[t++] = topoA
        indices[t++] = baseB
        indices[t++] = baseB
        indices[t++] = topoA
        indices[t++] = topoB
      } else {
        indices[t++] = baseA
        indices[t++] = baseB
        indices[t++] = topoA
        indices[t++] = baseB
        indices[t++] = topoB
        indices[t++] = topoA
      }
    }
  }
  return { posicoes, indices }
}
