import { alturaVisualRecurso, Y_SOLO_VISUAL } from '../visual/suporteFundacao'
import { alturaEm, LADO_RELEVO, MEIA_RELEVO, type CampoRelevo } from './campoRelevo'
import { alturaDeReferencia, alturaVisualDoChao, desnivelDoChao } from './alturaVisual'
import { gerarRelevo } from './geradorRelevo'
import { chaoDaMalha, desnivelDaMalha } from './chaoDaMalha'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Gerador fixo (mulberry32): os pontos «aleatórios» do teste são REPRODUTÍVEIS. */
function semente(valor: number): () => number {
  let t = valor >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Um campo com uma colina conhecida: altura = 1,5 m no centro (0, 0) e 0 em volta. Serve para provar que a função LÊ o campo, sem depender do gerador. */
function campoComColina(): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) {
      const d = Math.hypot(gx, gz)
      alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = d < 10 ? 1.5 * (1 - d / 10) : 0
    }
  }
  return { i: 0, j: 0, alturas, nivelAgua: -0.4, versao: 1 }
}

/** Um campo cuja ALTURA DO CENTRO NÃO É ZERO: onde a entrada não finita, que `alturaEm` prende ao centro, daria uma altura que não é o plano. */
function campoComCentroAlto(): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO).fill(2)
  return { i: 3, j: -2, alturas, nivelAgua: -0.4, versao: 1 }
}

/**
 * A FONTE ÚNICA da altura do chão DESENHADO (F2, 24/11/2026). O chão do jogo era um plano em `Y_SOLO_VISUAL = −0,45`, repetido em dezenas de pontos de desenho (a maioria NÃO é o chão: as botas do herói
 * são offsets locais do corpo). Agora um ponto de desenho pergunta a UMA função «qual é a altura do chão aqui?». O contrato mais importante (I1, plano = hoje): sem campo, ou fora do alcance, devolve
 * EXATAMENTE `Y_SOLO_VISUAL`, o mesmo número de hoje, para o jogo não mudar de um pixel com a chave desligada.
 */
/**
 * TASK 4, degrau 1: `alturaVisualRecurso(yBase, desnivel = 0)` (25/11/2026). A fonte da altura das árvores e rochas de ouro (os maiores grupos de pontos de chão) ganha o DESNÍVEL do terreno no
 * ponto, um NÚMERO já calculado por quem chama (`alturaVisualDoChao(campo, x, z) − Y_SOLO_VISUAL`): a função não importa o campo, porque `suporteFundacao.ts` é importado por `alturaVisual.ts`
 * e um import de volta fecharia um ciclo. O segundo argumento é OPCIONAL e o padrão é 0: sem ele a função é exatamente a de hoje (I1).
 */
function contratoDaAlturaDoRecurso(): void {
  // (1) I1: a assinatura antiga é a MESMA de hoje, para a superfície e para o subsolo
  assert(alturaVisualRecurso(0) === Y_SOLO_VISUAL, 'sem desnível, um recurso da superfície fica em Y_SOLO_VISUAL (a assinatura antiga vale)')
  assert(alturaVisualRecurso(-3.2) === -3.2, 'sem desnível, um veio do subsolo mantém o yBase')
  assert(alturaVisualRecurso(0, 0) === Y_SOLO_VISUAL, 'desnível 0 é o mesmo que sem desnível')
  // (2) com o desnível a superfície sobe junto, em qualquer sinal (morro e vale)
  assert(Math.abs(alturaVisualRecurso(0, 1.25) - (Y_SOLO_VISUAL + 1.25)) < 1e-12, 'um recurso num morro de 1,25 m sobe 1,25 m')
  assert(Math.abs(alturaVisualRecurso(0, -2.5) - (Y_SOLO_VISUAL - 2.5)) < 1e-12, 'um recurso num vale de 2,5 m desce 2,5 m')
  // (3) o SUBSOLO ignora o desnível: a mina tem chão único e o terreno do ponto não a move
  assert(alturaVisualRecurso(-3.2, 1.25) === -3.2, 'um veio do subsolo IGNORA o desnível do terreno')
  assert(alturaVisualRecurso(-3.2, -2.5) === -3.2, 'um veio do subsolo IGNORA o desnível, também num vale')
  // a fronteira do subsolo é ESTRITA (a mesma regra do jogo): yBase = −0,9 exato é SUPERFÍCIE, −0,9000001 é subsolo
  assert(Math.abs(alturaVisualRecurso(-0.9, 1) - (Y_SOLO_VISUAL + 1)) < 1e-12, 'yBase = −0,9 exato é superfície: o desnível entra')
  assert(alturaVisualRecurso(-0.9000001, 1) === -0.9000001, 'yBase = −0,9000001 é subsolo: o desnível NÃO entra')
  // (4) um desnível que não é número finito NÃO eleva (a posição corrompida de um recurso não pode lançá-lo ao céu)
  assert(alturaVisualRecurso(0, Number.NaN) === Y_SOLO_VISUAL, 'desnível NaN devolve o chão de hoje')
  assert(alturaVisualRecurso(0, Number.POSITIVE_INFINITY) === Y_SOLO_VISUAL, 'desnível infinito devolve o chão de hoje')
  assert(alturaVisualRecurso(0, Number.NEGATIVE_INFINITY) === Y_SOLO_VISUAL, 'desnível −infinito devolve o chão de hoje')
  // o controle do instrumento: a MESMA conta feita pelo campo, num ponto do colina de teste, dá o desnível esperado e o recurso fica na altura do chão desenhado
  const colina = campoComColina()
  const desnivelNaColina = alturaVisualDoChao(colina, 0, 0) - Y_SOLO_VISUAL
  assert(desnivelNaColina > 1.4, `(controle do teste) o colina de teste tem desnível no centro (${desnivelNaColina.toFixed(3)} m)`)
  assert(Math.abs(alturaVisualRecurso(0, desnivelNaColina) - alturaVisualDoChao(colina, 0, 0)) < 1e-12, 'a altura do recurso é a do chão desenhado no ponto: o recurso PISA no terreno')
}

