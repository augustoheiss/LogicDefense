// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/state/useLogicBattleStore.ts — Store Zustand (Mundo 1 & Mundo 2)
// ──────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand'
import { soundEngine } from '../audio/soundEngine'
import { BIOMES } from '../config/biomes'
import { REGIONS } from '../config/regions'
import { TRAP_CATALOG, TWIN_CATALOG } from '../config/trapCatalog'
import { CITADEL_BUILDINGS, getUpgradeCost } from '../config/upgrades'
import {
  applyAuthenticCenterGatePass,
  applyGateChainWithRemainder,
  clampArmy,
} from '../domain/armyMath'
import { resolveBattle } from '../domain/battleResolver'
import {
  calculateCappedSurvivorBonus,
  calculatePassiveTribute,
  canAttackRegion,
  convertRemainderVaultToTroops,
  DirectAttackResult,
  getInitialArmyFromQuartel,
  purchaseCitadelUpgrade,
  resolveDirectPrecisionAttack,
} from '../domain/economy'
import {
  generateRun,
  injectRedemptionSegmentOnBridge,
} from '../domain/gateGenerator'
import {
  generateInfiniteChallenge,
  getRecentMathSignaturesSnapshot,
  hydrateSeenMathSignatures,
  InfiniteMathChallenge,
  MATH_CHALLENGE_TIER_POLICIES,
  MathDifficultyTier,
} from '../domain/infiniteMathEngine'
import { updateConceptMastery } from '../domain/mastery'
import { detectVaiUmMerge, formatArmy } from '../domain/notation'
import { evaluateSegmentCounterfactual, pathOracle } from '../domain/pathOracle'
import {
  evaluateRedemptionContract,
  issueToken,
  redeem,
} from '../domain/redemption'
import { createRng } from '../domain/rng'
import { detectTrap } from '../domain/trapDetector'
import {
   buildCrowdNodes,
} from '../run/renderer/crowdRenderer'
import {
  getLaneCenterNormX,
  resolveClosestCenterGateFromWorldX,
  resolveLaneIndexFromNormX,
} from '../run/renderer/perspective'
import {
  computeSectorBossSpec,
  getBridgeTowerUpgradeCost,
  PLAYER_BRIDGE_BASE_POLICY,
} from '../run/bridge3d/bridge3dPolicies'
import {
  ENGINE_CATALOG,
  EngineId,
  EngineResult,
  getComboMultiplier,
} from '../engines/engineContract'
import {
  ActiveBridgeRunCheckpoint,
  ArmyCount,
  BattleResolution,
  BiomeId,
  CitadelBuildingId,
  FloatingFeedbackItem,
  MergeAnimationEvent,
  PathOracleResult,
  RedemptionContractOffer,
  RedemptionToken,
  RunPlan,
  RunSnapshot,
  SaveV1,
  TrapHit,
} from '../types'
import { SaveRepository } from './persistence'

/** V8: Bioma único e contínuo do Modo Ponte (evita reset destrutivo ao trocar de bioma) */
export const CANONICAL_BRIDGE_BIOME_ID: BiomeId = 'planicie_pedra'

/** Controla se o avanço do último segmento veio de clique explícito nos botões de faixa (Modo 2D/Dock) */
let lastAdvanceViaTapButton = false
let tapAdvanceUsedInCurrentWave = false
let runInstanceSeq = 0

export interface CaptainSpeech {
  mood: 'proud' | 'curious' | 'excited' | 'calm'
  text: string
}

function readLiveBridgeWeaponLevels(): {
  leftCannonLevel?: number
  rightWeaponLevel?: number
} {
  if (typeof window === 'undefined') return {}
  const tel = (
    window as unknown as {
      __lbBridge3DTelemetry?: {
        leftCannonLevel?: number
        rightWeaponLevel?: number
      }
    }
  ).__lbBridge3DTelemetry
  if (!tel) return {}
  return {
    leftCannonLevel:
      typeof tel.leftCannonLevel === 'number' && Number.isFinite(tel.leftCannonLevel)
        ? Math.max(1, Math.floor(tel.leftCannonLevel))
        : undefined,
    rightWeaponLevel:
      typeof tel.rightWeaponLevel === 'number' && Number.isFinite(tel.rightWeaponLevel)
        ? Math.max(0, Math.floor(tel.rightWeaponLevel))
        : undefined,
  }
}

function buildSaveWithCheckpoint(
  baseSave: SaveV1,
  params: {
    sectorIndex: number
    currentArmy: ArmyCount
    bridgeCoinsEarned: number
    bridgeKills: number
    mathChallengesSolved: number
    seed: number
    leftCannonLevel?: number
    rightWeaponLevel?: number
    bankedScoreMark?: number
    playerBridgeTowerLevels?: [number, number, number, number]
    enemyBaseLevel?: number
  },
): SaveV1 {
  const prevCp = baseSave.activeRunCheckpoint
  const liveWep = readLiveBridgeWeaponLevels()
  const sectorIndex = Math.max(1, Math.floor(params.sectorIndex))
  const currentArmy = clampArmy(Math.max(0, Math.floor(params.currentArmy)))
  const bridgeCoinsEarned = Math.max(0, Math.floor(params.bridgeCoinsEarned))
  const bridgeKills = Math.max(0, Math.floor(params.bridgeKills))
  const bankedScoreMark =
    params.bankedScoreMark !== undefined
      ? Math.max(0, Math.floor(params.bankedScoreMark))
      : prevCp?.bankedScoreMark ?? 5
  const resolvedTowerLevels: [number, number, number, number] =
    params.playerBridgeTowerLevels ??
    baseSave.playerBridgeTowerLevels ??
    prevCp?.playerBridgeTowerLevels ?? [1, 0, 0, 0]
  const resolvedEnemyBaseLevel =
    params.enemyBaseLevel ?? prevCp?.enemyBaseLevel ?? 1

  const nextCheckpoint: ActiveBridgeRunCheckpoint = {
    sectorIndex,
    currentArmy,
    bridgeCoinsEarned,
    bridgeKills,
    leftCannonLevel:
      params.leftCannonLevel ?? liveWep.leftCannonLevel ?? prevCp?.leftCannonLevel ?? 1,
    rightWeaponLevel:
      params.rightWeaponLevel ?? liveWep.rightWeaponLevel ?? prevCp?.rightWeaponLevel ?? 0,
    mathChallengesSolved: params.mathChallengesSolved,
    seed: params.seed,
    bankedScoreMark,
    playerBridgeTowerLevels: resolvedTowerLevels,
    enemyBaseLevel: resolvedEnemyBaseLevel,
    updatedAt: new Date().toISOString(),
  }

  const highestSectorReached = Math.max(
    1,
    baseSave.stats.highestSectorReached ?? 1,
    sectorIndex,
  )
  const highestArmyReached = Math.max(
    baseSave.stats.highestArmyReached,
    currentArmy,
  )
  const totalPlayerScore = Math.max(
    baseSave.stats.totalPlayerScore ?? 0,
    baseSave.reserveTroops +
      Math.max(0, currentArmy - bankedScoreMark) +
      bridgeCoinsEarned * 5 +
      (highestSectorReached - 1) * 50,
  )

  return {
    ...baseSave,
    playerBridgeTowerLevels: resolvedTowerLevels,
    activeRunCheckpoint: nextCheckpoint,
    stats: {
      ...baseSave.stats,
      highestArmyReached,
      highestSectorReached,
      totalPlayerScore,
    },
  }
}

function readUrlParams(): {
  seed?: number
  debug: boolean
  world: 'run' | 'realm'
  biome?: BiomeId
  engine?: EngineId
} {
  if (typeof window === 'undefined') {
    return { debug: false, world: 'run' }
  }
  const params = new URLSearchParams(window.location.search)
  const seedRaw = params.get('seed')
  const parsedSeed = seedRaw !== null && seedRaw !== '' ? Number(seedRaw) : undefined
  const debug = params.get('debug') === '1'
  const worldParam = params.get('world')
  const world: 'run' | 'realm' = worldParam === 'realm' ? 'realm' : 'run'
  const biomeParam = params.get('biome') as BiomeId | null
  const biome =
    biomeParam && BIOMES[biomeParam] ? biomeParam : undefined
  const engineParam = params.get('engine') as EngineId | null
  const engine =
    engineParam && ENGINE_CATALOG[engineParam] ? engineParam : undefined

  return {
    seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
    debug,
    world,
    biome,
    engine,
  }
}

function createInitialSnapshotFromPlan(plan: RunPlan, calmMode: boolean): RunSnapshot {
  const initialLane = 0
  const laneX = getLaneCenterNormX(initialLane, plan.laneCount)
  const safeN0 = clampArmy(plan.n0)
  return {
    runId: plan.runId,
    phase: calmMode ? 'CALM_WAIT' : 'RUNNING',
    elapsedMs: 0,
    progress: 0,
    currentArmy: safeN0,
    remainderBankInRun: 0,
    currentLane: initialLane,
    laneX,
    laneCount: plan.laneCount,
    activeSegmentIndex: 0,
    segments: plan.segments,
    resolvedSegments: {},
    crowdNodes: buildCrowdNodes(safeN0),
    recentFeedback: [],
    activeMergeEvent: null,
    inspectedSegmentId: null,
    enemy: plan.enemy,
    calcComboStreak: 0,
    calcComboMultiplier: 1,
    goldenTokensCollected: 0,
    bridgeCoinsEarned: 0,
    bridgeKills: 0,
    lastTrapFlashAtMs: null,
  }
}

export interface LogicBattleStoreState {
  world: 'run' | 'realm'
  activeEngineId: EngineId
  debugMode: boolean
  save: SaveV1
  recoveredFromBackup: boolean
  runPlan: RunPlan
  oracle: PathOracleResult
  snapshot: RunSnapshot
  activeTrapHit: TrapHit | null
  trapHistoryInRun: TrapHit[]
  activeRedemptionTokenId: string | null
  tokensInRun: RedemptionToken[]
  lastRedeemDiagnostic: string | null
  battleResolution: BattleResolution | null
  redemptionContract: RedemptionContractOffer | null
  lunetaChargesRemaining: number
  albumDrawerOpen: boolean
  codexDrawerSlug: string | null
  settingsPopoverOpen: boolean
  activeRealmSheet: 'none' | 'region' | 'citadel'
  captainSpeech: CaptainSpeech
  lastDirectAttackResult: DirectAttackResult | null

  // V6: Desafio Matemático Infinito (4 Graus: Fácil, Médio, Difícil, Problema)
  activeMathChallenge: InfiniteMathChallenge | null
  activeMathChallengeScaffold: 1 | 2 | 3
  activeMathChallengeDiagnostic: string | null
  mathChallengesSolvedInRun: number
  lastSolvedMathRewardAt: {
    seq: number
    tier: MathDifficultyTier
    coinsBonus: number
    soldiersBonus: number
    armyMultiplier: number
    weaponDmgMultiplier: number
    summaryPt: string
    correctValue: number
    expressionBadge: string
  } | null

  // V7: Modo Infinito por Setores & 3 Rotas Reais na Ponte 3D
  bridgeSectorIndex: number
  infiniteBridgeMode: boolean

  // V10 Fase 1: Bases Vivas (Inimiga vs. Aliada), Carteira Compartilhada e Desconstrução Tática 3D
  enemyBaseLevel: number
  enemyDebuffTowersActive: number
  playerBridgeTowerLevels: [number, number, number, number]
  bridgeBaseDrawerOpen: boolean
  isDeconstructingBridge: boolean
  deconstructionProgress: number
  deconstructionCompletedCount: number

  // Actions
  getSharedWalletBalance: () => ArmyCount
  toggleBridgeBaseDrawer: (open?: boolean) => void
  upgradeBridgeTowerInMatch: (slotIndex: 0 | 1 | 2 | 3) => boolean
  upgradeCitadelInMatch: (buildingId: CitadelBuildingId) => boolean
  evolveEnemyBaseInMatch: (targetLevel?: number) => number
  applyEnemyDebuffTowerHit: (lossRatio: number, label: string) => void
  recordDebuffBoltIntercepted: (label: string) => void
  triggerBridgeDeconstructionToBase: () => void
  toggleInfiniteBridgeMode: () => void
  advanceInfiniteBridgeSector: () => void
  extractRunToBase: () => void
  switchBridgeBiomeWithoutReset: (biomeId: BiomeId) => void
  resumeCheckpointFromSave: () => void
  applySideRouteReward: (
    route: 'LEFT' | 'RIGHT',
    soldiersDelta: number,
    reasonLabel: string,
  ) => void
  onSectorBossDefeatedInBridge: (newSector: number, bonusSoldiers: number) => void
  steerToRoute: (route: 'LEFT' | 'CENTER' | 'RIGHT') => void
  openMathChallengeModal: (tier?: MathDifficultyTier) => void
  switchMathChallengeTier: (tier: MathDifficultyTier) => void
  submitMathChallengeChoice: (choiceId: string) => void
  closeMathChallengeModal: () => void
  switchWorld: (world: 'run' | 'realm') => void
  selectEngine: (engineId: EngineId, startImmediately?: boolean) => void
  completeEngineRun: (result: EngineResult) => void
  recordBridgeEnemyKill: (
    coinsDelta?: number,
    damageDealt?: number,
    playerAttritionLoss?: number,
  ) => void
  toggleDebugMode: () => void
  toggleSettingsPopover: (open?: boolean) => void
  setActiveRealmSheet: (sheet: 'none' | 'region' | 'citadel') => void
  startNewRun: (
    opts?:
      | { regionId?: string; biomeId?: BiomeId; seed?: number; engineId?: EngineId }
      | BiomeId,
    legacySeed?: number,
  ) => void
  setSteeringX: (laneNormX: number) => void
  stepLane: (delta: -1 | 1) => void
  chooseLaneAndAdvance: (laneIndex: number) => void
  tickRun: (dtMs: number) => void
  updateBattleArmyVisual: (newArmy: ArmyCount, splitEvent: MergeAnimationEvent | null) => void
  finishBattle: () => void
  dismissTrapAlertAndContinue: () => void
  openImmediateRedemptionFromTrap: () => void
  openNextRedemptionModal: () => void
  submitRedemptionAnswer: (choiceId: string) => void
  closeRedemptionModal: () => void
  acceptRedemptionContractModal: () => void
  useLunetaOnNextSegment: () => void
  togglePauseRun: () => void
  toggleNotationMode: () => void
  toggleCalmMode: () => void
  toggleSimpleTapMode: () => void
  toggleSound: () => void
  toggleReducedMotion: () => void
  dismissCoachMarks: () => void
  selectRegion: (regionId: string) => void
  attackRegionDirect: (regionId: string, troopsToCommit: ArmyCount) => DirectAttackResult
  upgradeCitadelBuilding: (buildingId: CitadelBuildingId) => boolean
  convertRemaindersInMine: () => number
  openAlbumDrawer: (open: boolean) => void
  openCodexForSlug: (slug: string | null) => void
  resetSaveData: () => void
}

const initialLoad = SaveRepository.load()
hydrateSeenMathSignatures(initialLoad.save.recentMathSignatures)
const urlCfg = readUrlParams()
soundEngine.setEnabled(initialLoad.save.settings.soundEnabled)

const initialCheckpoint =
  urlCfg.seed === undefined ? initialLoad.save.activeRunCheckpoint ?? null : null
const initialRegion =
  REGIONS[initialLoad.save.selectedRegionId] ?? REGIONS.r01_ponte_aurora
