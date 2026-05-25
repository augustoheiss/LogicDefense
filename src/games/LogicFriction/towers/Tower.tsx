// ============================================================
// Logic Friction — Active Tower (Low-Poly Obelisk Turret)
// Sprint 5: Type-aware (RAPID/HEAVY), level-scaled stats,
// click-to-upgrade, upgrade mode floating text, Divine Buff,
// Math Zone transparency.
//
// VISUAL: Procedural Low-Poly Obelisk built from R3F primitives:
//   • Stone base (box)
//   • Tapered pillar (4-segment cylinder = pyramidal)
//   • Floating crystal (octahedron, rotating + hovering)
// ALL materials are meshLambertMaterial or meshBasicMaterial.
// ZERO dynamic lights — glow is faked via meshBasicMaterial.
//
// GHOST MODE: Tower starts as a transparent phantom (no physics).
// It solidifies ONLY when the player walks away (dist > 2.5).
//
// TEXT SAFETY: <Text> is rendered as a SIBLING to <RigidBody>,
// never as a child. This prevents WebGL Context Lost.
// ============================================================
import { useRef, useState, useMemo } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { enemyRegistry } from '../enemies/EnemyRegistry'
import {
  TOWER_BLUEPRINTS,
  TOWER_SIZE,
  TOWER_HEIGHT,
  BUFF_COOLDOWN_MULT,
  MATH_ZONE_POSITIONS,
  MATH_ZONE_SENSOR_RADIUS,
} from '../config/constants'
import { useGameStore } from '../state/useGameStore'

interface TowerProps {
  id: string
  position: [number, number, number]
  type: string
  level: number
}

// Distance the player must be from the tower before it solidifies
const SOLIDIFY_DISTANCE = 2.5

// ── Obelisk geometry constants ──────────────────────────────────────────────────
const BASE_W = 1.2
const BASE_H = 0.4
const PILLAR_BOT_R = 0.7
const PILLAR_TOP_R = 0.3
const PILLAR_H = 2.5
const CRYSTAL_R = 0.5
const CRYSTAL_HOVER_AMP = 0.15
const CRYSTAL_HOVER_SPEED = 2.0
const CRYSTAL_Y_BASE = BASE_H + PILLAR_H + 0.6 // Float above the pillar tip