/**
 * A COMPOSIÇÃO que `PropsBiomaInstanced` faz: `alturaVisualRecurso(yBase, alturaVisualDoChao(campo, x, z) − Y_SOLO_VISUAL)`, num campo REAL (o gerador) e em pontos de VALE e de MORRO. O contrato de
 * texto do componente prova a FORMA das linhas; aqui se prova o NÚMERO: o recurso pousa no chão DESENHADO (nem 0,45 acima, o `Y_SOLO_VISUAL` dobrado, nem com x e z trocados) e, sem campo, é o de hoje.
 */
function contratoDaComposicaoDoRecurso(): void {
  const desnivel = (campo: CampoRelevo | undefined, x: number, z: number): number => (campo ? alturaVisualDoChao(campo, x, z) - Y_SOLO_VISUAL : 0)
  let pontos = 0
  let emVale = 0
  let emMorro = 0
  let maiorDif = 0
  let trocaMudaAlgo = 0
  for (const [qi, qj] of [[0, 0], [-1, -1], [-2, 1], [-1, 2], [0, 2], [-1, 1]] as const) {
    const campo = gerarRelevo(qi, qj)
    for (let gz = -48; gz <= 48; gz += 6) {
      for (let gx = -48; gx <= 48; gx += 6) {
        const d = desnivel(campo, gx, gz)
        // o recurso da superfície pousa EXATAMENTE no chão desenhado em (x, z)
        maiorDif = Math.max(maiorDif, Math.abs(alturaVisualRecurso(0, d) - alturaVisualDoChao(campo, gx, gz)))
        // sem campo é o de hoje
        assert(alturaVisualRecurso(0, desnivel(undefined, gx, gz)) === Y_SOLO_VISUAL, `sem campo, o recurso em (${gx}, ${gz}) fica em Y_SOLO_VISUAL`)
        // x e z trocados dariam OUTRO desnível em algum ponto (o controle do instrumento: se nunca mudasse, o teste de troca seria cego)
        if (Math.abs(desnivel(campo, gz, gx) - d) > 0.05) trocaMudaAlgo += 1
        pontos += 1
        if (d < -0.2) emVale += 1
        if (d > 0.2) emMorro += 1
      }
    }
  }
  assert(maiorDif < 1e-9, `o recurso pousa no chão DESENHADO em ${pontos} pontos de 6 biomas (maior diferença ${maiorDif.toExponential(2)} m): nem 0,45 acima (Y_SOLO_VISUAL dobrado), nem com x e z trocados`)
  assert(emVale > 100 && emMorro > 100, `a amostra tem vales e morros de verdade (${emVale} em vale, ${emMorro} em morro): sem eles o teste não distingue «seguiu o terreno» de «ficou no plano»`)
  assert(trocaMudaAlgo > 100, `o controle da troca de x e z tem força: trocá-los muda o desnível em ${trocaMudaAlgo} pontos (um campo simétrico não o provaria)`)
}

