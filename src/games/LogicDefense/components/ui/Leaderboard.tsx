import { useState } from 'react'
import { getLeaderboard, type LeaderboardEntry } from '../../hooks/useHighScore'

const MEDALS = ['🥇', '🥈', '🥉']

interface LeaderboardProps {
  /** How many entries to show before "show more" is triggered */
  visibleCount?: number
}

export function Leaderboard({ visibleCount = 10 }: LeaderboardProps) {
  const [expanded, setExpanded] = useState(false)
  const entries: LeaderboardEntry[] = getLeaderboard()

  if (entries.length === 0) {
    return (
      <div style={containerStyle}>
        <SectionTitle />
        <div style={{
          textAlign: 'center', padding: '24px 0',
          color: '#555', fontSize: 13,
          fontFamily: "'Courier New', monospace", letterSpacing: 1,
        }}>
          Nenhuma rodada salva ainda.<br />
          <span style={{ color: '#333' }}>Seja o primeiro a imortalizá-la.</span>
        </div>
      </div>
    )
  }

  const visible = expanded ? entries : entries.slice(0, visibleCount)
  const hasMore = entries.length > visibleCount

  return (
    <div style={containerStyle}>
      <SectionTitle count={entries.length} />

      {/* Header row */}
      <div style={headerRowStyle}>
        <span style={{ width: 32, textAlign: 'center' }}>#</span>
        <span style={{ flex: 1 }}>NOME</span>
        <span style={{ width: 52, textAlign: 'center' }}>ONDA</span>
        <span style={{ width: 60, textAlign: 'center' }}>ACERTOS</span>
        <span style={{ width: 96, textAlign: 'right', fontSize: 9 }}>DATA</span>
      </div>

      {/* Entries */}
      <div style={{ overflowY: 'auto', maxHeight: expanded ? 300 : 'none' }}>
        {visible.map((e, i) => (
          <EntryRow key={i} entry={e} rank={i + 1} />
        ))}
      </div>

      {/* Show more / less toggle */}
      {hasMore && (
        <button
          onClick={() => setExpanded(x => !x)}
          style={{
            marginTop: 6, width: '100%', padding: '5px 0',
            background: 'transparent', border: '1px solid #222',
            borderRadius: 4, color: '#444', fontSize: 11,
            cursor: 'pointer', fontFamily: "'Courier New', monospace",
            letterSpacing: 1, transition: '0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget).style.borderColor = '#00d4ff44'; (e.currentTarget).style.color = '#00d4ff' }}
          onMouseLeave={e => { (e.currentTarget).style.borderColor = '#222'; (e.currentTarget).style.color = '#444' }}
        >
          {expanded ? '▲ MENOS' : `▼ VER TODOS (${entries.length})`}
        </button>
      )}
    </div>
  )
}

function SectionTitle({ count }: { count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: '#ffd700', letterSpacing: 2, fontFamily: "'Courier New', monospace" }}>
        🏆 PLACAR LOCAL
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 10, color: '#555', letterSpacing: 1, fontFamily: "'Courier New', monospace" }}>
          {count} RODADA{count !== 1 ? 'S' : ''}
        </span>
      )}
    </div>
  )
}

function EntryRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const medal = MEDALS[rank - 1] ?? null
  const accuracy = entry.totalMath > 0
    ? Math.round((entry.totalCorrect / entry.totalMath) * 100)
    : 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '5px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      fontFamily: "'Courier New', monospace",
      fontSize: 12,
      background: rank === 1 ? 'rgba(255,215,0,0.04)' : 'transparent',
    }}>
      <span style={{ width: 32, textAlign: 'center', color: rank <= 3 ? '#ffd700' : '#444', fontSize: 14 }}>
        {medal ?? rank}
      </span>
      <span style={{ flex: 1, color: rank === 1 ? '#fff' : '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.playerName}
      </span>
      <span style={{ width: 52, textAlign: 'center', color: '#00d4ff', fontWeight: 'bold' }}>
        {entry.wave}
      </span>
      <span style={{ width: 60, textAlign: 'center', color: accuracy >= 70 ? '#00ff88' : '#ff9800', fontSize: 11 }}>
        {entry.totalCorrect}/{entry.totalMath}
      </span>
      <span style={{ width: 96, textAlign: 'right', color: '#444', fontSize: 10 }}>
        {entry.dateTime}
      </span>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  width: '100%',
  boxSizing: 'border-box',
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: '4px 0 6px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  marginBottom: 4,
  fontFamily: "'Courier New', monospace",
  fontSize: 9,
  color: '#555',
  letterSpacing: 1,
  textTransform: 'uppercase',
}
