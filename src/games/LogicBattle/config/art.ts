// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/config/art.ts — Chaves de Direção de Arte & Mascote
// ──────────────────────────────────────────────────────────────────────────────
import { BiomeId } from '../types'

export interface MascotPoseSpec {
  poseId: 'alert' | 'celebrate' | 'thinking' | 'salute'
  titlePt: string
  accentColor: string
  monocleAngleDeg: number
}

export const CAPTAIN_VIRGULA_POSES: Record<MascotPoseSpec['poseId'], MascotPoseSpec> = {
  alert: {
    poseId: 'alert',
    titlePt: 'Capitã Vírgula · Alerta de Pegadinha!',
    accentColor: '#f59e0b',
    monocleAngleDeg: -14,
  },
  celebrate: {
    poseId: 'celebrate',
    titlePt: 'Capitã Vírgula · Pegadinha Domada!',
    accentColor: '#10b981',
    monocleAngleDeg: 6,
  },
  thinking: {
    poseId: 'thinking',
    titlePt: 'Capitã Vírgula · Luz Guia Socrática',
    accentColor: '#38bdf8',
    monocleAngleDeg: 0,
  },
  salute: {
    poseId: 'salute',
    titlePt: 'Capitã Vírgula · Comandante da Legião',
    accentColor: '#a855f7',
    monocleAngleDeg: 10,
  },
}

export const BIOME_ART_THEMES: Record<
  BiomeId,
  {
    emblem: string
    ambientLabel: string
    parapetColor: string
    pillarColor: string
  }
> = {
  planicie_pedra: {
    emblem: '🌉',
    ambientLabel: 'Ponte Real de Cantaria',
    parapetColor: '#334155',
    pillarColor: '#475569',
  },
  fiorde_gelado: {
    emblem: '❄️',
    ambientLabel: 'Passarela de Cristal Boreal',
    parapetColor: '#1e3a8a',
    pillarColor: '#38bdf8',
  },
  deserto_decimais: {
    emblem: '🏜️',
    ambientLabel: 'Viaduto de Arenito Dourado',
    parapetColor: '#78350f',
    pillarColor: '#d97706',
  },
  vulcao_negativos: {
    emblem: '🌋',
    ambientLabel: 'Ponte de Obsidiana Rubra',
    parapetColor: '#4c0519',
    pillarColor: '#e11d48',
  },
  torre_potencias: {
    emblem: '⚡',
    ambientLabel: 'Passarela Astral das Ordens',
    parapetColor: '#312e81',
    pillarColor: '#eab308',
  },
}
