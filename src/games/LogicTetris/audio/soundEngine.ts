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

export const MUTE_STORAGE_KEY = 'logic_tetris_v1_muted'
const MIN_CHANNEL_COOLDOWN_MS = 35
const MAX_CONCURRENT_VOICES = 14

// C Major Pentatonic + Lydian #4 (F#) frequencies in Hz
export const PENTATONIC_LYDIAN_SCALE_HZ: readonly number[] = [
  261.63, // C4  (Index 0)
  293.66, // D4  (Index 1)
  329.63, // E4  (Index 2)
  369.99, // F#4 (Index 3 - Lydian bright degree)
  392.00, // G4  (Index 4)
  440.00, // A4  (Index 5)
  493.88, // B4  (Index 6)
  523.25, // C5  (Index 7)
  587.33, // D5  (Index 8)
  659.25, // E5  (Index 9)
  739.99, // F#5 (Index 10 - Lydian bright degree)
  783.99, // G5  (Index 11)
  880.00, // A5  (Index 12)
  987.77, // B5  (Index 13)
  1046.50, // C6 (Index 14)
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
  | 'bounce'
  | 'phoenix'
  | 'system'

interface ToneOptions {
  freq: number
  type?: OscillatorType
  durationSec: number
  delaySec?: number
  gain?: number
  slideToFreq?: number
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

class LogicTetrisSoundEngine {
  private ctx: AudioContext | null = null
  private muted: boolean = loadInitialMutedState()
  private activeVoices: number = 0
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
    if (this.muted || this.activeVoices >= MAX_CONCURRENT_VOICES) return
    const ctx = this.getAudioContext()
    if (!ctx) return

    try {
      const {
        freq,
        type = 'sine',
        durationSec,
        delaySec = 0,
        gain = 0.08,
        slideToFreq,
      } = options

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
      gainNode.gain.linearRampToValueAtTime(gain, startTime + attackTime)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime)

      osc.connect(gainNode)
      gainNode.connect(ctx.destination)

      this.activeVoices++
      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1)
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
   * Ascending Pentatonic/Lydian arpeggio on Line Clears (`1..4` lines), shifting upward in
   * harmonic degree as `combo` grows (`Melhoria 06-A`).
   */
  public playLineClear(linesCleared: number, combo: number = 0): void {
    if (!this.canTriggerChannel('clear', 50)) return
    const clampedLines = Math.max(1, Math.min(4, linesCleared))
    const comboOffset = Math.max(0, Math.min(5, combo))
    const noteCount = clampedLines === 4 ? 6 : clampedLines + 2

    for (let i = 0; i < noteCount; i++) {
      const scaleIdx = Math.min(
        PENTATONIC_LYDIAN_SCALE_HZ.length - 1,
        comboOffset + i * 2
      )
      const freq = PENTATONIC_LYDIAN_SCALE_HZ[scaleIdx]
      this.scheduleNote({
        freq,
        type: clampedLines >= 4 ? 'triangle' : 'sine',
        durationSec: 0.2 + clampedLines * 0.03,
        delaySec: i * 0.048,
        gain: 0.08,
      })
    }
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
