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
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { soundEngine } from '../audio/soundEngine'

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
  soundEngine.playTowerFire(event.type)
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
  spawnTime: number
  maxAge: number
}

let nextProjId = 0

// ── Projectile Manager Component ────────────────────────────────────────────────

export function ProjectileManager() {
  const [projectiles, setProjectiles] = useState<ActiveProjectile[]>([])
  const projectilesRef = useRef<ActiveProjectile[]>([])
  projectilesRef.current = projectiles

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
      spawnTime: performance.now(),
      maxAge,
    }])
  }, []))

  // Only call setProjectiles when at least one projectile has expired (zero 60Hz React churn)
  useFrame(() => {
    if (projectilesRef.current.length === 0) return
    const now = performance.now()
    const hasExpired = projectilesRef.current.some(p => (now - p.spawnTime) / 1000 >= p.maxAge)
    if (hasExpired) {
      setProjectiles(prev => prev.filter(p => (now - p.spawnTime) / 1000 < p.maxAge))
    }
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
  const groupRef = useRef<THREE.Group>(null)
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const trailMatRef = useRef<THREE.MeshBasicMaterial>(null)

  const rotY = Math.atan2(proj.toX - proj.fromX, proj.toZ - proj.fromZ)

  useFrame(() => {
    if (!groupRef.current) return
    const age = (performance.now() - proj.spawnTime) / 1000
    const progress = Math.min(1, Math.max(0, age / proj.maxAge))

    groupRef.current.position.set(
      proj.fromX + (proj.toX - proj.fromX) * progress,
      proj.fromY + (proj.toY - proj.fromY) * progress,
      proj.fromZ + (proj.toZ - proj.fromZ) * progress,
    )
    if (coreMatRef.current) coreMatRef.current.opacity = 1 - progress * 0.5
    if (trailMatRef.current) trailMatRef.current.opacity = 0.3 * (1 - progress)
  })

  return (
    <group ref={groupRef} position={[proj.fromX, proj.fromY, proj.fromZ]}>
      <mesh rotation={[0, rotY, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.4, 4]} />
        <meshBasicMaterial ref={coreMatRef} color={proj.color} transparent opacity={1} />
      </mesh>
      <mesh rotation={[0, rotY, 0]}>
        <cylinderGeometry args={[0.15, 0.0, 0.6, 4]} />
        <meshBasicMaterial ref={trailMatRef} color={proj.color} transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

// ── MORTAR: Orange sphere + parabolic arc + impact ring ─────────────────────

function MortarProjectile({ proj }: { proj: ActiveProjectile }) {
  const sphereRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null)

  const dx = proj.toX - proj.fromX
  const dz = proj.toZ - proj.fromZ
  const dist = Math.sqrt(dx * dx + dz * dz)
  const arcHeight = Math.max(3, dist * 0.3)

  useFrame(() => {
    const age = (performance.now() - proj.spawnTime) / 1000
    const progress = Math.min(1, Math.max(0, age / proj.maxAge))
    const hasImpacted = progress > 0.85

    if (sphereRef.current) {
      sphereRef.current.visible = !hasImpacted
      if (!hasImpacted) {
        sphereRef.current.position.set(
          proj.fromX + dx * progress,
          proj.fromY + 4 * arcHeight * progress * (1 - progress),
          proj.fromZ + dz * progress,
        )
      }
    }

    if (ringRef.current && ringMatRef.current) {
      ringRef.current.visible = hasImpacted
      if (hasImpacted) {
        const impactProgress = (progress - 0.85) / 0.15
        const scale = Math.max(0.1, impactProgress * 3.0)
        ringRef.current.scale.set(scale, scale, 1)
        ringMatRef.current.opacity = 0.6 * (1 - impactProgress)
      }
    }
  })

  return (
    <group>
      <mesh ref={sphereRef} position={[proj.fromX, proj.fromY, proj.fromZ]}>
        <sphereGeometry args={[0.25, 6, 6]} />
        <meshBasicMaterial color={proj.color} />
      </mesh>
      <mesh
        ref={ringRef}
        position={[proj.toX, 0.2, proj.toZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.8, 1.0, 16]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={proj.color}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

// ── SHOCKWAVE: Expanding cyan ring (AoE pulse) ─────────────────────────────

function ShockwaveProjectile({ proj }: { proj: ActiveProjectile }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return
    const age = (performance.now() - proj.spawnTime) / 1000
    const progress = Math.min(1, Math.max(0, age / proj.maxAge))
    const scale = Math.max(0.1, progress * proj.range)
    meshRef.current.scale.set(scale, scale, 1)
    matRef.current.opacity = 0.4 * (1 - progress)
  })

  return (
    <mesh
      ref={meshRef}
      position={[proj.fromX, 0.3, proj.fromZ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.85, 1.0, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color={proj.color}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── RAILGUN: Instant red beam connecting tower to target ────────────────────

function RailgunProjectile({ proj }: { proj: ActiveProjectile }) {
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null)

  const { midX, midY, midZ, dist, euler } = useMemo(() => {
    const dx = proj.toX - proj.fromX
    const dy = proj.toY - proj.fromY
    const dz = proj.toZ - proj.fromZ
    const d = Math.max(0.1, Math.sqrt(dx * dx + dy * dy + dz * dz))
    const dir = new THREE.Vector3(dx, dy, dz).normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    return {
      midX: (proj.fromX + proj.toX) / 2,
      midY: (proj.fromY + proj.toY) / 2,
      midZ: (proj.fromZ + proj.toZ) / 2,
      dist: d,
      euler: new THREE.Euler().setFromQuaternion(quat),
    }
  }, [proj.fromX, proj.fromY, proj.fromZ, proj.toX, proj.toY, proj.toZ])

  useFrame(() => {
    const age = (performance.now() - proj.spawnTime) / 1000
    const progress = Math.min(1, Math.max(0, age / proj.maxAge))
    if (coreMatRef.current) coreMatRef.current.opacity = 0.9 * (1 - progress)
    if (glowMatRef.current) glowMatRef.current.opacity = 0.2 * (1 - progress)
  })

  return (
    <group>
      <mesh position={[midX, midY, midZ]} rotation={euler}>
        <cylinderGeometry args={[0.12, 0.12, dist, 4]} />
        <meshBasicMaterial ref={coreMatRef} color={proj.color} transparent opacity={0.9} />
      </mesh>
      <mesh position={[midX, midY, midZ]} rotation={euler}>
        <cylinderGeometry args={[0.25, 0.25, dist, 4]} />
        <meshBasicMaterial ref={glowMatRef} color={proj.color} transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

