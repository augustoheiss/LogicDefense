import { formatarVida, legendaDaVida, nomeAcessivelDaVida, proximaLegenda, rotuloVida, textoDaRecusaDeEvoluir, textoGanhoDaConta, vidaExata } from './textosVida'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * L5.1 «Vida do herói». O campo `army` é a vida do herói (nasce 10, cada golpe tira 3, a 0 o jogo acaba). Três coisas que
 * o jogador lê precisam dizer a verdade e caber no celular:
 *  - o rótulo do HUD («Exército 10» enganava: ninguém comanda soldados, é a vida do herói);
 *  - o número grande, formatado (a vida pode chegar a 999.999; «Vida do herói 999999» não cabe em 360 px);
 *  - o toast da conta: «+N de vida» com o N REAL (depois − antes), não o da tabela. Com a vida no teto, o bônus da tabela
 *    seria uma mentira («+512 de vida» quando a vida não mudou).
 */
export function run() {
  // formatarVida: exato até 9.999 (o jogador vê cada golpe de 3 descer o número), depois k/M com FLOOR.
  assert(formatarVida(0) === '0', 'L5.1: vida 0 é «0»')
  assert(formatarVida(9) === '9', 'L5.1: um dígito')
  assert(formatarVida(10) === '10', 'L5.1: a vida inicial é «10»')
  assert(formatarVida(9999) === '9999', 'L5.1: até 9.999 o número é exato, sem separador')
  assert(formatarVida(10000) === '10k', 'L5.1: 10.000 vira «10k»')
  assert(formatarVida(14999) === '14k', 'L5.1: «k» arredonda PARA BAIXO: nunca mostrar mais vida do que o herói tem')
  assert(formatarVida(999499) === '999k', 'L5.1: 999.499 vira «999k»')
  assert(formatarVida(999500) === '999k', 'L5.1: 999.500 NÃO pode virar «1000k» (floor, não round)')
  assert(formatarVida(999999) === '999k', 'L5.1: o teto da partida (999.999) vira «999k», nunca «1000k»')
  assert(formatarVida(1_000_000) === '1M', 'L5.1: um milhão vira «1M»')
  assert(formatarVida(2_500_000) === '2M', 'L5.1: «M» também arredonda para baixo')
  assert(formatarVida(1_000_000_000) === '1B', 'L5.1: um bilhão vira «1B»')

  // Estados de falha: o HUD nunca pode mostrar NaN, Infinity nem número negativo.
  assert(formatarVida(Number.NaN) === '0', 'L5.1: NaN vira «0», não «NaN»')
  assert(formatarVida(-5) === '0', 'L5.1: vida negativa vira «0»')
  assert(formatarVida(Number.POSITIVE_INFINITY) === '0', 'L5.1: Infinity vira «0», não «Infinity»')
  assert(formatarVida(Number.NEGATIVE_INFINITY) === '0', 'L5.1: -Infinity vira «0»')
  assert(formatarVida(7.9) === '7', 'L5.1: fração é descartada para baixo (a vida é inteira)')

  // rotuloVida: o texto do HUD.
  assert(rotuloVida(10) === 'Vida do herói 10', 'L5.1: o HUD diz «Vida do herói», não «Exército»')
  assert(rotuloVida(999999) === 'Vida do herói 999k', 'L5.1: o rótulo usa o número formatado')
  assert(!rotuloVida(10).includes('xército'), 'L5.1: «exército» não aparece mais no HUD')

  // textoGanhoDaConta: delta REAL e plural de «licença».
  assert(textoGanhoDaConta(10, 14, 1) === '+4 de vida e 1 licença', 'L5.1: grau 1 de hoje (+4), uma licença no singular')
  assert(textoGanhoDaConta(10, 18, 1) === '+8 de vida e 1 licença', 'L5.1: o texto usa o delta real (depois − antes = 18 − 10 = +8), qualquer que seja a tabela')
  assert(textoGanhoDaConta(10, 42, 2) === '+32 de vida e 2 licenças', 'L5.1: duas licenças no plural («2 licença» era erro)')
  assert(textoGanhoDaConta(10, 522, 2) === '+512 de vida e 2 licenças', 'L5.1: o grau mais difícil da tabela do usuário (+512)')
  assert(textoGanhoDaConta(999990, 999999, 1) === '+9 de vida e 1 licença', 'L5.1: perto do teto o ganho real é só o que coube (+9), não o da tabela')
  assert(
    textoGanhoDaConta(999999, 999999, 1, 999999) === 'Vida no máximo e 1 licença',
    'L5.1: com a vida NO TETO (e o chamador diz qual é o teto) não se promete «+0 de vida»: diz que está no máximo',
  )
  assert(
    textoGanhoDaConta(999999, 999999, 1) === '+1 licença',
    'T2-C2: SEM o teto a função não pode afirmar «máximo» (não sabe): diz só as licenças',
  )
  // O herói PERDEU vida no mesmo quadro (2 hordas −6, ou torre −7, contra a conta +4): NUNCA «Vida no máximo» (o toast que o T2 reproduziu).
  assert(textoGanhoDaConta(10, 8, 1, 999999) === '+1 licença', 'T2-C2: 10→8 (perdeu vida) com o teto distante NÃO diz «Vida no máximo»')
  assert(textoGanhoDaConta(10, 7, 1, 999999) === '+1 licença', 'T2-C2: 10→7 (torre −7 contra +4) NÃO diz «Vida no máximo»')
  assert(textoGanhoDaConta(50, 40, 1) === '+1 licença', 'L5.1: delta negativo nunca vira «+-10» nem «máximo»: só as licenças')
  assert(!textoGanhoDaConta(10, 14, 1).includes('soldado'), 'L5.1: ninguém ganha soldados, ganha vida')

  // ── Rodada 3 do T2 (certificação) ─────────────────────────────────────────────────────────────────────────────────────
  // O T2 sobreviveu 7 mutantes e achou defeitos reais em textoGanhoDaConta. Cada caso abaixo mata um deles.

  // formatarVida: toda a faixa M/B (m1, m2, m3).
  assert(formatarVida(999_999_999) === '999M', 'T2-m1: 999.999.999 é «999M» (e 5.000.000 não pode virar «0B»)')
  assert(formatarVida(5_000_000) === '5M', 'T2-m1: 5.000.000 é «5M»')
  assert(formatarVida(1_500_000_000) === '1B', 'T2-m2: «B» arredonda PARA BAIXO (1,5 bi = «1B»)')
  assert(formatarVida(1_999_999_999) === '1B', 'T2-m2: 1.999.999.999 é «1B», não «2B»')
  assert(formatarVida(2_000_000_000) === '2B', 'T2-m3: 2 bilhões é «2B» (não um «1B» fixo)')

  // textoGanhoDaConta: ganho grande usa a mesma formatação (m4) e valores inválidos nunca viram «NaN»/«+0» (m5).
  assert(textoGanhoDaConta(10, 50_010, 2) === '+50k de vida e 2 licenças', 'T2-m4: o ganho também é formatado («+50k», não «+50000»)')
  // Entrada INVÁLIDA (NaN/Infinity) não é «vida no máximo»: seria uma afirmação FALSA (o herói não está no máximo, o dado é que quebrou).
  // O texto neutro e verdadeiro diz só o que sabemos: as licenças. (Decisão minha; o T2 só pediu «não imprimir +0».)
  assert(textoGanhoDaConta(NaN, 14, 1) === '+1 licença', 'T2-m5: vida antes inválida (NaN) não vira «+NaN», «+0» nem «Vida no máximo» (seria falso)')
  assert(textoGanhoDaConta(10, NaN, 1) === '+1 licença', 'T2-m5: vida depois inválida (NaN): só as licenças, que são o que sabemos')
  assert(textoGanhoDaConta(10, Number.POSITIVE_INFINITY, 1) === '+1 licença', 'T2: ganho infinito não vira «+0 de vida» nem «Vida no máximo»')

  // ganho FRACIONÁRIO < 1: o contrato do próprio teste diz que nunca se promete «+0 de vida» (T2 B.3, defeito real).
  assert(textoGanhoDaConta(10, 10.5, 1) === '+1 licença', 'T2-B3: ganho de 0,5 arredonda para 0: não pode dizer «+0 de vida» (nem «máximo»: a vida não está no teto)')
  assert(textoGanhoDaConta(10.4, 10.9, 1) === '+1 licença', 'T2-B3: 10,4→10,9 tem ganho inteiro 0 (floor 10 e 10): sem «+0 de vida»')
  assert(textoGanhoDaConta(10.9, 11.1, 1) === '+1 de vida e 1 licença', 'a vida inteira passou de 10 para 11: o ganho é +1 (mede a vida inteira, como o HUD)')
  assert(textoGanhoDaConta(10, 14.9, 1) === '+4 de vida e 1 licença', 'T2: ganho fracionário 4,9 mostra «+4» (para baixo, como a vida)')

  // licenças: plural PT-BR (0 é plural) e valores inválidos sanitizados (m6 e B.3).
  assert(textoGanhoDaConta(10, 14, 0) === '+4 de vida e 0 licenças', 'T2-m6: «0 licenças» (zero é plural em português)')
  assert(textoGanhoDaConta(10, 14, -1) === '+4 de vida e 0 licenças', 'T2-B3: licença negativa vira 0, nunca «-1 licenças»')
  assert(textoGanhoDaConta(10, 14, NaN) === '+4 de vida e 0 licenças', 'T2-B3: licença NaN vira 0')
  assert(textoGanhoDaConta(10, 14, 1.5) === '+4 de vida e 1 licença', 'T2-B3: licença fracionária vira inteira (1,5 → 1)')

  // rotuloVida (m7): usa formatarVida em TODA a faixa, inclusive entradas inválidas.
  assert(rotuloVida(NaN) === 'Vida do herói 0', 'T2-m7: rótulo com NaN diz «0»')
  assert(rotuloVida(-5) === 'Vida do herói 0', 'T2-m7: rótulo com vida negativa diz «0»')
  assert(rotuloVida(14_999) === 'Vida do herói 14k', 'T2-m7: rótulo usa a formatação de milhar')

  // O ÍCONE de vida (decisão do usuário, 18:05): o selo mostra coração + número, SEM texto; a legenda aparece em hover/clique.
  assert(nomeAcessivelDaVida(10) === 'Vida do herói: 10', 'ícone: o nome acessível (leitor de tela) diz a vida exata')
  assert(nomeAcessivelDaVida(999_999) === 'Vida do herói: 999.999', 'ícone: o nome acessível NÃO usa «k»: leitor de tela lê o valor exato com separador')
  assert(nomeAcessivelDaVida(NaN) === 'Vida do herói: 0', 'ícone: nome acessível sanitizado')
  // A legenda mostra o valor EXATO: o selo curto («10k») esconde ganhos pequenos (10.000 + 512 continua «10k»), e a legenda é onde o
  // jogador confere o número (Camila, rodada 3 do T2). O usuário pediu «a legenda Vida, ou seja o que for».
  assert(legendaDaVida(10) === 'Vida do herói: 10', 'ícone: a legenda (hover/toque) diz o nome e o valor EXATO')
  assert(legendaDaVida(10_512) === 'Vida do herói: 10.512', 'ícone: com 10.512 de vida o selo diz «10k» e a legenda diz «10.512» (o ganho de +512 não some)')
  assert(legendaDaVida(NaN) === 'Vida do herói: 0', 'ícone: legenda sanitizada')
  assert(vidaExata(10_512) === '10.512', 'Camila: o valor EXATO com separador de milhar (10k + 512 não pode parecer que não mudou)')
  assert(vidaExata(999_999) === '999.999', 'vida exata no teto')
  assert(vidaExata(9) === '9', 'vida exata de um dígito')
  assert(vidaExata(1_234_567) === '1.234.567', 'vida exata acima do teto da partida também tem separador')
  assert(vidaExata(Number.NaN) === '0' && vidaExata(-3) === '0', 'vida exata inválida vira «0»')

  // ── Rodada 4 do T2 (DEF-L51B-3): 10 mutantes NÃO-equivalentes sobreviviam às funções novas (vidaExata, licencasValidas, vidaMaxima). ──
  assert(vidaExata(10.9) === '10', 'T2-n03: a vida exata é INTEIRA e arredonda para baixo (10,9 → «10»), como o selo e o HUD')
  assert(vidaExata(0) === '0', 'T2-n04: vida 0 é «0» (e não vazio)')
  assert(vidaExata(Number.POSITIVE_INFINITY) === '0', 'T2-n05: Infinity vira «0», nunca «∞» nem 301 dígitos')
  assert(vidaExata(Number.NEGATIVE_INFINITY) === '0', 'T2-n06: -Infinity vira «0»')
  assert(textoGanhoDaConta(10, 14, Number.POSITIVE_INFINITY) === '+4 de vida e 0 licenças', 'T2-n13: licença infinita é lixo, vira 0 (nunca «Infinity licenças»)')
  assert(textoGanhoDaConta(10, 10, 1, Number.NEGATIVE_INFINITY) === '+1 licença', 'T2-n15: teto -Infinity é inválido: não afirma «máximo»')
  assert(textoGanhoDaConta(10, 10, 1, Number.NaN) === '+1 licença', 'T2-n15: teto NaN é inválido: não afirma «máximo»')
  assert(textoGanhoDaConta(1_000_000, 1_000_000, 1, 999_999) === 'Vida no máximo e 1 licença', 'T2-n16: vida acima do teto também está «no máximo»')
  assert(textoGanhoDaConta(999_999.2, 999_999.2, 1, 999_999.8) === 'Vida no máximo e 1 licença', 'T2-n17: compara a parte INTEIRA (999.999 e 999.999): está no teto')
  assert(textoGanhoDaConta(Number.NEGATIVE_INFINITY, 10, 1) === '+1 licença', 'T2-n19: vida antes -Infinity é inválida: só as licenças')
  // n23 (o T2 deixou como PERGUNTA): a vida CAIU de 1.000.005 para 999.999 e terminou no teto. O texto descreve o ESTADO («no máximo»), que é
  // verdade (999.999 É o teto), não a variação. Decisão minha: o toast da conta diz onde o herói ESTÁ; a perda de 6 não é assunto da conta.
  assert(
    textoGanhoDaConta(1_000_005, 999_999, 1, 999_999) === 'Vida no máximo e 1 licença',
    'T2-n23: perdeu vida mas terminou no teto: diz «no máximo» (descreve o estado, que é verdadeiro), nunca «+N de vida»',
  )
  assert(textoGanhoDaConta(10, 10, 1, 10) === 'Vida no máximo e 1 licença', 'sem ganho e já no teto: «no máximo»')

  // ── Rodada 4 do T2 (DEF-L51B-2): a legenda do selo abre e fecha por um ESTADO, não só por :hover/:focus (o :hover do celular é emulado e
  // pegajoso; o `Escape` precisa fechar a legenda: WCAG 1.4.13 «Dismissible»). `proximaLegenda(aberta, evento)` é a transição pura. ──
  assert(proximaLegenda(false, 'toque') === true, 'WCAG/toque: o 1º toque ABRE a legenda')
  assert(proximaLegenda(true, 'toque') === false, 'toque: o 2º toque FECHA (não fica presa aberta)')
  assert(proximaLegenda(true, 'escape') === false, 'WCAG 1.4.13 Dismissible: Escape FECHA a legenda aberta')
  assert(proximaLegenda(false, 'escape') === false, 'Escape com a legenda fechada continua fechada')
  assert(proximaLegenda(true, 'toqueFora') === false, 'um toque FORA do selo FECHA a legenda')
  assert(proximaLegenda(false, 'toqueFora') === false, 'toque fora com a legenda fechada continua fechada')
  assert(proximaLegenda(true, 'perdeuFoco') === false, 'tirar o foco (Tab para outro elemento) FECHA a legenda')
  assert(proximaLegenda(false, 'teclaAbrir') === true, 'Enter/Espaço com o selo focado ABRE (quem usa teclado também lê a legenda)')
  assert(proximaLegenda(true, 'teclaAbrir') === false, 'Enter/Espaço de novo FECHA (alterna, como o toque)')
  assert(proximaLegenda(true, 'desconhecido' as never) === true, 'evento desconhecido não muda o estado (não fecha nem abre por engano)')

  // ── textoDaRecusaDeEvoluir: o que o jogador LÊ quando «Evoluir» é recusado (pedido do usuário, 22/11: «dá um erro ao evoluir para o nível 5 se tiver outro edifício do lado») ──
  // Antes a interface tinha uma cadeia de 3 mensagens e qualquer recusa fora de «máximo»/«em construção» caía no balde «Precisa de X para evoluir»: uma recusa por FALTA DE ESPAÇO diria que faltava dinheiro.
  const PRECO = '1 licença ou 2 madeiras + 2 ouros'
  assert(textoDaRecusaDeEvoluir({ ok: false, codigo: 'recurso', motivo: 'x' }, PRECO) === `Precisa de ${PRECO} para evoluir`, 'recurso: mantém a frase que o jogador já conhecia, COM o preço')
  const espaco = textoDaRecusaDeEvoluir({ ok: false, codigo: 'espaco', motivo: 'Espaço bloqueado: há outra obra na área que a fortaleza do Nível 5 vai ocupar (cerca de 6 m)' }, PRECO)
  assert(/espaço|obra/i.test(espaco), `espaço: o texto fala do ESPAÇO/obra (veio «${espaco}»)`)
  assert(!espaco.includes(PRECO) && !/precisa de/i.test(espaco), `espaço: NÃO menciona o preço (a recusa por espaço dizendo «Precisa de 1 licença» era o defeito; veio «${espaco}»)`)
  assert(textoDaRecusaDeEvoluir({ ok: false, codigo: 'maximo', motivo: 'Construção já está no Nível 5 (máximo)' }, PRECO) === 'Construção já está no Nível 5 (máximo)', 'máximo: usa o motivo do próprio podeEvoluir')
  assert(textoDaRecusaDeEvoluir({ ok: false, codigo: 'construcao', motivo: 'Aguarde concluir a construção antes de evoluir' }, PRECO) === 'Aguarde concluir a construção antes de evoluir', 'em construção: usa o motivo do próprio podeEvoluir')
  assert(textoDaRecusaDeEvoluir({ ok: false, codigo: 'espaco', motivo: 'Espaço bloqueado: X' }, PRECO) === 'Espaço bloqueado: X', 'espaço: devolve o motivo exatamente como veio')
  // entrada suja nunca vira «undefined» nem texto vazio na tela
  for (const sujo of [{ ok: false } as never, { ok: false, codigo: 'espaco' } as never, { ok: false, codigo: 'desconhecido', motivo: '' } as never, { ok: true } as never]) {
    const t = textoDaRecusaDeEvoluir(sujo, PRECO)
    assert(typeof t === 'string' && t.trim().length > 0 && !/undefined|null|NaN/.test(t), `entrada suja nunca vira texto vazio/«undefined» (veio «${t}»)`)
  }
  assert(textoDaRecusaDeEvoluir({ ok: false, codigo: 'recurso', motivo: 'x' }, '') === 'Precisa de recursos para evoluir', 'preço vazio: não escreve «Precisa de  para evoluir» com buraco no meio')
  // espaços nas pontas NÃO vão para a tela, e um motivo SÓ de espaços cai no texto neutro (a 1ª rodada de mutação deixou sobreviver «o motivo não é aparado»: meus motivos já vinham limpos)
  assert(textoDaRecusaDeEvoluir({ ok: false, codigo: 'espaco', motivo: '  Espaço bloqueado: X  ' }, PRECO) === 'Espaço bloqueado: X', 'o motivo é APARADO: sem espaços sobrando nas pontas')
  assert(textoDaRecusaDeEvoluir({ ok: false, codigo: 'espaco', motivo: '   ' }, PRECO) === 'Não foi possível evoluir agora', 'um motivo só de espaços cai no texto neutro (não vira uma linha em branco na tela)')
  assert(textoDaRecusaDeEvoluir({ ok: false, codigo: 'recurso', motivo: 'x' }, `  ${PRECO}  `) === `Precisa de ${PRECO} para evoluir`, 'o preço também é aparado: sem espaço duplo dentro da frase')
}
