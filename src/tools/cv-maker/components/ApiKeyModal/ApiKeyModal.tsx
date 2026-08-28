import React, { useState, useEffect } from 'react'
import { generateNewApiKey, validateApiKey, revokeApiKey } from '../../services/cvService'

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyUpdated: (newKey: string | null) => void
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeyUpdated }) => {
  const [activeTab, setActiveTab] = useState<'key' | 'guide'>('key')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [keyHint, setKeyHint] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [selectedTtl, setSelectedTtl] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)
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

  return (
    <div className="cv-modal-backdrop" onClick={onClose}>
      <div className="cv-modal-card" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
        <div className="cv-modal-header">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>🔑 Automação & Chave de API</h3>
          </div>
          <button className="cv-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Sub Navigation ── */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
          <button
            className={`cv-btn-secondary ${activeTab === 'key' ? 'cv-sidebar-tab--active' : ''}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            onClick={() => setActiveTab('key')}
          >
            🔐 Gerenciar Chave
          </button>
          <button
            className={`cv-btn-secondary ${activeTab === 'guide' ? 'cv-sidebar-tab--active' : ''}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            onClick={() => setActiveTab('guide')}
          >
            📖 Guia: Usar no PC sem Acessar o Site
          </button>
        </div>

        <div className="cv-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
          {errorMsg && (
            <div className="cv-editor-error">
              {errorMsg}
            </div>
          )}

          {activeTab === 'key' && (
            <>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Conecte agentes autônomos (Claude, Cursor, n8n, Python bots) aos serviços do <strong>LogicDefense</strong> (Assistente Moeda & CV Maker). As chaves utilizam criptografia SHA-256 no banco local, validade temporária e revogação imediata.
              </p>

              {activeKey ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#06090f', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700 }}>
                      ✓ Chave Ativa ({keyHint || '...' + activeKey.slice(-4)})
                    </span>
                    {expiresAt && (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Expira em: {new Date(expiresAt).toLocaleDateString('pt-BR')} {new Date(expiresAt).toLocaleTimeString('pt-BR')}
                      </span>
                    )}
                  </div>

                  {justGeneratedRawKey && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600 }}>
                        ⚠️ Guarde esta chave agora (ela não será exibida novamente por segurança):
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          readOnly
                          value={justGeneratedRawKey}
                          style={{ flex: 1, background: '#0d131f', border: '1px solid #334155', color: '#38bdf8', fontSize: '0.8rem', padding: '0.4rem 0.6rem', borderRadius: '0.375rem', fontFamily: 'monospace' }}
                        />
                        <button className="cv-btn-secondary" onClick={() => handleCopy(justGeneratedRawKey)}>
                          {copied ? '✓ Copiado' : '📋 Copiar'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', background: '#090d16', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #1e293b' }}>
                    <strong>Header de Autenticação:</strong>
                    <pre style={{ margin: '0.4rem 0 0 0', color: '#34d399', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      X-API-Key: {currentKeyDisplay}
                    </pre>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <button
                      className="cv-btn-secondary"
                      style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                      onClick={handleRevoke}
                      disabled={loading}
                    >
                      🛑 Revogar Chave (Kill-Switch)
                    </button>
                    <button className="cv-btn-secondary" onClick={onClose}>
                      Fechar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#06090f', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1' }}>
                      Validade da Chave Temporária (TTL):
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {[1, 7, 30].map(days => (
                        <button
                          key={days}
                          className={`cv-btn-secondary ${selectedTtl === days ? 'cv-sidebar-tab--active' : ''}`}
                          style={{ flex: 1, padding: '0.5rem' }}
                          onClick={() => setSelectedTtl(days)}
                        >
                          {days === 1 ? '24 Horas' : `${days} Dias`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    className="cv-btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
                    onClick={handleGenerate}
                    disabled={loading}
                  >
                    {loading ? 'Gerando Chave Criptográfica...' : '⚡ Gerar Nova Chave de API'}
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.6 }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <strong style={{ color: '#38bdf8' }}>💡 O que você precisa salvar no seu computador:</strong>
                <p style={{ margin: '0.3rem 0 0 0', color: '#94a3b8' }}>
                  Apenas <strong>2 informações</strong> são necessárias para scripts em Python, n8n, Claude ou Cursor:
                </p>
                <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0 }}>
                  <li><code>API_URL</code>: <code>https://ocorrencias-pdf-writer.onrender.com</code> (ou <code>https://heiss-cv-engine.onrender.com</code>)</li>
                  <li><code>API_KEY</code>: Sua chave ativa (<code>{currentKeyDisplay}</code>)</li>
                </ul>
              </div>

              <div>
                <strong>1. Arquivo de Configuração Local (<code>config.json</code>):</strong>
                <pre style={{ background: '#020617', padding: '0.6rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#7dd3fc', fontSize: '0.75rem', overflowX: 'auto', margin: '0.3rem 0 0 0' }}>
{`{
  "api_url": "https://ocorrencias-pdf-writer.onrender.com",
  "api_key": "${currentKeyDisplay}"
}`}
                </pre>
              </div>

              <div>
                <strong>2. Executar via Terminal (cURL):</strong>
                <pre style={{ background: '#020617', padding: '0.6rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#34d399', fontSize: '0.75rem', overflowX: 'auto', margin: '0.3rem 0 0 0' }}>
{`# Otimizar currículo para uma vaga (ATS Tailoring):
curl -X POST "https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/tailor" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${currentKeyDisplay}" \\
  -d '{"raw_text": "Alexandre Silva...", "job_description": "Vaga IBM..."}'`}
                </pre>
              </div>

              <div>
                <strong>3. Exportar HTML Estilizado & PDF (Python):</strong>
                <pre style={{ background: '#020617', padding: '0.6rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#a78bfa', fontSize: '0.75rem', overflowX: 'auto', margin: '0.3rem 0 0 0' }}>
{`import requests

res = requests.post(
    "https://ocorrencias-pdf-writer.onrender.com/api/v1/cv/render",
    headers={"X-API-Key": "${currentKeyDisplay}"},
    json={"raw_text": open("cv.yaml").read(), "theme": "executive"}
)
with open("meu_curriculo.html", "w", encoding="utf-8") as f:
    f.write(res.text)
# Pronto! O arquivo HTML possui botão nativo de impressão A4.`}
                </pre>
              </div>

              <div>
                <strong>4. Geração 100% Autônoma de Chave (Sem abrir o site):</strong>
                <pre style={{ background: '#020617', padding: '0.6rem', borderRadius: '4px', border: '1px solid #1e293b', color: '#f59e0b', fontSize: '0.75rem', overflowX: 'auto', margin: '0.3rem 0 0 0' }}>
{`# Dispare para auto-provisionar uma nova chave em milissegundos:
curl -X POST "https://ocorrencias-pdf-writer.onrender.com/api/v1/api-keys/generate" \\
  -H "Content-Type: application/json" \\
  -d '{"ttlDays": 1}'`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
