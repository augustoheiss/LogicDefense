// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/gateGenerator.ts — Gerador Determinístico + Oráculo (§3.2 C5)
// ──────────────────────────────────────────────────────────────────────────────
import { BIOMES } from '../config/biomes'
import { GATE_POLICIES } from '../config/gatePolicies'
import { TRAP_CATALOG, TWIN_CATALOG } from '../config/trapCatalog'
import {
  ArmyCount,
  BiomeId,
  ConceptId,
  ConceptMasteryRecord,
  EnemySpec,
  Gate,
  LaneSegment,
  RedemptionToken,
  RunPlan,
  TrapId,
} from '../types'
import { clampArmy } from './armyMath'
import {
  createInitialMastery,
  selectNextTrapForBiome,
  shouldShowObservatoryDetector,
} from './mastery'
import { evaluateSegmentCounterfactual, pathOracle } from './pathOracle'
import { createRng, SeededRng } from './rng'

export interface GenerateRunParams {
  seed: number
  biomeId: BiomeId
  regionId?: string
  n0?: ArmyCount
  enemy?: EnemySpec
  mastery?: Readonly<Record<ConceptId, ConceptMasteryRecord>>
  observatoryLevel?: number
  trapAlertSeenCount?: Readonly<Record<TrapId, number>>
}

function makeSimpleGate(
  id: string,
  op: Gate['op'],
  num: number,
  den: number,
  label: string,
  complex = false,
): Gate {
  return {
    id,
    op,
    operand: { value: num / den, num, den },
    label,
    readingTimeMs:
      GATE_POLICIES.baseReadingTimeMs +
      (complex ? GATE_POLICIES.complexOperatorReadingBonusMs : 0),
  }
}

/**
 * Constrói um segmento justo de progressão (sem pegadinha catalogada) onde:
 * - A melhor faixa sempre cresce o exército (`>= armyBefore + 1`).
 * - A faixa alternativa cresce menos ou reduz moderadamente (para que o caminho ótimo importe),
 *   sem nunca violar a Regra do Portão Justo (sempre há pelo menos 1 faixa boa).
 */
function buildFairPairSegment(
  segId: string,
  index: number,
  zPosition: number,
  biomeId: BiomeId,
  laneCount: 2 | 3,
  currentBestArmy: ArmyCount,
  enemyTotalForce: ArmyCount,
  rng: SeededRng,
): LaneSegment {
  const isAlreadyAboveEnemy = currentBestArmy >= enemyTotalForce
  const remainingGap = Math.max(4, enemyTotalForce - currentBestArmy)
  const addGood = isAlreadyAboveEnemy
    ? rng.nextInt(2, 5)
    : Math.max(
        4,
        Math.min(
          Math.max(10, Math.ceil(remainingGap * 0.25)),
          Math.round(currentBestArmy * 0.28) + rng.nextInt(3, 8),
        ),
      )
  const addModest = Math.max(1, Math.floor(addGood * 0.35))
  const canMultiplySafely = currentBestArmy * 2 <= enemyTotalForce * 1.15

  let bestGate: Gate
  let altGate: Gate

  if (biomeId === 'planicie_pedra') {
    const useMul = currentBestArmy >= 8 && canMultiplySafely && rng.nextFloat() < 0.4
    if (useMul) {
      bestGate = makeSimpleGate(`${segId}_best`, '×', 2, 1, '× 2')
      altGate = makeSimpleGate(`${segId}_alt`, '+', addModest, 1, `+ ${addModest}`)
    } else {
      bestGate = makeSimpleGate(`${segId}_best`, '+', addGood, 1, `+ ${addGood}`)
      const subAmt = Math.max(1, Math.min(Math.floor(currentBestArmy * 0.25), 6))
      altGate =
        currentBestArmy > 6 && rng.nextFloat() < 0.5
          ? makeSimpleGate(`${segId}_alt`, '−', subAmt, 1, `− ${subAmt}`)
          : makeSimpleGate(`${segId}_alt`, '+', addModest, 1, `+ ${addModest}`)
    }
  } else if (biomeId === 'fiorde_gelado') {
    bestGate =
      canMultiplySafely && rng.nextFloat() < 0.5
        ? makeSimpleGate(`${segId}_best`, '×', 3, 2, '× 3/2', true)
        : makeSimpleGate(`${segId}_best`, '+', addGood, 1, `+ ${addGood}`)
    altGate =
      index >= 4
        ? makeSimpleGate(`${segId}_alt`, '+', addModest, 1, `+ ${addModest}`)
        : makeSimpleGate(`${segId}_alt`, '÷', 2, 1, '÷ 2', true)
  } else if (biomeId === 'deserto_decimais') {
    bestGate =
      canMultiplySafely && rng.nextFloat() < 0.5
        ? makeSimpleGate(`${segId}_best`, '%+', 50, 1, '+ 50%', true)
        : makeSimpleGate(`${segId}_best`, '+', addGood, 1, `+ ${addGood}`)
    altGate = makeSimpleGate(`${segId}_alt`, '%−', 20, 1, '− 20%', true)
  } else if (biomeId === 'vulcao_negativos') {
    bestGate = makeSimpleGate(`${segId}_best`, '+', addGood, 1, `+ ${addGood}`)
    const subAmt = Math.max(1, Math.floor(currentBestArmy * 0.2))
    altGate = makeSimpleGate(`${segId}_alt`, '−', subAmt, 1, `− ${subAmt}`)
  } else {
    bestGate =
      canMultiplySafely && currentBestArmy < 250 && rng.nextFloat() < 0.45
        ? makeSimpleGate(`${segId}_best`, '×', 2, 1, '× 2')
        : makeSimpleGate(`${segId}_best`, '+', addGood, 1, `+ ${addGood}`)
    altGate = makeSimpleGate(`${segId}_alt`, '+', addModest, 1, `+ ${addModest}`)
  }

  const lanes: Gate[][] =
    rng.nextFloat() < 0.5 ? [[bestGate], [altGate]] : [[altGate], [bestGate]]

  if (laneCount === 3) {
    const midAdd = Math.max(2, Math.floor((addGood + addModest) / 2))
    lanes.push([makeSimpleGate(`${segId}_mid`, '+', midAdd, 1, `+ ${midAdd}`)])
  }

  return {
    id: segId,
    index,
    kind: 'pair',
    lanes,
    zPosition,
  }
}

