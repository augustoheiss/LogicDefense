// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/RedemptionChallengeModal.tsx — Conta de Resgate
// Com Andaime Vygotskiano em 3 Níveis (errar nunca destrói a ficha!)
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { formatArmy } from '../domain/notation'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const RedemptionChallengeModal: React.FC = () => {
  const activeTokenId = useLogicBattleStore((s) => s.activeRedemptionTokenId)
  const tokensInRun = useLogicBattleStore((s) => s.tokensInRun)
  const diagnostic = useLogicBattleStore((s) => s.lastRedeemDiagnostic)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const submitAnswer = useLogicBattleStore((s) => s.submitRedemptionAnswer)
  const closeModal = useLogicBattleStore((s) => s.closeRedemptionModal)
  const openCodexForSlug = useLogicBattleStore((s) => s.openCodexForSlug)

  const token = tokensInRun.find((t) => t.id === activeTokenId)
  if (!token) return null

  const { challenge, scaffoldLevel } = token

  return (
    <div
      className="lb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lb-redemption-title"
      data-testid="lb-redemption-modal"
    >
      <div className="lb-modal-card lb-redemption-card">
        <div className="lb-modal-badge-row">
          <span className="lb-badge-token">
            ★ CONTA DE RESGATE · NÍVEL DE APOIO {scaffoldLevel}/3
          </span>
          <span className="lb-badge-reward">
            Reforço: +{formatArmy(token.loss, notationMode)} Soldados (100% da perda)
          </span>
        </div>

        <h3 id="lb-redemption-title" className="lb-modal-title">
          Domando a Pegadinha: {token.trapName}
        </h3>

        <p className="lb-redemption-question" data-testid="lb-redemption-question">
          {challenge.questionPt}
        </p>

        {/* Andaime Nível 1: Luz-Guia Socrática */}
        <div className="lb-scaffold-panel lb-scaffold-1" data-testid="lb-scaffold-level-1">
          <strong>💡 Luz-Guia (Nível 1):</strong>
          <p>{challenge.luzGuiaPt}</p>
        </div>

        {/* Andaime Nível 2: Decomposição Passo a Passo */}
        {scaffoldLevel >= 2 && (
          <div className="lb-scaffold-panel lb-scaffold-2" data-testid="lb-scaffold-level-2">
            <strong>🧭 Decomposição Visual (Nível 2):</strong>
            <p>{challenge.stepByStepPt}</p>
          </div>
        )}

        {/* Andaime Nível 3: Resolução Guiada Completa */}
        {scaffoldLevel >= 3 && (
          <div className="lb-scaffold-panel lb-scaffold-3" data-testid="lb-scaffold-level-3">
            <strong>🔓 Resolução Guiada (Nível 3 — Zero Punição):</strong>
            <p style={{ whiteSpace: 'pre-line' }}>{challenge.guidedWalkthroughPt}</p>
          </div>
        )}

        {diagnostic && (
          <div className="lb-diagnostic-banner" data-testid="lb-redemption-diagnostic">
            {diagnostic}
          </div>
        )}

        <div className="lb-choices-grid" data-testid="lb-redemption-choices">
          {challenge.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`lb-redemption-choice-${c.id}`}
              className="lb-choice-btn"
              onClick={() => submitAnswer(c.id)}
            >
              <span className="lb-choice-label">{c.label}</span>
            </button>
          ))}
        </div>

        <div className="lb-modal-footer">
          <button
            type="button"
            className="lb-btn-ghost"
            onClick={() => openCodexForSlug(challenge.codexSlug)}
          >
            📖 Abrir Apostila no Códice
          </button>
          <button
            type="button"
            data-testid="lb-redemption-close-btn"
            className="lb-btn-secondary"
            onClick={closeModal}
          >
            Guardar Ficha para Depois
          </button>
        </div>
      </div>
    </div>
  )
}
