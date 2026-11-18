import {
  atingirRecursoNoTiro,
  BiomaId,
  custoMadeiraObra,
  emAguaRasa,
  gerarPaisagemBioma,
  gerarVeiosSubsolo,
  LagoaRasa,
  passoRecursosNaturais,
  RecursoNatural,
  SUBSOLO_CFG,
} from './biomaRecursos'
import { Bloqueio, encaixarLivre, encontrarCaminho, Marco } from './caminho'
import { applyGateWithRemainder, clampArmy } from '../domain/armyMath'
import {
  GRAU_PARTIDA,
  DIMENSOES_OBRA,
  OBRA_CENTRO_Y,
  OBSTACULOS,
  Olhar,
  Ordem,
  PARTIDA,
  Papel,
  PecaId,
  PLUS_TEN,
  Postura,
  TEMPO_CONSTRUCAO,
} from './partidaPolicies'
import {
  afastarDeFortalezaNv5,
  bateObraUniversal,
  bateRecursoSuperficie,
  bloqueiosTerrenoEAldeaNv5,
  editarBlocoEmArray,
  garantirBlocosNv5,
  pisoUniversalEm,
  restringirGaleriaSubsolo,
  tetoUniversalEm,
} from './verticalidadeVoxel'

export interface Heroi {
  x: number
  z: number
  y: number
  vy: number
  yaw: number
  pitch: number
  army: number
  shootCooldown: number
  carregandoKg: number
}

export interface Obra {
  id: number
  lado: 'nosso' | 'inimigo'
  tipo: PecaId
  x: number
  z: number
  nivel: number
  hp: number
  maxHp: number
  gateApplied: boolean
  cooldown: number
  construindoRestante?: number
  construindoTotal?: number
  blocosNv5?: Uint8Array
}

export function obraEmConstrucao(obra: Obra): boolean {
  return obra.hp > 0 && (obra.construindoRestante ?? 0) > 0
}

export function aplicarDanoObra(obra: Obra, dano: number): Obra {
  if (obra.hp <= 0 || dano <= 0) return obra
  if (obraEmConstrucao(obra)) {
    return { ...obra, hp: 0, construindoRestante: 0 }
  }
  return { ...obra, hp: Math.max(0, obra.hp - dano) }
}

export interface Unidade {
  id: number
  lado: 'aliado' | 'inimigo'
  papel: Papel
  x: number
  z: number
  hp: number
  postura: Postura
  ordem: Ordem | null
  cooldown: number
  segmentos: number[]
  alerta: boolean
  rota?: Rota | null
  trilha?: { x: number; z: number }[]
}

export interface Rota {
  marcos: Marco[]
  renovarEm: number
  semCaminho: boolean
  versao: number
  modo: 'fixo' | 'vivo'
}

export interface Altar {
  tier: 1 | 2 | 3 | 4
  correta: 0 | 1 | 2 | 3
  cx: number
  cz: number
  resolvido: boolean
  aviso: string
}

export interface PartidaInput {
  forward: boolean
  back: boolean
  strafe: -1 | 0 | 1
  eixoX?: number
  eixoY?: number
}

export interface PartidaState {
  olhar: Olhar
  heroi: Heroi
  obras: Obra[]
  unidades: Unidade[]
  nextId: number
  gateArchApplied: boolean
  ruaPercorrida: boolean
  derrota: boolean
  credito: number
  lingotes: number
  resto: number
  ondaRelogio: number
  ondaNumero: number
  altar: Altar | null
  tempo: number
  pedraNoChao: boolean
  versaoSolidos: number
  heroiOrdem: HeroiOrdem | null
  chaoVisto: Uint8Array
  versaoChao: number
  semCorpo: boolean
  bioma: BiomaId
  recursos: RecursoNatural[]
  lagoas: LagoaRasa[]
  madeira: number
  ouro: number
  relogioExtracao: number
  versaoRecursos: number
  subsoloCentro: { x: number; z: number } | null
}

export type HeroiOrdem =
  | { tipo: 'mover'; x: number; z: number; rota: Rota }
  | { tipo: 'atacar'; alvoId: number; rota: Rota | null }
  | { tipo: 'atacarObra'; obraId: number; rota: Rota | null }

const VAZIO: PartidaInput = { forward: false, back: false, strafe: 0 }

function heroiInicial(): Heroi {
  return {
    x: 0,
    z: 0,
    y: 0,
    vy: 0,
    yaw: 0,
    pitch: 0,
    army: 10,
    shootCooldown: 0,
    carregandoKg: 0,
  }
}

function hordaInicial(startId: number): Unidade[] {
  return [0, 1, 2, 3, 4, 5].map((index) => ({
    id: startId + index,
    lado: 'inimigo' as const,
    papel: 'horda' as const,
    x: -2.5 + (index % 3) * 2.2,
    z: 44 + Math.floor(index / 3) * 1.6,
    hp: 12,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [],
    alerta: false,
  }))
}

const MEIA_CHAO = Math.ceil(PARTIDA.radius)
const LADO_CHAO = MEIA_CHAO * 2 + 1

function indiceChao(gx: number, gz: number): number | null {
  if (gx < -MEIA_CHAO || gx > MEIA_CHAO || gz < -MEIA_CHAO || gz > MEIA_CHAO) return null
  if (PARTIDA.atlas !== 'grade') {
    const cx = gx * PARTIDA.celula
    const cz = gz * PARTIDA.celula
    if (cx * cx + cz * cz > PARTIDA.radius * PARTIDA.radius) return null
  }
  return (gz + MEIA_CHAO) * LADO_CHAO + (gx + MEIA_CHAO)
}

export const CELULAS_DO_DISCO: readonly { x: number; z: number; i: number }[] = (() => {
  const lista: { x: number; z: number; i: number }[] = []
  for (let gz = -MEIA_CHAO; gz <= MEIA_CHAO; gz++) {
    for (let gx = -MEIA_CHAO; gx <= MEIA_CHAO; gx++) {
      const i = indiceChao(gx, gz)
      if (i === null) continue
      lista.push({ x: gx * PARTIDA.celula, z: gz * PARTIDA.celula, i })
    }
  }
  return lista
})()

function raioDaObra(obra: Obra): number {
  if (obraEmConstrucao(obra)) return PARTIDA.visao.obra
  return obra.tipo === 'torre' ? PARTIDA.visao.torre : PARTIDA.visao.obra
}

function dentroDaUniao(state: PartidaState, x: number, z: number): boolean {
  if (!state.semCorpo && Math.hypot(x - state.heroi.x, z - state.heroi.z) <= PARTIDA.visao.heroi) return true
  for (const unidade of state.unidades) {
    if (unidade.lado === 'aliado' && unidade.hp > 0 && Math.hypot(x - unidade.x, z - unidade.z) <= PARTIDA.visao.tropa) {
      return true
    }
  }
  for (const obra of state.obras) {
    if (nossa(obra) && obra.hp > 0 && Math.hypot(x - obra.x, z - obra.z) <= raioDaObra(obra)) return true
  }
  return false
}

export function marcarChao(state: PartidaState): PartidaState {
  if (!PARTIDA.nuvem) return state
  const base = state.chaoVisto
  let copia: Uint8Array | null = null
  const acender = (indice: number) => {
    if ((copia ?? base)[indice] === 1) return
    if (!copia) copia = new Uint8Array(base)
    copia[indice] = 1
  }
  const carimbar = (x: number, z: number, raio: number) => {
    const gx0 = Math.round(x / PARTIDA.celula)
    const gz0 = Math.round(z / PARTIDA.celula)
    const margem = Math.ceil(raio) + 1
    for (let gz = gz0 - margem; gz <= gz0 + margem; gz++) {
      for (let gx = gx0 - margem; gx <= gx0 + margem; gx++) {
        const cx = gx * PARTIDA.celula
        const cz = gz * PARTIDA.celula
        if ((cx - x) ** 2 + (cz - z) ** 2 > raio * raio) continue
        const indice = indiceChao(gx, gz)
        if (indice !== null) acender(indice)
      }
    }
  }
  if (!state.semCorpo) carimbar(state.heroi.x, state.heroi.z, PARTIDA.visao.heroi)
  for (const unidade of state.unidades) {
    if (unidade.lado === 'aliado' && unidade.hp > 0) carimbar(unidade.x, unidade.z, PARTIDA.visao.tropa)
  }
  for (const obra of state.obras) {
    if (nossa(obra) && obra.hp > 0) carimbar(obra.x, obra.z, raioDaObra(obra))
  }
  if (!copia) return state
  return { ...state, chaoVisto: copia, versaoChao: state.versaoChao + 1 }
}

export function chaoRevelado(state: PartidaState, x: number, z: number): boolean {
  const indice = indiceChao(Math.round(x / PARTIDA.celula), Math.round(z / PARTIDA.celula))
  if (indice === null) return false
  if (!PARTIDA.nuvem) return true
  return state.chaoVisto[indice] === 1
}

export function cobertoAgora(state: PartidaState, x: number, z: number): boolean {
  if (!PARTIDA.nuvem) return true
  return dentroDaUniao(state, x, z)
}

export function inimigoVisivel(state: PartidaState, unidade: Unidade): boolean {
  if (unidade.lado !== 'inimigo' || unidade.hp <= 0) return false
  if (!PARTIDA.nuvem) return true
  return dentroDaUniao(state, unidade.x, unidade.z)
}

export function alcanceDaTorre(torre: Obra): number {
  return PARTIDA.torreAlcance + (torre.nivel - 1) * 2
}

export function marcadoPelaTorre(state: PartidaState, unidade: Unidade): boolean {
  if (!inimigoVisivel(state, unidade)) return false
  let noOlho = false
  for (const torre of state.obras) {
    if (!nossa(torre) || torre.tipo !== 'torre' || torre.hp <= 0 || obraEmConstrucao(torre)) continue
    const alcance = alcanceDaTorre(torre)
    if (pontosDoCorpo(unidade).some((ponto) => Math.hypot(ponto.x - torre.x, ponto.z - torre.z) <= alcance)) return false
    if (Math.hypot(unidade.x - torre.x, unidade.z - torre.z) <= PARTIDA.visao.torre) noOlho = true
  }
  return noOlho
}

export function alcanceDoTiro(x: number, z: number, yaw: number): number {
  const borda = alcanceAteABorda(x, z, yaw)
  if (!PARTIDA.nuvem) return borda
  return Math.min(borda, PARTIDA.visao.heroi)
}

export function alvoDoBotao(state: PartidaState): number | null {
  const nucleo = nucleoNosso(state.obras, false)
  const origem = nucleo ?? state.heroi
  let melhor = Number.POSITIVE_INFINITY
  let id: number | null = null
  for (const unidade of state.unidades) {
    if (unidade.papel === 'isca' || !inimigoVisivel(state, unidade)) continue
    const dist = Math.hypot(unidade.x - origem.x, unidade.z - origem.z)
    if (dist < melhor) {
      melhor = dist
      id = unidade.id
    }
  }
  return id
}

export function alvoDoBotaoObra(state: PartidaState): number | null {
  const nucleo = nucleoNosso(state.obras, false)
  const origem = nucleo ?? state.heroi
  let melhor = Number.POSITIVE_INFINITY
  let id: number | null = null
  for (const obra of state.obras) {
    if (nossa(obra) || obra.hp <= 0 || !cobertoAgora(state, obra.x, obra.z)) continue
    const dist = Math.hypot(obra.x - origem.x, obra.z - origem.z)
    if (dist < melhor) {
      melhor = dist
      id = obra.id
    }
  }
  return id
}

