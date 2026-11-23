import {
  alcanceDaTorreNoNivel,
  custoDeEvoluir,
  descricaoDaEvolucao,
  danoDaTorreNoNivel,
  FATOR_POR_NIVEL,
  fatorDoNivel,
  NIVEL_MAXIMO,
  producaoNoNivel,
  tropaVidaNoNivel,
  vidaMaximaNoNivel,
} from './evolucaoObra'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9

/**
 * A TABELA DE EVOLUÇÃO (pedido do usuário, 23/11): «as vezes eu nao sinto que evoluir as coisas pro nivel 5 faz alguma diferenca [...] Seria legal que as evolucoes ficassem mais caras tambem, como elas vao ser melhores,
 * tipo 1,5 vezes mais caro e proporcionalmente melhores». MEDIDO antes de escrever isto (23/11): o nível só mudava a VIDA MÁXIMA (+30 no Nv4, +50 no Nv5), o alcance (+2 m por nível) e o dano (+1 por nível) da torre; serraria, mina,
 * quartel e núcleo produziam e recrutavam IGUAL no nível 1 e no 5; o preço era fixo (1 licença, ou 2 madeiras e 2 ouros) em qualquer nível.
 *
 * Regra [D-minha, o usuário ajusta]: cada nível custa 1,5× o anterior e rende 1,5× o anterior, na MESMA proporção: o preço de ir ao nível N+1 e o ganho do nível N+1 crescem com o mesmo fator. Tudo vive num módulo puro
 * (`evolucaoObra.ts`) para a simulação, o painel e a tela da lista lerem a MESMA tabela: o preço que o jogador lê é o que a simulação cobra.
 */
