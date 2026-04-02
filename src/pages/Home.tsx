import { Link } from 'react-router-dom'

// ── Section 4: Platform Hub cards ───────────────────────────────
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
    desc: 'Fundamentos profundos da álgebra, frações e a verdadeira história por trás das fórmulas. O passado que explica o presente.',
    cta: 'Explorar o acervo',
  },
]

// ── Section 2: Pain point items ("Before") ──────────────────────
const PAIN_POINTS = [
  {
    number: '01',
    title: 'A Ilusão da Matemática Limpa',
    desc: 'A matemática que vemos nos livros parece limpa e perfeita. Mas isso cria uma paralisia: o medo de escrever o número errado. O erro não é o fim, é o rascunho do pensamento.',
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
    desc: 'Antes da física, da medicina ou do direito, usávamos a linguagem para raciocinar. Entender a matemática é, em sua essência, dominar a interpretação do mundo.',
    color: 'outcome-item--cyan',
  },
  {
    icon: '◈',
    title: 'O Erro como Ferramenta',
    desc: 'Imagine um ambiente onde tentar, falhar e corrigir é celebrado como o verdadeiro método científico. A matemática volta a ser uma exploração, não um julgamento de valor.',
    color: 'outcome-item--purple',
  },
  {
    icon: '◈',
    title: 'A Lógica Soberana',
    desc: 'Ferramentas que unem a força bruta da Inteligência Artificial com a supervisão e o debate humano, garantindo que não percamos a capacidade vital de raciocinar.',
    color: 'outcome-item--gold',
  },
]

export function Home() {
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — ABOVE THE FOLD (Hero)
      ══════════════════════════════════════════════════════════════ */}
      <section className="home-hero" aria-label="Introdução ao Heiss-Lab">
        {/* Ambient background glow */}
        <div className="home-hero__glow" aria-hidden="true" />

        <div className="home-hero__inner">
          {/* Eyebrow label */}
          <p className="home-hero__eyebrow">Portal Educacional · Heiss-Lab</p>

          <h1 className="home-hero__title">
            Onde a Matemática e o
            <br />
            <span className="home-hero__title-accent">Pensamento</span> Voltam
            <br />
            a Ser Humanos.
          </h1>

          <p className="home-hero__sub">
            Antes dos números e dos símbolos, existia a palavra. A matemática nasceu da nossa
            linguagem e da nossa necessidade de tomar decisões. A inteligência artificial pode
            resolver qualquer equação, mas o ato de pensar e argumentar é o que nos define.
            Bem-vindo ao laboratório desenhado para combater o medo de errar e resgatar o valor
            do esforço intelectual.
          </p>

          {/* CTA Buttons */}
          <div className="home-hero__ctas">
            <Link
              to="/jogos"
              className="btn-hero-primary"
              id="cta-explorar-laboratorio"
              aria-label="Explorar o Laboratório Heiss-Lab"
            >
              Explorar o Laboratório
              <span className="btn-hero__arrow" aria-hidden="true">→</span>
            </Link>
            <Link
              to="/sobre"
              className="btn-hero-secondary"
              id="cta-ler-manifesto"
              aria-label="Ler o Manifesto do Heiss-Lab"
            >
              Ler o Manifesto
            </Link>
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
          SECTION 2 — CURRENT PAIN ("Before")
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
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — DESIRED OUTCOME ("After")
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
          SECTION 4 — PLATFORM HUB (The Solution)
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--hub"
        aria-labelledby="hub-heading"
      >
        <div className="section">
          <p className="section-eyebrow" aria-hidden="true">A Plataforma</p>

          <h2 id="hub-heading" className="section-heading section-heading--center">
            Explore o <span className="section-heading--accent">Heiss-Lab</span>
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
          SECTION 5 — FOOTER CTA (Contact)
      ══════════════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--contact"
        aria-labelledby="contact-heading"
      >
        <div className="section section--sm home-contact">
          {/* Manifesto quote */}
          <blockquote className="home-contact__quote">
            <p>
              "Nós escolhemos usar essa alavanca com consciência."
            </p>
            <footer>
              <cite>— Manifesto Heiss-Lab</cite>
            </footer>
          </blockquote>

          <h2 id="contact-heading" className="home-contact__heading">
            Junte-se a nós.
          </h2>

          <p className="home-contact__desc">
            Quer contribuir como autor, educador ou somar forças?
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
