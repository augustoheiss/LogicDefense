import React from 'react';

// ── Shared UI Sub-components ──────────────────────────────────────────────────

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

function Section({ children, className = '', id }: SectionProps) {
  return (
    <section id={id} className={`py-12 sm:py-16 ${className}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6">{children}</div>
    </section>
  );
}

interface PainCardProps {
  icon: string;
  title: string;
  description: string;
}

function PainCard({ icon, title, description }: PainCardProps) {
  return (
    <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.02] p-5 sm:p-6 space-y-2 hover:border-red-500/20 transition-colors">
      <h4 className="text-sm font-bold text-red-400 flex items-center gap-2">
        <span className="text-base">{icon}</span> {title}
      </h4>
      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{description}</p>
    </div>
  );
}

interface ModuleCardProps {
  moduleNum: number;
  title: string;
  subtitle: string;
  competencies: string[];
  files: { name: string; url: string }[];
  mathFormula?: string;
  mathExplanation?: string;
}

function ModuleCard({
  moduleNum,
  title,
  subtitle,
  competencies,
  files,
  mathFormula,
  mathExplanation,
}: ModuleCardProps) {
  return (
    <div className="relative rounded-2xl border border-indigo-500/10 bg-slate-900/40 p-6 sm:p-8 space-y-4 hover:border-indigo-500/20 transition-all duration-300 group">
      {/* Subtle indicator */}
      <span className="absolute top-6 right-6 shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold font-mono border border-indigo-500/20">
        M{moduleNum}
      </span>

      <div className="space-y-1.5 pr-10">
        <h4 className="text-base sm:text-lg font-bold text-white leading-tight">
          {title}
        </h4>
        <p className="text-xs text-indigo-400 font-medium tracking-wide uppercase">
          {subtitle}
        </p>
      </div>

      <div className="space-y-2">
        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Competências & Conceitos Chave:
        </h5>
        <ul className="space-y-1.5">
          {competencies.map((comp, idx) => (
            <li key={idx} className="text-xs sm:text-sm text-slate-300 flex items-start gap-2">
              <span className="text-indigo-400 text-xs select-none">✦</span>
              <span>{comp}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Arquivos de Produção Analisados:
        </h5>
        <div className="flex flex-wrap gap-2">
          {files.map((f, idx) => (
            <a
              key={idx}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white bg-slate-800 border border-white/10 hover:bg-slate-700 px-2.5 py-1 rounded transition-colors"
            >
              {f.name}
            </a>
          ))}
        </div>
      </div>

      {mathFormula && (
        <div className="pt-3 border-t border-white/5 space-y-1.5">
          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Equação do Motor Contábil:
          </h5>
          <div className="bg-slate-950/80 border border-indigo-500/5 rounded-lg p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
            {mathFormula}
          </div>
          {mathExplanation && (
            <p className="text-[11px] text-slate-400 leading-snug">
              {mathExplanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}



// ── Main Component ────────────────────────────────────────────────────────────

export function SaaSMasterclassLandingPage() {
  function scrollToTop() {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const handleStudyClick = () => {
    const curriculumSection = document.getElementById('curriculum-grid');
    if (curriculumSection) {
      curriculumSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="mt-16 sm:mt-24 border-t border-indigo-500/15 bg-slate-950 rounded-3xl overflow-hidden text-white font-sans">
      <div className="relative">
        
        {/* ── SECTION 1: HERO (Above the Fold) ── */}
        <Section className="relative border-b border-white/5 pt-16 sm:pt-20">
          <div className="text-center space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wide uppercase select-none">
              🚀 Portal Open-Source de Engenharia de Software e Sistemas de IA
            </span>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight max-w-3xl mx-auto">
              Pare de escrever CRUDs medíocres de "arrastar card". Aprenda de graça a engenharia por trás de motores contábeis com proração de tempo real e arquitetura de RAG financeiro que corta 85% dos custos de nuvem.
            </h2>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Acesse o manual completo e estude os módulos de código-fonte real do ecossistema do{' '}
              <span className="text-white font-semibold">Assistente-Moeda</span> de forma 100% gratuita. Aprenda revisando, auditando e reconstruindo uma infraestrutura financeira de alta complexidade diretamente no seu navegador.
            </p>

            {/* Core benefits summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl mx-auto pt-4 text-left">
              {[
                { icon: '🛡️', title: 'Controle de Timezone Blindado', desc: 'Precorra chaves de datas e acabe com o sangramento de datas UTC/DST.' },
                { icon: '📊', title: 'Sem Diluição Contratual 12x', desc: 'Previsão estatística segura por rateio calendário prático.' },
                { icon: '🧼', title: 'Matching de Wash Transactions', desc: 'Algoritmos quadráticos em Sets para netting contábil de parcerias.' },
                { icon: '🧬', title: 'RAG em Cascata de 4 Tiers', desc: 'Compressão em Python reduzindo custos com tiktoken.' },
              ].map((b, idx) => (
                <div key={idx} className="flex gap-2.5 items-start p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <span className="text-base shrink-0">{b.icon}</span>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white">{b.title}</h4>
                    <p className="text-[11px] text-slate-300 leading-snug">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Call to action button */}
            <div className="pt-6 space-y-3">
              <button
                onClick={handleStudyClick}
                className="inline-flex items-center justify-center px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm sm:text-base rounded-xl transition-all shadow-lg shadow-emerald-500/10 gap-2 cursor-pointer w-full sm:w-auto"
              >
                👉 COMEÇAR A ESTUDAR OS MÓDULOS GRATUITOS
              </button>
              <p className="text-[11px] text-slate-400">
                Acesso imediato à documentação e base de código-fonte detalhada abaixo.
              </p>
            </div>
          </div>
        </Section>

        {/* ── SECTION 2: THE BEFORE (Emotional Agitation) ── */}
        <Section className="border-b border-white/5 bg-slate-950">
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                A Ilusão do "Desenvolvimento Moderno": Você está construindo sistemas reais ou apenas empilhando tutoriais vazios de internet?
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                A maioria dos cursos ensina CRUDs simplificados. Em cenários de produção financeira real, essa ingenuidade gera falhas críticas e despesas catastróficas.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PainCard
                icon="🕰️"
                title="O Sangramento de Fuso Horário (Timezone Bleed)"
                description="Lançamentos contábeis efetuados à noite que caem no dia anterior por desvios na ISO UTC de navegadores clientes, quebrando relatórios de competência."
              />
              <PainCard
                icon="📉"
                title="O Bug da Diluição Contratual de 12x"
                description="Cálculos de amortização e projeções que usam divisores estáticos fixados em 12, diluindo custos operacionais sob frações em meses parciais."
              />
              <PainCard
                icon="🔄"
                title="Inflação Artificial de Gráficos (Wash Bloat)"
                description="Créditos e débitos idênticos de parcerias que mascaram a produtividade ao encher as representações visuais com volumes neutros duplicados."
              />
              <PainCard
                icon="💸"
                title="Queima de Janela de Contexto em LLMs"
                description="Despejar JSONs estruturados brutos com chaves longas e UUIDs em IAs, resultando em latência alta, custo exorbitante e alucinações aritméticas."
              />
            </div>

            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 text-center space-y-3">
              <h4 className="text-sm font-bold text-white">Desconstrução de Crenças & Mitos Operacionais</h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl mx-auto">
                Muitos pensam que lidar com fusos horários locais exige infraestruturas de timezone complexas. Outros supõem que IAs são perfeitamente capazes de fazer matemática financeira decimal e deduções em ledger brutos. Ambas as ideias estão erradas e geram código frágil e custos desnecessários em nuvem.
              </p>
            </div>
          </div>
        </Section>

        {/* ── SECTION 3: THE AFTER (Revelation & Semantic Bridge) ── */}
        <Section className="border-b border-white/5">
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                Entre na Sala de Controle: O Novo Paradigma da Engenharia de Sistemas de Alto Nível
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                Desenvolva a mentalidade de um Arquiteto de Sistemas de IA. Sem teorias cansativas: audite código de produção real diretamente do laboratório contábil.
              </p>
            </div>

            {/* CSS Flowchart representing the 3-step paradigm */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {[
                { step: '01', title: 'Auditar a Base Real', desc: 'Analise o repositório em produção para identificar pontos fracos.' },
                { step: '02', title: 'Destravar os Bugs', desc: 'Investigue o motor contábil diário e a janela de prompts do chatbot.' },
                { step: '03', title: 'Dominar a Otimização', desc: 'Reescreva fluxos e reduza em até 85% os custos de API com testes.' },
              ].map((stepObj, idx) => (
                <div key={idx} className="relative p-5 rounded-2xl bg-slate-900/40 border border-white/5 flex flex-col gap-2.5">
                  <span className="text-2xl font-extrabold text-emerald-400/20 font-mono absolute top-4 right-4">
                    {stepObj.step}
                  </span>
                  <h4 className="text-sm font-bold text-white">{stepObj.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{stepObj.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── SECTION 4: VALUE STACKING (Curriculum Grid) ── */}
        <Section id="curriculum-grid" className="border-b border-white/5">
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                A Grade de Engenharia Sem Atalhos: 5 Módulos de Código Puro
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                Não pulamos etapas. Veja tudo o que será abordado com base nas classes e lógicas que construíram o Assistente-Moeda.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ModuleCard
                moduleNum={1}
                title="O Motor Contábil de Regime de Competência Diária (Accrual Engine)"
                subtitle="Matemática de Proração e Timezone-Safety"
                competencies={[
                  "Proteção temporal contra desvios de timezone e DST com ancoramento UTC T12:00:00.",
                  "Proração fracionária de despesas de longo prazo por interseção de dias no ano civil.",
                  "Cálculo de metas e balanço diário de sobrevivência operacional."
                ]}
                files={[
                  { name: "useMetricsEngine.ts", url: "https://github.com/augustoheiss/LogicDefense/blob/main/src/tools/CoinAssistant/hooks/useMetricsEngine.ts" },
                  { name: "coin_metrics_engine.py", url: "https://github.com/augustoheiss/LogicDefense/blob/main/backend/services/coin_metrics_engine.py" }
                ]}
                mathFormula="survivalDaily = totalExpenses / globalExpenseDaySpan"
                mathExplanation="Calcula o break-even dinâmico amortizando todos os custos fixos no decorrer dos dias calendários reais."
              />

              <ModuleCard
                moduleNum={2}
                title="O Motor de Projeção Estatística e Dilatação Temporal"
                subtitle="Estabilização e Escalonamento Temporal"
                competencies={[
                  "Correção do bug de diluição temporal de fator 12x em projeções.",
                  "Controle de rateio progressivo de categorias com flags e âncoras locais.",
                  "Mapeamento de séries de dados e estatísticas descritivas (DP, mediana, moda)."
                ]}
                files={[
                  { name: "usePredictionEngine.ts", url: "https://github.com/augustoheiss/LogicDefense/blob/main/src/tools/CoinAssistant/hooks/usePredictionEngine.ts" }
                ]}
                mathFormula="estimatedMonthly = categoryTotal / g.proratedCount"
                mathExplanation="Substitui o divisor fixo pelo número exato de frações mensais decorridas da categoria."
              />

              <ModuleCard
                moduleNum={3}
                title="Engenharia Contábil de Netting e Detecção de Wash Transactions"
                subtitle="Compensação e Agrupamento no Tempo"
                competencies={[
                  "Lógica de detecção linear de wash entries cruzadas usando conjuntos indexados (Set<string>).",
                  "Absorção de déficits líquidos de parceria no passivo contábil total.",
                  "Banco de Tempo acumulado derivado de equivalentes de semanas."
                ]}
                files={[
                  { name: "WhatsAppExporter.tsx", url: "https://github.com/augustoheiss/LogicDefense/blob/main/src/tools/CoinAssistant/components/WhatsAppExporter.tsx" }
                ]}
                mathFormula="adjustedMetasAcumuladas = MetasAcumuladas + | min(0, netPartnershipDelta) |"
                mathExplanation="Garante que déficits de transações transitórias sejam computados no faturamento operacional pendente."
              />

              <ModuleCard
                moduleNum={4}
                title="Loops Calendar-Driven e Integridade Cronológica"
                subtitle="Alinhamento e Garantia da Linha do Tempo"
                competencies={[
                  "Implementação de loops de série temporal controlados por calendário.",
                  "Injeção automática de slots vazios para semanas sem lançamentos contábeis.",
                  "Timezone safety com chaves locais (toLocalKey) isoladas de desvios UTC."
                ]}
                files={[
                  { name: "dateUtils.ts", url: "https://github.com/augustoheiss/LogicDefense/blob/main/src/tools/CoinAssistant/utils/dateUtils.ts" },
                  { name: "WhatsAppExporter.tsx", url: "https://github.com/augustoheiss/LogicDefense/blob/main/src/tools/CoinAssistant/components/WhatsAppExporter.tsx" }
                ]}
              />

              <div className="md:col-span-2">
                <ModuleCard
                  moduleNum={5}
                  title="Arquitetura de RAG Analítico e Ingestão de Contexto no Python Backend"
                  subtitle="Prompt Engineering, Compressão Cascateada & Escalonamento de Tokens"
                  competencies={[
                    "Construção de hidratadores de contexto Markdown contendo análises estatísticas pré-calculadas deterministicamente.",
                    "Compactação dinâmica de ledger em 4 Tiers com base no volume histórico do usuário.",
                    "System prompt de persona auditora financeira fria blindado de alucinações e conselhos especulativos.",
                    "Validação de payloads e medição exata de consumo com tiktoken em rotas assíncronas FastAPI."
                  ]}
                  files={[
                    { name: "coin_ai_router.py", url: "https://github.com/augustoheiss/LogicDefense/blob/main/backend/routers/coin_ai_router.py" },
                    { name: "coin_models.py", url: "https://github.com/augustoheiss/LogicDefense/blob/main/backend/models/coin_models.py" }
                  ]}
                  mathFormula="T_otimizado(N, K) = K * gamma + T_cascade(N) + beta << T_bruto(N)"
                  mathExplanation="Comprime o diário histórico em sumários mensais/trimestrais, estabilizando os tokens em níveis baixos."
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── SECTION 5: JUSTIFICATION & CODE COMMITMENT ── */}
        <Section className="border-b border-white/5 bg-slate-950/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                🛡️ Justificativa Contábil & Retorno
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                Por que aplicar estas técnicas em produção?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Estes conceitos não são apenas exercícios acadêmicos teóricos. Ao aplicar a compactação de RAG em 4 Tiers ensinada no Módulo 5, você reduzirá o tamanho médio dos payloads de IA no backend em até <strong>85%</strong>. Se o seu SaaS de IA atende a centenas de consultas diárias, a economia na fatura de nuvem se paga nas primeiras semanas de deploy.
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-500/10 bg-indigo-500/[0.02] p-6 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>🔒</span> Compromisso com a Excelência de Código
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Este repositório é fornecido de forma aberta e transparente. Você pode explorar a base de código, testar os motores de cálculo localmente e rodar a suíte de testes contendo asserções de integridade temporal e compressão. O código está aberto para inspeção e reutilização comercial em seus próprios projetos.
              </p>
            </div>
          </div>
        </Section>

        {/* ── SECTION 6: CALL TO ACTION (CTA) ── */}
        <Section className="border-b border-white/5 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
              Pronto para dominar a Engenharia de Sistemas Financeiros?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
              Acesse a base de código-fonte aberta no nosso repositório local e contribua com melhorias.
            </p>

            <div className="pt-2 space-y-3">
              <a
                href="https://github.com/augustoheiss/LogicDefense"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/10 inline-flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base uppercase"
              >
                🚀 DOMINAR A ENGENHARIA DO TEMPO
              </a>
              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <span>📦</span> Código Licenciado sob Termos de Uso Aberto e Colaborativo: https://github.com/augustoheiss/LogicDefense
              </div>
            </div>
          </div>
        </Section>

        {/* SEÇÃO: PERGUNTAS FREQUENTES (FAQ) - ALTO CONTRASTE */}
        <section className="mt-20 w-full max-w-4xl mx-auto px-4 mb-16">
          <div className="border-t border-indigo-500/15 pt-12">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-8 flex items-center gap-2 font-outfit">
              <span className="text-emerald-400">💬</span> Perguntas Frequentes
            </h2>
            
            <div className="space-y-6">
              {/* Pergunta 1 */}
              <div className="p-5 rounded-xl bg-slate-900/50 border border-indigo-500/10 backdrop-blur-sm transition-all hover:border-indigo-500/20">
                <h3 className="text-lg font-semibold text-emerald-400 font-outfit mb-2">
                  1. A masterclass e a base de código são mesmo gratuitas?
                </h3>
                <p className="text-base text-slate-300 leading-relaxed font-inter">
                  Sim, 100% grátis e open-source. Todo o conteúdo de estudos, os manuais técnicos dos módulos e a base de código do Assistente-Moeda estão livres e abertos para leitura, auditoria e utilização em seus sistemas, sem pegadinhas.
                </p>
              </div>

              {/* Pergunta 2 */}
              <div className="p-5 rounded-xl bg-slate-900/50 border border-indigo-500/10 backdrop-blur-sm transition-all hover:border-indigo-500/20">
                <h3 className="text-lg font-semibold text-emerald-400 font-outfit mb-2">
                  2. Como posso testar os motores contábeis e as lógicas de predição do código?
                </h3>
                <p className="text-base text-slate-300 leading-relaxed font-inter">
                  Você pode rodar as suítes de testes locais instaladas no projeto. Para a parte frontend em React/TypeScript, utilize <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 border border-white/5 text-sm">npm run test</code> ou o testador do Vitest. Para a parte de IA e backend em Python, execute <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 border border-white/5 text-sm">python -m pytest</code> a partir do diretório do backend para rodar os testes de tokens e validação.
                </p>
              </div>

              {/* Pergunta 3 */}
              <div className="p-5 rounded-xl bg-slate-900/50 border border-indigo-500/10 backdrop-blur-sm transition-all hover:border-indigo-500/20">
                <h3 className="text-lg font-semibold text-emerald-400 font-outfit mb-2">
                  3. Preciso dominar matemática avançada para compreender a documentação?
                </h3>
                <p className="text-base text-slate-300 leading-relaxed font-inter">
                  Não. Toda a matemática envolvida (como desvios estatísticos descritivos e prorações lineares) é explicada conceitualmente nos manuais e fornecida de forma programática. O foco principal é ensinar como traduzir essas equações matemáticas em algoritmos eficientes em TypeScript e Python.
                </p>
              </div>

              {/* Pergunta 4 */}
              <div className="p-5 rounded-xl bg-slate-900/50 border border-indigo-500/10 backdrop-blur-sm transition-all hover:border-indigo-500/20">
                <h3 className="text-lg font-semibold text-emerald-400 font-outfit mb-2">
                  4. Posso utilizar estas classes em projetos comerciais próprios?
                </h3>
                <p className="text-base text-slate-300 leading-relaxed font-inter">
                  Sim. O ecossistema está licenciado sob termos permissivos de código aberto, permitindo que você adapte os loops contínuos de tempo e os algoritmos de netting nos seus próprios SaaS e sistemas de gestão financeira.
                </p>
              </div>
            </div>

            {/* Link de retorno higienizado */}
            <div className="mt-12 text-center">
              <button 
                onClick={scrollToTop}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-emerald-400 transition-colors bg-transparent border-0 cursor-pointer"
              >
                <span>↑</span> Voltar para o Dashboard
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
