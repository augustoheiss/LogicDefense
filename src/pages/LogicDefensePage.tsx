import { useState } from 'react'
import { GamePage } from '../games/LogicDefense'

// ─────────────────────────────────────────────────────────────────────────────
// Neon glow helpers (Tailwind v4 arbitrary values for box-shadow are verbose,
// so we use a minimal inline-style helper for the glowing effect only)
// ─────────────────────────────────────────────────────────────────────────────
type NeonColor = 'cyan' | 'purple' | 'gold' | 'green' | 'red' | 'orange' | 'pink' | 'blue' | 'gray'

const NEON: Record<NeonColor, { text: string; border: string; glow: string }> = {
  cyan:   { text: 'text-cyan-400',   border: 'border-cyan-400/40',   glow: 'rgba(0,212,255,0.35)' },
  purple: { text: 'text-purple-400', border: 'border-purple-400/40', glow: 'rgba(168,85,247,0.35)' },
  gold:   { text: 'text-yellow-400', border: 'border-yellow-400/40', glow: 'rgba(250,204,21,0.35)' },
  green:  { text: 'text-green-400',  border: 'border-green-400/40',  glow: 'rgba(57,255,20,0.35)' },
  red:    { text: 'text-red-400',    border: 'border-red-400/40',    glow: 'rgba(248,113,113,0.35)' },
  orange: { text: 'text-orange-400', border: 'border-orange-400/40', glow: 'rgba(251,146,60,0.35)' },
  pink:   { text: 'text-pink-400',   border: 'border-pink-400/40',   glow: 'rgba(244,114,182,0.35)' },
  blue:   { text: 'text-blue-400',   border: 'border-blue-400/40',   glow: 'rgba(96,165,250,0.35)' },
  gray:   { text: 'text-slate-400',  border: 'border-slate-400/40',  glow: 'rgba(148,163,184,0.25)' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Tag pill
// ─────────────────────────────────────────────────────────────────────────────
function SectionTag({ label, color }: { label: string; color: NeonColor }) {
  const n = NEON[color]
  return (
    <span
      className={`inline-block font-display text-[10px] font-bold tracking-[0.25em] uppercase px-3.5 py-1 rounded-full border ${n.border} ${n.text} mb-6`}
      style={{ background: `${n.glow.replace('0.35', '0.08')}` }}
    >
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────
function Divider({ color = 'cyan' }: { color?: NeonColor }) {
  const n = NEON[color]
  return (
    <div
      className="w-12 h-0.5 mb-10"
      style={{ background: `linear-gradient(90deg, transparent, ${n.glow.replace('0.35','0.8')}, transparent)` }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero selection card (inside the game)
// ─────────────────────────────────────────────────────────────────────────────
// (This component lives in GamePage.tsx — see useGameEngine for logic)

// ─────────────────────────────────────────────────────────────────────────────
// Feature Card — "Os Viéses dos Números"
// ─────────────────────────────────────────────────────────────────────────────
interface FeatureCardProps {
  number: string
  title: string
  children: React.ReactNode
  color: NeonColor
}

function FeatureCard({ number, title, children, color }: FeatureCardProps) {
  const n = NEON[color]
  return (
    <article
      className={`
        break-inside-avoid mb-6
        relative group rounded-xl p-6
        bg-white/[0.03] border border-white/[0.07]
        transition-all duration-300 ease-out
        hover:-translate-y-1
        hover:border-opacity-100
        hover:bg-white/[0.06]
      `}
      style={{
        '--hover-glow': n.glow,
      } as React.CSSProperties}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = n.glow.replace('0.35', '0.5')
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${n.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = ''
        ;(e.currentTarget as HTMLElement).style.boxShadow = ''
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${n.glow.replace('0.35','0.9')}, transparent)` }}
      />

      {/* Number — Orbitron for the arcade machine feel */}
      <div
        className={`font-display text-3xl font-bold mb-2 leading-none ${n.text}`}
        style={{ textShadow: `0 0 20px ${n.glow}` }}
      >
        {number}
      </div>

      {/* Title — Orbitron, small caps */}
      <div className="font-display text-[11px] font-bold tracking-[0.14em] uppercase text-slate-200 mb-4">
        {title}
      </div>

      {/* Body — Inter for legibility */}
      <div className="font-body text-[13.5px] text-slate-300 leading-relaxed space-y-2.5">
        {children}
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Concept card (After section)
// ─────────────────────────────────────────────────────────────────────────────
function ConceptCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="rounded-xl p-6 bg-white/[0.04] border border-white/[0.07] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_8px_32px_rgba(0,212,255,0.1)]">
      <div className="text-3xl mb-3">{icon}</div>
      <p className="font-display text-[11px] font-bold tracking-widest uppercase text-cyan-400 mb-2">{title}</p>
      <p className="font-body text-[13.5px] text-slate-300 leading-relaxed">{text}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export function LogicDefensePage() {
  const [gameKey, setGameKey] = useState(0)

  function scrollToGame() {
    document.getElementById('ldp-game-anchor')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="bg-[#050510] text-slate-200 font-sans">

      {/* ══════════════════════════════════════════════════════
          1 · ABOVE THE FOLD — 100vh game embed
      ══════════════════════════════════════════════════════ */}
      <section
        id="ldp-game-anchor"
        className="relative w-full overflow-hidden bg-black"
        style={{ height: '100vh', minHeight: 600 }}
      >
        {/* Non-intrusive headline — pointer-events: none so game clicks pass through */}
        <div
          className="absolute top-0 left-0 right-0 z-30 px-6 pt-5 pb-16 text-center pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(5,5,16,0.88) 0%, transparent 100%)' }}
        >
          <h1 className="font-display font-bold text-white text-[clamp(14px,2vw,21px)] mb-1.5 tracking-tight"
              style={{ textShadow: '0 0 30px rgba(0,212,255,0.45)' }}>
            A Lógica do One Piece: Sobreviva ao Caos Através da Matemática.
          </h1>
          <p className="font-body text-slate-300 text-[clamp(11px,1.3vw,14px)] max-w-2xl mx-auto leading-relaxed">
            Desligue o seu 'Juiz' interno. Assuma o controle, pare de decorar fórmulas e comece a hackear os números.
          </p>
        </div>

        {/* Game fills the full section */}
        <div className="absolute inset-0 flex items-center justify-center">
          <GamePage key={gameKey} onReset={() => setGameKey(k => k + 1)} />
        </div>

        {/* Bottom fade to next section */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-20"
          style={{ background: 'linear-gradient(to bottom, transparent, #050510)' }}
        />

        {/* Scroll hint */}
        <div
          className="absolute bottom-7 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none"
          style={{ animation: 'ldp-bounce 2s ease-in-out infinite' }}
        >
          <span className="font-display text-[9px] tracking-[0.2em] uppercase text-slate-500">
            Role para ler os segredos dos números
          </span>
          <span className="text-cyan-400 text-lg" style={{ textShadow: '0 0 10px rgba(0,212,255,0.6)' }}>↓</span>
        </div>
      </section>

      {/* Scroll-hint keyframe (injected inline since no separate CSS file) */}
      <style>{`
        @keyframes ldp-bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%       { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════
          2 · BEFORE — A Dor Atual
      ══════════════════════════════════════════════════════ */}
      <section
        className="py-24 px-6"
        style={{ background: 'linear-gradient(160deg, #0a0008 0%, #050510 100%)', borderTop: '1px solid rgba(248,113,113,0.12)' }}
      >
        <div className="max-w-3xl mx-auto">
          <SectionTag label="Antes" color="red" />
          <h2 className="font-display font-bold text-white mb-8 leading-tight" style={{ fontSize: 'clamp(22px,3.5vw,38px)' }}>
            Por que você <span className="text-red-400" style={{ textShadow: '0 0 20px rgba(248,113,113,0.5)' }}>odeia</span> (ou tem medo) da Matemática?
          </h2>
          <Divider color="red" />

          <p className="font-body text-slate-300 text-base mb-5 leading-relaxed max-w-2xl">
            Palavras como <strong className="text-white font-semibold">Amor</strong>,{' '}
            <strong className="text-white font-semibold">Ódio</strong>, ou o meio-termo
            (<strong className="text-white font-semibold">A Cadeira</strong>), podem ter infinitos
            significados dependendo de como as falamos, dos nossos motivos e de eventos externos
            imprevisíveis. Esses fatores podem fazer nossas palavras sumarem no vácuo — ou serem
            potencializadas como por um microfone.
          </p>
          <p className="font-body text-slate-300 text-base mb-5 leading-relaxed max-w-2xl">
            A escola nos treinou para ser <strong className="text-white font-semibold">máquinas</strong>:
            memorizar regras rígidas, repetir procedimentos, decorar tabuadas sem nenhum porquê.
            Resultado? Um "Juiz" interno cruel que nos faz travar diante de um cálculo simples e
            sentir vergonha de errar em público.
          </p>

          <blockquote
            className="font-body my-10 pl-8 italic text-lg text-slate-200 leading-relaxed font-light"
            style={{ borderLeft: '3px solid rgba(248,113,113,0.7)', background: 'rgba(248,113,113,0.05)', padding: '20px 28px', borderRadius: '0 8px 8px 0' }}
          >
            "Não como uma máquina, que hoje está incrivelmente potente, mas como a alma que você é."
          </blockquote>

          <p className="font-body text-slate-300 text-base mb-5 leading-relaxed max-w-2xl">
            O problema não é com você. É com o método. Você nunca foi ensinado a enxergar a{' '}
            <strong className="text-white font-semibold">geometria invisível</strong> por trás dos números.
            Você foi ensinado a obedecer os números — não a dominá-los.
          </p>
          <p className="font-body text-slate-300 text-base leading-relaxed max-w-2xl">
            Existe uma saída. E ela começa aqui.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          3 · AFTER — O Museu Vivo
      ══════════════════════════════════════════════════════ */}
      <section
        className="py-24 px-6"
        style={{ background: 'linear-gradient(160deg, #05051a 0%, #0a0820 100%)', borderTop: '1px solid rgba(138,43,226,0.15)' }}
      >
        <div className="max-w-3xl mx-auto">
          <SectionTag label="Depois" color="cyan" />
          <h2 className="font-display font-bold text-white mb-4 leading-tight" style={{ fontSize: 'clamp(22px,3.5vw,38px)' }}>
            O <span className="text-cyan-400" style={{ textShadow: '0 0 20px rgba(0,212,255,0.4)' }}>Museu Vivo</span>: A Geometria dos Números
          </h2>
          <Divider color="purple" />

          <div
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm text-purple-300 mb-10"
            style={{ background: 'rgba(138,43,226,0.1)', border: '1px solid rgba(138,43,226,0.3)' }}
          >
            🤖 100% co-criado com Inteligência Artificial
          </div>

          <p className="font-body text-slate-300 text-base mb-5 leading-relaxed max-w-2xl">
            Este jogo é mais do que um jogo. É a prova viva de que a IA é a melhor ferramenta para
            mentes que não têm medo de pensar e filosofar sobre o código. Cada inimigo que você
            enfrenta é uma pergunta. Cada onda é um desafio matemático.{' '}
            <strong className="text-white font-semibold">Cada moeda que seu Herói coleta é uma vitória da Lógica.</strong>
          </p>
          <p className="font-body text-slate-300 text-base mb-12 leading-relaxed max-w-2xl">
            Está na hora de sair do dicionário, sair da biblioteca e experimentar a Lógica na prática.
            Use Dados, Informações, Conhecimentos e Sabedoria a seu favor — estudando a{' '}
            <strong className="text-white font-semibold">função dos números</strong> (e das palavras).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <ConceptCard
              icon="⚖️"
              title="A Balança"
              text="Números têm peso. Aprender a equilibrar a Balança é a essência de toda aritmética — sem decorar, apenas sentir."
            />
            <ConceptCard
              icon="🗡️"
              title="O Hack Japonês"
              text="Nunca peça emprestado. Zere o Subtraendo movendo ambos os números na reta numérica — e o cálculo desce reto, sem dor."
            />
            <ConceptCard
              icon="🔬"
              title="Lei do Menor Esforço"
              text="Identifique qual número está mais perto de um arredondamento. Molde a 'massinha' antes de somar — e o resultado se torna óbvio."
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          4 · FEATURES — Os Viéses dos Números
          ⚠️  STRICTLY LOCKED COPYWRITING — DO NOT ALTER
      ══════════════════════════════════════════════════════ */}
      <section
        className="py-24 px-6"
        style={{ background: '#080820', borderTop: '1px solid rgba(250,204,21,0.1)' }}
      >
        <div className="max-w-5xl mx-auto">
          <SectionTag label="Os Viéses" color="gold" />
          <h2 className="font-display font-bold text-white mb-4 leading-tight" style={{ fontSize: 'clamp(22px,3.5vw,38px)' }}>
            Os <span className="text-yellow-400" style={{ textShadow: '0 0 20px rgba(250,204,21,0.4)' }}>Viéses</span> dos Números
          </h2>
          <Divider color="gold" />

          {/* Intro — EXACT TEXT, LOCKED */}
          <p className="font-body text-slate-300 italic text-sm mb-12 max-w-2xl leading-relaxed">
            A Matemática não vai sair do lugar. Nós apenas escrevemos problemas diferentes de maneiras
            que produzam resultados. A regra universal: <strong className="text-slate-200">Manipule sempre do maior para o menor.</strong>
          </p>

          <div className="columns-1 md:columns-2 xl:columns-3 gap-6">

            {/* ── CARD 1: + e − ─────────────────────────────────────────── */}
            <FeatureCard number="+ e −" title="A Lei do Menor Esforço (+) e o Hack Japonês (−)" color="green">
              <p>
                Na <strong className="text-slate-200">Adição</strong>, moldamos a "massinha". Identificamos
                qual número precisa de menos passos na reta numérica para chegar num zero redondo. Tiramos
                de um lado e compensamos no outro. O que sobra, fazemos por Decomposição (Centena com
                Centena, Dezena com Dezena). Exemplo: 18 + 7 ➔ Tira 2 do sete e dá para o dezoito ➔
                Fica <strong className="text-slate-200">20 + 5 = 25</strong>.
              </p>
              <p>
                Na <strong className="text-slate-200">Subtração</strong>, o Subtraendo é o Rei. Mexemos
                nele primeiro dando passos para frente ou para trás na reta numérica até a unidade zerar,
                e aplicamos o exato mesmo passo no número de cima. O cálculo desce reto, sem nunca precisar
                "pedir emprestado". Exemplo visual: 42 − 19 ➔ Ande 1 passo para frente nos dois números
                para zerar a unidade do Rei ➔ <strong className="text-slate-200">43 − 20 = 23</strong>.
              </p>
            </FeatureCard>

            {/* ── CARD 2: × ─────────────────────────────────────────────── */}
            <FeatureCard number="×" title="A Diferença de Quadrados (×)" color="red">
              <p>
                Na multiplicação, se houver um valor e uma variável em comum equidistante (ex: 12 × 8,
                que é (10+2)×(10−2) ou base² − passo²), usamos a diferença de quadrados: a base ao
                quadrado menos o passo ao quadrado (10² − 2²) ={' '}
                <strong className="text-slate-200">(100 − 4 = 96)</strong>. Pura geometria mental.
              </p>
            </FeatureCard>

            {/* ── CARD 3: 0 ─────────────────────────────────────────────── */}
            <FeatureCard number="0" title="A Maldição e o Início" color="gray">
              <p>
                O elemento neutro da soma e subtração! Junto com o 9 torna algo completo às vezes sem
                aparecer. Ele é tão importante que é proibido usar numa balança exata (divisão), porque
                ele faz parecer que qualquer resultado é a mesma coisa. Ele não é neutro na multiplicação,
                ele é a maldição, o <strong className="text-slate-200">viés necessário</strong>.
              </p>
            </FeatureCard>

            {/* ── CARD 4: 1 ─────────────────────────────────────────────── */}
            <FeatureCard number="1" title="A Balança" color="cyan">
              <p>
                A sequência dos números naturais. O acréscimo de um. Onde o rótulo da conta começa e
                a <strong className="text-slate-200">balança dos números</strong> entra em ação.
              </p>
            </FeatureCard>

            {/* ── CARD 5: 2, 4, 8 ───────────────────────────────────────── */}
            <FeatureCard number="2 · 4 · 8" title="A Base do Universo" color="purple">
              <p>
                <strong className="text-slate-200">Tabuada do 2:</strong> O Universo que entendemos de
                verdade é escrito na base 2: Preto e Branco, as cores que prevalecem no Sistema.
              </p>
              <p>
                <strong className="text-slate-200">Tabuada do 4:</strong> O dobro do dobro. Qualquer
                número multiplicado por 4 é o dobro duas vezes.
              </p>
              <p>
                <strong className="text-slate-200">A Grandeza do 8:</strong> O cubo de 2. Sabe como
                somar 8 rápido? Volta dois passos e adiciona uma dezena à esquerda.
              </p>
            </FeatureCard>

            {/* ── CARD 6: 3, 6 ──────────────────────────────────────────── */}
            <FeatureCard number="3 · 6" title="A Fração e a Dúzia" color="orange">
              <p>
                <strong className="text-slate-200">Tabuada do 3:</strong> Uma parte perfeita do número
                completo, o rei das dízimas periódicas. Sabe quem ele coroa? O 9.
              </p>
              <p>
                <strong className="text-slate-200">Tabuada do 6:</strong> A meia dúzia. Palavras de um
                sistema antigo muito útil, porque o 12 se divide perfeitamente por 2, 3, 4 e 6!
              </p>
            </FeatureCard>

            {/* ── CARD 7: 5 ─────────────────────────────────────────────── */}
            <FeatureCard number="5" title="O Nosso Relógio" color="blue">
              <p>
                A tabuada que nos faz inteligentes com a sua facilidade absoluta em transformar o difícil.
                A mágica de{' '}
                <strong className="text-slate-200">cortar na metade</strong> e terminar em 0 ou 5.
              </p>
            </FeatureCard>

            {/* ── CARD 8: 7 ─────────────────────────────────────────────── */}
            <FeatureCard number="7" title="O Número da Fênix (142857)" color="pink">
              <p>
                Ele é aceito como louco porque sua verdade é encontrada em números muito grandes ou muito
                pequenos. Mas em conjunto, a divisão por 7 gera a poderosa dízima{' '}
                <strong className="text-slate-200">142857</strong>. Todos os números aparecem nela; os
                invisíveis completam as partes perfeitas. Fatorando:{' '}
                <strong className="text-slate-200">(142 + 857 = 999)</strong>.
              </p>
            </FeatureCard>

            {/* ── CARD 9: 9 ─────────────────────────────────────────────── */}
            <FeatureCard number="9" title="O Infinito que Completa" color="gold">
              <p>
                O número que não aparece nas dízimas periódicas porque ele mostra o infinito de qualquer
                número. Se 1 ÷ 9 = 0.111... e 8 ÷ 9 = 0.888..., então 9 ÷ 9 = 0.999... (o Infinito que
                vira o 1, o Todo!). A morte de uma fração e o nascimento de algo completo. A regra do 9 é
                divina: <strong className="text-slate-200">diminui uma unidade e soma uma na dezena</strong>{' '}
                (9, 18, 27, 36...).
              </p>
            </FeatureCard>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          5 · CTA / FOOTER
      ══════════════════════════════════════════════════════ */}
      <section
        className="py-24 px-6 text-center"
        style={{ background: 'linear-gradient(160deg, #02020f 0%, #050510 100%)', borderTop: '1px solid rgba(57,255,20,0.1)' }}
      >
        <div className="max-w-2xl mx-auto">
          <SectionTag label="Missão" color="green" />
          <h2 className="font-display font-bold text-white mb-4 leading-tight" style={{ fontSize: 'clamp(20px,3vw,34px)' }}>
            Pronto para Dominar a Onda?
          </h2>

          <div className="w-12 h-0.5 mx-auto mb-8" style={{ background: 'linear-gradient(90deg, transparent, rgba(57,255,20,0.8), transparent)' }} />

          <p className="font-body text-slate-300 text-base mb-3 leading-relaxed">
            Este projeto foi construído por um único fundador com uma crença simples: a IA e a
            Matemática são as ferramentas da liberdade.
          </p>
          <p className="font-body text-slate-300 text-base mb-3 leading-relaxed">
            Quer conversar sobre tecnologia, educação ou co-criar algo novo?
          </p>
          <p className="font-body text-slate-300 text-base mb-10">
            📧{' '}
            <a
              id="founder-email"
              href="mailto:augustoheiss@gmail.com"
              className="text-cyan-400 hover:text-white transition-colors duration-200 hover:drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]"
            >
              augustoheiss@gmail.com
            </a>
          </p>

          <button
            id="cta-back-to-game"
            onClick={scrollToGame}
            className="
              inline-flex items-center gap-3
              px-12 py-5
              font-display font-bold text-base tracking-widest uppercase
              text-green-400 border-2 border-green-400 rounded-lg
              bg-transparent cursor-pointer
              transition-all duration-300 ease-out
              hover:bg-green-400/10
              hover:-translate-y-0.5
              active:translate-y-0
            "
            style={{
              textShadow: '0 0 10px rgba(57,255,20,0.5)',
              boxShadow: '0 0 20px rgba(57,255,20,0.15)',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 40px rgba(57,255,20,0.35)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 20px rgba(57,255,20,0.15)')}
          >
            ⚔ Enfrentar a Onda 1000
          </button>
        </div>
      </section>

    </div>
  )
}
