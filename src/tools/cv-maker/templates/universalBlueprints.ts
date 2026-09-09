import { DEFAULT_JOHN_DOE_YAML } from './defaultTemplate'

export interface DocumentBlueprint {
  id: string
  title: string
  category: 'cv' | 'proposal' | 'report' | 'technical'
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
  }
]
