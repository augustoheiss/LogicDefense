// ============================================================
// Logic Friction — Single Enemy Component ("Glitch Geometric Virus")
// Sprint 7: A* Pathfinding + Siege Mode + Slow debuff support
//
// Enemies navigate around towers using A* pathfinding.
// If all paths are blocked, they enter SIEGE MODE:
//   - Stop moving
//   - Fire a ranged laser at the core every 2s
//
// VISUAL: Procedural low-poly icosahedron with wireframe overlay.
// Chaotic rotation + heartbeat pulse. ALL meshBasicMaterial —
// ZERO dynamic lights. Harsh magenta/crimson for normals,
// gold/amber for bosses, cyan tint when slowed.
// ============================================================
import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { RigidBody, BallCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import {
  ENEMY_RADIUS,
  ENEMY_DAMAGE,
  CORE_COLLIDER_SIZE,
  BOSS_DAMAGE,
  BOSS_FAILSAFE_TTL,
  SIEGE_FIRE_INTERVAL,
} from '../config/constants'
import { useGameStore } from '../state/useGameStore'
import { enemyRegistry } from './EnemyRegistry'
import { findEnemyPath, getPathVersion, getObstacleCount } from './pathfindingGrid'

interface EnemyProps {
  id: string
  position: [number, number, number]
  hp: number
  speed: number
  isBoss: boolean
  requiredMoney: number
  enemyScale: number
  onDeath?: (id: string) => void
  onBossDeath?: (id: string, x: number, z: number) => void
}

// ── Virus geometry constants ────────────────────────────────────────────────────
const VIRUS_RADIUS = 0.35
const WIRE_RADIUS = 0.42 // Slightly larger wireframe shell

// ── Pathfinding constants ───────────────────────────────────────────────────────
const WAYPOINT_REACH_DIST = 2.0  // How close to waypoint before advancing
const PATH_RECALC_THROTTLE = 0.5 // Min seconds between recalculations

export function Enemy({
  id,
  position,
  hp,
  speed,
  isBoss,
  requiredMoney,
  enemyScale,
  onDeath,
  onBossDeath,
}: EnemyProps) {
  const rbRef = useRef<RapierRigidBody>(null)
  const virusRef = useRef<THREE.Group>(null) // Visual group (rotation/scale target)
  const solidRef = useRef<THREE.Mesh>(null)  // Solid core mesh (color changes on damage)
  const siegeLaserRef = useRef<THREE.Mesh>(null) // Siege mode laser visual
  const hpRef = useRef(hp)
  const aliveRef = useRef(true)
  const lastPosRef = useRef({ x: position[0], z: position[2] })
  const takeCoreDamage = useGameStore(s => s.takeCoreDamage)

  // ── Pathfinding state ──
  const pathRef = useRef<Array<{ x: number; z: number }> | null>(null)
  const pathIndexRef = useRef(0)
  const pathVersionRef = useRef(-1) // Force initial pathfind
  const pathRecalcTimerRef = useRef(0)
  const siegeModeRef = useRef(false)
  const siegeTimerRef = useRef(0)

  // ── Wiggle sidestep state (perpendicular escape from corners) ──
  const stuckTimerRef = useRef(0)
  const stuckPrevPosRef = useRef({ x: position[0], z: position[2] })
  const sidestepDirRef = useRef(1)    // +1 or -1: alternating L/R
  const wiggleRecalcRef = useRef(0)   // Path recalc during wiggling

  // ── Slow state ──
  const speedMultRef = useRef(1.0)
  const slowExpiryRef = useRef(0)

  // Memoize the damage amount so bosses deal BOSS_DAMAGE
  const contactDamage = useMemo(() => isBoss ? BOSS_DAMAGE : ENEMY_DAMAGE, [isBoss])

  // Collider radius scales with enemy scale
  const colliderRadius = useMemo(() => ENEMY_RADIUS * enemyScale, [enemyScale])

  // Register into the global enemy registry for attack range checks
  useEffect(() => {
    enemyRegistry.set(id, {
      x: position[0],
      z: position[2],
      isBoss,
      speedMultiplier: 1.0,
      slowExpiry: 0,
      takeDamage: (amount: number) => {
        if (!aliveRef.current) return
        hpRef.current -= amount
        if (hpRef.current <= 0) {
          aliveRef.current = false
          if (isBoss && onBossDeath) {
            onBossDeath(id, lastPosRef.current.x, lastPosRef.current.z)
          } else if (onDeath) {
            onDeath(id)
          }
        }
      },
      applySlow: (factor: number, duration: number) => {
        speedMultRef.current = factor
        slowExpiryRef.current = performance.now() + duration * 1000
        const entry = enemyRegistry.get(id)
        if (entry) {
          entry.speedMultiplier = factor
          entry.slowExpiry = slowExpiryRef.current
        }
      },
    })
    return () => {
      enemyRegistry.delete(id)
    }
  }, [id, position, isBoss, onDeath, onBossDeath])

  // ── Failsafe TTL ──
  // Normal enemies: 30s. Bosses: 90s (they're much slower).
  useEffect(() => {
    const ttl = isBoss ? BOSS_FAILSAFE_TTL : 30000
    const failsafeTimer = setTimeout(() => {
      if (!aliveRef.current) return // already dead, nothing to do
      aliveRef.current = false
      if (isBoss && onBossDeath) {
        onBossDeath(id, lastPosRef.current.x, lastPosRef.current.z)
      } else if (onDeath) {
        onDeath(id)
      }
      console.warn(`[Failsafe] Enemy ${id} removed after ${ttl / 1000}s TTL`)
    }, ttl)

    return () => clearTimeout(failsafeTimer)
  }, [id, isBoss, onDeath, onBossDeath])

  useFrame((state, delta) => {
    const rb = rbRef.current
    if (!rb || !aliveRef.current) return
    if (useGameStore.getState().isPaused) return

    const pos = rb.translation()

    // ── Track last known position for trojan spawning ──
    lastPosRef.current.x = pos.x
    lastPosRef.current.z = pos.z

    // ── Update registry with real-time position ──
    const entry = enemyRegistry.get(id)
    if (entry) {
      entry.x = pos.x
      entry.z = pos.z
    }

    // ── Slow expiry check ──
    if (speedMultRef.current < 1.0 && performance.now() >= slowExpiryRef.current) {
      speedMultRef.current = 1.0
      if (entry) {
        entry.speedMultiplier = 1.0
        entry.slowExpiry = 0
      }
    }

    const effectiveSpeed = speed * speedMultRef.current

    // ── Pathfinding recalculation ──
    const currentVersion = getPathVersion()
    pathRecalcTimerRef.current = Math.max(0, pathRecalcTimerRef.current - delta)

    if (pathVersionRef.current !== currentVersion && pathRecalcTimerRef.current <= 0) {
      // Grid changed — recalculate path
      const newPath = findEnemyPath(pos.x, pos.z)
      pathRef.current = newPath
      pathIndexRef.current = 0
      pathVersionRef.current = currentVersion
      pathRecalcTimerRef.current = PATH_RECALC_THROTTLE

      if (newPath === null) {
        // No path to core — but ONLY enter siege if there are actually obstacles
        const towerCount = getObstacleCount()
        if (towerCount === 0) {
          // FAILSAFE: Zero towers means siege is logically impossible.
          // Force beeline movement by setting an empty path.
          console.warn(`[Enemy ${id}] A* null with 0 towers — forcing beeline fallback`)
          pathRef.current = []
          siegeModeRef.current = false
        } else if (!siegeModeRef.current) {
          siegeModeRef.current = true
          siegeTimerRef.current = 0
        }
      } else {
        // Path found — exit siege mode
        siegeModeRef.current = false
      }
    }

    // ── SIEGE MODE: stop and fire laser at core ──
    if (siegeModeRef.current) {
      rb.setLinvel({ x: 0, y: rb.linvel().y, z: 0 }, true)
      siegeTimerRef.current += delta

      if (siegeTimerRef.current >= SIEGE_FIRE_INTERVAL) {
        siegeTimerRef.current = 0
        takeCoreDamage(contactDamage)
      }

      // Siege laser visual (pulsing beam to core)
      if (siegeLaserRef.current) {
        const mat = siegeLaserRef.current.material as THREE.MeshBasicMaterial
        // Pulse opacity based on siege timer
        const pulsePhase = siegeTimerRef.current / SIEGE_FIRE_INTERVAL
        if (pulsePhase > 0.85) {
          // Bright flash when about to fire
          mat.opacity = 0.8
          siegeLaserRef.current.visible = true
          // Point laser from enemy to core
          const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z)
          siegeLaserRef.current.scale.set(0.08, 0.08, dist)
          siegeLaserRef.current.position.set(0, 0, 0)
          siegeLaserRef.current.lookAt(-pos.x, 0, -pos.z)
        } else if (pulsePhase < 0.15 && siegeTimerRef.current > 0.01) {
          // Fade after fire
          mat.opacity = Math.max(0, 0.8 - pulsePhase * 5.3)
          siegeLaserRef.current.visible = mat.opacity > 0.01
        } else {
          siegeLaserRef.current.visible = false
        }
      }
    } else {
      // Hide siege laser when not in siege
      if (siegeLaserRef.current) {
        siegeLaserRef.current.visible = false
      }

      // ── PATHFINDING MOVEMENT ──
      const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z)

      if (dist > CORE_COLLIDER_SIZE) {
        const path = pathRef.current
        if (path && path.length > 0 && pathIndexRef.current < path.length) {
          // Follow waypoints
          const wp = path[pathIndexRef.current]
          const wpDx = wp.x - pos.x
          const wpDz = wp.z - pos.z
          const wpDist = Math.sqrt(wpDx * wpDx + wpDz * wpDz)

          if (wpDist < WAYPOINT_REACH_DIST) {
            pathIndexRef.current++
          } else {
            const vx = (wpDx / wpDist) * effectiveSpeed
            const vz = (wpDz / wpDist) * effectiveSpeed
            rb.setLinvel({ x: vx, y: rb.linvel().y, z: vz }, true)
          }
        } else {
          // No path or all waypoints consumed — beeline to core
          const dx = -pos.x
          const dz = -pos.z
          const vx = (dx / dist) * effectiveSpeed
          const vz = (dz / dist) * effectiveSpeed
          rb.setLinvel({ x: vx, y: rb.linvel().y, z: vz }, true)
        }
      } else {
        // Reached the core — deal damage and self-destruct
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
        takeCoreDamage(contactDamage)
        aliveRef.current = false
        if (isBoss && onBossDeath) {
          onBossDeath(id, pos.x, pos.z)
        } else if (onDeath) {
          onDeath(id)
        }
      }
    }

    // ── Wiggle Sidestep (perpendicular escape from corners) ──
    // Same logic as the player: pure alternating L/R sidestep, never backward.
    if (!siegeModeRef.current) {
      const prevSP = stuckPrevPosRef.current
      const moveDist = Math.sqrt(
        (pos.x - prevSP.x) * (pos.x - prevSP.x) +
        (pos.z - prevSP.z) * (pos.z - prevSP.z)
      )
      if (moveDist < 0.1) {
        stuckTimerRef.current += delta

        if (stuckTimerRef.current >= 0.3) {
          // Get the intended movement direction (to current waypoint or core)
          const path = pathRef.current
          let dirX = 0
          let dirZ = 0
          if (path && path.length > 0 && pathIndexRef.current < path.length) {
            const wp = path[pathIndexRef.current]
            dirX = wp.x - pos.x
            dirZ = wp.z - pos.z
          } else {
            // Beeline to core
            dirX = -pos.x
            dirZ = -pos.z
          }
          const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ)
          if (dirLen > 0.01) {
            const ndx = dirX / dirLen
            const ndz = dirZ / dirLen
            // Perpendicular sidestep vector
            const sideX = -ndz * sidestepDirRef.current
            const sideZ = ndx * sidestepDirRef.current
            // Blend: 70% sideways + 30% forward
            const wiggleSpeed = effectiveSpeed * 0.95
            rb.setLinvel(
              {
                x: (sideX * 0.7 + ndx * 0.3) * wiggleSpeed,
                y: rb.linvel().y,
                z: (sideZ * 0.7 + ndz * 0.3) * wiggleSpeed,
              },
              true
            )
          }

          // Flip direction every 0.5s for rapid L-R-L-R wiggle
          if (stuckTimerRef.current >= 0.8) {
            sidestepDirRef.current *= -1
            stuckTimerRef.current = 0.3 // Stay in wiggle mode
          }

          // Continuous path recalc every 0.3s
          wiggleRecalcRef.current += delta
          if (wiggleRecalcRef.current >= 0.3) {
            const newPath = findEnemyPath(pos.x, pos.z)
            pathRef.current = newPath
            pathIndexRef.current = 0
            wiggleRecalcRef.current = 0
          }
        }
      } else {
        // Moving freely — reset wiggle state
        stuckTimerRef.current = 0
        wiggleRecalcRef.current = 0
      }
      stuckPrevPosRef.current = { x: pos.x, z: pos.z }
    }

    // ── Visual: Rotation + pulse ──
    if (virusRef.current) {
      const isSlowed = speedMultRef.current < 1.0

      if (isBoss) {
        // Boss: slower, more menacing rotation
        const rotSpeed = isSlowed ? 0.5 : 1.0
        virusRef.current.rotation.x += delta * 1.2 * rotSpeed
        virusRef.current.rotation.y -= delta * 0.8 * rotSpeed
        virusRef.current.rotation.z += delta * 1.5 * rotSpeed
        // Heavier pulse for bosses
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1
        virusRef.current.scale.set(
          enemyScale * pulse,
          enemyScale * pulse,
          enemyScale * pulse,
        )
      } else {
        // Normal: chaotic fast rotation
        const rotSpeed = isSlowed ? 0.4 : 1.0
        virusRef.current.rotation.x += delta * 3.5 * rotSpeed
        virusRef.current.rotation.y -= delta * 2.1 * rotSpeed
        virusRef.current.rotation.z += delta * 4.0 * rotSpeed
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.15
        virusRef.current.scale.set(pulse, pulse, pulse)
      }
    }

    // ── Visual: color shifts as HP drops (damage feedback) + slow tint ──
    if (solidRef.current) {
      const ratio = Math.max(0, hpRef.current / hp)
      const mat = solidRef.current.material as THREE.MeshBasicMaterial
      const isSlowed = speedMultRef.current < 1.0

      if (isSlowed) {
        // Cyan-tinted when slowed
        const r = 0.0
        const g = 0.7 + (1 - ratio) * 0.3
        const b = 1.0
        mat.color.setRGB(r, g, b)
      } else if (isBoss) {
        // Gold (#ffaa00) → hot white (#ffeecc) as HP drops
        const r = 1.0
        const g = 0.67 + (1 - ratio) * 0.26
        const b = 0.0 + (1 - ratio) * 0.8
        mat.color.setRGB(r, g, b)
      } else {
        // Magenta (#ff0055) → hot white (#ffaacc) as HP drops
        const r = 1.0
        const g = 0.0 + (1 - ratio) * 0.65
        const b = 0.33 + (1 - ratio) * 0.47
        mat.color.setRGB(r, g, b)
      }
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
      mass={isBoss ? 5 : 0.5}
      userData={{ type: 'enemy', id, isBoss }}
    >
      <BallCollider args={[colliderRadius]} friction={0} restitution={0} />

      {/* Click-to-follow: set this enemy as the tracked MOBA target */}
      <group
        onPointerDown={(e) => {
          e.stopPropagation()
          const store = useGameStore.getState()
          if (store.actionMode !== 'MOVE') return
          store.setMoveTarget({ type: 'entity', id })
        }}
      >
        {/* Virus visual group — rotation + pulse applied here,
            NOT on the physics body (lockRotations stays intact) */}
        <group ref={virusRef}>
          {isBoss ? (
            <>
              {/* ── BOSS: Gold icosahedron — meshBasicMaterial only ── */}
              <mesh ref={solidRef} castShadow>
                <icosahedronGeometry args={[VIRUS_RADIUS, 1]} />
                <meshBasicMaterial color="#ffaa00" />
              </mesh>

              {/* Wireframe shell — amber hologram */}
              <mesh>
                <icosahedronGeometry args={[WIRE_RADIUS, 1]} />
                <meshBasicMaterial
                  color="#ff8800"
                  wireframe
                  transparent
                  opacity={0.5}
                />
              </mesh>

              {/* Inner glow core */}
              <mesh>
                <icosahedronGeometry args={[VIRUS_RADIUS * 0.6, 0]} />
                <meshBasicMaterial
                  color="#ffdd44"
                  transparent
                  opacity={0.3}
                />
              </mesh>
            </>
          ) : (
            <>
              {/* ── NORMAL: Harsh magenta icosahedron ── */}
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
            </>
          )}
        </group>
      </group>

      {/* ── Siege Mode Laser (thin red beam to core) ── */}
      <mesh ref={siegeLaserRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ff2200" transparent opacity={0} />
      </mesh>

      {/* ── Boss Toll Billboard (drei Html — lightweight DOM overlay) ── */}
      {isBoss && (
        <Html
          position={[0, VIRUS_RADIUS * enemyScale + 1.5, 0]}
          center
          distanceFactor={20}
          sprite
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              fontFamily: "'Orbitron', 'Courier New', monospace",
              fontSize: '14px',
              fontWeight: 700,
              color: '#ffdd44',
              textShadow: '0 0 8px rgba(255,170,0,0.8), 0 0 20px rgba(255,136,0,0.4)',
              background: 'rgba(0,0,0,0.6)',
              padding: '3px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255,170,0,0.4)',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            💰 ${requiredMoney}
          </div>
        </Html>
      )}

      {/* Ground shadow ring — subtle positional indicator */}
      <mesh position={[0, -colliderRadius * 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[
          colliderRadius * 0.6,
          colliderRadius * 1.0,
          16
        ]} />
        <meshBasicMaterial
          color={isBoss ? '#ffaa00' : '#ff0055'}
          transparent
          opacity={isBoss ? 0.25 : 0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </RigidBody>
  )
}
