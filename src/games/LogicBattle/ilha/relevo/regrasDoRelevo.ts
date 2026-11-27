import { PARTIDA } from '../partidaPolicies'
import { poligonaisDosRiosNoQuadrado } from './aguaDoMundo'
import { LARGURA_DA_FITA } from './geometriaDaAgua'
import {
  alturaEm,
  inclinacaoEm,
  RELEVO_REGRAS,
  transitavelEm,
  type CampoRelevo,
} from './campoRelevo'

/**
 * Regras puras da F3 («O relevo vale», 27/11/2026): sem `three`.
 * Quando `campo === undefined` (ou `PARTIDA.relevo.regras === false`), devolve
 * exatamente o comportamento plano (I1).
 */

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min < 0 && max > 0 ? 0 : min
  return Math.max(min, Math.min(max, v))
}

/** D5: modificador de dano por vantagem/desvantagem de altura: ±25% linear até 2 m de diferença. */
export function fatorAltura(dh: number): number {
  if (!Number.isFinite(dh)) return 1
  return 1 + 0.25 * clamp(dh / 2, -1, 1)
}

/** D5 / D14: bônus/penalidade de alcance de ±0,5 m por metro de desnível, limitado a ±4 m. */
export function bonusAlcanceAltura(dh: number): number {
  if (!Number.isFinite(dh)) return 0
  return clamp(dh * 0.5, -4, 4)
}

/** Alcance efetivo considerando a cota do atacante vs alvo (piso de 1 m). */
export function alcanceComAltura(base: number, hAtacante: number, hAlvo: number): number {
  return Math.max(1, base + bonusAlcanceAltura(hAtacante - hAlvo))
}

/**
 * Marcha ao longo do segmento 3D (de `(ax, az)` na cota `terreno(ax,az) + hOlhoA` até
 * `(bx, bz)` na cota `terreno(bx,bz) + hAlvoB`), retornando `true` se o relevo bloquear a linha.
 */
export function terrenoBloqueiaLinha(
  campo: CampoRelevo | undefined,
  ax: number,
  az: number,
  hOlhoA: number,
  bx: number,
  bz: number,
  hAlvoB: number,
  folga = 0.15,
): boolean {
  if (!campo) return false
  if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(bx) || !Number.isFinite(bz)) return false
  const dist = Math.hypot(bx - ax, bz - az)
  if (dist < 0.5) return false

  const yA = alturaEm(campo, ax, az) + hOlhoA
  const yB = alturaEm(campo, bx, bz) + hAlvoB
  const passos = Math.max(4, Math.ceil(dist))

  for (let k = 1; k < passos; k += 1) {
    const t = k / passos
    if (t < 0.04 || t > 0.96) continue
    const x = ax + (bx - ax) * t
    const z = az + (bz - az) * t
    const yLinha = yA + (yB - yA) * t
    if (alturaEm(campo, x, z) + folga > yLinha) return true
  }
  return false
}

/**
 * Custo do passo no A* pelo declive do relevo: `Infinity` acima de `declMaxAndar` (penhasco),
 * penalidade progressiva entre `0,45` e `0,75`, e `1` abaixo disso.
 */
export function custoDecliveCaminho(campo: CampoRelevo | undefined, x: number, z: number): number {
  if (!campo) return 1
  const decl = inclinacaoEm(campo, x, z)
  if (decl > RELEVO_REGRAS.declMaxAndar) return Number.POSITIVE_INFINITY
  if (decl > 0.45) return 1 + ((decl - 0.45) / 0.3) * 1.6
  return 1
}

/** Move um ponto para a célula transitável mais próxima dentro de `[-54.5, 54.5]` se necessário. */
export function ajustarAoTransitavel(
  campo: CampoRelevo | undefined,
  x: number,
  z: number,
  raioMax = 6,
): { readonly x: number; readonly z: number } {
  if (!campo || !Number.isFinite(x) || !Number.isFinite(z)) return { x, z }
  const limitar = (v: number) => Math.max(-54.5, Math.min(54.5, v))
  const px = limitar(x)
  const pz = limitar(z)
  if (transitavelEm(campo, px, pz)) return { x: px, z: pz }

  const passo = 0.5
  const nPassos = Math.max(1, Math.ceil(raioMax / passo))
  for (let r = 1; r <= nPassos; r += 1) {
    const rad = r * passo
    const amostras = Math.max(8, Math.round(rad * 8))
    for (let k = 0; k < amostras; k += 1) {
      const ang = (k / amostras) * Math.PI * 2
      const cx = limitar(px + Math.cos(ang) * rad)
      const cz = limitar(pz + Math.sin(ang) * rad)
      if (transitavelEm(campo, cx, cz)) return { x: cx, z: cz }
    }
  }
  return { x: px, z: pz }
}

const LADO_QUADRADO_MUNDO = 112
const MEIA_LARGURA_RIO_SQ = (LARGURA_DA_FITA * 0.5) ** 2
const LIMITE_CACHE_POLIGONAIS = 64
type PoligonalRio = ReadonlyArray<{ readonly X: number; readonly Z: number }>
const cachePoligonaisRio = new Map<string, ReadonlyArray<PoligonalRio>>()

function poligonaisCached(mapaI: number, mapaJ: number): ReadonlyArray<PoligonalRio> {
  const chave = `${mapaI},${mapaJ}`
  const hit = cachePoligonaisRio.get(chave)
  if (hit) return hit
  const lista = poligonaisDosRiosNoQuadrado(mapaI, mapaJ)
  if (cachePoligonaisRio.size >= LIMITE_CACHE_POLIGONAIS) {
    const maisAntiga = cachePoligonaisRio.keys().next().value
    if (maisAntiga !== undefined) cachePoligonaisRio.delete(maisAntiga)
  }
  cachePoligonaisRio.set(chave, lista)
  return lista
}

function distSqSegmento(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const lenSq = dx * dx + dz * dz
  let t = lenSq > 0 ? ((px - ax) * dx + (pz - az) * dz) / lenSq : 0
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const qx = ax + t * dx - px
  const qz = az + t * dz - pz
  return qx * qx + qz * qz
}

/** Verifica se a coordenada local `(x, z)` do quadrado `(mapaI, mapaJ)` cai dentro de um rio ativo na F3. */
export function pontoEmRio(
  mapaI: number | undefined,
  mapaJ: number | undefined,
  x: number,
  z: number,
): boolean {
  if (!PARTIDA.relevo.agua || !PARTIDA.relevo.regras || mapaI === undefined || mapaJ === undefined) {
    return false
  }
  const poligonais = poligonaisCached(mapaI, mapaJ)
  if (poligonais.length === 0) return false
  const X = mapaI * LADO_QUADRADO_MUNDO + x
  const Z = mapaJ * LADO_QUADRADO_MUNDO + z
  for (const pts of poligonais) {
    for (let k = 0; k + 1 < pts.length; k += 1) {
      if (distSqSegmento(X, Z, pts[k].X, pts[k].Z, pts[k + 1].X, pts[k + 1].Z) <= MEIA_LARGURA_RIO_SQ) {
        return true
      }
    }
  }
  return false
}
