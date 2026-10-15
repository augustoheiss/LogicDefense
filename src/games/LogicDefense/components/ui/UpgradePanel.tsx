import type { GameEngineState } from '../../hooks/useGameEngine'
import { getBuffModifiers } from '../../engine/buffSystem'

interface UpgradePanelProps {
  uiState: GameEngineState
  onUpgrade: () => void
  onMove: () => void
  onSell: () => void
  onClose: () => void
}

export function UpgradePanel({ uiState, onUpgrade, onMove, onSell, onClose }: UpgradePanelProps) {
  const { selectedExistingTower, gameState, currentBuff, activeResonance, gold } = uiState

  if (!selectedExistingTower || (gameState !== 'BUILD' && gameState !== 'COMBAT')) return null

  const buffMods = getBuffModifiers(currentBuff)
  const effectiveCost = selectedExistingTower.getEffectiveUpgradeCost(buffMods.upgradeCostDiscount)
  const isResonant = activeResonance === selectedExistingTower.type.symbol
  const refund = Math.floor(selectedExistingTower.totalCost * 0.5)
  const canAfford = gold >= effectiveCost

  return (
    <div id="upgrade-info" style={{ display: 'flex', minWidth: 185 }}>
      <button className="btn-close-panel" onClick={onClose} title="Fechar painel">✕</button>

      <div style={{
        color: selectedExistingTower.type.color,
        fontWeight: 'bold',
        marginBottom: 4,
        borderBottom: '1px solid #444',
        paddingBottom: 4,
        fontSize: 13,
      }}>
        {selectedExistingTower.type.name} • LV.{selectedExistingTower.level}
      </div>

      {isResonant && (
        <div style={{ fontSize: 10, color: '#fde047', marginBottom: 4 }}>
          ⚡ RESSONÂNCIA ATIVA (+Dano/Alcance)
        </div>
      )}

      <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 6, lineHeight: 1.4 }}>
        <div>Dano: <strong>{Math.round(selectedExistingTower.getDamage(buffMods.towerDamageMultiplier, isResonant))}</strong></div>
        <div>Alcance: <strong>{selectedExistingTower.getEffectiveRange(buffMods.towerRangeMultiplier, isResonant)}px</strong></div>
      </div>

      <div style={{ fontSize: 12, marginBottom: 6, color: canAfford ? '#4ade80' : '#f87171' }}>
        Upgrade: <strong>${effectiveCost}</strong>
        {buffMods.upgradeCostDiscount > 0 && (
          <span style={{ fontSize: 10, color: '#38bdf8', marginLeft: 4 }}>
            (-15% 🪑)
          </span>
        )}
      </div>

      <button
        className="action-btn"
        onClick={onUpgrade}
        style={{ opacity: canAfford ? 1 : 0.55 }}
      >
        ⬆ EVOLUIR (${effectiveCost})
      </button>

      <div className="panel-actions-row">
        <button className="action-btn btn-move" onClick={onMove}>🚚 MOVER</button>
        <button className="action-btn btn-sell" onClick={onSell} title={`Reembolso: $${refund}`}>
          🗑️ +${refund}
        </button>
      </div>
    </div>
  )
}