// V8: Bioma único no Modo Ponte (sempre 'planicie_pedra')
const initialBiomeId: BiomeId = CANONICAL_BRIDGE_BIOME_ID
const initialSeed =
  urlCfg.seed ??
  initialCheckpoint?.seed ??
  ((Date.now() % 1_000_000) + initialLoad.save.stats.runsPlayed * 137)
const baseQuartelN0 = Math.max(
  5,
  getInitialArmyFromQuartel(initialLoad.save.citadelLevels.quartel ?? 1),
)
const initialN0 =
  initialCheckpoint && initialCheckpoint.currentArmy > 0
    ? clampArmy(initialCheckpoint.currentArmy)
    : baseQuartelN0
const initialSectorIndex =
  initialCheckpoint && initialCheckpoint.sectorIndex >= 1
    ? initialCheckpoint.sectorIndex
    : 1

function buildSectorScaledEnemy(
  baseEnemy: {
    garrison: ArmyCount
    bossHp: ArmyCount
    bossName: string
    bossTitle: string
  },
  sectorIndex: number,
  _currentArmy?: ArmyCount,
) {
  if (sectorIndex <= 1) {
    return {
      horde: baseEnemy.garrison,
      bossHp: baseEnemy.bossHp,
      bossName: baseEnemy.bossName,
      bossTitle: baseEnemy.bossTitle,
      totalForce: baseEnemy.garrison + baseEnemy.bossHp,
    }
  }
  const spec = computeSectorBossSpec(sectorIndex)
  const scaledBossHp = clampArmy(spec.bossHp)
  const scaledHorde = clampArmy(spec.hordeHp)
  return {
    horde: scaledHorde,
    bossHp: scaledBossHp,
    bossName: `${spec.archetype.namePt} S${sectorIndex}`,
    bossTitle: `${spec.archetype.titlePt} · Setor ${sectorIndex}`,
    totalForce: clampArmy(scaledHorde + scaledBossHp),
  }
}

const initialPlan = generateRun({
  seed: initialSeed,
  biomeId: initialBiomeId,
  regionId: initialRegion.id,
  n0: urlCfg.seed !== undefined ? baseQuartelN0 : initialN0,
  enemy: buildSectorScaledEnemy(
    initialRegion,
    urlCfg.seed !== undefined ? 1 : initialSectorIndex,
    initialN0,
  ),
  mastery: initialLoad.save.mastery,
  observatoryLevel: initialLoad.save.citadelLevels.observatorio ?? 1,
  trapAlertSeenCount: initialLoad.save.trapAlertSeenCount,
})

const initialOracle = pathOracle(initialPlan)
const initialForjaLevel = initialLoad.save.citadelLevels.forja ?? 0
const initialLunetas = CITADEL_BUILDINGS.forja.levelEffects[initialForjaLevel] ?? 1
const initialSnapBase = createInitialSnapshotFromPlan(
  initialPlan,
  initialLoad.save.settings.calmMode,
)
const initialSnapshot: RunSnapshot =
  initialCheckpoint && urlCfg.seed === undefined
    ? {
        ...initialSnapBase,
        currentArmy: initialN0,
        crowdNodes: buildCrowdNodes(initialN0),
        bridgeCoinsEarned: initialCheckpoint.bridgeCoinsEarned,
        bridgeKills: initialCheckpoint.bridgeKills,
      }
    : initialSnapBase

