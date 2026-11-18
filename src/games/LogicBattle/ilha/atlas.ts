import { PARTIDA, PoliticaMinimapas } from './partidaPolicies'
import { createPartida, PartidaInput, PartidaState, stepPartida } from './partidaSim'

export const MEIO_MAPA = PARTIDA.radius
export const LADO_MAPA = PARTIDA.ladoMapa
export const COTA_MAX_TODOS = 25

export interface Indice {
  i: number
  j: number
}

export type Alerta = 'nenhum' | 'verde' | 'vermelho'
export type Ritmo = 'cheio' | 'lento'

export interface Ficha {
  i: number
  j: number
  state: PartidaState
  ritmo: Ritmo
  alerta: Alerta
  relogio: number
  hpNosso: number
  hpInimigo: number
  corpo: boolean
  visitado?: boolean
}

export interface Atlas {
  heroiI: number
  heroiJ: number
  cenaI: number
  cenaJ: number
  fichas: Ficha[]
  politica: PoliticaMinimapas
  cotaDinamica: number
  emaFrameMs: number
}

const PARADO: PartidaInput = { forward: false, back: false, strafe: 0 }

export function transferir(x: number, z: number, i: number, j: number): { x: number; z: number; i: number; j: number } {
  let nx = x
  let nz = z
  let ni = i
  let nj = j
  let guarda = 0
  while ((nx >= MEIO_MAPA || nx < -MEIO_MAPA || nz >= MEIO_MAPA || nz < -MEIO_MAPA) && guarda < 8) {
    if (nx >= MEIO_MAPA) {
      nx -= LADO_MAPA
      ni += 1
    } else if (nx < -MEIO_MAPA) {
      nx += LADO_MAPA
      ni -= 1
    }
    if (nz >= MEIO_MAPA) {
      nz -= LADO_MAPA
      nj += 1
    } else if (nz < -MEIO_MAPA) {
      nz += LADO_MAPA
      nj -= 1
    }
    guarda += 1
  }
  return { x: nx, z: nz, i: ni, j: nj }
}

export function vizinhosPorVisao(x: number, z: number, i: number, j: number): Indice[] {
  const margem = PARTIDA.visao.heroi
  const lista: Indice[] = []
  if (MEIO_MAPA - x <= margem) lista.push({ i: i + 1, j })
  if (x + MEIO_MAPA <= margem) lista.push({ i: i - 1, j })
  if (MEIO_MAPA - z <= margem) lista.push({ i, j: j + 1 })
  if (z + MEIO_MAPA <= margem) lista.push({ i, j: j - 1 })
  return lista
}

function medirNosso(state: PartidaState): number {
  const obras = state.obras.filter((obra) => obra.lado !== 'inimigo').reduce((total, obra) => total + Math.max(0, obra.hp), 0)
  const tropas = state.unidades
    .filter((unidade) => unidade.lado === 'aliado')
    .reduce((total, unidade) => total + Math.max(0, unidade.hp), 0)
  return obras + tropas
}

function medirInimigo(state: PartidaState): number {
  const obras = state.obras
    .filter((obra) => obra.lado === 'inimigo')
    .reduce((total, obra) => total + Math.max(0, obra.hp), 0)
  const tropas = state.unidades
    .filter((unidade) => unidade.lado === 'inimigo')
    .reduce((total, unidade) => total + Math.max(0, unidade.hp), 0)
  return obras + tropas
}

export function atualizarAlerta(
  alerta: Alerta,
  nossoAntes: number,
  inimigoAntes: number,
  nosso: number,
  inimigo: number,
): Alerta {
  if (nosso < nossoAntes) return 'vermelho'
  if (inimigo < inimigoAntes && alerta !== 'vermelho') return 'verde'
  return alerta
}

