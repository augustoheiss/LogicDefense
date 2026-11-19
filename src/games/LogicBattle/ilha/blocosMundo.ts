import type { Bloqueio } from './caminho'
import { PARTIDA, PecaId } from './partidaPolicies'

export type BlocoMaterial = 'madeira' | 'pedra' | 'ouro'

export interface BlocoMundo {
  x: number
  y: number
  z: number
  material: BlocoMaterial
  hp: number
  maxHp: number
  lado: 'nosso' | 'inimigo'
}

export type MapaBlocos = Readonly<Record<string, BlocoMundo>>

export const PASSO_BLOCO_MUNDO = 1
export const ALTURA_MAX_BLOCO_MUNDO = 6
export const MAX_BLOCOS_LINHA_360 = 64
export const MAX_BLOCOS_ESTRUTURA = 256
export const MAX_SPAN_ESTRUTURA = 13

export interface SpecBlocoMaterial {
  recurso: 'madeira' | 'lingotes' | 'ouro'
  qtd: number
  hp: number
  cor: string
  corBorda: string
  nome: string
}

export const SPEC_BLOCO_MATERIAL: Readonly<Record<BlocoMaterial, SpecBlocoMaterial>> = {
  madeira: {
    recurso: 'madeira',
    qtd: 1,
    hp: 18,
    cor: '#b45309',
    corBorda: '#fde68a',
    nome: 'Madeira',
  },
  pedra: {
    recurso: 'lingotes',
    qtd: 1,
    hp: 42,
    cor: '#64748b',
    corBorda: '#e2e8f0',
    nome: 'Pedra',
  },
  ouro: {
    recurso: 'ouro',
    qtd: 1,
    hp: 65,
    cor: '#eab308',
    corBorda: '#fef08a',
    nome: 'Ouro',
  },
}

export const REQUISITOS_CONSAGRACAO: Readonly<
  Record<PecaId, { minBlocos: number; minAltura: number; resumo: string }>
> = {
  nucleo: { minBlocos: 12, minAltura: 2, resumo: 'Mínimo 12 blocos e altura >= 2' },
  torre: { minBlocos: 6, minAltura: 3, resumo: 'Mínimo 6 blocos e altura >= 3' },
  quartel: { minBlocos: 8, minAltura: 2, resumo: 'Mínimo 8 blocos e altura >= 2' },
  portao: { minBlocos: 5, minAltura: 2, resumo: 'Mínimo 5 blocos e altura >= 2' },
  britador: { minBlocos: 4, minAltura: 1, resumo: 'Mínimo 4 blocos' },
  serraria: { minBlocos: 4, minAltura: 1, resumo: 'Mínimo 4 blocos' },
  mina: { minBlocos: 6, minAltura: 1, resumo: 'Mínimo 6 blocos' },
}

export function chaveBlocoMundo(gx: number, gy: number, gz: number): string {
  return `${gx},${gy},${gz}`
}

export function chaveColunaMundo(gx: number, gz: number): string {
  return `${gx},${gz}`
}

export function blocoMundoParaCentro(gx: number, gy: number, gz: number): { x: number; y: number; z: number } {
  return {
    x: gx * PASSO_BLOCO_MUNDO,
    y: gy * PASSO_BLOCO_MUNDO + PASSO_BLOCO_MUNDO / 2,
    z: gz * PASSO_BLOCO_MUNDO,
  }
}

export function mundoParaCelulaBloco(wx: number, wy: number, wz: number): { x: number; y: number; z: number } {
  return {
    x: Math.round(wx / PASSO_BLOCO_MUNDO),
    y: Math.max(0, Math.floor(wy / PASSO_BLOCO_MUNDO)),
    z: Math.round(wz / PASSO_BLOCO_MUNDO),
  }
}

export function dentroLimiteBlocoMundo(gx: number, gy: number, gz: number): boolean {
  if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(gz)) return false
  if (gy < 0 || gy >= ALTURA_MAX_BLOCO_MUNDO) return false
  const lim = Math.floor(PARTIDA.radius - 1)
  if (PARTIDA.atlas === 'grade') {
    return Math.abs(gx) <= lim && Math.abs(gz) <= lim
  }
  return Math.hypot(gx, gz) <= lim
}

export function criarBlocoMundo(
  gx: number,
  gy: number,
  gz: number,
  material: BlocoMaterial,
  lado: 'nosso' | 'inimigo' = 'nosso',
): BlocoMundo {
  const spec = SPEC_BLOCO_MATERIAL[material]
  return { x: gx, y: gy, z: gz, material, hp: spec.hp, maxHp: spec.hp, lado }
}

