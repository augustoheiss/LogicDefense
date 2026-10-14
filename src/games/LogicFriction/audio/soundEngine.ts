// ============================================================
// Logic Friction — Procedural Web Audio Synthesizer (0 KB Assets)
// Sprint D: agency-game-audio-engineer implementation
//
// Features:
//   • Pure Web Audio API (AudioContext + Oscillator + BiquadFilter)
//   • Zero external audio files — impossible to 404 or lag on network
//   • Voice-stealing & rate-limiting per category (prevents clipping
//     when 20+ towers fire simultaneously)
//   • Subtle pitch randomization (±4%) so combat never sounds robotic
//   • Streak-scaled harmonic arpeggios on math success
// ============================================================

export type TowerSoundType = 'BOLT' | 'MORTAR' | 'SHOCKWAVE' | 'RAILGUN'

class SoundEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private muted: boolean = false

  // Voice rate-limiting timestamps (ms) to prevent mixer clipping
  private lastPlayed: Record<string, number> = {}

  private ensureContext(): AudioContext | null {
    if (this.muted) return null
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AudioCtx) return null
        this.ctx = new AudioCtx()
        this.masterGain = this.ctx.createGain()
        this.masterGain.gain.value = 0.35
        this.masterGain.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      return this.ctx
    } catch {
      return null
    }
  }

  private canPlay(key: string, minIntervalMs: number): boolean {
    const now = performance.now()
    const prev = this.lastPlayed[key] ?? 0
    if (now - prev < minIntervalMs) return false
    this.lastPlayed[key] = now
    return true
  }

  /** Random pitch multiplier for organic variation */
  private jitter(amount = 0.04): number {
    return 1 + (Math.random() * 2 - 1) * amount
  }

  public setMuted(mute: boolean): void {
    this.muted = mute
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.35, this.ctx.currentTime, 0.02)
    }
  }

  public isMuted(): boolean {
    return this.muted
  }

  // ── Tower Projectile SFX ──────────────────────────────────────────────────────
  public playTowerFire(type: TowerSoundType): void {
    if (!this.canPlay(`tower_${type}`, type === 'BOLT' ? 55 : 90)) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    if (type === 'BOLT') {
      // Crisp cyan laser zap
      osc.type = 'sawtooth'
      const f0 = 780 * this.jitter(0.06)
      osc.frequency.setValueAtTime(f0, now)
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.09)
      gain.gain.setValueAtTime(0.14, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.095)
    } else if (type === 'MORTAR') {
      // Deep plasma mortar launch + thump
      osc.type = 'triangle'
      const f0 = 220 * this.jitter(0.05)
      osc.frequency.setValueAtTime(f0, now)
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.22)
      gain.gain.setValueAtTime(0.28, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.23)
    } else if (type === 'SHOCKWAVE') {
      // Cryo AoE shimmer pulse
      osc.type = 'sine'
      const f0 = 320 * this.jitter(0.03)
      osc.frequency.setValueAtTime(f0, now)
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.12)
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.30)
      gain.gain.setValueAtTime(0.20, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.31)
    } else {
      // RAILGUN — high-energy crack + sub drop
      osc.type = 'sawtooth'
      const f0 = 1400 * this.jitter(0.03)
      osc.frequency.setValueAtTime(f0, now)
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.18)
      gain.gain.setValueAtTime(0.26, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.19)
    }
  }

  // ── Player Melee & Logic Pulse (Spacebar) ─────────────────────────────────────
  public playPlayerAttack(isBuffed: boolean): void {
    if (!this.canPlay('player_atk', 80)) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = isBuffed ? 'triangle' : 'sine'
    const base = isBuffed ? 520 : 380
    osc.frequency.setValueAtTime(base * this.jitter(0.05), now)
    osc.frequency.exponentialRampToValueAtTime(isBuffed ? 880 : 160, now + 0.11)

    gain.gain.setValueAtTime(isBuffed ? 0.22 : 0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.12)
  }

  public playPlayerPulse(): void {
    if (!this.canPlay('player_pulse', 200)) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    // Dual oscillator shockwave chord
    const freqs = [261.63, 392.0, 523.25] // C4, G4, C5
    freqs.forEach((f, idx) => {
      if (!ctx || !this.masterGain) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = idx === 0 ? 'sawtooth' : 'triangle'
      osc.frequency.setValueAtTime(f, now)
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.18)
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, now + 0.35)

      gain.gain.setValueAtTime(0.16 / freqs.length, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.36)
    })
  }

  // ── Math Answer Feedback (The Sacred Moment) ──────────────────────────────────
  public playMathSuccess(streak: number = 1): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    // Pitch shifts upward slightly with streak (capped at +6 semitones)
    const semitoneShift = Math.min(6, Math.max(0, streak - 1))
    const pitchMult = Math.pow(2, semitoneShift / 12)

    // Lydian/Major celestial arpeggio: C5 -> E5 -> G5 -> B5 -> D6
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66]
    notes.forEach((freq, i) => {
      if (!ctx || !this.masterGain) return
      const start = now + i * 0.055
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq * pitchMult, start)

      gain.gain.setValueAtTime(0.001, start)
      gain.gain.linearRampToValueAtTime(0.24, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(start)
      osc.stop(start + 0.45)
    })

    // Thunder of Archimedes sub-impact
    const sub = ctx.createOscillator()
    const subGain = ctx.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(130, now)
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.45)
    subGain.gain.setValueAtTime(0.32, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    sub.connect(subGain)
    subGain.connect(this.masterGain)
    sub.start(now)
    sub.stop(now + 0.46)
  }

  public playMathError(): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    // Two-tone descending tactical alert (non-ear-piercing)
    const notes = [220, 164.81] // A3 -> E3 (minor/fifth drop)
    notes.forEach((freq, i) => {
      if (!ctx || !this.masterGain) return
      const start = now + i * 0.12
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, start)

      // Low-pass filter to keep it warm
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(650, start)

      gain.gain.setValueAtTime(0.20, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)
      osc.start(start)
      osc.stop(start + 0.19)
    })
  }

  // ── Construction, Upgrade & Economy SFX ───────────────────────────────────────
  public playPlaceSite(): void {
    if (!this.canPlay('place_site', 60)) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.08)
    gain.gain.setValueAtTime(0.16, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.09)
  }

  public playFundTower(): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    const notes = [392.0, 523.25, 783.99] // G4, C5, G5
    notes.forEach((freq, i) => {
      if (!ctx || !this.masterGain) return
      const start = now + i * 0.045
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.20, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.20)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(start)
      osc.stop(start + 0.21)
    })
  }

  public playUpgrade(): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    const notes = [440, 554.37, 659.25, 880] // A4 major triad -> A5
    notes.forEach((freq, i) => {
      if (!ctx || !this.masterGain) return
      const start = now + i * 0.04
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.22, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(start)
      osc.stop(start + 0.26)
    })
  }

  public playBossWaveAlert(): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    // Dramatic low brass/synth horn
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(110, now)
    osc.frequency.linearRampToValueAtTime(98, now + 0.6)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(420, now)

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.28, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.68)
  }

  public playCoreDamage(): void {
    if (!this.canPlay('core_dmg', 180)) return
    const ctx = this.ensureContext()
    if (!ctx || !this.masterGain) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.22)
    gain.gain.setValueAtTime(0.30, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.23)
  }
}

export const soundEngine = new SoundEngine()
