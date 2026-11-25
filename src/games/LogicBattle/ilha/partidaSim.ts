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
  VOXEL_NV5,
} from './biomaRecursos'
import {
  BlocoMaterial,
  BlocoMundo,
  blocoMundoParaCentro,
  bloqueiosDeBlocosMundo,
  chaveBlocoMundo,
  coletarEstruturaConexa,
  construirAlturasColunas,
  cotaVisaoHeroiBlocos,
  cotaVisaoTorreBlocos,
  criarBlocoMundo,
  dentroLimiteBlocoMundo,
  linhaVisaoLivre25D,
  MapaBlocos,
  planejarLinhaBlocos,
  PlanoLinhaBlocos,
  REQUISITOS_CONSAGRACAO,
  SPEC_BLOCO_MATERIAL,
} from './blocosMundo'
import {
  blocoColideHeroi,
  blocoColideUnidades,
  temRecursoParaMaterial,
} from './alvoBlocoUnificado'
import { meiaLarguraNv5 } from './blocosNv5Blueprints'
import {
  calcularEstornoMadeiraNv5,
  COTA_ESTORNO_BLUEPRINT_NV5,
  editarBlocoEmObraLivre,
  meiaLarguraObraLivre,
} from './obraBlocosLivres'
import { Bloqueio, encaixarLivre, encontrarCaminho, Marco } from './caminho'
import { applyGateWithRemainder } from './armyMath'
import { aplicarFatorAoBuff, fatorDoBuff } from './buffPorErro'
import {
  custoUpgradeEra,
  DIMENSOES_OBRA,
  fatorDanoForja,
  fatorHpAlvenaria,
  fatorVelBotas,
  GRAU_PARTIDA,
  limiteHeroisPorNivelNucleo,
  multiplicadorTrianguloAoE,
  OBRA_CENTRO_Y,
  OBSTACULOS,
  Olhar,
  Ordem,
  PARTIDA,
  Papel,
  PecaId,
  PLUS_TEN,
  Postura,
  SPEC_HEROI,
  SPEC_TROPA_ALIADA,
  SPEC_UPGRADE_ERA,
  TEMPO_CONSTRUCAO,
  type ClasseHeroi,
  type EstadoPosse,
  type TipoFormacao,
  type TipoUpgradeEra,
  type UpgradesEra,
  type GrauConta,
  type SpecTropaAliada,
  type TipoTropaAliada,
} from './partidaPolicies'
import { alcanceDaTorreNoNivel, custoDeEvoluir, danoDaTorreNoNivel, fatorDoNivel, nivelDaBaseInimiga, quantidadeDaLevaNaOnda, tropaVidaNoNivel, vidaMaximaNoNivel } from './evolucaoObra'

export { nivelDaBaseInimiga }

/** Quantos inimigos a leva da onda `onda` traz: 4 na primeira e depois 1, 2 ou 3 conforme o nível da base inimiga (a tabela, `evolucaoObra.ts`). O teto de 12 inimigos vivos é aplicado por `passoOnda`. */
export function quantidadeDaLeva(onda: number): number {
  return quantidadeDaLevaNaOnda(onda, PARTIDA.levaPrimeira, PARTIDA.levaSeguinte)
}
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
  invulneravelRestante?: number
  classe?: ClasseHeroi
}

export type TarefaConstrutor =
  | { readonly tipo: 'coletar'; readonly recursoId: number }
  | { readonly tipo: 'reparar'; readonly obraId: number }

export interface HeroiEntidade extends Heroi {
  readonly id: number
  readonly classe: ClasseHeroi
  readonly vivo: boolean
  readonly maxHp: number
  readonly ordem?: HeroiOrdem | null
  readonly postura?: Postura
  readonly tarefaConstrutor?: TarefaConstrutor | null
  readonly acaoCooldown?: number
}

export interface ItemFilaProducao {
  readonly id: number
  readonly categoria: 'tropa' | 'heroi'
  readonly tipoTropa?: TipoTropaAliada
  readonly classeHeroi?: ClasseHeroi
  readonly tempoTotalSeg: number
  readonly tempoRestanteSeg: number
  readonly custoPago: { readonly credito: number; readonly ouro: number; readonly madeira: number }
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
  blocosLivres?: BlocoMundo[]
  estornosMadeiraRestantes?: number
  custoBaseMadeiraPago?: number
  filaProducao?: ItemFilaProducao[]
  rallyPoint?: { readonly x: number; readonly z: number } | null
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
  tipoTropa?: TipoTropaAliada
  x: number
  z: number
  hp: number
  postura: Postura
  posturaBase?: Postura
  ordem: Ordem | null
  ancora?: { x: number; z: number } | null
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
  tier: GrauConta
  correta: 0 | 1 | 2 | 3
  /** Quando false (questões ENEM de 5 opções), as placas físicas N/L/S/O do chão não recebem resposta. */
  placasAtivas?: boolean
  cx: number
  cz: number
  resolvido: boolean
  aviso: string
  /**
   * A vida que a CONTA deu ao herói (depois − antes, no próprio `aplicarConta`, onde os dois valores são exatos). Só existe depois de
   * resolvido. O toast do altar lê daqui: o `onHud` só vê o estado do fim do passo, já contaminado por dano (torre, horda) e por
   * ganho de arco/portão do MESMO passo, e dizia «Vida no máximo» com o herói perdendo vida (T2, rodada 3, C.2).
   */
  ganhoVida?: number
  /** A licença que a conta pagou (reduzida pelos erros). Só existe depois de resolvido; o toast lê daqui, como lê a vida. */
  ganhoCredito?: number
  /**
   * Quantas vezes o jogador ERROU esta conta (E3: «errou a alternativa, perde o buff pela metade; cada vez que errar acontece isso»). Começa em 0 e vive no
   * estado da simulação, que continua pura e determinística: o erro é um fato do estado, e não um relógio. Soma 1 num clique errado do modal
   * (`registrarErroNoAltar`) e ao ENTRAR numa placa errada do mundo (`altarNoPasso`). `aplicarConta` o lê para reduzir o buff.
   */
  erros: number
  /**
   * Qual placa ERRADA o herói está pisando AGORA (0..3), ou null. Existe para o erro contar uma vez por ENTRADA: o `stepPartida` roda 20 a 60 vezes por
   * segundo e o herói fica parado em cima da placa; sem isto, 1 segundo na placa errada seriam 60 erros e o buff iria a zero.
   */
  placaPisada: 0 | 1 | 2 | 3 | null
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
  heroiPostura?: Postura
  chaoVisto: Uint8Array
  versaoChao: number
  semCorpo: boolean
  bioma: BiomaId
  recursos: RecursoNatural[]
  lagoas: LagoaRasa[]
  madeira: number
  ouro: number
  relogioExtracao: number
  /**
   * A fração de madeira e ouro que a produção por nível deixou para o próximo ciclo (a serraria do nível 3 com árvore rende 4,5 por ciclo, e o estoque é inteiro). Ausente = 0: o jogo sem obras evoluídas é o de
   * sempre. Vive no estado (a simulação continua pura e determinística) e é lido e escrito só por `passoRecursosNaturais`.
   */
  restoExtracao?: { madeira: number; ouro: number }
  /**
   * HÁ outra base NOSSA viva em OUTRO mapa do atlas (pedido do usuário, 23/11: «se você perder a base em outro minimapa, mesmo tendo a sua base forte no seu minimapa inicial, você perde o jogo inteiro»). Escrito SÓ pelo
   * atlas, que enxerga todas as fichas; a partida sozinha não sabe de outros mapas. Ligado, a queda do núcleo DESTE mapa não decreta a derrota (a regra do usuário de 20/11: derrota = nenhum núcleo nosso em NENHUM quadrado).
   * Ausente ou falso = partida isolada (um mapa só, todo teste antigo): a queda do núcleo encerra, como sempre foi.
   */
  outraBaseViva?: boolean
  heroiCaido?: boolean
  mortesHeroi?: number
  herois?: HeroiEntidade[]
  heroiAtivoId?: number
  posse?: EstadoPosse | null
  versaoRecursos: number
  subsoloCentro: { x: number; z: number } | null
  blocosMapa: Record<string, BlocoMundo>
  /**
   * Quanto a VIDA do inimigo deste mapa é multiplicada (M2, pedido do usuário 22/11: «mais longe, mais difícil»; decisão de 20/11: a vida dobra, a QUANTIDADE não).
   * Guardado no estado para as ondas FUTURAS nascerem iguais (senão a dificuldade sumiria na 1ª onda). Ausente = 1×: o jogo é o de sempre.
   */
  fatorInimigo?: number
  formacao?: TipoFormacao
  upgradesEra?: UpgradesEra
  contatoInimigoHeroiCooldown?: number
}

/**
 * Faz o inimigo de um mapa NASCER evoluído e mais forte (M2, pedido do usuário 22/11). `fator` multiplica a VIDA de tudo que o inimigo tem (horda, núcleo, peças) e fica guardado
 * em `fatorInimigo`; `estagio` recresce a base pelas MESMAS regras e posições das ondas (`crescerBaseInimiga`), com as peças PRONTAS e a vida cheia (uma peça em construção morreria
 * no primeiro golpe), e deixa `ondaNumero = estagio` para as ondas seguirem DAÍ. A QUANTIDADE de obras e unidades não muda além do que o estágio traz; nada nosso, nem o bioma, entra
 * na cópia. Entrada inválida (NaN, ≤ 0, infinita) não tem efeito: a vida do inimigo nunca vira NaN, zero ou infinita por um número sujo.
 */
export function evoluirInimigo(state: PartidaState, fator: number, estagio: number): PartidaState {
  const f = Number.isFinite(fator) && fator >= 1 ? fator : 1
  const alvo = Number.isFinite(estagio) && estagio >= 1 ? Math.min(Math.floor(estagio), ESTAGIO_MAXIMO_DA_COPIA) : 0
  if (f === 1 && alvo === 0) return state
  let atual: PartidaState = {
    ...state,
    fatorInimigo: f,
    unidades: state.unidades.map((u) => (u.lado === 'inimigo' ? { ...u, hp: u.hp * f } : u)),
    obras: state.obras.map((o) => (o.lado === 'inimigo' ? { ...o, hp: o.hp * f, maxHp: o.maxHp * f } : o)),
  }
  for (let numero = 1; numero <= alvo; numero += 1) atual = crescerBaseInimiga(atual, numero)
  return {
    ...atual,
    ondaNumero: Math.max(atual.ondaNumero, alvo),
    obras: atual.obras.map((o) => (o.lado === 'inimigo' && obraEmConstrucao(o) ? { ...o, construindoRestante: 0 } : o)),
  }
}

/** Até que estágio uma cópia recresce a base: a base inimiga de um mapa que passou por 40 ondas já é do tamanho que cabe no mapa (as peças que não cabem simplesmente não nascem). */
const ESTAGIO_MAXIMO_DA_COPIA = 40

export type HeroiOrdem =
  | { tipo: 'mover'; x: number; z: number; rota: Rota }
  | { tipo: 'atacar'; alvoId: number; rota: Rota | null }
  | { tipo: 'atacarObra'; obraId: number; rota: Rota | null }
  | { tipo: 'patrulhar'; ax: number; az: number; bx: number; bz: number; indoPara: 'a' | 'b'; rota: Rota | null }
  | { tipo: 'attackMove'; x: number; z: number; rota: Rota | null }

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

/**
 * O raio de visão de uma obra. A da TORRE é o próprio alcance dela (`alcanceDaTorre`: 22 m no nível 1, +2 m por nível), em uma fonte só: pedido do usuário (23/11) «a torre atira mesmo sem eu ver, porque a visão dela é
 * maior» e a escolha dele de que evoluir aumenta alcance E visão. A torre nunca atira no que não enxerga, e a nuvem que ela abre cresce com o nível.
 */
function raioDaObra(obra: Obra): number {
  if (obraEmConstrucao(obra)) return PARTIDA.visao.obra
  return obra.tipo === 'torre' ? alcanceDaTorre(obra) : PARTIDA.visao.obra
}

const cacheAlturasLoS = new WeakMap<PartidaState, Map<string, number>>()

export function alturasLoSDoEstado(state: PartidaState): Map<string, number> {
  const cached = cacheAlturasLoS.get(state)
  if (cached) return cached
  const temBlocosLivres = state.obras.some((o) => o.hp > 0 && Boolean(o.blocosLivres?.length))
  if (!temBlocosLivres && Object.keys(state.blocosMapa).length === 0) {
    const vazio = new Map<string, number>()
    cacheAlturasLoS.set(state, vazio)
    return vazio
  }
  const extras: { x: number; y: number; z: number }[] = []
  for (const obra of state.obras) {
    if (obra.hp <= 0 || !obra.blocosLivres) continue
    for (const b of obra.blocosLivres) {
      if (b.hp > 0) extras.push(b)
    }
  }
  const mapa = construirAlturasColunas(state.blocosMapa, extras)
  cacheAlturasLoS.set(state, mapa)
  return mapa
}

export function visaoLivreNoEstado(
  state: PartidaState,
  origemX: number,
  origemZ: number,
  cotaObservadorBlocos: number,
  alvoX: number,
  alvoZ: number,
  alvoY = 0,
): boolean {
  if (!PARTIDA.usarLoSPorAltura) return true
  const alturas = alturasLoSDoEstado(state)
  if (alturas.size === 0) return true
  return linhaVisaoLivre25D(origemX, origemZ, cotaObservadorBlocos, alvoX, alvoZ, alturas, alvoY)
}

