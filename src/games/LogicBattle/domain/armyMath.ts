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
      const rawPct = Number.isFinite(operand.value) ? operand.value : num / den
      const pct = Math.max(0, rawPct)
      rawNext = Math.floor((safeN * (100 + pct) + 1e-9) / 100)
      break
    }
    case '%−': {
      // Desconto percentual: safeN * (100 - pct) / 100
      const rawPct = Number.isFinite(operand.value) ? operand.value : num / den
      const pct = Math.min(100, Math.max(0, rawPct))
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

/**
 * V10 (Pilar 1 — QAR1-V10-AUTHENTIC-DEBUFFS):
 * Avalia matematicamente se um portão individual aumenta (`true` -> Azul)
 * ou reduz (`false` -> Vermelho) o exército, sem depender de heurística textual de string.
 * Ex.: `÷ 1/2`, `÷ 0,5`, `− (−15)`, `× 3/2`, `+ 50%` => `true` (Azul).
 * Ex.: `× 1/2`, `× 0,8`, `× 10⁻¹`, `^ 0`, `√N`, `− 20%`, `− 8`, `÷ 2` => `false` (Vermelho).
 */
export function isGateBeneficial(gate: Gate, refArmy = 100): boolean {
  const probe = Math.max(100, clampArmy(refArmy))
  const after = applyGate(probe, gate)
  return after > probe
}

/**
 * Avalia se uma faixa completa de portões (1 ou 2 passos encadeados) é benéfica (`true`)
 * ou redutora/debuff (`false`) sobre um exército de referência.
 */
export function isLaneBeneficial(gates: readonly Gate[], refArmy = 100): boolean {
  if (!gates || gates.length === 0) return true
  const probe = Math.max(100, clampArmy(refArmy))
  const after = applyGateChain(probe, gates)
  return after >= probe
}

export interface AuthenticCenterGatePassParams {
  armyBefore: ArmyCount
  chosenGates: readonly Gate[]
  effectiveEvalBase: ArmyCount
  useOrthogonalMonsterBase: boolean
  wasOptimal: boolean
  isTrapFall?: boolean
  enemyBaseLevel?: number
}

/**
 * V10 (Pilar 1 — QAR1-V10-AUTHENTIC-DEBUFFS):
 * Aplica a passagem pelos portões da Rota Central garantindo que:
 * 1. Portões benéficos preservem a Escala Ortogonal V9 (sem explodir exponencialmente o exército da Rota Direita).
 * 2. Todo portão negativo/redutor (`isLaneBeneficial === false`) ou queda em pegadinha (`isTrapFall === true`)
 *    reduza DE VERDADE o exército atual (`nextArmy < armyBefore`), aplicando reduções proporcionais (`− 20%`,
 *    `× 1/2`, `× 0,8`, `÷ 2`, `^ 0`) diretamente sobre `armyBefore` e escalando subtrações quando o exército
 *    estiver inflado.
 */
export function applyAuthenticCenterGatePass(
  params: AuthenticCenterGatePassParams,
): GateApplicationResult {
  const {
    armyBefore,
    chosenGates,
    effectiveEvalBase,
    useOrthogonalMonsterBase,
    isTrapFall = false,
    enemyBaseLevel = 1,
  } = params

  const safeBefore = Math.max(1, clampArmy(armyBefore))
  const evalApp = applyGateChainWithRemainder(effectiveEvalBase, chosenGates)
  const laneBeneficial = isLaneBeneficial(chosenGates, effectiveEvalBase)

  if (!laneBeneficial || isTrapFall) {
    const directApp = applyGateChainWithRemainder(safeBefore, chosenGates)
    const isSingleAdditiveSub =
      chosenGates.length === 1 &&
      chosenGates[0].op === '−' &&
      chosenGates[0].operand.num > 0

    if (directApp.nextArmy < safeBefore) {
      if (isSingleAdditiveSub && useOrthogonalMonsterBase && safeBefore > effectiveEvalBase * 1.35) {
        const evalLossRatio = Math.max(
          0.12,
          Math.min(0.45, (effectiveEvalBase - evalApp.nextArmy) / Math.max(1, effectiveEvalBase)),
        )
        const levelMult = 1 + Math.max(0, enemyBaseLevel - 1) * 0.04
        const scaledDrop = Math.max(
          safeBefore - directApp.nextArmy,
          Math.round(safeBefore * evalLossRatio * levelMult),
        )
        return {
          nextArmy: Math.max(1, clampArmy(safeBefore - scaledDrop)),
          remainder: directApp.remainder,
        }
      }
      // Garantir que em exércitos >= 200 (ex: 1,5k) qualquer portão de debuff sempre reduza ao menos 12%
      // para que a queda seja imediatamente visível no HUD compactado (1,5k -> <= 1,3k)
      if (safeBefore >= 200) {
        const minVisibleDrop = Math.max(
          safeBefore - directApp.nextArmy,
          Math.round(safeBefore * 0.12),
        )
        return {
          nextArmy: Math.max(1, clampArmy(safeBefore - minVisibleDrop)),
          remainder: directApp.remainder,
        }
      }
      return {
        nextArmy: Math.max(1, clampArmy(directApp.nextArmy)),
        remainder: directApp.remainder,
      }
    }

    // Caso de pegadinha onde a faixa ruim tinha ganho positivo menor na base de referência:
    // aplica penalidade real de debuff para que o portão vermelho/pegadinha sempre reduza soldados.
    const fallbackPenalty = Math.max(1, Math.round(safeBefore * 0.15))
    return {
      nextArmy: Math.max(1, clampArmy(safeBefore - fallbackPenalty)),
      remainder: directApp.remainder,
    }
  }

  // Faixa benéfica (Azul): preserva escala ortogonal para buffs e garante ganho positivo real (>= +2) mesmo com exército pequeno!
  const probeBase = Math.max(10, effectiveEvalBase)
  const probeApp = applyGateChainWithRemainder(probeBase, chosenGates)
  const minPositiveGain = Math.max(
    2,
    Math.round(Math.max(1, probeApp.nextArmy - probeBase) * Math.min(1, safeBefore / probeBase)),
  )
  const rawNext = useOrthogonalMonsterBase
    ? clampArmy(safeBefore + Math.max(2, evalApp.nextArmy - effectiveEvalBase))
    : clampArmy(Math.max(safeBefore + minPositiveGain, evalApp.nextArmy))

  return {
    nextArmy: Math.max(safeBefore + 2, rawNext),
    remainder: evalApp.remainder,
  }
}

