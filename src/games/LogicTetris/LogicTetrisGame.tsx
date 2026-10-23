import React from 'react'
import { GameMode, SubGameStyle } from './types'
import { toggleLogicTetrisFullscreen, useGameLoop } from './hooks/useGameLoop'
import { useLogicTetrisStore } from './state/useLogicTetrisStore'
import { soundEngine } from './audio/soundEngine'
import { TetrisCanvas } from './components/TetrisCanvas'
import { TelemetryHUD } from './components/TelemetryHUD'
import { PieceAlchemyBar } from './components/PieceAlchemyBar'
import { TouchControlPad } from './components/TouchControlPad'
import { MathInterventionModal } from './components/MathInterventionModal'
import { LogicCodexDrawer } from './components/LogicCodexDrawer'
import './logic-tetris.css'

export interface LogicTetrisGameProps {
  className?: string
}

interface ModeOptionCard {
  mode: GameMode
  testId: string
  badge: string
  title: string
  subtitle: string
  shieldsLabel: string
  mathTierLabel: string
  accentBorder: string
}

const MODE_OPTIONS: readonly ModeOptionCard[] = [
  {
    mode: 'zen',
    testId: 'mode-select-zen',
    badge: '🌱 RELAXANTE & ACOLHEDOR',
    title: 'Zen Passatempo',
    subtitle:
      'Gravidade suave, Escudos Fênix ilimitados (∞) e contas de arredondamento e Amigos do 10.',
    shieldsLabel: '🛡️ Escudos Fênix: ∞ (Sem Game Over)',
    mathTierLabel: '🧮 Lentes: Dezenas Redondas & Massinha',
    accentBorder: 'border-emerald-400/70 bg-emerald-950/35',
  },
  {
    mode: 'arcade',
    testId: 'mode-select-arcade',
    badge: '⚡ EQUILÍBRIO CLÁSSICO',
    title: 'Gênesis Arcade',
    subtitle:
      'A experiência canônica! 2 Escudos Fênix iniciais (recarrega +1 a cada 10 linhas) e as 4 operações dinâmicas.',
    shieldsLabel: '🛡️ Escudos Fênix: 2 (+1 a cada 10 linhas)',
    mathTierLabel: '🧮 Lentes: Hack Japonês, Dobro do Dobro & Corta no Meio',
    accentBorder: 'border-cyan-400/70 bg-cyan-950/35',
  },
  {
    mode: 'master',
    testId: 'mode-select-master',
    badge: '🔥 DESAFIO AVANÇADO',
    title: 'Mestre da Balança',
    subtitle:
      'Velocidade intensa e desafios mentais de 2 dígitos (Diferença de Quadrados, Dobra-e-Meia e Divisão por 5).',
    shieldsLabel: '🛡️ Escudos Fênix: 1 (+1 a cada 10 linhas)',
    mathTierLabel: '🧮 Lentes: 8 Lentes Completas Heiss-Lab',
    accentBorder: 'border-amber-400/70 bg-amber-950/35',
  },
]

const HUB_STYLE_BUTTONS: ReadonlyArray<{
  style: SubGameStyle
  label: string
}> = [
  { style: 'TETRIS_CLASSIC', label: '🧱 Clássico 20×10' },
  { style: 'FRUIT_MATCH', label: '🍎 Frutas 10×10' },
  { style: 'TACTILE_GRID', label: '🧩 Grade 10×10' },
]

