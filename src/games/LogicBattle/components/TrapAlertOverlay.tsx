// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/TrapAlertOverlay.tsx — Pílula Diegética (+1 Ficha Bônus)
// §2.1 R1 & engine_G_ponte_tiro_continuo_sem_pausa.jpg: Zero texto longo durante a corrida!
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
      className="lb-trap-toast-floating"
      role="status"
      aria-live="polite"
      aria-label="Ficha Bônus Coletada"
      data-testid="lb-trap-alert-overlay"
    >
      <div className="lb-trap-compact-card lb-trap-compact-card--diegetic-pill">
        <div className="lb-ghost-rewind-banner" data-testid="lb-ghost-rewind-banner">
          <span className="lb-diegetic-pill__token">+1 Ficha Bônus 🪙</span>
          <strong className="lb-diegetic-pill__loss">
            −{formatArmy(hit.loss, notationMode)} 🛡️
          </strong>
        </div>

        <div className="lb-trap-compact-card__actions">
          <button
            type="button"
            data-testid="lb-trap-redeem-now-btn"
            className="lb-diegetic-mini-btn lb-diegetic-mini-btn--gold"
            onClick={openImmediateRedemption}
            title="Usar Ficha Bônus (+50% pts)"
          >
            🎟️ +{formatArmy(hit.loss, notationMode)}
          </button>

          <button
            type="button"
            data-testid="lb-trap-open-codex-btn"
            className="lb-diegetic-mini-btn"
            onClick={() => openCodexForSlug(hit.codexSlug)}
            title="Ver no Códice"
          >
            📖
          </button>

          <button
            type="button"
            data-testid="lb-trap-continue-bridge-btn"
            className="lb-diegetic-mini-btn"
            onClick={dismissTrapAlert}
            title="Continuar sem pausa"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
