import type { BiomaId } from '../biomaRecursos'
import { fbmTileable } from './ruidoTileavel'

/**
 * O CAMPO SUAVE DO SOLO de cada bioma (24/11/2026). Lógica PURA, testada no Node (`campoDoSolo.test.ts`). `texturasPbrProcedural.ts` só pergunta «que mistura, que macro e que micro tem este pixel».
 *
 * POR QUE UMA GRADE GROSSA. O perfil da geração de texturas de um bioma mediu o custo em OPERAÇÕES (os milissegundos variam de 280 a 540 com a carga da máquina): 3,1 milhões de chamadas de ruído por
 * pacote, e 50% delas no solo a 512 px, onde o fBm de 6 oitavas (`macro` 4 oitavas a 4 ciclos e `micro` 2 oitavas a 16 ciclos) era recalculado em cada um dos 262.144 pixels. Mas é um campo de
 * FREQUÊNCIA BAIXA: no máximo 32 ciclos em 512 px (16 px por ciclo). Amostrá-lo em cada pixel é trabalho jogado fora. Aqui ele é amostrado numa grade de `GRADE_DO_SOLO` × `GRADE_DO_SOLO` pontos
 * e interpolado bilinearmente (periódico: o vizinho da última coluna é a primeira, então não há emenda).
 *
 * O QUE NÃO ENTRA AQUI: as RACHADURAS da serra do ouro e os VEIOS do basalto (limiar duro: `rachadura < 0,09`, `veio < 0,07`). Interpolar um campo cortado por um limiar borraria a borda da
 * rachadura; elas seguem calculadas por pixel EXATO em `texturasPbrProcedural.ts` (3 oitavas, só 2 dos 6 biomas). E o grão da estrada (24 ciclos × 4 = 96 ciclos, 5 px por ciclo) tem frequência alta
 * demais para uma grade de 128: ficaria no limite de Nyquist e faria aliasing.
 */

/** Pontos por lado da grade. 128 corta 16× as chamadas de ruído a 512 px e 4× a 256 px; o erro máximo da COR do solo medido nos 6 biomas fica abaixo de 1,5 nível de 8 bits (limite travado por teste). */
export const GRADE_DO_SOLO = 128

export interface CampoDoSolo {
  readonly res: number
  /** O ruído grande (4 ciclos): dá a mancha de cor e entra na rugosidade. */
  readonly macro: Float32Array
  /** O ruído fino (16 ciclos). */
  readonly micro: Float32Array
  /** `macro × 0,72 + micro × 0,28`: o que decide a cor entre `soloCorDetalhe` e `soloCorBase`. */
  readonly mistura: Float32Array
}

/** A semente do macro de hoje (`11 + bioma.length × 19`): cada bioma tem a sua. Mudá-la mudaria a cor do chão de todos os biomas. */
function sementeDoMacro(bioma: BiomaId): number {
  return 11 + bioma.length * 19
}

const SEMENTE_DO_MICRO = 77

/** Resolução válida: inteiro de 1 a 2048. NaN, zero, negativo e fracionário caem em algo seguro (um array de tamanho estranho quebraria a textura). */
function resolucaoValida(res: number): number {
  if (!Number.isFinite(res)) return 1
  return Math.min(2048, Math.max(1, Math.floor(res)))
}

function macroEm(bioma: BiomaId, u: number, v: number): number {
  return fbmTileable(u, v, 4, 4, sementeDoMacro(bioma))
}

function microEm(u: number, v: number): number {
  return fbmTileable(u, v, 16, 2, SEMENTE_DO_MICRO)
}