/**
 * Main Orchestrator Component for Logic Tetris (Trinity Expansion) (`LogicTetrisGame.tsx`).
 *
 * Incorporates Auditor Improvements & Master Plan V2:
 * - `Melhoria 07-A`: Connects `LogicCodexDrawer` (`[H]`) with Live Session Diary + 8 Lenses Guide.
 * - `Melhoria 07-B / 06-B / 06-C`: Welcoming 3-Mode `START_HUB` selector (`Zen`, `Arcade`, `Mestre`)
 *   + Trinity Style & Rotation Mode selector (`hub-style-selector`) keeping `btn-start-match` 100%
 *   visible in Desktop (`1440×900`) and Mobile (`390×844`), and celebratory `GAME_OVER` summary card
 *   highlighting `maxStreakInSession` and `totalStyleShiftsCount`.
 * - `Master Plan V2 (RT-17 / RT-20)`: Proportional Uncut Arena Stage (`max-w-[460px]` for `20×10` vs
 *   `max-w-[550px]` for `10×10` modes) + Native Fullscreen Toggle (`[F]`, `.lt-fullscreen-active`).
 * - `Melhoria 07-C`: Integrates `TelemetryHUD`, `TetrisCanvas`, `PieceAlchemyBar`, and `TouchControlPad`.
 * - `Melhoria 07-D`: Deterministic `data-testid` attributes for Playwright E2E verification.
 */
