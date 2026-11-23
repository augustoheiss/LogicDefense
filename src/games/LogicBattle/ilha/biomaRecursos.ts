import { camadaDoMapa } from './camadaDoMapa'
import { producaoNoNivel } from './evolucaoObra'

export type BiomaId = 'clareira' | 'bosque' | 'serra_ouro' | 'ribeira' | 'tundra_cristal' | 'basalto_brasa'

export interface RecursoNatural {
  id: number
  tipo: 'arvore' | 'ouro'
  x: number
  z: number
  yBase: number
  hp: number
  maxHp: number
  regeneraEm: number
}

export interface LagoaRasa {
  x: number
  z: number
  rx: number
  rz: number
}

export const SUBSOLO_CFG = {
  pisoY: -3.2,
  tetoY: -0.35,
  meiaLargura: 9,
  meiaProfundidade: 9,
  raioEntrada: 2.3,
} as const

export const VOXEL_NV5 = {
  nx: 7,
  ny: 5,
  nz: 7,
  passo: 0.85,
} as const

function hashInt(a: number, b: number, sal: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f) ^ sal
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

export function biomaDoQuadrado(i: number, j: number): BiomaId {
  if (i === 0 && j === 0) return 'clareira'
  if (camadaDoMapa(i, j) <= 1) {
    const opcoesCamada1: readonly BiomaId[] = ['bosque', 'serra_ouro', 'ribeira', 'clareira']
    return opcoesCamada1[hashInt(i, j, 0x1047) % opcoesCamada1.length]
  }
  const opcoesAvancadas: readonly BiomaId[] = [
    'bosque',
    'serra_ouro',
    'ribeira',
    'clareira',
    'tundra_cristal',
    'basalto_brasa',
  ]
  return opcoesAvancadas[hashInt(i, j, 0x1047) % opcoesAvancadas.length]
}

export function corDoChaoBioma(bioma: BiomaId): string {
  if (bioma === 'bosque') return '#4d7c4f'
  if (bioma === 'serra_ouro') return '#8c8265'
  if (bioma === 'ribeira') return '#65946e'
  if (bioma === 'tundra_cristal') return '#cbd5e1'
  if (bioma === 'basalto_brasa') return '#3f3c42'
  return '#7f9b72'
}

function livreDoCorredorCentral(x: number, z: number, i = 0, j = 0): boolean {
  // Preserva a rua central z in [-6..48], x in [-6..6], a pedra (-8, 10), eixo z=0 em (0,0) e os cantos das bases inimigas
  if (Math.abs(x) < 7.5 && z > -8 && z < 49) return false
  if (i === 0 && j === 0 && Math.abs(z) < 4.5) return false
  if (Math.hypot(x - -8, z - 10) < 4.5) return false
  if (Math.abs(x) > 36 && Math.abs(z) > 36) return false
  if (Math.hypot(x, z) < 8.5) return false
  return true
}

