import {
  BlocoMaterial,
  BlocoMundo,
  blocoMundoParaCentro,
  chaveBlocoMundo,
  chaveColunaMundo,
  criarBlocoMundo,
  dentroLimiteBlocoMundo,
  MapaBlocos,
  PASSO_BLOCO_MUNDO,
} from './blocosMundo'
import {
  blocoColideHeroi,
  blocoColideUnidades,
  MotivoEdicaoBloco,
  RecursosDisponiveis,
  temRecursoParaMaterial,
} from './alvoBlocoUnificado'
import type { Bloqueio } from './caminho'
import type { Ponto3D } from './verticalidadeVoxel'

export const COTA_ESTORNO_BLUEPRINT_NV5 = 4

const CORPO_BLOCO = 0.26
const ALTURA_CORPO = 1.48

export function calcularEstornoMadeiraNv5(
  estornosAtuais: number | undefined,
  acao: 'adicionar' | 'remover',
): { deltaMadeira: number; proximosEstornos: number } {
  const saldo = estornosAtuais ?? COTA_ESTORNO_BLUEPRINT_NV5
  if (acao === 'adicionar') {
    return { deltaMadeira: -1, proximosEstornos: saldo + 1 }
  }
  if (saldo > 0) {
    return { deltaMadeira: 1, proximosEstornos: saldo - 1 }
  }
  return { deltaMadeira: 0, proximosEstornos: 0 }
}

export function bateObraLivre(
  x: number,
  pesY: number,
  z: number,
  blocosLivres: readonly BlocoMundo[] | undefined,
  raio = CORPO_BLOCO,
): boolean {
  if (!blocosLivres || blocosLivres.length === 0) return false
  const h = PASSO_BLOCO_MUNDO / 2
  for (const bloco of blocosLivres) {
    if (bloco.hp <= 0) continue
    const baseY = bloco.y * PASSO_BLOCO_MUNDO
    const topoY = baseY + PASSO_BLOCO_MUNDO
    if (pesY >= topoY - 0.25 || pesY + ALTURA_CORPO <= baseY + 0.06) continue
    if (Math.abs(x - bloco.x) < h + raio && Math.abs(z - bloco.z) < h + raio) {
      return true
    }
  }
  return false
}

export function pisoObraLivreEm(
  x: number,
  pesY: number,
  z: number,
  blocosLivres: readonly BlocoMundo[] | undefined,
  raio = CORPO_BLOCO,
): number {
  if (!blocosLivres || blocosLivres.length === 0) return 0
  let piso = 0
  const h = PASSO_BLOCO_MUNDO / 2
  for (const bloco of blocosLivres) {
    if (bloco.hp <= 0) continue
    if (Math.abs(x - bloco.x) >= h + raio || Math.abs(z - bloco.z) >= h + raio) continue
    const topo = (bloco.y + 1) * PASSO_BLOCO_MUNDO
    if (pesY >= topo - 0.65) piso = Math.max(piso, topo)
  }
  return piso
}

export function tetoObraLivreEm(
  x: number,
  pesY: number,
  z: number,
  blocosLivres: readonly BlocoMundo[] | undefined,
  raio = CORPO_BLOCO,
): number {
  if (!blocosLivres || blocosLivres.length === 0) return Number.POSITIVE_INFINITY
  let teto = Number.POSITIVE_INFINITY
  const h = PASSO_BLOCO_MUNDO / 2
  const cabecaY = pesY + ALTURA_CORPO
  for (const bloco of blocosLivres) {
    if (bloco.hp <= 0) continue
    if (Math.abs(x - bloco.x) >= h + raio || Math.abs(z - bloco.z) >= h + raio) continue
    const base = bloco.y * PASSO_BLOCO_MUNDO
    if (base >= cabecaY - 0.15) {
      teto = Math.min(teto, base - ALTURA_CORPO)
    }
  }
  return teto
}

export function bloqueiosDeObraLivre(blocosLivres: readonly BlocoMundo[] | undefined): Bloqueio[] {
  if (!blocosLivres || blocosLivres.length === 0) return []
  const colunas = new Set<string>()
  const out: Bloqueio[] = []
  for (const bloco of blocosLivres) {
    if (bloco.hp <= 0 || bloco.y > 1) continue
    const k = chaveColunaMundo(bloco.x, bloco.z)
    if (colunas.has(k)) continue
    colunas.add(k)
    out.push({ x: bloco.x, z: bloco.z, hx: 0.5, hz: 0.5 })
  }
  return out
}

