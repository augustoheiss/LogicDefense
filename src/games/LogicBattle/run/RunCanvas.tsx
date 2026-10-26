// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/RunCanvas.tsx — Mundo 1: A Ponte dos Portões (Canvas 2D Full-Screen)
// Fiel ao conceito: master-plan/conceitos/mundo1_ponte_conceito.jpg
// ──────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react'
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
import {
  drawBridgeAndBackdrop,
  drawSegmentsOnBridge,
  RightMathGateScreenRect,
} from './renderer/gateRenderer'
import { createBridgeProjection, projectBridgePoint } from './renderer/perspective'
import { ProjectilePool } from './renderer/projectilePool'

export const RunCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runEngineRef = useRef<RunEngine>(new RunEngine())
  const particlePoolRef = useRef<ParticlePool>(new ParticlePool())
  const projectilePoolRef = useRef<ProjectilePool>(new ProjectilePool())
  const battleDirectorRef = useRef<BattleDirector>(new BattleDirector())
  const battleRenderStateRef = useRef<FortressRenderState | undefined>(undefined)
  const lastBattlePerfRef = useRef<number | null>(null)
  const lastBattleDtRef = useRef<number>(16)
  const battleAnimElapsedRef = useRef<number>(0)
  const lastFramePerfRef = useRef<number | null>(null)
  const marchVolleyTimerRef = useRef<number>(180)
  const marchDamageTextTimerRef = useRef<number>(0)
  const lastFeedbackIdRef = useRef<string | null>(null)
  const rightMathRectRef = useRef<RightMathGateScreenRect | null>(null)
  const rightMathHitsRef = useRef<number>(0)
  const drawFrameRef = useRef<() => void>(() => {})

  const world = useLogicBattleStore((s) => s.world)
  const biomeId = useLogicBattleStore((s) => s.runPlan.biomeId)
  const phase = useLogicBattleStore((s) => s.snapshot.phase)
  const laneCount = useLogicBattleStore((s) => s.snapshot.laneCount)
  const currentLane = useLogicBattleStore((s) => s.snapshot.currentLane)
  const currentArmy = useLogicBattleStore((s) => s.snapshot.currentArmy)
  const inspectedSegmentId = useLogicBattleStore((s) => s.snapshot.inspectedSegmentId)
  const activeSegment = useLogicBattleStore(
    (s) => s.snapshot.segments[s.snapshot.activeSegmentIndex] ?? null,
  )
  const latestFeedback = useLogicBattleStore(
    (s) => s.snapshot.recentFeedback[s.snapshot.recentFeedback.length - 1] ?? null,
  )
  const enemy = useLogicBattleStore((s) => s.snapshot.enemy)
  const battleResolution = useLogicBattleStore((s) => s.battleResolution)
  const settings = useLogicBattleStore((s) => s.save.settings)
  const lunetaCharges = useLogicBattleStore((s) => s.lunetaChargesRemaining)
  const activeMathChallenge = useLogicBattleStore((s) => s.activeMathChallenge)
  const openMathChallengeModal = useLogicBattleStore((s) => s.openMathChallengeModal)
  const chooseLaneAndAdvance = useLogicBattleStore((s) => s.chooseLaneAndAdvance)
  const useLunetaOnNextSegment = useLogicBattleStore((s) => s.useLunetaOnNextSegment)
  const updateBattleArmyVisual = useLogicBattleStore((s) => s.updateBattleArmyVisual)
  const finishBattle = useLogicBattleStore((s) => s.finishBattle)

  useRunLoop(world === 'run' && phase === 'RUNNING' && activeMathChallenge === null)
  useSteeringInput(canvasRef)

  const biome = BIOMES[biomeId] ?? BIOMES.planicie_pedra

  // Função imperativa de desenho do Canvas 2D (zero re-render React por frame)
  drawFrameRef.current = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const liveState = useLogicBattleStore.getState()
    const snap = liveState.snapshot
    const cfg = liveState.save.settings
    const liveBiome = BIOMES[liveState.runPlan.biomeId] ?? BIOMES.planicie_pedra

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    const logicalW = Math.max(320, Math.round(rect.width || 420))
    const logicalH = Math.max(420, Math.round(rect.height || 680))

    if (canvas.width !== logicalW * dpr || canvas.height !== logicalH * dpr) {
      canvas.width = logicalW * dpr
      canvas.height = logicalH * dpr
    }

    const nowPerf = performance.now()
    const frameDtMs =
      lastFramePerfRef.current !== null
        ? Math.min(64, Math.max(8, nowPerf - lastFramePerfRef.current))
        : 16
    lastFramePerfRef.current = nowPerf

    // Interpolação suave do movimento horizontal via RunEngine
    runEngineRef.current.setTargetNormX(snap.laneX)
    const smoothedLaneX = runEngineRef.current.stepSteering(frameDtMs)
    ;(
      window as unknown as { __lbHeroPos?: { x: number; y: number } }
    ).__lbHeroPos = { x: smoothedLaneX, y: snap.progress }

    ctx.save()
    ctx.scale(dpr, dpr)

    const proj = createBridgeProjection(logicalW, logicalH)

    const fortressCoords = drawBridgeAndBackdrop(
      ctx,
      proj,
      liveBiome,
      snap.laneCount,
      snap.progress,
      snap.enemy,
      cfg.notationMode,
      battleRenderStateRef.current,
      snap.bridgeKills ?? 0,
    )

    rightMathRectRef.current = drawSegmentsOnBridge(
      ctx,
      proj,
      snap.segments,
      snap.resolvedSegments,
      snap.progress,
      snap.laneCount,
      snap.currentArmy,
      snap.inspectedSegmentId,
      cfg.notationMode,
      rightMathHitsRef.current,
    )

    const visualClockMs = snap.elapsedMs + battleAnimElapsedRef.current

    drawPlayerCrowd(
      ctx,
      proj,
      snap.crowdNodes,
      smoothedLaneX,
      snap.currentArmy,
      cfg.notationMode,
      visualClockMs,
      snap.activeMergeEvent,
      cfg.reducedMotion,
    )

    const playerCenter = projectBridgePoint(proj, smoothedLaneX * 0.34, 0.05)

    // Se estiver na fase BATTLE, atualiza projéteis, horda e chefe com delta-time real
    if (snap.phase === 'BATTLE') {
      const realDt = lastBattleDtRef.current
      battleRenderStateRef.current = battleDirectorRef.current.stepAndDraw(
        ctx,
        realDt,
        { x: playerCenter.x, y: playerCenter.y },
        fortressCoords,
        snap.crowdNodes,
        cfg.notationMode,
        cfg.reducedMotion,
        projectilePoolRef.current,
        particlePoolRef.current,
        visualClockMs,
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
    } else if (snap.phase === 'RUNNING' || snap.phase === 'CALM_WAIT') {
      // Tiro contínuo desde o começo da corrida (progress = 0 até 1) contra a Vanguarda Rubra e a Fortaleza
      marchVolleyTimerRef.current += frameDtMs
      marchDamageTextTimerRef.current += frameDtMs

      // §2.3: Cadência de tiro escala logaritmicamente com currentArmy
      const logScale = Math.log10(Math.max(2, snap.currentArmy))
      const dynamicCadenceMs = Math.max(85, Math.round(210 - logScale * 38))
      const volleyIntervalMs = cfg.reducedMotion ? 320 : dynamicCadenceMs
      if (
        marchVolleyTimerRef.current >= volleyIntervalMs ||
        projectilePoolRef.current.getActiveCount() === 0
      ) {
        marchVolleyTimerRef.current = 0
        const hasTitans = snap.crowdNodes.some((n) => n.tierIndex >= 2)
        const hasCenturions = snap.crowdNodes.some((n) => n.tierIndex === 1)
        const volleyCount = cfg.reducedMotion
          ? 1
          : Math.min(4, Math.max(1, Math.ceil(logScale * 1.35)))

        for (let i = 0; i < volleyCount; i++) {
          const kind =
            hasTitans && i === 0
              ? 'cannon'
              : hasCenturions && i % 2 === 0
                ? 'spear'
                : 'arrow'
          const sx = playerCenter.x + (i - (volleyCount - 1) * 0.5) * 18
          const sy = playerCenter.y - 16

          // Alterna disparos entre a Vanguarda Rubra na ponte (progress < 0.88) e o Boss/Horda
          const aimVanguard = snap.progress < 0.88 && i % 2 === 0
          const vanguardPt = projectBridgePoint(
            proj,
            (i - 1) * 0.22,
            0.39 + (i % 2) * 0.03,
          )
          const tx = aimVanguard
            ? vanguardPt.x
            : fortressCoords.bossCenterX + (Math.random() - 0.5) * 48
          const ty = aimVanguard
            ? vanguardPt.y - 14
            : fortressCoords.bossCenterY + (Math.random() - 0.5) * 18

          projectilePoolRef.current.spawnProjectile(
            kind,
            sx,
            sy,
            tx,
            ty,
            aimVanguard ? 240 : 340,
          )
        }

        // Contra-fogo inimigo na ponte (reduz lentamente o HP/exército do jogador se exposto)
        if (snap.phase === 'RUNNING' && snap.enemy.totalForce > 0 && Math.random() < 0.42) {
          const enemyOrigin = projectBridgePoint(
            proj,
            (Math.random() - 0.5) * 0.45,
            0.38,
          )
          projectilePoolRef.current.spawnProjectile(
            'enemy_bolt',
            enemyOrigin.x,
            enemyOrigin.y - 14,
            playerCenter.x + (Math.random() - 0.5) * 24,
            playerCenter.y - 10,
            260,
          )
        }
      }

      projectilePoolRef.current.updateAndDraw(
        ctx,
        frameDtMs,
        (hitX, hitY, kind) => {
          particlePoolRef.current.spawnBurst(
            hitX,
            hitY,
            kind === 'enemy_bolt'
              ? '#ef4444'
              : kind === 'cannon'
                ? '#facc15'
                : '#38bdf8',
            4,
            cfg.reducedMotion,
          )
          if (kind === 'enemy_bolt') {
            if (snap.phase === 'RUNNING' && marchDamageTextTimerRef.current >= 520) {
              marchDamageTextTimerRef.current = 0
              const attritionLoss = Math.max(1, Math.floor(snap.currentArmy * 0.015))
              projectilePoolRef.current.spawnDamageText(
                playerCenter.x,
                playerCenter.y - 24,
                `-${formatArmy(attritionLoss, cfg.notationMode)}`,
                '#f87171',
              )
              liveState.recordBridgeEnemyKill(0, 0, attritionLoss)
            }
          } else if (marchDamageTextTimerRef.current >= 320) {
            marchDamageTextTimerRef.current = 0
            const marchHitDmg = Math.max(1, Math.round(snap.currentArmy * 0.06))
            projectilePoolRef.current.spawnDamageText(
              hitX,
              hitY - 8,
              `-${formatArmy(marchHitDmg, cfg.notationMode)}`,
              kind === 'cannon' ? '#facc15' : '#bae6fd',
            )
            liveState.recordBridgeEnemyKill(2, marchHitDmg, 0)
          }
        },
      )
    }

    ;(
      window as unknown as { __lbActiveProjectiles?: number }
    ).__lbActiveProjectiles = projectilePoolRef.current.getActiveCount()

    const latestFb = snap.recentFeedback[snap.recentFeedback.length - 1]
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
        logicalH * 0.58,
        color,
        14,
        cfg.reducedMotion,
      )
    }

    particlePoolRef.current.updateAndDraw(ctx, frameDtMs)
    ctx.restore()
  }

  // Inicializar e animar o Combate Visível (Fase 'BATTLE') com delta-time real sem re-render React
  useEffect(() => {
    if (world !== 'run' || phase !== 'BATTLE' || !battleResolution) {
      battleRenderStateRef.current = undefined
      lastBattlePerfRef.current = null
      battleAnimElapsedRef.current = 0
      return
    }

    battleDirectorRef.current.start(
      battleResolution,
      enemy,
      settings.reducedMotion,
      projectilePoolRef.current,
    )
    lastBattlePerfRef.current = performance.now()
    battleAnimElapsedRef.current = 0

    let rafId = 0

    const stepBattleFrame = (now: number) => {
      if (lastBattlePerfRef.current !== null) {
        const dt = Math.min(64, Math.max(4, now - lastBattlePerfRef.current))
        lastBattleDtRef.current = dt
        battleAnimElapsedRef.current += dt
      }
      lastBattlePerfRef.current = now
      drawFrameRef.current()
      rafId = window.requestAnimationFrame(stepBattleFrame)
    }

    rafId = window.requestAnimationFrame(stepBattleFrame)
    return () => {
      window.cancelAnimationFrame(rafId)
      lastBattlePerfRef.current = null
      battleDirectorRef.current.stop(projectilePoolRef.current)
    }
  }, [world, phase, battleResolution, enemy, settings.reducedMotion])

  // Assinatura imperativa na store para redesenhar o Canvas a 60 FPS com zero re-render React por frame
  useEffect(() => {
    drawFrameRef.current()
    const unsubscribe = useLogicBattleStore.subscribe(() => {
      if (useLogicBattleStore.getState().snapshot.phase !== 'BATTLE') {
        drawFrameRef.current()
      }
    })
    return unsubscribe
  }, [])

  // Redesenhar caso mudem configurações visuais ou bioma
  useEffect(() => {
    drawFrameRef.current()
  }, [biome, settings.notationMode, settings.reducedMotion])

  const showVisibleTapPills = Boolean(settings.simpleTapMode)
  const lanesForTap =
    activeSegment?.lanes ??
    Array.from({ length: laneCount }, () => [])

  return (
    <div
      className="lb-run-stage"
      data-testid="logic-battle-run-stage"
      onPointerDown={() => {
        if (phase === 'BATTLE') {
          battleDirectorRef.current.setFastForward(true)
        }
      }}
      onPointerUp={() => {
        if (phase === 'BATTLE') {
          battleDirectorRef.current.setFastForward(false)
        }
      }}
    >
      <canvas
        ref={canvasRef}
        className="lb-run-canvas"
        data-testid="logic-battle-canvas"
        aria-label="Ponte dos Portões Matemáticos — Deslize para guiar o exército"
        onClick={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect()
          const rightAltar = rightMathRectRef.current
          if (!rect || !rightAltar) return
          const cx = e.clientX - rect.left
          const cy = e.clientY - rect.top
          if (
            cx >= rightAltar.x - 10 &&
            cx <= rightAltar.x + rightAltar.w + 10 &&
            cy >= rightAltar.y - 10 &&
            cy <= rightAltar.y + rightAltar.h + 10
          ) {
            rightMathHitsRef.current = -1
            particlePoolRef.current.spawnBurst(
              rightAltar.centerX,
              rightAltar.centerY,
              '#facc15',
              18,
              settings.reducedMotion,
            )
            projectilePoolRef.current.spawnDamageText(
              rightAltar.centerX,
              rightAltar.y - 10,
              '✨ BÔNUS DE CONTA!',
              '#fde047',
            )
            openMathChallengeModal()
          }
        }}
      />

      {/* Pop-up flutuante compacto de feedback (+99, Gêmeos) — oculto durante BATTLE */}
      {latestFeedback && phase !== 'BATTLE' && (
        <div
          key={latestFeedback.id}
          className={`lb-floating-feedback lb-tone-${latestFeedback.tone}`}
          data-testid="lb-floating-feedback"
        >
          <span className="lb-fb-main">{latestFeedback.text}</span>
        </div>
      )}

      {/* Camada Tática Flutuante Minimalista (Luneta + Zonas de Toque nas Faixas) — SIT-06: desmontada no resultado */}
      {(phase === 'RUNNING' || phase === 'CALM_WAIT' || phase === 'PAUSED') && (
        <div
          className="lb-tactical-dock"
          data-testid="lb-tactical-dock"
        >
        <div
          className={`lb-lane-choice-grid lb-lanes-${laneCount} ${
            showVisibleTapPills ? 'is-visible-pills' : 'is-transparent-hitboxes'
          }`}
          data-testid="lb-lane-choice-grid"
        >
          {lanesForTap.map((laneGates, laneIdx) => {
            const primary = laneGates[0]
            const isSelected = currentLane === laneIdx
            const isInspected =
              Boolean(activeSegment) &&
              inspectedSegmentId === activeSegment?.id
            const previewVal =
              isInspected && activeSegment
                ? applyGateChain(currentArmy, laneGates)
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
            inspectedSegmentId === activeSegment.id
          }
          title="Luneta Tática (revela o resultado dos próximos portões)"
          aria-label="Usar Luneta Tática"
        >
          <span>🔭</span>
          <small>{lunetaCharges}</small>
        </button>

        {/* V6: Botão Bônus Opcional de Conta — só abre quando o usuário clica! */}
        <button
          type="button"
          className="lb-luneta-fab"
          data-testid="lb-bridge-math-path-btn"
          onClick={() => {
            const rect = canvasRef.current?.getBoundingClientRect()
            const cx = (rect?.width ?? 420) * 0.5
            const cy = (rect?.height ?? 680) * 0.55
            particlePoolRef.current.spawnBurst(
              cx,
              cy,
              '#facc15',
              18,
              settings.reducedMotion,
            )
            projectilePoolRef.current.spawnDamageText(
              cx,
              cy - 18,
              '✨ BÔNUS DE CONTA!',
              '#fde047',
            )
            openMathChallengeModal()
          }}
          title="Bônus de Conta: Escolha Fácil, Médio, Difícil ou Problema para ganhar +Soldados, +Moedas e Buffs"
          aria-label="Fazer Conta Bônus"
          style={{
            borderColor: '#facc15',
            background:
              'linear-gradient(135deg, rgba(250, 204, 21, 0.32), rgba(168, 85, 247, 0.35))',
            color: '#fef08a',
            boxShadow: '0 0 14px rgba(250, 204, 21, 0.45)',
          }}
        >
          <span>🧮</span>
          <small>+×</small>
        </button>
      </div>
      )}
    </div>
  )
}
