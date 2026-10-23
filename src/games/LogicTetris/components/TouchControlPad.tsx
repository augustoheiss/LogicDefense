import React from 'react'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'

export interface TouchControlPadProps {
  className?: string
}

/**
 * Ergonomic Universal Touch & Quick-Action Pad (`TouchControlPad.tsx`).
 *
 * Incorporates Auditor Improvements & Master Plan V2:
 * - `Melhoria 07-C / 06-C`: Large touch-friendly controls (`min-h-[44px]`, `touch-action: manipulation`)
 *   for `←`, `→`, `↑ Subir` (`touch-up` in `TACTILE_GRID` & `FRUIT_MATCH`), `↓ Descer`, `↻ Girar`,
 *   `⏬ Cair` / `✅ Encaixar` / `⇄ Trocar` (`touch-hard-drop`), `📦 Hold [C]`, `🔮 Mudar [M]`, `✦ Tapar [B]`,
 *   and `🌀 Estilo [G]` (`touch-cycle-style`).
 * - Preserves 100% of deterministic `data-testid` attributes (`touch-control-pad`, `touch-left`,
 *   `touch-right`, `touch-rotate-cw`, `touch-soft-drop`, `touch-hard-drop`, `touch-hold`,
 *   `touch-morph`, `touch-fill-hole`).
 */
export const TouchControlPad: React.FC<TouchControlPadProps> = ({ className = '' }) => {
  const phase = useLogicTetrisStore((s) => s.phase)
  const activeSubGameStyle = useLogicTetrisStore((s) => s.activeSubGameStyle)
  const canHold = useLogicTetrisStore((s) => s.canHold)
  const buriedCount = useLogicTetrisStore((s) => s.topology.buriedCavities.length)

  const moveHorizontal = useLogicTetrisStore((s) => s.moveHorizontal)
  const moveUp = useLogicTetrisStore((s) => s.moveUp)
  const rotatePiece = useLogicTetrisStore((s) => s.rotatePiece)
  const softDropStep = useLogicTetrisStore((s) => s.softDropStep)
  const hardDrop = useLogicTetrisStore((s) => s.hardDrop)
  const holdCurrentPiece = useLogicTetrisStore((s) => s.holdCurrentPiece)
  const triggerMathMorph = useLogicTetrisStore((s) => s.triggerMathMorph)
  const triggerMathFillHole = useLogicTetrisStore((s) => s.triggerMathFillHole)
  const cycleSubGameStyle = useLogicTetrisStore((s) => s.cycleSubGameStyle)

  const isPlaying = phase === 'PLAYING'
  const isTactile = activeSubGameStyle === 'TACTILE_GRID'
  const isFruit = activeSubGameStyle === 'FRUIT_MATCH'
  const is10x10CursorMode = isTactile || isFruit

  return (
    <section
      className={`lt-glass-panel rounded-2xl p-3 flex flex-col gap-2 select-none ${className}`}
      aria-label="Controles Táteis e Atalhos Rápidos"
      data-testid="touch-control-pad"
    >
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>CONTROLES RÁPIDOS (TOUCH & TECLADO)</span>
        <span className="text-cyan-300">SETAS / WASD · ESPAÇO · [G] · [M] · [B] · [F]</span>
      </div>

      {/* Primary Movement & Rotation Row */}
      <div className={`grid ${is10x10CursorMode ? 'grid-cols-6' : 'grid-cols-5'} gap-1.5`}>
        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => moveHorizontal(-1)}
          data-testid="touch-left"
          style={{ touchAction: 'manipulation' }}
          className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-100 font-mono font-bold text-sm flex flex-col items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>←</span>
          <span className="text-[9px] text-slate-400">Esq</span>
        </button>

        {is10x10CursorMode && (
          <button
            type="button"
            disabled={!isPlaying}
            onClick={() => moveUp()}
            data-testid="touch-up"
            style={{ touchAction: 'manipulation' }}
            className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-100 font-mono font-bold text-sm flex flex-col items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <span>↑</span>
            <span className="text-[9px] text-slate-400">Subir</span>
          </button>
        )}

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => softDropStep()}
          data-testid="touch-soft-drop"
          style={{ touchAction: 'manipulation' }}
          className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-100 font-mono font-bold text-sm flex flex-col items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>↓</span>
          <span className="text-[9px] text-slate-400">Descer</span>
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => moveHorizontal(1)}
          data-testid="touch-right"
          style={{ touchAction: 'manipulation' }}
          className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-100 font-mono font-bold text-sm flex flex-col items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>→</span>
          <span className="text-[9px] text-slate-400">Dir</span>
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => rotatePiece('CW')}
          data-testid="touch-rotate-cw"
          style={{ touchAction: 'manipulation' }}
          className="min-h-[44px] rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 active:scale-95 border border-cyan-500/50 text-cyan-100 font-mono font-bold text-sm flex flex-col items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>{isFruit ? '⇄' : '↻'}</span>
          <span className="text-[9px] text-cyan-300">
            {isFruit ? 'Trocar' : 'Girar'}
          </span>
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => hardDrop()}
          data-testid="touch-hard-drop"
          style={{ touchAction: 'manipulation' }}
          className="min-h-[44px] rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 active:scale-95 border border-emerald-500/50 text-emerald-100 font-mono font-bold text-sm flex flex-col items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>{isTactile ? '✅' : isFruit ? '🍎' : '⏬'}</span>
          <span className="text-[9px] text-emerald-300">
            {isTactile ? 'Encaixar' : isFruit ? 'Sel/Troca' : 'Cair'}
          </span>
        </button>
      </div>

      {/* Tactical Alchemy, Hold & Style Switcher Row */}
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          disabled={!isPlaying || (activeSubGameStyle === 'TETRIS_CLASSIC' && !canHold)}
          onClick={() => (isTactile ? rotatePiece('CW') : holdCurrentPiece())}
          data-testid="touch-hold"
          style={{ touchAction: 'manipulation' }}
          className="min-h-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-200 font-mono font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>{isFruit ? '🎯' : '📦'}</span>
          <span>
            {isTactile ? 'Girar [R]' : isFruit ? 'Dica [C]' : 'Reserva [C]'}
          </span>
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => triggerMathMorph()}
          data-testid="touch-morph"
          style={{ touchAction: 'manipulation' }}
          className="min-h-[44px] rounded-xl bg-cyan-950/90 hover:bg-cyan-900/90 active:scale-95 border border-cyan-400/60 text-cyan-100 font-mono font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>🔮</span>
          <span>Mudar [M]</span>
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => triggerMathFillHole()}
          data-testid="touch-fill-hole"
          style={{ touchAction: 'manipulation' }}
          className={`min-h-[44px] rounded-xl active:scale-95 border font-mono font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
            buriedCount > 0
              ? 'bg-amber-950/90 hover:bg-amber-900/90 border-amber-400 text-amber-100 lt-oracle-recommended'
              : 'bg-slate-900/90 hover:bg-slate-800 border-amber-500/40 text-amber-200'
          }`}
        >
          <span>✦</span>
          <span>Tapar [B] {buriedCount > 0 ? `(${buriedCount})` : ''}</span>
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => cycleSubGameStyle()}
          data-testid="touch-cycle-style"
          style={{ touchAction: 'manipulation' }}
          className="min-h-[44px] rounded-xl bg-purple-950/85 hover:bg-purple-900/85 active:scale-95 border border-purple-400/60 text-purple-100 font-mono font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>🌀</span>
          <span>Estilo [G]</span>
        </button>
      </div>
    </section>
  )
}
