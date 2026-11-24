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
  readonly zoom?: number
}

export interface RegistroCliqueDireitoImperio {
  readonly tempoMs: number
  readonly clientX: number
  readonly clientY: number
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
  zoomMin: 0.55,
  zoomMax: 1.8,
  zoomPassoWheel: 0.1,
  duploCliqueRmbMs: 280,
  duploCliqueRmbPx: 8,
} as const

export function limitarZoomCameraImperio(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1
  return Math.max(CAMERA_IMPERIO.zoomMin, Math.min(CAMERA_IMPERIO.zoomMax, zoom))
}

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
  const z = limitarZoomCameraImperio(cam.zoom ?? 1)
  return {
    x: cam.x + Math.sin(cam.yaw) * CAMERA_IMPERIO.distancia * z,
    y: CAMERA_IMPERIO.altura * z,
    z: cam.z + Math.cos(cam.yaw) * CAMERA_IMPERIO.distancia * z,
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
    ...(cam.zoom !== undefined ? { zoom: cam.zoom } : {}),
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

export function aplicarZoomCameraImperio(cam: CameraImperioState, deltaY: number): CameraImperioState {
  if (!Number.isFinite(deltaY) || deltaY === 0) return cam
  const direcao = deltaY > 0 ? 1 : -1
  const atual = limitarZoomCameraImperio(cam.zoom ?? 1)
  const proximo = limitarZoomCameraImperio(Math.round((atual + direcao * CAMERA_IMPERIO.zoomPassoWheel) * 100) / 100)
  if (proximo === atual && cam.zoom === proximo) return cam
  return { ...cam, zoom: proximo }
}

export function resetarCameraImperio(cam: CameraImperioState): CameraImperioState {
  return {
    x: cam.x,
    z: cam.z,
    yaw: 0,
    zoom: 1,
  }
}

/**
 * Resolve duplo clique com botão direito no modo Império (< 280ms e <= 8px):
 * o 2º clique reseta a câmera e suprime ordem de movimento espúria.
 */
export function avaliarCliqueDireitoImperio(
  anterior: RegistroCliqueDireitoImperio | null,
  atual: RegistroCliqueDireitoImperio,
): { readonly acao: 'resetar_camera' | 'ordenar'; readonly proximoRegistro: RegistroCliqueDireitoImperio | null } {
  if (
    anterior &&
    atual.tempoMs - anterior.tempoMs <= CAMERA_IMPERIO.duploCliqueRmbMs &&
    Math.hypot(atual.clientX - anterior.clientX, atual.clientY - anterior.clientY) <= CAMERA_IMPERIO.duploCliqueRmbPx
  ) {
    return { acao: 'resetar_camera', proximoRegistro: null }
  }
  return { acao: 'ordenar', proximoRegistro: atual }
}

/**
 * Converte o `yaw` orbital da câmera Império para a convenção de `vetorDoOlhar(yaw, pitch)` / `compassLetter`:
 * em `cam.yaw = 0`, a câmera olha para `(0, 0, -1)`, que em `vetorDoOlhar` corresponde a `yaw = π`.
 */
export function yawDaBussolaNoImperio(camYaw: number): number {
  return normalizarYaw(Math.PI - camYaw)
}
