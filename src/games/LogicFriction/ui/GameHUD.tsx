// ============================================================
// Logic Friction — Game HUD (2D Overlay)
// Sprint 5: Tower Selection, Upgrade Mode, Core Level Badge
// ============================================================
import { useEffect, useState } from 'react'
import { useGameStore } from '../state/useGameStore'
import type { ActionMode } from '../state/useGameStore'
import { TOWER_BLUEPRINTS, TOWER_BLUEPRINT_KEYS } from '../config/constants'
import { getLeaderboard, saveToLeaderboard } from '../state/leaderboard'
import type { LeaderboardEntry, GameStateSnapshot } from '../state/leaderboard'

// ── Props ───────────────────────────────────────────────────────────────────────
interface GameHUDProps {
  onStart: () => void    // Fullscreen + startGame (from orchestrator)
  onRestart: () => void  // Reset + fullscreen + startGame
}

// ── Stat Badge ──────────────────────────────────────────────────────────────────
function StatBadge({ label, value, color, icon }: {
  label: string; value: string | number; color: string; icon: string
}) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.8)',
      border: `1px solid ${color}40`,
      borderRadius: 8,
      padding: '6px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 80,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div>
        <div style={{
          fontSize: 9,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
        }}>{label}</div>
        <div style={{
          fontSize: 15,
          color,
          fontWeight: 800,
          fontFamily: "'Courier New', monospace",
        }}>{value}</div>
      </div>
    </div>
  )
}

