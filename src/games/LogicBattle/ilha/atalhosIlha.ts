// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/ilha/atalhosIlha.ts — Regras puras de teclado da ilha
// Não importa React nem Three. `IlhaRua.tsx` é o único `keydown` e é o único leitor.
// ──────────────────────────────────────────────────────────────────────────────

/** O que o navegador diz sobre onde o foco está quando a tecla chega. */
export interface AlvoDoTeclado {
  readonly tag: string
  readonly ehCampoDeTexto: boolean
  /**
   * O elemento TRATA o próprio teclado (declara `data-teclado-proprio`): um `<div tabindex=0>` como o selo de vida, que não é botão mas responde a
   * Enter/Espaço/Escape. O jogo escuta o `keydown` na CAPTURA da window, antes de qualquer `onKeyDown` do React; sem esta marca ele agia primeiro
   * (o herói pulava, o card era confirmado, o Esc fechava o card) e o `stopPropagation` do componente chegava tarde.
   */
  readonly ehControleProprio: boolean
  /**
   * O elemento TEM algo a fechar com o Esc AGORA (declara `data-esc-proprio`): o selo só enquanto a legenda está aberta. É diferente de
   * `ehControleProprio`: Enter/Espaço o selo trata SEMPRE; o Esc só quando há legenda. Sem esta separação, com o foco no selo e a legenda
   * FECHADA, o jogo não agia (o selo era «dono») e o selo também não (nada a fechar): o card/painel ficava PRESO até o foco sair do selo
   * (regressão do meu 1º conserto, achada pelo revisor independente e reproduzida no jogo real).
   */
  readonly tratouEscape: boolean
}

export interface ConfirmavelAberto {
  readonly cardAberto: boolean
  readonly painelAberto: boolean
}

/** Última coisa que o jogador fez antes da tecla: tocou na tela ou apertou uma tecla. */
export type EntradaDoJogador = { tipo: 'ponteiro' } | { tipo: 'tecla'; code: string }

// Elementos que já sabem ativar-se com Enter ou Espaço. O jogo não rouba a tecla de quem
// o jogador alcançou pelo teclado.
const ATIVAVEIS_PELO_TECLADO = new Set(['BUTTON', 'A', 'SUMMARY', 'SELECT', 'TEXTAREA', 'INPUT'])
const CAMPOS_DE_TEXTO = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
// Só Tab move o foco entre controles. As setas não entram: neste jogo elas andam e giram a câmera,
// e tratá-las como navegação faria um botão clicado voltar a roubar o Espaço depois de andar.
const TECLAS_QUE_MOVEM_O_FOCO = new Set(['Tab'])

/** Lê o alvo do evento sem depender do DOM: o teste passa um objeto simples. */
export function alvoDoTeclado(alvo: unknown): AlvoDoTeclado {
  const lido = (alvo ?? {}) as { tagName?: unknown; isContentEditable?: unknown; dataset?: { tecladoProprio?: unknown; escProprio?: unknown } }
  const tag = typeof lido.tagName === 'string' && lido.tagName !== '' ? lido.tagName.toUpperCase() : 'BODY'
  // `?.` já cobre dataset ausente, nulo ou de tipo estranho (provado por enumeração: 20 entradas, 0 divergências): não precisa de guarda à parte.
  const ehControleProprio = lido.dataset?.tecladoProprio !== undefined
  const tratouEscape = lido.dataset?.escProprio !== undefined
  return { tag, ehCampoDeTexto: CAMPOS_DE_TEXTO.has(tag) || lido.isContentEditable === true, ehControleProprio, tratouEscape }
}

/**
 * O foco de um botão veio do teclado? `:focus-visible` não responde isso: o Chrome o liga na primeira
 * tecla depois de um clique. Por isso o jogo guarda a origem. Clique de mouse apaga, Tab acende,
 * qualquer outra tecla (inclusive as setas, que andam) deixa como estava.
 */
export function proximaEntradaPorTeclado(entrada: EntradaDoJogador, atual: boolean): boolean {
  if (entrada.tipo === 'ponteiro') return false
  return TECLAS_QUE_MOVEM_O_FOCO.has(entrada.code) ? true : atual
}

/**
 * A tecla é do controle focado, e não do jogo? Campo de texto sempre. Botão, link e afins só quando o
 * jogador chegou neles pelo teclado: quem clicou com o mouse continua com Espaço = pulo e Enter = card.
 */
export function teclaDoBotaoFocado(alvo: AlvoDoTeclado, entradaPorTeclado: boolean): boolean {
  if (alvo.ehCampoDeTexto) return true
  // Controle que trata o próprio teclado: a tecla é dele venha o foco de Tab OU de clique (um div não ganha foco sem um dos dois).
  if (alvo.ehControleProprio) return true
  return entradaPorTeclado && ATIVAVEIS_PELO_TECLADO.has(alvo.tag)
}