/**
 * `desnivelDoChao(campo, x, z)`: o DESNÍVEL do relevo no ponto (a altura do campo acima do plano de hoje), 0 sem campo. É a conta que `PropsBiomaInstanced` e `FundacaoObraCena` copiavam e que as obras
 * repetiriam: uma cópia é onde alguém esquece o `− Y_SOLO_VISUAL` (o chão sobe 0,45 m em plano). Extraída para UM lugar, provada uma vez.
 */
/**
 * `desnivelDoChao` aceita DOIS argumentos de chão (F2, 26/11/2026, decisão do usuário: o desenho amostra a malha que o GPU desenha): o campo CRU (`CampoRelevo`, a altura bilinear `alturaEm`, de hoje) e o
 * `ChaoDaMalha` (o campo + o passo da malha em uso). Os 44 pontos do desenho já passam adiante o que recebem, então só quem PRODUZ o objeto escolhe o chão; nenhum chamador muda de assinatura.
 * O oráculo da malha é `desnivelDaMalha` (provado contra o `three` real em `chaoDaMalha.test.ts`); aqui se prova que `desnivelDoChao` ENCAMINHA para ele e que o campo cru NÃO mudou.
 */
function contratoDoDesnivelNoChaoDaMalha(): void {
  const colina = campoComColina()
  const alto = campoComCentroAlto()
  const rng = semente(2612)
  // (1) o campo CRU continua dando `alturaEm`, bit a bit (quem não migrou não pode mudar: o `laboratorio`, os testes e o que vier)
  for (let k = 0; k < 500; k += 1) {
    const x = (rng() - 0.5) * 112
    const z = (rng() - 0.5) * 112
    assert(desnivelDoChao(colina, x, z) === alturaEm(colina, x, z), `o campo CRU segue dando alturaEm em (${x.toFixed(2)}, ${z.toFixed(2)})`)
  }
  // (2) o ChaoDaMalha dá a altura da MALHA, em 3 passos, na colina (um campo com altura de verdade)
  for (const passo of [1, 2, 4] as const) {
    const chao = chaoDaMalha(colina, passo)
    for (let k = 0; k < 500; k += 1) {
      const x = (rng() - 0.5) * 60
      const z = (rng() - 0.5) * 60
      assert(desnivelDoChao(chao, x, z) === desnivelDaMalha(chao, x, z), `passo ${passo}: desnivelDoChao(ChaoDaMalha) é a altura da malha em (${x.toFixed(2)}, ${z.toFixed(2)})`)
    }
  }
  // (3) e a diferença EXISTE (controle positivo do instrumento): na encosta da colina a malha de 4 m erra o campo em mais de 1 cm, então um `desnivelDoChao` que ignorasse o ChaoDaMalha seria pego pela asserção (2)
  let maiorDiferenca = 0
  for (let k = 0; k < 500; k += 1) {
    const x = (rng() - 0.5) * 20
    const z = (rng() - 0.5) * 20
    maiorDiferenca = Math.max(maiorDiferenca, Math.abs(desnivelDoChao(chaoDaMalha(colina, 4), x, z) - alturaEm(colina, x, z)))
  }
  assert(maiorDiferenca > 0.01, `controle: na colina a malha de 4 m difere do campo (${maiorDiferenca.toFixed(4)} m), senão o teste não separaria nada`)
  // (4) SEM chão (undefined) é +0 exato; entrada não finita COM chão visto dá 0 (e não a altura do centro)
  assert(Object.is(desnivelDoChao(undefined, 3, 4), 0), 'sem chão o desnível é +0 exato')
  const chaoAlto = chaoDaMalha(alto, 2)
  for (const ruim of [Number.NaN, Infinity, -Infinity]) {
    assert(desnivelDoChao(chaoAlto, ruim, 0) === 0 && desnivelDoChao(chaoAlto, 0, ruim) === 0, `com ChaoDaMalha, ${String(ruim)} NÃO eleva: dá 0 (e não a altura do centro)`)
  }
  // (5) `alturaVisualDoChao` é o plano de hoje + o MESMO desnível, para os dois tipos de chão
  for (const passo of [2, 4] as const) {
    const chao = chaoDaMalha(colina, passo)
    for (let k = 0; k < 200; k += 1) {
      const x = (rng() - 0.5) * 20
      const z = (rng() - 0.5) * 20
      assert(Math.abs(alturaVisualDoChao(chao, x, z) - (Y_SOLO_VISUAL + desnivelDoChao(chao, x, z))) < 1e-12, `passo ${passo}: chão desenhado = Y_SOLO_VISUAL + desnível do ChaoDaMalha`)
    }
  }
}

