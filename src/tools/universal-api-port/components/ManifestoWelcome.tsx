/**
 * ManifestoWelcome — High-converting landing page for the Universal API Port.
 *
 * Before-After-Bridge (BAB) copywriting framework:
 *   1. Hero (Above the Fold) — Bold claim + CTA
 *   2. Before (Pain) — Current state of suffering
 *   3. After (Outcome) — The vision of API-First
 *   4. Bridge (Product) — How the pipeline actually works
 *
 * Scrolls into SchemaLoader on CTA click.
 */

import { useRef } from 'react';
import { SchemaLoader } from './SchemaLoader';

export function ManifestoWelcome() {
  const loaderRef = useRef<HTMLDivElement>(null);

  const scrollToLoader = () => {
    loaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Focus the textarea after scroll
    setTimeout(() => {
      const textarea = loaderRef.current?.querySelector('textarea');
      textarea?.focus();
    }, 500);
  };

  return (
    <div className="uap-manifesto">

      {/* ═══════════════════════════════════════════════════════════
       *  Section 1 — HERO (Above the Fold)
       * ═══════════════════════════════════════════════════════════ */}
      <section className="uap-manifesto__hero">
        <div className="uap-manifesto__hero-glow" aria-hidden="true" />

        <p className="uap-manifesto__kicker">Assistente Escola Modelo — Porta USB Universal</p>

        <h1 className="uap-manifesto__headline">
          O Fim do Monopólio<br />da Interface Gráfica.
        </h1>

        <p className="uap-manifesto__subheadline">
          Os servidores da educação pública estão colapsando sob o peso de sistemas
          monolíticos. O Assistente Escola Modelo é uma <strong>"Porta USB Universal"</strong> que
          descentraliza o processamento, alivia servidores públicos e extrai a verdade
          absoluta dos dados em milissegundos.
        </p>

        <div className="uap-manifesto__pillars">
          <div className="uap-manifesto__pillar">
            <span className="uap-manifesto__pillar-icon">⚡</span>
            <div>
              <strong>Descentralização de Processamento</strong>
              <span>Client-Side Rendering</span>
            </div>
          </div>
          <div className="uap-manifesto__pillar">
            <span className="uap-manifesto__pillar-icon">🪶</span>
            <div>
              <strong>Alívio Imediato de Servidores Públicos</strong>
              <span>Trafegando apenas JSON</span>
            </div>
          </div>
          <div className="uap-manifesto__pillar">
            <span className="uap-manifesto__pillar-icon">🎯</span>
            <div>
              <strong>Verdade em Tempo Real</strong>
              <span>Zero duplicação, sem cache</span>
            </div>
          </div>
        </div>

        <button onClick={scrollToLoader} className="uap-manifesto__cta">
          🔌 Carregar Cardápio OpenAPI
        </button>
      </section>

      {/* ═══════════════════════════════════════════════════════════
       *  Section 2 — BEFORE (The Pain)
       * ═══════════════════════════════════════════════════════════ */}
      <section className="uap-manifesto__section uap-manifesto__section--before">
        <div className="uap-manifesto__section-label">O Problema</div>
        <h2 className="uap-manifesto__section-title">
          Quando o Sistema Vira o Obstáculo.
        </h2>

        <div className="uap-manifesto__cards">
          <div className="uap-manifesto__card uap-manifesto__card--pain">
            <div className="uap-manifesto__card-icon">🔥</div>
            <h3>Servidores Sobrecarregados</h3>
            <p>
              O modelo atual exige que servidores estaduais renderizem telas pesadas
              para dezenas de milhares de professores simultaneamente. O resultado?
              <strong> Lentidão, travamentos e burocracia.</strong>
            </p>
          </div>

          <div className="uap-manifesto__card uap-manifesto__card--pain">
            <div className="uap-manifesto__card-icon">🪦</div>
            <h3>O Arquivo Morto</h3>
            <p>
              Historicamente, sistemas escolares funcionam como um cemitério digital.
              Dados estáticos que servem apenas para auditar o passado ou procurar culpados,
              <strong> sem gerar valor real para o aluno.</strong>
            </p>
          </div>
        </div>

        <blockquote className="uap-manifesto__belief">
          <span className="uap-manifesto__belief-icon">💡</span>
          <div>
            <p className="uap-manifesto__belief-label">Desconstrução de Crença</p>
            <p>
              Muitos acreditam que a solução é comprar servidores mais caros ou refazer
              o sistema do zero. A verdade é que <strong>a interface visual inteira precisa
              ser separada do banco de dados.</strong>
            </p>
          </div>
        </blockquote>
      </section>

      {/* ═══════════════════════════════════════════════════════════
       *  Section 3 — AFTER (The Desired Outcome)
       * ═══════════════════════════════════════════════════════════ */}
      <section className="uap-manifesto__section uap-manifesto__section--after">
        <div className="uap-manifesto__section-label">A Visão</div>
        <h2 className="uap-manifesto__section-title">
          A Fronteira da Gestão API-First.
        </h2>

        <div className="uap-manifesto__cards">
          <div className="uap-manifesto__card uap-manifesto__card--outcome">
            <div className="uap-manifesto__card-icon">🏆</div>
            <h3>Ouro Operacional</h3>
            <p>
              O sistema deixa de ser uma ferramenta passiva de entrada de dados e se torna
              <strong> o alicerce vivo da escola</strong>, orientado a eventos em tempo real.
            </p>
          </div>

          <div className="uap-manifesto__card uap-manifesto__card--outcome">
            <div className="uap-manifesto__card-icon">🧠</div>
            <h3>Terreno para IA</h3>
            <p>
              Uma base limpa, leve e estruturada em linguagem de máquina.
              <strong> O ecossistema perfeito para agentes de Inteligência Artificial</strong> analisarem
              dados e gerarem insights pedagógicos.
            </p>
          </div>
        </div>

        <blockquote className="uap-manifesto__paradigm">
          <p>
            <em>"Não armazene a interface. Extraia apenas a verdade."</em>
          </p>
          <p>
            Guiados pelos princípios de <strong>Transparência e Verificação</strong>, nós criamos
            um cliente 100% dinâmico.
          </p>
        </blockquote>
      </section>

      {/* ═══════════════════════════════════════════════════════════
       *  Section 4 — BRIDGE (How It Works)
       * ═══════════════════════════════════════════════════════════ */}
      <section className="uap-manifesto__section uap-manifesto__section--bridge">
        <div className="uap-manifesto__section-label">A Arquitetura</div>
        <h2 className="uap-manifesto__section-title">
          Como a Porta USB Funciona <span className="uap-manifesto__badge">Zero Hardcode</span>
        </h2>

        <div className="uap-manifesto__pipeline">
          <div className="uap-manifesto__step">
            <div className="uap-manifesto__step-num">1</div>
            <div className="uap-manifesto__step-body">
              <h4>OpenAPI Schema</h4>
              <p>A Fonte de Verdade</p>
              <code>schema.json / schema.yaml</code>
            </div>
          </div>
          <div className="uap-manifesto__step-arrow" aria-hidden="true">▼</div>

          <div className="uap-manifesto__step">
            <div className="uap-manifesto__step-num">2</div>
            <div className="uap-manifesto__step-body">
              <h4>Schema Parser</h4>
              <p>Lê e valida o contrato</p>
              <code>schemaParser.ts + schemaValidator.ts</code>
            </div>
          </div>
          <div className="uap-manifesto__step-arrow" aria-hidden="true">▼</div>

          <div className="uap-manifesto__step">
            <div className="uap-manifesto__step-num">3</div>
            <div className="uap-manifesto__step-body">
              <h4>UI Renderer</h4>
              <p>Gera formulários dinamicamente, sem regras fixas</p>
              <code>DynamicForm.tsx + EndpointCard.tsx</code>
            </div>
          </div>
          <div className="uap-manifesto__step-arrow" aria-hidden="true">▼</div>

          <div className="uap-manifesto__step">
            <div className="uap-manifesto__step-num">4</div>
            <div className="uap-manifesto__step-body">
              <h4>API Executor</h4>
              <p>Busca o dado cru com Transparência Total</p>
              <code>apiExecutor.ts → fetch() → ResponseViewer</code>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
       *  Section 5 — SCHEMA LOADER (CTA Target)
       * ═══════════════════════════════════════════════════════════ */}
      <div ref={loaderRef} className="uap-manifesto__loader-section">
        <SchemaLoader />
      </div>
    </div>
  );
}
