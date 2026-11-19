import { PARTIDA } from './partidaPolicies'
import { atirar, createPartida, criarTropa, editarBlocoMundo, fundar, INPUT_PARADO, ordenar, ordenarHeroi } from './partidaSim'
import {
  atualizarAlerta,
  colocarHeroi,
  criarAtlas,
  definirPoliticaMinimapas,
  escreverCena,
  escreverFicha,
  estadoCena,
  estadoCorpo,
  fichaEm,
  LADO_MAPA,
  MEIO_MAPA,
  olharMapa,
  abrirMapa,
  stepAtlas,
  transferir,
  vizinhosPorVisao,
  voltarAoCorpo,
} from './atlas'

function assert(condition: boolean, name: string): asserts condition {
  if (!condition) throw new Error(name)
}

export function run(): void {
  assert(LADO_MAPA === 112 && MEIO_MAPA === 56, 'lado 112 e meio 56')
  assert(transferir(55.9, -55.9, 0, 0).i === 0 && transferir(55.9, -55.9, 0, 0).j === 0, 'o meio do quadrado fica em 0,0')
  assert(transferir(56, 0, 0, 0).i === 1, 'x = 56 já é o vizinho')

  const leste = transferir(56.1, 0, 0, 0)
  assert(leste.i === 1 && leste.j === 0 && Math.abs(leste.x - (56.1 - 112)) < 1e-9, 'leste corrige o x')

  const canto = transferir(56.2, -56.4, 0, 0)
  assert(canto.i === 1 && canto.j === -1, 'os dois eixos no mesmo retorno')
  assert(Math.abs(canto.x - (56.2 - 112)) < 1e-9 && Math.abs(canto.z - (-56.4 + 112)) < 1e-9, 'os dois eixos corrigidos')

  const origem = criarAtlas()
  const exercito = origem.fichas[0].state.heroi.army
  const yaw = origem.fichas[0].state.heroi.yaw
  const foi = colocarHeroi(origem, 56.1, 0)
  const corpo = fichaEm(foi, foi.heroiI, foi.heroiJ)
  assert(foi.heroiI === 1 && corpo !== undefined && corpo.state.heroi.army === exercito && corpo.state.heroi.yaw === yaw, 'vida acompanha')

  const perto = colocarHeroi(criarAtlas(), 38, 0)
  assert(fichaEm(perto, 1, 0) !== undefined, 'em x = 38 o vizinho existe')
  const longe = colocarHeroi(criarAtlas(), 37, 0)
  assert(fichaEm(longe, 1, 0) === undefined, 'em x = 37 o vizinho não nasce')
  assert(vizinhosPorVisao(40, 0, 0, 0).some((item) => item.i === 1 && item.j === 0), 'visão lista o leste')

  const casa = fundar({ ...createPartida(), semCorpo: true }, 'nucleo', 0, 10)
  let guardado = escreverFicha(criarAtlas(), 1, 0, casa, 'lento')
  guardado = olharMapa(guardado, 1, 0)
  const reaberto = fichaEm(guardado, 1, 0)
  assert(
    reaberto !== undefined && reaberto.state.obras.some((obra) => obra.lado === 'nosso' && obra.tipo === 'nucleo' && obra.x === 0 && obra.z === 10 && obra.hp === casa.obras.find((item) => item.lado === 'nosso' && item.tipo === 'nucleo')?.hp),
    'resumo reabre o núcleo',
  )

  let cantoCheio = colocarHeroi(criarAtlas(), 40, 40)
  const vazio = { ...createPartida(), semCorpo: true, obras: [], unidades: [] }
  const esquecido = escreverFicha(cantoCheio, 2, 0, vazio, 'cheio')
  assert(fichaEm(esquecido, 2, 0) === undefined, 'mato sem gente é esquecido')
  const cheiosAntes = cantoCheio.fichas.filter((ficha) => ficha.ritmo === 'cheio')
  assert(cheiosAntes.length <= PARTIDA.mapasResidentes && fichaEm(cantoCheio, 1, 0) !== undefined && fichaEm(cantoCheio, 0, 1) !== undefined, 'visão abre dois vizinhos')
  const quarto = fundar({ ...createPartida(), semCorpo: true }, 'nucleo', 5, 0)
  cantoCheio = escreverFicha(cantoCheio, 4, 4, quarto, 'cheio')
  const cheios = cantoCheio.fichas.filter((ficha) => ficha.ritmo === 'cheio')
  const quartoFicha = fichaEm(cantoCheio, 4, 4)
  assert(cheios.length <= 3 && quartoFicha !== undefined && quartoFicha.ritmo === 'lento', 'o mais longe desce a passo lento')

  assert(atualizarAlerta('nenhum', 10, 10, 10, 8) === 'verde', 'só ferir é verde')
  assert(atualizarAlerta('nenhum', 10, 10, 8, 8) === 'vermelho', 'perder vida é vermelho')
  assert(atualizarAlerta('vermelho', 10, 10, 10, 5) === 'vermelho', 'vermelho não volta a verde')

  const sitiado = fundar({ ...createPartida(), semCorpo: true }, 'nucleo', 5, 0)
  const golpe = {
    ...sitiado,
    unidades: [
      ...sitiado.unidades,
      {
        id: 400,
        lado: 'inimigo' as const,
        papel: 'sitiante' as const,
        x: 5,
        z: 0.4,
        hp: 14,
        postura: 'automatico' as const,
        ordem: null,
        cooldown: 0,
        segmentos: [] as number[],
        alerta: true,
      },
    ],
  }
  const lento = escreverFicha(criarAtlas(), 3, 0, golpe, 'lento')
  const depois = stepAtlas(lento, INPUT_PARADO, 1)
  const sitio = fichaEm(depois, 3, 0)
  const vidaBase = sitio?.state.obras.find((obra) => obra.lado !== 'inimigo' && obra.tipo === 'nucleo')?.hp ?? 99
  assert(sitio?.alerta === 'vermelho' && vidaBase < PARTIDA.nucleoHp, 'passo lento fica vermelho quando a base perde vida')

  const aliado = {
    id: 501,
    lado: 'aliado' as const,
    papel: 'tropa' as const,
    x: 0,
    z: 0,
    hp: 16,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: true,
  }
  const alvoVerde = {
    id: 502,
    lado: 'inimigo' as const,
    papel: 'horda' as const,
    x: 0,
    z: 1,
    hp: 4,
    postura: 'automatico' as const,
    ordem: null,
    cooldown: 0,
    segmentos: [] as number[],
    alerta: false,
  }
  const verdeEstado = { ...createPartida(), semCorpo: true, unidades: [aliado, alvoVerde], obras: [] }
  const verde = escreverFicha(criarAtlas(), 3, 1, verdeEstado, 'lento')
  const aposVerde = stepAtlas(verde, INPUT_PARADO, 1)
  const fichaVerde = fichaEm(aposVerde, 3, 1)
  const vidaAliado = fichaVerde?.state.unidades.find((unidade) => unidade.id === 501)?.hp ?? 0
  const vidaAlvo = fichaVerde?.state.unidades.find((unidade) => unidade.id === 502)?.hp ?? 99
  assert(fichaVerde?.alerta === 'verde' && vidaAliado === 16 && vidaAlvo < 4, 'passo lento fica verde quando só o inimigo perde vida')

  const relogio = escreverFicha(criarAtlas(), 3, 2, { ...createPartida(), semCorpo: true }, 'lento')
  const sobra = stepAtlas(relogio, INPUT_PARADO, 1.4)
  assert(Math.abs((fichaEm(sobra, 3, 2)?.relogio ?? 9) - 0.4) < 0.05, 'o passo lento guarda o resto do segundo')

  const origemCasa = criarAtlas()
  const comNucleo = escreverCena(origemCasa, fundar(estadoCena(origemCasa), 'nucleo', 5, 0))
  const nossoNucleo = fichaEm(comNucleo, 0, 0)?.state.obras.find((obra) => obra.lado === 'nosso' && obra.tipo === 'nucleo')
  assert(nossoNucleo !== undefined, 'o arranjo fundou um núcleo nosso')
  const hpNucleo = nossoNucleo.hp
  const mudou = colocarHeroi(comNucleo, 56.1, 0)
  const ficou = fichaEm(mudou, 0, 0)
  const chegou = fichaEm(mudou, 1, 0)
  assert(
    hpNucleo === PARTIDA.nucleoHp &&
      ficou?.state.obras.find((obra) => obra.id === nossoNucleo.id)?.hp === hpNucleo &&
      ficou.state.obras.find((obra) => obra.id === nossoNucleo.id)?.x === 5 &&
      chegou?.state.heroi.army === 10 &&
      chegou?.state.heroi.yaw === 0 &&
      chegou !== undefined &&
      Math.abs(chegou.state.heroi.x - (56.1 - LADO_MAPA)) < 1e-9,
    'o núcleo fica e o corpo leva exército, yaw e x local',
  )

  const olhou = olharMapa(escreverFicha(criarAtlas(), 1, 0, { ...createPartida(), semCorpo: true }, 'cheio'), 1, 0)
  assert(olhou.cenaI === 1 && olhou.heroiI === 0 && olhou.heroiJ === 0, 'abrir outro mapa não move o corpo')
  const quadradoNovo = abrirMapa(criarAtlas(), 2, -1)
  assert(
    quadradoNovo.cenaI === 2 &&
      quadradoNovo.cenaJ === -1 &&
      quadradoNovo.heroiI === 0 &&
      fichaEm(quadradoNovo, 2, -1)?.state.semCorpo === true,
    'o minimapa carrega um quadrado que ainda não existia',
  )
  const voltou = voltarAoCorpo(olhou)
  assert(voltou.cenaI === 0 && voltou.heroiI === 0, 'voltar desenha o mapa do corpo')
  assert(estadoCena(voltou).heroi.x === fichaEm(voltou, 0, 0)?.state.heroi.x, 'a cena lê a ficha do corpo')

  const escrito = escreverCena(origem, origem.fichas[0].state)
  assert(escrito.heroiI === 0 && escrito.cenaI === 0, 'escrever a cena não troca o índice')

  const baseReal = fundar({ ...createPartida(), unidades: [] }, 'nucleo', 5, 0)
  const nucleoReal = baseReal.obras.find((obra) => obra.lado === 'nosso' && obra.tipo === 'nucleo')!
  const inimigaReal = baseReal.obras.find((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo')!
  let passeio = colocarHeroi(escreverCena(criarAtlas(), baseReal), 56.1, 0)
  let nasceuNaBase = false
  let marchou = false
  for (let segundo = 0; segundo < 80; segundo++) {
    passeio = stepAtlas(passeio, INPUT_PARADO, 1)
    const origemReal = fichaEm(passeio, 0, 0)!
    const sitiante = origemReal.state.unidades.find((unidade) => unidade.papel === 'sitiante')
    if (sitiante && origemReal.state.ondaNumero === 1) {
      const distancia = Math.hypot(sitiante.x - inimigaReal.x, sitiante.z - inimigaReal.z)
      if (distancia < 5) nasceuNaBase = true
      if (nasceuNaBase && distancia > 8) marchou = true
    }
  }
  const caiuLonge = fichaEm(passeio, 0, 0)!
  assert(nasceuNaBase && marchou, 'a leva nasce na base real e marcha antes de atacar')
  assert(caiuLonge.state.obras.find((obra) => obra.id === nucleoReal.id)?.hp === 0 && caiuLonge.alerta === 'vermelho', 'a leva real destrói a base remota e avisa')
  assert(!caiuLonge.state.derrota && !estadoCorpo(passeio).derrota, 'a ruína sem corpo não derrota o jogador no vizinho')
  passeio = colocarHeroi(passeio, LADO_MAPA * 2, 0)
  passeio = escreverFicha(passeio, 3, 1, { ...createPartida(), semCorpo: true }, 'cheio')
  assert(fichaEm(passeio, 0, 0)?.ritmo === 'lento' && fichaEm(passeio, 0, 0)?.alerta === 'vermelho', 'ruína nossa persiste sob pressão dos residentes')

  const baseComTropa = criarTropa(baseReal, nucleoReal.id)
  const tropaRemota = baseComTropa.unidades.find((unidade) => unidade.lado === 'aliado')!
  let comando = colocarHeroi(escreverCena(criarAtlas(), baseComTropa), 56.1, 0)
  comando = escreverCena(comando, ordenarHeroi({ ...estadoCena(comando), olhar: 'imperio' }, { tipo: 'mover', x: -40, z: 0 }))
  const corpoAntes = estadoCorpo(comando).heroi
  comando = abrirMapa(comando, 0, 0)
  assert(estadoCorpo(comando).heroiOrdem === null && fichaEm(comando, 0, 0)?.alerta === 'nenhum', 'observar cancela ordem do corpo e reconhece o alerta')
  comando = escreverCena(comando, ordenar(estadoCena(comando), [tropaRemota.id], { tipo: 'mover', x: 12, z: -5 }))
  comando = stepAtlas(comando, { forward: true, back: false, strafe: 1 }, 1)
  const corpoDepois = estadoCorpo(comando).heroi
  const tropaDepois = estadoCena(comando).unidades.find((unidade) => unidade.id === tropaRemota.id)!
  assert(corpoDepois.x === corpoAntes.x && corpoDepois.z === corpoAntes.z && corpoDepois.yaw === corpoAntes.yaw && corpoDepois.army === corpoAntes.army, 'WASD remoto não move nem altera o corpo')
  assert(Math.hypot(tropaDepois.x - tropaRemota.x, tropaDepois.z - tropaRemota.z) > 1, 'a ordem remota move a tropa local')
  const regressou = voltarAoCorpo(comando)
  assert(regressou.cenaI === regressou.heroiI && estadoCena(regressou).olhar === 'imperio', 'voltar preserva o olhar anterior do corpo')

  const comDuasPerdas = fundar({ ...golpe, unidades: golpe.unidades.filter((unidade) => unidade.id === 400).map((unidade) => ({ ...unidade, hp: 100 })) }, 'torre', 1, -2)
  let duasPerdas = escreverFicha(criarAtlas(), 3, 0, comDuasPerdas, 'lento')
  duasPerdas = stepAtlas(duasPerdas, INPUT_PARADO, 1)
  const perdas = fichaEm(duasPerdas, 3, 0)!
  assert(perdas.state.obras.find((obra) => obra.lado === 'nosso' && obra.tipo === 'nucleo')!.hp < 100 && perdas.state.unidades[0].hp < 100 && perdas.alerta === 'vermelho', 'dano nos dois lados mantém prioridade vermelha no passo integrado')
  const semNovoDano = { ...perdas.state, unidades: perdas.state.unidades.map((unidade) => ({ ...unidade, cooldown: 100 })), obras: perdas.state.obras.map((obra) => ({ ...obra, cooldown: 100 })) }
  duasPerdas = stepAtlas(escreverFicha(duasPerdas, 3, 0, semNovoDano, 'lento'), INPUT_PARADO, 1)
  assert(fichaEm(duasPerdas, 3, 0)?.alerta === 'vermelho', 'sem dano novo o vermelho persiste')

  const corpoSitiado = { ...golpe, semCorpo: false, obras: golpe.obras.map((obra) => obra.lado === 'nosso' ? { ...obra, hp: 1 } : obra) }
  const morteRemota = stepAtlas(abrirMapa(escreverCena(criarAtlas(), corpoSitiado), 1, 0), INPUT_PARADO, 1)
  assert(estadoCorpo(morteRemota).derrota && !estadoCena(morteRemota).derrota, 'derrota pertence ao corpo mesmo com outra ficha aberta')

  const inicioCerco = createPartida()
  const nucleoCerco = inicioCerco.obras.find((obra) => obra.lado === 'inimigo' && obra.tipo === 'nucleo')!
  const campoCerco = { ...inicioCerco, unidades: [], obras: [{ ...nucleoCerco, x: 0, z: 8 }] }
  let conquista = escreverCena(criarAtlas(), campoCerco)
  conquista = escreverCena(conquista, atirar(estadoCena(conquista)))
  assert(estadoCena(conquista).obras[0].hp === 88 && fichaEm(conquista, 0, 0)?.alerta === 'nenhum', 'tiro publicado na cena atual atualiza HP sem aviso remoto')
  const observandoOutro = abrirMapa(escreverCena(criarAtlas(), campoCerco), 1, 0)
  const danoPublicado = escreverFicha(observandoOutro, 0, 0, atirar(estadoCorpo(observandoOutro)), 'cheio')
  assert(fichaEm(danoPublicado, 0, 0)?.alerta === 'verde' && fichaEm(danoPublicado, 0, 0)?.hpInimigo === 88, 'publicação fora da cena compara HP antes de atualizar referência e gera verde')
  const campoComBase = fundar(campoCerco, 'nucleo', 5, 0)
  const alertaDuploAntes = abrirMapa(escreverCena(criarAtlas(), campoComBase), 1, 0)
  const danoDuplo = atirar(estadoCorpo(alertaDuploAntes))
  const alertaDuplo = escreverFicha(alertaDuploAntes, 0, 0, { ...danoDuplo, obras: danoDuplo.obras.map((obra) => obra.lado === 'nosso' ? { ...obra, hp: obra.hp - 3 } : obra) }, 'cheio')
  assert(fichaEm(alertaDuplo, 0, 0)?.alerta === 'vermelho', 'publicação simultânea de danos mantém prioridade vermelha')
  const maisDanoInimigo = atirar({ ...estadoCorpo(alertaDuplo), heroi: { ...estadoCorpo(alertaDuplo).heroi, shootCooldown: 0 } })
  assert(fichaEm(escreverFicha(alertaDuplo, 0, 0, maisDanoInimigo, 'cheio'), 0, 0)?.alerta === 'vermelho', 'nova publicação verde não rebaixa vermelho')

  for (let tiro = 1; tiro < 9; tiro++) {
    conquista = stepAtlas(conquista, INPUT_PARADO, 0.5)
    conquista = escreverCena(conquista, atirar(estadoCena(conquista)))
  }
  assert(estadoCena(conquista).obras[0].hp === 0 && !estadoCorpo(conquista).derrota, 'nove tiros reais destroem núcleo sem vitória artificial')
  const versaoConquista = estadoCena(conquista).versaoSolidos
  conquista = colocarHeroi(conquista, 56.1, 0)
  conquista = colocarHeroi(conquista, LADO_MAPA * 2, 0)
  conquista = abrirMapa(conquista, 4, 1)
  assert(fichaEm(conquista, 0, 0)?.ritmo === 'lento', 'conquista sem presença nossa sai do ritmo cheio e continua retida')
  for (let segundo = 0; segundo < 45; segundo++) conquista = stepAtlas(conquista, INPUT_PARADO, 1)
  conquista = abrirMapa(conquista, 0, 0)
  const ruinaReaberta = estadoCena(conquista).obras.find((obra) => obra.id === nucleoCerco.id)
  assert(ruinaReaberta?.hp === 0 && ruinaReaberta.x === 0 && ruinaReaberta.z === 8 && estadoCena(conquista).versaoSolidos === versaoConquista, 'reabrir conserva identidade, posição, HP e versão da ruína inimiga')
  assert(estadoCena(conquista).obras.every((obra) => obra.lado === 'inimigo') && estadoCena(conquista).ondaNumero === 0, 'ruína preservada sem obra ou tropa nossa e sem nova base inimiga')
  conquista = voltarAoCorpo(conquista)
  conquista = colocarHeroi(conquista, -LADO_MAPA * 3, 0)
  assert(conquista.heroiI === 0 && estadoCorpo(conquista).obras.find((obra) => obra.id === nucleoCerco.id)?.hp === 0, 'retorno físico não restaura o núcleo conquistado')

  const fantasma = fichaEm(abrirMapa(criarAtlas(), 2, 2), 2, 2)
  if (!fantasma) throw new Error('quadrado novo nasce sem chão revelado')
  const somaChao = fantasma.state.chaoVisto.reduce((total, valor) => total + valor, 0)
  assert(fantasma.state.semCorpo === true && somaChao === 0, 'quadrado novo nasce sem chão revelado')
  const remoto = fundar(fantasma.state, 'nucleo', 0, 10)
  assert(remoto.obras.every((obra) => obra.lado === 'inimigo'), 'não funda núcleo num quadrado nunca iluminado')

  // Governança de minimapas: 'atual' (1 cheio), 'alguns' (3 cheios), 'todos' (todos ativos até o freio anti-travamento)
  let governado = definirPoliticaMinimapas(criarAtlas(), 'todos')
  for (let m = 1; m <= 6; m++) {
    governado = abrirMapa(governado, m, 0)
  }
  const cheiosEmTodos = governado.fichas.filter((f) => f.ritmo === 'cheio').length
  assert(cheiosEmTodos === 7, 'modo todos mantém todos os 7 minimapas descobertos em passo cheio enquanto o PC aguenta')

  // Simula sobrecarga de quadro (frameMs = 65ms repetido) para acionar o freio dinâmico anti-travamento
  let sobrecarregado = governado
  for (let passo = 0; passo < 10; passo++) {
    sobrecarregado = stepAtlas(sobrecarregado, INPUT_PARADO, 0.05, 1, 65)
  }
  const cheiosAposFreio = sobrecarregado.fichas.filter((f) => f.ritmo === 'cheio').length
  assert(
    cheiosAposFreio < cheiosEmTodos && cheiosAposFreio >= 2 && sobrecarregado.fichas.length === 7,
    'freio automático reduz mapas em passo cheio sob quadro pesado sem apagar nenhum minimapa',
  )

  const somenteAtual = definirPoliticaMinimapas(governado, 'atual')
  const cheiosEmAtual = somenteAtual.fichas.filter((f) => f.ritmo === 'cheio')
  assert(
    cheiosEmAtual.length === 1 &&
      cheiosEmAtual[0].i === somenteAtual.cenaI &&
      cheiosEmAtual[0].j === somenteAtual.cenaJ &&
      fichaEm(somenteAtual, 0, 0)?.ritmo === 'lento',
    'modo somente atual deixa apenas o quadrado visível em passo cheio e preserva o corpo em pulso lento',
  )

  const algunsMapas = definirPoliticaMinimapas(governado, 'alguns')
  assert(
    algunsMapas.fichas.filter((f) => f.ritmo === 'cheio').length <= PARTIDA.mapasResidentes,
    'modo alguns limita aos residentes configurados',
  )

  // Persistência de mapa com blocos manuais (blocosMapa) sob pressão de residentes
  const comBlocoLivre = editarBlocoMundo(
    { ...createPartida(), semCorpo: true, madeira: 5, obras: [], unidades: [] },
    6,
    0,
    6,
    'adicionar',
    'madeira',
  )
  let persistBlocos = escreverFicha(criarAtlas(), 4, 4, comBlocoLivre, 'cheio')
  persistBlocos = escreverFicha(persistBlocos, 3, 3, { ...createPartida(), semCorpo: true, obras: [], unidades: [] }, 'cheio')
  persistBlocos = escreverFicha(persistBlocos, 1, 0, { ...createPartida(), semCorpo: true, obras: [], unidades: [] }, 'cheio')
  persistBlocos = escreverFicha(persistBlocos, 0, 1, { ...createPartida(), semCorpo: true, obras: [], unidades: [] }, 'cheio')
  persistBlocos = escreverFicha(persistBlocos, -1, 0, { ...createPartida(), semCorpo: true, obras: [], unidades: [] }, 'cheio')
  persistBlocos = escreverFicha(persistBlocos, 0, -1, { ...createPartida(), semCorpo: true, obras: [], unidades: [] }, 'cheio')
  const fichaComBloco = fichaEm(persistBlocos, 4, 4)
  assert(
    fichaComBloco !== undefined &&
      fichaComBloco.ritmo === 'lento' &&
      Object.keys(fichaComBloco.state.blocosMapa).length === 1 &&
      fichaEm(persistBlocos, 3, 3) === undefined,
    'atlas preserva mapa com blocosMapa sob pressão de residentes',
  )
}
