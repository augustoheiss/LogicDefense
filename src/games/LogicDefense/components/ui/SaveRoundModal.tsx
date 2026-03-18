import { useState } from 'react'
import type { GameEngineState } from '../../hooks/useGameEngine'

interface SaveRoundModalProps {
  uiState: GameEngineState
  onConfirm: (playerName: string) => void
  onCancel: () => void
}

export function SaveRoundModal({ uiState, onConfirm, onCancel }: SaveRoundModalProps) {
  const [name, setName] = useState('')
  const { showSaveModal, wave, totalCorrect, totalMath, lives } = uiState

  if (!showSaveModal) return null

  const isGameOver = lives <= 0
  const accuracy = totalMath > 0 ? Math.round((totalCorrect / totalMath) * 100) : 0

  function handleConfirm() {
    onConfirm(name.trim() || 'Anônimo')
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New', monospace",
    }}>
      {/* Card */}
      <div style={{
        background: 'rgba(10,14,22,0.97)',
        border: '2px solid #00d4ff',
        borderRadius: 12,
        boxShadow: '0 0 40px rgba(0,212,255,0.25)',
        padding: '36px 44px',
        width: 380,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>
            {isGameOver ? '💀' : '🏆'}
          </div>
          <h2 style={{
            margin: 0, fontSize: 20, color: '#00d4ff',
            letterSpacing: 2, textTransform: 'uppercase',
          }}>
            {isGameOver ? 'Fim de Jogo' : 'Salvar Rodada'}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#555', letterSpacing: 1 }}>
            {isGameOver
              ? 'A Lógica foi implacável. Imortalize sua jornada.'
              : 'Registre sua conquista no placar local.'}
          </p>
        </div>

        {/* Stats */}
        <div style={{
          background: 'rgba(0,212,255,0.05)',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 8,
          padding: '14px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px 0',
        }}>
          <StatRow label="Onda" value={`# ${wave}`} color="#ffd700" />
          <StatRow label="Acertos" value={`${totalCorrect} / ${totalMath}`} color="#00ff88" />
          <StatRow label="Precisão" value={`${accuracy}%`} color={accuracy >= 70 ? '#00ff88' : '#ff9800'} />
          <StatRow label="Vidas rest." value={`${lives > 0 ? lives : 0}`} color={lives > 0 ? '#ff6b9d' : '#ff4444'} />
        </div>

        {/* Name input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
            Seu nome no placar
          </label>
          <input
            autoFocus
            maxLength={20}
            placeholder="Anônimo"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(0,212,255,0.4)',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 16,
              color: '#fff',
              fontFamily: "'Courier New', monospace",
              outline: 'none',
              letterSpacing: 1,
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13,
              background: 'transparent', border: '1px solid #444',
              color: '#888', borderRadius: 6, cursor: 'pointer',
              fontFamily: "'Courier New', monospace", letterSpacing: 1,
              transition: '0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#666'; (e.currentTarget as HTMLButtonElement).style.color = '#aaa' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#444'; (e.currentTarget as HTMLButtonElement).style.color = '#888' }}
          >
            Descartar
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 2, padding: '10px 0', fontSize: 14, fontWeight: 'bold',
              background: 'rgba(0,212,255,0.12)', border: '2px solid #00d4ff',
              color: '#00d4ff', borderRadius: 6, cursor: 'pointer',
              fontFamily: "'Courier New', monospace", letterSpacing: 2,
              textTransform: 'uppercase', transition: '0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#00d4ff'; (e.currentTarget as HTMLButtonElement).style.color = '#000' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,212,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#00d4ff' }}
          >
            Salvar e sair
          </button>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 'bold', color, letterSpacing: 1 }}>{value}</div>
    </div>
  )
}
