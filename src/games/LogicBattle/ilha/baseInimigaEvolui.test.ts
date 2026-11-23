import { alcanceDaTorreNoNivel, danoDaTorreNoNivel } from './evolucaoObra'
import { PARTIDA } from './partidaPolicies'
import { createPartida, evoluirInimigo, INPUT_PARADO, nivelDaBaseInimiga, Obra, PartidaState, quantidadeDaLeva, stepPartida } from './partidaSim'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * A BASE INIMIGA EVOLUI E RECRUTA MAIS (pedido do usuário, 23/11: «os inimigos da base inimiga também devem evoluir, e ele recrutar mais inimigos»; escolhas dele: «núcleo e peças evoluem pela mesma tabela» e «a leva cresce com o
 * nível do núcleo»). MEDIDO antes (`medir-base-inimiga.mjs`, 23/11, 600 s): o `nivel` do núcleo inimigo subia 1 por onda (Nv24 na onda 24) mas NADA o lia, as peças ficavam todas no nível 1 (hp 50/40) e cada leva trazia 1 sitiante.
 *
 * Desenho [D-minha]: o `nivel` do NÚCLEO inimigo continua sendo o marcador do ESTÁGIO (a onda: o M2 copia o vizinho por ele, e 12 testes o leem); o que cresce é o NÍVEL DA TABELA, `min(5, 1 + floor(estágio / 3))`, que decide a força:
 * o nível das PEÇAS inimigas novas (torre com mais dano e alcance pela tabela) e o tamanho da LEVA, `1 + floor((nível − 1) / 2)`. A vida das peças NÃO muda (o M2.b a M2.e fixa 50/40 e os fatores de camada).
 */
