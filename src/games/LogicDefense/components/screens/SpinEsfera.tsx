import { useRef, useEffect, useState } from 'react'
import type { BuffType } from '../../types/game'
import { BUFF_DISPLAY } from '../../engine/constants'

interface SpinEsferaProps {
  onComplete: (buff: BuffType) => void
  isStressMode?: boolean
}

const BUFFS: BuffType[] = ['amor', 'odio', 'cadeira']

const BUFF_CONFIG: Record<BuffType, { emoji: string; label: string; subtitle: string; color: string; glow: string }> = {
  amor: {
    emoji: '❤️',
    label: 'AMOR',
    subtitle: '"O fogo tá sempre aceso"',
    color: '#00ff88',
    glow: '0 0 40px #00ff88, 0 0 80px rgba(0,255,136,0.4)',
  },
  odio: {
    emoji: '🔥',
    label: 'ÓDIO',
    subtitle: '"Vou desligar sua tomada"',
    color: '#ff4444',
    glow: '0 0 40px #ff4444, 0 0 80px rgba(255,68,68,0.4)',
  },
  cadeira: {
    emoji: '🪑',
    label: 'A CADEIRA',
    subtitle: '"Aceite a dor"',
    color: '#00d4ff',
    glow: '0 0 40px #00d4ff, 0 0 80px rgba(0,212,255,0.4)',
  },
}

// We build a long reel: [cadeira, amor, odio, cadeira, amor, odio, ...winner]
// The winner lands at a fixed slot at the end.
function buildReel(winner: BuffType): BuffType[] {
  const reel: BuffType[] = []
  for (let i = 0; i < 4; i++) {
    reel.push('cadeira', 'amor', 'odio')
  }
  reel.push(winner)
  return reel
}

const ITEM_HEIGHT = 100 // px per reel item

export function SpinEsfera({ onComplete, isStressMode = false }: SpinEsferaProps) {
  const winnerRef = useRef<BuffType>(BUFFS[Math.floor(Math.random() * BUFFS.length)])
  const reelRef = useRef<BuffType[]>(buildReel(winnerRef.current))
  const [spinning, setSpinning] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [translateY, setTranslateY] = useState(0)
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const winner = winnerRef.current
  const reel = reelRef.current
  const config = BUFF_CONFIG[winner]
  const displayMeta = BUFF_DISPLAY[winner]

  const finalY = -(reel.length - 1) * ITEM_HEIGHT

  useEffect(() => {
    if (isStressMode) {
      onComplete(winner)
      return
    }
    const startDelay = setTimeout(() => {
      setSpinning(true)
      setTranslateY(finalY)

      spinTimeoutRef.current = setTimeout(() => {
        setRevealed(true)
        spinTimeoutRef.current = setTimeout(() => {
          onComplete(winner)
        }, 2300)
      }, 3000)
    }, 250)

    return () => {
      clearTimeout(startDelay)
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.92)', zIndex: 300,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Title */}
      <h2 style={{
        color: '#00d4ff', fontSize: 22, letterSpacing: 4, marginBottom: 6,
        fontFamily: "'Courier New', monospace", textShadow: '0 0 15px #00d4ff',
        textTransform: 'uppercase',
      }}>
        SPIN ESFERA
      </h2>
      <p style={{
        color: '#aaa', fontSize: 13, marginBottom: 22,
        fontFamily: "'Courier New', monospace",
      }}>
        O destino tático está sendo calculado...
      </p>

      {/* Roulette container */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 260,
          height: ITEM_HEIGHT,
          overflow: 'hidden',
          border: `2px solid ${revealed ? config.color : '#444'}`,
          borderRadius: 12,
          boxShadow: revealed ? config.glow : '0 0 20px rgba(0,212,255,0.2)',
          transition: 'border-color 0.3s, box-shadow 0.3s',
          position: 'relative',
          background: 'rgba(0,0,0,0.8)',
        }}>
          <div
            style={{
              transform: `translateY(${translateY}px)`,
              transition: spinning
                ? `transform 2.9s cubic-bezier(0.15, 1, 0.4, 1)`
                : 'none',
            }}
          >
            {reel.map((buff, i) => {
              const bc = BUFF_CONFIG[buff]
              const isWinner = i === reel.length - 1
              return (
                <div
                  key={i}
                  style={{
                    height: ITEM_HEIGHT,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    fontFamily: "'Courier New', monospace",
                    color: isWinner && revealed ? bc.color : '#ccc',
                    textShadow: isWinner && revealed ? `0 0 20px ${bc.color}` : 'none',
                    transition: 'color 0.3s, text-shadow 0.3s',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 36 }}>{bc.emoji}</span>
                  <span style={{ fontSize: 16, fontWeight: 'bold', letterSpacing: 2 }}>{bc.label}</span>
                </div>
              )
            })}
          </div>

          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            borderTop: `2px solid ${revealed ? config.color : 'rgba(255,255,255,0.15)'}`,
            borderBottom: `2px solid ${revealed ? config.color : 'rgba(255,255,255,0.15)'}`,
            transition: 'border-color 0.3s',
          }} />
        </div>

        <div style={{
          position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)',
          color: revealed ? config.color : '#555', fontSize: 20, transition: 'color 0.3s',
        }}>▶</div>
        <div style={{
          position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)',
          color: revealed ? config.color : '#555', fontSize: 20, transition: 'color 0.3s',
        }}>◀</div>
      </div>

      {/* Result label + Mechanical Perks */}
      {revealed && (
        <div style={{
          marginTop: 22,
          textAlign: 'center',
          animation: 'spinReveal 0.35s ease-out',
          maxWidth: 440,
        }}>
          <div style={{
            color: config.color, fontSize: 24, fontWeight: 'bold',
            fontFamily: "'Courier New', monospace", letterSpacing: 3,
            textShadow: config.glow,
          }}>
            {config.emoji} {config.label} ATIVADO!
          </div>
          <div style={{ color: '#aaa', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
            {config.subtitle}
          </div>

          {/* Real Mechanical Perks */}
          <div style={{
            marginTop: 12,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${config.color}55`,
            borderRadius: 8,
            padding: '10px 14px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}>
            {displayMeta.perks.map((perk, idx) => (
              <div key={idx} style={{
                fontSize: 11,
                color: '#e2e8f0',
                fontFamily: "'Courier New', monospace",
                lineHeight: 1.35,
              }}>
                <span style={{ color: config.color, fontWeight: 'bold' }}>▸ </span>
                {perk}
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current)
              onComplete(winner)
            }}
            style={{
              marginTop: 14,
              background: `${config.color}22`,
              border: `1px solid ${config.color}`,
              color: config.color,
              fontFamily: "'Courier New', monospace",
              fontSize: 12,
              fontWeight: 'bold',
              padding: '7px 18px',
              borderRadius: 6,
              cursor: 'pointer',
              letterSpacing: 1.5,
            }}
          >
            ⚡ CONTINUAR AGORA
          </button>
        </div>
      )}

      {/* Sphere decoration */}
      <div style={{ position: 'absolute', opacity: 0.04, pointerEvents: 'none', bottom: 40 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="55" stroke="#00d4ff" strokeWidth="1" fill="none" />
          <ellipse cx="60" cy="60" rx="55" ry="20" stroke="#00d4ff" strokeWidth="0.5" fill="none" />
          <ellipse cx="60" cy="60" rx="20" ry="55" stroke="#00d4ff" strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      <style>{`
        @keyframes spinReveal {
          from { opacity: 0; transform: scale(0.8) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

