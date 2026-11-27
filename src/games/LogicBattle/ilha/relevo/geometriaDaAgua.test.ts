import { limparMemoriaDaAgua, riosDoQuadrado, type Rio } from './aguaDoMundo'
import { alturaDeBaseDoMundo } from './geradorRelevo'
import { geometriaDaFita, LARGURA_DA_FITA, PASSO_DA_FITA } from './geometriaDaAgua'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const MEIA = 56

/** Um `Rio` sintético: a poligonal e o nível dados (o teste da geometria não precisa do gerador). */
function rioSintetico(pontos: Array<{ X: number; Z: number }>, nivel = -0.5): Rio {
  return { id: 'S', eixo: 'V', pontos, niveis: new Float64Array(pontos.length).fill(nivel) }
}

/**
 * A GEOMETRIA DA FITA D'ÁGUA (F2, 26/11/2026, Task 4): a malha da água de um rio dentro de UM quadrado. PURA (sem `three`): `posicoes` (x, y, z locais do quadrado), `uvs` (x transversal 0..1, y = metros GLOBAIS ao
 * longo do rio) e `indices`. A água visível medida no gerador real tem meia-largura 2,70 m (mediana; largura 5,4 m) e a ponta fecha em ~3 m (arredondada), não os 6,5 m do corte do `nivel`.
 */
