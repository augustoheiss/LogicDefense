import type { BiomaId, LagoaRasa, RecursoNatural } from '../biomaRecursos'
import { PARTIDA } from '../partidaPolicies'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'

export interface InstanciaGrama {
  readonly x: number
  readonly z: number
  readonly escala: number
  readonly altura: number
  readonly rotY: number
}

export interface InstanciaFlor {
  readonly x: number
  readonly z: number
  readonly corIndex: 0 | 1 | 2
  readonly escala: number
  readonly rotY: number
}

export interface InstanciaPedraDecorativa {
  readonly x: number
  readonly z: number
  readonly escalaX: number
  readonly escalaY: number
  readonly escalaZ: number
  readonly rotY: number
}

export interface InstanciaMargem {
  readonly x: number
  readonly z: number
  readonly escala: number
  readonly rotY: number
  readonly tipo: 'junco' | 'vitoria'
}

export interface PropsDecorativosMapa {
  readonly gramas: readonly InstanciaGrama[]
  readonly flores: readonly InstanciaFlor[]
  readonly pedras: readonly InstanciaPedraDecorativa[]
  readonly margens: readonly InstanciaMargem[]
}

function criarPrng(i: number, j: number, sal: number): () => number {
  let state = (Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(j ^ 0xc2b2ae35, 0x27d4eb2f) ^ sal) >>> 0
  if (state === 0) state = 0x6d2b79f5
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dentroEstradaCentral(x: number, z: number): boolean {
  return Math.abs(x) < 5.0 && z > -6.5 && z < 44.5
}

function dentroLagoaComMargem(x: number, z: number, lagoas: readonly LagoaRasa[], folga = 0.8): boolean {
  return lagoas.some((l) => ((x - l.x) / (l.rx + folga)) ** 2 + ((z - l.z) / (l.rz + folga)) ** 2 <= 1)
}

function pertoDeRecurso(x: number, z: number, recursos: readonly RecursoNatural[]): boolean {
  for (const r of recursos) {
    if (r.yBase < -0.9) continue
    if (Math.hypot(x - r.x, z - r.z) < 1.35) return true
  }
  return false
}

function areaPermitidaDecoracao(
  x: number,
  z: number,
  lagoas: readonly LagoaRasa[],
  recursos: readonly RecursoNatural[],
): boolean {
  if (Math.abs(x) > PARTIDA.radius - 2.2 || Math.abs(z) > PARTIDA.radius - 2.2) return false
  if (Math.hypot(x, z) < 3.4) return false
  if (dentroEstradaCentral(x, z)) return false
  if (dentroLagoaComMargem(x, z, lagoas, 0.75)) return false
  if (pertoDeRecurso(x, z, recursos)) return false
  return true
}

export function gerarPropsDecorativos(
  i: number,
  j: number,
  bioma: BiomaId,
  lagoas: readonly LagoaRasa[],
  recursos: readonly RecursoNatural[],
  spec: Pick<SpecQualidadeGrafica, 'maxGrama' | 'maxFlores' | 'maxPedras'>,
): PropsDecorativosMapa {
  const cat = BIOMA_VISUAL_CATALOG[bioma]
  const rand = criarPrng(i, j, 0x918273)

  const qtdGramaAlvo = Math.round(spec.maxGrama * cat.densidadeGrama)
  const gramas: InstanciaGrama[] = []
  let tentativas = 0
  while (gramas.length < qtdGramaAlvo && tentativas < qtdGramaAlvo * 3) {
    tentativas += 1
    const x = (rand() * 2 - 1) * (PARTIDA.radius - 2.5)
    const z = (rand() * 2 - 1) * (PARTIDA.radius - 2.5)
    if (!areaPermitidaDecoracao(x, z, lagoas, recursos)) continue
    gramas.push({
      x,
      z,
      escala: 0.75 + rand() * 0.65,
      altura: 0.7 + rand() * 0.75,
      rotY: rand() * Math.PI * 2,
    })
  }

  const qtdFloresAlvo = Math.round(spec.maxFlores * cat.densidadeFlores)
  const flores: InstanciaFlor[] = []
  tentativas = 0
  while (flores.length < qtdFloresAlvo && tentativas < qtdFloresAlvo * 3) {
    tentativas += 1
    const x = (rand() * 2 - 1) * (PARTIDA.radius - 3.0)
    const z = (rand() * 2 - 1) * (PARTIDA.radius - 3.0)
    if (!areaPermitidaDecoracao(x, z, lagoas, recursos)) continue
    flores.push({
      x,
      z,
      corIndex: Math.floor(rand() * 3) as 0 | 1 | 2,
      escala: 0.8 + rand() * 0.6,
      rotY: rand() * Math.PI * 2,
    })
  }

  const pedras: InstanciaPedraDecorativa[] = []
  const fatorPedra = bioma === 'serra_ouro' || bioma === 'basalto_brasa' ? 1.35 : 0.85
  const qtdPedrasAlvo = Math.round(spec.maxPedras * fatorPedra)
  tentativas = 0
  while (pedras.length < qtdPedrasAlvo && tentativas < qtdPedrasAlvo * 3) {
    tentativas += 1
    const x = (rand() * 2 - 1) * (PARTIDA.radius - 2.5)
    const z = (rand() * 2 - 1) * (PARTIDA.radius - 2.5)
    if (!areaPermitidaDecoracao(x, z, lagoas, recursos)) continue
    pedras.push({
      x,
      z,
      escalaX: 0.22 + rand() * 0.42,
      escalaY: 0.14 + rand() * 0.24,
      escalaZ: 0.2 + rand() * 0.38,
      rotY: rand() * Math.PI * 2,
    })
  }

  const margens: InstanciaMargem[] = []
  if (spec.maxPedras > 0) {
    for (const lagoa of lagoas) {
      const qtd = spec.maxGrama > 0 ? 14 : 6
      for (let k = 0; k < qtd; k += 1) {
        const ang = (k / qtd) * Math.PI * 2 + rand() * 0.35
        const ehVitoria = !cat.aguaCongelada && !cat.aguaEmissiva && rand() < 0.38
        const rEscala = ehVitoria ? 0.35 + rand() * 0.45 : 0.96 + rand() * 0.16
        const mx = lagoa.x + Math.cos(ang) * lagoa.rx * rEscala
        const mz = lagoa.z + Math.sin(ang) * lagoa.rz * rEscala
        if (Math.abs(mx) > PARTIDA.radius - 1.5 || Math.abs(mz) > PARTIDA.radius - 1.5) continue
        margens.push({
          x: mx,
          z: mz,
          escala: 0.75 + rand() * 0.55,
          rotY: rand() * Math.PI * 2,
          tipo: ehVitoria ? 'vitoria' : 'junco',
        })
      }
    }
  }

  return { gramas, flores, pedras, margens }
}
