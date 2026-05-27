// ============================================================
// Logic Friction — Projectile Manager
// Renders all tower projectile visuals. Towers emit events;
// this component renders them as short-lived visual effects.
//
// 4 projectile types (ALL meshBasicMaterial — ZERO dynamic lights):
//   BOLT      — Cyan cylinder, fast travel (Rapid Tower)
//   MORTAR    — Orange sphere + parabolic arc + impact ring (Heavy)
//   SHOCKWAVE — Expanding cyan ring, AoE pulse (Slow Tower)
//   RAILGUN   — Instant red line, 0.2s fade (Sniper Tower)
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Event Types ─────────────────────────────────────────────────────────────────

export interface ProjectileEvent {
  type: 'BOLT' | 'MORTAR' | 'SHOCKWAVE' | 'RAILGUN'
  fromX: number
  fromY: number
  fromZ: number
  toX: number
  toY: number
  toZ: number
  range?: number    // For SHOCKWAVE — the tower's range
  color: string
}

// ── Event Bus (simple pub/sub) ──────────────────────────────────────────────────
type ProjectileListener = (event: ProjectileEvent) => void
const listeners: Set<ProjectileListener> = new Set()

export function emitProjectile(event: ProjectileEvent): void {
  listeners.forEach(fn => fn(event))
}

function useProjectileListener(callback: ProjectileListener) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const handler: ProjectileListener = (e) => callbackRef.current(e)
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])
}

// ── Internal projectile state ───────────────────────────────────────────────────

interface ActiveProjectile {
  id: number
  type: 'BOLT' | 'MORTAR' | 'SHOCKWAVE' | 'RAILGUN'
  fromX: number; fromY: number; fromZ: number
  toX: number; toY: number; toZ: number
  range: number
  color: string
  age: number
  maxAge: number
}

let nextProjId = 0

// ── Projectile Manager Component ────────────────────────────────────────────────

export function ProjectileManager() {
  const [projectiles, setProjectiles] = useState<ActiveProjectile[]>([])

  // Listen for projectile events from towers
  useProjectileListener(useCallback((event: ProjectileEvent) => {
    const maxAge = event.type === 'BOLT' ? 0.25
      : event.type === 'MORTAR' ? 0.5
      : event.type === 'SHOCKWAVE' ? 0.6
      : 0.2 // RAILGUN

    setProjectiles(prev => [...prev, {
      id: ++nextProjId,
      type: event.type,
      fromX: event.fromX,
      fromY: event.fromY,
      fromZ: event.fromZ,
      toX: event.toX,
      toY: event.toY,
      toZ: event.toZ,
      range: event.range ?? 0,
      color: event.color,
      age: 0,
      maxAge,
    }])
  }, []))

  // Age and cull projectiles
  useFrame((_, delta) => {
    setProjectiles(prev => {
      let changed = false
      const updated = prev.map(p => {
        const newAge = p.age + delta
        if (newAge !== p.age) changed = true
        return { ...p, age: newAge }
      }).filter(p => {
        if (p.age >= p.maxAge) { changed = true; return false }
        return true
      })
      return changed ? updated : prev
    })
  })

  return (
    <>
      {projectiles.map(p => {
        switch (p.type) {
          case 'BOLT': return <BoltProjectile key={p.id} proj={p} />
          case 'MORTAR': return <MortarProjectile key={p.id} proj={p} />
          case 'SHOCKWAVE': return <ShockwaveProjectile key={p.id} proj={p} />
          case 'RAILGUN': return <RailgunProjectile key={p.id} proj={p} />
          default: return null
        }
      })}
    </>
  )
}

// ── BOLT: Cyan plasma cylinder traveling from tower to target ────────────────

