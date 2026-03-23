import { useRef, useCallback, useEffect } from 'react'
import { GameCanvas } from './GameCanvas'
import { MuseumTexts } from './MuseumTexts'
import { OfflineScreen } from './OfflineScreen'
import { StartScreen } from './screens/StartScreen'
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

interface GamePageProps {
  /** Called after save/discard to trigger a full remount (nuclear clean). */
  onReset?: () => void
}

export function GamePage({ onReset }: GamePageProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const feedbackMsgRef = useRef<FeedbackHandle | null>(null)

  const { initAudio, playSound, toggleMute, setAudioMode, pauseMusic, resumeMusic } = useAudio()

  const engine = useGameEngine(canvasRef, playSound, initAudio)

  const {
    uiState,
    feedbackRef,
    triggerSpin,
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
  } = engine

  // ── Save/Reset handlers ────────────────────────────────────────────────
  // engineConfirmSave saves to localStorage + calls initGame() (intermediate clean).
  // onReset() then triggers a key change in the parent → full React remount
  // (nuclear clean: every ref, RAF loop, and interval is garbage-collected).
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

  // Adaptive audio: tighten the BGM when SPIN or CINEMATIC is active
  const { gameState } = uiState
  useEffect(() => {
    if (gameState === 'SPIN' || gameState === 'CINEMATIC') {
      setAudioMode('spin')
      if (gameState === 'SPIN') playSound('spin')
    } else {
      setAudioMode('normal')
    }
  }, [gameState, setAudioMode, playSound])

  // Pause/resume BGM when network drops (mirrors what YouTube did)
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

  // ── Input callbacks (stable refs) ──────────────────────────────────────
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

  // ── UI visibility class ────────────────────────────────────────────────
  const { uiHidden, stressMode, selectedExistingTower } = uiState

  return (
    <div
      style={{
        margin: 0, padding: 0, overflow: 'hidden', background: '#050505',
        color: 'white', fontFamily: "'Courier New', monospace",
        userSelect: 'none', width: '100vw', height: '100vh',
      }}
      className={uiHidden ? 'hide-ui' : ''}
    >
      {/* Ambient museum texts */}
      <MuseumTexts />

      {/* Offline overlay */}
      <OfflineScreen />

      {/* Game container */}
      <div
        id="game-container"
        className={gameState === 'CINEMATIC' ? 'cinematic-mode' : ''}
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
        {/* Canvas (game renders here) */}
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
            onToggleMute={() => {}}
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

        {/* Upgrade panel */}
        {selectedExistingTower && (
          <UpgradePanel
            uiState={uiState}
            onUpgrade={upgradeSelectedTower}
            onMove={moveSelectedTower}
            onSell={sellSelectedTower}
            onClose={cancelSelection}
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

        {/* Cancel build button — only when placing a new tower, not when viewing the upgrade panel */}
        {uiState.selectedTowerIdx > -1 && (
          <button id="cancel-btn" style={{ display: 'flex' }} onClick={cancelSelection}>
            ✕
          </button>
        )}

        {/* Secret stress/dev button (shown in ghost mode) */}
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

        {/* ── Screens (overlays) ── */}
        {gameState === 'START' && (
          <StartScreen onPlay={() => {
            try { initAudio() } catch { /* audio failure is non-fatal */ }
            triggerSpin()
          }} />
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
