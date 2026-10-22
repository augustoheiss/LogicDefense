import React from 'react'
import { GameMode } from './types'
import { useGameLoop } from './hooks/useGameLoop'
import { useLogicTetrisStore } from './state/useLogicTetrisStore'
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

/**
 * Main Orchestrator Component for Logic Tetris (Genesis Edition) (`LogicTetrisGame.tsx`).
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 07-A`: Connects `LogicCodexDrawer` (`[H]`) with Live Session Diary + 8 Lenses Guide.
 * - `Melhoria 07-B`: Welcoming 3-Mode `START_HUB` selector (`Zen`, `Arcade`, `Mestre`) & celebratory
 *   `GAME_OVER` summary card highlighting math miracles achieved.
 * - `Melhoria 07-C`: Integrates `TelemetryHUD`, `TetrisCanvas`, `PieceAlchemyBar`, and `TouchControlPad`.
 * - `Melhoria 07-D`: Deterministic `data-testid` attributes for Playwright E2E verification.
 */
export const LogicTetrisGame: React.FC<LogicTetrisGameProps> = ({ className = '' }) => {
  useGameLoop({ enabled: true, enableKeyboard: true })

  const phase = useLogicTetrisStore((s) => s.phase)
  const mode = useLogicTetrisStore((s) => s.mode)
  const score = useLogicTetrisStore((s) => s.score)
  const lines = useLogicTetrisStore((s) => s.lines)
  const level = useLogicTetrisStore((s) => s.level)
  const stats = useLogicTetrisStore((s) => s.stats)
  const solvedCount = useLogicTetrisStore((s) => s.solvedHistory.length)

  const setMode = useLogicTetrisStore((s) => s.setMode)
  const startGame = useLogicTetrisStore((s) => s.startGame)
  const resumeGame = useLogicTetrisStore((s) => s.resumeGame)
  const returnToHub = useLogicTetrisStore((s) => s.returnToHub)
  const toggleCodex = useLogicTetrisStore((s) => s.toggleCodex)
  const triggerMathFillHole = useLogicTetrisStore((s) => s.triggerMathFillHole)

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

  return (
    <div
      className={`lt-genesis-shell relative rounded-3xl p-3 sm:p-5 border border-slate-800/90 shadow-2xl ${className}`}
      data-testid="logic-tetris-game"
      data-game-phase={phase}
      data-game-mode={mode}
    >
      {/* Main Responsive Arena Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left/Center Column: 20x10 Base-10 Canvas + Touch Pad */}
        <div className="lg:col-span-5 flex flex-col items-center gap-3">
          <TetrisCanvas
            onCavityClick={() => triggerMathFillHole()}
            className="w-full max-w-[382px]"
          />
          <TouchControlPad className="w-full max-w-[382px]" />
        </div>

        {/* Right Column: Telemetry HUD + Piece Alchemy Bar */}
        <div className="lg:col-span-7 flex flex-col gap-3.5">
          <TelemetryHUD />
          <PieceAlchemyBar />
        </div>
      </div>

      {/* =====================================================================
          START HUB OVERLAY (3-Mode Selection: Zen / Arcade / Master — Melhoria 07-B)
          ===================================================================== */}
      {phase === 'START_HUB' && (
        <div
          className="fixed inset-0 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
          style={{ zIndex: 1150 }}
          data-testid="start-hub-overlay"
        >
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900/95 border-2 border-cyan-500/60 shadow-[0_0_50px_rgba(6,182,212,0.28)] p-5 sm:p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 flex-wrap border-b border-slate-800 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-[11px] font-mono font-bold text-cyan-200">
                  🏛️ LOGIC TETRIS (GENESIS EDITION)
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1.5">
                  Onde a Matemática Salva a Sua Vida no Jogo!
                </h2>
                <p
                  className="text-xs sm:text-sm text-slate-300 mt-[4px]"
                  style={{ fontSize: '13px' }}
                >
                  Precisa da barra <strong className="text-cyan-300">I</strong>? Soterraram um
                  buraco na pilha? Chegou no topo? Resolva uma conta mental das 4 operações para{' '}
                  <strong className="text-amber-300">mudar a peça [M]</strong>,{' '}
                  <strong className="text-amber-300">tapar buracos com ouro [B]</strong> ou ativar o{' '}
                  <strong className="text-purple-300">Protocolo Fênix 142857</strong>!
                </p>
              </div>
            </div>

            {/* Mastery Memory & Warm Encouragement Banner (`Melhoria 10-B`) */}
            <div
              className="rounded-2xl bg-slate-950/85 border border-cyan-500/30 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
              data-testid="hub-mastery-banner"
            >
              <div className="flex items-center gap-2 text-xs text-cyan-200 font-medium">
                <span>🌟</span>
                <span>Memória de Maestria & Bons Sentimentos:</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
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

            {/* 3 Mode Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {MODE_OPTIONS.map((opt) => {
                const isSelected = mode === opt.mode
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setMode(opt.mode)}
                    data-testid={opt.testId}
                    className={`rounded-2xl p-3.5 border-2 text-left flex flex-col justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? `${opt.accentBorder} ring-2 ring-cyan-300/60 scale-[1.01]`
                        : 'bg-slate-950/75 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-mono font-bold text-cyan-300">
                        {opt.badge}
                      </span>
                      <h3 className="text-base font-extrabold text-white mt-0.5">
                        {opt.title}
                      </h3>
                      <p
                        className="text-xs text-slate-300 mt-[4px] leading-relaxed"
                        style={{ fontSize: '12px' }}
                      >
                        {opt.subtitle}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[10px] font-mono text-slate-300">
                      <div>{opt.shieldsLabel}</div>
                      <div className="text-amber-200/90">{opt.mathTierLabel}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Hub Footer Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800 flex-wrap">
              <button
                type="button"
                onClick={() => toggleCodex(true)}
                data-testid="btn-hub-open-codex"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono font-bold text-cyan-200 transition cursor-pointer"
              >
                📚 Explorar as 8 Lentes do Códice [H]
              </button>

              <button
                type="button"
                onClick={handleStartMatch}
                data-testid="btn-start-match"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-extrabold font-mono text-sm shadow-[0_0_25px_rgba(34,211,238,0.45)] transition cursor-pointer"
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
          CELEBRATORY GAME OVER OVERLAY (`Melhoria 07-B`)
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono">
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
                <div className="text-[10px] text-slate-400">RECORDE GERAL</div>
                <div className="text-base font-extrabold text-amber-300">
                  {stats.highScore.toLocaleString('pt-BR')}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
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
