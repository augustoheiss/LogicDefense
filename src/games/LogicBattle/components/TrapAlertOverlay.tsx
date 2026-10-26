// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/TrapAlertOverlay.tsx — Alerta Socrático "Opa! Pegadinha!"
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
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

  if (!hit) return null

  return (
    <div
      className="lb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lb-trap-alert-title"
      data-testid="lb-trap-alert-overlay"
    >
      <div className="lb-modal-card lb-trap-card">
        <div className="lb-modal-badge-row">
          <span className="lb-badge-opa">⚡ OPA! PEGADINHA MATEMÁTICA ({hit.trapId})</span>
          <span className="lb-badge-token">★ +1 Ficha de Resgate Emitida</span>
        </div>

        <h3 id="lb-trap-alert-title" className="lb-modal-title">
          {hit.trapName}
        </h3>

        <p className="lb-trap-intuition">{hit.intuitionTrapPt}</p>

        {/* Comparação Contrafactual Clara + Rebobinar Fantasma */}
        <div className="lb-counterfactual-grid">
          <div className="lb-cf-box lb-cf-chosen">
            <span className="lb-cf-label">Sua Escolha Intuitiva (Faixa {hit.chosenLane + 1})</span>
            <strong className="lb-cf-val">
              {formatArmy(hit.armyBefore, notationMode)} →{' '}
              {formatArmy(hit.chosenResult, notationMode)}
            </strong>
          </div>
          <div className="lb-cf-box lb-cf-better">
            <span className="lb-cf-label">Caminho Ideal (Faixa {hit.betterLane + 1})</span>
            <strong className="lb-cf-val">
              {formatArmy(hit.armyBefore, notationMode)} →{' '}
              {formatArmy(hit.counterfactualResult, notationMode)}
            </strong>
          </div>
        </div>

        <div className="lb-ghost-rewind-banner" data-testid="lb-ghost-rewind-banner">
          <span>⏪ Rebobinar Fantasma (Delta Contrafactual):</span>
          <strong>
            Diferença de −{formatArmy(hit.loss, notationMode)} soldados (
            {Math.max(1, Math.round(hit.lossRatio * 100))}% recuperáveis na Ficha de Resgate!)
          </strong>
        </div>

        <div className="lb-luz-guia-box">
          <strong>💡 Luz-Guia Socrática:</strong>
          <p>{hit.luzGuiaPt}</p>
        </div>

        <div className="lb-modal-actions">
          <button
            type="button"
            data-testid="lb-trap-redeem-now-btn"
            className="lb-btn-primary lb-btn-gold"
            onClick={openImmediateRedemption}
          >
            ★ Resolver Conta de Resgate Agora (+{formatArmy(hit.loss, notationMode)} soldados)
          </button>

          <button
            type="button"
            data-testid="lb-trap-continue-bridge-btn"
            className="lb-btn-secondary"
            onClick={dismissTrapAlert}
          >
            Seguir Marcha (Portão Dourado aparecerá na Pista)
          </button>

          <button
            type="button"
            data-testid="lb-trap-open-codex-btn"
            className="lb-btn-ghost"
            onClick={() => openCodexForSlug(hit.codexSlug)}
          >
            📚 Ver Truque no Códice Heiss-Lab
          </button>
        </div>
      </div>
    </div>
  )
}
