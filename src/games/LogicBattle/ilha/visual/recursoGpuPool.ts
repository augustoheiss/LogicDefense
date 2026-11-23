export interface RecursoDescartavel {
  dispose(): void
}

export interface EstatisticasPoolGpu {
  readonly ativos: number
  readonly capacidade: number
  readonly criados: number
  readonly evictados: number
  readonly descartados: number
  readonly descartesPorCorrida: number
  readonly requestSeqAtual: number
}

interface EntradaPool<T extends RecursoDescartavel> {
  chave: string
  recurso: T
  ultimoUsoSeq: number
}

/**
 * Cache LRU estrito com limpeza deterministica (.dispose()) de texturas/materiais GPU
 * e cancelamento por requestSeq para trocas rapidas de minimapa.
 */
export class BiomeGpuAssetPool<T extends RecursoDescartavel> {
  readonly capacidade: number
  private entradas = new Map<string, EntradaPool<T>>()
  private usoSeq = 0
  private requestSeq = 0
  private criados = 0
  private evictados = 0
  private descartados = 0
  private descartesPorCorrida = 0

  constructor(capacidade = 2) {
    this.capacidade = Math.max(1, Math.floor(capacidade))
  }

  tem(chave: string): boolean {
    return this.entradas.has(chave)
  }

  obterExistente(chave: string): T | null {
    const entrada = this.entradas.get(chave)
    if (!entrada) return null
    entrada.ultimoUsoSeq = ++this.usoSeq
    return entrada.recurso
  }

  obterOuCriar(chave: string, fabrica: () => T): T {
    const existente = this.obterExistente(chave)
    if (existente) return existente
    const criado = fabrica()
    this.inserir(chave, criado)
    return criado
  }

  async adquirirAsync(chave: string, fabricaAsync: () => Promise<T | null>): Promise<T | null> {
    const seq = ++this.requestSeq
    const existente = this.obterExistente(chave)
    if (existente) return existente

    const criado = await fabricaAsync()
    if (!criado) return null

    if (seq !== this.requestSeq) {
      this.descartesPorCorrida += 1
      this.descartados += 1
      criado.dispose()
      return null
    }
    const jaExiste = this.obterExistente(chave)
    if (jaExiste) {
      this.descartados += 1
      criado.dispose()
      return jaExiste
    }
    this.inserir(chave, criado)
    return criado
  }

  private inserir(chave: string, recurso: T): void {
    this.criados += 1
    while (this.entradas.size >= this.capacidade) {
      let maisAntigo: EntradaPool<T> | null = null
      for (const item of this.entradas.values()) {
        if (!maisAntigo || item.ultimoUsoSeq < maisAntigo.ultimoUsoSeq) {
          maisAntigo = item
        }
      }
      if (!maisAntigo) break
      this.entradas.delete(maisAntigo.chave)
      this.evictados += 1
      this.descartados += 1
      maisAntigo.recurso.dispose()
    }
    this.entradas.set(chave, {
      chave,
      recurso,
      ultimoUsoSeq: ++this.usoSeq,
    })
  }

  descartarTudo(): void {
    for (const item of this.entradas.values()) {
      this.descartados += 1
      item.recurso.dispose()
    }
    this.entradas.clear()
    this.requestSeq += 1
  }

  estatisticas(): EstatisticasPoolGpu {
    return {
      ativos: this.entradas.size,
      capacidade: this.capacidade,
      criados: this.criados,
      evictados: this.evictados,
      descartados: this.descartados,
      descartesPorCorrida: this.descartesPorCorrida,
      requestSeqAtual: this.requestSeq,
    }
  }
}
