import { useState } from 'react'
import { TOWER_TYPES } from '../../engine/constants'
import type { GameEngineState } from '../../hooks/useGameEngine'

interface BuildMenuProps {
  uiState: GameEngineState
  onSelectTower: (idx: number) => void
}

export function BuildMenu({ uiState, onSelectTower }: BuildMenuProps) {
  const [open, setOpen] = useState(false)
  const { selectedTowerIdx, gameState } = uiState

  if (gameState === 'START' || gameState === 'SPIN' || gameState === 'MATH' || gameState === 'CINEMATIC') return null

  return (
    <div id="build-menu-container" style={{
      position: 'absolute', bottom: 10, right: 10, zIndex: 50,
      display: 'flex', flexDirection: 'column-reverse', alignItems: 'flex-end', gap: 10,
    }}>
      <button
        className={`top-btn ${open ? 'build-glow' : ''}`}
        id="build-toggle-btn"
        onClick={() => setOpen(o => !o)}
      >
        🛠️ ARSENAL
      </button>

      {open && (
        <div style={{
          display: 'flex', gap: 15, background: 'rgba(0,0,0,0.85)',
          padding: 10, borderRadius: 10, border: '1px solid #555',
          boxShadow: '0 0 20px rgba(0,0,0,0.8)',
        }}>
          {TOWER_TYPES.map((t, idx) => (
            <button
              key={idx}
              id={`tbtn${idx}`}
              className={`tower-btn ${selectedTowerIdx === idx ? 'selected' : ''}`}
              onClick={() => { onSelectTower(idx); setOpen(false) }}
            >
              <div className="tower-symbol" style={{ color: t.color }}>{t.symbol}</div>
              <div className="tower-cost">${t.cost}</div>
              <div className="tower-desc">{t.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
