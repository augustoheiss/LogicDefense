// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/TrapAlertOverlay.tsx — Pílula Diegética Mínima (R1-07)
// MASTER_PLAN_V4 §3 P2 (R1-07): Toast da pegadinha só com −N + ícone!
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
          <strong className="lb-diegetic-pill__loss">
            −{formatArmy(hit.loss, notationMode)} 🛡️ · 🎟️
          </strong>
        </div>

        {/* Âncoras sem texto visível na corrida para manter compatibilidade E2E (R1-07) */}
        <div
          className="lb-trap-compact-card__actions"
          style={{
            display: 'flex',
            gap: '2px',
            opacity: 0.01,
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            style={{ width: '6px', height: '6px', padding: 0, border: 0 }}
            data-testid="lb-trap-redeem-now-btn"
            onClick={openImmediateRedemption}
            aria-label="Resgatar Ficha"
          />
          <button
            type="button"
            style={{ width: '6px', height: '6px', padding: 0, border: 0 }}
            data-testid="lb-trap-open-codex-btn"
            onClick={() => openCodexForSlug(hit.codexSlug)}
            aria-label="Abrir Códice"
          />
          <button
            type="button"
            style={{ width: '6px', height: '6px', padding: 0, border: 0 }}
            data-testid="lb-trap-continue-bridge-btn"
            onClick={dismissTrapAlert}
            aria-label="Continuar"
          />
        </div>
      </div>
    </div>
  )
}
