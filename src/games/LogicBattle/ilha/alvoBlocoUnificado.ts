import {
  BlocoMaterial,
  blocoMundoParaCentro,
  chaveBlocoMundo,
  dentroLimiteBlocoMundo,
  MapaBlocos,
  PASSO_BLOCO_MUNDO,
  SPEC_BLOCO_MATERIAL,
} from './blocosMundo'
import { PARTIDA } from './partidaPolicies'
import { AlvoEdicaoVoxel, normalDominanteMundo, Ponto3D } from './verticalidadeVoxel'

export type MotivoEdicaoBloco =
  | 'ok'
  | 'sem_recurso'
  | 'sem_madeira'
  | 'colide_corpo'
  | 'colide_entidade'
  | 'fora_limite'
  | 'nao_revelado'
  | 'ocupado'
  | 'vazio'
  | 'ultimo_bloco'

export type AlvoEdicaoMundo = {
  tipo: 'mundo'
  gx: number
  gy: number
  gz: number
  material: BlocoMaterial
  wx: number
  wy: number
  wz: number
  passo: number
  acao: 'adicionar' | 'remover'
  valido: boolean
  motivo: MotivoEdicaoBloco
}

export type AlvoEdicaoObraLivre = {
  tipo: 'obraLivre'
  obraId: number
  gx: number
  gy: number
  gz: number
  material: BlocoMaterial
  wx: number
  wy: number
  wz: number
  passo: number
  acao: 'adicionar' | 'remover'
  valido: boolean
  motivo: MotivoEdicaoBloco
}

export type AlvoEdicaoUnificado =
  | (Omit<AlvoEdicaoVoxel, 'motivo'> & {
      tipo: 'nv5'
      passo: number
      motivo: MotivoEdicaoBloco
    })
  | AlvoEdicaoMundo
  | AlvoEdicaoObraLivre

export interface RecursosDisponiveis {
  madeira: number
  lingotes: number
  ouro: number
}

const CORPO_RAIO = 0.28
const ALTURA_CORPO = 1.48

export function recursoParaMaterial(recursos: RecursosDisponiveis, material: BlocoMaterial): number {
  const rec = SPEC_BLOCO_MATERIAL[material].recurso
  return recursos[rec]
}

export function temRecursoParaMaterial(recursos: RecursosDisponiveis, material: BlocoMaterial, qtd = 1): boolean {
  return recursoParaMaterial(recursos, material) >= SPEC_BLOCO_MATERIAL[material].qtd * qtd
}

export function blocoColideHeroi(gx: number, gy: number, gz: number, heroi: Ponto3D | null): boolean {
  if (!heroi) return false
  const c = blocoMundoParaCentro(gx, gy, gz)
  const h = PASSO_BLOCO_MUNDO / 2
  const baseY = gy * PASSO_BLOCO_MUNDO
  const topoY = baseY + PASSO_BLOCO_MUNDO
  const bateH = Math.abs(heroi.x - c.x) < h + CORPO_RAIO && Math.abs(heroi.z - c.z) < h + CORPO_RAIO
  const bateV = heroi.y < topoY - 0.1 && heroi.y + ALTURA_CORPO > baseY + 0.05
  return bateH && bateV
}

export function blocoColideUnidades(
  gx: number,
  gy: number,
  gz: number,
  unidades: readonly { x: number; z: number; hp: number }[],
): boolean {
  if (gy > 1) return false
  const c = blocoMundoParaCentro(gx, gy, gz)
  const h = PASSO_BLOCO_MUNDO / 2 + PARTIDA.body
  return unidades.some((u) => u.hp > 0 && Math.abs(u.x - c.x) < h && Math.abs(u.z - c.z) < h)
}

export interface ContextoValidacaoBlocoMundo {
  blocosMapa: MapaBlocos
  recursos: RecursosDisponiveis
  heroi: Ponto3D | null
  unidades: readonly { x: number; z: number; hp: number }[]
  chaoRevelado: (x: number, z: number) => boolean
  colideObraEm: (gx: number, gy: number, gz: number) => boolean
}

