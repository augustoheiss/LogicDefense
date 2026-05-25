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
import {
  MATH_ZONE_Y,
  MATH_ZONE_POSITIONS,
  MATH_ZONE_SENSOR_RADIUS,
  ANSWER_PAD_RADIUS,
  ANSWER_PAD_HEIGHT,
  ANSWER_PAD_SPACING,
  ANSWER_PAD_SENSOR,
} from '../config/constants'

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
            ▼ PISE NA RESPOSTA CORRETA ▼
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

      {/* ── Result indicator ── */}
      {mathAnswered && !isBuffActive && (
        <Billboard>
          <Text
            position={[0, MATH_ZONE_Y + 2, 0]}
            fontSize={3}
            color="#00ccff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.12}
            outlineColor="#000000"
          >
            ✗
            <meshBasicMaterial
              attach="material"
              color="#00ccff"
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

function AnswerPad({ label, isCorrect, position, zoneWorldPos, disabled, showResult }: AnswerPadProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const submittedRef = useRef(false)

  // Reset submittedRef when a new wave starts (disabled resets to false)
  if (!disabled) {
    submittedRef.current = false
  }

  // Determine visual color based on state
  const color = useMemo(() => {
    if (!showResult) return '#1a1a3a'
    return isCorrect ? '#00ff88' : '#ff4444'
  }, [showResult, isCorrect])

  const emissiveColor = useMemo(() => {
    if (!showResult) return '#ffd700'
    return isCorrect ? '#00ff88' : '#ff4444'
  }, [showResult, isCorrect])

  // Subtle idle animation
  useFrame(() => {
    if (meshRef.current && !showResult) {
      const pulse = 0.2 + Math.sin(Date.now() * 0.003) * 0.1
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = pulse
    }
  })

  const handleIntersection = useCallback((payload: any) => {
    if (disabled || submittedRef.current) return

    const userData = payload.other.rigidBody?.userData as { type?: string } | undefined
    if (userData?.type !== 'player') return

    submittedRef.current = true

    setTimeout(() => {
      useGameStore.getState().submitAnswer(isCorrect)
    }, 0)
  }, [disabled, isCorrect])

  // ── MOBILE FIX: Tap-to-walk onto answer pad ──
  // Stops propagation (so Arena doesn't fire a competing move) AND
  // explicitly commands the player to walk toward this pad's world position.
  const handlePadTap = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (disabled) return
    // Compute world position: parent group offset (zoneWorldPos) + local pad offset
    const worldX = zoneWorldPos[0] + position[0]
    const worldZ = zoneWorldPos[2] + position[2]
    useGameStore.getState().setMoveTarget({ type: 'point', x: worldX, z: worldZ })
  }, [disabled, zoneWorldPos, position])

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

      {/* Tap hitbox — r=1.5 covers the visual pad without overlapping neighbors
          (pad spacing = 5 units, so r=1.5 leaves 2 units of gap). */}
      <mesh
        position={[0, 1.0, 0]}
        onPointerDown={handlePadTap}
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
      >
        <ringGeometry args={[ANSWER_PAD_RADIUS - 0.1, ANSWER_PAD_RADIUS + 0.1, 16]} />
        <meshBasicMaterial
          color={showResult ? (isCorrect ? '#00ff88' : '#ff4444') : '#ffd700'}
          transparent
          opacity={showResult ? (isCorrect ? 0.6 : 0.1) : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ═══════════════════════════════════════════
          TEXT — SIBLING to RigidBody, not a child.
          ═══════════════════════════════════════════ */}
      <Billboard>
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
