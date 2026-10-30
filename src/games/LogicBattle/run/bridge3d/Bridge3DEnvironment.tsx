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
import { isLaneBeneficial } from '../../domain/armyMath'
import { formatArmy } from '../../domain/notation'
import { useLogicBattleStore } from '../../state/useLogicBattleStore'
import { resolveClosestCenterGateFromWorldX } from '../renderer/perspective'
import {
  BOSS_ARCHETYPES_3D,
  BRIDGE_3D_DIMENSIONS,
  BRIDGE_3D_ROUTES,
  CENTER_ROUTE_CADENCE_POLICY,
  computeSectorBossSpec,
  ENEMY_LIVING_BASE_POLICY,
  ENEMY_VS_PASSIVE_ROUTE_RATIO,
  laneNormToWorldX,
  PLAYER_BRIDGE_BASE_POLICY,
} from './bridge3dPolicies'
import {
  applyMathBonusToRightWeapon,
  computeSegmentWorldZ,
  createInitialBridge3DSimState,
  evolveEnemyLivingBase,
  stepBridge3DSim,
} from './bridge3dSim'
import { EnemyHordeAndBoss3D } from './EnemyHordeAndBoss3D'
import { getPlaqueTexture } from './plaqueTextureCache'
import { PlayerBattalion3D } from './PlayerBattalion3D'
import { SideCorridors3D } from './SideCorridors3D'
import { getSpriteAtlasCacheStats, getUnitSpriteTexture } from './spriteAtlasCache3D'

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
  const laneX = useLogicBattleStore((s) => s.snapshot.laneX)
  const enemy = useLogicBattleStore((s) => s.snapshot.enemy)
  const inspectedSegmentId = useLogicBattleStore((s) => s.snapshot.inspectedSegmentId)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const mathSolvedSeq = useLogicBattleStore((s) => s.lastSolvedMathRewardAt?.seq ?? 0)
  const playerBridgeTowerLevels = useLogicBattleStore((s) => s.playerBridgeTowerLevels)
  const enemyBaseLevel = useLogicBattleStore((s) => s.enemyBaseLevel)
  const isDeconstructingBridge = useLogicBattleStore((s) => s.isDeconstructingBridge)
  const deconstructionProgress = useLogicBattleStore((s) => s.deconstructionProgress)

  const biome = BIOMES[biomeId] ?? BIOMES.planicie_pedra
  const skyTopColor = biome.skyGradient[0]
  const skyBottomColor = biome.skyGradient[1]
  const waterDeepColor = biomeId === 'vulcao_negativos' ? '#450a0a' : '#0369a1'
  const waterFoamColor = biomeId === 'vulcao_negativos' ? '#fb923c' : '#7dd3fc'
  const islandRockColor = biomeId === 'deserto_decimais' ? '#78350f' : '#334155'

  const waterRibsRef = useRef<THREE.Group | null>(null)
  const centerSegmentsGroupRef = useRef<THREE.Group | null>(null)
  const bridgeDeckGroupRef = useRef<THREE.Group | null>(null)
  const enemyDebuffBoltsGroupRef = useRef<THREE.Group | null>(null)
  const alliedTowerBoltsGroupRef = useRef<THREE.Group | null>(null)
  const alliedTowersGroupRef = useRef<THREE.Group | null>(null)

  const towerIntactSpriteTex = useMemo(
    () => getUnitSpriteTexture('TOWER_EMBLEM_INTACT'),
    [],
  )
  const towerDamagedSpriteTex = useMemo(
    () => getUnitSpriteTexture('TOWER_EMBLEM_DAMAGED'),
    [],
  )
  const towerRuinedSpriteTex = useMemo(
    () => getUnitSpriteTexture('TOWER_EMBLEM_RUINED'),
    [],
  )

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
    const dt = Math.min(0.5, Math.max(0.004, delta))
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
        nextSim.fireCooldownSec = 0
        nextSim.activeBoltsCount = 0
        for (const bolt of nextSim.bolts) {
          bolt.active = false
        }
        for (const barrel of nextSim.barrels) {
          barrel.active = true
          barrel.maxHp = 450 + (live.bridgeSectorIndex - 1) * 220
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
      if (cp && live.bridgeSectorIndex > 1) {
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

    // Garantir interpolação horizontal responsiva a 60Hz em TODAS as fases (incluindo esquivas rápidas)
    const deltaLaneX = snap.laneX - smoothedLaneXRef.current
    if (Math.abs(deltaLaneX) > 0.45) {
      smoothedLaneXRef.current = snap.laneX
    } else {
      smoothedLaneXRef.current += deltaLaneX * Math.min(1, dt * 28)
    }
    if (typeof window !== 'undefined') {
      ; (
        window as unknown as { __lbHeroPos?: { x: number; y: number } }
      ).__lbHeroPos = { x: smoothedLaneXRef.current, y: snap.progress }
    }

    // Se o jogador resolveu uma conta no Altar 🧮 da Rota Direita, libera o Super Buff temporizado e destrava/evolui a Metralhadora!
    const currentMathSeq = live.lastSolvedMathRewardAt?.seq ?? 0
    if (currentMathSeq > lastMathSeqRef.current) {
      lastMathSeqRef.current = currentMathSeq
      const solvedTier = live.lastSolvedMathRewardAt?.tier ?? 2
      const mathOutcome = applyMathBonusToRightWeapon(sim, 296, solvedTier, {
        correctValue: live.lastSolvedMathRewardAt?.correctValue,
        expressionBadge: live.lastSolvedMathRewardAt?.expressionBadge,
        currentArmy: snap.currentArmy,
      })
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

    // Sincronizar evoluções manuais/externas da Base Inimiga com o motor 3D
    while (sim.enemyBaseLevel < live.enemyBaseLevel) {
      evolveEnemyLivingBase(sim)
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
        allSegmentsResolved:
          snap.segments.length > 0 &&
          Object.keys(snap.resolvedSegments).length >= snap.segments.length,
        playerBridgeTowerLevels: live.playerBridgeTowerLevels,
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
        onEnemyBaseEvolved: (newLevel) => {
          live.evolveEnemyBaseInMatch(newLevel)
        },
        onEnemyDebuffTowerHit: (lossRatio, label) => {
          live.applyEnemyDebuffTowerHit(lossRatio, label)
        },
        onDebuffBoltIntercepted: (label) => {
          live.recordDebuffBoltIntercepted(label)
        },
        onAlliedTowerDamaged: (slotIndex, remainingHp, maxHp, damage) => {
          live.applyBossDamageToBridgeTower(
            slotIndex,
            remainingHp,
            maxHp,
            damage,
          )
        },
        onAlliedTowerDestroyed: (slotIndex, newLevel, towerNamePt) => {
          live.applyBossDestroyBridgeTower(
            slotIndex,
            newLevel,
            towerNamePt,
          )
        },
        onBossStrikeHero: (damageSoldiers, bossName) => {
          live.recordBossStrikeHero(damageSoldiers, bossName)
        },
      },
    )

    // Expor contagem real de projéteis 3D ativos e telemetria modular 3D para auditoria E2E (Fase 3 / V9 / V10)
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __lbActiveProjectiles?: number
        __lbBridge3DTelemetry?: Record<string, unknown>
        __lbSetBossZForAudit?: (z: number) => void
        __lbEvolveEnemyBaseForAudit?: () => { enemyBaseLevel: number; activeTowersCount: number }
        __lbForceEnemyDebuffHitForAudit?: (lossRatio?: number, label?: string) => void
      }
      win.__lbSetBossZForAudit = (z: number) => {
        simRef.current.bossZ = z
        if (win.__lbBridge3DTelemetry) {
          win.__lbBridge3DTelemetry.bossZ = Number(z.toFixed(2))
        }
      }
      win.__lbEvolveEnemyBaseForAudit = () => {
        const res = evolveEnemyLivingBase(simRef.current)
        useLogicBattleStore.getState().evolveEnemyBaseInMatch(res.enemyBaseLevel)
        return res
      }
      win.__lbForceEnemyDebuffHitForAudit = (
        lossRatio = 0.15,
        label = '−15% MALDIÇÃO',
      ) => {
        simRef.current.enemyDebuffHitsCount += 1
        useLogicBattleStore.getState().applyEnemyDebuffTowerHit(lossRatio, label)
      }
      const visibleCenterSlice = snap.segments.slice(
        snap.activeSegmentIndex,
        snap.activeSegmentIndex + CENTER_ROUTE_CADENCE_POLICY.maxSimultaneousVisibleSegments,
      )
      win.__lbActiveProjectiles = Math.max(1, sim.activeBoltsCount)
      win.__lbBridge3DTelemetry = {
        sectorIndex: sim.sectorIndex,
        activeRoute: sim.activeRoute,
        heroWorldX: Number(sim.heroWorldX.toFixed(2)),
        parallelBarrels: sim.shotProfile.parallelBarrels,
        damagePerShot: sim.shotProfile.damagePerShot,
        shotsPerSecond: sim.shotProfile.shotsPerSecond,
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
        rightActiveTier: sim.rightActiveTier,
        rightActiveQuestionValue: sim.rightActiveQuestionValue,
        rightActiveExpressionBadge: sim.rightActiveExpressionBadge,
        rightActiveBuffLabel: sim.rightActiveBuffLabel,
        rightPiercingShots: sim.rightPiercingShots,
        mathChallengesSolved: sim.mathChallengesSolved,
        rightCorridorState:
          sim.rightBuffActiveTimerMs > 0 ? 'ACTIVE_TIMED' : 'LOCKED_FROSTED',
        leftGateLabels: sim.leftGates.map((g) => g.label),
        leftGateSubLabels: sim.leftGates.map((g) => g.subLabel ?? ''),
        rightGateLabels: sim.rightGates.map((g) => g.label),
        rightGateSubLabels: sim.rightGates.map((g) => g.subLabel ?? ''),
        centerSegmentsCount: snap.segments.length,
        visibleCenterSegmentsCount: visibleCenterSlice.length,
        centerTargetGateIntervalSec: CENTER_ROUTE_CADENCE_POLICY.targetGateIntervalSec,
        centerProgress: Number(snap.progress.toFixed(4)),
        centerActiveSegmentIndex: snap.activeSegmentIndex,
        centerFirstVisibleGateZ: Number(
          computeSegmentWorldZ(
            snap.segments[snap.activeSegmentIndex]?.zPosition ?? 0.1429,
            snap.progress,
          ).toFixed(2),
        ),
        bossHp: sim.bossHp,
        bossMaxHp: sim.bossMaxHp,
        enemyVsPassiveRouteRatio: ENEMY_VS_PASSIVE_ROUTE_RATIO,
        passiveRouteBaselineForce: computeSectorBossSpec(sim.sectorIndex)
          .passiveRouteBaselineForce,
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
        enemyBaseLevel: sim.enemyBaseLevel,
        enemyDebuffTowersActive: sim.enemyDebuffTowers.filter((t) => t.active).length,
        enemyDebuffHitsCount: sim.enemyDebuffHitsCount,
        debuffBoltsInterceptedCount: sim.debuffBoltsInterceptedCount,
        debuffBoltsDodgedCount: sim.debuffBoltsDodgedCount,
        closestCenterGateLane: resolveClosestCenterGateFromWorldX(
          sim.heroWorldX,
          (snap.segments[snap.activeSegmentIndex]?.lanes.length ?? 2) === 3 ? 3 : 2,
        ).chosenLane,
        closestCenterGateCenterX: resolveClosestCenterGateFromWorldX(
          sim.heroWorldX,
          (snap.segments[snap.activeSegmentIndex]?.lanes.length ?? 2) === 3 ? 3 : 2,
        ).gateCenterX,
        closestCenterGateDistance: Number(
          resolveClosestCenterGateFromWorldX(
            sim.heroWorldX,
            (snap.segments[snap.activeSegmentIndex]?.lanes.length ?? 2) === 3 ? 3 : 2,
          ).distanceToCenter.toFixed(2),
        ),
        playerBridgeTowerLevels: [...sim.playerBridgeTowerLevels],
        playerBridgeTowerHp: [...sim.playerBridgeTowerHp],
        playerBridgeTowerMaxHp: [...sim.playerBridgeTowerMaxHp],
        towerShotsFiredCount: sim.towerShotsFiredCount,
        towerKillsCount: sim.towerKillsCount,
        bossVanguardShieldActive: sim.bossVanguardShieldActive,
        bossTowerAttacksCount: sim.bossTowerAttacksCount,
        bossHeroStrikesCount: sim.bossHeroStrikesCount,
        playerBridgeTowerDestroyedCount: sim.playerBridgeTowerDestroyedCount,
        spriteAtlasCachedCount: getSpriteAtlasCacheStats().cachedTexturesCount,
        barrelPositionsZ: sim.barrels.map((b) => Number(b.z.toFixed(2))),
        miniBossPositionsZ: sim.enemies
          .filter((e) => e.isMiniBoss)
          .map((e) => Number(e.z.toFixed(2))),
        isDeconstructingBridge: live.isDeconstructingBridge,
        deconstructionProgress: live.deconstructionProgress,
        deconstructionCompletedCount: live.deconstructionCompletedCount,
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

    // Posicionar o par único de portões da Rota Central continuamente via CENTER_ROUTE_CADENCE_POLICY.worldSpanZ
    if (centerSegmentsGroupRef.current) {
      centerSegmentsGroupRef.current.position.z =
        snap.progress * CENTER_ROUTE_CADENCE_POLICY.worldSpanZ
    }

    // Animar projéteis de debuff disparados pelas Torres Inimigas
    if (enemyDebuffBoltsGroupRef.current) {
      const children = enemyDebuffBoltsGroupRef.current.children
      for (let i = 0; i < sim.enemyDebuffBolts.length; i++) {
        const boltData = sim.enemyDebuffBolts[i]
        const mesh = children[i] as THREE.Object3D | undefined
        if (!mesh) continue
        mesh.visible = boltData.active
        if (boltData.active) {
          mesh.position.set(boltData.x, boltData.y, boltData.z)
        }
      }
    }

    // Animar projéteis disparados pelas 4 Torres Aliadas da Ponte contra a Horda/Mini-Bosses
    if (alliedTowerBoltsGroupRef.current) {
      const children = alliedTowerBoltsGroupRef.current.children
      for (let i = 0; i < sim.alliedTowerBolts.length; i++) {
        const tBolt = sim.alliedTowerBolts[i]
        const mesh = children[i] as THREE.Object3D | undefined
        if (!mesh) continue
        mesh.visible = tBolt.active
        if (tBolt.active) {
          mesh.position.set(tBolt.x, tBolt.y, tBolt.z)
        }
      }
    }

    // V11: Animar rotação das torretas aliadas (atan2 em direção ao alvo), recuo de disparo, flash de dano e chamas de ruína
    if (alliedTowersGroupRef.current) {
      const towerNodes = alliedTowersGroupRef.current.children
      for (let i = 0; i < 4; i++) {
        const towerGroup = towerNodes[i] as THREE.Group | undefined
        if (!towerGroup) continue
        const turretHead = towerGroup.getObjectByName('TurretRotatingHead')
        const cannonBarrel = towerGroup.getObjectByName('TurretCannonBarrel')
        const firePlume = towerGroup.getObjectByName('TowerDamageFire')
        const hpFill = towerGroup.getObjectByName('TowerHpBarFill')
        const hitGlow = towerGroup.getObjectByName('TowerHitFlashGlow')

        if (turretHead) {
          const targetYaw = sim.towerTargetYawRad[i] ?? 0
          turretHead.rotation.y += (targetYaw - turretHead.rotation.y) * Math.min(1, dt * 14)
        }
        if (cannonBarrel) {
          const recoil = sim.towerRecoilAmount[i] ?? 0
          cannonBarrel.position.z = -0.78 + recoil
        }
        const maxHp = Math.max(1, sim.playerBridgeTowerMaxHp[i] ?? 1)
        const curHp = Math.max(0, sim.playerBridgeTowerHp[i] ?? 0)
        const hpRatio = Math.max(0, Math.min(1, curHp / maxHp))
        const isDamagedOrRuined =
          (sim.playerBridgeTowerLevels[i] ?? 0) > 0
            ? hpRatio < 0.75
            : (sim.playerBridgeTowerRuinedTimerMs[i] ?? 0) > 0
        if (firePlume) {
          firePlume.visible = isDamagedOrRuined
          if (isDamagedOrRuined) {
            const flicker = 0.85 + Math.sin(clockSec * 19 + i * 2.1) * 0.22
            firePlume.scale.set(flicker, flicker * 1.18, flicker)
          }
        }
        if (hpFill) {
          hpFill.scale.x = Math.max(0.05, hpRatio)
          hpFill.position.x = -(1 - hpRatio) * 0.82
        }
        if (hitGlow) {
          hitGlow.visible = (sim.playerBridgeTowerHitFlashMs[i] ?? 0) > 0
        }
      }
    }

    // Animar Desconstrução 3D da Ponte ao voltar para a Base Principal (V10)
    if (bridgeDeckGroupRef.current) {
      if (live.isDeconstructingBridge || live.deconstructionProgress > 0) {
        const p = live.deconstructionProgress
        bridgeDeckGroupRef.current.position.y = -p * 6.5
        bridgeDeckGroupRef.current.rotation.x = p * 0.24
        bridgeDeckGroupRef.current.scale.set(1 - p * 0.18, 1, 1 - p * 0.28)
      } else {
        bridgeDeckGroupRef.current.position.y = 0
        bridgeDeckGroupRef.current.rotation.x = 0
        bridgeDeckGroupRef.current.scale.set(1, 1, 1)
      }
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
      <group
        ref={bridgeDeckGroupRef}
        name="BridgeThreeRoutesDeck"
        userData={{
          isDeconstructingBridge,
          deconstructionProgress,
        }}
      >
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

      {/* ── V10: 1 ÚNICO PAR DE PORTÕES VISÍVEL POR VEZ NA ROTA CENTRAL (~8.5s–10s) + ALVO MAIS PRÓXIMO DO CENTRO DO HERÓI ── */}
      <group ref={centerSegmentsGroupRef} name="CenterRouteSegments3D">
        {segments
          .slice(
            activeSegmentIndex,
            activeSegmentIndex +
            CENTER_ROUTE_CADENCE_POLICY.maxSimultaneousVisibleSegments,
          )
          .map((seg) => {
            const zSeg = computeSegmentWorldZ(seg.zPosition, 0)
            const isInspected = inspectedSegmentId === seg.id
            const cols = seg.lanes.length
            const laneWidth = 9.6 / Math.max(2, cols)
            const heroCenterWorldX = laneNormToWorldX(laneX)
            const closestCenter = resolveClosestCenterGateFromWorldX(
              heroCenterWorldX,
              cols === 3 ? 3 : 2,
            )
            const isHeroInCenterCorridor = Math.abs(laneX) <= 0.52

            return (
              <group key={seg.id} position={[0, 0, zSeg]}>
                {seg.lanes.map((laneGates, lIdx) => {
                  const primary = laneGates[0]
                  if (!primary) return null
                  const xCenter = (lIdx - (cols - 1) * 0.5) * laneWidth
                  const isTargetGate =
                    isHeroInCenterCorridor && closestCenter.chosenLane === lIdx
                  const isPositive = isLaneBeneficial(
                    laneGates,
                    Math.max(25, currentArmy),
                  )
                  const panelColor = isPositive ? '#0284c7' : '#dc2626'
                  const borderColor = isTargetGate
                    ? '#fef08a'
                    : isInspected
                      ? '#fde047'
                      : isPositive
                        ? '#7dd3fc'
                        : '#fca5a5'
                  const secondLabel = laneGates[1]
                    ? `E DEPOIS ${laneGates[1].label}`
                    : isTargetGate
                      ? '🎯 ALVO'
                      : ''
                  const labelTex = getPlaqueTexture(
                    primary.label,
                    panelColor,
                    borderColor,
                    '#ffffff',
                    secondLabel,
                  )

                  return (
                    <group
                      key={`${seg.id}_l_${lIdx}`}
                      position={[xCenter, 0, 0]}
                      scale={isTargetGate ? [1.05, 1.05, 1.05] : [0.92, 0.92, 0.92]}
                    >
                      <mesh position={[-laneWidth * 0.44, 1.8, 0]} castShadow>
                        <cylinderGeometry args={[0.16, 0.2, 3.6, 8]} />
                        <meshStandardMaterial color={borderColor} metalness={0.5} />
                      </mesh>
                      <mesh position={[laneWidth * 0.44, 1.8, 0]} castShadow>
                        <cylinderGeometry args={[0.16, 0.2, 3.6, 8]} />
                        <meshStandardMaterial color={borderColor} metalness={0.5} />
                      </mesh>
                      {isTargetGate && (
                        <mesh position={[0, 0.14, 0.22]}>
                          <boxGeometry args={[laneWidth * 0.88, 0.14, 0.42]} />
                          <meshStandardMaterial
                            color="#fde047"
                            emissive="#facc15"
                            emissiveIntensity={0.85}
                          />
                        </mesh>
                      )}
                      <mesh position={[0, 1.85, 0]}>
                        <boxGeometry args={[laneWidth * 0.86, 2.7, 0.18]} />
                        <meshStandardMaterial
                          color={panelColor}
                          transparent
                          opacity={isTargetGate ? 0.78 : 0.28}
                          emissive={panelColor}
                          emissiveIntensity={isTargetGate ? 0.52 : 0.08}
                        />
                      </mesh>
                      <mesh position={[0, 2.0, 0.14]}>
                        <planeGeometry args={[laneWidth * 0.82, 1.9]} />
                        <meshBasicMaterial
                          map={labelTex}
                          transparent
                          opacity={isTargetGate ? 1 : 0.62}
                        />
                      </mesh>
                    </group>
                  )
                })}
              </group>
            )
          })}
      </group>

      {/* ── V10: TORRES DE DEBUFF 3D DA BASE INIMIGA NOS PARAPEITOS + PROJÉTEIS DE DEBUFF ── */}
      <group name="EnemyDebuffTowers3D">
        {ENEMY_LIVING_BASE_POLICY.debuffTowerSlots.map((slot) => {
          const isUnlocked = enemyBaseLevel >= slot.unlockAtEnemyLevel
          return (
            <group
              key={`enemy_debuff_tower_${slot.id}`}
              position={[slot.x, isUnlocked ? 0.35 : -2.2, slot.z]}
              visible={isUnlocked}
            >
              <mesh position={[0, 1.4, 0]} castShadow>
                <cylinderGeometry args={[0.55, 0.75, 2.8, 8]} />
                <meshStandardMaterial color="#450a0a" roughness={0.6} />
              </mesh>
              <mesh position={[0, 3.1, 0]}>
                <octahedronGeometry args={[0.62, 0]} />
                <meshStandardMaterial
                  color="#ef4444"
                  emissive="#dc2626"
                  emissiveIntensity={0.85}
                />
              </mesh>
            </group>
          )
        })}
        <group ref={enemyDebuffBoltsGroupRef} name="EnemyDebuffBolts3D">
          {Array.from({ length: 8 }).map((_, idx) => (
            <mesh key={`enemy_debuff_bolt_${idx}`} visible={false}>
              <sphereGeometry args={[0.42, 10, 10]} />
              <meshStandardMaterial
                color="#f43f5e"
                emissive="#e11d48"
                emissiveIntensity={1.1}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── V10 + V11: BASTIÃO SUL & 4 TORRES DEFENSIVAS 3D COM TORRETA GIRATÓRIA, HP REAL E RUÍNAS EM CHAMAS ── */}
      <group name="PlayerBridgeBastion3D">
        <group ref={alliedTowersGroupRef} name="AlliedTowersSlots3D">
          {PLAYER_BRIDGE_BASE_POLICY.slots.map((slot) => {
            const lvl = playerBridgeTowerLevels[slot.slotIndex] ?? 0
            const isBuilt = lvl > 0
            const curHp = simRef.current.playerBridgeTowerHp[slot.slotIndex] ?? 0
            const maxHp = Math.max(
              1,
              simRef.current.playerBridgeTowerMaxHp[slot.slotIndex] ?? 120,
            )
            const hpRatio = isBuilt ? Math.max(0, Math.min(1, curHp / maxHp)) : 0
            const isRuined =
              !isBuilt &&
              (simRef.current.playerBridgeTowerRuinedTimerMs[slot.slotIndex] ?? 0) > 0
            const isDamaged = isBuilt && hpRatio < 0.65

            const towerTex = getPlaqueTexture(
              isBuilt
                ? `🗼 NV.${lvl} (${curHp}/${maxHp})`
                : isRuined
                  ? '🔥 DESTRUÍDA!'
                  : '🔒 SLOT',
              isBuilt
                ? isDamaged
                  ? '#b45309'
                  : '#0369a1'
                : isRuined
                  ? '#991b1b'
                  : '#334155',
              isBuilt
                ? isDamaged
                  ? '#facc15'
                  : '#38bdf8'
                : isRuined
                  ? '#ef4444'
                  : '#64748b',
              '#ffffff',
              isBuilt
                ? isDamaged
                  ? 'SOB ATAQUE DO BOSS!'
                  : 'ATIRANDO'
                : isRuined
                  ? 'RECONSTRUIR'
                  : 'CONSTRUIR',
            )
            const bastionSpriteTex = isBuilt
              ? isDamaged
                ? towerDamagedSpriteTex
                : towerIntactSpriteTex
              : towerRuinedSpriteTex

            return (
              <group
                key={slot.id}
                position={[slot.x, 0.1, slot.z]}
                scale={
                  isBuilt
                    ? [1 + lvl * 0.08, 1 + lvl * 0.12, 1 + lvl * 0.08]
                    : [0.85, 0.68, 0.85]
                }
              >
                {/* Pedestal octogonal de alvenaria 3D */}
                <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.72, 0.92, 1.9, 8]} />
                  <meshStandardMaterial
                    color={
                      isBuilt
                        ? isDamaged
                          ? '#7c2d12'
                          : '#1e3a8a'
                        : isRuined
                          ? '#450a0a'
                          : '#334155'
                    }
                    roughness={0.5}
                    metalness={0.35}
                  />
                </mesh>

                {/* Sprite 2.5D Ilustrado HD da Torre / Escombros na fachada frontal */}
                <mesh position={[0, 1.65, -0.58]}>
                  <planeGeometry args={[1.85, 2.25]} />
                  <meshBasicMaterial
                    map={bastionSpriteTex}
                    transparent
                    alphaTest={0.08}
                    side={THREE.DoubleSide}
                  />
                </mesh>

                {/* Flash de impacto quando o Boss marreta a Torre */}
                <mesh name="TowerHitFlashGlow" position={[0, 1.6, 0]} visible={false}>
                  <cylinderGeometry args={[1.05, 1.15, 2.6, 10]} />
                  <meshBasicMaterial color="#ef4444" transparent opacity={0.55} />
                </mesh>

                {/* Chamas 3D animadas quando a torre está avariada ou recém-destruída pelo Boss */}
                <group name="TowerDamageFire" position={[0, 1.85, -0.25]} visible={isDamaged || isRuined}>
                  <mesh position={[0, 0.35, 0]}>
                    <coneGeometry args={[0.52, 1.15, 7]} />
                    <meshBasicMaterial color="#f97316" transparent opacity={0.88} />
                  </mesh>
                  <mesh position={[0.18, 0.55, 0.1]}>
                    <coneGeometry args={[0.32, 0.85, 6]} />
                    <meshBasicMaterial color="#facc15" />
                  </mesh>
                </group>

                {/* Cabeça Giratória 3D da Torreta + Canhão / Balista com Recuo Real */}
                <group name="TurretRotatingHead" position={[0, 2.05, 0]} visible={isBuilt}>
                  <mesh position={[0, 0.35, 0]} castShadow>
                    <coneGeometry args={[0.78, 1.15, 8]} />
                    <meshStandardMaterial
                      color={isDamaged ? '#f59e0b' : '#38bdf8'}
                      emissive={isDamaged ? '#d97706' : '#0ea5e9'}
                      emissiveIntensity={0.65}
                    />
                  </mesh>
                  <mesh
                    name="TurretCannonBarrel"
                    position={[0, 0.12, -0.78]}
                    rotation={[Math.PI / 2, 0, 0]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.18, 0.24, 1.45, 8]} />
                    <meshStandardMaterial
                      color="#facc15"
                      emissive="#eab308"
                      emissiveIntensity={0.5}
                      metalness={0.85}
                    />
                  </mesh>
                </group>

                {/* Barra de HP Estrutural 3D da Torre Aliada */}
                <group position={[0, 3.05, 0]} visible={isBuilt}>
                  <mesh>
                    <boxGeometry args={[1.75, 0.2, 0.08]} />
                    <meshBasicMaterial color="#0f172a" />
                  </mesh>
                  <mesh name="TowerHpBarFill" position={[0, 0, 0.04]}>
                    <boxGeometry args={[1.64, 0.13, 0.06]} />
                    <meshBasicMaterial color={isDamaged ? '#f97316' : '#22c55e'} />
                  </mesh>
                </group>

                {/* Placa 3D Nível / HP / Ruína */}
                <mesh position={[0, 3.68, 0]}>
                  <planeGeometry args={[2.25, 1.05]} />
                  <meshBasicMaterial map={towerTex} transparent />
                </mesh>
              </group>
            )
          })}
        </group>
        <group ref={alliedTowerBoltsGroupRef} name="AlliedTowerBolts3D">
          {Array.from({ length: 16 }).map((_, idx) => (
            <mesh key={`allied_tower_bolt_${idx}`} visible={false}>
              <sphereGeometry args={[0.36, 10, 10]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0ea5e9"
                emissiveIntensity={1.25}
              />
            </mesh>
          ))}
        </group>
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
