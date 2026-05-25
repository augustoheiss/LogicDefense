// ============================================================
// Logic Friction — Player Controller
// MOBA Edition: WASD + Tap-to-Move (A*) + Click-to-Follow +
//               Auto-Attack + Manual Attack (Spacebar override)
//
// HMR-FIX: Non-component exports (playerPositionRef, onPlayerAttack,
// fireAttack) moved to playerEvents.ts so this file only exports
// the PlayerController component.
// ============================================================
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, BallCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'

// Reusable vectors — allocated once, never GC'd
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _moveDir = new THREE.Vector3()
import { useKeyboard, keys } from '../hooks/useInput'
import { useGameStore } from '../state/useGameStore'
import { playerPositionRef, fireAttack } from './playerEvents'
import { enemyRegistry } from '../enemies/EnemyRegistry'
import { findPath } from './pathfinding'
import {
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PLAYER_ATTACK_RANGE,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_COOLDOWN,
  CAMERA_LERP,
  BUFF_DAMAGE_MULT,
  BUFF_COOLDOWN_MULT,
  ARENA_RADIUS,
} from '../config/constants'

// ── Pathfinding cache ──
// Only recalculate A* when the target or obstacle count changes
interface PathCache {
  targetKey: string
  obstacleCount: number
  waypoints: Array<{ x: number; z: number }>
  waypointIndex: number
}

const WAYPOINT_REACH_DIST = 1.5    // How close to waypoint before advancing
const ENTITY_RECALC_DIST = 2.0     // Recalc path if entity moved > this

