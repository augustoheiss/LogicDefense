import { Link } from 'react-router-dom'
import { LogicTetrisGame } from '../games/LogicTetris'
import { TETRIS_MATH_LENSES } from '../games/LogicTetris/engine/mathEngine'
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
 * Incorporates Auditor Improvements (`Melhoria 08-A` to `08-D`):
 * - `Melhoria 08-A`: Full Before-After-Bridge (BAB) narrative + Interactive Showcase of the 8 Heiss-Lab
 *   Mental Math Lenses with direct `<Link to="/repositorio/:slug" />` links.
 * - `Melhoria 08-C`: Top Quick-Navigation Bar (`← Todos os Jogos`, `📚 Repositório Didático`,
 *   `🎯 Focar na Arena`) and scroll-safe arena focus.
 */
export function LogicTetrisPage() {
  const scrollToArena = () => {
    const el = document.getElementById('lt-arena-anchor')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="min-h-screen bg-[#040812] text-slate-100" data-testid="logic-tetris-page">
      {/* Top Quick Navigation Bar (`Melhoria 08-C`) */}
      <div className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              to="/jogos"
              data-testid="nav-back-games"
              className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-cyan-300 transition"
            >
              ← Todos os Jogos
            </Link>
            <span className="hidden sm:inline text-xs font-mono text-slate-400">
              🏛️ Logic Tetris (Genesis Edition) · Aritmética Salva-Vidas
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/repositorio"
              data-testid="nav-to-repository"
              className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-amber-200 transition"
            >
              📚 Repositório Didático
            </Link>
            <button
              type="button"
              onClick={scrollToArena}
              data-testid="btn-focus-arena"
              className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-xs font-mono font-bold text-cyan-200 transition cursor-pointer"
            >
              🎯 Focar na Arena
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: HERO & LIVE EMBEDDED GAME ARENA (ABOVE THE FOLD)
          ===================================================================== */}
      <section className="relative pt-6 pb-12 px-3 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-6">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono font-bold text-cyan-300 mb-3">
            <span>🧩 HEISS-LAB · PUZZLE GEOMÉTRICO BASE-10</span>
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Logic Tetris:{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
              Onde a Matemática Salva a Sua Vida no Jogo.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-2.5 leading-relaxed">
            Na versão Gênesis do Tetris, você não é refém da sorte: faça uma conta mental das{' '}
            <strong>4 operações (+, −, ×, ÷)</strong> para{' '}
            <strong className="text-cyan-300">mudar a peça caindo [M]</strong> para o formato exato
            que você precisa, <strong className="text-amber-300">tapar um buraco soterrado [B]</strong>{' '}
            com cristais dourados ou purificar a base com o{' '}
            <strong className="text-purple-300">Protocolo Fênix 142857</strong>!
          </p>
        </div>

        {/* Live Game Anchor */}
        <div id="lt-arena-anchor" className="scroll-mt-16">
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
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <strong>No Tetris Clássico:</strong> Você precisa desesperadamente da barra{' '}
                  <code>I</code> ou soterra um único buraco na base, mas o jogo não lhe dá nenhuma
                  forma inteligente de alterar a peça ou reparar a estrutura.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-400 font-bold mt-0.5">02.</span>
                <span>
                  <strong>Na Aritmética Mecânica:</strong> Subtrair <code>42 − 19</code> pedindo
                  emprestado ou decorar tabuadas frias gera ansiedade e esconde a beleza geométrica
                  da Base-10.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-400 font-bold mt-0.5">03.</span>
                <span>
                  <strong>O Erro Punitivo:</strong> Errar uma conta na escola ou colocar um bloco no
                  lugar errado costumava significar punição imediata sem segunda chance.
                </span>
              </li>
            </ul>
          </div>

          {/* AFTER: A Soberania da Matemática Salva-Vidas */}
          <div className="rounded-3xl bg-cyan-950/25 border border-cyan-500/40 p-6 sm:p-8 space-y-4">
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-xs font-mono font-bold text-cyan-200">
              ✨ DEPOIS: A MATEMÁTICA COMO SUPERPODER SALVA-VIDAS
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Seu raciocínio rápido molda o formato da peça e sela qualquer buraco!
            </h2>
            <ul className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-cyan-400 font-bold mt-0.5">🔮</span>
                <span>
                  <strong>Metamorfose de Peça [M]:</strong> Precisa de uma barra <code>I</code>, de
                  um cubo <code>O</code> ou do <strong>Monominó Dourado 1×1</strong>? Resolva uma
                  conta em Bullet-Time e receba exatamente a peça escolhida com escudo de flutuação!
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-amber-400 font-bold mt-0.5">✦</span>
                <span>
                  <strong>Tapar Buracos Soterrados [B]:</strong> Equilibre a Balança da Dezena para
                  materializar Cristais Dourados diretamente nas cavidades profundas e disparar
                  limpezas em cascata!
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-purple-400 font-bold mt-0.5">🔥</span>
                <span>
                  <strong>Protocolo Fênix 142857 & Segunda Chance Elástica:</strong> Mesmo quando a
                  pilha encosta no topo, acertar o desafio Fênix purifica os andares inferiores e
                  salva a sua partida!
                </span>
              </li>
            </ul>
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
