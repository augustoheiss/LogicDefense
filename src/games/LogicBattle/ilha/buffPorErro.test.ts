import { fatorDoBuff, aplicarFatorAoBuff, textoDaContaComErros, textoDoBuffReduzido, type BuffCheio } from './buffPorErro'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/**
 * Buff por erro (pedido do usuário, 20/11): «se a pessoa errar a alternativa ela perde o buff pela metade; cada vez que errar
 * acontece isso». O buff de uma conta é o conjunto que `aplicarConta` concede: vida, recursos (licença, madeira, ouro) e abate de inimigos.
 *
 * Decisões [D-minha] registradas no plano (2026-11-20-PLANO-GUIA-DOS-UNIVERSITARIOS…, §8):
 *  - fator = 0,5 elevado ao número de erros (1 erro → 50 %, 2 → 25 %, 3 → 12,5 %);
 *  - a VIDA arredonda para cima e tem PISO de 1 (quem errou muito ainda ganha algo: punir a zero faz o aluno fugir do estudo);
 *  - os RECURSOS arredondam para baixo (podem chegar a 0);
 *  - o ABATE de inimigos segue a fração, com mínimo de 1 inimigo se havia algum a abater.
 */
export function run(): void {
  // ── fatorDoBuff: 0,5^erros, sempre em (0, 1] ──────────────────────────────────────────────────────────────────────────
  assert(fatorDoBuff(0) === 1, 'sem erro o buff é cheio (fator 1)')
  assert(fatorDoBuff(1) === 0.5, '1 erro: metade')
  assert(fatorDoBuff(2) === 0.25, '2 erros: um quarto')
  assert(fatorDoBuff(3) === 0.125, '3 erros: um oitavo')
  assert(fatorDoBuff(10) === 0.5 ** 10, '10 erros: 0,5^10 (continua > 0)')
  // entradas ruins NUNCA devolvem fator fora de (0, 1] nem NaN: o jogo não pode zerar nem inflar o buff por um número sujo
  for (const sujo of [-1, -5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5, 2.9]) {
    const f = fatorDoBuff(sujo)
    assert(Number.isFinite(f) && f > 0 && f <= 1, `fatorDoBuff(${sujo}) = ${f}: deve ficar em (0, 1]`)
  }
  assert(fatorDoBuff(-3) === 1, 'erros negativos contam como 0 erro (não inflam o buff)')
  assert(fatorDoBuff(Number.NaN) === 1, 'NaN conta como 0 erro')
  assert(fatorDoBuff(1.9) === 0.5, 'erro fracionário trunca para baixo (1,9 → 1 erro)')
  // muitos erros: o fator tem um piso estrito > 0 e NÃO vira 0 por underflow (1e-300 ainda é > 0, mas 0,5^2000 = 0)
  assert(fatorDoBuff(2000) > 0, 'com 2000 erros o fator não pode virar 0 por underflow')

  // ── aplicarFatorAoBuff: vida arredonda PARA CIMA com piso 1; recursos PARA BAIXO; abate com mínimo de 1 se havia inimigo ──
  const cheio: BuffCheio = { vida: 12, credito: 2, madeira: 8, ouro: 4, wipe: 1, inimigosVivos: 5 }
  const igual = aplicarFatorAoBuff(cheio, 1)
  assert(igual.vida === 12 && igual.credito === 2 && igual.madeira === 8 && igual.ouro === 4 && igual.abates === 5, 'fator 1 devolve o buff cheio, sem mexer em nada (wipe 100 % de 5 inimigos = 5 abates)')

  const metade = aplicarFatorAoBuff(cheio, 0.5)
  assert(metade.vida === 6, `vida 12 × 0,5 = 6 (deu ${metade.vida})`)
  assert(metade.credito === 1 && metade.madeira === 4 && metade.ouro === 2, `recursos pela metade (deu ${metade.credito}/${metade.madeira}/${metade.ouro})`)
  // MESMA fórmula de aplicarConta: Math.max(1, Math.round(inimigos × wipe)), com o fator entrando em wipe ANTES do round: round(5 × 1 × 0,5) = round(2,5) = 3
  assert(metade.abates === 3, `abate = round(5 inimigos × wipe 1 × fator 0,5) = round(2,5) = 3, como o jogo arredonda (deu ${metade.abates})`)

  // arredondamento da vida: PARA CIMA (3 × 0,5 = 1,5 → 2) e piso 1 (1 × 0,125 = 0,125 → 1)
  assert(aplicarFatorAoBuff({ ...cheio, vida: 3 }, 0.5).vida === 2, 'vida 3 × 0,5 = 1,5 arredonda para CIMA (2)')
  assert(aplicarFatorAoBuff({ ...cheio, vida: 1 }, 0.125).vida === 1, 'vida nunca cai abaixo de 1 (piso): 1 × 0,125 → 1')
  assert(aplicarFatorAoBuff({ ...cheio, vida: 4 }, 0.125).vida === 1, 'vida 4 × 0,125 = 0,5 sobe para o piso 1')
  // recursos: PARA BAIXO e podem zerar
  assert(aplicarFatorAoBuff({ ...cheio, credito: 1, madeira: 2, ouro: 1 }, 0.5).credito === 0, 'crédito 1 × 0,5 = 0,5 arredonda para BAIXO (0)')
  assert(aplicarFatorAoBuff({ ...cheio, credito: 1, madeira: 2, ouro: 1 }, 0.5).ouro === 0, 'ouro 1 × 0,5 → 0')
  assert(aplicarFatorAoBuff({ ...cheio, credito: 1, madeira: 2, ouro: 1 }, 0.5).madeira === 1, 'madeira 2 × 0,5 = 1')
  // abate: mínimo 1 inimigo se havia inimigo vivo; 0 se não havia ninguém
  assert(aplicarFatorAoBuff({ ...cheio, wipe: 0.35, inimigosVivos: 4 }, 0.125).abates === 1, 'abate nunca vai a 0 havendo inimigos (mínimo 1): round(4 × 0,35 × 0,125) = 0 → 1')
  assert(aplicarFatorAoBuff({ ...cheio, wipe: 1, inimigosVivos: 0 }, 0.5).abates === 0, 'sem inimigos, sem abate (não inventa 1)')
  assert(aplicarFatorAoBuff({ ...cheio, wipe: 1, inimigosVivos: 0 }, 1).abates === 0, 'sem inimigos e fator 1: continua 0')
  // o abate nunca passa dos inimigos vivos nem do buff cheio
  assert(aplicarFatorAoBuff({ ...cheio, wipe: 1, inimigosVivos: 3 }, 1).abates === 3, 'fator 1 e wipe 100 % abate todos os 3')
  assert(aplicarFatorAoBuff({ ...cheio, wipe: 1, inimigosVivos: 2 }, 0.5).abates <= 2, 'abate nunca passa do número de inimigos vivos')
  // o wipe do JOGO por grau (35/60/85/100 %) com 6 inimigos e sem erro: o mesmo que aplicarConta abateria (Math.max(1, Math.round(6 × wipe)))
  for (const [wipe, esperado] of [[0.35, 2], [0.6, 4], [0.85, 5], [1, 6]] as const) assert(aplicarFatorAoBuff({ ...cheio, wipe, inimigosVivos: 6 }, 1).abates === esperado, `wipe ${wipe} de 6 inimigos deveria abater ${esperado}`)

  // propriedade: o buff reduzido NUNCA passa do cheio, em nenhuma parte, para nenhum fator válido
  for (let erros = 0; erros <= 12; erros++) {
    const f = fatorDoBuff(erros)
    for (const v of [1, 2, 3, 4, 6, 8, 12, 32, 256, 999_999]) {
      const r = aplicarFatorAoBuff({ vida: v, credito: v, madeira: v, ouro: v, wipe: 1, inimigosVivos: v }, f)
      assert(r.vida <= v && r.credito <= v && r.madeira <= v && r.ouro <= v && r.abates <= v, `buff reduzido passou do cheio (v=${v}, erros=${erros})`)
      assert(r.vida >= 1, `vida < 1 (v=${v}, erros=${erros}): o piso de 1 falhou`)
      assert(r.credito >= 0 && r.madeira >= 0 && r.ouro >= 0 && r.abates >= 0, `parte do buff negativa (v=${v}, erros=${erros})`)
      assert(Number.isInteger(r.vida) && Number.isInteger(r.credito) && Number.isInteger(r.madeira) && Number.isInteger(r.ouro) && Number.isInteger(r.abates), `parte do buff não inteira (v=${v}, erros=${erros})`)
    }
  }
  // monotonia: mais erros nunca dão MAIS buff
  for (let erros = 0; erros < 12; erros++) {
    const a = aplicarFatorAoBuff(cheio, fatorDoBuff(erros)), b = aplicarFatorAoBuff(cheio, fatorDoBuff(erros + 1))
    assert(b.vida <= a.vida && b.credito <= a.credito && b.madeira <= a.madeira && b.ouro <= a.ouro && b.abates <= a.abates, `errar mais (${erros + 1}) deu MAIS buff que errar menos (${erros})`)
  }
  // `aplicarFatorAoBuff` é fronteira PÚBLICA: recebe o fator direto, sem passar por fatorDoBuff. Fator inválido ou fora de (0, 1] não pode
  // zerar nem inflar o buff (o mutante «NaN → 0» e o «sem o teto 1» sobreviviam: nenhum teste chamava a função com fator sujo).
  for (const sujoF of [Number.NaN, -1, 0, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const r = aplicarFatorAoBuff(cheio, sujoF)
    assert(r.vida === 12 && r.credito === 2 && r.madeira === 8 && r.ouro === 4 && r.abates === 5, `fator inválido (${sujoF}) deve valer como 1 (buff cheio), não zerar: ${JSON.stringify(r)}`)
  }
  for (const grande of [1.5, 2, 100]) {
    const r = aplicarFatorAoBuff(cheio, grande)
    assert(r.vida === 12 && r.credito === 2 && r.madeira === 8 && r.ouro === 4 && r.abates === 5, `fator ${grande} > 1 não pode INFLAR o buff acima do cheio: ${JSON.stringify(r)}`)
  }
  // abate com wipe inválido: nunca inventa abate
  for (const wipeRuim of [Number.NaN, -0.5, 0]) assert(aplicarFatorAoBuff({ ...cheio, wipe: wipeRuim, inimigosVivos: 5 }, 1).abates === 0, `wipe inválido (${wipeRuim}) não abate ninguém`)
  assert(aplicarFatorAoBuff({ ...cheio, wipe: 7, inimigosVivos: 5 }, 1).abates === 5, 'wipe > 1 vale como 1 (abate no máximo todos)')
  // entradas sujas no buff cheio não propagam NaN
  const sujo = aplicarFatorAoBuff({ vida: Number.NaN, credito: -4, madeira: Number.POSITIVE_INFINITY, ouro: 2.7, wipe: Number.NaN, inimigosVivos: -1 }, 0.5)
  for (const [nome, v] of Object.entries(sujo)) assert(Number.isFinite(v) && Number.isInteger(v), `buff sujo propagou ${nome} = ${v}`)
  assert(sujo.vida >= 1, 'buff sujo: a vida respeita o piso de 1')

  // ── texto do toast: verdade, curto e no singular/plural certo ─────────────────────────────────────────────────────────
  assert(textoDoBuffReduzido(0) === '', 'sem erro não há aviso (o toast normal já fala do ganho)')
  assert(textoDoBuffReduzido(1) === 'Errou 1 vez: buff em 50 %', `1 erro: «${textoDoBuffReduzido(1)}»`)
  assert(textoDoBuffReduzido(2) === 'Errou 2 vezes: buff em 25 %', `2 erros: «${textoDoBuffReduzido(2)}»`)
  assert(textoDoBuffReduzido(3) === 'Errou 3 vezes: buff em 12,5 %', `3 erros: «${textoDoBuffReduzido(3)}»`)
  assert(textoDoBuffReduzido(4) === 'Errou 4 vezes: buff em 6,25 %', `4 erros: «${textoDoBuffReduzido(4)}»`)
  assert(!/NaN|Infinity|undefined/.test(textoDoBuffReduzido(Number.NaN) + textoDoBuffReduzido(Number.POSITIVE_INFINITY)), 'o toast nunca mostra NaN/Infinity')

  // ── toast completo: o ganho da conta + o MOTIVO de ter rendido menos ──────────────────────────────────────────────────
  // O jogador vê «+6 de vida e 1 licença» e precisa saber POR QUE não foi +12: sem o motivo a regra «errou, perde metade» parece um defeito do jogo.
  assert(textoDaContaComErros('+12 de vida e 2 licenças', 0) === '+12 de vida e 2 licenças', 'sem erro o toast é EXATAMENTE o de antes (nada a acrescentar)')
  assert(textoDaContaComErros('+6 de vida e 1 licença', 1) === '+6 de vida e 1 licença · Errou 1 vez: buff em 50 %', `1 erro: «${textoDaContaComErros('+6 de vida e 1 licença', 1)}»`)
  assert(textoDaContaComErros('+3 de vida e 0 licenças', 2) === '+3 de vida e 0 licenças · Errou 2 vezes: buff em 25 %', 'o «0 licenças» do contrato antigo continua, e o motivo ao lado o explica')
  assert(textoDaContaComErros('', 3) === 'Errou 3 vezes: buff em 12,5 %', 'se não há texto de ganho, o motivo aparece sozinho (sem «·» sobrando na frente)')
  assert(textoDaContaComErros('+4 de vida e 1 licença', Number.NaN) === '+4 de vida e 1 licença', 'erro NaN = 0 erro: nada acrescentado')
  assert(textoDaContaComErros('+4 de vida e 1 licença', -2) === '+4 de vida e 1 licença', 'erro negativo = 0 erro: nada acrescentado')
  assert(!/NaN|Infinity|undefined|null/.test(textoDaContaComErros('+1 licença', Number.POSITIVE_INFINITY)), 'o toast completo nunca mostra NaN/Infinity/undefined/null')
}
