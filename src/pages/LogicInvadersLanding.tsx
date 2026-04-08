// ============================================================
// LOGIC INVADERS — Landing Page (BAB Framework) — PT-BR
// Before-After-Bridge + Jogo embarcado ao vivo
// ============================================================
import { LogicInvadersGame } from '../games/LogicInvaders/components/LogicInvadersGame';
import '../games/LogicInvaders/logic-invaders.css';

// ── Ícones SVG inline ────────────────────────────────────────
function IconRocket() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1-1.5 2.5 0 3.5 1 .5 2.5.5 3.5 0l6.5-6.5-3.5-3.5z"/>
      <path d="M8 10c-1-2.5-.5-7 4.5-10 .5 2.5 1.5 5 4 7"/>
      <path d="M12 14c2 1 5 1.5 7 0 0-4-3-8-7-9"/>
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  );
}
function IconBrain() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
      <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
      <path d="M6 18a4 4 0 0 1-1.967-.516"/>
      <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
    </svg>
  );
}
function IconZap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  );
}


// ── Cartão de Dor ─────────────────────────────────────────────
interface PainCardProps {
  icon: string;
  title: string;
  desc: string;
  index: number;
}
function PainCard({ icon, title, desc, index }: PainCardProps) {
  return (
    <div className="li-pain-card" style={{ animationDelay: `${index * 0.12}s` }}>
      <div className="li-pain-icon">{icon}</div>
      <h3 className="li-pain-title">{title}</h3>
      <p className="li-pain-desc">{desc}</p>
    </div>
  );
}

// ── Cartão de Feature ─────────────────────────────────────────
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accentClass: string;
}
function FeatureCard({ icon, title, desc, accentClass }: FeatureCardProps) {
  return (
    <div className={`li-feature-card ${accentClass}`}>
      <div className="li-feature-icon">{icon}</div>
      <h3 className="li-feature-title">{title}</h3>
      <p className="li-feature-desc">{desc}</p>
    </div>
  );
}

