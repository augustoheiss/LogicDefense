import { useState } from 'react';

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState('introducao');

  const sections = [
    { id: 'introducao', label: '1. Introdução & LGPD' },
    { id: 'arquitetura-turso', label: '2. Arquitetura Turso & Local-First' },
    { id: 'dados-coletados', label: '3. Dados Coletados & Zero PII' },
    { id: 'controlador-operador', label: '4. Papéis: Usuário como Controlador' },
    { id: 'motor-ia', label: '5. Motor de IA (Stateless)' },
    { id: 'pagamentos', label: '6. Pagamentos e Assinaturas' },
    { id: 'direitos-lgpd', label: '7. Seus Direitos e Exclusão' },
    { id: 'contato', label: '8. Encarregado de Dados (DPO)' },
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
            🛡️
          </div>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.02em',
            marginBottom: '8px',
          }}>
            Política de Privacidade & Governança de Dados
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.6)',
            maxWidth: '700px',
            margin: '0 auto',
            lineHeight: '1.5',
          }}>
            Heiss-Lab · LogicDefense & Assistente Moeda · Conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018)
          </p>
          <p style={{
            fontSize: '13px',
            color: '#a855f7',
            fontWeight: '600',
            marginTop: '12px',
          }}>
            Última atualização: 25 de Agosto de 2026
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
              Sumário de Privacidade
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
                1. Introdução & Compromisso de Privacidade
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Esta Política de Privacidade estabelece os termos em que a <strong>Heiss-Lab</strong> ("nós", "plataforma") protege e trata as informações dos usuários ("você", "usuário") no portal <strong>Heiss-Lab / LogicDefense</strong>, no aplicativo móvel <strong>Assistente Moeda</strong> e nas APIs correlatas.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Nossa arquitetura foi desenhada segundo o princípio de <strong>Privacy by Design (Privacidade por Padrão)</strong>, em estrita conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018)</strong> e os mais elevados padrões internacionais de segurança.
              </p>
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderLeft: '4px solid #10b981',
                padding: '20px',
                borderRadius: '0 8px 8px 0',
                fontSize: '15px',
                lineHeight: '1.6',
              }}>
                <strong>🛡️ Arquitetura de Não-Custódia de Identidade (Zero PII):</strong> Não realizamos coleta nem armazenamento de dados de identificação pessoal civil (como e-mail de login centralizado, CPF ou senhas em texto plano). A plataforma opera por <strong>chaves criptográficas isoladas e armazenamento local</strong>.
              </div>
            </section>

            {/* Arquitetura Turso & Local-First */}
            <section id="arquitetura-turso" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                2. Arquitetura de Isolamento (Turso libSQL & Local-First)
              </h2>
              <p style={{ marginBottom: '16px' }}>
                A infraestrutura de dados opera sob um modelo descentralizado e altamente segregado:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Armazenamento no Dispositivo (Local-First):</strong> No aplicativo móvel e portal web, suas preferências e planilhas primárias residem no armazenamento seguro do próprio aparelho do usuário (LocalStorage / SecureStore / AsyncStorage).
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Nuvem Isolada via Turso (libSQL):</strong> Quando a sincronização de planilhas ou chaves de licença é utilizada, os dados são gravados em banco de dados <strong>Turso</strong> vinculados exclusivamente a um hash criptográfico da chave de planilha (<code>X-Spreadsheet-Key</code>). <strong>Não existe tabela de usuários com nomes ou e-mails correlacionados aos lançamentos.</strong>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Segregação Multilocatário Estrita:</strong> Cada chave opera em um escopo independente e inacessível por outros usuários ou chaves de API.
                </li>
              </ul>
            </section>

            {/* Dados Coletados */}
            <section id="dados-coletados" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                3. Dados Tratados & Ausência de Coleta de Menores
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Tratamos estritamente o mínimo indispensável para o funcionamento técnico do serviço:
              </p>
              <ol style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'decimal' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Chaves de Licença e Planilha:</strong> Tokens aleatórios (ex: hash SHA-256) utilizados para validar a cota de uso e a expiração do plano PRO.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Lançamentos e Registros Financeiros:</strong> Valores numéricos, categorias e descrições inseridos por livre e espontânea vontade do usuário para seu próprio controle.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Jogos e Leaderboards (Heiss-Lab):</strong> Os jogos educativos (Logic Defense, Logic Ascension) utilizam pontuações salvas localmente ou com *nicknames* anônimos. <strong>Nenhum dado pessoal de menores de idade é coletado, atendendo integralmente ao Art. 14 da LGPD.</strong>
                </li>
              </ol>
            </section>

            {/* Papéis: Usuário como Controlador */}
            <section id="controlador-operador" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                4. Separação de Papéis: O Usuário como Controlador de Dados
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Em estrita observância aos <strong>Artigos 5º, 37 e 42 da LGPD</strong>:
              </p>
              <div style={{
                backgroundColor: 'rgba(168, 85, 247, 0.08)',
                borderLeft: '4px solid #a855f7',
                padding: '16px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '16px',
              }}>
                <strong>⚖️ O Usuário é o Único e Exclusivo Controlador (Data Controller):</strong> Se você utiliza o Assistente Moeda ou suas APIs para cadastrar, gerenciar ou auditar transações, receitas, clientes ou terceiros vinculados à sua atividade comercial ou pessoal, <strong>você assume a condição integral de Controlador dos Dados perante a LGPD e a ANPD</strong>. Cabe a você assegurar a base legal (Art. 7º) e o consentimento dos titulares envolvidos.
              </div>
              <p>
                A <strong>Heiss-Lab</strong> atua meramente como <strong>Operadora Tecnológica (Data Processor)</strong>, fornecendo a infraestrutura no estado em que se encontra (*AS IS*), sem qualquer ingerência sobre o mérito, veracidade ou legalidade dos dados inseridos.
              </p>
            </section>

            {/* Motor de IA (Stateless) */}
            <section id="motor-ia" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                5. Motor de IA e Consultas Estatísticas em Memória
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O módulo de inteligência analítica opera com processamento transitório (*stateless*):
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  Ao solicitar diagnósticos ou relatórios no Chat de IA, os parâmetros são trafegados via conexão criptografada (HTTPS/TLS) e computados temporariamente em memória.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Zero Treinamento Público:</strong> Seus números e planilhas não são utilizados para treinar modelos de inteligência artificial públicos de terceiros.
                </li>
              </ul>
            </section>

            {/* Pagamentos */}
            <section id="pagamentos" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                6. Pagamentos e Gateways de Faturamento
              </h2>
              <p style={{ marginBottom: '16px' }}>
                As transações comerciais são processadas por operadoras credenciadas e auditadas (PCI-DSS):
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}><strong>Mobile:</strong> Google Play Billing / RevenueCat.</li>
                <li style={{ marginBottom: '8px' }}><strong>Web:</strong> Stripe Payments.</li>
              </ul>
              <p>
                A Heiss-Lab não tem acesso, não coleta e não custodia dados brutos de cartão de crédito ou contas bancárias.
              </p>
            </section>

            {/* Seus Direitos e Exclusão */}
            <section id="direitos-lgpd" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                7. Seus Direitos (LGPD Art. 18) & Exclusão Imediata de Dados
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Em cumprimento ao Art. 18 da LGPD e às diretrizes da Google Play e Apple Store sobre exclusão de conta e dados:
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ color: '#fff', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>📥 Acesso e Exportação</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Exporte suas planilhas e métricas em CSV/JSON a qualquer momento na interface.</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ color: '#10b981', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>🔒 Isolamento Criptográfico</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Seus registros ficam vinculados unicamente à sua chave, sem ligação com seu e-mail pessoal.</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ color: '#ef4444', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>❌ Exclusão Total e Definitiva</h4>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Limpe os dados locais no app ou desative sua chave de API para apagar permanentemente os registros.</p>
                </div>
              </div>
            </section>

            {/* Contato e Encarregado */}
            <section id="contato" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                8. Contato e Encarregado pelo Tratamento de Dados (DPO)
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Para exercer seus direitos como titular de dados ou esclarecer quaisquer dúvidas sobre governança e privacidade:
              </p>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '24px',
              }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#fff' }}>Heiss-Lab / LogicDefense</p>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>Portal Oficial: <a href="https://heisslab.com.br" target="_blank" rel="noopener noreferrer" style={{ color: '#c084fc', textDecoration: 'none' }}>heisslab.com.br</a></p>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>Encarregado pelo Tratamento de Dados (DPO): <a href="mailto:augustoheiss@gmail.com" style={{ color: '#c084fc', textDecoration: 'none' }}>augustoheiss@gmail.com</a></p>
              </div>
            </section>
          </main>
        </div>
      </div>

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