/**
 * Ajusta o último segmento de progressão para garantir matematicamente que:
 * - `oracle.best >= enemy.totalForce * 1.15`
 * - `oracle.worst < enemy.totalForce`
 * - Ao menos 1 faixa no último segmento também é um Portão Justo (`>= prevBest`).
 */
function buildCalibratedFinalSegment(
  segId: string,
  index: number,
  zPosition: number,
  laneCount: 2 | 3,
  runningBestBeforeFinal: ArmyCount,
  runningWorstBeforeFinal: ArmyCount,
  enemyTotalForce: ArmyCount,
  rng: SeededRng,
): LaneSegment {
  const minBestTarget = Math.ceil(
    enemyTotalForce * (1 + GATE_POLICIES.oracleBestMarginRatio + 0.05),
  )
  const neededDelta =
    runningBestBeforeFinal >= minBestTarget
      ? rng.nextInt(3, 6)
      : Math.max(6, minBestTarget - runningBestBeforeFinal)

  const bestGate = makeSimpleGate(
    `${segId}_cal_best`,
    '+',
    neededDelta,
    1,
    `+ ${neededDelta}`,
  )

  // Para garantir que o pior caminho termine estritamente abaixo de enemyTotalForce:
  let worstGate: Gate
  if (runningWorstBeforeFinal >= enemyTotalForce) {
    const dropNeeded = runningWorstBeforeFinal - Math.max(1, enemyTotalForce - 5)
    worstGate = makeSimpleGate(
      `${segId}_cal_worst`,
      '−',
      Math.max(1, dropNeeded),
      1,
      `− ${Math.max(1, dropNeeded)}`,
    )
  } else {
    const safeSmallAdd = Math.max(
      0,
      Math.min(3, Math.floor((enemyTotalForce - 1 - runningWorstBeforeFinal) * 0.25)),
    )
    worstGate =
      safeSmallAdd > 0
        ? makeSimpleGate(`${segId}_cal_worst`, '+', safeSmallAdd, 1, `+ ${safeSmallAdd}`)
        : makeSimpleGate(`${segId}_cal_worst`, '−', 2, 1, '− 2')
  }

  const lanes: Gate[][] =
    rng.nextFloat() < 0.5 ? [[bestGate], [worstGate]] : [[worstGate], [bestGate]]

  if (laneCount === 3) {
    const midDelta = Math.max(2, Math.floor(neededDelta * 0.5))
    lanes.push([makeSimpleGate(`${segId}_cal_mid`, '+', midDelta, 1, `+ ${midDelta}`)])
  }

  return {
    id: segId,
    index,
    kind: 'pair',
    lanes,
    zPosition,
  }
}

