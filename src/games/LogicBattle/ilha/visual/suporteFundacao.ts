import { emAguaRasa, type LagoaRasa, VOXEL_NV5 } from '../biomaRecursos'
import { PASSO_BLOCO_MUNDO } from '../blocosMundo'
import { DIMENSOES_OBRA, PARTIDA, type Olhar } from '../partidaPolicies'
import { chaoRevelado, type Obra, type PartidaState } from '../partidaSim'

export const Y_SOLO_VISUAL = -0.45
export const Y_AGUA_VISUAL = -0.375
export const Y_TOPO_FUNDACAO = 0.02

export type TipoSuporteFundacao = 'terra' | 'agua'

export function paisagemNaturalVisivel(state: PartidaState, x: number, z: number): boolean {
  return !PARTIDA.nuvem || state.semCorpo || chaoRevelado(state, x, z)
}

export function configVisualNuvem(
  olharDesenho: Olhar,
  semCorpo: boolean,
): {
  readonly altura: number
  readonly centroY: number
  readonly cor: string
  readonly opacidade: number
  readonly depthWrite: boolean
} {
  if (semCorpo) {
    return {
      altura: 0.24,
      centroY: Y_SOLO_VISUAL + 0.12,
      cor: '#0f172a',
      opacidade: 0.34,
      depthWrite: false,
    }
  }
  const altura = olharDesenho === 'imperio' ? 4 : 3.2
  return {
    altura,
    centroY: altura / 2,
    cor: '#d5e2ea',
    opacidade: 0.92,
    depthWrite: true,
  }
}

/**
 * A altura (Y do mundo) onde um recurso natural pousa. `desnivel` é a altura do relevo NAQUELE ponto (`alturaVisualDoChao(campo, x, z) − Y_SOLO_VISUAL`), um NÚMERO já calculado por quem chama: esta
 * função não importa o campo, porque este módulo é importado por `relevo/alturaVisual.ts` e um import de volta fecharia um ciclo. SEM o segundo argumento (0) é EXATAMENTE a de hoje (I1). Um recurso do
 * SUBSOLO (`yBase < −0,9`, estrito) IGNORA o desnível: a mina tem um chão só (`alturaDeReferencia`) e o terreno do ponto não a move. Um desnível que não é finito não eleva.
 */
export function alturaVisualRecurso(yBase: number, desnivel = 0): number {
  if (yBase < -0.9) return yBase
  return Number.isFinite(desnivel) ? Y_SOLO_VISUAL + desnivel : Y_SOLO_VISUAL
}

export function alturaSapataMuralha(): { readonly altura: number; readonly centroY: number } {
  return {
    altura: 0.49,
    centroY: Y_SOLO_VISUAL + 0.235,
  }
}

export function pegadaEfetivaFundacao(
  obra: Pick<Obra, 'tipo' | 'x' | 'z' | 'hp' | 'construindoRestante' | 'blocosNv5'> & {
    readonly blocosLivres?: readonly { readonly x: number; readonly z: number; readonly hp: number }[]
  },
): { readonly cx: number; readonly cz: number; readonly dim: readonly [number, number, number] } {
  const dimBase = DIMENSOES_OBRA[obra.tipo]
  const emObra = Boolean(obra.construindoRestante && obra.construindoRestante > 0)
  if (obra.hp > 0 && !emObra) {
    if (obra.blocosNv5) {
      return {
        cx: obra.x,
        cz: obra.z,
        dim: [
          VOXEL_NV5.nx * VOXEL_NV5.passo,
          VOXEL_NV5.ny * VOXEL_NV5.passo,
          VOXEL_NV5.nz * VOXEL_NV5.passo,
        ],
      }
    }
    if (obra.blocosLivres && obra.blocosLivres.length > 0) {
      let minX = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let minZ = Number.POSITIVE_INFINITY
      let maxZ = Number.NEGATIVE_INFINITY
      let vivos = 0
      for (const b of obra.blocosLivres) {
        if (b.hp <= 0) continue
        vivos += 1
        if (b.x < minX) minX = b.x
        if (b.x > maxX) maxX = b.x
        if (b.z < minZ) minZ = b.z
        if (b.z > maxZ) maxZ = b.z
      }
      if (vivos > 0) {
        return {
          cx: ((minX + maxX) / 2) * PASSO_BLOCO_MUNDO,
          cz: ((minZ + maxZ) / 2) * PASSO_BLOCO_MUNDO,
          dim: [
            (maxX - minX + 1) * PASSO_BLOCO_MUNDO,
            dimBase[1],
            (maxZ - minZ + 1) * PASSO_BLOCO_MUNDO,
          ],
        }
      }
    }
  }
  return { cx: obra.x, cz: obra.z, dim: dimBase }
}

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
  if (dim[0] >= 4.5 || dim[2] >= 4.5) {
    estacas.push(
      [-px * 0.45, -pz * 0.45],
      [px * 0.45, -pz * 0.45],
      [-px * 0.45, pz * 0.45],
      [px * 0.45, pz * 0.45],
    )
  }
  return estacas
}
