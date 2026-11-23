import { ALCANCE_ALEM, caixasDaBorda, destinoDoClique, LARGURA_DA_FAIXA } from './destinoDoClique'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * Como o jogador manda uma tropa para OUTRO mapa (pedido do usuário, 23/11: «pode fazer tropas atravessar de mapa»; escolha dele, AskUserQuestion: «clicar na borda do chão manda atravessar»). O chão clicável
 * tem exatamente o tamanho do mapa (112 × 112), então um clique nunca devolve um ponto de fora: sem um gesto, a travessia (M5) ficava implementada mas sem botão. Medido: `ordenar` nunca era chamado com destino fora.
 *
 * Regra [D-minha]: os últimos `LARGURA_DA_FAIXA` m de cada lado do quadrado são uma FAIXA: um clique ali vira «ir para o mapa vizinho daquele lado». O destino é empurrado para fora (até `ALCANCE_ALEM` m
 * além da borda), mantendo o OUTRO eixo, para a tropa chegar ao vizinho na mesma linha; nos cantos os dois eixos saem (diagonal). Fora da faixa nada muda: o clique é «andar até ali», como sempre foi.
 */
export function run(): void {
  const MEIO = 56
  assert(LARGURA_DA_FAIXA === 3, 'faixa: a largura da faixa é 3 m (do 53 ao 56)')
  assert(ALCANCE_ALEM === 8, 'faixa: o destino de fora fica 8 m além da borda (x = 64)')

  // centro do mapa e tudo que não toca a faixa: NADA muda (o clique é andar até ali)
  for (const [x, z] of [[0, 0], [20, -30], [-40, 10], [52.9, 0], [0, -52.9], [52.99, 52.99], [-52.99, 40]] as const) {
    const d = destinoDoClique(x, z)
    assert(d.alem === false && d.x === x && d.z === z, `faixa: o clique (${x}, ${z}) está FORA da faixa: continua sendo andar até ali (veio ${JSON.stringify(d)})`)
  }

  // os 4 lados: dentro da faixa, o eixo da faixa vai para além da borda e o outro eixo se mantém
  const leste = destinoDoClique(54, 7)
  assert(leste.alem === true && leste.x === MEIO + ALCANCE_ALEM && leste.z === 7, `faixa: leste: (54, 7) vira (${MEIO + ALCANCE_ALEM}, 7) (veio ${JSON.stringify(leste)})`)
  const oeste = destinoDoClique(-54.5, -12)
  assert(oeste.alem === true && oeste.x === -(MEIO + ALCANCE_ALEM) && oeste.z === -12, `faixa: oeste: (−54,5, −12) vira (−${MEIO + ALCANCE_ALEM}, −12) (veio ${JSON.stringify(oeste)})`)
  const norte = destinoDoClique(-3, 55)
  assert(norte.alem === true && norte.z === MEIO + ALCANCE_ALEM && norte.x === -3, `faixa: norte: (−3, 55) vira (−3, ${MEIO + ALCANCE_ALEM}) (veio ${JSON.stringify(norte)})`)
  const sul = destinoDoClique(30, -55.2)
  assert(sul.alem === true && sul.z === -(MEIO + ALCANCE_ALEM) && sul.x === 30, `faixa: sul: (30, −55,2) vira (30, −${MEIO + ALCANCE_ALEM}) (veio ${JSON.stringify(sul)})`)

  // o canto: os dois eixos saem (diagonal)
  const canto = destinoDoClique(54, 54)
  assert(canto.alem === true && canto.x === MEIO + ALCANCE_ALEM && canto.z === MEIO + ALCANCE_ALEM, `faixa: canto leste-norte: os DOIS eixos saem (veio ${JSON.stringify(canto)})`)
  const cantoSul = destinoDoClique(-55, -53.5)
  assert(cantoSul.alem === true && cantoSul.x === -(MEIO + ALCANCE_ALEM) && cantoSul.z === -(MEIO + ALCANCE_ALEM), 'faixa: canto oeste-sul: os dois eixos saem com o sinal certo')
  const cantoMisto = destinoDoClique(54, -54)
  assert(cantoMisto.x === MEIO + ALCANCE_ALEM && cantoMisto.z === -(MEIO + ALCANCE_ALEM), 'faixa: canto leste-sul: x positivo e z negativo')

  // os limites: 53 é o início da faixa (já dentro), 52,99 não; o próprio 56 e além continuam sendo «fora» (o chão não os devolve, mas a função não quebra)
  assert(destinoDoClique(53, 0).alem === true, 'faixa: x = 53 já é a faixa')
  assert(destinoDoClique(52.999, 0).alem === false, 'faixa: x = 52,999 ainda NÃO é a faixa')
  assert(destinoDoClique(-53, 0).alem === true && destinoDoClique(-52.999, 0).alem === false, 'faixa: o limite vale dos dois lados (−53)')
  assert(destinoDoClique(0, 53).alem === true && destinoDoClique(0, 52.999).alem === false, 'faixa: o limite vale no eixo z (53)')
  assert(destinoDoClique(0, -53).alem === true && destinoDoClique(0, -52.999).alem === false, 'faixa: o limite vale no eixo z negativo (−53)')
  const alemDoChao = destinoDoClique(60, 0)
  assert(alemDoChao.alem === true && alemDoChao.x === MEIO + ALCANCE_ALEM, 'faixa: um ponto além do chão (60) também vira o destino de fora e não passa de 64')

  // o destino de fora SEMPRE cabe na regra do `ordenar` (|x| ≥ 56 grava `alem`): se um dia a largura ou o alcance mudarem, o destino de fora tem de continuar fora
  for (const [x, z] of [[53, 0], [55.99, 0], [0, 53], [-53, 0], [0, -55.99], [54, 54]] as const) {
    const d = destinoDoClique(x, z)
    assert(Math.abs(d.x) >= MEIO || Math.abs(d.z) >= MEIO, `faixa: o destino de (${x}, ${z}) SAI do quadrado (|x| ou |z| ≥ 56), senão o \`ordenar\` não grava \`alem\``)
  }

  // entradas sujas nunca viram destino de fora por acidente
  for (const sujo of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const a = destinoDoClique(sujo, 0), b = destinoDoClique(0, sujo)
    assert(a.alem === false && b.alem === false, `faixa: ${sujo} não vira «ir para outro mapa» (um clique sujo não manda a tropa embora)`)
  }
  // O MURO que o jogador VÊ é exatamente a região onde o clique manda atravessar (23/11: eu tinha desenhado o muro e a regra do clique em arquivos separados, e nada garantia que descrevessem a mesma região).
  // Varro o chão INTEIRO em passos de 0,5 m (de −56 a 56, o que o chão clicável devolve): um ponto está dentro de alguma caixa do muro SE E SÓ SE `destinoDoClique` diz que ele atravessa. As bordas são fechadas nos
  // dois lados (53 e 56 são da faixa), como a regra do clique (`>= 53`).
  const caixas = caixasDaBorda()
  assert(caixas.length === 4 && new Set(caixas.map((c) => c.chave)).size === 4, 'muro: são 4 caixas, uma por lado (leste, oeste, norte, sul)')
  const dentroDeAlgumaCaixa = (x: number, z: number): boolean => caixas.some((c) => Math.abs(x - c.cx) <= c.hx && Math.abs(z - c.cz) <= c.hz)
  let cobertos = 0
  for (let ix = -112; ix <= 112; ix += 1) {
    for (let iz = -112; iz <= 112; iz += 1) {
      const x = ix / 2
      const z = iz / 2
      const vemMuro = dentroDeAlgumaCaixa(x, z)
      const atravessa = destinoDoClique(x, z).alem
      if (vemMuro) cobertos += 1
      assert(vemMuro === atravessa, `muro: o ponto (${x}, ${z}) ${vemMuro ? 'está pintado' : 'NÃO está pintado'} mas o clique ali ${atravessa ? 'manda atravessar' : 'NÃO manda atravessar'}: o que se vê tem de ser o que se clica`)
    }
  }
  assert(cobertos > 1000, `muro: a varredura cobriu ${cobertos} pontos (esperava mais de mil: sem isso o laço acima não provou nada)`)
  // As 4 caixas NÃO se sobrepõem (dois blocos translúcidos empilhados ficariam mais opacos nos cantos): a soma das áreas é a da moldura, o quadrado inteiro menos o miolo.
  const lado = 2 * MEIO
  const area = caixas.reduce((soma, c) => soma + 4 * c.hx * c.hz, 0)
  const moldura = lado * lado - (lado - 2 * LARGURA_DA_FAIXA) ** 2
  assert(Math.abs(area - moldura) < 1e-9, `muro: a soma das áreas das caixas é ${area}, a moldura tem ${moldura}: há sobreposição ou buraco nos cantos`)

}
