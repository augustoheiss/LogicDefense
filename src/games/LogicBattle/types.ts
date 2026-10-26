// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/types.ts — Contratos de Domínio & Estado (Logic Battle)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Porta opaca para contagem de exército (`ArmyCount`).
 * Isola a representação numérica para permitir migração futura para BigNum/mantissa-expoente
 * sem alterar renderizadores, UI ou catálogo (Teste do Helicóptero §2.3).
 */
export type ArmyCount = number

export type GateOperator = '+' | '−' | '×' | '÷' | '%+' | '%−' | '^' | '√' | 'expr'

export interface RationalOperand {
  /** Valor numérico decimal/inteiro equivalente */
  value: number
  /** Numerador exato para aritmética racional sem erro de ponto flutuante */
  num: number
  /** Denominador exato (> 0) */
  den: number
  /** Para expressões compostas como '+ 3 × 3' ou '× (−1)·(−1)' */
  exprKind?: 'add_mul' | 'double_neg_mul' | 'sub_neg'
  /** Auxiliar para expressões compostas */
  secondaryValue?: number
}

export interface Gate {
  id: string
  op: GateOperator
  operand: RationalOperand
  /** Texto exato exibido na placa do portão (Regra de Ouro da Honestidade: 100% fiel ao efeito) */
  label: string
  /** Subtítulo opcional (ex.: fração empilhada ou dica de detector) */
  subLabel?: string
  /** Tempo de leitura recomendado em ms */
  readingTimeMs: number
}

export type SegmentKind = 'pair' | 'conveyor' | 'chain' | 'twins' | 'redemption'

export type BiomeId =
  | 'planicie_pedra'
  | 'fiorde_gelado'
  | 'deserto_decimais'
  | 'vulcao_negativos'
  | 'torre_potencias'

export type ConceptId =
  | 'ponto_de_virada'
  | 'nao_comutatividade'
  | 'soma_repetida_esteira'
  | 'visao_caminho_inteiro'
  | 'fracao_menor_que_um'
  | 'divisao_por_fracao'
  | 'fracao_impropria'
  | 'precedencia_operacoes'
  | 'divisao_euclidiana_resto'
  | 'multiplicacao_decimal'
  | 'assimetria_porcentagem'
  | 'divisao_decimal'
  | 'porcentagem_acumulada'
  | 'notacao_milhar'
  | 'expoente_zero'
  | 'crescimento_quadratico'
  | 'subtracao_negativo'
  | 'raiz_quadrada'
  | 'potencia_base_dez'
  | 'produto_sinais'
  | 'equivalencia_gemeos'

export type TrapId =
  | 'T01'
  | 'T02'
  | 'T03'
  | 'T04'
  | 'T05'
  | 'T06'
  | 'T07'
  | 'T08'
  | 'T09'
  | 'T10'
  | 'T11'
  | 'T12'
  | 'T13'
  | 'T14'
  | 'T15'
  | 'T16'
  | 'T17'
  | 'T18'
  | 'T19'
  | 'T20'

export type TwinId = 'G01' | 'G02' | 'G03' | 'G04' | 'G05' | 'G06'

export interface LaneSegment {
  id: string
  index: number
  kind: SegmentKind
  /** Cada faixa contém 1 portão ('pair', 'twins', 'redemption') ou vários em sequência ('conveyor', 'chain') */
  lanes: Gate[][]
  /** Presente somente se o segmento foi gerado a partir de uma pegadinha catalogada */
  trapId?: TrapId
  /** Índice da faixa intuitivamente atraente (porém matematicamente pior para o N esperado) */
  intuitiveLane?: number
  /** Presente se for um par de Portões Gêmeos */
  twinId?: TwinId
  /** Se verdadeiro, exibe o alerta sutil ⚠ do Observatório / estreia guiada */
  showDetectorWarning?: boolean
  /** Ficha associada quando kind === 'redemption' */
  redemptionTokenId?: string
  /** Posição Z normalizada na pista (0 .. 1) */
  zPosition: number
}

