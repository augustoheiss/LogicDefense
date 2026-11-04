// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/sandbox/SandboxVoxelStage3D.tsx
// LogicBattle V13: Palco WebGL 3D Voxel Sandbox Unificado (@react-three/fiber)
// Compartilhado por TODOS os Minigames e Bases do jogo:
// - Terreno Voxel 48×12×48 via THREE.InstancedMesh (1 Draw Call com Face Culling)
// - Blocos-Portais Físicos 3D (Stepping-Block Portals) com Animação de Transição 3D
// - Avatar Voxel 3D (Espada em Arco, Blaster, Dash, Pulo, Hoverboard KM/H)
// - Ferramenta Voxel Brush (Width × Height × Depth) e Catálogo [I] Inventory
// ──────────────────────────────────────────────────────────────────────────────

import { Canvas, useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { formatArmy } from '../domain/notation'
import { getPlaqueTexture } from '../run/bridge3d/plaqueTextureCache'
import { useLogicBattleStore } from '../state/useLogicBattleStore'
import {
  SANDBOX_ASSET_CATALOG,
  SANDBOX_STEPPING_PORTALS,
} from './sandboxCatalog'
import {
  createInitialSandboxVoxelSim,
  executeSandboxBrushStroke,
  placeCatalogAssetInSandbox,
  SandboxPortalTransitionState,
  SandboxVoxelSimState,
  stepSandboxVoxelSim,
  toggleSandboxHoverboard,
  triggerSandboxDash,
  triggerSandboxJump,
  triggerSandboxSwordSlash,
  walkAndStepOnPortalBlock,
} from './sandboxVoxelSim'
import {
  gridToWorldCoord,
  MAX_VOXEL_INSTANCES,
  SandboxZoneKey,
  VOXEL_BLOCK_PALETTE,
  VoxelBlockId,
  VoxelBrushMode,
} from './voxelChunkGrid'

export interface ExternalVoxelBuilding3D {
  id: string
  label: string
  kind: string
  tier: number
  worldX: number
  worldZ: number
}

export interface ExternalVoxelAlly3D {
  id: string
  kind: string
  hp: number
  maxHp: number
  worldX: number
  worldZ: number
  carryingRock?: boolean
}

export interface ExternalVoxelEnemy3D {
  id: string
  kind: string
  isBoss: boolean
  hp: number
  maxHp: number
  worldX: number
  worldZ: number
}

export interface ExternalVoxelDragonSegment3D {
  id: string
  isHead: boolean
  hp: number
  maxHp: number
  colorHex: string
  worldX: number
  worldZ: number
}

export interface ExternalVoxelMathPad3D {
  id: string
  label: string
  isOptimal: boolean
  isTrap: boolean
  worldX: number
  worldZ: number
}

export interface ExternalVoxelBolt3D {
  x: number
  z: number
  colorHex: string
}

export interface SandboxDynamicSceneBridge {
  heroWorldX?: number
  heroWorldZ?: number
  buildings: ExternalVoxelBuilding3D[]
  allies: ExternalVoxelAlly3D[]
  enemies: ExternalVoxelEnemy3D[]
  dragonSegments?: ExternalVoxelDragonSegment3D[]
  mathPads?: ExternalVoxelMathPad3D[]
  bolts?: ExternalVoxelBolt3D[]
}

function canRenderWebGL(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (c.getContext('webgl2') ||
          c.getContext('webgl') ||
          c.getContext('experimental-webgl')),
    )
  } catch {
    return false
  }
}

/**
 * Componente 3D reutilizável que renderiza a Grade Voxel 48×12×48 via THREE.InstancedMesh
 * + os 7 Blocos-Portais Físicos 3D com feixe de transição energético.
 * Pode ser embutido diretamente tanto no <SandboxVoxelStage3D /> quanto em
 * <Bridge3DEnvironment /> e <OpenWorldBase3D />!
 */
