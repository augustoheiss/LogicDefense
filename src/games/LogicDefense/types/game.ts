export type BuffType = 'amor' | 'odio' | 'cadeira'

export type GameState = 'START' | 'SPIN' | 'MATH' | 'BUILD' | 'COMBAT' | 'CINEMATIC'

export interface Point {
  x: number
  y: number
}

export interface MathProblem {
  n1: number
  n2: number
  op: '+' | '-' | 'x' | '÷'
  answer: number
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
  symbol: string
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

