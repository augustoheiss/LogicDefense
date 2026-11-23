import { camadaDoMapa, fatorDaCamada } from './camadaDoMapa'
import { PARTIDA, PoliticaMinimapas } from './partidaPolicies'
import { createPartida, evoluirInimigo, PartidaInput, PartidaState, stepPartida, Unidade } from './partidaSim'

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

/**
 * Converte uma unidade que ATRAVESSA de um mapa para o vizinho (M5, pedido do usuário 23/11: «tropas atravessarem de mapa»). Função PURA, a mesma régua do herói (`transferir`): a coordenada local do
 * mapa novo é a do antigo menos `LADO_MAPA · Δ`. Tudo o que guarda coordenada LOCAL é convertido junto (posição, destino de `mover`, âncora, trilha e os marcos da rota): esquecer um campo faria a tropa
 * chegar e andar para um ponto errado do mapa novo. A unidade ganha um id NOVO do mapa de destino (cada ficha tem o seu `nextId`: um id herdado colidiria com uma unidade de lá). `atacar` e
 * `atacarObra` são CANCELADAS: o alvo ficou no mapa antigo, e um `alvoId` igual no mapa novo seria OUTRA unidade.
 */
export function converterUnidadeDeMapa(unidade: Unidade, dI: number, dJ: number, novoId: number): Unidade {
  const mx = dI * LADO_MAPA
  const mz = dJ * LADO_MAPA
  const ponto = (p: { x: number; z: number }) => ({ ...p, x: p.x - mx, z: p.z - mz })
  // O destino que vale do outro lado é o ORIGINAL (`alem`, que o `ordenar` guardou antes de a formação o prender na borda), convertido: ele cabe dentro do mapa novo e a rota lá funciona. Sem `alem` (a
  // ordem era interna) converte o x/z preso, como qualquer ponto. `alem` NÃO é levado adiante: no mapa novo o destino já é interno.
  const origemDaOrdem = unidade.ordem?.tipo === 'mover' ? (unidade.ordem.alem ?? { x: unidade.ordem.x, z: unidade.ordem.z }) : null
  const ordem = origemDaOrdem ? { tipo: 'mover' as const, x: origemDaOrdem.x - mx, z: origemDaOrdem.z - mz } : null
  return {
    ...unidade,
    id: novoId,
    x: unidade.x - mx,
    z: unidade.z - mz,
    ordem,
    ...(unidade.ancora ? { ancora: ponto(unidade.ancora) } : {}),
    ...(unidade.trilha ? { trilha: unidade.trilha.map(ponto) } : {}),
    ...(unidade.rota ? { rota: { ...unidade.rota, marcos: unidade.rota.marcos.map(ponto) } } : {}),
  }
}

/**
 * A tropa fica presa a `radius − body` (55,65) pelo próprio mapa (`limitaAlvo`/`puxaLimite`) e a ordem de mover se CUMPRE (e some, levando o `alem`) a menos de 0,5 m do destino preso, ou seja, a partir de
 * x = 55,15. O atlas só pode transferir uma tropa que AINDA tem a ordem, então o limiar fica ABAIXO da última posição com ordem viva. MEDIDO (`ultima-posicao-com-ordem.mjs`, 55 partidas, x de partida 20 a 55,
 * 5 valores de z): com o passo que o JOGO usa (`IlhaRua` passa `min(dt, 0,05)` ao atlas) a última posição com a ordem viva é 54,80 a 55,00; 54,6 deixa 0,2 m de folga. Com passos maiores (0,25 s) a última
 * posição chega a 54,0: por isso os testes andam em passos de 0,05 s, o que o jogo realmente faz. Uma tropa que JÁ partiu colada à borda (x ≥ 54,6) tem a ordem cumprida no 1º passo e não cruza: sem dado de
 * que isso aconteça no jogo (uma tropa recrutada nasce a 1,8 m do núcleo), fica registrado como limite.
 */
const BORDA_DA_TROPA = 54.6

/**
 * Para que lado uma tropa quer ATRAVESSAR, ou `null`. Só cruza a tropa aliada VIVA que recebeu uma ordem de `mover` para um ponto FORA do quadrado e já chegou à borda desse lado: ninguém atravessa por
 * acaso (uma guarda em vigia na beira do mapa, ou uma ordem para um ponto dentro do mapa, não cruza). Medido antes de desenhar: o A* prende um destino fora do mapa em 55,65 e, com qualquer obra, devolve
 * `null` (sem caminho): a tropa CHEGA à borda e fica lá com a ordem viva, e é aí que o atlas a pega.
 */
