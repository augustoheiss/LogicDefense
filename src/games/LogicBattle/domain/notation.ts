// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/notation.ts — Formatação pt-BR & Decomposição Posicional
// ──────────────────────────────────────────────────────────────────────────────
import { MAX_CROWD_SPRITES, RENDER_1TO1_MAX, UNIT_TIERS } from '../config/unitTiers'
import { ArmyCount, DecomposedTier, NotationMode, UnitTierSpec } from '../types'
import { clampArmy } from './armyMath'

export type { NotationMode }

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
}

export function toSuperscript(exp: number): string {
  return String(exp)
    .split('')
    .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
    .join('')
}

export function formatExponentialPtBr(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return '0'
  let exp = Math.floor(Math.log10(val))
  let mantissa = val / Math.pow(10, exp)
  if (!Number.isFinite(mantissa) || mantissa <= 0) {
    const parts = val.toExponential(4).split('e')
    mantissa = Number(parts[0])
    exp = Number(parts[1])
  }
  if (mantissa >= 10) {
    mantissa /= 10
    exp += 1
  } else if (mantissa < 1 && mantissa > 0) {
    mantissa *= 10
    exp -= 1
  }
  // Duas casas decimais depois da vírgula (ex.: 3,35e+52, 9,00e+15) sem casas infinitas
  const scaled = Math.min(999, Math.max(100, Math.floor(mantissa * 100 + 1e-7)))
  const mantissaFixed = (scaled / 100).toFixed(2).replace('.', ',')
  const sign = exp >= 0 ? '+' : ''
  return `${mantissaFixed}e${sign}${exp}`
}

/**
 * Formata uma quantidade de exército segundo o Contrato C6 (§3.2):
 * - Usa vírgula decimal `pt-BR` (`1,2k`, `3,4 × 10⁴`).
 * - Jamais arredonda para cima mudando de ordem de grandeza (`999 -> '999'`, `1999 -> '1,99k'`).
 * - Quando atinge ou ultrapassa 9000T (>= 9e15), exibe com 2 casas decimais após a vírgula + e+XX (ex.: 9,00e+15, 3,35e+52).
 */
export function formatArmy(n: ArmyCount, mode: NotationMode = 'compact'): string {
  const safe = clampArmy(n)
  if (safe === 0) return '0'

  // Acima de 9000T (>= 9e15): usa formato exponencial limpo com 2 casas decimais e vírgula (ex.: 9,00e+15, 3,35e+52)
  if (safe >= 9_000_000_000_000_000) {
    return formatExponentialPtBr(safe)
  }

  if (mode === 'scientific') {
    if (safe < 10) return String(safe)
    const exp = Math.floor(Math.log10(safe))
    const basePow = Math.pow(10, exp)
    // Truncar com 2 casas decimais sem arredondar para cima
    const mantissaScaled = Math.floor((safe / basePow) * 100 + 1e-7)
    const intPart = Math.floor(mantissaScaled / 100)
    const fracPart = mantissaScaled % 100
    let mantissaStr = String(intPart)
    if (fracPart > 0) {
      const fracDigits = String(fracPart).padStart(2, '0').replace(/0+$/, '')
      mantissaStr = `${intPart},${fracDigits}`
    }
    return `${mantissaStr} × 10${toSuperscript(exp)}`
  }

  // Modo compacto: '999', '1k', '1,99k', '12,5M', '3,4B', '1,2T'
  if (safe < 1_000) {
    return String(Math.floor(safe))
  }

  const units: { threshold: number; suffix: string }[] = [
    { threshold: 1_000_000_000_000, suffix: 'T' },
    { threshold: 1_000_000_000, suffix: 'B' },
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'k' },
  ]

  for (const { threshold, suffix } of units) {
    if (safe >= threshold) {
      // Truncamento explícito em 2 casas decimais para nunca saltar ordem de grandeza
      const scaled = Math.floor((safe / threshold) * 100 + 1e-7)
      const intPart = Math.floor(scaled / 100)
      const fracPart = scaled % 100
      if (fracPart === 0) {
        return `${intPart}${suffix}`
      }
      const fracDigits = String(fracPart).padStart(2, '0').replace(/0+$/, '')
      return `${intPart},${fracDigits}${suffix}`
    }
  }

  return String(Math.floor(safe))
}

/**
 * Decompõe o exército `n` em Pelotões Posicionais (`UNIT_TIERS`) respeitando o orçamento de sprites.
 * Quando `n <= RENDER_1TO1_MAX` (120), mantém soldados 1:1 para sensação tátil de horda.
 * Acima de 120, realiza a decomposição posicional na base 10.
 */
export function decomposeTiers(
  n: ArmyCount,
  maxSprites: number = MAX_CROWD_SPRITES,
): DecomposedTier[] {
  const safe = clampArmy(n)
  if (safe <= 0) return []

  if (safe <= Math.min(RENDER_1TO1_MAX, maxSprites)) {
    return [{ tier: UNIT_TIERS[0], count: safe }]
  }

  let remaining = safe
  let spriteBudget = maxSprites
  const result: DecomposedTier[] = []

  for (let i = UNIT_TIERS.length - 1; i >= 0; i--) {
    const tier = UNIT_TIERS[i]
    if (remaining >= tier.value && spriteBudget > 0) {
      const rawCount = Math.floor(remaining / tier.value)
      const count = Math.min(rawCount, spriteBudget)
      if (count > 0) {
        result.push({ tier, count })
        remaining -= count * tier.value
        spriteBudget -= count
      }
    }
  }

  return result
}

/**
 * Detecta se o exército cruzou para cima um limiar posicional de Fusão "Vai-Um"
 * (ex.: passou de < 10 para >= 10, ou de < 100 para >= 100, etc.).
 */
export function detectVaiUmMerge(
  prevArmy: ArmyCount,
  nextArmy: ArmyCount,
): { fromTier: UnitTierSpec; toTier: UnitTierSpec; formulaLabel: string } | null {
  if (nextArmy <= prevArmy) return null

  for (let i = UNIT_TIERS.length - 1; i >= 1; i--) {
    const toTier = UNIT_TIERS[i]
    const fromTier = UNIT_TIERS[i - 1]
    if (prevArmy < toTier.value && nextArmy >= toTier.value) {
      const ratio = Math.round(toTier.value / fromTier.value)
      return {
        fromTier,
        toTier,
        formulaLabel: `${ratio} × ${fromTier.denominationLabel} = ${toTier.denominationLabel}`,
      }
    }
  }

  return null
}

/**
 * Detecta se o exército cruzou para baixo um limiar posicional ("Empresta-Um" da subtração)
 * durante a batalha (ex.: caiu de >= 1.000 para < 1.000, desfazendo 1×[1k] em 10×[0,1k]).
 */
export function detectEmprestaUmSplit(
  prevArmy: ArmyCount,
  nextArmy: ArmyCount,
): { fromTier: UnitTierSpec; toTier: UnitTierSpec; formulaLabel: string } | null {
  if (nextArmy >= prevArmy || nextArmy <= 0) return null

  for (let i = UNIT_TIERS.length - 1; i >= 1; i--) {
    const highTier = UNIT_TIERS[i]
    const lowTier = UNIT_TIERS[i - 1]
    if (prevArmy >= highTier.value && nextArmy < highTier.value) {
      const ratio = Math.round(highTier.value / lowTier.value)
      return {
        fromTier: highTier,
        toTier: lowTier,
        formulaLabel: `1 × ${highTier.denominationLabel} → ${ratio} × ${lowTier.denominationLabel}`,
      }
    }
  }

  return null
}
