import { alturaEm, LADO_RELEVO, MEIA_RELEVO, type CampoRelevo } from './campoRelevo'
import { gerarRelevo } from './geradorRelevo'
import { geometriaDoTerreno, passoDaMalha, saiaDoTerreno } from './geometriaDoTerreno'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Um campo com um morro e um vale CONHECIDOS (independentes do gerador): serve para provar que a malha LÊ o campo e que as normais apontam para o lado certo. */
function campoMorroEVale(): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) {
      const morro = Math.max(0, 3 - Math.hypot(gx - 20, gz - 10) / 4)
      const vale = Math.max(0, 2 - Math.hypot(gx + 25, gz + 15) / 5)
      alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = morro - vale
    }
  }
  return { i: 0, j: 0, alturas, nivelAgua: -0.4, versao: 1 }
}

/**
 * A MALHA DO TERRENO (F2, Task 3, 25/11/2026): funções PURAS que transformam o campo de relevo em geometria. O contrato mais caro de errar é «o chão que se vê é o chão do campo»: se a malha mentir
 * numa altura, o clique, as obras e os props (que leem `alturaEm`) discordam do que está na tela e o herói parece afundado ou flutuando. Por isso o teste lê CADA vértice contra `alturaEm`.
 * Os três passos (4 m no Leve, 2 m no Bonito, 1 m no Ultra) dividem 112 igualmente, então a borda de ±56 m é sempre um vértice e a emenda entre quadrados vizinhos fecha.
 */
