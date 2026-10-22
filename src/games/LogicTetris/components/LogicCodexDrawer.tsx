import React, { useState } from 'react'
import { TetrisMathLensId } from '../types'
import { TETRIS_MATH_LENSES } from '../engine/mathEngine'
import { useLogicTetrisStore } from '../state/useLogicTetrisStore'

interface LensGuideCard {
  lensId: TetrisMathLensId
  opBadge: string
  title: string
  example: string
  mentalSecret: string
  slug: string
}

const HEISS_LAB_LENSES_GUIDE: readonly LensGuideCard[] = [
  {
    lensId: 'massinha_soma',
    opBadge: '+ SOMA',
    title: TETRIS_MATH_LENSES.massinha_soma.lensBadge,
    example: '18 + 7 → (18 + 2) + 5 = 20 + 5 = 25',
    mentalSecret: TETRIS_MATH_LENSES.massinha_soma.corePrinciple,
    slug: TETRIS_MATH_LENSES.massinha_soma.relatedLessonSlug,
  },
  {
    lensId: 'amigos_do_10_falta',
    opBadge: '+ BALANÇA',
    title: TETRIS_MATH_LENSES.amigos_do_10_falta.lensBadge,
    example: '7 + [ ? ] = 10 → Falta 3! | 14 + [ ? ] = 20 → Falta 6!',
    mentalSecret: TETRIS_MATH_LENSES.amigos_do_10_falta.corePrinciple,
    slug: TETRIS_MATH_LENSES.amigos_do_10_falta.relatedLessonSlug,
  },
  {
    lensId: 'hack_japones',
    opBadge: '− SUBTRAÇÃO',
    title: TETRIS_MATH_LENSES.hack_japones.lensBadge,
    example: '42 − 19 → (+1 nos dois) → 43 − 20 = 23',
    mentalSecret: TETRIS_MATH_LENSES.hack_japones.corePrinciple,
    slug: TETRIS_MATH_LENSES.hack_japones.relatedLessonSlug,
  },
  {
    lensId: 'regra_elevador',
    opBadge: '− ELEVADOR',
    title: TETRIS_MATH_LENSES.regra_elevador.lensBadge,
    example: '50 − 34 → do 34 ao 40 (+6) e do 40 ao 50 (+10) = 16',
    mentalSecret: TETRIS_MATH_LENSES.regra_elevador.corePrinciple,
    slug: TETRIS_MATH_LENSES.regra_elevador.relatedLessonSlug,
  },
  {
    lensId: 'dobro_do_dobro_248',
    opBadge: '× MULTIPLICAÇÃO',
    title: TETRIS_MATH_LENSES.dobro_do_dobro_248.lensBadge,
    example: '15 × 4 → dobro de 15 é 30 → dobro de 30 é 60!',
    mentalSecret: TETRIS_MATH_LENSES.dobro_do_dobro_248.corePrinciple,
    slug: TETRIS_MATH_LENSES.dobro_do_dobro_248.relatedLessonSlug,
  },
  {
    lensId: 'relogio_5_dobra_meia',
    opBadge: '× SIMETRIA',
    title: TETRIS_MATH_LENSES.relogio_5_dobra_meia.lensBadge,
    example: '18 × 5 → metade de 18 é 9 → 9 × 10 = 90!',
    mentalSecret: TETRIS_MATH_LENSES.relogio_5_dobra_meia.corePrinciple,
    slug: TETRIS_MATH_LENSES.relogio_5_dobra_meia.relatedLessonSlug,
  },
  {
    lensId: 'infinito_9_quadrados',
    opBadge: '× ATALHO 9',
    title: TETRIS_MATH_LENSES.infinito_9_quadrados.lensBadge,
    example: '19 × 6 → (20 × 6) − 6 = 120 − 6 = 114',
    mentalSecret: TETRIS_MATH_LENSES.infinito_9_quadrados.corePrinciple,
    slug: TETRIS_MATH_LENSES.infinito_9_quadrados.relatedLessonSlug,
  },
  {
    lensId: 'corta_no_meio_div',
    opBadge: '÷ DIVISÃO',
    title: TETRIS_MATH_LENSES.corta_no_meio_div.lensBadge,
    example: '36 ÷ 4 → 18 → 9 | 85 ÷ 5 → (85 × 2) ÷ 10 = 170 ÷ 10 = 17',
    mentalSecret: TETRIS_MATH_LENSES.corta_no_meio_div.corePrinciple,
    slug: TETRIS_MATH_LENSES.corta_no_meio_div.relatedLessonSlug,
  },
]

/**
 * Retractable Pedagogical Codex Drawer (`LogicCodexDrawer.tsx`, hotkey `[H]`).
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 07-A`: Combines the Live Session Math Diary (`solvedHistory`) with the
 *   Complete Guide to the 8 Heiss-Lab Mental Math Lenses and direct links to `/repositorio/:slug`.
 * - `Melhoria 07-D`: Deterministic `data-testid="logic-codex-drawer"`.
 */
