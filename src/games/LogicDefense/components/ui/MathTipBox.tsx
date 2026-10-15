import { useState, useEffect } from 'react'
import type { GameEngineState } from '../../hooks/useGameEngine'
import { RESONANCE_DISPLAY } from '../../engine/constants'

interface MathTipBoxProps {
  uiState: GameEngineState
}

export function MathTipBox({ uiState }: MathTipBoxProps) {
  const {
    gameState,
    tipHtml,
    currentProblem,
    lastSelectedAnswer,
    lastAnswerWasCorrect,
    activeResonance,
    aoeBuffArmed,
    wave,
  } = uiState

  const [collapsed, setCollapsed] = useState(false)

  // Reset collapse state on each new wave
  useEffect(() => {
    setCollapsed(false)
  }, [wave])

  if (gameState !== 'BUILD' || !tipHtml) return null

  const trapDiagnostic =
    !lastAnswerWasCorrect &&
    lastSelectedAnswer !== null &&
    currentProblem?.trapExplanations?.[lastSelectedAnswer]
      ? currentProblem.trapExplanations[lastSelectedAnswer]
      : null

  const resonanceMeta = activeResonance ? RESONANCE_DISPLAY[activeResonance] : null

  return (
    <div
      id="math-tip-box"
      style={{
        display: 'block',
        maxWidth: collapsed ? 220 : 340,
        transition: 'all 0.2s ease',
      }}
    >
      <div
        className="tip-title"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(prev => !prev)}
        title={collapsed ? 'Expandir dica lógica' : 'Minimizar para ver o mapa'}
      >
        <span>
          {currentProblem?.lensTitle || '⚡ RACIOCÍNIO LÓGICO'}
        </span>
        <button
          type="button"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            borderRadius: 4,
            fontSize: 10,
            padding: '1px 6px',
            cursor: 'pointer',
          }}
        >
          {collapsed ? '➕ Abrir' : '➖ Minimizar'}
        </button>
      </div>

      {!collapsed && (
        <>
          {trapDiagnostic && (
            <div style={{
              margin: '6px 0 8px',
              padding: '6px 8px',
              background: 'rgba(239, 68, 68, 0.14)',
              borderLeft: '3px solid #ef4444',
              borderRadius: 4,
              fontSize: 11,
              color: '#fca5a5',
              lineHeight: 1.35,
            }}>
              <strong>⚠ Armadilha Cognitiva ({lastSelectedAnswer}):</strong> {trapDiagnostic}
            </div>
          )}

          <div
            className="tip-content"
            id="tip-text"
            dangerouslySetInnerHTML={{ __html: tipHtml }}
          />

          {(aoeBuffArmed || resonanceMeta) && (
            <div style={{
              marginTop: 8,
              paddingTop: 6,
              borderTop: '1px solid rgba(255,255,255,0.12)',
              fontSize: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}>
              {aoeBuffArmed && (
                <div style={{ color: '#fde047', fontWeight: 'bold' }}>
                  ☢ AoE Nuke Armado (15s iniciam ao clicar em 🚀)
                </div>
              )}
              {resonanceMeta && (
                <div style={{ color: resonanceMeta.color }}>
                  ⚡ {resonanceMeta.label}: {resonanceMeta.bonusText}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

