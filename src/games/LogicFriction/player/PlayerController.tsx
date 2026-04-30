// ============================================================
// Logic Friction — Player Controller
// Sprint 4.1: WASD movement + Spacebar melee attack + Divine Buff
// + Math Zone transparency effect
//
// HMR-FIX: Non-component exports (playerPositionRef, onPlayerAttack,
// fireAttack) moved to playerEvents.ts so this file only exports
// the PlayerController component. This prevents Vite from doing
// full page reloads that crash the Physics tree.
// ============================================================
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, BallCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useKeyboard, keys } from '../hooks/useInput'
import { useGameStore } from '../state/useGameStore'
import { playerPositionRef, fireAttack } from './playerEvents'
import {
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PLAYER_ATTACK_RANGE,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_COOLDOWN,
  CAMERA_OFFSET,
  CAMERA_LERP,
  BUFF_DAMAGE_MULT,
  BUFF_COOLDOWN_MULT,
} from '../config/constants'

// ── Player Component ────────────────────────────────────────────────────────────
export function PlayerController() {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const attackRingRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  const attackCooldownRef = useRef(0)
  const attackVisualRef = useRef(0)

  useKeyboard()

  useFrame((_, delta) => {
    const rb = rigidBodyRef.current
    if (!rb) return

    // ── Update shared position ──
    const pos = rb.translation()
    playerPositionRef.x = pos.x
    playerPositionRef.y = pos.y
    playerPositionRef.z = pos.z

    const state = useGameStore.getState()
    const buffed = state.isBuffActive

    // ── Movement ──
    if (state.phase === 'PLAYING' || state.phase === 'WAVE_CLEAR') {
      let moveX = 0
      let moveZ = 0

      if (keys['KeyW'] || keys['ArrowUp'])    moveZ -= 1
      if (keys['KeyS'] || keys['ArrowDown'])  moveZ += 1
      if (keys['KeyA'] || keys['ArrowLeft'])   moveX -= 1
      if (keys['KeyD'] || keys['ArrowRight']) moveX += 1

      const len = Math.sqrt(moveX * moveX + moveZ * moveZ)
      if (len > 0) {
        moveX = (moveX / len) * PLAYER_SPEED
        moveZ = (moveZ / len) * PLAYER_SPEED
      }

      const currentVel = rb.linvel()
      rb.setLinvel({ x: moveX, y: currentVel.y, z: moveZ }, true)
    } else {
      const currentVel = rb.linvel()
      rb.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true)
    }

    // ── Attack (Spacebar) — with buff multipliers ──
    const effectiveCooldown = buffed ? PLAYER_ATTACK_COOLDOWN * BUFF_COOLDOWN_MULT : PLAYER_ATTACK_COOLDOWN
    const effectiveDamage = buffed ? PLAYER_ATTACK_DAMAGE * BUFF_DAMAGE_MULT : PLAYER_ATTACK_DAMAGE
    const effectiveRange = buffed ? PLAYER_ATTACK_RANGE * 1.5 : PLAYER_ATTACK_RANGE

    attackCooldownRef.current = Math.max(0, attackCooldownRef.current - delta)

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

      // Buff visual: golden attack ring
      if (buffed) {
        mat.color.set('#ffd700')
      } else {
        mat.color.set('#ffffff')
      }
    }

    // ── Buff visual: player glow ──
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      if (buffed) {
        mat.emissive.set('#ffd700')
        mat.emissiveIntensity = 0.6 + Math.sin(Date.now() * 0.005) * 0.2
      } else {
        mat.emissive.set('#00ff88')
        mat.emissiveIntensity = 0.4
      }

      // ── Math Zone transparency ──
      const inZone = state.insideMathZone
      mat.transparent = inZone
      mat.opacity = inZone ? 0.3 : 1.0
    }

    // ── Camera Follow ──
    const targetCamPos = new THREE.Vector3(
      pos.x + CAMERA_OFFSET.x,
      CAMERA_OFFSET.y,
      pos.z + CAMERA_OFFSET.z,
    )
    camera.position.lerp(targetCamPos, CAMERA_LERP)
    camera.lookAt(pos.x, 0, pos.z)
  })

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
      <group name="player">
        {/* Player capsule */}
        <mesh ref={meshRef} castShadow>
          <capsuleGeometry args={[PLAYER_RADIUS, PLAYER_RADIUS * 1.2, 8, 16]} />
          <meshStandardMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={0.4}
            metalness={0.3}
            roughness={0.4}
            transparent
            opacity={1}
          />
        </mesh>

        {/* Idle glow ring */}
        <mesh position={[0, -PLAYER_RADIUS * 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[PLAYER_RADIUS * 0.9, PLAYER_RADIUS * 1.3, 32]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.25} side={THREE.DoubleSide} />
        </mesh>

        {/* Attack range ring (visible on attack) */}
        <mesh
          ref={attackRingRef}
          position={[0, -PLAYER_RADIUS * 0.7, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[PLAYER_ATTACK_RANGE * 0.8, PLAYER_ATTACK_RANGE, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </RigidBody>
  )
}
