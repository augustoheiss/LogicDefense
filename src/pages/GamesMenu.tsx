import { Link } from 'react-router-dom'

export function GamesMenu() {
  return (
    <>
      <div className="hero" style={{ paddingBottom: 'clamp(24px, 3vw, 40px)' }}>
        <p className="hero__eyebrow">Portal Educacional · Jogos</p>
        <h1 className="hero__title">Menu de Jogos</h1>
        <p className="hero__sub">
          Aprenda Matemática sem perceber. Cada jogo treina raciocínio lógico
          com feedback imediato e dificuldade progressiva.
        </p>
      </div>

      <div className="section" style={{ paddingTop: 0 }}>
        <p className="section__title">Disponível agora</p>
        <p className="section__subtitle">Jogue diretamente no navegador, sem instalação.</p>

        {/* ── Logic Defense card ── */}
        <div className="game-card">
          <div className="game-card__thumb">
            <span style={{ position: 'relative', zIndex: 1 }}>🏛️</span>
          </div>
          <div className="game-card__body">
            <span className="game-card__tag">Tower Defense</span>
            <h2 className="game-card__title">Logic Defense</h2>
            <p className="game-card__desc">
              O Museu dos Números. Defenda o museu contra invasores respondendo
              contas de matemática. Construa torres, gerencie recursos, sobreviva
              às ondas e desbloqueie buffs especiais com a Roleta SPIN Esfera.
            </p>
            <div className="game-card__footer">
              <span className="game-card__badge">🧮 Cálculo mental</span>
              <span className="game-card__badge">📈 Dificuldade progressiva</span>
              <Link to="/jogos/logic-defense" className="btn-primary">
                ▶ Jogar agora
              </Link>
            </div>
          </div>
        </div>

        {/* ── Logic Ascension card ── */}
        <div className="game-card" style={{ marginTop: 24 }}>
          <div className="game-card__thumb">
            <span style={{ position: 'relative', zIndex: 1 }}>🗺️</span>
          </div>
          <div className="game-card__body">
            <span className="game-card__tag">RPG · Mapa</span>
            <h2 className="game-card__title">Logic Ascension</h2>
            <p className="game-card__desc">
              A Ascensão Lógica. Navegue por uma grade 2D, escolha entre o Caminho do Buff
              ou o Caminho do Sacrifício, e enfrente monstros cujo nível é gerado dinamicamente
              pelo Math Engine com base no seu poder atual. Aprenda Ordem das Operações em combate.
            </p>
            <div className="game-card__footer">
              <span className="game-card__badge">🧮 Ordem das operações</span>
              <span className="game-card__badge">🌫️ Névoa de guerra</span>
              <Link to="/jogos/logic-ascension" className="btn-primary">
                ▶ Jogar agora
              </Link>
            </div>
          </div>
        </div>

        {/* ── Coming Soon ── */}
        <div
          style={{
            marginTop: 40,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {['Quiz de Frações', 'Geometria Espacial', 'Álgebra RPG'].map((name) => (
            <div key={name} className="coming-soon-card">
              <span className="coming-soon-card__icon">🔒</span>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-muted)' }}>
                {name}
              </p>
              <span className="coming-soon-card__label">Em breve</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