function dentroDaUniao(state: PartidaState, x: number, z: number): boolean {
  if (!state.semCorpo && Math.hypot(x - state.heroi.x, z - state.heroi.z) <= PARTIDA.visao.heroi) return true
  if (state.herois) {
    const ativoId = state.heroiAtivoId ?? 0
    for (const h of state.herois) {
      if (h.id !== ativoId && h.vivo && h.army > 0 && Math.hypot(x - h.x, z - h.z) <= PARTIDA.visao.heroi) {
        return true
      }
    }
  }
  for (const unidade of state.unidades) {
    if (unidade.lado === 'aliado' && unidade.hp > 0 && Math.hypot(x - unidade.x, z - unidade.z) <= PARTIDA.visao.tropa) {
      return true
    }
  }
  for (const obra of state.obras) {
    if (!nossa(obra) || obra.hp <= 0) continue
    if (Math.hypot(x - obra.x, z - obra.z) > raioDaObra(obra)) continue
    if (obra.tipo === 'torre' && !obraEmConstrucao(obra)) {
      if (!visaoLivreNoEstado(state, obra.x, obra.z, cotaVisaoTorreBlocos(obra.nivel), x, z, 0)) continue
    }
    return true
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
  if (state.herois) {
    const ativoId = state.heroiAtivoId ?? 0
    for (const h of state.herois) {
      if (h.id !== ativoId && h.vivo && h.army > 0) carimbar(h.x, h.z, PARTIDA.visao.heroi)
    }
  }
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

/** O alcance da torre, em metros, vem da tabela de evolução (`alcanceDaTorreNoNivel`): 22 m no nível 1 (a visão dela, mais que os 18 m do tiro do herói) e +2 m por nível. A torre INIMIGA e a NOSSA usam a mesma regra. */
export function alcanceDaTorre(torre: Obra): number {
  return alcanceDaTorreNoNivel(torre.nivel)
}

export function alcanceDoTiro(x: number, z: number, yaw: number, classe?: ClasseHeroi): number {
  const borda = alcanceAteABorda(x, z, yaw)
  const alcanceClasse = classe ? SPEC_HEROI[classe].alcance : PARTIDA.visao.heroi
  if (!PARTIDA.nuvem) return Math.min(borda, alcanceClasse)
  return Math.min(borda, PARTIDA.visao.heroi, alcanceClasse)
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
    heroiPostura: 'vigia',
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
    blocosMapa: {},
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
  blocosMapa?: MapaBlocos,
): { y: number; vy: number } {
  const piso = pisoUniversalEm(x, y, z, pedraNoChao, obras, recursos, subsoloCentro, blocosMapa)
  const teto = tetoUniversalEm(x, y, z, obras, subsoloCentro, blocosMapa)
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
  if (state.derrota || state.olhar === 'imperio') return state
  if (state.posse) {
    const alvo = state.unidades.find((u) => u.id === state.posse!.unidadeId && u.lado === 'aliado' && u.hp > 0)
    if (!alvo) return state
    const piso = pisoUniversalEm(
      alvo.x,
      state.posse.y,
      alvo.z,
      state.pedraNoChao,
      state.obras,
      state.recursos,
      state.subsoloCentro,
      state.blocosMapa,
    )
    if (state.posse.y > piso + 0.08) return state
    return { ...state, posse: { ...state.posse, y: piso, vy: PARTIDA.pulo } }
  }
  if (state.semCorpo || state.heroi.army <= 0) return state
  const piso = pisoUniversalEm(
    state.heroi.x,
    state.heroi.y,
    state.heroi.z,
    state.pedraNoChao,
    state.obras,
    state.recursos,
    state.subsoloCentro,
    state.blocosMapa,
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
  if (state.semCorpo && olhar !== 'imperio' && !state.posse) return state
  if (olhar === 'imperio' && state.posse) {
    return { ...state, olhar: 'imperio', posse: null }
  }
  if (state.posse && (olhar === 'primeira' || olhar === 'terceira')) {
    return { ...state, olhar, posse: { ...state.posse, modo: olhar } }
  }
  if (state.olhar === olhar) return state
  // A ordem do herói nasce no império e só lá é executada. Levada para o corpo ficaria presa: bloquearia a vigia
  // (`mover`) ou ficaria obsoleta (`atacar`) até o jogador mexer no WASD (D-B4).
  if (olhar !== 'imperio' && state.heroiOrdem) return { ...state, olhar, heroiOrdem: null }
  return { ...state, olhar }
}

export function mira(state: PartidaState, dYaw: number, dPitch: number): PartidaState {
  const yawDelta = Number.isFinite(dYaw) ? dYaw : 0
  const pitchDelta = Number.isFinite(dPitch) ? dPitch : 0
  if (yawDelta === 0 && pitchDelta === 0) return state
  if (state.posse) {
    return {
      ...state,
      posse: {
        ...state.posse,
        yaw: state.posse.yaw + yawDelta,
        pitch: clampPitch(state.posse.pitch + pitchDelta),
      },
    }
  }
  if (state.semCorpo) return state
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

function bateObra(
  x: number,
  z: number,
  obras: readonly Obra[],
  ignorarId = -1,
  pes = 0,
  blocosMapa?: MapaBlocos,
): boolean {
  return bateObraUniversal(x, z, obras, ignorarId, pes, blocosMapa)
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
  blocosMapa?: MapaBlocos,
): { x: number; z: number } {
  let x = x1
  let z = z1
  const bloqueia = (px: number, pz: number) =>
    bateObstaculo(px, pz, pes) ||
    bateObra(px, pz, obras, -1, pes, blocosMapa) ||
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

export function podeFundarEm(
  state: PartidaState,
  tipo: PecaId,
  x: number,
  z: number,
  opcoes?: { cobrarRecursos?: boolean; exigirRevelado?: boolean },
): { ok: boolean; motivo?: string } {
  if (state.derrota) return { ok: false, motivo: 'Partida encerrada' }
  if (!Number.isFinite(x) || !Number.isFinite(z) || !dentroDoMapa(x, z)) {
    return { ok: false, motivo: 'Fora dos limites do mapa' }
  }
  if (tipo === 'nucleo' && nucleoNosso(state.obras, false)) {
    return { ok: false, motivo: 'Já existe um Núcleo aliado neste mapa' }
  }
  if (tipo !== 'nucleo' && !nucleoDe(state)) {
    return { ok: false, motivo: 'Construa o Núcleo primeiro' }
  }
  if ((state.semCorpo || opcoes?.exigirRevelado) && PARTIDA.nuvem && !chaoRevelado(state, x, z)) {
    return { ok: false, motivo: 'Explore a neblina antes de construir aqui' }
  }
  if (!state.semCorpo && state.heroi.y >= -0.9 && Math.hypot(x - state.heroi.x, z - state.heroi.z) < 1.6) {
    return { ok: false, motivo: 'Afaste o herói do canteiro de obras' }
  }
  if (bateObstaculo(x, z) || bateObra(x, z, state.obras, -1, 0, state.blocosMapa)) {
    return { ok: false, motivo: 'Espaço bloqueado por obra, obstáculo ou bloco' }
  }
  if (state.unidades.some((unidade) => unidade.hp > 0 && Math.hypot(unidade.x - x, unidade.z - z) < 1.4)) {
    return { ok: false, motivo: 'Unidade ocupando o terreno' }
  }
  if (opcoes?.cobrarRecursos) {
    const qtdMesmo = state.obras.filter((o) => nossa(o) && o.tipo === tipo && o.hp > 0).length
    const custoMad = custoMadeiraObra(tipo, qtdMesmo)
    if (custoMad > 0 && state.madeira < custoMad && state.credito < 1) {
      return { ok: false, motivo: `Precisa ${custoMad} madeiras ou 1 licença` }
    }
  }
  return { ok: true }
}

export function fundar(
  state: PartidaState,
  tipo: PecaId,
  x: number,
  z: number,
  opcoes?: { emConstrucao?: boolean; cobrarRecursos?: boolean },
): PartidaState {
  if (!podeFundarEm(state, tipo, x, z, { cobrarRecursos: opcoes?.cobrarRecursos }).ok) return state

  let madeira = state.madeira
  let credito = state.credito
  let custoBaseMadeiraPago: number | undefined
  if (opcoes?.cobrarRecursos) {
    const qtdMesmo = state.obras.filter((o) => nossa(o) && o.tipo === tipo && o.hp > 0).length
    const custoMad = custoMadeiraObra(tipo, qtdMesmo)
    custoBaseMadeiraPago = custoMad
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

  const hpBase = tipo === 'nucleo' ? PARTIDA.nucleoHp : 40 + 10
  const hp = Math.round(hpBase * fatorHpAlvenaria(state.upgradesEra))
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
    ...(custoBaseMadeiraPago !== undefined ? { custoBaseMadeiraPago } : {}),
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
  const meiaLivre = obra.blocosLivres?.length ? meiaLarguraObraLivre(obra.blocosLivres, obra.x, obra.z) : null
  const nv5 = meiaLarguraNv5()
  const hx = (meiaLivre ? meiaLivre.hx : obra.blocosNv5 ? nv5 : caixa[0] / 2) + 0.6
  const hz = (meiaLivre ? meiaLivre.hz : obra.blocosNv5 ? nv5 : caixa[2] / 2) + 0.6
  const dx = deX - obra.x
  const dz = deZ - obra.z
  const maior = Math.max(Math.abs(dx) / hx, Math.abs(dz) / hz)
  if (maior < 1e-6) return { x: obra.x, z: obra.z + hz }
  const fator = 1.05 / maior
  return { x: obra.x + dx * fator, z: obra.z + dz * fator }
}

/**
 * A fortaleza do nível 5 (grade `VOXEL_NV5`, 7 × 7 blocos de 0,85 m = 5,95 m de lado, 29 vezes a área de uma torre de 1,1 m) cabe onde a obra está? Varre a grade da
 * fortaleza e pergunta a `bateObra` (a MESMA régua de `podeFundarEm`, então «espaço bloqueado» quer dizer a mesma coisa nos dois lugares) se algum ponto bate em OUTRA obra
 * viva (nossa ou inimiga) ou em bloco do mapa. A própria obra é ignorada. Pontos: o centro de cada bloco E as quatro bordas externas, para a fronteira ser exata.
 */
function fortalezaNv5CabeEm(
  state: PartidaState,
  obraId: number,
  cx: number,
  cz: number,
  exigirDentroDoMapa = false,
): boolean {
  const { nx, nz, passo } = VOXEL_NV5
  const meioX = (nx * passo) / 2
  const meioZ = (nz * passo) / 2
  const pontos: Array<{ x: number; z: number }> = []
  for (let bz = 0; bz <= nz; bz += 1) {
    for (let bx = 0; bx <= nx; bx += 1) pontos.push({ x: cx - meioX + bx * passo, z: cz - meioZ + bz * passo })
  }
  return !pontos.some(
    (p) => (exigirDentroDoMapa && !dentroDoMapa(p.x, p.z)) || bateObra(p.x, p.z, state.obras, obraId, 0, state.blocosMapa),
  )
}

function fortalezaNv5Cabe(state: PartidaState, obra: Obra): boolean {
  return fortalezaNv5CabeEm(state, obra.id, obra.x, obra.z, false)
}

const TAXA_REEMBOLSO_VENDA = 0.5

export function calcularReembolsoVenda(state: PartidaState, obraId: number): { madeira: number; ouro: number } {
  const obra = state.obras.find((item) => item.id === obraId)
  if (!obra || obra.hp <= 0 || !nossa(obra) || obra.tipo === 'nucleo') {
    return { madeira: 0, ouro: 0 }
  }
  let baseMadeira: number
  if (obra.custoBaseMadeiraPago !== undefined) {
    baseMadeira = obra.custoBaseMadeiraPago
  } else if (obra.tipo === 'torre' || obra.tipo === 'britador') {
    const qtdMesmo = state.obras.filter((o) => nossa(o) && o.hp > 0 && o.tipo === obra.tipo).length
    baseMadeira = qtdMesmo <= 1 ? 0 : custoMadeiraObra(obra.tipo, 1)
  } else {
    baseMadeira = custoMadeiraObra(obra.tipo, 1)
  }
  let evolMadeira = 0
  let evolOuro = 0
  for (let nv = 1; nv < obra.nivel; nv += 1) {
    const preco = custoDeEvoluir(nv)
    if (!preco) break
    evolMadeira += preco.madeira
    evolOuro += preco.ouro
  }
  return {
    madeira: Math.floor((baseMadeira + evolMadeira) * TAXA_REEMBOLSO_VENDA),
    ouro: Math.floor(evolOuro * TAXA_REEMBOLSO_VENDA),
  }
}

export function podeVenderObra(
  state: PartidaState,
  obraId: number,
): { ok: boolean; motivo?: string; reembolso?: { madeira: number; ouro: number } } {
  if (state.derrota) return { ok: false, motivo: 'Partida encerrada' }
  const obra = state.obras.find((item) => item.id === obraId)
  if (!obra || obra.hp <= 0 || !nossa(obra)) return { ok: false, motivo: 'Obra não encontrada' }
  if (obra.tipo === 'nucleo') return { ok: false, motivo: 'O Núcleo não pode ser vendido' }
  return { ok: true, reembolso: calcularReembolsoVenda(state, obraId) }
}

export function venderObra(state: PartidaState, obraId: number): PartidaState {
  const check = podeVenderObra(state, obraId)
  if (!check.ok || !check.reembolso) return state
  const obras = state.obras.filter((item) => item.id !== obraId)
  const unidades = state.unidades.map((u) =>
    u.ordem?.tipo === 'atacarObra' && u.ordem.obraId === obraId ? { ...u, ordem: null, rota: null } : u,
  )
  const heroiOrdem =
    state.heroiOrdem?.tipo === 'atacarObra' && state.heroiOrdem.obraId === obraId ? null : state.heroiOrdem
  return marcarChao({
    ...state,
    madeira: state.madeira + check.reembolso.madeira,
    ouro: state.ouro + check.reembolso.ouro,
    obras,
    unidades,
    heroiOrdem,
    versaoSolidos: state.versaoSolidos + 1,
  })
}

export function podeMoverObraEm(
  state: PartidaState,
  obraId: number,
  x: number,
  z: number,
  opcoes?: { exigirRevelado?: boolean },
): { ok: boolean; motivo?: string } {
  if (state.derrota) return { ok: false, motivo: 'Partida encerrada' }
  const obra = state.obras.find((item) => item.id === obraId)
  if (!obra || obra.hp <= 0 || !nossa(obra)) return { ok: false, motivo: 'Obra não encontrada' }
  if (obra.tipo === 'nucleo') return { ok: false, motivo: 'O Núcleo não pode ser movido' }
  if (obraEmConstrucao(obra)) return { ok: false, motivo: 'Aguarde concluir a construção antes de mover' }
  if (!Number.isFinite(x) || !Number.isFinite(z) || !dentroDoMapa(x, z)) {
    return { ok: false, motivo: 'Fora dos limites do mapa' }
  }
  const temLivres = Boolean(obra.blocosLivres && obra.blocosLivres.length > 0)
  const dx = temLivres ? Math.round(x - obra.x) : 0
  const dz = temLivres ? Math.round(z - obra.z) : 0
  const destX = temLivres ? obra.x + dx : x
  const destZ = temLivres ? obra.z + dz : z
  if (!dentroDoMapa(destX, destZ)) {
    return { ok: false, motivo: 'Fora dos limites do mapa' }
  }
  if ((state.semCorpo || opcoes?.exigirRevelado) && PARTIDA.nuvem && !chaoRevelado(state, destX, destZ)) {
    return { ok: false, motivo: 'Explore a neblina antes de mover para cá' }
  }
  if (!state.semCorpo && state.heroi.y >= -0.9 && Math.hypot(destX - state.heroi.x, destZ - state.heroi.z) < 1.6) {
    return { ok: false, motivo: 'Afaste o herói do local de destino' }
  }
  if (bateObstaculo(destX, destZ) || bateObra(destX, destZ, state.obras, obra.id, 0, state.blocosMapa)) {
    return { ok: false, motivo: 'Espaço bloqueado por obra, obstáculo ou bloco' }
  }
  if (state.unidades.some((u) => u.hp > 0 && Math.hypot(u.x - destX, u.z - destZ) < 1.4)) {
    return { ok: false, motivo: 'Unidade ocupando o terreno' }
  }
  if (obra.blocosNv5 && !fortalezaNv5CabeEm(state, obra.id, destX, destZ, true)) {
    return { ok: false, motivo: 'Espaço bloqueado para a fortaleza do Nível 5' }
  }
  if (obra.blocosLivres?.length) {
    for (const b of obra.blocosLivres) {
      if (b.hp <= 0) continue
      const nx = b.x + dx
      const nz = b.z + dz
      if (!dentroLimiteBlocoMundo(nx, b.y, nz)) {
        return { ok: false, motivo: 'Fora dos limites do mapa' }
      }
      if (state.blocosMapa[chaveBlocoMundo(nx, b.y, nz)]?.hp > 0) {
        return { ok: false, motivo: 'Espaço bloqueado por obra, obstáculo ou bloco' }
      }
      const centro = blocoMundoParaCentro(nx, b.y, nz)
      if (!dentroDoMapa(centro.x, centro.z)) {
        return { ok: false, motivo: 'Fora dos limites do mapa' }
      }
      if (bateObstaculo(centro.x, centro.z) || bateObra(centro.x, centro.z, state.obras, obra.id, 0, state.blocosMapa)) {
        return { ok: false, motivo: 'Espaço bloqueado por obra, obstáculo ou bloco' }
      }
    }
  }
  return { ok: true }
}

export function moverObra(
  state: PartidaState,
  obraId: number,
  x: number,
  z: number,
  opcoes?: { exigirRevelado?: boolean },
): PartidaState {
  if (!podeMoverObraEm(state, obraId, x, z, opcoes).ok) return state
  const alvo = state.obras.find((item) => item.id === obraId)
  if (!alvo) return state

  const temLivres = Boolean(alvo.blocosLivres && alvo.blocosLivres.length > 0)
  const dx = temLivres ? Math.round(x - alvo.x) : 0
  const dz = temLivres ? Math.round(z - alvo.z) : 0
  const destX = temLivres ? alvo.x + dx : x
  const destZ = temLivres ? alvo.z + dz : z

  // Limpa árvores no novo ponto sem conceder madeira extra para evitar exploit de corte ao reposicionar
  let limpouTerreno = false
  const recursos = state.recursos.map((rec) => {
    if (rec.hp <= 0 || rec.yBase < -0.5 || rec.tipo !== 'arvore') return rec
    if (Math.hypot(rec.x - destX, rec.z - destZ) > 2.2) return rec
    limpouTerreno = true
    return { ...rec, hp: 0, regeneraEm: PARTIDA.rebroteArvoreSeg }
  })

  const obras = state.obras.map((item) => {
    if (item.id !== obraId) return item
    return {
      ...item,
      x: destX,
      z: destZ,
      ...(item.blocosLivres?.length
        ? {
            blocosLivres: item.blocosLivres.map((b) => ({
              ...b,
              x: b.x + dx,
              z: b.z + dz,
            })),
          }
        : {}),
    }
  })

  let heroi = state.heroi
  let unidades = state.unidades.map((u) =>
    u.ordem?.tipo === 'atacarObra' && u.ordem.obraId === obraId ? { ...u, rota: null } : u,
  )
  const obraMovida = obras.find((item) => item.id === obraId)!
  if (obraMovida.blocosNv5) {
    if (!state.semCorpo) {
      const livre = afastarDeFortalezaNv5(heroi.x, heroi.y, heroi.z, obraMovida)
      heroi = { ...heroi, x: livre.x, z: livre.z }
    }
    unidades = unidades.map((u) => {
      if (u.hp <= 0) return u
      const livre = afastarDeFortalezaNv5(u.x, 0, u.z, obraMovida)
      return { ...u, x: livre.x, z: livre.z }
    })
  }

  return marcarChao({
    ...state,
    recursos: limpouTerreno ? recursos : state.recursos,
    versaoRecursos: limpouTerreno ? state.versaoRecursos + 1 : state.versaoRecursos,
    obras,
    heroi,
    unidades,
    versaoSolidos: state.versaoSolidos + 1,
  })
}

/**
 * `evoluir` pode subir esta obra um nível? Devolve `{ ok, motivo }` como `podeFundarEm`: a interface mostra o MOTIVO REAL. (Antes a recusa caía num balde: qualquer falha que não
 * fosse «já no máximo» ou «em construção» virava «Precisa de X para evoluir», e uma recusa por espaço diria ao jogador que faltava dinheiro.) O NÍVEL 5 exige espaço livre para a
 * fortaleza: só nele a área da obra muda. Do 1 ao 4 a obra mantém a pegada e NADA do entorno atrapalha.
 */
export type CodigoRecusaEvoluir = 'derrota' | 'inexistente' | 'construcao' | 'maximo' | 'recurso' | 'espaco'

export function podeEvoluir(state: PartidaState, obraId: number): { ok: boolean; codigo?: CodigoRecusaEvoluir; motivo?: string } {
  if (state.derrota) return { ok: false, codigo: 'derrota', motivo: 'Partida encerrada' }
  const obra = state.obras.find((item) => item.id === obraId)
  if (!obra || obra.hp <= 0 || !nossa(obra)) return { ok: false, codigo: 'inexistente', motivo: 'Obra não encontrada' }
  if (obraEmConstrucao(obra)) return { ok: false, codigo: 'construcao', motivo: 'Aguarde concluir a construção antes de evoluir' }
  if (obra.nivel >= PARTIDA.nivelMaximoObra) return { ok: false, codigo: 'maximo', motivo: 'Construção já está no Nível 5 (máximo)' }
  // O preço vem da tabela (`custoDeEvoluir`, 1,5× por nível): a MESMA que o painel e a lista leem. `null` só no nível máximo, já tratado acima.
  const preco = custoDeEvoluir(obra.nivel)
  if (!preco) return { ok: false, codigo: 'maximo', motivo: 'Construção já está no Nível 5 (máximo)' }
  const usaCredito = state.credito >= preco.credito
  const usaRecursos = state.madeira >= preco.madeira && state.ouro >= preco.ouro
  if (!usaCredito && !usaRecursos) return { ok: false, codigo: 'recurso', motivo: 'Falta licença ou recursos para evoluir' }
  const viraFortaleza = obra.nivel + 1 >= 5 && !obra.blocosLivres?.length && !obra.blocosNv5
  if (viraFortaleza && !fortalezaNv5Cabe(state, obra)) {
    return { ok: false, codigo: 'espaco', motivo: 'Espaço bloqueado: há outra obra na área que a fortaleza do Nível 5 vai ocupar (cerca de 6 m)' }
  }
  return { ok: true }
}

export function evoluir(state: PartidaState, obraId: number): PartidaState {
  if (state.derrota) return state
  const obra = state.obras.find((item) => item.id === obraId && item.hp > 0 && nossa(item) && !obraEmConstrucao(item))
  if (!obra || obra.nivel >= PARTIDA.nivelMaximoObra) return state
  if (!podeEvoluir(state, obraId).ok) return state
  const preco = custoDeEvoluir(obra.nivel)
  if (!preco) return state
  const usaCredito = state.credito >= preco.credito
  const usaRecursos = state.madeira >= preco.madeira && state.ouro >= preco.ouro
  if (!usaCredito && !usaRecursos) return state
  const novoNivel = obra.nivel + 1
  const viraFortalezaNv5 = novoNivel >= 5 && !obra.blocosLivres?.length
  const obras = state.obras.map((item) => {
    if (item.id !== obraId) return item
    // A vida máxima do novo nível sai da tabela (1,5× por nível), a partir da vida do NÍVEL 1: a obra guarda só a do nível atual, então a base é a atual dividida pelo fator do nível atual (o inverso exato da
    // tabela). Uma obra nunca ganha menos vida ao evoluir.
    const novoMax = Math.max(item.maxHp, vidaMaximaNoNivel(item.maxHp / fatorDoNivel(item.nivel), novoNivel))
    return {
      ...item,
      nivel: novoNivel,
      hp: novoMax,
      maxHp: novoMax,
      ...(viraFortalezaNv5
        ? {
            blocosNv5: garantirBlocosNv5(item),
            estornosMadeiraRestantes: item.estornosMadeiraRestantes ?? COTA_ESTORNO_BLUEPRINT_NV5,
          }
        : {}),
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
    credito: usaCredito ? state.credito - preco.credito : state.credito,
    madeira: usaCredito ? state.madeira : state.madeira - preco.madeira,
    ouro: usaCredito ? state.ouro : state.ouro - preco.ouro,
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
  if (!state.semCorpo && state.heroi.y < -0.9) return state
  if (acao === 'adicionar' && state.madeira < 1) return state
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
  const estorno = calcularEstornoMadeiraNv5(obra.estornosMadeiraRestantes, acao)
  return {
    ...state,
    madeira: Math.max(0, state.madeira + estorno.deltaMadeira),
    obras: state.obras.map((item) =>
      item.id === obraId
        ? { ...item, blocosNv5: novosBlocos, estornosMadeiraRestantes: estorno.proximosEstornos }
        : item,
    ),
    versaoSolidos: state.versaoSolidos + 1,
    versaoRecursos: state.versaoRecursos + 1,
  }
}

function aplicarDeltaRecursoMaterial(
  state: PartidaState,
  material: BlocoMaterial,
  deltaQtd: number,
): Pick<PartidaState, 'madeira' | 'lingotes' | 'ouro'> {
  const spec = SPEC_BLOCO_MATERIAL[material]
  const delta = deltaQtd * spec.qtd
  return {
    madeira: spec.recurso === 'madeira' ? Math.max(0, state.madeira + delta) : state.madeira,
    lingotes: spec.recurso === 'lingotes' ? Math.max(0, state.lingotes + delta) : state.lingotes,
    ouro: spec.recurso === 'ouro' ? Math.max(0, state.ouro + delta) : state.ouro,
  }
}

export function celulaColideObraExistente(state: PartidaState, gx: number, gy: number, gz: number): boolean {
  const c = blocoMundoParaCentro(gx, gy, gz)
  return bateObraUniversal(c.x, c.z, state.obras, -1, gy)
}

export function podeColocarBlocoMundoEm(state: PartidaState, gx: number, gy: number, gz: number): boolean {
  if (!dentroLimiteBlocoMundo(gx, gy, gz)) return false
  const c = blocoMundoParaCentro(gx, gy, gz)
  if (PARTIDA.nuvem && !chaoRevelado(state, c.x, c.z)) return false
  if (state.blocosMapa[chaveBlocoMundo(gx, gy, gz)]) return false
  const heroiPos = state.semCorpo ? null : state.heroi
  if (blocoColideHeroi(gx, gy, gz, heroiPos)) return false
  if (blocoColideUnidades(gx, gy, gz, state.unidades)) return false
  if (celulaColideObraExistente(state, gx, gy, gz)) return false
  return true
}

export function editarBlocoMundo(
  state: PartidaState,
  gx: number,
  gy: number,
  gz: number,
  acao: 'adicionar' | 'remover',
  material: BlocoMaterial = 'madeira',
): PartidaState {
  if (state.derrota) return state
  if (!state.semCorpo && state.heroi.y < -0.9) return state
  const k = chaveBlocoMundo(gx, gy, gz)
  if (acao === 'remover') {
    const existente = state.blocosMapa[k]
    if (!existente || existente.hp <= 0 || existente.lado !== 'nosso') return state
    const proximo = { ...state.blocosMapa }
    delete proximo[k]
    const recursos = aplicarDeltaRecursoMaterial(state, existente.material, 1)
    return {
      ...state,
      ...recursos,
      blocosMapa: proximo,
      versaoSolidos: state.versaoSolidos + 1,
      versaoRecursos: state.versaoRecursos + 1,
    }
  }
  if (!temRecursoParaMaterial(state, material, 1)) return state
  if (!podeColocarBlocoMundoEm(state, gx, gy, gz)) return state
  const recursos = aplicarDeltaRecursoMaterial(state, material, -1)
  return {
    ...state,
    ...recursos,
    blocosMapa: {
      ...state.blocosMapa,
      [k]: criarBlocoMundo(gx, gy, gz, material, 'nosso'),
    },
    versaoSolidos: state.versaoSolidos + 1,
    versaoRecursos: state.versaoRecursos + 1,
  }
}

export function planejarLinhaNoEstado(
  state: PartidaState,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  altura: 1 | 2 | 3 = PARTIDA.alturaLinhaPadrao,
  material: BlocoMaterial = PARTIDA.materialBlocoPadrao,
): PlanoLinhaBlocos {
  return planejarLinhaBlocos(state.blocosMapa, x0, z0, x1, z1, altura, material, (gx, gy, gz) =>
    podeColocarBlocoMundoEm(state, gx, gy, gz),
  )
}

export function construirLinhaBlocos(
  state: PartidaState,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  altura: 1 | 2 | 3 = PARTIDA.alturaLinhaPadrao,
  material: BlocoMaterial = PARTIDA.materialBlocoPadrao,
): PartidaState {
  if (state.derrota) return state
  if (!state.semCorpo && state.heroi.y < -0.9) return state
  const plano = planejarLinhaNoEstado(state, x0, z0, x1, z1, altura, material)
  if (plano.celulas.length === 0) return state
  if (!temRecursoParaMaterial(state, material, plano.celulas.length)) return state
  const proximo: Record<string, BlocoMundo> = { ...state.blocosMapa }
  for (const cel of plano.celulas) {
    proximo[chaveBlocoMundo(cel.x, cel.y, cel.z)] = criarBlocoMundo(cel.x, cel.y, cel.z, material, 'nosso')
  }
  const recursos = aplicarDeltaRecursoMaterial(state, material, -plano.celulas.length)
  return {
    ...state,
    ...recursos,
    blocosMapa: proximo,
    versaoSolidos: state.versaoSolidos + 1,
    versaoRecursos: state.versaoRecursos + 1,
  }
}

export function podeConsagrarEm(
  state: PartidaState,
  gx: number,
  gy: number,
  gz: number,
  tipo: PecaId,
): { ok: boolean; motivo?: string; totalBlocos?: number; altura?: number } {
  if (state.derrota) return { ok: false, motivo: 'Partida encerrada' }
  if (!state.semCorpo && state.heroi.y < -0.9) return { ok: false, motivo: 'Volte à superfície para consagrar' }
  if (tipo === 'nucleo' && nucleoNosso(state.obras, false)) {
    return { ok: false, motivo: 'Já existe um Núcleo aliado neste mapa' }
  }
  if (tipo !== 'nucleo' && !nucleoDe(state)) {
    return { ok: false, motivo: 'É preciso ter um Núcleo vivo antes de consagrar esta obra' }
  }
  const res = coletarEstruturaConexa(state.blocosMapa, gx, gy, gz)
  if (!res.ok) {
    if (res.motivo === 'muito_grande') return { ok: false, motivo: 'Estrutura excede 256 blocos conectados' }
    if (res.motivo === 'span_excedido') return { ok: false, motivo: 'Estrutura excede a área máxima de 13×13 blocos' }
    return { ok: false, motivo: 'Clique em um bloco aliado livre para consagrar' }
  }
  const req = REQUISITOS_CONSAGRACAO[tipo]
  if (res.blocos.length < req.minBlocos || res.altura < req.minAltura) {
    return {
      ok: false,
      motivo: `${req.resumo} (atual: ${res.blocos.length} blocos, altura ${res.altura})`,
      totalBlocos: res.blocos.length,
      altura: res.altura,
    }
  }
  if (tipo !== 'nucleo' && state.credito < 1 && state.ouro < 2) {
    return { ok: false, motivo: 'Precisa 1 licença ou 2 ouros para consagrar' }
  }
  return { ok: true, totalBlocos: res.blocos.length, altura: res.altura }
}

export function consagrarEstruturaManual(
  state: PartidaState,
  gx: number,
  gy: number,
  gz: number,
  tipo: PecaId,
): PartidaState {
  const validacao = podeConsagrarEm(state, gx, gy, gz, tipo)
  if (!validacao.ok) return state
  const res = coletarEstruturaConexa(state.blocosMapa, gx, gy, gz)
  if (!res.ok) return state

  let credito = state.credito
  let ouro = state.ouro
  if (tipo !== 'nucleo') {
    if (credito >= 1) credito -= 1
    else if (ouro >= 2) ouro -= 2
    else return state
  }

  const proximoMapa = { ...state.blocosMapa }
  let somaHp = 0
  for (const b of res.blocos) {
    delete proximoMapa[chaveBlocoMundo(b.x, b.y, b.z)]
    somaHp += b.hp
  }
  const hpBase = tipo === 'nucleo' ? PARTIDA.nucleoHp : 50
  const maxHp = Math.max(hpBase, somaHp)
  const nivelInicial = tipo === 'torre' && res.altura >= 4 ? 5 : 1
  const obra: Obra = {
    id: state.nextId,
    lado: 'nosso',
    tipo,
    x: res.centroX,
    z: res.centroZ,
    nivel: nivelInicial,
    hp: maxHp,
    maxHp,
    gateApplied: false,
    cooldown: 0,
    blocosLivres: res.blocos.map((b) => ({ ...b })),
  }
  return marcarChao({
    ...state,
    credito,
    ouro,
    blocosMapa: proximoMapa,
    obras: [...state.obras, obra],
    nextId: state.nextId + 1,
    versaoSolidos: state.versaoSolidos + 1,
    versaoRecursos: state.versaoRecursos + 1,
  })
}

export function editarBlocoObraLivre(
  state: PartidaState,
  obraId: number,
  gx: number,
  gy: number,
  gz: number,
  acao: 'adicionar' | 'remover',
  material: BlocoMaterial = 'madeira',
): PartidaState {
  if (state.derrota) return state
  if (!state.semCorpo && state.heroi.y < -0.9) return state
  const obra = state.obras.find(
    (item) => item.id === obraId && nossa(item) && item.hp > 0 && !obraEmConstrucao(item) && Boolean(item.blocosLivres?.length),
  )
  if (!obra || !obra.blocosLivres) return state
  if (acao === 'adicionar' && !temRecursoParaMaterial(state, material, 1)) return state
  const edit = editarBlocoEmObraLivre(
    obra.blocosLivres,
    gx,
    gy,
    gz,
    acao,
    material,
    state.semCorpo ? null : state.heroi,
    state.unidades,
    state.blocosMapa,
  )
  if (!edit.ok) return state
  const recursos = aplicarDeltaRecursoMaterial(state, edit.materialAfetado, acao === 'adicionar' ? -1 : 1)
  const deltaHp = SPEC_BLOCO_MATERIAL[edit.materialAfetado].hp * (acao === 'adicionar' ? 1 : -1)
  const novoMaxHp = Math.max(40, obra.maxHp + deltaHp)
  const novoHp = Math.min(novoMaxHp, Math.max(1, obra.hp + (deltaHp > 0 ? deltaHp : 0)))
  return {
    ...state,
    ...recursos,
    obras: state.obras.map((item) =>
      item.id === obraId ? { ...item, blocosLivres: edit.blocos, maxHp: novoMaxHp, hp: novoHp } : item,
    ),
    versaoSolidos: state.versaoSolidos + 1,
    versaoRecursos: state.versaoRecursos + 1,
  }
}

function livreParaTropa(
  px: number,
  pz: number,
  obras: readonly Obra[],
  recursos: readonly RecursoNatural[],
  blocosMapa?: MapaBlocos,
): boolean {
  return (
    dentroDoMapa(px, pz) &&
    !bateObstaculo(px, pz) &&
    !bateObra(px, pz, obras, -1, 0, blocosMapa) &&
    !bateRecursoSuperficie(px, pz, 0, recursos)
  )
}

export function pontosFormacaoTropa(
  centroX: number,
  centroZ: number,
  quantidade: number,
  obras: readonly Obra[] = [],
  recursos: readonly RecursoNatural[] = [],
  blocosMapa?: MapaBlocos,
  formacao: TipoFormacao = 'caixa',
): { x: number; z: number }[] {
  const centro = puxaLimite(centroX, centroZ)
  if (quantidade <= 1) return [centro]
  const espaco = PARTIDA.tropaEspacoFormacao * (formacao === 'dispersa' ? 2.15 : formacao === 'linha' ? 1.15 : 1)
  const validos: { x: number; z: number }[] = []

  if (formacao === 'linha') {
    const porLinha = Math.min(8, quantidade)
    const linhas = Math.ceil(quantidade / porLinha)
    for (let l = 0; l < linhas && validos.length < quantidade; l += 1) {
      const zOff = (l - (linhas - 1) / 2) * espaco * 1.15
      const faltam = Math.min(porLinha, quantidade - validos.length)
      for (let c = 0; c < faltam; c += 1) {
        const xOff = (c - (faltam - 1) / 2) * espaco
        const p = puxaLimite(centroX + xOff, centroZ + zOff)
        if (!livreParaTropa(p.x, p.z, obras, recursos, blocosMapa)) continue
        if (validos.some((v) => Math.hypot(v.x - p.x, v.z - p.z) < 0.5)) continue
        validos.push(p)
      }
    }
  }

  if (validos.length < quantidade && formacao !== 'linha') {
    if (livreParaTropa(centro.x, centro.z, obras, recursos, blocosMapa)) validos.push(centro)
  }
  const maxAneis = formacao === 'dispersa' ? 8 : 6
  for (let anel = 1; validos.length < quantidade && anel <= maxAneis; anel += 1) {
    const pontosAnel = 6 * anel
    const raio = anel * espaco
    for (let i = 0; i < pontosAnel && validos.length < quantidade; i += 1) {
      const ang = (i * 2 * Math.PI) / pontosAnel
      const p = puxaLimite(centroX + Math.cos(ang) * raio, centroZ + Math.sin(ang) * raio)
      if (!livreParaTropa(p.x, p.z, obras, recursos, blocosMapa)) continue
      if (validos.some((v) => Math.hypot(v.x - p.x, v.z - p.z) < 0.5)) continue
      validos.push(p)
    }
  }
  const base = validos.length > 0 ? validos : [centro]
  const resultado: { x: number; z: number }[] = []
  for (let i = 0; i < quantidade; i += 1) {
    resultado.push(base[i % base.length])
  }
  return resultado
}

export function definirFormacao(state: PartidaState, formacao: TipoFormacao): PartidaState {
  if (state.formacao === formacao) return state
  return { ...state, formacao }
}

export function comprarUpgradeEra(state: PartidaState, tipo: TipoUpgradeEra): PartidaState {
  if (state.derrota) return state
  const atuais: UpgradesEra = state.upgradesEra ?? { forja: 0, alvenaria: 0, botas: 0 }
  const nivelAtual = atuais[tipo]
  const spec = SPEC_UPGRADE_ERA[tipo]
  if (nivelAtual >= spec.maxNivel) return state
  const custo = custoUpgradeEra(tipo, nivelAtual)
  if (state.ouro < custo.ouro || state.madeira < custo.madeira) return state

  const proxUpgrades: UpgradesEra = { ...atuais, [tipo]: nivelAtual + 1 }
  let obras = state.obras
  if (tipo === 'alvenaria') {
    const fatorAntes = fatorHpAlvenaria(atuais)
    const fatorDepois = fatorHpAlvenaria(proxUpgrades)
    const razao = fatorDepois / fatorAntes
    obras = state.obras.map((obra) => {
      if (!nossa(obra) || obra.hp <= 0) return obra
      const novoMax = Math.round(obra.maxHp * razao)
      const novoHp = Math.min(novoMax, Math.round(obra.hp * razao))
      return { ...obra, hp: novoHp, maxHp: novoMax }
    })
  }
  return {
    ...state,
    ouro: state.ouro - custo.ouro,
    madeira: state.madeira - custo.madeira,
    upgradesEra: proxUpgrades,
    obras,
  }
}

function separarAliados(
  unidades: Unidade[],
  obras: readonly Obra[],
  recursos: readonly RecursoNatural[],
  dt: number,
  blocosMapa?: MapaBlocos,
): Unidade[] {
  const aliadas = unidades.filter((u) => u.lado === 'aliado' && u.hp > 0)
  if (aliadas.length < 2) return unidades
  const raio = PARTIDA.tropaRaioSeparacao
  const maxPasso = PARTIDA.allySpeed * 0.65 * Math.max(dt, 0.016)
  const solto = PARTIDA.atlas === 'grade'
  const empuxos = new Map<number, { x: number; z: number }>()
  for (let i = 0; i < aliadas.length; i += 1) {
    const a = aliadas[i]
    let ex = 0
    let ez = 0
    for (let j = 0; j < aliadas.length; j += 1) {
      if (i === j) continue
      const b = aliadas[j]
      const dx = a.x - b.x
      const dz = a.z - b.z
      const d = Math.hypot(dx, dz)
      if (d >= raio) continue
      if (d < 1e-4) {
        const ang = (a.id * 2.399963) % (Math.PI * 2)
        ex += Math.cos(ang) * maxPasso
        ez += Math.sin(ang) * maxPasso
      } else {
        const forca = ((raio - d) / raio) * maxPasso
        ex += (dx / d) * forca
        ez += (dz / d) * forca
      }
    }
    const mag = Math.hypot(ex, ez)
    if (mag > 1e-5) {
      const escala = mag > maxPasso ? maxPasso / mag : 1
      empuxos.set(a.id, { x: ex * escala, z: ez * escala })
    }
  }
  if (empuxos.size === 0) return unidades
  return unidades.map((u) => {
    const push = empuxos.get(u.id)
    if (!push) return u
    const pos = escorrega(u.x, u.z, u.x + push.x, u.z + push.z, obras, solto, 0, recursos, null, blocosMapa)
    return { ...u, x: pos.x, z: pos.z }
  })
}

/**
 * Retorna uma posição caminhável ao redor da obra dada (ou valida uma posição candidata).
 * Compartilhado entre spawn de tropas e ressurreição segura do herói.
 */
export function pontoLivreAoRedorDaObra(
  state: PartidaState,
  obra: Obra,
  cx?: number,
  cz?: number,
): { x: number; z: number } | null {
  if (cx !== undefined && cz !== undefined) {
    return livreParaTropa(cx, cz, state.obras, state.recursos, state.blocosMapa) ? { x: cx, z: cz } : null
  }
  const meiaLivre = obra.blocosLivres?.length ? meiaLarguraObraLivre(obra.blocosLivres, obra.x, obra.z) : null
  const distBase = meiaLivre
    ? Math.max(meiaLivre.hx, meiaLivre.hz) + 0.75
    : obra.blocosNv5
      ? meiaLarguraNv5() + 0.55
      : 1.8
  for (let anel = 0; anel < 3; anel += 1) {
    const dist = distBase + anel * 1.1
    for (let passo = 0; passo < 12; passo += 1) {
      const ang = (passo * 2 * Math.PI) / 12
      const px = obra.x + Math.cos(ang) * dist
      const pz = obra.z + Math.sin(ang) * dist
      if (livreParaTropa(px, pz, state.obras, state.recursos, state.blocosMapa)) return { x: px, z: pz }
    }
  }
  const cel = encaixarLivre(Math.round(obra.x / PARTIDA.celula), Math.round(obra.z / PARTIDA.celula), bloqueiosDe(state))
  return cel ? { x: cel[0] * PARTIDA.celula, z: cel[1] * PARTIDA.celula } : null
}

export function criarTropa(state: PartidaState, obraId: number): PartidaState {
  if (state.derrota) return state
  const usaCredito = state.credito >= 1
  const usaOuro = state.ouro >= 2
  if (!usaCredito && !usaOuro) return state
  const vivas = aliadosVivos(state)
  if (vivas.length >= PARTIDA.allyCap) return state
  const obra = state.obras.find(
    (item) =>
      item.id === obraId &&
      nossa(item) &&
      item.hp > 0 &&
      !obraEmConstrucao(item) &&
      (item.tipo === 'nucleo' || item.tipo === 'quartel'),
  )
  if (!obra) return state
  const meiaLivre = obra.blocosLivres?.length ? meiaLarguraObraLivre(obra.blocosLivres, obra.x, obra.z) : null
  const distBase = meiaLivre
    ? Math.max(meiaLivre.hx, meiaLivre.hz) + 0.75
    : obra.blocosNv5
      ? meiaLarguraNv5() + 0.55
      : 1.8
  let spawn = { x: obra.x + distBase, z: obra.z }
  let melhorFallback = spawn
  let melhorFolga = -1
  let achouLimpo = false
  for (let anel = 0; anel < 3 && !achouLimpo; anel += 1) {
    const dist = distBase + anel * 1.1
    for (let passo = 0; passo < 12; passo += 1) {
      const ang = (passo * 2 * Math.PI) / 12
      const cx = obra.x + Math.cos(ang) * dist
      const cz = obra.z + Math.sin(ang) * dist
      if (!livreParaTropa(cx, cz, state.obras, state.recursos, state.blocosMapa)) continue
      const folga = vivas.reduce(
        (menor, u) => Math.min(menor, Math.hypot(cx - u.x, cz - u.z)),
        Number.POSITIVE_INFINITY,
      )
      if (folga > melhorFolga) {
        melhorFolga = folga
        melhorFallback = { x: cx, z: cz }
      }
      if (folga >= PARTIDA.tropaRaioSeparacao) {
        spawn = { x: cx, z: cz }
        achouLimpo = true
        break
      }
    }
  }
  if (!achouLimpo) {
    if (melhorFolga >= 0) {
      spawn = melhorFallback
    } else {
      const cel = encaixarLivre(Math.round(obra.x / PARTIDA.celula), Math.round(obra.z / PARTIDA.celula), bloqueiosDe(state))
      if (cel) spawn = { x: cel[0] * PARTIDA.celula, z: cel[1] * PARTIDA.celula }
    }
  }
  const unidade: Unidade = {
    id: state.nextId,
    lado: 'aliado',
    papel: 'tropa',
    x: spawn.x,
    z: spawn.z,
    // A tropa nasce com a vida do NÍVEL da obra que a recruta (quartel ou núcleo): 16 no nível 1, como era; 1,5× por nível (`tropaVidaNoNivel`).
    hp: tropaVidaNoNivel(obra.nivel),
    postura: 'vigia',
    posturaBase: 'vigia',
    ordem: null,
    ancora: null,
    cooldown: 0,
    segmentos: [],
    alerta: true,
  }
  return marcarChao({
    ...state,
    credito: usaCredito ? state.credito - 1 : state.credito,
    ouro: usaCredito ? state.ouro : state.ouro - 2,
    nextId: state.nextId + 1,
    unidades: [...state.unidades, unidade],
  })
}

function heroisGarantidos(state: PartidaState): HeroiEntidade[] {
  if (state.herois && state.herois.length > 0) return state.herois
  const classe = state.heroi.classe ?? 'ataque'
  return [
    {
      ...state.heroi,
      id: 0,
      classe,
      vivo: state.heroi.army > 0,
      maxHp: Math.max(SPEC_HEROI[classe].hpBase, state.heroi.army),
      ordem: state.heroiOrdem,
      postura: state.heroiPostura ?? 'vigia',
      tarefaConstrutor: null,
      acaoCooldown: 0,
    },
  ]
}

export function listarHerois(state: PartidaState): HeroiEntidade[] {
  const ativoId = state.heroiAtivoId ?? 0
  return heroisGarantidos(state).map((h) =>
    h.id === ativoId
      ? {
          ...h,
          ...state.heroi,
          classe: h.classe,
          vivo: state.heroi.army > 0,
          ordem: state.heroiOrdem,
          postura: state.heroiPostura ?? h.postura ?? 'vigia',
        }
      : h,
  )
}

function sincronizarHerois(state: PartidaState): PartidaState {
  if (!state.herois && state.heroi.classe === undefined) return state
  const herois = listarHerois(state)
  return {
    ...state,
    herois,
    heroiAtivoId: state.heroiAtivoId ?? herois[0]?.id ?? 0,
  }
}

export function selecionarHeroiAtivo(state: PartidaState, heroiId: number): PartidaState {
  const lista = listarHerois(state)
  const alvo = lista.find((h) => h.id === heroiId && h.vivo && h.army > 0)
  if (!alvo) return state
  const atualId = state.heroiAtivoId ?? 0
  if (atualId === heroiId && state.herois) return state
  return {
    ...state,
    herois: lista,
    heroiAtivoId: alvo.id,
    heroiOrdem: alvo.ordem ?? null,
    heroiPostura: alvo.postura ?? 'vigia',
    heroi: {
      x: alvo.x,
      z: alvo.z,
      y: alvo.y,
      vy: alvo.vy,
      yaw: alvo.yaw,
      pitch: alvo.pitch,
      army: alvo.army,
      shootCooldown: alvo.shootCooldown,
      carregandoKg: alvo.carregandoKg,
      invulneravelRestante: alvo.invulneravelRestante,
      classe: alvo.classe,
    },
  }
}

export function maiorNivelNucleoNosso(state: PartidaState): number {
  let maior = 0
  for (const o of state.obras) {
    if (nossa(o) && o.tipo === 'nucleo' && o.hp > 0) {
      maior = Math.max(maior, o.nivel)
    }
  }
  return maior
}

function tropasEmFilaTotal(state: PartidaState): number {
  let total = 0
  for (const o of state.obras) {
    if (!nossa(o) || o.hp <= 0 || !o.filaProducao) continue
    for (const item of o.filaProducao) {
      if (item.categoria === 'tropa') total += 1
    }
  }
  return total
}

function classesHeroiEmFilaOuVivas(state: PartidaState): Set<ClasseHeroi> {
  const classes = new Set<ClasseHeroi>()
  for (const h of listarHerois(state)) {
    if (h.vivo && h.army > 0) classes.add(h.classe)
  }
  for (const o of state.obras) {
    if (!nossa(o) || o.hp <= 0 || !o.filaProducao) continue
    for (const item of o.filaProducao) {
      if (item.categoria === 'heroi' && item.classeHeroi) classes.add(item.classeHeroi)
    }
  }
  return classes
}

export function enfileirarTropa(
  state: PartidaState,
  obraId: number,
  tipoTropa: TipoTropaAliada = 'soldado',
): PartidaState {
  if (state.derrota) return state
  const obra = state.obras.find(
    (item) =>
      item.id === obraId &&
      nossa(item) &&
      item.hp > 0 &&
      !obraEmConstrucao(item) &&
      (item.tipo === 'nucleo' || item.tipo === 'quartel'),
  )
  if (!obra) return state
  const filaAtual = obra.filaProducao ?? []
  if (filaAtual.length >= PARTIDA.maxFilaProducao) return state
  if (aliadosVivos(state).length + tropasEmFilaTotal(state) >= PARTIDA.allyCap) return state

  const spec = SPEC_TROPA_ALIADA[tipoTropa]
  const podeCredito = state.credito >= spec.custoCredito
  const podeRecursos = state.ouro >= spec.custoOuro && state.madeira >= spec.custoMadeira
  if (!podeCredito && !podeRecursos) return state

  const custoPago = podeCredito
    ? { credito: spec.custoCredito, ouro: 0, madeira: 0 }
    : { credito: 0, ouro: spec.custoOuro, madeira: spec.custoMadeira }

  const item: ItemFilaProducao = {
    id: state.nextId,
    categoria: 'tropa',
    tipoTropa,
    tempoTotalSeg: spec.cooldownSeg,
    tempoRestanteSeg: spec.cooldownSeg,
    custoPago,
  }
  return {
    ...state,
    nextId: state.nextId + 1,
    credito: state.credito - custoPago.credito,
    ouro: state.ouro - custoPago.ouro,
    madeira: state.madeira - custoPago.madeira,
    obras: state.obras.map((o) =>
      o.id === obra.id ? { ...o, filaProducao: [...(o.filaProducao ?? []), item] } : o,
    ),
  }
}

export function enfileirarHeroi(
  state: PartidaState,
  nucleoId: number,
  classe: ClasseHeroi,
): PartidaState {
  if (state.derrota) return state
  const nucleo = state.obras.find(
    (item) =>
      item.id === nucleoId &&
      nossa(item) &&
      item.tipo === 'nucleo' &&
      item.hp > 0 &&
      !obraEmConstrucao(item),
  )
  if (!nucleo) return state
  const filaAtual = nucleo.filaProducao ?? []
  if (filaAtual.length >= PARTIDA.maxFilaProducao) return state

  const limite = limiteHeroisPorNivelNucleo(maiorNivelNucleoNosso(state))
  const classesAtivas = classesHeroiEmFilaOuVivas(state)
  if (classesAtivas.size >= limite || classesAtivas.has(classe)) return state

  const podeCredito = state.credito >= PARTIDA.heroiCustoCredito
  const podeRecursos = state.ouro >= PARTIDA.heroiCustoOuro && state.madeira >= PARTIDA.heroiCustoMadeira
  if (!podeCredito && !podeRecursos) return state

  const custoPago = podeCredito
    ? { credito: PARTIDA.heroiCustoCredito, ouro: 0, madeira: 0 }
    : { credito: 0, ouro: PARTIDA.heroiCustoOuro, madeira: PARTIDA.heroiCustoMadeira }

  const spec = SPEC_HEROI[classe]
  const item: ItemFilaProducao = {
    id: state.nextId,
    categoria: 'heroi',
    classeHeroi: classe,
    tempoTotalSeg: spec.cooldownTreinoSeg,
    tempoRestanteSeg: spec.cooldownTreinoSeg,
    custoPago,
  }
  return {
    ...state,
    nextId: state.nextId + 1,
    credito: state.credito - custoPago.credito,
    ouro: state.ouro - custoPago.ouro,
    madeira: state.madeira - custoPago.madeira,
    obras: state.obras.map((o) =>
      o.id === nucleo.id ? { ...o, filaProducao: [...(o.filaProducao ?? []), item] } : o,
    ),
  }
}

export function cancelarItemFila(state: PartidaState, obraId: number, itemId: number): PartidaState {
  const obra = state.obras.find((o) => o.id === obraId && nossa(o) && o.hp > 0)
  if (!obra || !obra.filaProducao || obra.filaProducao.length === 0) return state
  const alvo = obra.filaProducao.find((i) => i.id === itemId)
  if (!alvo) return state
  return {
    ...state,
    credito: state.credito + alvo.custoPago.credito,
    ouro: state.ouro + alvo.custoPago.ouro,
    madeira: state.madeira + alvo.custoPago.madeira,
    obras: state.obras.map((o) =>
      o.id === obraId
        ? { ...o, filaProducao: (o.filaProducao ?? []).filter((i) => i.id !== itemId) }
        : o,
    ),
  }
}

export function definirRallyPoint(state: PartidaState, obraId: number, x: number, z: number): PartidaState {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return state
  const obra = state.obras.find(
    (o) => o.id === obraId && nossa(o) && o.hp > 0 && (o.tipo === 'quartel' || o.tipo === 'nucleo'),
  )
  if (!obra) return state
  const limitado = puxaLimite(x, z)
  return {
    ...state,
    obras: state.obras.map((o) => (o.id === obraId ? { ...o, rallyPoint: limitado } : o)),
  }
}

export function ordenarConstrutorColetar(state: PartidaState, heroiId: number, recursoId: number): PartidaState {
  const rec = state.recursos.find((r) => r.id === recursoId && r.hp > 0)
  if (!rec) return state
  const lista = listarHerois(state)
  const alvo = lista.find((h) => h.id === heroiId && h.vivo && SPEC_HEROI[h.classe].capacidadeConstrutor)
  if (!alvo) return state
  const ativoId = state.heroiAtivoId ?? lista[0]?.id ?? 0
  return {
    ...state,
    ...(heroiId === ativoId ? { heroiOrdem: null } : {}),
    herois: lista.map((h) =>
      h.id === heroiId
        ? { ...h, tarefaConstrutor: { tipo: 'coletar', recursoId }, ordem: null }
        : h,
    ),
  }
}

export function ordenarConstrutorReparar(state: PartidaState, heroiId: number, obraId: number): PartidaState {
  const obra = state.obras.find((o) => o.id === obraId && nossa(o) && (o.hp < o.maxHp || o.hp <= 0))
  if (!obra) return state
  const lista = listarHerois(state)
  const alvo = lista.find((h) => h.id === heroiId && h.vivo && SPEC_HEROI[h.classe].capacidadeConstrutor)
  if (!alvo) return state
  const ativoId = state.heroiAtivoId ?? lista[0]?.id ?? 0
  return {
    ...state,
    ...(heroiId === ativoId ? { heroiOrdem: null } : {}),
    herois: lista.map((h) =>
      h.id === heroiId
        ? { ...h, tarefaConstrutor: { tipo: 'reparar', obraId }, ordem: null }
        : h,
    ),
  }
}

export function encontrarConstrutorOcioso(state: PartidaState): HeroiEntidade | null {
  const lista = listarHerois(state)
  return (
    lista.find(
      (h) =>
        h.vivo &&
        h.army > 0 &&
        SPEC_HEROI[h.classe].capacidadeConstrutor &&
        !h.tarefaConstrutor &&
        !h.ordem,
    ) ?? null
  )
}

function executarTarefaConstrutor(
  state: PartidaState,
  construtor: HeroiEntidade,
  dt: number,
): { state: PartidaState; construtor: HeroiEntidade } {
  const tarefa = construtor.tarefaConstrutor
  if (!tarefa || !construtor.vivo || construtor.army <= 0) return { state, construtor }
  const cd = Math.max(0, (construtor.acaoCooldown ?? 0) - dt)
  const atualizado = { ...construtor, acaoCooldown: cd }

  if (tarefa.tipo === 'coletar') {
    const rec = state.recursos.find((r) => r.id === tarefa.recursoId && r.hp > 0)
    if (!rec) return { state, construtor: { ...atualizado, tarefaConstrutor: null } }
    const dist = Math.hypot(rec.x - atualizado.x, rec.z - atualizado.z)
    if (dist > 2.2) {
      const dx = rec.x - atualizado.x
      const dz = rec.z - atualizado.z
      const passo = Math.min(PARTIDA.heroSpeed * dt, dist)
      const prox = escorrega(
        atualizado.x,
        atualizado.z,
        atualizado.x + (dx / dist) * passo,
        atualizado.z + (dz / dist) * passo,
        state.obras,
        PARTIDA.atlas === 'grade',
        atualizado.y,
        [],
        state.subsoloCentro,
        state.blocosMapa,
      )
      return { state, construtor: { ...atualizado, x: prox.x, z: prox.z, yaw: yawAte(atualizado.x, atualizado.z, rec.x, rec.z) } }
    }
    if (cd > 0) return { state, construtor: atualizado }
    const danoRec = 1
    const novoHp = Math.max(0, rec.hp - danoRec)
    const ganhoMadeira = rec.tipo === 'arvore' ? 1 : 0
    const ganhoOuro = rec.tipo === 'ouro' ? 1 : 0
    const recursos = state.recursos.map((r) =>
      r.id === rec.id
        ? { ...r, hp: novoHp, ...(novoHp <= 0 && r.tipo === 'arvore' ? { regeneraEm: PARTIDA.rebroteArvoreSeg } : {}) }
        : r,
    )
    return {
      state: {
        ...state,
        recursos,
        madeira: state.madeira + ganhoMadeira,
        ouro: state.ouro + ganhoOuro,
        versaoRecursos: novoHp <= 0 ? state.versaoRecursos + 1 : state.versaoRecursos,
      },
      construtor: {
        ...atualizado,
        acaoCooldown: PARTIDA.construtorColetaCooldownSeg,
        tarefaConstrutor: novoHp <= 0 ? null : tarefa,
      },
    }
  }

  const obra = state.obras.find((o) => o.id === tarefa.obraId && nossa(o))
  if (!obra || (obra.hp > 0 && obra.hp >= obra.maxHp)) {
    return { state, construtor: { ...atualizado, tarefaConstrutor: null } }
  }
  const peri = aproximacaoDaObra(obra, atualizado.x, atualizado.z)
  const dist = Math.hypot(peri.x - atualizado.x, peri.z - atualizado.z)
  if (dist > 1.8 && !emContatoComObra(atualizado.x, atualizado.z, obra)) {
    const dx = peri.x - atualizado.x
    const dz = peri.z - atualizado.z
    const passo = Math.min(PARTIDA.heroSpeed * dt, dist)
    const prox = escorrega(
      atualizado.x,
      atualizado.z,
      atualizado.x + (dx / dist) * passo,
      atualizado.z + (dz / dist) * passo,
      state.obras,
      PARTIDA.atlas === 'grade',
      atualizado.y,
      state.recursos,
      state.subsoloCentro,
      state.blocosMapa,
    )
    return { state, construtor: { ...atualizado, x: prox.x, z: prox.z, yaw: yawAte(atualizado.x, atualizado.z, obra.x, obra.z) } }
  }
  if (cd > 0) return { state, construtor: atualizado }
  if (obra.hp <= 0) {
    const reparado = repararObra(state, obra.id)
    if (reparado === state) return { state, construtor: { ...atualizado, tarefaConstrutor: null } }
    return {
      state: reparado,
      construtor: { ...atualizado, acaoCooldown: PARTIDA.construtorReparoCooldownSeg, tarefaConstrutor: null },
    }
  }
  if (state.madeira < 1) return { state, construtor: { ...atualizado, tarefaConstrutor: null } }
  const novoHp = Math.min(obra.maxHp, obra.hp + PARTIDA.construtorReparoPorTick)
  return {
    state: {
      ...state,
      madeira: state.madeira - 1,
      obras: state.obras.map((o) => (o.id === obra.id ? { ...o, hp: novoHp } : o)),
    },
    construtor: {
      ...atualizado,
      acaoCooldown: PARTIDA.construtorReparoCooldownSeg,
      tarefaConstrutor: novoHp >= obra.maxHp ? null : tarefa,
    },
  }
}

function passoFilasProducao(state: PartidaState, dt: number): PartidaState {
  let atual = state
  let mudouFila = false
  const novasObras = atual.obras.map((obra) => {
    if (!nossa(obra) || obra.hp <= 0 || obraEmConstrucao(obra) || !obra.filaProducao?.length) return obra
    const [primeiro, ...resto] = obra.filaProducao
    const restante = Math.max(0, primeiro.tempoRestanteSeg - dt)
    mudouFila = true
    if (restante > 0) {
      return { ...obra, filaProducao: [{ ...primeiro, tempoRestanteSeg: restante }, ...resto] }
    }
    if (primeiro.categoria === 'tropa') {
      const tipoTropa = primeiro.tipoTropa ?? 'soldado'
      const spec = SPEC_TROPA_ALIADA[tipoTropa]
      const spawn = pontoLivreAoRedorDaObra(atual, obra) ?? { x: obra.x + 2, z: obra.z }
      const novaUnidade: Unidade = {
        id: atual.nextId,
        lado: 'aliado',
        papel: 'tropa',
        tipoTropa,
        x: spawn.x,
        z: spawn.z,
        hp: Math.round(tropaVidaNoNivel(obra.nivel) * spec.hpFator * 10) / 10,
        postura: 'vigia',
        posturaBase: 'vigia',
        ordem: null,
        ancora: null,
        cooldown: 0,
        segmentos: [],
        alerta: true,
      }
      atual = {
        ...atual,
        nextId: atual.nextId + 1,
        unidades: [...atual.unidades, novaUnidade],
      }
      if (obra.rallyPoint) {
        atual = ordenar(atual, [novaUnidade.id], { tipo: 'mover', x: obra.rallyPoint.x, z: obra.rallyPoint.z })
      }
    } else if (primeiro.categoria === 'heroi' && primeiro.classeHeroi) {
      const classe = primeiro.classeHeroi
      const spec = SPEC_HEROI[classe]
      const spawn = pontoLivreAoRedorDaObra(atual, obra) ?? { x: obra.x + 2.2, z: obra.z }
      const lista = listarHerois(atual)
      const novoHeroi: HeroiEntidade = {
        id: atual.nextId,
        classe,
        vivo: true,
        maxHp: spec.hpBase,
        x: spawn.x,
        z: spawn.z,
        y: 0,
        vy: 0,
        yaw: 0,
        pitch: 0,
        army: spec.hpBase,
        shootCooldown: 0,
        carregandoKg: 0,
        invulneravelRestante: 0,
        ordem: null,
        postura: 'vigia',
        tarefaConstrutor: null,
        acaoCooldown: 0,
      }
      atual = {
        ...atual,
        nextId: atual.nextId + 1,
        herois: [...lista, novoHeroi],
        heroiAtivoId: atual.heroiAtivoId ?? lista[0]?.id ?? 0,
      }
    }
    return { ...obra, filaProducao: resto }
  })
  if (!mudouFila) return atual
  return { ...atual, obras: novasObras }
}

function passoHeroisECons(state: PartidaState, dt: number): PartidaState {
  if (!state.herois?.length) return state
  let atual = sincronizarHerois(state)
  const ativoId = atual.heroiAtivoId ?? 0
  const lista = atual.herois ?? []
  const novosHerois: HeroiEntidade[] = []
  for (const h of lista) {
    let atualizado: HeroiEntidade = {
      ...h,
      shootCooldown: Math.max(0, h.shootCooldown - dt),
      invulneravelRestante: Math.max(0, (h.invulneravelRestante ?? 0) - dt),
    }
    if (atualizado.tarefaConstrutor) {
      const res = executarTarefaConstrutor(atual, atualizado, dt)
      atual = res.state
      atualizado = res.construtor
      if (atualizado.id === ativoId) {
        atual = {
          ...atual,
          heroi: {
            ...atual.heroi,
            x: atualizado.x,
            z: atualizado.z,
            yaw: atualizado.yaw,
          },
        }
      }
    }
    novosHerois.push(atualizado)
  }
  return { ...atual, herois: novosHerois }
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

export interface SelecaoRts {
  heroi: boolean
  tropas: number[]
}

export function selecionarAoClicarUnidade(atual: SelecaoRts, id: number, shiftKey = false): SelecaoRts {
  if (!shiftKey) return { heroi: false, tropas: [id] }
  const existe = atual.tropas.includes(id)
  return {
    heroi: atual.heroi,
    tropas: existe ? atual.tropas.filter((item) => item !== id) : [...atual.tropas, id],
  }
}

export function selecionarAoClicarHeroi(atual: SelecaoRts, shiftKey = false): SelecaoRts {
  if (!shiftKey) return { heroi: true, tropas: [] }
  return { heroi: !atual.heroi, tropas: atual.tropas }
}

export function selecionarAoClicarChaoVazio(atual: SelecaoRts, modoMover = false): SelecaoRts {
  return modoMover ? atual : { heroi: false, tropas: [] }
}

export function selecionarPorRetanguloEstado(
  state: PartidaState,
  atual: SelecaoRts,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  shiftKey = false,
): SelecaoRts {
  const noRet = idsNoRetangulo(state, x0, z0, x1, z1)
  const minX = Math.min(x0, x1)
  const maxX = Math.max(x0, x1)
  const minZ = Math.min(z0, z1)
  const maxZ = Math.max(z0, z1)
  const heroiDentro =
    !state.semCorpo &&
    state.heroi.army > 0 &&
    state.heroi.x >= minX &&
    state.heroi.x <= maxX &&
    state.heroi.z >= minZ &&
    state.heroi.z <= maxZ
  const combinadas = shiftKey ? Array.from(new Set([...atual.tropas, ...noRet])) : noRet
  return {
    heroi: shiftKey ? atual.heroi || heroiDentro : heroiDentro,
    tropas: combinadas,
  }
}

export function ordenar(state: PartidaState, ids: readonly number[], ordem: Ordem): PartidaState {
  if (state.derrota) return state
  const quer = new Set(ids)
  const idsElegiveis = state.unidades
    .filter((unidade) => quer.has(unidade.id) && unidade.lado === 'aliado' && unidade.hp > 0)
    .map((unidade) => unidade.id)
  if (idsElegiveis.length === 0) return state
  const bloqueios = bloqueiosDe(state)
  const slotsPorId = new Map<number, { x: number; z: number }>()
  if (ordem.tipo === 'mover' || ordem.tipo === 'attackMove') {
    const slots = pontosFormacaoTropa(
      ordem.x,
      ordem.z,
      idsElegiveis.length,
      state.obras,
      state.recursos,
      state.blocosMapa,
      state.formacao ?? 'caixa',
    )
    idsElegiveis.forEach((id, i) => slotsPorId.set(id, slots[i]))
  }
  const custoAgua =
    state.lagoas.length > 0
      ? (px: number, pz: number) => (emAguaRasa(state.lagoas, px, pz, 0) ? PARTIDA.custoAguaCaminho : 1)
      : undefined
  const unidades = state.unidades.map((unidade) => {
    if (!quer.has(unidade.id) || unidade.lado !== 'aliado' || unidade.hp <= 0) return unidade
    const posturaBase = baseGuardada(unidade)
    if (ordem.tipo === 'patrulhar') {
      const aLim = puxaLimite(ordem.ax, ordem.az)
      const bLim = puxaLimite(ordem.bx, ordem.bz)
      return {
        ...unidade,
        postura: 'ordens' as const,
        posturaBase,
        ancora: null,
        ordem: {
          tipo: 'patrulhar' as const,
          ax: aLim.x,
          az: aLim.z,
          bx: bLim.x,
          bz: bLim.z,
          indoPara: ordem.indoPara,
        },
        rota: null,
      }
    }
    if (ordem.tipo === 'attackMove') {
      const destino = slotsPorId.get(unidade.id) ?? puxaLimite(ordem.x, ordem.z)
      const marcos = encontrarCaminho(unidade.x, unidade.z, destino.x, destino.z, bloqueios, custoAgua)
      return {
        ...unidade,
        postura: 'ordens' as const,
        posturaBase,
        ancora: null,
        ordem: { tipo: 'attackMove' as const, x: destino.x, z: destino.z },
        rota: {
          marcos: marcos ?? [],
          renovarEm: state.tempo + PARTIDA.recalcularSeg,
          semCaminho: marcos === null,
          versao: state.versaoSolidos,
          modo: 'fixo' as const,
        },
      }
    }
    if (ordem.tipo !== 'mover') return { ...unidade, postura: 'ordens' as const, posturaBase, ordem, rota: null }
    const destino = slotsPorId.get(unidade.id) ?? { x: ordem.x, z: ordem.z }
    const marcos = encontrarCaminho(unidade.x, unidade.z, destino.x, destino.z, bloqueios, custoAgua)
    return {
      ...unidade,
      postura: 'ordens' as const,
      posturaBase,
      ordem: {
        tipo: 'mover' as const,
        x: destino.x,
        z: destino.z,
        // M5: a intenção de ir ALÉM do mapa sobrevive ao `puxaLimite` da formação (a mesma régua do herói em `transferir`: 56 já é fora). Sem isso o atlas nunca saberia que a tropa quer passar.
        ...(Math.abs(ordem.x) >= PARTIDA.radius || Math.abs(ordem.z) >= PARTIDA.radius ? { alem: { x: ordem.x, z: ordem.z } } : {}),
      },
      rota: {
        marcos: marcos ?? [],
        renovarEm: state.tempo + PARTIDA.recalcularSeg,
        semCaminho: marcos === null,
        versao: state.versaoSolidos,
        modo: 'fixo' as const,
      },
    }
  })
  return { ...state, unidades }
}

export function pararUnidades(
  state: PartidaState,
  ids: readonly number[],
  pararHeroi = false,
): PartidaState {
  if (state.derrota) return state
  const quer = new Set(ids)
  let mudou = false
  const unidades = state.unidades.map((unidade) => {
    if (!quer.has(unidade.id) || unidade.lado !== 'aliado' || unidade.hp <= 0) return unidade
    mudou = true
    return {
      ...unidade,
      postura: unidade.postura === 'ordens' ? baseGuardada(unidade) : unidade.postura,
      ordem: null,
      ancora: null,
      rota: null,
    }
  })
  let atual = mudou ? { ...state, unidades } : state
  if (pararHeroi && !atual.semCorpo) {
    atual = { ...limparTarefaConstrutorAtivo(atual), heroiOrdem: null }
  }
  return atual
}

export function postura(state: PartidaState, ids: readonly number[], valor: Postura): PartidaState {
  if (state.derrota) return state
  const quer = new Set(ids)
  let mudou = false
  const unidades = state.unidades.map((unidade) => {
    if (!quer.has(unidade.id) || unidade.lado !== 'aliado' || unidade.hp <= 0) return unidade
    mudou = true
    const limpa = valor === 'automatico' || valor === 'vigia' || valor === 'noLugar' || valor === 'calado'
    return {
      ...unidade,
      postura: valor,
      // `ordens` não é base: é só o estado de quem cumpre uma ordem. Qualquer outro valor é a nova base.
      posturaBase: valor === 'ordens' ? unidade.posturaBase : valor,
      ordem: limpa ? null : unidade.ordem,
      ancora: limpa ? null : unidade.ancora,
    }
  })
  if (!mudou) return state
  return { ...state, unidades }
}

export function clampVidaPartida(vida: number): number {
  if (!Number.isFinite(vida) || vida <= 0) return 0
  return Math.min(PARTIDA.vidaCap, Math.floor(vida))
}

export function aplicarConta(state: PartidaState, tier: GrauConta): PartidaState {
  if (state.derrota) return state
  const spec = GRAU_PARTIDA[tier]
  const inimigos = vivosInimigos(state)
  // E3: cada erro nesta conta divide o buff por 2 (`buffPorErro`, módulo puro). Sem erro (ou sem altar aberto, como nos testes antigos) o fator é 1 e o resultado
  // é IDÊNTICO ao de antes: vida cheia, recursos cheios e o mesmo abate. O erro vem do `altar` (estado da simulação), não de um argumento: o piso físico chama
  // esta função dentro do `stepPartida` e não tem como receber um contador da camada de interface.
  const buff = aplicarFatorAoBuff(
    { vida: spec.bonus, credito: spec.credito, madeira: tier * 2, ouro: tier, wipe: spec.wipe, inimigosVivos: inimigos.length },
    fatorDoBuff(state.altar?.erros ?? 0),
  )
  const perto = [...inimigos].sort((a, b) => {
    const da = (a.x - state.heroi.x) ** 2 + (a.z - state.heroi.z) ** 2
    const db = (b.x - state.heroi.x) ** 2 + (b.z - state.heroi.z) ** 2
    return da - db
  })
  const mata = new Set(perto.slice(0, buff.abates).map((unidade) => unidade.id))
  const armyDepois = clampVidaPartida(state.heroi.army + buff.vida)
  return {
    ...state,
    credito: state.credito + buff.credito,
    madeira: state.madeira + buff.madeira,
    ouro: state.ouro + buff.ouro,
    heroi: { ...state.heroi, army: armyDepois },
    unidades: state.unidades.map((unidade) =>
      mata.has(unidade.id) ? { ...unidade, hp: 0, segmentos: [] } : unidade,
    ),
    altar: state.altar ? { ...state.altar, resolvido: true, aviso: '', ganhoVida: Math.max(0, armyDepois - state.heroi.army), ganhoCredito: buff.credito } : null,
  }
}

export function fecharAltar(state: PartidaState): PartidaState {
  if (!state.altar) return state
  return { ...state, altar: null }
}

export function abrirAltar(state: PartidaState, tier: GrauConta, correta: 0 | 1 | 2 | 3, placasAtivas = true): PartidaState {
  if (state.derrota) return state
  return {
    ...state,
    altar: {
      tier,
      correta,
      placasAtivas,
      cx: state.heroi.x,
      cz: state.heroi.z,
      resolvido: false,
      aviso: '',
      erros: 0,
      placaPisada: null,
    },
  }
}

/**
 * Soma 1 erro à conta aberta (o clique errado do modal). Sem conta aberta, ou já resolvida, não faz nada: não há buff a reduzir e o erro depois do acerto
 * não conta. É a MESMA regra que o piso errado do mundo aplica em `altarNoPasso`: os dois caminhos de resposta chegam ao mesmo contador, e por isso a regra
 * «errou, perde metade» não se contorna errando num caminho e acertando no outro.
 */
export function registrarErroNoAltar(state: PartidaState): PartidaState {
  const altar = state.altar
  if (!altar || altar.resolvido) return state
  return { ...state, altar: { ...altar, erros: altar.erros + 1 } }
}

export function invocarDragao(state: PartidaState): PartidaState {
  if (state.derrota || vivosInimigos(state).length >= PARTIDA.enemyCap) return state
  return {
    ...state,
    nextId: state.nextId + 1,
    unidades: [...state.unidades, criarCorpoDragao(state.nextId, 0, 50)],
  }
}

/**
 * Para ONDE a saída da base inimiga aponta (usada pela leva e pelo dragão: uma fonte só). Em ordem: (1) o NÚCLEO seu vivo, como sempre foi (COM núcleo seu nada muda); senão (2) o HERÓI, se há
 * corpo no mapa; senão (3) a tropa aliada viva mais perto da base; senão (4) o CENTRO do mapa (ninguém seu: o inimigo evolui parado). Pedido do usuário (22/11): «os inimigos evoluem mesmo sem
 * base, pode deixar»; num mapa onde ninguém fundou base «o inimigo caça o herói e as tropas que estiverem lá». Antes a onda nem disparava sem o núcleo seu.
 */
function alvoDaSaida(state: PartidaState, origem: { x: number; z: number }): { x: number; z: number } {
  const nucleo = nucleoNosso(state.obras)
  if (nucleo) return nucleo
  if (!state.semCorpo && state.heroi.army > 0) return { x: state.heroi.x, z: state.heroi.z }
  const tropas = aliadosVivos(state)
  if (tropas.length > 0) {
    const maisPerto = tropas.reduce((a, b) => (Math.hypot(a.x - origem.x, a.z - origem.z) <= Math.hypot(b.x - origem.x, b.z - origem.z) ? a : b))
    return { x: maisPerto.x, z: maisPerto.z }
  }
  return { x: 0, z: 0 }
}

function nascerDragaoDaLeva(state: PartidaState): PartidaState {
  if (state.derrota || vivosInimigos(state).length >= PARTIDA.enemyCap) return state
  const origem = nucleoInimigo(state.obras)
  if (!origem) return state
  const saida = saidaDaBase(origem, alvoDaSaida(state, origem))
  const celula = encaixarLivre(Math.round(saida.x / PARTIDA.celula), Math.round(saida.z / PARTIDA.celula), bloqueiosDe(state))
  if (!celula) return state
  const fator = fatorDoEstado(state)
  return {
    ...state,
    nextId: state.nextId + 1,
    unidades: [
      ...state.unidades,
      criarCorpoDragao(state.nextId, celula[0] * PARTIDA.celula, celula[1] * PARTIDA.celula, fator),
    ],
  }
}

function saidaDaBase(base: { x: number; z: number }, alvo: { x: number; z: number }): { x: number; z: number } {
  const dx = alvo.x - base.x
  const dz = alvo.z - base.z
  const mag = Math.hypot(dx, dz) || 1
  return { x: base.x + (dx / mag) * 3, z: base.z + (dz / mag) * 3 }
}

function vidaDaLeva(numero: number, fator = 1): number {
  return (14 + (numero - 1) * 4) * fator
}

/** O fator de vida do inimigo DESTE mapa (guardado em `fatorInimigo`). Ausente ou inválido vale 1×: sem o campo o jogo é o de sempre. */
function fatorDoEstado(state: PartidaState): number {
  const fator = state.fatorInimigo
  return typeof fator === 'number' && Number.isFinite(fator) && fator >= 1 ? fator : 1
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
  const hp = (tipo === 'torre' ? 50 : 40) * fatorDoEstado(state)
  const duracao = TEMPO_CONSTRUCAO[tipo]
  const peca: Obra = {
    id: state.nextId,
    lado: 'inimigo',
    tipo,
    x,
    z,
    // O NÍVEL DA TABELA do estágio (1 a 5, sobe a cada 3 ondas): a torre inimiga atira com o dano e o alcance dele. O `nivel` do NÚCLEO segue marcando o estágio inteiro (acima); a vida da peça NÃO muda com o nível
    // (o M2 fixa 50 e 40 vezes o fator de camada): 23/11, pedido do usuário «os inimigos da base inimiga também devem evoluir».
    nivel: nivelDaBaseInimiga(numero),
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

function criarCorpoDragao(id: number, x: number, z: number, fator = 1): Unidade {
  const f = Number.isFinite(fator) && fator >= 1 ? fator : 1
  return {
    id,
    lado: 'inimigo',
    papel: 'dragao',
    x,
    z,
    hp: Math.round(30 * f),
    postura: 'automatico',
    ordem: null,
    cooldown: 0,
    segmentos: [48, 36, 24, 12, 6].map((n) => Math.round(n * f)),
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

function dispararDoAtor(
  state: PartidaState,
  ator: {
    readonly x: number
    readonly y: number
    readonly z: number
    readonly yaw: number
    readonly pitch: number
    readonly alcance: number
    readonly dano: number
    readonly tipoAtacante?: TipoTropaAliada
  },
  gasto: PartidaState,
): PartidaState {
  if (Math.abs(ator.pitch) >= PARTIDA.pitchTetoTiro) return gasto
  const fx = -Math.sin(ator.yaw)
  const fz = Math.cos(ator.yaw)
  const olhar = vetorDoOlhar(ator.yaw, ator.pitch)
  const origemY = PARTIDA.eyeY + ator.y
  const alcance = ator.alcance
  let alvo: Unidade | null = null
  let obraAlvo: Obra | null = null
  let melhor = Number.POSITIVE_INFINITY
  const cotaHeroi = cotaVisaoHeroiBlocos(ator.y)
  for (const unidade of state.unidades) {
    if (unidade.lado !== 'inimigo' || unidade.hp <= 0 || !inimigoVisivel(state, unidade)) continue
    for (const ponto of pontosDoCorpo(unidade)) {
      const dx = ponto.x - ator.x
      const dz = ponto.z - ator.z
      const alongChao = dx * fx + dz * fz
      if (alongChao < 0.35 || alongChao > alcance + 0.05) continue
      if (!visaoLivreNoEstado(state, ator.x, ator.z, cotaHeroi, ponto.x, ponto.z, 0)) continue
      const corpo = aproximaCorpo(
        ator.x,
        origemY,
        ator.z,
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
    if (Math.hypot(obra.x - ator.x, obra.z - ator.z) > alcance) continue
    if (!visaoLivreNoEstado(state, ator.x, ator.z, cotaHeroi, obra.x, obra.z, 0)) continue
    const entrada = entradaNaObra(state, obra, olhar, origemY)
    if (!Number.isFinite(entrada) || entrada > melhor + 1e-8) continue
    obraAlvo = obra
    melhor = entrada
  }
  if (obraAlvo) {
    const ferida = aplicarDanoObra(obraAlvo, ator.dano)
    return {
      ...gasto,
      obras: gasto.obras.map((obra) => (obra.id === obraAlvo.id ? ferida : obra)),
      versaoSolidos: gasto.versaoSolidos + (ferida.hp === 0 && obraAlvo.tipo !== 'portao' ? 1 : 0),
    }
  }
  if (!alvo) {
    const colheita = atingirRecursoNoTiro(
      gasto.recursos,
      ator.x,
      ator.y,
      ator.z,
      ator.yaw,
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
  const danoEfetivo = ator.tipoAtacante
    ? Math.round(ator.dano * multiplicadorTrianguloAoE(ator.tipoAtacante, alvo.papel) * 100) / 100
    : ator.dano
  return {
    ...gasto,
    unidades: gasto.unidades.map((unidade) =>
      unidade.id === id ? fereDragaoOuCorpo(unidade, danoEfetivo) : unidade,
    ),
  }
}

export function atirar(state: PartidaState): PartidaState {
  if (state.derrota) return state
  if (state.posse) {
    const tropaPos = state.unidades.find((u) => u.id === state.posse!.unidadeId && u.lado === 'aliado' && u.hp > 0)
    if (!tropaPos || state.posse.shootCooldown > 0 || state.olhar === 'imperio') return state
    const spec = specDeTropa(tropaPos)
    const alcance = Math.max(spec.alcance, 3.2)
    const tipoAtacante = tropaPos.tipoTropa ?? 'soldado'
    const gasto: PartidaState = {
      ...state,
      posse: { ...state.posse, shootCooldown: PARTIDA.shootCooldown },
    }
    return dispararDoAtor(
      state,
      {
        x: tropaPos.x,
        y: state.posse.y,
        z: tropaPos.z,
        yaw: state.posse.yaw,
        pitch: state.posse.pitch,
        alcance,
        dano: spec.danoOrdem * fatorDanoForja(state.upgradesEra),
        tipoAtacante,
      },
      gasto,
    )
  }
  if (state.semCorpo || state.heroi.army <= 0 || state.heroi.shootCooldown > 0) return state
  const gasto: PartidaState = {
    ...state,
    heroi: { ...state.heroi, shootCooldown: PARTIDA.shootCooldown },
  }
  const alcance = alcanceDoTiro(state.heroi.x, state.heroi.z, state.heroi.yaw, state.heroi.classe)
  const danoHeroi = SPEC_HEROI[state.heroi.classe ?? 'ataque'].danoTiro
  return dispararDoAtor(
    state,
    {
      x: state.heroi.x,
      y: state.heroi.y,
      z: state.heroi.z,
      yaw: state.heroi.yaw,
      pitch: state.heroi.pitch,
      alcance,
      dano: danoHeroi,
    },
    gasto,
  )
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
  blocosMapa?: MapaBlocos,
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
    false,
    0,
    [],
    null,
    blocosMapa,
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
    if (obra.blocosNv5 || obra.blocosLivres?.length) continue
    const meia = meiaObra(obra.tipo)
    lista.push({ x: obra.x, z: obra.z, hx: meia.hx, hz: meia.hz })
  }
  const obrasVoxelOuLivre = state.obras.filter((o) => o.hp > 0 && (Boolean(o.blocosNv5) || Boolean(o.blocosLivres?.length)))
  if (obrasVoxelOuLivre.length > 0) {
    lista.push(...bloqueiosTerrenoEAldeaNv5(obrasVoxelOuLivre, []))
  }
  if (Object.keys(state.blocosMapa).length > 0) {
    lista.push(...bloqueiosDeBlocosMundo(state.blocosMapa))
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
  blocosMapa?: MapaBlocos,
): Unidade {
  const atual = prepararRota(unidade, tx, tz, tempo, versao, bloqueios, modo, lagoas)
  if (atual.rota?.semCaminho) return atual
  let marcos = atual.rota?.marcos ?? [{ x: tx, z: tz }]
  while (marcos.length > 0 && Math.hypot(atual.x - marcos[0].x, atual.z - marcos[0].z) < 0.5) {
    marcos = marcos.slice(1)
  }
  const meta = marcos[0] ?? { x: tx, z: tz }
  const moved = moverUnidade(atual, meta.x, meta.z, velocidade, dt, obras, lagoas, blocosMapa)
  const chegou = modo === 'fixo' && moved.ordem?.tipo === 'mover' && Math.hypot(moved.x - tx, moved.z - tz) < 0.5
  const devolve = chegou && moved.lado === 'aliado'
  return {
    ...moved,
    ordem: chegou ? null : moved.ordem,
    postura: devolve ? (moved.posturaBase ?? 'vigia') : moved.postura,
    ancora: devolve ? null : moved.ancora,
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

export function yawAte(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(-(tx - x), tz - z)
}

function limparTarefaConstrutorAtivo(state: PartidaState): PartidaState {
  if (!state.herois?.length) return state
  const ativoId = state.heroiAtivoId ?? state.herois[0]?.id ?? 0
  if (!state.herois.some((h) => h.id === ativoId && h.tarefaConstrutor)) return state
  return {
    ...state,
    herois: state.herois.map((h) => (h.id === ativoId ? { ...h, tarefaConstrutor: null } : h)),
  }
}

export function ordenarHeroi(state: PartidaState, ordem: Ordem): PartidaState {
  if (state.derrota || state.semCorpo) return state
  const limpo = limparTarefaConstrutorAtivo(state)
  if (ordem.tipo === 'patrulhar') {
    const aLim = puxaLimite(ordem.ax, ordem.az)
    const bLim = puxaLimite(ordem.bx, ordem.bz)
    return {
      ...limpo,
      heroiOrdem: {
        tipo: 'patrulhar',
        ax: aLim.x,
        az: aLim.z,
        bx: bLim.x,
        bz: bLim.z,
        indoPara: ordem.indoPara,
        rota: null,
      },
    }
  }
  if (ordem.tipo === 'attackMove') {
    const dLim = puxaLimite(ordem.x, ordem.z)
    return {
      ...limpo,
      heroiOrdem: { tipo: 'attackMove', x: dLim.x, z: dLim.z, rota: null },
    }
  }
  if (ordem.tipo === 'mover') {
    const custoAgua =
      limpo.lagoas.length > 0
        ? (px: number, pz: number) => (emAguaRasa(limpo.lagoas, px, pz, 0) ? PARTIDA.custoAguaCaminho : 1)
        : undefined
    const marcos = encontrarCaminho(limpo.heroi.x, limpo.heroi.z, ordem.x, ordem.z, bloqueiosDe(limpo), custoAgua)
    return {
      ...limpo,
      heroiOrdem: {
        tipo: 'mover',
        x: ordem.x,
        z: ordem.z,
        rota: {
          marcos: marcos ?? [],
          renovarEm: limpo.tempo + PARTIDA.recalcularSeg,
          semCaminho: marcos === null,
          versao: limpo.versaoSolidos,
          modo: 'fixo',
        },
      },
    }
  }
  if (ordem.tipo === 'atacarObra') {
    return { ...limpo, heroiOrdem: { tipo: 'atacarObra', obraId: ordem.obraId, rota: null } }
  }
  return { ...limpo, heroiOrdem: { tipo: 'atacar', alvoId: ordem.alvoId, rota: null } }
}

export function posturaHeroi(state: PartidaState, valor: Postura): PartidaState {
  if (state.derrota || state.semCorpo) return state
  if ((state.heroiPostura ?? 'vigia') === valor) return state
  return { ...state, heroiPostura: valor }
}

function baseGuardada(unidade: Unidade): Postura {
  if (unidade.posturaBase) return unidade.posturaBase
  if (
    unidade.postura === 'vigia' ||
    unidade.postura === 'noLugar' ||
    unidade.postura === 'calado' ||
    unidade.postura === 'automatico'
  ) {
    return unidade.postura
  }
  return 'vigia'
}

// Fim de uma ordem de ataque: zera a ordem e devolve a postura de base. Sem isto a tropa
// que venceu fica em `ordens` sem ordem, e esse ramo nem persegue nem fere.
function encerrarOrdemDeAtaque(unidade: Unidade): Unidade {
  return { ...unidade, ordem: null, postura: unidade.posturaBase ?? 'vigia', ancora: null, rota: null }
}

function vigiarHeroi(state: PartidaState): PartidaState {
  if (state.derrota || state.semCorpo || state.heroi.army <= 0) return state
  if ((state.heroiPostura ?? 'vigia') !== 'vigia') return state
  if (state.heroiOrdem?.tipo === 'mover') return state
  // No império ninguém controla o pitch: o que há nele é resto de uma ordem (atacarObra o inclina para o centro da
  // obra), e a ordem pode acabar de várias formas (obra cai, mover, troca de olhar). Aqui ele é neutro, por qualquer
  // caminho. No corpo o pitch é do jogador e a vigia nunca o toca. Vem ANTES do teto: um pitch preso acima dele
  // bloquearia a vigia sem nunca poder ser corrigido (D-B1-CANCEL).
  if (state.olhar === 'imperio' && state.heroi.pitch !== 0) {
    state = { ...state, heroi: { ...state.heroi, pitch: 0 } }
  }
  if (Math.abs(state.heroi.pitch) >= PARTIDA.pitchTetoTiro) return state
  if (state.heroi.shootCooldown > 0) return state
  let melhor: Unidade | null = null
  let distMelhor: number = PARTIDA.visao.heroi
  const cota = cotaVisaoHeroiBlocos(state.heroi.y)
  for (const unidade of state.unidades) {
    if (unidade.lado !== 'inimigo' || unidade.hp <= 0 || unidade.papel === 'isca') continue
    const dist = Math.hypot(unidade.x - state.heroi.x, unidade.z - state.heroi.z)
    if (dist > distMelhor) continue
    if (!visaoLivreNoEstado(state, state.heroi.x, state.heroi.z, cota, unidade.x, unidade.z, 0)) continue
    distMelhor = dist
    melhor = unidade
  }
  if (!melhor) return state
  const yaw = yawAte(state.heroi.x, state.heroi.z, melhor.x, melhor.z)
  return atirar({ ...state, heroi: { ...state.heroi, yaw } })
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
      state.lagoas,
      state.blocosMapa,
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
    // A ordem escreveu um pitch para o centro da obra. Acabou a obra, acabou a ordem: devolve o pitch ao
    // nível, senão a vigia atira no chão (a 1,5 m o pitch fica em -0,49 e a primeira baixa demora 1 s a mais).
    // Só aqui: no corpo o pitch é do jogador, e a vigia nunca o mexe.
    if (!obra) return { ...state, heroiOrdem: null, heroi: { ...state.heroi, pitch: 0 } }
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
        state.lagoas,
        state.blocosMapa,
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
  if (ordem.tipo === 'patrulhar' || ordem.tipo === 'attackMove') {
    const alcHeroi = SPEC_HEROI[state.heroi.classe ?? 'ataque'].alcance
    const cota = cotaVisaoHeroiBlocos(state.heroi.y)
    let melhorIni: Unidade | null = null
    let melhorDist: number = Math.max(PARTIDA.visao.heroi, alcHeroi)
    for (const u of state.unidades) {
      if (u.lado !== 'inimigo' || u.hp <= 0 || u.papel === 'isca') continue
      const d = Math.hypot(u.x - state.heroi.x, u.z - state.heroi.z)
      if (d <= melhorDist && visaoLivreNoEstado(state, state.heroi.x, state.heroi.z, cota, u.x, u.z, 0)) {
        melhorDist = d
        melhorIni = u
      }
    }
    if (melhorIni) {
      const yaw = yawAte(state.heroi.x, state.heroi.z, melhorIni.x, melhorIni.z)
      if (melhorDist <= alcHeroi) {
        return atirar({ ...state, heroi: { ...state.heroi, yaw, pitch: 0 } })
      }
      const andou = avancarRota(
        sombraDoHeroi(state, ordem.rota),
        melhorIni.x,
        melhorIni.z,
        PARTIDA.heroSpeed,
        dt,
        state.obras,
        state.tempo,
        state.versaoSolidos,
        bloqueios,
        'vivo',
        state.lagoas,
        state.blocosMapa,
      )
      return {
        ...state,
        heroi: { ...state.heroi, x: andou.x, z: andou.z, yaw, pitch: 0 },
        heroiOrdem: { ...ordem, rota: andou.rota ?? null },
      }
    }
    if (ordem.tipo === 'patrulhar') {
      const alvoX = ordem.indoPara === 'b' ? ordem.bx : ordem.ax
      const alvoZ = ordem.indoPara === 'b' ? ordem.bz : ordem.az
      let ordemAtual = ordem
      let destX = alvoX
      let destZ = alvoZ
      if (Math.hypot(alvoX - state.heroi.x, alvoZ - state.heroi.z) < 1.0) {
        const proxSentido = ordem.indoPara === 'b' ? ('a' as const) : ('b' as const)
        destX = proxSentido === 'b' ? ordem.bx : ordem.ax
        destZ = proxSentido === 'b' ? ordem.bz : ordem.az
        ordemAtual = { ...ordem, indoPara: proxSentido, rota: null }
      }
      const andou = avancarRota(
        sombraDoHeroi(state, ordemAtual.rota),
        destX,
        destZ,
        PARTIDA.heroSpeed,
        dt,
        state.obras,
        state.tempo,
        state.versaoSolidos,
        bloqueios,
        'fixo',
        state.lagoas,
        state.blocosMapa,
      )
      return {
        ...state,
        heroi: {
          ...state.heroi,
          x: andou.x,
          z: andou.z,
          yaw: yawAte(state.heroi.x, state.heroi.z, destX, destZ),
          pitch: 0,
        },
        heroiOrdem: { ...ordemAtual, rota: andou.rota ?? null },
      }
    }
    const chegou = Math.hypot(ordem.x - state.heroi.x, ordem.z - state.heroi.z) < 0.9
    if (chegou) return { ...state, heroiOrdem: null }
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
      state.lagoas,
      state.blocosMapa,
    )
    return {
      ...state,
      heroi: {
        ...state.heroi,
        x: andou.x,
        z: andou.z,
        yaw: yawAte(state.heroi.x, state.heroi.z, andou.x, andou.z),
        pitch: 0,
      },
      heroiOrdem: { ...ordem, rota: andou.rota ?? null },
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
      state.lagoas,
      state.blocosMapa,
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
  if (state.semCorpo || state.heroi.army <= 0) return state
  if (state.olhar === 'imperio') {
    let ordem = seguirOrdemHeroi(state, dt)
    if (!ordem.heroiOrdem) ordem = vigiarHeroi(ordem)
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
      ordem.blocosMapa,
    )
    return { ...ordem, heroi: { ...ordem.heroi, y: queda.y, vy: queda.vy } }
  }
  const analogico = typeof input.eixoX === 'number' || typeof input.eixoY === 'number'
  const drive = analogico
    ? Math.max(-1, Math.min(1, input.eixoY ?? 0))
    : (input.forward ? 1 : 0) - (input.back ? 1 : 0)
  const lado = analogico ? Math.max(-1, Math.min(1, input.eixoX ?? 0)) : input.strafe
  const andando = Math.abs(drive) > 0.2 || Math.abs(lado) > 0.2
  if (andando) {
    if (state.heroiOrdem) state = { ...state, heroiOrdem: null }
    state = limparTarefaConstrutorAtivo(state)
  }
  if (!andando && state.heroiOrdem?.tipo !== 'mover') {
    state = vigiarHeroi(state)
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
    state.blocosMapa,
  )
  let army = state.heroi.army
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
    state.blocosMapa,
  )
  return {
    ...state,
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
    army = clampVidaPartida(applyGateWithRemainder(army, { ...PLUS_TEN, id: `portao-${obra.id}` }).nextArmy)
    return { ...obra, gateApplied: true }
  })
  if (!mudou) return state
  return { ...state, obras, heroi: { ...state.heroi, army } }
}

function altarNoPasso(state: PartidaState): PartidaState {
  const altar = state.altar
  if (!altar || altar.resolvido || altar.placasAtivas === false) return state
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
    // E3: placa ERRADA. O erro conta na ENTRADA, não a cada passo: o herói fica parado em cima da placa por dezenas de passos (o `stepPartida` roda 20 a 60
    // vezes por segundo) e sem a memória de qual placa ele já está pisando, 1 segundo parado seriam ~60 erros e o buff iria a zero. Ir de uma placa errada
    // direto a outra errada conta de novo (a placa pisada mudou).
    const placa = indice as 0 | 1 | 2 | 3
    if (altar.placaPisada === placa) return state
    return { ...state, altar: { ...altar, aviso: 'Esse piso não é a resposta.', erros: altar.erros + 1, placaPisada: placa } }
  }
  // fora de todas as placas: esquece a placa pisada, para voltar a ela depois contar como errar DE NOVO
  if (altar.placaPisada !== null) return { ...state, altar: { ...altar, placaPisada: null } }
  return state
}

function aplicarReducaoHeroi(danoBruto: number, classe?: ClasseHeroi): number {
  const red = SPEC_HEROI[classe ?? 'ataque'].reducaoDanoPct
  return Math.max(1, Math.ceil(danoBruto * (1 - red)))
}

function danoHordaNoHeroi(state: PartidaState): PartidaState {
  if (state.semCorpo || state.heroi.army <= 0 || (state.heroi.invulneravelRestante ?? 0) > 0 || state.heroi.y < -0.9) {
    return state
  }
  let army = state.heroi.army
  let mudou = false
  const danoRecebido = aplicarReducaoHeroi(PARTIDA.hitDamage, state.heroi.classe)
  const unidades = state.unidades.map((unidade) => {
    if (unidade.papel !== 'horda' || unidade.hp <= 0) return unidade
    const dist = Math.hypot(unidade.x - state.heroi.x, unidade.z - state.heroi.z)
    if (dist > PARTIDA.hitRadius) return unidade
    mudou = true
    army = clampVidaPartida(army - danoRecebido)
    return { ...unidade, hp: 0 }
  })
  if (!mudou) return state
  return { ...state, unidades, heroi: { ...state.heroi, army } }
}

/**
 * Sitiantes e Dragões também causam dano de contato contínuo (com cooldown) no Herói,
 * respeitando `invulneravelRestante`, redução de Tanque e escalonamento por camada do mapa.
 */
export function danoContatoInimigosNoHeroi(state: PartidaState, dt: number): PartidaState {
  const atualCd = Math.max(0, (state.contatoInimigoHeroiCooldown ?? 0) - dt)
  if (state.semCorpo || state.heroi.army <= 0 || (state.heroi.invulneravelRestante ?? 0) > 0 || state.heroi.y < -0.9) {
    return atualCd === (state.contatoInimigoHeroiCooldown ?? 0)
      ? state
      : { ...state, contatoInimigoHeroiCooldown: atualCd }
  }
  if (atualCd > 0) {
    return { ...state, contatoInimigoHeroiCooldown: atualCd }
  }
  const agressor = state.unidades.find(
    (u) =>
      u.lado === 'inimigo' &&
      u.hp > 0 &&
      (u.papel === 'sitiante' || u.papel === 'dragao') &&
      Math.hypot(u.x - state.heroi.x, u.z - state.heroi.z) <= PARTIDA.hitRadius + 0.35,
  )
  if (!agressor) {
    return atualCd === (state.contatoInimigoHeroiCooldown ?? 0)
      ? state
      : { ...state, contatoInimigoHeroiCooldown: atualCd }
  }
  const baseDano = agressor.papel === 'dragao' ? PARTIDA.danoContatoDragaoHeroi : PARTIDA.danoContatoSitianteHeroi
  const danoFinal = aplicarReducaoHeroi(baseDano, state.heroi.classe)
  return {
    ...state,
    contatoInimigoHeroiCooldown: PARTIDA.contatoInimigoHeroiCooldown,
    heroi: { ...state.heroi, army: clampVidaPartida(state.heroi.army - danoFinal) },
  }
}

function specDeTropa(unidade: Unidade, upgrades?: UpgradesEra): SpecTropaAliada {
  const base =
    unidade.lado === 'aliado' && unidade.tipoTropa
      ? SPEC_TROPA_ALIADA[unidade.tipoTropa]
      : SPEC_TROPA_ALIADA.soldado
  if (!upgrades || unidade.lado !== 'aliado') return base
  const fatorVel = fatorVelBotas(upgrades)
  const fatorDano = fatorDanoForja(upgrades)
  if (fatorVel === 1 && fatorDano === 1) return base
  return {
    ...base,
    vel: base.vel * fatorVel,
    danoBase: Math.round(base.danoBase * fatorDano * 100) / 100,
    danoOrdem: Math.round(base.danoOrdem * fatorDano * 100) / 100,
  }
}

function emAlcanceDeUnidade(state: PartidaState, unidade: Unidade, alvo: Unidade, spec: SpecTropaAliada): boolean {
  if (Math.hypot(alvo.x - unidade.x, alvo.z - unidade.z) > spec.alcance) return false
  if (spec.alcance <= PARTIDA.melee + 0.5) return true
  return visaoLivreNoEstado(state, unidade.x, unidade.z, cotaVisaoHeroiBlocos(0), alvo.x, alvo.z, 0)
}

function emAlcanceDeObra(state: PartidaState, unidade: Unidade, obra: Obra, spec: SpecTropaAliada): boolean {
  if (emContatoComObra(unidade.x, unidade.z, obra)) return true
  if (spec.alcance <= PARTIDA.melee + 0.5) return false
  return (
    Math.hypot(obra.x - unidade.x, obra.z - unidade.z) <= spec.alcance + 1.5 &&
    visaoLivreNoEstado(state, unidade.x, unidade.z, cotaVisaoHeroiBlocos(0), obra.x, obra.z, 0)
  )
}

function emContatoComObra(px: number, pz: number, obra: Obra): boolean {
  const m = obra.blocosLivres?.length
    ? meiaLarguraObraLivre(obra.blocosLivres, obra.x, obra.z)
    : obra.blocosNv5
      ? { hx: meiaLarguraNv5(), hz: meiaLarguraNv5() }
      : meiaObra(obra.tipo)
  const dx = Math.max(0, Math.abs(px - obra.x) - m.hx)
  const dz = Math.max(0, Math.abs(pz - obra.z) - m.hz)
  return Math.hypot(dx, dz) <= 0.98 || Math.hypot(px - obra.x, pz - obra.z) <= PARTIDA.nucleoContato
}

function blocoNossoAdjacente(px: number, pz: number, blocosMapa: MapaBlocos): BlocoMundo | null {
  let melhor: BlocoMundo | null = null
  let melhorDist = 1.45
  const gxC = Math.round(px)
  const gzC = Math.round(pz)
  for (let gx = gxC - 1; gx <= gxC + 1; gx += 1) {
    for (let gz = gzC - 1; gz <= gzC + 1; gz += 1) {
      for (let gy = 0; gy <= 1; gy += 1) {
        const bloco = blocosMapa[chaveBlocoMundo(gx, gy, gz)]
        if (!bloco || bloco.hp <= 0 || bloco.lado !== 'nosso') continue
        const d = Math.hypot(px - bloco.x, pz - bloco.z)
        if (d < melhorDist) {
          melhorDist = d
          melhor = bloco
        }
      }
    }
  }
  return melhor
}

function passoVigiaUnidade(
  state: PartidaState,
  unidade: Unidade,
  unidades: readonly Unidade[],
  obras: readonly Obra[],
  dt: number,
  bloqueios: readonly Bloqueio[],
  versao: number,
  blocosMapa: MapaBlocos,
): Unidade {
  if (unidade.lado !== 'aliado' || unidade.hp <= 0) return unidade
  if (unidade.postura === 'calado' || unidade.postura === 'noLugar') return unidade
  if (unidade.postura !== 'vigia' && unidade.postura !== 'automatico') return unidade
  const inimigos = unidades.filter((item) => item.lado === 'inimigo' && item.hp > 0)
  const vistos = inimigos.filter(
    (item) =>
      Math.hypot(item.x - unidade.x, item.z - unidade.z) <= PARTIDA.visao.tropa &&
      visaoLivreNoEstado(state, unidade.x, unidade.z, cotaVisaoHeroiBlocos(0), item.x, item.z, 0),
  )
  const ancoraInicial = unidade.ancora ?? null
  let ancora = ancoraInicial
  // Com âncora, só concorre quem está dentro da coleira. Escolher o mais perto da tropa antes de olhar a
  // coleira deixava um alvo de fora vencer, e a tropa parava ignorando outro, dentro do olho e da coleira (D-A1).
  const vistosNaColeira = ancoraInicial
    ? vistos.filter((item) => Math.hypot(item.x - ancoraInicial.x, item.z - ancoraInicial.z) <= PARTIDA.acquireAliado)
    : vistos
  let alvoId = maisPerto(unidade.x, unidade.z, vistosNaColeira)
  // A decisão "há alvo fora da coleira, então segura" só pode ser tomada DEPOIS das quatro buscas (unidade no
  // olho, unidade na coleira, obra no olho, obra na coleira), no desfecho abaixo. Antes disso ela cortava as
  // buscas seguintes e ignorava candidatos válidos (D-A1-CROSS).
  if (alvoId === null && ancoraInicial) {
    const naColeira = inimigos.filter(
      (item) => Math.hypot(item.x - ancoraInicial.x, item.z - ancoraInicial.z) <= PARTIDA.acquireAliado,
    )
    alvoId = maisPerto(unidade.x, unidade.z, naColeira)
  }
  const spec = specDeTropa(unidade, state.upgradesEra)
  const alvo = alvoId === null ? undefined : inimigos.find((item) => item.id === alvoId)
  if (alvo) {
    if (!ancora) ancora = { x: unidade.x, z: unidade.z }
    else if (Math.hypot(alvo.x - ancora.x, alvo.z - ancora.z) > PARTIDA.acquireAliado) {
      return unidade
    }
    const comAncora = { ...unidade, ancora }
    if (emAlcanceDeUnidade(state, unidade, alvo, spec)) return comAncora
    return avancarRota(
      comAncora,
      alvo.x,
      alvo.z,
      spec.vel,
      dt,
      obras,
      state.tempo,
      versao,
      bloqueios,
      'vivo',
      state.lagoas,
      blocosMapa,
    )
  }
  const obrasHostis = obras.filter(
    (item) =>
      !nossa(item) &&
      item.hp > 0 &&
      cobertoAgora(state, item.x, item.z) &&
      Math.hypot(item.x - unidade.x, item.z - unidade.z) <= PARTIDA.visao.tropa &&
      visaoLivreNoEstado(state, unidade.x, unidade.z, cotaVisaoHeroiBlocos(0), item.x, item.z, 0),
  )
  // Mesma regra da unidade (D-A1): com âncora, só concorre a obra dentro da coleira.
  const obrasNaColeira = ancoraInicial
    ? obrasHostis.filter((item) => Math.hypot(item.x - ancoraInicial.x, item.z - ancoraInicial.z) <= PARTIDA.acquireAliado)
    : obrasHostis
  const obraId = maisPerto(unidade.x, unidade.z, obrasNaColeira)
  let alvoObra = obraId === null ? undefined : obras.find((item) => item.id === obraId && item.hp > 0)
  if (!alvoObra && ancora) {
    const presa = ancora
    const naColeiraObra = obras.filter(
      (item) =>
        !nossa(item) &&
        item.hp > 0 &&
        Math.hypot(item.x - presa.x, item.z - presa.z) <= PARTIDA.acquireAliado,
    )
    const idColeira = maisPerto(unidade.x, unidade.z, naColeiraObra)
    alvoObra = idColeira === null ? undefined : obras.find((item) => item.id === idColeira && item.hp > 0)
  }
  if (!alvoObra) {
    // Nenhum candidato dentro da coleira. Se ainda há alvo no olho, mas todos fora dela, a tropa segura onde está
    // e conserva a âncora (sem isso a perseguição deslizaria). Sem alvo nenhum, a âncora some.
    if (ancoraInicial && (vistos.length > 0 || obrasHostis.length > 0)) return unidade
    return unidade.ancora ? { ...unidade, ancora: null } : unidade
  }
  if (!ancora) ancora = { x: unidade.x, z: unidade.z }
  else if (Math.hypot(alvoObra.x - ancora.x, alvoObra.z - ancora.z) > PARTIDA.acquireAliado) {
    return unidade
  }
  const comObra = { ...unidade, ancora }
  if (emAlcanceDeObra(state, unidade, alvoObra, spec)) return comObra
  const peri = aproximacaoDaObra(alvoObra, unidade.x, unidade.z)
  return avancarRota(
    comObra,
    peri.x,
    peri.z,
    spec.vel,
    dt,
    obras,
    state.tempo,
    versao,
    bloqueios,
    'vivo',
    state.lagoas,
    blocosMapa,
  )
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
  let blocosMapa = state.blocosMapa
  let mudouBlocoMapa = false
  let quebrouBlocoMapa = false

  const vivo = (id: number) => unidades.find((unidade) => unidade.id === id && unidade.hp > 0)
  const obraInimigaViva = (id: number) => obras.find((obra) => obra.id === id && !nossa(obra) && obra.hp > 0)
  const blocoMaisProximo = (px: number, pz: number): BlocoMundo | null => {
    let melhor: BlocoMundo | null = null
    let melhorDist = Number.POSITIVE_INFINITY
    for (const b of Object.values(blocosMapa)) {
      if (b.hp <= 0 || b.lado !== 'nosso' || b.y > 1) continue
      const d = Math.hypot(px - b.x, pz - b.z)
      if (d < melhorDist) {
        melhorDist = d
        melhor = b
      }
    }
    return melhor
  }

  unidades = unidades.map((unidade) => {
    if (unidade.hp <= 0) return unidade
    if (state.posse && unidade.id === state.posse.unidadeId) return unidade
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
      const ido = avancarRota(
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
        state.lagoas,
        blocosMapa,
      )
      if (ido.rota?.semCaminho) {
        const muro = blocoMaisProximo(unidade.x, unidade.z)
        if (muro) return { ...moverUnidade(ido, muro.x, muro.z, PARTIDA.enemySpeed, dt, obras, state.lagoas, blocosMapa), alerta: true }
      }
      return { ...ido, alerta: true }
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
          state.lagoas,
          blocosMapa,
        )
        if (!ido.rota?.semCaminho) return registrarTrilha(unidade, ido)
        const muro = blocoMaisProximo(unidade.x, unidade.z)
        const solidos = obras.filter((obra) => nossa(obra) && obra.hp > 0 && obra.tipo !== 'portao')
        const id = maisPerto(unidade.x, unidade.z, solidos)
        const alvoObra = solidos.find((obra) => obra.id === id)
        if (muro && (!alvoObra || Math.hypot(muro.x - unidade.x, muro.z - unidade.z) <= Math.hypot(alvoObra.x - unidade.x, alvoObra.z - unidade.z))) {
          return registrarTrilha(unidade, moverUnidade(ido, muro.x, muro.z, PARTIDA.enemySpeed, dt, obras, state.lagoas, blocosMapa))
        }
        if (!alvoObra) return registrarTrilha(unidade, ido)
        return registrarTrilha(unidade, moverUnidade(ido, alvoObra.x, alvoObra.z, PARTIDA.enemySpeed, dt, obras, state.lagoas, blocosMapa))
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
        avancarRota(unidade, alvo.x, alvo.z, PARTIDA.enemySpeed, dt, obras, state.tempo, versao, bloqueios, 'vivo', state.lagoas, blocosMapa),
      )
    }
    if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'mover') {
      return avancarRota(
        unidade,
        unidade.ordem.x,
        unidade.ordem.z,
        specDeTropa(unidade, state.upgradesEra).vel,
        dt,
        obras,
        state.tempo,
        versao,
        bloqueios,
        'fixo',
        state.lagoas,
        blocosMapa,
      )
    }
    if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacarObra') {
      const spec = specDeTropa(unidade, state.upgradesEra)
      let alvoObra = obraInimigaViva(unidade.ordem.obraId)
      let ordem: Ordem | null = unidade.ordem
      let rota = unidade.rota
      if (!alvoObra) {
        const obrasHostis = obras.filter((item) => !nossa(item) && item.hp > 0 && cobertoAgora(state, item.x, item.z))
        const proxId = maisPerto(unidade.x, unidade.z, obrasHostis)
        alvoObra = proxId === null ? undefined : obraInimigaViva(proxId)
        if (!alvoObra) return encerrarOrdemDeAtaque(unidade)
        ordem = { tipo: 'atacarObra', obraId: alvoObra.id }
        rota = null
      }
      if (emAlcanceDeObra(state, unidade, alvoObra, spec)) {
        return { ...unidade, ordem, rota }
      }
      const peri = aproximacaoDaObra(alvoObra, unidade.x, unidade.z)
      return avancarRota(
        { ...unidade, ordem, rota },
        peri.x,
        peri.z,
        spec.vel,
        dt,
        obras,
        state.tempo,
        versao,
        bloqueios,
        'vivo',
        state.lagoas,
        blocosMapa,
      )
    }
    if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacar') {
      const spec = specDeTropa(unidade, state.upgradesEra)
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
          if (obraId === null) return encerrarOrdemDeAtaque(unidade)
          return { ...unidade, ordem: { tipo: 'atacarObra', obraId }, rota: null }
        }
        ordem = { tipo: 'atacar', alvoId: alvo.id }
        rota = null
      }
      if (emAlcanceDeUnidade(state, unidade, alvo, spec)) {
        return { ...unidade, ordem, rota }
      }
      return avancarRota(
        { ...unidade, ordem, rota },
        alvo.x,
        alvo.z,
        spec.vel,
        dt,
        obras,
        state.tempo,
        versao,
        bloqueios,
        'vivo',
        state.lagoas,
        blocosMapa,
      )
    }
    if (unidade.postura === 'ordens' && (unidade.ordem?.tipo === 'patrulhar' || unidade.ordem?.tipo === 'attackMove')) {
      const spec = specDeTropa(unidade, state.upgradesEra)
      const baseEngaj = unidade.ancora ?? null
      const inimigos = unidades.filter((item) => item.lado === 'inimigo' && item.hp > 0 && item.papel !== 'isca')
      const vistos = inimigos.filter(
        (item) =>
          Math.hypot(item.x - unidade.x, item.z - unidade.z) <= PARTIDA.visao.tropa &&
          visaoLivreNoEstado(state, unidade.x, unidade.z, cotaVisaoHeroiBlocos(0), item.x, item.z, 0),
      )
      const cands = baseEngaj
        ? vistos.filter((item) => Math.hypot(item.x - baseEngaj.x, item.z - baseEngaj.z) <= PARTIDA.acquireAliado)
        : vistos
      const alvoId = maisPerto(unidade.x, unidade.z, cands)
      const alvo = alvoId === null ? undefined : inimigos.find((item) => item.id === alvoId)
      if (alvo) {
        const ancora = baseEngaj ?? { x: unidade.x, z: unidade.z }
        const comAncora = { ...unidade, ancora }
        if (emAlcanceDeUnidade(state, unidade, alvo, spec)) return comAncora
        return avancarRota(comAncora, alvo.x, alvo.z, spec.vel, dt, obras, state.tempo, versao, bloqueios, 'vivo', state.lagoas, blocosMapa)
      }
      const obrasHostis = obras.filter(
        (item) =>
          !nossa(item) &&
          item.hp > 0 &&
          cobertoAgora(state, item.x, item.z) &&
          Math.hypot(item.x - unidade.x, item.z - unidade.z) <= PARTIDA.visao.tropa &&
          visaoLivreNoEstado(state, unidade.x, unidade.z, cotaVisaoHeroiBlocos(0), item.x, item.z, 0),
      )
      const candsObra = baseEngaj
        ? obrasHostis.filter((item) => Math.hypot(item.x - baseEngaj.x, item.z - baseEngaj.z) <= PARTIDA.acquireAliado)
        : obrasHostis
      const obraId = maisPerto(unidade.x, unidade.z, candsObra)
      const alvoObra = obraId === null ? undefined : obras.find((item) => item.id === obraId && item.hp > 0)
      if (alvoObra) {
        const ancora = baseEngaj ?? { x: unidade.x, z: unidade.z }
        const comObra = { ...unidade, ancora }
        if (emAlcanceDeObra(state, unidade, alvoObra, spec)) return comObra
        const peri = aproximacaoDaObra(alvoObra, unidade.x, unidade.z)
        return avancarRota(comObra, peri.x, peri.z, spec.vel, dt, obras, state.tempo, versao, bloqueios, 'vivo', state.lagoas, blocosMapa)
      }
      const retomando = unidade.ancora ? { ...unidade, ancora: null } : unidade
      if (retomando.ordem?.tipo === 'patrulhar') {
        const p = retomando.ordem
        const alvoX = p.indoPara === 'b' ? p.bx : p.ax
        const alvoZ = p.indoPara === 'b' ? p.bz : p.az
        if (Math.hypot(alvoX - retomando.x, alvoZ - retomando.z) < 1.1) {
          const proxSentido = p.indoPara === 'b' ? ('a' as const) : ('b' as const)
          const proxX = proxSentido === 'b' ? p.bx : p.ax
          const proxZ = proxSentido === 'b' ? p.bz : p.az
          return avancarRota(
            { ...retomando, ordem: { ...p, indoPara: proxSentido }, rota: null },
            proxX,
            proxZ,
            spec.vel,
            dt,
            obras,
            state.tempo,
            versao,
            bloqueios,
            'fixo',
            state.lagoas,
            blocosMapa,
          )
        }
        return avancarRota(retomando, alvoX, alvoZ, spec.vel, dt, obras, state.tempo, versao, bloqueios, 'fixo', state.lagoas, blocosMapa)
      }
      if (retomando.ordem?.tipo === 'attackMove') {
        if (Math.hypot(retomando.ordem.x - retomando.x, retomando.ordem.z - retomando.z) < 0.9) {
          return encerrarOrdemDeAtaque(retomando)
        }
        return avancarRota(
          retomando,
          retomando.ordem.x,
          retomando.ordem.z,
          spec.vel,
          dt,
          obras,
          state.tempo,
          versao,
          bloqueios,
          'fixo',
          state.lagoas,
          blocosMapa,
        )
      }
    }
    if (unidade.postura === 'vigia' || unidade.postura === 'automatico' || unidade.postura === 'noLugar' || unidade.postura === 'calado') {
      return passoVigiaUnidade(state, unidade, unidades, obras, dt, bloqueios, versao, blocosMapa)
    }
    return unidade
  })

  unidades = separarAliados(unidades, obras, state.recursos, dt, blocosMapa)

  const fere = (id: number, dano: number) => {
    unidades = unidades.map((unidade) => (unidade.id === id ? fereDragaoOuCorpo(unidade, dano) : unidade))
  }
  const fereObra = (id: number, dano: number) => {
    obras = obras.map((obra) => (obra.id === id ? aplicarDanoObra(obra, dano) : obra))
  }
  const fereBloco = (bloco: BlocoMundo, dano: number) => {
    const k = chaveBlocoMundo(bloco.x, bloco.y, bloco.z)
    const atual = blocosMapa[k]
    if (!atual || atual.hp <= 0) return
    if (!mudouBlocoMapa) {
      blocosMapa = { ...blocosMapa }
      mudouBlocoMapa = true
    }
    const novoHp = Math.max(0, atual.hp - dano)
    if (novoHp <= 0) {
      delete blocosMapa[k]
      quebrouBlocoMapa = true
    } else {
      blocosMapa[k] = { ...atual, hp: novoHp }
    }
  }

  const agressores = new Set<number>()
  for (const unidade of unidades) {
    if (unidade.hp <= 0 || unidade.cooldown > 0) continue
    if (state.posse && unidade.id === state.posse.unidadeId) continue
    if (unidade.lado === 'aliado') {
      const spec = specDeTropa(unidade, state.upgradesEra)
      const tipoAtacante = unidade.tipoTropa ?? 'soldado'
      if (unidade.postura === 'calado') continue
      if (unidade.postura === 'noLugar') {
        const inimigosParados = unidades.filter(
          (item) => item.lado === 'inimigo' && item.hp > 0 && Math.hypot(item.x - unidade.x, item.z - unidade.z) <= spec.alcance,
        )
        const paradoId = maisPerto(unidade.x, unidade.z, inimigosParados)
        const parado = paradoId === null ? undefined : unidades.find((item) => item.id === paradoId && item.hp > 0)
        if (parado && emAlcanceDeUnidade(state, unidade, parado, spec)) {
          fere(parado.id, spec.danoBase * multiplicadorTrianguloAoE(tipoAtacante, parado.papel))
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
        }
        continue
      }
      if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacarObra') {
        const alvoObra = obraInimigaViva(unidade.ordem.obraId)
        if (alvoObra && emAlcanceDeObra(state, unidade, alvoObra, spec)) {
          fereObra(alvoObra.id, spec.danoOrdem)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
        }
        continue
      }
      let alvoId: number | null = null
      const emBuscaAtiva =
        unidade.postura === 'automatico' ||
        unidade.postura === 'vigia' ||
        (unidade.postura === 'ordens' && (unidade.ordem?.tipo === 'patrulhar' || unidade.ordem?.tipo === 'attackMove'))
      if (unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacar') alvoId = unidade.ordem.alvoId
      if (emBuscaAtiva) {
        const inimigos = unidades.filter((item) => item.lado === 'inimigo' && item.hp > 0)
        alvoId = maisPerto(unidade.x, unidade.z, inimigos.filter((item) => Math.hypot(item.x - unidade.x, item.z - unidade.z) <= spec.alcance + 0.2))
      }
      if (alvoId !== null) {
        const alvo = unidades.find((item) => item.id === alvoId && item.hp > 0)
        if (alvo && emAlcanceDeUnidade(state, unidade, alvo, spec)) {
          const base = unidade.postura === 'ordens' ? spec.danoOrdem : spec.danoBase
          const dano = base * multiplicadorTrianguloAoE(tipoAtacante, alvo.papel)
          fere(alvo.id, dano)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
          continue
        }
      }
      if (emBuscaAtiva) {
        const obrasEmContato = obras.filter((item) => !nossa(item) && item.hp > 0 && emAlcanceDeObra(state, unidade, item, spec))
        const obraId = maisPerto(unidade.x, unidade.z, obrasEmContato)
        if (obraId !== null) {
          fereObra(obraId, unidade.postura === 'ordens' ? spec.danoOrdem : spec.danoBase)
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
          agressores.add(unidade.id)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
          continue
        }
        const obraNoCaminho = obras.find((obra) => nossa(obra) && obra.hp > 0 && emContatoComObra(unidade.x, unidade.z, obra))
        if (obraNoCaminho) {
          fereObra(obraNoCaminho.id, PARTIDA.danoSitio)
          agressores.add(unidade.id)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
          continue
        }
        const blocoBloqueando = unidade.rota?.semCaminho ? blocoNossoAdjacente(unidade.x, unidade.z, blocosMapa) : null
        if (blocoBloqueando) {
          fereBloco(blocoBloqueando, PARTIDA.danoSitio)
          unidades = unidades.map((item) =>
            item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
          )
        }
        continue
      }
      const tocadas = obras.filter((item) => nossa(item) && item.hp > 0 && emContatoComObra(unidade.x, unidade.z, item))
      const obraId = maisPerto(unidade.x, unidade.z, tocadas)
      if (obraId !== null) {
        fereObra(obraId, PARTIDA.danoSitio)
        agressores.add(unidade.id)
        unidades = unidades.map((item) =>
          item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
        )
        continue
      }
      const blocoAdj = unidade.rota?.semCaminho ? blocoNossoAdjacente(unidade.x, unidade.z, blocosMapa) : null
      if (blocoAdj) {
        fereBloco(blocoAdj, PARTIDA.danoSitio)
        unidades = unidades.map((item) =>
          item.id === unidade.id ? { ...item, cooldown: PARTIDA.golpeCooldown } : item,
        )
      }
    }
  }

  const jaAlvo = new Set<number>()
  const idsTorres = obras.filter((obra) => obra.tipo === 'torre').map((obra) => obra.id)
  for (const torreId of idsTorres) {
    const torre = obras.find((item) => item.id === torreId)
    if (!torre || torre.tipo !== 'torre' || torre.hp <= 0 || torre.cooldown > 0 || obraEmConstrucao(torre)) continue
    const alcance = alcanceDaTorre(torre)
    const danoTorre = danoDaTorreNoNivel(torre.nivel)
    const cotaTorre = cotaVisaoTorreBlocos(torre.nivel)

    // 1º: Prioridade tática máxima — abater em 1 tiro qualquer construção rival ainda em andaime no alcance (respeitando LoS 2.5D)!
    let andaimeId: number | null = null
    let melhorAndaime = alcance
    for (const rival of obras) {
      const hostil = torre.lado === 'inimigo' ? nossa(rival) : !nossa(rival)
      if (!hostil || !obraEmConstrucao(rival)) continue
      if (torre.lado !== 'inimigo' && !cobertoAgora(state, rival.x, rival.z)) continue
      if (!visaoLivreNoEstado(state, torre.x, torre.z, cotaTorre, rival.x, rival.z, 0)) continue
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

    // 2º: Unidades hostis vivas (e herói presente para torre inimiga), respeitando LoS 2.5D por altura da torre
    let melhor = alcance
    let id: number | null = null
    for (const item of unidades) {
      const hostil = torre.lado === 'inimigo' ? item.lado === 'aliado' : item.lado === 'inimigo'
      if (!hostil || item.hp <= 0 || jaAlvo.has(item.id)) continue
      for (const ponto of pontosDoCorpo(item)) {
        const dist = Math.hypot(ponto.x - torre.x, ponto.z - torre.z)
        if (dist <= alcance && dist <= melhor && visaoLivreNoEstado(state, torre.x, torre.z, cotaTorre, ponto.x, ponto.z, 0)) {
          melhor = dist
          id = item.id
        }
      }
    }
    if (
      torre.lado === 'inimigo' &&
      !state.semCorpo &&
      state.heroi.y >= -0.9 &&
      army > 0 &&
      (state.heroi.invulneravelRestante ?? 0) <= 0 &&
      !jaAlvo.has(-1)
    ) {
      const dist = Math.hypot(state.heroi.x - torre.x, state.heroi.z - torre.z)
      if (dist <= alcance && dist <= melhor && visaoLivreNoEstado(state, torre.x, torre.z, cotaTorre, state.heroi.x, state.heroi.z, state.heroi.y)) {
        id = -1
      }
    }
    if (id !== null) {
      jaAlvo.add(id)
      // A vida do HERÓI é um inteiro (`clampVidaPartida` faz `floor`, o HUD mostra o número exato). O dano da torre agora é fracionário a partir do nível 3 (13,5), e `army − 13,5` com `floor` já tiraria 14 por acaso
      // do arredondamento: o `ceil` explícito diz a regra em voz alta (um golpe nunca tira «meio ponto» a menos) e não depende do `floor` de outra função. Unidades e obras têm vida fracionária: o dano vale inteiro.
      if (id === -1) {
        army = clampVidaPartida(army - aplicarReducaoHeroi(Math.ceil(danoTorre), state.heroi.classe))
      } else {
        const alvoUn = unidades.find((u) => u.id === id)
        const mult =
          torre.lado === 'inimigo' && alvoUn?.lado === 'aliado' && alvoUn.tipoTropa
            ? multiplicadorTrianguloAoE('torre', alvoUn.tipoTropa)
            : 1
        fere(id, danoTorre * mult)
      }
      obras = obras.map((item) => (item.id === torre.id ? { ...item, cooldown: PARTIDA.torreCooldown } : item))
      continue
    }

    // 3º: Duelo entre construções — se não houver unidade hostil no alcance, alvejar a construção rival viva com LoS livre!
    let obraRivalId: number | null = null
    let melhorObra = alcance
    for (const rival of obras) {
      const hostil = torre.lado === 'inimigo' ? nossa(rival) : !nossa(rival)
      if (!hostil || rival.hp <= 0) continue
      if (torre.lado !== 'inimigo' && !cobertoAgora(state, rival.x, rival.z)) continue
      if (!visaoLivreNoEstado(state, torre.x, torre.z, cotaTorre, rival.x, rival.z, 0)) continue
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

  if (agressores.size > 0) {
    unidades = unidades.map((unidade) => {
      if (unidade.lado !== 'aliado' || unidade.hp <= 0) return unidade
      if (unidade.postura === 'calado' || unidade.postura === 'noLugar') return unidade
      if (unidade.ordem) return unidade
      if (unidade.postura !== 'vigia' && unidade.postura !== 'automatico' && unidade.postura !== 'ordens') return unidade
      // Quem cumpre ordem volta à base que o jogador escolheu. Se a base é calado ou no lugar, o alarme não a desfaz.
      if (unidade.postura === 'ordens' && (unidade.posturaBase === 'calado' || unidade.posturaBase === 'noLugar')) return unidade
      const visto = unidades.find(
        (ag) =>
          agressores.has(ag.id) &&
          ag.hp > 0 &&
          Math.hypot(ag.x - unidade.x, ag.z - unidade.z) <= PARTIDA.visao.tropa &&
          visaoLivreNoEstado(state, unidade.x, unidade.z, cotaVisaoHeroiBlocos(0), ag.x, ag.z, 0),
      )
      if (!visto) return unidade
      return {
        ...unidade,
        postura: unidade.postura === 'ordens' ? ('vigia' as const) : unidade.postura,
        posturaBase: unidade.postura === 'ordens' ? (unidade.posturaBase ?? 'vigia') : unidade.posturaBase,
        ancora: unidade.ancora ?? { x: unidade.x, z: unidade.z },
      }
    })
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
    blocosMapa,
    heroi: army === state.heroi.army ? state.heroi : { ...state.heroi, army },
    versaoSolidos: state.versaoSolidos + (morreuSolido || quebrouBlocoMapa ? 1 : 0),
    versaoRecursos: state.versaoRecursos + (quebrouBlocoMapa ? 1 : 0),
  }
}

function passoOnda(state: PartidaState, dt: number): PartidaState {
  const inimigo = nucleoInimigo(state.obras)
  // Só a metade INIMIGA da condição continua: sem base inimiga não há de onde a onda sair. A metade «sem núcleo seu» SAIU (22/11, pedido do usuário): o inimigo evolui mesmo num mapa onde
  // ninguém fundou base, e quando alguém chega encontra uma base maior e um exército (a dificuldade cresce com o tempo). Para onde a leva sai: `alvoDaSaida`.
  if (!inimigo) return state.ondaRelogio === 0 ? state : { ...state, ondaRelogio: 0 }
  let relogio = state.ondaRelogio + dt
  if (state.ondaNumero === 0 && PARTIDA.atrasoPrimeiraLevaNucleoConstrucao) {
    const nossoEmConstrucao = state.obras.some((o) => nossa(o) && o.tipo === 'nucleo' && o.hp > 0 && obraEmConstrucao(o))
    const temNucleoPronto = state.obras.some((o) => nossa(o) && o.tipo === 'nucleo' && o.hp > 0 && !obraEmConstrucao(o))
    if (nossoEmConstrucao && !temNucleoPronto) {
      relogio = Math.min(relogio, PARTIDA.ondaPeriodo - 1)
    }
  }
  if (relogio < PARTIDA.ondaPeriodo) return { ...state, ondaRelogio: relogio }
  if (vivosInimigos(state).length >= PARTIDA.enemyCap) return { ...state, ondaRelogio: 0 }
  const numero = state.ondaNumero + 1
  const dragao = numero % 3 === 0 && numero !== 1
  if (dragao) return crescerBaseInimiga(nascerDragaoDaLeva({ ...state, ondaRelogio: 0, ondaNumero: numero }), numero)
  const saida = saidaDaBase(inimigo, alvoDaSaida(state, inimigo))
  const quantidade = quantidadeDaLeva(numero)
  const bloqueios = bloqueiosDe(state)
  const hp = vidaDaLeva(numero, fatorDoEstado(state))
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
  const nucleoVivoLocal = nucleoNosso(state.obras) !== undefined
  const temAlgumNucleoVivo = nucleoVivoLocal || state.outraBaseViva === true
  if (state.heroi.army <= 0) {
    const outroVivo = state.herois?.find((h) => h.id !== (state.heroiAtivoId ?? 0) && h.vivo && h.army > 0)
    if (outroVivo) {
      const comMorto = sincronizarHerois(state)
      return selecionarHeroiAtivo(comMorto, outroVivo.id)
    }
    if (temAlgumNucleoVivo) {
      const jaCaido = state.heroiCaido === true
      return {
        ...state,
        heroiCaido: true,
        mortesHeroi: jaCaido ? (state.mortesHeroi ?? 1) : (state.mortesHeroi ?? 0) + 1,
        heroiOrdem: null,
        olhar: 'imperio',
      }
    }
    return { ...state, derrota: true }
  }
  const nucleoAntes = nucleoNosso(antes.obras, false)
  const nucleo = nucleoNosso(state.obras, false)
  const caiuAgora = nucleoAntes !== undefined && nucleoAntes.hp > 0 && nucleo !== undefined && nucleo.hp <= 0
  if (!caiuAgora) return state
  // Com outra base nossa viva em outro mapa (o atlas escreve `outraBaseViva`), perder ESTA não encerra o jogo: só cai a ÚLTIMA base.
  if (state.outraBaseViva === true) return state
  return { ...state, derrota: true }
}

function passoPosse(state: PartidaState, input: PartidaInput, dt: number): PartidaState {
  if (!state.posse) return state
  const alvo = state.unidades.find((u) => u.id === state.posse!.unidadeId && u.lado === 'aliado' && u.hp > 0)
  if (!alvo) {
    return {
      ...state,
      posse: null,
      ...(state.semCorpo ? {} : { olhar: 'imperio' as const }),
    }
  }
  const shootCooldown = Math.max(0, state.posse.shootCooldown - dt)
  if (state.olhar === 'imperio') {
    return { ...state, posse: { ...state.posse, shootCooldown } }
  }
  const analogico = typeof input.eixoX === 'number' || typeof input.eixoY === 'number'
  const drive = analogico
    ? Math.max(-1, Math.min(1, input.eixoY ?? 0))
    : (input.forward ? 1 : 0) - (input.back ? 1 : 0)
  const lado = analogico ? Math.max(-1, Math.min(1, input.eixoX ?? 0)) : input.strafe
  const yaw = state.posse.yaw
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
  const spec = specDeTropa(alvo, state.upgradesEra)
  const fatorAgua = emAguaRasa(state.lagoas, alvo.x, alvo.z, state.posse.y) ? PARTIDA.aguaFatorVelocidade : 1
  const dist = spec.vel * fatorAgua * dt
  const x1 = alvo.x + mx * dist
  const z1 = alvo.z + mz * dist
  const pos = escorrega(
    alvo.x,
    alvo.z,
    x1,
    z1,
    state.obras,
    PARTIDA.atlas === 'grade',
    state.posse.y,
    state.recursos,
    state.subsoloCentro,
    state.blocosMapa,
  )
  const clamped = puxaLimite(pos.x, pos.z)
  const queda = cair(
    state.posse.y,
    state.posse.vy,
    clamped.x,
    clamped.z,
    state.pedraNoChao,
    state.obras,
    state.recursos,
    state.subsoloCentro,
    dt,
    state.blocosMapa,
  )
  return {
    ...state,
    posse: { ...state.posse, y: queda.y, vy: queda.vy, shootCooldown },
    unidades: state.unidades.map((u) =>
      u.id === alvo.id ? { ...u, x: clamped.x, z: clamped.z, ordem: null, rota: null } : u,
    ),
  }
}

function liberarPosseSeMorreu(state: PartidaState): PartidaState {
  if (!state.posse) return state
  const viva = state.unidades.some((u) => u.id === state.posse!.unidadeId && u.lado === 'aliado' && u.hp > 0)
  if (viva) return state
  return {
    ...state,
    posse: null,
    ...(state.semCorpo ? {} : { olhar: 'imperio' as const }),
  }
}

function passoCurto(state: PartidaState, input: PartidaInput, dt: number): PartidaState {
  let atual = passoHeroi(state, state.posse ? VAZIO : input, dt)
  atual = passoPosse(atual, input, dt)
  atual = portoesConstruidos(atual)
  atual = altarNoPasso(atual)
  atual = passoFilasProducao(atual, dt)
  atual = passoHeroisECons(atual, dt)
  atual = passoUnidades(atual, dt)
  atual = liberarPosseSeMorreu(atual)
  atual = danoHordaNoHeroi(atual)
  atual = danoContatoInimigosNoHeroi(atual, dt)
  atual = passoOnda(atual, dt)

  const serrarias = atual.obras.filter(
    (o) => nossa(o) && o.tipo === 'serraria' && o.hp > 0 && !obraEmConstrucao(o),
  )
  const minas = atual.obras.filter(
    (o) => nossa(o) && o.tipo === 'mina' && o.hp > 0 && !obraEmConstrucao(o),
  )
  const eco = passoRecursosNaturais(atual.recursos, serrarias, minas, atual.relogioExtracao, dt, atual.restoExtracao)

  atual = {
    ...atual,
    tempo: atual.tempo + dt,
    recursos: eco.recursos,
    madeira: atual.madeira + eco.ganhoMadeira,
    ouro: atual.ouro + eco.ganhoOuro,
    relogioExtracao: eco.relogioExtracao,
    restoExtracao: eco.restos,
    versaoRecursos: eco.mudouMalha ? atual.versaoRecursos + 1 : atual.versaoRecursos,
    heroi: {
      ...atual.heroi,
      shootCooldown: Math.max(0, atual.heroi.shootCooldown - dt),
      invulneravelRestante: Math.max(0, (atual.heroi.invulneravelRestante ?? 0) - dt),
    },
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
