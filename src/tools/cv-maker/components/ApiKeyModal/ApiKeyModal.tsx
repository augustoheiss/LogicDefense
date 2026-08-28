import React, { useState, useEffect } from 'react'
import { generateNewApiKey, validateApiKey, revokeApiKey } from '../../services/cvService'

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyUpdated: (newKey: string | null) => void
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeyUpdated }) => {
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

  return (
    <div className="cv-modal-backdrop" onClick={onClose}>
      <div className="cv-modal-card" onClick={e => e.stopPropagation()}>
        <div className="cv-modal-header">
          <h3>🔑 Chave API para Agentes Externos</h3>
          <button className="cv-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cv-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Conecte agentes autônomos (Claude, Cursor, n8n, Python bots) aos serviços do <strong>LogicDefense</strong> (Assistente Moeda & CV Maker). As chaves utilizam criptografia com SHA-256 no banco local, validade temporária e revogação imediata.
          </p>

          {errorMsg && (
            <div className="cv-editor-error">
              {errorMsg}
            </div>
          )}

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
                <strong>Exemplo de uso via HTTP Header:</strong>
                <pre style={{ margin: '0.4rem 0 0 0', color: '#34d399', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  X-API-Key: {justGeneratedRawKey || activeKey}
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
        </div>
      </div>
    </div>
  )
}
