// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/BattleOverlay.tsx — ResultCard Arcade Compacto
// Implementa a Regra do Contrato de Resgate Honesto (§2.1 R2)
// ──────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { REGIONS } from '../config/regions'
import { formatArmy } from '../domain/notation'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const BattleOverlay: React.FC = () => {
  const world = useLogicBattleStore((s) => s.world)
  const phase = useLogicBattleStore((s) => s.snapshot.phase)
  const resolution = useLogicBattleStore((s) => s.battleResolution)
  const contract = useLogicBattleStore((s) => s.redemptionContract)
  const runPlan = useLogicBattleStore((s) => s.runPlan)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const startNewRun = useLogicBattleStore((s) => s.startNewRun)
  const switchWorld = useLogicBattleStore((s) => s.switchWorld)
  const acceptContract = useLogicBattleStore(
    (s) => s.acceptRedemptionContractModal,
  )
  const [showDetails, setShowDetails] = useState(false)

  if (world !== 'run' || (phase !== 'VICTORY' && phase !== 'DEFEAT') || !resolution) {
    return null
  }

  const region = REGIONS[runPlan.regionId] ?? REGIONS.r01_ponte_aurora
  const isVictory = phase === 'VICTORY'

  return (
    <div
      className="lb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      data-testid={`lb-battle-overlay-${phase.toLowerCase()}`}
    >
      <div className={`lb-result-card ${isVictory ? 'is-victory' : 'is-defeat'}`}>
        <div className="lb-result-card__top">
          <span className="lb-result-card__region">{region.name}</span>
          <button
            type="button"
            className="lb-result-card__info-btn"
            onClick={() => setShowDetails((v) => !v)}
            aria-label="Detalhes da batalha"
            title="Ver detalhes numéricos"
          >
            ℹ️
          </button>
        </div>

        <div className="lb-result-card__hero">
          <div className="lb-result-card__emblem">
            {isVictory ? '🏆' : '💀'}
          </div>
          <h3 className="lb-result-card__headline">
            {isVictory
              ? `+${formatArmy(resolution.survivors + region.rewardTroops, notationMode)} 🛡️`
              : `−${formatArmy(resolution.deficit, notationMode)} 🛡️`}
          </h3>
          <div className="lb-result-card__stars">
            {isVictory ? '★ ★ ★' : `${runPlan.enemy.bossName} resistiu`}
          </div>
        </div>

        {showDetails && (
          <div className="lb-result-card__details">
            <div>
              <span>Sua Legião</span>
              <strong>{formatArmy(resolution.playerArmy, notationMode)}</strong>
            </div>
            <div>
              <span>Força Inimiga</span>
              <strong>{formatArmy(resolution.enemyForce, notationMode)}</strong>
            </div>
          </div>
        )}

        {!isVictory && contract?.canGuaranteeVictory && (
          <div className="lb-contract-pill" data-testid="lb-honest-contract-offer">
            🎟️ Fichas cobrem o déficit (+{formatArmy(contract.grantOnSuccess, notationMode)})!
          </div>
        )}

        {!isVictory && !contract?.canGuaranteeVictory && (
          <div className="lb-rematch-pill" data-testid="lb-tactical-rematch-offer">
            🧭 Faltaram {formatArmy(resolution.deficit, notationMode)} soldados
          </div>
        )}

        <div className="lb-result-card__actions">
          {!isVictory && contract?.canGuaranteeVictory && (
            <button
              type="button"
              data-testid="lb-accept-contract-btn"
              className="lb-btn-3d lb-btn-3d--gold lb-btn-3d--wide"
              onClick={acceptContract}
            >
              🎟️ Virar Jogo (+{formatArmy(contract.grantOnSuccess, notationMode)})
            </button>
          )}

          <button
            type="button"
            data-testid="lb-battle-rematch-btn"
            className="lb-btn-3d lb-btn-3d--blue"
            onClick={() => startNewRun({ regionId: region.id })}
            title="Jogar Novamente"
          >
            ↻ {isVictory ? 'Jogar' : 'Revanche'}
          </button>

          <button
            type="button"
            data-testid="lb-battle-go-realm-btn"
            className="lb-btn-3d lb-btn-3d--teal"
            onClick={() => switchWorld('realm')}
            title="Ir para o Mapa do Reino"
          >
            🗺️ Reino
          </button>
        </div>
      </div>
    </div>
  )
}
