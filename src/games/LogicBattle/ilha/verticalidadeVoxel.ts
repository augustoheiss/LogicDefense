import {
  centroBlocoMundo,
  dentroVoxelLocal,
  indiceVoxelLocal,
  RecursoNatural,
  SUBSOLO_CFG,
  VOXEL_NV5,
} from './biomaRecursos'
import {
  bateBlocoMundo,
  BlocoMundo,
  MapaBlocos,
  pisoBlocoMundoEm,
  tetoBlocoMundoEm,
} from './blocosMundo'
import { criarBlocosObraNv5 } from './blocosNv5Blueprints'
import {
  bateObraLivre,
  bloqueiosDeObraLivre,
  pisoObraLivreEm,
  tetoObraLivreEm,
} from './obraBlocosLivres'
import type { Bloqueio } from './caminho'
import { DIMENSOES_OBRA, OBRA_CENTRO_Y, OBSTACULOS, PARTIDA, PecaId } from './partidaPolicies'

export interface ObraVertical {
  id: number
  lado: 'nosso' | 'inimigo'
  tipo: PecaId
  x: number
  z: number
  nivel: number
  hp: number
  construindoRestante?: number
  blocosNv5?: Uint8Array
  blocosLivres?: readonly BlocoMundo[]
}

const CORPO_VOXEL = 0.26
const ALTURA_CORPO = 1.48

export function topoObraPadrao(obra: ObraVertical): number {
  return OBRA_CENTRO_Y + DIMENSOES_OBRA[obra.tipo][1] / 2
}

function cobreCaixa(
  x: number,
  z: number,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  raio: number = PARTIDA.body,
): boolean {
  return Math.abs(x - cx) < hx + raio && Math.abs(z - cz) < hz + raio
}

export function bateBlocoNv5(x: number, pesY: number, z: number, obra: ObraVertical): boolean {
  const cells = obra.blocosNv5
  if (!cells || obra.hp <= 0) return false
  const { nx, ny, nz, passo } = VOXEL_NV5
  const h = passo / 2
  // Quick broadphase AABB around the 7x5x7 stronghold
  const meioTotal = (nx * passo) / 2 + CORPO_VOXEL + 0.1
  if (Math.abs(x - obra.x) > meioTotal || Math.abs(z - obra.z) > meioTotal) return false
  if (pesY >= ny * passo || pesY + ALTURA_CORPO <= 0) return false

  for (let by = 0; by < ny; by++) {
    const baseY = by * passo
    const topoY = baseY + passo
    // Se os pés já estão quase no topo do bloco (degrau no salto), permite subir; se o bloco está acima da cabeça, permite passar por baixo
    if (pesY >= topoY - 0.25 || pesY + ALTURA_CORPO <= baseY + 0.06) continue
    for (let bz = 0; bz < nz; bz++) {
      for (let bx = 0; bx < nx; bx++) {
        if (cells[indiceVoxelLocal(bx, by, bz)] === 0) continue
        const c = centroBlocoMundo(obra.x, obra.z, bx, by, bz)
        if (cobreCaixa(x, z, c.x, c.z, h, h, CORPO_VOXEL)) return true
      }
    }
  }
  return false
}

