import {
  CAMERA_IMPERIO,
  combinarEntradaPan,
  entradaBordaCameraImperio,
  girarCameraImperioPorArrasto,
  normalizarYaw,
  passoCameraImperio,
  posicaoCameraImperio,
  yawDaBussolaNoImperio,
  type CameraImperioState,
} from './cameraImperio'
import { vetorDoOlhar } from './partidaSim'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function perto(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps
}

export function run(): void {
  // 1. Em yaw = 0: posição preservada em (x, 34, z + 24)
  const base: CameraImperioState = { x: 10, z: 18, yaw: 0 }
  const p0 = posicaoCameraImperio(base)
  assert(perto(p0.x, 10) && perto(p0.y, 34) && perto(p0.z, 42), 'posição inicial da câmera Império inesperada')

  // 2. Bug corrigido: W (frente = +1) deve subir na tela (diminuir Z em yaw = 0), S aumenta Z, D aumenta X, A diminui X
  const w0 = passoCameraImperio(base, { frente: 1, lado: 0 }, 0.5)
  assert(w0.z < base.z && perto(w0.x, base.x), `W em yaw=0 deveria ir para -Z, foi z=${w0.z}`)
  const s0 = passoCameraImperio(base, { frente: -1, lado: 0 }, 0.5)
  assert(s0.z > base.z && perto(s0.x, base.x), `S em yaw=0 deveria ir para +Z, foi z=${s0.z}`)
  const d0 = passoCameraImperio(base, { frente: 0, lado: 1 }, 0.5)
  assert(d0.x > base.x && perto(d0.z, base.z), `D em yaw=0 deveria ir para +X, foi x=${d0.x}`)
  const a0 = passoCameraImperio(base, { frente: 0, lado: -1 }, 0.5)
  assert(a0.x < base.x && perto(a0.z, base.z), `A em yaw=0 deveria ir para -X, foi x=${a0.x}`)

  // 3. Para qualquer ângulo (0, 90°, 180°, -90°, 45°), W anda na direção (alvo - posCamera) no plano XZ
  //    e D anda perpendicular à direita (frente × up = (-fZ, fX)).
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4]) {
    const cam: CameraImperioState = { x: 0, z: 0, yaw }
    const pos = posicaoCameraImperio(cam)
    const dirLen = Math.hypot(cam.x - pos.x, cam.z - pos.z)
    assert(perto(dirLen, CAMERA_IMPERIO.distancia), `distância orbital alterada em yaw=${yaw}: ${dirLen}`)
    assert(perto(pos.y, CAMERA_IMPERIO.altura), 'altura alterada')

    const dirFrenteX = (cam.x - pos.x) / dirLen
    const dirFrenteZ = (cam.z - pos.z) / dirLen

    const movW = passoCameraImperio(cam, { frente: 1, lado: 0 }, 1)
    const movWLen = Math.hypot(movW.x, movW.z)
    const dotW = (movW.x / movWLen) * dirFrenteX + (movW.z / movWLen) * dirFrenteZ
    assert(perto(dotW, 1), `W não acompanhou direção da câmera em yaw=${yaw}: dot=${dotW}`)

    // Em sistema right-handed com up = (0, 1, 0), direita = normalize(frente × up) = (-frenteZ, 0, frenteX)
    const dirDirX = -dirFrenteZ
    const dirDirZ = dirFrenteX
    const movD = passoCameraImperio(cam, { frente: 0, lado: 1 }, 1)
    const movDLen = Math.hypot(movD.x, movD.z)
    const dotD = (movD.x / movDLen) * dirDirX + (movD.z / movDLen) * dirDirZ
    assert(perto(dotD, 1), `D não acompanhou direita da câmera em yaw=${yaw}: dot=${dotD}`)
  }

  // 4. Rotação 360° contínua em ambos os sentidos normaliza yaw para [-π, π] e mantém distância/altura
  let cRot: CameraImperioState = { x: 5, z: -3, yaw: 0 }
  for (let i = 0; i < 40; i++) {
    cRot = passoCameraImperio(cRot, { frente: 0, lado: 0, girar: 1 }, 0.25)
    assert(cRot.yaw >= -Math.PI - 1e-9 && cRot.yaw <= Math.PI + 1e-9, `yaw fora do intervalo: ${cRot.yaw}`)
    const pos = posicaoCameraImperio(cRot)
    assert(perto(Math.hypot(pos.x - cRot.x, pos.z - cRot.z), CAMERA_IMPERIO.distancia), 'raio orbital quebrou ao girar +')
  }
  for (let i = 0; i < 40; i++) {
    cRot = passoCameraImperio(cRot, { frente: 0, lado: 0, girar: -1 }, 0.25)
    const pos = posicaoCameraImperio(cRot)
    assert(perto(Math.hypot(pos.x - cRot.x, pos.z - cRot.z), CAMERA_IMPERIO.distancia), 'raio orbital quebrou ao girar -')
  }

  // 5. Arrasto de mouse preserva o alvo (x, z) e altera yaw
  const arr = girarCameraImperioPorArrasto(base, 120)
  assert(perto(arr.x, base.x) && perto(arr.z, base.z) && arr.yaw !== base.yaw, 'arrasto deve girar apenas yaw')
  assert(perto(normalizarYaw(3 * Math.PI), Math.PI) || perto(Math.abs(normalizarYaw(3 * Math.PI)), Math.PI), 'normalizarYaw 3π')

  // 6. Bússola do Império alinha com vetorDoOlhar nas direções cardeais
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const pos = posicaoCameraImperio({ x: 0, z: 0, yaw })
    const camFrenteX = -pos.x / CAMERA_IMPERIO.distancia
    const camFrenteZ = -pos.z / CAMERA_IMPERIO.distancia
    const olhar = vetorDoOlhar(yawDaBussolaNoImperio(yaw), 0)
    assert(perto(olhar.x, camFrenteX) && perto(olhar.z, camFrenteZ), `bússola desalinhada em yaw=${yaw}`)
  }

  // 7. Edge scrolling nas extremidades da tela: centro/null/fora = 0; 4 bordas cardeais e 4 cantos diagonais
  const zeroNull = entradaBordaCameraImperio(null)
  const zeroCentro = entradaBordaCameraImperio({ localX: 500, localY: 400, largura: 1000, altura: 800 })
  const zeroFora = entradaBordaCameraImperio({ localX: -5, localY: 400, largura: 1000, altura: 800 })
  assert(
    zeroNull.frente === 0 &&
      zeroNull.lado === 0 &&
      zeroCentro.frente === 0 &&
      zeroCentro.lado === 0 &&
      zeroFora.frente === 0 &&
      zeroFora.lado === 0,
    'centro, null e fora da viewport devem dar movimento 0',
  )

  const topo = entradaBordaCameraImperio({ localX: 500, localY: 0, largura: 1000, altura: 800 })
  const baixo = entradaBordaCameraImperio({ localX: 500, localY: 800, largura: 1000, altura: 800 })
  const esq = entradaBordaCameraImperio({ localX: 0, localY: 400, largura: 1000, altura: 800 })
  const dir = entradaBordaCameraImperio({ localX: 1000, localY: 400, largura: 1000, altura: 800 })
  assert(perto(topo.frente, 1) && perto(topo.lado, 0), `borda topo: ${JSON.stringify(topo)}`)
  assert(perto(baixo.frente, -1) && perto(baixo.lado, 0), `borda baixo: ${JSON.stringify(baixo)}`)
  assert(perto(esq.lado, -1) && perto(esq.frente, 0), `borda esquerda: ${JSON.stringify(esq)}`)
  assert(perto(dir.lado, 1) && perto(dir.frente, 0), `borda direita: ${JSON.stringify(dir)}`)

  // 8. Diagonais nos 4 cantos normalizadas (magnitude <= 1) e com os sinais esperados
  const cantos: Array<[number, number, number, number]> = [
    [0, 0, 1, -1],
    [1000, 0, 1, 1],
    [0, 800, -1, -1],
    [1000, 800, -1, 1],
  ]
  for (const [cx, cy, sFrente, sLado] of cantos) {
    const e = entradaBordaCameraImperio({ localX: cx, localY: cy, largura: 1000, altura: 800 })
    assert(
      Math.sign(e.frente) === sFrente &&
        Math.sign(e.lado) === sLado &&
        Math.hypot(e.frente, e.lado) <= 1 + 1e-6,
      `canto (${cx},${cy}) inválido: ${JSON.stringify(e)}`,
    )
  }

  // 9. Rampa progressiva: mais perto da borda = velocidade maior que na entrada da faixa
  const bordoRaso = entradaBordaCameraImperio({ localX: 20, localY: 400, largura: 1000, altura: 800 })
  const bordoFundo = entradaBordaCameraImperio({ localX: 2, localY: 400, largura: 1000, altura: 800 })
  assert(Math.abs(bordoFundo.lado) > Math.abs(bordoRaso.lado), 'rampa progressiva na borda falhou')

  // 10. Diagonal combinada com câmera rotacionada (yaw = π/2 -> frente = -X, direita = -Z) + clamp em ±limiteMapa
  const cantoSupDir = entradaBordaCameraImperio({ localX: 1000, localY: 0, largura: 1000, altura: 800 })
  const movRot = passoCameraImperio({ x: 0, z: 0, yaw: Math.PI / 2 }, cantoSupDir, 1)
  assert(movRot.x < 0 && movRot.z < 0, `diagonal com yaw=π/2 deveria mover para -X e -Z, veio (${movRot.x}, ${movRot.z})`)
  const clamped = passoCameraImperio({ x: CAMERA_IMPERIO.limiteMapa, z: -CAMERA_IMPERIO.limiteMapa, yaw: 0 }, { frente: 1, lado: 1 }, 2)
  assert(
    clamped.x === CAMERA_IMPERIO.limiteMapa && clamped.z === -CAMERA_IMPERIO.limiteMapa,
    `câmera devia travar nos limites ±${CAMERA_IMPERIO.limiteMapa}`,
  )

  // 11. Teclado/manche tem prioridade sobre borda
  const prioTec = combinarEntradaPan({ frente: -1, lado: 0 }, { frente: 1, lado: 1 })
  assert(prioTec.frente === -1 && prioTec.lado === 0, 'teclado deve vencer borda')
  const prioBorda = combinarEntradaPan({ frente: 0, lado: 0 }, { frente: 0.7, lado: -0.7 })
  assert(perto(prioBorda.frente, 0.7) && perto(prioBorda.lado, -0.7), 'borda assume quando teclado está neutro')
}
