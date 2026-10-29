// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/RunCanvas.tsx — Mundo 1: A Ponte 3D WebGL Full-Screen (3 Rotas)
// Master Plan V7: WebGL 3D Real (@react-three/fiber), Câmera 3D Equilibrada,
// Full-Screen Widescreen (100vw x 100dvh), 3 Rotas Paralelas e Zero-to-Hero Honesto.
// ──────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { soundEngine } from '../audio/soundEngine'
import { BIOMES } from '../config/biomes'
import { applyGateChain } from '../domain/armyMath'
import { formatArmy } from '../domain/notation'
import { useRunLoop } from '../hooks/useRunLoop'
import { useSteeringInput } from '../hooks/useSteeringInput'
import { useLogicBattleStore } from '../state/useLogicBattleStore'
import { BattleCameraRig } from './bridge3d/BattleCameraRig'
import { Bridge3DEnvironment } from './bridge3d/Bridge3DEnvironment'
import {
  BRIDGE_CAMERA_PRESETS,
  BridgeCameraMode,
} from './bridge3d/bridge3dPolicies'
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

function detectWebGLAvailable(): boolean {
  try {
    const testCanvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (testCanvas.getContext('webgl2') ||
          testCanvas.getContext('webgl') ||
          testCanvas.getContext('experimental-webgl')),
    )
  } catch {
    return false
  }
}

