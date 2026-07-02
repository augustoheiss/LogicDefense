import { useState } from 'react';

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState('introducao');

  const sections = [
    { id: 'introducao', label: '1. Introdução' },
    { id: 'dados-coletados', label: '2. Dados Coletados' },
    { id: 'finalidades', label: '3. Finalidades do Tratamento' },
    { id: 'motor-ia', label: '4. Motor de IA (God Mode)' },
    { id: 'pagamentos', label: '5. Pagamentos e Assinaturas' },
    { id: 'direitos-lgpd', label: '6. Seus Direitos (LGPD)' },
    { id: 'seguranca', label: '7. Segurança dos Dados' },
    { id: 'contato', label: '8. Contato e Encarregado' },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={{
      backgroundColor: '#0d1117',
      color: 'rgba(255, 255, 255, 0.9)',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <header style={{
          textAlign: 'center',
          marginBottom: '60px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '40px',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            fontSize: '32px',
            marginBottom: '16px',
          }}>
            🪙
          </div>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.02em',
            marginBottom: '8px',
          }}>
            Política de Privacidade
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.6)',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: '1.5',
          }}>
            Assistente Moeda · Desenvolvido por Heiss-Lab
          </p>
          <p style={{
            fontSize: '13px',
            color: '#a855f7',
            fontWeight: '600',
            marginTop: '12px',
          }}>
            Última atualização: 2 de Julho de 2026
          </p>
        </header>

        {/* Content Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 280px) 1fr',
          gap: '40px',
        }} className="privacy-layout">
          {/* Sidebar Navigation */}
          <aside style={{
            position: 'sticky',
            top: '40px',
            alignSelf: 'start',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }} className="privacy-sidebar">
            <h3 style={{
              fontSize: '12px',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.4)',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              paddingLeft: '12px',
            }}>
              Sumário
            </h3>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: activeSection === section.id ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                  color: activeSection === section.id ? '#c084fc' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: activeSection === section.id ? '600' : '400',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {section.label}
              </button>
            ))}
          </aside>

          {/* Main Document Body */}
          <main style={{
            lineHeight: '1.7',
            fontSize: '15px',
            color: 'rgba(255, 255, 255, 0.8)',
          }}>
            {/* Introdução */}
            <section id="introducao" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                1. Introdução
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Esta Política de Privacidade regulamenta a forma como a <strong>Heiss-Lab</strong> ("nós", "nosso"), na qualidade de Controladora de Dados, coleta, armazena, processa, utiliza e protege as informações pessoais dos usuários ("você", "usuário") do aplicativo móvel <strong>Assistente Moeda</strong> e seus serviços associados.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Nosso compromisso fundamental é assegurar a transparência, segurança e a conformidade integral com a <strong>Lei Geral de Proteção de Dados (LGPD)</strong> (Lei nº 13.709/2018) e com as diretrizes da Autoridade Nacional de Proteção de Dados (ANPD).
              </p>
              <p>
                Ao utilizar o Assistente Moeda, você declara estar ciente dos termos desta Política. Caso opte por utilizar o aplicativo no "Modo Visitante" (Guest Mode), seus dados financeiros serão armazenados exclusivamente de forma local em seu dispositivo, sem qualquer sincronização com nossos servidores em nuvem.
              </p>
            </section>

            {/* Dados Coletados */}
            <section id="dados-coletados" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                2. Dados Coletados
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Dependendo da sua forma de interação com o aplicativo, coletamos as seguintes categorias de dados:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Dados de Cadastro e Autenticação:</strong> Endereço de email e credenciais de acesso fornecidos espontaneamente no ato de criação de conta.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Dados Financeiros de Fluxo de Caixa:</strong> Registros informados por você, incluindo receitas, despesas, aportes, investimentos e metas financeiras.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Dados de Transações e Pagamentos:</strong> Histórico de planos contratados e status da assinatura. Não armazenamos informações brutas de cartão de crédito.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Metadados de Uso:</strong> Registro de interações, volumetria de requisições de inteligência artificial e diagnósticos técnicos para suporte do app.
                </li>
              </ul>
              <div style={{
                backgroundColor: 'rgba(168, 85, 247, 0.05)',
                borderLeft: '4px solid #a855f7',
                padding: '16px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
              }}>
                <strong>Nota Importante sobre Supabase:</strong> Os dados de autenticação e banco de dados são estruturados e transmitidos utilizando criptografia TLS em trânsito e criptografados em repouso nos servidores do <strong>Supabase</strong>, garantindo alto nível de resiliência e confidencialidade.
              </div>
            </section>

            {/* Finalidades do Tratamento */}
            <section id="finalidades" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                3. Finalidades do Tratamento
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O tratamento de seus dados é balizado pelas seguintes bases legais da LGPD (Artigo 7º):
              </p>
              <ol style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'decimal' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Execução de Contrato:</strong> Para autenticar sua conta, sincronizar seu histórico financeiro entre múltiplos dispositivos e viabilizar a utilização das funcionalidades contratadas.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Legítimo Interesse:</strong> Para melhorar o desempenho do software, prevenir fraudes e solucionar bugs de estabilidade operacional.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Consentimento:</strong> Solicitado expressamente para o processamento de previsões avançadas pela nossa Inteligência Artificial ou envio de comunicações de suporte.
                </li>
              </ol>
            </section>

            {/* Motor de IA (God Mode) */}
            <section id="motor-ia" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                4. Motor de IA (God Mode)
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O recurso <strong>God Mode</strong> utiliza modelos de linguagem gerativos e algoritmos preditivos avançados para analisar suas receitas, despesas e comportamento de fluxo de caixa, gerando simulações de longo prazo e análises de break-even.
              </p>
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                borderLeft: '4px solid #3b82f6',
                padding: '16px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
                marginBottom: '16px',
              }}>
                <strong>Declaração de Exclusividade da IA:</strong> Suas métricas financeiras são processadas através da API de IA de forma estritamente isolada e com finalidade exclusiva de gerar os seus insights pessoais dentro do aplicativo. O histórico de conversas e fluxos financeiros <strong>não são compartilhados publicamente nem utilizados para o treinamento de modelos globais de Inteligência Artificial</strong>.
              </div>
            </section>

            {/* Pagamentos e Assinaturas */}
            <section id="pagamentos" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                5. Pagamentos e Assinaturas
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Para viabilizar a contratação de planos Pro (mensais ou anuais), utilizamos prestadores de serviços de pagamento amplamente consolidados no mercado:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Stripe:</strong> Responsável pelo processamento seguro na interface web.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>RevenueCat e Google Play Billing:</strong> Responsáveis pelo faturamento, controle de recibos e renovação automática de assinaturas nos dispositivos móveis Android.
                </li>
              </ul>
              <p>
                Os provedores de pagamento operam sob conformidade estrita da norma de segurança PCI-DSS. A Heiss-Lab não armazena, visualiza ou retém dados de cartões de crédito em seus servidores de banco de dados.
              </p>
            </section>

            {/* Seus Direitos (LGPD) */}
            <section id="direitos-lgpd" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                6. Seus Direitos (LGPD)
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Em conformidade com o Artigo 18 da LGPD, você detém controle total sobre os seus dados, possuindo os seguintes direitos fundamentais:
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ color: '#fff', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>📥 Acesso e Exportação</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Direito de obter confirmação do processamento e exportar todos os seus dados em formato legível.</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ color: '#fff', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>✏️ Retificação</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Direito de requerer a correção imediata de dados incompletos, inexatos ou desatualizados.</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ color: '#ef4444', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>❌ Exclusão Completa</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Direito de solicitar a eliminação definitiva de todos os registros pessoais dos servidores da nuvem.</p>
                </div>
              </div>
              <p>
                A solicitação de exclusão de conta pode ser realizada diretamente dentro das Configurações do aplicativo de maneira instantânea ou mediante contato por email.
              </p>
            </section>

            {/* Segurança dos Dados */}
            <section id="seguranca" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                7. Segurança dos Dados
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Empregamos salvaguardas técnicas apropriadas para mitigar riscos de acessos não autorizados, perdas acidentais, destruição ou vazamentos:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>Criptografia AES-256 no armazenamento persistente do banco de dados.</li>
                <li style={{ marginBottom: '8px' }}>Autenticação segura via JSON Web Tokens (JWT) e Row Level Security (RLS) no Supabase.</li>
                <li style={{ marginBottom: '8px' }}>Tráfego integral de requisições sobre protocolo criptografado HTTPS/TLS.</li>
              </ul>
            </section>

            {/* Contato e Encarregado */}
            <section id="contato" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                8. Contato e Encarregado
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Se tiver qualquer dúvida sobre esta política ou se desejar exercer qualquer um de seus direitos como titular de dados, entre em contato diretamente com nosso Encarregado pelo Tratamento de Dados Pessoais (DPO):
              </p>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '24px',
              }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#fff' }}>Heiss-Lab</p>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>Website: <a href="http://www.heisslab.com.br" target="_blank" rel="noopener noreferrer" style={{ color: '#c084fc', textDecoration: 'none' }}>www.heisslab.com.br</a></p>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>Canal de Privacidade / DPO: <a href="mailto:augustoheiss@gmail.com" style={{ color: '#c084fc', textDecoration: 'none' }}>augustoheiss@gmail.com</a></p>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* CSS overrides for responsive grid layout without heavy CSS file */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .privacy-layout {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          .privacy-sidebar {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
