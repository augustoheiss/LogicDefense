import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../state/useGameStore'

const FX_DURATION = 1.6 // seconds for skybeam + floating text
const LIGHTNING_DURATION = 0.95 // seconds for Core Chain-Lightning

interface BoltData {
  lineObj: THREE.Line
  material: THREE.LineBasicMaterial
  targetX: number
  targetZ: number
}

export function MathRewardFX() {
  const lastMathReward = useGameStore(s => s.lastMathReward)
  const isPaused = useGameStore(s => s.isPaused)

  const [activeReward, setActiveReward] = useState(lastMathReward)
  const elapsedRef = useRef(0)

  const skybeamRef = useRef<THREE.Mesh>(null)
  const skybeamMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const innerRingRef = useRef<THREE.Mesh>(null)
  const innerRingMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const outerRingRef = useRef<THREE.Mesh>(null)
  const outerRingMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const textGroupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (lastMathReward) {
      setActiveReward(lastMathReward)
      elapsedRef.current = 0
    }
  }, [lastMathReward?.id])

  // Build jagged lightning bolts from Central Core (0, 2.6, 0) to each target enemy
  const bolts = useMemo<BoltData[]>(() => {
    if (!activeReward || !activeReward.wasCorrect || activeReward.lightningTargets.length === 0) {
      return []
    }

    const start = new THREE.Vector3(0, 2.6, 0)
    return activeReward.lightningTargets.map((target) => {
      const end = new THREE.Vector3(target.x, 0.8, target.z)
      const segments = 6
      const points: THREE.Vector3[] = [start.clone()]

      for (let i = 1; i < segments; i++) {
        const t = i / segments
        const p = new THREE.Vector3().lerpVectors(start, end, t)
        // Add jagged perpendicular/vertical jitter for electric arc feel
        p.x += (Math.random() - 0.5) * 1.4
        p.y += (Math.random() - 0.3) * 1.2
        p.z += (Math.random() - 0.5) * 1.4
        points.push(p)
      }
      points.push(end)

      const geom = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineBasicMaterial({
        color: '#ffd700',
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
      const lineObj = new THREE.Line(geom, mat)
      return {
        lineObj,
        material: mat,
        targetX: target.x,
        targetZ: target.z,
      }
    })
  }, [activeReward])

  // Cleanup Three.js geometries/materials on change
  useEffect(() => {
    return () => {
      bolts.forEach(b => {
        b.lineObj.geometry.dispose()
        b.material.dispose()
      })
    }
  }, [bolts])

  useFrame((_, delta) => {
    if (isPaused || !activeReward) return

    elapsedRef.current += delta
    const t = elapsedRef.current

    if (t >= FX_DURATION) {
      setActiveReward(null)
      return
    }

    const progress = Math.min(1, t / FX_DURATION)

    // 1. Animate Skybeam (vertical cylinder shrinks X/Z and fades out)
    if (skybeamRef.current && skybeamMatRef.current) {
      const widthScale = Math.max(0.05, (1 - progress * 0.75) * (1 + Math.sin(t * 25) * 0.15))
      skybeamRef.current.scale.set(widthScale, 1, widthScale)
      skybeamMatRef.current.opacity = Math.max(0, (1 - progress) * 0.65)
    }

    // 2. Animate expanding ground shockwave rings at pad
    if (innerRingRef.current && innerRingMatRef.current) {
      const s1 = 1 + progress * 5.5
      innerRingRef.current.scale.set(s1, s1, 1)
      innerRingMatRef.current.opacity = Math.max(0, (1 - progress) * 0.85)
    }
    if (outerRingRef.current && outerRingMatRef.current) {
      const s2 = 1 + Math.pow(progress, 0.7) * 8.0
      outerRingRef.current.scale.set(s2, s2, 1)
      outerRingMatRef.current.opacity = Math.max(0, (1 - progress) * 0.6)
    }

    // 3. Animate floating 3D bonus text rising upward
    if (textGroupRef.current) {
      textGroupRef.current.position.y = 2.8 + progress * 3.2
    }

    // 4. Animate Core Chain-Lightning opacity & flicker
    if (bolts.length > 0) {
      const lProg = Math.min(1, t / LIGHTNING_DURATION)
      const flicker = Math.sin(t * 60) > -0.2 ? 1 : 0.25
      const opacity = Math.max(0, (1 - lProg) * flicker)
      bolts.forEach(b => {
        b.material.opacity = opacity
      })
    }
  })

  if (!activeReward) return null

  const [px, , pz] = activeReward.padPos
  const isCorrect = activeReward.wasCorrect
  const primaryColor = isCorrect ? '#ffd700' : '#ff4444'
  const secondaryColor = isCorrect ? '#00ff88' : '#ff8800'

  return (
    <group>
      {/* ── Pad Orbital Skybeam & Ground Shockwaves ── */}
      <group position={[px, 0, pz]}>
        {isCorrect && (
          <mesh ref={skybeamRef} position={[0, 9, 0]}>
            <cylinderGeometry args={[1.1, 1.5, 18, 20, 1, true]} />
            <meshBasicMaterial
              ref={skybeamMatRef}
              color="#ffd700"
              transparent
              opacity={0.65}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}

        <mesh ref={innerRingRef} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.35, 32]} />
          <meshBasicMaterial
            ref={innerRingMatRef}
            color={primaryColor}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        <mesh ref={outerRingRef} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.5, 32]} />
          <meshBasicMaterial
            ref={outerRingMatRef}
            color={secondaryColor}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* ── Floating 3D Reward Billboard ── */}
        <group ref={textGroupRef} position={[0, 2.8, 0]}>
          <Billboard>
            <Text
              fontSize={0.75}
              color={isCorrect ? '#ffd700' : '#ff6666'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.06}
              outlineColor="#000000"
            >
              {isCorrect
                ? `+$${activeReward.goldBonus} OURO · STREAK x${activeReward.streak}!`
                : 'ARMADILHA DETECTADA! +15% CORE HP'}
            </Text>
            {isCorrect && activeReward.lightningTargets.length > 0 && (
              <Text
                position={[0, -0.85, 0]}
                fontSize={0.5}
                color="#00ffcc"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.04}
                outlineColor="#000000"
              >
                {`⚡ TROVÃO DE ARQUIMEDES (${activeReward.lightningTargets.length} ALVOS)`}
              </Text>
            )}
          </Billboard>
        </group>
      </group>

      {/* ── Archimedes Thunder (Core Chain-Lightning to closest enemies) ── */}
      {bolts.map((b, idx) => (
        <group key={idx}>
          <primitive object={b.lineObj} />
          <mesh position={[b.targetX, 0.12, b.targetZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4, 1.1, 20]} />
            <meshBasicMaterial
              color="#ffd700"
              transparent
              opacity={0.65}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
