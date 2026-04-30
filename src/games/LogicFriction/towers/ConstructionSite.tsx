// ============================================================
// Logic Friction — Construction Site (Hologram Blueprint)
// Sprint 5: Type-aware hologram with 15-second auto-expiry,
// floating cost/timer via 3D <Text>, and walk-to-fund.
//
// PHYSICS: This component uses ZERO Rapier physics.
// Player proximity is detected via a pure Three.js distance
// check in useFrame. This makes unmounting 100% safe.
//
// TEXT SAFETY: No <RigidBody> exists here, so <Text> is
// inherently safe. No sibling rule needed.
// ============================================================
import { useRef, useEffect, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../state/useGameStore'
import {
  SITE_SIZE,
  SITE_EXPIRY_MS,
  TOWER_BLUEPRINTS,
} from '../config/constants'

// Distance threshold for walk-to-fund (in world units)
const FUND_DISTANCE = 2.5

interface ConstructionSiteProps {
  id: string
  position: [number, number, number]
  type: string
}

export function ConstructionSite({ id, position, type }: ConstructionSiteProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const textGroupRef = useRef<THREE.Group>(null)
  const fundedRef = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(SITE_EXPIRY_MS / 1000))

  const { scene } = useThree()

  const bp = TOWER_BLUEPRINTS[type]
  const bpColor = bp?.color ?? '#ffd700'
  const bpCost = bp?.cost ?? 50

  // Memoize the world position vector for the distance check
  const worldPos = useMemo(
    () => new THREE.Vector3(position[0], position[1], position[2]),
    [position[0], position[1], position[2]]
  )

  // ── 15-second auto-destroy timer ──
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Auto-remove after SITE_EXPIRY_MS
    const timeout = setTimeout(() => {
      if (!fundedRef.current) {
        useGameStore.getState().removeConstructionSite(id)
      }
    }, SITE_EXPIRY_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [id])

  // Reusable vector for player position (avoid GC allocation per frame)
  const playerPosVec = useMemo(() => new THREE.Vector3(), [])

  // ── Per-frame: animate hologram + bob text + check player proximity ──
  useFrame(() => {
    // Already funded — hide and skip
    if (fundedRef.current) {
      if (groupRef.current) groupRef.current.visible = false
      return
    }

    // ── Hologram animation ──
    const urgency = 1 + (1 - secondsLeft / (SITE_EXPIRY_MS / 1000)) * 3

    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01 * urgency
    }
    if (glowRef.current) {
      const pulse = 0.3 + Math.sin(Date.now() * 0.003 * urgency) * 0.15
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = pulse
    }

    // ── Vertical bob for floating text ──
    if (textGroupRef.current) {
      textGroupRef.current.position.y = SITE_SIZE * 2.5 + Math.sin(Date.now() * 0.003) * 0.3
    }

    // ── Pure distance check — NO Rapier involved ──
    const player = scene.getObjectByName('player')
    if (!player) return

    player.getWorldPosition(playerPosVec)

    // 2D distance (ignore Y/height)
    const dist = Math.hypot(
      playerPosVec.x - worldPos.x,
      playerPosVec.z - worldPos.z
    )

    if (dist < FUND_DISTANCE) {
      const state = useGameStore.getState()
      if (state.gold >= bpCost) {
        fundedRef.current = true
        // Defer to next tick — avoid state mutation during active useFrame render
        setTimeout(() => {
          useGameStore.getState().fundTower(id)
        }, 0)
      }
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Visual: Holographic wireframe box */}
      <mesh ref={meshRef}>
        <boxGeometry args={[SITE_SIZE * 2, SITE_SIZE * 2, SITE_SIZE * 2]} />
        <meshStandardMaterial
          color={bpColor}
          emissive={bpColor}
          emissiveIntensity={0.5}
          transparent
          opacity={0.15}
          wireframe
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[SITE_SIZE * 0.8, 12, 12]} />
        <meshBasicMaterial
          color={bpColor}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Ground marker ring */}
      <mesh position={[0, -SITE_SIZE + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SITE_SIZE * 0.6, SITE_SIZE * 1.2, 6]} />
        <meshBasicMaterial
          color={bpColor}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Floating 3D Text: Cost + Timer (vertical bob via ref) ──
          SAFE: No <RigidBody> exists in this component. */}
      <group ref={textGroupRef} position={[0, SITE_SIZE * 2.5, 0]}>
        {/* Cost */}
        <Text
          position={[0, 0, 0]}
          fontSize={1}
          color={bpColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {`$${bpCost}`}
          <meshBasicMaterial
            attach="material"
            color={bpColor}
            depthTest={false}
            transparent
            toneMapped={false}
          />
        </Text>

        {/* Timer */}
        <Text
          position={[0, -1.2, 0]}
          fontSize={0.6}
          color={secondsLeft <= 5 ? '#ff4444' : '#94a3b8'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          {`⏱ ${secondsLeft}s`}
          <meshBasicMaterial
            attach="material"
            color={secondsLeft <= 5 ? '#ff4444' : '#94a3b8'}
            depthTest={false}
            transparent
            toneMapped={false}
          />
        </Text>
      </group>
    </group>
  )
}
