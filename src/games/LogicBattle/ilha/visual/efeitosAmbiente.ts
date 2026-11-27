import type { BiomaId, LagoaRasa } from '../biomaRecursos'
import type { Olhar } from '../partidaPolicies'
import type { Obra } from '../partidaSim'
import { desnivelDaObraNoChao, type ChaoDoDesenho } from '../relevo/alturaVisual'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'
import { pegadaEfetivaFundacao, Y_SOLO_VISUAL } from './suporteFundacao'

/**
 * Orquestração pura dos efeitos atmosféricos de F4 («O mundo respira», 27/11/2026).
 * Não importa `three` e não altera nenhuma regra de simulação: serve para manter o
 * rollback I1 (`ativo: false`), respeitar o orçamento do nível `Leve` e `prefers-reduced-motion`,
 * e garantir geração determinística no Node.
 */

export interface SubchavesEfeitos {
  readonly nuvens: boolean
  readonly particulas: boolean
  readonly passaros: boolean
  readonly ventoArvores: boolean
  readonly tochasObras: boolean
  readonly respostas: boolean
}

export interface ContextoEfeitosAmbiente {
  readonly ativo: boolean
  readonly movimentoReduzido: boolean
  readonly noSubsolo: boolean
  readonly olhar: Olhar
  readonly subchaves: SubchavesEfeitos
}

export interface ConfigEfeitosAmbiente {
  readonly nuvens: boolean
  readonly maxParticulas: number
  readonly maxPassaros: number
  readonly ventoArvores: boolean
  readonly tochasObras: boolean
  readonly respostas: boolean
  readonly velocidadeTempo: number
}

export interface PerfilParticulaBioma {
  readonly rotulo: string
  readonly corPrimaria: string
  readonly corSecundaria: string
  readonly velocidadeVertical: number
  readonly derivaHorizontal: number
  readonly tamanhoBase: number
  readonly alturaMin: number
  readonly alturaMax: number
}

export interface ParticulaInstancia {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly fase: number
  readonly escala: number
  readonly misturaCor: number
}

export interface PassaroInstancia {
  readonly centroX: number
  readonly centroZ: number
  readonly raioOrbita: number
  readonly altitude: number
  readonly velocidadeAngular: number
  readonly anguloInicial: number
  readonly faseAsa: number
  readonly escala: number
}

export interface PontoTochaObra {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly fase: number
  readonly ehInimiga: boolean
}

const DESLIGADO: ConfigEfeitosAmbiente = {
  nuvens: false,
  maxParticulas: 0,
  maxPassaros: 0,
  ventoArvores: false,
  tochasObras: false,
  respostas: false,
  velocidadeTempo: 0,
}

export const MAX_TOCHAS_CENA = 48

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

export function configEfeitosAmbiente(
  spec: SpecQualidadeGrafica,
  ctx: ContextoEfeitosAmbiente,
): ConfigEfeitosAmbiente {
  if (!ctx.ativo || ctx.noSubsolo || spec.efetiva === 'leve') return DESLIGADO
  const ultra = spec.efetiva === 'ultra'
  const animado = !ctx.movimentoReduzido
  return {
    nuvens: ctx.subchaves.nuvens && ctx.olhar !== 'imperio',
    maxParticulas: animado && ctx.subchaves.particulas ? (ultra ? 360 : 160) : 0,
    maxPassaros: animado && ctx.subchaves.passaros ? (ultra ? 10 : 6) : 0,
    ventoArvores: animado && ctx.subchaves.ventoArvores,
    tochasObras: ctx.subchaves.tochasObras,
    respostas: ctx.subchaves.respostas,
    velocidadeTempo: animado ? 1 : 0,
  }
}

