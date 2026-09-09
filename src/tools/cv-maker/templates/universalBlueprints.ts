import { DEFAULT_JOHN_DOE_YAML } from './defaultTemplate'

export interface DocumentBlueprint {
  id: string
  title: string
  category: 'cv' | 'proposal' | 'report' | 'technical' | 'clinical' | 'contract'
  icon: string
  badge: string
  description: string
  yamlContent: string
}

export const PROPOSTA_COMERCIAL_BLUEPRINT_YAML = `document_title: "Proposta Técnica: Modernização de Arquitetura & Agentes de IA"
meta:
  isUniversalDocument: true
basics:
  name: "Proposta de Solução: Modernização de Arquitetura & IA"
  label: "Apex Logic Systems • Arquitetura Corporativa de Alta Escala"
  email: "contato@apexlogic.io"
  phone: "+55 (11) 98765-4321"
  url: "https://apexlogic.io/solucoes"
  summary: "Esta proposta consolida o plano arquitetural para migração zero-downtime da infraestrutura corporativa, orquestração de microsserviços e integração de pipelines de agentes inteligentes com governança estrita de segurança e custos."

cronograma_entregas:
  - fase: "Fase 1: Diagnóstico e Mapeamento de Dependências"
    startDate: "2026-10-01"
    endDate: "2026-10-25"
    descricao: "Varredura profunda do monolito legado, levantamento de fluxos de dados e matriz de risco operacional."
  - fase: "Fase 2: Infraestrutura Multi-Região e PoC Piloto"
    startDate: "2026-10-26"
    endDate: "2026-11-20"
    descricao: "Implementação da malha Kubernetes, esteiras de CI/CD automatizadas e validação de benchmark com tráfego shadow."
  - fase: "Fase 3: Implantação de Agentes Autônomos e RAG"
    startDate: "2026-11-21"
    endDate: "2026-12-15"
    descricao: "Deploy do motor de contexto vetorial, guardrails de segurança e integração com sistemas legados via Webhooks."
  - fase: "Fase 4: Go-Live com Virada de Tráfego Canário"
    startDate: "2026-12-16"
    endDate: "2026-12-30"
    descricao: "Virada progressiva de tráfego (10% -> 50% -> 100%), telemetria em tempo real e treinamento das equipes operacionais."

modulos_sistema:
  - modulo: "Módulo de Orquestração de Agentes"
    stack: "TypeScript • Node.js • LangChain"
    sla: "99.95% de Disponibilidade"
    descricao: "Roteador autônomo de tarefas com mitigação contra alucinações e isolamento estrito de memória por tenant."
  - modulo: "Motor Vetorial & Base de Conhecimento"
    stack: "PostgreSQL • pgvector • Supabase"
    sla: "Latência p99 < 85ms"
    descricao: "Indexação híbrida de documentos corporativos com re-ranking e busca semântica em tempo real."
  - modulo: "Gateway de Segurança Zero-Trust"
    stack: "Cloudflare Workers • Rust • OIDC"
    sla: "Defesa Ativa contra DDoS"
    descricao: "Autenticação federada com rotação automática de tokens, criptografia ponta a ponta e auditoria rastreável."

kpis_desempenho:
  latencia_media_api: "< 45ms"
  throughput_alvo: "120.000 requisições/segundo"
  disponibilidade_anual: "99.99%"
  rpo_recuperacao_dados: "0 segundos (Replicação Síncrona)"
  rto_tempo_recuperacao: "< 90 segundos (Failover Automatizado)"
  reducao_custo_cloud: "38% de economia estimada"

pilares_tecnologicos:
  - "Kubernetes Multi-Cloud"
  - "PostgreSQL / pgvector"
  - "Event-Driven com Apache Kafka"
  - "Rust & WebAssembly"
  - "OpenTelemetry & Prometheus"
  - "Criptografia AES-256 e TLS 1.3"

termos_gerais: |
  Esta proposta técnica possui validade de 30 (trinta) dias a contar da data de sua emissão.
  Todos os serviços incluem garantia de suporte corretivo Nível 3 por 90 dias após a homologação final.
  Os pagamentos serão condicionados à conclusão e aceite formal de cada uma das entregas especificadas no cronograma.
`

