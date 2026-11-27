import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Uint32BufferAttribute, Vector3 } from 'three'
import { alturaEm, LADO_RELEVO, MEIA_RELEVO, type CampoRelevo } from './campoRelevo'
import { chaoDaMalha, desnivelDaMalha } from './chaoDaMalha'
import { gerarRelevo } from './geradorRelevo'
import { geometriaDoTerreno } from './geometriaDoTerreno'

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

/**
 * O ORÁCULO: a altura do chão que o GPU DESENHA em `(x, z)`, medida pelo `three` REAL. Monta um `Mesh` com a MESMA geometria que `TerrenoRelevoCena` entrega ao `BufferGeometry` (`geometriaDoTerreno`,
 * posições, índices e a ordem dos triângulos) e atira um raio vertical de cima para baixo: o ponto de acerto é a superfície que a câmera vê e contra a qual o teste de profundidade decide. NÃO usa
 * nenhuma fórmula de interpolação do projeto (a minha reimplementação da malha, `fabricarChao` dos scripts de medição, é o que este teste PRECISA poder contradizer).
 */
function malhaDoThree(campo: CampoRelevo, passo: number): (x: number, z: number) => number {
  const g = geometriaDoTerreno(campo, passo)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(g.posicoes, 3))
  geo.setIndex(new Uint32BufferAttribute(g.indices, 1))
  const malha = new Mesh(geo, new MeshBasicMaterial({ side: 2 }))
  malha.updateMatrixWorld(true)
  const raio = new Raycaster()
  return (x, z) => {
    raio.set(new Vector3(x, 50, z), new Vector3(0, -1, 0))
    const acertos = raio.intersectObject(malha, false)
    assert(acertos.length > 0, `o raio vertical em (${x}, ${z}) não acertou a malha de passo ${passo}`)
    return acertos[0].point.y
  }
}

/**
 * Um campo com a estrutura que separa as duas alturas: um vértice ALTO isolado (1 m) em (0, 0) e o resto plano. No passo 1 m a malha e o campo concordam em todo lugar (o campo é bilinear e o pico
 * é a ponta de uma pirâmide); no passo 4 m o pico vira um cone de 4 m de raio e em (0,5; 0) a malha vale 0,875 contra 0,5 do campo.
 */
function campoComPicoIsolado(): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  alturas[(0 + MEIA_RELEVO) * LADO_RELEVO + (0 + MEIA_RELEVO)] = 1
  return { i: 0, j: 0, alturas, nivelAgua: -0.4, versao: 1 }
}

function campoPlano(): CampoRelevo {
  return { i: 0, j: 0, alturas: new Float32Array(LADO_RELEVO * LADO_RELEVO), nivelAgua: -0.4, versao: 1 }
}

function campoRampa(): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = 0.3 * gx + 0.2 * gz
  return { i: 0, j: 0, alturas, nivelAgua: -0.4, versao: 1 }
}

/**
 * O CHÃO VISTO (F2, 26/11/2026). A foto da patrulha achou que o chão que o jogador VÊ (a malha de passo 1, 2 ou 4 m: vértice = `alturaEm`, entre vértices LINEAR POR PARTES em 2 triângulos por célula) NÃO é
 * o campo `alturaEm` (bilinear) entre os vértices: desvio máximo 0,22 / 0,85 / 1,08 m, e a malha fica > 5 cm ACIMA do campo em 0,5 / 14,9 / 38,5 % dos pontos. Tudo que o desenho posiciona leu `alturaEm`:
 * no Leve metade do que repousa no chão fica enterrado. A decisão (do usuário, 26/11) é que o desenho passe a amostrar a MALHA, a MESMA função que o GPU desenha.
 * O contrato mais caro de errar é «o desnível que o desenho soma é a altura da malha QUE ESTÁ NA TELA», e o oráculo é o `three` REAL, não uma fórmula do projeto.
 */
