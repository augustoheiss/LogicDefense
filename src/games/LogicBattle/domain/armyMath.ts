// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/armyMath.ts — Aritmética Exata de Portões (§3.2 C1)
// ──────────────────────────────────────────────────────────────────────────────
import { ARMY_CAP } from '../config/unitTiers'
import { ArmyCount, Gate } from '../types'

export function clampArmy(value: number): ArmyCount {
  if (Number.isNaN(value) || value <= 0) {
    return 0
  }
  if (value >= ARMY_CAP || value === Number.POSITIVE_INFINITY) {
    return ARMY_CAP
  }
  if (value > 9_000_000_000_000_000) {
    return value
  }
  const floored = Math.floor(value + 1e-9)
  return Math.max(0, Math.min(ARMY_CAP, floored))
}

export interface GateApplicationResult {
  nextArmy: ArmyCount
  remainder: number
}

/**
 * Aplica um único portão sobre o exército `n` com política explícita de arredondamento (`floor`)
 * e rastreamento do resto euclidiano para alimentar a Mina do Resto no Mundo 2.
 *
 * Contratos DbC (§3.2 C1):
 * - Pré: `Number.isFinite(n) && n >= 0 && gate.operand !== undefined`
 * - Pós: `Number.isInteger(result) && result >= 0 && result <= ARMY_CAP`
 */
export function applyGateWithRemainder(n: ArmyCount, gate: Gate): GateApplicationResult {
  const safeN = clampArmy(n)
  const { op, operand } = gate
  const num = operand.num
  const den = operand.den > 0 ? operand.den : 1

  let rawNext = safeN
  let remainder = 0

  switch (op) {
    case '+': {
      rawNext = safeN + Math.floor((num + 1e-9) / den)
      break
    }
    case '−': {
      // Subtrair negativo −(−a) vira soma quando num < 0
      const delta = Math.trunc(num / den)
      rawNext = safeN - delta
      break
    }
    case '×': {
      // Aritmética racional exata: floor((safeN * num) / den)
      const numerator = safeN * num
      if (numerator >= 0) {
        rawNext = Math.floor((numerator + 1e-9) / den)
        remainder = numerator % den
      } else {
        rawNext = 0
      }
      break
    }
    case '÷': {
      // Dividir por fração p/q equivale a multiplicar por q/p: floor((safeN * den) / num)
      if (num <= 0) {
        rawNext = safeN
      } else {
        const dividend = safeN * den
        rawNext = Math.floor((dividend + 1e-9) / num)
        remainder = dividend % num
      }
      break
    }
    case '%+': {
      // Acréscimo percentual: safeN * (100 + pct) / 100
      const pct = Math.max(0, operand.value)
      rawNext = Math.floor((safeN * (100 + pct) + 1e-9) / 100)
      break
    }
    case '%−': {
      // Desconto percentual: safeN * (100 - pct) / 100
      const pct = Math.min(100, Math.max(0, operand.value))
      rawNext = Math.floor((safeN * (100 - pct) + 1e-9) / 100)
      break
    }
    case '^': {
      const exp = Math.round(num / den)
      if (exp <= 0) {
        // Qualquer base não-nula elevada a 0 é 1 (T05: O Buraco Negro do Expoente Zero)
        rawNext = safeN > 0 ? 1 : 0
      } else if (exp === 1) {
        rawNext = safeN
      } else {
        rawNext = Math.pow(safeN, exp)
      }
      break
    }
    case '√': {
      rawNext = Math.floor(Math.sqrt(safeN) + 1e-9)
      const sq = rawNext * rawNext
      remainder = Math.max(0, safeN - sq)
      break
    }
    case 'expr': {
      if (operand.exprKind === 'add_mul') {
        // Ex.: N + a × b -> multiplicação primeiro!
        const a = num
        const b = operand.secondaryValue ?? 1
        rawNext = safeN + a * b
      } else if (operand.exprKind === 'double_neg_mul') {
        // Ex.: × (−1) · (−b) = × (+b)
        const factor = Math.abs(num) * Math.abs(operand.secondaryValue ?? 1)
        rawNext = safeN * factor
      } else if (operand.exprKind === 'sub_neg') {
        // Ex.: N − (−a) = N + a
        rawNext = safeN + Math.abs(num)
      } else {
        rawNext = safeN + Math.round(operand.value)
      }
      break
    }
  }

  return {
    nextArmy: clampArmy(rawNext),
    remainder: Math.max(0, Math.floor(remainder)),
  }
}

export function applyGate(n: ArmyCount, gate: Gate): ArmyCount {
  return applyGateWithRemainder(n, gate).nextArmy
}

export function applyGateChainWithRemainder(
  n: ArmyCount,
  gates: readonly Gate[],
): GateApplicationResult {
  let current = clampArmy(n)
  let totalRemainder = 0
  for (const gate of gates) {
    const step = applyGateWithRemainder(current, gate)
    current = step.nextArmy
    totalRemainder += step.remainder
  }
  return { nextArmy: current, remainder: totalRemainder }
}

export function applyGateChain(n: ArmyCount, gates: readonly Gate[]): ArmyCount {
  return applyGateChainWithRemainder(n, gates).nextArmy
}
