import React from 'react'
import { GameMode } from '../types'
import { getPieceDefinition } from '../engine/tetrominoes'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'
import { MiniPieceMatrixPreview } from './PieceAlchemyBar'

export interface TelemetryHUDProps {
  className?: string
}

const MODE_LABELS: Record<GameMode, { badge: string; color: string }> = {
  zen: {
    badge: '🌱 Zen Passatempo',
    color: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200',
  },
  arcade: {
    badge: '⚡ Gênesis Arcade',
    color: 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200',
  },
  master: {
    badge: '🔥 Mestre da Balança',
    color: 'bg-amber-500/20 border-amber-400/50 text-amber-200',
  },
}

/**
 * Telemetry HUD & Queue Panel (`TelemetryHUD.tsx`).
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 07-C`: Displays clickable `Hold [C]` slot, `Next 3 Pieces` queue with
 *   `MiniPieceMatrixPreview` & `areaFormula`, `Phoenix Shields (🛡️)`, `Logic Charge (%)`,
 *   and quick controls (`Mute`, `Pause [P]`, `Codex [H]`, `Mode Hub`).
 * - `Melhoria 07-D`: Deterministic `data-testid` attributes (`hud-score`, `hud-lines`,
 *   `hud-phoenix-shields`, `btn-hold-piece`, `btn-toggle-codex`, `btn-toggle-mute`, `btn-toggle-pause`).
 */