function BoltProjectile({ proj }: { proj: ActiveProjectile }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const progress = Math.min(1, proj.age / proj.maxAge)

  const x = proj.fromX + (proj.toX - proj.fromX) * progress
  const y = proj.fromY + (proj.toY - proj.fromY) * progress
  const z = proj.fromZ + (proj.toZ - proj.fromZ) * progress

  // Aim the cylinder along the travel direction
  const dx = proj.toX - proj.fromX
  const dz = proj.toZ - proj.fromZ

  return (
    <group position={[x, y, z]}>
      <mesh
        ref={meshRef}
        rotation={[0, Math.atan2(dx, dz), 0]}
      >
        <cylinderGeometry args={[0.08, 0.08, 0.4, 4]} />
        <meshBasicMaterial
          color={proj.color}
          transparent
          opacity={1 - progress * 0.5}
        />
      </mesh>
      {/* Glow trail */}
      <mesh rotation={[0, Math.atan2(dx, dz), 0]}>
        <cylinderGeometry args={[0.15, 0.0, 0.6, 4]} />
        <meshBasicMaterial
          color={proj.color}
          transparent
          opacity={0.3 * (1 - progress)}
        />
      </mesh>
    </group>
  )
}

// ── MORTAR: Orange sphere + parabolic arc + impact ring ─────────────────────

function MortarProjectile({ proj }: { proj: ActiveProjectile }) {
  const progress = Math.min(1, proj.age / proj.maxAge)

  const dx = proj.toX - proj.fromX
  const dz = proj.toZ - proj.fromZ
  const dist = Math.sqrt(dx * dx + dz * dz)
  const arcHeight = Math.max(3, dist * 0.3)

  // Parabolic arc: y = fromY + 4*h*t*(1-t)
  const x = proj.fromX + dx * progress
  const z = proj.fromZ + dz * progress
  const y = proj.fromY + 4 * arcHeight * progress * (1 - progress)

  const hasImpacted = progress > 0.85
  const impactProgress = hasImpacted ? (progress - 0.85) / 0.15 : 0

  return (
    <group>
      {/* Flying sphere */}
      {!hasImpacted && (
        <mesh position={[x, y, z]}>
          <sphereGeometry args={[0.25, 6, 6]} />
          <meshBasicMaterial color={proj.color} />
        </mesh>
      )}
      {/* Impact ring */}
      {hasImpacted && (
        <mesh
          position={[proj.toX, 0.2, proj.toZ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[
            impactProgress * 2.5,
            impactProgress * 3.0,
            16
          ]} />
          <meshBasicMaterial
            color={proj.color}
            transparent
            opacity={0.6 * (1 - impactProgress)}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

// ── SHOCKWAVE: Expanding cyan ring (AoE pulse) ─────────────────────────────

function ShockwaveProjectile({ proj }: { proj: ActiveProjectile }) {
  const progress = Math.min(1, proj.age / proj.maxAge)

  const currentRadius = progress * proj.range
  const innerRadius = Math.max(0, currentRadius - 0.5)

  return (
    <mesh
      position={[proj.fromX, 0.3, proj.fromZ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[innerRadius, currentRadius, 32]} />
      <meshBasicMaterial
        color={proj.color}
        transparent
        opacity={0.4 * (1 - progress)}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── RAILGUN: Instant red beam connecting tower to target ────────────────────

function RailgunProjectile({ proj }: { proj: ActiveProjectile }) {
  const progress = Math.min(1, proj.age / proj.maxAge)

  const dx = proj.toX - proj.fromX
  const dy = proj.toY - proj.fromY
  const dz = proj.toZ - proj.fromZ
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

  const midX = (proj.fromX + proj.toX) / 2
  const midY = (proj.fromY + proj.toY) / 2
  const midZ = (proj.fromZ + proj.toZ) / 2

  // Compute rotation to align cylinder with beam direction
  const dir = new THREE.Vector3(dx, dy, dz).normalize()
  const up = new THREE.Vector3(0, 1, 0)
  const quat = new THREE.Quaternion()
  quat.setFromUnitVectors(up, dir)
  const euler = new THREE.Euler().setFromQuaternion(quat)

  return (
    <group>
      {/* Main beam */}
      <mesh
        position={[midX, midY, midZ]}
        rotation={euler}
      >
        <cylinderGeometry args={[0.12, 0.12, dist, 4]} />
        <meshBasicMaterial
          color={proj.color}
          transparent
          opacity={0.9 * (1 - progress)}
        />
      </mesh>
      {/* Outer glow */}
      <mesh
        position={[midX, midY, midZ]}
        rotation={euler}
      >
        <cylinderGeometry args={[0.25, 0.25, dist, 4]} />
        <meshBasicMaterial
          color={proj.color}
          transparent
          opacity={0.2 * (1 - progress)}
        />
      </mesh>
    </group>
  )
}
