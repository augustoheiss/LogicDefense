// ============================================================
// Logic Friction — Single Enemy Component
// Sprint 2: Moves toward center (0,0,0), damages core on contact
// Registers real-time position for player attack range checks
// ============================================================
import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, BallCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import {
  ENEMY_RADIUS,
  ENEMY_DAMAGE,
  CORE_COLLIDER_SIZE,
} from '../config/constants'
import { useGameStore } from '../state/useGameStore'
import { enemyRegistry } from './EnemyRegistry'

interface EnemyProps {
  id: string
  position: [number, number, number]
  hp: number
  speed: number
  onDeath: (id: string) => void
}

export function Enemy({ id, position, hp, speed, onDeath }: EnemyProps) {
  const rbRef = useRef<RapierRigidBody>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const hpRef = useRef(hp)
  const aliveRef = useRef(true)
  const takeCoreDamage = useGameStore(s => s.takeCoreDamage)

  // Register into the global enemy registry for attack range checks
  useEffect(() => {
    enemyRegistry.set(id, {
      x: position[0],
      z: position[2],
      takeDamage: (amount: number) => {
        if (!aliveRef.current) return
        hpRef.current -= amount
        if (hpRef.current <= 0) {
          aliveRef.current = false
          onDeath(id)
        }
      },
    })
    return () => {
      enemyRegistry.delete(id)
    }
  }, [id, position, onDeath])

  // ── 30-second failsafe TTL ──
  // If an enemy is alive for 30s it's likely stuck, fallen, or glitched.
  // Forcefully kill it to prevent the wave from softlocking.
  useEffect(() => {
    const failsafeTimer = setTimeout(() => {
      if (!aliveRef.current) return // already dead, nothing to do
      aliveRef.current = false
      onDeath(id)
      console.warn(`[Failsafe] Enemy ${id} removed after 30s TTL`)
    }, 30000)

    return () => clearTimeout(failsafeTimer)
  }, [id, onDeath])

  useFrame(() => {
    const rb = rbRef.current
    if (!rb || !aliveRef.current) return
    if (useGameStore.getState().isPaused) return

    const pos = rb.translation()

    // ── Update registry with real-time position ──
    const entry = enemyRegistry.get(id)
    if (entry) {
      entry.x = pos.x
      entry.z = pos.z
    }

    // ── Move toward center (0, y, 0) ──
    const dx = -pos.x
    const dz = -pos.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist > CORE_COLLIDER_SIZE) {
      const vx = (dx / dist) * speed
      const vz = (dz / dist) * speed
      const currentVel = rb.linvel()
      rb.setLinvel({ x: vx, y: currentVel.y, z: vz }, true)
    } else {
      // Reached the core — deal damage and self-destruct
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      takeCoreDamage(ENEMY_DAMAGE)
      aliveRef.current = false
      onDeath(id)
    }

    // ── Visual: pulse red as HP drops ──
    if (meshRef.current) {
      const ratio = Math.max(0, hpRef.current / hp)
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.3 + (1 - ratio) * 0.7
    }
  })

  if (!aliveRef.current) return null

  return (
    <RigidBody
      ref={rbRef}
      type="dynamic"
      colliders={false}
      position={position}
      lockRotations
      linearDamping={2}
      mass={0.5}
      userData={{ type: 'enemy', id }}
    >
      <BallCollider args={[ENEMY_RADIUS]} />
      <mesh
        ref={meshRef}
        castShadow
        onPointerDown={(e) => {
          // Click-to-follow: set this enemy as the tracked MOBA target
          e.stopPropagation()
          const state = useGameStore.getState()
          if (state.actionMode !== 'MOVE') return
          state.setMoveTarget({ type: 'entity', id })
        }}
      >
        <capsuleGeometry args={[ENEMY_RADIUS, ENEMY_RADIUS * 0.8, 6, 12]} />
        <meshStandardMaterial
          color="#ff4444"
          emissive="#ff2200"
          emissiveIntensity={0.3}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>
      {/* Enemy glow ring */}
      <mesh position={[0, -ENEMY_RADIUS * 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ENEMY_RADIUS * 0.6, ENEMY_RADIUS * 1.0, 16]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </RigidBody>
  )
}