export const useLogicBattleStore = create<LogicBattleStoreState>((set, get) => ({
  world: urlCfg.world,
  activeEngineId: urlCfg.engine ?? 'ponte_portoes',
  debugMode: urlCfg.debug,
  save: initialLoad.save,
  recoveredFromBackup: initialLoad.recoveredFromBackup,
  runPlan: initialPlan,
  oracle: initialOracle,
  snapshot: initialSnapshot,
  activeTrapHit: null,
  trapHistoryInRun: [],
  activeRedemptionTokenId: null,
  tokensInRun: [],
  lastRedeemDiagnostic: null,
  battleResolution: null,
  redemptionContract: null,
  lunetaChargesRemaining: initialLunetas,
  albumDrawerOpen: false,
  codexDrawerSlug: null,
  settingsPopoverOpen: false,
  activeRealmSheet: 'none',
  lastDirectAttackResult: null,
  activeMathChallenge: null,
  activeMathChallengeScaffold: 1,
  activeMathChallengeDiagnostic: null,
  mathChallengesSolvedInRun: initialCheckpoint?.mathChallengesSolved ?? 0,
  lastSolvedMathRewardAt: null,
  bridgeSectorIndex: initialSectorIndex,
  infiniteBridgeMode: initialSectorIndex > 1,
  enemyBaseLevel: initialCheckpoint?.enemyBaseLevel ?? 1,
  enemyDebuffTowersActive: 1,
  playerBridgeTowerLevels:
    initialCheckpoint?.playerBridgeTowerLevels ??
    initialLoad.save.playerBridgeTowerLevels ?? [1, 0, 0, 0],
  bridgeBaseDrawerOpen: false,
  isDeconstructingBridge: false,
  deconstructionProgress: 0,
  deconstructionCompletedCount: 0,
  captainSpeech: {
    mood: 'excited',
    text:
      initialSectorIndex > 1
        ? `Progresso restaurado do IndexedDB/Cache! Continuando no Setor ${initialSectorIndex} com ${formatArmy(initialN0, initialLoad.save.settings.notationMode)} soldados!`
        : 'Capitã Vírgula a postos! Deslize o exército pelos portões e cuidado com as pegadinhas da intuição!',
  },

  getSharedWalletBalance: () => {
    const state = get()
    const { save, snapshot, bridgeSectorIndex, runPlan } = state
    const prevBankedMark = save.activeRunCheckpoint?.bankedScoreMark ?? runPlan.n0
    const coinsBonus = Math.max(0, snapshot.bridgeCoinsEarned ?? 0)
    const sectorBonus = bridgeSectorIndex > 1 ? (bridgeSectorIndex - 1) * 15 : 0
    const totalRunContribution = snapshot.currentArmy + coinsBonus + sectorBonus
    const unbankedExtractable =
      state.world === 'run'
        ? clampArmy(Math.max(0, totalRunContribution - prevBankedMark))
        : 0
    return clampArmy(save.reserveTroops + unbankedExtractable)
  },

  toggleBridgeBaseDrawer: (open) => {
    set((s) => ({
      bridgeBaseDrawerOpen: open !== undefined ? open : !s.bridgeBaseDrawerOpen,
    }))
  },

  upgradeBridgeTowerInMatch: (slotIndex) => {
    const state = get()
    const currentLevels: [number, number, number, number] = [
      ...state.playerBridgeTowerLevels,
    ]
    const currentLvl = currentLevels[slotIndex] ?? 0
    if (currentLvl >= PLAYER_BRIDGE_BASE_POLICY.maxTowerLevel) {
      return false
    }
    const cost = getBridgeTowerUpgradeCost(currentLvl)
    const sharedBalance = get().getSharedWalletBalance()
    if (sharedBalance < cost) {
      return false
    }

    const { save, snapshot, bridgeSectorIndex, runPlan, mathChallengesSolvedInRun } = state
    const prevBankedMark = save.activeRunCheckpoint?.bankedScoreMark ?? runPlan.n0
    const coinsBonus = Math.max(0, snapshot.bridgeCoinsEarned ?? 0)
    const sectorBonus = bridgeSectorIndex > 1 ? (bridgeSectorIndex - 1) * 15 : 0
    const totalRunContribution = snapshot.currentArmy + coinsBonus + sectorBonus
    const nextBankedMark = Math.max(prevBankedMark, totalRunContribution)
    const nextReserveAfterSpend = clampArmy(sharedBalance - cost)

    currentLevels[slotIndex] = currentLvl + 1
    soundEngine.playRedemptionSuccess()

    // Bônus imediato na partida: +4 soldados de guarnição da torre na ponte
    const nextArmy = clampArmy(snapshot.currentArmy + 4)
    const slotSpec = PLAYER_BRIDGE_BASE_POLICY.slots[slotIndex]
    const fbTower: FloatingFeedbackItem = {
      id: `fb_tower_${slotIndex}_${Date.now()}`,
      text: `🗼 ${slotSpec.namePt} Nv.${currentLevels[slotIndex]}`,
      subText: `−${cost} Carteira · +4 🛡️`,
      tone: 'reinforcement',
      createdAtMs: snapshot.elapsedMs,
    }

    const nextSave = buildSaveWithCheckpoint(
      {
        ...save,
        reserveTroops: nextReserveAfterSpend,
        playerBridgeTowerLevels: currentLevels,
      },
      {
        sectorIndex: bridgeSectorIndex,
        currentArmy: nextArmy,
        bridgeCoinsEarned: snapshot.bridgeCoinsEarned ?? 0,
        bridgeKills: snapshot.bridgeKills ?? 0,
        mathChallengesSolved: mathChallengesSolvedInRun,
        seed: runPlan.seed,
        bankedScoreMark: nextBankedMark + 4,
      },
    )
    if (nextSave.activeRunCheckpoint) {
      nextSave.activeRunCheckpoint.playerBridgeTowerLevels = currentLevels
      nextSave.activeRunCheckpoint.enemyBaseLevel = state.enemyBaseLevel
    }
    SaveRepository.save(nextSave)

    set({
      save: nextSave,
      playerBridgeTowerLevels: currentLevels,
      snapshot: {
        ...snapshot,
        currentArmy: nextArmy,
        crowdNodes: buildCrowdNodes(nextArmy),
        recentFeedback: [...snapshot.recentFeedback.slice(-4), fbTower],
      },
      captainSpeech: {
        mood: 'proud',
        text: `🗼 ${slotSpec.namePt} evoluída para Nv.${currentLevels[slotIndex]} usando a Carteira Compartilhada! Disparos automáticos e escudo anti-debuff reforçados na ponte!`,
      },
    })
    return true
  },

  evolveEnemyBaseInMatch: (targetLevel) => {
    const state = get()
    const nextLevel =
      targetLevel !== undefined
        ? Math.max(1, Math.min(5, Math.floor(targetLevel)))
        : Math.min(5, state.enemyBaseLevel + 1)
    const activeTowers = Math.min(4, nextLevel)
    const nextHorde = Math.round(state.snapshot.enemy.horde * 1.12)
    const nextBossHp = Math.round(state.snapshot.enemy.bossHp * 1.08)
    const fbEvo: FloatingFeedbackItem = {
      id: `fb_enemy_evo_${nextLevel}_${Date.now()}`,
      text: `💀 Base Inimiga Nv.${nextLevel}!`,
      subText: `${activeTowers} Torre(s) de Debuff Ativa(s)`,
      tone: 'trap',
      createdAtMs: state.snapshot.elapsedMs,
    }
    set({
      enemyBaseLevel: nextLevel,
      enemyDebuffTowersActive: activeTowers,
      snapshot: {
        ...state.snapshot,
        enemy: {
          ...state.snapshot.enemy,
          horde: nextHorde,
          bossHp: nextBossHp,
          totalForce: nextHorde + nextBossHp,
        },
        recentFeedback: [...state.snapshot.recentFeedback.slice(-4), fbEvo],
      },
      captainSpeech: {
        mood: 'curious',
        text: `⚠️ A Base Inimiga evoluiu para Nv.${nextLevel} e ergueu ${activeTowers} Torre(s) de Debuff na ponte! Evolua nossas Torres da Ponte para interceptar os feixes!`,
      },
    })
    return nextLevel
  },

  applyEnemyDebuffTowerHit: (lossRatio, label) => {
    const state = get()
    if (state.isDeconstructingBridge) return
    const snap = state.snapshot
    if (
      snap.phase !== 'RUNNING' &&
      snap.phase !== 'CALM_WAIT' &&
      snap.phase !== 'BATTLE'
    ) {
      return
    }
    const safeBefore = Math.max(1, clampArmy(snap.currentArmy))
    const clampedRatio = Math.max(0.08, Math.min(0.45, lossRatio))
    const soldiersLost =
      safeBefore > 1
        ? Math.max(1, Math.round(safeBefore * clampedRatio))
        : 0
    const nextArmy = Math.max(1, clampArmy(safeBefore - soldiersLost))
    soundEngine.playGatePass(nextArmy, false)
    const fbDebuff: FloatingFeedbackItem = {
      id: `fb_debuff_hit_${Date.now()}`,
      text: `−${formatArmy(soldiersLost, state.save.settings.notationMode)} Soldados`,
      subText: `⚠️ Pulso Inimigo (${label})`,
      tone: 'trap',
      createdAtMs: snap.elapsedMs,
    }
    set({
      snapshot: {
        ...snap,
        currentArmy: nextArmy,
        crowdNodes: buildCrowdNodes(nextArmy),
        recentFeedback: [...snap.recentFeedback.slice(-4), fbDebuff],
      },
    })
  },

  recordDebuffBoltIntercepted: (label) => {
    const state = get()
    const snap = state.snapshot
    const fbShield: FloatingFeedbackItem = {
      id: `fb_shield_${Date.now()}`,
      text: `🛡️ Feixe Interceptado!`,
      subText: `Torre Aliada bloqueou ${label}`,
      tone: 'reinforcement',
      createdAtMs: snap.elapsedMs,
    }
    set({
      snapshot: {
        ...snap,
        recentFeedback: [...snap.recentFeedback.slice(-4), fbShield],
      },
    })
  },

  triggerBridgeDeconstructionToBase: () => {
    const state = get()
    const { save, snapshot, bridgeSectorIndex, runPlan, mathChallengesSolvedInRun } = state
    const prevBankedMark = save.activeRunCheckpoint?.bankedScoreMark ?? runPlan.n0
    const coinsBonus = Math.max(0, snapshot.bridgeCoinsEarned ?? 0)
    const sectorBonus = bridgeSectorIndex > 1 ? (bridgeSectorIndex - 1) * 15 : 0
    const totalRunContribution = snapshot.currentArmy + coinsBonus + sectorBonus
    const extractedTroops = clampArmy(Math.max(0, totalRunContribution - prevBankedMark))
    const nextReserveTroops = clampArmy(save.reserveTroops + extractedTroops)
    const nextTotalScore = Math.max(
      save.stats.totalPlayerScore ?? 0,
      nextReserveTroops + (bridgeSectorIndex - 1) * 50 + (snapshot.bridgeKills ?? 0),
    )

    const nextSave = buildSaveWithCheckpoint(
      {
        ...save,
        reserveTroops: nextReserveTroops,
        playerBridgeTowerLevels: state.playerBridgeTowerLevels,
        stats: {
          ...save.stats,
          totalPlayerScore: nextTotalScore,
        },
      },
      {
        sectorIndex: bridgeSectorIndex,
        currentArmy: snapshot.currentArmy,
        bridgeCoinsEarned: snapshot.bridgeCoinsEarned ?? 0,
        bridgeKills: snapshot.bridgeKills ?? 0,
        mathChallengesSolved: mathChallengesSolvedInRun,
        seed: runPlan.seed,
        bankedScoreMark: Math.max(prevBankedMark, totalRunContribution),
      },
    )
    SaveRepository.save(nextSave)

    // Inicia animação 3D de Desconstrução Tática da Ponte (~280ms) já com a Carteira 100% sincronizada
    set({
      save: nextSave,
      isDeconstructingBridge: true,
      deconstructionProgress: 0.38,
      bridgeBaseDrawerOpen: false,
    })

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        if (get().isDeconstructingBridge) {
          set({ deconstructionProgress: 0.82 })
        }
      }, 110)
      window.setTimeout(() => {
        set((s) => ({
          world: 'realm',
          isDeconstructingBridge: false,
          deconstructionProgress: 1,
          deconstructionCompletedCount: s.deconstructionCompletedCount + 1,
          lastDirectAttackResult: null,
          battleResolution: null,
          activeTrapHit: null,
          activeRedemptionTokenId: null,
          activeMathChallenge: null,
          activeMathChallengeDiagnostic: null,
          settingsPopoverOpen: false,
          activeRealmSheet: 'none',
          captainSpeech: {
            mood: 'proud',
            text: `🏰 Ponte recolhida e Carteira Compartilhada sincronizada! Reserva da Base Principal: ${formatArmy(s.save.reserveTroops, s.save.settings.notationMode)} soldados!`,
          },
        }))
      }, 260)
    } else {
      get().extractRunToBase()
    }
  },

  extractRunToBase: () => {
    const state = get()
    const { save, snapshot, bridgeSectorIndex, runPlan, mathChallengesSolvedInRun } = state
    const prevBankedMark = save.activeRunCheckpoint?.bankedScoreMark ?? runPlan.n0
    const coinsBonus = Math.max(0, snapshot.bridgeCoinsEarned ?? 0)
    const sectorBonus = bridgeSectorIndex > 1 ? (bridgeSectorIndex - 1) * 15 : 0
    const totalRunContribution = snapshot.currentArmy + coinsBonus + sectorBonus
    const extractedTroops = clampArmy(Math.max(0, totalRunContribution - prevBankedMark))
    const nextReserveTroops = clampArmy(save.reserveTroops + extractedTroops)
    const nextTotalScore = Math.max(
      save.stats.totalPlayerScore ?? 0,
      nextReserveTroops + (bridgeSectorIndex - 1) * 50 + (snapshot.bridgeKills ?? 0),
    )

    const nextSave = buildSaveWithCheckpoint(
      {
        ...save,
        reserveTroops: nextReserveTroops,
        playerBridgeTowerLevels: state.playerBridgeTowerLevels,
        stats: {
          ...save.stats,
          totalPlayerScore: nextTotalScore,
        },
      },
      {
        sectorIndex: bridgeSectorIndex,
        currentArmy: snapshot.currentArmy,
        bridgeCoinsEarned: snapshot.bridgeCoinsEarned ?? 0,
        bridgeKills: snapshot.bridgeKills ?? 0,
        mathChallengesSolved: mathChallengesSolvedInRun,
        seed: runPlan.seed,
        bankedScoreMark: Math.max(prevBankedMark, totalRunContribution),
      },
    )
    SaveRepository.save(nextSave)

    set({
      save: nextSave,
      world: 'realm',
      isDeconstructingBridge: false,
      deconstructionProgress: 1,
      deconstructionCompletedCount: state.deconstructionCompletedCount + 1,
      bridgeBaseDrawerOpen: false,
      lastDirectAttackResult: null,
      battleResolution: null,
      activeTrapHit: null,
      activeRedemptionTokenId: null,
      activeMathChallenge: null,
      activeMathChallengeDiagnostic: null,
      settingsPopoverOpen: false,
      activeRealmSheet: 'none',
      captainSpeech: {
        mood: 'proud',
        text: `🏰 Progresso salvo no IndexedDB e Cache! Setor S${bridgeSectorIndex} preservado e Reserva do Reino agora em ${formatArmy(nextReserveTroops, nextSave.settings.notationMode)} soldados!`,
      },
    })
  },

  switchBridgeBiomeWithoutReset: (biomeId) => {
    const state = get()
    const targetLaneCount: 2 | 3 = BIOMES[biomeId]?.laneCount ?? 2
    const currentSnap = state.snapshot

    // Ajustar quantidade de faixas dos segmentos sem perder exército, setor, moedas ou progresso!
    const adaptedSegments = currentSnap.segments.map((seg) => {
      if (seg.lanes.length === targetLaneCount) return seg
      if (targetLaneCount === 3 && seg.lanes.length === 2) {
        return {
          ...seg,
          lanes: [seg.lanes[0], seg.lanes[1], seg.lanes[0]],
        }
      }
      return {
        ...seg,
        lanes: seg.lanes.slice(0, targetLaneCount),
      }
    })

    const shouldRecycleSegments =
      currentSnap.phase === 'VICTORY' ||
      currentSnap.phase === 'DEFEAT' ||
      currentSnap.activeSegmentIndex >= adaptedSegments.length
    const preservedArmy =
      currentSnap.currentArmy > 0
        ? currentSnap.currentArmy
        : Math.max(5, state.runPlan.n0)

    const nextSave = buildSaveWithCheckpoint(state.save, {
      sectorIndex: state.bridgeSectorIndex,
      currentArmy: preservedArmy,
      bridgeCoinsEarned: currentSnap.bridgeCoinsEarned ?? 0,
      bridgeKills: currentSnap.bridgeKills ?? 0,
      mathChallengesSolved: state.mathChallengesSolvedInRun,
      seed: state.runPlan.seed,
    })
    SaveRepository.save(nextSave)

    set({
      world: 'run',
      activeEngineId: 'ponte_portoes',
      save: nextSave,
      battleResolution: null,
      redemptionContract: null,
      activeTrapHit: null,
      runPlan: {
        ...state.runPlan,
        // V8: Mantém o bioma único da ponte sem reiniciar do zero!
        biomeId: CANONICAL_BRIDGE_BIOME_ID,
        laneCount: targetLaneCount,
        segments: adaptedSegments,
      },
      snapshot: {
        ...currentSnap,
        runId:
          currentSnap.phase === 'DEFEAT'
            ? `${currentSnap.runId}_rematch_${Date.now()}`
            : currentSnap.runId,
        currentArmy: preservedArmy,
        crowdNodes: buildCrowdNodes(preservedArmy),
        progress: shouldRecycleSegments ? 0 : currentSnap.progress,
        activeSegmentIndex: shouldRecycleSegments ? 0 : currentSnap.activeSegmentIndex,
        resolvedSegments: shouldRecycleSegments ? {} : currentSnap.resolvedSegments,
        phase:
          currentSnap.phase === 'VICTORY' ||
          currentSnap.phase === 'DEFEAT' ||
          currentSnap.phase === 'BATTLE'
            ? nextSave.settings.calmMode
              ? 'CALM_WAIT'
              : 'RUNNING'
            : currentSnap.phase,
        laneCount: targetLaneCount,
        currentLane: Math.min(targetLaneCount - 1, currentSnap.currentLane),
        segments: adaptedSegments,
      },
    })
  },

  resumeCheckpointFromSave: () => {
    const state = get()
    const cp = state.save.activeRunCheckpoint
    if (!cp || cp.currentArmy <= 0) return
    const nextArmy = clampArmy(cp.currentArmy)
    set({
      bridgeSectorIndex: Math.max(1, cp.sectorIndex),
      infiniteBridgeMode: cp.sectorIndex > 1 || state.infiniteBridgeMode,
      mathChallengesSolvedInRun: cp.mathChallengesSolved,
      snapshot: {
        ...state.snapshot,
        currentArmy: nextArmy,
        crowdNodes: buildCrowdNodes(nextArmy),
        bridgeCoinsEarned: cp.bridgeCoinsEarned,
        bridgeKills: cp.bridgeKills,
      },
    })
  },

  toggleInfiniteBridgeMode: () => {
    set((s) => ({
      infiniteBridgeMode: !s.infiniteBridgeMode,
      captainSpeech: {
        mood: 'excited',
        text: !s.infiniteBridgeMode
          ? `♾️ Modo Infinito ATIVO! Setor ${s.bridgeSectorIndex}: ao vencer o Boss, a ponte avança automaticamente para o próximo Setor com chefes maiores!`
          : 'Modo Campanha Padrão ativo: conclua o setor atual para enfrentar o choque final.',
      },
    }))
  },

  steerToRoute: (route) => {
    const state = get()
    const targetLaneNormX =
      route === 'LEFT' ? -0.82 : route === 'RIGHT' ? 0.82 : -0.2264
    const laneIdx = resolveLaneIndexFromNormX(targetLaneNormX, state.snapshot.laneCount)
    soundEngine.playLaneSwitch(laneIdx)
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as { __lbHeroPos?: { x: number; y: number } }
      ).__lbHeroPos = { x: targetLaneNormX, y: state.snapshot.progress }
    }
    set({
      snapshot: {
        ...state.snapshot,
        laneX: targetLaneNormX,
        currentLane: laneIdx,
      },
    })
  },

  applySideRouteReward: (route, soldiersDelta, reasonLabel) => {
    const state = get()
    if (state.isDeconstructingBridge) return
    const snap = state.snapshot
    if (
      snap.phase !== 'RUNNING' &&
      snap.phase !== 'CALM_WAIT' &&
      snap.phase !== 'BATTLE'
    ) {
      return
    }
    const nextArmy = clampArmy(Math.max(1, snap.currentArmy + soldiersDelta))
    const fb: FloatingFeedbackItem = {
      id: `fb_side_${route}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: `${reasonLabel}`,
      tone: 'reinforcement',
      createdAtMs: snap.elapsedMs,
    }
    const nextSave = buildSaveWithCheckpoint(state.save, {
      sectorIndex: state.bridgeSectorIndex,
      currentArmy: nextArmy,
      bridgeCoinsEarned: snap.bridgeCoinsEarned ?? 0,
      bridgeKills: snap.bridgeKills ?? 0,
      mathChallengesSolved: state.mathChallengesSolvedInRun,
      seed: state.runPlan.seed,
    })
    SaveRepository.save(nextSave)
    soundEngine.playGatePass(nextArmy, true)
    set({
      save: nextSave,
      snapshot: {
        ...snap,
        currentArmy: nextArmy,
        crowdNodes: buildCrowdNodes(nextArmy),
        recentFeedback: [...snap.recentFeedback.slice(-4), fb],
      },
    })
  },

  onSectorBossDefeatedInBridge: (newSector, bonusSoldiers) => {
    const state = get()
    if (state.isDeconstructingBridge) return
    const snap = state.snapshot
    if (snap.phase !== 'RUNNING' && snap.phase !== 'CALM_WAIT') return
    const nextArmy = clampArmy(snap.currentArmy + bonusSoldiers)
    const spec = computeSectorBossSpec(newSector)
    const scaledBossHp = clampArmy(spec.bossHp)
    const scaledHorde = clampArmy(spec.hordeHp)
    const coinsReward = spec.sectorClearRewardCoins
    const bonusStr = formatArmy(bonusSoldiers, state.save.settings.notationMode)
    const fb: FloatingFeedbackItem = {
      id: `fb_sector_boss_${newSector}_${Date.now()}`,
      text: `👹 BOSS ABATIDO! +${bonusStr} 🛡️ · +${coinsReward}🪙 · Setor ${newSector}`,
      tone: 'optimal',
      createdAtMs: snap.elapsedMs,
    }
    // V9 (Pilar 2): Escala Ortogonal — Rota Central escala apenas com o Nível dos Monstros (spec.totalForce)
    const monsterScale = Math.max(25, Math.round(spec.totalForce * 0.22))
    const updatedSegments =
      newSector > 1
        ? snap.segments.map((seg, idx) => ({
            ...seg,
            lanes: seg.lanes.map((laneGates) =>
              laneGates.map((g) => {
                if (g.op === '+') {
                  const scaledNum = Math.max(
                    g.operand.value,
                    Math.round(monsterScale * (0.25 + idx * 0.06)),
                  )
                  return {
                    ...g,
                    label: `+ ${formatArmy(scaledNum, 'compact')}`,
                    operand: { value: scaledNum, num: scaledNum, den: 1 },
                  }
                }
                if (g.op === '−') {
                  const scaledSub = Math.max(
                    g.operand.value,
                    Math.round(monsterScale * (0.18 + idx * 0.04)),
                  )
                  return {
                    ...g,
                    label: `− ${formatArmy(scaledSub, 'compact')}`,
                    operand: { value: scaledSub, num: scaledSub, den: 1 },
                  }
                }
                return g
              }),
            ),
          }))
        : snap.segments
    const shouldRecycleCenterWave =
      snap.activeSegmentIndex >= updatedSegments.length || snap.progress >= 0.85
    const nextSave = buildSaveWithCheckpoint(
      {
        ...state.save,
        reserveTroops: clampArmy(
          state.save.reserveTroops + Math.max(10, Math.round(bonusSoldiers * 0.6)),
        ),
        wisdomStars: state.save.wisdomStars + 1,
      },
      {
        sectorIndex: newSector,
        currentArmy: nextArmy,
        bridgeCoinsEarned: (snap.bridgeCoinsEarned ?? 0) + coinsReward,
        bridgeKills: (snap.bridgeKills ?? 0) + 1,
        mathChallengesSolved: state.mathChallengesSolvedInRun,
        seed: state.runPlan.seed,
      },
    )
    SaveRepository.save(nextSave)
    soundEngine.playVictoryFanfare()
    if (shouldRecycleCenterWave) {
      tapAdvanceUsedInCurrentWave = false
    }
    set({
      save: nextSave,
      bridgeSectorIndex: newSector,
      snapshot: {
        ...snap,
        currentArmy: nextArmy,
        crowdNodes: buildCrowdNodes(nextArmy),
        bridgeCoinsEarned: (snap.bridgeCoinsEarned ?? 0) + coinsReward,
        bridgeKills: (snap.bridgeKills ?? 0) + 1,
        progress: shouldRecycleCenterWave ? 0.01 : snap.progress,
        activeSegmentIndex: shouldRecycleCenterWave ? 0 : snap.activeSegmentIndex,
        resolvedSegments: shouldRecycleCenterWave ? {} : snap.resolvedSegments,
        segments: updatedSegments,
        enemy: {
          ...snap.enemy,
          bossName: `${spec.archetype.namePt} S${newSector}`,
          bossTitle: `${spec.archetype.titlePt} · Setor ${newSector}`,
          horde: scaledHorde,
          bossHp: scaledBossHp,
          totalForce: clampArmy(scaledHorde + scaledBossHp),
        },
        recentFeedback: [...snap.recentFeedback.slice(-4), fb],
      },
      captainSpeech: {
        mood: 'proud',
        text: `Mega-Boss derrotado! Caravana Dourada liberada na ponte (+${bonusStr} soldados e +${coinsReward} moedas)! Próximo Boss (${spec.archetype.namePt}) em 7,5s!`,
      },
    })
  },

  advanceInfiniteBridgeSector: () => {
    const state = get()
    const { save, runPlan, snapshot } = state
    const nextSector = state.bridgeSectorIndex + 1
    const spec = computeSectorBossSpec(nextSector)
    const sectorBonus = Math.max(
      spec.sectorClearRewardSoldiers,
      Math.round(snapshot.currentArmy * 0.15),
    )
    const carryArmy = clampArmy(Math.max(5, snapshot.currentArmy + sectorBonus))
    const nextSeed = runPlan.seed + nextSector * 997
    const scaledBossHp = clampArmy(spec.bossHp)
    const scaledHorde = clampArmy(spec.hordeHp)

    const nextPlan = generateRun({
      seed: nextSeed,
      biomeId: CANONICAL_BRIDGE_BIOME_ID,
      regionId: runPlan.regionId,
      n0: carryArmy,
      enemy: {
        horde: scaledHorde,
        bossHp: scaledBossHp,
        bossName: `${spec.archetype.namePt} S${nextSector}`,
        bossTitle: `${spec.archetype.titlePt} · Setor ${nextSector}`,
        totalForce: clampArmy(scaledHorde + scaledBossHp),
      },
      mastery: save.mastery,
      observatoryLevel: save.citadelLevels.observatorio ?? 1,
      trapAlertSeenCount: save.trapAlertSeenCount,
    })

    const nextOracle = pathOracle(nextPlan)
    const fbSector: FloatingFeedbackItem = {
      id: `fb_inf_sector_${nextSector}_${Date.now()}`,
      text: `♾️ SETOR ${nextSector}! +${formatArmy(sectorBonus, save.settings.notationMode)} 🛡️`,
      tone: 'optimal',
      createdAtMs: snapshot.elapsedMs,
    }
    const nextCoins = (snapshot.bridgeCoinsEarned ?? 0) + spec.sectorClearRewardCoins
    const nextSave = buildSaveWithCheckpoint(
      {
        ...save,
        reserveTroops: clampArmy(
          save.reserveTroops + Math.max(10, Math.round(sectorBonus * 0.5)),
        ),
      },
      {
        sectorIndex: nextSector,
        currentArmy: carryArmy,
        bridgeCoinsEarned: nextCoins,
        bridgeKills: snapshot.bridgeKills ?? 0,
        mathChallengesSolved: state.mathChallengesSolvedInRun,
        seed: nextSeed,
      },
    )
    SaveRepository.save(nextSave)
    soundEngine.playVictoryFanfare()
    tapAdvanceUsedInCurrentWave = false

    set({
      save: nextSave,
      infiniteBridgeMode: true,
      bridgeSectorIndex: nextSector,
      runPlan: nextPlan,
      oracle: nextOracle,
      battleResolution: null,
      redemptionContract: null,
      activeTrapHit: null,
      snapshot: {
        ...snapshot,
        runId: `${nextPlan.runId}_s${nextSector}_${++runInstanceSeq}`,
        phase: save.settings.calmMode ? 'CALM_WAIT' : 'RUNNING',
        progress: 0.02,
        currentArmy: carryArmy,
        crowdNodes: buildCrowdNodes(carryArmy),
        bridgeCoinsEarned: nextCoins,
        activeSegmentIndex: 0,
        segments: nextPlan.segments,
        resolvedSegments: {},
        enemy: nextPlan.enemy,
        recentFeedback: [...snapshot.recentFeedback.slice(-4), fbSector],
      },
      captainSpeech: {
        mood: 'excited',
        text: `♾️ Setor ${nextSector} salvo automaticamente no IndexedDB e Cache! Novo Mega-Boss: ${spec.archetype.namePt} (${formatArmy(scaledBossHp, save.settings.notationMode)} HP)!`,
      },
    })
  },

  openMathChallengeModal: (tier) => {
    const state = get()
    const chosenTier: MathDifficultyTier =
      tier ?? state.activeMathChallenge?.tier ?? 2
    const seed =
      state.runPlan.seed +
      (state.mathChallengesSolvedInRun + 1) * 997 +
      chosenTier * 313 +
      Math.floor(performance.now() % 10000)
    const challenge = generateInfiniteChallenge({
      tier: chosenTier,
      seed,
    })
    set({
      activeMathChallenge: challenge,
      activeMathChallengeScaffold: 1,
      activeMathChallengeDiagnostic: null,
      captainSpeech: {
        mood: 'curious',
        text: `Altar Matemático aberto (${MATH_CHALLENGE_TIER_POLICIES[chosenTier].titlePt})! Escolha qualquer dificuldade (Fácil, Médio, Difícil ou Problema) para ganhar mais soldados, moedas e buffs!`,
      },
    })
  },

  switchMathChallengeTier: (tier) => {
    const state = get()
    const seed =
      state.runPlan.seed +
      (state.mathChallengesSolvedInRun + 1) * 1423 +
      tier * 521 +
      Math.floor(performance.now() % 10000)
    const challenge = generateInfiniteChallenge({
      tier,
      seed,
    })
    set({
      activeMathChallenge: challenge,
      activeMathChallengeScaffold: 1,
      activeMathChallengeDiagnostic: null,
      captainSpeech: {
        mood: 'curious',
        text: `Nível alterado para ${MATH_CHALLENGE_TIER_POLICIES[tier].titlePt}: ${MATH_CHALLENGE_TIER_POLICIES[tier].engineRewardSummary[state.activeEngineId]}`,
      },
    })
  },

  submitMathChallengeChoice: (choiceId) => {
    const state = get()
    const challenge = state.activeMathChallenge
    if (!challenge) return

    const chosen = challenge.choices.find((c) => c.id === choiceId)
    if (!chosen) return

    if (!chosen.isCorrect) {
      const nextScaffold: 1 | 2 | 3 =
        state.activeMathChallengeScaffold === 1 ? 2 : 3
      set({
        activeMathChallengeScaffold: nextScaffold,
        activeMathChallengeDiagnostic: chosen.diagnosticPt,
        captainSpeech: {
          mood: 'curious',
          text: `${chosen.diagnosticPt} Veja a Dica Socrática Nível ${nextScaffold} abaixo e tente novamente sem perder nada!`,
        },
      })
      return
    }

    // Resposta correta! Aplica recompensas de soldados, moedas, combo e buffs!
    soundEngine.playRedemptionSuccess()
    const policy = MATH_CHALLENGE_TIER_POLICIES[challenge.tier]
    const snap = state.snapshot
    const multBonus = Math.max(
      0,
      Math.round(snap.currentArmy * (policy.armyMultiplier - 1)),
    )
    const baseSoldiersAdded = Math.max(
      policy.flatSoldiersBonus,
      multBonus + Math.round(policy.flatSoldiersBonus * 0.5),
    )
    const expStreakFactor =
      state.activeEngineId === 'ponte_portoes'
        ? Math.pow(1.25, Math.min(state.mathChallengesSolvedInRun, 20))
        : 1
    const soldiersAdded = Math.max(
      policy.flatSoldiersBonus,
      Math.round(baseSoldiersAdded * expStreakFactor),
    )
    const nextArmy = clampArmy(snap.currentArmy + soldiersAdded)
    const nextCoins = (snap.bridgeCoinsEarned ?? 0) + policy.coinsBonus
    const nextStreak = (snap.calcComboStreak ?? 0) + 1
    const nextMult = getComboMultiplier(nextStreak)
    const nextSeq = state.mathChallengesSolvedInRun + 1

    const rewardSummary =
      policy.engineRewardSummary[state.activeEngineId] ?? policy.titlePt

    const fbMath: FloatingFeedbackItem = {
      id: `fb_math_${Date.now()}_${nextSeq}`,
      text: `🧮 +${formatArmy(soldiersAdded, state.save.settings.notationMode)} · +${policy.coinsBonus}🪙`,
      subText: rewardSummary,
      tone: 'reinforcement',
      createdAtMs: snap.elapsedMs,
    }

    const nextSave = buildSaveWithCheckpoint(
      {
        ...state.save,
        wisdomStars: state.save.wisdomStars + (challenge.tier >= 3 ? 2 : 1),
        recentMathSignatures: getRecentMathSignaturesSnapshot(),
      },
      {
        sectorIndex: state.bridgeSectorIndex,
        currentArmy: nextArmy,
        bridgeCoinsEarned: nextCoins,
        bridgeKills: snap.bridgeKills ?? 0,
        mathChallengesSolved: nextSeq,
        seed: state.runPlan.seed,
      },
    )
    SaveRepository.save(nextSave)

    set({
      save: nextSave,
      activeMathChallenge: null,
      activeMathChallengeScaffold: 1,
      activeMathChallengeDiagnostic: null,
      mathChallengesSolvedInRun: nextSeq,
      lastSolvedMathRewardAt: {
        seq: nextSeq,
        tier: challenge.tier,
        coinsBonus: policy.coinsBonus,
        soldiersBonus: soldiersAdded,
        armyMultiplier: policy.armyMultiplier,
        weaponDmgMultiplier: policy.weaponDmgMultiplier,
        summaryPt: rewardSummary,
        correctValue: challenge.correctValue,
        expressionBadge: challenge.expressionBadge ?? '',
      },
      snapshot: {
        ...snap,
        currentArmy: nextArmy,
        crowdNodes: buildCrowdNodes(nextArmy),
        bridgeCoinsEarned: nextCoins,
        calcComboStreak: nextStreak,
        calcComboMultiplier: nextMult,
        recentFeedback: [...snap.recentFeedback.slice(-4), fbMath],
      },
      captainSpeech: {
        mood: 'proud',
        text: `Conta resolvida (${policy.titlePt})! Você ganhou +${formatArmy(soldiersAdded, state.save.settings.notationMode)} soldados, +${policy.coinsBonus} 🪙 e ${rewardSummary}!`,
      },
    })
  },

  closeMathChallengeModal: () => {
    set({
      activeMathChallenge: null,
      activeMathChallengeDiagnostic: null,
    })
  },

  switchWorld: (world) => {
    if (world === 'realm' && get().world === 'run') {
      get().extractRunToBase()
      return
    }
    set({
      world,
      lastDirectAttackResult: null,
      battleResolution: null,
      activeTrapHit: null,
      activeRedemptionTokenId: null,
      activeMathChallenge: null,
      activeMathChallengeDiagnostic: null,
      settingsPopoverOpen: false,
      activeRealmSheet: 'none',
    })
  },

  selectEngine: (engineId, startImmediately = true) => {
    if (!ENGINE_CATALOG[engineId]) return
    if (startImmediately) {
      get().startNewRun({ engineId })
    } else {
      set({ activeEngineId: engineId })
    }
  },

  recordBridgeEnemyKill: (
    coinsDelta = 2,
    damageDealt = 1,
    playerAttritionLoss = 0,
  ) => {
    const state = get()
    if (state.isDeconstructingBridge) return
    const snap = state.snapshot
    if (
      snap.phase !== 'RUNNING' &&
      snap.phase !== 'CALM_WAIT' &&
      snap.phase !== 'BATTLE'
    ) {
      return
    }

    const safeDmg = Math.max(0, Math.round(damageDealt))
    const hordeDmg = Math.min(snap.enemy.horde, Math.ceil(safeDmg * 0.65))
    const nextHorde = Math.max(0, snap.enemy.horde - hordeDmg)
    const minMarchBossHp = Math.max(
      8,
      Math.round(state.runPlan.enemy.bossHp * 0.2),
    )
    const bossOverflowDmg =
      snap.progress >= 0.45 || nextHorde === 0
        ? Math.max(0, safeDmg - hordeDmg)
        : 0
    const nextBossHp = Math.max(
      minMarchBossHp,
      snap.enemy.bossHp - bossOverflowDmg,
    )
    const nextTotalForce = nextHorde + nextBossHp

    // V8 Fase 3: Fim da Imortalidade AFK! Monstros e o Boss podem zerar o exército e causar DEFEAT real!
    const nextPlayerArmy =
      playerAttritionLoss > 0
        ? clampArmy(snap.currentArmy - Math.round(playerAttritionLoss))
        : snap.currentArmy

    const updatedKills = (snap.bridgeKills ?? 0) + (safeDmg > 0 ? Math.max(1, safeDmg) : 0)
    const updatedCoins = (snap.bridgeCoinsEarned ?? 0) + Math.max(0, coinsDelta)

    if (nextPlayerArmy <= 0) {
      soundEngine.playDefeatRegroup()
      const liveBridgeBossHp =
        typeof window !== 'undefined'
          ? Math.round(
              (
                window as unknown as {
                  __lbBridge3DTelemetry?: { bossHp?: number }
                }
              ).__lbBridge3DTelemetry?.bossHp ?? 0,
            )
          : 0
      const effectiveEnemyForce = Math.max(1, nextTotalForce, liveBridgeBossHp)
      const defeatResolution: BattleResolution = {
        outcome: 'DEFEAT',
        playerArmy: 0,
        enemyForce: effectiveEnemyForce,
        survivors: 0,
        deficit: effectiveEnemyForce,
        durationMs: snap.elapsedMs,
      }
      const contract = evaluateRedemptionContract(
        0,
        effectiveEnemyForce,
        state.tokensInRun,
      )
      const nextSaveDefeat = buildSaveWithCheckpoint(
        {
          ...state.save,
          remainderVault: state.save.remainderVault + snap.remainderBankInRun,
          stats: {
            ...state.save.stats,
            runsPlayed: state.save.stats.runsPlayed + 1,
          },
        },
        {
          sectorIndex: state.bridgeSectorIndex,
          currentArmy: Math.max(5, state.runPlan.n0),
          bridgeCoinsEarned: updatedCoins,
          bridgeKills: updatedKills,
          mathChallengesSolved: state.mathChallengesSolvedInRun,
          seed: state.runPlan.seed,
        },
      )
      SaveRepository.save(nextSaveDefeat)
      set({
        save: nextSaveDefeat,
        activeTrapHit: null,
        battleResolution: defeatResolution,
        redemptionContract: contract,
        snapshot: {
          ...snap,
          currentArmy: 0,
          crowdNodes: [],
          activeMergeEvent: null,
          phase: 'DEFEAT',
          bridgeKills: updatedKills,
          bridgeCoinsEarned: updatedCoins,
        },
        captainSpeech: {
          mood: 'curious',
          text: `Nosso batalhão foi dizimado no Setor ${state.bridgeSectorIndex}! Pontuação e progresso salvos automaticamente no IndexedDB e Cache!`,
        },
      })
      return
    }

    set({
      snapshot: {
        ...snap,
        currentArmy: nextPlayerArmy,
        crowdNodes:
          nextPlayerArmy !== snap.currentArmy
            ? buildCrowdNodes(nextPlayerArmy)
            : snap.crowdNodes,
        enemy: {
          ...snap.enemy,
          horde: nextHorde,
          bossHp: nextBossHp,
          totalForce: nextTotalForce,
        },
        bridgeKills: updatedKills,
        bridgeCoinsEarned: updatedCoins,
      },
    })
  },

  completeEngineRun: (result) => {
    const state = get()
    const { save, runPlan, snapshot } = state
    const safePlayer = clampArmy(result.playerArmy)
    const safeEnemy = clampArmy(result.enemyForce)
    const resolution: BattleResolution = {
      outcome: result.outcome,
      playerArmy: safePlayer,
      enemyForce: safeEnemy,
      survivors: result.outcome === 'VICTORY' ? Math.max(1, result.survivors) : 0,
      deficit: result.outcome === 'DEFEAT' ? Math.max(1, safeEnemy - safePlayer) : 0,
      durationMs: result.durationMs,
    }
    const contract = evaluateRedemptionContract(
      safePlayer,
      safeEnemy,
      state.tokensInRun,
    )

    if (result.outcome === 'VICTORY') {
      soundEngine.playVictoryFanfare()
      const region = REGIONS[runPlan.regionId] ?? REGIONS.r01_ponte_aurora
      const alreadyConquered = save.conqueredRegionIds.includes(region.id)
      const nextConquered = alreadyConquered
        ? save.conqueredRegionIds
        : [...save.conqueredRegionIds, region.id]
      const passiveTribute = calculatePassiveTribute(nextConquered)
      const comboMult = Math.max(1, result.maxCombo)
      const totalReward = Math.round(
        (region.rewardTroops + passiveTribute + result.coinsEarned) *
          (1 + (comboMult - 1) * 0.25),
      )

      const nextSaveWin: SaveV1 = {
        ...save,
        reserveTroops: clampArmy(save.reserveTroops + totalReward),
        remainderVault: save.remainderVault + result.remaindersEarned,
        wisdomStars: save.wisdomStars + Math.max(1, result.starsEarned),
        conqueredRegionIds: nextConquered,
        stats: {
          ...save.stats,
          runsPlayed: save.stats.runsPlayed + 1,
          runsWon: save.stats.runsWon + 1,
          highestArmyReached: Math.max(
            save.stats.highestArmyReached,
            safePlayer,
          ),
        },
      }
      SaveRepository.save(nextSaveWin)

      set({
        save: nextSaveWin,
        activeTrapHit: null,
        battleResolution: resolution,
        redemptionContract: contract,
        snapshot: {
          ...snapshot,
          progress: 1,
          currentArmy: resolution.survivors,
          crowdNodes: buildCrowdNodes(resolution.survivors),
          calcComboMultiplier: comboMult,
          bridgeCoinsEarned: result.coinsEarned,
          phase: 'VICTORY',
        },
      })
    } else {
      soundEngine.playDefeatRegroup()
      const nextSaveDefeat: SaveV1 = {
        ...save,
        remainderVault: save.remainderVault + result.remaindersEarned,
        stats: {
          ...save.stats,
          runsPlayed: save.stats.runsPlayed + 1,
          highestArmyReached: Math.max(
            save.stats.highestArmyReached,
            safePlayer,
          ),
        },
      }
      SaveRepository.save(nextSaveDefeat)

      set({
        save: nextSaveDefeat,
        activeTrapHit: null,
        battleResolution: resolution,
        redemptionContract: contract,
        snapshot: {
          ...snapshot,
          progress: 1,
          currentArmy: 0,
          crowdNodes: [],
          phase: 'DEFEAT',
        },
      })
    }
  },

  toggleDebugMode: () => {
    set((s) => ({ debugMode: !s.debugMode }))
  },

  toggleSettingsPopover: (open) => {
    set((s) => ({
      settingsPopoverOpen: open !== undefined ? open : !s.settingsPopoverOpen,
    }))
  },

  setActiveRealmSheet: (sheet) => {
    set({ activeRealmSheet: sheet })
  },

  startNewRun: (rawOpts, legacySeed) => {
    const opts =
      typeof rawOpts === 'string'
        ? { biomeId: rawOpts as BiomeId, seed: legacySeed }
        : rawOpts
    // V8: Se chamado apenas com biomeId (ex.: atalho legado de bioma), NUNCA reinicia o progresso!
    if (
      opts?.biomeId &&
      opts.regionId === undefined &&
      opts.seed === undefined &&
      opts.engineId === undefined
    ) {
      get().switchBridgeBiomeWithoutReset(opts.biomeId)
      return
    }

    const state = get()
    tapAdvanceUsedInCurrentWave = false
    const targetRegionId = opts?.regionId ?? state.save.selectedRegionId
    const region = REGIONS[targetRegionId] ?? REGIONS.r01_ponte_aurora
    // V8: Bioma único no modo Ponte ('planicie_pedra')
    const biomeId: BiomeId = CANONICAL_BRIDGE_BIOME_ID
    const engineId = opts?.engineId ?? state.activeEngineId ?? 'ponte_portoes'
    const seed =
      opts?.seed ??
      urlCfg.seed ??
      ((Date.now() % 1_000_000) + (state.save.stats.runsPlayed + 1) * 313)

    const baseQuartelArmy = Math.max(
      5,
      getInitialArmyFromQuartel(state.save.citadelLevels.quartel ?? 1),
    )
    // V8: Se não for um seed explícito de teste e o jogador já estiver num Setor > 1 na Ponte,
    // preserva o progresso da campanha contínua ao voltar do Reino ("Atacar ▶")!
    const preserveActiveBridgeCampaign =
      opts?.seed === undefined &&
      urlCfg.seed === undefined &&
      engineId === 'ponte_portoes' &&
      (state.bridgeSectorIndex > 1 || (state.save.activeRunCheckpoint?.sectorIndex ?? 1) > 1)
    const activeCp = state.save.activeRunCheckpoint
    const preservedSector = preserveActiveBridgeCampaign
      ? Math.max(state.bridgeSectorIndex, activeCp?.sectorIndex ?? 1)
      : 1
    const n0 = preserveActiveBridgeCampaign
      ? clampArmy(Math.max(baseQuartelArmy, state.snapshot.currentArmy, activeCp?.currentArmy ?? 0))
      : baseQuartelArmy

    const plan = generateRun({
      seed,
      biomeId,
      regionId: region.id,
      n0,
      enemy: buildSectorScaledEnemy(region, preservedSector, n0),
      mastery: state.save.mastery,
      observatoryLevel: state.save.citadelLevels.observatorio ?? 1,
      trapAlertSeenCount: state.save.trapAlertSeenCount,
    })

    const nextOracle = pathOracle(plan)
    const forjaLvl = state.save.citadelLevels.forja ?? 0
    const lunetas = CITADEL_BUILDINGS.forja.levelEffects[forjaLvl] ?? 1
    const preservedCoins = preserveActiveBridgeCampaign
      ? Math.max(state.snapshot.bridgeCoinsEarned ?? 0, activeCp?.bridgeCoinsEarned ?? 0)
      : 0
    const preservedKills = preserveActiveBridgeCampaign
      ? Math.max(state.snapshot.bridgeKills ?? 0, activeCp?.bridgeKills ?? 0)
      : 0
    const preservedMathSolved = preserveActiveBridgeCampaign
      ? Math.max(state.mathChallengesSolvedInRun, activeCp?.mathChallengesSolved ?? 0)
      : 0

    const nextSave = buildSaveWithCheckpoint(
      {
        ...state.save,
        selectedRegionId: region.id,
      },
      {
        sectorIndex: preservedSector,
        currentArmy: n0,
        bridgeCoinsEarned: preservedCoins,
        bridgeKills: preservedKills,
        mathChallengesSolved: preservedMathSolved,
        seed,
        bankedScoreMark: preserveActiveBridgeCampaign
          ? activeCp?.bankedScoreMark ?? n0
          : n0,
      },
    )
    SaveRepository.save(nextSave)

    const baseSnap = {
      ...createInitialSnapshotFromPlan(plan, nextSave.settings.calmMode),
      runId: `${plan.runId}_r${++runInstanceSeq}`,
    }
    const nextSnapshot: RunSnapshot = preserveActiveBridgeCampaign
      ? {
          ...baseSnap,
          currentArmy: n0,
          crowdNodes: buildCrowdNodes(n0),
          bridgeCoinsEarned: preservedCoins,
          bridgeKills: preservedKills,
        }
      : baseSnap

    set({
      world: 'run',
      activeEngineId: engineId,
      save: nextSave,
      runPlan: plan,
      oracle: nextOracle,
      snapshot: nextSnapshot,
      activeTrapHit: null,
      trapHistoryInRun: [],
      activeRedemptionTokenId: null,
      tokensInRun: [],
      lastRedeemDiagnostic: null,
      battleResolution: null,
      redemptionContract: null,
      activeMathChallenge: null,
      activeMathChallengeScaffold: 1,
      activeMathChallengeDiagnostic: null,
      mathChallengesSolvedInRun: preservedMathSolved,
      lastSolvedMathRewardAt: null,
      bridgeSectorIndex: preservedSector,
      infiniteBridgeMode: preserveActiveBridgeCampaign
        ? preservedSector > 1 || state.infiniteBridgeMode
        : false,
      lunetaChargesRemaining: lunetas,
      captainSpeech: {
        mood: 'excited',
        text:
          preservedSector > 1
            ? `Retomando a Grande Ponte no Setor S${preservedSector} com ${formatArmy(n0, nextSave.settings.notationMode)} soldados!`
            : `Marchando rumo a ${region.name}! Meta para vencer ${region.bossName}: ${formatArmy(plan.enemy.totalForce, nextSave.settings.notationMode)} soldados.`,
      },
    })
  },

  setSteeringX: (laneNormX) => {
    const state = get()
    const clampedX = Math.max(-1.0, Math.min(1.0, laneNormX))
    const laneIdx = resolveLaneIndexFromNormX(clampedX, state.snapshot.laneCount)
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as { __lbHeroPos?: { x: number; y: number } }
      ).__lbHeroPos = { x: clampedX, y: state.snapshot.progress }
    }
    set({
      snapshot: {
        ...state.snapshot,
        laneX: clampedX,
        currentLane: laneIdx,
      },
    })
  },

  stepLane: (delta) => {
    const state = get()
    // Passo suave horizontal contínuo (0.08) sem pulinhos para mover o esquadrão livremente pelas 3 rotas
    const stepSize = 0.08
    const nextX = Math.max(
      -0.96,
      Math.min(0.96, state.snapshot.laneX + delta * stepSize),
    )
    const nextLane = resolveLaneIndexFromNormX(nextX, state.snapshot.laneCount)
    if (nextLane !== state.snapshot.currentLane) {
      soundEngine.playLaneSwitch(nextLane)
    }
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as { __lbHeroPos?: { x: number; y: number } }
      ).__lbHeroPos = { x: nextX, y: state.snapshot.progress }
    }
    set({
      snapshot: {
        ...state.snapshot,
        currentLane: nextLane,
        laneX: nextX,
      },
    })
  },

  chooseLaneAndAdvance: (laneIndex) => {
    const state = get()
    const { snapshot } = state
    if (
      snapshot.phase !== 'RUNNING' &&
      snapshot.phase !== 'CALM_WAIT' &&
      snapshot.phase !== 'BATTLE'
    ) {
      return
    }
    const clampedLane = Math.max(0, Math.min(snapshot.laneCount - 1, laneIndex))
    const targetLaneX = getLaneCenterNormX(clampedLane, snapshot.laneCount)

    // Movimento livre e contínuo até o centro exato do portão selecionado
    const dx = targetLaneX - snapshot.laneX
    const steppedLaneX = targetLaneX

    if (clampedLane !== snapshot.currentLane) {
      soundEngine.playLaneSwitch(clampedLane)
    }
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as { __lbHeroPos?: { x: number; y: number } }
      ).__lbHeroPos = { x: steppedLaneX, y: snapshot.progress }
    }

    const seg = snapshot.segments[snapshot.activeSegmentIndex]
    const isLive3DBridgeStage =
      state.activeEngineId === 'ponte_portoes' &&
      snapshot.phase === 'RUNNING' &&
      typeof window !== 'undefined' &&
      Boolean(
        (window as unknown as { __lbBridge3DTelemetry?: unknown })
          .__lbBridge3DTelemetry,
      )
    // Na Ponte 3D em tempo real (RUNNING), escolher a faixa alinha o Herói exatamente com o centro do portão
    // sem teletransportar o portão nem consumir dois segmentos seguidos!
    if (!seg || snapshot.phase === 'BATTLE' || isLive3DBridgeStage) {
      set({
        snapshot: {
          ...snapshot,
          currentLane: clampedLane,
          laneX: steppedLaneX,
        },
      })
      return
    }

    const isSwitchingSide = Math.abs(dx) > 0.22 && snapshot.phase === 'RUNNING'
    const nextProgress = isSwitchingSide
      ? Math.min(seg.zPosition - 0.012, snapshot.progress + 0.025)
      : seg.zPosition

    set({
      snapshot: {
        ...snapshot,
        currentLane: clampedLane,
        laneX: steppedLaneX,
        phase: 'RUNNING',
        progress: Math.max(snapshot.progress, nextProgress),
      },
    })
    lastAdvanceViaTapButton = true
    tapAdvanceUsedInCurrentWave = true
    try {
      get().tickRun(16)
    } finally {
      lastAdvanceViaTapButton = false
    }
  },

  tickRun: (dtMs) => {
    if (dtMs >= 1000) {
      tapAdvanceUsedInCurrentWave = false
    }
    const state = get()
    const { snapshot, runPlan, save } = state

    const isModalOpen =
      state.activeMathChallenge !== null ||
      state.activeRedemptionTokenId !== null ||
      state.albumDrawerOpen ||
      state.codexDrawerSlug !== null ||
      state.settingsPopoverOpen

    if (
      (snapshot.phase !== 'RUNNING' && snapshot.phase !== 'CALM_WAIT') ||
      isModalOpen ||
      state.isDeconstructingBridge
    ) {
      return
    }

    const safeDt = Math.min(80, Math.max(0, dtMs))
    const nextElapsed = snapshot.elapsedMs + safeDt

    // V10 Fase 1 (UAT-V10-CENTER-CADENCE-10S):
    // Exibimos 1 único par de portões por vez na ponte e espaçamos o ciclo para ~8.5s–9.5s por segmento
    // (mantendo aceleração de saída do Castelo Norte no primeiro segundo para resposta visual imediata).
    const isInitialLaunchWindow =
      snapshot.activeSegmentIndex === 0 && snapshot.elapsedMs < 1150
    const steadyCycleMs = save.settings.calmMode ? 68000 : 58000
    const speedPerMs = isInitialLaunchWindow ? 1 / 33000 : 1 / steadyCycleMs
    const nextProgress = Math.min(1, snapshot.progress + safeDt * speedPerMs)

    const activeSeg = snapshot.segments[snapshot.activeSegmentIndex]

    // Verifica se o exército acabou de cruzar o segmento ativo
    if (
      activeSeg &&
      !snapshot.resolvedSegments[activeSeg.id] &&
      nextProgress >= activeSeg.zPosition
    ) {
      // V8/V9: Se o jogador estiver fisicamente nos Corredores Laterais (|laneX| > 0.52),
      // ele NÃO colide com os portões da Rota Central (pois está passando pela esteira lateral Esquerda/Direita)!
      if (Math.abs(snapshot.laneX) > 0.52) {
        const resolvedMap = {
          ...snapshot.resolvedSegments,
          [activeSeg.id]: { chosenLane: -1, resultArmy: snapshot.currentArmy },
        }
        const isFinalBypass =
          snapshot.activeSegmentIndex + 1 >= snapshot.segments.length
        set({
          snapshot: {
            ...snapshot,
            elapsedMs: nextElapsed,
            progress: isFinalBypass ? 1 : nextProgress,
            activeSegmentIndex: snapshot.activeSegmentIndex + 1,
            resolvedSegments: resolvedMap,
          },
        })
        if (isFinalBypass) {
          get().tickRun(16)
        }
        return
      }

      const heroWorldX = snapshot.laneX * 10.6
      const closestCenterGate = resolveClosestCenterGateFromWorldX(
        heroWorldX,
        activeSeg.lanes.length === 3 ? 3 : 2,
      )
      const chosenLane = Math.max(
        0,
        Math.min(activeSeg.lanes.length - 1, closestCenterGate.chosenLane),
      )
      const chosenGates = activeSeg.lanes[chosenLane] ?? []

      // Se for um Portão Dourado do Resgate na ponte: fluxo 100% contínuo (sem pausar para modal!)
      // V3 §2.2: Só conta se o jogador atravessar o portão dourado (checagem por gate.id, nunca por índice de faixa!)
      const isChosenRedemptionGate = chosenGates.some((g) =>
        g.id.startsWith('redemption_gate_'),
      )
      if (
        activeSeg.kind === 'redemption' &&
        activeSeg.redemptionTokenId &&
        isChosenRedemptionGate
      ) {
        const linkedToken = state.tokensInRun.find(
          (t) => t.id === activeSeg.redemptionTokenId,
        )
        const instantBonus =
          linkedToken && !linkedToken.used
            ? Math.max(1, Math.round(linkedToken.loss * 0.5))
            : 2
        const boostedArmy = clampArmy(snapshot.currentArmy + instantBonus)
        const nextStreak = (snapshot.calcComboStreak ?? 0) + 1
        const nextMult = getComboMultiplier(nextStreak)
        const resolvedMap = {
          ...snapshot.resolvedSegments,
          [activeSeg.id]: { chosenLane, resultArmy: boostedArmy },
        }
        const fbGold: FloatingFeedbackItem = {
          id: `fb_${activeSeg.id}`,
          text: `+${formatArmy(instantBonus, save.settings.notationMode)} · 🎟️ +1`,
          tone: 'reinforcement',
          createdAtMs: nextElapsed,
        }
        soundEngine.playGatePass(boostedArmy, true)
        set({
          snapshot: {
            ...snapshot,
            elapsedMs: nextElapsed,
            progress: nextProgress,
            currentArmy: boostedArmy,
            crowdNodes: buildCrowdNodes(boostedArmy),
            activeSegmentIndex: snapshot.activeSegmentIndex + 1,
            resolvedSegments: resolvedMap,
            recentFeedback: [...snapshot.recentFeedback.slice(-4), fbGold],
            calcComboStreak: nextStreak,
            calcComboMultiplier: nextMult,
            goldenTokensCollected: (snapshot.goldenTokensCollected ?? 0) + 1,
            phase: save.settings.calmMode ? 'CALM_WAIT' : 'RUNNING',
          },
          captainSpeech: {
            mood: 'excited',
            text: `Portão Dourado coletado! +${instantBonus} soldados e Ficha guardada para o final!`,
          },
        })
        return
      }

      const armyBefore = clampArmy(snapshot.currentArmy)
      // V9 (Pilar 2) + V10 (Pilar 1 — QAR1-V10-AUTHENTIC-DEBUFFS):
      // Portões benéficos (Azuis) mantêm escala ortogonal justa; todo portão negativo/redutor (Vermelho)
      // ou queda em pegadinha reduz DE VERDADE o exército atual (`nextArmy < armyBefore`).
      const monsterEvalCap = Math.max(105, Math.round(snapshot.enemy.totalForce * 1.5))
      const monsterRefBase = Math.max(
        25,
        Math.min(120, Math.round(snapshot.enemy.totalForce * 0.35)),
      )
      const useOrthogonalMonsterBase =
        armyBefore > monsterEvalCap ||
        (state.mathChallengesSolvedInRun > 0 && armyBefore > monsterRefBase)
      const effectiveEvalBase = useOrthogonalMonsterBase
        ? monsterRefBase
        : armyBefore
      const cf = evaluateSegmentCounterfactual(activeSeg, effectiveEvalBase)
      const appResult = applyGateChainWithRemainder(effectiveEvalBase, chosenGates)
      const wasOptimal = appResult.nextArmy >= cf.bestValue
      const isTrapFall =
        Boolean(activeSeg.trapId) && chosenLane === activeSeg.intuitiveLane
      const isNonOptimalPairDebuff =
        (activeSeg.kind === 'pair' || activeSeg.kind === 'twins') &&
        !wasOptimal &&
        activeSeg.lanes.length >= 2

      const authenticPass = applyAuthenticCenterGatePass({
        armyBefore,
        chosenGates,
        effectiveEvalBase,
        useOrthogonalMonsterBase,
        wasOptimal,
        isTrapFall: isTrapFall || isNonOptimalPairDebuff,
        enemyBaseLevel: state.enemyBaseLevel,
      })
      const rawNextArmy = clampArmy(authenticPass.nextArmy)
      const nextRemainderBank = snapshot.remainderBankInRun + authenticPass.remainder

      // Combo de Cálculo V3 (§2.2): escolher o portão ótimo sobe o multiplicador (×1 -> ×1,5 -> ×2 -> ×3)
      const nextComboStreak = wasOptimal ? (snapshot.calcComboStreak ?? 0) + 1 : 0
      const nextComboMult = getComboMultiplier(nextComboStreak)
      const comboBonusTroops =
        wasOptimal && nextComboStreak >= 2
          ? Math.max(
              1,
              Math.round(
                Math.max(1, rawNextArmy - armyBefore) * (nextComboMult - 1) * 0.25,
              ),
            )
          : 0
      const nextArmy = clampArmy(rawNextArmy + comboBonusTroops)

      // Detectar se houve Fusão Vai-Um (cruzamento de potência de 10)
      const mergeInfo = detectVaiUmMerge(armyBefore, nextArmy)
      let activeMerge = snapshot.activeMergeEvent
      let nextMergeSeenCount = save.mergeTutorialSeenCount
      if (mergeInfo) {
        soundEngine.playVaiUmMerge(mergeInfo.toTier.tierIndex)
        activeMerge = {
          id: `merge_${nextElapsed}`,
          fromTierLabel: mergeInfo.fromTier.denominationLabel,
          toTierLabel: mergeInfo.toTier.denominationLabel,
          formulaLabel: mergeInfo.formulaLabel,
          startedAtMs: nextElapsed,
        }
        nextMergeSeenCount += 1
      }

      const safeNextGateArmy = Math.max(1, clampArmy(nextArmy))
      const resolvedMap = {
        ...snapshot.resolvedSegments,
        [activeSeg.id]: { chosenLane, resultArmy: safeNextGateArmy },
      }
      const nextCrowdNodes = buildCrowdNodes(safeNextGateArmy)

      // Verificar se é segmento de Portões Gêmeos (celebração somente ao escolher o portão ótimo/benéfico!)
      if (activeSeg.kind === 'twins' && activeSeg.twinId && wasOptimal) {
        soundEngine.playTwinsHarmony()
        const twinSpec = TWIN_CATALOG[activeSeg.twinId]
        const nextTwins = save.twinsDiscovered.includes(activeSeg.twinId)
          ? save.twinsDiscovered
          : [...save.twinsDiscovered, activeSeg.twinId]
        const academiaBonus =
          CITADEL_BUILDINGS.academia.levelEffects[save.citadelLevels.academia ?? 0] ?? 1
        const nextSaveTwins = buildSaveWithCheckpoint(
          {
            ...save,
            wisdomStars: save.wisdomStars + academiaBonus,
            twinsDiscovered: nextTwins,
            mergeTutorialSeenCount: nextMergeSeenCount,
            stats: {
              ...save.stats,
              highestArmyReached: Math.max(save.stats.highestArmyReached, safeNextGateArmy),
            },
          },
          {
            sectorIndex: state.bridgeSectorIndex,
            currentArmy: safeNextGateArmy,
            bridgeCoinsEarned: snapshot.bridgeCoinsEarned ?? 0,
            bridgeKills: snapshot.bridgeKills ?? 0,
            mathChallengesSolved: state.mathChallengesSolvedInRun,
            seed: runPlan.seed,
          },
        )
        SaveRepository.save(nextSaveTwins)

        const fbItem: FloatingFeedbackItem = {
          id: `fb_${activeSeg.id}`,
          text: `GÊMEOS! ${twinSpec.equivalencePt.split('(')[0].trim()}`,
          subText: `+${academiaBonus} ★ Sabedoria`,
          tone: 'twins',
          createdAtMs: nextElapsed,
        }

        set({
          save: nextSaveTwins,
          snapshot: {
            ...snapshot,
            elapsedMs: nextElapsed,
            progress: nextProgress,
            currentArmy: safeNextGateArmy,
            remainderBankInRun: nextRemainderBank,
            activeSegmentIndex: snapshot.activeSegmentIndex + 1,
            resolvedSegments: resolvedMap,
            crowdNodes: nextCrowdNodes,
            recentFeedback: [...snapshot.recentFeedback.slice(-4), fbItem],
            activeMergeEvent: activeMerge,
            phase: save.settings.calmMode ? 'CALM_WAIT' : 'RUNNING',
          },
          captainSpeech: {
            mood: 'excited',
            text: `Gêmeos Matemáticos! ${twinSpec.equivalencePt} — você ganhou +${academiaBonus} Estrela(s) de Sabedoria!`,
          },
        })
        return
      }

      // Verificar se disparou Pegadinha Matemática catalogada (R1: NUNCA pausa a corrida!)
      const trapHit = detectTrap(activeSeg, effectiveEvalBase, chosenLane)
      if (trapHit) {
        soundEngine.playTrapOpaAlert()
        const rng = createRng(runPlan.seed + snapshot.activeSegmentIndex * 97)
        const newToken = issueToken(trapHit, runPlan.runId, rng.nextFloat)
        const updatedSegments = injectRedemptionSegmentOnBridge(
          snapshot.segments,
          snapshot.activeSegmentIndex,
          newToken,
          snapshot.laneCount,
        )

        const prevAlbumEntry = save.album[trapHit.trapId] ?? {
          trapId: trapHit.trapId,
          encounteredCount: 0,
          tamedCount: 0,
        }
        const prevConcept = save.mastery[trapHit.conceptId]
        const nextConcept = prevConcept
          ? updateConceptMastery(prevConcept, false, true, false)
          : undefined

        const nextSeenCount = (save.trapAlertSeenCount[trapHit.trapId] ?? 0) + 1
        const safeTrapArmy = Math.max(1, clampArmy(nextArmy))
        const nextSaveTrap = buildSaveWithCheckpoint(
          {
            ...save,
            mergeTutorialSeenCount: nextMergeSeenCount,
            album: {
              ...save.album,
              [trapHit.trapId]: {
                ...prevAlbumEntry,
                encounteredCount: prevAlbumEntry.encounteredCount + 1,
              },
            },
            mastery: nextConcept
              ? { ...save.mastery, [trapHit.conceptId]: nextConcept }
              : save.mastery,
            trapAlertSeenCount: {
              ...save.trapAlertSeenCount,
              [trapHit.trapId]: nextSeenCount,
            },
            stats: {
              ...save.stats,
              highestArmyReached: Math.max(save.stats.highestArmyReached, safeTrapArmy),
            },
          },
          {
            sectorIndex: state.bridgeSectorIndex,
            currentArmy: safeTrapArmy,
            bridgeCoinsEarned: snapshot.bridgeCoinsEarned ?? 0,
            bridgeKills: snapshot.bridgeKills ?? 0,
            mathChallengesSolved: state.mathChallengesSolvedInRun,
            seed: runPlan.seed,
          },
        )
        SaveRepository.save(nextSaveTrap)

        const fbTrap: FloatingFeedbackItem = {
          id: `fb_${activeSeg.id}`,
          text: `−${formatArmy(trapHit.loss, save.settings.notationMode)} · 🎟️ +1`,
          tone: 'trap',
          createdAtMs: nextElapsed,
        }

        const isFinalAfterTrap =
          snapshot.activeSegmentIndex + 1 >= updatedSegments.length || safeTrapArmy <= 0

        set({
          save: nextSaveTrap,
          activeTrapHit: trapHit,
          trapHistoryInRun: [...state.trapHistoryInRun, trapHit],
          tokensInRun: [...state.tokensInRun, newToken],
          snapshot: {
            ...snapshot,
            elapsedMs: nextElapsed,
            progress: isFinalAfterTrap ? 1 : nextProgress,
            currentArmy: safeTrapArmy,
            remainderBankInRun: nextRemainderBank,
            activeSegmentIndex:
              safeTrapArmy <= 0
                ? updatedSegments.length
                : snapshot.activeSegmentIndex + 1,
            segments: updatedSegments,
            resolvedSegments: resolvedMap,
            crowdNodes: buildCrowdNodes(safeTrapArmy),
            recentFeedback: [...snapshot.recentFeedback.slice(-4), fbTrap],
            activeMergeEvent: activeMerge,
            calcComboStreak: 0,
            calcComboMultiplier: 1,
            lastTrapFlashAtMs: nextElapsed,
            phase: isFinalAfterTrap
              ? 'RUNNING'
              : save.settings.calmMode
                ? 'CALM_WAIT'
                : 'RUNNING',
          },
          captainSpeech: {
            mood: 'curious',
            text: `+1 Ficha Bônus (+${formatArmy(trapHit.loss, save.settings.notationMode)}) guardada para o final!`,
          },
        })
        if (isFinalAfterTrap) {
          get().tickRun(16)
        }
        return
      }

      // Passagem normal (ótima ou neutra)
      soundEngine.playGatePass(nextArmy, wasOptimal)
      let nextMastery = save.mastery
      if (activeSeg.trapId) {
        const entry = TRAP_CATALOG[activeSeg.trapId]
        const prevConcept = save.mastery[entry.conceptId]
        if (prevConcept) {
          nextMastery = {
            ...save.mastery,
            [entry.conceptId]: updateConceptMastery(prevConcept, true, false, false),
          }
        }
      }

      const safePassArmy = Math.max(1, clampArmy(nextArmy))
      const nextSavePass = buildSaveWithCheckpoint(
        {
          ...save,
          mergeTutorialSeenCount: nextMergeSeenCount,
          mastery: nextMastery,
          stats: {
            ...save.stats,
            highestArmyReached: Math.max(save.stats.highestArmyReached, safePassArmy),
          },
        },
        {
          sectorIndex: state.bridgeSectorIndex,
          currentArmy: safePassArmy,
          bridgeCoinsEarned: snapshot.bridgeCoinsEarned ?? 0,
          bridgeKills: snapshot.bridgeKills ?? 0,
          mathChallengesSolved: state.mathChallengesSolvedInRun,
          seed: runPlan.seed,
        },
      )
      SaveRepository.save(nextSavePass)

      const deltaArmy = safePassArmy - armyBefore
      const signStr =
        deltaArmy >= 0
          ? `+${formatArmy(deltaArmy, save.settings.notationMode)}`
          : `−${formatArmy(Math.abs(deltaArmy), save.settings.notationMode)}`
      const comboTag =
        wasOptimal && nextComboMult > 1 ? ` ×${nextComboMult}` : ''
      const fbPass: FloatingFeedbackItem = {
        id: `fb_${activeSeg.id}`,
        text: `${signStr}${comboTag}`,
        tone: wasOptimal ? 'optimal' : 'neutral',
        createdAtMs: nextElapsed,
      }

      const isFinalSegment =
        snapshot.activeSegmentIndex + 1 >= snapshot.segments.length || safePassArmy <= 0

      set({
        save: nextSavePass,
        snapshot: {
          ...snapshot,
          elapsedMs: nextElapsed,
          progress: isFinalSegment ? 1 : nextProgress,
          currentArmy: safePassArmy,
          remainderBankInRun: nextRemainderBank,
          activeSegmentIndex:
            safePassArmy <= 0
              ? snapshot.segments.length
              : snapshot.activeSegmentIndex + 1,
          resolvedSegments: resolvedMap,
          crowdNodes: buildCrowdNodes(safePassArmy),
          recentFeedback: [...snapshot.recentFeedback.slice(-4), fbPass],
          activeMergeEvent: activeMerge,
          calcComboStreak: nextComboStreak,
          calcComboMultiplier: nextComboMult,
          phase: isFinalSegment
            ? 'RUNNING'
            : save.settings.calmMode
              ? 'CALM_WAIT'
              : 'RUNNING',
        },
        captainSpeech: mergeInfo
          ? {
              mood: 'excited',
              text: `Fusão Vai-Um! ${mergeInfo.formulaLabel} (${mergeInfo.toTier.unitName})!`,
            }
          : {
              mood: wasOptimal ? 'proud' : 'calm',
              text: wasOptimal
                ? `Escolha certeira! Exército agora em ${formatArmy(safePassArmy, save.settings.notationMode)}.`
                : `Passamos pelo portão. Continue atento às próximas placas!`,
            },
      })

      if (isFinalSegment) {
        get().tickRun(16)
      }
      return
    }

    // Se terminou todos os segmentos: no Modo Infinito avança automaticamente para o próximo Setor;
    // se currentArmy <= 0 (zerado por portões negativos), aciona DEFEAT imediato!
    if (snapshot.activeSegmentIndex >= snapshot.segments.length) {
      if (snapshot.currentArmy <= 0) {
        soundEngine.playDefeatRegroup()
        const defeatRes = resolveBattle(0, snapshot.enemy)
        const defeatContract = evaluateRedemptionContract(
          0,
          snapshot.enemy.totalForce,
          state.tokensInRun,
        )
        const nextSaveDefeat = buildSaveWithCheckpoint(
          {
            ...save,
            remainderVault: save.remainderVault + snapshot.remainderBankInRun,
            stats: {
              ...save.stats,
              runsPlayed: save.stats.runsPlayed + 1,
            },
          },
          {
            sectorIndex: state.bridgeSectorIndex,
            currentArmy: Math.max(5, runPlan.n0),
            bridgeCoinsEarned: snapshot.bridgeCoinsEarned ?? 0,
            bridgeKills: snapshot.bridgeKills ?? 0,
            mathChallengesSolved: state.mathChallengesSolvedInRun,
            seed: runPlan.seed,
          },
        )
        SaveRepository.save(nextSaveDefeat)
        set({
          save: nextSaveDefeat,
          activeTrapHit: null,
          battleResolution: defeatRes,
          redemptionContract: defeatContract,
          snapshot: {
            ...snapshot,
            currentArmy: 0,
            crowdNodes: [],
            elapsedMs: nextElapsed,
            progress: 1,
            phase: 'DEFEAT',
          },
          captainSpeech: {
            mood: 'curious',
            text: `Nosso exército caiu a zero no Setor ${state.bridgeSectorIndex}! Progresso e pontuação salvos no IndexedDB e Cache!`,
          },
        })
        return
      }
      if (
        state.infiniteBridgeMode &&
        snapshot.currentArmy > 0 &&
        (lastAdvanceViaTapButton || tapAdvanceUsedInCurrentWave)
      ) {
        get().advanceInfiniteBridgeSector()
        return
      }
      // V9: Na Ponte 3D em tempo real (sem clique manual de salto final), reciclar continuamente a esteira
      // de 6 segmentos da Rota Central no mesmo nível dos monstros, igual às esteiras da Esquerda e da Direita!
      const isLive3DBridge =
        typeof window !== 'undefined' &&
        Boolean(
          (window as unknown as { __lbBridge3DTelemetry?: unknown })
            .__lbBridge3DTelemetry,
        )
      if (
        isLive3DBridge &&
        !lastAdvanceViaTapButton &&
        !tapAdvanceUsedInCurrentWave &&
        snapshot.currentArmy > 0
      ) {
        const nextWaveSeed = (runPlan.seed + Math.floor(nextElapsed) + 997) >>> 0
        const recycledPlan = generateRun({
          seed: nextWaveSeed,
          biomeId: runPlan.biomeId,
          regionId: runPlan.regionId,
          n0: snapshot.currentArmy,
          enemy: snapshot.enemy,
          mastery: save.mastery,
          observatoryLevel: save.citadelLevels.observatorio ?? 1,
          trapAlertSeenCount: save.trapAlertSeenCount,
        })
        set({
          snapshot: {
            ...snapshot,
            elapsedMs: nextElapsed,
            progress: 0.01,
            activeSegmentIndex: 0,
            segments: recycledPlan.segments,
            resolvedSegments: {},
            phase: save.settings.calmMode ? 'CALM_WAIT' : 'RUNNING',
          },
        })
        return
      }
      const safeFinalArmy = clampArmy(snapshot.currentArmy)
      const resolution = resolveBattle(safeFinalArmy, snapshot.enemy)
      const contract = evaluateRedemptionContract(
        safeFinalArmy,
        snapshot.enemy.totalForce,
        state.tokensInRun,
      )

      set({
        activeTrapHit: null,
        battleResolution: resolution,
        redemptionContract: contract,
        snapshot: {
          ...snapshot,
          currentArmy: safeFinalArmy,
          elapsedMs: nextElapsed,
          progress: 1,
          phase: 'BATTLE',
        },
        captainSpeech: {
          mood: 'excited',
          text: `Choque final nas muralhas contra ${snapshot.enemy.bossName}!`,
        },
      })
      return
    }

    const expiredMerge =
      snapshot.activeMergeEvent &&
      nextElapsed - snapshot.activeMergeEvent.startedAtMs >= 1800

    // Auto-expirar o banner não-bloqueante de pegadinha se o jogador preferir apenas seguir correndo
    const lastTrapFb = [...snapshot.recentFeedback]
      .reverse()
      .find((f) => f.tone === 'trap')
    const expiredTrapToast =
      state.activeTrapHit &&
      lastTrapFb &&
      nextElapsed - lastTrapFb.createdAtMs >= 3800

    // Atualização contínua da posição Z na ponte
    set({
      activeTrapHit: expiredTrapToast ? null : state.activeTrapHit,
      snapshot: {
        ...snapshot,
        elapsedMs: nextElapsed,
        progress: nextProgress,
        activeMergeEvent: expiredMerge ? null : snapshot.activeMergeEvent,
      },
    })
  },

  updateBattleArmyVisual: (newArmy, splitEvent) => {
    const state = get()
    if (state.snapshot.phase !== 'BATTLE') return
    if (splitEvent) {
      soundEngine.playVaiUmMerge(0)
    }
    set({
      snapshot: {
        ...state.snapshot,
        currentArmy: newArmy,
        crowdNodes: buildCrowdNodes(newArmy),
        activeMergeEvent: splitEvent ?? state.snapshot.activeMergeEvent,
      },
    })
  },

  finishBattle: () => {
    const state = get()
    const { snapshot, runPlan, save } = state
    const resolution =
      state.battleResolution ?? resolveBattle(snapshot.currentArmy, snapshot.enemy)
    const contract =
      state.redemptionContract ??
      evaluateRedemptionContract(
        resolution.playerArmy,
        snapshot.enemy.totalForce,
        state.tokensInRun,
      )

    if (resolution.outcome === 'VICTORY') {
      soundEngine.playVictoryFanfare()
      const region = REGIONS[runPlan.regionId] ?? REGIONS.r01_ponte_aurora
      const alreadyConquered = save.conqueredRegionIds.includes(region.id)
      const nextConquered = alreadyConquered
        ? save.conqueredRegionIds
        : [...save.conqueredRegionIds, region.id]
      const passiveTribute = calculatePassiveTribute(nextConquered)
      const survivorBonus = calculateCappedSurvivorBonus(
        resolution.survivors,
        region.rewardTroops,
      )
      const totalReward = region.rewardTroops + passiveTribute + survivorBonus

      const nextSaveWin: SaveV1 = {
        ...save,
        reserveTroops: clampArmy(save.reserveTroops + totalReward),
        remainderVault: save.remainderVault + snapshot.remainderBankInRun,
        wisdomStars: save.wisdomStars + (alreadyConquered ? 1 : 2),
        conqueredRegionIds: nextConquered,
        stats: {
          ...save.stats,
          runsPlayed: save.stats.runsPlayed + 1,
          runsWon: save.stats.runsWon + 1,
          highestArmyReached: Math.max(
            save.stats.highestArmyReached,
            resolution.playerArmy,
          ),
        },
      }
      SaveRepository.save(nextSaveWin)

      set({
        save: nextSaveWin,
        activeTrapHit: null,
        battleResolution: resolution,
        redemptionContract: contract,
        snapshot: {
          ...snapshot,
          progress: 1,
          currentArmy: resolution.survivors,
          crowdNodes: buildCrowdNodes(resolution.survivors),
          activeMergeEvent: null,
          phase: 'VICTORY',
        },
        captainSpeech: {
          mood: 'proud',
          text: `Vitória gloriosa sobre ${snapshot.enemy.bossName}! Sobraram ${formatArmy(resolution.survivors, save.settings.notationMode)} soldados para a Reserva do Reino!`,
        },
      })
    } else {
      soundEngine.playDefeatRegroup()
      const nextSaveDefeat: SaveV1 = {
        ...save,
        remainderVault: save.remainderVault + snapshot.remainderBankInRun,
        stats: {
          ...save.stats,
          runsPlayed: save.stats.runsPlayed + 1,
          highestArmyReached: Math.max(
            save.stats.highestArmyReached,
            resolution.playerArmy,
          ),
        },
      }
      SaveRepository.save(nextSaveDefeat)

      set({
        save: nextSaveDefeat,
        activeTrapHit: null,
        battleResolution: resolution,
        redemptionContract: contract,
        snapshot: {
          ...snapshot,
          progress: 1,
          currentArmy: 0,
          crowdNodes: [],
          activeMergeEvent: null,
          phase: 'DEFEAT',
        },
        captainSpeech: {
          mood: 'curious',
          text: contract.canGuaranteeVictory
            ? `Faltaram ${formatArmy(resolution.deficit, save.settings.notationMode)} soldados! Mas suas Fichas de Resgate somam +${formatArmy(contract.totalRecoverableLoss, save.settings.notationMode)} e garantem a virada!`
            : `Faltaram ${formatArmy(resolution.deficit, save.settings.notationMode)} soldados! Vamos tentar uma Revanche Tática com o Detector da Cidadela!`,
        },
      })
    }
  },

  dismissTrapAlertAndContinue: () => {
    const state = get()
    set({
      activeTrapHit: null,
      snapshot: {
        ...state.snapshot,
        phase:
          state.snapshot.phase === 'TRAP_CINEMATIC'
            ? state.save.settings.calmMode
              ? 'CALM_WAIT'
              : 'RUNNING'
            : state.snapshot.phase,
      },
    })
  },

  openImmediateRedemptionFromTrap: () => {
    const state = get()
    const latestToken =
      [...state.tokensInRun].reverse().find((t) => !t.used) ??
      state.tokensInRun[state.tokensInRun.length - 1]
    if (!latestToken) {
      get().dismissTrapAlertAndContinue()
      return
    }
    set({
      activeTrapHit: null,
      activeRedemptionTokenId: latestToken.id,
      lastRedeemDiagnostic: null,
      snapshot: {
        ...state.snapshot,
        phase: 'REDEMPTION_CHALLENGE',
      },
    })
  },

  openNextRedemptionModal: () => {
    const state = get()
    const nextToken = [...state.tokensInRun].reverse().find((t) => !t.used)
    if (!nextToken) return
    set({
      activeTrapHit: null,
      activeRedemptionTokenId: nextToken.id,
      lastRedeemDiagnostic: null,
      snapshot: {
        ...state.snapshot,
        phase: 'REDEMPTION_CHALLENGE',
      },
    })
  },

  submitRedemptionAnswer: (choiceId) => {
    const state = get()
    const tokenId = state.activeRedemptionTokenId
    const token = state.tokensInRun.find((t) => t.id === tokenId)
    if (!token) return

    const res = redeem(token, choiceId)
    const updatedTokens = state.tokensInRun.map((t) =>
      t.id === token.id ? res.nextToken : t,
    )

    if (!res.success) {
      set({
        tokensInRun: updatedTokens,
        lastRedeemDiagnostic: res.diagnosticPt,
        captainSpeech: {
          mood: 'curious',
          text: `${res.diagnosticPt} Veja a Luz-Guia nível ${res.nextToken.scaffoldLevel} abaixo — você nunca perde sua Ficha!`,
        },
      })
      return
    }

    // Acertou a Conta de Resgate!
    soundEngine.playRedemptionSuccess()
    const isFromDefeatContract = state.snapshot.phase === 'REDEMPTION_CONTRACT'
    const grantAmount =
      isFromDefeatContract && state.redemptionContract
        ? state.redemptionContract.grantOnSuccess
        : res.grant

    const nextArmy = clampArmy(state.snapshot.currentArmy + grantAmount)
    const nextCrowd = buildCrowdNodes(nextArmy)

    // Atualizar Álbum de Pegadinhas Domadas e Maestria
    const prevAlbum = state.save.album[token.trapId] ?? {
      trapId: token.trapId,
      encounteredCount: 1,
      tamedCount: 0,
    }
    const prevMastery = state.save.mastery[token.challenge.conceptId]
    const nextMastery = prevMastery
      ? {
          ...state.save.mastery,
          [token.challenge.conceptId]: updateConceptMastery(
            prevMastery,
            false,
            false,
            true,
          ),
        }
      : state.save.mastery

    let nextSave: SaveV1 = {
      ...state.save,
      wisdomStars: state.save.wisdomStars + 1,
      album: {
        ...state.save.album,
        [token.trapId]: {
          ...prevAlbum,
          tamedCount: prevAlbum.tamedCount + 1,
          firstTamedAt: prevAlbum.firstTamedAt ?? new Date().toISOString(),
        },
      },
      mastery: nextMastery,
      stats: {
        ...state.save.stats,
        trapsTamedTotal: state.save.stats.trapsTamedTotal + 1,
        highestArmyReached: Math.max(
          state.save.stats.highestArmyReached,
          nextArmy,
        ),
      },
    }

    if (isFromDefeatContract) {
      // Converte a derrota em Vitória pelo Contrato de Resgate Honesto!
      soundEngine.playVictoryFanfare()
      const resolution = resolveBattle(nextArmy, state.snapshot.enemy)
      const region =
        REGIONS[state.runPlan.regionId] ?? REGIONS.r01_ponte_aurora
      const alreadyConquered = nextSave.conqueredRegionIds.includes(region.id)
      const nextConquered = alreadyConquered
        ? nextSave.conqueredRegionIds
        : [...nextSave.conqueredRegionIds, region.id]

      const survivorBonus = calculateCappedSurvivorBonus(
        resolution.survivors,
        region.rewardTroops,
      )
      const passiveTribute = calculatePassiveTribute(nextConquered)
      nextSave = {
        ...nextSave,
        reserveTroops: clampArmy(
          nextSave.reserveTroops +
            region.rewardTroops +
            survivorBonus +
            passiveTribute,
        ),
        conqueredRegionIds: nextConquered,
        stats: {
          ...nextSave.stats,
          runsWon: nextSave.stats.runsWon + 1,
        },
      }
      SaveRepository.save(nextSave)

      set({
        save: nextSave,
        tokensInRun: updatedTokens.map((t) => ({ ...t, used: true })),
        activeRedemptionTokenId: null,
        lastRedeemDiagnostic: res.diagnosticPt,
        battleResolution: resolution,
        snapshot: {
          ...state.snapshot,
          currentArmy: nextArmy,
          crowdNodes: nextCrowd,
          phase: 'VICTORY',
        },
        captainSpeech: {
          mood: 'proud',
          text: `Contrato de Resgate cumprido! +${grantAmount} soldados chegaram de paraquedas e viraram a batalha!`,
        },
      })
      return
    }

    SaveRepository.save(nextSave)

    const fbReinforce: FloatingFeedbackItem = {
      id: `fb_redeem_${Date.now()}`,
      text: `RESGATE! +${formatArmy(grantAmount, nextSave.settings.notationMode)} SOLDADOS`,
      subText: `Pegadinha "${token.trapName}" Domada!`,
      tone: 'reinforcement',
      createdAtMs: state.snapshot.elapsedMs,
    }

    set({
      save: nextSave,
      tokensInRun: updatedTokens,
      activeRedemptionTokenId: null,
      lastRedeemDiagnostic: res.diagnosticPt,
      snapshot: {
        ...state.snapshot,
        currentArmy: nextArmy,
        crowdNodes: nextCrowd,
        recentFeedback: [...state.snapshot.recentFeedback.slice(-4), fbReinforce],
        phase: nextSave.settings.calmMode ? 'CALM_WAIT' : 'RUNNING',
      },
      captainSpeech: {
        mood: 'proud',
        text: `Paraquedas de reforço! +${grantAmount} soldados voltaram para a fileira e "${token.trapName}" foi domada no Álbum!`,
      },
    })
  },

  closeRedemptionModal: () => {
    const state = get()
    const nextPhase =
      state.snapshot.phase === 'REDEMPTION_CONTRACT'
        ? 'DEFEAT'
        : state.save.settings.calmMode
          ? 'CALM_WAIT'
          : 'RUNNING'
    set({
      activeRedemptionTokenId: null,
      lastRedeemDiagnostic: null,
      snapshot: {
        ...state.snapshot,
        phase: nextPhase,
      },
    })
  },

  acceptRedemptionContractModal: () => {
    const state = get()
    const firstAvailable = state.tokensInRun.find((t) => !t.used)
    if (!firstAvailable) return
    set({
      activeRedemptionTokenId: firstAvailable.id,
      lastRedeemDiagnostic: null,
      snapshot: {
        ...state.snapshot,
        phase: 'REDEMPTION_CONTRACT',
      },
    })
  },

  useLunetaOnNextSegment: () => {
    const state = get()
    if (state.lunetaChargesRemaining <= 0) return
    const nextSeg = state.snapshot.segments[state.snapshot.activeSegmentIndex]
    if (!nextSeg || state.snapshot.inspectedSegmentId === nextSeg.id) return

    soundEngine.playLunetaScan()
    set({
      lunetaChargesRemaining: state.lunetaChargesRemaining - 1,
      snapshot: {
        ...state.snapshot,
        inspectedSegmentId: nextSeg.id,
      },
      captainSpeech: {
        mood: 'excited',
        text: 'Luneta Tática ativada! O resultado exato de cada portão à frente foi revelado!',
      },
    })
  },

  togglePauseRun: () => {
    const state = get()
    const { phase } = state.snapshot
    if (phase === 'RUNNING' || phase === 'CALM_WAIT') {
      set({
        snapshot: {
          ...state.snapshot,
          phase: 'PAUSED',
        },
      })
    } else if (phase === 'PAUSED') {
      set({
        snapshot: {
          ...state.snapshot,
          phase: state.save.settings.calmMode ? 'CALM_WAIT' : 'RUNNING',
        },
      })
    }
  },

  toggleNotationMode: () => {
    const state = get()
    const nextMode =
      state.save.settings.notationMode === 'compact' ? 'scientific' : 'compact'
    const nextSave: SaveV1 = {
      ...state.save,
      settings: {
        ...state.save.settings,
        notationMode: nextMode,
      },
    }
    SaveRepository.save(nextSave)
    set({ save: nextSave })
  },

  toggleCalmMode: () => {
    const state = get()
    const nextCalm = !state.save.settings.calmMode
    const nextSave: SaveV1 = {
      ...state.save,
      settings: {
        ...state.save.settings,
        calmMode: nextCalm,
      },
    }
    SaveRepository.save(nextSave)
    const nextPhase =
      state.snapshot.phase === 'RUNNING' && nextCalm
        ? 'CALM_WAIT'
        : state.snapshot.phase === 'CALM_WAIT' && !nextCalm
          ? 'RUNNING'
          : state.snapshot.phase
    set({
      save: nextSave,
      snapshot: {
        ...state.snapshot,
        phase: nextPhase,
      },
    })
  },

  toggleSimpleTapMode: () => {
    const state = get()
    const nextTap = !state.save.settings.simpleTapMode
    const nextSave: SaveV1 = {
      ...state.save,
      settings: {
        ...state.save.settings,
        simpleTapMode: nextTap,
      },
    }
    SaveRepository.save(nextSave)
    set({ save: nextSave })
  },

  toggleSound: () => {
    const state = get()
    const nextSound = !state.save.settings.soundEnabled
    soundEngine.setEnabled(nextSound)
    const nextSave: SaveV1 = {
      ...state.save,
      settings: {
        ...state.save.settings,
        soundEnabled: nextSound,
      },
    }
    SaveRepository.save(nextSave)
    set({ save: nextSave })
  },

  toggleReducedMotion: () => {
    const state = get()
    const nextReduced = !state.save.settings.reducedMotion
    const nextSave: SaveV1 = {
      ...state.save,
      settings: {
        ...state.save.settings,
        reducedMotion: nextReduced,
      },
    }
    SaveRepository.save(nextSave)
    set({ save: nextSave })
  },

  dismissCoachMarks: () => {
    const state = get()
    const nextSave: SaveV1 = {
      ...state.save,
      coachMarksSeen: true,
    }
    SaveRepository.save(nextSave)
    set({ save: nextSave })
  },

  selectRegion: (regionId) => {
    const state = get()
    if (!REGIONS[regionId]) return
    const nextSave: SaveV1 = {
      ...state.save,
      selectedRegionId: regionId,
    }
    SaveRepository.save(nextSave)
    set({
      save: nextSave,
      lastDirectAttackResult: null,
      activeRealmSheet: 'region',
    })
  },

  attackRegionDirect: (regionId, troopsToCommit) => {
    const state = get()
    const region = REGIONS[regionId]
    if (
      !region ||
      !canAttackRegion(regionId, state.save.conqueredRegionIds) ||
      troopsToCommit > state.save.reserveTroops
    ) {
      const fail: DirectAttackResult = {
        success: false,
        surgicalPrecision: false,
        troopsCommitted: troopsToCommit,
        garrison: region?.garrison ?? 0,
        rewardTroops: 0,
        surgicalBonusTroops: 0,
        starsEarned: 0,
        netReserveDelta: 0,
      }
      set({ lastDirectAttackResult: fail })
      return fail
    }

    const res = resolveDirectPrecisionAttack(troopsToCommit, region)
    if (!res.success) {
      set({ lastDirectAttackResult: res })
      return res
    }

    soundEngine.playVictoryFanfare()
    const nextConquered = state.save.conqueredRegionIds.includes(regionId)
      ? state.save.conqueredRegionIds
      : [...state.save.conqueredRegionIds, regionId]

    const nextSave: SaveV1 = {
      ...state.save,
      reserveTroops: clampArmy(state.save.reserveTroops + res.netReserveDelta),
      wisdomStars: state.save.wisdomStars + res.starsEarned,
      conqueredRegionIds: nextConquered,
      selectedRegionId: regionId,
      stats: {
        ...state.save.stats,
        surgicalPrecisions:
          state.save.stats.surgicalPrecisions + (res.surgicalPrecision ? 1 : 0),
      },
    }
    SaveRepository.save(nextSave)
    set({
      save: nextSave,
      lastDirectAttackResult: res,
      captainSpeech: {
        mood: 'proud',
        text: res.surgicalPrecision
          ? `Precisão Cirúrgica (${region.garrison} + 1)! Zero desperdício e +${res.surgicalBonusTroops} soldados bônus!`
          : `Região ${region.name} conquistada!`,
      },
    })
    return res
  },

  upgradeCitadelInMatch: (buildingId) => {
    const state = get()
    const spec = CITADEL_BUILDINGS[buildingId]
    if (!spec) return false
    const currentLevel = state.save.citadelLevels[buildingId] ?? 0
    const cost = getUpgradeCost(buildingId, currentLevel)
    if (currentLevel >= spec.maxLevel || !Number.isFinite(cost)) {
      return false
    }
    const sharedBalance = get().getSharedWalletBalance()
    if (sharedBalance < cost) {
      return false
    }

    const { save, snapshot, bridgeSectorIndex, runPlan, mathChallengesSolvedInRun } = state
    const prevBankedMark = save.activeRunCheckpoint?.bankedScoreMark ?? runPlan.n0
    const coinsBonus = Math.max(0, snapshot.bridgeCoinsEarned ?? 0)
    const sectorBonus = bridgeSectorIndex > 1 ? (bridgeSectorIndex - 1) * 15 : 0
    const totalRunContribution = snapshot.currentArmy + coinsBonus + sectorBonus
    const nextBankedMark = Math.max(prevBankedMark, totalRunContribution)
    const nextReserveAfterSpend = clampArmy(sharedBalance - cost)
    const nextLevel = currentLevel + 1
    const nextCitadelLevels: Record<CitadelBuildingId, number> = {
      ...save.citadelLevels,
      [buildingId]: nextLevel,
    }

    let nextArmy = snapshot.currentArmy
    let nextLunetas = state.lunetaChargesRemaining
    let nextSegments = snapshot.segments
    let bonusArmyAdded = 0
    if (buildingId === 'quartel') {
      const prevRecruits = getInitialArmyFromQuartel(currentLevel)
      const nextRecruits = getInitialArmyFromQuartel(nextLevel)
      bonusArmyAdded = Math.max(8, nextRecruits - prevRecruits)
      nextArmy = clampArmy(snapshot.currentArmy + bonusArmyAdded)
    } else if (buildingId === 'forja') {
      nextLunetas = state.lunetaChargesRemaining + 1
    } else if (buildingId === 'observatorio') {
      nextSegments = snapshot.segments.map((seg) =>
        seg.trapId ? { ...seg, showDetectorWarning: true } : seg,
      )
    }

    soundEngine.playRedemptionSuccess()
    const fbCitadel: FloatingFeedbackItem = {
      id: `fb_citadel_${buildingId}_${Date.now()}`,
      text: `🏰 ${spec.name} Nv.${nextLevel}!`,
      subText: `−${cost} Carteira · ${spec.levelLabels[nextLevel] ?? ''}`,
      tone: 'optimal',
      createdAtMs: snapshot.elapsedMs,
    }

    const nextSave = buildSaveWithCheckpoint(
      {
        ...save,
        reserveTroops: nextReserveAfterSpend,
        citadelLevels: nextCitadelLevels,
      },
      {
        sectorIndex: bridgeSectorIndex,
        currentArmy: nextArmy,
        bridgeCoinsEarned: snapshot.bridgeCoinsEarned ?? 0,
        bridgeKills: snapshot.bridgeKills ?? 0,
        mathChallengesSolved: mathChallengesSolvedInRun,
        seed: runPlan.seed,
        bankedScoreMark: nextBankedMark + bonusArmyAdded,
        playerBridgeTowerLevels: state.playerBridgeTowerLevels,
        enemyBaseLevel: state.enemyBaseLevel,
      },
    )
    SaveRepository.save(nextSave)

    set({
      save: nextSave,
      lunetaChargesRemaining: nextLunetas,
      snapshot: {
        ...snapshot,
        currentArmy: nextArmy,
        crowdNodes:
          nextArmy !== snapshot.currentArmy
            ? buildCrowdNodes(nextArmy)
            : snapshot.crowdNodes,
        segments: nextSegments,
        recentFeedback: [...snapshot.recentFeedback.slice(-4), fbCitadel],
      },
      captainSpeech: {
        mood: 'proud',
        text: `🏰 Base Principal evoluída dentro da partida! ${spec.name} agora está no Nv.${nextLevel} (${spec.levelLabels[nextLevel] ?? ''})!`,
      },
    })
    return true
  },

  upgradeCitadelBuilding: (buildingId) => {
    const state = get()
    if (state.world === 'run') {
      return get().upgradeCitadelInMatch(buildingId)
    }
    const res = purchaseCitadelUpgrade(
      buildingId,
      state.save.citadelLevels,
      state.save.reserveTroops,
    )
    if (!res.success) return false

    soundEngine.playRedemptionSuccess()
    const nextSave: SaveV1 = {
      ...state.save,
      reserveTroops: res.remainingTroops,
      citadelLevels: res.nextLevels,
    }
    SaveRepository.save(nextSave)
    set({ save: nextSave })
    return true
  },

  convertRemaindersInMine: () => {
    const state = get()
    const res = convertRemainderVaultToTroops(
      state.save.remainderVault,
      state.save.citadelLevels.mina_resto ?? 0,
    )
    if (res.recruitedTroops <= 0) return 0

    soundEngine.playVaiUmMerge(1)
    const nextSave: SaveV1 = {
      ...state.save,
      reserveTroops: clampArmy(state.save.reserveTroops + res.recruitedTroops),
      remainderVault: res.remainingVault,
    }
    SaveRepository.save(nextSave)
    set({ save: nextSave })
    return res.recruitedTroops
  },

  openAlbumDrawer: (open) => {
    set({ albumDrawerOpen: open })
  },

  openCodexForSlug: (slug) => {
    set({ codexDrawerSlug: slug })
  },

  resetSaveData: () => {
    const fresh = SaveRepository.reset()
    set({
      save: fresh,
      bridgeSectorIndex: 1,
      infiniteBridgeMode: false,
      mathChallengesSolvedInRun: 0,
    })
    get().startNewRun({ regionId: 'r01_ponte_aurora' })
  },
}))

if (typeof window !== 'undefined') {
  ;(window as unknown as { __lbStore?: typeof useLogicBattleStore }).__lbStore =
    useLogicBattleStore

  // V8: Hidratação assíncrona resiliente a partir do IndexedDB ('logicBattle_db')
  if (!initialLoad.recoveredFromBackup) {
    void SaveRepository.hydrateFromIndexedDB((hydratedSave) => {
      const st = useLogicBattleStore.getState()
      if (st.recoveredFromBackup) return
      const cp = hydratedSave.activeRunCheckpoint
      if (urlCfg.seed === undefined && cp && cp.currentArmy > 0) {
        const nextArmy = clampArmy(cp.currentArmy)
        const nextSector = Math.max(1, cp.sectorIndex)
        const region = REGIONS[hydratedSave.selectedRegionId] ?? REGIONS.r01_ponte_aurora
        const scaledEnemy = buildSectorScaledEnemy(region, nextSector, nextArmy)
        useLogicBattleStore.setState({
          save: hydratedSave,
          bridgeSectorIndex: nextSector,
          infiniteBridgeMode: nextSector > 1 || st.infiniteBridgeMode,
          mathChallengesSolvedInRun: cp.mathChallengesSolved,
          snapshot: {
            ...st.snapshot,
            currentArmy: nextArmy,
            crowdNodes: buildCrowdNodes(nextArmy),
            bridgeCoinsEarned: cp.bridgeCoinsEarned,
            bridgeKills: cp.bridgeKills,
            enemy: scaledEnemy,
          },
        })
      } else {
        useLogicBattleStore.setState({ save: hydratedSave })
      }
    })
  }

  // V8: Auto-save imediato em visibilitychange / pagehide para nunca perder o Setor/Pontuação ao fechar ou trocar de aba
  const flushCheckpointOnPageLifecycle = () => {
    try {
      const rawCurrent = window.localStorage.getItem('logicBattle.save.v1')
      if (rawCurrent !== null) {
        const parsed = JSON.parse(rawCurrent)
        if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
          return
        }
      }
    } catch {
      // Se o save primário no localStorage estiver corrompido, preservar para que o reload acione a recuperação via .bak!
      return
    }
    const st = useLogicBattleStore.getState()
    if (st.snapshot.currentArmy <= 0 && st.bridgeSectorIndex <= 1) return
    const nextSave = buildSaveWithCheckpoint(st.save, {
      sectorIndex: st.bridgeSectorIndex,
      currentArmy: st.snapshot.currentArmy,
      bridgeCoinsEarned: st.snapshot.bridgeCoinsEarned ?? 0,
      bridgeKills: st.snapshot.bridgeKills ?? 0,
      mathChallengesSolved: st.mathChallengesSolvedInRun,
      seed: st.runPlan.seed,
    })
    SaveRepository.save(nextSave)
  }
  window.addEventListener('pagehide', flushCheckpointOnPageLifecycle)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushCheckpointOnPageLifecycle()
    }
  })
}
