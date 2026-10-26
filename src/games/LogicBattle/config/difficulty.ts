// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/config/difficulty.ts — Zona de Desenvolvimento Proximal
// ──────────────────────────────────────────────────────────────────────────────

export const DIFFICULTY_POLICIES = {
  /** Faixa alvo de acerto (Zona de Fluxo de Csikszentmihalyi: 75% a 85%) */
  targetAccuracyMin: 0.75,
  targetAccuracyMax: 0.85,
  /** Acima desta acurácia com >= 3 tentativas, o Detector ⚠ do Observatório desbota sozinho */
  scaffoldingFadeOutMasteryThreshold: 0.8,
  minAttemptsForFadeOut: 3,
  /** Peso exponencial para atualizar a média móvel de maestria */
  rollingAlpha: 0.35,
} as const
