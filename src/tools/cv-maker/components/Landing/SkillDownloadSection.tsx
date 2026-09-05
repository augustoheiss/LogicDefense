import React, { useState } from 'react'

const CV_MAKER_SKILL_MD = `---
name: cv-maker-api
description: >-
  Expert integration manual and system prompt hub for CV Maker 2.0 API.
  Use when connecting external AI models (ChatGPT, Claude, Cursor, Python scripts, n8n, Antigravity)
  to generate 5 archetypes in parallel, synthesize the 6th Official Master Version (Level 2 Multi-Agent Synthesis), compile YAML deterministically, and render standalone HTML/PDF with zero UI requirement.
---

# CV Maker 2.0 — API & Autonomous Agent Integration Hub

Este documento é o guia definitivo e padronizado de integração para agentes de IA, scripts externos e ferramentas de automação que consom a API do **CV Maker 2.0** no ecossistema HeissLab / LogicDefense.

---

## 1. Mapeamento Arquitetural de Arquivos

### ⚙️ Backend (Python / FastAPI / Gemini 2.5 Flash / Turso SQLite)
- cv_router.py: Endpoints REST /api/v1/cv/generate, /api/v1/cv/synthesize, /api/v1/cv/compile, /api/v1/cv/tailor, /api/v1/cv/render, /api/v1/cv/prompts.
- cv_generator_service.py: Motor assíncrono com Gemini 2.5 Flash, execução paralela de 5 arquétipos e Síntese Magna de 6ª versão (Nível 2).
- cv_prompts.py: Prompts refinados com guardrails de Zero Fabricação (Skill agency-resume-tailor), Fórmula X-Y-Z do Google/IBM e MASTER_SYNTHESIS_INSTRUCTION.
- cv_html_renderer.py: Motor standalone de compilação HTML com suporte aos 10 modelos A4, 5 temas, 6 personas (com Síntese Master), alternância em tempo real e CSS Paged Media sem quebras indesejadas.
- api_keys_router.py: Auto-provisionamento de chaves efêmeras (POST /api/v1/api-keys/generate com TTL 1/7/30d) e kill-switch.
- public_api_router.py: Manifesto unificado OpenAPI 3.1 em /api/v1/public/openapi.json.

---

## 2. Modos de Operação da API & Nível 2 (Multi-Agent Synthesis)

| Modo de Operação | Endpoint da API | Consumo de Tokens | O que Faz |
| :--- | :--- | :---: | :--- |
| 🏆 Nível 2: Síntese Magna (6ª Versão) | POST /api/v1/cv/synthesize | BYOK / Cota Pro | Recebe os 5 YAMLs gerados pelo agente e sintetiza a 6ª versão oficial definitiva, unindo as melhores métricas sem duplicações. |
| 📦 Compilação Agent-Native (Zero LLM) | POST /api/v1/cv/compile | 100% Gratuito (Zero Tokens) | Recebe os 5 ou 6 YAMLs gerados localmente pelo agente externo e gera o Dashboard HTML completo e pacote .ZIP. |
| 🤖 Pipeline Completo (5 Arquétipos + Síntese) | POST /api/v1/cv/generate | Consome Cota Pro / BYOK | Envia o texto bruto do candidato e gera os 5 arquétipos + 6ª versão master em paralelo, retornando Super Dashboard HTML, ZIP ou JSON. |
| 📝 Editor YAML & Compilador Standalone | POST /api/v1/cv/render | 100% Gratuito (Zero Tokens) | Recebe 1 YAML já pronto, NÃO altera nenhuma palavra, e devolve o HTML standalone com 5 temas e botões de PDF/YAML. |

---

## 3. Prompts Oficiais para IAs Externas (Claude, Cursor, Antigravity, GPT)

### 🏆 Prompt de Síntese Magna (Nível 2 — Editor Executivo Sênior)
> Utilize este prompt quando seu agente local (Claude, GPT, Cursor) já minerou as 5 versões e agora deve compor a 6ª versão oficial definitiva:

\`\`\`markdown
VOCÊ É O MASTER SYNTHESIZER & PRINCIPAL RESUME ARCHITECT (NÍVEL 2 - SÍNTESE MAGNA).
SUA MISSÃO: Analisar os 5 currículos YAML gerados pelas personas especializadas e sintetizar o 6º CURRÍCULO OFICIAL DEFINITIVO (Master Opus) no padrão JSON Resume v1.0.0 em YAML puro.

DIRETRIZES FUNDAMENTAIS DE DESTILAÇÃO:
1. DESTILAÇÃO DO TOPO DE MÉTRICAS (IBM & Google X-Y-Z):
   - Minere os bullet points mais fortes de cada versão: métricas financeiras/ROI do Executivo, profundidade técnica e arquiteturas de escala do Arquiteto IA, clareza de contexto e legado do Biógrafo, e velocidade de aprendizado do Didático.
2. ZERO DUPLICIDADE E ZERO POLUIÇÃO:
   - Elimine redundâncias entre cargos e projetos. Cada bullet point deve ser único, conciso e com verbo de ação no pretérito perfeito.
3. ADAPTAÇÃO CIRÚRGICA À JOB DESCRIPTION (Se fornecida):
   - Se houver Job Description, priorize as competências e resultados com maior aderência aos requisitos chave da vaga.
4. ZERO FABRICAÇÃO:
   - Jamais invente métricas, tecnologias ou experiências que não existam nas 5 versões base ou no texto original.
5. SAÍDA LIMPA:
   - Retorne APENAS o código YAML válido dentro de bloco \`\`\`yaml ... \`\`\` sem texto introdutório.
\`\`\`

---

## 4. Estrutura do Padrão JSON Resume em YAML Canônico

\`\`\`yaml
basics:
  name: "Nome do Profissional"
  label: "Arquiteto de Software & Engenheiro de IA"
  email: "contato@exemplo.com"
  phone: "+55 (11) 99999-9999"
  url: "https://github.com/exemplo"
  summary: "Resumo profissional de alto impacto..."
  location:
    city: "São Paulo"
    countryCode: "BR"
work:
  - name: "Empresa de Tecnologia"
    position: "Staff Software Engineer"
    startDate: "2022-01"
    endDate: "2026-09"
    highlights:
      - "Arquitetou pipeline de compilação de documentos reduzindo latência em 45% (Google X-Y-Z)."
      - "Liderou transição para arquitetura vetorial eliminando perdas de DPI em impressão A4."
skills:
  - name: "Arquitetura de Software"
    level: "Master"
    keywords: ["Microsserviços", "FastAPI", "React", "TypeScript", "Chromium PrintToPDF"]
\`\`\`
`