function createDefaultEnemyForBiome(
  biomeId: BiomeId,
  n0: ArmyCount,
): EnemySpec {
  const baseByBiome: Record<BiomeId, { horde: number; bossHp: number; name: string; title: string }> = {
    planicie_pedra: {
      horde: 45,
      bossHp: 25,
      name: 'Bastião da Soma Cega',
      title: 'Guardião da Ponte de Pedra',
    },
    fiorde_gelado: {
      horde: 70,
      bossHp: 40,
      name: 'Jarl Meio-Divisor',
      title: 'Senhor das Frações Congeladas',
    },
    deserto_decimais: {
      horde: 110,
      bossHp: 60,
      name: 'Miragem de Porcentagem',
      title: 'Sultão da Vírgula Móvel',
    },
    vulcao_negativos: {
      horde: 150,
      bossHp: 80,
      name: 'Ignis Duplo-Sinal',
      title: 'Forjador de Inversos',
    },
    torre_potencias: {
      horde: 240,
      bossHp: 120,
      name: 'Arconte Expoente Zero',
      title: 'Soberano das Ordens de Grandeza',
    },
  }

  const spec = baseByBiome[biomeId]
  const scale = Math.max(1, Math.round(n0 / 5))
  const horde = spec.horde * scale
  const bossHp = spec.bossHp * scale
  return {
    horde,
    bossHp,
    bossName: spec.name,
    bossTitle: spec.title,
    totalForce: horde + bossHp,
  }
}

