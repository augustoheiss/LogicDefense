import { GERADORES_PROBLEMAS, mmcLista } from './geradoresProblemas'
import { embaralhar, mdc, mmc2, MAX_TENTATIVAS, quatro, semente, tentar } from './geradoresBase'
import { generateInfiniteChallenge, listarArquetipos } from './infiniteMathEngine'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * L7 «Contas que não se repetem». Seis geradores de problema (MMC, regra de três direta e inversa, média, conjuntos e razão)
 * que nascem por CONSTRUÇÃO DIRETA: sorteiam a resposta e os fatores e CALCULAM o resto, então a conta fecha em inteiro sem
 * lista escrita à mão. Origem: o gerador antigo de «engenheiros» tinha 8 pares (8 enunciados no total) e foi a causa medida do
 * «as contas muito difíceis estão se repetindo».
 *
 * O QUE «CORRETO» SIGNIFICA (definido antes dos geradores existirem):
 *  1. a resposta marcada é a certa segundo um SOLVER INDEPENDENTE de força bruta (nunca a mesma fórmula do gerador);
 *  2. quatro alternativas, exatamente uma certa, todas distintas e todas com diagnóstico;
 *  3. sem lixo no texto (NaN, undefined, [object, {{, null);
 *  4. cada número do enunciado vem dos `params` que o gerador devolve (texto e conta não podem divergir);
 *  5. o português do enunciado é correto: nada de «1 horas», «quantos bicicletas», «três luzes» com duas listadas.
 *
 * A (5) existe porque a primeira bateria só olhava números e deixou passar 23% de enunciados do MMC com o numeral errado.
 */
const SEMENTES = 1500
// Piso de enunciados distintos por gerador em SEMENTES sorteios. Medido (3.000 sementes): MMC e inversa ~1.400, os demais 2.700+, divisores ~1.100.
// Os antigos que este lote substitui tinham 8 a 12 e repetiam 11% a 23% das contas numa sessao de 300; 600 e folga grande sobre o pior novo.
const PISO_DE_VARIEDADE = 600
// Excecoes DECLARADAS, cada uma com a medicao do espaco que a justifica (nao e afrouxar o teste: o conceito e pequeno por natureza).
const PISO_POR_GERADOR: Record<string, number> = {
  // «1/t1 + 1/t2 = 1/T com T inteiro e tempos de cabeca (<= 60)»: 20 pares (juntas) + 91 (uma enche, outra esvazia) + 20 (pergunta inversa) x 4 contextos
  g4_torneiras_em_paralelo: 150,
}
const LIXO = /(NaN|undefined|\[object|\{\{|\}\}|\bnull\b|Infinity|\$\{)/

// ── solvers independentes (força bruta / enumeração; não reaproveitam fórmula de gerador nenhum) ──────────────────────────
const mmcBruto = (periodos: number[]): number | null => {
  for (let t = 1; t <= 2_000_000; t++) if (periodos.every((p) => t % p === 0)) return t
  return null
}
const inversaBruta = (p1: number, t1: number, p2: number): number | null => {
  for (let t = 1; t <= 100_000; t++) if (p2 * t === p1 * t1) return t
  return null
}
const diretaBruta = (a: number, b: number, c: number): number | null => {
  for (let d = 1; d <= 1_000_000; d++) if (a * d === b * c) return d
  return null
}
const mediaBruta = (notas: number[], alvo: number): number | null => {
  for (let x = 0; x <= 10; x++) if ((notas.reduce((s, v) => s + v, 0) + x) / (notas.length + 1) === alvo) return x
  return null
}
// conjuntos: monta um universo de `total` pessoas numeradas e CONTA os elementos distintos (não aplica |A|+|B|−|A∩B|)
function conjuntosEnumerando(p: { total: number; A: number; B: number; ambos: number; pergunta: string }): number | null {
  const ca = new Set<number>()
  const cb = new Set<number>()
  let id = 0
  for (let i = 0; i < p.ambos; i++) { ca.add(id); cb.add(id); id++ }
  for (let i = 0; i < p.A - p.ambos; i++) { ca.add(id); id++ }
  for (let i = 0; i < p.B - p.ambos; i++) { cb.add(id); id++ }
  if (id > p.total) return null
  const pelaMenosUm = new Set([...ca, ...cb]).size
  return p.pergunta === 'quantos' ? pelaMenosUm : p.total - pelaMenosUm
}
const razaoBruta = (a: number, b: number, T: number, alvo: string): number | null => {
  for (let u = 1; u <= T; u++) if ((a + b) * u === T) return (alvo === 'a' ? a : b) * u
  return null
}

// divisores: conta k em 1..n com n % k === 0 (nao usa a formula dos expoentes primos), filtrando pela FORMA que o enunciado pede.
// «primo» aqui e decidido por contagem de divisores do proprio k (2 divisores), sem reaproveitar o teste de primalidade do gerador.
const divisoresBruto = (n: number, forma: string, m?: number): number | null => {
  const seDivide = (a: number, b: number) => a % b === 0
  if (forma === 'divisores comuns') {
    // enumera k de 1 ate o menor dos dois e conta quem divide OS DOIS (nunca calcula MDC: e o atalho que o gerador cita no «Jeito 2»)
    if (m === undefined) return null
    let c = 0
    for (let k = 1; k <= Math.min(n, m); k++) if (seDivide(n, k) && seDivide(m, k)) c++
    return c
  }
  const qtdDivisores = (k: number) => { let c = 0; for (let d = 1; d <= k; d++) if (seDivide(k, d)) c++; return c }
  const filtros: Record<string, (k: number) => boolean> = {
    divisores: () => true,
    'divisores pares': (k) => k % 2 === 0,
    'divisores ímpares': (k) => k % 2 === 1,
    'divisores primos': (k) => qtdDivisores(k) === 2,
  }
  const filtro = filtros[forma]
  if (!filtro) return null
  let c = 0
  for (let k = 1; k <= n; k++) if (seDivide(n, k) && filtro(k)) c++
  return c
}
// torneiras em paralelo: menor tempo inteiro t tal que t/t1 + t/t2 === 1 (soma das TAXAS; nao usa produto/soma)
// variante 'juntas': tempo T com T/t1 + T/t2 = 1; 'esvazia': uma enche em t1 e a outra esvazia em t2 (t2 > t1): T/t1 - T/t2 = 1;
// 'inversa': dados T e t1, ache t2 com T/t1 + T/t2 = 1. Todas por busca de inteiros, com a conta em fracao exata (sem ponto flutuante).
const paraleloBruto = (t1: number, t2: number, variante: string, T: number): number | null => {
  // multiplicando tudo por t1·t2 as fracoes viram inteiros: nenhuma divisao, nenhum ponto flutuante
  if (variante === 'juntas') { for (let t = 1; t <= 10_000; t++) if (t * t2 + t * t1 === t1 * t2) return t; return null } // t/t1 + t/t2 = 1
  if (variante === 'esvazia') { for (let t = 1; t <= 10_000; t++) if (t * t2 - t * t1 === t1 * t2) return t; return null } // t/t1 - t/t2 = 1
  if (variante === 'inversa') { for (let x = 1; x <= 10_000; x++) if (T * x + T * t1 === t1 * x) return x; return null } // T/t1 + T/x = 1
  return null
}

type Resolvedor = (params: Record<string, unknown>) => number | null
const num = (v: unknown): number => v as number
const RESOLVEDORES: Record<string, Resolvedor> = {
  g3_mmc_coincidencia: (p) => mmcBruto(p.periodos as number[]),
  g4_problema_regra3_inversa_equipe: (p) => inversaBruta(num(p.p1), num(p.t1), num(p.p2)),
  g3_regra3_direta_producao: (p) => diretaBruta(num(p.a), num(p.b), num(p.c)),
  g3_media_nota_que_falta: (p) => mediaBruta(p.notas as number[], num(p.M)),
  g3_conjuntos_uniao_inter: (p) => conjuntosEnumerando(p as { total: number; A: number; B: number; ambos: number; pergunta: string }),
  g3_razao_dividir_proporcional: (p) => razaoBruta(num(p.a), num(p.b), num(p.T), String(p.alvo)),
  g4_problema_senhores_do_tempo_divisores: (p) => divisoresBruto(num(p.n), String(p.forma), p.m === undefined ? undefined : num(p.m)),
  g4_torneiras_em_paralelo: (p) => paraleloBruto(num(p.t1), num(p.t2), String(p.variante), num(p.T)),
}
// Quais params o ALUNO LÊ no enunciado (os intermediários, como soA/soB/nenhum, não precisam aparecer; a RESPOSTA nunca aparece).
// É função dos params porque, em alguns geradores, o que é dado e o que é resposta depende da variante sorteada.
const LIDOS_NO_ENUNCIADO: Record<string, (p: Record<string, unknown>) => string[]> = {
  g3_mmc_coincidencia: () => [],
  g4_problema_regra3_inversa_equipe: () => ['p1', 't1', 'p2'],
  g3_regra3_direta_producao: () => ['a', 'b', 'c'],
  g3_media_nota_que_falta: () => ['M', 'n'],
  g3_conjuntos_uniao_inter: () => ['total', 'A', 'B', 'ambos'],
  g3_razao_dividir_proporcional: () => ['a', 'b', 'T'],
  g4_problema_senhores_do_tempo_divisores: (p) => (p.forma === 'divisores comuns' ? ['n', 'm'] : ['n']),
  // juntas/esvazia: o enunciado dá t1 e t2 (a resposta é T). inversa: dá T e t1 (a resposta é t2, que NÃO aparece).
  g4_torneiras_em_paralelo: (p) => (p.variante === 'inversa' ? ['T', 't1'] : ['t1', 't2']),
}

const numeroNoTexto = (n: number, texto: string): boolean => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(texto)

// ── defeitos de português que a bateria numérica não via ──────────────────────────────────────────────────────────────────
const DEFEITOS_DE_REDACAO: Array<[string, RegExp]> = [
  ['plural depois de 1 («1 horas», «1 partes»)', /(^|[^\d,.])1 (?!real\b)[a-zA-ZÀ-ÿ-]+s\b/],
  ['verbo no plural depois de 1 («1 falam»)', /(^|[^\d,.])1 (?:falam|jogam|tocam|sabem|têm|pediram|fazem)\b/],
  ['«quantos» + substantivo feminino («quantos bicicletas»)', /quantos (?:peças|páginas|bicicletas|figurinhas|unidades)/],
  ['«quantas» + substantivo masculino', /quantas (?:litros|pães|parafusos|quilowatts-hora|pontos)/],
  // «?» é também a INCÓGNITA da conta («está para ?: ? = 105»): só é defeito quando fecha a frase, não quando é símbolo no meio dela
  ['espaço duplo ou espaço antes de pontuação', /\s{2,}|\s[,.;](?!\s*=)|\s:(?!\s*\?)|[a-zà-ú]\s\?(?=\s*(?:\)|$))/i],
  ['falta vírgula depois de «ponte»/«vila»', /(?:ponte|vila) (?:três|duas|dois|cuida|espera)/],
  ['numeral com o gênero errado («os duas», «as dois»)', /\b(?:os duas|as dois)\b/],
  ['«a A a cada»: falta dizer o que é «A» (linha, sino...)', /\ba [A-D] a cada\b/],
]

/**
 * INVARIANTES por gerador: as mesmas guardas que o sorteio aplica, escritas AQUI de forma independente. Valem para QUALQUER problema que
 * o gerador entregue, e por isso também para a RESERVA e para o que sai com um rng teimoso: sem isso, uma reserva «válida para o solver»
 * mas ruim para o aluno (razão 3 para 3, «1 horas») passaria. Origem: o mutante «reserva da razão com a = b» sobreviveu.
 */
const INVARIANTES: Record<string, (p: Record<string, unknown>) => string | null> = {
  g3_mmc_coincidencia: (p) => {
    const ps = p.periodos as number[]
    return ps.length >= 2 && ps.every((x) => x >= 2) && new Set(ps).size === ps.length ? null : `períodos inválidos (${ps.join(',')}): precisa de >= 2 períodos distintos, todos >= 2`
  },
  g4_problema_regra3_inversa_equipe: (p) => {
    const [p1, t1, p2] = [num(p.p1), num(p.t1), num(p.p2)]
    const ans = (p1 * t1) / p2
    return p1 !== p2 && t1 >= 2 && ans >= 2 && ![t1, ans].some((v) => v === p1 || v === p2) ? null : `números repetidos em papéis diferentes ou tempo < 2 (p1=${p1}, t1=${t1}, p2=${p2}, resposta=${ans})`
  },
  g3_regra3_direta_producao: (p) => (num(p.a) !== num(p.c) && num(p.a) >= 2 && num(p.c) >= 2 ? null : `tempos iguais ou < 2 (a=${num(p.a)}, c=${num(p.c)})`),
  g3_media_nota_que_falta: (p) => {
    const notas = p.notas as number[]
    return notas.every((v) => v >= 2 && v <= 10) && num(p.x) >= 3 && num(p.x) <= 10 && num(p.n) === notas.length + 1 ? null : `notas fora de 2..10 ou nota que falta fora de 3..10 (${notas.join(',')} + ${num(p.x)})`
  },
  g3_conjuntos_uniao_inter: (p) => (num(p.ambos) >= 2 && num(p.nenhum) >= 1 && num(p.soA) >= 2 && num(p.soB) >= 2 ? null : `regiões do diagrama fora do intervalo (ambos=${num(p.ambos)}, nenhum=${num(p.nenhum)})`),
  g3_razao_dividir_proporcional: (p) => (num(p.a) !== num(p.b) && num(p.a) >= 2 && num(p.b) >= 2 ? null : `razão ${num(p.a)}:${num(p.b)} inválida (as partes precisam ser diferentes e >= 2: «1 partes» e «razão de 3 para 3» não são problema)`),
  g4_problema_senhores_do_tempo_divisores: (p) => (num(p.n) >= 12 && num(p.n) <= 360 && (p.m === undefined || (num(p.m) > num(p.n) && num(p.m) <= 360)) ? null : `n=${num(p.n)} m=${String(p.m)} fora de 12..360 (ou m <= n)`),
  g4_torneiras_em_paralelo: (p) => (num(p.t1) !== num(p.t2) && num(p.T) >= 2 && num(p.t1) <= 60 && num(p.t2) <= 60 ? null : `tempos iguais ou fora de 60 (t1=${num(p.t1)}, t2=${num(p.t2)}, T=${num(p.T)})`),
}

/**
 * Confere UM problema de um gerador (a mesma régua para o sorteio, a reserva e o rng teimoso): estrutura, lixo, solver independente,
 * números do enunciado vindos dos params, invariantes do gerador, português em tudo que o jogador lê e tamanho do enunciado.
 */
function conferir(g: (typeof GERADORES_PROBLEMAS)[number], c: ReturnType<(typeof GERADORES_PROBLEMAS)[number]['synthesize']>, onde: string): void {
  const resolver = RESOLVEDORES[g.archetypeId]
  assert(resolver, `L7: sem solver independente para ${g.archetypeId}`)
  // (2) estrutura
  assert(c.choices.length === 4, `${onde}: ${c.choices.length} alternativas (esperava 4)`)
  assert(c.choices.filter((x) => x.isCorrect).length === 1, `${onde}: não há exatamente 1 alternativa certa`)
  assert(new Set(c.choices.map((x) => x.label.trim())).size === 4, `${onde}: rótulos repetidos: ${c.choices.map((x) => x.label).join(' | ')}`)
  assert(new Set(c.choices.map((x) => Math.round(x.value * 1e4) / 1e4)).size === 4, `${onde}: valores repetidos`)
  assert(c.choices.every((x) => x.diagnosticPt.trim().length >= 10), `${onde}: alternativa sem diagnóstico`)
  assert(c.methods.length >= 2, `${onde}: menos de 2 jeitos de resolver`)
  assert(Number.isInteger(c.correctValue) && c.correctValue > 0, `${onde}: resposta ${c.correctValue} não é inteiro positivo`)
  const certa = c.choices.find((x) => x.isCorrect)
  assert(certa && certa.value === c.correctValue, `${onde}: correctValue != alternativa certa`)
  // (3) sem lixo
  const textos = [c.questionPt, c.luzGuiaPt, c.stepByStepPt, c.guidedWalkthroughPt, c.realLifeTipPt, ...c.choices.map((x) => `${x.label} ${x.diagnosticPt}`)]
  for (const t of textos) assert(!LIXO.test(t), `${onde}: lixo no texto «${t.match(LIXO)?.[0]}»`)
  // (1) solver independente
  const params = c.params as Record<string, unknown> | undefined
  assert(params, `${onde}: o gerador não devolveu \`params\` (o teste precisa deles para conferir texto × conta)`)
  const esperado = resolver(params)
  assert(esperado !== null, `${onde}: o solver de força bruta não achou resposta inteira para ${JSON.stringify(params)}`)
  assert(c.correctValue === esperado, `${onde}: resposta ${c.correctValue} != força bruta ${esperado} para ${JSON.stringify(params)}`)
  // (7) O DIAGNÓSTICO DE UMA ALTERNATIVA ERRADA NÃO ENTREGA A RESPOSTA CERTA. O modal mostra esse texto SEM o aluno pedir (logo após o erro): se ele
  // diz «… = 27» e 27 é a certa, o aluno clica em 27 sem entender e a regra «errou, perde metade do buff» deixa de ensinar. Medido nesta sessão: 33,8 %
  // das alternativas erradas do jogo vazavam (18 geradores antigos; 98 % no corte cruzado) e 1,1 % dos meus 8 (a média: «48 é a SOMA… (8 × 6)» com 8 = certa;
  // conjuntos: «Use 9»). EXCEÇÃO: o valor que já está NO ENUNCIADO não é segredo (o aluno o vê). A Luz-Guia e os passos PODEM conter a resposta: são ajuda pedida.
  {
    const certa = String(c.correctValue)
    // Um «-» colado antes do número é SINAL, não o valor: «a diferença de tempo (-10)» é uma diferença negativa que por acaso tem o módulo da resposta.
    const valorIsolado = (n: number, texto: string): boolean => new RegExp(`(^|[^0-9-])${n}([^0-9]|$)`).test(texto)
    // SEM exceção para «o valor já está no enunciado»: na média, M e n aparecem no enunciado COMO DADOS, e uma resposta igual a M é exatamente o erro
    // típico («tirar a própria média»): a exceção desligava a checagem nos casos que vazam (o mutante «x pode ser M ou n» sobrevivia; enumerei: 22 de 90
    // combinações vazavam sem a guarda do gerador e 0 com ela).
    for (const ch of c.choices.filter((x) => !x.isCorrect)) {
      assert(!valorIsolado(c.correctValue, ch.diagnosticPt), `${onde}: o diagnóstico da alternativa errada «${ch.label}» ENTREGA a resposta certa (${certa}): «${ch.diagnosticPt}»`)
    }
  }
  // (6) invariantes do gerador (as guardas do sorteio, escritas de forma independente)
  const quebrou = INVARIANTES[g.archetypeId](params)
  assert(quebrou === null, `${onde}: invariante do gerador violado: ${quebrou}`)
  // (4) os números que o aluno lê vêm dos params
  for (const k of LIDOS_NO_ENUNCIADO[g.archetypeId](params)) assert(numeroNoTexto(num(params[k]), c.questionPt), `${onde}: param ${k}=${String(params[k])} NÃO aparece no enunciado`)
  if (g.archetypeId === 'g3_media_nota_que_falta') for (const v of params.notas as number[]) assert(numeroNoTexto(v, c.questionPt), `${onde}: nota ${v} fora do enunciado`)
  if (g.archetypeId === 'g3_mmc_coincidencia') {
    const lidos = [...c.questionPt.matchAll(/a cada (\d+) (?:segundos|minutos)/g)].map((m) => Number(m[1]))
    assert(lidos.join() === (params.periodos as number[]).join(), `${onde}: períodos do TEXTO (${lidos.join()}) != params (${(params.periodos as number[]).join()})`)
    // o numeral por extenso do enunciado («dois sinalizadores», «os dois») tem de ser a quantidade REAL de períodos listados
    const numerais = [...c.questionPt.matchAll(/\b(dois|duas|três|quatro)\b/g)].map((m) => ({ dois: 2, duas: 2, três: 3, quatro: 4 })[m[1] as 'dois' | 'duas' | 'três' | 'quatro'])
    assert(numerais.length >= 1, `${onde}: o enunciado não diz quantos períodos há`)
    assert(numerais.every((v) => v === lidos.length), `${onde}: o enunciado diz ${numerais.join('/')} mas lista ${lidos.length} períodos`)
  }
  // (5) português: no enunciado, nas alternativas e nos diagnósticos (o jogador lê os três), e na dica e nos jeitos (aparecem quando a dica sob demanda existir)
  const visiveis = [c.questionPt, ...c.choices.flatMap((x) => [x.label, x.diagnosticPt]), c.luzGuiaPt, c.stepByStepPt, ...c.methods.map((m) => m.summary)]
  for (const t of visiveis) for (const [nome, re] of DEFEITOS_DE_REDACAO) assert(!re.test(t), `${onde}: ${nome}: «${t.match(re)?.[0]}» em «${t}»`)
  assert(c.questionPt.length <= 260, `${onde}: enunciado com ${c.questionPt.length} caracteres (teto 260: o motor atual vai até 260 e o modal roda a 0,1×)`)
}

export function run(): void {
  assert(GERADORES_PROBLEMAS.length === 8, `L7: esperava 8 geradores de problema, achei ${GERADORES_PROBLEMAS.length}`)
  const ids = GERADORES_PROBLEMAS.map((g) => g.archetypeId)
  assert(new Set(ids).size === ids.length, 'L7: archetypeId repetido entre os geradores novos')
  for (const substituido of ['g4_problema_regra3_inversa_equipe', 'g4_problema_senhores_do_tempo_divisores']) assert(ids.includes(substituido), `L7: o gerador novo de ${substituido} tem de SUBSTITUIR o antigo (mesmo archetypeId): sem isso o arquétipo de poucas variantes continua no sorteio`)

  // helpers puros
  assert(mdc(12, 18) === 6 && mdc(7, 13) === 1, 'L7: mdc')
  assert(mmc2(4, 6) === 12 && mmc2(5, 7) === 35, 'L7: mmc2')
  assert(mmcLista([4, 6, 10]) === 60, 'L7: mmcLista(4,6,10) = 60')
  const a = semente(42)
  const b = semente(42)
  assert(a() === b() && a() === b(), 'L7: semente igual dá a mesma sequência (testes reproduzíveis)')
  assert(embaralhar(semente(1), [1, 2, 3, 4, 5]).slice().sort().join() === '1,2,3,4,5', 'L7: embaralhar é permutação')
  // quatro(): cada regra de descarte precisa de um caso que SÓ ela detecta (um «negativo» depois de 3 erros válidos nunca seria lido)
  const so = (erros: Array<{ value: number; diagnosticPt: string }>) => quatro(semente(3), 10, 'ok', erros)
  const valida = (q: ReturnType<typeof so>, quando: string) => {
    assert(q.length === 4 && new Set(q.map((x) => x.value)).size === 4, `L7: quatro() ${quando}: devolve 4 valores distintos`)
    assert(q.filter((x) => x.isCorrect).length === 1 && q.every((x) => x.diagnosticPt.length > 0), `L7: quatro() ${quando}: 1 certa e todas com diagnóstico`)
    assert(q.every((x) => x.value > 0), `L7: quatro() ${quando}: nenhuma alternativa ≤ 0 (o aluno não escolhe «−4 horas»)`)
    assert(q.every((x) => Number.isFinite(x.value) && !/Infinity|NaN/.test(x.label)), `L7: quatro() ${quando}: nenhuma alternativa infinita ou NaN (o rótulo diria «Infinity»)`)
  }
  const d = (value: number) => ({ value, diagnosticPt: `erro ${value}` })
  valida(so([d(10), d(12), d(12), d(14), d(16)]), 'com valor igual à certa e valor repetido')
  valida(so([d(-4), d(12), d(14), d(16)]), 'com valor negativo no PRIMEIRO lugar')
  valida(so([d(0), d(12), d(14), d(16)]), 'com valor zero no primeiro lugar')
  valida(so([d(Number.NaN), d(12), d(14), d(16)]), 'com NaN')
  valida(so([d(Number.POSITIVE_INFINITY), d(12), d(14), d(16)]), 'com Infinity')
  valida(so([d(12)]), 'com poucos erros (completa com vizinhos)')
  valida(so([]), 'sem erro nenhum (completa com vizinhos)')
  const pequena = quatro(semente(9), 2, 'ok', [], { singular: 'hora', plural: 'horas' })
  assert(pequena.every((x) => (x.value === 1 ? x.label === '1 hora' : x.label === `${x.value} horas`)), `L7: sufixo singular/plural: ${pequena.map((x) => x.label).join(' | ')}`)
  assert(quatro(semente(2), 1, 'ok', [], { singular: 'hora', plural: 'horas' }).find((x) => x.isCorrect)?.label === '1 hora', 'L7: a certa com valor 1 vira «1 hora»')

  // ── tentar(): um gerador nunca pode travar a aba. O laço sem limite («for (;;) { ... continue }») congelaria o jogo no modal da conta
  // se uma edição futura tornasse a condição de aceite impossível (mostrado pelo mutante «divisores comuns com ||»: 197 s de CPU a 100 %).
  const semente0 = semente(1)
  let chamadas = 0
  const aceita = tentar(semente0, () => { chamadas++; return chamadas >= 3 ? 'ok' : null }, () => 'reserva')
  assert(aceita === 'ok' && chamadas === 3, `L7: tentar() devolve o primeiro resultado aceito (${aceita} em ${chamadas} chamadas)`)
  let impossiveis = 0
  const reserva = tentar(semente0, () => { impossiveis++; return null }, () => 'reserva')
  assert(reserva === 'reserva', 'L7: tentar() com condição impossível devolve a RESERVA (nunca trava)')
  assert(impossiveis === MAX_TENTATIVAS, `L7: tentar() para em exatamente ${MAX_TENTATIVAS} tentativas (parou em ${impossiveis})`)
  // a reserva de CADA gerador real é um problema válido e correto (senão o fallback viraria um defeito silencioso)
  for (const g of GERADORES_PROBLEMAS) {
    conferir(g, g.reserva(), `L7 reserva de ${g.archetypeId}`)
  }
  // NUNCA TRAVA: com um rng que devolve SEMPRE o mesmo valor, quase nenhum sorteio fecha a condição de aceite (ex.: «a === c» sempre).
  // O gerador tem de TERMINAR (o `tentar` desiste em MAX_TENTATIVAS) e devolver um problema válido, em vez de congelar o jogo.
  // O tempo é medido: um laço sem teto não passaria daqui (o mutante «divisores comuns com ||» queimou 197 s a 100 % de CPU).
  // CONTROLE DO INSTRUMENTO: um rng constante só exercita a reserva se o gerador REJEITAR aquele valor em todas as tentativas. Medido: com
  // 0 / 0,5 / 0,999999 esgotam 4 / 2 / 1 dos 8 geradores. Por isso o teste conta quantos geradores foram de fato levados à reserva e exige
  // que seja pelo menos 4 (sem esse piso, um teste «verde» poderia não exercitar o fallback de gerador nenhum).
  const levadosAReserva = new Set<string>()
  for (const valorFixo of [0, 0.25, 0.5, 0.75, 0.999999]) {
    const rngTeimoso = () => valorFixo
    for (const g of GERADORES_PROBLEMAS) {
      const inicio = Date.now()
      const p = g.synthesize(rngTeimoso)
      const gasto = Date.now() - inicio
      assert(gasto < 2000, `L7 ${g.archetypeId}: levou ${gasto} ms com um rng teimoso (${valorFixo}): o sorteio não tem teto e travaria o jogo`)
      conferir(g, p, `L7 ${g.archetypeId} com rng teimoso (${valorFixo})`)
      if (p.questionPt === g.reserva().questionPt) levadosAReserva.add(g.archetypeId)
    }
  }
  assert(levadosAReserva.size >= 4, `L7: o instrumento do rng teimoso só levou ${levadosAReserva.size} gerador(es) à reserva (${[...levadosAReserva].join(', ')}): ele não está provando o fallback`)

  for (const g of GERADORES_PROBLEMAS) {
    const enunciados = new Set<string>()
    for (let s = 1; s <= SEMENTES; s++) {
      const c = g.synthesize(semente(s))
      conferir(g, c, `L7 ${g.archetypeId}#${s}`)
      enunciados.add(c.questionPt)
    }
    // variedade: o motivo de existirem. O antigo tinha 8; qualquer gerador novo precisa de muito mais.
    const piso = PISO_POR_GERADOR[g.archetypeId] ?? PISO_DE_VARIEDADE
    assert(enunciados.size >= piso, `L7 ${g.archetypeId}: só ${enunciados.size} enunciados distintos em ${SEMENTES} sementes (mínimo ${piso}; os antigos tinham 8 a 12)`)
  }

  // ── INTEGRAÇÃO: um gerador que o motor nunca sorteia não resolve nada ────────────────────────────────────────────────
  const noMotor = listarArquetipos()
  const idsDoMotor = noMotor.map((a) => a.archetypeId)
  assert(new Set(idsDoMotor).size === idsDoMotor.length, `L7: o motor tem archetypeId duplicado: ${idsDoMotor.filter((id, i) => idsDoMotor.indexOf(id) !== i).join(', ')} (o substituído deveria SAIR do motor)`)
  for (const g of GERADORES_PROBLEMAS) {
    const dele = noMotor.find((a) => a.archetypeId === g.archetypeId)
    assert(dele, `L7: o motor não tem o gerador ${g.archetypeId}`)
    assert(dele.tier === g.tier, `L7: ${g.archetypeId} está no grau ${dele.tier} do motor, mas o gerador diz ${g.tier}`)
  }
  assert(noMotor.length === 20 + 6, `L7: esperava 26 arquétipos no motor (20 antigos − 2 substituídos + 8 novos), achei ${noMotor.length}`)
  // só os 2 substituídos saem: os outros 18 continuam, com o mesmo id
  for (const id of ['g1_massinha_soma', 'g2_pemdas_trincheira', 'g3_fator_comum_evidencia', 'g4_problema_tanque_fracoes', 'g4_problema_heranca_restante']) {
    assert(idsDoMotor.includes(id), `L7: o arquétipo ${id} sumiu do motor (só os 2 de poucas variantes deveriam ser substituídos)`)
  }
  // o gerador do motor para a regra de 3 inversa é o NOVO (variedade), e não o de 8 pares
  const textos = new Set<string>()
  for (let s = 1; s <= 400; s++) {
    const c = generateInfiniteChallenge({ tier: 4, seed: s * 7919, preferredConceptId: undefined, excludeSignatures: [] })
    if (c.archetypeId === 'g4_problema_regra3_inversa_equipe') textos.add(c.questionPt)
  }
  assert(textos.size === 0 || textos.size > 8, `L7: o motor ainda usa o gerador de 8 pares para a regra de 3 inversa (só ${textos.size} enunciados distintos)`)
  // o grau 4 e o grau 3 do motor sorteiam os arquétipos NOVOS (não ficam só nos antigos)
  const vistos = new Set<string>()
  for (let s = 1; s <= 600; s++) for (const tier of [3, 4] as const) vistos.add(generateInfiniteChallenge({ tier, seed: s * 104729 }).archetypeId)
  for (const g of GERADORES_PROBLEMAS) assert(vistos.has(g.archetypeId), `L7: ${g.archetypeId} nunca foi sorteado pelo motor em 1.200 chamadas`)
}
