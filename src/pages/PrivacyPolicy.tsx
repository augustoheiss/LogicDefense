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
                Esta Política de Privacidade regulamenta a forma como a <strong>Heiss-Lab</strong> ("nós", "nosso") garante a privacidade e a segurança integral dos dados dos usuários ("você", "usuário") do aplicativo <strong>Assistente Moeda</strong> e seus serviços associados.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Nosso compromisso fundamental é assegurar a máxima privacidade, transparência e conformidade integral com a <strong>Lei Geral de Proteção de Dados (LGPD)</strong> (Lei nº 13.709/2018).
              </p>
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderLeft: '4px solid #10b981',
                padding: '20px',
                borderRadius: '0 8px 8px 0',
                fontSize: '15px',
                lineHeight: '1.6',
              }}>
                <strong>🛡️ Garantia de Privacidade Absoluta e Armazenamento Local:</strong> Para a máxima segurança do proprietário e de todos os usuários, <strong>todas as suas planilhas, transações, receitas, despesas e metas financeiras são armazenadas exclusivamente de forma local no seu próprio dispositivo</strong>. Nenhum dado financeiro ou planilha é salvo, armazenado ou mantido em nenhum banco de dados remoto ou servidor externo.
              </div>
            </section>

            {/* Dados Coletados */}
            <section id="dados-coletados" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                2. Armazenamento Local de Dados
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O Assistente Moeda foi projetado sob a arquitetura <em>Local-First Security</em>:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Dados Financeiros e Planilhas:</strong> Registros informados por você (como lançamentos, fluxo de caixa, aportes e metas) residem unicamente no armazenamento interno do seu aparelho (LocalStorage / AsyncStorage local).
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Zero Banco de Dados Remoto:</strong> Nós não mantemos nem possuímos acesso a nenhum banco de dados de planilhas financeiras dos usuários em nossos servidores.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Chaves de Licença (PRO):</strong> Nosso servidor armazena unicamente o registro hash criptográfico da sua Chave de Licença PRO para autenticação de saldo de tokens e validade do plano contratado.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Dados de Pagamento:</strong> Processados diretamente por gateways seguros (Stripe para Web e Google Play / RevenueCat para dispositivos móveis). Não armazenamos informações brutas de cartão de crédito.
                </li>
              </ul>
            </section>

            {/* Finalidades do Tratamento */}
            <section id="finalidades" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                3. Processamento e Autonomia do Usuário
              </h2>
              <p style={{ marginBottom: '16px' }}>
                A arquitetura local garante autonomia completa sobre seus dados:
              </p>
              <ol style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'decimal' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Controle Total:</strong> Você pode exportar, limpar ou apagar todos os seus registros financeiros a qualquer momento diretamente na interface do app.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Inexistência de Vazamento de Dados na Nuvem:</strong> Como suas planilhas não são salvas em bancos de dados remotos, seus registros financeiros estão imunes a vazamentos de servidores centrais.
                </li>
              </ol>
            </section>

            {/* Motor de IA (God Mode) */}
            <section id="motor-ia" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                4. Motor de IA e Consultas Em Memória (Stateless)
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O Assistente de IA utiliza Inteligência Artificial avançada para gerar diagnósticos e insights sobre suas métricas:
              </p>
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                borderLeft: '4px solid #3b82f6',
                padding: '16px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
                marginBottom: '16px',
              }}>
                <strong>Declaração de Processamento Stateless (Em Memória):</strong> Ao realizar perguntas no Chat de IA, os dados necessários para o cálculo da resposta são transmitidos de forma temporária e criptografada (HTTPS/TLS) e processados estritamente em memória em tempo de execução. <strong>Os dados são imediatamente descartados após a resposta e jamais são salvos em banco de dados ou utilizados para treinamento de modelos de IA de terceiros.</strong>
              </div>
            </section>

            {/* Pagamentos e Assinaturas */}
            <section id="pagamentos" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                5. Pagamentos e Acúmulo de Assinaturas
              </h2>
              <p style={{ marginBottom: '16px' }}>
                As compras de assinaturas Pro (mensais ou anuais) são integradas via Stripe (Web) e Google Play / RevenueCat (Mobile):
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Renovações Cumulativas:</strong> Caso o usuário adquira novos planos ou renovações com uma licença ativa, a nova validade é <strong>adicionada cumulativamente</strong> à data de expiração existente, e o saldo de tokens é somado sem perdas.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Conformidade PCI-DSS:</strong> Todos os pagamentos cumprem os mais rigorosos padrões internacionais de segurança bancária.
                </li>
              </ul>
            </section>

            {/* Seus Direitos (LGPD) */}
            <section id="direitos-lgpd" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                6. Seus Direitos (LGPD)
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Pela arquitetura local do aplicativo, você possui pleno domínio sobre seus dados:
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ color: '#fff', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>📥 Armazenamento no Dispositivo</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Seus registros pertencem 100% ao seu dispositivo, com controle total do usuário.</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ color: '#10b981', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>🔒 Privacidade Absoluta</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Nenhum histórico financeiro é armazenado em banco de dados remoto.</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ color: '#ef4444', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>❌ Limpeza Instantânea</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Você pode limpar o cachê e dados do app instantaneamente nas configurações.</p>
                </div>
              </div>
            </section>

            {/* Segurança dos Dados */}
            <section id="seguranca" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                7. Segurança dos Dados
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Medidas técnicas adotadas no Assistente Moeda:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>Isolamento sandbox no dispositivo móvel/navegador do próprio usuário.</li>
                <li style={{ marginBottom: '8px' }}>Comunicação de chamadas de IA via protocolo criptografado HTTPS/TLS.</li>
                <li style={{ marginBottom: '8px' }}>Autenticação segura via Chave de Licença hash SHA-256 no backend.</li>
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