export function run(): void {
  const real = gerarRelevo(3, 0)
  const pico = campoComPicoIsolado()
  const plano = campoPlano()
  const rampa = campoRampa()

  // (1) I1 — SEM campo o chão visto não existe e o desnível é +0 EXATO, em qualquer qualidade e em qualquer entrada
  for (const passo of [1, 2, 4] as const) {
    assert(chaoDaMalha(undefined, passo) === undefined, `sem campo, o chão visto (passo ${passo}) é indefinido: o jogo de hoje`)
  }
  for (const ruim of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert(Object.is(desnivelDaMalha(undefined, ruim, 0), 0) && Object.is(desnivelDaMalha(undefined, 0, ruim), 0), `sem campo, ${String(ruim)} dá +0 exato`)
  }
  assert(Object.is(desnivelDaMalha(undefined, 3, 4), 0), 'sem campo o desnível é +0 EXATO (e não -0)')

  // (2) o ORÁCULO concorda com o que eu sei à mão: no pico de 1 m, em (0,5; 0) o campo vale 0,5, a malha de 1 m vale 0,5 e a de 4 m vale 0,875 (a conta de cabeça, sem código do projeto)
  const orac1 = malhaDoThree(pico, 1)
  const orac4 = malhaDoThree(pico, 4)
  assert(Math.abs(orac1(0.5, 0) - 0.5) < 1e-5, `controle do oráculo: a malha de 1 m em (0,5; 0) vale 0,5 (veio ${orac1(0.5, 0)})`)
  assert(Math.abs(orac4(0.5, 0) - 0.875) < 1e-5, `controle do oráculo: a malha de 4 m em (0,5; 0) vale 0,875 (veio ${orac4(0.5, 0)})`)
  assert(Math.abs(alturaEm(pico, 0.5, 0) - 0.5) < 1e-6, 'controle: o campo bilinear vale 0,5 em (0,5; 0) (a ALTURA QUE O DESENHO USAVA)')

  // (3) COM campo o desnível é a altura da MALHA, contra o three real, em 3 passos × campo real e campo de pico. É a asserção que MORRE se `desnivelDaMalha` voltar a ler `alturaEm`.
  const rng = semente(2611)
  for (const passo of [1, 2, 4] as const) {
    for (const [nome, campo] of [['pico', pico], ['serra real (3,0)', real]] as const) {
      const oraculo = malhaDoThree(campo, passo)
      const chao = chaoDaMalha(campo, passo)
      let pior = 0
      for (let k = 0; k < 400; k += 1) {
        const x = (rng() - 0.5) * 100
        const z = (rng() - 0.5) * 100
        pior = Math.max(pior, Math.abs(desnivelDaMalha(chao, x, z) - oraculo(x, z)))
      }
      assert(pior < 1e-4, `${nome}, passo ${passo} m: o desnível discorda da malha do three em até ${pior.toFixed(5)} m (esperado < 1e-4)`)
    }
  }
  // e o instrumento TEM de enxergar a diferença: no pico de 4 m o desnível da malha difere do campo (0,875 contra 0,5), então um desenho que lesse `alturaEm` seria pego
  assert(Math.abs(desnivelDaMalha(chaoDaMalha(pico, 4), 0.5, 0) - alturaEm(pico, 0.5, 0)) > 0.3, 'controle positivo: no passo 4 m o desnível da malha difere do campo em mais de 0,3 m (0,875 contra 0,5)')

  // (4) CONTROLES NEGATIVOS: onde a malha e o campo CONCORDAM por construção o desnível é o mesmo (plano e rampa linear: a malha linear por partes reproduz uma rampa exatamente)
  for (const passo of [1, 2, 4] as const) {
    for (const [nome, campo] of [['plano', plano], ['rampa', rampa]] as const) {
      const chao = chaoDaMalha(campo, passo)
      let pior = 0
      for (let k = 0; k < 200; k += 1) {
        const x = (rng() - 0.5) * 100
        const z = (rng() - 0.5) * 100
        pior = Math.max(pior, Math.abs(desnivelDaMalha(chao, x, z) - alturaEm(campo, x, z)))
      }
      assert(pior < 1e-4, `${nome}, passo ${passo} m: a malha e o campo concordam (pior ${pior.toFixed(6)} m)`)
    }
  }

  // (5) o passo 1 m é o que mais perto fica do campo (a divergência CAI com o passo): maior desvio por passo na serra real, contra o three
  const desvio = (passo: 1 | 2 | 4): number => {
    const chao = chaoDaMalha(real, passo)
    const r = semente(77)
    let max = 0
    for (let k = 0; k < 1500; k += 1) {
      const x = (r() - 0.5) * 100
      const z = (r() - 0.5) * 100
      max = Math.max(max, Math.abs(desnivelDaMalha(chao, x, z) - alturaEm(real, x, z)))
    }
    return max
  }
  const d1 = desvio(1)
  const d2 = desvio(2)
  const d4 = desvio(4)
  assert(d1 < d2 && d2 < d4, `a malha só se afasta do campo com o passo: ${d1.toFixed(3)} < ${d2.toFixed(3)} < ${d4.toFixed(3)} m`)
  assert(d4 > 0.3 && d1 < 0.3, `o defeito que a foto achou é REAL na serra: a malha de 4 m erra mais de 0,3 m (${d4.toFixed(3)}) e a de 1 m menos (${d1.toFixed(3)})`)

  // (6) entradas NÃO finitas COM campo dão 0, não a altura do centro do quadrado (a mesma regra de `desnivelDoChao`)
  const alto = { i: 0, j: 0, alturas: new Float32Array(LADO_RELEVO * LADO_RELEVO).fill(2), nivelAgua: -0.4, versao: 1 } as CampoRelevo
  for (const passo of [1, 2, 4] as const) {
    const chao = chaoDaMalha(alto, passo)
    for (const ruim of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert(desnivelDaMalha(chao, ruim, 0) === 0 && desnivelDaMalha(chao, 0, ruim) === 0, `passo ${passo}: ${String(ruim)} NÃO eleva (0, e não a altura 2 do centro)`)
    }
    assert(Math.abs(desnivelDaMalha(chao, 10, 10) - 2) < 1e-5, `passo ${passo}: num campo de altura 2 o desnível é 2`)
  }

  // (7) fora do quadrado (finito) PRENDE na borda, como `alturaEm`: um objeto na emenda entre dois quadrados não pula
  const chaoPico = chaoDaMalha(real, 4)
  assert(Math.abs(desnivelDaMalha(chaoPico, 200, 0) - desnivelDaMalha(chaoPico, MEIA_RELEVO, 0)) < 1e-9, 'x = 200 prende em x = +56')
  assert(Math.abs(desnivelDaMalha(chaoPico, -200, 0) - desnivelDaMalha(chaoPico, -MEIA_RELEVO, 0)) < 1e-9, 'x = −200 prende em x = −56')
  assert(Math.abs(desnivelDaMalha(chaoPico, 0, 200) - desnivelDaMalha(chaoPico, 0, MEIA_RELEVO)) < 1e-9, 'z = 200 prende em z = +56')

  // (8) o chão visto GUARDA o campo e o passo (a visão não é uma cópia que envelhece): o mesmo campo e o mesmo passo dão o mesmo chão, e outro passo dá outro
  const a = chaoDaMalha(real, 2)
  const b = chaoDaMalha(real, 2)
  assert(a !== undefined && b !== undefined && a.campo === real && a.passo === 2, 'o chão visto guarda o campo e o passo')
  assert(a === b, 'o mesmo campo e o mesmo passo devolvem o MESMO objeto (sem criar um por chamada: a cena pergunta a cada quadro)')
  assert(chaoDaMalha(real, 4) !== a, 'outro passo é outro chão visto')
  assert(chaoDaMalha(rampa, 2) !== a, 'outro campo é outro chão visto')
}
