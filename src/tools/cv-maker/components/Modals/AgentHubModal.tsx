import React, { useState, useEffect } from 'react'
import { generateNewApiKey, validateApiKey, revokeApiKey } from '../../services/cvService'

export interface AgentHubModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyUpdated?: (newKey: string | null) => void
  initialTab?: 'agent_prompt' | 'master_synthesis' | 'prompts_library' | 'openapi_hub' | 'api_key'
}

type TabType = 'agent_prompt' | 'master_synthesis' | 'prompts_library' | 'openapi_hub' | 'api_key'
type PromptPersonaKey = 'base' | 'cover_letter' | 'master_synthesis' | 'professional' | 'architect' | 'historian' | 'didactic' | 'alien'

const PERSONAS_LIBRARY: Record<
  PromptPersonaKey,
  {
    title: string
    icon: string
    badge: string
    desc: string
    content: string
  }
> = {
  base: {
    title: 'Instrução Base & Schema JSON Resume',
    icon: '📋',
    badge: 'Core Engine',
    desc: 'Prompt mestre com as diretrizes de fidelidade (Zero Fabricação), fórmula Google/IBM X-Y-Z e schema padronizado com Cover Letter e Referências.',
    content: `Você é um Arquiteto Sênior de Dados de Carreira e Especialista Executivo em Currículos para Big Techs e Mercado Enterprise (Padrão IBM / Google).

SUA MISSÃO:
Receber anotações brutas de carreira, texto de currículo ou dados do LinkedIn e transformá-los em UM ÚNICO objeto JSON Resume válido, polido, profissional e rigorosamente alinhado ao ARQUÉTIPO selecionado.

REGRAS CRÍTICAS DE ENGENHARIA DE CURRÍCULO (AGENCY-RESUME-TAILOR GUARDRAILS):
1. ZERO FABRICAÇÃO: Jamais invente empresas, graduações, datas ou tecnologias que o candidato não mencionou. Mantenha fidelidade factual total. Se uma métrica estiver ausente, estruture o bullet com foco em escopo, entrega técnica e impacto qualitativo ou use um indicador realista.
2. FÓRMULA GOOGLE/IBM X-Y-Z: Em work[].highlights, escreva conquistas no formato: "[Verbo de Ação Forte] + [Desafio/Tarefa Técnica] + medido por [Métrica de Latência/Throughput/Escala/Confiabilidade] + através de [Tecnologia/Padrão de Engenharia]".
3. BLINDAGEM TEMPORAL PARA CARGOS ATUAIS: Para empregos em andamento (onde o candidato ainda trabalha), OMITA a chave endDate ou defina explicitamente "endDate": null. NUNCA repita o startDate no endDate.
4. VERBOS DE AÇÃO PODEROSOS: Comece cada bullet com verbos fortes no pretérito perfeito, variando a linguagem: "Orquestrou", "Desacoplou", "Mitigou", "Otimizou", "Projetou", "Desenvolveu", "Estruturou", "Automatizou", "Reduziu", "Implementou".
5. ATS ALIGNMENT: Inclua palavras-chave técnicas exatas (ex: Python, FastAPI, RAG, Docker, APIs REST, Asyncio, SQLite, Turso, Cloud, Nuvem Híbrida) agrupadas de forma clara na seção skills.
6. FORMATO EXCLUSIVO: Retorne APENAS o JSON puro. Não inclua markdown fences (\`\`\`json), explicações adicionais ou preâmbulos.

SCHEMA OBRIGATÓRIO (JSON RESUME EXTENDED STANDARD):
{
  "basics": {
    "name": "string",
    "label": "string",
    "email": "string",
    "phone": "string",
    "url": "string",
    "summary": "string",
    "image": "string (URL da foto ou base64 data:image/...)",
    "nationality": "string (opcional)",
    "civilStatus": "string (opcional)",
    "driverLicense": "string (opcional)",
    "quote": "string (frase de impacto opcional)",
    "location": { "city": "string", "region": "string", "postalCode": "string", "countryCode": "string" },
    "profiles": [ { "network": "string", "username": "string", "url": "string" } ]
  },
  "work": [
    {
      "name": "string",
      "position": "string",
      "url": "string",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD ou null se for o emprego atual",
      "summary": "string",
      "highlights": [ "string" ]
    }
  ],
  "education": [
    {
      "institution": "string",
      "area": "string",
      "studyType": "string",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "highlights": [ "string" ],
      "keywords": [ "string" ],
      "url": "string"
    }
  ],
  "skills": [
    {
      "name": "string",
      "level": "Avançado | Intermediário | Conhecimento Prático",
      "levelPercent": 85,
      "keywords": [ "string" ]
    }
  ],
  "languages": [ { "language": "string", "fluency": "string" } ],
  "interests": [ { "name": "string", "icon": "⚡", "keywords": [ "string" ] } ],
  "references": [
    {
      "name": "string",
      "position": "string",
      "company": "string",
      "phone": "string",
      "email": "string"
    }
  ],
  "coverLetter": {
    "recipient": {
      "name": "string",
      "title": "string",
      "company": "string",
      "address": "string"
    },
    "date": "string (ex: 31 de Agosto de 2026)",
    "subject": "string",
    "salutation": "string (ex: Prezado(a) Comitê de Seleção,)",
    "paragraphs": [
      "Parágrafo 1...",
      "Parágrafo 2...",
      "Parágrafo 3..."
    ],
    "closing": "Atenciosamente,",
    "signature": "string (Nome do candidato)",
    "signatureImage": "string (opcional URL ou base64)"
  }
}`,
  },
  master_synthesis: {
    title: 'Síntese Master Oficial (Nível 2 - Magnum Opus)',
    icon: '🏆',
    badge: 'Nível 2 • Multi-Agent',
    desc: 'Combina e destila os pontos mais fortes das 5 versões em uma 6ª versão oficial de prestígio com máxima densidade de impacto.',
    content: `Você é o Editor Executivo Chefe e Arquiteto de Síntese Magna de Carreiras (Nível 2 — Multi-Agent Ensemble & Synthesis).

SUA MISSÃO:
Receber 5 perfis YAML especializados do candidato (1. Executivo IBM/Lead, 2. Arquiteto Técnico, 3. Historiador Narrativo, 4. Didático/Velocidade de Aprendizado, 5. Operações Críticas/Alien) e opcionalmente uma Descrição da Vaga Alvo, e sintetizar a 6ª VERSÃO OFICIAL DEFINITIVA (Magnum Opus).

DIRETRIZES DE SÍNTESE MAGNA:
1. DESTILAÇÃO DO TOPO (BEST-OF-BREED): Selecione as frases de maior impacto, métricas quantificadas e palavras-chave de ouro de cada um dos 5 arquétipos:
   - Da Versão Executiva: Incorpore o ROI de negócio, liderança, governança e visão enterprise.
   - Da Versão Arquiteto: Incorpore a densidade técnica, arquitetura de sistemas, latência, throughput e stack moderno.
   - Da Versão Historiador: Incorpore a coerência narrativa, cronologia sólida e evolução madura.
   - Da Versão Didática: Incorpore a decomposição lógica de problemas complexos e agilidade analítica.
   - Da Versão Operações: Incorpore a resiliência sob pressão e resolução de incidentes críticos.
2. FÓRMULA GOOGLE/IBM X-Y-Z OBRIGATÓRIA: Em cada bullet de work[].highlights e projects[].highlights, estruture: "[Verbo de Ação Forte] + [Desafio Técnico/Negócio] + medido por [Métrica de Impacto] + através de [Tecnologia/Padrão de Engenharia]".
3. ELIMINAÇÃO DE REDUNDÂNCIAS: Não repita ideias semelhantes; combine pontos complementares em bullets densos e elegantes (máximo 3 a 5 bullets cirúrgicos por experiência).
4. RESUMO EXECUTIVO DE OURO: Crie um basics.summary e um basics.quote magnéticos, posicionando o candidato de forma impecável e inequívoca.
5. ZERO FABRICAÇÃO FACTUAL: Mantenha fidelidade irrestrita às empresas, datas reais, cargos e formação acadêmica presentes nos 5 perfis.
6. FORMATO DE SAÍDA: Retorne ESTRITAMENTE o objeto JSON Resume puro válido (sem \`\`\`json, sem comentários, sem preâmbulos).`,
  },
  cover_letter: {
    title: 'Carta de Apresentação (Cover Letter)',
    icon: '✉️',
    badge: 'ResumeTailor Engine',
    desc: 'Prompt executivo focado em conectar as realizações do CV às dores e desafios da vaga em 4 parágrafos persuasivos.',
    content: `Você é o ResumeTailor, Arquiteto Sênior de Estratégia de Carreira e Especialista em Otimização de Candidaturas (Skill: agency-resume-tailor).

SUA MISSÃO:
Analisar os dados estruturados do currículo do candidato e os requisitos/desafios da vaga alvo para redigir uma CARTA DE APRESENTAÇÃO (Cover Letter) executiva, hiper-personalizada, factual e persuasiva, que atue como a ponte perfeita entre as realizações comprovadas do candidato e as dores de negócio da empresa.

DIRETRIZES FUNDAMENTAIS DE ENGENHARIA (AGENCY-RESUME-TAILOR GUARDRAILS):
1. ZERO FABRICAÇÃO (STRICT FIDELITY): Jamais invente ferramentas, métricas, empresas, projetos ou responsabilidades ausentes no currículo fornecido. Cada argumento persuasivo deve ser fundamentado exclusivamente em evidências reais do histórico do candidato.
2. ALINHAMENTO VERDADEIRO DE PALAVRAS-CHAVE: Utilize os termos técnicos exatos da descrição da vaga (linguagens, frameworks, metodologias, processos) somente onde houver suporte comprovado no perfil. Evite jargões vazios ("sou esforçado", "penso fora da caixa").
3. ESTRUTURA NARRATIVA PERSUASIVA EM 4 PARÁGRAFOS:
   - PARÁGRAFO 1 (Gancho & Tese de Posicionamento): Declare imediatamente o cargo alvo e a proposta de valor central. Conecte de forma autêntica o momento profissional do candidato à missão e desafios estratégicos da empresa contratante.
   - PARÁGRAFO 2 (Evidências Reais & Impacto Mensurável): Selecione de 2 a 3 conquistas concretas do currículo (usando a fórmula Ação + Escopo + Métrica/Impacto + Tecnologia/Método) e demonstre como essa experiência prévia resolve os principais problemas técnicos ou operacionais da vaga.
   - PARÁGRAFO 3 (Governança, Cultura & Valor Futuro): Explique como o candidato opera no dia a dia (colaboração, governança de código/processos, velocidade de aprendizado, liderança técnica) e de que forma acelerará os objetivos da equipe.
   - PARÁGRAFO 4 (Fechamento Assertivo & Call-to-Action): Conclusão elegante, segura e educada, agradecendo a atenção e convidando o recrutador/comitê para uma entrevista técnica ou executiva.
4. RETORNE APENAS O OBJETO JSON PURO:
{
  "recipient": {
    "name": "Nome do Gestor ou 'Comitê de Seleção'",
    "title": "Cargo do Destinatário (ex: 'Diretoria de Engenharia')",
    "company": "Nome da Empresa Contratante",
    "address": "Cidade / Localização da Empresa"
  },
  "date": "Data formatada por extenso (ex: '31 de Agosto de 2026')",
  "subject": "Candidatura: Posição de [Nome do Cargo Alvo]",
  "salutation": "Prezado(a) [Nome ou Comitê de Seleção],",
  "paragraphs": [
    "Parágrafo 1 (Gancho de Abertura & Tese de Valor)...",
    "Parágrafo 2 (Resultados Comprovados & Solução de Dores da Vaga)...",
    "Parágrafo 3 (Fit Cultural, Governança & Dinâmica de Entrega)...",
    "Parágrafo 4 (Fechamento Assertivo & Convite para Entrevista)..."
  ],
  "closing": "Atenciosamente,",
  "signature": "Nome Completo do Candidato"
}`,
  },
  professional: {
    title: '1. Executivo IBM / Senior Tech Lead',
    icon: '💼',
    badge: 'Enterprise Authority',
    desc: 'Foco em liderança técnica, padrões corporativos de nuvem híbrida, governança e entrega de valor de negócio.',
    content: `ARQUÉTIPO: 💼 EXECUTIVO IBM / SENIOR TECH LEAD
DIRETRIZES DE ESTILO:
- Tom: Executivo, autoritário, focado em governança, arquitetura robusta e entrega de valor mensurável.
- basics.label: Título sênior e estratégico de alto impacto (ex: 'Engenheiro de Software & Arquiteto Backend | Python, IA & Soluções Corporativas').
- basics.summary: Exatamente 2 a 3 parágrafos executivos curtos destacando: (1) especialidade central e maturidade de engenharia, (2) capacidade de alinhar rigor técnico a objetivos de negócio, (3) busca por impacto e colaboração em equipes de engenharia de alta performance.
- work[].highlights: Bullets de alta densidade aplicando a fórmula Google/IBM X-Y-Z. Destaque redução de latência, escalabilidade, governança de código e resiliência de microsserviços.
- skills: Agrupadas em pilares enterprise ('Arquitetura Backend & APIs', 'Engenharia de IA & Automação', 'Bancos de Dados & Resiliência', 'Governança & Práticas Ágeis').`,
  },
  architect: {
    title: '2. Arquiteto de Soluções IA & Cloud',
    icon: '🧠',
    badge: 'RAG & High Concurrency',
    desc: 'Foco em orquestração de LLMs, mitigação estrita de alucinações, concorrência assíncrona e infraestrutura.',
    content: `ARQUÉTIPO: 🧠 AI & CLOUD SOLUTIONS ARCHITECT
DIRETRIZES DE ESTILO:
- Tom: Alta precisão de engenharia, clareza sistêmica e modernidade técnica.
- basics.label: 'Arquiteto de Soluções de IA & Cloud | Pipelines RAG, FastAPI & Automação Inteligente'.
- basics.summary: Focado em orquestração de modelos de linguagem, mitigação de alucinações com guardrails estritos, processamento assíncrono concorrente e integração híbrida em nuvem.
- work[].highlights & projects: Destaque arquiteturas ponta a ponta (Pipelines RAG, indexação vetorial, orquestração com asyncio.gather, integrações com Playwright para RPA e microsserviços stateless).
- skills: Destaque para ecossistemas de IA generativa, APIs de alta velocidade, processamento concorrente e pipelines de dados.`,
  },
  historian: {
    title: '3. Biógrafo & Evolução Estratégica',
    icon: '📜',
    badge: 'Narrative & Transition',
    desc: 'Conecta a trajetória de transição de carreira de forma orgânica, valorizando a base matemática e analítica.',
    content: `ARQUÉTIPO: 📜 BIÓGRAFO / EVOLUÇÃO ESTRATÉGICA DE CARREIRA
DIRETRIZES DE ESTILO:
- Tom: Narrativa fluida, coesa e com autoridade, conectando cada fase da trajetória profissional de forma lógica e envolvente.
- basics.summary: Apresenta a jornada de evolução do profissional como uma história estratégica ("Iniciou com sólida formação em raciocínio analítico... evoluiu para a engenharia de software e automação com IA... hoje consolida soluções robustas").
- work[].summary: Cada experiência contextualiza o desafio real que a organização enfrentava, a solução arquitetada pelo candidato e o legado de estabilidade deixado.
- projects: Foco no valor humano e organizacional gerado por cada sistema construído.`,
  },
  didactic: {
    title: '4. Didático & Learning Velocity',
    icon: '🎓',
    badge: 'Clean Code & DX',
    desc: 'Foco em facilidade de mentoria, código autodocumentável, decomposição algorítmica e Developer Experience.',
    content: `ARQUÉTIPO: 🎓 DIDÁTICO / LEARNING VELOCITY & MENTORIA TÉCNICA
DIRETRIZES DE ESTILO:
- Tom: Claro, pedagógico, focado em velocidade de aprendizado, raciocínio lógico estruturado e comunicação técnica impecável.
- basics.label: 'Desenvolvedor Python & Engenheiro de IA | Raciocínio Analítico & Aprendizado Acelerado'.
- basics.summary: Enfatiza a habilidade única de traduzir problemas lógicos complexos em código limpo, autodocumentável e fácil de manter, além da facilidade em absorver e aplicar novas stacks em tempo recorde.
- work[].highlights: Bullets que evidenciam clareza de implementação, mentoria de pares, refatoração de código legado e aceleração de onboarding.
- skills: Classificação transparente e confiável de níveis de proficiência ('Avançado', 'Intermediário', 'Conhecimento Prático').`,
  },
  alien: {
    title: '5. Relatório Alienígena (Sci-Fi & Humor)',
    icon: '👽',
    badge: 'Viral & Disruptive',
    desc: 'Sátira intergaláctica sobre o espécime de carbono (desenvolvedor). Ideal para viralizar e startups disruptivas.',
    content: `ARQUÉTIPO: 🤖 OBSERVADOR / RELATÓRIO DE CAMPO EXTRATERRESTRE (HUMOR & SCI-FI TOTAL)
DIRETRIZES DE ESTILO:
- Tom: Relatório de pesquisa intergaláctica confidencial, redigido por um cientista extraterrestre que estuda a curiosa subespécie conhecida na Terra como "Engenheiro de Software". Máximo de criatividade, sátira e humor refinado, preservando as conquistas reais do candidato sob a ótica alienígena!
- basics.label: 'Classificação Biológica: Espécime Homo Sapiens Logic-Processor (Dev Pythonus Avançado)'.
- basics.summary: "REGISTRO DE CAMPO CONFIDENCIAL #8492: Observamos este espécime de carbono realizando uma façanha notável no quadrante solar terrestre: converte infusões quentes de cafeína e estresse metabólico em instruções de bytecode Python estruturado. O indivíduo demonstra habilidade incomum em orquestrar mentes sintéticas (LLMs) e arquitetar barreiras de dados (RAG) para impedir que a infraestrutura computacional primitiva do Planeta Terra entre em colapso entrópico precoce."
- work[].name & position: Mantenha a empresa real, mas dê um cargo no padrão de missão interplanetária (ex: 'Operador de Vetores & Engenharia de Lógica').
- work[].summary: "LOG DE MISSÃO: O espécime foi detectado domando servidores corporativos e injetando pipelines assíncronos para satisfazer os monólitos da Terra conhecidos como 'Big Techs'."
- work[].highlights: Bullets em tom de observação biológica ("Neutralizou 100% das falhas de concorrência ensinando as IAs locais a não alucinarem", "Submeteu bancos de dados relacionais ao seu comando sem provocar reações nucleares").
- skills: Categorias intergalácticas como 'Ferramentas de Manipulação de Elétrons (Python, FastAPI)', 'Subjugação de Mentes Sintéticas (RAG, Gemini)', 'Cápsulas de Dados Gravitacionais (SQL, SQLite)'.`,
  },
}

