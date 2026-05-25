// ============================================================
// LOGIC FRICTION — Main Orchestrator
// Sprint 2.5: Modular architecture + Fullscreen API + Death
// Composes all game systems into the R3F scene
// ============================================================
import { useCallback, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'

// ── Game Systems ────────────────────────────────────────────────────────────────
import { Arena, ArenaBoundary, Lighting } from './world/Arena'
import { CentralCore } from './world/CentralCore'
import { PlayerController } from './player/PlayerController'
import { EnemyManager } from './enemies/EnemyManager'
import { TowerManager } from './towers/TowerManager'
import { MathChallenge } from './math/MathChallenge'
import { GameHUD } from './ui/GameHUD'
import { ClickPing } from './ui/ClickPing'
import { useGameStore } from './state/useGameStore'
import { CAMERA_OFFSET } from './config/constants'

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
        background: '#04040e',
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
        <color attach="background" args={['#04040e']} />
        <fog attach="fog" args={['#04040e', 60, 120]} />

        {/* 360° Camera — rotation gated by Settings toggle */}
        <CameraRig />
        <ClickPing />

        <Physics gravity={[0, -30, 0]} timeStep="vary">
          <Lighting />
          <Arena />
          <ArenaBoundary />
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

// ── Camera Rig (OrbitControls with Settings toggle) ──────────────────────────
function CameraRig() {
  const isCameraFree = useGameStore(s => s.isCameraFree)
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableRotate={isCameraFree}
      maxPolarAngle={Math.PI / 2.2}
      minDistance={10}
      maxDistance={40}
    />
  )
}

// ── Death Overlay (respawn countdown) ────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { PLAYER_RESPAWN_TIME } from './config/constants'

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