// ── Cartão de Resultado (After) ───────────────────────────────
interface OutcomeCardProps {
  emoji: string;
  title: string;
  desc: string;
  highlight?: string;
}
function OutcomeCard({ emoji, title, desc, highlight }: OutcomeCardProps) {
  return (
    <div className="li-outcome-card">
      <span className="li-outcome-emoji">{emoji}</span>
      <h3 className="li-outcome-title">{title}</h3>
      <p className="li-outcome-desc">
        {desc}
        {highlight && <strong className="li-outcome-highlight"> {highlight}</strong>}
      </p>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────
export function LogicInvadersLanding() {
  return (
    <div className="li-page">

      {/* ═══════════════════════════════════════
          SEÇÃO 1: HERO — Acima da Dobra
      ═══════════════════════════════════════ */}
      <section className="li-hero" id="li-hero">
        <div className="li-hero-eyebrow">
          <span className="li-badge li-badge--cyan">
            <IconZap /> HEISS-LAB · PROTÓTIPO EDTECH
          </span>
        </div>

        <h1 className="li-hero-title">
          Transforme a Ansiedade de Matemática em{' '}
          <span className="li-gradient-text">Reflexos de Arcade.</span>
        </h1>

        <p className="li-hero-sub">
          Para alunos que odeiam provas-surpresa mas amam games. Jogue o protótipo de{' '}
          <strong>Logic Invaders</strong> abaixo e experimente como o{' '}
          <em>Feedback Elástico</em> transforma o cálculo mental em um estado de fluxo imparável.
        </p>

        {/* ── O JOGO ── */}
        <div className="li-game-wrapper">
          <LogicInvadersGame />
        </div>

      </section>

      {/* ═══════════════════════════════════════
          SEÇÃO 2: ANTES — Os Problemas Reais
      ═══════════════════════════════════════ */}
      <section className="li-section li-section--before" id="li-before">
        <div className="li-section-inner">
          <div className="li-section-header">
            <div className="li-section-eyebrow li-eyebrow--red">O PROBLEMA</div>
            <h2 className="li-section-title">Quando Jogos Educativos Destroem a Diversão</h2>
            <p className="li-section-sub">
              A maioria dos "edu-games" usa a diversão apenas como embalagem de um teste. O resultado? Os alunos odeiam os dois.
            </p>
          </div>

          <div className="li-pain-grid">
            <PainCard
              index={0}
              icon="💥"
              title="O Quebrador de Fluxo"
              desc="O que mais machuca é quando você está se divertindo e, de repente, o jogo pausa para perguntar 'Quanto é 4 × 4?'. Isso destrói completamente o loop de dopamina do gaming."
            />
            <PainCard
              index={1}
              icon="❌"
              title="Punir Erros Gera Ansiedade"
              desc="Em jogos educativos tradicionais, a resposta errada traz um grande X vermelho ou um 'Game Over'. O aluno se sente punido por tentar, causando desengajamento imediato e ansiedade matemática."
            />
            <PainCard
              index={2}
              icon="😴"
              title="A Armadilha do Tédio"
              desc="Mecânicas simplificadas, ritmo lento, sem tensão real. Os alunos comparam edu-games com jogos de verdade — e os edu-games perdem sempre."
            />
          </div>

          <div className="li-belief-bust">
            <div className="li-belief-icon">🔍</div>
            <div>
              <h3 className="li-belief-title">Desconstruindo a Crença</h3>
              <p className="li-belief-desc">
                Muitos desenvolvedores acreditam que é preciso <em>pausar a ação</em> para ensinar matemática,
                ou que jogos educativos simplesmente <em>não conseguem competir com títulos AAA</em>. Ambas as
                suposições deixam os alunos entediados e desmotivados — e as duas estão <strong>erradas</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SEÇÃO 3: DEPOIS — O Resultado Desejado
      ═══════════════════════════════════════ */}
      <section className="li-section li-section--after" id="li-after">
        <div className="li-section-inner">
          <div className="li-section-header">
            <div className="li-section-eyebrow li-eyebrow--cyan">A VISÃO</div>
            <h2 className="li-section-title">Imagine a Matemática Virando Instinto Puro</h2>
            <p className="li-section-sub">
              E se um aluno resolvesse 30 problemas de multiplicação em uma sessão — sem nem perceber?
            </p>
          </div>

          <div className="li-outcome-grid">
            <OutcomeCard
              emoji="⚡"
              title="Ação Contínua"
              desc="Seus alunos fazem cálculo mental rápido não porque há uma prova, mas porque uma nave alienígena neon está descendo e eles precisam do número '56' agora"
              highlight="MESMO para sobreviver."
            />
            <OutcomeCard
              emoji="🔄"
              title="Feedback Elástico"
              desc="Em vez de punir erros, usamos o Feedback Elástico. Atirou a resposta errada? O alien absorve e fica mais rápido. A tensão aumenta, o gameplay continua, e o aluno permanece engajado."
            />
            <OutcomeCard
              emoji="🧠"
              title="Novo Paradigma"
              desc="E se a matemática não fosse o obstáculo, mas a munição? Isso não é gamificação de testes. É aprendizado completamente embarcado dentro do Estado de Fluxo."
            />
          </div>

          {/* Diagrama de fluxo */}
          <div className="li-flow-diagram">
            <div className="li-flow-step li-flow-step--cyan">
              <span className="li-flow-num">01</span>
              <span>Equação aparece na tela</span>
            </div>
            <div className="li-flow-arrow">→</div>
            <div className="li-flow-step li-flow-step--magenta">
              <span className="li-flow-num">02</span>
              <span>Reflexo dispara. Resposta selecionada.</span>
            </div>
            <div className="li-flow-arrow">→</div>
            <div className="li-flow-step li-flow-step--green">
              <span className="li-flow-num">03</span>
              <span>Correto → Explosão + Laser Mode!</span>
            </div>
            <div className="li-flow-arrow">→</div>
            <div className="li-flow-step li-flow-step--orange">
              <span className="li-flow-num">04</span>
              <span>Errado → Mais rápido, tente de novo</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SEÇÃO 4: PONTE — O Produto
      ═══════════════════════════════════════ */}
      <section className="li-section li-section--product" id="li-product">
        <div className="li-section-inner">
          <div className="li-section-header">
            <div className="li-section-eyebrow li-eyebrow--magenta">A SOLUÇÃO</div>
            <h2 className="li-section-title">
              Apresentando Logic Invaders:{' '}
              <span className="li-gradient-text">O Motor Heiss-Lab</span>
            </h2>
            <p className="li-section-sub">
              Um shooter arcade completo onde a matemática é a mecânica — não a interrupção.
            </p>
          </div>

          <div className="li-features-grid">
            <FeatureCard
              accentClass="li-feature-card--cyan"
              icon={<IconRocket />}
              title="Ação Ininterrupta"
              desc="Zero provas-surpresa. O jogo nunca pausa. Os problemas matemáticos existem dentro do loop de gameplay — resolvê-los É a ação."
            />
            <FeatureCard
              accentClass="li-feature-card--magenta"
              icon={<IconRefresh />}
              title="Matar-Math + Modo Laser"
              desc="Clique na bolha certa para destruir o alien instantaneamente. Como recompensa, você recebe 5 segundos de Modo Laser — um raio que perfura tudo. Risco e recompensa em tempo real."
            />
            <FeatureCard
              accentClass="li-feature-card--green"
              icon={<IconBrain />}
              title="Matemática Reflexiva"
              desc="Repetição por urgência genuína. Os alunos internalizam as tabuadas por instinto de sobrevivência, não por memorização mecânica."
            />
          </div>

          <div className="li-tech-badges">
            <div className="li-tech-badge">🎮 Web · Sem instalação</div>
            <div className="li-tech-badge">📊 Dificuldade por ondas</div>
            <div className="li-tech-badge">🧮 Adição · Subtração · Multiplicação · Divisão</div>
            <div className="li-tech-badge">📱 Controles mobile-friendly</div>
            <div className="li-tech-badge">⚡ Sistema de Combate Híbrido</div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="li-footer" id="li-footer">
        <p className="li-footer-text">
          © {new Date().getFullYear()} Heiss-Lab · Protótipo Edtech · Todos os direitos reservados
        </p>
      </footer>

    </div>
  );
}
