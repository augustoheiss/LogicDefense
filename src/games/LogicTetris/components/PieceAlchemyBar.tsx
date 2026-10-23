import React from 'react'
import { PieceDefinition, PieceType, RotationState } from '../types'
import { FRUIT_CATALOG } from '../engine/fruitMatchEngine'
import { ALL_PIECE_TYPES, getPieceDefinition } from '../engine/tetrominoes'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'

export interface PieceAlchemyBarProps {
  className?: string
  compact?: boolean
}

/**
 * Renders a compact 4x4 or 2x2 mini-matrix preview of a tetromino / special piece
 * in the requested rotation state (`0 | 1 | 2 | 3`).
 */
export const MiniPieceMatrixPreview: React.FC<{
  def: PieceDefinition
  cellSizePx?: number
  rotation?: RotationState
}> = ({ def, cellSizePx = 7, rotation = 0 }) => {
  const matrix = def.matrices[rotation] ?? def.matrices[0]

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
 * Polymorphic Tactical Piece Alchemy Bar (`PieceAlchemyBar.tsx`) — Adapts its Oracle
 * and Life-Saving Mathematical Miracles (`[M]` & `[B]`) across all 3 Trinity Styles:
 * - `TETRIS_CLASSIC`: Morph active falling tetromino (`[M]`) or Seal Buried Cavities (`[B]`).
 * - `FRUIT_MATCH`: Forge Star Prism Wildcard Pair `✦ + ✦` (`[M]`) or Magnetic Fruit Collapse (`[B]`).
 * - `TACTILE_GRID`: Morph selected Tray Slot (`[M]`) or Seal Horizontal/Vertical Line (`[B]`).
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 05-A / 06-A`: Polymorphic Oracle (`data-testid="oracle-recommendation-reason"`)
 *   and contextual labels on `btn-trigger-morph` and `btn-trigger-fill-hole`.
 * - `Melhoria 05-D`: Preserves all deterministic `data-testid` attributes (`piece-alchemy-bar`,
 *   `alchemy-piece-${type}`, `btn-trigger-morph`, `btn-trigger-fill-hole`).
 */
export const PieceAlchemyBar: React.FC<PieceAlchemyBarProps> = ({
  className = '',
  compact = false,
}) => {
  const phase = useLogicTetrisStore((s) => s.phase)
  const activeSubGameStyle = useLogicTetrisStore((s) => s.activeSubGameStyle)
  const activePiece = useLogicTetrisStore((s) => s.activePiece)
  const topology = useLogicTetrisStore((s) => s.topology)
  const fruitOracle = useLogicTetrisStore((s) => s.fruitOracle)
  const tactileTopology = useLogicTetrisStore((s) => s.tactileTopology)
  const tactileTray = useLogicTetrisStore((s) => s.tactileTray)
  const selectedTraySlot = useLogicTetrisStore((s) => s.selectedTraySlot)
  const activeChallenge = useLogicTetrisStore((s) => s.activeChallenge)

  const triggerMathMorph = useLogicTetrisStore((s) => s.triggerMathMorph)
  const setMorphTargetPiece = useLogicTetrisStore((s) => s.setMorphTargetPiece)
  const triggerMathFillHole = useLogicTetrisStore((s) => s.triggerMathFillHole)

  const isInteractive =
    phase === 'PLAYING' || phase === 'MATH_MORPH' || phase === 'MATH_FILL_HOLE'

  const recommendedType =
    activeSubGameStyle === 'TACTILE_GRID'
      ? tactileTopology.recommendedPiece
      : topology.recommendedPiece
  const recommendedDef = getPieceDefinition(recommendedType)

  const currentTrayOpt = tactileTray[selectedTraySlot]
  const currentDef =
    activeSubGameStyle === 'TACTILE_GRID' && currentTrayOpt
      ? getPieceDefinition(currentTrayOpt.type)
      : getPieceDefinition(activePiece.type)

  const buriedCount = topology.buriedCavities.length
  const topCavity = topology.buriedCavities[0]
  const recommendedFruitMeta =
    FRUIT_CATALOG[fruitOracle.recommendedFruit] ?? FRUIT_CATALOG.APPLE_RUBY
  const fragmentedFruitMeta =
    FRUIT_CATALOG[fruitOracle.mostFragmentedFruit] ?? FRUIT_CATALOG.CITRUS_GOLD

  const handleSelectPiece = (targetType: PieceType) => {
    if (!isInteractive) return
    if (phase === 'MATH_MORPH') {
      setMorphTargetPiece(targetType)
    } else {
      triggerMathMorph(targetType)
    }
  }

  // Contextual Oracle Badge & Pedagogical Text (Melhoria 06-A)
  const oracleBadgeText =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? `★ ORÁCULO: ${recommendedFruitMeta.emoji} ${recommendedFruitMeta.namePt} (Col ${fruitOracle.recommendedCol + 1})`
      : activeSubGameStyle === 'TACTILE_GRID'
        ? `★ ORÁCULO: ${recommendedDef.label} (${recommendedDef.symbol}) · ${tactileTopology.goldenCrossroads.length} Cruzamento(s) ✚`
        : `★ ORÁCULO: ${recommendedDef.label} (${recommendedDef.symbol})`

  const oracleReasonText =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? fruitOracle.pedagogicalHint
      : activeSubGameStyle === 'TACTILE_GRID'
        ? tactileTopology.pedagogicalHint
        : topology.recommendationReason

  // Contextual [M] & [B] Labels (Melhoria 06-A)
  const morphTitle =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? '⭐ Par Coringa (✦ + ✦)'
      : activeSubGameStyle === 'TACTILE_GRID'
        ? `✨ Moldar Bandeja (${currentDef.label} → ${recommendedDef.label})`
        : `✨ Mudar Peça Atual (${currentDef.label} → ${recommendedDef.label})`

  const morphSubtitle =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? 'Conecta com qualquer fruta para fechar 2 + 1 = 3!'
      : activeSubGameStyle === 'TACTILE_GRID'
        ? 'Transmuta o slot ativo p/ 1×1 ou formato ideal!'
        : 'Escolhe a melhor peça p/ o tabuleiro Base-10!'

  const fillHoleTitle =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? `🧲 Imã de Frutas (${fragmentedFruitMeta.emoji})`
      : activeSubGameStyle === 'TACTILE_GRID'
        ? '✦ Selar Linha/Coluna H×V'
        : buriedCount > 0
          ? `🧱 Tapar ${buriedCount} Buraco${buriedCount > 1 ? 's' : ''}`
          : '💎 Forjar Cristal 1×1'

  const fillHoleSubtitle =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? `Colapsa todas as frutas ${fragmentedFruitMeta.namePt} isoladas!`
      : activeSubGameStyle === 'TACTILE_GRID'
        ? 'Preenche até 3 casas na Linha ou Coluna H×V!'
        : topCavity
          ? `Linha a +${topCavity.missingInRow} do 10 · Sela com Ouro!`
          : 'Sem buracos: concede Monominó 1×1!'

  const isFillHoleHighlighted =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? fruitOracle.fragmentedCount >= 2
      : activeSubGameStyle === 'TACTILE_GRID'
        ? tactileTopology.goldenCrossroads.length > 0 ||
          Object.keys(tactileTopology.rowComplements).length > 0 ||
          Object.keys(tactileTopology.colComplements).length > 0
        : buriedCount > 0

  return (
    <section
      className={`lt-glass-panel rounded-2xl p-3.5 flex flex-col gap-3 ${className}`}
      aria-label="Forja de Alquimia Geométrica e Balança da Dezena"
      data-testid="piece-alchemy-bar"
    >
      {/* Header & Topological Oracle Recommendation (`Melhoria 05-A / 06-A`) */}
      <div className="flex flex-col gap-1.5 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400 text-sm">🔮</span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Alquimia Matemática Salva-Vidas
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[10px] font-mono font-semibold text-amber-200">
            {oracleBadgeText}
          </span>
        </div>

        {/* Live Polymorphic Oracle Explanation */}
        <p
          className="text-[11px] text-slate-300 leading-snug bg-slate-900/75 border border-slate-800 rounded-lg px-2.5 py-1.5"
          data-testid="oracle-recommendation-reason"
        >
          <span className="text-amber-300 font-semibold">Oráculo do Cordão Tríplice: </span>
          {oracleReasonText}
        </p>
      </div>

      {/* Primary Action Miracle Buttons: [M] & [B] (`Melhoria 05-D / 06-A`) */}
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
              <span className="text-xs font-bold text-cyan-100">{morphTitle}</span>
            </div>
            <span className="text-[10px] text-cyan-200/80 mt-0.5">{morphSubtitle}</span>
          </div>
          <span className="text-lg font-mono text-cyan-300 group-hover:scale-110 transition">
            {activeSubGameStyle === 'FRUIT_MATCH' ? '✦' : recommendedDef.symbol}
          </span>
        </button>

        <button
          type="button"
          disabled={!isInteractive}
          onClick={() => triggerMathFillHole()}
          data-testid="btn-trigger-fill-hole"
          className={`group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition disabled:opacity-45 disabled:pointer-events-none cursor-pointer shadow-md ${
            isFillHoleHighlighted
              ? 'bg-gradient-to-r from-amber-950/90 to-yellow-950/80 hover:from-amber-900/90 hover:to-yellow-900/80 border-amber-400/70 hover:border-amber-300 lt-oracle-recommended'
              : 'bg-slate-900/80 hover:bg-slate-800/85 border-slate-700/80 hover:border-amber-400/50'
          }`}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-300/50 text-[10px] font-mono font-bold text-amber-200">
                [B]
              </span>
              <span className="text-xs font-bold text-amber-100">{fillHoleTitle}</span>
            </div>
            <span className="text-[10px] text-amber-200/85 mt-0.5">{fillHoleSubtitle}</span>
          </div>
          <span className="text-lg font-mono text-amber-300 group-hover:scale-110 transition">
            {activeSubGameStyle === 'FRUIT_MATCH' ? '🧲' : '✦'}
          </span>
        </button>
      </div>

      {/* 9-Piece Direct Selection Grid (7 Standard Tetrominoes + 1x1 Monomino + 1x2 Domino) */}
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
          <span>
            {activeSubGameStyle === 'TACTILE_GRID'
              ? 'CLIQUE P/ MOLDAR O SLOT SELECIONADO DA BANDEJA:'
              : 'CLIQUE NA PEÇA QUE VOCÊ PRECISA MOLDAR:'}
          </span>
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
            const isCurrentlyActive =
              activeSubGameStyle === 'TACTILE_GRID'
                ? currentTrayOpt?.type === type
                : type === activePiece.type
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
                      : isCurrentlyActive
                        ? 'bg-slate-800/90 border-cyan-500/50'
                        : 'bg-slate-900/75 hover:bg-slate-800/90 border-slate-800 hover:border-slate-600'
                }`}
              >
                {/* Oracle Star Indicator */}
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
