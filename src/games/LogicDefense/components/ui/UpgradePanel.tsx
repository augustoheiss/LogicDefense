import type { GameEngineState } from '../../hooks/useGameEngine'

interface UpgradePanelProps {
  uiState: GameEngineState
  onUpgrade: () => void
  onMove: () => void
  onSell: () => void
  onClose: () => void
}

export function UpgradePanel({ uiState, onUpgrade, onMove, onSell, onClose }: UpgradePanelProps) {
  const { selectedExistingTower, gameState } = uiState

  if (!selectedExistingTower || (gameState !== 'BUILD' && gameState !== 'COMBAT')) return null

  return (
    <div id="upgrade-info" style={{ display: 'flex' }}>
      <button className="btn-close-panel" onClick={onClose} title="Fechar painel">✕</button>

      <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: 5, borderBottom: '1px solid #444', paddingBottom: 5 }}>
        PAINEL DA TORRE
      </div>
      <div style={{ fontSize: 12, marginBottom: 5 }}>
        Upgrade: ${selectedExistingTower.upgradeCost}
      </div>
      <button className="action-btn" onClick={onUpgrade}>UPGRADE</button>

      <div className="panel-actions-row">
        <button className="action-btn btn-move" onClick={onMove}>🚚 MOVER</button>
        <button className="action-btn btn-sell" onClick={onSell}>🗑️ VENDER</button>
      </div>
    </div>
  )
}
