import { encontrarCaminho } from '../caminho'
import { danoDaTorreNoNivel } from '../evolucaoObra'
import { chaveBlocoMundo, criarBlocoMundo, type MapaBlocos } from '../blocosMundo'
import { PARTIDA, SPEC_HEROI } from '../partidaPolicies'
import {
  abrirAltar,
  atirar,
  chaoRevelado,
  cobertoAgora,
  createPartida,
  fundar,
  inimigoVisivel,
  INPUT_PARADO,
  marcarChao,
  ordenar,
  ordenarHeroi,
  podeConsagrarEm,
  podeFundarEm,
  stepPartida,
  yawAte,
  type Obra,
  type PartidaState,
  type Unidade,
} from '../partidaSim'
import { poligonaisDosRiosNoQuadrado } from './aguaDoMundo'
import { alturaEm, LADO_RELEVO, MEIA_RELEVO, transitavelEm, type CampoRelevo } from './campoRelevo'
import { pontoEmRio } from './regrasDoRelevo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function criarCampoPlano(altura = 0, i = 0, j = 0): CampoRelevo {
  return {
    i,
    j,
    alturas: new Float32Array(LADO_RELEVO * LADO_RELEVO).fill(altura),
    nivelAgua: -0.075,
    versao: 1,
  }
}

function criarCampo(fn: (gx: number, gz: number) => number, i = 0, j = 0): CampoRelevo {
  const alturas = new Float32Array(LADO_RELEVO * LADO_RELEVO)
  for (let gz = -MEIA_RELEVO; gz <= MEIA_RELEVO; gz += 1) {
    for (let gx = -MEIA_RELEVO; gx <= MEIA_RELEVO; gx += 1) {
      alturas[(gz + MEIA_RELEVO) * LADO_RELEVO + (gx + MEIA_RELEVO)] = fn(gx, gz)
    }
  }
  return { i, j, alturas, nivelAgua: -0.075, versao: 1 }
}

function limparArena(base: PartidaState, campo?: CampoRelevo, extras?: Partial<PartidaState>): PartidaState {
  const estado: PartidaState = {
    ...base,
    obras: [],
    unidades: [],
    recursos: [],
    lagoas: [],
    blocosMapa: {},
    ...(campo !== undefined ? { campoRelevo: campo } : {}),
    ...extras,
  }
  if (campo === undefined) {
    delete (estado as { campoRelevo?: CampoRelevo }).campoRelevo
  }
  return estado
}

function unidadeSimples(id: number, lado: 'aliado' | 'inimigo', x: number, z: number, hp = 100): Unidade {
  return {
    id,
    lado,
    papel: lado === 'aliado' ? 'tropa' : 'horda',
    x,
    z,
    hp,
    postura: lado === 'aliado' ? 'calado' : 'automatico',
    ordem: null,
    cooldown: 0,
    segmentos: [],
    alerta: false,
  }
}

