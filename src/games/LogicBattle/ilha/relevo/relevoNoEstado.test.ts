import type { CampoRelevo } from './campoRelevo'
import { gerarRelevo, limparCacheRelevo, type GeracaoRelevo } from './geradorRelevo'
import { criarRelevoDoMundo, MAX_GERACOES_SIMULTANEAS, ORCAMENTO_POR_QUADRO_MS } from './relevoNoEstado'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Um gerador de mentira: `linhas` passos de 1 «ms simulado»; registra quantos passos recebeu. O relógio é SIMULADO: o teste da política não depende da velocidade da máquina. */
function geradorDeMentira(i: number, j: number, linhas: number, relogio: { agora: number }, vidas: string[]): GeracaoRelevo {
  let feitas = 0
  return {
    passo(orcamentoMs: number): boolean {
      const limite = Number.isFinite(orcamentoMs) && orcamentoMs > 0 ? orcamentoMs : 0
      const inicio = relogio.agora
      do {
        if (feitas >= linhas) break
        relogio.agora += 1
        feitas += 1
      } while (feitas < linhas && relogio.agora - inicio < limite)
      if (feitas >= linhas && !vidas.includes(`${i},${j}:pronto`)) vidas.push(`${i},${j}:pronto`)
      return feitas >= linhas
    },
    terminou: () => feitas >= linhas,
    progresso: () => feitas / linhas,
    resultado(): CampoRelevo {
      if (feitas < linhas) throw new Error('ainda nao terminou')
      return { i, j, alturas: new Float32Array(113 * 113), nivelAgua: -0.4, versao: 1 }
    },
  }
}

/**
 * O CAMPO DE RELEVO NO ESTADO DO MUNDO (F2, 24/11/2026). Gerar um campo de uma vez custa 74 ms (medido) e congelaria ~4 quadros por quadrado novo: o jogador atravessa a fronteira e o vizinho tem de
 * nascer. `criarRelevoDoMundo` gera os campos FATIADOS (`gerarRelevoFatiado`, do F0), com um orçamento total por quadro, e entrega `campoDe(i, j)`: `undefined` ENQUANTO a geração não terminou (o chão é
 * plano: I1, plano = hoje) e o campo depois. A POLÍTICA (quantos ao mesmo tempo, o que sai de vista, o que nunca é gerado duas vezes) é lógica de fila, testada aqui com geradores de mentira.
 */