// ── Player Component ────────────────────────────────────────────────────────────
export function PlayerController() {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const attackRingRef = useRef<THREE.Mesh>(null)
  const { camera, controls } = useThree()

  const attackCooldownRef = useRef(0)
  const attackVisualRef = useRef(0)
  const pathCacheRef = useRef<PathCache | null>(null)
  const lastEntityPosRef = useRef<{ x: number; z: number } | null>(null)

  useKeyboard()

  useFrame((_, delta) => {
    const rb = rigidBodyRef.current
    if (!rb) return

    // ── Update shared position ──
    const pos = rb.translation()

    // ⚠️ NaN SAFETY: If physics returns NaN, skip entire frame to prevent
    // position poisoning that makes the mesh vanish on mobile.
    if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) return

    playerPositionRef.x = pos.x
    playerPositionRef.y = pos.y
    playerPositionRef.z = pos.z

    const state = useGameStore.getState()
    const buffed = state.isBuffActive

    // ── Buff-scaled combat stats ──
    const effectiveCooldown = buffed ? PLAYER_ATTACK_COOLDOWN * BUFF_COOLDOWN_MULT : PLAYER_ATTACK_COOLDOWN
    const effectiveDamage = buffed ? PLAYER_ATTACK_DAMAGE * BUFF_DAMAGE_MULT : PLAYER_ATTACK_DAMAGE
    const effectiveRange = buffed ? PLAYER_ATTACK_RANGE * 1.5 : PLAYER_ATTACK_RANGE

    // ── Detect WASD input ──
    const hasWASD = !!(
      keys['KeyW'] || keys['ArrowUp'] ||
      keys['KeyS'] || keys['ArrowDown'] ||
      keys['KeyA'] || keys['ArrowLeft'] ||
      keys['KeyD'] || keys['ArrowRight']
    )

    // ── WASD cancels auto-move ──
    if (hasWASD && state.moveTarget !== null) {
      useGameStore.getState().setMoveTarget(null)
      pathCacheRef.current = null
      lastEntityPosRef.current = null
    }

    // ── Movement Logic ──
    if (state.phase === 'PLAYING' || state.phase === 'WAVE_CLEAR') {
      // Camera vectors for relative movement
      camera.getWorldDirection(_forward)
      _forward.y = 0
      _forward.normalize()
      _right.crossVectors(_forward, camera.up).normalize()

      if (hasWASD) {
        // ── Manual WASD movement ──
        let inputZ = 0
        let inputX = 0

        if (keys['KeyW'] || keys['ArrowUp'])    inputZ += 1
        if (keys['KeyS'] || keys['ArrowDown'])  inputZ -= 1
        if (keys['KeyA'] || keys['ArrowLeft'])   inputX -= 1
        if (keys['KeyD'] || keys['ArrowRight']) inputX += 1

        _moveDir.set(0, 0, 0)
        _moveDir.addScaledVector(_forward, inputZ)
        _moveDir.addScaledVector(_right, inputX)

        if (_moveDir.lengthSq() > 0) {
          _moveDir.normalize().multiplyScalar(PLAYER_SPEED)
        }

        const currentVel = rb.linvel()
        rb.setLinvel({ x: _moveDir.x, y: currentVel.y, z: _moveDir.z }, true)

      } else if (state.moveTarget !== null) {
        // ── Auto-Move (pathfinding) ──
        const moveResult = processAutoMove(pos, state, effectiveRange)

        if (moveResult) {
          const currentVel = rb.linvel()
          rb.setLinvel({ x: moveResult.vx, y: currentVel.y, z: moveResult.vz }, true)
        } else {
          // Arrived or path failed — stop
          const currentVel = rb.linvel()
          rb.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true)
        }

      } else {
        // No input and no target — stop
        const currentVel = rb.linvel()
        rb.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true)
      }
    } else {
      const currentVel = rb.linvel()
      rb.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true)
    }

    // ── Arena Leash (radial clamp — no physics walls needed) ──
    const LEASH = ARENA_RADIUS - PLAYER_RADIUS - 0.5
    const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z)
    if (dist > LEASH && dist > 0.001) {  // ⚠️ Guard: dist=0 causes NaN from 0/0
      const scale = LEASH / dist
      rb.setTranslation({ x: pos.x * scale, y: pos.y, z: pos.z * scale }, true)
      const vel = rb.linvel()
      const nx = pos.x / dist
      const nz = pos.z / dist
      if (!isNaN(nx) && !isNaN(nz)) {  // ⚠️ Extra NaN guard
        const radialSpeed = vel.x * nx + vel.z * nz
        if (radialSpeed > 0) {
          rb.setLinvel({ x: vel.x - radialSpeed * nx, y: vel.y, z: vel.z - radialSpeed * nz }, true)
        }
      }
    }

    // ── Auto-Attack: fire at nearest enemy in range ──
    attackCooldownRef.current = Math.max(0, attackCooldownRef.current - delta)

    if (state.phase === 'PLAYING' && attackCooldownRef.current <= 0) {
      // Find the priority target (tracked entity) or nearest enemy
      let attackTarget: { x: number; z: number } | null = null
      let attackDist = Infinity

      // Priority: tracked entity
      if (state.moveTarget?.type === 'entity') {
        const entry = enemyRegistry.get(state.moveTarget.id)
        if (entry) {
          const dx = entry.x - pos.x
          const dz = entry.z - pos.z
          const d = Math.sqrt(dx * dx + dz * dz)
          if (d <= effectiveRange) {
            attackTarget = entry
            attackDist = d
          }
        }
      }

      // Fallback: nearest enemy in range
      if (!attackTarget) {
        for (const [, entry] of enemyRegistry) {
          const dx = entry.x - pos.x
          const dz = entry.z - pos.z
          const d = Math.sqrt(dx * dx + dz * dz)
          if (d <= effectiveRange && d < attackDist) {
            attackTarget = entry
            attackDist = d
          }
        }
      }

      if (attackTarget) {
        attackCooldownRef.current = effectiveCooldown
        attackVisualRef.current = 0.2
        fireAttack(pos.x, pos.z, effectiveDamage, effectiveRange)
      }
    }

    // ── Manual Attack Override (Spacebar) ──
    if (keys['Space'] && attackCooldownRef.current <= 0 && state.phase === 'PLAYING') {
      attackCooldownRef.current = effectiveCooldown
      attackVisualRef.current = 0.2
      fireAttack(pos.x, pos.z, effectiveDamage, effectiveRange)
    }

    // ── Attack visual fade ──
    attackVisualRef.current = Math.max(0, attackVisualRef.current - delta)
    if (attackRingRef.current) {
      const mat = attackRingRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = attackVisualRef.current * 2
      const scale = 1 + (0.2 - attackVisualRef.current) * 5
      attackRingRef.current.scale.setScalar(Math.max(1, scale))

      if (buffed) {
        mat.color.set('#ffd700')
      } else {
        mat.color.set('#ffffff')
      }
    }

    // ── Buff visual: player glow ──
    // ⚠️ NUCLEAR DEBUG: Disabled — meshBasicMaterial has no emissive/transparency.
    // Restore this block when switching back to meshStandardMaterial.
    // if (meshRef.current) {
    //   const mat = meshRef.current.material as THREE.MeshStandardMaterial
    //   if (buffed) {
    //     mat.emissive.set('#ffd700')
    //     mat.emissiveIntensity = 0.6 + Math.sin(Date.now() * 0.005) * 0.2
    //   } else {
    //     mat.emissive.set('#00ff88')
    //     mat.emissiveIntensity = 0.4
    //   }
    //   const inZone = state.insideMathZone
    //   mat.transparent = inZone
    //   mat.opacity = inZone ? 0.3 : 1.0
    // }

    // ── Camera Follow (OrbitControls-aware) ──
    const orbitTarget = (controls as any)?.target as THREE.Vector3 | undefined
    if (orbitTarget) {
      const playerPos = new THREE.Vector3(pos.x, 0, pos.z)
      orbitTarget.lerp(playerPos, CAMERA_LERP)
    }
  })

  // ── Auto-Move processor ──
  // Returns { vx, vz } if the player should keep moving, or null to stop
  function processAutoMove(
    pos: { x: number; y: number; z: number },
    state: ReturnType<typeof useGameStore.getState>,
    attackRange: number,
  ): { vx: number; vz: number } | null {
    const target = state.moveTarget
    if (!target) return null

    // ── Resolve target position ──
    let targetX: number
    let targetZ: number

    if (target.type === 'point') {
      targetX = target.x
      targetZ = target.z
    } else {
      // Entity target — get live position from registry
      const entry = enemyRegistry.get(target.id)
      if (!entry) {
        // Entity died or despawned — cancel chase
        useGameStore.getState().setMoveTarget(null)
        pathCacheRef.current = null
        lastEntityPosRef.current = null
        return null
      }
      targetX = entry.x
      targetZ = entry.z

      // MOBA Chase: if within attack range, STOP and let auto-attack handle it
      const chaseDx = targetX - pos.x
      const chaseDz = targetZ - pos.z
      const chaseDist = Math.sqrt(chaseDx * chaseDx + chaseDz * chaseDz)
      if (chaseDist <= attackRange) {
        return null // Stop moving, auto-attack will fire
      }

      // Check if entity moved enough to warrant path recalculation
      if (lastEntityPosRef.current) {
        const movedDx = targetX - lastEntityPosRef.current.x
        const movedDz = targetZ - lastEntityPosRef.current.z
        const movedDist = Math.sqrt(movedDx * movedDx + movedDz * movedDz)
        if (movedDist > ENTITY_RECALC_DIST) {
          pathCacheRef.current = null // Force recalc
        }
      }
      lastEntityPosRef.current = { x: targetX, z: targetZ }
    }

    // ── Check arrival (for point targets) ──
    if (target.type === 'point') {
      const arrivalDx = targetX - pos.x
      const arrivalDz = targetZ - pos.z
      const arrivalDist = Math.sqrt(arrivalDx * arrivalDx + arrivalDz * arrivalDz)
      if (arrivalDist < WAYPOINT_REACH_DIST) {
        useGameStore.getState().setMoveTarget(null)
        pathCacheRef.current = null
        return null
      }
    }

    // ── Calculate or use cached path ──
    const obstacles = [...state.towers, ...state.constructionSites]
    const targetKey = `${Math.round(targetX)},${Math.round(targetZ)}`

    if (
      !pathCacheRef.current ||
      pathCacheRef.current.targetKey !== targetKey ||
      pathCacheRef.current.obstacleCount !== obstacles.length
    ) {
      // Recalculate path
      const waypoints = findPath(pos.x, pos.z, targetX, targetZ, obstacles)
      if (!waypoints || waypoints.length === 0) {
        // No path — try direct movement as fallback
        const dx = targetX - pos.x
        const dz = targetZ - pos.z
        const d = Math.sqrt(dx * dx + dz * dz)
        if (d < 0.5) {
          useGameStore.getState().setMoveTarget(null)
          pathCacheRef.current = null
          return null
        }
        return { vx: (dx / d) * PLAYER_SPEED, vz: (dz / d) * PLAYER_SPEED }
      }
      pathCacheRef.current = {
        targetKey,
        obstacleCount: obstacles.length,
        waypoints,
        waypointIndex: 0,
      }
    }

    const cache = pathCacheRef.current

    // ── Follow waypoints ──
    if (cache.waypointIndex >= cache.waypoints.length) {
      // All waypoints consumed — move directly to final target
      const dx = targetX - pos.x
      const dz = targetZ - pos.z
      const d = Math.sqrt(dx * dx + dz * dz)
      if (d < WAYPOINT_REACH_DIST) {
        if (target.type === 'point') {
          useGameStore.getState().setMoveTarget(null)
          pathCacheRef.current = null
        }
        return null
      }
      return { vx: (dx / d) * PLAYER_SPEED, vz: (dz / d) * PLAYER_SPEED }
    }

    const wp = cache.waypoints[cache.waypointIndex]
    const wpDx = wp.x - pos.x
    const wpDz = wp.z - pos.z
    const wpDist = Math.sqrt(wpDx * wpDx + wpDz * wpDz)

    // Reached this waypoint — advance to next
    if (wpDist < WAYPOINT_REACH_DIST) {
      cache.waypointIndex++
      return processAutoMove(pos, state, attackRange) // Recurse for next wp
    }

    // Move toward current waypoint
    return { vx: (wpDx / wpDist) * PLAYER_SPEED, vz: (wpDz / wpDist) * PLAYER_SPEED }
  }

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      colliders={false}
      position={[0, 2, 0]}
      lockRotations
      linearDamping={4}
      mass={1}
      userData={{ type: 'player' }}
    >
      <BallCollider args={[PLAYER_RADIUS]} />

      {/* Named group so scene.getObjectByName('player') can find us */}
      {/* Y=1.0 lifts visuals well above the arena floor for mobile depth buffers */}
      {/* ⚠️ NUCLEAR DEBUG: scale={[2,2,2]} tests if tablet was rendering it microscopically */}
      <group name="player" frustumCulled={false} position={[0, 1.0, 0]} scale={[2, 2, 2]}>
        {/* ⚠️ MINECRAFT FALLBACK: boxGeometry is the cheapest, most universally
            supported WebGL primitive. If the tablet GPU failed on CapsuleGeometry
            vertices, this cube WILL render. */}
        <mesh ref={meshRef} castShadow={false} frustumCulled={false} renderOrder={1}>
          <boxGeometry args={[2, 2, 2]} />
          <meshBasicMaterial color="red" />
        </mesh>

        {/* ⚠️ NUCLEAR DEBUG: Transparent rings HIDDEN — mobile depth buffers
            break when sorting multiple transparent objects near the floor.
            Uncomment when meshBasicMaterial confirms the avatar renders. */}
        {/* Idle glow ring
        <mesh position={[0, -PLAYER_RADIUS * 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
          <ringGeometry args={[PLAYER_RADIUS * 0.9, PLAYER_RADIUS * 1.3, 32]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.25} side={THREE.DoubleSide} />
        </mesh>
        */}

        {/* Attack range ring — also hidden for nuclear test
        <mesh
          ref={attackRingRef}
          position={[0, -PLAYER_RADIUS * 0.7, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          frustumCulled={false}
        >
          <ringGeometry args={[PLAYER_ATTACK_RANGE * 0.8, PLAYER_ATTACK_RANGE, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
        */}
      </group>
    </RigidBody>
  )
}
