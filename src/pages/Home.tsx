import { InteractiveMathHack } from '../components/landing/InteractiveMathHack'
import { GamesShowcase } from '../components/landing/GamesShowcase'
import { BiasesInteractiveGrid } from '../components/landing/BiasesInteractiveGrid'
import { LeadMagnetSection } from '../components/landing/LeadMagnetSection'

// ── Pain point items ("Before" — O Diagnóstico) ──────────────────
const PAIN_POINTS = [
  {
    number: '01',
    title: 'A Ilusão da Matemática Limpa & O Juiz Interno',
    desc: 'A matemática dos livros escolares parece limpa, perfeita e mecânica. Mas isso cria uma paralisia silenciosa: o medo visceral de errar o cálculo e ser julgado. Fomos treinados para temer a falha, quando o erro não é o fim — é o verdadeiro rascunho do pensamento.',
  },
  {
    number: '02',
    title: 'O Trauma da Decoreba e o "Pedir Emprestado"',
    desc: 'Regras sem sentido geométrico geram atrito cognitivo. Pedir emprestado na subtração, decorar tabuadas no desespero e memorizar fórmulas sem entender a balança dos números transforma o ato de raciocinar em tortura mecânica.',
  },
  {
    number: '03',
    title: 'A Perda da Jornada Intelectual na Era da IA',
    desc: 'Algoritmos agora cospem respostas prontas em milissegundos. Mas quem terceiriza o raciocínio perde a soberania cognitiva. A verdadeira dignidade humana reside no esforço de pesquisar, errar, debater e encontrar a solução pela própria mente.',
  },
]

// ── Desired outcome items ("After" — A Visão) ──────────────────
const OUTCOMES = [
  {
    icon: '◈',
    title: 'Matemática como Linguagem Universal',
    desc: 'Antes dos símbolos formais, usávamos a linguagem para argumentar e deduzir. Entender os números é dominar a interpretação das probabilidades e das simetrias do mundo.',
    color: 'outcome-item--cyan',
  },
  {
    icon: '◈',
    title: 'O Erro como Ferramenta Científica',
    desc: 'Um ambiente onde falhar, testar hipóteses e calibrar o raciocínio é celebrado. O cálculo mental volta a ser uma exploração fascinante, livre da crueldade do seu juiz interno.',
    color: 'outcome-item--purple',
  },
  {
    icon: '◈',
    title: 'Lógica Soberana & Geometria Mental',
    desc: 'Manipulando sempre do maior para o menor. Unindo a velocidade computacional com a alma humana para resgatar o prazer supremo de resolver problemas complexos.',
    color: 'outcome-item--gold',
  },
]

// ── Hero bullet points ──────────────────────────────────────────
const HERO_BULLETS = [
  'Desligue o seu "Juiz" interno: o erro é o rascunho do pensamento.',
  'Descubra os atalhos visuais e a simetria dos números que a escola nunca ensinou.',
  '4 Jogos interativos 100% no navegador para treinar cálculo mental e agilidade lógica.',
]

export function Home() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — ABOVE THE FOLD (Hero + Interactive Math Hack)
      ══════════════════════════════════════════════════════════════ */}
      <section className="home-hero" aria-label="Introdução ao Heiss-Lab e LogicDefense">
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
            <span>LOGIC DEFENSE & HEISS-LAB</span>
            <span className="home-hero__badge-sep" aria-hidden="true">|</span>
            <span>Matemática Soberana · Jogos · IA</span>
          </div>

          <h1 className="home-hero__title">
            Onde a Matemática e o
            <br />
            <span className="home-hero__title-accent">Pensamento Lógico</span> Voltam
            <br />
            a Ser Humanos.
          </h1>

          <p className="home-hero__sub">
            Antes dos números e das fórmulas decoradas, existia a razão. A Inteligência Artificial pode resolver qualquer equação instantaneamente, mas o ato de pensar, argumentar e criar é a nossa soberania. Bem-vindo ao laboratório desenhado para libertar sua mente do medo de errar através de jogos de pura lógica e métodos visuais.
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
              id="cta-jogar-agora"
              aria-label="Conhecer e jogar os 4 jogos do ecossistema"
              onClick={() => scrollTo('jogos-section')}
            >
              ▶ Conhecer os 4 Jogos
              <span className="btn-hero__arrow" aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="btn-hero-secondary"
              id="cta-testar-hack-japones"
              aria-label="Experimentar a micro-calculadora do Hack Japonês"
              onClick={() => scrollTo('math-hack-demo')}
            >
              ⚡ Testar Hack Japonês ao Vivo
            </button>
          </div>

          {/* Embedded Interactive Math Hack Widget on First Fold */}
          <InteractiveMathHack />

          {/* Decorative divider */}
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
              Muitos acreditam que a IA nos liberta do pensamento. Mas se permitirmos que nossa capacidade de raciocinar seja substituída por caixas-pretas algorítmicas, nos tornamos meros passageiros passivos. <strong>A verdadeira riqueza sempre esteve na jornada da pesquisa, no rascunho do erro e na conquista da solução pela própria mente.</strong>
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
            <span className="section-heading--accent">Através da Lógica Soberana.</span>
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
          SECTION 4 — THE 4 GAMES SHOWCASE (The Bridge)
      ══════════════════════════════════════════════════════ */}
      <GamesShowcase />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 5 — OS VIÉSES DOS NÚMEROS (Interactive Deep Dive)
      ══════════════════════════════════════════════════════ */}
      <BiasesInteractiveGrid />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 6 — LEAD MAGNET & REPOSITÓRIO DIDÁTICO
      ══════════════════════════════════════════════════════ */}
      <LeadMagnetSection />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 7 — MESSAGE FROM THE FOUNDER (Credibility & Soul)
      ══════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--founder"
        aria-labelledby="founder-heading"
        id="founder-section"
      >
        <div className="section section--sm">
          <p className="section-eyebrow" aria-hidden="true">O Manifesto do Fundador</p>

          <h2 id="founder-heading" className="section-heading section-heading--center">
            Um projeto humano, em co-criação
            <br />
            <span className="section-heading--accent">com a Inteligência Artificial.</span>
          </h2>

          <blockquote className="founder-quote">
            <div className="founder-quote__mark" aria-hidden="true">"</div>
            <p className="founder-quote__text">
              A publicação de um artigo antigamente envolvia uma teia de experiências: a pesquisa profunda, o debate, o rascunho. A jornada carregava o maior peso. O ser humano finalmente lidará com as consequências em escala de suas próprias criações.
            </p>
            <p className="founder-quote__text">
              Nós escolhemos usar essa alavanca tecnológica com consciência. Este portal é validado no dia a dia por professores em salas de aula reais, provando que a IA é a melhor ferramenta para mentes que não têm medo de filosofar sobre o código.
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
          SECTION 8 — FINAL CTA & CONTACT
      ══════════════════════════════════════════════════════ */}
      <section
        className="home-section home-section--contact"
        aria-labelledby="contact-heading"
      >
        <div className="section section--sm home-contact">
          <h2 id="contact-heading" className="home-contact__heading">
            Junte-se à Resistência Intelectual.
          </h2>

          <p className="home-contact__desc">
            Quer contribuir como autor, educador, implementar os jogos em sua escola ou somar forças com o nosso projeto?
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
