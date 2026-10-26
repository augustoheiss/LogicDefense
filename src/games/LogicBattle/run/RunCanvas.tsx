// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/RunCanvas.tsx — Mundo 1: A Ponte dos Portões (Canvas 2D Full-Screen)
// Fiel ao conceito: master-plan/conceitos/mundo1_ponte_conceito.jpg
// ──────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react'
import { soundEngine } from '../audio/soundEngine'
import { BIOMES } from '../config/biomes'
import { applyGateChain } from '../domain/armyMath'
import { formatArmy } from '../domain/notation'
import { useRunLoop } from '../hooks/useRunLoop'
import { useSteeringInput } from '../hooks/useSteeringInput'
import { useLogicBattleStore } from '../state/useLogicBattleStore'
import { BattleDirector } from './engine/battleDirector'
import { RunEngine } from './engine/runEngine'
import { FortressRenderState } from './renderer/battleRenderer'
import { drawPlayerCrowd } from './renderer/crowdRenderer'
import { ParticlePool } from './renderer/fxParticles'
import { drawBridgeAndBackdrop, drawSegmentsOnBridge } from './renderer/gateRenderer'
import { createBridgeProjection, projectBridgePoint } from './renderer/perspective'
import { ProjectilePool } from './renderer/projectilePool'
import { getActiveSegment } from './runSimulation'

