// ============================================================
// Logic Friction — Arena (Cyber-Grid Floor + Neon Grid + Pillars)
// Sci-Fi Tetris aesthetic — PERFORMANCE-SAFE: zero dynamic lights
// in pillars, Lambert/Basic materials only, minimal useFrame cost.
// ============================================================
import { useRef, useEffect, useCallback, useMemo } from 'react'
import { RigidBody, CylinderCollider } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  ARENA_RADIUS,
  ARENA_SEGMENTS,
  ARENA_WALL_HEIGHT,
  ARENA_WALL_SEGMENTS,
  ARENA_WALL_THICKNESS,
  CORE_COLLIDER_SIZE,
} from '../config/constants'
import { useGameStore } from '../state/useGameStore'

// ── Slab thickness for the "motherboard" look ──────────────────────────────────
const SLAB_THICKNESS = 2

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
    <RigidBody type="fixed" colliders={false} position={[0, -SLAB_THICKNESS / 2, 0]}>
      <CylinderCollider args={[SLAB_THICKNESS / 2, ARENA_RADIUS]} />
      {/* Thick motherboard slab — top surface at Y=0.
          meshLambertMaterial: cheapest shadow-capable material for WebGL. */}
      <mesh receiveShadow onPointerDown={handlePointerDown}>
        <cylinderGeometry args={[ARENA_RADIUS, ARENA_RADIUS, SLAB_THICKNESS, ARENA_SEGMENTS]} />
        <meshLambertMaterial color="#0a0a12" />
      </mesh>
      {/* Neon grid overlaid on the top surface */}
      <CyberGrid />
      {/* Decorative edge glow ring */}
      <EdgeGlow />
    </RigidBody>
  )
}

// ── Cyber Neon Grid (concentric rings + radial spokes) ──────────────────────
// Uses only LineBasicMaterial (zero lighting calculations).
// Pulse is a single Math.sin per frame — negligible CPU cost.
function CyberGrid() {
  const gridRef = useRef<THREE.Group>(null)
  const materialsRef = useRef<THREE.LineBasicMaterial[]>([])

  useEffect(() => {
    if (!gridRef.current) return
    const group = gridRef.current
    const mats: THREE.LineBasicMaterial[] = []

    // ── Primary concentric rings (bright cyan) ──
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.12,
    })
    mats.push(ringMat)

    for (let r = 4; r <= ARENA_RADIUS; r += 4) {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 80; i++) {
        const angle = (i / 80) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(angle) * r, 0.02, Math.sin(angle) * r))
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      group.add(new THREE.Line(geo, ringMat))
    }

    // ── Accent rings every 10 units (brighter) ──
    const accentMat = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.25,
    })
    mats.push(accentMat)

    for (let r = 10; r <= ARENA_RADIUS; r += 10) {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 80; i++) {
        const angle = (i / 80) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(angle) * r, 0.025, Math.sin(angle) * r))
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      group.add(new THREE.Line(geo, accentMat))
    }

    // ── Radial spokes (24 for dense grid feel) ──
    const spokeMat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.07,
    })
    mats.push(spokeMat)

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2
      const pts = [
        new THREE.Vector3(0, 0.02, 0),
        new THREE.Vector3(
          Math.cos(angle) * ARENA_RADIUS,
          0.02,
          Math.sin(angle) * ARENA_RADIUS
        ),
      ]
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      group.add(new THREE.Line(geo, spokeMat))
    }

    materialsRef.current = mats

    return () => {
      group.children.forEach((child) => {
        if (child instanceof THREE.Line) child.geometry.dispose()
      })
      mats.forEach((m) => m.dispose())
    }
  }, [])

  // Single sin() call per frame — trivial cost
  useFrame(({ clock }) => {
    const pulse = 0.85 + 0.15 * Math.sin(clock.getElapsedTime() * 0.8)
    const mats = materialsRef.current
    if (mats[0]) mats[0].opacity = 0.12 * pulse
    if (mats[1]) mats[1].opacity = 0.25 * pulse
    if (mats[2]) mats[2].opacity = 0.07 * pulse
  })

  return <group ref={gridRef} position={[0, SLAB_THICKNESS / 2, 0]} />
}

