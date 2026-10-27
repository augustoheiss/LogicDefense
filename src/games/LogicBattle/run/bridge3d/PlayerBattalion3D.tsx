// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/PlayerBattalion3D.tsx
// Fase 3 V7: Renderizador 3D dedicado do Herói Atirador, Arma Multi-Cano Dinâmica,
// Formação Zero-to-Hero Honesta (0 soldados extras quando army <= 5; Unidades Vai-Um
// 10 / 0,1k / 1k apenas quando conquistadas) e Pool de Projéteis 3D Retos (-Z).
// 100% WebGL via THREE.CanvasTexture (zero nós DOM <Html> por frame).
// ──────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { formatArmy } from '../../domain/notation'
import { NotationMode } from '../../types'
import {
  BRIDGE_3D_DIMENSIONS,
  computeShotProfile,
} from './bridge3dPolicies'
import { Bridge3DSimState, MAX_SIM_BOLTS } from './bridge3dSim'
import { getPlaqueTexture } from './plaqueTextureCache'

export interface PlayerBattalion3DProps {
  readonly simRef: React.MutableRefObject<Bridge3DSimState>
  readonly currentArmy: number
  readonly notationMode: NotationMode
}

const MAX_SOLDIER_MESHES = 24
const MAX_HERO_BARRELS = 6