export function run(): void {
  const campo = campoMorroEVale()

  // passoDaMalha: a tabela do plano (Leve 4 m, Bonito 2 m, Ultra 1 m)
  assert(passoDaMalha('leve') === 4 && passoDaMalha('bonito') === 2 && passoDaMalha('ultra') === 1, 'passoDaMalha: leve 4, bonito 2, ultra 1')
  for (const q of ['leve', 'bonito', 'ultra'] as const) assert(112 % passoDaMalha(q) === 0, `o passo de ${q} divide 112 (a borda de ±56 m tem de ser um vértice)`)

  for (const passo of [4, 2, 1]) {
    const g = geometriaDoTerreno(campo, passo)
    const n = 112 / passo // células por lado
    const nv = (n + 1) * (n + 1)

    // contagens exatas
    assert(g.posicoes.length === nv * 3, `passo ${passo}: ${nv} vértices (${g.posicoes.length / 3} veio)`)
    assert(g.normais.length === nv * 3, `passo ${passo}: uma normal por vértice`)
    assert(g.indices.length === 2 * n * n * 3, `passo ${passo}: ${2 * n * n} triângulos (${g.indices.length / 3} veio)`)

    // (1) CADA vértice é `alturaEm`: x e z na grade, y = a altura do campo
    for (let k = 0; k < nv; k += 1) {
      const x = g.posicoes[k * 3]
      const y = g.posicoes[k * 3 + 1]
      const z = g.posicoes[k * 3 + 2]
      assert(Math.abs(y - alturaEm(campo, x, z)) <= 1e-6, `passo ${passo}: o vértice ${k} em (${x}, ${z}) tem y=${y} e o campo diz ${alturaEm(campo, x, z)}`)
      assert(x >= -MEIA_RELEVO && x <= MEIA_RELEVO && z >= -MEIA_RELEVO && z <= MEIA_RELEVO, `passo ${passo}: o vértice ${k} está fora do quadrado`)
    }
    // os cantos são exatamente ±56 (a malha cobre o quadrado INTEIRO, sem sobra nem falta)
    assert(g.posicoes[0] === -MEIA_RELEVO && g.posicoes[2] === -MEIA_RELEVO, `passo ${passo}: o primeiro vértice é (−56, −56)`)
    assert(g.posicoes[(nv - 1) * 3] === MEIA_RELEVO && g.posicoes[(nv - 1) * 3 + 2] === MEIA_RELEVO, `passo ${passo}: o último vértice é (+56, +56)`)

    // (2) normais UNITÁRIAS e voltadas para CIMA (ny > 0), em todo vértice
    for (let k = 0; k < nv; k += 1) {
      const nx = g.normais[k * 3]
      const ny = g.normais[k * 3 + 1]
      const nz = g.normais[k * 3 + 2]
      assert(Math.abs(Math.hypot(nx, ny, nz) - 1) <= 1e-4, `passo ${passo}: a normal ${k} não é unitária (${Math.hypot(nx, ny, nz)})`)
      assert(ny > 0, `passo ${passo}: a normal ${k} aponta para baixo (ny=${ny}): o sol iluminaria o terreno ao contrário`)
    }

    // (3) índices válidos, sem triângulo degenerado, e TODO triângulo voltado para CIMA (a normal geométrica tem y > 0: com a ordem errada o chão some pelo backface culling)
    let triangulosDeCabecaParaBaixo = 0
    for (let t = 0; t < g.indices.length; t += 3) {
      const ia = g.indices[t]
      const ib = g.indices[t + 1]
      const ic = g.indices[t + 2]
      assert(ia < nv && ib < nv && ic < nv, `passo ${passo}: o triângulo ${t / 3} aponta para um vértice que não existe`)
      assert(ia !== ib && ib !== ic && ia !== ic, `passo ${passo}: o triângulo ${t / 3} é degenerado`)
      // A componente `y` de u × v é `uz·vx − ux·vz`: só o x e o z dos dois lados do triângulo entram (a altura dos vértices não muda para que lado a face aponta no plano).
      const ax = g.posicoes[ia * 3], az = g.posicoes[ia * 3 + 2]
      const ux = g.posicoes[ib * 3] - ax, uz = g.posicoes[ib * 3 + 2] - az
      const vx = g.posicoes[ic * 3] - ax, vz = g.posicoes[ic * 3 + 2] - az
      const ny = uz * vx - ux * vz
      if (ny <= 0) triangulosDeCabecaParaBaixo += 1
    }
    assert(triangulosDeCabecaParaBaixo === 0, `passo ${passo}: ${triangulosDeCabecaParaBaixo} triângulos estão com a ordem dos vértices invertida (o chão sumiria pelo backface culling)`)
  }

  // (4) a malha de passo 1 é EXATAMENTE o campo (113 × 113 vértices, um por nó); a de passo 2 e a de 4 são amostras DELE: um vértice da malha grossa coincide com o mesmo ponto da fina
  const fina = geometriaDoTerreno(campo, 1)
  const media = geometriaDoTerreno(campo, 2)
  const grossa = geometriaDoTerreno(campo, 4)
  const lado = (p: number): number => 112 / p + 1
  for (let gz = 0; gz < lado(2); gz += 1) {
    for (let gx = 0; gx < lado(2); gx += 1) {
      const kFina = (gz * 2) * lado(1) + gx * 2
      const kMedia = gz * lado(2) + gx
      assert(fina.posicoes[kFina * 3 + 1] === media.posicoes[kMedia * 3 + 1], `o vértice (${gx}, ${gz}) da malha de 2 m não coincide com o da de 1 m`)
    }
  }
  for (let gz = 0; gz < lado(4); gz += 1) {
    for (let gx = 0; gx < lado(4); gx += 1) {
      const kFina = (gz * 4) * lado(1) + gx * 4
      const kGrossa = gz * lado(4) + gx
      assert(fina.posicoes[kFina * 3 + 1] === grossa.posicoes[kGrossa * 3 + 1], `o vértice (${gx}, ${gz}) da malha de 4 m não coincide com o da de 1 m`)
    }
  }

  // (5) o morro e o vale conhecidos APARECEM: o pico passa de 2 m e o fundo passa de −1,5 m (a malha não é plana nem trocou o sinal)
  let pico = Number.NEGATIVE_INFINITY
  let fundo = Number.POSITIVE_INFINITY
  for (let k = 0; k < fina.posicoes.length / 3; k += 1) {
    pico = Math.max(pico, fina.posicoes[k * 3 + 1])
    fundo = Math.min(fundo, fina.posicoes[k * 3 + 1])
  }
  assert(pico > 2.5 && fundo < -1.5, `o morro (3 m) e o vale (−2 m) têm de aparecer na malha (pico ${pico.toFixed(2)}, fundo ${fundo.toFixed(2)})`)
  // e a normal de um vértice no FLANCO do morro tem de se inclinar PARA FORA dele (para longe do pico): na encosta oeste do morro (gx=14, gz=10) a normal aponta para −x
  const kFlanco = (10 + MEIA_RELEVO) * lado(1) + (14 + MEIA_RELEVO)
  assert(fina.normais[kFlanco * 3] < -0.05, `na encosta oeste do morro a normal tem de apontar para −x (veio nx=${fina.normais[kFlanco * 3].toFixed(3)})`)
  // Os QUATRO lados do morro (centro (20, 10), declive 0,25 em todo o flanco) e o vale. VALORES MEDIDOS em 25/11 (`.superpowers/mut/medir-normais-do-morro.mjs`): a normal aponta para FORA do morro nos
  // quatro lados, com |nx| ou |nz| = 0,2425 = 0,25/√(1+0,25²) e ny = 0,9701 = 1/√(1+0,25²). Sem os eixos z (sul e norte) um sinal trocado em `nz` passava: o sol iluminaria o terreno ao contrário no
  // eixo norte–sul (o mutante G16 de 25/11 sobreviveu a um teste que só olhava a encosta oeste).
  const normalEmXZ = (x: number, z: number): [number, number, number] => {
    const k = (z + MEIA_RELEVO) * lado(1) + (x + MEIA_RELEVO)
    return [fina.normais[k * 3], fina.normais[k * 3 + 1], fina.normais[k * 3 + 2]]
  }
  const perto = (a: number, b: number): boolean => Math.abs(a - b) < 1e-3
  const oeste = normalEmXZ(14, 10)
  const leste = normalEmXZ(26, 10)
  const sul = normalEmXZ(20, 4)
  const norte = normalEmXZ(20, 16)
  assert(perto(oeste[0], -0.2425) && perto(oeste[1], 0.9701) && perto(oeste[2], 0), `encosta oeste do morro: normal (−0,2425; 0,9701; 0), veio (${oeste.map((v) => v.toFixed(4)).join('; ')})`)
  assert(perto(leste[0], 0.2425) && perto(leste[1], 0.9701) && perto(leste[2], 0), `encosta leste do morro: normal (+0,2425; 0,9701; 0), veio (${leste.map((v) => v.toFixed(4)).join('; ')})`)
  assert(perto(sul[0], 0) && perto(sul[1], 0.9701) && perto(sul[2], -0.2425), `encosta SUL do morro (z menor): normal (0; 0,9701; −0,2425), veio (${sul.map((v) => v.toFixed(4)).join('; ')})`)
  assert(perto(norte[0], 0) && perto(norte[1], 0.9701) && perto(norte[2], 0.2425), `encosta NORTE do morro (z maior): normal (0; 0,9701; +0,2425), veio (${norte.map((v) => v.toFixed(4)).join('; ')})`)
  const topo = normalEmXZ(20, 10)
  assert(perto(topo[0], 0) && perto(topo[1], 1) && perto(topo[2], 0), `topo do morro: normal (0, 1, 0), veio (${topo.map((v) => v.toFixed(4)).join('; ')})`)
  // o VALE (centro (−25, −15)) é o espelho: do lado leste dele o terreno SOBE para o leste, então a normal aponta para o oeste (−x), para DENTRO do vale (medido: nx = −0,1961)
  const valeLeste = normalEmXZ(-19, -15)
  assert(valeLeste[0] < -0.15, `lado leste do vale: a normal aponta para dentro dele (−x); veio nx=${valeLeste[0].toFixed(4)}`)

  // (6) SEM EMENDA entre quadrados vizinhos: a coluna leste (x=+56) de (i,j) é igual à oeste (x=−56) de (i+1,j), e idem em z, para qualquer passo e para o gerador real (|Δ| ≤ 1e-4)
  for (const passo of [1, 2, 4]) {
    for (let i = -3; i <= 3; i += 1) {
      for (let j = -3; j <= 3; j += 1) {
        const aqui = geometriaDoTerreno(gerarRelevo(i, j), passo)
        const leste = geometriaDoTerreno(gerarRelevo(i + 1, j), passo)
        const norte = geometriaDoTerreno(gerarRelevo(i, j + 1), passo)
        const ll = lado(passo)
        for (let g = 0; g < ll; g += 1) {
          const dEmenda = Math.abs(aqui.posicoes[(g * ll + (ll - 1)) * 3 + 1] - leste.posicoes[(g * ll + 0) * 3 + 1])
          const nEmenda = Math.abs(aqui.posicoes[((ll - 1) * ll + g) * 3 + 1] - norte.posicoes[(0 * ll + g) * 3 + 1])
          assert(dEmenda <= 1e-4, `passo ${passo}: emenda LESTE de (${i},${j}) aberta em ${g}: ${dEmenda}`)
          assert(nEmenda <= 1e-4, `passo ${passo}: emenda NORTE de (${i},${j}) aberta em ${g}: ${nEmenda}`)
        }
      }
    }
  }

  // (6b) UV: o MESMO mapeamento do plano que o chão usa hoje. Medido no three real (`PlaneGeometry(112, 112)` com `rotation.x = −π/2`, `.superpowers/mut/uv-do-plano.mjs`, 25/11): o canto
  // (−56, −56) tem UV (0, 1); (+56, −56) tem (1, 1); (−56, +56) tem (0, 0); (+56, +56) tem (1, 0). Ou seja `u = (x + 56) / 112` e `v = 1 − (z + 56) / 112`. Sem isso o chão com relevo ficaria
  // ESPELHADO em relação ao de hoje e as lajes da estrada e da praça (desenhadas em cima) não bateriam com o solo. O oráculo é a tabela medida, não a fórmula.
  for (const passo of [1, 2, 4]) {
    const g = geometriaDoTerreno(campo, passo)
    const ll = lado(passo)
    const uvDoCanto = (gx: number, gz: number): [number, number] => [g.uvs[(gz * ll + gx) * 2], g.uvs[(gz * ll + gx) * 2 + 1]]
    const igual = (a: [number, number], b: [number, number]): boolean => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6
    assert(g.uvs.length === ll * ll * 2, `passo ${passo}: dois UVs por vértice`)
    assert(igual(uvDoCanto(0, 0), [0, 1]), `passo ${passo}: o canto (−56, −56) tem UV (0, 1) como o plano de hoje (veio ${uvDoCanto(0, 0)})`)
    assert(igual(uvDoCanto(ll - 1, 0), [1, 1]), `passo ${passo}: o canto (+56, −56) tem UV (1, 1) (veio ${uvDoCanto(ll - 1, 0)})`)
    assert(igual(uvDoCanto(0, ll - 1), [0, 0]), `passo ${passo}: o canto (−56, +56) tem UV (0, 0) (veio ${uvDoCanto(0, ll - 1)})`)
    assert(igual(uvDoCanto(ll - 1, ll - 1), [1, 0]), `passo ${passo}: o canto (+56, +56) tem UV (1, 0) (veio ${uvDoCanto(ll - 1, ll - 1)})`)
    // e o meio é linear em x e em z (u cresce com x, v DECRESCE com z): todo vértice segue u = (x+56)/112 e v = 1 − (z+56)/112
    for (let k = 0; k < ll * ll; k += 1) {
      const x = g.posicoes[k * 3]
      const z = g.posicoes[k * 3 + 2]
      assert(Math.abs(g.uvs[k * 2] - (x + 56) / 112) <= 1e-6 && Math.abs(g.uvs[k * 2 + 1] - (1 - (z + 56) / 112)) <= 1e-6, `passo ${passo}: o UV do vértice ${k} (${x}, ${z}) não segue u=(x+56)/112, v=1−(z+56)/112`)
    }
  }

  // (7) entradas inválidas: um passo que não divide 112 (ou ≤ 0, NaN) NÃO produz uma malha torta em silêncio
  // 112 = 2⁴ · 7: os divisores são 1, 2, 4, 7, 8, 14, 16, 28, 56, 112. Um passo que NÃO divide (3, 5, 6, 9, 10…) deixaria um vão na borda; um que divide (7, 8) é válido e NÃO pode lançar
  // (o teste distingue os dois lados: um `try` que lança sempre, ou nunca, falha aqui).
  // Os passos NÃO inteiros que o teste do resto (`112 % p === 0`) deixaria passar: 0,25 · 0,5 · 1,75 · 3,5 (calculado em 25/11). 0,25 daria 401.408 triângulos (mais que o teto do Ultra, 380 mil) e 0,5
  // daria 100.352, sem aviso: a malha é `1 | 2 | 4` por contrato, e só inteiros são válidos (o mutante G5 de 25/11 tirou `Number.isInteger` e sobreviveu).
  for (const ruim of [0, -1, 3, 5, 6, 9, 10, 1.5, 0.25, 0.5, 1.75, 3.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    let lancou = false
    try {
      geometriaDoTerreno(campo, ruim)
    } catch {
      lancou = true
    }
    assert(lancou, `um passo inválido (${ruim}) deve lançar erro, não devolver uma malha que não fecha o quadrado`)
  }
  for (const bom of [1, 2, 4, 7, 8, 14, 16, 28, 56, 112]) {
    const g = geometriaDoTerreno(campo, bom)
    const n = 112 / bom
    assert(g.indices.length === 6 * n * n && g.posicoes.length === 3 * (n + 1) * (n + 1), `um passo que divide 112 (${bom}) deve produzir uma malha de ${2 * n * n} triângulos`)
  }
  // e um campo plano dá uma malha plana com normais exatamente (0, 1, 0)
  const plano = geometriaDoTerreno({ i: 0, j: 0, alturas: new Float32Array(LADO_RELEVO * LADO_RELEVO), nivelAgua: -0.4, versao: 1 }, 4)
  for (let k = 0; k < plano.posicoes.length / 3; k += 1) {
    assert(plano.posicoes[k * 3 + 1] === 0, 'campo plano: todo vértice em y = 0')
    assert(plano.normais[k * 3] === 0 && plano.normais[k * 3 + 1] === 1 && plano.normais[k * 3 + 2] === 0, 'campo plano: normal exatamente (0, 1, 0)')
  }

  // (8) A SAIA fecha o vão entre a quina do terreno e o plano da névoa (o «fio azul», 25/11). O terreno é uma folha SEM espessura e o furo do plano da névoa (a −0,12 m) deixa passar o raio da
  // câmera do Império, que desce para FORA do quadrado por cima da quina e vê o céu. A saia é uma parede em cada aresta, da quina até `yTopo`, olhando PARA FORA. Medido com a câmera real: quina
  // em 0 m e sem saia 7/7/8 px de fio; com a saia até o plano, 0/0/0; com uma saia CURTA (até −0,30) ainda 4/4/5. O TOPO é o que se trava.
  for (const passo of [4, 2, 1]) {
    const n = 112 / passo
    const yTopo = 0.33 // o plano da névoa em coordenadas LOCAIS do terreno (o terreno fica em Y_SOLO_VISUAL e o plano a +0,33 dele)
    const saia = saiaDoTerreno(campo, passo, yTopo)
    // quatro paredes de n células, 2 triângulos por célula
    assert(saia.indices.length === 4 * n * 2 * 3, `passo ${passo}: a saia tem ${4 * n * 2} triângulos (${saia.indices.length / 3} veio)`)
    assert(saia.posicoes.length === 4 * (n + 1) * 2 * 3, `passo ${passo}: a saia tem ${4 * (n + 1) * 2} vértices (${saia.posicoes.length / 3} veio)`)
    // o topo de TODA a parede é yTopo e a base de cada coluna é a quina do terreno (alturaEm na aresta)
    let topos = 0
    let bases = 0
    for (let k = 0; k < saia.posicoes.length / 3; k += 1) {
      const x = saia.posicoes[k * 3]
      const y = saia.posicoes[k * 3 + 1]
      const z = saia.posicoes[k * 3 + 2]
      const naAresta = Math.abs(Math.abs(x) - MEIA_RELEVO) < 1e-9 || Math.abs(Math.abs(z) - MEIA_RELEVO) < 1e-9
      assert(naAresta, `passo ${passo}: o vértice ${k} da saia (${x}, ${z}) não está numa aresta do quadrado`)
      if (Math.abs(y - yTopo) <= 1e-6) topos += 1
      else {
        assert(Math.abs(y - alturaEm(campo, x, z)) <= 1e-6, `passo ${passo}: a base da saia em (${x}, ${z}) tem de ser a quina do terreno (${alturaEm(campo, x, z)}), veio ${y}`)
        bases += 1
      }
    }
    assert(topos === 4 * (n + 1) && bases === 4 * (n + 1), `passo ${passo}: metade dos vértices da saia está no topo (${topos}) e metade na quina (${bases}); esperado ${4 * (n + 1)} de cada`)
    // índices válidos e sem triângulo degenerado
    for (let t = 0; t < saia.indices.length; t += 3) {
      const ia = saia.indices[t]
      const ib = saia.indices[t + 1]
      const ic = saia.indices[t + 2]
      assert(ia < saia.posicoes.length / 3 && ib < saia.posicoes.length / 3 && ic < saia.posicoes.length / 3, `passo ${passo}: o triângulo ${t / 3} da saia aponta para um vértice que não existe`)
      assert(ia !== ib && ib !== ic && ia !== ic, `passo ${passo}: o triângulo ${t / 3} da saia é degenerado`)
    }
  }
  // A SAIA OLHA PARA DENTRO do quadrado (corrigido em 25/11: a 1ª versão a voltava para FORA e o teste passou de primeira, sem nunca ter sido provado capaz de falhar). Quem a vê está DENTRO do
  // quadrado: a câmera do Império fica em (0, 34, 42) e a do corpo no chão. Com a frente para fora o backface culling a descarta e o FUNDO da cena aparece (o fio azul). Dois critérios:
  // (1) o REAL, o que o jogador vê: a câmera do Império enxerga a frente de TODOS os triângulos (`normal · (câmera − centro) > 0`), nas 4 arestas; (2) o geométrico: a normal aponta para o centro.
  // A câmera em coordenadas LOCAIS do terreno: o terreno fica em Y_SOLO_VISUAL (−0,45), então y local = y do mundo + 0,45.
  const camera = [0, 34 + 0.45, 42] as const
  const orientacaoDaSaia = (saiaX: { posicoes: Float32Array; indices: Uint32Array }): { voltadosParaACamera: number; paraDentro: number; total: number } => {
    let voltadosParaACamera = 0
    let paraDentro = 0
    let total = 0
    for (let t = 0; t < saiaX.indices.length; t += 3) {
      const i0 = saiaX.indices[t] * 3
      const i1 = saiaX.indices[t + 1] * 3
      const i2 = saiaX.indices[t + 2] * 3
      const ux = saiaX.posicoes[i1] - saiaX.posicoes[i0]
      const uy = saiaX.posicoes[i1 + 1] - saiaX.posicoes[i0 + 1]
      const uz = saiaX.posicoes[i1 + 2] - saiaX.posicoes[i0 + 2]
      const vx = saiaX.posicoes[i2] - saiaX.posicoes[i0]
      const vy = saiaX.posicoes[i2 + 1] - saiaX.posicoes[i0 + 1]
      const vz = saiaX.posicoes[i2 + 2] - saiaX.posicoes[i0 + 2]
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      const cx = (saiaX.posicoes[i0] + saiaX.posicoes[i1] + saiaX.posicoes[i2]) / 3
      const cy = (saiaX.posicoes[i0 + 1] + saiaX.posicoes[i1 + 1] + saiaX.posicoes[i2 + 1]) / 3
      const cz = (saiaX.posicoes[i0 + 2] + saiaX.posicoes[i1 + 2] + saiaX.posicoes[i2 + 2]) / 3
      // um triângulo de ÁREA ZERO (parede de altura zero, onde a quina passa do topo) não tem normal: não conta nem a favor nem contra
      if (Math.hypot(nx, ny, nz) < 1e-9) continue
      total += 1
      if (nx * (camera[0] - cx) + ny * (camera[1] - cy) + nz * (camera[2] - cz) > 0) voltadosParaACamera += 1
      // o produto escalar da normal com o vetor do triângulo ao centro do quadrado: positivo = para dentro
      if (nx * -cx + nz * -cz > 0) paraDentro += 1
    }
    return { voltadosParaACamera, paraDentro, total }
  }
  {
    const o = orientacaoDaSaia(saiaDoTerreno(campo, 4, 0.33))
    assert(o.total === 4 * 28 * 2, `a saia de passo 4 tem ${4 * 28 * 2} triângulos (${o.total} veio)`)
    assert(o.voltadosParaACamera === o.total, `a câmera do Império vê a FRENTE de TODOS os triângulos da saia (${o.voltadosParaACamera} de ${o.total}): os de costas são descartados pelo backface culling e o fundo da cena aparece (o fio azul)`)
    assert(o.paraDentro === o.total, `a normal de cada triângulo da saia aponta para o CENTRO do quadrado (${o.paraDentro} de ${o.total})`)
    // CONTROLE do instrumento (senão «todos voltados» podia ser um medidor que devolve sempre o total): a MESMA saia com a ordem dos vértices INVERTIDA tem de ter 0 voltados e 0 para dentro.
    const real = saiaDoTerreno(campo, 4, 0.33)
    const invertida = { posicoes: real.posicoes, indices: Uint32Array.from(real.indices, (_, k) => real.indices[k - (k % 3) + (2 - (k % 3))]) }
    const oInv = orientacaoDaSaia(invertida)
    assert(oInv.voltadosParaACamera === 0 && oInv.paraDentro === 0, `controle do instrumento: com a ordem invertida a câmera não vê NENHUM triângulo (${oInv.voltadosParaACamera} de ${oInv.total}) e nenhum aponta para dentro (${oInv.paraDentro})`)
  }
  // a saia é vista de DENTRO em qualquer quadrado (não só o de teste): o mesmo critério com o gerador real, em passos diferentes
  for (const [qi, qj] of [[0, 0], [-2, 1], [-1, 2], [0, 2]] as const) {
    for (const passo of [1, 2, 4]) {
      const o = orientacaoDaSaia(saiaDoTerreno(gerarRelevo(qi, qj), passo, 0.33))
      assert(o.voltadosParaACamera === o.total && o.paraDentro === o.total, `a saia de (${qi},${qj}) com passo ${passo} olha para dentro (${o.voltadosParaACamera} voltados e ${o.paraDentro} para dentro de ${o.total})`)
    }
  }
  // A BASE é a quina REAL, não 0 (o campo de teste acima tem as 452 quinas em 0 e não distingue as duas coisas: uma saia que ignorasse `alturaEm` passaria). O GERADOR real tem relevo na borda:
  // medido em 25/11, a quina vai de 0 a 0,79 m. A base de cada coluna é `min(alturaEm na aresta, topo)`: onde a quina passa do topo (de 3 a 30 das 452 colunas, até 0,46 m acima) o terreno JÁ cobre o
  // plano da névoa e a parede tem altura ZERO (com `base = quina` a altura ficava NEGATIVA e a normal invertia: 4 de 896 triângulos de costas na clareira, passo 1). E ao menos uma quina tem de ser
  // > 0,2 e ao menos uma > 0,33 (senão o teste volta a ser cego para o caso que importa).
  {
    const topoReal = 0.33
    let quinaMaior = 0
    let quinasAcimaDoTopo = 0
    for (const [qi, qj] of [[-2, 1], [0, 2], [-1, 2]] as const) {
      const real = gerarRelevo(qi, qj)
      const saiaReal = saiaDoTerreno(real, 2, topoReal)
      for (let k = 0; k < saiaReal.posicoes.length / 3; k += 1) {
        const x = saiaReal.posicoes[k * 3]
        const y = saiaReal.posicoes[k * 3 + 1]
        const z = saiaReal.posicoes[k * 3 + 2]
        const quina = alturaEm(real, x, z)
        if (quina > topoReal + 1e-6) quinasAcimaDoTopo += 1
        // cada vértice é o topo OU a base `min(quina, topo)`; nunca passa do topo
        assert(y <= topoReal + 1e-6, `o vértice ${k} da saia de (${qi},${qj}) não passa do topo (${y})`)
        assert(Math.abs(y - topoReal) <= 1e-6 || Math.abs(y - Math.min(quina, topoReal)) <= 1e-6, `a base da saia de (${qi},${qj}) em (${x}, ${z}) tem de ser min(quina ${quina}, topo ${topoReal}), veio ${y}`)
        if (Math.abs(y - topoReal) > 1e-6) quinaMaior = Math.max(quinaMaior, y)
      }
    }
    assert(quinaMaior > 0.2, `controle do instrumento: os quadrados reais têm quina acima de 0,2 m em alguma aresta (maior ${quinaMaior.toFixed(3)}); sem isso o teste da base é cego`)
    assert(quinasAcimaDoTopo > 0, `controle do instrumento: há quinas ACIMA do topo nos quadrados reais (${quinasAcimaDoTopo}); sem elas o caso do min é letra morta`)
  }
  // O CASO EXTREMO: um morro de 0,9 m colado na aresta oeste (z de −10 a 10). Nas 21 colunas altas a base e o topo coincidem (parede de altura zero) e a orientação dos demais triângulos não muda.
  {
    const alturasAltas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
    for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
      for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) {
        alturasAltas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = gx <= -MEIA_RELEVO + 2 && Math.abs(gz) <= 10 ? 0.9 : 0
      }
    }
    const campoAlto: CampoRelevo = { i: 0, j: 0, alturas: alturasAltas, nivelAgua: -0.4, versao: 1 }
    const topo = 0.33
    const sAlta = saiaDoTerreno(campoAlto, 1, topo)
    assert(alturaEm(campoAlto, -MEIA_RELEVO, 0) > topo + 0.5, `controle do instrumento: a quina oeste em z = 0 está bem ACIMA do topo (${alturaEm(campoAlto, -MEIA_RELEVO, 0)} contra ${topo})`)
    let noTopo = 0
    for (let k = 0; k < sAlta.posicoes.length / 3; k += 1) {
      assert(sAlta.posicoes[k * 3 + 1] <= topo + 1e-6, `nenhum vértice da saia passa do topo (${topo}): o vértice ${k} está em y = ${sAlta.posicoes[k * 3 + 1]}`)
      if (Math.abs(sAlta.posicoes[k * 3] + MEIA_RELEVO) < 1e-9 && Math.abs(sAlta.posicoes[k * 3 + 2]) <= 10 && Math.abs(sAlta.posicoes[k * 3 + 1] - topo) <= 1e-6) noTopo += 1
    }
    // nas 21 colunas altas a base E o topo estão em y = topo: 2 vértices por coluna no topo = 42
    assert(noTopo === 42, `nas 21 colunas altas da aresta oeste a base e o topo coincidem em y = ${topo} (${noTopo} vértices no topo, esperado 42)`)
    const o = orientacaoDaSaia(sAlta)
    assert(o.total > 0 && o.voltadosParaACamera === o.total && o.paraDentro === o.total, `com quinas ALTAS a saia ainda olha para dentro (${o.voltadosParaACamera} voltados e ${o.paraDentro} para dentro de ${o.total} triângulos de área > 0)`)
    // MEDIDO (`medir-area-zero.mjs`): 42 triângulos de área zero, todos na aresta oeste. A conta: 21 colunas com base = topo formam 20 células × 2 = 40, mais 1 triângulo em cada uma das 2 bordas do
    // morro (a coluna alta vizinha tem base = topo e a outra, 0: um dos dois triângulos da célula tem os 3 vértices no mesmo y). 896 − 42 = 854.
    assert(o.total === 4 * 112 * 2 - (2 * 20 + 2), `os 42 triângulos de área zero saem da conta: ${4 * 112 * 2 - 42} de ${4 * 112 * 2} (veio ${o.total})`)
  }
  // o terreno em si NÃO mudou: a saia é um objeto à parte (a malha do relevo continua com 2·(112/passo)² triângulos e `alturaEm` em cada vértice, provado em (1) a (7))
  assert(geometriaDoTerreno(campo, 4).indices.length === 2 * 28 * 28 * 3, `a malha do chão continua com 2·28² triângulos: a saia não entra nela`)
  // (K12) POSIÇÃO ao longo da aresta: a coluna k fica em s = −56 + k·passo (um passo ignorado, sempre de 1 em 1, mantinha a CONTAGEM e mudava só onde os vértices caem). Cada aresta, cada passo.
  for (const passo of [1, 2, 4]) {
    const nn = 112 / passo
    const sp = saiaDoTerreno(campo, passo, 0.33)
    for (let a = 0; a < 4; a += 1) {
      for (let k = 0; k <= nn; k += 1) {
        const v = (a * (nn + 1) + k) * 2 // o vértice da BASE da coluna k da aresta a (o do topo é o seguinte)
        const x = sp.posicoes[v * 3]
        const z = sp.posicoes[v * 3 + 2]
        const ao = -MEIA_RELEVO + k * passo
        const esperado = a === 0 ? [-MEIA_RELEVO, ao] : a === 1 ? [MEIA_RELEVO, ao] : a === 2 ? [ao, -MEIA_RELEVO] : [ao, MEIA_RELEVO]
        assert(x === esperado[0] && z === esperado[1], `passo ${passo}: a coluna ${k} da aresta ${a} tem de estar em (${esperado[0]}, ${esperado[1]}), veio (${x}, ${z})`)
      }
    }
  }
  // (K15) COBERTURA: cada célula (um retângulo base A, topo A, base B, topo B) é coberta por 2 triângulos que juntos usam OS 4 vértices (um triângulo repetido deixaria um canto sem parede)
  {
    const sc = saiaDoTerreno(campo, 4, 0.33)
    for (let c = 0; c < sc.indices.length / 6; c += 1) {
      const usados = new Set<number>()
      for (let k = 0; k < 6; k += 1) usados.add(sc.indices[c * 6 + k])
      assert(usados.size === 4, `a célula ${c} da saia usa 4 vértices distintos (os 2 triângulos juntos cobrem o retângulo); usa ${usados.size}`)
    }
    assert(sc.indices.length / 6 === 4 * 28, `a saia de passo 4 tem ${4 * 28} células (${sc.indices.length / 6} veio)`)
  }
  // (K13, K14) PASSO INVÁLIDO: a saia lança como a malha (um passo que não divide 112 ou não é inteiro deixaria um vão na aresta). Os que dividem 112 NÃO podem lançar.
  for (const ruim of [0, -1, 3, 5, 6, 9, 10, 1.5, 0.25, 0.5, 1.75, 3.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    let lancou = false
    try {
      saiaDoTerreno(campo, ruim, 0.33)
    } catch {
      lancou = true
    }
    assert(lancou, `um passo inválido (${ruim}) deve lançar erro na saia, não devolver uma parede que não fecha a aresta`)
  }
  for (const bom of [1, 2, 4, 7, 8, 14, 16, 28, 56, 112]) {
    const sb = saiaDoTerreno(campo, bom, 0.33)
    assert(sb.indices.length === 4 * (112 / bom) * 6, `um passo que divide 112 (${bom}) produz a saia de ${4 * (112 / bom) * 2} triângulos`)
  }
  // CONTROLE do instrumento (o topo é o que o teste trava): pedindo outro topo (0,1) a saia muda DE VERDADE, e nenhum vértice sobra no 0,33 antigo. Sem isto o `yTopo` poderia ser ignorado em silêncio.
  {
    const curta = saiaDoTerreno(campo, 4, 0.1)
    let noNovoTopo = 0
    let noTopoAntigo = 0
    for (let k = 0; k < curta.posicoes.length / 3; k += 1) {
      const y = curta.posicoes[k * 3 + 1]
      if (Math.abs(y - 0.1) <= 1e-6) noNovoTopo += 1
      if (Math.abs(y - 0.33) <= 1e-6) noTopoAntigo += 1
    }
    assert(noNovoTopo >= 4 * 29 && noTopoAntigo === 0, `o topo pedido (0,1) vale para a saia inteira (${noNovoTopo} vértices no topo novo, ${noTopoAntigo} no antigo)`)
  }
}