function nossa(obra: Obra): boolean {
  return obra.lado !== 'inimigo'
}

function nucleoNosso(obras: readonly Obra[], vivo = true): Obra | undefined {
  return obras.find((obra) => nossa(obra) && obra.tipo === 'nucleo' && (!vivo || obra.hp > 0))
}

function nucleoInimigo(obras: readonly Obra[], vivo = true): Obra | undefined {
  return obras.find((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo' && (!vivo || obra.hp > 0))
}

const PECAS_INIMIGAS: readonly PecaId[] = ['torre', 'quartel', 'portao', 'britador']

export function lugarDaBaseInimiga(i: number, j: number): { x: number; z: number } {
  const cantos = [
    [42, 42],
    [-42, 42],
    [42, -42],
    [-42, -42],
    [46, 6],
    [-46, -10],
    [8, -46],
    [-6, 46],
  ] as const
  let n = Math.imul((i + 8) ^ Math.imul(j + 3, 0x45d9f3b), 0x27d4eb2d) >>> 0
  const canto = cantos[n % cantos.length]
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0
  const limite = PARTIDA.radius - 6
  return {
    x: Math.max(-limite, Math.min(limite, canto[0] + (n % 7) - 3)),
    z: Math.max(-limite, Math.min(limite, canto[1] + ((n >>> 8) % 7) - 3)),
  }
}

function plantarBaseInimiga(state: PartidaState, i: number, j: number): PartidaState {
  if (nucleoInimigo(state.obras, false)) return state
  const lugar = lugarDaBaseInimiga(i, j)
  const hp = PARTIDA.nucleoHp
  const obra: Obra = {
    id: state.nextId,
    lado: 'inimigo',
    tipo: 'nucleo',
    x: lugar.x,
    z: lugar.z,
    nivel: 1,
    hp,
    maxHp: hp,
    gateApplied: false,
    cooldown: 0,
  }
  return { ...state, obras: [...state.obras, obra], nextId: state.nextId + 1 }
}

export function createPartida(mapaI = 0, mapaJ = 0, semCorpo = false): PartidaState {
  const unidades = hordaInicial(1)
  const paisagem = gerarPaisagemBioma(mapaI, mapaJ, 5000)
  const vazia: PartidaState = {
    olhar: 'terceira',
    heroi: heroiInicial(),
    obras: [],
    unidades,
    nextId: unidades.length + 1,
    gateArchApplied: false,
    ruaPercorrida: false,
    derrota: false,
    credito: PARTIDA.creditoInicial,
    lingotes: 0,
    resto: 0,
    ondaRelogio: 0,
    ondaNumero: 0,
    altar: null,
    tempo: 0,
    pedraNoChao: true,
    versaoSolidos: 0,
    heroiOrdem: null,
    chaoVisto: new Uint8Array(LADO_CHAO * LADO_CHAO),
    versaoChao: 0,
    semCorpo,
    bioma: paisagem.bioma,
    recursos: paisagem.recursos,
    lagoas: paisagem.lagoas,
    madeira: 0,
    ouro: 0,
    relogioExtracao: 0,
    versaoRecursos: 0,
    subsoloCentro: null,
  }
  return marcarChao(plantarBaseInimiga(vazia, mapaI, mapaJ))
}

function clampPitch(pitch: number): number {
  return Math.min(PARTIDA.pitchMax, Math.max(PARTIDA.pitchMin, pitch))
}

function cair(
  y: number,
  vy: number,
  x: number,
  z: number,
  pedraNoChao: boolean,
  obras: readonly Obra[],
  recursos: readonly RecursoNatural[],
  subsoloCentro: { x: number; z: number } | null,
  dt: number,
): { y: number; vy: number } {
  const piso = pisoUniversalEm(x, y, z, pedraNoChao, obras, recursos, subsoloCentro)
  const teto = tetoUniversalEm(x, y, z, obras, subsoloCentro)
  let vy1 = vy - PARTIDA.gravidade * dt
  let y1 = y + vy1 * dt
  if (y1 > teto && vy1 > 0) {
    y1 = teto
    vy1 = 0
  }
  if (y1 <= piso) return { y: piso, vy: 0 }
  return { y: y1, vy: vy1 }
}

export function pular(state: PartidaState): PartidaState {
  if (state.derrota || state.semCorpo || state.olhar === 'imperio') return state
  const piso = pisoUniversalEm(
    state.heroi.x,
    state.heroi.y,
    state.heroi.z,
    state.pedraNoChao,
    state.obras,
    state.recursos,
    state.subsoloCentro,
  )
  if (state.heroi.y > piso + 0.08) return state
  return { ...state, heroi: { ...state.heroi, y: piso, vy: PARTIDA.pulo } }
}

export function alternarSubsolo(state: PartidaState): PartidaState {
  if (state.derrota || state.semCorpo) return state
  if (state.heroi.y < -0.9) {
    const cx = state.subsoloCentro?.x ?? state.heroi.x
    const cz = state.subsoloCentro?.z ?? state.heroi.z
    const saida = puxaLimite(cx, cz + 1.8)
    return {
      ...state,
      heroiOrdem: null,
      heroi: { ...state.heroi, x: saida.x, y: 0, z: saida.z, vy: 0 },
    }
  }
  const minas = state.obras.filter(
    (obra) => nossa(obra) && obra.tipo === 'mina' && obra.hp > 0 && !obraEmConstrucao(obra),
  )
  if (minas.length === 0) return state
  minas.sort(
    (a, b) =>
      Math.hypot(a.x - state.heroi.x, a.z - state.heroi.z) -
      Math.hypot(b.x - state.heroi.x, b.z - state.heroi.z),
  )
  const mina = minas[0]
  const jaTemSubsolo = state.recursos.some((r) => r.yBase < -0.9)
  const recursos = jaTemSubsolo
    ? state.recursos
    : [...state.recursos, ...gerarVeiosSubsolo(mina.x, mina.z, 8000 + state.nextId)]
  return {
    ...state,
    olhar: state.olhar === 'imperio' ? 'primeira' : state.olhar,
    heroiOrdem: null,
    subsoloCentro: { x: mina.x, z: mina.z },
    recursos,
    versaoRecursos: jaTemSubsolo ? state.versaoRecursos : state.versaoRecursos + 1,
    heroi: {
      ...state.heroi,
      x: mina.x,
      y: SUBSOLO_CFG.pisoY,
      z: mina.z + 1.4,
      vy: 0,
      pitch: 0,
    },
  }
}

export function definirOlhar(state: PartidaState, olhar: Olhar): PartidaState {
  if (state.semCorpo) return state
  if (state.olhar === olhar) return state
  return { ...state, olhar }
}

export function mira(state: PartidaState, dYaw: number, dPitch: number): PartidaState {
  if (state.semCorpo) return state
  const yawDelta = Number.isFinite(dYaw) ? dYaw : 0
  const pitchDelta = Number.isFinite(dPitch) ? dPitch : 0
  if (yawDelta === 0 && pitchDelta === 0) return state
  return {
    ...state,
    heroi: {
      ...state.heroi,
      yaw: state.heroi.yaw + yawDelta,
      pitch: clampPitch(state.heroi.pitch + pitchDelta),
    },
  }
}

function dentroDoDisco(x: number, z: number): boolean {
  return Math.hypot(x, z) <= PARTIDA.radius - PARTIDA.body
}

function dentroDoQuadrado(x: number, z: number): boolean {
  const limite = PARTIDA.radius - PARTIDA.body
  return Math.abs(x) <= limite && Math.abs(z) <= limite
}

function dentroDoMapa(x: number, z: number): boolean {
  return PARTIDA.atlas === 'grade' ? dentroDoQuadrado(x, z) : dentroDoDisco(x, z)
}

function puxaDisco(x: number, z: number): { x: number; z: number } {
  const dist = Math.hypot(x, z)
  const limite = PARTIDA.radius - PARTIDA.body
  if (dist <= limite || dist === 0) return { x, z }
  const escala = limite / dist
  return { x: x * escala, z: z * escala }
}

function puxaLimite(x: number, z: number): { x: number; z: number } {
  if (PARTIDA.atlas !== 'grade') return puxaDisco(x, z)
  const limite = PARTIDA.radius - PARTIDA.body
  return {
    x: Math.min(limite, Math.max(-limite, x)),
    z: Math.min(limite, Math.max(-limite, z)),
  }
}

function cobre(x: number, z: number, cx: number, cz: number, hx: number, hz: number): boolean {
  return Math.abs(x - cx) < hx + PARTIDA.body && Math.abs(z - cz) < hz + PARTIDA.body
}

function bateObstaculo(x: number, z: number, pes = 0): boolean {
  if (pes < -0.9) return false
  return OBSTACULOS.some(
    (caixa) => cobre(x, z, caixa.x, caixa.z, caixa.hx, caixa.hz) && pes < caixa.altura - 0.12,
  )
}

function meiaObra(tipo: PecaId): { hx: number; hz: number } {
  const caixa = DIMENSOES_OBRA[tipo]
  return { hx: caixa[0] / 2, hz: caixa[2] / 2 }
}

function bateObra(x: number, z: number, obras: readonly Obra[], ignorarId = -1, pes = 0): boolean {
  return bateObraUniversal(x, z, obras, ignorarId, pes)
}

function escorrega(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  obras: readonly Obra[],
  solto = false,
  pes = 0,
  recursos: readonly RecursoNatural[] = [],
  subsoloCentro: { x: number; z: number } | null = null,
): { x: number; z: number } {
  let x = x1
  let z = z1
  const bloqueia = (px: number, pz: number) =>
    bateObstaculo(px, pz, pes) ||
    bateObra(px, pz, obras, -1, pes) ||
    bateRecursoSuperficie(px, pz, pes, recursos)
  if (bloqueia(x, z)) {
    if (!bloqueia(x0, z)) x = x0
    else if (!bloqueia(x, z0)) z = z0
    else {
      x = x0
      z = z0
    }
  }
  if (subsoloCentro && pes < -0.9) {
    return restringirGaleriaSubsolo(x, z, subsoloCentro)
  }
  return solto ? { x, z } : puxaLimite(x, z)
}

function cruzaCaixa(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): boolean {
  const passos = 8
  for (let i = 0; i <= passos; i++) {
    const t = i / passos
    const x = x0 + (x1 - x0) * t
    const z = z0 + (z1 - z0) * t
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true
  }
  return false
}

function vivosInimigos(state: PartidaState): Unidade[] {
  return state.unidades.filter((unidade) => unidade.lado === 'inimigo' && unidade.hp > 0)
}

function aliadosVivos(state: PartidaState): Unidade[] {
  return state.unidades.filter((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
}

function nucleoDe(state: PartidaState): Obra | undefined {
  return nucleoNosso(state.obras)
}

export function fundar(
  state: PartidaState,
  tipo: PecaId,
  x: number,
  z: number,
  opcoes?: { emConstrucao?: boolean; cobrarRecursos?: boolean },
): PartidaState {
  if (state.derrota || !Number.isFinite(x) || !Number.isFinite(z)) return state
  if (!dentroDoMapa(x, z)) return state
  if (tipo === 'nucleo' && nucleoNosso(state.obras, false)) return state
  if (tipo !== 'nucleo' && !nucleoDe(state)) return state
  if (state.semCorpo && PARTIDA.nuvem && !chaoRevelado(state, x, z)) return state
  if (!state.semCorpo && state.heroi.y >= -0.9 && Math.hypot(x - state.heroi.x, z - state.heroi.z) < 1.6) return state
  if (bateObstaculo(x, z) || bateObra(x, z, state.obras)) return state
  if (state.unidades.some((unidade) => unidade.hp > 0 && Math.hypot(unidade.x - x, unidade.z - z) < 1.4)) {
    return state
  }

  let madeira = state.madeira
  let credito = state.credito
  if (opcoes?.cobrarRecursos) {
    const qtdMesmo = state.obras.filter((o) => nossa(o) && o.tipo === tipo && o.hp > 0).length
    const custoMad = custoMadeiraObra(tipo, qtdMesmo)
    if (custoMad > 0) {
      if (madeira >= custoMad) madeira -= custoMad
      else if (credito >= 1) credito -= 1
      else return state
    }
  }

  // Limpa automaticamente árvores do canteiro de obras (concedendo +1 madeira por árvore limpa)
  let limpouTerreno = false
  const recursos = state.recursos.map((rec) => {
    if (rec.hp <= 0 || rec.yBase < -0.5 || rec.tipo !== 'arvore') return rec
    if (Math.hypot(rec.x - x, rec.z - z) > 2.2) return rec
    limpouTerreno = true
    madeira += 1
    return { ...rec, hp: 0, regeneraEm: PARTIDA.rebroteArvoreSeg }
  })

  const hp = tipo === 'nucleo' ? PARTIDA.nucleoHp : 40 + 10
  const duracao = opcoes?.emConstrucao ? TEMPO_CONSTRUCAO[tipo] : 0
  const obra: Obra = {
    id: state.nextId,
    lado: 'nosso',
    tipo,
    x,
    z,
    nivel: 1,
    hp,
    maxHp: hp,
    gateApplied: false,
    cooldown: 0,
    construindoRestante: duracao,
    construindoTotal: duracao,
  }
  return marcarChao({
    ...state,
    madeira,
    credito,
    recursos: limpouTerreno ? recursos : state.recursos,
    versaoRecursos: limpouTerreno ? state.versaoRecursos + 1 : state.versaoRecursos,
    obras: [...state.obras, obra],
    nextId: state.nextId + 1,
    versaoSolidos: tipo === 'portao' ? state.versaoSolidos : state.versaoSolidos + 1,
  })
}

export function iniciarObra(state: PartidaState, tipo: PecaId, x: number, z: number): PartidaState {
  return fundar(state, tipo, x, z, { emConstrucao: true, cobrarRecursos: true })
}

function afastarDaObra(
  px: number,
  pz: number,
  obra: Obra,
  obras: readonly Obra[],
  pes = 0,
): { x: number; z: number } {
  const meia = meiaObra(obra.tipo)
  const afasteX = meia.hx + PARTIDA.body + 0.05
  const afasteZ = meia.hz + PARTIDA.body + 0.05
  if (Math.abs(px - obra.x) >= afasteX || Math.abs(pz - obra.z) >= afasteZ) return { x: px, z: pz }
  const candidatos = [
    { x: px, z: obra.z - afasteZ },
    { x: px, z: obra.z + afasteZ },
    { x: obra.x - afasteX, z: pz },
    { x: obra.x + afasteX, z: pz },
    { x: obra.x - afasteX, z: obra.z - afasteZ },
    { x: obra.x + afasteX, z: obra.z - afasteZ },
    { x: obra.x - afasteX, z: obra.z + afasteZ },
    { x: obra.x + afasteX, z: obra.z + afasteZ },
  ].sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))
  const livre = candidatos.find((c) => dentroDoMapa(c.x, c.z) && !bateObstaculo(c.x, c.z, pes) && !bateObra(c.x, c.z, obras))
  return livre ?? puxaLimite(candidatos[0].x, candidatos[0].z)
}

export function repararObra(state: PartidaState, obraId: number): PartidaState {
  if (state.derrota) return state
  const obra = state.obras.find((item) => item.id === obraId && nossa(item) && item.hp <= 0)
  if (!obra) return state
  const comLingotes = state.lingotes >= PARTIDA.reparoLingotes
  const comCredito = state.credito >= PARTIDA.reparoCredito
  const comRecursos = state.madeira >= 3 && state.ouro >= 2
  if (!comLingotes && !comCredito && !comRecursos) return state
  const obras = state.obras.map((item) => (item.id === obraId ? { ...item, hp: item.maxHp } : item))
  const solida = obra.tipo !== 'portao'
  const posHeroi =
    solida && !state.semCorpo ? afastarDaObra(state.heroi.x, state.heroi.z, obra, obras, state.heroi.y) : null
  const heroi =
    posHeroi && (posHeroi.x !== state.heroi.x || posHeroi.z !== state.heroi.z)
      ? { ...state.heroi, x: posHeroi.x, z: posHeroi.z }
      : state.heroi
  const unidades = solida
    ? state.unidades.map((unidade) => {
        if (unidade.hp <= 0) return unidade
        const pos = afastarDaObra(unidade.x, unidade.z, obra, obras)
        return pos.x === unidade.x && pos.z === unidade.z ? unidade : { ...unidade, x: pos.x, z: pos.z }
      })
    : state.unidades
  return marcarChao({
    ...state,
    lingotes: comLingotes ? state.lingotes - PARTIDA.reparoLingotes : state.lingotes,
    credito: !comLingotes && comCredito ? state.credito - PARTIDA.reparoCredito : state.credito,
    madeira: !comLingotes && !comCredito && comRecursos ? state.madeira - 3 : state.madeira,
    ouro: !comLingotes && !comCredito && comRecursos ? state.ouro - 2 : state.ouro,
    obras,
    heroi,
    unidades,
    versaoSolidos: solida ? state.versaoSolidos + 1 : state.versaoSolidos,
  })
}

export function aproximacaoDaObra(obra: Obra, deX: number, deZ: number): { x: number; z: number } {
  const caixa = DIMENSOES_OBRA[obra.tipo]
  const hx = (obra.blocosNv5 ? 3.1 : caixa[0] / 2) + 0.6
  const hz = (obra.blocosNv5 ? 3.1 : caixa[2] / 2) + 0.6
  const dx = deX - obra.x
  const dz = deZ - obra.z
  const maior = Math.max(Math.abs(dx) / hx, Math.abs(dz) / hz)
  if (maior < 1e-6) return { x: obra.x, z: obra.z + hz }
  const fator = 1.05 / maior
  return { x: obra.x + dx * fator, z: obra.z + dz * fator }
}

export function evoluir(state: PartidaState, obraId: number): PartidaState {
  if (state.derrota) return state
  const obra = state.obras.find((item) => item.id === obraId && item.hp > 0 && nossa(item) && !obraEmConstrucao(item))
  if (!obra || obra.nivel >= PARTIDA.nivelMaximoObra) return state
  const usaCredito = state.credito >= 1
  const usaRecursos = state.madeira >= 2 && state.ouro >= 2
  if (!usaCredito && !usaRecursos) return state
  const novoNivel = obra.nivel + 1
  const bonusHp = novoNivel >= 4 ? (novoNivel === 5 ? 50 : 30) : 0
  const viraFortalezaNv5 = novoNivel >= 5 && obra.tipo !== 'portao'
  const obras = state.obras.map((item) => {
    if (item.id !== obraId) return item
    const novoMax = item.maxHp + bonusHp
    return {
      ...item,
      nivel: novoNivel,
      hp: novoMax,
      maxHp: novoMax,
      ...(viraFortalezaNv5 ? { blocosNv5: garantirBlocosNv5(item) } : {}),
    }
  })
  let heroi = state.heroi
  let unidades = state.unidades
  if (viraFortalezaNv5) {
    const obraNv5 = obras.find((item) => item.id === obraId)!
    if (!state.semCorpo) {
      const livre = afastarDeFortalezaNv5(heroi.x, heroi.y, heroi.z, obraNv5)
      heroi = { ...heroi, x: livre.x, z: livre.z }
    }
    unidades = unidades.map((u) => {
      if (u.hp <= 0) return u
      const livre = afastarDeFortalezaNv5(u.x, 0, u.z, obraNv5)
      return { ...u, x: livre.x, z: livre.z }
    })
  }
  return {
    ...state,
    credito: usaCredito ? state.credito - 1 : state.credito,
    madeira: usaCredito ? state.madeira : state.madeira - 2,
    ouro: usaCredito ? state.ouro : state.ouro - 2,
    obras,
    heroi,
    unidades,
    versaoSolidos: viraFortalezaNv5 ? state.versaoSolidos + 1 : state.versaoSolidos,
    versaoRecursos: viraFortalezaNv5 ? state.versaoRecursos + 1 : state.versaoRecursos,
  }
}

export function editarBlocoObra(
  state: PartidaState,
  obraId: number,
  bx: number,
  by: number,
  bz: number,
  acao: 'adicionar' | 'remover',
): PartidaState {
  if (state.derrota) return state
  const obra = state.obras.find(
    (item) => item.id === obraId && nossa(item) && item.hp > 0 && !obraEmConstrucao(item) && Boolean(item.blocosNv5),
  )
  if (!obra || !obra.blocosNv5) return state
  const novosBlocos = editarBlocoEmArray(
    obra.blocosNv5,
    obra.x,
    obra.z,
    bx,
    by,
    bz,
    acao,
    state.semCorpo ? null : state.heroi,
  )
  if (!novosBlocos) return state
  return {
    ...state,
    madeira: acao === 'remover' ? state.madeira + 1 : Math.max(0, state.madeira - 1),
    obras: state.obras.map((item) => (item.id === obraId ? { ...item, blocosNv5: novosBlocos } : item)),
    versaoSolidos: state.versaoSolidos + 1,
    versaoRecursos: state.versaoRecursos + 1,
  }
}

export function criarTropa(state: PartidaState, obraId: number): PartidaState {
  if (state.derrota) return state
  const usaCredito = state.credito >= 1
  const usaOuro = state.ouro >= 2
  if (!usaCredito && !usaOuro) return state
  if (aliadosVivos(state).length >= PARTIDA.allyCap) return state
  const obra = state.obras.find(
    (item) =>
      item.id === obraId &&
      nossa(item) &&
      item.hp > 0 &&
      !obraEmConstrucao(item) &&
      (item.tipo === 'nucleo' || item.tipo === 'quartel'),
  )
  if (!obra) return state
  const distSaida = obra.blocosNv5 ? 3.5 : 1.8
  const unidade: Unidade = {
    id: state.nextId,
    lado: 'aliado',
    papel: 'tropa',
    x: obra.x + distSaida,
    z: obra.z,
    hp: 16,
    postura: 'ordens',
    ordem: null,
    cooldown: 0,
    segmentos: [],
    alerta: true,
  }
  if (bateObra(unidade.x, unidade.z, state.obras) || !dentroDoMapa(unidade.x, unidade.z)) {
    unidade.x = obra.x
    unidade.z = obra.z + distSaida
  }
  return marcarChao({
    ...state,
    credito: usaCredito ? state.credito - 1 : state.credito,
    ouro: usaCredito ? state.ouro : state.ouro - 2,
    nextId: state.nextId + 1,
    unidades: [...state.unidades, unidade],
  })
}

export function idsNoRetangulo(
  state: PartidaState,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): number[] {
  const minX = Math.min(x0, x1)
  const maxX = Math.max(x0, x1)
  const minZ = Math.min(z0, z1)
  const maxZ = Math.max(z0, z1)
  return state.unidades
    .filter(
      (unidade) =>
        unidade.lado === 'aliado' &&
        unidade.hp > 0 &&
        unidade.x >= minX &&
        unidade.x <= maxX &&
        unidade.z >= minZ &&
        unidade.z <= maxZ,
    )
    .map((unidade) => unidade.id)
}

export function ordenar(state: PartidaState, ids: readonly number[], ordem: Ordem): PartidaState {
  if (state.derrota) return state
  const quer = new Set(ids)
  const bloqueios = bloqueiosDe(state)
  let mudou = false
  const unidades = state.unidades.map((unidade) => {
    if (!quer.has(unidade.id) || unidade.lado !== 'aliado' || unidade.hp <= 0) return unidade
    mudou = true
    if (ordem.tipo !== 'mover') return { ...unidade, postura: 'ordens' as const, ordem, rota: null }
    const custoAgua =
      state.lagoas.length > 0
        ? (px: number, pz: number) => (emAguaRasa(state.lagoas, px, pz, 0) ? PARTIDA.custoAguaCaminho : 1)
        : undefined
    const marcos = encontrarCaminho(unidade.x, unidade.z, ordem.x, ordem.z, bloqueios, custoAgua)
    return {
      ...unidade,
      postura: 'ordens' as const,
      ordem,
      rota: {
        marcos: marcos ?? [],
        renovarEm: state.tempo + PARTIDA.recalcularSeg,
        semCaminho: marcos === null,
        versao: state.versaoSolidos,
        modo: 'fixo' as const,
      },
    }
  })
  if (!mudou) return state
  return { ...state, unidades }
}

export function postura(state: PartidaState, ids: readonly number[], valor: Postura): PartidaState {
  if (state.derrota) return state
  const quer = new Set(ids)
  let mudou = false
  const unidades = state.unidades.map((unidade) => {
    if (!quer.has(unidade.id) || unidade.lado !== 'aliado' || unidade.hp <= 0) return unidade
    mudou = true
    return {
      ...unidade,
      postura: valor,
      ordem: valor === 'automatico' ? null : unidade.ordem,
    }
  })
  if (!mudou) return state
  return { ...state, unidades }
}

export function aplicarConta(state: PartidaState, tier: 1 | 2 | 3 | 4): PartidaState {
  if (state.derrota) return state
  const spec = GRAU_PARTIDA[tier]
  const inimigos = vivosInimigos(state)
  const wipe =
    inimigos.length === 0
      ? 0
      : spec.wipe >= 1
        ? inimigos.length
        : Math.max(1, Math.round(inimigos.length * spec.wipe))
  const perto = [...inimigos].sort((a, b) => {
    const da = (a.x - state.heroi.x) ** 2 + (a.z - state.heroi.z) ** 2
    const db = (b.x - state.heroi.x) ** 2 + (b.z - state.heroi.z) ** 2
    return da - db
  })
  const mata = new Set(perto.slice(0, wipe).map((unidade) => unidade.id))
  return {
    ...state,
    credito: state.credito + spec.credito,
    madeira: state.madeira + tier * 2,
    ouro: state.ouro + tier,
    heroi: { ...state.heroi, army: clampArmy(state.heroi.army + spec.bonus) },
    unidades: state.unidades.map((unidade) =>
      mata.has(unidade.id) ? { ...unidade, hp: 0, segmentos: [] } : unidade,
    ),
    altar: state.altar ? { ...state.altar, resolvido: true, aviso: '' } : null,
  }
}

export function fecharAltar(state: PartidaState): PartidaState {
  if (!state.altar) return state
  return { ...state, altar: null }
}

export function abrirAltar(state: PartidaState, tier: 1 | 2 | 3 | 4, correta: 0 | 1 | 2 | 3): PartidaState {
  if (state.derrota) return state
  return {
    ...state,
    altar: {
      tier,
      correta,
      cx: state.heroi.x,
      cz: state.heroi.z,
      resolvido: false,
      aviso: '',
    },
  }
}

export function invocarDragao(state: PartidaState): PartidaState {
  if (state.derrota || vivosInimigos(state).length >= PARTIDA.enemyCap) return state
  return {
    ...state,
    nextId: state.nextId + 1,
    unidades: [...state.unidades, criarCorpoDragao(state.nextId, 0, 50)],
  }
}

function nascerDragaoDaLeva(state: PartidaState): PartidaState {
  if (state.derrota || vivosInimigos(state).length >= PARTIDA.enemyCap) return state
  const origem = nucleoInimigo(state.obras)
  const alvo = nucleoNosso(state.obras)
  if (!origem || !alvo) return state
  const saida = saidaDaBase(origem, alvo)
  const celula = encaixarLivre(Math.round(saida.x / PARTIDA.celula), Math.round(saida.z / PARTIDA.celula), bloqueiosDe(state))
  if (!celula) return state
  return {
    ...state,
    nextId: state.nextId + 1,
    unidades: [
      ...state.unidades,
      criarCorpoDragao(state.nextId, celula[0] * PARTIDA.celula, celula[1] * PARTIDA.celula),
    ],
  }
}

function saidaDaBase(base: { x: number; z: number }, alvo: { x: number; z: number }): { x: number; z: number } {
  const dx = alvo.x - base.x
  const dz = alvo.z - base.z
  const mag = Math.hypot(dx, dz) || 1
  return { x: base.x + (dx / mag) * 3, z: base.z + (dz / mag) * 3 }
}

function vidaDaLeva(numero: number): number {
  return 14 + (numero - 1) * 4
}

function crescerBaseInimiga(state: PartidaState, numero: number): PartidaState {
  const nucleo = nucleoInimigo(state.obras)
  if (!nucleo) return state
  let obras = state.obras.map((obra) => (obra.id === nucleo.id ? { ...obra, nivel: Math.max(obra.nivel, numero) } : obra))
  if (numero % 2 !== 0) return { ...state, obras }
  const indice = numero / 2 - 1
  const tipo = PECAS_INIMIGAS[indice % PECAS_INIMIGAS.length]
  const anel = Math.floor(indice / PECAS_INIMIGAS.length)
  const angulo = (indice % PECAS_INIMIGAS.length) * (Math.PI / 2) + anel * 0.4
  const distancia = 3.2 + anel * 2.4
  const x = nucleo.x + Math.cos(angulo) * distancia
  const z = nucleo.z + Math.sin(angulo) * distancia
  if (!dentroDoMapa(x, z) || bateObstaculo(x, z) || bateObra(x, z, obras)) return { ...state, obras }
  const hp = tipo === 'torre' ? 50 : 40
  const duracao = TEMPO_CONSTRUCAO[tipo]
  const peca: Obra = {
    id: state.nextId,
    lado: 'inimigo',
    tipo,
    x,
    z,
    nivel: 1,
    hp,
    maxHp: hp,
    gateApplied: false,
    cooldown: 0,
    construindoRestante: duracao,
    construindoTotal: duracao,
  }
  return { ...state, obras: [...obras, peca], nextId: state.nextId + 1, versaoSolidos: state.versaoSolidos + 1 }
}

function fereDragaoOuCorpo(unidade: Unidade, dano: number): Unidade {
  if (unidade.hp <= 0) return unidade
  if (unidade.papel === 'dragao' && unidade.segmentos.length > 0) {
    const segmentos = unidade.segmentos.slice(0, -1)
    return { ...unidade, segmentos, hp: segmentos.length === 0 ? 0 : unidade.hp }
  }
  const hp = unidade.hp - dano
  return { ...unidade, hp: hp > 0 ? hp : 0 }
}

function pontoNaDistancia(linha: readonly { x: number; z: number }[], distancia: number): { x: number; z: number } {
  let resta = distancia
  for (let i = 0; i < linha.length - 1; i++) {
    const a = linha[i]
    const b = linha[i + 1]
    const passo = Math.hypot(b.x - a.x, b.z - a.z)
    if (passo < 1e-6) continue
    if (resta <= passo) {
      const t = resta / passo
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
    }
    resta -= passo
  }
  return linha[linha.length - 1]
}

export function pontosDoCorpo(unidade: Unidade): { x: number; z: number }[] {
  const cabeca = { x: unidade.x, z: unidade.z }
  if (unidade.papel !== 'dragao' || unidade.segmentos.length === 0) return [cabeca]
  const linha = [cabeca, ...(unidade.trilha ?? [])]
  const pontos = [cabeca]
  for (let i = 0; i < unidade.segmentos.length; i++) pontos.push(pontoNaDistancia(linha, (i + 1) * PARTIDA.corpoPasso))
  return pontos
}

function registrarTrilha(antes: Unidade, depois: Unidade): Unidade {
  if (depois.papel !== 'dragao') return depois
  const previa = antes.trilha ?? []
  let trilha = previa.length > 0 ? previa : [{ x: antes.x, z: antes.z }]
  const base = trilha[0]
  if (Math.hypot(depois.x - base.x, depois.z - base.z) >= 0.45) {
    trilha = [{ x: depois.x, z: depois.z }, ...trilha].slice(0, 48)
  }
  return { ...depois, trilha }
}

function criarCorpoDragao(id: number, x: number, z: number): Unidade {
  return {
    id,
    lado: 'inimigo',
    papel: 'dragao',
    x,
    z,
    hp: 30,
    postura: 'automatico',
    ordem: null,
    cooldown: 0,
    segmentos: [48, 36, 24, 12, 6],
    alerta: true,
    trilha: [],
  }
}

export function vetorDoOlhar(yaw: number, pitch: number) {
  const horizontal = Math.cos(pitch)
  return {
    x: -Math.sin(yaw) * horizontal,
    y: Math.sin(pitch),
    z: Math.cos(yaw) * horizontal,
  }
}

export function alcanceAteABorda(x: number, z: number, yaw: number): number {
  const fx = -Math.sin(yaw)
  const fz = Math.cos(yaw)
  if (PARTIDA.atlas !== 'grade') {
    const b = x * fx + z * fz
    const disco = b * b - (x * x + z * z - PARTIDA.radius * PARTIDA.radius)
    if (disco <= 0) return 0
    return Math.max(0, -b + Math.sqrt(disco))
  }
  const limite = PARTIDA.radius
  let melhor = Number.POSITIVE_INFINITY
  if (Math.abs(fx) > 1e-8) {
    const tx = (fx > 0 ? limite - x : -limite - x) / fx
    if (tx > 0) {
      const hz = z + fz * tx
      if (hz >= -limite - 1e-4 && hz <= limite + 1e-4) melhor = Math.min(melhor, tx)
    }
  }
  if (Math.abs(fz) > 1e-8) {
    const tz = (fz > 0 ? limite - z : -limite - z) / fz
    if (tz > 0) {
      const hx = x + fx * tz
      if (hx >= -limite - 1e-4 && hx <= limite + 1e-4) melhor = Math.min(melhor, tz)
    }
  }
  return Number.isFinite(melhor) ? melhor : 0
}

export function folgaDoTiro(along: number): number {
  return PARTIDA.tiroFolgaMin + PARTIDA.tiroFolgaExtra / (1 + Math.max(0, along) / PARTIDA.tiroFolgaEscala)
}

function aproximaCorpo(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  px: number,
  pz: number,
): { along: number; perp: number } {
  const y0 = PARTIDA.tiroCorpoBaixo
  const segY = PARTIDA.tiroCorpoAlto - y0
  const sx = px - ox
  const sy = y0 - oy
  const sz = pz - oz
  const b = dy * segY
  const e = segY * segY
  const d = dx * sx + dy * sy + dz * sz
  const f = segY * sy
  const denom = e - b * b
  let s = denom < 1e-8 ? 0 : (b * d - f) / denom
  if (s < 0) s = 0
  else if (s > 1) s = 1
  const by = y0 + segY * s
  const along = dx * sx + dy * (by - oy) + dz * sz
  const perp = Math.hypot(dx * along - sx, dy * along - (by - oy), dz * along - sz)
  return { along, perp }
}

function entradaNaObra(state: PartidaState, obra: Obra, direcao: { x: number; y: number; z: number }, origemY: number): number {
  const dimensoes = DIMENSOES_OBRA[obra.tipo]
  const origens = [state.heroi.x, origemY, state.heroi.z]
  const centros = [obra.x, OBRA_CENTRO_Y, obra.z]
  const eixos = [direcao.x, direcao.y, direcao.z]
  let entrada = 0
  let saida = Number.POSITIVE_INFINITY
  for (let eixo = 0; eixo < 3; eixo++) {
    const minimo = centros[eixo] - dimensoes[eixo] / 2
    const maximo = centros[eixo] + dimensoes[eixo] / 2
    if (Math.abs(eixos[eixo]) < 1e-8) {
      if (origens[eixo] < minimo || origens[eixo] > maximo) return Number.POSITIVE_INFINITY
      continue
    }
    const a = (minimo - origens[eixo]) / eixos[eixo]
    const b = (maximo - origens[eixo]) / eixos[eixo]
    entrada = Math.max(entrada, Math.min(a, b))
    saida = Math.min(saida, Math.max(a, b))
    if (entrada > saida) return Number.POSITIVE_INFINITY
  }
  return entrada
}

function entradaNoCorpo(dx: number, dz: number, direcao: { x: number; y: number; z: number }, raio: number, oy: number): number {
  const baixo = PARTIDA.tiroCorpoBaixo
  const alto = PARTIDA.tiroCorpoAlto
  if (Math.hypot(dx, dz, oy - Math.max(baixo, Math.min(alto, oy))) <= raio) return 0
  let entrada = Number.POSITIVE_INFINITY
  const a = direcao.x ** 2 + direcao.z ** 2
  const b = -(dx * direcao.x + dz * direcao.z)
  const c = dx * dx + dz * dz - raio * raio
  const discriminante = b * b - a * c
  if (a > 1e-8 && discriminante >= 0) {
    const t = (-b - Math.sqrt(discriminante)) / a
    const y = oy + t * direcao.y
    if (t >= 0 && y >= baixo && y <= alto) entrada = t
  }
  for (const y of [baixo, alto]) {
    const dy = y - oy
    const projecao = dx * direcao.x + dy * direcao.y + dz * direcao.z
    const disco = projecao * projecao - (dx * dx + dy * dy + dz * dz - raio * raio)
    if (disco < 0) continue
    const t = projecao - Math.sqrt(disco)
    if (t >= 0) entrada = Math.min(entrada, t)
  }
  return entrada
}

export function atirar(state: PartidaState): PartidaState {
  if (state.derrota || state.semCorpo || state.heroi.shootCooldown > 0) return state
  const gasto: PartidaState = {
    ...state,
    heroi: { ...state.heroi, shootCooldown: PARTIDA.shootCooldown },
  }
  if (Math.abs(state.heroi.pitch) >= PARTIDA.pitchTetoTiro) return gasto
  const fx = -Math.sin(state.heroi.yaw)
  const fz = Math.cos(state.heroi.yaw)
  const olhar = vetorDoOlhar(state.heroi.yaw, state.heroi.pitch)
  const origemY = PARTIDA.eyeY + state.heroi.y
  const alcance = alcanceDoTiro(state.heroi.x, state.heroi.z, state.heroi.yaw)
  let alvo: Unidade | null = null
  let obraAlvo: Obra | null = null
  let melhor = Number.POSITIVE_INFINITY
  for (const unidade of state.unidades) {
    if (unidade.lado !== 'inimigo' || unidade.hp <= 0 || !inimigoVisivel(state, unidade)) continue
    for (const ponto of pontosDoCorpo(unidade)) {
      const dx = ponto.x - state.heroi.x
      const dz = ponto.z - state.heroi.z
      const alongChao = dx * fx + dz * fz
      if (alongChao < 0.35 || alongChao > alcance + 0.05) continue
      const corpo = aproximaCorpo(
        state.heroi.x,
        origemY,
        state.heroi.z,
        olhar.x,
        olhar.y,
        olhar.z,
        ponto.x,
        ponto.z,
      )
      if (corpo.along < 0.2 || corpo.perp > folgaDoTiro(alongChao)) continue
      const entrada = entradaNoCorpo(dx, dz, olhar, folgaDoTiro(alongChao), origemY)
      if (entrada >= melhor) continue
      alvo = unidade
      melhor = entrada
    }
  }
  for (const obra of state.obras) {
    if (nossa(obra) || obra.hp <= 0 || !cobertoAgora(state, obra.x, obra.z)) continue
    if (Math.hypot(obra.x - state.heroi.x, obra.z - state.heroi.z) > alcance) continue
    const entrada = entradaNaObra(state, obra, olhar, origemY)
    if (!Number.isFinite(entrada) || entrada > melhor + 1e-8) continue
    obraAlvo = obra
    melhor = entrada
  }
  if (obraAlvo) {
    const ferida = aplicarDanoObra(obraAlvo, 12)
    return {
      ...gasto,
      obras: gasto.obras.map((obra) => (obra.id === obraAlvo.id ? ferida : obra)),
      versaoSolidos: gasto.versaoSolidos + (ferida.hp === 0 && obraAlvo.tipo !== 'portao' ? 1 : 0),
    }
  }
  if (!alvo) {
    const colheita = atingirRecursoNoTiro(
      gasto.recursos,
      state.heroi.x,
      state.heroi.y,
      state.heroi.z,
      state.heroi.yaw,
      alcance,
      PARTIDA.rebroteArvoreSeg,
    )
    if (!colheita.acertou) return gasto
    return {
      ...gasto,
      recursos: colheita.recursos,
      madeira: gasto.madeira + colheita.ganhoMadeira,
      ouro: gasto.ouro + colheita.ganhoOuro,
      versaoRecursos: gasto.versaoRecursos + 1,
    }
  }
  const id = alvo.id
  return {
    ...gasto,
    unidades: gasto.unidades.map((unidade) =>
      unidade.id === id ? fereDragaoOuCorpo(unidade, 12) : unidade,
    ),
  }
}

function maisPerto(x: number, z: number, lista: readonly { id: number; x: number; z: number }[]): number | null {
  let melhor = Number.POSITIVE_INFINITY
  let id: number | null = null
  for (const item of lista) {
    const dist = Math.hypot(item.x - x, item.z - z)
    if (dist < melhor) {
      melhor = dist
      id = item.id
    }
  }
  return id
}

function moverUnidade(
  unidade: Unidade,
  tx: number,
  tz: number,
  velocidade: number,
  dt: number,
  obras: readonly Obra[],
  lagoas: readonly LagoaRasa[] = [],
): Unidade {
  const dx = tx - unidade.x
  const dz = tz - unidade.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.08) return unidade
  const fatorAgua = emAguaRasa(lagoas, unidade.x, unidade.z, 0) ? PARTIDA.aguaFatorVelocidade : 1
  const passo = Math.min(velocidade * fatorAgua * dt, dist)
  const prox = escorrega(
    unidade.x,
    unidade.z,
    unidade.x + (dx / dist) * passo,
    unidade.z + (dz / dist) * passo,
    obras,
  )
  return { ...unidade, x: prox.x, z: prox.z }
}

function bloqueiosDe(state: PartidaState): Bloqueio[] {
  const lista: Bloqueio[] = OBSTACULOS.map((caixa) => ({
    x: caixa.x,
    z: caixa.z,
    hx: caixa.hx,
    hz: caixa.hz,
  }))
  for (const obra of state.obras) {
    if (obra.hp <= 0 || obra.tipo === 'portao') continue
    if (obra.blocosNv5) continue
    const meia = meiaObra(obra.tipo)
    lista.push({ x: obra.x, z: obra.z, hx: meia.hx, hz: meia.hz })
  }
  const obrasNv5 = state.obras.filter((o) => o.hp > 0 && Boolean(o.blocosNv5))
  if (obrasNv5.length > 0) {
    lista.push(...bloqueiosTerrenoEAldeaNv5(obrasNv5, []))
  }
  return lista
}

function prepararRota(
  unidade: Unidade,
  tx: number,
  tz: number,
  tempo: number,
  versao: number,
  bloqueios: readonly Bloqueio[],
  modo: 'fixo' | 'vivo',
  lagoas: readonly LagoaRasa[] = [],
): Unidade {
  const rota = unidade.rota
  const venceu =
    !rota ||
    rota.modo !== modo ||
    rota.versao !== versao ||
    (modo === 'vivo' && tempo >= rota.renovarEm)
  if (!venceu) return unidade
  const custoAgua =
    lagoas.length > 0
      ? (px: number, pz: number) => (emAguaRasa(lagoas, px, pz, 0) ? PARTIDA.custoAguaCaminho : 1)
      : undefined
  const marcos = encontrarCaminho(unidade.x, unidade.z, tx, tz, bloqueios, custoAgua)
  return {
    ...unidade,
    rota: {
      marcos: marcos ?? [],
      renovarEm: tempo + PARTIDA.recalcularSeg,
      semCaminho: marcos === null,
      versao,
      modo,
    },
  }
}

function avancarRota(
  unidade: Unidade,
  tx: number,
  tz: number,
  velocidade: number,
  dt: number,
  obras: readonly Obra[],
  tempo: number,
  versao: number,
  bloqueios: readonly Bloqueio[],
  modo: 'fixo' | 'vivo',
  lagoas: readonly LagoaRasa[] = [],
): Unidade {
  const atual = prepararRota(unidade, tx, tz, tempo, versao, bloqueios, modo, lagoas)
  if (atual.rota?.semCaminho) return atual
  let marcos = atual.rota?.marcos ?? [{ x: tx, z: tz }]
  while (marcos.length > 0 && Math.hypot(atual.x - marcos[0].x, atual.z - marcos[0].z) < 0.5) {
    marcos = marcos.slice(1)
  }
  const meta = marcos[0] ?? { x: tx, z: tz }
  const moved = moverUnidade(atual, meta.x, meta.z, velocidade, dt, obras, lagoas)
  const chegou = modo === 'fixo' && Math.hypot(moved.x - tx, moved.z - tz) < 0.5
  return {
    ...moved,
    ordem: chegou && moved.ordem?.tipo === 'mover' ? null : moved.ordem,
    rota: atual.rota ? { ...atual.rota, marcos: chegou ? [] : marcos } : moved.rota,
  }
}

function sombraDoHeroi(state: PartidaState, rota: Rota | null): Unidade {
  return {
    id: -2,
    lado: 'aliado',
    papel: 'tropa',
    x: state.heroi.x,
    z: state.heroi.z,
    hp: 1,
    postura: 'ordens',
    ordem: null,
    cooldown: 0,
    segmentos: [],
    alerta: true,
    rota,
  }
}

function yawAte(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(-(tx - x), tz - z)
}

export function ordenarHeroi(state: PartidaState, ordem: Ordem): PartidaState {
  if (state.derrota || state.semCorpo) return state
  if (ordem.tipo === 'mover') {
    const custoAgua =
      state.lagoas.length > 0
        ? (px: number, pz: number) => (emAguaRasa(state.lagoas, px, pz, 0) ? PARTIDA.custoAguaCaminho : 1)
        : undefined
    const marcos = encontrarCaminho(state.heroi.x, state.heroi.z, ordem.x, ordem.z, bloqueiosDe(state), custoAgua)
    return {
      ...state,
      heroiOrdem: {
        tipo: 'mover',
        x: ordem.x,
        z: ordem.z,
        rota: {
          marcos: marcos ?? [],
          renovarEm: state.tempo + PARTIDA.recalcularSeg,
          semCaminho: marcos === null,
          versao: state.versaoSolidos,
          modo: 'fixo',
        },
      },
    }
  }
  if (ordem.tipo === 'atacarObra') {
    return { ...state, heroiOrdem: { tipo: 'atacarObra', obraId: ordem.obraId, rota: null } }
  }
  return { ...state, heroiOrdem: { tipo: 'atacar', alvoId: ordem.alvoId, rota: null } }
}

function seguirOrdemHeroi(state: PartidaState, dt: number): PartidaState {
  const ordem = state.heroiOrdem
  if (!ordem || state.derrota) return state
  const bloqueios = bloqueiosDe(state)
  if (ordem.tipo === 'mover') {
    const andou = avancarRota(
      sombraDoHeroi(state, ordem.rota),
      ordem.x,
      ordem.z,
      PARTIDA.heroSpeed,
      dt,
      state.obras,
      state.tempo,
      state.versaoSolidos,
      bloqueios,
      'fixo',
    )
    const chegou = Math.hypot(andou.x - ordem.x, andou.z - ordem.z) < 0.5
    return {
      ...state,
      heroi: {
        ...state.heroi,
        x: andou.x,
        z: andou.z,
        yaw: yawAte(state.heroi.x, state.heroi.z, andou.x, andou.z),
      },
      heroiOrdem: chegou || !andou.rota ? null : { ...ordem, rota: andou.rota },
    }
  }
  if (ordem.tipo === 'atacarObra') {
    const obra = state.obras.find((item) => item.id === ordem.obraId && item.hp > 0 && !nossa(item))
    if (!obra) return { ...state, heroiOrdem: null }
    const dist = Math.hypot(state.heroi.x - obra.x, state.heroi.z - obra.z)
    let atual = state
    if (dist > PARTIDA.shootRange * 0.8) {
      const peri = aproximacaoDaObra(obra, state.heroi.x, state.heroi.z)
      const andou = avancarRota(
        sombraDoHeroi(state, ordem.rota),
        peri.x,
        peri.z,
        PARTIDA.heroSpeed,
        dt,
        state.obras,
        state.tempo,
        state.versaoSolidos,
        bloqueios,
        'vivo',
      )
      atual = {
        ...state,
        heroi: { ...state.heroi, x: andou.x, z: andou.z },
        heroiOrdem: { ...ordem, rota: andou.rota ?? null },
      }
    }
    const yaw = yawAte(atual.heroi.x, atual.heroi.z, obra.x, obra.z)
    const distAtual = Math.max(0.5, Math.hypot(atual.heroi.x - obra.x, atual.heroi.z - obra.z))
    const pitch = clampPitch(Math.atan2(OBRA_CENTRO_Y - (PARTIDA.eyeY + atual.heroi.y), distAtual))
    atual = { ...atual, heroi: { ...atual.heroi, yaw, pitch } }
    if (Math.hypot(atual.heroi.x - obra.x, atual.heroi.z - obra.z) <= PARTIDA.shootRange) return atirar(atual)
    return atual
  }
  const alvo = state.unidades.find((unidade) => unidade.id === ordem.alvoId && unidade.hp > 0)
  if (!alvo) return { ...state, heroiOrdem: null }
  const dist = Math.hypot(state.heroi.x - alvo.x, state.heroi.z - alvo.z)
  let atual = state
  if (dist > PARTIDA.shootRange * 0.8) {
    const andou = avancarRota(
      sombraDoHeroi(state, ordem.rota),
      alvo.x,
      alvo.z,
      PARTIDA.heroSpeed,
      dt,
      state.obras,
      state.tempo,
      state.versaoSolidos,
      bloqueios,
      'vivo',
    )
    atual = {
      ...state,
      heroi: { ...state.heroi, x: andou.x, z: andou.z },
      heroiOrdem: { ...ordem, rota: andou.rota ?? null },
    }
  }
  const yaw = yawAte(atual.heroi.x, atual.heroi.z, alvo.x, alvo.z)
  atual = { ...atual, heroi: { ...atual.heroi, yaw, pitch: 0 } }
  if (Math.hypot(atual.heroi.x - alvo.x, atual.heroi.z - alvo.z) <= PARTIDA.shootRange) return atirar(atual)
  return atual
}

function passoHeroi(state: PartidaState, input: PartidaInput, dt: number): PartidaState {
  if (state.semCorpo) return state
  if (state.olhar === 'imperio') {
    const ordem = seguirOrdemHeroi(state, dt)
    const queda = cair(
      ordem.heroi.y,
      ordem.heroi.vy,
      ordem.heroi.x,
      ordem.heroi.z,
      ordem.pedraNoChao,
      ordem.obras,
      ordem.recursos,
      ordem.subsoloCentro,
      dt,
    )
    return { ...ordem, heroi: { ...ordem.heroi, y: queda.y, vy: queda.vy } }
  }
  const analogico = typeof input.eixoX === 'number' || typeof input.eixoY === 'number'
  const drive = analogico
    ? Math.max(-1, Math.min(1, input.eixoY ?? 0))
    : (input.forward ? 1 : 0) - (input.back ? 1 : 0)
  const lado = analogico ? Math.max(-1, Math.min(1, input.eixoX ?? 0)) : input.strafe
  if (state.heroiOrdem && (Math.abs(drive) > 0.2 || Math.abs(lado) > 0.2)) {
    state = { ...state, heroiOrdem: null }
  }
  const yaw = state.heroi.yaw
  const fx = -Math.sin(yaw)
  const fz = Math.cos(yaw)
  const rx = -Math.cos(yaw)
  const rz = -Math.sin(yaw)
  let mx = fx * drive + rx * lado
  let mz = fz * drive + rz * lado
  const mag = Math.hypot(mx, mz)
  if (mag > 1) {
    mx /= mag
    mz /= mag
  }
  const fatorAgua = emAguaRasa(state.lagoas, state.heroi.x, state.heroi.z, state.heroi.y)
    ? PARTIDA.aguaFatorVelocidade
    : 1
  const dist = PARTIDA.heroSpeed * fatorAgua * dt
  const x1 = state.heroi.x + mx * dist
  const z1 = state.heroi.z + mz * dist
  const pos = escorrega(
    state.heroi.x,
    state.heroi.z,
    x1,
    z1,
    state.obras,
    PARTIDA.atlas === 'grade',
    state.heroi.y,
    state.recursos,
    state.subsoloCentro,
  )
  let gateArchApplied = state.gateArchApplied
  let army = state.heroi.army
  if (
    !gateArchApplied &&
    state.heroi.y >= -0.5 &&
    cruzaCaixa(
      state.heroi.x,
      state.heroi.z,
      x1,
      z1,
      PARTIDA.arch.minX,
      PARTIDA.arch.maxX,
      PARTIDA.arch.minZ,
      PARTIDA.arch.maxZ,
    )
  ) {
    army = applyGateWithRemainder(army, PLUS_TEN).nextArmy
    gateArchApplied = true
  }
  let carregandoKg = state.heroi.carregandoKg
  let pedraNoChao = state.pedraNoChao
  const pertoDaPedra = state.heroi.y >= -0.5 && Math.hypot(pos.x - PARTIDA.pedraX, pos.z - PARTIDA.pedraZ) < 1.3
  if (carregandoKg === 0 && pedraNoChao && pertoDaPedra && state.heroi.y < 0.2) {
    carregandoKg = PARTIDA.pedraKg
    pedraNoChao = false
  }
  let lingotes = state.lingotes
  let resto = state.resto
  const britador = state.obras.find(
    (obra) => nossa(obra) && obra.tipo === 'britador' && obra.hp > 0 && !obraEmConstrucao(obra),
  )
  if (
    britador &&
    carregandoKg > 0 &&
    state.heroi.y >= -0.5 &&
    Math.hypot(pos.x - britador.x, pos.z - britador.z) < 1.8
  ) {
    lingotes += Math.floor(carregandoKg / PARTIDA.britadorDivisor)
    resto += carregandoKg % PARTIDA.britadorDivisor
    carregandoKg = 0
  }
  if (!pedraNoChao && carregandoKg === 0 && Math.hypot(pos.x - PARTIDA.pedraX, pos.z - PARTIDA.pedraZ) > 2.6) {
    pedraNoChao = true
  }
  const ruaPercorrida = state.ruaPercorrida || pos.z >= PARTIDA.asphaltEndZ
  const queda = cair(
    state.heroi.y,
    state.heroi.vy,
    pos.x,
    pos.z,
    pedraNoChao,
    state.obras,
    state.recursos,
    state.subsoloCentro,
    dt,
  )
  return {
    ...state,
    gateArchApplied,
    ruaPercorrida,
    lingotes,
    resto,
    pedraNoChao,
    heroi: { ...state.heroi, x: pos.x, z: pos.z, y: queda.y, vy: queda.vy, army, carregandoKg },
  }
}

function portoesConstruidos(state: PartidaState): PartidaState {
  let army = state.heroi.army
  let mudou = false
  const obras = state.obras.map((obra) => {
    if (!nossa(obra) || obra.tipo !== 'portao' || obra.gateApplied || obra.hp <= 0 || obraEmConstrucao(obra)) return obra
    const meio = 1.2
    if (
      !cruzaCaixa(
        state.heroi.x,
        state.heroi.z,
        state.heroi.x,
        state.heroi.z,
        obra.x - meio,
        obra.x + meio,
        obra.z - meio,
        obra.z + meio,
      )
    ) {
      return obra
    }
    mudou = true
    army = applyGateWithRemainder(army, { ...PLUS_TEN, id: `portao-${obra.id}` }).nextArmy
    return { ...obra, gateApplied: true }
  })
  if (!mudou) return state
  return { ...state, obras, heroi: { ...state.heroi, army } }
}

function altarNoPasso(state: PartidaState): PartidaState {
  const altar = state.altar
  if (!altar || altar.resolvido) return state
  const pontos = [
    { x: altar.cx, z: altar.cz + PARTIDA.altarPasso },
    { x: altar.cx + PARTIDA.altarPasso, z: altar.cz },
    { x: altar.cx, z: altar.cz - PARTIDA.altarPasso },
    { x: altar.cx - PARTIDA.altarPasso, z: altar.cz },
  ]
  for (let indice = 0; indice < pontos.length; indice++) {
    const ponto = pontos[indice]
    if (Math.hypot(state.heroi.x - ponto.x, state.heroi.z - ponto.z) > PARTIDA.altarRaio) continue
    if (indice === altar.correta) return aplicarConta(state, altar.tier)
    return { ...state, altar: { ...altar, aviso: 'Esse piso não é a resposta.' } }
  }
  return state
}

function danoHordaNoHeroi(state: PartidaState): PartidaState {
  if (state.semCorpo || state.heroi.y < -0.9) return state
  let army = state.heroi.army
  let mudou = false
  const unidades = state.unidades.map((unidade) => {
    if (unidade.papel !== 'horda' || unidade.hp <= 0) return unidade
    const dist = Math.hypot(unidade.x - state.heroi.x, unidade.z - state.heroi.z)
    if (dist > PARTIDA.hitRadius) return unidade
    mudou = true
    army = clampArmy(army - PARTIDA.hitDamage)
    return { ...unidade, hp: 0 }
  })
  if (!mudou) return state
  return { ...state, unidades, heroi: { ...state.heroi, army } }
}

function emContatoComObra(px: number, pz: number, obra: Obra): boolean {
  const m = obra.blocosNv5 ? { hx: 3.0, hz: 3.0 } : meiaObra(obra.tipo)
  const dx = Math.max(0, Math.abs(px - obra.x) - m.hx)
  const dz = Math.max(0, Math.abs(pz - obra.z) - m.hz)
  return Math.hypot(dx, dz) <= 0.98 || Math.hypot(px - obra.x, pz - obra.z) <= PARTIDA.nucleoContato
}

function passoUnidades(state: PartidaState, dt: number): PartidaState {
  const obrasVivas = state.obras.filter((obra) => nossa(obra) && obra.hp > 0)
  const alvosObra = obrasVivas.map((obra) => ({ id: obra.id, x: obra.x, z: obra.z }))
  const bloqueios = bloqueiosDe(state)
  const versao = state.versaoSolidos
  let obras: Obra[] = state.obras.map((obra) => ({
    ...obra,
    cooldown: Math.max(0, obra.cooldown - dt),
    construindoRestante:
      obra.hp > 0 && (obra.construindoRestante ?? 0) > 0
        ? Math.max(0, (obra.construindoRestante ?? 0) - dt)
        : 0,
  }))
  let unidades = state.unidades.map((unidade) => ({ ...unidade, cooldown: Math.max(0, unidade.cooldown - dt) }))
  let army = state.heroi.army

  const vivo = (id: number) => unidades.find((unidade) => unidade.id === id && unidade.hp > 0)
  const obraInimigaViva = (id: number) => obras.find((obra) => obra.id === id && !nossa(obra) && obra.hp > 0)

  unidades = unidades.map((unidade) => {
    if (unidade.hp <= 0) return unidade
    if (unidade.papel === 'horda') {
      const obraPerto = obrasVivas.some((obra) => Math.hypot(unidade.x - obra.x, unidade.z - obra.z) < 12)
      const alerta =
        unidade.alerta ||
        obraPerto ||
        (!state.semCorpo && state.heroi.z >= PARTIDA.aggroZ) ||
        (!state.semCorpo && Math.hypot(unidade.x - state.heroi.x, unidade.z - state.heroi.z) < PARTIDA.acquireHorda)
      if (!alerta) return unidade
      const obraColada = obrasVivas.find((obra) => obra.tipo !== 'portao' && emContatoComObra(unidade.x, unidade.z, obra))
      if (obraColada) return { ...unidade, alerta: true }
      const heroiCand = !state.semCorpo && state.heroi.army > 0 ? [{ id: -1, x: state.heroi.x, z: state.heroi.z }] : []
      const cands = [...heroiCand, ...alvosObra]
      const escolhido = maisPerto(unidade.x, unidade.z, cands)
      const meta = escolhido === -1 || escolhido === null
        ? { x: state.heroi.x, z: state.heroi.z }
        : cands.find((item) => item.id === escolhido) ?? { x: state.heroi.x, z: state.heroi.z }
      return {
        ...avancarRota(
          unidade,
          meta.x,
          meta.z,
          PARTIDA.enemySpeed,
          dt,
          obras,
          state.tempo,
          versao,
          bloqueios,
          'vivo',
        ),
        alerta: true,
      }
    }
    if ((unidade.papel === 'sitiante' || unidade.papel === 'dragao') && PARTIDA.levaAlvo === 'nucleo') {
      const nucleo = nucleoNosso(obras)
      if (nucleo && emContatoComObra(unidade.x, unidade.z, nucleo)) {
        return registrarTrilha(unidade, unidade)
      }
      if (nucleo) {
        const andaimePerto = obras.find(
          (obra) => nossa(obra) && obraEmConstrucao(obra) && obra.tipo !== 'portao' && emContatoComObra(unidade.x, unidade.z, obra),
        )
        if (andaimePerto) return registrarTrilha(unidade, unidade)
        const ido = avancarRota(
          unidade,
          nucleo.x,
          nucleo.z,
          PARTIDA.enemySpeed,
          dt,
          obras,
          state.tempo,
          versao,
          bloqueios,
          'vivo',
        )
        if (!ido.rota?.semCaminho) return registrarTrilha(unidade, ido)
        const solidos = obras.filter((obra) => nossa(obra) && obra.hp > 0 && obra.tipo !== 'portao')
        const id = maisPerto(unidade.x, unidade.z, solidos)
        const alvo = solidos.find((obra) => obra.id === id)
        if (!alvo) return registrarTrilha(unidade, ido)
        return registrarTrilha(unidade, moverUnidade(ido, alvo.x, alvo.z, PARTIDA.enemySpeed, dt, obras))
      }
    }
    if (unidade.lado === 'inimigo') {
      if (unidade.papel === 'isca') return unidade
      const colada = obras.some((obra) => nossa(obra) && obra.hp > 0 && emContatoComObra(unidade.x, unidade.z, obra))
      if (colada) return registrarTrilha(unidade, unidade)
      const aliados = unidades.filter((item) => item.lado === 'aliado' && item.hp > 0)
      const heroiAlvo = !state.semCorpo && state.heroi.army > 0 ? [{ id: -1, x: state.heroi.x, z: state.heroi.z }] : []
      const candidatos = [...alvosObra, ...aliados, ...heroiAlvo]
      const id = maisPerto(unidade.x, unidade.z, candidatos)
      if (id === null) return registrarTrilha(unidade, unidade)
      const alvo = id === -1 ? { x: state.heroi.x, z: state.heroi.z } : candidatos.find((item) => item.id === id)
      if (!alvo) return registrarTrilha(unidade, unidade)
      return registrarTrilha(
        unidade,
        avancarRota(unidade, alvo.x, alvo.z, PARTIDA.enemySpeed, dt, obras, state.tempo, versao, bloqueios, 'vivo'),
      )
    }
    if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'mover') {
      return avancarRota(
        unidade,
        unidade.ordem.x,
        unidade.ordem.z,
        PARTIDA.allySpeed,
        dt,
        obras,
        state.tempo,
        versao,
        bloqueios,
        'fixo',
      )
    }
    if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacarObra') {
      let alvoObra = obraInimigaViva(unidade.ordem.obraId)
      let ordem: Ordem | null = unidade.ordem
      let rota = unidade.rota
      if (!alvoObra) {
        const obrasHostis = obras.filter((item) => !nossa(item) && item.hp > 0 && cobertoAgora(state, item.x, item.z))
        const proxId = maisPerto(unidade.x, unidade.z, obrasHostis)
        alvoObra = proxId === null ? undefined : obraInimigaViva(proxId)
        if (!alvoObra) return { ...unidade, ordem: null }
        ordem = { tipo: 'atacarObra', obraId: alvoObra.id }
        rota = null
      }
      if (emContatoComObra(unidade.x, unidade.z, alvoObra)) {
        return { ...unidade, ordem, rota }
      }
      const peri = aproximacaoDaObra(alvoObra, unidade.x, unidade.z)
      return avancarRota(
        { ...unidade, ordem, rota },
        peri.x,
        peri.z,
        PARTIDA.allySpeed,
        dt,
        obras,
        state.tempo,
        versao,
        bloqueios,
        'vivo',
      )
    }
    if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacar') {
      let alvo = vivo(unidade.ordem.alvoId)
      let ordem: Ordem | null = unidade.ordem
      let rota = unidade.rota
      if (!alvo) {
        const inimigos = unidades.filter(
          (item) => item.lado === 'inimigo' && item.hp > 0 && item.papel !== 'isca',
        )
        const id = maisPerto(unidade.x, unidade.z, inimigos)
        alvo = id === null ? undefined : vivo(id)
        if (!alvo) {
          const obrasHostis = obras.filter((item) => !nossa(item) && item.hp > 0 && cobertoAgora(state, item.x, item.z))
          const obraId = maisPerto(unidade.x, unidade.z, obrasHostis)
          if (obraId === null) return { ...unidade, ordem: null }
          return { ...unidade, ordem: { tipo: 'atacarObra', obraId }, rota: null }
        }
        ordem = { tipo: 'atacar', alvoId: alvo.id }
        rota = null
      }
      return avancarRota(
        { ...unidade, ordem, rota },
        alvo.x,
        alvo.z,
        PARTIDA.allySpeed,
        dt,
        obras,
        state.tempo,
        versao,
        bloqueios,
        'vivo',
      )
    }
    if (unidade.postura === 'automatico') {
      const inimigos = unidades.filter(
        (item) =>
          item.lado === 'inimigo' &&
          item.hp > 0 &&
          Math.hypot(item.x - unidade.x, item.z - unidade.z) <= PARTIDA.acquireAliado,
      )
      const id = maisPerto(unidade.x, unidade.z, inimigos)
      if (id !== null) {
        const alvo = vivo(id)
        if (alvo) {
          return avancarRota(unidade, alvo.x, alvo.z, PARTIDA.allySpeed, dt, obras, state.tempo, versao, bloqueios, 'vivo')
        }
      }
      const obrasHostis = obras.filter(
        (item) =>
          !nossa(item) &&
          item.hp > 0 &&
          cobertoAgora(state, item.x, item.z) &&
          Math.hypot(item.x - unidade.x, item.z - unidade.z) <= PARTIDA.acquireAliado,
      )
      const obraId = maisPerto(unidade.x, unidade.z, obrasHostis)
      const alvoObra = obraId === null ? undefined : obraInimigaViva(obraId)
      if (!alvoObra || emContatoComObra(unidade.x, unidade.z, alvoObra)) return unidade
      const peri = aproximacaoDaObra(alvoObra, unidade.x, unidade.z)
      return avancarRota(unidade, peri.x, peri.z, PARTIDA.allySpeed, dt, obras, state.tempo, versao, bloqueios, 'vivo')
    }
    return unidade
  })

  const fere = (id: number, dano: number) => {
    unidades = unidades.map((unidade) => (unidade.id === id ? fereDragaoOuCorpo(unidade, dano) : unidade))
  }
  const fereObra = (id: number, dano: number) => {
    obras = obras.map((obra) => (obra.id === id ? aplicarDanoObra(obra, dano) : obra))
  }

  for (const unidade of unidades) {
    if (unidade.hp <= 0 || unidade.cooldown > 0) continue
    if (unidade.lado === 'aliado') {
      if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacarObra') {
        const alvoObra = obraInimigaViva(unidade.ordem.obraId)
        if (alvoObra && emContatoComObra(unidade.x, unidade.z, alvoObra)) {
          fereObra(alvoObra.id, PARTIDA.danoOrdem)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
        }
        continue
      }
      let alvoId: number | null = null
      if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacar') alvoId = unidade.ordem.alvoId
      if (unidade.postura === 'automatico') {
        const inimigos = unidades.filter((item) => item.lado === 'inimigo' && item.hp > 0)
        alvoId = maisPerto(unidade.x, unidade.z, inimigos.filter((item) => Math.hypot(item.x - unidade.x, item.z - unidade.z) <= PARTIDA.melee + 0.2))
      }
      if (alvoId !== null) {
        const alvo = unidades.find((item) => item.id === alvoId && item.hp > 0)
        if (alvo && Math.hypot(alvo.x - unidade.x, alvo.z - unidade.z) <= PARTIDA.melee) {
          const dano = unidade.postura === 'ordens' ? PARTIDA.danoOrdem : PARTIDA.danoAutomatico
          fere(alvo.id, dano)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
          continue
        }
      }
      if (unidade.postura === 'automatico') {
        const obrasEmContato = obras.filter((item) => !nossa(item) && item.hp > 0 && emContatoComObra(unidade.x, unidade.z, item))
        const obraId = maisPerto(unidade.x, unidade.z, obrasEmContato)
        if (obraId !== null) {
          fereObra(obraId, PARTIDA.danoAutomatico)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
        }
      }
    }
    if (unidade.lado === 'inimigo' && unidade.papel !== 'isca') {
      if (unidade.papel === 'horda' && !unidade.alerta) continue
      if ((unidade.papel === 'sitiante' || unidade.papel === 'dragao') && PARTIDA.levaAlvo === 'nucleo') {
        const nucleo = nucleoNosso(obras)
        if (nucleo && emContatoComObra(unidade.x, unidade.z, nucleo)) {
          fereObra(nucleo.id, PARTIDA.danoSitio)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
          continue
        }
        const obraNoCaminho = obras.find((obra) => nossa(obra) && obra.hp > 0 && emContatoComObra(unidade.x, unidade.z, obra))
        if (obraNoCaminho) {
          fereObra(obraNoCaminho.id, PARTIDA.danoSitio)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
          continue
        }
        continue
      }
      const tocadas = obras.filter((item) => nossa(item) && item.hp > 0 && emContatoComObra(unidade.x, unidade.z, item))
      const obraId = maisPerto(unidade.x, unidade.z, tocadas)
      if (obraId === null) continue
      fereObra(obraId, PARTIDA.danoSitio)
      unidades = unidades.map((item) =>
        item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
      )
    }
  }

  const jaAlvo = new Set<number>()
  const idsTorres = obras.filter((obra) => obra.tipo === 'torre').map((obra) => obra.id)
  for (const torreId of idsTorres) {
    const torre = obras.find((item) => item.id === torreId)
    if (!torre || torre.tipo !== 'torre' || torre.hp <= 0 || torre.cooldown > 0 || obraEmConstrucao(torre)) continue
    const alcance = alcanceDaTorre(torre)
    const danoTorre = PARTIDA.torreDano + torre.nivel

    // 1º: Prioridade tática máxima — abater em 1 tiro qualquer construção rival ainda em andaime no alcance!
    let andaimeId: number | null = null
    let melhorAndaime = alcance
    for (const rival of obras) {
      const hostil = torre.lado === 'inimigo' ? nossa(rival) : !nossa(rival)
      if (!hostil || !obraEmConstrucao(rival)) continue
      if (torre.lado !== 'inimigo' && !cobertoAgora(state, rival.x, rival.z)) continue
      const dist = Math.hypot(rival.x - torre.x, rival.z - torre.z)
      if (dist <= alcance && dist <= melhorAndaime) {
        melhorAndaime = dist
        andaimeId = rival.id
      }
    }
    if (andaimeId !== null) {
      fereObra(andaimeId, danoTorre)
      obras = obras.map((item) => (item.id === torre.id ? { ...item, cooldown: PARTIDA.torreCooldown } : item))
      continue
    }

    // 2º: Unidades hostis vivas (e herói presente para torre inimiga)
    let melhor = alcance
    let id: number | null = null
    for (const item of unidades) {
      const hostil = torre.lado === 'inimigo' ? item.lado === 'aliado' : item.lado === 'inimigo'
      if (!hostil || item.hp <= 0 || jaAlvo.has(item.id)) continue
      for (const ponto of pontosDoCorpo(item)) {
        const dist = Math.hypot(ponto.x - torre.x, ponto.z - torre.z)
        if (dist <= alcance && dist <= melhor) {
          melhor = dist
          id = item.id
        }
      }
    }
    if (torre.lado === 'inimigo' && !state.semCorpo && state.heroi.y >= -0.9 && army > 0 && !jaAlvo.has(-1)) {
      const dist = Math.hypot(state.heroi.x - torre.x, state.heroi.z - torre.z)
      if (dist <= alcance && dist <= melhor) id = -1
    }
    if (id !== null) {
      jaAlvo.add(id)
      if (id === -1) army = Math.max(0, army - danoTorre)
      else fere(id, danoTorre)
      obras = obras.map((item) => (item.id === torre.id ? { ...item, cooldown: PARTIDA.torreCooldown } : item))
      continue
    }

    // 3º: Duelo entre construções — se não houver unidade hostil no alcance, alvejar a construção rival viva mais próxima!
    let obraRivalId: number | null = null
    let melhorObra = alcance
    for (const rival of obras) {
      const hostil = torre.lado === 'inimigo' ? nossa(rival) : !nossa(rival)
      if (!hostil || rival.hp <= 0) continue
      if (torre.lado !== 'inimigo' && !cobertoAgora(state, rival.x, rival.z)) continue
      const dist = Math.hypot(rival.x - torre.x, rival.z - torre.z)
      if (dist <= alcance && dist <= melhorObra) {
        melhorObra = dist
        obraRivalId = rival.id
      }
    }
    if (obraRivalId !== null) {
      fereObra(obraRivalId, danoTorre)
      obras = obras.map((item) => (item.id === torre.id ? { ...item, cooldown: PARTIDA.torreCooldown } : item))
    }
  }

  const morreuSolido = state.obras.some((antes) => {
    if (antes.tipo === 'portao' || antes.hp <= 0) return false
    const agora = obras.find((obra) => obra.id === antes.id)
    return agora !== undefined && agora.hp <= 0
  })
  return {
    ...state,
    obras,
    unidades,
    heroi: army === state.heroi.army ? state.heroi : { ...state.heroi, army },
    versaoSolidos: state.versaoSolidos + (morreuSolido ? 1 : 0),
  }
}

