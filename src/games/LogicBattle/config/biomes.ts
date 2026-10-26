// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/config/biomes.ts — Biomas & Progressão Pedagógica
// ──────────────────────────────────────────────────────────────────────────────
import { BiomeId, ConceptId, TrapId, TwinId } from '../types'

export interface BiomeConfig {
  id: BiomeId
  order: number
  name: string
  subtitlePt: string
  versionTag: 'v1' | 'v2'
  laneCount: 2 | 3
  segmentCount: number
  durationTargetSec: number
  skyGradient: [string, string]
  bridgeSurfaceColor: string
  bridgeEdgeColor: string
  horizonGlowColor: string
  concepts: readonly ConceptId[]
  trapIds: readonly TrapId[]
  twinIds: readonly TwinId[]
}

export const BIOMES: Record<BiomeId, BiomeConfig> = {
  planicie_pedra: {
    id: 'planicie_pedra',
    order: 1,
    name: 'Planície da Ponte de Pedra',
    subtitlePt: 'Inteiros (+, −, ×), Ponto de Virada, Esteiras e Portões Encadeados',
    versionTag: 'v1',
    laneCount: 2,
    segmentCount: 12,
    durationTargetSec: 60,
    skyGradient: ['#071226', '#162d4c'],
    bridgeSurfaceColor: '#1e293b',
    bridgeEdgeColor: '#38bdf8',
    horizonGlowColor: 'rgba(56, 189, 248, 0.35)',
    concepts: [
      'ponto_de_virada',
      'nao_comutatividade',
      'soma_repetida_esteira',
      'visao_caminho_inteiro',
      'equivalencia_gemeos',
    ],
    trapIds: ['T01', 'T07', 'T19', 'T20'],
    twinIds: ['G04', 'G05'],
  },
  fiorde_gelado: {
    id: 'fiorde_gelado',
    order: 2,
    name: 'Fiorde Gelado',
    subtitlePt: 'Frações (×½, ÷½, ×³⁄₂), Divisão com Resto e Precedência de Operações',
    versionTag: 'v1',
    laneCount: 2,
    segmentCount: 14,
    durationTargetSec: 70,
    skyGradient: ['#06182c', '#103b5c'],
    bridgeSurfaceColor: '#172554',
    bridgeEdgeColor: '#67e8f9',
    horizonGlowColor: 'rgba(103, 232, 249, 0.38)',
    concepts: [
      'fracao_menor_que_um',
      'divisao_por_fracao',
      'fracao_impropria',
      'precedencia_operacoes',
      'divisao_euclidiana_resto',
      'equivalencia_gemeos',
    ],
    trapIds: ['T02', 'T03', 'T12', 'T13', 'T15'],
    twinIds: ['G01', 'G05', 'G06'],
  },
  deserto_decimais: {
    id: 'deserto_decimais',
    order: 3,
    name: 'Deserto dos Decimais',
    subtitlePt: 'Decimais (×0,9, ÷1,25), Porcentagens (±50%, +200%) e Notação de Milhar',
    versionTag: 'v1',
    laneCount: 3,
    segmentCount: 15,
    durationTargetSec: 75,
    skyGradient: ['#1c1026', '#4a2511'],
    bridgeSurfaceColor: '#292524',
    bridgeEdgeColor: '#f59e0b',
    horizonGlowColor: 'rgba(245, 158, 11, 0.35)',
    concepts: [
      'multiplicacao_decimal',
      'assimetria_porcentagem',
      'divisao_decimal',
      'porcentagem_acumulada',
      'notacao_milhar',
      'equivalencia_gemeos',
    ],
    trapIds: ['T04', 'T08', 'T14', 'T16', 'T17'],
    twinIds: ['G02', 'G03', 'G04', 'G06'],
  },
  vulcao_negativos: {
    id: 'vulcao_negativos',
    order: 4,
    name: 'Vulcão dos Negativos',
    subtitlePt: 'Duplo Sinal −(−a) e Inversores Duplos (−1)·(−1)',
    versionTag: 'v2',
    laneCount: 3,
    segmentCount: 15,
    durationTargetSec: 80,
    skyGradient: ['#1a060d', '#4c0519'],
    bridgeSurfaceColor: '#27121b',
    bridgeEdgeColor: '#fb7185',
    horizonGlowColor: 'rgba(251, 113, 133, 0.38)',
    concepts: ['subtracao_negativo', 'produto_sinais', 'ponto_de_virada'],
    trapIds: ['T09', 'T18', 'T01'],
    twinIds: ['G01', 'G02'],
  },
  torre_potencias: {
    id: 'torre_potencias',
    order: 5,
    name: 'Torre das Potências',
    subtitlePt: 'Potências (², ^0), Raízes (√) e Notação Científica (×10ⁿ)',
    versionTag: 'v2',
    laneCount: 3,
    segmentCount: 16,
    durationTargetSec: 85,
    skyGradient: ['#0f0728', '#2e1065'],
    bridgeSurfaceColor: '#1e1b4b',
    bridgeEdgeColor: '#facc15',
    horizonGlowColor: 'rgba(250, 204, 21, 0.4)',
    concepts: ['expoente_zero', 'crescimento_quadratico', 'raiz_quadrada', 'potencia_base_dez'],
    trapIds: ['T05', 'T06', 'T10', 'T11'],
    twinIds: ['G04', 'G05'],
  },
}

export const BIOME_LIST: readonly BiomeConfig[] = [
  BIOMES.planicie_pedra,
  BIOMES.fiorde_gelado,
  BIOMES.deserto_decimais,
  BIOMES.vulcao_negativos,
  BIOMES.torre_potencias,
]