export function gerarPaisagemBioma(
  i: number,
  j: number,
  startId = 5000,
): { bioma: BiomaId; recursos: RecursoNatural[]; lagoas: LagoaRasa[] } {
  const bioma = biomaDoQuadrado(i, j)
  const recursos: RecursoNatural[] = []
  const lagoas: LagoaRasa[] = []
  let nextId = startId

  const qtdArvores =
    bioma === 'bosque'
      ? 16
      : bioma === 'ribeira'
        ? 10
        : bioma === 'clareira'
          ? 8
          : bioma === 'tundra_cristal'
            ? 7
            : bioma === 'basalto_brasa'
              ? 4
              : 5
  const qtdOuro =
    bioma === 'basalto_brasa'
      ? 9
      : bioma === 'serra_ouro'
        ? 8
        : bioma === 'tundra_cristal'
          ? 5
          : bioma === 'clareira'
            ? 3
            : 4
  const qtdLagoas =
    bioma === 'ribeira'
      ? 3
      : bioma === 'tundra_cristal'
        ? 2
        : bioma === 'bosque' || bioma === 'basalto_brasa'
          ? 1
          : i === 0 && j === 0
            ? 1
            : 0

  for (let k = 0; k < qtdLagoas; k++) {
    const h1 = hashInt(i * 31 + k, j * 17 - k, 0x77aa11)
    const h2 = hashInt(i * 19 - k, j * 29 + k, 0x33cc99)
    const lx = i === 0 && j === 0 ? 20 : ((h1 % 68) - 34)
    const lz = i === 0 && j === 0 ? -16 : ((h2 % 68) - 34)
    if (Math.abs(lx) < 10 && lz > -10 && lz < 48) continue
    lagoas.push({
      x: lx,
      z: lz,
      rx: 4.5 + (h1 % 3),
      rz: 3.5 + (h2 % 3),
    })
  }

  let tentativas = 0
  while (recursos.filter((r) => r.tipo === 'arvore').length < qtdArvores && tentativas < 90) {
    const h = hashInt(i + tentativas * 7, j - tentativas * 13, 0x51a3b)
    tentativas += 1
    const x = ((h % 92) - 46)
    const z = (((h >>> 8) % 92) - 46)
    if (!livreDoCorredorCentral(x, z, i, j)) continue
    if (lagoas.some((l) => ((x - l.x) / (l.rx + 1)) ** 2 + ((z - l.z) / (l.rz + 1)) ** 2 <= 1)) continue
    if (recursos.some((r) => Math.hypot(r.x - x, r.z - z) < 3.4)) continue
    recursos.push({
      id: nextId++,
      tipo: 'arvore',
      x,
      z,
      yBase: 0,
      hp: 24,
      maxHp: 24,
      regeneraEm: 0,
    })
  }

  tentativas = 0
  while (recursos.filter((r) => r.tipo === 'ouro').length < qtdOuro && tentativas < 80) {
    const h = hashInt(i - tentativas * 11, j + tentativas * 23, 0x99f0d)
    tentativas += 1
    const x = ((h % 88) - 44)
    const z = (((h >>> 9) % 88) - 44)
    if (!livreDoCorredorCentral(x, z, i, j)) continue
    if (lagoas.some((l) => ((x - l.x) / (l.rx + 1)) ** 2 + ((z - l.z) / (l.rz + 1)) ** 2 <= 1)) continue
    if (recursos.some((r) => Math.hypot(r.x - x, r.z - z) < 3.6)) continue
    recursos.push({
      id: nextId++,
      tipo: 'ouro',
      x,
      z,
      yBase: 0,
      hp: 36,
      maxHp: 36,
      regeneraEm: 0,
    })
  }

  return { bioma, recursos, lagoas }
}

export function emAguaRasa(lagoas: readonly LagoaRasa[], x: number, z: number, y = 0): boolean {
  if (y < -0.5 || y > 0.35) return false
  return lagoas.some((l) => ((x - l.x) / l.rx) ** 2 + ((z - l.z) / l.rz) ** 2 <= 1)
}

export function gerarVeiosSubsolo(cx: number, cz: number, startId: number): RecursoNatural[] {
  const offsets: readonly [number, number][] = [
    [-5.5, -4.5],
    [5.5, -4.5],
    [-6.0, 3.5],
    [6.0, 3.5],
    [0, -6.2],
    [0, 5.8],
  ]
  return offsets.map(([dx, dz], idx) => ({
    id: startId + idx,
    tipo: 'ouro' as const,
    x: cx + dx,
    z: cz + dz,
    yBase: SUBSOLO_CFG.pisoY,
    hp: 24,
    maxHp: 24,
    regeneraEm: 0,
  }))
}

export function custoMadeiraObra(
  tipo: 'nucleo' | 'torre' | 'portao' | 'quartel' | 'britador' | 'serraria' | 'mina',
  qtdMesmoTipo: number,
): number {
  if (tipo === 'nucleo') return 0
  if ((tipo === 'torre' || tipo === 'britador') && qtdMesmoTipo === 0) return 0
  if (tipo === 'torre' || tipo === 'portao' || tipo === 'britador' || tipo === 'serraria') return 2
  return 3
}

