// ============================================================
// Logic Friction — Active Tower (Auto-Targeting Turret)
// Sprint 5: Type-aware (RAPID/HEAVY), level-scaled stats,
// click-to-upgrade, upgrade mode floating text, Divine Buff,
// Math Zone transparency.
//
// GHOST MODE: Tower starts as a transparent phantom (no physics).
// It solidifies ONLY when the player walks away (dist > 2.5).
// This prevents the player from being physically trapped inside
// the tower after funding a construction site.
//
// TEXT SAFETY: <Text> is rendered as a SIBLING to <RigidBody>,
// never as a child. This prevents WebGL Context Lost.
//
// NO visual scaling on level-up. Feedback via emissive intensity
// + ring indicators + floating <Text>.
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
  BUFF_DAMAGE_MULT,
  BUFF_COOLDOWN_MULT,
  BUFF_AOE_RANGE,
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

export function Tower({ id, position, type = 'RAPID', level = 1 }: TowerProps) {
  const turretRef = useRef<THREE.Mesh>(null)
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

  useFrame((_, delta) => {
    const state = useGameStore.getState()

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

    if (state.phase !== 'PLAYING') return
    if (state.isPaused) return

    const buffed = state.isBuffActive
    const effectiveCooldown = buffed ? baseCooldown * BUFF_COOLDOWN_MULT : baseCooldown
    const effectiveDamage = buffed ? baseDamage * BUFF_DAMAGE_MULT : baseDamage

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

          // AoE splash when buffed
          if (buffed) {
            const aoeSq = BUFF_AOE_RANGE * BUFF_AOE_RANGE
            enemyRegistry.forEach((entry, enemyId) => {
              if (enemyId === closestId) return
              const dx = entry.x - target.x
              const dz = entry.z - target.z
              if (dx * dx + dz * dz < aoeSq) {
                entry.takeDamage(effectiveDamage * 0.5)
              }
            })
          }

          if (turretRef.current) {
            const angle = Math.atan2(target.x - tx, target.z - tz)
            turretRef.current.rotation.y = angle
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

    // ── Turret emissive: buff + upgrade mode pulse ──
    if (turretRef.current) {
      const mat = turretRef.current.material as THREE.MeshStandardMaterial
      if (buffed) {
        mat.emissive.set('#ffd700')
        mat.emissiveIntensity = 0.6 + Math.sin(Date.now() * 0.005) * 0.3
      } else if (state.isUpgradeMode) {
        mat.emissive.set('#00ff88')
        mat.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.004) * 0.3
      } else {
        mat.emissive.set(bp.emissive)
        mat.emissiveIntensity = 0.6
      }
    }

    // ── Math Zone transparency ──
    const zoneDir = state.mathZonePosition
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
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.transparent = true
      mat.opacity = finalOpacity
    }
    applyOpacity(baseRef.current)
    applyOpacity(pillarRef.current)
    if (turretRef.current) {
      const tMat = turretRef.current.material as THREE.MeshStandardMaterial
      tMat.transparent = true
      tMat.opacity = finalOpacity
    }
  })

  // ── Click to upgrade (only in upgrade mode) ──
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const state = useGameStore.getState()
    if (!state.isUpgradeMode) return
    state.upgradeTower(id)
  }

  // ── Store subscriptions for floating UI ──
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
  // VISUAL CONTENT — shared between ghost and solid modes.
  // Transparency controlled by useFrame (ghost=0.4, solid=1.0).
  // ═══════════════════════════════════════════════════════════════
  const visualContent = (
    <group onPointerDown={handlePointerDown}>
      {/* Base platform */}
      <mesh ref={baseRef} position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[TOWER_SIZE * 1.3, TOWER_SIZE * 1.5, 0.3, 8]} />
        <meshStandardMaterial
          color="#1a1a3a"
          emissive={bp.emissive}
          emissiveIntensity={levelEmissive}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={isSolid ? 1 : 0.4}
        />
      </mesh>

      {/* Main pillar */}
      <mesh ref={pillarRef} position={[0, TOWER_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[TOWER_SIZE * 1.4, TOWER_HEIGHT, TOWER_SIZE * 1.4]} />
        <meshStandardMaterial
          color="#0f0f2a"
          emissive={bp.emissive}
          emissiveIntensity={levelEmissive * 0.75}
          metalness={0.6}
          roughness={0.3}
          transparent
          opacity={isSolid ? 1 : 0.4}
        />
      </mesh>

      {/* Turret head */}
      <mesh ref={turretRef} position={[0, TOWER_HEIGHT, 0]} castShadow>
        <octahedronGeometry args={[TOWER_SIZE * 0.8, 0]} />
        <meshStandardMaterial
          color={bp.color}
          emissive={bp.emissive}
          emissiveIntensity={0.6}
          metalness={0.5}
          roughness={0.2}
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

      {/* Range ring */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseRange - 0.3, baseRange, 48]} />
        <meshBasicMaterial
          color={bp.color}
          transparent
          opacity={0.03}
          side={THREE.DoubleSide}
        />
      </mesh>

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
