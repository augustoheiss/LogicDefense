/**
 * Caderno de estudo (E2 do plano do Guia dos universitários): o que o aluno acertou, errou e onde demorou, para apontar ONDE ele tem mais dificuldade.
 * Pedido do usuário (20/11/2026): «um banco de dados sobre isso: acertos, erros, pontos de atenção… e ajudar onde você tem mais dificuldade».
 *
 * PURO e injetável, como a `memoriaDeContas` (E1): o armazenamento entra por parâmetro e o teste roda no Node sem DOM. NUNCA lança: armazenamento ausente, cheio,
 * bloqueado ou corrompido devolve um caderno vazio e o jogo segue (no pior caso o caderno não lembra, como se o aluno abrisse o jogo pela primeira vez).
 *
 * POR QUE `localStorage` E NÃO IndexedDB ([D-minha], medido; corrige o §7 do plano, que eu tinha escrito sem medir): o caderno TEM TETO. O que cresce com o uso é só
 * a janela das últimas `LIMITE_TENTATIVAS` tentativas (500 × ~116 caracteres ≈ 58 KB) e o agregado por conceito é de tamanho FIXO (~2 KB para os 21 conceitos). Guardar
 * TODA tentativa para sempre não caberia (um aluno muito dedicado faz ~131 mil contas por ano ≈ 14,5 MB), mas o caderno não precisa disso: o ponto fraco sai do
 * agregado, e a janela serve só para «as últimas» e para a fila. Quem o troca por IndexedDB um dia só precisa de outra implementação de `ArmazenamentoSimples`.
 * Além disso, o IndexedDB não existe no Node do runner (`typeof indexedDB === 'undefined'`): uma camada assíncrona dele ficaria SEM teste nos gates.
 *
 * PRIVACIDADE (repositório público, aluno possivelmente menor): só NÚMEROS e ids de conceito/arquétipo. Sem nome, sem texto livre, sem identificador pessoal; tudo
 * fica no navegador do aluno, nada sai do dispositivo.
 */
import type { ArmazenamentoSimples } from './memoriaDeContas'

/** Prefixo `ld_` e versão `_v1`, como as outras chaves do portal. Uma versão futura usa `_v2` e NÃO é lida como esta por engano. */
export const CHAVE_CADERNO = 'ld_ilha_caderno_v1'
/** A janela de tentativas recentes. 500 × ~116 caracteres ≈ 58 KB, ~1 % da cota de 5 MB do `localStorage`. */
export const LIMITE_TENTATIVAS = 500
const TEMPO_MAXIMO_MS = 3_600_000 // 1 h: acima disto o aluno saiu do jogo (almoço, outra aba); não é «conta difícil»
const TAMANHO_MAXIMO_DE_ID = 80 // ids de conceito/arquétipo/chave reais têm < 50 caracteres; acima disto é lixo (ou tentativa de encher a cota)
const MAXIMO_DE_CONCEITOS = 64 // hoje são 21; o teto impede que lixo no armazenamento crie chaves sem fim

/** Uma conta respondida (o acerto final), em formato ENXUTO (chaves de 1 letra: 116 caracteres serializada). */
export interface Tentativa {
  /** quando (epoch ms) */
  q: number
  /** grau 1..4 */
  g: number
  /** conceito (`ConceptId`) */
  c: string
  /** arquétipo */
  a: string
  /** erros ANTES do acerto (0 = acertou de primeira) */
  e: number
  /** tempo, em ms, do abrir a conta até acertar */
  t: number
  /** chave curta da assinatura (para não repetir a mesma conta; a assinatura inteira tem ~110 caracteres) */
  k: string
}

/** O agregado de um conceito: tamanho FIXO, não cresce com as tentativas. */
export interface ConceitoAgregado {
  /** contas respondidas */
  n: number
  /** acertos (cada conta termina em acerto; o conceito conta 1 por conta) */
  ok: number
  /** erros somados */
  er: number
  /** tempo somado, ms */
  t: number
  /** última vez (epoch ms) */
  u: number
  /** sequência: quantas contas SEGUIDAS deste conceito tiveram algum erro (zera ao acertar de primeira) */
  sq: number
  /** peso dos erros: cada erro pesa conforme o tempo que o aluno levou (um erro instantâneo é chute e pesa pouco) */
  w: number
}

export interface Caderno {
  v: 1
  tentativas: Tentativa[]
  conceitos: Record<string, ConceitoAgregado>
}

export interface PontoFraco {
  conceito: string
  /** quanto o conceito pesa como ponto fraco (maior = mais fraco) */
  peso: number
  contas: number
  erros: number
}