// ── Buff Badge ───────────────────────────────────────────────────────────────────
// The Divine Buff now persists until WAVE_CLEAR (all enemies dead).
// No independent timer — deactivation is handled by the store.
function BuffBadge() {
  const isBuffActive = useGameStore(s => s.isBuffActive)

  if (!isBuffActive) return null

  return (
    <div style={{
      background: 'rgba(255,215,0,0.15)',
      border: '1px solid rgba(255,215,0,0.5)',
      borderRadius: 8,
      padding: '6px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minWidth: 120,
      animation: 'lf-buff-pulse 1.8s ease-in-out infinite',
      boxShadow: '0 0 15px rgba(255,215,0,0.2)',
      pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes lf-buff-pulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 15px rgba(255,215,0,0.2); }
          50% { opacity: 0.85; transform: scale(1.03); box-shadow: 0 0 25px rgba(255,215,0,0.45); }
        }
      `}</style>
      <span style={{ fontSize: 18, filter: 'drop-shadow(0 0 4px #ffd700)' }}>🪽</span>
      <div>
        <div style={{
          fontSize: 8,
          color: '#ffd700',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 800,
          fontFamily: "'Courier New', monospace",
        }}>BUFF DIVINO</div>
        <div style={{
          fontSize: 14,
          color: '#ffffff',
          fontWeight: 900,
          fontFamily: "'Courier New', monospace",
          letterSpacing: '0.05em',
        }}>
          ATIVO
        </div>
      </div>
    </div>
  )
}

// ── HP Bar ───────────────────────────────────────────────────────────────────────
function HPBar({ current, max, color, label }: {
  current: number; max: number; color: string; label: string
}) {
  const ratio = Math.max(0, current / max)
  return (
    <div style={{
      background: 'rgba(0,0,0,0.8)',
      border: `1px solid ${color}30`,
      borderRadius: 8,
      padding: '6px 12px',
      minWidth: 140,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 4,
      }}>
        <span style={{
          fontSize: 9,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
        }}>{label}</span>
        <span style={{
          fontSize: 13,
          color,
          fontWeight: 800,
          fontFamily: "'Courier New', monospace",
        }}>{current} / {max}</span>
      </div>
      <div style={{
        width: '100%',
        height: 6,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${ratio * 100}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          borderRadius: 3,
          transition: 'width 0.3s ease',
          boxShadow: `0 0 8px ${color}60`,
        }} />
      </div>
    </div>
  )
}

// ── Tower Selector Bar ──────────────────────────────────────────────────────────
function TowerSelector() {
  const selectedBlueprint = useGameStore(s => s.selectedBlueprint)
  const isUpgradeMode = useGameStore(s => s.isUpgradeMode)
  const coreLevel = useGameStore(s => s.coreLevel)
  const gold = useGameStore(s => s.gold)
  const setSelectedBlueprint = useGameStore(s => s.setSelectedBlueprint)
  const toggleUpgradeMode = useGameStore(s => s.toggleUpgradeMode)

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      pointerEvents: 'auto',
      background: 'rgba(4,4,14,0.95)',
      borderRadius: 12,
      padding: '6px 10px',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Blueprint buttons */}
      {TOWER_BLUEPRINT_KEYS.map(key => {
        const bp = TOWER_BLUEPRINTS[key]
        const isSelected = selectedBlueprint === key && !isUpgradeMode
        const canAfford = gold >= bp.cost
        return (
          <button
            key={key}
            onClick={() => {
              setSelectedBlueprint(key)
              if (isUpgradeMode) toggleUpgradeMode()
            }}
            style={{
              background: isSelected
                ? `${bp.color}30`
                : 'rgba(0,0,0,0.6)',
              border: `2px solid ${isSelected ? bp.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10,
              padding: '10px 18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.15s ease',
              opacity: canAfford ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: 28 }}>{bp.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: 18,
                color: isSelected ? bp.color : '#94a3b8',
                fontWeight: 800,
                fontFamily: "'Courier New', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>{bp.label}</div>
              <div style={{
                fontSize: 16,
                color: canAfford ? '#ffd700' : '#ff4444',
                fontFamily: "'Courier New', monospace",
                fontWeight: 700,
              }}>${bp.cost}</div>
            </div>
          </button>
        )
      })}

      {/* Divider */}
      <div style={{
        width: 1,
        background: 'rgba(255,255,255,0.1)',
        margin: '0 4px',
      }} />

      {/* Upgrade mode toggle */}
      <button
        onClick={toggleUpgradeMode}
        style={{
          background: isUpgradeMode
            ? 'rgba(0,255,136,0.2)'
            : 'rgba(0,0,0,0.6)',
          border: `2px solid ${isUpgradeMode ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10,
          padding: '10px 18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'all 0.15s ease',
          animation: isUpgradeMode ? 'lf-cta-glow 1.5s ease infinite' : 'none',
        }}
      >
        <span style={{ fontSize: 28 }}>🛠️</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontSize: 18,
            color: isUpgradeMode ? '#00ff88' : '#94a3b8',
            fontWeight: 800,
            fontFamily: "'Courier New', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>UPGRADE</div>
          <div style={{
            fontSize: 16,
            color: '#64748b',
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
          }}>BASE LV{coreLevel}</div>
        </div>
      </button>
    </div>
  )
}

// ── Main HUD ────────────────────────────────────────────────────────────────────
export function GameHUD({ onStart, onRestart }: GameHUDProps) {
  const phase = useGameStore(s => s.phase)
  const coreHp = useGameStore(s => s.coreHp)
  const maxCoreHp = useGameStore(s => s.maxCoreHp)
  const playerHp = useGameStore(s => s.playerHp)
  const maxPlayerHp = useGameStore(s => s.maxPlayerHp)
  const waveNumber = useGameStore(s => s.waveNumber)
  const gold = useGameStore(s => s.gold)
  const enemiesAlive = useGameStore(s => s.enemiesAlive)
  const isPlayerDead = useGameStore(s => s.isPlayerDead)
  const coreLevel = useGameStore(s => s.coreLevel)
  const actionMode = useGameStore(s => s.actionMode)
  const isPaused = useGameStore(s => s.isPaused)
  const setPaused = useGameStore(s => s.setPaused)

  if (phase === 'MENU') {
    return <StartScreen onStart={onStart} />
  }

  if (phase === 'GAME_OVER') {
    return <GameOverScreen wave={waveNumber} gold={gold} onRestart={onRestart} />
  }

  // Show pause menu overlay
  if (isPaused) {
    return <PauseMenu
      wave={waveNumber}
      gold={gold}
      onResume={() => setPaused(false)}
      onRestart={onRestart}
    />
  }

  return (
    <>
      {/* ── Settings Menu (top-right) ── */}
      <SettingsMenu />

      {/* Pause button (top-right, below settings) */}
      <div style={{
        position: 'absolute',
        top: 56,
        right: 12,
        zIndex: 200,
        pointerEvents: 'auto',
      }}>
        <button
          onClick={() => setPaused(true)}
          style={{
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: '8px 14px',
            color: '#94a3b8',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
            fontFamily: "'Courier New', monospace",
          }}
        >
          ⏸ <span style={{ fontSize: 12, letterSpacing: '0.08em' }}>PAUSAR</span>
        </button>
      </div>

      {/* Top HUD row */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 80,
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <HPBar current={coreHp} max={maxCoreHp} color="#00d4ff" label={`Core LV${coreLevel}`} />
        <HPBar
          current={playerHp}
          max={maxPlayerHp}
          color={isPlayerDead ? '#ff4444' : '#00ff88'}
          label={isPlayerDead ? 'Player 💀' : 'Player'}
        />
        <StatBadge label="Wave" value={waveNumber} color="#a855f7" icon="🌊" />
        <StatBadge label="Gold" value={gold} color="#ffd700" icon="💰" />
        <StatBadge label="Enemies" value={enemiesAlive} color="#ff4444" icon="👾" />
        <BuffBadge />
      </div>

      {/* Action Mode Toggle + Tower Selection Bar */}
      <div style={{
        position: 'absolute',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
      }}>
        <ActionModeToggle />
        {actionMode === 'BUILD' && <TowerSelector />}
      </div>

      {/* Wave Clear — auto-advance countdown banner */}
      {phase === 'WAVE_CLEAR' && <WaveCountdownBanner waveNumber={waveNumber} />}

      {/* Controls hint at bottom */}
      <ControlsHint />
    </>
  )
}
// ── Action Mode Toggle (MOVE / BUILD) ───────────────────────────────────────────
function ActionModeToggle() {
  const actionMode = useGameStore(s => s.actionMode)
  const setActionMode = useGameStore(s => s.setActionMode)

  const modes: Array<{ key: ActionMode; icon: string; label: string; color: string }> = [
    { key: 'MOVE',  icon: '🚶', label: 'MOVER',     color: '#00ff88' },
    { key: 'BUILD', icon: '🏗️', label: 'CONSTRUIR', color: '#ff8800' },
  ]

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      pointerEvents: 'auto',
      background: 'rgba(4,4,14,0.95)',
      borderRadius: 10,
      padding: 4,
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(8px)',
    }}>
      {modes.map(m => {
        const isActive = actionMode === m.key
        return (
          <button
            key={m.key}
            onClick={() => setActionMode(m.key)}
            style={{
              background: isActive
                ? `${m.color}20`
                : 'transparent',
              border: `2px solid ${isActive ? m.color : 'transparent'}`,
              borderRadius: 8,
              padding: '8px 18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <span style={{
              fontSize: 14,
              color: isActive ? m.color : '#64748b',
              fontWeight: 800,
              fontFamily: "'Courier New', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Wave Countdown Banner ───────────────────────────────────────────────────────
function WaveCountdownBanner({ waveNumber }: { waveNumber: number }) {
  const [countdown, setCountdown] = useState(4)

  useEffect(() => {
    setCountdown(4)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [waveNumber])

  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
      pointerEvents: 'none',
      textAlign: 'center',
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.75)',
        border: '2px solid rgba(0,255,136,0.35)',
        borderRadius: 14,
        padding: '14px 36px',
        fontFamily: "'Courier New', monospace",
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 30px rgba(0,255,136,0.2)',
        animation: 'lf-countdown-pulse 1s ease infinite',
      }}>
        <div style={{
          fontSize: 13,
          color: '#00ff88',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          marginBottom: 4,
        }}>
          ✓ Onda {waveNumber} Completa
        </div>
        <div style={{
          fontSize: 20,
          color: '#ffffff',
          fontWeight: 900,
          letterSpacing: '0.1em',
        }}>
          {countdown > 0
            ? `Próxima Onda em ${countdown}...`
            : `▶ Onda ${waveNumber + 1}!`
          }
        </div>
      </div>

      {/* Inline keyframes for the pulse animation */}
      <style>{`
        @keyframes lf-countdown-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.02); }
        }
      `}</style>
    </div>
  )
}

// ── Settings Menu ───────────────────────────────────────────────────────────────
function SettingsMenu() {
  const isMenuOpen = useGameStore(s => s.isMenuOpen)
  const isCameraFree = useGameStore(s => s.isCameraFree)
  const toggleMenu = useGameStore(s => s.toggleMenu)
  const toggleCameraFree = useGameStore(s => s.toggleCameraFree)
  const explanationLog = useGameStore(s => s.explanationLog)

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 200,
      pointerEvents: 'auto',
      fontFamily: "'Courier New', monospace",
    }}>
      {/* Gear button */}
      <button
        onClick={toggleMenu}
        style={{
          background: isMenuOpen
            ? 'rgba(0,212,255,0.25)'
            : 'rgba(0,0,0,0.8)',
          border: `1px solid ${isMenuOpen ? '#00d4ff60' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 10,
          padding: '8px 14px',
          color: isMenuOpen ? '#00d4ff' : '#94a3b8',
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s ease',
        }}
      >
        ⚙️ <span style={{ fontSize: 12, letterSpacing: '0.08em' }}>MENU</span>
      </button>

      {/* Dropdown panel */}
      {isMenuOpen && (
        <div style={{
          marginTop: 6,
          background: 'rgba(4,4,14,0.95)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          padding: 12,
          minWidth: 260,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <div style={{
            fontSize: 10,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            fontWeight: 700,
            marginBottom: 8,
          }}>
            Configurações
          </div>

          {/* Camera Free toggle */}
          <button
            onClick={toggleCameraFree}
            style={{
              width: '100%',
              background: isCameraFree
                ? 'rgba(0,255,136,0.12)'
                : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isCameraFree ? '#00ff8840' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: isCameraFree ? '#00ff88' : '#94a3b8',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.2s ease',
              fontFamily: "'Courier New', monospace",
            }}
          >
            <span>🎥 Câmera Livre</span>
            <span style={{
              fontSize: 14,
              fontWeight: 900,
            }}>
              {isCameraFree ? 'ON 🔓' : 'OFF 🔒'}
            </span>
          </button>

          {/* ── Answer Log (Log de Respostas) ── */}
          {explanationLog.length > 0 && (
            <>
              <div style={{
                fontSize: 13,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                fontWeight: 700,
                marginTop: 12,
                marginBottom: 6,
              }}>
                📝 Log de Respostas
              </div>
              <div style={{
                maxHeight: 320,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                {[...explanationLog].reverse().map((entry, i) => (
                  <div
                    key={`log-${entry.wave}-${i}`}
                    style={{
                      background: entry.wasCorrect
                        ? 'rgba(0,255,136,0.08)'
                        : 'rgba(255,68,68,0.08)',
                      border: `1px solid ${entry.wasCorrect ? '#00ff8830' : '#ff444430'}`,
                      borderRadius: 8,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                    }}>
                      <span style={{
                        fontSize: 14,
                        color: '#94a3b8',
                        fontWeight: 700,
                      }}>
                        Onda {entry.wave}
                      </span>
                      <span style={{
                        fontSize: 14,
                        color: entry.wasCorrect ? '#00ff88' : '#ff4444',
                        fontWeight: 800,
                      }}>
                        {entry.wasCorrect ? '✓ Correto' : '✗ Errado'}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 16,
                      color: '#c8d6e5',
                      fontWeight: 700,
                      marginBottom: 6,
                    }}>
                      {entry.question}
                    </div>
                    <div style={{
                      fontSize: 14,
                      color: '#64748b',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {entry.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Start Screen ────────────────────────────────────────────────────────────────
function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(4,4,14,0.85)',
      zIndex: 30,
      pointerEvents: 'auto',
    }}>
      <h1 style={{
        fontFamily: "'Orbitron', 'Courier New', monospace",
        fontSize: 'clamp(24px, 4vw, 42px)',
        color: '#00ff88',
        textShadow: '0 0 40px rgba(0,255,136,0.5)',
        margin: '0 0 12px',
        textAlign: 'center',
      }}>
        LOGIC FRICTION
      </h1>
      <p style={{
        color: '#64748b',
        fontSize: 14,
        margin: '0 0 32px',
        textAlign: 'center',
        maxWidth: 400,
      }}>
        Defenda o Core central contra ondas infinitas de inimigos.
        Pressione ESPAÇO para atacar.
      </p>
      <button
        onClick={onStart}
        style={{
          background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
          border: 'none',
          borderRadius: 12,
          padding: '16px 48px',
          color: '#000',
          fontFamily: "'Courier New', monospace",
          fontSize: 18,
          fontWeight: 800,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          boxShadow: '0 0 40px rgba(0,255,136,0.4)',
        }}
      >
        ⛶ INICIAR (TELA CHEIA)
      </button>
    </div>
  )
}

// ── Game Over Screen ──────────────────────────────────────────────────────────────
function GameOverScreen({ wave, gold, onRestart }: { wave: number; gold: number; onRestart: () => void }) {
  const [playerName, setPlayerName] = useState('')
  const [saved, setSaved] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(getLeaderboard())

  const handleSave = () => {
    if (saved) return
    const state = useGameStore.getState()
    const snapshot: GameStateSnapshot = {
      waveNumber: state.waveNumber,
      gold: state.gold,
      coreHp: state.coreHp,
      maxCoreHp: state.maxCoreHp,
      coreLevel: state.coreLevel,
      towers: state.towers,
      constructionSites: state.constructionSites,
    }
    saveToLeaderboard(playerName, wave, gold, snapshot)
    setLeaderboard(getLeaderboard())
    setSaved(true)
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10,2,2,0.9)',
      zIndex: 30,
      pointerEvents: 'auto',
      overflowY: 'auto',
      padding: '24px 16px',
    }}>
      <h1 style={{
        fontFamily: "'Orbitron', 'Courier New', monospace",
        fontSize: 'clamp(28px, 5vw, 48px)',
        color: '#ff4444',
        textShadow: '0 0 40px rgba(255,68,68,0.5)',
        margin: '0 0 16px',
      }}>
        CORE DESTRUÍDO
      </h1>
      <div style={{
        display: 'flex',
        gap: 24,
        margin: '0 0 24px',
      }}>
        <StatBadge label="Ondas" value={wave} color="#a855f7" icon="🌊" />
        <StatBadge label="Ouro" value={gold} color="#ffd700" icon="💰" />
      </div>

      {/* Name input + save */}
      {!saved ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 12,
            color: '#64748b',
            fontFamily: "'Courier New', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}>
            Digite seu nome para o ranking
          </div>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Seu nome..."
            maxLength={40}
            style={{
              background: 'rgba(0,0,0,0.8)',
              border: '2px solid #00d4ff40',
              borderRadius: 10,
              padding: '12px 20px',
              color: '#00d4ff',
              fontSize: 18,
              fontFamily: "'Courier New', monospace",
              fontWeight: 700,
              width: 300,
              textAlign: 'center',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#00d4ff'}
            onBlur={e => e.target.style.borderColor = '#00d4ff40'}
          />
          <button
            onClick={handleSave}
            style={{
              background: 'linear-gradient(135deg, #ffd700, #ff8800)',
              border: 'none',
              borderRadius: 10,
              padding: '10px 30px',
              color: '#000',
              fontFamily: "'Courier New', monospace",
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            💾 Salvar Pontuação
          </button>
        </div>
      ) : (
        <div style={{
          fontSize: 14,
          color: '#00ff88',
          fontFamily: "'Courier New', monospace",
          fontWeight: 700,
          marginBottom: 24,
        }}>
          ✓ Pontuação salva!
        </div>
      )}

      {/* Leaderboard */}
      <LeaderboardTable
        entries={leaderboard}
        onLoad={(snapshot) => useGameStore.getState().loadGameState(snapshot)}
      />

      <button
        onClick={onRestart}
        style={{
          marginTop: 20,
          background: 'linear-gradient(135deg, #ff4444, #ff8800)',
          border: 'none',
          borderRadius: 12,
          padding: '14px 40px',
          color: '#fff',
          fontFamily: "'Courier New', monospace",
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          boxShadow: '0 0 30px rgba(255,68,68,0.4)',
        }}
      >
        ↻ TENTAR NOVAMENTE
      </button>
    </div>
  )
}

// ── Controls Hint (auto-fades) ──────────────────────────────────────────────────
function ControlsHint() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      right: 12,
      background: 'rgba(0,0,0,0.7)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '8px 14px',
      color: '#475569',
      fontFamily: "'Courier New', monospace",
      fontSize: 11,
      zIndex: 10,
      pointerEvents: 'none',
      lineHeight: 1.6,
    }}>
      <strong style={{ color: '#00ff88' }}>WASD</strong> mover ·{' '}
      <strong style={{ color: '#ffffff' }}>ESPAÇO</strong> atacar
    </div>
  )
}

// ── Pause Menu ──────────────────────────────────────────────────────────────────
function PauseMenu({ wave, gold, onResume, onRestart }: {
  wave: number
  gold: number
  onResume: () => void
  onRestart: () => void
}) {
  const [showSave, setShowSave] = useState(false)
  const [showTop10, setShowTop10] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [saved, setSaved] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(getLeaderboard())
  const reset = useGameStore(s => s.reset)
  const loadGameState = useGameStore(s => s.loadGameState)

  const handleSaveAndExit = () => {
    const state = useGameStore.getState()
    const snapshot: GameStateSnapshot = {
      waveNumber: state.waveNumber,
      gold: state.gold,
      coreHp: state.coreHp,
      maxCoreHp: state.maxCoreHp,
      coreLevel: state.coreLevel,
      towers: state.towers,
      constructionSites: state.constructionSites,
    }
    saveToLeaderboard(playerName, wave, gold, snapshot)
    setLeaderboard(getLeaderboard())
    setSaved(true)
    setTimeout(() => {
      reset()
    }, 1200)
  }

  const btnStyle = (bg: string, color: string, border: string): React.CSSProperties => ({
    width: '100%',
    background: bg,
    border: `2px solid ${border}`,
    borderRadius: 10,
    padding: '14px 20px',
    color,
    fontFamily: "'Courier New', monospace",
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  })

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(4,4,14,0.92)',
      zIndex: 30,
      pointerEvents: 'auto',
      overflowY: 'auto',
      padding: '24px 16px',
    }}>
      <h1 style={{
        fontFamily: "'Orbitron', 'Courier New', monospace",
        fontSize: 'clamp(24px, 4vw, 36px)',
        color: '#00d4ff',
        textShadow: '0 0 30px rgba(0,212,255,0.4)',
        margin: '0 0 8px',
      }}>
        ⏸ JOGO PAUSADO
      </h1>
      <div style={{
        display: 'flex',
        gap: 16,
        margin: '0 0 24px',
      }}>
        <StatBadge label="Onda" value={wave} color="#a855f7" icon="🌊" />
        <StatBadge label="Ouro" value={gold} color="#ffd700" icon="💰" />
      </div>

      {/* Button stack */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 300,
        maxWidth: '90vw',
      }}>
        {/* Resume */}
        <button onClick={onResume} style={btnStyle('rgba(0,255,136,0.12)', '#00ff88', '#00ff8850')}>
          ▶ Continuar Jogo
        </button>

        {/* Save & Exit */}
        {!showSave ? (
          <button onClick={() => setShowSave(true)} style={btnStyle('rgba(255,215,0,0.1)', '#ffd700', '#ffd70040')}>
            💾 Salvar e Sair
          </button>
        ) : !saved ? (
          <div style={{
            background: 'rgba(0,0,0,0.6)',
            border: '2px solid #ffd70040',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{
              fontSize: 11,
              color: '#64748b',
              fontFamily: "'Courier New', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              Digite seu nome
            </div>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="Seu nome..."
              maxLength={40}
              style={{
                background: 'rgba(0,0,0,0.8)',
                border: '2px solid #00d4ff40',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#00d4ff',
                fontSize: 16,
                fontFamily: "'Courier New', monospace",
                fontWeight: 700,
                width: '100%',
                boxSizing: 'border-box',
                textAlign: 'center',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#00d4ff'}
              onBlur={e => e.target.style.borderColor = '#00d4ff40'}
            />
            <button
              onClick={handleSaveAndExit}
              style={{
                background: 'linear-gradient(135deg, #ffd700, #ff8800)',
                border: 'none',
                borderRadius: 8,
                padding: '10px',
                color: '#000',
                fontFamily: "'Courier New', monospace",
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              ✓ Confirmar e Sair
            </button>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            color: '#00ff88',
            fontSize: 14,
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
            padding: 12,
          }}>
            ✓ Salvo! Voltando ao menu...
          </div>
        )}

        {/* New Game */}
        <button onClick={onRestart} style={btnStyle('rgba(255,68,68,0.1)', '#ff4444', '#ff444440')}>
          🔄 Novo Jogo
        </button>

        {/* Top 10 toggle */}
        <button
          onClick={() => setShowTop10(!showTop10)}
          style={btnStyle(
            showTop10 ? 'rgba(0,212,255,0.15)' : 'rgba(0,212,255,0.05)',
            '#00d4ff',
            showTop10 ? '#00d4ff60' : '#00d4ff30'
          )}
        >
          🏆 TOP 10 {showTop10 ? '▲' : '▼'}
        </button>
      </div>

      {/* Leaderboard */}
      {showTop10 && (
        <div style={{ marginTop: 16, width: 340, maxWidth: '95vw' }}>
          <LeaderboardTable
            entries={leaderboard}
            onLoad={(snapshot) => loadGameState(snapshot)}
          />
        </div>
      )}
    </div>
  )
}

// ── Leaderboard Table (Retro Arcade) ────────────────────────────────────────────
function LeaderboardTable({ entries, onLoad }: { 
  entries: LeaderboardEntry[]
  onLoad?: (snapshot: GameStateSnapshot) => void 
}) {
  if (entries.length === 0) {
    return (
      <div style={{
        color: '#475569',
        fontSize: 13,
        fontFamily: "'Courier New', monospace",
        textAlign: 'center',
        padding: 16,
      }}>
        Nenhum recorde ainda. Jogue para entrar no ranking!
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(0,0,0,0.7)',
      border: '2px solid #00d4ff25',
      borderRadius: 12,
      padding: 14,
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{
        fontSize: 11,
        color: '#00d4ff',
        fontFamily: "'Courier New', monospace",
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        textAlign: 'center',
        marginBottom: 10,
        textShadow: '0 0 12px rgba(0,212,255,0.3)',
      }}>
        🏆 TOP 10 — RANKING LOCAL
      </div>

      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: onLoad ? '28px 1fr 50px 60px 44px' : '30px 1fr 60px 70px',
        gap: 6,
        padding: '4px 0',
        borderBottom: '1px solid #00d4ff20',
        marginBottom: 6,
      }}>
        {['#', 'NOME', 'ONDA', 'OURO', ...(onLoad ? [''] : [])].map((h, idx) => (
          <div key={`h-${idx}`} style={{
            fontSize: 9,
            color: '#475569',
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {entries.map((entry, i) => {
        const isGold = i === 0
        const isSilver = i === 1
        const isBronze = i === 2
        const rankColor = isGold ? '#ffd700' : isSilver ? '#c0c0c0' : isBronze ? '#cd7f32' : '#64748b'
        const nameColor = isGold ? '#ffd700' : '#c8d6e5'

        return (
          <div
            key={entry.id}
            style={{
              display: 'grid',
              gridTemplateColumns: onLoad ? '28px 1fr 50px 60px 44px' : '30px 1fr 60px 70px',
              gap: 6,
              padding: '6px 0',
              borderBottom: '1px solid #ffffff08',
              alignItems: 'center',
            }}
          >
            <div style={{
              fontSize: 14,
              color: rankColor,
              fontWeight: 900,
              fontFamily: "'Courier New', monospace",
            }}>
              {i + 1}
            </div>
            <div style={{
              fontSize: 13,
              color: nameColor,
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {entry.name}
            </div>
            <div style={{
              fontSize: 13,
              color: '#a855f7',
              fontWeight: 800,
              fontFamily: "'Courier New', monospace",
            }}>
              {entry.wave}
            </div>
            <div style={{
              fontSize: 13,
              color: '#ffd700',
              fontWeight: 800,
              fontFamily: "'Courier New', monospace",
            }}>
              ${entry.gold}
            </div>
            {onLoad && (
              <button
                onClick={() => entry.snapshot && onLoad(entry.snapshot)}
                disabled={!entry.snapshot}
                style={{
                  background: entry.snapshot
                    ? 'rgba(0,255,136,0.15)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${entry.snapshot ? '#00ff8840' : '#ffffff10'}`,
                  borderRadius: 6,
                  padding: '4px 6px',
                  color: entry.snapshot ? '#00ff88' : '#333',
                  fontSize: 12,
                  fontWeight: 900,
                  fontFamily: "'Courier New', monospace",
                  cursor: entry.snapshot ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                }}
              >
                ▶
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