export const SharedVoxelIslandAndPortals3D: React.FC<{
  simRef: React.MutableRefObject<SandboxVoxelSimState>
  yOffset?: number
  renderAvatar?: boolean
  externalBridgeRef?: React.MutableRefObject<SandboxDynamicSceneBridge>
  onOpenMathModal?: () => void
}> = ({
  simRef,
  yOffset = 0,
  renderAvatar = true,
  externalBridgeRef,
  onOpenMathModal,
}) => {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const uploadedVersionRef = useRef<number>(-1)
  const avatarGroupRef = useRef<THREE.Group>(null)
  const swordArcRef = useRef<THREE.Mesh>(null)
  const brushCursorRef = useRef<THREE.Mesh>(null)
  const warpBeamGroupRef = useRef<THREE.Group>(null)
  const dynamicEnemiesGroupRef = useRef<THREE.Group>(null)
  const dynamicAlliesGroupRef = useRef<THREE.Group>(null)
  const dynamicBuildingsGroupRef = useRef<THREE.Group>(null)
  const dynamicDragonGroupRef = useRef<THREE.Group>(null)
  const dynamicBoltsGroupRef = useRef<THREE.Group>(null)

  const dummyObj = useMemo(() => new THREE.Object3D(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  const portalPlaques = useMemo(() => {
    const map: Record<string, THREE.CanvasTexture> = {}
    for (const p of SANDBOX_STEPPING_PORTALS) {
      map[p.id] = getPlaqueTexture(
        p.shortBadge,
        '#0f172a',
        p.colorHex,
        '#ffffff',
        'PISAR = PORTAL',
      )
    }
    return map
  }, [])

  useFrame((state, delta) => {
    const sim = simRef.current
    const t = state.clock.elapsedTime

    // 1. Se o jogador navegou na cena externa (Arcade/Serpente), sincroniza a posição com o Avatar Voxel 3D
    const ext = externalBridgeRef?.current
    if (
      ext &&
      typeof ext.heroWorldX === 'number' &&
      typeof ext.heroWorldZ === 'number' &&
      !sim.portalTransition
    ) {
      sim.avatarTargetX = ext.heroWorldX
      sim.avatarTargetZ = ext.heroWorldZ
    }

    // 2. Atualizar buffer do THREE.InstancedMesh apenas quando grid.version mudar (O(1) em frames normais!)
    const mesh = instancedMeshRef.current
    if (mesh && uploadedVersionRef.current !== sim.lastBuiltGridVersion) {
      uploadedVersionRef.current = sim.lastBuiltGridVersion
      const list = sim.visibleInstances
      const count = Math.min(MAX_VOXEL_INSTANCES, list.length)
      mesh.count = count
      for (let i = 0; i < count; i++) {
        const v = list[i]
        dummyObj.position.set(v.worldX, v.worldY + yOffset, v.worldZ)
        dummyObj.rotation.set(0, 0, 0)
        dummyObj.scale.set(1, 1, 1)
        dummyObj.updateMatrix()
        mesh.setMatrixAt(i, dummyObj.matrix)
        tempColor.set(v.colorHex)
        mesh.setColorAt(i, tempColor)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    // 3. Atualizar Cursor Volumétrico 3D (Width × Height × Depth) do Studio Builder
    if (brushCursorRef.current) {
      brushCursorRef.current.visible = sim.studioBuilderOpen
      if (sim.studioBuilderOpen) {
        const { worldX, worldY, worldZ } = gridToWorldCoord(
          sim.cursorGridX,
          sim.cursorGridY,
          sim.cursorGridZ,
        )
        brushCursorRef.current.position.set(
          worldX,
          worldY + yOffset + sim.brushSize.height * 0.5,
          worldZ,
        )
        brushCursorRef.current.scale.set(
          sim.brushSize.width,
          sim.brushSize.height,
          sim.brushSize.depth,
        )
      }
    }

    // 4. Atualizar Avatar Voxel 3D + Golpe de Espada em Arco + Hoverboard
    if (renderAvatar && avatarGroupRef.current) {
      const walkBob =
        sim.speedKmh > 0 && !sim.hoverboardActive
          ? Math.abs(Math.sin(t * 10)) * 0.18
          : sim.hoverboardActive
            ? Math.sin(t * 6) * 0.12 + 0.22
            : 0
      avatarGroupRef.current.position.set(
        sim.avatarX,
        sim.avatarY + yOffset + walkBob,
        sim.avatarZ,
      )
      avatarGroupRef.current.rotation.y = sim.avatarYawRad
    }

    if (swordArcRef.current) {
      swordArcRef.current.visible = sim.swordSlashTimerMs > 0
      if (sim.swordSlashTimerMs > 0) {
        swordArcRef.current.rotation.z = t * 18
      }
    }

    // 5. Atualizar Feixe de Transição 3D quando o Avatar pisa em um Bloco-Portal
    if (warpBeamGroupRef.current) {
      const pt = sim.portalTransition
      if (pt && pt.active) {
        warpBeamGroupRef.current.visible = true
        warpBeamGroupRef.current.position.set(pt.portalX, yOffset + 0.5, pt.portalZ)
        warpBeamGroupRef.current.rotation.y = t * 8
        const s = 1 + pt.progress * 1.4
        warpBeamGroupRef.current.scale.set(s, 1 + pt.progress * 2.2, s)
      } else {
        warpBeamGroupRef.current.visible = false
      }
    }

    // 6. Sincronizar entidades dinâmicas Voxel 3D do minigame ativo (Inimigos, Boss, Aliados, Construções, Serpente)
    if (ext) {
      if (dynamicBuildingsGroupRef.current) {
        const children = dynamicBuildingsGroupRef.current.children
        for (let i = 0; i < children.length; i++) {
          const grp = children[i] as THREE.Group
          const b = ext.buildings[i]
          if (b) {
            grp.visible = true
            grp.position.set(b.worldX, yOffset + 1.0, b.worldZ)
          } else {
            grp.visible = false
          }
        }
      }

      if (dynamicAlliesGroupRef.current) {
        const children = dynamicAlliesGroupRef.current.children
        for (let i = 0; i < children.length; i++) {
          const grp = children[i] as THREE.Group
          const a = ext.allies[i]
          if (a) {
            grp.visible = true
            const bob = Math.abs(Math.sin(t * 9 + i)) * 0.14
            grp.position.set(a.worldX, yOffset + 1.0 + bob, a.worldZ)
          } else {
            grp.visible = false
          }
        }
      }

      if (dynamicEnemiesGroupRef.current) {
        const children = dynamicEnemiesGroupRef.current.children
        for (let i = 0; i < children.length; i++) {
          const grp = children[i] as THREE.Group
          const e = ext.enemies[i]
          if (e) {
            grp.visible = true
            const bob = Math.abs(Math.sin(t * 7.5 + i * 1.3)) * 0.16
            const scale = e.isBoss ? 2.15 : 1.05
            grp.position.set(e.worldX, yOffset + 1.0 + bob, e.worldZ)
            grp.scale.set(scale, scale, scale)
          } else {
            grp.visible = false
          }
        }
      }

      if (dynamicDragonGroupRef.current) {
        const children = dynamicDragonGroupRef.current.children
        const segs = ext.dragonSegments ?? []
        for (let i = 0; i < children.length; i++) {
          const grp = children[i] as THREE.Group
          const seg = segs[i]
          if (seg) {
            grp.visible = true
            const waveY = Math.sin(t * 6 + i * 0.6) * 0.22
            const sc = seg.isHead ? 1.55 : 1.05
            grp.position.set(seg.worldX, yOffset + 1.25 + waveY, seg.worldZ)
            grp.scale.set(sc, sc, sc)
          } else {
            grp.visible = false
          }
        }
      }

      if (dynamicBoltsGroupRef.current) {
        const children = dynamicBoltsGroupRef.current.children
        const bolts = ext.bolts ?? []
        for (let i = 0; i < children.length; i++) {
          const m = children[i] as THREE.Mesh
          const b = bolts[i]
          if (b) {
            m.visible = true
            m.position.set(b.x, yOffset + 1.65, b.z)
          } else {
            m.visible = false
          }
        }
      }
    }

    void delta
  })

  return (
    <group name="SandboxVoxelUnifiedRoot">
      {/* ── 1. TERRENO VOXEL 48×12×48 EM UM ÚNICO INSTANCED MESH (ZERO RAYCAST POR INSTÂNCIA) ── */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, MAX_VOXEL_INSTANCES]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.96, 0.96, 0.96]} />
        <meshLambertMaterial />
      </instancedMesh>

      {/* Plano único O(1) de clique (2 triângulos) quando o palco Sandbox é o controlador direto do Avatar */}
      {renderAvatar && (
        <mesh
          position={[0, yOffset + 0.5, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            const pt = e.point
            const sim = simRef.current
            for (const portal of SANDBOX_STEPPING_PORTALS) {
              if (Math.hypot(pt.x - portal.worldX, pt.z - portal.worldZ) <= 2.2) {
                walkAndStepOnPortalBlock(sim, portal.id)
                return
              }
            }
            for (const ent of sim.placedEntities) {
              if (
                ent.blueprintId === 'voxel_math_altar' &&
                Math.hypot(pt.x - ent.worldX, pt.z - ent.worldZ) <= 2.0
              ) {
                onOpenMathModal?.()
                return
              }
            }
            if (sim.studioBuilderOpen) {
              executeSandboxBrushStroke(sim, pt.x, pt.z)
            } else {
              sim.avatarTargetX = Math.max(-21, Math.min(21, pt.x))
              sim.avatarTargetZ = Math.max(-21, Math.min(21, pt.z))
            }
          }}
        >
          <planeGeometry args={[48, 48]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* ── 2. CURSOR VOLUMÉTRICO 3D DO PINCEL VOXEL (WIDTH × HEIGHT × DEPTH) ── */}
      <mesh ref={brushCursorRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* ── 3. OS 7 BLOCOS-PORTAIS FÍSICOS 3D (STEPPING-BLOCK PORTALS) ── */}
      <group name="SandboxSteppingPortals3D">
        {SANDBOX_STEPPING_PORTALS.map((portal) => {
          const isCurrentZone = portal.targetZoneKey === simRef.current.zoneKey
          const plaqueTex = portalPlaques[portal.id]
          return (
            <group
              key={portal.id}
              position={[portal.worldX, yOffset + 0.9, portal.worldZ]}
            >
              {/* Bloco-Pedestal Voxel Luminoso */}
              <mesh position={[0, 0.15, 0]}>
                <boxGeometry args={[2.2, 0.45, 2.2]} />
                <meshStandardMaterial
                  color={portal.colorHex}
                  emissive={portal.colorHex}
                  emissiveIntensity={isCurrentZone ? 0.35 : 0.85}
                  roughness={0.25}
                />
              </mesh>
              {/* Anel de Energia do Bloco-Portal */}
              <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.85, 1.25, 4]} />
                <meshBasicMaterial
                  color="#fef08a"
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Cristal Voxel Flutuante sobre o Bloco-Portal */}
              <mesh position={[0, 1.35, 0]}>
                <boxGeometry args={[0.65, 0.65, 0.65]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive={portal.colorHex}
                  emissiveIntensity={1.1}
                />
              </mesh>
              {/* Placa 3D indicando o Destino do Bloco-Portal */}
              <mesh position={[0, 2.45, 0]}>
                <planeGeometry args={[2.9, 1.15]} />
                <meshBasicMaterial map={plaqueTex} transparent />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* ── 4. FEIXE ENERGÉTICO DE TRANSIÇÃO 3D AO PISAR NO BLOCO-PORTAL ── */}
      <group ref={warpBeamGroupRef} visible={false} name="SandboxPortalWarpBeam3D">
        <mesh position={[0, 4.5, 0]}>
          <cylinderGeometry args={[1.6, 1.6, 9.0, 16, 1, true]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.48}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 2.4, 24]} />
          <meshBasicMaterial color="#fde047" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ── 5. ENTIDADES VOXEL POSICIONADAS PELO JOGADOR (TORRES 1500🪙, ALTARES 🧮) ── */}
      <group name="SandboxPlacedEntities3D">
        {simRef.current.placedEntities.map((ent) => (
          <group
            key={ent.id}
            position={[ent.worldX, ent.worldY + yOffset, ent.worldZ]}
          >
            <mesh position={[0, 0.8, 0]} castShadow>
              <boxGeometry args={[1.2, 1.6, 1.2]} />
              <meshStandardMaterial
                color={ent.colorHex}
                emissive={ent.colorHex}
                emissiveIntensity={0.45}
              />
            </mesh>
            <mesh position={[0, 1.9, 0]} castShadow>
              <boxGeometry args={[0.85, 0.85, 0.85]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── 6. AVATAR VOXEL 3D + GOLPE DE ESPADA EM ARCO + HOVERBOARD (THE SANDBOX NEXT/STUDIO) ── */}
      {renderAvatar && (
        <group ref={avatarGroupRef} name="SandboxVoxelAvatar3D">
          {/* Hoverboard Voxel sob os pés quando ativo */}
          {simRef.current.hoverboardActive && (
            <mesh position={[0, 0.12, 0]} castShadow>
              <boxGeometry args={[1.15, 0.18, 1.95]} />
              <meshStandardMaterial
                color="#ec4899"
                emissive="#38bdf8"
                emissiveIntensity={0.85}
              />
            </mesh>
          )}
          {/* Pernas Voxel */}
          <mesh position={[-0.22, 0.42, 0]} castShadow>
            <boxGeometry args={[0.32, 0.65, 0.32]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
          <mesh position={[0.22, 0.42, 0]} castShadow>
            <boxGeometry args={[0.32, 0.65, 0.32]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
          {/* Torso Voxel Cubo */}
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[0.82, 0.85, 0.52]} />
            <meshStandardMaterial
              color="#0284c7"
              emissive="#0369a1"
              emissiveIntensity={0.35}
            />
          </mesh>
          {/* Cabeça Voxel Cubo + Olhos Emissivos (estilo Season 3 / NEXT) */}
          <mesh position={[0, 1.78, 0]} castShadow>
            <boxGeometry args={[0.74, 0.74, 0.74]} />
            <meshStandardMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[-0.16, 1.82, 0.38]}>
            <boxGeometry args={[0.14, 0.1, 0.05]} />
            <meshBasicMaterial color="#fef08a" />
          </mesh>
          <mesh position={[0.16, 1.82, 0.38]}>
            <boxGeometry args={[0.14, 0.1, 0.05]} />
            <meshBasicMaterial color="#fef08a" />
          </mesh>
          {/* Coroa Voxel Dourada */}
          <mesh position={[0, 2.25, 0]}>
            <boxGeometry args={[0.58, 0.24, 0.58]} />
            <meshStandardMaterial
              color="#facc15"
              emissive="#eab308"
              emissiveIntensity={0.65}
            />
          </mesh>
          {/* Espada Voxel na Mão Direita */}
          <mesh position={[0.62, 1.15, 0.45]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.16, 1.15, 0.18]} />
            <meshStandardMaterial
              color="#bae6fd"
              emissive="#38bdf8"
              emissiveIntensity={0.75}
            />
          </mesh>
          {/* Arco de Corte 3D (Sword Slash VFX da Aba 30) */}
          <mesh
            ref={swordArcRef}
            position={[0, 1.1, 0.9]}
            rotation={[Math.PI / 2, 0, 0]}
            visible={false}
          >
            <ringGeometry args={[1.1, 2.15, 16, 1, 0, Math.PI * 1.25]} />
            <meshBasicMaterial
              color="#38bdf8"
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
            />
          </mesh>
        </group>
      )}

      {/* ── 7..11. ENTIDADES DINÂMICAS VOXEL 3D DO MINIGAME ATIVO (SOMENTE QUANDO HÁ PONTE DINÂMICA EXTERNA) ── */}
      {externalBridgeRef && (
        <>
          <group ref={dynamicBuildingsGroupRef} name="SandboxDynamicBuildings3D">
            {Array.from({ length: 10 }).map((_, idx) => (
              <group key={`sbx_bldg_${idx}`} visible={false}>
                <mesh position={[0, 0.9, 0]}>
                  <boxGeometry args={[1.65, 1.85, 1.65]} />
                  <meshLambertMaterial color="#0284c7" />
                </mesh>
                <mesh position={[0, 2.05, 0]}>
                  <boxGeometry args={[1.95, 0.55, 1.95]} />
                  <meshLambertMaterial
                    color="#38bdf8"
                    emissive="#0ea5e9"
                    emissiveIntensity={0.4}
                  />
                </mesh>
              </group>
            ))}
          </group>

          <group ref={dynamicAlliesGroupRef} name="SandboxDynamicAllies3D">
            {Array.from({ length: 24 }).map((_, idx) => (
              <group key={`sbx_ally_${idx}`} visible={false}>
                <mesh position={[0, 0.55, 0]}>
                  <boxGeometry args={[0.68, 0.85, 0.68]} />
                  <meshLambertMaterial
                    color="#10b981"
                    emissive="#059669"
                    emissiveIntensity={0.35}
                  />
                </mesh>
                <mesh position={[0, 1.18, 0]}>
                  <boxGeometry args={[0.56, 0.56, 0.56]} />
                  <meshLambertMaterial color="#34d399" />
                </mesh>
              </group>
            ))}
          </group>

          <group ref={dynamicEnemiesGroupRef} name="SandboxDynamicEnemies3D">
            {Array.from({ length: 28 }).map((_, idx) => (
              <group key={`sbx_enemy_${idx}`} visible={false}>
                <mesh position={[0, 0.65, 0]}>
                  <boxGeometry args={[0.88, 1.05, 0.88]} />
                  <meshLambertMaterial
                    color="#dc2626"
                    emissive="#991b1b"
                    emissiveIntensity={0.5}
                  />
                </mesh>
                <mesh position={[0, 1.42, 0]}>
                  <boxGeometry args={[0.74, 0.74, 0.74]} />
                  <meshLambertMaterial color="#ef4444" />
                </mesh>
                <mesh position={[-0.18, 1.48, 0.39]}>
                  <boxGeometry args={[0.14, 0.1, 0.05]} />
                  <meshBasicMaterial color="#fde047" />
                </mesh>
                <mesh position={[0.18, 1.48, 0.39]}>
                  <boxGeometry args={[0.14, 0.1, 0.05]} />
                  <meshBasicMaterial color="#fde047" />
                </mesh>
              </group>
            ))}
          </group>

          <group ref={dynamicDragonGroupRef} name="SandboxDynamicDragon3D">
            {Array.from({ length: 32 }).map((_, idx) => (
              <group key={`sbx_dragon_seg_${idx}`} visible={false}>
                <mesh position={[0, 0.5, 0]}>
                  <boxGeometry args={[1.05, 1.05, 1.05]} />
                  <meshLambertMaterial
                    color={idx === 0 ? '#ef4444' : idx % 2 === 0 ? '#a855f7' : '#f59e0b'}
                    emissive={idx === 0 ? '#dc2626' : '#7e22ce'}
                    emissiveIntensity={0.55}
                  />
                </mesh>
                <mesh position={[0, 1.18, 0]}>
                  <boxGeometry args={[0.42, 0.38, 0.42]} />
                  <meshLambertMaterial color="#fde047" />
                </mesh>
              </group>
            ))}
          </group>

          <group ref={dynamicBoltsGroupRef} name="SandboxDynamicBolts3D">
            {Array.from({ length: 24 }).map((_, idx) => (
              <mesh key={`sbx_bolt_${idx}`} visible={false}>
                <boxGeometry args={[0.34, 0.34, 0.58]} />
                <meshBasicMaterial color="#fde047" />
              </mesh>
            ))}
          </group>
        </>
      )}
    </group>
  )
}

export interface SandboxVoxelStage3DProps {
  zoneKey: SandboxZoneKey
  seed?: number
  externalBridgeRef?: React.MutableRefObject<SandboxDynamicSceneBridge>
  onOpenMathModal?: () => void
  onKillSomeEnemiesBySword?: () => void
}

/**
 * Palco Completo 3D Voxel Sandbox + Camada HUD Sandbox (`data-testid="lb-sandbox-hud-layer"`).
 */
export const SandboxVoxelStage3D: React.FC<SandboxVoxelStage3DProps> = ({
  zoneKey,
  seed = 42,
  externalBridgeRef,
  onOpenMathModal,
  onKillSomeEnemiesBySword,
}) => {
  const [webglSupported] = useState<boolean>(() => canRenderWebGL())
  const simRef = useRef<SandboxVoxelSimState>(
    createInitialSandboxVoxelSim(seed, zoneKey),
  )
  const [, setUiTick] = useState<number>(0)

  // Reinicializa a grade Voxel quando a zona muda
  useEffect(() => {
    simRef.current = createInitialSandboxVoxelSim(seed, zoneKey)
    setUiTick((v) => v + 1)
  }, [seed, zoneKey])

  // Executa a transição real de Mundo/Engine quando o Avatar conclui o passo no Bloco-Portal!
  const handlePortalTransitionCompleted = (
    portal: SandboxPortalTransitionState,
  ) => {
    const st = useLogicBattleStore.getState()
    if (portal.targetWorld === 'realm') {
      st.switchWorld('realm')
    } else if (portal.targetEngineId) {
      st.selectEngine(portal.targetEngineId)
      if (st.world !== 'run') {
        st.switchWorld('run')
      }
    }
  }

  // Loop 60Hz de simulação do Sandbox + publicação de telemetria e hooks E2E
  useEffect(() => {
    let lastNow = performance.now()
    let hudCounter = 0

    const publishSandboxTelemetry = () => {
      if (typeof window === 'undefined') return
      const sim = simRef.current
      const st = useLogicBattleStore.getState()
      const win = window as unknown as {
        __lbSandboxTelemetry?: Record<string, unknown>
        __lbStepOnSandboxPortal?: (targetPortalOrZone: string) => {
          triggered: boolean
          portalId: string | null
          targetZoneKey: string | null
          sharedWalletBalance: number
        }
        __lbApplySandboxVoxelBrush?: (
          width: number,
          height: number,
          depth: number,
          blockId?: VoxelBlockId,
          mode?: VoxelBrushMode,
        ) => {
          modifiedCount: number
          terrainVersion: number
          instancedVoxelCount: number
          rleLength: number
        }
        __lbTriggerSandboxCombatAction?: (
          action: 'sword' | 'dash' | 'jump' | 'hoverboard',
        ) => void
      }

      win.__lbStepOnSandboxPortal = (targetPortalOrZone: string) => {
        const portal = walkAndStepOnPortalBlock(sim, targetPortalOrZone)
        publishSandboxTelemetry()
        return {
          triggered: Boolean(portal),
          portalId: portal?.id ?? null,
          targetZoneKey: portal?.targetZoneKey ?? null,
          sharedWalletBalance: st.getSharedWalletBalance(),
        }
      }

      win.__lbApplySandboxVoxelBrush = (
        width: number,
        height: number,
        depth: number,
        blockId: VoxelBlockId = 6,
        mode: VoxelBrushMode = 'ADD',
      ) => {
        sim.brushSize = { width, height, depth }
        sim.selectedBlockId = blockId
        sim.brushMode = mode
        const res = executeSandboxBrushStroke(sim, 2, 2, mode)
        publishSandboxTelemetry()
        setUiTick((v) => v + 1)
        return {
          ...res,
          rleLength: sim.rleSnapshot.length,
        }
      }

      win.__lbTriggerSandboxCombatAction = (action) => {
        if (action === 'sword') {
          triggerSandboxSwordSlash(sim)
          onKillSomeEnemiesBySword?.()
        } else if (action === 'dash') {
          triggerSandboxDash(sim)
        } else if (action === 'jump') {
          triggerSandboxJump(sim)
        } else if (action === 'hoverboard') {
          toggleSandboxHoverboard(sim)
        }
        publishSandboxTelemetry()
        setUiTick((v) => v + 1)
      }

      win.__lbSandboxTelemetry = {
        webglSupported,
        zoneKey: sim.zoneKey,
        activeEngineId: st.activeEngineId,
        world: st.world,
        gridDimensions: `${sim.grid.width}x${sim.grid.height}x${sim.grid.depth}`,
        terrainVersion: sim.grid.version,
        instancedVoxelCount: sim.visibleInstances.length,
        rleLength: sim.rleSnapshot.length,
        avatarX: Number(sim.avatarX.toFixed(2)),
        avatarY: Number(sim.avatarY.toFixed(2)),
        avatarZ: Number(sim.avatarZ.toFixed(2)),
        avatarHp: sim.avatarHp,
        avatarEnergy: Math.round(sim.avatarEnergy),
        hoverboardActive: sim.hoverboardActive,
        speedKmh: sim.speedKmh,
        swordSlashCount: sim.swordSlashCount,
        dashCount: sim.dashCount,
        jumpCount: sim.jumpCount,
        brushSize: { ...sim.brushSize },
        brushActionsCount: sim.brushActionsCount,
        placedEntitiesCount: sim.placedEntities.length,
        steppingPortalsCount: SANDBOX_STEPPING_PORTALS.length,
        portalTransitionActive: Boolean(sim.portalTransition?.active),
        portalTransitionTarget: sim.portalTransition?.targetZoneKey ?? null,
        portalTransitionsCompletedCount: sim.portalTransitionsCompletedCount,
        sharedWalletBalance: st.getSharedWalletBalance(),
      }
    }

    const tick = (now: number) => {
      const dtSec = Math.min(0.08, Math.max(0.004, (now - lastNow) / 1000))
      lastNow = now
      stepSandboxVoxelSim(simRef.current, dtSec, {
        onPortalTransitionCompleted: handlePortalTransitionCompleted,
      })
      publishSandboxTelemetry()
      hudCounter += 1
      if (hudCounter % 10 === 0) {
        setUiTick((v) => (v + 1) % 10000)
      }
    }

    publishSandboxTelemetry()
    const timerId = window.setInterval(() => {
      tick(performance.now())
    }, 40)
    return () => window.clearInterval(timerId)
  }, [webglSupported, zoneKey])

  const sim = simRef.current
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const sharedWalletBalance = useLogicBattleStore((s) => s.getSharedWalletBalance())

  const spendFromSharedWallet = (cost: number): boolean => {
    const st = useLogicBattleStore.getState()
    if (st.getSharedWalletBalance() < cost) return false
    useLogicBattleStore.setState({
      save: {
        ...st.save,
        reserveTroops: Math.max(5, st.save.reserveTroops - cost),
      },
    })
    return true
  }

  return (
    <>
      {/* ── CAMADA WEBGL 3D DO MOTOR VOXEL SANDBOX ── */}
      {webglSupported && (
        <div
          className="lb-sandbox-webgl-stage"
          data-testid="lb-sandbox-webgl-stage"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'auto',
          }}
        >
          <Canvas
            shadows
            camera={{ position: [0, 22, 24], fov: 45 }}
            gl={{ antialias: true, alpha: false }}
          >
            <color attach="background" args={['#0f172a']} />
            <fog attach="fog" args={['#0f172a', 38, 96]} />
            <ambientLight intensity={0.85} />
            <hemisphereLight args={['#bae6fd', '#1e293b', 0.65]} />
            <directionalLight
              position={[18, 32, 16]}
              intensity={1.5}
              castShadow
            />
            <SharedVoxelIslandAndPortals3D
              simRef={simRef}
              externalBridgeRef={externalBridgeRef}
              onOpenMathModal={onOpenMathModal}
            />
          </Canvas>
        </div>
      )}

      {/* ── CAMADA HUD SANDBOX ISOLADA (Fora de .lb-minimal-hud e .lb-tactical-dock!) ── */}
      <div
        className="lb-sandbox-hud-layer"
        data-testid="lb-sandbox-hud-layer"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 23,
        }}
      >
        {/* 1. Banner de Animação 3D quando o Avatar pisa em um Bloco-Portal */}
        {sim.portalTransition && sim.portalTransition.active && (
          <div
            data-testid="lb-sandbox-portal-transition-banner"
            style={{
              position: 'absolute',
              top: '44%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              padding: '12px 22px',
              borderRadius: '16px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: `2px solid ${sim.portalTransition.colorHex}`,
              color: '#f8fafc',
              fontWeight: 900,
              fontSize: '0.92rem',
              textAlign: 'center',
              boxShadow: '0 0 32px rgba(56, 189, 248, 0.75)',
            }}
          >
            <div>
              🌀 Bloco-Portal Ativado → {sim.portalTransition.icon}{' '}
              {sim.portalTransition.labelPt} (
              {Math.round(sim.portalTransition.progress * 100)}%)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#fde047', marginTop: '4px' }}>
              💰 Carteira Compartilhada Sincronizada:{' '}
              {formatArmy(sharedWalletBalance, notationMode)}
            </div>
          </div>
        )}

        {/* 2. Barra de Blocos-Portais Físicos 3D (Clique para caminhar e pisar no Bloco-Portal!) */}
        <div
          data-testid="lb-sandbox-portal-walk-bar"
          style={{
            position: 'absolute',
            top: '42px',
            left: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            pointerEvents: 'auto',
            maxWidth: 'calc(100vw - 170px)',
          }}
        >
          {SANDBOX_STEPPING_PORTALS.map((portal) => {
            const isCurrent = portal.targetZoneKey === sim.zoneKey
            return (
              <button
                key={portal.id}
                type="button"
                data-testid={`lb-step-portal-${portal.targetZoneKey}`}
                onClick={() => walkAndStepOnPortalBlock(simRef.current, portal.id)}
                title={`Caminhar e pisar no Bloco-Portal 3D para ir a ${portal.labelPt} (Carteira Compartilhada)`}
                style={{
                  padding: '3px 8px',
                  borderRadius: '999px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: isCurrent
                    ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                    : 'rgba(15, 23, 42, 0.86)',
                  border: `1px solid ${portal.colorHex}`,
                  color: isCurrent ? '#ffffff' : '#e2e8f0',
                }}
              >
                {portal.shortBadge}
              </button>
            )
          })}
        </div>

        {/* 3. Bússola Norte (N) + Coordenadas Voxel X:Y:Z + Botões Studio Brush e [I] Inventory */}
        <div
          data-testid="lb-sandbox-compass-hud"
          style={{
            position: 'absolute',
            top: '122px',
            right: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '5px',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              padding: '4px 9px',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              color: '#bae6fd',
              fontSize: '10px',
              fontWeight: 800,
            }}
          >
            🧭 N · X:{Math.round(sim.avatarX)} Y:{Math.round(sim.avatarY)} Z:
            {Math.round(sim.avatarZ)} · ⚡{Math.round(sim.avatarEnergy)}
            {sim.speedKmh > 0 ? ` · ${sim.speedKmh} KM/H` : ''}
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              data-testid="lb-sandbox-toggle-brush-btn"
              onClick={() => {
                simRef.current.studioBuilderOpen = !simRef.current.studioBuilderOpen
                setUiTick((v) => v + 1)
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '8px',
                background: sim.studioBuilderOpen ? '#0284c7' : 'rgba(15, 23, 42, 0.88)',
                border: '1px solid #38bdf8',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🛠️ Brush {sim.brushSize.width}×{sim.brushSize.height}×{sim.brushSize.depth}
            </button>

            <button
              type="button"
              data-testid="lb-sandbox-toggle-inventory-btn"
              onClick={() => {
                simRef.current.inventoryModalOpen = !simRef.current.inventoryModalOpen
                setUiTick((v) => v + 1)
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '8px',
                background: sim.inventoryModalOpen ? '#a855f7' : 'rgba(15, 23, 42, 0.88)',
                border: '1px solid #c084fc',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🎒 [I] Assets
            </button>
          </div>
        </div>

        {/* 4. Painel Studio Voxel Brush (Width × Height × Depth — Fiel à Aba 52) */}
        {sim.studioBuilderOpen && (
          <aside
            data-testid="lb-sandbox-brush-panel"
            style={{
              position: 'absolute',
              top: '182px',
              right: '12px',
              width: '215px',
              padding: '10px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.94)',
              border: '1px solid #38bdf8',
              color: '#f8fafc',
              fontSize: '11px',
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <strong style={{ color: '#38bdf8' }}>
              🧱 Voxel Brush ({sim.brushSize.width}×{sim.brushSize.height}×
              {sim.brushSize.depth})
            </strong>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Width: {sim.brushSize.width}</span>
              <input
                type="range"
                min={1}
                max={7}
                value={sim.brushSize.width}
                data-testid="lb-brush-width-slider"
                onChange={(e) => {
                  simRef.current.brushSize.width = Number(e.target.value)
                  setUiTick((v) => v + 1)
                }}
              />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Height: {sim.brushSize.height}</span>
              <input
                type="range"
                min={1}
                max={7}
                value={sim.brushSize.height}
                data-testid="lb-brush-height-slider"
                onChange={(e) => {
                  simRef.current.brushSize.height = Number(e.target.value)
                  setUiTick((v) => v + 1)
                }}
              />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Depth: {sim.brushSize.depth}</span>
              <input
                type="range"
                min={1}
                max={7}
                value={sim.brushSize.depth}
                data-testid="lb-brush-depth-slider"
                onChange={(e) => {
                  simRef.current.brushSize.depth = Number(e.target.value)
                  setUiTick((v) => v + 1)
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {([1, 3, 5, 6, 9] as VoxelBlockId[]).map((bId) => (
                <button
                  key={bId}
                  type="button"
                  onClick={() => {
                    simRef.current.selectedBlockId = bId
                    setUiTick((v) => v + 1)
                  }}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    background: VOXEL_BLOCK_PALETTE[bId].colorHex,
                    color: '#0f172a',
                    fontWeight: 900,
                    border:
                      sim.selectedBlockId === bId
                        ? '2px solid #ffffff'
                        : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {VOXEL_BLOCK_PALETTE[bId].namePt.split(' ')[0]}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                data-testid="lb-sandbox-apply-brush-btn"
                onClick={() => {
                  executeSandboxBrushStroke(simRef.current, undefined, undefined, 'ADD')
                  setUiTick((v) => v + 1)
                }}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  borderRadius: '6px',
                  background: '#10b981',
                  color: '#fff',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                + Construir
              </button>
              <button
                type="button"
                data-testid="lb-sandbox-carve-brush-btn"
                onClick={() => {
                  executeSandboxBrushStroke(simRef.current, undefined, undefined, 'CARVE')
                  setUiTick((v) => v + 1)
                }}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  borderRadius: '6px',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                − Escavar
              </button>
            </div>
          </aside>
        )}

        {/* 5. Catálogo [I] Inventory de Assets Voxel (Torres 1500+ 🪙, Altares 🧮, Hoverboard) */}
        {sim.inventoryModalOpen && (
          <aside
            data-testid="lb-sandbox-inventory-modal"
            style={{
              position: 'absolute',
              top: '182px',
              left: '12px',
              width: '260px',
              padding: '10px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid #c084fc',
              color: '#f8fafc',
              fontSize: '11px',
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <strong style={{ color: '#e9d5ff' }}>
              🎒 Catálogo Voxel Sandbox (💰 {formatArmy(sharedWalletBalance, notationMode)})
            </strong>
            {SANDBOX_ASSET_CATALOG.map((asset) => {
              const canAfford = sharedWalletBalance >= asset.costCoins
              return (
                <button
                  key={asset.id}
                  type="button"
                  data-testid={`lb-sandbox-place-asset-${asset.id}`}
                  disabled={!canAfford}
                  onClick={() => {
                    placeCatalogAssetInSandbox(
                      simRef.current,
                      asset.id,
                      sharedWalletBalance,
                      spendFromSharedWallet,
                    )
                    setUiTick((v) => v + 1)
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '5px 8px',
                    borderRadius: '8px',
                    background: canAfford
                      ? 'rgba(30, 41, 59, 0.9)'
                      : 'rgba(15, 23, 42, 0.5)',
                    border: `1px solid ${canAfford ? asset.colorHex : '#334155'}`,
                    color: canAfford ? '#f8fafc' : '#64748b',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                  }}
                >
                  <span>
                    {asset.icon} {asset.namePt}
                  </span>
                  <span style={{ color: '#fde047' }}>
                    {asset.costCoins === 0 ? 'GRÁTIS' : `🪙 ${asset.costCoins}`}
                  </span>
                </button>
              )
            })}
          </aside>
        )}

        {/* 6. Botões de Combate 3D Voxel (The Sandbox NEXT: Espada, Dash, Pulo, Hoverboard) */}
        <div
          data-testid="lb-sandbox-combat-dock"
          style={{
            position: 'absolute',
            right: '12px',
            bottom: '132px',
            display: 'flex',
            gap: '5px',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            data-testid="lb-sandbox-sword-btn"
            onClick={() => {
              triggerSandboxSwordSlash(simRef.current)
              onKillSomeEnemiesBySword?.()
              setUiTick((v) => v + 1)
            }}
            title="Golpe de Espada Voxel em Arco (The Sandbox NEXT)"
            style={{
              padding: '5px 8px',
              borderRadius: '10px',
              background: 'rgba(2, 132, 199, 0.88)',
              border: '1px solid #38bdf8',
              color: '#fff',
              fontSize: '10.5px',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ⚔️
          </button>
          <button
            type="button"
            data-testid="lb-sandbox-dash-btn"
            onClick={() => {
              triggerSandboxDash(simRef.current)
              setUiTick((v) => v + 1)
            }}
            title="Dash Voxel Rápido (>>>)"
            style={{
              padding: '5px 8px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.88)',
              border: '1px solid #34d399',
              color: '#fff',
              fontSize: '10.5px',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            💨
          </button>
          <button
            type="button"
            data-testid="lb-sandbox-jump-btn"
            onClick={() => {
              triggerSandboxJump(simRef.current)
              setUiTick((v) => v + 1)
            }}
            title="Pulo Voxel 3D (^^)"
            style={{
              padding: '5px 8px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.88)',
              border: '1px solid #fbbf24',
              color: '#fff',
              fontSize: '10.5px',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            🦘
          </button>
          <button
            type="button"
            data-testid="lb-sandbox-hoverboard-btn"
            onClick={() => {
              toggleSandboxHoverboard(simRef.current)
              setUiTick((v) => v + 1)
            }}
            title="Ativar Hoverboard Voxel 125 KM/H ([E] start!)"
            style={{
              padding: '5px 8px',
              borderRadius: '10px',
              background: sim.hoverboardActive
                ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                : 'rgba(30, 41, 59, 0.88)',
              border: '1px solid #f472b6',
              color: '#fff',
              fontSize: '10.5px',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            🛹
          </button>
        </div>
      </div>
    </>
  )
}
