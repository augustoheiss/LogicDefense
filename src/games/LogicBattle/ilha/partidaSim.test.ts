import { contagemBuscas, zerarBuscas } from './caminho'
import { GRAU_PARTIDA, PARTIDA } from './partidaPolicies'
import {
  aplicarConta,
  abrirAltar,
  atirar,
  cenarioConduta,
  cenarioEspetaculo,
  continuarNaRua,
  createPartida,
  criarTropa,
  definirOlhar,
  evoluir,
  fundar,
  idsNoRetangulo,
  INPUT_PARADO,
  invocarDragao,
  mira,
  ordenar,
  ordenarHeroi,
  PartidaInput,
  PartidaState,
  postura,
  stepPartida,
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
  assert(!inicio.derrota && inicio.obras.length === 0, 'sem base no começo')

  const olhou = definirOlhar(definirOlhar(definirOlhar(inicio, 'imperio'), 'primeira'), 'terceira')
  assert(olhou.heroi.x === inicio.heroi.x && olhou.heroi.z === inicio.heroi.z && olhou.obras.length === 0, 'três olhares, um mundo')

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

  const borda = anda(inicio, 3, { forward: false, back: false, strafe: -1 })
  const mais = anda(borda, 20, { forward: false, back: false, strafe: -1 })
  assert(Math.hypot(mais.heroi.x, mais.heroi.z) <= PARTIDA.radius - PARTIDA.body + 0.02, 'borda do disco')

  const longeDoHeroi = fundar(definirOlhar(inicio, 'imperio'), 'nucleo', 0, 30)
  const casa = longeDoHeroi.obras[0]
  assert(
    casa.tipo === 'nucleo' && casa.x === 0 && casa.z === 30 && casa.nivel === 1,
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
  const nucleoId = paga.obras[0].id
  const evoluida = evoluir(paga, nucleoId)
  assert(
    evoluida.obras[0].nivel === 2 &&
      evoluida.obras[0].x === paga.obras[0].x &&
      evoluida.obras[0].z === paga.obras[0].z,
    'evoluir fica no lugar',
  )
  const nascida = criarTropa({ ...paga, credito: 1 }, nucleoId).unidades.find(
    (unidade) => unidade.lado === 'aliado',
  )
  assert(nascida !== undefined && nascida.postura === 'ordens' && nascida.ordem === null, 'tropa nasce sem ordem')
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
  const autoPasso = stepPartida(auto, INPUT_PARADO, 1)
  const autoMexeu = autoPasso.unidades.find((unidade) => unidade.id === ids[0])
  assert(
    autoMexeu !== undefined &&
      Math.hypot(autoMexeu.x - inimigo.x, autoMexeu.z - inimigo.z) <
        Math.hypot(origemOrdem.x - inimigo.x, origemOrdem.z - inimigo.z) - 1,
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
  assert(errou.heroi.shootCooldown > 0 && errou.obras.length === 0, 'erro de tiro gasta recarga e não funda')
  assert(
    errou.unidades.every((unidade, index) => unidade.hp === inicio.unidades[index].hp),
    'erro de tiro não fere',
  )

  const comMuro = fundar(definirOlhar(createPartida(), 'imperio'), 'nucleo', 0, -8)
  const torreMuro = fundar(comMuro, 'torre', 4, 0)
  const pelotao = criarTropa({ ...torreMuro, credito: 1 }, torreMuro.obras[0].id)
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
  assert(leva.length === 4, 'primeira leva são 4')
  const zNasceu = Math.min(...leva.map((unidade) => unidade.z))
  assert(leva.every((unidade) => Math.abs(unidade.z - 16) <= 1), 'nascem a 16 m ao norte')
  const livre = stepPartida(disparo, INPUT_PARADO, 3)
  const andouLivre = livre.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  assert(
    andouLivre.length === 4 && andouLivre.every((unidade) => unidade.z < zNasceu - 2),
    'sem torre desce a partir do nascimento',
  )
  assert(andouLivre.every((unidade) => Math.abs(unidade.x - 20) < 3), 'sem torre fica no corredor')

  const levaTorre = fundar(campo, 'torre', 20, 8)
  let torrePasso = stepPartida({ ...levaTorre, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }, INPUT_PARADO, 0.1)
  let saiu = false
  let dentro = false
  for (let i = 0; i < 6; i++) {
    torrePasso = stepPartida(torrePasso, INPUT_PARADO, 0.5)
    const vivos = torrePasso.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
    if (vivos.some((unidade) => Math.abs(unidade.x - 20) > 1.6)) saiu = true
    if (vivos.some((unidade) => Math.abs(unidade.x - 20) <= 1.15 && Math.abs(unidade.z - 8) <= 1.15)) dentro = true
  }
  const fimTorre = torrePasso.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  assert(saiu && !dentro && fimTorre.some((unidade) => unidade.z < zNasceu - 2), 'torre desvia e aproxima do núcleo')

  const levaPortao = fundar(campo, 'portao', 20, 8)
  const disparoPortao = stepPartida({ ...levaPortao, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }, INPUT_PARADO, 0.1)
  const peloPortao = stepPartida(disparoPortao, INPUT_PARADO, 3)
  const noPortao = peloPortao.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  assert(
    noPortao.some((unidade) => unidade.z < 8) && noPortao.every((unidade) => Math.abs(unidade.x - 20) < 3),
    'portão é atravessado no corredor',
  )
  assert(peloPortao.heroi.army === campo.heroi.army, 'leva no portão não soma exército')

  let muro = campo
  for (let x = -54; x <= 54; x += 3) muro = fundar(muro, 'torre', x, 8)
  const disparoMuro = stepPartida({ ...muro, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }, INPUT_PARADO, 0.1)
  const nasceram = disparoMuro.unidades.filter((unidade) => unidade.papel === 'sitiante')
  assert(nasceram.length === 4 && nasceram.every((unidade) => unidade.hp > 0 && unidade.rota?.semCaminho === true), 'muro fecha e a leva vive')
  const bateu = stepPartida(disparoMuro, INPUT_PARADO, 0.6)
  const depoisLeva = bateu.unidades.filter((unidade) => unidade.papel === 'sitiante' && unidade.hp > 0)
  const torres = bateu.obras.filter((obra) => obra.tipo === 'torre')
  assert(
    depoisLeva.some((unidade) => {
      const antes = nasceram.find((item) => item.id === unidade.id)
      if (!antes) return false
      const dist = (px: number, pz: number) => Math.min(...torres.map((obra) => Math.hypot(px - obra.x, pz - obra.z)))
      const fora = torres.every((obra) => Math.abs(unidade.x - obra.x) > 1.15 || Math.abs(unidade.z - obra.z) > 1.15)
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
}
