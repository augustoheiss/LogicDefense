// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/audio/soundEngine.ts — Sinfonia Web Audio Procedural
// Pitch proporcional a log10(N) — você ouve as ordens de grandeza crescendo!
// ──────────────────────────────────────────────────────────────────────────────
import { ArmyCount } from '../types'

class LogicBattleSoundEngine {
  private ctx: AudioContext | null = null
  private enabled = true

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  /**
   * Calcula a frequência fundamental em função de log10(N), mapeando [1 .. 10^9]
   * para uma escala pentatônica cristalina entre 220 Hz e 880 Hz.
   */
  public getArmyPitchHz(army: ArmyCount): number {
    const logVal = Math.log10(Math.max(1, army))
    return Math.min(960, 220 * Math.pow(2, logVal / 4.5))
  }

  public playGatePass(armyAfter: ArmyCount, isOptimal: boolean): void {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const baseHz = this.getArmyPitchHz(armyAfter)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = isOptimal ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(baseHz, now)
    osc.frequency.exponentialRampToValueAtTime(
      isOptimal ? baseHz * 1.25 : baseHz * 1.08,
      now + 0.14,
    )

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.11, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.19)
  }

  public playVaiUmMerge(tierIndex: number): void {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const notes = [330, 440, 554.37, 659.25].map((f) => f * (1 + tierIndex * 0.06))
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      const t0 = now + idx * 0.045
      osc.frequency.setValueAtTime(freq, t0)
      gain.gain.setValueAtTime(0.001, t0)
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.24)
    })
  }

  public playTrapOpaAlert(): void {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Dois tons curiosos de xilofone/marimba ("Opa! Pegadinha!") — jamais buzina punitiva
    const freqs = [523.25, 392.0, 587.33]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      const t0 = now + idx * 0.08
      osc.frequency.setValueAtTime(freq, t0)
      gain.gain.setValueAtTime(0.001, t0)
      gain.gain.linearRampToValueAtTime(0.13, t0 + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.22)
    })
  }

  public playTwinsHarmony(): void {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const chord = [440, 554.37, 659.25, 880]
    chord.forEach((freq) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.08, now + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.48)
    })
  }

  public playRedemptionSuccess(): void {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const arpeggio = [392, 493.88, 587.33, 783.99]
    arpeggio.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      const t0 = now + idx * 0.06
      osc.frequency.setValueAtTime(freq, t0)
      gain.gain.setValueAtTime(0.001, t0)
      gain.gain.linearRampToValueAtTime(0.14, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.32)
    })
  }

  public playVictoryFanfare(): void {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      const t0 = now + idx * 0.09
      osc.frequency.setValueAtTime(freq, t0)
      gain.gain.setValueAtTime(0.001, t0)
      gain.gain.linearRampToValueAtTime(0.15, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.42)
    })
  }

  public playLaneSwitch(laneIndex: number): void {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const baseFreq = 280 + laneIndex * 55

    osc.type = 'sine'
    osc.frequency.setValueAtTime(baseFreq, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, now + 0.06)

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.06, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.08)
  }

  public playLunetaScan(): void {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const freqs = [587.33, 880.0]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      const t0 = now + idx * 0.055
      osc.frequency.setValueAtTime(freq, t0)
      gain.gain.setValueAtTime(0.001, t0)
      gain.gain.linearRampToValueAtTime(0.09, t0 + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.18)
    })
  }

  public playDefeatRegroup(): void {
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Acorde reflexivo suave (convite ao reagrupamento tático, nunca punitivo)
    const freqs = [392.0, 349.23, 329.63]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      const t0 = now + idx * 0.09
      osc.frequency.setValueAtTime(freq, t0)
      gain.gain.setValueAtTime(0.001, t0)
      gain.gain.linearRampToValueAtTime(0.09, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.3)
    })
  }
}

export const soundEngine = new LogicBattleSoundEngine()
