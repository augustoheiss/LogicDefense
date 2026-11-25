/**
 * Cliente puro (browser-safe, zero `node:*`) para carregar sob demanda:
 *  1. `public/questoes/indice.json` — catálogo leve com metadados de seleção;
 *  2. `public/questoes/{origem}/{prova}.json` — pacote de questões de uma prova específica.
 *
 * Runners Node/SSR (`scripts/run-ilha-rua-test.mjs` ou `orquestradorQuestoes.test.ts`) podem
 * injetar um leitor JSON customizado via `configurarAdaptadorAcervo`, preservando `tsconfig` puro.
 */
import type {
  DesafioUnificado,
  EntradaIndiceQuestao,
  IndiceAcervoQuestoes,
  PacoteProvaJson,
} from './contratosEstudo'

export type LeitorJsonAcervo = (urlRelativa: string) => Promise<unknown>

export const URL_INDICE_ACERVO = '/questoes/indice.json'

let adaptadorLeitor: LeitorJsonAcervo | null = null
let promessaIndice: Promise<IndiceAcervoQuestoes> | null = null
const cachePacotes = new Map<string, Promise<PacoteProvaJson>>()

async function fetchJsonPadrao(urlRelativa: string): Promise<unknown> {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error(`fetch indisponível para carregar ${urlRelativa}`)
  }
  const resp = await globalThis.fetch(urlRelativa)
  if (!resp.ok) {
    throw new Error(`Falha HTTP ${resp.status} ao carregar ${urlRelativa}`)
  }
  return resp.json()
}

function obterLeitor(): LeitorJsonAcervo {
  return adaptadorLeitor ?? fetchJsonPadrao
}

export function obterAdaptadorAcervo(): LeitorJsonAcervo | null {
  return adaptadorLeitor
}

export function configurarAdaptadorAcervo(leitor: LeitorJsonAcervo | null): void {
  adaptadorLeitor = leitor
  limparCacheAcervo()
}

export function limparCacheAcervo(): void {
  promessaIndice = null
  cachePacotes.clear()
}

export async function carregarIndiceAcervo(): Promise<IndiceAcervoQuestoes> {
  if (!promessaIndice) {
    promessaIndice = obterLeitor()(URL_INDICE_ACERVO)
      .then((raw) => {
        const idx = raw as IndiceAcervoQuestoes | null
        if (!idx || !Array.isArray(idx.entradas)) {
          throw new Error('Índice de questões inválido ou sem entradas')
        }
        return idx
      })
      .catch((erro) => {
        promessaIndice = null
        throw erro
      })
  }
  return promessaIndice
}

export async function carregarPacoteProva(chunkUrl: string): Promise<PacoteProvaJson> {
  let existente = cachePacotes.get(chunkUrl)
  if (!existente) {
    existente = obterLeitor()(chunkUrl)
      .then((raw) => {
        const pacote = raw as PacoteProvaJson | null
        if (!pacote || !Array.isArray(pacote.itens)) {
          throw new Error(`Pacote de prova inválido em ${chunkUrl}`)
        }
        return pacote
      })
      .catch((erro) => {
        cachePacotes.delete(chunkUrl)
        throw erro
      })
    cachePacotes.set(chunkUrl, existente)
  }
  return existente
}

export async function carregarQuestaoPorEntrada(
  entrada: Pick<EntradaIndiceQuestao, 'id' | 'chunkUrl'>,
): Promise<DesafioUnificado> {
  const pacote = await carregarPacoteProva(entrada.chunkUrl)
  const encontrada = pacote.itens.find((item) => item.id === entrada.id)
  if (!encontrada) {
    throw new Error(`Questão ${entrada.id} não encontrada no pacote ${entrada.chunkUrl}`)
  }
  return encontrada
}

/** Usado em diagnósticos/testes que precisam inspecionar todas as questões indexadas sem acoplar ao Vite bundle. */
export async function carregarTodasQuestoesAcervo(): Promise<readonly DesafioUnificado[]> {
  const indice = await carregarIndiceAcervo()
  const urlsUnicas = [...new Set(indice.entradas.map((e) => e.chunkUrl))]
  const pacotes = await Promise.all(urlsUnicas.map((url) => carregarPacoteProva(url)))
  return pacotes.flatMap((p) => p.itens)
}
