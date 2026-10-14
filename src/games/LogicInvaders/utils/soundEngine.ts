// ============================================================
// LOGIC INVADERS — PROCEDURAL WEB AUDIO ENGINE (0 KB Assets)
// Synthesizes crisp retro-arcade & harmonic pedagogical SFX
// using native Web Audio API. Safe fallback if blocked/unsupported.
// ============================================================

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private activeVoices: number = 0;
  private readonly MAX_VOICES = 16;

  constructor() {
    try {
      const saved = localStorage.getItem('logic_invaders_muted');
      if (saved === 'true') this.muted = true;
    } catch {
      // ignore storage errors
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      localStorage.setItem('logic_invaders_muted', String(mute));
    } catch {
      // ignore
    }
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playMathEureka(1);
    }
    return this.muted;
  }

  /** Helper to play a single oscillator voice with envelope and voice cap */
  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    gainPeak: number = 0.12,
    delaySec: number = 0
  ): void {
    const ctx = this.getContext();
    if (!ctx || this.activeVoices >= this.MAX_VOICES) return;

    try {
      const now = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freqStart), now);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + durationSec);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainPeak, now + Math.min(0.015, durationSec * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      this.activeVoices++;
      osc.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      };

      osc.start(now);
      osc.stop(now + durationSec + 0.01);
    } catch {
      // Fail silently on restricted audio contexts
    }
  }

  /** Standard player bullet pew */
  public playLaserShot(empowered: boolean = false): void {
    if (empowered) {
      this.playTone(780, 260, 0.09, 'triangle', 0.07);
      this.playTone(1170, 520, 0.07, 'sine', 0.05);
    } else {
      this.playTone(580, 190, 0.07, 'triangle', 0.05);
    }
  }

  /** Precision plasma lock when pressing 1/2/3 or clicking a bubble */
  public playPlasmaLock(): void {
    this.playTone(440, 880, 0.08, 'sine', 0.09);
  }

  /**
   * Celebratory harmonic chord when solving a math equation!
   * Rises along a joyful C-major pentatonic scale as mathStreak increases.
   */
  public playMathEureka(streak: number = 1): void {
    // Pentatonic base frequencies (C5, D5, E5, G5, A5, C6, D6, E6)
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
    const idx = Math.max(0, Math.min(scale.length - 3, streak - 1));
    const root = scale[idx];
    const third = scale[idx + 1];
    const fifth = scale[idx + 2];

    this.playTone(root, root * 1.01, 0.22, 'triangle', 0.12, 0);
    this.playTone(third, third * 1.01, 0.24, 'triangle', 0.11, 0.055);
    this.playTone(fifth, fifth * 1.02, 0.32, 'sine', 0.13, 0.11);
  }

  /**
   * Gentle elastic bounce when hitting a wrong bubble.
   * Designed to feel bouncy and non-punishing (reduces math anxiety).
   */
  public playElasticAbsorb(): void {
    this.playTone(220, 310, 0.11, 'sine', 0.09, 0);
    this.playTone(310, 180, 0.16, 'triangle', 0.08, 0.08);
  }

  /** Energetic beam activation when Laser Mode or Overdrive starts */
  public playOverdriveStart(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, i) => {
      this.playTone(n, n * 1.05, 0.25, 'sawtooth', 0.06, i * 0.045);
    });
  }

  /** Modifier orb hit (buff = ascending chime, debuff = soft drop) */
  public playModifierHit(isBuff: boolean): void {
    if (isBuff) {
      this.playTone(587.33, 880, 0.15, 'sine', 0.1);
      this.playTone(880, 1174.66, 0.18, 'triangle', 0.09, 0.06);
    } else {
      this.playTone(320, 200, 0.18, 'sine', 0.08);
    }
  }

  /** Deep arcade synth alert when a VoxelBoss enters */
  public playBossIntro(): void {
    this.playTone(130.81, 123.47, 0.35, 'sawtooth', 0.09, 0);
    this.playTone(196.0, 185.0, 0.4, 'triangle', 0.08, 0.15);
  }

  /** Triumphant fanfare when a VoxelBoss is defeated */
  public playBossDefeat(): void {
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    fanfare.forEach((f, i) => {
      this.playTone(f, f, 0.28, 'triangle', 0.11, i * 0.06);
    });
  }
}

export const soundEngine = new SoundEngine();