export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ className = '' }) => {
  const phase = useLogicTetrisStore((s) => s.phase)
  const mode = useLogicTetrisStore((s) => s.mode)
  const score = useLogicTetrisStore((s) => s.score)
  const lines = useLogicTetrisStore((s) => s.lines)
  const level = useLogicTetrisStore((s) => s.level)
  const combo = useLogicTetrisStore((s) => s.combo)
  const logicCharge = useLogicTetrisStore((s) => s.logicCharge)
  const phoenixShields = useLogicTetrisStore((s) => s.phoenixShields)
  const holdPieceType = useLogicTetrisStore((s) => s.holdPieceType)
  const canHold = useLogicTetrisStore((s) => s.canHold)
  const nextQueue = useLogicTetrisStore((s) => s.nextQueue)
  const solvedCount = useLogicTetrisStore((s) => s.solvedHistory.length)
  const isMuted = useLogicTetrisStore((s) => s.isMuted)
  const highScore = useLogicTetrisStore((s) => s.stats.highScore)

  const holdCurrentPiece = useLogicTetrisStore((s) => s.holdCurrentPiece)
  const togglePause = useLogicTetrisStore((s) => s.togglePause)
  const toggleCodex = useLogicTetrisStore((s) => s.toggleCodex)
  const toggleMute = useLogicTetrisStore((s) => s.toggleMute)
  const returnToHub = useLogicTetrisStore((s) => s.returnToHub)

  const modeInfo = MODE_LABELS[mode]
  const holdDef = holdPieceType ? getPieceDefinition(holdPieceType) : null
  const nextThree = nextQueue.slice(0, 3)
  const linesToNextShield = 10 - (lines % 10)

  return (
    <aside
      className={`flex flex-col gap-3 ${className}`}
      aria-label="Painel de Telemetria, Fila de Peças e Escudos Fênix"
    >
      {/* Top Action & Mode Bar */}
      <div className="lt-glass-panel rounded-2xl p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span
            className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold ${modeInfo.color}`}
          >
            {modeInfo.badge}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              data-testid="btn-toggle-mute"
              title={isMuted ? 'Ativar Som Pentatônico' : 'Silenciar Áudio'}
              className="px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 transition cursor-pointer"
            >
              {isMuted ? '🔇 Mudo' : '🔊 Som'}
            </button>

            <button
              type="button"
              onClick={() => toggleCodex()}
              data-testid="btn-toggle-codex"
              title="Abrir Códice Pedagógico e Histórico de Contas [H]"
              className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/50 text-xs font-mono font-semibold text-cyan-200 transition cursor-pointer flex items-center gap-1"
            >
              <span>📚 Códice [H]</span>
              {solvedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-extrabold">
                  {solvedCount}
                </span>
              )}
            </button>

            {(phase === 'PLAYING' || phase === 'PAUSED') && (
              <button
                type="button"
                onClick={togglePause}
                data-testid="btn-toggle-pause"
                className="px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 transition cursor-pointer"
              >
                {phase === 'PAUSED' ? '▶️ [P]' : '⏸️ [P]'}
              </button>
            )}
          </div>
        </div>

        {/* Score, Lines, Level & Phoenix Shields Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Pontuação (Recorde: {highScore.toLocaleString('pt-BR')})
            </div>
            <div
              className="text-lg font-extrabold font-mono text-white tracking-tight"
              data-testid="hud-score"
            >
              {score.toLocaleString('pt-BR')}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2">
            <div className="text-[10px] font-mono uppercase text-slate-400">
              Linhas Base-10 · Nível {level}
            </div>
            <div className="flex items-baseline justify-between">
              <span
                className="text-lg font-extrabold font-mono text-emerald-300"
                data-testid="hud-lines"
              >
                {lines}
              </span>
              {combo > 0 && (
                <span className="text-[11px] font-mono font-bold text-amber-300 animate-pulse">
                  🔥 Combo ×{combo + 1}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Phoenix Shields (Protocolo 142857) & Logic Charge */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-purple-950/40 border border-purple-500/40 px-3 py-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-purple-200">
              <span>ESCUDO FÊNIX</span>
              <span className="text-amber-300 font-bold" data-testid="hud-phoenix-shields">
                {mode === 'zen' ? '🛡️ ∞ (Zen)' : `🛡️ ×${phoenixShields}`}
              </span>
            </div>
            <div className="text-[10px] text-purple-200/80 mt-0.5 leading-tight">
              {mode === 'zen'
                ? 'Salvação Fênix ilimitada no topo!'
                : `+1 escudo em ${linesToNextShield} linha(s)`}
            </div>
          </div>

          <div className="rounded-xl bg-cyan-950/40 border border-cyan-500/40 px-3 py-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-cyan-200">
              <span>CARGA LÓGICA</span>
              <span className="font-bold text-cyan-300">{logicCharge}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden mt-[4px] border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, logicCharge))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hold [C] & Next 3 Pieces Queue (`Melhoria 07-C`) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Hold Piece Slot */}
        <button
          type="button"
          disabled={phase !== 'PLAYING' || !canHold}
          onClick={() => holdCurrentPiece()}
          data-testid="btn-hold-piece"
          title="Guardar peça atual para usar depois (Tecla [C] ou [Shift])"
          className="lt-glass-panel rounded-2xl p-3 flex flex-col items-center justify-between text-center hover:border-cyan-400/60 transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-300">
            <span>RESERVA</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-bold">
              [C]
            </span>
          </div>

          <div className="my-2 min-h-[44px] flex items-center justify-center">
            {holdDef ? (
              <MiniPieceMatrixPreview def={holdDef} cellSizePx={8} />
            ) : (
              <span className="text-[11px] font-mono text-slate-500">Vazio (Clique)</span>
            )}
          </div>

          <div className="text-[10px] font-mono text-slate-300">
            {holdDef ? `${holdDef.namePt} (${holdDef.areaFormula})` : 'Guarda 1 peça'}
          </div>
        </button>

        {/* Next 3 Pieces Queue */}
        <div
          className="lt-glass-panel rounded-2xl p-3 flex flex-col justify-between"
          data-testid="hud-next-queue"
        >
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1.5">
            <span>PRÓXIMAS (7-BAG)</span>
            <span className="text-emerald-300">3 PEÇAS</span>
          </div>

          <div className="flex items-center justify-around gap-1 my-auto">
            {nextThree.map((type, idx) => {
              const def = getPieceDefinition(type)
              return (
                <div
                  key={`${type}_${idx}`}
                  className="flex flex-col items-center gap-1"
                  title={`${def.namePt} (${def.areaFormula})`}
                >
                  <MiniPieceMatrixPreview def={def} cellSizePx={idx === 0 ? 7 : 5.5} />
                  <span className="text-[9px] font-mono text-slate-300">
                    {def.label}
                    <span style={{ color: def.borderColor }} className="ml-0.5">
                      {def.symbol}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>

          <div className="text-[9px] font-mono text-slate-400 text-center mt-[4px]">
            Ou pressione [M] p/ escolher!
          </div>
        </div>
      </div>

      {/* Mode Hub Return Button when playing */}
      {phase !== 'START_HUB' && (
        <button
          type="button"
          onClick={returnToHub}
          data-testid="btn-return-hub"
          className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 underline underline-offset-2 self-end cursor-pointer"
        >
          ⇄ Trocar Modo de Jogo (Zen / Arcade / Mestre)
        </button>
      )}
    </aside>
  )
}
