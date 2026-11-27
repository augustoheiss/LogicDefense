import { geometriaDoHorizonte, MEIA_DO_QUADRADO, PASSO_DO_HORIZONTE, RAIO_DO_HORIZONTE } from './geometriaDoHorizonte'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * A GEOMETRIA DO HORIZONTE (F2, Task 8, 26/11/2026): um ANEL de passo largo em volta do quadrado atual, de 56 m (a borda) até 104 m do centro, com a altura do mundo PURO (`alturaDeBaseDoMundo`: a função do ponto global que existe em
 * qualquer lugar, sem gerar os 8 campos dos vizinhos: ~650 ms de CPU). PURA (sem `three`): a altura entra por parâmetro. Medido no Node: o fog apaga o mundo entre 82 e 102 m (1ª/3ª pessoa), então o jogador vê do vizinho no máximo
 * uns 45 m; o anel de 8 m custa 960 triângulos (o teto do plano: 1.500), 5 ms para calcular as alturas uma vez, e erra 0,29 m em média contra o campo real do vizinho (silhueta de longe).
 */
export function run(): void {
  // um relevo SINTÉTICO conhecido (uma rampa e uma ondulação), em coordenadas GLOBAIS
  const altura = (X: number, Z: number): number => 0.02 * X + 0.01 * Z + 0.5 * Math.sin(X / 23) * Math.cos(Z / 31)

  const g = geometriaDoHorizonte(altura, { i: 0, j: 0 })
  const nTri = g.indices.length / 3
  const nVert = g.posicoes.length / 3

  // (1) O ORÇAMENTO: o anel tem até 1.500 triângulos (o teto do plano); medido 960 com o passo de 8 m
  assert(PASSO_DO_HORIZONTE === 8, `o passo do horizonte é 8 m (veio ${PASSO_DO_HORIZONTE})`)
  assert(RAIO_DO_HORIZONTE === 104, `o horizonte vai até 104 m do centro (o fog apaga entre 82 e 102 m; veio ${RAIO_DO_HORIZONTE})`)
  assert(nTri === 960, `o anel de 8 m até 104 m tem 960 triângulos (a grade 26×26 = 676 células menos as 196 do buraco do quadrado, (112/8)²: 2·(676 − 196) = 960; veio ${nTri})`)
  assert(nTri <= 1500, `o anel respeita o teto do plano de 1.500 triângulos (veio ${nTri})`)

  // (2) O BURACO: nenhum triângulo cobre o INTERIOR do quadrado atual (|x|, |z| < 56): o chão de lá é o do terreno do relevo. O baricentro de cada triângulo fica fora do quadrado.
  assert(MEIA_DO_QUADRADO === 56, `a meia largura do quadrado é 56 m (veio ${MEIA_DO_QUADRADO})`)
  let dentro = 0
  for (let t = 0; t < g.indices.length; t += 3) {
    const bx = (g.posicoes[g.indices[t] * 3] + g.posicoes[g.indices[t + 1] * 3] + g.posicoes[g.indices[t + 2] * 3]) / 3
    const bz = (g.posicoes[g.indices[t] * 3 + 2] + g.posicoes[g.indices[t + 1] * 3 + 2] + g.posicoes[g.indices[t + 2] * 3 + 2]) / 3
    if (Math.abs(bx) < MEIA_DO_QUADRADO - 1e-9 && Math.abs(bz) < MEIA_DO_QUADRADO - 1e-9) dentro += 1
  }
  assert(dentro === 0, `nenhum triângulo do anel cobre o interior do quadrado (${dentro} cobrem): ali o chão é o do relevo`)

  // (3) A EMENDA: o anel TOCA o quadrado na borda (|x| = 56 ou |z| = 56) e os vértices da borda têm a altura do mundo PURO naquele ponto (|Δ| ≤ 1e-4, em Float32). É o que fecha o vão entre o terreno e o horizonte.
  let naBorda = 0
  let pior = 0
  for (let v = 0; v < nVert; v += 1) {
    const x = g.posicoes[v * 3]
    const z = g.posicoes[v * 3 + 2]
    const noBorda = (Math.abs(Math.abs(x) - MEIA_DO_QUADRADO) < 1e-6 && Math.abs(z) <= MEIA_DO_QUADRADO + 1e-6) || (Math.abs(Math.abs(z) - MEIA_DO_QUADRADO) < 1e-6 && Math.abs(x) <= MEIA_DO_QUADRADO + 1e-6)
    if (!noBorda) continue
    naBorda += 1
    pior = Math.max(pior, Math.abs(g.posicoes[v * 3 + 1] - Math.fround(altura(x, z))))
  }
  assert(naBorda >= 4 * 14, `CONTROLE: o anel tem vértices na borda do quadrado nos 4 lados (${naBorda} ≥ 56)`)
  assert(pior <= 1e-4, `os vértices do anel na borda do quadrado têm a altura do mundo puro (pior ${pior.toExponential(2)} m ≤ 1e-4): a emenda não abre vão`)

  // (4) TODO TRIÂNGULO voltado para CIMA (o teste de `geometriaDoTerreno`/`geometriaDaAgua`) e nenhum NaN, com os QUATRO passos da primeira fileira: com o passo 8 ela não usa o leque, e o leque é onde o sentido do giro depende do
  // lado (medido: sem a correção de sentido saem para BAIXO 84 / 140 / 252 triângulos com o passo 4 / 2 / 1, todos nos lados oeste e sul; o mutante F9 sobrevivia porque este contrato só rodava com o passo 8).
  for (const passoDaBorda of [8, 4, 2, 1] as const) {
    const ga = geometriaDoHorizonte(altura, { i: 0, j: 0 }, passoDaBorda)
    let virados = 0
    for (let t = 0; t < ga.indices.length; t += 3) {
      const a = ga.indices[t] * 3
      const b = ga.indices[t + 1] * 3
      const c = ga.indices[t + 2] * 3
      const ny = (ga.posicoes[b + 2] - ga.posicoes[a + 2]) * (ga.posicoes[c] - ga.posicoes[a]) - (ga.posicoes[b] - ga.posicoes[a]) * (ga.posicoes[c + 2] - ga.posicoes[a + 2])
      if (ny <= 0) virados += 1
    }
    assert(virados === 0, `todo triângulo do anel (primeira fileira a ${passoDaBorda} m) está voltado para CIMA (${virados} viram para baixo)`)
  }
  assert(Array.from(g.posicoes).every(Number.isFinite) && Array.from(g.uvs).every(Number.isFinite), 'nenhum NaN nem Infinity na geometria')

  // (5) O ALCANCE: o anel vai de 56 m até 104 m do centro nos 4 lados (|x| ou |z| máximo = 104)
  let maxX = 0
  let maxZ = 0
  for (let v = 0; v < nVert; v += 1) {
    maxX = Math.max(maxX, Math.abs(g.posicoes[v * 3]))
    maxZ = Math.max(maxZ, Math.abs(g.posicoes[v * 3 + 2]))
  }
  assert(maxX === 104 && maxZ === 104, `o anel alcança 104 m do centro (veio x ${maxX}, z ${maxZ})`)

  // (6) AS COORDENADAS SÃO LOCAIS AO QUADRADO e a altura é a do ponto GLOBAL: para o quadrado (3, 0) o vértice local (60, 0) é o ponto global (3·112 + 60, 0), e a altura bate com ele
  const g3 = geometriaDoHorizonte(altura, { i: 3, j: 0 })
  let achou = false
  for (let v = 0; v < g3.posicoes.length / 3; v += 1) {
    if (g3.posicoes[v * 3] === 64 && g3.posicoes[v * 3 + 2] === 0) {
      achou = true
      assert(Math.abs(g3.posicoes[v * 3 + 1] - Math.fround(altura(3 * 112 + 64, 0))) <= 1e-4, `a altura do vértice local (64, 0) do quadrado (3, 0) é a do ponto GLOBAL (${3 * 112 + 64}, 0): ${altura(3 * 112 + 64, 0)} (veio ${g3.posicoes[v * 3 + 1]})`)
    }
  }
  assert(achou, 'o vértice local (64, 0) existe no anel do quadrado (3, 0) (a grade tem passo 8 a partir de −104)')

  // (7) A COR DA DISTÂNCIA (perspectiva atmosférica): `uvs.x` guarda a DISTÂNCIA à borda do quadrado normalizada (0 na borda, 1 a 48 m dela) para o shader misturar a cor do horizonte; cresce com a distância
  let borda0 = 1e9
  let longe1 = -1e9
  for (let v = 0; v < nVert; v += 1) {
    const d = Math.max(Math.abs(g.posicoes[v * 3]), Math.abs(g.posicoes[v * 3 + 2])) - MEIA_DO_QUADRADO
    if (d < 1e-6) borda0 = Math.min(borda0, g.uvs[v * 2])
    if (Math.abs(d - 48) < 1e-6) longe1 = Math.max(longe1, g.uvs[v * 2])
  }
  assert(Math.abs(borda0) < 1e-6 && Math.abs(longe1 - 1) < 1e-6, `uv.x é a distância normalizada à borda (0 na borda, 1 a 48 m): veio ${borda0} e ${longe1}`)

  // (8) A EMENDA ENTRE OS VÉRTICES (medido em `.superpowers/agua/fechar-o-vao-do-horizonte-2.mjs`): o contrato do plano «|Δ| ≤ 1e-4» só vale NOS VÉRTICES; entre dois vértices do anel (8 m) o terreno ondula a cada 1 m e o anel é uma RETA:
  // vão médio 1–2,4 cm e até 27 cm. O vão é EXATAMENTE 0 quando o passo da primeira fileira do anel é igual ao passo da MALHA que o GPU desenha (1 m Ultra, 2 m Bonito, 4 m Leve) e volta a 5–15 cm nos outros casos: o horizonte segue
  // a malha da qualidade em uso (a mesma lição de `chaoDaMalha`). O teste monta o terreno com a função de altura SINTÉTICA do mundo puro, na malha linear por partes (a→c→b, b→c→d) de cada passo, e mede o vão em 4 bordas.
  // A altura do contrato da borda é ÁSPERA (ondula a cada ~3 m e a cada ~5 m): o relevo de teste do começo é suave demais (o vão com o passo errado dava 1 mm, e o controle negativo não separava nada); o real tem 5–15 cm.
  const aspera = (X: number, Z: number): number => altura(X, Z) + 0.35 * Math.sin(X * 2.1) * Math.cos(Z * 1.7) + 0.2 * Math.sin(X * 1.3 + Z * 0.9)
  const malhaDoTerreno = (passo: number, x: number, z: number): number => {
    const gx = Math.floor((x + MEIA_DO_QUADRADO) / passo)
    const gz = Math.floor((z + MEIA_DO_QUADRADO) / passo)
    const x0 = -MEIA_DO_QUADRADO + gx * passo
    const z0 = -MEIA_DO_QUADRADO + gz * passo
    const fx = (x - x0) / passo
    const fz = (z - z0) / passo
    const a = aspera(x0, z0)
    const b = aspera(x0 + passo, z0)
    const c = aspera(x0, z0 + passo)
    const d = aspera(x0 + passo, z0 + passo)
    return fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz)
  }
  const vaoDaBorda = (passoDaMalha: 1 | 2 | 4, passoDoAnel: 1 | 2 | 4): number => {
    const ge = geometriaDoHorizonte(aspera, { i: 0, j: 0 }, passoDoAnel)
    // a primeira fileira: vértices sobre as 4 bordas; a altura do ANEL num ponto da borda é a RETA entre os dois vértices vizinhos da borda
    const porBorda = new Map<string, number>()
    for (let v = 0; v < ge.posicoes.length / 3; v += 1) {
      const x = ge.posicoes[v * 3]
      const z = ge.posicoes[v * 3 + 2]
      if (Math.abs(Math.abs(x) - MEIA_DO_QUADRADO) < 1e-6 && Math.abs(z) <= MEIA_DO_QUADRADO + 1e-6) porBorda.set(`${x},${z}`, ge.posicoes[v * 3 + 1])
      if (Math.abs(Math.abs(z) - MEIA_DO_QUADRADO) < 1e-6 && Math.abs(x) <= MEIA_DO_QUADRADO + 1e-6) porBorda.set(`${x},${z}`, ge.posicoes[v * 3 + 1])
    }
    let pior = 0
    for (const lado of ['L', 'O', 'N', 'S'] as const) {
      for (let t = -MEIA_DO_QUADRADO; t < MEIA_DO_QUADRADO; t += 0.5) {
        const base = Math.floor((t + MEIA_DO_QUADRADO) / passoDoAnel) * passoDoAnel - MEIA_DO_QUADRADO
        const f = (t - base) / passoDoAnel
        const ponto = (u: number): [number, number] => (lado === 'L' ? [MEIA_DO_QUADRADO, u] : lado === 'O' ? [-MEIA_DO_QUADRADO, u] : lado === 'N' ? [u, -MEIA_DO_QUADRADO] : [u, MEIA_DO_QUADRADO])
        const [x0, z0] = ponto(base)
        const [x1, z1] = ponto(base + passoDoAnel)
        const h0 = porBorda.get(`${x0},${z0}`)
        const h1 = porBorda.get(`${x1},${z1}`)
        assert(h0 !== undefined && h1 !== undefined, `o anel tem o vértice da borda (${x0}, ${z0}) e (${x1}, ${z1}) com o passo ${passoDoAnel}`)
        const [x, z] = ponto(t)
        pior = Math.max(pior, Math.abs(h0 * (1 - f) + h1 * f - malhaDoTerreno(passoDaMalha, x, z)))
      }
    }
    return pior
  }
  for (const passo of [1, 2, 4] as const) assert(vaoDaBorda(passo, passo) <= 1e-4, `com o passo da primeira fileira IGUAL ao da malha (${passo} m) a emenda não abre vão: |Δ| ≤ 1e-4 nas 4 bordas (veio ${vaoDaBorda(passo, passo).toExponential(2)})`)
  // CONTROLE NEGATIVO: o passo ERRADO abre vão (o anel de 4 m contra a malha de 1 m; o de 1 m contra a de 4 m): o instrumento enxerga
  assert(vaoDaBorda(1, 4) > 0.02 && vaoDaBorda(4, 1) > 0.02, `CONTROLE: o passo errado abre vão (4 m contra 1 m: ${vaoDaBorda(1, 4).toFixed(3)} m; 1 m contra 4 m: ${vaoDaBorda(4, 1).toFixed(3)} m)`)

  // (9) O CUSTO por qualidade, MEDIDO na implementação (o rascunho previa 1.072 / 1.296 / 1.744 supondo 2 triângulos por célula fina; o leque da primeira fileira usa `8/p + 1` por célula): o anel de 8 m tem 960 triângulos;
  // com a primeira fileira a 4 / 2 / 1 m são 1.016 (Leve), 1.128 (Bonito) e 1.352 (Ultra): OS TRÊS ficam abaixo do teto de 1.500 do plano, o Ultra inclusive.
  const custo = (passo: 1 | 2 | 4 | 8): number => geometriaDoHorizonte(altura, { i: 0, j: 0 }, passo).indices.length / 3
  assert(custo(8) === 960 && custo(4) === 1016 && custo(2) === 1128 && custo(1) === 1352, `o anel custa 960 (passo 8), 1.016 (Leve), 1.128 (Bonito) e 1.352 (Ultra) triângulos (veio ${custo(8)}, ${custo(4)}, ${custo(2)}, ${custo(1)})`)
  assert(custo(1) <= 1500, 'os TRÊS passos respeitam o teto de 1.500 triângulos do plano (o Ultra, o mais caro, inclusive)')

  // (10) SEM T-JUNÇÃO: subdividir só a primeira fileira deixaria vértices PENDURADOS na linha a 8 m da borda (a célula fina tem 2 vértices ali, a de 8 m vizinha também, mas a diagonal e a posição dos vértices da fileira de fora
  // não coincidem com os da fina): uma rachadura de 1 pixel onde o fundo aparece. A prova é topológica: TODA aresta de triângulo é compartilhada por exatamente 2 triângulos, exceto as do CONTORNO (a borda do quadrado, na linha
  // |x| ou |z| = 56, e o limite externo em 104 m): aresta compartilhada por 1 triângulo no MEIO do anel é uma T-junção. E nenhum vértice cai SOBRE o meio de uma aresta de outro triângulo (a T-junção clássica).
  for (const passo of [8, 4, 2, 1] as const) {
    const ge = geometriaDoHorizonte(altura, { i: 0, j: 0 }, passo)
    const arestas = new Map<string, number>()
    const chave = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`)
    for (let t = 0; t < ge.indices.length; t += 3) {
      for (const [p, q] of [[0, 1], [1, 2], [2, 0]] as const) {
        const k = chave(ge.indices[t + p], ge.indices[t + q])
        arestas.set(k, (arestas.get(k) ?? 0) + 1)
      }
    }
    let internasAbertas = 0
    for (const [k, vezes] of arestas) {
      if (vezes === 2) continue
      // uma aresta de UM triângulo só é aceitável no CONTORNO: toda sobre a borda do quadrado (|x| ou |z| = 56) ou sobre o limite externo (|x| ou |z| = 104)
      const [a, b] = k.split('-').map(Number)
      const sobre = (v: number, c: number): boolean => Math.abs(Math.abs(ge.posicoes[v * 3]) - c) < 1e-6 || Math.abs(Math.abs(ge.posicoes[v * 3 + 2]) - c) < 1e-6
      const noContorno = (sobre(a, MEIA_DO_QUADRADO) && sobre(b, MEIA_DO_QUADRADO) && ((Math.abs(ge.posicoes[a * 3]) === MEIA_DO_QUADRADO && Math.abs(ge.posicoes[b * 3]) === MEIA_DO_QUADRADO && ge.posicoes[a * 3] === ge.posicoes[b * 3]) || (Math.abs(ge.posicoes[a * 3 + 2]) === MEIA_DO_QUADRADO && Math.abs(ge.posicoes[b * 3 + 2]) === MEIA_DO_QUADRADO && ge.posicoes[a * 3 + 2] === ge.posicoes[b * 3 + 2]))) || (sobre(a, RAIO_DO_HORIZONTE) && sobre(b, RAIO_DO_HORIZONTE))
      if (!noContorno) internasAbertas += 1
    }
    assert(internasAbertas === 0, `o anel com a primeira fileira a ${passo} m é uma malha FECHADA no meio: nenhuma aresta de um triângulo só fora do contorno (${internasAbertas} T-junções)`)
  }
}
