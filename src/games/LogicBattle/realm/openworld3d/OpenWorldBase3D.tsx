// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/realm/openworld3d/OpenWorldBase3D.tsx
// MASTER_PLAN_V10 (Fase 2): Arena Principal de Mundo Aberto 3D (Estilo Logic Friction Evoluído)
// Reutiliza a estética/malhas 3D do Comandante da Ponte em um Mundo Aberto 3D com
// Guerra Territorial Bidirecional (Expedições Aliadas vs Contra-Ataques Inimigos).
// ──────────────────────────────────────────────────────────────────────────────

import { Canvas, useFrame } from '@react-three/fiber'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { REGION_LIST, REGIONS } from '../../config/regions'
import { canAttackRegion } from '../../domain/economy'
import { useLogicBattleStore } from '../../state/useLogicBattleStore'
import { CitadelBuildingId } from '../../types'
import {
  createInitialOpenWorldSimState,
  evolveOpenWorldEnemyThreat,
  OPEN_WORLD_CITADEL_3D_COORDS,
  OPEN_WORLD_ENGINE_PORTALS,
  OPEN_WORLD_FRONTIER_TOWER_SLOTS,
  OPEN_WORLD_REGION_3D_COORDS,
  OpenWorldSimState,
  spawnAlliedExpeditionWave,
  spawnEnemyCounterInvasionWave,
  stepOpenWorldRealmSim,
} from './openWorldPolicies'

function canCreateWebGLContext(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return Boolean(gl)
  } catch {
    return false
  }
}

interface OpenWorldSceneProps {
  simRef: React.MutableRefObject<OpenWorldSimState>
}

