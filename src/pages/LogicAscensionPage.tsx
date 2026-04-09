// ============================================================
// LOGIC ASCENSION — Landing Page (BAB Framework) — PT-BR
// Before-After-Bridge + Jogo embarcado ao vivo
// Dark mystical dungeon-crawler aesthetic (Tailwind v4)
// ============================================================
import { LogicAscension } from '../games/LogicAscension/LogicAscension';

// ── Inline styles for animations not expressible in pure Tailwind ────────────
const PAGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@300;400;500;600&display=swap');

  @keyframes la-glow-pulse {
    0%, 100% { opacity: 0.55; text-shadow: 0 0 30px rgba(0,212,255,0.6), 0 0 60px rgba(0,212,255,0.2); }
    50%       { opacity: 1;    text-shadow: 0 0 50px rgba(0,212,255,1),   0 0 100px rgba(0,212,255,0.4), 0 0 150px rgba(168,85,247,0.3); }
  }
  @keyframes la-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }
  @keyframes la-scroll-hint {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
    50%       { transform: translateY(6px) scale(1.05); opacity: 1; }
  }
  @keyframes la-ember {
    0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 0.6; }
    100% { transform: translateY(-120vh) translateX(var(--dx, 20px)) rotate(720deg); opacity: 0; }
  }
  @keyframes la-section-enter {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes la-card-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes la-border-glow {
    0%, 100% { box-shadow: 0 0 12px rgba(0,212,255,0.15), inset 0 0 12px rgba(0,212,255,0.04); }
    50%       { box-shadow: 0 0 30px rgba(0,212,255,0.35), inset 0 0 20px rgba(0,212,255,0.08); }
  }
  @keyframes la-spike-pulse {
    0%, 100% { box-shadow: 0 0 12px rgba(236,72,153,0.35); border-color: rgba(236,72,153,0.4); }
    50%       { box-shadow: 0 0 30px rgba(236,72,153,0.7),  border-color: rgba(236,72,153,0.9); }
  }
  @keyframes la-second-wind-flash {
    0%, 100% { background: rgba(255,136,68,0.08); border-color: rgba(255,136,68,0.35); }
    50%       { background: rgba(255,136,68,0.22); border-color: rgba(255,136,68,0.8); }
  }
  @keyframes la-cta-pulse {
    0%, 100% { box-shadow: 0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(0,212,255,0.2); }
    50%       { box-shadow: 0 0 40px rgba(168,85,247,0.8), 0 0 80px rgba(0,212,255,0.4); }
  }

  .la-page {
    font-family: 'Inter', 'Courier New', sans-serif;
    background: #04040e;
    color: #e2e8f0;
    scroll-behavior: smooth;
    overflow-x: hidden;
  }

  /* Ember particles */
  .la-ember {
    position: fixed;
    bottom: -10px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(0,212,255,0.7);
    pointer-events: none;
    animation: la-ember 8s linear infinite;
    z-index: 0;
  }

  /* Gradient text */
  .la-gradient-cyan {
    background: linear-gradient(135deg, #00d4ff 0%, #a855f7 50%, #ec4899 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .la-gradient-gold {
    background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Hero ── */
  .la-hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(168,85,247,0.08) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.07) 0%, transparent 55%),
      radial-gradient(ellipse at 50% 90%, rgba(236,72,153,0.05) 0%, transparent 50%),
      #04040e;
    padding: 40px 20px 0;
    overflow: hidden;
  }
  .la-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(0,212,255,0.015) 60px, rgba(0,212,255,0.015) 61px),
      repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(168,85,247,0.015) 60px, rgba(168,85,247,0.015) 61px);
    pointer-events: none;
  }
  .la-hero-eyebrow {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }
  .la-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 18px;
    border-radius: 100px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    border: 1px solid;
  }
  .la-badge--cyan {
    background: rgba(0,212,255,0.08);
    border-color: rgba(0,212,255,0.3);
    color: #00d4ff;
  }
  .la-hero-title {
    font-family: 'Cinzel', 'Courier New', serif;
    font-size: clamp(22px, 5vw, 48px);
    font-weight: 900;
    text-align: center;
    margin: 0 0 16px;
    line-height: 1.2;
    letter-spacing: 0.02em;
    color: #f1f5f9;
    max-width: 820px;
    animation: la-glow-pulse 4s ease infinite;
  }
  .la-hero-sub {
    font-size: clamp(14px, 2vw, 18px);
    line-height: 1.7;
    text-align: center;
    color: #94a3b8;
    max-width: 680px;
    margin: 0 auto 32px;
  }
  .la-game-wrapper {
    width: 100%;
    max-width: 1100px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(0,212,255,0.12);
    box-shadow: 0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(0,212,255,0.06);
  }
  .la-scroll-hint {
    margin: 24px 0 32px;
    font-size: 13px;
    color: #475569;
    letter-spacing: 0.12em;
    text-align: center;
    animation: la-scroll-hint 2s ease infinite;
  }

  /* ── Sections ── */
  .la-section {
    position: relative;
    padding: 80px 24px;
    overflow: hidden;
  }
  .la-section--before {
    background:
      radial-gradient(ellipse at 50% 0%, rgba(255,34,34,0.06) 0%, transparent 60%),
      #04040e;
    border-top: 1px solid rgba(255,34,34,0.08);
  }
  .la-section--after {
    background:
      radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.07) 0%, transparent 55%),
      #04040e;
    border-top: 1px solid rgba(168,85,247,0.1);
  }
  .la-section--features {
    background:
      radial-gradient(ellipse at 30% 50%, rgba(0,212,255,0.05) 0%, transparent 50%),
      #04040e;
    border-top: 1px solid rgba(0,212,255,0.08);
  }
  .la-section--cta {
    background:
      radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.12) 0%, transparent 70%),
      #04040e;
    border-top: 1px solid rgba(168,85,247,0.12);
  }
  .la-section-inner {
    max-width: 1100px;
    margin: 0 auto;
    animation: la-section-enter 0.7s ease both;
  }
  .la-section-header {
    text-align: center;
    margin-bottom: 56px;
  }
  .la-section-eyebrow {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    padding: 5px 16px;
    border-radius: 100px;
    margin-bottom: 16px;
  }
  .la-eyebrow--red   { background: rgba(255,34,34,0.12); color: #ff6666; border: 1px solid rgba(255,34,34,0.3); }
  .la-eyebrow--cyan  { background: rgba(0,212,255,0.10); color: #00d4ff; border: 1px solid rgba(0,212,255,0.3); }
  .la-eyebrow--gold  { background: rgba(255,215,0,0.10); color: #ffd700; border: 1px solid rgba(255,215,0,0.3); }
  .la-eyebrow--magenta { background: rgba(236,72,153,0.10); color: #ec4899; border: 1px solid rgba(236,72,153,0.3); }

  .la-section-title {
    font-family: 'Cinzel', 'Courier New', serif;
    font-size: clamp(22px, 4vw, 38px);
    font-weight: 900;
    margin: 0 0 16px;
    color: #f1f5f9;
    line-height: 1.25;
  }
  .la-section-sub {
    font-size: clamp(14px, 1.8vw, 17px);
    color: #64748b;
    margin: 0 auto;
    max-width: 620px;
    line-height: 1.75;
  }

  /* ── Pain cards ── */
  .la-pain-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }
  .la-pain-card {
    background: rgba(10,4,4,0.85);
    border: 1px solid rgba(255,34,34,0.2);
    border-radius: 12px;
    padding: 26px 24px;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .la-pain-card:hover {
    border-color: rgba(255,34,34,0.5);
    box-shadow: 0 0 24px rgba(255,34,34,0.12);
  }
  .la-pain-icon { font-size: 36px; margin-bottom: 14px; }
  .la-pain-title { font-size: 17px; font-weight: 700; color: #ff8888; margin: 0 0 10px; font-family: 'Cinzel', serif; }
  .la-pain-desc  { font-size: 14px; color: #64748b; line-height: 1.75; margin: 0; }

  /* ── Feature cards (glowing neon grid) ── */
  .la-features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
  }
  .la-feature-card {
    background: rgba(4,8,24,0.9);
    border: 1px solid;
    border-radius: 14px;
    padding: 28px 24px;
    transition: transform 0.25s, box-shadow 0.25s;
    position: relative;
    overflow: hidden;
  }
  .la-feature-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 2px;
  }
  .la-feature-card:hover { transform: translateY(-4px); }
  .la-feature-card--cyan  { border-color: rgba(0,212,255,0.25); animation: la-border-glow 3s ease infinite; }
  .la-feature-card--cyan::before  { background: linear-gradient(90deg, transparent, #00d4ff, transparent); }
  .la-feature-card--magenta { border-color: rgba(236,72,153,0.25); animation: la-spike-pulse 3s ease infinite; }
  .la-feature-card--magenta::before { background: linear-gradient(90deg, transparent, #ec4899, transparent); }
  .la-feature-card--gold   { border-color: rgba(255,215,0,0.25); }
  .la-feature-card--gold::before   { background: linear-gradient(90deg, transparent, #ffd700, transparent); }
  .la-feature-card--red    { border-color: rgba(255,87,87,0.25); animation: la-second-wind-flash 2s ease infinite; }
  .la-feature-card--red::before    { background: linear-gradient(90deg, transparent, #ff5757, transparent); }

  .la-feature-icon  { font-size: 34px; margin-bottom: 14px; display: block; animation: la-float 3.5s ease infinite; }
  .la-feature-title { font-size: 18px; font-weight: 700; margin: 0 0 10px; font-family: 'Cinzel', serif; }
  .la-feature-title--cyan    { color: #00d4ff; }
  .la-feature-title--magenta { color: #ec4899; }
  .la-feature-title--gold    { color: #ffd700; }
  .la-feature-title--red     { color: #ff8888; }
  .la-feature-desc  { font-size: 14px; color: #64748b; line-height: 1.75; margin: 0; }

  /* ── After/outcome cards ── */
  .la-outcome-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }
  .la-outcome-card {
    background: rgba(4,8,24,0.85);
    border: 1px solid rgba(168,85,247,0.2);
    border-radius: 12px;
    padding: 28px 24px;
    text-align: center;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .la-outcome-card:hover {
    border-color: rgba(168,85,247,0.5);
    box-shadow: 0 0 28px rgba(168,85,247,0.12);
  }
  .la-outcome-emoji { font-size: 40px; display: block; margin-bottom: 14px; animation: la-float 4s ease infinite; }
  .la-outcome-title { font-size: 19px; font-weight: 700; color: #a855f7; margin: 0 0 10px; font-family: 'Cinzel', serif; }
  .la-outcome-desc  { font-size: 14px; color: #64748b; line-height: 1.75; margin: 0; }

  /* ── CTA ── */
  .la-cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 18px 44px;
    border-radius: 100px;
    background: linear-gradient(135deg, #a855f7 0%, #00d4ff 100%);
    color: #fff;
    font-size: 18px;
    font-weight: 800;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.05em;
    border: none;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    animation: la-cta-pulse 2s ease infinite;
    text-decoration: none;
  }
  .la-cta-btn:hover {
    transform: scale(1.05) translateY(-2px);
    box-shadow: 0 12px 40px rgba(168,85,247,0.5), 0 0 80px rgba(0,212,255,0.3);
  }

  /* ── Footer ── */
  .la-footer {
    padding: 40px 24px;
    border-top: 1px solid rgba(255,255,255,0.06);
    text-align: center;
    background: #02020a;
  }
  .la-footer-text { margin: 0; font-size: 12px; color: #334155; letter-spacing: 0.08em; }
  .la-contact-info { margin: 8px 0 0; font-size: 13px; color: #475569; }
  .la-contact-link { color: #00d4ff; text-decoration: none; transition: color 0.2s; }
  .la-contact-link:hover { color: #a855f7; }

  /* ── Divider rune ── */
  .la-rune-divider {
    text-align: center;
    margin: 48px 0;
    color: #1e293b;
    font-size: 22px;
    letter-spacing: 8px;
  }
`;

// ── Floating ember particles ───────────────────────────────────────────────────
function EmberParticles() {
  const embers = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: `${5 + (i * 8.3) % 90}%`,
    delay: `${(i * 0.7) % 8}s`,
    dur: `${6 + (i * 1.3) % 5}s`,
    dx: `${-30 + (i * 11) % 60}px`,
    size: `${2 + (i % 3)}px`,
    color: i % 3 === 0 ? 'rgba(0,212,255,0.6)' : i % 3 === 1 ? 'rgba(168,85,247,0.6)' : 'rgba(236,72,153,0.5)',
  }));
  return (
    <>
      {embers.map(e => (
        <div
          key={e.id}
          className="la-ember"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            background: e.color,
            animationDelay: e.delay,
            animationDuration: e.dur,
            ['--dx' as string]: e.dx,
          }}
        />
      ))}
    </>
  );
}

// ── Pain card ─────────────────────────────────────────────────────────────────
function PainCard({ icon, title, desc, index }: { icon: string; title: string; desc: string; index: number }) {
  return (
    <div className="la-pain-card" style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="la-pain-icon">{icon}</div>
      <h3 className="la-pain-title">{title}</h3>
      <p className="la-pain-desc">{desc}</p>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({
  icon, title, desc, cardClass, titleClass,
}: {
  icon: string; title: string; desc: string; cardClass: string; titleClass: string;
}) {
  return (
    <div className={`la-feature-card ${cardClass}`}>
      <span className="la-feature-icon">{icon}</span>
      <h3 className={`la-feature-title ${titleClass}`}>{title}</h3>
      <p className="la-feature-desc">{desc}</p>
    </div>
  );
}

// ── Outcome card ──────────────────────────────────────────────────────────────
function OutcomeCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="la-outcome-card">
      <span className="la-outcome-emoji">{emoji}</span>
      <h3 className="la-outcome-title">{title}</h3>
      <p className="la-outcome-desc">{desc}</p>
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export function LogicAscensionPage() {
  return (
    <div className="la-page" id="la-page-top">
      <style>{PAGE_STYLES}</style>
      <EmberParticles />

      {/* ═══════════════════════════════════════════
          SEÇÃO 1: HERO — Acima da Dobra
      ═══════════════════════════════════════════ */}
      <section className="la-hero" id="la-hero">
        <div className="la-hero-eyebrow">
          <span className="la-badge la-badge--cyan">
            ⚔️ HEISS-LAB · ROGUELIKE EDUCACIONAL
          </span>
        </div>

        <h1 className="la-hero-title">
          A Ascensão Lógica:{' '}
          <span className="la-gradient-cyan">
            Onde Frações e Equações se Tornam Magia de Combate.
          </span>
        </h1>

        <p className="la-hero-sub">
          Abandone a decoreba. Use a <strong>Ordem das Operações (PEMDAS)</strong> e os segredos das{' '}
          <strong>Frações</strong> para prever o futuro, absorver monstros e dominar a{' '}
          <em>Masmorra Infinita</em>.
        </p>

        {/* ── O JOGO EMBARCADO ── */}
        <div className="la-game-wrapper" id="la-game-anchor">
          <LogicAscension />
        </div>

        {/* ── Scroll hint ── */}
        <p className="la-scroll-hint">Role para ler o Tomo do Conhecimento ↓</p>
      </section>

      {/* ═══════════════════════════════════════════
          SEÇÃO 2: ANTES — A Dor
      ═══════════════════════════════════════════ */}
      <section className="la-section la-section--before" id="la-before">
        <div className="la-section-inner">
          <div className="la-section-header">
            <div className="la-section-eyebrow la-eyebrow--red">O PROBLEMA</div>
            <h2 className="la-section-title">
              A dor de um único{' '}
              <span style={{ color: '#ff4444' }}>erro</span>
            </h2>
            <p className="la-section-sub">
              Na escola tradicional, a matemática é uma neblina escura. Um pequeno erro de cálculo
              e você é punido com um zero. Você luta às cegas, sentindo que o sistema é injusto e
              punitivo, memorizando regras sem sentido.
            </p>
          </div>

          <div className="la-pain-grid">
            <PainCard
              index={0}
              icon="🌫️"
              title="A Neblina da Decoreba"
              desc="PEMDAS virou uma sigla a ser memorizada, não uma ferramenta de poder. KCF (Keep, Change, Flip) é só uma frase mágica que você repete sem entender o porquê — até cair na prova e travar."
            />
            <PainCard
              index={1}
              icon="❌"
              title="Punição em vez de Aprendizado"
              desc="Errou? Nota zero. Nenhum contexto. Nenhuma segunda chance. O sistema pune o erro como fraqueza, mas o erro é a única forma real de aprender. A ansiedade matemática começa aqui."
            />
            <PainCard
              index={2}
              icon="🎭"
              title="Matemática Sem Propósito"
              desc="'Onde vou usar isso na vida real?' — essa frase existe porque ninguém nunca mostrou que frações e equações podem ser a diferença entre vida e morte em uma masmorra infinita."
            />
          </div>

          <div className="la-rune-divider">⚔ · · · ⚔ · · · ⚔</div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SEÇÃO 3: DEPOIS — O Novo Paradigma
      ═══════════════════════════════════════════ */}
      <section className="la-section la-section--after" id="la-after">
        <div className="la-section-inner">
          <div className="la-section-header">
            <div className="la-section-eyebrow la-eyebrow--cyan">A VISÃO</div>
            <h2 className="la-section-title">
              E se você pudesse{' '}
              <span className="la-gradient-cyan">ver o futuro?</span>
            </h2>
            <p className="la-section-sub">
              E se a matemática não fosse um teste, mas uma <strong>armadura</strong>? No Logic
              Ascension, o Oráculo revela o peso das suas escolhas. Você aprende a manipular frações
              e números negativos não por obrigação, mas para <em>sobreviver</em>.
            </p>
          </div>

          <div className="la-outcome-grid">
            <OutcomeCard
              emoji="🔮"
              title="A Masmorra Viva"
              desc="Cada andar é gerado proceduralmente. O Oráculo calcula em tempo real o custo de cada decisão — você vê o futuro antes de cometê-lo. Estratégia, não sorte."
            />
            <OutcomeCard
              emoji="🛡️"
              title="Matemática como Armadura"
              desc="Dominar frações não é decorar — é equipar uma armadura real. Cada operação correta absorve poder do monstro. Cada erro tem consequências físicas, visíveis, dramáticas."
            />
            <OutcomeCard
              emoji="⚡"
              title="O Estado de Fluxo"
              desc="Você não percebe que está resolvendo 30 questões de PEMDAS por sessão. Está sobrevivendo. Está lutando. O aprendizado acontece porque é necessário — não porque foi mandado."
            />
          </div>

          <div className="la-rune-divider">⚔ · · · ⚔ · · · ⚔</div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SEÇÃO 4: O TOMO DO CONHECIMENTO — Features
      ═══════════════════════════════════════════ */}
      <section className="la-section la-section--features" id="la-features">
        <div className="la-section-inner">
          <div className="la-section-header">
            <div className="la-section-eyebrow la-eyebrow--gold">📖 O TOMO DO CONHECIMENTO</div>
            <h2 className="la-section-title">
              Quatro Mecânicas.{' '}
              <span className="la-gradient-gold">Um Sistema.</span>
            </h2>
            <p className="la-section-sub">
              Cada mecânica foi desenhada para tornar um conceito matemático em uma experiência visceral.
            </p>
          </div>

          <div className="la-features-grid">
            <FeatureCard
              icon="⚡"
              title="O Oráculo"
              desc="Antes de cada sala, o Oráculo revela o futuro: a Ordem Ótima dos monstros, os bônus esperados e o custo de cada caminho. Você escolhe entre o Buff ou o Sacrifício com dados reais na mão — não no escuro."
              cardClass="la-feature-card--cyan"
              titleClass="la-feature-title--cyan"
            />
            <FeatureCard
              icon="💀"
              title="O Preço do Erro — Second Wind"
              desc="Errar um cálculo não é o fim instantâneo. O monstro ataca e corta seu poder pela metade — mas você sobrevive para recalcular. A tela treme, o monstro avança 30px, sua vida pisca em vermelho. O erro ensina, não elimina."
              cardClass="la-feature-card--red"
              titleClass="la-feature-title--red"
            />
            <FeatureCard
              icon="🧠"
              title="Domínio das Frações e PEMDAS"
              desc="Aprenda a 'Geometria da Mente': KCF (Keep-Change-Flip) para dividir frações, Duplo Negativo para resolver radicais, e a hierarquia do PEMDAS sob pressão real de combate — sem decoreba vazia."
              cardClass="la-feature-card--magenta"
              titleClass="la-feature-title--magenta"
            />
            <FeatureCard
              icon="🗺️"
              title="A Masmorra Infinita"
              desc="Cada vitória abre um novo nível — mais difícil, com seu poder carregado. A progressão nunca termina. O Oráculo recalibra os monstros para o seu nível atual. Não existe 'fácil demais': a curva é sempre perfeita."
              cardClass="la-feature-card--gold"
              titleClass="la-feature-title--gold"
            />
          </div>

          <div className="la-rune-divider">⚔ · · · ⚔ · · · ⚔</div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SEÇÃO 5: CTA FINAL
      ═══════════════════════════════════════════ */}
      <section className="la-section la-section--cta" id="la-cta">
        <div className="la-section-inner">
          <div className="la-section-header">
            <div className="la-section-eyebrow la-eyebrow--magenta">⚔️ A MASMORRA AGUARDA</div>
            <h2 className="la-section-title">
              Pronto para transformar{' '}
              <span className="la-gradient-cyan">Matemática em Magia?</span>
            </h2>
            <p className="la-section-sub">
              O jogo está acima. Role até o topo e entre na Masmorra — ou fale com o criador
              para saber mais sobre o projeto Heiss-Lab.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 36, marginBottom: 40 }}>
              <a
                href="#la-game-anchor"
                className="la-cta-btn"
                id="la-enter-dungeon-btn"
                onClick={e => {
                  e.preventDefault();
                  document.getElementById('la-game-anchor')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                ⚔️ Entrar na Masmorra
              </a>
            </div>

            {/* Contact info */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '20px 32px',
              background: 'rgba(168,85,247,0.05)',
              border: '1px solid rgba(168,85,247,0.15)',
              borderRadius: 12,
              maxWidth: 500,
              margin: '0 auto',
            }}>
              <p style={{ margin: 0, fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Heiss-Lab · Contato
              </p>
              <p className="la-contact-info">
                Criador:{' '}
                <a
                  href="https://github.com/augustoheiss"
                  className="la-contact-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @augustoheiss
                </a>
                {' '}·{' '}
                <a
                  href="mailto:augustoheiss@gmail.com"
                  className="la-contact-link"
                >
                  Augusto Heiss
                </a>
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#334155' }}>
                Projeto EdTech · Todos os direitos reservados
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="la-footer" id="la-footer">
        <p className="la-footer-text">
          © {new Date().getFullYear()} Heiss-Lab · Logic Ascension · Prototipo EdTech Roguelike
        </p>
      </footer>
    </div>
  );
}
