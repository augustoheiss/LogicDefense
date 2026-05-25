// ============================================================
// Logic Friction — Arena (Floor + Grid + Boundary Walls)
// Sprint 3: Added onPointerDown click-to-place for towers
// ============================================================
import { useRef, useEffect, useCallback } from 'react'
import { RigidBody, CylinderCollider } from '@react-three/rapier'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  ARENA_RADIUS,
  ARENA_HEIGHT,
  ARENA_SEGMENTS,
  ARENA_WALL_HEIGHT,
  ARENA_WALL_SEGMENTS,
  ARENA_WALL_THICKNESS,
  CORE_COLLIDER_SIZE,
} from '../config/constants'
import { useGameStore } from '../state/useGameStore'

// ── Arena Floor ─────────────────────────────────────────────────────────────────
export function Arena() {
  // ── Click handler: mode-aware (BUILD places towers, MOVE sets pathfinding target) ──
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    // Only left-click
    if (e.button !== 0) return
    // Stop propagation so Canvas doesn't steal the event
    e.stopPropagation()

    const state = useGameStore.getState()
    state.setSelectedEntity(null)
    if (state.phase !== 'PLAYING' && state.phase !== 'WAVE_CLEAR') return

    const point = e.point
    const distFromCenter = Math.sqrt(point.x * point.x + point.z * point.z)

    // ── BUILD MODE: Place construction site ──
    if (state.actionMode === 'BUILD') {
      // Guard: don't place inside the core's physics collider (tiny clearance)
      if (distFromCenter < CORE_COLLIDER_SIZE + 0.5) return
      // Guard: don't place outside the arena
      if (distFromCenter > ARENA_RADIUS - 3) return
      state.placeConstructionSite(point.x, point.z)
      return
    }

    // ── MOVE MODE: Set pathfinding target ──
    // Guard: don't move outside the arena
    if (distFromCenter > ARENA_RADIUS - 1) return
    state.setMoveTarget({ type: 'point', x: point.x, z: point.z })
  }, [])

  return (
    <RigidBody type="fixed" colliders={false} position={[0, -ARENA_HEIGHT / 2, 0]}>
      <CylinderCollider args={[ARENA_HEIGHT / 2, ARENA_RADIUS]} />
      <mesh receiveShadow onPointerDown={handlePointerDown}>
        <cylinderGeometry args={[ARENA_RADIUS, ARENA_RADIUS, ARENA_HEIGHT, ARENA_SEGMENTS]} />
        <meshStandardMaterial
          color="#0a0a1a"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      <ArenaGrid />
    </RigidBody>
  )
}

// ── Procedural grid lines ───────────────────────────────────────────────────────
function ArenaGrid() {
  const gridRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!gridRef.current) return
    const group = gridRef.current

    // Concentric rings
    const ringMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.08 })
    for (let r = 5; r <= ARENA_RADIUS; r += 5) {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(angle) * r, 0.01, Math.sin(angle) * r))
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      group.add(new THREE.Line(geo, ringMat))
    }

    // Radial spokes
    const spokeMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.05 })
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2
      const pts = [
        new THREE.Vector3(0, 0.01, 0),
        new THREE.Vector3(Math.cos(angle) * ARENA_RADIUS, 0.01, Math.sin(angle) * ARENA_RADIUS),
      ]
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      group.add(new THREE.Line(geo, spokeMat))
    }

    return () => {
      group.children.forEach(child => {
        if (child instanceof THREE.Line) child.geometry.dispose()
      })
    }
  }, [])

  return <group ref={gridRef} position={[0, ARENA_HEIGHT / 2, 0]} />
}

// ── Arena Boundary Walls ────────────────────────────────────────────────────────
export function ArenaBoundary() {
  return (
    <RigidBody type="fixed" colliders={false} position={[0, ARENA_WALL_HEIGHT / 2, 0]}>
      {Array.from({ length: ARENA_WALL_SEGMENTS }).map((_, i) => {
        const angle = (i / ARENA_WALL_SEGMENTS) * Math.PI * 2
        const nextAngle = ((i + 1) / ARENA_WALL_SEGMENTS) * Math.PI * 2
        const midAngle = (angle + nextAngle) / 2
        const x = Math.cos(midAngle) * (ARENA_RADIUS + ARENA_WALL_THICKNESS / 2)
        const z = Math.sin(midAngle) * (ARENA_RADIUS + ARENA_WALL_THICKNESS / 2)
        const segLength = 2 * (ARENA_RADIUS + ARENA_WALL_THICKNESS) * Math.sin(Math.PI / ARENA_WALL_SEGMENTS)

        return (
          <RigidBody
            key={i}
            type="fixed"
            position={[x, ARENA_WALL_HEIGHT / 2, z]}
            rotation={[0, -midAngle + Math.PI / 2, 0]}
          >
            <mesh>
              <boxGeometry args={[segLength, ARENA_WALL_HEIGHT, ARENA_WALL_THICKNESS]} />
              <meshStandardMaterial
                color="#00d4ff"
                transparent
                opacity={0.04}
                emissive="#00d4ff"
                emissiveIntensity={0.3}
              />
            </mesh>
          </RigidBody>
        )
      })}
    </RigidBody>
  )
}

// ── Lighting ────────────────────────────────────────────────────────────────────
export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.3} color="#334466" />
      <directionalLight
        position={[20, 40, 20]}
        intensity={1.2}
        color="#eeeeff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={120}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <pointLight position={[0, -2, 0]} intensity={0.5} color="#00d4ff" distance={80} />
    </>
  )
}
