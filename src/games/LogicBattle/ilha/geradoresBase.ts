import type { RedemptionChoice } from './contaContratos'

/**
 * Base comum dos geradores de problema da L7. Funções PURAS e sem estado: não importam o motor de contas (o motor importa os
 * geradores; importar de volta criaria um ciclo, e o `...GERADORES_PROBLEMAS` no topo do motor quebraria na inicialização).
 */
export type Rng = () => number

export const randInt = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1))
export const randPick = <T,>(rng: Rng, itens: readonly T[]): T => itens[Math.floor(rng() * itens.length)]
export const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b))
export const mmc2 = (a: number, b: number): number => (a / mdc(a, b)) * b

export function embaralhar<T>(rng: Rng, xs: readonly T[]): T[] {
  const r = [...xs]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = r[i]
    r[i] = r[j]
    r[j] = t
  }
  return r
}

/** Limite de sorteios por problema. Folga enorme: o pior gerador real aceita em menos de 30 (medido); 200 só existe para NUNCA travar. */
export const MAX_TENTATIVAS = 200

/**
 * Sorteia até `gerar` aceitar (devolver algo diferente de `null`), no máximo MAX_TENTATIVAS vezes; esgotado, devolve `reserva()`.
 * Existe porque `for (;;) { ... continue }` congela a aba inteira se uma edição futura tornar a condição de aceite impossível
 * (o mutante «divisores comuns com ||» queimou 197 s de CPU a 100 %): um jogo não pode travar no modal da conta.
 * `reserva` é um problema fixo, válido e conferido pelo teste; usá-la é raro e inofensivo, travar não é.
 */
export function tentar<T>(rng: Rng, gerar: (rng: Rng) => T | null, reserva: () => T): T {
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    const r = gerar(rng)
    if (r !== null) return r
  }
  return reserva()
}

/** Número em pt-BR para o rótulo: vírgula decimal. */
export const fmt = (n: number): string => String(n).replace('.', ',')

/** Gerador de números pseudoaleatório reproduzível (mesmo algoritmo do motor): só para testes e para quem precisa de semente fixa. */
export function semente(n: number): Rng {
  let s = (n * 2654435761) >>> 0
  if (s === 0) s = 1
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Erro {
  value: number
  diagnosticPt: string
}

/** Texto depois do número no rótulo: fixo (' km') ou {singular, plural}. */
export type Sufixo = string | { singular: string; plural: string }
const comSufixo = (n: number, sufixo: Sufixo): string => `${fmt(n)}${typeof sufixo === 'string' ? sufixo : ` ${n === 1 ? sufixo.singular : sufixo.plural}`}`

/**
 * Monta as 4 alternativas: a certa + até 3 erros típicos DISTINTOS (completa com vizinhos se faltar). Cada erro carrega o
 * diagnóstico. `sufixo` vai depois do número no rótulo: texto fixo (' km') ou {singular, plural} para «1 hora» / «2 horas».
 * Valores não positivos, não finitos ou repetidos são descartados e trocados por vizinhos da certa.
 */
export function quatro(rng: Rng, certa: number, diagCerta: string, erros: readonly Erro[], sufixo: Sufixo = ''): RedemptionChoice[] {
  const usados = new Set<number>([certa])
  const outros: Erro[] = []
  for (const e of erros) {
    if (e.value > 0 && Number.isFinite(e.value) && !usados.has(e.value)) {
      usados.add(e.value)
      outros.push(e)
    }
    if (outros.length === 3) break
  }
  let d = 1
  while (outros.length < 3) {
    for (const v of [certa + d, certa - d]) {
      if (outros.length < 3 && v > 0 && !usados.has(v)) {
        usados.add(v)
        outros.push({ value: v, diagnosticPt: 'Quase lá! Refaça a conta com calma, passo a passo, usando a Luz-Guia.' })
      }
    }
    d++
  }
  const brutas: Array<Omit<RedemptionChoice, 'id'>> = [
    { value: certa, label: comSufixo(certa, sufixo), isCorrect: true, diagnosticPt: diagCerta },
    ...outros.map((e) => ({ value: e.value, label: comSufixo(e.value, sufixo), isCorrect: false, diagnosticPt: e.diagnosticPt })),
  ]
  return embaralhar(rng, brutas).map((c, i) => ({ ...c, id: `c${i + 1}` }))
}

/** «1 hora» / «2 horas»: o plural do português só vale a partir de 2. `plural` pode ser dado quando não basta acrescentar «s». */
export const pl = (n: number, singular: string, plural = `${singular}s`): string => `${n} ${n === 1 ? singular : plural}`
