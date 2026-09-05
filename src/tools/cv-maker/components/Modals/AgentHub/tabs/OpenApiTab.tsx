import React, { useState } from 'react'
import { getOpenApiSpecJson } from '../data/openApiSpec'

interface OpenApiTabProps {
  currentKeyDisplay: string
}

export const OpenApiTab: React.FC<OpenApiTabProps> = ({ currentKeyDisplay }) => {
  const [copiedOpenApi, setCopiedOpenApi] = useState<boolean>(false)

  const openApiSpecJson = getOpenApiSpecJson()

  const handleCopyOpenApi = () => {
    navigator.clipboard.writeText(openApiSpecJson)
    setCopiedOpenApi(true)
    setTimeout(() => setCopiedOpenApi(false), 2000)
  }

  return (
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
            <strong>POST /api/v1/cv/compile</strong>: Valida e empacota as 6 versões (5 arquétipos + 6ª Master) em arquivo ZIP oficial,
            pronto para importação no CV Maker Web e exportação em alta fidelidade.
          </li>
          <li>
            <strong>POST /api/v1/cv/synthesize</strong>: Nível 2 — Síntese Master Oficial automática via IA do Agente ou
            BYOK opcional (<code>X-Gemini-API-Key</code>).
          </li>
          <li>
            <strong>POST /api/v1/cv/render</strong>: Valida e formata esquemas YAML únicos nos modelos de dados A4 (formatos YAML/JSON/ZIP).
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
            onClick={handleCopyOpenApi}
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
  -H "Authorization: Bearer ${currentKeyDisplay}" \\
  -d '{
    "official_master": "basics:\\n  name: Alexandre Silva...",
    "professional": "basics:\\n  name: Alexandre Silva...",
    "architect": "basics:\\n  name: Alexandre Silva...",
    "historian": "basics:\\n  name: Alexandre Silva...",
    "didactic": "basics:\\n  name: Alexandre Silva...",
    "alien": "basics:\\n  name: Alexandre Silva...",
    "default_layout": "dynamic_math",
    "format": "zip"
  }' \\
  --output "pacote_curriculos.zip"`}
          </pre>
        </div>

        <div>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            <strong>B. Validar / Formatar 1 YAML via API (Python):</strong>
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
    headers={"Authorization": "Bearer ${currentKeyDisplay}"},
    json={
        "yaml_content": open("cv.yaml").read(), 
        "theme": "executive",
        "layout": "corporate_timeline",
        "format": "yaml"
    }
)
with open("meu_curriculo_validado.yaml", "w", encoding="utf-8") as f:
    f.write(res.text)`}
          </pre>
        </div>
      </div>
    </div>
  )
}