export function Tower({ id, position, type = 'RAPID', level = 1 }: TowerProps) {
  const crystalRef = useRef<THREE.Mesh>(null)
  const beamRef = useRef<THREE.Mesh>(null)
  const baseRef = useRef<THREE.Mesh>(null)
  const pillarRef = useRef<THREE.Mesh>(null)
  const cooldownRef = useRef(0)
  const beamVisualRef = useRef(0)

  // ── Ghost Mode: no RigidBody until player walks away ──
  const [isSolid, setIsSolid] = useState(false)
  const { scene } = useThree()

  // ── NaN-proof blueprint resolution ──
  const bp = TOWER_BLUEPRINTS[type] ?? TOWER_BLUEPRINTS['RAPID']

  // ── NaN-proof level ──
  const safeLevel = Number.isFinite(level) && level >= 1 ? level : 1
  const baseDamage = bp.damage * safeLevel
  const baseRange = bp.range + (safeLevel - 1) * 2
  const baseCooldown = bp.cooldown

  // ── NaN-proof position ──
  const safePos: [number, number, number] = [
    Number.isFinite(position[0]) ? position[0] : 0,
    Number.isFinite(position[1]) ? position[1] : 0,
    Number.isFinite(position[2]) ? position[2] : 0,
  ]

  // Emissive intensity grows with level (visual feedback without scaling)
  const levelEmissive = 0.2 + safeLevel * 0.1

  // Reusable vectors to avoid GC allocations per frame
  const towerWorldPos = useMemo(
    () => new THREE.Vector3(safePos[0], safePos[1], safePos[2]),
    [safePos[0], safePos[1], safePos[2]]
  )
  const playerPosVec = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const store = useGameStore.getState()

    // ── Ghost solidification check ──
    if (!isSolid) {
      const player = scene.getObjectByName('player')
      if (player) {
        player.getWorldPosition(playerPosVec)
        const dist = Math.hypot(
          playerPosVec.x - towerWorldPos.x,
          playerPosVec.z - towerWorldPos.z
        )
        if (dist > SOLIDIFY_DISTANCE) {
          setIsSolid(true)
        }
      }
    }

    // ── Crystal animation (always runs — it's just rotation + sin) ──
    if (crystalRef.current) {
      crystalRef.current.rotation.y += delta * 1.2
      crystalRef.current.position.y =
        CRYSTAL_Y_BASE + Math.sin(state.clock.elapsedTime * CRYSTAL_HOVER_SPEED) * CRYSTAL_HOVER_AMP
    }

    // Free Fire Directive: towers shoot during PLAYING *and* WAVE_CLEAR
    // to eliminate any "ghost" enemies still walking after the wave counter hits 0.
    if (store.phase !== 'PLAYING' && store.phase !== 'WAVE_CLEAR') return
    if (store.isPaused) return

    const buffed = store.isBuffActive
    const effectiveCooldown = buffed ? baseCooldown * BUFF_COOLDOWN_MULT : baseCooldown
    const effectiveDamage = baseDamage

    cooldownRef.current = Math.max(0, cooldownRef.current - delta)

    // ── Scan for closest enemy in range ──
    if (cooldownRef.current <= 0) {
      let closestId: string | null = null
      let closestDist = baseRange * baseRange
      const tx = safePos[0]
      const tz = safePos[2]

      enemyRegistry.forEach((entry, enemyId) => {
        const dx = entry.x - tx
        const dz = entry.z - tz
        const distSq = dx * dx + dz * dz
        if (distSq < closestDist) {
          closestDist = distSq
          closestId = enemyId
        }
      })

      // ── Fire! ──
      if (closestId) {
        const target = enemyRegistry.get(closestId)
        if (target) {
          target.takeDamage(effectiveDamage)
          cooldownRef.current = effectiveCooldown
          beamVisualRef.current = 0.15

          // Point crystal toward target
          if (crystalRef.current) {
            const angle = Math.atan2(target.x - tx, target.z - tz)
            crystalRef.current.rotation.y = angle
          }

          if (beamRef.current) {
            const dx = target.x - tx
            const dz = target.z - tz
            const dist = Math.sqrt(dx * dx + dz * dz)
            beamRef.current.position.set(dx / 2, TOWER_HEIGHT - 0.5, dz / 2)
            beamRef.current.scale.set(0.15, 0.15, dist)
            beamRef.current.lookAt(target.x - tx, TOWER_HEIGHT - 0.5, target.z - tz)
          }
        }
      }
    }

    // ── Beam visual fade ──
    beamVisualRef.current = Math.max(0, beamVisualRef.current - delta)
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = beamVisualRef.current * 6
    }

    // ── Crystal color: buff = gold, upgrade = green, normal = type color ──
    if (crystalRef.current) {
      const mat = crystalRef.current.material as THREE.MeshBasicMaterial
      if (buffed) {
        mat.color.set('#ffd700')
      } else if (store.isUpgradeMode) {
        mat.color.set('#00ff88')
      } else {
        mat.color.set(bp.color)
      }
    }

    // ── Math Zone transparency ──
    const zoneDir = store.mathZonePosition
    const zoneCenter = MATH_ZONE_POSITIONS[zoneDir]
    const dxz = safePos[0] - zoneCenter[0]
    const dzz = safePos[2] - zoneCenter[2]
    const distToZone = Math.sqrt(dxz * dxz + dzz * dzz)
    const inZone = distToZone < MATH_ZONE_SENSOR_RADIUS

    // Ghost = 0.4, solid in math zone = 0.3, solid normal = 1.0
    const ghostOpacity = 0.4
    const solidOpacity = inZone ? 0.3 : 1.0
    const finalOpacity = isSolid ? solidOpacity : ghostOpacity

    const applyOpacity = (mesh: THREE.Mesh | null) => {
      if (!mesh) return
      const mat = mesh.material as THREE.MeshLambertMaterial
      mat.transparent = true
      mat.opacity = finalOpacity
    }
    applyOpacity(baseRef.current)
    applyOpacity(pillarRef.current)
    if (crystalRef.current) {
      const cMat = crystalRef.current.material as THREE.MeshBasicMaterial
      cMat.transparent = true
      cMat.opacity = finalOpacity
    }
  })

  // ── Click to select and upgrade ──
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setSelectedEntity({ id, type: 'tower' })

    const state = useGameStore.getState()
    if (!state.isUpgradeMode) return
    state.upgradeTower(id)
  }

  // ── Store subscriptions for floating UI ──
  const selectedEntity = useGameStore(s => s.selectedEntity)
  const setSelectedEntity = useGameStore(s => s.setSelectedEntity)
  const isUpgradeMode = useGameStore(s => s.isUpgradeMode)
  const coreLevel = useGameStore(s => s.coreLevel)
  const gold = useGameStore(s => s.gold)

  const canUpgrade = safeLevel < coreLevel
  const upgradeCost = bp.cost * safeLevel
  const canAfford = gold >= upgradeCost

  // ── Upgrade text content ──
  const upgradeLabel = canUpgrade
    ? `UPGRADE: $${upgradeCost}`
    : `REQUER BASE LVL ${safeLevel + 1}`
  const upgradeColor = canUpgrade
    ? (canAfford ? '#00ff88' : '#ffaa00')
    : '#ff4444'

  // ═══════════════════════════════════════════════════════════════
  // LOW-POLY OBELISK — procedural tower visual.
  // All materials: meshLambertMaterial (body) / meshBasicMaterial (crystal).
  // ZERO dynamic lights.
  // ═══════════════════════════════════════════════════════════════
  const visualContent = (
    <group onPointerDown={handlePointerDown}>
      {/* ── Stone Base Foundation ── */}
      <mesh ref={baseRef} position={[0, BASE_H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[BASE_W, BASE_H, BASE_W]} />
        <meshLambertMaterial
          color="#3a3a4a"
          emissive={bp.emissive}
          emissiveIntensity={levelEmissive * 0.3}
          transparent
          opacity={isSolid ? 1 : 0.4}
        />
      </mesh>

      {/* ── Tapered Pillar (4 radial segments = pyramidal/obelisk) ── */}
      <mesh ref={pillarRef} position={[0, BASE_H + PILLAR_H / 2, 0]} castShadow>
        <cylinderGeometry args={[PILLAR_TOP_R, PILLAR_BOT_R, PILLAR_H, 4]} />
        <meshLambertMaterial
          color="#5a5a6a"
          emissive={bp.emissive}
          emissiveIntensity={levelEmissive * 0.5}
          transparent
          opacity={isSolid ? 1 : 0.4}
        />
      </mesh>

      {/* ── Floating Energy Crystal (octahedron) ── */}
      <mesh ref={crystalRef} position={[0, CRYSTAL_Y_BASE, 0]}>
        <octahedronGeometry args={[CRYSTAL_R]} />
        <meshBasicMaterial
          color={bp.color}
          transparent
          opacity={isSolid ? 1 : 0.4}
        />
      </mesh>
    </group>
  )

  return (
    <group position={safePos}>
      {/* ═══════════════════════════════════════════
          TEXT — Always OUTSIDE physics. Immune to
          RigidBody mount/unmount crashes.
          ═══════════════════════════════════════════ */}

      {/* Level badge */}
      {safeLevel > 1 && (
        <Billboard>
          <Text
            position={[TOWER_SIZE * 1.8, TOWER_HEIGHT + 0.5, 0]}
            fontSize={0.5}
            color={bp.color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            {`LV${safeLevel}`}
            <meshBasicMaterial
              attach="material"
              color={bp.color}
              depthTest={false}
              transparent
              toneMapped={false}
            />
          </Text>
        </Billboard>
      )}

      {/* Upgrade info (only in upgrade mode) */}
      {isUpgradeMode && (
        <Billboard>
          <Text
            position={[0, TOWER_HEIGHT + 2, 0]}
            fontSize={0.6}
            color={upgradeColor}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#000000"
          >
            {upgradeLabel}
            <meshBasicMaterial
              attach="material"
              color={upgradeColor}
              depthTest={false}
              transparent
              toneMapped={false}
            />
          </Text>
        </Billboard>
      )}

      {/* Level indicator rings (one per level) */}
      {Array.from({ length: safeLevel }).map((_, i) => (
        <mesh
          key={i}
          position={[0, 0.5 + i * 0.8, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[TOWER_SIZE * 1.4, TOWER_SIZE * 1.6, 8]} />
          <meshBasicMaterial
            color={bp.color}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Range ring — only when selected */}
      {selectedEntity?.id === id && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[baseRange - 0.3, baseRange, 48]} />
          <meshBasicMaterial
            color={bp.color}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Laser beam */}
      <mesh ref={beamRef} position={[0, TOWER_HEIGHT - 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={bp.color} transparent opacity={0} />
      </mesh>

      {/* ═══════════════════════════════════════════
          PHYSICS — Conditional mount. Ghost mode has
          no RigidBody at all; Rapier doesn't know it
          exists. Once player walks away, solidify.
          ═══════════════════════════════════════════ */}
      {!isSolid ? (
        <group>{visualContent}</group>
      ) : (
        <RigidBody
          type="fixed"
          colliders={false}
          userData={{ type: 'tower', towerId: id }}
        >
          <CuboidCollider
            args={[TOWER_SIZE, TOWER_HEIGHT / 2, TOWER_SIZE]}
            position={[0, TOWER_HEIGHT / 2, 0]}
          />
          {visualContent}
        </RigidBody>
      )}
    </group>
  )
}