// ── Edge Glow Ring ──────────────────────────────────────────────────────────────
// meshBasicMaterial only — zero lighting cost. Single sin() per frame.
function EdgeGlow() {
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ringRef.current) return
    const mat = ringRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.15 + 0.08 * Math.sin(clock.getElapsedTime() * 1.2)
  })

  return (
    <mesh
      ref={ringRef}
      position={[0, SLAB_THICKNESS / 2 + 0.03, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[ARENA_RADIUS - 0.3, ARENA_RADIUS, 80]} />
      <meshBasicMaterial
        color="#00ffcc"
        transparent
        opacity={0.18}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── Arena Boundary Walls (translucent cyber panels) ─────────────────────────────
// meshBasicMaterial: these are 4% opacity panels — lighting calcs are pure waste.
export function ArenaBoundary() {
  return (
    <RigidBody type="fixed" colliders={false} position={[0, ARENA_WALL_HEIGHT / 2, 0]}>
      {Array.from({ length: ARENA_WALL_SEGMENTS }).map((_, i) => {
        const angle = (i / ARENA_WALL_SEGMENTS) * Math.PI * 2
        const nextAngle = ((i + 1) / ARENA_WALL_SEGMENTS) * Math.PI * 2
        const midAngle = (angle + nextAngle) / 2
        const x = Math.cos(midAngle) * (ARENA_RADIUS + ARENA_WALL_THICKNESS / 2)
        const z = Math.sin(midAngle) * (ARENA_RADIUS + ARENA_WALL_THICKNESS / 2)
        const segLength =
          2 * (ARENA_RADIUS + ARENA_WALL_THICKNESS) * Math.sin(Math.PI / ARENA_WALL_SEGMENTS)

        return (
          <RigidBody
            key={i}
            type="fixed"
            position={[x, ARENA_WALL_HEIGHT / 2, z]}
            rotation={[0, -midAngle + Math.PI / 2, 0]}
          >
            <mesh>
              <boxGeometry args={[segLength, ARENA_WALL_HEIGHT, ARENA_WALL_THICKNESS]} />
              <meshBasicMaterial
                color="#00d4ff"
                transparent
                opacity={0.06}
              />
            </mesh>
          </RigidBody>
        )
      })}
    </RigidBody>
  )
}

// ── Arena Perimeter Pillars (decorative neon columns) ────────────────────────────
// ZERO dynamic lights. All glow is "faked" via meshBasicMaterial.
// No useFrame — completely static geometry.
export function ArenaPillars() {
  const PILLAR_COUNT = 16
  const PILLAR_RADIUS = 0.35
  const PILLAR_HEIGHT = 5
  const PILLAR_ORBIT = ARENA_RADIUS + 1.5

  const pillars = useMemo(() => {
    return Array.from({ length: PILLAR_COUNT }).map((_, i) => {
      const angle = (i / PILLAR_COUNT) * Math.PI * 2
      return {
        x: Math.cos(angle) * PILLAR_ORBIT,
        z: Math.sin(angle) * PILLAR_ORBIT,
      }
    })
  }, [])

  return (
    <group>
      {pillars.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          {/* Pillar body — meshLambertMaterial: cheap, receives global light */}
          <mesh position={[0, PILLAR_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[PILLAR_RADIUS, PILLAR_RADIUS * 1.2, PILLAR_HEIGHT, 6]} />
            <meshLambertMaterial color="#0e0e20" emissive="#00ffcc" emissiveIntensity={0.15} />
          </mesh>
          {/* Glowing cap — meshBasicMaterial: self-lit, no lighting cost */}
          <mesh position={[0, PILLAR_HEIGHT + 0.1, 0]}>
            <sphereGeometry args={[PILLAR_RADIUS * 1.3, 8, 8]} />
            <meshBasicMaterial color="#00ffcc" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── Lighting ────────────────────────────────────────────────────────────────────
// ONLY 2 lights total: 1 ambient + 1 directional.
// This is the absolute minimum for WebGL forward rendering to stay stable.
export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.35} color="#2a3366" />
      <directionalLight
        position={[20, 40, 20]}
        intensity={1.2}
        color="#c8ccff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={120}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
    </>
  )
}