export function run(): void {
  // ── 1. ANTES DE TERMINAR O CHÃO É PLANO (I1): `campoDe` devolve undefined, e só devolve o campo quando a geração termina. Nunca um campo pela metade. ──────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    const vidas: string[] = []
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => geradorDeMentira(i, j, 10, relogio, vidas), agora: () => relogio.agora })
    assert(mundo.campoDe(0, 0) === undefined, 'um quadrado que ninguém pediu ainda não tem campo')
    mundo.pedir(0, 0)
    assert(mundo.campoDe(0, 0) === undefined, 'recém-pedido: ainda sem campo (chão plano)')
    mundo.passo(3)
    assert(mundo.campoDe(0, 0) === undefined, 'a meio caminho: ainda sem campo (nunca um campo pela metade)')
    for (let k = 0; k < 20 && mundo.campoDe(0, 0) === undefined; k += 1) mundo.passo(3)
    assert(mundo.campoDe(0, 0) !== undefined, 'depois de terminar, `campoDe` devolve o campo')
    assert(mundo.campoDe(0, 0)?.i === 0 && mundo.campoDe(0, 0)?.j === 0, 'e é o campo do quadrado pedido')
  }

  // ── 2. NUNCA GERA O MESMO QUADRADO DUAS VEZES: pedir de novo (o jogador volta, o horizonte e o terreno pedem o mesmo) não reinicia nem duplica. ─────────────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    let fabricados = 0
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => { fabricados += 1; return geradorDeMentira(i, j, 5, relogio, []) }, agora: () => relogio.agora })
    mundo.pedir(1, 1)
    mundo.pedir(1, 1)
    mundo.passo(2)
    mundo.pedir(1, 1)
    for (let k = 0; k < 20; k += 1) mundo.passo(3)
    mundo.pedir(1, 1) // já pronto: também não gera de novo
    assert(fabricados === 1, `o quadrado (1,1) foi fabricado ${fabricados}× (precisa ser exatamente 1)`)
  }

  // ── 3. O TETO DE GERAÇÕES SIMULTÂNEAS: o jogador não gasta o orçamento do quadro em 9 vizinhos de uma vez; o excedente espera na fila e começa quando uma vaga abre. ───────────────────────────────
  {
    const relogio = { agora: 0 }
    const iniciados: string[] = []
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => { iniciados.push(`${i},${j}`); return geradorDeMentira(i, j, 8, relogio, []) }, agora: () => relogio.agora })
    for (let k = 0; k < 9; k += 1) mundo.pedir(k, 0)
    mundo.passo(2)
    assert(MAX_GERACOES_SIMULTANEAS >= 1 && MAX_GERACOES_SIMULTANEAS <= 4, `o teto de gerações simultâneas é um número pequeno (${MAX_GERACOES_SIMULTANEAS})`)
    assert(mundo.emAndamento() <= MAX_GERACOES_SIMULTANEAS, `no máximo ${MAX_GERACOES_SIMULTANEAS} geradores em andamento ao mesmo tempo (veio ${mundo.emAndamento()})`)
    assert(mundo.naFila() >= 9 - MAX_GERACOES_SIMULTANEAS - 1, `o excedente espera na fila (${mundo.naFila()} esperando)`)
    // com tempo, TODOS terminam: a fila não trava
    for (let k = 0; k < 400; k += 1) mundo.passo(4)
    for (let k = 0; k < 9; k += 1) assert(mundo.campoDe(k, 0) !== undefined, `o quadrado (${k},0) terminou: a fila não travou`)
  }

  // ── 4. A ORDEM DA FILA: o QUE O JOGADOR PISA (o primeiro pedido) é gerado antes dos vizinhos que só alimentam o horizonte. ─────────────────────────────────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    const iniciados: string[] = []
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => { iniciados.push(`${i},${j}`); return geradorDeMentira(i, j, 6, relogio, []) }, agora: () => relogio.agora })
    mundo.pedir(0, 0)
    mundo.pedir(1, 0)
    mundo.pedir(-1, 0)
    for (let k = 0; k < 100; k += 1) mundo.passo(4)
    assert(iniciados[0] === '0,0', `o primeiro pedido é o primeiro a começar (começou ${iniciados[0]})`)
  }

  // ── 5. O ORÇAMENTO POR QUADRO é respeitado: um `passo(4)` não gasta 4 ms POR gerador, e sim 4 ms no total (o jogo não perde 4 ms vezes N). ─────────────────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => geradorDeMentira(i, j, 200, relogio, []), agora: () => relogio.agora })
    for (let k = 0; k < 4; k += 1) mundo.pedir(k, 0)
    let maiorGasto = 0
    for (let k = 0; k < 30; k += 1) {
      const antes = relogio.agora
      mundo.passo(4)
      maiorGasto = Math.max(maiorGasto, relogio.agora - antes)
    }
    assert(maiorGasto <= 4 + 1, `um passo de 4 ms gasta no máximo 4 ms no TOTAL, mais uma unidade de 1 ms (o maior gasto foi ${maiorGasto})`)
    assert(ORCAMENTO_POR_QUADRO_MS > 0 && ORCAMENTO_POR_QUADRO_MS <= 6, `o orçamento por quadro é de poucos ms (${ORCAMENTO_POR_QUADRO_MS})`)
  }

  // ── 6. SEMPRE AVANÇA: com orçamento 0, negativo ou NaN, cada passo faz ao menos UMA unidade (senão o chão ficaria plano para sempre). ──────────────────────────────────────────────────────────────────
  for (const orcamento of [0, -3, Number.NaN, Number.NEGATIVE_INFINITY]) {
    const relogio = { agora: 0 }
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => geradorDeMentira(i, j, 6, relogio, []), agora: () => relogio.agora })
    mundo.pedir(0, 0)
    for (let k = 0; k < 40 && mundo.campoDe(0, 0) === undefined; k += 1) mundo.passo(orcamento)
    assert(mundo.campoDe(0, 0) !== undefined, `com orçamento ${String(orcamento)} o campo termina (sempre avança)`)
  }

  // ── 7. ESQUECER o que saiu de vista: o jogador foi embora do quadrado; uma geração em andamento é DESCARTADA (não gasta mais orçamento) e um campo pronto fica em cache. ────────────────────────────
  {
    const relogio = { agora: 0 }
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => geradorDeMentira(i, j, 50, relogio, []), agora: () => relogio.agora })
    mundo.pedir(5, 5)
    mundo.passo(3)
    assert(mundo.emAndamento() === 1, 'uma geração em andamento')
    mundo.esquecer(5, 5)
    assert(mundo.emAndamento() === 0 && mundo.naFila() === 0, 'esquecida: não gasta mais orçamento')
    const antes = relogio.agora
    for (let k = 0; k < 10; k += 1) mundo.passo(4)
    assert(relogio.agora === antes, 'depois de esquecer, nenhum passo gasta tempo (nada a fazer)')
    assert(mundo.campoDe(5, 5) === undefined, 'e nunca devolve um campo pela metade')
    mundo.pedir(5, 5) // pedir de novo recomeça do zero, sem lançar
    assert(mundo.emAndamento() === 1, 'pedir de novo recomeça')
  }

  // ── 8. ERRO NA GERAÇÃO: um gerador que lança NÃO derruba o jogo: o quadrado fica sem campo (chão plano), registra a falha e não tenta de novo em laço. ─────────────────────────────────────────────────
  {
    const relogio = { agora: 0 }
    let tentativas = 0
    const quebrado = (): GeracaoRelevo => ({
      passo() { tentativas += 1; throw new Error('boom') },
      terminou: () => false,
      progresso: () => 0,
      resultado() { throw new Error('nunca terminou') },
    })
    const mundo = criarRelevoDoMundo({ fabricar: () => quebrado(), agora: () => relogio.agora })
    mundo.pedir(0, 0)
    for (let k = 0; k < 10; k += 1) mundo.passo(4)
    assert(mundo.campoDe(0, 0) === undefined, 'um gerador que lança deixa o quadrado sem campo (chão plano)')
    assert(tentativas === 1, `e não é chamado de novo em laço (foi chamado ${tentativas}×)`)
    assert(mundo.falhas().length === 1, 'a falha fica registrada')
    assert(mundo.emAndamento() === 0 && mundo.naFila() === 0, 'e a vaga é liberada (não trava a fila)')
  }

  // ── 8b. AS LACUNAS QUE A MUTAÇÃO ACHOU (24/11): o teste passou de primeira e 7 mutantes sobreviveram. Cada cenário abaixo é o MÍNIMO que distingue o código real do mutante. ───────────────────────────
  // E3 (fila LIFO): com MAIS pedidos que vagas, o quadrado que o jogador pisa (o PRIMEIRO pedido) tem de começar ANTES dos que só alimentam o horizonte. O cenário 4 só tinha 3 pedidos, que cabem nas
  // vagas e começam todos de imediato: a ordem da fila nunca era exercitada.
  {
    const relogio = { agora: 0 }
    const iniciados: string[] = []
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => { iniciados.push(`${i},${j}`); return geradorDeMentira(i, j, 4, relogio, []) }, agora: () => relogio.agora })
    for (let k = 0; k < 6; k += 1) mundo.pedir(k, 0) // 6 pedidos, só MAX_GERACOES_SIMULTANEAS vagas: o resto ESPERA na fila
    for (let k = 0; k < 200; k += 1) mundo.passo(2)
    assert(iniciados.join('|') === '0,0|1,0|2,0|3,0|4,0|5,0', `a fila é FIFO: começam na ordem em que foram pedidos (veio ${iniciados.join('|')})`)
  }
  // E7 (conhecido ignora a fila): pedir o MESMO quadrado que ainda ESPERA na fila não o duplica (senão gera duas vezes e gasta o orçamento em dobro).
  {
    const relogio = { agora: 0 }
    const fabricados: string[] = []
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => { fabricados.push(`${i},${j}`); return geradorDeMentira(i, j, 30, relogio, []) }, agora: () => relogio.agora })
    for (let k = 0; k < 5; k += 1) mundo.pedir(k, 0) // 2 em andamento, 3 na fila
    assert(mundo.naFila() === 5 - MAX_GERACOES_SIMULTANEAS, `(controle do cenário) ${5 - MAX_GERACOES_SIMULTANEAS} esperam na fila (veio ${mundo.naFila()})`)
    mundo.pedir(4, 0) // o último da fila, pedido DE NOVO enquanto espera
    mundo.pedir(3, 0)
    assert(mundo.naFila() === 5 - MAX_GERACOES_SIMULTANEAS, `pedir de novo um quadrado que espera na fila NÃO o duplica (a fila tem ${mundo.naFila()})`)
    for (let k = 0; k < 400; k += 1) mundo.passo(3)
    assert(fabricados.length === 5 && new Set(fabricados).size === 5, `cada quadrado foi fabricado uma só vez (${fabricados.join('|')})`)
  }
  // E8 (conhecido ignora as falhas): um quadrado que FALHOU não é tentado de novo só porque alguém o pediu outra vez (o horizonte e o terreno pedem o mesmo a todo quadro: seria um laço de erro).
  {
    const relogio = { agora: 0 }
    let fabricacoes = 0
    // lido por FUNÇÃO: depois de `assert(fabricacoes() === 1)` o TypeScript estreitaria uma variável ao literal 1 e acusaria `=== 2` de impossível, ignorando que o callback a incrementa
    const fabricacoesAgora = (): number => fabricacoes
    const mundo = criarRelevoDoMundo({ fabricar: () => { fabricacoes += 1; return { passo() { throw new Error('boom') }, terminou: () => false, progresso: () => 0, resultado(): CampoRelevo { throw new Error('x') } } }, agora: () => relogio.agora })
    mundo.pedir(0, 0)
    mundo.passo(4) // falha
    for (let k = 0; k < 30; k += 1) { mundo.pedir(0, 0); mundo.passo(4) } // pedido a todo quadro, como o desenho faria
    assert(fabricacoesAgora() === 1, `um quadrado que falhou NÃO é fabricado de novo a cada pedido (foi fabricado ${fabricacoesAgora()}×: seria um laço de erro a 60 por segundo)`)
    // …mas ESQUECER o quadrado (o jogador foi embora) e voltar permite tentar de novo: o erro pode ter sido passageiro
    mundo.esquecer(0, 0)
    mundo.pedir(0, 0)
    assert(fabricacoesAgora() === 2, `depois de esquecer, pedir de novo tenta outra vez (${fabricacoesAgora()} fabricações)`)
  }
  // E11 (chave sem o j): quadrados da MESMA COLUNA e da MESMA LINHA não colidem. (0, 5) e (0, −3) seriam o mesmo quadrado: o relevo de um apareceria no outro.
  {
    const relogio = { agora: 0 }
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => geradorDeMentira(i, j, 3, relogio, []), agora: () => relogio.agora })
    const pares: Array<[number, number]> = [[0, 5], [0, -3], [4, 0], [-4, 0], [4, 1], [1, 4]]
    for (const [i, j] of pares) mundo.pedir(i, j)
    for (let k = 0; k < 300; k += 1) mundo.passo(4)
    for (const [i, j] of pares) {
      const c = mundo.campoDe(i, j)
      assert(c !== undefined && c.i === i && c.j === j, `o campo de (${i},${j}) é o de (${i},${j}), e não o de outro quadrado (veio ${c ? `${c.i},${c.j}` : 'nada'})`)
    }
  }
  // E13 (esquecer não tira da fila): um quadrado que ESPERA na fila e é esquecido NÃO pode começar depois (gastaria orçamento num quadrado que o jogador já deixou).
  {
    const relogio = { agora: 0 }
    const fabricados: string[] = []
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => { fabricados.push(`${i},${j}`); return geradorDeMentira(i, j, 3, relogio, []) }, agora: () => relogio.agora })
    for (let k = 0; k < 4; k += 1) mundo.pedir(k, 0) // 0,1 em andamento; 2,3 na fila
    mundo.esquecer(3, 0) // o último da fila
    for (let k = 0; k < 200; k += 1) mundo.passo(4)
    assert(!fabricados.includes('3,0'), `um quadrado esquecido enquanto esperava na fila NÃO é fabricado depois (fabricados: ${fabricados.join('|')})`)
    assert(mundo.campoDe(3, 0) === undefined, 'e não tem campo')
  }
  // E21 e E22 (o orçamento é do TOTAL): com 2 geradores em andamento, um `passo(4)` gasta 4 ms NO TOTAL, e não 4 ms por gerador. Um gerador de mentira cujas unidades custam 1 ms e que NÃO termina cedo
  // mede o gasto real: o relógio simulado só anda quando um gerador trabalha.
  {
    const relogio = { agora: 0 }
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => geradorDeMentira(i, j, 500, relogio, []), agora: () => relogio.agora })
    mundo.pedir(0, 0)
    mundo.pedir(1, 0)
    assert(mundo.emAndamento() === 2, '(controle) os dois geradores estão em andamento')
    const gastos: number[] = []
    for (let k = 0; k < 20; k += 1) {
      const antes = relogio.agora
      mundo.passo(4)
      gastos.push(relogio.agora - antes)
    }
    const maior = Math.max(...gastos)
    assert(maior <= 5, `com 2 geradores, um passo de 4 ms gasta no máximo 4 ms no TOTAL (mais 1 ms da unidade em curso); o maior gasto foi ${maior}: se passa de 5, cada gerador recebeu o orçamento inteiro`)
    assert(Math.min(...gastos) >= 2, `e o passo não desperdiça o orçamento: gasta ao menos 2 ms (o menor foi ${Math.min(...gastos)})`)
  }
  // E14 (esquecer não abre vaga): ao esquecer um quadrado EM ANDAMENTO, a vaga que ele ocupava vai para o próximo da fila NA HORA (e não só no próximo `passo`). A enumeração de 16.104 sequências achou
  // a menor: pedir 3 quadrados com 2 vagas, esquecer um dos que andam: o terceiro tem de ASSUMIR a vaga imediatamente.
  {
    const relogio = { agora: 0 }
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => geradorDeMentira(i, j, 50, relogio, []), agora: () => relogio.agora })
    mundo.pedir(0, 0)
    mundo.pedir(1, 0)
    mundo.pedir(2, 0) // espera na fila
    assert(mundo.emAndamento() === MAX_GERACOES_SIMULTANEAS && mundo.naFila() === 1, '(controle) 2 em andamento e 1 na fila')
    mundo.esquecer(0, 0)
    assert(mundo.emAndamento() === MAX_GERACOES_SIMULTANEAS && mundo.naFila() === 0, `esquecer um que anda abre a vaga NA HORA para o próximo da fila (${mundo.emAndamento()} em andamento, ${mundo.naFila()} na fila)`)
  }
  // E15 (esquecer não libera a falha): um quadrado que FALHOU fica sem campo e não é tentado de novo em laço; mas se o jogador o ESQUECE (foi embora) e volta, tenta DE NOVO (o erro pode ter sido
  // passageiro). A enumeração achou: pedir, falhar, esquecer, ler `falhas()`: tem de estar VAZIO depois de esquecer.
  {
    const relogio = { agora: 0 }
    const mundo = criarRelevoDoMundo({ fabricar: () => ({ passo() { throw new Error('boom') }, terminou: () => false, progresso: () => 0, resultado(): CampoRelevo { throw new Error('x') } }), agora: () => relogio.agora })
    mundo.pedir(0, 0)
    mundo.passo(4)
    assert(mundo.falhas().length === 1, '(controle) a falha ficou registrada')
    mundo.esquecer(0, 0)
    assert(mundo.falhas().length === 0, 'esquecer um quadrado que falhou LIBERA a falha (se o jogador voltar, tenta de novo)')
  }
  // E22 (o orçamento é DIVIDIDO entre os geradores): com 2 em andamento e orçamento de 4 ms, o PRIMEIRO não pode gastar tudo e deixar o segundo sem andar. A enumeração achou: pedir 2 quadrados e dar um
  // passo: AMBOS têm de ter avançado (o campo do segundo não pode ficar eternamente atrás do primeiro).
  {
    const relogio = { agora: 0 }
    const avancou: Record<string, number> = {}
    const mundo = criarRelevoDoMundo({
      fabricar: (i) => {
        let n = 0
        // O gerador RESPEITA o orçamento que recebe (como o `gerarRelevoFatiado` real: `do { linha } while (agora − início < limite)`). A 1ª versão deste cenário fazia SEMPRE 1 unidade e devolvia, então
        // o primeiro gerador nunca monopolizava o passo e os mutantes «sem dividir o orçamento» (E21, E22) sobreviveram: o gerador de mentira não reproduzia o defeito (24/11).
        return {
          passo(orcamentoMs: number) {
            const limite = Number.isFinite(orcamentoMs) && orcamentoMs > 0 ? orcamentoMs : 0
            const inicio = relogio.agora
            do { relogio.agora += 1; n += 1; avancou[String(i)] = n } while (relogio.agora - inicio < limite)
            return false
          },
          terminou: () => false,
          progresso: () => n / 100,
          resultado(): CampoRelevo { throw new Error('x') },
        }
      },
      agora: () => relogio.agora,
    })
    mundo.pedir(0, 0)
    mundo.pedir(1, 0)
    mundo.passo(4)
    assert((avancou['0'] ?? 0) >= 1 && (avancou['1'] ?? 0) >= 1, `os DOIS geradores avançam no mesmo passo (primeiro ${avancou['0'] ?? 0}, segundo ${avancou['1'] ?? 0}): o orçamento é repartido, e o primeiro não o monopoliza`)
  }
  // E24 (NaN no orçamento): `passo(NaN)` faz ao menos uma unidade, nunca uma conta quebrada que não avança nem lança. O mutante «NaN sem tratar» é EQUIVALENTE (provado por reprodução em 24/11: com `NaN` o laço
  // `do…while` do mundo executa a 1ª volta e `agora() − início >= NaN` é falso, então sai igual ao real), e este cenário trava o COMPORTAMENTO, não a proteção redundante.
  {
    const relogio = { agora: 0 }
    const mundo = criarRelevoDoMundo({ fabricar: (i, j) => geradorDeMentira(i, j, 8, relogio, []), agora: () => relogio.agora })
    mundo.pedir(0, 0)
    const antes = relogio.agora
    mundo.passo(Number.NaN)
    assert(relogio.agora > antes, 'passo(NaN) faz ao menos uma unidade de trabalho (e não trava)')
    assert(relogio.agora - antes <= 2, `passo(NaN) vale 0: faz UMA unidade, não um orçamento infinito (gastou ${relogio.agora - antes} ms)`)
  }

  // ── 9. O GERADOR REAL: o campo que sai do mundo é IDÊNTICO ao síncrono `gerarRelevo` (a fatia não muda um número) e entra no cache do F0 (o próximo `gerarRelevo` é instantâneo). ────────────────────────
  {
    limparCacheRelevo()
    const mundo = criarRelevoDoMundo()
    mundo.pedir(2, -1)
    for (let k = 0; k < 4000 && mundo.campoDe(2, -1) === undefined; k += 1) mundo.passo(4)
    const fatiado = mundo.campoDe(2, -1)
    assert(fatiado !== undefined, 'o gerador real terminou')
    limparCacheRelevo()
    const sincrono = gerarRelevo(2, -1)
    let diferentes = 0
    for (let k = 0; k < sincrono.alturas.length; k += 1) if (sincrono.alturas[k] !== fatiado.alturas[k]) diferentes += 1
    assert(diferentes === 0, `o campo fatiado é idêntico ao síncrono (${diferentes} alturas diferem)`)
  }
}
