import { useState } from 'react'
import { Link } from 'react-router-dom'

// ── Section 5: Platform Hub cards ───────────────────────────────
const HUB_CARDS = [
  {
    to: '/jogos',
    accent: 'hub-card--cyan',
    icon: '⚔️',
    eyebrow: 'Jogos',
    title: 'Logic Defense',
    desc: 'Aprenda matemática sem perceber. Treinamento de raciocínio lógico onde o erro faz parte da mecânica de vitória.',
    cta: 'Jogar agora',
  },
  {
    to: '/laboratorio',
    accent: 'hub-card--purple',
    icon: '🔬',
    eyebrow: 'Laboratório de IA',
    title: 'Pesquisa & Reflexão',
    desc: 'Pesquisas e vídeos sobre IA aplicada à educação. Ferramentas e reflexões filosóficas para o educador moderno.',
    cta: 'Entrar no lab',
  },
  {
    to: '/repositorio',
    accent: 'hub-card--gold',
    icon: '📐',
    eyebrow: 'Repositório Didático',
    title: 'Museu dos Números',
    desc: 'Fundamentos profundos da álgebra, frações e a verdadeira história por trás das fórmulas. O passado que explica o presente (Aulas em LaTeX e PDFs).',
    cta: 'Explorar o acervo',
  },
]

// ── Section 2: Pain point items ("Before") ──────────────────────
const PAIN_POINTS = [
  {
    number: '01',
    title: 'A Ilusão da Matemática Limpa',
    desc: 'A matemática que vemos nos livros parece limpa e perfeita. Mas isso cria uma paralisia: o medo de escrever o número errado. Fomos ensinados a temer a falha, quando o erro não é o fim, é o rascunho do pensamento.',
  },
  {
    number: '02',
    title: 'A Perda da Jornada',
    desc: 'A IA removeu a necessidade do trabalho árduo. Mas, ao nos tornarmos apenas "alimentadores de máquinas", corremos o risco de desvalorizar a própria experiência de vida e o esforço monumental dos nossos antepassados.',
  },
  {
    number: '03',
    title: 'A Morte do Propósito',
    desc: 'Como nos ensina a sabedoria, há proveito em todo trabalho árduo. Uma vida sem o propósito da jornada intelectual é exaustiva e vazia.',
  },
]

// ── Section 3: Desired outcome items ("After") ──────────────────
const OUTCOMES = [
  {
    icon: '◈',
    title: 'Matemática como Linguagem',
    desc: 'Antes da física, da medicina ou do direito, usávamos a linguagem para raciocinar. Entender a matemática é, em sua essência, dominar a interpretação do mundo e de suas probabilidades.',
    color: 'outcome-item--cyan',
  },
  {
    icon: '◈',
    title: 'O Erro como Ferramenta Científica',
    desc: 'Imagine um ambiente onde tentar, falhar e corrigir é celebrado como o verdadeiro método científico. A matemática volta a ser uma exploração vital, não um julgamento de valor para o seu "Juiz" interno.',
    color: 'outcome-item--purple',
  },
  {
    icon: '◈',
    title: 'A Lógica Soberana',
    desc: 'Você aprenderá a manipular os números do maior para o menor. Unindo a força bruta da máquina com a sua alma, garantimos que nunca percamos a capacidade vital de raciocinar.',
    color: 'outcome-item--gold',
  },
]

// ── Section 4: Fascination accordion items ──────────────────────
const FASCINATIONS = [
  {
    id: 'hack-1',
    title: 'A Lei do Menor Esforço (+) e o Hack Japonês (−)',
    body: 'Na adição, moldamos a massinha; tiramos de um lado e compensamos no outro. Na subtração, o Subtraendo é o Rei; a conta desce reta, sem nunca precisar "pedir emprestado".',
    symbol: '±',
  },
  {
    id: 'hack-2',
    title: 'A Base do Universo (2, 4 e 8) e a Maldição do 0',
    body: 'O Universo que entendemos é escrito na base 2 (Preto e Branco). E o 0? Ele é o elemento neutro que proíbe balanças exatas na divisão.',
    symbol: '∅',
  },
  {
    id: 'hack-3',
    title: 'O Número da Fênix (7)',
    body: 'A divisão por 7 gera a poderosa dízima 142857. Todos os números aparecem nela; os invisíveis completam as partes perfeitas.',
    symbol: '𝟕',
  },
  {
    id: 'hack-4',
    title: 'O Infinito que Completa (9)',
    body: 'O número que mostra o infinito de qualquer número. Se 8 ÷ 9 = 0.888..., então 9 ÷ 9 = 0.999... (o Infinito que vira o Todo!). A morte de uma fração e o nascimento de algo completo.',
    symbol: '∞',
  },
]

// ── Hero bullet points ──────────────────────────────────────────
const HERO_BULLETS = [
  'Transforme o erro no rascunho do seu pensamento.',
  'A matemática ensinada como a linguagem fundamental do Universo.',
  'Ferramentas que unem a força bruta da Inteligência Artificial com a supervisão humana.',
]

