import { Y_SOLO_VISUAL } from '../visual/suporteFundacao'
import { alturaEm, type CampoRelevo } from './campoRelevo'

/**
 * O CLIQUE CONTRA O TERRENO (F2, Task 6, 25/11/2026). Lógica PURA, testada no Node (`raioTerreno.test.ts`).
 *
 * Hoje o clique no chão é a interseção do raio da câmera com um PLANO: `soloNoNdc` usa `y = 0` e `soloNoChao` usa `y = −0,45`. Com o relevo ligado o chão DESENHADO sobe e desce, e clicar numa colina de 3 m
 * mandaria a tropa para um ponto deslocado de vários metros. A regra: o clique devolve o ponto onde o raio encontra o terreno VISÍVEL, `Y_SOLO_VISUAL + alturaEm(x, z)` (a MESMA altura de cada vértice da malha).
 *
 * Sem campo é EXATAMENTE o plano de hoje (I1), com o plano que cada chamada já usava (`planoY`): o limiar `|dirY| < 1e-5` e o `t < 0` são os mesmos, copiados, para a chave desligada não mudar um bit.
 * COM campo o `planoY` é IGNORADO: o terreno desenhado manda, e os dois planos de hoje convergem para o mesmo ponto (a caixa de seleção e a ordem de movimento não discordam).
 */

export interface Vetor3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface Raio {
  readonly origem: Vetor3
  readonly direcao: Vetor3
}

export interface AcertoNoChao {
  readonly x: number
  /** A altura do ponto (a do raio em `t`): o editor de blocos mede o alcance até ELA, não até um `0` fixo (com relevo o clique cai no morro, não no plano). */
  readonly y: number
  readonly z: number
  /** A distância ao longo do raio (em unidades da `direcao`, que o chamador normaliza): o editor de blocos a compara com a do herói. */
  readonly t: number
}

/** O TETO do passo da marcha (m ao longo do raio): longe do chão ela anda de 0,5 em 0,5. Perto dele o passo encolhe (ver `DECLIVE_MAXIMO`). */
export const PASSO_DA_MARCHA = 0.5
/** O piso do passo (m): rente ao chão a marcha não trava em passos infinitesimais (2 cm × 400 m = 20 000 passos no pior caso, medido abaixo). */
export const PASSO_MINIMO = 0.02
/** O maior declive do campo (m por m) que o passo adaptativo supõe: MEDIDO em 169 quadrados (maior degrau 0,158 m por 0,05 m = 3,16), com margem. Um terreno mais íngreme que isto reabre o pulo. */
export const DECLIVE_MAXIMO = 4
/** Quantas bissecções refinam o cruzamento: 0,5 m / 2¹² ≈ 0,12 mm. */
export const BISSECOES = 12
/**
 * O TETO da marcha (m ao longo do raio). Sem ele um raio que nunca encontra o chão (horizontal alto sobre um campo que prende na borda) marcharia até `tMax`, que o chamador pode pôr em `Infinity`. 400 m cobre
 * com folga a câmera mais alta do jogo (Império: 34 m de altura a 24 m de distância, ~42 m de raio, mais o zoom máximo de 1,8) e o quadrado inteiro (113 m).
 */
export const DISTANCIA_MAXIMA = 400

/** O plano de hoje, escrito como o `soloNoNdc`/`soloNoChao` o escrevem (o limiar, o `t < 0`), para a chave desligada não mudar um bit. */
function acertoNoPlano(raio: Raio, planoY: number): AcertoNoChao | null {
  const dirY = raio.direcao.y
  if (Math.abs(dirY) < 1e-5) return null
  const t = (planoY - raio.origem.y) / dirY
  if (t < 0) return null
  return { x: raio.origem.x + raio.direcao.x * t, y: raio.origem.y + raio.direcao.y * t, z: raio.origem.z + raio.direcao.z * t, t }
}

/** A altura do raio MENOS a do terreno em `t`: positivo = o raio está ACIMA do chão. */
function folgaEm(campo: CampoRelevo, raio: Raio, t: number): number {
  const x = raio.origem.x + raio.direcao.x * t
  const z = raio.origem.z + raio.direcao.z * t
  return raio.origem.y + raio.direcao.y * t - (Y_SOLO_VISUAL + alturaEm(campo, x, z))
}

/**
 * O primeiro ponto, a partir da origem, em que o raio encontra o chão. Sem `campo` é o plano `y = planoY` de hoje. Com `campo`: marcha de `PASSO_DA_MARCHA` até o raio ficar ABAIXO do terreno, e `BISSECOES`
 * bissecções entre o último ponto acima e o primeiro abaixo. `null` se o raio não desce (para cima ou paralelo), se começa abaixo do terreno, se não o encontra até `tMax`, ou se a entrada não é finita.
 */
export function raioContraTerreno(campo: CampoRelevo | undefined, raio: Raio, planoY: number, tMax: number): AcertoNoChao | null {
  if (!campo) return acertoNoPlano(raio, planoY)
  const { origem, direcao } = raio
  // O raio tem de ser finito; `tMax` pode ser `Infinity` («sem limite», o que `IlhaRua` passa: o teto é `DISTANCIA_MAXIMA`), mas não `NaN` nem negativo. A 1ª versão exigia `tMax` FINITO e, com o relevo ligado,
  // todo clique no chão devolvia `null` (achado em 26/11 pela prova no navegador, que os 5 portões e as fotos de 25/11 não viram: sem campo o plano de hoje retorna ANTES desta linha).
  if (![origem.x, origem.y, origem.z, direcao.x, direcao.y, direcao.z].every(Number.isFinite) || Number.isNaN(tMax) || tMax < 0) return null
  // começa ABAIXO (ou no) terreno: não existe «primeiro acerto» para a frente, e devolver um ponto atrás da câmera seria pior que não devolver
  if (folgaEm(campo, raio, 0) <= 0) return null
  const alcance = Math.min(tMax, DISTANCIA_MAXIMA)
  // O PASSO ADAPTATIVO: entre dois pontos da marcha o raio muda de altura em `|dirY| · passo` e o terreno em até `DECLIVE_MAXIMO · passo` (horizontal ≤ passo). Um passo de `folga / (DECLIVE_MAXIMO + 1)` nunca
  // atravessa o terreno (a folga só pode cair a zero se o passo a consumir inteira), com teto `PASSO_DA_MARCHA` (longe do chão anda de 0,5 em 0,5) e piso `PASSO_MINIMO` (rente ao chão não trava em passos
  // infinitesimais). A marcha de passo FIXO de 0,5 m PULAVA cristas finas num raio rasante (medido: 18 de 7 200 raios reais, todos de 1ª/3ª pessoa).
  let t = 0
  let folga = folgaEm(campo, raio, 0)
  while (t < alcance) {
    const passo = Math.min(PASSO_DA_MARCHA, Math.max(PASSO_MINIMO, folga / (DECLIVE_MAXIMO + 1)))
    const proximo = Math.min(t + passo, alcance)
    const folgaProxima = folgaEm(campo, raio, proximo)
    if (folgaProxima <= 0) {
      let acima = t
      let abaixo = proximo
      for (let i = 0; i < BISSECOES; i += 1) {
        const meio = (acima + abaixo) / 2
        if (folgaEm(campo, raio, meio) > 0) acima = meio
        else abaixo = meio
      }
      const t1 = (acima + abaixo) / 2
      return { x: origem.x + direcao.x * t1, y: origem.y + direcao.y * t1, z: origem.z + direcao.z * t1, t: t1 }
    }
    t = proximo
    folga = folgaProxima
  }
  return null
}
