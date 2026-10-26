// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/BattleOverlay.tsx — ResultCard Arcade (V3)
// §2.1 R1 (Replay/Luz-Guia no fim), §2.2 R2 (Bônus Opcional + Pular igual), §2.4 (Zero Exército Negativo)
// ──────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { REGIONS } from '../config/regions'
import { formatArmy } from '../domain/notation'
import { ENGINE_CATALOG } from '../engines/engineContract'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const BattleOverlay: React.FC = () => {
  const world = useLogicBattleStore((s) => s.world)
  const phase = useLogicBattleStore((s) => s.snapshot.phase)
  const activeEngineId = useLogicBattleStore((s) => s.activeEngineId)
  const resolution = useLogicBattleStore((s) => s.battleResolution)
  const contract = useLogicBattleStore((s) => s.redemptionContract)
  const tokensInRun = useLogicBattleStore((s) => s.tokensInRun)
  const trapHistoryInRun = useLogicBattleStore((s) => s.trapHistoryInRun)
  const runPlan = useLogicBattleStore((s) => s.runPlan)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const startNewRun = useLogicBattleStore((s) => s.startNewRun)
  const switchWorld = useLogicBattleStore((s) => s.switchWorld)
  const acceptContract = useLogicBattleStore(
    (s) => s.acceptRedemptionContractModal,
  )
  const openNextRedemptionModal = useLogicBattleStore(
    (s) => s.openNextRedemptionModal,
  )
  const [showDetails, setShowDetails] = useState(false)
  const [skippedBonus, setSkippedBonus] = useState(false)

  if (world !== 'run' || (phase !== 'VICTORY' && phase !== 'DEFEAT') || !resolution) {
    return null
  }

  const region = REGIONS[runPlan.regionId] ?? REGIONS.r01_ponte_aurora
  const engineMeta = ENGINE_CATALOG[activeEngineId] ?? ENGINE_CATALOG.ponte_portoes
  const isVictory = phase === 'VICTORY'
  const safePlayerArmy = Math.max(0, resolution.playerArmy)
  const unusedTokens = tokensInRun.filter((t) => !t.used).length
  const hasBonusOffer =
    !skippedBonus && (unusedTokens > 0 || Boolean(contract?.canGuaranteeVictory))
  const bonusAmount =
    contract?.canGuaranteeVictory && !isVictory
      ? contract.grantOnSuccess
      : Math.max(15, Math.round(Math.max(safePlayerArmy, resolution.enemyForce) * 0.5))

  return (
    <div
      className="lb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      data-testid={`lb-battle-overlay-${phase.toLowerCase()}`}
    >
      <div className={`lb-result-card ${isVictory ? 'is-victory' : 'is-defeat'}`}>
        <div className="lb-result-card__top">
          <span className="lb-result-card__region">
            {engineMeta.icon} {region.name}
          </span>
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
            {isVictory ? '🏆' : '⚔️'}
          </div>
          {/* §2.4 item 1: Nunca exibir exército negativo (ex.: -22 🛡️); exibir sempre >= 0 */}
          <h3 className="lb-result-card__headline" data-testid="lb-result-headline">
            {isVictory
              ? `+${formatArmy(resolution.survivors + region.rewardTroops, notationMode)} 🛡️`
              : `${formatArmy(safePlayerArmy, notationMode)} / ${formatArmy(resolution.enemyForce, notationMode)} 🛡️`}
          </h3>
          <div className="lb-result-card__stars">
            {isVictory
              ? '★ ★ ★ Vitória!'
              : `Meta: ${formatArmy(resolution.enemyForce, notationMode)} 🛡️ (faltaram ${formatArmy(resolution.deficit, notationMode)})`}
          </div>
        </div>

        {showDetails && (
          <div className="lb-result-card__details">
            <div>
              <span>Sua Legião</span>
              <strong>{formatArmy(safePlayerArmy, notationMode)} 🛡️</strong>
            </div>
            <div>
              <span>Força Inimiga</span>
              <strong>{formatArmy(resolution.enemyForce, notationMode)} 💀</strong>
            </div>
          </div>
        )}

        {/* §2.1 R1: Explicação da pegadinha e Luz-Guia somente no Resumo de Fim de Fase */}
        {trapHistoryInRun.length > 0 && (
          <div
            className="lb-postrun-trap-summary"
            data-testid="lb-postrun-trap-summary"
          >
            <strong>⚡ Replay de Rota ({trapHistoryInRun.length} pegadinha):</strong>
            <span>
              {trapHistoryInRun[0].trapName} — {trapHistoryInRun[0].luzGuiaPt}
            </span>
          </div>
        )}

        {/* §2.2 R2: Matemática como Bônus Opcional (+50% pontos/tropas) com botão Pular do mesmo tamanho */}
        {hasBonusOffer && (
          <div
            className="lb-contract-pill"
            data-testid={
              !isVictory && contract?.canGuaranteeVictory
                ? 'lb-honest-contract-offer'
                : 'lb-optional-bonus-offer'
            }
          >
            <div>
              🎟️ Desafio Bônus Opcional (+{formatArmy(bonusAmount, notationMode)} 🛡️ / +50% pts)
            </div>
            <div className="lb-bonus-equal-actions">
              <button
                type="button"
                data-testid="lb-accept-contract-btn"
                className="lb-btn-3d lb-btn-3d--gold"
                onClick={() => {
                  if (!isVictory && contract?.canGuaranteeVictory) {
                    acceptContract()
                  } else {
                    openNextRedemptionModal()
                  }
                }}
              >
                🎟️ Resolver (+{formatArmy(bonusAmount, notationMode)})
              </button>
              <button
                type="button"
                data-testid="lb-skip-redemption-btn"
                className="lb-btn-3d lb-btn-3d--slate-equal"
                onClick={() => setSkippedBonus(true)}
              >
                ⏭️ Pular Bônus
              </button>
            </div>
          </div>
        )}

        {!isVictory && !contract?.canGuaranteeVictory && (
          <div className="lb-rematch-pill" data-testid="lb-tactical-rematch-offer">
            🧭 Faltaram {formatArmy(resolution.deficit, notationMode)} soldados
          </div>
        )}

        <div className="lb-result-card__actions">
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
