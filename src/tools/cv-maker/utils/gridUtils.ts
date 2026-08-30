/**
 * Helper para Grid Dinâmico Inteligente no CV-Maker
 *
 * - count <= 1 -> 'cv-grid-1' (1 coluna, 100% largura sem divisões)
 * - count == 2 -> 'cv-grid-2' (2 colunas 50/50)
 * - count == 3 -> 'cv-grid-3' (3 colunas)
 * - count == 4 -> 'cv-grid-4' (2 colunas 2x2, equilibrado)
 * - count == 5 -> 'cv-grid-5' (3 colunas na 1ª linha, 2 na 2ª linha via span 2/3)
 * - count % 3 == 0 -> 'cv-grid-3' (múltiplos de 3 em 3 colunas)
 * - count % 3 == 1 -> 'cv-grid-2' (2 colunas para nunca sobrar 1 isolado)
 * - count % 3 == 2 -> 'cv-grid-split-3-2' (3 na 1ª linha, 2 na 2ª linha)
 */
export function getGridClass(count: number): string {
  if (count <= 1) return 'cv-grid-1'
  if (count === 2) return 'cv-grid-2'
  if (count === 3) return 'cv-grid-3'
  if (count === 4) return 'cv-grid-4'
  if (count === 5) return 'cv-grid-5'
  if (count % 3 === 0) return 'cv-grid-3'
  if (count % 3 === 1) return 'cv-grid-2'
  return 'cv-grid-split-3-2'
}
