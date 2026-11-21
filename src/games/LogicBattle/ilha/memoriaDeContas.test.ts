import { armazenamentoDoNavegador, carregarAssinaturas, salvarAssinaturas, CHAVE_ASSINATURAS, LIMITE_ASSINATURAS, type ArmazenamentoSimples } from './memoriaDeContas'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Armazenamento em memória com a MESMA interface mínima do `Storage` do navegador (getItem/setItem). Pode ser configurado para falhar. */
function criarArmazenamento(opcoes: { falhaAoLer?: boolean; falhaAoGravar?: boolean; inicial?: Record<string, string> } = {}): ArmazenamentoSimples & { dados: Record<string, string>; gravacoes: number } {
  const dados: Record<string, string> = { ...(opcoes.inicial ?? {}) }
  const a = {
    dados,
    gravacoes: 0,
    getItem(chave: string): string | null {
      if (opcoes.falhaAoLer) throw new Error('SecurityError: acesso ao armazenamento negado')
      return Object.prototype.hasOwnProperty.call(dados, chave) ? dados[chave] : null
    },
    setItem(chave: string, valor: string): void {
      if (opcoes.falhaAoGravar) throw new Error('QuotaExceededError')
      a.gravacoes++
      dados[chave] = valor
    },
    removeItem(chave: string): void {
      delete dados[chave]
    },
  }
  return a
}

/**
 * Memória de contas (E1 do plano do Guia dos universitários). O pedido do usuário: «mesmo se o usuário começar outra partida, a pergunta vai ser
 * diferente». Hoje o anel anti-repetição do motor mora só em memória e ZERA ao recarregar a página; `hydrateSeenMathSignatures` e
 * `getRecentMathSignaturesSnapshot` existem e NINGUÉM os chama (medido). Este módulo é a camada que salva/restaura as assinaturas.
 *
 * Regras: nunca lança (modo anônimo, cota cheia, acesso negado e JSON corrompido NÃO podem derrubar o jogo); só devolve strings; corta no limite;
 * ignora lixo; não duplica; mantém a ORDEM (a mais recente por último).
 */