export function atingirRecursoNoTiro(
  recursos: readonly RecursoNatural[],
  heroiX: number,
  heroiY: number,
  heroiZ: number,
  yaw: number,
  alcance: number,
  tempoRebrote: number,
): { recursos: RecursoNatural[]; ganhoMadeira: number; ganhoOuro: number; acertou: boolean } {
  const fx = -Math.sin(yaw)
  const fz = Math.cos(yaw)
  const noSubsolo = heroiY < -1.0
  let escolhido: RecursoNatural | null = null
  let melhorAlong = Number.POSITIVE_INFINITY

  for (const rec of recursos) {
    if (rec.hp <= 0) continue
    const recSubsolo = rec.yBase < -1.0
    if (noSubsolo !== recSubsolo) continue
    const dx = rec.x - heroiX
    const dz = rec.z - heroiZ
    const along = dx * fx + dz * fz
    if (along < 0.3 || along > Math.min(alcance, 14)) continue
    const perp = Math.abs(dx * fz - dz * fx)
    if (perp > 1.35) continue
    if (along < melhorAlong) {
      melhorAlong = along
      escolhido = rec
    }
  }

  if (!escolhido) {
    return { recursos: [...recursos], ganhoMadeira: 0, ganhoOuro: 0, acertou: false }
  }

  const novoHp = Math.max(0, escolhido.hp - 12)
  const derrubou = novoHp === 0
  const ganho = derrubou ? 3 : 1
  const atualizados = recursos.map((rec) =>
    rec.id === escolhido!.id
      ? {
          ...rec,
          hp: novoHp,
          regeneraEm: derrubou ? (rec.tipo === 'arvore' ? tempoRebrote : tempoRebrote + 15) : 0,
        }
      : rec,
  )
  return {
    recursos: atualizados,
    ganhoMadeira: escolhido.tipo === 'arvore' ? ganho : 0,
    ganhoOuro: escolhido.tipo === 'ouro' ? ganho : 0,
    acertou: true,
  }
}

/**
 * O passo da economia natural: rebrote de árvores/ouro e produção de serrarias e minas, a cada ciclo de 6 s. `nivel` (opcional, 1 se ausente) faz a obra render mais: a produção do ciclo é `base × 1,5^(nivel−1)`
 * (`producaoNoNivel`, pedido do usuário 23/11: «evoluir [...] se os edificios de recursos produzem mais»). A produção por ciclo é FRACIONÁRIA no nível 2 em diante (a serraria do nível 3 com árvore rende 4,5): o que
 * não cabe num inteiro vai para `restoMadeira`/`restoOuro` e SOMA no ciclo seguinte, então nenhuma fração se perde (arredondar para baixo todo ciclo faria o nível 2 render o mesmo que o nível 1 sem árvore).
 */
export function passoRecursosNaturais(
  recursos: readonly RecursoNatural[],
  serrariasAtivas: readonly { x: number; z: number; nivel?: number }[],
  minasAtivas: readonly { x: number; z: number; nivel?: number }[],
  relogioExtracao: number,
  dt: number,
  restos: { madeira: number; ouro: number } = { madeira: 0, ouro: 0 },
): {
  recursos: RecursoNatural[]
  ganhoMadeira: number
  ganhoOuro: number
  relogioExtracao: number
  mudouMalha: boolean
  restos: { madeira: number; ouro: number }
} {
  let mudouMalha = false
  const lista = recursos.map((rec) => {
    if (rec.hp > 0 || rec.regeneraEm <= 0) return rec
    const resta = rec.regeneraEm - dt
    if (resta > 0) return { ...rec, regeneraEm: resta }
    mudouMalha = true
    return { ...rec, hp: rec.maxHp, regeneraEm: 0 }
  })

  let ganhoMadeira = 0
  let ganhoOuro = 0
  let restoMadeira = Number.isFinite(restos.madeira) && restos.madeira > 0 ? restos.madeira : 0
  let restoOuro = Number.isFinite(restos.ouro) && restos.ouro > 0 ? restos.ouro : 0
  let relogio = relogioExtracao + dt
  if (relogio >= 6) {
    const ciclos = Math.floor(relogio / 6)
    relogio -= ciclos * 6
    let fracaoMadeira = 0
    let fracaoOuro = 0
    for (const s of serrariasAtivas) {
      const pertoArvore = lista.some((r) => r.tipo === 'arvore' && r.hp > 0 && Math.hypot(r.x - s.x, r.z - s.z) <= 12)
      fracaoMadeira += ciclos * producaoNoNivel(pertoArvore ? 2 : 1, s.nivel ?? 1)
    }
    for (const m of minasAtivas) {
      const pertoOuro = lista.some(
        (r) => r.tipo === 'ouro' && r.hp > 0 && r.yBase > -1 && Math.hypot(r.x - m.x, r.z - m.z) <= 12,
      )
      fracaoOuro += ciclos * producaoNoNivel(pertoOuro ? 2 : 1, m.nivel ?? 1)
    }
    // Soma o resto que sobrou do ciclo anterior e separa a parte inteira (o que entra no estoque agora) da fração (o que fica para depois). A folga de 1e-9 evita que 2,9999999999 vire 2.
    const totalMadeira = restoMadeira + fracaoMadeira
    const totalOuro = restoOuro + fracaoOuro
    ganhoMadeira = Math.floor(totalMadeira + 1e-9)
    ganhoOuro = Math.floor(totalOuro + 1e-9)
    restoMadeira = Math.max(0, totalMadeira - ganhoMadeira)
    restoOuro = Math.max(0, totalOuro - ganhoOuro)
  }

  return { recursos: lista, ganhoMadeira, ganhoOuro, relogioExtracao: relogio, mudouMalha, restos: { madeira: restoMadeira, ouro: restoOuro } }
}

