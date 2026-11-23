import { emAguaRasa, type LagoaRasa } from '../biomaRecursos'

export const Y_SOLO_VISUAL = -0.45
export const Y_AGUA_VISUAL = -0.375
export const Y_TOPO_FUNDACAO = 0.02

export type TipoSuporteFundacao = 'terra' | 'agua'

export interface CurvaConstrucao {
  readonly escalaAlicerceY: number
  readonly pulsoOndaA: number
  readonly pulsoOndaB: number
  readonly opacidadeOndaA: number
  readonly opacidadeOndaB: number
}

/**
 * Classifica se uma construção apoia-se em solo firme (`'terra'`) ou sobre lagoa rasa (`'agua'`).
 * Considera o centro da obra e seus quatro cantos dentro da pegada para evitar transição errada na margem.
 */
export function classificarSuporteObra(
  lagoas: readonly LagoaRasa[],
  x: number,
  z: number,
  dim: readonly [number, number, number],
): TipoSuporteFundacao {
  if (lagoas.length === 0) return 'terra'
  if (emAguaRasa(lagoas, x, z, 0)) return 'agua'

  const hx = Math.max(0.25, dim[0] * 0.36)
  const hz = Math.max(0.25, dim[2] * 0.36)
  const cantos: readonly [number, number][] = [
    [x - hx, z - hz],
    [x + hx, z - hz],
    [x - hx, z + hz],
    [x + hx, z + hz],
  ]

  let cantosNaAgua = 0
  for (const [cx, cz] of cantos) {
    if (emAguaRasa(lagoas, cx, cz, 0)) cantosNaAgua += 1
  }
  return cantosNaAgua >= 2 ? 'agua' : 'terra'
}

/**
 * Calcula curvas determinísticas de crescimento do alicerce e ondas concêntricas no chão durante a construção.
 */
export function calcularCurvaConstrucao(progressoBruto: number, tempoSeg: number): CurvaConstrucao {
  const progresso = Number.isFinite(progressoBruto) ? Math.max(0, Math.min(1, progressoBruto)) : 0
  const tempo = Number.isFinite(tempoSeg) ? Math.max(0, tempoSeg) : 0

  const progressoAlicerce = Math.min(1, progresso / 0.45)
  const escalaAlicerceY = 0.3 + progressoAlicerce * 0.7

  const faseA = (tempo * 0.85) % 1
  const faseB = (tempo * 0.85 + 0.5) % 1
  const pulsoOndaA = 0.75 + faseA * 0.9
  const pulsoOndaB = 0.75 + faseB * 0.9
  const opacidadeOndaA = Math.sin(faseA * Math.PI) * 0.65
  const opacidadeOndaB = Math.sin(faseB * Math.PI) * 0.65

  return {
    escalaAlicerceY,
    pulsoOndaA,
    pulsoOndaB,
    opacidadeOndaA,
    opacidadeOndaB,
  }
}

/**
 * Calcula as coordenadas locais `(px, pz)` das estacas/palafitas que ancoram obras sobre água até o leito.
 */
export function posicoesEstacasPier(dim: readonly [number, number, number]): readonly [number, number][] {
  const px = Math.max(0.42, dim[0] * 0.46)
  const pz = Math.max(0.42, dim[2] * 0.46)
  const estacas: [number, number][] = [
    [-px, -pz],
    [px, -pz],
    [-px, pz],
    [px, pz],
  ]

  if (dim[0] >= 1.95) {
    estacas.push([0, -pz], [0, pz])
  }
  if (dim[2] >= 1.95) {
    estacas.push([-px, 0], [px, 0])
  }
  return estacas
}
