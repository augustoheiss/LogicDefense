import React, { useEffect, useState } from 'react'
import {
  getAllMiracleTierSpecs,
  getMiracleTierSpec,
} from '../engine/mathEngine'
import {
  ALL_PIECE_TYPES,
  CLASSIC_PIECE_TYPES,
  getPieceDefinition,
} from '../engine/tetrominoes'
import {
  getSubGameStyleLabelPt,
  useLogicTetrisStore,
} from '../state/useLogicTetrisStore'
import type { MiraclePowerTier } from '../types'
import { MiniPieceMatrixPreview } from './PieceAlchemyBar'

/**
 * Rapid Mathematical Intervention Overlay (`MathInterventionModal.tsx`).
 * Powers the 3 Life-Saving Mathematical Miracles of Logic Tetris across all 3 Trinity Styles:
 * 1. `MATH_MORPH` (`[M]`):
 *    - `TETRIS_CLASSIC`: Transmute the falling piece into `I, O, T, S, Z, J, L, 1×1, 1×2`.
 *    - `FRUIT_MATCH`: Forge 2 Star Prism Wildcards (`✦ + ✦`) on the 10×10 Fruit Board.
 *    - `TACTILE_GRID`: Transmute the selected Tray Slot into `1×1`, `3×3`, or chosen shape.
 * 2. `MATH_FILL_HOLE` (`[B]`):
 *    - `TETRIS_CLASSIC`: Seal buried cavities with Golden Crystals (`SEALED_GOLD`).
 *    - `FRUIT_MATCH`: Magnetic Fruit Collapse (`magnetizeSingleFruitColor`).
 *    - `TACTILE_GRID`: Seal Horizontal or Vertical Line cavities (`sealTactileRowOrColCavities`).
 * 3. `MATH_SECOND_WIND` (`Fênix 142857`):
 *    - Purify bottom rows (`TETRIS_CLASSIC`), collapse top 2 fruit colors (`FRUIT_MATCH`),
 *      or free `>= 60%` of the `10×10` Tactile Arena (`TACTILE_GRID`).
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 05-A / 06-A`: Displays Heiss-Lab Lens badge, Trinity Style Context badge (`modal-style-context-badge`),
 *   warm Zero-Spoiler Guiding Light (`shortHint`), Base-10 geometry formula, and direct link to `/repositorio/:slug`.
 * - `Melhoria 05-B`: Inline Elastic Feedback (`ELASTIC_BOUNCE` + `trapDiagnosis` panel `data-testid="math-trap-diagnosis"`)
 *   without closing the modal (`RT-09`), guaranteeing a real second chance.
 * - `Melhoria 05-C`: Ultra-fast `< 1s` operation via keys `[1]–[4]`, inline target-piece switcher for `MATH_MORPH`,
 *   and penalty-free `[Esc]` cancel.
 * - `Melhoria 05-D`: Distinct visual themes for the 3 miracles + deterministic `data-testid` attributes.
 */