function tryBuildRunWithSeed(
  attemptSeed: number,
  params: GenerateRunParams,
): RunPlan | null {
  const rng = createRng(attemptSeed)
  const biome = BIOMES[params.biomeId]
  const laneCount = biome.laneCount
  const segmentCount = biome.segmentCount
  const n0 = clampArmy(params.n0 ?? 5)
  const mastery = params.mastery ?? createInitialMastery()
  const observatoryLevel = params.observatoryLevel ?? 1
  const trapAlertSeenCount = params.trapAlertSeenCount ?? ({} as Record<TrapId, number>)
  const enemy = params.enemy ?? createDefaultEnemyForBiome(params.biomeId, n0)

  const segments: LaneSegment[] = []
  const usedTraps = new Set<TrapId>()
  let runningBest = n0
  let runningWorst = n0
  let lastTrapIndex = -10
  let detectorAlertsUsed = 0
  let placedTwins = false

  const twinTargetIndex = 2
  let maxBestAllowed = Math.max(
    Math.ceil(enemy.totalForce * GATE_POLICIES.oracleMaxBestRatio),
    n0 + 95,
  )

  for (let i = 0; i < segmentCount; i++) {
    const zPosition = Number(((i + 1) / (segmentCount + 1)).toFixed(4))
    const segId = `seg_${attemptSeed}_${i}`

    // Último segmento: calibração fina com o Oráculo
    if (i === segmentCount - 1) {
      const finalSeg = buildCalibratedFinalSegment(
        segId,
        i,
        zPosition,
        laneCount,
        runningBest,
        runningWorst,
        enemy.totalForce,
        rng,
      )
      segments.push(finalSeg)
      const cf = evaluateSegmentCounterfactual(finalSeg, runningBest)
      const cfW = evaluateSegmentCounterfactual(finalSeg, runningWorst)
      runningBest = cf.bestValue
      runningWorst = cfW.worstValue
      continue
    }

    // Inserir 1 segmento de Portões Gêmeos por corrida (filtrando ×10³ fora da Torre das Potências se o inimigo for pequeno)
    if (!placedTwins && i >= twinTargetIndex && i < segmentCount - 2 && biome.twinIds.length > 0) {
      const eligibleTwins =
        enemy.totalForce < 600 && params.biomeId !== 'torre_potencias'
          ? biome.twinIds.filter((tid) => tid !== 'G04')
          : biome.twinIds
      const twinPool = eligibleTwins.length > 0 ? eligibleTwins : biome.twinIds
      const twinId = rng.pick(twinPool)
      const twinEntry = TWIN_CATALOG[twinId]
      const twinLanes = twinEntry.buildLanes(laneCount)
      const twinSeg: LaneSegment = {
        id: segId,
        index: i,
        kind: 'twins',
        lanes: twinLanes,
        twinId,
        zPosition,
      }
      const cf = evaluateSegmentCounterfactual(twinSeg, runningBest)
      if (
        cf.bestValue >= 2 &&
        (twinId === 'G04' || cf.bestValue <= maxBestAllowed || cf.bestValue <= runningBest)
      ) {
        segments.push(twinSeg)
        const cfW = evaluateSegmentCounterfactual(twinSeg, runningWorst)
        runningBest = cf.bestValue
        runningWorst = cfW.worstValue
        if (twinId === 'G04') {
          maxBestAllowed = Math.max(maxBestAllowed, Math.ceil(runningBest * 2.2))
        }
        placedTwins = true
        continue
      }
    }

    // Verificar se é hora de inserir uma Pegadinha Matemática (~1 a cada 4 segmentos, nunca consecutivas)
    const canPlaceTrap =
      i >= 1 &&
      i < segmentCount - 2 &&
      i - lastTrapIndex >= GATE_POLICIES.baseTrapEveryNSegments

    if (canPlaceTrap) {
      const chosenTrapId = selectNextTrapForBiome(
        params.biomeId,
        runningBest,
        mastery,
        rng.nextFloat,
        usedTraps,
      )

      if (chosenTrapId) {
        const entry = TRAP_CATALOG[chosenTrapId]
        const built = entry.buildSegment(runningBest, rng.nextFloat, laneCount)
        const showWarning = shouldShowObservatoryDetector(
          chosenTrapId,
          observatoryLevel,
          trapAlertSeenCount,
          mastery,
          detectorAlertsUsed,
        )

        const candidateSeg: LaneSegment = {
          id: segId,
          index: i,
          kind: built.kind,
          lanes: built.lanes,
          trapId: chosenTrapId,
          intuitiveLane: built.intuitiveLane,
          showDetectorWarning: showWarning,
          zPosition,
        }

        const cf = evaluateSegmentCounterfactual(candidateSeg, runningBest)
        // Garantir Regra do Portão Justo (n' >= 2, melhor > pior) e evitar explosão exponencial
        if (
          cf.bestValue >= 2 &&
          cf.bestValue > cf.worstValue &&
          (cf.bestValue <= maxBestAllowed || cf.bestValue <= runningBest)
        ) {
          segments.push(candidateSeg)
          const cfW = evaluateSegmentCounterfactual(candidateSeg, runningWorst)
          runningBest = cf.bestValue
          runningWorst = cfW.worstValue
          usedTraps.add(chosenTrapId)
          lastTrapIndex = i
          if (showWarning) detectorAlertsUsed++
          continue
        }
      }
    }

    // Segmento normal justo
    const fairSeg = buildFairPairSegment(
      segId,
      i,
      zPosition,
      params.biomeId,
      laneCount,
      runningBest,
      enemy.totalForce,
      rng,
    )
    segments.push(fairSeg)
    const cf = evaluateSegmentCounterfactual(fairSeg, runningBest)
    const cfW = evaluateSegmentCounterfactual(fairSeg, runningWorst)
    runningBest = cf.bestValue
    runningWorst = cfW.worstValue
  }

  const candidatePlan: RunPlan = {
    runId: `run_${attemptSeed}`,
    seed: attemptSeed,
    biomeId: params.biomeId,
    regionId: params.regionId ?? 'r01_ponte_aurora',
    laneCount,
    n0,
    segments,
    enemy,
    durationTargetSec: biome.durationTargetSec,
  }

  const oracle = pathOracle(candidatePlan)
  const minRequiredBest = Math.ceil(
    enemy.totalForce * (1 + GATE_POLICIES.oracleBestMarginRatio),
  )

  if (
    oracle.best >= minRequiredBest &&
    oracle.best <= maxBestAllowed + 15 &&
    oracle.worst < enemy.totalForce
  ) {
    return candidatePlan
  }

  return null
}

/**
 * Gera um `RunPlan` completo validado pelo `pathOracle`.
 * Re-sorteia até `GATE_POLICIES.maxSeedRetries` vezes se necessário e possui fallback autoral
 * garantido para que 100% das chamadas retornem um plano matematicamente íntegro.
 */
