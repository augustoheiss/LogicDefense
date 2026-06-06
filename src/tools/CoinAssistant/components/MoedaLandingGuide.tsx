/**
 * MoedaLandingGuide — Scrollable landing page & practical guide
 * placed directly below the interactive dashboard.
 *
 * Follows the Before-After-Bridge copywriting framework and
 * uses the same dark-theme design language as the rest of the app.
 */

import React from 'react';

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
           SECTION 1 — HERO (Above the Fold)
           ──────────────────────────────────────────────────────────────────── */}
      <Section>
        <div className="text-center space-y-6">
          {/* Decorative badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] text-xs font-semibold tracking-wide">
            💰 Assistente-Moeda — Inteligência Local & IA
          </span>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Assuma o Volante do seu{' '}
            <span className="bg-gradient-to-r from-[#a855f7] to-cyan-400 bg-clip-text text-transparent">
              Fluxo de Caixa Real
            </span>{' '}
            e Pare de Dirigir de Olhos Vendados.
          </h2>

          <p className="text-base sm:text-lg text-white/45 max-w-2xl mx-auto leading-relaxed">
            O Assistente-Moeda não é uma planilha comum. É um{' '}
            <span className="text-white font-medium">motor de inteligência financeira local com IA</span> que
            fatia seus custos invisíveis por dia e calcula seu lucro líquido real, integrando juros compostos
            automatizados e relatórios de auditoria.
          </p>

          {/* Quick benefits (3 points) */}
          <div className="grid sm:grid-cols-3 gap-3 pt-4 max-w-2xl mx-auto">
            {[
              {
                title: '✦ Meta Diária de Sobrevivência Dinâmica',
                desc: 'Saiba os primeiros Reais do dia que já estão comprometidos antes de ligar o motor.',
              },
              {
                title: '✦ Rendimento de Portfólio Integrado',
                desc: 'Loop cronológico de juros compostos a 0.8%/mês CDI direto nos aportes salvos.',
              },
              {
                title: '✦ Soberania Absoluta dos Dados',
                desc: 'Processamento local criptografado. Nada sai do seu dispositivo.',
              },
            ].map((b) => (
              <div
                key={b.title}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left space-y-1"
              >
                <div className="text-xs font-bold text-white">{b.title}</div>
                <div className="text-[11px] text-white/40 leading-relaxed">{b.desc}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="pt-4">
            <button
              onClick={scrollToTop}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] hover:from-[#9333ea] hover:to-[#6d28d9] text-white font-bold text-sm shadow-lg shadow-[#a855f7]/20 hover:shadow-[#a855f7]/30 transition-all duration-300 active:scale-[0.97]"
            >
              ↑ Começar a Usar
            </button>
          </div>
        </div>
      </Section>

      {/* ────────────────────────────────────────────────────────────────────
           SECTION 2 — THE "BEFORE" (Pain / O Antes)
           ──────────────────────────────────────────────────────────────────── */}
      <Section className="border-t border-white/5">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold text-red-400/60 uppercase tracking-widest">
              O Antes
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              A Ilusão do Lucro e o Pesadelo das Contas Anuais Invisíveis
            </h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <PainCard
              icon="💸"
              title="A Falsa Sensação de Riqueza"
              description="Você faz um faturamento bruto excelente na semana, mas esquece que o IPVA, o seguro, a depreciação e a manutenção estão correndo em silêncio debaixo dos seus pés. Quando a conta chega no final do ano, o seu lucro simplesmente desaparece."
            />
            <PainCard
              icon="📉"
              title="Planilhas Tradicionais que Mentem"
              description="Lançar um gasto de R$ 3.000 em Janeiro faz aquele mês parecer um desastre completo, e os meses seguintes parecerem falsamente lucrativos. Sem diluir os custos fixos no tempo por regime de competência, você está operando no escuro."
            />
          </div>

          {/* Belief deconstruction */}
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-6 sm:p-8">
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">🪞</span>
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-amber-400">
                  Desconstrução de Crença
                </h4>
                <p className="text-sm text-white/45 leading-relaxed">
                  Muitos motoristas e profissionais independentes acreditam que basta anotar o que entra e sai no dia para ter controle. A verdade inconveniente é que{' '}
                  <span className="text-white/70 font-medium">
                    sem ratear os custos de longo prazo proporcionalmente pelo calendário, você está gastando capital de giro achando que é lucro
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ────────────────────────────────────────────────────────────────────
           SECTION 3 — THE "AFTER" (Desired Outcome / O Depois)
           ──────────────────────────────────────────────────────────────────── */}
      <Section className="border-t border-white/5">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold text-emerald-400/60 uppercase tracking-widest">
              O Depois
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Imagine marchar sabendo exatamente onde pisar
            </h3>
          </div>

          {/* Dobra de Resultado */}
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] p-6 text-center space-y-2 max-w-2xl mx-auto">
            <p className="text-base text-white/80 leading-relaxed font-semibold">
              "Ligue o seu carro ou abra o seu negócio sabendo que os primeiros R$ 108,00 do dia já estão automaticamente quitados e guardados para as suas contas anuais rateadas. O que passar dessa linha, é lucro real e líquido no seu bolso."
            </p>
          </div>

          {/* Visual de Sucesso */}
          <div className="grid sm:grid-cols-2 gap-4">
            <OutcomeCard
              icon="🧮"
              title="Meta de Sobrevivência Coberta"
              description="Controle operacional limpo. Visualize de antemão qual é o faturamento exato diário para garantir o pagamento de IPVA, Manutenção e Seguro sem sobressaltos."
            />
            <OutcomeCard
              icon="📅"
              title="Previsibilidade Absoluta Calendário"
              description="Previsibilidade absoluta ajustada dinamicamente para meses de 28 ou 31 dias, garantindo que o seu custo real seja diluído sem distorções temporais."
            />
          </div>
        </div>
      </Section>

      {/* ────────────────────────────────────────────────────────────────────
           SECTION 4 — THE BRIDGE / HOW IT WORKS (A Ponte)
           ──────────────────────────────────────────────────────────────────── */}
      <Section className="border-t border-white/5">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold text-[#a855f7]/60 uppercase tracking-widest">
              A Ponte
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Como Operar o Assistente-Moeda: 3 Passos Simples
            </h3>
            <p className="text-sm text-white/35 max-w-xl mx-auto">
              Siga este guia prático para alcançar previsibilidade absoluta sobre seus números.
            </p>
          </div>

          <div className="space-y-4">
            <StepCard
              step={1}
              icon="🛒"
              title="Passo 1 — Lançando o Dia a Dia (Custos Variáveis)"
              description="Adicione combustível, pedágio ou almoço com a mesma data de início e fim (ex: sob a categoria 'EH Bradesco' ou 'ALIMENTAÇÃO'). O sistema entende que foi um gasto pontual e isola o impacto no mês corrente."
            />
            <StepCard
              step={2}
              icon="✨"
              title="Passo 2 — A Mágica do Rateio Completo (Custos Fixos)"
              description="Lançou o IPVA ou o Seguro Anual (ex: sob a categoria 'AH ITAU')? Defina a Data Inicial e Final (ex: 01/Jan a 31/Dez). O motor fatiará o montante e cobrará apenas a fração justa para cada dia do calendário."
            />
            <StepCard
              step={3}
              icon="📊"
              title="Passo 3 — Extraia a Inteligência Máxima"
              description="Acompanhe os gráficos de fluxo diário cronológico, acione o Analista de IA para receber auditorias e exporte o Relatório Executivo em PDF oficial com um clique."
            />
          </div>

          {/* Final CTA */}
          <div className="text-center pt-6">
            <button
              onClick={scrollToTop}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] hover:from-[#9333ea] hover:to-[#6d28d9] text-white font-bold text-sm shadow-lg shadow-[#a855f7]/20 hover:shadow-[#a855f7]/30 transition-all duration-300 active:scale-[0.97]"
            >
              ↑ Ir para o Painel Operacional
            </button>
            <p className="text-xs text-white/20 mt-3">
              Todos os dados são salvos localmente no seu navegador. Processamento local criptografado.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
