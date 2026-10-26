// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/RunCanvas.tsx — Mundo 1: A Ponte dos Portões (Canvas 2D)
// ──────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react'
import { BIOMES } from '../config/biomes'
import { applyGateChain } from '../domain/armyMath'
import { formatArmy } from '../domain/notation'
import { useRunLoop } from '../hooks/useRunLoop'
import { useSteeringInput } from '../hooks/useSteeringInput'
import { useLogicBattleStore } from '../state/useLogicBattleStore'
import { drawPlayerCrowd } from './renderer/crowdRenderer'
import { ParticlePool } from './renderer/fxParticles'
import { drawBridgeAndBackdrop, drawSegmentsOnBridge } from './renderer/gateRenderer'
import { createBridgeProjection } from './renderer/perspective'
import { getActiveSegment } from './runSimulation'

export const RunCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlePoolRef = useRef<ParticlePool>(new ParticlePool())
  const lastFeedbackIdRef = useRef<string | null>(null)

  const world = useLogicBattleStore((s) => s.world)
  const runPlan = useLogicBattleStore((s) => s.runPlan)
  const snapshot = useLogicBattleStore((s) => s.snapshot)
  const settings = useLogicBattleStore((s) => s.save.settings)
  const lunetaCharges = useLogicBattleStore((s) => s.lunetaChargesRemaining)
  const chooseLaneAndAdvance = useLogicBattleStore((s) => s.chooseLaneAndAdvance)
  const stepLane = useLogicBattleStore((s) => s.stepLane)
  const useLunetaOnNextSegment = useLogicBattleStore((s) => s.useLunetaOnNextSegment)

  useRunLoop(world === 'run' && snapshot.phase === 'RUNNING')
  useSteeringInput(canvasRef)

  const activeSegment = getActiveSegment(snapshot)
  const biome = BIOMES[runPlan.biomeId] ?? BIOMES.planicie_pedra

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    const logicalW = Math.max(320, Math.round(rect.width || 480))
    const logicalH = Math.max(360, Math.round(rect.height || 520))

    if (canvas.width !== logicalW * dpr || canvas.height !== logicalH * dpr) {
      canvas.width = logicalW * dpr
      canvas.height = logicalH * dpr
    }

    ctx.save()
    ctx.scale(dpr, dpr)

    const proj = createBridgeProjection(logicalW, logicalH)

    drawBridgeAndBackdrop(
      ctx,
      proj,
      biome,
      snapshot.laneCount,
      snapshot.progress,
      snapshot.enemy,
      settings.notationMode,
    )

    drawSegmentsOnBridge(
      ctx,
      proj,
      snapshot.segments,
      snapshot.resolvedSegments,
      snapshot.progress,
      snapshot.laneCount,
      snapshot.currentArmy,
      snapshot.inspectedSegmentId,
      settings.notationMode,
    )

    drawPlayerCrowd(
      ctx,
      proj,
      snapshot.crowdNodes,
      snapshot.laneX,
      snapshot.currentArmy,
      settings.notationMode,
      snapshot.elapsedMs,
      snapshot.activeMergeEvent,
      settings.reducedMotion,
    )

    const latestFb = snapshot.recentFeedback[snapshot.recentFeedback.length - 1]
    if (latestFb && latestFb.id !== lastFeedbackIdRef.current) {
      lastFeedbackIdRef.current = latestFb.id
      const color =
        latestFb.tone === 'twins'
          ? '#a855f7'
          : latestFb.tone === 'trap'
            ? '#facc15'
            : '#34d399'
      particlePoolRef.current.spawnBurst(
        logicalW * 0.5,
        logicalH * 0.72,
        color,
        16,
        settings.reducedMotion,
      )
    }

    particlePoolRef.current.updateAndDraw(ctx, 16)
    ctx.restore()
  }, [biome, settings.notationMode, settings.reducedMotion, snapshot])

  const latestFeedback = snapshot.recentFeedback[snapshot.recentFeedback.length - 1]

  return (
    <div className="lb-run-stage" data-testid="logic-battle-run-stage">
      <canvas
        ref={canvasRef}
        className="lb-run-canvas"
        data-testid="logic-battle-canvas"
        aria-label="Ponte dos Portões Matemáticos — Deslize para guiar o exército"
      />

      {/* Feedback flutuante recente */}
      {latestFeedback && (
        <div
          key={latestFeedback.id}
          className={`lb-floating-feedback lb-tone-${latestFeedback.tone}`}
          data-testid="lb-floating-feedback"
        >
          <span className="lb-fb-main">{latestFeedback.text}</span>
          {latestFeedback.subText && (
            <span className="lb-fb-sub">{latestFeedback.subText}</span>
          )}
        </div>
      )}

      {/* Banner de Fusão Vai-Um quando ocorre agrupamento de base 10 */}
      {snapshot.activeMergeEvent &&
        snapshot.elapsedMs - snapshot.activeMergeEvent.startedAtMs < 2400 && (
          <div className="lb-vai-um-banner" data-testid="lb-vai-um-banner">
            <span className="lb-vai-um-badge">✨ FUSÃO VAI-UM</span>
            <strong>{snapshot.activeMergeEvent.formulaLabel}</strong>
          </div>
        )}

      {/* Barra Tática Inferior: Seleção Direta dos Portões do Segmento Ativo + Luneta */}
      <div className="lb-tactical-dock" data-testid="lb-tactical-dock">
        <div className="lb-dock-header">
          <span className="lb-dock-step">
            Portão {Math.min(snapshot.activeSegmentIndex + 1, snapshot.segments.length)} de{' '}
            {snapshot.segments.length}
            {activeSegment?.showDetectorWarning && (
              <span className="lb-detector-pill" data-testid="lb-detector-pill">
                ⚠ Detector: Cuidado com a Pegadinha!
              </span>
            )}
          </span>

          <button
            type="button"
            className="lb-luneta-btn"
            data-testid="lb-luneta-btn"
            onClick={useLunetaOnNextSegment}
            disabled={
              lunetaCharges <= 0 ||
              !activeSegment ||
              snapshot.inspectedSegmentId === activeSegment.id
            }
            title="Usar Luneta da Forja para revelar o resultado exato dos portões à frente"
          >
            🔭 Luneta ({lunetaCharges})
          </button>
        </div>

        {activeSegment && (
          <div
            className={`lb-lane-choice-grid lb-lanes-${snapshot.laneCount}`}
            data-testid="lb-lane-choice-grid"
          >
            {activeSegment.lanes.map((laneGates, laneIdx) => {
              const primary = laneGates[0]
              const isSelected = snapshot.currentLane === laneIdx
              const isRedemptionGate = Boolean(primary?.id.startsWith('redemption_gate_'))
              const isInspected = snapshot.inspectedSegmentId === activeSegment.id
              const previewVal = isInspected
                ? applyGateChain(snapshot.currentArmy, laneGates)
                : null
              const gateText =
                activeSegment.kind === 'conveyor' && laneGates.length > 1
                  ? `${laneGates.length}× [${primary?.label ?? ''}]`
                  : activeSegment.kind === 'chain' && laneGates.length > 1
                    ? laneGates.map((g) => g.label).join(' → ')
                    : primary?.label ?? '+'

              return (
                <button
                  key={`${activeSegment.id}_lane_${laneIdx}`}
                  type="button"
                  data-testid={`lb-gate-choice-${laneIdx}`}
                  className={`lb-gate-choice-btn ${isSelected ? 'is-selected' : ''} ${
                    isRedemptionGate ? 'is-redemption' : ''
                  }`}
                  onClick={() => chooseLaneAndAdvance(laneIdx)}
                >
                  <span className="lb-gate-lane-tag">
                    Faixa {laneIdx + 1} {isSelected ? '●' : ''}
                  </span>
                  <strong className="lb-gate-choice-label">{gateText}</strong>
                  {previewVal !== null && (
                    <span
                      className="lb-gate-luneta-preview"
                      data-testid={`lb-gate-luneta-preview-${laneIdx}`}
                    >
                      🔭 → {formatArmy(previewVal, settings.notationMode)}
                    </span>
                  )}
                  <span className="lb-gate-choice-hint">
                    {isRedemptionGate
                      ? '★ Portão Dourado do Resgate'
                      : settings.calmMode
                        ? 'Clique para atravessar'
                        : 'Clique para cruzar agora'}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="lb-steering-bar">
          <button
            type="button"
            className="lb-steer-arrow"
            data-testid="lb-steer-left"
            onClick={() => stepLane(-1)}
            aria-label="Mover exército para a faixa da esquerda"
          >
            ◀ Esquerda
          </button>
          <span className="lb-steer-status">
            Exército: <strong>{formatArmy(snapshot.currentArmy, settings.notationMode)}</strong> ·
            Meta: <strong>{formatArmy(snapshot.enemy.totalForce, settings.notationMode)}</strong>
          </span>
          <button
            type="button"
            className="lb-steer-arrow"
            data-testid="lb-steer-right"
            onClick={() => stepLane(1)}
            aria-label="Mover exército para a faixa da direita"
          >
            Direita ▶
          </button>
        </div>
      </div>
    </div>
  )
}