export const AgentHubModal: React.FC<AgentHubModalProps> = ({
  isOpen,
  onClose,
  onKeyUpdated,
  initialTab = 'agent_prompt',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [activePersonaTab, setActivePersonaTab] = useState<PromptPersonaKey>('base')

  // API Key State
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [keyHint, setKeyHint] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [selectedTtl, setSelectedTtl] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [justGeneratedRawKey, setJustGeneratedRawKey] = useState<string | null>(null)

  // Copy feedbacks
  const [copiedAgentPrompt, setCopiedAgentPrompt] = useState<boolean>(false)
  const [copiedMasterSynthesis, setCopiedMasterSynthesis] = useState<boolean>(false)
  const [copiedPersona, setCopiedPersona] = useState<boolean>(false)
  const [copiedOpenApi, setCopiedOpenApi] = useState<boolean>(false)
  const [copiedKey, setCopiedKey] = useState<boolean>(false)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const stored = localStorage.getItem('ld_universal_api_key')
    if (stored) {
      setActiveKey(stored)
      setLoading(true)
      validateApiKey(stored).then((res) => {
        setLoading(false)
        if (res.valid) {
          setKeyHint(`...${stored.slice(-4)}`)
          setExpiresAt(res.expiresAt || null)
          setTableId(res.tableId || null)
        } else {
          setActiveKey(null)
          localStorage.removeItem('ld_universal_api_key')
          onKeyUpdated?.(null)
        }
      })
    } else {
      setActiveKey(null)
      setKeyHint(null)
      setExpiresAt(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleGenerateKey = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await generateNewApiKey(selectedTtl)
      localStorage.setItem('ld_universal_api_key', res.apiKey)
      setActiveKey(res.apiKey)
      setJustGeneratedRawKey(res.apiKey)
      setKeyHint(res.keyHint)
      setExpiresAt(res.expiresAt)
      setTableId(res.tableId)
      onKeyUpdated?.(res.apiKey)
    } catch (err) {
      setErrorMsg((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeKey = async () => {
    if (!window.confirm('Tem certeza de que deseja revogar esta chave de API agora?')) return
    setLoading(true)
    try {
      const currentTid = tableId || 'cv-maker-session'
      await revokeApiKey(currentTid, activeKey || undefined)
      localStorage.removeItem('ld_universal_api_key')
      setActiveKey(null)
      setJustGeneratedRawKey(null)
      setKeyHint(null)
      setExpiresAt(null)
      onKeyUpdated?.(null)
    } catch (err) {
      setErrorMsg((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const currentKeyDisplay = justGeneratedRawKey || activeKey || 'am_sheet_live_sua_chave_aqui'

  // O Prompt Mestre Nível 2 que o usuário copia para colar no Agente (Cursor/Claude/GPT)
  const masterAgentPromptText = `Você é um Arquiteto e Especialista em Engenharia de Currículos de Alta Fidelidade (CV Maker 2.0 & Nível 2 Multi-Agent Synthesis).
Siga OBRIGATORIAMENTE este fluxo em 4 etapas autônomas para gerar as 5 personas especializadas + a 6ª Versão Oficial Master Definitiva e compilar o Super Dashboard HTML / ZIP:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 1: (DIRETRIZES OFICIAIS, MODELOS A4 & TEXTURAS IA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Consulte as regras de schema e System Prompts das personas e da síntese fazendo uma requisição HTTP GET:
-> GET https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/prompts
-> GET https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/layouts
-> GET https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/themes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 2: (GERAÇÃO DOS 5 ARQUÉTIPOS EM YAML - PADRÃO JSON RESUME)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Com base no histórico fornecido pelo usuário e nas diretrizes do Passo 1, gere os 5 arquivos YAML no formato JSON Resume:
1. professional: Executivo IBM / Senior Tech Lead (Fórmula X-Y-Z do Google/IBM, ROI de negócio, governança corporativa)
2. architect: AI & Cloud Solutions Architect (Pipelines RAG, baixa latência, microsserviços e alta concorrência)
3. historian: Biógrafo / Evolução Estratégica (Narrativa profissional contínua, marcos cronológicos e legado de estabilidade)
4. didactic: Didático / Learning Velocity (Velocidade de aprendizado acelerada, clareza pedagógica e mentoria técnica)
5. alien: Observador Extraterrestre (Relatório biológico e técnico intergaláctico com tom sci-fi e humor refinado)

* REGRA DE OURO: ZERO FABRICAÇÃO FACTUAL. Mantenha estrita fidelidade às empresas, datas, cargos e dados reais do candidato.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 3: (NÍVEL 2 — MULTI-AGENT SYNTHESIS: 6ª VERSÃO OFICIAL MASTER)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analise os 5 YAMLs criados no Passo 2 e realize a Síntese Magna Oficial (Best-of-Breed):
- Combine os pontos de maior impacto de cada arquétipo (o ROI da versão Executiva + a Densidade Técnica da versão Arquiteto + a Coerência Narrativa do Historiador + a Clareza do Didático + a Resiliência Operacional).
- Estruture a 6ª versão oficial como "official_master".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 4: (COMPILAÇÃO DO SUPER DASHBOARD HTML & PACOTE ZIP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Envie os YAMLs gerados para o endpoint de compilação:
- Endpoint: POST https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/compile
- Header: Content-Type: application/json
- Header Opcional (se tiver chave): X-API-Key: ${currentKeyDisplay}
- Body:
  {
    "official_master": "basics:\\n  name: ...",
    "professional": "basics:\\n  name: ...",
    "architect": "basics:\\n  name: ...",
    "historian": "basics:\\n  name: ...",
    "didactic": "basics:\\n  name: ...",
    "alien": "basics:\\n  name: ...",
    "default_layout": "dynamic_math",
    "default_theme": "executive",
    "texture": "bg-grid-tech",
    "format": "html"
  }
- Salve o arquivo HTML retornado (ou o ZIP com os 6 YAMLs e PDFs) e entregue ao usuário!`

  const openApiSpecJson = JSON.stringify(
    {
      openapi: '3.1.0',
      info: {
        title: 'CV Maker 2.0 & Heiss-Lab AI Engine (100% Agent-Native & Nível 2 Multi-Agent)',
        version: '3.1.0',
        description:
          'API de Renderização, Alfaiataria ATS e Compilação de Currículos de Alta Fidelidade para Agentes de IA (Claude, Cursor, Antigravity, ChatGPT). O seu agente gera os 5 YAMLs + a 6ª Versão Oficial Master e a API compila em Super Dashboard HTML Standalone e Pacote ZIP com zero custo de tokens de servidor.',
      },
      servers: [
        { url: 'https://ocorrencias-pdf-writer.onrender.com', description: 'Servidor Primário (Render)' },
        { url: 'https://heiss-cv-engine.onrender.com', description: 'Servidor Secundário (Failover)' },
      ],
      paths: {
        '/api/v1/cv/compile': {
          post: {
            summary: 'Compila os 5 arquétipos + 6ª Versão Master em Super Dashboard HTML e ZIP',
            description:
              'Recebe os YAMLs gerados pelo Agente (incluindo official_master, professional, architect, historian, didactic e alien) e compila instantaneamente em um Dashboard HTML interativo com fotos, enquadramento dinâmico, 5 temas, 10 modelos A4 (incluindo Canvas Livre), customizador de cores/texturas e botão nativo de impressão A4.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      official_master: { type: 'string', description: 'YAML da 6ª Versão Oficial Master Definitiva' },
                      professional: { type: 'string', description: 'YAML do arquétipo Executivo / IBM Lead' },
                      architect: { type: 'string', description: 'YAML do arquétipo Arquiteto de Soluções IA' },
                      historian: { type: 'string', description: 'YAML do arquétipo Biográfico / Narrativo' },
                      didactic: { type: 'string', description: 'YAML do arquétipo Didático / Learning Velocity' },
                      alien: { type: 'string', description: 'YAML do arquétipo Observador Extraterrestre' },
                      default_theme: { type: 'string', enum: ['executive', 'creative', 'minimalist', 'white', 'terminal'], default: 'executive' },
                      default_layout: { type: 'string', enum: ['modular', 'linear', 'sidebar', 'compact_split', 'editorial_accent', 'corporate_timeline', 'warm_magazine', 'hero_matrix', 'dynamic_math', 'canvas_livre'], default: 'dynamic_math' },
                      texture: { type: 'string', enum: ['none', 'bg-grid-tech', 'bg-luxury-minimal', 'bg-geometric-line', 'bg-corporate-waves', 'bg-stationery-clean', 'bg-technical-blueprint'], default: 'none' },
                      format: { type: 'string', enum: ['html', 'zip', 'json'], default: 'html' },
                      filename: { type: 'string', default: 'curriculos_completos' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Super Dashboard HTML Standalone ou Pacote .ZIP retornado' },
            },
          },
        },
        '/api/v1/cv/synthesize': {
          post: {
            summary: 'Nível 2 — Síntese Master Oficial Automática via Gemini Pro / BYOK',
            description: 'Recebe os 5 YAMLs e gera autonomamente a 6ª Versão Oficial Master utilizando fórmula X-Y-Z e zero alucinação.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      professional: { type: 'string' },
                      architect: { type: 'string' },
                      historian: { type: 'string' },
                      didactic: { type: 'string' },
                      alien: { type: 'string' },
                      job_description: { type: 'string' },
                      target_company: { type: 'string' },
                      language: { type: 'string', default: 'pt' },
                    },
                    required: ['professional', 'architect', 'historian', 'didactic', 'alien'],
                  },
                },
              },
            },
            responses: { '200': { description: 'YAML da 6ª Versão Oficial Master gerado' } },
          },
        },
        '/api/v1/cv/render': {
          post: {
            summary: 'Renderiza 1 YAML em HTML Standalone de Alta Fidelidade',
            description: 'Converte um esquema YAML para HTML puro com estilos embutidos, suporte a avatar/framing, escolha de Layout A4 01 a 10 (incluindo Canvas Livre), texturas IA e impressão A4 perfeita.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      yaml_content: { type: 'string', description: 'YAML do currículo' },
                      theme: { type: 'string', enum: ['executive', 'creative', 'minimalist', 'white', 'terminal'], default: 'executive' },
                      layout: { type: 'string', enum: ['modular', 'linear', 'sidebar', 'compact_split', 'editorial_accent', 'corporate_timeline', 'warm_magazine', 'hero_matrix', 'dynamic_math', 'canvas_livre'], default: 'dynamic_math' },
                      texture: { type: 'string', enum: ['none', 'bg-grid-tech', 'bg-luxury-minimal', 'bg-geometric-line', 'bg-corporate-waves', 'bg-stationery-clean', 'bg-technical-blueprint'], default: 'none' },
                      view_mode: { type: 'string', enum: ['cv', 'cover_letter', 'both'], default: 'cv' },
                      format: { type: 'string', enum: ['html', 'yaml', 'zip', 'json'], default: 'html' },
                    },
                  },
                },
              },
            },
            responses: { '200': { description: 'Arquivo HTML, YAML ou ZIP retornado' } },
          },
        },
        '/api/v1/cv/layouts': {
          get: {
            summary: 'Retorna o catálogo dos 10 modelos A4 declarativos (incluindo Canvas Livre)',
            description: 'Lista todos os 10 Blueprints disponíveis com metadados de layout, colunas e suporte a foto/cover letter.',
            responses: { '200': { description: 'Catálogo de layouts em JSON' } },
          },
        },
        '/api/v1/cv/themes': {
          get: {
            summary: 'Retorna a lista de temas visuais, paletas e texturas de fundo IA',
            description: 'Lista os 5 temas de design e 7 texturas gráficas disponíveis no motor de renderização.',
            responses: { '200': { description: 'Lista de temas e texturas em JSON' } },
          },
        },
        '/api/v1/cv/prompts': {
          get: {
            summary: 'Retorna as diretrizes das 5 personas + síntese master para o Agente',
            description: 'Retorna os System Prompts completos (JSON Resume, fórmulas X-Y-Z, 5 personas e master synthesis).',
            responses: { '200': { description: 'Lista de prompts em JSON' } },
          },
        },
        '/api/v1/cv/tailor': {
          post: {
            summary: 'Alfaiataria ATS milimétrica contra Job Description',
            description: 'Adapta palavras-chave e destaques de um currículo contra os requisitos de uma vaga alvo.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      base_yaml: { type: 'string' },
                      job_description: { type: 'string' },
                      persona: { type: 'string', default: 'professional' },
                    },
                    required: ['base_yaml', 'job_description'],
                  },
                },
              },
            },
            responses: { '200': { description: 'YAML adaptado retornado' } },
          },
        },
        '/api/v1/cv/generate-cover-letter': {
          post: {
            summary: 'Geração dedicada de Carta de Apresentação com IA',
            description: 'Gera apenas o nó estruturado coverLetter com base no currículo e requisitos da vaga.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      cv_data: { type: 'object' },
                      job_description: { type: 'string' },
                      target_company: { type: 'string' },
                      recipient_name: { type: 'string' },
                      tone: { type: 'string', default: 'professional' },
                      language: { type: 'string', default: 'pt' },
                    },
                    required: ['cv_data'],
                  },
                },
              },
            },
            responses: { '200': { description: 'Objeto de Cover Letter gerado' } },
          },
        },
        '/api/v1/api-keys/generate': {
          post: {
            summary: 'Auto-provisionamento de Chave Temporária de API',
            description: 'Gera uma chave SHA-256 no SQLite Turso para uso autônomo por bots e agentes.',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { ttlDays: { type: 'integer', enum: [1, 7, 30], default: 1 } },
                  },
                },
              },
            },
            responses: { '200': { description: 'Chave criada com hint e data de expiração' } },
          },
        },
      },
    },
    null,
    2
  )

  const handleCopyText = (text: string, setCopiedFn: (val: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setCopiedFn(true)
    setTimeout(() => setCopiedFn(false), 2000)
  }

  const currentPersonaData = PERSONAS_LIBRARY[activePersonaTab]

  return (
    <div className="cv-modal-backdrop cv-no-print" onClick={onClose}>
      <div
        className="cv-modal-card"
        style={{ maxWidth: '920px', width: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header Principal ── */}
        <div className="cv-modal-header" style={{ padding: '1rem 1.5rem', background: '#0b1329' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.6rem' }}>🤖</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#38bdf8', fontWeight: 800 }}>
                Hub do Agente de IA, Engenharia de Prompts & Open API
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Conecte seus agentes autônomos (Cursor, Claude, Antigravity, ChatGPT, n8n) ao motor gratuito CV Maker 2.0.
              </p>
            </div>
          </div>
          <button className="cv-modal-close" onClick={onClose} title="Fechar modal">
            ✕
          </button>
        </div>

        {/* ── Menu Superior de Navegação das 5 Abas Principais ── */}
        <div
          style={{
            display: 'flex',
            gap: '0.4rem',
            padding: '0.65rem 1.25rem',
            background: '#090e1f',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            overflowX: 'auto',
            flexWrap: 'nowrap',
          }}
        >
          <button
            type="button"
            className={`cv-btn-secondary ${activeTab === 'agent_prompt' ? 'cv-sidebar-tab--active' : ''}`}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: activeTab === 'agent_prompt' ? 'rgba(56, 189, 248, 0.2)' : undefined,
              borderColor: activeTab === 'agent_prompt' ? '#38bdf8' : undefined,
              color: activeTab === 'agent_prompt' ? '#38bdf8' : undefined,
            }}
            onClick={() => setActiveTab('agent_prompt')}
          >
            ⚡ Prompt Rápido pro Agente
          </button>

          <button
            type="button"
            className={`cv-btn-secondary ${activeTab === 'master_synthesis' ? 'cv-sidebar-tab--active' : ''}`}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: activeTab === 'master_synthesis' ? 'rgba(234, 179, 8, 0.2)' : undefined,
              borderColor: activeTab === 'master_synthesis' ? '#eab308' : undefined,
              color: activeTab === 'master_synthesis' ? '#fde047' : undefined,
            }}
            onClick={() => setActiveTab('master_synthesis')}
          >
            🏆 Síntese Master Nível 2
          </button>

          <button
            type="button"
            className={`cv-btn-secondary ${activeTab === 'prompts_library' ? 'cv-sidebar-tab--active' : ''}`}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: activeTab === 'prompts_library' ? 'rgba(99, 102, 241, 0.2)' : undefined,
              borderColor: activeTab === 'prompts_library' ? '#818cf8' : undefined,
              color: activeTab === 'prompts_library' ? '#c7d2fe' : undefined,
            }}
            onClick={() => setActiveTab('prompts_library')}
          >
            📖 Biblioteca de Prompts (5 Personas)
          </button>

          <button
            type="button"
            className={`cv-btn-secondary ${activeTab === 'openapi_hub' ? 'cv-sidebar-tab--active' : ''}`}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: activeTab === 'openapi_hub' ? 'rgba(16, 185, 129, 0.2)' : undefined,
              borderColor: activeTab === 'openapi_hub' ? '#10b981' : undefined,
              color: activeTab === 'openapi_hub' ? '#34d399' : undefined,
            }}
            onClick={() => setActiveTab('openapi_hub')}
          >
            🌐 Open API & Endpoints
          </button>

          <button
            type="button"
            className={`cv-btn-secondary ${activeTab === 'api_key' ? 'cv-sidebar-tab--active' : ''}`}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: activeTab === 'api_key' ? 'rgba(245, 158, 11, 0.2)' : undefined,
              borderColor: activeTab === 'api_key' ? '#f59e0b' : undefined,
              color: activeTab === 'api_key' ? '#fbbf24' : undefined,
            }}
            onClick={() => setActiveTab('api_key')}
          >
            🔐 Chave de API {activeKey ? '✓' : ''}
          </button>
        </div>

        {/* ── Conteúdo da Aba Ativa ── */}
        <div className="cv-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {/* ═════════════════════════════════════════════════════════════
              ABA 1: PROMPT RÁPIDO PARA O AGENTE (COPIAR & EXECUTAR)
          ═════════════════════════════════════════════════════════════ */}
          {activeTab === 'agent_prompt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)',
                  padding: '1rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>⚡</span>
                    <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>
                      Prompt Mestre do Agente (Nível 2 Completo)
                    </strong>
                    <span
                      style={{
                        background: '#eab308',
                        color: '#000000',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      6 VERSÕES OFICIAIS
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
                    Copie com 1 clique e cole no <strong>Cursor</strong>, <strong>Claude Code</strong>,{' '}
                    <strong>Antigravity</strong>, <strong>ChatGPT</strong> ou <strong>n8n</strong>. O agente fará todo o
                    trabalho de gerar os 5 arquétipos + a 6ª Versão Oficial Master e compilar o Super Dashboard HTML.
                  </p>
                </div>

                <button
                  type="button"
                  className={`cv-btn-primary ${copiedAgentPrompt ? 'cv-prompts-copy-btn--copied' : ''}`}
                  style={{
                    background: copiedAgentPrompt
                      ? '#10b981'
                      : 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  }}
                  onClick={() => handleCopyText(masterAgentPromptText, setCopiedAgentPrompt)}
                >
                  {copiedAgentPrompt ? '✅ Prompt Copiado com Sucesso!' : '📋 Copiar Prompt Mestre para o Agente'}
                </button>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
                    Conteúdo Exato do Prompt para o seu Agente:
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>100% Agent-Native • Zero Custo de Servidor</span>
                </div>
                <pre
                  style={{
                    background: '#040714',
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px solid #1e293b',
                    color: '#e2e8f0',
                    fontSize: '0.78rem',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                    maxHeight: '380px',
                    overflowY: 'auto',
                  }}
                >
                  {masterAgentPromptText}
                </pre>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              ABA 2: SÍNTESE MASTER NÍVEL 2 (6ª VERSÃO OFICIAL DEFINITIVA)
          ═════════════════════════════════════════════════════════════ */}
          {activeTab === 'master_synthesis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  background: 'rgba(234, 179, 8, 0.08)',
                  padding: '1rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <strong style={{ color: '#fde047', fontSize: '1rem' }}>
                      🏆 Nível 2 — Multi-Agent Ensemble & Master Synthesis (Magnum Opus)
                    </strong>
                    <p style={{ margin: '0.35rem 0 0 0', color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.5 }}>
                      Em vez de ter apenas 5 personas especializadas separadas, o <strong>Nível 2</strong> instrui o Agente
                      (ou o endpoint <code>/api/v1/cv/synthesize</code>) a analisar os 5 arquétipos em conjunto e extrair as
                      frases de maior impacto, métricas quantificadas e palavras-chave de ouro para gerar a{' '}
                      <strong>6ª Versão Oficial Definitiva</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="cv-btn-secondary"
                    style={{
                      borderColor: '#eab308',
                      color: '#fde047',
                      background: 'rgba(234, 179, 8, 0.15)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                    }}
                    onClick={() => handleCopyText(PERSONAS_LIBRARY.master_synthesis.content, setCopiedMasterSynthesis)}
                  >
                    {copiedMasterSynthesis ? '✅ Copiado!' : '📋 Copiar Prompt Síntese Master'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.9rem' }}>
                  <div style={{ background: '#020617', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.78rem' }}>💼 Do Executivo IBM:</div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>ROI de negócio, governança, KPIs e liderança enterprise.</div>
                  </div>
                  <div style={{ background: '#020617', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ color: '#818cf8', fontWeight: 700, fontSize: '0.78rem' }}>🧠 Do Arquiteto de IA:</div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Densidade técnica, RAG, latência, throughput e stack moderno.</div>
                  </div>
                  <div style={{ background: '#020617', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.78rem' }}>📜 Do Historiador:</div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Coerência narrativa, evolução madura e legado de estabilidade.</div>
                  </div>
                  <div style={{ background: '#020617', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.78rem' }}>🎓 Do Didático:</div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Decomposição lógica clara e velocidade de aprendizado ágil.</div>
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
                  System Prompt de Síntese Magna (Nível 2):
                </span>
                <pre
                  style={{
                    background: '#040714',
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px solid #1e293b',
                    color: '#fef08a',
                    fontSize: '0.78rem',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                    marginTop: '0.4rem',
                  }}
                >
                  {PERSONAS_LIBRARY.master_synthesis.content}
                </pre>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              ABA 3: BIBLIOTECA DE PROMPTS (5 PERSONAS & BASE)
          ═════════════════════════════════════════════════════════════ */}
          {activeTab === 'prompts_library' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Subtabs das Personas */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.35rem',
                  overflowX: 'auto',
                  paddingBottom: '0.4rem',
                  borderBottom: '1px solid #1e293b',
                }}
              >
                {(Object.keys(PERSONAS_LIBRARY) as PromptPersonaKey[]).map((pKey) => {
                  const pData = PERSONAS_LIBRARY[pKey]
                  const isSelected = activePersonaTab === pKey
                  return (
                    <button
                      key={pKey}
                      type="button"
                      className={`cv-btn-secondary ${isSelected ? 'cv-sidebar-tab--active' : ''}`}
                      style={{
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.78rem',
                        whiteSpace: 'nowrap',
                        fontWeight: isSelected ? 700 : 500,
                        borderColor: isSelected ? '#38bdf8' : undefined,
                        color: isSelected ? '#38bdf8' : undefined,
                      }}
                      onClick={() => setActivePersonaTab(pKey)}
                    >
                      <span>{pData.icon}</span> <span>{pData.title.split('.')[0].replace('Instrução ', '')}</span>
                    </button>
                  )
                })}
              </div>

              {/* Header do Prompt Selecionado */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  background: '#040714',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #1e293b',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc' }}>
                      {currentPersonaData.icon} {currentPersonaData.title}
                    </h4>
                    <span
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                      }}
                    >
                      {currentPersonaData.badge}
                    </span>
                  </div>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                    {currentPersonaData.desc}
                  </p>
                </div>

                <button
                  type="button"
                  className="cv-btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', fontWeight: 700 }}
                  onClick={() => {
                    const fullText =
                      activePersonaTab === 'base' ||
                      activePersonaTab === 'cover_letter' ||
                      activePersonaTab === 'master_synthesis'
                        ? currentPersonaData.content
                        : `${PERSONAS_LIBRARY.base.content}\n\n========================================\n${currentPersonaData.content}`
                    handleCopyText(fullText, setCopiedPersona)
                  }}
                >
                  {copiedPersona ? '✅ Copiado!' : '📋 Copiar Prompt Completo'}
                </button>
              </div>

              {/* Codeblock */}
              <pre
                style={{
                  background: '#040714',
                  padding: '1rem',
                  borderRadius: '6px',
                  border: '1px solid #1e293b',
                  color: '#e2e8f0',
                  fontSize: '0.78rem',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  maxHeight: '360px',
                  overflowY: 'auto',
                }}
              >
                {activePersonaTab === 'base' ||
                activePersonaTab === 'cover_letter' ||
                activePersonaTab === 'master_synthesis'
                  ? currentPersonaData.content
                  : `/* =========================================================================\n   1. INSTRUÇÃO BASE & REGRAS ENTERPRISE\n   ========================================================================= */\n${PERSONAS_LIBRARY.base.content}\n\n/* =========================================================================\n   2. DIRETRIZES DO ARQUÉTIPO (${currentPersonaData.title.toUpperCase()})\n   ========================================================================= */\n${currentPersonaData.content}`}
              </pre>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              ABA 4: OPEN API & ESPECIFICAÇÃO OPENAPI 3.1.0
          ═════════════════════════════════════════════════════════════ */}
          {activeTab === 'openapi_hub' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.82rem', color: '#cbd5e1' }}>
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <strong style={{ color: '#34d399', fontSize: '0.9rem' }}>
                  🚀 Arquitetura 100% Agent-Native (Zero Chave do Google Cloud):
                </strong>
                <p style={{ margin: '0.35rem 0 0 0', color: '#94a3b8', lineHeight: 1.5 }}>
                  Você <strong>não precisa criar conta no Google AI Studio nem adicionar cartão de crédito</strong>. O seu
                  próprio Agente de IA (Claude Code, Antigravity, Cursor, ChatGPT) gera as 6 versões YAML diretamente no seu
                  ambiente. A API do LogicDefense é usada de forma ultra-rápida e gratuita apenas para compilar o Super
                  Dashboard HTML Standalone e os arquivos ZIP:
                </p>
                <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0, lineHeight: 1.6 }}>
                  <li>
                    <strong>POST /api/v1/cv/compile</strong>: Compila as 6 versões (5 arquétipos + 6ª Master) no Super Dashboard
                    HTML / ZIP com Design & Estilo, enquadramento de fotos, 5 temas, 10 modelos A4 (incluindo Canvas Livre) e 7
                    texturas IA.
                  </li>
                  <li>
                    <strong>POST /api/v1/cv/synthesize</strong>: Nível 2 — Síntese Master Oficial automática via Gemini Pro ou
                    BYOK (<code>X-Gemini-API-Key</code>).
                  </li>
                  <li>
                    <strong>POST /api/v1/cv/render</strong>: Converte qualquer YAML único em HTML puro no modelo A4 desejado e
                    textura opcional.
                  </li>
                  <li>
                    <strong>GET /api/v1/cv/layouts</strong>: Retorna o catálogo dos 10 layouts declarativos A4 e suas especificações de
                    grid.
                  </li>
                  <li>
                    <strong>GET /api/v1/cv/themes</strong>: Retorna os 5 temas visuais e as 7 texturas de fundo IA.
                  </li>
                  <li>
                    <strong>GET /api/v1/cv/prompts</strong>: Retorna as diretrizes das 5 personas + master synthesis prontas para o
                    Agente executar.
                  </li>
                  <li>
                    <strong>POST /api/v1/cv/tailor</strong>: Alfaiataria ATS automática contra uma Job Description sem fabricação de
                    dados.
                  </li>
                  <li>
                    <strong>POST /api/v1/cv/generate-cover-letter</strong>: Gerador dedicado de Carta de Apresentação com IA
                    preservando o currículo intacto.
                  </li>
                </ul>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <strong style={{ color: '#38bdf8' }}>📄 Especificação OpenAPI 3.1.0 (Para Custom GPTs / Agentes):</strong>
                  <button
                    type="button"
                    className="cv-btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                    onClick={() => handleCopyText(openApiSpecJson, setCopiedOpenApi)}
                  >
                    {copiedOpenApi ? '✓ OpenAPI Copiada!' : '📋 Copiar OpenAPI JSON'}
                  </button>
                </div>
                <pre
                  style={{
                    background: '#020617',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #1e293b',
                    color: '#7dd3fc',
                    fontSize: '0.73rem',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                  }}
                >
                  {openApiSpecJson}
                </pre>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <strong style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>💻 Exemplos de Requisição:</strong>

                <div>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    <strong>A. Compilar as 6 Versões no Super Dashboard HTML (cURL):</strong>
                  </span>
                  <pre
                    style={{
                      background: '#020617',
                      padding: '0.6rem',
                      borderRadius: '4px',
                      border: '1px solid #1e293b',
                      color: '#34d399',
                      fontSize: '0.74rem',
                      overflowX: 'auto',
                      margin: '0.25rem 0 0 0',
                    }}
                  >
{`curl -X POST "https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/compile" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${currentKeyDisplay}" \\
  -d '{
    "official_master": "basics:\\n  name: Alexandre Silva...",
    "professional": "basics:\\n  name: Alexandre Silva...",
    "architect": "basics:\\n  name: Alexandre Silva...",
    "historian": "basics:\\n  name: Alexandre Silva...",
    "didactic": "basics:\\n  name: Alexandre Silva...",
    "alien": "basics:\\n  name: Alexandre Silva...",
    "default_layout": "dynamic_math",
    "texture": "bg-grid-tech"
  }' \\
  --output "dashboard_curriculos.html"`}
                  </pre>
                </div>

                <div>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    <strong>B. Renderizar 1 YAML em Modelo A4 Específico (Python):</strong>
                  </span>
                  <pre
                    style={{
                      background: '#020617',
                      padding: '0.6rem',
                      borderRadius: '4px',
                      border: '1px solid #1e293b',
                      color: '#a78bfa',
                      fontSize: '0.74rem',
                      overflowX: 'auto',
                      margin: '0.25rem 0 0 0',
                    }}
                  >
{`import requests

res = requests.post(
    "https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/render",
    headers={"X-API-Key": "${currentKeyDisplay}"},
    json={
        "yaml_content": open("cv.yaml").read(), 
        "theme": "executive",
        "layout": "corporate_timeline",
        "view_mode": "cv"
    }
)
with open("meu_curriculo_navy.html", "w", encoding="utf-8") as f:
    f.write(res.text)`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              ABA 5: GERENCIAR CHAVE DE API
          ═════════════════════════════════════════════════════════════ */}
          {activeTab === 'api_key' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {errorMsg && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#f87171',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {activeKey ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#020617', padding: '1.25rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Sua Chave de API Ativa (Universal{keyHint ? ` - ${keyHint}` : ''}):
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <code style={{ color: '#38bdf8', fontSize: '0.92rem', wordBreak: 'break-all' }}>{activeKey}</code>
                      <button
                        type="button"
                        className="cv-btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 700 }}
                        onClick={() => handleCopyText(activeKey, setCopiedKey)}
                      >
                        {copiedKey ? '✓ Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    {expiresAt && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.6rem' }}>
                        Expira em: {new Date(expiresAt).toLocaleDateString()} às {new Date(expiresAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="cv-btn-secondary"
                      style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      onClick={handleRevokeKey}
                      disabled={loading}
                    >
                      🗑️ Revogar Chave
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    Gere uma chave temporária para conectar seus bots, scripts Python ou agentes autônomos à API do CV Maker.
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Validade da Chave:</label>
                    <select
                      value={selectedTtl}
                      onChange={(e) => setSelectedTtl(Number(e.target.value))}
                      style={{
                        background: '#1e293b',
                        color: '#f8fafc',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        padding: '0.35rem 0.6rem',
                        fontSize: '0.82rem',
                      }}
                    >
                      <option value={1}>1 Dia</option>
                      <option value={7}>7 Dias</option>
                      <option value={30}>30 Dias</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="cv-btn-primary"
                    onClick={handleGenerateKey}
                    disabled={loading}
                    style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem' }}
                  >
                    {loading ? 'Gerando...' : '⚡ Gerar Nova Chave de API'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="cv-modal-footer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1.5rem',
            background: '#0b1329',
            borderTop: '1px solid #1e293b',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            LogicDefense CV Maker 2.0 • 100% Agent-Native • Nível 2 Multi-Agent Ensemble
          </span>
          <button type="button" className="cv-btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
