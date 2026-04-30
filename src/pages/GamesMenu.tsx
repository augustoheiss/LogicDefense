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

        {/* ── Logic Invaders card ── */}
        <div className="game-card" style={{ marginTop: 24 }}>
          <div className="game-card__thumb" style={{ background: 'linear-gradient(135deg, #070714 0%, #12082a 100%)' }}>
            <span style={{ position: 'relative', zIndex: 1 }}>👾</span>
          </div>
          <div className="game-card__body">
            <span className="game-card__tag" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}>Arcade Shooter</span>
            <h2 className="game-card__title">Logic Invaders</h2>
            <p className="game-card__desc">
              Retro-arcade meets EdTech. Alien ships descend carrying Math equations — your ammunition
              is NUMBERS. Shoot the correct answer to destroy them. Shoot wrong? They absorb it and
              get FASTER. No Game Overs — only Elastic Feedback.
            </p>
            <div className="game-card__footer">
              <span className="game-card__badge">🚀 Cálculo mental reflexivo</span>
              <span className="game-card__badge">🔄 Elastic Feedback</span>
              <Link to="/jogos/logic-invaders" className="btn-primary">
                ▶ Jogar agora
              </Link>
            </div>
          </div>
        </div>

        {/* ── Logic Friction card ── */}
        <div className="game-card" style={{ marginTop: 24 }}>
          <div className="game-card__thumb" style={{ background: 'linear-gradient(135deg, #020a06 0%, #041a0d 50%, #0a1a2e 100%)' }}>
            <span style={{ position: 'relative', zIndex: 1 }}>🏟️</span>
          </div>
          <div className="game-card__body">
            <span className="game-card__tag" style={{ background: 'rgba(0,255,136,0.10)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }}>3D ARPG · Tower Defense</span>
            <h2 className="game-card__title">Logic Friction</h2>
            <p className="game-card__desc">
              Arena 3D com física real. Movimentação livre WASD, combate corpo-a-corpo, construção
              física de torres e equações renderizadas no mundo 3D. Acerte a resposta e receba
              um buff divino. Aritmética e PEMDAS em espiral infinita.
            </p>
            <div className="game-card__footer">
              <span className="game-card__badge">🎮 3D WebGL</span>
              <span className="game-card__badge">🧮 PEMDAS + Aritmética</span>
              <Link to="/jogos/logic-friction" className="btn-primary">
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
          {['Quiz de Frações', 'Geometria Espacial'].map((name) => (
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
