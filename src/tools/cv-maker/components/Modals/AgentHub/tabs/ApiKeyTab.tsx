import React, { useState } from 'react'

interface ApiKeyTabProps {
  activeKey: string | null
  keyHint: string | null
  expiresAt: string | null
  selectedTtl: number
  setSelectedTtl: (ttl: number) => void
  loading: boolean
  errorMsg: string | null
  onGenerateKey: () => Promise<void>
  onRevokeKey: () => Promise<void>
}

export const ApiKeyTab: React.FC<ApiKeyTabProps> = ({
  activeKey,
  keyHint,
  expiresAt,
  selectedTtl,
  setSelectedTtl,
  loading,
  errorMsg,
  onGenerateKey,
  onRevokeKey,
}) => {
  const [copiedKey, setCopiedKey] = useState<boolean>(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  return (
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
                onClick={() => handleCopy(activeKey)}
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
              onClick={onRevokeKey}
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
            onClick={onGenerateKey}
            disabled={loading}
            style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem' }}
          >
            {loading ? 'Gerando...' : '⚡ Gerar Nova Chave de API'}
          </button>
        </div>
      )}
    </div>
  )
}
