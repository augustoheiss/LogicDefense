import React, { useState, useEffect } from 'react'
import type { LayoutVariant } from '../../types/cv'
import { generateNewApiKey, validateApiKey, revokeApiKey } from '../../services/cvService'
import { TabType } from '../Modals/AgentHub/types'
import { AgentPromptTab } from '../Modals/AgentHub/tabs/AgentPromptTab'
import { MasterSynthesisTab } from '../Modals/AgentHub/tabs/MasterSynthesisTab'
import { PromptsLibraryTab } from '../Modals/AgentHub/tabs/PromptsLibraryTab'
import { OpenApiTab } from '../Modals/AgentHub/tabs/OpenApiTab'
import { ApiKeyTab } from '../Modals/AgentHub/tabs/ApiKeyTab'
import { AcademySection } from './AcademySection'
import { CertificateView } from './CertificateView'
import { LandingGallerySection } from './LandingGallerySection'
import { SkillDownloadSection } from './SkillDownloadSection'
import '../../styles/cv-landing-page.css'

export type LandingTabType = 'academy' | 'certificate' | 'hub' | 'gallery' | 'skill'

interface AgentAndAcademyLandingPageProps {
  initialTab?: LandingTabType
  hubSubTab?: TabType
  onReturnToEditor: () => void
  activeLayout: LayoutVariant
  onSelectLayout: (layoutId: LayoutVariant) => void
  onKeyUpdated?: (key: string | null) => void
}