export interface EnemySpec {
  horde: ArmyCount
  bossHp: ArmyCount
  bossName: string
  bossTitle: string
  totalForce: ArmyCount
}

export interface RunPlan {
  runId: string
  seed: number
  biomeId: BiomeId
  regionId: string
  laneCount: 2 | 3
  n0: ArmyCount
  segments: LaneSegment[]
  enemy: EnemySpec
  durationTargetSec: number
}

export interface PairCounterfactual {
  segmentId: string
  segmentIndex: number
  laneResults: ArmyCount[]
  bestLane: number
  worstLane: number
  bestValue: ArmyCount
  worstValue: ArmyCount
}

export interface PathOracleResult {
  best: ArmyCount
  worst: ArmyCount
  bestPath: number[]
  worstPath: number[]
  perSegment: PairCounterfactual[]
}

export interface TrapHit {
  trapId: TrapId
  trapName: string
  conceptId: ConceptId
  segmentId: string
  chosenLane: number
  betterLane: number
  armyBefore: ArmyCount
  chosenResult: ArmyCount
  counterfactualResult: ArmyCount
  /** Perda absoluta em soldados (counterfactualResult - chosenResult) */
  loss: ArmyCount
  /** Perda relativa (loss / counterfactualResult) */
  lossRatio: number
  intuitionTrapPt: string
  luzGuiaPt: string
  codexSlug: string
}

export interface RedemptionChoice {
  id: string
  label: string
  value: number
  isCorrect: boolean
  diagnosticPt: string
}

export interface RedemptionChallenge {
  tokenId: string
  trapId: TrapId
  trapName: string
  conceptId: ConceptId
  questionPt: string
  luzGuiaPt: string
  stepByStepPt: string
  guidedWalkthroughPt: string
  choices: RedemptionChoice[]
  codexSlug: string
}

export interface RedemptionToken {
  id: string
  runId: string
  trapId: TrapId
  trapName: string
  loss: ArmyCount
  used: boolean
  scaffoldLevel: 1 | 2 | 3
  challenge: RedemptionChallenge
}

export interface UnitTierSpec {
  tierIndex: number
  denominationLabel: string
  value: ArmyCount
  unitName: string
  etymologyPt: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  radiusPx: number
  heightPx: number
}

export interface DecomposedTier {
  tier: UnitTierSpec
  count: number
}

export type NotationMode = 'compact' | 'scientific'

export type RunPhase =
  | 'BRIEFING'
  | 'RUNNING'
  | 'CALM_WAIT'
  | 'TRAP_CINEMATIC'
  | 'REDEMPTION_CHALLENGE'
  | 'PAUSED'
  | 'BATTLE'
  | 'VICTORY'
  | 'DEFEAT'
  | 'REDEMPTION_CONTRACT'
  | 'REMATCH_OFFER'

export interface FloatingFeedbackItem {
  id: string
  text: string
  subText?: string
  tone: 'optimal' | 'neutral' | 'twins' | 'trap' | 'reinforcement' | 'merge'
  createdAtMs: number
}

export interface CrowdSpriteNode {
  id: string
  tierIndex: number
  denominationLabel: string
  offsetX: number
  offsetZ: number
  scale: number
}

export interface MergeAnimationEvent {
  id: string
  fromTierLabel: string
  toTierLabel: string
  formulaLabel: string
  startedAtMs: number
  direction?: 'merge' | 'split'
}

