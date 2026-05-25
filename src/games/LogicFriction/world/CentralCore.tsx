// ============================================================
// Logic Friction — Central Core (Base Defense Target)
// Sprint 5: Core upgrade interaction in upgrade mode. Shows
// floating cost text, scales slightly per level, and adds
// extra ring indicators per level.
//
// TEXT SAFETY: <Text> is a SIBLING to <RigidBody>, placed
// OUTSIDE the physics body in the same parent <group>.
// ============================================================
import { useRef, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { RigidBody, BallCollider } from '@react-three/rapier'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { CORE_SIZE, CORE_COLLIDER_SIZE, CORE_UPGRADE_BASE_COST } from '../config/constants'
import { useGameStore } from '../state/useGameStore'

// ── Ground Pulsing Golden Ring Shader Component ───────────────────────────────────
interface GoldenRingEffectProps {
  active: boolean
}

function GoldenRingEffect({ active }: GoldenRingEffectProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime()
      // Smoothly lerp active parameter to fade in/out
      const targetActive = active ? 1.0 : 0.0
      materialRef.current.uniforms.uActive.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uActive.value,
        targetActive,
        0.1
      )
    }
  })

  const shaderData = useMemo(() => {
    return {
      uniforms: {
        uTime: { value: 0 },
        uActive: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uActive;
        varying vec2 vUv;

        void main() {
          if (uActive < 0.01) {
            discard;
          }
          vec2 uv = vUv - 0.5;
          float dist = length(uv);

          // Wave patterns moving outward
          float wave1 = sin(dist * 25.0 - uTime * 5.0) * 0.5 + 0.5;
          float wave2 = sin(dist * 12.0 - uTime * 2.5) * 0.5 + 0.5;

          // Mask defining the ring's thickness on the plane
          float mask = smoothstep(0.12, 0.20, dist) * (1.0 - smoothstep(0.40, 0.46, dist));
          float glow = (wave1 * 0.6 + wave2 * 0.4) * mask;

          // Soft inner-glow halo
          glow += (1.0 - smoothstep(0.20, 0.28, dist)) * (smoothstep(0.14, 0.20, dist)) * 0.25;

          vec3 gold = vec3(1.0, 0.82, 0.1);
          vec3 coreGlow = vec3(1.0, 0.95, 0.5) * glow * 1.6;

          vec3 color = mix(gold, coreGlow, glow);
          float alpha = glow * uActive * (0.85 + 0.15 * sin(uTime * 4.0));

          gl_FragColor = vec4(color, alpha);
        }
      `,
    }
  }, [])

  return (
    <mesh position={[0, -CORE_SIZE - 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, 12]} />
      <shaderMaterial
        ref={materialRef}
        args={[shaderData]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── Central Core Component ────────────────────────────────────────────────────────
export function CentralCore() {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  // Subscribe to store states
  const isUpgradeMode = useGameStore(s => s.isUpgradeMode)
  const coreLevel = useGameStore(s => s.coreLevel)
  const gold = useGameStore(s => s.gold)
  const isBuffActive = useGameStore(s => s.isBuffActive)

  const upgradeCost = coreLevel * CORE_UPGRADE_BASE_COST
  const canAfford = gold >= upgradeCost

  // Animate the core — rotation + pulse + colors
  useFrame((_, delta) => {
    const { coreHp, maxCoreHp, phase, isBuffActive: storeBuffActive } = useGameStore.getState()

    if (phase === 'MENU') return

    if (meshRef.current) {
      // Rotate core faster if divine buff is active
      const rotSpeed = storeBuffActive ? 1.2 : 0.4
      meshRef.current.rotation.y += delta * rotSpeed
      meshRef.current.rotation.x += delta * (rotSpeed * 0.37)

      const hpRatio = coreHp / maxCoreHp
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      
      if (storeBuffActive) {
        // Divine Buff Active: Beautiful pulsing gold emissive core
        const goldColor = '#ffd700'
        mat.color.set(goldColor)
        mat.emissive.set(goldColor)
        mat.emissiveIntensity = 0.8 + Math.sin(Date.now() * 0.005) * 0.4
        mat.wireframe = false
      } else {
        // Standard core colors based on HP
        const color = hpRatio > 0.5 ? '#00d4ff' : hpRatio > 0.25 ? '#ffaa00' : '#ff2222'
        mat.color.set(color)
        mat.emissive.set(color)
        mat.emissiveIntensity = 0.6
        mat.wireframe = hpRatio < 0.25
      }
    }

    if (glowRef.current) {
      const hpRatio = coreHp / maxCoreHp
      const pulseSpeed = storeBuffActive ? 4.0 : (hpRatio > 0.5 ? 1.5 : hpRatio > 0.25 ? 3 : 6)
      const scale = 1 + Math.sin(Date.now() * 0.001 * pulseSpeed) * (storeBuffActive ? 0.15 : 0.08)
      glowRef.current.scale.setScalar(scale)

      const matGlow = glowRef.current.material as THREE.MeshBasicMaterial
      matGlow.color.set(storeBuffActive ? '#ffd700' : '#00d4ff')
      matGlow.opacity = storeBuffActive ? 0.18 : 0.1
    }
  })

  // ── Click to upgrade core (only in upgrade mode) ──
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    const state = useGameStore.getState()
    if (!state.isUpgradeMode) return  // Let rays pass through to Arena
    e.stopPropagation()
    state.upgradeCore()
  }

  // Core visual scale grows slightly per level
  const levelScale = 1 + (coreLevel - 1) * 0.1

  // Null raycast function — makes R3F Raycaster skip this group entirely,
  // allowing clicks to reach the Arena floor behind the core.
  const noRaycast = () => null

  return (
    <group position={[0, CORE_SIZE + 0.5, 0]}>
      {/* ═══════════════════════════════════════════
          PHYSICS — RigidBody is here, <Text> is BELOW
          as a sibling, never nested inside.
          ═══════════════════════════════════════════ */}
      <RigidBody
        type="fixed"
        colliders={false}
        userData={{ type: 'core' }}
      >
        <BallCollider args={[CORE_COLLIDER_SIZE * levelScale]} sensor />
      </RigidBody>

      {/* Ground pulsing golden ring shader */}
      <GoldenRingEffect active={isBuffActive} />

      {/* Visual group — raycast={noRaycast} makes raycaster skip the Core
          so clicks pass through to the Arena floor behind it.
          onPointerDown still fires for upgrade mode (Three.js event bubbling). */}
      <group scale={[levelScale, levelScale, levelScale]} onPointerDown={handlePointerDown} raycast={noRaycast}>
        {/* Visual: Octahedron core */}
        <mesh ref={meshRef} castShadow>
          <octahedronGeometry args={[CORE_SIZE, 0]} />
          <meshStandardMaterial
            color="#00d4ff"
            emissive="#00d4ff"
            emissiveIntensity={0.6}
            metalness={0.5}
            roughness={0.2}
          />
        </mesh>

        {/* Glow sphere */}
        <mesh ref={glowRef}>
          <sphereGeometry args={[CORE_SIZE * 1.6, 16, 16]} />
          <meshBasicMaterial
            color="#00d4ff"
            transparent
            opacity={0.1}
            side={THREE.BackSide}
          />
        </mesh>
      </group>

      {/* Level indicator rings — one per level */}
      {Array.from({ length: coreLevel }).map((_, i) => (
        <mesh
          key={i}
          position={[0, -CORE_SIZE - 0.4 - i * 0.4, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[
            CORE_SIZE * (1.2 + i * 0.3) * levelScale,
            CORE_SIZE * (1.5 + i * 0.3) * levelScale,
            32
          ]} />
          <meshBasicMaterial
            color={i === 0 ? '#00d4ff' : '#a855f7'}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* ═══════════════════════════════════════════
          TEXT — SIBLING to RigidBody, not a child.
          depthTest={false} for always-on-top readability.
          ═══════════════════════════════════════════ */}
      {isUpgradeMode && (
        <Billboard>
          <Text
            position={[0, CORE_SIZE * 2.5 * levelScale, 0]}
            fontSize={0.8}
            color={canAfford ? '#00ff88' : '#ffaa00'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#000000"
          >
            {`UPGRADE BASE: $${upgradeCost}`}
            <meshBasicMaterial
              attach="material"
              color={canAfford ? '#00ff88' : '#ffaa00'}
              depthTest={false}
              transparent
              toneMapped={false}
            />
          </Text>
          <Text
            position={[0, CORE_SIZE * 2.5 * levelScale - 1.0, 0]}
            fontSize={0.5}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            {`BASE LVL ${coreLevel}`}
            <meshBasicMaterial
              attach="material"
              color="#94a3b8"
              depthTest={false}
              transparent
              toneMapped={false}
            />
          </Text>
        </Billboard>
      )}
    </group>
  )
}
