import {
  CHAVE_CADERNO,
  LIMITE_TENTATIVAS,
  carregarCaderno,
  cadernoVazio,
  chaveCurta,
  pesoDoErro,
  pontosFracos,
  registrarTentativa,
  salvarCaderno,
  type Tentativa,
} from './cadernoDeEstudo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * E2 «Caderno de estudo» (pedido do usuário, 20/11): «um banco de dados sobre isso: acertos, erros, pontos de atenção… e ajudar onde você tem mais dificuldade».
 *
 * Contrato (decisões [D-minha], registradas no plano 2026-11-20-PLANO-GUIA-DOS-UNIVERSITARIOS…, §7 e §8):
 *  - guarda por CONCEITO um agregado de tamanho FIXO (acertos, erros, tempo, última vez, sequência de erros) e as ÚLTIMAS N tentativas (janela): o caderno TEM TETO
 *    (~60 KB), por isso cabe em `localStorage`; sem texto livre nem identificador pessoal (repositório público, aluno possivelmente menor);
 *  - o «ponto fraco» NÃO é a porcentagem crua de erros: um erro INSTANTÂNEO é chute e conta pouco; um erro DEPOIS DE PENSAR conta cheio (o plano avisava que a regra
 *    «errou, perde metade» + modal a 0,1× + onda que não para empurra o aluno a chutar, e o caderno não pode acusar «fraco» quem só chutou);
 *  - NUNCA lança: armazenamento ausente, cheio ou corrompido devolve um caderno vazio, e o jogo segue (como a E1).
 */