function devePreservar(ficha: Ficha): boolean {
  if (ficha.corpo) return true
  if (ficha.state.obras.some((obra) => obra.lado !== 'inimigo')) return true
  if (ficha.state.obras.some((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo' && obra.hp <= 0)) return true
  return ficha.state.unidades.some((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
}

function nascer(i: number, j: number): Ficha {
  const state = createPartida(i, j, true)
  return {
    i,
    j,
    state,
    ritmo: 'cheio',
    alerta: 'nenhum',
    relogio: 0,
    hpNosso: medirNosso(state),
    hpInimigo: medirInimigo(state),
    corpo: false,
  }
}

function distancia(ficha: Ficha, i: number, j: number): number {
  return Math.hypot(ficha.i - i, ficha.j - j)
}

function agoraMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function limiteCheios(politica: PoliticaMinimapas, cotaDinamica: number): number {
  if (politica === 'atual') return 1
  if (politica === 'todos') return Math.max(2, Math.min(COTA_MAX_TODOS, cotaDinamica))
  return PARTIDA.mapasResidentes
}

function encolher(
  fichas: Ficha[],
  heroiI: number,
  heroiJ: number,
  cenaI: number,
  cenaJ: number,
  politica: PoliticaMinimapas = 'alguns',
  cotaDinamica = COTA_MAX_TODOS,
): Ficha[] {
  const limite = limiteCheios(politica, cotaDinamica)
  let lista = fichas.map((ficha) => {
    if (ficha.i === cenaI && ficha.j === cenaJ && ficha.ritmo !== 'cheio') {
      return { ...ficha, ritmo: 'cheio' as const }
    }
    if (politica !== 'atual' && ficha.i === heroiI && ficha.j === heroiJ && ficha.ritmo !== 'cheio') {
      return { ...ficha, ritmo: 'cheio' as const }
    }
    return ficha
  })

  const cheios = () => lista.filter((ficha) => ficha.ritmo === 'cheio')

  if (politica === 'todos' && cheios().length < limite) {
    const lentos = lista
      .filter((ficha) => ficha.ritmo === 'lento')
      .sort((a, b) => distancia(a, cenaI, cenaJ) - distancia(b, cenaI, cenaJ))
    const promover = new Set(lentos.slice(0, limite - cheios().length).map((f) => `${f.i},${f.j}`))
    if (promover.size > 0) {
      lista = lista.map((ficha) => (promover.has(`${ficha.i},${ficha.j}`) ? { ...ficha, ritmo: 'cheio' } : ficha))
    }
  }

  while (cheios().length > limite) {
    const candidatos = cheios().filter((ficha) => {
      if (ficha.i === cenaI && ficha.j === cenaJ) return false
      if (politica !== 'atual' && ficha.i === heroiI && ficha.j === heroiJ) return false
      return true
    })
    if (candidatos.length === 0) break
    candidatos.sort(
      (a, b) => distancia(b, heroiI, heroiJ) - distancia(a, heroiI, heroiJ) || distancia(b, cenaI, cenaJ) - distancia(a, cenaI, cenaJ),
    )
    const vitima = candidatos[0]
    const manterLento =
      devePreservar(vitima) ||
      Boolean(vitima.visitado) ||
      politica === 'todos' ||
      (politica === 'atual' && distancia(vitima, heroiI, heroiJ) <= 1.05)
    if (manterLento) {
      lista = lista.map((ficha) => (ficha.i === vitima.i && ficha.j === vitima.j ? { ...ficha, ritmo: 'lento' } : ficha))
    } else {
      lista = lista.filter((ficha) => !(ficha.i === vitima.i && ficha.j === vitima.j))
    }
  }
  return lista
}

function achar(fichas: readonly Ficha[], i: number, j: number): Ficha | undefined {
  return fichas.find((ficha) => ficha.i === i && ficha.j === j)
}

function garantir(fichas: Ficha[], i: number, j: number): Ficha[] {
  const achou = achar(fichas, i, j)
  if (!achou) return [...fichas, nascer(i, j)]
  if (achou.ritmo === 'lento') {
    return fichas.map((ficha) => (ficha.i === i && ficha.j === j ? { ...ficha, ritmo: 'cheio' } : ficha))
  }
  return fichas
}

function passoComAlerta(ficha: Ficha, input: PartidaInput, dt: number, contar: boolean): Ficha {
  const nossoAntes = medirNosso(ficha.state)
  const inimigoAntes = medirInimigo(ficha.state)
  const state = stepPartida(ficha.state, input, dt)
  const nosso = medirNosso(state)
  const inimigo = medirInimigo(state)
  return {
    ...ficha,
    state,
    hpNosso: nosso,
    hpInimigo: inimigo,
    alerta: contar ? atualizarAlerta(ficha.alerta, nossoAntes, inimigoAntes, nosso, inimigo) : 'nenhum',
  }
}

export function criarAtlas(): Atlas {
  const state = createPartida()
  return {
    heroiI: 0,
    heroiJ: 0,
    cenaI: 0,
    cenaJ: 0,
    politica: 'alguns',
    cotaDinamica: COTA_MAX_TODOS,
    emaFrameMs: 16.6,
    fichas: [
      {
        i: 0,
        j: 0,
        state,
        ritmo: 'cheio',
        alerta: 'nenhum',
        relogio: 0,
        hpNosso: medirNosso(state),
        hpInimigo: medirInimigo(state),
        corpo: true,
      },
    ],
  }
}

export function definirPoliticaMinimapas(atlas: Atlas, politica: PoliticaMinimapas): Atlas {
  const cotaDinamica = politica === 'todos' ? COTA_MAX_TODOS : atlas.cotaDinamica
  const emaFrameMs = politica === 'todos' ? Math.min(atlas.emaFrameMs, 18) : atlas.emaFrameMs
  const fichas = encolher(atlas.fichas, atlas.heroiI, atlas.heroiJ, atlas.cenaI, atlas.cenaJ, politica, cotaDinamica)
  return { ...atlas, politica, cotaDinamica, emaFrameMs, fichas }
}

export function fichaEm(atlas: Atlas, i: number, j: number): Ficha | undefined {
  return achar(atlas.fichas, i, j)
}

export function estadoCena(atlas: Atlas): PartidaState {
  return achar(atlas.fichas, atlas.cenaI, atlas.cenaJ)?.state ?? achar(atlas.fichas, atlas.heroiI, atlas.heroiJ)!.state
}

export function estadoCorpo(atlas: Atlas): PartidaState {
  return achar(atlas.fichas, atlas.heroiI, atlas.heroiJ)!.state
}

export function escreverCena(atlas: Atlas, state: PartidaState): Atlas {
  const ficha = achar(atlas.fichas, atlas.cenaI, atlas.cenaJ)!
  return escreverFicha(atlas, ficha.i, ficha.j, state, ficha.ritmo)
}

export function abrirMapa(atlas: Atlas, i: number, j: number): Atlas {
  let fichas = garantir(atlas.fichas, i, j)
  if (i !== atlas.heroiI || j !== atlas.heroiJ) {
    fichas = fichas.map((ficha) => ficha.corpo ? { ...ficha, state: { ...ficha.state, heroiOrdem: null } } : ficha)
  }
  fichas = fichas.map((ficha) =>
    ficha.i === i && ficha.j === j ? { ...ficha, alerta: 'nenhum', ritmo: 'cheio', visitado: true } : ficha,
  )
  fichas = encolher(fichas, atlas.heroiI, atlas.heroiJ, i, j, atlas.politica, atlas.cotaDinamica)
  return { ...atlas, cenaI: i, cenaJ: j, fichas }
}

export function olharMapa(atlas: Atlas, i: number, j: number): Atlas {
  if (!achar(atlas.fichas, i, j)) return atlas
  return abrirMapa(atlas, i, j)
}

export function voltarAoCorpo(atlas: Atlas): Atlas {
  return olharMapa(atlas, atlas.heroiI, atlas.heroiJ)
}

export function colocarHeroi(atlas: Atlas, x: number, z: number): Atlas {
  const fichas = atlas.fichas.map((ficha) =>
    ficha.i === atlas.heroiI && ficha.j === atlas.heroiJ
      ? { ...ficha, state: { ...ficha.state, heroi: { ...ficha.state.heroi, x, z } } }
      : ficha,
  )
  return stepAtlas({ ...atlas, fichas }, PARADO, 0)
}

export function escreverFicha(atlas: Atlas, i: number, j: number, state: PartidaState, ritmo: Ritmo): Atlas {
  const base = achar(atlas.fichas, i, j) ?? nascer(i, j)
  const nosso = medirNosso(state)
  const inimigo = medirInimigo(state)
  const ficha: Ficha = {
    ...base,
    state,
    ritmo,
    hpNosso: nosso,
    hpInimigo: inimigo,
    alerta: i === atlas.cenaI && j === atlas.cenaJ
      ? 'nenhum'
      : atualizarAlerta(base.alerta, medirNosso(base.state), medirInimigo(base.state), nosso, inimigo),
  }
  const fichas = achar(atlas.fichas, i, j)
    ? atlas.fichas.map((item) => (item.i === i && item.j === j ? ficha : item))
    : [...atlas.fichas, ficha]
  return {
    ...atlas,
    fichas: encolher(fichas, atlas.heroiI, atlas.heroiJ, atlas.cenaI, atlas.cenaJ, atlas.politica, atlas.cotaDinamica),
  }
}

export function stepAtlas(atlas: Atlas, input: PartidaInput, dt: number, timeScale = 1, frameMs?: number): Atlas {
  const t0 = agoraMs()
  const escala = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 0
  const pedido = (Number.isFinite(dt) && dt > 0 ? dt : 0) * escala
  let fichas = atlas.fichas.map((ficha) => ({ ...ficha }))
  let heroiI = atlas.heroiI
  let heroiJ = atlas.heroiJ
  let cenaI = atlas.cenaI
  let cenaJ = atlas.cenaJ

  const indiceHeroi = () => fichas.findIndex((ficha) => ficha.i === heroiI && ficha.j === heroiJ)
  let heroi = fichas[indiceHeroi()]
  if (!heroi) return atlas
  if (heroi.state.derrota) return atlas
  const heroiEraCena = cenaI === heroiI && cenaJ === heroiJ
  if (!heroiEraCena && atlas.politica === 'atual' && heroi.ritmo === 'lento') {
    const relogioHeroi = heroi.relogio + pedido
    heroi =
      relogioHeroi < 1
        ? { ...heroi, relogio: relogioHeroi }
        : { ...passoComAlerta(heroi, PARADO, 1, true), relogio: relogioHeroi - 1 }
  } else {
    heroi = passoComAlerta(heroi, heroiEraCena ? input : PARADO, pedido, !heroiEraCena)
  }
  let guard = 0
  let movido = transferir(heroi.state.heroi.x, heroi.state.heroi.z, heroi.i, heroi.j)
  while ((movido.i !== heroi.i || movido.j !== heroi.j) && guard < 4) {
    fichas = garantir(fichas, movido.i, movido.j)
    const destino = fichas.findIndex((ficha) => ficha.i === movido.i && ficha.j === movido.j)
    const antigo = fichas.findIndex((ficha) => ficha.i === heroi.i && ficha.j === heroi.j)
    fichas[antigo] = {
      ...heroi,
      corpo: false,
      state: { ...heroi.state, semCorpo: true, heroiOrdem: null, madeira: 0, ouro: 0 },
    }
    const recebido = fichas[destino]
    fichas[destino] = {
      ...recebido,
      corpo: true,
      ritmo: 'cheio',
      state: {
        ...recebido.state,
        semCorpo: false,
        madeira: recebido.state.madeira + heroi.state.madeira,
        ouro: recebido.state.ouro + heroi.state.ouro,
        heroi: { ...heroi.state.heroi, x: movido.x, z: movido.z },
        heroiOrdem: heroi.state.heroiOrdem,
      },
    }
    heroiI = movido.i
    heroiJ = movido.j
    if (heroiEraCena) {
      cenaI = movido.i
      cenaJ = movido.j
    }
    heroi = fichas[destino]
    movido = transferir(heroi.state.heroi.x, heroi.state.heroi.z, heroi.i, heroi.j)
    guard += 1
  }
  fichas[fichas.findIndex((ficha) => ficha.i === heroi.i && ficha.j === heroi.j)] = heroi

  for (const vizinho of vizinhosPorVisao(heroi.state.heroi.x, heroi.state.heroi.z, heroiI, heroiJ)) {
    const achou = achar(fichas, vizinho.i, vizinho.j)
    if (!achou) {
      const novo = nascer(vizinho.i, vizinho.j)
      fichas = [...fichas, atlas.politica === 'atual' ? { ...novo, ritmo: 'lento' } : novo]
    } else if (achou.ritmo === 'lento' && atlas.politica !== 'atual') {
      fichas = fichas.map((ficha) => (ficha.i === vizinho.i && ficha.j === vizinho.j ? { ...ficha, ritmo: 'cheio' } : ficha))
    }
  }

  fichas = fichas.map((ficha) => {
    if (ficha.i === heroiI && ficha.j === heroiJ) return ficha
    if (ficha.ritmo === 'cheio') {
      return passoComAlerta(ficha, PARADO, pedido, !(ficha.i === cenaI && ficha.j === cenaJ))
    }
    const relogio = ficha.relogio + pedido
    if (relogio < 1) return { ...ficha, relogio }
    return { ...passoComAlerta(ficha, PARADO, 1, true), relogio: relogio - 1 }
  })

  const stepMs = agoraMs() - t0
  const emaFrameMs =
    frameMs !== undefined && Number.isFinite(frameMs) && frameMs > 0
      ? atlas.emaFrameMs * 0.82 + Math.min(frameMs, 180) * 0.18
      : atlas.emaFrameMs
  let cotaDinamica = atlas.cotaDinamica
  if (atlas.politica === 'todos' && pedido > 0) {
    if (emaFrameMs > PARTIDA.orcamentoFrameTodosMs || stepMs > PARTIDA.orcamentoStepTodosMs) {
      const cheiosAtuais = fichas.filter((ficha) => ficha.ritmo === 'cheio').length
      cotaDinamica = Math.max(2, Math.min(cotaDinamica - 1, cheiosAtuais - 1))
    } else if (
      emaFrameMs < 18.5 &&
      stepMs < 5 &&
      cotaDinamica < COTA_MAX_TODOS &&
      fichas.some((ficha) => ficha.ritmo === 'lento')
    ) {
      cotaDinamica = Math.min(COTA_MAX_TODOS, cotaDinamica + 1)
    }
  }

  fichas = encolher(fichas, heroiI, heroiJ, cenaI, cenaJ, atlas.politica, cotaDinamica)
  if (!achar(fichas, cenaI, cenaJ)) {
    cenaI = heroiI
    cenaJ = heroiJ
  }
  return {
    heroiI,
    heroiJ,
    cenaI,
    cenaJ,
    fichas,
    politica: atlas.politica,
    cotaDinamica,
    emaFrameMs,
  }
}

export function resumoAtlas(atlas: Atlas): { i: number; j: number; alerta: Alerta; corpo: boolean; cena: boolean; ritmo: Ritmo }[] {
  return atlas.fichas.map((ficha) => ({
    i: ficha.i,
    j: ficha.j,
    alerta: ficha.alerta,
    corpo: ficha.i === atlas.heroiI && ficha.j === atlas.heroiJ,
    cena: ficha.i === atlas.cenaI && ficha.j === atlas.cenaJ,
    ritmo: ficha.ritmo,
  }))
}
