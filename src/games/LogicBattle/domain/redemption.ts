// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/domain/redemption.ts — Ficha de Resgate & Andaime (§3.2 C4)
// ──────────────────────────────────────────────────────────────────────────────
import { GATE_POLICIES } from '../config/gatePolicies'
import { TRAP_CATALOG } from '../config/trapCatalog'
import {
  ArmyCount,
  RedemptionContractOffer,
  RedemptionToken,
  TrapHit,
} from '../types'

/**
 * Emite uma Ficha de Resgate (`RedemptionToken`) contendo uma Conta de Resgate
 * isomórfica (mesmo conceito da pegadinha, números diferentes).
 */
export function issueToken(
  hit: TrapHit,
  runId: string,
  randFloat: () => number = () => 0.5,
): RedemptionToken {
  const entry = TRAP_CATALOG[hit.trapId]
  const built = entry.buildRedemption(randFloat)
  const tokenId = `tok_${runId}_${hit.segmentId}_${hit.trapId}`

  return {
    id: tokenId,
    runId,
    trapId: hit.trapId,
    trapName: entry.name,
    loss: Math.max(1, hit.loss),
    used: false,
    scaffoldLevel: 1,
    challenge: {
      tokenId,
      trapId: hit.trapId,
      trapName: entry.name,
      conceptId: entry.conceptId,
      questionPt: built.questionPt,
      luzGuiaPt: entry.luzGuiaPt,
      stepByStepPt: built.stepByStepPt,
      guidedWalkthroughPt: built.guidedWalkthroughPt,
      choices: built.choices,
      codexSlug: entry.codexSlug,
    },
  }
}

export interface RedeemResult {
  success: boolean
  grant: ArmyCount
  nextToken: RedemptionToken
  diagnosticPt: string
}

/**
 * Resolve uma tentativa de resposta na Conta de Resgate:
 * - Acertou: `success = true`, `grant = token.loss` (+100% da perda), `used = true`.
 * - Errou: `success = false`, `grant = 0`, `used = false` (JAMAIS perde a ficha!),
 *   e o nível de andaime sobe (`1 -> 2 -> 3`) revelando dica passo a passo.
 */
export function redeem(token: RedemptionToken, chosenChoiceId: string): RedeemResult {
  if (token.used) {
    return {
      success: false,
      grant: 0,
      nextToken: token,
      diagnosticPt: 'Esta Ficha de Resgate já foi resgatada nesta corrida.',
    }
  }

  const choice = token.challenge.choices.find((c) => c.id === chosenChoiceId)
  if (!choice) {
    return {
      success: false,
      grant: 0,
      nextToken: token,
      diagnosticPt: 'Selecione uma das alternativas para conferir o raciocínio.',
    }
  }

  if (choice.isCorrect) {
    const nextToken: RedemptionToken = {
      ...token,
      used: true,
    }
    return {
      success: true,
      grant: token.loss,
      nextToken,
      diagnosticPt: choice.diagnosticPt,
    }
  }

  const nextScaffold: 1 | 2 | 3 =
    token.scaffoldLevel === 1 ? 2 : 3

  const nextToken: RedemptionToken = {
    ...token,
    used: false,
    scaffoldLevel: nextScaffold,
  }

  return {
    success: false,
    grant: 0,
    nextToken,
    diagnosticPt: choice.diagnosticPt,
  }
}

/**
 * Regra do Contrato de Resgate Honesto (§2.1 R2):
 * O Contrato de Resgate na Batalha Final SÓ é oferecido como garantia de vitória se as fichas
 * não resgatadas somarem tropas suficientes para cobrir o déficit + 5% de margem de segurança.
 */
export function evaluateRedemptionContract(
  playerArmy: ArmyCount,
  enemyForce: ArmyCount,
  tokens: readonly RedemptionToken[],
): RedemptionContractOffer {
  const unredeemed = tokens.filter((t) => !t.used)
  const totalRecoverableLoss = unredeemed.reduce((acc, t) => acc + t.loss, 0)
  const safetyMargin = Math.max(
    1,
    Math.ceil(enemyForce * GATE_POLICIES.redemptionContractMarginRatio),
  )
  const targetArmyForVictory = enemyForce + safetyMargin
  const deficit = Math.max(0, enemyForce + 1 - playerArmy)

  const canGuaranteeVictory =
    unredeemed.length > 0 && playerArmy + totalRecoverableLoss >= targetArmyForVictory

  const grantOnSuccess = canGuaranteeVictory
    ? Math.max(totalRecoverableLoss, targetArmyForVictory - playerArmy)
    : totalRecoverableLoss

  return {
    canGuaranteeVictory,
    deficit,
    totalRecoverableLoss,
    safetyMargin,
    grantOnSuccess,
    tokensToRedeem: unredeemed,
  }
}