/**
 * Uma chave CURTA e determinística para a assinatura de uma conta (~110 caracteres → 4 a 7). Serve para o caderno saber «esta mesma conta já apareceu» sem guardar a
 * assinatura inteira (que mais que dobraria o tamanho de cada tentativa). FNV-1a de 32 bits, em base 36: sem biblioteca, sem aleatoriedade. NÃO é criptografia nem
 * identifica ninguém: duas assinaturas podem, raramente, colidir (32 bits), e o caderno só usa a chave para agrupar, nunca para decidir nada que machuque o aluno.
 */
export function chaveCurta(assinatura: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < assinatura.length; i++) {
    h ^= assinatura.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36).padStart(4, '0')
}

export function cadernoVazio(): Caderno {
  return { v: 1, tentativas: [], conceitos: {} }
}

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const ehTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= TAMANHO_MAXIMO_DE_ID

/** Uma tentativa só entra se TODOS os campos forem sãos. O que não é são é DESCARTADO, nunca «consertado»: um dado adivinhado seria um dado falso no caderno. */
function tentativaValida(x: unknown): x is Tentativa {
  if (typeof x !== 'object' || x === null) return false
  const t = x as Record<string, unknown>
  return (
    ehNumero(t.q) && t.q >= 0 &&
    ehNumero(t.g) && Number.isInteger(t.g) && t.g >= 1 && t.g <= 7 &&
    ehTexto(t.c) && ehTexto(t.a) && ehTexto(t.k) &&
    ehNumero(t.e) && Number.isInteger(t.e) && t.e >= 0 &&
    ehNumero(t.t) && t.t >= 0
  )
}

/**
 * O PESO de um erro conforme o tempo que o aluno levou. Um erro INSTANTÂNEO (poucos décimos de segundo) é CHUTE e pesa pouco; um erro DEPOIS DE PENSAR pesa cheio.
 * A regra «errou, perde metade» + o modal a 0,1× + a onda que não para empurram o aluno a chutar, e o caderno não pode acusar de «fraco» quem só chutou (plano §8).
 * Contínuo e monotônico, em (0, 1]: de PISO (em 0 s) a 1 (a partir de PENSOU_MS). O piso NÃO é zero: zerar esconderia o erro por completo.
 * Os cortes são CHUTE MEU, sem medição (nenhum aluno foi observado): constantes nomeadas e reajustáveis, não verdade.
 */
const PISO_DO_PESO = 0.15
const PENSOU_MS = 8_000
export function pesoDoErro(tempoMs: number): number {
  const t = Number.isFinite(tempoMs) && tempoMs > 0 ? tempoMs : 0
  if (t >= PENSOU_MS) return 1
  return PISO_DO_PESO + (1 - PISO_DO_PESO) * (t / PENSOU_MS)
}

/**
 * Registra uma conta respondida. PURO: devolve um caderno novo e não mexe no de antes. Tentativa inválida é IGNORADA e devolve o MESMO objeto (quem compara por
 * identidade vê que nada mudou). O agregado do conceito soma TODAS as tentativas, inclusive as que já saíram da janela.
 */
export function registrarTentativa(caderno: Caderno, tentativa: Tentativa): Caderno {
  if (!tentativaValida(tentativa)) return caderno
  const t: Tentativa = { ...tentativa, t: Math.min(tentativa.t, TEMPO_MAXIMO_MS) }
  const antes = caderno.conceitos[t.c]
  // conceito novo além do teto: não cria (lixo no armazenamento não pode inflar o caderno)
  if (!antes && Object.keys(caderno.conceitos).length >= MAXIMO_DE_CONCEITOS) return caderno
  const base: ConceitoAgregado = antes ?? { n: 0, ok: 0, er: 0, t: 0, u: 0, sq: 0, w: 0 }
  const agregado: ConceitoAgregado = {
    n: base.n + 1,
    ok: base.ok + 1,
    er: base.er + t.e,
    t: base.t + t.t,
    u: Math.max(base.u, t.q),
    sq: t.e > 0 ? base.sq + 1 : 0,
    w: base.w + t.e * pesoDoErro(t.t),
  }
  return {
    v: 1,
    tentativas: [...caderno.tentativas, t].slice(-LIMITE_TENTATIVAS),
    conceitos: { ...caderno.conceitos, [t.c]: agregado },
  }
}

/** Contas mínimas de um conceito para ele poder ser acusado como ponto fraco: com 1 ou 2 contas, um erro é acaso, não padrão. */
const AMOSTRA_MINIMA = 3

