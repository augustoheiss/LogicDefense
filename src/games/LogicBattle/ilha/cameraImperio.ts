/**
 * Lógica pura da câmera tática do modo Império (360° no plano XZ + pan relativo à orientação).
 *
 * Convenção da cena:
 *  - Alvo no chão em `(cam.x, 0, cam.z)`.
 *  - Com `yaw = 0`, a câmera fica em `(cam.x, 34, cam.z + 24)` olhando para `-Z` (Norte / cima na tela).
 *  - Apertar W (`frente > 0`) move para onde a câmera olha (`-Z` quando `yaw = 0`); D (`lado > 0`) move
 *    para a direita da tela (`+X` quando `yaw = 0`).
 */

export interface CameraImperioState {
  readonly x: number
  readonly z: number
  readonly yaw: number
}

export interface EntradaCameraImperio {
  readonly frente: number
  readonly lado: number
  readonly girar?: number
}

export interface CursorBordaEntrada {
  readonly localX: number
  readonly localY: number
  readonly largura: number
  readonly altura: number
  readonly margemPx?: number
}

export const CAMERA_IMPERIO = {
  altura: 34,
  distancia: 24,
  velocidadePan: 16,
  velocidadeYawTeclado: 1.9,
  sensibilidadeDragRadPorPx: 0.006,
  passoCliqueRad: Math.PI / 4,
  margemBordaPx: 28,
  limiteMapa: 56,
} as const

export function normalizarYaw(yaw: number): number {
  return Math.atan2(Math.sin(yaw), Math.cos(yaw))
}

function limitarCoordMapa(valor: number): number {
  return Math.max(-CAMERA_IMPERIO.limiteMapa, Math.min(CAMERA_IMPERIO.limiteMapa, valor))
}

export function posicaoCameraImperio(cam: CameraImperioState): {
  readonly x: number
  readonly y: number
  readonly z: number
} {
  return {
    x: cam.x + Math.sin(cam.yaw) * CAMERA_IMPERIO.distancia,
    y: CAMERA_IMPERIO.altura,
    z: cam.z + Math.cos(cam.yaw) * CAMERA_IMPERIO.distancia,
  }
}

export function passoCameraImperio(
  cam: CameraImperioState,
  entrada: EntradaCameraImperio,
  dt: number,
): CameraImperioState {
  const yaw = normalizarYaw(cam.yaw + (entrada.girar ?? 0) * CAMERA_IMPERIO.velocidadeYawTeclado * dt)
  const frenteX = -Math.sin(yaw)
  const frenteZ = -Math.cos(yaw)
  const direitaX = Math.cos(yaw)
  const direitaZ = -Math.sin(yaw)
  const passo = CAMERA_IMPERIO.velocidadePan * dt
  return {
    x: limitarCoordMapa(cam.x + (frenteX * entrada.frente + direitaX * entrada.lado) * passo),
    z: limitarCoordMapa(cam.z + (frenteZ * entrada.frente + direitaZ * entrada.lado) * passo),
    yaw,
  }
}

export function entradaBordaCameraImperio(cursor: CursorBordaEntrada | null): {
  readonly frente: number
  readonly lado: number
} {
  if (!cursor || cursor.largura <= 0 || cursor.altura <= 0) return { frente: 0, lado: 0 }
  if (
    cursor.localX < 0 ||
    cursor.localX > cursor.largura ||
    cursor.localY < 0 ||
    cursor.localY > cursor.altura
  ) {
    return { frente: 0, lado: 0 }
  }
  const margem = Math.min(cursor.margemPx ?? CAMERA_IMPERIO.margemBordaPx, cursor.largura / 3, cursor.altura / 3)
  if (margem <= 0) return { frente: 0, lado: 0 }

  const intensidade = (dist: number): number =>
    dist < margem ? 0.35 + 0.65 * (1 - Math.max(0, dist) / margem) : 0

  const ladoBruto = intensidade(cursor.largura - cursor.localX) - intensidade(cursor.localX)
  const frenteBruto = intensidade(cursor.localY) - intensidade(cursor.altura - cursor.localY)
  const mag = Math.hypot(ladoBruto, frenteBruto)
  if (mag > 1) {
    return { frente: frenteBruto / mag, lado: ladoBruto / mag }
  }
  return { frente: frenteBruto, lado: ladoBruto }
}

export function combinarEntradaPan(
  teclado: { readonly frente: number; readonly lado: number },
  borda: { readonly frente: number; readonly lado: number },
): { readonly frente: number; readonly lado: number } {
  if (teclado.frente !== 0 || teclado.lado !== 0) return teclado
  return borda
}

export function girarCameraImperioPorArrasto(cam: CameraImperioState, deltaX: number): CameraImperioState {
  return {
    ...cam,
    yaw: normalizarYaw(cam.yaw - deltaX * CAMERA_IMPERIO.sensibilidadeDragRadPorPx),
  }
}

/**
 * Converte o `yaw` orbital da câmera Império para a convenção de `vetorDoOlhar(yaw, pitch)` / `compassLetter`:
 * em `cam.yaw = 0`, a câmera olha para `(0, 0, -1)`, que em `vetorDoOlhar` corresponde a `yaw = π`.
 */
export function yawDaBussolaNoImperio(camYaw: number): number {
  return normalizarYaw(Math.PI - camYaw)
}
