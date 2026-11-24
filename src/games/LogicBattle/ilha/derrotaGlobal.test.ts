import { PARTIDA } from './partidaPolicies'
import { createPartida, fundar, INPUT_PARADO, Obra, PartidaState, stepPartida } from './partidaSim'
import { colocarHeroi, criarAtlas, escreverCena, escreverFicha, estadoCorpo, fichaEm, stepAtlas } from './atlas'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * A DERROTA É GLOBAL (pedido do usuário, 23/11): «se você perder a base em outro minimapa, mesmo tendo a sua base forte no seu minimapa inicial, você perde o jogo inteiro». A decisão dele de 20/11 já dizia: «derrota = nenhum
 * núcleo nosso em NENHUM quadrado (depois de ter havido base)». MEDIDO (`medir-derrota-global.mjs`, 23/11): o núcleo de (0,0) com 5.000 de vida, o do mapa vizinho (1,0) cai e o jogo acaba: `checaDerrota` roda DENTRO de cada
 * partida e só enxerga o próprio mapa.
 *
 * Desenho [D-minha]: a partida ganha o campo `outraBaseViva` (escrito só pelo atlas, que enxerga todas as fichas). Com ele ligado, a queda do núcleo LOCAL não decreta a derrota. Sem ele (partida isolada, como em todo teste e como
 * no jogo de um mapa só) tudo é como era. O herói morto (vida 0) segue sendo derrota: a ressurreição na base (L4) é outra fatia.
 */