export function meiaLarguraObraLivre(
  blocosLivres: readonly BlocoMundo[],
  obraX: number,
  obraZ: number,
): { hx: number; hz: number } {
  let hx = 1.0
  let hz = 1.0
  for (const b of blocosLivres) {
    if (b.hp <= 0) continue
    hx = Math.max(hx, Math.abs(b.x - obraX) + 0.5)
    hz = Math.max(hz, Math.abs(b.z - obraZ) + 0.5)
  }
  return { hx, hz }
}

export function validarAdicionarBlocoObraLivre(
  blocosLivres: readonly BlocoMundo[],
  gx: number,
  gy: number,
  gz: number,
  material: BlocoMaterial,
  recursos: RecursosDisponiveis,
  heroi: Ponto3D | null,
  unidades: readonly { x: number; z: number; hp: number }[],
  blocosMapa?: MapaBlocos,
): { valido: boolean; motivo: MotivoEdicaoBloco } {
  if (!dentroLimiteBlocoMundo(gx, gy, gz)) return { valido: false, motivo: 'fora_limite' }
  if (blocosLivres.some((b) => b.x === gx && b.y === gy && b.z === gz && b.hp > 0)) {
    return { valido: false, motivo: 'ocupado' }
  }
  if (blocosMapa && blocosMapa[chaveBlocoMundo(gx, gy, gz)]) {
    return { valido: false, motivo: 'ocupado' }
  }
  if (!temRecursoParaMaterial(recursos, material, 1)) {
    return { valido: false, motivo: material === 'madeira' ? 'sem_madeira' : 'sem_recurso' }
  }
  if (blocoColideHeroi(gx, gy, gz, heroi)) return { valido: false, motivo: 'colide_corpo' }
  if (blocoColideUnidades(gx, gy, gz, unidades)) return { valido: false, motivo: 'colide_entidade' }
  return { valido: true, motivo: 'ok' }
}

export function editarBlocoEmObraLivre(
  blocosLivres: readonly BlocoMundo[],
  gx: number,
  gy: number,
  gz: number,
  acao: 'adicionar' | 'remover',
  material: BlocoMaterial,
  heroi: Ponto3D | null,
  unidades: readonly { x: number; z: number; hp: number }[],
  blocosMapa?: MapaBlocos,
): { ok: true; blocos: BlocoMundo[]; materialAfetado: BlocoMaterial } | { ok: false; motivo: MotivoEdicaoBloco } {
  if (acao === 'remover') {
    const idx = blocosLivres.findIndex((b) => b.x === gx && b.y === gy && b.z === gz && b.hp > 0)
    if (idx < 0) return { ok: false, motivo: 'vazio' }
    if (blocosLivres.filter((b) => b.hp > 0).length <= 1) {
      return { ok: false, motivo: 'ultimo_bloco' }
    }
    const removido = blocosLivres[idx]
    const blocos = blocosLivres.filter((_, i) => i !== idx)
    return { ok: true, blocos, materialAfetado: removido.material }
  }
  if (!dentroLimiteBlocoMundo(gx, gy, gz)) return { ok: false, motivo: 'fora_limite' }
  if (blocosLivres.some((b) => b.x === gx && b.y === gy && b.z === gz && b.hp > 0)) {
    return { ok: false, motivo: 'ocupado' }
  }
  if (blocosMapa && blocosMapa[chaveBlocoMundo(gx, gy, gz)]) {
    return { ok: false, motivo: 'ocupado' }
  }
  if (blocoColideHeroi(gx, gy, gz, heroi)) return { ok: false, motivo: 'colide_corpo' }
  if (blocoColideUnidades(gx, gy, gz, unidades)) return { ok: false, motivo: 'colide_entidade' }
  const novo = criarBlocoMundo(gx, gy, gz, material, 'nosso')
  const centro = blocoMundoParaCentro(gx, gy, gz)
  if (!Number.isFinite(centro.x)) return { ok: false, motivo: 'fora_limite' }
  return { ok: true, blocos: [...blocosLivres, novo], materialAfetado: material }
}
