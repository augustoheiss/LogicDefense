import { contagemBuscas, zerarBuscas } from './caminho'
import { chaveBlocoMundo, criarBlocoMundo } from './blocosMundo'
import { COTA_ESTORNO_BLUEPRINT_NV5 } from './obraBlocosLivres'
import { DIMENSOES_OBRA, GRAU_PARTIDA, OBSTACULOS, PARTIDA, PecaId } from './partidaPolicies'
import {
  aplicarConta,
  abrirAltar,
  alcanceAteABorda,
  alcanceDoTiro,
  alternarSubsolo,
  alvoDoBotao,
  aproximacaoDaObra,
  atirar,
  CELULAS_DO_DISCO,
  chaoRevelado,
  cobertoAgora,
  consagrarEstruturaManual,
  construirLinhaBlocos,
  folgaDoTiro,
  inimigoVisivel,
  marcarChao,
  marcadoPelaTorre,
  cenarioConduta,
  cenarioEspetaculo,
  continuarNaRua,
  createPartida,
  criarTropa,
  definirOlhar,
  editarBlocoMundo,
  editarBlocoObra,
  editarBlocoObraLivre,
  evoluir,
  fundar,
  iniciarObra,
  obraEmConstrucao,
  idsNoRetangulo,
  INPUT_PARADO,
  invocarDragao,
  lugarDaBaseInimiga,
  mira,
  pontosDoCorpo,
  pontosFormacaoTropa,
  ordenar,
  ordenarHeroi,
  podeConsagrarEm,
  podeFundarEm,
  repararObra,
  pular,
  PartidaInput,
  PartidaState,
  postura,
  selecionarAoClicarChaoVazio,
  selecionarAoClicarHeroi,
  selecionarAoClicarUnidade,
  selecionarPorRetanguloEstado,
  stepPartida,
  yawAte,
} from './partidaSim'

function assert(condition: boolean, name: string): asserts condition {
  if (!condition) throw new Error(name)
}

function anda(
  state: PartidaState,
  segundos: number,
  input: PartidaInput = { forward: true, back: false, strafe: 0 },
) {
  let atual = state
  let resta = segundos
  while (resta > 1e-8) {
    const fatia = Math.min(0.5, resta)
    atual = stepPartida(atual, input, fatia)
    resta -= fatia
  }
  return atual
}

