import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogicTetrisGame } from '../games/LogicTetris'
import { TETRIS_MATH_LENSES } from '../games/LogicTetris/engine/mathEngine'
import { toggleLogicTetrisFullscreen } from '../games/LogicTetris/hooks/useGameLoop'
import { useLogicTetrisStore } from '../games/LogicTetris/state/useLogicTetrisStore'
import { TetrisMathLensId } from '../games/LogicTetris/types'

interface LensShowcaseItem {
  lensId: TetrisMathLensId
  exampleExpression: string
  shortcutTransformation: string
  geometryConnection: string
}

const LENS_SHOWCASE_ITEMS: readonly LensShowcaseItem[] = [
  {
    lensId: 'massinha_soma',
    exampleExpression: '18 + 7 = ?',
    shortcutTransformation: '(18 + 2) + 5 → 20 + 5 = 25',
    geometryConnection: 'Molda blocos quebrados em dezenas cheias sem esforço mental.',
  },
  {
    lensId: 'amigos_do_10_falta',
    exampleExpression: '7 + [ ? ] = 10',
    shortcutTransformation: 'Faltam exatos 3 blocos para fechar a linha Base-10!',
    geometryConnection: 'Aciona Cristais Dourados [B] para selar cavidades soterradas.',
  },
  {
    lensId: 'hack_japones',
    exampleExpression: '42 − 19 = ?',
    shortcutTransformation: 'Some +1 nos dois lados → 43 − 20 = 23',
    geometryConnection: 'Elimina o "pedir emprestado" deslocando os dois blocos juntos.',
  },
  {
    lensId: 'regra_elevador',
    exampleExpression: '50 − 34 = ?',
    shortcutTransformation: 'Do 34 ao 40 (+6) + do 40 ao 50 (+10) = 16',
    geometryConnection: 'Mede a altura livre da pilha de blocos como andares de um elevador.',
  },
  {
    lensId: 'dobro_do_dobro_248',
    exampleExpression: '15 × 4 = ?',
    shortcutTransformation: 'Dobro de 15 é 30 → Dobro de 30 é 60!',
    geometryConnection: 'Forja tetrominós de área 4 em cascata (×2 → ×4 → ×8).',
  },
  {
    lensId: 'relogio_5_dobra_meia',
    exampleExpression: '18 × 5 = ?',
    shortcutTransformation: 'Metade de 18 é 9 → 9 × 10 = 90!',
    geometryConnection: 'Transmuta o Cubo 2×2 na Barra Solar 1×4 (mesma área, forma ideal).',
  },
  {
    lensId: 'infinito_9_quadrados',
    exampleExpression: '19 × 6 = ?',
    shortcutTransformation: '(20 × 6) − 6 → 120 − 6 = 114',
    geometryConnection: 'Usa a borda superior Base-10/20 e recua 1 unidade com precisão.',
  },
  {
    lensId: 'corta_no_meio_div',
    exampleExpression: '85 ÷ 5 = ?',
    shortcutTransformation: 'Dobre os dois lados → 170 ÷ 10 = 17!',
    geometryConnection: 'Divide estruturas densas ao meio para abrir espaço na arena.',
  },
]

/**
 * Educational BAB Landing Page + Live Arena for Logic Tetris (Genesis Edition) (`LogicTetrisPage.tsx`).
 *
 * Incorporates Auditor Improvements (`Melhoria 08-A` to `08-D`) & Master Plan V2:
 * - `Melhoria 08-A`: Full Before-After-Bridge (BAB) narrative + Interactive Showcase of the 8 Heiss-Lab
 *   Mental Math Lenses with direct `<Link to="/repositorio/:slug" />` links.
 * - `Melhoria 08-C`: Top Quick-Navigation Bar (`← Todos os Jogos`, `📚 Repositório Didático`,
 *   `🎯 Focar na Arena`, `⛶ Tela Cheia [F]`) and scroll-safe arena focus.
 * - `Master Plan V2`: Expanded `max-w-[1600px]` stage container and native Fullscreen toggle.
 */
