// ============================================================
// Logic Friction — 2.5D Enemy Shatter Death FX (Object-Pooled)
// Single THREE.InstancedMesh (48 shards, 1 draw call total, zero GC)
// ============================================================
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  getSharedPlaneGeometry,
  getSharedSpriteTexture,
  noRaycast,
} from '../sprites/spriteAtlasRegistry'

const MAX_SHARDS = 48

interface ShardData {
  active: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  age: number
  maxAge: number
  baseScale: number
  spin: number
  rotZ: number
  colorHex: string
  colorDirty: boolean
}

const shardPool: ShardData[] = Array.from({ length: MAX_SHARDS }, () => ({
  active: false,
  x: 0,
  y: -100,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  age: 0,
  maxAge: 0.45,
  baseScale: 0.5,
  spin: 0,
  rotZ: 0,
  colorHex: '#00f0ff',
  colorDirty: true,
}))

let nextShardCursor = 0

/**
 * Triggers a zero-allocation 2.5D crystal/spark shatter burst at (x, z).
 */
export function emitEnemyDeathBurst(
  x: number,
  z: number,
  colorHex = '#00f0ff',
  isBoss = false
): void {
  const count = isBoss ? 12 : 5
  for (let i = 0; i < count; i++) {
    const shard = shardPool[nextShardCursor]
    nextShardCursor = (nextShardCursor + 1) % MAX_SHARDS

    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
    const speed = (isBoss ? 5.5 : 3.2) + Math.random() * (isBoss ? 4.5 : 2.8)

    shard.active = true
    shard.x = x + (Math.random() - 0.5) * 0.35
    shard.y = isBoss ? 1.4 : 0.75
    shard.z = z + (Math.random() - 0.5) * 0.35
    shard.vx = Math.cos(angle) * speed
    shard.vy = (isBoss ? 4.8 : 3.2) + Math.random() * 2.4
    shard.vz = Math.sin(angle) * speed
    shard.age = 0
    shard.maxAge = isBoss ? 0.72 : 0.46
    shard.baseScale = isBoss ? 1.15 : 0.68
    shard.spin = (Math.random() - 0.5) * 10
    shard.rotZ = Math.random() * Math.PI * 2
    shard.colorHex = colorHex
    shard.colorDirty = true
  }
}

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()

export function EnemyDeathFX() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const planeGeo = useMemo(() => getSharedPlaneGeometry(), [])
  const sparkTex = useMemo(() => getSharedSpriteTexture('PROJECTILE_IMPACT_SPARK'), [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    _dummy.position.set(0, -100, 0)
    _dummy.scale.set(0, 0, 0)
    _dummy.updateMatrix()
    _color.set('#00f0ff')
    for (let i = 0; i < MAX_SHARDS; i++) {
      mesh.setMatrixAt(i, _dummy.matrix)
      mesh.setColorAt(i, _color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  useFrame(({ camera }, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const dt = Math.min(delta, 0.05)
    let anyActiveOrUpdated = false
    let anyColorUpdated = false

    for (let i = 0; i < MAX_SHARDS; i++) {
      const s = shardPool[i]
      if (!s.active) continue

      anyActiveOrUpdated = true
      s.age += dt

      if (s.age >= s.maxAge) {
        s.active = false
        _dummy.position.set(0, -100, 0)
        _dummy.scale.set(0, 0, 0)
        _dummy.updateMatrix()
        mesh.setMatrixAt(i, _dummy.matrix)
        continue
      }

      s.x += s.vx * dt
      s.y = Math.max(0.12, s.y + s.vy * dt)
      s.z += s.vz * dt
      s.vy -= 14.5 * dt
      s.rotZ += s.spin * dt

      const progress = s.age / s.maxAge
      const scale = s.baseScale * (1 - progress * 0.85)
      const yawToCam = Math.atan2(camera.position.x - s.x, camera.position.z - s.z)

      _dummy.position.set(s.x, s.y, s.z)
      _dummy.rotation.set(0, yawToCam, s.rotZ)
      _dummy.scale.set(scale, scale, 1)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)

      if (s.colorDirty) {
        _color.set(s.colorHex)
        mesh.setColorAt(i, _color)
        s.colorDirty = false
        anyColorUpdated = true
      }
    }

    if (anyActiveOrUpdated) {
      mesh.instanceMatrix.needsUpdate = true
    }
    if (anyColorUpdated && mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[planeGeo, undefined, MAX_SHARDS]}
      frustumCulled={false}
      raycast={noRaycast}
    >
      <meshBasicMaterial
        map={sparkTex}
        transparent
        alphaTest={0.03}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        opacity={0.92}
      />
    </instancedMesh>
  )
}
