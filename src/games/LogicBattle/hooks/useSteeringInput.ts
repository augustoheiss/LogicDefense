// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/hooks/useSteeringInput.ts — Controles Livres Touch, Mouse e Teclado
// V8 Fase 2: Movimento horizontal 100% livre, fluido e contínuo (zero pulinhos)
// ──────────────────────────────────────────────────────────────────────────────
import { RefObject, useEffect } from 'react'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export function useSteeringInput(canvasRef: RefObject<HTMLCanvasElement | null>): void {
  const setSteeringX = useLogicBattleStore((s) => s.setSteeringX)
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
            state.snapshot.phase === 'CALM_WAIT' ||
            state.snapshot.phase === 'BATTLE')
        ) {
          let dir = 0
          if (heldDirs.has('left')) dir -= 1
          if (heldDirs.has('right')) dir += 1
          if (dir !== 0) {
            const nextX = Math.max(
              -0.96,
              Math.min(0.96, state.snapshot.laneX + dir * 1.65 * dtSec),
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
      if (phase !== 'RUNNING' && phase !== 'CALM_WAIT' && phase !== 'BATTLE') return

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        heldDirs.add('left')
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        heldDirs.add('right')
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
  }, [chooseLaneAndAdvance, setSteeringX])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const stageEl = el.parentElement ?? el

    let isDragging = false
    let downOnGateChoice = false
    let downClientX = 0

    const mapClientX = (clientX: number) => {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return
      const rel = (clientX - rect.left) / rect.width
      const targetNormX = Math.max(-0.96, Math.min(0.96, (rel - 0.5) * 2.1))
      setSteeringX(targetNormX)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      const rect = el.getBoundingClientRect()
      if (rect.height <= 0) return
      const relY = (e.clientY - rect.top) / rect.height
      // Faixa superior do céu (26%) reservada para órbita da câmera 3D
      if (relY < 0.26) return

      const targetEl = e.target as HTMLElement | null
      if (targetEl) {
        const btn = targetEl.closest('button')
        if (btn) {
          if (btn.classList.contains('lb-gate-choice-btn')) {
            if (btn.closest('.is-visible-pills')) {
              downOnGateChoice = true
              downClientX = e.clientX
              return
            }
          } else {
            // Ignorar cliques nos botões da bússola 3D, Luneta e Bônus Matemático
            return
          }
        }
      }

      isDragging = true
      downOnGateChoice = false
      mapClientX(e.clientX)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (downOnGateChoice && Math.abs(e.clientX - downClientX) > 6) {
        isDragging = true
        downOnGateChoice = false
      }
      if (!isDragging) return
      mapClientX(e.clientX)
    }

    const onPointerUp = () => {
      isDragging = false
      downOnGateChoice = false
    }

    stageEl.addEventListener('pointerdown', onPointerDown)
    stageEl.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      stageEl.removeEventListener('pointerdown', onPointerDown)
      stageEl.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [canvasRef, setSteeringX])
}
