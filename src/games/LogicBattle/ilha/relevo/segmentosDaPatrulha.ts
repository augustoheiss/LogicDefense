/**
 * A FILEIRA DE SEGMENTOS da linha da patrulha (F2, Task 4, resto, 26/11/2026). Lógica PURA, testada no Node (`segmentosDaPatrulha.test.ts`).
 *
 * A linha entre os dois discos da patrulha era UMA caixa horizontal de 0,03 m em `y = −0,41`. Com o relevo, os discos sobem cada um no SEU desnível, e uma caixa horizontal (ou uma reta inclinada de A a B)
 * fica enterrada numa crista ou flutuando num vale: MEDIDO em 6 biomas (`medir-linha-da-patrulha.mjs`, controles verdes), o erro mediano é 0,25 m (10 m de patrulha) a 1,3 m (100 m), e a reta INCLINADA é quase
 * igual à horizontal, porque o terreno entre os dois pontos tem cristas e vales que uma reta não segue. A única forma correta é a linha SEGUIR o terreno: uma fileira de segmentos curtos.
 *
 * COMO O SEGMENTO SEGUE O TERRENO (as duas decisões foram MEDIDAS, depois que a FOTO `medicoes/F2/30` mostrou LACUNAS na linha com a chave ligada):
 *  1. Cada segmento é INCLINADO pelo desnível das suas duas pontas (`x0, z0` e `x1, z1`): o chamador põe o centro na MÉDIA dessas duas alturas e gira em x por `atan2(Δh, comp)`. Horizontal, 59 % dos segmentos
 *     de 2 m tinham uma ponta enterrada a mais que os 3 cm da caixa (e 58 % a outra flutuando); inclinado, o erro cai para 30 %.
 *  2. O passo de 0,5 m (e não 2 m): o que resta é a CURVATURA do chão entre as pontas, que cai com o QUADRADO do comprimento: 30,0 % (2 m), 8,8 % (1 m), **1,2 % (0,5 m)** com o meio fora de 3 cm.
 * O teto de 64 segmentos por patrulha cobre bem até 32 m (o normal); uma patrulha mais longa degrada para segmentos maiores (1,6 m aos 100 m), com o erro de 1 m medido acima.
 *
 * Esta função só diz ONDE ficam os segmentos (centro, pontas e comprimento) e COMO estão virados (o MESMO giro de hoje em y, `atan2(Δx, Δz)`). Quem soma a altura é o chamador (`desnivelDoChao`).
 */
export interface SegmentoDaPatrulha {
  /** O centro do segmento (m, mundo). */
  readonly x: number
  readonly z: number
  /** A ponta de TRÁS (do lado de A) e a da FRENTE (do lado de B): o chamador mede o chão nas duas para inclinar o segmento. */
  readonly x0: number
  readonly z0: number
  readonly x1: number
  readonly z1: number
  /** O comprimento (m). */
  readonly comp: number
  /** O giro em y (rad), `atan2(Δx, Δz)`: o MESMO ângulo da linha de hoje. */
  readonly ang: number
}

/** O comprimento-alvo de cada segmento (m): 0,5 m deixa só 1,2 % dos segmentos com o meio a mais de 3 cm do chão no relevo real (MEDIDO; com 2 m eram 30 %). */
export const PASSO_DO_SEGMENTO = 0.5
/** Quantos segmentos no máximo por patrulha: até 4 patrulhas selecionadas × 64 = 256 caixas; o teto aperta acima de 32 m. */
export const MAX_SEGMENTOS = 64
/** O menor comprimento de uma linha (m): a linha de hoje já tinha `Math.max(0.2, …)`, para A = B continuar visível. */
export const COMPRIMENTO_MINIMO = 0.2

export function segmentosDaPatrulha(ax: number, az: number, bx: number, bz: number): SegmentoDaPatrulha[] {
  if (![ax, az, bx, bz].every(Number.isFinite)) return []
  const dx = bx - ax
  const dz = bz - az
  const comp = Math.max(COMPRIMENTO_MINIMO, Math.hypot(dx, dz))
  const ang = Math.atan2(dx, dz)
  const n = Math.min(MAX_SEGMENTOS, Math.max(1, Math.ceil(comp / PASSO_DO_SEGMENTO)))
  const parte = comp / n
  const real = Math.hypot(dx, dz)
  const segmentos: SegmentoDaPatrulha[] = []
  for (let k = 0; k < n; k += 1) {
    // com A = B (`real` = 0) não há direção: o segmento fica em A; senão o ponto anda `t` do caminho
    const t = (u: number): number => (real === 0 ? 0 : u / n)
    segmentos.push({
      x: ax + dx * t(k + 0.5),
      z: az + dz * t(k + 0.5),
      x0: ax + dx * t(k),
      z0: az + dz * t(k),
      x1: ax + dx * t(k + 1),
      z1: az + dz * t(k + 1),
      comp: parte,
      ang,
    })
  }
  return segmentos
}

