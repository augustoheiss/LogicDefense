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
  evoluirInimigo,
  fundar,
  iniciarObra,
  obraEmConstrucao,
  idsNoRetangulo,
  INPUT_PARADO,
  invocarDragao,
  lugarDaBaseInimiga,
  mira,
  podeEvoluir,
  pontosDoCorpo,
  pontosFormacaoTropa,
  ordenar,
  ordenarHeroi,
  podeConsagrarEm,
  podeFundarEm,
  repararObra,
  pular,
  Obra,
  PartidaInput,
  PartidaState,
  postura,
  registrarErroNoAltar,
  selecionarAoClicarChaoVazio,
  selecionarAoClicarHeroi,
  selecionarAoClicarUnidade,
  selecionarPorRetanguloEstado,
  stepPartida,
  Unidade,
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
  // L5.2 (decisão do usuário, 20/11): a tabela das contas é BASE 2, `bônus = 2^(grau+1)`: +4, +8, +16, +32. Antes era 4/6/8/12 (sem regra: números soltos). O teste
  // confere os 4 valores E a regra, para que mudar a tabela sem mudar a regra (ou o contrário) seja acusado. `wipe` e `credito` NÃO mudam nesta etapa.
  assert(
    GRAU_PARTIDA[1].bonus === 4 && GRAU_PARTIDA[2].bonus === 8 && GRAU_PARTIDA[3].bonus === 16 && GRAU_PARTIDA[4].bonus === 32,
    'L5.2: bônus em base 2 = 4 8 16 32',
  )
  for (const g of [1, 2, 3, 4] as const) assert(GRAU_PARTIDA[g].bonus === 2 ** (g + 1), `L5.2: o bônus do grau ${g} segue a regra 2^(g+1) (${2 ** (g + 1)}), veio ${GRAU_PARTIDA[g].bonus}`)
  assert(GRAU_PARTIDA[2].bonus === 2 * GRAU_PARTIDA[1].bonus && GRAU_PARTIDA[3].bonus === 2 * GRAU_PARTIDA[2].bonus && GRAU_PARTIDA[4].bonus === 2 * GRAU_PARTIDA[3].bonus, 'L5.2: cada grau DOBRA o anterior')
  assert(GRAU_PARTIDA[1].wipe === 0.35 && GRAU_PARTIDA[2].wipe === 0.6 && GRAU_PARTIDA[3].wipe === 0.85 && GRAU_PARTIDA[4].wipe === 1, 'L5.2: o abate (wipe) NÃO mudou')
  assert(GRAU_PARTIDA[1].credito === 1 && GRAU_PARTIDA[2].credito === 1 && GRAU_PARTIDA[3].credito === 2 && GRAU_PARTIDA[4].credito === 2, 'L5.2: a licença NÃO mudou')
  assert(aplicarConta(createPartida(), 2).heroi.army === 10 + 8, 'grau 2 soma 8')
  assert(aplicarConta(createPartida(), 3).heroi.army === 10 + 16, 'grau 3 soma 16')
  assert(aplicarConta(createPartida(), 4).heroi.army === 10 + 32, 'grau 4 soma 32')
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
  // L5.1 / rodada 3 do T2 (C.2): o ganho REAL da conta fica gravado no próprio altar, no ponto onde o antes e o depois são exatos.
  // O `onHud` só vê o estado já atualizado e dano do MESMO passo (torre −7, horda −3, arco/portão +10) o contaminava: o toast dizia
  // «Vida no máximo» com o herói perdendo vida, ou «+14» por causa de um portão.
  assert(pisou.altar?.ganhoVida === GRAU_PARTIDA[1].bonus, 'altar guarda o ganho REAL da conta (grau 1 = o bônus da tabela, sem o dano do passo)')
  assert(abrirAltar(inicio, 1, 0).altar?.ganhoVida === undefined, 'altar ainda não resolvido não tem ganho gravado')
  // O ganho gravado é o da CONTA, não o do quadro: uma torre inimiga atirando no MESMO passo derruba a vida DEPOIS (passoUnidades vem
  // depois de altarNoPasso), mas o ganho da conta continua sendo o bônus. Vida final < vida inicial + bônus, ganho intacto.
  const torreNoAlcance: PartidaState = {
    ...noPiso,
    obras: [
      ...noPiso.obras,
      { id: 9001, lado: 'inimigo', tipo: 'torre', x: noPiso.heroi.x + 6, z: noPiso.heroi.z, nivel: 1, hp: 60, maxHp: 60, gateApplied: false, cooldown: 0 },
    ],
  }
  const sobTorre = stepPartida(torreNoAlcance, INPUT_PARADO, 0.05)
  assert(sobTorre.altar?.resolvido === true, 'a conta resolve mesmo com torre inimiga no alcance')
  assert(sobTorre.altar?.ganhoVida === GRAU_PARTIDA[1].bonus, 'ganho gravado = bônus da conta, ignorando o tiro da torre do mesmo passo')
  assert(sobTorre.heroi.army < inicio.heroi.army + GRAU_PARTIDA[1].bonus, 'controle: a torre de fato tirou vida no mesmo passo (senão o teste não prova nada)')
  // Com `PARTIDA.vidaCap` (999.999), no teto a conta não soma nada (`ganhoVida = 0`) e quase no teto (`vidaCap - 2`) soma só o que coube (`ganhoVida = 2`).
  const noTetoDoClamp = stepPartida({ ...noPiso, heroi: { ...noPiso.heroi, army: PARTIDA.vidaCap } }, INPUT_PARADO, 0.05)
  assert(noTetoDoClamp.altar?.ganhoVida === 0, 'vida no teto: a conta não soma nada, o ganho gravado é 0 (não o bônus 4 da tabela)')
  const quaseNoTeto = stepPartida({ ...noPiso, heroi: { ...noPiso.heroi, army: PARTIDA.vidaCap - 2 } }, INPUT_PARADO, 0.05)
  assert(quaseNoTeto.altar?.ganhoVida === 2 && quaseNoTeto.heroi.army === PARTIDA.vidaCap, 'vida 999.997 + bônus 4 grava ganhoVida = 2 e trava em 999.999')
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

  // ── E3: «errou a alternativa, perde o buff pela metade; cada vez que errar acontece isso» (usuário, 20/11/2026) ─────────────────────────────────────────────
  // O erro tem DOIS caminhos (clicar numa alternativa do modal; pisar numa placa errada do altar no mundo) e a regra vale nos dois. O contador mora no
  // `Altar` (estado da simulação, que continua pura e determinística), e `aplicarConta` o lê. Com 0 erros o resultado é IDÊNTICO ao de antes (invariante).
  {
    // (1) sem erro: nada muda. As 4 tabelas de hoje (vida, licença, madeira, ouro), com o altar aberto e sem erro.
    for (const tier of [1, 2, 3, 4] as const) {
      const a = abrirAltar(createPartida(), tier, 0)
      const r = aplicarConta(a, tier)
      assert(r.heroi.army === 10 + GRAU_PARTIDA[tier].bonus && r.credito === 4 + GRAU_PARTIDA[tier].credito, `E3: sem erro o grau ${tier} paga o buff CHEIO (vida e licença)`)
      assert(r.madeira === createPartida().madeira + tier * 2 && r.ouro === createPartida().ouro + tier, `E3: sem erro o grau ${tier} paga madeira e ouro cheios`)
    }
    // (2) o erro do MODAL: cada chamada soma 1 erro; sem altar aberto não faz nada (nada a registrar, e não cria altar).
    const a0 = abrirAltar(createPartida(), 3, 0)
    assert(a0.altar?.erros === 0, 'E3: o altar nasce com 0 erros')
    const a1 = registrarErroNoAltar(a0)
    const a2 = registrarErroNoAltar(a1)
    assert(a1.altar?.erros === 1 && a2.altar?.erros === 2, 'E3: cada clique errado soma 1 erro')
    assert(registrarErroNoAltar(createPartida()).altar === null, 'E3: sem altar aberto, errar não cria nada')
    assert(a0.altar?.erros === 0, 'E3: registrar erro não muda o estado de ANTES (imutável)')
    // erro DEPOIS do acerto não conta: a conta já foi paga e o contador fica como estava (o caderno de estudo, E2, lerá este número: não pode crescer sozinho)
    const resolvida = aplicarConta(registrarErroNoAltar(a0), 3)
    assert(resolvida.altar?.resolvido === true && resolvida.altar?.erros === 1, 'E3: (controle) a conta resolvida com 1 erro guarda erros = 1')
    const erroTardio = registrarErroNoAltar(resolvida)
    assert(erroTardio === resolvida && erroTardio.altar?.erros === 1, `E3: errar DEPOIS de resolvida não conta nem muda o estado (erros ${erroTardio.altar?.erros}, esperado 1)`)
    // (3) acertar depois de errar paga o buff REDUZIDO: 1 erro = metade, 2 erros = um quarto (vida arredonda PARA CIMA e fica >= 1; recursos arredondam para baixo).
    const base = abrirAltar(createPartida(), 4, 0) // grau 4: bônus 32 (base 2, L5.2), licença 2, madeira +8, ouro +4, wipe 100 %
    const cheio = aplicarConta(base, 4)
    const umErro = aplicarConta(registrarErroNoAltar(base), 4)
    const doisErros = aplicarConta(registrarErroNoAltar(registrarErroNoAltar(base)), 4)
    assert(cheio.heroi.army === 10 + 32 && umErro.heroi.army === 10 + 16 && doisErros.heroi.army === 10 + 8, `E3: vida do grau 4: cheio +32, 1 erro +16, 2 erros +8 (veio +${cheio.heroi.army - 10}/+${umErro.heroi.army - 10}/+${doisErros.heroi.army - 10})`)
    assert(umErro.credito === base.credito + 1 && doisErros.credito === base.credito + 0, `E3: licença do grau 4: 1 erro paga 1 (2 × 0,5), 2 erros pagam 0 (veio +${umErro.credito - base.credito}/+${doisErros.credito - base.credito})`)
    assert(umErro.madeira === base.madeira + 4 && umErro.ouro === base.ouro + 2, 'E3: madeira e ouro caem pela metade com 1 erro')
    // o ganho gravado no altar é o da conta REDUZIDA (o toast lê dele)
    assert(umErro.altar?.ganhoVida === 16 && cheio.altar?.ganhoVida === 32, 'E3: o ganho de vida gravado no altar é o REDUZIDO (16) e o cheio (32)')
    // e o de LICENÇA também: o toast do piso físico lia `GRAU_PARTIDA[tier].credito` (a licença CHEIA) e dizia «+6 de vida e 2 licenças» a quem recebeu 1
    assert(cheio.altar?.ganhoCredito === 2 && umErro.altar?.ganhoCredito === 1 && doisErros.altar?.ganhoCredito === 0, `E3: o ganho de licença gravado no altar acompanha o buff (2 / 1 / 0; veio ${cheio.altar?.ganhoCredito}/${umErro.altar?.ganhoCredito}/${doisErros.altar?.ganhoCredito})`)
    assert(abrirAltar(createPartida(), 4, 0).altar?.ganhoCredito === undefined, 'E3: altar ainda não resolvido não tem ganho de licença gravado')
    // (4) o abate de inimigos também cai. 6 inimigos vivos, grau 4 (wipe 100 %): 6 sem erro; 1 erro = round(6 × 1 × 0,5) = 3; 5 erros = no mínimo 1.
    const inimigo = (id: number): PartidaState['unidades'][number] => ({ id, lado: 'inimigo', papel: 'horda', x: 20 + id, z: 20, hp: 12, postura: 'automatico', ordem: null, cooldown: 0, segmentos: [], alerta: false })
    const seis: PartidaState = { ...abrirAltar(createPartida(), 4, 0), unidades: [7001, 7002, 7003, 7004, 7005, 7006].map(inimigo) }
    const vivos = (s: PartidaState): number => s.unidades.filter((u) => u.lado === 'inimigo' && u.hp > 0).length
    assert(vivos(seis) === 6, 'E3: o cenário de 6 inimigos montou 6 inimigos vivos (senão o abate abaixo não prova nada)')
    assert(vivos(aplicarConta(seis, 4)) === 0, 'E3: sem erro o grau 4 abate os 6')
    assert(vivos(aplicarConta(registrarErroNoAltar(seis), 4)) === 3, 'E3: com 1 erro o grau 4 abate 3 de 6')
    let muitos = seis
    for (let i = 0; i < 5; i++) muitos = registrarErroNoAltar(muitos)
    assert(vivos(aplicarConta(muitos, 4)) === 5, 'E3: com 5 erros ainda abate pelo menos 1 inimigo (piso)')
    // (5) PISO FÍSICO: pisar numa placa ERRADA conta 1 erro, mas ficar parado em cima dela NÃO conta de novo a cada passo.
    const alt = abrirAltar(createPartida(), 1, 0)
    const naErrada = { ...alt, heroi: { ...alt.heroi, x: alt.altar!.cx + PARTIDA.altarPasso, z: alt.altar!.cz } }
    const p1 = stepPartida(naErrada, INPUT_PARADO, 0.05)
    assert(p1.altar?.erros === 1 && p1.altar?.resolvido !== true, 'E3: pisar numa placa errada conta 1 erro (e não paga)')
    let parado = p1
    for (let i = 0; i < 40; i++) parado = stepPartida(parado, INPUT_PARADO, 0.05)
    assert(parado.altar?.erros === 1, `E3: ficar PARADO na placa errada (40 passos) não conta de novo (veio ${parado.altar?.erros})`)
    // sair da placa e voltar a ela = errar DE NOVO
    const saiu = stepPartida({ ...parado, heroi: { ...parado.heroi, x: alt.altar!.cx + 40, z: alt.altar!.cz + 40 } }, INPUT_PARADO, 0.05)
    assert(saiu.altar?.erros === 1, 'E3: sair da placa não conta erro')
    const voltou = stepPartida({ ...saiu, heroi: { ...saiu.heroi, x: alt.altar!.cx + PARTIDA.altarPasso, z: alt.altar!.cz } }, INPUT_PARADO, 0.05)
    assert(voltou.altar?.erros === 2, 'E3: sair e voltar para a MESMA placa errada conta como errar de novo')
    // ir de uma placa errada DIRETO para outra errada também conta
    const outra = stepPartida({ ...p1, heroi: { ...p1.heroi, x: alt.altar!.cx - PARTIDA.altarPasso, z: alt.altar!.cz } }, INPUT_PARADO, 0.05)
    assert(outra.altar?.erros === 2, 'E3: ir de uma placa errada direto para outra errada conta 1 erro a mais')
    // (6) o piso CERTO depois de errar paga o buff reduzido (o jogador não escapa da regra errando no modal e acertando no piso)
    const errouNoModal = registrarErroNoAltar(abrirAltar(createPartida(), 4, 0))
    const certo = stepPartida({ ...errouNoModal, heroi: { ...errouNoModal.heroi, x: errouNoModal.altar!.cx, z: errouNoModal.altar!.cz + PARTIDA.altarPasso } }, INPUT_PARADO, 0.05)
    assert(certo.altar?.resolvido === true && certo.altar?.ganhoVida === 16, `E3: errar no modal e acertar no PISO paga o buff reduzido (ganho ${certo.altar?.ganhoVida}, esperado 16)`)
    // (7) cada conta começa limpa: o altar seguinte nasce com 0 erros mesmo depois de uma conta com erros.
    assert(abrirAltar(doisErros, 2, 1).altar?.erros === 0, 'E3: a conta seguinte começa com 0 erros')
  }

  // ── Torre nível 5 não sobrescreve o edifício do lado (pedido do usuário, 22/11: «dá um erro ao evoluir para o nível 5 se tiver outro edifício do lado na área que a construção vai ocupar») ──
  // O nível 5 transforma a obra numa FORTALEZA de 7 × 7 blocos de 0,85 m (5,95 m de lado: 29 vezes a área de uma torre de 1,1 m). `evoluir` só conferia «existe, é nossa, nível < 5» e
  // nunca perguntava se a área nova estava livre: o quartel ao lado ficava DENTRO da fortaleza. `podeEvoluir` devolve `{ ok, motivo }` (como `podeFundarEm`) e `evoluir` a respeita.
  {
    const MEIA_FORTALEZA = (7 * 0.85) / 2 // 2,975 m
    const aproxima = (st: PartidaState, tipo: PecaId, x: number, z: number): PartidaState => fundar(st, tipo, x, z)
    // monta: núcleo (longe do herói), torre em (0, 12) já no nível 4, e opcionalmente um vizinho a `dist` metros da torre no eixo x
    const cenario = (vizinho: { tipo: PecaId; dist: number } | null): { st: PartidaState; torreId: number } => {
      let st = fundar(createPartida(), 'nucleo', 5, 0)
      st = aproxima(st, 'torre', 0, 12)
      const torreId = st.obras.find((o) => o.tipo === 'torre')!.id
      st = { ...st, credito: 20, madeira: 60, ouro: 60 }
      for (let n = 0; n < 3; n += 1) st = evoluir(st, torreId) // Nv1 -> Nv4 (a área só muda no Nv5)
      if (vizinho) st = aproxima(st, vizinho.tipo, vizinho.dist, 12)
      return { st, torreId }
    }
    const nivelDa = (st: PartidaState, id: number): number => st.obras.find((o) => o.id === id)!.nivel

    // R2 CONTROLE POSITIVO: sem vizinho a torre evolui ao Nv5 (senão o R1 podia estar recusando por outro motivo)
    const livre = cenario(null)
    assert(nivelDa(livre.st, livre.torreId) === 4, 'T-Nv5: a torre chegou ao nível 4 no cenário (controle do cenário)')
    assert(podeEvoluir(livre.st, livre.torreId).ok === true, `T-Nv5 R2: sem vizinho, podeEvoluir diz OK (veio ${JSON.stringify(podeEvoluir(livre.st, livre.torreId))})`)
    assert(nivelDa(evoluir(livre.st, livre.torreId), livre.torreId) === 5, 'T-Nv5 R2: sem vizinho a torre evolui para o nível 5')

    // R1: um quartel a 3,5 m (cabe ao lado da torre PEQUENA, mas está dentro da fortaleza de 5,95 m) bloqueia o Nv5
    const colado = cenario({ tipo: 'quartel', dist: 3.5 })
    assert(colado.st.obras.some((o) => o.tipo === 'quartel'), 'T-Nv5: o quartel vizinho foi fundado (cabia ao lado da torre pequena): sem isso o cenário não prova nada')
    const recusa = podeEvoluir(colado.st, colado.torreId)
    assert(recusa.ok === false, 'T-Nv5 R1: com o quartel a 3,5 m, evoluir para o Nv5 é RECUSADO')
    assert(/espa|bloquead|obra|edif/i.test(recusa.motivo ?? ''), `T-Nv5 R1: o motivo fala do ESPAÇO/obra vizinha, não de preço (veio «${recusa.motivo}»)`)
    assert(!/precisa de|licen|madeira|ouro/i.test(recusa.motivo ?? ''), `T-Nv5 R1: o motivo NÃO é a mensagem de preço (veio «${recusa.motivo}»)`)
    // o CÓDIGO da recusa é o que liga o motivo ao texto da tela (`textoDaRecusaDeEvoluir`): um código errado reintroduziria o defeito (mensagem de PREÇO para um problema de ESPAÇO)
    assert(recusa.codigo === 'espaco', `T-Nv5 R1: o código da recusa por vizinho é «espaco» (veio «${recusa.codigo}»)`)
    const aposTentar = evoluir(colado.st, colado.torreId)
    assert(nivelDa(aposTentar, colado.torreId) === 4, 'T-Nv5 R1: evoluir recusado NÃO sobe o nível (continua 4)')
    assert(aposTentar.credito === colado.st.credito && aposTentar.madeira === colado.st.madeira && aposTentar.ouro === colado.st.ouro, 'T-Nv5 R1: evoluir recusado NÃO cobra recurso nenhum')
    assert(aposTentar.obras.find((o) => o.tipo === 'quartel')!.nivel === colado.st.obras.find((o) => o.tipo === 'quartel')!.nivel, 'T-Nv5 R1: o quartel do lado não foi tocado')
    assert(aposTentar.obras.find((o) => o.id === colado.torreId)!.blocosNv5 === undefined, 'T-Nv5 R1: a torre NÃO ganhou a fortaleza de blocos')

    // R3: a FRONTEIRA. A fortaleza (meia-largura 2,975) colide com um quartel (meia-largura 1,0) + corpo (0,35) até 4,325 m do centro no eixo; além disso cabe.
    const limite = MEIA_FORTALEZA + 1.0 + 0.35
    const justoFora = cenario({ tipo: 'quartel', dist: limite + 0.3 })
    assert(justoFora.st.obras.some((o) => o.tipo === 'quartel'), 'T-Nv5 R3: o quartel a 4,6 m foi fundado')
    assert(podeEvoluir(justoFora.st, justoFora.torreId).ok === true, `T-Nv5 R3: um quartel a ${(limite + 0.3).toFixed(2)} m está FORA da fortaleza e NÃO bloqueia (a fronteira não pode ser larga demais)`)
    const justoDentro = cenario({ tipo: 'quartel', dist: limite - 0.3 })
    assert(justoDentro.st.obras.some((o) => o.tipo === 'quartel'), 'T-Nv5 R3: o quartel a 4,0 m foi fundado')
    assert(podeEvoluir(justoDentro.st, justoDentro.torreId).ok === false, `T-Nv5 R3: um quartel a ${(limite - 0.3).toFixed(2)} m está DENTRO e bloqueia (a fronteira não pode ser estreita demais)`)

    // R4: o vizinho NÃO atrapalha os níveis 2, 3 e 4 (a área só muda no 5): do Nv1 ao Nv4 evolui normalmente com o quartel a 3,5 m
    let baixo = fundar(createPartida(), 'nucleo', 5, 0)
    baixo = fundar(baixo, 'torre', 0, 12)
    const idBaixo = baixo.obras.find((o) => o.tipo === 'torre')!.id
    baixo = fundar(baixo, 'quartel', 3.5, 12)
    baixo = { ...baixo, credito: 20, madeira: 60, ouro: 60 }
    for (let n = 1; n <= 3; n += 1) {
      assert(podeEvoluir(baixo, idBaixo).ok === true, `T-Nv5 R4: com o quartel colado, evoluir do nível ${n} para ${n + 1} continua permitido`)
      baixo = evoluir(baixo, idBaixo)
    }
    assert(nivelDa(baixo, idBaixo) === 4, 'T-Nv5 R4: chegou ao nível 4 com o quartel colado')
    assert(podeEvoluir(baixo, idBaixo).ok === false, 'T-Nv5 R4: e SÓ o passo 4 → 5 é recusado')

    // R5: outros tipos que também viram fortaleza no Nv5 obedecem à mesma regra (o quartel evoluído ao lado de uma torre colada). O limite depende do VIZINHO: uma torre (meia-largura 0,55)
    // colide com a fortaleza até 2,975 + 0,55 + 0,35 = 3,875 m do centro; a 3,0 m está DENTRO e a 4,2 m está FORA. (A 1ª versão deste caso punha a torre a 4,2 m e o teste falhava: o erro era
    // do TESTE, não da regra; confirmado pela conta antes de mexer no código.)
    const montaQuartel = (distTorre: number): { st: PartidaState; id: number } => {
      let q = fundar(createPartida(), 'nucleo', 5, 0)
      q = fundar(q, 'quartel', 0, 12)
      const id = q.obras.find((o) => o.tipo === 'quartel')!.id
      q = fundar(q, 'torre', distTorre, 12)
      q = { ...q, credito: 20, madeira: 60, ouro: 60 }
      for (let n = 0; n < 3; n += 1) q = evoluir(q, id)
      return { st: q, id }
    }
    const qDentro = montaQuartel(3.0)
    assert(qDentro.st.obras.some((o) => o.tipo === 'torre'), 'T-Nv5 R5: a torre vizinha foi fundada a 3,0 m do quartel')
    assert(qDentro.st.obras.find((o) => o.id === qDentro.id)!.nivel === 4, 'T-Nv5 R5: o quartel chegou ao nível 4 (controle do cenário)')
    assert(podeEvoluir(qDentro.st, qDentro.id).ok === false, 'T-Nv5 R5: um QUARTEL no nível 4 também não vira fortaleza em cima de uma torre vizinha a 3,0 m')
    const qFora = montaQuartel(4.2)
    assert(qFora.st.obras.some((o) => o.tipo === 'torre'), 'T-Nv5 R5: a torre vizinha foi fundada a 4,2 m do quartel')
    assert(podeEvoluir(qFora.st, qFora.id).ok === true, 'T-Nv5 R5: a mesma torre a 4,2 m está FORA da fortaleza (limite 3,875 m) e NÃO bloqueia o quartel')

    // R6: obra INIMIGA vizinha também bloqueia (o espaço é do mundo, não só das nossas obras); e uma obra MORTA (hp 0) NÃO bloqueia
    const comInimiga = cenario(null)
    const inimigaPerto: PartidaState = { ...comInimiga.st, obras: [...comInimiga.st.obras, { id: 99001, lado: 'inimigo', tipo: 'quartel', x: 3.5, z: 12, nivel: 1, hp: 40, maxHp: 40, gateApplied: false, cooldown: 0 }] }
    assert(podeEvoluir(inimigaPerto, comInimiga.torreId).ok === false, 'T-Nv5 R6: uma obra INIMIGA dentro da área também bloqueia')
    const inimigaMorta: PartidaState = { ...inimigaPerto, obras: inimigaPerto.obras.map((o) => (o.id === 99001 ? { ...o, hp: 0 } : o)) }
    assert(podeEvoluir(inimigaMorta, comInimiga.torreId).ok === true, 'T-Nv5 R6: uma obra MORTA (hp 0, ruína) NÃO bloqueia')

    // R8: o EIXO Z (a 1ª rodada de mutação deixou sobreviver «sem a última borda em z» e «meia-largura em z dobrada»: o R1 e o R3 só moviam o vizinho em x). Um BLOCO DE PEDRA do mundo
    // (célula inteira, passo 1 m: o centro da célula (gx, gz) é (gx, gz) metros) só no limite em z. A fortaleza em (0, 12) vai de z = 9,025 a 14,975; com corpo 0,35 o bloco colide até
    // z ≈ 15,3: em z = 15 está DENTRO (bloqueia); em z = 17 está FORA (não bloqueia). Um controle com o mesmo bloco em x garante que o eixo x não foi o que decidiu.
    // (Pedra consome LINGOTES e o cenário só tinha madeira e ouro: o 1º controle do cenário falhou com «o bloco não foi colocado». Medido por diagnóstico antes de mexer: com `lingotes: 0`
    // entram 0 blocos, com `lingotes: 50` entra 1; o chão já estava revelado em todos os pontos usados.)
    const comBloco = (gx: number, gz: number): { st: PartidaState; torreId: number } => {
      const base = cenario(null)
      return { st: editarBlocoMundo({ ...base.st, lingotes: 50 }, gx, 0, gz, 'adicionar', 'pedra'), torreId: base.torreId }
    }
    const blocoZDentro = comBloco(0, 15)
    assert(Object.keys(blocoZDentro.st.blocosMapa).length === 1, 'T-Nv5 R8: o bloco de pedra em z = 15 foi colocado (controle do cenário)')
    assert(podeEvoluir(blocoZDentro.st, blocoZDentro.torreId).ok === false, 'T-Nv5 R8: um BLOCO do mundo na borda +z da fortaleza (z = 15) bloqueia o Nv5')
    const blocoZFora = comBloco(0, 17)
    assert(Object.keys(blocoZFora.st.blocosMapa).length === 1, 'T-Nv5 R8: o bloco de pedra em z = 17 foi colocado (controle do cenário)')
    assert(podeEvoluir(blocoZFora.st, blocoZFora.torreId).ok === true, 'T-Nv5 R8: o mesmo bloco FORA da fortaleza (z = 17) NÃO bloqueia')
    const blocoZNegativo = comBloco(0, 9)
    assert(podeEvoluir(blocoZNegativo.st, blocoZNegativo.torreId).ok === false, 'T-Nv5 R8: um bloco na borda −z (z = 9) também bloqueia (as DUAS bordas em z contam)')
    const blocoXDentro = comBloco(3, 12)
    assert(podeEvoluir(blocoXDentro.st, blocoXDentro.torreId).ok === false, 'T-Nv5 R8: um bloco na borda +x (x = 3) bloqueia (controle: o eixo x continua valendo)')
    // um quartel só em z (mesmo x da torre): colado em z = 15,5 dentro, longe em z = 19 fora. O limite em z de um quartel é 2,975 + 1,0 + 0,35 = 4,325 m: 12 + 4,325 = 16,325.
    const quartelZDentro = cenario(null)
    const stQZ = fundar(quartelZDentro.st, 'quartel', 0, 12 + 4.0)
    assert(stQZ.obras.some((o) => o.tipo === 'quartel'), 'T-Nv5 R8: o quartel a 4,0 m em z foi fundado')
    assert(podeEvoluir(stQZ, quartelZDentro.torreId).ok === false, 'T-Nv5 R8: um quartel a 4,0 m EM Z (limite 4,325 m) bloqueia: o eixo z conta para obras também')
    const stQZfora = fundar(cenario(null).st, 'quartel', 0, 12 + 4.7)
    assert(stQZfora.obras.some((o) => o.tipo === 'quartel'), 'T-Nv5 R8: o quartel a 4,7 m em z foi fundado')
    assert(podeEvoluir(stQZfora, stQZfora.obras.find((o) => o.tipo === 'torre')!.id).ok === true, 'T-Nv5 R8: um quartel a 4,7 m EM Z está fora (limite 4,325 m) e NÃO bloqueia')

    // R9: a ORDEM das recusas é o que o jogador LÊ (a interface vai mostrar o `motivo`). Obra em andaime: motivo de construção. Sem recurso: motivo de recurso (e NÃO o de espaço, mesmo com
    // vizinho). (A 1ª rodada deixou sobreviver «deixa passar a obra em construção» e «deixa passar sem recurso»: `evoluir` já checava os dois, mas `podeEvoluir` é pública e a tela a chama sozinha.)
    let andaime = fundar(createPartida(), 'nucleo', 5, 0)
    andaime = iniciarObra({ ...andaime, credito: 20, madeira: 60, ouro: 60 }, 'torre', 0, 12)
    const idAndaime = andaime.obras.find((o) => o.tipo === 'torre')!.id
    assert(obraEmConstrucao(andaime.obras.find((o) => o.id === idAndaime)!), 'T-Nv5 R9: a torre está em andaime (controle do cenário)')
    const emObra = podeEvoluir(andaime, idAndaime)
    assert(emObra.ok === false && /constru/i.test(emObra.motivo ?? ''), `T-Nv5 R9: obra em construção recusa com o motivo de construção (veio «${emObra.motivo}»)`)
    assert(emObra.codigo === 'construcao', `T-Nv5 R9: o código da obra em andaime é «construcao» (veio «${emObra.codigo}»)`)
    const semDinheiro = podeEvoluir({ ...livre.st, credito: 0, madeira: 0, ouro: 0 }, livre.torreId)
    assert(semDinheiro.ok === false && /licen|recurso/i.test(semDinheiro.motivo ?? ''), `T-Nv5 R9: sem licença nem recursos recusa com o motivo de RECURSO (veio «${semDinheiro.motivo}»)`)
    assert(semDinheiro.codigo === 'recurso', `T-Nv5 R9: o código da falta de dinheiro é «recurso» (veio «${semDinheiro.codigo}»)`)
    const semDinheiroComVizinho = podeEvoluir({ ...colado.st, credito: 0, madeira: 0, ouro: 0 }, colado.torreId)
    assert(semDinheiroComVizinho.ok === false && /licen|recurso/i.test(semDinheiroComVizinho.motivo ?? ''), `T-Nv5 R9: sem recurso E com vizinho, o motivo é o de RECURSO (a ordem das recusas: o dinheiro primeiro) (veio «${semDinheiroComVizinho.motivo}»)`)

    // R7: `podeEvoluir` não aceita lixo (obra inexistente, de outro lado, em construção, nível 5): devolve ok:false com motivo, nunca lança
    assert(podeEvoluir(livre.st, 424242).ok === false, 'T-Nv5 R7: obra inexistente não pode evoluir')
    assert(podeEvoluir(evoluir(livre.st, livre.torreId), livre.torreId).ok === false, 'T-Nv5 R7: obra que já está no nível 5 não pode evoluir (máximo)')
    assert((podeEvoluir(livre.st, 424242).motivo ?? '').length > 0, 'T-Nv5 R7: a recusa SEMPRE traz um motivo legível')
  }


  let marco = inicio
  for (let i = 0; i < 80 && !marco.ruaPercorrida; i++) marco = anda(marco, 0.1)
  assert(marco.ruaPercorrida && !marco.derrota, 'fim do asfalto não trava')
  const seguiu = anda(marco, 0.2)
  assert(seguiu.heroi.z !== marco.heroi.z || seguiu.heroi.x !== marco.heroi.x, 'passo segue depois do asfalto')
  const voltou = continuarNaRua(marco)
  assert(voltou.heroi.z === 0 && voltou.obras.length === marco.obras.length, 'continuar na rua não apaga a base')

  // (O caso antigo aqui afirmava 'sem base não nasce leva': era a restrição que o usuário mandou TIRAR em 22/11. Foi trocado pelo bloco M1 abaixo, que afirma o oposto e prova a metade que fica.)
  // ── M1: a onda inimiga NAO exige mais o SEU nucleo (pedido do usuario, 22/11: «os inimigos evoluem mesmo sem base, pode deixar»; «pode tirar essa restricao») ──────────────────────
  // Antes `passoOnda` zerava o relogio e nao disparava nada se faltasse o nucleo seu OU o inimigo. Agora so a metade INIMIGA continua exigida (sem base inimiga nao ha de onde a onda sair):
  // o inimigo evolui num mapa onde ninguem seu fundou base, e quando o heroi chega encontra uma base maior e um exercito. A SAIDA da base aponta para quem ha no mapa: nucleo seu → heroi →
  // tropa → centro do mapa. COM nucleo seu o comportamento e IDENTICO ao de antes (a invariante: nada muda para quem ja tinha base).
  {
    const semBase = createPartida() // base inimiga viva, nenhum nucleo seu, heroi em (0, 0)
    const nucleoInim = semBase.obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo')!
    assert(nucleoInim.hp > 0 && !semBase.obras.some((o) => o.lado !== 'inimigo'), 'M1: cenario = base inimiga viva e nenhuma obra nossa (controle do cenario)')
    const sitiantes = (s: PartidaState): number => s.unidades.filter((u) => u.papel === 'sitiante' && u.hp > 0).length

    // M1.a: sem nucleo seu a 1a onda DISPARA (antes: «sem base nao nasce leva», o teste que travava a restricao)
    const onda1 = anda(semBase, PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
    assert(onda1.ondaNumero >= 1, `M1.a: sem nucleo seu a onda DISPARA (ondaNumero ${onda1.ondaNumero}, esperado >= 1)`)
    assert(sitiantes(onda1) >= PARTIDA.levaPrimeira, `M1.a: a 1a onda sem nucleo seu gera os sitiantes (${sitiantes(onda1)} de ${PARTIDA.levaPrimeira})`)
    assert(onda1.ondaRelogio < PARTIDA.ondaPeriodo, 'M1.a: o relogio da onda NAO fica preso em zero nem estoura o periodo')

    // M1.b: o relogio AVANCA sem nucleo seu (antes ficava preso em 0)
    const meio = anda(semBase, PARTIDA.ondaPeriodo / 2, INPUT_PARADO)
    assert(meio.ondaRelogio > 1, `M1.b: o relogio da onda avanca sem nucleo seu (veio ${meio.ondaRelogio})`)

    // M1.c: a base inimiga CRESCE sem nucleo seu (`crescerBaseInimiga` ja nao dependia dele; so a onda nao disparava). Nivel do nucleo inimigo sobe com o numero da onda.
    const aposTres = anda(semBase, PARTIDA.ondaPeriodo * 3 + 0.5, INPUT_PARADO)
    const nucleoDepois = aposTres.obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo')!
    assert(nucleoDepois.nivel > nucleoInim.nivel, `M1.c: a base inimiga evolui sem nucleo seu (nivel ${nucleoInim.nivel} -> ${nucleoDepois.nivel} em 3 ondas)`)
    assert(aposTres.obras.filter((o) => o.lado === 'inimigo').length > semBase.obras.filter((o) => o.lado === 'inimigo').length, 'M1.c: a base inimiga GANHA obras (cresce) sem nucleo seu')

    // M1.d: a onda 3 e a do DRAGAO (`numero % 3 === 0`): tambem nasce sem nucleo seu (`nascerDragaoDaLeva` tinha a MESMA restricao, em outro ponto)
    const dragoes = (s: PartidaState): number => s.unidades.filter((u) => u.papel === 'dragao' && u.hp > 0).length
    const antesDragao = { ...semBase, ondaNumero: 2, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }
    const dragaoNasce = stepPartida(antesDragao, INPUT_PARADO, 0.1)
    assert(dragaoNasce.ondaNumero === 3 && dragoes(dragaoNasce) === 1, `M1.d: a onda 3 sem nucleo seu gera o DRAGAO (ondaNumero ${dragaoNasce.ondaNumero}, dragoes ${dragoes(dragaoNasce)})`)

    // M1.e: a metade que FICA: sem base INIMIGA nao ha onda (nem com nucleo seu)
    const semInimigaNemNossa = { ...semBase, obras: semBase.obras.filter((o) => o.lado !== 'inimigo') }
    const nadaNasce = anda(semInimigaNemNossa, PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
    assert(nadaNasce.ondaNumero === 0 && sitiantes(nadaNasce) === 0, 'M1.e: sem base inimiga nao ha onda (so a restricao do SEU nucleo saiu)')
    assert(nadaNasce.ondaRelogio === 0, 'M1.e: sem base inimiga o relogio fica em 0 (nada para contar)')

    // Mede a leva NO INSTANTE EM QUE NASCE (1o passo em que existe um sitiante), nao 20 s depois: a leva ANDA em direcao ao alvo e a posicao final nao diz de onde ela saiu. (A 1a versao
    // deste caso media depois dos 20 s e falhou: o defeito era do TESTE; um diagnostico com o codigo ANTIGO e o NOVO lado a lado mostrou posicoes IDENTICAS ao milimetro COM nucleo seu.)
    const nascimento = (s0: PartidaState): Array<[number, number]> => {
      let s = s0
      for (let t = 0; t < 40; t += 0.05) {
        s = stepPartida(s, INPUT_PARADO, 0.05)
        const sit = s.unidades.filter((u) => u.papel === 'sitiante')
        if (sit.length > 0) return sit.map((u): [number, number] => [Math.round(u.x * 100) / 100, Math.round(u.z * 100) / 100])
      }
      return []
    }
    // M1.f: INVARIANTE: COM nucleo seu a onda e IDENTICA a de antes. ORACULO = as posicoes que o codigo ANTIGO produzia (medidas com o backup antes da mudanca): -43,-6 / -42,-7 / -41,-7 / -40,-7,
    // com o heroi em qualquer lugar (a saida aponta para o NUCLEO seu, nunca para o heroi).
    const ESPERADO_COM_NUCLEO = JSON.stringify([[-43, -6], [-42, -7], [-41, -7], [-40, -7]])
    const comNucleo = fundar(createPartida(), 'nucleo', 12, 20)
    assert(JSON.stringify(nascimento({ ...comNucleo, heroi: { ...comNucleo.heroi, x: -30, z: -30 } })) === ESPERADO_COM_NUCLEO, 'M1.f: COM nucleo seu a leva nasce nas MESMAS posicoes do codigo antigo (heroi em -30,-30)')
    assert(JSON.stringify(nascimento(comNucleo)) === ESPERADO_COM_NUCLEO, 'M1.f: COM nucleo seu a leva nasce nas MESMAS posicoes do codigo antigo (heroi em 0,0): a saida NAO depende do heroi')

    // M1.g: SEM nucleo seu a saida aponta para o HEROI (decisao do usuario: «o inimigo caca o heroi e as tropas»). Oraculo medido: heroi em (-30,-30) => -44,-11 / -43,-11 / -42,-11 / -41,-11
    // (DIFERENTE das posicoes com nucleo: e o que prova que o heroi, e nao o nucleo, decide a saida).
    const heroiNoCanto: PartidaState = { ...semBase, heroi: { ...semBase.heroi, x: -30, z: -30 } }
    const nascHeroi = nascimento(heroiNoCanto)
    assert(JSON.stringify(nascHeroi) === JSON.stringify([[-44, -11], [-43, -11], [-42, -11], [-41, -11]]), `M1.g: SEM nucleo seu a leva sai em direcao ao HEROI (veio ${JSON.stringify(nascHeroi)})`)
    assert(JSON.stringify(nascHeroi) !== ESPERADO_COM_NUCLEO, 'M1.g: a saida sem nucleo e DIFERENTE da saida com nucleo (o heroi decide)')
    // heroi do OUTRO lado: a saida muda de lado (nao e uma constante)
    const nascOutroLado = nascimento({ ...semBase, heroi: { ...semBase.heroi, x: 30, z: 30 } })
    assert(nascOutroLado.length > 0 && JSON.stringify(nascOutroLado) !== JSON.stringify(nascHeroi), 'M1.g: com o heroi no lado oposto a saida MUDA de lado (acompanha o heroi)')
    // tropa no lugar do heroi (sem corpo): a saida acompanha a TROPA
    const soTropa: PartidaState = { ...semBase, semCorpo: true, unidades: [...semBase.unidades.filter((u) => u.lado === 'inimigo'), { id: 9100, lado: 'aliado', papel: 'tropa', x: -30, z: -30, hp: 20, postura: 'vigia', ordem: null, cooldown: 0, segmentos: [], alerta: false }] }
    const nascTropa = nascimento(soTropa)
    assert(JSON.stringify(nascTropa) === JSON.stringify(nascHeroi), `M1.g: sem heroi e com uma tropa em (-30,-30) a saida e a MESMA de um heroi la (veio ${JSON.stringify(nascTropa)})`)
    // DUAS tropas: a saida acompanha a MAIS PERTO da base inimiga (a 1a rodada de mutacao deixou sobreviver «escolhe a mais longe»: meu unico caso tinha UMA tropa). A base inimiga fica
    // em (-43,-6) aprox.; uma tropa em (-30,-30) esta a ~27 m, outra em (30,30) a ~85 m: a perto e a de (-30,-30), entao a saida tem de ser a MESMA de uma so tropa la.
    const tropa = (id: number, x: number, z: number): PartidaState['unidades'][number] => ({ id, lado: 'aliado', papel: 'tropa', x, z, hp: 20, postura: 'vigia', ordem: null, cooldown: 0, segmentos: [], alerta: false })
    const inimigasSo = semBase.unidades.filter((u) => u.lado === 'inimigo')
    const nascDuas = nascimento({ ...semBase, semCorpo: true, unidades: [...inimigasSo, tropa(9101, 30, 30), tropa(9102, -30, -30)] })
    assert(JSON.stringify(nascDuas) === JSON.stringify(nascHeroi), `M1.g: com 2 tropas a saida acompanha a MAIS PERTO da base (veio ${JSON.stringify(nascDuas)})`)
    const nascDuasInvertido = nascimento({ ...semBase, semCorpo: true, unidades: [...inimigasSo, tropa(9101, -30, -30), tropa(9102, 30, 30)] })
    assert(JSON.stringify(nascDuasInvertido) === JSON.stringify(nascHeroi), 'M1.g: a ORDEM das tropas na lista nao importa (so a distancia)')
    // heroi com vida INVALIDA mas «no mapa»: NAO e alvo (a leva nao sai em direcao a um heroi sem vida). ATENCAO: um heroi com vida 0, negativa ou -Infinity ENCERRA A PARTIDA no 1o passo
    // (`checaDerrota`), entao a onda nem chega a disparar: o meu 1o caso (`army: 0`) era IMPOSSIVEL de construir e o diagnostico mostrou `derrota: true` em t = 0. Medi com 10 valores: so `NaN`
    // passa pela derrota (`NaN <= 0` e falso) e DISPARA a onda: e o unico valor em que a guarda `army > 0` decide algo. (A 1a rodada: «heroi morto ainda e alvo» sobreviveu.)
    const heroiInvalido: PartidaState = { ...semBase, heroi: { ...semBase.heroi, x: 30, z: 30, army: Number.NaN }, unidades: [...inimigasSo, tropa(9103, -30, -30)] }
    assert(JSON.stringify(nascimento(heroiInvalido)) === JSON.stringify(nascHeroi), 'M1.g: heroi com vida NaN NAO e alvo: a saida segue a tropa (em -30,-30) e nao o heroi (em 30,30)')
    const heroiInvalidoSemTropa: PartidaState = { ...semBase, heroi: { ...semBase.heroi, x: 30, z: 30, army: Number.NaN } }
    const nascInvalidoSemTropa = nascimento(heroiInvalidoSemTropa)
    assert(nascInvalidoSemTropa.length > 0 && nascInvalidoSemTropa.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z)), 'M1.g: heroi NaN e sem tropa: a leva nasce em posicao FINITA (nunca NaN)')
    assert(JSON.stringify(nascInvalidoSemTropa) === JSON.stringify(nascimento({ ...semBase, semCorpo: true })), 'M1.g: heroi NaN e sem tropa = mesmo que ninguem (saida no centro do mapa)')
    // a partida com heroi de vida 0 TERMINA antes da onda: controle de que o caso impossivel continua impossivel (se um dia a derrota mudar, este caso avisa)
    assert(stepPartida({ ...semBase, heroi: { ...semBase.heroi, army: 0 } }, INPUT_PARADO, 0.05).derrota === true, 'M1.g: (controle) heroi com vida 0 encerra a partida no 1o passo: nao ha onda para ele ser alvo')

    // M1.h: sem NINGUEM seu (herói sem corpo, sem tropa, sem nucleo): a onda ainda dispara (a base evolui), a saida cai no CENTRO do mapa, e nada quebra (nada de NaN)
    const ninguem: PartidaState = { ...semBase, semCorpo: true }
    const ondaNinguem = anda(ninguem, PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
    assert(ondaNinguem.ondaNumero >= 1, 'M1.h: sem ninguem seu a onda dispara (a base evolui)')
    assert(ondaNinguem.unidades.every((u) => Number.isFinite(u.x) && Number.isFinite(u.z) && Number.isFinite(u.hp)), 'M1.h: nenhuma unidade com NaN/Infinity quando nao ha ninguem seu')
    assert(sitiantes(ondaNinguem) >= 1, 'M1.h: os sitiantes nascem mesmo sem ninguem seu (evoluem parados)')

    // M1.i: o teto `enemyCap` continua valendo sem nucleo seu: uma base que evolui por MUITO tempo nao enche o mapa de inimigos
    let longo: PartidaState = semBase
    for (let i = 0; i < 40; i += 1) longo = anda(longo, PARTIDA.ondaPeriodo, INPUT_PARADO)
    assert(longo.unidades.filter((u) => u.lado === 'inimigo' && u.hp > 0).length <= PARTIDA.enemyCap, `M1.i: sem nucleo seu o teto de inimigos (${PARTIDA.enemyCap}) continua valendo depois de 40 ondas`)
  }
  // ── M2: o mapa vizinho NASCE com o inimigo já evoluído e mais forte quanto mais longe (pedido do usuário, 22/11) ──
  // `evoluirInimigo(estado, fator, estagio)`: (a) a base inimiga é recrescida até o ESTÁGIO (nível do núcleo e peças, prontas e com vida cheia) com a mesma regra que as ondas
  // usam; (b) a VIDA de tudo que o inimigo tem se multiplica pelo FATOR (horda, núcleo, peças) e o fator fica guardado no estado para as ondas FUTURAS nascerem iguais; (c) a QUANTIDADE
  // não muda; (d) NADA do que é nosso, nem o bioma, entra na cópia. ORÁCULOS medidos no código real (`medir-estagio-base.mjs`, partida em (1,0) parada): onda 2 = núcleo nível 2
  // + 1 torre hp 50; onda 3 = núcleo nível 3 + a mesma torre pronta.
  {
    const inimigas = (s: PartidaState) => s.obras.filter((o) => o.lado === 'inimigo')
    const nucleoI = (s: PartidaState) => s.obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo')!
    const hordaDe = (s: PartidaState) => s.unidades.filter((u) => u.lado === 'inimigo' && u.papel === 'horda')
    const pecasDe = (s: PartidaState) => inimigas(s).filter((o) => o.tipo !== 'nucleo')
    const novo = createPartida(2, 0, true)
    const nucleoCru = nucleoI(novo)

    // M2.a: fator 1 e estágio 0 = o mapa como nasce hoje (invariante: nada muda sem camada nem estágio)
    const igual = evoluirInimigo(novo, 1, 0)
    assert(JSON.stringify(igual.obras) === JSON.stringify(novo.obras) && JSON.stringify(igual.unidades) === JSON.stringify(novo.unidades), 'M2.a: fator 1 e estágio 0 não mudam a base nem a horda')

    // M2.b: a VIDA se multiplica com o fator e a QUANTIDADE não (decisão de 20/11: «dobro de vida, NÃO dobra a quantidade»)
    const dobro = evoluirInimigo(novo, 2, 0)
    assert(hordaDe(dobro).length === 6 && hordaDe(dobro).every((u) => u.hp === 24), `M2.b: fator 2: a horda segue 6 unidades e cada uma com 24 de vida (veio ${hordaDe(dobro).map((u) => u.hp)})`)
    assert(nucleoI(dobro).hp === 2 * nucleoCru.hp && nucleoI(dobro).maxHp === 2 * nucleoCru.maxHp, `M2.b: fator 2: o núcleo inimigo tem hp e maxHp em dobro (veio ${nucleoI(dobro).hp}/${nucleoI(dobro).maxHp})`)
    assert(inimigas(dobro).length === inimigas(novo).length && dobro.unidades.length === novo.unidades.length, 'M2.b: fator 2 NÃO dobra a quantidade de obras nem de unidades')
    const quadruplo = evoluirInimigo(novo, 4, 0)
    assert(hordaDe(quadruplo).every((u) => u.hp === 48) && nucleoI(quadruplo).hp === 4 * nucleoCru.hp, 'M2.b: fator 4: 48 de vida na horda e 4× no núcleo')
    const f64 = evoluirInimigo(novo, 64, 0)
    assert(hordaDe(f64).every((u) => u.hp === 768) && nucleoI(f64).maxHp === 6400, 'M2.b: fator 64 (o teto): a horda tem 768 e o núcleo 6400')

    // M2.c: o ESTÁGIO recresce a base pelas mesmas regras das ondas, com peças PRONTAS e vida cheia (oráculos medidos)
    const e2 = evoluirInimigo(novo, 1, 2)
    assert(nucleoI(e2).nivel === 2 && inimigas(e2).length === 2, `M2.c: estágio 2 = núcleo nível 2 e 1 peça além do núcleo (veio nível ${nucleoI(e2).nivel}, ${inimigas(e2).length} obras)`)
    const torre2 = pecasDe(e2).find((o) => o.tipo === 'torre')
    assert(torre2 !== undefined && torre2.hp === 50 && torre2.maxHp === 50, 'M2.c: a peça do estágio 2 é uma torre com 50 de vida (oráculo medido)')
    assert(!obraEmConstrucao(torre2) && (torre2.construindoRestante ?? 0) === 0, 'M2.c: a peça clonada já vem PRONTA (uma em construção morreria no 1º golpe: o clone seria grátis de matar)')
    const e3 = evoluirInimigo(novo, 1, 3)
    assert(nucleoI(e3).nivel === 3 && inimigas(e3).length === 2, 'M2.c: estágio 3 = núcleo nível 3 (a onda 3 é a do dragão e não ganha peça)')
    assert(e3.ondaNumero === 3, 'M2.c: o mapa guarda o estágio como onda atual (as ondas seguem DAÍ, não do zero)')
    const e8 = evoluirInimigo(novo, 1, 8)
    assert(nucleoI(e8).nivel === 8 && pecasDe(e8).length === 4, `M2.c: estágio 8 = núcleo nível 8 e 4 peças (ondas 2, 4, 6, 8; veio ${pecasDe(e8).length})`)
    assert(pecasDe(e8).every((o) => !obraEmConstrucao(o) && o.hp > 0), 'M2.c: todas as peças do estágio 8 vêm prontas e vivas')
    const posicoes = new Set(inimigas(e8).map((o) => `${o.x.toFixed(2)},${o.z.toFixed(2)}`))
    assert(posicoes.size === inimigas(e8).length, 'M2.c: nenhuma peça clonada nasce em cima de outra')
    const idsE8 = e8.obras.map((o) => o.id).concat(e8.unidades.map((u) => u.id))
    assert(new Set(idsE8).size === idsE8.length && e8.nextId > Math.max(...idsE8), 'M2.c: ids únicos e `nextId` à frente de todos (a próxima obra não colide)')

    // M2.d: estágio E fator juntos: a peça clonada tem a vida multiplicada, cheia (hp = maxHp)
    const e4f4 = evoluirInimigo(novo, 4, 4)
    assert(pecasDe(e4f4).length === 2 && pecasDe(e4f4).every((o) => o.hp === o.maxHp && o.hp === (o.tipo === 'torre' ? 200 : 160)), 'M2.d: estágio 4 com fator 4: torre 200 e a outra peça 160, sempre hp = maxHp')
    assert(nucleoI(e4f4).nivel === 4 && nucleoI(e4f4).hp === 400, 'M2.d: o nível do núcleo vem do ESTÁGIO e a vida do FATOR (não se misturam)')

    // M2.e: o fator fica GUARDADO e as ondas futuras nascem com a vida multiplicada (senão a dificuldade some na 1ª onda)
    const guardado = evoluirInimigo(novo, 4, 1)
    assert(guardado.fatorInimigo === 4, 'M2.e: o fator fica guardado no estado')
    const sitiantesDe = (s: PartidaState) => s.unidades.filter((u) => u.papel === 'sitiante' && u.hp > 0)
    const longeDeTudo = (s: PartidaState): PartidaState => ({ ...s, heroi: { ...s.heroi, x: 30, z: 30 } })
    const proxima = anda(longeDeTudo(guardado), PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
    assert(proxima.ondaNumero === 2 && sitiantesDe(proxima).length === PARTIDA.levaSeguinte, `M2.e: a leva seguinte tem ${PARTIDA.levaSeguinte} sitiante (a quantidade NÃO se multiplica; veio ${sitiantesDe(proxima).length})`)
    assert(sitiantesDe(proxima).every((u) => u.hp === 4 * 18), `M2.e: a leva da onda 2 nasce com 4 × 18 = 72 de vida (veio ${sitiantesDe(proxima).map((u) => u.hp)})`)
    const proximaNormal = anda(longeDeTudo(novo), PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
    assert(sitiantesDe(proximaNormal).length > 0 && sitiantesDe(proximaNormal).every((u) => u.hp === 14), 'M2.e: (controle) sem fator a leva da onda 1 nasce com 14 de vida, como hoje')
    // a PEÇA que a onda par cria depois também nasce multiplicada
    const aposPar = anda(longeDeTudo(evoluirInimigo(novo, 4, 3)), PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
    const pecaNova = pecasDe(aposPar).filter((o) => obraEmConstrucao(o))
    assert(aposPar.ondaNumero === 4 && pecaNova.length === 1 && pecaNova[0].maxHp === 4 * (pecaNova[0].tipo === 'torre' ? 50 : 40), `M2.e: a peça criada pela onda 4 nasce com a vida multiplicada (maxHp ${pecaNova[0]?.maxHp})`)

    // M2.f: o que NÃO entra na cópia: nada nosso, nem o bioma, nem a selva do lugar (decisão do usuário, 22/11)
    const dentro = evoluirInimigo(novo, 8, 5)
    assert(dentro.obras.every((o) => o.lado === 'inimigo') && dentro.unidades.every((u) => u.lado === 'inimigo'), 'M2.f: nada nosso nasce no mapa clonado')
    assert(dentro.bioma === novo.bioma && JSON.stringify(dentro.recursos) === JSON.stringify(novo.recursos) && JSON.stringify(dentro.lagoas) === JSON.stringify(novo.lagoas), 'M2.f: o bioma, as árvores, as minas e as lagoas seguem as do LUGAR (a selva não é clonada nem escalada)')
    assert(dentro.madeira === 0 && dentro.ouro === 0 && dentro.credito === novo.credito && dentro.semCorpo === true, 'M2.f: recursos e licenças do jogador intactos')
    assert(JSON.stringify(dentro.heroi) === JSON.stringify(novo.heroi), 'M2.f: o herói não é tocado')
    assert(nucleoI(dentro).x === nucleoCru.x && nucleoI(dentro).z === nucleoCru.z && nucleoI(dentro).id === nucleoCru.id, 'M2.f: o núcleo inimigo fica no lugar sorteado para ESTE mapa (a posição é do lugar, não clonada)')

    // M2.g: entradas sujas: fator e estágio inválidos viram «sem efeito», nunca NaN nem vida zero. Cada um SOZINHO (juntos, um mascara o outro: o mutante «estágio NaN passa» morria pelo Infinity)
    const semEfeito = (r: PartidaState, nome: string) => {
      assert(r === novo, `M2.g: ${nome} devolve o MESMO estado (sem efeito, sem cópia)`)
    }
    for (const sujo of [Number.NaN, -1, 0, 0.5, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      semEfeito(evoluirInimigo(novo, sujo, 0), `fator ${sujo} (estágio 0)`)
      semEfeito(evoluirInimigo(novo, 1, sujo), `estágio ${sujo} (fator 1)`)
      const comAmbosSujos = evoluirInimigo(novo, sujo, sujo)
      assert(inimigas(comAmbosSujos).every((o) => Number.isFinite(o.hp) && o.hp > 0 && Number.isFinite(o.maxHp)) && comAmbosSujos.unidades.every((u) => Number.isFinite(u.hp) && u.hp > 0), `M2.g: fator e estágio ${sujo} juntos não deixam vida NaN, zero ou infinita`)
    }
    // um dos dois limpo e o outro sujo: o limpo vale, o sujo é ignorado (o fator 4 vale mesmo com estágio NaN, e o estágio 3 vale mesmo com fator NaN)
    assert(hordaDe(evoluirInimigo(novo, 4, Number.NaN)).every((u) => u.hp === 48) && nucleoI(evoluirInimigo(novo, 4, Number.NaN)).nivel === 1, 'M2.g: fator 4 com estágio NaN: o fator vale e o estágio é ignorado')
    assert(nucleoI(evoluirInimigo(novo, Number.NaN, 3)).nivel === 3 && hordaDe(evoluirInimigo(novo, Number.NaN, 3)).every((u) => u.hp === 12), 'M2.g: estágio 3 com fator NaN: o estágio vale e o fator é ignorado')
    assert(evoluirInimigo(novo, Number.NaN, 3).fatorInimigo === 1, 'M2.g: um fator inválido é guardado como 1× (nunca NaN)')
    const semBaseInim = { ...novo, obras: [] }
    assert(evoluirInimigo(semBaseInim, 4, 5).obras.length === 0, 'M2.g: sem base inimiga não nasce base do nada')

    // M2.h: a IDENTIDADE: fator 1 e estágio 0 devolvem o MESMO objeto (nenhuma cópia à toa por mapa nascido), e o que é NOSSO nunca é tocado: nem a vida, nem a construção
    assert(evoluirInimigo(novo, 1, 0) === novo, 'M2.h: fator 1 e estágio 0 devolvem o próprio estado')
    const nossaTropa: Unidade = { id: 9001, lado: 'aliado', papel: 'tropa', x: 1, z: 1, hp: 16, postura: 'automatico', ordem: null, cooldown: 0, segmentos: [], alerta: false }
    const nossaObra: Obra = { id: 9002, lado: 'nosso', tipo: 'quartel', x: -10, z: -10, nivel: 1, hp: 40, maxHp: 40, gateApplied: false, cooldown: 0, construindoRestante: 3, construindoTotal: 6 }
    const comNossos = { ...novo, unidades: [...novo.unidades, nossaTropa], obras: [...novo.obras, nossaObra] }
    const misto = evoluirInimigo(comNossos, 8, 5)
    assert(misto.unidades.find((u) => u.id === 9001)!.hp === 16, 'M2.h: a tropa NOSSA fica com a mesma vida (o fator é do inimigo)')
    const nossaDepois = misto.obras.find((o) => o.id === 9002)!
    assert(nossaDepois.hp === 40 && nossaDepois.maxHp === 40, 'M2.h: a obra NOSSA fica com a mesma vida e o mesmo maxHp')
    assert(nossaDepois.construindoRestante === 3 && obraEmConstrucao(nossaDepois), 'M2.h: a obra NOSSA em construção segue em construção (só as peças INIMIGAS vêm prontas)')

    // M2.i: o fator GUARDADO no estado é lido com defesa: um valor sujo (0,5, 0, negativo, NaN, infinito) nunca zera, estoura nem vira NaN a vida da leva que nasce
    const proximaSuja = (fatorGuardado: number): PartidaState => anda(longeDeTudo({ ...novo, fatorInimigo: fatorGuardado }), PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
    for (const sujo of [0.5, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const aposSuja = proximaSuja(sujo)
      assert(aposSuja.ondaNumero === 1 && aposSuja.unidades.filter((u) => u.papel === 'sitiante' && u.hp > 0).every((u) => u.hp === 14), `M2.i: fator guardado ${sujo} vale 1×: a leva nasce com 14 de vida (veio ${aposSuja.unidades.filter((u) => u.papel === 'sitiante').map((u) => u.hp)})`)
    }
    assert(proximaSuja(2).unidades.filter((u) => u.papel === 'sitiante' && u.hp > 0).every((u) => u.hp === 28), 'M2.i: (controle) fator guardado 2 dobra a leva da onda 1 (14 → 28)')
    const pecaComFatorSujo = anda(longeDeTudo({ ...evoluirInimigo(novo, 1, 3), fatorInimigo: Number.NaN }), PARTIDA.ondaPeriodo + 0.2, INPUT_PARADO)
    assert(pecaComFatorSujo.obras.filter((o) => o.lado === 'inimigo' && o.tipo !== 'nucleo' && obraEmConstrucao(o)).every((o) => Number.isFinite(o.maxHp) && o.maxHp > 0), 'M2.i: a peça criada com fator guardado NaN tem vida finita')

    // M2.j: um estágio GIGANTE termina e respeita o teto (sem teto, `Infinity` e 1e9 prenderiam o jogo num laço quase infinito ao cruzar a borda)
    for (const gigante of [1e6, 1e9, Number.MAX_SAFE_INTEGER]) {
      const t0 = Date.now()
      const g = evoluirInimigo(novo, 1, gigante)
      assert(Date.now() - t0 < 2000, `M2.j: estágio ${gigante} termina em menos de 2 s (o teto de ${40} corta o laço)`)
      assert(g.ondaNumero === 40 && nucleoI(g).nivel === 40, `M2.j: estágio ${gigante} é cortado no teto da cópia (estágio 40; veio onda ${g.ondaNumero}, nível ${nucleoI(g).nivel})`)
    }
    assert(JSON.stringify(evoluirInimigo(novo, 1, 40).obras) === JSON.stringify(evoluirInimigo(novo, 1, 80).obras.filter((o) => o.id < 1e9)), 'M2.j: (medido) a base já satura no estágio 40: o 80 não traz uma peça a mais')
  }

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

  // ── Graus ENEM 5..7 (base 2), PARTIDA.vidaCap = 999_999 e altar sem placas físicas ──
  {
    for (const g of [5, 6, 7] as const) {
      const esperadoBonus = 2 ** (g + 1) // 64, 128, 256
      assert(GRAU_PARTIDA[g].bonus === esperadoBonus, `Grau ${g}: esperava bonus ${esperadoBonus}, veio ${GRAU_PARTIDA[g].bonus}`)
      const pago = aplicarConta(createPartida(), g)
      assert(pago.heroi.army === 10 + esperadoBonus, `Grau ${g}: aplicarConta deve somar +${esperadoBonus}`)
      assert(pago.credito === 4 + GRAU_PARTIDA[g].credito, `Grau ${g}: aplicarConta deve pagar ${GRAU_PARTIDA[g].credito} licenças`)
    }

    assert(PARTIDA.vidaCap === 999_999, `PARTIDA.vidaCap esperado 999_999, veio ${PARTIDA.vidaCap}`)
    const quaseTeto = { ...createPartida(), heroi: { ...createPartida().heroi, army: 999_990 } }
    const noTetoConta = aplicarConta(quaseTeto, 5)
    assert(noTetoConta.heroi.army === PARTIDA.vidaCap, `vidaCap não limitou aplicarConta: ${noTetoConta.heroi.army}`)
    assert(noTetoConta.altar === null || noTetoConta.altar.ganhoVida === 9, 'ganhoVida real deve ser 9 ao encostar no teto 999_999')

    const altarEnem = abrirAltar(createPartida(), 5, 0, false)
    assert(altarEnem.altar?.placasAtivas === false, 'questão ENEM de 5 opções deve abrir altar com placasAtivas = false')
    const pisouEmTodas = [
      { x: altarEnem.altar!.cx, z: altarEnem.altar!.cz + PARTIDA.altarPasso },
      { x: altarEnem.altar!.cx + PARTIDA.altarPasso, z: altarEnem.altar!.cz },
      { x: altarEnem.altar!.cx, z: altarEnem.altar!.cz - PARTIDA.altarPasso },
      { x: altarEnem.altar!.cx - PARTIDA.altarPasso, z: altarEnem.altar!.cz },
    ].reduce((st, pos) => stepPartida({ ...st, heroi: { ...st.heroi, x: pos.x, z: pos.z } }, INPUT_PARADO, 0.05), altarEnem)
    assert(
      pisouEmTodas.altar?.resolvido === false && pisouEmTodas.altar?.erros === 0,
      'altar com placasAtivas=false nunca resolve nem registra erro pelas 4 placas 3D',
    )
  }
}
