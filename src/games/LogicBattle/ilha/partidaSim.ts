import { Bloqueio, encaixarLivre, encontrarCaminho, Marco } from './caminho'
import { applyGateWithRemainder, clampArmy } from '../domain/armyMath'
import {
  GRAU_PARTIDA,
  OBSTACULOS,
  Olhar,
  Ordem,
  PARTIDA,
  Papel,
  PecaId,
  PLUS_TEN,
  Postura,
} from './partidaPolicies'

export interface Heroi {
  x: number
  z: number
  yaw: number
  pitch: number
  army: number
  shootCooldown: number
  carregandoKg: number
}

export interface Obra {
  id: number
  tipo: PecaId
  x: number
  z: number
  nivel: number
  hp: number
  maxHp: number
  gateApplied: boolean
  cooldown: number
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
}

export type HeroiOrdem =
  | { tipo: 'mover'; x: number; z: number; rota: Rota }
  | { tipo: 'atacar'; alvoId: number; rota: Rota | null }

const VAZIO: PartidaInput = { forward: false, back: false, strafe: 0 }

function heroiInicial(): Heroi {
  return {
    x: 0,
    z: 0,
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

export function createPartida(): PartidaState {
  const unidades = hordaInicial(1)
  return {
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
  }
}

function clampPitch(pitch: number): number {
  return Math.min(PARTIDA.pitchMax, Math.max(PARTIDA.pitchMin, pitch))
}

export function definirOlhar(state: PartidaState, olhar: Olhar): PartidaState {
  if (state.olhar === olhar) return state
  return { ...state, olhar }
}

export function mira(state: PartidaState, dYaw: number, dPitch: number): PartidaState {
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

function puxaDisco(x: number, z: number): { x: number; z: number } {
  const dist = Math.hypot(x, z)
  const limite = PARTIDA.radius - PARTIDA.body
  if (dist <= limite || dist === 0) return { x, z }
  const escala = limite / dist
  return { x: x * escala, z: z * escala }
}

function bateObstaculo(x: number, z: number): boolean {
  return OBSTACULOS.some(
    (caixa) =>
      Math.abs(x - caixa.x) < caixa.hx + PARTIDA.body &&
      Math.abs(z - caixa.z) < caixa.hz + PARTIDA.body,
  )
}

function bateObra(x: number, z: number, obras: readonly Obra[], ignorarId = -1): boolean {
  return obras.some(
    (obra) =>
      obra.tipo !== 'portao' &&
      obra.id !== ignorarId &&
      obra.hp > 0 &&
      Math.abs(x - obra.x) < PARTIDA.obraMeio + PARTIDA.body &&
      Math.abs(z - obra.z) < PARTIDA.obraMeio + PARTIDA.body,
  )
}

function escorrega(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  obras: readonly Obra[],
): { x: number; z: number } {
  let x = x1
  let z = z1
  const bloqueia = (px: number, pz: number) => bateObstaculo(px, pz) || bateObra(px, pz, obras)
  if (bloqueia(x, z)) {
    if (!bloqueia(x0, z)) x = x0
    else if (!bloqueia(x, z0)) z = z0
    else {
      x = x0
      z = z0
    }
  }
  return puxaDisco(x, z)
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
  return state.obras.find((obra) => obra.tipo === 'nucleo' && obra.hp > 0)
}

export function fundar(state: PartidaState, tipo: PecaId, x: number, z: number): PartidaState {
  if (state.derrota || !Number.isFinite(x) || !Number.isFinite(z)) return state
  if (!dentroDoDisco(x, z)) return state
  if (tipo === 'nucleo' && state.obras.some((obra) => obra.tipo === 'nucleo')) return state
  if (tipo !== 'nucleo' && !nucleoDe(state)) return state
  if (Math.hypot(x - state.heroi.x, z - state.heroi.z) < 1.6) return state
  if (bateObstaculo(x, z) || bateObra(x, z, state.obras)) return state
  if (state.unidades.some((unidade) => unidade.hp > 0 && Math.hypot(unidade.x - x, unidade.z - z) < 1.4)) {
    return state
  }
  const hp = tipo === 'nucleo' ? PARTIDA.nucleoHp : 40 + 10
  const obra: Obra = {
    id: state.nextId,
    tipo,
    x,
    z,
    nivel: 1,
    hp,
    maxHp: hp,
    gateApplied: false,
    cooldown: 0,
  }
  return {
    ...state,
    obras: [...state.obras, obra],
    nextId: state.nextId + 1,
    versaoSolidos: tipo === 'portao' ? state.versaoSolidos : state.versaoSolidos + 1,
  }
}

export function evoluir(state: PartidaState, obraId: number): PartidaState {
  if (state.derrota || state.credito < 1) return state
  const obra = state.obras.find((item) => item.id === obraId && item.hp > 0)
  if (!obra || obra.nivel >= 3) return state
  return {
    ...state,
    credito: state.credito - 1,
    obras: state.obras.map((item) =>
      item.id === obraId ? { ...item, nivel: item.nivel + 1, hp: item.maxHp, maxHp: item.maxHp } : item,
    ),
  }
}

export function criarTropa(state: PartidaState, obraId: number): PartidaState {
  if (state.derrota || state.credito < 1) return state
  if (aliadosVivos(state).length >= PARTIDA.allyCap) return state
  const obra = state.obras.find(
    (item) => item.id === obraId && item.hp > 0 && (item.tipo === 'nucleo' || item.tipo === 'quartel'),
  )
  if (!obra) return state
  const unidade: Unidade = {
    id: state.nextId,
    lado: 'aliado',
    papel: 'tropa',
    x: obra.x + 1.8,
    z: obra.z,
    hp: 16,
    postura: 'ordens',
    ordem: null,
    cooldown: 0,
    segmentos: [],
    alerta: true,
  }
  if (bateObra(unidade.x, unidade.z, state.obras) || !dentroDoDisco(unidade.x, unidade.z)) {
    unidade.x = obra.x
    unidade.z = obra.z + 1.8
  }
  return {
    ...state,
    credito: state.credito - 1,
    nextId: state.nextId + 1,
    unidades: [...state.unidades, unidade],
  }
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
    const marcos = encontrarCaminho(unidade.x, unidade.z, ordem.x, ordem.z, bloqueios)
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
  const dragao: Unidade = {
    id: state.nextId,
    lado: 'inimigo',
    papel: 'dragao',
    x: 0,
    z: 50,
    hp: 30,
    postura: 'automatico',
    ordem: null,
    cooldown: 0,
    segmentos: [48, 36, 24, 12, 6],
    alerta: true,
  }
  return { ...state, nextId: state.nextId + 1, unidades: [...state.unidades, dragao] }
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

export function atirar(state: PartidaState): PartidaState {
  if (state.derrota || state.heroi.shootCooldown > 0) return state
  const gasto: PartidaState = {
    ...state,
    heroi: { ...state.heroi, shootCooldown: PARTIDA.shootCooldown },
  }
  if (Math.abs(state.heroi.pitch) >= PARTIDA.pitchTetoTiro) return gasto
  const fx = -Math.sin(state.heroi.yaw)
  const fz = Math.cos(state.heroi.yaw)
  let alvo: Unidade | null = null
  let melhor: number = PARTIDA.shootRange
  for (const unidade of state.unidades) {
    if (unidade.lado !== 'inimigo' || unidade.hp <= 0) continue
    const dx = unidade.x - state.heroi.x
    const dz = unidade.z - state.heroi.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.05 || dist > melhor) continue
    const dot = (dx * fx + dz * fz) / dist
    if (dot < PARTIDA.shootDot) continue
    alvo = unidade
    melhor = dist
  }
  if (!alvo) return gasto
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

function moverUnidade(unidade: Unidade, tx: number, tz: number, velocidade: number, dt: number, obras: readonly Obra[]): Unidade {
  const dx = tx - unidade.x
  const dz = tz - unidade.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.08) return unidade
  const passo = Math.min(velocidade * dt, dist)
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
    lista.push({ x: obra.x, z: obra.z, hx: PARTIDA.obraMeio, hz: PARTIDA.obraMeio })
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
): Unidade {
  const rota = unidade.rota
  const venceu =
    !rota ||
    rota.modo !== modo ||
    rota.versao !== versao ||
    (modo === 'vivo' && tempo >= rota.renovarEm)
  if (!venceu) return unidade
  const marcos = encontrarCaminho(unidade.x, unidade.z, tx, tz, bloqueios)
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
): Unidade {
  const atual = prepararRota(unidade, tx, tz, tempo, versao, bloqueios, modo)
  if (atual.rota?.semCaminho) return atual
  let marcos = atual.rota?.marcos ?? [{ x: tx, z: tz }]
  while (marcos.length > 0 && Math.hypot(atual.x - marcos[0].x, atual.z - marcos[0].z) < 0.5) {
    marcos = marcos.slice(1)
  }
  const meta = marcos[0] ?? { x: tx, z: tz }
  const moved = moverUnidade(atual, meta.x, meta.z, velocidade, dt, obras)
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
  if (state.derrota) return state
  if (ordem.tipo === 'mover') {
    const marcos = encontrarCaminho(state.heroi.x, state.heroi.z, ordem.x, ordem.z, bloqueiosDe(state))
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
  if (state.olhar === 'imperio') return seguirOrdemHeroi(state, dt)
  if (state.heroiOrdem && (input.forward || input.back || input.strafe !== 0)) {
    state = { ...state, heroiOrdem: null }
  }
  const yaw = state.heroi.yaw
  const drive = (input.forward ? 1 : 0) - (input.back ? 1 : 0)
  const fx = -Math.sin(yaw)
  const fz = Math.cos(yaw)
  const rx = -Math.cos(yaw)
  const rz = -Math.sin(yaw)
  let mx = fx * drive + rx * input.strafe
  let mz = fz * drive + rz * input.strafe
  const mag = Math.hypot(mx, mz)
  if (mag > 1) {
    mx /= mag
    mz /= mag
  }
  const dist = PARTIDA.heroSpeed * dt
  const x1 = state.heroi.x + mx * dist
  const z1 = state.heroi.z + mz * dist
  const pos = escorrega(state.heroi.x, state.heroi.z, x1, z1, state.obras)
  let gateArchApplied = state.gateArchApplied
  let army = state.heroi.army
  if (
    !gateArchApplied &&
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
  const pertoDaPedra = Math.hypot(pos.x - PARTIDA.pedraX, pos.z - PARTIDA.pedraZ) < 1.3
  if (carregandoKg === 0 && pedraNoChao && pertoDaPedra) {
    carregandoKg = PARTIDA.pedraKg
    pedraNoChao = false
  }
  let lingotes = state.lingotes
  let resto = state.resto
  const britador = state.obras.find((obra) => obra.tipo === 'britador' && obra.hp > 0)
  if (
    britador &&
    carregandoKg > 0 &&
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
  return {
    ...state,
    gateArchApplied,
    ruaPercorrida,
    lingotes,
    resto,
    pedraNoChao,
    heroi: { ...state.heroi, x: pos.x, z: pos.z, army, carregandoKg },
  }
}

function portoesConstruidos(state: PartidaState): PartidaState {
  let army = state.heroi.army
  let mudou = false
  const obras = state.obras.map((obra) => {
    if (obra.tipo !== 'portao' || obra.gateApplied || obra.hp <= 0) return obra
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

function passoUnidades(state: PartidaState, dt: number): PartidaState {
  const obrasVivas = state.obras.filter((obra) => obra.hp > 0)
  const alvosObra = obrasVivas.map((obra) => ({ id: obra.id, x: obra.x, z: obra.z }))
  const bloqueios = bloqueiosDe(state)
  const versao = state.versaoSolidos
  let obras = state.obras.map((obra) => ({ ...obra, cooldown: Math.max(0, obra.cooldown - dt) }))
  let unidades = state.unidades.map((unidade) => ({ ...unidade, cooldown: Math.max(0, unidade.cooldown - dt) }))

  const vivo = (id: number) => unidades.find((unidade) => unidade.id === id && unidade.hp > 0)

  unidades = unidades.map((unidade) => {
    if (unidade.hp <= 0) return unidade
    if (unidade.papel === 'horda') {
      const alerta =
        unidade.alerta ||
        state.heroi.z >= PARTIDA.aggroZ ||
        Math.hypot(unidade.x - state.heroi.x, unidade.z - state.heroi.z) < PARTIDA.acquireHorda
      if (!alerta) return unidade
      return {
        ...avancarRota(
          unidade,
          state.heroi.x,
          state.heroi.z,
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
    if (unidade.papel === 'sitiante' && PARTIDA.levaAlvo === 'nucleo') {
      const nucleo = obras.find((obra) => obra.tipo === 'nucleo' && obra.hp > 0)
      if (nucleo && Math.hypot(unidade.x - nucleo.x, unidade.z - nucleo.z) <= PARTIDA.nucleoContato) {
        return unidade
      }
      if (nucleo) {
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
        if (!ido.rota?.semCaminho) return ido
        const solidos = obras.filter((obra) => obra.hp > 0 && obra.tipo !== 'portao')
        const id = maisPerto(unidade.x, unidade.z, solidos)
        const alvo = solidos.find((obra) => obra.id === id)
        if (!alvo) return ido
        return moverUnidade(ido, alvo.x, alvo.z, PARTIDA.enemySpeed, dt, obras)
      }
    }
    if (unidade.lado === 'inimigo') {
      if (unidade.papel === 'isca') return unidade
      const colada = alvosObra.some(
        (obra) => Math.hypot(obra.x - unidade.x, obra.z - unidade.z) <= PARTIDA.nucleoContato,
      )
      if (colada) return unidade
      const aliados = unidades.filter((item) => item.lado === 'aliado' && item.hp > 0)
      const heroiAlvo = state.heroi.army > 0 ? [{ id: -1, x: state.heroi.x, z: state.heroi.z }] : []
      const candidatos = [...alvosObra, ...aliados, ...heroiAlvo]
      const id = maisPerto(unidade.x, unidade.z, candidatos)
      if (id === null) return unidade
      const alvo = id === -1 ? { x: state.heroi.x, z: state.heroi.z } : candidatos.find((item) => item.id === id)
      if (!alvo) return unidade
      return avancarRota(unidade, alvo.x, alvo.z, PARTIDA.enemySpeed, dt, obras, state.tempo, versao, bloqueios, 'vivo')
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
    if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacar') {
      let alvo = vivo(unidade.ordem.alvoId)
      let ordem = unidade.ordem
      let rota = unidade.rota
      if (!alvo) {
        const inimigos = unidades.filter(
          (item) => item.lado === 'inimigo' && item.hp > 0 && item.papel !== 'isca',
        )
        const id = maisPerto(unidade.x, unidade.z, inimigos)
        alvo = id === null ? undefined : vivo(id)
        if (!alvo) return { ...unidade, ordem: null }
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
      if (id === null) return unidade
      const alvo = vivo(id)
      if (!alvo) return unidade
      return avancarRota(unidade, alvo.x, alvo.z, PARTIDA.allySpeed, dt, obras, state.tempo, versao, bloqueios, 'vivo')
    }
    return unidade
  })

  const fere = (id: number, dano: number) => {
    unidades = unidades.map((unidade) => (unidade.id === id ? fereDragaoOuCorpo(unidade, dano) : unidade))
  }

  for (const unidade of unidades) {
    if (unidade.hp <= 0 || unidade.cooldown > 0) continue
    if (unidade.lado === 'aliado') {
      let alvoId: number | null = null
      if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacar') alvoId = unidade.ordem.alvoId
      if (unidade.postura === 'automatico') {
        const inimigos = unidades.filter((item) => item.lado === 'inimigo' && item.hp > 0)
        alvoId = maisPerto(unidade.x, unidade.z, inimigos.filter((item) => Math.hypot(item.x - unidade.x, item.z - unidade.z) <= PARTIDA.melee + 0.2))
      }
      if (alvoId === null) continue
      const alvo = unidades.find((item) => item.id === alvoId && item.hp > 0)
      if (!alvo || Math.hypot(alvo.x - unidade.x, alvo.z - unidade.z) > PARTIDA.melee) continue
      const dano = unidade.postura === 'ordens' ? PARTIDA.danoOrdem : PARTIDA.danoAutomatico
      fere(alvo.id, dano)
      unidades = unidades.map((item) =>
        item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
      )
    }
    if (unidade.lado === 'inimigo' && unidade.papel !== 'horda' && unidade.papel !== 'isca') {
      if (unidade.papel === 'sitiante' && PARTIDA.levaAlvo === 'nucleo') {
        const nucleo = obras.find((obra) => obra.tipo === 'nucleo' && obra.hp > 0)
        const noNucleo =
          nucleo !== undefined &&
          Math.hypot(unidade.x - nucleo.x, unidade.z - nucleo.z) <= PARTIDA.nucleoContato
        if (noNucleo && nucleo) {
          obras = obras.map((item) =>
            item.id === nucleo.id ? { ...item, hp: Math.max(0, item.hp - PARTIDA.danoSitio) } : item,
          )
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
        } else if (unidade.rota?.semCaminho) {
          const solidos = obras.filter((obra) => obra.hp > 0 && obra.tipo !== 'portao')
          const id = maisPerto(unidade.x, unidade.z, solidos)
          const alvo = solidos.find((obra) => obra.id === id)
          if (alvo && Math.hypot(unidade.x - alvo.x, unidade.z - alvo.z) <= PARTIDA.nucleoContato) {
            obras = obras.map((item) =>
              item.id === alvo.id ? { ...item, hp: Math.max(0, item.hp - PARTIDA.danoSitio) } : item,
            )
            unidades = unidades.map((item) =>
              item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
            )
          }
        }
        continue
      }
      const obra = obras.find(
        (item) => item.hp > 0 && Math.hypot(item.x - unidade.x, item.z - unidade.z) <= PARTIDA.nucleoContato,
      )
      if (!obra) continue
      obras = obras.map((item) => (item.id === obra.id ? { ...item, hp: Math.max(0, item.hp - PARTIDA.danoSitio) } : item))
      unidades = unidades.map((item) =>
        item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
      )
    }
  }

  const jaAlvo = new Set<number>()
  for (const torre of obras) {
    if (torre.tipo !== 'torre' || torre.hp <= 0 || torre.cooldown > 0) continue
    const alcance = PARTIDA.torreAlcance + (torre.nivel - 1) * 2
    const inimigos = unidades.filter(
      (item) =>
        item.lado === 'inimigo' &&
        item.hp > 0 &&
        !jaAlvo.has(item.id) &&
        Math.hypot(item.x - torre.x, item.z - torre.z) <= alcance,
    )
    const id = maisPerto(torre.x, torre.z, inimigos)
    if (id === null) continue
    jaAlvo.add(id)
    fere(id, PARTIDA.torreDano + torre.nivel)
    obras = obras.map((item) => (item.id === torre.id ? { ...item, cooldown: PARTIDA.torreCooldown } : item))
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
    versaoSolidos: state.versaoSolidos + (morreuSolido ? 1 : 0),
  }
}

function passoOnda(state: PartidaState, dt: number): PartidaState {
  const temNucleo = state.obras.some((obra) => obra.tipo === 'nucleo' && obra.hp > 0)
  if (!temNucleo) return state.ondaRelogio === 0 ? state : { ...state, ondaRelogio: 0 }
  const relogio = state.ondaRelogio + dt
  if (relogio < PARTIDA.ondaPeriodo) return { ...state, ondaRelogio: relogio }
  if (vivosInimigos(state).length >= PARTIDA.enemyCap) return { ...state, ondaRelogio: 0 }
  const numero = state.ondaNumero + 1
  const dragao = numero % 3 === 0 && numero !== 1
  if (dragao) {
    const comDragao = invocarDragao({ ...state, ondaRelogio: 0, ondaNumero: numero })
    return comDragao
  }
  if (PARTIDA.levaAlvo !== 'nucleo') {
    const sitiante: Unidade = {
      id: state.nextId,
      lado: 'inimigo',
      papel: 'sitiante',
      x: 18,
      z: 18,
      hp: 14,
      postura: 'automatico',
      ordem: null,
      cooldown: 0,
      segmentos: [],
      alerta: true,
    }
    return {
      ...state,
      ondaRelogio: 0,
      ondaNumero: numero,
      nextId: state.nextId + 1,
      unidades: [...state.unidades, sitiante],
    }
  }
  const nucleo = state.obras.find((obra) => obra.tipo === 'nucleo' && obra.hp > 0)
  if (!nucleo) return { ...state, ondaRelogio: 0, ondaNumero: numero }
  const quantidade = numero === 1 ? PARTIDA.levaPrimeira : PARTIDA.levaSeguinte
  const bloqueios = bloqueiosDe(state)
  const novos: Unidade[] = []
  let nextId = state.nextId
  let vivos = vivosInimigos(state).length
  for (let i = 0; i < quantidade && vivos < PARTIDA.enemyCap; i++) {
    const brutoX = nucleo.x + (i - (quantidade - 1) / 2) * 1.6
    const brutoZ = nucleo.z + PARTIDA.levaDistancia
    const celula = encaixarLivre(
      Math.round(brutoX / PARTIDA.celula),
      Math.round(brutoZ / PARTIDA.celula),
      bloqueios,
    )
    if (!celula) continue
    novos.push({
      id: nextId,
      lado: 'inimigo',
      papel: 'sitiante',
      x: celula[0] * PARTIDA.celula,
      z: celula[1] * PARTIDA.celula,
      hp: 14,
      postura: 'automatico',
      ordem: null,
      cooldown: 0,
      segmentos: [],
      alerta: true,
    })
    nextId += 1
    vivos += 1
  }
  return {
    ...state,
    ondaRelogio: 0,
    ondaNumero: numero,
    nextId,
    unidades: [...state.unidades, ...novos],
  }
}

function checaDerrota(state: PartidaState): PartidaState {
  const nucleo = state.obras.find((obra) => obra.tipo === 'nucleo')
  const caiu = state.heroi.army <= 0 || (nucleo !== undefined && nucleo.hp <= 0)
  if (!caiu) return state
  return { ...state, derrota: true }
}

function passoCurto(state: PartidaState, input: PartidaInput, dt: number): PartidaState {
  let atual = passoHeroi(state, input, dt)
  atual = portoesConstruidos(atual)
  atual = altarNoPasso(atual)
  atual = passoUnidades(atual, dt)
  atual = danoHordaNoHeroi(atual)
  atual = passoOnda(atual, dt)
  atual = {
    ...atual,
    tempo: atual.tempo + dt,
    heroi: { ...atual.heroi, shootCooldown: Math.max(0, atual.heroi.shootCooldown - dt) },
  }
  return checaDerrota(atual)
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
  return {
    ...state,
    ruaPercorrida: false,
    heroi: { ...state.heroi, x: 0, z: 0 },
  }
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
