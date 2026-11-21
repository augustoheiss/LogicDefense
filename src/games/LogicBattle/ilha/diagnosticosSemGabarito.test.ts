import { listarArquetipos, sintetizarArquetipo } from './infiniteMathEngine'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * E2.5 «Diagnóstico que ensina»: o texto que o jogador lê DEPOIS de errar não pode lhe dar a resposta certa.
 *
 * Origem (medido em 20/11/2026, 26 arquétipos × 300 problemas = 23.388 alternativas erradas): 33,8 % dos diagnósticos de uma alternativa ERRADA continham
 * o valor da resposta CERTA («Você somou 9 + 3… fazemos 9 × 3 = 27!» com 27 certa; no corte cruzado, 98 %). O modal mostra esse texto sozinho, logo após o
 * erro. Com a regra «errou, perde metade do buff», quem erra lê o gabarito, clica nele e perde o buff SEM ter aprendido; no caderno de estudo, o erro
 * seguido do acerto parece «aprendeu». Os 8 geradores da L7 já tinham este teste (`geradoresProblemas.test.ts`, regra 7); este o estende a TODOS os arquétipos
 * do motor, inclusive os 18 antigos, que não são exportados (por isso `sintetizarArquetipo`, só de leitura).
 *
 * O QUE É PROIBIDO: o valor da resposta CERTA como número isolado no `diagnosticPt` de uma alternativa ERRADA (inclusive de 1 dígito, em qualquer posição).
 * O QUE É PERMITIDO (decisão de projeto, [D-minha]): passo INTERMEDIÁRIO («28 + 2 fecha 30»), o erro nomeado («você esqueceu de tirar 2 do 36») e a pista do
 * CAMINHO; a Luz-Guia e os passos continuam podendo conter a resposta (são ajuda PEDIDA, e este teste não os olha).
 */
// 2.000 sementes por arquétipo = 52.000 problemas. Medido: o teste inteiro leva ~0,4 s (gerar custa ~0,002 ms por problema), então não há razão para amostrar pouco.
// O piso abaixo existe porque o mutante «SEMENTES = 1» SOBREVIVEU na rodada de mutação: com 1 semente por arquétipo a contagem `26 × SEMENTES` ainda fecha e nenhum
// vazamento raro aparece por acaso (as coincidências numéricas que a E2.5 consertou apareciam em 1 de 100 a 1 de 300 problemas).
const SEMENTES = 2000
const PISO_DE_SEMENTES = 1000

// «-» colado antes do número é SINAL («a diferença (-10)»), não o valor; vírgula/ponto decimais de um lado e do outro contam como parte do número («1,5» não é «5»).
const valorIsolado = (valor: string, texto: string): boolean => {
  const v = valor.replace(/[.,]/g, (m) => `\\${m}`)
  return new RegExp(`(^|[^0-9.,-])${v}([^0-9]|[.,](?![0-9])|$)`).test(texto)
}

export function run(): void {
  const arquetipos = listarArquetipos()
  assert(arquetipos.length === 26, `E2.5: esperava 26 arquétipos no motor, achei ${arquetipos.length}`)
  assert(SEMENTES >= PISO_DE_SEMENTES, `E2.5: ${SEMENTES} sementes por arquétipo é pouco (piso ${PISO_DE_SEMENTES}): um vazamento por coincidência de 1 em 300 passaria sem ser visto`)

  // controle do instrumento: o detector enxerga um vazamento óbvio e NÃO acusa o que não é (sem isto, «0 vazamentos» não prova nada)
  assert(valorIsolado('27', 'fazemos 9 × 3 = 27!'), 'E2.5 instrumento: não viu «= 27!»')
  assert(valorIsolado('27', '27'), 'E2.5 instrumento: não viu «27» sozinho')
  assert(valorIsolado('7', 'resulta em 7.'), 'E2.5 instrumento: não viu «7.» no fim de frase')
  assert(!valorIsolado('27', 'fazemos 127 + 270'), 'E2.5 instrumento: acusou 27 dentro de 127 e 270 (falso positivo)')
  assert(!valorIsolado('5', 'o tanque tem 1,5 L e 0,5 L'), 'E2.5 instrumento: acusou 5 dentro de 1,5 e 0,5 (falso positivo)')
  assert(!valorIsolado('10', 'a diferença (-10) é negativa'), 'E2.5 instrumento: acusou o sinal de «-10» como se fosse o valor 10')
  assert(valorIsolado('1,5', 'o resultado é 1,5 litro'), 'E2.5 instrumento: não viu o decimal «1,5»')

  const vazamentos: string[] = []
  let alternativasErradas = 0
  let problemas = 0
  for (const a of arquetipos) {
    for (let s = 1; s <= SEMENTES; s++) {
      const c = sintetizarArquetipo(a.archetypeId, s * 7919 + 13)
      problemas++
      const certa = String(c.correctValue)
      for (const ch of c.choices.filter((x) => !x.isCorrect)) {
        alternativasErradas++
        if (valorIsolado(certa, ch.diagnosticPt) && vazamentos.length < 12) vazamentos.push(`${a.archetypeId} (certa ${certa}, errada «${ch.label}»): «${ch.diagnosticPt}»`)
      }
    }
  }
  assert(problemas === 26 * SEMENTES, `E2.5: conferi ${problemas} problemas (esperava ${26 * SEMENTES}): o laço não percorreu todos os arquétipos`)
  assert(alternativasErradas === 3 * problemas, `E2.5: ${alternativasErradas} alternativas erradas em ${problemas} problemas (esperava 3 por problema)`)
  assert(vazamentos.length === 0, `E2.5: o diagnóstico de uma alternativa ERRADA entrega a resposta certa. Primeiros casos:\n  ${vazamentos.join('\n  ')}`)
}
