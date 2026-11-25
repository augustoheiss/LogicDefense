/**
 * O FATIAMENTO de trabalho pesado em fatias de tempo (24/11/2026). Lógica PURA, testada no Node (`tarefaFatiada.test.ts`), com o relógio injetado: o teste não depende da velocidade da máquina.
 *
 * POR QUE EXISTE. A geração das texturas de um bioma custa de 280 a 540 ms na thread principal (MEDIDO em 24/11 com a máquina ocupada; 3,1 milhões de chamadas de ruído por pacote, 75% em duas
 * texturas de 512 px) e congelava o jogo ~28 quadros a cada troca de bioma andando. Aqui o trabalho vira uma lista de ETAPAS, cada uma dividida em UNIDADES (uma linha de pixels, por exemplo),
 * e `passo(orcamentoMs)` faz unidades até gastar o orçamento, devolvendo o controle ao laço do jogo (como o `gerarRelevoFatiado` fez com o relevo).
 *
 * AS GARANTIAS (cada uma tem um cenário no teste): (1) a ORDEM é a do código síncrono (o resultado fatiado é idêntico ao síncrono: `terminarTudo` faz o mesmo trabalho de uma vez); (2) SEMPRE AVANÇA:
 * cada `passo` faz ao menos uma unidade, mesmo com orçamento 0, negativo ou NaN (senão a tarefa nunca terminaria); (3) o orçamento só é estourado pela unidade em curso; (4) nunca entrega pela metade:
 * `terminou()` só é verdadeiro com todas as unidades feitas, e uma tarefa cancelada ou que falhou NÃO conta como terminada.
 */

/** Um pedaço do trabalho: `total` unidades, e `fazerUma()` faz UMA e devolve se a etapa terminou. */
export interface Etapa {
  readonly nome: string
  readonly total: number
  fazerUma(): boolean
}

export class TarefaFatiada {
  private indice = 0
  private feitasNaEtapa = 0
  private foiCancelada = false
  private erro: unknown = null
  private readonly totalDeUnidades: number
  private feitas = 0

  constructor(
    private readonly etapas: readonly Etapa[],
    /** O relógio em milissegundos. `performance.now` no jogo; um relógio simulado no teste. */
    private readonly agora: () => number,
  ) {
    this.totalDeUnidades = etapas.reduce((soma, e) => soma + Math.max(0, e.total), 0)
    this.pularEtapasVazias()
  }

  /** Faz unidades até gastar `orcamentoMs` (sempre ao menos uma, a menos que já tenha terminado, falhado ou sido cancelada). `NaN` ou negativo valem 0. Devolve se terminou. */
  passo(orcamentoMs: number): boolean {
    if (this.terminou() || this.foiCancelada || this.erro !== null) return this.terminou()
    const orcamento = Number.isFinite(orcamentoMs) && orcamentoMs > 0 ? orcamentoMs : 0
    const inicio = this.agora()
    do {
      this.fazerUmaUnidade()
    } while (!this.terminou() && !this.foiCancelada && this.erro === null && this.agora() - inicio < orcamento)
    return this.terminou()
  }

  /** Faz TUDO de uma vez (o equivalente síncrono: os testes e o 1º desenho usam isto). Para se a tarefa falhar ou for cancelada. */
  terminarTudo(): void {
    while (!this.terminou() && !this.foiCancelada && this.erro === null) this.fazerUmaUnidade()
  }

  /** Só é verdadeiro com TODAS as unidades feitas: uma tarefa cancelada ou que falhou nunca conta como terminada (o resultado pela metade nunca é entregue). */
  terminou(): boolean {
    return this.indice >= this.etapas.length && !this.foiCancelada && this.erro === null
  }

  /** De 0 a 1, nunca diminui; exatamente 1 no fim. Uma tarefa sem unidades vale 1 (sem dividir por zero). */
  progresso(): number {
    if (this.totalDeUnidades === 0) return 1
    return Math.min(1, this.feitas / this.totalDeUnidades)
  }

  /** Para no meio, sem terminar (o jogador trocou de bioma de novo antes de o pacote ficar pronto). Nenhuma unidade roda depois disto. */
  cancelar(): void {
    this.foiCancelada = true
  }

  cancelada(): boolean {
    return this.foiCancelada
  }

  /** O erro da etapa que lançou, ou `null`. Uma tarefa que falhou para e não tenta de novo em silêncio. */
  falhou(): unknown {
    return this.erro
  }

  private fazerUmaUnidade(): void {
    const etapa = this.etapas[this.indice]
    if (!etapa) return
    try {
      const acabou = etapa.fazerUma()
      this.feitasNaEtapa += 1
      this.feitas += 1
      if (acabou || this.feitasNaEtapa >= etapa.total) {
        this.indice += 1
        this.feitasNaEtapa = 0
        this.pularEtapasVazias()
      }
    } catch (e) {
      this.erro = e
    }
  }

  private pularEtapasVazias(): void {
    while (this.indice < this.etapas.length && this.etapas[this.indice].total <= 0) this.indice += 1
  }
}
