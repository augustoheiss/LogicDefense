// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/BattleOverlay.tsx — Resolução da Batalha Final
// Implementa a Regra do Contrato de Resgate Honesto (§2.1 R2)
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
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
      <div className="lb-modal-card lb-battle-card">
        <div className="lb-modal-badge-row">
          <span className={isVictory ? 'lb-badge-victory' : 'lb-badge-defeat'}>
            {isVictory ? '🏆 VITÓRIA NA PONTE!' : '🛡️ EMBATE FINAL — HORA DE REAGRUPAR'}
          </span>
          <span className="lb-badge-region">{region.name}</span>
        </div>

        <h3 className="lb-modal-title">
          {isVictory
            ? `${runPlan.enemy.bossName} foi superado!`
            : `${runPlan.enemy.bossName} resistiu por ${formatArmy(resolution.deficit, notationMode)} soldados!`}
        </h3>

        <div className="lb-counterfactual-grid">
          <div className="lb-cf-box">
            <span className="lb-cf-label">Sua Legião na Chegada</span>
            <strong className="lb-cf-val">
              {formatArmy(resolution.playerArmy, notationMode)}
            </strong>
          </div>
          <div className="lb-cf-box">
            <span className="lb-cf-label">Horda + {runPlan.enemy.bossName}</span>
            <strong className="lb-cf-val">
              {formatArmy(resolution.enemyForce, notationMode)}
            </strong>
          </div>
        </div>

        {isVictory ? (
          <div className="lb-victory-summary">
            <p>
              Sobreviveram <strong>{formatArmy(resolution.survivors, notationMode)}</strong>{' '}
              soldados, somados à recompensa regional de{' '}
              <strong>+{formatArmy(region.rewardTroops, notationMode)}</strong> para a Reserva do
              seu Reino no Mundo 2!
            </p>
          </div>
        ) : contract?.canGuaranteeVictory ? (
          <div className="lb-contract-offer-box" data-testid="lb-honest-contract-offer">
            <h4>★ Contrato de Resgate Honesto Disponível!</h4>
            <p>
              Você possui Ficha(s) de Resgate não utilizadas que recuperam{' '}
              <strong>+{formatArmy(contract.grantOnSuccess, notationMode)} soldados</strong> —
              cobrindo 100% do déficit de {formatArmy(resolution.deficit, notationMode)} mais a
              margem de segurança de +{formatArmy(contract.safetyMargin, notationMode)}!
            </p>
          </div>
        ) : (
          <div className="lb-rematch-offer-box" data-testid="lb-tactical-rematch-offer">
            <h4>🧭 Revanche Tática (Sem Falsas Promessas)</h4>
            <p>
              Para vencer com folga, faltaram{' '}
              <strong>{formatArmy(resolution.deficit, notationMode)} soldados</strong>. Tente uma
              Revanche Tática observando o Detector ⚠ ou fortaleça o Quartel na Cidadela do
              Mundo 2!
            </p>
          </div>
        )}

        <div className="lb-modal-actions">
          {!isVictory && contract?.canGuaranteeVictory && (
            <button
              type="button"
              data-testid="lb-accept-contract-btn"
              className="lb-btn-primary lb-btn-gold"
              onClick={acceptContract}
            >
              ★ Assinar Contrato de Resgate (+
              {formatArmy(contract.grantOnSuccess, notationMode)} soldados e Virar o Jogo!)
            </button>
          )}

          <button
            type="button"
            data-testid="lb-battle-rematch-btn"
            className="lb-btn-primary"
            onClick={() => startNewRun({ regionId: region.id })}
          >
            {isVictory ? '🌉 Nova Corrida nesta Região' : '⚔ Revanche Tática Imediata'}
          </button>

          <button
            type="button"
            data-testid="lb-battle-go-realm-btn"
            className="lb-btn-secondary"
            onClick={() => switchWorld('realm')}
          >
            🏰 Ir para o Mundo 2 (Mapa do Reino & Cidadela)
          </button>
        </div>
      </div>
    </div>
  )
}