const PERFIS_PARTICULAS: Readonly<Record<BiomaId, PerfilParticulaBioma>> = {
  clareira: {
    rotulo: 'polen-dourado',
    corPrimaria: '#fef08a',
    corSecundaria: '#fde047',
    velocidadeVertical: 0.14,
    derivaHorizontal: 0.42,
    tamanhoBase: 0.22,
    alturaMin: 0.3,
    alturaMax: 5.5,
  },
  bosque: {
    rotulo: 'vagalumes-esporos',
    corPrimaria: '#bef264',
    corSecundaria: '#86efac',
    velocidadeVertical: 0.1,
    derivaHorizontal: 0.5,
    tamanhoBase: 0.26,
    alturaMin: 0.4,
    alturaMax: 6.2,
  },
  serra_ouro: {
    rotulo: 'poeira-quente',
    corPrimaria: '#fed7aa',
    corSecundaria: '#fbbf24',
    velocidadeVertical: 0.18,
    derivaHorizontal: 0.58,
    tamanhoBase: 0.2,
    alturaMin: 0.3,
    alturaMax: 6.8,
  },
  ribeira: {
    rotulo: 'libelulas-bruma',
    corPrimaria: '#a5f3fc',
    corSecundaria: '#fde047',
    velocidadeVertical: 0.08,
    derivaHorizontal: 0.62,
    tamanhoBase: 0.24,
    alturaMin: 0.3,
    alturaMax: 4.8,
  },
  tundra_cristal: {
    rotulo: 'flocos-cristais',
    corPrimaria: '#f8fafc',
    corSecundaria: '#7dd3fc',
    velocidadeVertical: -0.45,
    derivaHorizontal: 0.35,
    tamanhoBase: 0.25,
    alturaMin: 0.4,
    alturaMax: 9.0,
  },
  basalto_brasa: {
    rotulo: 'brasas-ascendentes',
    corPrimaria: '#fb923c',
    corSecundaria: '#ef4444',
    velocidadeVertical: 0.52,
    derivaHorizontal: 0.32,
    tamanhoBase: 0.24,
    alturaMin: 0.3,
    alturaMax: 8.5,
  },
}

export function perfilParticulaBioma(bioma: BiomaId): PerfilParticulaBioma {
  return PERFIS_PARTICULAS[bioma]
}

export function gerarParticulasBioma(
  i: number,
  j: number,
  bioma: BiomaId,
  quantidade: number,
): readonly ParticulaInstancia[] {
  const n = Math.max(0, Math.floor(Number.isFinite(quantidade) ? quantidade : 0))
  if (n === 0) return []
  const perfil = perfilParticulaBioma(bioma)
  const rand = criarPrng(i, j, 0x4f4150)
  const out: ParticulaInstancia[] = []
  for (let k = 0; k < n; k += 1) {
    out.push({
      x: (rand() * 2 - 1) * 52,
      y: perfil.alturaMin + rand() * (perfil.alturaMax - perfil.alturaMin),
      z: (rand() * 2 - 1) * 52,
      fase: rand() * Math.PI * 2,
      escala: 0.65 + rand() * 0.75,
      misturaCor: rand(),
    })
  }
  return out
}

export function gerarBandoPassaros(
  i: number,
  j: number,
  quantidade: number,
): readonly PassaroInstancia[] {
  const n = Math.max(0, Math.floor(Number.isFinite(quantidade) ? quantidade : 0))
  if (n === 0) return []
  const rand = criarPrng(i, j, 0x424952)
  const out: PassaroInstancia[] = []
  for (let k = 0; k < n; k += 1) {
    const sentido = rand() < 0.5 ? 1 : -1
    out.push({
      centroX: (rand() * 2 - 1) * 18,
      centroZ: (rand() * 2 - 1) * 18,
      raioOrbita: 14 + rand() * 18,
      altitude: 14 + rand() * 8,
      velocidadeAngular: sentido * (0.18 + rand() * 0.14),
      anguloInicial: rand() * Math.PI * 2,
      faseAsa: rand() * Math.PI * 2,
      escala: 0.8 + rand() * 0.45,
    })
  }
  return out
}

export function posicoesTochasObras(
  obras: readonly Obra[],
  campo: ChaoDoDesenho | undefined,
  lagoas: readonly LagoaRasa[] | undefined,
): readonly PontoTochaObra[] {
  const out: PontoTochaObra[] = []
  for (const obra of obras) {
    if (out.length >= MAX_TOCHAS_CENA) break
    const emObra = Boolean(obra.construindoRestante && obra.construindoRestante > 0)
    if (obra.hp <= 0 || emObra) continue
    const ehInimiga = obra.lado === 'inimigo'
    if (!ehInimiga && obra.nivel < 3) continue

    const pegada = pegadaEfetivaFundacao(obra)
    const desnivel = desnivelDaObraNoChao(obra, campo, lagoas)
    const alturaChama = Y_SOLO_VISUAL + desnivel + Math.min(2.4, Math.max(0.95, pegada.dim[1] * 0.72))
    const dx = Math.max(0.55, pegada.dim[0] * 0.42)
    const dz = Math.max(0.55, pegada.dim[2] * 0.42)
    const faseBase = (obra.id * 1.37) % (Math.PI * 2)

    out.push({
      x: pegada.cx - dx,
      y: alturaChama,
      z: pegada.cz + dz,
      fase: faseBase,
      ehInimiga,
    })
    if (out.length < MAX_TOCHAS_CENA) {
      out.push({
        x: pegada.cx + dx,
        y: alturaChama,
        z: pegada.cz + dz,
        fase: faseBase + 1.9,
        ehInimiga,
      })
    }
  }
  return out
}