export function run(): void {
  // (1) UMA FITA RETA de N vértices por lado: 2·(N−1) triângulos (conta de cabeça: o controle), todos voltados para cima, fita FORA de qualquer quadrado vazia
  const reto = rioSintetico(Array.from({ length: 41 }, (_, k) => ({ X: -20 + k, Z: 0 })))
  const g0 = geometriaDaFita(reto, { i: 0, j: 0 }, 4)
  const nTri = g0.indices.length / 3
  assert(Number.isInteger(nTri) && nTri > 0, `a fita reta tem triângulos (${nTri})`)
  // 40 m a passo 4 ⇒ 11 estações (4·10 = 40), 2 vértices por estação, 10 quadriláteros = 20 triângulos, mais os 2 leques das pontas (cada um com a metade de um disco)
  const semLeque = 2 * (11 - 1)
  assert(nTri >= semLeque, `a fita reta de 40 m a passo 4 tem ao menos ${semLeque} triângulos de tira (veio ${nTri})`)
  for (let t = 0; t < g0.indices.length; t += 3) {
    const a = g0.indices[t] * 3
    const b = g0.indices[t + 1] * 3
    const c = g0.indices[t + 2] * 3
    const ux = g0.posicoes[b] - g0.posicoes[a]
    const uz = g0.posicoes[b + 2] - g0.posicoes[a + 2]
    const vx = g0.posicoes[c] - g0.posicoes[a]
    const vz = g0.posicoes[c + 2] - g0.posicoes[a + 2]
    const ny = uz * vx - ux * vz // a componente y do produto vetorial (b − a) × (c − a) com x→x, z→z
    assert(ny > 1e-12, `o triângulo ${t / 3} da fita reta está voltado para CIMA (ny ${ny})`)
  }

  // (2) A LARGURA: a fita reta tem a meia-largura de LARGURA_DA_FITA/2 (2,7 m medidos no gerador real) em torno do eixo, em todo vértice do meio
  assert(Math.abs(LARGURA_DA_FITA - 5.4) < 1e-9, `a fita tem 5,4 m de largura (a água visível medida: meia-largura 2,70 m; veio ${LARGURA_DA_FITA})`)
  let desvio = 0
  for (let v = 0; v < g0.posicoes.length / 3; v += 1) {
    const x = g0.posicoes[v * 3]
    const z = g0.posicoes[v * 3 + 2]
    // os vértices da TIRA ficam a ±2,7 m do eixo; os do leque e o centro ficam entre 0 e 2,7 m (o raio do arco). A tolerância é a de um `Float32Array` (1e-6): em float32 o 2,7 guardado erra por ~5e-8.
    if (Math.abs(x) < 15 && Math.abs(z) > 1e-6) desvio = Math.max(desvio, Math.abs(Math.abs(z) - LARGURA_DA_FITA / 2))
  }
  assert(desvio < 1e-6, `os vértices a mais de 1e-6 m do eixo, na tira, ficam a ±${LARGURA_DA_FITA / 2} m dele (desvio ${desvio})`)

  // (3) `uv.x` TRANSVERSAL: 0 e 1 nas margens e 0,5 no eixo; `uv.y` = a distância ao longo do rio em METROS GLOBAIS (contínua nas emendas)
  let min = Infinity
  let max = -Infinity
  for (let v = 0; v < g0.uvs.length / 2; v += 1) {
    min = Math.min(min, g0.uvs[v * 2])
    max = Math.max(max, g0.uvs[v * 2])
  }
  assert(min === 0 && max === 1, `uv.x vale 0 e 1 nas margens (veio ${min} e ${max})`)
  let temEixo = false
  for (let v = 0; v < g0.uvs.length / 2; v += 1) if (Math.abs(g0.uvs[v * 2] - 0.5) < 1e-9) temEixo = true
  assert(temEixo, 'há vértices no eixo com uv.x = 0,5 (o centro do leque da ponta)')

  // (4) A ALTURA: y de cada vértice da TIRA é o nível do ponto do rio (`rio.niveis[k]`), na escala do campo: NADA somado (nem Y_SOLO_VISUAL nem Y_AGUA_VISUAL)
  const comNivel = rioSintetico(Array.from({ length: 21 }, (_, k) => ({ X: k, Z: 0 })), 0)
  const niveis = comNivel.niveis
  for (let k = 0; k < niveis.length; k += 1) niveis[k] = -0.2 - 0.01 * k
  const g1 = geometriaDaFita(comNivel, { i: 0, j: 0 }, 1)
  for (let v = 0; v < g1.posicoes.length / 3; v += 1) {
    const x = g1.posicoes[v * 3]
    if (x < 0 || x > 20) continue
    const esperado = -0.2 - 0.01 * Math.round(x)
    assert(Math.abs(g1.posicoes[v * 3 + 1] - esperado) < 0.0101, `y do vértice em x=${x} é o nível do rio (${esperado}); veio ${g1.posicoes[v * 3 + 1]}`)
  }

  // (5) A FLECHA: um rio RETO tem flecha 0; um ARCO de raio 20 m amostrado a cada 8 amostras tem flecha 0,4 m ± 0,1 (o controle do protótipo mediu 0,399) com passo 8; com passo 4 a flecha cai a ≤ 0,12
  const flecha = (rio: Rio, passo: number): number => {
    const g = geometriaDaFita(rio, { i: 0, j: 0 }, passo)
    // a flecha: a maior distância entre o ponto original do rio e a poligonal da fita (os pontos do EIXO da tira = a média dos 2 vértices de cada estação)
    const eixo: Array<{ x: number; z: number }> = []
    const n = g.posicoes.length / 3
    for (let v = 0; v + 1 < n; v += 2) eixo.push({ x: (g.posicoes[v * 3] + g.posicoes[(v + 1) * 3]) / 2, z: (g.posicoes[v * 3 + 2] + g.posicoes[(v + 1) * 3 + 2]) / 2 })
    let pior = 0
    for (const p of rio.pontos) {
      let melhor = Infinity
      for (let s = 1; s < eixo.length; s += 1) {
        const dx = eixo[s].x - eixo[s - 1].x
        const dz = eixo[s].z - eixo[s - 1].z
        const L2 = dx * dx + dz * dz
        const t = L2 ? Math.max(0, Math.min(1, ((p.X - eixo[s - 1].x) * dx + (p.Z - eixo[s - 1].z) * dz) / L2)) : 0
        melhor = Math.min(melhor, Math.hypot(p.X - (eixo[s - 1].x + t * dx), p.Z - (eixo[s - 1].z + t * dz)))
      }
      pior = Math.max(pior, melhor)
    }
    return pior
  }
  assert(flecha(reto, 4) < 1e-9, `um rio RETO tem flecha 0 (veio ${flecha(reto, 4)})`)
  const arco = rioSintetico(Array.from({ length: 41 }, (_, k) => ({ X: 20 * Math.sin(k / 20 / 2), Z: 20 * (1 - Math.cos(k / 20 / 2)) })))
  const fArco8 = flecha(arco, 8)
  assert(fArco8 > 0.05 && fArco8 < 0.7, `CONTROLE: um arco de raio 20 m amostrado de 8 em 8 amostras tem flecha mensurável (veio ${fArco8.toFixed(3)} m; o protótipo mediu 0,399)`)
  assert(flecha(arco, 4) < fArco8, `a flecha cai quando o passo diminui (passo 4: ${flecha(arco, 4).toFixed(3)} < passo 8: ${fArco8.toFixed(3)})`)

  // (6) OS 13 RIOS REAIS: com o passo da fita, a flecha máxima de TODOS é ≤ 0,06 m; todo vértice cai dentro do quadrado (|x|, |z| ≤ 56); o custo por quadrado ≤ 280 + a ponta
  limparMemoriaDaAgua()
  assert(PASSO_DA_FITA === 4, `o passo da fita é 4 m (veio ${PASSO_DA_FITA})`)
  let maxTri = 0
  let quadradosComRio = 0
  let trianguloVirado = 0
  for (let i = -6; i <= 6; i += 1) {
    for (let j = -6; j <= 6; j += 1) {
      for (const rio of riosDoQuadrado(i, j, alturaDeBaseDoMundo)) {
        const g = geometriaDaFita(rio, { i, j }, PASSO_DA_FITA)
        quadradosComRio += 1
        maxTri = Math.max(maxTri, g.indices.length / 3)
        for (let v = 0; v < g.posicoes.length / 3; v += 1) {
          assert(Math.abs(g.posicoes[v * 3]) <= MEIA + 1e-9 && Math.abs(g.posicoes[v * 3 + 2]) <= MEIA + 1e-9, `todo vértice cai dentro do quadrado (${i}, ${j}): (${g.posicoes[v * 3]}, ${g.posicoes[v * 3 + 2]})`)
        }
        for (let t = 0; t < g.indices.length; t += 3) {
          const a = g.indices[t] * 3
          const b = g.indices[t + 1] * 3
          const c = g.indices[t + 2] * 3
          if ((g.posicoes[b + 2] - g.posicoes[a + 2]) * (g.posicoes[c] - g.posicoes[a]) - (g.posicoes[b] - g.posicoes[a]) * (g.posicoes[c + 2] - g.posicoes[a + 2]) <= 0) trianguloVirado += 1
        }
      }
    }
  }
  assert(quadradosComRio >= 25, `CONTROLE: a fita foi montada em ${quadradosComRio} pares quadrado-rio (≥ 25; os 13 rios tocam ~30)`)
  assert(trianguloVirado === 0, `todo triângulo de todos os rios reais está voltado para cima (${trianguloVirado} viram para baixo)`)
  assert(maxTri <= 340, `o maior quadrado tem no máximo 340 triângulos de fita (veio ${maxTri}; o plano previu ≤ 280 + a ponta)`)

  // (7) O CORTE NA ARESTA: o rio V-1:-1:-2 cruza a aresta Z = −56 (entre os quadrados (−1, −1) e (−1, 0))... achada pela conta de travessia, sem digitar. A fita é cortada na aresta: a estação EXATA nela entra nos DOIS
  // quadrados com a mesma posição GLOBAL e o mesmo `uv.y` (a distância ao longo do rio, em metros globais): é o que fecha a fase das ondas entre quadrados.
  let cruzamentos = 0
  let piorPosicao = 0
  let piorUv = 0
  const rioV = [...riosDoMundo(alturaDeBaseDoMundo).values()].find((r) => r.id === 'V-1:-1:-2')
  assert(rioV !== undefined, 'o rio V-1:-1:-2 existe')
  for (let k = 1; k < rioV.pontos.length; k += 1) {
    const p = rioV.pontos[k - 1]
    const q = rioV.pontos[k]
    const u0 = (p.Z + MEIA) / 112
    const u1 = (q.Z + MEIA) / 112
    if (Math.floor(u0) === Math.floor(u1)) continue
    const aresta = Math.max(Math.floor(u0), Math.floor(u1)) // a aresta Z = 112·aresta − 56 liga os quadrados (−1, aresta − 1) e (−1, aresta)
    const gA = geometriaDaFita(rioV, { i: -1, j: aresta - 1 }, PASSO_DA_FITA)
    const gB = geometriaDaFita(rioV, { i: -1, j: aresta }, PASSO_DA_FITA)
    // os vértices de A que estão em z = +56 (a aresta, vista de A) e os de B que estão em z = −56 (a mesma aresta vista de B), comparados em posição GLOBAL e em uv.y
    const naAresta = (g: ReturnType<typeof geometriaDaFita>, j: number): Array<{ X: number; Z: number; y: number; uvx: number; uvy: number }> => {
      const out: Array<{ X: number; Z: number; y: number; uvx: number; uvy: number }> = []
      for (let v = 0; v < g.posicoes.length / 3; v += 1) out.push({ X: g.posicoes[v * 3] + 112 * -1, Z: g.posicoes[v * 3 + 2] + 112 * j, y: g.posicoes[v * 3 + 1], uvx: g.uvs[v * 2], uvy: g.uvs[v * 2 + 1] })
      return out
    }
    const a = naAresta(gA, aresta - 1)
    const b = naAresta(gB, aresta)
    // a estação do corte: o par de vértices (um de cada lado do eixo) do quadrado A cujo `uv.y` aparece também no quadrado B, e cuja média de Z global é a aresta Z = 112·aresta − 56
    const alvoZ = 112 * aresta - 56
    let achou = false
    for (const va of a) {
      if (Math.abs(va.Z - alvoZ) > 3) continue // só os vértices perto da aresta (a tira tem ±2,7 m de largura)
      for (const vb of b) {
        // ESQUERDA com ESQUERDA e DIREITA com DIREITA (mesmo uv.x): para um mesmo uv.y há dois vértices, a 5,4 m um do outro (a 1ª versão casava a esquerda de A com a direita de B: «pior 5,40 m»)
        if (Math.abs(vb.uvx - va.uvx) < 1e-9 && Math.abs(vb.uvy - va.uvy) < 1e-4 && Math.abs(vb.Z - alvoZ) <= 3) {
          achou = true
          piorUv = Math.max(piorUv, Math.abs(vb.uvy - va.uvy))
          piorPosicao = Math.max(piorPosicao, Math.hypot(vb.X - va.X, vb.Z - va.Z, vb.y - va.y))
        }
      }
    }
    assert(achou, `a fita cortada na aresta Z = ${alvoZ} tem a MESMA estação (uv.y igual) nos dois quadrados`)
    cruzamentos += 1
  }
  assert(cruzamentos === 3, `o rio V-1:-1:-2 cruza 3 arestas (veio ${cruzamentos}): o controle de que o teste do corte mediu algo`)
  // O `uv.y` é IDÊNTICO (a fase das ondas fecha). A POSIÇÃO casa a menos de 2 cm: o par de vértices é perpendicular ao rio e, numa travessia oblíqua, o `preso` (que prende cada vértice a ±56 no quadrado DELE: o que mantém
  // «todo vértice dentro do quadrado») o desloca por quantidades diferentes em A e em B. Medido: pior 1,55 cm, sobre uma água de 5,4 m. O contrato do plano «dentro do quadrado» é mais forte que «encontro a 1e-4».
  assert(piorPosicao < 0.02 && piorUv < 1e-4, `as duas metades se ENCONTRAM na aresta: mesma posição global a menos de 2 cm (pior ${piorPosicao.toExponential(2)} m; medido 1,55 cm) e mesmo uv.y (pior ${piorUv.toExponential(2)})`)
  assert(piorPosicao > 0 || cruzamentos === 3, `CONTROLE: o teste do encontro mediu algo (${cruzamentos} cruzamentos)`)

  // (8) A FLECHA dos rios REAIS: com o passo da fita, a maior distância entre um ponto do rio e a poligonal da fita (o eixo das estações) de TODOS os 13 rios é ≤ 0,06 m (o plano; o controle do arco acima mostra
  // que o instrumento enxerga uma flecha de 0,4 m a passo 8).
  let flechaReal = 0
  for (const r of riosDoMundo(alturaDeBaseDoMundo).values()) {
    // o rio inteiro, num quadrado fictício que o contém: a poligonal da fita é a mesma em qualquer quadrado, só o corte muda; usamos o quadrado do PRIMEIRO ponto e medimos só os pontos dentro dele
    const i0 = Math.round(r.pontos[Math.floor(r.pontos.length / 2)].X / 112)
    const j0 = Math.round(r.pontos[Math.floor(r.pontos.length / 2)].Z / 112)
    flechaReal = Math.max(flechaReal, flechaDentro(r, i0, j0, PASSO_DA_FITA))
  }
  assert(flechaReal <= 0.06, `com o passo ${PASSO_DA_FITA} a flecha máxima dos 13 rios é ≤ 0,06 m (veio ${flechaReal.toFixed(4)} m)`)
  // a flecha MEDIDA é 0,0509 m (passo 4), 0,195 m (passo 8) e 0,014 m (passo 2): o limite de 0,06 deixa só 9 mm de folga e o mutante «passo 8» o estoura 3×
  assert(flechaReal > 0.03, `CONTROLE: a flecha real com o passo 4 é mensurável (${flechaReal.toFixed(4)} m > 0,03; medida 0,0509): o instrumento enxerga a poligonal da fita se afastar do rio`)

  // (9) A CONTAGEM EXATA de um rio RETO de 40 m com passo 4 (medida): 11 estações × 2 vértices + 2 leques de (1 centro + 9 do arco) = 42 vértices; 2·(11 − 1) = 20 triângulos de tira + 8 + 8 dos leques = 36.
  // (O plano pedia `2·(N−1)`: um mutante que emitisse 1 triângulo por quadrilátero passava com o meu «≥ 20».)
  assert(g0.posicoes.length / 3 === 42, `o rio reto de 40 m a passo 4 tem 42 vértices (11 estações × 2 + 2 leques × 10; veio ${g0.posicoes.length / 3})`)
  assert(g0.indices.length / 3 === 36, `o rio reto de 40 m a passo 4 tem 36 triângulos (20 da tira + 8 + 8 dos leques; veio ${g0.indices.length / 3})`)

  // (10) `uv.y` é a DISTÂNCIA AO LONGO DO RIO em metros globais: 0, 4, 8, …, 40 nas 11 estações (os dois vértices do par têm o MESMO); e CRESCE sempre. Um `uv.y` por quadrado (`s % 7`) a quebraria.
  for (let e = 0; e < 11; e += 1) {
    assert(Math.abs(g0.uvs[e * 4 + 1] - 4 * e) < 1e-4 && Math.abs(g0.uvs[e * 4 + 3] - 4 * e) < 1e-4, `a estação ${e} tem uv.y = ${4 * e} nos DOIS vértices do par (veio ${g0.uvs[e * 4 + 1]} e ${g0.uvs[e * 4 + 3]})`)
  }
  // o centro do leque da frente (o vértice 22) tem uv.x = 0,5 EXATO e o arco vai de 0 a 1 (do lado esquerdo ao direito, passando pela frente)
  assert(g0.uvs[22 * 2] === 0.5, `o centro do leque tem uv.x = 0,5 (veio ${g0.uvs[22 * 2]})`)
  assert(g0.uvs[23 * 2] === 0 && Math.abs(g0.uvs[31 * 2] - 1) < 1e-6, `o arco do leque vai de uv.x = 0 a 1 (veio ${g0.uvs[23 * 2]} e ${g0.uvs[31 * 2]})`)

  // (11) O LEQUE é um MEIO DISCO de raio 2,70 m: os 9 vértices do arco ficam a 2,70 m do centro (medido: 2,70 em todos), e a CORDA de cada fatia fica a ≤ 0,06 m do círculo (8 fatias: 0,052 m; com 2 fatias seria
  // 0,791 m: o mutante «2 fatias» NÃO é equivalente, o disco ficaria um losango). O leque de TRÁS, no começo do rio, tem os mesmos 9 vértices a 2,70 m do centro dele.
  for (const [centro, primeiro] of [[22, 23], [32, 33]] as const) {
    for (let f = 0; f <= 8; f += 1) {
      const v = primeiro + f
      const r = Math.hypot(g0.posicoes[v * 3] - g0.posicoes[centro * 3], g0.posicoes[v * 3 + 2] - g0.posicoes[centro * 3 + 2])
      assert(Math.abs(r - LARGURA_DA_FITA / 2) < 1e-4, `o vértice ${f} do arco do leque (centro ${centro}) fica a ${LARGURA_DA_FITA / 2} m do centro (veio ${r.toFixed(4)})`)
    }
    let corda = 0
    for (let f = 0; f < 8; f += 1) {
      const a = primeiro + f
      const b = primeiro + f + 1
      const mx = (g0.posicoes[a * 3] + g0.posicoes[b * 3]) / 2 - g0.posicoes[centro * 3]
      const mz = (g0.posicoes[a * 3 + 2] + g0.posicoes[b * 3 + 2]) / 2 - g0.posicoes[centro * 3 + 2]
      corda = Math.max(corda, LARGURA_DA_FITA / 2 - Math.hypot(mx, mz))
    }
    assert(corda < 0.06 && corda > 0.01, `a corda de cada fatia do leque fica a menos de 6 cm do círculo (veio ${corda.toFixed(3)} m; medido 0,052; com 2 fatias seria 0,791)`)
  }
  // o leque da FRENTE avança na direção do rio (x cresce) e o de TRÁS recua (x diminui)
  let xMax = -1e9
  for (let v = 23; v <= 31; v += 1) xMax = Math.max(xMax, g0.posicoes[v * 3])
  assert(xMax > g0.posicoes[22 * 3] + 2, `o leque da frente avança ${LARGURA_DA_FITA / 2} m na direção do rio (x até ${xMax}, centro em ${g0.posicoes[22 * 3]})`)
  let xMin = 1e9
  for (let v = 33; v <= 41; v += 1) xMin = Math.min(xMin, g0.posicoes[v * 3])
  assert(xMin < g0.posicoes[32 * 3] - 2, `o leque de trás recua ${LARGURA_DA_FITA / 2} m para trás (x até ${xMin}, centro em ${g0.posicoes[32 * 3]})`)

  // (12) A LARGURA num rio DIAGONAL (45°): 5,400 m. A tangente tem de ser UNITÁRIA. A 1ª versão usava pontos a 1 m de distância (passo 0,7071 em x e z): aí |(dx, dz)| = 1 e a tangente SEM normalizar coincide com a normalizada,
  // e o mutante sobrevivia. Os pontos precisam estar a 0,5 m (a fita sairia com 2,70 m) ou a 2 m (10,80 m). Medido: original 5,400 nos três casos; mutante 2,700 / 10,800 / 2,700.
  for (const [rotulo, passoDosPontos, quantos] of [['pontos a 0,5 m', 0.3536, 81], ['pontos a 2 m', 1.4142, 21]] as const) {
    const diagonal = rioSintetico(Array.from({ length: quantos }, (_, k) => ({ X: -14 + k * passoDosPontos, Z: -14 + k * passoDosPontos })))
    const gd = geometriaDaFita(diagonal, { i: 0, j: 0 }, 4)
    let larguraDiag = 0
    for (let v = 0; v + 1 < 20; v += 2) larguraDiag = Math.max(larguraDiag, Math.hypot(gd.posicoes[v * 3] - gd.posicoes[(v + 1) * 3], gd.posicoes[v * 3 + 2] - gd.posicoes[(v + 1) * 3 + 2]))
    assert(Math.abs(larguraDiag - LARGURA_DA_FITA) < 1e-4, `a fita de um rio DIAGONAL (${rotulo}) tem ${LARGURA_DA_FITA} m de largura (veio ${larguraDiag.toFixed(4)}): a tangente é unitária`)
  }
  const retoMeio = rioSintetico(Array.from({ length: 81 }, (_, k) => ({ X: -20 + k * 0.5, Z: 0 })))
  const gm = geometriaDaFita(retoMeio, { i: 0, j: 0 }, 4)
  assert(Math.abs(Math.hypot(gm.posicoes[0] - gm.posicoes[3], gm.posicoes[2] - gm.posicoes[5]) - LARGURA_DA_FITA) < 1e-4, `a fita de um rio reto com pontos a 0,5 m tem ${LARGURA_DA_FITA} m de largura`)

  // (13) AS QUATRO ARESTAS e o LEQUE NO CORTE. Um rio que cruza a aresta LESTE (X = +56) no quadrado (0, 0) tem 46 triângulos nele e 10 no vizinho (1, 0), que recebe a continuação (x de −56 a −49,3); e um rio que TERMINA exatamente
  // na aresta leste tem 28 triângulos: a tira (20) e o leque de TRÁS (8), SEM o leque da frente (a ponta cai na aresta: o vizinho a continua). Medido.
  const cruzaLeste = rioSintetico(Array.from({ length: 81 }, (_, k) => ({ X: -20 + k, Z: 10 })))
  const gl0 = geometriaDaFita(cruzaLeste, { i: 0, j: 0 }, 4)
  const gl1 = geometriaDaFita(cruzaLeste, { i: 1, j: 0 }, 4)
  assert(gl0.indices.length / 3 === 46, `o rio que cruza a aresta LESTE tem 46 triângulos no quadrado (0, 0) (veio ${gl0.indices.length / 3})`)
  assert(gl1.indices.length / 3 === 10, `...e 10 no vizinho (1, 0), que recebe a continuação (veio ${gl1.indices.length / 3})`)
  const terminaNaAresta = rioSintetico(Array.from({ length: 41 }, (_, k) => ({ X: 16 + k, Z: 0 })))
  assert(geometriaDaFita(terminaNaAresta, { i: 0, j: 0 }, 4).indices.length / 3 === 28, 'o rio que TERMINA na aresta leste tem 28 triângulos (a tira e o leque de trás, sem o da frente)')
  // as outras arestas: um rio que cruza a OESTE (X = −56), a NORTE (Z = −56) e a SUL (Z = +56) também é cortado nelas (cada um tem a continuação no vizinho)
  const cruzaOeste = rioSintetico(Array.from({ length: 81 }, (_, k) => ({ X: -60 + k, Z: 10 })))
  const cruzaNorte = rioSintetico(Array.from({ length: 81 }, (_, k) => ({ X: 10, Z: -60 + k })))
  const cruzaSul = rioSintetico(Array.from({ length: 81 }, (_, k) => ({ X: 10, Z: -20 + k })))
  for (const [nome, rio, vizinho] of [['OESTE', cruzaOeste, { i: -1, j: 0 }], ['NORTE', cruzaNorte, { i: 0, j: -1 }], ['SUL', cruzaSul, { i: 0, j: 1 }]] as const) {
    const gv = geometriaDaFita(rio, vizinho, 4)
    assert(gv.indices.length / 3 > 0, `o rio que cruza a aresta ${nome} tem a continuação desenhada no quadrado vizinho (${gv.indices.length / 3} triângulos)`)
    for (let v = 0; v < gv.posicoes.length / 3; v += 1) assert(Math.abs(gv.posicoes[v * 3]) <= MEIA && Math.abs(gv.posicoes[v * 3 + 2]) <= MEIA, `a continuação na aresta ${nome} fica dentro do quadrado vizinho`)
  }

  // (14) O CORTE DA ARESTA OESTE (X = −56): um rio que ENTRA no quadrado (0, 0) vindo do (−1, 0), de X = −90 a −10 a Z = 10, começa nele em `uv.y` = 34,000 (a estação EXATA do cruzamento: −56 − (−90) = 34 m do começo) e tem
  // 32 triângulos; sem o corte da aresta oeste começaria em 36,000 (a estação de passo seguinte) com 30. O vizinho (−1, 0) termina nos MESMOS 34,000. Medido.
  const entraPelaOeste = rioSintetico(Array.from({ length: 81 }, (_, k) => ({ X: -90 + k, Z: 10 })))
  const ge0 = geometriaDaFita(entraPelaOeste, { i: 0, j: 0 }, 4)
  const ge1 = geometriaDaFita(entraPelaOeste, { i: -1, j: 0 }, 4)
  const uvMin = (g: ReturnType<typeof geometriaDaFita>): number => Math.min(...Array.from({ length: g.uvs.length / 2 }, (_, v) => g.uvs[v * 2 + 1]))
  const uvMax = (g: ReturnType<typeof geometriaDaFita>): number => Math.max(...Array.from({ length: g.uvs.length / 2 }, (_, v) => g.uvs[v * 2 + 1]))
  assert(ge0.indices.length / 3 === 32, `o rio que entra pela aresta OESTE tem 32 triângulos no quadrado (0, 0) (veio ${ge0.indices.length / 3}; sem o corte da oeste: 30)`)
  assert(Math.abs(uvMin(ge0) - 34) < 1e-4, `...e começa em uv.y = 34 (a estação exata da aresta; veio ${uvMin(ge0)}; sem o corte seria 36)`)
  assert(Math.abs(uvMax(ge1) - 34) < 1e-4, `...e o vizinho (−1, 0) termina nos MESMOS 34 (veio ${uvMax(ge1)}): as duas metades se encontram na aresta OESTE também`)

  // (15) A POLIGONAL DEGENERADA (revisão independente, 26/11/2026): um rio com 0 ou 1 ponto fazia `geometriaDaFita` LANÇAR (`Cannot read properties of undefined (reading 'X')`, medido), e um erro dentro de um `useMemo`
  // no meio do render derruba a cena inteira. O módulo da água nunca produz um rio assim (os 13 têm 145–369 pontos), mas a fita é um limite de módulo: a geometria devolve VAZIA (nenhum vértice, nenhum índice) e o
  // componente já não monta nada com `index.count === 0`. Com 2 pontos IGUAIS (comprimento 0) o desenho é um disco finito, sem `NaN`: o caso que NÃO lança hoje e tem de continuar finito.
  for (const [rotulo, pontos] of [['0 pontos', []], ['1 ponto', [{ X: 0, Z: 0 }]]] as const) {
    const g = geometriaDaFita(rioSintetico([...pontos]), { i: 0, j: 0 }, 4)
    assert(g.posicoes.length === 0 && g.uvs.length === 0 && g.indices.length === 0, `um rio de ${rotulo} devolve a geometria VAZIA em vez de lançar (veio ${g.posicoes.length / 3} vértices)`)
  }
  const igual = geometriaDaFita(rioSintetico([{ X: 0, Z: 0 }, { X: 0, Z: 0 }]), { i: 0, j: 0 }, 4)
  assert(igual.posicoes.length > 0 && Array.from(igual.posicoes).every(Number.isFinite) && Array.from(igual.uvs).every(Number.isFinite), 'dois pontos IGUAIS (comprimento 0) dão uma geometria FINITA, sem NaN nem Infinity')
  assert(geometriaDaFita(rioSintetico([{ X: 0, Z: 0 }, { X: 10, Z: 0 }]), { i: 0, j: 0 }, 4).indices.length > 0, 'dois pontos distintos (um segmento de 10 m) ainda desenham a fita: a guarda só corta o que tem MENOS de 2 pontos')
  limparMemoriaDaAgua()
}

