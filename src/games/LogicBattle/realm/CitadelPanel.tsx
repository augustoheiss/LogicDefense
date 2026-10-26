// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/realm/CitadelPanel.tsx — As 5 Construções da Cidadela
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
        <div>
          <span className="lb-metric-label">ARQUITETURA DE PROGRESSÃO</span>
          <h3 className="lb-realm-title">🏰 Cidadela da Matemática Soberana</h3>
        </div>
        <div className="lb-reserve-pill" data-testid="lb-realm-reserve-pill">
          <span>Reserva de Tropas:</span>
          <strong>{formatArmy(save.reserveTroops, save.settings.notationMode)}</strong>
        </div>
      </div>

      {/* Cofre da Mina do Resto Euclidiano */}
      <div className="lb-mine-vault-bar" data-testid="lb-mine-vault-bar">
        <div>
          <strong>⛏️ Cofre do Resto Euclidiano: {save.remainderVault} restos guardados</strong>
          <p>
            Cada divisão não-exata na ponte deposita seu resto aqui ({minaRatio} restos = +1
            Recruta).
          </p>
        </div>
        <button
          type="button"
          data-testid="lb-convert-remainders-btn"
          className="lb-btn-secondary"
          disabled={convertibleTroops <= 0}
          onClick={convertRemaindersInMine}
        >
          Recrutar +{convertibleTroops} Soldado(s)
        </button>
      </div>

      <div className="lb-buildings-grid" data-testid="lb-buildings-grid">
        {CITADEL_BUILDING_LIST.map((b) => {
          const currentLevel = save.citadelLevels[b.id] ?? 0
          const isMax = currentLevel >= b.maxLevel
          const cost = getUpgradeCost(b.id, currentLevel)
          const canAfford = !isMax && save.reserveTroops >= cost

          return (
            <article
              key={b.id}
              data-testid={`lb-building-card-${b.id}`}
              className="lb-building-card"
            >
              <div className="lb-building-top">
                <span className="lb-building-icon">{b.icon}</span>
                <div>
                  <h4>{b.name}</h4>
                  <span className="lb-building-lvl">
                    Nível {currentLevel}/{b.maxLevel} · {b.levelLabels[currentLevel]}
                  </span>
                </div>
              </div>

              <p className="lb-building-desc">{b.descriptionPt}</p>
              <p className="lb-building-pedagogy">💡 {b.pedagogicalConceptPt}</p>

              <button
                type="button"
                data-testid={`lb-upgrade-btn-${b.id}`}
                className="lb-btn-primary lb-btn-sm"
                disabled={!canAfford || isMax}
                onClick={() => upgradeCitadelBuilding(b.id)}
              >
                {isMax
                  ? '✓ Nível Máximo Alcançado'
                  : `⬆ Evoluir (${formatArmy(cost, save.settings.notationMode)} soldados)`}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
