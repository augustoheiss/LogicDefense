import React, { useEffect, useState } from 'react'
import { ALL_PIECE_TYPES, getPieceDefinition } from '../engine/tetrominoes'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'
import { MiniPieceMatrixPreview } from './PieceAlchemyBar'

/**
 * Rapid Mathematical Intervention Overlay (`MathInterventionModal.tsx`).
 * Powers the 3 Life-Saving Mathematical Miracles of Logic Tetris (Genesis Edition):
 * 1. `MATH_MORPH`: Transmute the falling piece into the exact geometry needed (`I, O, T, S, Z, J, L, 1×1, 1×2`).
 * 2. `MATH_FILL_HOLE`: Materialize Golden Balance Crystals (`SEALED_GOLD`) directly inside buried cavities.
 * 3. `MATH_SECOND_WIND`: Phoenix Protocol 142857 — Purify the bottom 4–6 rows upon Top-Out to save the player's life!
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 05-A`: Displays Heiss-Lab Lens badge, warm Guiding Light (`shortHint`), Base-10 geometry formula,
 *   and direct link to `/repositorio/:slug`.
 * - `Melhoria 05-B`: Inline Elastic Feedback (`ELASTIC_BOUNCE` + `trapDiagnosis` panel `data-testid="math-trap-diagnosis"`)
 *   without closing the modal (`RT-09`), guaranteeing a real second chance.
 * - `Melhoria 05-C`: Ultra-fast `< 1s` operation via keys `[1]–[4]`, inline target-piece switcher for `MATH_MORPH`,
 *   and penalty-free `[Esc]` cancel.
 * - `Melhoria 05-D`: Distinct visual themes for the 3 miracles + deterministic `data-testid` attributes.
 */
export const MathInterventionModal: React.FC = () => {
  const phase = useLogicTetrisStore((s) => s.phase)
  const mode = useLogicTetrisStore((s) => s.mode)
  const activeChallenge = useLogicTetrisStore((s) => s.activeChallenge)
  const topology = useLogicTetrisStore((s) => s.topology)
  const eliminatedChoiceValues = useLogicTetrisStore((s) => s.eliminatedChoiceValues)
  const lastWrongDiagnosis = useLogicTetrisStore((s) => s.lastWrongDiagnosis)
  const secondWindStepsRemaining = useLogicTetrisStore((s) => s.secondWindStepsRemaining)
  const secondWindStepsTotal = useLogicTetrisStore((s) => s.secondWindStepsTotal)
  const phoenixShields = useLogicTetrisStore((s) => s.phoenixShields)

  const submitMathChoice = useLogicTetrisStore((s) => s.submitMathChoice)
  const cancelMathIntervention = useLogicTetrisStore((s) => s.cancelMathIntervention)
  const setMorphTargetPiece = useLogicTetrisStore((s) => s.setMorphTargetPiece)
  const forfeitSecondWind = useLogicTetrisStore((s) => s.forfeitSecondWind)

  const [bouncingValue, setBouncingValue] = useState<number | null>(null)

  const isModalOpen =
    activeChallenge !== null &&
    (phase === 'MATH_MORPH' || phase === 'MATH_FILL_HOLE' || phase === 'MATH_SECOND_WIND')

  useEffect(() => {
    if (!isModalOpen || !activeChallenge) return

    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, [isModalOpen, activeChallenge, phase, submitMathChoice, cancelMathIntervention])

  if (!isModalOpen || !activeChallenge) {
    return null
  }

  const isMorph = phase === 'MATH_MORPH'
  const isFillHole = phase === 'MATH_FILL_HOLE'
  const isSecondWind = phase === 'MATH_SECOND_WIND'

  const targetPieceType =
    activeChallenge.targetPiece ?? topology.recommendedPiece ?? 'I'
  const targetPieceDef = getPieceDefinition(targetPieceType)
  const buriedCount = topology.buriedCavities.length
  const rowsToPurify = mode === 'zen' ? 6 : 4
  const currentStepNumber = Math.max(
    1,
    secondWindStepsTotal - secondWindStepsRemaining + 1
  )

  const themeClasses = isSecondWind
    ? {
        border: 'border-purple-400/80 shadow-[0_0_45px_rgba(168,85,247,0.35)]',
        headerBg: 'from-purple-950/95 via-fuchsia-950/90 to-amber-950/85',
        badge: 'bg-amber-400/20 border-amber-300/60 text-amber-200',
        title: '🔥 Protocolo Fênix 142857 — Salvação de Emergência!',
        subtitle: `Resolva para purificar as ${rowsToPurify} linhas inferiores e continuar jogando!`,
      }
    : isFillHole
      ? {
          border: 'border-amber-400/80 shadow-[0_0_42px_rgba(251,191,36,0.32)]',
          headerBg: 'from-amber-950/95 via-yellow-950/90 to-slate-900/95',
          badge: 'bg-amber-400/20 border-amber-300/60 text-amber-200',
          title: '✦ Alquimia de Balança — Selar Cavidades Soterradas com Ouro',
          subtitle:
            buriedCount > 0
              ? `Materializa Cristais Dourados (✦) diretamente em até ${Math.min(3, buriedCount)} buraco(s) soterrado(s)!`
              : 'Tabuleiro sem buracos soterrados: concederá o Monominó Dourado (1×1)!',
        }
      : {
          border: 'border-cyan-400/80 shadow-[0_0_42px_rgba(34,211,238,0.32)]',
          headerBg: 'from-cyan-950/95 via-teal-950/90 to-slate-900/95',
          badge: 'bg-cyan-400/20 border-cyan-300/60 text-cyan-200',
          title: '🔮 Alquimia Geométrica — Moldar Peça Ideal',
          subtitle: `Bullet-Time 0.12× Ativo · Transmute a peça atual para ${targetPieceDef.namePt} (${targetPieceDef.areaFormula})!`,
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
    >
      <div
        className={`w-full max-w-lg rounded-2xl bg-slate-900/95 border-2 ${themeClasses.border} overflow-hidden flex flex-col`}
      >
        {/* Top Miracle Header */}
        <div
          className={`bg-gradient-to-r ${themeClasses.headerBg} px-4 py-3 border-b border-slate-800`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold ${themeClasses.badge}`}
              data-testid="modal-lens-badge"
            >
              {activeChallenge.lensBadge}
            </span>

            {isSecondWind ? (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/25 border border-purple-300/50 text-[11px] font-mono font-bold text-purple-100">
                Etapa Fênix {currentStepNumber}/{secondWindStepsTotal} · 🛡️{' '}
                {mode === 'zen' ? '∞' : phoenixShields}
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-300">
                Teclas rápidas: <strong className="text-white">[1] [2] [3] [4]</strong> ·{' '}
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
        <div className="p-4 flex flex-col gap-3.5">
          {/* Inline Target Piece Selector when in MATH_MORPH (`Melhoria 05-C`) */}
          {isMorph && (
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
                {ALL_PIECE_TYPES.map((type) => {
                  const def = getPieceDefinition(type)
                  const isSelected = type === targetPieceType
                  const isOracle = type === topology.recommendedPiece
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
