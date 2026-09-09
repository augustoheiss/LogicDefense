/**
 * ASTSequenceMutator.ts
 *
 * Mutador Atômico de Árvore Sintática Concreta (CST) utilizando eemeli/yaml (v2).
 *
 * Garante mutações cirúrgicas in-place no código-fonte YAML disparadas por
 * interações no Canvas Livre ou na Árvore de Camadas, com preservação estrita de:
 * 1. Comentários inline (# ...) e blocos de documentação
 * 2. Espaçamentos, quebras de linha e recuos estéticos do usuário
 * 3. Indentação e estilo de quoting
 */

import { parseDocument, isSeq, isMap, type Pair } from 'yaml'

export interface ReorderSequenceIntent {
  parentKey?: string       // Se vazio ou ausente, reordena seções no nível superior do documento
  sourceIndex: number      // Índice atual do item a ser movido
  targetIndex: number      // Novo índice desejado para o item
}

export interface ReorderSectionKeyIntent {
  sourceKey: string        // Chave da seção que foi arrastada (ex: "cronograma_entregas")
  targetIndex: number      // Nova posição na lista de seções
}

export class ASTSequenceMutator {
  /**
   * Reordena nós no nível superior (seções do documento) ou dentro de uma sequência (itens de uma seção).
   * Preserva todos os tokens de comentários e formatação.
   */
  public static reorder(yamlSource: string, intent: ReorderSequenceIntent): string {
    if (!yamlSource || typeof yamlSource !== 'string') return yamlSource

    try {
      const doc = parseDocument(yamlSource, { keepSourceTokens: true })

      if (!intent.parentKey) {
        // Reordenação de chaves de nível superior
        if (isMap(doc.contents)) {
          const items: Pair<any, any>[] = doc.contents.items
          if (
            intent.sourceIndex >= 0 &&
            intent.sourceIndex < items.length &&
            intent.targetIndex >= 0 &&
            intent.targetIndex < items.length
          ) {
            const [movedPair] = items.splice(intent.sourceIndex, 1)
            items.splice(intent.targetIndex, 0, movedPair)
            return doc.toString()
          }
        }
      } else {
        // Reordenação dentro de uma sequência mapeada (ex: "cronograma_entregas" ou "work")
        const path = intent.parentKey.split('/').filter(Boolean)
        const seq = doc.getIn(path)
        if (isSeq(seq)) {
          if (
            intent.sourceIndex >= 0 &&
            intent.sourceIndex < seq.items.length &&
            intent.targetIndex >= 0 &&
            intent.targetIndex < seq.items.length
          ) {
            const [movedItem] = seq.items.splice(intent.sourceIndex, 1)
            seq.items.splice(intent.targetIndex, 0, movedItem)
            return doc.toString()
          }
        }
      }

      return yamlSource
    } catch (err) {
      console.warn('[ASTSequenceMutator] Falha ao reordenar sequência via CST:', err)
      return yamlSource
    }
  }

  /**
   * Reordena uma seção top-level pelo nome da chave (ex: mover "kpis_desempenho" para a posição 1)
   */
  public static reorderTopLevelKey(yamlSource: string, sourceKey: string, targetIndex: number): string {
    if (!yamlSource || !sourceKey) return yamlSource

    try {
      const doc = parseDocument(yamlSource, { keepSourceTokens: true })
      if (!isMap(doc.contents)) return yamlSource

      const items: Pair<any, any>[] = doc.contents.items
      const sourceIdx = items.findIndex((p) => String(p.key?.value ?? p.key) === sourceKey)
      if (sourceIdx === -1) return yamlSource

      const clampedTarget = Math.max(0, Math.min(items.length - 1, targetIndex))
      if (sourceIdx === clampedTarget) return yamlSource

      const [movedPair] = items.splice(sourceIdx, 1)
      items.splice(clampedTarget, 0, movedPair)

      return doc.toString()
    } catch (err) {
      console.warn('[ASTSequenceMutator] Falha ao reordenar chave top-level:', err)
      return yamlSource
    }
  }

  /**
   * Atualiza um valor primitivo ou objeto em um caminho semântico pontual,
   * preservando os comentários ao redor.
   */
  public static setInPlace(yamlSource: string, path: (string | number)[], value: any): string {
    try {
      const doc = parseDocument(yamlSource, { keepSourceTokens: true })
      doc.setIn(path, value)
      return doc.toString()
    } catch (err) {
      console.warn('[ASTSequenceMutator] Falha ao atualizar valor in-place:', err)
      return yamlSource
    }
  }
}