/** Os rios distintos dos 169 quadrados de −6 a 6, pelo `id`. */
function riosDoMundo(alturaBase: (X: number, Z: number) => number): Map<string, Rio> {
  const todos = new Map<string, Rio>()
  for (let i = -6; i <= 6; i += 1) for (let j = -6; j <= 6; j += 1) for (const r of riosDoQuadrado(i, j, alturaBase)) todos.set(r.id, r)
  return todos
}

/** A flecha da fita do rio no quadrado (i, j): a maior distância entre um ponto do rio DENTRO do quadrado e o eixo da fita (a média dos dois vértices de cada estação). */
function flechaDentro(rio: Rio, i: number, j: number, passo: number): number {
  const g = geometriaDaFita(rio, { i, j }, passo)
  const eixo: Array<{ x: number; z: number }> = []
  // as estações da TIRA são os pares (esquerda, direita) consecutivos; o leque tem vértices soltos: o eixo só usa os pares cujo uv.x é 0 e 1
  for (let v = 0; v + 1 < g.posicoes.length / 3; v += 1) {
    if (g.uvs[v * 2] === 0 && g.uvs[(v + 1) * 2] === 1) eixo.push({ x: (g.posicoes[v * 3] + g.posicoes[(v + 1) * 3]) / 2, z: (g.posicoes[v * 3 + 2] + g.posicoes[(v + 1) * 3 + 2]) / 2 })
  }
  let pior = 0
  for (const p of rio.pontos) {
    const x = p.X - 112 * i
    const z = p.Z - 112 * j
    if (Math.abs(x) > MEIA - 4 || Math.abs(z) > MEIA - 4) continue
    let melhor = Infinity
    for (let s = 1; s < eixo.length; s += 1) {
      const dx = eixo[s].x - eixo[s - 1].x
      const dz = eixo[s].z - eixo[s - 1].z
      const L2 = dx * dx + dz * dz
      const t = L2 ? Math.max(0, Math.min(1, ((x - eixo[s - 1].x) * dx + (z - eixo[s - 1].z) * dz) / L2)) : 0
      melhor = Math.min(melhor, Math.hypot(x - (eixo[s - 1].x + t * dx), z - (eixo[s - 1].z + t * dz)))
    }
    pior = Math.max(pior, melhor)
  }
  return pior
}
