/**
 * Logic Tetris (Genesis Edition) — Zero-Asset Pentatonic & Lydian Web Audio Synthesizer.
 *
 * Incorporates Auditor Improvements (`Melhoria 06-A` to `06-D`):
 * - `Melhoria 06-A`: Tuned to C Major Pentatonic / Lydian (`C4..C6`) so every action harmonizes.
 *   `playLineClear(clearedCount, combo)` shifts upward in harmonic degree with `combo`, and
 *   `playMorphSuccess()` / `playSealHoleSuccess()` play crystalline harp/marimba timbres.
 * - `Melhoria 06-B`: Zero dissonance on wrong answers! `playElasticBounce()` emits a warm kalimba
 *   interval (`G4 -> E4`) that feels encouraging, and `playPhoenixSecondWind()` plays an ascending
 *   6-note Lydian fanfare inspired by the 142857 Phoenix cycle.
 * - `Melhoria 06-C`: Tactile micro-sounds (`playMove`, `playRotate`, `playSoftDrop`, `playHardDrop`,
 *   `playHold`, `playOpenIntervention`) with click-free ADSR envelopes, per-channel cooldown (`>= 35ms`),
 *   and global voice limiting (`MAX_CONCURRENT_VOICES = 14`).
 * - `Melhoria 06-D`: Full `try / catch` circuit breaker for Autoplay / Headless Playwright environments
 *   and `localStorage` persistence under `logic_tetris_v1_muted`.
 */

import { DopamineTier, SubGameStyle } from '../types'

export const MUTE_STORAGE_KEY = 'logic_tetris_v1_muted'
const MIN_CHANNEL_COOLDOWN_MS = 35
export const MAX_CONCURRENT_VOICES = 24

// C Major Pentatonic + Lydian #4 (F#) frequencies in Hz — Expanded C3 (130.81 Hz) to G6 (1567.98 Hz)
export const PENTATONIC_LYDIAN_SCALE_HZ: readonly number[] = [
  130.81, // C3  (Index 0  - Deep Sub-Bass Root)
  146.83, // D3  (Index 1)
  164.81, // E3  (Index 2)
  185.00, // F#3 (Index 3  - Lydian Low Bright)
  196.00, // G3  (Index 4  - Sub-Bass Fifth)
  220.00, // A3  (Index 5)
  246.94, // B3  (Index 6)
  261.63, // C4  (Index 7  - Middle C)
  293.66, // D4  (Index 8)
  329.63, // E4  (Index 9)
  369.99, // F#4 (Index 10 - Lydian bright degree)
  392.00, // G4  (Index 11)
  440.00, // A4  (Index 12)
  493.88, // B4  (Index 13)
  523.25, // C5  (Index 14)
  587.33, // D5  (Index 15)
  659.25, // E5  (Index 16)
  739.99, // F#5 (Index 17 - Lydian bright degree)
  783.99, // G5  (Index 18)
  880.00, // A5  (Index 19)
  987.77, // B5  (Index 20)
  1046.50, // C6 (Index 21)
  1174.66, // D6 (Index 22)
  1318.51, // E6 (Index 23)
  1479.98, // F#6 (Index 24 - High Crystal Lydian #4)
  1567.98, // G6 (Index 25 - Genesis Ecstasy Apex)
]

type SoundChannel =
  | 'move'
  | 'rotate'
  | 'softDrop'
  | 'hardDrop'
  | 'hold'
  | 'modal'
  | 'morph'
  | 'seal'
  | 'clear'
  | 'dopamine'
  | 'styleShift'
  | 'bounce'
  | 'phoenix'
  | 'system'

export interface ToneOptions {
  freq: number
  type?: OscillatorType
  durationSec: number
  delaySec?: number
  gain?: number
  slideToFreq?: number
}

export interface SequenceDopamineSignature {
  streakCount: number
  magnitude: number
  style: SubGameStyle
  tier: DopamineTier
  primaryFrequenciesHz: number[]
  notes: ToneOptions[]
}

