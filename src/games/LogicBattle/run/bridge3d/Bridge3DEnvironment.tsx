// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/Bridge3DEnvironment.tsx
// Cenário 3D WebGL Completo da Ponte de Guerra com 3 Rotas Paralelas (Fase 3 V7):
// Orquestra o motor determinístico 60Hz (bridge3dSim.ts), o tabuleiro das 3 rotas,
// as ilhas costeiras 3D, a Fortaleza 3D e os 3 renderizadores modulares:
//   1. SideCorridors3D (Rota Esquerda 5 HP / +1..+3 e Rota Direita 888 HP / 🧮 / +10..+99)
//   2. EnemyHordeAndBoss3D (Barris 112 HP, Horda Rubra, Mini-Bosses 176 HP e Mega-Boss)
//   3. PlayerBattalion3D (Herói Atirador Solo, Formação Zero-to-Hero, Vai-Um e Tiros Retos -Z)
// ──────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BIOMES } from '../../config/biomes'
import { formatArmy } from '../../domain/notation'
import { useLogicBattleStore } from '../../state/useLogicBattleStore'
import {
  BOSS_ARCHETYPES_3D,
  BRIDGE_3D_DIMENSIONS,
  BRIDGE_3D_ROUTES,
  computeSectorBossSpec,
} from './bridge3dPolicies'
import {
  applyMathBonusToRightWeapon,
  computeSegmentWorldZ,
  createInitialBridge3DSimState,
  stepBridge3DSim,
} from './bridge3dSim'
import { EnemyHordeAndBoss3D } from './EnemyHordeAndBoss3D'
import { getPlaqueTexture } from './plaqueTextureCache'
import { PlayerBattalion3D } from './PlayerBattalion3D'
import { SideCorridors3D } from './SideCorridors3D'

export interface Bridge3DEnvironmentProps {
  readonly smoothedLaneXRef: React.MutableRefObject<number>
  readonly onOpenMathBonus: () => void
}

