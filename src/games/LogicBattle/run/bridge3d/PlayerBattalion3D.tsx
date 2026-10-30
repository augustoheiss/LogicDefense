// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/PlayerBattalion3D.tsx
// Master Plan V11: Renderizador Híbrido 2.5D HD + Rigs 3D Articulados do
// Herói Comandante, Arma Multi-Cano Dinâmica, Formação Zero-to-Hero Honesta
// (Unidades Vai-Um 10 / 0,1k / 1k com pernas/braços articulados e sprites 512x512)
// e Pool de Projéteis 3D Retos (-Z).
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
import { getUnitSpriteTexture } from './spriteAtlasCache3D'

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
  const heroLeftLegRef = useRef<THREE.Mesh | null>(null)
  const heroRightLegRef = useRef<THREE.Mesh | null>(null)
  const heroCapeRef = useRef<THREE.Mesh | null>(null)
  const heroArmorMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const heroRingMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const heroShieldPlaqueMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const heroBarrelsGroupRef = useRef<THREE.Group | null>(null)
  const soldiersGroupRef = useRef<THREE.Group | null>(null)
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

  // Sprites 2.5D HD cacheados em GPU (512x512 com alphaTest)
  const heroCommanderSpriteTex = useMemo(
    () => getUnitSpriteTexture('HERO_COMMANDER'),
    [],
  )
  const alliedSoldierSpriteTex = useMemo(
    () => getUnitSpriteTexture('ALLIED_SOLDIER'),
    [],
  )
  const decurionSpriteTex = useMemo(
    () => getUnitSpriteTexture('ALLIED_DECURION_10'),
    [],
  )
  const centurionSpriteTex = useMemo(
    () => getUnitSpriteTexture('ALLIED_CENTURION_100'),
    [],
  )
  const championSpriteTex = useMemo(
    () => getUnitSpriteTexture('ALLIED_CHAMPION_1000'),
    [],
  )

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
      heroGroupRef.current.position.y = Math.abs(Math.sin(clockSec * 7.5)) * 0.08
    }

    // Cinemática de marcha articulada nas pernas e capa do Herói Comandante
    if (heroLeftLegRef.current && heroRightLegRef.current) {
      const stride = Math.sin(clockSec * 9.5) * 0.42
      heroLeftLegRef.current.rotation.x = stride
      heroRightLegRef.current.rotation.x = -stride
    }
    if (heroCapeRef.current) {
      heroCapeRef.current.rotation.x = 0.24 + Math.sin(clockSec * 6.2) * 0.12
    }

    // Cinemática de marcha nos soldados extras do batalhão (pernas esquerda/direita e inclinação 2.5D)
    if (soldiersGroupRef.current) {
      const children = soldiersGroupRef.current.children
      for (let i = 0; i < children.length; i++) {
        const sGrp = children[i] as THREE.Group | undefined
        if (!sGrp) continue
        const phase = clockSec * 10.0 + i * 0.85
        sGrp.position.y = Math.abs(Math.sin(phase)) * 0.09
        const legL = sGrp.children[0] as THREE.Mesh | undefined
        const legR = sGrp.children[1] as THREE.Mesh | undefined
        if (legL && legR) {
          const legSwing = Math.sin(phase) * 0.48
          legL.rotation.x = legSwing
          legR.rotation.x = -legSwing
        }
      }
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

    // Sincronizar canos paralelos da arma do Herói (incluindo canos extras das rotas laterais e torres)
    if (heroBarrelsGroupRef.current) {
      const barrelChildren = heroBarrelsGroupRef.current.children
      const activeBarrels = Math.max(
        1,
        Math.min(MAX_HERO_BARRELS, sim.shotProfile.parallelBarrels),
      )
      const barrelRecoil = Math.max(0, Math.sin(clockSec * 22)) * 0.08
      for (let bIdx = 0; bIdx < MAX_HERO_BARRELS; bIdx++) {
        const bMesh = barrelChildren[bIdx] as THREE.Mesh | undefined
        if (!bMesh) continue
        bMesh.visible = bIdx < activeBarrels
        if (bIdx < activeBarrels) {
          bMesh.position.x = (bIdx - (activeBarrels - 1) * 0.5) * 0.36
          bMesh.position.z = -0.95 + barrelRecoil
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
          <ringGeometry args={[0.92, 1.38, 28]} />
          <meshBasicMaterial
            ref={heroRingMatRef}
            color="#38bdf8"
            transparent
            opacity={0.58}
          />
        </mesh>

        {/* 1. HERÓI COMANDANTE ARTICULADO 3D + SPRITE 2.5D HD */}
        <group position={[0, 0, 0]} name="HeroCommanderArticulatedRig">
          {/* Pernas 3D Articuladas (Esquerda e Direita) */}
          <mesh ref={heroLeftLegRef} position={[-0.26, 0.42, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.45, 6, 8]} />
            <meshStandardMaterial color="#1e3a8a" metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh ref={heroRightLegRef} position={[0.26, 0.42, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.45, 6, 8]} />
            <meshStandardMaterial color="#1e3a8a" metalness={0.5} roughness={0.35} />
          </mesh>

          {/* Capa Tática Ondulante nas Costas (+Z) */}
          <mesh
            ref={heroCapeRef}
            position={[0, 1.25, 0.42]}
            rotation={[0.24, 0, 0]}
            castShadow
          >
            <boxGeometry args={[0.98, 1.35, 0.08]} />
            <meshStandardMaterial color="#1d4ed8" roughness={0.65} />
          </mesh>

          {/* Torso Blindado 3D do Comandante */}
          <mesh position={[0, 1.42, 0]} castShadow>
            <capsuleGeometry args={[0.45, 0.72, 8, 12]} />
            <meshStandardMaterial
              ref={heroArmorMatRef}
              color="#2563eb"
              emissive="#1d4ed8"
              emissiveIntensity={0.28}
              roughness={0.35}
              metalness={0.45}
            />
          </mesh>

          {/* Sprite 2.5D HD Ilustrado de Armadura/Heráldica do Comandante */}
          <mesh position={[0, 1.55, -0.48]} rotation={[-0.06, 0, 0]}>
            <planeGeometry args={[1.55, 1.65]} />
            <meshBasicMaterial
              map={heroCommanderSpriteTex}
              transparent
              alphaTest={0.45}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Ombreiras Táticas 3D */}
          <mesh position={[-0.58, 1.68, 0]} castShadow>
            <sphereGeometry args={[0.26, 10, 10]} />
            <meshStandardMaterial color="#facc15" metalness={0.75} roughness={0.22} />
          </mesh>
          <mesh position={[0.58, 1.68, 0]} castShadow>
            <sphereGeometry args={[0.26, 10, 10]} />
            <meshStandardMaterial color="#facc15" metalness={0.75} roughness={0.22} />
          </mesh>

          {/* Elmo Dourado + Crista + Visor Luminoso do Herói */}
          <mesh position={[0, 2.28, 0]} castShadow>
            <sphereGeometry args={[0.42, 12, 12]} />
            <meshStandardMaterial color="#facc15" metalness={0.72} roughness={0.22} />
          </mesh>
          <mesh position={[0, 2.72, 0]} castShadow>
            <boxGeometry args={[0.14, 0.36, 0.58]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, 2.26, -0.36]}>
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
                  <cylinderGeometry args={[0.12, 0.16, 1.55, 10]} />
                  <meshStandardMaterial
                    color={baseProfile.projectileColor}
                    metalness={0.75}
                    roughness={0.2}
                  />
                </mesh>
              )
            })}
          </group>

          {/* Placa 3D Flutuante com Pontuação Atual e Tier do Tiro */}
          <mesh position={[0, 3.85, 0]}>
            <planeGeometry args={[3.8, 1.9]} />
            <meshBasicMaterial
              ref={heroShieldPlaqueMatRef}
              map={heroShieldTex}
              transparent
            />
          </mesh>
        </group>

        {/* 2. SOLDADOS EXTRAS 2.5D HD + PERNAS 3D ARTICULADAS */}
        <group ref={soldiersGroupRef} name="PlayerExtraSoldiersRigGroup">
          {Array.from({ length: honestExtraSoldiersCount }).map((_, sIdx) => {
            const row = Math.floor(sIdx / 6) + 1
            const col = (sIdx % 6) - 2.5
            const sx = col * 0.82
            const sz = row * 1.08
            return (
              <group key={`extra_soldier_${sIdx}`} position={[sx, 0, sz]}>
                {/* Perna Esquerda 3D */}
                <mesh position={[-0.12, 0.26, 0]} castShadow>
                  <capsuleGeometry args={[0.08, 0.28, 4, 6]} />
                  <meshStandardMaterial color="#1e3a8a" roughness={0.5} />
                </mesh>
                {/* Perna Direita 3D */}
                <mesh position={[0.12, 0.26, 0]} castShadow>
                  <capsuleGeometry args={[0.08, 0.28, 4, 6]} />
                  <meshStandardMaterial color="#1e3a8a" roughness={0.5} />
                </mesh>
                {/* Corpo 3D + Sprite 2.5D HD Ilustrado do Soldado */}
                <mesh position={[0, 0.72, 0]} castShadow>
                  <capsuleGeometry args={[0.22, 0.42, 6, 8]} />
                  <meshStandardMaterial color="#2563eb" roughness={0.4} metalness={0.35} />
                </mesh>
                <mesh position={[0, 0.92, -0.24]} rotation={[-0.08, 0, 0]}>
                  <planeGeometry args={[1.08, 1.18]} />
                  <meshBasicMaterial
                    map={alliedSoldierSpriteTex}
                    transparent
                    alphaTest={0.45}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                {/* Lança / Rifle Tático 3D */}
                <mesh position={[0.24, 0.78, -0.32]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.04, 0.05, 0.62, 6]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.7} />
                </mesh>
              </group>
            )
          })}
        </group>

        {/* 3. DECURIÃO 10 (Só aparece quando currentArmy >= 10!) */}
        {hasSquad10 && (
          <group position={[hasChampion1k ? 0 : 1.78, 0, hasChampion1k ? 1.88 : 0.78]}>
            <mesh position={[-0.16, 0.34, 0]} castShadow>
              <capsuleGeometry args={[0.1, 0.36, 6, 8]} />
              <meshStandardMaterial color="#164e63" metalness={0.5} />
            </mesh>
            <mesh position={[0.16, 0.34, 0]} castShadow>
              <capsuleGeometry args={[0.1, 0.36, 6, 8]} />
              <meshStandardMaterial color="#164e63" metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.98, 0]} castShadow>
              <capsuleGeometry args={[0.32, 0.58, 6, 10]} />
              <meshStandardMaterial
                color="#06b6d4"
                emissive="#0891b2"
                emissiveIntensity={0.3}
                metalness={0.45}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, 1.18, -0.34]} rotation={[-0.06, 0, 0]}>
              <planeGeometry args={[1.45, 1.55]} />
              <meshBasicMaterial
                map={decurionSpriteTex}
                transparent
                alphaTest={0.45}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 2.58, 0]}>
              <planeGeometry args={[1.9, 0.95]} />
              <meshBasicMaterial map={squad10Tex} transparent />
            </mesh>
          </group>
        )}

        {/* 4. CENTURIÃO 0,1k (Só aparece quando currentArmy >= 100!) */}
        {hasCenturion01k && (
          <group position={[-2.25, 0, 0.62]}>
            <mesh position={[-0.2, 0.42, 0]} castShadow>
              <capsuleGeometry args={[0.13, 0.44, 6, 8]} />
              <meshStandardMaterial color="#78350f" metalness={0.6} />
            </mesh>
            <mesh position={[0.2, 0.42, 0]} castShadow>
              <capsuleGeometry args={[0.13, 0.44, 6, 8]} />
              <meshStandardMaterial color="#78350f" metalness={0.6} />
            </mesh>
            <mesh position={[0, 1.18, 0]} castShadow>
              <capsuleGeometry args={[0.44, 0.78, 8, 10]} />
              <meshStandardMaterial color="#d97706" metalness={0.55} roughness={0.3} />
            </mesh>
            <mesh position={[0, 1.42, -0.45]} rotation={[-0.06, 0, 0]}>
              <planeGeometry args={[1.85, 1.95]} />
              <meshBasicMaterial
                map={centurionSpriteTex}
                transparent
                alphaTest={0.45}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 3.08, 0]}>
              <planeGeometry args={[2.5, 1.25]} />
              <meshBasicMaterial map={centurionTex} transparent />
            </mesh>
          </group>
        )}

        {/* 5. CAMPEÃO 1k (Só aparece quando currentArmy >= 1000!) */}
        {hasChampion1k && (
          <group position={[2.25, 0, 0.62]}>
            <mesh position={[-0.24, 0.48, 0]} castShadow>
              <capsuleGeometry args={[0.15, 0.52, 6, 8]} />
              <meshStandardMaterial color="#713f12" metalness={0.75} />
            </mesh>
            <mesh position={[0.24, 0.48, 0]} castShadow>
              <capsuleGeometry args={[0.15, 0.52, 6, 8]} />
              <meshStandardMaterial color="#713f12" metalness={0.75} />
            </mesh>
            <mesh position={[0, 1.38, 0]} castShadow>
              <capsuleGeometry args={[0.52, 0.98, 8, 12]} />
              <meshStandardMaterial color="#eab308" metalness={0.75} roughness={0.2} />
            </mesh>
            <mesh position={[0, 1.62, -0.52]} rotation={[-0.06, 0, 0]}>
              <planeGeometry args={[2.15, 2.25]} />
              <meshBasicMaterial
                map={championSpriteTex}
                transparent
                alphaTest={0.45}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 3.38, 0]}>
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