export const PlayerBattalion3D: React.FC<PlayerBattalion3DProps> = ({
  simRef,
  currentArmy,
  notationMode,
}) => {
  const heroGroupRef = useRef<THREE.Group | null>(null)
  const heroArmorMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const heroRingMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const heroShieldPlaqueMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const heroBarrelsGroupRef = useRef<THREE.Group | null>(null)
  const boltsGroupRef = useRef<THREE.Group | null>(null)

  const baseProfile = useMemo(() => computeShotProfile(currentArmy), [currentArmy])

  // Honestidade Zero-to-Hero: 0 soldados extras quando currentArmy <= 5!
  const honestExtraSoldiersCount = useMemo(() => {
    if (currentArmy <= 5) return 0
    return Math.min(
      MAX_SOLDIER_MESHES,
      Math.max(1, Math.floor(Math.log2(Math.max(2, currentArmy - 3)) * 3)),
    )
  }, [currentArmy])

  const hasSquad10 = currentArmy >= 10
  const hasCenturion01k = currentArmy >= 100
  const hasChampion1k = currentArmy >= 1000

  const heroShieldTex = useMemo(
    () =>
      getPlaqueTexture(
        `🛡️ ${formatArmy(currentArmy, notationMode)}`,
        '#1d4ed8',
        '#93c5fd',
        '#ffffff',
        baseProfile.tierLabel,
      ),
    [currentArmy, notationMode, baseProfile.tierLabel],
  )

  const squad10Tex = useMemo(
    () => getPlaqueTexture('🛡️ 10', '#0e7490', '#67e8f9', '#ffffff', 'DECURIÃO'),
    [],
  )

  const centurionTex = useMemo(
    () => getPlaqueTexture('🛡️ 0,1k', '#b45309', '#fde047', '#ffffff', 'CENTURIÃO'),
    [],
  )

  const championTex = useMemo(
    () => getPlaqueTexture('👑 1k', '#ca8a04', '#fef08a', '#ffffff', 'CAMPEÃO'),
    [],
  )

  useFrame((state) => {
    const sim = simRef.current
    const clockSec = state.clock.elapsedTime
    const hitFlash = sim.playerHitFlashMs > 0

    if (heroGroupRef.current) {
      heroGroupRef.current.position.x = sim.heroWorldX
      heroGroupRef.current.position.y = Math.abs(Math.sin(clockSec * 7)) * 0.08
    }

    if (heroArmorMatRef.current) {
      heroArmorMatRef.current.color.set(hitFlash ? '#ef4444' : '#2563eb')
      heroArmorMatRef.current.emissive.set(
        hitFlash
          ? '#dc2626'
          : sim.rightFrozenWeapon.unlocked
            ? '#f59e0b'
            : '#1d4ed8',
      )
      heroArmorMatRef.current.emissiveIntensity = hitFlash ? 0.85 : 0.28
    }

    if (heroRingMatRef.current) {
      heroRingMatRef.current.color.set(hitFlash ? '#ef4444' : '#38bdf8')
      heroRingMatRef.current.opacity = hitFlash ? 0.92 : 0.58
    }

    if (heroShieldPlaqueMatRef.current) {
      const subLabel =
        sim.rightFrozenWeapon.unlocked || sim.leftFrozenBlock.unlocked
          ? `⚡ ${formatArmy(sim.shotProfile.damagePerShot, notationMode)}×${sim.shotProfile.parallelBarrels}`
          : sim.shotProfile.tierLabel
      const nextTex = getPlaqueTexture(
        `🛡️ ${formatArmy(currentArmy, notationMode)}`,
        hitFlash ? '#dc2626' : '#1d4ed8',
        hitFlash ? '#fecaca' : '#93c5fd',
        '#ffffff',
        subLabel,
      )
      if (heroShieldPlaqueMatRef.current.map !== nextTex) {
        heroShieldPlaqueMatRef.current.map = nextTex
        heroShieldPlaqueMatRef.current.needsUpdate = true
      }
    }

    // Sincronizar canos paralelos da arma do Herói (incluindo canos extras das rotas laterais)
    if (heroBarrelsGroupRef.current) {
      const barrelChildren = heroBarrelsGroupRef.current.children
      const activeBarrels = Math.max(
        1,
        Math.min(MAX_HERO_BARRELS, sim.shotProfile.parallelBarrels),
      )
      for (let bIdx = 0; bIdx < MAX_HERO_BARRELS; bIdx++) {
        const bMesh = barrelChildren[bIdx] as THREE.Mesh | undefined
        if (!bMesh) continue
        bMesh.visible = bIdx < activeBarrels
        if (bIdx < activeBarrels) {
          bMesh.position.x = (bIdx - (activeBarrels - 1) * 0.5) * 0.36
        }
      }
    }

    // Sincronizar pool de projéteis 3D disparados sempre para frente (-Z)
    if (boltsGroupRef.current) {
      const children = boltsGroupRef.current.children
      for (let i = 0; i < MAX_SIM_BOLTS; i++) {
        const mesh = children[i] as THREE.Mesh | undefined
        const bolt = sim.bolts[i]
        if (!mesh || !bolt) continue
        mesh.visible = bolt.active
        if (bolt.active) {
          mesh.position.set(bolt.x, bolt.y, bolt.z)
          mesh.scale.setScalar(bolt.scale)
        }
      }
    }
  })

  return (
    <>
      <group
        ref={heroGroupRef}
        position={[0, 0, BRIDGE_3D_DIMENSIONS.zPlayerLine]}
        name="PlayerHeroAndBattalion3D"
      >
        {/* Halo Tático no Piso sob o Atirador */}
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.92, 1.32, 28]} />
          <meshBasicMaterial
            ref={heroRingMatRef}
            color="#38bdf8"
            transparent
            opacity={0.58}
          />
        </mesh>

        {/* 1. HERÓI ATIRADOR PRINCIPAL (Sempre presente: 1 unidade inicial honesta) */}
        <group position={[0, 0, 0]}>
          {/* Base Blindada Azul 3D */}
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.95, 1.15, 1.0, 14]} />
            <meshStandardMaterial color="#1d4ed8" metalness={0.45} roughness={0.35} />
          </mesh>

          {/* Corpo do Herói Comandante */}
          <mesh position={[0, 1.45, 0]} castShadow>
            <capsuleGeometry args={[0.45, 0.72, 8, 12]} />
            <meshStandardMaterial
              ref={heroArmorMatRef}
              color="#2563eb"
              emissive="#1d4ed8"
              emissiveIntensity={0.28}
              roughness={0.35}
              metalness={0.35}
            />
          </mesh>

          {/* Ombreiras Táticas */}
          <mesh position={[-0.55, 1.65, 0]} castShadow>
            <sphereGeometry args={[0.24, 10, 10]} />
            <meshStandardMaterial color="#60a5fa" metalness={0.55} roughness={0.28} />
          </mesh>
          <mesh position={[0.55, 1.65, 0]} castShadow>
            <sphereGeometry args={[0.24, 10, 10]} />
            <meshStandardMaterial color="#60a5fa" metalness={0.55} roughness={0.28} />
          </mesh>

          {/* Elmo Dourado + Visor Luminoso do Herói */}
          <mesh position={[0, 2.25, 0]} castShadow>
            <sphereGeometry args={[0.42, 12, 12]} />
            <meshStandardMaterial color="#facc15" metalness={0.65} roughness={0.25} />
          </mesh>
          <mesh position={[0, 2.24, -0.35]}>
            <boxGeometry args={[0.48, 0.16, 0.14]} />
            <meshBasicMaterial color="#fef08a" />
          </mesh>

          {/* Canos de Disparo Dinâmicos apontados sempre para frente (-Z) */}
          <group ref={heroBarrelsGroupRef}>
            {Array.from({ length: MAX_HERO_BARRELS }).map((_, bIdx) => {
              const isInitVisible = bIdx < baseProfile.parallelBarrels
              const bx =
                (bIdx - (baseProfile.parallelBarrels - 1) * 0.5) * 0.36
              return (
                <mesh
                  key={`hero_barrel_${bIdx}`}
                  visible={isInitVisible}
                  position={[bx, 1.25, -0.95]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.12, 0.16, 1.5, 10]} />
                  <meshStandardMaterial
                    color={baseProfile.projectileColor}
                    metalness={0.7}
                    roughness={0.2}
                  />
                </mesh>
              )
            })}
          </group>

          {/* Placa 3D Flutuante com Pontuação Atual e Tier do Tiro */}
          <mesh position={[0, 3.82, 0]}>
            <planeGeometry args={[3.8, 1.9]} />
            <meshBasicMaterial
              ref={heroShieldPlaqueMatRef}
              map={heroShieldTex}
              transparent
            />
          </mesh>
        </group>

        {/* 2. SOLDADOS EXTRAS 3D: Começa em ZERO quando currentArmy <= 5 e cresce conforme faz pontos! */}
        {Array.from({ length: honestExtraSoldiersCount }).map((_, sIdx) => {
          const row = Math.floor(sIdx / 6) + 1
          const col = (sIdx % 6) - 2.5
          const sx = col * 0.78
          const sz = row * 1.05
          return (
            <group key={`extra_soldier_${sIdx}`} position={[sx, 0, sz]}>
              <mesh position={[0, 0.65, 0]} castShadow>
                <capsuleGeometry args={[0.26, 0.48, 6, 8]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.45} />
              </mesh>
              <mesh position={[0, 1.25, 0]} castShadow>
                <sphereGeometry args={[0.24, 8, 8]} />
                <meshStandardMaterial color="#93c5fd" metalness={0.4} />
              </mesh>
              <mesh position={[0.16, 0.72, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.05, 0.45, 6]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.6} />
              </mesh>
            </group>
          )
        })}

        {/* 3. DECURIÃO 10 (Só aparece quando currentArmy >= 10!) */}
        {hasSquad10 && (
          <group position={[hasChampion1k ? 0 : 1.75, 0, hasChampion1k ? 1.85 : 0.75]}>
            <mesh position={[0, 0.92, 0]} castShadow>
              <capsuleGeometry args={[0.34, 0.62, 6, 10]} />
              <meshStandardMaterial
                color="#06b6d4"
                emissive="#0891b2"
                emissiveIntensity={0.3}
                metalness={0.45}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, 1.62, 0]} castShadow>
              <sphereGeometry args={[0.28, 10, 10]} />
              <meshStandardMaterial color="#67e8f9" metalness={0.5} />
            </mesh>
            <mesh position={[0, 2.52, 0]}>
              <planeGeometry args={[1.9, 0.95]} />
              <meshBasicMaterial map={squad10Tex} transparent />
            </mesh>
          </group>
        )}

        {/* 4. CENTURIÃO 0,1k (Só aparece quando currentArmy >= 100!) */}
        {hasCenturion01k && (
          <group position={[-2.2, 0, 0.6]}>
            <mesh position={[0, 1.15, 0]} castShadow>
              <capsuleGeometry args={[0.48, 0.85, 8, 10]} />
              <meshStandardMaterial color="#d97706" metalness={0.55} roughness={0.3} />
            </mesh>
            <mesh position={[0, 1.95, 0]} castShadow>
              <sphereGeometry args={[0.36, 12, 12]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.2} />
            </mesh>
            <mesh position={[0, 3.05, 0]}>
              <planeGeometry args={[2.5, 1.25]} />
              <meshBasicMaterial map={centurionTex} transparent />
            </mesh>
          </group>
        )}

        {/* 5. CAMPEÃO 1k (Só aparece quando currentArmy >= 1000!) */}
        {hasChampion1k && (
          <group position={[2.2, 0, 0.6]}>
            <mesh position={[0, 1.35, 0]} castShadow>
              <capsuleGeometry args={[0.56, 1.05, 8, 12]} />
              <meshStandardMaterial color="#eab308" metalness={0.75} roughness={0.2} />
            </mesh>
            <mesh position={[0, 2.25, 0]} castShadow>
              <sphereGeometry args={[0.42, 12, 12]} />
              <meshStandardMaterial color="#fef08a" metalness={0.85} roughness={0.15} />
            </mesh>
            <mesh position={[0, 3.35, 0]}>
              <planeGeometry args={[2.7, 1.35]} />
              <meshBasicMaterial map={championTex} transparent />
            </mesh>
          </group>
        )}
      </group>

      {/* ── POOL DE PROJÉTEIS 3D DISPARADOS SEMPRE PARA FRENTE (-Z) ─────────── */}
      <group ref={boltsGroupRef} name="PlayerBoltsPool3D">
        {Array.from({ length: MAX_SIM_BOLTS }).map((_, idx) => (
          <mesh key={`bolt_3d_${idx}`} visible={false}>
            <sphereGeometry args={[0.24, 8, 8]} />
            <meshBasicMaterial color={baseProfile.projectileColor} />
          </mesh>
        ))}
      </group>
    </>
  )
}
