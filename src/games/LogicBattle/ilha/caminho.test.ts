import { contagemBuscas, encontrarCaminho, encaixarLivre, visitasUltima, zerarBuscas } from './caminho'
import { PARTIDA } from './partidaPolicies'

function assert(condition: boolean, name: string): void {
  if (!condition) throw new Error(name)
}

function cruzaCaixa(
  origem: { x: number; z: number },
  marcos: { x: number; z: number }[],
  caixa: { x: number; z: number; hx: number; hz: number },
): boolean {
  const pontos = [origem, ...marcos]
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1]
    const b = pontos[i]
    for (let t = 0; t <= 8; t++) {
      const p = t / 8
      const x = a.x + (b.x - a.x) * p
      const z = a.z + (b.z - a.z) * p
      if (Math.abs(x - caixa.x) <= caixa.hx && Math.abs(z - caixa.z) <= caixa.hz) return true
    }
  }
  return false
}

export function run(): void {
  zerarBuscas()
  const livre = encontrarCaminho(0, 0, 6, 0, [])
  assert(livre !== null && livre.length === 1 && livre[0].x === 6 && livre[0].z === 0, 'campo sem caixa')
  assert(contagemBuscas === 0, 'campo sem caixa não busca')

  const muro = { x: 4, z: 0, hx: 0.6, hz: 3 }
  const desvio = encontrarCaminho(0, 0, 8, 0, [muro])
  assert(desvio !== null && desvio.length > 0, 'desvio existe')
  assert(!cruzaCaixa({ x: 0, z: 0 }, desvio, muro), 'caminho não cruza a caixa')
  assert(cruzaCaixa({ x: 0, z: 0 }, [{ x: 8, z: 0 }], muro), 'a reta do teste cruza a caixa')

  const quina = encontrarCaminho(0, 0, 2, 2, [
    { x: 1, z: 0, hx: 0.45, hz: 0.45 },
    { x: 0, z: 1, hx: 0.45, hz: 0.45 },
  ])
  assert(quina !== null && quina.length > 1, `quina tem volta ${JSON.stringify(quina)}`)
  assert(!cruzaCaixa({ x: 0, z: 0 }, quina, { x: 1, z: 1, hx: 0.2, hz: 0.2 }), 'segmento não corta (1,1)')

  const dentro = encaixarLivre(4, 0, [muro])
  assert(dentro !== null, 'clique na caixa acha célula')
  const ponto = { x: dentro[0] * PARTIDA.celula, z: dentro[1] * PARTIDA.celula }
  assert(Math.hypot(ponto.x - 4, ponto.z) <= PARTIDA.espiral + 0.01, 'espiral de 5 m')
  assert(Math.abs(ponto.x - muro.x) > muro.hx || Math.abs(ponto.z - muro.z) > muro.hz, 'célula fora da caixa')

  const caixaPortao = { x: 4, z: 0, hx: 1.2, hz: 0.4 }
  const semBloqueio = encontrarCaminho(0, 0, 8, 0, [])
  assert(
    semBloqueio !== null && cruzaCaixa({ x: 0, z: 0 }, semBloqueio, caixaPortao),
    'lista vazia cruza o lugar do portão',
  )
  const portaoComoMuro = encontrarCaminho(0, 0, 8, 0, [caixaPortao])
  assert(
    portaoComoMuro !== null && !cruzaCaixa({ x: 0, z: 0 }, portaoComoMuro, caixaPortao),
    'o mesmo retângulo, se bloqueia, é contornado',
  )

  const parede: { x: number; z: number; hx: number; hz: number }[] = []
  for (let z = -56; z <= 56; z++) parede.push({ x: 2, z, hx: 0.6, hz: 0.6 })
  assert(encontrarCaminho(0, 0, 10, 0, parede) === null, 'parede sem vão')
  assert(visitasUltima === PARTIDA.maxVisitas, 'a busca para em 5000 visitas')

  const fora = encontrarCaminho(0, 0, 80, 0, [])
  assert(fora !== null, 'alvo fora do disco ainda devolve marco')
  assert(
    Math.hypot(fora[fora.length - 1].x, fora[fora.length - 1].z) <= PARTIDA.radius - PARTIDA.body + 0.01,
    'o marco fica dentro do disco',
  )

  const muralha: { x: number; z: number; hx: number; hz: number }[] = []
  for (let i = -3; i <= 3; i++) {
    muralha.push({ x: i, z: 2, hx: 0.55, hz: 0.55 })
    muralha.push({ x: i, z: -2, hx: 0.55, hz: 0.55 })
    muralha.push({ x: 3, z: i, hx: 0.55, hz: 0.55 })
    muralha.push({ x: -3, z: i, hx: 0.55, hz: 0.55 })
  }
  assert(encontrarCaminho(0, 0, 10, 0, muralha) === null, 'muro fechado')
}