/**
 * O SEGMENTO INCLINADO (F2, Task 4, resto, 26/11/2026). Dadas as alturas do chão nas duas pontas do segmento (`alturaEm`: o chamador passa `desnivelDoChao(campo, x, z)`), devolve onde pôr a caixa e como girá-la.
 * Os 3 valores foram PROVADOS com o three REAL (0.184, `.superpowers/mut/provar-rotacao-do-segmento.mjs`: 6 direções, erro das pontas 0,0000 m; as outras 3 combinações erram 0,5 a 1,0 m):
 *  1. `y` = a MÉDIA das alturas das duas pontas (a reta entre elas): é o que deixa AS DUAS pontas no chão.
 *  2. `inclinacao` = o giro em x, NEGATIVO quando a ponta da frente é mais alta: `−atan2(Δh, comp)`. O `<mesh>` tem de usar `rotation.order = 'YXZ'`: com o `XYZ` padrão a inclinação é no eixo do MUNDO e erra até 0,9 m.
 *  3. `comprimento` = a DIAGONAL `hypot(comp, Δh)`, e não o `comp` horizontal: a inclinação alonga a caixa, e com `comp` as pontas ficam 0,5 m para dentro.
 * Altura que não é número finito (um campo corrompido) deixa o segmento PLANO, sem `NaN` num objeto 3D.
 */
export interface SegmentoInclinado {
  /** A altura do centro do segmento (m), a média das alturas das duas pontas (o chamador soma o `−0,41` da linha). */
  readonly y: number
  /** O giro em x (rad): negativo quando a ponta da frente é mais alta. Exige `rotation.order = 'YXZ'`. */
  readonly inclinacao: number
  /** O comprimento da caixa (m): a diagonal. */
  readonly comprimento: number
}

export function inclinarSegmento(s: SegmentoDaPatrulha, alturaEm: (x: number, z: number) => number): SegmentoInclinado {
  const h0 = alturaEm(s.x0, s.z0)
  const h1 = alturaEm(s.x1, s.z1)
  if (!Number.isFinite(h0) || !Number.isFinite(h1)) return { y: 0, inclinacao: 0, comprimento: s.comp }
  const dh = h1 - h0
  return { y: (h0 + h1) / 2, inclinacao: -Math.atan2(dh, s.comp), comprimento: Math.hypot(s.comp, dh) }
}

/**
 * A ELEVAÇÃO DOS MARCADORES NO CHÃO (F2, 26/11/2026). Um anel ou uma linha HORIZONTAL sobre uma encosta fica com uma parte ENTERRADA: a AUDITORIA apontou, olhando a FOTO 31, o anel amarelo do ponto B cortado pelo
 * morro, e a medição (`medir-anel-e-linha-da-patrulha.mjs`, 6 biomas, controles verdes) confirmou: com o relevo, **91 %** dos anéis (coroa de raio 0,44 m) têm uma parte enterrada; +0,05 m deixa 31 %, +0,10 m deixa
 * 13 %, **+0,20 m deixa 2 %**; a linha (caixa de 3 cm) já inclinada tem o meio enterrado em 2,2 % e **+0,10 m a leva a 0,0 %**. O anel sobe mais que a linha porque a coroa cobre mais chão que a espessura de uma caixa.
 *
 * Mora numa função PURA: SEM campo devolve `+0` EXATO (I1: com a chave desligada o jogo de hoje não muda um bit), e só COM campo sobe. O chamador soma o resultado à altura que já tinha.
 */
export const ELEVACAO_DO_ANEL = 0.2
export const ELEVACAO_DA_LINHA = 0.1

export function elevacaoDoAnel(campo: unknown): number {
  return campo ? ELEVACAO_DO_ANEL : 0
}

export function elevacaoDaLinha(campo: unknown): number {
  return campo ? ELEVACAO_DA_LINHA : 0
}
