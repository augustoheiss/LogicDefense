import React, { useState } from 'react'
import {
  MiraclePowerTier,
  PieceDefinition,
  PieceType,
  RotationState,
} from '../types'
import { FRUIT_CATALOG } from '../engine/fruitMatchEngine'
import {
  getAllMiracleTierSpecs,
  getMiracleTierSpec,
} from '../engine/mathEngine'
import {
  CLASSIC_PIECE_TYPES,
  TACTILE_MACRO_PIECE_TYPES,
  getPieceDefinition,
} from '../engine/tetrominoes'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'
import { SekundoIconPopover, SekundoRevealSpec } from './SekundoIconPopover'

export interface PieceAlchemyBarProps {
  className?: string
  compact?: boolean
}

/**
 * Renders a compact 4x4, 5x5, or 3x3 mini-matrix preview of a tetromino / macro-polyomino
 * in the requested rotation state (`0 | 1 | 2 | 3`).
 */
export const MiniPieceMatrixPreview: React.FC<{
  def: PieceDefinition
  cellSizePx?: number
  rotation?: RotationState
}> = ({ def, cellSizePx = 6, rotation = 0 }) => {
  const matrix = def.matrices[rotation] ?? def.matrices[0]
  const effectiveCellSize =
    matrix.length >= 5 && cellSizePx > 4.5 ? Math.max(3.5, cellSizePx - 1.5) : cellSizePx

  return (
    <div
      className="inline-flex flex-col items-center justify-center gap-[1px] p-0.5 rounded bg-slate-950/75 border border-slate-800/80"
      aria-hidden="true"
    >
      {matrix.map((row, rIdx) => (
        <div key={rIdx} className="flex gap-[1px]">
          {row.map((val, cIdx) => (
            <span
              key={cIdx}
              style={{
                width: `${effectiveCellSize}px`,
                height: `${effectiveCellSize}px`,
                backgroundColor: val === 1 ? def.color : 'rgba(15, 23, 42, 0.30)',
                borderColor: val === 1 ? def.borderColor : 'transparent',
                boxShadow: val === 1 ? `0 0 4px ${def.glowColor}` : 'none',
              }}
              className={`inline-block rounded-[1px] ${val === 1 ? 'border' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Sekundo Icon-First Bottom Alchemy & Tactile Dock (`PieceAlchemyBar.tsx`).
 *
 * Replaces the old multi-paragraph sidebar card with a single compact horizontal icon bar
 * positioned directly below the central game board:
 * - Pure icon buttons for `[M]` Morph (`🔮`), `[B]` Fill Hole / Magnet (`🧲`/`✦`),
 *   Miracle Power Tiers (`⚡1`, `🔥2`, `🌟3`, `👑4`), Oracle Hint (`💡`),
 *   Tactile 3-Piece Tray (`[1][2][3]`), and Mini-Matrix Piece Icons (`alchemy-piece-*`).
 * - Clicking `💡` (or any inspect trigger) opens `<SekundoIconPopover />` ("Click-to-Reveal")
 *   with the full Oracle recommendation and explanation of how each buff works.
 */
export const PieceAlchemyBar: React.FC<PieceAlchemyBarProps> = ({
  className = '',
}) => {
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null)

  const phase = useLogicTetrisStore((s) => s.phase)
  const activeSubGameStyle = useLogicTetrisStore((s) => s.activeSubGameStyle)
  const activePiece = useLogicTetrisStore((s) => s.activePiece)
  const topology = useLogicTetrisStore((s) => s.topology)
  const fruitOracle = useLogicTetrisStore((s) => s.fruitOracle)
  const tactileTopology = useLogicTetrisStore((s) => s.tactileTopology)
  const tactileTray = useLogicTetrisStore((s) => s.tactileTray)
  const selectedTraySlot = useLogicTetrisStore((s) => s.selectedTraySlot)
  const activeChallenge = useLogicTetrisStore((s) => s.activeChallenge)
  const selectedMiracleTier = useLogicTetrisStore((s) => s.selectedMiracleTier)

  const triggerMathMorph = useLogicTetrisStore((s) => s.triggerMathMorph)
  const setMorphTargetPiece = useLogicTetrisStore((s) => s.setMorphTargetPiece)
  const triggerMathFillHole = useLogicTetrisStore((s) => s.triggerMathFillHole)
  const setMiraclePowerTier = useLogicTetrisStore((s) => s.setMiraclePowerTier)
  const selectTactileTraySlot = useLogicTetrisStore((s) => s.selectTactileTraySlot)

  const miracleTierSpecs = getAllMiracleTierSpecs()
  const activeMiracleSpec = getMiracleTierSpec(selectedMiracleTier)

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
  const recommendedFruitMeta =
    FRUIT_CATALOG[fruitOracle.recommendedFruit] ?? FRUIT_CATALOG.APPLE_RUBY
  const fragmentedFruitMeta =
    FRUIT_CATALOG[fruitOracle.mostFragmentedFruit] ?? FRUIT_CATALOG.CITRUS_GOLD

  const oracleReasonText =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? fruitOracle.pedagogicalHint
      : activeSubGameStyle === 'TACTILE_GRID'
        ? tactileTopology.pedagogicalHint
        : topology.recommendationReason

  const isFillHoleHighlighted =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? fruitOracle.fragmentedCount >= 2
      : activeSubGameStyle === 'TACTILE_GRID'
        ? tactileTopology.goldenCrossroads.length > 0 ||
          Object.keys(tactileTopology.rowComplements).length > 0 ||
          Object.keys(tactileTopology.colComplements).length > 0
        : buriedCount > 0

  const handleSelectPiece = (targetType: PieceType) => {
    if (!isInteractive) return
    if (phase === 'MATH_MORPH') {
      setMorphTargetPiece(targetType)
    } else {
      triggerMathMorph(targetType)
    }
  }

  const renderCompactPieceIcon = (type: PieceType) => {
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
        className={`relative w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
          isSelectedInModal
            ? 'bg-cyan-950/90 border-cyan-300 ring-2 ring-cyan-400/50'
            : isRecommended
              ? 'bg-amber-950/65 border-amber-400/80 lt-oracle-recommended'
              : isCurrentlyActive
                ? 'bg-slate-800/90 border-cyan-500/50'
                : 'bg-slate-900/75 hover:bg-slate-800/90 border-slate-800 hover:border-slate-600'
        }`}
      >
        {isRecommended && (
          <span
            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-950 text-[8px] font-extrabold flex items-center justify-center shadow"
            data-testid={`oracle-badge-${type}`}
          >
            ★
          </span>
        )}
        <MiniPieceMatrixPreview def={def} cellSizePx={4.2} />
      </button>
    )
  }

  const resolvePopoverSpec = (): SekundoRevealSpec | null => {
    if (!activePopoverId) return null

    if (activePopoverId === 'oracle') {
      return {
        id: 'oracle',
        icon: '💡',
        title:
          activeSubGameStyle === 'FRUIT_MATCH'
            ? `Oráculo 10×10: ${recommendedFruitMeta.emoji} ${recommendedFruitMeta.namePt} (${fruitOracle.validSwapsCount} trocas)`
            : activeSubGameStyle === 'TACTILE_GRID'
              ? `Oráculo Tátil: Peça ${recommendedDef.label} (${tactileTopology.goldenCrossroads.length} Cruzamento✚)`
              : `Oráculo Base-10: Peça ${recommendedDef.label} (${recommendedDef.areaFormula})`,
        shortcut: '[M] / [B]',
        badge: `Grau ${activeMiracleSpec.tier} (${activeMiracleSpec.shortLabelPt})`,
        description:
          'Use [M] para transmutar peças/forjar Estrelas Coringa ou [B] para selar buracos/lançar o Imã de Frutas. Escolha os Graus ⚡1 a 👑4 para multiplicar a recompensa!',
        oracleHint: oracleReasonText,
        accentColor: 'amber',
        actionLabel:
          buriedCount > 0 || activeSubGameStyle === 'FRUIT_MATCH'
            ? `✦ Acionar Milagre [B] (${activeMiracleSpec.titlePt})`
            : `🔮 Acionar Alquimia [M] (${recommendedDef.label})`,
        onAction: () => {
          if (buriedCount > 0 || activeSubGameStyle === 'FRUIT_MATCH') {
            triggerMathFillHole()
          } else {
            triggerMathMorph(recommendedType)
          }
        },
        customContent:
          activeSubGameStyle === 'TACTILE_GRID' ? (
            <div className="pt-1">
              <div className="text-[10px] font-mono text-emerald-300 mb-1">
                🧩 Macro-Blocos Táteis (Clique p/ moldar slot ativo):
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {TACTILE_MACRO_PIECE_TYPES.map((type) => renderCompactPieceIcon(type))}
              </div>
            </div>
          ) : undefined,
      }
    }

    return null
  }

  return (
    <section
      className={`relative w-full lt-glass-panel rounded-2xl px-2.5 py-1.5 flex items-center justify-between gap-1.5 flex-wrap select-none z-20 ${className}`}
      aria-label="Doca Inferior de Alquimia Matemática e Bandeja Sekundo Icon-First"
      data-testid="piece-alchemy-bar"
    >
      {/* Keep single deterministic oracle-recommendation-reason in DOM when popover is closed */}
      {!activePopoverId && (
        <span className="sr-only" data-testid="oracle-recommendation-reason">
          {oracleReasonText}
        </span>
      )}

      {/* =====================================================================
          LEFT GROUP: LIFE-SAVING MIRACLE ICONS [M], [B], POWER TIERS ⚡1..👑4 & 💡 ORACLE
          ===================================================================== */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* [M] Morph Icon Button (`data-testid="btn-trigger-morph"`) */}
        <button
          type="button"
          disabled={!isInteractive}
          onClick={() => triggerMathMorph(recommendedType)}
          data-testid="btn-trigger-morph"
          title={
            activeSubGameStyle === 'FRUIT_MATCH'
              ? '[M] Forjar Estrelas Coringa (✦ + ✦) na Arena 10×10'
              : `[M] Moldar Peça (${currentDef.label} → ${recommendedDef.label})`
          }
          className="h-8 px-2.5 rounded-xl bg-gradient-to-r from-cyan-950/95 to-teal-950/90 hover:from-cyan-900 hover:to-teal-900 border border-cyan-400/60 text-xs font-mono font-bold text-cyan-100 flex items-center gap-1 transition cursor-pointer disabled:opacity-45 disabled:pointer-events-none shadow"
        >
          <span>🔮</span>
          <span className="text-[10px] text-cyan-300">[M]</span>
          <span className="text-amber-300">
            {activeSubGameStyle === 'FRUIT_MATCH' ? '✦' : recommendedDef.symbol}
          </span>
        </button>

        {/* [B] Fill Hole / Fruit Magnet Icon Button (`data-testid="btn-trigger-fill-hole"`) */}
        <button
          type="button"
          disabled={!isInteractive}
          onClick={() => triggerMathFillHole()}
          data-testid="btn-trigger-fill-hole"
          title={
            activeSubGameStyle === 'FRUIT_MATCH'
              ? `[B] Imã Magnético de Frutas (${fragmentedFruitMeta.emoji} · Grau ${activeMiracleSpec.tier})`
              : `[B] Tapar Buracos / Selar Linha (${activeMiracleSpec.shortLabelPt})`
          }
          className={`h-8 px-2.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-45 disabled:pointer-events-none shadow ${
            isFillHoleHighlighted
              ? 'bg-gradient-to-r from-amber-950/95 to-yellow-950/90 hover:from-amber-900 hover:to-yellow-900 border-amber-400/80 text-amber-100 lt-oracle-recommended'
              : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-amber-200'
          }`}
        >
          <span>{activeSubGameStyle === 'FRUIT_MATCH' ? '🧲' : '✦'}</span>
          <span className="text-[10px] text-amber-300">[B]</span>
          {buriedCount > 0 && activeSubGameStyle === 'TETRIS_CLASSIC' && (
            <span className="px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-extrabold">
              {buriedCount}
            </span>
          )}
        </button>

        {/* Compact Miracle Power Tier Icon Pills (`⚡1` `🔥2` `🌟3` `👑4` — `data-testid="alchemy-miracle-tier-bar"`) */}
        <div
          className="flex items-center gap-0.5 bg-slate-950/90 border border-amber-500/35 rounded-xl p-0.5"
          data-testid="alchemy-miracle-tier-bar"
        >
          {miracleTierSpecs.map((spec) => {
            const isSelected = spec.tier === selectedMiracleTier
            return (
              <button
                key={spec.tier}
                type="button"
                disabled={!isInteractive}
                onClick={() => {
                  setMiraclePowerTier(spec.tier as MiraclePowerTier)
                  if (phase === 'PLAYING') {
                    triggerMathFillHole(spec.tier as MiraclePowerTier)
                  }
                }}
                data-testid={`alchemy-miracle-tier-btn-${spec.tier}`}
                data-tier-selected={isSelected ? 'true' : 'false'}
                title={`${spec.titlePt} (${spec.shortLabelPt} · +${spec.bonusScore} pts) — Conta mais desafiadora = Maior recompensa!`}
                className={`h-7 px-1.5 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-0.5 transition cursor-pointer disabled:opacity-40 ${
                  isSelected
                    ? 'bg-amber-500/30 border-amber-300 text-white shadow'
                    : 'bg-slate-900/70 hover:bg-slate-800 border-transparent text-slate-300'
                }`}
              >
                <span>{spec.icon}</span>
                <span>{spec.tier}</span>
              </button>
            )
          })}
        </div>

        {/* Sekundo Click-to-Reveal Oracle Lamp Icon (`data-testid="btn-oracle-reveal"`) */}
        <button
          type="button"
          onClick={() =>
            setActivePopoverId((prev) => (prev === 'oracle' ? null : 'oracle'))
          }
          data-testid="btn-oracle-reveal"
          title="Revelar Dica do Oráculo & Explicação dos Buffs (Click-to-Reveal)"
          className={`w-8 h-8 rounded-xl border text-xs flex items-center justify-center transition cursor-pointer ${
            activePopoverId === 'oracle'
              ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold shadow'
              : 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-400/50 text-amber-200'
          }`}
        >
          💡
        </button>
      </div>

      {/* =====================================================================
          CENTER/RIGHT GROUP: TACTILE 3-PIECE TRAY (IN TACTILE_GRID) & MINI-PIECE ICONS
          ===================================================================== */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {activeSubGameStyle === 'TACTILE_GRID' && (
          <div
            className="flex items-center gap-1 bg-slate-950/90 border border-emerald-500/40 rounded-xl p-0.5"
            data-testid="tactile-piece-tray"
          >
            {tactileTray.map((opt, idx) => {
              const def = getPieceDefinition(opt.type)
              const isSelected = selectedTraySlot === idx && !opt.isUsed
              const matrixDim = def.matrices[0]?.length ?? 4
              return (
                <button
                  key={`${opt.type}_${idx}`}
                  type="button"
                  disabled={opt.isUsed}
                  onClick={() => selectTactileTraySlot(idx as 0 | 1 | 2)}
                  data-testid={`tactile-tray-slot-${idx}`}
                  title={`Slot [${idx + 1}]: ${def.namePt} (${def.areaFormula}) — Clique na Arena 10×10 p/ encaixar`}
                  className={`h-8 px-2 rounded-lg border flex items-center gap-1 transition cursor-pointer ${
                    opt.isUsed
                      ? 'opacity-30 border-slate-800 bg-slate-950/40 pointer-events-none'
                      : isSelected
                        ? 'border-emerald-400 bg-emerald-950/60 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                        : 'border-slate-800 bg-slate-900/75 hover:border-slate-600'
                  }`}
                >
                  <span className="text-[9px] font-mono font-bold text-cyan-300">
                    {idx + 1}
                  </span>
                  <MiniPieceMatrixPreview
                    def={def}
                    rotation={opt.rotation}
                    cellSizePx={matrixDim >= 5 ? 3 : 4}
                  />
                </button>
              )
            })}
          </div>
        )}

        {/* Compact Mini-Matrix Piece Strip (`alchemy-piece-I..L`) */}
        <div className="flex items-center gap-1 flex-wrap">
          {CLASSIC_PIECE_TYPES.map((type) => renderCompactPieceIcon(type))}
        </div>
      </div>

      {/* Sekundo Click-to-Reveal Popover Anchored Above the Bottom Dock */}
      <SekundoIconPopover
        spec={resolvePopoverSpec()}
        onClose={() => setActivePopoverId(null)}
        dockPosition="bottom"
      />
    </section>
  )
}
