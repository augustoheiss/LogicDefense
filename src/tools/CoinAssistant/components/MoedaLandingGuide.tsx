/**
 * MoedaLandingGuide — Scrollable landing page & practical guide
 * placed directly below the interactive dashboard.
 *
 * Follows the Before-After-Bridge copywriting framework and
 * uses the same dark-theme design language as the rest of the app.
 */

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-16 sm:py-20 ${className}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6">{children}</div>
    </section>
  );
}

// ── Step card (for the how-it-works section) ─────────────────────────────────

function StepCard({
  step,
  title,
  description,
  icon,
}: {
  step: number;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="relative rounded-2xl border border-white/8 bg-white/[0.03] p-6 sm:p-8 overflow-hidden group hover:border-white/15 transition-all duration-300">
      {/* Glow accent */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#a855f7]/5 rounded-full blur-3xl group-hover:bg-[#a855f7]/10 transition-all duration-500" />

      <div className="relative flex gap-4 items-start">
        <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-[#a855f7]/15 text-[#a855f7] text-lg font-bold font-mono border border-[#a855f7]/20">
          {step}
        </span>
        <div className="space-y-2">
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <span>{icon}</span> {title}
          </h4>
          <p className="text-sm text-white/50 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ── Pain point card ──────────────────────────────────────────────────────────

function PainCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-6 space-y-2">
      <h4 className="text-sm font-bold text-red-400 flex items-center gap-2">
        <span className="text-base">{icon}</span> {title}
      </h4>
      <p className="text-sm text-white/45 leading-relaxed">{description}</p>
    </div>
  );
}

// ── Outcome card ─────────────────────────────────────────────────────────────

function OutcomeCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-6 space-y-2">
      <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
        <span className="text-base">{icon}</span> {title}
      </h4>
      <p className="text-sm text-white/45 leading-relaxed">{description}</p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function MoedaLandingGuide() {
  function scrollToTop() {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className="mt-16 border-t border-white/5">
      {/* ────────────────────────────────────────────────────────────────────
           SECTION 1 — HERO
           ──────────────────────────────────────────────────────────────────── */}
      <Section>
        <div className="text-center space-y-6">
          {/* Decorative badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] text-xs font-semibold tracking-wide">
            💰 Assistente Moeda — Guia Prático
          </span>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Assuma o Volante do seu{' '}
            <span className="bg-gradient-to-r from-[#a855f7] to-cyan-400 bg-clip-text text-transparent">
              Fluxo de Caixa
            </span>
            .
          </h2>

          <p className="text-base sm:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed">
            O Assistente Moeda não é apenas uma planilha — é um{' '}
            <span className="text-white/70 font-medium">motor de inteligência financeira</span>.
            Descubra a sua Meta Diária de Sobrevivência real e pare de ser surpreendido
            por contas anuais invisíveis.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {[
              { icon: '⚙️', text: 'Rateio Automático de Custos Fixos (Regime de Competência)' },
              { icon: '📊', text: 'Separação inteligente de despesas do dia a dia' },
              { icon: '🎯', text: 'Metas Dinâmicas que se ajustam ao tamanho do mês' },
            ].map((pill) => (
              <span
                key={pill.text}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/8 text-xs text-white/50"
              >
                <span>{pill.icon}</span> {pill.text}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="pt-4">
            <button
              onClick={scrollToTop}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] hover:from-[#9333ea] hover:to-[#6d28d9] text-white font-bold text-sm shadow-lg shadow-[#a855f7]/20 hover:shadow-[#a855f7]/30 transition-all duration-300 active:scale-[0.97]"
            >
              ↑ Começar a Lançar Gastos
            </button>
          </div>
        </div>
      </Section>

      {/* ────────────────────────────────────────────────────────────────────
           SECTION 2 — THE "BEFORE" (Pain)
           ──────────────────────────────────────────────────────────────────── */}
      <Section className="border-t border-white/5">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold text-red-400/60 uppercase tracking-widest">
              O Problema
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              A Ilusão do Lucro e o Pesadelo das Contas Anuais
            </h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <PainCard
              icon="💸"
              title="A Falsa Sensação de Riqueza"
              description="Você faz um bom dinheiro na semana, mas esquece que o IPVA e o Seguro estão correndo em silêncio. Quando a conta chega, o lucro desaparece."
            />
            <PainCard
              icon="📉"
              title="Planilhas Que Mentem"
              description="Lançar um gasto de R$ 3.000 em Janeiro faz aquele mês parecer um desastre, e os outros meses parecerem lucrativos demais."
            />
          </div>

          {/* Belief deconstruction */}
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-6 sm:p-8">
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">🪞</span>
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-amber-400">
                  A Verdade Inconveniente
                </h4>
                <p className="text-sm text-white/45 leading-relaxed">
                  Muitos motoristas e autônomos acreditam que basta anotar o que entra e o que
                  sai no dia. A verdade é que{' '}
                  <span className="text-white/70 font-medium">
                    sem diluir os custos de longo prazo, você está dirigindo de olhos vendados
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ────────────────────────────────────────────────────────────────────
           SECTION 3 — THE "AFTER" (Desired Outcome)
           ──────────────────────────────────────────────────────────────────── */}
      <Section className="border-t border-white/5">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold text-emerald-400/60 uppercase tracking-widest">
              O Resultado
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              A Clareza da{' '}
              <span className="text-emerald-400">&ldquo;Meta de Sobrevivência&rdquo;</span>
            </h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <OutcomeCard
              icon="🧮"
              title="Saber Exatamente o Seu Custo Diário"
              description="Imagine ligar o carro sabendo que os primeiros R$ 108,00 do dia já estão comprometidos com o custo rateado do seu ano. O que passar disso, é lucro real."
            />
            <OutcomeCard
              icon="📅"
              title="Previsibilidade Absoluta"
              description="Mês de 28 dias ou 31 dias? O painel ajusta a sua meta de sobrevivência automaticamente para a realidade do calendário."
            />
          </div>
        </div>
      </Section>

      {/* ────────────────────────────────────────────────────────────────────
           SECTION 4 — THE BRIDGE / HOW IT WORKS
           ──────────────────────────────────────────────────────────────────── */}
      <Section className="border-t border-white/5">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold text-[#a855f7]/60 uppercase tracking-widest">
              Guia Prático
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Como Operar o Assistente Moeda
            </h3>
            <p className="text-sm text-white/35 max-w-xl mx-auto">
              3 passos simples para transformar caos financeiro em clareza absoluta.
            </p>
          </div>

          <div className="space-y-4">
            <StepCard
              step={1}
              icon="🛒"
              title="Lançando Custos Variáveis (O Dia a Dia)"
              description="Adicione combustível, almoço ou pedágio. Coloque a mesma data no Início e no Fim. O sistema entende que foi um gasto pontual que sangrou o caixa naquele mês."
            />
            <StepCard
              step={2}
              icon="✨"
              title="Lançando Custos Fixos (A Mágica do Rateio)"
              description="Adicionou o IPVA ou o Seguro? Defina a Data Inicial (ex: 01/Jan) e a Data Final (ex: 31/Dez). O motor do Assistente vai fatiar esse valor gigante e cobrar apenas a parcela justa de cada dia trabalhado."
            />
            <StepCard
              step={3}
              icon="📊"
              title="Acompanhe as Métricas"
              description="Deixe o sistema calcular a sua 'Meta Diária Global'. Exporte para o WhatsApp e tenha o relatório perfeito na palma da mão."
            />
          </div>

          {/* Final CTA */}
          <div className="text-center pt-6">
            <button
              onClick={scrollToTop}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] hover:from-[#9333ea] hover:to-[#6d28d9] text-white font-bold text-sm shadow-lg shadow-[#a855f7]/20 hover:shadow-[#a855f7]/30 transition-all duration-300 active:scale-[0.97]"
            >
              ↑ Voltar ao Painel e Começar
            </button>
            <p className="text-xs text-white/20 mt-3">
              Todos os dados são salvos localmente no seu navegador. Nada sai do seu dispositivo.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
