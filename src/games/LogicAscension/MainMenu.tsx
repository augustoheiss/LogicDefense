import { useState, useEffect, CSSProperties } from 'react';
import { getHighScores, HighScore } from './leaderboard';

// ── Keyframes ─────────────────────────────────────────────────────────────────
const MENU_STYLES = `
@keyframes title-glow {
  0%, 100% {
    text-shadow: 0 0 18px #00d4ff88, 0 0 36px #00d4ff44, 0 0 72px #0080ff22;
    color: #d4f1ff;
  }
  50% {
    text-shadow: 0 0 36px #00d4ffbb, 0 0 72px #00d4ff66, 0 0 120px #0080ff44;
    color: #ffffff;
  }
}
@keyframes play-pulse {
  0%, 100% {
    box-shadow: 0 0 16px rgba(0,212,255,0.35), 0 0 36px rgba(0,212,255,0.12);
    border-color: #00d4ff;
  }
  50% {
    box-shadow: 0 0 30px rgba(0,212,255,0.65), 0 0 64px rgba(0,212,255,0.28);
    border-color: #66e8ff;
  }
}
@keyframes score-enter {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0);     }
}
@keyframes caret-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes corner-glow {
  0%, 100% { opacity: 0.3; }
  50%       { opacity: 0.7; }
}
`;

// ── Reusable style pieces ─────────────────────────────────────────────────────
const MONO: CSSProperties = { fontFamily: "'Courier New', monospace" };

const RANK_COLORS: string[] = ['#ffd700', '#c0c0c0', '#cd7f32'];

// ── Component ─────────────────────────────────────────────────────────────────
interface MainMenuProps {
  onPlay: () => void;
}

