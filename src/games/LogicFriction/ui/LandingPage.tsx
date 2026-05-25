// ============================================================
// Logic Friction — Landing Page (BAB Copywriting Framework)
// Full PT-BR localisation · Premium cyber-aesthetic overlay
// Renders inside the game container over the blurred 3D canvas
// ============================================================
import { useState, useRef, useEffect } from 'react'

// ── Props ───────────────────────────────────────────────────────────────────────
interface LandingPageProps {
  onStart: () => void
}

// ── Inline CSS Keyframes & Classes ──────────────────────────────────────────────
const LP_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@300;400;500;600;700&display=swap');

  /* ── Keyframes ── */
  @keyframes lp-glow-pulse {
    0%, 100% { text-shadow: 0 0 30px rgba(0,255,204,0.4), 0 0 60px rgba(0,255,204,0.1); }
    50%      { text-shadow: 0 0 50px rgba(0,255,204,0.8), 0 0 100px rgba(0,255,204,0.25), 0 0 150px rgba(0,212,255,0.15); }
  }
  @keyframes lp-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-6px); }
  }
  @keyframes lp-cta-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(0,255,204,0.35), 0 0 40px rgba(0,212,255,0.12); }
    50%      { box-shadow: 0 0 40px rgba(0,255,204,0.65), 0 0 80px rgba(0,212,255,0.25); }
  }
  @keyframes lp-card-border {
    0%, 100% { box-shadow: 0 0 10px rgba(0,255,204,0.08), inset 0 0 10px rgba(0,255,204,0.02); }
    50%      { box-shadow: 0 0 24px rgba(0,255,204,0.2), inset 0 0 18px rgba(0,255,204,0.04); }
  }
  @keyframes lp-scroll-hint {
    0%, 100% { transform: translateY(0); opacity: 0.45; }
    50%      { transform: translateY(6px); opacity: 1; }
  }
  @keyframes lp-ember {
    0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 0.4; }
    100% { transform: translateY(-130vh) translateX(var(--dx, 20px)) rotate(720deg); opacity: 0; }
  }
  @keyframes lp-step-line-grow {
    from { width: 0; }
    to   { width: 100%; }
  }
  @keyframes lp-fade-in-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lp-gradient-shift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* ── Scrollbar ── */
  .lp-root::-webkit-scrollbar { width: 6px; }
  .lp-root::-webkit-scrollbar-track { background: #050510; }
  .lp-root::-webkit-scrollbar-thumb { background: rgba(0,255,204,0.2); border-radius: 3px; }
  .lp-root::-webkit-scrollbar-thumb:hover { background: rgba(0,255,204,0.4); }

  /* ── Ember particles ── */
  .lp-ember {
    position: fixed;
    bottom: -10px;
    width: 3px; height: 3px;
    border-radius: 50%;
    pointer-events: none;
    animation: lp-ember 9s linear infinite;
    z-index: 0;
  }

  /* ── Gradient text ── */
  .lp-gradient-text {
    background: linear-gradient(135deg, #00ffcc 0%, #00d4ff 50%, #a855f7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .lp-hero-headline { font-size: 22px !important; }
    .lp-hero-sub { font-size: 14px !important; }
    .lp-section-title { font-size: 20px !important; }
    .lp-step-grid { flex-direction: column !important; }
    .lp-step-arrow { transform: rotate(90deg) !important; font-size: 18px !important; }
    .lp-pain-grid, .lp-outcome-grid { grid-template-columns: 1fr !important; }
  }
`

// ── Ember Particles ─────────────────────────────────────────────────────────────
function EmberParticles() {
  const embers = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: `${5 + (i * 8.2) % 90}%`,
    delay: `${(i * 0.7) % 9}s`,
    dur: `${7 + (i * 1.1) % 5}s`,
    dx: `${-30 + (i * 14) % 60}px`,
    size: `${2 + (i % 3)}px`,
    color: i % 3 === 0
      ? 'rgba(0,255,204,0.5)'
      : i % 3 === 1
        ? 'rgba(0,212,255,0.45)'
        : 'rgba(168,85,247,0.4)',
  }))

  return (
    <>
      {embers.map(e => (
        <div
          key={e.id}
          className="lp-ember"
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

// ── Animated Section Wrapper (fade-in-up on scroll) ─────────────────────────────
function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ── Benefit Bullet ──────────────────────────────────────────────────────────────
function BenefitBullet({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '10px 0',
    }}>
      <span style={{
        fontSize: 22, lineHeight: 1,
        animation: 'lp-float 3s ease infinite',
        flexShrink: 0,
      }}>{icon}</span>
      <span style={{
        fontSize: 15, color: '#cbd5e1', lineHeight: 1.7,
        fontFamily: "'Inter', sans-serif",
      }}>{text}</span>
    </div>
  )
}

// ── Pain Card ───────────────────────────────────────────────────────────────────
function PainCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      background: 'rgba(255,68,68,0.04)',
      border: '1px solid rgba(255,68,68,0.15)',
      borderRadius: 14,
      padding: '28px 24px',
      position: 'relative',
      overflow: 'hidden',
      animation: 'lp-card-border 3.5s ease infinite',
      transition: 'transform 0.25s ease',
    }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: 2,
        background: 'linear-gradient(90deg, transparent, #ff4444, transparent)',
      }} />
      <span style={{ fontSize: 32, display: 'block', marginBottom: 14 }}>{icon}</span>
      <h3 style={{
        fontFamily: "'Orbitron', monospace",
        fontSize: 15, fontWeight: 800,
        color: '#ff6b6b', margin: '0 0 10px',
        letterSpacing: '0.03em',
      }}>{title}</h3>
      <p style={{
        fontSize: 14, color: '#64748b', lineHeight: 1.75, margin: 0,
        fontFamily: "'Inter', sans-serif",
      }}>{desc}</p>
    </div>
  )
}

// ── Outcome Card ────────────────────────────────────────────────────────────────
function OutcomeCard({ icon, title, desc, accent }: {
  icon: string; title: string; desc: string; accent: string
}) {
  return (
    <div style={{
      background: `${accent}08`,
      border: `1px solid ${accent}25`,
      borderRadius: 14,
      padding: '28px 24px',
      position: 'relative',
      overflow: 'hidden',
      animation: 'lp-card-border 3.5s ease infinite',
      transition: 'transform 0.25s ease',
    }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
      }} />
      <span style={{ fontSize: 32, display: 'block', marginBottom: 14, animation: 'lp-float 3.5s ease infinite' }}>{icon}</span>
      <h3 style={{
        fontFamily: "'Orbitron', monospace",
        fontSize: 15, fontWeight: 800,
        color: accent, margin: '0 0 10px',
        letterSpacing: '0.03em',
      }}>{title}</h3>
      <p style={{
        fontSize: 14, color: '#94a3b8', lineHeight: 1.75, margin: 0,
        fontFamily: "'Inter', sans-serif",
      }}>{desc}</p>
    </div>
  )
}

// ── Step Card ───────────────────────────────────────────────────────────────────
function StepCard({ number, icon, title, desc, accent }: {
  number: number; icon: string; title: string; desc: string; accent: string
}) {
  return (
    <div style={{
      background: 'rgba(4,8,24,0.9)',
      border: `1px solid ${accent}30`,
      borderRadius: 14,
      padding: '28px 22px',
      textAlign: 'center',
      flex: '1 1 200px',
      maxWidth: 280,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
      }} />
      <div style={{
        fontSize: 11, fontWeight: 800,
        fontFamily: "'Orbitron', monospace",
        color: accent,
        letterSpacing: '0.15em',
        marginBottom: 10,
        opacity: 0.7,
      }}>PASSO {number}</div>
      <span style={{ fontSize: 38, display: 'block', marginBottom: 12, animation: 'lp-float 3s ease infinite' }}>{icon}</span>
      <h3 style={{
        fontFamily: "'Orbitron', monospace",
        fontSize: 16, fontWeight: 800,
        color: accent, margin: '0 0 8px',
      }}>{title}</h3>
      <p style={{
        fontSize: 13, color: '#64748b', lineHeight: 1.7, margin: 0,
        fontFamily: "'Inter', sans-serif",
      }}>{desc}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ██  LANDING PAGE  ██
// ═══════════════════════════════════════════════════════════════════════════════
export function LandingPage({ onStart }: LandingPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Smooth scroll to game anchor
  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      ref={scrollRef}
      className="lp-root"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'rgba(5,5,16,0.92)',
        backdropFilter: 'blur(6px)',
        fontFamily: "'Inter', 'Courier New', sans-serif",
        color: '#e2e8f0',
        pointerEvents: 'auto',
      }}
    >
      <style>{LP_STYLES}</style>
      <EmberParticles />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ██  SECTION 1 — ABOVE THE FOLD (HERO)  ██ */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px 40px',
        background:
          'radial-gradient(ellipse at 20% 40%, rgba(0,255,204,0.06) 0%, transparent 60%),' +
          'radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.04) 0%, transparent 55%),' +
          'radial-gradient(ellipse at 50% 85%, rgba(168,85,247,0.03) 0%, transparent 50%),' +
          'transparent',
      }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(0,255,204,0.01) 60px, rgba(0,255,204,0.01) 61px),' +
            'repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(0,212,255,0.01) 60px, rgba(0,212,255,0.01) 61px)',
        }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 18px', borderRadius: 100,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
          background: 'rgba(0,255,204,0.08)', border: '1px solid rgba(0,255,204,0.3)', color: '#00ffcc',
          marginBottom: 24,
        }}>
          🔬 HEISS-LAB · DEFESA TÁTICA MATEMÁTICA
        </div>

        {/* Headline */}
        <h1
          className="lp-hero-headline"
          style={{
            fontFamily: "'Orbitron', 'Courier New', monospace",
            fontSize: 'clamp(24px, 5vw, 44px)',
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.25,
            letterSpacing: '0.02em',
            color: '#f1f5f9',
            maxWidth: 800,
            margin: '0 0 20px',
            animation: 'lp-glow-pulse 4s ease infinite',
          }}
        >
          Transforme a Matemática de uma Tarefa Chata em uma{' '}
          <span className="lp-gradient-text">Arma Tática.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="lp-hero-sub"
          style={{
            fontSize: 'clamp(14px, 2vw, 17px)',
            lineHeight: 1.75,
            textAlign: 'center',
            color: '#94a3b8',
            maxWidth: 660,
            margin: '0 auto 32px',
          }}
        >
          Para estudantes e pensadores cansados de exercícios automáticos,{' '}
          <strong style={{ color: '#00ffcc' }}>Logic Friction</strong> é um tower defense tático
          onde a sua mente analítica é a única coisa parando o{' '}
          <strong style={{ color: '#a855f7' }}>Vírus Glitch</strong>.
        </p>

        {/* Benefits */}
        <div style={{ maxWidth: 540, width: '100%', marginBottom: 36 }}>
          <BenefitBullet icon="🧠" text="Construa resiliência neural resolvendo sob pressão real." />
          <BenefitBullet icon="⚡" text="Domine lógica com tomada de decisão em tempo real." />
          <BenefitBullet icon="🎮" text="Combate em cyber-grid procedural que nunca se repete." />
        </div>

        {/* Primary CTA */}
        <button
          onClick={onStart}
          style={{
            background: 'linear-gradient(135deg, #00ffcc, #00d4ff)',
            border: 'none',
            borderRadius: 14,
            padding: '18px 52px',
            color: '#050510',
            fontFamily: "'Orbitron', monospace",
            fontSize: 17,
            fontWeight: 900,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            animation: 'lp-cta-glow 2s ease infinite',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          ⛶ Entrar na Arena (Jogar Alpha)
        </button>

        {/* Scroll hint */}
        <p style={{
          marginTop: 32, fontSize: 13, color: '#475569',
          letterSpacing: '0.12em', textAlign: 'center',
          animation: 'lp-scroll-hint 2s ease infinite',
        }}>
          Role para baixo para conhecer o jogo ↓
        </p>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ██  SECTION 2 — PAIN (THE "BEFORE")  ██ */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        padding: '80px 24px',
        borderTop: '1px solid rgba(255,68,68,0.1)',
        background:
          'radial-gradient(ellipse at 70% 30%, rgba(255,68,68,0.04) 0%, transparent 55%),' +
          'transparent',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <AnimatedSection>
            {/* Eyebrow */}
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{
                display: 'inline-block', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                padding: '5px 16px', borderRadius: 100,
                background: 'rgba(255,68,68,0.10)', color: '#ff6b6b',
                border: '1px solid rgba(255,68,68,0.3)', marginBottom: 16,
              }}>
                💀 O PROBLEMA
              </span>
              <h2
                className="lp-section-title"
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 'clamp(22px, 3.5vw, 34px)',
                  fontWeight: 900, margin: '16px 0 16px', color: '#f1f5f9',
                  lineHeight: 1.3, textAlign: 'center',
                }}
              >
                Quando a Matemática Parece{' '}
                <span style={{ color: '#ff6b6b' }}>Atrofia Cognitiva.</span>
              </h2>
              <p style={{
                fontSize: 'clamp(14px, 1.8vw, 16px)', color: '#64748b',
                margin: '0 auto', maxWidth: 600, lineHeight: 1.75, textAlign: 'center',
              }}>
                Você conhece essa sensação. O cérebro desliga, os exercícios se repetem, e a matemática se torna um ritual vazio.
              </p>
            </div>
          </AnimatedSection>

          {/* Pain Cards */}
          <div
            className="lp-pain-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
              marginBottom: 40,
            }}
          >
            <AnimatedSection delay={100}>
              <PainCard
                icon="📝"
                title="Memorização Mecânica"
                desc="Repetir fórmulas sem entender o porquê. Decorar para a prova e esquecer no dia seguinte. O cérebro aprende a fingir que aprendeu."
              />
            </AnimatedSection>
            <AnimatedSection delay={200}>
              <PainCard
                icon="⏱️"
                title="Zero Pressão Real"
                desc="Exercícios estáticos em papel não simulam a urgência de uma decisão real. Sem consequência, o cérebro nunca sai do modo passivo."
              />
            </AnimatedSection>
            <AnimatedSection delay={300}>
              <PainCard
                icon="😶"
                title="Piloto Automático"
                desc="Quando o conteúdo não desafia, sua mente entra em modo automático. Você está presente, mas o cérebro já desistiu de processar."
              />
            </AnimatedSection>
          </div>

          {/* Belief Deconstruction */}
          <AnimatedSection delay={400}>
            <div style={{
              textAlign: 'center',
              padding: '32px 24px',
              background: 'rgba(255,68,68,0.04)',
              border: '1px solid rgba(255,68,68,0.12)',
              borderRadius: 14,
              maxWidth: 700,
              margin: '0 auto',
            }}>
              <p style={{
                fontSize: 15, color: '#94a3b8', lineHeight: 1.8, margin: 0,
                fontStyle: 'italic',
              }}>
                "A maioria acredita que a matemática é apenas sobre colocar números no papel.{' '}
                <strong style={{ color: '#ff6b6b' }}>
                  Nós acreditamos que ela é a linguagem universal da sobrevivência.
                </strong>"
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ██  SECTION 3 — OUTCOME (THE "AFTER")  ██ */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        padding: '80px 24px',
        borderTop: '1px solid rgba(0,255,204,0.08)',
        background:
          'radial-gradient(ellipse at 30% 50%, rgba(0,255,204,0.04) 0%, transparent 55%),' +
          'radial-gradient(ellipse at 80% 80%, rgba(168,85,247,0.03) 0%, transparent 50%),' +
          'transparent',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <AnimatedSection>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{
                display: 'inline-block', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                padding: '5px 16px', borderRadius: 100,
                background: 'rgba(0,255,204,0.10)', color: '#00ffcc',
                border: '1px solid rgba(0,255,204,0.3)', marginBottom: 16,
              }}>
                ✨ O RESULTADO
              </span>
              <h2
                className="lp-section-title"
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 'clamp(22px, 3.5vw, 34px)',
                  fontWeight: 900, margin: '16px 0 16px', color: '#f1f5f9',
                  lineHeight: 1.3, textAlign: 'center',
                }}
              >
                Imagine Sua Mente Funcionando{' '}
                <span className="lp-gradient-text">a Todo Vapor.</span>
              </h2>
              <p style={{
                fontSize: 'clamp(14px, 1.8vw, 16px)', color: '#64748b',
                margin: '0 auto', maxWidth: 620, lineHeight: 1.75, textAlign: 'center',
              }}>
                Quando a pressão é real, o aprendizado é profundo. Veja o que acontece quando sua mente é forjada no combate.
              </p>
            </div>
          </AnimatedSection>

          <div
            className="lp-outcome-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
              marginBottom: 40,
            }}
          >
            <AnimatedSection delay={100}>
              <OutcomeCard
                icon="🎯"
                title="Decisões Rápidas"
                accent="#00ffcc"
                desc="Confiança para tomar decisões rápidas sob pressão. Cada onda é um teste. Cada resposta certa é uma vitória neural."
              />
            </AnimatedSection>
            <AnimatedSection delay={200}>
              <OutcomeCard
                icon="⚖️"
                title="Lógica do Equilíbrio"
                accent="#00d4ff"
                desc="Enxergar a matemática como a lógica do equilíbrio. Ação e reação. Cada cálculo tem impacto direto na sua sobrevivência."
              />
            </AnimatedSection>
            <AnimatedSection delay={300}>
              <OutcomeCard
                icon="🌊"
                title="Estado de Fluxo"
                accent="#a855f7"
                desc="Entrar em estado de fluxo (flow) tático e mental. A pressão das ondas inimigas cria o ambiente perfeito para foco absoluto."
              />
            </AnimatedSection>
          </div>

          {/* New Paradigm */}
          <AnimatedSection delay={400}>
            <div style={{
              textAlign: 'center',
              padding: '32px 24px',
              background: 'rgba(0,255,204,0.03)',
              border: '1px solid rgba(0,255,204,0.10)',
              borderRadius: 14,
              maxWidth: 700,
              margin: '0 auto',
            }}>
              <p style={{
                fontSize: 15, color: '#94a3b8', lineHeight: 1.8, margin: 0,
                fontStyle: 'italic',
              }}>
                "O treinamento cognitivo não precisa ser clínico.{' '}
                <strong className="lp-gradient-text" style={{ WebkitTextFillColor: undefined }}>
                  <span className="lp-gradient-text">Ele deve ser brutal, imersivo e implacável.</span>
                </strong>"
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ██  SECTION 4 — PRODUCT INTRODUCTION  ██ */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        padding: '80px 24px',
        borderTop: '1px solid rgba(0,255,204,0.08)',
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(0,255,204,0.05) 0%, transparent 50%),' +
          'transparent',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <AnimatedSection>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{
                display: 'inline-block', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                padding: '5px 16px', borderRadius: 100,
                background: 'rgba(0,255,204,0.10)', color: '#00ffcc',
                border: '1px solid rgba(0,255,204,0.3)', marginBottom: 16,
              }}>
                ⚙️ A SOLUÇÃO
              </span>
              <h2
                className="lp-section-title"
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 'clamp(28px, 4vw, 42px)',
                  fontWeight: 900, margin: '16px 0 16px',
                  lineHeight: 1.2, textAlign: 'center',
                }}
              >
                <span className="lp-gradient-text">Logic Friction</span>
              </h2>
              <p style={{
                fontSize: 'clamp(14px, 1.8vw, 16px)', color: '#64748b',
                margin: '0 auto', maxWidth: 620, lineHeight: 1.75, textAlign: 'center',
              }}>
                Tower defense tático em 3D onde cada cálculo correto é uma arma, cada erro é uma consequência, e cada onda é uma prova de fogo.
              </p>
            </div>
          </AnimatedSection>

          {/* 3-Step Process */}
          <AnimatedSection delay={150}>
            <div
              className="lp-step-grid"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 56,
              }}
            >
              <StepCard
                number={1}
                icon="🧮"
                title="Calcule"
                desc="Resolva equações que surgem como plataformas 3D na arena."
                accent="#00ffcc"
              />
              <span
                className="lp-step-arrow"
                style={{
                  fontSize: 24, color: '#334155',
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >→</span>
              <StepCard
                number={2}
                icon="🏗️"
                title="Fortifique"
                desc="Erga Obeliscos defensivos com os recursos conquistados."
                accent="#ffd700"
              />
              <span
                className="lp-step-arrow"
                style={{
                  fontSize: 24, color: '#334155',
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >→</span>
              <StepCard
                number={3}
                icon="⚔️"
                title="Sobreviva"
                desc="Derrote o Vírus Glitch antes que ele destrua seu Core."
                accent="#ff5555"
              />
            </div>
          </AnimatedSection>

          {/* Founder's Message */}
          <AnimatedSection delay={300}>
            <div style={{
              maxWidth: 720,
              margin: '0 auto 32px',
              background: 'rgba(4,8,24,0.85)',
              border: '1px solid rgba(0,255,204,0.15)',
              borderRadius: 16,
              padding: '36px 32px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Top accent line */}
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: 2,
                background: 'linear-gradient(90deg, transparent, #00ffcc, #a855f7, transparent)',
              }} />
              <div style={{
                fontSize: 11, fontWeight: 700,
                fontFamily: "'Orbitron', monospace",
                color: '#00ffcc',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 18,
                opacity: 0.8,
              }}>
                💬 Mensagem do Fundador
              </div>
              <blockquote style={{
                margin: 0, padding: '0 0 0 20px',
                borderLeft: '3px solid rgba(0,255,204,0.3)',
              }}>
                <p style={{
                  fontSize: 15, color: '#cbd5e1', lineHeight: 1.85, margin: '0 0 8px',
                  fontStyle: 'italic',
                }}>
                  "Criado por Augusto Heiss
                </p>
                <p style={{
                  fontSize: 15, color: '#cbd5e1', lineHeight: 1.85, margin: '0 0 8px',
                  fontStyle: 'italic',
                }}>
                  A regra é clara: <strong style={{ color: '#00ffcc' }}>Ação e Reação</strong>. Todo tempo é importante.
                  Não somos como os animais, guiados apenas pelo instinto; existe um propósito muito maior para a
                  mente do que viver uma vida de passarinho ou de uma formiga."
                </p>
              </blockquote>
            </div>
          </AnimatedSection>

          {/* Game UI Reminder */}
          <AnimatedSection delay={400}>
            <div style={{
              maxWidth: 600,
              margin: '0 auto 48px',
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: 12,
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>ℹ️</span>
              <p style={{
                margin: 0, fontSize: 14, color: '#94a3b8',
                lineHeight: 1.7, fontStyle: 'italic',
                fontFamily: "'Inter', sans-serif",
              }}>
                <strong style={{ color: '#00d4ff' }}>Lembrete:</strong>{' '}
                Lembre-se de acessar o LOG das explicações no MENU em caso de dúvidas.
              </p>
            </div>
          </AnimatedSection>

          {/* Final CTA */}
          <AnimatedSection delay={500}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <button
                onClick={onStart}
                style={{
                  background: 'linear-gradient(135deg, #00ffcc, #00d4ff)',
                  border: 'none',
                  borderRadius: 14,
                  padding: '18px 52px',
                  color: '#050510',
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 17,
                  fontWeight: 900,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  animation: 'lp-cta-glow 2s ease infinite',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ⛶ Entrar na Arena (Jogar Alpha)
              </button>
              <p
                onClick={scrollToTop}
                style={{
                  marginTop: 16, fontSize: 13, color: '#475569',
                  letterSpacing: '0.08em', cursor: 'pointer',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#00ffcc')}
                onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
              >
                ↑ Voltar ao topo
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ██  FOOTER  ██ */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <footer style={{
        padding: '40px 24px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: '#02020a',
        textAlign: 'center',
      }}>
        <p style={{
          margin: '0 0 12px', fontSize: 12, color: '#334155',
          letterSpacing: '0.08em',
          fontFamily: "'Inter', sans-serif",
        }}>
          © {new Date().getFullYear()} Heiss-Lab · Logic Friction · Protótipo EdTech 3D
        </p>
        <p style={{
          margin: '0 0 8px', fontSize: 13, color: '#475569',
          fontFamily: "'Inter', sans-serif",
        }}>

          <span style={{ color: '#00ffcc', fontWeight: 600 }}>

          </span>
        </p>
        <p style={{
          margin: 0, fontSize: 12, color: '#334155',
          fontFamily: "'Inter', sans-serif",
          fontStyle: 'italic',
        }}>
          Para saber o contato do colaborador, acesse o "Sobre" do site.
        </p>
      </footer>
    </div>
  )
}
