/**
 * Porta abstrata e implementacao em memoria do banco pedagogico local (Fase Q3).
 *
 * Event Sourcing local-first:
 *  - Toda acao relevante emite um `EventoEstudo` imutavel (`dica_pedida`, `erro_alternativa`, `acerto`, `abandono`).
 *  - O estado derivado mantem `perfis[temaId]` e `historicoItens[itemId]` para diagnostico imediato
 *    ("onde o usuario precisa mais de ajuda" e "no que precisa prestar mais atencao") e revisao espacada.
 *  - Puro e injetavel: testes no Node usam `criarRepositorioMemoria()`; o navegador usa `criarRepositorioIndexedDb()`.
 *
 * PRIVACIDADE (repositorio publico, possivelmente menores): zero rede, zero nome/email/identificador pessoal.
 */
import type { ArmazenamentoSimples } from '../memoriaDeContas'
import { carregarCaderno, type Caderno } from '../cadernoDeEstudo'
import type { GrauDificuldade, OrigemQuestao, TipoErroPedagogico } from './contratosEstudo'

export const CHUTE_MAX_MS = 1_500
export const PENSOU_PLENO_MS = 8_000
export const ABANDONO_MIN_MS = 2_000
export const LIMITE_EVENTOS_MEMORIA = 2_000
export const CHAVE_MIGRADA_V1 = 'migrado_v1'

export type EventoEstudo =
  | {
      readonly tipo: 'dica_pedida'
      readonly quando: number
      readonly itemId: string
      readonly origem: OrigemQuestao
      readonly temaId: string
      readonly grau: GrauDificuldade
      readonly nivelDica: 1 | 2 | 3
      readonly tempoDesdeAberturaMs: number
    }
  | {
      readonly tipo: 'erro_alternativa'
      readonly quando: number
      readonly itemId: string
      readonly origem: OrigemQuestao
      readonly temaId: string
      readonly grau: GrauDificuldade
      readonly alternativaId: string
      readonly tagErro?: TipoErroPedagogico
      readonly tempoDesdeAberturaMs: number
    }
  | {
      readonly tipo: 'acerto'
      readonly quando: number
      readonly itemId: string
      readonly assinatura: string
      readonly origem: OrigemQuestao
      readonly temaId: string
      readonly grau: GrauDificuldade
      readonly errosNaConta: number
      readonly maiorDicaUsada: 0 | 1 | 2 | 3
      readonly tempoTotalMs: number
      readonly fatorBuff: number
    }
  | {
      readonly tipo: 'abandono'
      readonly quando: number
      readonly itemId: string
      readonly origem: OrigemQuestao
      readonly temaId: string
      readonly grau: GrauDificuldade
      readonly errosAntesDeFechar: number
      readonly maiorDicaUsada: 0 | 1 | 2 | 3
      readonly tempoAbertoMs: number
    }

export interface PerfilTema {
  readonly temaId: string
  readonly tentativas: number
  readonly acertosDePrimeira: number
  readonly acertosComErro: number
  readonly acertosComDica: number
  readonly errosTotais: number
  readonly errosPonderados: number
  readonly abandonos: number
  readonly dicasPedidas: number
  readonly tempoSomadoMs: number
  readonly sequenciaErros: number
  readonly chutesRapidos: number
  readonly errosPorTag: Partial<Record<TipoErroPedagogico, number>>
  readonly ultimaInteracaoMs: number
}

export interface RegistroItemEstudo {
  readonly itemId: string
  readonly origem: OrigemQuestao
  readonly temaId: string
  readonly grau: GrauDificuldade
  readonly vistoEmMs: number
  readonly vezesResolvida: number
  readonly vezesAbandonada: number
  readonly dominada: boolean
  readonly proximaRevisaoEmMs: number
}

export interface EstadoEstudoLocal {
  readonly versao: 2
  readonly migradoV1: boolean
  readonly eventos: readonly EventoEstudo[]
  readonly perfis: Readonly<Record<string, PerfilTema>>
  readonly historicoItens: Readonly<Record<string, RegistroItemEstudo>>
}

export interface RepositorioEstudo {
  inicializar(): Promise<void>
  registrarEvento(evento: EventoEstudo): Promise<void>
  lerEstado(): Promise<EstadoEstudoLocal>
  exportarTudoJson(): Promise<string>
  apagarTudo(): Promise<void>
}

export function estadoEstudoVazio(): EstadoEstudoLocal {
  return {
    versao: 2,
    migradoV1: false,
    eventos: [],
    perfis: {},
    historicoItens: {},
  }
}

