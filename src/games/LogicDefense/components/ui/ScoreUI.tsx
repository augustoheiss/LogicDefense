import type { GameEngineState } from '../../hooks/useGameEngine'
import { BUFF_DISPLAY, RESONANCE_DISPLAY } from '../../engine/constants'

interface ScoreUIProps {
  uiState: GameEngineState
}

function toOrdinal(n: number): string {
  const s = ['', 'Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta', 'Sétima', 'Oitava', 'Nona', 'Décima']
  if (n <= 10) return s[n] + ' Onda'
  return n + 'ª Onda'
}

export function ScoreUI({ uiState }: ScoreUIProps) {
  const {
    gold,
    lives,
    wave,
    goldMultiplier,
    totalCorrect,
    totalWrong,
    stats,
    currentBuff,
    streak,
    activeResonance,
  } = uiState

  const buffMeta = BUFF_DISPLAY[currentBuff]
  const resonanceMeta = activeResonance ? RESONANCE_DISPLAY[activeResonance] : null

  return (
    <div id="ui-layer" style={{
      position: 'absolute', top: 10, left: 10,
      pointerEvents: 'none', display: 'flex', flexWrap: 'wrap', gap: 8,
      transition: 'opacity 0.3s', zIndex: 20, maxWidth: 620,
    }}>
      {/* Gold */}
      <div className="stat-box" style={{ pointerEvents: 'auto' }}>
        💰 ${gold}
        <span className="tooltip-text">
          Me falaram que você é o cara da grana então...<br /><br />
          <span className="tt-highlight">Total Acumulado:</span> ${stats.totalGold}<br /><br />
          Dica RTS: Coletar moedas com <strong>Herói</strong> rende <strong>+15% a +25% de Ouro Bônus</strong>!
        </span>
      </div>

      {/* Wave */}
      <div className="stat-box" style={{ pointerEvents: 'auto' }}>
        🌊 {wave}
        <span className="tooltip-text">
          Você é um mergulhador de Onda mesmo!<br /><br />
          <span className="tt-highlight" id="tt-wave-ordinal">{toOrdinal(wave)}</span>
          {wave > 0 && wave % 10 === 0 && (
            <>
              <br /><span style={{ color: '#fbbf24' }}>⚠ Onda de Chefe: O Juiz Interno!</span>
            </>
          )}
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
      <div className="stat-box" style={{ pointerEvents: 'auto' }}>
        ⚖️ {goldMultiplier.toFixed(2)}x
        <span className="tooltip-text">
          <span className="tt-highlight">Multiplicador de Recompensa</span><br />
          Acumula +0.1x a cada acerto consecutivo (até 2.2x)!
        </span>
      </div>

      {/* Active Buff Pill */}
      <div
        className="stat-box"
        style={{
          pointerEvents: 'auto',
          borderColor: buffMeta.borderColor,
          color: buffMeta.color,
        }}
      >
        {buffMeta.label}
        <span className="tooltip-text">
          <span className="tt-highlight">{buffMeta.label}</span> — {buffMeta.subtitle}<br /><br />
          {buffMeta.perks.map((p, idx) => (
            <span key={idx} style={{ display: 'block', marginBottom: 4 }}>
              ▸ {p}
            </span>
          ))}
        </span>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div
          className="stat-box"
          style={{
            pointerEvents: 'auto',
            borderColor: '#fde047',
            color: '#fde047',
          }}
        >
          🔥 {streak}
          <span className="tooltip-text">
            <span className="tt-highlight">Sequência de Acertos: {streak}</span><br />
            Mantém a Ressonância Operacional ativa e eleva o multiplicador de ouro!
          </span>
        </div>
      )}

      {/* Operational Resonance */}
      {resonanceMeta && (
        <div
          className="stat-box"
          style={{
            pointerEvents: 'auto',
            borderColor: resonanceMeta.color,
            color: resonanceMeta.color,
          }}
        >
          ⚡ [{activeResonance}]
          <span className="tooltip-text">
            <span className="tt-highlight">{resonanceMeta.label}</span><br />
            {resonanceMeta.bonusText}
          </span>
        </div>
      )}

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

