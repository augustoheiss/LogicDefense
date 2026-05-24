// ============================================================
// Logic Friction — Game HUD (2D Overlay)
// Sprint 5: Tower Selection, Upgrade Mode, Core Level Badge
// ============================================================
import { useEffect, useState } from 'react'
import { useGameStore } from '../state/useGameStore'
import type { ActionMode } from '../state/useGameStore'
import { TOWER_BLUEPRINTS, TOWER_BLUEPRINT_KEYS } from '../config/constants'

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
      position: 'absolute',
      top: 70,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
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
  const isBuffActive = useGameStore(s => s.isBuffActive)
  const showExplanation = useGameStore(s => s.showExplanation)
  const currentProblem = useGameStore(s => s.currentProblem)
  const coreLevel = useGameStore(s => s.coreLevel)
  const nextWave = useGameStore(s => s.nextWave)
  const actionMode = useGameStore(s => s.actionMode)

  if (phase === 'MENU') {
    return <StartScreen onStart={onStart} />
  }

  if (phase === 'GAME_OVER') {
    return <GameOverScreen wave={waveNumber} gold={gold} onRestart={onRestart} />
  }

  return (
    <>
      {/* ── Settings Menu (top-right) ── */}
      <SettingsMenu />

      {/* Top HUD row */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
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
        {isBuffActive && (
          <div style={{
            background: 'rgba(255,215,0,0.15)',
            border: '1px solid rgba(255,215,0,0.5)',
            borderRadius: 8,
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            animation: 'lf-cta-glow 1.5s ease infinite',
          }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <span style={{
              fontSize: 11,
              color: '#ffd700',
              fontWeight: 800,
              fontFamily: "'Courier New', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>BUFF DIVINO</span>
          </div>
        )}
      </div>

      {/* Action Mode Toggle + Tower Selection Bar */}
      <ActionModeToggle />
      {actionMode === 'BUILD' && <TowerSelector />}

      {/* Wave Clear overlay */}
      {phase === 'WAVE_CLEAR' && (
        <div style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          pointerEvents: 'auto',
        }}>
          <button
            onClick={nextWave}
            style={{
              background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
              border: 'none',
              borderRadius: 12,
              padding: '14px 36px',
              color: '#000',
              fontFamily: "'Courier New', monospace",
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              boxShadow: '0 0 30px rgba(0,255,136,0.4)',
              animation: 'lf-cta-glow 1.5s ease infinite',
            }}
          >
            ▶ Próxima Onda (Wave {waveNumber + 1})
          </button>
        </div>
      )}

      {/* Controls hint at bottom */}
      <ControlsHint />


      {/* Explanation panel — bottom-left, large font for readability */}
      {showExplanation && currentProblem && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          zIndex: 15,
          pointerEvents: 'auto',
          maxWidth: 560,
          width: '45%',
          minWidth: 300,
        }}>
          <div style={{
            background: isBuffActive ? 'rgba(0,255,136,0.12)' : 'rgba(255,68,68,0.12)',
            border: `2px solid ${isBuffActive ? 'rgba(0,255,136,0.4)' : 'rgba(255,68,68,0.4)'}`,
            borderRadius: 14,
            padding: '18px 24px',
            maxHeight: '40vh',
            overflowY: 'auto',
            backdropFilter: 'blur(6px)',
          }}>
            <div style={{
              fontSize: 22,
              color: isBuffActive ? '#00ff88' : '#ff4444',
              fontWeight: 800,
              fontFamily: "'Courier New', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 10,
              textShadow: '0 2px 6px rgba(0,0,0,0.8)',
            }}>
              {isBuffActive ? '✓ Correto! Buff Divino Ativado' : '✗ Resposta Errada'}
            </div>
            <div style={{
              fontSize: 20,
              color: '#c8d6e5',
              fontFamily: "'Courier New', monospace",
              fontWeight: 600,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              textShadow: '0 1px 4px rgba(0,0,0,0.7)',
            }}>
              {currentProblem.explanation}
            </div>
          </div>
        </div>
      )}
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
      position: 'absolute',
      top: 130,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
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

// ── Settings Menu ───────────────────────────────────────────────────────────────
function SettingsMenu() {
  const isMenuOpen = useGameStore(s => s.isMenuOpen)
  const isCameraFree = useGameStore(s => s.isCameraFree)
  const toggleMenu = useGameStore(s => s.toggleMenu)
  const toggleCameraFree = useGameStore(s => s.toggleCameraFree)

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
          minWidth: 200,
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

// ── Game Over Screen ────────────────────────────────────────────────────────────
function GameOverScreen({ wave, gold, onRestart }: { wave: number; gold: number; onRestart: () => void }) {
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
        margin: '0 0 32px',
      }}>
        <StatBadge label="Ondas" value={wave} color="#a855f7" icon="🌊" />
        <StatBadge label="Ouro" value={gold} color="#ffd700" icon="💰" />
      </div>
      <button
        onClick={onRestart}
        style={{
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