export function perfilTemaVazio(temaId: string): PerfilTema {
  return {
    temaId,
    tentativas: 0,
    acertosDePrimeira: 0,
    acertosComErro: 0,
    acertosComDica: 0,
    errosTotais: 0,
    errosPonderados: 0,
    abandonos: 0,
    dicasPedidas: 0,
    tempoSomadoMs: 0,
    sequenciaErros: 0,
    chutesRapidos: 0,
    errosPorTag: {},
    ultimaInteracaoMs: 0,
  }
}

const TEMPO_TETO_MS = 3_600_000

const clampTempoMs = (ms: number): number => {
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.min(TEMPO_TETO_MS, Math.round(ms))
}

export function pesoDoErroEstudo(tempoMs: number): number {
  const t = clampTempoMs(tempoMs)
  if (t <= CHUTE_MAX_MS) return 0.15
  if (t >= PENSOU_PLENO_MS) return 1
  return 0.15 + 0.85 * ((t - CHUTE_MAX_MS) / (PENSOU_PLENO_MS - CHUTE_MAX_MS))
}

function eventoValido(ev: EventoEstudo): boolean {
  if (!ev || typeof ev !== 'object') return false
  if (!ev.temaId || !ev.itemId) return false
  if (!Number.isFinite(ev.quando) || ev.quando < 0) return false
  if (!Number.isInteger(ev.grau) || ev.grau < 1 || ev.grau > 7) return false
  return true
}

const DIA_MS = 86_400_000

function calcularProximaRevisaoMs(quando: number, errosNaConta: number, maiorDica: number, dominadaAntes: boolean): number {
  if (errosNaConta === 0 && maiorDica === 0) {
    return quando + (dominadaAntes ? 14 * DIA_MS : 5 * DIA_MS)
  }
  if (errosNaConta === 0 && maiorDica <= 1) {
    return quando + 2 * DIA_MS
  }
  return quando + Math.round(0.5 * DIA_MS)
}

export function aplicarEventoNoEstado(estado: EstadoEstudoLocal, bruto: EventoEstudo): EstadoEstudoLocal {
  if (!eventoValido(bruto)) return estado

  const anterior = estado.perfis[bruto.temaId] ?? perfilTemaVazio(bruto.temaId)
  const errosPorTag: Partial<Record<TipoErroPedagogico, number>> = { ...anterior.errosPorTag }
  let novoPerfil = anterior
  const prevItem = estado.historicoItens[bruto.itemId]
  let novoItem: RegistroItemEstudo | undefined = prevItem

  switch (bruto.tipo) {
    case 'dica_pedida': {
      novoPerfil = {
        ...anterior,
        dicasPedidas: anterior.dicasPedidas + 1,
        ultimaInteracaoMs: Math.max(anterior.ultimaInteracaoMs, bruto.quando),
      }
      break
    }
    case 'erro_alternativa': {
      const tempo = clampTempoMs(bruto.tempoDesdeAberturaMs)
      const ehChute = tempo < CHUTE_MAX_MS
      const tag = ehChute ? 'chute_rapido' : bruto.tagErro ?? 'calculo_aritmetico'
      errosPorTag[tag] = (errosPorTag[tag] ?? 0) + 1
      novoPerfil = {
        ...anterior,
        errosTotais: anterior.errosTotais + 1,
        errosPonderados: anterior.errosPonderados + pesoDoErroEstudo(tempo),
        chutesRapidos: anterior.chutesRapidos + (ehChute ? 1 : 0),
        errosPorTag,
        ultimaInteracaoMs: Math.max(anterior.ultimaInteracaoMs, bruto.quando),
      }
      break
    }
    case 'acerto': {
      const tempo = clampTempoMs(bruto.tempoTotalMs)
      const semErro = bruto.errosNaConta <= 0
      const semDica = bruto.maiorDicaUsada === 0
      novoPerfil = {
        ...anterior,
        tentativas: anterior.tentativas + 1,
        acertosDePrimeira: anterior.acertosDePrimeira + (semErro && semDica ? 1 : 0),
        acertosComErro: anterior.acertosComErro + (semErro ? 0 : 1),
        acertosComDica: anterior.acertosComDica + (semDica ? 0 : 1),
        tempoSomadoMs: anterior.tempoSomadoMs + tempo,
        sequenciaErros: semErro ? 0 : anterior.sequenciaErros + 1,
        ultimaInteracaoMs: Math.max(anterior.ultimaInteracaoMs, bruto.quando),
      }
      const dominada = semErro && semDica
      novoItem = {
        itemId: bruto.itemId,
        origem: bruto.origem,
        temaId: bruto.temaId,
        grau: bruto.grau,
        vistoEmMs: bruto.quando,
        vezesResolvida: (prevItem?.vezesResolvida ?? 0) + 1,
        vezesAbandonada: prevItem?.vezesAbandonada ?? 0,
        dominada,
        proximaRevisaoEmMs: calcularProximaRevisaoMs(bruto.quando, bruto.errosNaConta, bruto.maiorDicaUsada, prevItem?.dominada ?? false),
      }
      break
    }
    case 'abandono': {
      const tempo = clampTempoMs(bruto.tempoAbertoMs)
      if (tempo < ABANDONO_MIN_MS && bruto.errosAntesDeFechar === 0 && bruto.maiorDicaUsada === 0) {
        return estado
      }
      novoPerfil = {
        ...anterior,
        abandonos: anterior.abandonos + 1,
        errosPonderados: anterior.errosPonderados + 1.25,
        sequenciaErros: anterior.sequenciaErros + 1,
        tempoSomadoMs: anterior.tempoSomadoMs + tempo,
        errosPorTag,
        ultimaInteracaoMs: Math.max(anterior.ultimaInteracaoMs, bruto.quando),
      }
      novoItem = {
        itemId: bruto.itemId,
        origem: bruto.origem,
        temaId: bruto.temaId,
        grau: bruto.grau,
        vistoEmMs: bruto.quando,
        vezesResolvida: prevItem?.vezesResolvida ?? 0,
        vezesAbandonada: (prevItem?.vezesAbandonada ?? 0) + 1,
        dominada: false,
        proximaRevisaoEmMs: bruto.quando + 60_000,
      }
      break
    }
  }

  return {
    ...estado,
    eventos: [...estado.eventos, bruto].slice(-LIMITE_EVENTOS_MEMORIA),
    perfis: { ...estado.perfis, [bruto.temaId]: novoPerfil },
    historicoItens: novoItem ? { ...estado.historicoItens, [bruto.itemId]: novoItem } : estado.historicoItens,
  }
}

