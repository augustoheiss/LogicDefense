export const DEFAULT_JOHN_DOE_YAML = `basics:
  name: "Alexandre Silva"
  label: "Senior Software Architect & AI Systems Specialist"
  email: "alexandre.silva@example.com"
  phone: "+55 (11) 98765-4321"
  url: "https://linkedin.com/in/alexandresilva"
  summary: "Arquiteto de software sênior com 8+ anos de experiência liderando a modernização de sistemas corporativos de alta escala, pipelines de inteligência artificial e governança de dados. Especialista em microserviços, cloud hibrída e aceleração de squads de engenharia."
  location:
    city: "São Paulo"
    region: "SP"
    postalCode: "01310-100"
    countryCode: "BR"
  profiles:
    - network: "GitHub"
      username: "alexandresilva"
      url: "https://github.com/alexandresilva"
    - network: "LinkedIn"
      username: "alexandresilva"
      url: "https://linkedin.com/in/alexandresilva"
  customBadges:
    - "Cloud Architect"
    - "AI Systems"

work:
  - name: "Enterprise Tech Solutions"
    position: "Staff Software Architect"
    startDate: "2022-01-01"
    summary: "Liderança técnica da plataforma de microsserviços distribuídos atendendo 2M+ requisições diárias com 99.99% de disponibilidade."
    highlights:
      - "Arquitetou a migração de monólito para microsserviços event-driven, reduzindo a latência p99 em 45%."
      - "Implementou pipeline de governança de IA generativa com guardrails de segurança e redução de 60% no consumo de tokens."
      - "Mentorou e coordenou tecnicamente 4 squads multidisciplinares (28 engenheiros)."
  - name: "Fintech Horizon"
    position: "Senior Backend Engineer"
    startDate: "2019-03-01"
    endDate: "2021-12-31"
    summary: "Desenvolvimento e sustentação de motores de transações financeiras e conciliação em tempo real."
    highlights:
      - "Redesenhou a camada de conciliação bancária processando R$ 120M/mês com zero inconsistência contábil."
      - "Otimizou queries e índices PostgreSQL reduzindo tempo de relatório mensal de 4 horas para 12 minutos."

projects:
  - name: "Universal AI Gateway"
    description: "Gateway autônomo com rate-limiting, failover multi-provedor (Gemini/OpenAI/Claude) e cache semântico."
    highlights:
      - "Redução comprovada de 35% nos custos de inferência LLM em ambientes de produção."
      - "Mais de 800 stars no GitHub e utilizado por 15+ empresas parceiras."
    url: "https://github.com/alexandresilva/ai-gateway"
  - name: "Local-First Financial Engine"
    description: "Motor analítico de dados financeiros que processa DREs e fluxos de caixa 100% no navegador sem persistência remota de dados sensíveis."
    highlights:
      - "Arquitetura offline-first com sincronismo seguro e isolamento de tenant via chaves SHA-256."
    url: "https://github.com/alexandresilva/local-financial"

education:
  - institution: "Universidade de São Paulo (USP)"
    area: "Engenharia de Computação"
    studyType: "Bacharelado"
    startDate: "2014-01-01"
    endDate: "2018-12-31"

skills:
  - name: "Arquitetura & Backend"
    level: "Expert"
    keywords: ["TypeScript", "Node.js", "Python", "FastAPI", "Go", "Event-Driven", "Microservices"]
  - name: "Cloud & DevOps"
    level: "Expert"
    keywords: ["Docker", "Kubernetes", "AWS", "Google Cloud", "CI/CD (GitHub Actions)", "Terraform"]
  - name: "AI & Machine Learning"
    level: "Proficient"
    keywords: ["LLM Orchestration", "RAG Pipelines", "Vector Databases", "Prompt Engineering", "watsonx"]
  - name: "Bancos de Dados & Resiliência"
    level: "Expert"
    keywords: ["PostgreSQL", "Redis", "SQLite/Turso", "Supabase", "Idempotência", "Zero-Downtime"]

languages:
  - language: "Português"
    fluency: "Nativo"
  - language: "Inglês"
    fluency: "Fluente / Profissional"

certificates:
  - name: "AWS Certified Solutions Architect – Professional"
    date: "2023-05-20"
    issuer: "Amazon Web Services"
    url: "https://aws.amazon.com/certification/"
  - name: "OpenShift Enterprise Application Developer"
    date: "2022-09-10"
    issuer: "Red Hat"

awards:
  - title: "Outstanding Technical Leadership Award"
    date: "2023-11-01"
    awarder: "Enterprise Tech Solutions"
    summary: "Reconhecimento por liderar a arquitetura zero-downtime da infraestrutura core durante a Black Friday."

interests:
  - name: "Engenharia de Software"
    keywords: ["Sistemas Distribuídos", "Inteligência Artificial Ética", "Open Source"]
`
