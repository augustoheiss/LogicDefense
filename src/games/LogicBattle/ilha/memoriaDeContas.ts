/**
 * Memória de contas (E1 do plano do Guia dos universitários): salva e restaura as ASSINATURAS das contas já vistas, para que o anel anti-repetição do
 * motor (`infiniteMathEngine.ts`, 260 assinaturas em MEMÓRIA) sobreviva a recarregar a página: «mesmo se o usuário começar outra partida, a pergunta
 * vai ser diferente» (pedido do usuário, 20/11). `hydrateSeenMathSignatures` e `getRecentMathSignaturesSnapshot` já existem no motor e ninguém os chamava.
 *
 * PURO e injetável: o armazenamento entra por parâmetro (a interface mínima do `Storage` do navegador), então o teste roda no Node sem DOM.
 * NUNCA lança: modo anônimo, cota cheia, acesso negado e JSON corrompido não podem derrubar o jogo; no pior caso o jogo se comporta como hoje
 * (anel zerado a cada carga). Por que `localStorage` e não IndexedDB nesta fatia: são strings de ~50 bytes (160 cabem em poucos KB), muito abaixo da cota;
 * o histórico que CRESCE (o caderno de estudo, E2) é que vai para o IndexedDB. Medido: nenhum app do usuário usa IndexedDB, todos usam `localStorage`.
 */

/** A parte do `Storage` que usamos. `localStorage` satisfaz; `null`/`undefined` (SSR, bloqueado) é tratado como «sem armazenamento». */
export interface ArmazenamentoSimples {
  getItem(chave: string): string | null
  setItem(chave: string, valor: string): void
  /** O `Storage` real tem; é opcional para os dublês de teste mais simples. Usado só para limpar a chave de sondagem. */
  removeItem?(chave: string): void
}

/** Prefixo `ld_` e versão `_v1`, como as outras chaves do portal (`ld_pro_license_key`, …): um formato futuro usa `_v2` sem ler este por engano. */
export const CHAVE_ASSINATURAS = 'ld_ilha_contas_vistas_v1'
/** O motor guarda até 260 e expõe o instantâneo das últimas 160 (`getRecentMathSignaturesSnapshot`). */
export const LIMITE_ASSINATURAS = 160
/** Uma assinatura real tem ~50–110 caracteres; acima disto é lixo (ou um valor enorme que encheria a cota). */
const TAMANHO_MAXIMO_DE_UMA = 300

/**
 * O ÚNICO ponto que toca em `window.localStorage`. Devolve `null` (e nunca lança) em SSR, modo anônimo e acesso bloqueado. Não basta a PRESENÇA
 * de `localStorage`: alguns navegadores em modo privado o expõem mas lançam ao gravar (cota 0). Por isso a sondagem LÊ e GRAVA uma chave de teste
 * e só então devolve o armazenamento. A chave de teste é REMOVIDA logo depois (`removeItem`) e usa o prefixo do projeto; não altera nenhuma chave que
 * já existia. (Uma versão anterior deste comentário dizia «removida via sobrescrita vazia» e o código NÃO fazia isso: o teste pegou o lixo deixado.)
 * `janela` é injetável só para teste; no jogo é `window`.
 */
export function armazenamentoDoNavegador(janela: unknown = typeof window === 'undefined' ? undefined : window): ArmazenamentoSimples | null {
  try {
    const candidato = (janela as { localStorage?: ArmazenamentoSimples } | undefined)?.localStorage
    if (!candidato) return null
    const chaveDeSondagem = 'ld_ilha_sondagem_v1'
    candidato.setItem(chaveDeSondagem, '1')
    candidato.getItem(chaveDeSondagem)
    candidato.removeItem?.(chaveDeSondagem)
    return candidato
  } catch {
    return null
  }
}

const valida = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= TAMANHO_MAXIMO_DE_UMA

/** Mantém só strings válidas, sem repetir (fica a 1ª ocorrência) e só as ÚLTIMAS `LIMITE_ASSINATURAS` (a mais recente por último). */
function limpar(itens: readonly unknown[]): string[] {
  const vistos = new Set<string>()
  const unicas: string[] = []
  for (const v of itens) {
    if (valida(v) && !vistos.has(v)) {
      vistos.add(v)
      unicas.push(v)
    }
  }
  return unicas.slice(-LIMITE_ASSINATURAS)
}

/** Lê as assinaturas salvas. Qualquer falha (sem armazenamento, acesso negado, JSON ruim, formato errado) devolve `[]`. */
export function carregarAssinaturas(armazenamento: ArmazenamentoSimples | null | undefined): string[] {
  if (!armazenamento) return []
  try {
    const bruto = armazenamento.getItem(CHAVE_ASSINATURAS)
    if (bruto === null) return []
    // `''` (valor vazio) cai no `catch`: `JSON.parse('')` lança e o resultado é o mesmo `[]` (equivalência provada por enumeração, 13 entradas).
    const lido: unknown = JSON.parse(bruto)
    return Array.isArray(lido) ? limpar(lido) : []
  } catch {
    return []
  }
}

/**
 * Grava as assinaturas (limpas e cortadas). Devolve `true` se gravou ou se já estava igual; `false` se não há armazenamento ou a gravação falhou.
 * Não regrava quando nada mudou: o jogo roda a 60 fps e a gravação é síncrona.
 */
export function salvarAssinaturas(armazenamento: ArmazenamentoSimples | null | undefined, assinaturas: readonly unknown[]): boolean {
  if (!armazenamento) return false
  try {
    const texto = JSON.stringify(limpar(assinaturas))
    if (armazenamento.getItem(CHAVE_ASSINATURAS) === texto) return true
    armazenamento.setItem(CHAVE_ASSINATURAS, texto)
    return true
  } catch {
    return false
  }
}