export const RunCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runEngineRef = useRef<RunEngine>(new RunEngine())
  const particlePoolRef = useRef<ParticlePool>(new ParticlePool())
  const projectilePoolRef = useRef<ProjectilePool>(new ProjectilePool())
  const battleDirectorRef = useRef<BattleDirector>(new BattleDirector())
  const battleRenderStateRef = useRef<FortressRenderState | undefined>(undefined)
  const lastBattlePerfRef = useRef<number | null>(null)
  const lastBattleDtRef = useRef<number>(16)
  const lastFeedbackIdRef = useRef<string | null>(null)
  const [battleTick, setBattleTick] = useState(0)

  const world = useLogicBattleStore((s) => s.world)
  const runPlan = useLogicBattleStore((s) => s.runPlan)
  const snapshot = useLogicBattleStore((s) => s.snapshot)
  const battleResolution = useLogicBattleStore((s) => s.battleResolution)
  const settings = useLogicBattleStore((s) => s.save.settings)
  const lunetaCharges = useLogicBattleStore((s) => s.lunetaChargesRemaining)
  const chooseLaneAndAdvance = useLogicBattleStore((s) => s.chooseLaneAndAdvance)
  const useLunetaOnNextSegment = useLogicBattleStore((s) => s.useLunetaOnNextSegment)
  const updateBattleArmyVisual = useLogicBattleStore((s) => s.updateBattleArmyVisual)
  const finishBattle = useLogicBattleStore((s) => s.finishBattle)

  useRunLoop(world === 'run' && snapshot.phase === 'RUNNING')
  useSteeringInput(canvasRef)

  const activeSegment = getActiveSegment(snapshot)
  const biome = BIOMES[runPlan.biomeId] ?? BIOMES.planicie_pedra

  // Inicializar e animar o Combate Visível (Fase 'BATTLE') com delta-time real
  useEffect(() => {
    if (world !== 'run' || snapshot.phase !== 'BATTLE' || !battleResolution) {
      battleRenderStateRef.current = undefined
      lastBattlePerfRef.current = null
      battleDirectorRef.current.stop(projectilePoolRef.current)
      return
    }

    battleDirectorRef.current.start(
      battleResolution,
      snapshot.enemy,
      settings.reducedMotion,
      projectilePoolRef.current,
    )
    lastBattlePerfRef.current = performance.now()

    let rafId = 0

    const stepBattleFrame = (now: number) => {
      if (lastBattlePerfRef.current !== null) {
        lastBattleDtRef.current = Math.min(64, Math.max(4, now - lastBattlePerfRef.current))
      }
      lastBattlePerfRef.current = now
      setBattleTick((v) => (v + 1) % 1000000)
      rafId = window.requestAnimationFrame(stepBattleFrame)
    }

    rafId = window.requestAnimationFrame(stepBattleFrame)
    return () => {
      window.cancelAnimationFrame(rafId)
      lastBattlePerfRef.current = null
    }
  }, [world, snapshot.phase, battleResolution, snapshot.enemy, settings.reducedMotion])

  // Renderização principal do Canvas 2D
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    const logicalW = Math.max(320, Math.round(rect.width || 420))
    const logicalH = Math.max(420, Math.round(rect.height || 680))

    if (canvas.width !== logicalW * dpr || canvas.height !== logicalH * dpr) {
      canvas.width = logicalW * dpr
      canvas.height = logicalH * dpr
    }

    // Interpolação suave do movimento horizontal via RunEngine
    runEngineRef.current.setTargetNormX(snapshot.laneX)
    const smoothedLaneX = runEngineRef.current.stepSteering(16)

    ctx.save()
    ctx.scale(dpr, dpr)

    const proj = createBridgeProjection(logicalW, logicalH)

    const fortressCoords = drawBridgeAndBackdrop(
      ctx,
      proj,
      biome,
      snapshot.laneCount,
      snapshot.progress,
      snapshot.enemy,
      settings.notationMode,
      battleRenderStateRef.current,
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
      smoothedLaneX,
      snapshot.currentArmy,
      settings.notationMode,
      snapshot.elapsedMs + battleTick * 16,
      snapshot.activeMergeEvent,
      settings.reducedMotion,
    )

    // Se estiver na fase BATTLE, atualiza projéteis, horda e chefe com delta-time real
    if (snapshot.phase === 'BATTLE') {
      const playerCenter = projectBridgePoint(proj, smoothedLaneX * 0.34, 0.05)
      const realDt = lastBattleDtRef.current
      battleRenderStateRef.current = battleDirectorRef.current.stepAndDraw(
        ctx,
        realDt,
        { x: playerCenter.x, y: playerCenter.y },
        fortressCoords,
        snapshot.crowdNodes,
        settings.notationMode,
        settings.reducedMotion,
        projectilePoolRef.current,
        particlePoolRef.current,
        snapshot.elapsedMs + battleTick * 16,
        {
          onArmyUpdate: (newArmy, splitEvent) => {
            updateBattleArmyVisual(newArmy, splitEvent)
          },
          onVolleySound: (kind) => {
            soundEngine.playGatePass(kind === 'cannon' ? 1000 : 10, true)
          },
          onBattleFinished: () => {
            finishBattle()
          },
        },
      )
    }

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
  }, [
    biome,
    settings.notationMode,
    settings.reducedMotion,
    snapshot,
    battleTick,
    updateBattleArmyVisual,
    finishBattle,
  ])

  const latestFeedback = snapshot.recentFeedback[snapshot.recentFeedback.length - 1]
  const showVisibleTapPills = Boolean(settings.simpleTapMode)
  const lanesForTap =
    activeSegment?.lanes ??
    Array.from({ length: snapshot.laneCount }, () => [])

  return (
    <div
      className="lb-run-stage"
      data-testid="logic-battle-run-stage"
      onPointerDown={() => {
        if (snapshot.phase === 'BATTLE') {
          battleDirectorRef.current.setFastForward(true)
        }
      }}
      onPointerUp={() => {
        if (snapshot.phase === 'BATTLE') {
          battleDirectorRef.current.setFastForward(false)
        }
      }}
    >
      <canvas
        ref={canvasRef}
        className="lb-run-canvas"
        data-testid="logic-battle-canvas"
        aria-label="Ponte dos Portões Matemáticos — Deslize para guiar o exército"
      />

      {/* Pop-up flutuante compacto de feedback (+99, Gêmeos, Vai-Um) */}
      {latestFeedback && (
        <div
          key={latestFeedback.id}
          className={`lb-floating-feedback lb-tone-${latestFeedback.tone}`}
          data-testid="lb-floating-feedback"
        >
          <span className="lb-fb-main">{latestFeedback.text}</span>
        </div>
      )}

      {/* Pílula compacta de Fusão Vai-Um / Empresta-Um */}
      {snapshot.activeMergeEvent &&
        snapshot.elapsedMs - snapshot.activeMergeEvent.startedAtMs < 1800 && (
          <div className="lb-vai-um-banner" data-testid="lb-vai-um-banner">
            <strong>{snapshot.activeMergeEvent.formulaLabel}</strong>
          </div>
        )}

      {/* Camada Tática Flutuante Minimalista (Luneta + Zonas de Toque nas Faixas) */}
      <div className="lb-tactical-dock" data-testid="lb-tactical-dock">
        <div
          className={`lb-lane-choice-grid lb-lanes-${snapshot.laneCount} ${
            showVisibleTapPills ? 'is-visible-pills' : 'is-transparent-hitboxes'
          }`}
          data-testid="lb-lane-choice-grid"
        >
          {lanesForTap.map((laneGates, laneIdx) => {
            const primary = laneGates[0]
            const isSelected = snapshot.currentLane === laneIdx
            const isInspected =
              Boolean(activeSegment) &&
              snapshot.inspectedSegmentId === activeSegment?.id
            const previewVal =
              isInspected && activeSegment
                ? applyGateChain(snapshot.currentArmy, laneGates)
                : null

            return (
              <button
                key={`lane_tap_${laneIdx}`}
                type="button"
                data-testid={`lb-gate-choice-${laneIdx}`}
                className={`lb-gate-choice-btn ${isSelected ? 'is-selected' : ''}`}
                onClick={() => chooseLaneAndAdvance(laneIdx)}
                aria-label={`Escolher faixa ${laneIdx + 1}: ${primary?.label ?? ''}`}
              >
                {showVisibleTapPills && (
                  <strong className="lb-gate-choice-label">
                    {primary?.label ?? `F${laneIdx + 1}`}
                  </strong>
                )}
                {previewVal !== null && (
                  <span
                    className="lb-gate-luneta-preview"
                    data-testid={`lb-gate-luneta-preview-${laneIdx}`}
                  >
                    ={formatArmy(previewVal, settings.notationMode)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Botão flutuante da Luneta Tática (apenas ícone + carga) */}
        <button
          type="button"
          className="lb-luneta-fab"
          data-testid="lb-luneta-btn"
          onClick={useLunetaOnNextSegment}
          disabled={
            lunetaCharges <= 0 ||
            !activeSegment ||
            snapshot.inspectedSegmentId === activeSegment.id
          }
          title="Luneta Tática (revela o resultado dos próximos portões)"
          aria-label="Usar Luneta Tática"
        >
          <span>🔭</span>
          <small>{lunetaCharges}</small>
        </button>
      </div>
    </div>
  )
}
