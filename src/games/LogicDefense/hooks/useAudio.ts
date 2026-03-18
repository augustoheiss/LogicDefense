import { useRef, useCallback } from 'react'
import { Howl, Howler } from 'howler'

// ─── Audio Modes ───────────────────────────────────────────────────────────────
// 'normal' → BGM principal, velocidade 1x
// 'spin'   → BGM acelera 15% (tensão da roleta SPIN Esfera)
// 'boss'   → Crossfade para bgm_boss (múltiplos de 10 opcionalmente)
export type AudioMode = 'normal' | 'spin' | 'boss'

// ─── Constants ────────────────────────────────────────────────────────────────
const BGM_VOLUME = 0.35
const BGM_FADE_IN_MS = 1500
const BGM_FADE_OUT_MS = 800
const BGM_SPIN_RATE = 1.15   // +15% pitch/speed durante a SPIN (tensão)
const BGM_NORMAL_RATE = 1.0

// ─── Optional SFX file paths ─────────────────────────────────────────────────
// Uncomment and add .wav/.mp3 files to /public/assets/audio/ to use real sounds.
// As long as these are commented out, the engine uses Web Audio synthesis instead.
/*
const SFX_FILES: Partial<Record<string, string[]>> = {
  shoot:     ['/assets/audio/shoot.wav'],
  sniper:    ['/assets/audio/sniper.wav'],
  hit:       ['/assets/audio/hit.wav'],
  correct:   ['/assets/audio/correct.wav'],
  wrong:     ['/assets/audio/wrong.wav'],
  upgrade:   ['/assets/audio/upgrade.wav'],
  heal:      ['/assets/audio/heal.wav'],
  cinematic: ['/assets/audio/cinematic.wav'],
  spin:      ['/assets/audio/spin.wav'],
}
*/

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAudio() {
  // ── Refs ────────────────────────────────────────────────────────────────────
  const isMutedRef = useRef(false)
  const userActivatedRef = useRef(false)

  // Web Audio context for SFX synthesis
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Howler BGM instances (created lazily on first user interaction)
  const bgmNormalRef = useRef<Howl | null>(null)
  const bgmBossRef = useRef<Howl | null>(null)
  const currentBgmRef = useRef<Howl | null>(null)
  const currentModeRef = useRef<AudioMode>('normal')

  // ── Internal: Build Howl instances ──────────────────────────────────────────
  function buildBgmInstances() {
    if (bgmNormalRef.current) return // already initialized

    bgmNormalRef.current = new Howl({
      src: ['/assets/audio/bgm.mp3', '/assets/audio/bgm.ogg'],
      loop: true,
      volume: 0,
      html5: true,           // stream from disk — better for large BGM files
      onloaderror: () => {}, // file missing → silent, game runs fine
    })

    bgmBossRef.current = new Howl({
      src: ['/assets/audio/bgm_boss.mp3', '/assets/audio/bgm_boss.ogg'],
      loop: true,
      volume: 0,
      html5: true,
      onloaderror: () => {},
    })
  }

  // ── Internal: BGM Fade helpers ───────────────────────────────────────────────
  function bgmFadeIn(howl: Howl, durationMs: number) {
    try {
      const targetVol = isMutedRef.current ? 0 : BGM_VOLUME
      howl.play()
      howl.fade(0, targetVol, durationMs)
    } catch { /* non-fatal */ }
  }

  function bgmFadeOut(howl: Howl, durationMs: number, onDone?: () => void) {
    try {
      howl.fade(howl.volume(), 0, durationMs)
      howl.once('fade', () => {
        try { howl.stop() } catch { /* non-fatal */ }
        onDone?.()
      })
    } catch { onDone?.() }
  }

  // ── Internal: Web Audio SFX synthesis ───────────────────────────────────────
  function getCtx(): AudioContext | null {
    const ctx = audioCtxRef.current
    if (!ctx) return null
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  type RampType = 'exp' | 'linear'

  function synth(
    oscType: OscillatorType,
    freqStart: number,
    freqEnd: number,
    duration: number,
    gainPeak: number,
    gainRamp: RampType = 'exp',
    freqRamp: RampType = 'exp',
  ) {
    const ctx = getCtx()
    if (!ctx) return
    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = oscType
      osc.frequency.setValueAtTime(freqStart, ctx.currentTime)
      if (freqRamp === 'exp') {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(freqEnd, 0.01),
          ctx.currentTime + duration,
        )
      } else {
        osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration)
      }

      gain.gain.setValueAtTime(gainPeak, ctx.currentTime)
      if (gainRamp === 'exp') {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      } else {
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)
      }

      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch { /* non-fatal */ }
  }

  // ── Public: initAudio ────────────────────────────────────────────────────────
  // Must be called on first user interaction (e.g. JOGAR click).
  // Safe to call multiple times — only activates once.
  const initAudio = useCallback(() => {
    if (userActivatedRef.current) return
    userActivatedRef.current = true

    // Unlock Web Audio for SFX synthesis
    try {
      const AC =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (AC) {
        audioCtxRef.current = new AC()
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
      }
    } catch { /* non-fatal */ }

    // Start BGM
    try {
      Howler.autoUnlock = true
      buildBgmInstances()
      const bgm = bgmNormalRef.current!
      bgmFadeIn(bgm, BGM_FADE_IN_MS)
      currentBgmRef.current = bgm
    } catch { /* non-fatal — game runs without BGM file */ }
  }, [])

  // ── Public: playSound ────────────────────────────────────────────────────────
  // SFX are synthesized in real-time with Web Audio API.
  // No audio files needed for SFX — works immediately.
  const playSound = useCallback((type: string) => {
    if (isMutedRef.current || !audioCtxRef.current) return
    try {
      switch (type) {
        case 'shoot':
          synth('square', 400, 100, 0.10, 0.010, 'exp', 'exp')
          break
        case 'sniper':
          synth('triangle', 150, 50, 0.30, 0.020, 'exp', 'exp')
          break
        case 'hit':
          synth('sawtooth', 100, 30, 0.10, 0.010, 'exp', 'linear')
          break
        case 'correct':
          // Ascending two-tone chime
          synth('sine', 600, 600, 0.10, 0.030, 'linear', 'linear')
          setTimeout(() => synth('sine', 1200, 1200, 0.20, 0.030, 'linear', 'linear'), 100)
          break
        case 'wrong':
          synth('sawtooth', 100, 50, 0.30, 0.050, 'linear', 'linear')
          break
        case 'upgrade':
          synth('triangle', 300, 600, 0.30, 0.030, 'linear', 'linear')
          break
        case 'heal':
          synth('sine', 400, 800, 0.50, 0.030, 'linear', 'linear')
          break
        case 'cinematic':
          synth('sawtooth', 50, 10, 1.50, 0.080, 'linear', 'exp')
          break
        case 'spin':
          // Rising ratchet sweep — aceleração da roleta
          synth('square', 180, 720, 0.80, 0.025, 'linear', 'linear')
          setTimeout(() => synth('square', 720, 180, 0.40, 0.015, 'linear', 'linear'), 800)
          break
      }
    } catch { /* non-fatal */ }
  }, [])

  // ── Public: setAudioMode ─────────────────────────────────────────────────────
  // Adaptive audio based on game state:
  //   'normal' → BGM principal, rate 1.0 (MATH / BUILD / COMBAT)
  //   'spin'   → BGM acelera 15% para tensão (SPIN Esfera / CINEMATIC)
  //   'boss'   → Crossfade para bgm_boss.mp3 (extensível para waves especiais)
  const setAudioMode = useCallback((mode: AudioMode) => {
    if (currentModeRef.current === mode) return
    currentModeRef.current = mode
    try {
      const normal = bgmNormalRef.current
      const boss = bgmBossRef.current

      if (mode === 'normal') {
        // Restore rate first, then crossfade boss→normal if needed
        if (normal) normal.rate(BGM_NORMAL_RATE)
        if (boss?.playing()) {
          bgmFadeOut(boss, BGM_FADE_OUT_MS, () => {
            if (normal) bgmFadeIn(normal, BGM_FADE_IN_MS)
          })
          currentBgmRef.current = normal
        }
      } else if (mode === 'spin') {
        // Speed up the current BGM for tension — no track change needed
        currentBgmRef.current?.rate(BGM_SPIN_RATE)
      } else if (mode === 'boss') {
        // Full crossfade normal → boss
        if (normal?.playing()) {
          bgmFadeOut(normal, BGM_FADE_OUT_MS, () => {
            if (boss) { boss.rate(BGM_NORMAL_RATE); bgmFadeIn(boss, BGM_FADE_IN_MS) }
            currentBgmRef.current = boss
          })
        } else if (boss) {
          boss.rate(BGM_NORMAL_RATE)
          bgmFadeIn(boss, BGM_FADE_IN_MS)
          currentBgmRef.current = boss
        }
      }
    } catch { /* non-fatal */ }
  }, [])

  // ── Public: toggleMute ────────────────────────────────────────────────────────
  // Mutes both BGM (Howler) and SFX (Web Audio). Smooth 300ms fade.
  const toggleMute = useCallback((muted: boolean) => {
    isMutedRef.current = muted
    try {
      const bgm = currentBgmRef.current
      if (bgm) {
        if (muted) {
          bgm.fade(bgm.volume(), 0, 300)
        } else {
          bgm.fade(bgm.volume(), BGM_VOLUME, 300)
        }
      }
    } catch { /* non-fatal */ }
  }, [])

  // ── Public: pauseMusic / resumeMusic ─────────────────────────────────────────
  // Used by the offline detector to pause/resume BGM when network drops.
  const pauseMusic = useCallback(() => {
    try { currentBgmRef.current?.pause() } catch { /* non-fatal */ }
  }, [])

  const resumeMusic = useCallback(() => {
    try {
      if (!isMutedRef.current) currentBgmRef.current?.play()
    } catch { /* non-fatal */ }
  }, [])

  return {
    initAudio,
    playSound,
    setAudioMode,
    toggleMute,
    pauseMusic,
    resumeMusic,
    isMutedRef,
  }
}
