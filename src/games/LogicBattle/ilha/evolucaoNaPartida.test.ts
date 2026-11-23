import {
  alcanceDaTorreNoNivel,
  custoDeEvoluir,
  danoDaTorreNoNivel,
  fatorDoNivel,
  producaoNoNivel,
  tropaVidaNoNivel,
  vidaMaximaNoNivel,
} from './evolucaoObra'
import { PARTIDA } from './partidaPolicies'
import {
  alcanceDaTorre,
  alcanceDoTiro,
  atirar,
  createPartida,
  criarTropa,
  evoluir,
  fundar,
  INPUT_PARADO,
  Obra,
  PartidaState,
  podeEvoluir,
  stepPartida,
} from './partidaSim'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const perto = (a: number, b: number, folga = 1e-6) => Math.abs(a - b) < folga

/**
 * A TABELA DE EVOLUÇÃO LIGADA À PARTIDA (pedido do usuário, 23/11: «evoluir as coisas pro nivel 5 [...] faz alguma diferenca? [...] torres de guarda [...] nao estao atirando mais longe que o heroi [...] evolucoes mais caras,
 * tipo 1,5 vezes mais caro e proporcionalmente melhores»). A tabela pura tem teste próprio (`evolucaoObra.test.ts`); aqui ficam os COMPORTAMENTOS da simulação que a leem. MEDIDO antes (23/11, `medir-torre-inimiga.mjs`): o
 * herói feria a torre inimiga de 8 a 18 m e a torre só o ferira até 12 m: entre 13 e 18 m ele a destruía de graça.
 */
