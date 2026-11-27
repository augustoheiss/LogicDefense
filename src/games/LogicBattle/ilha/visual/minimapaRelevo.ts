import type { BiomaId } from '../biomaRecursos'
import { PARTIDA } from '../partidaPolicies'
import { alturaDeBaseDoMundo } from '../relevo/geradorRelevo'
import { BIOMA_VISUAL_CATALOG } from './biomaVisualCatalog'

/**
 * Gerador de relevo sombreado (hillshade + curvas de nível) em 32×32 px para o minimapa 2D (F6, 27/11/2026).
 * Preserva no widget as cores de dono, alertas e rótulos exigidos por `minimapaDono.test.ts`.
 */

export interface HillshadePixels {
  readonly pixels: Uint8ClampedArray
  readonly lado: number
  readonly minH: number
  readonly maxH: number
}

const MAX_CACHE_HILLSHADE = 64
const cacheHillshade = new Map<string, string>()

function hexParaRgb(hex: string): [number, number, number] {
  const limpo = hex.replace('#', '')
  const exp = limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo
  const n = parseInt(exp, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

export function gerarHillshadePixels(
  i: number,
  j: number,
  bioma: BiomaId,
  lado = 32,
): HillshadePixels {
  const res = Math.max(8, Math.floor(lado))
  const pixels = new Uint8ClampedArray(res * res * 4)
  const grades = new Float32Array(res * res)
  const cat = BIOMA_VISUAL_CATALOG[bioma]
  const [sr, sg, sb] = hexParaRgb(cat.soloCorBase)
  const [rr, rg, rb] = hexParaRgb(cat.rochaCor)

  const passo = PARTIDA.ladoMapa / res
  const cx = i * PARTIDA.ladoMapa
  const cz = j * PARTIDA.ladoMapa
  let minH = Number.POSITIVE_INFINITY
  let maxH = Number.NEGATIVE_INFINITY

  for (let py = 0; py < res; py += 1) {
    // py = 0 é o topo (+Z no mundo do minimapa, compatível com `top: -(j * lado * escala)`)
    const dz = (0.5 - (py + 0.5) / res) * PARTIDA.ladoMapa
    for (let px = 0; px < res; px += 1) {
      const dx = ((px + 0.5) / res - 0.5) * PARTIDA.ladoMapa
      const h = alturaDeBaseDoMundo(cx + dx, cz + dz)
      grades[py * res + px] = h
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }
  }

  // Luz noroeste normalizada: (-0.6, 0.72, 0.35)
  const lenLuz = Math.hypot(-0.6, 0.72, 0.35)
  const lx = -0.6 / lenLuz
  const ly = 0.72 / lenLuz
  const lz = 0.35 / lenLuz

  for (let py = 0; py < res; py += 1) {
    const pyA = Math.max(0, py - 1)
    const pyB = Math.min(res - 1, py + 1)
    for (let px = 0; px < res; px += 1) {
      const pxA = Math.max(0, px - 1)
      const pxB = Math.min(res - 1, px + 1)
      const h = grades[py * res + px]
      const dhdx = (grades[py * res + pxB] - grades[py * res + pxA]) / ((pxB - pxA || 1) * passo)
      // Nota: py cresce para -Z, portanto gradiente em Z tem sinal invertido
      const dhdz = (grades[pyA * res + px] - grades[pyB * res + px]) / ((pyB - pyA || 1) * passo)

      const invN = 1 / Math.hypot(-dhdx, 1, -dhdz)
      const dot = (-dhdx * lx + ly - dhdz * lz) * invN
      const sombra = Math.max(0.28, Math.min(1.22, 0.52 + dot * 0.72))

      const declive = Math.hypot(dhdx, dhdz)
      const pesoRocha = Math.max(0, Math.min(1, (declive - 0.2) / 0.55))

      const cotaNorm = h / 2.0
      const distIsolinha = Math.abs(cotaNorm - Math.floor(cotaNorm + 0.5))
      const linha = distIsolinha < 0.06 ? 0.72 : 1.0

      const baseR = sr + (rr - sr) * pesoRocha
      const baseG = sg + (rg - sg) * pesoRocha
      const baseB = sb + (rb - sb) * pesoRocha

      const out = (py * res + px) * 4
      pixels[out] = clampByte(baseR * sombra * linha)
      pixels[out + 1] = clampByte(baseG * sombra * linha)
      pixels[out + 2] = clampByte(baseB * sombra * linha)
      pixels[out + 3] = 255
    }
  }

  return { pixels, lado: res, minH, maxH }
}

export function formatarLegendaRelevo(minH: number, maxH: number): string {
  if (!Number.isFinite(minH) || !Number.isFinite(maxH)) return 'Plano'
  const fmt = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)}m`
  return `${fmt(minH)} a ${fmt(maxH)}`
}

export function obterHillshadeDataUrl(
  i: number,
  j: number,
  bioma: BiomaId,
  lado = 32,
): string | null {
  if (typeof document === 'undefined') return null
  const chave = `${i}:${j}:${bioma}:${lado}`
  const existente = cacheHillshade.get(chave)
  if (existente !== undefined) {
    cacheHillshade.delete(chave)
    cacheHillshade.set(chave, existente)
    return existente
  }

  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const { pixels } = gerarHillshadePixels(i, j, bioma, lado)
  const img = new ImageData(new Uint8ClampedArray(pixels), lado, lado)
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL('image/png')

  if (cacheHillshade.size >= MAX_CACHE_HILLSHADE) {
    const maisAntigo = cacheHillshade.keys().next().value
    if (maisAntigo !== undefined) cacheHillshade.delete(maisAntigo)
  }
  cacheHillshade.set(chave, url)
  return url
}

export function limparCacheHillshade(): void {
  cacheHillshade.clear()
}

export function tamanhoCacheHillshade(): number {
  return cacheHillshade.size
}