export function pisoUniversalEm(
  x: number,
  pesY: number,
  z: number,
  pedraNoChao: boolean,
  obras: readonly ObraVertical[],
  recursos: readonly RecursoNatural[],
  subsoloCentro: { x: number; z: number } | null,
  blocosMapa?: MapaBlocos,
): number {
  if (subsoloCentro && pesY < -0.9) {
    let pisoSub: number = SUBSOLO_CFG.pisoY
    for (const rec of recursos) {
      if (rec.hp <= 0 || rec.yBase >= -0.9) continue
      if (Math.hypot(x - rec.x, z - rec.z) < 0.65 + PARTIDA.body && pesY >= SUBSOLO_CFG.pisoY + 0.7) {
        pisoSub = Math.max(pisoSub, SUBSOLO_CFG.pisoY + 0.9)
      }
    }
    return pisoSub
  }

  let piso = 0

  // 1. Obstáculos clássicos da pista
  for (const caixa of OBSTACULOS) {
    if (cobreCaixa(x, z, caixa.x, caixa.z, caixa.hx, caixa.hz)) {
      piso = Math.max(piso, caixa.altura)
    }
  }

  // 2. Pedra de 35 kg
  if (pedraNoChao && cobreCaixa(x, z, PARTIDA.pedraX, PARTIDA.pedraZ, PARTIDA.pedraMeio, PARTIDA.pedraMeio)) {
    piso = Math.max(piso, PARTIDA.pedraAltura)
  }

  // 3. Arco matemático (+10) em (0, 20): degrau lateral nos pilares (1,25m) + viga superior (2,50m)
  if (
    (cobreCaixa(x, z, -1.4, 20, 0.35, 0.35) || cobreCaixa(x, z, 1.4, 20, 0.35, 0.35)) &&
    pesY >= 1.05
  ) {
    piso = Math.max(piso, 1.25)
  }
  if (cobreCaixa(x, z, 0, 20, 1.6, 0.25) && pesY >= 2.25) {
    piso = Math.max(piso, 2.5)
  }

  // 4. Recursos naturais vivos na superfície (rochas de ouro = 0,95m; árvores: galho 1,30m e copa 2,40m)
  for (const rec of recursos) {
    if (rec.hp <= 0 || rec.yBase < -0.5) continue
    if (rec.tipo === 'ouro') {
      if (Math.hypot(x - rec.x, z - rec.z) < 0.55 + PARTIDA.body && pesY >= 0.72) {
        piso = Math.max(piso, 0.95)
      }
    } else {
      const dist = Math.hypot(x - rec.x, z - rec.z)
      if (dist < 0.55 + PARTIDA.body && pesY >= 1.08) {
        piso = Math.max(piso, 1.3)
      }
      if (dist < 0.95 + PARTIDA.body && pesY >= 2.18) {
        piso = Math.max(piso, 2.4)
      }
    }
  }

  // 5. Construções (Nível 1..4 caixa + peitoril de escalada; Nível 5+ bloquinhos editáveis; obras manuais consagradas)
  for (const obra of obras) {
    if (obra.hp <= 0) continue
    if (obra.blocosLivres && obra.blocosLivres.length > 0) {
      piso = Math.max(piso, pisoObraLivreEm(x, pesY, z, obra.blocosLivres))
      continue
    }
    if (obra.blocosNv5) {
      const { nx, ny, nz, passo } = VOXEL_NV5
      const h = passo / 2
      const meioTotal = (nx * passo) / 2 + CORPO_VOXEL + 0.1
      if (Math.abs(x - obra.x) > meioTotal || Math.abs(z - obra.z) > meioTotal) continue
      for (let by = 0; by < ny; by++) {
        const topoBloco = (by + 1) * passo
        if (pesY < topoBloco - 0.26) continue
        for (let bz = 0; bz < nz; bz++) {
          for (let bx = 0; bx < nx; bx++) {
            if (obra.blocosNv5[indiceVoxelLocal(bx, by, bz)] === 0) continue
            const c = centroBlocoMundo(obra.x, obra.z, bx, by, bz)
            if (cobreCaixa(x, z, c.x, c.z, h, h, CORPO_VOXEL)) {
              piso = Math.max(piso, topoBloco)
            }
          }
        }
      }
      continue
    }

    const dim = DIMENSOES_OBRA[obra.tipo]
    const hx = dim[0] / 2
    const hz = dim[2] / 2
    const topo = topoObraPadrao(obra)

    // Peitoril de escalada intermediário (y = 1,10m) ao redor de obras altas (torre e portão) ativo apenas durante o salto (pesY >= 0,92m)
    if ((obra.tipo === 'torre' || obra.tipo === 'portao') && pesY >= 0.92) {
      if (cobreCaixa(x, z, obra.x, obra.z, hx + 0.35, hz + 0.35)) {
        piso = Math.max(piso, 1.1)
      }
    }

    // Teto caminhável de qualquer obra (nossa ou inimiga) quando os pés alcançam o topo no pulo (invariante até em 20fps dt=0.05s)
    if (pesY >= topo - 0.28 && cobreCaixa(x, z, obra.x, obra.z, hx, hz)) {
      piso = Math.max(piso, topo)
    }
  }

  // 6. Blocos livres do mundo (trincheiras, muralhas, escadas manuais 1.0 m)
  if (blocosMapa) {
    piso = Math.max(piso, pisoBlocoMundoEm(x, pesY, z, blocosMapa))
  }

  return piso
}