function passoOnda(state: PartidaState, dt: number): PartidaState {
  const nosso = nucleoNosso(state.obras)
  const inimigo = nucleoInimigo(state.obras)
  if (!nosso || !inimigo) return state.ondaRelogio === 0 ? state : { ...state, ondaRelogio: 0 }
  const relogio = state.ondaRelogio + dt
  if (relogio < PARTIDA.ondaPeriodo) return { ...state, ondaRelogio: relogio }
  if (vivosInimigos(state).length >= PARTIDA.enemyCap) return { ...state, ondaRelogio: 0 }
  const numero = state.ondaNumero + 1
  const dragao = numero % 3 === 0 && numero !== 1
  if (dragao) return crescerBaseInimiga(nascerDragaoDaLeva({ ...state, ondaRelogio: 0, ondaNumero: numero }), numero)
  const saida = saidaDaBase(inimigo, nosso)
  const quantidade = numero === 1 ? PARTIDA.levaPrimeira : PARTIDA.levaSeguinte
  const bloqueios = bloqueiosDe(state)
  const hp = vidaDaLeva(numero)
  const novos: Unidade[] = []
  let nextId = state.nextId
  let vivos = vivosInimigos(state).length
  for (let i = 0; i < quantidade && vivos < PARTIDA.enemyCap; i++) {
    const brutoX = saida.x + (i - (quantidade - 1) / 2) * 1.2
    const celula = encaixarLivre(Math.round(brutoX / PARTIDA.celula), Math.round(saida.z / PARTIDA.celula), bloqueios)
    if (!celula) continue
    novos.push({
      id: nextId,
      lado: 'inimigo',
      papel: 'sitiante',
      x: celula[0] * PARTIDA.celula,
      z: celula[1] * PARTIDA.celula,
      hp,
      postura: 'automatico',
      ordem: null,
      cooldown: 0,
      segmentos: [],
      alerta: true,
    })
    nextId += 1
    vivos += 1
  }
  return crescerBaseInimiga(
    { ...state, ondaRelogio: 0, ondaNumero: numero, nextId, unidades: [...state.unidades, ...novos] },
    numero,
  )
}

