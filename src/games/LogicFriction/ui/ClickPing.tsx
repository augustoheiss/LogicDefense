// ============================================================
// Logic Friction — Click Ping (Visual Feedback)
// Renders an expanding ring at the tap/click location
// that fades out quickly, providing instant input feedback.
// ============================================================
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../state/useGameStore'
import { enemyRegistry } from '../enemies/EnemyRegistry'

const PING_DURATION = 0.6      // seconds
const PING_MAX_SCALE = 3.0     // max ring expansion
const POINT_COLOR = '#00ff88'  // green for ground clicks
const ENTITY_COLOR = '#ff4444' // red for enemy targeting

export function ClickPing() {
  const ringRef = useRef<THREE.Mesh>(null)
  const progressRef = useRef(1.0) // 1.0 = invisible, 0→1 = animating
  const posRef = useRef<[number, number, number]>([0, 0.2, 0])
  const colorRef = useRef(POINT_COLOR)
  const lastTargetRef = useRef<string | null>(null)

  useFrame((_, delta) => {
    const state = useGameStore.getState()
    const target = state.moveTarget

    // Detect new target (trigger ping)
    const targetKey = target
      ? target.type === 'point'
        ? `p:${target.x.toFixed(1)},${target.z.toFixed(1)}`
        : `e:${target.id}`
      : null

    if (targetKey && targetKey !== lastTargetRef.current) {
      // New target — start ping animation
      progressRef.current = 0

      if (target!.type === 'point') {
        posRef.current = [target!.x, 0.15, (target as { x: number; z: number }).z]
        colorRef.current = POINT_COLOR
      } else {
        const entry = enemyRegistry.get((target as { type: 'entity'; id: string }).id)
        if (entry) {
          posRef.current = [entry.x, 0.15, entry.z]
          colorRef.current = ENTITY_COLOR
        }
      }
    }
    lastTargetRef.current = targetKey

    // Animate
    if (progressRef.current < 1.0) {
      progressRef.current = Math.min(1.0, progressRef.current + delta / PING_DURATION)
    }

    // Apply visual
    if (ringRef.current) {
      const t = progressRef.current
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - t) * 0.6
      mat.color.set(colorRef.current)

      const scale = 0.5 + t * PING_MAX_SCALE
      ringRef.current.scale.set(scale, scale, scale)
      ringRef.current.position.set(posRef.current[0], posRef.current[1], posRef.current[2])
      ringRef.current.visible = t < 1.0
    }
  })

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.3, 0.5, 24]} />
      <meshBasicMaterial
        color={POINT_COLOR}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthTest={false}
      />
    </mesh>
  )
}
