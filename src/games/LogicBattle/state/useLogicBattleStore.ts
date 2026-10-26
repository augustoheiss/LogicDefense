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
  ArmyCount,
  BattleResolution,
  BiomeId,
  CitadelBuildingId,
  FloatingFeedbackItem,
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

  return {
    seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
    debug,
    world,
    biome,
  }
}

function createInitialSnapshotFromPlan(plan: RunPlan, calmMode: boolean): RunSnapshot {
  const initialLane = 0
  const laneX = getLaneCenterNormX(initialLane, plan.laneCount)
  return {
    runId: plan.runId,
    phase: calmMode ? 'CALM_WAIT' : 'RUNNING',
    elapsedMs: 0,
    progress: 0,
    currentArmy: plan.n0,
    remainderBankInRun: 0,
    currentLane: initialLane,
    laneX,
    laneCount: plan.laneCount,
    activeSegmentIndex: 0,
    segments: plan.segments,
    resolvedSegments: {},
    crowdNodes: buildCrowdNodes(plan.n0),
    recentFeedback: [],
    activeMergeEvent: null,
    inspectedSegmentId: null,
    enemy: plan.enemy,
  }
}

export interface LogicBattleStoreState {
  world: 'run' | 'realm'
  debugMode: boolean
  save: SaveV1
  recoveredFromBackup: boolean
  runPlan: RunPlan
  oracle: PathOracleResult
  snapshot: RunSnapshot
  activeTrapHit: TrapHit | null
  activeRedemptionTokenId: string | null
  tokensInRun: RedemptionToken[]
  lastRedeemDiagnostic: string | null
  battleResolution: BattleResolution | null
  redemptionContract: RedemptionContractOffer | null
  lunetaChargesRemaining: number
  albumDrawerOpen: boolean
  codexDrawerSlug: string | null
  captainSpeech: CaptainSpeech
  lastDirectAttackResult: DirectAttackResult | null