/**
 * Rasterização supercover 4-conexa em 360° (sem furos diagonais).
 * Cada passo diagonal inclui a célula ortogonal intermediária para selar muralhas e LoS.
 */
export function rasterizarLinha360(x0: number, z0: number, x1: number, z1: number): { x: number; z: number }[] {
  if (!Number.isFinite(x0) || !Number.isFinite(z0) || !Number.isFinite(x1) || !Number.isFinite(z1)) {
    return []
  }
  const gx0 = Math.round(x0 / PASSO_BLOCO_MUNDO)
  const gz0 = Math.round(z0 / PASSO_BLOCO_MUNDO)
  const gx1 = Math.round(x1 / PASSO_BLOCO_MUNDO)
  const gz1 = Math.round(z1 / PASSO_BLOCO_MUNDO)

  const out: { x: number; z: number }[] = [{ x: gx0, z: gz0 }]
  if (gx0 === gx1 && gz0 === gz1) return out

  const dx = Math.abs(gx1 - gx0)
  const dz = Math.abs(gz1 - gz0)
  const sx = gx0 < gx1 ? 1 : -1
  const sz = gz0 < gz1 ? 1 : -1
  let x = gx0
  let z = gz0
  let erro = dx - dz

  while ((x !== gx1 || z !== gz1) && out.length < MAX_BLOCOS_LINHA_360) {
    const e2 = erro * 2
    const avancaX = e2 > -dz
    const avancaZ = e2 < dx
    if (avancaX && avancaZ) {
      // Passo diagonal: adiciona uma ponte ortogonal para garantir conectividade 4-conexa (sem vazamento)
      const bridgeX = x + sx
      if (out.length < MAX_BLOCOS_LINHA_360) out.push({ x: bridgeX, z })
      x += sx
      z += sz
      erro += dx - dz
    } else if (avancaX) {
      x += sx
      erro -= dz
    } else {
      z += sz
      erro += dx
    }
    if (out.length < MAX_BLOCOS_LINHA_360) out.push({ x, z })
  }
  return out
}

export interface PlanoLinhaBlocos {
  celulas: { x: number; y: number; z: number }[]
  custoTotal: number
  material: BlocoMaterial
  recurso: 'madeira' | 'lingotes' | 'ouro'
}

export function planejarLinhaBlocos(
  blocosMapa: MapaBlocos,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  altura: 1 | 2 | 3,
  material: BlocoMaterial,
  podeColocarCelula: (gx: number, gy: number, gz: number) => boolean,
): PlanoLinhaBlocos {
  const spec = SPEC_BLOCO_MATERIAL[material]
  const base2d = rasterizarLinha360(x0, z0, x1, z1)
  const celulas: { x: number; y: number; z: number }[] = []
  const vistas = new Set<string>()

  for (const col of base2d) {
    for (let gy = 0; gy < altura; gy += 1) {
      if (!dentroLimiteBlocoMundo(col.x, gy, col.z)) continue
      const k = chaveBlocoMundo(col.x, gy, col.z)
      if (vistas.has(k) || blocosMapa[k]) continue
      if (!podeColocarCelula(col.x, gy, col.z)) continue
      vistas.add(k)
      celulas.push({ x: col.x, y: gy, z: col.z })
    }
  }
  return {
    celulas,
    custoTotal: celulas.length * spec.qtd,
    material,
    recurso: spec.recurso,
  }
}

const CORPO_BLOCO = 0.26
const ALTURA_CORPO = 1.48

export function bateBlocoMundo(
  x: number,
  pesY: number,
  z: number,
  blocosMapa: MapaBlocos,
  raio = CORPO_BLOCO,
): boolean {
  if (!blocosMapa) return false
  const gxC = Math.round(x)
  const gzC = Math.round(z)
  const minY = Math.max(0, Math.floor(pesY))
  const maxY = Math.min(ALTURA_MAX_BLOCO_MUNDO - 1, Math.floor(pesY + ALTURA_CORPO))
  const h = PASSO_BLOCO_MUNDO / 2

  for (let gx = gxC - 1; gx <= gxC + 1; gx += 1) {
    for (let gz = gzC - 1; gz <= gzC + 1; gz += 1) {
      if (Math.abs(x - gx) >= h + raio || Math.abs(z - gz) >= h + raio) continue
      for (let gy = minY; gy <= maxY; gy += 1) {
        const bloco = blocosMapa[chaveBlocoMundo(gx, gy, gz)]
        if (!bloco || bloco.hp <= 0) continue
        const baseY = gy * PASSO_BLOCO_MUNDO
        const topoY = baseY + PASSO_BLOCO_MUNDO
        if (pesY >= topoY - 0.25 || pesY + ALTURA_CORPO <= baseY + 0.06) continue
        return true
      }
    }
  }
  return false
}