/**
 * O Esc é do jogo (fecha card, painel, ferramenta)? Não é quando o foco está num campo de texto ou num controle que TEM algo a fechar com o Esc
 * AGORA (`data-esc-proprio`: o selo só enquanto a legenda está aberta): ele fecha a PRÓPRIA legenda e o jogo não deve fechar o card por baixo.
 * Com a legenda FECHADA o selo não tem nada a fechar, então o Esc é do jogo (senão o card ficava preso). Botão não trata Esc: o dele é do jogo.
 */
export function jogoTomaEscape(alvo: AlvoDoTeclado): boolean {
  return !alvo.ehCampoDeTexto && !alvo.tratouEscape
}

export interface PrecoDeEvoluir {
  readonly credito: number
  readonly madeira: number
  readonly ouro: number
}

const plural = (n: number, singular: string, mais: string): string => `${n} ${n === 1 ? singular : mais}`

/**
 * O preço de evoluir, em texto, a partir da mesma constante que `evoluir` cobra. Recebe o preço em vez de importar
 * `PARTIDA` para este módulo seguir puro e o teste poder passar valores diferentes dos de hoje.
 */
export function precoDeEvoluir(preco: PrecoDeEvoluir): string {
  return `${plural(preco.credito, 'licença', 'licenças')}, ou ${plural(preco.madeira, 'madeira', 'madeiras')} e ${plural(preco.ouro, 'ouro', 'ouros')}`
}

/** O mínimo que o painel precisa saber de uma obra: o `partidaSim` não é importado aqui (este módulo é puro). */
export interface ObraDoPainel {
  readonly id: number
  readonly lado: string
  readonly hp: number
}

/**
 * O painel da obra só vale enquanto a obra existe, é nossa e está viva. O id do painel mora num ref, e a obra
 * pode cair, sumir ou mudar de dono depois: sem esta checagem o painel some da tela mas `painelAberto` seguia
 * true, o Espaço deixava de pular e o Enter evoluía um id morto (A3b).
 * Na derrota o painel também não vale: a partida acabou e a tela de derrota manda (OBS-F2-1). `derrota` é a do
 * corpo do herói, a mesma que `podeComandar` lê, e é opcional (sem ela vale como partida em andamento).
 */
export function painelValido(id: number | null, obras: readonly ObraDoPainel[], derrota = false): boolean {
  if (id === null || derrota) return false
  const obra = obras.find((item) => item.id === id)
  return obra !== undefined && obra.lado !== 'inimigo' && obra.hp > 0
}

export interface CliqueNaObra {
  /** 0 esquerdo, 1 do meio, 2 direito. */
  readonly botao: number
  readonly olhar: 'primeira' | 'terceira' | 'imperio'
  /** Modo bloco, linha ou consagrar: o clique é de edição e não abre painel. */
  readonly modoEdicao: boolean
  /**
   * «Observando» (sem corpo): vista tática. O `olhar` do quadrado observado segue 'terceira' mesmo assim (medido pelo
   * T2), então sem este campo o clique contava como de corpo e o marcador sobrava (OBS-F2-4).
   */
  readonly semCorpo?: boolean
}

/**
 * O clique cai numa obra nossa e abre o painel? Se sim, o ponteiro é «da obra»: o container não pode atirar nem
 * prender o mouse com o pointer lock (A2b). Só vale com o botão esquerdo, fora do império (lá o container já não
 * atira) e fora dos modos de edição. Obra do inimigo não entra: continua sendo alvo do tiro. Ruína nossa também não.
 */
export function cliqueAbreOPainelDaObra(obra: { readonly lado: string; readonly hp: number } | null, clique: CliqueNaObra): boolean {
  if (obra === null || obra.lado === 'inimigo' || obra.hp <= 0) return false
  if (clique.botao !== 0 || clique.modoEdicao) return false
  if (clique.semCorpo) return false
  return clique.olhar !== 'imperio'
}

export interface PointerdownNaObra {
  /** 0 esquerdo, 1 do meio, 2 direito. */
  readonly botao: number
  /** Modo bloco, linha ou consagrar: o clique é de edição. */
  readonly modoEdicao: boolean
}

