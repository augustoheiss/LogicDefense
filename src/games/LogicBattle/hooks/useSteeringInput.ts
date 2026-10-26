// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/hooks/useSteeringInput.ts — Controles Touch, Mouse e Teclado
// ──────────────────────────────────────────────────────────────────────────────
import { RefObject, useEffect } from 'react'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export function useSteeringInput(canvasRef: RefObject<HTMLCanvasElement | null>): void {
  const setSteeringX = useLogicBattleStore((s) => s.setSteeringX)
  const stepLane = useLogicBattleStore((s) => s.stepLane)
  const chooseLaneAndAdvance = useLogicBattleStore((s) => s.chooseLaneAndAdvance)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = useLogicBattleStore.getState()
      if (state.world !== 'run') return
      const phase = state.snapshot.phase
      if (phase !== 'RUNNING' && phase !== 'CALM_WAIT') return

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        stepLane(-1)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        stepLane(1)
      } else if (e.key === '1') {
        chooseLaneAndAdvance(0)
      } else if (e.key === '2') {
        chooseLaneAndAdvance(1)
      } else if (e.key === '3' && state.snapshot.laneCount === 3) {
        chooseLaneAndAdvance(2)
      } else if (e.key === ' ' && phase === 'CALM_WAIT') {
        e.preventDefault()
        chooseLaneAndAdvance(state.snapshot.currentLane)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chooseLaneAndAdvance, stepLane])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    let isDragging = false

    const mapClientX = (clientX: number) => {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return
      const rel = (clientX - rect.left) / rect.width
      const normX = (rel - 0.5) * 2.15
      setSteeringX(normX)
    }

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true
      mapClientX(e.clientX)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging && e.pointerType === 'mouse' && e.buttons === 0) return
      mapClientX(e.clientX)
    }

    const onPointerUp = () => {
      isDragging = false
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [canvasRef, setSteeringX])
}
