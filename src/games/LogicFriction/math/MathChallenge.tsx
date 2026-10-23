// ============================================================
// Logic Friction — Math Challenge (3D Answer Pads)
// Sprint 4.1: Rotating N/S/E/W positions, crash-safe async
// physics callbacks, render-on-top text, transparency sensor.
//
// TEXT SAFETY: In AnswerPad, <Text> is a SIBLING to <RigidBody>,
// never nested inside it. The main equation/hint/result text
// lives in MathChallenge (no physics) and is inherently safe.
//
// MOBILE FIX: Answer pad meshes use onPointerDown that stops
// propagation AND explicitly triggers setMoveTarget toward the
// pad's world position, so the player walks onto it on tap.
// ============================================================
import { useRef, useMemo, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { RigidBody, CylinderCollider } from '@react-three/rapier'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../state/useGameStore'
import { MathRewardFX } from './MathRewardFX'
import {
  MATH_ZONE_Y,
  MATH_ZONE_POSITIONS,
  MATH_ZONE_SENSOR_RADIUS,
  ANSWER_PAD_RADIUS,
  ANSWER_PAD_HEIGHT,
  ANSWER_PAD_SPACING,
  ANSWER_PAD_SENSOR,
} from '../config/constants'
import { getSharedPlaneGeometry, getSharedSpriteTexture, noRaycast } from '../sprites/spriteAtlasRegistry'
import { CrossQuad25D } from '../sprites/Sprite25D'
import { recordPointerDown, isCleanTapGesture } from '../hooks/useTouchCameraGate'

const PAD_SYMBOLS = ['▲', '◆', '●', '■'] as const
const PAD_ACCENT_COLORS = ['#38bdf8', '#c084fc', '#facc15', '#4ade80'] as const

// ── Math Challenge Manager ──────────────────────────────────────────────────────
export function MathChallenge() {
  const currentProblem = useGameStore(s => s.currentProblem)
  const mathAnswered = useGameStore(s => s.mathAnswered)
  const isBuffActive = useGameStore(s => s.isBuffActive)
  const mathZonePosition = useGameStore(s => s.mathZonePosition)
  const phase = useGameStore(s => s.phase)

  // Hide the entire math challenge outside of active combat
  if (phase !== 'PLAYING') return null
  if (!currentProblem) return null

  // Resolve world position from cardinal direction
  const zonePos = MATH_ZONE_POSITIONS[mathZonePosition]

  // Calculate pad positions (spread evenly along local X)
  const padCount = currentProblem.answers.length
  const totalWidth = (padCount - 1) * ANSWER_PAD_SPACING
  const startX = -totalWidth / 2

  // Rotate pads based on direction — E/W zones spread along Z instead of X
  const isHorizontal = mathZonePosition === 'E' || mathZonePosition === 'W'

  return (
    <>
      <MathRewardFX />
      <group position={zonePos}>
        {/* ── Transparency Sensor ── */}
        <TransparencySensor />


        {/* ── Floating equation text (3D — NO physics here, safe) ── */}
        <Billboard>
          <Text
            position={[0, MATH_ZONE_Y, 0]}
            fontSize={2.5}
            color="#00d4ff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.08}
            outlineColor="#000000"
            maxWidth={30}
          >
            {currentProblem.expression}
            <meshBasicMaterial
              attach="material"
              color="#00d4ff"
              depthTest={false}
              transparent
              toneMapped={false}
            />
          </Text>
        </Billboard>

        {/* ── "Walk to answer!" hint ── */}
        {!mathAnswered && (
          <Billboard>
            <Text
              position={[0, MATH_ZONE_Y - 2.5, 0]}
              fontSize={0.8}
              color="#ffd700"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="#000000"
            >
              ▼ CLIQUE OU PISE NA RESPOSTA ▼
              <meshBasicMaterial
                attach="material"
                color="#ffd700"
                depthTest={false}
                transparent
                toneMapped={false}
              />
            </Text>
          </Billboard>
        )}

        {/* ── Answer Pads ── */}
        {currentProblem.answers.map((answer, i) => {
          const offset = startX + i * ANSWER_PAD_SPACING
          const padPos: [number, number, number] = isHorizontal
            ? [0, 0, offset + 3]
            : [offset, 0, 3]

          return (
            <AnswerPad
              key={`${mathZonePosition}-${i}`}
              index={i}
              label={answer.label}
              isCorrect={answer.isCorrect}
              position={padPos}
              zoneWorldPos={zonePos}
              disabled={mathAnswered}
              showResult={mathAnswered}
            />
          )
        })}

        {/* ── Result indicator (Correct) ── */}
        {mathAnswered && isBuffActive && (
          <Billboard>
            <Text
              position={[0, MATH_ZONE_Y + 2.2, 0]}
              fontSize={1.6}
              color="#00ff88"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.09}
              outlineColor="#000000"
            >
              ✓ BUFF DIVINO ATIVO!
              <meshBasicMaterial
                attach="material"
                color="#00ff88"
                depthTest={false}
                transparent
                toneMapped={false}
              />
            </Text>
          </Billboard>
        )}

        {/* ── Result indicator (Wrong) ── */}
        {mathAnswered && !isBuffActive && (
          <Billboard>
            <Text
              position={[0, MATH_ZONE_Y + 2, 0]}
              fontSize={3}
              color="#ff4444"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.12}
              outlineColor="#000000"
            >
              ✗
              <meshBasicMaterial
                attach="material"
                color="#ff4444"
                depthTest={false}
                transparent
                toneMapped={false}
              />
            </Text>
          </Billboard>
        )}

        {/* NOTE: Explanation text has been moved to the 2D GameHUD
            to avoid Drei <Text> crashes with long/special character strings */}
      </group>
    </>
  )
}

