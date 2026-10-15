import type { ActiveBuffModifiers, BuffType, MathOp } from '../types/game'

export const BUFF_MODIFIERS: Record<BuffType, ActiveBuffModifiers> = {
  amor: {
    buff: 'amor',
    mathTimeSeconds: 30,
    wrongPenaltyMultiplier: 1.0,      // "O pai paga essa" — protege o multiplicador em 1.0x!
    correctBaseMultiplier: 1.5,
    fastAnswerBonusMultiplier: 1.65,  // Bônus suave por rapidez
    towerDamageMultiplier: 1.0,
    towerRangeMultiplier: 1.0,
    upgradeCostDiscount: 0,
    heroMagnetMultiplier: 1.4,        // +40% raio magnético do Herói
    heroCoinBonusMultiplier: 1.25,    // +25% valor de moedas coletadas pelo Herói
    bankInterestRate: 0,
    harmonyLinkSpeedBoost: 0.25,      // +25% velocidade de ataque para torres próximas ao Herói
    centerSlowRadius: 0,
    centerSlowFactor: 1,
    showPreHint: true,                // Revela pista mental antes de responder
    optionCount: 3,
  },
  odio: {
    buff: 'odio',
    mathTimeSeconds: 20,              // 20s no relógio — pressão máxima!
    wrongPenaltyMultiplier: 0.4,      // Penalidade severa se falhar
    correctBaseMultiplier: 1.8,       // Recompensa base superior (1.8x)
    fastAnswerBonusMultiplier: 2.2,   // OVERCLOCK CRÍTICO (2.2x) se responder em < 8s!
    towerDamageMultiplier: 1.3,       // +30% de dano global em todas as torres e heróis
    towerRangeMultiplier: 1.0,
    upgradeCostDiscount: 0,
    heroMagnetMultiplier: 1.0,
    heroCoinBonusMultiplier: 1.15,
    bankInterestRate: 0,
    harmonyLinkSpeedBoost: 0,
    centerSlowRadius: 0,
    centerSlowFactor: 1,
    showPreHint: false,
    optionCount: 3,
  },
  cadeira: {
    buff: 'cadeira',
    mathTimeSeconds: 30,
    wrongPenaltyMultiplier: 0.5,
    correctBaseMultiplier: 1.6,       // Recompensa elevada por vencer 4 opções
    fastAnswerBonusMultiplier: 1.75,
    towerDamageMultiplier: 1.05,
    towerRangeMultiplier: 1.25,      // +25% de alcance em todas as torres (Geometria Soberana)
    upgradeCostDiscount: 0.20,        // -20% no custo de todos os upgrades!
    heroMagnetMultiplier: 1.1,
    heroCoinBonusMultiplier: 1.15,
    bankInterestRate: 0.15,           // +15% de Dividendos sobre o ouro guardado no banco
    harmonyLinkSpeedBoost: 0,
    centerSlowRadius: 165,            // Trono Gravitacional no centro (400, 300)
    centerSlowFactor: 0.82,           // -18% velocidade nos inimigos no centro
    showPreHint: false,
    optionCount: 4,                   // 4 opções no Trono da Lógica
  },
}

export function getBuffModifiers(buff: BuffType): ActiveBuffModifiers {
  return BUFF_MODIFIERS[buff]
}

export interface MathResolutionOutcome {
  newMultiplier: number
  earnedGold: number
  interestGold: number
  livesHealed: number
  isOverclockCrit: boolean
  isAmorShielded: boolean
  feedbackText: string
  feedbackColor: string
  activeResonance: MathOp | null
}

export function resolveBuffedMathOutcome(params: {
  buff: BuffType
  isCorrect: boolean
  isTimeout: boolean
  elapsedSeconds: number
  currentGold: number
  newStreak: number
  problemOp: MathOp
}): MathResolutionOutcome {
  const { buff, isCorrect, isTimeout, elapsedSeconds, currentGold, newStreak, problemOp } = params
  const mods = BUFF_MODIFIERS[buff]

  if (!isCorrect || isTimeout) {
    const newMultiplier = mods.wrongPenaltyMultiplier
    const earnedGold = Math.floor(3 * newMultiplier * 10)
    const isAmorShielded = buff === 'amor'

    if (isTimeout) {
      return {
        newMultiplier,
        earnedGold,
        interestGold: 0,
        livesHealed: 0,
        isOverclockCrit: false,
        isAmorShielded,
        feedbackText: isAmorShielded
          ? 'TEMPO ESGOTADO! ❤️ AMOR SEGUROU (1.0x)'
          : `TEMPO ESGOTADO! (${newMultiplier.toFixed(1)}x)`,
        feedbackColor: isAmorShielded ? '#00ff88' : '#ff4444',
        activeResonance: null,
      }
    }

    return {
      newMultiplier,
      earnedGold,
      interestGold: 0,
      livesHealed: 0,
      isOverclockCrit: false,
      isAmorShielded,
      feedbackText: isAmorShielded
        ? 'O PAI PAGA ESSA! ❤️ ESCUDO (1.0x)'
        : `FALHA LÓGICA! (${newMultiplier.toFixed(1)}x)`,
      feedbackColor: isAmorShielded ? '#00ff88' : '#888888',
      activeResonance: null,
    }
  }

  // ── Correct Answer! ──
  const isFast = elapsedSeconds <= 8
  const isOverclockCrit = buff === 'odio' && isFast
  const newMultiplier = isFast ? mods.fastAnswerBonusMultiplier : mods.correctBaseMultiplier
  const earnedGold = Math.floor(3 * newMultiplier * 10)

  // Dividendos da Cadeira (+15% sobre o ouro atual no banco, até $150)
  const interestGold =
    mods.bankInterestRate > 0
      ? Math.min(150, Math.floor(currentGold * mods.bankInterestRate))
      : 0

  // Regeneração do Amor (+2 vidas a cada 3 acertos seguidos)
  const livesHealed = buff === 'amor' && newStreak > 0 && newStreak % 3 === 0 ? 2 : 0

  let feedbackText = `LÓGICA CORRETA! (${newMultiplier.toFixed(1)}x)`
  let feedbackColor = '#00ff00'

  if (isOverclockCrit) {
    feedbackText = `🔥 OVERCLOCK CRÍTICO! (2.2x) +$${earnedGold}`
    feedbackColor = '#ff5500'
  } else if (interestGold > 0) {
    feedbackText = `🪑 DIVIDENDOS DO TRONO! +$${interestGold} JUROS (${newMultiplier.toFixed(1)}x)`
    feedbackColor = '#00d4ff'
  } else if (livesHealed > 0) {
    feedbackText = `❤️ COMBO DO AMOR! +${livesHealed} VIDAS (${newMultiplier.toFixed(1)}x)`
    feedbackColor = '#00ff88'
  }

  return {
    newMultiplier,
    earnedGold,
    interestGold,
    livesHealed,
    isOverclockCrit,
    isAmorShielded: false,
    feedbackText,
    feedbackColor,
    activeResonance: problemOp,
  }
}
