// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/EnemyHordeAndBoss3D.tsx
// Fase 3 V7: Renderizador 3D dedicado da Horda Inimiga Não-Ornamental,
// Barris Explosivos (112 HP), Mini-Bosses (176 HP) e Mega-Boss Articulado do Setor.
// 100% WebGL via THREE.CanvasTexture (zero nós DOM <Html> por frame).
// ──────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { formatArmy } from '../../domain/notation'
import { NotationMode } from '../../types'
import { BOSS_ARCHETYPES_3D } from './bridge3dPolicies'
import { Bridge3DSimState } from './bridge3dSim'
import { getPlaqueTexture } from './plaqueTextureCache'

export interface EnemyHordeAndBoss3DProps {
  readonly simRef: React.MutableRefObject<Bridge3DSimState>
  readonly bossName: string
  readonly bossTotalForce: number
  readonly notationMode: NotationMode
}

export const EnemyHordeAndBoss3D: React.FC<EnemyHordeAndBoss3DProps> = ({
  simRef,
  bossName,
  bossTotalForce,
  notationMode,
}) => {
  const barrelsGroupRef = useRef<THREE.Group | null>(null)
  const enemyHordeGroupRef = useRef<THREE.Group | null>(null)
  const bossGroupRef = useRef<THREE.Group | null>(null)
  const bossHammerPivotRef = useRef<THREE.Group | null>(null)
  const bossPlaqueMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const bossTorsoMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const bossLeftPauldronMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const bossRightPauldronMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const bossHeadMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const bossLeftHornMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const bossRightHornMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const bossArchExtrasGroupRef = useRef<THREE.Group | null>(null)
  const supplyCaravanGroupRef = useRef<THREE.Group | null>(null)
  const supplyCaravanPlaqueMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const supplyCaravanCrystalRef = useRef<THREE.Mesh | null>(null)

  const barrel112Tex = useMemo(
    () => getPlaqueTexture('💀 112 HP', '#7f1d1d', '#facc15', '#ffffff', 'MINI-BOSS'),
    [],
  )
  const miniBossTex = useMemo(
    () => getPlaqueTexture('💀 176 HP', '#7f1d1d', '#f87171', '#ffffff', 'MINI-BOSS'),
    [],
  )
  const bossPlaqueTex = useMemo(
    () =>
      getPlaqueTexture(
        `👹 ${formatArmy(Math.max(150, bossTotalForce), notationMode)}`,
        '#991b1b',
        '#facc15',
        '#ffffff',
        bossName.slice(0, 14).toUpperCase(),
      ),
    [bossTotalForce, bossName, notationMode],
  )
  const supplyCaravanDefaultTex = useMemo(
    () =>
      getPlaqueTexture(
        '🎁 +BÔNUS',
        '#047857',
        '#fde047',
        '#ffffff',
        '⏳ INTERMISSÃO',
      ),
    [],
  )

  useFrame((state, delta) => {
    const dt = Math.min(0.05, Math.max(0.004, delta))
    const clockSec = state.clock.elapsedTime
    const sim = simRef.current

    // 1. Sincronizar Mini-Bosses Demolidores do Setor (112+ HP) em marcha contínua (+Z) sem travar nem inflar de tamanho
    if (barrelsGroupRef.current) {
      const children = barrelsGroupRef.current.children
      for (let i = 0; i < sim.barrels.length; i++) {
        const barrel = sim.barrels[i]
        const grp = children[i] as THREE.Group | undefined
        if (!grp || !barrel) continue
        grp.visible = barrel.active
        grp.scale.set(1.45, 1.45, 1.45)
        grp.position.set(
          barrel.x,
          Math.abs(Math.sin(clockSec * 5.5 + barrel.id * 0.9)) * 0.2,
          barrel.z,
        )
        const bodyMesh = grp.children[0] as THREE.Mesh | undefined
        const bodyMat = bodyMesh?.material as THREE.MeshStandardMaterial | undefined
        if (bodyMat) {
          bodyMat.color.set(barrel.explosionFlashMs > 0 ? '#facc15' : '#991b1b')
        }
        const plaqueMesh = grp.children[2] as THREE.Mesh | undefined
        const plaqueMat = plaqueMesh?.material as THREE.MeshBasicMaterial | undefined
        if (plaqueMat) {
          const nextTex = getPlaqueTexture(
            `💀 ${formatArmy(Math.max(1, barrel.hp), notationMode)} HP`,
            barrel.explosionFlashMs > 0 ? '#ca8a04' : '#7f1d1d',
            '#facc15',
            '#ffffff',
            'MINI-BOSS',
          )
          if (plaqueMat.map !== nextTex) {
            plaqueMat.map = nextTex
            plaqueMat.needsUpdate = true
          }
        }
      }
    }

    // 2. Sincronizar Horda Inimiga 3D + Mini-Bosses (176 HP) na Rota Central e atualizar placa de HP
    if (enemyHordeGroupRef.current) {
      const children = enemyHordeGroupRef.current.children
      for (let i = 0; i < sim.enemies.length; i++) {
        const en = sim.enemies[i]
        const grp = children[i] as THREE.Group | undefined
        if (grp && en) {
          grp.position.set(
            en.x,
            Math.abs(Math.sin(clockSec * 6 + en.id * 0.7)) * 0.22,
            en.z,
          )
          const bodyMesh = grp.children[0] as THREE.Mesh | undefined
          const bodyMat = bodyMesh?.material as THREE.MeshStandardMaterial | undefined
          if (bodyMat) {
            bodyMat.color.set(
              en.hitFlashMs > 0
                ? '#facc15'
                : en.isMiniBoss
                  ? '#7f1d1d'
                  : '#dc2626',
            )
          }
          if (en.isMiniBoss) {
            const plaqueMesh = grp.children[3] as THREE.Mesh | undefined
            const plaqueMat = plaqueMesh?.material as THREE.MeshBasicMaterial | undefined
            if (plaqueMat) {
              const nextTex = getPlaqueTexture(
                `💀 ${formatArmy(Math.max(1, en.hp), notationMode)} HP`,
                en.hitFlashMs > 0 ? '#ca8a04' : '#7f1d1d',
                en.hitFlashMs > 0 ? '#fef08a' : '#f87171',
                '#ffffff',
                'MINI-BOSS',
              )
              if (plaqueMat.map !== nextTex) {
                plaqueMat.map = nextTex
                plaqueMat.needsUpdate = true
              }
            }
          }
        }
      }
    }

    // 3. Sincronizar Mega-Boss Articulado do Setor (visibilidade no INTERMISSION, marcha +Z, 5 arquétipos e golpe corpo a corpo)
    const isIntermission = sim.bossLifecycle === 'INTERMISSION'
    const archSpec =
      BOSS_ARCHETYPES_3D[sim.bossArchetypeIndex] ?? BOSS_ARCHETYPES_3D[0]

    if (bossGroupRef.current) {
      bossGroupRef.current.visible = !isIntermission && sim.bossHp > 0
      if (isIntermission) {
        bossGroupRef.current.position.z = -72
      } else {
        if (Math.abs(bossGroupRef.current.position.z - sim.bossZ) > 12) {
          bossGroupRef.current.position.z = sim.bossZ
        } else {
          bossGroupRef.current.position.z = THREE.MathUtils.lerp(
            bossGroupRef.current.position.z,
            sim.bossZ,
            1 - Math.exp(-9 * dt),
          )
        }
        const strideBob =
          sim.bossLifecycle === 'MARCHING'
            ? Math.abs(Math.sin(clockSec * 4.2)) * 0.35
            : Math.abs(Math.sin(clockSec * 8.0)) * 0.18
        bossGroupRef.current.position.y = strideBob
        bossGroupRef.current.position.x = Math.sin(clockSec * 1.1) * 1.35
        bossGroupRef.current.rotation.y = Math.sin(clockSec * 2.4) * 0.12
      }
    }

    // Atualizar materiais e geometrias extras dos 5 Arquétipos 3D de Boss
    if (!isIntermission) {
      if (bossTorsoMatRef.current) {
        bossTorsoMatRef.current.color.set(archSpec.primaryColor)
        bossTorsoMatRef.current.emissive.set(archSpec.accentColor)
        bossTorsoMatRef.current.emissiveIntensity =
          sim.bossHitFlashMs > 0 ? 0.28 : 0.06
      }
      if (bossLeftPauldronMatRef.current) {
        bossLeftPauldronMatRef.current.color.set(archSpec.secondaryColor)
      }
      if (bossRightPauldronMatRef.current) {
        bossRightPauldronMatRef.current.color.set(archSpec.secondaryColor)
      }
      if (bossHeadMatRef.current) {
        bossHeadMatRef.current.color.set(archSpec.primaryColor)
      }
      if (bossLeftHornMatRef.current) {
        bossLeftHornMatRef.current.color.set(archSpec.accentColor)
      }
      if (bossRightHornMatRef.current) {
        bossRightHornMatRef.current.color.set(archSpec.accentColor)
      }
      if (bossArchExtrasGroupRef.current) {
        const extraGroups = bossArchExtrasGroupRef.current.children
        for (let aIdx = 0; aIdx < extraGroups.length; aIdx++) {
          const g = extraGroups[aIdx]
          if (g) {
            g.visible = aIdx === archSpec.index
          }
        }
      }
    }

    if (bossHammerPivotRef.current) {
      const swingSpeed = sim.bossLifecycle === 'MELEE_CLASH' ? 9.5 : 3.1
      const swingAmp = sim.bossLifecycle === 'MELEE_CLASH' ? 0.92 : 0.38
      bossHammerPivotRef.current.rotation.x =
        0.45 + Math.sin(clockSec * swingSpeed) * swingAmp
      const wepGroups = bossHammerPivotRef.current.children
      for (let wIdx = 0; wIdx < wepGroups.length; wIdx++) {
        const wg = wepGroups[wIdx]
        if (wg) {
          wg.visible = wIdx === archSpec.index
        }
      }
    }

    if (bossPlaqueMatRef.current && !isIntermission) {
      const statusPrefix = sim.bossLifecycle === 'MELEE_CLASH' ? '⚔️' : '👹'
      const nextBossTex = getPlaqueTexture(
        `${statusPrefix} ${formatArmy(sim.bossHp, notationMode)}`,
        archSpec.plaqueBgColor,
        archSpec.accentColor,
        '#ffffff',
        `S${sim.sectorIndex} · ${archSpec.namePt.slice(0, 14).toUpperCase()}`,
      )
      if (bossPlaqueMatRef.current.map !== nextBossTex) {
        bossPlaqueMatRef.current.map = nextBossTex
        bossPlaqueMatRef.current.needsUpdate = true
      }
    }

    // 4. Sincronizar Caravana / Baú de Suprimentos Dourado durante os 7.5s de INTERMISSION pós-Boss
    if (supplyCaravanGroupRef.current) {
      const showCaravan = isIntermission && sim.supplyCaravan.active
      supplyCaravanGroupRef.current.visible = showCaravan
      if (showCaravan) {
        supplyCaravanGroupRef.current.position.set(
          sim.supplyCaravan.x,
          Math.abs(Math.sin(clockSec * 5.0)) * 0.16,
          sim.supplyCaravan.z,
        )
        if (supplyCaravanCrystalRef.current) {
          supplyCaravanCrystalRef.current.rotation.y = clockSec * 2.8
        }
        if (supplyCaravanPlaqueMatRef.current) {
          const remIntermissionSec = Math.max(
            1,
            Math.ceil(sim.bossRespawnTimerMs / 1000),
          )
          const caravanTex = getPlaqueTexture(
            `🎁 S${sim.sectorIndex} BÔNUS`,
            sim.supplyCaravan.hitFlashMs > 0 ? '#ca8a04' : '#047857',
            '#fde047',
            '#ffffff',
            `⏳ BOSS EM ${remIntermissionSec}s`,
          )
          if (supplyCaravanPlaqueMatRef.current.map !== caravanTex) {
            supplyCaravanPlaqueMatRef.current.map = caravanTex
            supplyCaravanPlaqueMatRef.current.needsUpdate = true
          }
        }
      }
    }
  })

  return (
    <group name="EnemyHordeAndBoss3D">
      {/* 1. Mini-Bosses Demolidores do Setor (112+ HP) marchando continuamente na Rota Central */}
      <group ref={barrelsGroupRef} name="ExplosiveBarrels3D">
        {simRef.current.barrels.map((barrel) => (
          <group
            key={`barrel_3d_${barrel.id}`}
            position={[barrel.x, 0, barrel.z]}
            scale={[1.45, 1.45, 1.45]}
          >
            <mesh position={[0, 0.78, 0]} castShadow>
              <capsuleGeometry args={[0.44, 0.68, 6, 10]} />
              <meshStandardMaterial color="#991b1b" roughness={0.45} metalness={0.35} />
            </mesh>
            <mesh position={[0, 1.56, 0]} castShadow>
              <sphereGeometry args={[0.38, 10, 10]} />
              <meshStandardMaterial color="#facc15" metalness={0.75} />
            </mesh>
            <mesh position={[0, 2.38, 0]}>
              <planeGeometry args={[2.2, 1.1]} />
              <meshBasicMaterial map={barrel112Tex} transparent />
            </mesh>
          </group>
        ))}
      </group>

      {/* 2. Horda Inimiga 3D + Mini-Bosses (176 HP) marchando na Rota Central */}
      <group ref={enemyHordeGroupRef} name="EnemyHordeAndMiniBosses3D">
        {simRef.current.enemies.map((en) => (
          <group
            key={`enemy_3d_${en.id}`}
            position={[en.x, 0, en.z]}
            scale={en.isMiniBoss ? [1.75, 1.75, 1.75] : [1, 1, 1]}
          >
            {/* Corpo 3D do guerreiro/monstro rubro */}
            <mesh position={[0, 0.75, 0]} castShadow>
              <capsuleGeometry args={[0.38, 0.65, 6, 10]} />
              <meshStandardMaterial
                color={en.isMiniBoss ? '#7f1d1d' : '#dc2626'}
                roughness={0.45}
                metalness={en.isMiniBoss ? 0.35 : 0.1}
              />
            </mesh>
            {/* Cabeça / Elmo 3D */}
            <mesh position={[0, 1.52, 0]} castShadow>
              <sphereGeometry args={[0.34, 10, 10]} />
              <meshStandardMaterial
                color={en.isMiniBoss ? '#facc15' : '#450a0a'}
                metalness={0.5}
              />
            </mesh>
            {/* Escudo / Arma frontal */}
            <mesh position={[0.36, 0.85, 0.25]} castShadow>
              <boxGeometry args={[0.22, 0.75, 0.55]} />
              <meshStandardMaterial color="#991b1b" />
            </mesh>
            {/* Placa 3D de HP nos Mini-Bosses */}
            {en.isMiniBoss && (
              <mesh position={[0, 2.45, 0]}>
                <planeGeometry args={[2.1, 1.05]} />
                <meshBasicMaterial map={miniBossTex} transparent />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* 3. Mega-Boss 3D Articulado do Setor na Rota Central (5 Arquétipos Distintos) */}
      <group ref={bossGroupRef} position={[0, 0, -68]} name="SectorGiantBoss3D">
        {/* Torso Colossal 3D */}
        <mesh position={[0, 2.9, 0]} castShadow>
          <boxGeometry args={[3.6, 3.8, 2.4]} />
          <meshStandardMaterial
            ref={bossTorsoMatRef}
            color="#7f1d1d"
            roughness={0.4}
            metalness={0.25}
          />
        </mesh>
        {/* Ombreiras Blindadas */}
        <mesh position={[-2.3, 4.1, 0]} castShadow>
          <sphereGeometry args={[1.05, 10, 10]} />
          <meshStandardMaterial
            ref={bossLeftPauldronMatRef}
            color="#ca8a04"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[2.3, 4.1, 0]} castShadow>
          <sphereGeometry args={[1.05, 10, 10]} />
          <meshStandardMaterial
            ref={bossRightPauldronMatRef}
            color="#ca8a04"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
        {/* Cabeça + Coroa + Chifres do Boss */}
        <mesh position={[0, 5.4, 0]} castShadow>
          <sphereGeometry args={[1.15, 12, 12]} />
          <meshStandardMaterial
            ref={bossHeadMatRef}
            color="#991b1b"
            roughness={0.35}
          />
        </mesh>
        <mesh position={[-0.85, 6.45, 0]} rotation={[0, 0, 0.35]}>
          <coneGeometry args={[0.32, 1.4, 8]} />
          <meshStandardMaterial
            ref={bossLeftHornMatRef}
            color="#fef08a"
            metalness={0.6}
          />
        </mesh>
        <mesh position={[0.85, 6.45, 0]} rotation={[0, 0, -0.35]}>
          <coneGeometry args={[0.32, 1.4, 8]} />
          <meshStandardMaterial
            ref={bossRightHornMatRef}
            color="#fef08a"
            metalness={0.6}
          />
        </mesh>

        {/* Geometrias Exclusivas dos 5 Arquétipos 3D de Boss */}
        <group ref={bossArchExtrasGroupRef} name="BossArchetypeExtras3D">
          {/* Arquétipo 0: Colosso Rubro (Escudo Peitoral Imperial) */}
          <group name="Arch0_ColossoRubro">
            <mesh position={[0, 3.0, 1.28]}>
              <boxGeometry args={[2.2, 2.2, 0.25]} />
              <meshStandardMaterial color="#facc15" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>

          {/* Arquétipo 1: Titã Crio-Gélido (Espinhos de Cristal de Gelo nas Costas e Ombros) */}
          <group name="Arch1_TitaCrioGelido" visible={false}>
            <mesh position={[-1.6, 5.2, -0.4]} rotation={[-0.3, 0, 0.4]}>
              <coneGeometry args={[0.55, 2.6, 6]} />
              <meshStandardMaterial color="#67e8f9" emissive="#0891b2" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[1.6, 5.2, -0.4]} rotation={[-0.3, 0, -0.4]}>
              <coneGeometry args={[0.55, 2.6, 6]} />
              <meshStandardMaterial color="#67e8f9" emissive="#0891b2" emissiveIntensity={0.6} />
            </mesh>
          </group>

          {/* Arquétipo 2: Senhor de Magma (Núcleo de Lava Incandescente + Anel Vulcânico) */}
          <group name="Arch2_SenhorMagma" visible={false}>
            <mesh position={[0, 3.1, 1.26]}>
              <sphereGeometry args={[0.95, 12, 12]} />
              <meshStandardMaterial color="#fb923c" emissive="#ea580c" emissiveIntensity={0.95} />
            </mesh>
          </group>

          {/* Arquétipo 3: Aracno-Mecha Imperial (4 Pernas Mecânicas Articuladas + Canhões de Ombro) */}
          <group name="Arch3_AracnoMecha" visible={false}>
            {[-2.8, 2.8].map((lx, idx) => (
              <mesh
                key={`spider_leg_${idx}`}
                position={[lx, 1.6, 0.4]}
                rotation={[0, 0, lx < 0 ? 0.55 : -0.55]}
              >
                <cylinderGeometry args={[0.24, 0.18, 3.8, 8]} />
                <meshStandardMaterial color="#10b981" metalness={0.85} roughness={0.2} />
              </mesh>
            ))}
            <mesh position={[-1.9, 5.1, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 2.4, 10]} />
              <meshStandardMaterial color="#34d399" metalness={0.8} />
            </mesh>
            <mesh position={[1.9, 5.1, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 2.4, 10]} />
              <meshStandardMaterial color="#34d399" metalness={0.8} />
            </mesh>
          </group>

          {/* Arquétipo 4: Imperador Quiliarca Dourado (Asas Solares Luminosas + Halo Imperial) */}
          <group name="Arch4_ImperadorQuiliarca" visible={false}>
            <mesh position={[-3.2, 4.2, -0.6]} rotation={[0, 0.25, 0.35]}>
              <boxGeometry args={[2.8, 3.6, 0.18]} />
              <meshStandardMaterial color="#fde047" emissive="#eab308" emissiveIntensity={0.8} />
            </mesh>
            <mesh position={[3.2, 4.2, -0.6]} rotation={[0, -0.25, -0.35]}>
              <boxGeometry args={[2.8, 3.6, 0.18]} />
              <meshStandardMaterial color="#fde047" emissive="#eab308" emissiveIntensity={0.8} />
            </mesh>
          </group>
        </group>

        {/* Arma de Guerra 3D Articulada do Boss (5 Armas Exclusivas por Arquétipo) */}
        <group
          ref={bossHammerPivotRef}
          position={[2.8, 3.2, 1.1]}
          rotation={[0.4, 0, -0.25]}
        >
          {/* 0: WARHAMMER (Martelo de Guerra Imperial) */}
          <group name="Wep0_Warhammer">
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.18, 0.22, 4.2, 8]} />
              <meshStandardMaterial color="#451a03" />
            </mesh>
            <mesh position={[0, 2.1, 0]}>
              <boxGeometry args={[1.9, 1.15, 1.15]} />
              <meshStandardMaterial color="#ca8a04" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>

          {/* 1: ICE_TRIDENT (Tridente Crio-Gélido de 3 Pontas) */}
          <group name="Wep1_IceTrident" visible={false}>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.15, 0.18, 4.6, 8]} />
              <meshStandardMaterial color="#0891b2" metalness={0.6} />
            </mesh>
            {[-0.55, 0, 0.55].map((px, pIdx) => (
              <mesh key={`trident_prong_${pIdx}`} position={[px, 2.8, 0]}>
                <coneGeometry args={[0.22, 1.45, 6]} />
                <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.7} />
              </mesh>
            ))}
          </group>

          {/* 2: MAGMA_DUAL_CLUB (Clava Vulcânica de Magma) */}
          <group name="Wep2_MagmaClub" visible={false}>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.2, 0.26, 4.0, 8]} />
              <meshStandardMaterial color="#1c1917" />
            </mesh>
            <mesh position={[0, 2.25, 0]}>
              <dodecahedronGeometry args={[1.15, 0]} />
              <meshStandardMaterial color="#ea580c" emissive="#f97316" emissiveIntensity={0.85} />
            </mesh>
          </group>

          {/* 3: SPIDER_CANNONS (Lâmina & Canhão de Plasma Esmeralda) */}
          <group name="Wep3_SpiderCannon" visible={false}>
            <mesh position={[0, 0.8, 0]}>
              <cylinderGeometry args={[0.38, 0.45, 3.6, 10]} />
              <meshStandardMaterial color="#0f172a" metalness={0.85} />
            </mesh>
            <mesh position={[0, 2.6, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 1.2, 10]} />
              <meshStandardMaterial color="#6ee7b7" emissive="#10b981" emissiveIntensity={0.9} />
            </mesh>
          </group>

          {/* 4: SOLAR_LONGSWORD (Espada Bastarda Solar Dourada) */}
          <group name="Wep4_SolarLongsword" visible={false}>
            <mesh position={[0, 0.8, 0]}>
              <boxGeometry args={[1.6, 0.28, 0.42]} />
              <meshStandardMaterial color="#7e22ce" metalness={0.8} />
            </mesh>
            <mesh position={[0, 2.9, 0]}>
              <boxGeometry args={[0.48, 4.0, 0.16]} />
              <meshStandardMaterial color="#fef08a" emissive="#eab308" emissiveIntensity={0.95} />
            </mesh>
          </group>
        </group>
        {/* Placa 3D Gigante de Força / HP do Mega-Boss */}
        <mesh position={[0, 8.1, 0]}>
          <planeGeometry args={[6.2, 3.1]} />
          <meshBasicMaterial
            ref={bossPlaqueMatRef}
            map={bossPlaqueTex}
            transparent
          />
        </mesh>
      </group>

      {/* 4. Caravana / Baú de Suprimentos Dourado 3D durante os 7.5s de INTERMISSION (quando o Boss morre e desaparece) */}
      <group
        ref={supplyCaravanGroupRef}
        position={[0, 0, -32]}
        visible={false}
        name="SectorSupplyCaravan3D"
      >
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[3.2, 1.8, 2.2]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.75} roughness={0.22} />
        </mesh>
        <mesh position={[0, 1.9, 0]} castShadow>
          <cylinderGeometry args={[1.1, 1.6, 0.8, 8]} />
          <meshStandardMaterial color="#fde047" metalness={0.85} roughness={0.18} />
        </mesh>
        <mesh ref={supplyCaravanCrystalRef} position={[0, 2.85, 0]}>
          <octahedronGeometry args={[0.68, 0]} />
          <meshStandardMaterial
            color="#34d399"
            emissive="#10b981"
            emissiveIntensity={0.85}
          />
        </mesh>
        <mesh position={[0, 4.4, 0]}>
          <planeGeometry args={[4.8, 2.4]} />
          <meshBasicMaterial
            ref={supplyCaravanPlaqueMatRef}
            map={supplyCaravanDefaultTex}
            transparent
          />
        </mesh>
      </group>
    </group>
  )
}
