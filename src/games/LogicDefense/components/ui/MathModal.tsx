import type { GameEngineState } from '../../hooks/useGameEngine'
import { TOTAL_TIME } from '../../engine/constants'
import { BUFF_DISPLAY } from '../../engine/constants'

interface MathModalProps {
  uiState: GameEngineState
  onAnswer: (isCorrect: boolean) => void
}

export function MathModal({ uiState, onAnswer }: MathModalProps) {
  const { gameState, mathQuestion, mathOptions, currentProblem, phraseMessage, timeLeft, currentBuff } = uiState

  if (gameState !== 'MATH') return null

  const timerPct = (timeLeft / TOTAL_TIME) * 100
  const buffColors = BUFF_DISPLAY[currentBuff]

  return (
    <div id="math-modal" style={{
      display: 'block',
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.95)',
      border: `4px solid ${buffColors.borderColor}`,
      padding: 30, textAlign: 'center',
      boxShadow: `0 0 80px ${buffColors.color}30`,
      zIndex: 100, width: 450, borderRadius: 10, overflow: 'hidden',
      maxWidth: '90vw',
    }}>
      {/* Timer bar */}
      <div id="timer-container" style={{ width: '100%', height: 10, background: '#333', position: 'absolute', top: 0, left: 0 }}>
        <div id="timer-bar" style={{
          width: `${timerPct}%`, height: '100%', background: '#ff0000',
          transition: 'width 0.1s linear',
        }} />
      </div>

      {/* Buff message */}
      <div id="buff-message" style={{
        fontSize: 16, color: '#ccc', marginBottom: 20, fontStyle: 'italic',
        minHeight: 40, padding: 10, borderBottom: '1px solid #333', lineHeight: 1.4,
      }}>
        {phraseMessage}
      </div>

      <div style={{ color: '#00ff00', fontSize: 16, letterSpacing: 2, marginTop: 10 }}>
        PROTOCOLOS DE SEGURANÇA
      </div>

      <div id="math-question" style={{
        fontSize: 48, margin: '10px 0 20px 0', color: '#fff',
        fontWeight: 'bold', textShadow: '0 0 20px rgba(255,255,255,0.5)',
      }}>
        {mathQuestion}
      </div>

      <div id="math-options">
        {mathOptions.map((opt, i) => (
          <button
            key={i}
            className="btn-math"
            onClick={() => {
              if (!currentProblem) return
              onAnswer(opt === currentProblem.answer)
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