export function run(): void {
  // o fator e o teto
  assert(FATOR_POR_NIVEL === 1.5, 'evolução: o fator por nível é 1,5 (o pedido do usuário)')
  assert(NIVEL_MAXIMO === 5, 'evolução: o nível máximo é 5')
  assert(fatorDoNivel(1) === 1 && perto(fatorDoNivel(2), 1.5) && perto(fatorDoNivel(3), 2.25) && perto(fatorDoNivel(4), 3.375) && perto(fatorDoNivel(5), 5.0625), 'evolução: o fator do nível N é 1,5^(N−1): 1, 1,5, 2,25, 3,375, 5,0625')

  // entradas sujas nunca produzem NaN, infinito nem negativo: viram o nível 1 (ou o 5, no teto)
  for (const sujo of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -3, 0, 0.4]) {
    assert(fatorDoNivel(sujo) === 1, `evolução: o nível ${sujo} vale como o nível 1 (fator 1)`)
  }
  assert(fatorDoNivel(99) === fatorDoNivel(5), 'evolução: acima do teto vale o nível 5 (não cresce sem fim)')
  assert(fatorDoNivel(2.9) === fatorDoNivel(2), 'evolução: nível fracionário arredonda para baixo')

  // O CUSTO de subir do nível N para o N+1: 1,5× o anterior, sempre inteiro (arredonda PARA CIMA: nunca sai de graça) e nunca menor que o do nível anterior
  // `custoDeEvoluir` devolve `null` no nível máximo: nos níveis 1 a 4 TEM de haver preço (`preco` falha o teste, com mensagem, se vier `null`)
  const preco = (nivel: number) => {
    const c = custoDeEvoluir(nivel)
    assert(c !== null, `evolução: do nível ${nivel} existe um preço (veio null)`)
    return c
  }
  const c1 = preco(1)
  assert(c1.credito === 1 && c1.madeira === 2 && c1.ouro === 2, `evolução: do nível 1 ao 2 custa o de hoje (1 licença, ou 2 madeiras e 2 ouros): veio ${JSON.stringify(c1)}`)
  const esperado = [
    { credito: 2, madeira: 3, ouro: 3 }, // 1,5 → 2 ; 3 ; 3
    { credito: 3, madeira: 5, ouro: 5 }, // 2,25 → 3 ; 4,5 → 5
    { credito: 4, madeira: 7, ouro: 7 }, // 3,375 → 4 ; 6,75 → 7
  ]
  for (let nivel = 2; nivel <= 4; nivel += 1) {
    const c = preco(nivel)
    const e = esperado[nivel - 2]
    assert(c.credito === e.credito && c.madeira === e.madeira && c.ouro === e.ouro, `evolução: do nível ${nivel} ao ${nivel + 1} custa ${JSON.stringify(e)} (veio ${JSON.stringify(c)})`)
  }
  for (let nivel = 1; nivel < 4; nivel += 1) {
    const a = preco(nivel)
    const b = preco(nivel + 1)
    assert(b.credito >= a.credito && b.madeira >= a.madeira && b.ouro >= a.ouro, `evolução: o preço nunca cai de um nível para o outro (${nivel} → ${nivel + 1})`)
  }
  assert(custoDeEvoluir(5) === null, 'evolução: do nível 5 não se evolui mais (não há preço)')
  assert(preco(Number.NaN).credito === 1, 'evolução: um nível sujo cobra o preço do nível 1')

  // O GANHO: a vida máxima, o dano, a produção e a vida da tropa recrutada crescem com o MESMO fator do preço
  for (let nivel = 1; nivel <= 5; nivel += 1) {
    const f = fatorDoNivel(nivel)
    assert(perto(vidaMaximaNoNivel(50, nivel), 50 * f), `evolução: a vida máxima do nível ${nivel} é 50 × ${f}`)
    assert(perto(danoDaTorreNoNivel(nivel), 7 * f), `evolução: o dano da torre do nível ${nivel} é 7 × ${f}`)
    assert(perto(tropaVidaNoNivel(nivel), 16 * f), `evolução: a tropa recrutada no nível ${nivel} nasce com 16 × ${f} de vida`)
    assert(perto(producaoNoNivel(2, nivel), 2 * f), `evolução: a produção da serraria/mina no nível ${nivel} é 2 × ${f}`)
  }
  assert(perto(vidaMaximaNoNivel(100, 1), 100) && perto(vidaMaximaNoNivel(100, 5), 506.25), 'evolução: a vida máxima parte da base de cada obra (100 no núcleo)')

  // entradas sujas na BASE: nunca viram NaN, infinito nem negativo (um `NaN` que passasse envenenaria a vida da obra e o estoque de recursos para sempre)
  for (const sujo of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5, 0]) {
    assert(vidaMaximaNoNivel(sujo, 3) === 0, `evolução: a vida máxima com base ${sujo} é 0 (nunca NaN nem infinito)`)
    assert(producaoNoNivel(sujo, 3) === 0, `evolução: a produção com base ${sujo} é 0 (nunca NaN nem infinito)`)
  }

  // O ALCANCE da torre: 22 m (a visão dela) no nível 1, +2 m por nível, e SEMPRE maior que o alcance do herói (18 m)
  assert(alcanceDaTorreNoNivel(1) === 22, `evolução: a torre do nível 1 alcança 22 m, a visão dela (veio ${alcanceDaTorreNoNivel(1)})`)
  assert(alcanceDaTorreNoNivel(5) === 30, 'evolução: a torre do nível 5 alcança 30 m (+2 m por nível)')
  for (let nivel = 1; nivel <= 5; nivel += 1) {
    assert(alcanceDaTorreNoNivel(nivel) > 18, `evolução: a torre do nível ${nivel} alcança mais que o herói (18 m)`)
    if (nivel > 1) assert(alcanceDaTorreNoNivel(nivel) > alcanceDaTorreNoNivel(nivel - 1), `evolução: subir ao nível ${nivel} aumenta o alcance da torre`)
  }

  // CADA nível seguinte é melhor em TUDO que a tabela mede (a queixa: «nao sinto que evoluir faz diferenca»)
  for (let nivel = 2; nivel <= 5; nivel += 1) {
    assert(vidaMaximaNoNivel(50, nivel) > vidaMaximaNoNivel(50, nivel - 1), `evolução: o nível ${nivel} tem mais vida que o ${nivel - 1}`)
    assert(danoDaTorreNoNivel(nivel) > danoDaTorreNoNivel(nivel - 1), `evolução: o nível ${nivel} dá mais dano que o ${nivel - 1}`)
    assert(producaoNoNivel(2, nivel) > producaoNoNivel(2, nivel - 1), `evolução: o nível ${nivel} produz mais que o ${nivel - 1}`)
    assert(tropaVidaNoNivel(nivel) > tropaVidaNoNivel(nivel - 1), `evolução: o nível ${nivel} recruta tropa mais forte que o ${nivel - 1}`)
  }

  // O TEXTO do que cada nível dá (a tela da lista e o painel leem daqui): fala do que muda DE VERDADE para cada tipo de obra, e o número é o da tabela
  const torre = descricaoDaEvolucao('torre', 1)
  assert(torre !== null && /alcance/i.test(torre) && /dano/i.test(torre) && torre.includes(String(alcanceDaTorreNoNivel(2))), `evolução: a descrição da torre fala de alcance e dano, e traz o alcance do próximo nível (${alcanceDaTorreNoNivel(2)}): veio ${torre}`)
  const serraria = descricaoDaEvolucao('serraria', 1)
  assert(serraria !== null && /madeira/i.test(serraria), `evolução: a descrição da serraria fala de madeira (veio ${serraria})`)
  const mina = descricaoDaEvolucao('mina', 1)
  assert(mina !== null && /ouro/i.test(mina), `evolução: a descrição da mina fala de ouro (veio ${mina})`)
  const quartel = descricaoDaEvolucao('quartel', 1)
  assert(quartel !== null && /tropa/i.test(quartel), `evolução: a descrição do quartel fala de tropa (veio ${quartel})`)
  const nucleo = descricaoDaEvolucao('nucleo', 1)
  assert(nucleo !== null && /tropa/i.test(nucleo) && /vida/i.test(nucleo), `evolução: a descrição do núcleo fala de tropa e vida (veio ${nucleo})`)
  for (const tipo of ['portao', 'britador'] as const) {
    const d = descricaoDaEvolucao(tipo, 1)
    assert(d !== null && /vida/i.test(d), `evolução: ${tipo} também fica mais forte (vida): veio ${d}`)
  }
  assert(descricaoDaEvolucao('torre', 5) === null, 'evolução: no nível máximo não há «próximo nível» para descrever')
}