export function tetoUniversalEm(
  x: number,
  pesY: number,
  z: number,
  obras: readonly ObraVertical[],
  subsoloCentro: { x: number; z: number } | null,
  blocosMapa?: MapaBlocos,
): number {
  if (subsoloCentro && pesY < -0.9) {
    return SUBSOLO_CFG.tetoY - ALTURA_CORPO
  }
  let teto = Number.POSITIVE_INFINITY
  for (const obra of obras) {
    if (obra.hp <= 0) continue
    if (obra.blocosLivres && obra.blocosLivres.length > 0) {
      teto = Math.min(teto, tetoObraLivreEm(x, pesY, z, obra.blocosLivres))
      continue
    }
    if (!obra.blocosNv5) continue
    const { nx, ny, nz, passo } = VOXEL_NV5
    const h = passo / 2
    const meioTotal = (nx * passo) / 2 + CORPO_VOXEL + 0.1
    if (Math.abs(x - obra.x) > meioTotal || Math.abs(z - obra.z) > meioTotal) continue
    for (let by = 1; by < ny; by++) {
      const baseBloco = by * passo
      if (baseBloco < pesY + ALTURA_CORPO - 0.1) continue
      for (let bz = 0; bz < nz; bz++) {
        for (let bx = 0; bx < nx; bx++) {
          if (obra.blocosNv5[indiceVoxelLocal(bx, by, bz)] === 0) continue
          const c = centroBlocoMundo(obra.x, obra.z, bx, by, bz)
          if (cobreCaixa(x, z, c.x, c.z, h, h, CORPO_VOXEL * 0.85)) {
            teto = Math.min(teto, baseBloco - ALTURA_CORPO)
          }
        }
      }
    }
  }
  if (blocosMapa) {
    teto = Math.min(teto, tetoBlocoMundoEm(x, pesY, z, blocosMapa))
  }
  return teto
}

export function bateObraUniversal(
  x: number,
  z: number,
  obras: readonly ObraVertical[],
  ignorarId = -1,
  pesY = 0,
  blocosMapa?: MapaBlocos,
): boolean {
  if (pesY < -0.9) return false
  if (blocosMapa && bateBlocoMundo(x, pesY, z, blocosMapa)) return true
  return obras.some((obra) => {
    if (obra.id === ignorarId || obra.hp <= 0) return false
    if (obra.blocosLivres && obra.blocosLivres.length > 0) return bateObraLivre(x, pesY, z, obra.blocosLivres)
    if (obra.blocosNv5) return bateBlocoNv5(x, pesY, z, obra)
    if (obra.tipo === 'portao') return false
    const dim = DIMENSOES_OBRA[obra.tipo]
    const hx = dim[0] / 2
    const hz = dim[2] / 2
    const topo = topoObraPadrao(obra)
    if (pesY >= topo - 0.28) return false
    return Math.abs(x - obra.x) < hx + PARTIDA.body && Math.abs(z - obra.z) < hz + PARTIDA.body
  })
}

export function bateRecursoSuperficie(
  x: number,
  z: number,
  pesY: number,
  recursos: readonly RecursoNatural[],
): boolean {
  if (pesY < -0.9) {
    return recursos.some(
      (rec) =>
        rec.hp > 0 &&
        rec.yBase < -0.9 &&
        pesY < SUBSOLO_CFG.pisoY + 0.72 &&
        Math.hypot(x - rec.x, z - rec.z) < 0.5 + PARTIDA.body,
    )
  }
  return recursos.some((rec) => {
    if (rec.hp <= 0 || rec.yBase < -0.5) return false
    if (rec.tipo === 'ouro') {
      return pesY < 0.75 && Math.hypot(x - rec.x, z - rec.z) < 0.5 + PARTIDA.body
    }
    return pesY < 1.1 && Math.hypot(x - rec.x, z - rec.z) < 0.36 + PARTIDA.body
  })
}

export function bloqueiosTerrenoEAldeaNv5(
  obras: readonly ObraVertical[],
  recursos: readonly RecursoNatural[],
): Bloqueio[] {
  const lista: Bloqueio[] = []
  for (const rec of recursos) {
    if (rec.hp <= 0 || rec.yBase < -0.5) continue
    const r = rec.tipo === 'ouro' ? 0.5 : 0.36
    lista.push({ x: rec.x, z: rec.z, hx: r, hz: r })
  }
  for (const obra of obras) {
    if (obra.hp <= 0) continue
    if (obra.blocosLivres && obra.blocosLivres.length > 0) {
      lista.push(...bloqueiosDeObraLivre(obra.blocosLivres))
      continue
    }
    if (!obra.blocosNv5) continue
    const { nx, nz, passo } = VOXEL_NV5
    const h = passo / 2
    for (let bz = 0; bz < nz; bz++) {
      for (let bx = 0; bx < nx; bx++) {
        const bloqueiaTerreo =
          obra.blocosNv5[indiceVoxelLocal(bx, 0, bz)] !== 0 ||
          obra.blocosNv5[indiceVoxelLocal(bx, 1, bz)] !== 0
        if (!bloqueiaTerreo) continue
        const c = centroBlocoMundo(obra.x, obra.z, bx, 0, bz)
        lista.push({ x: c.x, z: c.z, hx: h, hz: h })
      }
    }
  }
  return lista
}