/**
 * O `pointerdown` de uma obra INIMIGA viva e visível deve parar a propagação do raycast do R3F?
 *
 * Sim, para os botões de jogo (esquerdo e direito): a obra inimiga é o ALVO do clique e nada atrás dela pode
 * capturá-lo. Sem isto o raycast seguia para uma obra NOSSA colinear atrás, cujo `pointerdown` marcava o ponteiro
 * (A2b), e o container suprimia o tiro: o clique morria sem atirar e sem abrir painel (OBS-F2-5, medido: HP 500 -> 500
 * e 0 tiros, contra 488 e 1 tiro com o aliado longe). O `onClick` da malha já parava para qualquer obra viva visível.
 *
 * Obra NOSSA não entra: segue o fluxo do A2b (marca o ponteiro e abre o painel). Obra na névoa (`coberta: false`) não
 * é alvo e deixa o clique passar ao chão. Ruína não captura. Em edição o clique é de bloco.
 */
export function paraPropagacaoDoPointerdown(
  obra: { readonly lado: string; readonly hp: number; readonly coberta: boolean } | null,
  clique: PointerdownNaObra,
): boolean {
  if (obra === null || obra.lado !== 'inimigo' || obra.hp <= 0 || !obra.coberta) return false
  if (clique.modoEdicao) return false
  return clique.botao === 0 || clique.botao === 2
}

export interface ToqueNaTela {
  /** `pointerId` que a malha da obra marcou no `pointerdown` (ou null: o toque não caiu numa obra que abre painel). */
  readonly marcadoPelaObra: number | null
  /** `pointerId` do dedo que acabou de tocar. */
  readonly pointerId: number
  /** Posição do dedo dentro do container, em px, e a largura dele. */
  readonly x: number
  readonly largura: number
  readonly olhar: 'primeira' | 'terceira' | 'imperio'
  readonly semCorpo: boolean
}

/** Onde começa a metade do manche: o toque à esquerda de 45% da largura é do joystick. */
export const FRACAO_DO_MANCHE = 0.45

/**
 * Para onde vai um dedo que acabou de tocar o campo de jogo.
 *  - `obra`: caiu numa obra nossa. Abre o painel (o `onClick` da malha) e NÃO vira manche nem arrasto de câmera.
 *    Antes o container só zerava o marcador e seguia: tocar uma obra na metade esquerda armava o joystick (F2-D4,
 *    medido em toque real). O marcador só vale para o dedo que o escreveu: outro dedo não é roubado.
 *  - `manche`: metade esquerda, no corpo. `olhar`: metade direita, no corpo.
 *  - `imperio`: vista tática, sem manche nem olhar; segue o fluxo do império (arrasto de bloco, seleção).
 */
export function destinoDoToque(toque: ToqueNaTela): 'obra' | 'manche' | 'olhar' | 'imperio' {
  if (toque.olhar === 'imperio' || toque.semCorpo) return 'imperio'
  if (toque.marcadoPelaObra !== null && toque.marcadoPelaObra === toque.pointerId) return 'obra'
  return toque.x < toque.largura * FRACAO_DO_MANCHE ? 'manche' : 'olhar'
}

/**
 * Enter e Espaço confirmam o card ou o painel aberto, e só isso.
 * Sem card nem painel a tecla é do navegador: botão focado ativa por teclado.
 * Com um controle alcançado pelo teclado, o foco vence: foi ele que o jogador acionou.
 */
export function jogoTomaConfirmar(
  code: string,
  alvo: AlvoDoTeclado,
  aberto: ConfirmavelAberto,
  entradaPorTeclado: boolean,
): boolean {
  if (code !== 'Enter' && code !== 'Space') return false
  if (!aberto.cardAberto && !aberto.painelAberto) return false
  return !teclaDoBotaoFocado(alvo, entradaPorTeclado)
}

export type TelaEstudo = 'jogo' | 'conta' | 'caderno'
export type AcaoAtalhoEstudo = 'alternar_conta' | 'alternar_caderno' | 'voltar_jogo' | null

export interface EntradaAtalhoEstudo {
  readonly code: string
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly altKey?: boolean
  readonly repeat?: boolean
  readonly tela: TelaEstudo
  readonly alvo: AlvoDoTeclado
}

/**
 * Alternância instantânea entre jogo (tempo real 100%), conta aberta e caderno (Q2/Q3).
 * Roda ANTES do retorno antecipado do modal no `keydown`, sem roubar atalhos do navegador (Ctrl/Meta/Alt)
 * nem letras digitadas em campos de texto.
 */
export function acaoDeAtalhoEstudo(entrada: EntradaAtalhoEstudo): AcaoAtalhoEstudo {
  if (entrada.ctrlKey || entrada.metaKey || entrada.altKey || entrada.repeat) return null
  if (entrada.alvo.ehCampoDeTexto) return null
  if (entrada.code === 'KeyQ') return 'alternar_conta'
  if (entrada.code === 'KeyG') return 'alternar_caderno'
  if (entrada.code === 'Escape' && entrada.tela !== 'jogo' && jogoTomaEscape(entrada.alvo)) return 'voltar_jogo'
  return null
}