export function ladoDaTravessia(unidade: Unidade): { dI: number; dJ: number } | null {
  if (unidade.lado !== 'aliado' || !(unidade.hp > 0) || unidade.ordem?.tipo !== 'mover' || !unidade.ordem.alem) return null
  const { x, z } = unidade.ordem.alem
  const dI = x >= MEIO_MAPA && unidade.x >= BORDA_DA_TROPA ? 1 : x < -MEIO_MAPA && unidade.x <= -BORDA_DA_TROPA ? -1 : 0
  const dJ = z >= MEIO_MAPA && unidade.z >= BORDA_DA_TROPA ? 1 : z < -MEIO_MAPA && unidade.z <= -BORDA_DA_TROPA ? -1 : 0
  return dI === 0 && dJ === 0 ? null : { dI, dJ }
}

/**
 * Passa para o mapa vizinho toda tropa que quer atravessar (M5, pedido do usuário 23/11). Cada tropa sai da ficha de origem e entra na do vizinho (que NASCE se não existe, com o mesmo estágio e a mesma
 * camada de qualquer vizinho: `garantir`), convertida por `converterUnidadeDeMapa` com um id NOVO do `nextId` de lá. O herói não é tocado. O limite de 24 tropas vale por mapa (decisão do usuário).
 */
