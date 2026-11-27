import type { CameraImperioState } from '../cameraImperio'
import { posicaoCameraImperio } from '../cameraImperio'
import { PARTIDA } from '../partidaPolicies'
import { Y_SOLO_VISUAL } from '../visual/suporteFundacao'
import { desnivelDoChao } from './alturaVisual'
import type { ChaoDoDesenho } from './alturaVisual'

/**
 * O ATOR E A CÂMERA SOBRE O RELEVO (F2, Task 5 + 7, 25/11/2026). Lógica PURA, testada no Node (`alturaDoAtor.test.ts`).
 *
 * O herói, os heróis secundários, as tropas, o dragão e a câmera eram DESENHADOS no plano de hoje (`y = 0,9 + heroi.y`) e atravessavam o morro. A regra do desenho é `y_novo = y_de_hoje + desnivel(x, z)`, com
 * desnível 0 sem campo (I1: a chave desligada é o jogo de hoje, bit a bit). A SIMULAÇÃO NÃO muda (I2): `heroi.y` segue «altura sobre o chão local»; só o desenho soma o terreno (a colisão no relevo é a F3).
 *
 * Duas decisões MEDIDAS no gerador real (169 quadrados, `.superpowers/mut/medir-heroi-na-agua-e-declive.mjs`):
 *  1. O ator segue o CHÃO, NÃO a lâmina d'água. Seguir a lâmina (`desnivelDoApoio`) dá um degrau mediano de 0,96 m (até 2,04 m) na margem de 100 % das lagoas e a câmera teleportaria; seguir o leito não
 *     salta (no máximo 0,14 m por passo de 0,05 m), mas deixa o ator submerso (mediana 1,17 m) porque a lâmina desenhada está 0,475 m acima do nível para o qual a bacia foi escavada. Isso é decisão de
 *     DESENHO do usuário (a água): a política do ator mora numa função só, `desnivelDoAtor`, para a decisão trocar UMA linha.
 *  2. No SUBSOLO (`y < −0,9`, a mesma regra do jogo) o desnível é 0: a galeria da mina é desenhada em altura ABSOLUTA (`SUBSOLO_CFG.pisoY`) e não lê o campo.
 */

export type Vetor3 = { x: number; y: number; z: number }

/** Onde a câmera está (`pos`) e para onde olha (`alvo`). */
export interface VistaDaCamera {
  readonly pos: Vetor3
  readonly alvo: Vetor3
}

/** Abaixo disto o ator está no SUBSOLO (a mina): a mesma regra do jogo, ESTRITAMENTE menor (`NaN` não é subsolo). */
const LIMITE_DO_SUBSOLO = -0.9

/** A folga mínima (m) entre a câmera de 3ª pessoa e o chão sob ela. */
const FOLGA_DA_CAMERA = 0.6

/**
 * O quanto o desenho do ator (corpo, tropa, dragão) sobe com o terreno em `(x, z)`: a altura do campo no ponto, ou 0 no subsolo. Sem campo, ou com `x`/`z` não finitos, é +0 exato (I1). `y` é a altura do
 * ator sobre o chão local (`heroi.y`, `posse.y`; tropa e dragão passam 0).
 */
export function desnivelDoAtor(campo: ChaoDoDesenho | undefined, x: number, z: number, y: number): number {
  if (y < LIMITE_DO_SUBSOLO) return 0
  return desnivelDoChao(campo, x, z)
}

/**
 * A câmera de 1ª pessoa: o olho em `eyeY + ator.y` MAIS o desnível do ator, e o alvo sobe junto (a direção do olhar não muda). Sem campo, ou no subsolo, é a fórmula de hoje, bit a bit.
 */
export function posicaoDaCamera1p(campo: ChaoDoDesenho | undefined, ator: Vetor3, olhar: Vetor3): VistaDaCamera {
  const y = PARTIDA.eyeY + ator.y + desnivelDoAtor(campo, ator.x, ator.z, ator.y)
  return { pos: { x: ator.x, y, z: ator.z }, alvo: { x: ator.x + olhar.x, y: y + olhar.y, z: ator.z + olhar.z } }
}

/**
 * A câmera de 3ª pessoa. A altura de hoje (`eyeY + ator.y − olhar.y · dist`) sobe com o desnível do ATOR (a câmera acompanha o corpo), e um PISO impede que ela fure o chão que está sob ELA: nunca abaixo de
 * `Y_SOLO_VISUAL + altura do campo em (camX, camZ) + 0,6 m`. O piso é um `max` de duas funções do chão: não amplifica o relevo (andar 0,05 m move a câmera no máximo o quanto o chão se move), então não
 * treme. Sem campo, ou no subsolo (a caverna é absoluta e um piso de relevo a arrancaria dela), é a fórmula de hoje, bit a bit.
 */
export function posicaoDaCamera3p(campo: ChaoDoDesenho | undefined, ator: Vetor3, olhar: Vetor3, yaw: number, dist: number): VistaDaCamera {
  const ombro = Math.min(0.8, dist * 0.14)
  const direitaX = -Math.cos(yaw)
  const direitaZ = -Math.sin(yaw)
  const camX = ator.x - olhar.x * dist + direitaX * ombro
  let camY = PARTIDA.eyeY + ator.y - olhar.y * dist + desnivelDoAtor(campo, ator.x, ator.z, ator.y)
  const camZ = ator.z - olhar.z * dist + direitaZ * ombro
  if (campo && !(ator.y < LIMITE_DO_SUBSOLO)) {
    camY = Math.max(camY, Y_SOLO_VISUAL + desnivelDoChao(campo, camX, camZ) + FOLGA_DA_CAMERA)
  }
  return { pos: { x: camX, y: camY, z: camZ }, alvo: { x: camX + olhar.x, y: camY + olhar.y, z: camZ + olhar.z } }
}

/**
 * A câmera do Império: INTEIRA (posição e alvo) sobe com o chão sob o alvo `(cam.x, cam.z)`. Mover só o alvo mudaria o ângulo e a escala da imagem a cada morro; mover tudo por igual mantém o enquadramento
 * de hoje (a altura da câmera sobre o alvo e a distância não mudam). Sem campo é a câmera de hoje (alvo em y = +0).
 */
export function cameraDoImperio(campo: ChaoDoDesenho | undefined, cam: CameraImperioState): VistaDaCamera {
  const base = posicaoCameraImperio(cam)
  const sobe = desnivelDoChao(campo, cam.x, cam.z)
  return { pos: { x: base.x, y: base.y + sobe, z: base.z }, alvo: { x: cam.x, y: sobe, z: cam.z } }
}
