import { useState, useEffect } from 'react'
import './cvApiTester.css'

interface ApiKeyResponse {
  apiKey: string
  keyHint: string
  tableId: string
  expiresAt: string
  ttlDays: number
}

interface TestLog {
  id: string
  timestamp: string
  method: string
  endpoint: string
  status: number | 'PENDING' | 'ERROR'
  durationMs?: number
  payload?: any
  response?: any
  error?: string
}

const DEFAULT_SAMPLE_CV = `
Alexandre Silva
Senior Cloud & AI Architect | São Paulo, Brasil | alexandre.silva@example.com

Experiência Profissional:
- Tech Lead & Arquiteto Cloud na Enterprise Solutions (2021 - Presente)
  Liderou a modernização de arquitetura de microsserviços em Kubernetes e OpenShift, reduzindo latência em 35% e custo operacional em $120k/ano.
  Projetou e implementou pipelines de IA generativa com RAG e modelos de linguagem para atendimento corporativo.

- Engenheiro de Software Sênior na TechCorp (2018 - 2021)
  Desenvolveu APIs de alta performance em Python e Node.js atendendo 10M+ requisições/dia com 99.99% de SLA.
`.trim()

const DEFAULT_SAMPLE_JOB = `
Senior AI & Cloud Solutions Architect - IBM Ecosystem
Requisitos:
- Experiência comprovada em arquitetura de microsserviços, Kubernetes/OpenShift e governança de dados.
- Conhecimento prático em pipelines de IA Generativa, RAG e integração de LLMs em escala empresarial.
- Foco em resultados de negócio mensuráveis e liderança técnica de equipes multidisciplinares.
`.trim()