export async function run(): Promise<void> {
  // Ponto real de rio dentro de (-1, 0)
  const poligonais = poligonaisDosRiosNoQuadrado(-1, 0)
  assert(poligonais.length > 0 && poligonais[0].length >= 2, '(-1, 0) possui rio para teste de regra')
  let rx = 0
  let rz = 0
  let ryaw = 0
  let achouRio = false
  for (const pts of poligonais) {
    for (let k = 0; k + 1 < pts.length; k += 1) {
      const lx = pts[k].X - -1 * 112
      const lz = pts[k].Z
      if (lx >= -45 && lx <= 45 && lz >= -45 && lz <= 45 && pontoEmRio(-1, 0, lx, lz)) {
        rx = lx
        rz = lz
        ryaw = yawAte(lx, lz, pts[k + 1].X - -1 * 112, pts[k + 1].Z)
        achouRio = true
        break
      }
    }
    if (achouRio) break
  }
  assert(achouRio, 'achou ponto local em rio no quadrado (-1, 0)')

  // 1. I1: createPartida(-1, 0) sem campoRelevo preserva velocidade normal sobre rio
  const baseRioSemCampo = limparArena(createPartida(-1, 0), undefined, {
    heroi: { ...createPartida(-1, 0).heroi, x: rx, z: rz, yaw: ryaw, pitch: 0 },
  })
  const passoSemCampo = stepPartida(baseRioSemCampo, { forward: true, back: false, strafe: 0 }, 0.2)
  const distSemCampo = Math.hypot(passoSemCampo.heroi.x - rx, passoSemCampo.heroi.z - rz)
  assert(
    Math.abs(distSemCampo - PARTIDA.heroSpeed * 0.2) < 1e-4,
    `I1: sem campoRelevo o herói não sofre lentidão no rio (esperado ${PARTIDA.heroSpeed * 0.2}, veio ${distSemCampo})`,
  )

  // 2. F3a (rio ativo): com campoRelevo em (-1, 0), herói e tropa desaceleram para 0.55x e A* encarece rio
  const campoRioPlano = criarCampoPlano(0, -1, 0)
  const baseRioAtivo = limparArena(createPartida(-1, 0), campoRioPlano, {
    heroi: { ...createPartida(-1, 0).heroi, x: rx, z: rz, yaw: ryaw, pitch: 0 },
  })
  const passoNoRio = stepPartida(baseRioAtivo, { forward: true, back: false, strafe: 0 }, 0.2)
  const distNoRio = Math.hypot(passoNoRio.heroi.x - rx, passoNoRio.heroi.z - rz)
  assert(
    Math.abs(distNoRio / distSemCampo - PARTIDA.aguaFatorVelocidade) < 0.02,
    `F3a: rio ativo aplica fator ${PARTIDA.aguaFatorVelocidade}× no herói (veio ${distNoRio / distSemCampo})`,
  )

  const ux = rx
  const uz = rz
  const dirZ = Math.cos(ryaw)
  const dirX = -Math.sin(ryaw)
  const tropaNoRio = unidadeSimples(50, 'aliado', ux, uz, 40)
  const sTropaRio = ordenar(
    limparArena(createPartida(-1, 0), campoRioPlano, { semCorpo: true, unidades: [tropaNoRio] }),
    [50],
    { tipo: 'mover', x: ux + dirX * 10, z: uz + dirZ * 10 },
  )
  const sTropaRioAnda = stepPartida(sTropaRio, INPUT_PARADO, 0.2)
  const uDepois = sTropaRioAnda.unidades[0]
  const distTropaRio = Math.hypot(uDepois.x - ux, uDepois.z - uz)
  assert(
    Math.abs(distTropaRio - PARTIDA.allySpeed * PARTIDA.aguaFatorVelocidade * 0.2) < 0.15,
    `F3a: rio ativo desacelera tropa aliada (${distTropaRio})`,
  )

  // 3. F3a (penhasco > 0.75): bloqueia escorrega no stepPartida e A* contorna / falha quando cercado
  const penhasco = criarCampo((gx) => (gx <= 2 ? 0 : Math.min(18, (gx - 2) * 1.4)))
  const sPenhasco = limparArena(createPartida(), penhasco, {
    heroi: { ...createPartida().heroi, x: 0, z: 0, yaw: -Math.PI / 2, pitch: 0 },
  })
  let sAndouPenhasco = sPenhasco
  for (let i = 0; i < 10; i += 1) {
    sAndouPenhasco = stepPartida(sAndouPenhasco, { forward: true, back: false, strafe: 0 }, 0.2)
  }
  assert(
    transitavelEm(penhasco, sAndouPenhasco.heroi.x, sAndouPenhasco.heroi.z) && sAndouPenhasco.heroi.x < 3.5,
    `F3a: penhasco bloqueia escorrega do herói (x=${sAndouPenhasco.heroi.x})`,
  )

  const muroComBrecha = criarCampo((gx, gz) => (gx >= 4 && gx <= 7 && Math.abs(gz) < 8 ? Math.min(10, (gx - 3) * 1.5) : 0))
  const sBrecha = limparArena(createPartida(), muroComBrecha, {
    olhar: 'imperio',
    heroi: { ...createPartida().heroi, x: 0, z: 0 },
    unidades: [unidadeSimples(60, 'aliado', 0, 2, 40)],
  })
  const hOrdBrecha = ordenarHeroi(sBrecha, { tipo: 'mover', x: 12, z: 0 })
  assert(
    hOrdBrecha.heroiOrdem?.tipo === 'mover' &&
      hOrdBrecha.heroiOrdem.rota?.semCaminho === false &&
      hOrdBrecha.heroiOrdem.rota.marcos.some((m) => Math.abs(m.z) >= 7),
    'F3a: A* do herói contorna parede de penhasco pela brecha lateral',
  )
  const uOrdBrecha = ordenar(sBrecha, [60], { tipo: 'mover', x: 12, z: 0 })
  assert(
    uOrdBrecha.unidades[0].rota?.semCaminho === false &&
      uOrdBrecha.unidades[0].rota.marcos.some((m) => Math.abs(m.z) >= 7),
    'F3a: A* da tropa contorna parede de penhasco pela brecha lateral',
  )

  const cercado = criarCampo((gx, gz) => Math.max(0, (Math.hypot(gx, gz) - 6) * 1.5))
  const sCercado = limparArena(createPartida(), cercado, {
    heroi: { ...createPartida().heroi, x: 0, z: 0 },
    unidades: [unidadeSimples(61, 'aliado', 0, 1, 40)],
  })
  const hCercado = ordenarHeroi(sCercado, { tipo: 'mover', x: 20, z: 0 })
  assert(hCercado.heroiOrdem?.tipo === 'mover' && hCercado.heroiOrdem.rota?.semCaminho === true, 'F3a: anel intransitável fecha A* do herói')
  const uCercado = ordenar(sCercado, [61], { tipo: 'mover', x: 20, z: 0 })
  assert(uCercado.unidades[0].rota?.semCaminho === true, 'F3a: anel intransitável fecha A* da tropa')
  assert(
    encontrarCaminho(0, 0, 20, 0, [], undefined, (px, pz) => !transitavelEm(cercado, px, pz)) === null,
    'F3a: encontrarCaminho direto retorna null com bloqueadoExtra intransponível',
  )

  // 4. F3a (abrirAltar): placa fora de zona transitável (sem ponto andável em 2 m) desliga placasAtivas
  const altarPenhasco = criarCampo((gx) => (gx <= 0 ? 0 : gx * 1.5))
  const sAltarPenhasco = limparArena(createPartida(), altarPenhasco, {
    heroi: { ...createPartida().heroi, x: -0.5, z: 0 },
  })
  const aPenhasco = abrirAltar(sAltarPenhasco, 1, 0, true)
  assert(aPenhasco.altar?.placasAtivas === false, 'F3a: abrirAltar desativa placas físicas perto de penhasco intransponível')
  const aPlano = abrirAltar(limparArena(createPartida(), criarCampoPlano(0)), 1, 0, true)
  assert(aPlano.altar?.placasAtivas === true, 'F3a: abrirAltar mantém placas físicas em terreno plano')

  // 5. F3b (obras, plataformas e consagração)
  const decliveForte = criarCampo((gx) => (gx <= 0 ? 0 : gx * 1.4))
  const sObraForte = limparArena(createPartida(), decliveForte, {
    chaoVisto: new Uint8Array(113 * 113).fill(1),
  })
  assert(!podeFundarEm(sObraForte, 'nucleo', 10, 0).ok, 'F3b: podeFundarEm recusa encosta > 0.35')

  const suave = criarCampo((gx) => gx * 0.15)
  const sSuave = limparArena(createPartida(), suave, {
    chaoVisto: new Uint8Array(113 * 113).fill(1),
  })
  assert(podeFundarEm(sSuave, 'nucleo', 10, 0).ok, 'F3b: podeFundarEm aceita encosta <= 0.35')
  const fundado = fundar(sSuave, 'nucleo', 10, 0)
  assert(fundado.obras.some((o) => o.lado === 'nosso' && o.tipo === 'nucleo'), 'F3b: fundar cria a obra')
  assert(
    fundado.campoRelevo?.versao === sSuave.campoRelevo!.versao + 1,
    'F3b: fundar cria plataforma e incrementa campoRelevo.versao',
  )
  assert(
    Math.abs(alturaEm(fundado.campoRelevo, 10, 0) - alturaEm(fundado.campoRelevo, 13, 0)) < 1e-4,
    'F3b: plataforma nivela a altura dentro da pegada da obra',
  )

  const nucleoAliado: Obra = {
    id: 1,
    lado: 'nosso',
    tipo: 'nucleo',
    x: -20,
    z: 0,
    nivel: 1,
    hp: 100,
    maxHp: 100,
    gateApplied: false,
    cooldown: 0,
  }
  const blocosBritador: MapaBlocos = {
    [chaveBlocoMundo(0, 0, 0)]: criarBlocoMundo(0, 0, 0, 'madeira', 'nosso'),
    [chaveBlocoMundo(1, 0, 0)]: criarBlocoMundo(1, 0, 0, 'madeira', 'nosso'),
    [chaveBlocoMundo(2, 0, 0)]: criarBlocoMundo(2, 0, 0, 'madeira', 'nosso'),
    [chaveBlocoMundo(3, 0, 0)]: criarBlocoMundo(3, 0, 0, 'madeira', 'nosso'),
  }
  const campoDesnivel = criarCampo((gx) => (gx < 2 ? 0 : (gx - 1) * 0.6))
  const sConsagraDesnivel = limparArena(createPartida(), campoDesnivel, {
    obras: [nucleoAliado],
    blocosMapa: blocosBritador,
    ouro: 5,
    credito: 2,
  })
  assert(!podeConsagrarEm(sConsagraDesnivel, 0, 0, 0, 'britador').ok, 'F3b: podeConsagrarEm rejeita desnível > 0.6 m')
  const sConsagraPlano = { ...sConsagraDesnivel, campoRelevo: criarCampoPlano(0) }
  assert(podeConsagrarEm(sConsagraPlano, 0, 0, 0, 'britador').ok, 'F3b: podeConsagrarEm aceita estrutura em chão plano')

  // 6. F3c (névoa e visibilidade bloqueadas por morro entre observador e alvo)
  const morro = criarCampo((gx, gz) => (Math.hypot(gx, gz) < 4 ? 4.5 - Math.hypot(gx, gz) * 0.5 : 0))
  const iniVis = unidadeSimples(70, 'inimigo', 8, 0, 100)
  const baseVis = limparArena(createPartida(), morro, {
    heroi: { ...createPartida().heroi, x: -8, z: 0 },
    unidades: [iniVis],
    chaoVisto: new Uint8Array(113 * 113),
  })
  const marcadoMorro = marcarChao(baseVis)
  assert(!inimigoVisivel(marcadoMorro, iniVis), 'F3c: morro esconde inimigo em inimigoVisivel')
  assert(!cobertoAgora(marcadoMorro, 8, 0), 'F3c: morro bloqueia cobertoAgora')
  assert(!chaoRevelado(marcadoMorro, 8, 0), 'F3c: morro bloqueia revelação permanente em marcarChao')

  const marcadoPlano = marcarChao({ ...baseVis, campoRelevo: criarCampoPlano(0) })
  assert(inimigoVisivel(marcadoPlano, iniVis), 'F3c: plano mostra inimigo em inimigoVisivel')
  assert(cobertoAgora(marcadoPlano, 8, 0), 'F3c: plano libera cobertoAgora')
  assert(chaoRevelado(marcadoPlano, 8, 0), 'F3c: plano revela chaoRevelado em marcarChao')

  // 7. F3d (combate: bloqueio por morro, +25%/+alcance em alto platô e -25% em terreno baixo, e torre em platô)
  const batedorNoAlvo = unidadeSimples(71, 'aliado', 8, 4, 40)
  const sTiroMorro = marcarChao(
    limparArena(createPartida(), morro, {
      heroi: { ...createPartida().heroi, classe: 'ataque', x: -8, z: 0, yaw: yawAte(-8, 0, 8, 0), pitch: 0 },
      unidades: [iniVis, batedorNoAlvo],
    }),
  )
  const depoisTiroMorro = atirar(sTiroMorro)
  assert(depoisTiroMorro.unidades[0].hp === 100, 'F3d: atirar não atravessa morro entre herói e inimigo')

  const sTiroPlano = { ...sTiroMorro, campoRelevo: criarCampoPlano(0) }
  const depoisTiroPlano = atirar(sTiroPlano)
  assert(
    depoisTiroPlano.unidades[0].hp === 100 - SPEC_HEROI.ataque.danoTiro,
    `F3d: controle no plano causa dano base (${depoisTiroPlano.unidades[0].hp})`,
  )

  // Herói em platô +4 m atira a 19,5 m (> 18 m base, dentro de 20 m) com +25% de dano
  const platoEsq = criarCampo((gx) => (gx <= -5 ? 4 : gx < -1 ? 4 - (gx + 5) : 0))
  const iniDistante = unidadeSimples(72, 'inimigo', 9.5, 0, 100)
  const batedorDist = unidadeSimples(73, 'aliado', 9.5, 4, 40)
  const sAltoDist = limparArena(createPartida(), platoEsq, {
    heroi: { ...createPartida().heroi, classe: 'ataque', x: -10, z: 0, yaw: yawAte(-10, 0, 9.5, 0), pitch: 0 },
    unidades: [iniDistante, batedorDist],
    chaoVisto: new Uint8Array(113 * 113).fill(1),
  })
  const rAltoDist = atirar(sAltoDist)
  const danoEsperadoAlto = Math.round(SPEC_HEROI.ataque.danoTiro * 1.25 * 100) / 100
  assert(
    Math.abs(rAltoDist.unidades[0].hp - (100 - danoEsperadoAlto)) < 1e-4,
    `F3d: herói no alto acerta a 19,5 m e causa +25% (${100 - rAltoDist.unidades[0].hp} vs ${danoEsperadoAlto})`,
  )
  const rPlanoDist = atirar({ ...sAltoDist, campoRelevo: criarCampoPlano(0) })
  assert(rPlanoDist.unidades[0].hp === 100, 'F3d: herói no plano não alcança 19,5 m (> 18 m)')

  // Herói em terreno baixo (0 m) atira em inimigo no platô (+4 m) a 15 m e causa -25%
  const platoDir = criarCampo((gx) => (gx >= 2 ? 4 : gx > -8 ? ((gx + 8) / 10) * 4 : 0))
  const iniAlto = unidadeSimples(74, 'inimigo', 5, 0, 100)
  const sBaixoAtira = limparArena(createPartida(), platoDir, {
    heroi: { ...createPartida().heroi, classe: 'ataque', x: -10, z: 0, yaw: yawAte(-10, 0, 5, 0), pitch: 0 },
    unidades: [iniAlto],
    chaoVisto: new Uint8Array(113 * 113).fill(1),
  })
  const rBaixoAtira = atirar(sBaixoAtira)
  const danoEsperadoBaixo = Math.round(SPEC_HEROI.ataque.danoTiro * 0.75 * 100) / 100
  assert(
    Math.abs(rBaixoAtira.unidades[0].hp - (100 - danoEsperadoBaixo)) < 1e-4,
    `F3d: herói em terreno baixo causa -25% de dano (${100 - rBaixoAtira.unidades[0].hp} vs ${danoEsperadoBaixo})`,
  )

  // Torre aliada nível 1 no platô (+4 m) alcança 23,5 m (> 22 m base, dentro de 24 m) e causa +25% de dano
  const torreAlta: Obra = {
    id: 20,
    lado: 'nosso',
    tipo: 'torre',
    x: -10,
    z: 0,
    nivel: 1,
    hp: 50,
    maxHp: 50,
    gateApplied: false,
    cooldown: 0,
    construindoRestante: 0,
    construindoTotal: 0,
  }
  const iniTorre = unidadeSimples(75, 'inimigo', 13.5, 0, 100)
  const sTorreAlta = limparArena(createPartida(), platoEsq, {
    semCorpo: true,
    obras: [torreAlta],
    unidades: [iniTorre],
    chaoVisto: new Uint8Array(113 * 113).fill(1),
  })
  const depoisTorreAlta = stepPartida(sTorreAlta, INPUT_PARADO, 0.05)
  const danoTorreAlto = danoDaTorreNoNivel(1) * 1.25
  assert(
    Math.abs(depoisTorreAlta.unidades[0].hp - (100 - danoTorreAlto)) < 1e-4,
    `F3d: torre em platô alcança 23,5 m com +25% (${100 - depoisTorreAlta.unidades[0].hp} vs ${danoTorreAlto})`,
  )
  const depoisTorrePlana = stepPartida({ ...sTorreAlta, campoRelevo: criarCampoPlano(0) }, INPUT_PARADO, 0.05)
  assert(depoisTorrePlana.unidades[0].hp === 100, 'F3d: torre no plano não alcança 23,5 m (> 22 m)')
}