export function run(): void {
  const CAMPO = (): PartidaState => {
    const limpa = createPartida()
    return { ...limpa, heroiPostura: 'calado', unidades: [], obras: [], blocosMapa: {}, credito: 0, madeira: 0, ouro: 0 }
  }
  const comBase = (credito = 99, madeira = 99, ouro = 99): PartidaState => ({ ...fundar(CAMPO(), 'nucleo', 0, 30), credito, madeira, ouro })
  const nossa = (s: PartidaState, tipo: Obra['tipo']): Obra => s.obras.find((o) => o.lado !== 'inimigo' && o.tipo === tipo)!

  // 1) O PREÇO: a simulação cobra exatamente `custoDeEvoluir(nível)`, por licença ou por madeira e ouro, e recusa quando falta
  {
    let s = fundar(comBase(), 'torre', 8, 30)
    const id = nossa(s, 'torre').id
    for (let nivel = 1; nivel <= 4; nivel += 1) {
      const preco = custoDeEvoluir(nivel)!
      // por LICENÇA: só licenças, nada de madeira nem ouro
      const comLicencas = evoluir({ ...s, credito: preco.credito, madeira: 0, ouro: 0 }, id)
      assert(comLicencas.obras.find((o) => o.id === id)?.nivel === nivel + 1 && comLicencas.credito === 0, `preço: ${nivel} → ${nivel + 1} por LICENÇA cobra ${preco.credito} e evolui`)
      // uma licença a menos NÃO basta (e sem recursos)
      const quase = evoluir({ ...s, credito: preco.credito - 1, madeira: 0, ouro: 0 }, id)
      assert(quase.obras.find((o) => o.id === id)?.nivel === nivel, `preço: ${nivel} → ${nivel + 1} com ${preco.credito - 1} licença(s) NÃO evolui (custa ${preco.credito})`)
      assert(!podeEvoluir({ ...s, credito: preco.credito - 1, madeira: 0, ouro: 0 }, id).ok, `preço: podeEvoluir também recusa com ${preco.credito - 1} licença(s) no nível ${nivel}`)
      // por RECURSOS: madeira e ouro
      const porRecursos = evoluir({ ...s, credito: 0, madeira: preco.madeira, ouro: preco.ouro }, id)
      assert(porRecursos.obras.find((o) => o.id === id)?.nivel === nivel + 1 && porRecursos.madeira === 0 && porRecursos.ouro === 0, `preço: ${nivel} → ${nivel + 1} por RECURSOS cobra ${preco.madeira} madeiras e ${preco.ouro} ouros`)
      // um de cada a menos NÃO basta
      assert(evoluir({ ...s, credito: 0, madeira: preco.madeira - 1, ouro: preco.ouro }, id).obras.find((o) => o.id === id)?.nivel === nivel, `preço: falta 1 madeira no nível ${nivel}: não evolui`)
      assert(evoluir({ ...s, credito: 0, madeira: preco.madeira, ouro: preco.ouro - 1 }, id).obras.find((o) => o.id === id)?.nivel === nivel, `preço: falta 1 ouro no nível ${nivel}: não evolui`)
      // sobe de verdade para a próxima volta, pagando por licença
      s = evoluir({ ...s, credito: preco.credito, madeira: 0, ouro: 0 }, id)
    }
    assert(s.obras.find((o) => o.id === id)?.nivel === 5, 'preço: depois de 4 evoluções a torre está no nível 5')
    assert(!podeEvoluir({ ...s, credito: 99, madeira: 99, ouro: 99 }, id).ok, 'preço: no nível 5 não se evolui mais, nem com tudo')
  }

  // 2) A VIDA: a vida máxima e a vida atual vão a `vidaMaximaNoNivel(vida do nível 1, nível)` (1,5× por nível), com a vida CHEIA ao evoluir
  {
    let s = fundar(comBase(), 'torre', 8, 30)
    const id = nossa(s, 'torre').id
    const vidaBase = nossa(s, 'torre').maxHp
    assert(vidaBase > 0, 'vida: a torre nasce com vida')
    for (let nivel = 1; nivel <= 4; nivel += 1) {
      s = evoluir(s, id)
      const o = s.obras.find((x) => x.id === id)!
      assert(perto(o.maxHp, vidaMaximaNoNivel(vidaBase, nivel + 1)) && perto(o.hp, o.maxHp), `vida: no nível ${nivel + 1} a vida máxima é ${vidaMaximaNoNivel(vidaBase, nivel + 1)} e a obra sai de cheia (veio hp ${o.hp} / max ${o.maxHp})`)
    }
    // uma obra FERIDA evolui para a vida cheia do novo nível (como era: `hp: novoMax`)
    const ferida = fundar(comBase(), 'quartel', 6, 30)
    const idQ = nossa(ferida, 'quartel').id
    const feridaMeia = { ...ferida, obras: ferida.obras.map((o) => (o.id === idQ ? { ...o, hp: 5 } : o)) }
    const curada = evoluir(feridaMeia, idQ).obras.find((o) => o.id === idQ)!
    assert(perto(curada.hp, curada.maxHp) && curada.maxHp > 5, 'vida: evoluir uma obra ferida a deixa com a vida cheia do novo nível')
  }

  // 3) A TORRE ALCANÇA MAIS QUE O HERÓI e leva a visão dela: o alcance da torre (nossa ou inimiga) vem da tabela
  {
    for (let nivel = 1; nivel <= 5; nivel += 1) {
      assert(alcanceDaTorre({ nivel } as Obra) === alcanceDaTorreNoNivel(nivel), `torre: o alcance do nível ${nivel} vem da tabela (${alcanceDaTorreNoNivel(nivel)})`)
      assert(alcanceDaTorre({ nivel } as Obra) > alcanceDoTiro(0, 0, 0), `torre: no nível ${nivel} a torre alcança MAIS que o tiro do herói (${alcanceDoTiro(0, 0, 0)} m)`)
    }
    assert(alcanceDaTorre({ nivel: 1 } as Obra) >= PARTIDA.visao.heroi, 'torre: a torre do nível 1 alcança pelo menos a visão do herói')
  }

  // NOTA DE CENÁRIO: a torre e o herói ficam em x = 20, FORA da rua. O arco `+10` da rua (x de −1,2 a 1,2, z de 18 a 22) dá +4 de vida uma vez; o 1º cenário deste teste pôs o herói em x = 0, z = 20 e a vida SUBIU 4 em vez
  // de cair (medido por `diag-dano-torre.mjs`: com o herói em z = 5 e z = 0 a vida ficava intacta). O erro era do cenário, não do jogo.
  // 4) A TORRE INIMIGA REVIDA ONDE O HERÓI A FERE: entre 13 e 18 m o herói a feria de graça (medido). Agora a torre inimiga fere o herói em TODA distância em que o herói a fere.
  {
    const inimigoNucleo = createPartida().obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo')!
    for (const d of [8, 12, 13, 15, 17, 18]) {
      const torre: Obra = { id: 900, lado: 'inimigo', tipo: 'torre', x: 20, z: 30, nivel: 1, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 }
      const base = CAMPO()
      const s0: PartidaState = { ...base, obras: [{ ...inimigoNucleo, x: 40, z: 40, cooldown: 1e9 }, torre], heroi: { ...base.heroi, x: 20, z: 30 - d, yaw: 0, pitch: 0, army: 100 } }
      const herFere = atirar(s0).obras.find((o) => o.id === 900)!.hp < 50
      let s = s0
      for (let k = 0; k < 40; k += 1) s = stepPartida(s, INPUT_PARADO, 0.05)
      assert(herFere, `torre: (controle) o herói a ${d} m fere a torre inimiga`)
      assert(s.heroi.army < 100, `torre: a torre inimiga a ${d} m REVIDA (o herói a feria e ela não o ferira: vida ${s.heroi.army})`)
    }
    // e a torre NÃO atira em quem está além do alcance dela (22 m no nível 1): não vira torre que alcança o mapa todo
    const longe: Obra = { id: 901, lado: 'inimigo', tipo: 'torre', x: 20, z: 30, nivel: 1, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 }
    const b2 = CAMPO()
    let s: PartidaState = { ...b2, obras: [{ ...inimigoNucleo, x: 40, z: 40, cooldown: 1e9 }, longe], heroi: { ...b2.heroi, x: 20, z: 30 - 23, yaw: 0, pitch: 0, army: 100 } }
    for (let k = 0; k < 40; k += 1) s = stepPartida(s, INPUT_PARADO, 0.05)
    assert(s.heroi.army === 100, 'torre: a 23 m (além dos 22 m do nível 1) a torre inimiga NÃO atira')
  }

  // 5) O DANO da torre cresce com o nível: um tiro da torre inimiga de nível N tira `danoDaTorreNoNivel(N)` do herói
  {
    const inimigoNucleo = createPartida().obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo')!
    for (const nivel of [1, 3, 5]) {
      const torre: Obra = { id: 902, lado: 'inimigo', tipo: 'torre', x: 20, z: 30, nivel, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 }
      const b = CAMPO()
      const s0: PartidaState = { ...b, obras: [{ ...inimigoNucleo, x: 40, z: 40, cooldown: 1e9 }, torre], heroi: { ...b.heroi, x: 20, z: 30 - 10, yaw: 0, pitch: 0, army: 1000 } }
      const depois = stepPartida(s0, INPUT_PARADO, 0.05)
      // A vida do herói é INTEIRA: o dano de 13,5 (nível 3) tira 14, nunca 13 (a regra `ceil` está dita em voz alta no `partidaSim`)
      const tirou = 1000 - depois.heroi.army
      assert(tirou === Math.ceil(danoDaTorreNoNivel(nivel)), `dano: um tiro da torre inimiga de nível ${nivel} tira ${Math.ceil(danoDaTorreNoNivel(nivel))} (o dano ${danoDaTorreNoNivel(nivel)} arredondado para cima) do herói (tirou ${tirou})`)
    }
    // O MESMO dano vale INTEIRO contra uma TROPA nossa (que tem vida fracionária): a torre inimiga de nível 3 fere a tropa em exatamente 13,5
    const torre3: Obra = { id: 903, lado: 'inimigo', tipo: 'torre', x: 20, z: 30, nivel: 3, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 }
    const b3 = CAMPO()
    const tropa = { id: 904, lado: 'aliado' as const, papel: 'tropa' as const, x: 20, z: 20, hp: 100, postura: 'calado' as const, ordem: null, cooldown: 0, segmentos: [], alerta: true }
    const s3: PartidaState = { ...b3, obras: [{ ...inimigoNucleo, x: 40, z: 40, cooldown: 1e9 }, torre3], unidades: [tropa], heroi: { ...b3.heroi, x: -40, z: -40 } }
    const t3 = stepPartida(s3, INPUT_PARADO, 0.05).unidades.find((u) => u.id === 904)!
    assert(perto(100 - t3.hp, danoDaTorreNoNivel(3)), `dano: a torre inimiga de nível 3 fere a TROPA em ${danoDaTorreNoNivel(3)} exatos (a vida dela é fracionária): feriu ${100 - t3.hp}`)
  }

  // 6) A TROPA recrutada nasce com a vida do nível da obra que a recruta (quartel ou núcleo)
  {
    let s = comBase()
    const idNucleo = nossa(s, 'nucleo').id
    const t1 = criarTropa(s, idNucleo).unidades.find((u) => u.lado === 'aliado')!
    assert(perto(t1.hp, tropaVidaNoNivel(1)) && t1.hp === 16, `tropa: no nível 1 a tropa nasce com 16 de vida (como era; veio ${t1.hp})`)
    for (let k = 0; k < 4; k += 1) s = evoluir(s, idNucleo)
    assert(nossa(s, 'nucleo').nivel === 5, 'tropa: o núcleo chegou ao nível 5')
    const t5 = criarTropa(s, idNucleo).unidades.find((u) => u.lado === 'aliado')!
    assert(perto(t5.hp, tropaVidaNoNivel(5)) && t5.hp > 3 * t1.hp, `tropa: no nível 5 a tropa nasce com ${tropaVidaNoNivel(5)} de vida, mais que o triplo da do nível 1 (veio ${t5.hp})`)
    // um QUARTEL evoluído também: a vida vem do nível da obra que recruta, não do núcleo
    let q = fundar(comBase(), 'quartel', 6, 30)
    const idQ = nossa(q, 'quartel').id
    q = evoluir(evoluir(q, idQ), idQ)
    const tq = criarTropa(q, idQ).unidades.find((u) => u.lado === 'aliado')!
    assert(perto(tq.hp, tropaVidaNoNivel(3)), `tropa: o quartel de nível 3 recruta com ${tropaVidaNoNivel(3)} de vida (veio ${tq.hp}): o núcleo continua no nível 1`)
  }

  // 7) A PRODUÇÃO de serraria e mina cresce com o nível: a madeira e o ouro de um ciclo (6 s) saem de `producaoNoNivel`
  {
    const ciclo = (s: PartidaState, passos = 6.01) => {
      let atual = s
      for (let t = 0; t < passos; t += 0.05) atual = stepPartida(atual, INPUT_PARADO, 0.05)
      return atual
    }
    // SERRARIA sem árvore por perto (produção base 1) e COM árvore (base 2): os dois ramos da produção base
    for (const comArvore of [false, true]) {
      for (const nivel of [1, 3, 5]) {
        let s = fundar(comBase(), 'serraria', 6, 30)
        const id = nossa(s, 'serraria').id
        const arvores = comArvore
          ? [{ id: 7000, tipo: 'arvore' as const, x: 6, z: 33, hp: 10, maxHp: 10, regeneraEm: 0, yBase: 0 }]
          : []
        s = { ...s, credito: 99, recursos: arvores as unknown as PartidaState['recursos'] }
        for (let k = 1; k < nivel; k += 1) s = evoluir(s, id)
        const antes = s.madeira
        const depois = ciclo(s)
        const ganho = depois.madeira - antes
        const esperado = Math.floor(producaoNoNivel(comArvore ? 2 : 1, nivel))
        assert(ganho === esperado, `produção: a serraria de nível ${nivel} ${comArvore ? 'com' : 'sem'} árvore rende ${esperado} madeira(s) por ciclo (rendeu ${ganho})`)
      }
    }
    // MINA: o mesmo, com ouro
    for (const nivel of [1, 5]) {
      let s = fundar(comBase(), 'mina', 6, 30)
      const id = nossa(s, 'mina').id
      s = { ...s, credito: 99, recursos: [] }
      for (let k = 1; k < nivel; k += 1) s = evoluir(s, id)
      const antes = s.ouro
      const ganho = ciclo(s).ouro - antes
      assert(ganho === Math.floor(producaoNoNivel(1, nivel)), `produção: a mina de nível ${nivel} sem ouro por perto rende ${Math.floor(producaoNoNivel(1, nivel))} ouro(s) por ciclo (rendeu ${ganho})`)
    }
    // O RESTO FRACIONÁRIO: a serraria de nível 2 sem árvore rende 1,5 por ciclo. O estoque é inteiro, então a fração (0,5) fica guardada e SOMA no ciclo seguinte: em 4 ciclos (24 s) rende 6, não 4 (1 por ciclo, se a fração
    // se perdesse) nem 8 (2 por ciclo, se arredondasse para cima). Sem este caso nenhum teste via a fração: ela só aparece do 2º ciclo em diante.
    {
      let s = fundar(comBase(), 'serraria', 6, 30)
      const id = nossa(s, 'serraria').id
      s = { ...s, credito: 99, recursos: [] }
      s = evoluir(s, id)
      assert(nossa(s, 'serraria').nivel === 2, 'produção: (arranjo) a serraria está no nível 2')
      const antes = s.madeira
      for (let t = 0; t < 24.05; t += 0.05) s = stepPartida(s, INPUT_PARADO, 0.05)
      assert(s.madeira - antes === 6, `produção: a serraria de nível 2 (1,5 por ciclo) rende 6 madeiras em 4 ciclos, com o resto somando (rendeu ${s.madeira - antes})`)
      assert(perto(s.restoExtracao?.madeira ?? 0, 0), 'produção: depois de 4 ciclos o resto é 0 (1,5 × 4 = 6 exato)')
    }
    // E a MINA de nível 2 com o mesmo resto (ouro), em outro mapa de estado: 3 ciclos = 4,5 → 4 ouros e resto 0,5
    {
      let s = fundar(comBase(), 'mina', 6, 30)
      const id = nossa(s, 'mina').id
      s = { ...s, credito: 99, recursos: [] }
      s = evoluir(s, id)
      const antes = s.ouro
      for (let t = 0; t < 18.05; t += 0.05) s = stepPartida(s, INPUT_PARADO, 0.05)
      assert(s.ouro - antes === 4 && perto(s.restoExtracao?.ouro ?? -1, 0.5), `produção: a mina de nível 2 rende 4 ouros em 3 ciclos e guarda o resto 0,5 (rendeu ${s.ouro - antes}, resto ${s.restoExtracao?.ouro})`)
    }
    assert(perto(fatorDoNivel(5), 5.0625), 'produção: (controle) o fator do nível 5 é 5,0625')
  }
}