export function LogicTetrisPage() {
  const isFullscreen = useLogicTetrisStore((s) => s.isFullscreen)
  const [showHeroInfo, setShowHeroInfo] = useState(false)

  const scrollToArena = () => {
    const el = document.getElementById('lt-arena-anchor')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handlePageFullscreen = () => {
    scrollToArena()
    toggleLogicTetrisFullscreen()
  }

  return (
    <div className="min-h-screen bg-[#040812] text-slate-100" data-testid="logic-tetris-page">
      {/* Top Quick Navigation Bar (`Melhoria 08-C` & Sekundo Icon-First) */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 py-1.5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Link
              to="/jogos"
              data-testid="nav-back-games"
              title="Voltar para Todos os Jogos"
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-cyan-300 transition"
            >
              ← Jogos
            </Link>
            <span className="hidden sm:inline text-xs font-mono font-bold text-slate-300">
              🏛️ Logic Tetris
            </span>
            <button
              type="button"
              onClick={() => setShowHeroInfo((prev) => !prev)}
              data-testid="btn-toggle-hero-info"
              title="Sobre o Logic Tetris (Click-to-Reveal)"
              className={`w-7 h-7 rounded-lg border text-xs font-mono flex items-center justify-center transition cursor-pointer ${
                showHeroInfo
                  ? 'bg-cyan-500/30 border-cyan-300 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
              }`}
            >
              ℹ️
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              to="/repositorio"
              data-testid="nav-to-repository"
              title="Repositório Didático das 8 Lentes"
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-amber-200 transition"
            >
              📚 <span className="hidden md:inline">Repositório</span>
            </Link>
            <button
              type="button"
              onClick={scrollToArena}
              data-testid="btn-focus-arena"
              title="Focar na Arena"
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-xs font-mono font-bold text-cyan-200 transition cursor-pointer"
            >
              🎯 <span className="hidden md:inline">Arena</span>
            </button>
            <button
              type="button"
              onClick={handlePageFullscreen}
              data-testid="btn-page-fullscreen"
              title="Alternar Tela Cheia [F]"
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition cursor-pointer ${
                isFullscreen
                  ? 'bg-purple-500/40 border-purple-300 text-white'
                  : 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/60 text-purple-200'
              }`}
            >
              {isFullscreen ? '🗗' : '⛶'} <span className="hidden md:inline">[F]</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: LIVE EMBEDDED GAME ARENA IMMEDIATELY AT TOP OF VIEWPORT
          ===================================================================== */}
      <section className="relative pt-2 pb-10 px-2 sm:px-4 max-w-[1600px] mx-auto">
        {showHeroInfo && (
          <div className="text-center max-w-3xl mx-auto mb-3 rounded-2xl bg-slate-900/90 border border-cyan-500/40 p-3 animate-fadeIn">
            <h1 className="text-base sm:text-xl font-extrabold text-white">
              Logic Tetris:{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                Onde a Matemática Salva a Sua Vida nos 3 Estilos dos Blocos
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Alterne entre <strong>🧱 Clássico 20×10</strong>, <strong>🍎 Frutas 10×10</strong> e{' '}
              <strong>🧩 Grade 10×10</strong>. Clique em qualquer ícone nas docas superior e
              inferior para revelar seu funcionamento!
            </p>
          </div>
        )}

        {/* Live Game Anchor */}
        <div id="lt-arena-anchor" className="scroll-mt-12">
          <LogicTetrisGame />
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: BEFORE vs AFTER (BAB FRAMEWORK — O DIAGNÓSTICO E A LIBERTAÇÃO)
          ===================================================================== */}
      <section
        className="py-14 px-4 sm:px-6 border-t border-slate-800/80 bg-slate-950/60"
        data-testid="bab-before-after-section"
      >
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* BEFORE: A Tirania do Acaso & O Medo da Conta */}
            <div className="rounded-3xl bg-rose-950/20 border border-rose-500/30 p-6 sm:p-8 space-y-4">
              <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-xs font-mono font-bold text-rose-300">
                ❌ ANTES: A IMPOTÊNCIA DO ACASO & DA DECOREBA
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Quando um único buraco soterrado ou um "empréstimo" travava tudo
              </h2>
              <ul className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold mt-0.5">01.</span>
                  <span>
                    <strong>Monotonia & Refém da Sorte:</strong> Jogos de blocos tradicionais
                    prendem você a uma única regra rígida e não oferecem forma inteligente de moldar
                    a peça ou reparar uma cavidade soterrada.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold mt-0.5">02.</span>
                  <span>
                    <strong>Dicas que Dão Spoiler ou Decoreba Fria:</strong> Subtrair{' '}
                    <code>42 − 19</code> pedindo emprestado gera ansiedade, e dicas que entregam a
                    resposta pronta roubam o prazer da descoberta mental.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold mt-0.5">03.</span>
                  <span>
                    <strong>Combos que Morrem Cedo:</strong> Uma única peça sem limpar linha zerava
                    sua sequência e estagnava o som a partir do 5×.
                  </span>
                </li>
              </ul>
            </div>

            {/* AFTER: A Soberania da Matemática Salva-Vidas */}
            <div className="rounded-3xl bg-cyan-950/25 border border-cyan-500/40 p-6 sm:p-8 space-y-4">
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-xs font-mono font-bold text-cyan-200">
                ✨ DEPOIS: CORDÃO TRÍPLICE 3-EM-1, LUZ GUIA ZERO-SPOILER & DOPAMINA 16×+
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Três universos geométricos proporcionais, raciocínio socrático e sinfonia até 12×+!
              </h2>
              <ul className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-cyan-400 font-bold mt-0.5">🧶</span>
                  <span>
                    <strong>O Cordão Tríplice dos Blocos em Tempo Real ([G] / [L]):</strong> Alterne
                    automaticamente a cada 4 limpezas (eliminando a maioria dos blocos acumulados!)
                    ou trave entre <strong>Tetris Clássico 20×10 (7+3=10)</strong>,{' '}
                    <strong>Frutas 10×10 Cheia (Troca 3+)</strong> e{' '}
                    <strong>Grade Livre H×V 10×10 (Macro-Blocos 3×3)</strong>!
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold mt-0.5">💡</span>
                  <span>
                    <strong>Luz Guia Socrática Zero-Spoiler & Alquimia [M]/[B]:</strong> A dica
                    ensina o <em>caminho mental</em> (ex.: cortar na metade duas vezes para dividir
                    por 4) sem jamais entregar o resultado final antes do seu clique!
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-purple-400 font-bold mt-0.5">👑</span>
                  <span>
                    <strong>Sinfonia de Dopamina de 16 Estágios (12×+) & Fênix 142857:</strong> Com
                    janela de momentum de 3 jogadas, sua sequência escala de acordes pentatônicos
                    até fanfarras Lídias, Supernova e o Êxtase Gênesis 12×+!
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* 3 Architectural Highlight Cards of the Triple Cord Expansion (`Melhoria 07-A`) */}
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
            data-testid="bab-trinity-pillars-grid"
          >
            <article className="rounded-2xl bg-slate-900/80 border border-cyan-500/30 p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-300">
                  🧱🍎🧩 CORDÃO TRÍPLICE 3-EM-1
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-[10px] font-mono text-cyan-200">
                  [G] Trocar · [L] Travar
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-white">
                Torre 20×10 Base-10, Arena 10×10 de Frutas & Grade H×V 10×10
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Experimente a gravidade clássica de tetrominós, a troca adjacente de frutas na
                grade 10×10 cheia com cascatas e o encaixe tátil de Macro-Blocos (3×3, 1×5) sem
                cortar o cenário!
              </p>
            </article>

            <article className="rounded-2xl bg-slate-900/80 border border-amber-500/30 p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-300">
                  🔮 ALQUIMIA [M] & [B]
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-[10px] font-mono text-amber-200">
                  100% Zero-Spoiler
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-white">
                Luz Guia Socrática & Milagres Polimórficos
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Cada estilo adapta seus poderes: molde tetrominós ou peças da bandeja (inclusive
                Cubos 3×3!), forje 2 Estrelas Coringa (✦+✦), acione o Imã Magnético de Frutas ou
                sele cruzamentos H×V!
              </p>
            </article>

            <article className="rounded-2xl bg-slate-900/80 border border-purple-500/30 p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-purple-300">
                  👑 DOPAMINA 12×+ & FÊNIX
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-[10px] font-mono text-purple-200">
                  16 Estágios Web Audio
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-white">
                Protocolo Fênix 142857 & Escudo de Momentum (3 Peças)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Mantenha sua sequência viva por até 3 jogadas preparatórias rumo à fanfarra lendária
                12×+ com fogos dourados, e purifique a base com a harmonia cíclica 142857!
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: BRIDGE — VITRINE INTERATIVA DAS 8 LENTES HEISS-LAB (/repositorio)
          ===================================================================== */}
      <section
        className="py-14 px-4 sm:px-6 border-t border-slate-800/80"
        data-testid="bab-lenses-bridge-section"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-xs font-mono font-bold text-amber-200">
              🧭 A PONTE PEDAGÓGICA · MATERIAL DIDÁTICO OFICIAL
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-[12px]">
              As 8 Lentes de Cálculo Mental das 4 Operações
            </h2>
            <p className="text-sm text-slate-300 mt-[8px]">
              Todas as contas do <strong>Logic Tetris</strong> são extraídas diretamente das aulas do{' '}
              <Link to="/repositorio" className="text-cyan-300 underline underline-offset-2">
                Repositório Didático Heiss-Lab
              </Link>
              . Clique em qualquer lente para dominar o truque completo:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {LENS_SHOWCASE_ITEMS.map((item) => {
              const meta = TETRIS_MATH_LENSES[item.lensId]
              return (
                <article
                  key={item.lensId}
                  className="lt-glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-cyan-400/60 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-mono font-bold text-cyan-200">
                        {meta.lensBadge}
                      </span>
                      <span className="text-xs font-mono font-extrabold text-amber-300">
                        Op: {meta.op}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white">{meta.titlePt}</h3>

                    <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-2.5 font-mono">
                      <div className="text-xs text-slate-400">{item.exampleExpression}</div>
                      <div className="text-xs font-bold text-emerald-300 mt-0.5">
                        {item.shortcutTransformation}
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {item.geometryConnection}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <Link
                      to={`/repositorio/${meta.relatedLessonSlug}`}
                      data-testid={`bridge-lesson-link-${item.lensId}`}
                      className="text-xs font-mono font-bold text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                    >
                      📚 Ler Aula no Repositório →
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>

          {/* Bottom CTA back to Arena */}
          <div className="mt-[40px] text-center">
            <button
              type="button"
              onClick={scrollToArena}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-extrabold font-mono text-sm shadow-[0_0_28px_rgba(34,211,238,0.4)] transition cursor-pointer"
            >
              ▲ Subir para a Arena e Jogar Logic Tetris Agora
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LogicTetrisPage
