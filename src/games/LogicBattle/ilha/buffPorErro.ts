/**
 * Buff por erro: «se a pessoa errar a alternativa ela perde o buff pela metade; cada vez que errar acontece isso» (usuário, 20/11).
 *
 * Módulo PURO (sem importar a simulação): `aplicarConta` recebe o `fator` daqui e o aplica; o CONTADOR de erros mora na camada de UI/estudo,
 * porque a simulação continua determinística e não sabe de «tentativas».
 *
 * Regras ([D-minha], registradas no plano 2026-11-20-PLANO-GUIA-DOS-UNIVERSITARIOS…, §8, para o usuário revisar):
 *  - fator = 0,5 elevado aos erros, sempre em (0, 1];
 *  - VIDA arredonda para CIMA e nunca cai abaixo de 1 (punir a zero faz o aluno fugir do estudo);
 *  - RECURSOS (licença, madeira, ouro) arredondam para BAIXO e podem zerar;
 *  - ABATE segue a MESMA fórmula do jogo (`aplicarConta`: `Math.max(1, Math.round(inimigos × wipe))`), com o fator entrando no `wipe` ANTES
 *    do `Math.round`; limitado aos inimigos vivos; 0 se não há inimigo.
 */
export interface BuffCheio {
  vida: number
  credito: number
  madeira: number
  ouro: number
  /** fração de inimigos abatida pelo grau (0,35 / 0,6 / 0,85 / 1) */
  wipe: number
  inimigosVivos: number
}

export interface BuffAplicado {
  vida: number
  credito: number
  madeira: number
  ouro: number
  abates: number
}

/** Número de erros → fator do buff. Entrada suja (negativa, NaN, infinita) conta como 0 erro; fracionária trunca para baixo. */
export function fatorDoBuff(erros: number): number {
  const n = Number.isFinite(erros) && erros > 0 ? Math.floor(erros) : 0
  // 0,5^n some por underflow perto de n = 1075: o piso estrito > 0 evita fator 0 (que apagaria o buff para sempre)
  return Math.max(Number.MIN_VALUE, 0.5 ** n)
}

const inteiroNaoNegativo = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

/** Aplica o fator a cada parte do buff. Nunca devolve NaN, negativo, fração, nem mais que o buff cheio. */
export function aplicarFatorAoBuff(cheio: BuffCheio, fator: number): BuffAplicado {
  const f = Number.isFinite(fator) && fator > 0 ? Math.min(1, fator) : 1
  const vidaCheia = inteiroNaoNegativo(cheio.vida)
  const vida = vidaCheia === 0 ? 1 : Math.min(vidaCheia, Math.max(1, Math.ceil(vidaCheia * f)))
  const recurso = (v: number): number => Math.floor(inteiroNaoNegativo(v) * f)
  const inimigos = inteiroNaoNegativo(cheio.inimigosVivos)
  const wipe = Number.isFinite(cheio.wipe) && cheio.wipe > 0 ? Math.min(1, cheio.wipe) : 0
  // a mesma conta de aplicarConta: sem inimigos, 0; com inimigos, no mínimo 1 e no máximo todos
  const abates = inimigos === 0 || wipe === 0 ? 0 : Math.min(inimigos, Math.max(1, Math.round(inimigos * wipe * f)))
  return { vida, credito: recurso(cheio.credito), madeira: recurso(cheio.madeira), ouro: recurso(cheio.ouro), abates }
}

/** Texto do toast quando houve erro («Errou 2 vezes: buff em 25 %»). Sem erro, vazio (o toast normal já fala do ganho). */
export function textoDoBuffReduzido(erros: number): string {
  const n = Number.isFinite(erros) && erros > 0 ? Math.floor(erros) : 0
  if (n === 0) return ''
  const pct = 100 * 0.5 ** n
  // 50 / 25 / 12,5 / 6,25 / 3,125 …: até 2 casas, vírgula decimal, sem zeros sobrando
  const texto = String(Math.round(pct * 100) / 100).replace('.', ',')
  return `Errou ${n} ${n === 1 ? 'vez' : 'vezes'}: buff em ${texto} %`
}

/**
 * O toast completo da conta: o texto do ganho («+6 de vida e 1 licença») e, quando houve erro, o MOTIVO de ter rendido menos («Errou 1 vez: buff em 50 %»),
 * separados por « · ». Sem erro devolve o texto do ganho EXATAMENTE como veio (nada a acrescentar). O jogador vê o número cair e precisa saber por quê:
 * sem o motivo, a regra «errou, perde metade» pareceria um defeito do jogo. O texto do ganho vem pronto de `textoGanhoDaConta` (contrato do T2, intocado).
 */
export function textoDaContaComErros(textoDoGanho: string, erros: number): string {
  const motivo = textoDoBuffReduzido(erros)
  if (motivo === '') return textoDoGanho
  return textoDoGanho === '' ? motivo : `${textoDoGanho} · ${motivo}`
}
