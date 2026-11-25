import { TarefaFatiada, type Etapa } from './tarefaFatiada'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Uma etapa de mentira: `unidades` de trabalho, cada uma custa `custoMs` de um relógio SIMULADO (o teste não depende da velocidade da máquina). */
function etapaDeMentira(nome: string, unidades: number, relogio: { agora: number }, custoMs: number, log: string[]): Etapa {
  let feitas = 0
  return {
    nome,
    total: unidades,
    // faz UMA unidade e devolve se a etapa terminou
    fazerUma() {
      relogio.agora += custoMs
      feitas += 1
      log.push(`${nome}${feitas}`)
      return feitas >= unidades
    },
  }
}

/**
 * O FATIAMENTO de trabalho pesado em fatias de tempo (24/11/2026). A geração de texturas do bioma custa de 280 a 540 ms na thread principal (medido: 3,1 milhões de chamadas de ruído por pacote) e congelava
 * o jogo ~28 quadros a cada troca de bioma. A `TarefaFatiada` roda uma lista de ETAPAS em pedaços limitados por um orçamento em milissegundos (como o `gerarRelevoFatiado` fez com o relevo), sem nunca
 * parar o laço do jogo. Aqui o RELÓGIO é simulado: o teste não depende da máquina, e prova a regra («nunca estoura o orçamento por mais de uma unidade, sempre avança, mesma ordem do síncrono»).
 */
