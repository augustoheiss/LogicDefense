/**
 * DomainCatalog.ts
 *
 * Catálogo central de domínios documentais para o PDF-Maker Geral.
 * Fornece metadados, seções padrão e estruturas recomendadas para:
 * - Resume (Currículo Profissional / ATS)
 * - Proposal (Proposta Comercial / SOW)
 * - Contract (Contrato de Serviços / Termo Jurídico)
 * - Invoice (Fatura Comercial / Nota de Cobrança)
 * - Report (Relatório Técnico / Whitepaper)
 */

import type { DocumentDomain, DocumentDomainConfig } from '../types/documentDomain'

export const DOMAIN_CATALOG: Record<DocumentDomain, DocumentDomainConfig> = {
  resume: {
    id: 'resume',
    name: 'Currículo Profissional',
    label: '📄 Currículo / ATS Resume',
    icon: '📄',
    description: 'Documento executivo de histórico profissional, métricas X-Y-Z e competências técnicas.',
    defaultFormat: 'a4',
    recommendedThemes: ['executive', 'minimalist', 'creative'],
    supportedSections: [
      { id: 'personal', label: 'Dados Pessoais & Contato', icon: '👤', description: 'Nome, cargo, contatos e links', required: true, defaultZone: 'full' },
      { id: 'summary', label: 'Resumo Executivo', icon: '📝', description: 'Síntese profissional de impacto', required: true, defaultZone: 'full' },
      { id: 'experience', label: 'Experiência Profissional', icon: '💼', description: 'Cargos, realizações e métricas', required: true, defaultZone: 'full' },
      { id: 'education', label: 'Formação Acadêmica', icon: '🎓', description: 'Graduações e certificações', required: false, defaultZone: 'full' },
      { id: 'skills', label: 'Competências Técnicas', icon: '⚡', description: 'Hard & soft skills', required: false, defaultZone: 'full' },
      { id: 'languages', label: 'Idiomas', icon: '🌐', description: 'Fluência e proficiência', required: false, defaultZone: 'full' },
      { id: 'projects', label: 'Projetos de Destaque', icon: '🚀', description: 'Cases práticos e repositórios', required: false, defaultZone: 'full' },
      { id: 'certifications', label: 'Certificados & Licenças', icon: '📜', description: 'Credenciais verificadas', required: false, defaultZone: 'full' }
    ]
  },
  proposal: {
    id: 'proposal',
    name: 'Proposta Comercial (SOW)',
    label: '💼 Proposta Comercial / SOW',
    icon: '💼',
    description: 'Declaração formal de trabalho, escopo, cronograma de marcos e tabela de investimento.',
    defaultFormat: 'a4',
    recommendedThemes: ['executive', 'creative'],
    supportedSections: [
      { id: 'proposal_header', label: 'Capa & Identificação', icon: '🏢', description: 'Cliente, proponente e data de validade', required: true, defaultZone: 'full' },
      { id: 'executive_summary', label: 'Sumário Executivo & Desafio', icon: '🎯', description: 'Contexto e valor agregado', required: true, defaultZone: 'full' },
      { id: 'scope_of_work', label: 'Escopo de Trabalho & Entregáveis', icon: '📋', description: 'Descrição das etapas e limites do projeto', required: true, defaultZone: 'full' },
      { id: 'timeline_milestones', label: 'Cronograma & Marcos (Milestones)', icon: '⏱️', description: 'Etapas temporais e prazos de entrega', required: false, defaultZone: 'full' },
      { id: 'investment_breakdown', label: 'Tabela de Investimento', icon: '💰', description: 'Custos unitários, totais e condições de pagamento', required: true, defaultZone: 'full' },
      { id: 'team_credentials', label: 'Equipe & Credenciais', icon: '👥', description: 'Apresentação dos especialistas responsáveis', required: false, defaultZone: 'full' },
      { id: 'terms_acceptance', label: 'Termos de Aceite & Assinatura', icon: '✍️', description: 'Campos para formalização e aprovação', required: true, defaultZone: 'full' }
    ]
  },
  contract: {
    id: 'contract',
    name: 'Contrato de Serviços',
    label: '⚖️ Contrato / Instrumento Jurídico',
    icon: '⚖️',
    description: 'Instrumento legal bilateral com cláusulas numeradas, foro e assinaturas formais.',
    defaultFormat: 'a4',
    recommendedThemes: ['minimalist', 'white'],
    supportedSections: [
      { id: 'contract_preamble', label: 'Qualificação das Partes', icon: '📜', description: 'Contratante e Contratada com CNPJ/CPF', required: true, defaultZone: 'full' },
      { id: 'clause_object', label: 'Cláusula 1ª — Do Objeto', icon: '📌', description: 'Definição dos serviços a prestar', required: true, defaultZone: 'full' },
      { id: 'clause_obligations', label: 'Cláusula 2ª — Das Obrigações', icon: '🛡️', description: 'Deveres de ambas as partes', required: true, defaultZone: 'full' },
      { id: 'clause_payment', label: 'Cláusula 3ª — Do Preço e Condições', icon: '💳', description: 'Honorários, multas e forma de repasse', required: true, defaultZone: 'full' },
      { id: 'clause_confidentiality', label: 'Cláusula 4ª — Confidencialidade (NDA)', icon: '🔒', description: 'Proteção de segredos industriais e dados', required: false, defaultZone: 'full' },
      { id: 'clause_termination', label: 'Cláusula 5ª — Da Rescisão e Foro', icon: '🏛️', description: 'Prazos de aviso prévio e comarca de eleição', required: true, defaultZone: 'full' },
      { id: 'signature_block', label: 'Assinaturas das Partes e Testemunhas', icon: '✒️', description: 'Assinatura física ou certificação digital', required: true, defaultZone: 'full' }
    ]
  },
  invoice: {
    id: 'invoice',
    name: 'Fatura Comercial / Recibo',
    label: '🧾 Fatura / Recibo Comercial',
    icon: '🧾',
    description: 'Demonstrativo fiscal de cobrança com itens tarifados, impostos e instruções PIX/bancárias.',
    defaultFormat: 'a4',
    recommendedThemes: ['minimalist', 'white'],
    supportedSections: [
      { id: 'invoice_header', label: 'Identificação da Fatura & Emissor', icon: '🧾', description: 'Logotipo, Nº da fatura, emissão e vencimento', required: true, defaultZone: 'full' },
      { id: 'billing_recipient', label: 'Dados do Tomador / Cliente', icon: '🏢', description: 'Razão Social, CNPJ/CPF e endereço', required: true, defaultZone: 'full' },
      { id: 'line_items_table', label: 'Tabela de Itens e Serviços', icon: '📊', description: 'Quantidade, descrição, valor unitário e total', required: true, defaultZone: 'full' },
      { id: 'tax_summary', label: 'Totais & Retenções Tributárias', icon: '📉', description: 'Subtotal, descontos, ISS/IR e valor líquido', required: true, defaultZone: 'full' },
      { id: 'payment_instructions', label: 'Instruções de Pagamento & PIX', icon: '🏦', description: 'Chave PIX (QR Code), dados bancários e boleto', required: true, defaultZone: 'full' },
      { id: 'invoice_notes', label: 'Notas e Observações Legais', icon: 'ℹ️', description: 'Informações fiscais complementares', required: false, defaultZone: 'full' }
    ]
  },
  report: {
    id: 'report',
    name: 'Relatório Técnico',
    label: '📑 Relatório Técnico / Whitepaper',
    icon: '📑',
    description: 'Documento analítico com estrutura de cabeçalho corporativo, dados e conclusões de engenharia.',
    defaultFormat: 'a4',
    recommendedThemes: ['executive', 'minimalist'],
    supportedSections: [
      { id: 'report_cover', label: 'Cabeçalho Corporativo & Metadados', icon: '🏷️', description: 'Título, autor, versão, status e departamento', required: true, defaultZone: 'full' },
      { id: 'executive_brief', label: 'Sumário Executivo (Abstract)', icon: '📖', description: 'Contexto e principais achados do estudo', required: true, defaultZone: 'full' },
      { id: 'methodology_data', label: 'Metodologia & Análise de Dados', icon: '🔬', description: 'Detalhamento do estudo, métricas e tabelas', required: true, defaultZone: 'full' },
      { id: 'findings_charts', label: 'Resultados & Visualizações', icon: '📈', description: 'Gráficos, evidências e interpretações', required: false, defaultZone: 'full' },
      { id: 'recommendations', label: 'Conclusões & Recomendações', icon: '💡', description: 'Próximos passos e orientações práticas', required: true, defaultZone: 'full' },
      { id: 'references_annexes', label: 'Referências & Anexos', icon: '📚', description: 'Documentos correlatos e fontes citadas', required: false, defaultZone: 'full' }
    ]
  }
}

export class DomainCatalog {
  public static getDomain(domain: DocumentDomain = 'resume'): DocumentDomainConfig {
    return DOMAIN_CATALOG[domain] || DOMAIN_CATALOG.resume
  }

  public static getAvailableDomains(): DocumentDomainConfig[] {
    return Object.values(DOMAIN_CATALOG)
  }
}
