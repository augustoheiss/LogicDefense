/**
 * atomicIdUtils.ts — Gerador de IDs determinísticos e semânticos para itens atômicos do CV Maker.
 * 
 * Evita a armadilha de índices puramente posicionais (work:0, work:1):
 * Se o usuário mover ou deletar um item no YAML, as personalizações do Canvas Livre
 * permanecem vinculadas ao item real (empresa, curso, projeto) e não à posição no array.
 */

export const getAtomicItemId = (category: string, item: any, index: number): string => {
  if (item && typeof item === 'object' && item.id) {
    return `${category}:${item.id}`
  }

  // Extrai nome semântico principal
  const rawIdentifier = 
    item?.company ||
    item?.organization ||
    item?.institution ||
    item?.name ||
    item?.title ||
    item?.language ||
    item?.certificate ||
    ''

  const slug = String(rawIdentifier)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, '')        // apenas alfanuméricos
    .slice(0, 24)

  return slug ? `${category}:${slug}` : `${category}:idx_${index}`
}
