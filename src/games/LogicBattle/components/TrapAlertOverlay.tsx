// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/TrapAlertOverlay.tsx — Alerta Compacto de Pegadinha
// ──────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { formatArmy } from '../domain/notation'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const TrapAlertOverlay: React.FC = () => {
  const hit = useLogicBattleStore((s) => s.activeTrapHit)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const openImmediateRedemption = useLogicBattleStore(
    (s) => s.openImmediateRedemptionFromTrap,
  )
  const dismissTrapAlert = useLogicBattleStore(
    (s) => s.dismissTrapAlertAndContinue,
  )
  const openCodexForSlug = useLogicBattleStore((s) => s.openCodexForSlug)
  const [showTip, setShowTip] = useState(false)

  if (!hit) return null

  return (
    <div
      className="lb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lb-trap-alert-title"
      data-testid="lb-trap-alert-overlay"
    >
      <div className="lb-trap-compact-card">
        <div className="lb-trap-compact-card__header">
          <span className="lb-badge-opa">⚠ Opa, cuidado para não ser enganado!</span>
          <button
            type="button"
            className="lb-result-card__info-btn"
            onClick={() => setShowTip((v) => !v)}
            title="Ver dica socrática"
          >
            💡
          </button>
        </div>

        <h3 id="lb-trap-alert-title" className="lb-trap-compact-card__title">
          {hit.trapName}
        </h3>

        <div className="lb-ghost-rewind-banner" data-testid="lb-ghost-rewind-banner">
          <span>
            {formatArmy(hit.chosenResult, notationMode)} vs{' '}
            {formatArmy(hit.counterfactualResult, notationMode)}
          </span>
          <strong>
            −{formatArmy(hit.loss, notationMode)} 🛡️ → 🎟️ +1 Ficha
          </strong>
        </div>

        {showTip && (
          <p className="lb-trap-compact-card__tip">{hit.luzGuiaPt}</p>
        )}

        <div className="lb-trap-compact-card__actions">
          <button
            type="button"
            data-testid="lb-trap-redeem-now-btn"
            className="lb-btn-3d lb-btn-3d--gold"
            onClick={openImmediateRedemption}
          >
            🎟️ Resgatar +{formatArmy(hit.loss, notationMode)}
          </button>

          <button
            type="button"
            data-testid="lb-trap-continue-bridge-btn"
            className="lb-btn-3d lb-btn-3d--blue"
            onClick={dismissTrapAlert}
          >
            ▶ Seguir
          </button>

          <button
            type="button"
            data-testid="lb-trap-open-codex-btn"
            className="lb-btn-3d lb-btn-3d--slate"
            onClick={() => openCodexForSlug(hit.codexSlug)}
            title="Ver no Códice"
          >
            📖
          </button>
        </div>
      </div>
    </div>
  )
}
