// ============================================================
// LOGIC FRICTION — Main Orchestrator
// Sprint 2.5: Modular architecture + Fullscreen API + Death
// Composes all game systems into the R3F scene
// ============================================================
import { useCallback, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'

// ── Game Systems ────────────────────────────────────────────────────────────────
import { Arena, ArenaBoundary, ArenaPillars, Lighting } from './world/Arena'
import { CentralCore } from './world/CentralCore'
import { SceneryProps } from './world/SceneryProps'
import { PlayerController } from './player/PlayerController'
import { EnemyManager } from './enemies/EnemyManager'
import { TowerManager } from './towers/TowerManager'
import { MathChallenge } from './math/MathChallenge'
import { GameHUD } from './ui/GameHUD'
import { ClickPing } from './ui/ClickPing'
import { useGameStore } from './state/useGameStore'
import { CAMERA_OFFSET, PLAYER_RESPAWN_TIME } from './config/constants'
import { prewarmSpriteAtlas } from './sprites/spriteAtlasRegistry'
import { isCameraGestureActive, setLiveCameraAngles } from './hooks/useTouchCameraGate'

// ── Fullscreen helper ───────────────────────────────────────────────────────────
// Ported from Logic Invaders. Must be called synchronously inside a user-gesture
// handler — browsers require requestFullscreen() from a click/touch event.
function requestFullScreen(el: HTMLElement): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = el as any
  if (e.requestFullscreen)            { e.requestFullscreen().catch(() => {}) }
  else if (e.webkitRequestFullscreen) { e.webkitRequestFullscreen() } // Safari / iOS
  else if (e.msRequestFullscreen)     { e.msRequestFullscreen()     } // IE11
}

