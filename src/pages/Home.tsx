import { Link } from 'react-router-dom'

const CARDS = [
  {
    to: '/jogos',
    variant: 'nav-card--cyan',
    icon: '🎮',
    title: 'Menu de Jogos',
    desc: 'Jogos educacionais para treinar raciocínio lógico e matemática. Comece pelo Logic Defense — o Museu dos Números — e domine as operações fundamentais.',
    arrow: 'Ver os jogos',
  },
  {
    to: '/laboratorio',
    variant: 'nav-card--purple',
    icon: '🔬',
    title: 'Laboratório de IA',
    desc: 'Pesquisas, vídeos e aulas sobre Inteligência Artificial e Educação. Ferramentas, reflexões filosóficas e experimentos práticos com tecnologia.',
    arrow: 'Explorar o lab',
  },
  {
    to: '/repositorio',
    variant: 'nav-card--gold',
    icon: '📚',
    title: 'Repositório Didático',
    desc: 'Planos de aula, atividades e PDFs prontos para sala de aula. Material produzido com IA e validado na prática pedagógica.',
    arrow: 'Ver o acervo',
  },
]

export function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <div className="hero">
        <p className="hero__eyebrow">Portal Educacional</p>
        <h1 className="hero__title">
          A Lógica<br />é Soberana
        </h1>
        <p className="hero__sub">
          Um espaço de aprendizado onde Matemática, Filosofia e Inteligência Artificial
          se encontram. Produzido 100% em co-criação com IA.
        </p>
      </div>

      {/* ── Nav Cards ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="nav-cards">
          {CARDS.map(({ to, variant, icon, title, desc, arrow }) => (
            <Link key={to} to={to} className={`nav-card ${variant}`}>
              <span className="nav-card__icon">{icon}</span>
              <h2 className="nav-card__title">{title}</h2>
              <p className="nav-card__desc">{desc}</p>
              <span className="nav-card__arrow">
                {arrow} →
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Quote ── */}
      <div
        className="section section--sm"
        style={{
          textAlign: 'center',
          paddingTop: 0,
          paddingBottom: 'clamp(48px, 6vw, 80px)',
        }}
      >
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 48,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-dim)',
            fontSize: 14,
            lineHeight: 1.8,
          }}
        >
          <p style={{ marginBottom: 6 }}>
            "Desligue o seu Juiz interno. A Lógica é mais profunda e soberana,
            <br />e ninguém escapa da lei das probabilidades."
          </p>
          <p style={{ color: 'var(--accent)', fontSize: 12, letterSpacing: 2 }}>
            — MANIFESTO LOGIC DEFENSE
          </p>
        </div>
      </div>
    </>
  )
}
