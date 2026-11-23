/**
 * Orquestrador adaptativo de questões (Fase Q4).
 *
 * Une:
 *  - Graus 1..4: `generateInfiniteChallenge` (`infiniteMathEngine.ts`) com foco em temas fracos
 *    (`preferredConceptId`), adaptado para `DesafioUnificado` via `adaptarDesafioMotor` com dicas
 *    100% livres de spoiler.
 *  - Graus 5..7: Lote oficial ENEM (`enemMatematicaLote1.ts`, carregado por `import()` dinâmico
 *    em chunk separado) + 4 motores paramétricos ENEM-like (`geradoresEnem.ts`).
 *
 * Respeita anel anti-repetição, revisão espaçada (`proximaRevisaoEmMs`), falhas de rede/chunk
 * (cai para os motores paramétricos) e treino direcionado pelo botão "Treinar agora" do Caderno.
 */
import type { ConceptId } from '../contaContratos'
import { semente } from '../geradoresBase'
import { generateInfiniteChallenge } from '../infiniteMathEngine'
import {
  adaptarDesafioMotor,
  type DesafioUnificado,
  type GrauDificuldade,
} from './contratosEstudo'
import { gerarDiagnosticoEstudo } from './diagnosticoEstudo'
import { GERADORES_ENEM_PARAMETRICOS } from './geradoresEnem'
import type { EstadoEstudoLocal } from './repositorioEstudo'

const CONCEPT_IDS_VALIDOS = new Set<string>([
  'ponto_de_virada',
  'nao_comutatividade',
  'soma_repetida_esteira',
  'visao_caminho_inteiro',
  'fracao_menor_que_um',
  'divisao_por_fracao',
  'fracao_impropria',
  'precedencia_operacoes',
  'divisao_euclidiana_resto',
  'multiplicacao_decimal',
  'assimetria_porcentagem',
  'divisao_decimal',
  'porcentagem_acumulada',
  'notacao_milhar',
  'expoente_zero',
  'crescimento_quadratico',
  'subtracao_negativo',
  'raiz_quadrada',
  'potencia_base_dez',
  'produto_sinais',
  'equivalencia_gemeos',
])

const MAPA_TEMA_ENEM_PARA_CONCEITO: Record<string, ConceptId> = {
  enem_razoes_escalas: 'fracao_impropria',
  enem_porcentagem_financeira: 'assimetria_porcentagem',
  enem_estatistica_medias: 'precedencia_operacoes',
  enem_probabilidade_contagem: 'soma_repetida_esteira',
  enem_funcoes_sequencias: 'ponto_de_virada',
  enem_geometria_medidas: 'crescimento_quadratico',
  enem_aritmetica_ciclos: 'divisao_euclidiana_resto',
  leitura_dados_codigo: 'notacao_milhar',
}

export function resolverConceitoMotorParaTema(temaId: string | null | undefined): ConceptId | undefined {
  if (!temaId) return undefined
  if (CONCEPT_IDS_VALIDOS.has(temaId)) return temaId as ConceptId
  return MAPA_TEMA_ENEM_PARA_CONCEITO[temaId]
}

let cacheEnemLote1: Promise<readonly DesafioUnificado[]> | null = null

export function carregarEnemLote1Lazy(): Promise<readonly DesafioUnificado[]> {
  if (!cacheEnemLote1) {
    cacheEnemLote1 = import('./bancos/enemMatematicaLote1')
      .then((mod) => mod.ENEM_MATEMATICA_LOTE1)
      .catch(() => {
        cacheEnemLote1 = null
        return [] as readonly DesafioUnificado[]
      })
  }
  return cacheEnemLote1
}

export function limparCacheEnemLazy(): void {
  cacheEnemLote1 = null
}

