import { useState } from 'react';

export default function TermsOfUse() {
  const [activeSection, setActiveSection] = useState('aceite');

  const sections = [
    { id: 'aceite', label: '1. Aceite dos Termos' },
    { id: 'descricao', label: '2. Descrição dos Serviços & Ecossistema' },
    { id: 'responsabilidade-usuario', label: '3. Responsabilidade do Usuário (Controlador)' },
    { id: 'chaves-api', label: '4. Custódia de Chaves de API' },
    { id: 'disclaimer-financeiro', label: '5. Isenção Financeira & Não-CVM' },
    { id: 'aulas-ia', label: '6. Repositório de Aulas, Vídeos com IA & Isenção Pedagógica' },
    { id: 'garantia-as-is', label: '7. Garantia AS IS & Limitação de Responsabilidade' },
    { id: 'indenizacao', label: '8. Cláusula de Indenização (Hold Harmless)' },
    { id: 'assinaturas', label: '9. Planos, Pagamentos e Reembolsos' },
    { id: 'propriedade', label: '10. Propriedade Intelectual & Licença CC' },
    { id: 'foro', label: '11. Foro e Disposições Gerais' },
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
            Termos de Uso e Condições Gerais
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.6)',
            maxWidth: '700px',
            margin: '0 auto',
            lineHeight: '1.5',
          }}>
            Heiss-Lab · LogicDefense & Assistente Moeda · Contrato de Licença de Software, Governança Pedagógica e Operacional
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
              Índice dos Termos
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
            {/* 1. Aceite dos Termos */}
            <section id="aceite" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                1. Aceite dos Termos & Natureza Contratual
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Ao acessar o portal <strong>Heiss-Lab / LogicDefense</strong>, utilizar os jogos de lógica, consultar as aulas e vídeos do repositório, utilizar o aplicativo <strong>Assistente Moeda</strong>, interagir com as APIs de planilha ou adquirir licenças de uso, você concorda expressamente com estes <strong>Termos de Uso</strong> e com a nossa <strong>Política de Privacidade</strong>.
              </p>
              <p>
                Este instrumento constitui um contrato legalmente vinculante entre você ("Usuário") e a <strong>Heiss-Lab / Augusto Heiss</strong> ("Desenvolvedor", "Nós"). Caso não concorde com qualquer cláusula, solicitamos a imediata descontinuidade do uso.
              </p>
            </section>

            {/* 2. Descrição do Serviço */}
            <section id="descricao" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                2. Descrição dos Serviços & Ecossistema Heiss-Lab
              </h2>
              <p style={{ marginBottom: '16px' }}>
                A Heiss-Lab disponibiliza um ecossistema integrado composto por:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Jogos Educativos de Lógica:</strong> Jogos interativos (Logic Defense, Logic Ascension, Logic Invaders, Logic Friction) voltados ao raciocínio lógico, probabilístico e dedutivo, com leaderboards anônimos e sem coleta de PII de menores.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Repositório de Aulas & Conteúdo Pedagógico:</strong> Aulas estruturadas sobre temas matemáticos, vieses numéricos, probabilidade, lógica e suas conexões com diversas áreas do conhecimento, acompanhadas de vídeos e recursos visuais.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Laboratório de Ferramentas:</strong> Utilitários técnicos como geradores de currículo (CV-Maker), formalizadores de relatórios (Ocorrências) e portas de conexão para desenvolvedores (API Port).
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Assistente Moeda (Web, Mobile e API):</strong> Software utilitário de controle de fluxo de caixa, gestão de planilhas financeiras isoladas no Turso e diagnósticos analíticos via IA.
                </li>
              </ul>
            </section>

            {/* 3. Responsabilidade do Usuário (Controlador) */}
            <section id="responsabilidade-usuario" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                3. Responsabilidade Exclusiva do Usuário (Controlador perante a LGPD)
              </h2>
              <div style={{
                backgroundColor: 'rgba(168, 85, 247, 0.08)',
                borderLeft: '4px solid #a855f7',
                padding: '16px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '16px',
              }}>
                <strong>⚖️ DECLARAÇÃO DE RESPONSABILIDADE DO USUÁRIO:</strong> Caso você utilize a plataforma, seus utilitários de laboratório ou suas APIs para cadastrar, processar, calcular ou gerenciar valores, transações ou informações pertencentes a <strong>clientes seus, empresas ou terceiros</strong>, você declara e reconhece que:
                <ul style={{ paddingLeft: '20px', marginTop: '8px', listStyleType: 'circle' }}>
                  <li>Você atua como o único e exclusivo <strong>Controlador dos Dados (Data Controller)</strong> perante a LGPD (Lei 13.709/2018).</li>
                  <li>É de sua responsabilidade exclusiva obter consentimento, emitir notas fiscais, recolher tributos e assegurar a licitude da origem dos recursos cadastrados.</li>
                  <li>O Desenvolvedor fornece apenas a ferramenta de software, não exercendo controle, verificação de veracidade ou custódia decisória sobre os lançamentos.</li>
                </ul>
              </div>
            </section>

            {/* 4. Custódia de Chaves de API */}
            <section id="chaves-api" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                4. Custódia e Sigilo de Chaves de API (X-Spreadsheet-Key)
              </h2>
              <p style={{ marginBottom: '16px' }}>
                A segurança do ecossistema baseia-se na posse da sua Chave de API / Chave de Planilha:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Dever de Sigilo:</strong> A guarda, confidencialidade e não compartilhamento da sua chave de API com terceiros não autorizados é de sua inteira responsabilidade.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Isenção por Exposição Pública:</strong> A Heiss-Lab não se responsabiliza por raspagem de dados, edições indevidas ou perdas causadas por usuários que publicarem suas chaves em repositórios públicos (ex: GitHub) ou automações abertas.
                </li>
              </ul>
            </section>

            {/* 5. Isenção Financeira & Não-CVM */}
            <section id="disclaimer-financeiro" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                5. Isenção de Responsabilidade Financeira, Tributária e Não-CVM
              </h2>
              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                borderLeft: '4px solid #f59e0b',
                padding: '20px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '16px',
              }}>
                <strong>⚠️ AVISO DE NÃO-CONSULTORIA:</strong> O Assistente Moeda, suas fórmulas matemáticas, DREs, projeções simuladas e respostas geradas por Inteligência Artificial possuem caráter <strong>estritamente informativo, matemático e educacional</strong>.
                <br /><br />
                <strong>NENHUMA INFORMAÇÃO FORNECIDA PELA PLATAFORMA CONSTITUI:</strong>
                <ol style={{ paddingLeft: '20px', marginTop: '8px', listStyleType: 'decimal' }}>
                  <li>Consultoria de investimentos, assessoria de valores mobiliários ou recomendação de compra/venda regulada pela CVM ou BACEN.</li>
                  <li>Parecer contábil, auditoria fiscal ou consultoria tributária oficial.</li>
                </ol>
                A tomada de decisão financeira, alocação de capital e gestão de risco é ato de exclusiva responsabilidade do usuário. O Desenvolvedor não se responsabiliza por prejuízos, lucros cessantes ou decisões de negócio baseadas nas ferramentas.
              </div>
            </section>

            {/* 6. Repositório de Aulas, Vídeos com IA & Isenção Pedagógica */}
            <section id="aulas-ia" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                6. Repositório de Aulas, Vídeos Gerados com IA & Isenção Pedagógica
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O <strong>Repositório Heiss-Lab</strong> disponibiliza lições, análises conceituais e recursos audiovisuais sobre matemática aplicada e interdisciplinaridade:
              </p>
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                borderLeft: '4px solid #3b82f6',
                padding: '20px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '16px',
              }}>
                <strong>🎓 Finalidade Estritamente Educativa & Vídeos com Apoio de IA:</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '8px', listStyleType: 'disc' }}>
                  <li style={{ marginBottom: '6px' }}>
                    <strong>A Matemática em Todas as Áreas:</strong> O portal explora como princípios matemáticos (estatística, probabilidade, lógica, teoria dos jogos) se manifestam em diversas disciplinas (ciências naturais, economia, computação, esportes e decisões cotidianas).
                  </li>
                  <li style={{ marginBottom: '6px' }}>
                    <strong>Produção Audiovisual com Inteligência Artificial:</strong> As animações, vídeos explicativos, narrações sintetizadas e roteiros visuais disponibilizados nas aulas podem ser gerados ou acelerados com assistência de modelos de Inteligência Artificial generativa com o propósito de tornar conceitos abstratos mais didáticos e visuais.
                  </li>
                  <li style={{ marginBottom: '6px' }}>
                    <strong>Isenção por Aplicação Prática Indevida:</strong> Os modelos matemáticos, demonstrações e exercícios têm fins pedagógicos e de desenvolvimento do pensamento crítico. A Heiss-Lab e seus autores não garantem ganhos patrimoniais, sucesso em apostas ou infalibilidade teórica quando aplicados no mundo real. O usuário é o único responsável pelo uso que fizer do conhecimento adquirido.
                  </li>
                </ul>
              </div>
            </section>

            {/* 7. Garantia AS IS & Limitação */}
            <section id="garantia-as-is" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                7. Garantia "No Estado em que se Encontra" (AS IS) & Limitação de Danos
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O software e os portais são licenciados "no estado em que se encontram" (*AS IS*) e "conforme disponível" (*AS AVAILABLE*), sem garantias expressas ou implícitas de que funcionarão de forma ininterrupta ou livre de erros provocados por instabilidades de rede, indisponibilidade temporária de provedores de nuvem (Turso, Vercel, Expo, gateways de pagamento) ou falhas no dispositivo do usuário.
              </p>
              <p>
                Em nenhuma circunstância o Desenvolvedor será responsável por danos indiretos, incidentais, especiais, punitivos ou consequenciais. Na extensão máxima permitida pela legislação aplicável, a responsabilidade total do Desenvolvedor perante qualquer reivindicação contratual limita-se ao valor efetivamente pago pelo usuário à plataforma nos últimos 30 (trinta) dias.
              </p>
            </section>

            {/* 8. Cláusula de Indenização */}
            <section id="indenizacao" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                8. Cláusula de Indenização (Hold Harmless & Defesa Regressiva)
              </h2>
              <p style={{ marginBottom: '16px' }}>
                O Usuário concorda em defender, indenizar e manter indene a <strong>Heiss-Lab</strong>, seus fundadores e desenvolvedores contra quaisquer reivindicações, processos administrativos (ex: ANPD, PROCON), ações judiciais, danos, multas, custas processuais e honorários advocatícios decorrentes de:
              </p>
              <ol style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'decimal' }}>
                <li style={{ marginBottom: '8px' }}>Violação destes Termos de Uso ou da legislação brasileira por parte do Usuário.</li>
                <li style={{ marginBottom: '8px' }}>Coleta, armazenamento ou manipulação ilícita de dados de terceiros/clientes realizada pelo Usuário.</li>
                <li style={{ marginBottom: '8px' }}>Uso indevido das APIs para fraudes, lavagem de dinheiro ou sonegação fiscal.</li>
              </ol>
            </section>

            {/* 9. Planos, Pagamentos e Reembolsos */}
            <section id="assinaturas" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                9. Planos, Faturamento e Reembolsos
              </h2>
              <p style={{ marginBottom: '16px' }}>
                As licenças PRO fornecem cotas de tokens e recursos analíticos avançados para o Assistente Moeda:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Acúmulo Cumulativo:</strong> Renovações antecipadas somam o prazo de validade e o saldo de tokens ao saldo existente sem perdas.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Reembolso no Google Play:</strong> Processado diretamente pelas regras e interfaces da Google Play Store.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Reembolso na Web (Stripe):</strong> Garantido o direito de arrependimento no prazo legal de 7 (sete) dias (CDC Art. 49).
                </li>
              </ul>
            </section>

            {/* 10. Propriedade Intelectual & Licença CC */}
            <section id="propriedade" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                10. Propriedade Intelectual & Licenciamento Educacional
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Todos os direitos sobre os códigos-fonte, arquitetura de software, jogos (Logic Defense, Logic Ascension, Logic Invaders, Logic Friction), marcas e identidade visual pertencem à Heiss-Lab.
              </p>
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderLeft: '4px solid #10b981',
                padding: '16px',
                borderRadius: '0 8px 8px 0',
                fontSize: '14px',
                lineHeight: '1.6',
              }}>
                <strong>📚 Licença Creative Commons CC BY-NC-SA 4.0:</strong> O material textual e pedagógico do Repositório de Aulas está licenciado sob a licença <em>Atribuição-NãoComercial-CompartilhaIgual 4.0 Internacional</em>. É permitida a distribuição e o compartilhamento gratuito para fins não comerciais, desde que atribuída a autoria à Heiss-Lab / Augusto Heiss. <strong>A venda de materiais ou cobrança de terceiros por acesso ao conteúdo é estritamente proibida.</strong>
              </div>
            </section>

            {/* 11. Foro */}
            <section id="foro" style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>
                11. Legislação Aplicável e Foro de Eleição
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o Foro da Comarca de domicílio do Desenvolvedor para dirimir eventuais controvérsias oriundas deste instrumento, renunciando-se a qualquer outro por mais privilegiado que seja.
              </p>
            </section>
          </main>
        </div>
      </div>

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
