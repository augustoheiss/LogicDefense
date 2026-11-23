import { custoDeEvoluir, descricaoDaEvolucao, NIVEL_MAXIMO } from './evolucaoObra'
import { linhasDaLista, resumoDaBase, type ObraDaLista, type RecursosDaLista } from './listaDeConstrucoes'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * A LISTA VERTICAL DE CONSTRUÇÕES (pedido do usuário, 23/11): «o status dos seus edifícios não é pra ficar mostrando horizontalmente na tela do jogo tudo o que você tem naquele minimapa, mas podemos fazer um filtro vertical que ao
 * clicar aparece as suas construções e o que você quer evoluir». MEDIDO antes (23/11): a linha de status juntava, numa linha só com reticências, o núcleo, a vida, as tropas, os alertas e o nível de CADA obra («Núcleo da Cidadela Nv. 1 ·
 * Torre de Vigia e Cerco Nv. 1 · ...»), e cortava o que passava de ~900 px. Esta é a LÓGICA PURA da lista (que linhas, em que ordem, o que cada uma diz e se dá para evoluir), sem React: a tela só desenha o que ela devolve.
 */
export function run(): void {
  const o = (id: number, tipo: ObraDaLista['tipo'], nivel: number, hp: number, maxHp: number, extra: Partial<ObraDaLista> = {}): ObraDaLista => ({ id, lado: 'nosso', tipo, nivel, hp, maxHp, construindoRestante: 0, ...extra })
  const rico: RecursosDaLista = { credito: 99, madeira: 99, ouro: 99 }
  const pobre: RecursosDaLista = { credito: 0, madeira: 0, ouro: 0 }

  // 1) só as obras NOSSAS e VIVAS entram; ruína e obra inimiga ficam de fora
  {
    const obras: ObraDaLista[] = [o(1, 'nucleo', 1, 100, 100), o(2, 'torre', 2, 75, 75), o(3, 'quartel', 1, 0, 50), { ...o(4, 'torre', 1, 50, 50), lado: 'inimigo' }]
    const linhas = linhasDaLista(obras, rico)
    assert(linhas.length === 2 && linhas.every((l) => l.id === 1 || l.id === 2), `lista: só as obras nossas e vivas (2), sem a ruína nem a inimiga (veio ${linhas.map((l) => l.id)})`)
    assert(linhasDaLista([], rico).length === 0 && linhasDaLista([o(9, 'nucleo', 1, 0, 100)], rico).length === 0, 'lista: sem obra viva a lista é vazia (o painel mostra «sem construções»)')
  }

  // 2) a ORDEM: o núcleo primeiro, depois as outras por tipo e por id (estável): o jogador acha sempre no mesmo lugar
  {
    const obras: ObraDaLista[] = [o(7, 'mina', 1, 50, 50), o(3, 'torre', 1, 50, 50), o(1, 'nucleo', 1, 100, 100), o(5, 'quartel', 1, 50, 50), o(4, 'torre', 3, 50, 50)]
    const ids = linhasDaLista(obras, rico).map((l) => l.id)
    assert(ids[0] === 1, 'lista: o núcleo é sempre a primeira linha')
    assert(JSON.stringify(ids) === JSON.stringify([1, 3, 4, 5, 7]), `lista: depois do núcleo, torres (por id), quartel, mina: a ordem é estável (veio ${ids})`)
    const embaralhado = linhasDaLista([...obras].reverse(), rico).map((l) => l.id)
    assert(JSON.stringify(embaralhado) === JSON.stringify(ids), 'lista: a ordem NÃO depende da ordem em que as obras chegam')
  }

  // 3) cada linha diz o que a obra é, em que nível está, quanta vida tem (inteira) e o que o PRÓXIMO nível dá, com o MESMO texto e preço da tabela
  {
    const l = linhasDaLista([o(2, 'torre', 2, 74.6, 75)], rico)[0]
    assert(l.nivel === 2 && l.nivelMaximo === false, 'linha: a torre está no nível 2 e ainda evolui')
    assert(Number.isInteger(l.vida) && Number.isInteger(l.vidaMaxima), 'linha: a vida e a vida máxima mostradas são INTEIRAS (74,6 vira 74, nunca 74,6)')
    assert(l.vida === 74, 'linha: a vida mostrada arredonda para BAIXO (nunca mostra mais vida do que a obra tem)')
    assert(l.ganho === descricaoDaEvolucao('torre', 2), 'linha: «o que o próximo nível dá» é o texto da tabela (uma fonte só)')
    assert(JSON.stringify(l.preco) === JSON.stringify(custoDeEvoluir(2)), 'linha: o preço é o da tabela para o nível da obra (nível 2 → 3)')
    assert(typeof l.titulo === 'string' && l.titulo.length > 0, 'linha: tem um título legível')
  }

  // 4) PODE EVOLUIR: por licença OU por madeira+ouro; o motivo aparece quando não pode
  {
    const so = (r: RecursosDaLista, nivel = 1) => linhasDaLista([o(2, 'torre', nivel, 50, 50)], r)[0]
    const p1 = custoDeEvoluir(1)!
    assert(so({ credito: p1.credito, madeira: 0, ouro: 0 }).podeEvoluir === true, 'pode: com as licenças do preço, evolui')
    assert(so({ credito: 0, madeira: p1.madeira, ouro: p1.ouro }).podeEvoluir === true, 'pode: com a madeira e o ouro do preço, evolui')
    assert(so({ credito: p1.credito - 1, madeira: 0, ouro: 0 }).podeEvoluir === false, 'pode: uma licença a menos não basta')
    assert(so({ credito: 0, madeira: p1.madeira - 1, ouro: p1.ouro }).podeEvoluir === false, 'pode: uma madeira a menos não basta')
    assert(so({ credito: 0, madeira: p1.madeira, ouro: p1.ouro - 1 }).podeEvoluir === false, 'pode: um ouro a menos não basta')
    assert(so({ credito: 0, madeira: 99, ouro: 0 }).podeEvoluir === false, 'pode: só madeira (sem ouro) não paga')
    assert(so(pobre).motivo !== undefined && /licen/i.test(so(pobre).motivo!), 'pode: sem recursos o MOTIVO fala em licença/recursos (o jogador sabe o que falta)')
    assert(so(rico).motivo === undefined, 'pode: quando pode, não há motivo')
    // o PREÇO acompanha o nível: no nível 3 custa mais que no 1
    const p3 = custoDeEvoluir(3)!
    assert(so({ credito: p1.credito, madeira: 0, ouro: 0 }, 3).podeEvoluir === false && so({ credito: p3.credito, madeira: 0, ouro: 0 }, 3).podeEvoluir === true, 'pode: a licença do nível 1 não paga o nível 3 (o preço sobe 1,5×)')
  }

  // 5) NÍVEL MÁXIMO: sem próximo nível, sem preço, sem botão
  {
    const l = linhasDaLista([o(2, 'torre', NIVEL_MAXIMO, 300, 300)], rico)[0]
    assert(l.nivelMaximo === true && l.preco === null && l.ganho === null && l.podeEvoluir === false, 'máximo: no nível 5 a linha não tem preço, nem ganho, nem botão')
  }

  // 6) OBRA EM CONSTRUÇÃO: aparece (o jogador a vê) mas NÃO evolui, e diz por quê
  {
    const l = linhasDaLista([o(2, 'torre', 1, 50, 50, { construindoRestante: 3 })], rico)[0]
    assert(l.emConstrucao === true && l.podeEvoluir === false && /constru/i.test(l.motivo ?? ''), 'construção: a obra em andaime aparece, não evolui e o motivo fala em construção')
    assert(linhasDaLista([o(2, 'torre', 1, 50, 50)], rico)[0].emConstrucao === false, 'construção: a obra pronta não está em construção')
  }

  // 7) VIDA fraca: uma obra abaixo de metade da vida é marcada (o jogador vê o que precisa de reparo)
  {
    const inteira = linhasDaLista([o(2, 'torre', 1, 50, 50)], rico)[0]
    const fraca = linhasDaLista([o(2, 'torre', 1, 20, 50)], rico)[0]
    const quase = linhasDaLista([o(2, 'torre', 1, 25, 50)], rico)[0]
    assert(inteira.fraca === false && fraca.fraca === true && quase.fraca === false, 'vida: marca «frágil» abaixo de metade da vida máxima (exatamente metade ainda não)')
  }

  // 8) entradas sujas nunca viram NaN, texto «undefined» ou linha quebrada
  {
    const sujas = [o(1, 'nucleo', Number.NaN, Number.NaN, Number.NaN), o(2, 'torre', -2, -5, 0), o(3, 'mina', 99, 1e9, 0)]
    const linhas = linhasDaLista(sujas, { credito: Number.NaN, madeira: -1, ouro: Number.POSITIVE_INFINITY })
    for (const l of linhas) {
      assert(Number.isFinite(l.vida) && Number.isFinite(l.vidaMaxima) && l.vida >= 0 && l.vidaMaxima >= 0, `sujo: a vida da obra ${l.id} nunca é NaN, infinita nem negativa`)
      assert(Number.isInteger(l.nivel) && l.nivel >= 1 && l.nivel <= NIVEL_MAXIMO, `sujo: o nível da obra ${l.id} é um inteiro de 1 a ${NIVEL_MAXIMO} (veio ${l.nivel})`)
      assert(!/undefined|NaN|null/.test(`${l.titulo} ${l.ganho ?? ''} ${l.motivo ?? ''}`), `sujo: nenhum texto da obra ${l.id} contém «undefined», «NaN» ou «null»`)
    }
    assert(linhasDaLista(sujas, { credito: Number.NaN, madeira: Number.NaN, ouro: Number.NaN }).every((l) => l.podeEvoluir === false), 'sujo: recursos NaN nunca deixam evoluir')
  }

  // 9) o RESUMO da base (o que a linha horizontal dizia antes, agora no topo do painel): vida do núcleo, tropas, alerta de construção
  {
    const obras: ObraDaLista[] = [o(1, 'nucleo', 1, 100.9, 100), o(2, 'torre', 1, 50, 50, { construindoRestante: 2 })]
    const r = resumoDaBase(obras, { tropas: 3, emOrdens: 1, emVigia: 2, levaEm: 14, dragao: false })
    assert(r.temBase === true && r.vidaDoNucleo === 100, `resumo: a vida do núcleo é um inteiro (veio ${r.vidaDoNucleo})`)
    assert(r.tropas === 3 && r.emOrdens === 1 && r.emVigia === 2, 'resumo: tropas, em ordens e em vigia')
    assert(r.emObras === 1, 'resumo: conta as obras em construção (frágeis)')
    assert(r.levaEm === 14, 'resumo: o contador da próxima leva é o que veio')
    // OS AVISOS que a linha horizontal antiga trazia («sem caminho», «Núcleo inimigo destruído · sem novas levas», o dragão) NÃO somem: viram dados do resumo, para o painel mostrar
    assert(r.semCaminho === false && r.nucleoInimigoCaiu === false, 'resumo: sem aviso de rota nem de núcleo inimigo quando nada disso acontece')
    const comAvisos = resumoDaBase(obras, { tropas: 3, emOrdens: 1, emVigia: 2, levaEm: null, dragao: true, semCaminho: true, nucleoInimigoCaiu: true })
    assert(comAvisos.semCaminho === true && comAvisos.nucleoInimigoCaiu === true && comAvisos.dragao === true, 'resumo: os avisos «sem caminho», «núcleo inimigo destruído» e «dragão» chegam ao painel')
    const semBase = resumoDaBase([], { tropas: 0, emOrdens: 0, emVigia: 0, levaEm: null, dragao: false })
    assert(semBase.temBase === false && semBase.vidaDoNucleo === 0 && semBase.baseDestruida === false, 'resumo: sem núcleo nenhum, «sem base» (e não «base destruída»)')
    const ruina = resumoDaBase([o(1, 'nucleo', 1, 0, 100)], { tropas: 0, emOrdens: 0, emVigia: 0, levaEm: null, dragao: false })
    assert(ruina.temBase === false && ruina.baseDestruida === true, 'resumo: um núcleo caído é «base destruída»')
  }
}