function contratoDoDesnivelDoChao(): void {
  // (1) I1: sem campo é 0, em qualquer ponto, inclusive os que quebram contas
  for (const [x, z] of [[0, 0], [10, -7], [-56, 56], [1e9, -1e9]] as const) {
    assert(desnivelDoChao(undefined, x, z) === 0, `sem campo o desnível em (${x}, ${z}) é 0 exato`)
  }
  for (const ruim of [Number.NaN, Infinity, -Infinity]) {
    assert(desnivelDoChao(undefined, ruim, 0) === 0 && desnivelDoChao(undefined, 0, ruim) === 0, `sem campo, ${String(ruim)} dá 0`)
  }
  // (2) com campo é a altura do campo NO PONTO, em morro e em vale (o oráculo é `alturaEm`, a fonte do campo, não a conta que se está testando)
  const colina = campoComColina()
  const alto = campoComCentroAlto()
  let maiorDif = 0
  for (let i = 0; i < 3000; i += 1) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 56
    const z = (Math.sin(i * 78.233) * 43758.5453 % 1) * 56
    maiorDif = Math.max(maiorDif, Math.abs(desnivelDoChao(colina, x, z) - alturaEm(colina, x, z)))
  }
  assert(maiorDif < 1e-9, `com campo o desnível é a altura do campo no ponto (maior diferença ${maiorDif.toExponential(2)} em 3000 pontos)`)
  assert(Math.abs(desnivelDoChao(colina, 0, 0) - 1.5) < 1e-6, 'no topo da colina o desnível é 1,5 m (o controle do instrumento: um campo com altura de verdade)')
  assert(desnivelDoChao(colina, 40, 40) === 0, 'longe da colina o desnível é 0 exato')
  assert(Math.abs(desnivelDoChao(alto, 10, 10) - 2) < 1e-6, 'num campo de altura 2 em todo lugar o desnível é 2')
  // (3) entradas NÃO finitas num campo de centro ALTO não elevam: `alturaEm` prende `NaN` ao centro (altura 2), mas aqui tem de dar 0 (a posição corrompida de um objeto não pode lançá-lo ao céu)
  assert(alturaEm(alto, Number.NaN, 0) > 1.9, '(controle do teste) alturaEm com NaN num campo de centro alto devolve a altura do centro, não 0')
  for (const ruim of [Number.NaN, Infinity, -Infinity]) {
    assert(desnivelDoChao(alto, ruim, 0) === 0 && desnivelDoChao(alto, 0, ruim) === 0, `com campo, ${String(ruim)} NÃO eleva: dá 0 (e não a altura do centro)`)
  }
  // (4) é a MESMA conta que `alturaVisualDoChao` faz: chão desenhado = plano de hoje + desnível, em todo ponto
  for (let i = 0; i < 500; i += 1) {
    const x = (Math.sin(i * 3.1) * 7919 % 1) * 56
    const z = (Math.sin(i * 5.7) * 6271 % 1) * 56
    assert(Math.abs(alturaVisualDoChao(colina, x, z) - (Y_SOLO_VISUAL + desnivelDoChao(colina, x, z))) < 1e-12, `chão desenhado = Y_SOLO_VISUAL + desnível em (${x.toFixed(2)}, ${z.toFixed(2)})`)
  }
}