export const LogicTetrisGame: React.FC<LogicTetrisGameProps> = ({ className = '' }) => {
  useGameLoop({ enabled: true, enableKeyboard: true })

  const phase = useLogicTetrisStore((s) => s.phase)
  const mode = useLogicTetrisStore((s) => s.mode)
  const activeSubGameStyle = useLogicTetrisStore((s) => s.activeSubGameStyle)
  const styleRotationMode = useLogicTetrisStore((s) => s.styleRotationMode)
  const isFullscreen = useLogicTetrisStore((s) => s.isFullscreen)
  const score = useLogicTetrisStore((s) => s.score)
  const lines = useLogicTetrisStore((s) => s.lines)
  const level = useLogicTetrisStore((s) => s.level)
  const maxStreakInSession = useLogicTetrisStore((s) => s.maxStreakInSession)
  const totalStyleShiftsCount = useLogicTetrisStore((s) => s.totalStyleShiftsCount)
  const stats = useLogicTetrisStore((s) => s.stats)
  const solvedCount = useLogicTetrisStore((s) => s.solvedHistory.length)

  const setMode = useLogicTetrisStore((s) => s.setMode)
  const setSubGameStyle = useLogicTetrisStore((s) => s.setSubGameStyle)
  const setStyleRotationMode = useLogicTetrisStore((s) => s.setStyleRotationMode)
  const startGame = useLogicTetrisStore((s) => s.startGame)
  const resumeGame = useLogicTetrisStore((s) => s.resumeGame)
  const returnToHub = useLogicTetrisStore((s) => s.returnToHub)
  const toggleCodex = useLogicTetrisStore((s) => s.toggleCodex)
  const triggerMathFillHole = useLogicTetrisStore((s) => s.triggerMathFillHole)

  const is10x10Stage =
    activeSubGameStyle === 'FRUIT_MATCH' || activeSubGameStyle === 'TACTILE_GRID'
  const stageMaxWidthClass = is10x10Stage ? 'max-w-[616px]' : 'max-w-[360px]'

  const handleStartMatch = () => {
    startGame(mode)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        const anchor =
          document.getElementById('lt-arena-anchor') ||
          document.querySelector('[data-testid="logic-tetris-game"]')
        if (anchor && typeof anchor.scrollIntoView === 'function') {
          anchor.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    }
  }

  const handleStartMatchFullscreen = () => {
    toggleLogicTetrisFullscreen(true)
    handleStartMatch()
  }

  return (
    <div
      className={`lt-genesis-shell relative rounded-3xl p-2 sm:p-3 border border-slate-800/90 shadow-2xl max-w-[1120px] mx-auto ${
        isFullscreen ? 'lt-fullscreen-active max-w-none' : ''
      } ${className}`}
      data-testid="logic-tetris-game"
      data-game-phase={phase}
      data-game-mode={mode}
      data-active-style={activeSubGameStyle}
      data-rotation-mode={styleRotationMode}
      data-fullscreen={isFullscreen ? 'true' : 'false'}
    >
      {/* Sekundo Vertical Command Station: Top Telemetry Dock -> Giant Central Arena -> Bottom Alchemy & Control Dock */}
      <div className="w-full max-w-[1060px] mx-auto flex flex-col items-center gap-1.5">
        {/* 1. TOP COMMAND & TELEMETRY DOCK */}
        <TelemetryHUD className="w-full" />

        {/* 2. CENTRAL GIANT ARENA STAGE (Zero Sidebars!) */}
        <div className="w-full flex flex-col items-center justify-center">
          <TetrisCanvas
            onCavityClick={() => triggerMathFillHole()}
            className={`w-full ${stageMaxWidthClass}`}
          />
        </div>

        {/* 3. BOTTOM ALCHEMY & CONTROL DOCK */}
        <div
          className="w-full flex flex-col gap-1"
          data-testid="bottom-command-dock"
        >
          <PieceAlchemyBar className="w-full" />
          <TouchControlPad className="w-full" />
        </div>
      </div>

      {/* =====================================================================
          START HUB OVERLAY (3-Mode Selection + Trinity Style Selector — Melhoria 06-B/06-C)
          ===================================================================== */}
      {phase === 'START_HUB' && (
        <div
          className="fixed inset-0 flex items-center justify-center p-2 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
          style={{ zIndex: 1150 }}
          data-testid="start-hub-overlay"
        >
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900/95 border-2 border-cyan-500/60 shadow-[0_0_50px_rgba(6,182,212,0.28)] p-3.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3.5 max-h-[95vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2 flex-wrap border-b border-slate-800 pb-2">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-[10px] sm:text-[11px] font-mono font-bold text-cyan-200">
                  🏛️ LOGIC TETRIS (TRINITY EXPANSION)
                </span>
                <h2 className="text-lg sm:text-2xl font-extrabold text-white mt-1">
                  Onde a Matemática Salva a Sua Vida no Jogo!
                </h2>
                <p
                  className="text-xs text-slate-300 mt-[2px] leading-snug"
                  style={{ fontSize: '12px' }}
                >
                  Jogue os <strong className="text-cyan-300">3 Estilos do Cordão Tríplice</strong> em
                  arenas proporcionais (<strong className="text-cyan-200">20×10</strong> e{' '}
                  <strong className="text-emerald-200">10×10 Cheia</strong>)! Use a Matemática para{' '}
                  <strong className="text-amber-300">mudar peças [M]</strong>,{' '}
                  <strong className="text-amber-300">tapar buracos [B]</strong> e ativar o{' '}
                  <strong className="text-purple-300">Protocolo Fênix 142857</strong>!
                </p>
              </div>
            </div>

            {/* Mastery Memory & Warm Encouragement Banner (`Melhoria 10-B`) */}
            <div
              className="rounded-xl bg-slate-950/85 border border-cyan-500/30 px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap"
              data-testid="hub-mastery-banner"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-200 font-medium">
                <span>🌟</span>
                <span>Memória de Maestria:</span>
              </div>
              <div className="flex items-center gap-2.5 text-[11px] font-mono">
                <span className="text-amber-300 font-bold">
                  🏆 Recorde: {stats.highScore.toLocaleString('pt-BR')}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-emerald-300 font-bold">
                  🧮 Contas: {stats.totalMathSolved}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-purple-300 font-bold">
                  📏 Linhas: {stats.bestLines}
                </span>
              </div>
            </div>

            {/* Triple Cord Style & Simultaneous Mode Selector (`data-testid="hub-style-selector"` — Melhoria 06-B/06-C) */}
            <div
              className="rounded-xl bg-slate-950/90 border border-slate-800 p-2 sm:p-2.5 flex flex-col gap-1.5"
              data-testid="hub-style-selector"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-300">
                  🌀 Escolha o Estilo Inicial do Cordão Tríplice:
                </span>
                <button
                  type="button"
                  onClick={() => setStyleRotationMode('SIMULTANEOUS')}
                  data-testid="hub-rotation-simultaneous"
                  className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold transition cursor-pointer ${
                    styleRotationMode === 'SIMULTANEOUS'
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🌀 Simultâneo 3-em-1 (Padrão)
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {HUB_STYLE_BUTTONS.map((btn) => {
                  const isSelected = activeSubGameStyle === btn.style
                  return (
                    <button
                      key={btn.style}
                      type="button"
                      onClick={() => setSubGameStyle(btn.style)}
                      data-testid={`hub-style-${btn.style}`}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/90 border-cyan-400 text-white shadow'
                          : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 3 Mode Cards (Compact on mobile so btn-start-match is 100% in viewport!) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5">
              {MODE_OPTIONS.map((opt) => {
                const isSelected = mode === opt.mode
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setMode(opt.mode)}
                    data-testid={opt.testId}
                    className={`rounded-xl p-2.5 sm:p-3 border-2 text-left flex flex-col justify-between gap-1.5 transition cursor-pointer ${
                      isSelected
                        ? `${opt.accentBorder} ring-2 ring-cyan-300/60`
                        : 'bg-slate-950/75 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-cyan-300">
                          {opt.badge}
                        </span>
                        <span className="text-[9px] font-mono text-amber-200 md:hidden">
                          {opt.shieldsLabel}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                        {opt.title}
                      </h3>
                      <p
                        className="text-xs text-slate-300 mt-[2px] leading-snug line-clamp-2"
                        style={{ fontSize: '12px' }}
                      >
                        {opt.subtitle}
                      </p>
                    </div>

                    <div className="hidden md:block pt-1.5 border-t border-slate-800/80 space-y-0.5 text-[10px] font-mono text-slate-300">
                      <div>{opt.shieldsLabel}</div>
                      <div className="text-amber-200/90">{opt.mathTierLabel}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Hub Footer Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => toggleCodex(true)}
                  data-testid="btn-hub-open-codex"
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono font-bold text-cyan-200 transition cursor-pointer"
                >
                  📚 Explorar as 8 Lentes [H]
                </button>

                <button
                  type="button"
                  onClick={handleStartMatchFullscreen}
                  data-testid="btn-start-match-fullscreen"
                  title="Iniciar partida diretamente em Tela Cheia [F]"
                  className="px-3 py-2 rounded-xl bg-purple-950/90 hover:bg-purple-900 border border-purple-400/60 text-xs font-mono font-bold text-purple-100 transition cursor-pointer"
                >
                  ⛶ Tela Cheia [F]
                </button>
              </div>

              <button
                type="button"
                onClick={handleStartMatch}
                data-testid="btn-start-match"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-extrabold font-mono text-xs sm:text-sm shadow-[0_0_25px_rgba(34,211,238,0.45)] transition cursor-pointer"
              >
                ▶ INICIAR PARTIDA ({MODE_OPTIONS.find((m) => m.mode === mode)?.title})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PAUSED OVERLAY
          ===================================================================== */}
      {phase === 'PAUSED' && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
          style={{ zIndex: 1150 }}
          data-testid="paused-overlay"
        >
          <div className="w-full max-w-md rounded-3xl bg-slate-900/95 border-2 border-cyan-400/60 p-6 text-center space-y-4 shadow-2xl">
            <div className="text-3xl">⏸️</div>
            <h2 className="text-xl font-extrabold text-white">Partida em Pausa</h2>
            <p className="text-xs text-slate-300">
              Respire fundo! O tabuleiro Base-10 aguarda seu próximo movimento.
            </p>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={resumeGame}
                data-testid="btn-resume-match"
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold font-mono text-sm transition cursor-pointer"
              >
                ▶ Retomar Partida [P]
              </button>

              <button
                type="button"
                onClick={() => toggleCodex(true)}
                data-testid="btn-pause-open-codex"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono font-bold text-cyan-200 transition cursor-pointer"
              >
                📚 Abrir Códice Pedagógico [H]
              </button>

              <button
                type="button"
                onClick={returnToHub}
                data-testid="btn-pause-return-hub"
                className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                ⇄ Voltar ao Hub de Modos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CELEBRATORY GAME OVER OVERLAY (`Melhoria 07-B / 06-C`)
          ===================================================================== */}
      {phase === 'GAME_OVER' && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
          style={{ zIndex: 1150 }}
          data-testid="game-over-overlay"
        >
          <div className="w-full max-w-lg rounded-3xl bg-slate-900/95 border-2 border-amber-400/70 p-6 text-center space-y-4 shadow-[0_0_45px_rgba(251,191,36,0.28)]">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-xs font-mono font-bold text-amber-200">
              🏆 JORNADA CONCLUÍDA COM HONRA!
            </span>

            <h2 className="text-2xl font-extrabold text-white">
              Sua Mente Moldou o Tabuleiro!
            </h2>
            <p className="text-xs text-slate-300">
              Cada conta realizada fortaleceu seus atalhos mentais de Base-10 e equilíbrio.
            </p>

            {/* Session & Lifetime Achievements Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center font-mono">
              <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">PONTOS</div>
                <div className="text-base font-extrabold text-white">
                  {score.toLocaleString('pt-BR')}
                </div>
              </div>
              <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">LINHAS (NV {level})</div>
                <div className="text-base font-extrabold text-emerald-300">{lines}</div>
              </div>
              <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">CONTAS NA SESSÃO</div>
                <div className="text-base font-extrabold text-cyan-300">{solvedCount}</div>
              </div>
              <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">MAIOR SEQUÊNCIA</div>
                <div className="text-base font-extrabold text-yellow-300">
                  👑 ×{maxStreakInSession}
                </div>
              </div>
              <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">DOBRAS DO CORDÃO TRÍPLICE</div>
                <div className="text-base font-extrabold text-purple-300">
                  🌀 {totalStyleShiftsCount}
                </div>
              </div>
              <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-2.5">
                <div className="text-[10px] text-slate-400">RECORDE GERAL</div>
                <div className="text-base font-extrabold text-amber-300">
                  {stats.highScore.toLocaleString('pt-BR')}
                </div>
              </div>
            </div>

            {/* Agonist Triple Cord & Dopamine Session Summary (`data-testid="gameover-trinity-summary"` — `Melhoria 08-A`) */}
            <div
              data-testid="gameover-trinity-summary"
              className="rounded-2xl bg-slate-950/90 border border-amber-400/40 p-3 text-left space-y-1.5 font-mono"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-amber-300">
                  🔥 Sequência Máx: ×{maxStreakInSession}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-bold text-amber-100">
                  {soundEngine.getDopamineStageDescriptor(maxStreakInSession).badgePt}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 flex-wrap">
                <span>🌀 Dobras do Cordão Tríplice: {totalStyleShiftsCount}</span>
                <span>🧠 Contas Resolvidas: {solvedCount}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleCodex(true)}
              data-testid="gameover-open-codex"
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-400/60 text-xs font-mono font-extrabold text-cyan-200 transition cursor-pointer"
            >
              📜 Revisar Códice & Aulas desta Partida [H]
            </button>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => toggleCodex(true)}
                data-testid="btn-gameover-open-codex"
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono font-bold text-cyan-200 transition cursor-pointer"
              >
                📚 Revisar Contas no Códice ({solvedCount})
              </button>

              <button
                type="button"
                onClick={() => startGame(mode)}
                data-testid="btn-play-again"
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-extrabold font-mono text-sm transition cursor-pointer shadow-lg"
              >
                ↻ Jogar Novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mathematical Intervention Modal (`[M]`, `[B]`, `Second Wind`) */}
      <MathInterventionModal />

      {/* Retractable Pedagogical Codex Drawer (`[H]`) */}
      <LogicCodexDrawer />
    </div>
  )
}
export default LogicTetrisGame