const OpenWorldSceneContent: React.FC<OpenWorldSceneProps> = ({ simRef }) => {
  const save = useLogicBattleStore((s) => s.save)
  const activeEngineId = useLogicBattleStore((s) => s.activeEngineId)
  const playerBridgeTowerLevels = useLogicBattleStore(
    (s) => s.playerBridgeTowerLevels,
  )

  const commanderGroupRef = useRef<THREE.Group>(null)
  const alliedExpeditionsGroupRef = useRef<THREE.Group>(null)
  const enemyInvasionsGroupRef = useRef<THREE.Group>(null)
  const defenseBoltsGroupRef = useRef<THREE.Group>(null)

  const escortOffsets = useMemo(
    () => [
      [-1.1, 0.8],
      [1.1, 0.8],
      [-0.7, 1.6],
      [0.7, 1.6],
      [0, 2.1],
    ],
    [],
  )

  useFrame((state) => {
    const sim = simRef.current
    const t = state.clock.elapsedTime

    // 1. Atualizar posição e animação 3D do Comandante da Ponte + Esquadrão no Mundo Aberto
    if (commanderGroupRef.current) {
      const bobY = Math.abs(Math.sin(t * 7.5)) * 0.16
      commanderGroupRef.current.position.set(sim.commanderX, bobY, sim.commanderZ)
      const dx = sim.commanderTargetX - sim.commanderX
      const dz = sim.commanderTargetZ - sim.commanderZ
      if (Math.hypot(dx, dz) > 0.08) {
        commanderGroupRef.current.rotation.y = Math.atan2(dx, dz)
      }
    }

    // 2. Atualizar Batalhões Aliados 3D em Marcha (Expedições)
    if (alliedExpeditionsGroupRef.current) {
      const children = alliedExpeditionsGroupRef.current.children
      for (let i = 0; i < children.length; i++) {
        const meshGroup = children[i] as THREE.Group
        const exp = sim.alliedExpeditions[i]
        if (exp && exp.active) {
          meshGroup.visible = true
          const marchBob = Math.abs(Math.sin(t * 9 + i)) * 0.18
          meshGroup.position.set(exp.x, marchBob, exp.z)
        } else {
          meshGroup.visible = false
        }
      }
    }

    // 3. Atualizar Ondas de Cerco Inimigas 3D em Marcha (Contra-Ataques)
    if (enemyInvasionsGroupRef.current) {
      const children = enemyInvasionsGroupRef.current.children
      for (let i = 0; i < children.length; i++) {
        const meshGroup = children[i] as THREE.Group
        const inv = sim.enemyInvasions[i]
        if (inv && inv.active) {
          meshGroup.visible = true
          const marchBob = Math.abs(Math.sin(t * 8 + i * 1.7)) * 0.18
          meshGroup.position.set(inv.x, marchBob, inv.z)
        } else {
          meshGroup.visible = false
        }
      }
    }

    // 4. Atualizar Projéteis Defensivos 3D das Torres da Cidadela
    if (defenseBoltsGroupRef.current) {
      const children = defenseBoltsGroupRef.current.children
      for (let i = 0; i < children.length; i++) {
        const boltMesh = children[i] as THREE.Mesh
        const bolt = sim.defenseBolts[i]
        if (bolt && bolt.active) {
          boltMesh.visible = true
          boltMesh.position.set(bolt.x, 1.35, bolt.z)
        } else {
          boltMesh.visible = false
        }
      }
    }
  })

  return (
    <group name="OpenWorldBase3DRoot">
      <ambientLight intensity={0.82} />
      <directionalLight
        position={[-14, 28, 18]}
        intensity={1.35}
        castShadow
      />
      <hemisphereLight args={['#bae6fd', '#1e293b', 0.55]} />

      {/* ── 1. PLANO RECEPTOR DE SOMBRAS 3D TRANSPARENTE ── */}
      <mesh
        position={[0, -0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[64, 42]} />
        <shadowMaterial transparent opacity={0.25} />
      </mesh>

      {/* ── 2. AS 4 TORRES DEFENSIVAS 3D DA FRONTEIRA ALIADA (COMPARTILHADAS COM A PONTE) ── */}
      {OPEN_WORLD_FRONTIER_TOWER_SLOTS.map((slot) => {
        const lvl = playerBridgeTowerLevels[slot.slotIndex] ?? 0
        const active = lvl > 0
        return (
          <group
            key={slot.id}
            position={[slot.x, 0, slot.z]}
            scale={
              active
                ? [0.85 + lvl * 0.06, 0.85 + lvl * 0.12, 0.85 + lvl * 0.06]
                : [0.55, 0.22, 0.55]
            }
          >
            <mesh position={[0, 0.9, 0]} castShadow>
              <cylinderGeometry args={[0.5, 0.65, 1.8, 8]} />
              <meshStandardMaterial
                color={active ? '#0284c7' : '#64748b'}
                roughness={0.45}
                metalness={0.3}
              />
            </mesh>
            {active && (
              <mesh position={[0, 2.05, 0]}>
                <coneGeometry args={[0.64, 1.0, 8]} />
                <meshStandardMaterial
                  color="#38bdf8"
                  emissive="#0ea5e9"
                  emissiveIntensity={0.45}
                />
              </mesh>
            )}
          </group>
        )
      })}

      {/* ── 3. O COMANDANTE 3D DA PONTE + ESQUADRÃO DE ESCOLTA NO MUNDO ABERTO ── */}
      <group ref={commanderGroupRef} name="OpenWorldCommander3D">
        {/* Insígnia 3D da Engine Ativa e Nível da Cidadela sobre o Comandante */}
        {OPEN_WORLD_ENGINE_PORTALS.map((portal) => {
          if (activeEngineId !== portal.engineId) return null
          const totalCitadelLvl = (
            Object.keys(OPEN_WORLD_CITADEL_3D_COORDS) as CitadelBuildingId[]
          ).reduce((acc, id) => acc + (save.citadelLevels[id] ?? 0), 0)
          const selectedCoord =
            OPEN_WORLD_REGION_3D_COORDS[save.selectedRegionId] ??
            REGION_LIST[0]
          void selectedCoord
          return (
            <mesh
              key={`ow_portal_${portal.engineId}`}
              position={[0, 2.38, 0]}
            >
              <octahedronGeometry
                args={[0.18 + Math.min(0.1, totalCitadelLvl * 0.008), 0]}
              />
              <meshStandardMaterial
                color={portal.color}
                emissive={portal.color}
                emissiveIntensity={0.9}
              />
            </mesh>
          )
        })}
        {/* Halo Tático Turquesa sob o Comandante */}
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.35, 24]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
        {/* Corpo e Capacete Dourado do Comandante (idêntico à Engine Ponte) */}
        <mesh position={[0, 0.75, 0]} castShadow>
          <capsuleGeometry args={[0.38, 0.72, 8, 12]} />
          <meshStandardMaterial
            color="#0284c7"
            emissive="#0369a1"
            emissiveIntensity={0.35}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.36, 12, 12]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.92, 0]}>
          <cylinderGeometry args={[0.26, 0.22, 0.24, 8]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#eab308"
            emissiveIntensity={0.5}
          />
        </mesh>
        {/* Soldados 3D da Escolta do Comandante */}
        {escortOffsets.map(([ox, oz], idx) => (
          <group key={`escort_${idx}`} position={[ox, 0, oz]}>
            <mesh position={[0, 0.55, 0]} castShadow>
              <capsuleGeometry args={[0.26, 0.48, 6, 10]} />
              <meshStandardMaterial color="#0d9488" roughness={0.5} />
            </mesh>
            <mesh position={[0, 1.12, 0]}>
              <sphereGeometry args={[0.24, 10, 10]} />
              <meshStandardMaterial color="#2dd4bf" roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── 7. BATALHÕES ALIADOS 3D EM MARCHA (EXPEDIÇÕES DE CONQUISTA) ── */}
      <group ref={alliedExpeditionsGroupRef} name="OpenWorldAlliedExpeditions3D">
        {Array.from({ length: 6 }).map((_, idx) => (
          <group key={`ally_exp_mesh_${idx}`} visible={false}>
            <mesh position={[0, 0.65, 0]} castShadow>
              <capsuleGeometry args={[0.35, 0.65, 8, 10]} />
              <meshStandardMaterial
                color="#10b981"
                emissive="#059669"
                emissiveIntensity={0.45}
              />
            </mesh>
            <mesh position={[-0.7, 0.5, 0.5]}>
              <capsuleGeometry args={[0.25, 0.45, 6, 8]} />
              <meshStandardMaterial color="#34d399" />
            </mesh>
            <mesh position={[0.7, 0.5, 0.5]}>
              <capsuleGeometry args={[0.25, 0.45, 6, 8]} />
              <meshStandardMaterial color="#34d399" />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── 8. ONDAS DE CERCO INIMIGAS 3D EM MARCHA (CONTRA-ATAQUES DO TERRITÓRIO INIMIGO) ── */}
      <group ref={enemyInvasionsGroupRef} name="OpenWorldEnemyInvasions3D">
        {Array.from({ length: 6 }).map((_, idx) => (
          <group key={`enemy_inv_mesh_${idx}`} visible={false}>
            <mesh position={[0, 0.7, 0]} castShadow>
              <capsuleGeometry args={[0.38, 0.68, 8, 10]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#dc2626"
                emissiveIntensity={0.55}
              />
            </mesh>
            <mesh position={[-0.75, 0.52, -0.45]}>
              <capsuleGeometry args={[0.26, 0.48, 6, 8]} />
              <meshStandardMaterial color="#f87171" />
            </mesh>
            <mesh position={[0.75, 0.52, 0.45]}>
              <capsuleGeometry args={[0.26, 0.48, 6, 8]} />
              <meshStandardMaterial color="#f87171" />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── 9. PROJÉTEIS DEFENSIVOS 3D DAS TORRES DA CIDADELA ── */}
      <group ref={defenseBoltsGroupRef} name="OpenWorldDefenseBolts3D">
        {Array.from({ length: 10 }).map((_, idx) => (
          <mesh key={`ow_def_bolt_${idx}`} visible={false}>
            <sphereGeometry args={[0.32, 8, 8]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={1.1}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export const OpenWorldBase3D: React.FC = () => {
  const selectedRegionId = useLogicBattleStore((s) => s.save.selectedRegionId)
  const conqueredIds = useLogicBattleStore((s) => s.save.conqueredRegionIds)
  const reserveTroops = useLogicBattleStore((s) => s.save.reserveTroops)
  const enemyBaseLevel = useLogicBattleStore((s) => s.enemyBaseLevel)
  const attackRegionDirect = useLogicBattleStore((s) => s.attackRegionDirect)

  const [webglSupported] = useState<boolean>(() => canCreateWebGLContext())
  const simRef = useRef<OpenWorldSimState>(
    createInitialOpenWorldSimState(enemyBaseLevel),
  )
  const [, setHudTick] = useState(0)

  // Sempre que o jogador seleciona uma província ou construção, o Comandante 3D caminha na direção dela!
  useEffect(() => {
    const coord = OPEN_WORLD_REGION_3D_COORDS[selectedRegionId]
    if (coord) {
      simRef.current.commanderTargetX = Math.max(-18, Math.min(20, coord.x * 0.65))
      simRef.current.commanderTargetZ = Math.max(
        -12,
        Math.min(12, coord.z * 0.68 - 1.55),
      )
    }
  }, [selectedRegionId])

  // Suporte a movimentação por teclado (WASD / Setas) do Comandante 3D no Mundo Aberto
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (useLogicBattleStore.getState().world !== 'realm') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const step = 3.2
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        simRef.current.commanderTargetX = Math.max(
          -22,
          simRef.current.commanderTargetX - step,
        )
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        simRef.current.commanderTargetX = Math.min(
          24,
          simRef.current.commanderTargetX + step,
        )
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        simRef.current.commanderTargetZ = Math.max(
          -14,
          simRef.current.commanderTargetZ - step,
        )
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        simRef.current.commanderTargetZ = Math.min(
          14,
          simRef.current.commanderTargetZ + step,
        )
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Loop Determinístico 60Hz do Mundo Aberto 3D + Telemetria e Hooks E2E
  useEffect(() => {
    let rafId = 0
    let lastTime = performance.now()
    let uiCounter = 0

    const publishTelemetry = () => {
      if (typeof window === 'undefined') return
      const st = useLogicBattleStore.getState()
      const sim = simRef.current
      const win = window as unknown as {
        __lbOpenWorld3DTelemetry?: Record<string, unknown>
        __lbSteerOpenWorldCommander?: (x: number, z: number) => void
        __lbDispatchOpenWorldBattalionForAudit?: (
          regionId?: string,
          troops?: number,
        ) => {
          dispatched: boolean
          expeditionsDispatchedCount: number
          conqueredCount: number
          reserveTroops: number
        }
        __lbSpawnEnemyInvasionForAudit?: (originRegionId?: string) => {
          invasionId: string
          activeInvasionsCount: number
          enemyRealmThreatLevel: number
        }
        __lbEvolveEnemyRealmForAudit?: () => {
          enemyRealmThreatLevel: number
          spawnedInvasionId: string
        }
      }

      win.__lbSteerOpenWorldCommander = (x: number, z: number) => {
        sim.commanderTargetX = x
        sim.commanderTargetZ = z
        sim.commanderX = x
        sim.commanderZ = z
        publishTelemetry()
      }

      win.__lbDispatchOpenWorldBattalionForAudit = (
        regionId = st.save.selectedRegionId,
        troops,
      ) => {
        const reg = REGIONS[regionId] ?? REGIONS.reg_ponte_leste
        const needed = troops ?? reg.garrison + 1
        spawnAlliedExpeditionWave(
          sim,
          reg.id,
          needed,
          needed === reg.garrison + 1,
        )
        const res = useLogicBattleStore
          .getState()
          .attackRegionDirect(reg.id, needed)
        if (res.success) {
          sim.territoriesConqueredInOpenWorld += 1
        }
        publishTelemetry()
        return {
          dispatched: true,
          expeditionsDispatchedCount: sim.expeditionsDispatchedCount,
          conqueredCount:
            useLogicBattleStore.getState().save.conqueredRegionIds.length,
          reserveTroops: useLogicBattleStore.getState().save.reserveTroops,
        }
      }

      win.__lbSpawnEnemyInvasionForAudit = (
        originRegionId = 'reg_ponte_leste',
      ) => {
        const wave = spawnEnemyCounterInvasionWave(
          sim,
          originRegionId,
          sim.enemyRealmThreatLevel,
        )
        publishTelemetry()
        return {
          invasionId: wave.id,
          activeInvasionsCount: sim.enemyInvasions.length,
          enemyRealmThreatLevel: sim.enemyRealmThreatLevel,
        }
      }

      win.__lbEvolveEnemyRealmForAudit = () => {
        const res = evolveOpenWorldEnemyThreat(sim)
        useLogicBattleStore
          .getState()
          .evolveEnemyBaseInMatch(res.enemyRealmThreatLevel)
        publishTelemetry()
        return res
      }

      win.__lbOpenWorld3DTelemetry = {
        webglSupported,
        commanderX: Number(sim.commanderX.toFixed(2)),
        commanderZ: Number(sim.commanderZ.toFixed(2)),
        commanderTargetX: Number(sim.commanderTargetX.toFixed(2)),
        commanderTargetZ: Number(sim.commanderTargetZ.toFixed(2)),
        enemyRealmThreatLevel: sim.enemyRealmThreatLevel,
        activeAlliedExpeditions: sim.alliedExpeditions.length,
        activeEnemyInvasions: sim.enemyInvasions.length,
        activeDefenseBolts: sim.defenseBolts.length,
        expeditionsDispatchedCount: sim.expeditionsDispatchedCount,
        territoriesConqueredInOpenWorld: sim.territoriesConqueredInOpenWorld,
        enemyInvasionsSpawnedCount: sim.enemyInvasionsSpawnedCount,
        enemyInvasionsRepelledCount: sim.enemyInvasionsRepelledCount,
        enemyInvasionsBreachedCount: sim.enemyInvasionsBreachedCount,
        conqueredRegionsCount: st.save.conqueredRegionIds.length,
        sharedWalletBalance: st.getSharedWalletBalance(),
        citadelLevels: { ...st.save.citadelLevels },
        playerBridgeTowerLevels: [...st.playerBridgeTowerLevels],
      }
    }

    const tick = (now: number) => {
      const dt = Math.min(0.08, Math.max(0.004, (now - lastTime) / 1000))
      lastTime = now
      const st = useLogicBattleStore.getState()

      stepOpenWorldRealmSim(
        simRef.current,
        dt,
        {
          selectedRegionId: st.save.selectedRegionId,
          conqueredRegionIds: st.save.conqueredRegionIds,
          citadelLevels: st.save.citadelLevels,
          playerBridgeTowerLevels: st.playerBridgeTowerLevels,
        },
        {
          onExpeditionReachedTarget: (regionId, troopsCommitted) => {
            const cur = useLogicBattleStore.getState()
            if (!cur.save.conqueredRegionIds.includes(regionId)) {
              cur.attackRegionDirect(regionId, troopsCommitted)
            }
          },
          onEnemyInvasionRepelled: (bonusTroops) => {
            const cur = useLogicBattleStore.getState()
            useLogicBattleStore.setState({
              save: {
                ...cur.save,
                reserveTroops: cur.save.reserveTroops + bonusTroops,
              },
            })
          },
          onEnemyInvasionBreached: (tollTroops) => {
            const cur = useLogicBattleStore.getState()
            useLogicBattleStore.setState({
              save: {
                ...cur.save,
                reserveTroops: Math.max(5, cur.save.reserveTroops - tollTroops),
              },
            })
          },
          onEnemyThreatEvolved: (newThreat) => {
            useLogicBattleStore.getState().evolveEnemyBaseInMatch(newThreat)
          },
        },
      )

      publishTelemetry()
      uiCounter += 1
      if (uiCounter % 12 === 0) {
        setHudTick((v) => (v + 1) % 1000)
      }
      rafId = window.requestAnimationFrame(tick)
    }

    publishTelemetry()
    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [webglSupported])

  const selectedRegion =
    REGIONS[selectedRegionId] ?? REGIONS.reg_ponte_leste
  const isAttackable = canAttackRegion(selectedRegion.id, conqueredIds)
  const surgicalTroops = selectedRegion.garrison + 1
  const canAffordSurgical = isAttackable && reserveTroops >= surgicalTroops
  const sim = simRef.current

  const handleDispatchSurgicalOpenWorld = () => {
    spawnAlliedExpeditionWave(simRef.current, selectedRegion.id, surgicalTroops, true)
    const res = attackRegionDirect(selectedRegion.id, surgicalTroops)
    if (res.success) {
      simRef.current.territoriesConqueredInOpenWorld += 1
    }
    setHudTick((v) => v + 1)
  }

  return (
    <div
      className="lb-open-world-base-3d"
      data-testid="lb-open-world-base-3d"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      <style>{`
        .lb-open-world-canvas-layer,
        .lb-open-world-canvas-layer * {
          pointer-events: none !important;
        }
      `}</style>
      {webglSupported && (
        <div
          className="lb-open-world-canvas-layer"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          <Canvas
            shadows
            gl={{ alpha: true, antialias: true }}
            camera={{ position: [0, 26, 24], fov: 42 }}
            style={{
              width: '100%',
              height: '100%',
              opacity: 1,
              pointerEvents: 'none',
            }}
          >
            <OpenWorldSceneContent simRef={simRef} />
          </Canvas>
        </div>
      )}

      {/* Barra Tática Compacta do Mundo Aberto 3D (Conquista Direta + Defesa Territorial) */}
      <div
        data-testid="lb-openworld-command-bar"
        style={{
          position: 'absolute',
          top: '54px',
          left: '12px',
          zIndex: 25,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(56, 189, 248, 0.45)',
          color: '#f8fafc',
          fontSize: '11px',
          fontWeight: 800,
          boxShadow: '0 6px 18px rgba(2, 6, 23, 0.5)',
        }}
      >
        <span
          data-testid="lb-openworld-status-pill"
          title="Comandante da Ponte em Mundo Aberto 3D (WASD / Clique em Províncias)"
          style={{ color: '#38bdf8' }}
        >
          🌐 3D ({conqueredIds.length}/12) · 💀 Nv.{sim.enemyRealmThreatLevel}
        </span>

        <button
          type="button"
          data-testid="lb-openworld-dispatch-btn"
          disabled={!canAffordSurgical}
          onClick={handleDispatchSurgicalOpenWorld}
          title={`Despachar Batalhão 3D (${surgicalTroops} soldados, Precisão Cirúrgica G+1) para conquistar ${selectedRegion.name}`}
          style={{
            padding: '3px 8px',
            borderRadius: '8px',
            border: '1px solid rgba(16, 185, 129, 0.65)',
            background: canAffordSurgical
              ? 'linear-gradient(135deg, #059669, #10b981)'
              : 'rgba(51, 65, 85, 0.6)',
            color: '#fff',
            fontSize: '10.5px',
            fontWeight: 900,
            cursor: canAffordSurgical ? 'pointer' : 'not-allowed',
          }}
        >
          ⚔️ Expedição 3D ({surgicalTroops})
        </button>
      </div>
    </div>
  )
}

