import { Gate } from '../types'

export type Olhar = 'primeira' | 'terceira' | 'imperio'
export type Postura = 'ordens' | 'automatico'
export type PecaId = 'nucleo' | 'torre' | 'portao' | 'quartel' | 'britador'
export type Papel = 'horda' | 'tropa' | 'sitiante' | 'isca' | 'dragao'

export interface OrdemMover {
  tipo: 'mover'
  x: number
  z: number
}

export interface OrdemAtacar {
  tipo: 'atacar'
  alvoId: number
}

export type Ordem = OrdemMover | OrdemAtacar

export const PARTIDA = {
  radius: 56,
  body: 0.35,
  eyeY: 1.6,
  pitchMin: -1.45,
  pitchMax: 1.45,
  pitchTetoTiro: 1,
  dtMax: 0.05,
  dtBudgetMax: 3,
  heroSpeed: 8,
  allyCap: 12,
  enemyCap: 12,
  creditoInicial: 4,
  shootRange: 14,
  shootDot: 0.5,
  shootCooldown: 0.45,
  hitRadius: 0.9,
  hitDamage: 3,
  acquireHorda: 16,
  aggroZ: 22,
  acquireAliado: 22,
  allySpeed: 8,
  enemySpeed: 4.2,
  melee: 1.15,
  nucleoContato: 1.7,
  danoOrdem: 10,
  danoAutomatico: 4,
  danoSitio: 3,
  golpeCooldown: 0.5,
  nucleoHp: 100,
  obraMeio: 1.15,
  torreAlcance: 12,
  torreDano: 6,
  torreCooldown: 0.8,
  ondaPeriodo: 20,
  pedraX: -8,
  pedraZ: 10,
  pedraKg: 35,
  britadorDivisor: 10,
  altarPasso: 4,
  altarRaio: 1.15,
  arch: { minX: -1.2, maxX: 1.2, minZ: 18, maxZ: 22 },
  asphaltEndZ: 40,
  celula: 1,
  espiral: 5,
  recalcularSeg: 0.4,
  maxVisitas: 5000,
  caminho: 'grade' as 'grade' | 'reto',
  levaDistancia: 16,
  levaPrimeira: 4,
  levaSeguinte: 1,
  levaAlvo: 'nucleo' as 'nucleo' | 'perto',
} as const

export const GRAU_PARTIDA: Record<1 | 2 | 3 | 4, { wipe: number; bonus: number; credito: number }> = {
  1: { wipe: 0.35, bonus: 4, credito: 1 },
  2: { wipe: 0.6, bonus: 6, credito: 1 },
  3: { wipe: 0.85, bonus: 8, credito: 2 },
  4: { wipe: 1, bonus: 12, credito: 2 },
}

export const PLUS_TEN: Gate = {
  id: 'arco-mais-10',
  op: '+',
  operand: { value: 10, num: 10, den: 1 },
  label: '+10',
  readingTimeMs: 0,
}

export const OBSTACULOS: readonly { x: number; z: number; hx: number; hz: number }[] = [
  { x: -1.65, z: 12, hx: 1.15, hz: 0.7 },
  { x: 1.65, z: 26, hx: 1.15, hz: 0.7 },
  { x: -1.55, z: 33, hx: 1.05, hz: 0.65 },
]