// ── Main Exported Component ─────────────────────────────────────────────────────
export default function LogicFriction() {
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Read isPlayerDead as a React subscription so the tree re-renders on death/respawn
  const isPlayerDead = useGameStore(s => s.isPlayerDead)

  useEffect(() => {
    prewarmSpriteAtlas()
  }, [])

  const onCreated = useCallback((state: { gl: THREE.WebGLRenderer }) => {
    state.gl.shadowMap.enabled = true
    state.gl.shadowMap.type = THREE.BasicShadowMap  // Cheapest — prevents fullscreen lag
    state.gl.toneMapping = THREE.ACESFilmicToneMapping
    state.gl.toneMappingExposure = 1.0
  }, [])

  // ── Start handler: fullscreen + startGame ──
  const handleStart = useCallback(() => {
    if (wrapperRef.current) requestFullScreen(wrapperRef.current)
    useGameStore.getState().startGame()
  }, [])

  // ── Restart handler: reset + fullscreen + startGame ──
  const handleRestart = useCallback(() => {
    useGameStore.getState().reset()
    if (wrapperRef.current) requestFullScreen(wrapperRef.current)
    useGameStore.getState().startGame()
  }, [])

  return (
    <div
      ref={wrapperRef}
      id="logic-friction-container"
      style={{
        width: '100%',
        height: '85vh',
        minHeight: '500px',
        maxHeight: '100vh',
        position: 'relative',
        background: '#050510',
        borderRadius: 12,
        overflow: 'hidden',
        touchAction: 'none',  // Prevent mobile browser from hijacking touch for scroll/pan
        margin: 0,
        padding: 0,
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}  // ⚠️ MOBILE FIX: Match retina/tablet DPI so Raycaster aligns with touch coords
        gl={{
          powerPreference: 'high-performance',
          antialias: false,
          stencil: false,
          depth: true,
        }}
        performance={{ min: 0.5 }}
        camera={{
          fov: 45,
          near: 0.1,
          far: 300,
          position: [CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z],
        }}
        onCreated={onCreated}
        resize={{ scroll: true, debounce: { scroll: 50, resize: 0 } }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, padding: 0, touchAction: 'none' }}
      >
        <color attach="background" args={['#050510']} />
        <fog attach="fog" args={['#050510', 50, 110]} />

        {/* 360° Camera — rotation gated by Settings toggle */}
        <CameraRig />
        <ClickPing />

        <Physics gravity={[0, -30, 0]} timeStep="vary">
          <Lighting />
          <Arena />
          <ArenaBoundary />
          <ArenaPillars />
          <SceneryProps />
          <CentralCore />
          {/* Player is removed from physics world while dead */}
          {!isPlayerDead && <PlayerController />}
          <EnemyManager />
          <TowerManager />
          <MathChallenge />
        </Physics>
      </Canvas>

      {/* 2D overlay — outside Canvas */}
      <GameHUD onStart={handleStart} onRestart={handleRestart} />

      {/* Player death indicator overlay */}
      {isPlayerDead && (
        <DeathOverlay />
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes lf-cta-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0,255,136,0.4); }
          50%      { box-shadow: 0 0 40px rgba(0,255,136,0.7), 0 0 60px rgba(0,212,255,0.3); }
        }
        @keyframes lf-death-pulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        /* Fullscreen mode — fill the entire screen */
        #logic-friction-container:fullscreen {
          width: 100vw !important;
          height: 100vh !important;
          max-height: 100vh !important;
          min-height: 100vh !important;
          border-radius: 0 !important;
        }
      `}</style>
    </div>
  )
}

// ── Camera Rig (Balanced Mobile + Free 360° + Locked Isometric) ──────────────
const GOLDEN_POLAR_ANGLE = Math.PI / 4 // 45° tactical isometric sweet-spot
const DEFAULT_CAMERA_DIST = Math.hypot(CAMERA_OFFSET.y, CAMERA_OFFSET.z)
const _camOffsetVec = new THREE.Vector3()
const _camSpherical = new THREE.Spherical()

function CameraRig() {
  const isCameraFree = useGameStore(s => s.isCameraFree)
  const cameraMode = useGameStore(s => s.cameraMode)
  const lastStepSeqRef = useRef(0)
  const lastResetSeqRef = useRef(0)
  const desiredThetaRef = useRef<number | null>(null)
  const desiredResetRef = useRef(false)

  useFrame((state, delta) => {
    const controls = state.controls as unknown as {
      target?: THREE.Vector3
      update?: () => void
    } | null
    if (!controls || !controls.target) return

    const store = useGameStore.getState()
    const dt = Math.min(delta, 0.05)

    // Compute current spherical coordinates relative to OrbitControls target
    _camOffsetVec.copy(state.camera.position).sub(controls.target)
    _camSpherical.setFromVector3(_camOffsetVec)

    // Cancel automatic step/reset animations if user actively drags camera
    if (isCameraGestureActive()) {
      desiredThetaRef.current = null
      desiredResetRef.current = false
    }

    // Handle quick-step rotation buttons (-45° / +45°)
    if (store.cameraStepSeq !== lastStepSeqRef.current) {
      lastStepSeqRef.current = store.cameraStepSeq
      const baseTheta = desiredThetaRef.current !== null ? desiredThetaRef.current : _camSpherical.theta
      desiredThetaRef.current = baseTheta + store.cameraStepDeltaYaw
    }

    // Handle North / Reset button
    if (store.cameraResetSeq !== lastResetSeqRef.current) {
      lastResetSeqRef.current = store.cameraResetSeq
      desiredThetaRef.current = 0
      desiredResetRef.current = true
    }

    let modified = false

    // 1. LOCKED mode: smoothly hold North (theta=0) and 45° pitch
    if (store.cameraMode === 'LOCKED' || !store.isCameraFree) {
      let dTheta = -_camSpherical.theta
      while (dTheta > Math.PI) dTheta -= Math.PI * 2
      while (dTheta < -Math.PI) dTheta += Math.PI * 2
      const dPhi = GOLDEN_POLAR_ANGLE - _camSpherical.phi
      const dRad = desiredResetRef.current ? DEFAULT_CAMERA_DIST - _camSpherical.radius : 0
      if (Math.abs(dTheta) > 0.002 || Math.abs(dPhi) > 0.002 || Math.abs(dRad) > 0.05) {
        _camSpherical.theta += dTheta * Math.min(1, dt * 8)
        _camSpherical.phi += dPhi * Math.min(1, dt * 8)
        if (desiredResetRef.current) {
          _camSpherical.radius += dRad * Math.min(1, dt * 8)
          if (Math.abs(dRad) < 0.08) desiredResetRef.current = false
        }
        modified = true
      }
    } else {
      // 2. Step azimuth animation (from HUD -45° / +45° / North buttons)
      if (desiredThetaRef.current !== null) {
        // Shortest angular distance wrap
        let diff = desiredThetaRef.current - _camSpherical.theta
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2

        if (Math.abs(diff) < 0.006) {
          _camSpherical.theta = desiredThetaRef.current
          desiredThetaRef.current = null
        } else {
          _camSpherical.theta += diff * Math.min(1, dt * 10)
        }
        modified = true
      }

      // 3. Reset pitch + distance animation (from HUD North button)
      if (desiredResetRef.current) {
        const dPhi = GOLDEN_POLAR_ANGLE - _camSpherical.phi
        const dRad = DEFAULT_CAMERA_DIST - _camSpherical.radius
        if (Math.abs(dPhi) < 0.005 && Math.abs(dRad) < 0.08 && desiredThetaRef.current === null) {
          _camSpherical.phi = GOLDEN_POLAR_ANGLE
          _camSpherical.radius = DEFAULT_CAMERA_DIST
          desiredResetRef.current = false
        } else {
          _camSpherical.phi += dPhi * Math.min(1, dt * 8)
          _camSpherical.radius += dRad * Math.min(1, dt * 8)
        }
        modified = true
      } else if (store.cameraMode === 'BALANCED' && !isCameraGestureActive()) {
        // 4. BALANCED mode: gentle pitch-restoring spring toward 45° when finger is lifted
        const dPhi = GOLDEN_POLAR_ANGLE - _camSpherical.phi
        if (Math.abs(dPhi) > 0.004) {
          _camSpherical.phi += dPhi * Math.min(1, dt * 2.4)
          modified = true
        }
      }
    }

    if (modified) {
      _camSpherical.makeSafe()
      _camOffsetVec.setFromSpherical(_camSpherical)
      state.camera.position.copy(controls.target).add(_camOffsetVec)
      state.camera.lookAt(controls.target)
    }

    // Publish live camera angles for HUD Compass needle (zero React re-renders)
    setLiveCameraAngles(_camSpherical.theta, _camSpherical.phi)
  })

  const canRotate = isCameraFree && cameraMode !== 'LOCKED'
  const isBalanced = cameraMode === 'BALANCED'

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableRotate={canRotate}
      enableDamping={true}
      dampingFactor={0.08}
      rotateSpeed={isBalanced ? 0.58 : 0.85}
      minPolarAngle={isBalanced ? 0.58 : 0.25}
      maxPolarAngle={isBalanced ? 0.98 : Math.PI / 2.2}
      minDistance={12}
      maxDistance={38}
    />
  )
}

// ── Death Overlay (respawn countdown) ────────────────────────────────────────────

function DeathOverlay() {
  const [countdown, setCountdown] = useState(PLAYER_RESPAWN_TIME)

  useEffect(() => {
    setCountdown(PLAYER_RESPAWN_TIME)
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(iv)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10, 2, 2, 0.5)',
      zIndex: 25,
      pointerEvents: 'none',
    }}>
      <div style={{
        fontFamily: "'Orbitron', 'Courier New', monospace",
        fontSize: 'clamp(18px, 3vw, 28px)',
        color: '#ff4444',
        textShadow: '0 0 30px rgba(255,68,68,0.6)',
        animation: 'lf-death-pulse 1s ease infinite',
        textAlign: 'center',
      }}>
        💀 DERROTADO
      </div>
      <div style={{
        fontFamily: "'Courier New', monospace",
        fontSize: 'clamp(36px, 6vw, 64px)',
        color: '#fff',
        fontWeight: 900,
        marginTop: 8,
        textShadow: '0 0 20px rgba(255,255,255,0.3)',
      }}>
        {countdown}s
      </div>
      <div style={{
        fontFamily: "'Courier New', monospace",
        fontSize: 12,
        color: '#64748b',
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
      }}>
        Ressurgindo...
      </div>
    </div>
  )
}