export function pisoBlocoMundoEm(
  x: number,
  pesY: number,
  z: number,
  blocosMapa: MapaBlocos,
  raio = CORPO_BLOCO,
): number {
  let piso = 0
  const gxC = Math.round(x)
  const gzC = Math.round(z)
  const h = PASSO_BLOCO_MUNDO / 2
  for (let gx = gxC - 1; gx <= gxC + 1; gx += 1) {
    for (let gz = gzC - 1; gz <= gzC + 1; gz += 1) {
      if (Math.abs(x - gx) >= h + raio || Math.abs(z - gz) >= h + raio) continue
      for (let gy = 0; gy < ALTURA_MAX_BLOCO_MUNDO; gy += 1) {
        const bloco = blocosMapa[chaveBlocoMundo(gx, gy, gz)]
        if (!bloco || bloco.hp <= 0) continue
        const topo = (gy + 1) * PASSO_BLOCO_MUNDO
        if (pesY >= topo - 0.65) piso = Math.max(piso, topo)
      }
    }
  }
  return piso
}

export function tetoBlocoMundoEm(
  x: number,
  pesY: number,
  z: number,
  blocosMapa: MapaBlocos,
  raio = CORPO_BLOCO,
): number {
  let teto = Number.POSITIVE_INFINITY
  const gxC = Math.round(x)
  const gzC = Math.round(z)
  const h = PASSO_BLOCO_MUNDO / 2
  const cabecaY = pesY + ALTURA_CORPO
  for (let gx = gxC - 1; gx <= gxC + 1; gx += 1) {
    for (let gz = gzC - 1; gz <= gzC + 1; gz += 1) {
      if (Math.abs(x - gx) >= h + raio || Math.abs(z - gz) >= h + raio) continue
      for (let gy = 0; gy < ALTURA_MAX_BLOCO_MUNDO; gy += 1) {
        const bloco = blocosMapa[chaveBlocoMundo(gx, gy, gz)]
        if (!bloco || bloco.hp <= 0) continue
        const base = gy * PASSO_BLOCO_MUNDO
        if (base >= cabecaY - 0.15) {
          teto = Math.min(teto, base - ALTURA_CORPO)
        }
      }
    }
  }
  return teto
}

export function bloqueiosDeBlocosMundo(blocosMapa: MapaBlocos): Bloqueio[] {
  const colunas = new Set<string>()
  const out: Bloqueio[] = []
  for (const bloco of Object.values(blocosMapa)) {
    if (bloco.hp <= 0 || bloco.y > 1) continue
    const k = chaveColunaMundo(bloco.x, bloco.z)
    if (colunas.has(k)) continue
    colunas.add(k)
    out.push({ x: bloco.x, z: bloco.z, hx: 0.5, hz: 0.5 })
  }
  return out
}

export function construirAlturasColunas(
  blocosMapa: MapaBlocos,
  extras?: readonly { x: number; y: number; z: number }[],
): Map<string, number> {
  const alturas = new Map<string, number>()
  for (const bloco of Object.values(blocosMapa)) {
    if (bloco.hp <= 0) continue
    const k = chaveColunaMundo(bloco.x, bloco.z)
    const topo = bloco.y + 1
    if (topo > (alturas.get(k) ?? 0)) alturas.set(k, topo)
  }
  if (extras) {
    for (const bloco of extras) {
      const k = chaveColunaMundo(bloco.x, bloco.z)
      const topo = bloco.y + 1
      if (topo > (alturas.get(k) ?? 0)) alturas.set(k, topo)
    }
  }
  return alturas
}

/**
 * Cota máxima de blocos que o observador consegue enxergar/atirar por cima:
 * - Torre Nv1..4: 1 bloco (vê por cima de trincheira de 1 bloco; bloqueia em muralha de >= 2 blocos)
 * - Torre Nv5+: 3 blocos (enxerga e atira acima de até 3 blocos; bloqueia apenas em >= 4 blocos)
 */
export function cotaVisaoTorreBlocos(nivelTorre: number): number {
  return nivelTorre >= 5 ? 3 : 1
}

export function cotaVisaoHeroiBlocos(heroiY: number): number {
  return 1 + Math.max(0, Math.floor(heroiY + 0.15))
}

