import type { GameEngineState } from '../../hooks/useGameEngine'

interface ScoreUIProps {
  uiState: GameEngineState
}

function toOrdinal(n: number): string {
  const s = ['', 'Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta', 'Sétima', 'Oitava', 'Nona', 'Décima']
  if (n <= 10) return s[n] + ' Onda'
  return n + 'ª Onda'
}

export function ScoreUI({ uiState }: ScoreUIProps) {
  const { gold, lives, wave, goldMultiplier, totalCorrect, totalWrong, stats } = uiState

  return (
    <div id="ui-layer" style={{
      position: 'absolute', top: 10, left: 10,
      pointerEvents: 'none', display: 'flex', flexWrap: 'wrap', gap: 10,
      transition: 'opacity 0.3s', zIndex: 20,
    }}>
      {/* Gold */}
      <div className="stat-box" style={{ pointerEvents: 'auto' }}>
        💰 ${gold}
        <span className="tooltip-text">
          Me falaram que você é o cara da grana então...<br /><br />
          <span className="tt-highlight">Total Acumulado:</span> ${stats.totalGold}<br /><br />
          Acerto: +150% / Erro: +50%
        </span>
      </div>

      {/* Wave */}
      <div className="stat-box" style={{ pointerEvents: 'auto' }}>
        🌊 {wave}
        <span className="tooltip-text">
          Você é um mergulhador de Onda mesmo!<br /><br />
          <span className="tt-highlight" id="tt-wave-ordinal">{toOrdinal(wave)}</span>
        </span>
      </div>

      {/* Lives */}
      <div className="stat-box" style={{ pointerEvents: 'auto' }}>
        ❤️ {lives}
        <span className="tooltip-text">
          Vamos gastar um pouco dessas vidas né, {lives} vidas é muita vida não é não?<br /><br />
          Ganhadas: <span className="tt-highlight">{stats.livesGained}</span><br />
          Perdidas: <span style={{ color: '#ff4444' }}>{stats.livesLost}</span>
        </span>
      </div>

      {/* Multiplier */}
      <div className="stat-box">⚖️ {goldMultiplier.toFixed(1)}x</div>

      {/* Correct score */}
      <div className="stat-box score-box" style={{ pointerEvents: 'auto' }}>
        ✅ {totalCorrect}
        <span className="tooltip-text">
          <span className="tt-highlight">Total Resolvido:</span> {stats.totalMath}<br /><br />
          <span style={{ color: '#ff4444' }}>Falhas por Operação:</span><br />
          Soma (+): {stats.errors['+'] || 0}<br />
          Subtração (-): {stats.errors['-'] || 0}<br />
          Multiplicação (x): {stats.errors['x'] || 0}<br />
          Divisão (÷): {stats.errors['÷'] || 0}
        </span>
      </div>

      {/* Wrong score */}
      <div className="stat-box score-box" style={{ borderColor: '#f00', color: '#f00' }}>
        ❌ {totalWrong}
      </div>
    </div>
  )
}