export const LogicCodexDrawer: React.FC = () => {
  const isCodexOpen = useLogicTetrisStore((s) => s.isCodexOpen)
  const solvedHistory = useLogicTetrisStore((s) => s.solvedHistory)
  const stats = useLogicTetrisStore((s) => s.stats)
  const toggleCodex = useLogicTetrisStore((s) => s.toggleCodex)

  const [activeTab, setActiveTab] = useState<'history' | 'lenses'>('history')

  if (!isCodexOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 flex justify-end bg-slate-950/75 backdrop-blur-sm animate-fadeIn"
      style={{ zIndex: 1200 }}
      role="dialog"
      aria-modal="true"
      aria-label="Códice Pedagógico Heiss-Lab e Diário da Sessão"
      data-testid="logic-codex-drawer"
    >
      <div className="w-full max-w-xl h-full bg-slate-900/95 border-l border-cyan-500/40 shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-950 via-cyan-950/70 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📚</span>
              <h2 className="text-base font-extrabold text-white tracking-wide">
                Códice Pedagógico Heiss-Lab
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Diário das contas que salvaram sua partida + As 8 Lentes de Cálculo Mental
            </p>
          </div>

          <button
            type="button"
            onClick={() => toggleCodex(false)}
            data-testid="btn-close-codex"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono font-bold text-slate-200 transition cursor-pointer"
          >
            ✕ Fechar [H]
          </button>
        </div>

        {/* Lifetime Milestones Strip */}
        <div className="grid grid-cols-4 gap-2 px-5 py-2.5 bg-slate-950/80 border-b border-slate-800 text-center font-mono">
          <div>
            <div className="text-[10px] text-slate-400">CONTAS</div>
            <div className="text-sm font-bold text-cyan-300">{stats.totalMathSolved}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">PEÇAS [M]</div>
            <div className="text-sm font-bold text-emerald-300">{stats.totalMorphs}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">BURACOS [B]</div>
            <div className="text-sm font-bold text-amber-300">{stats.totalHolesSealed}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">FÊNIX</div>
            <div className="text-sm font-bold text-purple-300">{stats.totalSecondWinds}</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            data-testid="codex-tab-history"
            className={`px-3.5 py-2 rounded-t-xl text-xs font-mono font-bold border-t border-x transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-900 border-cyan-400/60 text-cyan-200'
                : 'bg-slate-950/60 border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📜 Diário da Sessão ({solvedHistory.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lenses')}
            data-testid="codex-tab-lenses"
            className={`px-3.5 py-2 rounded-t-xl text-xs font-mono font-bold border-t border-x transition cursor-pointer ${
              activeTab === 'lenses'
                ? 'bg-slate-900 border-amber-400/60 text-amber-200'
                : 'bg-slate-950/60 border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🧭 As 8 Lentes das 4 Operações
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {activeTab === 'history' ? (
            solvedHistory.length === 0 ? (
              <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-6 text-center space-y-3">
                <div className="text-3xl">🔮</div>
                <h3 className="text-sm font-bold text-white">
                  Nenhuma conta realizada nesta sessão ainda
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                  Durante a partida, pressione <strong className="text-cyan-300">[M]</strong> (ou
                  clique numa peça da Forja) para mudar a peça atual, ou{' '}
                  <strong className="text-amber-300">[B]</strong> para tapar buracos soterrados com
                  Cristais Dourados!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('lenses')}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-mono font-bold text-amber-200 transition cursor-pointer"
                >
                  🧭 Explorar Guia das 8 Lentes Agora →
                </button>
              </div>
            ) : (
              solvedHistory.map((entry, idx) => (
                <article
                  key={`${entry.challenge.id}_${entry.solvedAt}_${idx}`}
                  className="rounded-xl bg-slate-950/85 border border-slate-800 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-mono font-bold text-cyan-200">
                      {entry.challenge.lensBadge}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        entry.wasFirstTry
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                          : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                      }`}
                    >
                      {entry.wasFirstTry
                        ? '🌟 Resolvido de Primeira!'
                        : '💛 2ª Chance Conquistada!'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-base font-extrabold font-mono text-white">
                      {entry.challenge.expression.replace('?', String(entry.challenge.correctAnswer))}
                    </div>
                    <div className="text-xs font-mono text-amber-300 font-semibold">
                      = {entry.challenge.correctAnswer}
                    </div>
                  </div>

                  <div className="text-xs text-emerald-300/90 font-medium">
                    ⚡ {entry.effectSummary}
                  </div>

                  <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2 space-y-1">
                    {entry.challenge.stepByStep.map((step, sIdx) => (
                      <div key={sIdx} className="text-[11px] font-mono text-slate-300">
                        • {step}
                      </div>
                    ))}
                  </div>

                  {entry.challenge.relatedLessonSlug && (
                    <div className="pt-1 flex justify-end">
                      <a
                        href={`/repositorio/${entry.challenge.relatedLessonSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                      >
                        📚 Abrir Aula no Repositório ({entry.challenge.relatedLessonSlug}) ↗
                      </a>
                    </div>
                  )}
                </article>
              ))
            )
          ) : (
            <div className="space-y-3" data-testid="codex-lenses-list">
              {HEISS_LAB_LENSES_GUIDE.map((lens) => (
                <article
                  key={lens.lensId}
                  className="rounded-xl bg-slate-950/85 border border-slate-800 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{lens.title}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-[10px] font-mono font-bold text-amber-200">
                      {lens.opBadge}
                    </span>
                  </div>

                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-cyan-200">
                    {lens.example}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{lens.mentalSecret}</p>

                  <div className="pt-1 flex justify-end">
                    <a
                      href={`/repositorio/${lens.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                    >
                      📚 Estudar no Repositório (/repositorio/{lens.slug}) ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
