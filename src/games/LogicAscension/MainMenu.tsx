import { useState, useEffect, CSSProperties } from 'react';
import { getHighScores, HighScore } from './leaderboard';
import { formatPower } from './utils';

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
`;

// ── Reusable style pieces ─────────────────────────────────────────────────────
const MONO: CSSProperties = { fontFamily: "'Courier New', monospace" };

const RANK_COLORS: string[] = ['#ffd700', '#c0c0c0', '#cd7f32'];

// ── Component ─────────────────────────────────────────────────────────────────
interface MainMenuProps {
  onPlay: (fullscreen?: boolean) => void;
}

export function MainMenu({ onPlay }: MainMenuProps) {
  const [scores, setScores] = useState<HighScore[]>([]);

  useEffect(() => {
    setScores(getHighScores());
  }, []);

  return (
    <div style={{
      position:       'relative',
      width:          '100%',
      minHeight:      620,
      background:     '#07070f',
      ...MONO,
      color:          '#e2e8f0',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '36px 16px 44px',
      boxSizing:      'border-box',
      overflow:       'hidden',
    }}>
      <style>{MENU_STYLES}</style>

      {/* ── Decorative grid overlay (scoped to container) ── */}
      <div style={{
        position:   'absolute',
        inset:       0,
        backgroundImage:
          'linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), ' +
          'linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Title block ── */}
      <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative', zIndex: 1 }}>
        <p style={{
          margin:          '0 0 8px',
          fontSize:        10,
          letterSpacing:   '0.35em',
          color:           '#00d4ff99',
          textTransform:   'uppercase',
        }}>
          ◈ &nbsp; H E I S S - L A B &nbsp; · &nbsp; R O G U E L I K E &nbsp; M A T E M Á T I C O &nbsp; ◈
        </p>

        <h2 style={{
          margin:        '0 0 8px',
          fontSize:      'clamp(34px, 7vw, 60px)',
          fontWeight:    900,
          letterSpacing: '0.08em',
          lineHeight:    1.05,
          animation:     'title-glow 2.6s ease-in-out infinite',
          textTransform: 'uppercase',
          ...MONO,
        }}>
          LOGIC ASCENSION
        </h2>

        <p style={{
          margin:        '8px auto 0',
          fontSize:      12,
          color:         '#94a3b8',
          letterSpacing: '0.08em',
          maxWidth:      520,
          lineHeight:    1.6,
        }}>
          Domine a Matemática Básica do dia a dia por <strong style={{ color: '#00d4ff' }}>3 caminhos diferentes</strong>,
          consulte o <strong style={{ color: '#ffd700' }}>Oráculo</strong> e acumule poder na Masmorra Infinita!
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          {[
            ['🧠', '3 Maneiras de Resolver'],
            ['🔮', 'Oráculo Estratégico'],
            ['🔥', 'Combo Streak + Bônus'],
            ['⌨️', 'WASD + Teclas [1]-[4]'],
          ].map(([icon, text]) => (
            <span key={text} style={{
              fontSize: 11, color: '#cbd5e1',
              background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: 100, padding: '4px 12px',
            }}>
              {icon} {text}
            </span>
          ))}
        </div>
      </div>

      {/* ── Play buttons ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => onPlay(true)}
          style={{
            padding:       '15px 40px',
            fontSize:      18,
            fontWeight:    900,
            letterSpacing: '0.16em',
            ...MONO,
            background:    'rgba(0,212,255,0.12)',
            border:        '2px solid #00d4ff',
            color:         '#00d4ff',
            borderRadius:  8,
            cursor:        'pointer',
            animation:     'play-pulse 1.8s ease-in-out infinite',
            transition:    'background 0.18s, transform 0.12s',
            textTransform: 'uppercase',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background  = 'rgba(0,212,255,0.24)';
            e.currentTarget.style.transform   = 'scale(1.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background  = 'rgba(0,212,255,0.12)';
            e.currentTarget.style.transform   = 'scale(1)';
          }}
        >
          ▶&nbsp;&nbsp;JOGAR (TELA CHEIA)
        </button>

        <button
          onClick={() => onPlay(false)}
          style={{
            padding:       '15px 24px',
            fontSize:      13,
            fontWeight:    700,
            letterSpacing: '0.12em',
            ...MONO,
            background:    'rgba(255,255,255,0.03)',
            border:        '1px solid #334155',
            color:         '#94a3b8',
            borderRadius:  8,
            cursor:        'pointer',
            transition:    'all 0.18s',
            textTransform: 'uppercase',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#00d4ff88';
            e.currentTarget.style.color       = '#e2e8f0';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#334155';
            e.currentTarget.style.color       = '#94a3b8';
          }}
        >
          ▶ Jogar na Janela
        </button>
      </div>

      {/* ── Leaderboard ── */}
      <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <p style={{
            margin:        0,
            fontSize:      11,
            color:         '#ffd700',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            fontWeight:    700,
          }}>
            🏆&nbsp;&nbsp;TOP 10 LÓGICOS&nbsp;&nbsp;🏆
          </p>
          <div style={{
            height:     1,
            margin:     '8px 0 0',
            background: 'linear-gradient(90deg, transparent, #ffd70044, transparent)',
          }} />
        </div>

        {scores.length === 0 ? (
          <div style={{
            textAlign:     'center',
            padding:       '24px 20px',
            color:         '#475569',
            fontSize:      12,
            letterSpacing: '0.1em',
            border:        '1px solid #1e293b',
            borderRadius:  8,
            background:    'rgba(0,0,0,0.35)',
            lineHeight:    1.7,
          }}>
            📋 SEM RECORDES SALVOS AINDA<br />
            <span style={{ fontSize: 10, color: '#64748b' }}>
              Derrote os monstros, vença o Boss e grave seu nome no Placar!
            </span>
          </div>
        ) : (
          <div style={{
            border:       '1px solid #1e3a5a',
            borderRadius: 10,
            overflow:     'hidden',
            background:   'rgba(4,8,18,0.8)',
          }}>
            <div style={{
              display:             'grid',
              gridTemplateColumns: '36px 1fr 110px 64px 94px',
              padding:             '8px 16px',
              background:          'rgba(0,212,255,0.06)',
              borderBottom:        '1px solid #1e3a5a',
            }}>
              {['#', 'NOME', 'PODER', 'NV.', 'DATA'].map(h => (
                <span key={h} style={{
                  fontSize:      9,
                  color:         '#64748b',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}>
                  {h}
                </span>
              ))}
            </div>

            {scores.map((s, i) => (
              <div key={i} style={{
                display:             'grid',
                gridTemplateColumns: '36px 1fr 110px 64px 94px',
                padding:             '10px 16px',
                borderBottom:        i < scores.length - 1 ? '1px solid #0d1a27' : 'none',
                animation:           `score-enter 0.3s ease ${i * 0.045}s both`,
                background: i === 0 ? 'rgba(255,215,0,0.05)'
                          : i === 1 ? 'rgba(192,192,192,0.03)'
                          : i === 2 ? 'rgba(205,127,50,0.03)'
                          : 'transparent',
                alignItems: 'center',
              }}>
                <span style={{
                  fontSize:  14,
                  fontWeight: 900,
                  color:     RANK_COLORS[i] ?? '#475569',
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize:      14,
                  fontWeight:    700,
                  color:         '#e2e8f0',
                  letterSpacing: '0.06em',
                  overflow:      'hidden',
                  textOverflow:  'ellipsis',
                  whiteSpace:    'nowrap',
                }}>
                  {s.name || 'AAA'}
                </span>
                <span style={{
                  fontSize:   14,
                  fontWeight: 900,
                  color:      RANK_COLORS[i] ?? '#38bdf8',
                }}>
                  {formatPower(s.power)}
                </span>
                <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 700 }}>
                  Nv.{s.stage}
                </span>
                <span style={{ fontSize: 10, color: '#475569' }}>
                  {s.date}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
