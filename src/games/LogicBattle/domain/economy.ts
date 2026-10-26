// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/economy.ts — Economia do Mundo 2 (Reino & Cidadela)
// ──────────────────────────────────────────────────────────────────────────────
import { GATE_POLICIES } from '../config/gatePolicies'
import { REGIONS } from '../config/regions'
import { CITADEL_BUILDINGS, getUpgradeCost } from '../config/upgrades'
import {
  ArmyCount,
  CitadelBuildingId,
  RegionSpec,
} from '../types'
import { clampArmy } from './armyMath'

/**
 * Calcula o bônus de sobreviventes transferido para a Reserva do Reino após vitória na ponte,
 * aplicando um teto harmônico proporcional à recompensa regional para impedir que uma única
 * corrida inicial inflacione toda a economia do Mundo 2 (§2.1 R2).
 */
export function calculateCappedSurvivorBonus(
  survivors: ArmyCount,
  regionRewardTroops: ArmyCount,
): ArmyCount {
  const safeSurvivors = clampArmy(survivors)
  const cap = Math.max(
    25,
    Math.ceil(clampArmy(regionRewardTroops) * GATE_POLICIES.maxSurvivorReserveBonusRatio),
  )
  return Math.min(safeSurvivors, cap)
}

/**
 * Uma região pode ser desafiada se já foi conquistada (para replay) ou se é vizinha
 * de ao menos uma região já conquistada (ou é a região inicial `r01_ponte_aurora`).
 */
export function canAttackRegion(
  regionId: string,
  conqueredRegionIds: readonly string[],
): boolean {
  if (
    regionId === 'reg_cidadela_origem' ||
    regionId === 'reg_ponte_leste' ||
    regionId === 'r01_ponte_aurora'
  ) {
    return true
  }
  if (conqueredRegionIds.includes(regionId)) return true

  const conqueredSet = new Set(conqueredRegionIds)
  for (const cId of conqueredSet) {
    const cSpec = REGIONS[cId]
    if (cSpec && cSpec.neighbors.includes(regionId)) {
      return true
    }
  }

  const target = REGIONS[regionId]
  if (!target) return false
  return target.neighbors.some((nId) => conqueredSet.has(nId))
}

export interface DirectAttackResult {
  success: boolean
  surgicalPrecision: boolean
  troopsCommitted: ArmyCount
  garrison: ArmyCount
  rewardTroops: ArmyCount
  surgicalBonusTroops: ArmyCount
  starsEarned: number
  netReserveDelta: number
}

/**
 * Resolve uma Conquista por Expedição Direta no mapa do Mundo 2:
 * - Vitória se `troopsCommitted > region.garrison`.
 * - Se `troopsCommitted === region.garrison + 1`, concede o selo de **Precisão Cirúrgica**
 *   (+25% de recompensa de tropas e +2 Estrelas de Sabedoria).
 */
export function resolveDirectPrecisionAttack(
  troopsCommitted: ArmyCount,
  region: RegionSpec,
): DirectAttackResult {
  const safeCommitted = clampArmy(troopsCommitted)
  const garrison = clampArmy(region.garrison)

  if (safeCommitted <= garrison) {
    return {
      success: false,
      surgicalPrecision: false,
      troopsCommitted: safeCommitted,
      garrison,
      rewardTroops: 0,
      surgicalBonusTroops: 0,
      starsEarned: 0,
      netReserveDelta: 0,
    }
  }

  const surgicalPrecision = safeCommitted === garrison + 1
  const surgicalBonusTroops = surgicalPrecision
    ? Math.max(5, Math.round(region.rewardTroops * 0.25))
    : 0
  const starsEarned = surgicalPrecision ? 2 : 1
  const survivors = safeCommitted - garrison
  const totalReturned = survivors + region.rewardTroops + surgicalBonusTroops
  const netReserveDelta = totalReturned - safeCommitted

  return {
    success: true,
    surgicalPrecision,
    troopsCommitted: safeCommitted,
    garrison,
    rewardTroops: region.rewardTroops,
    surgicalBonusTroops,
    starsEarned,
    netReserveDelta,
  }
}

export interface UpgradePurchaseResult {
  success: boolean
  cost: ArmyCount
  nextLevels: Record<CitadelBuildingId, number>
  remainingTroops: ArmyCount
}

export function purchaseCitadelUpgrade(
  buildingId: CitadelBuildingId,
  currentLevels: Readonly<Record<CitadelBuildingId, number>>,
  reserveTroops: ArmyCount,
): UpgradePurchaseResult {
  const spec = CITADEL_BUILDINGS[buildingId]
  const currentLevel = currentLevels[buildingId] ?? 0
  const cost = getUpgradeCost(buildingId, currentLevel)

  if (
    currentLevel >= spec.maxLevel ||
    !Number.isFinite(cost) ||
    reserveTroops < cost
  ) {
    return {
      success: false,
      cost: Number.isFinite(cost) ? cost : 0,
      nextLevels: { ...currentLevels },
      remainingTroops: reserveTroops,
    }
  }

  const nextLevels: Record<CitadelBuildingId, number> = {
    ...currentLevels,
    [buildingId]: currentLevel + 1,
  }

  return {
    success: true,
    cost,
    nextLevels,
    remainingTroops: clampArmy(reserveTroops - cost),
  }
}

export function convertRemainderVaultToTroops(
  remainderVault: number,
  minaRestoLevel: number,
): { recruitedTroops: ArmyCount; remainingVault: number; ratioUsed: number } {
  const safeVault = Math.max(0, Math.floor(remainderVault))
  const spec = CITADEL_BUILDINGS.mina_resto
  const clampedLevel = Math.max(0, Math.min(spec.maxLevel, minaRestoLevel))
  const ratioUsed = spec.levelEffects[clampedLevel] ?? 10

  const recruitedTroops = Math.floor(safeVault / ratioUsed)
  const remainingVault = safeVault % ratioUsed

  return {
    recruitedTroops,
    remainingVault,
    ratioUsed,
  }
}

export function calculatePassiveTribute(
  conqueredRegionIds: readonly string[],
): ArmyCount {
  let total = 0
  for (const id of conqueredRegionIds) {
    const reg = REGIONS[id]
    if (reg) {
      total += reg.tributePerRun
    }
  }
  return clampArmy(total)
}

export function getInitialArmyFromQuartel(quartelLevel: number): ArmyCount {
  const spec = CITADEL_BUILDINGS.quartel
  const idx = Math.max(0, Math.min(spec.maxLevel, quartelLevel))
  return spec.levelEffects[idx] ?? 1
}
