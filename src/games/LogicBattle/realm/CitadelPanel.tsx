// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/realm/CitadelPanel.tsx — Gaveta Detalhada da Cidadela (BottomSheet)
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { CITADEL_BUILDING_LIST, getUpgradeCost } from '../config/upgrades'
import { formatArmy } from '../domain/notation'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const CitadelPanel: React.FC = () => {
  const save = useLogicBattleStore((s) => s.save)
  const upgradeCitadelBuilding = useLogicBattleStore(
    (s) => s.upgradeCitadelBuilding,
  )
  const convertRemaindersInMine = useLogicBattleStore(
    (s) => s.convertRemaindersInMine,
  )

  const minaLevel = save.citadelLevels.mina_resto ?? 0
  const minaRatio =
    CITADEL_BUILDING_LIST.find((b) => b.id === 'mina_resto')?.levelEffects[
      minaLevel
    ] ?? 10
  const convertibleTroops = Math.floor(save.remainderVault / minaRatio)

  return (
    <section className="lb-citadel-panel" data-testid="lb-citadel-panel">
      <div className="lb-citadel-header">
        <div className="lb-reserve-pill" data-testid="lb-realm-reserve-pill">
          <span>🛡️ Reserva:</span>
          <strong>{formatArmy(save.reserveTroops, save.settings.notationMode)}</strong>
        </div>

        <div className="lb-mine-vault-bar" data-testid="lb-mine-vault-bar">
          <span>⛏️ Cofre do Resto: <strong>{save.remainderVault}</strong> ({minaRatio}:1)</span>
          <button
            type="button"
            data-testid="lb-convert-remainders-btn"
            className="lb-btn-3d lb-btn-3d--teal lb-btn-sm"
            disabled={convertibleTroops <= 0}
            onClick={convertRemaindersInMine}
          >
            +{convertibleTroops} 🛡️
          </button>
        </div>
      </div>

      <div className="lb-sheet-buildings-grid">
        {CITADEL_BUILDING_LIST.map((b) => {
          const currentLevel = save.citadelLevels[b.id] ?? 0
          const isMax = currentLevel >= b.maxLevel
          const cost = getUpgradeCost(b.id, currentLevel)
          const canAfford = !isMax && save.reserveTroops >= cost

          return (
            <article
              key={b.id}
              data-testid={`lb-sheet-building-card-${b.id}`}
              className="lb-building-card"
            >
              <div className="lb-building-top">
                <span className="lb-building-icon">{b.icon}</span>
                <div>
                  <h4>{b.name}</h4>
                  <span className="lb-building-lvl">
                    Nv {currentLevel}/{b.maxLevel} · {b.levelLabels[currentLevel]}
                  </span>
                </div>
              </div>

              <p className="lb-building-desc">{b.descriptionPt}</p>

              <button
                type="button"
                data-testid={`lb-sheet-upgrade-btn-${b.id}`}
                className="lb-btn-3d lb-btn-3d--blue lb-btn-sm"
                disabled={!canAfford || isMax}
                onClick={() => upgradeCitadelBuilding(b.id)}
              >
                {isMax
                  ? '✓ Máximo'
                  : `⬆ Evoluir (${formatArmy(cost, save.settings.notationMode)} 🛡️)`}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