/**
 * Oclusão de Linha de Visão 2.5D por DDA Supercover 4-conexo.
 * Retorna true se nenhuma célula intermediária ultrapassar a cota de visão.
 */
export function linhaVisaoLivre25D(
  origemX: number,
  origemZ: number,
  cotaObservadorBlocos: number,
  alvoX: number,
  alvoZ: number,
  alturasColunas: ReadonlyMap<string, number>,
  alvoY = 0,
): boolean {
  if (alturasColunas.size === 0) return true
  const gx0 = Math.round(origemX / PASSO_BLOCO_MUNDO)
  const gz0 = Math.round(origemZ / PASSO_BLOCO_MUNDO)
  const gx1 = Math.round(alvoX / PASSO_BLOCO_MUNDO)
  const gz1 = Math.round(alvoZ / PASSO_BLOCO_MUNDO)
  if (gx0 === gx1 && gz0 === gz1) return true

  const cotaEfetiva = Math.max(cotaObservadorBlocos, Math.floor(alvoY + 0.5))
  const linha = rasterizarLinha360(gx0, gz0, gx1, gz1)
  for (let i = 1; i < linha.length - 1; i += 1) {
    const cel = linha[i]
    const h = alturasColunas.get(chaveColunaMundo(cel.x, cel.z)) ?? 0
    if (h > cotaEfetiva) return false
  }
  return true
}

export interface ResultadoEstruturaConexa {
  ok: boolean
  motivo?: 'vazio' | 'muito_grande' | 'span_excedido'
  blocos: BlocoMundo[]
  centroX: number
  centroZ: number
  altura: number
  larguraX: number
  larguraZ: number
}

/**
 * Flood-fill BFS 3D 6-conexo com circuit breaker (MAX_BLOCOS_ESTRUTURA = 256, maxSpan <= 13x13).
 */
export function coletarEstruturaConexa(
  blocosMapa: MapaBlocos,
  raizX: number,
  raizY: number,
  raizZ: number,
): ResultadoEstruturaConexa {
  const chaveRaiz = chaveBlocoMundo(raizX, raizY, raizZ)
  const inicial = blocosMapa[chaveRaiz]
  if (!inicial || inicial.hp <= 0 || inicial.lado !== 'nosso') {
    return { ok: false, motivo: 'vazio', blocos: [], centroX: raizX, centroZ: raizZ, altura: 0, larguraX: 0, larguraZ: 0 }
  }

  const visitados = new Set<string>([chaveRaiz])
  const fila: BlocoMundo[] = [inicial]
  const blocos: BlocoMundo[] = []
  let minX = inicial.x
  let maxX = inicial.x
  let minY = inicial.y
  let maxY = inicial.y
  let minZ = inicial.z
  let maxZ = inicial.z

  const dirs: ReadonlyArray<[number, number, number]> = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]

  while (fila.length > 0) {
    const atual = fila.shift()!
    blocos.push(atual)
    if (blocos.length > MAX_BLOCOS_ESTRUTURA) {
      return {
        ok: false,
        motivo: 'muito_grande',
        blocos: [],
        centroX: raizX,
        centroZ: raizZ,
        altura: 0,
        larguraX: 0,
        larguraZ: 0,
      }
    }
    minX = Math.min(minX, atual.x)
    maxX = Math.max(maxX, atual.x)
    minY = Math.min(minY, atual.y)
    maxY = Math.max(maxY, atual.y)
    minZ = Math.min(minZ, atual.z)
    maxZ = Math.max(maxZ, atual.z)
    if (maxX - minX + 1 > MAX_SPAN_ESTRUTURA || maxZ - minZ + 1 > MAX_SPAN_ESTRUTURA) {
      return {
        ok: false,
        motivo: 'span_excedido',
        blocos: [],
        centroX: raizX,
        centroZ: raizZ,
        altura: 0,
        larguraX: 0,
        larguraZ: 0,
      }
    }

    for (const [dx, dy, dz] of dirs) {
      const k = chaveBlocoMundo(atual.x + dx, atual.y + dy, atual.z + dz)
      if (visitados.has(k)) continue
      const viz = blocosMapa[k]
      if (!viz || viz.hp <= 0 || viz.lado !== 'nosso') continue
      visitados.add(k)
      fila.push(viz)
    }
  }

  return {
    ok: true,
    blocos,
    centroX: (minX + maxX) / 2,
    centroZ: (minZ + maxZ) / 2,
    altura: maxY - minY + 1,
    larguraX: maxX - minX + 1,
    larguraZ: maxZ - minZ + 1,
  }
}
