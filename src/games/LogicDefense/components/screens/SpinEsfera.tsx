import { useRef, useEffect, useState } from 'react'
import type { BuffType } from '../../types/game'

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
    color: '#00ff00',
    glow: '0 0 40px #00ff00, 0 0 80px rgba(0,255,0,0.4)',
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
  // 4 full cycles before slowing down
  for (let i = 0; i < 4; i++) {
    reel.push('cadeira', 'amor', 'odio')
  }
  // End on winner
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

  // Final translateY to land winner in the center of the viewport
  const finalY = -(reel.length - 1) * ITEM_HEIGHT

  useEffect(() => {
    if (isStressMode) {
      onComplete(winner)
      return
    }
    // Short delay then start spin
    const startDelay = setTimeout(() => {
      setSpinning(true)
      setTranslateY(finalY)

      // After spin animation (~3s) reveal result
      spinTimeoutRef.current = setTimeout(() => {
        setRevealed(true)
        // After 1.2s showing result, call onComplete
        spinTimeoutRef.current = setTimeout(() => {
          onComplete(winner)
        }, 1200)
      }, 3200)
    }, 300)

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
      }}
    >
      {/* Title */}
      <h2 style={{
        color: '#00d4ff', fontSize: 22, letterSpacing: 4, marginBottom: 8,
        fontFamily: "'Courier New', monospace", textShadow: '0 0 15px #00d4ff',
        textTransform: 'uppercase',
      }}>
        SPIN ESFERA
      </h2>
      <p style={{
        color: '#aaa', fontSize: 13, marginBottom: 30,
        fontFamily: "'Courier New', monospace",
      }}>
        O destino está sendo calculado...
      </p>

      {/* Roulette container */}
      <div style={{ position: 'relative' }}>
        {/* Viewport window */}
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
          {/* Reel strip */}
          <div
            style={{
              transform: `translateY(${translateY}px)`,
              transition: spinning
                ? `transform 3s cubic-bezier(0.15, 1, 0.4, 1)`
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

          {/* Center highlight lines */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            borderTop: `2px solid ${revealed ? config.color : 'rgba(255,255,255,0.15)'}`,
            borderBottom: `2px solid ${revealed ? config.color : 'rgba(255,255,255,0.15)'}`,
            transition: 'border-color 0.3s',
          }} />
        </div>

        {/* Side arrows */}
        <div style={{
          position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)',
          color: revealed ? config.color : '#555', fontSize: 20, transition: 'color 0.3s',
        }}>▶</div>
        <div style={{
          position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)',
          color: revealed ? config.color : '#555', fontSize: 20, transition: 'color 0.3s',
        }}>◀</div>
      </div>

      {/* Result label */}
      {revealed && (
        <div style={{
          marginTop: 30,
          textAlign: 'center',
          animation: 'spinReveal 0.4s ease-out',
        }}>
          <div style={{
            color: config.color, fontSize: 28, fontWeight: 'bold',
            fontFamily: "'Courier New', monospace", letterSpacing: 3,
            textShadow: config.glow,
          }}>
            {config.emoji} {config.label} ATIVADO!
          </div>
          <div style={{ color: '#aaa', fontSize: 13, marginTop: 6, fontStyle: 'italic' }}>
            {config.subtitle}
          </div>
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
