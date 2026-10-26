// ──────────────────────────────────────────────────────────────────────────────
// src/pages/LogicBattlePage.tsx — Landing Page BAB + Arena Viva do Logic Battle
// ──────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ALL_TRAP_LIST } from '../games/LogicBattle/config/trapCatalog'
import { UNIT_TIERS } from '../games/LogicBattle/config/unitTiers'
import { LogicBattleGame } from '../games/LogicBattle/LogicBattleGame'

export function LogicBattlePage() {
  const arenaRef = useRef<HTMLDivElement | null>(null)
  const [selectedTrapIdx, setSelectedTrapIdx] = useState(0)

  const scrollToArena = () => {
    arenaRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const toggleFullscreen = () => {
    const el = arenaRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  const activeShowcaseTrap = ALL_TRAP_LIST[selectedTrapIdx] ?? ALL_TRAP_LIST[0]

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      {/* ── HERO SECTION (Before-After-Bridge) ── */}
      <section className="max-w-6xl mx-auto px-4 pt-8 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-400/30">
            ⚔️ JOGO #06 · CROWD RUNNER MATEMÁTICO & CONQUISTA TERRITORIAL
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={scrollToArena}
              data-testid="lb-page-jump-arena-btn"
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition"
            >
              ▶ Ir Direto para a Ponte
            </button>
            <Link
              to="/jogos"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              ← Menu dos 6 Jogos
            </Link>
          </div>
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight mb-3">
          Logic Battle{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-amber-300 to-emerald-400">
            · A Ponte dos Portões & O Reino
          </span>
        </h1>

        <p className="text-slate-300 text-base md:text-lg max-w-3xl mb-6 leading-relaxed">
          Nos anúncios falsos de celular, os portões mentem para frustrar você. No{' '}
          <strong>Logic Battle (Genesis Edition)</strong>, cumprimos a promessa com Matemática
          Soberana: cada portão é 100% honesto, sua legião se funde em{' '}
          <strong>Pelotões Posicionais na Base 10</strong> (Fusão Vai-Um) e cada{' '}
          <strong>Pegadinha da Intuição</strong> gera uma <strong>Ficha de Resgate</strong> para
          você recuperar 100% das tropas perdidas pela razão!
        </p>

        {/* ── ARENA VIVA DO JOGO (MUNDO 1 + MUNDO 2) ── */}
        <div ref={arenaRef} id="logic-battle-arena" className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
              🎮 Arena Interativa · Mundo 1 (A Ponte) & Mundo 2 (O Reino)
            </span>
            <button
              type="button"
              onClick={toggleFullscreen}
              data-testid="lb-fullscreen-btn"
              className="px-3 py-1 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              ⛶ Tela Cheia
            </button>
          </div>

          <LogicBattleGame />
        </div>

        {/* ── VITRINE INTERATIVA DAS 20 PEGADINHAS MATEMÁTICAS ── */}
        <div
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-8"
          data-testid="lb-page-trap-showcase"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            ⚡ ANTÍDOTO CONTRA ILUSÕES COGNITIVAS
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-white mt-1 mb-2">
            Explore as 20 Pegadinhas da Intuição & Luz-Guia Socrática
          </h2>
          <p className="text-slate-300 text-sm mb-4">
            Clique em qualquer pegadinha do catálogo para ver como o cérebro rápido (Sistema 1)
            é enganado e qual pergunta socrática destrava o cálculo mental:
          </p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {ALL_TRAP_LIST.map((trap, idx) => (
              <button
                key={trap.id}
                type="button"
                onClick={() => setSelectedTrapIdx(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  selectedTrapIdx === idx
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {trap.id} · {trap.name}
              </button>
            ))}
          </div>

          <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-4 grid md:grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-bold text-amber-400">
                {activeShowcaseTrap.id} · Placas na Ponte: {activeShowcaseTrap.summaryGatesPt}
              </span>
              <h3 className="text-lg font-extrabold text-white mt-1">
                {activeShowcaseTrap.name}
              </h3>
              <p className="text-sm text-slate-300 mt-2">
                <strong>Armadilha Intuitiva:</strong> {activeShowcaseTrap.intuitionTrapPt}
              </p>
              <p className="text-xs text-sky-300 mt-2">
                <strong>Exemplo Verificado:</strong> {activeShowcaseTrap.verifiedExamplePt}
              </p>
            </div>
            <div className="bg-amber-500/10 border-l-4 border-amber-400 rounded-lg p-3 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-amber-300">
                  💡 Luz-Guia Socrática
                </span>
                <p className="text-sm text-amber-100 mt-1">{activeShowcaseTrap.luzGuiaPt}</p>
              </div>
              <Link
                to={`/repositorio/${activeShowcaseTrap.codexSlug}`}
                className="inline-block mt-3 text-xs font-bold text-sky-300 hover:text-sky-200 underline"
              >
                📚 Estudar Apostila Completa ({activeShowcaseTrap.codexSlug}) →
              </Link>
            </div>
          </div>
        </div>

        {/* ── ESCALA VIVA DOS PELOTÕES POSICIONAIS (BASE 10) ── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            📐 NOTAÇÃO POSICIONAL VIVA (FUSÃO VAI-UM)
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-white mt-1 mb-3">
            Quando 10 Soldados Viram 1 Pelotão Superior
          </h2>
          <p className="text-slate-300 text-sm mb-4">
            Em vez de travar a tela com milhões de bonecos idênticos, cada vez que sua legião
            multiplica por 10 acontece a <strong>Fusão Vai-Um</strong> na espiral de filotaxia:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {UNIT_TIERS.map((t) => (
              <div
                key={t.tierIndex}
                className="bg-slate-950/80 border rounded-xl p-3"
                style={{ borderColor: t.primaryColor }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-slate-800 text-white">
                    [{t.denominationLabel}]
                  </span>
                  <span className="text-xs text-slate-400">10^{t.tierIndex}</span>
                </div>
                <h3 className="text-sm font-bold text-white mt-1.5">{t.unitName}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-snug">{t.etymologyPt}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default LogicBattlePage