export const SkillDownloadSection: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(CV_MAKER_SKILL_MD).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleDownload = () => {
    const blob = new Blob([CV_MAKER_SKILL_MD], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cv-maker-api.md'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="cv-skill-container">
      {/* Barra de Ações Rápidas */}
      <div className="cv-skill-toolbar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📦</span>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800 }}>
              Skill Agent-Native: <code>cv-maker-api.md</code>
            </h3>
          </div>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Disponibilize esta skill para Claude Desktop, Cursor, Copilot ou Antigravity para transformar qualquer IA num gerador de currículos Nível 2.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1.15rem',
              background: copied ? '#059669' : '#1e293b',
              color: '#f8fafc',
              border: copied ? '1px solid #10b981' : '1px solid #475569',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {copied ? '✅ Copiado com Sucesso!' : '📋 Copiar Markdown'}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1.25rem',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            💾 Baixar Arquivo .md
          </button>
        </div>
      </div>

      {/* Como Usar em 3 Passos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.1rem'
          }}
        >
          <div style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>1️⃣ No Claude Desktop</div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Salve o arquivo como <code>SKILL.md</code> dentro de <code>~/.anthropic/skills/cv-maker-api/</code> ou adicione como Project Knowledge.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.1rem'
          }}
        >
          <div style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>2️⃣ No Cursor / Windsurf</div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Copie o conteúdo e cole dentro de <code>.cursor/rules/cv-maker.mdc</code> ou nos System Instructions do seu projeto.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.1rem'
          }}
        >
          <div style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>3️⃣ No Antigravity IDE</div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5 }}>
            A skill já está nativamente catalogada em <code>skills/cv-maker-api/SKILL.md</code> pronta para chamadas diretas via prompt.
          </p>
        </div>
      </div>

      {/* Visualizador de Código da Skill */}
      <div className="cv-skill-code-box">
        {CV_MAKER_SKILL_MD}
      </div>
    </div>
  )
}