  // Actions
  switchWorld: (world: 'run' | 'realm') => void
  toggleDebugMode: () => void
  startNewRun: (opts?: { regionId?: string; biomeId?: BiomeId; seed?: number }) => void
  setSteeringX: (laneNormX: number) => void
  stepLane: (delta: -1 | 1) => void
  chooseLaneAndAdvance: (laneIndex: number) => void
  tickRun: (dtMs: number) => void
  dismissTrapAlertAndContinue: () => void
  openImmediateRedemptionFromTrap: () => void
  submitRedemptionAnswer: (choiceId: string) => void
  closeRedemptionModal: () => void
  acceptRedemptionContractModal: () => void
  useLunetaOnNextSegment: () => void
  togglePauseRun: () => void
  toggleNotationMode: () => void
  toggleCalmMode: () => void
  toggleSound: () => void
  toggleReducedMotion: () => void
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
  activeRedemptionTokenId: null,
  tokensInRun: [],
  lastRedeemDiagnostic: null,
  battleResolution: null,
  redemptionContract: null,
  lunetaChargesRemaining: initialLunetas,
  albumDrawerOpen: false,
  codexDrawerSlug: null,
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
    })
  },

  toggleDebugMode: () => {
    set((s) => ({ debugMode: !s.debugMode }))
  },

  startNewRun: (opts) => {
    const state = get()
    const targetRegionId = opts?.regionId ?? state.save.selectedRegionId
    const region = REGIONS[targetRegionId] ?? REGIONS.r01_ponte_aurora
    const biomeId = opts?.biomeId ?? region.biomeId
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
      save: nextSave,
      runPlan: plan,
      oracle: nextOracle,
      snapshot: createInitialSnapshotFromPlan(plan, nextSave.settings.calmMode),
      activeTrapHit: null,
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
    const nextLane = Math.max(
      0,
      Math.min(state.snapshot.laneCount - 1, state.snapshot.currentLane + delta),
    )
    if (nextLane !== state.snapshot.currentLane) {
      soundEngine.playLaneSwitch(nextLane)
    }
    const nextX = getLaneCenterNormX(nextLane, state.snapshot.laneCount)
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
    const laneX = getLaneCenterNormX(clampedLane, snapshot.laneCount)
    const seg = snapshot.segments[snapshot.activeSegmentIndex]
    if (!seg) return

    set({
      snapshot: {
        ...snapshot,
        currentLane: clampedLane,
        laneX,
        phase: 'RUNNING',
        progress: seg.zPosition,
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

      // Se for um Portão Dourado do Resgate na ponte
      const isChosenRedemptionGate = Boolean(
        chosenGates[0]?.id.startsWith('redemption_gate_'),
      )
      if (
        activeSeg.kind === 'redemption' &&
        activeSeg.redemptionTokenId &&
        (chosenLane === 0 || isChosenRedemptionGate)
      ) {
        const resolvedMap = {
          ...snapshot.resolvedSegments,
          [activeSeg.id]: { chosenLane, resultArmy: snapshot.currentArmy },
        }
        set({
          activeRedemptionTokenId: activeSeg.redemptionTokenId,
          lastRedeemDiagnostic: null,
          snapshot: {
            ...snapshot,
            elapsedMs: nextElapsed,
            progress: activeSeg.zPosition,
            phase: 'REDEMPTION_CHALLENGE',
            activeSegmentIndex: snapshot.activeSegmentIndex + 1,
            resolvedSegments: resolvedMap,
          },
          captainSpeech: {
            mood: 'excited',
            text: 'Portão Dourado do Resgate! Resolva a Conta de Resgate para recuperar +100% dos soldados!',
          },
        })
        return
      }

      const armyBefore = snapshot.currentArmy
      const cf = evaluateSegmentCounterfactual(activeSeg, armyBefore)
      const appResult = applyGateChainWithRemainder(armyBefore, chosenGates)
      const nextArmy = appResult.nextArmy
      const nextRemainderBank = snapshot.remainderBankInRun + appResult.remainder
      const wasOptimal = nextArmy >= cf.bestValue

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

      // Verificar se disparou Pegadinha Matemática catalogada
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
            highestArmyReached: Math.max(save.stats.highestArmyReached, nextArmy),
          },
        }
        SaveRepository.save(nextSaveTrap)

        const fbTrap: FloatingFeedbackItem = {
          id: `fb_${activeSeg.id}`,
          text: `OPA! PEGADINHA: ${trapHit.trapName}`,
          subText: `Ficha de Resgate (+${trapHit.loss}) ganha!`,
          tone: 'trap',
          createdAtMs: nextElapsed,
        }

        set({
          save: nextSaveTrap,
          activeTrapHit: trapHit,
          tokensInRun: [...state.tokensInRun, newToken],
          snapshot: {
            ...snapshot,
            elapsedMs: nextElapsed,
            progress: activeSeg.zPosition,
            currentArmy: nextArmy,
            remainderBankInRun: nextRemainderBank,
            activeSegmentIndex: snapshot.activeSegmentIndex + 1,
            segments: updatedSegments,
            resolvedSegments: resolvedMap,
            crowdNodes: nextCrowdNodes,
            recentFeedback: [...snapshot.recentFeedback.slice(-4), fbTrap],
            activeMergeEvent: activeMerge,
            phase: 'TRAP_CINEMATIC',
          },
          captainSpeech: {
            mood: 'curious',
            text: `Opa! Pegadinha "${trapHit.trapName}"! ${trapHit.luzGuiaPt} Tome uma Ficha de Resgate para recuperar os ${trapHit.loss} soldados!`,
          },
        })
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

      const nextSavePass: SaveV1 = {
        ...save,
        mergeTutorialSeenCount: nextMergeSeenCount,
        mastery: nextMastery,
        stats: {
          ...save.stats,
          highestArmyReached: Math.max(save.stats.highestArmyReached, nextArmy),
        },
      }
      SaveRepository.save(nextSavePass)

      const deltaArmy = nextArmy - armyBefore
      const signStr = deltaArmy >= 0 ? `+${formatArmy(deltaArmy, save.settings.notationMode)}` : `−${formatArmy(Math.abs(deltaArmy), save.settings.notationMode)}`
      const fbPass: FloatingFeedbackItem = {
        id: `fb_${activeSeg.id}`,
        text: wasOptimal ? `ÓTIMO! (${signStr})` : `${signStr}`,
        subText: appResult.remainder > 0 ? `Resto +${appResult.remainder} na Mina` : undefined,
        tone: wasOptimal ? 'optimal' : 'neutral',
        createdAtMs: nextElapsed,
      }

      const isFinalSegment = snapshot.activeSegmentIndex + 1 >= snapshot.segments.length

      set({
        save: nextSavePass,
        snapshot: {
          ...snapshot,
          elapsedMs: nextElapsed,
          progress: isFinalSegment ? 1 : nextProgress,
          currentArmy: nextArmy,
          remainderBankInRun: nextRemainderBank,
          activeSegmentIndex: snapshot.activeSegmentIndex + 1,
          resolvedSegments: resolvedMap,
          crowdNodes: nextCrowdNodes,
          recentFeedback: [...snapshot.recentFeedback.slice(-4), fbPass],
          activeMergeEvent: activeMerge,
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
                ? `Escolha certeira! Exército agora em ${formatArmy(nextArmy, save.settings.notationMode)}.`
                : `Passamos pelo portão. Continue atento às próximas placas!`,
            },
      })

      if (isFinalSegment) {
        get().tickRun(16)
      }
      return
    }

    // Se terminou todos os segmentos, inicia a Batalha Final!
    if (snapshot.activeSegmentIndex >= snapshot.segments.length) {
      const resolution = resolveBattle(snapshot.currentArmy, snapshot.enemy)
      const contract = evaluateRedemptionContract(
        snapshot.currentArmy,
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
              snapshot.currentArmy,
            ),
          },
        }
        SaveRepository.save(nextSaveWin)

        set({
          save: nextSaveWin,
          battleResolution: resolution,
          redemptionContract: contract,
          snapshot: {
            ...snapshot,
            elapsedMs: nextElapsed,
            progress: 1,
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
              snapshot.currentArmy,
            ),
          },
        }
        SaveRepository.save(nextSaveDefeat)

        set({
          save: nextSaveDefeat,
          battleResolution: resolution,
          redemptionContract: contract,
          snapshot: {
            ...snapshot,
            elapsedMs: nextElapsed,
            progress: 1,
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
      return
    }

    // Atualização contínua da posição Z na ponte
    set({
      snapshot: {
        ...snapshot,
        elapsedMs: nextElapsed,
        progress: nextProgress,
      },
    })
  },

  dismissTrapAlertAndContinue: () => {
    const state = get()
    set({
      activeTrapHit: null,
      snapshot: {
        ...state.snapshot,
        phase: state.save.settings.calmMode ? 'CALM_WAIT' : 'RUNNING',
      },
    })
  },

  openImmediateRedemptionFromTrap: () => {
    const state = get()
    const latestToken = state.tokensInRun[state.tokensInRun.length - 1]
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
      nextSave = {
        ...nextSave,
        reserveTroops: clampArmy(
          nextSave.reserveTroops + region.rewardTroops + survivorBonus,
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

  selectRegion: (regionId) => {
    const state = get()
    if (!REGIONS[regionId]) return
    const nextSave: SaveV1 = {
      ...state.save,
      selectedRegionId: regionId,
    }
    SaveRepository.save(nextSave)
    set({ save: nextSave, lastDirectAttackResult: null })
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