export const RELATORIO_ARQUITETURA_BLUEPRINT_YAML = `document_title: "Relatório Técnico de Auditoria SRE & Confiabilidade de Sistemas"
meta:
  isUniversalDocument: true
basics:
  name: "Auditoria SRE & Análise de Confiabilidade"
  label: "Relatório Executivo Trimestral • Q3/2026"
  email: "sre-audit@logicdefense.io"
  url: "https://status.logicdefense.io"
  summary: "Auditoria detalhada da malha de microsserviços, SLOs de produção, conformidade com políticas zero-trust e recomendações de mitigação de riscos operacionais."

metricas_observabilidade:
  uptime_trimestral: "99.985%"
  incidentes_severidade_1: "0 incidentes"
  mttr_tempo_medio_resolucao: "14 minutos"
  consumo_cpu_p95: "48.2%"
  taxa_erros_http_5xx: "0.003%"
  cobertura_testes_e2e: "94.6%"

historico_melhorias:
  - marco: "Upgrade do Cluster Kubernetes para v1.31"
    startDate: "2026-07-10"
    endDate: "2026-07-15"
    resumo: "Migração sem indisponibilidade de nós com transição de drivers de rede CNI."
  - marco: "Isolamento de Banco de Dados por Sharding"
    startDate: "2026-08-01"
    endDate: "2026-08-20"
    resumo: "Particionamento horizontal de tabelas transacionais, reduzindo locks de concorrência em 70%."
  - marco: "Auditoria SOC 2 Tipo II"
    startDate: "2026-09-01"
    endDate: "2026-09-28"
    resumo: "Certificação de conformidade em segurança da informação sem apontamentos críticos."

servicos_auditados:
  - servico: "API de Pagamentos e Checkout"
    status: "Operacional (SLO 100%)"
    resiliencia: "Multi-Region Active-Active"
  - servico: "Motor de RAG e Inteligência Artificial"
    status: "Estável (SLO 99.96%)"
    resiliencia: "Fallback para réplicas secundárias"
  - servico: "Ingestão de Logs e Telemetria"
    status: "Otimizado (SLO 99.99%)"
    resiliencia: "Buffer com retenção de 72h em disco"

stacks_em_conformidade:
  - "Go 1.23"
  - "TypeScript 5.6"
  - "Docker & Containerd"
  - "Terraform Infrastructure as Code"
  - "Vault HashiCorp"

diretrizes_governanca: |
  Todos os microsserviços foram auditados conforme as diretrizes do NIST SP 800-53 e CIS Benchmarks.
  Recomenda-se a adoção de rotinas trimestrais de Chaos Engineering (Chaos Mesh) a partir de Q4/2026 para testar a resiliência a partições de rede transatlânticas.
`

