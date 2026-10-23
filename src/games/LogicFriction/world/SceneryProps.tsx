import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../state/useGameStore'
import {
  getSharedPlaneGeometry,
  getSharedSpriteTexture,
  noRaycast,
} from '../sprites/spriteAtlasRegistry'
import { ARENA_RADIUS } from '../config/constants'
import { playerPositionRef } from '../player/playerEvents'

const _dummy = new THREE.Object3D()

interface PropPlacement {
  id: string
  x: number
  z: number
  kind: 'CRYSTAL' | 'TOTEM' | 'TREE'
  scale: number
  phase: number
  rotY: number
}

const MATH_ZONES: Array<[number, number]> = [
  [0, -35],
  [0, 35],
  [35, 0],
  [-35, 0],
]

function isNearMathZone(x: number, z: number, minDist = 9.5): boolean {
  for (const [mx, mz] of MATH_ZONES) {
    const dx = x - mx
    const dz = z - mz
    if (dx * dx + dz * dz < minDist * minDist) return true
  }
  return false
}

export function SceneryProps() {
  const visualStyle = useGameStore((s) => s.visualStyle)
  const sceneryDensity = useGameStore((s) => s.sceneryDensity)
  const isBossWave = useGameStore((s) => s.isBossWave)
  const isBuffActive = useGameStore((s) => s.isBuffActive)
  const enemiesToSpawn = useGameStore((s) => s.enemiesToSpawn)
  const bossesToSpawn = useGameStore((s) => s.bossesToSpawn)

  const planeGeo = useMemo(() => getSharedPlaneGeometry(), [])
  const portalRiftTex = useMemo(() => getSharedSpriteTexture('PORTAL_GLITCH_RIFT'), [])
  const portalRingTex = useMemo(() => getSharedSpriteTexture('PORTAL_BASE_RING'), [])
  const monolithTex = useMemo(() => getSharedSpriteTexture('PROP_HORIZON_MONOLITH'), [])
  const crystalTex = useMemo(() => getSharedSpriteTexture('PROP_CRYSTAL_CLUSTER'), [])
  const totemTex = useMemo(() => getSharedSpriteTexture('PROP_RUNE_TOTEM'), [])
  const treeTex = useMemo(() => getSharedSpriteTexture('PROP_DATA_TREE'), [])

  // 8 Cardinal & Diagonal Glitch Spawn Portals around the arena rim
  const portals = useMemo(() => {
    const r = ARENA_RADIUS - 1.8
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      // Face inward toward (0,0,0)
      const rotY = Math.atan2(-x, -z)
      return { id: `portal-${i}`, x, z, rotY, phase: i * 0.8 }
    })
  }, [])

  // 32 Golden-Angle Fibonacci Props distributed across the arena floor
  const allProps = useMemo<PropPlacement[]>(() => {
    const list: PropPlacement[] = []
    const goldenAngle = 2.399963229728653
    const kinds: Array<'CRYSTAL' | 'TOTEM' | 'TREE'> = ['CRYSTAL', 'TOTEM', 'TREE']

    let idx = 0
    let candidate = 0
    while (list.length < 32 && candidate < 90) {
      candidate++
      const t = candidate / 48
      const r = 11.5 + Math.sqrt(t) * 32.5
      if (r > ARENA_RADIUS - 5.5) continue
      const theta = candidate * goldenAngle
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r

      // Keep clear of Math Challenge Zones and player spawn (0, 8)
      if (isNearMathZone(x, z, 9.2)) continue
      if (Math.hypot(x, z - 8) < 4.5) continue

      const kind = kinds[idx % kinds.length]
      const scale = 0.85 + ((idx * 37) % 35) / 100
      list.push({
        id: `prop-${idx}`,
        x,
        z,
        kind,
        scale,
        phase: idx * 0.57,
        rotY: (idx * 1.13) % (Math.PI * 2),
      })
      idx++
    }
    return list
  }, [])

  const activeProps = useMemo(
    () => (sceneryDensity === 'FULL' ? allProps : allProps.filter((_, i) => i % 3 === 0)),
    [allProps, sceneryDensity]
  )

  const crystalProps = useMemo(
    () => activeProps.filter((p) => p.kind === 'CRYSTAL'),
    [activeProps]
  )
  const totemProps = useMemo(
    () => activeProps.filter((p) => p.kind === 'TOTEM'),
    [activeProps]
  )
  const treeProps = useMemo(
    () => activeProps.filter((p) => p.kind === 'TREE'),
    [activeProps]
  )

  // 12 Distant Horizon Monoliths in the outer cyber-abyss
  const monoliths = useMemo(() => {
    const count = sceneryDensity === 'FULL' ? 12 : 6
    const r = ARENA_RADIUS + 24
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.18
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      const rotY = Math.atan2(-x, -z)
      const heightScale = 0.88 + ((i * 19) % 30) / 100
      return { id: `monolith-${i}`, x, z, rotY, heightScale, phase: i * 0.9 }
    })
  }, [sceneryDensity])

  const crystalInstancedRef = useRef<THREE.InstancedMesh>(null)
  const totemInstancedRef = useRef<THREE.InstancedMesh>(null)
  const treeInstancedRef = useRef<THREE.InstancedMesh>(null)
  const monolithInstancedRef = useRef<THREE.InstancedMesh>(null)
  const portalRiftRefs = useRef<Array<THREE.Mesh | null>>([])
  const portalRingRefs = useRef<Array<THREE.Mesh | null>>([])

  // Populate static Horizon Monoliths InstancedMesh
  useEffect(() => {
    if (visualStyle !== '2.5D' || !monolithInstancedRef.current) return
    const mesh = monolithInstancedRef.current
    for (let i = 0; i < monoliths.length; i++) {
      const m = monoliths[i]
      _dummy.position.set(m.x, 7.5 * m.heightScale, m.z)
      _dummy.rotation.set(0, m.rotY, 0)
      _dummy.scale.set(13.5, 28 * m.heightScale, 1)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [monoliths, visualStyle])

  useFrame(({ clock }) => {
    if (visualStyle !== '2.5D') return
    const t = clock.getElapsedTime()
    const px = playerPositionRef.x
    const pz = playerPositionRef.z

    const isSpawningActive = enemiesToSpawn > 0 || bossesToSpawn > 0

    // Animate 8 Spawn Portals
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i]
      const rift = portalRiftRefs.current[i]
      const ring = portalRingRefs.current[i]
      if (ring) {
        ring.rotation.z = t * (isSpawningActive ? 1.8 : 0.6) + p.phase
        const ringPulse = 1 + Math.sin(t * 3 + p.phase) * (isSpawningActive ? 0.12 : 0.04)
        ring.scale.set(4.2 * ringPulse, 4.2 * ringPulse, 1)
      }
      if (rift) {
        const pulse = 1 + Math.sin(t * (isSpawningActive ? 5.5 : 2.2) + p.phase) * (isSpawningActive ? 0.14 : 0.05)
        rift.scale.set(4.2 * pulse, 5.6 * pulse, 1)
        rift.position.y = 2.75 + Math.sin(t * 2.0 + p.phase) * 0.18
      }
    }

    // Helper for reactive instanced CrossQuad props (2 orthogonal planes per prop)
    const updateCrossQuadInstances = (
      mesh: THREE.InstancedMesh | null,
      propsList: PropPlacement[],
      baseW: number,
      baseH: number,
      baseY: number
    ) => {
      if (!mesh) return
      for (let i = 0; i < propsList.length; i++) {
        const prop = propsList[i]
        const dx = prop.x - px
        const dz = prop.z - pz
        const distSq = dx * dx + dz * dz
        let tiltZ = Math.sin(t * 1.6 + prop.phase) * 0.04
        let tiltX = Math.cos(t * 1.3 + prop.phase) * 0.03
        let squash = 1.0

        if (distSq < 18.0) {
          const dist = Math.max(0.5, Math.sqrt(distSq))
          const factor = (1 - dist / 4.25) * 0.35
          tiltZ += (dx / dist) * factor
          tiltX += (dz / dist) * factor
          squash = 1.0 + Math.sin(t * 10) * 0.06
        }

        const w = baseW * prop.scale * (2 - squash)
        const h = baseH * prop.scale * squash
        const y = baseY * prop.scale

        // Plane A
        _dummy.position.set(prop.x, y, prop.z)
        _dummy.rotation.set(tiltX, prop.rotY, tiltZ)
        _dummy.scale.set(w, h, 1)
        _dummy.updateMatrix()
        mesh.setMatrixAt(i * 2, _dummy.matrix)

        // Plane B (orthogonal 90° cross-plane)
        _dummy.rotation.set(tiltX, prop.rotY + Math.PI / 2, tiltZ)
        _dummy.updateMatrix()
        mesh.setMatrixAt(i * 2 + 1, _dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    updateCrossQuadInstances(crystalInstancedRef.current, crystalProps, 1.85, 2.2, 1.05)
    updateCrossQuadInstances(totemInstancedRef.current, totemProps, 1.65, 2.75, 1.35)
    updateCrossQuadInstances(treeInstancedRef.current, treeProps, 2.35, 2.95, 1.48)
  })

  if (visualStyle !== '2.5D') return null

  const portalTint = isBossWave ? '#ff2a55' : isBuffActive ? '#fef08a' : '#ffffff'
  const propTint = isBuffActive ? '#fef9c3' : '#ffffff'

  return (
    <group name="scenery-25d-world">
      {/* ── 8 Perimeter Glitch Spawn Portals ── */}
      {portals.map((p, idx) => (
        <group key={p.id} position={[p.x, 0, p.z]} rotation={[0, p.rotY, 0]}>
          {/* Ground ritual magic ring */}
          <mesh
            ref={(el) => {
              portalRingRefs.current[idx] = el
            }}
            geometry={planeGeo}
            position={[0, 0.06, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[4.2, 4.2, 1]}
            raycast={noRaycast}
          >
            <meshBasicMaterial
              map={portalRingTex}
              transparent
              alphaTest={0.03}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              color={portalTint}
              opacity={0.85}
            />
          </mesh>

          {/* Vertical 2.5D Glitch Dimensional Rift */}
          <mesh
            ref={(el) => {
              portalRiftRefs.current[idx] = el
            }}
            geometry={planeGeo}
            position={[0, 2.75, 0]}
            scale={[4.2, 5.6, 1]}
            raycast={noRaycast}
          >
            <meshBasicMaterial
              map={portalRiftTex}
              transparent
              alphaTest={0.04}
              depthWrite={false}
              side={THREE.DoubleSide}
              color={portalTint}
              opacity={0.92}
            />
          </mesh>
        </group>
      ))}

      {/* ── Batched InstancedMesh: Crystal Clusters (2 cross-planes each, 1 draw call) ── */}
      {crystalProps.length > 0 && (
        <instancedMesh
          key={`crystals-${crystalProps.length}`}
          ref={crystalInstancedRef}
          args={[planeGeo, undefined, crystalProps.length * 2]}
          frustumCulled={false}
          raycast={noRaycast}
        >
          <meshBasicMaterial
            map={crystalTex}
            color={propTint}
            transparent
            opacity={0.92}
            alphaTest={0.06}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </instancedMesh>
      )}

      {/* ── Batched InstancedMesh: Rune Totems (2 cross-planes each, 1 draw call) ── */}
      {totemProps.length > 0 && (
        <instancedMesh
          key={`totems-${totemProps.length}`}
          ref={totemInstancedRef}
          args={[planeGeo, undefined, totemProps.length * 2]}
          frustumCulled={false}
          raycast={noRaycast}
        >
          <meshBasicMaterial
            map={totemTex}
            color={propTint}
            transparent
            opacity={0.92}
            alphaTest={0.06}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </instancedMesh>
      )}

      {/* ── Batched InstancedMesh: Reactive Data Trees (2 cross-planes each, 1 draw call) ── */}
      {treeProps.length > 0 && (
        <instancedMesh
          key={`trees-${treeProps.length}`}
          ref={treeInstancedRef}
          args={[planeGeo, undefined, treeProps.length * 2]}
          frustumCulled={false}
          raycast={noRaycast}
        >
          <meshBasicMaterial
            map={treeTex}
            color={propTint}
            transparent
            opacity={0.94}
            alphaTest={0.05}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </instancedMesh>
      )}

      {/* ── Batched InstancedMesh: 12 Distant Horizon Cyber-Monoliths (1 draw call) ── */}
      <instancedMesh
        key={`monoliths-${monoliths.length}`}
        ref={monolithInstancedRef}
        args={[planeGeo, undefined, monoliths.length]}
        frustumCulled={false}
        raycast={noRaycast}
      >
        <meshBasicMaterial
          map={monolithTex}
          transparent
          alphaTest={0.03}
          depthWrite={false}
          side={THREE.DoubleSide}
          opacity={0.78}
          color={isBossWave ? '#fda4af' : '#e0f2fe'}
        />
      </instancedMesh>
    </group>
  )
}