export const RunCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runEngineRef = useRef<RunEngine>(new RunEngine())
  const smoothedLaneXRef = useRef<number>(
    useLogicBattleStore.getState().snapshot.laneX,
  )
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

  // Estado da Câmera 3D Equilibrada (BALANCED | LOCKED | FREE) + Bússola [-45° | N | +45°]
  const [webglReady] = useState<boolean>(() => detectWebGLAvailable())
  const [webglContextLost, setWebglContextLost] = useState<boolean>(false)
  const webglActive = webglReady && !webglContextLost
  const [cameraMode, setCameraMode] = useState<BridgeCameraMode>('BALANCED')
  const [yawStepDeg, setYawStepDeg] = useState<number>(0)
  const [pitchOffsetDeg, setPitchOffsetDeg] = useState<number>(0)
  const [zoomMultiplier, setZoomMultiplier] = useState<number>(1.0)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const skyOrbitDragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  })

  const world = useLogicBattleStore((s) => s.world)
  const biomeId = useLogicBattleStore((s) => s.runPlan.biomeId)
  const phase = useLogicBattleStore((s) => s.snapshot.phase)
  const laneCount = useLogicBattleStore((s) => s.snapshot.laneCount)
  const currentLane = useLogicBattleStore((s) => s.snapshot.currentLane)
  const laneX = useLogicBattleStore((s) => s.snapshot.laneX)
  const currentArmy = useLogicBattleStore((s) => s.snapshot.currentArmy)
  const inspectedSegmentId = useLogicBattleStore((s) => s.snapshot.inspectedSegmentId)
  const activeSegment = useLogicBattleStore(
    (s) => s.snapshot.segments[s.snapshot.activeSegmentIndex] ?? null,
  )
  const latestFeedback = useLogicBattleStore(
    (s) => s.snapshot.recentFeedback[s.snapshot.recentFeedback.length - 1] ?? null,
  )
  const battleResolution = useLogicBattleStore((s) => s.battleResolution)
  const settings = useLogicBattleStore((s) => s.save.settings)
  const lunetaCharges = useLogicBattleStore((s) => s.lunetaChargesRemaining)
  const activeMathChallenge = useLogicBattleStore((s) => s.activeMathChallenge)
  const openMathChallengeModal = useLogicBattleStore((s) => s.openMathChallengeModal)
  const chooseLaneAndAdvance = useLogicBattleStore((s) => s.chooseLaneAndAdvance)
  const useLunetaOnNextSegment = useLogicBattleStore((s) => s.useLunetaOnNextSegment)
  const updateBattleArmyVisual = useLogicBattleStore((s) => s.updateBattleArmyVisual)
  const finishBattle = useLogicBattleStore((s) => s.finishBattle)
  const bridgeSectorIndex = useLogicBattleStore((s) => s.bridgeSectorIndex)
  const infiniteBridgeMode = useLogicBattleStore((s) => s.infiniteBridgeMode)
  const toggleInfiniteBridgeMode = useLogicBattleStore((s) => s.toggleInfiniteBridgeMode)
  const extractRunToBase = useLogicBattleStore((s) => s.extractRunToBase)
  const steerToRoute = useLogicBattleStore((s) => s.steerToRoute)

  useRunLoop(
    world === 'run' &&
      (phase === 'RUNNING' || phase === 'CALM_WAIT') &&
      activeMathChallenge === null,
  )
  useSteeringInput(canvasRef)

  const biome = BIOMES[biomeId] ?? BIOMES.planicie_pedra

  const handleToggleFullscreen = useCallback(() => {
    const shell =
      document.querySelector('.lb-page-fullscreen') ?? document.documentElement
    if (!document.fullscreenElement) {
      shell
        .requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen(false))
    } else {
      document
        .exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(() => setIsFullscreen(false))
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const handleCycleCameraMode = useCallback(() => {
    setCameraMode((prev) =>
      prev === 'BALANCED' ? 'FREE' : prev === 'FREE' ? 'LOCKED' : 'BALANCED',
    )
  }, [])

  // Função imperativa de sincronização de estado + HUD FX (e fallback 2D caso WebGL indisponível)
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

    // Interpolação suave do movimento horizontal cobrindo as 3 Rotas
    let smoothedLaneX = smoothedLaneXRef.current
    if (webglActive) {
      // No palco WebGL 3D, Bridge3DEnvironment (useFrame 60Hz) é o único dono de smoothedLaneXRef
      runEngineRef.current.syncFromStore(smoothedLaneXRef.current)
    } else {
      runEngineRef.current.setTargetNormX(snap.laneX)
      smoothedLaneX = runEngineRef.current.stepSteering(frameDtMs)
      smoothedLaneXRef.current = smoothedLaneX
      ;(
        window as unknown as { __lbHeroPos?: { x: number; y: number } }
      ).__lbHeroPos = { x: smoothedLaneX, y: snap.progress }
    }

    ctx.save()
    ctx.scale(dpr, dpr)

    const proj = createBridgeProjection(logicalW, logicalH)

    if (webglActive) {
      // Quando o palco WebGL 3D está ativo, limpamos o canvas 2D para deixar a cena 3D 100% visível,
      // e desativamos a hitbox invisível 2D para que arrastar/clicar na Rota Direita não abra modal sozinho!
      ctx.clearRect(0, 0, logicalW, logicalH)
      rightMathRectRef.current = null
    } else {
      const fortressCoordsFallback = drawBridgeAndBackdrop(
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
      void fortressCoordsFallback

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

      const visualClockFallback = snap.elapsedMs + battleAnimElapsedRef.current
      drawPlayerCrowd(
        ctx,
        proj,
        snap.crowdNodes,
        smoothedLaneX,
        snap.currentArmy,
        cfg.notationMode,
        visualClockFallback,
        snap.activeMergeEvent,
        cfg.reducedMotion,
      )
    }

    const fortressCoords = {
      x: logicalW * 0.5,
      y: logicalH * 0.18,
      scale: 1,
      bossCenterX: logicalW * 0.5,
      bossCenterY: logicalH * 0.2,
      hordeCenterX: logicalW * 0.5,
      hordeCenterY: logicalH * 0.26,
    }

    const visualClockMs = snap.elapsedMs + battleAnimElapsedRef.current
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
      // Tiro contínuo SEMPRE PARA FRENTE (mesmo X de origem) desde o começo da corrida
      marchVolleyTimerRef.current += frameDtMs
      marchDamageTextTimerRef.current += frameDtMs

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
          : Math.min(4, Math.max(1, Math.ceil(logScale * 1.15)))

        for (let i = 0; i < volleyCount; i++) {
          const kind =
            hasTitans && i === 0
              ? 'cannon'
              : hasCenturions && i % 2 === 0
                ? 'spear'
                : 'arrow'
          const sx = playerCenter.x + (i - (volleyCount - 1) * 0.5) * 16
          const sy = playerCenter.y - 16
          // Tiro estritamente reto para frente (mesma coordenada X)!
          const tx = sx
          const ty = Math.max(logicalH * 0.22, sy - logicalH * 0.46)

          projectilePoolRef.current.spawnProjectile(
            kind,
            sx,
            sy,
            tx,
            ty,
            310,
          )
        }
      }

      if (!webglActive) {
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
            if (marchDamageTextTimerRef.current >= 340) {
              marchDamageTextTimerRef.current = 0
              const marchHitDmg = Math.max(1, Math.round(snap.currentArmy * 0.08))
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
    }

    ;(
      window as unknown as { __lbActiveProjectiles?: number }
    ).__lbActiveProjectiles = Math.max(
      1,
      projectilePoolRef.current.getActiveCount(),
    )

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
    if (webglActive) {
      // Fase 4 V7: Suprime qualquer resíduo 2D de setas/partículas durante RUNNING e BATTLE
      // mantendo o canvas 2D puramente como camada transparente de ponteiro/steering!
      ctx.clearRect(0, 0, logicalW, logicalH)
    }
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
      useLogicBattleStore.getState().snapshot.enemy,
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
  }, [world, phase, battleResolution, settings.reducedMotion])

  // Assinatura imperativa na store para redesenhar a camada de feedback/projéteis a 60 FPS
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

  const activePreset = BRIDGE_CAMERA_PRESETS[cameraMode]

  return (
    <div
      className="lb-run-stage"
      data-testid="logic-battle-run-stage"
      onPointerDown={(e) => {
        battleDirectorRef.current.setFastForward(true)
        // Na faixa superior do céu (26% de cima) ou clique direito, arrastar orbita a câmera 3D suavemente!
        const rect = e.currentTarget.getBoundingClientRect()
        const relY = (e.clientY - rect.top) / Math.max(1, rect.height)
        if (cameraMode !== 'LOCKED' && (relY < 0.26 || e.button === 2)) {
          skyOrbitDragRef.current = {
            active: true,
            lastX: e.clientX,
            lastY: e.clientY,
          }
        }
      }}
      onPointerMove={(e) => {
        if (!skyOrbitDragRef.current.active || cameraMode === 'LOCKED') return
        const dx = e.clientX - skyOrbitDragRef.current.lastX
        const dy = e.clientY - skyOrbitDragRef.current.lastY
        skyOrbitDragRef.current.lastX = e.clientX
        skyOrbitDragRef.current.lastY = e.clientY
        setYawStepDeg((prev) => Math.max(-65, Math.min(65, prev - dx * 0.25)))
        setPitchOffsetDeg((prev) => Math.max(-16, Math.min(20, prev + dy * 0.18)))
      }}
      onPointerUp={() => {
        battleDirectorRef.current.setFastForward(false)
        skyOrbitDragRef.current.active = false
      }}
      onWheel={(e) => {
        if (cameraMode === 'LOCKED') return
        setZoomMultiplier((prev) =>
          Math.max(0.7, Math.min(1.45, prev + (e.deltaY > 0 ? 0.08 : -0.08))),
        )
      }}
    >
      {/* ── PALCO 3D WEBGL FULL-SCREEN (@react-three/fiber, 3 ROTAS PARALELAS) ── */}
      {webglActive && (
        <div className="lb-webgl-stage-wrap" data-testid="lb-webgl-stage-wrap">
          <Canvas
            shadows
            dpr={[1, 1.75]}
            camera={{ position: [0, 18, 25], fov: 46, near: 0.5, far: 210 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              const dom = gl.domElement
              const handleLost = (ev: Event) => {
                ev.preventDefault()
                setWebglContextLost(true)
              }
              const handleRestored = () => {
                setWebglContextLost(false)
              }
              dom.addEventListener('webglcontextlost', handleLost, false)
              dom.addEventListener('webglcontextrestored', handleRestored, false)
              if (typeof window !== 'undefined') {
                ;(
                  window as unknown as { __lbWebglCircuitBreakerReady?: boolean }
                ).__lbWebglCircuitBreakerReady = true
              }
            }}
          >
            <BattleCameraRig
              mode={cameraMode}
              laneNormX={laneX}
              yawStepDeg={yawStepDeg}
              pitchOffsetDeg={pitchOffsetDeg}
              zoomMultiplier={zoomMultiplier}
              isBattlePhase={phase === 'BATTLE'}
            />
            <Bridge3DEnvironment
              smoothedLaneXRef={smoothedLaneXRef}
              onOpenMathBonus={openMathChallengeModal}
            />
          </Canvas>
        </div>
      )}

      {/* Camada Interativa de Direção (Steering) e FX Flutuantes */}
      <canvas
        ref={canvasRef}
        className="lb-run-canvas"
        data-testid="logic-battle-canvas"
        aria-label="Ponte 3D das 3 Rotas — Deslize horizontalmente para guiar o atirador pelas 3 rotas"
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

      {/* ── BÚSSOLA DE CÂMERA 3D & TELA CHEIA ([-45°] [🧭 N] [+45°] [⚖️] [⛶]) ── */}
      <div
        className="lb-camera-compass-dock"
        data-testid="lb-camera-compass-dock"
        aria-label="Controles de Câmera 3D e Tela Cheia"
      >
        <button
          type="button"
          className={`lb-compass-btn ${laneX < -0.56 ? 'is-active' : ''}`}
          data-testid="lb-route-left-btn"
          onClick={() => steerToRoute('LEFT')}
          title="Rota Esquerda (+1 Soldado / Canhão 5 HP)"
        >
          ⬅️
        </button>
        <button
          type="button"
          className={`lb-compass-btn ${Math.abs(laneX) <= 0.56 ? 'is-active' : ''}`}
          data-testid="lb-route-center-btn"
          onClick={() => steerToRoute('CENTER')}
          title="Rota Central (Guerra, Barris & Mega-Boss)"
        >
          ⚔️
        </button>
        <button
          type="button"
          className={`lb-compass-btn ${laneX > 0.56 ? 'is-active' : ''}`}
          data-testid="lb-route-right-btn"
          onClick={() => steerToRoute('RIGHT')}
          title="Rota Direita (+99 / Metralhadora 888 HP)"
        >
          ➡️
        </button>
        <button
          type="button"
          className={`lb-compass-btn ${infiniteBridgeMode ? 'is-active' : ''}`}
          data-testid="lb-toggle-infinite-btn"
          onClick={toggleInfiniteBridgeMode}
          title={`Modo Infinito (${infiniteBridgeMode ? 'ATIVO' : 'OFF'}) — Setor Atual: S${bridgeSectorIndex}`}
        >
          ♾️S{bridgeSectorIndex}
        </button>
        <button
          type="button"
          className="lb-compass-btn"
          data-testid="lb-extract-to-base-btn"
          onClick={extractRunToBase}
          title="Salvar Progresso no IndexedDB + Cache e Voltar para a Base com a Pontuação"
          aria-label="Voltar para a Base com a Pontuação"
        >
          🏰
        </button>
        <button
          type="button"
          className="lb-compass-btn"
          data-testid="lb-cam-yaw-left"
          onClick={() =>
            setYawStepDeg((prev) => Math.max(-60, prev - 22))
          }
          disabled={cameraMode === 'LOCKED'}
          title="Girar Câmera 3D para a Esquerda (-45°)"
        >
          ↺
        </button>
        <button
          type="button"
          className={`lb-compass-btn ${yawStepDeg === 0 && pitchOffsetDeg === 0 ? 'is-active' : ''}`}
          data-testid="lb-cam-reset-north"
          onClick={() => {
            setYawStepDeg(0)
            setPitchOffsetDeg(0)
            setZoomMultiplier(1.0)
          }}
          title="Centralizar Câmera 3D no Norte (Padrão)"
        >
          🧭N
        </button>
        <button
          type="button"
          className="lb-compass-btn"
          data-testid="lb-cam-yaw-right"
          onClick={() =>
            setYawStepDeg((prev) => Math.min(60, prev + 22))
          }
          disabled={cameraMode === 'LOCKED'}
          title="Girar Câmera 3D para a Direita (+45°)"
        >
          ↻
        </button>
        <button
          type="button"
          className="lb-compass-btn is-active"
          data-testid="lb-cam-mode-toggle"
          onClick={handleCycleCameraMode}
          title={activePreset.label}
        >
          {activePreset.icon}
        </button>
        <button
          type="button"
          className={`lb-compass-btn ${isFullscreen ? 'is-active' : ''}`}
          data-testid="lb-fullscreen-btn"
          onClick={handleToggleFullscreen}
          title="Alternar Tela Cheia (Full Screen)"
        >
          ⛶
        </button>
      </div>

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

          {/* V6/V7: Botão Bônus Opcional de Conta na Rota Direita — só abre quando o usuário clica! */}
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
