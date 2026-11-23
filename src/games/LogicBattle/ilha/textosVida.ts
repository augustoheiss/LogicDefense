/**
 * Textos da vida do herói (L5.1). `heroi.army` é a VIDA do herói (nasce 10, cada golpe tira 3, a 0 o jogo acaba); o nome
 * «exército» vem do jogo antigo. Aqui moram só os textos que o jogador lê, para ficarem puros e testáveis.
 */

/**
 * Número de vida legível e curto: exato até 9.999 (cada golpe de 3 se vê descer), depois `k`/`M`/`B`.
 * Arredonda SEMPRE para baixo: 999.999 é «999k», nunca «1000k» (o HUD nunca mostra mais vida do que o herói tem).
 * Valor inválido (NaN, negativo, infinito) vira «0»: o HUD nunca imprime «NaN» nem «Infinity».
 */
export function formatarVida(vida: number): string {
  if (!Number.isFinite(vida) || vida < 0) return '0'
  const inteira = Math.floor(vida)
  if (inteira < 10_000) return String(inteira)
  if (inteira < 1_000_000) return `${Math.floor(inteira / 1_000)}k`
  if (inteira < 1_000_000_000) return `${Math.floor(inteira / 1_000_000)}M`
  return `${Math.floor(inteira / 1_000_000_000)}B`
}

/**
 * O valor EXATO da vida, com separador de milhar («10.512»). O selo curto («10k») esconde ganhos pequenos: com 10.000 de vida uma
 * conta de +512 continua mostrando «10k» (T2/Camila). A legenda e o nome acessível usam este valor, que não perde nada.
 */
export function vidaExata(vida: number): string {
  if (!Number.isFinite(vida) || vida < 0) return '0'
  return Math.floor(vida).toLocaleString('pt-BR')
}

/** O rótulo longo («Vida do herói 10»). O HUD usa o ícone; este texto fica para quem precisa de uma frase só. */
export function rotuloVida(vida: number): string {
  return `Vida do herói ${formatarVida(vida)}`
}

/**
 * A legenda do ícone de vida (hover no desktop, toque no celular): o nome e o valor EXATO («Vida do herói: 10.512»). O selo curto
 * («10k») esconde ganhos pequenos e a legenda é onde o jogador confere o número.
 */
export function legendaDaVida(vida: number): string {
  return `Vida do herói: ${vidaExata(vida)}`
}

/** O que pode acontecer com o selo de vida e muda se a legenda está aberta. */
export type EventoDaLegenda = 'toque' | 'teclaAbrir' | 'escape' | 'toqueFora' | 'perdeuFoco'

/**
 * A legenda do selo de vida abre e fecha por um ESTADO (e não só por `:hover`/`:focus`):
 *  - o `:hover` do celular é EMULADO e pegajoso (o T2 mediu a legenda presa depois de tocar fora);
 *  - o `Escape` precisa fechá-la com o foco no selo (WCAG 1.4.13 «Dismissible»).
 * Toque e Enter/Espaço ALTERNAM; `Escape`, toque fora e perda de foco FECHAM. Evento desconhecido não muda nada: um bug futuro que passe
 * um evento novo não pode abrir nem fechar a legenda por engano.
 */
export function proximaLegenda(aberta: boolean, evento: EventoDaLegenda): boolean {
  switch (evento) {
    case 'toque':
    case 'teclaAbrir':
      return !aberta
    case 'escape':
    case 'toqueFora':
    case 'perdeuFoco':
      return false
    default:
      return aberta
  }
}

/** O nome acessível do ícone de vida: o leitor de tela lê o valor EXATO («999.999»), nunca «999k». */
export function nomeAcessivelDaVida(vida: number): string {
  return `Vida do herói: ${vidaExata(vida)}`
}

/** Um inteiro >= 0 para contar licenças: lixo (NaN, negativo, infinito) vira 0, fração vira inteira. */
function licencasValidas(licencas: number): number {
  return Number.isFinite(licencas) && licencas > 0 ? Math.floor(licencas) : 0
}

/**
 * O toast depois de uma conta: «+N de vida e N licença(s)». N é o ganho REAL (depois − antes), não o da tabela.
 *
 * Contrato HONESTO (rodada 3 do T2): o texto nunca afirma o que não sabe.
 *  - ganho inteiro >= 1 → «+N de vida e …» (N formatado como o HUD).
 *  - entrada inválida (NaN/Infinity) → só as licenças («+1 licença»): não se sabe quanto a vida mudou.
 *  - ganho 0 → «Vida no máximo e …» SÓ se o chamador disser o teto (`vidaMaxima`) e a vida já estiver nele; sem essa prova, só as
 *    licenças. (Uma função pura não conhece `PARTIDA.vidaCap`; antes ela assumia «ganho ≤ 0 = teto» e mentia quando o herói
 *    tomava dano no mesmo quadro: «Vida no máximo» com a vida caindo para 7.)
 */
export function textoGanhoDaConta(vidaAntes: number, vidaDepois: number, licencas: number, vidaMaxima?: number): string {
  const n = licencasValidas(licencas)
  const lic = `${n} ${n === 1 ? 'licença' : 'licenças'}`
  if (!Number.isFinite(vidaAntes) || !Number.isFinite(vidaDepois)) return `+${lic}`
  const ganho = Math.floor(vidaDepois) - Math.floor(vidaAntes)
  if (ganho >= 1) return `+${formatarVida(ganho)} de vida e ${lic}`
  if (vidaMaxima !== undefined && Number.isFinite(vidaMaxima) && Math.floor(vidaDepois) >= Math.floor(vidaMaxima)) {
    return `Vida no máximo e ${lic}`
  }
  return `+${lic}`
}

/**
 * O que o jogador LÊ quando «Evoluir» é recusado. `resultado` vem de `podeEvoluir` (partidaSim); `preco` é o texto já formatado do preço («1 licença ou 2 madeiras + 2 ouros»).
 * Só o caso de RECURSO fala de preço (é a frase que o jogador já conhecia): os demais usam o MOTIVO do próprio `podeEvoluir`, e por isso uma recusa por ESPAÇO nunca diz «Precisa de 1
 * licença» (o defeito de uma cadeia de mensagens com um balde no fim: qualquer recusa desconhecida virava «Precisa de X»). Entrada suja (sem motivo, código desconhecido) cai num texto
 * neutro e legível, nunca em `undefined` nem em vazio.
 */
export function textoDaRecusaDeEvoluir(resultado: { ok: boolean; codigo?: string; motivo?: string }, preco: string): string {
  if (resultado.codigo === 'recurso') {
    const p = typeof preco === 'string' ? preco.trim() : ''
    return p === '' ? 'Precisa de recursos para evoluir' : `Precisa de ${p} para evoluir`
  }
  const motivo = typeof resultado.motivo === 'string' ? resultado.motivo.trim() : ''
  return motivo === '' ? 'Não foi possível evoluir agora' : motivo
}