function checaDerrota(antes: PartidaState, state: PartidaState): PartidaState {
  if (state.semCorpo) return state
  if (state.heroi.army <= 0) return { ...state, derrota: true }
  const nucleoAntes = nucleoNosso(antes.obras, false)
  const nucleo = nucleoNosso(state.obras, false)
  const caiuAgora = nucleoAntes !== undefined && nucleoAntes.hp > 0 && nucleo !== undefined && nucleo.hp <= 0
  if (!caiuAgora) return state
  return { ...state, derrota: true }
}

function passoCurto(state: PartidaState, input: PartidaInput, dt: number): PartidaState {
  let atual = passoHeroi(state, input, dt)
  atual = portoesConstruidos(atual)
  atual = altarNoPasso(atual)
  atual = passoUnidades(atual, dt)
  atual = danoHordaNoHeroi(atual)
  atual = passoOnda(atual, dt)

  const serrarias = atual.obras.filter(
    (o) => nossa(o) && o.tipo === 'serraria' && o.hp > 0 && !obraEmConstrucao(o),
  )
  const minas = atual.obras.filter(
    (o) => nossa(o) && o.tipo === 'mina' && o.hp > 0 && !obraEmConstrucao(o),
  )
  const eco = passoRecursosNaturais(atual.recursos, serrarias, minas, atual.relogioExtracao, dt)

  atual = {
    ...atual,
    tempo: atual.tempo + dt,
    recursos: eco.recursos,
    madeira: atual.madeira + eco.ganhoMadeira,
    ouro: atual.ouro + eco.ganhoOuro,
    relogioExtracao: eco.relogioExtracao,
    versaoRecursos: eco.mudouMalha ? atual.versaoRecursos + 1 : atual.versaoRecursos,
    heroi: { ...atual.heroi, shootCooldown: Math.max(0, atual.heroi.shootCooldown - dt) },
  }
  return checaDerrota(state, marcarChao(atual))
}

