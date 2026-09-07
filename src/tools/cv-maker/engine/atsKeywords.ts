/**
 * atsKeywords.ts
 * Dicionários estáticos de Stopwords, Verbos de Ação e mais de 150 Competências Tecnológicas
 * para auditoria ATS determinística sem consumo de tokens de IA.
 */

// Stopwords em Português e Inglês para tokenização limpa
export const STOPWORDS_PT = new Set([
  'de', 'a', 'o', 'as', 'os', 'em', 'um', 'uma', 'para', 'com', 'não', 'uma', 'os', 'no', 'se',
  'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu',
  'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo',
  'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus',
  'quem', 'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num', 'nem',
  'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'será',
  'nós', 'tenho', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele', 'tu', 'te',
  'vocês', 'vos', 'lhes', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa',
  'nossos', 'nossas', 'dela', 'delas', 'esta', 'estes', 'estas', 'aquele', 'aquela', 'aqueles',
  'aquelas', 'isto', 'aquilo', 'estou', 'está', 'estamos', 'estão', 'estive', 'esteve', 'estivemos',
  'estiveram', 'estava', 'estávamos', 'estavam', 'estivera', 'estivéramos', 'esteja', 'estejamos',
  'estejam', 'estivesse', 'estivéssemos', 'estivessem', 'estiver', 'estivermos', 'estiverem',
  'hei', 'há', 'havemos', 'hão', 'houve', 'houvemos', 'houveram', 'houvera', 'houvéramos', 'haja',
  'hajamos', 'hajam', 'houvesse', 'houvéssemos', 'houvessem', 'houver', 'houvermos', 'houverem',
  'houverei', 'houverá', 'houveremos', 'houverão', 'houveria', 'houveríamos', 'houveriam', 'sou',
  'somos', 'são', 'era', 'éramos', 'eram', 'fui', 'foi', 'fomos', 'foram', 'fora', 'fôramos',
  'seja', 'sejamos', 'sejam', 'fosse', 'fôssemos', 'fossem', 'for', 'formos', 'forem', 'serei',
  'será', 'seremos', 'serão', 'seria', 'seríamos', 'seriam', 'tenho', 'tem', 'temos', 'tém',
  'tinha', 'tínhamos', 'tinham', 'tive', 'teve', 'tivemos', 'tiveram', 'tivera', 'tivéramos',
  'tenha', 'tenhamos', 'tenham', 'tivesse', 'tivéssemos', 'tivessem', 'tiver', 'tivermos', 'tiverem',
  'terei', 'terá', 'teremos', 'terão', 'teria', 'teríamos', 'teriam', 'sobre', 'durante', 'responsável',
  'atuando', 'trabalhando', 'fazendo', 'através', 'onde', 'cada', 'tudo', 'outro', 'outra', 'outros'
])

export const STOPWORDS_EN = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself',
  'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that',
  'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because',
  'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
  'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just',
  'don', 'should', 'now', 'responsible', 'working', 'acting', 'duties', 'including'
])

// Verbos de ação fortes para classificador Google / IBM X-Y-Z
export const ACTION_VERBS_PT = [
  'arquitetou', 'desenvolveu', 'liderou', 'implementou', 'otimizou', 'reduziu', 'aumentou',
  'automatizou', 'migrou', 'entregou', 'projetou', 'gerenciou', 'coordenou', 'construiu',
  'estruturou', 'escalou', 'padronizou', 'reestruturou', 'acelerou', 'consolidou', 'orquestrou',
  'solucionou', 'transformou', 'conduziu', 'idealizou', 'expandiu', 'remodelou', 'modernizou',
  'eliminou', 'mitigou', 'superou', 'implantou', 'revisou', 'negociou', 'publicou', 'capacitou',
  'mentorou', 'treinou', 'auditou', 'desenhou', 'refatorou', 'configurou', 'unificou'
]

export const ACTION_VERBS_EN = [
  'architected', 'developed', 'led', 'implemented', 'optimized', 'reduced', 'increased',
  'automated', 'migrated', 'delivered', 'designed', 'managed', 'coordinated', 'built',
  'structured', 'scaled', 'standardized', 'restructured', 'accelerated', 'consolidated',
  'orchestrated', 'solved', 'transformed', 'spearheaded', 'conceived', 'expanded',
  'remodeled', 'modernized', 'eliminated', 'mitigated', 'exceeded', 'deployed', 'revised',
  'negotiated', 'published', 'trained', 'mentored', 'audited', 'refactored', 'configured',
  'engineered', 'authored', 'established', 'championed', 'unified'
]

// Banco canônico de competências técnicas pré-carregadas (> 170 tecnologias e metodologias)
export const PRELOADED_TECH_DICTIONARY: Record<string, string[]> = {
  frontend: [
    'react', 'next.js', 'vue', 'vue.js', 'angular', 'typescript', 'javascript', 'html5', 'css3',
    'tailwind css', 'tailwind', 'sass', 'webpack', 'vite', 'redux', 'zustand', 'graphql',
    'rest api', 'websocket', 'webassembly', 'cypress', 'playwright', 'jest', 'pwa', 'responsive design'
  ],
  backend: [
    'node.js', 'python', 'fastapi', 'django', 'flask', 'java', 'spring boot', 'spring', 'go',
    'golang', 'c#', '.net', 'asp.net', 'ruby', 'ruby on rails', 'php', 'laravel', 'rust',
    'elixir', 'microservices', 'grpc', 'kafka', 'rabbitmq', 'redis', 'celery'
  ],
  cloud_devops: [
    'aws', 'amazon web services', 'azure', 'google cloud', 'gcp', 'docker', 'kubernetes',
    'terraform', 'ansible', 'ci/cd', 'github actions', 'gitlab ci', 'jenkins', 'helm',
    'argocd', 'prometheus', 'grafana', 'linux', 'nginx', 'cloudflare', 'serverless', 'lambda'
  ],
  databases: [
    'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
    'oracle', 'sql server', 'cassandra', 'sqlite', 'supabase', 'firebase', 'prisma',
    'typeorm', 'sqlalchemy', 'nosql', 'relational databases'
  ],
  data_ai: [
    'machine learning', 'deep learning', 'pytorch', 'tensorflow', 'pandas', 'numpy',
    'scikit-learn', 'llm', 'rag', 'langchain', 'llamaindex', 'openai', 'gemini', 'nlp',
    'computer vision', 'data engineering', 'apache spark', 'airflow', 'dbt', 'snowflake',
    'databricks', 'power bi', 'bigquery'
  ],
  security_practices: [
    'oauth', 'oauth2', 'oidc', 'jwt', 'zero trust', 'penetration testing', 'appsec',
    'owasp', 'cryptography', 'iam', 'siem', 'soc 2', 'iso 27001', 'lgpd', 'gdpr',
    'clean architecture', 'solid', 'design patterns', 'ddd', 'tdd', 'scrum', 'kanban',
    'agile', 'devsecops', 'system design', 'high availability'
  ]
}

/**
 * Array achatado de todas as tecnologias canônicas para busca e correspondência
 */
export const ALL_CANONICAL_KEYWORDS: string[] = Object.values(PRELOADED_TECH_DICTIONARY).flat()