/** O campo EXATO, pixel a pixel. É a REFERÊNCIA (o que o código fazia antes) e só o teste e a medição o usam: custa 6 chamadas de ruído por pixel. */
export function campoDoSoloExato(bioma: BiomaId, res: number): CampoDoSolo {
  const lado = resolucaoValida(res)
  const macro = new Float32Array(lado * lado)
  const micro = new Float32Array(lado * lado)
  const mistura = new Float32Array(lado * lado)
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const ma = macroEm(bioma, x / lado, y / lado)
      const mi = microEm(x / lado, y / lado)
      const i = y * lado + x
      macro[i] = ma
      micro[i] = mi
      mistura[i] = ma * 0.72 + mi * 0.28
    }
  }
  return { res: lado, macro, micro, mistura }
}

/** Quantos campos o cache guarda. 6 biomas × 3 resoluções = 18 possíveis; guardar os mais recentes basta (um bioma volta pouco depois de sair) e a memória não cresce sem limite. */
const CAPACIDADE_DO_CACHE = 6
const cacheDoSolo = new Map<string, CampoDoSolo>()

/**
 * O campo por GRADE GROSSA + interpolação bilinear periódica: o que o jogo usa. Cada campo (`macro`, `micro`) é amostrado em `GRADE²` pontos e depois espalhado nos `res²` pixels por interpolação.
 * Em cache por (bioma, resolução): o mesmo bioma voltando (andar para o quadrado vizinho e voltar) não paga de novo.
 */
export function campoDoSoloRapido(bioma: BiomaId, res: number): CampoDoSolo {
  const lado = resolucaoValida(res)
  const chave = `${bioma}:${lado}`
  const guardado = cacheDoSolo.get(chave)
  if (guardado) {
    cacheDoSolo.delete(chave)
    cacheDoSolo.set(chave, guardado)
    return guardado
  }
  // a grade nunca é mais fina que a própria textura (a 64 px a «grossa» seria de 128 e a interpolação não teria o que interpolar)
  const g = Math.min(GRADE_DO_SOLO, lado)
  const gradeMacro = new Float32Array(g * g)
  const gradeMicro = new Float32Array(g * g)
  for (let j = 0; j < g; j += 1) {
    for (let i = 0; i < g; i += 1) {
      gradeMacro[j * g + i] = macroEm(bioma, i / g, j / g)
      gradeMicro[j * g + i] = microEm(i / g, j / g)
    }
  }
  const macro = new Float32Array(lado * lado)
  const micro = new Float32Array(lado * lado)
  const mistura = new Float32Array(lado * lado)
  for (let y = 0; y < lado; y += 1) {
    const fy = (y / lado) * g
    const j0 = Math.floor(fy)
    const ty = fy - j0
    const j1 = (j0 + 1) % g
    for (let x = 0; x < lado; x += 1) {
      const fx = (x / lado) * g
      const i0 = Math.floor(fx)
      const tx = fx - i0
      const i1 = (i0 + 1) % g
      const a = j0 * g + i0
      const b = j0 * g + i1
      const c = j1 * g + i0
      const d = j1 * g + i1
      const ma = (gradeMacro[a] + (gradeMacro[b] - gradeMacro[a]) * tx) * (1 - ty) + (gradeMacro[c] + (gradeMacro[d] - gradeMacro[c]) * tx) * ty
      const mi = (gradeMicro[a] + (gradeMicro[b] - gradeMicro[a]) * tx) * (1 - ty) + (gradeMicro[c] + (gradeMicro[d] - gradeMicro[c]) * tx) * ty
      const k = y * lado + x
      macro[k] = ma
      micro[k] = mi
      mistura[k] = ma * 0.72 + mi * 0.28
    }
  }
  const campo: CampoDoSolo = { res: lado, macro, micro, mistura }
  cacheDoSolo.set(chave, campo)
  while (cacheDoSolo.size > CAPACIDADE_DO_CACHE) {
    const maisAntigo = cacheDoSolo.keys().next().value
    if (maisAntigo === undefined) break
    cacheDoSolo.delete(maisAntigo)
  }
  return campo
}

/** Esvazia o cache (o teste mede o custo e o erro de cada bioma do zero). */
export function limparCacheDoSolo(): void {
  cacheDoSolo.clear()
}
