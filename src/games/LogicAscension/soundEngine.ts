// ============================================================
// LOGIC ASCENSION — PROCEDURAL WEB AUDIO ENGINE (0 KB Assets)
// Synthesizes tactile dungeon feedback, bow QTE shots, and
// streak-scaled harmonic dopamine chimes using native Web Audio API.
// ============================================================

const MUTE_STORAGE_KEY = 'logic_ascension_muted';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;
  private lastPlayed: Record<string, number> = {};

  constructor() {
    try {
      const saved = window.localStorage.getItem(MUTE_STORAGE_KEY);
      if (saved === 'true') this.muted = true;
    } catch {
      // ignore storage errors
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private canPlay(key: string, minIntervalMs: number): boolean {
    const now = performance.now();
    const prev = this.lastPlayed[key] ?? 0;
    if (now - prev < minIntervalMs) return false;
    this.lastPlayed[key] = now;
    return true;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, String(mute));
    } catch {
      // ignore
    }
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.35, this.ctx.currentTime, 0.02);
      } catch {
        // ignore
      }
    }
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playMathEureka(1);
    }
    return this.muted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    gainPeak: number = 0.16,
    delaySec: number = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

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
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + durationSec + 0.01);
    } catch {
      // fail silently
    }
  }

  /** Soft rhythmic footstep tick on the dungeon grid */
  public playStep(): void {
    if (!this.canPlay('step', 95)) return;
    this.playTone(170, 90, 0.035, 'triangle', 0.06, 0);
  }

  /** Stepping on a TrickyBuff or Major Choice */
  public playBuff(isPositive: boolean): void {
    if (isPositive) {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((f, i) => {
        this.playTone(f, f * 1.03, 0.22, 'triangle', 0.16, i * 0.045);
      });
    } else {
      // Curse / sacrifice (< 1x): dramatic low shimmer
      this.playTone(310, 155, 0.28, 'sawtooth', 0.14, 0);
      this.playTone(233, 116, 0.32, 'triangle', 0.14, 0.08);
    }
  }

  /** Mystical chord when the Oracle lifts the fog of a new room */
  public playRoomReveal(): void {
    if (!this.canPlay('reveal', 200)) return;
    const notes = [329.63, 440, 659.25]; // E4 - A4 - E5
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.01, 0.3, 'sine', 0.12, i * 0.06);
    });
  }

  /** Entering combat with a monster or Boss */
  public playCombatStart(isBoss: boolean): void {
    if (isBoss) {
      this.playTone(110, 98, 0.45, 'sawtooth', 0.2, 0);
      this.playTone(164.81, 146.83, 0.5, 'triangle', 0.18, 0.12);
    } else {
      this.playTone(260, 390, 0.12, 'triangle', 0.12, 0);
    }
  }

  /** PocketArena arrow shot */
  public playArrow(isSuper: boolean = false): void {
    if (!this.canPlay(isSuper ? 'super_arrow' : 'arrow', isSuper ? 80 : 120)) return;
    if (isSuper) {
      this.playTone(580, 1160, 0.16, 'triangle', 0.16, 0);
      this.playTone(880, 440, 0.18, 'sine', 0.12, 0.04);
    } else {
      this.playTone(620, 240, 0.06, 'triangle', 0.07, 0);
    }
  }

  /** PocketArena arrow hits monster */
  public playMonsterHit(): void {
    if (!this.canPlay('m_hit', 70)) return;
    this.playTone(190, 85, 0.07, 'sawtooth', 0.1, 0);
  }

  /** PocketArena monster stunned -> 50/50 lifeline unlocked! */
  public playStun5050(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.04, 0.24, 'triangle', 0.18, i * 0.05);
    });
  }

  /**
   * Dopamine Eureka Arpeggio when solving a math calculation!
   * Rises in pitch with consecutive streak (up to +7 semitones).
   */
  public playMathEureka(streak: number = 1): void {
    const semitones = Math.min(7, Math.max(0, streak - 1));
    const mult = Math.pow(2, semitones / 12);

    // Lydian/Major bright chord progression: C5 -> E5 -> G5 -> B5 -> D6
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    notes.forEach((f, i) => {
      this.playTone(f * mult, f * mult * 1.01, 0.34, 'triangle', 0.18, i * 0.05);
    });

    // Warm sub-bass punch
    this.playTone(130, 48, 0.38, 'sine', 0.24, 0);
  }

  /** Tactical shield-absorb sound on 1st mistake (Second Wind) */
  public playSecondWind(): void {
    this.playTone(240, 140, 0.18, 'triangle', 0.18, 0);
    this.playTone(180, 260, 0.22, 'sine', 0.14, 0.12);
  }

  /** Math combat defeat / wrong final answer */
  public playMathError(): void {
    this.playTone(220, 164.81, 0.2, 'sawtooth', 0.15, 0);
    this.playTone(164.81, 110, 0.28, 'triangle', 0.15, 0.14);
  }

  /** Boss spawns in the corridor */
  public playBossSpawn(): void {
    this.playTone(130.81, 98.0, 0.5, 'sawtooth', 0.22, 0);
    this.playTone(196.0, 146.83, 0.55, 'triangle', 0.18, 0.18);
  }

  /** Victory portal fanfare */
  public playVictoryFanfare(): void {
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    fanfare.forEach((f, i) => {
      this.playTone(f, f * 1.01, 0.38, 'triangle', 0.2, i * 0.07);
    });
  }
}

export const soundEngine = new SoundEngine();