export function run(): void {
  const inicio = createPartida()
  assert(inicio.olhar === 'terceira' && inicio.heroi.army === 10 && inicio.heroi.z === 0, 'inicio')
  assert(inicio.credito === 4, 'licença inicial 4')
  assert(
    GRAU_PARTIDA[1].bonus === 4 &&
      GRAU_PARTIDA[2].bonus === 6 &&
      GRAU_PARTIDA[3].bonus === 8 &&
      GRAU_PARTIDA[4].bonus === 12,
    'bônus 4 6 8 12',
  )
  assert(aplicarConta(createPartida(), 2).heroi.army === 16, 'grau 2 soma 6')
  assert(aplicarConta(createPartida(), 3).heroi.army === 18, 'grau 3 soma 8')
  assert(aplicarConta(createPartida(), 4).heroi.army === 22, 'grau 4 soma 12')
  assert(!inicio.derrota && inicio.obras.every((obra) => obra.lado === 'inimigo'), 'o jogador começa sem base')
  const baseInicial = inicio.obras.find((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo')
  assert(
    baseInicial !== undefined && Math.hypot(baseInicial.x, baseInicial.z) >= 36,
    'a base inimiga nasce longe',
  )
  const outroCanto = lugarDaBaseInimiga(1, 0)
  assert(
    (outroCanto.x !== baseInicial.x || outroCanto.z !== baseInicial.z) && Math.hypot(outroCanto.x, outroCanto.z) >= 36,
    'cada quadrado planta a base inimiga longe e em outro canto',
  )

  const olhou = definirOlhar(definirOlhar(definirOlhar(inicio, 'imperio'), 'primeira'), 'terceira')
  assert(olhou.heroi.x === inicio.heroi.x && olhou.heroi.z === inicio.heroi.z && olhou.obras.length === inicio.obras.length, 'três olhares, um mundo')

  const leste = anda(inicio, 2, { forward: false, back: false, strafe: -1 })
  assert(leste.heroi.x > 3 && Math.hypot(leste.heroi.x, leste.heroi.z) < PARTIDA.radius, 'sai da rua para +x')

  const giro = mira(inicio, Math.PI * 2, 0)
  assert(Math.abs(Math.sin(giro.heroi.yaw) - Math.sin(inicio.heroi.yaw)) < 1e-9, 'yaw fecha 360')
  const teto = mira(inicio, 0, 10)
  assert(teto.heroi.pitch === PARTIDA.pitchMax, 'pitch no teto')
  const chao = mira(inicio, 0, -10)
  assert(chao.heroi.pitch === PARTIDA.pitchMin, 'pitch no chão')

  let perto = inicio
  for (let i = 0; i < 40 && perto.heroi.z < 30; i++) perto = anda(perto, 0.1)
  const ceu = atirar(mira(perto, 0, 1.2))
  assert(ceu.unidades.every((unidade) => unidade.hp > 0 || unidade.papel !== 'horda'), 'céu não mata')
  const noChao = atirar(mira(perto, 0, 0))
  assert(noChao.unidades.some((unidade) => unidade.hp <= 0), 'chão mata')
  assert(noChao.heroi.army === perto.heroi.army, 'tiro não muda exército')

  let arco = inicio
  for (let i = 0; i < 80 && !arco.gateArchApplied; i++) arco = anda(arco, 0.1)
  assert(arco.gateArchApplied && arco.heroi.army === 20, 'arco soma 10')
  const segunda = anda(arco, 1, { forward: false, back: true, strafe: 0 })
  const terceira = anda(segunda, 2)
  assert(terceira.heroi.army === 20, 'arco segunda vez')

  let lado = inicio
  lado = mira(lado, 0, 0)
  lado = anda(lado, 1, { forward: false, back: false, strafe: -1 })
  for (let i = 0; i < 50; i++) lado = anda(lado, 0.1)
  assert(lado.heroi.x > 3 && lado.gateArchApplied === false && lado.heroi.army === 10, 'arco ao lado não soma')

  const frente = { forward: true, back: false, strafe: 0 as const }
  const longo = stepPartida(inicio, frente, 3)
  assert(longo.gateArchApplied && longo.heroi.army === 20, 'passo longo soma uma vez')
  let fatiado = inicio
  for (let i = 0; i < 60; i++) fatiado = stepPartida(fatiado, frente, 0.05)
  assert(Math.abs(longo.heroi.z - fatiado.heroi.z) < 0.05, '3 s num passo equivalem a 60 fatias de 0,05')
  const estouro = stepPartida(inicio, frente, 10)
  assert(Math.abs(estouro.heroi.z - longo.heroi.z) < 0.05, 'pedido de 10 s não passa de 3 s')

  const borda = anda({ ...inicio, heroi: { ...inicio.heroi, x: 50, z: 0 } }, 1, {
    forward: false,
    back: false,
    strafe: -1,
  })
  assert(borda.heroi.x > 56, 'borda do quadrado deixa o corpo passar')

  const impulso = pular(inicio)
  assert(impulso.heroi.vy === PARTIDA.pulo && impulso.heroi.y === 0, 'pular no chão sobe')
  const noAr = pular({ ...impulso, heroi: { ...impulso.heroi, y: 0.4, vy: 1 } })
  assert(noAr.heroi.vy === 1, 'pular no ar não soma outro impulso')
  assert(pular(definirOlhar(inicio, 'imperio')).heroi.vy === 0, 'império não pula')
  const subiu = stepPartida(impulso, INPUT_PARADO, 0.2)
  assert(subiu.heroi.y > 0.8, 'o corpo sobe')
  const caiu = stepPartida(subiu, INPUT_PARADO, 2)
  assert(caiu.heroi.y === 0 && caiu.heroi.vy === 0, 'o corpo volta ao chão')
  const caixa = OBSTACULOS[0]
  const junto = {
    ...inicio,
    heroi: { ...inicio.heroi, x: caixa.x, z: caixa.z - caixa.hz - PARTIDA.body - 0.3, yaw: 0 },
  }
  let bloqueado = junto
  for (let i = 0; i < 20; i++) bloqueado = stepPartida(bloqueado, { forward: true, back: false, strafe: 0 }, 0.05)
  assert(bloqueado.heroi.z < caixa.z - caixa.hz, 'sem pulo a caixa segura o corpo')
  let salto = pular(junto)
  let pousouNaCaixa = false
  for (let i = 0; i < 40; i++) {
    salto = stepPartida(salto, { forward: true, back: false, strafe: 0 }, 0.05)
    if (Math.abs(salto.heroi.z - caixa.z) < 0.25 && salto.heroi.y === caixa.altura && salto.heroi.vy === 0) {
      pousouNaCaixa = true
    }
  }
  assert(pousouNaCaixa, 'o pulo sobe na caixa')
  const manche = stepPartida(inicio, { forward: false, back: false, strafe: 0, eixoX: 0, eixoY: 1 }, 0.5)
  assert(manche.heroi.z > 2 && Math.abs(manche.heroi.x) < 0.2, 'o manche anda para a frente')

  const longeDoHeroi = fundar(definirOlhar(inicio, 'imperio'), 'nucleo', 0, 30)
  const casa = longeDoHeroi.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo')
  assert(
    casa !== undefined && casa.tipo === 'nucleo' && casa.x === 0 && casa.z === 30 && casa.nivel === 1,
    'fundar',
  )
  assert(
    longeDoHeroi.heroi.x === inicio.heroi.x && longeDoHeroi.heroi.z === inicio.heroi.z,
    'fundar não move o herói',
  )
  const emCima = fundar(inicio, 'nucleo', inicio.heroi.x, inicio.heroi.z)
  assert(emCima === inicio, 'fundar em cima do herói')
  const fora = fundar(inicio, 'nucleo', 80, 0)
  assert(fora === inicio, 'fundar fora')
  const segundo = fundar(longeDoHeroi, 'nucleo', 10, 10)
  assert(segundo === longeDoHeroi, 'um núcleo')

  const paga = aplicarConta(longeDoHeroi, 1)
  assert(paga.heroi.army === 14, 'grau 1 soma 4')
  assert(paga.heroi.army !== 10 + 260, 'não usa o 260 da ponte')
  const nucleoId = paga.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo')!.id
  const evoluida = evoluir(paga, nucleoId)
  const nucleoEvoluido = evoluida.obras.find((obra) => obra.id === nucleoId)
  assert(
    nucleoEvoluido !== undefined &&
      nucleoEvoluido.nivel === 2 &&
      nucleoEvoluido.x === casa!.x &&
      nucleoEvoluido.z === casa!.z,
    'evoluir fica no lugar',
  )
  const nascida = criarTropa({ ...paga, credito: 1 }, nucleoId).unidades.find(
    (unidade) => unidade.lado === 'aliado',
  )
  assert(nascida !== undefined && nascida.postura === 'vigia' && nascida.posturaBase === 'vigia' && nascida.ordem === null, 'tropa nasce sem ordem')
  assert(Math.hypot(nascida.x - 0, nascida.z - 30) > 1.2, 'tropa nasce ao lado do núcleo')

  let cheia: PartidaState = { ...paga, credito: 30 }
  for (let i = 0; i < PARTIDA.allyCap + 2; i++) cheia = criarTropa(cheia, nucleoId)
  const tropas = cheia.unidades.filter((unidade) => unidade.lado === 'aliado' && unidade.hp > 0)
  assert(tropas.length === PARTIDA.allyCap, 'teto de tropa')

  const ids = tropas.slice(0, 2).map((unidade) => unidade.id)
  const inimigo = cheia.unidades.find((unidade) => unidade.lado === 'inimigo' && unidade.hp > 0)
  assert(inimigo !== undefined, 'há inimigo')
  const comOrdem = ordenar(cheia, ids, { tipo: 'atacar', alvoId: inimigo.id })
  assert(
    comOrdem.unidades
      .filter((unidade) => ids.includes(unidade.id))
      .every((unidade) => unidade.postura === 'ordens' && unidade.ordem?.tipo === 'atacar'),
    'ordem de atacar',
  )
  const andou = stepPartida(comOrdem, INPUT_PARADO, 1)
  const mexeu = andou.unidades.find((unidade) => unidade.id === ids[0])
  const origemOrdem = comOrdem.unidades.find((unidade) => unidade.id === ids[0])
  assert(
    mexeu !== undefined &&
      origemOrdem !== undefined &&
      Math.hypot(mexeu.x - inimigo.x, mexeu.z - inimigo.z) <
        Math.hypot(origemOrdem.x - inimigo.x, origemOrdem.z - inimigo.z) - 1,
    'ordem de atacar anda',
  )
  const auto = postura(comOrdem, ids, 'automatico')
  assert(
    auto.unidades.filter((unidade) => ids.includes(unidade.id)).every((unidade) => unidade.ordem === null),
    'automático limpa a ordem',
  )
  const origemAuto = auto.unidades.find((unidade) => unidade.id === ids[0])
  assert(origemAuto !== undefined, 'origem do automático')
  const autoPerto: PartidaState = {
    ...auto,
    unidades: auto.unidades
      .filter((unidade) => unidade.lado !== 'inimigo' || unidade.id === inimigo.id)
      .map((unidade) => (unidade.id === inimigo.id ? { ...unidade, x: origemAuto.x + 8, z: origemAuto.z } : unidade)),
  }
  const autoPasso = stepPartida(autoPerto, INPUT_PARADO, 1)
  const autoMexeu = autoPasso.unidades.find((unidade) => unidade.id === ids[0])
  const hordaOito = autoPerto.unidades.find((unidade) => unidade.id === inimigo.id)
  assert(
    autoMexeu !== undefined &&
      hordaOito !== undefined &&
      Math.hypot(autoMexeu.x - hordaOito.x, autoMexeu.z - hordaOito.z) <
        Math.hypot(origemAuto.x - hordaOito.x, origemAuto.z - hordaOito.z) - 1,
    'automático aproxima',
  )
  const deVolta = ordenar(auto, ids, { tipo: 'mover', x: 4, z: 4 })
  const voltouPasso = stepPartida(deVolta, INPUT_PARADO, 1)
  const voltouUnidade = voltouPasso.unidades.find((unidade) => unidade.id === ids[0])
  const antesVolta = deVolta.unidades.find((unidade) => unidade.id === ids[0])
  assert(voltouUnidade !== undefined && antesVolta !== undefined, 'volta para ordens')
  assert(
    Math.hypot(voltouUnidade.x - 4, voltouUnidade.z - 4) < Math.hypot(antesVolta.x - 4, antesVolta.z - 4) - 1,
    'mover obedece o ponto',
  )
  const vidaInimiga = (state: PartidaState) =>
    state.unidades.filter((unidade) => unidade.lado === 'inimigo').reduce((total, unidade) => total + unidade.hp, 0)
  assert(vidaInimiga(voltouPasso) === vidaInimiga(deVolta), 'mover não caça')

  let horda = inicio
  for (let i = 0; i < 30; i++) horda = anda(horda, 0.1)
  const antes = Math.min(
    ...horda.unidades.filter((unidade) => unidade.papel === 'horda').map((unidade) => unidade.z),
  )
  const depois = stepPartida(horda, INPUT_PARADO, 1)
  const depoisZ = Math.min(
    ...depois.unidades.filter((unidade) => unidade.papel === 'horda' && unidade.hp > 0).map((unidade) => unidade.z),
  )
  assert(depoisZ < antes, 'horda aproxima quando o herói entra no norte')

  const esp0 = cenarioEspetaculo()
  const aliadoEsp = esp0.unidades.find((unidade) => unidade.id === 2)
  const iscaEsp = esp0.unidades.find((unidade) => unidade.papel === 'isca')
  assert(aliadoEsp !== undefined && iscaEsp !== undefined && aliadoEsp.postura === 'automatico', 'isca no espetáculo')
  const esp1 = stepPartida(esp0, INPUT_PARADO, 1)
  const aliadoEsp1 = esp1.unidades.find((unidade) => unidade.id === 2)
  assert(aliadoEsp1 !== undefined && aliadoEsp1.x > aliadoEsp.x + 2, 'automático vai até a isca')
  assert(aliadoEsp1.z < 12, 'automático larga o núcleo')
  const cond0 = cenarioConduta()
  const aliadoCond = cond0.unidades.find((unidade) => unidade.id === 2)
  assert(
    aliadoCond?.ordem?.tipo === 'atacar' && aliadoCond.ordem.alvoId === 6,
    'ordem ignora a isca no começo',
  )
  const cond1 = stepPartida(cond0, INPUT_PARADO, 1)
  const aliadoCond1 = cond1.unidades.find((unidade) => unidade.id === 2)
  const iscaCond = cond1.unidades.find((unidade) => unidade.papel === 'isca')
  assert(aliadoCond1 !== undefined && aliadoCond !== undefined && aliadoCond1.z > aliadoCond.z + 2, 'ordem sobe no sítio')
  assert(iscaCond !== undefined && iscaCond.hp === 400, 'ordem não fere a isca')
  let condN = cond0
  for (let i = 0; i < 40 && (condN.unidades.find((unidade) => unidade.id === 6)?.hp ?? 0) > 0; i++) {
    condN = stepPartida(condN, INPUT_PARADO, 0.2)
  }
  condN = stepPartida(condN, INPUT_PARADO, 0.2)
  const alvoSeis = condN.unidades.find((unidade) => unidade.id === 6)
  const aliadoCondN = condN.unidades.find((unidade) => unidade.id === 2)
  const outrosSitios = condN.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  assert(alvoSeis !== undefined && alvoSeis.hp <= 0 && outrosSitios.length > 0, 'primeiro sítio cai e sobra outro')
  assert(
    aliadoCondN?.ordem?.tipo === 'atacar' &&
      aliadoCondN.ordem.alvoId !== 6 &&
      aliadoCondN.ordem.alvoId !== 10,
    'ordem passa ao próximo que não é isca',
  )

  const espetaculo = anda(cenarioEspetaculo(), 8, INPUT_PARADO)
  const nucleoCaido = espetaculo.obras.find((obra) => obra.tipo === 'nucleo')
  assert(espetaculo.derrota && nucleoCaido !== undefined && nucleoCaido.hp <= 0, 'espetáculo derruba a base')
  const parado = stepPartida(espetaculo, INPUT_PARADO, 1)
  assert(parado === espetaculo, 'derrota congela')

  const conduta = anda(cenarioConduta(), 8, INPUT_PARADO)
  const nucleoDePe = conduta.obras.find((obra) => obra.tipo === 'nucleo')
  const sitiantes = conduta.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  assert(!conduta.derrota && nucleoDePe !== undefined && nucleoDePe.hp > 0 && sitiantes.length === 0, 'conduta segura o núcleo')

  const comTorre = fundar(evoluida, 'torre', 0, 34)
  assert(comTorre.obras.some((obra) => obra.tipo === 'torre'), 'torre')
  let torreAtira = comTorre
  const vidaAntes = torreAtira.unidades.filter((unidade) => unidade.papel === 'horda').reduce((t, u) => t + u.hp, 0)
  torreAtira = stepPartida(torreAtira, INPUT_PARADO, 1)
  const vidaDepois = torreAtira.unidades.filter((unidade) => unidade.papel === 'horda').reduce((t, u) => t + u.hp, 0)
  assert(vidaDepois < vidaAntes, 'torre fere a horda')

  const comPortao = fundar(comTorre, 'portao', 0, 8)
  assert(comPortao !== comTorre, 'portão construído')
  let atravessa = definirOlhar(comPortao, 'terceira')
  const exercitoPortao = atravessa.heroi.army
  for (let i = 0; i < 20 && !atravessa.obras.some((obra) => obra.tipo === 'portao' && obra.gateApplied); i++) {
    atravessa = anda(atravessa, 0.1)
  }
  assert(
    atravessa.obras.some((obra) => obra.tipo === 'portao' && obra.gateApplied) &&
      atravessa.heroi.army === exercitoPortao + 10,
    'portão soma uma vez',
  )
  const depoisDoPortao = anda(atravessa, 1)
  assert(
    depoisDoPortao.heroi.z > 9.5 && depoisDoPortao.heroi.army === atravessa.heroi.army,
    'herói atravessa o portão sem somar de novo',
  )

  const quartel = fundar(aplicarConta(comPortao, 2), 'quartel', -12, 28)
  assert(quartel.obras.some((obra) => obra.tipo === 'quartel'), 'quartel')
  const quartelId = quartel.obras.find((obra) => obra.tipo === 'quartel')!.id
  const antesQuartel = quartel.unidades.filter((unidade) => unidade.lado === 'aliado').length
  const treinou = criarTropa(quartel, quartelId)
  assert(treinou.unidades.filter((unidade) => unidade.lado === 'aliado').length === antesQuartel + 1, 'quartel treina')

  let pedra = inicio
  pedra = anda(pedra, 0.2, { forward: false, back: false, strafe: -1 })
  for (let i = 0; i < 30 && pedra.heroi.carregandoKg === 0; i++) {
    const dx = PARTIDA.pedraX - pedra.heroi.x
    const dz = PARTIDA.pedraZ - pedra.heroi.z
    const yaw = Math.atan2(-dx, dz)
    pedra = mira({ ...pedra, heroi: { ...pedra.heroi, yaw: 0 } }, yaw - pedra.heroi.yaw, 0)
    pedra = anda(pedra, 0.15)
  }
  assert(pedra.heroi.carregandoKg === PARTIDA.pedraKg, 'pega a pedra')
  const comBritador = fundar(definirOlhar(pedra, 'imperio'), 'nucleo', 6, -6)
  const britador = fundar(comBritador, 'britador', PARTIDA.pedraX, PARTIDA.pedraZ + 3)
  assert(britador.obras.some((obra) => obra.tipo === 'britador'), 'britador')
  let entrega = britador
  const alvoB = entrega.obras.find((obra) => obra.tipo === 'britador')!
  for (let i = 0; i < 40 && entrega.lingotes === 0; i++) {
    const dx = alvoB.x - entrega.heroi.x
    const dz = alvoB.z - entrega.heroi.z
    const yaw = Math.atan2(-dx, dz)
    entrega = mira(entrega, yaw - entrega.heroi.yaw, -entrega.heroi.pitch)
    entrega = anda(definirOlhar(entrega, 'terceira'), 0.15)
  }
  assert(entrega.lingotes === 3 && entrega.resto === 5, 'britador devolve quociente e resto')
  const paradoNoBritador = anda(entrega, 2, INPUT_PARADO)
  assert(
    paradoNoBritador.lingotes === 3 && paradoNoBritador.resto === 5,
    'parado no britador não mói de novo',
  )

  const comDragao = invocarDragao(inicio)
  const dragao = comDragao.unidades.find((unidade) => unidade.papel === 'dragao')
  assert(dragao !== undefined && dragao.segmentos.length === 5, 'dragão nasce com segmentos')
  let cacador = mira(comDragao, 0, 0)
  cacador = {
    ...cacador,
    heroi: { ...cacador.heroi, x: dragao.x, z: dragao.z - 4, yaw: 0, pitch: 0 },
  }
  const tiroDragao = atirar(cacador)
  const depoisDragao = tiroDragao.unidades.find((unidade) => unidade.papel === 'dragao')
  assert(depoisDragao !== undefined && depoisDragao.segmentos.length === 4, 'tiro corta um segmento')

  const altar = abrirAltar(inicio, 1, 0)
  let noPiso = altar
  noPiso = {
    ...noPiso,
    heroi: { ...noPiso.heroi, x: altar.altar!.cx, z: altar.altar!.cz + PARTIDA.altarPasso },
  }
  const pisou = stepPartida(noPiso, INPUT_PARADO, 0.05)
  assert(pisou.altar?.resolvido === true && pisou.heroi.army === inicio.heroi.army + GRAU_PARTIDA[1].bonus, 'piso norte paga a conta')
  const errado = abrirAltar(inicio, 1, 0)
  const noErrado = stepPartida(
    {
      ...errado,
      heroi: { ...errado.heroi, x: errado.altar!.cx + PARTIDA.altarPasso, z: errado.altar!.cz },
    },
    INPUT_PARADO,
    0.05,
  )
  assert(noErrado.altar?.resolvido !== true && noErrado.heroi.army === inicio.heroi.army, 'piso errado não paga')

  let marco = inicio
  for (let i = 0; i < 80 && !marco.ruaPercorrida; i++) marco = anda(marco, 0.1)
  assert(marco.ruaPercorrida && !marco.derrota, 'fim do asfalto não trava')
  const seguiu = anda(marco, 0.2)
  assert(seguiu.heroi.z !== marco.heroi.z || seguiu.heroi.x !== marco.heroi.x, 'passo segue depois do asfalto')
  const voltou = continuarNaRua(marco)
  assert(voltou.heroi.z === 0 && voltou.obras.length === marco.obras.length, 'continuar na rua não apaga a base')

  const semNucleo = anda(inicio, PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
  assert(
    semNucleo.unidades.filter((unidade) => unidade.papel === 'sitiante').length === 0,
    'sem base não nasce leva',
  )
  let comBase = longeDoHeroi
  comBase = anda(comBase, PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
  assert(comBase.unidades.some((unidade) => unidade.papel === 'sitiante'), 'leva ataca a base')

  const nan = stepPartida(inicio, { forward: true, back: false, strafe: 0 }, Number.NaN)
  assert(nan.heroi.x === inicio.heroi.x && Number.isFinite(nan.heroi.z), 'dt inválido não anda')

  const hordaAlvo = inicio.unidades.find((unidade) => unidade.papel === 'horda')
  assert(hordaAlvo !== undefined, 'horda de contato')
  const fraco: PartidaState = {
    ...inicio,
    heroi: { ...inicio.heroi, army: 3, x: hordaAlvo.x, z: hordaAlvo.z },
  }
  const semExercito = stepPartida(fraco, INPUT_PARADO, 0.05)
  assert(semExercito.derrota && semExercito.heroi.army === 0, 'exército a zero é derrota')
  assert(stepPartida(semExercito, INPUT_PARADO, 0.5) === semExercito, 'derrota por exército congela')

  const errou = atirar(mira(inicio, Math.PI, 0))
  assert(errou.heroi.shootCooldown > 0 && errou.obras.length === inicio.obras.length, 'erro de tiro gasta recarga e não funda')
  assert(
    errou.unidades.every((unidade, index) => unidade.hp === inicio.unidades[index].hp),
    'erro de tiro não fere',
  )

  const comMuro = fundar(definirOlhar(createPartida(), 'imperio'), 'nucleo', 0, -8)
  const torreMuro = fundar(comMuro, 'torre', 4, 0)
  const pelotao = criarTropa(
    { ...torreMuro, credito: 1 },
    torreMuro.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo')!.id,
  )
  const soldado = pelotao.unidades.find((unidade) => unidade.lado === 'aliado')
  assert(soldado !== undefined, 'soldado do desvio')
  const mandado = ordenar(pelotao, [soldado.id], { tipo: 'mover', x: 8, z: 0 })
  const rota = mandado.unidades.find((unidade) => unidade.id === soldado.id)?.rota
  assert(rota != null && rota.semCaminho === false && rota.marcos.length > 0, 'ordem ganha marcos')
  const andouMuro = stepPartida(mandado, INPUT_PARADO, 2)
  const depoisMuro = andouMuro.unidades.find((unidade) => unidade.id === soldado.id)
  assert(depoisMuro !== undefined, 'soldado segue')
  assert(Math.abs(depoisMuro.x - 4) > 1.3 || Math.abs(depoisMuro.z) > 1.3, 'não termina dentro da torre')
  assert(Math.hypot(depoisMuro.x - 8, depoisMuro.z) < Math.hypot(soldado.x - 8, soldado.z), 'chega mais perto contornando')
  const hordaId = pelotao.unidades.find((unidade) => unidade.papel === 'horda' && unidade.hp > 0)
  assert(hordaId !== undefined, 'horda para a contagem')
  zerarBuscas()
  const caca = ordenar(pelotao, [soldado.id], { tipo: 'atacar', alvoId: hordaId.id })
  stepPartida(caca, INPUT_PARADO, 1)
  assert(contagemBuscas >= 1 && contagemBuscas <= 8, 'ataque não busca em todo quadro')
  zerarBuscas()
  const caca2 = ordenar(pelotao, [soldado.id], { tipo: 'atacar', alvoId: hordaId.id })
  const cedo = stepPartida(caca2, INPUT_PARADO, 0.2)
  const buscasCedo = contagemBuscas
  stepPartida(cedo, INPUT_PARADO, 0.3)
  assert(contagemBuscas > buscasCedo, 'depois de 0,4 s a mesma unidade busca de novo')
  const torreId = torreMuro.obras.find((obra) => obra.tipo === 'torre')
  assert(torreId !== undefined, 'torre para evoluir')
  const torreEvoluida = evoluir(torreMuro, torreId.id)
  assert(torreEvoluida.obras.find((obra) => obra.id === torreId.id)?.nivel === 2, 'torre clicada sobe')
  assert(torreEvoluida.obras.find((obra) => obra.tipo === 'nucleo')?.nivel === 1, 'núcleo não sobe junto')
  const marcado: PartidaState = {
    ...createPartida(),
    unidades: [
      {
        id: 100,
        lado: 'aliado',
        papel: 'tropa',
        x: 0,
        z: 0,
        hp: 10,
        postura: 'ordens',
        ordem: null,
        cooldown: 0,
        segmentos: [],
        alerta: true,
      },
      {
        id: 101,
        lado: 'aliado',
        papel: 'tropa',
        x: 4,
        z: 0,
        hp: 10,
        postura: 'ordens',
        ordem: null,
        cooldown: 0,
        segmentos: [],
        alerta: true,
      },
      {
        id: 102,
        lado: 'aliado',
        papel: 'tropa',
        x: 10,
        z: 0,
        hp: 10,
        postura: 'ordens',
        ordem: null,
        cooldown: 0,
        segmentos: [],
        alerta: true,
      },
    ],
  }
  const escolhidos = idsNoRetangulo(marcado, -1, -1, 5, 1)
  assert(escolhidos.length === 2 && !escolhidos.includes(102), 'retângulo pega 2 de 3')

  const campo = fundar(definirOlhar(createPartida(), 'imperio'), 'nucleo', 20, 0)
  const disparo = stepPartida({ ...campo, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }, INPUT_PARADO, 0.1)
  const leva = disparo.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  const baseInimiga = disparo.obras.find((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo')
  assert(baseInimiga !== undefined, 'a leva tem de onde sair')
  assert(leva.length === 4 && leva.every((unidade) => unidade.hp === 14), 'primeira leva são 4 com vida 14')
  assert(
    leva.every((unidade) => Math.hypot(unidade.x - baseInimiga.x, unidade.z - baseInimiga.z) <= 6),
    'nascem na base inimiga',
  )
  const livre = stepPartida(disparo, INPUT_PARADO, 3)
  const andouLivre = livre.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  const distNucleo = (unidade: { x: number; z: number }) => Math.hypot(unidade.x - 20, unidade.z)
  assert(
    andouLivre.length === 4 &&
      andouLivre.every((unidade) => {
        const nasceu = leva.find((item) => item.id === unidade.id)
        return nasceu !== undefined && distNucleo(unidade) < distNucleo(nasceu) - 2
      }),
    'sem torre anda da base inimiga até o núcleo',
  )
  const levaCrescida = stepPartida({ ...disparo, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }, INPUT_PARADO, 0.1)
  const nucleoInimigo = levaCrescida.obras.find((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo')
  assert(
    nucleoInimigo !== undefined &&
      nucleoInimigo.nivel >= 2 &&
      levaCrescida.obras.some((obra) => obra.lado === 'inimigo' && obra.tipo === 'torre'),
    'a segunda leva faz a base inimiga crescer',
  )

  const levaTorre = fundar(campo, 'torre', -12, -4)
  let torrePasso = stepPartida({ ...levaTorre, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }, INPUT_PARADO, 0.1)
  let chegouMais = false
  let dentro = false
  for (let i = 0; i < 6; i++) {
    torrePasso = stepPartida(torrePasso, INPUT_PARADO, 0.5)
    const vivos = torrePasso.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
    if (vivos.some((unidade) => distNucleo(unidade) < Math.hypot(baseInimiga.x - 20, baseInimiga.z) - 4)) chegouMais = true
    if (vivos.some((unidade) => Math.abs(unidade.x + 12) <= 1.15 && Math.abs(unidade.z + 4) <= 1.15)) dentro = true
  }
  assert(chegouMais && !dentro, 'torre desvia e aproxima do núcleo')

  const levaPortao = fundar(campo, 'portao', -12, -4)
  const disparoPortao = stepPartida({ ...levaPortao, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }, INPUT_PARADO, 0.1)
  const peloPortao = stepPartida(disparoPortao, INPUT_PARADO, 3)
  const noPortao = peloPortao.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  assert(
    noPortao.every((unidade) => {
      const nasceu = disparoPortao.unidades.find((item) => item.id === unidade.id)
      return nasceu !== undefined && distNucleo(unidade) < distNucleo(nasceu) - 2
    }),
    'portão não segura a leva',
  )
  assert(peloPortao.heroi.army === campo.heroi.army, 'leva no portão não soma exército')

  let muro = campo
  for (let z = -55; z <= 55; z += 1) muro = fundar(muro, 'torre', -20, z)
  const disparoMuro = stepPartida({ ...muro, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }, INPUT_PARADO, 0.1)
  const nasceram = disparoMuro.unidades.filter((unidade) => unidade.papel === 'sitiante')
  assert(nasceram.length === 4 && nasceram.every((unidade) => unidade.hp > 0 && unidade.rota?.semCaminho === true), 'muro fecha e a leva vive')
  const bateu = stepPartida(disparoMuro, INPUT_PARADO, 0.6)
  const depoisLeva = bateu.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  const torres = bateu.obras.filter((obra) => obra.tipo === 'torre' && obra.lado !== 'inimigo')
  assert(
    depoisLeva.some((unidade) => {
      const antes = nasceram.find((item) => item.id === unidade.id)
      if (!antes) return false
      const dist = (px: number, pz: number) => Math.min(...torres.map((obra) => Math.hypot(px - obra.x, pz - obra.z)))
      const meiaTorre = DIMENSOES_OBRA.torre[0] / 2
      const fora = torres.every((obra) => Math.abs(unidade.x - obra.x) > meiaTorre || Math.abs(unidade.z - obra.z) > meiaTorre)
      return dist(unidade.x, unidade.z) < dist(antes.x, antes.z) && fora
    }),
    'sem caminho aproxima da torre e fica fora dela',
  )

  const hordaQuieta = stepPartida(campo, INPUT_PARADO, 2)
  const zHorda = Math.min(...hordaQuieta.unidades.filter((unidade) => unidade.papel === 'horda').map((unidade) => unidade.z))
  const zInicio = Math.min(...campo.unidades.filter((unidade) => unidade.papel === 'horda').map((unidade) => unidade.z))
  assert(zHorda === zInicio, 'horda do acampamento não marcha ao núcleo')

  const baseHeroi = definirOlhar(fundar(fundar(definirOlhar(createPartida(), 'imperio'), 'nucleo', 0, -12), 'torre', 4, 0), 'imperio')
  const mandadoHeroi = ordenarHeroi(baseHeroi, { tipo: 'mover', x: 8, z: 0 })
  const andouHeroi = stepPartida(mandadoHeroi, INPUT_PARADO, 1.2)
  assert(Math.abs(andouHeroi.heroi.x - 4) > 1.2 && andouHeroi.heroi.x > 0.5, 'herói contorna a torre')
  const alvoPerto = createPartida().unidades.find((unidade) => unidade.papel === 'horda')
  assert(alvoPerto !== undefined, 'alvo do herói')
  const heroiBase = createPartida().heroi
  const pertoDoAlvo = {
    ...definirOlhar(createPartida(), 'imperio'),
    heroi: { ...heroiBase, x: alvoPerto.x, z: alvoPerto.z - 6, pitch: 0 },
  }
  const atacou = stepPartida(ordenarHeroi(pertoDoAlvo, { tipo: 'atacar', alvoId: alvoPerto.id }), INPUT_PARADO, 0.2)
  const vidaAlvo = atacou.unidades.find((unidade) => unidade.id === alvoPerto.id)?.hp ?? 99
  assert(vidaAlvo < alvoPerto.hp, 'herói atira na ordem')
  const noCorpo = stepPartida(definirOlhar(atacou, 'terceira'), { forward: true, back: false, strafe: 0 }, 0.2)
  assert(noCorpo.heroiOrdem === null, 'WASD solta a ordem do herói')

  const corpo = invocarDragao(createPartida())
  const cabeca = corpo.unidades.find((unidade) => unidade.papel === 'dragao')
  assert(cabeca !== undefined, 'dragão do corpo')
  const alongado: PartidaState = {
    ...corpo,
    unidades: corpo.unidades.map((unidade) =>
      unidade.id === cabeca.id
        ? {
            ...unidade,
            x: 0,
            z: 30,
            trilha: Array.from({ length: 40 }, (_, indice) => ({ x: -0.5 * (indice + 1), z: 30 })),
          }
        : unidade,
    ),
  }
  const miraCauda = {
    ...alongado,
    heroi: { ...alongado.heroi, x: -16, z: 26, yaw: 0, pitch: 0, shootCooldown: 0 },
  }
  assert(Math.hypot(miraCauda.heroi.x, 30 - miraCauda.heroi.z) > PARTIDA.shootRange, 'cabeça fora do alcance')
  const naCauda = atirar(miraCauda)
  const semSeis = naCauda.unidades.find((unidade) => unidade.id === cabeca.id)
  assert(
    semSeis !== undefined && semSeis.segmentos.length === 4 && semSeis.segmentos[0] === 48 && semSeis.segmentos[3] === 12,
    'tiro na cauda tira o 6 e deixa o 48',
  )
  const deCostas = atirar({
    ...miraCauda,
    heroi: { ...miraCauda.heroi, yaw: Math.PI, shootCooldown: 0 },
  })
  assert(deCostas.unidades.find((unidade) => unidade.id === cabeca.id)?.segmentos.length === 5, 'tiro de costas não corta segmento')
  let morto = {
    ...alongado,
    heroi: { ...alongado.heroi, x: 0, z: 26, yaw: 0, pitch: 0, shootCooldown: 0 },
  }
  for (let i = 0; i < 5; i++) morto = atirar({ ...morto, heroi: { ...morto.heroi, shootCooldown: 0 } })
  const fimDragao = morto.unidades.find((unidade) => unidade.id === cabeca.id)
  assert(fimDragao !== undefined && fimDragao.hp === 0 && fimDragao.segmentos.length === 0, 'cinco tiros apagam o corpo')

  const campoDragao = fundar(createPartida(), 'nucleo', 20, 0)
  const nasce = stepPartida({ ...campoDragao, ondaRelogio: PARTIDA.ondaPeriodo - 0.05, ondaNumero: 2 }, INPUT_PARADO, 0.1)
  const levaDragao = nasce.unidades.find((unidade) => unidade.papel === 'dragao' && unidade.hp > 0)
  const casaDoDragao = nasce.obras.find((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo')
  assert(
    levaDragao !== undefined &&
      casaDoDragao !== undefined &&
      Math.hypot(levaDragao.x - casaDoDragao.x, levaDragao.z - casaDoDragao.z) <= 6,
    'terceira leva nasce na base inimiga',
  )

  const comTorreDragao = fundar(campoDragao, 'torre', -12, -4)
  let curva = stepPartida({ ...comTorreDragao, ondaRelogio: PARTIDA.ondaPeriodo - 0.05, ondaNumero: 2 }, INPUT_PARADO, 0.1)
  const dragaoNasceu = curva.unidades.find((unidade) => unidade.papel === 'dragao')
  let corpoNaTorre = false
  for (let i = 0; i < 15; i++) {
    curva = stepPartida(curva, INPUT_PARADO, 0.2)
    const vivo = curva.unidades.find((unidade) => unidade.papel === 'dragao' && unidade.hp > 0)
    if (!vivo) continue
    for (const ponto of pontosDoCorpo(vivo)) {
      if (Math.abs(ponto.x + 12) <= 1.15 && Math.abs(ponto.z + 4) <= 1.15) corpoNaTorre = true
    }
  }
  const depoisCurva = curva.unidades.find((unidade) => unidade.papel === 'dragao' && unidade.hp > 0)
  assert(
    depoisCurva !== undefined &&
      dragaoNasceu !== undefined &&
      !corpoNaTorre &&
      Math.hypot(depoisCurva.x - 20, depoisCurva.z) < Math.hypot(dragaoNasceu.x - 20, dragaoNasceu.z) - 2,
    'corpo contorna a torre e anda ao núcleo',
  )

  assert(Math.abs(alcanceAteABorda(0, 0, 0) - PARTIDA.radius) < 0.02, 'tiro alcança a borda')
  assert(folgaDoTiro(4) > folgaDoTiro(48) + 0.8, 'folga encolhe com a distância')
  const umInimigo = (x: number, z: number): PartidaState => ({
    ...createPartida(),
    heroi: { ...createPartida().heroi, yaw: 0, pitch: 0, shootCooldown: 0 },
    unidades: [
      {
        id: 900,
        lado: 'inimigo',
        papel: 'horda',
        x,
        z,
        hp: 12,
        postura: 'automatico',
        ordem: null,
        cooldown: 0,
        segmentos: [],
        alerta: true,
      },
    ],
  })
  assert((atirar(umInimigo(1.5, 4)).unidades.find((unidade) => unidade.id === 900)?.hp ?? 12) === 0, 'perto ao lado ainda cai')
  assert(atirar(umInimigo(1.5, 48)).unidades.find((unidade) => unidade.id === 900)?.hp === 12, 'longe ao lado escapa')
  const alemDaVista = atirar(umInimigo(0, 50))
  const corpoLonge = alemDaVista.unidades.find((unidade) => unidade.id === 900)
  assert(corpoLonge !== undefined && corpoLonge.hp === 12 && alemDaVista.heroi.shootCooldown === 0.45, 'mira leva o tiro até a borda')
  assert((atirar(umInimigo(0, 16)).unidades.find((unidade) => unidade.id === 900)?.hp ?? 12) === 0, 'tiro dentro dos 18 m derruba')
  assert(atirar(umInimigo(0, 70)).unidades.find((unidade) => unidade.id === 900)?.hp === 12, 'tiro não passa da ilha')

  const saida = createPartida()
  assert(chaoRevelado(saida, 0, 0) && chaoRevelado(saida, 0, 18), 'saída revela o chão de 18 m')
  assert(
    !chaoRevelado(saida, 0, 19) && !chaoRevelado(saida, 0, 20) && !chaoRevelado(saida, 0, 22) && !chaoRevelado(saida, 0, 44),
    'saída deixa postes e acampamento na nuvem',
  )
  const hordasSaida = saida.unidades.filter((unidade) => unidade.papel === 'horda')
  assert(hordasSaida.length === 6 && hordasSaida.every((unidade) => !inimigoVisivel(saida, unidade)), 'horda inicial está fora da vista')
  const andouNuvem = stepPartida(saida, { forward: true, back: false, strafe: 0 }, 0.3)
  assert(
    andouNuvem.versaoChao > saida.versaoChao &&
      Math.abs(andouNuvem.heroi.z - 2.4) < 0.05 &&
      chaoRevelado(andouNuvem, 0, 20) &&
      !chaoRevelado(andouNuvem, 0, 44),
    'andar empurra a nuvem',
  )
  const paradoNuvem = stepPartida(andouNuvem, INPUT_PARADO, 0.2)
  assert(paradoNuvem.versaoChao === andouNuvem.versaoChao, 'parado não revela chão novo')

  const comNucleo = fundar(saida, 'nucleo', 5, 0)
  const torreOlho = fundar(comNucleo, 'torre', 0, 10)
  assert(chaoRevelado(torreOlho, 0, 32) && !chaoRevelado(torreOlho, 0, 33), 'torre acende 22 m e não 23')
  const idTorreOlho = torreOlho.obras.find((obra) => obra.tipo === 'torre')!.id
  const torreOlhoEvoluida = marcarChao(evoluir(evoluir(torreOlho, idTorreOlho), idTorreOlho))
  const nivelTorreOlho = torreOlhoEvoluida.obras.find((obra) => obra.id === idTorreOlho)?.nivel
  assert(nivelTorreOlho === 3 && !chaoRevelado(torreOlhoEvoluida, 0, 33), 'evoluir a torre não aumenta a visão')

  const inimigoUniao = {
    id: 80,
    lado: 'inimigo' as const,
    papel: 'horda' as const,
    x: 0,
    z: 40,
    hp: 12,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: false,
  }
  const semTropa = { ...saida, unidades: [...saida.unidades, inimigoUniao] }
  assert(!inimigoVisivel(semTropa, inimigoUniao), 'herói em 0 não vê z = 40')
  const comTropaVista = {
    ...semTropa,
    unidades: [
      ...semTropa.unidades,
      {
        id: 81,
        lado: 'aliado' as const,
        papel: 'tropa' as const,
        x: 0,
        z: 30,
        hp: 16,
        postura: 'ordens' as const,
        ordem: null,
        cooldown: 0,
        segmentos: [] as number[],
        alerta: true,
      },
    ],
  }
  assert(inimigoVisivel(comTropaVista, inimigoUniao), 'tropa a 12 m torna o inimigo visível')

  const vigia = {
    ...torreOlho,
    unidades: [
      ...torreOlho.unidades,
      { ...inimigoUniao, id: 82, z: 28 },
    ],
  }
  const corpoVigia = vigia.unidades.find((unidade) => unidade.id === 82)
  assert(corpoVigia !== undefined && inimigoVisivel(vigia, corpoVigia) && chaoRevelado(vigia, 0, 28), 'torre abre o olho')
  const passoVigia = stepPartida(vigia, INPUT_PARADO, 0.2)
  assert(passoVigia.unidades.find((unidade) => unidade.id === 82)?.hp === 12, 'torre não fere fora da arma')
  assert(alcanceDoTiro(0, 0, 0) === 18 && alcanceAteABorda(0, 0, 0) === 56, 'tiro do herói corta em 18')
  const tiroVigia = atirar(vigia)
  assert(
    tiroVigia.heroi.shootCooldown === 0.45 && tiroVigia.unidades.find((unidade) => unidade.id === 82)?.hp === 12,
    'atirar não fere quem só a torre vê',
  )
  const torreMorta = {
    ...vigia,
    obras: vigia.obras.map((obra) => (obra.tipo === 'torre' ? { ...obra, hp: 0 } : obra)),
  }
  assert(corpoVigia !== undefined && !inimigoVisivel(torreMorta, corpoVigia) && chaoRevelado(torreMorta, 0, 28), 'torre caída apaga o olho e guarda o chão')
  assert(cobertoAgora(vigia, 0, 28) && !cobertoAgora(torreMorta, 0, 28), 'chão lembrado sem torre nem tropa fica no escuro')

  const cabecaFora = {
    id: 83,
    lado: 'inimigo' as const,
    papel: 'dragao' as const,
    x: 0,
    z: 30,
    hp: 30,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [48, 36, 24, 12, 6],
    alerta: true,
    trilha: Array.from({ length: 20 }, (_, indice) => ({ x: 0, z: 30 - (indice + 1) })),
  }
  const dragaoCoberto = { ...saida, heroi: { ...saida.heroi, shootCooldown: 0 }, unidades: [...saida.unidades, cabecaFora] }
  const quinto = pontosDoCorpo(cabecaFora)[5]
  assert(quinto !== undefined && Math.abs(quinto.z - 14) < 0.05 && Math.abs(quinto.x) < 0.05, 'quinto segmento em z = 14')
  assert(!inimigoVisivel(dragaoCoberto, cabecaFora), 'dragão com cabeça fora some inteiro')
  const tiroOrfao = atirar(dragaoCoberto)
  const orfao = tiroOrfao.unidades.find((unidade) => unidade.id === 83)
  assert(orfao !== undefined && orfao.hp === 30 && orfao.segmentos.length === 5, 'segmento dentro dos 18 m não salva a cabeça')

  const hordaAlerta = {
    ...inimigoUniao,
    id: 84,
    z: 44,
    alerta: true,
  }
  const marchaOculta = stepPartida({ ...saida, unidades: [hordaAlerta] }, INPUT_PARADO, 0.5)
  const andouOculta = marchaOculta.unidades.find((unidade) => unidade.id === 84)
  assert(
    andouOculta !== undefined &&
      Math.abs(andouOculta.z - (44 - 2.1)) < 0.05 &&
      !inimigoVisivel(marchaOculta, andouOculta) &&
      !chaoRevelado(marchaOculta, 0, 44),
    'escondido anda',
  )

  const olhouNuvem = definirOlhar(saida, 'primeira')
  assert(olhouNuvem.chaoVisto === saida.chaoVisto && !chaoRevelado(olhouNuvem, 0, 44), 'três olhares, o mesmo chão')
  const imperioParado = stepPartida(definirOlhar(saida, 'imperio'), { forward: true, back: false, strafe: 0 }, 0.3)
  assert(imperioParado.heroi.z === 0 && !chaoRevelado(imperioParado, 0, 20), 'império não revela ao passear')
  assert(!chaoRevelado(saida, 0, 44) && fundar(saida, 'nucleo', 20, 0).obras.some((obra) => obra.tipo === 'nucleo'), 'clique na nuvem é da cena; fundar direto segue')

  const naMargem = {
    ...saida,
    heroi: { ...saida.heroi, x: 0, z: 55.65, yaw: 0, pitch: 0, shootCooldown: 0 },
    unidades: [{ ...inimigoUniao, id: 85, z: 70 }],
  }
  assert(atirar(naMargem).unidades.find((unidade) => unidade.id === 85)?.hp === 12, 'além do disco não fere')
  const antesDaMargem = {
    ...naMargem,
    heroi: { ...naMargem.heroi, yaw: Math.PI, shootCooldown: 0 },
    unidades: [{ ...inimigoUniao, id: 86, z: 50 }],
  }
  assert((atirar(antesDaMargem).unidades.find((unidade) => unidade.id === 86)?.hp ?? 12) === 0, 'dentro dos 18 m e do disco fere')

  const iscaPerto = { ...inimigoUniao, id: 87, papel: 'isca' as const, z: 8, hp: 400 }
  const vistoPerto = { ...inimigoUniao, id: 88, z: 12 }
  const longeDoBotao = { ...inimigoUniao, id: 89, z: 40 }
  const comBotao = fundar(
    { ...saida, unidades: [...saida.unidades, iscaPerto, vistoPerto, longeDoBotao] },
    'nucleo',
    5,
    0,
  )
  assert(alvoDoBotao(comBotao) === 88, 'botão ataca o visível mais perto e pula a isca')
  assert(alvoDoBotao({ ...saida, unidades: [longeDoBotao] }) === null, 'sem visível o botão não escolhe')
  const pertoDoNucleo = { ...inimigoUniao, id: 90, x: 5, z: 2 }
  const pertoDoHeroi = { ...inimigoUniao, id: 91, x: 0, z: 4 }
  const comOrigem = fundar({ ...saida, unidades: [...saida.unidades, pertoDoNucleo, pertoDoHeroi] }, 'nucleo', 5, 0)
  assert(alvoDoBotao(comOrigem) === 90, 'botão mede a partir do núcleo')
  assert(alvoDoBotao({ ...saida, unidades: [pertoDoNucleo, pertoDoHeroi] }) === 91, 'sem núcleo o botão mede a partir do herói')

  const vigiaParado = { ...torreOlho, semCorpo: true, unidades: [{ ...inimigoUniao, id: 990, papel: 'isca' as const, hp: 100, x: 0, z: 28 }] }
  for (const distancia of [10, 12, 12.1, 18, 22, 22.1]) {
    const alvo = { ...vigiaParado.unidades[0], z: 10 + distancia }
    const cenario = { ...vigiaParado, unidades: [alvo] }
    assert(inimigoVisivel(cenario, alvo) === (distancia <= 22), `visão exata em ${distancia} m`)
    assert(marcadoPelaTorre(cenario, alvo) === (distancia > 12 && distancia <= 22), `anel exato em ${distancia} m`)
    const resultado = stepPartida(cenario, INPUT_PARADO, 0.1)
    assert((resultado.unidades[0].hp < alvo.hp) === (distancia <= 12), `arma exata em ${distancia} m sem marcha do alvo`)
  }
  const torreNivelTres = { ...vigiaParado, obras: vigiaParado.obras.map((obra) => obra.tipo === 'torre' ? { ...obra, nivel: 3 } : obra) }
  for (const distancia of [16, 16.1]) {
    const alvo = { ...vigiaParado.unidades[0], z: 10 + distancia }
    const cenario = { ...torreNivelTres, unidades: [alvo] }
    assert(marcadoPelaTorre(cenario, alvo) === (distancia > 16), `nível 3 separa olho e arma em ${distancia}`)
    assert((stepPartida(cenario, INPUT_PARADO, 0.1).unidades[0].hp < 100) === (distancia <= 16), 'arma nível 3 chega a 16 m')
  }
  const torreOriginal = vigiaParado.obras.find((obra) => obra.tipo === 'torre')!
  const sobreposto = { ...vigiaParado, obras: [...vigiaParado.obras, { ...torreOriginal, id: 991, z: 22 }] }
  assert(!marcadoPelaTorre(sobreposto, sobreposto.unidades[0]), 'outra torre na arma remove a marca de fora do alcance')
  const semVigia = { ...vigiaParado, obras: vigiaParado.obras.map((obra) => obra.tipo === 'torre' ? { ...obra, hp: 0 } : obra) }
  assert(!marcadoPelaTorre(semVigia, semVigia.unidades[0]) && chaoRevelado(semVigia, 0, 28), 'torre morta tira a marca e conserva a memória')
  assert(atirar(vigiaParado) === vigiaParado && pular(vigiaParado) === vigiaParado, 'herói ausente não atira nem pula')
  assert(ordenarHeroi(vigiaParado, { tipo: 'mover', x: 10, z: 10 }) === vigiaParado && ordenarHeroi(vigiaParado, { tipo: 'atacar', alvoId: 990 }) === vigiaParado, 'herói ausente não recebe ordens')

  const obraCerco = { ...baseInicial, id: 2000, x: 0, z: 8, hp: 100, maxHp: 100 }
  const cerco: PartidaState = { ...inicio, obras: [obraCerco], unidades: [] }
  for (const olhar of ['primeira', 'terceira'] as const) {
    const disparo = atirar(definirOlhar(cerco, olhar))
    assert(disparo.obras[0].hp === 88 && disparo.heroi.shootCooldown === 0.45, `cerco manual em ${olhar}`)
    assert(atirar(disparo) === disparo, 'recarga impede segundo dano imediato em obra')
  }
  assert(atirar({ ...cerco, obras: [{ ...obraCerco, lado: 'nosso' }] }).obras[0].hp === 100, 'obra nossa não recebe tiro')
  assert(atirar({ ...cerco, heroi: { ...cerco.heroi, pitch: 0.8 } }).obras[0].hp === 100, 'tiro no céu não fere obra')
  assert(atirar({ ...cerco, obras: [{ ...obraCerco, x: 0.6, tipo: 'torre' }] }).obras[0].hp === 100, 'torre estreita não recebe folga de unidade')
  assert(atirar({ ...cerco, obras: [{ ...obraCerco, x: 0.54, tipo: 'torre' }] }).obras[0].hp === 88, 'caixa da torre acompanha sua malha de 1,1 m')
  assert(atirar({ ...cerco, obras: [{ ...obraCerco, z: 18 }] }).obras[0].hp === 88, 'obra na fronteira de 18 m recebe dano')
  const lembrada = marcarChao({ ...cerco, heroi: { ...cerco.heroi, z: 1 }, obras: [{ ...obraCerco, z: 18.1 }] })
  const semVista = { ...lembrada, heroi: { ...lembrada.heroi, z: -1 } }
  assert(chaoRevelado(semVista, 0, 18.1) && !cobertoAgora(semVista, 0, 18.1) && atirar(semVista).obras[0].hp === 100, 'chão lembrado não autoriza tiro em obra além da visão viva')

  const unidadeCerco = { ...inimigoUniao, id: 2001, x: 0, z: 12, hp: 60 }
  const cercoNoAr = { ...cerco, heroi: { ...cerco.heroi, y: 1.5 } }
  assert(atirar(cercoNoAr).obras[0].hp === 100, 'mira horizontal no pulo passa acima da obra')
  const obraVistaDeCima = { ...cercoNoAr, heroi: { ...cercoNoAr.heroi, pitch: -Math.atan2(PARTIDA.eyeY + 1.5 - 0.8, 8) } }
  assert(atirar(obraVistaDeCima).obras[0].hp === 88, 'mira para baixo no pulo acerta a malha da obra')
  const tropaVistaDeCima = { ...cercoNoAr, obras: [], unidades: [unidadeCerco] }
  assert(atirar(tropaVistaDeCima).unidades[0].hp === 60, 'cápsula e filtro de unidade usam altura real no pulo')
  assert(atirar({ ...tropaVistaDeCima, heroi: { ...cercoNoAr.heroi, pitch: -Math.atan2(PARTIDA.eyeY + 1.5 - 0.8, 12) } }).unidades[0].hp === 48, 'mira para baixo no pulo continua acertando unidade')
  const obraNaFrente = atirar({ ...cerco, unidades: [unidadeCerco] })
  assert(obraNaFrente.obras[0].hp === 88 && obraNaFrente.unidades[0].hp === 60, 'obra na frente intercepta unidade atrás')
  const unidadeNaFrente = atirar({ ...cerco, unidades: [{ ...unidadeCerco, z: 4 }] })
  assert(unidadeNaFrente.obras[0].hp === 100 && unidadeNaFrente.unidades[0].hp === 48, 'unidade na frente intercepta obra atrás')
  const raioAssistido = folgaDoTiro(8)
  const entradaAssistida = 8 - Math.sqrt(raioAssistido ** 2 - (PARTIDA.eyeY - PARTIDA.tiroCorpoAlto) ** 2)
  const empate = { ...cerco, obras: [{ ...obraCerco, z: entradaAssistida + 1 }], unidades: [{ ...unidadeCerco, z: 8 }] }
  assert(atirar(empate).obras[0].hp === 88 && atirar(empate).unidades[0].hp === 60, 'empate de primeira interseção favorece obra de forma estável')
  const centrosEnganam = atirar({ ...empate, obras: [{ ...obraCerco, z: entradaAssistida + 1.05 }] })
  assert(centrosEnganam.obras[0].hp === 100 && centrosEnganam.unidades[0].hp === 48, 'ordem usa superfície assistida e não centro do alvo')

  const fragil = { ...cerco, obras: [{ ...obraCerco, hp: 5 }] }
  const destruida = atirar(fragil)
  assert(destruida.obras[0].hp === 0 && destruida.versaoSolidos === fragil.versaoSolidos + 1, 'destruição limita HP e invalida sólidos')
  assert(atirar({ ...destruida, heroi: { ...destruida.heroi, shootCooldown: 0 } }).versaoSolidos === destruida.versaoSolidos, 'ruína não repete invalidação')
  const portaoDestruido = atirar({ ...fragil, obras: [{ ...obraCerco, tipo: 'portao', hp: 5 }] })
  assert(portaoDestruido.obras[0].hp === 0 && portaoDestruido.versaoSolidos === fragil.versaoSolidos, 'portão destruído não era sólido de navegação')

  const soldadoCerco = { ...unidadeCerco, id: 2002, lado: 'aliado' as const, x: 0, z: 4, postura: 'ordens' as const, ordem: null }
  const comRotaCerco = ordenar({ ...fragil, unidades: [soldadoCerco] }, [soldadoCerco.id], { tipo: 'mover', x: 0, z: 16 })
  assert(comRotaCerco.unidades[0].rota?.marcos.some((marco) => Math.abs(marco.x) >= 1) === true, 'rota inicial desvia da obra sólida')
  const caminhoLiberado = stepPartida(atirar(comRotaCerco), INPUT_PARADO, 0.05)
  assert(caminhoLiberado.unidades[0].rota?.versao === caminhoLiberado.versaoSolidos && caminhoLiberado.unidades[0].rota?.marcos.every((marco) => Math.abs(marco.x) < 0.5), 'rota existente reconsidera passagem pela ruína')

  const torreCerco = { ...obraCerco, tipo: 'torre' as const, z: 10, cooldown: 0 }
  const defesaCerco = { ...cerco, obras: [torreCerco] }
  const ferido = stepPartida(defesaCerco, INPUT_PARADO, 0.05)
  assert(ferido.heroi.army === 3 && ferido.obras[0].cooldown === PARTIDA.torreCooldown, 'torre inimiga atinge exército do herói')
  assert(stepPartida(ferido, INPUT_PARADO, 0.1).heroi.army === 3, 'torre respeita recarga contra herói')
  assert(stepPartida(defesaCerco, INPUT_PARADO, 1).heroi.army === 0, 'torre nunca deixa exército negativo')
  assert(stepPartida({ ...defesaCerco, semCorpo: true }, INPUT_PARADO, 0.1).heroi.army === 10, 'torre ignora herói ausente')
  assert(stepPartida({ ...defesaCerco, obras: [{ ...torreCerco, z: 12.1 }] }, INPUT_PARADO, 0.1).heroi.army === 10, 'herói fora do alcance da torre fica intacto')
  assert(stepPartida({ ...defesaCerco, obras: [{ ...torreCerco, hp: 0 }] }, INPUT_PARADO, 0.1).heroi.army === 10, 'ruína da torre não atira')
  const tropaMaisPerto = stepPartida({ ...defesaCerco, unidades: [{ ...soldadoCerco, z: 9 }] }, INPUT_PARADO, 0.05)
  assert(tropaMaisPerto.heroi.army === 10 && tropaMaisPerto.unidades[0].hp === 53, 'tropa mais próxima continua candidata da torre inimiga')
  const heroiMaisPerto = stepPartida({ ...defesaCerco, heroi: { ...cerco.heroi, z: 9 }, unidades: [{ ...soldadoCerco, z: 0 }] }, INPUT_PARADO, 0.05)
  assert(heroiMaisPerto.heroi.army === 3 && heroiMaisPerto.unidades[0].hp === 60, 'torre compara distância de herói e tropa')
  const duasTorres = stepPartida({ ...defesaCerco, obras: [torreCerco, { ...torreCerco, id: 2003, x: 1 }] }, INPUT_PARADO, 0.05)
  assert(duasTorres.heroi.army === 3 && duasTorres.obras.filter((obra) => obra.cooldown > 0).length === 1, 'contenção entre torres trata herói como alvo único')

  let semLevas = fundar({ ...destruida, unidades: [{ ...unidadeCerco, papel: 'isca', x: 30, z: 0 }], ondaRelogio: 19.99 }, 'nucleo', 5, 0)
  const inimigoExistente = semLevas.unidades[0].id
  for (let segundo = 0; segundo < 45; segundo++) semLevas = stepPartida(semLevas, INPUT_PARADO, 1)
  assert(!semLevas.derrota && semLevas.ondaNumero === 0 && semLevas.ondaRelogio === 0 && semLevas.unidades.some((unidade) => unidade.id === inimigoExistente && unidade.hp > 0), 'núcleo destruído bloqueia duas levas sem apagar inimigo existente ou encerrar partida')

  const yawCanto = Math.atan2(-2, 2)
  assert(alcanceAteABorda(40, 40, yawCanto) > 15 && alcanceDoTiro(40, 40, yawCanto) > 15, 'canto: o tiro passa de 15 m')
  const cantoBase = createPartida()
  const nucleoCanto = cantoBase.obras.find((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo')
  assert(nucleoCanto !== undefined, 'canto: existe núcleo inimigo')
  const mirandoCanto = {
    ...cantoBase,
    unidades: [],
    obras: [{ ...nucleoCanto, x: 42, z: 42, hp: 100 }],
    heroi: { ...cantoBase.heroi, x: 40, z: 40, yaw: yawCanto, pitch: 0, shootCooldown: 0 },
  }
  assert(atirar(mirandoCanto).obras[0].hp === 88, 'canto: o tiro tira 12 do núcleo')
  const vistoInteiro = { ...cantoBase, chaoVisto: new Uint8Array(cantoBase.chaoVisto.length).fill(1) }
  assert(chaoRevelado(vistoInteiro, 42, 42) && chaoRevelado(vistoInteiro, -45, -45), 'canto do quadrado entra no chão')
  assert(
    CELULAS_DO_DISCO.length === 12769 && CELULAS_DO_DISCO.some((celula) => celula.x === 42 && celula.z === 42),
    'névoa cobre os quatro cantos do quadrado',
  )

  const casaRuina = fundar({ ...createPartida(), unidades: [] }, 'nucleo', 0, 8)
  const idRuina = casaRuina.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo')?.id
  assert(idRuina !== undefined, 'ruína de teste tem núcleo')
  const ruinaAntiga = {
    ...casaRuina,
    lingotes: 3,
    obras: casaRuina.obras.map((obra) => (obra.id === idRuina ? { ...obra, hp: 0 } : obra)),
  }
  assert(!stepPartida(ruinaAntiga, INPUT_PARADO, 0.05).derrota, 'ruína antiga não mata ao permanecer')
  const reparada = repararObra(ruinaAntiga, idRuina)
  assert(
    reparada.lingotes === 0 && reparada.obras.find((obra) => obra.id === idRuina)?.hp === PARTIDA.nucleoHp,
    'reparar gasta 3 lingotes e reergue',
  )
  const semRecurso = repararObra({ ...ruinaAntiga, lingotes: 0, credito: 1 }, idRuina)
  assert(semRecurso.credito === 1 && semRecurso.obras.find((obra) => obra.id === idRuina)?.hp === 0, 'sem recurso não repara')
  const comLicenca = repararObra({ ...ruinaAntiga, lingotes: 0, credito: 2 }, idRuina)
  assert(
    comLicenca.credito === 0 && comLicenca.obras.find((obra) => obra.id === idRuina)?.hp === PARTIDA.nucleoHp,
    'reparar aceita 2 licenças',
  )
  const afasteNucleo = DIMENSOES_OBRA.nucleo[0] / 2 + PARTIDA.body + 0.05
  const tropaSobreRuina = {
    id: 9101,
    lado: 'aliado' as const,
    papel: 'tropa' as const,
    x: 0.2,
    z: 8.1,
    hp: 16,
    postura: 'ordens' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: true,
  }
  const mortaSobreRuina = { ...tropaSobreRuina, id: 9102, hp: 0 }
  const sobreRuina = repararObra(
    {
      ...ruinaAntiga,
      heroi: { ...ruinaAntiga.heroi, x: 0, z: 8, yaw: Math.PI },
      unidades: [tropaSobreRuina, mortaSobreRuina],
    },
    idRuina,
  )
  assert(
    Math.abs(sobreRuina.heroi.x) >= afasteNucleo - 1e-6 || Math.abs(sobreRuina.heroi.z - 8) >= afasteNucleo - 1e-6,
    'reparar afasta o herói da caixa da obra sólida',
  )
  const tropaAfastada = sobreRuina.unidades.find((unidade) => unidade.id === 9101)!
  assert(
    Math.abs(tropaAfastada.x) >= afasteNucleo - 1e-6 || Math.abs(tropaAfastada.z - 8) >= afasteNucleo - 1e-6,
    'reparar afasta unidade viva sobre a ruína',
  )
  const mortaIntacta = sobreRuina.unidades.find((unidade) => unidade.id === 9102)!
  assert(mortaIntacta.x === 0.2 && mortaIntacta.z === 8.1, 'unidade morta não é movida no reparo')
  const heroiLivre = stepPartida(
    ordenar(sobreRuina, [9101], { tipo: 'mover', x: 8, z: 8 }),
    { forward: true, back: false, strafe: 0 },
    0.5,
  )
  assert(
    Math.hypot(heroiLivre.heroi.x - sobreRuina.heroi.x, heroiLivre.heroi.z - sobreRuina.heroi.z) > 3,
    'herói sobre a ruína continua livre para andar após repararObra',
  )
  const tropaLivre = heroiLivre.unidades.find((unidade) => unidade.id === 9101)!
  assert(
    Math.hypot(tropaLivre.x - tropaAfastada.x, tropaLivre.z - tropaAfastada.z) > 2,
    'unidade afastada no reparo anda livremente',
  )
  const reparoSemCorpo = repararObra(
    { ...ruinaAntiga, semCorpo: true, heroi: { ...ruinaAntiga.heroi, x: 0, z: 8 } },
    idRuina,
  )
  assert(reparoSemCorpo.heroi.x === 0 && reparoSemCorpo.heroi.z === 8, 'semCorpo não move herói fantasma no reparo')
  const casaPortao = fundar(casaRuina, 'portao', 6, 8)
  const idPortao = casaPortao.obras.find((obra) => obra.tipo === 'portao')!.id
  const portaoReparado = repararObra(
    {
      ...casaPortao,
      lingotes: 3,
      heroi: { ...casaPortao.heroi, x: 6, z: 8 },
      obras: casaPortao.obras.map((obra) => (obra.id === idPortao ? { ...obra, hp: 0 } : obra)),
    },
    idPortao,
  )
  assert(portaoReparado.heroi.x === 6 && portaoReparado.heroi.z === 8, 'portão reparado não afasta o herói')
  const sitianteRuina = {
    id: 9100,
    lado: 'inimigo' as const,
    papel: 'sitiante' as const,
    x: 0,
    z: 8,
    hp: 20,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: true,
  }
  const caindo = {
    ...casaRuina,
    unidades: [sitianteRuina],
    obras: casaRuina.obras.map((obra) => (obra.id === idRuina ? { ...obra, hp: PARTIDA.danoSitio } : obra)),
  }
  assert(stepPartida(caindo, INPUT_PARADO, 0.05).derrota, 'núcleo que cai com o herói presente encerra')

  const torreAlvo = {
    id: 77,
    lado: 'nosso' as const,
    tipo: 'torre' as const,
    x: 10,
    z: 10,
    nivel: 1,
    hp: 40,
    maxHp: 40,
    gateApplied: false,
    cooldown: 0,
  }
  const ponto = aproximacaoDaObra(torreAlvo, 10, 0)
  assert(Math.abs(ponto.x - 10) < 0.05 && ponto.z < 10 - DIMENSOES_OBRA.torre[2] / 2, 'aproximação para no perímetro da torre')
  const heroiEncosto = createPartida().heroi
  let encosto: PartidaState = {
    ...createPartida(),
    unidades: [],
    obras: [{ ...torreAlvo, x: 20, z: 0 }],
    heroi: { ...heroiEncosto, x: 26, z: 0, yaw: Math.PI / 2 },
  }
  for (let i = 0; i < 200; i++) encosto = stepPartida(encosto, { forward: true, back: false, strafe: 0 }, 0.01)
  const folgaTorre = Math.abs(encosto.heroi.x - 20)
  const esperadaTorre = DIMENSOES_OBRA.torre[0] / 2 + PARTIDA.body
  assert(folgaTorre + 0.02 >= esperadaTorre && folgaTorre < esperadaTorre + 0.12, 'herói encosta na torre pelo tamanho real')

  // Fase 1 — Tempo de Construção Frágil (1-Hit Scaffold) + Cerco Simétrico Total
  let obraFraca = iniciarObra(fundar(createPartida(), 'nucleo', 0, -10), 'torre', 0, 6)
  const torreFraca = obraFraca.obras.find((o) => o.tipo === 'torre' && o.lado === 'nosso')!
  assert(obraEmConstrucao(torreFraca) && (torreFraca.construindoRestante ?? 0) === 5, 'torre nasce em construção de 5s')
  const inimigoPerto = {
    id: 901,
    lado: 'inimigo' as const,
    papel: 'sitiante' as const,
    x: 0,
    z: 6 + PARTIDA.nucleoContato - 0.1,
    hp: 30,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: true,
  }
  const umAtaqueDerruba = stepPartida({ ...obraFraca, unidades: [inimigoPerto], heroiPostura: 'calado' }, INPUT_PARADO, 0.1)
  const torreApos1Golpe = umAtaqueDerruba.obras.find((o) => o.id === torreFraca.id)!
  assert(torreApos1Golpe.hp === 0 && !obraEmConstrucao(torreApos1Golpe), 'um único ataque destrói construção em andaime')
  assert(umAtaqueDerruba.unidades[0].hp === 30, 'torre em construção não atira antes de ficar pronta')

  obraFraca = stepPartida({ ...obraFraca, unidades: [] }, INPUT_PARADO, 2.5)
  obraFraca = stepPartida(obraFraca, INPUT_PARADO, 2.6)
  const torrePronta = obraFraca.obras.find((o) => o.id === torreFraca.id)!
  assert(!obraEmConstrucao(torrePronta) && torrePronta.hp === 50, 'torre conclui construção após 5s')

  // Tiro do herói destrói obra inimiga em andaime com 1 único disparo (mesmo com 50 HP)
  const andaimeInimigo: PartidaState = {
    ...createPartida(),
    unidades: [],
    heroi: { ...createPartida().heroi, x: 0, z: 0, yaw: 0, pitch: 0 },
    obras: [
      {
        id: 902,
        lado: 'inimigo',
        tipo: 'torre',
        x: 0,
        z: 8,
        nivel: 1,
        hp: 50,
        maxHp: 50,
        gateApplied: false,
        cooldown: 0,
        construindoRestante: 4,
        construindoTotal: 5,
      },
    ],
  }
  const aposTiroAndaime = atirar(andaimeInimigo)
  assert(aposTiroAndaime.obras[0].hp === 0, 'tiro único do herói destrói obra inimiga em construção')

  // Construção ataca construção (torre nossa x quartel inimigo e torre inimiga x quartel nosso)
  let dueloObras: PartidaState = {
    ...fundar(createPartida(), 'nucleo', -20, -20),
    unidades: [],
    obras: [
      { id: 910, lado: 'nosso', tipo: 'nucleo', x: -20, z: -20, nivel: 1, hp: 100, maxHp: 100, gateApplied: false, cooldown: 0 },
      { id: 911, lado: 'nosso', tipo: 'torre', x: 0, z: 0, nivel: 1, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 },
      { id: 912, lado: 'inimigo', tipo: 'quartel', x: 0, z: 9, nivel: 1, hp: 40, maxHp: 40, gateApplied: false, cooldown: 0 },
      { id: 913, lado: 'inimigo', tipo: 'torre', x: 20, z: 0, nivel: 1, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 },
      { id: 914, lado: 'nosso', tipo: 'quartel', x: 20, z: 9, nivel: 1, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 },
    ],
  }
  dueloObras = marcarChao(dueloObras)
  dueloObras = stepPartida(dueloObras, INPUT_PARADO, 0.2)
  assert(dueloObras.obras.find((o) => o.id === 912)!.hp < 40, 'torre nossa ataca construção inimiga no alcance')
  assert(dueloObras.obras.find((o) => o.id === 914)!.hp < 50, 'torre inimiga ataca construção nossa no alcance')

  // Horda ataca construção nossa e tropa aliada ataca construção inimiga (atacarObra)
  let cercoMutuo: PartidaState = marcarChao({
    ...createPartida(),
    semCorpo: true,
    obras: [
      { id: 920, lado: 'nosso', tipo: 'quartel', x: 0, z: 40, nivel: 1, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 },
      { id: 921, lado: 'inimigo', tipo: 'quartel', x: 12, z: 0, nivel: 1, hp: 30, maxHp: 40, gateApplied: false, cooldown: 0 },
    ],
    unidades: [
      { id: 922, lado: 'inimigo', papel: 'horda', x: 0, z: 43, hp: 12, postura: 'automatico', ordem: null, cooldown: 0, segmentos: [], alerta: false },
      { id: 923, lado: 'aliado', papel: 'tropa', x: 6, z: 0, hp: 20, postura: 'ordens', ordem: null, cooldown: 0, segmentos: [], alerta: true },
    ],
  })
  cercoMutuo = ordenar(cercoMutuo, [923], { tipo: 'atacarObra', obraId: 921 })
  cercoMutuo = stepPartida(cercoMutuo, INPUT_PARADO, 2.5)
  assert(cercoMutuo.obras.find((o) => o.id === 920)!.hp < 50, 'horda desperta e ataca construção nossa')
  assert(cercoMutuo.obras.find((o) => o.id === 921)!.hp === 0, 'tropa aliada cerca e destrói construção inimiga')

  // Fases 3, 4 e 5 — Recursos Naturais, Água Rasa, Pulo em Construção, Subsolo e Fortaleza Nível 5 Editável
  let mundoVivo = fundar(createPartida(), 'nucleo', 0, -10)
  const nucleoTelhado = mundoVivo.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
  // Posiciona herói junto à face sul do nosso núcleo (z = -10 - 1 - 0.36 = -11.36) olhando para norte (yaw = 0) e pula
  mundoVivo = {
    ...mundoVivo,
    unidades: [],
    heroi: { ...mundoVivo.heroi, x: 0, z: -11.4, y: 0, vy: 0, yaw: 0 },
  }
  mundoVivo = pular(mundoVivo)
  let subiuNoNucleo = false
  for (let passo = 0; passo < 30; passo++) {
    mundoVivo = stepPartida(mundoVivo, { forward: true, back: false, strafe: 0 }, 0.05)
    if (Math.abs(mundoVivo.heroi.z - nucleoTelhado.z) < 0.8 && mundoVivo.heroi.y >= 1.59 && mundoVivo.heroi.vy === 0) {
      subiuNoNucleo = true
      break
    }
  }
  assert(subiuNoNucleo, 'o pulo sobe em cima da nossa própria construção')

  // Água rasa reduz deslocamento em relação ao terreno seco
  const seco = stepPartida(
    { ...createPartida(), lagoas: [], unidades: [], heroi: { ...createPartida().heroi, x: 20, z: -16, yaw: 0 } },
    { forward: true, back: false, strafe: 0 },
    0.2,
  )
  const molhado = stepPartida(
    {
      ...createPartida(),
      lagoas: [{ x: 20, z: -16, rx: 6, rz: 6 }],
      unidades: [],
      heroi: { ...createPartida().heroi, x: 20, z: -16, yaw: 0 },
    },
    { forward: true, back: false, strafe: 0 },
    0.2,
  )
  assert(molhado.heroi.z - -16 < (seco.heroi.z - -16) * 0.7, 'água rasa desacelera o avanço na superfície')

  // Subsolo via Mina concluída + mineração subterrânea em 1ª pessoa
  let comMina = fundar(fundar(createPartida(), 'nucleo', 0, -10), 'mina', 12, -10)
  comMina = alternarSubsolo(comMina)
  assert(comMina.heroi.y < -3 && comMina.subsoloCentro !== null, 'desce ao subsolo pela mina concluída')
  const deVoltaSuperficie = alternarSubsolo(comMina)
  assert(deVoltaSuperficie.heroi.y === 0, 'retorna do subsolo para a superfície')

  // Evolução até Nível 5 gera fortaleza entrável e editável bloco a bloco (com créditos ou madeira+ouro)
  let rumoNv5: PartidaState = {
    ...fundar(createPartida(), 'nucleo', 0, -14),
    unidades: [],
    credito: 2,
    madeira: 10,
    ouro: 10,
  }
  const idCastelo = rumoNv5.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!.id
  for (let n = 0; n < 4; n++) rumoNv5 = evoluir(rumoNv5, idCastelo)
  const casteloNv5 = rumoNv5.obras.find((o) => o.id === idCastelo)!
  assert(casteloNv5.nivel === 5 && casteloNv5.blocosNv5 !== undefined, 'evoluir até nível 5 cria estrutura de bloquinhos')

  // Entrar caminhando pela porta sul aberta (z = -14 + 3.6 -> z = -14)
  let entrando: PartidaState = {
    ...rumoNv5,
    heroi: { ...rumoNv5.heroi, x: 0, z: -10.2, y: 0, vy: 0, yaw: Math.PI },
  }
  for (let i = 0; i < 10; i++) {
    entrando = stepPartida(entrando, { forward: true, back: false, strafe: 0 }, 0.05)
  }
  assert(Math.hypot(entrando.heroi.x - 0, entrando.heroi.z - -14) < 1.5, 'herói entra caminhando dentro da construção Nível 5')

  // Editar blocos da construção Nível 5 (remover e adicionar bloco + bloquear com madeira === 0 e no subsolo)
  const madeiraAntes = entrando.madeira
  const esculpido = editarBlocoObra(entrando, idCastelo, 0, 1, 2, 'remover')
  assert(esculpido.madeira === madeiraAntes + 1 && esculpido.versaoSolidos > entrando.versaoSolidos, 'remover bloco da construção Nv.5 devolve madeira e atualiza sólidos')
  const ampliado = editarBlocoObra(esculpido, idCastelo, 4, 0, 4, 'adicionar')
  assert(ampliado.versaoSolidos > esculpido.versaoSolidos && ampliado.madeira === esculpido.madeira - 1, 'adicionar bloco na construção Nv.5 debita 1 madeira e cria degrau sólido')

  const semMadeira = { ...ampliado, madeira: 0 }
  const bloqueadoSemMadeira = editarBlocoObra(semMadeira, idCastelo, 5, 0, 4, 'adicionar')
  assert(
    bloqueadoSemMadeira === semMadeira && bloqueadoSemMadeira.versaoSolidos === semMadeira.versaoSolidos,
    'não permite adicionar bloco com madeira === 0',
  )

  const noSubsoloEdit = { ...ampliado, madeira: 5, heroi: { ...ampliado.heroi, y: -3.2 } }
  assert(editarBlocoObra(noSubsoloEdit, idCastelo, 5, 0, 4, 'adicionar') === noSubsoloEdit, 'bloqueia edição de bloco da superfície enquanto herói está no subsolo')

  assert(PARTIDA.mostrarFaixaTiroVisual === false, 'faixa amarela visual no chão desligada por padrão')
  assert(alcanceDoTiro(0, 0, 0) === PARTIDA.visao.heroi, 'matemática de alcanceDoTiro permanece íntegra sem faixa visual')

  // Fase 2: Seleção RTS (clicar fora deseleciona, 1/algumas/todas, Shift alterna) + Formação & Separação real de tropas
  assert(PARTIDA.allyCap >= 24, 'teto de aliados ampliado para pelotões')
  let basePelotao = definirOlhar(fundar({ ...createPartida(), credito: 30 }, 'nucleo', 0, -10), 'imperio')
  const nucPelotaoId = basePelotao.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!.id
  for (let i = 0; i < 5; i++) basePelotao = criarTropa(basePelotao, nucPelotaoId)
  const cincoTropas = basePelotao.unidades.filter((u) => u.lado === 'aliado' && u.hp > 0)
  assert(cincoTropas.length === 5, 'recruta 5 tropas visíveis distintas')

  // Testa alcance real do teto allyCap = 24 e bloqueio da 25ª tropa
  let ateCap = basePelotao
  for (let i = 5; i < PARTIDA.allyCap + 2; i += 1) ateCap = criarTropa(ateCap, nucPelotaoId)
  assert(
    ateCap.unidades.filter((u) => u.lado === 'aliado' && u.hp > 0).length === PARTIDA.allyCap,
    'criarTropa permite recrutar até allyCap = 24 e bloqueia além do limite',
  )
  let menorDistSpawn = Number.POSITIVE_INFINITY
  for (let i = 0; i < cincoTropas.length; i++) {
    for (let j = i + 1; j < cincoTropas.length; j++) {
      menorDistSpawn = Math.min(menorDistSpawn, Math.hypot(cincoTropas[i].x - cincoTropas[j].x, cincoTropas[i].z - cincoTropas[j].z))
    }
  }
  assert(menorDistSpawn >= PARTIDA.tropaRaioSeparacao - 1e-3, 'tropas nascem já separadas sem empilhar num único boneco')

  const slotsUnico = pontosFormacaoTropa(10, 20, 1)
  assert(slotsUnico.length === 1 && slotsUnico[0].x === 10 && slotsUnico[0].z === 20, 'tropa única obedece ponto exato')

  const idsCinco = cincoTropas.map((u) => u.id)
  let marcha = ordenar(basePelotao, idsCinco, { tipo: 'mover', x: 10, z: 20 })
  for (let s = 0; s < 40; s++) marcha = stepPartida(marcha, INPUT_PARADO, 0.1)
  const cincoAposMarcha = marcha.unidades.filter((u) => idsCinco.includes(u.id) && u.hp > 0)
  let menorDistMarcha = Number.POSITIVE_INFINITY
  for (let i = 0; i < cincoAposMarcha.length; i++) {
    for (let j = i + 1; j < cincoAposMarcha.length; j++) {
      menorDistMarcha = Math.min(
        menorDistMarcha,
        Math.hypot(cincoAposMarcha[i].x - cincoAposMarcha[j].x, cincoAposMarcha[i].z - cincoAposMarcha[j].z),
      )
    }
  }
  assert(
    menorDistMarcha >= 0.75,
    `5 tropas ordenadas ao mesmo ponto mantêm formação separada (minDist=${menorDistMarcha.toFixed(2)})`,
  )

  let sobrepostas: PartidaState = {
    ...basePelotao,
    unidades: cincoTropas.slice(0, 3).map((u) => ({ ...u, x: 6, z: 6, ordem: null, rota: null })),
  }
  for (let s = 0; s < 10; s++) sobrepostas = stepPartida(sobrepostas, INPUT_PARADO, 0.05)
  const separadas = sobrepostas.unidades.filter((u) => u.lado === 'aliado' && u.hp > 0)
  let minSep = Number.POSITIVE_INFINITY
  for (let i = 0; i < separadas.length; i++) {
    for (let j = i + 1; j < separadas.length; j++) {
      minSep = Math.min(minSep, Math.hypot(separadas[i].x - separadas[j].x, separadas[i].z - separadas[j].z))
    }
  }
  assert(minSep >= 0.65, 'steering de separação afasta tropas sobrepostas')

  let sel = selecionarAoClicarHeroi({ heroi: false, tropas: [] }, false)
  assert(sel.heroi === true && sel.tropas.length === 0, 'clicar no herói seleciona herói exclusivamente')
  sel = selecionarAoClicarUnidade(sel, idsCinco[0], true)
  assert(sel.heroi === true && sel.tropas.length === 1 && sel.tropas[0] === idsCinco[0], 'Shift+clique adiciona 1 tropa mantendo herói')
  sel = selecionarAoClicarChaoVazio(sel, false)
  assert(sel.heroi === false && sel.tropas.length === 0, 'clique no chão vazio deseleciona herói e tropas')
  const emModoMover = selecionarAoClicarChaoVazio({ heroi: true, tropas: [idsCinco[0]] }, true)
  assert(emModoMover.heroi && emModoMover.tropas.length === 1, 'modo Mover preserva seleção ao clicar no destino')
  sel = selecionarAoClicarUnidade(emModoMover, idsCinco[2], false)
  assert(!sel.heroi && sel.tropas.length === 1 && sel.tropas[0] === idsCinco[2], 'clique simples numa tropa seleciona apenas 1 soldado')
  const estadoGrupo: PartidaState = {
    ...basePelotao,
    heroi: { ...basePelotao.heroi, x: 20, z: 20 },
    unidades: [
      { ...cincoTropas[0], x: 1, z: 1 },
      { ...cincoTropas[1], x: 2, z: 2 },
      { ...cincoTropas[2], x: -12, z: -12 },
    ],
  }
  const porCaixa = selecionarPorRetanguloEstado(estadoGrupo, { heroi: false, tropas: [] }, 0, 0, 3, 3, false)
  assert(porCaixa.tropas.length === 2 && !porCaixa.heroi, 'retângulo seleciona subgrupo de tropas')
  const comHeroiCaixa = selecionarPorRetanguloEstado(estadoGrupo, porCaixa, 18, 18, 22, 22, true)
  assert(comHeroiCaixa.heroi && comHeroiCaixa.tropas.length === 2, 'Shift+retângulo inclui herói mantendo tropas')
  const shiftDesmarcaTropa = selecionarAoClicarUnidade(comHeroiCaixa, cincoTropas[0].id, true)
  assert(shiftDesmarcaTropa.tropas.length === 1 && !shiftDesmarcaTropa.tropas.includes(cincoTropas[0].id), 'Shift+clique desmarca tropa já selecionada')
  const caixaVazia = selecionarPorRetanguloEstado(estadoGrupo, comHeroiCaixa, -40, -40, -30, -30, false)
  assert(!caixaVazia.heroi && caixaVazia.tropas.length === 0, 'retângulo sobre área vazia limpa seleção')

  // Fase 3: Ghost Blueprint DbC (podeFundarEm), Blocos Livres no Mapa (Madeira/Pedra/Ouro) e Linha 360°
  let f3: PartidaState = { ...createPartida(), madeira: 40, lingotes: 20, ouro: 20, credito: 10, unidades: [] }
  assert(podeFundarEm(f3, 'nucleo', 8, 8).ok, 'podeFundarEm aceita local limpo para Núcleo')
  assert(!podeFundarEm(f3, 'nucleo', 0, 0).ok, 'podeFundarEm bloqueia em cima do herói')
  f3 = fundar(f3, 'nucleo', 8, 8)
  assert(!podeFundarEm(f3, 'nucleo', -8, -8).ok, 'podeFundarEm bloqueia segundo núcleo')
  const comBlocoMad = editarBlocoMundo(f3, 4, 0, 4, 'adicionar', 'madeira')
  assert(
    comBlocoMad.madeira === f3.madeira - 1 &&
      comBlocoMad.blocosMapa[chaveBlocoMundo(4, 0, 4)]?.material === 'madeira' &&
      comBlocoMad.versaoSolidos > f3.versaoSolidos,
    'editarBlocoMundo coloca bloco de madeira debitando 1 madeira',
  )
  assert(!podeFundarEm(comBlocoMad, 'torre', 4, 4).ok, 'podeFundarEm respeita blocos livres no terreno')
  const comBlocoPedra = editarBlocoMundo(comBlocoMad, 4, 1, 4, 'adicionar', 'pedra')
  assert(comBlocoPedra.lingotes === f3.lingotes - 1, 'bloco de pedra consome 1 lingote')
  const comBlocoOuro = editarBlocoMundo(comBlocoPedra, 4, 2, 4, 'adicionar', 'ouro')
  assert(comBlocoOuro.ouro === f3.ouro - 1, 'bloco de ouro consome 1 ouro')
  const removidoOuro = editarBlocoMundo(comBlocoOuro, 4, 2, 4, 'remover', 'madeira')
  assert(
    removidoOuro.ouro === f3.ouro && !removidoOuro.blocosMapa[chaveBlocoMundo(4, 2, 4)],
    'remover bloco de ouro estorna 1 ouro exato',
  )
  const semMadMundo = { ...f3, madeira: 0, lingotes: 0, ouro: 0 }
  assert(editarBlocoMundo(semMadMundo, 6, 0, 6, 'adicionar', 'madeira') === semMadMundo, 'editarBlocoMundo recusa adicionar com madeira 0')
  assert(editarBlocoMundo(semMadMundo, 6, 0, 6, 'adicionar', 'pedra') === semMadMundo, 'editarBlocoMundo recusa adicionar pedra com lingotes 0')
  assert(editarBlocoMundo(f3, 0, 0, 0, 'adicionar', 'madeira') === f3, 'editarBlocoMundo recusa colocar bloco sobre o corpo do herói')
  const f3Sub = { ...f3, heroi: { ...f3.heroi, y: -3.2 } }
  assert(editarBlocoMundo(f3Sub, 6, 0, 6, 'adicionar', 'madeira') === f3Sub, 'editarBlocoMundo recusa edição de superfície estando no subsolo')
  const linhaDiag = construirLinhaBlocos(f3, 2, 10, 6, 14, 2, 'madeira')
  assert(Object.keys(linhaDiag.blocosMapa).length === 18, 'linha diagonal 360° 4-conexa altura 2 coloca 18 blocos (9 colunas x 2)')
  assert(linhaDiag.madeira === f3.madeira - 18, 'construirLinhaBlocos debita exatamente o custo total da linha')
  const semRecLinha = construirLinhaBlocos({ ...f3, madeira: 3 }, 2, 10, 6, 14, 2, 'madeira')
  assert(Object.keys(semRecLinha.blocosMapa).length === 0, 'construirLinhaBlocos é atômico e não constrói parcialmente sem recurso')

  // Fase 4: LoS 2.5D por altura (Trincheira 1b vs Muralha 2b vs Torre Nv5 3b vs 4b + Herói + Cerco a blocos)
  let f4: PartidaState = {
    ...createPartida(),
    madeira: 60,
    lingotes: 30,
    ouro: 30,
    credito: 12,
    heroi: { ...createPartida().heroi, x: -35, z: -35, y: 0 },
    unidades: [],
  }
  f4 = fundar(f4, 'nucleo', -30, -30)
  f4 = fundar(f4, 'torre', 0, 0)
  const torreF4Id = f4.obras.find((o) => o.lado === 'nosso' && o.tipo === 'torre')!.id
  const alvoOculto = {
    id: 901,
    lado: 'inimigo' as const,
    papel: 'isca' as const,
    x: 0,
    z: 8,
    hp: 30,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [],
    alerta: false,
  }
  f4 = marcarChao({ ...f4, unidades: [alvoOculto] })

  // 1 bloco (trincheira) em z = 4: Torre Nv1 e Herói no chão enxergam/atiram por cima!
  let comTrincheira = construirLinhaBlocos(f4, -3, 4, 3, 4, 1, 'madeira')
  assert(inimigoVisivel(comTrincheira, alvoOculto), 'Torre Nv1 enxerga inimigo atrás de trincheira de 1 bloco')
  const heroiSobreTrincheira = atirar({
    ...comTrincheira,
    heroi: { ...comTrincheira.heroi, x: 0, z: 0, y: 0, yaw: 0, pitch: 0, shootCooldown: 0 },
    unidades: [{ ...alvoOculto, hp: 30 }],
  })
  assert(heroiSobreTrincheira.unidades.find((u) => u.id === 901)!.hp < 30, 'Herói no chão atira por cima de trincheira de 1 bloco')
  comTrincheira = stepPartida(comTrincheira, INPUT_PARADO, 0.1)
  assert(
    comTrincheira.unidades.find((u) => u.id === 901)!.hp < 30,
    'Torre Nv1 atira por cima de trincheira de 1 bloco',
  )

  // 2 blocos (muralha) em z = 4: Torre Nv1 NÃO enxerga e NÃO atira!
  let comMuralha2 = construirLinhaBlocos(f4, -3, 4, 3, 4, 2, 'pedra')
  assert(!inimigoVisivel(comMuralha2, alvoOculto), 'Muralha de 2 blocos oculta inimigo da visão da Torre Nv1')
  comMuralha2 = stepPartida(comMuralha2, INPUT_PARADO, 0.1)
  assert(
    comMuralha2.unidades.find((u) => u.id === 901)!.hp === 30,
    'Torre Nv1 não consegue atirar através de muralha de 2 blocos',
  )

  // Evoluir a mesma torre para Nv5: enxerga e atira acima de 2 e 3 blocos, mas bloqueia em 4 blocos!
  let comMuralha3 = construirLinhaBlocos(f4, -3, 4, 3, 4, 3, 'pedra')
  for (let n = 0; n < 4; n += 1) comMuralha3 = evoluir(comMuralha3, torreF4Id)
  const torreNv5F4 = comMuralha3.obras.find((o) => o.id === torreF4Id)!
  assert(torreNv5F4.nivel === 5 && torreNv5F4.blocosNv5 !== undefined, 'Torre evolui para Nv5 entrável')
  assert(inimigoVisivel(comMuralha3, alvoOculto), 'Torre Nv5 enxerga inimigo atrás de muralha de 3 blocos')
  comMuralha3 = stepPartida(comMuralha3, INPUT_PARADO, 0.1)
  assert(
    comMuralha3.unidades.find((u) => u.id === 901)!.hp < 30,
    'Torre Nv5 atira por cima de muralha de 3 blocos',
  )

  let comMuralha4: PartidaState = { ...comMuralha3, unidades: [{ ...alvoOculto, hp: 30 }] }
  for (let gx = -3; gx <= 3; gx += 1) comMuralha4 = editarBlocoMundo(comMuralha4, gx, 3, 4, 'adicionar', 'pedra')
  assert(!inimigoVisivel(comMuralha4, alvoOculto), 'Muralha de 4 blocos oclui até a Torre Nv5')

  // Herói no chão (y=0) não atravessa muralha de 2 blocos no tiro, mas elevado (y=2) mirando para baixo acerta por cima!
  const heroiLoS: PartidaState = {
    ...comMuralha2,
    heroi: { ...comMuralha2.heroi, x: 0, z: 0, y: 0, yaw: 0, pitch: 0, shootCooldown: 0 },
    unidades: [{ ...alvoOculto, hp: 30 }],
  }
  const tiroChaoBloq = atirar(heroiLoS)
  assert(tiroChaoBloq.unidades.find((u) => u.id === 901)!.hp === 30, 'herói no chão não atira através de muralha de 2 blocos')
  const pitchDoAlto = Math.atan2(0.8 - (PARTIDA.eyeY + 2), 8)
  const tiroAlto = atirar({ ...heroiLoS, heroi: { ...heroiLoS.heroi, y: 2, pitch: pitchDoAlto, shootCooldown: 0 } })
  assert(tiroAlto.unidades.find((u) => u.id === 901)!.hp < 30, 'herói elevado (y=2) atira por cima de muralha de 2 blocos')

  // Simetria: torre inimiga Nv1 também fica bloqueada por muralha de 2 blocos protegendo o herói
  let f4Simetria: PartidaState = {
    ...createPartida(),
    madeira: 30,
    lingotes: 30,
    heroi: { ...createPartida().heroi, x: 0, z: 0, y: 0, army: 20 },
    obras: [
      {
        id: 700,
        lado: 'inimigo',
        tipo: 'torre',
        x: 0,
        z: 8,
        nivel: 1,
        hp: 50,
        maxHp: 50,
        gateApplied: false,
        cooldown: 0,
      },
    ],
    unidades: [],
  }
  f4Simetria = construirLinhaBlocos(f4Simetria, -3, 4, 3, 4, 2, 'pedra')
  const aposTorreInimiga = stepPartida(f4Simetria, INPUT_PARADO, 0.2)
  assert(aposTorreInimiga.heroi.army === 20, 'torre inimiga Nv1 também respeita oclusão de muralha de 2 blocos')

  // Fase 5: Todos os 7 tipos evoluem Nv1->5 com blueprints entráveis distintos + Portão Nv5 +10 + Anti-exploit de madeira
  let f5: PartidaState = { ...createPartida(), credito: 50, madeira: 40, ouro: 40, unidades: [] }
  const posicoes7: readonly [PecaId, number, number][] = [
    ['nucleo', -20, -20],
    ['torre', -10, -20],
    ['portao', 0, -20],
    ['quartel', 10, -20],
    ['britador', 20, -20],
    ['serraria', -20, -10],
    ['mina', -10, -10],
  ]
  for (const [tipo, px, pz] of posicoes7) {
    f5 = fundar(f5, tipo, px, pz)
    const id = f5.obras.find((o) => o.lado === 'nosso' && o.tipo === tipo)!.id
    for (let k = 0; k < 4; k += 1) f5 = evoluir(f5, id)
    const evo = f5.obras.find((o) => o.id === id)!
    assert(evo.nivel === 5 && evo.blocosNv5 !== undefined, `${tipo} evolui até Nv5 com estrutura voxel entrável`)
  }
  // Portão Nv5 dispara +10 ao atravessar seu corredor central aberto
  const armyAntesPortao5 = f5.heroi.army
  const atravessouPortao5 = stepPartida(
    { ...f5, heroi: { ...f5.heroi, x: 0, z: -20, y: 0, vy: 0 } },
    INPUT_PARADO,
    0.05,
  )
  assert(atravessouPortao5.heroi.army === armyAntesPortao5 + 10, 'Portão Nv5 permanece transitável e concede +10')

  // Anti-exploit: desmontar 15 blocos de uma obra Nv5 rende no máximo COTA_ESTORNO_BLUEPRINT_NV5 madeiras
  const nuc5 = f5.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
  let desmontando = { ...f5, madeira: 0 }
  let removidos = 0
  for (let bx = 0; bx < 7 && removidos < 15; bx += 1) {
    for (let bz = 0; bz < 7 && removidos < 15; bz += 1) {
      const prox = editarBlocoObra(desmontando, nuc5.id, bx, 0, bz, 'remover')
      if (prox !== desmontando) {
        desmontando = prox
        removidos += 1
      }
    }
  }
  assert(
    removidos >= 10 && desmontando.madeira <= COTA_ESTORNO_BLUEPRINT_NV5,
    `desmontar ${removidos} blocos Nv5 respeita teto anti-exploit de ${COTA_ESTORNO_BLUEPRINT_NV5} madeiras (obteve ${desmontando.madeira})`,
  )

  // Fase 6: Consagração de estruturas manuais (BFS 3D) em Núcleo/Torre + edição pós-consagração + regra de Núcleo único
  let f6: PartidaState = { ...createPartida(), madeira: 60, lingotes: 40, ouro: 40, credito: 10, unidades: [] }
  // Monta estrutura manual de 12 blocos (2x3 base x 2 altura) em x=10..11, z=10..12, y=0..1
  for (let gx = 10; gx <= 11; gx += 1) {
    for (let gz = 10; gz <= 12; gz += 1) {
      for (let gy = 0; gy <= 1; gy += 1) {
        f6 = editarBlocoMundo(f6, gx, gy, gz, 'adicionar', 'pedra')
      }
    }
  }
  assert(Object.keys(f6.blocosMapa).length === 12, '12 blocos manuais colocados para consagração')
  assert(podeConsagrarEm(f6, 10, 0, 10, 'nucleo').ok, 'estrutura manual 12b altura 2 é elegível como Núcleo')
  f6 = consagrarEstruturaManual(f6, 10, 0, 10, 'nucleo')
  assert(Object.keys(f6.blocosMapa).length === 0, 'blocos consagrados são transferidos de blocosMapa para a obra')
  const nucleoCustom = f6.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
  assert(
    nucleoCustom !== undefined &&
      nucleoCustom.blocosLivres?.length === 12 &&
      nucleoCustom.maxHp === 12 * 42,
    'Núcleo consagrado preserva todos os 12 blocos de pedra e herda soma de HP (504)',
  )
  // Núcleo consagrado recruta tropa sem prender
  const comTropaCustom = criarTropa(f6, nucleoCustom.id)
  assert(comTropaCustom.unidades.some((u) => u.lado === 'aliado' && u.hp > 0), 'Núcleo consagrado recruta tropa')

  // Segunda estrutura manual com 12 blocos (>= minBlocos do Núcleo) NÃO pode virar segundo Núcleo, mas estrutura >=6b vira Torre!
  for (let gx = 20; gx <= 21; gx += 1) {
    for (let gz = 10; gz <= 12; gz += 1) {
      for (let gy = 0; gy <= 1; gy += 1) {
        f6 = editarBlocoMundo(f6, gx, gy, gz, 'adicionar', 'madeira')
      }
    }
  }
  const checkDupNucleo = podeConsagrarEm(f6, 20, 0, 10, 'nucleo')
  assert(
    !checkDupNucleo.ok && Boolean(checkDupNucleo.motivo?.includes('Já existe um Núcleo')),
    'regra de Núcleo único bloqueia consagrar segundo Núcleo mesmo com >= 12 blocos',
  )

  for (let gy = 0; gy <= 2; gy += 1) {
    f6 = editarBlocoMundo(f6, 16, gy, 10, 'adicionar', 'ouro')
    f6 = editarBlocoMundo(f6, 17, gy, 10, 'adicionar', 'ouro')
  }
  assert(podeConsagrarEm(f6, 16, 0, 10, 'torre').ok, 'estrutura manual 6b altura 3 é elegível como Torre')
  f6 = consagrarEstruturaManual(f6, 16, 0, 10, 'torre')
  const torreCustom = f6.obras.find((o) => o.lado === 'nosso' && o.tipo === 'torre')!
  assert(torreCustom !== undefined && torreCustom.blocosLivres?.length === 6, 'Torre manual consagrada com 6 blocos de ouro')

  // Evoluir obra consagrada Nv1 -> Nv5 preserva blocosLivres sem sobrescrever com blueprint Nv5 e aumenta maxHp
  let evoCustom = f6
  for (let k = 0; k < 4; k += 1) evoCustom = evoluir(evoCustom, torreCustom.id)
  const torreCustomNv5 = evoCustom.obras.find((o) => o.id === torreCustom.id)!
  assert(
    torreCustomNv5.nivel === 5 &&
      torreCustomNv5.blocosNv5 === undefined &&
      torreCustomNv5.blocosLivres?.length === 6 &&
      torreCustomNv5.maxHp > torreCustom.maxHp,
    'evoluir obra consagrada até Nv5 preserva blocosLivres e escala HP sem sobrescrever com template Nv5',
  )

  // Edição pós-consagração de obra livre (adicionar e remover bloco + proteger último bloco)
  const ouroAntesEdit = f6.ouro
  const editAdd = editarBlocoObraLivre(f6, torreCustom.id, 16, 3, 10, 'adicionar', 'ouro')
  assert(
    editAdd.ouro === ouroAntesEdit - 1 &&
      editAdd.obras.find((o) => o.id === torreCustom.id)!.blocosLivres?.length === 7,
    'editarBlocoObraLivre adiciona bloco à obra consagrada debitando recurso',
  )
  const editRem = editarBlocoObraLivre(editAdd, torreCustom.id, 16, 3, 10, 'remover', 'ouro')
  assert(
    editRem.ouro === ouroAntesEdit &&
      editRem.obras.find((o) => o.id === torreCustom.id)!.blocosLivres?.length === 6,
    'editarBlocoObraLivre remove bloco e estorna recurso exato',
  )
  let quaseVazia = editRem
  for (const b of torreCustom.blocosLivres!.slice(1)) {
    quaseVazia = editarBlocoObraLivre(quaseVazia, torreCustom.id, b.x, b.y, b.z, 'remover')
  }
  assert(quaseVazia.obras.find((o) => o.id === torreCustom.id)!.blocosLivres?.length === 1, 'reduz até 1 bloco restante')
  assert(
    editarBlocoObraLivre(quaseVazia, torreCustom.id, torreCustom.blocosLivres![0].x, torreCustom.blocosLivres![0].y, torreCustom.blocosLivres![0].z, 'remover') === quaseVazia,
    'editarBlocoObraLivre protege último bloco restante',
  )

  // Estrutura longa 10x2 (> 7x7) preserva blocosLivres, aproximacaoDaObra usa meiaLivre e pátio 9x9 não aprisiona tropa no spawn
  let f6Grande: PartidaState = { ...createPartida(), madeira: 60, credito: 10, ouro: 20, unidades: [], heroi: { ...createPartida().heroi, x: -30, z: -30 } }
  for (let gx = -5; gx <= 4; gx += 1) {
    f6Grande = editarBlocoMundo(f6Grande, gx, 0, 8, 'adicionar', 'madeira')
    f6Grande = editarBlocoMundo(f6Grande, gx, 1, 8, 'adicionar', 'madeira')
  }
  f6Grande = consagrarEstruturaManual(f6Grande, 0, 0, 8, 'nucleo')
  const nucGrande = f6Grande.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
  assert(nucGrande.blocosLivres?.length === 20, 'estrutura 10x2 conserva todos os 20 blocos sem truncar em 7x7')
  assert(
    aproximacaoDaObra(nucGrande, 12, 8).x >= 5.0,
    'aproximacaoDaObra respeita largura estendida da estrutura consagrada 10x2',
  )
  let f6Pateo: PartidaState = {
    ...createPartida(),
    madeira: 80,
    credito: 10,
    ouro: 20,
    recursos: [],
    obras: [],
    unidades: [],
    heroi: { ...createPartida().heroi, x: -30, z: -30 },
  }
  for (let gx = -4; gx <= 4; gx += 1) {
    f6Pateo = editarBlocoMundo(f6Pateo, gx, 0, 4, 'adicionar', 'madeira')
    f6Pateo = editarBlocoMundo(f6Pateo, gx, 0, 12, 'adicionar', 'madeira')
  }
  for (let gz = 5; gz <= 11; gz += 1) {
    f6Pateo = editarBlocoMundo(f6Pateo, -4, 0, gz, 'adicionar', 'madeira')
    f6Pateo = editarBlocoMundo(f6Pateo, 4, 0, gz, 'adicionar', 'madeira')
  }
  f6Pateo = editarBlocoMundo(f6Pateo, -4, 1, 4, 'adicionar', 'madeira')
  f6Pateo = consagrarEstruturaManual(f6Pateo, -4, 0, 4, 'nucleo')
  const nucPateo = f6Pateo.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
  const tropaFora = criarTropa(f6Pateo, nucPateo.id)
  const soldadoFora = tropaFora.unidades.find((u) => u.lado === 'aliado' && u.hp > 0)!
  assert(
    soldadoFora !== undefined &&
      Math.max(Math.abs(soldadoFora.x - nucPateo.x), Math.abs(soldadoFora.z - nucPateo.z)) >= 4.9,
    'tropa recrutada em pátio consagrado 9x9 nasce fora do perímetro sem aprisionamento',
  )

  // Cerco inimigo contra muralhas fechadas: Madeira (18 HP) cede antes de Pedra (42 HP) sem travar a leva
  const criarCenarioCercoMuro = (mat: 'madeira' | 'pedra'): PartidaState => {
    let st: PartidaState = {
      ...createPartida(),
      madeira: 80,
      lingotes: 80,
      ouro: 20,
      heroi: { ...createPartida().heroi, x: -35, z: -35 },
      obras: [],
      unidades: [],
    }
    st = fundar(st, 'nucleo', 0, 0)
    // Cerca o núcleo completamente com anel fechado em raio 3 (x = -3..3, z = -3..3)
    st = construirLinhaBlocos(st, -3, -3, 3, -3, 1, mat)
    st = construirLinhaBlocos(st, -3, 3, 3, 3, 1, mat)
    st = construirLinhaBlocos(st, -3, -2, -3, 2, 1, mat)
    st = construirLinhaBlocos(st, 3, -2, 3, 2, 1, mat)
    return {
      ...st,
      unidades: [
        {
          id: 950,
          lado: 'inimigo',
          papel: 'sitiante',
          x: 0,
          z: 4.1,
          hp: 40,
          postura: 'automatico',
          ordem: null,
          cooldown: 0,
          segmentos: [],
          alerta: true,
        },
      ],
    }
  }
  let cercoMad = criarCenarioCercoMuro('madeira')
  let cercoPed = criarCenarioCercoMuro('pedra')
  const blocosMadAntes = Object.keys(cercoMad.blocosMapa).length
  const blocosPedAntes = Object.keys(cercoPed.blocosMapa).length
  for (let s = 0; s < 12; s += 1) {
    cercoMad = stepPartida(cercoMad, INPUT_PARADO, 0.3)
    cercoPed = stepPartida(cercoPed, INPUT_PARADO, 0.3)
  }
  assert(
    Object.keys(cercoMad.blocosMapa).length < blocosMadAntes,
    'sitiante bloqueado abre brecha na muralha de madeira (18 HP)',
  )
  assert(
    Object.keys(cercoPed.blocosMapa).length === blocosPedAntes,
    'muralha de pedra (42 HP) resiste por mais tempo ao mesmo cerco que a madeira',
  )

  vigiaDeVerdade()
}

function vigiaDeVerdade() {
  const cenaTiro = {
    ...createPartida(),
    olhar: 'primeira' as const,
    obras: createPartida().obras.filter((obra) => obra.lado !== 'inimigo'),
    unidades: [] as PartidaState['unidades'],
    heroi: { ...createPartida().heroi, x: 0, z: 0, y: 0, yaw: Math.PI, pitch: 0, shootCooldown: 0, army: 10 },
  }
  const hordaTiro = {
    id: 501,
    lado: 'inimigo' as const,
    papel: 'horda' as const,
    x: 0,
    z: 10,
    hp: 40,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: true,
  }
  const antesTiro: PartidaState = { ...cenaTiro, unidades: [hordaTiro], blocosMapa: {} }
  assert(!antesTiro.obras.some((obra) => obra.lado !== 'inimigo' && obra.tipo === 'torre'), 'fixture sem torre nossa')
  const depoisTiro = stepPartida(antesTiro, INPUT_PARADO, PARTIDA.dtMax)
  const ferida = depoisTiro.unidades.find((unidade) => unidade.id === 501)
  assert(ferida !== undefined && ferida.hp === 28, 'vigia do herói tira 12')
  assert(Math.abs(depoisTiro.heroi.yaw - yawAte(0, 0, 0, 10)) < 1e-6, 'vigia vira o yaw')
  assert(
    depoisTiro.heroi.shootCooldown === PARTIDA.shootCooldown - PARTIDA.dtMax,
    'recarga da vigia desconta o passo',
  )
  assert(depoisTiro.heroi.x === 0 && depoisTiro.heroi.z === 0, 'vigia parada não anda')

  const casaVigia = fundar({ ...createPartida(), credito: 4, unidades: [], obras: [], blocosMapa: {} }, 'nucleo', 0, 30)
  const idCasa = casaVigia.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo')!.id
  const comSoldado = criarTropa(casaVigia, idCasa)
  const soldadoVigia = comSoldado.unidades.find((unidade) => unidade.lado === 'aliado')!
  const torreNossa = {
    id: 880,
    lado: 'nosso' as const,
    tipo: 'torre' as const,
    x: soldadoVigia.x,
    z: soldadoVigia.z + 6,
    nivel: 1,
    hp: 50,
    maxHp: 50,
    gateApplied: false,
    cooldown: 0,
  }
  const agressor = {
    id: 881,
    lado: 'inimigo' as const,
    papel: 'horda' as const,
    x: torreNossa.x + 1.4,
    z: torreNossa.z,
    hp: 20,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: true,
  }
  const alarme: PartidaState = {
    ...comSoldado,
    obras: [...comSoldado.obras, torreNossa],
    unidades: [...comSoldado.unidades.filter((unidade) => unidade.lado === 'aliado'), agressor],
  }
  const alarmePasso = stepPartida(alarme, INPUT_PARADO, PARTIDA.dtMax)
  const soldadoAlerta = alarmePasso.unidades.find((unidade) => unidade.id === soldadoVigia.id)
  const torreDepois = alarmePasso.obras.find((obra) => obra.id === 880)
  assert(torreDepois !== undefined && torreDepois.hp < 50, 'torre apanha do agressor')
  assert(soldadoAlerta?.ancora != null, 'alarme enche a âncora dentro de 12 m')
  const longeDoOlho: PartidaState = {
    ...alarme,
    unidades: alarme.unidades.map((unidade) =>
      unidade.id === soldadoVigia.id ? { ...unidade, x: agressor.x + 15, z: agressor.z, ancora: null } : unidade,
    ),
  }
  const semOlho = stepPartida(longeDoOlho, INPUT_PARADO, PARTIDA.dtMax)
  assert(semOlho.unidades.find((unidade) => unidade.id === soldadoVigia.id)?.ancora == null, '15 m não dá alvo')
  const muroBaixo = criarBlocoMundo(0, 0, 4, 'madeira')
  const muroAlto = criarBlocoMundo(0, 1, 4, 'madeira')
  const atrasDoMuro: PartidaState = {
    ...casaVigia,
    unidades: [
      { ...soldadoVigia, x: 0, z: 0, ancora: null },
      { ...agressor, id: 882, x: 0, z: 8, alerta: false },
    ],
    blocosMapa: {
      [chaveBlocoMundo(0, 0, 4)]: muroBaixo,
      [chaveBlocoMundo(0, 1, 4)]: muroAlto,
    },
  }
  const muroPasso = stepPartida(atrasDoMuro, INPUT_PARADO, PARTIDA.dtMax)
  assert(muroPasso.unidades.find((unidade) => unidade.id === soldadoVigia.id)?.ancora == null, 'muro de 2 bloqueia a vigia')

  const moverColado: PartidaState = {
    ...atrasDoMuro,
    heroiPostura: 'calado',
    heroi: { ...atrasDoMuro.heroi, x: -40, z: -40 },
    blocosMapa: {},
    unidades: [
      {
        ...soldadoVigia,
        x: 0,
        z: 0,
        postura: 'ordens',
        posturaBase: 'vigia',
        ordem: { tipo: 'mover', x: 20, z: 0 },
        rota: { marcos: [{ x: 20, z: 0 }], renovarEm: 99, semCaminho: false, versao: atrasDoMuro.versaoSolidos, modo: 'fixo' },
        ancora: null,
      },
      { ...agressor, id: 883, x: 0.8, z: 0, hp: 20, alerta: false },
    ],
  }
  const coladoPasso = stepPartida(moverColado, INPUT_PARADO, PARTIDA.dtMax)
  assert(coladoPasso.unidades.find((unidade) => unidade.id === 883)?.hp === 20, 'mover não caça colado')

  const quaseLa: PartidaState = {
    ...moverColado,
    unidades: [
      {
        ...soldadoVigia,
        x: 0,
        z: 0,
        postura: 'ordens',
        posturaBase: 'vigia',
        ordem: { tipo: 'mover', x: 0.2, z: 0 },
        rota: { marcos: [{ x: 0.2, z: 0 }], renovarEm: 99, semCaminho: false, versao: moverColado.versaoSolidos, modo: 'fixo' },
        ancora: null,
      },
      { ...agressor, id: 884, x: 6, z: 0, hp: 20, alerta: false },
    ],
  }
  const chegou = stepPartida(quaseLa, INPUT_PARADO, PARTIDA.dtMax)
  const chegouSoldado = chegou.unidades.find((unidade) => unidade.id === soldadoVigia.id)
  assert(chegouSoldado?.ordem === null && chegouSoldado.postura === 'vigia', 'chegada devolve a vigia')
  const seguinte = stepPartida(chegou, INPUT_PARADO, PARTIDA.dtMax)
  assert(seguinte.unidades.find((unidade) => unidade.id === soldadoVigia.id)?.ancora != null, 'depois de chegar volta a vigiar')

  const semRota: PartidaState = {
    ...quaseLa,
    unidades: [
      {
        ...soldadoVigia,
        x: 0,
        z: 0,
        postura: 'ordens',
        posturaBase: 'vigia',
        ordem: { tipo: 'mover', x: 30, z: 0 },
        rota: { marcos: [], renovarEm: 99, semCaminho: true, versao: quaseLa.versaoSolidos, modo: 'fixo' },
        ancora: null,
      },
    ],
  }
  const travado = stepPartida(semRota, INPUT_PARADO, PARTIDA.dtMax)
  const travadoSoldado = travado.unidades.find((unidade) => unidade.id === soldadoVigia.id)
  assert(travadoSoldado?.ordem?.tipo === 'mover' && travadoSoldado.postura === 'ordens', 'sem caminho não devolve a postura')

  const baseEvo = fundar({ ...createPartida(), credito: 4, madeira: 10, ouro: 10 }, 'nucleo', 0, 30)
  const comTorre = fundar(baseEvo, 'torre', 8, 30)
  const idNucleoEvo = comTorre.obras.find((obra) => obra.tipo === 'nucleo' && obra.lado !== 'inimigo')!.id
  const idTorreEvo = comTorre.obras.find((obra) => obra.tipo === 'torre' && obra.lado !== 'inimigo')!.id
  const torreSubiu = evoluir({ ...comTorre, credito: 1 }, idTorreEvo)
  assert(torreSubiu.obras.find((obra) => obra.id === idTorreEvo)?.nivel === 2, 'evoluir sobe a torre clicada')
  assert(torreSubiu.obras.find((obra) => obra.id === idNucleoEvo)?.nivel === 1, 'evoluir da torre não sobe o núcleo')
  assert(torreSubiu.credito === 0, 'evoluir desconta 1 licença')

  const limpa = createPartida()
  const campo: PartidaState = {
    ...limpa,
    heroiPostura: 'calado',
    heroi: { ...limpa.heroi, x: -40, z: -40 },
    obras: [],
    unidades: [],
    blocosMapa: {},
  }
  const tropaParada = {
    id: 1,
    lado: 'aliado' as const,
    papel: 'tropa' as const,
    x: 0,
    z: 0,
    hp: 16,
    postura: 'vigia' as const,
    posturaBase: 'vigia' as const,
    ordem: null,
    ancora: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: true,
  }
  const hordaParada = {
    id: 2,
    lado: 'inimigo' as const,
    papel: 'horda' as const,
    x: 0,
    z: 0,
    hp: 40,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: false,
  }
  const a16 = stepPartida(
    { ...campo, unidades: [{ ...tropaParada }, { ...hordaParada, x: 16 }] },
    INPUT_PARADO,
    1,
  )
  assert(a16.unidades.find((unidade) => unidade.id === 1)?.z === 0, '16 m não aproxima')
  const a146 = stepPartida(
    { ...campo, unidades: [{ ...tropaParada }, { ...hordaParada, x: 14.6 }] },
    INPUT_PARADO,
    1,
  )
  assert(a146.unidades.find((unidade) => unidade.id === 1)?.z === 0, '14,6 m não aproxima')
  const soltaBase: PartidaState = {
    ...campo,
    unidades: [
      { ...tropaParada, z: 18, ancora: { x: 0, z: 0 } },
      { ...hordaParada, z: 23 },
    ],
  }
  const solta1 = stepPartida(soltaBase, INPUT_PARADO, PARTIDA.dtMax)
  const solta2 = stepPartida(solta1, INPUT_PARADO, PARTIDA.dtMax)
  const soltaSeg = stepPartida(soltaBase, INPUT_PARADO, 1)
  for (const estado of [solta1, solta2, soltaSeg]) {
    const tropa = estado.unidades.find((unidade) => unidade.id === 1)
    assert(
      tropa !== undefined && tropa.z === 18 && tropa.ancora?.x === 0 && tropa.ancora.z === 0,
      'coleira de 22 m segura a horda',
    )
  }
  const obraHostil = {
    id: 9,
    lado: 'inimigo' as const,
    tipo: 'nucleo' as const,
    x: 0,
    z: 23,
    nivel: 1,
    hp: 100,
    maxHp: 100,
    gateApplied: false,
    cooldown: 0,
  }
  const obraBase: PartidaState = {
    ...campo,
    obras: [obraHostil],
    unidades: [{ ...tropaParada, z: 18, ancora: { x: 0, z: 0 } }],
  }
  const obra1 = stepPartida(obraBase, INPUT_PARADO, PARTIDA.dtMax)
  const obra2 = stepPartida(obra1, INPUT_PARADO, PARTIDA.dtMax)
  const obraSeg = stepPartida(obraBase, INPUT_PARADO, 1)
  for (const estado of [obra1, obra2, obraSeg]) {
    const tropa = estado.unidades.find((unidade) => unidade.id === 1)
    assert(
      tropa !== undefined && tropa.z === 18 && tropa.ancora?.x === 0 && tropa.ancora.z === 0,
      'coleira de 22 m segura a obra hostil',
    )
  }
  const dentro20 = stepPartida(
    {
      ...campo,
      unidades: [
        { ...tropaParada, ancora: { x: 0, z: 0 } },
        { ...hordaParada, x: 20 },
      ],
    },
    INPUT_PARADO,
    PARTIDA.dtMax,
  )
  const tropa20 = dentro20.unidades.find((unidade) => unidade.id === 1)
  assert(
    tropa20 !== undefined && tropa20.x > 0 && tropa20.ancora?.x === 0 && tropa20.ancora.z === 0,
    '20 m da âncora, fora do olho, continua',
  )
  const dentro22 = stepPartida(
    {
      ...campo,
      unidades: [
        { ...tropaParada, ancora: { x: 0, z: 0 } },
        { ...hordaParada, x: 22 },
      ],
    },
    INPUT_PARADO,
    PARTIDA.dtMax,
  )
  const tropa22 = dentro22.unidades.find((unidade) => unidade.id === 1)
  assert(
    tropa22 !== undefined && tropa22.x > 0 && tropa22.ancora?.x === 0 && tropa22.ancora.z === 0,
    '22 m exatos da âncora continuam',
  )
  const obraLonge = (x: number): PartidaState => ({
    ...campo,
    obras: [
      {
        id: 9,
        lado: 'inimigo' as const,
        tipo: 'nucleo' as const,
        x,
        z: 0,
        nivel: 1,
        hp: 100,
        maxHp: 100,
        gateApplied: false,
        cooldown: 0,
      },
    ],
    unidades: [{ ...tropaParada, ancora: { x: 0, z: 0 } }],
  })
  for (const distancia of [20, 22]) {
    const andouObra = stepPartida(obraLonge(distancia), INPUT_PARADO, PARTIDA.dtMax)
    const tropaObra = andouObra.unidades.find((unidade) => unidade.id === 1)
    assert(
      tropaObra !== undefined && tropaObra.x > 0 && tropaObra.ancora?.x === 0 && tropaObra.ancora.z === 0,
      'obra hostil na coleira conserva a âncora',
    )
  }
  const torreAlarme = {
    id: 3,
    lado: 'nosso' as const,
    tipo: 'torre' as const,
    x: 0,
    z: 0,
    nivel: 1,
    hp: 50,
    maxHp: 50,
    gateApplied: false,
    cooldown: 0,
  }
  const acordada = stepPartida(
    {
      ...campo,
      obras: [torreAlarme],
      unidades: [
        { ...tropaParada, x: 1.4, z: 8, postura: 'ordens', posturaBase: 'vigia', ordem: null, ancora: null },
        { ...hordaParada, id: 4, x: 1.4, z: 0, alerta: true, hp: 30 },
      ],
    },
    INPUT_PARADO,
    PARTIDA.dtMax,
  )
  const acordadaTropa = acordada.unidades.find((unidade) => unidade.id === 1)
  assert(
    acordadaTropa?.postura === 'vigia' && acordadaTropa.ancora != null,
    'alarme acorda tropa em ordens sem ordem',
  )

  // Ordem de atacar que acaba (alvo morto e nada mais à vista) devolve a postura de base.
  // Sem isto a tropa que venceu fica em `ordens` sem ordem: muda, igual ao bug do mover.
  const ordemAtacar = (alvoId: number): Partial<PartidaState['unidades'][number]> => ({
    postura: 'ordens',
    posturaBase: 'vigia',
    ordem: { tipo: 'atacar', alvoId },
    ancora: null,
  })
  const venceu = stepPartida(
    { ...campo, obras: [], unidades: [{ ...tropaParada, ...ordemAtacar(99) }] },
    INPUT_PARADO,
    PARTIDA.dtMax,
  )
  const venceuTropa = venceu.unidades.find((unidade) => unidade.id === 1)
  assert(venceuTropa?.ordem == null, 'atacar sem alvo zera a ordem')
  assert(venceuTropa?.postura === 'vigia', 'atacar acabou: devolve a vigia')

  const ordemAtacarObra = (obraId: number): Partial<PartidaState['unidades'][number]> => ({
    postura: 'ordens',
    posturaBase: 'noLugar',
    ordem: { tipo: 'atacarObra', obraId },
    ancora: null,
  })
  const demoliu = stepPartida(
    { ...campo, obras: [], unidades: [{ ...tropaParada, ...ordemAtacarObra(98) }] },
    INPUT_PARADO,
    PARTIDA.dtMax,
  )
  const demoliuTropa = demoliu.unidades.find((unidade) => unidade.id === 1)
  assert(demoliuTropa?.ordem == null, 'atacarObra sem obra zera a ordem')
  assert(demoliuTropa?.postura === 'noLugar', 'atacarObra acabou: devolve a base escolhida, não a vigia')

  // D-B1 (laudo do T2, medido pelo T1 com controle): atacarObra inclina o pitch para o centro da obra. Quando a
  // obra cai a ordem some, mas o pitch fica para baixo e a vigia só vira o yaw. Com a obra colada (1,5 m) o
  // pitch é -0,49 e os primeiros tiros vão ao chão: a primeira baixa na horda leva 30 passos em vez de 10.
  // O teste compara com o controle (mesmo cenário, pitch já zerado) em vez de olhar só `hp < 40`: um teste
  // frouxo passou sem correção na primeira tentativa, porque a horda acaba caindo mais tarde de qualquer jeito.
  const primeiraBaixaDepoisDeDemolir = (zObra: number, nivelarPitch: boolean) => {
    const base = createPartida()
    const obra = {
      id: 601,
      lado: 'inimigo' as const,
      tipo: 'nucleo' as const,
      x: 0,
      z: zObra,
      nivel: 1,
      hp: 12,
      maxHp: 12,
      gateApplied: false,
      cooldown: 0,
    }
    const horda = {
      id: 602,
      lado: 'inimigo' as const,
      papel: 'horda' as const,
      x: 0,
      z: 12,
      hp: 400,
      postura: 'automatico' as const,
      ordem: null,
      cooldown: 0,
      segmentos: [] as number[],
      alerta: false,
    }
    let estado: PartidaState = {
      ...definirOlhar(base, 'imperio'),
      obras: [obra],
      unidades: [horda],
      blocosMapa: {},
      heroi: { ...base.heroi, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, shootCooldown: 0, army: 10 },
      heroiOrdem: ordenarHeroi(base, { tipo: 'atacarObra', obraId: 601 }).heroiOrdem,
    }
    let passos = 0
    while (estado.obras.some((o) => o.id === 601 && o.hp > 0) && passos < 80) {
      estado = stepPartida(estado, INPUT_PARADO, PARTIDA.dtMax)
      passos += 1
    }
    const caiu = !estado.obras.some((o) => o.id === 601 && o.hp > 0)
    if (nivelarPitch) estado = { ...estado, heroi: { ...estado.heroi, pitch: 0 } }
    const hpInicial = estado.unidades.find((u) => u.id === 602)!.hp
    for (let i = 1; i <= 80; i++) {
      estado = stepPartida(estado, INPUT_PARADO, PARTIDA.dtMax)
      if (estado.unidades.find((u) => u.id === 602)!.hp < hpInicial) return { caiu, passo: i }
    }
    return { caiu, passo: null }
  }
  const colada = primeiraBaixaDepoisDeDemolir(1.5, false)
  const controle = primeiraBaixaDepoisDeDemolir(1.5, true)
  assert(colada.caiu && controle.caiu, 'D-B1 prepara: o herói derrubou a obra colada nos dois cenários')
  assert(controle.passo !== null, 'D-B1 prepara: o controle (pitch zerado) acerta a horda')
  assert(
    colada.passo === controle.passo,
    'D-B1: depois de derrubar a obra colada, a vigia acerta tão cedo quanto com o pitch nivelado',
  )

  // D-A1 (laudo do T2): o alvo mais perto da tropa pode estar FORA da coleira de 22 m da âncora. Hoje essa
  // escolha vence e a tropa fica parada (return unidade), mesmo com um segundo alvo dentro do olho (12 m) e
  // dentro da coleira. A coleira só pode segurar a tropa quando NÃO sobra nenhum alvo dentro dela.
  const tropaNaBorda = { ...tropaParada, x: 0, z: 18, ancora: { x: 0, z: 0 } }
  const hordaFora = { ...hordaParada, id: 21, x: 0, z: 23 }
  const hordaDentro = { ...hordaParada, id: 22, x: 0, z: 12 }
  const comDois = stepPartida(
    { ...campo, unidades: [tropaNaBorda, hordaFora, hordaDentro] },
    INPUT_PARADO,
    PARTIDA.dtMax,
  )
  const tropaDois = comDois.unidades.find((unidade) => unidade.id === 1)
  assert(tropaDois !== undefined && tropaDois.z < 18, 'D-A1: com um alvo fora e outro dentro da coleira, a tropa vai ao de dentro')
  assert(tropaDois.ancora?.x === 0 && tropaDois.ancora.z === 0, 'D-A1: a âncora original é conservada')
  // O controle: só o alvo de fora. A coleira continua segurando a tropa e conservando a âncora.
  const soFora = stepPartida({ ...campo, unidades: [tropaNaBorda, hordaFora] }, INPUT_PARADO, PARTIDA.dtMax)
  const tropaSoFora = soFora.unidades.find((unidade) => unidade.id === 1)
  assert(tropaSoFora?.z === 18 && tropaSoFora.ancora?.z === 0, 'D-A1 controle: só alvo fora da coleira segura a tropa')

  // A5: o ritmo de tiros do herói não depende de uma ordem de ataque esquecida, nos dois olhares do corpo.
  // O que isto MEDE: tiros por segundo (comportamento). O que isto NÃO prova: que dois chamadores de `atirar` não
  // coexistem no mesmo passo. Provado por mutação: fazer `seguirOrdemHeroi` rodar junto com a vigia NÃO muda esta
  // contagem, porque `atirar` recusa quando `shootCooldown > 0`, então um 2º chamador no mesmo passo é recusado
  // pela própria recarga. A garantia «não atira duas vezes no mesmo passo» mora na recarga de `atirar`, e não na
  // estrutura de `passoHeroi`. Conto os tiros pela VIDA da horda: cada tiro que acerta tira exatamente 12.
  const hordaDoTiro = { ...hordaParada, id: 801, x: 0, z: 10, hp: 400, alerta: true }
  const contarTiros = (estadoInicial: PartidaState, passos: number): number => {
    let s = estadoInicial
    const hpAntes = 400
    for (let i = 0; i < passos; i++) s = stepPartida(s, INPUT_PARADO, PARTIDA.dtMax)
    return Math.round((hpAntes - (s.unidades.find((u) => u.id === 801)?.hp ?? hpAntes)) / 12)
  }
  const heroiNoCorpo = (olhar: 'primeira' | 'terceira', ordem: PartidaState['heroiOrdem']): PartidaState => ({
    ...definirOlhar(createPartida(), olhar),
    obras: [],
    unidades: [hordaDoTiro],
    blocosMapa: {},
    heroiOrdem: ordem,
    heroi: { ...createPartida().heroi, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, shootCooldown: 0, army: 10 },
  })
  // 20 passos de 0,05 s = 1 s. Medido: os tiros saem nos passos 1, 11 e 21, de 10 em 10. A recarga de 0,45 s escrita
  // no passo do tiro só é descontada no FIM do mesmo passo (`passoCurto` desconta depois de `passoHeroi`), então o
  // `shootCooldown` fica em 0,40 e leva mais 9 passos para zerar. Em 20 passos cabem 2 tiros (passos 1 e 11).
  const baseSemOrdem = contarTiros(heroiNoCorpo('primeira', null), 20)
  assert(baseSemOrdem === 2, `A5 controle: em 20 passos o herói parado dá 2 tiros (deu ${baseSemOrdem})`)
  for (const olharCorpo of ['primeira', 'terceira'] as const) {
    const comAtacar = contarTiros(heroiNoCorpo(olharCorpo, { tipo: 'atacar', alvoId: 801, rota: null }), 20)
    assert(comAtacar === baseSemOrdem, `A5: no corpo (${olharCorpo}) uma ordem de atacar esquecida não dobra os tiros (${comAtacar} vs ${baseSemOrdem})`)
    const comAtacarObra = contarTiros(heroiNoCorpo(olharCorpo, { tipo: 'atacarObra', obraId: 999, rota: null }), 20)
    assert(comAtacarObra === baseSemOrdem, `A5: no corpo (${olharCorpo}) uma ordem de atacarObra esquecida não dobra os tiros (${comAtacarObra} vs ${baseSemOrdem})`)
  }
  // No império a ordem de atacar É executada por seguirOrdemHeroi, e a vigia só roda sem ordem: continua <= 1 tiro por passo.
  const noImperioAtacando = contarTiros(
    { ...heroiNoCorpo('primeira', { tipo: 'atacar', alvoId: 801, rota: null }), olhar: 'imperio' },
    20,
  )
  assert(noImperioAtacando === baseSemOrdem, `A5: no império, atacando, os tiros seguem o ritmo da recarga (${noImperioAtacando} vs ${baseSemOrdem})`)

  // A4 (plano da fase 2): o preço de evoluir sai dos literais 1/2/2 do miolo de `evoluir` e vai para PARTIDA, uma vez,
  // e o painel lê dali. Os valores continuam os mesmos; a prova de que `evoluir` LÊ a constante e não um literal
  // escondido é mudar o preço só pela constante e ver a função reagir.
  assert(PARTIDA.custoEvoluirCredito === 1, 'A4: o crédito de evoluir é 1 licença')
  assert(PARTIDA.custoEvoluirMadeira === 2, 'A4: a madeira de evoluir é 2')
  assert(PARTIDA.custoEvoluirOuro === 2, 'A4: o ouro de evoluir é 2')
  const comRecursos = { ...comTorre, credito: 0, madeira: 5, ouro: 5 }
  const evoluiuPorRecurso = evoluir(comRecursos, idTorreEvo)
  assert(
    evoluiuPorRecurso.madeira === 3 && evoluiuPorRecurso.ouro === 3 && evoluiuPorRecurso.credito === 0,
    'A4: sem licença, evoluir cobra 2 madeiras e 2 ouros',
  )
  const precoMutavel = PARTIDA as unknown as { custoEvoluirCredito: number; custoEvoluirMadeira: number; custoEvoluirOuro: number }
  const precoOriginal = { ...precoMutavel }
  try {
    precoMutavel.custoEvoluirCredito = 3
    precoMutavel.custoEvoluirMadeira = 4
    precoMutavel.custoEvoluirOuro = 1
    const recusouPorPreco = evoluir({ ...comTorre, credito: 2, madeira: 0, ouro: 0 }, idTorreEvo)
    assert(
      recusouPorPreco.obras.find((o) => o.id === idTorreEvo)?.nivel === 1,
      'A4: com o preço da constante em 3 licenças, 2 licenças não bastam',
    )
    const pagouNovoPreco = evoluir({ ...comTorre, credito: 3, madeira: 0, ouro: 0 }, idTorreEvo)
    assert(
      pagouNovoPreco.obras.find((o) => o.id === idTorreEvo)?.nivel === 2 && pagouNovoPreco.credito === 0,
      'A4: com o preço da constante em 3 licenças, 3 licenças evoluem e cobram 3',
    )
    const pagouRecursosNovo = evoluir({ ...comTorre, credito: 0, madeira: 4, ouro: 1 }, idTorreEvo)
    assert(
      pagouRecursosNovo.obras.find((o) => o.id === idTorreEvo)?.nivel === 2 && pagouRecursosNovo.madeira === 0 && pagouRecursosNovo.ouro === 0,
      'A4: o preço em recursos também vem da constante (4 madeiras e 1 ouro)',
    )
  } finally {
    Object.assign(precoMutavel, precoOriginal)
  }
  assert(PARTIDA.custoEvoluirCredito === 1 && PARTIDA.custoEvoluirMadeira === 2 && PARTIDA.custoEvoluirOuro === 2, 'A4: o teste restaurou o preço')

  // D-B1-CANCEL (laudo V2 do T2): zerar o pitch só quando a obra MORRE deixa de fora o jogador que CANCELA o
  // ataque antes (manda o herói andar, ou troca de olhar). No império ninguém controla o pitch, então ele fica
  // preso e a vigia atira no chão contra uma horda contida atrás de uma mureta, onde nada a faz chegar mais perto.
  // A mureta é o que torna o defeito permanente: em campo aberto a horda anda até a mira e o prejuízo é só atraso.
  // A mureta tem de fechar o caminho de lado a lado (o mapa vai de -56 a +56 m; o caminho em grade usa -28..28).
  // Um bloco só cobre 1 m e a horda o contorna: o 1º rascunho deste teste usou um bloco e passou sem correção.
  const muretaBloco = (gz: number) => {
    const blocos: Record<string, ReturnType<typeof criarBlocoMundo>> = {}
    for (let gx = -28; gx <= 28; gx++) blocos[chaveBlocoMundo(gx, 0, gz)] = criarBlocoMundo(gx, 0, gz, 'madeira')
    return blocos
  }
  const cenaCancelamento = (cancelar: (s: PartidaState) => PartidaState): PartidaState => {
    const base = createPartida()
    const obraGrande = {
      id: 701,
      lado: 'inimigo' as const,
      tipo: 'nucleo' as const,
      x: 0,
      z: 1.5,
      nivel: 1,
      hp: 400,
      maxHp: 400,
      gateApplied: false,
      cooldown: 0,
    }
    const hordaContida = {
      id: 702,
      lado: 'inimigo' as const,
      papel: 'horda' as const,
      x: 0,
      z: 12,
      hp: 400,
      postura: 'automatico' as const,
      ordem: null,
      cooldown: 0,
      segmentos: [] as number[],
      alerta: true,
    }
    let s: PartidaState = {
      ...definirOlhar(base, 'imperio'),
      obras: [obraGrande],
      unidades: [hordaContida],
      blocosMapa: muretaBloco(6),
      heroi: { ...base.heroi, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, shootCooldown: 0, army: 10 },
      heroiOrdem: ordenarHeroi(base, { tipo: 'atacarObra', obraId: 701 }).heroiOrdem,
    }
    s = stepPartida(s, INPUT_PARADO, PARTIDA.dtMax)
    assert(s.heroi.pitch < -0.2, 'D-B1-CANCEL prepara: atacarObra inclinou o pitch e a obra segue de pé')
    assert(s.obras.some((o) => o.id === 701 && o.hp > 0), 'D-B1-CANCEL prepara: a obra grande não caiu no 1º passo')
    s = cancelar(s)
    // Segura o herói parado, sem ordem. A horda está contida pela mureta: quem a acerta é a vigia ou ninguém.
    s = { ...s, obras: s.obras.filter((o) => o.id !== 701), heroiOrdem: null }
    for (let i = 0; i < 100; i++) s = stepPartida(s, INPUT_PARADO, PARTIDA.dtMax)
    return s
  }
  const aposMover = cenaCancelamento((s) => ordenarHeroi(s, { tipo: 'mover', x: 0, z: 0.2 }))
  assert(
    (aposMover.unidades.find((u) => u.id === 702)?.hp ?? 400) < 400,
    'D-B1-CANCEL: cancelar atacarObra com um mover não deixa o pitch preso: a vigia acerta a horda contida',
  )
  const aposOlhar = cenaCancelamento((s) => definirOlhar(definirOlhar(s, 'primeira'), 'imperio'))
  assert(
    (aposOlhar.unidades.find((u) => u.id === 702)?.hp ?? 400) < 400,
    'D-B1-CANCEL: cancelar atacarObra trocando de olhar não deixa o pitch preso: a vigia acerta a horda contida',
  )
  // No corpo o pitch é do jogador (mouse). A vigia continua sem tocar nele.
  const noCorpo = stepPartida(
    {
      ...definirOlhar(createPartida(), 'primeira'),
      obras: [],
      unidades: [{ ...hordaParada, id: 703, x: 0, z: 6, hp: 400, alerta: true }],
      blocosMapa: {},
      heroi: { ...createPartida().heroi, x: 0, y: 0, z: 0, yaw: 0, pitch: -0.25, shootCooldown: 0, army: 10 },
    },
    INPUT_PARADO,
    PARTIDA.dtMax,
  )
  assert(Math.abs(noCorpo.heroi.pitch - -0.25) < 1e-9, 'D-B1-CANCEL controle: no corpo a vigia não mexe no pitch do jogador')

  // D-A1-CROSS (laudo V2 do T2): meus retornos precoces ("há alvo no olho mas todos fora da coleira: segura")
  // rodavam ANTES de avaliar os candidatos dentro da coleira que não estão no olho (naColeira, naColeiraObra)
  // e as obras no olho. Um alvo de fora do olho de 12 m, mas dentro dos 22 m da âncora, é válido e tem de ganhar.
  const nucleoHostilCross = (id: number, z: number) => ({
    id,
    lado: 'inimigo' as const,
    tipo: 'nucleo' as const,
    x: 0,
    z,
    nivel: 1,
    hp: 100,
    maxHp: 100,
    gateApplied: false,
    cooldown: 0,
  })
  const passoCross = (obrasCross: ReturnType<typeof nucleoHostilCross>[], hordas: (typeof hordaParada)[]) =>
    stepPartida({ ...campo, obras: obrasCross, unidades: [tropaNaBorda, ...hordas] }, INPUT_PARADO, PARTIDA.dtMax).unidades.find(
      (unidade) => unidade.id === 1,
    )
  // 3a: horda fora da coleira no olho (z=23) + horda dentro da coleira, fora do olho (z=4: 14 m da tropa, 4 m da âncora).
  const cross3a = passoCross([], [{ ...hordaParada, id: 61, z: 23 }, { ...hordaParada, id: 62, z: 4 }])
  assert(cross3a !== undefined && cross3a.z < 18 && cross3a.ancora?.z === 0, 'D-A1-CROSS 3a: horda fora no olho + horda dentro da coleira fora do olho: vai à de dentro')
  // 3b: horda fora da coleira no olho (z=23) + núcleo hostil no olho E dentro da coleira (z=12).
  const cross3b = passoCross([nucleoHostilCross(63, 12)], [{ ...hordaParada, id: 64, z: 23 }])
  assert(cross3b !== undefined && cross3b.z < 18 && cross3b.ancora?.z === 0, 'D-A1-CROSS 3b: horda fora no olho + núcleo dentro do olho e da coleira: vai ao núcleo')
  // 3c: núcleo hostil fora da coleira no olho (z=23) + núcleo dentro da coleira, fora do olho (z=4).
  const cross3c = passoCross([nucleoHostilCross(65, 23), nucleoHostilCross(66, 4)], [])
  assert(cross3c !== undefined && cross3c.z < 18 && cross3c.ancora?.z === 0, 'D-A1-CROSS 3c: núcleo fora no olho + núcleo dentro da coleira fora do olho: vai ao de dentro')
  // Controles: sem NENHUM candidato dentro da coleira a tropa segura e conserva a âncora; sem alvo nenhum, apaga.
  const crossSegura = passoCross([], [{ ...hordaParada, id: 67, z: 23 }])
  assert(crossSegura?.z === 18 && crossSegura.ancora?.z === 0, 'D-A1-CROSS controle: só alvo fora da coleira segura e conserva a âncora')
  const crossSemAlvo = passoCross([], [])
  assert(crossSemAlvo?.ancora == null, 'D-A1-CROSS controle: sem alvo nenhum a âncora é apagada')

  // O espelho de obras: dois núcleos hostis no olho de 12 m, um fora da coleira e outro dentro dela.
  const nucleoHostil = (id: number, z: number) => ({
    id,
    lado: 'inimigo' as const,
    tipo: 'nucleo' as const,
    x: 0,
    z,
    nivel: 1,
    hp: 100,
    maxHp: 100,
    gateApplied: false,
    cooldown: 0,
  })
  const obrasComDois = stepPartida(
    { ...campo, obras: [nucleoHostil(31, 23), nucleoHostil(32, 12)], unidades: [tropaNaBorda] },
    INPUT_PARADO,
    PARTIDA.dtMax,
  )
  const tropaObras = obrasComDois.unidades.find((unidade) => unidade.id === 1)
  assert(tropaObras !== undefined && tropaObras.z < 18, 'D-A1 obras: com um núcleo fora e outro dentro da coleira, a tropa vai ao de dentro')
  assert(tropaObras.ancora?.x === 0 && tropaObras.ancora.z === 0, 'D-A1 obras: a âncora original é conservada')
  // D-B4 (laudo do T2): a ordem do herói nasce no império e só lá é executada. Sair para o corpo com uma ordem
  // de mover em curso deixava `heroiOrdem` presa: o herói parado não vigiava até o jogador mexer no WASD.
  const hordaPerto = { ...hordaParada, id: 51, x: 0, z: 10, alerta: true, hp: 40 }
  const noImperio = ordenarHeroi(definirOlhar(createPartida(), 'imperio'), { tipo: 'mover', x: 30, z: 30 })
  assert(noImperio.heroiOrdem?.tipo === 'mover', 'D-B4 prepara: a ordem de mover foi gravada no império')
  for (const corpoOlhar of ['primeira', 'terceira'] as const) {
    const saiu = definirOlhar(noImperio, corpoOlhar)
    assert(saiu.heroiOrdem === null, `D-B4: sair do império para ${corpoOlhar} descarta a ordem de mover`)
    const parado = stepPartida(
      {
        ...saiu,
        obras: [],
        unidades: [hordaPerto],
        blocosMapa: {},
        heroi: { ...saiu.heroi, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, shootCooldown: 0, army: 10 },
      },
      INPUT_PARADO,
      PARTIDA.dtMax,
    )
    assert(
      (parado.unidades.find((unidade) => unidade.id === 51)?.hp ?? 40) < 40,
      `D-B4: no corpo (${corpoOlhar}), parado, o herói vigia mesmo tendo saído do império com uma ordem`,
    )
  }
  // O controle: ficar no império com a ordem preserva a ordem. Só a saída a descarta.
  assert(definirOlhar(noImperio, 'imperio').heroiOrdem?.tipo === 'mover', 'D-B4 controle: continuar no império conserva a ordem')

  // D-B3 (laudo do T2): o alarme acorda a tropa em `ordens` sem ordem e grava `vigia`, mesmo que a base escolhida
  // pelo jogador seja `calado` ou `noLugar`. O silêncio pedido não pode ser desfeito por um golpe na torre.
  const agressorDoAlarme = { ...hordaParada, id: 41, x: 1.4, z: 0, alerta: true, hp: 30 }
  for (const base of ['calado', 'noLugar'] as const) {
    const dormiu = stepPartida(
      {
        ...campo,
        obras: [torreAlarme],
        unidades: [
          { ...tropaParada, x: 1.4, z: 8, postura: 'ordens' as const, posturaBase: base, ordem: null, ancora: null },
          agressorDoAlarme,
        ],
      },
      INPUT_PARADO,
      PARTIDA.dtMax,
    )
    const tropaDormida = dormiu.unidades.find((unidade) => unidade.id === 1)
    assert(
      tropaDormida !== undefined && tropaDormida.postura === 'ordens' && tropaDormida.ancora == null,
      `D-B3: o alarme não acorda a tropa cuja base é ${base}`,
    )
  }

  // D-B2 (laudo do T2): postura(..., 'automatico') não gravava posturaBase. Calado -> automatico -> ordem de
  // atacar -> fim voltava a 'calado', a base ANTIGA. A UI só chama vigia/noLugar/calado, então hoje só a API
  // exportada tem essa lacuna; o contrato fecha porque `automatico` é um valor legítimo de Postura.
  const calada = postura({ ...campo, unidades: [{ ...tropaParada, postura: 'calado', posturaBase: 'calado' }] }, [1], 'automatico')
  assert(calada.unidades[0].posturaBase === 'automatico', 'D-B2: postura automatico grava a base nova, não conserva calado')
  const depoisDoAtaque = stepPartida(
    {
      ...postura(calada, [1], 'automatico'),
      unidades: [{ ...calada.unidades[0], postura: 'ordens', ordem: { tipo: 'atacar', alvoId: 99 } }],
    },
    INPUT_PARADO,
    PARTIDA.dtMax,
  )
  assert(depoisDoAtaque.unidades[0].postura === 'automatico', 'D-B2: fim da ordem devolve automatico, a última base escolhida')
  const obrasSoFora = stepPartida({ ...campo, obras: [nucleoHostil(31, 23)], unidades: [tropaNaBorda] }, INPUT_PARADO, PARTIDA.dtMax)
  const tropaObrasFora = obrasSoFora.unidades.find((unidade) => unidade.id === 1)
  assert(
    tropaObrasFora?.z === 18 && tropaObrasFora.ancora?.z === 0,
    'D-A1 obras controle: só núcleo fora da coleira segura a tropa e conserva a âncora',
  )
}