/**
 * Migra de forma idempotente e NAO destrutiva o `cadernoDeEstudo` v1 (`ld_ilha_caderno_v1`).
 * A chave v1 original NAO e apagada: se houver rollback, a versao antiga continua operando.
 */
export function migrarCadernoV1ParaEstado(cadernoV1: Caderno, estadoAtual: EstadoEstudoLocal): EstadoEstudoLocal {
  if (estadoAtual.migradoV1) return estadoAtual
  const perfis: Record<string, PerfilTema> = { ...estadoAtual.perfis }

  for (const [temaId, k] of Object.entries(cadernoV1.conceitos)) {
    const atual = perfis[temaId] ?? perfilTemaVazio(temaId)
    const acertosSemErro = Math.max(0, k.n - (k.er > 0 ? Math.min(k.n, k.er) : 0))
    perfis[temaId] = {
      ...atual,
      tentativas: atual.tentativas + k.n,
      acertosDePrimeira: atual.acertosDePrimeira + acertosSemErro,
      acertosComErro: atual.acertosComErro + (k.n - acertosSemErro),
      errosTotais: atual.errosTotais + k.er,
      errosPonderados: atual.errosPonderados + k.w,
      tempoSomadoMs: atual.tempoSomadoMs + k.t,
      sequenciaErros: Math.max(atual.sequenciaErros, k.sq),
      ultimaInteracaoMs: Math.max(atual.ultimaInteracaoMs, k.u),
    }
  }

  return {
    ...estadoAtual,
    migradoV1: true,
    perfis,
  }
}

export function criarRepositorioMemoria(opcoes?: {
  estadoInicial?: EstadoEstudoLocal
  storageV1?: ArmazenamentoSimples | null
}): RepositorioEstudo {
  let estado: EstadoEstudoLocal = opcoes?.estadoInicial ?? estadoEstudoVazio()

  return {
    async inicializar(): Promise<void> {
      if (!estado.migradoV1) {
        const v1 = carregarCaderno(opcoes?.storageV1)
        estado = migrarCadernoV1ParaEstado(v1, estado)
      }
    },
    async registrarEvento(evento: EventoEstudo): Promise<void> {
      estado = aplicarEventoNoEstado(estado, evento)
    },
    async lerEstado(): Promise<EstadoEstudoLocal> {
      return estado
    },
    async exportarTudoJson(): Promise<string> {
      return JSON.stringify(estado, null, 2)
    },
    async apagarTudo(): Promise<void> {
      estado = { ...estadoEstudoVazio(), migradoV1: true }
    },
  }
}