export const PRONTUARIO_MEDICO_BLUEPRINT_YAML = `document_title: "Prontuário Médico & Evolução Clínica Especializada"
meta:
  isUniversalDocument: true
basics:
  name: "Prontuário de Evolução Clínica #HC-98421"
  label: "Hospital Israelita Albert Einstein • Cardiologia & Metabologia"
  email: "dr.ricardo.moraes@einstein.br"
  phone: "+55 (11) 2151-1233"
  url: "https://portal.einstein.br/paciente/98421"
  summary: "Paciente masculino, 48 anos, em acompanhamento multidisciplinar no ambulatório de cardiologia. Evolução altamente favorável pós-ajuste terapêutico com normalização pressórica e remissão laboratorial de glicemia alterada."

dados_paciente:
  nome_paciente: "Carlos Eduardo Silveira"
  idade_nascimento: "48 anos (14/05/1978)"
  registro_hospitalar: "HC-98421-SP"
  convenio_plano: "Bradesco Saúde Top Nacional"
  pressao_arterial: "125 x 80 mmHg"
  frequencia_cardiaca: "66 bpm (Ritmo Sinusal)"
  indice_massa_corporal: "24.6 kg/m² (Eutrófico)"

historico_atendimentos:
  - consulta: "Consulta Inicial: Queixa de Cansaço e Dispneia"
    startDate: "2026-03-15"
    endDate: "2026-03-15"
    conduta: "Investigação de fadiga matinal aos moderados esforços. Solicitados ecocardiograma com Doppler tecidual e painel lipídico completo."
  - consulta: "Retorno com Laudos & Início de Terapêutica"
    startDate: "2026-05-20"
    endDate: "2026-05-20"
    conduta: "Função ventricular preservada (FE 64%). Pré-diabetes detectado. Prescrita intervenção farmacológica associada a reeducação alimentar."
  - consulta: "Evolução Semestral & Titulação de Dosagem"
    startDate: "2026-08-10"
    endDate: "2026-08-10"
    conduta: "Perda ponderal de 4.2kg. Excelente adesão ao treino resistido. Ausência total de queixas cardiovasculares."

exames_laboratoriais:
  hemoglobina_glicada_hba1c: "5.3% (Valor de Referência < 5.7%)"
  glicemia_em_jejum: "89 mg/dL (Normal: 70 a 99 mg/dL)"
  colesterol_ldl: "64 mg/dL (Alvo Terapêutico < 70)"
  colesterol_hdl: "56 mg/dL (Desejável > 40)"
  creatinina_serica: "0.92 mg/dL (Normal)"
  taxa_filtracao_glomerular: "> 90 mL/min/1.73m²"

prescricoes_ativas:
  - "Losartana Potássica 50mg (1 comp via oral às 08h)"
  - "Metformina XR 500mg (2 comp via oral no jantar)"
  - "Rosuvastatina 10mg (1 comp via oral antes de dormir)"
  - "Coenzima Q10 100mg (1 cápsula no almoço)"
  - "Vitamina D3 2.000 UI (1 cápsula pela manhã)"

diagnosticos_e_estadiamento:
  - cid: "CID-10 I10 - Hipertensão Arterial Sistêmica"
    estagio: "Estágio 1 - Controlada"
    prognostico: "Excelente controle ambulatorial sem lesão em órgãos-alvo."
  - cid: "CID-10 E11.9 - Disglicemia Pré-Diabética"
    estagio: "Remissão Metabólica Funcional"
    prognostico: "HbA1c normalizada através de estilo de vida e metformina."

parecer_clinico_prosa: |
  Paciente segue em ótimo estado geral, corado, hidratado e eupneico. Ausência de sopros à ausculta cardíaca e ruídos adventícios pulmonares.
  Manter o esquema posológico atual sem interrupções. Estimulada a continuidade das atividades físicas aeróbicas combinadas com musculação (mínimo 180 min/semana).
  Retorno ambulatorial agendado para 6 (seis) meses com novos controles bioquímicos e teste ergométrico de acompanhamento.
`

