/**
 * provenanceBus.ts
 *
 * Barramento de Proveniência Transacional do Universal Document Compiler.
 *
 * Resolve o problema histórico de "event loops" circulares e perda de cursor
 * entre o editor de código (Monaco / YamlCodeEditorPro) e a manipulação visual
 * na folha (Canvas Livre, Layer Tree, Inspector).
 *
 * Toda mutação passa por este barramento com sua origem explícita:
 * - 'editor': O usuário digitou no editor de código. A AST é atualizada, mas o código não é re-injetado.
 * - 'canvas': O usuário arrastou, redimensionou ou reordenou caixas na folha A4. O código YAML é atualizado cirurgicamente via CST sem resetar o cursor.
 * - 'tree': O usuário reordenou seções na UniversalLayerTree da esquerda.
 * - 'inspector': O usuário alterou propriedades no inspetor lateral direito.
 * - 'system': Cargas iniciais de blueprints, presets ou resets.
 */

export type TransactionOrigin = 'editor' | 'canvas' | 'tree' | 'inspector' | 'system'

export type MutationType =
  | 'content_text'
  | 'reorder_sequence'
  | 'layout_override'
  | 'archetype_switch'
  | 'section_visibility'
  | 'reset'

export interface DocumentTransaction {
  id: string
  origin: TransactionOrigin
  timestamp: number
  mutationType: MutationType
  targetPointer?: string
  payload?: any
}

type TransactionListener = (transaction: DocumentTransaction) => void

class ProvenanceBus {
  private activeTransaction: DocumentTransaction | null = null
  private listeners: Set<TransactionListener> = new Set()

  /**
   * Executa uma ação atômica dentro de um contexto transacional protegido.
   * Evita cascatas recursivas se uma ação tentar disparar outro ciclo durante a execução.
   */
  public execute<T>(
    origin: TransactionOrigin,
    mutationType: MutationType,
    action: () => T,
    targetPointer?: string,
    payload?: any
  ): T {
    if (this.activeTransaction) {
      // Já está em uma transação ativa: executa a ação diretamente sem reentrar
      return action()
    }

    const transaction: DocumentTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      origin,
      timestamp: Date.now(),
      mutationType,
      targetPointer,
      payload
    }

    this.activeTransaction = transaction
    try {
      const result = action()
      this.notifyListeners(transaction)
      return result
    } finally {
      this.activeTransaction = null
    }
  }

  /**
   * Retorna a origem da transação atualmente em execução
   */
  public get currentOrigin(): TransactionOrigin {
    return this.activeTransaction?.origin || 'system'
  }

  /**
   * Verifica se a transação corrente provém de uma origem específica
   */
  public isFrom(origin: TransactionOrigin): boolean {
    return this.currentOrigin === origin
  }

  /**
   * Registra um listener para auditoria e sincronização reativa
   */
  public subscribe(listener: TransactionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(tx: DocumentTransaction) {
    this.listeners.forEach((listener) => {
      try {
        listener(tx)
      } catch (err) {
        console.warn('[ProvenanceBus] Erro no listener de transação:', err)
      }
    })
  }
}

export const provenanceBus = new ProvenanceBus()
