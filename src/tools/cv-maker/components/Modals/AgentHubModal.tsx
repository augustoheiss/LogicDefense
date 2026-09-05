import React, { useState, useEffect } from 'react'
import { generateNewApiKey, validateApiKey, revokeApiKey } from '../../services/cvService'
import { TabType, AgentHubModalProps } from './AgentHub/types'
import { AgentPromptTab } from './AgentHub/tabs/AgentPromptTab'
import { MasterSynthesisTab } from './AgentHub/tabs/MasterSynthesisTab'
import { PromptsLibraryTab } from './AgentHub/tabs/PromptsLibraryTab'
import { OpenApiTab } from './AgentHub/tabs/OpenApiTab'
import { ApiKeyTab } from './AgentHub/tabs/ApiKeyTab'

export type { AgentHubModalProps }

export const AgentHubModal: React.FC<AgentHubModalProps> = ({
  isOpen,
  onClose,
  onKeyUpdated,
  initialTab = 'agent_prompt',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  // API Key State
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [keyHint, setKeyHint] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [selectedTtl, setSelectedTtl] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [justGeneratedRawKey, setJustGeneratedRawKey] = useState<string | null>(null)

  useEffect(() => {
    if (initialTab && isOpen) {
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
          {activeTab === 'agent_prompt' && (
            <AgentPromptTab currentKeyDisplay={currentKeyDisplay} />
          )}

          {activeTab === 'master_synthesis' && (
            <MasterSynthesisTab />
          )}

          {activeTab === 'prompts_library' && (
            <PromptsLibraryTab />
          )}

          {activeTab === 'openapi_hub' && (
            <OpenApiTab currentKeyDisplay={currentKeyDisplay} />
          )}

          {activeTab === 'api_key' && (
            <ApiKeyTab
              activeKey={activeKey}
              keyHint={keyHint}
              expiresAt={expiresAt}
              selectedTtl={selectedTtl}
              setSelectedTtl={setSelectedTtl}
              loading={loading}
              errorMsg={errorMsg}
              onGenerateKey={handleGenerateKey}
              onRevokeKey={handleRevokeKey}
            />
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
