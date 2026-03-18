import { useState } from 'react'
import type { GameEngineState } from '../../hooks/useGameEngine'

interface SystemMenuProps {
  uiState: GameEngineState
  onToggleSpeed: () => void
  onToggleAI: () => void
  onToggleGhost: () => void
  onToggleMute: () => void
  onToggleStress: () => void
  onFullscreen: () => void
  onSaveRound: () => void
  toggleMuteAudio: (muted: boolean) => void
}

export function SystemMenu({
  uiState,
  onToggleSpeed,
  onToggleAI,
  onToggleGhost,
  onToggleMute,
  onToggleStress,
  onFullscreen,
  onSaveRound,
  toggleMuteAudio,
}: SystemMenuProps) {
  const [open, setOpen] = useState(false)
  const { gameSpeed, aiMode, uiHidden, isAudioMuted, stressMode } = uiState

  const speedLabel =
    gameSpeed === 1 ? '⏩ VELOCIDADE: 1x' :
    gameSpeed === 3 ? '⏩ VELOCIDADE: 3x' :
    '🚀 VELOCIDADE: 6x (MAX)'

  const speedClass =
    gameSpeed === 1 ? '' :
    gameSpeed === 3 ? 'active-btn' : 'max-btn'

  return (
    <div id="sys-menu-container" style={{
      position: 'absolute', top: 10, right: 10, zIndex: 50,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    }}>
      <button className="top-btn" onClick={() => setOpen(o => !o)}>⚙️ SISTEMA</button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
          <button
            id="speed-btn"
            className={`top-btn ${speedClass}`}
            onClick={onToggleSpeed}
          >
            {speedLabel}
          </button>

          <button
            id="ai-btn"
            className={`top-btn ${aiMode ? 'active-btn' : ''}`}
            onClick={onToggleAI}
          >
            🤖 MODO IA: {aiMode ? 'ON' : 'OFF'}
          </button>

          <button
            id="ghost-btn"
            className={`top-btn ${uiHidden ? 'active-btn' : ''}`}
            onClick={onToggleGhost}
          >
            👁️ MODO FANTASMA: {uiHidden ? 'ON' : 'OFF'}
          </button>

          <button
            id="mute-btn"
            className={`top-btn ${isAudioMuted ? 'active-btn' : ''}`}
            onClick={() => {
              const next = !isAudioMuted
              toggleMuteAudio(next)
              onToggleMute()
            }}
          >
            {isAudioMuted ? '🔇 ÁUDIO: OFF' : '🔊 ÁUDIO: ON'}
          </button>

          <button className="top-btn" id="fullscreen-btn" onClick={onFullscreen}>
            🔲 TELA CHEIA
          </button>

          {stressMode && (
            <button
              id="stress-btn"
              className={`top-btn ${stressMode ? 'max-btn' : ''}`}
              onClick={onToggleStress}
            >
              🔥 STRESS: {stressMode ? 'ON' : 'OFF'}
            </button>
          )}

          <button
            id="save-round-btn"
            className="top-btn"
            style={{ borderColor: '#ffd700', color: '#ffd700', marginTop: 10 }}
            onClick={onSaveRound}
          >
            🏆 SALVAR RODADA
          </button>
        </div>
      )}
    </div>
  )
}