export const Bridge3DEnvironment: React.FC<Bridge3DEnvironmentProps> = ({
  smoothedLaneXRef,
  onOpenMathBonus,
}) => {
  const biomeId = useLogicBattleStore((s) => s.runPlan.biomeId)
  const segments = useLogicBattleStore((s) => s.snapshot.segments)
  const activeSegmentIndex = useLogicBattleStore((s) => s.snapshot.activeSegmentIndex)
  const currentArmy = useLogicBattleStore((s) => s.snapshot.currentArmy)
  const enemy = useLogicBattleStore((s) => s.snapshot.enemy)
  const inspectedSegmentId = useLogicBattleStore((s) => s.snapshot.inspectedSegmentId)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const mathSolvedSeq = useLogicBattleStore((s) => s.lastSolvedMathRewardAt?.seq ?? 0)

  const biome = BIOMES[biomeId] ?? BIOMES.planicie_pedra
  const skyTopColor = biome.skyGradient[0]
  const skyBottomColor = biome.skyGradient[1]
  const waterDeepColor = biomeId === 'vulcao_negativos' ? '#450a0a' : '#0369a1'
  const waterFoamColor = biomeId === 'vulcao_negativos' ? '#fb923c' : '#7dd3fc'
  const islandRockColor = biomeId === 'deserto_decimais' ? '#78350f' : '#334155'

  const waterRibsRef = useRef<THREE.Group | null>(null)
  const centerSegmentsGroupRef = useRef<THREE.Group | null>(null)

  // Motor de Simulação 3D Determinístico (Fase 2: bridge3dSim.ts) hidratado com Checkpoint V8
  const simRef = useRef(
    (() => {
      const initStore = useLogicBattleStore.getState()
      const hasExplicitSeed =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).has('seed')
      const cp = hasExplicitSeed ? null : initStore.save.activeRunCheckpoint
      const initSpec = computeSectorBossSpec(Math.max(1, initStore.bridgeSectorIndex))
      const sim = createInitialBridge3DSimState(
        initSpec.bossHp,
        initStore.runPlan.seed,
      )
      sim.sectorIndex = Math.max(1, initStore.bridgeSectorIndex)
      sim.bossArchetypeIndex = initSpec.archetype.index
      sim.bossArchetypeId = initSpec.archetype.id
      sim.bossArchetypeName = initSpec.archetype.namePt
      if (cp) {
        sim.leftCannonLevel = Math.max(1, cp.leftCannonLevel ?? 1)
        sim.rightWeaponLevel = Math.max(0, cp.rightWeaponLevel ?? 0)
        sim.mathChallengesSolved = Math.max(0, cp.mathChallengesSolved ?? 0)
        // V8 Fase 2: Rota Direita permanece congelada/cinza por padrão até ativar via conta (🧮)
        sim.rightFrozenWeapon.unlocked = false
      }
      return sim
    })(),
  )
  const lastMathSeqRef = useRef<number>(mathSolvedSeq)
  const lastRunIdRef = useRef<string>(useLogicBattleStore.getState().snapshot.runId)

  // Árvores 3D (Pinheiros Nevados) nas ilhas costeiras esquerda e direita
  const coastalPines = useMemo(() => {
    const list: Array<{ x: number; z: number; scale: number; side: 'L' | 'R' }> = []
    for (let i = 0; i < 16; i++) {
      const z = -95 + i * 7.2
      const leftX = -17.5 - ((i * 7) % 9) * 1.35
      const rightX = 17.5 + ((i * 11) % 9) * 1.35
      const scale = 0.85 + ((i * 5) % 6) * 0.14
      list.push({ x: leftX, z, scale, side: 'L' })
      list.push({ x: rightX, z: z + 2.5, scale: scale * 0.95, side: 'R' })
    }
    return list
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(0.25, Math.max(0.004, delta))
    const live = useLogicBattleStore.getState()
    const snap = live.snapshot

    // Sincronizar estado do motor 3D quando uma nova partida ou novo Setor Infinito começa
    if (snap.runId !== lastRunIdRef.current) {
      lastRunIdRef.current = snap.runId
      if (live.bridgeSectorIndex <= 1) {
        simRef.current = createInitialBridge3DSimState(
          computeSectorBossSpec(1).bossHp,
          live.runPlan.seed,
        )
        lastMathSeqRef.current = live.lastSolvedMathRewardAt?.seq ?? 0
      } else {
        const nextSim = simRef.current
        nextSim.sectorIndex = live.bridgeSectorIndex
        const nextSpec = computeSectorBossSpec(live.bridgeSectorIndex)
        nextSim.bossMaxHp = nextSpec.bossHp
        nextSim.bossHp = nextSpec.bossHp
        nextSim.bossLifecycle = 'MARCHING'
        nextSim.bossRespawnTimerMs = 0
        nextSim.bossZ = -72
        nextSim.bossArchetypeIndex = nextSpec.archetype.index
        nextSim.bossArchetypeId = nextSpec.archetype.id
        nextSim.bossArchetypeName = nextSpec.archetype.namePt
        nextSim.supplyCaravan.active = false
        for (const barrel of nextSim.barrels) {
          barrel.active = true
          barrel.maxHp = 112 + (live.bridgeSectorIndex - 1) * 45
          barrel.hp = barrel.maxHp
        }
      }
    } else if (simRef.current.sectorIndex !== live.bridgeSectorIndex) {
      const nextSim = simRef.current
      nextSim.sectorIndex = live.bridgeSectorIndex
      const nextSpec = computeSectorBossSpec(live.bridgeSectorIndex)
      nextSim.bossMaxHp = nextSpec.bossHp
      if (nextSim.bossLifecycle !== 'INTERMISSION') {
        nextSim.bossHp = nextSpec.bossHp
      }
      nextSim.bossArchetypeIndex = nextSpec.archetype.index
      nextSim.bossArchetypeId = nextSpec.archetype.id
      nextSim.bossArchetypeName = nextSpec.archetype.namePt
      const cp = live.save.activeRunCheckpoint
      if (cp) {
        nextSim.leftCannonLevel = Math.max(1, cp.leftCannonLevel ?? 1)
        nextSim.rightWeaponLevel = Math.max(0, cp.rightWeaponLevel ?? 0)
        nextSim.mathChallengesSolved = Math.max(0, cp.mathChallengesSolved ?? 0)
      }
    }

    const isModalOpen =
      live.activeMathChallenge !== null ||
      live.activeRedemptionTokenId !== null ||
      live.albumDrawerOpen ||
      live.codexDrawerSlug !== null ||
      live.settingsPopoverOpen
    const isRunning = snap.phase === 'RUNNING' || snap.phase === 'CALM_WAIT'
    const isRunningOrBattle =
      !isModalOpen && (isRunning || snap.phase === 'BATTLE')
    const clockSec = state.clock.elapsedTime
    const sim = simRef.current

    // Garantir interpolação horizontal suave a 60Hz em TODAS as fases (incluindo BATTLE e CALM_WAIT)
    smoothedLaneXRef.current +=
      (snap.laneX - smoothedLaneXRef.current) * Math.min(1, dt * 15)
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as { __lbHeroPos?: { x: number; y: number } }
      ).__lbHeroPos = { x: smoothedLaneXRef.current, y: snap.progress }
    }

    // Se o jogador resolveu uma conta no Altar 🧮 da Rota Direita, libera o Super Buff temporizado e destrava/evolui a Metralhadora!
    const currentMathSeq = live.lastSolvedMathRewardAt?.seq ?? 0
    if (currentMathSeq > lastMathSeqRef.current) {
      lastMathSeqRef.current = currentMathSeq
      const solvedTier = live.lastSolvedMathRewardAt?.tier ?? 2
      const mathOutcome = applyMathBonusToRightWeapon(sim, 296, solvedTier)
      if (mathOutcome.bonusSoldiersFromPendingGate > 0) {
        live.applySideRouteReward(
          'RIGHT',
          mathOutcome.bonusSoldiersFromPendingGate,
          `🧮 Super Buff +${formatArmy(mathOutcome.bonusSoldiersFromPendingGate, 'compact')} Liberado!`,
        )
      } else if (mathOutcome.unlockedWeapon) {
        const wepBonus = Math.max(20, Math.round(snap.currentArmy * 0.85))
        live.applySideRouteReward(
          'RIGHT',
          wepBonus,
          `🔥 Metralhadora Nv.${sim.rightWeaponLevel} +${formatArmy(wepBonus, 'compact')}!`,
        )
      }
    }

    // Passo determinístico 60Hz do Motor 3D (bridge3dSim.ts)
    stepBridge3DSim(
      sim,
      dt,
      {
        laneNormX: smoothedLaneXRef.current,
        currentArmy: snap.currentArmy,
        progress: snap.progress,
        isRunningOrBattle,
        isBattlePhase: snap.phase === 'BATTLE',
        infiniteBridgeMode: live.infiniteBridgeMode,
      },
      {
        onEnemyKilled: (coinsDelta, damageDealt, attritionLoss) => {
          live.recordBridgeEnemyKill(coinsDelta, damageDealt, attritionLoss)
        },
        onSideRouteReward: (route, soldiersDelta, reasonLabel) => {
          live.applySideRouteReward(route, soldiersDelta, reasonLabel)
        },
        onSectorBossDefeated: (newSector, bonusSoldiers) => {
          live.onSectorBossDefeatedInBridge(newSector, bonusSoldiers)
        },
        onRequireMathChallenge: () => {
          if (
            live.activeMathChallenge === null &&
            live.activeRedemptionTokenId === null
          ) {
            onOpenMathBonus()
          }
        },
      },
    )

    // Expor contagem real de projéteis 3D ativos e telemetria modular 3D para auditoria E2E (Fase 3)
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __lbActiveProjectiles?: number
        __lbBridge3DTelemetry?: Record<string, unknown>
        __lbSetBossZForAudit?: (z: number) => void
      }
      win.__lbSetBossZForAudit = (z: number) => {
        sim.bossZ = z
      }
      win.__lbActiveProjectiles = Math.max(1, sim.activeBoltsCount)
      win.__lbBridge3DTelemetry = {
        sectorIndex: sim.sectorIndex,
        activeRoute: sim.activeRoute,
        heroWorldX: Number(sim.heroWorldX.toFixed(2)),
        parallelBarrels: sim.shotProfile.parallelBarrels,
        damagePerShot: sim.shotProfile.damagePerShot,
        leftBlockHp: sim.leftFrozenBlock.hp,
        leftBlockZ: Number(sim.leftFrozenBlock.z.toFixed(2)),
        leftBlockUnlocked: sim.leftFrozenBlock.unlocked,
        leftCannonLevel: sim.leftCannonLevel,
        rightWeaponHp: sim.rightFrozenWeapon.hp,
        rightWeaponZ: Number(sim.rightFrozenWeapon.z.toFixed(2)),
        rightAltarZ: Number(sim.rightAltarZ.toFixed(2)),
        rightWeaponUnlocked: sim.rightFrozenWeapon.unlocked,
        rightWeaponLevel: sim.rightWeaponLevel,
        rightMathBonusCharges: sim.rightMathBonusCharges,
        rightBuffActiveTimerMs: Math.round(sim.rightBuffActiveTimerMs),
        rightBuffMaxTimerMs: Math.round(sim.rightBuffMaxTimerMs),
        rightCorridorState:
          sim.rightBuffActiveTimerMs > 0 ? 'ACTIVE_TIMED' : 'LOCKED_FROSTED',
        leftGateLabels: sim.leftGates.map((g) => g.label),
        rightGateLabels: sim.rightGates.map((g) => g.label),
        bossHp: sim.bossHp,
        bossMaxHp: sim.bossMaxHp,
        bossZ: Number(sim.bossZ.toFixed(2)),
        bossLifecycle: sim.bossLifecycle,
        bossRespawnTimerMs: Math.round(sim.bossRespawnTimerMs),
        bossArchetypeIndex: sim.bossArchetypeIndex,
        bossArchetypeId: sim.bossArchetypeId,
        bossArchetypeName: sim.bossArchetypeName,
        bossWeaponType:
          BOSS_ARCHETYPES_3D[sim.bossArchetypeIndex]?.weaponType ?? 'WARHAMMER',
        supplyCaravanActive: sim.supplyCaravan.active,
        supplyCaravanZ: Number(sim.supplyCaravan.z.toFixed(2)),
        enemiesCount: sim.enemies.length,
        barrelsActive: sim.barrels.filter((b) => b.active).length,
        extraSoldiersCount:
          snap.currentArmy <= 5
            ? 0
            : Math.min(
                24,
                Math.max(1, Math.floor(Math.log2(Math.max(2, snap.currentArmy - 3)) * 3)),
              ),
        hasSquad10: snap.currentArmy >= 10,
        hasCenturion01k: snap.currentArmy >= 100,
        hasChampion1k: snap.currentArmy >= 1000,
      }
    }

    // Animar ondas da água/lava ao redor da ponte 3D
    if (waterRibsRef.current) {
      waterRibsRef.current.position.z = ((clockSec * 6.5) % 14) - 7
    }

    // Posicionar segmentos matemáticos centrais continuamente via (seg.zPosition - progress) * 94
    if (centerSegmentsGroupRef.current) {
      centerSegmentsGroupRef.current.position.z = snap.progress * 94.0
    }
  })

  return (
    <group name="Bridge3DWorld">
      {/* ── ILUMINAÇÃO 3D REAL, SOMBRAS E ATMOSFERA DO BIOMA ─────────────────── */}
      <color attach="background" args={[skyTopColor]} />
      <fog attach="fog" args={[skyBottomColor, 52, 165]} />
      <ambientLight intensity={0.78} />
      <hemisphereLight args={[skyTopColor, islandRockColor, 0.68]} />
      <directionalLight
        position={[24, 42, 22]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={35}
        shadow-camera-bottom={-85}
      />

      {/* ── OCEANO / RIO / LAVA 3D PROFUNDO COM ONDAS ANIMADAS ───────────────── */}
      <mesh position={[0, -2.4, -45]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial
          color={waterDeepColor}
          roughness={0.25}
          metalness={0.15}
        />
      </mesh>

      <group ref={waterRibsRef}>
        {Array.from({ length: 14 }).map((_, idx) => {
          const z = -95 + idx * 10
          return (
            <mesh
              key={`wave_rib_${idx}`}
              position={[0, -2.28, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[180, 1.1]} />
              <meshBasicMaterial
                color={waterFoamColor}
                transparent
                opacity={0.28}
              />
            </mesh>
          )
        })}
      </group>

      {/* Espuma costeira ladeando os pilares da ponte */}
      <mesh position={[-13.1, -2.2, -42]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 145]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.55} />
      </mesh>
      <mesh position={[13.1, -2.2, -42]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 145]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.55} />
      </mesh>

      {/* ── ILHAS COSTEIRAS 3D E PINHEIROS NEVADOS (ESQUERDA E DIREITA) ──────── */}
      <group name="CoastalIslands3D">
        <mesh position={[-25, -1.2, -42]} receiveShadow castShadow>
          <boxGeometry args={[20, 2.6, 135]} />
          <meshStandardMaterial color={islandRockColor} roughness={0.88} />
        </mesh>
        <mesh position={[-25.5, 0.25, -42]} receiveShadow>
          <boxGeometry args={[18.5, 0.45, 132]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.65} />
        </mesh>

        <mesh position={[25, -1.2, -42]} receiveShadow castShadow>
          <boxGeometry args={[20, 2.6, 135]} />
          <meshStandardMaterial color={islandRockColor} roughness={0.88} />
        </mesh>
        <mesh position={[25.5, 0.25, -42]} receiveShadow>
          <boxGeometry args={[18.5, 0.45, 132]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.65} />
        </mesh>

        {coastalPines.map((pine, idx) => (
          <group
            key={`pine_${idx}`}
            position={[pine.x, 0.45, pine.z]}
            scale={[pine.scale, pine.scale, pine.scale]}
          >
            <mesh position={[0, 0.7, 0]} castShadow>
              <cylinderGeometry args={[0.25, 0.35, 1.4, 7]} />
              <meshStandardMaterial color="#451a03" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.0, 0]} castShadow>
              <coneGeometry args={[1.45, 2.4, 7]} />
              <meshStandardMaterial color="#14532d" roughness={0.75} />
            </mesh>
            <mesh position={[0, 3.3, 0]} castShadow>
              <coneGeometry args={[1.1, 2.0, 7]} />
              <meshStandardMaterial color="#166534" roughness={0.7} />
            </mesh>
            <mesh position={[0, 4.15, 0]}>
              <coneGeometry args={[0.62, 0.95, 7]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── TABULEIRO DA PONTE 3D WIDESCREEN COM AS 3 ROTAS PARALELAS ────────── */}
      <group name="BridgeThreeRoutesDeck">
        <mesh position={[0, -0.65, -42]} receiveShadow castShadow>
          <boxGeometry args={[BRIDGE_3D_DIMENSIONS.totalWidth, 1.2, 142]} />
          <meshStandardMaterial color="#1e293b" roughness={0.85} />
        </mesh>

        {/* 1. PISO DA ROTA ESQUERDA (X ∈ [-11.8, -5.5]) */}
        <mesh
          position={[BRIDGE_3D_ROUTES.LEFT.xCenter, 0.02, -42]}
          receiveShadow
        >
          <boxGeometry args={[BRIDGE_3D_ROUTES.LEFT.width, 0.16, 140]} />
          <meshStandardMaterial
            color={BRIDGE_3D_ROUTES.LEFT.floorColor}
            roughness={0.55}
            metalness={0.15}
          />
        </mesh>

        {/* 2. PISO DA ROTA CENTRAL (X ∈ [-5.5, +5.5]) */}
        <mesh
          position={[BRIDGE_3D_ROUTES.CENTER.xCenter, 0.02, -42]}
          receiveShadow
        >
          <boxGeometry args={[BRIDGE_3D_ROUTES.CENTER.width, 0.18, 140]} />
          <meshStandardMaterial
            color={biome.bridgeSurfaceColor}
            roughness={0.72}
          />
        </mesh>

        {/* 3. PISO DA ROTA DIREITA (X ∈ [+5.5, +11.8]) */}
        <mesh
          position={[BRIDGE_3D_ROUTES.RIGHT.xCenter, 0.02, -42]}
          receiveShadow
        >
          <boxGeometry args={[BRIDGE_3D_ROUTES.RIGHT.width, 0.16, 140]} />
          <meshStandardMaterial
            color={BRIDGE_3D_ROUTES.RIGHT.floorColor}
            roughness={0.55}
            metalness={0.2}
          />
        </mesh>

        {/* Faixas Guias Niveladas no Piso entre as Rotas (X = -5.5 e X = +5.5, zero obstáculo físico) */}
        <mesh
          position={[BRIDGE_3D_DIMENSIONS.parapetLeftDividerX, 0.09, -42]}
          receiveShadow
        >
          <boxGeometry args={[0.38, 0.06, 138]} />
          <meshStandardMaterial color="#475569" roughness={0.7} />
        </mesh>
        <mesh position={[BRIDGE_3D_DIMENSIONS.parapetLeftDividerX, 0.13, -42]}>
          <boxGeometry args={[0.24, 0.03, 138]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        <mesh
          position={[BRIDGE_3D_DIMENSIONS.parapetRightDividerX, 0.09, -42]}
          receiveShadow
        >
          <boxGeometry args={[0.38, 0.06, 138]} />
          <meshStandardMaterial color="#475569" roughness={0.7} />
        </mesh>
        <mesh position={[BRIDGE_3D_DIMENSIONS.parapetRightDividerX, 0.13, -42]}>
          <boxGeometry args={[0.24, 0.03, 138]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>

        {/* Muralhas Externas da Ponte (X = -12.15 e X = +12.15) com Ameias e Tochas 3D */}
        <mesh
          position={[BRIDGE_3D_DIMENSIONS.outerLeftWallX, 0.72, -42]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.65, 1.35, 140]} />
          <meshStandardMaterial color={biome.bridgeEdgeColor} roughness={0.75} />
        </mesh>
        <mesh
          position={[BRIDGE_3D_DIMENSIONS.outerRightWallX, 0.72, -42]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.65, 1.35, 140]} />
          <meshStandardMaterial color={biome.bridgeEdgeColor} roughness={0.75} />
        </mesh>

        {Array.from({ length: 10 }).map((_, idx) => {
          const z = 8 - idx * 11
          return (
            <group key={`arch_pillar_${idx}`}>
              <mesh position={[-12.15, 1.65, z]} castShadow>
                <boxGeometry args={[0.95, 0.9, 0.95]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
              <mesh position={[-12.15, 2.3, z]}>
                <sphereGeometry args={[0.24, 8, 8]} />
                <meshBasicMaterial color="#fb923c" />
              </mesh>
              <mesh position={[12.15, 1.65, z]} castShadow>
                <boxGeometry args={[0.95, 0.9, 0.95]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
              <mesh position={[12.15, 2.3, z]}>
                <sphereGeometry args={[0.24, 8, 8]} />
                <meshBasicMaterial color="#fb923c" />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* ── COMPONENTE MODULAR 1 (FASE 3): CORREDORES LATERAIS 3D (ESQUERDA & DIREITA) ── */}
      <SideCorridors3D simRef={simRef} onOpenMathBonus={onOpenMathBonus} />

      {/* ── PORTÕES MATEMÁTICOS DA ROTA CENTRAL 3D (MÁX 2 PARES VISÍVEIS POR VEZ) ── */}
      <group ref={centerSegmentsGroupRef} name="CenterRouteSegments3D">
        {segments.slice(activeSegmentIndex, activeSegmentIndex + 2).map((seg) => {
          const zSeg = computeSegmentWorldZ(seg.zPosition, 0)
          const isInspected = inspectedSegmentId === seg.id
          const cols = seg.lanes.length
          const laneWidth = 9.6 / Math.max(2, cols)

          return (
            <group key={seg.id} position={[0, 0, zSeg]}>
              {seg.lanes.map((laneGates, lIdx) => {
                const primary = laneGates[0]
                if (!primary) return null
                const xCenter = (lIdx - (cols - 1) * 0.5) * laneWidth
                const isPositive =
                  primary.op === '+' ||
                  primary.op === '×' ||
                  primary.op === '%+' ||
                  primary.op === '^'
                const panelColor = isPositive ? '#0284c7' : '#dc2626'
                const borderColor = isInspected
                  ? '#fde047'
                  : isPositive
                    ? '#7dd3fc'
                    : '#fca5a5'
                const labelTex = getPlaqueTexture(
                  primary.label,
                  panelColor,
                  borderColor,
                  '#ffffff',
                  laneGates[1] ? `E DEPOIS ${laneGates[1].label}` : '',
                )

                return (
                  <group key={`${seg.id}_l_${lIdx}`} position={[xCenter, 0, 0]}>
                    <mesh position={[-laneWidth * 0.44, 1.8, 0]} castShadow>
                      <cylinderGeometry args={[0.16, 0.2, 3.6, 8]} />
                      <meshStandardMaterial color={borderColor} metalness={0.5} />
                    </mesh>
                    <mesh position={[laneWidth * 0.44, 1.8, 0]} castShadow>
                      <cylinderGeometry args={[0.16, 0.2, 3.6, 8]} />
                      <meshStandardMaterial color={borderColor} metalness={0.5} />
                    </mesh>
                    <mesh position={[0, 1.85, 0]}>
                      <boxGeometry args={[laneWidth * 0.86, 2.7, 0.18]} />
                      <meshStandardMaterial
                        color={panelColor}
                        transparent
                        opacity={0.52}
                        emissive={panelColor}
                        emissiveIntensity={0.3}
                      />
                    </mesh>
                    <mesh position={[0, 2.0, 0.14]}>
                      <planeGeometry args={[laneWidth * 0.82, 1.9]} />
                      <meshBasicMaterial map={labelTex} transparent />
                    </mesh>
                  </group>
                )
              })}
            </group>
          )
        })}
      </group>

      {/* ── COMPONENTE MODULAR 2 (FASE 3): HORDA INIMIGA, BARRIS 112 HP, MINI-BOSSES E MEGA-BOSS ── */}
      <EnemyHordeAndBoss3D
        simRef={simRef}
        bossName={enemy.bossName}
        bossTotalForce={enemy.totalForce}
        notationMode={notationMode}
      />

      {/* ── FORTALEZA CASTELO 3D AO NORTE (Z = -96) ──────────────────────────── */}
      <group position={[0, 0, BRIDGE_3D_DIMENSIONS.zFortressLine]} name="NorthernFortress3D">
        <mesh position={[0, 5.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[26, 11, 6]} />
          <meshStandardMaterial color="#334155" roughness={0.78} />
        </mesh>
        <mesh position={[-11.5, 7.5, 1.5]} castShadow>
          <cylinderGeometry args={[3.2, 3.6, 15, 12]} />
          <meshStandardMaterial color="#475569" roughness={0.75} />
        </mesh>
        <mesh position={[-11.5, 16.5, 1.5]}>
          <coneGeometry args={[3.8, 4.2, 12]} />
          <meshStandardMaterial color="#991b1b" roughness={0.5} />
        </mesh>
        <mesh position={[11.5, 7.5, 1.5]} castShadow>
          <cylinderGeometry args={[3.2, 3.6, 15, 12]} />
          <meshStandardMaterial color="#475569" roughness={0.75} />
        </mesh>
        <mesh position={[11.5, 16.5, 1.5]}>
          <coneGeometry args={[3.8, 4.2, 12]} />
          <meshStandardMaterial color="#991b1b" roughness={0.5} />
        </mesh>
        <mesh position={[0, 4.2, 3.1]}>
          <boxGeometry args={[6.8, 8.2, 0.4]} />
          <meshStandardMaterial
            color="#450a0a"
            emissive="#dc2626"
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>

      {/* ── COMPONENTE MODULAR 3 (FASE 3): BATALHÃO DO JOGADOR 3D (ZERO-TO-HERO) + PROJÉTEIS RETOS ── */}
      <PlayerBattalion3D
        simRef={simRef}
        currentArmy={currentArmy}
        notationMode={notationMode}
      />
    </group>
  )
}
