import { PARTIDA } from './partidaPolicies'
import { atirar, createPartida, criarTropa, editarBlocoMundo, evoluirInimigo, fundar, INPUT_PARADO, Obra, obraEmConstrucao, ordenar, ordenarHeroi, PartidaState, Unidade } from './partidaSim'
import {
  Atlas,
  atualizarAlerta,
  colocarHeroi,
  converterUnidadeDeMapa,
  criarAtlas,
  ladoDaTravessia,
  definirPoliticaMinimapas,
  donoDoMapa,
  escreverCena,
  escreverFicha,
  estadoCena,
  estadoCorpo,
  fichaEm,
  LADO_MAPA,
  MEIO_MAPA,
  olharMapa,
  abrirMapa,
  resumoAtlas,
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
  // REGRA MUDOU (23/11, pedido do usuário + a decisão dele de 20/11: «derrota = nenhum núcleo nosso em NENHUM quadrado»). Antes (22/11) este caso afirmava que a ruína da única base, longe do herói, NÃO derrotava («a ruína sem
  // corpo não derrota o jogador no vizinho»): a ficha remota não tinha o corpo e a partida só olhava o próprio mapa. Agora o atlas enxerga TODOS os mapas: o herói está vivo no vizinho, mas a ÚNICA base que o jogador
  // tinha caiu e não resta núcleo nosso em nenhum quadrado: o jogo acaba (a base é o coração: sem ela não há onde ressuscitar). O que continua valendo é que a ficha remota NÃO decreta a derrota sozinha: quem decreta é o atlas.
  assert(!caiuLonge.state.derrota, 'a ruína da ficha remota não carrega a derrota dentro de si (quem decreta é o atlas, que enxerga todos os mapas)')
  assert(estadoCorpo(passeio).derrota === true, 'caiu a ÚLTIMA base (nenhum núcleo nosso em nenhum quadrado): o jogo acaba, mesmo com o herói vivo longe')
  // O resto deste caso (a ficha da ruína persiste sob a pressão dos residentes) NÃO é sobre a derrota: refaz o passeio com uma SEGUNDA base nossa longe, em (3, 1), que a leva não alcança, para o jogo seguir vivo.
  // A base longe é fundada com o herói PRESENTE (`semCorpo: false`): sem corpo o jogo recusa fundar em chão não revelado («Explore a neblina antes de construir aqui»). Só depois a ficha vira `semCorpo`, como as de fora do corpo.
  // Cada mapa tem a SUA base inimiga e a sua leva (a `createPartida` planta uma em todo mapa): medido por `diag-ficha-longe.mjs`, a leva de (3,1) destruiu a base de lá em 30 s, ANTES da de (0,0). A base longe fica forte (5.000) e a
  // base inimiga de lá é silenciada: o caso é «uma segunda base viva» e não a defesa dela.
  const baseLongeBruta = fundar({ ...createPartida(), unidades: [] }, 'nucleo', -30, -30)
  const baseLonge = { ...baseLongeBruta, semCorpo: true, obras: baseLongeBruta.obras.map((obra) => (obra.lado === 'nosso' ? { ...obra, hp: 5000, maxHp: 5000 } : { ...obra, cooldown: 1e9 })) }
  assert(baseLonge.obras.some((obra) => obra.lado === 'nosso' && obra.tipo === 'nucleo' && obra.hp > 0), '(arranjo) a segunda base nossa EXISTE na ficha longe')
  let passeioVivo = colocarHeroi(escreverCena(criarAtlas(), baseReal), 56.1, 0)
  passeioVivo = escreverFicha(passeioVivo, 3, 1, baseLonge, 'cheio')
  for (let segundo = 0; segundo < 80; segundo++) passeioVivo = stepAtlas(passeioVivo, INPUT_PARADO, 1)
  assert(fichaEm(passeioVivo, 0, 0)!.state.obras.find((obra) => obra.id === nucleoReal.id)?.hp === 0 && estadoCorpo(passeioVivo).derrota === false, 'com uma segunda base viva em outro mapa, a mesma ruína NÃO acaba o jogo')
  passeio = passeioVivo
  passeio = colocarHeroi(passeio, LADO_MAPA * 2, 0)
  passeio = escreverFicha(passeio, 3, 1, baseLonge, 'cheio')
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
  // ── M2 no atlas: o vizinho que NASCE (por cruzamento ou por visão) já vem evoluído e mais forte quanto mais longe (pedido do usuário, 22/11) ──
  // Regra: `nascer(i, j, estagio)` = o mapa do lugar + `evoluirInimigo(…, fatorDaCamada(camadaDoMapa(i, j)), estagio)`. O ESTÁGIO é o `ondaNumero` do mapa onde o herói está. Só NASCE assim:
  // um mapa que já existe não é reescrito (nada roda oculto e nada é copiado por cima do que o jogador mudou). Decisões do usuário (22/11): clona SÓ a base e a horda INIMIGAS; a selva é a do lugar.
  {
    const inimigo = (f: { state: PartidaState } | PartidaState) => ('state' in f ? f.state : f).obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo')
    const hordaDe = (f: { state: PartidaState }) => f.state.unidades.filter((u) => u.lado === 'inimigo' && u.papel === 'horda')
    const pecasDe = (f: { state: PartidaState }) => f.state.obras.filter((o) => o.lado === 'inimigo' && o.tipo !== 'nucleo')
    // o mapa onde o herói está, já no estágio 4 (núcleo nível 4 + 2 peças), para os vizinhos herdarem
    const comEstagio = (estagio: number): Atlas => {
      const a = criarAtlas()
      const origemEvoluida = { ...evoluirInimigo(a.fichas[0].state, 1, estagio), heroi: { ...a.fichas[0].state.heroi } }
      return escreverCena(a, origemEvoluida)
    }
    const origem4 = comEstagio(4)
    assert(origem4.fichas[0].state.ondaNumero === 4 && inimigo(origem4.fichas[0])!.nivel === 4, 'M2.h: (arranjo) o mapa de origem está no estágio 4')

    // M2.h: o herói CRUZA a borda para um vizinho que não existia: ele nasce com a base e a horda inimigas no estágio da origem, e na camada 1 a vida é igual à da origem (1×)
    const cruzou = colocarHeroi(origem4, 56.1, 0)
    const leste = fichaEm(cruzou, 1, 0)!
    assert(cruzou.heroiI === 1 && leste !== undefined, 'M2.h: o herói chegou ao vizinho')
    assert(inimigo(leste)!.nivel === 4 && pecasDe(leste).length === 2 && leste.state.ondaNumero === 4, `M2.h: o vizinho nasce no estágio 4 da origem (núcleo nível ${inimigo(leste)?.nivel}, ${pecasDe(leste).length} peças)`)
    assert(pecasDe(leste).every((o) => !obraEmConstrucao(o) && o.hp === o.maxHp), 'M2.h: as peças do vizinho já vêm prontas e com vida cheia')
    assert(hordaDe(leste).length === 6 && hordaDe(leste).every((u) => u.hp === 12), 'M2.h: camada 1 = fator 1×: a horda segue com 6 e 12 de vida')
    assert(leste.state.fatorInimigo === undefined || leste.state.fatorInimigo === 1, 'M2.h: camada 1 não guarda fator maior que 1')

    // M2.i: a selva é a do LUGAR (decisão do usuário): bioma, árvores e minas do vizinho, não os da origem
    const lugarLeste = createPartida(1, 0, true)
    assert(lugarLeste.bioma !== origem4.fichas[0].state.bioma, 'M2.i: (arranjo) (1,0) tem um bioma diferente de (0,0), então o teste não é vazio')
    assert(leste.state.bioma === lugarLeste.bioma && JSON.stringify(leste.state.recursos) === JSON.stringify(lugarLeste.recursos), 'M2.i: o vizinho mantém o bioma, as árvores e as minas do seu lugar')
    assert(inimigo(leste)!.x === inimigo(lugarLeste)!.x && inimigo(leste)!.z === inimigo(lugarLeste)!.z, 'M2.i: a base inimiga do vizinho fica no lugar sorteado para ESTE mapa')

    // M2.j: nada NOSSO é copiado (decisão do usuário: «a SUA base não é copiada»)
    const casa = fundar({ ...estadoCena(origem4) }, 'nucleo', 5, 0)
    const comNossa = escreverCena(origem4, casa)
    assert(estadoCena(comNossa).obras.some((o) => o.lado === 'nosso'), 'M2.j: (arranjo) a origem TEM uma base nossa')
    const lesteComNossa = fichaEm(colocarHeroi(comNossa, 56.1, 0), 1, 0)!
    assert(lesteComNossa.state.obras.every((o) => o.lado === 'inimigo') && lesteComNossa.state.unidades.every((u) => u.lado === 'inimigo'), 'M2.j: a nossa base e as nossas tropas NÃO são copiadas para o vizinho')
    assert(JSON.stringify(lesteComNossa.state.blocosMapa) === '{}' && lesteComNossa.state.madeira === 0, 'M2.j: nem blocos nem recursos do jogador')

    // M2.k: a dificuldade cresce com a DISTÂNCIA ao (0,0) e dobra a vida, não a quantidade: camada 2 = 2×, camada 3 = 4×
    const nasce = (i: number, j: number) => fichaEm(abrirMapa(origem4, i, j), i, j)!
    const c2 = nasce(2, 0)
    assert(hordaDe(c2).length === 6 && hordaDe(c2).every((u) => u.hp === 24) && inimigo(c2)!.maxHp === 200, `M2.k: camada 2: a horda tem 24 de vida e o núcleo 200 (veio ${hordaDe(c2).map((u) => u.hp)}, ${inimigo(c2)?.maxHp})`)
    assert(pecasDe(c2).length === 2 && pecasDe(c2).every((o) => o.hp === o.maxHp && o.hp === (o.tipo === 'torre' ? 100 : 80)), 'M2.k: camada 2: as peças têm o dobro de vida (e a MESMA quantidade)')
    assert(c2.state.fatorInimigo === 2, 'M2.k: camada 2 guarda o fator 2')
    const c3 = nasce(3, -3)
    assert(hordaDe(c3).every((u) => u.hp === 48) && inimigo(c3)!.maxHp === 400 && c3.state.fatorInimigo === 4, 'M2.k: camada 3 (canto 3,-3): 4× (a camada é Chebyshev, não a soma)')
    const c9 = nasce(9, 0)
    assert(hordaDe(c9).every((u) => u.hp === 768) && c9.state.fatorInimigo === 64, 'M2.k: a camada 9 trava no teto de 64×')
    assert(JSON.stringify(nasce(0, 2).state.unidades.map((u) => u.hp)) === JSON.stringify(c2.state.unidades.map((u) => u.hp)), 'M2.k: (2,0) e (0,2) têm a MESMA dificuldade: nenhuma direção é mais difícil')

    // os 4 quadrantes: a camada usa o valor ABSOLUTO (um `max(i, j)` sem `abs` dava 1× em (−2,−1): vizinhos «para trás» ficariam fáceis)
    for (const [i, j, fator] of [[-2, -1, 2], [-3, 2, 4], [-2, -2, 2], [1, -2, 2], [-4, -4, 8], [0, -3, 4], [-3, 0, 4]] as const) {
      const f = nasce(i, j)
      assert(f.state.fatorInimigo === fator && hordaDe(f).every((u) => u.hp === 12 * fator), `M2.k: o mapa (${i},${j}) é camada ${Math.max(Math.abs(i), Math.abs(j))} = ${fator}× (veio ${f.state.fatorInimigo}×)`)
    }

    // M2.p: o estágio herdado é o do mapa ONDE O HERÓI ESTÁ, não o do (0,0): o herói em (1,0) no estágio 6 abre um mapa novo e ele vem no estágio 6, mesmo com o (0,0) no estágio 2
    {
      const base = criarAtlas()
      const zero = escreverFicha(base, 0, 0, evoluirInimigo(base.fichas[0].state, 1, 2), 'cheio')
      const noLeste = fichaEm(colocarHeroi(zero, 56.1, 0), 1, 0)!
      const heroiLeste = colocarHeroi(zero, 56.1, 0)
      const comLesteNo6 = escreverFicha(heroiLeste, 1, 0, { ...evoluirInimigo(noLeste.state, 1, 6), semCorpo: false }, 'cheio')
      assert(comLesteNo6.heroiI === 1 && fichaEm(comLesteNo6, 0, 0)!.state.ondaNumero === 2 && fichaEm(comLesteNo6, 1, 0)!.state.ondaNumero === 6, 'M2.p: (arranjo) o herói está em (1,0) no estágio 6 e o (0,0) está no 2')
      const aberto = fichaEm(abrirMapa(comLesteNo6, 5, 5), 5, 5)!
      assert(aberto.state.ondaNumero === 6 && inimigo(aberto)!.nivel === 6, `M2.p: o mapa novo herda o estágio do mapa do HERÓI (6), não o do (0,0) (2) (veio onda ${aberto.state.ondaNumero})`)
    }

    // M2.l: nascer por VISÃO (a 18 m da borda, sem cruzar) herda do mapa do herói do mesmo jeito
    const porVisao = colocarHeroi(origem4, 40, 0)
    const lesteVisto = fichaEm(porVisao, 1, 0)!
    assert(porVisao.heroiI === 0 && lesteVisto !== undefined, 'M2.l: o vizinho nasceu por visão, sem o herói cruzar')
    assert(inimigo(lesteVisto)!.nivel === 4 && pecasDe(lesteVisto).length === 2 && lesteVisto.state.ondaNumero === 4, 'M2.l: o vizinho nascido por visão também vem no estágio da origem')
    assert(JSON.stringify(inimigo(lesteVisto)) === JSON.stringify(inimigo(leste)) && JSON.stringify(hordaDe(lesteVisto)) === JSON.stringify(hordaDe(leste)), 'M2.l: por visão ou por cruzamento o vizinho nasce IGUAL')

    // M2.m: o mapa de origem NÃO muda (o clone é do vizinho; nada é tirado da origem)
    assert(inimigo(cruzou.fichas.find((f) => f.i === 0 && f.j === 0)!)!.nivel === 4, 'M2.m: a origem segue no estágio 4')

    // M2.n: um mapa que JÁ existe não é reescrito pelo clone (nada copiado por cima do que o jogador mudou)
    const jaExistia = escreverFicha(origem4, 1, 0, createPartida(1, 0, true), 'cheio')
    const velho = fichaEm(jaExistia, 1, 0)!
    const atravessou = fichaEm(colocarHeroi(jaExistia, 56.1, 0), 1, 0)!
    assert(inimigo(velho)!.nivel === 1 && inimigo(atravessou)!.nivel === 1 && pecasDe(atravessou).length === 0, 'M2.n: um vizinho que já existia segue como estava (o clone só vale no NASCIMENTO)')
    assert(atravessou.state.ondaNumero === 0 && atravessou.state.fatorInimigo === undefined && JSON.stringify(atravessou.state.obras) === JSON.stringify(velho.state.obras), 'M2.n: o vizinho que já existia mantém onda, fator e obras IDÊNTICOS depois de o herói cruzar para ele')

    // M2.q: a linha de base de vida da ficha (`hpInimigo`, que o alerta verde/vermelho do minimapa compara) nasce do estado JÁ evoluído: medida antes de evoluir, o 1º passo «ganharia» vida e o
    // minimapa avisaria de um combate que ninguém travou. Oráculo MEDIDO: 172 (estágio 0), 262 (estágio 4), 524 (estágio 4 em camada 2), 1368 (estágio 8 em camada 3).
    const somaInimiga = (s: PartidaState) => s.obras.filter((o) => o.lado === 'inimigo').reduce((t, o) => t + Math.max(0, o.hp), 0) + s.unidades.filter((u) => u.lado === 'inimigo').reduce((t, u) => t + Math.max(0, u.hp), 0)
    for (const [estagio, i, j, esperado] of [[0, 1, 0, 172], [4, 1, 0, 262], [4, 2, 0, 524], [8, 3, 3, 1368]] as const) {
      const base = criarAtlas()
      const origem = estagio > 0 ? escreverCena(base, evoluirInimigo(base.fichas[0].state, 1, estagio)) : base
      const aberto = abrirMapa(origem, i, j)
      const fq = fichaEm(aberto, i, j)!
      assert(fq.hpInimigo === somaInimiga(fq.state) && fq.hpInimigo === esperado, `M2.q: o mapa (${i},${j}) nasce com hpInimigo = ${esperado} = a soma real (veio ${fq.hpInimigo})`)
      let passado = aberto
      for (let k = 0; k < 3; k++) passado = stepAtlas(passado, INPUT_PARADO, 0.25)
      assert(fichaEm(passado, i, j)!.alerta === 'nenhum', `M2.q: o mapa clonado (${i},${j}) não dispara alerta sem combate`)
    }

    // M2.o: sem estágio na origem (partida nova), o vizinho nasce como sempre nasceu
    const nova = colocarHeroi(criarAtlas(), 56.1, 0)
    const lesteNovo = fichaEm(nova, 1, 0)!
    assert(inimigo(lesteNovo)!.nivel === 1 && pecasDe(lesteNovo).length === 0 && lesteNovo.state.ondaNumero === 0 && hordaDe(lesteNovo).every((u) => u.hp === 12), 'M2.o: com a origem no estágio 0 o vizinho nasce como sempre: nível 1, sem peças, onda 0')
  }
  // ── M4: quem DOMINA cada mapa do minimapa (pedido do usuário, 22/11): «uma cor para mapas Selvagens, dominados pela natureza e nem por você nem por aliados nem por inimigos; outra para
  // inimigos; outra para você e aliados». `donoDoMapa(ficha)` é função PURA e o `resumoAtlas` o entrega para o minimapa pintar. Decisões [D-minha]: ruína nossa (hp 0) NÃO é domínio; obra nossa EM
  // CONSTRUÇÃO é; núcleo inimigo MORTO não é base viva (mapa conquistado e abandonado volta a ser selvagem); peças inimigas soltas SEM núcleo não são base; se há obra/tropa NOSSA e núcleo inimigo vivo
  // no mesmo mapa, o mapa é NOSSO (a luta é sua).
  {
    const cru = createPartida(1, 0, true)
    const nucleoInimigoVivo = (s: PartidaState) => s.obras.some((o) => o.lado === 'inimigo' && o.tipo === 'nucleo' && o.hp > 0)
    const semInimigo = (s: PartidaState): PartidaState => ({ ...s, obras: s.obras.filter((o) => o.lado !== 'inimigo'), unidades: s.unidades.filter((u) => u.lado !== 'inimigo') })
    const nossaObra = (id: number, hp: number, extra: Partial<Obra> = {}): Obra => ({ id, lado: 'nosso', tipo: 'quartel', x: -10, z: -10, nivel: 1, hp, maxHp: 40, gateApplied: false, cooldown: 0, ...extra })
    const nossaTropa = (id: number, hp: number): Unidade => ({ id, lado: 'aliado', papel: 'tropa', x: 1, z: 1, hp, postura: 'automatico', ordem: null, cooldown: 0, segmentos: [], alerta: false })
    const fichaCom = (s: PartidaState) => ({ ...fichaEm(abrirMapa(criarAtlas(), 1, 0), 1, 0)!, state: s })
    assert(nucleoInimigoVivo(cru), 'M4: (arranjo) o mapa cru tem uma base inimiga viva')

    // M4.a: só inimigo = inimigo; nada de ninguém = selvagem; você = nosso
    assert(donoDoMapa(fichaCom(cru)) === 'inimigo', 'M4.a: um mapa com base inimiga viva e nada nosso é do INIMIGO')
    assert(donoDoMapa(fichaCom(semInimigo(cru))) === 'selvagem', 'M4.a: um mapa sem ninguém (nem obra nossa, nem tropa nossa, nem base inimiga) é SELVAGEM')
    assert(donoDoMapa(fichaCom({ ...cru, obras: [...cru.obras, nossaObra(9001, 40)] })) === 'nosso', 'M4.a: obra nossa viva = NOSSO (mesmo com a base inimiga ali)')
    assert(donoDoMapa(fichaCom({ ...semInimigo(cru), obras: [nossaObra(9001, 40)] })) === 'nosso', 'M4.a: obra nossa viva e nenhuma base inimiga = NOSSO')
    assert(donoDoMapa(fichaCom({ ...cru, unidades: [...cru.unidades, nossaTropa(9002, 16)] })) === 'nosso', 'M4.a: tropa nossa viva = NOSSO (mesmo com a base inimiga ali)')
    assert(donoDoMapa(fichaCom({ ...semInimigo(cru), unidades: [nossaTropa(9002, 16)] })) === 'nosso', 'M4.a: tropa nossa viva e nenhuma base inimiga = NOSSO')

    // M4.b: ruína não é domínio; construção é
    assert(donoDoMapa(fichaCom({ ...semInimigo(cru), obras: [nossaObra(9001, 0)] })) === 'selvagem', 'M4.b: ruína nossa (hp 0) sem mais ninguém = SELVAGEM (a natureza retoma o que caiu)')
    assert(donoDoMapa(fichaCom({ ...cru, obras: [...cru.obras, nossaObra(9001, 0)] })) === 'inimigo', 'M4.b: ruína nossa e base inimiga viva = INIMIGO (você já perdeu o mapa)')
    assert(donoDoMapa(fichaCom({ ...semInimigo(cru), unidades: [nossaTropa(9002, 0)] })) === 'selvagem', 'M4.b: tropa nossa morta (hp 0) não domina')
    assert(donoDoMapa(fichaCom({ ...semInimigo(cru), obras: [nossaObra(9001, 40, { construindoRestante: 5, construindoTotal: 6 })] })) === 'nosso', 'M4.b: obra nossa EM CONSTRUÇÃO já domina (o jogador está lá)')

    // M4.c: a conquista: o núcleo inimigo caiu (hp 0) e você não fundou nada: o mapa volta a ser selvagem
    const conquistado: PartidaState = { ...cru, obras: cru.obras.map((o) => (o.lado === 'inimigo' ? { ...o, hp: 0 } : o)), unidades: cru.unidades.filter((u) => u.lado !== 'inimigo') }
    assert(donoDoMapa(fichaCom(conquistado)) === 'selvagem', 'M4.c: núcleo inimigo destruído e nada nosso = SELVAGEM (decisão do usuário: «nem por você nem por aliados nem por inimigos»)')
    const pecaSolta: PartidaState = { ...conquistado, obras: [...conquistado.obras, { id: 9100, lado: 'inimigo', tipo: 'torre', x: 5, z: 5, nivel: 1, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 }] }
    assert(donoDoMapa(fichaCom(pecaSolta)) === 'selvagem', 'M4.c: uma torre inimiga SOLTA, sem núcleo vivo, não faz do mapa uma base inimiga')
    assert(donoDoMapa(fichaCom({ ...conquistado, obras: [...conquistado.obras, nossaObra(9001, 40)] })) === 'nosso', 'M4.c: conquistado e depois fundado: NOSSO')

    // M4.d: só tropas inimigas soltas (sem núcleo) não fazem uma base: o inimigo evoluir NÃO é o que pinta o mapa, é a base viva
    const soTropaInimiga: PartidaState = { ...conquistado, unidades: cru.unidades }
    assert(donoDoMapa(fichaCom(soTropaInimiga)) === 'selvagem', 'M4.d: só tropas inimigas, sem núcleo vivo: SELVAGEM (a cor do inimigo é a da BASE)')

    // M4.e: a cor chega ao minimapa pelo `resumoAtlas`, com o mesmo dono, e muda quando o mapa muda de mãos
    let a = abrirMapa(criarAtlas(), 1, 0)
    const dono = (atlas: Atlas, i: number, j: number) => resumoAtlas(atlas).find((r) => r.i === i && r.j === j)?.dono
    assert(dono(a, 1, 0) === 'inimigo' && dono(a, 0, 0) === 'inimigo', 'M4.e: o resumo entrega o dono: os dois mapas recém-nascidos são do INIMIGO')
    a = escreverFicha(a, 1, 0, conquistado, 'cheio')
    assert(dono(a, 1, 0) === 'selvagem' && dono(a, 0, 0) === 'inimigo', 'M4.e: conquistar o (1,0) o torna SELVAGEM no resumo e não mexe no (0,0)')
    a = escreverFicha(a, 1, 0, { ...conquistado, obras: [...conquistado.obras, nossaObra(9001, 40)] }, 'cheio')
    assert(dono(a, 1, 0) === 'nosso', 'M4.e: fundar no (1,0) o torna NOSSO no resumo')
    assert(resumoAtlas(a).every((r) => r.dono === 'nosso' || r.dono === 'inimigo' || r.dono === 'selvagem'), 'M4.e: todo mapa do resumo tem um dono válido')
  }
  // ── M5: as TROPAS atravessam de mapa (pedido do usuário, 23/11: «pode fazer tropas atravessar de mapa»). Decisões do usuário (AskUserQuestion, 23/11): continuam a ORDEM do outro lado (o destino de `mover` é
  // convertido); ficam no mapa para onde foram e lutam ali (o mapa fica NOSSO por causa delas); o limite de 24 vale POR MAPA. Contrato [D-minha]: só tropa aliada VIVA cruza (inimigo nunca); ao cruzar ganha um id
  // NOVO do mapa de destino (cada ficha tem o seu `nextId`: um id herdado colidiria com uma unidade de lá quando o vizinho envelhecer); `atacar` e `atacarObra` são CANCELADAS (o alvo ficou no mapa antigo); a
  // posição, o destino de `mover`, a âncora, a rota e a trilha são convertidos pela MESMA régua do herói (`x − 112·Δi`).
  {
    const tropaDe = (id: number, x: number, z: number, extra: Partial<Unidade> = {}): Unidade => ({ id, lado: 'aliado', papel: 'tropa', x, z, hp: 16, postura: 'ordens', ordem: null, cooldown: 0, segmentos: [], alerta: false, ...extra })
    const nossas = (f: { state: PartidaState }) => f.state.unidades.filter((u) => u.lado === 'aliado' && u.hp > 0)

    // M5.a: a função pura: converte posição, ordem de mover, âncora, rota e trilha; cancela atacar/atacarObra; devolve um id novo
    const comOrdemMover = tropaDe(9, 60, 3, { ordem: { tipo: 'mover', x: 70, z: 5 }, ancora: { x: 58, z: 2 }, trilha: [{ x: 57, z: 3 }, { x: 56.5, z: 3 }], rota: { marcos: [{ x: 64, z: 4 }, { x: 70, z: 5 }], renovarEm: 1, semCaminho: false, versao: 3, modo: 'fixo' } })
    const c = converterUnidadeDeMapa(comOrdemMover, 1, 0, 40)
    assert(c.id === 40, `M5.a: a tropa que cruza ganha o id NOVO do mapa de destino (veio ${c.id})`)
    assert(c.x === 60 - 112 && c.z === 3, `M5.a: a posição converte pela régua do herói: x − 112·Δi, z − 112·Δj (veio ${c.x},${c.z})`)
    assert(c.ordem?.tipo === 'mover' && c.ordem.x === 70 - 112 && c.ordem.z === 5, `M5.a: o DESTINO da ordem de mover é convertido junto: a tropa continua andando do outro lado (veio ${JSON.stringify(c.ordem)})`)
    assert(c.ancora?.x === 58 - 112 && c.ancora.z === 2, 'M5.a: a âncora é convertida')
    assert(c.trilha?.length === 2 && c.trilha[0].x === 57 - 112 && c.trilha[1].x === 56.5 - 112, 'M5.a: a trilha é convertida ponto a ponto')
    assert(c.rota?.marcos[0].x === 64 - 112 && c.rota.marcos[1].x === 70 - 112 && c.rota.marcos[1].z === 5, 'M5.a: os marcos da rota são convertidos')
    assert(c.hp === 16 && c.papel === 'tropa' && c.lado === 'aliado' && c.postura === 'ordens', 'M5.a: vida, papel, lado e postura NÃO mudam')
    const norte = converterUnidadeDeMapa(tropaDe(9, 4, 60), 0, 1, 41)
    assert(norte.x === 4 && norte.z === 60 - 112, 'M5.a: o eixo z converte do mesmo jeito (Δj = 1)')
    const diag = converterUnidadeDeMapa(tropaDe(9, -60, -61), -1, -1, 42)
    assert(diag.x === -60 + 112 && diag.z === -61 + 112, 'M5.a: oeste e sul convertem com o sinal certo (Δi = −1, Δj = −1)')
    const comAlem = converterUnidadeDeMapa(tropaDe(9, 55.4, 3, { ordem: { tipo: 'mover', x: 55.65, z: 3, alem: { x: 70, z: 5 } } }), 1, 0, 46)
    assert(comAlem.ordem?.tipo === 'mover' && comAlem.ordem.x === 70 - 112 && comAlem.ordem.z === 5, `M5.a: com \`alem\`, o destino do outro lado é o ORIGINAL convertido (70 − 112 = −42), NÃO o x/z preso na borda (55,65 − 112 = −56,35; veio ${JSON.stringify(comAlem.ordem)})`)
    assert(comAlem.ordem?.tipo === 'mover' && !('alem' in comAlem.ordem), 'M5.a: `alem` NÃO é levado ao mapa novo (lá o destino já é interno)')
    const atk = converterUnidadeDeMapa(tropaDe(9, 60, 3, { ordem: { tipo: 'atacar', alvoId: 77 } }), 1, 0, 43)
    assert(atk.ordem === null, 'M5.a: `atacar` é CANCELADA: o alvo ficou no mapa antigo (um alvoId igual no mapa novo seria OUTRA unidade)')
    const atkObra = converterUnidadeDeMapa(tropaDe(9, 60, 3, { ordem: { tipo: 'atacarObra', obraId: 7 } }), 1, 0, 44)
    assert(atkObra.ordem === null, 'M5.a: `atacarObra` também é cancelada')
    assert(converterUnidadeDeMapa(tropaDe(9, 60, 3), 1, 0, 45).ordem === null && converterUnidadeDeMapa(tropaDe(9, 60, 3), 1, 0, 45).rota == null, 'M5.a: sem ordem nem rota segue sem ordem nem rota (nada inventado)')
    assert(comOrdemMover.x === 60 && comOrdemMover.ordem?.tipo === 'mover' && comOrdemMover.ordem.x === 70, 'M5.a: a função é PURA: a unidade original não foi alterada')

    // arranjo do atlas: um núcleo nosso e 3 tropas no mapa (0,0), em fila perto da borda leste
    const montar = (): { atlas: Atlas; ids: number[] } => {
      const base = criarAtlas()
      let s = fundar(base.fichas[0].state, 'nucleo', 30, 0)
      const n = s.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
      for (let k = 0; k < 3; k++) s = criarTropa({ ...s, credito: 30 }, n.id)
      s = { ...s, unidades: s.unidades.filter((u) => u.lado !== 'inimigo'), obras: s.obras.filter((o) => o.lado === 'nosso') }
      return { atlas: escreverCena(base, s), ids: s.unidades.filter((u) => u.lado === 'aliado').map((u) => u.id) }
    }
    // 0,05 s por chamada: é o que o JOGO passa ao atlas (`IlhaRua`: `Math.min(dt, 0.05)`). Com 0,25 s a última posição com a ordem ainda viva cai a x = 54,0 e o limiar de travessia (54,6) perderia tropas, o que o jogo real nunca faz.
    const andar = (a: Atlas, segundos: number): Atlas => { let x = a; for (let t = 0; t < segundos - 1e-9; t += 0.05) x = stepAtlas(x, INPUT_PARADO, 0.05); return x }

    // M5.b: uma tropa ordenada para ALÉM da borda CRUZA: sai do (0,0), aparece no (1,0), segue a ordem e não perde nem duplica ninguém
    const { atlas: a0, ids } = montar()
    const alvoId = ids[0]
    const nTropas0 = nossas(fichaEm(a0, 0, 0)!).length
    const ordenada = escreverCena(a0, ordenar(estadoCena(a0), [alvoId], { tipo: 'mover', x: 70, z: 0 }))
    const depois = andar(ordenada, 25)
    const f0 = fichaEm(depois, 0, 0)!
    const f1 = fichaEm(depois, 1, 0)
    assert(f1 !== undefined, 'M5.b: o mapa (1,0) NASCEU quando a tropa chegou à borda (como nasce para o herói)')
    assert(nossas(f1).length === 1, `M5.b: o (1,0) tem exatamente 1 tropa nossa (veio ${nossas(f1).length})`)
    assert(nossas(f0).length === nTropas0 - 1, `M5.b: o (0,0) perdeu exatamente 1 (era ${nTropas0}, ficou ${nossas(f0).length}): ninguém sumiu nem foi duplicado`)
    assert(!f0.state.unidades.some((u) => u.id === alvoId), 'M5.b: o id antigo SAIU do mapa de origem')
    const chegou = nossas(f1)[0]
    assert(chegou.x > -56 && chegou.x < 56 && Math.abs(chegou.z) < 56, `M5.b: a tropa está DENTRO do quadrado do mapa novo (x=${chegou.x.toFixed(1)}), nunca fora dele`)
    assert(chegou.x < -40, `M5.b: ela chegou pela BORDA OESTE do (1,0), onde entrou (x=${chegou.x.toFixed(1)} < −40): a continuidade do espaço`)
    assert(!f1.state.unidades.some((u) => u.lado === 'aliado' && u.id !== chegou.id), 'M5.b: só 1 aliada no (1,0)')

    // M5.c: a tropa continua a ORDEM do outro lado e CHEGA ao destino convertido (70 − 112 = −42), e o corpo (herói) segue onde estava
    assert(Math.abs(chegou.x - (70 - 112)) < 1.5 && Math.abs(chegou.z) < 1.5, `M5.c: ela chegou ao destino convertido (≈ −42, 0) e não parou na borda (veio ${chegou.x.toFixed(1)},${chegou.z.toFixed(1)})`)
    assert(chegou.ordem === null || chegou.ordem.tipo !== 'atacar', 'M5.c: nenhuma ordem de atacar sobrou')
    assert(depois.heroiI === 0 && depois.heroiJ === 0 && !estadoCorpo(depois).derrota, 'M5.c: o herói NÃO foi junto (a tropa atravessa sozinha) e a partida segue')

    // M5.d: o id da tropa que cruzou NÃO colide com nada do mapa de destino
    const idsDestino = f1.state.unidades.map((u) => u.id).concat(f1.state.obras.map((o) => o.id))
    assert(new Set(idsDestino).size === idsDestino.length, `M5.d: nenhum id repetido no mapa de destino (${JSON.stringify(idsDestino)})`)
    assert(f1.state.nextId > Math.max(...idsDestino), 'M5.d: o `nextId` do destino está à frente de todos os ids (a próxima unidade que nascer lá não colide)')

    // M5.e: o mapa de destino fica NOSSO por causa da tropa (o minimapa da M4 azul) e o resumo o mostra
    assert(donoDoMapa(f1) === 'nosso' && resumoAtlas(depois).find((r) => r.i === 1 && r.j === 0)?.dono === 'nosso', 'M5.e: um mapa onde só há tropa nossa é NOSSO no minimapa')

    // M5.f: inimigos NUNCA cruzam, e tropa MORTA também não
    const comInimigoNaBorda = (): Atlas => {
      const { atlas } = montar()
      const s = estadoCena(atlas)
      const inimigo: Unidade = { id: s.nextId, lado: 'inimigo', papel: 'horda', x: 60, z: 0, hp: 12, postura: 'automatico', ordem: null, cooldown: 0, segmentos: [], alerta: false }
      return escreverCena(atlas, { ...s, nextId: s.nextId + 1, unidades: [...s.unidades, inimigo] })
    }
    const apos = andar(comInimigoNaBorda(), 5)
    assert(!fichaEm(apos, 1, 0) || !fichaEm(apos, 1, 0)!.state.unidades.some((u) => u.lado === 'inimigo' && u.papel === 'horda' && u.x < -40), 'M5.f: um inimigo fora do quadrado NÃO atravessa para o mapa vizinho (só tropa NOSSA cruza)')
    const morta = montar()
    const sMorta = estadoCena(morta.atlas)
    const comMorta = escreverCena(morta.atlas, { ...sMorta, unidades: [...sMorta.unidades, tropaDe(sMorta.nextId, 60, 0, { hp: 0 })], nextId: sMorta.nextId + 1 })
    assert(!fichaEm(andar(comMorta, 3), 1, 0), 'M5.f: tropa MORTA (hp 0) fora do quadrado NÃO faz nascer mapa nem cruza')

    // M5.g: o limite de 24 vale POR MAPA: um destino com 24 tropas ainda recebe a que cruza (decisão do usuário); e uma tropa que cruza não conta duas vezes
    const cheio = montar()
    let sCheio = estadoCena(cheio.atlas)
    const extras = Array.from({ length: 21 }, (_, k) => tropaDe(sCheio.nextId + k, -12 + k * 0.4, 20))
    sCheio = { ...sCheio, nextId: sCheio.nextId + 21, unidades: [...sCheio.unidades, ...extras] }
    assert(nossas({ state: sCheio }).length === 24, 'M5.g: (arranjo) o mapa de origem tem as 24 tropas do limite')
    const cheioOrdenado = escreverCena(cheio.atlas, ordenar(sCheio, [cheio.ids[0]], { tipo: 'mover', x: 70, z: 0 }))
    const cheioDepois = andar(cheioOrdenado, 25)
    assert(nossas(fichaEm(cheioDepois, 1, 0)!).length === 1 && nossas(fichaEm(cheioDepois, 0, 0)!).length === 23, 'M5.g: origem 24 → 23 e destino 0 → 1: o limite é por mapa e a soma se conserva')

    // M5.i: ninguém atravessa por ACASO: a tropa só cruza se recebeu uma ORDEM de mover para um ponto FORA do quadrado. Uma tropa que anda até a borda por uma ordem para um ponto DENTRO do mapa, ou que
    // fica em vigia colada à borda, NÃO cruza (senão uma guarda posta na beira do mapa fugiria sozinha). Medido antes de desenhar: o A* prende um destino fora do mapa em x = 55,65 e, com qualquer obra, devolve
    // `null` (sem caminho); então a tropa CHEGA à borda e fica lá com a ordem viva até o atlas a transferir.
    const guarda = montar()
    const sg = estadoCena(guarda.atlas)
    const naBorda = { ...sg, unidades: sg.unidades.map((u) => (u.id === guarda.ids[0] ? { ...u, x: 55.3, z: 0, ordem: null, postura: 'vigia' as const } : u)) }
    const guardaNaBorda = andar(escreverCena(guarda.atlas, naBorda), 6)
    assert(!fichaEm(guardaNaBorda, 1, 0) && nossas(fichaEm(guardaNaBorda, 0, 0)!).length === 3, 'M5.i: uma tropa em VIGIA colada à borda (sem ordem para fora) NÃO atravessa')
    const ordemInterna = escreverCena(guarda.atlas, ordenar(sg, [guarda.ids[0]], { tipo: 'mover', x: 55, z: 0 }))
    const internaDepois = andar(ordemInterna, 12)
    assert(!fichaEm(internaDepois, 1, 0) && nossas(fichaEm(internaDepois, 0, 0)!).length === 3, 'M5.i: ordem de mover para um ponto DENTRO do mapa (mesmo colado à borda) NÃO atravessa')
    const atacando = escreverCena(guarda.atlas, { ...sg, unidades: sg.unidades.map((u) => (u.id === guarda.ids[0] ? { ...u, x: 55.3, z: 0, postura: 'ordens' as const, ordem: { tipo: 'atacar' as const, alvoId: 1 } } : u)) })
    assert(!fichaEm(andar(atacando, 3), 1, 0), 'M5.i: ordem de ATACAR perto da borda NÃO atravessa (só `mover` para fora)')

    // M5.j: o herói e a tropa podem cruzar no MESMO passo sem se atrapalhar (cada um pelo seu caminho)
    const juntos = montar()
    const sj = estadoCena(juntos.atlas)
    const heroiNaBorda = escreverCena(juntos.atlas, { ...ordenar(sj, [juntos.ids[0]], { tipo: 'mover', x: 70, z: 0 }), heroi: { ...sj.heroi, x: 56.2, z: 0 } })
    const dep = andar(heroiNaBorda, 20)
    assert(dep.heroiI === 1 && nossas(fichaEm(dep, 1, 0)!).length >= 1, 'M5.j: o herói cruzou e a tropa que ele deixaria também chega ao (1,0)')
    assert(new Set(fichaEm(dep, 1, 0)!.state.unidades.map((u) => u.id)).size === fichaEm(dep, 1, 0)!.state.unidades.length, 'M5.j: nenhum id repetido no (1,0) com herói e tropa cruzando juntos')

    // M5.l: a DECISÃO de cruzar, caso a caso, direto na função (a mutação mostrou que M5.f e M5.i montavam inimigo e tropa morta SEM ordem, então o `null` vinha da ordem ausente e a checagem de lado e de vida
    // nunca era exercitada). Cada caso isola UMA condição: tudo igual ao CONTROLE (aliada viva, mover com `alem`, na borda) menos o que está escrito.
    {
      const controle: Unidade = tropaDe(1, 55.3, 0, { ordem: { tipo: 'mover', x: 55.65, z: 0, alem: { x: 70, z: 0 } } })
      const decide = (u: Unidade) => ladoDaTravessia(u)
      assert(JSON.stringify(decide(controle)) === '{"dI":1,"dJ":0}', 'M5.l: CONTROLE: aliada viva, mover com alem, na borda leste cruza para (+1, 0)')
      assert(decide({ ...controle, lado: 'inimigo' }) === null, 'M5.l: o MESMO caso com um INIMIGO não cruza (só tropa NOSSA)')
      assert(decide({ ...controle, hp: 0 }) === null && decide({ ...controle, hp: -1 }) === null && decide({ ...controle, hp: Number.NaN }) === null, 'M5.l: o MESMO caso com a tropa MORTA (hp 0, negativo ou NaN) não cruza')
      assert(decide({ ...controle, ordem: { tipo: 'mover', x: 55.6, z: 0 } }) === null, 'M5.l: o MESMO caso SEM `alem` (mover interno colado à borda) não cruza')
      assert(decide({ ...controle, ordem: null }) === null && decide({ ...controle, ordem: { tipo: 'atacar', alvoId: 5 } }) === null, 'M5.l: o MESMO caso sem ordem de mover (vigia, atacar) não cruza, mesmo colado à borda')
      assert(decide({ ...controle, x: 30 }) === null && decide({ ...controle, x: 54.5 }) === null, 'M5.l: o MESMO caso longe da borda (x = 30 e x = 54,5, abaixo do limiar de 54,6) não cruza')
      assert(JSON.stringify(decide({ ...controle, x: 54.6 })) === '{"dI":1,"dJ":0}', 'M5.l: no limiar exato (x = 54,6) cruza')
      // os 4 lados e a diagonal: cada eixo olha o SEU sinal e a SUA posição
      assert(JSON.stringify(decide(tropaDe(1, -55.3, 0, { ordem: { tipo: 'mover', x: -55.65, z: 0, alem: { x: -70, z: 0 } } }))) === '{"dI":-1,"dJ":0}', 'M5.l: oeste: cruza para (−1, 0)')
      assert(JSON.stringify(decide(tropaDe(1, 0, 55.3, { ordem: { tipo: 'mover', x: 0, z: 55.65, alem: { x: 0, z: 70 } } }))) === '{"dI":0,"dJ":1}', 'M5.l: norte: cruza para (0, +1)')
      assert(JSON.stringify(decide(tropaDe(1, 0, -55.3, { ordem: { tipo: 'mover', x: 0, z: -55.65, alem: { x: 0, z: -70 } } }))) === '{"dI":0,"dJ":-1}', 'M5.l: sul: cruza para (0, −1)')
      assert(JSON.stringify(decide(tropaDe(1, 55.3, 55.3, { ordem: { tipo: 'mover', x: 55.65, z: 55.65, alem: { x: 70, z: 70 } } }))) === '{"dI":1,"dJ":1}', 'M5.l: diagonal: cruza para (+1, +1)')
      // a posição de um eixo NÃO basta: o destino de x está fora, mas a tropa está a meio caminho em x (30) e junto à borda de z: só z decide, e z não tem destino fora → null
      assert(decide(tropaDe(1, 30, 55.3, { ordem: { tipo: 'mover', x: 55.65, z: 55.65, alem: { x: 70, z: 10 } } })) === null, 'M5.l: o destino está fora em x mas a tropa só está colada à borda em z: NÃO cruza')
      assert(decide(tropaDe(1, 55.3, 0, { ordem: { tipo: 'mover', x: 55.65, z: 0, alem: { x: 70, z: 70 } } }))?.dJ === 0, 'M5.l: o destino está fora em z mas a tropa NÃO está colada à borda em z (z = 0): só cruza em x (dJ = 0)')
      // a borda do DESTINO: 56 já é fora (a mesma régua do herói); 55,99 é dentro
      assert(decide({ ...controle, ordem: { tipo: 'mover', x: 55.65, z: 0, alem: { x: 56, z: 0 } } })?.dI === 1, 'M5.l: destino em exatamente 56 já é FORA')
      assert(decide({ ...controle, ordem: { tipo: 'mover', x: 55.65, z: 0, alem: { x: 55.99, z: 0 } } }) === null, 'M5.l: destino em 55,99 é DENTRO: não cruza')
      assert(decide({ ...controle, ordem: { tipo: 'mover', x: -55.65, z: 0, alem: { x: -56, z: 0 } } }) === null, 'M5.l: destino a oeste (−56) mas a tropa está na borda LESTE: o lado da posição tem de bater com o do destino (não cruza)')
    }

    // M5.m: cruzar pelos OUTROS lados no atlas real, e o mapa novo herda o ESTÁGIO e a CAMADA (a mutação mostrou que só o leste e só o estágio 0 eram exercitados)
    for (const [ox, oz, i, j, rotulo] of [[-70, 0, -1, 0, 'oeste'], [0, 70, 0, 1, 'norte'], [0, -70, 0, -1, 'sul'], [70, 70, 1, 1, 'diagonal']] as const) {
      const m = montar()
      const sm = estadoCena(m.atlas)
      const nuc = sm.obras.find((o) => o.lado === 'nosso' && o.tipo === 'nucleo')!
      const posta = { ...sm, unidades: sm.unidades.map((u) => (u.id === m.ids[0] ? { ...u, x: ox === 0 ? nuc.x : Math.sign(ox) * 50, z: oz === 0 ? 0 : Math.sign(oz) * 50 } : u)) }
      const ordenado = escreverCena(m.atlas, ordenar(posta, [m.ids[0]], { tipo: 'mover', x: ox, z: oz }))
      const fim = andar(ordenado, 12)
      const destinoF = fichaEm(fim, i, j)
      assert(destinoF !== undefined && nossas(destinoF).length === 1, `M5.m: a tropa cruzou para o ${rotulo} (${i}, ${j}) e o mapa nasceu`)
      assert(nossas(fichaEm(fim, 0, 0)!).length === 2, `M5.m: ${rotulo}: a origem ficou com 2 (perdeu exatamente 1)`)
      assert(Math.abs(nossas(destinoF)[0].x) <= 56 && Math.abs(nossas(destinoF)[0].z) <= 56, `M5.m: ${rotulo}: a tropa está DENTRO do quadrado do mapa novo`)
    }
    {
      // estágio e camada: o mapa novo nasce com o inimigo no estágio do mapa de ORIGEM e com a vida da camada do LUGAR (a mesma regra de qualquer vizinho)
      const m = montar()
      const origemEvoluida = escreverCena(m.atlas, evoluirInimigo(estadoCena(m.atlas), 1, 4))
      const so = estadoCena(origemEvoluida)
      const andou = escreverCena(origemEvoluida, ordenar({ ...so, unidades: so.unidades.map((u) => (u.id === m.ids[0] ? { ...u, x: 50, z: 0 } : u)) }, [m.ids[0]], { tipo: 'mover', x: 70, z: 0 }))
      const fim = andar(andou, 12)
      const viz = fichaEm(fim, 1, 0)!
      assert(viz.state.ondaNumero === 4 && viz.state.obras.some((o) => o.lado === 'inimigo' && o.tipo === 'nucleo' && o.nivel === 4), `M5.m: o mapa que NASCE para a tropa herda o estágio 4 da origem (onda ${viz.state.ondaNumero})`)
    }

    // M5.h: o herói não é afetado quando NÃO há tropa a cruzar (regressão: o caminho antigo continua igual)
    const soHeroi = colocarHeroi(criarAtlas(), 56.1, 0)
    assert(soHeroi.heroiI === 1 && estadoCorpo(soHeroi).heroi.x < -40, 'M5.h: o herói segue cruzando como sempre')
  }
}
