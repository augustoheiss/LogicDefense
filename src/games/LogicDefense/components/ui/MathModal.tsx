import { useState } from 'react'
import type { GameEngineState } from '../../hooks/useGameEngine'
import { TOTAL_TIME, BUFF_DISPLAY } from '../../engine/constants'

interface MathModalProps {
  uiState: GameEngineState
  onAnswer: (isCorrect: boolean, selectedOption: number) => void
}

export function MathModal({ uiState, onAnswer }: MathModalProps) {
  const {
    gameState,
    mathQuestion,
    mathOptions,
    currentProblem,
    phraseMessage,
    timeLeft,
    maxTime,
    currentBuff,
    streak,
  } = uiState

  const [showHint, setShowHint] = useState(false)

  if (gameState !== 'MATH') return null

  const effectiveMax = maxTime || TOTAL_TIME
  const timerPct = Math.max(0, Math.min(100, (timeLeft / effectiveMax) * 100))
  const buffColors = BUFF_DISPLAY[currentBuff]
  const autoShowHint = currentBuff === 'amor'

  return (
    <div id="math-modal" style={{
      display: 'block',
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(6, 8, 18, 0.96)',
      border: `3px solid ${buffColors.borderColor}`,
      padding: '26px 28px 24px',
      textAlign: 'center',
      boxShadow: `0 0 80px ${buffColors.color}30`,
      zIndex: 100, width: 470, borderRadius: 12, overflow: 'hidden',
      maxWidth: '92vw',
    }}>
      {/* Timer bar */}
      <div id="timer-container" style={{ width: '100%', height: 8, background: '#1e293b', position: 'absolute', top: 0, left: 0 }}>
        <div id="timer-bar" style={{
          width: `${timerPct}%`,
          height: '100%',
          background: timerPct < 30 ? '#ef4444' : buffColors.borderColor,
          transition: 'width 0.1s linear',
        }} />
      </div>

      {/* Top meta row: Buff pill + Streak + Time */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        fontSize: 11,
        fontFamily: "'Courier New', monospace",
      }}>
        <span style={{
          color: buffColors.color,
          border: `1px solid ${buffColors.borderColor}66`,
          padding: '2px 8px',
          borderRadius: 99,
          background: 'rgba(255,255,255,0.04)',
          fontWeight: 'bold',
        }}>
          {buffColors.label} • {buffColors.shortSummary}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {streak > 0 && (
            <span style={{ color: '#fde047', fontWeight: 'bold' }}>
              🔥 {streak}x
            </span>
          )}
          <span style={{ color: timeLeft < 3 ? '#ef4444' : '#94a3b8', fontWeight: 'bold' }}>
            ⏱ {Math.max(0, timeLeft).toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Buff message */}
      <div id="buff-message" style={{
        fontSize: 14, color: '#cbd5e1', marginBottom: 14, fontStyle: 'italic',
        minHeight: 34, padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)', lineHeight: 1.4,
      }}>
        "{phraseMessage}"
      </div>

      {/* Lens badge & Hint toggle */}
      {currentProblem?.lensTitle && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 6,
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 11,
            color: '#38bdf8',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 6,
            padding: '2px 8px',
            fontFamily: "'Courier New', monospace",
          }}>
            {currentProblem.lensTitle}
          </span>
          {!autoShowHint && currentProblem.shortHint && (
            <button
              type="button"
              onClick={() => setShowHint(prev => !prev)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(250, 204, 21, 0.4)',
                color: '#fde047',
                borderRadius: 6,
                fontSize: 10,
                padding: '2px 7px',
                cursor: 'pointer',
                fontFamily: "'Courier New', monospace",
              }}
            >
              {showHint ? 'Ocultar Dica' : '💡 Ver Atalho'}
            </button>
          )}
        </div>
      )}

      {(autoShowHint || showHint) && currentProblem?.shortHint && (
        <div style={{
          fontSize: 12,
          color: '#fde047',
          background: 'rgba(250, 204, 21, 0.08)',
          border: '1px dashed rgba(250, 204, 21, 0.35)',
          borderRadius: 6,
          padding: '5px 10px',
          marginBottom: 8,
          fontFamily: "'Courier New', monospace",
        }}>
          💡 {currentProblem.shortHint}
        </div>
      )}

      <div id="math-question" style={{
        fontSize: 44, margin: '8px 0 16px 0', color: '#fff',
        fontWeight: 'bold', textShadow: '0 0 20px rgba(255,255,255,0.5)',
      }}>
        {mathQuestion}
      </div>

      <div id="math-options">
        {mathOptions.map((opt, i) => (
          <button
            key={i}
            className="btn-math"
            style={{ position: 'relative' }}
            onClick={() => {
              if (!currentProblem) return
              setShowHint(false)
              onAnswer(opt === currentProblem.answer, opt)
            }}
          >
            <span style={{
              position: 'absolute',
              top: 5,
              left: 8,
              fontSize: 10,
              color: 'rgba(255,255,255,0.45)',
              fontFamily: "'Courier New', monospace",
            }}>
              [{i + 1}]
            </span>
            {opt}
          </button>
        ))}
      </div>

      <div style={{
        marginTop: 12,
        fontSize: 10,
        color: '#64748b',
        fontFamily: "'Courier New', monospace",
      }}>
        Atalho de Teclado: Pressione [1], [2], [3] ou [4] para responder
      </div>
    </div>
  )
}

