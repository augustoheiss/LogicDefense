import React, { useState, useEffect } from 'react'
import { generateNewApiKey, validateApiKey, revokeApiKey } from '../../services/cvService'

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyUpdated: (newKey: string | null) => void
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeyUpdated }) => {
  const [activeTab, setActiveTab] = useState<'key' | 'agent_hub'>('key')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [keyHint, setKeyHint] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [selectedTtl, setSelectedTtl] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
  const [copiedOpenApi, setCopiedOpenApi] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [justGeneratedRawKey, setJustGeneratedRawKey] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const stored = localStorage.getItem('ld_universal_api_key')
    if (stored) {
      setActiveKey(stored)
      setLoading(true)
      validateApiKey(stored).then(res => {
        setLoading(false)
        if (res.valid) {
          setKeyHint(`...${stored.slice(-4)}`)
          setExpiresAt(res.expiresAt || null)
          setTableId(res.tableId || null)
        } else {
          setActiveKey(null)
          localStorage.removeItem('ld_universal_api_key')
          onKeyUpdated(null)
        }
      })
    } else {
      setActiveKey(null)
      setKeyHint(null)
      setExpiresAt(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleGenerate = async () => {
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
      onKeyUpdated(res.apiKey)
    } catch (err) {
      setErrorMsg((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
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
      onKeyUpdated(null)
    } catch (err) {
      setErrorMsg((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const currentKeyDisplay = justGeneratedRawKey || activeKey || 'am_sheet_live_sua_chave_aqui'

  const openApiSpecJson = JSON.stringify(
    {
      openapi: '3.1.0',
      info: {
        title: 'CV Maker 2.0 & Heiss-Lab AI Engine (100% Agent-Native)',
        version: '3.1.0',
        description:
          'API de Renderização, Alfaiataria e Compilação de Currículos de Alta Fidelidade para Agentes de IA (Claude, Cursor, Antigravity, ChatGPT). O seu agente gera os 5 YAMLs e a API compila em Super Dashboard HTML Standalone e Pacote ZIP com zero custo de tokens de servidor.',
      },
      servers: [
        { url: 'https://ocorrencias-pdf-writer.onrender.com', description: 'Servidor Primário (Render)' },
        { url: 'https://heiss-cv-engine.onrender.com', description: 'Servidor Secundário (Failover)' },
      ],
      paths: {
        '/api/v1/cv/compile': {
          post: {
            summary: 'Compila os 5 arquétipos gerados pelo Agente em Super Dashboard HTML e ZIP',
            description:
              'Recebe os 5 YAMLs gerados pelo próprio Agente de IA do usuário (Executivo, Arquiteto, Biógrafo, Didático e Alien) e compila instantaneamente em um Dashboard HTML interativo com fotos, enquadramento dinâmico, 5 temas, 9 modelos A4, customizador de cores/texturas e botão nativo de impressão A4.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      professional: { type: 'string', description: 'YAML do arquétipo Executivo / IBM Lead' },
                      architect: { type: 'string', description: 'YAML do arquétipo Arquiteto de Soluções IA' },
                      historian: { type: 'string', description: 'YAML do arquétipo Biográfico / Narrativo' },
                      didactic: { type: 'string', description: 'YAML do arquétipo Didático / Learning Velocity' },
                      alien: { type: 'string', description: 'YAML do arquétipo Observador Extraterrestre' },
                      default_theme: { type: 'string', enum: ['executive', 'creative', 'minimalist', 'white', 'terminal'], default: 'executive' },
                      default_layout: { type: 'string', enum: ['modular', 'linear', 'sidebar', 'compact_split', 'editorial_accent', 'corporate_timeline', 'warm_magazine', 'hero_matrix', 'dynamic_math'], default: 'dynamic_math' },
                      format: { type: 'string', enum: ['html', 'zip', 'json'], default: 'html' },
                      filename: { type: 'string', default: 'curriculos_5_versoes' },
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
        '/api/v1/cv/render': {
          post: {
            summary: 'Renderiza 1 YAML em HTML Standalone de Alta Fidelidade',
            description: 'Converte um esquema YAML para HTML puro com estilos embutidos, suporte a avatar/framing, escolha de Layout A4 01 a 09 e impressão A4 perfeita.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      yaml_content: { type: 'string', description: 'YAML do currículo' },
                      theme: { type: 'string', enum: ['executive', 'creative', 'minimalist', 'white', 'terminal'], default: 'executive' },
                      layout: { type: 'string', enum: ['modular', 'linear', 'sidebar', 'compact_split', 'editorial_accent', 'corporate_timeline', 'warm_magazine', 'hero_matrix', 'dynamic_math'], default: 'dynamic_math' },
                      view_mode: { type: 'string', enum: ['cv', 'cover_letter', 'both'], default: 'cv' },
                      format: { type: 'string', enum: ['html', 'yaml', 'zip', 'json'], default: 'html' },
                      filename: { type: 'string', default: 'curriculo' },
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
            summary: 'Retorna o catálogo dos 9 modelos A4 declarativos',
            description: 'Lista todos os Blueprints disponíveis com metadados de layout, colunas e suporte a foto/cover letter.',
            responses: { '200': { description: 'Catálogo de layouts em JSON' } },
          },
        },
        '/api/v1/cv/themes': {
          get: {
            summary: 'Retorna a lista de temas visuais e paletas',
            description: 'Lista os 5 temas de design disponíveis no motor de renderização.',
            responses: { '200': { description: 'Lista de temas em JSON' } },
          },
        },
        '/api/v1/cv/prompts': {
          get: {
            summary: 'Retorna as diretrizes das 5 personas e instruções para o Agente',
            description: 'Retorna os System Prompts completos (JSON Resume, fórmulas X-Y-Z e personas) para o Agente ler e gerar os YAMLs.',
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

  const handleCopyOpenApi = () => {
    navigator.clipboard.writeText(openApiSpecJson)
    setCopiedOpenApi(true)
    setTimeout(() => setCopiedOpenApi(false), 2000)
  }

  return (
    <div className="cv-modal-backdrop" onClick={onClose}>
      <div className="cv-modal-card" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
        <div className="cv-modal-header">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>🔑 Automação, Chaves de API & Hub de Agentes</h3>
          </div>
          <button className="cv-modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
          <button
            className={`cv-btn-secondary ${activeTab === 'key' ? 'cv-sidebar-tab--active' : ''}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
            onClick={() => setActiveTab('key')}
          >
            🔐 Gerenciar Chave
          </button>
          <button
            className={`cv-btn-secondary ${activeTab === 'agent_hub' ? 'cv-sidebar-tab--active' : ''}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
            onClick={() => setActiveTab('agent_hub')}
          >
            🤖 Hub do Agente de IA & OpenAPI
          </button>
        </div>

        <div className="cv-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {activeTab === 'key' && (
            <>
              {errorMsg && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                  {errorMsg}
                </div>
              )}

              {activeKey ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#020617', padding: '1rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                      Sua Chave de API Ativa (Universal{keyHint ? ` - ${keyHint}` : ''}):
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <code style={{ color: '#38bdf8', fontSize: '0.9rem', wordBreak: 'break-all' }}>{activeKey}</code>
                      <button className="cv-btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleCopy(activeKey)}>
                        {copied ? '✓ Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    {expiresAt && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                        Expira em: {new Date(expiresAt).toLocaleDateString()} às {new Date(expiresAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="cv-btn-secondary" style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={handleRevoke} disabled={loading}>
                      🗑️ Revogar Chave
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                    Gere uma chave temporária para conectar seus bots, scripts Python ou agentes autônomos à API do CV Maker.
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Validade da Chave:</label>
                    <select
                      value={selectedTtl}
                      onChange={e => setSelectedTtl(Number(e.target.value))}
                      style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                    >
                      <option value={1}>1 Dia</option>
                      <option value={7}>7 Dias</option>
                      <option value={30}>30 Dias</option>
                    </select>
                  </div>

                  <button className="cv-btn-primary" onClick={handleGenerate} disabled={loading} style={{ alignSelf: 'flex-start' }}>
                    {loading ? 'Gerando...' : '⚡ Gerar Nova Chave de API'}
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'agent_hub' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <strong style={{ color: '#34d399', fontSize: '0.88rem' }}>🚀 Arquitetura 100% Agent-Native (Zero Chave do Google Cloud):</strong>
                <p style={{ margin: '0.4rem 0 0 0', color: '#94a3b8' }}>
                  Você <strong>não precisa criar conta no Google AI Studio nem adicionar cartão de crédito</strong>. O seu próprio Agente de IA (Claude Code, Antigravity, Cursor, ChatGPT) gera os 5 arquétipos YAML diretamente no seu ambiente. A API do LogicDefense é usada de forma ultra-rápida e gratuita apenas para compilar o Super Dashboard HTML Standalone e os arquivos ZIP:
                </p>
                <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
                  <li><strong>POST /api/v1/cv/compile</strong>: Compila os 5 YAMLs no Super Dashboard HTML / ZIP com Design & Estilo, enquadramento de fotos, 5 temas, 9 modelos A4 e impressão nativa.</li>
                  <li><strong>POST /api/v1/cv/render</strong>: Converte qualquer YAML único em HTML puro no modelo A4 desejado (<code>modular</code>, <code>linear</code>, <code>sidebar</code>, <code>compact_split</code>, <code>editorial_accent</code>, <code>corporate_timeline</code>, <code>warm_magazine</code>, <code>hero_matrix</code>, <code>dynamic_math</code>).</li>
                  <li><strong>GET /api/v1/cv/layouts</strong>: Retorna o catálogo dos 9 layouts declarativos A4 e suas especificações de grid.</li>
                  <li><strong>GET /api/v1/cv/themes</strong>: Retorna os 5 temas visuais (executive, creative, minimalist, white, terminal).</li>
                  <li><strong>GET /api/v1/cv/prompts</strong>: Retorna as diretrizes das 5 personas prontas para o Agente executar.</li>
                  <li><strong>POST /api/v1/cv/tailor</strong>: Alfaiataria ATS automática contra uma Job Description sem fabricação de dados.</li>
                  <li><strong>POST /api/v1/cv/generate-cover-letter</strong>: Gerador dedicado de Carta de Apresentação com IA preservando o currículo intacto.</li>
                </ul>
              </div>

              <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <strong style={{ color: '#38bdf8' }}>🧠 Prompt Mestre para Colar no seu Agente de IA (Cursor / Claude / GPT):</strong>
                <pre style={{ background: '#090d16', padding: '0.65rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#e2e8f0', fontSize: '0.73rem', whiteSpace: 'pre-wrap', marginTop: '0.4rem', fontFamily: 'monospace' }}>
{`Você é um especialista em engenharia de currículos de alta fidelidade (CV Maker 2.0).
Siga OBRIGATORIAMENTE este fluxo em 3 etapas para criar e compilar os currículos:

PASSO 1: (DIRETRIZES OFICIAIS & MODELOS A4)
Consulte as regras de schema e System Prompts das 5 personas fazendo uma requisição HTTP GET:
-> GET https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/prompts
-> GET https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/layouts

PASSO 2: (GERAÇÃO DOS 5 ARQUÉTIPOS EM YAML)
Com base nas diretrizes recebidas no Passo 1, gere os 5 arquivos YAML no formato JSON Resume:
- professional: Executivo IBM / Senior Tech Lead (Fórmula X-Y-Z do Google/IBM, métricas de ROI)
- architect: AI & Cloud Solutions Architect (Arquiteturas assíncronas, RAG, microsserviços)
- historian: Biógrafo / Evolução Estratégica (Narrativa profissional contínua e legado)
- didactic: Didático / Learning Velocity (Velocidade de aprendizado, tutorias e mentoria)
- alien: Observador Extraterrestre (Relatório biológico e técnico intergaláctico com tom sci-fi)

PASSO 3: (COMPILAÇÃO DO SUPER DASHBOARD HTML & ZIP)
Envie os 5 YAMLs gerados para compilação instantânea no servidor:
- Endpoint: POST https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/compile
- Header: X-API-Key: ${currentKeyDisplay}
- Body: {
    "professional": "...", 
    "architect": "...", 
    "historian": "...", 
    "didactic": "...", 
    "alien": "...",
    "default_layout": "dynamic_math",
    "default_theme": "executive"
  }
- Salve o arquivo HTML retornado e abra no navegador para alternar entre os 9 Modelos A4, 5 temas, editar fotos/cores e imprimir em PDF A4!`}
                </pre>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <strong style={{ color: '#38bdf8' }}>📄 Especificação OpenAPI 3.1.0 (Para Custom GPTs / Agentes):</strong>
                  <button className="cv-btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={handleCopyOpenApi}>
                    {copiedOpenApi ? '✓ OpenAPI Copiada!' : '📋 Copiar OpenAPI JSON'}
                  </button>
                </div>
                <pre style={{ background: '#020617', padding: '0.75rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#7dd3fc', fontSize: '0.73rem', maxHeight: '180px', overflowY: 'auto', fontFamily: 'monospace' }}>
                  {openApiSpecJson}
                </pre>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <strong style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>💻 Exemplos Prontos de Terminal & Código:</strong>

                <div>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}><strong>A. Compilar os 5 Arquétipos em Super Dashboard HTML (cURL):</strong></span>
                  <pre style={{ background: '#020617', padding: '0.6rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#34d399', fontSize: '0.74rem', overflowX: 'auto', margin: '0.25rem 0 0 0' }}>
{`curl -X POST "https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/compile" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${currentKeyDisplay}" \\
  -d '{
    "professional": "basics:\\n  name: Alexandre Silva...",
    "architect": "basics:\\n  name: Alexandre Silva...",
    "historian": "basics:\\n  name: Alexandre Silva...",
    "didactic": "basics:\\n  name: Alexandre Silva...",
    "alien": "basics:\\n  name: Alexandre Silva...",
    "default_layout": "dynamic_math"
  }' \\
  --output "dashboard_curriculos.html"`}
                  </pre>
                </div>

                <div>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}><strong>B. Renderizar 1 YAML em Modelo A4 Específico & PDF (Python):</strong></span>
                  <pre style={{ background: '#020617', padding: '0.6rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#a78bfa', fontSize: '0.74rem', overflowX: 'auto', margin: '0.25rem 0 0 0' }}>
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
    f.write(res.text)
# Pronto! O arquivo HTML abre no navegador com botão nativo de impressão A4, toolbar e design customizer.`}
                  </pre>
                </div>

                <div>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}><strong>C. Listar Catálogo de Modelos A4 Disponíveis (cURL):</strong></span>
                  <pre style={{ background: '#020617', padding: '0.6rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#38bdf8', fontSize: '0.74rem', overflowX: 'auto', margin: '0.25rem 0 0 0' }}>
{`curl -X GET "https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/layouts"`}
                  </pre>
                </div>

                <div>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}><strong>D. Auto-provisionamento de Chave Temporária via Terminal:</strong></span>
                  <pre style={{ background: '#020617', padding: '0.6rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#f59e0b', fontSize: '0.74rem', overflowX: 'auto', margin: '0.25rem 0 0 0' }}>
{`curl -X POST "https://ocorrencias-pdf-writer.onrender.com/api/v1/api-keys/generate" \\
  -H "Content-Type: application/json" \\
  -d '{"ttlDays": 1}'`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
