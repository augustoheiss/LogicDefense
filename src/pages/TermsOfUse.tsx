import { useState } from 'react';

export default function TermsOfUse() {
  const [activeSection, setActiveSection] = useState('aceite');

  const sections = [
    { id: 'aceite', label: '1. Aceite dos Termos' },
    { id: 'descricao', label: '2. Descrição do Serviço' },
    { id: 'assinaturas', label: '3. Planos e Faturamento' },
    { id: 'politica-reembolso', label: '4. Reembolsos' },
    { id: 'motor-ia-disclaimer', label: '5. Isenção de Responsabilidade (IA)' },
    { id: 'propriedade', label: '6. Propriedade Intelectual' },
    { id: 'rescisao', label: '7. Descontinuidade do Uso' },
    { id: 'alteracoes', label: '8. Alterações dos Termos' },
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
            📜
          </div>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '-0.02em',
            marginBottom: '8px',
          }}>
            Termos de Uso
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
            Última atualização: 2 de Agosto de 2026
          </p>
        </header>

        {/* Content Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 280px) 1fr',
          gap: '40px',
        }} className="terms-layout">
          {/* Sidebar Navigation */}
          <aside style={{
            position: 'sticky',
            top: '40px',
            alignSelf: 'start',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }} className="terms-sidebar">
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
            {/* Aceite dos Termos */}
            <section id="aceite" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                1. Aceite dos Termos
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Bem-vindo ao <strong>Assistente Moeda</strong>. Ao utilizar o aplicativo, adquirir uma licença de uso PRO ou utilizar de qualquer forma nossas ferramentas financeiras, você declara ter lido, compreendido e aceitado integralmente estes <strong>Termos de Uso</strong> e a nossa <strong>Política de Privacidade</strong>.
              </p>
              <p>
                Estes Termos constituem um contrato vinculante entre você e a <strong>Heiss-Lab</strong>. Caso não concorde com qualquer disposição aqui estabelecida, solicitamos que não utilize o aplicativo ou seus serviços correlatos.
              </p>
            </section>

            {/* Descrição do Serviço */}
            <section id="descricao" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                2. Descrição do Serviço e Armazenamento Local
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O Assistente Moeda é um assistente financeiro pessoal focado no monitoramento e cálculo de fluxo de caixa, despesas, receitas, investimentos e planejamento de longo prazo.
              </p>
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderLeft: '4px solid #10b981',
                padding: '16px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
                lineHeight: '1.6',
              }}>
                <strong>🛡️ Armazenamento 100% Local no Dispositivo:</strong> Para a máxima segurança e privacidade do proprietário e dos usuários, <strong>todas as suas informações financeiras e planilhas ficam salvas unicamente no armazenamento local do seu próprio dispositivo</strong>. Os dados financeiros não são salvos em nenhum banco de dados na nuvem da Heiss-Lab nem compartilhados com servidores remotos.
              </div>
            </section>

            {/* Planos e Faturamento */}
            <section id="assinaturas" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                3. Planos, Faturamento e Acúmulo de Renovações
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Disponibilizamos planos pagos sob assinatura (Mensal e Anual) para liberação de consultas com a Inteligência Artificial (Chat IA):
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Acúmulo de Expiração e Tokens:</strong> Caso o usuário adquira o plano mensal ou anual mais de uma vez ou renove antes da expiração de um plano vigente, o sistema <strong>não sobrescreve o período anterior</strong>. O novo tempo contratado (30 dias ou 365 dias) é <strong>adicionado cumulativamente à data de expiração restante</strong>, e a cota de tokens é somada ao saldo ativo.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Processamento Móvel:</strong> Em dispositivos móveis, o faturamento é processado com segurança via <strong>Google Play Billing</strong> e operacionalizado via <strong>RevenueCat</strong>.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Processamento Web:</strong> Assinaturas adquiridas na interface web são processadas pelo gateway internacional <strong>Stripe</strong>.
                </li>
              </ul>
              <p>
                Você pode desativar a renovação automática da sua assinatura a qualquer momento acessando a seção de assinaturas da sua Conta Google Play (para compras em Android) ou a interface de faturamento da Stripe (para compras na web).
              </p>
            </section>

            {/* Política de Reembolso */}
            <section id="politica-reembolso" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                4. Reembolsos
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Como o aplicativo utiliza serviços de terceiros para o gerenciamento de pagamentos, as regras de reembolso variam conforme a plataforma de aquisição:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Compras via Google Play:</strong> Reembolsos devem ser solicitados diretamente ao suporte da Google Play, seguindo as diretrizes e prazos de devolução da plataforma.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Compras via Web (Stripe):</strong> Em conformidade com o Código de Defesa do Consumidor brasileiro, garantimos o direito de arrependimento e reembolso integral das assinaturas em até 7 (sete) dias contados a partir da data de compra inicial. Para solicitar o reembolso web, entre em contato pelo email de suporte.
                </li>
              </ul>
            </section>

            {/* Isenção de Responsabilidade IA */}
            <section id="motor-ia-disclaimer" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                5. Isenção de Responsabilidade (IA)
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O Assistente Moeda conta com um módulo de inteligência artificial de previsão financeira intitulado <strong>God Mode</strong>.
              </p>
              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                borderLeft: '4px solid #f59e0b',
                padding: '16px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
                marginBottom: '16px',
                lineHeight: '1.6',
              }}>
                <strong>AVISO IMPORTANTE AOS USUÁRIOS:</strong> O God Mode fornece projeções e análises baseadas estritamente em modelos estatísticos e matemáticos com fins puramente informativos e educacionais. <strong>Nenhuma informação gerada pelo aplicativo constitui conselho profissional de investimentos, consultoria financeira oficial ou recomendação certified de compra/venda.</strong> A Heiss-Lab e seus desenvolvedores não se responsabilizam por decisões tomadas com base nas previsões do aplicativo, nem por eventuais prejuízos ou perdas financeiras decorrentes do uso da plataforma.
              </div>
            </section>

            {/* Propriedade Intelectual */}
            <section id="propriedade" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                6. Propriedade Intelectual
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O código-fonte, layout visual, design gráfico, marcas, logotipos e toda a tecnologia do aplicativo Assistente Moeda pertencem exclusivamente à <strong>Heiss-Lab</strong>.
              </p>
              <p>
                Qualquer reprodução, modificação, engenharia reversa ou exploração comercial não autorizada do aplicativo é expressamente proibida e está sujeita às penalidades cabíveis pela lei de direitos autorais e propriedade industrial brasileira.
              </p>
            </section>

            {/* Rescisão e Descontinuidade */}
            <section id="rescisao" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                7. Descontinuidade do Uso e Limpeza de Dados
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Como os dados financeiros residem unicamente no seu próprio dispositivo (LocalStorage / AsyncStorage local), você possui controle total e pode interromper o uso do aplicativo a qualquer momento.
              </p>
              <p>
                Para remover permanentemente todos os seus lançamentos e planilhas, basta acionar a opção de limpar dados nas Configurações do próprio aplicativo ou desinstalar o app do seu aparelho, o que apagará instantaneamente todos os registros locais do seu dispositivo.
              </p>
            </section>

            {/* Alterações dos Termos */}
            <section id="alteracoes" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                8. Alterações dos Termos
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Reservamo-nos o direito de alterar estes Termos de Uso periodicamente para refletir mudanças tecnológicas, operacionais ou regulamentares.
              </p>
              <p>
                Notificaremos você sobre modificações substanciais publicando os termos revisados no aplicativo com antecedência razoável ou exibindo um aviso em destaque na tela de boas-vindas do app. A continuidade do uso do app após a entrada em vigor dos novos Termos implica em seu aceite automático.
              </p>
            </section>
          </main>
        </div>
      </div>

      {/* CSS overrides for responsive grid layout without heavy CSS file */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .terms-layout {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          .terms-sidebar {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
