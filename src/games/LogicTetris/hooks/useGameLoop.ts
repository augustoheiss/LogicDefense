import { useEffect, useRef } from 'react'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'

export interface UseGameLoopOptions {
  /** Whether the requestAnimationFrame loop should run (default: true) */
  enabled?: boolean
  /** Whether standard gameplay keyboard bindings should be active (default: true) */
  enableKeyboard?: boolean
}

const MAX_FRAME_DELTA_MS = 100
const PRUNE_FEEDBACK_INTERVAL_MS = 400

/**
 * Deterministic temporal game loop hook (`requestAnimationFrame`) for Logic Tetris Genesis.
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 04-D`: Idempotent under React 19 StrictMode (`cancelAnimationFrame` in cleanup),
 *   clamped delta `dtMs = Math.min(Math.max(0, rawDt), 100)` to prevent tab-switch teleports,
 *   and periodic `pruneFloatingFeedbacks()` cleanup every 400ms to prevent memory accumulation.
 * - Immediately pauses gravity ticks when `phase` is not `'PLAYING' | 'MATH_MORPH' | 'MATH_FILL_HOLE'`.
 */
export function useGameLoop(options: UseGameLoopOptions = {}): void {
  const { enabled = true, enableKeyboard = true } = options
  const rafIdRef = useRef<number | null>(null)
  const lastTimestampRef = useRef<number | null>(null)
  const pruneAccumulatorRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      lastTimestampRef.current = null
      return
    }

    let isCancelled = false

    const step = (timestamp: number) => {
      if (isCancelled) return

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp
      }

      const rawDt = timestamp - lastTimestampRef.current
      lastTimestampRef.current = timestamp

      // Clamp delta to [0, 100ms] so tab switching or frame drops never teleport pieces (Melhoria 04-D)
      const dtMs = Math.min(Math.max(0, rawDt), MAX_FRAME_DELTA_MS)

      const store = useLogicTetrisStore.getState()
      const currentPhase = store.phase

      // Advance deterministic gravity / lock-delay / Grace-Float / Bullet-Time
      if (
        currentPhase === 'PLAYING' ||
        currentPhase === 'MATH_MORPH' ||
        currentPhase === 'MATH_FILL_HOLE'
      ) {
        store.tickLoop(dtMs)
      }

      // Periodically prune expired floating feedbacks so array never grows unbounded (Melhoria 04-D)
      pruneAccumulatorRef.current += dtMs
      if (pruneAccumulatorRef.current >= PRUNE_FEEDBACK_INTERVAL_MS) {
        pruneAccumulatorRef.current = 0
        if (store.floatingFeedbacks.length > 0) {
          store.pruneFloatingFeedbacks()
        }
      }

      if (!isCancelled) {
        rafIdRef.current = window.requestAnimationFrame(step)
      }
    }

    rafIdRef.current = window.requestAnimationFrame(step)

    return () => {
      isCancelled = true
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      lastTimestampRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !enableKeyboard) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      const store = useLogicTetrisStore.getState()
      const { phase } = store

      // Pause / Resume toggle with [P]
      if (event.key === 'p' || event.key === 'P') {
        if (phase === 'PLAYING' || phase === 'PAUSED') {
          event.preventDefault()
          store.togglePause()
        }
        return
      }

      // Codex drawer toggle with [H] (Histórico / Códice)
      if (event.key === 'h' || event.key === 'H') {
        if (phase === 'PLAYING' || phase === 'PAUSED' || phase === 'START_HUB') {
          event.preventDefault()
          store.toggleCodex()
        }
        return
      }

      if (phase !== 'PLAYING') {
        return
      }

      switch (event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          event.preventDefault()
          store.moveHorizontal(-1)
          break

        case 'ArrowRight':
        case 'd':
        case 'D':
          event.preventDefault()
          store.moveHorizontal(1)
          break

        case 'ArrowDown':
        case 's':
        case 'S':
          event.preventDefault()
          store.setSoftDropping(true)
          store.softDropStep()
          break

        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'x':
        case 'X':
          event.preventDefault()
          store.rotatePiece('CW')
          break

        case 'z':
        case 'Z':
          event.preventDefault()
          store.rotatePiece('CCW')
          break

        case ' ':
          event.preventDefault()
          store.hardDrop()
          break

        case 'c':
        case 'C':
        case 'Shift':
          event.preventDefault()
          store.holdCurrentPiece()
          break

        case 'm':
        case 'M':
          event.preventDefault()
          store.triggerMathMorph()
          break

        case 'b':
        case 'B':
          event.preventDefault()
          store.triggerMathFillHole()
          break

        default:
          break
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        const store = useLogicTetrisStore.getState()
        if (store.isSoftDropping) {
          store.setSoftDropping(false)
        }
      }
    }

    const handleWindowBlur = () => {
      const store = useLogicTetrisStore.getState()
      if (store.isSoftDropping) {
        store.setSoftDropping(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [enabled, enableKeyboard])
}