export function stepPartida(
  state: PartidaState,
  input: PartidaInput,
  dtSec: number,
  timeScale = 1,
): PartidaState {
  if (state.derrota) return state
  const escala = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 0
  const pedido = (Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0) * escala
  let budget = Math.min(PARTIDA.dtBudgetMax, pedido)
  let atual = state
  while (budget > 1e-8) {
    const fatia = Math.min(PARTIDA.dtMax, budget)
    atual = passoCurto(atual, input, fatia)
    if (atual.derrota) return atual
    budget -= fatia
  }
  return atual
}

export function continuarNaRua(state: PartidaState): PartidaState {
  if (state.derrota) return state
  return marcarChao({
    ...state,
    ruaPercorrida: false,
    heroi: { ...state.heroi, x: 0, z: 0, y: 0, vy: 0 },
  })
}

export function recriarPartida(): PartidaState {
  return createPartida()
}

function unidadeEm(papel: Papel, id: number, x: number, z: number, hp: number): Unidade {
  return {
    id,
    lado: papel === 'tropa' ? 'aliado' : 'inimigo',
    papel,
    x,
    z,
    hp,
    postura: 'automatico',
    ordem: null,
    cooldown: 0,
    segmentos: [],
    alerta: true,
  }
}

function cenarioBase(): PartidaState {
      const nucleo: Obra = {
    id: 1,
    lado: 'nosso',
    tipo: 'nucleo',
    x: 0,
    z: 20,
    nivel: 1,
    hp: 160,
    maxHp: 160,
    gateApplied: false,
    cooldown: 0,
  }
  const aliados = [2, 3, 4, 5].map((id, index) => unidadeEm('tropa', id, -1.5 + index, 8, 20))
  const sitiantes = [6, 7, 8, 9].map((id, index) => unidadeEm('sitiante', id, -0.45 + index * 0.3, 18.6, 20))
  const isca = unidadeEm('isca', 10, 7, 8, 400)
  return {
    ...createPartida(),
    obras: [nucleo],
    unidades: [...aliados, ...sitiantes, isca],
    nextId: 11,
    credito: 0,
    ondaRelogio: 0,
  }
}

export function cenarioEspetaculo(): PartidaState {
  return cenarioBase()
}

export function cenarioConduta(): PartidaState {
  const base = cenarioBase()
  return ordenar(
    base,
    base.unidades.filter((unidade) => unidade.lado === 'aliado').map((unidade) => unidade.id),
    { tipo: 'atacar', alvoId: 6 },
  )
}

export const INPUT_PARADO: PartidaInput = VAZIO