export function validarAdicionarBlocoMundo(
  gx: number,
  gy: number,
  gz: number,
  material: BlocoMaterial,
  ctx: ContextoValidacaoBlocoMundo,
): { valido: boolean; motivo: MotivoEdicaoBloco } {
  if (!dentroLimiteBlocoMundo(gx, gy, gz)) return { valido: false, motivo: 'fora_limite' }
  const c = blocoMundoParaCentro(gx, gy, gz)
  if (!ctx.chaoRevelado(c.x, c.z)) return { valido: false, motivo: 'nao_revelado' }
  if (ctx.blocosMapa[chaveBlocoMundo(gx, gy, gz)]) return { valido: false, motivo: 'ocupado' }
  if (!temRecursoParaMaterial(ctx.recursos, material, 1)) {
    return { valido: false, motivo: material === 'madeira' ? 'sem_madeira' : 'sem_recurso' }
  }
  if (blocoColideHeroi(gx, gy, gz, ctx.heroi)) return { valido: false, motivo: 'colide_corpo' }
  if (blocoColideUnidades(gx, gy, gz, ctx.unidades)) return { valido: false, motivo: 'colide_entidade' }
  if (ctx.colideObraEm(gx, gy, gz)) return { valido: false, motivo: 'ocupado' }
  return { valido: true, motivo: 'ok' }
}

export function resolverAlvoBlocoMundoPorFace(
  gx: number,
  gy: number,
  gz: number,
  hitPoint: Ponto3D,
  acao: 'adicionar' | 'remover',
  material: BlocoMaterial,
  ctx: ContextoValidacaoBlocoMundo,
): AlvoEdicaoMundo | null {
  const atual = ctx.blocosMapa[chaveBlocoMundo(gx, gy, gz)]
  if (acao === 'remover') {
    if (!atual || atual.hp <= 0 || atual.lado !== 'nosso') return null
    const c = blocoMundoParaCentro(gx, gy, gz)
    return {
      tipo: 'mundo',
      gx,
      gy,
      gz,
      material: atual.material,
      wx: c.x,
      wy: c.y,
      wz: c.z,
      passo: PASSO_BLOCO_MUNDO,
      acao: 'remover',
      valido: true,
      motivo: 'ok',
    }
  }
  const centroAtual = blocoMundoParaCentro(gx, gy, gz)
  const [dx, dy, dz] = normalDominanteMundo(hitPoint, centroAtual)
  const nx = gx + dx
  const ny = gy + dy
  const nz = gz + dz
  const c = blocoMundoParaCentro(nx, ny, nz)
  const check = validarAdicionarBlocoMundo(nx, ny, nz, material, ctx)
  return {
    tipo: 'mundo',
    gx: nx,
    gy: ny,
    gz: nz,
    material,
    wx: c.x,
    wy: c.y,
    wz: c.z,
    passo: PASSO_BLOCO_MUNDO,
    acao: 'adicionar',
    valido: check.valido,
    motivo: check.motivo,
  }
}

export function resolverAlvoBlocoNoChao(
  wx: number,
  wz: number,
  material: BlocoMaterial,
  ctx: ContextoValidacaoBlocoMundo,
): AlvoEdicaoMundo {
  const gx = Math.round(wx / PASSO_BLOCO_MUNDO)
  const gz = Math.round(wz / PASSO_BLOCO_MUNDO)
  const gy = 0
  const c = blocoMundoParaCentro(gx, gy, gz)
  const check = validarAdicionarBlocoMundo(gx, gy, gz, material, ctx)
  return {
    tipo: 'mundo',
    gx,
    gy,
    gz,
    material,
    wx: c.x,
    wy: c.y,
    wz: c.z,
    passo: PASSO_BLOCO_MUNDO,
    acao: 'adicionar',
    valido: check.valido,
    motivo: check.motivo,
  }
}

export function mensagemMotivoBloco(motivo: MotivoEdicaoBloco, material: BlocoMaterial = 'madeira'): string {
  switch (motivo) {
    case 'sem_madeira':
      return 'Madeira insuficiente (precisa 1 madeira)'
    case 'sem_recurso':
      return `Recurso insuficiente (${SPEC_BLOCO_MATERIAL[material].nome})`
    case 'colide_corpo':
      return 'Afaste o herói para colocar o bloco'
    case 'colide_entidade':
      return 'Espaço ocupado por unidade'
    case 'fora_limite':
      return 'Fora do limite do mapa ou altura máxima'
    case 'nao_revelado':
      return 'Explore a área sob a neblina antes de construir'
    case 'ocupado':
      return 'Espaço já ocupado por bloco ou construção'
    case 'ultimo_bloco':
      return 'Não é possível remover o último bloco da estrutura consagrada'
    case 'vazio':
      return 'Nenhum bloco selecionado'
    case 'ok':
      return ''
  }
}
