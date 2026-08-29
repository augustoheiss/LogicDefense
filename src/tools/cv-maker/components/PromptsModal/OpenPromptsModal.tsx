import React, { useState } from 'react'

interface OpenPromptsModalProps {
  isOpen: boolean
  onClose: () => void
}

type PromptTab = 'base' | 'professional' | 'architect' | 'historian' | 'didactic' | 'alien'

const PROMPTS_DATA: Record<
  PromptTab,
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
    desc: 'Prompt mestre com as diretrizes de fidelidade (Zero Fabricação), fórmula Google X-Y-Z e schema padronizado.',
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

SCHEMA OBRIGATÓRIO (JSON RESUME STANDARD):
{
  "basics": {
    "name": "string",
    "label": "string",
    "email": "string",
    "phone": "string",
    "url": "string",
    "summary": "string",
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
      "keywords": [ "string" ]
    }
  ],
  "languages": [ { "language": "string", "fluency": "string" } ],
  "interests": [ { "name": "string", "keywords": [ "string" ] } ]
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

export const OpenPromptsModal: React.FC<OpenPromptsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<PromptTab>('base')
  const [copied, setCopied] = useState<boolean>(false)

  if (!isOpen) return null

  const current = PROMPTS_DATA[activeTab]

  const handleCopy = () => {
    // Monta o prompt completo: se não for a base, combina a base com a persona!
    const fullText =
      activeTab === 'base'
        ? current.content
        : `${PROMPTS_DATA.base.content}\n\n========================================\n${current.content}`

    navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="cv-modal-overlay" onClick={onClose}>
      <div
        className="cv-modal-content cv-prompts-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '95%' }}
      >
        {/* ── Modal Header ── */}
        <div className="cv-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📖</span>
            <div>
              <h3 className="cv-modal-title" style={{ fontSize: '1.15rem', color: '#38bdf8' }}>
                Engenharia de Prompts Aberta (100% Grátis)
              </h3>
              <p className="cv-modal-desc" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Utilize nossos System Prompts otimizados no ChatGPT, Claude, Cursor ou Ollama local.
              </p>
            </div>
          </div>
          <button className="cv-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* ── Tutorial Rápido de Uso ── */}
        <div className="cv-prompts-tutorial-banner">
          <span style={{ fontSize: '1.2rem' }}>💡</span>
          <div>
            <strong>Como usar gratuitamente nos seus próprios modelos:</strong>
            <ol style={{ margin: '0.25rem 0 0 1.2rem', padding: 0, fontSize: '0.78rem' }}>
              <li>Escolha o arquétipo abaixo e clique em <strong>"📋 Copiar Prompt Completo"</strong>.</li>
              <li>Cole no <strong>ChatGPT (GPT-4o)</strong> ou <strong>Claude 3.5 Sonnet</strong> como System Prompt.</li>
              <li>Envie seu currículo bruto no chat e receba o JSON Resume gerado.</li>
              <li>Cole o JSON no nosso <strong>Editor YAML</strong> para exportar o PDF A4 na hora!</li>
            </ol>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="cv-prompts-tabs">
          {(Object.keys(PROMPTS_DATA) as PromptTab[]).map((tabKey) => {
            const tab = PROMPTS_DATA[tabKey]
            return (
              <button
                key={tabKey}
                className={`cv-prompts-tab-btn ${activeTab === tabKey ? 'cv-prompts-tab-btn--active' : ''}`}
                onClick={() => setActiveTab(tabKey)}
              >
                <span>{tab.icon}</span>
                <span>{tabKey === 'base' ? 'Instrução Base' : tab.title.split('.')[1] || tab.title}</span>
              </button>
            )
          })}
        </div>

        {/* ── Tab Content & Prompt Viewer ── */}
        <div className="cv-prompts-viewer">
          <div className="cv-prompts-viewer__header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>
                  {current.icon} {current.title}
                </h4>
                <span className="cv-prompts-pill">{current.badge}</span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                {current.desc}
              </p>
            </div>

            <button
              className={`cv-prompts-copy-btn ${copied ? 'cv-prompts-copy-btn--copied' : ''}`}
              onClick={handleCopy}
            >
              {copied ? '✅ Prompt Copiado!' : '📋 Copiar Prompt Completo'}
            </button>
          </div>

          <pre className="cv-prompts-codeblock">
            <code>
              {activeTab === 'base'
                ? current.content
                : `/* =========================================================================\n   1. INSTRUÇÃO BASE & REGRAS ENTERPRISE\n   ========================================================================= */\n${PROMPTS_DATA.base.content}\n\n/* =========================================================================\n   2. DIRETRIZES ESPECÍFICAS DO ARQUÉTIPO (${current.title.toUpperCase()})\n   ========================================================================= */\n${current.content}`}
            </code>
          </pre>
        </div>

        {/* ── Footer ── */}
        <div className="cv-modal-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            LogicDefense CV Maker 2.0 • Engenharia de Prompts Padrão Enterprise
          </span>
          <button className="cv-btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