export function MainMenu({ onPlay }: MainMenuProps) {
  const [scores, setScores] = useState<HighScore[]>([]);

  useEffect(() => {
    setScores(getHighScores());
  }, []);

  return (
    <div style={{
      minHeight:     '100vh',
      background:    '#07070f',
      ...MONO,
      color:         '#e2e8f0',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      padding:       '56px 16px 72px',
      overflowY:     'auto',
    }}>
      <style>{MENU_STYLES}</style>

      {/* ── Decorative grid overlay ── */}
      <div style={{
        position:   'fixed',
        inset:       0,
        backgroundImage:
          'linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px), ' +
          'linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Title block ── */}
      <div style={{ textAlign: 'center', marginBottom: 44, position: 'relative', zIndex: 1 }}>
        <p style={{
          margin:          '0 0 10px',
          fontSize:        10,
          letterSpacing:   '0.4em',
          color:           '#00d4ff55',
          textTransform:   'uppercase',
        }}>
          ◈ &nbsp; L O G I C &nbsp; D E F E N S E &nbsp; ◈
        </p>

        <h1 style={{
          margin:        '0 0 6px',
          fontSize:      'clamp(44px, 11vw, 80px)',
          fontWeight:    900,
          letterSpacing: '0.1em',
          lineHeight:    1.05,
          animation:     'title-glow 2.6s ease-in-out infinite',
          textTransform: 'uppercase',
          ...MONO,
        }}>
          LOGIC<br />ASCENSION
        </h1>

        <p style={{
          margin:        '14px 0 0',
          fontSize:      11,
          color:         '#334155',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
        }}>
          PROVE SEU DOMÍNIO DA ORDEM DAS OPERAÇÕES
        </p>
      </div>

      {/* ── Play button ── */}
      <button
        onClick={onPlay}
        style={{
          marginBottom:  52,
          padding:       '18px 60px',
          fontSize:      22,
          fontWeight:    900,
          letterSpacing: '0.22em',
          ...MONO,
          background:    'rgba(0,212,255,0.07)',
          border:        '2px solid #00d4ff',
          color:         '#00d4ff',
          borderRadius:  8,
          cursor:        'pointer',
          animation:     'play-pulse 1.8s ease-in-out infinite',
          transition:    'background 0.18s, transform 0.12s',
          textTransform: 'uppercase',
          position:      'relative',
          zIndex:         1,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background  = 'rgba(0,212,255,0.18)';
          e.currentTarget.style.transform   = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background  = 'rgba(0,212,255,0.07)';
          e.currentTarget.style.transform   = 'scale(1)';
        }}
      >
        ▶&nbsp;&nbsp;JOGAR
      </button>

      {/* ── Leaderboard ── */}
      <div style={{ width: '100%', maxWidth: 580, position: 'relative', zIndex: 1 }}>

        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <p style={{
            margin:        0,
            fontSize:      10,
            color:         '#ffd700',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
          }}>
            🏆&nbsp;&nbsp;TOP 10 LÓGICOS&nbsp;&nbsp;🏆
          </p>
          <div style={{
            height:     1,
            margin:     '10px 0 0',
            background: 'linear-gradient(90deg, transparent, #ffd70044, transparent)',
          }} />
        </div>

        {scores.length === 0 ? (
          <div style={{
            textAlign:   'center',
            padding:     '36px 20px',
            color:       '#1e3a5a',
            fontSize:    11,
            letterSpacing: '0.12em',
            border:      '1px solid #1e293b',
            borderRadius: 8,
            lineHeight:  1.8,
          }}>
            <div style={{ fontSize: 30, marginBottom: 12, opacity: 0.4 }}>📋</div>
            SEM RECORDES AINDA<br />
            <span style={{ fontSize: 9, color: '#0f1f2e' }}>
              SEJA O PRIMEIRO A ENTRAR PARA A HISTÓRIA
            </span>
          </div>
        ) : (
          <div style={{
            border:       '1px solid #1e3a5a',
            borderRadius: 10,
            overflow:     'hidden',
          }}>
            {/* Column headers */}
            <div style={{
              display:             'grid',
              gridTemplateColumns: '36px 1fr 110px 64px 94px',
              padding:             '8px 18px',
              background:          'rgba(0,212,255,0.05)',
              borderBottom:        '1px solid #1e3a5a',
            }}>
              {['#', 'NOME', 'PODER', 'NV.', 'DATA'].map(h => (
                <span key={h} style={{
                  fontSize:      9,
                  color:         '#334155',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Score rows */}
            {scores.map((s, i) => (
              <div key={i} style={{
                display:             'grid',
                gridTemplateColumns: '36px 1fr 110px 64px 94px',
                padding:             '11px 18px',
                borderBottom:        i < scores.length - 1 ? '1px solid #0d1a27' : 'none',
                animation:           `score-enter 0.3s ease ${i * 0.045}s both`,
                background: i === 0 ? 'rgba(255,215,0,0.04)'
                          : i === 1 ? 'rgba(192,192,192,0.03)'
                          : i === 2 ? 'rgba(205,127,50,0.03)'
                          : 'transparent',
                alignItems: 'center',
              }}>
                <span style={{
                  fontSize:  14,
                  fontWeight: 900,
                  color:     RANK_COLORS[i] ?? '#334155',
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize:      15,
                  fontWeight:    700,
                  color:         '#e2e8f0',
                  letterSpacing: '0.08em',
                  overflow:      'hidden',
                  textOverflow:  'ellipsis',
                  whiteSpace:    'nowrap',
                }}>
                  {s.name || 'AAA'}
                </span>
                <span style={{
                  fontSize:   15,
                  fontWeight: 900,
                  color:      RANK_COLORS[i] ?? '#64748b',
                }}>
                  {s.power.toLocaleString('pt-BR')}
                </span>
                <span style={{ fontSize: 11, color: '#a855f7' }}>
                  Nv.{s.stage}
                </span>
                <span style={{ fontSize: 9, color: '#253547' }}>
                  {s.date}
                </span>
              </div>
            ))}
          </div>
        )}

        <p style={{
          textAlign:     'center',
          marginTop:     18,
          fontSize:      9,
          color:         '#162030',
          letterSpacing: '0.14em',
        }}>
          SCORES SALVOS LOCALMENTE NO SEU NAVEGADOR
        </p>
      </div>
    </div>
  );
}
