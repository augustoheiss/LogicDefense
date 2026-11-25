import type { BiomaId } from '../biomaRecursos'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'
import type { SpecQualidadeGrafica } from './qualidadeGrafica'

/**
 * O SOL e o AMBIENTE de cada bioma (24/11/2026, F1 Task 8b): lógica PURA, testada no Node (`ceuEIbl.test.ts`). O desenho (`AtmosferaBioma.tsx`, `ambientePmrem.ts`) só obedece ao que sai daqui.
 *
 * POR QUE UMA FUNÇÃO SÓ PARA A DIREÇÃO. Medido na cena viva: o disco do sol que o shader do CÉU desenhava apontava sempre para `vec3(0.45, 0.62, 0.32)`, fixo, e a luz que ilumina o chão e
 * projeta a sombra usava `posicaoSol` do catálogo, diferente em cada bioma. Só a clareira coincidia: nos outros cinco o sol do céu e o sol do chão ficavam em lados opostos (na serra do ouro,
 * 110° de azimute de diferença). Agora o disco e a luz saem de `direcaoDoSol`, e não podem mais divergir.
 */

/** O deslize do sol: ±6° de azimute em 10 minutos (o plano aprovado). Só o AZIMUTE anda; a elevação é a do bioma. */
export const DESLIZE_DO_SOL_GRAUS = 6
export const PERIODO_DO_SOL_SEG = 600

/** A que distância do alvo a luz direcional fica. Longe o bastante para as sombras saírem paralelas; perto o bastante para caber no `far` (140) do frustum de sombra. */
export const DISTANCIA_DA_LUZ = 45

const PARA_RADIANOS = Math.PI / 180

/** O tempo vira um número finito e não negativo: NaN, negativo e infinito valem 0 (o plano: «NaN→0»); o resto é reduzido ao período para um relógio que corre por horas não perder precisão. */
function tempoValido(tempoSeg: number): number {
  if (!Number.isFinite(tempoSeg) || tempoSeg < 0) return 0
  return tempoSeg % PERIODO_DO_SOL_SEG
}

export type Vetor3 = readonly [number, number, number]

/**
 * A direção UNITÁRIA do sol (do chão para o sol) no instante `tempoSeg`. A elevação é `elevacaoSolGraus` do catálogo; o azimute parte do de `posicaoSol` (o sol não muda de lado em relação
 * ao jogo de antes) e oscila ±`DESLIZE_DO_SOL_GRAUS` com período `PERIODO_DO_SOL_SEG`: um seno, então em t = 0 está no azimute do catálogo e o movimento é suave, sem salto ao dar a volta.
 * Convenção (a mesma do jogo): azimute 0 = +Z, 90° = +X; Y é para cima.
 */
export function direcaoDoSol(bioma: BiomaId, tempoSeg: number): Vetor3 {
  const cat = BIOMA_VISUAL_CATALOG[bioma]
  const [px, , pz] = cat.posicaoSol
  const azimuteBase = Math.atan2(px, pz)
  const t = tempoValido(tempoSeg)
  const azimute = azimuteBase + DESLIZE_DO_SOL_GRAUS * PARA_RADIANOS * Math.sin((2 * Math.PI * t) / PERIODO_DO_SOL_SEG)
  const elevacao = cat.elevacaoSolGraus * PARA_RADIANOS
  const horizontal = Math.cos(elevacao)
  return [Math.sin(azimute) * horizontal, Math.sin(elevacao), Math.cos(azimute) * horizontal]
}

/** A posição da luz direcional RELATIVA ao alvo: a mesma direção do disco do céu, a `DISTANCIA_DA_LUZ`. O chamador soma o centro do foco (o frustum de sombra segue o jogador). */
export function posicaoDoSol(bioma: BiomaId, tempoSeg: number): Vetor3 {
  const d = direcaoDoSol(bioma, tempoSeg)
  return [d[0] * DISTANCIA_DA_LUZ, d[1] * DISTANCIA_DA_LUZ, d[2] * DISTANCIA_DA_LUZ]
}