export const AgentAndAcademyLandingPage: React.FC<AgentAndAcademyLandingPageProps> = ({
  initialTab = 'academy',
  hubSubTab = 'agent_prompt',
  onReturnToEditor,
  activeLayout,
  onSelectLayout,
  onKeyUpdated
}) => {
  const [activeMainTab, setActiveMainTab] = useState<LandingTabType>(initialTab)
  const [activeHubTab, setActiveHubTab] = useState<TabType>(hubSubTab)

  // API Key State (para o Hub Agente)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [keyHint, setKeyHint] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [selectedTtl, setSelectedTtl] = useState<number>(1)
  const [loadingKey, setLoadingKey] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (initialTab) {
      setActiveMainTab(initialTab)
    }
  }, [initialTab])

  useEffect(() => {
    if (hubSubTab) {
      setActiveHubTab(hubSubTab)
    }
  }, [hubSubTab])

  // Inicializar estado da chave de API
  useEffect(() => {
    const stored = localStorage.getItem('ld_universal_api_key')
    if (stored) {
      setActiveKey(stored)
      setLoadingKey(true)
      validateApiKey(stored).then(res => {
        setLoadingKey(false)
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
  }, [onKeyUpdated])

  const handleGenerateKey = async () => {
    setLoadingKey(true)
    setErrorMsg(null)
    try {
      const res = await generateNewApiKey(selectedTtl)
      localStorage.setItem('ld_universal_api_key', res.apiKey)
      setActiveKey(res.apiKey)
      setKeyHint(res.keyHint)
      setExpiresAt(res.expiresAt)
      setTableId(res.tableId)
      onKeyUpdated?.(res.apiKey)
    } catch (err) {
      setErrorMsg((err as Error).message)
    } finally {
      setLoadingKey(false)
    }
  }

  const handleRevokeKey = async () => {
    if (!window.confirm('Tem certeza de que deseja revogar esta chave de API agora?')) return
    setLoadingKey(true)
    try {
      const currentTid = tableId || 'cv-maker-session'
      await revokeApiKey(currentTid, activeKey || undefined)
      localStorage.removeItem('ld_universal_api_key')
      setActiveKey(null)
      setKeyHint(null)
      setExpiresAt(null)
      setTableId(null)
      onKeyUpdated?.(null)
    } catch (err) {
      setErrorMsg((err as Error).message)
    } finally {
      setLoadingKey(false)
    }
  }

  // Ao selecionar um layout na Galeria da Landing Page:
  // Aplica o layout e retorna ao editor (Opção A)
  const handleSelectLayoutFromGallery = (layoutId: LayoutVariant) => {
    onSelectLayout(layoutId)
    onReturnToEditor()
  }

  return (
    <div className="cv-landing-root">
      {/* ── Top Header Fixo ── */}
      <header className="cv-landing-header">
        <div className="cv-landing-brand" onClick={onReturnToEditor} title="Voltar ao Editor de Currículo">
          <span className="cv-landing-brand-logo">⚡</span>
          <div>
            <h1 className="cv-landing-brand-title">LogicDefense • CV Maker 2.0</h1>
            <p className="cv-landing-brand-subtitle">Hub Autônomo, Galeria & Academia de Engenharia</p>
          </div>
        </div>

        <button
          type="button"
          className="cv-landing-return-btn"
          onClick={onReturnToEditor}
        >
          <span>⬅️</span>
          <span>Retornar ao Editor de Currículo</span>
        </button>
      </header>

      {/* ── Hero / Apresentação ── */}
      <section className="cv-landing-hero cv-no-print">
        <div className="cv-landing-hero-badge">
          <span>🚀</span>
          <span>Arquitetura de Documentos A4 & Agentes de IA</span>
        </div>

        <h2 className="cv-landing-hero-title">
          Ecossistema Central de Inteligência & Criação
        </h2>

        <p className="cv-landing-hero-desc">
          Bem-vindo à central expandida do CV Maker. Acesse a nossa Academia com os bastidores de engenharia em tom de conversa de bar, consulte os prompts oficiais de múltiplos agentes, emita seu certificado de conclusão ou escolha entre 10 modelos A4 milimetricamente orçados.
        </p>

        {/* ── Navegação por Abas Principais ── */}
        <nav className="cv-landing-tabs-nav">
          {[
            { id: 'academy', label: '🎓 Academia de Bastidores', icon: '📚' },
            { id: 'certificate', label: '📜 Certificado de Conclusão', icon: '🏆' },
            { id: 'hub', label: '🤖 Hub Agente & API', icon: '⚡' },
            { id: 'gallery', label: '🖼️ Galeria de Modelos A4', icon: '🎨' },
            { id: 'skill', label: '📦 Skill Agent-Native (.md)', icon: '💾' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`cv-landing-tab-btn ${activeMainTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveMainTab(tab.id as LandingTabType)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </section>

      {/* ── Conteúdo da Aba Selecionada ── */}
      <main className="cv-landing-content">
        {/* ABA 1: ACADEMIA DE AULAS */}
        {activeMainTab === 'academy' && (
          <AcademySection
            onOpenCertificate={() => setActiveMainTab('certificate')}
          />
        )}

        {/* ABA 2: CERTIFICADO SIMBÓLICO */}
        {activeMainTab === 'certificate' && (
          <CertificateView
            onBackToAcademy={() => setActiveMainTab('academy')}
            onReturnToEditor={onReturnToEditor}
          />
        )}

        {/* ABA 3: HUB AGENTE & API (5 SUB-ABAS) */}
        {activeMainTab === 'hub' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Sub-abas do Hub */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #1e293b',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                  🤖 Central de Prompts & Integração de API
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  Copie prompts pré-configurados para o seu agente ou gere chaves de API efêmeras para automação externa.
                </p>
              </div>

              {/* Sub-Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'agent_prompt', label: '🚀 Prompt Rápido' },
                  { id: 'master_synthesis', label: '🏆 Síntese Magna (Nível 2)' },
                  { id: 'prompts_library', label: '📚 Biblioteca 5 Personas' },
                  { id: 'openapi_hub', label: '📡 OpenAPI Spec' },
                  { id: 'api_key', label: '🔑 Chave de API' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setActiveHubTab(sub.id as TabType)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.8rem',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: activeHubTab === sub.id ? '1px solid #38bdf8' : '1px solid #334155',
                      background: activeHubTab === sub.id ? 'rgba(56, 189, 248, 0.2)' : '#1e293b',
                      color: activeHubTab === sub.id ? '#38bdf8' : '#cbd5e1',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo da Sub-Aba Ativa */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid #1e293b',
                borderRadius: '16px',
                padding: '1.75rem',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
              }}
            >
              {activeHubTab === 'agent_prompt' && (
                <AgentPromptTab
                  currentKeyDisplay={keyHint || (activeKey ? `...${activeKey.slice(-4)}` : 'ld_live_sua_chave_aqui')}
                />
              )}
              {activeHubTab === 'master_synthesis' && <MasterSynthesisTab />}
              {activeHubTab === 'prompts_library' && <PromptsLibraryTab />}
              {activeHubTab === 'openapi_hub' && (
                <OpenApiTab
                  currentKeyDisplay={keyHint || (activeKey ? `...${activeKey.slice(-4)}` : 'ld_live_sua_chave_aqui')}
                />
              )}
              {activeHubTab === 'api_key' && (
                <ApiKeyTab
                  activeKey={activeKey}
                  keyHint={keyHint}
                  expiresAt={expiresAt}
                  selectedTtl={selectedTtl}
                  setSelectedTtl={setSelectedTtl}
                  loading={loadingKey}
                  errorMsg={errorMsg}
                  onGenerateKey={handleGenerateKey}
                  onRevokeKey={handleRevokeKey}
                />
              )}
            </div>
          </div>
        )}

        {/* ABA 4: GALERIA DE MODELOS A4 */}
        {activeMainTab === 'gallery' && (
          <LandingGallerySection
            activeLayout={activeLayout}
            onSelectLayout={handleSelectLayoutFromGallery}
          />
        )}

        {/* ABA 5: SKILL AGENT-NATIVE */}
        {activeMainTab === 'skill' && <SkillDownloadSection />}
      </main>

      {/* ── Rodapé de Governança & LGPD ── */}
      <footer className="cv-landing-footer cv-no-print">
        <div>
          <strong>LogicDefense • HeissLab Document Engineering System</strong> — Padrão Local-First & Zero Fabricação.
        </div>
        <div style={{ marginTop: '0.4rem' }}>
          Em conformidade estrita com a LGPD (Lei Geral de Proteção de Dados): Seus dados nunca saem do seu navegador.
        </div>
      </footer>
    </div>
  )
}