export function transferirTropas(fichas: Ficha[]): Ficha[] {
  let lista = fichas
  for (const origem of fichas) {
    const saem = origem.state.unidades.map((u) => ({ u, lado: ladoDaTravessia(u) })).filter((p): p is { u: Unidade; lado: { dI: number; dJ: number } } => p.lado !== null)
    if (saem.length === 0) continue
    const ids = new Set(saem.map((p) => p.u.id))
    lista = lista.map((f) => (f.i === origem.i && f.j === origem.j ? { ...f, state: { ...f.state, unidades: f.state.unidades.filter((u) => !ids.has(u.id)) } } : f))
    for (const { u, lado } of saem) {
      const i = origem.i + lado.dI
      const j = origem.j + lado.dJ
      lista = garantir(lista, i, j, origem.state.ondaNumero)
      lista = lista.map((f) => {
        if (f.i !== i || f.j !== j) return f
        const chegou = converterUnidadeDeMapa(u, lado.dI, lado.dJ, f.state.nextId)
        return { ...f, state: { ...f.state, nextId: f.state.nextId + 1, unidades: [...f.state.unidades, chegou] } }
      })
    }
  }
  return lista
}

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
  if (Object.keys(ficha.state.blocosMapa).length > 0) return true
  return ficha.state.unidades.some((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
}

/**
 * Faz nascer o mapa vizinho (M2, pedido do usuário 22/11). O inimigo do vizinho vem no ESTÁGIO do mapa de onde o herói vem (a base recrescida, com peças prontas) e com a vida
 * multiplicada pela CAMADA do lugar (`fatorDaCamada`: mais longe do ponto de partida, mais difícil; dobra a cada camada). Só nasce assim: um mapa que já existe nunca é reescrito.
 * A selva, o bioma e tudo que é NOSSO continuam os do lugar (decisão do usuário: clona só a base e a horda INIMIGAS). Estágio 0 e camada ≤ 1 = o mapa como sempre nasceu.
 */
function nascer(i: number, j: number, estagio = 0): Ficha {
  const state = evoluirInimigo(createPartida(i, j, true), fatorDaCamada(camadaDoMapa(i, j)), estagio)
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

/** O estagio que um mapa NOVO herda: a onda em que o mapa do heroi esta. Sem ficha do heroi (nao deveria acontecer) vale 0: nasce como sempre nasceu. */
function estagioDoHeroi(fichas: readonly Ficha[], heroiI: number, heroiJ: number): number {
  return achar(fichas, heroiI, heroiJ)?.state.ondaNumero ?? 0
}

function garantir(fichas: Ficha[], i: number, j: number, estagio = 0): Ficha[] {
  const achou = achar(fichas, i, j)
  if (!achou) return [...fichas, nascer(i, j, estagio)]
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
  let fichas = garantir(atlas.fichas, i, j, estagioDoHeroi(atlas.fichas, atlas.heroiI, atlas.heroiJ))
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

/** Esta ficha tem um núcleo NOSSO com vida? (a mesma régua de `nucleoNosso` da partida: qualquer núcleo nosso com `hp > 0`, andaime incluso.) */
function temBaseViva(ficha: Ficha): boolean {
  return ficha.state.obras.some((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo' && obra.hp > 0)
}

/**
 * Escreve em cada ficha se há OUTRA base nossa viva em OUTRO mapa (`outraBaseViva`), para a queda do núcleo daqui não decretar o fim do jogo (pedido do usuário, 23/11). Calculado ANTES do passo: a base que cai neste passo
 * ainda enxerga as outras vivas. Só devolve fichas novas quando o campo MUDA (o resto é a mesma referência: o passo roda dezenas de vezes por segundo).
 */
function marcarOutrasBases(fichas: Ficha[]): Ficha[] {
  const vivas = fichas.filter(temBaseViva).length
  return fichas.map((ficha) => {
    // Quantas bases vivas existem FORA desta ficha: o total menos a própria, se ela tem uma.
    const outras = vivas - (temBaseViva(ficha) ? 1 : 0)
    const valor = outras > 0
    return (ficha.state.outraBaseViva === true) === valor ? ficha : { ...ficha, state: { ...ficha.state, outraBaseViva: valor } }
  })
}

/**
 * A rede de segurança da derrota global (pedido do usuário, 23/11). Cada ficha lê `outraBaseViva` ANTES do passo: se DUAS bases caem no MESMO passo, cada uma ainda enxergava a outra viva e nenhuma decreta o fim. Aqui,
 * depois do passo, se havia base nossa viva antes e NENHUMA sobrou em NENHUM mapa, a ficha do corpo (a que o jogador joga) é marcada como derrota: «derrota = nenhum núcleo nosso em NENHUM quadrado» (decisão de 20/11).
 * Quem nunca teve base (o começo do jogo) não é derrotado por isto: é preciso HAVER base antes do passo.
 */
function decretarFimSeCaiuAUltimaBase(antes: readonly Ficha[], depois: Ficha[], heroiI: number, heroiJ: number): Ficha[] {
  if (!antes.some(temBaseViva) || depois.some(temBaseViva)) return depois
  return depois.map((ficha) => (ficha.i === heroiI && ficha.j === heroiJ && !ficha.state.derrota ? { ...ficha, state: { ...ficha.state, derrota: true } } : ficha))
}

export function stepAtlas(atlas: Atlas, input: PartidaInput, dt: number, timeScale = 1, frameMs?: number): Atlas {
  const t0 = agoraMs()
  const escala = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 0
  const pedido = (Number.isFinite(dt) && dt > 0 ? dt : 0) * escala
  let fichas = marcarOutrasBases(atlas.fichas.map((ficha) => ({ ...ficha })))
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
    fichas = garantir(fichas, movido.i, movido.j, heroi.state.ondaNumero)
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
      const novo = nascer(vizinho.i, vizinho.j, heroi.state.ondaNumero)
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
  fichas = transferirTropas(fichas)
  fichas = decretarFimSeCaiuAUltimaBase(atlas.fichas, fichas, heroiI, heroiJ)

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

/** Quem domina um mapa (M4, pedido do usuário 22/11): você e aliados, o inimigo, ou ninguém («selvagem»: dominado pela natureza). */
export type Dono = 'nosso' | 'inimigo' | 'selvagem'

/**
 * Função PURA que decide a cor do mapa no minimapa. (1) NOSSO: há obra nossa viva (em construção conta: o jogador está lá; ruína, hp 0, não) ou tropa nossa viva, mesmo com a base inimiga ali (a luta é
 * sua). (2) INIMIGO: não é nosso e há um NÚCLEO inimigo vivo (a base; peças ou tropas soltas, sem núcleo, não fazem uma base). (3) SELVAGEM: nenhum dos dois: o mapa conquistado e abandonado, ou ruína,
 * volta a ser da natureza. [D-minha] todas estas escolhas, para o usuário julgar jogando.
 */
export function donoDoMapa(ficha: Ficha): Dono {
  const { obras, unidades } = ficha.state
  if (obras.some((obra) => obra.lado === 'nosso' && obra.hp > 0) || unidades.some((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)) return 'nosso'
  if (obras.some((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo' && obra.hp > 0)) return 'inimigo'
  return 'selvagem'
}

export function resumoAtlas(atlas: Atlas): { i: number; j: number; alerta: Alerta; corpo: boolean; cena: boolean; ritmo: Ritmo; dono: Dono }[] {
  return atlas.fichas.map((ficha) => ({
    i: ficha.i,
    j: ficha.j,
    alerta: ficha.alerta,
    corpo: ficha.i === atlas.heroiI && ficha.j === atlas.heroiJ,
    cena: ficha.i === atlas.cenaI && ficha.j === atlas.cenaJ,
    ritmo: ficha.ritmo,
    dono: donoDoMapa(ficha),
  }))
}
