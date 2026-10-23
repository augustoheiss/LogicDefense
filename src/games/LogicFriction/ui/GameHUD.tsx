// ============================================================
// Logic Friction — Game HUD (2D Overlay)
// Sprint 5: Tower Selection, Upgrade Mode, Core Level Badge
// ============================================================
import { useEffect, useState } from 'react'
import { useGameStore } from '../state/useGameStore'
import type { ActionMode } from '../state/useGameStore'
import {
  TOWER_BLUEPRINTS,
  TOWER_BLUEPRINT_KEYS,
  MATH_ZONE_POSITIONS,
  CORE_UPGRADE_BASE_COST,
  TOWER_RELOCATE_COST,
  TOWER_RELOCATE_MIN,
} from '../config/constants'
import type { MathZoneDir } from '../config/constants'
import { getLeaderboard, saveToLeaderboard } from '../state/leaderboard'
import type { LeaderboardEntry, GameStateSnapshot } from '../state/leaderboard'
import { LandingPage } from './LandingPage'
import { getLiveCameraAngles } from '../hooks/useTouchCameraGate'

// ── Props ───────────────────────────────────────────────────────────────────────
interface GameHUDProps {
  onStart: () => void    // Fullscreen + startGame (from orchestrator)
  onRestart: () => void  // Reset + fullscreen + startGame
}

function useIsMobileViewport(breakpoint = 680): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}

// ── Stat Badge ──────────────────────────────────────────────────────────────────
function StatBadge({ label, value, color, icon, compact = false }: {
  label: string; value: string | number; color: string; icon: string; compact?: boolean
}) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.8)',
      border: `1px solid ${color}40`,
      borderRadius: 8,
      padding: compact ? '4px 8px' : '6px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: compact ? 5 : 8,
      minWidth: compact ? 52 : 80,
    }}>
      <span style={{ fontSize: compact ? 13 : 16 }}>{icon}</span>
      <div>
        <div style={{
          fontSize: compact ? 8 : 9,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
        }}>{label}</div>
        <div style={{
          fontSize: compact ? 12 : 15,
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
          ATIVO (2X DANO + AOE)
        </div>
      </div>
    </div>
  )
}