export function Home() {
  const [openAccordion, setOpenAccordion] = useState<string | null>(null)

  const toggleAccordion = (id: string) => {
    setOpenAccordion(prev => (prev === id ? null : id))
  }

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — ABOVE THE FOLD (Hero)
      ══════════════════════════════════════════════════════════════ */}
      <section className="home-hero" aria-label="Introdução ao Heiss-Lab">
        {/* Ambient background glow */}
        <div className="home-hero__glow" aria-hidden="true" />

        {/* Floating math symbols decoration */}
        <div className="home-hero__symbols" aria-hidden="true">
          <span className="home-hero__float home-hero__float--1">∑</span>
          <span className="home-hero__float home-hero__float--2">∫</span>
          <span className="home-hero__float home-hero__float--3">π</span>
          <span className="home-hero__float home-hero__float--4">∞</span>
          <span className="home-hero__float home-hero__float--5">φ</span>
          <span className="home-hero__float home-hero__float--6">Δ</span>
        </div>

        <div className="home-hero__inner">
          {/* Badge / Kicker */}
          <div className="home-hero__badge" id="home-badge">
            <span className="home-hero__badge-symbol" aria-hidden="true">∑</span>
            <span>LOGIC DEFENSE</span>
            <span className="home-hero__badge-sep" aria-hidden="true">|</span>
            <span>Portal Educacional · Heiss-Lab</span>
          </div>

          <h1 className="home-hero__title">
            Onde a Matemática e o
            <br />
            <span className="home-hero__title-accent">Pensamento</span> Voltam
            <br />
            a Ser Humanos.
          </h1>

          <p className="home-hero__sub">
            Antes dos números e dos símbolos, existia a palavra. A inteligência artificial pode
            resolver qualquer equação, mas o ato de pensar e argumentar é o que nos define.
            Bem-vindo ao laboratório desenhado para combater o medo de errar e resgatar o valor
            do esforço intelectual.
          </p>

          {/* Bullet Points */}
          <ul className="home-hero__bullets" role="list">
            {HERO_BULLETS.map((text, i) => (
              <li key={i} className="home-hero__bullet">
                <span className="home-hero__bullet-check" aria-hidden="true">✦</span>
                {text}
              </li>
            ))}
          </ul>

          {/* CTA Buttons */}
          <div className="home-hero__ctas">
            <button
              type="button"
              className="btn-hero-primary"
              id="cta-explorar-laboratorio"
              aria-label="Explorar o Laboratório Heiss-Lab"
              onClick={() => scrollTo('ecosystem-section')}
            >
              Explorar o Laboratório
              <span className="btn-hero__arrow" aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="btn-hero-secondary"
              id="cta-ler-manifesto"
              aria-label="Ler o Manifesto do Heiss-Lab"
              onClick={() => scrollTo('founder-section')}
            >
              Ler o Manifesto ∑
            </button>
          </div>

          {/* Decorative horizontal rule */}
          <div className="home-hero__divider" aria-hidden="true">
            <span />
            <span className="home-hero__divider-symbol">∑</span>
            <span />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — CURRENT PAIN ("Before" — O Diagnóstico)
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--before"
        aria-labelledby="before-heading"
      >
        <div className="section section--sm">
          {/* Section label */}
          <p className="section-eyebrow" aria-hidden="true">O Diagnóstico</p>

          <h2 id="before-heading" className="section-heading">
            O Preço de Ter as
            <br />
            <span className="section-heading--muted">Respostas Prontas.</span>
          </h2>

          <div className="pain-list" role="list">
            {PAIN_POINTS.map(({ number, title, desc }) => (
              <article key={number} className="pain-item" role="listitem">
                <span className="pain-item__number" aria-hidden="true">{number}</span>
                <div className="pain-item__body">
                  <h3 className="pain-item__title">{title}</h3>
                  <p className="pain-item__desc">"{desc}"</p>
                </div>
              </article>
            ))}
          </div>

          {/* Belief Deconstruction */}
          <blockquote className="home-belief" id="belief-deconstruction">
            <div className="home-belief__accent-bar" aria-hidden="true" />
            <p className="home-belief__text">
              Muitos acreditam que a IA nos liberta do pensamento. Mas se permitirmos que nossa
              importância seja determinada por algoritmos, nos tornamos meros "processadores de
              erros". <strong>A verdadeira riqueza sempre esteve na jornada da pesquisa, no debate
                agonista de ideias e na revisão.</strong>
            </p>
          </blockquote>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — DESIRED OUTCOME ("After" — A Visão)
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--after"
        aria-labelledby="after-heading"
      >
        <div className="section">
          <p className="section-eyebrow" aria-hidden="true">A Visão</p>

          <h2 id="after-heading" className="section-heading">
            O Equilíbrio do Universo
            <br />
            <span className="section-heading--accent">Através da Lógica.</span>
          </h2>

          <div className="outcome-grid" role="list">
            {OUTCOMES.map(({ icon, title, desc, color }) => (
              <article key={title} className={`outcome-item ${color}`} role="listitem">
                <span className="outcome-item__icon" aria-hidden="true">{icon}</span>
                <h3 className="outcome-item__title">{title}</h3>
                <p className="outcome-item__desc">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — FASCINATION / DEEP DIVE (A Lógica do One Piece)
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--fascination"
        aria-labelledby="fascination-heading"
        id="fascination-section"
      >
        <div className="section section--sm">
          <p className="section-eyebrow" aria-hidden="true">A Lógica na Prática</p>

          <h2 id="fascination-heading" className="section-heading">
            Saia do Dicionário.
            <br />
            <span className="section-heading--accent">Experimente a Lógica na Prática - LogicDefense game - The genesis of Heiss-Lab.</span>
          </h2>

          <div className="fascination-accordion">
            {FASCINATIONS.map(({ id, title, body, symbol }) => {
              const isOpen = openAccordion === id
              return (
                <div
                  key={id}
                  className={`fascination-item${isOpen ? ' fascination-item--open' : ''}`}
                >
                  <button
                    type="button"
                    className="fascination-item__trigger"
                    onClick={() => toggleAccordion(id)}
                    aria-expanded={isOpen}
                    aria-controls={`fascination-body-${id}`}
                    id={`fascination-trigger-${id}`}
                  >
                    <span className="fascination-item__symbol" aria-hidden="true">{symbol}</span>
                    <span className="fascination-item__title">{title}</span>
                    <span className="fascination-item__chevron" aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  <div
                    className="fascination-item__body"
                    id={`fascination-body-${id}`}
                    role="region"
                    aria-labelledby={`fascination-trigger-${id}`}
                  >
                    <div className="fascination-item__content">
                      <p>{body}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 5 — PLATFORM HUB (The Bridge — A Plataforma)
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--hub"
        aria-labelledby="hub-heading"
        id="ecosystem-section"
      >
        <div className="section">
          <p className="section-eyebrow" aria-hidden="true">A Plataforma</p>

          <h2 id="hub-heading" className="section-heading section-heading--center">
            Explore o Ecossistema{' '}
            <span className="section-heading--accent">Heiss-Lab</span>
          </h2>

          <div className="hub-grid" role="list">
            {HUB_CARDS.map(({ to, accent, icon, eyebrow, title, desc, cta }) => (
              <Link
                key={to}
                to={to}
                className={`hub-card ${accent}`}
                role="listitem"
                aria-label={`${title} — ${eyebrow}`}
              >
                {/* Shimmer overlay */}
                <span className="hub-card__shimmer" aria-hidden="true" />

                <span className="hub-card__eyebrow">{eyebrow}</span>
                <span className="hub-card__icon" aria-hidden="true">{icon}</span>
                <h3 className="hub-card__title">{title}</h3>
                <p className="hub-card__desc">{desc}</p>
                <span className="hub-card__cta">
                  {cta} <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 6 — MESSAGE FROM THE FOUNDER (Credibility)
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--founder"
        aria-labelledby="founder-heading"
        id="founder-section"
      >
        <div className="section section--sm">
          <p className="section-eyebrow" aria-hidden="true">O Manifesto</p>

          <h2 id="founder-heading" className="section-heading section-heading--center">
            Um projeto humano, em co-criação
            <br />
            <span className="section-heading--accent">com a Inteligência Artificial.</span>
          </h2>

          <blockquote className="founder-quote">
            <div className="founder-quote__mark" aria-hidden="true">"</div>
            <p className="founder-quote__text">
              A publicação de um artigo antigamente envolvia uma teia de experiências: a pesquisa
              profunda, o debate, o rascunho. A jornada carregava o maior peso. O ser humano
              finalmente lidará com as consequências em escala de suas próprias criações.
            </p>
            <p className="founder-quote__text">
              Nós escolhemos usar essa alavanca tecnológica com consciência. Este portal é validado
              no dia a dia por professores em salas de aula reais, provando que a IA é a melhor
              ferramenta para mentes que não têm medo de filosofar sobre o código.
            </p>
            <p className="founder-quote__text founder-quote__text--highlight">
              Aceite a Morte, e então, Viva. Não como uma máquina, mas como a alma que você é.
            </p>
            <footer className="founder-quote__signature">
              <span className="founder-quote__dash" aria-hidden="true">—</span>
              <cite>Augusto Heiss</cite>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 7 — FINAL CTA & FOOTER (Contact)
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--contact"
        aria-labelledby="contact-heading"
      >
        <div className="section section--sm home-contact">
          <h2 id="contact-heading" className="home-contact__heading">
            Junte-se à Resistência Intelectual.
          </h2>

          <p className="home-contact__desc">
            Quer contribuir como autor, educador ou somar forças com o nosso projeto de qualquer
            outra forma?
          </p>

          <a
            href="mailto:augustoheiss@gmail.com"
            className="btn-hero-primary"
            id="cta-entre-em-contato"
            aria-label="Enviar e-mail para augustoheiss@gmail.com"
          >
            Entre em contato
            <span className="btn-hero__arrow" aria-hidden="true">✉</span>
          </a>

          <p className="home-contact__email">
            <a href="mailto:augustoheiss@gmail.com">augustoheiss@gmail.com</a>
          </p>
        </div>
      </section>
    </>
  )
}