export function run(): void {
  // ── 1. O ORÇAMENTO: cada passo gasta ATÉ o orçamento (mais, no máximo, a unidade que estava em curso), e a tarefa termina. ─────────────────────────────────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    const log: string[] = []
    const tarefa = new TarefaFatiada([etapaDeMentira('A', 30, relogio, 1, log), etapaDeMentira('B', 20, relogio, 1, log)], () => relogio.agora)
    let passos = 0
    let maiorGasto = 0
    while (!tarefa.terminou()) {
      const antes = relogio.agora
      tarefa.passo(4)
      maiorGasto = Math.max(maiorGasto, relogio.agora - antes)
      passos += 1
      assert(passos < 1000, 'a tarefa tem de terminar (nunca um laço sem fim)')
    }
    assert(maiorGasto <= 4 + 1, `nenhum passo estoura o orçamento de 4 ms por mais de UMA unidade de 1 ms (o maior gasto foi ${maiorGasto})`)
    assert(passos >= 12 && passos <= 14, `50 unidades de 1 ms em fatias de 4 ms levam ~13 passos (veio ${passos})`)
    assert(log.length === 50, `as 50 unidades foram feitas, nem mais nem menos (${log.length})`)
  }

  // ── 2. A ORDEM é a do código síncrono: todas as unidades da etapa A, depois todas da B. (O resultado fatiado tem de ser IDÊNTICO ao síncrono.) ───────────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    const sincrono: string[] = []
    const fatiado: string[] = []
    const montar = (log: string[]) => [etapaDeMentira('A', 7, relogio, 1, log), etapaDeMentira('B', 5, relogio, 1, log), etapaDeMentira('C', 3, relogio, 1, log)]
    const t0 = new TarefaFatiada(montar(sincrono), () => relogio.agora)
    t0.terminarTudo()
    const t1 = new TarefaFatiada(montar(fatiado), () => relogio.agora)
    while (!t1.terminou()) t1.passo(3)
    assert(JSON.stringify(sincrono) === JSON.stringify(fatiado), 'fatiar não muda a ORDEM do trabalho: o resultado é idêntico ao síncrono (`terminarTudo`)')
    assert(sincrono.join(',') === 'A1,A2,A3,A4,A5,A6,A7,B1,B2,B3,B4,B5,C1,C2,C3', 'a ordem é A inteira, B inteira, C inteira')
  }

  // ── 3. SEMPRE AVANÇA: com orçamento 0, negativo ou NaN, cada passo faz ao menos UMA unidade (senão a tarefa não terminaria nunca e o chão ficaria sem textura para sempre). ───────────────────────────────
  for (const orcamento of [0, -5, Number.NaN, Number.NEGATIVE_INFINITY]) {
    const relogio = { agora: 0 }
    const log: string[] = []
    const tarefa = new TarefaFatiada([etapaDeMentira('A', 10, relogio, 1, log)], () => relogio.agora)
    let passos = 0
    while (!tarefa.terminou() && passos < 100) {
      const antes = log.length
      tarefa.passo(orcamento)
      assert(log.length >= antes + 1, `com orçamento ${String(orcamento)} o passo faz ao menos uma unidade`)
      passos += 1
    }
    assert(tarefa.terminou() && passos === 10, `com orçamento ${String(orcamento)} a tarefa termina em 10 passos de 1 unidade (veio ${passos})`)
  }

  // ── 4. PROGRESSO: de 0 a 1, monotônico, e exatamente 1 no fim; e `terminou` só no fim. ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    const log: string[] = []
    const tarefa = new TarefaFatiada([etapaDeMentira('A', 10, relogio, 1, log), etapaDeMentira('B', 30, relogio, 1, log)], () => relogio.agora)
    assert(tarefa.progresso() === 0 && !tarefa.terminou(), 'no começo o progresso é 0 e não terminou')
    let ultimo = 0
    while (!tarefa.terminou()) {
      tarefa.passo(5)
      const p = tarefa.progresso()
      assert(p >= ultimo && p <= 1, `o progresso nunca diminui nem passa de 1 (${ultimo} → ${p})`)
      ultimo = p
    }
    assert(tarefa.progresso() === 1, 'no fim o progresso é exatamente 1')
    const logAntes = log.length
    tarefa.passo(10)
    assert(log.length === logAntes, 'passo depois do fim não faz nada (idempotente)')
  }

  // ── 5. ETAPA VAZIA e LISTA VAZIA: não travam nem dividem por zero. ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    const vazia = new TarefaFatiada([], () => relogio.agora)
    assert(vazia.terminou() && vazia.progresso() === 1, 'uma tarefa sem etapas já nasce terminada (progresso 1, sem NaN)')
    const log: string[] = []
    const comVazia = new TarefaFatiada([etapaDeMentira('V', 0, relogio, 1, log), etapaDeMentira('A', 3, relogio, 1, log)], () => relogio.agora)
    comVazia.terminarTudo()
    assert(log.join(',') === 'A1,A2,A3' && comVazia.terminou(), 'uma etapa de 0 unidades é pulada sem travar e sem fazer trabalho fantasma')
  }

  // ── 6. CANCELAR: parar no meio sem terminar (o jogador trocou de bioma de novo antes de o pacote ficar pronto); depois de cancelada, nenhuma unidade roda e `terminou` fica falso (nunca se entrega pela metade). ──
  {
    const relogio = { agora: 0 }
    const log: string[] = []
    const tarefa = new TarefaFatiada([etapaDeMentira('A', 20, relogio, 1, log)], () => relogio.agora)
    tarefa.passo(5)
    const feitas = log.length
    tarefa.cancelar()
    tarefa.passo(100)
    assert(log.length === feitas, 'depois de cancelada nenhuma unidade roda')
    assert(!tarefa.terminou() && tarefa.cancelada(), 'cancelada NÃO conta como terminada (o resultado pela metade nunca é entregue)')
  }

  // ── 6b. A ENUMERAÇÃO EXAUSTIVA (9.828 combinações de configurações de etapas × sequências de operações, 24/11) achou 9 lacunas dos cenários acima. Cada um dos cenários abaixo é a sequência MÍNIMA que
  //    distingue o código real do mutante correspondente. ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // T4: o orçamento é ESTRITO (`<`), não `<=`. Orçamento 3 ms com unidades de 1 ms: o passo faz 3 unidades (a 4ª já passaria do orçamento), e não 4.
  {
    const relogio = { agora: 0 }
    const log: string[] = []
    const tarefa = new TarefaFatiada([etapaDeMentira('A', 10, relogio, 1, log)], () => relogio.agora)
    tarefa.passo(3)
    assert(log.length === 3, `orçamento 3 ms com unidades de 1 ms faz exatamente 3 unidades (veio ${log.length}): com <= faria 4`)
  }
  // T5 e T7: orçamento NaN ou infinito NÃO viram «sem limite»: NaN vale 0 (faz 1 unidade); Infinity também é rejeitado como orçamento (não é finito) e vale 0, em vez de monopolizar o quadro.
  for (const orcamento of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const relogio = { agora: 0 }
    const log: string[] = []
    const tarefa = new TarefaFatiada([etapaDeMentira('A', 10, relogio, 1, log)], () => relogio.agora)
    tarefa.passo(orcamento)
    assert(log.length === 1 && !tarefa.terminou(), `orçamento ${String(orcamento)} vale 0: faz UMA unidade e devolve o controle (veio ${log.length}); um orçamento sem limite travaria o quadro`)
  }
  // T8 e T9: a etapa termina por QUALQUER dos dois critérios, o `true` de `fazerUma` OU o total. Uma etapa que devolve `true` antes do total (terminou cedo) tem de avançar; uma que NUNCA devolve
  // `true` tem de avançar ao atingir o total (senão o laço não termina).
  {
    const relogio = { agora: 0 }
    const log: string[] = []
    let n = 0
    const cedo: Etapa = { nome: 'cedo', total: 5, fazerUma() { relogio.agora += 1; n += 1; log.push(`c${n}`); return n >= 2 } } // diz que terminou na 2ª, apesar do total 5
    const depois = etapaDeMentira('D', 2, relogio, 1, log)
    const tarefa = new TarefaFatiada([cedo, depois], () => relogio.agora)
    tarefa.terminarTudo()
    assert(log.join(',') === 'c1,c2,D1,D2', `uma etapa que devolve true na 2ª unidade termina ali (e não nas 5 do total): ${log.join(',')}`)
    const relogio2 = { agora: 0 }
    const log2: string[] = []
    const nunca: Etapa = { nome: 'nunca', total: 3, fazerUma() { relogio2.agora += 1; log2.push('n'); return false } } // nunca devolve true: só o total a encerra
    const t2 = new TarefaFatiada([nunca, etapaDeMentira('E', 1, relogio2, 1, log2)], () => relogio2.agora)
    t2.terminarTudo()
    assert(log2.join(',') === 'n,n,n,E1' && t2.terminou(), `uma etapa que nunca devolve true termina ao atingir o total (${log2.join(',')})`)
  }
  // T11: uma etapa VAZIA NO MEIO da lista é pulada (o cenário 5 só a colocava no começo, que o construtor já tratava).
  {
    const relogio = { agora: 0 }
    const log: string[] = []
    const tarefa = new TarefaFatiada([etapaDeMentira('A', 2, relogio, 1, log), etapaDeMentira('V', 0, relogio, 1, log), etapaDeMentira('B', 2, relogio, 1, log)], () => relogio.agora)
    tarefa.terminarTudo()
    assert(log.join(',') === 'A1,A2,B1,B2' && tarefa.terminou(), `uma etapa vazia ENTRE duas etapas é pulada (${log.join(',')})`)
  }
  // T13: uma tarefa cancelada NUNCA conta como terminada, nem se TODAS as unidades já tinham sido feitas (cancelar depois do fim): o chamador não pode usar o resultado de uma tarefa cancelada.
  {
    const relogio = { agora: 0 }
    const log: string[] = []
    const tarefa = new TarefaFatiada([etapaDeMentira('A', 2, relogio, 1, log)], () => relogio.agora)
    tarefa.terminarTudo()
    assert(tarefa.terminou(), 'terminou')
    tarefa.cancelar()
    assert(!tarefa.terminou() && tarefa.cancelada(), 'cancelar DEPOIS de terminar também desfaz o `terminou` (o consumidor que cancela não pode mais usar o resultado)')
  }
  // T16: depois de falhar, NENHUM passo chama a etapa de novo (contado: a etapa que lança conta as chamadas; o cenário 7 só via que o erro continuava registrado, o que vale também se ela fosse chamada de novo).
  {
    const relogio = { agora: 0 }
    let chamadas = 0
    const quebrada: Etapa = { nome: 'Q', total: 5, fazerUma() { relogio.agora += 1; chamadas += 1; throw new Error('boom') } }
    const tarefa = new TarefaFatiada([quebrada], () => relogio.agora)
    tarefa.passo(10)
    tarefa.passo(10)
    tarefa.terminarTudo()
    assert(chamadas === 1, `depois de falhar a etapa NÃO é chamada de novo (foi chamada ${chamadas}×)`)
  }
  // T20: uma etapa de total NEGATIVO conta como 0 unidades (nem soma negativa no progresso, nem trabalho): a lista [−2, 2] tem progresso 0,5 depois de 1 unidade das 2 (e não 1).
  {
    const relogio = { agora: 0 }
    const log: string[] = []
    const tarefa = new TarefaFatiada([etapaDeMentira('N', -2, relogio, 1, log), etapaDeMentira('B', 2, relogio, 1, log)], () => relogio.agora)
    assert(tarefa.progresso() === 0, `uma etapa de total negativo não conta como trabalho feito (progresso inicial ${tarefa.progresso()})`)
    tarefa.passo(0)
    assert(tarefa.progresso() === 0.5, `1 unidade de 2 reais = 0,5 (veio ${tarefa.progresso()}): o total negativo não pode inflar nem reduzir o divisor`)
  }
  // T21: `terminarTudo` PARA quando uma etapa lança (sem isto era um laço sem fim: a etapa lança, o erro é registrado e o laço nunca vê a condição de saída). Contado: a etapa é chamada UMA vez.
  {
    const relogio = { agora: 0 }
    let chamadas = 0
    const quebrada: Etapa = { nome: 'Q', total: 5, fazerUma() { relogio.agora += 1; chamadas += 1; if (chamadas > 20) throw new Error('LIMITE: laço sem fim') ; throw new Error('boom') } }
    const tarefa = new TarefaFatiada([quebrada], () => relogio.agora)
    tarefa.terminarTudo()
    assert(chamadas === 1 && tarefa.falhou() !== null && !tarefa.terminou(), `terminarTudo para na 1ª falha (a etapa foi chamada ${chamadas}×, não em laço)`)
  }

  // ── 7. UMA ETAPA QUE LANÇA ERRO: a tarefa para, devolve o erro e NÃO vira «terminada» (o chamador cai na cor sólida em vez de usar textura corrompida). ─────────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    const quebrada: Etapa = { nome: 'Q', total: 5, fazerUma() { relogio.agora += 1; throw new Error('canvas indisponivel') } }
    const tarefa = new TarefaFatiada([quebrada], () => relogio.agora)
    tarefa.passo(10)
    assert(tarefa.falhou() !== null && String(tarefa.falhou()).includes('canvas indisponivel'), 'o erro da etapa fica registrado')
    assert(!tarefa.terminou(), 'uma tarefa que falhou NÃO conta como terminada')
    tarefa.passo(10)
    assert(tarefa.falhou() !== null, 'e continua falha nos passos seguintes (não tenta de novo em silêncio)')
  }
}