export interface OpcoesSelecaoQuestao {
  readonly grau: GrauDificuldade
  readonly estadoEstudo: EstadoEstudoLocal
  readonly temaPreferido?: string | null
  readonly preferirOrigem?: 'auto' | 'enem_oficial' | 'motor_parametrico'
  readonly assinaturasVistas?: ReadonlySet<string> | readonly string[]
  readonly arquetiposRecentes?: readonly string[]
  readonly seed?: number
  readonly agoraMs?: number
  readonly carregarBancoEnem?: () => Promise<readonly DesafioUnificado[]>
}

function hashDeterministico(seed: number, texto: string): number {
  let h = (seed ^ 0x811c9dc5) >>> 0
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

function sintetizarMotorEnem(
  grau: GrauDificuldade,
  temaPreferido: string | null | undefined,
  riscoPorTema: Map<string, number>,
  vistosSet: ReadonlySet<string>,
  arquetiposRecentes: readonly string[],
  seed: number,
): DesafioUnificado | null {
  const doGrau = GERADORES_ENEM_PARAMETRICOS.filter((g) => g.grau === grau)
  const poolBase = doGrau.length > 0 ? doGrau : GERADORES_ENEM_PARAMETRICOS
  if (poolBase.length === 0) return null

  const ultimoArquetipo = arquetiposRecentes[arquetiposRecentes.length - 1]
  const ultimosDois = new Set(arquetiposRecentes.slice(-2))
  const recentesSet = new Set(arquetiposRecentes)
  const ultimaPosRecente = new Map<string, number>()
  arquetiposRecentes.forEach((id, idx) => ultimaPosRecente.set(id, idx))

  const semUltimo =
    poolBase.length > 1 && ultimoArquetipo ? poolBase.filter((g) => g.archetypeId !== ultimoArquetipo) : poolBase

  const filtradosTema = temaPreferido
    ? semUltimo.filter((g) => g.temaId === temaPreferido && !ultimosDois.has(g.archetypeId))
    : []
  const candidatosBase = filtradosTema.length > 0 ? filtradosTema : semUltimo

  const candidatosGeradores = [...candidatosBase].sort((a, b) => {
    const frescoA = recentesSet.has(a.archetypeId) ? 1 : 0
    const frescoB = recentesSet.has(b.archetypeId) ? 1 : 0
    if (frescoA !== frescoB) return frescoA - frescoB

    const posA = ultimaPosRecente.get(a.archetypeId) ?? -1
    const posB = ultimaPosRecente.get(b.archetypeId) ?? -1
    if (posA !== posB) return posA - posB

    const pA = (temaPreferido && a.temaId === temaPreferido ? 1000 : 0) + (riscoPorTema.get(a.temaId) ?? 0)
    const pB = (temaPreferido && b.temaId === temaPreferido ? 1000 : 0) + (riscoPorTema.get(b.temaId) ?? 0)
    if (pB !== pA) return pB - pA
    return (hashDeterministico(seed, a.archetypeId) % 97) - (hashDeterministico(seed, b.archetypeId) % 97)
  })

  let ultimoGerado: DesafioUnificado | null = null
  for (let tentativa = 0; tentativa < 24; tentativa++) {
    const gen = candidatosGeradores[tentativa % candidatosGeradores.length]
    const rng = semente(seed + tentativa * 1013 + 7)
    const item = gen.synthesize(rng, seed + tentativa)
    ultimoGerado = item
    if (!vistosSet.has(item.assinatura)) return item
  }
  return ultimoGerado
}

export async function selecionarProximoDesafio(opcoes: OpcoesSelecaoQuestao): Promise<DesafioUnificado> {
  const agoraMs = opcoes.agoraMs ?? Date.now()
  const seed = Math.max(1, Math.floor(Math.abs(opcoes.seed ?? agoraMs)))
  const vistosArr = opcoes.assinaturasVistas
    ? Array.isArray(opcoes.assinaturasVistas)
      ? opcoes.assinaturasVistas
      : [...opcoes.assinaturasVistas]
    : []
  const vistosSet = new Set<string>(vistosArr)
  const diag = gerarDiagnosticoEstudo(opcoes.estadoEstudo)

  // Graus 1..4: motor paramétrico infinito com direcionamento opcional para o tema fraco
  if (opcoes.grau <= 4) {
    const temaAlvo = opcoes.temaPreferido ?? diag.ondePrecisaAjuda[0]?.temaId
    const preferredConceptId = resolverConceitoMotorParaTema(temaAlvo)
    const bruto = generateInfiniteChallenge({
      tier: opcoes.grau as 1 | 2 | 3 | 4,
      seed,
      preferredConceptId,
      excludeSignatures: vistosArr,
      excludeArchetypes: opcoes.arquetiposRecentes,
    })
    return adaptarDesafioMotor(bruto)
  }

  // Graus 5..7: acervo oficial ENEM (lazy) + 8 motores paramétricos ENEM-like
  const recentes = opcoes.arquetiposRecentes ?? []
  const ultimoArquetipo = recentes[recentes.length - 1]
  const recentesSet = new Set(recentes)
  const ultimosTresSet = new Set(recentes.slice(-3))
  const ultimaPosRecente = new Map<string, number>()
  recentes.forEach((id, idx) => ultimaPosRecente.set(id, idx))
  const vistasPos = new Map<string, number>()
  vistosArr.forEach((sig, idx) => vistasPos.set(sig, idx))

  const riscoPorTema = new Map(diag.ondePrecisaAjuda.map((p) => [p.temaId, p.pontuacaoRisco]))
  let bancoEnem: readonly DesafioUnificado[] = []
  if (opcoes.preferirOrigem !== 'motor_parametrico') {
    try {
      const loader = opcoes.carregarBancoEnem ?? carregarEnemLote1Lazy
      bancoEnem = await loader()
    } catch {
      bancoEnem = []
    }
  }

  const doGrauEnem = bancoEnem.filter((d) => d.grau === opcoes.grau)
  const elegiveisEnem = doGrauEnem.filter((d) => {
    if (vistosSet.has(d.assinatura)) return false
    if (ultimoArquetipo && d.arquetipoOuItemId === ultimoArquetipo) return false
    const hist = opcoes.estadoEstudo.historicoItens[d.id]
    if (hist && hist.dominada && hist.proximaRevisaoEmMs > agoraMs) return false
    return true
  })

  const geradoresDoGrau = GERADORES_ENEM_PARAMETRICOS.filter((g) => g.grau === opcoes.grau)
  const temMotorFresco = geradoresDoGrau.some(
    (g) => g.archetypeId !== ultimoArquetipo && !recentesSet.has(g.archetypeId),
  )
  const temGeradorTemaPreferidoFresco = Boolean(
    opcoes.temaPreferido &&
      geradoresDoGrau.some((g) => g.temaId === opcoes.temaPreferido && !recentesSet.has(g.archetypeId)),
  )
  const temEnemTemaPreferido = Boolean(
    opcoes.temaPreferido && elegiveisEnem.some((d) => d.temaId === opcoes.temaPreferido),
  )
  const ultimoFoiMotor = Boolean(
    ultimoArquetipo && GERADORES_ENEM_PARAMETRICOS.some((g) => g.archetypeId === ultimoArquetipo),
  )

  const deveUsarMotor =
    opcoes.preferirOrigem === 'motor_parametrico' ||
    (opcoes.preferirOrigem !== 'enem_oficial' &&
      ((elegiveisEnem.length === 0 && temMotorFresco) ||
        (elegiveisEnem.length > 0 &&
          temMotorFresco &&
          !ultimoFoiMotor &&
          ((Boolean(opcoes.temaPreferido) && !temEnemTemaPreferido && temGeradorTemaPreferidoFresco) ||
            (!opcoes.temaPreferido && seed % 4 === 0)))))

  if (deveUsarMotor) {
    const gerado = sintetizarMotorEnem(
      opcoes.grau,
      opcoes.temaPreferido,
      riscoPorTema,
      vistosSet,
      recentes,
      seed,
    )
    if (gerado) return gerado
  }

  if (elegiveisEnem.length > 0) {
    const ranqueados = [...elegiveisEnem].sort((a, b) => {
      const pontuar = (d: DesafioUnificado): number => {
        const hist = opcoes.estadoEstudo.historicoItens[d.id]
        let score = 0
        if (!recentesSet.has(d.arquetipoOuItemId)) score += 100_000
        if (opcoes.temaPreferido && d.temaId === opcoes.temaPreferido) score += 10_000
        score += (riscoPorTema.get(d.temaId) ?? 0) * 3
        if (hist) {
          if (hist.vezesAbandonada > 0 && !hist.dominada) score += 80
          if (hist.proximaRevisaoEmMs <= agoraMs) score += 50
        } else {
          score += 25
        }
        return score
      }
      const diff = pontuar(b) - pontuar(a)
      if (diff !== 0) return diff
      return (hashDeterministico(seed, a.id) % 997) - (hashDeterministico(seed, b.id) % 997)
    })
    return ranqueados[0]
  }

  // Quando o lote oficial + ciclo recente de motores paramétricos já rodaram, recicla questões oficiais
  // ENEM (evitando a última e as 3 mais recentes) antes de repetir motores paramétricos indefinidamente.
  if (opcoes.preferirOrigem !== 'motor_parametrico' && doGrauEnem.length > 0) {
    const semUltimo =
      doGrauEnem.length > 1 && ultimoArquetipo
        ? doGrauEnem.filter((d) => d.arquetipoOuItemId !== ultimoArquetipo)
        : doGrauEnem
    const foraUltimosTres = semUltimo.filter((d) => !ultimosTresSet.has(d.arquetipoOuItemId))
    const poolReciclavel = foraUltimosTres.length > 0 ? foraUltimosTres : semUltimo
    const recicladas = [...poolReciclavel].sort((a, b) => {
      const histA = opcoes.estadoEstudo.historicoItens[a.id]
      const histB = opcoes.estadoEstudo.historicoItens[b.id]

      const domA = histA?.dominada ? 1 : 0
      const domB = histB?.dominada ? 1 : 0
      if (domA !== domB) return domA - domB

      const posRecA = ultimaPosRecente.get(a.arquetipoOuItemId) ?? -1
      const posRecB = ultimaPosRecente.get(b.arquetipoOuItemId) ?? -1
      if (posRecA !== posRecB) return posRecA - posRecB

      const posVisA = vistasPos.get(a.assinatura) ?? -1
      const posVisB = vistasPos.get(b.assinatura) ?? -1
      if (posVisA !== posVisB) return posVisA - posVisB

      const revA = histA?.proximaRevisaoEmMs ?? 0
      const revB = histB?.proximaRevisaoEmMs ?? 0
      if (revA !== revB) return revA - revB

      const temaA = opcoes.temaPreferido && a.temaId === opcoes.temaPreferido && !ultimosTresSet.has(a.arquetipoOuItemId) ? 0 : 1
      const temaB = opcoes.temaPreferido && b.temaId === opcoes.temaPreferido && !ultimosTresSet.has(b.arquetipoOuItemId) ? 0 : 1
      if (temaA !== temaB) return temaA - temaB

      return (hashDeterministico(seed, a.id) % 997) - (hashDeterministico(seed, b.id) % 997)
    })
    return recicladas[0]
  }

  const fallbackMotor = sintetizarMotorEnem(
    opcoes.grau,
    opcoes.temaPreferido,
    riscoPorTema,
    vistosSet,
    recentes,
    seed,
  )
  if (fallbackMotor) return fallbackMotor

  return adaptarDesafioMotor(
    generateInfiniteChallenge({
      tier: 4,
      seed,
      preferredConceptId: resolverConceitoMotorParaTema(opcoes.temaPreferido),
      excludeSignatures: vistosArr,
      excludeArchetypes: opcoes.arquetiposRecentes,
    }),
  )
}
