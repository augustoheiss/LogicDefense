import { useRef, useCallback, useEffect } from 'react'
import { GameCanvas } from './GameCanvas'
import { MuseumTexts } from './MuseumTexts'
import { OfflineScreen } from './OfflineScreen'
import { SpinEsfera } from './screens/SpinEsfera'
import { ScoreUI } from './ui/ScoreUI'
import { SystemMenu } from './ui/SystemMenu'
import { BuildMenu } from './ui/BuildMenu'
import { MathModal } from './ui/MathModal'
import { MathTipBox } from './ui/MathTipBox'
import { UpgradePanel } from './ui/UpgradePanel'
import { FeedbackMsg, type FeedbackHandle } from './ui/FeedbackMsg'
import { SaveRoundModal } from './ui/SaveRoundModal'
import { useGameEngine } from '../hooks/useGameEngine'
import { useAudio } from '../hooks/useAudio'
import type { BuffType } from '../types/game'
import type { Hero } from '../engine/Hero'

interface GamePageProps {
  onReset?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Selection Overlay (replaces StartScreen entirely)
// ─────────────────────────────────────────────────────────────────────────────
interface DifficultyCardProps {
  count: 1 | 2 | 3
  title: string
  tag: string
  tagColor: string
  spawnLabel: string
  mathLabel: string
  desc: string
  icon: string
  onSelect: (count: 1 | 2 | 3) => void
}

function DifficultyCard({ count, title, tag, tagColor, spawnLabel, mathLabel, desc, icon, onSelect }: DifficultyCardProps) {
  return (
    <button
      id={`difficulty-btn-${count}`}
      onClick={() => onSelect(count)}
      style={{
        flex: '1 1 200px',
        maxWidth: 220,
        background: 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${tagColor}55`,
        borderRadius: 14,
        padding: '28px 20px',
        cursor: 'pointer',
        color: '#fff',
        textAlign: 'left',
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s, background 0.2s',
        outline: 'none',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translateY(-6px) scale(1.02)'
        el.style.borderColor = tagColor
        el.style.boxShadow = `0 12px 40px ${tagColor}33`
        el.style.background = 'rgba(255,255,255,0.08)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.transform = 'translateY(0) scale(1)'
        el.style.borderColor = `${tagColor}55`
        el.style.boxShadow = 'none'
        el.style.background = 'rgba(255,255,255,0.04)'
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontFamily: 'Courier New, monospace',
        color: tagColor,
        border: `1px solid ${tagColor}66`,
        borderRadius: 100,
        padding: '3px 10px',
        marginBottom: 10,
        textShadow: `0 0 12px ${tagColor}88`,
      }}>
        {tag}
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        fontFamily: 'Courier New, monospace',
        color: '#ffffff',
        marginBottom: 4,
        letterSpacing: '0.04em',
      }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: '#8a9abc', marginBottom: 14, lineHeight: 1.6 }}>
        {desc}
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, color: '#6a7a9a', fontFamily: 'Courier New, monospace' }}>
          <span style={{ color: tagColor, fontWeight: 700 }}>SPAWN</span> {spawnLabel}
        </div>
        <div style={{ fontSize: 11, color: '#6a7a9a', fontFamily: 'Courier New, monospace' }}>
          <span style={{ color: tagColor, fontWeight: 700 }}>MATH</span> {mathLabel}
        </div>
      </div>
    </button>
  )
}

function HeroSelectionOverlay({ onSelect }: { onSelect: (count: 1 | 2 | 3) => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        background: 'rgba(5, 5, 16, 0.93)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        padding: 24,
      }}
    >
      <div style={{
        fontFamily: 'Courier New, monospace',
        fontSize: 10,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: '#00d4ff',
        marginBottom: 16,
        textShadow: '0 0 16px rgba(0,212,255,0.5)',
      }}>
        ⚔ Logic Defense — Action RTS
      </div>
      <h1 style={{
        fontFamily: 'Courier New, monospace',
        fontSize: 'clamp(20px, 4vw, 30px)',
        fontWeight: 700,
        color: '#ffffff',
        textAlign: 'center',
        margin: '0 0 10px',
        textShadow: '0 0 30px rgba(0,212,255,0.4)',
      }}>
        Escolha Sua Esquadra
      </h1>
      <p style={{
        color: '#8a9abc',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 40,
        maxWidth: 480,
        lineHeight: 1.6,
      }}>
        Heróis coletam moedas dos inimigos. Sem herói → sem ouro.
        <br />
        Mais heróis = mais risco = mais glória.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720 }}>
        <DifficultyCard
          count={1}
          icon="⚔️"
          title="1 Herói"
          tag="Normal"
          tagColor="#39ff14"
          spawnLabel="Taxa padrão"
          mathLabel="Onda atual"
          desc="Aprenda o sistema. Um único herói para coletar, mover e evoluir."
          onSelect={onSelect}
        />
        <DifficultyCard
          count={2}
          icon="⚔️🛡️"
          title="2 Heróis"
          tag="Hardcore"
          tagColor="#ffd700"
          spawnLabel="×3 inimigos/frame"
          mathLabel="+300 de dificuldade"
          desc="Inimigos chegam como uma tempestade. Coordene os dois heróis ou pereça."
          onSelect={onSelect}
        />
        <DifficultyCard
          count={3}
          icon="⚔️🛡️💀"
          title="3 Heróis"
          tag="God Mode"
          tagColor="#ff3355"
          spawnLabel="×9 inimigos/frame"
          mathLabel="+1000 de dificuldade"
          desc="O caos absoluto. Matemática de nível expert. Glória máxima aguarda os insanos."
          onSelect={onSelect}
        />
      </div>
      <p style={{ color: '#3a4a6a', fontSize: 11, marginTop: 32, fontFamily: 'Courier New, monospace' }}>
        Clique com o botão direito ou toque no chão para mover um Herói selecionado.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Upgrade Panel (shown when a Hero is selected)
// ─────────────────────────────────────────────────────────────────────────────
interface HeroPanelProps {
  hero: Hero
  gold: number
  onUpgrade: () => void
  onClose: () => void
}

function HeroPanel({ hero, gold, onUpgrade, onClose }: HeroPanelProps) {
  const canUpgrade = gold >= hero.upgradeCost
  const dmg = Math.round(25 * (1 + 0.2 * (hero.level - 1)))
  const atk = hero.currentRate

  return (
    <div
      id="hero-panel"
      style={{
        position: 'absolute',
        bottom: 70,
        left: 10,
        zIndex: 60,
        background: 'rgba(0, 18, 38, 0.92)',
        border: '1.5px solid rgba(0, 212, 255, 0.5)',
        borderRadius: 10,
        padding: '14px 18px',
        minWidth: 190,
        boxShadow: '0 0 24px rgba(0, 212, 255, 0.2)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: 'Courier New, monospace', fontSize: 12, fontWeight: 700, color: '#00d4ff', letterSpacing: '0.12em' }}>
          ★ HERÓI LV.{hero.level}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#6a7a9a', cursor: 'pointer', fontSize: 14, padding: 0 }}
        >
          ✕
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        {[
          { label: 'DMG', value: `${dmg}` },
          { label: 'ATK', value: `${atk} cd` },
          { label: 'RNG', value: `${Math.round(hero.range)}` },
          { label: 'MAG', value: `${hero.magnetRadius}px` },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#6a7a9a', fontFamily: 'Courier New, monospace' }}>{label}</span>
            <span style={{ color: '#dde6ff', fontFamily: 'Courier New, monospace', fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Upgrade button */}
      <button
        id="hero-upgrade-btn"
        onClick={onUpgrade}
        disabled={!canUpgrade}
        style={{
          width: '100%',
          padding: '9px 0',
          background: canUpgrade ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${canUpgrade ? 'rgba(0,212,255,0.6)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 6,
          color: canUpgrade ? '#00d4ff' : '#4a5a7a',
          fontFamily: 'Courier New, monospace',
          fontSize: 12,
          fontWeight: 700,
          cursor: canUpgrade ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          letterSpacing: '0.08em',
        }}
      >
        EVOLUIR • ${hero.upgradeCost}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GamePage
// ─────────────────────────────────────────────────────────────────────────────
export function GamePage({ onReset }: GamePageProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const feedbackMsgRef = useRef<FeedbackHandle | null>(null)

  const { initAudio, playSound, toggleMute, setAudioMode, pauseMusic, resumeMusic } = useAudio()

  const engine = useGameEngine(canvasRef, playSound, initAudio)

  const {
    uiState,
    feedbackRef,
    onSpinComplete,
    startWaveCombat,
    resolveMath,
    triggerSaveModal,
    confirmSaveRound: engineConfirmSave,
    cancelSaveModal: engineCancelSave,
    selectTowerBtn,
    cancelSelection,
    upgradeSelectedTower,
    moveSelectedTower,
    sellSelectedTower,
    toggleSpeed,
    toggleAIMode,
    toggleStressMode,
    toggleUiHidden,
    setAudioMuted,
    updateMousePos,
    handlePress,
    handleRelease,
    applyDifficulty,
    upgradeSelectedHero,
    cancelHeroSelection,
    handleRightClick,
  } = engine

  function handleConfirmSave(playerName: string) {
    engineConfirmSave(playerName)
    onReset?.()
  }

  function handleCancelSave() {
    engineCancelSave()
    onReset?.()
  }

  // Wire feedback handle to engine
  useEffect(() => {
    feedbackRef.current = (msg: string, color: string) => {
      feedbackMsgRef.current?.show(msg, color)
    }
  }, [feedbackRef])

  // Adaptive audio
  const { gameState } = uiState
  useEffect(() => {
    if (gameState === 'SPIN' || gameState === 'CINEMATIC') {
      setAudioMode('spin')
      if (gameState === 'SPIN') playSound('spin')
    } else {
      setAudioMode('normal')
    }
  }, [gameState, setAudioMode, playSound])

  // Pause/resume BGM on network drop
  useEffect(() => {
    const onOffline = () => pauseMusic()
    const onOnline = () => resumeMusic()
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [pauseMusic, resumeMusic])

  // ── Stable input callbacks ─────────────────────────────────────────────
  const handleMouseDown = useCallback((e: MouseEvent | TouchEvent) => {
    updateMousePos(e as MouseEvent)
    handlePress()
  }, [updateMousePos, handlePress])

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    updateMousePos(e as MouseEvent)
  }, [updateMousePos])

  const handleMouseUp = useCallback((e: MouseEvent | TouchEvent) => {
    updateMousePos(e as MouseEvent)
    handleRelease()
  }, [updateMousePos, handleRelease])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    updateMousePos(e)
    handlePress()
  }, [updateMousePos, handlePress])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    updateMousePos(e)
  }, [updateMousePos])

  const handleTouchEnd = useCallback((_e: TouchEvent) => {
    handleRelease()
  }, [handleRelease])

  // ── Fullscreen ─────────────────────────────────────────────────────────
  function handleFullscreen() {
    const elem = document.documentElement
    if (!document.fullscreenElement) {
      elem.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  const { uiHidden, stressMode, selectedExistingTower, selectedHero } = uiState

  return (
    <div
      style={{
        margin: 0, padding: 0, overflow: 'hidden', background: '#050505',
        color: 'white', fontFamily: "'Courier New', monospace",
        userSelect: 'none', width: '100vw', height: '100vh',
      }}
      className={uiHidden ? 'hide-ui' : ''}
    >
      <MuseumTexts />
      <OfflineScreen />

      <div
        id="game-container"
        className={gameState === 'CINEMATIC' ? 'cinematic-mode' : ''}
        // Desktop right-click → hero move command
        onContextMenu={(e) => {
          e.preventDefault()
          handleRightClick(e.nativeEvent as MouseEvent)
        }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800, height: 600,
          border: '2px solid #444', borderRadius: 10,
          backgroundImage: "url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1000&q=80')",
          backgroundSize: 'cover', backgroundPosition: 'center',
          boxShadow: '0 0 40px rgba(0, 212, 255, 0.3)',
          overflow: 'hidden', margin: 0, zIndex: 10,
        }}
      >
        {/* Canvas */}
        <GameCanvas
          uiState={uiState}
          canvasRef={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* ── UI Overlays ── */}

        {/* Score HUD */}
        {gameState !== 'START' && gameState !== 'SPIN' && (
          <ScoreUI uiState={uiState} />
        )}

        {/* System menu */}
        {gameState !== 'START' && (
          <SystemMenu
            uiState={uiState}
            onToggleSpeed={toggleSpeed}
            onToggleAI={toggleAIMode}
            onToggleGhost={() => toggleUiHidden(!uiHidden)}
            onToggleMute={() => { }}
            onToggleStress={toggleStressMode}
            onFullscreen={handleFullscreen}
            onSaveRound={triggerSaveModal}
            toggleMuteAudio={(muted) => {
              toggleMute(muted)
              setAudioMuted(muted)
            }}
          />
        )}

        {/* Build menu */}
        <BuildMenu uiState={uiState} onSelectTower={selectTowerBtn} />

        {/* Tower upgrade panel */}
        {selectedExistingTower && (
          <UpgradePanel
            uiState={uiState}
            onUpgrade={upgradeSelectedTower}
            onMove={moveSelectedTower}
            onSell={sellSelectedTower}
            onClose={cancelSelection}
          />
        )}

        {/* Hero upgrade panel (NEW) */}
        {selectedHero && !selectedExistingTower && (
          <HeroPanel
            hero={selectedHero}
            gold={uiState.gold}
            onUpgrade={upgradeSelectedHero}
            onClose={cancelHeroSelection}
          />
        )}

        {/* Math question modal */}
        <MathModal
          uiState={uiState}
          onAnswer={(isCorrect) => resolveMath(isCorrect, false)}
        />

        {/* Math tip box */}
        <MathTipBox uiState={uiState} />

        {/* Next wave button */}
        {gameState === 'BUILD' && (
          <button
            id="next-wave-btn"
            onClick={() => { initAudio(); startWaveCombat() }}
            style={{ display: 'flex' }}
          >
            🚀
          </button>
        )}

        {/* Cancel build button */}
        {uiState.selectedTowerIdx > -1 && (
          <button id="cancel-btn" style={{ display: 'flex' }} onClick={cancelSelection}>
            ✕
          </button>
        )}

        {/* Secret stress/dev button */}
        {uiHidden && (
          <button
            id="stress-btn"
            className={`secret-dev-btn ${stressMode ? 'stress-active' : ''}`}
            style={{ display: 'block' }}
            onClick={toggleStressMode}
            title="God Mode Secreto"
          >
            🔥
          </button>
        )}

        {/* Feedback floating message */}
        <FeedbackMsg ref={feedbackMsgRef} />

        {/* Save round / game over modal */}
        <SaveRoundModal
          uiState={uiState}
          onConfirm={handleConfirmSave}
          onCancel={handleCancelSave}
        />

        {/* ── Screens ── */}

        {/* Hero selection replaces the old StartScreen */}
        {gameState === 'START' && (
          <HeroSelectionOverlay onSelect={applyDifficulty} />
        )}

        {gameState === 'SPIN' && (
          <SpinEsfera
            onComplete={(buff: BuffType) => onSpinComplete(buff)}
            isStressMode={stressMode}
          />
        )}
      </div>
    </div>
  )
}
