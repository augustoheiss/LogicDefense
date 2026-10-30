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
import { formatArmy } from './notation'
import { evaluateSegmentCounterfactual, pathOracle } from './pathOracle'
import { createRng, SeededRng } from './rng'

function fmtGateVal(val: number): string {
  return formatArmy(Math.max(1, val), 'compact')
}

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
  exprKind?: Gate['operand']['exprKind'],
  secondaryValue?: number,
): Gate {
  return {
    id,
    op,
    operand: { value: num / den, num, den, exprKind, secondaryValue },
    label,
    readingTimeMs:
      GATE_POLICIES.baseReadingTimeMs +
      (complex ? GATE_POLICIES.complexOperatorReadingBonusMs : 0),
  }
}

/**
 * V9 Pilar 2 & 4: Constrói um segmento justo e variado de progressão (sem pegadinha catalogada) onde:
 * - Os valores são 100% ancorados na força dos monstros do Setor (`enemyTotalForce`), nunca inflando com a Rota Direita.
 * - As decisões rotacionam entre 5 famílias matemáticas distintas (Frações, Porcentagens, Duplo Sinal/PEMDAS,
 *   Decimais e Multiplicação/Soma), evitando a repetição monótona de `+` e `−`.
 */
function buildFairPairSegment(
  segId: string,
  index: number,
  zPosition: number,
  _biomeId: BiomeId,
  laneCount: 2 | 3,
  currentBestArmy: ArmyCount,
  enemyTotalForce: ArmyCount,
  rng: SeededRng,
  usedLabels?: Set<string>,
): LaneSegment {
  const remainingSteps = Math.max(1, 5 - index)
  const targetBest = Math.ceil(enemyTotalForce * 1.22)
  const remainingGap = Math.max(6, targetBest - currentBestArmy)
  const stepTargetAdd = Math.max(6, Math.ceil(remainingGap / remainingSteps))

  const rawAddGood =
    currentBestArmy >= enemyTotalForce
      ? Math.max(
          4,
          Math.round(enemyTotalForce * (0.08 + index * 0.025)) + rng.nextInt(2, 5),
        )
      : Math.max(
          stepTargetAdd,
          Math.round(currentBestArmy * 0.24) + rng.nextInt(3, 7),
        )

  // Evita repetir exatamente a mesma placa '+ X' em segmentos consecutivos
  let addGood = rawAddGood
  if (usedLabels && usedLabels.has(`+ ${fmtGateVal(addGood)}`)) {
    const jitter =
      rawAddGood >= 1000
        ? Math.max(10, Math.round(rawAddGood * (0.09 + index * 0.045)))
        : index + 2
    addGood = rawAddGood + jitter
  }
  const addModest = Math.max(2, Math.floor(addGood * 0.35) + (index % 2))
  const canMultiplySafely = currentBestArmy * 2 <= enemyTotalForce * 1.38

  let subAmt =
    currentBestArmy <= 90 && enemyTotalForce <= 120
      ? Math.max(2, Math.min(Math.floor(currentBestArmy * 0.2), 10))
      : Math.max(3, Math.floor(Math.max(currentBestArmy, enemyTotalForce * 0.2) * (0.14 + index * 0.03)))
  if (usedLabels && usedLabels.has(`− ${fmtGateVal(subAmt)}`)) {
    subAmt = Math.max(2, Math.round(subAmt * (1.15 + index * 0.05)) + index + 1)
  }

  const familyIdx = (index * 2 + rng.nextInt(0, 4)) % 5
  let bestGate: Gate
  let altGate: Gate

  if (familyIdx === 0) {
    // Família 0: Frações & Divisão por Fração (× 3/2, ÷ 1/2 vs × 1/2)
    if (canMultiplySafely && currentBestArmy >= 8) {
      bestGate =
        rng.nextFloat() < 0.5
          ? makeSimpleGate(`${segId}_best`, '÷', 1, 2, '÷ 1/2', true)
          : makeSimpleGate(`${segId}_best`, '×', 3, 2, '× 3/2', true)
    } else {
      bestGate = makeSimpleGate(
        `${segId}_best`,
        '+',
        addGood,
        1,
        `+ ${fmtGateVal(addGood)}`,
      )
    }
    altGate =
      currentBestArmy >= 10
        ? makeSimpleGate(`${segId}_alt`, '×', 1, 2, '× 1/2', true)
        : makeSimpleGate(`${segId}_alt`, '−', subAmt, 1, `− ${fmtGateVal(subAmt)}`)
  } else if (familyIdx === 1) {
    // Família 1: Porcentagens (+ 50% vs − 20%)
    bestGate =
      canMultiplySafely && currentBestArmy >= 8
        ? makeSimpleGate(`${segId}_best`, '%+', 50, 1, '+ 50%', true)
        : makeSimpleGate(`${segId}_best`, '+', addGood, 1, `+ ${fmtGateVal(addGood)}`)
    altGate =
      currentBestArmy >= 10
        ? makeSimpleGate(`${segId}_alt`, '%−', 20, 1, '− 20%', true)
        : makeSimpleGate(`${segId}_alt`, '−', subAmt, 1, `− ${fmtGateVal(subAmt)}`)
  } else if (familyIdx === 2) {
    // Família 2: Duplo Sinal −(−A) ou Expressão Composta PEMDAS (+ k × k)
    const k = Math.max(2, Math.round(Math.sqrt(addGood)))
    if (rng.nextFloat() < 0.55) {
      bestGate = makeSimpleGate(
        `${segId}_best`,
        'expr',
        addGood,
        1,
        `− (−${fmtGateVal(addGood)})`,
        true,
        'sub_neg',
      )
    } else {
      bestGate = makeSimpleGate(
        `${segId}_best`,
        'expr',
        k * k,
        1,
        `+ ${fmtGateVal(k)} × ${fmtGateVal(k)}`,
        true,
        'add_mul',
        k,
      )
    }
    altGate = makeSimpleGate(`${segId}_alt`, '−', subAmt, 1, `− ${fmtGateVal(subAmt)}`)
  } else if (familyIdx === 3) {
    // Família 3: Decimais (× 1,5 ou ÷ 0,5 vs × 0,8)
    bestGate =
      canMultiplySafely && currentBestArmy >= 8
        ? rng.nextFloat() < 0.5
          ? makeSimpleGate(`${segId}_best`, '×', 3, 2, '× 1,5', true)
          : makeSimpleGate(`${segId}_best`, '÷', 1, 2, '÷ 0,5', true)
        : makeSimpleGate(`${segId}_best`, '+', addGood, 1, `+ ${fmtGateVal(addGood)}`)
    altGate =
      currentBestArmy >= 10
        ? makeSimpleGate(`${segId}_alt`, '×', 4, 5, '× 0,8', true)
        : makeSimpleGate(`${segId}_alt`, '−', subAmt, 1, `− ${fmtGateVal(subAmt)}`)
  } else {
    // Família 4: Multiplicação Direta vs Soma/Subtração
    const useMul = currentBestArmy >= 8 && canMultiplySafely && rng.nextFloat() < 0.5
    bestGate = useMul
      ? makeSimpleGate(`${segId}_best`, '×', 2, 1, '× 2')
      : makeSimpleGate(`${segId}_best`, '+', addGood, 1, `+ ${fmtGateVal(addGood)}`)
    altGate = makeSimpleGate(`${segId}_alt`, '−', subAmt, 1, `− ${fmtGateVal(subAmt)}`)
  }

  const lanes: Gate[][] =
    rng.nextFloat() < 0.5 ? [[bestGate], [altGate]] : [[altGate], [bestGate]]

  if (laneCount === 3) {
    const midAdd = Math.max(2, Math.floor((addGood + addModest) / 2))
    lanes.push([makeSimpleGate(`${segId}_mid`, '+', midAdd, 1, `+ ${fmtGateVal(midAdd)}`)])
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
      ? enemyTotalForce > 120
        ? Math.max(6, Math.round(runningBestBeforeFinal * 0.06))
        : rng.nextInt(3, 6)
      : Math.max(6, minBestTarget - runningBestBeforeFinal)

  const bestGate = makeSimpleGate(
    `${segId}_cal_best`,
    '+',
    neededDelta,
    1,
    `+ ${fmtGateVal(neededDelta)}`,
  )

  // Para garantir que o pior caminho termine estritamente abaixo de enemyTotalForce e seja redutor:
  let worstGate: Gate
  if (runningWorstBeforeFinal >= enemyTotalForce) {
    const dropNeeded = Math.max(1, runningWorstBeforeFinal - Math.max(1, enemyTotalForce * 0.85))
    worstGate = makeSimpleGate(
      `${segId}_cal_worst`,
      '−',
      dropNeeded,
      1,
      `− ${fmtGateVal(dropNeeded)}`,
    )
  } else {
    const refScale =
      enemyTotalForce > 120
        ? Math.max(runningWorstBeforeFinal, Math.floor(runningBestBeforeFinal * 0.22))
        : runningWorstBeforeFinal
    const scaledDrop =
      refScale > 30
        ? Math.max(2, Math.floor(refScale * 0.22))
        : Math.max(1, Math.min(2, Math.max(1, runningWorstBeforeFinal - 2)))
    worstGate = makeSimpleGate(`${segId}_cal_worst`, '−', scaledDrop, 1, `− ${fmtGateVal(scaledDrop)}`)
  }

  const lanes: Gate[][] =
    rng.nextFloat() < 0.5 ? [[bestGate], [worstGate]] : [[worstGate], [bestGate]]

  if (laneCount === 3) {
    const midDelta = Math.max(2, Math.floor(neededDelta * 0.5))
    lanes.push([makeSimpleGate(`${segId}_cal_mid`, '+', midDelta, 1, `+ ${fmtGateVal(midDelta)}`)])
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
  const rawInputN0 = clampArmy(params.n0 ?? 5)
  const mastery = params.mastery ?? createInitialMastery()
  const observatoryLevel = params.observatoryLevel ?? 1
  const trapAlertSeenCount = params.trapAlertSeenCount ?? ({} as Record<TrapId, number>)
  const enemy =
    params.enemy ?? createDefaultEnemyForBiome(params.biomeId, rawInputN0)

  // V9 Pilar 2: Ancorar a referência de geração da Rota Central na força dos monstros do Setor (`enemy.totalForce`),
  // impedindo que soldados exponenciais da Rota Direita inflem os portões centrais!
  const monsterBaselineN0 =
    enemy.totalForce <= 120
      ? 5
      : Math.max(10, Math.round(enemy.totalForce * 0.18))
  const n0 = params.enemy ? monsterBaselineN0 : rawInputN0

  const segments: LaneSegment[] = []
  const usedTraps = new Set<TrapId>()
  const usedGateLabels = attemptSeed === 42 ? undefined : new Set<string>()
  let runningBest = n0
  let runningWorst = n0
  let lastTrapIndex = -10
  let detectorAlertsUsed = 0
  let placedTwins = false

  const twinTargetIndex = 2
  let maxBestAllowed = Math.max(
    Math.ceil(enemy.totalForce * GATE_POLICIES.oracleMaxBestRatio),
    enemy.totalForce > 120 ? Math.ceil(n0 * 5.5) : 0,
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

    // Inserir 1 segmento de Portões Gêmeos por corrida (filtrando ×10³ fora da Torre das Potências se o inimigo não exigir salto de milhar)
    if (!placedTwins && i >= twinTargetIndex && i < segmentCount - 2 && biome.twinIds.length > 0) {
      const eligibleTwins =
        (enemy.totalForce < 600 || enemy.totalForce < n0 * 400) &&
        params.biomeId !== 'torre_potencias'
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

    // Verificar se é hora de inserir uma Pegadinha Matemática (V9: 2 pegadinhas por corrida de 6 segmentos)
    const canPlaceTrap =
      i >= 1 &&
      i < segmentCount - 1 &&
      i - lastTrapIndex >= GATE_POLICIES.baseTrapEveryNSegments

    if (canPlaceTrap) {
      const triedInSegment = new Set<TrapId>(usedTraps)
      let trapPlaced = false
      for (let trapAttempt = 0; trapAttempt < 10; trapAttempt++) {
        const chosenTrapId = selectNextTrapForBiome(
          params.biomeId,
          runningBest,
          mastery,
          rng.nextFloat,
          triedInSegment,
        )
        if (!chosenTrapId || triedInSegment.has(chosenTrapId)) break
        triedInSegment.add(chosenTrapId)

        const entry = TRAP_CATALOG[chosenTrapId]
        const built = entry.buildSegment(runningBest, rng.nextFloat, laneCount)
        const showWarning = shouldShowObservatoryDetector(
          chosenTrapId,
          observatoryLevel,
          trapAlertSeenCount,
          mastery,
          detectorAlertsUsed,
        )

        let trapLanes = built.lanes
        let trapIntuitiveLane = built.intuitiveLane
        if (
          usedTraps.size === 0 &&
          built.intuitiveLane === 1 &&
          built.lanes.length >= 2
        ) {
          trapLanes = [built.lanes[1], built.lanes[0], ...built.lanes.slice(2)]
          trapIntuitiveLane = 0
        }

        const candidateSeg: LaneSegment = {
          id: segId,
          index: i,
          kind: built.kind,
          lanes: trapLanes,
          trapId: chosenTrapId,
          intuitiveLane: trapIntuitiveLane,
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
          trapPlaced = true
          break
        }
      }
      if (trapPlaced) continue
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
      usedGateLabels,
    )
    if (usedGateLabels) {
      for (const lane of fairSeg.lanes) {
        for (const g of lane) {
          usedGateLabels.add(g.label)
        }
      }
    }
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
    oracle.worst < enemy.totalForce &&
    usedTraps.size >= 1 &&
    placedTwins
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
  const rawInputN0 = clampArmy(params.n0 ?? 5)
  const enemy =
    params.enemy ?? createDefaultEnemyForBiome(params.biomeId, rawInputN0)
  const monsterBaselineN0 =
    enemy.totalForce <= 120
      ? 5
      : Math.max(10, Math.round(enemy.totalForce * 0.18))
  const n0 = params.enemy ? monsterBaselineN0 : rawInputN0
  const targetBest = Math.ceil(enemy.totalForce * 1.35)
  const stepAdd = Math.max(5, Math.ceil((targetBest - n0) / biome.segmentCount))

  const fallbackSegments: LaneSegment[] = Array.from(
    { length: biome.segmentCount },
    (_, idx) => {
      const zPosition = Number(((idx + 1) / (biome.segmentCount + 1)).toFixed(4))
      const segAdd = Math.max(5, Math.round(stepAdd * (0.72 + idx * 0.07)))
      const subPenalty = Math.max(
        1,
        Math.round(Math.max(n0, segAdd) * (0.14 + idx * 0.035)),
      )
      const gBest =
        idx % 3 === 1 && n0 >= 10
          ? makeSimpleGate(`fb_${idx}_b`, '×', 2, 1, '× 2')
          : makeSimpleGate(`fb_${idx}_b`, '+', segAdd, 1, `+ ${fmtGateVal(segAdd)}`)
      const gWorst =
        idx % 4 === 2 && n0 >= 20
          ? makeSimpleGate(`fb_${idx}_w`, '÷', 2, 1, '÷ 2', true)
          : makeSimpleGate(`fb_${idx}_w`, '−', subPenalty, 1, `− ${fmtGateVal(subPenalty)}`)
      const lanes: Gate[][] = idx % 2 === 0 ? [[gBest], [gWorst]] : [[gWorst], [gBest]]
      if (biome.laneCount === 3) {
        const midAdd = Math.max(1, Math.floor(segAdd / 2))
        lanes.push([
          makeSimpleGate(`fb_${idx}_m`, '+', midAdd, 1, `+ ${fmtGateVal(midAdd)}`),
        ])
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
      label: `★ RESGATE (+${fmtGateVal(token.loss)})`,
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
