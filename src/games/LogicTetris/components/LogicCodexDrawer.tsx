import React, { useState } from 'react'
import { TetrisMathLensId } from '../types'
import { TETRIS_MATH_LENSES } from '../engine/mathEngine'
import { soundEngine } from '../audio/soundEngine'
import {
  useLogicTetrisStore,
  getSubGameStyleLabelPt,
  getSubGameStylePedagogicalSubtitle,
} from '../state/useLogicTetrisStore'

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
  const maxStreakInSession = useLogicTetrisStore((s) => s.maxStreakInSession)
  const totalStyleShiftsCount = useLogicTetrisStore((s) => s.totalStyleShiftsCount)
  const activeSubGameStyle = useLogicTetrisStore((s) => s.activeSubGameStyle)
  const styleRotationMode = useLogicTetrisStore((s) => s.styleRotationMode)
  const toggleCodex = useLogicTetrisStore((s) => s.toggleCodex)

  const [activeTab, setActiveTab] = useState<'HISTORY' | 'LENSES' | 'TRINITY'>('HISTORY')
  const [previewedStreak, setPreviewedStreak] = useState<number>(() =>
    Math.max(1, maxStreakInSession || 12),
  )

  if (!isCodexOpen) {
    return null
  }

  const previewDescriptor = soundEngine.getDopamineStageDescriptor(previewedStreak)
  const JUKEBOX_STREAKS: readonly { streak: number; label: string }[] = [
    { streak: 1, label: '1×' },
    { streak: 4, label: '4×' },
    { streak: 7, label: '7×' },
    { streak: 10, label: '10×' },
    { streak: 12, label: '👑 12×+ Êxtase' },
  ]

  return (
    <div
      className="fixed inset-0 flex justify-end bg-slate-950/75 backdrop-blur-sm animate-fadeIn"
      style={{ zIndex: 1200 }}
      role="dialog"
      aria-modal="true"
      aria-label="Códice Pedagógico Heiss-Lab e Diário da Sessão"
      data-testid="logic-codex-drawer"
    >
      <div className="w-full max-w-lg h-full bg-slate-900/95 border-l border-cyan-500/40 shadow-2xl flex flex-col overflow-hidden">
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
              Diário das contas + As 8 Lentes de Cálculo Mental + Guia do Cordão Tríplice 3-em-1
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

        {/* Lifetime Milestones & Session Triple Cord Telemetry Strip (`Melhoria 07-B`) */}
        <div className="px-5 py-2.5 bg-slate-950/80 border-b border-slate-800 space-y-2 font-mono">
          <div className="grid grid-cols-4 gap-2 text-center">
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

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 flex-wrap">
            <span
              data-testid="codex-max-streak"
              className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[11px] font-bold text-amber-200"
            >
              🔥 Sequência Máx: ×{maxStreakInSession}
            </span>
            <span
              data-testid="codex-style-shifts"
              className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[11px] font-bold text-cyan-200"
            >
              🌀 Dobras do Cordão Tríplice: {totalStyleShiftsCount}
            </span>
          </div>
        </div>

        {/* Tab Switcher (`grid-cols-3` Single-Row Layout — `Melhoria 08-C`) */}
        <div className="grid grid-cols-3 gap-1.5 border-b border-slate-800 bg-slate-950/50 px-4 pt-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            data-testid="codex-tab-history"
            className={`px-2 py-2 rounded-t-lg text-[11px] font-mono font-bold truncate text-center border-t border-x transition cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-slate-900 border-cyan-400/60 text-cyan-200'
                : 'bg-slate-950/60 border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📜 Diário ({solvedHistory.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LENSES')}
            data-testid="codex-tab-lenses"
            className={`px-2 py-2 rounded-t-lg text-[11px] font-mono font-bold truncate text-center border-t border-x transition cursor-pointer ${
              activeTab === 'LENSES'
                ? 'bg-slate-900 border-amber-400/60 text-amber-200'
                : 'bg-slate-950/60 border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🧭 8 Lentes
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TRINITY')}
            data-testid="codex-tab-trinity"
            className={`px-2 py-2 rounded-t-lg text-[11px] font-mono font-bold truncate text-center border-t border-x transition cursor-pointer ${
              activeTab === 'TRINITY'
                ? 'bg-slate-900 border-emerald-400/60 text-emerald-200'
                : 'bg-slate-950/60 border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🧶 Cordão Tríplice
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {activeTab === 'HISTORY' ? (
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
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('LENSES')}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-mono font-bold text-amber-200 transition cursor-pointer"
                  >
                    🧭 Explorar Guia das 8 Lentes →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('TRINITY')}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-xs font-mono font-bold text-emerald-200 transition cursor-pointer"
                  >
                    🧶 Ver Guia do Cordão Tríplice 3-em-1 →
                  </button>
                </div>
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
          ) : activeTab === 'LENSES' ? (
            <div className="space-y-3" data-testid="codex-lenses-list">
              {HEISS_LAB_LENSES_GUIDE.map((lens) => (
                <article
                  key={lens.lensId}
                  data-testid={`codex-lens-card-${lens.lensId}`}
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
          ) : (
            <div className="space-y-3.5" data-testid="codex-trinity-guide">
              {/* Card 1: Simultaneous Mode [L] & Free Style Switch [G] */}
              <article className="rounded-xl bg-slate-950/90 border border-cyan-500/40 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-cyan-200 font-mono">
                    🌀 MODO SIMULTÂNEO [L] & TROCA LIVRE [G]
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[10px] font-mono font-bold text-cyan-100">
                    Ativo: {getSubGameStyleLabelPt(activeSubGameStyle)} (
                    {styleRotationMode === 'SIMULTANEOUS' ? 'Simultâneo' : 'Travado'})
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  No <strong>Modo Simultâneo (Padrão)</strong>, a cada <strong>4 limpezas</strong> o
                  tabuleiro executa a <strong>Dobra do Cordão Tríplice (900ms)</strong>, transmutando o
                  cenário entre os 3 estilos mantendo sua <strong>pontuação, nível e sequência</strong>{' '}
                  100% intactos (+300 pts de bônus de adaptação!). Prefere jogar só um estilo?
                  Pressione <strong className="text-amber-300">[L]</strong> para travar ou{' '}
                  <strong className="text-cyan-300">[G]</strong> para alternar quando quiser!
                </p>
                <div className="text-[11px] font-mono text-emerald-300">
                  💡 Foco atual: {getSubGameStylePedagogicalSubtitle(activeSubGameStyle)}
                </div>
              </article>

              {/* Card 2: The 3 Geometric Styles and Their Math Miracles */}
              <div className="space-y-2.5">
                <article
                  data-testid="codex-style-card-TETRIS_CLASSIC"
                  className="rounded-xl bg-slate-950/85 border border-cyan-500/30 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-cyan-300">
                      🧱 Estilo #1: Tetris Clássico (Base-10)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-mono font-bold text-cyan-200">
                      7 + 3 = 10
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tetrominós de área 4 em queda vertical. Complete 10 blocos na horizontal para
                    fechar a Dezena.
                  </p>
                  <div className="text-[11px] font-mono text-slate-200 space-y-0.5 pt-1 border-t border-slate-800/80">
                    <div>• [M] Metamorfose: Transmuta a peça em queda (I, O, T, 1×1, 1×2, 1×3).</div>
                    <div>• [B] Selar Cavidades: Materializa Cristais Dourados nos buracos soterrados.</div>
                    <div>• 🔥 Fênix 142857: Purifica as 4 linhas inferiores no Top-Out.</div>
                  </div>
                </article>

                <article
                  data-testid="codex-style-card-FRUIT_MATCH"
                  className="rounded-xl bg-slate-950/85 border border-fuchsia-500/30 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-fuchsia-300">
                      🍇 Estilo #2: Frutas & Pares em Cascata
                    </span>
                    <span className="px-2 py-0.5 rounded bg-fuchsia-500/15 border border-fuchsia-400/40 text-[10px] font-mono font-bold text-fuchsia-200">
                      2 + 1 = 3 · Cascata 1,5×
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Pares de frutas coloridas com gravidade independente por coluna. Conecte 3 ou
                    mais frutas iguais (ortogonais) para explodir cachos e disparar reações em
                    cadeia exponenciais (1,5× → 2,25×)!
                  </p>
                  <div className="text-[11px] font-mono text-slate-200 space-y-0.5 pt-1 border-t border-slate-800/80">
                    <div>• [M] Par Coringa (✦+✦): Conecta com qualquer fruta adjacente.</div>
                    <div>• [B] Imã Magnético: Colapsa todas as frutas da cor mais fragmentada.</div>
                    <div>• 🔥 Fênix 142857: Purifica 4 linhas e aplica gravidade em cascata.</div>
                  </div>
                </article>

                <article
                  data-testid="codex-style-card-TACTILE_GRID"
                  className="rounded-xl bg-slate-950/85 border border-emerald-500/30 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-emerald-300">
                      🧩 Estilo #3: Grade Livre H×V (10×10)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-mono font-bold text-emerald-200">
                      10 + 10 − 1 = 19
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Geometria tátil sem gravidade! Escolha 1 das 3 peças da Bandeja ([1][2][3]) e
                    encaixe na Arena 10×10 para fechar <strong>Linhas Horizontais OU Colunas Verticais</strong>!
                    Fechar Linha + Coluna no mesmo lance (Cruzamento Dourado ✚) limpa 19 células
                    únicas pelo Princípio da Inclusão-Exclusão!
                  </p>
                  <div className="text-[11px] font-mono text-slate-200 space-y-0.5 pt-1 border-t border-slate-800/80">
                    <div>• [M] Moldar Bandeja: Transforma o slot ativo na forma escolhida ou 1×1.</div>
                    <div>• [B] Selar Linha/Coluna H×V: Preenche até 3 casas na linha ou coluna quase cheia.</div>
                    <div>• 🔥 Fênix 142857: Abre espaço na Arena 10×10 e renova a bandeja.</div>
                  </div>
                </article>
              </div>

              {/* Card 3: 16-Stage Dopamine Symphony, 3-Drop Momentum & Interactive Jukebox (`Melhoria 08-B`) */}
              <article className="rounded-xl bg-slate-950/90 border border-amber-500/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-amber-300 font-mono">
                    👑 SINFONIA DE DOPAMINA DE 16 ESTÁGIOS (1× ATÉ 12×+)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-[10px] font-mono font-bold text-amber-100">
                    Momentum: 3 Jogadas
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sua sequência não zera na primeira peça que não limpa linha: você possui um{' '}
                  <strong>Escudo de Momentum de 3 Jogadas</strong> para preparar o próximo encaixe!
                  A cada limpeza, o sintetizador Web Audio evolui de acordes pentatônicos (1×–3×) e
                  arpejos brilhantes (4×–6×) até fanfarras Lídias (7×–9×), Supernova (10×–11×) e o{' '}
                  <strong>Êxtase Gênesis 12×+</strong> com chuva de fogos dourados!
                </p>

                {/* Interactive Harmonic Jukebox (`data-testid="codex-dopamine-preview-bar"` — `Melhoria 08-B`) */}
                <div
                  data-testid="codex-dopamine-preview-bar"
                  className="rounded-xl bg-slate-900/95 border border-amber-400/30 p-3 space-y-2"
                >
                  <div className="text-[11px] font-mono font-bold text-amber-200">
                    🎧 Jukebox Harmônico — Clique para escutar a escalada de sequência até o 12×+:
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {JUKEBOX_STREAKS.map(({ streak, label }) => {
                      const isActive = previewedStreak === streak
                      return (
                        <button
                          key={streak}
                          type="button"
                          data-testid={`codex-sound-preview-${streak}`}
                          onClick={() => {
                            setPreviewedStreak(streak)
                            soundEngine.playSequenceDopamine(
                              streak,
                              streak >= 12 ? 4 : 2,
                              activeSubGameStyle,
                            )
                          }}
                          className={`py-1.5 px-1 rounded-lg border text-[10px] font-mono font-extrabold transition cursor-pointer ${
                            isActive
                              ? 'bg-amber-500/30 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                              : 'bg-slate-950/90 hover:bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  <div
                    data-testid="codex-sound-preview-badge"
                    className="rounded-lg bg-slate-950/90 border border-slate-800 px-2.5 py-1.5 text-[11px] font-mono"
                  >
                    <div className="font-extrabold text-amber-300">{previewDescriptor.badgePt}</div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      {previewDescriptor.harmonicDescriptionPt}
                    </div>
                  </div>
                </div>
              </article>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
