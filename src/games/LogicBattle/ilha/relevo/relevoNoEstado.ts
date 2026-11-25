import type { CampoRelevo } from './campoRelevo'
import { gerarRelevoFatiado, guardarRelevoNoCache, type GeracaoRelevo } from './geradorRelevo'

/**
 * O CAMPO DE RELEVO NO ESTADO DO MUNDO (F2, 24/11/2026). Lógica PURA, testada no Node (`relevoNoEstado.test.ts`), com o gerador e o relógio injetáveis.
 *
 * POR QUE FATIADO. Gerar o campo de UM quadrado de uma vez custa 74 ms (medido em 24/11), o que congelaria ~4 quadros a cada quadrado novo (e o jogador atravessa a fronteira andando). Aqui os campos
 * são gerados com `gerarRelevoFatiado` (F0), com um ORÇAMENTO TOTAL por quadro repartido entre as gerações em andamento. Enquanto o campo de um quadrado não termina, `campoDe` devolve `undefined`
 * e o desenho usa o chão PLANO (I1: plano = hoje): NUNCA um campo pela metade.
 *
 * A POLÍTICA (a parte que este módulo decide): fila FIFO (o primeiro pedido é o primeiro a começar: o que o jogador pisa vem antes do que só alimenta o horizonte), no máximo
 * `MAX_GERACOES_SIMULTANEAS` em andamento, nunca gerar o mesmo quadrado duas vezes, esquecer o que saiu de vista, e um gerador que LANÇA não derruba o jogo (vira falha registrada, libera a vaga e
 * não é chamado de novo).
 */

/** Quantas gerações andam ao mesmo tempo. O jogador pisa em 1 quadrado e o horizonte pede os 8 vizinhos: o resto espera. Mais que isto só espalharia o orçamento e atrasaria o quadrado que importa. */
export const MAX_GERACOES_SIMULTANEAS = 2

/** O orçamento de tempo POR QUADRO para gerar relevo, em ms (o mesmo do `gerarRelevoFatiado`: o campo leva ~19 quadros). */
export const ORCAMENTO_POR_QUADRO_MS = 4

export interface RelevoDoMundo {
  /** O campo pronto do quadrado, ou `undefined` enquanto não terminou (o chão fica plano). Nunca um campo pela metade. */
  campoDe(i: number, j: number): CampoRelevo | undefined
  /** Pede o campo de um quadrado. Pedir de novo (em andamento, na fila ou pronto) não faz nada. */
  pedir(i: number, j: number): void
  /** O jogador saiu de vista: descarta a geração em andamento ou na fila (não gasta mais orçamento). Um campo pronto continua em cache. */
  esquecer(i: number, j: number): void
  /** Roda a geração por até `orcamentoMs` NO TOTAL (repartido). Sempre faz ao menos uma unidade de trabalho se houver o que fazer. */
  passo(orcamentoMs: number): void
  emAndamento(): number
  naFila(): number
  /** Os quadrados cujo gerador lançou (ficam sem campo). */
  falhas(): readonly string[]
}

export interface OpcoesDoRelevoDoMundo {
  /** Cria o gerador de um quadrado. Padrão: `gerarRelevoFatiado` (o do F0). */
  readonly fabricar?: (i: number, j: number) => GeracaoRelevo
  /** O relógio em ms. Padrão: `performance.now`. */
  readonly agora?: () => number
}

function chave(i: number, j: number): string {
  return `${i},${j}`
}

export function criarRelevoDoMundo(opcoes: OpcoesDoRelevoDoMundo = {}): RelevoDoMundo {
  const fabricar = opcoes.fabricar ?? gerarRelevoFatiado
  const agora = opcoes.agora ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))

  const prontos = new Map<string, CampoRelevo>()
  const emAndamento = new Map<string, { i: number; j: number; geracao: GeracaoRelevo }>()
  const fila: Array<{ i: number; j: number }> = []
  const falhou: string[] = []

  function jaConhecido(k: string): boolean {
    return prontos.has(k) || emAndamento.has(k) || fila.some((q) => chave(q.i, q.j) === k) || falhou.includes(k)
  }

  function abrirVagas(): void {
    while (emAndamento.size < MAX_GERACOES_SIMULTANEAS && fila.length > 0) {
      const proximo = fila.shift()
      if (!proximo) break
      const k = chave(proximo.i, proximo.j)
      try {
        emAndamento.set(k, { i: proximo.i, j: proximo.j, geracao: fabricar(proximo.i, proximo.j) })
      } catch {
        falhou.push(k)
      }
    }
  }

  return {
    campoDe: (i, j) => prontos.get(chave(i, j)),

    pedir(i, j) {
      const k = chave(i, j)
      if (jaConhecido(k)) return
      fila.push({ i, j })
      abrirVagas()
    },

    esquecer(i, j) {
      const k = chave(i, j)
      emAndamento.delete(k)
      const pos = fila.findIndex((q) => chave(q.i, q.j) === k)
      if (pos >= 0) fila.splice(pos, 1)
      // esquecer uma falha também a libera: se o jogador voltar, tenta de novo (o erro pode ter sido passageiro)
      const f = falhou.indexOf(k)
      if (f >= 0) falhou.splice(f, 1)
      abrirVagas()
    },

    passo(orcamentoMs) {
      const total = Number.isFinite(orcamentoMs) && orcamentoMs > 0 ? orcamentoMs : 0
      abrirVagas()
      if (emAndamento.size === 0) return
      const inicio = agora()
      // Reparte o tempo em turnos: cada gerador recebe uma FATIA do que resta (um orçamento 0 vale «uma unidade»), então o total gasto não passa de `total` mais a unidade em curso.
      do {
        for (const [k, g] of [...emAndamento]) {
          const restante = Math.max(0, total - (agora() - inicio))
          try {
            const terminou = g.geracao.passo(Math.max(0, Math.min(restante, total / Math.max(1, emAndamento.size))))
            if (terminou) {
              const campo = g.geracao.resultado()
              prontos.set(k, campo)
              guardarRelevoNoCache(campo)
              emAndamento.delete(k)
            }
          } catch {
            // um gerador que lança não derruba o jogo nem é chamado de novo: o quadrado fica sem campo (chão plano) e a vaga é liberada
            falhou.push(k)
            emAndamento.delete(k)
          }
          if (agora() - inicio >= total) break
        }
        abrirVagas()
      } while (emAndamento.size > 0 && agora() - inicio < total)
    },

    emAndamento: () => emAndamento.size,
    naFila: () => fila.length,
    falhas: () => [...falhou],
  }
}
