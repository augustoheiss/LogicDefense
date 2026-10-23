// ============================================================
// Logic Friction — Player Controller
// MOBA Edition: WASD + Tap-to-Move (A*) + Click-to-Follow +
//               Auto-Attack + Manual Attack (Spacebar override)
//
// HMR-FIX: Non-component exports (playerPositionRef, onPlayerAttack,
// fireAttack) moved to playerEvents.ts so this file only exports
// the PlayerController component.
// ============================================================
import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, BallCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'

// Reusable vectors — allocated once, never GC'd
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _moveDir = new THREE.Vector3()
const _prevOrbitTarget = new THREE.Vector3()
const _desiredTarget = new THREE.Vector3()
const _deltaTarget = new THREE.Vector3()
import { useKeyboard, keys } from '../hooks/useInput'
import { useGameStore } from '../state/useGameStore'
import { recordPointerDown, isCleanTapGesture } from '../hooks/useTouchCameraGate'
import { playerPositionRef, fireAttack } from './playerEvents'
import { enemyRegistry } from '../enemies/EnemyRegistry'
import { findPath } from './pathfinding'
import { soundEngine } from '../audio/soundEngine'
import {
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PLAYER_ATTACK_RANGE,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_COOLDOWN,
  CAMERA_LERP,
  BUFF_COOLDOWN_MULT,
  BUFF_DAMAGE_MULT,
  PLAYER_PULSE_COOLDOWN,
  PLAYER_PULSE_RANGE,
  PLAYER_PULSE_DAMAGE,
  ARENA_RADIUS,
} from '../config/constants'
import { getSharedPlaneGeometry, getSharedSpriteTexture, noRaycast } from '../sprites/spriteAtlasRegistry'
import { StackedBillboard25D } from '../sprites/Sprite25D'

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
  const avatar25DGroupRef = useRef<THREE.Group>(null)
  const flipXRef = useRef(false)
  const slashMeshRef = useRef<THREE.Mesh>(null)
  const ghost1MeshRef = useRef<THREE.Mesh>(null)
  const ghost2MeshRef = useRef<THREE.Mesh>(null)
  const ghostOffsetRef = useRef({ x: 0, z: 0 })
  const ghostRingBufRef = useRef(
    Array.from({ length: 8 }, () => ({ x: 0, z: 5.5 }))
  )
  const ghostRingHeadRef = useRef(0)
  const ghostSampleTimerRef = useRef(0)
  const attackAngleRef = useRef(0)
  const attackRingRef = useRef<THREE.Mesh>(null)
  const pulseRingRef = useRef<THREE.Mesh>(null)
  const merkabaRing1Ref = useRef<THREE.Mesh>(null)
  const merkabaRing2Ref = useRef<THREE.Mesh>(null)
  const { camera, controls } = useThree()

  // Selected range subscriptions
  const selectedEntity = useGameStore(s => s.selectedEntity)
  const setSelectedEntity = useGameStore(s => s.setSelectedEntity)
  const isBuffActive = useGameStore(s => s.isBuffActive)
  const insideMathZone = useGameStore(s => s.insideMathZone)
  const visualStyle = useGameStore(s => s.visualStyle)

  const planeGeo = getSharedPlaneGeometry()
  const slashTex = getSharedSpriteTexture('PLAYER_MELEE_SLASH')
  const buffBodyTex = getSharedSpriteTexture('PLAYER_ARCHITECT_BUFF')

  const effectiveRange = isBuffActive ? PLAYER_ATTACK_RANGE * 1.5 : PLAYER_ATTACK_RANGE

  const attackCooldownRef = useRef(0)
  const attackVisualRef = useRef(0)
  const pulseCooldownRef = useRef(0)
  const pulseVisualRef = useRef(0)
  const pathCacheRef = useRef<PathCache | null>(null)
  const lastEntityPosRef = useRef<{ x: number; z: number } | null>(null)
  const frameCountRef = useRef(0)

  // ── Wiggle sidestep state for auto-move ──
  const playerStuckTimerRef = useRef(0)
  const playerStuckPrevPosRef = useRef({ x: 0, z: 0 })
  const sidestepDirRef = useRef(1)        // +1 or -1: alternating L/R wiggle
  const slideRecalcTimerRef = useRef(0)   // Path recalc during wiggling

  useKeyboard()

  // ── Mount Diagnostic — helps debug tablet invisibility ──
  useEffect(() => {
    console.log('[PlayerController] Mounted. RigidBody ref:', rigidBodyRef.current ? 'READY' : 'NULL')
    // Check again after a short delay (Rapier may not be ready on first render)
    const timer = setTimeout(() => {
      const rb = rigidBodyRef.current
      if (rb) {
        const t = rb.translation()
        console.log(`[PlayerController] Post-init position: x=${t.x.toFixed(2)} y=${t.y.toFixed(2)} z=${t.z.toFixed(2)}`)
      } else {
        console.warn('[PlayerController] RigidBody still NULL after 500ms — physics may not be initialized')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  useFrame((_, delta) => {
    const rb = rigidBodyRef.current
    if (!rb) return

    // ── Startup Physics Lockdown ──
    // Rapier needs a few frames to build the BVH (collision tree).
    // Lock the player at spawn [0, 2, 5.5] (in front of CentralCore) for the first 10 frames
    // to prevent gravity from dropping it through the floor before collisions load.
    frameCountRef.current++
    if (frameCountRef.current <= 10) {
      rb.setTranslation({ x: 0, y: 2, z: 5.5 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      playerPositionRef.x = 0
      playerPositionRef.y = 2
      playerPositionRef.z = 5.5
      if (frameCountRef.current === 1) {
        console.log('[PlayerController] Frame 1 — physics lockdown active')
      }
      if (frameCountRef.current === 10) {
        const t = rb.translation()
        console.log(`[PlayerController] Frame 10 — lockdown released. Y=${t.y.toFixed(2)}`)
      }
      return
    }

    // ── Pause guard ──
    if (useGameStore.getState().isPaused) return

    // ── Update shared position ──
    const pos = rb.translation()

    // ── Diagnostic: log Y position for first 20 frames after lockdown ──
    if (frameCountRef.current <= 30) {
      console.log(`[PlayerController] Frame ${frameCountRef.current} — Y=${pos.y.toFixed(2)}`)
    }

    // ⚠️ NaN RESCUE: If physics returns NaN, force-teleport the player
    // back to a safe spawn instead of silently skipping (which causes
    // the mesh to stay at infinity on mobile tablets).
    if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
      console.warn('[PlayerController] ⚠️ Physics NaN detected! Rescuing player to [0, 2, 5.5]')
      rb.setTranslation({ x: 0, y: 2, z: 5.5 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
      return
    }

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

          // ── Pure Alternating Wiggle Sidestep ──
          // If barely moving, alternate L/R perpendicular to intended direction.
          // NEVER pushes backward — only sideways + slight forward (W+A / W+D).
          const prevSP = playerStuckPrevPosRef.current
          const moveDelta = Math.sqrt(
            (pos.x - prevSP.x) * (pos.x - prevSP.x) +
            (pos.z - prevSP.z) * (pos.z - prevSP.z)
          )
          if (moveDelta < 0.15) {
            playerStuckTimerRef.current += delta

            if (playerStuckTimerRef.current >= 0.25) {
              const dirLen = Math.sqrt(moveResult.vx * moveResult.vx + moveResult.vz * moveResult.vz)
              if (dirLen > 0.01) {
                const dirX = moveResult.vx / dirLen
                const dirZ = moveResult.vz / dirLen
                // Perpendicular sidestep vector
                const sideX = -dirZ * sidestepDirRef.current
                const sideZ = dirX * sidestepDirRef.current
                // Blend: 70% sideways + 30% forward
                const wiggleSpeed = PLAYER_SPEED * 0.95
                rb.setLinvel(
                  {
                    x: (sideX * 0.7 + dirX * 0.3) * wiggleSpeed,
                    y: rb.linvel().y,
                    z: (sideZ * 0.7 + dirZ * 0.3) * wiggleSpeed,
                  },
                  true
                )
              }

              // Flip direction every 0.5s for rapid L-R-L-R wiggle
              if (playerStuckTimerRef.current >= 0.75) {
                sidestepDirRef.current *= -1
                playerStuckTimerRef.current = 0.25 // Stay in wiggle mode
              }

              // Continuous path recalc every 0.3s
              slideRecalcTimerRef.current += delta
              if (slideRecalcTimerRef.current >= 0.3) {
                pathCacheRef.current = null
                slideRecalcTimerRef.current = 0
              }
            }
          } else {
            // Successfully moving — reset wiggle state
            playerStuckTimerRef.current = 0
            slideRecalcTimerRef.current = 0
          }
          playerStuckPrevPosRef.current = { x: pos.x, z: pos.z }
        } else {
          // Arrived or path failed — stop + reset
          const currentVel = rb.linvel()
          rb.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true)
          playerStuckTimerRef.current = 0
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
        attackVisualRef.current = 0.22
        attackAngleRef.current = Math.atan2(attackTarget.x - pos.x, attackTarget.z - pos.z)
        soundEngine.playPlayerAttack(buffed)
        fireAttack(pos.x, pos.z, effectiveDamage, effectiveRange)
      }
    }

    // ── Manual Spacebar AoE Ability: Pulso Lógico ──
    pulseCooldownRef.current = Math.max(0, pulseCooldownRef.current - delta)
    if (
      (state.phase === 'PLAYING' || state.phase === 'WAVE_CLEAR') &&
      keys['Space'] &&
      pulseCooldownRef.current <= 0 &&
      !state.isPlayerDead
    ) {
      const effectivePulseCooldown = buffed
        ? PLAYER_PULSE_COOLDOWN * BUFF_COOLDOWN_MULT
        : PLAYER_PULSE_COOLDOWN
      const effectivePulseDamage = buffed
        ? PLAYER_PULSE_DAMAGE * BUFF_DAMAGE_MULT
        : PLAYER_PULSE_DAMAGE
      const effectivePulseRange = buffed
        ? PLAYER_PULSE_RANGE * 1.35
        : PLAYER_PULSE_RANGE

      pulseCooldownRef.current = effectivePulseCooldown
      pulseVisualRef.current = 0.45
      soundEngine.playPlayerPulse()
      fireAttack(pos.x, pos.z, effectivePulseDamage, effectivePulseRange)
    }

    // ── Attack visual fade ──
    attackVisualRef.current = Math.max(0, attackVisualRef.current - delta)
    if (attackRingRef.current) {
      const mat = attackRingRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = attackVisualRef.current * 2
      const scale = 1 + (0.2 - attackVisualRef.current) * 5
      attackRingRef.current.scale.setScalar(Math.max(1, scale))

      // Update visibility dynamically to prevent any shadow rendering when inactive
      attackRingRef.current.visible = attackVisualRef.current > 0.01

      if (buffed) {
        mat.color.set('#ffd700')
      } else {
        mat.color.set('#ffffff')
      }
    }

    // ── Spacebar Pulse visual fade ──
    pulseVisualRef.current = Math.max(0, pulseVisualRef.current - delta)
    if (pulseRingRef.current) {
      const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial
      const pProgress = 1 - pulseVisualRef.current / 0.45
      mat.opacity = Math.max(0, (1 - pProgress) * 0.75)
      const pScale = 0.5 + pProgress * (buffed ? PLAYER_PULSE_RANGE * 1.35 : PLAYER_PULSE_RANGE)
      pulseRingRef.current.scale.setScalar(Math.max(0.5, pScale))
      pulseRingRef.current.visible = pulseVisualRef.current > 0.01
      mat.color.set(buffed ? '#ffd700' : '#00d4ff')
    }

    // ── Gyroscopic Merkaba Aura (mobile GPU-safe meshBasicMaterial rings) ──
    if (merkabaRing1Ref.current && merkabaRing2Ref.current) {
      merkabaRing1Ref.current.visible = buffed
      merkabaRing2Ref.current.visible = buffed
      if (buffed) {
        merkabaRing1Ref.current.rotation.x += delta * 2.8
        merkabaRing1Ref.current.rotation.y += delta * 1.9
        merkabaRing2Ref.current.rotation.y -= delta * 3.1
        merkabaRing2Ref.current.rotation.z += delta * 2.3
      }
    }

    // ── Buff visual: player glow ──
    // Disabled: meshBasicMaterial required for mobile GPU compatibility.
    // meshBasicMaterial has no emissive/transparency properties.
    // TODO: Restore when mobile shader compilation issue is resolved.
    // if (meshRef.current) {
    //   const mat = meshRef.current.material as THREE.MeshStandardMaterial
    //   if (buffed) {
    //     mat.emissive.set('#ffd700')
    //     mat.emissiveIntensity = 0.6 + Math.sin(Date.now() * 0.005) * 0.2
    //   } else {
    //     mat.emissive.set('#00ffcc')
    //     mat.emissiveIntensity = 0.2
    //   }
    //   const inZone = state.insideMathZone
    //   mat.transparent = inZone
    //   mat.opacity = inZone ? 0.3 : 1.0
    // }

    // ── 2.5D Walk-Cycle Squash/Stretch, Stride Tilt, Directional Flip & After-Image Ghost Trail ──
    const vel = rb.linvel()
    const speed = Math.hypot(vel.x, vel.z)
    const isMoving = speed > 0.6
    if (avatar25DGroupRef.current) {
      if (isMoving) {
        const lateralDot = vel.x * _right.x + vel.z * _right.z
        if (Math.abs(lateralDot) > 0.35) {
          flipXRef.current = lateralDot < 0
        }
      }
      const t = performance.now() * 0.001
      const bobY = isMoving ? Math.abs(Math.sin(t * 12)) * 0.16 : Math.sin(t * 2.6) * 0.04
      const squash = isMoving ? 1 + Math.sin(t * 24) * 0.07 : 1 + Math.sin(t * 2.6) * 0.025
      const strideTilt = isMoving ? Math.sin(t * 12) * 0.065 : 0
      avatar25DGroupRef.current.position.y = 0.35 + bobY
      avatar25DGroupRef.current.rotation.z = strideTilt
      avatar25DGroupRef.current.scale.set(1 / Math.sqrt(squash), squash, 1)
    }

    // ── After-Image Ghost Trail (Ring Buffer 60ms / 120ms echoes when buffed & moving) ──
    ghostSampleTimerRef.current += delta
    if (ghostSampleTimerRef.current >= 0.02) {
      ghostSampleTimerRef.current = 0
      const head = (ghostRingHeadRef.current + 1) & 7
      ghostRingHeadRef.current = head
      ghostRingBufRef.current[head].x = pos.x
      ghostRingBufRef.current[head].z = pos.z
    }

    if (ghost1MeshRef.current && ghost2MeshRef.current) {
      const targetGx = isMoving ? -vel.x * 0.085 : 0
      const targetGz = isMoving ? -vel.z * 0.085 : 0
      ghostOffsetRef.current.x += (targetGx - ghostOffsetRef.current.x) * Math.min(1, delta * 14)
      ghostOffsetRef.current.z += (targetGz - ghostOffsetRef.current.z) * Math.min(1, delta * 14)

      const slot60 = ghostRingBufRef.current[(ghostRingHeadRef.current + 5) & 7]
      const slot120 = ghostRingBufRef.current[(ghostRingHeadRef.current + 2) & 7]
      const hist1X = (slot60.x - pos.x) * 0.5 + ghostOffsetRef.current.x * 0.5
      const hist1Z = (slot60.z - pos.z) * 0.5 + ghostOffsetRef.current.z * 0.5
      const hist2X = (slot120.x - pos.x) * 0.5 + ghostOffsetRef.current.x * 0.95
      const hist2Z = (slot120.z - pos.z) * 0.5 + ghostOffsetRef.current.z * 0.95

      const trailMag = Math.hypot(hist1X, hist1Z)
      const showGhosts = buffed && trailMag > 0.1 && !state.insideMathZone
      ghost1MeshRef.current.visible = showGhosts
      ghost2MeshRef.current.visible = showGhosts

      if (showGhosts) {
        const yawToCam = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z)
        const dirSign = flipXRef.current ? -1 : 1
        ghost1MeshRef.current.position.set(hist1X, 0.48, hist1Z)
        ghost1MeshRef.current.rotation.set(0, yawToCam, 0)
        ghost1MeshRef.current.scale.set(1.85 * dirSign, 2.15, 1)

        ghost2MeshRef.current.position.set(hist2X, 0.44, hist2Z)
        ghost2MeshRef.current.rotation.set(0, yawToCam, 0)
        ghost2MeshRef.current.scale.set(1.7 * dirSign, 2.0, 1)
      }
    }

    if (slashMeshRef.current) {
      const activeSlash = attackVisualRef.current > 0.01
      slashMeshRef.current.visible = activeSlash
      if (activeSlash) {
        const progress = 1 - attackVisualRef.current / 0.22
        const sScale = 2.4 + progress * (buffed ? 3.6 : 2.2)
        slashMeshRef.current.scale.set(sScale, sScale, 1)
        slashMeshRef.current.rotation.z = -attackAngleRef.current + (progress - 0.5) * 1.4
        const sMat = slashMeshRef.current.material as THREE.MeshBasicMaterial
        sMat.opacity = Math.max(0, (1 - progress) * 0.95)
        sMat.color.set(buffed ? '#ffd700' : '#38bdf8')
      }
    }

    // ── Drift-Free Camera Follow + Velocity Look-Ahead (OrbitControls-aware) ──
    const orbitTarget = (controls as unknown as { target?: THREE.Vector3 })?.target
    if (orbitTarget) {
      let lookX = 0
      let lookZ = 0
      if (state.cameraMode === 'BALANCED' && isMoving) {
        lookX = Math.max(-2.0, Math.min(2.0, vel.x * 0.15))
        lookZ = Math.max(-2.0, Math.min(2.0, vel.z * 0.15))
      }
      _desiredTarget.set(pos.x + lookX, 0, pos.z + lookZ)
      _prevOrbitTarget.copy(orbitTarget)
      orbitTarget.lerp(_desiredTarget, CAMERA_LERP)
      // Translate camera.position by the exact same delta so spherical distance & pitch never drift!
      _deltaTarget.copy(orbitTarget).sub(_prevOrbitTarget)
      camera.position.add(_deltaTarget)
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
      position={[0, 2, 5.5]}
      lockRotations
      linearDamping={4}
      mass={1}
      userData={{ type: 'player' }}
    >
      <BallCollider args={[PLAYER_RADIUS]} friction={0} restitution={0} />

      {/* Player orb group — Y=0.6 so the sphere (r=0.6) hovers just above the floor */}
      <group name="player" frustumCulled={false} position={[0, 0.6, 0]}>
        {/* Sphere avatar / compact click hitbox — meshBasicMaterial for mobile GPU safety */}
        <mesh
          ref={meshRef}
          castShadow={false}
          frustumCulled={false}
          renderOrder={1}
          onPointerDown={(e) => {
            recordPointerDown(e.nativeEvent.clientX, e.nativeEvent.clientY)
          }}
          onPointerUp={(e) => {
            if (!isCleanTapGesture(e.nativeEvent.clientX, e.nativeEvent.clientY)) return
            e.stopPropagation()
            setSelectedEntity({ id: 'player', type: 'player' })
          }}
        >
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshBasicMaterial
            color={isBuffActive ? '#ffd700' : '#00ffcc'}
            transparent={visualStyle === '2.5D' || insideMathZone}
            opacity={visualStyle === '2.5D' ? 0 : insideMathZone ? 0.3 : 1}
            depthWrite={visualStyle !== '2.5D'}
          />
        </mesh>

        {/* 2.5D Multi-Layer Logic Architect Sprite Stack */}
        {visualStyle === '2.5D' && (
          <>
            <group ref={avatar25DGroupRef} position={[0, 0.35, 0]}>
              <StackedBillboard25D
                yOffset={0.15}
                flipXRef={flipXRef}
                opacity={insideMathZone ? 0.38 : 1}
                tint={isBuffActive ? '#fffbeb' : '#ffffff'}
                layers={[
                  ...(isBuffActive
                    ? [
                        {
                          spriteKey: 'PLAYER_DIVINE_WINGS' as const,
                          zOffset: -0.22,
                          width: 3.2,
                          height: 2.8,
                          opacity: 0.94,
                          additive: true,
                          pulseSpeed: 4.5,
                          pulseAmplitude: 0.08,
                        },
                      ]
                    : []),
                  {
                    spriteKey: 'PLAYER_ARCHITECT_CLOAK',
                    zOffset: -0.1,
                    width: 2.1,
                    height: 2.35,
                    opacity: 0.95,
                  },
                  {
                    spriteKey: isBuffActive ? 'PLAYER_ARCHITECT_BUFF' : 'PLAYER_ARCHITECT_BODY',
                    zOffset: 0.0,
                    width: 1.95,
                    height: 2.25,
                    opacity: 0.99,
                    flipbookFps: 8,
                  },
                  {
                    spriteKey: 'PLAYER_ARCHITECT_STAFF',
                    zOffset: 0.14,
                    width: 2.0,
                    height: 2.3,
                    opacity: 0.99,
                    pulseSpeed: 3.2,
                    pulseAmplitude: 0.04,
                  },
                ]}
              />
            </group>

            {/* 2.5D After-Image Ghost Trail (Divine Buff Speed Echoes) */}
            <mesh
              ref={ghost1MeshRef}
              geometry={planeGeo}
              visible={false}
              frustumCulled={false}
              renderOrder={2}
              raycast={noRaycast}
            >
              <meshBasicMaterial
                map={buffBodyTex}
                color="#ffd700"
                transparent
                alphaTest={0.05}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
                opacity={0.45}
              />
            </mesh>
            <mesh
              ref={ghost2MeshRef}
              geometry={planeGeo}
              visible={false}
              frustumCulled={false}
              renderOrder={2}
              raycast={noRaycast}
            >
              <meshBasicMaterial
                map={buffBodyTex}
                color="#fef08a"
                transparent
                alphaTest={0.05}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
                opacity={0.25}
              />
            </mesh>

            {/* 2.5D Directional Melee Slash Arc */}
            <mesh
              ref={slashMeshRef}
              geometry={planeGeo}
              position={[0, 0.05, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              visible={false}
              frustumCulled={false}
              renderOrder={4}
              raycast={noRaycast}
            >
              <meshBasicMaterial
                map={slashTex}
                transparent
                alphaTest={0.02}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
                opacity={0}
              />
            </mesh>
          </>
        )}

        {/* Gyroscopic Merkaba Aura (visible when Divine Buff is active — mobile GPU safe) */}
        <mesh ref={merkabaRing1Ref} visible={false} frustumCulled={false} raycast={noRaycast}>
          <torusGeometry args={[0.92, 0.045, 8, 28]} />
          <meshBasicMaterial color="#ffd700" transparent opacity={0.85} depthWrite={false} />
        </mesh>
        <mesh ref={merkabaRing2Ref} visible={false} frustumCulled={false} raycast={noRaycast}>
          <torusGeometry args={[1.12, 0.035, 8, 28]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.7} depthWrite={false} />
        </mesh>

        {/* Attack range ring (visible on attack) */}
        <mesh
          ref={attackRingRef}
          position={[0, -0.35, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          frustumCulled={false}
          visible={false}
          raycast={noRaycast}
        >
          <ringGeometry args={[PLAYER_ATTACK_RANGE * 0.8, PLAYER_ATTACK_RANGE, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>

        {/* Spacebar Manual Pulse Shockwave Ring */}
        <mesh
          ref={pulseRingRef}
          position={[0, -0.32, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          frustumCulled={false}
          visible={false}
          raycast={noRaycast}
        >
          <ringGeometry args={[0.82, 1.0, 40]} />
          <meshBasicMaterial
            color="#00d4ff"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Selected range ring (visible when player is selected) */}
        {selectedEntity?.type === 'player' && (
          <mesh
            position={[0, -0.38, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            frustumCulled={false}
            raycast={noRaycast}
          >
            <ringGeometry args={[effectiveRange - 0.25, effectiveRange, 64]} />
            <meshBasicMaterial
              color={isBuffActive ? '#ffd700' : '#00ffcc'}
              transparent
              opacity={0.12}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>
    </RigidBody>
  )
}