export function run(): void {
  const NUCLEO = (s: PartidaState) => s.obras.find((o) => o.lado !== 'inimigo' && o.tipo === 'nucleo')

  // Uma ficha com um núcleo nosso FRÁGIL (1 de vida) e um sitiante colado nele: o núcleo cai no primeiro passo. `semCorpo` false: o herói está aqui.
  const ficha = (opcoes: { forte?: boolean; outraBaseViva?: boolean } = {}): PartidaState => {
    const base = fundar({ ...createPartida(), heroiPostura: 'calado' }, 'nucleo', 20, 20)
    const nuc = NUCLEO(base)!
    const sitiante = { id: 9000, lado: 'inimigo' as const, papel: 'sitiante' as const, x: nuc.x + 1.2, z: nuc.z, hp: 99, postura: 'automatico' as const, ordem: null, cooldown: 0, segmentos: [] as number[], alerta: true }
    return {
      ...base,
      outraBaseViva: opcoes.outraBaseViva,
      unidades: [...base.unidades.filter((u) => u.lado !== 'inimigo'), sitiante],
      obras: base.obras.map((o) => (o.lado !== 'inimigo' ? { ...o, hp: opcoes.forte ? 5000 : 1, maxHp: opcoes.forte ? 5000 : 1 } : { ...o, cooldown: 1e9 })),
    }
  }
  const passos = (s: PartidaState, n = 40) => {
    let atual = s
    for (let k = 0; k < n; k += 1) atual = stepPartida(atual, INPUT_PARADO, 0.05)
    return atual
  }

  // 1) PARTIDA ISOLADA (sem o campo): a queda do núcleo ENCERRA, como sempre foi (o jogo de um mapa só e todos os testes antigos)
  {
    const fim = passos(ficha())
    assert(NUCLEO(fim)!.hp === 0, 'derrota: (controle) o núcleo frágil caiu no cenário')
    assert(fim.derrota === true, 'derrota: sem `outraBaseViva` a queda do núcleo encerra a partida (a regra de sempre)')
    assert(passos(ficha({ outraBaseViva: false })).derrota === true, 'derrota: `outraBaseViva: false` é o mesmo que ausente: encerra')
  }

  // 2) COM OUTRA BASE VIVA em outro mapa, a queda do núcleo LOCAL não encerra o jogo
  {
    const fim = passos(ficha({ outraBaseViva: true }))
    assert(NUCLEO(fim)!.hp === 0, 'derrota: (controle) o núcleo local caiu também com `outraBaseViva`')
    assert(fim.derrota === false, 'derrota: com outra base viva em outro mapa, perder ESTA base não derrota o jogador')
    // o herói NÃO morreu: continua com a vida, no corpo
    assert(fim.heroi.army > 0 && fim.semCorpo === false, 'derrota: o herói segue vivo e no corpo depois de perder a base daqui')
  }

  // 3) o HERÓI MORTO (vida 0) COM base viva entra em ressurreição (não derrota); SEM base viva encerra
  {
    const base = ficha({ outraBaseViva: true, forte: true })
    const comBase = stepPartida({ ...base, heroi: { ...base.heroi, army: 0 } }, INPUT_PARADO, 0.05)
    assert(comBase.derrota === false && comBase.heroiCaido === true, 'derrota: herói com vida 0 com base viva aguarda ressurreição sem derrota')
    const semBase = { ...base, outraBaseViva: false, obras: base.obras.filter((o) => o.lado !== 'nosso') }
    const mortoSemBase = stepPartida({ ...semBase, heroi: { ...semBase.heroi, army: 0 } }, INPUT_PARADO, 0.05)
    assert(mortoSemBase.derrota === true, 'derrota: herói com vida 0 sem nenhum núcleo vivo encerra o jogo')
  }

  // 4) o ATLAS escreve o campo: o herói num vizinho, a base de casa viva e forte → a base do vizinho cai → SEM derrota global
  {
    let casa = fundar(createPartida(), 'nucleo', -30, 0)
    casa = { ...casa, obras: casa.obras.map((o) => (o.lado !== 'inimigo' ? { ...o, hp: 5000, maxHp: 5000 } : o)) }
    let atlas = escreverCena(criarAtlas(), casa)
    atlas = colocarHeroi(atlas, PARTIDA.radius + 0.5, 0)
    assert(atlas.heroiI === 1 && atlas.heroiJ === 0, 'derrota: (arranjo) o herói está no mapa (1,0)')
    const viz = ficha()
    const vizComCorpo = { ...viz, heroi: { ...estadoCorpo(atlas).heroi, x: 5, z: 5 }, semCorpo: false }
    atlas = escreverFicha(atlas, 1, 0, vizComCorpo, 'cheio')
    for (let k = 0; k < 60; k += 1) atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    const lado = fichaEm(atlas, 1, 0)!
    assert(NUCLEO(lado.state)!.hp === 0, 'derrota: (controle) a base do vizinho (1,0) caiu no atlas')
    assert(NUCLEO(fichaEm(atlas, 0, 0)!.state)!.hp === 5000, 'derrota: (controle) a base de casa segue com 5.000 de vida')
    assert(estadoCorpo(atlas).derrota === false, 'derrota: perder a base do vizinho com a de casa forte NÃO acaba o jogo (o pedido do usuário)')
    assert(estadoCorpo(atlas).heroi.army > 0, 'derrota: o herói segue vivo')
  }

  // 5) a ÚLTIMA base: se a de casa também cai, aí sim acaba (a regra de 20/11: «nenhum núcleo nosso em NENHUM quadrado»)
  {
    let casa = fundar(createPartida(), 'nucleo', -30, 0)
    casa = { ...casa, obras: casa.obras.map((o) => (o.lado !== 'inimigo' ? { ...o, hp: 1, maxHp: 1 } : { ...o, cooldown: 1e9 })) }
    const nuc = NUCLEO(casa)!
    casa = { ...casa, unidades: [...casa.unidades, { id: 9100, lado: 'inimigo' as const, papel: 'sitiante' as const, x: nuc.x + 1.2, z: nuc.z, hp: 99, postura: 'automatico' as const, ordem: null, cooldown: 0, segmentos: [] as number[], alerta: true }] }
    let atlas = escreverCena(criarAtlas(), { ...casa, semCorpo: true })
    atlas = colocarHeroi(atlas, PARTIDA.radius + 0.5, 0)
    const viz = ficha()
    atlas = escreverFicha(atlas, 1, 0, { ...viz, heroi: { ...estadoCorpo(atlas).heroi, x: 5, z: 5 }, semCorpo: false }, 'cheio')
    for (let k = 0; k < 80 && !estadoCorpo(atlas).derrota; k += 1) atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(NUCLEO(fichaEm(atlas, 0, 0)!.state)!.hp === 0 && NUCLEO(fichaEm(atlas, 1, 0)!.state)!.hp === 0, 'derrota: (controle) as DUAS bases caíram')
    assert(estadoCorpo(atlas).derrota === true, 'derrota: quando cai a ÚLTIMA base (nenhuma outra viva em nenhum mapa) o jogo acaba')
  }

  // 5b) o que CONTA como «outra base viva» é o NÚCLEO, não qualquer obra nossa: uma TORRE nossa viva em outro mapa, sem núcleo, NÃO impede o fim. (A mutação mostrou que um `temBaseViva` que contasse qualquer obra
  // nossa passava em verde: nenhum caso tinha uma obra que não fosse núcleo.)
  {
    let casa = fundar(createPartida(), 'nucleo', -30, 0)
    casa = { ...casa, obras: casa.obras.map((o) => (o.lado !== 'inimigo' ? { ...o, hp: 1, maxHp: 1 } : { ...o, cooldown: 1e9 })) }
    const nuc = NUCLEO(casa)!
    casa = { ...casa, unidades: [...casa.unidades, { id: 9200, lado: 'inimigo' as const, papel: 'sitiante' as const, x: nuc.x + 1.2, z: nuc.z, hp: 99, postura: 'automatico' as const, ordem: null, cooldown: 0, segmentos: [] as number[], alerta: true }] }
    let atlas = escreverCena(criarAtlas(), casa)
    // um mapa longe com SÓ uma torre nossa forte (nenhum núcleo): fundada em um mapa onde o jogador tem núcleo e depois o núcleo é removido do estado
    const comTorre = fundar(fundar({ ...createPartida(), unidades: [] }, 'nucleo', -30, -30), 'torre', -26, -30)
    const soTorre = { ...comTorre, semCorpo: true, obras: comTorre.obras.filter((o) => !(o.lado === 'nosso' && o.tipo === 'nucleo')).map((o) => (o.lado === 'nosso' ? { ...o, hp: 5000, maxHp: 5000 } : { ...o, cooldown: 1e9 })) }
    assert(soTorre.obras.some((o) => o.lado === 'nosso' && o.tipo === 'torre' && o.hp > 0) && !soTorre.obras.some((o) => o.lado === 'nosso' && o.tipo === 'nucleo'), 'derrota: (arranjo) o mapa longe tem uma TORRE nossa viva e nenhum núcleo')
    atlas = colocarHeroi(atlas, PARTIDA.radius + 0.5, 0)
    atlas = escreverFicha(atlas, 1, 0, { ...ficha({ forte: true }), heroi: { ...estadoCorpo(atlas).heroi, x: 5, z: 5 }, semCorpo: false, obras: ficha({ forte: true }).obras.filter((o) => o.lado !== 'nosso') }, 'cheio')
    atlas = escreverFicha(atlas, 3, 1, soTorre, 'cheio')
    for (let k = 0; k < 80 && !estadoCorpo(atlas).derrota; k += 1) atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(NUCLEO(fichaEm(atlas, 0, 0)!.state)!.hp === 0, 'derrota: (controle) a única base (núcleo) caiu')
    assert(estadoCorpo(atlas).derrota === true, 'derrota: uma TORRE viva em outro mapa NÃO é «outra base»: sem núcleo em nenhum quadrado o jogo acaba')
  }

  // 5c) TRÊS mapas com base: cada ficha vê as OUTRAS DUAS vivas, a queda de uma NÃO derrota e a de uma segunda também não; só a da última. (A mutação mostrou que `outras = vivas` ou `vivas − 1` sempre passavam: com
  // 1 ou 2 fichas os dois valores coincidem com o certo.)
  {
    const forteSemInimigo = (x: number, z: number): PartidaState => {
      const f = fundar({ ...createPartida(), unidades: [] }, 'nucleo', x, z)
      return { ...f, obras: f.obras.map((o) => (o.lado === 'nosso' ? { ...o, hp: 5000, maxHp: 5000 } : { ...o, cooldown: 1e9 })) }
    }
    let atlas = escreverCena(criarAtlas(), forteSemInimigo(-30, 0))
    atlas = colocarHeroi(atlas, PARTIDA.radius + 0.5, 0)
    atlas = escreverFicha(atlas, 1, 0, { ...forteSemInimigo(30, 0), heroi: { ...estadoCorpo(atlas).heroi, x: 5, z: 5 }, semCorpo: false }, 'cheio')
    atlas = escreverFicha(atlas, 3, 1, { ...forteSemInimigo(-30, -30), semCorpo: true }, 'cheio')
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    // com 3 bases vivas, o campo de CADA ficha com base é verdadeiro (há 2 outras), e de uma ficha sem base é verdadeiro também (há 3)
    for (const [i, j] of [[0, 0], [1, 0], [3, 1]] as const) assert(fichaEm(atlas, i, j)!.state.outraBaseViva === true, `derrota: com 3 bases vivas a ficha (${i},${j}) enxerga outras bases vivas`)
    // derruba a de (1,0) (a do corpo): sem derrota, restam 2
    const cai = (at: typeof atlas, i: number, j: number) => {
      const f = fichaEm(at, i, j)!
      const nuc = NUCLEO(f.state)!
      const comSitiante = { ...f.state, obras: f.state.obras.map((o) => (o.id === nuc.id ? { ...o, hp: 1, maxHp: 1 } : o)), unidades: [...f.state.unidades, { id: 9300 + i, lado: 'inimigo' as const, papel: 'sitiante' as const, x: nuc.x + 1.2, z: nuc.z, hp: 99, postura: 'automatico' as const, ordem: null, cooldown: 0, segmentos: [] as number[], alerta: true }] }
      return escreverFicha(at, i, j, comSitiante, 'cheio')
    }
    atlas = cai(atlas, 1, 0)
    for (let k = 0; k < 40; k += 1) atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(NUCLEO(fichaEm(atlas, 1, 0)!.state)!.hp === 0 && estadoCorpo(atlas).derrota === false, 'derrota: caiu 1 de 3 bases e restam 2: o jogo SEGUE')
    // as duas fichas restantes: cada uma enxerga UMA outra viva (a outra), e a ficha caída enxerga as DUAS
    assert(fichaEm(atlas, 0, 0)!.state.outraBaseViva === true && fichaEm(atlas, 3, 1)!.state.outraBaseViva === true, 'derrota: com 2 bases restantes cada uma enxerga a outra viva')
    assert(fichaEm(atlas, 1, 0)!.state.outraBaseViva === true, 'derrota: a ficha SEM base enxerga as 2 bases vivas dos outros mapas (o campo vale «há outra», não «há outra além de mim»)')
    // derruba a segunda: ainda resta 1
    atlas = cai(atlas, 0, 0)
    for (let k = 0; k < 40; k += 1) atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(NUCLEO(fichaEm(atlas, 0, 0)!.state)!.hp === 0 && estadoCorpo(atlas).derrota === false, 'derrota: caíram 2 de 3 e resta 1: o jogo SEGUE')
    // as quedas já foram passos próprios: a ficha de (3,1), a última, enxerga NENHUMA outra viva
    assert(fichaEm(atlas, 3, 1)!.state.outraBaseViva === false, 'derrota: a ÚLTIMA base viva não enxerga nenhuma outra (o campo vale falso para ela)')
    // derruba a última: agora SIM acaba
    atlas = cai(atlas, 3, 1)
    for (let k = 0; k < 40 && !estadoCorpo(atlas).derrota; k += 1) atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(NUCLEO(fichaEm(atlas, 3, 1)!.state)!.hp === 0 && estadoCorpo(atlas).derrota === true, 'derrota: caiu a ÚLTIMA das 3 bases: o jogo acaba')
  }

  // 5d) uma ficha SEM base, com UMA só base viva em OUTRO mapa: o campo dela é VERDADEIRO (há outra). É o caso do herói passeando num mapa onde nunca fundou nada, com a única base em outro mapa. (A mutação mostrou que
  // `vivas − 1` incondicional passava: ele zerava este campo, e só o caso de 3 mapas o separava do certo quando a ficha TEM base.)
  {
    const unica = fundar({ ...createPartida(), unidades: [] }, 'nucleo', -30, 0)
    const forte = { ...unica, obras: unica.obras.map((o) => (o.lado === 'nosso' ? { ...o, hp: 5000, maxHp: 5000 } : { ...o, cooldown: 1e9 })) }
    let atlas = escreverCena(criarAtlas(), forte)
    atlas = colocarHeroi(atlas, PARTIDA.radius + 0.5, 0)
    atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
    assert(atlas.heroiI === 1 && !fichaEm(atlas, 1, 0)!.state.obras.some((o) => o.lado === 'nosso'), 'derrota: (arranjo) o herói está no mapa (1,0), onde o jogador não tem nada')
    assert(fichaEm(atlas, 1, 0)!.state.outraBaseViva === true, 'derrota: a ficha SEM base enxerga a única base viva que existe em OUTRO mapa')
    assert(fichaEm(atlas, 0, 0)!.state.outraBaseViva !== true, 'derrota: a ficha da ÚNICA base não enxerga nenhuma outra (o campo dela vale falso)')
  }

  // 6) o que NÃO conta como «outra base viva»: ruína (hp 0). O núcleo em CONSTRUÇÃO (andaime) CONTA, como já conta em todo o resto do jogo: `nucleoNosso` aceita qualquer núcleo nosso com vida, e `podeFundarEm` recusa um
  // segundo núcleo enquanto ele existe. Não invento uma regra nova só para a derrota: um andaime é frágil, mas é uma base que o jogador tem e que o inimigo ainda precisa derrubar.
  {
    const comOutra = (obra: Partial<Obra>): PartidaState => {
      let casa = fundar(createPartida(), 'nucleo', -30, 0)
      casa = { ...casa, obras: casa.obras.map((o) => (o.lado !== 'inimigo' && o.tipo === 'nucleo' ? { ...o, ...obra } : o)) }
      let atlas = escreverCena(criarAtlas(), { ...casa, semCorpo: true })
      atlas = colocarHeroi(atlas, PARTIDA.radius + 0.5, 0)
      atlas = escreverFicha(atlas, 1, 0, { ...ficha(), heroi: { ...estadoCorpo(atlas).heroi, x: 5, z: 5 }, semCorpo: false }, 'cheio')
      for (let k = 0; k < 80 && !estadoCorpo(atlas).derrota; k += 1) atlas = stepAtlas(atlas, INPUT_PARADO, 0.05)
      return estadoCorpo(atlas)
    }
    assert(comOutra({ hp: 0 }).derrota === true, 'derrota: uma RUÍNA (núcleo com 0 de vida) em outro mapa não é «outra base viva»')
    assert(comOutra({ hp: 5000, maxHp: 5000 }).derrota === false, 'derrota: (controle) um núcleo PRONTO e vivo em outro mapa conta')
    assert(comOutra({ hp: 5000, maxHp: 5000, construindoRestante: 99, construindoTotal: 99 }).derrota === false, 'derrota: um núcleo em CONSTRUÇÃO em outro mapa conta como base (a mesma régua de `nucleoNosso`)')
  }
}