export const CONTRATO_PRESTACAO_SERVICOS_BLUEPRINT_YAML = `document_title: "Instrumento Particular de Prestação de Serviços Técnicos em TI & SLA"
meta:
  isUniversalDocument: true
basics:
  name: "Contrato de Serviços Técnicos & Soluções em Nuvem"
  label: "Instrumento Contratual Nº 2026/CT-048 • Vigência 12 Meses"
  email: "juridico@apexlogic.io"
  phone: "+55 (11) 3456-7890"
  url: "https://apexlogic.io/contratos/ct-048"
  summary: "Contrato celebrado entre Apex Logic Systems Ltda. (CONTRATADA) e Omnia Global Retail S.A. (CONTRATANTE) para modernização da arquitetura de microsserviços, implantação de agentes de inteligência artificial e sustentação continuada em nuvem."

partes_contratantes:
  contratada_razao_social: "Apex Logic Systems Ltda."
  contratada_cnpj: "42.891.002/0001-94"
  contratada_sede: "Av. Paulista, 1842, 14º andar, Bela Vista - São Paulo/SP"
  contratante_razao_social: "Omnia Global Retail S.A."
  contratante_cnpj: "18.304.551/0001-20"
  contratante_sede: "Av. Brigadeiro Faria Lima, 3477, Itaim Bibi - São Paulo/SP"
  foro_de_eleicao: "Comarca da Capital do Estado de São Paulo"

pacotes_entregaveis:
  - pacote: "Pacote 1: Documento de Arquitetura & Blueprint Técnico"
    prazo: "30 (trinta) dias corridos"
    valor: "R$ 45.000,00"
    descricao: "Mapeamento minucioso do monolito legado, matriz de dependências, arquitetura de eventos Kafka e especificações OpenAPI 3.1."
  - pacote: "Pacote 2: Malha de Agentes de IA & Pipelines de RAG"
    prazo: "60 (sessenta) dias corridos"
    valor: "R$ 85.000,00"
    descricao: "Desenvolvimento e orquestração de microsserviços de IA, integração segura com banco vetorial pgvector e isolamento multi-inquilino."
  - pacote: "Pacote 3: Homologação, Testes de Carga & Go-Live"
    prazo: "30 (trinta) dias corridos"
    valor: "R$ 50.000,00"
    descricao: "Execução de testes de estresse para 120k req/s, auditoria de segurança SOC 2 e transição assistida com virada de DNS canário."

condicoes_faturamento:
  parcela_1_sinal: "R$ 36.000,00 (10 dias após a assinatura)"
  parcela_2_pacote_1: "R$ 45.000,00 (Após homologação do Pacote 1)"
  parcela_3_pacote_2: "R$ 49.000,00 (Após homologação do Pacote 2)"
  parcela_4_conclusao: "R$ 50.000,00 (Após conclusão do Go-Live)"
  valor_global_contrato: "R$ 180.000,00 (Cento e oitenta mil reais)"

niveis_garantia_sla:
  - "Disponibilidade da Solução: 99.95% em Regime 24/7/365"
  - "Tempo de Atendimento P1 (Crítico): < 30 minutos"
  - "Tempo de Resolução P1: < 4 horas corridas"
  - "Backups com RPO = 0 segundos e RTO < 15 minutos"
  - "Multa de 2% sobre a fatura por infração de SLA"

clausulas_gerais_prosa: |
  CLÁUSULA PRIMEIRA - DO OBJETO E ESCOPO: O presente contrato tem por objeto a prestação, pela CONTRATADA à CONTRATANTE, de serviços de engenharia de software e implantação de agentes de inteligência artificial descritos nos pacotes anexos.
  CLÁUSULA SEGUNDA - DA CONFIDENCIALIDADE: As partes comprometem-se a resguardar o sigilo absoluto sobre todas as informações confidenciais, segredos industriais e dados protegidos pela LGPD pelo prazo de 5 (cinco) anos.
  CLÁUSULA TERCEIRA - DA PROPRIEDADE INTELECTUAL: Todos os códigos-fonte, pipelines e configurações personalizadas desenvolvidas especificamente no âmbito deste contrato serão de propriedade exclusiva da CONTRATANTE após a liquidação integral das obrigações.
`

export const UNIVERSAL_BLUEPRINTS: DocumentBlueprint[] = [
  {
    id: 'canonical_cv',
    title: 'Currículo Executivo Moderno',
    category: 'cv',
    icon: '👤',
    badge: 'Currículo Padrão',
    description: 'Formato clássico JSON Resume v2.0 com histórico profissional, formação, projetos e carta de apresentação.',
    yamlContent: DEFAULT_JOHN_DOE_YAML
  },
  {
    id: 'tech_proposal',
    title: 'Proposta Comercial & Técnica de TI',
    category: 'proposal',
    icon: '💼',
    badge: 'Documento Universal',
    description: 'Proposta técnica completa com cronograma (Timeline), módulos (Cards), KPIs (Tabela) e termos contratuais (Prosa).',
    yamlContent: PROPOSTA_COMERCIAL_BLUEPRINT_YAML
  },
  {
    id: 'arch_report',
    title: 'Relatório Executivo de Auditoria SRE',
    category: 'report',
    icon: '📊',
    badge: 'Relatório Técnico',
    description: 'Relatório corporativo com métricas de observabilidade, histórico de melhorias, serviços auditados e conformidade.',
    yamlContent: RELATORIO_ARQUITETURA_BLUEPRINT_YAML
  },
  {
    id: 'clinical_record',
    title: 'Prontuário Médico & Evolução Clínica',
    category: 'clinical',
    icon: '🩺',
    badge: 'Saúde & Medicina',
    description: 'Prontuário médico com histórico de atendimentos (Timeline), exames (Tabela), medicamentos (Badges) e diagnóstico (Cards).',
    yamlContent: PRONTUARIO_MEDICO_BLUEPRINT_YAML
  },
  {
    id: 'commercial_contract',
    title: 'Contrato de Serviços Técnicos & SLA',
    category: 'contract',
    icon: '📜',
    badge: 'Jurídico & Negócios',
    description: 'Instrumento contratual completo com partes (Tabela), entregáveis (Cards), faturamento (Tabela), SLA (Badges) e cláusulas (Prosa).',
    yamlContent: CONTRATO_PRESTACAO_SERVICOS_BLUEPRINT_YAML
  }
]