// ── Transparency Sensor ─────────────────────────────────────────────────────────
function TransparencySensor() {
  const handleEnter = useCallback((payload: any) => {
    const userData = payload.other.rigidBody?.userData as { type?: string } | undefined
    if (userData?.type === 'player') {
      setTimeout(() => useGameStore.getState().setInsideMathZone(true), 0)
    }
  }, [])

  const handleExit = useCallback((payload: any) => {
    const userData = payload.other.rigidBody?.userData as { type?: string } | undefined
    if (userData?.type === 'player') {
      setTimeout(() => useGameStore.getState().setInsideMathZone(false), 0)
    }
  }, [])

  return (
    <RigidBody type="fixed" colliders={false} userData={{ type: 'math_zone_sensor' }}>
      <CylinderCollider
        args={[5, MATH_ZONE_SENSOR_RADIUS]}
        sensor
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
    </RigidBody>
  )
}

// ── Individual Answer Pad ───────────────────────────────────────────────────────
interface AnswerPadProps {
  index: number
  label: string
  isCorrect: boolean
  position: [number, number, number]
  zoneWorldPos: [number, number, number]
  disabled: boolean
  showResult: boolean
}

function AnswerPad({ index, label, isCorrect, position, zoneWorldPos, disabled, showResult }: AnswerPadProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const runeTopRef = useRef<THREE.Mesh>(null)
  const submittedRef = useRef(false)
  const visualStyle = useGameStore(s => s.visualStyle)
  const planeGeo = useMemo(() => getSharedPlaneGeometry(), [])
  const runeTopTex = useMemo(() => getSharedSpriteTexture('MATH_PAD_RUNE_TOP'), [])
  const padSymbol = PAD_SYMBOLS[index % PAD_SYMBOLS.length]
  const padAccent = PAD_ACCENT_COLORS[index % PAD_ACCENT_COLORS.length]

  // Reset submittedRef when a new wave starts (disabled resets to false)
  if (!disabled) {
    submittedRef.current = false
  }

  const worldPadPos = useMemo<[number, number, number]>(
    () => [zoneWorldPos[0] + position[0], 0, zoneWorldPos[2] + position[2]],
    [zoneWorldPos, position]
  )

  // Determine visual color based on state
  const color = useMemo(() => {
    if (!showResult) return '#1a1a3a'
    return isCorrect ? '#00ff88' : '#ff4444'
  }, [showResult, isCorrect])

  const emissiveColor = useMemo(() => {
    if (!showResult) return '#ffd700'
    return isCorrect ? '#00ff88' : '#ff4444'
  }, [showResult, isCorrect])

  // Subtle idle animation + elevation animation on answer
  useFrame((_, delta) => {
    if (runeTopRef.current) {
      runeTopRef.current.rotation.z += delta * 0.6
    }
    if (!meshRef.current) return
    if (!showResult) {
      const pulse = 0.2 + Math.sin(Date.now() * 0.003) * 0.1
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = pulse
      meshRef.current.position.y = ANSWER_PAD_HEIGHT / 2 + 0.2
    } else {
      const targetY = isCorrect ? ANSWER_PAD_HEIGHT / 2 + 0.55 : ANSWER_PAD_HEIGHT / 2 - 0.05
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, delta * 8)
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = isCorrect ? 0.65 : 0.1
    }
  })

  const handleIntersection = useCallback((payload: any) => {
    if (disabled || submittedRef.current) return

    const userData = payload.other.rigidBody?.userData as { type?: string } | undefined
    if (userData?.type !== 'player') return

    submittedRef.current = true

    setTimeout(() => {
      useGameStore.getState().submitAnswer(isCorrect, worldPadPos)
    }, 0)
  }, [disabled, isCorrect, worldPadPos])

  // ── CLICK/TAP: Instant answer submission (disambiguated from camera drag) ──
  const handlePadPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    recordPointerDown(e.nativeEvent.clientX, e.nativeEvent.clientY)
  }, [])

  const handlePadTap = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    if (!isCleanTapGesture(e.nativeEvent.clientX, e.nativeEvent.clientY)) return
    e.stopPropagation()
    if (disabled || submittedRef.current) return
    submittedRef.current = true
    document.body.style.cursor = 'auto'
    setTimeout(() => {
      useGameStore.getState().submitAnswer(isCorrect, worldPadPos)
    }, 0)
  }, [disabled, isCorrect, worldPadPos])

  // ── Cursor feedback (desktop) ──
  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (!disabled) document.body.style.cursor = 'pointer'
  }, [disabled])

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'auto'
  }, [])

  // Label colors
  const labelColor = showResult ? (isCorrect ? '#00ff88' : '#ff4444') : '#ffffff'

  return (
    <group position={position}>
      {/* ═══════════════════════════════════════════
          PHYSICS — RigidBody sensor. <Text> is BELOW
          as a sibling, never nested inside.
          ═══════════════════════════════════════════ */}
      <RigidBody type="fixed" colliders={false} userData={{ type: 'answer_pad' }}>
        <CylinderCollider
          args={[ANSWER_PAD_HEIGHT, ANSWER_PAD_SENSOR]}
          sensor
          onIntersectionEnter={handleIntersection}
        />
      </RigidBody>

      {/* Tap/click hitbox — r=1.5 covers the visual pad without overlapping neighbors
          (pad spacing = 5 units, so r=1.5 leaves 2 units of gap). */}
      <mesh
        position={[0, 1.0, 0]}
        onPointerDown={handlePadPointerDown}
        onPointerUp={handlePadTap}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <cylinderGeometry args={[1.5, 1.5, 1, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Visual cylinder — NO pointer events (hitbox handles them) */}
      <mesh
        ref={meshRef}
        position={[0, ANSWER_PAD_HEIGHT / 2 + 0.2, 0]}
        receiveShadow
        visible={!showResult || isCorrect}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[ANSWER_PAD_RADIUS, ANSWER_PAD_RADIUS, ANSWER_PAD_HEIGHT, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={0.2}
          metalness={0.6}
          roughness={0.3}
          transparent={showResult}
          opacity={showResult ? (isCorrect ? 1 : 0.15) : 1}
        />
      </mesh>

      {/* Ring border — NO pointer events (hitbox handles them) */}
      <mesh
        position={[0, ANSWER_PAD_HEIGHT + 0.22, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={!showResult || isCorrect}
        raycast={noRaycast}
      >
        <ringGeometry args={[ANSWER_PAD_RADIUS - 0.1, ANSWER_PAD_RADIUS + 0.1, 16]} />
        <meshBasicMaterial
          color={showResult ? (isCorrect ? '#00ff88' : '#ff4444') : '#ffd700'}
          transparent
          opacity={showResult ? (isCorrect ? 0.6 : 0.1) : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 2.5D Sacred Rune Top & Ascending Light Pillar */}
      {visualStyle === '2.5D' && (!showResult || isCorrect) && (
        <>
          <mesh
            ref={runeTopRef}
            geometry={planeGeo}
            position={[0, ANSWER_PAD_HEIGHT + 0.24, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[ANSWER_PAD_RADIUS * 2.15, ANSWER_PAD_RADIUS * 2.15, 1]}
            raycast={noRaycast}
          >
            <meshBasicMaterial
              map={runeTopTex}
              transparent
              alphaTest={0.02}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              color={showResult ? (isCorrect ? '#00ff88' : '#ff4444') : '#ffffff'}
              opacity={showResult ? (isCorrect ? 0.95 : 0.2) : 0.85}
            />
          </mesh>
          <CrossQuad25D
            spriteKey="MATH_PAD_PILLAR"
            width={ANSWER_PAD_RADIUS * 1.85}
            height={2.5}
            yOffset={1.55}
            planes={2}
            opacity={showResult ? (isCorrect ? 0.85 : 0.12) : 0.48}
            tint={showResult ? (isCorrect ? '#00ff88' : '#ff4444') : '#fde047'}
            additive
          />
        </>
      )}

      {/* ═══════════════════════════════════════════
          TEXT — SIBLING to RigidBody, not a child.
          Includes High-Contrast Geometric Symbol (▲, ◆, ●, ■)
          ═══════════════════════════════════════════ */}
      <Billboard>
        <Text
          position={[0, ANSWER_PAD_HEIGHT + 2.35, 0]}
          fontSize={0.75}
          color={showResult ? labelColor : padAccent}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {padSymbol}
          <meshBasicMaterial
            attach="material"
            color={showResult ? labelColor : padAccent}
            depthTest={false}
            transparent
            opacity={showResult && !isCorrect ? 0.3 : 0.95}
            toneMapped={false}
          />
        </Text>
        <Text
          position={[0, ANSWER_PAD_HEIGHT + 1.2, 0]}
          fontSize={1.4}
          color={labelColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.06}
          outlineColor="#000000"
          maxWidth={6}
        >
          {label}
          <meshBasicMaterial
            attach="material"
            color={labelColor}
            depthTest={false}
            transparent
            opacity={showResult && !isCorrect ? 0.3 : 1}
            toneMapped={false}
          />
        </Text>
      </Billboard>
    </group>
  )
}
