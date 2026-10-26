// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/hooks/useRunLoop.ts — Loop rAF do Mundo 1
// ──────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export function useRunLoop(active: boolean): void {
  const tickRun = useLogicBattleStore((s) => s.tickRun)
  const togglePauseRun = useLogicBattleStore((s) => s.togglePauseRun)
  const fpsCap = useLogicBattleStore((s) => s.save.settings.fpsCap)
  const lastFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        const currentPhase = useLogicBattleStore.getState().snapshot.phase
        if (currentPhase === 'RUNNING') {
          togglePauseRun()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [togglePauseRun])

  useEffect(() => {
    if (!active) {
      lastFrameRef.current = null
      return
    }

    let rafId = 0
    const minIntervalMs = fpsCap === 30 ? 31 : 14

    const loop = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now
      }
      const dt = now - lastFrameRef.current
      if (dt >= minIntervalMs) {
        lastFrameRef.current = now
        tickRun(dt)
      }
      rafId = window.requestAnimationFrame(loop)
    }

    rafId = window.requestAnimationFrame(loop)
    return () => {
      window.cancelAnimationFrame(rafId)
      lastFrameRef.current = null
    }
  }, [active, fpsCap, tickRun])
}