export function run(): void {
  // 1) o NÍVEL DA TABELA do estágio: 1 a 5, sobe a cada 3 ondas, com teto
  const esperado: Array<[number, number]> = [[0, 1], [1, 1], [2, 1], [3, 2], [5, 2], [6, 3], [8, 3], [9, 4], [11, 4], [12, 5], [20, 5], [40, 5], [1000, 5]]
  for (const [estagio, nivel] of esperado) assert(nivelDaBaseInimiga(estagio) === nivel, `nível da base inimiga: o estágio ${estagio} é nível ${nivel} (veio ${nivelDaBaseInimiga(estagio)})`)
  for (const sujo of [Number.NaN, -3, Number.NEGATIVE_INFINITY, 0.5]) assert(nivelDaBaseInimiga(sujo) === 1, `nível da base inimiga: o estágio ${sujo} vale como o nível 1`)
  assert(nivelDaBaseInimiga(Number.POSITIVE_INFINITY) === 5, 'nível da base inimiga: o estágio infinito vale o teto (5), nunca NaN')
  for (let e = 1; e <= 60; e += 1) assert(nivelDaBaseInimiga(e) >= nivelDaBaseInimiga(e - 1), `nível da base inimiga: nunca desce de um estágio para o outro (${e - 1} → ${e})`)

  // 2) a LEVA cresce com o nível: 1 no nível 1 e 2, 2 no nível 3 e 4, 3 no nível 5; a PRIMEIRA onda segue com `levaPrimeira` (4)
  const leva: Array<[number, number]> = [[2, 1], [3, 1], [5, 1], [6, 2], [9, 2], [12, 3], [40, 3]]
  for (const [onda, n] of leva) assert(quantidadeDaLeva(onda) === n, `leva: a onda ${onda} traz ${n} inimigo(s) (veio ${quantidadeDaLeva(onda)})`)
  assert(quantidadeDaLeva(1) === PARTIDA.levaPrimeira && PARTIDA.levaPrimeira === 4, 'leva: a PRIMEIRA onda traz sempre `levaPrimeira` (4), como era')
  assert(quantidadeDaLeva(2) === PARTIDA.levaSeguinte, 'leva: a onda 2 ainda traz `levaSeguinte` (1): o M2 (a quantidade NÃO se multiplica no clone) segue verdadeiro nos estágios baixos')
  for (const sujo of [Number.NaN, -1, 0, Number.NEGATIVE_INFINITY]) assert(quantidadeDaLeva(sujo) >= 1 && Number.isInteger(quantidadeDaLeva(sujo)), `leva: a onda ${sujo} nunca dá zero, fração nem NaN (veio ${quantidadeDaLeva(sujo)})`)

  // 2b) a quantidade LÊ as constantes da PARTIDA (e não números soltos): mudando `levaPrimeira` e `levaSeguinte` a função acompanha. (A mutação mostrou que um `quantidadeDaLeva` que fixasse 4 e 1 passava em verde: os
  // valores de hoje coincidem com os fixos.) A prova de que ela LÊ a constante é mudar a constante e ver a função reagir, como o A4 antigo fazia com o preço.
  {
    const mutavel = PARTIDA as unknown as { levaPrimeira: number; levaSeguinte: number }
    const original = { levaPrimeira: mutavel.levaPrimeira, levaSeguinte: mutavel.levaSeguinte }
    try {
      mutavel.levaPrimeira = 7
      mutavel.levaSeguinte = 2
      assert(quantidadeDaLeva(1) === 7, 'leva: a primeira onda lê `PARTIDA.levaPrimeira` (7)')
      assert(quantidadeDaLeva(2) === 2 && quantidadeDaLeva(6) === 3 && quantidadeDaLeva(12) === 4, `leva: as seguintes leem \`PARTIDA.levaSeguinte\` (2) e somam o crescimento do nível (onda 2: 2, onda 6: 3, onda 12: 4); veio ${quantidadeDaLeva(2)}/${quantidadeDaLeva(6)}/${quantidadeDaLeva(12)}`)
    } finally {
      mutavel.levaPrimeira = original.levaPrimeira
      mutavel.levaSeguinte = original.levaSeguinte
    }
    assert(PARTIDA.levaPrimeira === 4 && PARTIDA.levaSeguinte === 1, 'leva: o teste restaurou as constantes')
  }

  // 3) NO JOGO: a onda 6 (nível 3) traz 2 sitiantes, a onda 12 (nível 5) traz 3, e a base ganha peças com o NÍVEL da tabela
  const longeDeTudo = (s: PartidaState): PartidaState => ({ ...s, heroiPostura: 'calado', heroi: { ...s.heroi, x: -30, z: -30, army: 999999 }, semCorpo: false })
  const sitiantesNovos = (antes: PartidaState, depois: PartidaState) => depois.unidades.filter((u) => u.papel === 'sitiante' && !antes.unidades.some((a) => a.id === u.id))
  const proximaOnda = (s: PartidaState): PartidaState => {
    let atual = { ...s, ondaRelogio: PARTIDA.ondaPeriodo - 0.05 }
    atual = stepPartida(atual, INPUT_PARADO, 0.1)
    return atual
  }
  {
    let s = longeDeTudo(createPartida())
    s = { ...s, unidades: [] }
    for (const [onda, n] of [[1, 4], [2, 1], [4, 1], [5, 1], [7, 2], [8, 2], [10, 2], [11, 2], [13, 3], [14, 3]] as const) {
      const antes = { ...s, ondaNumero: onda - 1, unidades: [] }
      const depois = proximaOnda(antes)
      const novos = sitiantesNovos(antes, depois)
      assert(depois.ondaNumero === onda, `jogo: (arranjo) a onda ${onda} disparou (veio ${depois.ondaNumero})`)
      assert(novos.length === n, `jogo: a onda ${onda} traz ${n} sitiante(s) (trouxe ${novos.length})`)
    }
    // a leva não passa do limite de inimigos vivos do mapa (12): o limite continua valendo
    const cheio = { ...s, ondaNumero: 11, unidades: Array.from({ length: 11 }, (_, k) => ({ id: 8000 + k, lado: 'inimigo' as const, papel: 'sitiante' as const, x: 40, z: 40, hp: 99, postura: 'automatico' as const, ordem: null, cooldown: 0, segmentos: [] as number[], alerta: true })) }
    const depoisCheio = proximaOnda(cheio)
    assert(depoisCheio.unidades.filter((u) => u.lado === 'inimigo' && u.hp > 0).length <= PARTIDA.enemyCap, `jogo: a leva maior NUNCA passa do limite de ${PARTIDA.enemyCap} inimigos vivos`)
  }

  // 4) as PEÇAS inimigas nascem com o nível da tabela do estágio (a torre inimiga com mais dano e alcance), e o NÚCLEO segue marcando o estágio
  {
    const estagio = (n: number): PartidaState => evoluirInimigo(createPartida(), 1, n)
    const pecasDe = (s: PartidaState): Obra[] => s.obras.filter((o) => o.lado === 'inimigo' && o.tipo !== 'nucleo')
    const nucleoDe = (s: PartidaState): Obra => s.obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo')!
    assert(pecasDe(estagio(2)).every((o) => o.nivel === 1), 'peças: no estágio 2 (nível 1) a peça é nível 1')
    assert(pecasDe(estagio(6)).length === 3 && pecasDe(estagio(6)).every((o) => o.nivel >= 1 && o.nivel <= 3), 'peças: no estágio 6 as peças vão até o nível 3')
    assert(pecasDe(estagio(6)).some((o) => o.nivel === 3), 'peças: no estágio 6 a peça mais nova nasce no nível 3 (o da tabela)')
    assert(pecasDe(estagio(40)).every((o) => o.nivel <= 5), 'peças: nenhuma peça passa do nível 5 (o teto da tabela), mesmo no estágio 40')
    assert(pecasDe(estagio(40)).some((o) => o.nivel === 5), 'peças: no estágio 40 as peças novas estão no nível 5')
    assert(nucleoDe(estagio(8)).nivel === 8 && nucleoDe(estagio(40)).nivel === 40, 'núcleo: o `nivel` do núcleo inimigo continua marcando o ESTÁGIO (o M2 copia por ele)')
    // a vida das peças NÃO muda com o nível (o M2.b a M2.e fixa 50 para a torre e 40 para as outras)
    assert(pecasDe(estagio(8)).every((o) => o.hp === o.maxHp && o.hp === (o.tipo === 'torre' ? 50 : 40)), 'peças: a vida da torre (50) e das outras peças (40) NÃO muda com o nível (o contrato do M2)')
  }

  // 5) a torre inimiga de nível 5 FERE MAIS e ALCANÇA MAIS que a de nível 1: a tabela vale para o lado inimigo
  {
    const heroiAlvo = (d: number, nivel: number): PartidaState => {
      const base = longeDeTudo(createPartida())
      const nuc = base.obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo')!
      const torre: Obra = { id: 905, lado: 'inimigo', tipo: 'torre', x: 20, z: 30, nivel, hp: 50, maxHp: 50, gateApplied: false, cooldown: 0 }
      return { ...base, unidades: [], obras: [{ ...nuc, x: 40, z: 40, cooldown: 1e9 }, torre], heroi: { ...base.heroi, x: 20, z: 30 - d, army: 1000 } }
    }
    const vidaDepois = (s: PartidaState) => stepPartida(s, INPUT_PARADO, 0.05).heroi.army
    assert(1000 - vidaDepois(heroiAlvo(10, 1)) === Math.ceil(danoDaTorreNoNivel(1)) && 1000 - vidaDepois(heroiAlvo(10, 5)) === Math.ceil(danoDaTorreNoNivel(5)), 'torre inimiga: o dano do nível 5 é o da tabela (muito acima do nível 1)')
    assert(vidaDepois(heroiAlvo(25, 1)) === 1000 && vidaDepois(heroiAlvo(25, 5)) < 1000, `torre inimiga: a 25 m a de nível 1 (alcance ${alcanceDaTorreNoNivel(1)}) não fere e a de nível 5 (alcance ${alcanceDaTorreNoNivel(5)}) fere`)
  }

  // 6) o QUE NÃO MUDA: o fator de camada (vida) não multiplica a quantidade da leva, e sem base inimiga não nasce nada
  {
    const novo = evoluirInimigo(createPartida(), 4, 4)
    const antes = { ...longeDeTudo(novo), unidades: [], ondaNumero: 1 }
    const depois = proximaOnda(antes)
    assert(sitiantesNovos(antes, depois).length === quantidadeDaLeva(2), 'leva: o FATOR de camada (4×) não multiplica a quantidade: a onda 2 traz o mesmo número de sempre (a decisão do usuário, 22/11)')
  }
}