export function CVApiTester() {
  const [activeTab, setActiveTab] = useState<'keygen' | 'generate' | 'tailor' | 'render' | 'openapi'>('keygen')
  const [baseUrl, setBaseUrl] = useState(() => {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : 'https://heiss-lab-backend.onrender.com'
  })

  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('ld_universal_api_key') || ''
  })
  const [tableId, setTableId] = useState<string>('')
  const [ttlDays, setTtlDays] = useState<number>(1)
  const [rawText, setRawText] = useState<string>(DEFAULT_SAMPLE_CV)
  const [jobDescription, setJobDescription] = useState<string>(DEFAULT_SAMPLE_JOB)
  const [selectedTheme, setSelectedTheme] = useState<string>('executive')
  
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [activeLog, setActiveLog] = useState<TestLog | null>(null)
  const [copiedKey, setCopiedKey] = useState<boolean>(false)

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('ld_universal_api_key', apiKey)
    }
  }, [apiKey])

  const executeApiCall = async (
    method: 'GET' | 'POST',
    endpoint: string,
    body?: any,
    customHeaders?: Record<string, string>
  ) => {
    setIsLoading(true)
    const startTime = Date.now()
    const logId = Math.random().toString(36).substring(7)
    
    const newLog: TestLog = {
      id: logId,
      timestamp: new Date().toLocaleTimeString(),
      method,
      endpoint,
      status: 'PENDING',
      payload: body,
    }
    setActiveLog(newLog)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey, 'X-CV-Key': apiKey, 'X-Spreadsheet-Key': apiKey } : {}),
        ...customHeaders,
      }

      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      const durationMs = Date.now() - startTime
      let data: any
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        data = await res.text()
      }

      const completedLog: TestLog = {
        ...newLog,
        status: res.status,
        durationMs,
        response: data,
      }
      setActiveLog(completedLog)
      return { ok: res.ok, status: res.status, data }
    } catch (err: any) {
      const durationMs = Date.now() - startTime
      const errorLog: TestLog = {
        ...newLog,
        status: 'ERROR',
        durationMs,
        error: err?.message || 'Erro de rede desconhecido',
      }
      setActiveLog(errorLog)
      return { ok: false, status: 0, error: err?.message }
    } finally {
      setIsLoading(false)
    }
  }

  /* ── 1. Key Generation ── */
  const handleGenerateKey = async () => {
    const payload: Record<string, any> = {
      ttlDays,
      permissions: 'read:write',
    }
    if (tableId.trim()) {
      payload.tableId = tableId.trim()
    }

    const res = await executeApiCall('POST', '/api/v1/api-keys/generate', payload)
    if (res.ok && res.data?.apiKey) {
      const data: ApiKeyResponse = res.data
      setApiKey(data.apiKey)
      if (data.tableId) setTableId(data.tableId)
    }
  }

  /* ── 2. Validate Key ── */
  const handleValidateKey = async () => {
    if (!apiKey) return
    await executeApiCall('POST', '/api/v1/api-keys/validate', { apiKey })
  }

  /* ── 3. Revoke Key ── */
  const handleRevokeKey = async () => {
    if (!apiKey) return
    const res = await executeApiCall('POST', '/api/v1/api-keys/revoke', { apiKey })
    if (res.ok) {
      setApiKey('')
      localStorage.removeItem('ld_universal_api_key')
    }
  }

  /* ── 4. Generate CV Archetypes ── */
  const handleGenerateCV = async () => {
    await executeApiCall('POST', '/api/v1/cv/generate', { raw_text: rawText })
  }

  /* ── 5. Tailor CV with Job Description ── */
  const handleTailorCV = async () => {
    await executeApiCall('POST', '/api/v1/cv/tailor', {
      raw_text: rawText,
      job_description: jobDescription,
      target_role: 'Senior Cloud & AI Architect',
    })
  }

  /* ── 6. Render HTML / Theme ── */
  const handleRenderCV = async () => {
    await executeApiCall('POST', '/api/v1/cv/render', {
      raw_text: rawText,
      theme: selectedTheme,
    })
  }

  /* ── 7. Fetch Unified OpenAPI Spec ── */
  const handleFetchOpenApi = async () => {
    await executeApiCall('GET', '/api/v1/openapi.json')
  }

  const getCurlSnippet = () => {
    const headerAuth = apiKey ? ` -H "X-API-Key: ${apiKey}"` : ''
    switch (activeTab) {
      case 'keygen':
        return `curl -X POST "${baseUrl}/api/v1/api-keys/generate" \\
  -H "Content-Type: application/json" \\
  -d '{"ttlDays": ${ttlDays}}'`
      case 'generate':
        return `curl -X POST "${baseUrl}/api/v1/cv/generate" \\
  -H "Content-Type: application/json"${headerAuth} \\
  -d '{"raw_text": "Alexandre Silva..."}'`
      case 'tailor':
        return `curl -X POST "${baseUrl}/api/v1/cv/tailor" \\
  -H "Content-Type: application/json"${headerAuth} \\
  -d '{"raw_text": "Alexandre...", "job_description": "IBM Senior Architect..."}'`
      case 'render':
        return `curl -X POST "${baseUrl}/api/v1/cv/render" \\
  -H "Content-Type: application/json"${headerAuth} \\
  -d '{"raw_text": "Alexandre...", "theme": "${selectedTheme}"}'`
      case 'openapi':
        return `curl -X GET "${baseUrl}/api/v1/openapi.json"`
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  return (
    <div className="cv-api-workspace">
      {/* ── Header ── */}
      <header className="cv-api-workspace__header">
        <div>
          <h1 className="cv-api-workspace__title">
            🧪 API Testing Workspace & Agent Hub
          </h1>
          <p className="cv-api-workspace__subtitle">
            Console interativo para automação externa, auto-provisionamento de chaves e auditoria de isolamento.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="cv-api-workspace__badge cv-api-workspace__badge--secure">
            🛡️ 100% In-Memory Isolation
          </span>
          <span className="cv-api-workspace__badge">
            OpenAPI 3.1
          </span>
        </div>
      </header>

      {/* ── Environment & Active Key Bar ── */}
      <div className="cv-api-card" style={{ padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="cv-api-label">Base URL:</span>
            <input
              className="cv-api-input"
              style={{ width: '280px', padding: '0.4rem 0.6rem' }}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="cv-api-label">Chave Ativa:</span>
            <input
              className="cv-api-input"
              style={{ width: '260px', padding: '0.4rem 0.6rem', fontFamily: 'monospace' }}
              placeholder="am_sheet_live_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {apiKey && (
              <button
                className="cv-api-btn cv-api-btn--secondary"
                style={{ padding: '0.4rem 0.75rem' }}
                onClick={() => copyToClipboard(apiKey)}
              >
                {copiedKey ? '✓ Copiado' : '📋 Copiar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="cv-api-workspace__tabs">
        <button
          className={`cv-api-workspace__tab-btn ${activeTab === 'keygen' ? 'cv-api-workspace__tab-btn--active' : ''}`}
          onClick={() => setActiveTab('keygen')}
        >
          🔑 1. Auto-Provisionamento de Chave
        </button>
        <button
          className={`cv-api-workspace__tab-btn ${activeTab === 'generate' ? 'cv-api-workspace__tab-btn--active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          ⚡ 2. Gerar Arquétipos (/generate)
        </button>
        <button
          className={`cv-api-workspace__tab-btn ${activeTab === 'tailor' ? 'cv-api-workspace__tab-btn--active' : ''}`}
          onClick={() => setActiveTab('tailor')}
        >
          🎯 3. ATS Job Tailoring (/tailor)
        </button>
        <button
          className={`cv-api-workspace__tab-btn ${activeTab === 'render' ? 'cv-api-workspace__tab-btn--active' : ''}`}
          onClick={() => setActiveTab('render')}
        >
          🎨 4. Renderizar Temas (/render)
        </button>
        <button
          className={`cv-api-workspace__tab-btn ${activeTab === 'openapi' ? 'cv-api-workspace__tab-btn--active' : ''}`}
          onClick={() => setActiveTab('openapi')}
        >
          📜 5. Manifesto OpenAPI Unificado
        </button>
      </div>

      {/* ── Main Testing Grid ── */}
      <div className="cv-api-workspace__grid">
        {/* ── Left Column: Form Controls ── */}
        <div className="cv-api-card">
          {activeTab === 'keygen' && (
            <>
              <h2 className="cv-api-card__title">
                Geração Externa de Chave de API
                <span className="cv-api-workspace__badge">POST /api/v1/api-keys/generate</span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                Gera chaves temporárias para agentes autônomos sem precisar de interação humana no navegador.
              </p>

              <div className="cv-api-form-group">
                <label className="cv-api-label">Table / Session ID (Opcional):</label>
                <input
                  className="cv-api-input"
                  placeholder="Deixe em branco para auto-gerar sessão de agente"
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                />
              </div>

              <div className="cv-api-form-group">
                <label className="cv-api-label">Validade (TTL em Dias):</label>
                <select
                  className="cv-api-select"
                  value={ttlDays}
                  onChange={(e) => setTtlDays(Number(e.target.value))}
                >
                  <option value={1}>1 Dia (Efêmera / Sessão Curta)</option>
                  <option value={7}>7 Dias (Desenvolvimento / Sprint)</option>
                  <option value={30}>30 Dias (Automação Contínua)</option>
                </select>
              </div>

              <div className="cv-api-actions">
                <button
                  className="cv-api-btn cv-api-btn--primary"
                  onClick={handleGenerateKey}
                  disabled={isLoading}
                >
                  {isLoading ? '⏳ Gerando...' : '✨ Gerar Chave Instantânea'}
                </button>
                {apiKey && (
                  <>
                    <button
                      className="cv-api-btn cv-api-btn--secondary"
                      onClick={handleValidateKey}
                      disabled={isLoading}
                    >
                      🔍 Validar Chave
                    </button>
                    <button
                      className="cv-api-btn cv-api-btn--secondary"
                      style={{ color: '#f87171' }}
                      onClick={handleRevokeKey}
                      disabled={isLoading}
                    >
                      🗑️ Revogar Chave (Kill-Switch)
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === 'generate' && (
            <>
              <h2 className="cv-api-card__title">
                Geração de 4 Arquétipos Simultâneos
                <span className="cv-api-workspace__badge">POST /api/v1/cv/generate</span>
              </h2>

              <div className="cv-api-form-group">
                <label className="cv-api-label">Texto Bruto do Currículo:</label>
                <textarea
                  className="cv-api-textarea"
                  style={{ minHeight: '220px' }}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>

              <div className="cv-api-actions">
                <button
                  className="cv-api-btn cv-api-btn--primary"
                  onClick={handleGenerateCV}
                  disabled={isLoading}
                >
                  {isLoading ? '⏳ Processando IA...' : '🚀 Disparar 4x Gemini 2.5'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'tailor' && (
            <>
              <h2 className="cv-api-card__title">
                Otimização Cirúrgica ATS (Job Tailoring)
                <span className="cv-api-workspace__badge">POST /api/v1/cv/tailor</span>
              </h2>

              <div className="cv-api-form-group">
                <label className="cv-api-label">Descrição da Vaga Alvo (Job Description):</label>
                <textarea
                  className="cv-api-textarea"
                  style={{ minHeight: '130px' }}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>

              <div className="cv-api-form-group">
                <label className="cv-api-label">Texto Bruto do Candidato:</label>
                <textarea
                  className="cv-api-textarea"
                  style={{ minHeight: '130px' }}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>

              <div className="cv-api-actions">
                <button
                  className="cv-api-btn cv-api-btn--primary"
                  onClick={handleTailorCV}
                  disabled={isLoading}
                >
                  {isLoading ? '⏳ Analisando ATS...' : '🎯 Otimizar para a Vaga (X-Y-Z)'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'render' && (
            <>
              <h2 className="cv-api-card__title">
                Renderização de Temas
                <span className="cv-api-workspace__badge">POST /api/v1/cv/render</span>
              </h2>

              <div className="cv-api-form-group">
                <label className="cv-api-label">Tema Visual:</label>
                <select
                  className="cv-api-select"
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                >
                  <option value="executive">👔 Executivo (Merriweather)</option>
                  <option value="creative">🎨 Criativo (Poppins / Gradient)</option>
                  <option value="minimal">🔹 Minimalista (Inter / Pure White)</option>
                  <option value="white">📄 White (Alto Contraste / Econômico)</option>
                  <option value="terminal">&gt;_ Terminal (Emerald Dark Mode)</option>
                </select>
              </div>

              <div className="cv-api-form-group">
                <label className="cv-api-label">Dados do Currículo (Texto ou YAML):</label>
                <textarea
                  className="cv-api-textarea"
                  style={{ minHeight: '180px' }}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>

              <div className="cv-api-actions">
                <button
                  className="cv-api-btn cv-api-btn--primary"
                  onClick={handleRenderCV}
                  disabled={isLoading}
                >
                  {isLoading ? '⏳ Renderizando...' : '🎨 Renderizar Template'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'openapi' && (
            <>
              <h2 className="cv-api-card__title">
                Manifesto de Descoberta OpenAPI 3.1
                <span className="cv-api-workspace__badge">GET /api/v1/openapi.json</span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Este manifesto pode ser importado diretamente no Swagger, Postman, Claude MCP ou Custom GPT Actions.
              </p>

              <div className="cv-api-actions">
                <button
                  className="cv-api-btn cv-api-btn--primary"
                  onClick={handleFetchOpenApi}
                  disabled={isLoading}
                >
                  {isLoading ? '⏳ Carregando...' : '📜 Buscar Especificação OpenAPI'}
                </button>
              </div>
            </>
          )}

          {/* ── cURL Command Box ── */}
          <div className="cv-api-curl-box">
            <button
              className="cv-api-curl-box__copy"
              onClick={() => copyToClipboard(getCurlSnippet())}
            >
              📋 Copiar cURL
            </button>
            <pre style={{ margin: 0 }}>{getCurlSnippet()}</pre>
          </div>
        </div>

        {/* ── Right Column: Live Response & Logs ── */}
        <div className="cv-api-card">
          <div className="cv-api-response-header">
            <h2 className="cv-api-card__title" style={{ margin: 0 }}>
              📡 Resposta em Tempo Real
            </h2>
            {activeLog && (
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background:
                    activeLog.status === 200
                      ? 'rgba(16, 185, 129, 0.2)'
                      : activeLog.status === 'PENDING'
                      ? 'rgba(234, 179, 8, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                  color:
                    activeLog.status === 200
                      ? '#34d399'
                      : activeLog.status === 'PENDING'
                      ? '#facc15'
                      : '#f87171',
                }}
              >
                Status: {activeLog.status} {activeLog.durationMs ? `(${activeLog.durationMs}ms)` : ''}
              </span>
            )}
          </div>

          <div className="cv-api-response-container">
            {activeLog ? (
              <div className="cv-api-code-block">
                {activeLog.status === 'PENDING' ? (
                  <p style={{ color: '#facc15', margin: 0 }}>⏳ Executando requisição para {baseUrl}{activeLog.endpoint}...</p>
                ) : activeLog.error ? (
                  <p style={{ color: '#f87171', margin: 0 }}>❌ Erro: {activeLog.error}</p>
                ) : (
                  JSON.stringify(activeLog.response, null, 2)
                )}
              </div>
            ) : (
              <div className="cv-api-code-block" style={{ color: '#64748b', textAlign: 'center', padding: '3rem 1rem' }}>
                Nenhuma requisição disparada ainda.
                <br />
                Selecione uma ação à esquerda para testar o backend.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CVApiTester
