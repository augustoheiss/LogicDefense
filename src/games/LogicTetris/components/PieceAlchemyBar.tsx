import React from 'react'
import { PieceDefinition, PieceType } from '../types'
import { ALL_PIECE_TYPES, getPieceDefinition } from '../engine/tetrominoes'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'

export interface PieceAlchemyBarProps {
  className?: string
  compact?: boolean
}

/**
 * Renders a compact 4x4 or 2x2 mini-matrix preview of a tetromino / special piece.
 */
export const MiniPieceMatrixPreview: React.FC<{
  def: PieceDefinition
  cellSizePx?: number
}> = ({ def, cellSizePx = 7 }) => {
  const matrix = def.matrices[0]

  return (
    <div
      className="inline-flex flex-col items-center justify-center gap-[1.5px] p-1 rounded bg-slate-950/70 border border-slate-800/80"
      aria-hidden="true"
    >
      {matrix.map((row, rIdx) => (
        <div key={rIdx} className="flex gap-[1.5px]">
          {row.map((val, cIdx) => (
            <span
              key={cIdx}
              style={{
                width: `${cellSizePx}px`,
                height: `${cellSizePx}px`,
                backgroundColor: val === 1 ? def.color : 'rgba(15, 23, 42, 0.35)',
                borderColor: val === 1 ? def.borderColor : 'transparent',
                boxShadow: val === 1 ? `0 0 5px ${def.glowColor}` : 'none',
              }}
              className={`inline-block rounded-[1.5px] ${val === 1 ? 'border' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Tactical Piece Alchemy Bar (`PieceAlchemyBar.tsx`) — Allows the player at any moment
 * to transmute the falling piece into the exact shape needed (`[M]` or direct click on
 * `I, O, T, S, Z, J, L, 1×1, 1×2`) or seal buried cavities with Golden Crystals (`[B]`).
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 05-A`: Highlights `topology.recommendedPiece` with `.lt-oracle-recommended`,
 *   a `★ ORÁCULO` badge, and live topological explanation `topology.recommendationReason`,
 *   plus each piece's mini-matrix, accessibility `symbol`, and `areaFormula`.
 * - `Melhoria 05-D`: Deterministic `data-testid` attributes (`piece-alchemy-bar`,
 *   `alchemy-piece-${type}`, `btn-trigger-morph`, `btn-trigger-fill-hole`) for Playwright E2E.
 */
export const PieceAlchemyBar: React.FC<PieceAlchemyBarProps> = ({
  className = '',
  compact = false,
}) => {
  const phase = useLogicTetrisStore((s) => s.phase)
  const activePiece = useLogicTetrisStore((s) => s.activePiece)
  const topology = useLogicTetrisStore((s) => s.topology)
  const activeChallenge = useLogicTetrisStore((s) => s.activeChallenge)
  const triggerMathMorph = useLogicTetrisStore((s) => s.triggerMathMorph)
  const setMorphTargetPiece = useLogicTetrisStore((s) => s.setMorphTargetPiece)
  const triggerMathFillHole = useLogicTetrisStore((s) => s.triggerMathFillHole)

  const isInteractive =
    phase === 'PLAYING' || phase === 'MATH_MORPH' || phase === 'MATH_FILL_HOLE'
  const recommendedType = topology.recommendedPiece
  const recommendedDef = getPieceDefinition(recommendedType)
  const currentDef = getPieceDefinition(activePiece.type)
  const buriedCount = topology.buriedCavities.length
  const topCavity = topology.buriedCavities[0]

  const handleSelectPiece = (targetType: PieceType) => {
    if (!isInteractive) return
    if (phase === 'MATH_MORPH') {
      setMorphTargetPiece(targetType)
    } else {
      triggerMathMorph(targetType)
    }
  }

  return (
    <section
      className={`lt-glass-panel rounded-2xl p-3.5 flex flex-col gap-3 ${className}`}
      aria-label="Forja de Alquimia Geométrica e Balança da Dezena"
      data-testid="piece-alchemy-bar"
    >
      {/* Header & Topological Oracle Recommendation (`Melhoria 05-A`) */}
      <div className="flex flex-col gap-1.5 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400 text-sm">🔮</span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Alquimia Matemática Salva-Vidas
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[10px] font-mono font-semibold text-amber-200">
            ★ ORÁCULO: {recommendedDef.label} ({recommendedDef.symbol})
          </span>
        </div>

        {/* Live Oracle Explanation */}
        <p
          className="text-[11px] text-slate-300 leading-snug bg-slate-900/75 border border-slate-800 rounded-lg px-2.5 py-1.5"
          data-testid="oracle-recommendation-reason"
        >
          <span className="text-amber-300 font-semibold">Oráculo Base-10: </span>
          {topology.recommendationReason}
        </p>
      </div>

      {/* Primary Action Miracle Buttons: [M] Mudar Peça & [B] Tapar Buraco (`Melhoria 05-D`) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!isInteractive}
          onClick={() => triggerMathMorph(recommendedType)}
          data-testid="btn-trigger-morph"
          className="group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-cyan-950/90 to-teal-950/80 hover:from-cyan-900/90 hover:to-teal-900/80 border border-cyan-400/50 hover:border-cyan-300 text-left transition disabled:opacity-45 disabled:pointer-events-none cursor-pointer shadow-md"
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-cyan-400/20 border border-cyan-300/50 text-[10px] font-mono font-bold text-cyan-200">
                [M]
              </span>
              <span className="text-xs font-bold text-cyan-100">
                Mudar Peça Atual ({currentDef.label} → {recommendedDef.label})
              </span>
            </div>
            <span className="text-[10px] text-cyan-200/80 mt-0.5">
              Resolva 1 conta p/ moldar a peça ideal!
            </span>
          </div>
          <span className="text-lg font-mono text-cyan-300 group-hover:scale-110 transition">
            {recommendedDef.symbol}
          </span>
        </button>

        <button
          type="button"
          disabled={!isInteractive}
          onClick={() => triggerMathFillHole()}
          data-testid="btn-trigger-fill-hole"
          className={`group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition disabled:opacity-45 disabled:pointer-events-none cursor-pointer shadow-md ${
            buriedCount > 0
              ? 'bg-gradient-to-r from-amber-950/90 to-yellow-950/80 hover:from-amber-900/90 hover:to-yellow-900/80 border-amber-400/70 hover:border-amber-300 lt-oracle-recommended'
              : 'bg-slate-900/80 hover:bg-slate-800/85 border-slate-700/80 hover:border-amber-400/50'
          }`}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-300/50 text-[10px] font-mono font-bold text-amber-200">
                [B]
              </span>
              <span className="text-xs font-bold text-amber-100">
                {buriedCount > 0
                  ? `Tapar ${buriedCount} Buraco${buriedCount > 1 ? 's' : ''}`
                  : 'Forjar Cristal 1×1'}
              </span>
            </div>
            <span className="text-[10px] text-amber-200/85 mt-0.5">
              {topCavity
                ? `Linha a +${topCavity.missingInRow} do 10 · Sela com Ouro!`
                : 'Sem buracos: concede Monominó 1×1!'}
            </span>
          </div>
          <span className="text-lg font-mono text-amber-300 group-hover:scale-110 transition">
            ✦
          </span>
        </button>
      </div>

      {/* 9-Piece Direct Selection Grid (7 Standard Tetrominoes + 1x1 Monomino + 1x2 Domino) */}
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
          <span>CLIQUE NA PEÇA QUE VOCÊ PRECISA MOLDAR:</span>
          <span className="text-cyan-300">ÁREA & SIMETRIA BASE-10</span>
        </div>

        <div
          className={`grid ${
            compact ? 'grid-cols-3 gap-1.5' : 'grid-cols-3 sm:grid-cols-9 gap-1.5'
          }`}
        >
          {ALL_PIECE_TYPES.map((type) => {
            const def = getPieceDefinition(type)
            const isRecommended = type === recommendedType
            const isCurrentlyFalling = type === activePiece.type
            const isSelectedInModal =
              phase === 'MATH_MORPH' && activeChallenge?.targetPiece === type

            return (
              <button
                key={type}
                type="button"
                disabled={!isInteractive}
                onClick={() => handleSelectPiece(type)}
                data-testid={`alchemy-piece-${type}`}
                title={`${def.namePt} (${def.areaFormula}) — ${def.pedagogicalNote}`}
                className={`relative flex flex-col items-center justify-between p-1.5 rounded-xl border text-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                  isSelectedInModal
                    ? 'bg-cyan-950/90 border-cyan-300 ring-2 ring-cyan-400/50'
                    : isRecommended
                      ? 'bg-amber-950/60 border-amber-400/80 lt-oracle-recommended'
                      : isCurrentlyFalling
                        ? 'bg-slate-800/90 border-cyan-500/50'
                        : 'bg-slate-900/75 hover:bg-slate-800/90 border-slate-800 hover:border-slate-600'
                }`}
              >
                {/* Oracle Star or Active Indicator */}
                {isRecommended && (
                  <span
                    className="absolute -top-1.5 -right-1 px-1 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[8px] font-extrabold tracking-tight shadow"
                    data-testid={`oracle-badge-${type}`}
                  >
                    ★ ORÁCULO
                  </span>
                )}

                <div className="flex items-center justify-between w-full px-0.5 text-[10px] font-mono">
                  <span className="font-bold text-slate-100">{def.label}</span>
                  <span style={{ color: def.borderColor }} className="font-bold">
                    {def.symbol}
                  </span>
                </div>

                <div className="my-1 flex items-center justify-center min-h-[34px]">
                  <MiniPieceMatrixPreview def={def} cellSizePx={6} />
                </div>

                <span className="text-[9px] font-mono text-slate-300/90 leading-none">
                  {def.areaFormula}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
