// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/engineContract.ts — Contrato Comum de Engine (V3 §3.1)
// Conecta o Reino (Hub da Cidadela) às 6 Engines dos conceitos em master-plan/conceitos/
// ──────────────────────────────────────────────────────────────────────────────
import { ArmyCount, BiomeId, ConceptId, NotationMode, TrapHit } from '../types'

export type EngineId =
  | 'ponte_portoes'
  | 'cerco_torres'
  | 'forte_bandeira'
  | 'pedreira_rei'
  | 'arena_ondas'
  | 'serpente_numeros'

export interface RealmBuffs {
  initialArmyBonus: ArmyCount
  fireCadenceMultiplier: number
  wisdomStarBonus: number
  remainderConversionBonus: number
  lunetaCharges: number
}

export interface EngineInput {
  engineId: EngineId
  seed: number
  level: number
  biomeId: BiomeId
  regionId: string
  targetConcepts: readonly ConceptId[]
  realmBuffs: RealmBuffs
  notationMode: NotationMode
  reducedMotion: boolean
}

export interface EngineResult {
  engineId: EngineId
  outcome: 'VICTORY' | 'DEFEAT'
  playerArmy: ArmyCount
  enemyForce: ArmyCount
  survivors: ArmyCount
  coinsEarned: ArmyCount
  starsEarned: number
  tokensEarned: number
  remaindersEarned: number
  maxCombo: number
  optimalChoices: number
  trapHits: TrapHit[]
  practicedConcepts: ConceptId[]
  durationMs: number
}

export interface EngineCatalogSpec {
  id: EngineId
  name: string
  shortName: string
  icon: string
  referenceGame: string
  conceptFile: string
  mathConceptPt: string
  mechanicSummaryPt: string
  mapSpot: { x: number; y: number; pinColor: string }
}

export const COMBO_MULTIPLIERS = [1, 1.5, 2, 3] as const

export function getComboMultiplier(streak: number): number {
  if (streak <= 0) return 1
  if (streak === 1) return 1.5
  if (streak === 2) return 2
  return 3
}

export const ENGINE_CATALOG: Record<EngineId, EngineCatalogSpec> = {
  ponte_portoes: {
    id: 'ponte_portoes',
    name: 'Ponte dos Portões V3',
    shortName: 'Ponte',
    icon: '🏃',
    referenceGame: 'Z Route: Redemption',
    conceptFile: 'engine_G_ponte_tiro_continuo_sem_pausa.jpg',
    mathConceptPt: 'Operações, ordem de grandeza e precedência',
    mechanicSummaryPt:
      'Esquadrão corre e atira sem parar desde o 1º segundo; portões alteram o exército e dão Combo de Cálculo.',
    mapSpot: { x: 528, y: 185, pinColor: '#38bdf8' },
  },
  cerco_torres: {
    id: 'cerco_torres',
    name: 'Muralha da Vírgula (Cerco das Torres)',
    shortName: 'Torres',
    icon: '🏹',
    referenceGame: 'Kingshot',
    conceptFile: 'engine_B_cerco_das_torres.jpg',
    mathConceptPt: 'Decimais, comparação e multiplicação (×10, ×100)',
    mechanicSummaryPt:
      'Horda vermelha avança na estrada em S; posicione e evolua torres multiplicadoras para defender o castelo.',
    mapSpot: { x: 225, y: 265, pinColor: '#22c55e' },
  },
  forte_bandeira: {
    id: 'forte_bandeira',
    name: 'Forte do Comandante (Forte da Bandeira)',
    shortName: 'Forte',
    icon: '🚩',
    referenceGame: 'Top Force',
    conceptFile: 'engine_C_forte_da_bandeira.jpg',
    mathConceptPt: 'Razão, proporção, potências (2²) e custo/benefício',
    mechanicSummaryPt:
      'Comandante anda pelo forte e destrava pads matemáticos que constroem tropas para deter os invasores.',
    mapSpot: { x: 215, y: 465, pinColor: '#10b981' },
  },
  pedreira_rei: {
    id: 'pedreira_rei',
    name: 'Mina do Resto (Pedreira do Rei)',
    shortName: 'Mina',
    icon: '⛏️',
    referenceGame: 'Idle Quarry Tycoon',
    conceptFile: 'engine_D_pedreira_do_rei.jpg',
    mathConceptPt: 'Divisão euclidiana com resto (÷10), soma de pesos (kg)',
    mechanicSummaryPt:
      'Puxe blocos de pedra (30 kg, 90 kg), contrate mineradores e triture na máquina ÷10 para forjar lingotes.',
    mapSpot: { x: 438, y: 495, pinColor: '#facc15' },
  },
  arena_ondas: {
    id: 'arena_ondas',
    name: 'Arena das Ondas (Horde Survivor)',
    shortName: 'Arena',
    icon: '⚔️',
    referenceGame: 'Survivor Arena',
    conceptFile: 'engine_E_arena_das_ondas.jpg',
    mathConceptPt: 'Porcentagens (+25%), dobro (×2) e frações (1/2)',
    mechanicSummaryPt:
      'Cavaleiro gira a espada de energia no centro da arena nevada; escolha cartas matemáticas em movimento.',
    mapSpot: { x: 645, y: 455, pinColor: '#a855f7' },
  },
  serpente_numeros: {
    id: 'serpente_numeros',
    name: 'Serpente dos Números',
    shortName: 'Serpente',
    icon: '🐉',
    referenceGame: 'Serpent Maze Defense',
    conceptFile: 'engine_F_serpente_dos_numeros.jpg',
    mathConceptPt: 'Múltiplos, divisão exata (÷2) e subtração rápida (−5)',
    mechanicSummaryPt:
      'Dragão segmentado (48, 36, 24, 12, 6) avança pelo labirinto; combine tiros dos arqueiros com operações.',
    mapSpot: { x: 665, y: 265, pinColor: '#ef4444' },
  },
}

export const ENGINE_LIST: readonly EngineCatalogSpec[] = Object.values(ENGINE_CATALOG)
