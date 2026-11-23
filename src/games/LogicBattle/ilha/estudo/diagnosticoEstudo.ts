/**
 * Motor puro de diagnostico pedagogico (Fase Q3).
 *
 * Responde duas perguntas diretas ao aluno:
 *  1. "Onde voce precisa mais de ajuda?" (temas ranqueados por risco real: erro ponderado pelo tempo, abandono e dependencia de dicas)
 *  2. "No que voce precisa prestar mais atencao?" (armadilhas recorrentes por `TipoErroPedagogico`, chutes rapidos e abandonos)
 */
import { DESCRICAO_ERRO_PEDAGOGICO, tituloDoTema, type TipoErroPedagogico } from './contratosEstudo'
import type { EstadoEstudoLocal, PerfilTema } from './repositorioEstudo'

export interface PontoAjudaTema {
  readonly temaId: string
  readonly tituloPt: string
  readonly pontuacaoRisco: number
  readonly taxaErroEfetiva: number
  readonly dependenciaDica: number
  readonly abandonos: number
  readonly tentativas: number
  readonly errosTotais: number
  readonly recomendacaoPt: string
}

export interface AlertaAtencao {
  readonly tagErro: TipoErroPedagogico
  readonly tituloPt: string
  readonly ocorrencias: number
  readonly alertaPraticoPt: string
}

export interface ResumoEstudoGeral {
  readonly totalResolvidas: number
  readonly dePrimeiraPct: number
  readonly totalErros: number
  readonly totalAbandonos: number
  readonly totalDicas: number
  readonly enemsDominados: number
  readonly chutesRapidos: number
}

export interface DiagnosticoEstudo {
  readonly ondePrecisaAjuda: readonly PontoAjudaTema[]
  readonly emQuePrestarAtencao: readonly AlertaAtencao[]
  readonly resumoGeral: ResumoEstudoGeral
}

export const AMOSTRA_MINIMA_TEMA = 2

export function calcularRiscoTema(p: PerfilTema): number {
  const interacoes = p.tentativas + p.abandonos
  if (interacoes < AMOSTRA_MINIMA_TEMA && p.abandonos === 0) return 0
  const base = Math.max(1, interacoes)
  const taxaErroPond = p.errosPonderados / base
  const taxaAbandono = p.abandonos / base
  const taxaDica = p.acertosComDica / base
  const riscoBruto =
    taxaErroPond * 45 +
    taxaAbandono * 70 +
    taxaDica * 20 +
    Math.min(4, p.sequenciaErros) * 12
  return Math.round(riscoBruto * 10) / 10
}

function montarRecomendacaoTema(p: PerfilTema, tagDominante?: TipoErroPedagogico): string {
  if (p.abandonos > 0 && p.errosTotais === 0 && p.abandonos >= p.tentativas) {
    return `Você pulou ou fechou ${p.abandonos}x aqui antes de terminar — experimente a Dica 1 para destravar a leitura.`
  }
  if (p.abandonos > 0 && p.abandonos >= p.tentativas) {
    return `Você fechou ${p.abandonos}x antes de concluir e teve ${p.errosTotais} erro(s) — use a Dica 1 antes de desistir.`
  }
  if (tagDominante && DESCRICAO_ERRO_PEDAGOGICO[tagDominante]) {
    return `Ponto crítico: ${DESCRICAO_ERRO_PEDAGOGICO[tagDominante].titulo.toLowerCase()}.`
  }
  if (p.acertosComDica > p.acertosDePrimeira) {
    return 'Você acerta quando pede dica; pratique mais uma rodada tentando montar o 1º passo sozinho.'
  }
  return 'Refaça 2 ou 3 questões desse tema com calma antes de acelerar.'
}

export function gerarDiagnosticoEstudo(estado: EstadoEstudoLocal): DiagnosticoEstudo {
  const ajuda: PontoAjudaTema[] = []
  const contagemTags = new Map<TipoErroPedagogico, number>()

  let totalResolvidas = 0
  let totalDePrimeira = 0
  let totalErros = 0
  let totalAbandonos = 0
  let totalDicas = 0
  let totalChutes = 0

  for (const p of Object.values(estado.perfis)) {
    totalResolvidas += p.tentativas
    totalDePrimeira += p.acertosDePrimeira
    totalErros += p.errosTotais
    totalAbandonos += p.abandonos
    totalDicas += p.dicasPedidas
    totalChutes += p.chutesRapidos

    let tagTop: TipoErroPedagogico | undefined
    let tagMax = 0
    for (const [tag, qtd] of Object.entries(p.errosPorTag) as Array<[TipoErroPedagogico, number | undefined]>) {
      if (!qtd || qtd <= 0) continue
      contagemTags.set(tag, (contagemTags.get(tag) ?? 0) + qtd)
      if (qtd > tagMax) {
        tagMax = qtd
        tagTop = tag
      }
    }

    const risco = calcularRiscoTema(p)
    if (risco <= 0) continue
    if (p.errosTotais === 0 && p.abandonos === 0 && p.acertosComDica === 0) continue

    const denom = Math.max(1, p.tentativas + p.abandonos)
    ajuda.push({
      temaId: p.temaId,
      tituloPt: tituloDoTema(p.temaId),
      pontuacaoRisco: risco,
      taxaErroEfetiva: Math.round((p.errosPonderados / denom) * 100) / 100,
      dependenciaDica: Math.round((p.acertosComDica / denom) * 100) / 100,
      abandonos: p.abandonos,
      tentativas: p.tentativas,
      errosTotais: p.errosTotais,
      recomendacaoPt: montarRecomendacaoTema(p, tagTop),
    })
  }

  ajuda.sort((a, b) => b.pontuacaoRisco - a.pontuacaoRisco || b.abandonos - a.abandonos || a.temaId.localeCompare(b.temaId))

  const atencao: AlertaAtencao[] = [...contagemTags.entries()]
    .map(([tagErro, ocorrencias]) => {
      const desc = DESCRICAO_ERRO_PEDAGOGICO[tagErro]
      return {
        tagErro,
        tituloPt: desc?.titulo ?? tagErro,
        ocorrencias,
        alertaPraticoPt: desc?.alertaPratico ?? 'Revise esse ponto com atencao antes de confirmar a resposta.',
      }
    })
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.tagErro.localeCompare(b.tagErro))

  const enemsDominados = Object.values(estado.historicoItens).filter(
    (it) => it.origem === 'enem_oficial' && it.dominada,
  ).length

  return {
    ondePrecisaAjuda: ajuda,
    emQuePrestarAtencao: atencao,
    resumoGeral: {
      totalResolvidas,
      dePrimeiraPct: totalResolvidas > 0 ? Math.round((totalDePrimeira / totalResolvidas) * 100) : 0,
      totalErros,
      totalAbandonos,
      totalDicas,
      enemsDominados,
      chutesRapidos: totalChutes,
    },
  }
}