// ── HP Bar ───────────────────────────────────────────────────────────────────────
function HPBar({ current, max, color, label, compact = false }: {
  current: number; max: number; color: string; label: string; compact?: boolean
}) {
  const ratio = Math.max(0, current / max)
  return (
    <div style={{
      background: 'rgba(0,0,0,0.8)',
      border: `1px solid ${color}30`,
      borderRadius: 8,
      padding: compact ? '4px 8px' : '6px 12px',
      minWidth: compact ? 105 : 140,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 4,
      }}>
        <span style={{
          fontSize: compact ? 8 : 9,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
        }}>{label}</span>
        <span style={{
          fontSize: compact ? 11 : 13,
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

// ── Math Compass & Quick-Navigate Bar ───────────────────────────────────────────
const DIRECTION_LABELS: Record<MathZoneDir, { name: string; arrow: string }> = {
  N: { name: 'NORTE', arrow: '⬆️' },
  S: { name: 'SUL',   arrow: '⬇️' },
  E: { name: 'LESTE', arrow: '➡️' },
  W: { name: 'OESTE', arrow: '⬅️' },
}

function MathCompassBar() {
  const phase = useGameStore(s => s.phase)
  const currentProblem = useGameStore(s => s.currentProblem)
  const mathAnswered = useGameStore(s => s.mathAnswered)
  const mathZonePosition = useGameStore(s => s.mathZonePosition)
  const setMoveTarget = useGameStore(s => s.setMoveTarget)
  const setActionMode = useGameStore(s => s.setActionMode)
  const isMobile = useIsMobileViewport()

  if (phase !== 'PLAYING' || !currentProblem || mathAnswered) return null

  const dirInfo = DIRECTION_LABELS[mathZonePosition]
  const zonePos = MATH_ZONE_POSITIONS[mathZonePosition]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? 6 : 10,
      background: 'rgba(4,8,24,0.92)',
      border: '1px solid rgba(0,212,255,0.45)',
      borderRadius: 10,
      padding: isMobile ? '5px 10px' : '6px 14px',
      pointerEvents: 'auto',
      boxShadow: '0 0 20px rgba(0,212,255,0.2)',
      fontFamily: "'Courier New', monospace",
      maxWidth: 'calc(100vw - 16px)',
      boxSizing: 'border-box',
    }}>
      <span style={{
        fontSize: isMobile ? 11 : 12,
        color: '#ffd700',
        fontWeight: 800,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}>
        🧭 {dirInfo.arrow} {dirInfo.name}
      </span>
      <span style={{
        fontSize: isMobile ? 13 : 15,
        color: '#00d4ff',
        fontWeight: 900,
        background: 'rgba(0,212,255,0.12)',
        padding: isMobile ? '2px 6px' : '2px 8px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
      }}>
        {currentProblem.expression}
      </span>
      <button
        onClick={() => {
          setActionMode('MOVE')
          setMoveTarget({ type: 'point', x: zonePos[0], z: zonePos[2] })
        }}
        style={{
          background: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(0,212,255,0.25))',
          border: '1px solid #ffd700',
          borderRadius: 7,
          padding: isMobile ? '4px 8px' : '4px 10px',
          color: '#ffd700',
          fontSize: isMobile ? 10 : 11,
          fontWeight: 800,
          fontFamily: "'Courier New', monospace",
          cursor: 'pointer',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        ⚡ Ir para Equação
      </button>
    </div>
  )
}

// ── Pedagogical Insight Toast (Bottom-Left) ─────────────────────────────────────
function PedagogicalInsightToast() {
  const lastMathReward = useGameStore(s => s.lastMathReward)
  const dismissMathReward = useGameStore(s => s.dismissMathReward)
  const isMobile = useIsMobileViewport()

  useEffect(() => {
    if (!lastMathReward) return
    const timer = setTimeout(() => {
      dismissMathReward()
    }, 7500)
    return () => clearTimeout(timer)
  }, [lastMathReward?.id, dismissMathReward])

  if (!lastMathReward) return null

  const isCorrect = lastMathReward.wasCorrect
  const accent = isCorrect ? '#00ff88' : '#ffaa00'

  return (
    <div style={{
      position: 'absolute',
      bottom: isMobile ? 124 : 68,
      left: 16,
      maxWidth: 420,
      width: 'calc(100vw - 32px)',
      background: 'rgba(4,8,20,0.94)',
      border: `2px solid ${accent}`,
      borderRadius: 12,
      padding: '12px 16px',
      zIndex: 150,
      pointerEvents: 'auto',
      fontFamily: "'Courier New', monospace",
      boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 20px ${accent}33`,
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 900,
          color: accent,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {isCorrect
            ? `✓ ATALHO MENTAL (+$${lastMathReward.goldBonus} OURO · STREAK x${lastMathReward.streak})`
            : '⚠️ ARMADILHA COGNITIVA (+15% REPARO CORE)'}
        </div>
        <button
          onClick={dismissMathReward}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: 14,
            fontWeight: 900,
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: 800,
        color: '#ffffff',
        marginBottom: 4,
      }}>
        {lastMathReward.question}
      </div>
      <div style={{
        fontSize: 12,
        color: '#cbd5e1',
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
      }}>
        {lastMathReward.explanation}
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
  const upgradeCore = useGameStore(s => s.upgradeCore)
  const isMobile = useIsMobileViewport()
  const coreUpgradeCost = coreLevel * CORE_UPGRADE_BASE_COST
  const canAffordCore = gold >= coreUpgradeCost

  return (
    <div style={{
      display: 'flex',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
      justifyContent: 'center',
      gap: isMobile ? 4 : 6,
      maxWidth: 'calc(100vw - 16px)',
      pointerEvents: 'auto',
      background: 'rgba(4,4,14,0.92)',
      borderRadius: 10,
      padding: isMobile ? '4px 6px' : '5px 8px',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Blueprint buttons */}
      {TOWER_BLUEPRINT_KEYS.map((key, idx) => {
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
              borderRadius: 8,
              padding: isMobile ? '4px 7px' : '5px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 4 : 7,
              transition: 'all 0.15s ease',
              opacity: canAfford ? 1 : 0.5,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: isMobile ? 15 : 18 }}>{bp.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: isMobile ? 10 : 12,
                color: isSelected ? bp.color : '#94a3b8',
                fontWeight: 800,
                fontFamily: "'Courier New', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>[{idx + 1}] {bp.label}</div>
              <div style={{
                fontSize: isMobile ? 10 : 12,
                color: canAfford ? '#ffd700' : '#ff4444',
                fontFamily: "'Courier New', monospace",
                fontWeight: 700,
              }}>${bp.cost}</div>
            </div>
          </button>
        )
      })}

      {/* Divider */}
      {!isMobile && (
        <div style={{
          width: 1,
          background: 'rgba(255,255,255,0.1)',
          margin: '0 2px',
        }} />
      )}

      {/* Upgrade mode toggle */}
      <button
        data-testid="hud-toggle-upgrade-mode-btn"
        onClick={toggleUpgradeMode}
        style={{
          background: isUpgradeMode
            ? 'rgba(0,255,136,0.2)'
            : 'rgba(0,0,0,0.6)',
          border: `2px solid ${isUpgradeMode ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          padding: isMobile ? '4px 7px' : '5px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 4 : 7,
          transition: 'all 0.15s ease',
          animation: isUpgradeMode ? 'lf-cta-glow 1.5s ease infinite' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: isMobile ? 15 : 18 }}>🛠️</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontSize: isMobile ? 10 : 12,
            color: isUpgradeMode ? '#00ff88' : '#94a3b8',
            fontWeight: 800,
            fontFamily: "'Courier New', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>[U] UPGRADE</div>
          <div style={{
            fontSize: isMobile ? 9 : 11,
            color: isUpgradeMode ? '#00ff88' : '#64748b',
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
          }}>{isUpgradeMode ? 'ATIVO (CLIQUE)' : 'MODO TORRES'}</div>
        </div>
      </button>

      {/* Direct Base Upgrade Button */}
      <button
        data-testid="hud-upgrade-core-btn"
        title={`Evoluir Base Central para Nível ${coreLevel + 1} (libera upgrade de torres até Lv${coreLevel + 1})`}
        onClick={() => {
          if (!canAffordCore) return
          upgradeCore()
        }}
        style={{
          background: canAffordCore
            ? 'rgba(168,85,247,0.22)'
            : 'rgba(0,0,0,0.6)',
          border: `2px solid ${canAffordCore ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          padding: isMobile ? '4px 7px' : '5px 10px',
          cursor: canAffordCore ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 4 : 7,
          transition: 'all 0.15s ease',
          opacity: canAffordCore ? 1 : 0.55,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: isMobile ? 15 : 18 }}>🏰</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{
            fontSize: isMobile ? 10 : 12,
            color: canAffordCore ? '#d8b4fe' : '#94a3b8',
            fontWeight: 800,
            fontFamily: "'Courier New', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>{`BASE LV${coreLevel} → LV${coreLevel + 1}`}</div>
          <div style={{
            fontSize: isMobile ? 10 : 12,
            color: canAffordCore ? '#ffd700' : '#ff4444',
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
          }}>${coreUpgradeCost}</div>
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
  const mathStreak = useGameStore(s => s.mathStreak)
  const isMuted = useGameStore(s => s.isMuted)
  const toggleMute = useGameStore(s => s.toggleMute)
  const isMobile = useIsMobileViewport()

  // ── Keyboard Shortcuts (1-4: Towers, B: Build/Move toggle, U: Upgrade mode) ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = useGameStore.getState()
      if (store.phase !== 'PLAYING' && store.phase !== 'WAVE_CLEAR') return
      if (store.isPaused) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
        const idx = Number(e.code.replace('Digit', '')) - 1
        const bpKey = TOWER_BLUEPRINT_KEYS[idx]
        if (bpKey) {
          store.setSelectedBlueprint(bpKey)
          store.setActionMode('BUILD')
          if (store.isUpgradeMode) store.toggleUpgradeMode()
        }
      } else if (e.code === 'KeyB') {
        store.setActionMode(store.actionMode === 'BUILD' ? 'MOVE' : 'BUILD')
      } else if (e.code === 'KeyU') {
        store.toggleUpgradeMode()
        if (store.actionMode !== 'BUILD') store.setActionMode('BUILD')
      } else if (e.code === 'Escape' && store.relocatingTowerId) {
        store.setRelocatingTowerId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (phase === 'MENU') {
    return <LandingPage onStart={onStart} />
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

      {/* Pause & Mute buttons (top-right, below settings) */}
      <div style={{
        position: 'absolute',
        top: isMobile ? 52 : 56,
        right: 12,
        zIndex: 200,
        pointerEvents: 'auto',
        display: 'flex',
        gap: 6,
      }}>
        <button
          onClick={toggleMute}
          title={isMuted ? 'Ativar Som' : 'Silenciar'}
          style={{
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: isMobile ? '6px 9px' : '8px 12px',
            color: isMuted ? '#ff4444' : '#00ff88',
            fontSize: isMobile ? 14 : 16,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: "'Courier New', monospace",
          }}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <button
          onClick={() => setPaused(true)}
          style={{
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: isMobile ? '6px 10px' : '8px 14px',
            color: '#94a3b8',
            fontSize: isMobile ? 14 : 16,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s ease',
            fontFamily: "'Courier New', monospace",
          }}
        >
          ⏸ {!isMobile && <span style={{ fontSize: 12, letterSpacing: '0.08em' }}>PAUSAR</span>}
        </button>
      </div>

      {/* Top HUD row */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: isMobile ? 102 : 80,
        display: 'flex',
        gap: isMobile ? 6 : 10,
        flexWrap: 'wrap',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <HPBar current={coreHp} max={maxCoreHp} color="#00d4ff" label={`Core LV${coreLevel}`} compact={isMobile} />
        <HPBar
          current={playerHp}
          max={maxPlayerHp}
          color={isPlayerDead ? '#ff4444' : '#00ff88'}
          label={isPlayerDead ? 'Player 💀' : 'Player'}
          compact={isMobile}
        />
        <StatBadge label="Wave" value={waveNumber} color="#a855f7" icon="🌊" compact={isMobile} />
        <StatBadge label="Gold" value={gold} color="#ffd700" icon="💰" compact={isMobile} />
        <StatBadge label="Enemies" value={enemiesAlive} color="#ff4444" icon="👾" compact={isMobile} />
        {mathStreak > 0 && (
          <StatBadge label="Streak" value={`x${mathStreak}`} color="#00ff88" icon="🔥" compact={isMobile} />
        )}
        <BuffBadge />
      </div>

      {/* Action Mode Toggle + Math Compass + Tower Selection Bar */}
      <div style={{
        position: 'absolute',
        top: isMobile ? 96 : 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isMobile ? 4 : 6,
        pointerEvents: 'none',
        width: isMobile ? 'calc(100vw - 16px)' : 'auto',
      }}>
        <ActionModeToggle />
        <RelocateTowerBanner />
        <MathCompassBar />
        {actionMode === 'BUILD' && <TowerSelector />}
      </div>

      {/* Pedagogical Insight Toast (Bottom-Left above Camera Pod) */}
      <PedagogicalInsightToast />

      {/* Ergonomic 1-Thumb Camera Control Pod (Bottom-Left) */}
      <CameraControlPod />

      {/* Wave Clear — auto-advance countdown banner */}
      {phase === 'WAVE_CLEAR' && <WaveCountdownBanner waveNumber={waveNumber} />}

      {/* ── Overdrive: Call Next Wave Early ── */}
      {(phase === 'PLAYING' || phase === 'WAVE_CLEAR') && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 100,
          pointerEvents: 'auto',
        }}>
          <style>{`
            @keyframes lf-overdrive-pulse {
              0%, 100% { box-shadow: 0 0 8px rgba(255,100,0,0.3), inset 0 0 8px rgba(255,100,0,0.05); }
              50% { box-shadow: 0 0 20px rgba(255,100,0,0.6), inset 0 0 12px rgba(255,100,0,0.1); }
            }
          `}</style>
          <button
            id="overdrive-call-wave"
            onClick={() => useGameStore.getState().forceNextWave()}
            style={{
              background: 'linear-gradient(135deg, rgba(255,100,0,0.25), rgba(255,30,30,0.25))',
              border: '2px solid rgba(255,100,0,0.6)',
              borderRadius: 12,
              padding: '10px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: "'Courier New', monospace",
              animation: 'lf-overdrive-pulse 2s ease-in-out infinite',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{
              fontSize: 22,
              filter: 'drop-shadow(0 0 4px rgba(255,100,0,0.6))',
            }}>💀⏩</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: 9,
                color: '#ff6600',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 800,
              }}>OVERDRIVE</div>
              <div style={{
                fontSize: 13,
                color: '#ff4444',
                fontWeight: 900,
                letterSpacing: '0.05em',
              }}>
                {`>> Onda ${waveNumber + 1} (Perigo!)`}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Controls hint at bottom (Desktop only) */}
      {!isMobile && <ControlsHint />}
    </>
  )
}
// ── Relocate Tower Active Banner ────────────────────────────────────────────────
function RelocateTowerBanner() {
  const relocatingTowerId = useGameStore(s => s.relocatingTowerId)
  const towers = useGameStore(s => s.towers)
  const setRelocatingTowerId = useGameStore(s => s.setRelocatingTowerId)
  const isMobile = useIsMobileViewport()

  if (!relocatingTowerId) return null
  const tower = towers.find(t => t.id === relocatingTowerId)
  if (!tower) return null

  const bp = TOWER_BLUEPRINTS[tower.type] ?? TOWER_BLUEPRINTS['RAPID']
  const relocateCost = Math.max(Math.floor(bp.cost * TOWER_RELOCATE_COST), TOWER_RELOCATE_MIN)

  return (
    <div
      data-testid="relocate-mode-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 6 : 12,
        background: 'rgba(4,24,38,0.95)',
        border: '2px solid #00d4ff',
        borderRadius: 10,
        padding: isMobile ? '6px 10px' : '8px 16px',
        pointerEvents: 'auto',
        boxShadow: '0 0 24px rgba(0,212,255,0.35)',
        fontFamily: "'Courier New', monospace",
        maxWidth: 'calc(100vw - 16px)',
        boxSizing: 'border-box',
      }}
    >
      <span style={{
        fontSize: isMobile ? 11 : 13,
        color: '#00d4ff',
        fontWeight: 900,
        letterSpacing: '0.04em',
      }}>
        {`📍 MOVER ${bp.label.toUpperCase()} (-$${relocateCost}): Clique em um local livre no mapa`}
      </span>
      <button
        data-testid="relocate-cancel-btn"
        onClick={() => setRelocatingTowerId(null)}
        style={{
          background: 'rgba(255,68,68,0.2)',
          border: '1px solid rgba(255,68,68,0.6)',
          borderRadius: 6,
          padding: '4px 10px',
          color: '#ff6b6b',
          fontSize: isMobile ? 10 : 12,
          fontWeight: 800,
          fontFamily: "'Courier New', monospace",
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        ✕ Cancelar
      </button>
    </div>
  )
}

// ── Action Mode Toggle (MOVE / BUILD) ───────────────────────────────────────────
function ActionModeToggle() {
  const actionMode = useGameStore(s => s.actionMode)
  const setActionMode = useGameStore(s => s.setActionMode)
  const coreLevel = useGameStore(s => s.coreLevel)
  const gold = useGameStore(s => s.gold)
  const upgradeCore = useGameStore(s => s.upgradeCore)
  const coreUpgradeCost = coreLevel * CORE_UPGRADE_BASE_COST
  const canAffordCore = gold >= coreUpgradeCost

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
      {actionMode !== 'BUILD' && (
        <button
          data-testid="actionbar-upgrade-core-btn"
          title={`Evoluir Base Central para Nível ${coreLevel + 1} ($${coreUpgradeCost})`}
          onClick={() => {
            if (!canAffordCore) return
            upgradeCore()
          }}
          style={{
            background: canAffordCore ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.04)',
            border: `2px solid ${canAffordCore ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 8,
            padding: '8px 14px',
            cursor: canAffordCore ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
            opacity: canAffordCore ? 1 : 0.55,
          }}
        >
          <span style={{ fontSize: 18 }}>🏰</span>
          <span style={{
            fontSize: 13,
            color: canAffordCore ? '#d8b4fe' : '#94a3b8',
            fontWeight: 800,
            fontFamily: "'Courier New', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>{`BASE LV${coreLevel + 1} ($${coreUpgradeCost})`}</span>
        </button>
      )}
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

// ── Settings Menu & Ergonomic Camera Control Pod ───────────────────────────────
function azimuthToCardinal(rad: number): string {
  const norm = ((rad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const idx = Math.round(norm / (Math.PI / 4)) % 8
  const dirs = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[idx] ?? 'N'
}

function CameraControlPod() {
  const cameraMode = useGameStore(s => s.cameraMode)
  const cycleCameraMode = useGameStore(s => s.cycleCameraMode)
  const rotateCameraByStep = useGameStore(s => s.rotateCameraByStep)
  const resetCameraNorth = useGameStore(s => s.resetCameraNorth)
  const [compassDir, setCompassDir] = useState('N')
  const isMobile = useIsMobileViewport()

  useEffect(() => {
    const id = setInterval(() => {
      const { azimuthRad } = getLiveCameraAngles()
      setCompassDir(azimuthToCardinal(azimuthRad))
    }, 180)
    return () => clearInterval(id)
  }, [])

  const cameraModeLabel =
    cameraMode === 'BALANCED'
      ? 'Equilibrada ⚖️'
      : cameraMode === 'FREE'
      ? 'Livre 360° 🔓'
      : 'Fixa 🔒'

  const cameraModeShort =
    cameraMode === 'BALANCED' ? '⚖️' : cameraMode === 'FREE' ? '🔓' : '🔒'

  return (
    <div
      id="camera-control-pod"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: isMobile ? 76 : 16,
        left: 12,
        zIndex: 140,
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        background: 'rgba(4, 8, 22, 0.88)',
        border: '1px solid rgba(56, 189, 248, 0.38)',
        borderRadius: 10,
        padding: '4px 6px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.55)',
        fontFamily: "'Courier New', monospace",
      }}
    >
      <button
        type="button"
        title="Girar câmera -45°"
        onClick={() => rotateCameraByStep(-Math.PI / 4)}
        disabled={cameraMode === 'LOCKED'}
        style={{
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 7,
          color: cameraMode === 'LOCKED' ? '#475569' : '#38bdf8',
          fontSize: 13,
          fontWeight: 900,
          padding: '6px 9px',
          minWidth: 34,
          minHeight: 34,
          cursor: cameraMode === 'LOCKED' ? 'not-allowed' : 'pointer',
          fontFamily: "'Courier New', monospace",
        }}
      >
        ↺
      </button>
      <button
        type="button"
        title="Centralizar câmera no Norte (45°)"
        onClick={() => resetCameraNorth()}
        style={{
          background: 'rgba(0, 255, 136, 0.12)',
          border: '1px solid rgba(0, 255, 136, 0.35)',
          borderRadius: 7,
          color: '#00ff88',
          fontSize: 11,
          fontWeight: 900,
          padding: '6px 8px',
          minWidth: 46,
          minHeight: 34,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          fontFamily: "'Courier New', monospace",
        }}
      >
        <span>🧭</span>
        <span>{compassDir}</span>
      </button>
      <button
        type="button"
        title="Girar câmera +45°"
        onClick={() => rotateCameraByStep(Math.PI / 4)}
        disabled={cameraMode === 'LOCKED'}
        style={{
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 7,
          color: cameraMode === 'LOCKED' ? '#475569' : '#38bdf8',
          fontSize: 13,
          fontWeight: 900,
          padding: '6px 9px',
          minWidth: 34,
          minHeight: 34,
          cursor: cameraMode === 'LOCKED' ? 'not-allowed' : 'pointer',
          fontFamily: "'Courier New', monospace",
        }}
      >
        ↻
      </button>
      <button
        type="button"
        title={`Modo de Câmera: ${cameraModeLabel} (toque para alternar)`}
        onClick={cycleCameraMode}
        style={{
          background: cameraMode === 'BALANCED'
            ? 'rgba(250, 204, 21, 0.16)'
            : cameraMode === 'FREE'
            ? 'rgba(0, 255, 136, 0.14)'
            : 'rgba(148, 163, 184, 0.12)',
          border: `1px solid ${
            cameraMode === 'BALANCED'
              ? 'rgba(250, 204, 21, 0.45)'
              : cameraMode === 'FREE'
              ? 'rgba(0, 255, 136, 0.4)'
              : 'rgba(148, 163, 184, 0.3)'
          }`,
          borderRadius: 7,
          color: cameraMode === 'BALANCED' ? '#fde047' : cameraMode === 'FREE' ? '#00ff88' : '#94a3b8',
          fontSize: 12,
          fontWeight: 900,
          padding: '6px 8px',
          minWidth: 34,
          minHeight: 34,
          cursor: 'pointer',
          fontFamily: "'Courier New', monospace",
        }}
      >
        {cameraModeShort}
      </button>
    </div>
  )
}

function SettingsMenu() {
  const isMenuOpen = useGameStore(s => s.isMenuOpen)
  const isCameraFree = useGameStore(s => s.isCameraFree)
  const cameraMode = useGameStore(s => s.cameraMode)
  const visualStyle = useGameStore(s => s.visualStyle)
  const sceneryDensity = useGameStore(s => s.sceneryDensity)
  const toggleMenu = useGameStore(s => s.toggleMenu)
  const cycleCameraMode = useGameStore(s => s.cycleCameraMode)
  const toggleVisualStyle = useGameStore(s => s.toggleVisualStyle)
  const toggleSceneryDensity = useGameStore(s => s.toggleSceneryDensity)
  const explanationLog = useGameStore(s => s.explanationLog)

  const cameraModeLabel =
    cameraMode === 'BALANCED'
      ? 'Equilibrada ⚖️'
      : cameraMode === 'FREE'
      ? 'Livre 360° 🔓'
      : 'Fixa 🔒'

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 200,
      pointerEvents: 'auto',
      fontFamily: "'Courier New', monospace",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
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
          width: 340,
          maxWidth: 'calc(100vw - 24px)',
          boxSizing: 'border-box',
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

          {/* Camera Mode 3-state cycle toggle (Equilibrada / Livre 360° / Fixa) */}
          <button
            onClick={cycleCameraMode}
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
              fontSize: 13,
              fontWeight: 900,
            }}>
              {cameraModeLabel}
            </span>
          </button>

          {/* 2.5D Visual Style toggle */}
          <button
            onClick={toggleVisualStyle}
            style={{
              width: '100%',
              marginTop: 6,
              background: visualStyle === '2.5D'
                ? 'rgba(0,212,255,0.14)'
                : 'rgba(255,255,255,0.05)',
              border: `1px solid ${visualStyle === '2.5D' ? '#00d4ff50' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8,
              padding: '10px 12px',
              color: visualStyle === '2.5D' ? '#38bdf8' : '#94a3b8',
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
            <span>🎨 Visual</span>
            <span style={{ fontSize: 13, fontWeight: 900 }}>
              {visualStyle === '2.5D' ? '2.5D HD-Cyber ✨' : '3D Clássico 🧊'}
            </span>
          </button>

          {/* Scenery Density toggle */}
          {visualStyle === '2.5D' && (
            <button
              onClick={toggleSceneryDensity}
              style={{
                width: '100%',
                marginTop: 6,
                background: sceneryDensity === 'FULL'
                  ? 'rgba(168,85,247,0.14)'
                  : 'rgba(255,255,255,0.05)',
                border: `1px solid ${sceneryDensity === 'FULL' ? '#a855f750' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8,
                padding: '10px 12px',
                color: sceneryDensity === 'FULL' ? '#c084fc' : '#94a3b8',
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
              <span>🌿 Cenário 2.5D</span>
              <span style={{ fontSize: 13, fontWeight: 900 }}>
                {sceneryDensity === 'FULL' ? 'Completo 🌌' : 'Mínimo ⚡'}
              </span>
            </button>
          )}

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
      bottom: 80,
      right: 16,
      background: 'rgba(0,0,0,0.75)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8,
      padding: '8px 14px',
      color: '#64748b',
      fontFamily: "'Courier New', monospace",
      fontSize: 11,
      zIndex: 10,
      pointerEvents: 'none',
      lineHeight: 1.6,
    }}>
      <strong style={{ color: '#00ff88' }}>WASD</strong> mover ·{' '}
      <strong style={{ color: '#00d4ff' }}>ESPAÇO</strong> pulso lógico ·{' '}
      <strong style={{ color: '#ff8800' }}>B</strong> modo ·{' '}
      <strong style={{ color: '#ffd700' }}>1-4</strong> torres ·{' '}
      <strong style={{ color: '#00ff88' }}>U</strong> upgrade
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