export function run(): void {
  contratoDoDesnivelDoChao()
  contratoDoDesnivelNoChaoDaMalha()
  contratoDaAlturaDoRecurso()
  contratoDaComposicaoDoRecurso()
  const rnd = semente(0xc0ffee)

  // ── I1. SEM CAMPO = HOJE, exatamente, em qualquer ponto, inclusive os que quebram contas (NaN, infinitos, enormes). ───────────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < 2000; i += 1) {
    const x = (rnd() - 0.5) * 400
    const z = (rnd() - 0.5) * 400
    assert(alturaVisualDoChao(undefined, x, z) === Y_SOLO_VISUAL, `sem campo, (${x.toFixed(2)}, ${z.toFixed(2)}) é Y_SOLO_VISUAL exato`)
  }
  for (const ruim of [Number.NaN, Infinity, -Infinity, 1e9, -1e9, 56.0001, -56.0001]) {
    assert(alturaVisualDoChao(undefined, ruim, 0) === Y_SOLO_VISUAL && alturaVisualDoChao(undefined, 0, ruim) === Y_SOLO_VISUAL, `sem campo, ${String(ruim)} dá Y_SOLO_VISUAL`)
  }

  // ── LÊ O CAMPO: com uma colina conhecida, a altura é Y_SOLO_VISUAL + a altura do campo, em cada ponto (e a colina TEM altura, senão o teste não provaria nada). ───────────────────────────────────────
  const colina = campoComColina()
  assert(alturaEm(colina, 0, 0) > 1.4, `a colina de teste tem altura (${alturaEm(colina, 0, 0)}): o controle positivo do próprio teste`)
  let maiorDif = 0
  for (let i = 0; i < 5000; i += 1) {
    const x = (rnd() - 0.5) * 112
    const z = (rnd() - 0.5) * 112
    maiorDif = Math.max(maiorDif, Math.abs(alturaVisualDoChao(colina, x, z) - (Y_SOLO_VISUAL + alturaEm(colina, x, z))))
  }
  assert(maiorDif < 1e-9, `a altura do chão é Y_SOLO_VISUAL + a do campo em 5000 pontos (maior diferença ${maiorDif.toExponential(2)})`)
  assert(Math.abs(alturaVisualDoChao(colina, 0, 0) - (Y_SOLO_VISUAL + 1.5)) < 1e-6, `no topo da colina o chão está 1,5 m acima do plano (${alturaVisualDoChao(colina, 0, 0)})`)
  assert(alturaVisualDoChao(colina, 40, 40) === Y_SOLO_VISUAL, 'longe da colina o chão é o plano de hoje, exato')

  // ── ENTRADA NÃO FINITA NUNCA ELEVA UM OBJETO. `alturaEm` prende NaN e infinitos ao CENTRO do quadrado (medido: dá 0 só porque a altura do centro de (0,0) vale 0). Num quadrado cujo centro é alto, um
  //    `x` NaN devolveria 2 m, e um objeto com posição corrompida apareceria elevado. `alturaVisualDoChao` trata isso ela mesma. ─────────────────────────────────────────────────────────────────────
  const alto = campoComCentroAlto()
  assert(alturaEm(alto, Number.NaN, 0) > 1.9, `(controle do teste) alturaEm com NaN num campo de centro alto devolve ${alturaEm(alto, Number.NaN, 0)}, e NÃO o plano`)
  for (const ruim of [Number.NaN, Infinity, -Infinity]) {
    assert(alturaVisualDoChao(alto, ruim, 0) === Y_SOLO_VISUAL, `${String(ruim)} em x devolve o plano, não a altura do centro`)
    assert(alturaVisualDoChao(alto, 0, ruim) === Y_SOLO_VISUAL, `${String(ruim)} em z devolve o plano`)
    assert(alturaVisualDoChao(alto, ruim, ruim) === Y_SOLO_VISUAL, `${String(ruim)} nos dois devolve o plano`)
  }
  // fora do quadrado (mas finito) prende na borda, como `alturaEm`: um objeto na emenda entre dois quadrados não pula
  assert(Math.abs(alturaVisualDoChao(alto, 1e9, 0) - (Y_SOLO_VISUAL + 2)) < 1e-6, 'finito fora do quadrado prende na borda (2 m neste campo)')

  // ── CAMPO REAL DO GERADOR: lê sem lançar nos 4 cantos, no centro e nas bordas de vários quadrados (os de (i, j) de −2 a +2). ──────────────────────────────────────────────────────────────────────
  for (let i = -2; i <= 2; i += 1) {
    for (let j = -2; j <= 2; j += 1) {
      const campo = gerarRelevo(i, j)
      for (const [x, z] of [[0, 0], [56, 56], [-56, -56], [56, -56], [-56, 56], [12.3, -7.7]] as const) {
        const h = alturaVisualDoChao(campo, x, z)
        assert(Number.isFinite(h) && Math.abs(h - (Y_SOLO_VISUAL + alturaEm(campo, x, z))) < 1e-9, `campo real (${i},${j}) em (${x}, ${z}) devolve um número finito, igual a Y_SOLO_VISUAL + alturaEm`)
      }
    }
  }

  // ── `alturaDeReferencia`: o SUBSOLO tem UM chão de referência (o do centro da mina), e o resto usa o ponto. A mina tem galerias de até 9 m do centro: sem isto o herói «flutuaria» dentro dela. ────────
  const mina = { x: 4, z: 4 } // dentro da colina: o chão da mina vale ~0,9 m acima do plano
  const hMina = alturaVisualDoChao(colina, mina.x, mina.z)
  const hLonge = alturaVisualDoChao(colina, 40, 40)
  assert(hMina > hLonge + 0.5, `(controle do teste) o centro da mina está mais alto que um ponto longe (${hMina} contra ${hLonge})`)
  // em subsolo (y < −0,9), QUALQUER (x, z) usa o chão do centro da mina
  for (const [x, z] of [[40, 40], [-30, 2], [4, 4], [9, 4]] as const) {
    assert(alturaDeReferencia(colina, mina, x, z, -1.2) === hMina, `no subsolo (y = −1,2), (${x}, ${z}) usa o chão do centro da mina (${hMina})`)
  }
  // fora do subsolo (y ≥ −0,9) usa o PRÓPRIO ponto
  assert(alturaDeReferencia(colina, mina, 40, 40, 0) === hLonge, 'em y = 0, usa o terreno do próprio ponto')
  assert(alturaDeReferencia(colina, mina, 4, 4, 2.5) === hMina, 'no ar (y = 2,5), usa o terreno do próprio ponto')
  // A FRONTEIRA do subsolo: `y < −0,9` (estritamente): −0,9 exato NÃO é subsolo, −0,9000001 é.
  assert(alturaDeReferencia(colina, mina, 40, 40, -0.9) === hLonge, 'y = −0,9 exato NÃO é subsolo (a regra do jogo é estritamente menor)')
  assert(alturaDeReferencia(colina, mina, 40, 40, -0.9000001) === hMina, 'y = −0,9000001 é subsolo')
  // O CENTRO DA MINA ASSIMÉTRICO (x ≠ z): a colina de teste é SIMÉTRICA, e o centro (4, 4) acima tem x = z, então trocar x e z NÃO mudava nada e o mutante «subsolo usa o centro com x e z trocados»
  // sobreviveu (24/11). Aqui o centro é (7, 1) e o trocado seria (1, 7): as alturas da colina diferem e o teste enxerga a troca. A distância ao centro da colina muda de 7,07 para 7,07, então ELA também
  // é simétrica: por isso a colina assimétrica abaixo (um degrau só no lado +x).
  const degrau = (() => {
    const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
    for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = gx > 0 ? 2 : 0
    return { i: 0, j: 0, alturas, nivelAgua: -0.4, versao: 1 } as CampoRelevo
  })()
  const minaAssimetrica = { x: 7, z: -3 } // x > 0: chão a +2 m; o trocado (−3, 7) tem x < 0: chão a 0
  const chaoDaMina = alturaVisualDoChao(degrau, minaAssimetrica.x, minaAssimetrica.z)
  const chaoTrocado = alturaVisualDoChao(degrau, minaAssimetrica.z, minaAssimetrica.x)
  assert(Math.abs(chaoDaMina - chaoTrocado) > 1.9, `(controle do teste) o centro (7, −3) e o trocado (−3, 7) têm chão DIFERENTE (${chaoDaMina} contra ${chaoTrocado})`)
  assert(alturaDeReferencia(degrau, minaAssimetrica, 40, 40, -1.5) === chaoDaMina, 'no subsolo usa o chão de (centro.x, centro.z) e NÃO o de (centro.z, centro.x): x e z não podem estar trocados')
  // sem mina cavada (`subsoloCentro` null) o subsolo não tem referência própria: cai no ponto
  assert(alturaDeReferencia(colina, null, 40, 40, -1.2) === hLonge, 'sem mina (subsoloCentro null) usa o ponto, não explode')
  // e sem campo (chão plano): tudo é Y_SOLO_VISUAL, com ou sem subsolo
  for (const y of [-5, -0.9, 0, 3]) assert(alturaDeReferencia(undefined, mina, 7, 7, y) === Y_SOLO_VISUAL, `sem campo, y = ${y} dá Y_SOLO_VISUAL`)
  assert(alturaDeReferencia(colina, mina, Number.NaN, 0, 0) === Y_SOLO_VISUAL, 'x NaN fora do subsolo devolve o plano (não eleva)')
  assert(alturaDeReferencia(colina, mina, 0, 0, Number.NaN) === alturaVisualDoChao(colina, 0, 0), 'y NaN não é subsolo (a comparação com NaN é falsa): usa o ponto')
}
