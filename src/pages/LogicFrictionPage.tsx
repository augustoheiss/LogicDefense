// ============================================================
// LOGIC FRICTION — Landing Page (PT-BR)
// Sci-fi 3D arena aesthetic
// ============================================================
import LogicFriction from '../games/LogicFriction/LogicFriction'

const PAGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@300;400;500;600&display=swap');

  @keyframes lf-glow-pulse {
    0%, 100% { opacity: 0.6; text-shadow: 0 0 30px rgba(0,255,136,0.5), 0 0 60px rgba(0,255,136,0.15); }
    50%       { opacity: 1;    text-shadow: 0 0 50px rgba(0,255,136,0.9), 0 0 100px rgba(0,255,136,0.3), 0 0 150px rgba(0,212,255,0.2); }
  }
  @keyframes lf-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes lf-scroll-hint {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
    50%       { transform: translateY(6px) scale(1.05); opacity: 1; }
  }
  @keyframes lf-ember {
    0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 0.5; }
    100% { transform: translateY(-120vh) translateX(var(--dx, 20px)) rotate(720deg); opacity: 0; }
  }
  @keyframes lf-section-enter {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lf-border-glow {
    0%, 100% { box-shadow: 0 0 12px rgba(0,255,136,0.12), inset 0 0 12px rgba(0,255,136,0.03); }
    50%      { box-shadow: 0 0 28px rgba(0,255,136,0.3),  inset 0 0 20px rgba(0,255,136,0.06); }
  }
  @keyframes lf-cta-pulse {
    0%, 100% { box-shadow: 0 0 20px rgba(0,255,136,0.4), 0 0 40px rgba(0,212,255,0.15); }
    50%      { box-shadow: 0 0 40px rgba(0,255,136,0.7), 0 0 80px rgba(0,212,255,0.3); }
  }

  .lf-page {
    font-family: 'Inter', 'Courier New', sans-serif;
    background: #04040e;
    color: #e2e8f0;
    scroll-behavior: smooth;
    overflow-x: hidden;
  }

  /* Ember particles */
  .lf-ember {
    position: fixed;
    bottom: -10px;
    width: 3px; height: 3px;
    border-radius: 50%;
    background: rgba(0,255,136,0.6);
    pointer-events: none;
    animation: lf-ember 9s linear infinite;
    z-index: 0;
  }

  /* Gradient text */
  .lf-gradient-green {
    background: linear-gradient(135deg, #00ff88 0%, #00d4ff 50%, #a855f7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Hero ── */
  .lf-hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(0,255,136,0.06) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.05) 0%, transparent 55%),
      radial-gradient(ellipse at 50% 90%, rgba(168,85,247,0.04) 0%, transparent 50%),
      #04040e;
    padding: 40px 20px 0;
    overflow: hidden;
  }
  .lf-hero::before {
    content: '';
    position: absolute; inset: 0;
    background-image:
      repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(0,255,136,0.012) 60px, rgba(0,255,136,0.012) 61px),
      repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(0,212,255,0.012) 60px, rgba(0,212,255,0.012) 61px);
    pointer-events: none;
  }
  .lf-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 18px; border-radius: 100px;
    font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
    background: rgba(0,255,136,0.08); border: 1px solid rgba(0,255,136,0.3); color: #00ff88;
  }
  .lf-hero-title {
    font-family: 'Orbitron', 'Courier New', monospace;
    font-size: clamp(22px, 5vw, 46px);
    font-weight: 900; text-align: center;
    margin: 20px 0 16px; line-height: 1.25;
    letter-spacing: 0.03em; color: #f1f5f9;
    max-width: 820px;
    animation: lf-glow-pulse 4s ease infinite;
  }
  .lf-hero-sub {
    font-size: clamp(14px, 2vw, 17px); line-height: 1.75;
    text-align: center; color: #94a3b8;
    max-width: 680px; margin: 0 auto 32px;
  }
  .lf-game-wrapper {
    width: 100%; max-width: 1100px;
    min-height: 70vh;
    border-radius: 12px; overflow: hidden;
    border: 1px solid rgba(0,255,136,0.12);
    box-shadow: 0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(0,255,136,0.05);
  }
  .lf-scroll-hint {
    margin: 24px 0 32px; font-size: 13px; color: #475569;
    letter-spacing: 0.12em; text-align: center;
    animation: lf-scroll-hint 2s ease infinite;
  }

  /* ── Sections ── */
  .lf-section {
    position: relative; padding: 80px 24px; overflow: hidden;
  }
  .lf-section--features {
    background:
      radial-gradient(ellipse at 30% 50%, rgba(0,255,136,0.04) 0%, transparent 50%),
      #04040e;
    border-top: 1px solid rgba(0,255,136,0.08);
  }
  .lf-section-inner {
    max-width: 1100px; margin: 0 auto;
    animation: lf-section-enter 0.7s ease both;
  }
  .lf-section-header { text-align: center; margin-bottom: 56px; }
  .lf-section-eyebrow {
    display: inline-block; font-size: 10px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase;
    padding: 5px 16px; border-radius: 100px; margin-bottom: 16px;
    background: rgba(0,255,136,0.10); color: #00ff88;
    border: 1px solid rgba(0,255,136,0.3);
  }
  .lf-section-title {
    font-family: 'Orbitron', 'Courier New', monospace;
    font-size: clamp(20px, 3.5vw, 34px);
    font-weight: 900; margin: 0 0 16px; color: #f1f5f9; line-height: 1.3;
  }
  .lf-section-sub {
    font-size: clamp(14px, 1.8vw, 16px); color: #64748b;
    margin: 0 auto; max-width: 620px; line-height: 1.75;
  }

  /* ── Feature cards ── */
  .lf-features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
  }
  .lf-feature-card {
    background: rgba(4,8,24,0.9);
    border: 1px solid rgba(0,255,136,0.2);
    border-radius: 14px;
    padding: 28px 24px;
    transition: transform 0.25s, box-shadow 0.25s;
    position: relative; overflow: hidden;
    animation: lf-border-glow 3s ease infinite;
  }
  .lf-feature-card::before {
    content: '';
    position: absolute; top: 0; left: 0;
    width: 100%; height: 2px;
    background: linear-gradient(90deg, transparent, var(--card-accent, #00ff88), transparent);
  }
  .lf-feature-card:hover { transform: translateY(-4px); }
  .lf-feature-icon { font-size: 34px; margin-bottom: 14px; display: block; animation: lf-float 3.5s ease infinite; }
  .lf-feature-title {
    font-size: 17px; font-weight: 700; margin: 0 0 10px;
    font-family: 'Orbitron', monospace; color: var(--card-accent, #00ff88);
  }
  .lf-feature-desc { font-size: 14px; color: #64748b; line-height: 1.75; margin: 0; }

  .lf-rune-divider {
    text-align: center; margin: 48px 0; color: #1e293b;
    font-size: 22px; letter-spacing: 8px;
  }

  /* ── Footer ── */
  .lf-footer {
    padding: 40px 24px; border-top: 1px solid rgba(255,255,255,0.06);
    text-align: center; background: #02020a;
  }
  .lf-footer-text { margin: 0; font-size: 12px; color: #334155; letter-spacing: 0.08em; }
`

// ── Ember particles ─────────────────────────────────────────────────────────────
function EmberParticles() {
  const embers = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    left: `${5 + (i * 9.5) % 90}%`,
    delay: `${(i * 0.8) % 9}s`,
    dur: `${7 + (i * 1.2) % 5}s`,
    dx: `${-25 + (i * 13) % 50}px`,
    size: `${2 + (i % 3)}px`,
    color: i % 3 === 0
      ? 'rgba(0,255,136,0.55)'
      : i % 3 === 1
        ? 'rgba(0,212,255,0.5)'
        : 'rgba(168,85,247,0.45)',
  }))
  return (
    <>
      {embers.map(e => (
        <div
          key={e.id}
          className="lf-ember"
          style={{
            left: e.left, width: e.size, height: e.size,
            background: e.color,
            animationDelay: e.delay, animationDuration: e.dur,
            ['--dx' as string]: e.dx,
          }}
        />
      ))}
    </>
  )
}

// ── Feature card ────────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, accent }: {
  icon: string; title: string; desc: string; accent: string
}) {
  return (
    <div className="lf-feature-card" style={{ '--card-accent': accent } as React.CSSProperties}>
      <span className="lf-feature-icon">{icon}</span>
      <h3 className="lf-feature-title">{title}</h3>
      <p className="lf-feature-desc">{desc}</p>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export function LogicFrictionPage() {
  return (
    <div className="lf-page" id="lf-page-top">
      <style>{PAGE_STYLES}</style>
      <EmberParticles />

      {/* ═══ HERO ═══ */}
      <section className="lf-hero" id="lf-hero">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <span className="lf-badge">🔬 HEISS-LAB · 3D ARPG EDUCACIONAL</span>
        </div>

        <h1 className="lf-hero-title">
          Logic Friction:{' '}
          <span className="lf-gradient-green">
            Onde Combate 3D, Torres e Matemática Colidem.
          </span>
        </h1>

        <p className="lf-hero-sub">
          Explore uma arena aberta 3D. Construa torres <strong>fisicamente</strong> — ande até o
          canteiro e transfira seus recursos. Resolva equações <strong>dentro do mundo</strong> pisando
          na alternativa correta. Acerte e receba um buff divino. Erre e sobreviva na base.
        </p>

        {/* ── EMBEDDED GAME ── */}
        <div className="lf-game-wrapper" id="lf-game-anchor">
          <LogicFriction />
        </div>

        <p className="lf-scroll-hint">Role para conhecer as mecânicas ↓</p>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="lf-section lf-section--features" id="lf-features">
        <div className="lf-section-inner">
          <div className="lf-section-header">
            <div className="lf-section-eyebrow">⚙️ MECÂNICAS CORE</div>
            <h2 className="lf-section-title">
              Cinco Sistemas.{' '}
              <span className="lf-gradient-green">Um Campo de Batalha.</span>
            </h2>
            <p className="lf-section-sub">
              Cada mecânica transforma um conceito matemático em uma decisão visceral no campo de batalha.
            </p>
          </div>

          <div className="lf-features-grid">
            <FeatureCard
              icon="🏟️"
              title="Arena Aberta 3D"
              accent="#00ff88"
              desc="Uma arena circular com física Rapier real. Movimentação livre WASD. Inimigos surgem das bordas em ondas infinitas que escalam para sempre."
            />
            <FeatureCard
              icon="⚔️"
              title="Combate ARPG"
              accent="#ff5555"
              desc="Ataque inimigos diretamente no corpo-a-corpo. Cada kill gera recursos. Sobreviva enquanto planeja sua defesa — não existe pausa."
            />
            <FeatureCard
              icon="🏗️"
              title="Construção Física"
              accent="#ffd700"
              desc="Selecione um blueprint, clique no chão para criar um Canteiro. Ande até ele fisicamente para transferir ouro e construir a torre. Nada de menus mágicos."
            />
            <FeatureCard
              icon="🧮"
              title="Matemática no Mundo"
              accent="#00d4ff"
              desc="A cada onda, uma equação aparece em 3D no centro da arena com plataformas de resposta. Pise na correta. Aritmética básica alterna com PEMDAS e frações numa espiral infinita."
            />
            <FeatureCard
              icon="⚡"
              title="O Buff Divino"
              accent="#a855f7"
              desc="Acertou? +100% dano, +100% velocidade de ataque, e todas as torres ganham AoE por uma rodada inteira. O poder da resposta certa é sentido fisicamente no combate."
            />
            <FeatureCard
              icon="📖"
              title="Feedback In-World"
              accent="#ec4899"
              desc="A explicação da questão (certa ou errada) aparece no espaço 3D — passo a passo, sem popups. Aprendizado integrado ao ambiente, sem quebrar a imersão."
            />
          </div>

          <div className="lf-rune-divider">◆ · · · ◆ · · · ◆</div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lf-footer">
        <p className="lf-footer-text">
          © {new Date().getFullYear()} Heiss-Lab · Logic Friction · Protótipo EdTech 3D
        </p>
      </footer>
    </div>
  )
}