export function garantirBlocosNv5(obra: ObraVertical): Uint8Array {
  return obra.blocosNv5 ? new Uint8Array(obra.blocosNv5) : criarBlocosObraNv5(obra.tipo)
}

export function afastarDeFortalezaNv5(
  px: number,
  py: number,
  pz: number,
  obra: ObraVertical,
): { x: number; z: number } {
  if (!obra.blocosNv5 || !bateBlocoNv5(px, py, pz, obra)) return { x: px, z: pz }
  // Move suavemente para o salão central interno (x = obra.x, z = obra.z) ou para a porta sul aberta
  const candidatos = [
    { x: obra.x, z: obra.z },
    { x: obra.x, z: obra.z + (VOXEL_NV5.nz * VOXEL_NV5.passo) / 2 + 0.7 },
    { x: obra.x, z: obra.z - (VOXEL_NV5.nz * VOXEL_NV5.passo) / 2 - 0.7 },
    { x: obra.x + (VOXEL_NV5.nx * VOXEL_NV5.passo) / 2 + 0.7, z: obra.z },
    { x: obra.x - (VOXEL_NV5.nx * VOXEL_NV5.passo) / 2 - 0.7, z: obra.z },
  ].sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))
  const livre = candidatos.find((c) => !bateBlocoNv5(c.x, py, c.z, obra))
  return livre ?? candidatos[1]
}

export function editarBlocoEmArray(
  blocos: Uint8Array,
  obraX: number,
  obraZ: number,
  bx: number,
  by: number,
  bz: number,
  acao: 'adicionar' | 'remover',
  heroi: { x: number; y: number; z: number } | null,
): Uint8Array | null {
  if (!dentroVoxelLocal(bx, by, bz)) return null
  const idx = indiceVoxelLocal(bx, by, bz)
  if (acao === 'remover') {
    if (blocos[idx] === 0) return null
    const copia = new Uint8Array(blocos)
    copia[idx] = 0
    return copia
  }
  if (blocos[idx] !== 0) return null
  if (heroi) {
    const c = centroBlocoMundo(obraX, obraZ, bx, by, bz)
    const h = VOXEL_NV5.passo / 2
    const baseY = by * VOXEL_NV5.passo
    const topoY = baseY + VOXEL_NV5.passo
    const bateH = cobreCaixa(heroi.x, heroi.z, c.x, c.z, h, h, CORPO_VOXEL * 0.9)
    const bateV = heroi.y < topoY - 0.1 && heroi.y + ALTURA_CORPO > baseY + 0.05
    if (bateH && bateV) return null
  }
  const copia = new Uint8Array(blocos)
  copia[idx] = 2
  return copia
}

export function restringirGaleriaSubsolo(
  x: number,
  z: number,
  centro: { x: number; z: number },
): { x: number; z: number } {
  const mx = SUBSOLO_CFG.meiaLargura - PARTIDA.body
  const mz = SUBSOLO_CFG.meiaProfundidade - PARTIDA.body
  return {
    x: Math.min(centro.x + mx, Math.max(centro.x - mx, x)),
    z: Math.min(centro.z + mz, Math.max(centro.z - mz, z)),
  }
}

export interface Ponto3D {
  x: number
  y: number
  z: number
}

export interface VoxelAlvoHit {
  hitPoint: Ponto3D
  distance: number
  obraId: number
  bx: number
  by: number
  bz: number
  centro: Ponto3D
}

export interface AlvoEdicaoVoxel {
  obraId: number
  bx: number
  by: number
  bz: number
  wx: number
  wy: number
  wz: number
  acao: 'adicionar' | 'remover'
  valido: boolean
  motivo: 'ok' | 'sem_madeira' | 'colide_corpo' | 'fora_limite' | 'vazio'
}

export function decidirAcaoPonteiro(
  dragPx: number,
  limiar: number = PARTIDA.limiarArrastoPx,
): 'arrasto' | 'clique' {
  return dragPx > limiar ? 'arrasto' : 'clique'
}

/**
 * Calcula a normal da face atingida em coordenadas de mundo pelo eixo dominante
 * de (hitPoint - centroBloco), evitando depender da normal local da malha.
 */