export const MathInterventionModal: React.FC = () => {
  const phase = useLogicTetrisStore((s) => s.phase)
  const mode = useLogicTetrisStore((s) => s.mode)
  const activeSubGameStyle = useLogicTetrisStore((s) => s.activeSubGameStyle)
  const activeChallenge = useLogicTetrisStore((s) => s.activeChallenge)
  const topology = useLogicTetrisStore((s) => s.topology)
  const tactileTopology = useLogicTetrisStore((s) => s.tactileTopology)
  const eliminatedChoiceValues = useLogicTetrisStore((s) => s.eliminatedChoiceValues)
  const lastWrongDiagnosis = useLogicTetrisStore((s) => s.lastWrongDiagnosis)
  const secondWindStepsRemaining = useLogicTetrisStore((s) => s.secondWindStepsRemaining)
  const secondWindStepsTotal = useLogicTetrisStore((s) => s.secondWindStepsTotal)
  const phoenixShields = useLogicTetrisStore((s) => s.phoenixShields)
  const selectedMiracleTier = useLogicTetrisStore((s) => s.selectedMiracleTier)

  const submitMathChoice = useLogicTetrisStore((s) => s.submitMathChoice)
  const cancelMathIntervention = useLogicTetrisStore((s) => s.cancelMathIntervention)
  const setMorphTargetPiece = useLogicTetrisStore((s) => s.setMorphTargetPiece)
  const setMiraclePowerTier = useLogicTetrisStore((s) => s.setMiraclePowerTier)
  const forfeitSecondWind = useLogicTetrisStore((s) => s.forfeitSecondWind)

  const [bouncingValue, setBouncingValue] = useState<number | null>(null)
  const miracleTierSpecs = getAllMiracleTierSpecs()
  const activeMiracleSpec = getMiracleTierSpec(
    activeChallenge?.miracleTier ?? selectedMiracleTier
  )

  const isModalOpen =
    activeChallenge !== null &&
    (phase === 'MATH_MORPH' || phase === 'MATH_FILL_HOLE' || phase === 'MATH_SECOND_WIND')

  useEffect(() => {
    if (!isModalOpen || !activeChallenge) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (phase === 'MATH_MORPH' || phase === 'MATH_FILL_HOLE') {
        if (event.key === 'F1') {
          event.preventDefault()
          event.stopPropagation()
          setMiraclePowerTier(1)
          return
        }
        if (event.key === 'F2') {
          event.preventDefault()
          event.stopPropagation()
          setMiraclePowerTier(2)
          return
        }
        if (event.key === 'F3') {
          event.preventDefault()
          event.stopPropagation()
          setMiraclePowerTier(3)
          return
        }
        if (event.key === 'F4') {
          event.preventDefault()
          event.stopPropagation()
          setMiraclePowerTier(4)
          return
        }
      }
      if (event.key === '1' || event.code === 'Numpad1') {
        event.preventDefault()
        event.stopPropagation()
        const choice = activeChallenge.choices[0]
        if (choice) {
          const res = submitMathChoice(0)
          if (res === 'ELASTIC_BOUNCE') setBouncingValue(choice.value)
        }
        return
      }
      if (event.key === '2' || event.code === 'Numpad2') {
        event.preventDefault()
        event.stopPropagation()
        const choice = activeChallenge.choices[1]
        if (choice) {
          const res = submitMathChoice(1)
          if (res === 'ELASTIC_BOUNCE') setBouncingValue(choice.value)
        }
        return
      }
      if (event.key === '3' || event.code === 'Numpad3') {
        event.preventDefault()
        event.stopPropagation()
        const choice = activeChallenge.choices[2]
        if (choice) {
          const res = submitMathChoice(2)
          if (res === 'ELASTIC_BOUNCE') setBouncingValue(choice.value)
        }
        return
      }
      if (event.key === '4' || event.code === 'Numpad4') {
        event.preventDefault()
        event.stopPropagation()
        const choice = activeChallenge.choices[3]
        if (choice) {
          const res = submitMathChoice(3)
          if (res === 'ELASTIC_BOUNCE') setBouncingValue(choice.value)
        }
        return
      }
      if (event.key === 'Escape') {
        if (phase === 'MATH_MORPH' || phase === 'MATH_FILL_HOLE') {
          event.preventDefault()
          event.stopPropagation()
          cancelMathIntervention()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [
    isModalOpen,
    activeChallenge,
    phase,
    submitMathChoice,
    cancelMathIntervention,
    setMiraclePowerTier,
  ])

  if (!isModalOpen || !activeChallenge) {
    return null
  }

  const isMorph = phase === 'MATH_MORPH'
  const isFillHole = phase === 'MATH_FILL_HOLE'
  const isSecondWind = phase === 'MATH_SECOND_WIND'

  const recommendedPieceType =
    activeSubGameStyle === 'TACTILE_GRID'
      ? tactileTopology.recommendedPiece
      : topology.recommendedPiece

  const targetPieceType =
    activeChallenge.targetPiece ?? recommendedPieceType ?? 'I'
  const targetPieceDef = getPieceDefinition(targetPieceType)
  const buriedCount = topology.buriedCavities.length
  const rowsToPurify = mode === 'zen' ? 6 : 4
  const currentStepNumber = Math.max(
    1,
    secondWindStepsTotal - secondWindStepsRemaining + 1
  )

  const selectablePieces =
    activeSubGameStyle === 'TACTILE_GRID' ? ALL_PIECE_TYPES : CLASSIC_PIECE_TYPES

  // Contextual Trinity Miracle Label (Melhoria 06-A)
  const styleLabel = getSubGameStyleLabelPt(activeSubGameStyle)
  const styleContextBadgeText =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? isSecondWind
        ? `🍎 ${styleLabel} · Protocolo Fênix: Colapsar 2 Cores Dominantes`
        : isFillHole
          ? `🍎 ${styleLabel} · Imã Magnético (${activeMiracleSpec.titlePt})`
          : `🍎 ${styleLabel} · Forjar Estrelas Coringa (${activeMiracleSpec.titlePt})`
      : activeSubGameStyle === 'TACTILE_GRID'
        ? isSecondWind
          ? `🧩 ${styleLabel} · Protocolo Fênix: Liberar Espaço na Arena 10×10`
          : isFillHole
            ? `🧩 ${styleLabel} · Selar ${activeMiracleSpec.shortLabelPt} (${activeMiracleSpec.titlePt})`
            : `🧩 ${styleLabel} · Moldar Peça da Bandeja (${targetPieceDef.namePt})`
        : isSecondWind
          ? `🧱 ${styleLabel} · Protocolo Fênix: Purificar ${rowsToPurify} Linhas`
          : isFillHole
            ? `🧱 ${styleLabel} · Selar ${activeMiracleSpec.shortLabelPt} com Ouro (${activeMiracleSpec.titlePt})`
            : `🧱 ${styleLabel} · Moldar Peça em Queda (${targetPieceDef.namePt})`

  const themeClasses = isSecondWind
    ? {
        border: 'border-purple-400/80 shadow-[0_0_45px_rgba(168,85,247,0.35)]',
        headerBg: 'from-purple-950/95 via-fuchsia-950/90 to-amber-950/85',
        badge: 'bg-amber-400/20 border-amber-300/60 text-amber-200',
        title: '🔥 Protocolo Fênix 142857 — Salvação de Emergência!',
        subtitle:
          activeSubGameStyle === 'FRUIT_MATCH'
            ? 'Resolva para colapsar as 2 cores de frutas mais populosas na grade 10×10 e disparar cascatas!'
            : activeSubGameStyle === 'TACTILE_GRID'
              ? 'Resolva para purificar a Arena 10×10, renovar a bandeja e continuar jogando!'
              : `Resolva para purificar as ${rowsToPurify} linhas inferiores e continuar jogando!`,
      }
    : isFillHole
      ? {
          border: 'border-amber-400/80 shadow-[0_0_42px_rgba(251,191,36,0.32)]',
          headerBg: 'from-amber-950/95 via-yellow-950/90 to-slate-900/95',
          badge: 'bg-amber-400/20 border-amber-300/60 text-amber-200',
          title:
            activeSubGameStyle === 'FRUIT_MATCH'
              ? `🧲 Alquimia Magnética — ${activeMiracleSpec.icon} ${activeMiracleSpec.titlePt}`
              : activeSubGameStyle === 'TACTILE_GRID'
                ? `✦ Alquimia H×V — ${activeMiracleSpec.icon} ${activeMiracleSpec.titlePt} (${activeMiracleSpec.shortLabelPt})`
                : `✦ Alquimia de Balança — ${activeMiracleSpec.icon} ${activeMiracleSpec.titlePt} (${activeMiracleSpec.shortLabelPt})`,
          subtitle:
            activeSubGameStyle === 'FRUIT_MATCH'
              ? `${activeMiracleSpec.rewardPt} · Conta mais elegante = recompensa maior!`
              : activeSubGameStyle === 'TACTILE_GRID'
                ? `Preenche até ${activeMiracleSpec.maxHolesToSeal >= 20 ? 'TODAS as casas necessárias' : `${activeMiracleSpec.maxHolesToSeal} casas`} em linhas/colunas H×V (${activeMiracleSpec.rewardPt})!`
                : buriedCount > 0
                  ? `Materializa Cristais Dourados (✦) em ${activeMiracleSpec.maxHolesToSeal >= 200 ? `TODOS os ${buriedCount} buracos soterrados` : `até ${Math.min(activeMiracleSpec.maxHolesToSeal, buriedCount)} de ${buriedCount} buraco(s)`} de uma só vez!`
                  : `Tabuleiro sem buracos soterrados: concederá o Monominó Dourado (1×1) + +${activeMiracleSpec.bonusScore} pts!`,
        }
      : {
          border: 'border-cyan-400/80 shadow-[0_0_42px_rgba(34,211,238,0.32)]',
          headerBg: 'from-cyan-950/95 via-teal-950/90 to-slate-900/95',
          badge: 'bg-cyan-400/20 border-cyan-300/60 text-cyan-200',
          title:
            activeSubGameStyle === 'FRUIT_MATCH'
              ? `⭐ Alquimia dos Cachos — ${activeMiracleSpec.icon} ${activeMiracleSpec.titlePt}`
              : activeSubGameStyle === 'TACTILE_GRID'
                ? `🔮 Alquimia da Bandeja — Moldar Peça (${activeMiracleSpec.icon} ${activeMiracleSpec.titlePt})`
                : `🔮 Alquimia Geométrica — Moldar Peça (${activeMiracleSpec.icon} ${activeMiracleSpec.titlePt})`,
          subtitle:
            activeSubGameStyle === 'FRUIT_MATCH'
              ? `Forja ${Math.min(6, 1 + activeMiracleSpec.tier)} Estrelas Prisma (✦) na grade 10×10 + +${activeMiracleSpec.bonusScore} pts!`
              : activeSubGameStyle === 'TACTILE_GRID'
                ? `Transmute o slot da bandeja para ${targetPieceDef.namePt} (${targetPieceDef.areaFormula}) + +${activeMiracleSpec.bonusScore} pts!`
                : `Bullet-Time 0.12× Ativo · Transmute para ${targetPieceDef.namePt} (${targetPieceDef.areaFormula}) + +${activeMiracleSpec.bonusScore} pts!`,
        }

  const handleChoiceClick = (idx: number, choiceValue: number) => {
    const result = submitMathChoice(idx)
    if (result === 'ELASTIC_BOUNCE') {
      setBouncingValue(choiceValue)
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      style={{ zIndex: 1200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lt-modal-title"
      data-testid="math-intervention-modal"
      data-intervention-type={activeChallenge.interventionType}
      data-active-style={activeSubGameStyle}
      data-miracle-tier={activeMiracleSpec.tier}
    >
      <div
        className={`w-full max-w-lg rounded-2xl bg-slate-900/95 border-2 ${themeClasses.border} overflow-hidden flex flex-col`}
      >
        {/* Top Miracle Header */}
        <div
          className={`bg-gradient-to-r ${themeClasses.headerBg} px-4 py-3 border-b border-slate-800`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold ${themeClasses.badge}`}
                data-testid="modal-lens-badge"
              >
                {activeChallenge.lensBadge}
              </span>

              <span
                className="px-2 py-0.5 rounded-full bg-slate-950/75 border border-slate-700 text-[10px] font-mono font-semibold text-cyan-200"
                data-testid="modal-style-context-badge"
              >
                {styleContextBadgeText}
              </span>
            </div>

            {isSecondWind ? (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/25 border border-purple-300/50 text-[11px] font-mono font-bold text-purple-100">
                Etapa Fênix {currentStepNumber}/{secondWindStepsTotal} · 🛡️{' '}
                {mode === 'zen' ? '∞' : phoenixShields}
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-300">
                Teclas: <strong className="text-white">[1..4]</strong> resp ·{' '}
                <strong className="text-amber-300">[F1..F4]</strong> grau ·{' '}
                <strong className="text-slate-200">[Esc]</strong> voltar
              </span>
            )}
          </div>

          <h3
            id="lt-modal-title"
            className="text-base sm:text-lg font-extrabold text-white mt-1.5"
          >
            {themeClasses.title}
          </h3>
          <p className="text-xs text-slate-200/90 mt-0.5">{themeClasses.subtitle}</p>
        </div>

        {/* Body Content */}
        <div className="p-4 flex flex-col gap-3">
          {/* Seletor de Potência do Milagre (Grau I..IV: 3 Buracos, 5 Buracos, 10 Buracos, TODOS + Fênix) */}
          {!isSecondWind && (
            <div
              className="rounded-xl bg-slate-950/85 border border-amber-500/35 p-2.5 flex flex-col gap-1.5"
              data-testid="miracle-power-tier-selector"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                  ⚡ Escala de Potência do Milagre (Conta mais difícil = Recompensa maior!)
                </span>
                {buriedCount > 0 && activeSubGameStyle === 'TETRIS_CLASSIC' && (
                  <span className="text-[10px] font-mono text-slate-300">
                    Cavidades atuais: <strong className="text-amber-300">{buriedCount}</strong>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {miracleTierSpecs.map((spec) => {
                  const isActiveTier = spec.tier === activeMiracleSpec.tier
                  return (
                    <button
                      key={spec.tier}
                      type="button"
                      onClick={() => setMiraclePowerTier(spec.tier as MiraclePowerTier)}
                      data-testid={`miracle-tier-btn-${spec.tier}`}
                      data-tier-active={isActiveTier ? 'true' : 'false'}
                      className={`px-2 py-1.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                        isActiveTier
                          ? 'bg-amber-500/25 border-amber-300 text-white shadow-[0_0_15px_rgba(251,191,36,0.28)]'
                          : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-mono font-extrabold text-amber-200">
                          {spec.icon} {spec.shortLabelPt}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">
                          [F{spec.tier}]
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-cyan-200/90 leading-tight mt-0.5">
                        +{spec.bonusScore} pts{spec.grantsPhoenixShield ? ' + 🛡️' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {/* Inline Target Piece Selector when in MATH_MORPH (`Melhoria 05-C`) */}
          {isMorph && activeSubGameStyle !== 'FRUIT_MATCH' && (
            <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MiniPieceMatrixPreview def={targetPieceDef} cellSizePx={7} />
                  <div>
                    <div className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                      <span>Peça-Alvo: {targetPieceDef.namePt}</span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-[10px] font-mono text-cyan-300">
                        Área {targetPieceDef.areaFormula}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      {targetPieceDef.pedagogicalNote}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick inline piece switcher */}
              <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-800/80">
                <span className="text-[10px] font-mono text-slate-400 mr-1">
                  Trocar formato:
                </span>
                {selectablePieces.map((type) => {
                  const def = getPieceDefinition(type)
                  const isSelected = type === targetPieceType
                  const isOracle = type === recommendedPieceType
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMorphTargetPiece(type)}
                      data-testid={`modal-select-piece-${type}`}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-cyan-500/30 border-cyan-300 text-white shadow'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <span>{def.label}</span>
                      <span style={{ color: def.borderColor }}>{def.symbol}</span>
                      {isOracle && <span className="text-amber-300 text-[9px]">★</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Mathematical Expression Display & Always-Visible Guiding Light (`Melhoria 05-A`) */}
          <div className="rounded-xl bg-slate-950/90 border border-slate-800/90 p-3.5 text-center relative">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              Equação Salva-Vidas
            </div>
            <div
              className="text-2xl sm:text-3xl font-extrabold font-mono tracking-wide text-white py-1"
              data-testid="modal-math-expression"
            >
              {activeChallenge.expression}
            </div>

            {/* Warm Guiding Light (`shortHint`) */}
            <div
              className="mt-[8px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-medium"
              style={{ color: '#fde68a' }}
              data-testid="modal-guiding-light"
            >
              <span>{activeChallenge.shortHint}</span>
            </div>
          </div>

          {/* 4 Ascending Choices (`[1] < [2] < [3] < [4]`) with `< 1s` Hotkeys (`Melhoria 05-C`) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {activeChallenge.choices.map((choice, idx) => {
              const isEliminated = eliminatedChoiceValues.includes(choice.value)
              const isBouncing = bouncingValue === choice.value

              return (
                <button
                  key={choice.value}
                  type="button"
                  disabled={isEliminated}
                  onClick={() => handleChoiceClick(idx, choice.value)}
                  data-testid={`math-choice-${idx}`}
                  data-choice-value={choice.value}
                  data-choice-correct={choice.isCorrect ? 'true' : 'false'}
                  className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 font-mono transition cursor-pointer ${
                    isBouncing ? 'lt-elastic-bounce' : ''
                  } ${
                    isEliminated
                      ? 'bg-amber-950/35 border-amber-500/40 text-amber-300/60 opacity-75 cursor-not-allowed'
                      : 'bg-slate-800/90 hover:bg-cyan-950/80 border-slate-600 hover:border-cyan-400 text-white shadow-lg active:scale-95'
                  }`}
                >
                  <span className="absolute top-1.5 left-2 px-1.5 py-0.2 rounded bg-slate-950/80 border border-slate-700 text-[10px] text-cyan-300 font-bold">
                    [{idx + 1}]
                  </span>

                  <span
                    className="text-xl sm:text-2xl font-extrabold mt-[8px] text-white"
                    style={{ color: isEliminated ? '#fcd34d' : '#ffffff', fontSize: '24px' }}
                    data-testid={`math-choice-label-${idx}`}
                  >
                    {choice.label}
                  </span>

                  <span
                    className="text-[10px] text-slate-400 mt-[4px]"
                    style={{ fontSize: '10px', color: '#94a3b8' }}
                  >
                    {isEliminated ? 'Ajuste visto ↺' : `Tecla ${idx + 1}`}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Empathetic Elastic Bounce Diagnosis Panel (`RT-09` & `Melhoria 05-B`) */}
          {lastWrongDiagnosis && (
            <div
              className="rounded-xl bg-amber-950/65 border border-amber-400/70 p-3 text-left lt-elastic-bounce"
              role="status"
              aria-live="polite"
              data-testid="math-trap-diagnosis"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                  <span>💛 Olhe com carinho (Segunda Chance Ativa!):</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-mono text-emerald-200">
                  +15% Carga Lógica pelo esforço!
                </span>
              </div>
              <p className="text-xs text-amber-100/95 leading-relaxed">
                {lastWrongDiagnosis}
              </p>
              {activeChallenge.stepByStep.length > 0 && (
                <div
                  className="mt-[8px] pt-1.5 border-t border-amber-500/30 text-[11px] font-mono text-cyan-200"
                  style={{ color: '#a5f3fc' }}
                >
                  🧭 Passo Mental: {activeChallenge.stepByStep.join(' → ')}
                </div>
              )}
            </div>
          )}

          {/* Footer: Repository Lesson Link + Cancel / Forfeit Action (`Melhoria 05-A` & `05-D`) */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 flex-wrap">
            {activeChallenge.relatedLessonSlug ? (
              <a
                href={`/repositorio/${activeChallenge.relatedLessonSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="modal-lesson-link"
                className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 underline underline-offset-2 flex items-center gap-1"
              >
                <span>📚 Ver truque no Repositório ({activeChallenge.relatedLessonSlug})</span>
                <span>↗</span>
              </a>
            ) : (
              <span />
            )}

            {isSecondWind ? (
              <button
                type="button"
                onClick={forfeitSecondWind}
                data-testid="btn-forfeit-second-wind"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-400/60 text-xs font-medium text-slate-300 hover:text-rose-200 transition cursor-pointer"
              >
                Encerrar Partida e Ver Resumo
              </button>
            ) : (
              <button
                type="button"
                onClick={cancelMathIntervention}
                data-testid="btn-cancel-intervention"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-medium text-slate-200 transition cursor-pointer"
              >
                Voltar ao Jogo [Esc] (Sem Penalidade)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