export function indiceVoxelLocal(bx: number, by: number, bz: number): number {
  return bx + bz * VOXEL_NV5.nx + by * (VOXEL_NV5.nx * VOXEL_NV5.nz)
}

export function dentroVoxelLocal(bx: number, by: number, bz: number): boolean {
  return (
    bx >= 0 &&
    bx < VOXEL_NV5.nx &&
    by >= 0 &&
    by < VOXEL_NV5.ny &&
    bz >= 0 &&
    bz < VOXEL_NV5.nz
  )
}

/**
 * Cria uma fortaleza oca Nível 5+ (7x5x7 blocos de 0,85m ~ 5,95m x 4,25m x 5,95m):
 * - Paredes externas com porta frontal aberta (bx = 3, bz = 6, by = 0..1) e janelas de tiro;
 * - Escada interna de bloquinhos subindo até o piso superior/terraço (by = 3) e ameias (by = 4);
 * - Totalmente editável pelo jogador (adicionar/remover blocos).
 */
export function criarBlocosFortalezaNv5(): Uint8Array {
  const { nx, ny, nz } = VOXEL_NV5
  const cells = new Uint8Array(nx * ny * nz)
  const set = (bx: number, by: number, bz: number, val: number) => {
    if (dentroVoxelLocal(bx, by, bz)) cells[indiceVoxelLocal(bx, by, bz)] = val
  }
  for (let by = 0; by < ny; by++) {
    for (let bz = 0; bz < nz; bz++) {
      for (let bx = 0; bx < nx; bx++) {
        const borda = bx === 0 || bx === nx - 1 || bz === 0 || bz === nz - 1
        // Paredes do térreo e 1º pé-direito (by = 0, 1, 2)
        if (by <= 2 && borda) {
          // Porta frontal ampla no sul (bz = nz - 1, bx = 2..4, by = 0..1)
          const portaSul = bz === nz - 1 && bx >= 2 && bx <= 4 && by <= 1
          // Porta traseira estreita no norte (bz = 0, bx = 3, by = 0..1)
          const portaNorte = bz === 0 && bx === 3 && by <= 1
          // Janelas de vigia laterais (by = 1, meio das paredes leste/oeste)
          const janela = by === 1 && bz === 3 && (bx === 0 || bx === nx - 1)
          if (!portaSul && !portaNorte && !janela) set(bx, by, bz, 1)
        }
        // Laje do andar superior (by = 3), deixando vão da escada aberto (bx = 1..2, bz = 1..3)
        if (by === 3) {
          const vaoEscada = bx >= 1 && bx <= 2 && bz >= 1 && bz <= 3
          if (!vaoEscada) set(bx, by, bz, 2)
        }
        // Ameias do terraço superior (by = 4, cantos e bordas alternadas)
        if (by === 4 && borda && (bx + bz) % 2 === 0) {
          set(bx, by, bz, 1)
        }
      }
    }
  }
  // Escada interna em degraus (by = 0, 1, 2) subindo do salão ao terraço by = 3
  set(1, 0, 4, 2)
  set(2, 0, 4, 2)
  set(1, 1, 3, 2)
  set(2, 1, 3, 2)
  set(1, 2, 2, 2)
  set(2, 2, 2, 2)
  return cells
}

export function centroBlocoMundo(
  obraX: number,
  obraZ: number,
  bx: number,
  by: number,
  bz: number,
): { x: number; y: number; z: number } {
  const { nx, nz, passo } = VOXEL_NV5
  return {
    x: obraX + (bx - (nx - 1) / 2) * passo,
    y: by * passo + passo / 2,
    z: obraZ + (bz - (nz - 1) / 2) * passo,
  }
}

export function mundoParaBlocoLocal(
  obraX: number,
  obraZ: number,
  wx: number,
  wy: number,
  wz: number,
): { bx: number; by: number; bz: number } | null {
  const { nx, nz, passo } = VOXEL_NV5
  const bx = Math.round((wx - obraX) / passo + (nx - 1) / 2)
  const by = Math.floor(wy / passo)
  const bz = Math.round((wz - obraZ) / passo + (nz - 1) / 2)
  if (!dentroVoxelLocal(bx, by, bz)) return null
  return { bx, by, bz }
}