function loadInitialMutedState(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function persistMutedState(muted: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false')
  } catch {
    // Graceful no-op in restricted environments
  }
}

export interface DopamineStageDescriptor {
  streakCount: number
  tier: DopamineTier
  badgePt: string
  harmonicDescriptionPt: string
}

export function getSequenceDopamineTier(streakCount: number): DopamineTier {
  if (streakCount <= 0) return 'NONE'
  if (streakCount <= 3) return 'WARMUP_1_3'
  if (streakCount <= 6) return 'HARMONIC_4_6'
  if (streakCount <= 9) return 'LYDIAN_7_9'
  if (streakCount <= 11) return 'SUPERNOVA_10_11'
  return 'GENESIS_ECSTASY_12_PLUS'
}

export function getDopamineStageDescriptor(streakCount: number): DopamineStageDescriptor {
  const tier = getSequenceDopamineTier(streakCount)
  if (tier === 'NONE') {
    return {
      streakCount: 0,
      tier,
      badgePt: '🌱 Pronto para a 1ª Sequência',
      harmonicDescriptionPt: 'Aguardando a primeira limpeza Base-10 ou cascata.',
    }
  }
  if (tier === 'WARMUP_1_3') {
    return {
      streakCount,
      tier,
      badgePt: `✨ ${streakCount}× Aquecimento Pentatônico`,
      harmonicDescriptionPt: 'Tríade pentatônica cristalina de despertar harmônico.',
    }
  }
  if (tier === 'HARMONIC_4_6') {
    return {
      streakCount,
      tier,
      badgePt: `🔥 ${streakCount}× Pulso Harmônico Brilhante`,
      harmonicDescriptionPt: 'Arpejo ascendente em oitava dupla com pulso de baixo.',
    }
  }
  if (tier === 'LYDIAN_7_9') {
    return {
      streakCount,
      tier,
      badgePt: `⚡ ${streakCount}× Ressonância Lídia (#4)`,
      harmonicDescriptionPt: 'Fanfarra Lídia luminosa com quarta aumentada celestial (F#).',
    }
  }
  if (tier === 'SUPERNOVA_10_11') {
    return {
      streakCount,
      tier,
      badgePt: `🌟 ${streakCount}× Supernova Harmônica!`,
      harmonicDescriptionPt: 'Cascata polifônica de 5 vozes em registro cristalino.',
    }
  }
  return {
    streakCount,
    tier,
    badgePt: `👑 ${streakCount}× SEQUÊNCIA LENDÁRIA! DOPAMINA MÁXIMA!`,
    harmonicDescriptionPt:
      'Fanfarra Gênesis de 6 vozes + Sub-Bass + Sinos de Cristal (C6–G6)!',
  }
}

class LogicTetrisSoundEngine {
  private ctx: AudioContext | null = null
  private muted: boolean = loadInitialMutedState()
  private activeVoices: number = 0
  private activeVoiceNodes: Array<{ osc: OscillatorNode; gainNode: GainNode }> = []
  private lastSequenceSignature: SequenceDopamineSignature | null = null
  private lastChannelTriggerMs: Record<SoundChannel, number> = {
    move: 0,
    rotate: 0,
    softDrop: 0,
    hardDrop: 0,
    hold: 0,
    modal: 0,
    morph: 0,
    seal: 0,
    clear: 0,
    dopamine: 0,
    styleShift: 0,
    bounce: 0,
    phoenix: 0,
    system: 0,
  }

  public isMuted(): boolean {
    return this.muted
  }

  public setMuted(nextMuted: boolean): boolean {
    this.muted = nextMuted
    persistMutedState(nextMuted)
    return this.muted
  }

  public toggleMuted(): boolean {
    return this.setMuted(!this.muted)
  }

  public getSequenceDopamineTier(streakCount: number): DopamineTier {
    return getSequenceDopamineTier(streakCount)
  }

  public getDopamineStageDescriptor(streakCount: number): DopamineStageDescriptor {
    return getDopamineStageDescriptor(streakCount)
  }

  public getLastSequenceSignature(): SequenceDopamineSignature | null {
    return this.lastSequenceSignature
  }

