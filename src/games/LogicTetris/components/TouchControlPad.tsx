import React, { useState } from 'react'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'
import { SekundoIconPopover, SekundoRevealSpec } from './SekundoIconPopover'

export interface TouchControlPadProps {
  className?: string
}

/**
 * Sekundo Icon-Only Touch & Quick-Action Dock (`TouchControlPad.tsx`).
 *
 * Renders a compact, single-row icon-only control bar at the bottom of the arena:
 * - Zero text labels under buttons ("Esq", "Subir", "Descer", "Dir", etc. removed).
 * - Clicking the `⌨️` icon reveals a `<SekundoIconPopover />` ("Click-to-Reveal")
 *   with the complete keyboard & touch legend for the active Trinity style.
 * - Preserves 100% of deterministic `data-testid` attributes (`touch-control-pad`,
 *   `touch-left`, `touch-up`, `touch-soft-drop`, `touch-right`, `touch-rotate-cw`,
 *   `touch-hard-drop`, `touch-hold`, `touch-morph`, `touch-fill-hole`, `touch-cycle-style`).
 */
export const TouchControlPad: React.FC<TouchControlPadProps> = ({ className = '' }) => {
  const [showLegendPopover, setShowLegendPopover] = useState(false)

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

  const legendSpec: SekundoRevealSpec | null = showLegendPopover
    ? {
        id: 'controls-legend',
        icon: '⌨️',
        title: 'Mapa de Controles Rápidos (Touch & Teclado)',
        shortcut: 'WASD / Setas',
        badge: isTactile ? 'Grade 10×10' : isFruit ? 'Frutas 10×10' : 'Clássico 20×10',
        description: isFruit
          ? 'Clique/arraste 2 frutas vizinhas ou use Setas/WASD + Espaço/Enter para trocar! [C] foca a melhor dica do Oráculo, [M] forja Estrelas Coringa, [B] lança o Imã e [G] troca de estilo.'
          : isTactile
            ? 'Escolha [1], [2] ou [3] na bandeja, gire com [R] e clique na Arena 10×10 (ou use Setas + Enter/Espaço) para encaixar! [M] molda a peça, [B] sela linha H×V e [G] troca de estilo.'
            : 'Setas/WASD movem, [↑]/[R] gira, [Espaço] cai direto, [C] guarda na Reserva, [M] muda a peça em queda, [B] tapa buracos soterrados com Ouro, [G] troca de estilo e [F] abre Tela Cheia!',
        accentColor: 'cyan',
      }
    : null

  return (
    <section
      className={`relative w-full lt-glass-panel rounded-2xl px-2.5 py-1.5 flex items-center justify-between gap-1.5 flex-wrap select-none z-20 ${className}`}
      aria-label="Controles Táteis e Atalhos Rápidos Icon-Only"
      data-testid="touch-control-pad"
    >
      {/* Primary D-Pad & Drop Icon Strip */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => moveHorizontal(-1)}
          data-testid="touch-left"
          title="Mover para a Esquerda (← / A)"
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-100 font-mono font-bold text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          ←
        </button>

        {is10x10CursorMode && (
          <button
            type="button"
            disabled={!isPlaying}
            onClick={() => moveUp()}
            data-testid="touch-up"
            title="Subir Cursor na Arena 10×10 (↑ / W)"
            style={{ touchAction: 'manipulation' }}
            className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-100 font-mono font-bold text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            ↑
          </button>
        )}

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => softDropStep()}
          data-testid="touch-soft-drop"
          title="Descer (↓ / S)"
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-100 font-mono font-bold text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          ↓
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => moveHorizontal(1)}
          data-testid="touch-right"
          title="Mover para a Direita (→ / D)"
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-100 font-mono font-bold text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          →
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => rotatePiece('CW')}
          data-testid="touch-rotate-cw"
          title={isFruit ? 'Trocar Frutas (⇄ / R)' : 'Girar Peça (↻ / R)'}
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 rounded-xl bg-cyan-950/85 hover:bg-cyan-900/85 active:scale-95 border border-cyan-500/50 text-cyan-100 font-mono font-bold text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          {isFruit ? '⇄' : '↻'}
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => hardDrop()}
          data-testid="touch-hard-drop"
          title={
            isTactile
              ? 'Encaixar Peça na Arena 10×10 (Enter / Espaço)'
              : isFruit
                ? 'Selecionar / Trocar Fruta (Enter / Espaço)'
                : 'Queda Rápida (Espaço)'
          }
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 rounded-xl bg-emerald-950/85 hover:bg-emerald-900/85 active:scale-95 border border-emerald-500/50 text-emerald-100 font-mono font-bold text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          {isTactile ? '✅' : isFruit ? '🍎' : '⏬'}
        </button>
      </div>

      {/* Tactical Quick-Action Icons (`[C]`, `[M]`, `[B]`, `[G]`, `⌨️`) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!isPlaying || (activeSubGameStyle === 'TETRIS_CLASSIC' && !canHold)}
          onClick={() => (isTactile ? rotatePiece('CW') : holdCurrentPiece())}
          data-testid="touch-hold"
          title={
            isTactile
              ? 'Girar Peça da Bandeja [R]'
              : isFruit
                ? 'Focar Dica do Oráculo [C]'
                : 'Guardar na Reserva [C]'
          }
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-200 text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          {isFruit ? '🎯' : '📦'}
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => triggerMathMorph()}
          data-testid="touch-morph"
          title="Alquimia Matemática: Mudar Peça / Estrelas Coringa [M]"
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 rounded-xl bg-cyan-950/90 hover:bg-cyan-900/90 active:scale-95 border border-cyan-400/60 text-cyan-100 text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          🔮
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => triggerMathFillHole()}
          data-testid="touch-fill-hole"
          title="Milagre Matemático: Tapar Buracos / Imã de Frutas [B]"
          style={{ touchAction: 'manipulation' }}
          className={`relative w-9 h-9 rounded-xl active:scale-95 border text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
            buriedCount > 0
              ? 'bg-amber-950/90 hover:bg-amber-900/90 border-amber-400 text-amber-100 lt-oracle-recommended'
              : 'bg-slate-900/90 hover:bg-slate-800 border-amber-500/40 text-amber-200'
          }`}
        >
          <span>✦</span>
          {buriedCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[8px] font-mono font-extrabold">
              {buriedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={() => cycleSubGameStyle()}
          data-testid="touch-cycle-style"
          title="Alternar Estilo do Cordão Tríplice [G]"
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 rounded-xl bg-purple-950/85 hover:bg-purple-900/85 active:scale-95 border border-purple-400/60 text-purple-100 text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          🌀
        </button>

        {/* Sekundo Click-to-Reveal Controls Legend Button (`data-testid="btn-controls-legend"`) */}
        <button
          type="button"
          onClick={() => setShowLegendPopover((prev) => !prev)}
          data-testid="btn-controls-legend"
          title="Revelar Mapa de Teclas e Comandos (Click-to-Reveal)"
          className={`w-9 h-9 rounded-xl border text-xs flex items-center justify-center transition cursor-pointer ${
            showLegendPopover
              ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
              : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-cyan-300'
          }`}
        >
          ⌨️
        </button>
      </div>

      {/* Sekundo Click-to-Reveal Controls Legend Popover */}
      <SekundoIconPopover
        spec={legendSpec}
        onClose={() => setShowLegendPopover(false)}
        dockPosition="bottom"
      />
    </section>
  )
}