export function generateRun(params: GenerateRunParams): RunPlan {
  const baseSeed = params.seed >>> 0

  for (let retry = 0; retry < GATE_POLICIES.maxSeedRetries; retry++) {
    const attemptSeed = (baseSeed + retry * 7919) >>> 0
    const plan = tryBuildRunWithSeed(attemptSeed, params)
    if (plan) {
      return {
        ...plan,
        seed: baseSeed,
      }
    }
  }

  // Fallback autoral infalível caso todas as tentativas aleatórias falhem
  const biome = BIOMES[params.biomeId]
  const n0 = clampArmy(params.n0 ?? 5)
  const enemy = params.enemy ?? createDefaultEnemyForBiome(params.biomeId, n0)
  const targetBest = Math.ceil(enemy.totalForce * 1.35)
  const stepAdd = Math.max(5, Math.ceil((targetBest - n0) / biome.segmentCount))

  const fallbackSegments: LaneSegment[] = Array.from(
    { length: biome.segmentCount },
    (_, idx) => {
      const zPosition = Number(((idx + 1) / (biome.segmentCount + 1)).toFixed(4))
      const gBest = makeSimpleGate(`fb_${idx}_b`, '+', stepAdd, 1, `+ ${stepAdd}`)
      const gWorst = makeSimpleGate(`fb_${idx}_w`, '−', 1, 1, '− 1')
      const lanes: Gate[][] = [[gBest], [gWorst]]
      if (biome.laneCount === 3) {
        lanes.push([makeSimpleGate(`fb_${idx}_m`, '+', Math.max(1, Math.floor(stepAdd / 2)), 1, `+ ${Math.max(1, Math.floor(stepAdd / 2))}`)])
      }
      return {
        id: `fb_seg_${idx}`,
        index: idx,
        kind: 'pair',
        lanes,
        zPosition,
      }
    },
  )

  return {
    runId: `run_${baseSeed}_fallback`,
    seed: baseSeed,
    biomeId: params.biomeId,
    regionId: params.regionId ?? 'r01_ponte_aurora',
    laneCount: biome.laneCount,
    n0,
    segments: fallbackSegments,
    enemy,
    durationTargetSec: biome.durationTargetSec,
  }
}

/**
 * Transforma um segmento futuro (a até `maxSegmentsUntilRedemptionGate` passos)
 * em um Portão Dourado do Resgate na pista, vinculado à Ficha de Resgate recém-ganha.
 */
export function injectRedemptionSegmentOnBridge(
  segments: readonly LaneSegment[],
  afterSegmentIndex: number,
  token: RedemptionToken,
  laneCount: 2 | 3,
): LaneSegment[] {
  const updated = segments.map((s) => ({ ...s, lanes: s.lanes.map((l) => [...l]) }))
  const maxIdx = Math.min(
    updated.length - 2,
    afterSegmentIndex + GATE_POLICIES.maxSegmentsUntilRedemptionGate,
  )

  let targetIdx = -1
  for (let i = afterSegmentIndex + 1; i <= maxIdx; i++) {
    if (updated[i] && !updated[i].trapId && updated[i].kind === 'pair') {
      targetIdx = i
      break
    }
  }

  if (targetIdx === -1 && afterSegmentIndex + 1 < updated.length - 1) {
    targetIdx = afterSegmentIndex + 1
  }

  if (targetIdx !== -1) {
    const seg = updated[targetIdx]
    const goldenGate: Gate = {
      id: `redemption_gate_${token.id}`,
      op: '+',
      operand: { value: token.loss, num: token.loss, den: 1 },
      label: `★ RESGATE (+${token.loss})`,
      subLabel: token.trapName,
      readingTimeMs: GATE_POLICIES.baseReadingTimeMs,
    }
    const safeAltGate = seg.lanes[0]?.[0] ?? makeSimpleGate(`alt_${targetIdx}`, '+', 3, 1, '+ 3')
    const newLanes: Gate[][] = [[goldenGate], [safeAltGate]]
    if (laneCount === 3) {
      newLanes.push([seg.lanes[2]?.[0] ?? safeAltGate])
    }
    updated[targetIdx] = {
      ...seg,
      kind: 'redemption',
      redemptionTokenId: token.id,
      lanes: newLanes,
    }
  }

  return updated
}
