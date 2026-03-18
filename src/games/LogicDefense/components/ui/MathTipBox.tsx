import type { GameEngineState } from '../../hooks/useGameEngine'

interface MathTipBoxProps {
  uiState: GameEngineState
}

export function MathTipBox({ uiState }: MathTipBoxProps) {
  const { gameState, tipHtml } = uiState

  if (gameState !== 'BUILD' || !tipHtml) return null

  return (
    <div id="math-tip-box" style={{ display: 'block' }}>
      <div className="tip-title">⚡ RACIOCÍNIO LÓGICO</div>
      <div
        className="tip-content"
        id="tip-text"
        dangerouslySetInnerHTML={{ __html: tipHtml }}
      />
    </div>
  )
}
