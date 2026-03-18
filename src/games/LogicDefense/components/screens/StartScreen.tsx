import { Leaderboard } from '../ui/Leaderboard'

interface StartScreenProps {
  onPlay: () => void
}

export function StartScreen({ onPlay }: StartScreenProps) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.90)', zIndex: 200,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
    }}>
      {/* ── Left column: title + play ── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        <h1 style={{
          fontSize: 38, marginBottom: 4, color: '#fff',
          textShadow: '0 0 20px #00d4ff', fontFamily: "'Courier New', monospace",
          textAlign: 'center', margin: 0,
        }}>
          LOGIC DEFENSE
        </h1>
        <p style={{
          fontSize: 15, marginBottom: 28, color: '#aaa',
          letterSpacing: 2, fontFamily: "'Courier New', monospace",
          marginTop: 6, textAlign: 'center',
        }}>
          O MUSEU DOS NÚMEROS
        </p>

        <button
          className="play-btn"
          onClick={onPlay}
          style={{
            margin: '0 0 14px', padding: '16px 52px', fontSize: 26,
            cursor: 'pointer', border: '2px solid #00d4ff',
            background: 'rgba(0,212,255,0.1)', color: '#00d4ff',
            fontFamily: "'Courier New', monospace", transition: '0.2s',
            borderRadius: 8, letterSpacing: 3, fontWeight: 'bold',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.background = '#00d4ff';
            (e.target as HTMLButtonElement).style.color = '#000'
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = 'rgba(0,212,255,0.1)';
            (e.target as HTMLButtonElement).style.color = '#00d4ff'
          }}
        >
          ▶ JOGAR
        </button>

        <p style={{
          fontSize: 12, color: '#555',
          fontFamily: "'Courier New', monospace", fontStyle: 'italic',
          textAlign: 'center',
        }}>
          A Esfera decidirá seu destino...
        </p>

        <p style={{
          fontSize: 11, color: 'rgba(255,255,255,0.15)', marginTop: 24,
          fontFamily: "'Courier New', monospace", letterSpacing: 2,
          textTransform: 'uppercase', textAlign: 'center',
        }}>
          ↓ Role abaixo para ler o Manifesto
        </p>
      </div>

      {/* ── Right column: leaderboard ── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '24px 20px',
        overflowY: 'auto',
      }}>
        <Leaderboard visibleCount={8} />
      </div>
    </div>
  )
}
