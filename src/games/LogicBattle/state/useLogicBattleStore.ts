// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/state/useLogicBattleStore.ts — Store Zustand (Mundo 1 & Mundo 2)
// ──────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand'
import { soundEngine } from '../audio/soundEngine'
import { BIOMES } from '../config/biomes'
import { REGIONS } from '../config/regions'
import { TRAP_CATALOG, TWIN_CATALOG } from '../config/trapCatalog'
import { CITADEL_BUILDINGS } from '../config/upgrades'
import { applyGateChainWithRemainder, clampArmy } from '../domain/armyMath'
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
  resolveLaneIndexFromNormX,
} from '../run/renderer/perspective'
import {
  ENGINE_CATALOG,
  EngineId,
  EngineResult,
  getComboMultiplier,
} from '../engines/engineContract'
import {
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

export interface CaptainSpeech {
  mood: 'proud' | 'curious' | 'excited' | 'calm'
  text: string
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

  // Actions
  switchWorld: (world: 'run' | 'realm') => void
  selectEngine: (engineId: EngineId, startImmediately?: boolean) => void
  completeEngineRun: (result: EngineResult) => void
  recordBridgeEnemyKill: (coinsDelta?: number) => void
  toggleDebugMode: () => void
  toggleSettingsPopover: (open?: boolean) => void
  setActiveRealmSheet: (sheet: 'none' | 'region' | 'citadel') => void
  startNewRun: (opts?: { regionId?: string; biomeId?: BiomeId; seed?: number; engineId?: EngineId }) => void
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
const urlCfg = readUrlParams()
soundEngine.setEnabled(initialLoad.save.settings.soundEnabled)

const initialRegion =
  REGIONS[initialLoad.save.selectedRegionId] ?? REGIONS.r01_ponte_aurora
const initialBiomeId = urlCfg.biome ?? initialRegion.biomeId
const initialSeed =
  urlCfg.seed ?? ((Date.now() % 1_000_000) + initialLoad.save.stats.runsPlayed * 137)
const initialN0 = Math.max(
  5,
  getInitialArmyFromQuartel(initialLoad.save.citadelLevels.quartel ?? 1),
)

const initialPlan = generateRun({
  seed: initialSeed,
  biomeId: initialBiomeId,
  regionId: initialRegion.id,
  n0: initialN0,
  enemy: {
    horde: initialRegion.garrison,
    bossHp: initialRegion.bossHp,
    bossName: initialRegion.bossName,
    bossTitle: initialRegion.bossTitle,
    totalForce: initialRegion.garrison + initialRegion.bossHp,
  },
  mastery: initialLoad.save.mastery,
  observatoryLevel: initialLoad.save.citadelLevels.observatorio ?? 1,
  trapAlertSeenCount: initialLoad.save.trapAlertSeenCount,
})

const initialOracle = pathOracle(initialPlan)
const initialForjaLevel = initialLoad.save.citadelLevels.forja ?? 0
const initialLunetas = CITADEL_BUILDINGS.forja.levelEffects[initialForjaLevel] ?? 1

export const useLogicBattleStore = create<LogicBattleStoreState>((set, get) => ({
  world: urlCfg.world,
  activeEngineId: urlCfg.engine ?? 'ponte_portoes',
  debugMode: urlCfg.debug,
  save: initialLoad.save,
  recoveredFromBackup: initialLoad.recoveredFromBackup,
  runPlan: initialPlan,
  oracle: initialOracle,
  snapshot: createInitialSnapshotFromPlan(
    initialPlan,
    initialLoad.save.settings.calmMode,
  ),
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
  captainSpeech: {
    mood: 'excited',
    text: 'Capitã Vírgula a postos! Deslize o exército pelos portões e cuidado com as pegadinhas da intuição!',
  },

  switchWorld: (world) => {
    set({
      world,
      lastDirectAttackResult: null,
      battleResolution: null,
      activeTrapHit: null,
      activeRedemptionTokenId: null,
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

  recordBridgeEnemyKill: (coinsDelta = 2) => {
    const state = get()
    const snap = state.snapshot
    if (snap.phase !== 'RUNNING' && snap.phase !== 'CALM_WAIT') return
    set({
      snapshot: {
        ...snap,
        bridgeKills: (snap.bridgeKills ?? 0) + 1,
        bridgeCoinsEarned: (snap.bridgeCoinsEarned ?? 0) + Math.max(1, coinsDelta),
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

  startNewRun: (opts) => {
    const state = get()
    const targetRegionId = opts?.regionId ?? state.save.selectedRegionId
    const region = REGIONS[targetRegionId] ?? REGIONS.r01_ponte_aurora
    const biomeId = opts?.biomeId ?? region.biomeId
    const engineId = opts?.engineId ?? state.activeEngineId ?? 'ponte_portoes'
    const seed =
      opts?.seed ??
      urlCfg.seed ??
      ((Date.now() % 1_000_000) + (state.save.stats.runsPlayed + 1) * 313)

    const n0 = Math.max(
      5,
      getInitialArmyFromQuartel(state.save.citadelLevels.quartel ?? 1),
    )

    const plan = generateRun({
      seed,
      biomeId,
      regionId: region.id,
      n0,
      enemy: {
        horde: region.garrison,
        bossHp: region.bossHp,
        bossName: region.bossName,
        bossTitle: region.bossTitle,
        totalForce: region.garrison + region.bossHp,
      },
      mastery: state.save.mastery,
      observatoryLevel: state.save.citadelLevels.observatorio ?? 1,
      trapAlertSeenCount: state.save.trapAlertSeenCount,
    })

    const nextOracle = pathOracle(plan)
    const forjaLvl = state.save.citadelLevels.forja ?? 0
    const lunetas = CITADEL_BUILDINGS.forja.levelEffects[forjaLvl] ?? 1

    const nextSave: SaveV1 = {
      ...state.save,
      selectedRegionId: region.id,
    }
    SaveRepository.save(nextSave)

    set({
      world: 'run',
      activeEngineId: engineId,
      save: nextSave,
      runPlan: plan,
      oracle: nextOracle,
      snapshot: createInitialSnapshotFromPlan(plan, nextSave.settings.calmMode),
      activeTrapHit: null,
      trapHistoryInRun: [],
      activeRedemptionTokenId: null,
      tokensInRun: [],
      lastRedeemDiagnostic: null,
      battleResolution: null,
      redemptionContract: null,
      lunetaChargesRemaining: lunetas,
      captainSpeech: {
        mood: 'excited',
        text: `Marchando rumo a ${region.name}! Meta para vencer ${region.bossName}: ${formatArmy(plan.enemy.totalForce, nextSave.settings.notationMode)} soldados.`,
      },
    })
  },

  setSteeringX: (laneNormX) => {
    const state = get()
    const clampedX = Math.max(-0.9, Math.min(0.9, laneNormX))
    const laneIdx = resolveLaneIndexFromNormX(clampedX, state.snapshot.laneCount)
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
    // Passo suave horizontal (0.24 por toque) para mover o esquadrão gradualmente pela ponte sem teletransportar
    const stepSize = state.snapshot.laneCount === 3 ? 0.22 : 0.26
    const nextX = Math.max(
      -0.86,
      Math.min(0.86, state.snapshot.laneX + delta * stepSize),
    )
    const nextLane = resolveLaneIndexFromNormX(nextX, state.snapshot.laneCount)
    if (nextLane !== state.snapshot.currentLane) {
      soundEngine.playLaneSwitch(nextLane)
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
      snapshot.phase !== 'CALM_WAIT'
    ) {
      return
    }
    const clampedLane = Math.max(0, Math.min(snapshot.laneCount - 1, laneIndex))
    const targetLaneX = getLaneCenterNormX(clampedLane, snapshot.laneCount)
    const seg = snapshot.segments[snapshot.activeSegmentIndex]
    if (!seg) return

    // Movimento suave em passos na tela: NUNCA teletransporta de um canto ao outro!
    const dx = targetLaneX - snapshot.laneX
    const maxHorizStep = 0.28
    const steppedLaneX =
      Math.abs(dx) <= maxHorizStep
        ? targetLaneX
        : snapshot.laneX + Math.sign(dx) * maxHorizStep

    const isSwitchingSide = Math.abs(dx) > 0.22 && snapshot.phase === 'RUNNING'
    const nextProgress = isSwitchingSide
      ? Math.min(seg.zPosition - 0.012, snapshot.progress + 0.025)
      : seg.zPosition

    if (clampedLane !== snapshot.currentLane) {
      soundEngine.playLaneSwitch(clampedLane)
    }

    set({
      snapshot: {
        ...snapshot,
        currentLane: clampedLane,
        laneX: steppedLaneX,
        phase: 'RUNNING',
        progress: Math.max(snapshot.progress, nextProgress),
      },
    })
    get().tickRun(16)
  },

  tickRun: (dtMs) => {
    const state = get()
    const { snapshot, runPlan, save } = state

    if (snapshot.phase !== 'RUNNING') {
      return
    }

    const safeDt = Math.min(80, Math.max(0, dtMs))
    const nextElapsed = snapshot.elapsedMs + safeDt

    // Velocidade da marcha: percorre 0 -> 1 em ~36 segundos de corrida fluida
    const speedPerMs = 1 / 36000
    let nextProgress = Math.min(1, snapshot.progress + safeDt * speedPerMs)

    const activeSeg = snapshot.segments[snapshot.activeSegmentIndex]

    // Em Modo Calmo, para diante do segmento ativo até o jogador escolher a faixa!
    if (
      save.settings.calmMode &&
      activeSeg &&
      !snapshot.resolvedSegments[activeSeg.id] &&
      nextProgress >= activeSeg.zPosition - 0.018 &&
      snapshot.progress < activeSeg.zPosition - 0.018
    ) {
      nextProgress = activeSeg.zPosition - 0.018
      set({
        snapshot: {
          ...snapshot,
          elapsedMs: nextElapsed,
          progress: nextProgress,
          phase: 'CALM_WAIT',
        },
        captainSpeech: {
          mood: 'calm',
          text: 'Modo Calmo ativo: compare as placas sem pressa e clique no portão escolhido!',
        },
      })
      return
    }

    // Verifica se o exército acabou de cruzar o segmento ativo
    if (
      activeSeg &&
      !snapshot.resolvedSegments[activeSeg.id] &&
      nextProgress >= activeSeg.zPosition
    ) {
      const chosenLane = Math.max(
        0,
        Math.min(activeSeg.lanes.length - 1, snapshot.currentLane),
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
      const cf = evaluateSegmentCounterfactual(activeSeg, armyBefore)
      const appResult = applyGateChainWithRemainder(armyBefore, chosenGates)
      const rawNextArmy = clampArmy(appResult.nextArmy)
      const nextRemainderBank = snapshot.remainderBankInRun + appResult.remainder
      const wasOptimal = rawNextArmy >= cf.bestValue

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

      const resolvedMap = {
        ...snapshot.resolvedSegments,
        [activeSeg.id]: { chosenLane, resultArmy: nextArmy },
      }
      const nextCrowdNodes = buildCrowdNodes(nextArmy)

      // Verificar se é segmento de Portões Gêmeos
      if (activeSeg.kind === 'twins' && activeSeg.twinId) {
        soundEngine.playTwinsHarmony()
        const twinSpec = TWIN_CATALOG[activeSeg.twinId]
        const nextTwins = save.twinsDiscovered.includes(activeSeg.twinId)
          ? save.twinsDiscovered
          : [...save.twinsDiscovered, activeSeg.twinId]
        const academiaBonus =
          CITADEL_BUILDINGS.academia.levelEffects[save.citadelLevels.academia ?? 0] ?? 1
        const nextSaveTwins: SaveV1 = {
          ...save,
          wisdomStars: save.wisdomStars + academiaBonus,
          twinsDiscovered: nextTwins,
          mergeTutorialSeenCount: nextMergeSeenCount,
          stats: {
            ...save.stats,
            highestArmyReached: Math.max(save.stats.highestArmyReached, nextArmy),
          },
        }
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
            currentArmy: nextArmy,
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
      const trapHit = detectTrap(activeSeg, armyBefore, chosenLane)
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
        const safeTrapArmy = clampArmy(nextArmy)
        const nextSaveTrap: SaveV1 = {
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
        }
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
            text: `+1 Ficha Bônus (+${trapHit.loss}) guardada para o final!`,
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

      const safePassArmy = clampArmy(nextArmy)
      const nextSavePass: SaveV1 = {
        ...save,
        mergeTutorialSeenCount: nextMergeSeenCount,
        mastery: nextMastery,
        stats: {
          ...save.stats,
          highestArmyReached: Math.max(save.stats.highestArmyReached, safePassArmy),
        },
      }
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

    // Se terminou todos os segmentos, inicia o Combate Visível (fase 'BATTLE')!
    if (snapshot.activeSegmentIndex >= snapshot.segments.length) {
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
            ? `Faltaram ${resolution.deficit} soldados! Mas suas Fichas de Resgate somam +${contract.totalRecoverableLoss} e garantem a virada!`
            : `Faltaram ${resolution.deficit} soldados! Vamos tentar uma Revanche Tática com o Detector da Cidadela!`,
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

  upgradeCitadelBuilding: (buildingId) => {
    const state = get()
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
    set({ save: fresh })
    get().startNewRun({ regionId: 'r01_ponte_aurora' })
  },
}))