export interface RunSnapshot {
  runId: string
  phase: RunPhase
  elapsedMs: number
  progress: number
  currentArmy: ArmyCount
  remainderBankInRun: number
  currentLane: number
  laneX: number
  laneCount: 2 | 3
  activeSegmentIndex: number
  segments: readonly LaneSegment[]
  resolvedSegments: Readonly<Record<string, { chosenLane: number; resultArmy: ArmyCount }>>
  crowdNodes: readonly CrowdSpriteNode[]
  recentFeedback: readonly FloatingFeedbackItem[]
  activeMergeEvent: MergeAnimationEvent | null
  inspectedSegmentId: string | null
  enemy: EnemySpec
  /** Combo de Cálculo V3 (§2.2): escolhas ótimas seguidas (0, 1, 2, 3+) */
  calcComboStreak?: number
  /** Multiplicador de pontos/bônus do Combo de Cálculo (1, 1.5, 2, 3) */
  calcComboMultiplier?: number
  /** Fichas Douradas coletadas em Portões Dourados sem pausar (§2.2) */
  goldenTokensCollected?: number
  /** Moedas ganhas ao abater ondas de inimigos na ponte (§2.3) */
  bridgeCoinsEarned?: number
  /** Quantidade de inimigos abatidos durante a marcha na ponte (§2.3) */
  bridgeKills?: number
  /** Timestamp do último piscar vermelho diegético de pegadinha (§2.1) */
  lastTrapFlashAtMs?: number | null
}

export interface BattleResolution {
  outcome: 'VICTORY' | 'DEFEAT'
  playerArmy: ArmyCount
  enemyForce: ArmyCount
  survivors: ArmyCount
  deficit: ArmyCount
  durationMs: number
}

export interface RedemptionContractOffer {
  canGuaranteeVictory: boolean
  deficit: ArmyCount
  totalRecoverableLoss: ArmyCount
  safetyMargin: ArmyCount
  grantOnSuccess: ArmyCount
  tokensToRedeem: RedemptionToken[]
}

export type CitadelBuildingId =
  | 'quartel'
  | 'observatorio'
  | 'academia'
  | 'mina_resto'
  | 'forja'

export interface CitadelBuildingSpec {
  id: CitadelBuildingId
  name: string
  icon: string
  descriptionPt: string
  pedagogicalConceptPt: string
  baseCost: ArmyCount
  costGrowthFactor: number
  maxLevel: 5
  levelEffects: readonly number[]
  levelLabels: readonly string[]
}

export type RegionType = 'vila' | 'forte' | 'santuario' | 'capital_chefe'

export interface RegionSpec {
  id: string
  name: string
  biomeId: BiomeId
  type: RegionType
  depth: number
  garrison: ArmyCount
  bossHp: ArmyCount
  bossName: string
  bossTitle: string
  neighbors: readonly string[]
  svgPath: string
  labelAnchor: { x: number; y: number }
  rewardTroops: ArmyCount
  tributePerRun: ArmyCount
  unlocksConcept?: ConceptId
}

export interface ConceptMasteryRecord {
  conceptId: ConceptId
  attempts: number
  optimalChoices: number
  trapHits: number
  redemptionsCompleted: number
  rollingAccuracy: number
}

export interface TrapAlbumRecord {
  trapId: TrapId
  encounteredCount: number
  tamedCount: number
  firstTamedAt?: string
}

export interface LogicBattleSettings {
  notationMode: NotationMode
  calmMode: boolean
  simpleTapMode?: boolean
  soundEnabled: boolean
  reducedMotion: boolean
  fpsCap: 30 | 60
}

export interface SaveV1 {
  version: 1
  updatedAt: string
  reserveTroops: ArmyCount
  remainderVault: number
  wisdomStars: number
  conqueredRegionIds: string[]
  selectedRegionId: string
  citadelLevels: Record<CitadelBuildingId, number>
  album: Record<TrapId, TrapAlbumRecord>
  twinsDiscovered: TwinId[]
  mastery: Record<ConceptId, ConceptMasteryRecord>
  trapAlertSeenCount: Record<TrapId, number>
  mergeTutorialSeenCount: number
  coachMarksSeen?: boolean
  settings: LogicBattleSettings
  stats: {
    runsPlayed: number
    runsWon: number
    surgicalPrecisions: number
    trapsTamedTotal: number
    highestArmyReached: ArmyCount
  }
}
