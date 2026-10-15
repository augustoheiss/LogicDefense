export type BuffType = 'amor' | 'odio' | 'cadeira'
export type DifficultyMode = 'normal' | 'hardcore' | 'godmode'
export type MathOp = '+' | '-' | 'x' | '÷'
export type EnemyArchetype = 'standard' | 'runner' | 'tank' | 'splitter' | 'boss'

export type MathLensId =
  | 'ataque_direto'
  | 'lei_menor_esforco'
  | 'hack_japones'
  | 'diferenca_quadrados'
  | 'truque_relogio_5'
  | 'base_universo_248'
  | 'infinito_9'
  | 'corta_no_meio'
  | 'numero_fenix_7'
  | 'decomposicao_tatica'

export interface StructuredTipStep {
  badge: string
  title: string
  content: string
}

export type GameState = 'START' | 'SPIN' | 'MATH' | 'BUILD' | 'COMBAT' | 'CINEMATIC'

export interface Point {
  x: number
  y: number
}

export interface MathProblem {
  n1: number
  n2: number
  op: MathOp
  answer: number
  // ── Genesis 2.0 Pedagogical Metadata (optional for backward compat) ──
  lensId?: MathLensId
  lensTitle?: string
  shortHint?: string
  trapExplanations?: Record<number, string>
  structuredSteps?: StructuredTipStep[]
}

export interface ActiveBuffModifiers {
  buff: BuffType
  mathTimeSeconds: number
  wrongPenaltyMultiplier: number
  correctBaseMultiplier: number
  fastAnswerBonusMultiplier: number
  towerDamageMultiplier: number
  towerRangeMultiplier: number
  upgradeCostDiscount: number
  heroMagnetMultiplier: number
  heroCoinBonusMultiplier: number
  bankInterestRate: number
  harmonyLinkSpeedBoost: number
  centerSlowRadius: number
  centerSlowFactor: number
  showPreHint: boolean
  optionCount: 3 | 4
}

export interface GameStats {
  totalGold: number
  livesGained: number
  livesLost: number
  totalMath: number
  errors: Record<string, number>
}

export interface TowerType {
  name: string
  symbol: MathOp
  shape: 'triangle' | 'circle' | 'square' | 'hexagon'
  cost: number
  range: number
  damage: number
  rate: number
  color: string
  slow?: boolean
  splash?: boolean
}

export interface UIState {
  gold: number
  lives: number
  wave: number
  goldMultiplier: number
  totalCorrect: number
  totalWrong: number
  gameState: GameState
  currentBuff: BuffType
  stats: GameStats
  selectedTowerIdx: number
  selectedExistingTower: TowerInstance | null
  aiMode: boolean
  gameSpeed: number
  isAudioMuted: boolean
  uiHidden: boolean
  stressMode: boolean
}

export interface TowerInstance {
  x: number
  y: number
  type: TowerType
  cooldown: number
  level: number
  upgradeCost: number
  totalCost: number
  range: number
  currentRate: number
  upgrade(): void
  getDamage(): number
  update(): void
  draw(ctx: CanvasRenderingContext2D): void
}

export interface EnemyInstance {
  x: number
  y: number
  hp: number
  maxHp: number
  radius: number
  frozen: number
  active: boolean
  isGolden: boolean
  archetype?: EnemyArchetype
  update(): void
  draw(ctx: CanvasRenderingContext2D): void
}

export interface BulletInstance {
  x: number
  y: number
  active: boolean
  update(): void
  draw(ctx: CanvasRenderingContext2D): void
}

export interface ParticleInstance {
  x: number
  y: number
  life: number
  update(): void
  draw(ctx: CanvasRenderingContext2D): void
}


