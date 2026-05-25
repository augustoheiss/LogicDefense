// ============================================================
// Logic Friction — Single Enemy Component ("Glitch Geometric Virus")
// Sprint 2: Moves toward center (0,0,0), damages core on contact
// Registers real-time position for player attack range checks
//
// VISUAL: Procedural low-poly icosahedron with wireframe overlay.
// Chaotic rotation + heartbeat pulse. ALL meshBasicMaterial —
// ZERO dynamic lights. Harsh magenta/crimson contrasts the
// cyan Cyber-Grid arena.
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

// ── Virus geometry constants ────────────────────────────────────────────────────
const VIRUS_RADIUS = 0.35
const WIRE_RADIUS = 0.42 // Slightly larger wireframe shell

export function Enemy({ id, position, hp, speed, onDeath }: EnemyProps) {
  const rbRef = useRef<RapierRigidBody>(null)
  const virusRef = useRef<THREE.Group>(null) // Visual group (rotation/scale target)
  const solidRef = useRef<THREE.Mesh>(null)  // Solid core mesh (color changes on damage)
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

  useFrame((state, delta) => {
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

    // ── Visual: Chaotic rotation on the visual group (NOT the RigidBody) ──
    if (virusRef.current) {
      virusRef.current.rotation.x += delta * 3.5
      virusRef.current.rotation.y -= delta * 2.1
      virusRef.current.rotation.z += delta * 4.0

      // Heartbeat pulse
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.15
      virusRef.current.scale.set(pulse, pulse, pulse)
    }

    // ── Visual: color shifts toward white as HP drops (damage feedback) ──
    if (solidRef.current) {
      const ratio = Math.max(0, hpRef.current / hp)
      const mat = solidRef.current.material as THREE.MeshBasicMaterial
      // Lerp from harsh magenta (#ff0055) toward hot white (#ffaacc) as HP drops
      const r = 1.0
      const g = 0.0 + (1 - ratio) * 0.65
      const b = 0.33 + (1 - ratio) * 0.47
      mat.color.setRGB(r, g, b)
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

      {/* Click-to-follow: set this enemy as the tracked MOBA target */}
      <group
        onPointerDown={(e) => {
          e.stopPropagation()
          const store = useGameStore.getState()
          if (store.actionMode !== 'MOVE') return
          store.setMoveTarget({ type: 'entity', id })
        }}
      >
        {/* Virus visual group — chaotic rotation + pulse applied here,
            NOT on the physics body (lockRotations stays intact) */}
        <group ref={virusRef}>
          {/* Solid core — harsh magenta icosahedron */}
          <mesh ref={solidRef} castShadow>
            <icosahedronGeometry args={[VIRUS_RADIUS, 0]} />
            <meshBasicMaterial color="#ff0055" />
          </mesh>

          {/* Wireframe shell — glitchy hologram overlay */}
          <mesh>
            <icosahedronGeometry args={[WIRE_RADIUS, 0]} />
            <meshBasicMaterial
              color="#ff3377"
              wireframe
              transparent
              opacity={0.4}
            />
          </mesh>
        </group>
      </group>

      {/* Ground shadow ring — subtle positional indicator */}
      <mesh position={[0, -ENEMY_RADIUS * 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ENEMY_RADIUS * 0.6, ENEMY_RADIUS * 1.0, 16]} />
        <meshBasicMaterial color="#ff0055" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </RigidBody>
  )
}