export function run(): void {
  // ── ida e volta ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const a1 = criarArmazenamento()
  assert(carregarAssinaturas(a1).length === 0, 'sem nada salvo, carrega lista vazia')
  assert(salvarAssinaturas(a1, ['g1:12+13=25', 'g2:7x8=56']) === true, 'salvar devolve true quando gravou')
  const volta = carregarAssinaturas(a1)
  assert(volta.join('|') === 'g1:12+13=25|g2:7x8=56', `ida e volta preserva o conteudo e a ORDEM (deu ${volta.join('|')})`)
  assert(typeof a1.dados[CHAVE_ASSINATURAS] === 'string', 'grava sob a chave publica CHAVE_ASSINATURAS')

  // ── a chave tem prefixo do projeto e versão (não colide com `ld_*`/`cv_*` de outros apps nem com um formato futuro) ───────────────
  assert(/^ld_/.test(CHAVE_ASSINATURAS) && /v\d+$/.test(CHAVE_ASSINATURAS), `a chave ${CHAVE_ASSINATURAS} deve seguir o padrao do projeto (ld_..._vN)`)

  // ── limite: guarda só as ÚLTIMAS N (a mais recente por último), e o limite não passa do que o motor aguenta ────────────────────
  assert(LIMITE_ASSINATURAS > 0 && LIMITE_ASSINATURAS <= 260, `limite ${LIMITE_ASSINATURAS} deve ser > 0 e <= 260 (o anel do motor tem 260)`)
  const muitas = Array.from({ length: LIMITE_ASSINATURAS + 40 }, (_, i) => `arq:conta${i}=${i}`)
  const a2 = criarArmazenamento()
  salvarAssinaturas(a2, muitas)
  const cortadas = carregarAssinaturas(a2)
  assert(cortadas.length === LIMITE_ASSINATURAS, `corta em ${LIMITE_ASSINATURAS} (deu ${cortadas.length})`)
  assert(cortadas[cortadas.length - 1] === muitas[muitas.length - 1], 'mantem a MAIS RECENTE (a ultima da lista)')
  assert(cortadas[0] === muitas[40], 'descarta as MAIS ANTIGAS (as primeiras da lista)')

  // ── não duplica ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const a3 = criarArmazenamento()
  salvarAssinaturas(a3, ['x:1=1', 'y:2=2', 'x:1=1', 'z:3=3', 'y:2=2'])
  assert(carregarAssinaturas(a3).join('|') === 'x:1=1|y:2=2|z:3=3', 'remove duplicatas mantendo a primeira ocorrencia')

  // ── nunca lança: armazenamento hostil ───────────────────────────────────────────────────────────────────────────────
  assert(carregarAssinaturas(criarArmazenamento({ falhaAoLer: true })).length === 0, 'acesso negado ao ler (modo anonimo/privacidade) devolve [] sem lancar')
  assert(salvarAssinaturas(criarArmazenamento({ falhaAoGravar: true }), ['a:1=1']) === false, 'cota cheia ao gravar devolve false sem lancar')
  assert(carregarAssinaturas(null).length === 0, 'sem armazenamento (indefinido/nulo) devolve []')
  assert(salvarAssinaturas(null, ['a:1=1']) === false, 'salvar sem armazenamento devolve false')
  assert(carregarAssinaturas(undefined).length === 0, 'armazenamento indefinido devolve []')

  // ── dados corrompidos ou de outro formato: nada de lançar, nada de lixo entrar no anel do motor ─────────────────────────────────
  const lixos = ['', 'não é json', '{', '{"a":1}', 'null', '123', '"texto"', '[1,2,3]', '[null,{"x":1}]', '[["aninhada"]]', 'undefined', '[', '[""]', '["   "]']
  for (const l of lixos) {
    const a = criarArmazenamento({ inicial: { [CHAVE_ASSINATURAS]: l } })
    const r = carregarAssinaturas(a)
    assert(Array.isArray(r) && r.every((s) => typeof s === 'string' && s.trim().length > 0), `dado corrompido «${l}» devolveu algo que nao e lista de strings validas: ${JSON.stringify(r)}`)
  }
  // OBJETO cujos valores são strings válidas: NÃO é o nosso formato (lista) e não pode ser «aproveitado». Sem este caso o mutante `Object.values(lido)`
  // sobrevivia: `{"a":1}` virava [1] e `limpar` descartava o número, então o resultado era [] por acaso, igual ao correto.
  for (const objeto of ['{"a":"x:1=1"}', '{"0":"x:1=1","1":"y:2=2"}', '{"assinaturas":["x:1=1"]}']) {
    assert(carregarAssinaturas(criarArmazenamento({ inicial: { [CHAVE_ASSINATURAS]: objeto } })).length === 0, `objeto «${objeto}» nao e lista: nao pode ser aproveitado`)
  }
  // misto: aproveita as strings boas e descarta as ruins (um número no meio não pode apagar o resto)
  const misto = criarArmazenamento({ inicial: { [CHAVE_ASSINATURAS]: JSON.stringify(['a:1=1', 42, null, 'b:2=2', { x: 1 }, '', 'c:3=3']) } })
  assert(carregarAssinaturas(misto).join('|') === 'a:1=1|b:2=2|c:3=3', `misto: aproveita so as strings validas (deu ${carregarAssinaturas(misto).join('|')})`)
  // uma assinatura absurdamente longa não entra (um valor de 5 MB não pode encher a cota nem o anel)
  const longa = 'x'.repeat(5000)
  const a4 = criarArmazenamento()
  salvarAssinaturas(a4, ['ok:1=1', longa, 'ok:2=2'])
  assert(carregarAssinaturas(a4).join('|') === 'ok:1=1|ok:2=2', 'assinatura gigante e descartada (limite de tamanho por item)')
  // entrada suja ao salvar (não-strings) não quebra
  const a5 = criarArmazenamento()
  assert(salvarAssinaturas(a5, ['a:1=1', 7 as unknown as string, null as unknown as string, 'b:2=2']) === true, 'salvar com itens nao-string nao lanca e grava os validos')
  assert(carregarAssinaturas(a5).join('|') === 'a:1=1|b:2=2', 'so as strings validas foram gravadas')

  // ── custo: não regrava à toa (o jogo roda a 60 fps; gravar sem mudança é desperdício) ───────────────────────────────────────────
  const a6 = criarArmazenamento()
  salvarAssinaturas(a6, ['a:1=1', 'b:2=2'])
  const antes = a6.gravacoes
  salvarAssinaturas(a6, ['a:1=1', 'b:2=2'])
  assert(a6.gravacoes === antes, `lista identica nao regrava (gravacoes ${antes} -> ${a6.gravacoes})`)
  salvarAssinaturas(a6, ['a:1=1', 'b:2=2', 'c:3=3'])
  assert(a6.gravacoes === antes + 1, 'lista diferente grava')
  // tamanho: o JSON do máximo cabe com folga na cota (5 MB) — mede e fixa o orçamento de ~16 KB
  const maximo = Array.from({ length: LIMITE_ASSINATURAS }, (_, i) => `g4_problema_senhores_do_tempo_divisores:divisores comuns(${100 + i}, ${200 + i})=${i % 16}`)
  const a7 = criarArmazenamento()
  salvarAssinaturas(a7, maximo)
  assert(a7.dados[CHAVE_ASSINATURAS].length < 32 * 1024, `o maximo ocupa ${a7.dados[CHAVE_ASSINATURAS].length} bytes: deve ficar abaixo de 32 KB (cota ~5 MB)`)

  // ── armazenamentoDoNavegador: o ponto UNICO que toca em `window.localStorage`. Nunca lanca (SSR, modo anonimo, acesso bloqueado) e devolve null nesses casos ──
  assert(armazenamentoDoNavegador(undefined) === null, 'sem window (SSR/Node) devolve null')
  assert(armazenamentoDoNavegador({}) === null, 'window sem localStorage devolve null')
  assert(armazenamentoDoNavegador({ get localStorage(): never { throw new Error('SecurityError: acesso ao localStorage bloqueado') } }) === null, 'ler window.localStorage lancando (privacidade) devolve null, sem lancar')
  const falso = criarArmazenamento()
  assert(armazenamentoDoNavegador({ localStorage: falso }) === falso, 'com localStorage utilizavel devolve ELE (a mesma referencia)')
  // um localStorage que existe mas e inutil (getItem lanca sempre, como o Safari em modo privado antigo): tambem vira null (testa de verdade, nao so a presenca)
  assert(armazenamentoDoNavegador({ localStorage: criarArmazenamento({ falhaAoLer: true }) }) === null, 'localStorage presente mas que lanca ao ler vira null (a presenca nao basta)')
  assert(armazenamentoDoNavegador({ localStorage: criarArmazenamento({ falhaAoGravar: true }) }) === null, 'localStorage presente mas que lanca ao gravar (cota 0) vira null')
  const comLixo = criarArmazenamento({ inicial: { ld_teste_sondagem: 'preexistente' } })
  armazenamentoDoNavegador({ localStorage: comLixo })
  assert(comLixo.dados.ld_teste_sondagem === 'preexistente', 'a sondagem nao apaga nem altera chaves que ja existiam')
  assert(Object.keys(comLixo.dados).every((k) => k === 'ld_teste_sondagem' || k === CHAVE_ASSINATURAS), 'a sondagem nao deixa chave sua para tras (so as chaves do projeto)')
}
