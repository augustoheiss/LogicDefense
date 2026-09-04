import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { CVData, CVVersions, TextVariant, ThemeVariant, LayoutVariant, ViewMode, CoverLetter, CVDesignConfig, LayoutStructureConfig } from './types/cv'
import { DEFAULT_DESIGN_CONFIG } from './types/cv'
import { DEFAULT_JOHN_DOE_YAML } from './templates/defaultTemplate'
import { parseYamlToCV, cvToYaml, debounce } from './services/yamlService'
import {
  getCVHistory,
  saveCVToHistory,
  saveMultipleCVsToHistory,
  deleteHistoryItem,
  clearAllCVDataAndHistory,
  type CVHistoryItem
} from './services/historyService'
import { CVViewer } from './components/CVViewer/CVViewer'
import { ChatInterface } from './components/Chat/ChatInterface'
import { CVToolbar } from './components/Toolbar/CVToolbar'
import { CVHistoryTab } from './components/History/CVHistoryTab'
import { DesignCustomizerDrawer } from './components/Toolbar/DesignCustomizerDrawer'
import { CanvasElementsPalette } from './components/CanvasBuilder/CanvasElementsPalette'
import { AgentHubModal } from './components/Modals/AgentHubModal'
import { CVStoreModal } from './components/StoreModal/CVStoreModal'
import { GenerateCoverLetterModal } from './components/Modals/GenerateCoverLetterModal'
import { validateLicenseKey } from './services/cvService'
import { downloadCVHtmlFile, downloadCVCoverLetterHtml, downloadCVZipPackage } from './services/standaloneHtmlService'

import './styles/cv-themes.css'
import './styles/cv-print.css'
import './styles/cv-viewer.css'
import './styles/cv-canvas-builder.css'
import './styles/chat-interface.css'
import './styles/cv-history.css'
import './styles/cv-prompts-modal.css'
import './styles/cv-maker.css'

const STORAGE_DRAFT_KEY = 'cv_maker_active_yaml_draft_v1'
const STORAGE_THEME_KEY = 'cv_maker_theme_v1'
const STORAGE_LAYOUT_KEY = 'cv_maker_layout_v1'
const STORAGE_VIEW_MODE_KEY = 'cv_maker_view_mode_v1'
const STORAGE_STRUCTURES_KEY = 'cv_maker_layout_structures_v1'

