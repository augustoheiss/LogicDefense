// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/SideCorridors3D.tsx
// Fase 3 V7: Renderizador 3D dedicado das 2 Rotas Laterais:
//   • Rota Esquerda (X = BRIDGE_3D_ROUTES.LEFT.xCenter = -8.65):
//     Canhão Congelado (5 HP) + Esteira Contínua de Portões (+1, +2, +3)
//   • Rota Direita  (X = BRIDGE_3D_ROUTES.RIGHT.xCenter = +8.65):
//     Arma Pesada Multi-Cano (888 HP) + Altar 🧮 Clicável + Portões (+10, +50, +99)
// 100% WebGL via THREE.CanvasTexture (zero nós DOM <Html> por frame).
// ──────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { formatArmy } from '../../domain/notation'
import { BRIDGE_3D_ROUTES } from './bridge3dPolicies'
import { Bridge3DSimState } from './bridge3dSim'
import { getPlaqueTexture } from './plaqueTextureCache'

export interface SideCorridors3DProps {
  readonly simRef: React.MutableRefObject<Bridge3DSimState>
  readonly onOpenMathBonus: () => void
}

export const SideCorridors3D: React.FC<SideCorridors3DProps> = ({
  simRef,
  onOpenMathBonus,
}) => {
  const leftCorridorFlowRef = useRef<THREE.Group | null>(null)
  const rightCorridorFlowRef = useRef<THREE.Group | null>(null)
  const leftCannonGroupRef = useRef<THREE.Group | null>(null)
  const rightWeaponGroupRef = useRef<THREE.Group | null>(null)
  const rightAltarGroupRef = useRef<THREE.Group | null>(null)
  const leftIceShellRef = useRef<THREE.Mesh | null>(null)
  const rightIceShellRef = useRef<THREE.Mesh | null>(null)
  const leftBlockPlaqueMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const rightWeaponPlaqueMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const mathCrystalRef = useRef<THREE.Mesh | null>(null)

  const leftBlockTex = useMemo(
    () => getPlaqueTexture('❄️ 5 HP', '#0284c7', '#7dd3fc', '#ffffff', 'CANHÃO +1'),
    [],
  )
  const rightWeaponTex = useMemo(
    () => getPlaqueTexture('🔥 888', '#b91c1c', '#facc15', '#fef08a', '🧮 FAZER CONTA'),
    [],
  )
  const mathAltarTex = useMemo(
    () => getPlaqueTexture('🧮 BÔNUS', '#6d28d9', '#facc15', '#fef08a', 'FAZER CONTA'),
    [],
  )
  const leftGatePlus1Tex = useMemo(
    () => getPlaqueTexture('+1', '#0369a1', '#38bdf8', '#e0f2fe', 'SOLDADO'),
    [],
  )
  const leftGatePlus2Tex = useMemo(
    () => getPlaqueTexture('+2', '#0284c7', '#7dd3fc', '#ffffff', 'SOLDADOS'),
    [],
  )
  const leftGatePlus3Tex = useMemo(
    () => getPlaqueTexture('+3', '#0d9488', '#5eead4', '#ffffff', 'REFORÇO'),
    [],
  )
  const rightGatePlus10Tex = useMemo(
    () => getPlaqueTexture('+10', '#047857', '#34d399', '#ecfdf5', '🧮 FAZER CONTA'),
    [],
  )
  const rightGatePlus50Tex = useMemo(
    () => getPlaqueTexture('+50', '#0d9488', '#5eead4', '#ffffff', '🧮 FAZER CONTA'),
    [],
  )
  const rightGatePlus99Tex = useMemo(
    () => getPlaqueTexture('+99', '#ca8a04', '#fde047', '#ffffff', '🧮 FAZER CONTA'),
    [],
  )

  useFrame((state) => {
    const sim = simRef.current
    const clockSec = state.clock.elapsedTime

    // 1. Sincronizar posição Z contínua do Canhão da Esquerda, Metralhadora da Direita e Altar 🧮
    if (leftCannonGroupRef.current) {
      leftCannonGroupRef.current.position.z = sim.leftFrozenBlock.z
      leftCannonGroupRef.current.visible = !sim.leftFrozenBlock.collectedInPass
    }
    if (rightWeaponGroupRef.current) {
      rightWeaponGroupRef.current.position.z = sim.rightFrozenWeapon.z
      rightWeaponGroupRef.current.visible = !sim.rightFrozenWeapon.collectedInPass
    }
    if (rightAltarGroupRef.current) {
      rightAltarGroupRef.current.position.z = sim.rightAltarZ
      rightAltarGroupRef.current.visible = !sim.rightAltarCollectedInPass
    }

    // 2. Sincronizar posição Z física, visibilidade e texturas evoluídas das esteiras Esquerda e Direita
    if (leftCorridorFlowRef.current) {
      const children = leftCorridorFlowRef.current.children
      for (let i = 0; i < sim.leftGates.length; i++) {
        const grp = children[i] as THREE.Group | undefined
        const gate = sim.leftGates[i]
        if (grp && gate) {
          grp.position.z = gate.z
          grp.visible = !gate.collectedInPass
          const plaqueMesh = grp.children[3] as THREE.Mesh | undefined
          const mat = plaqueMesh?.material as THREE.MeshBasicMaterial | undefined
          if (mat) {
            const bg = i % 3 === 2 ? '#0d9488' : i % 2 === 1 ? '#0284c7' : '#0369a1'
            const brd = i % 3 === 2 ? '#5eead4' : '#7dd3fc'
            const sub = gate.bonusSoldiers > 1 ? 'SOLDADOS' : 'SOLDADO'
            const nextTex = getPlaqueTexture(gate.label, bg, brd, '#ffffff', sub)
            if (mat.map !== nextTex) {
              mat.map = nextTex
              mat.needsUpdate = true
            }
          }
        }
      }
    }

    if (rightCorridorFlowRef.current) {
      const children = rightCorridorFlowRef.current.children
      const hasMathCharge = sim.rightMathBonusCharges > 0
      const rightSubLabel = hasMathCharge ? '⚡ CONTA OK!' : '🧮 FAZER CONTA'
      for (let i = 0; i < sim.rightGates.length; i++) {
        const grp = children[i] as THREE.Group | undefined
        const gate = sim.rightGates[i]
        if (grp && gate) {
          grp.position.z = gate.z
          grp.visible = !gate.collectedInPass
          const plaqueMesh = grp.children[3] as THREE.Mesh | undefined
          const mat = plaqueMesh?.material as THREE.MeshBasicMaterial | undefined
          if (mat) {
            const bg = hasMathCharge
              ? '#15803d'
              : i >= 2
                ? '#ca8a04'
                : i === 1
                  ? '#0d9488'
                  : '#047857'
            const brd = hasMathCharge ? '#86efac' : '#fde047'
            const nextTex = getPlaqueTexture(
              gate.label,
              bg,
              brd,
              '#ffffff',
              rightSubLabel,
            )
            if (mat.map !== nextTex) {
              mat.map = nextTex
              mat.needsUpdate = true
            }
          }
        }
      }
    }

    // 3. Casulo de gelo da Rota Esquerda (desaparece ao desbloquear e pulsa ao receber tiro)
    if (leftIceShellRef.current) {
      leftIceShellRef.current.visible = !sim.leftFrozenBlock.unlocked
      const sLeft = sim.leftFrozenBlock.hitFlashMs > 0 ? 1.08 : 1.0
      leftIceShellRef.current.scale.set(sLeft, sLeft, sLeft)
    }

    // 4. Casulo de gelo da Rota Direita (desaparece ao desbloquear e pulsa ao receber tiro)
    if (rightIceShellRef.current) {
      rightIceShellRef.current.visible = !sim.rightFrozenWeapon.unlocked
      const sRight = sim.rightFrozenWeapon.hitFlashMs > 0 ? 1.06 : 1.0
      rightIceShellRef.current.scale.set(sRight, sRight, sRight)
    }

    // 5. Girar cristal do Altar Matemático 🧮
    if (mathCrystalRef.current) {
      mathCrystalRef.current.rotation.y = clockSec * 1.8
      mathCrystalRef.current.position.y = 1.75 + Math.sin(clockSec * 3.2) * 0.12
    }

    // 6. Atualizar texturas cacheadas de HP dos blocos congelados Esquerdo e Direito
    if (leftBlockPlaqueMatRef.current) {
      const cannonLvl = sim.leftFrozenBlock.level ?? sim.leftCannonLevel + 1
      const lbl = sim.leftFrozenBlock.unlocked
        ? '✅ PEGAR!'
        : `❄️ ${formatArmy(sim.leftFrozenBlock.hp, 'compact')} HP`
      const nextTex = getPlaqueTexture(
        lbl,
        sim.leftFrozenBlock.unlocked ? '#047857' : '#0284c7',
        '#7dd3fc',
        '#ffffff',
        `CANHÃO NV.${cannonLvl}`,
      )
      if (leftBlockPlaqueMatRef.current.map !== nextTex) {
        leftBlockPlaqueMatRef.current.map = nextTex
        leftBlockPlaqueMatRef.current.needsUpdate = true
      }
    }

    if (rightWeaponPlaqueMatRef.current) {
      const wepLvl = sim.rightFrozenWeapon.level ?? sim.rightWeaponLevel + 1
      const lbl = sim.rightFrozenWeapon.unlocked
        ? `✅ NV.${wepLvl}`
        : `🔥 ${formatArmy(sim.rightFrozenWeapon.hp, 'compact')}`
      const sub =
        sim.rightFrozenWeapon.unlocked || sim.rightMathBonusCharges > 0
          ? `METRALHADORA NV.${wepLvl}`
          : '🧮 FAZER CONTA'
      const nextTex = getPlaqueTexture(
        lbl,
        sim.rightFrozenWeapon.unlocked ? '#047857' : '#b91c1c',
        '#facc15',
        '#fef08a',
        sub,
      )
      if (rightWeaponPlaqueMatRef.current.map !== nextTex) {
        rightWeaponPlaqueMatRef.current.map = nextTex
        rightWeaponPlaqueMatRef.current.needsUpdate = true
      }
    }
  })

  const leftGateTextures = [
    leftGatePlus1Tex,
    leftGatePlus2Tex,
    leftGatePlus1Tex,
    leftGatePlus2Tex,
    leftGatePlus3Tex,
  ]

  const rightGateTextures = [
    rightGatePlus10Tex,
    rightGatePlus50Tex,
    rightGatePlus99Tex,
    rightGatePlus99Tex,
  ]

  return (
    <group name="SideCorridors3D">
      {/* ── ROTA ESQUERDA 3D (X = -8.65): BLOCO CONGELADO (5 HP) + ESTEIRA (+1/+2/+3) ── */}
      <group
        name="LeftRouteContent3D"
        position={[BRIDGE_3D_ROUTES.LEFT.xCenter, 0, 0]}
      >
        <group ref={leftCannonGroupRef} position={[0, 0, -8.0]}>
          {/* Pedestal Hexagonal */}
          <mesh position={[0, 0.35, 0]} receiveShadow>
            <cylinderGeometry args={[1.65, 1.85, 0.7, 8]} />
            <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.3} />
          </mesh>

          {/* Casulo de Gelo Translúcido (5 HP) */}
          <mesh ref={leftIceShellRef} position={[0, 1.15, 0]} castShadow>
            <boxGeometry args={[3.4, 2.1, 2.2]} />
            <meshPhysicalMaterial
              color="#38bdf8"
              transparent
              opacity={0.74}
              roughness={0.15}
              metalness={0.1}
            />
          </mesh>

          {/* Canhão Auxiliar Duplo interno apontando para -Z */}
          <mesh position={[-0.32, 1.1, -0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.38, 2.2, 12]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.65} roughness={0.28} />
          </mesh>
          <mesh position={[0.32, 1.1, -0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.38, 2.2, 12]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.65} roughness={0.28} />
          </mesh>

          {/* Placa 3D: ❄️ 5 HP -> ✅ ATIVO */}
          <mesh position={[0, 2.95, 0]}>
            <planeGeometry args={[3.4, 1.7]} />
            <meshBasicMaterial
              ref={leftBlockPlaqueMatRef}
              map={leftBlockTex}
              transparent
            />
          </mesh>
        </group>

        {/* Esteira Contínua de Portões Azuis (+1, +2, +1, +2, +3) na Rota Esquerda */}
        <group ref={leftCorridorFlowRef}>
          {simRef.current.leftGates.map((gate, idx) => {
            const tex = leftGateTextures[idx % leftGateTextures.length] ?? leftGatePlus1Tex
            return (
              <group key={gate.id} position={[0, 0, gate.z]}>
                <mesh position={[-2.3, 1.6, 0]} castShadow>
                  <cylinderGeometry args={[0.18, 0.22, 3.2, 8]} />
                  <meshStandardMaterial color="#38bdf8" metalness={0.5} roughness={0.3} />
                </mesh>
                <mesh position={[2.3, 1.6, 0]} castShadow>
                  <cylinderGeometry args={[0.18, 0.22, 3.2, 8]} />
                  <meshStandardMaterial color="#38bdf8" metalness={0.5} roughness={0.3} />
                </mesh>
                <mesh position={[0, 1.65, 0]}>
                  <boxGeometry args={[4.4, 2.5, 0.16]} />
                  <meshStandardMaterial
                    color="#0284c7"
                    transparent
                    opacity={0.52}
                    emissive="#0ea5e9"
                    emissiveIntensity={0.35}
                  />
                </mesh>
                <mesh position={[0, 1.85, 0.12]}>
                  <planeGeometry args={[3.6, 1.8]} />
                  <meshBasicMaterial map={tex} transparent />
                </mesh>
              </group>
            )
          })}
        </group>
      </group>

      {/* ── ROTA DIREITA 3D (X = +8.65): ARMA CONGELADA (888 HP) + ALTAR 🧮 + PORTÕES (+10/+50/+99) ── */}
      <group
        name="RightRouteContent3D"
        position={[BRIDGE_3D_ROUTES.RIGHT.xCenter, 0, 0]}
      >
        <group
          ref={rightWeaponGroupRef}
          position={[0, 0, -38.0]}
          onClick={(e) => {
            e.stopPropagation()
            onOpenMathBonus()
          }}
        >
          {/* Pedestal Blindado */}
          <mesh position={[0, 0.4, 0]} receiveShadow>
            <cylinderGeometry args={[1.85, 2.05, 0.8, 8]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.45} />
          </mesh>

          {/* Casulo de Gelo Pesado (888 HP) */}
          <mesh ref={rightIceShellRef} position={[0, 1.4, 0]} castShadow>
            <boxGeometry args={[3.9, 2.6, 2.6]} />
            <meshPhysicalMaterial
              color="#67e8f9"
              transparent
              opacity={0.72}
              roughness={0.12}
            />
          </mesh>

          {/* 3 Canos Rotativos Dourados internos apontando para -Z */}
          {[-0.6, 0, 0.6].map((bx, bIdx) => (
            <mesh
              key={`r_barrel_${bIdx}`}
              position={[bx, 1.45, -0.4]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.24, 0.28, 2.8, 10]} />
              <meshStandardMaterial color="#facc15" metalness={0.78} roughness={0.22} />
            </mesh>
          ))}

          {/* Placa 3D: 🔥 888 -> ✅ ATIVO */}
          <mesh position={[0, 3.45, 0]}>
            <planeGeometry args={[3.8, 1.9]} />
            <meshBasicMaterial
              ref={rightWeaponPlaqueMatRef}
              map={rightWeaponTex}
              transparent
            />
          </mesh>
        </group>

        {/* Altar Interativo 3D de Bônus de Conta (🧮) clicável e móvel na Rota Direita */}
        <group
          ref={rightAltarGroupRef}
          position={[0, 0, -18.0]}
          onClick={(e) => {
            e.stopPropagation()
            onOpenMathBonus()
          }}
        >
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[1.35, 1.65, 1.5, 12]} />
            <meshStandardMaterial
              color="#581c87"
              emissive="#7e22ce"
              emissiveIntensity={0.45}
              roughness={0.35}
            />
          </mesh>
          <mesh ref={mathCrystalRef} position={[0, 1.75, 0]}>
            <octahedronGeometry args={[0.62, 0]} />
            <meshStandardMaterial
              color="#fde047"
              emissive="#eab308"
              emissiveIntensity={0.75}
              metalness={0.6}
              roughness={0.15}
            />
          </mesh>
          <mesh position={[0, 2.85, 0]}>
            <planeGeometry args={[3.5, 1.75]} />
            <meshBasicMaterial map={mathAltarTex} transparent />
          </mesh>
        </group>

        {/* Esteira de Portões de Alto Valor (+10, +50, +99) na Rota Direita */}
        <group ref={rightCorridorFlowRef}>
          {simRef.current.rightGates.map((gate, idx) => {
            const tex = rightGateTextures[idx % rightGateTextures.length] ?? rightGatePlus99Tex
            return (
              <group
                key={gate.id}
                position={[0, 0, gate.z]}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenMathBonus()
                }}
              >
                <mesh position={[-2.3, 1.75, 0]} castShadow>
                  <cylinderGeometry args={[0.2, 0.24, 3.5, 8]} />
                  <meshStandardMaterial color="#facc15" metalness={0.65} roughness={0.25} />
                </mesh>
                <mesh position={[2.3, 1.75, 0]} castShadow>
                  <cylinderGeometry args={[0.2, 0.24, 3.5, 8]} />
                  <meshStandardMaterial color="#facc15" metalness={0.65} roughness={0.25} />
                </mesh>
                <mesh position={[0, 1.8, 0]}>
                  <boxGeometry args={[4.4, 2.7, 0.18]} />
                  <meshStandardMaterial
                    color="#ca8a04"
                    transparent
                    opacity={0.55}
                    emissive="#eab308"
                    emissiveIntensity={0.4}
                  />
                </mesh>
                <mesh position={[0, 1.95, 0.14]}>
                  <planeGeometry args={[3.8, 1.9]} />
                  <meshBasicMaterial map={tex} transparent />
                </mesh>
              </group>
            )
          })}
        </group>
      </group>
    </group>
  )
}