export function normalDominanteMundo(
  hitPoint: Ponto3D,
  centroBloco: Ponto3D,
): [number, number, number] {
  const dx = hitPoint.x - centroBloco.x
  const dy = hitPoint.y - centroBloco.y
  const dz = hitPoint.z - centroBloco.z
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  const az = Math.abs(dz)
  if (ay >= ax && ay >= az) return [0, dy >= 0 ? 1 : -1, 0]
  if (ax >= ay && ax >= az) return [dx >= 0 ? 1 : -1, 0, 0]
  return [0, 0, dz >= 0 ? 1 : -1]
}

/**
 * Filtra os hits do raycaster da câmera em 1ª/3ª pessoa para:
 * 1) nunca selecionar blocos atrás das costas do herói em 3ª pessoa;
 * 2) medir o alcance máximo (7 m) a partir dos olhos do herói, e não da lente.
 */
export function filtrarHitEdicao(
  hits: readonly VoxelAlvoHit[],
  camPos: Ponto3D,
  rayDir: Ponto3D,
  heroiEye: Ponto3D,
  alcanceMax: number = PARTIDA.alcanceEdicaoBlocos,
  ignorarPlanoHeroi = false,
): VoxelAlvoHit | null {
  const tPlanoHeroi = ignorarPlanoHeroi
    ? 0
    : Math.max(
        0,
        (heroiEye.x - camPos.x) * rayDir.x +
          (heroiEye.y - camPos.y) * rayDir.y +
          (heroiEye.z - camPos.z) * rayDir.z,
      )
  const ordenados = [...hits].sort((a, b) => a.distance - b.distance)
  for (const hit of ordenados) {
    if (!ignorarPlanoHeroi && hit.distance < tPlanoHeroi - 0.15) continue
    if (!ignorarPlanoHeroi) {
      const distHeroi = Math.hypot(
        hit.hitPoint.x - heroiEye.x,
        hit.hitPoint.y - heroiEye.y,
        hit.hitPoint.z - heroiEye.z,
      )
      if (distHeroi > alcanceMax) continue
    }
    return hit
  }
  return null
}

export function resolverAlvoEdicaoVoxel(
  obra: ObraVertical,
  bx: number,
  by: number,
  bz: number,
  hitPoint: Ponto3D,
  centroBloco: Ponto3D,
  acao: 'adicionar' | 'remover',
  madeira: number,
  heroi: Ponto3D | null,
): AlvoEdicaoVoxel | null {
  if (!obra.blocosNv5) return null
  if (acao === 'remover') {
    if (!dentroVoxelLocal(bx, by, bz) || obra.blocosNv5[indiceVoxelLocal(bx, by, bz)] === 0) {
      return null
    }
    const c = centroBlocoMundo(obra.x, obra.z, bx, by, bz)
    return {
      obraId: obra.id,
      bx,
      by,
      bz,
      wx: c.x,
      wy: c.y,
      wz: c.z,
      acao,
      valido: true,
      motivo: 'ok',
    }
  }
  const [dbx, dby, dbz] = normalDominanteMundo(hitPoint, centroBloco)
  const nx = bx + dbx
  const ny = by + dby
  const nz = bz + dbz
  if (!dentroVoxelLocal(nx, ny, nz)) {
    const c = centroBlocoMundo(obra.x, obra.z, bx, by, bz)
    return {
      obraId: obra.id,
      bx: nx,
      by: ny,
      bz: nz,
      wx: c.x + dbx * VOXEL_NV5.passo,
      wy: c.y + dby * VOXEL_NV5.passo,
      wz: c.z + dbz * VOXEL_NV5.passo,
      acao,
      valido: false,
      motivo: 'fora_limite',
    }
  }
  const c = centroBlocoMundo(obra.x, obra.z, nx, ny, nz)
  if (madeira < 1) {
    return {
      obraId: obra.id,
      bx: nx,
      by: ny,
      bz: nz,
      wx: c.x,
      wy: c.y,
      wz: c.z,
      acao,
      valido: false,
      motivo: 'sem_madeira',
    }
  }
  const editado = editarBlocoEmArray(obra.blocosNv5, obra.x, obra.z, nx, ny, nz, 'adicionar', heroi)
  return {
    obraId: obra.id,
    bx: nx,
    by: ny,
    bz: nz,
    wx: c.x,
    wy: c.y,
    wz: c.z,
    acao,
    valido: editado !== null,
    motivo: editado !== null ? 'ok' : 'colide_corpo',
  }
}