  private getAudioContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioCtx) return null
        this.ctx = new AudioCtx()
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {})
      }
      return this.ctx
    } catch {
      return null
    }
  }

  private canTriggerChannel(
    channel: SoundChannel,
    minGapMs: number = MIN_CHANNEL_COOLDOWN_MS
  ): boolean {
    if (this.muted) return false
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const last = this.lastChannelTriggerMs[channel] ?? 0
    if (now - last < minGapMs) {
      return false
    }
    this.lastChannelTriggerMs[channel] = now
    return true
  }

  private scheduleNote(options: ToneOptions): void {
    if (this.muted) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    try {
      // RT-11 Graceful Voice Stealing: if at capacity (24 voices), steal the oldest active voice cleanly
      while (this.activeVoiceNodes.length >= MAX_CONCURRENT_VOICES) {
        const oldest = this.activeVoiceNodes.shift()
        if (oldest) {
          this.activeVoices = Math.max(0, this.activeVoices - 1)
          try {
            oldest.osc.stop()
            oldest.osc.disconnect()
            oldest.gainNode.disconnect()
          } catch {
            // Ignore already-stopped nodes
          }
        }
      }

      const {
        freq,
        type = 'sine',
        durationSec,
        delaySec = 0,
        gain = 0.08,
        slideToFreq,
      } = options

      const safeGain = Math.min(0.085, Math.max(0.005, gain))
      const startTime = ctx.currentTime + Math.max(0, delaySec)
      const attackTime = 0.006
      const endTime = startTime + Math.max(0.025, durationSec)

      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()

      osc.type = type
      osc.frequency.setValueAtTime(freq, startTime)
      if (slideToFreq && slideToFreq > 0) {
        osc.frequency.exponentialRampToValueAtTime(slideToFreq, endTime)
      }

      // Click-free ADSR envelope
      gainNode.gain.setValueAtTime(0.0001, startTime)
      gainNode.gain.linearRampToValueAtTime(safeGain, startTime + attackTime)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime)

      osc.connect(gainNode)
      gainNode.connect(ctx.destination)

      const record = { osc, gainNode }
      this.activeVoiceNodes.push(record)
      this.activeVoices = this.activeVoiceNodes.length

      osc.onended = () => {
        const idx = this.activeVoiceNodes.indexOf(record)
        if (idx !== -1) {
          this.activeVoiceNodes.splice(idx, 1)
        }
        this.activeVoices = this.activeVoiceNodes.length
        try {
          osc.disconnect()
          gainNode.disconnect()
        } catch {
          // Ignore disconnect errors
        }
      }

      osc.start(startTime)
      osc.stop(endTime + 0.005)
    } catch {
      // Safe fallback for Headless or restricted AudioContext
    }
  }

  /** Subtle tactile tick when moving horizontally (`<-` / `->`) */
  public playMove(): void {
    if (!this.canTriggerChannel('move', 40)) return
    this.scheduleNote({
      freq: 261.63, // C4
      type: 'sine',
      durationSec: 0.04,
      gain: 0.045,
      slideToFreq: 293.66, // D4
    })
  }

  /** Crisp harmonic chime when rotating a piece (`CW` / `CCW`) */
  public playRotate(): void {
    if (!this.canTriggerChannel('rotate', 45)) return
    this.scheduleNote({
      freq: 392.0, // G4
      type: 'triangle',
      durationSec: 0.065,
      gain: 0.06,
      slideToFreq: 523.25, // C5
    })
  }

  /** Soft gentle pulse during manual soft drop */
  public playSoftDrop(): void {
    if (!this.canTriggerChannel('softDrop', 55)) return
    this.scheduleNote({
      freq: 220.0, // A3
      type: 'sine',
      durationSec: 0.035,
      gain: 0.035,
    })
  }

  /** Grounded resonant thud + pentatonic fifth on Hard Drop */
  public playHardDrop(): void {
    if (!this.canTriggerChannel('hardDrop', 50)) return
    this.scheduleNote({
      freq: 196.0, // G3
      type: 'triangle',
      durationSec: 0.09,
      gain: 0.09,
      slideToFreq: 130.81, // C3
    })
    this.scheduleNote({
      freq: 523.25, // C5
      type: 'sine',
      durationSec: 0.07,
      delaySec: 0.015,
      gain: 0.05,
    })
  }

  /** Gentle harmonic swap sound when holding a piece (`[C]`) */
  public playHold(): void {
    if (!this.canTriggerChannel('hold', 60)) return
    this.scheduleNote({
      freq: 329.63, // E4
      type: 'sine',
      durationSec: 0.06,
      gain: 0.055,
    })
    this.scheduleNote({
      freq: 440.0, // A4
      type: 'triangle',
      durationSec: 0.08,
      delaySec: 0.045,
      gain: 0.055,
    })
  }

  /** Shimmering Bullet-Time activation chord when opening `[M]` or `[B]` modal */
  public playOpenIntervention(): void {
    if (!this.canTriggerChannel('modal', 60)) return
    const notes = [329.63, 392.0, 493.88] // E4, G4, B4
    notes.forEach((freq, idx) => {
      this.scheduleNote({
        freq,
        type: 'sine',
        durationSec: 0.14,
        delaySec: idx * 0.035,
        gain: 0.05,
      })
    })
  }

  /** Soft descending two-note release when cancelling a modal with `[Esc]` */
  public playCancelIntervention(): void {
    if (!this.canTriggerChannel('modal', 50)) return
    this.scheduleNote({
      freq: 392.0, // G4
      type: 'sine',
      durationSec: 0.07,
      gain: 0.045,
    })
    this.scheduleNote({
      freq: 329.63, // E4
      type: 'sine',
      durationSec: 0.09,
      delaySec: 0.04,
      gain: 0.04,
    })
  }

  /**
   * Warm, zero-dissonance wooden kalimba interval (`G4 -> E4`) on a wrong distractor choice
   * (`Melhoria 06-B`: never punitive or harsh, encouraging the inline second chance!).
   */
  public playElasticBounce(): void {
    if (!this.canTriggerChannel('bounce', 60)) return
    this.scheduleNote({
      freq: 392.0, // G4
      type: 'triangle',
      durationSec: 0.11,
      gain: 0.065,
    })
    this.scheduleNote({
      freq: 329.63, // E4 (warm major third below G4)
      type: 'sine',
      durationSec: 0.16,
      delaySec: 0.065,
      gain: 0.06,
    })
  }

  /**
   * Crystalline Geometric Alchemy arpeggio when morphing a piece (`MATH_MORPH` — `Melhoria 06-A`).
   */
  public playMorphSuccess(): void {
    if (!this.canTriggerChannel('morph', 60)) return
    // C5 -> E5 -> G5 -> B5 (Major 7th crystal arpeggio)
    const chord = [523.25, 659.25, 783.99, 987.77]
    chord.forEach((freq, idx) => {
      this.scheduleNote({
        freq,
        type: idx % 2 === 0 ? 'triangle' : 'sine',
        durationSec: 0.18,
        delaySec: idx * 0.045,
        gain: 0.075,
      })
    })
  }

  /**
   * Golden Balance Harp cascade when sealing buried cavities (`MATH_FILL_HOLE` — `Melhoria 06-A`).
   */
  public playSealHoleSuccess(): void {
    if (!this.canTriggerChannel('seal', 60)) return
    // Lydian Golden Cascade: C5 -> D5 -> F#5 -> G5 -> C6
    const goldenNotes = [523.25, 587.33, 739.99, 783.99, 1046.5]
    goldenNotes.forEach((freq, idx) => {
      this.scheduleNote({
        freq,
        type: 'triangle',
        durationSec: 0.22,
        delaySec: idx * 0.05,
        gain: 0.08,
      })
    })
  }

  /**
   * Deterministic 16-Stage Sequence Dopamine Synthesizer Blueprint (`Phase 01` — `playSequenceDopamine`).
   * Maps any `streakCount` (`1..16+`) into a progressively richer harmonic signature:
   * - `1..3` (`WARMUP_1_3`): Ascending crystalline pentatonic arpeggio rising 1 scale degree per streak.
   * - `4..6` (`HARMONIC_4_6`): Adds warm sub-bass (`C3/D3/G3` triangle) + chorus detune (`+3 Hz`) shimmer.
   * - `7..9` (`LYDIAN_7_9`): 5-note C Lydian arpeggio highlighting `#4` (`F#5`) + high crystal bell (`E6..G6`).
   * - `10..11` (`SUPERNOVA_10_11`): Rapid 6-note golden harp cascade with double-octave resolution.
   * - `12+` (`GENESIS_ECSTASY_12_PLUS`): Triumphant 8-note polyphonic fanfare + sustained golden chord,
   *   escalating in harmonic brilliance for `12×, 13×, 14×, 15×, 16×+` without any ceiling!
   */
  public getSequenceDopamineSignature(
    streakCount: number,
    magnitude: number = 1,
    style: SubGameStyle = 'TETRIS_CLASSIC'
  ): SequenceDopamineSignature {
    const effectiveStreak = Math.max(1, Math.floor(streakCount))
    const clampedMag = Math.max(1, Math.min(4, Math.floor(magnitude)))
    const tier = getSequenceDopamineTier(effectiveStreak)
    const notes: ToneOptions[] = []
    const primaryFrequenciesHz: number[] = []

    const stylePitchOffsetHz =
      style === 'FRUIT_MATCH' ? 2.5 : style === 'TACTILE_GRID' ? -1.5 : 0

    if (tier === 'WARMUP_1_3') {
      // Stage 1..3: C4 (idx 7), D4 (idx 8), E4 (idx 9) ascending arpeggio
      const baseIdx = 7 + (effectiveStreak - 1)
      const noteCount = clampedMag >= 4 ? 5 : 2 + clampedMag
      for (let i = 0; i < noteCount; i++) {
        const scaleIdx = Math.min(PENTATONIC_LYDIAN_SCALE_HZ.length - 1, baseIdx + i * 2)
        const freq = Number((PENTATONIC_LYDIAN_SCALE_HZ[scaleIdx] + stylePitchOffsetHz).toFixed(2))
        primaryFrequenciesHz.push(freq)
        notes.push({
          freq,
          type: i === noteCount - 1 ? 'triangle' : 'sine',
          durationSec: 0.18 + clampedMag * 0.025,
          delaySec: i * 0.045,
          gain: 0.075,
        })
      }
    } else if (tier === 'HARMONIC_4_6') {
      // Stage 4..6: Sub-bass foundation + 4-note ascending arpeggio + +3Hz chorus shimmer
      const bassIndices = [0, 1, 4] // C3 (130.81), D3 (146.83), G3 (196.00)
      const bassFreq = PENTATONIC_LYDIAN_SCALE_HZ[bassIndices[(effectiveStreak - 4) % 3]]
      primaryFrequenciesHz.push(bassFreq)
      notes.push({
        freq: bassFreq,
        type: 'triangle',
        durationSec: 0.32,
        delaySec: 0,
        gain: 0.08,
      })

      const baseIdx = 10 + (effectiveStreak - 4) // F#4, G4, A4
      const arpCount = 4
      for (let i = 0; i < arpCount; i++) {
        const scaleIdx = Math.min(PENTATONIC_LYDIAN_SCALE_HZ.length - 1, baseIdx + i * 2)
        const freq = Number((PENTATONIC_LYDIAN_SCALE_HZ[scaleIdx] + stylePitchOffsetHz).toFixed(2))
        primaryFrequenciesHz.push(freq)
        notes.push({
          freq,
          type: i % 2 === 0 ? 'triangle' : 'sine',
          durationSec: 0.22,
          delaySec: i * 0.044,
          gain: 0.075,
        })
        if (i >= arpCount - 2) {
          // Twin chorus detune (+3 Hz)
          notes.push({
            freq: Number((freq + 3.0).toFixed(2)),
            type: 'sine',
            durationSec: 0.24,
            delaySec: i * 0.044 + 0.008,
            gain: 0.045,
          })
        }
      }
    } else if (tier === 'LYDIAN_7_9') {
      // Stage 7..9: 5-note C Lydian arpeggio (with F#5 bright degree) + high crystal bell
      const bassFreq = effectiveStreak === 7 ? 164.81 : effectiveStreak === 8 ? 185.0 : 196.0
      primaryFrequenciesHz.push(bassFreq)
      notes.push({
        freq: bassFreq,
        type: 'triangle',
        durationSec: 0.36,
        delaySec: 0,
        gain: 0.08,
      })

      const baseIdx = 13 + (effectiveStreak - 7) // B4, C5, D5
      for (let i = 0; i < 5; i++) {
        const scaleIdx = Math.min(PENTATONIC_LYDIAN_SCALE_HZ.length - 1, baseIdx + i)
        const freq = Number((PENTATONIC_LYDIAN_SCALE_HZ[scaleIdx] + stylePitchOffsetHz).toFixed(2))
        primaryFrequenciesHz.push(freq)
        notes.push({
          freq,
          type: i === 4 ? 'triangle' : 'sine',
          durationSec: 0.24,
          delaySec: i * 0.038,
          gain: 0.078,
        })
      }

      // High crystal bell (E6 / F#6 / G6)
      const bellIdx = Math.min(25, 23 + (effectiveStreak - 7))
      const bellFreq = PENTATONIC_LYDIAN_SCALE_HZ[bellIdx]
      primaryFrequenciesHz.push(bellFreq)
      notes.push({
        freq: bellFreq,
        type: 'sine',
        durationSec: 0.34,
        delaySec: 5 * 0.038,
        gain: 0.07,
      })
    } else if (tier === 'SUPERNOVA_10_11') {
      // Stage 10..11: Rapid 6-note golden harp cascade + double-octave resolution
      const isEleven = effectiveStreak >= 11
      const lowRoot = isEleven ? 293.66 : 261.63 // D4 or C4
      const highOctave = isEleven ? 1174.66 : 1046.5 // D6 or C6
      primaryFrequenciesHz.push(lowRoot)
      notes.push({
        freq: lowRoot,
        type: 'triangle',
        durationSec: 0.38,
        delaySec: 0,
        gain: 0.082,
      })

      const baseIdx = isEleven ? 15 : 14 // D5 or C5
      for (let i = 0; i < 6; i++) {
        const scaleIdx = Math.min(PENTATONIC_LYDIAN_SCALE_HZ.length - 1, baseIdx + i)
        const freq = Number((PENTATONIC_LYDIAN_SCALE_HZ[scaleIdx] + stylePitchOffsetHz).toFixed(2))
        primaryFrequenciesHz.push(freq)
        notes.push({
          freq,
          type: i % 2 === 0 ? 'triangle' : 'sine',
          durationSec: 0.25,
          delaySec: i * 0.034,
          gain: 0.08,
        })
      }

      primaryFrequenciesHz.push(highOctave)
      notes.push({
        freq: highOctave,
        type: 'triangle',
        durationSec: 0.4,
        delaySec: 6 * 0.034,
        gain: 0.084,
      })
    } else {
      // Stage 12+ (`GENESIS_ECSTASY_12_PLUS` — O "Sonzim" Lendário de 12+ Sequências!)
      // 8-note triumphant polyphonic fanfare + golden sustain chord, escalating with each extra streak (12, 13, 14, 15, 16+)
      const extraAbove12 = Math.min(12, Math.max(0, effectiveStreak - 12))
      const brillianceMultiplier = Number((1 + extraAbove12 * 0.016).toFixed(4))

      // Warm harmonic sub-bass fifth (C3 + G3)
      const bassRoot = Number((130.81 * brillianceMultiplier).toFixed(2))
      const bassFifth = Number((196.0 * brillianceMultiplier).toFixed(2))
      primaryFrequenciesHz.push(bassRoot, bassFifth)
      notes.push(
        {
          freq: bassRoot,
          type: 'triangle',
          durationSec: 0.48,
          delaySec: 0,
          gain: 0.082,
        },
        {
          freq: bassFifth,
          type: 'sine',
          durationSec: 0.46,
          delaySec: 0.02,
          gain: 0.072,
        }
      )

      // 8-Note Triumphant Genesis Ecstasy Fanfare (C5 -> E5 -> G5 -> B5 -> D6 -> F#6 -> E6 -> G6)
      const baseFanfareHz = [
        523.25, // C5
        659.25, // E5
        783.99, // G5
        987.77, // B5
        1174.66, // D6
        1479.98, // F#6 (Lydian #4 climax)
        1318.51, // E6
        1567.98, // G6 (Apex)
      ]

      baseFanfareHz.forEach((rawFreq, idx) => {
        const freq = Number((rawFreq * brillianceMultiplier + stylePitchOffsetHz).toFixed(2))
        primaryFrequenciesHz.push(freq)
        const isClimax = idx === baseFanfareHz.length - 1
        notes.push({
          freq,
          type: idx % 2 === 0 || isClimax ? 'triangle' : 'sine',
          durationSec: isClimax ? 0.46 : 0.22,
          delaySec: idx * 0.042,
          gain: isClimax ? 0.085 : 0.08,
        })
      })

      // Chorus shimmer crown at the peak of the fanfare
      const crownChordHz = [1046.5, 1318.51, 1567.98]
      crownChordHz.forEach((rawCrown, cIdx) => {
        const freq = Number((rawCrown * brillianceMultiplier + 3.5).toFixed(2))
        notes.push({
          freq,
          type: 'sine',
          durationSec: 0.42,
          delaySec: 8 * 0.042 + cIdx * 0.015,
          gain: 0.06,
        })
      })
    }

    return {
      streakCount: effectiveStreak,
      magnitude: clampedMag,
      style,
      tier,
      primaryFrequenciesHz,
      notes,
    }
  }

  /**
   * Plays the 16-stage Sequence Dopamine symphony (`1×` to `16×+`) and returns its signature.
   */
  public playSequenceDopamine(
    streakCount: number,
    magnitude: number = 1,
    style: SubGameStyle = 'TETRIS_CLASSIC'
  ): SequenceDopamineSignature {
    const signature = this.getSequenceDopamineSignature(streakCount, magnitude, style)
    const prevStreak = this.lastSequenceSignature?.streakCount ?? -1
    this.lastSequenceSignature = signature

    // Allow immediate trigger if streakCount changed (escalating sequence), otherwise apply 35ms cooldown
    if (streakCount !== prevStreak) {
      if (this.muted) return signature
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      this.lastChannelTriggerMs.dopamine = now
    } else if (!this.canTriggerChannel('dopamine', 35)) {
      return signature
    }

    signature.notes.forEach((note) => {
      this.scheduleNote(note)
    })

    return signature
  }

  /**
   * Ascending Pentatonic/Lydian arpeggio on Line Clears (`1..4` lines), powered by the
   * 16-Stage Sequence Dopamine Engine (`playSequenceDopamine`) so sequences `1×` through `16×+`
   * escalate continuously without hitting the old `combo = 5` ceiling!
   */
  public playLineClear(linesCleared: number, combo: number = 0): SequenceDopamineSignature {
    const clampedLines = Math.max(1, Math.min(4, linesCleared))
    const effectiveStreak = combo <= 0 ? 1 : combo
    return this.playSequenceDopamine(effectiveStreak, clampedLines, 'TETRIS_CLASSIC')
  }

  /**
   * Distinct sonic fanfare when shifting between the 3 styles of the Block Trinity
   * (`TETRIS_CLASSIC`, `FRUIT_MATCH`, `TACTILE_GRID`).
   */
  public playStyleShiftFanfare(targetStyle: SubGameStyle): void {
    if (!this.canTriggerChannel('styleShift', 60)) return

    if (targetStyle === 'FRUIT_MATCH') {
      // Juicy syncopated marimba cascade: E4 -> G4 -> A4 -> B4 -> D5 -> G5
      const fruitNotes = [329.63, 392.0, 440.0, 493.88, 587.33, 783.99]
      fruitNotes.forEach((freq, idx) => {
        this.scheduleNote({
          freq,
          type: idx % 2 === 0 ? 'sine' : 'triangle',
          durationSec: 0.18,
          delaySec: idx * 0.04,
          gain: 0.075,
        })
      })
      return
    }

    if (targetStyle === 'TACTILE_GRID') {
      // Warm crystalline Base-10 grid chord: D4 -> F#4 -> A4 -> D5 -> F#5 -> A5
      const gridNotes = [293.66, 369.99, 440.0, 587.33, 739.99, 880.0]
      gridNotes.forEach((freq, idx) => {
        this.scheduleNote({
          freq,
          type: 'triangle',
          durationSec: 0.2,
          delaySec: idx * 0.042,
          gain: 0.075,
        })
      })
      return
    }

    // TETRIS_CLASSIC: Heroic geometric Base-10 brass/crystal motif: C4 -> G4 -> C5 -> E5 -> G5 -> C6
    const classicNotes = [261.63, 392.0, 523.25, 659.25, 783.99, 1046.5]
    classicNotes.forEach((freq, idx) => {
      this.scheduleNote({
        freq,
        type: idx === classicNotes.length - 1 ? 'triangle' : 'sine',
        durationSec: 0.22,
        delaySec: idx * 0.042,
        gain: 0.078,
      })
    })
  }

  /**
   * Epic 6-note Phoenix 142857 Lydian Fanfare when `MATH_SECOND_WIND` saves the player's life
   * and purifies the bottom rows (`Melhoria 06-B`).
   */
  public playPhoenixSecondWind(): void {
    if (!this.canTriggerChannel('phoenix', 80)) return
    // Inspired by 1-4-2-8-5-7 in C Lydian: C4 -> F#4 -> D4 -> C5 -> G4 -> B4 -> C6
    const phoenixSequence = [261.63, 369.99, 293.66, 523.25, 392.0, 493.88, 1046.5]
    phoenixSequence.forEach((freq, idx) => {
      this.scheduleNote({
        freq,
        type: idx === phoenixSequence.length - 1 ? 'triangle' : 'sine',
        durationSec: idx === phoenixSequence.length - 1 ? 0.38 : 0.16,
        delaySec: idx * 0.055,
        gain: 0.085,
      })
    })
  }

  /** Gentle alert chime when Top-Out triggers the Phoenix Protocol modal */
  public playSecondWindAlert(): void {
    if (!this.canTriggerChannel('phoenix', 60)) return
    const alertNotes = [293.66, 369.99, 440.0, 587.33] // D Major triad
    alertNotes.forEach((freq, idx) => {
      this.scheduleNote({
        freq,
        type: 'sine',
        durationSec: 0.16,
        delaySec: idx * 0.05,
        gain: 0.065,
      })
    })
  }

  /** Bright welcoming triad when starting a new match */
  public playStartGame(): void {
    if (!this.canTriggerChannel('system', 60)) return
    const startNotes = [261.63, 329.63, 392.0, 523.25] // C4, E4, G4, C5
    startNotes.forEach((freq, idx) => {
      this.scheduleNote({
        freq,
        type: 'triangle',
        durationSec: 0.15,
        delaySec: idx * 0.04,
        gain: 0.065,
      })
    })
  }

  /** Peaceful descending pentatonic resolution on match completion */
  public playGameOver(): void {
    if (!this.canTriggerChannel('system', 80)) return
    const restNotes = [523.25, 440.0, 392.0, 329.63, 261.63] // C5 -> A4 -> G4 -> E4 -> C4
    restNotes.forEach((freq, idx) => {
      this.scheduleNote({
        freq,
        type: 'sine',
        durationSec: 0.22,
        delaySec: idx * 0.07,
        gain: 0.06,
      })
    })
  }
}

export const soundEngine = new LogicTetrisSoundEngine()
