// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/hooks/useSteeringInput.ts — Controles Suaves Touch, Mouse e Teclado
// Movimento contínuo passo a passo na ponte (sem teletransportar de um canto ao outro)
// ──────────────────────────────────────────────────────────────────────────────
import { RefObject, useEffect } from 'react'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export function useSteeringInput(canvasRef: RefObject<HTMLCanvasElement | null>): void {
  const setSteeringX = useLogicBattleStore((s) => s.setSteeringX)
  const stepLane = useLogicBattleStore((s) => s.stepLane)
  const chooseLaneAndAdvance = useLogicBattleStore((s) => s.chooseLaneAndAdvance)

  useEffect(() => {
    const heldDirs = new Set<'left' | 'right'>()
    let rafId = 0
    let lastPerf = performance.now()

    const stepHeldKeys = (now: number) => {
      const dtSec = Math.min(0.064, Math.max(0.008, (now - lastPerf) / 1000))
      lastPerf = now

      if (heldDirs.size > 0) {
        const state = useLogicBattleStore.getState()
        if (
          state.world === 'run' &&
          (state.snapshot.phase === 'RUNNING' ||
            state.snapshot.phase === 'CALM_WAIT')
        ) {
          let dir = 0
          if (heldDirs.has('left')) dir -= 1
          if (heldDirs.has('right')) dir += 1
          if (dir !== 0) {
            const nextX = Math.max(
              -0.86,
              Math.min(0.86, state.snapshot.laneX + dir * 1.45 * dtSec),
            )
            setSteeringX(nextX)
          }
        }
      }
      rafId = window.requestAnimationFrame(stepHeldKeys)
    }

    rafId = window.requestAnimationFrame(stepHeldKeys)

    const onKeyDown = (e: KeyboardEvent) => {
      const state = useLogicBattleStore.getState()
      if (state.world !== 'run') return
      const phase = state.snapshot.phase
      if (phase !== 'RUNNING' && phase !== 'CALM_WAIT') return

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        heldDirs.add('left')
        stepLane(-1)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        heldDirs.add('right')
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

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        heldDirs.delete('left')
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        heldDirs.delete('right')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [chooseLaneAndAdvance, setSteeringX, stepLane])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    let isDragging = false

    const mapClientX = (clientX: number) => {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return
      const rel = (clientX - rect.left) / rect.width
      const targetNormX = Math.max(-0.86, Math.min(0.86, (rel - 0.5) * 2.05))
      // Passo suave em direção ao toque/ponteiro sem teletransportar de um extremo ao outro
      const curX = useLogicBattleStore.getState().snapshot.laneX
      const diff = targetNormX - curX
      const maxStep = 0.28
      const nextX =
        Math.abs(diff) <= maxStep ? targetNormX : curX + Math.sign(diff) * maxStep
      setSteeringX(nextX)
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