/**
 * Os pontos fracos, do MAIS fraco ao menos fraco. O peso de um conceito é o peso dos erros (ponderado pelo tempo) por conta: quem erra muito DEPOIS DE PENSAR pesa mais
 * que quem erra o mesmo tanto em chutes instantâneos. Só entra quem tem amostra mínima e algum erro. `limite` corta a lista.
 */
export function pontosFracos(caderno: Caderno, limite?: number): PontoFraco[] {
  const lista: PontoFraco[] = []
  for (const [conceito, k] of Object.entries(caderno.conceitos)) {
    if (k.n < AMOSTRA_MINIMA || k.er <= 0 || k.w <= 0) continue
    lista.push({ conceito, peso: k.w / k.n, contas: k.n, erros: k.er })
  }
  lista.sort((a, b) => b.peso - a.peso || b.erros - a.erros || a.conceito.localeCompare(b.conceito))
  return limite !== undefined && Number.isFinite(limite) && limite >= 0 ? lista.slice(0, Math.floor(limite)) : lista
}

function agregadoValido(x: unknown): x is ConceitoAgregado {
  if (typeof x !== 'object' || x === null) return false
  const k = x as Record<string, unknown>
  return ['n', 'ok', 'er', 't', 'u', 'sq', 'w'].every((campo) => ehNumero(k[campo]) && (k[campo] as number) >= 0)
}

/** Lê o caderno salvo. Qualquer falha (sem armazenamento, acesso negado, JSON ruim, versão diferente, formato errado) devolve um caderno VAZIO. Nunca lança. */
export function carregarCaderno(armazenamento: ArmazenamentoSimples | null | undefined): Caderno {
  if (!armazenamento) return cadernoVazio()
  try {
    const bruto = armazenamento.getItem(CHAVE_CADERNO)
    if (bruto === null) return cadernoVazio()
    const lido: unknown = JSON.parse(bruto)
    if (typeof lido !== 'object' || lido === null || Array.isArray(lido)) return cadernoVazio()
    const obj = lido as Record<string, unknown>
    if (obj.v !== 1) return cadernoVazio()
    const tentativas = Array.isArray(obj.tentativas) ? obj.tentativas.filter(tentativaValida).slice(-LIMITE_TENTATIVAS) : []
    const conceitos: Record<string, ConceitoAgregado> = {}
    if (typeof obj.conceitos === 'object' && obj.conceitos !== null && !Array.isArray(obj.conceitos)) {
      for (const [chave, valor] of Object.entries(obj.conceitos as Record<string, unknown>)) {
        if (Object.keys(conceitos).length >= MAXIMO_DE_CONCEITOS) break
        if (ehTexto(chave) && agregadoValido(valor)) conceitos[chave] = { n: valor.n, ok: valor.ok, er: valor.er, t: valor.t, u: valor.u, sq: valor.sq, w: valor.w }
      }
    }
    return { v: 1, tentativas, conceitos }
  } catch {
    return cadernoVazio()
  }
}

/**
 * Grava o caderno. Devolve `true` se gravou ou se já estava igual; `false` se não há armazenamento ou a gravação falhou (cota cheia, acesso negado). Não regrava quando
 * nada mudou: o jogo roda a 60 fps e a gravação é síncrona. A serialização monta o objeto com a ORDEM DE CHAVES FIXA, senão «igual» dependeria da ordem em que as
 * propriedades foram criadas.
 */
export function salvarCaderno(armazenamento: ArmazenamentoSimples | null | undefined, caderno: Caderno): boolean {
  if (!armazenamento) return false
  try {
    const limpo: Caderno = { v: 1, tentativas: caderno.tentativas.filter(tentativaValida).slice(-LIMITE_TENTATIVAS), conceitos: {} }
    for (const chave of Object.keys(caderno.conceitos).sort()) {
      const k = caderno.conceitos[chave]
      if (ehTexto(chave) && agregadoValido(k)) limpo.conceitos[chave] = { n: k.n, ok: k.ok, er: k.er, t: k.t, u: k.u, sq: k.sq, w: k.w }
    }
    const texto = JSON.stringify({
      v: 1,
      tentativas: limpo.tentativas.map((t) => ({ q: t.q, g: t.g, c: t.c, a: t.a, e: t.e, t: t.t, k: t.k })),
      conceitos: limpo.conceitos,
    })
    if (armazenamento.getItem(CHAVE_CADERNO) === texto) return true
    armazenamento.setItem(CHAVE_CADERNO, texto)
    return true
  } catch {
    return false
  }
}