export function run(): void {
  const t = (p: Partial<Tentativa> = {}): Tentativa => ({ q: 1_000, g: 3, c: 'precedencia_operacoes', a: 'g2_pemdas_trincheira', e: 0, t: 12_000, k: 'abc123', ...p })
  const memoria = (): { dados: Map<string, string>; getItem(k: string): string | null; setItem(k: string, v: string): void } => {
    const dados = new Map<string, string>()
    return { dados, getItem: (k) => (dados.has(k) ? dados.get(k)! : null), setItem: (k, v) => void dados.set(k, v) }
  }

  // ── chaveCurta: a assinatura (~110 caracteres) vira uma chave de poucos caracteres, DETERMINÍSTICA (a mesma conta sempre dá a mesma chave) e que distingue contas ──
  const sigA = 'g3_corte_cruzado_trincheira:(44 × 15) ÷ (11 × 5) = ?=12'
  const sigB = 'g3_corte_cruzado_trincheira:(44 × 15) ÷ (11 × 5) = ?=13'
  assert(chaveCurta(sigA) === chaveCurta(sigA), 'a mesma assinatura dá SEMPRE a mesma chave')
  assert(chaveCurta(sigA) !== chaveCurta(sigB), 'assinaturas que diferem em UM caractere dão chaves diferentes')
  assert(/^[0-9a-z]{4,10}$/.test(chaveCurta(sigA)), `a chave é curta e só tem [0-9a-z] (veio «${chaveCurta(sigA)}»)`)
  assert(chaveCurta(sigA).length < sigA.length / 4, 'a chave é MUITO mais curta que a assinatura (senão não economiza nada)')
  for (const sujo of ['', ' ', 'x'.repeat(5_000)]) assert(/^[0-9a-z]{4,10}$/.test(chaveCurta(sujo)), `entrada «${sujo.slice(0, 10)}…» também dá uma chave válida`)
  // VETORES PUBLICADOS do FNV-1a de 32 bits (Fowler-Noll-Vo): hash('') = 0x811c9dc5, hash('a') = 0xe40c292c, hash('foobar') = 0xbf9cf968, convertidos para base 36. Um oráculo
  // INDEPENDENTE do código: fixa o VALOR exato da chave (semente, primo, XOR, ordem e base), não só o formato. A 1ª rodada de mutação deixou sobreviver «semente = 0» e «base 10»:
  // o teste só olhava formato e colisão entre assinaturas parecidas.
  assert(chaveCurta('') === 'ztntfp', `FNV-1a de '' em base 36 = «ztntfp» (veio «${chaveCurta('')}»)`)
  assert(chaveCurta('a') === '1r9wi7g', `FNV-1a de 'a' em base 36 = «1r9wi7g» (veio «${chaveCurta('a')}»)`)
  assert(chaveCurta('foobar') === '1h5yxyg', `FNV-1a de 'foobar' em base 36 = «1h5yxyg» (veio «${chaveCurta('foobar')}»)`)
  // entrada cujo hash em base 36 tem só 3 caracteres (achada por busca): o piso de 4 caracteres (`padStart`) só aparece aqui; nenhuma assinatura real cai nele por acaso
  assert(chaveCurta('bza3') === '03th', `hash pequeno ganha zeros à esquerda até 4 caracteres: «03th» (veio «${chaveCurta('bza3')}»)`)
  const unicas = new Set<string>()
  for (let i = 0; i < 5_000; i++) unicas.add(chaveCurta(`g3_mmc_coincidencia:${i}=${i * 7}`))
  assert(unicas.size >= 4_990, `5.000 assinaturas diferentes dão ~5.000 chaves (colisões toleradas: ≤ 10; veio ${5_000 - unicas.size})`)

  // ── caderno vazio ──
  const vazio = cadernoVazio()
  assert(vazio.tentativas.length === 0 && Object.keys(vazio.conceitos).length === 0 && vazio.v === 1, 'caderno vazio: sem tentativas, sem conceitos, versão 1')

  // ── registrarTentativa: puro (não muda o caderno de antes), soma no conceito certo ──
  const c1 = registrarTentativa(vazio, t({ e: 0, t: 12_000 }))
  assert(vazio.tentativas.length === 0, 'registrar não muda o caderno de ANTES (imutável)')
  assert(c1.tentativas.length === 1 && c1.conceitos.precedencia_operacoes?.n === 1, 'uma tentativa registrada: 1 na janela e 1 no conceito')
  const k1 = c1.conceitos.precedencia_operacoes!
  assert(k1.ok === 1 && k1.er === 0 && k1.t === 12_000, `acerto de primeira: ok 1, erros 0, tempo 12000 (veio ${JSON.stringify(k1)})`)
  assert(k1.sq === 0, 'acerto de primeira: sequência de erros 0')

  // tentativa com erros: `e` é o número de ERROS antes do acerto; cada erro vai para `er`, o acerto para `ok`, e a sequência cresce
  const c2 = registrarTentativa(c1, t({ q: 2_000, e: 2, t: 30_000 }))
  const k2 = c2.conceitos.precedencia_operacoes!
  assert(k2.n === 2 && k2.ok === 2 && k2.er === 2, `2 contas, 2 acertos e 2 erros somados (veio ${JSON.stringify(k2)})`)
  assert(k2.t === 12_000 + 30_000 && k2.u === 2_000, 'o tempo SOMA e a última vez é a mais recente')

  // outro conceito não mexe neste
  const c3 = registrarTentativa(c2, t({ q: 3_000, c: 'fracao_impropria', e: 1, t: 9_000 }))
  assert(c3.conceitos.fracao_impropria?.er === 1 && c3.conceitos.precedencia_operacoes?.er === 2, 'conceitos separados: o erro de um não vai para o outro')

  // ── a SEQUÊNCIA de erros (quantas contas SEGUIDAS do conceito tiveram erro) zera ao acertar de primeira ──
  let s = cadernoVazio()
  s = registrarTentativa(s, t({ q: 1, e: 1 }))
  s = registrarTentativa(s, t({ q: 2, e: 1 }))
  s = registrarTentativa(s, t({ q: 3, e: 3 }))
  const sequenciaAntes: number = s.conceitos.precedencia_operacoes!.sq
  assert(sequenciaAntes === 3, `3 contas seguidas com erro: sequência 3 (veio ${sequenciaAntes})`)
  s = registrarTentativa(s, t({ q: 4, e: 0 }))
  const sequenciaDepois: number = s.conceitos.precedencia_operacoes!.sq
  assert(sequenciaDepois === 0, `acertar de primeira zera a sequência de erros (veio ${sequenciaDepois})`)

  // ── janela: guarda só as ÚLTIMAS `LIMITE_TENTATIVAS`, a mais recente por último; o agregado NÃO perde nada ──
  let janela = cadernoVazio()
  for (let i = 1; i <= LIMITE_TENTATIVAS + 25; i++) janela = registrarTentativa(janela, t({ q: i, e: i % 2 }))
  assert(janela.tentativas.length === LIMITE_TENTATIVAS, `a janela corta em ${LIMITE_TENTATIVAS} (veio ${janela.tentativas.length})`)
  assert(janela.tentativas[janela.tentativas.length - 1].q === LIMITE_TENTATIVAS + 25, 'a mais RECENTE fica por último')
  assert(janela.tentativas[0].q === 26, `as mais ANTIGAS saem (a 1ª da janela é a 26ª, veio ${janela.tentativas[0].q})`)
  assert(janela.conceitos.precedencia_operacoes!.n === LIMITE_TENTATIVAS + 25, 'o AGREGADO conta todas as tentativas, mesmo as que saíram da janela')

  // ── sujeira nunca entra: números inválidos, conceito vazio, tempo negativo ──
  const antes = registrarTentativa(vazio, t())
  for (const ruim of [t({ c: '' }), t({ g: 9 as never }), t({ e: -1 }), t({ e: 1.5 }), t({ g: 2.5 }), t({ e: Number.NaN }), t({ t: -5 }), t({ t: Number.POSITIVE_INFINITY }), t({ q: Number.NaN }), t({ c: 'a'.repeat(200) })]) {
    const depois = registrarTentativa(antes, ruim)
    assert(depois === antes, `tentativa inválida é IGNORADA (devolve o mesmo caderno): ${JSON.stringify(ruim).slice(0, 80)}`)
  }
  // O TETO DE CONCEITOS (64): lixo no armazenamento, ou um bug que invente ids, não pode inflar o caderno sem fim. O 65º conceito NOVO é ignorado; um conceito que JÁ existe continua
  // registrando (o teto só barra conceitos novos). (A 1ª rodada de mutação deixou sobreviver «o teto some»: nenhum caso criava 65 conceitos.)
  let cheio = cadernoVazio()
  for (let i = 0; i < 64; i++) cheio = registrarTentativa(cheio, t({ q: 10 + i, c: `conceito_${i}` }))
  assert(Object.keys(cheio.conceitos).length === 64, 'os 64 primeiros conceitos entram')
  const sessentaECinco = registrarTentativa(cheio, t({ q: 999, c: 'conceito_novo_65' }))
  assert(sessentaECinco === cheio && Object.keys(sessentaECinco.conceitos).length === 64, 'o 65º conceito NOVO é ignorado (o caderno não cresce sem fim)')
  const repete = registrarTentativa(cheio, t({ q: 1_000, c: 'conceito_3', e: 1 }))
  assert(repete.conceitos.conceito_3.n === 2 && Object.keys(repete.conceitos).length === 64, 'um conceito que JÁ existe continua registrando depois do teto')
  // a JANELA é um contrato de TAMANHO, não só um número simbólico: 500 tentativas, e o caderno cheio cabe folgado na cota do localStorage (5 MB)
  assert(LIMITE_TENTATIVAS === 500, `a janela é de 500 tentativas (veio ${LIMITE_TENTATIVAS}): é o que mantém o caderno em ~58 KB`)
  let pesado = cadernoVazio()
  for (let i = 0; i < LIMITE_TENTATIVAS + 50; i++) pesado = registrarTentativa(pesado, t({ q: 1_732_150_000_000 + i, c: `conceito_${i % 21}`, a: 'g3_corte_cruzado_trincheira', e: i % 4, t: 987_654, k: 'abcdef' }))
  const tamanho = JSON.stringify(pesado).length
  assert(tamanho < 150_000, `o caderno CHEIO tem de caber folgado na cota (${tamanho} caracteres; limite 150.000 = 3 % de 5 MB)`)
  // o tempo absurdo (> 1 h) não estraga a média: é cortado no teto
  const longo = registrarTentativa(vazio, t({ t: 99 * 3_600_000 }))
  assert(longo.conceitos.precedencia_operacoes!.t <= 3_600_000, 'tempo acima de 1 hora é cortado em 1 hora (aluno que saiu para almoçar não vira «difícil»)')

  // ── pesoDoErro: o erro INSTANTÂNEO é chute e pesa pouco; depois de pensar pesa cheio ──
  assert(pesoDoErro(500) < pesoDoErro(5_000) && pesoDoErro(5_000) < pesoDoErro(20_000), 'quanto mais o aluno PENSOU antes de errar, mais o erro pesa')
  assert(pesoDoErro(20_000) === 1 && pesoDoErro(60_000) === 1, 'depois de pensar (>= 8 s) o erro pesa cheio e não passa de 1')
  assert(pesoDoErro(0) > 0 && pesoDoErro(0) < 0.5, 'erro instantâneo (0 s) pesa pouco, mas NÃO zero (zero esconderia o erro por completo)')
  for (const sujo of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const p = pesoDoErro(sujo)
    assert(Number.isFinite(p) && p > 0 && p <= 1, `pesoDoErro(${sujo}) = ${p}: tem de ficar em (0, 1]`)
  }

  // ── pontosFracos: ordena do MAIS fraco ao menos; só conta quem tem amostra mínima; chute não acusa ──
  let cad = cadernoVazio()
  // «A»: 6 contas, todas com 2 erros PENSADOS (20 s): fraco de verdade
  for (let i = 0; i < 6; i++) cad = registrarTentativa(cad, t({ q: 100 + i, c: 'fracao_impropria', e: 2, t: 20_000 }))
  // «B»: 6 contas, todas com 2 erros INSTANTÂNEOS (0,4 s): chute, NÃO deve acusar tanto quanto o A
  for (let i = 0; i < 6; i++) cad = registrarTentativa(cad, t({ q: 200 + i, c: 'precedencia_operacoes', e: 2, t: 400 }))
  // «C»: 6 contas, sempre de primeira: forte
  for (let i = 0; i < 6; i++) cad = registrarTentativa(cad, t({ q: 300 + i, c: 'raiz_quadrada', e: 0, t: 9_000 }))
  // «D»: só 1 conta com erro: amostra pequena demais para acusar
  cad = registrarTentativa(cad, t({ q: 400, c: 'divisao_decimal', e: 3, t: 30_000 }))
  const fracos = pontosFracos(cad)
  assert(fracos.length >= 2, 'há pontos fracos para listar')
  assert(fracos[0].conceito === 'fracao_impropria', `o ponto mais fraco é o do erro PENSADO (fracao_impropria), não o do chute (veio ${fracos[0].conceito})`)
  assert(fracos[0].peso > fracos.find((f) => f.conceito === 'precedencia_operacoes')!.peso, 'o erro pensado pesa MAIS que o chute, mesmo com a mesma contagem de erros')
  assert(!fracos.some((f) => f.conceito === 'raiz_quadrada'), 'quem acerta sempre de primeira NÃO é ponto fraco')
  assert(!fracos.some((f) => f.conceito === 'divisao_decimal'), 'amostra pequena demais (1 conta) NÃO acusa ponto fraco')
  for (let i = 1; i < fracos.length; i++) assert(fracos[i - 1].peso >= fracos[i].peso, 'a lista vem ordenada do mais fraco ao menos fraco')
  assert(pontosFracos(cadernoVazio()).length === 0, 'caderno vazio: nenhum ponto fraco')
  assert(pontosFracos(cad, 1).length === 1, 'o parâmetro limita quantos pontos fracos volta')

  // O peso é POR CONTA, não a soma crua: um conceito com MUITAS contas e poucos erros não pode parecer mais fraco que um com poucas contas e erros em todas. (A 1ª rodada de
  // mutação deixou sobreviver «sem dividir por contas»: meus casos tinham 6 contas em todo conceito, e dividir ou não dava a mesma ordem.)
  let prop = cadernoVazio()
  for (let i = 0; i < 100; i++) prop = registrarTentativa(prop, t({ q: 1_000 + i, c: 'porcentagem_acumulada', e: i < 5 ? 1 : 0, t: 20_000 })) // 100 contas, só 5 com 1 erro pensado
  for (let i = 0; i < 4; i++) prop = registrarTentativa(prop, t({ q: 2_000 + i, c: 'raiz_quadrada', e: 2, t: 20_000 })) // 4 contas, todas com 2 erros pensados
  const ordem = pontosFracos(prop).map((p) => p.conceito)
  assert(ordem[0] === 'raiz_quadrada' && ordem[1] === 'porcentagem_acumulada', `4 contas todas erradas é MAIS fraco que 5 erros em 100 contas (veio ${ordem.join(' > ')})`)
  const pesoRaiz = pontosFracos(prop).find((p) => p.conceito === 'raiz_quadrada')!.peso
  assert(Math.abs(pesoRaiz - 2) < 1e-9, `o peso é o dos erros por conta: 4 contas × 2 erros pensados = 2 por conta (veio ${pesoRaiz})`)

  // ── persistência: a mesma disciplina da E1 (nunca lança, nunca devolve lixo) ──
  const arm = memoria()
  assert(salvarCaderno(arm, c3) === true && arm.dados.has(CHAVE_CADERNO), 'salvar grava na chave do caderno')
  assert(CHAVE_CADERNO === 'ld_ilha_caderno_v1', `a chave segue o padrão do projeto «ld_…_v1» (veio ${CHAVE_CADERNO})`)
  const lido = carregarCaderno(arm)
  assert(lido.tentativas.length === 3 && lido.conceitos.fracao_impropria?.er === 1, 'carregar devolve o que foi salvo')
  // A ORDEM das chaves de `conceitos` não tem significado (o salvar as ordena para a serialização ser determinística), então a comparação é por CONTEÚDO, numa forma
  // canônica (chaves ordenadas): perder ou alterar qualquer campo, de qualquer conceito ou tentativa, ainda é acusado. (A 1ª versão comparava as strings cruas e falhou
  // só porque `fracao_impropria` vem antes de `precedencia_operacoes` na ordem alfabética: o defeito era do TESTE, não do módulo.)
  const canonico = (c: ReturnType<typeof cadernoVazio>): string => JSON.stringify({ v: c.v, tentativas: c.tentativas, conceitos: Object.keys(c.conceitos).sort().map((k) => [k, c.conceitos[k]]) })
  assert(canonico(carregarCaderno(arm)) === canonico(c3), 'ida e volta sem perda (round-trip)')
  assert(canonico(carregarCaderno(arm)) !== canonico(registrarTentativa(c3, t({ q: 9_999, e: 1 }))), '(controle) o comparador canônico ENXERGA uma diferença real entre dois cadernos')
  const antesDeGravar = arm.dados.get(CHAVE_CADERNO)
  assert(salvarCaderno(arm, c3) === true && arm.dados.get(CHAVE_CADERNO) === antesDeGravar, 'salvar o mesmo caderno de novo não regrava (o jogo roda a 60 fps e a gravação é síncrona)')
  // «não regrava» é sobre CHAMAR `setItem`, não sobre o texto final (regravar o mesmo texto deixa o mesmo texto): o armazenamento CONTA as gravações
  // (`gravacoes` é lida em variáveis `number` a cada passo: `assert(gravacoes === 1)` estreitaria o tipo para o literal 1 e o `tsc` recusaria compará-la com 2 depois)
  let gravacoes = 0
  const contador = memoria()
  const setOriginal = contador.setItem
  contador.setItem = (k, v) => { gravacoes++; setOriginal(k, v) }
  salvarCaderno(contador, c3)
  const aposPrimeira: number = gravacoes
  assert(aposPrimeira === 1, `a 1ª vez grava (1 chamada a setItem, veio ${aposPrimeira})`)
  salvarCaderno(contador, c3)
  salvarCaderno(contador, c3)
  const aposRepetir: number = gravacoes
  assert(aposRepetir === 1, `salvar o MESMO caderno 2 vezes mais NÃO chama setItem de novo (veio ${aposRepetir} gravações)`)
  salvarCaderno(contador, registrarTentativa(c3, t({ q: 4_000, e: 1 })))
  const aposDiferente: number = gravacoes
  assert(aposDiferente === 2, `um caderno DIFERENTE grava (2 chamadas, veio ${aposDiferente}): o controle de que o contador enxerga gravação`)
  assert(carregarCaderno(null).tentativas.length === 0 && carregarCaderno(undefined).tentativas.length === 0, 'sem armazenamento: caderno vazio, sem lançar')
  assert(salvarCaderno(null, c3) === false, 'sem armazenamento: salvar devolve false, sem lançar')
  const quebrado = memoria()
  quebrado.setItem = () => { throw new Error('cota cheia') }
  assert(salvarCaderno(quebrado, c3) === false, 'cota cheia / acesso negado: salvar devolve false, sem lançar')
  const lixos = ['', 'null', '[]', '{}', '42', '"texto"', '{"v":2,"tentativas":[],"conceitos":{}}', '{"v":1,"tentativas":"x","conceitos":[]}', '{not json', '{"v":1,"tentativas":[{"q":"a"}],"conceitos":{"x":{"n":"a"}}}']
  for (const bruto of lixos) {
    const m = memoria()
    m.dados.set(CHAVE_CADERNO, bruto)
    const r = carregarCaderno(m)
    assert(r.v === 1 && Array.isArray(r.tentativas) && typeof r.conceitos === 'object' && r.conceitos !== null && !Array.isArray(r.conceitos), `lixo «${bruto.slice(0, 30)}» devolve um caderno bem formado`)
    assert(r.tentativas.every((x) => Number.isFinite(x.q)) && Object.values(r.conceitos).every((k) => Number.isFinite(k.n)), `lixo «${bruto.slice(0, 30)}» não deixa NaN no caderno`)
  }
  // `conceitos` em forma de ARRAY (formato errado) NÃO vira conceitos fantasma «0», «1»…: devolve vazio (a 1ª rodada de mutação deixou sobreviver «aceita array»; medi: o mutante criava as chaves «0», «1» e «3»)
  const arrayErrado = memoria()
  arrayErrado.dados.set(CHAVE_CADERNO, JSON.stringify({ v: 1, tentativas: [], conceitos: [{ n: 3, ok: 3, er: 2, t: 1000, u: 5, sq: 1, w: 1.5 }] }))
  assert(Object.keys(carregarCaderno(arrayErrado).conceitos).length === 0, 'conceitos em forma de array não viram conceitos «0», «1»…')
  // um caderno salvo com versão futura (v2) NÃO é lido como v1 (um formato novo usa outra chave e não pode ser mal interpretado)
  const futuro = memoria()
  futuro.dados.set(CHAVE_CADERNO, JSON.stringify({ v: 2, tentativas: [t()], conceitos: {} }))
  assert(carregarCaderno(futuro).tentativas.length === 0, 'versão de esquema diferente de 1 não é lida (devolve vazio)')
  // um caderno enorme (de outro app, ou corrompido) é cortado ao carregar, sem estourar a memória
  const gigante = memoria()
  gigante.dados.set(CHAVE_CADERNO, JSON.stringify({ v: 1, tentativas: Array.from({ length: LIMITE_TENTATIVAS * 4 }, (_, i) => t({ q: i + 1 })), conceitos: {} }))
  assert(carregarCaderno(gigante).tentativas.length === LIMITE_TENTATIVAS, 'ao carregar, a janela é cortada no limite (não confia no tamanho do que estava salvo)')
}