export const CVMakerApp: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<'chat' | 'editor' | 'history' | 'canvas'>('editor')

  // Core Data
  const [yamlInput, setYamlInput] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_DRAFT_KEY)
    if (!saved) return DEFAULT_JOHN_DOE_YAML
    if (!saved.includes('coverLetter:')) {
      if (saved.includes('Alexandre Silva') || saved.includes('Senior Software Architect') || saved.includes('Enterprise Tech Solutions')) {
        localStorage.setItem(STORAGE_DRAFT_KEY, DEFAULT_JOHN_DOE_YAML)
        return DEFAULT_JOHN_DOE_YAML
      }
    }
    if (saved.includes('alexandresilva') || saved.includes('alexandre.silva@example.com')) {
      const sanitized = saved
        .split('https://linkedin.com/in/alexandresilva').join('https://linkedin.com/in/alexandre-silva-ficticio-demo-99999')
        .split('https://github.com/alexandresilva').join('https://github.com/alexandre-silva-ficticio-demo-99999')
        .split('alexandresilva').join('alexandre-silva-demo')
        .split('alexandre.silva@example.com').join('alexandre.silva.demo@exemplo-ficticio.com')
      localStorage.setItem(STORAGE_DRAFT_KEY, sanitized)
      return sanitized
    }
    return saved
  })
  const [cvVersions, setCvVersions] = useState<CVVersions | null>(null)
  const [cvData, setCvData] = useState<CVData | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  // Local-First History Ledger (Up to 20 items)
  const [historyList, setHistoryList] = useState<CVHistoryItem[]>(() => getCVHistory())

  // Personas, Themes, Layouts & View Modes
  const [activePersona, setActivePersona] = useState<TextVariant>('professional')
  const [activeTheme, setActiveTheme] = useState<ThemeVariant>(() => {
    return (localStorage.getItem(STORAGE_THEME_KEY) as ThemeVariant) || 'executive'
  })
  const [activeLayout, setActiveLayout] = useState<LayoutVariant>(() => {
    return (localStorage.getItem(STORAGE_LAYOUT_KEY) as LayoutVariant) || 'modular'
  })
  const [activeViewMode, setActiveViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem(STORAGE_VIEW_MODE_KEY) as ViewMode) || 'cv'
  })

  // Per-Layout Universal Structure & Free Canvas Config
  const [layoutStructures, setLayoutStructures] = useState<Record<string, LayoutStructureConfig>>(() => {
    const saved = localStorage.getItem(STORAGE_STRUCTURES_KEY)
    if (!saved) return {}
    try {
      return JSON.parse(saved)
    } catch {
      return {}
    }
  })

  const currentStructureConfig = useMemo<LayoutStructureConfig>(() => {
    return layoutStructures[activeLayout] || {
      isFreeCanvasActive: false,
      columnSplitRatio: 32,
      sectionDimensions: {}
    }
  }, [layoutStructures, activeLayout])

  const handleUpdateStructureConfig = (newConfig: LayoutStructureConfig) => {
    setLayoutStructures(prev => {
      const updated = {
        ...prev,
        [activeLayout]: newConfig
      }
      localStorage.setItem(STORAGE_STRUCTURES_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const handleToggleFreeCanvas = () => {
    const nextState = !currentStructureConfig.isFreeCanvasActive
    handleUpdateStructureConfig({
      ...currentStructureConfig,
      isFreeCanvasActive: nextState
    })
    if (nextState) {
      setActiveTab('canvas')
    }
  }

  const handleResetStructure = () => {
    setLayoutStructures(prev => {
      const updated = { ...prev }
      delete updated[activeLayout]
      localStorage.setItem(STORAGE_STRUCTURES_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Modals & Pro Licensing State
  const STORAGE_DESIGN_KEY = 'cv_maker_design_config_v1'
  const [designConfig, setDesignConfig] = useState<CVDesignConfig>(() => {
    const saved = localStorage.getItem(STORAGE_DESIGN_KEY)
    if (!saved) return DEFAULT_DESIGN_CONFIG
    try {
      return { ...DEFAULT_DESIGN_CONFIG, ...JSON.parse(saved) }
    } catch {
      return DEFAULT_DESIGN_CONFIG
    }
  })
  const [isDesignModalOpen, setIsDesignModalOpen] = useState<boolean>(false)

  const handleDesignConfigChange = (newConfig: CVDesignConfig) => {
    setDesignConfig(newConfig)
    localStorage.setItem(STORAGE_DESIGN_KEY, JSON.stringify(newConfig))
  }

  const [isAgentHubModalOpen, setIsAgentHubModalOpen] = useState<boolean>(false)
  const [agentHubInitialTab, setAgentHubInitialTab] = useState<'agent_prompt' | 'master_synthesis' | 'prompts_library' | 'openapi_hub' | 'api_key'>('agent_prompt')
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false)
  const [isCoverLetterModalOpen, setIsCoverLetterModalOpen] = useState<boolean>(false)
  const [isPro, setIsPro] = useState<boolean>(false)
  const [tokenBalance, setTokenBalance] = useState<number>(0)
  const [saveHistoryFeedback, setSaveHistoryFeedback] = useState<boolean>(false)
  const [hasActiveKey, setHasActiveKey] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('ld_universal_api_key'))
  })

  const handleOpenAgentHub = (tab: 'agent_prompt' | 'master_synthesis' | 'prompts_library' | 'openapi_hub' | 'api_key' = 'agent_prompt') => {
    setAgentHubInitialTab(tab)
    setIsAgentHubModalOpen(true)
  }

  // Fetch / Validate Pro license on mount
  const checkLicense = useCallback(async () => {
    const key = localStorage.getItem('ld_pro_license_key') || localStorage.getItem('am_license_key')
    if (!key) {
      setIsPro(false)
      setTokenBalance(0)
      return
    }
    try {
      const res = await validateLicenseKey(key)
      if (res.valid) {
        setIsPro(true)
        setTokenBalance(res.token_balance ?? res.tokenBalance ?? 0)
      } else {
        setIsPro(false)
      }
    } catch {
      // Falha silenciosa de rede
    }
  }, [])

  useEffect(() => {
    checkLicense()
  }, [checkLicense])

  // Debounced LocalStorage Saver (500ms)
  const debouncedSaveDraft = useMemo(
    () =>
      debounce((val: string) => {
        try {
          localStorage.setItem(STORAGE_DRAFT_KEY, val)
        } catch {
          // Quota storage exceeded handling
        }
      }, 500),
    []
  )

  // Parse YAML to data structure
  const handleParse = useCallback((yamlStr: string) => {
    const res = parseYamlToCV(yamlStr)
    if (res.error) {
      setParseError(res.error)
    } else {
      setParseError(null)
      setCvData(res.data)
    }
  }, [])

  // Initial parse on mount
  useEffect(() => {
    handleParse(yamlInput)
  }, [handleParse, yamlInput])

  // Manual save current version to Local-First History
  const handleManualSaveHistory = () => {
    if (!cvData?.basics?.name) return
    saveCVToHistory({
      yaml: yamlInput,
      persona: activePersona,
      theme: activeTheme,
      source: 'yaml_editor',
      customName: cvData.basics.name,
      customLabel: cvData.basics.label,
    })
    setHistoryList(getCVHistory())
    setSaveHistoryFeedback(true)
    setTimeout(() => setSaveHistoryFeedback(false), 2500)
  }

  // Refresh history list helper
  const refreshHistory = () => {
    setHistoryList(getCVHistory())
  }

  // Select historical version
  const handleSelectHistoryVersion = (item: CVHistoryItem) => {
    setYamlInput(item.yaml)
    handleParse(item.yaml)
    setActivePersona(item.persona)
    setActiveTheme(item.theme || 'executive')
    debouncedSaveDraft(item.yaml)
    setActiveTab('editor')
  }

  // Delete historical version
  const handleDeleteHistoryVersion = (id: string) => {
    deleteHistoryItem(id)
    setHistoryList(getCVHistory())
  }

  // LGPD Wipe all data
  const handleWipeAllLGPD = () => {
    clearAllCVDataAndHistory()
    setHistoryList([])
    setCvVersions(null)
    setYamlInput(DEFAULT_JOHN_DOE_YAML)
    handleParse(DEFAULT_JOHN_DOE_YAML)
    debouncedSaveDraft(DEFAULT_JOHN_DOE_YAML)
    setActiveTab('editor')
  }

  // Handle Theme Change
  const handleThemeChange = (newTheme: ThemeVariant) => {
    setActiveTheme(newTheme)
    localStorage.setItem(STORAGE_THEME_KEY, newTheme)
  }

  // Handle Layout Change (Modelos A4 01 a 08)
  const handleLayoutChange = (newLayout: LayoutVariant) => {
    setActiveLayout(newLayout)
    localStorage.setItem(STORAGE_LAYOUT_KEY, newLayout)
  }

  // Handle View Mode Change (Currículo / Cover Letter / Dossiê 2 Páginas)
  const handleViewModeChange = (newViewMode: ViewMode) => {
    setActiveViewMode(newViewMode)
    localStorage.setItem(STORAGE_VIEW_MODE_KEY, newViewMode)
  }

  // Handle Persona Change
  const handlePersonaChange = (p: TextVariant) => {
    setActivePersona(p)
    if (cvVersions && cvVersions[p]) {
      const selectedYaml = cvVersions[p]!
      setYamlInput(selectedYaml)
      handleParse(selectedYaml)
      debouncedSaveDraft(selectedYaml)
    }
  }

  // Editor onChange
  const handleEditorChange = (val: string) => {
    setYamlInput(val)
    handleParse(val)
    debouncedSaveDraft(val)
  }

  // Non-destructive Cover Letter injection
  const handleCoverLetterGenerated = (newCoverLetter: CoverLetter) => {
    if (!cvData) return
    const updatedData: CVData = {
      ...cvData,
      coverLetter: newCoverLetter
    }
    setCvData(updatedData)
    const newYaml = cvToYaml(updatedData)
    setYamlInput(newYaml)
    debouncedSaveDraft(newYaml)
    setActiveViewMode('cover_letter')
  }

  // AI Chat generation callback
  const handleCVGenerated = (versions: CVVersions) => {
    setCvVersions(versions)
    const primaryYaml = versions[activePersona] || versions.professional
    setYamlInput(primaryYaml)
    handleParse(primaryYaml)
    debouncedSaveDraft(primaryYaml)
    setActiveTab('editor')

    saveMultipleCVsToHistory(versions, 'ai_generated')
    setHistoryList(getCVHistory())
  }

  // Avatar / Photo Save
  const handleSavePhoto = (photoUrlOrBase64?: string, posX = 50, posY = 50, scale = 1.0) => {
    if (!cvData) return
    const updatedData: CVData = {
      ...cvData,
      basics: {
        ...cvData.basics,
        image: photoUrlOrBase64,
        imagePosX: posX,
        imagePosY: posY,
        imageScale: scale,
      },
    }
    setCvData(updatedData)
    const newYaml = cvToYaml(updatedData)
    setYamlInput(newYaml)
    debouncedSaveDraft(newYaml)
  }

  // Reset to default
  const handleReset = () => {
    if (!window.confirm('Deseja restaurar o modelo padrão de exemplo? Suas edições ativas serão substituídas.')) return
    setCvVersions(null)
    setYamlInput(DEFAULT_JOHN_DOE_YAML)
    handleParse(DEFAULT_JOHN_DOE_YAML)
    debouncedSaveDraft(DEFAULT_JOHN_DOE_YAML)
  }

  // Download YAML
  const handleDownloadYaml = () => {
    const raw = yamlInput
    const blob = new Blob([raw], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `curriculo-${cvData?.basics.name.toLowerCase().replace(/\s+/g, '-') || 'cv'}-${activePersona}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Download HTML Standalone (conforme o modo ativo)
  const handleDownloadHtml = () => {
    downloadCVHtmlFile({
      yaml: yamlInput,
      name: cvData?.basics?.name || 'curriculo',
      persona: activePersona,
      theme: activeTheme,
      layout: activeLayout,
      viewMode: activeViewMode,
      designConfig,
    })
  }

  // Download Cover Letter HTML
  const handleDownloadCoverLetterHtml = () => {
    downloadCVCoverLetterHtml({
      yaml: yamlInput,
      name: cvData?.basics?.name || 'candidato',
      theme: activeTheme,
      layout: activeLayout,
      designConfig,
    })
  }

  // Download ZIP Package (.html + .yaml)
  const handleDownloadZip = async () => {
    await downloadCVZipPackage({
      yaml: yamlInput,
      name: cvData?.basics?.name || 'curriculo',
      persona: activePersona,
      theme: activeTheme,
      layout: activeLayout,
      designConfig,
    })
  }

  // Listeners de impressão para supressão rigorosa de badges e bordas no PDF
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add('cv-is-printing')
      document.documentElement.classList.add('cv-is-printing')
    }
    const handleAfterPrint = () => {
      document.body.classList.remove('cv-is-printing')
      document.documentElement.classList.remove('cv-is-printing')
    }
    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  // Print PDF
  const handlePrintPdf = async () => {
    if (cvData?.basics?.name) {
      const name = cvData.basics.name.trim()
      const label = cvData.basics.label ? ` - ${cvData.basics.label.trim()}` : ''
      const modeSuffix = activeViewMode === 'cover_letter' ? ' - Carta de Apresentação' : activeViewMode === 'both' ? ' - Dossiê Completo' : ''
      document.title = `${name}${label}${modeSuffix}`
    }
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready
      } catch (e) {
        console.warn('Font loading check error:', e)
      }
    }

    document.body.classList.add('cv-is-printing')
    document.documentElement.classList.add('cv-is-printing')

    const cleanupPrint = () => {
      document.body.classList.remove('cv-is-printing')
      document.documentElement.classList.remove('cv-is-printing')
      window.removeEventListener('afterprint', cleanupPrint)
    }
    window.addEventListener('afterprint', cleanupPrint)

    window.print()

    setTimeout(cleanupPrint, 2500)
  }

  return (
    <div className="cv-maker-app">
      {/* ── App Top Header ── */}
      <div className="cv-app-header cv-no-print">
        <div className="cv-app-brand">
          <span className="cv-badge-pill">⚡ CV Maker 2.0</span>
          <h2 className="cv-app-title">Gerador de Currículos & Cover Letter</h2>
        </div>

        <div className="cv-app-controls">
          <button className="cv-btn-secondary" onClick={handleReset} title="Restaurar modelo padrão de exemplo">
            🔄 Resetar Modelo
          </button>
        </div>
      </div>

      {/* ── Split Layout (Sidebar ↔ Preview) ── */}
      <div className="cv-split-layout">
        {/* Left Column: Sidebar (Chat / YAML Editor / History) */}
        <aside className="cv-sidebar cv-no-print" aria-label="Painel de Controle">
          <div className="cv-sidebar-tabs">
            <button
              className={`cv-sidebar-tab ${activeTab === 'chat' ? 'cv-sidebar-tab--active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <span>✨</span> Assistente IA
            </button>
            <button
              className={`cv-sidebar-tab ${activeTab === 'editor' ? 'cv-sidebar-tab--active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              <span>📝</span> Editor YAML {parseError ? '⚠️' : '✓'}
            </button>
            <button
              className={`cv-sidebar-tab ${activeTab === 'history' ? 'cv-sidebar-tab--active' : ''}`}
              onClick={() => {
                refreshHistory()
                setActiveTab('history')
              }}
            >
              <span>📜</span> Histórico ({historyList.length})
            </button>
            <button
              className={`cv-sidebar-tab ${activeTab === 'canvas' ? 'cv-sidebar-tab--active' : ''}`}
              onClick={() => setActiveTab('canvas')}
              title="Paleta de Elementos e Variantes do Canvas Livre"
            >
              <span>🎨</span> Elementos {currentStructureConfig.isFreeCanvasActive ? '✨' : ''}
            </button>
          </div>

          <div className="cv-sidebar-content">
            {activeTab === 'chat' && (
              <ChatInterface
                onCVGenerated={handleCVGenerated}
                hasGeneratedCVs={cvVersions !== null}
                onReset={handleReset}
                onOpenStoreModal={() => setIsStoreModalOpen(true)}
              />
            )}

            {activeTab === 'editor' && (
              <div className="cv-raw-editor">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                    Código YAML (Fonte Única de Verdade)
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <button
                      className="cv-btn-secondary"
                      onClick={handleManualSaveHistory}
                      style={
                        saveHistoryFeedback
                          ? { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderColor: '#10b981', fontWeight: 600, fontSize: '0.74rem', padding: '0.25rem 0.6rem' }
                          : { fontSize: '0.74rem', padding: '0.25rem 0.6rem' }
                      }
                      title="Salva a versão atual do YAML no Histórico Local"
                    >
                      {saveHistoryFeedback ? '✓ Salvo no Histórico!' : '💾 Salvar Versão'}
                    </button>
                    {parseError ? (
                      <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>
                        ✗ Erro de Sintaxe
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                        ✓ YAML Válido
                      </span>
                    )}
                  </div>
                </div>

                <textarea
                  className={`cv-raw-editor__textarea ${parseError ? 'cv-raw-editor__textarea--error' : ''}`}
                  value={yamlInput}
                  onChange={e => handleEditorChange(e.target.value)}
                  spellCheck={false}
                />

                {parseError && (
                  <div className="cv-editor-error">
                    {parseError}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <CVHistoryTab
                history={historyList}
                onSelectVersion={handleSelectHistoryVersion}
                onDeleteVersion={handleDeleteHistoryVersion}
                onWipeAllLGPD={handleWipeAllLGPD}
                onHistoryUpdated={refreshHistory}
                onSaveCurrentVersion={handleManualSaveHistory}
                activeYaml={yamlInput}
                activeLayout={activeLayout}
              />
            )}

            {activeTab === 'canvas' && (
              <CanvasElementsPalette
                data={cvData}
                structureConfig={currentStructureConfig}
                onUpdateStructureConfig={handleUpdateStructureConfig}
                onResetStructure={handleResetStructure}
                onUpdatePhoto={handleSavePhoto}
              />
            )}
          </div>
        </aside>

        {/* Right Column: Preview & Floating Toolbar */}
        <main
          className="cv-preview-area"
          aria-label="Visualização do Currículo"
          style={{
            backgroundColor: designConfig.colorWorkspaceBg || '#0b1120',
            transition: 'background-color 0.25s ease'
          }}
        >
          <CVToolbar
            isFreeCanvasActive={currentStructureConfig.isFreeCanvasActive}
            onToggleFreeCanvas={handleToggleFreeCanvas}
            onResetStructure={handleResetStructure}
            activePersona={activePersona}
            onPersonaChange={handlePersonaChange}
            activeLayout={activeLayout}
            onLayoutChange={handleLayoutChange}
            activeTheme={activeTheme}
            onThemeChange={handleThemeChange}
            activeViewMode={activeViewMode}
            onViewModeChange={handleViewModeChange}
            onOpenCoverLetterModal={() => setIsCoverLetterModalOpen(true)}
            hasCoverLetter={Boolean(cvData?.coverLetter?.paragraphs?.length)}
            onDownloadYaml={handleDownloadYaml}
            onDownloadHtml={handleDownloadHtml}
            onDownloadCoverLetterHtml={handleDownloadCoverLetterHtml}
            onDownloadZip={handleDownloadZip}
            onPrintPdf={handlePrintPdf}
            onOpenDesignModal={() => setIsDesignModalOpen(true)}
            onOpenApiKeyModal={() => handleOpenAgentHub('agent_prompt')}
            hasActiveKey={hasActiveKey}
            isPro={isPro}
            tokenBalance={tokenBalance}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />

          <CVViewer
            data={cvData}
            theme={activeTheme}
            layout={activeLayout}
            viewMode={activeViewMode}
            designConfig={designConfig}
            onRequestGenerateCoverLetter={() => setIsCoverLetterModalOpen(true)}
            structureConfig={currentStructureConfig}
            onUpdateStructureConfig={handleUpdateStructureConfig}
          />
        </main>
      </div>

      {/* ── Modais ── */}
      <DesignCustomizerDrawer
        isOpen={isDesignModalOpen}
        onClose={() => setIsDesignModalOpen(false)}
        config={designConfig}
        onChangeConfig={handleDesignConfigChange}
      />

      <AgentHubModal
        isOpen={isAgentHubModalOpen}
        onClose={() => setIsAgentHubModalOpen(false)}
        onKeyUpdated={key => setHasActiveKey(Boolean(key))}
        initialTab={agentHubInitialTab}
      />

      <CVStoreModal
        isOpen={isStoreModalOpen}
        onClose={() => {
          setIsStoreModalOpen(false)
          checkLicense()
        }}
        onLicenseActivated={(_key, _tier, bal) => {
          setIsPro(true)
          setTokenBalance(bal)
        }}
      />

      <GenerateCoverLetterModal
        isOpen={isCoverLetterModalOpen}
        onClose={() => setIsCoverLetterModalOpen(false)}
        cvData={cvData || { basics: { name: 'Candidato' } }}
        onCoverLetterGenerated={handleCoverLetterGenerated}
      />
    </div>
  )
}
