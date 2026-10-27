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

  const barrel112Tex = useMemo(
    () => getPlaqueTexture('🛢️ 112 HP', '#b45309', '#facc15', '#ffffff', 'EXPLOSIVO'),
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

  useFrame((state, delta) => {
    const dt = Math.min(0.05, Math.max(0.004, delta))
    const clockSec = state.clock.elapsedTime
    const sim = simRef.current

    // 1. Sincronizar Barris Explosivos (112 HP) na Rota Central e atualizar placa de HP em tempo real
    if (barrelsGroupRef.current) {
      const children = barrelsGroupRef.current.children
      for (let i = 0; i < sim.barrels.length; i++) {
        const barrel = sim.barrels[i]
        const grp = children[i] as THREE.Group | undefined
        if (!grp || !barrel) continue
        grp.visible = barrel.active || barrel.explosionFlashMs > 0
        if (barrel.explosionFlashMs > 0 && !barrel.active) {
          const s = 1 + (450 - barrel.explosionFlashMs) * 0.006
          grp.scale.set(s, s, s)
        } else {
          grp.scale.set(1, 1, 1)
          const plaqueMesh = grp.children[2] as THREE.Mesh | undefined
          const plaqueMat = plaqueMesh?.material as THREE.MeshBasicMaterial | undefined
          if (plaqueMat) {
            const nextTex = getPlaqueTexture(
              `🛢️ ${Math.max(0, barrel.hp)} HP`,
              barrel.explosionFlashMs > 0 ? '#dc2626' : '#b45309',
              '#facc15',
              '#ffffff',
              'EXPLOSIVO',
            )
            if (plaqueMat.map !== nextTex) {
              plaqueMat.map = nextTex
              plaqueMat.needsUpdate = true
            }
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
                `💀 ${Math.max(1, en.hp)} HP`,
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

    // 3. Sincronizar Mega-Boss Articulado do Setor (posição, martelo de guerra e placa de HP)
    if (bossGroupRef.current) {
      bossGroupRef.current.position.z = THREE.MathUtils.lerp(
        bossGroupRef.current.position.z,
        sim.bossZ + Math.sin(clockSec * 2.2) * 1.1,
        1 - Math.exp(-6 * dt),
      )
      bossGroupRef.current.position.x = Math.sin(clockSec * 1.1) * 1.6
      bossGroupRef.current.rotation.y = Math.sin(clockSec * 2.4) * 0.12
    }

    if (bossHammerPivotRef.current) {
      bossHammerPivotRef.current.rotation.x = 0.4 + Math.sin(clockSec * 3.1) * 0.38
    }

    if (bossPlaqueMatRef.current) {
      const nextBossTex = getPlaqueTexture(
        `👹 ${formatArmy(sim.bossHp, notationMode)}`,
        sim.bossHitFlashMs > 0 ? '#ca8a04' : '#991b1b',
        '#facc15',
        '#ffffff',
        `SETOR ${sim.sectorIndex} · ${bossName.slice(0, 10).toUpperCase()}`,
      )
      if (bossPlaqueMatRef.current.map !== nextBossTex) {
        bossPlaqueMatRef.current.map = nextBossTex
        bossPlaqueMatRef.current.needsUpdate = true
      }
    }
  })

  return (
    <group name="EnemyHordeAndBoss3D">
      {/* 1. Barris Explosivos 3D (112 HP) na Rota Central */}
      <group ref={barrelsGroupRef} name="ExplosiveBarrels3D">
        {simRef.current.barrels.map((barrel) => (
          <group key={`barrel_3d_${barrel.id}`} position={[barrel.x, 0, barrel.z]}>
            <mesh position={[0, 0.78, 0]} castShadow>
              <cylinderGeometry args={[0.68, 0.72, 1.55, 12]} />
              <meshStandardMaterial color="#b45309" roughness={0.55} metalness={0.25} />
            </mesh>
            <mesh position={[0, 1.15, 0]}>
              <cylinderGeometry args={[0.71, 0.71, 0.16, 12]} />
              <meshStandardMaterial color="#facc15" metalness={0.75} />
            </mesh>
            <mesh position={[0, 2.15, 0]}>
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

      {/* 3. Mega-Boss 3D Articulado do Setor na Rota Central */}
      <group ref={bossGroupRef} position={[0, 0, -56]} name="SectorGiantBoss3D">
        {/* Torso Colossal 3D */}
        <mesh position={[0, 2.9, 0]} castShadow>
          <boxGeometry args={[3.6, 3.8, 2.4]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.4} metalness={0.25} />
        </mesh>
        {/* Ombreiras Blindadas Douradas */}
        <mesh position={[-2.3, 4.1, 0]} castShadow>
          <sphereGeometry args={[1.05, 10, 10]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[2.3, 4.1, 0]} castShadow>
          <sphereGeometry args={[1.05, 10, 10]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.7} roughness={0.25} />
        </mesh>
        {/* Cabeça + Coroa + Chifres do Boss */}
        <mesh position={[0, 5.4, 0]} castShadow>
          <sphereGeometry args={[1.15, 12, 12]} />
          <meshStandardMaterial color="#991b1b" roughness={0.35} />
        </mesh>
        <mesh position={[-0.85, 6.45, 0]} rotation={[0, 0, 0.35]}>
          <coneGeometry args={[0.32, 1.4, 8]} />
          <meshStandardMaterial color="#fef08a" metalness={0.6} />
        </mesh>
        <mesh position={[0.85, 6.45, 0]} rotation={[0, 0, -0.35]}>
          <coneGeometry args={[0.32, 1.4, 8]} />
          <meshStandardMaterial color="#fef08a" metalness={0.6} />
        </mesh>
        {/* Martelo de Guerra 3D Articulado */}
        <group
          ref={bossHammerPivotRef}
          position={[2.8, 3.2, 1.1]}
          rotation={[0.4, 0, -0.25]}
        >
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.22, 4.2, 8]} />
            <meshStandardMaterial color="#451a03" />
          </mesh>
          <mesh position={[0, 2.1, 0]}>
            <boxGeometry args={[1.8, 1.1, 1.1]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
          </mesh>
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
    </group>
  )
}