export interface AmbienteDoBioma {
  /** A cor do céu no alto. */
  readonly topo: string
  /** A cor do céu no horizonte. */
  readonly horizonte: string
  /** A cor do que está embaixo (o chão visto de cima): a luz que sobe, refletida do solo. */
  readonly solo: string
  /** A cor do sol (o disco do ambiente, quente). */
  readonly corSol: string
  /** O quanto o ambiente ilumina (`scene.environmentIntensity`). */
  readonly intensidade: number
}

/**
 * Do que o AMBIENTE (IBL) de um bioma é feito. Sai das cores que o catálogo já desenhou para o céu e para o chão, NÃO de um céu físico genérico: o modelo Preetham do `Sky` do three é uma
 * atmosfera terrestre azul, e a tundra roxa e o basalto em brasa perderiam a identidade que o catálogo deu a cada bioma. O ouro reflete o céu DESTE bioma.
 */
export function ambienteDoBioma(bioma: BiomaId): AmbienteDoBioma {
  const cat = BIOMA_VISUAL_CATALOG[bioma]
  return { topo: cat.ceuTopo, horizonte: cat.ceuHorizonte, solo: cat.luzChao, corSol: cat.corSol, intensidade: cat.intensidadeAmbiente }
}

export interface ContextoDoAmbiente {
  /** `PARTIDA.ambienteIbl`: a chave de rollback. Desligada = sem ambiente, o jogo de antes. */
  readonly chaveLigada: boolean
  /** O `webglcontextlost` foi disparado: nada novo pode ser criado (os alvos de render morreram com o contexto). */
  readonly contextoPerdido: boolean
}

/**
 * Se o ambiente (IBL) deve EXISTIR agora. Só o Bonito e o Ultra o têm (o plano): o Leve é a rede de segurança de máquina fraca e não paga por um reflexo que o chão rugoso quase não mostra;
 * com a chave desligada o jogo é o de antes; com o contexto perdido não se cria nada. A regra «o Leve nunca» mora no campo `ambiente` do spec, que NÃO depende do composer (`posProcessamento`):
 * ligar o composer num nível não pode ligar o ambiente por tabela (e o contrário).
 */
export function ambienteDeveExistir(spec: SpecQualidadeGrafica, contexto: ContextoDoAmbiente): boolean {
  if (!contexto.chaveLigada || contexto.contextoPerdido) return false
  return spec.ambiente
}

/** A chave do pool de ambientes: o bioma. (O cubo tem o mesmo lado no Bonito e no Ultra, então o nível não entra: um ambiente gerado no Bonito serve ao Ultra.) */
export function chaveDoAmbiente(bioma: BiomaId): string {
  return `ambiente:${bioma}`
}

function limitar01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

/**
 * Quanto do ambiente (IBL) um material deve receber, em [0, 1]: o reflexo é de quem REFLETE (metal e superfície lisa), não de quem só difunde. Medido em 24/11 na clareira (mesma sessão, só o
 * ambiente alternado): o ambiente global a 0,55 somava +44% de luz à estrada e +40% à grama e esfriava tudo (a estrada: azul/vermelho 1,47 → 2,04; a grama amarelada virava azul-esverdeada),
 * porque o chão e a estrada são rugosos (`r ≥ 0,88`) e recebiam o ambiente como LUZ DIFUSA, somada à hemisférica que o jogo já tem. Com o fator por material o chão volta à cor de antes e só os
 * brilhantes (ouro m0,72 r0,22 → 0,94; obra de metal m0,68 r0,28 → 0,82; cristal m0,42 r0,36 → 0,5) ganham reflexo. A metalicidade pesa mais; a lisura entra ao quadrado (de r = 1 a r = 0,5
 * quase nada muda; só a superfície realmente lisa reflete nítido). Entrada fora de faixa ou NaN é limitada, nunca estoura.
 */
export function fatorDeReflexo(metalicidade: number, rugosidade: number): number {
  const m = limitar01(metalicidade)
  const lisura = (1 - limitar01(rugosidade)) ** 2
  return limitar01(m * 0.7 + lisura * 0.5 + m * lisura * 0.3)
}
