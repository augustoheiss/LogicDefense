import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { CVData, CVVersions, TextVariant, ThemeVariant, LayoutVariant, ViewMode, CoverLetter } from './types/cv'
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
import { OpenPromptsModal } from './components/PromptsModal/OpenPromptsModal'
import { PhotoUploader } from './components/Toolbar/PhotoUploader'
import { ApiKeyModal } from './components/ApiKeyModal/ApiKeyModal'
import { CVStoreModal } from './components/StoreModal/CVStoreModal'
import { GenerateCoverLetterModal } from './components/Modals/GenerateCoverLetterModal'
import { validateLicenseKey } from './services/cvService'
import { downloadCVHtmlFile, downloadCVCoverLetterHtml, downloadCVZipPackage } from './services/standaloneHtmlService'

import './styles/cv-themes.css'
import './styles/cv-print.css'
import './styles/cv-viewer.css'
import './styles/chat-interface.css'
import './styles/cv-history.css'
import './styles/cv-prompts-modal.css'
import './styles/cv-maker.css'

const STORAGE_DRAFT_KEY = 'cv_maker_active_yaml_draft_v1'
const STORAGE_THEME_KEY = 'cv_maker_theme_v1'
const STORAGE_LAYOUT_KEY = 'cv_maker_layout_v1'
const STORAGE_VIEW_MODE_KEY = 'cv_maker_view_mode_v1'

export const CVMakerApp: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<'chat' | 'editor' | 'history'>('editor')

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

  // Modals & Pro Licensing State
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false)
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false)
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false)
  const [isOpenPromptsModalOpen, setIsOpenPromptsModalOpen] = useState<boolean>(false)
  const [isCoverLetterModalOpen, setIsCoverLetterModalOpen] = useState<boolean>(false)
  const [isPro, setIsPro] = useState<boolean>(false)
  const [tokenBalance, setTokenBalance] = useState<number>(0)
  const [saveHistoryFeedback, setSaveHistoryFeedback] = useState<boolean>(false)
  const [hasActiveKey, setHasActiveKey] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('ld_universal_api_key'))
  })

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
  const handleSavePhoto = (photoUrlOrBase64?: string) => {
    if (!cvData) return
    const updatedData: CVData = {
      ...cvData,
      basics: {
        ...cvData.basics,
        image: photoUrlOrBase64,
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
    })
  }

  // Download Cover Letter HTML
  const handleDownloadCoverLetterHtml = () => {
    downloadCVCoverLetterHtml({
      yaml: yamlInput,
      name: cvData?.basics?.name || 'candidato',
      theme: activeTheme,
      layout: activeLayout,
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
    })
  }

  // Print PDF
  const handlePrintPdf = () => {
    if (cvData?.basics?.name) {
      const name = cvData.basics.name.trim()
      const label = cvData.basics.label ? ` - ${cvData.basics.label.trim()}` : ''
      const modeSuffix = activeViewMode === 'cover_letter' ? ' - Carta de Apresentação' : activeViewMode === 'both' ? ' - Dossiê Completo' : ''
      document.title = `${name}${label}${modeSuffix}`
    }
    window.print()
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
          <button
            className="cv-btn-secondary"
            onClick={() => setIsOpenPromptsModalOpen(true)}
            style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
            title="Ver e copiar os System Prompts abertos para usar no ChatGPT ou Claude"
          >
            📖 Prompts Abertos (IA Grátis)
          </button>
          <button className="cv-btn-secondary" onClick={handleReset} title="Restaurar modelo padrão de exemplo">
            🔄 Resetar Modelo
          </button>
          <button
            className="cv-btn-secondary"
            onClick={() => setIsApiKeyModalOpen(true)}
            style={hasActiveKey ? { borderColor: '#10b981', color: '#34d399' } : {}}
          >
            🔑 {hasActiveKey ? 'API Key Ativa' : 'Habilitar Chave API'}
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
          </div>
        </aside>

        {/* Right Column: Preview & Floating Toolbar */}
        <main className="cv-preview-area" aria-label="Visualização do Currículo">
          <CVToolbar
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
            onOpenPhotoModal={() => setIsPhotoModalOpen(true)}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
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
            onRequestGenerateCoverLetter={() => setIsCoverLetterModalOpen(true)}
          />
        </main>
      </div>

      {/* ── Modais ── */}
      {isPhotoModalOpen && (
        <PhotoUploader
          currentPhoto={cvData?.basics.image}
          onSavePhoto={handleSavePhoto}
          onClose={() => setIsPhotoModalOpen(false)}
        />
      )}

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyUpdated={key => setHasActiveKey(Boolean(key))}
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

      <OpenPromptsModal
        isOpen={isOpenPromptsModalOpen}
        onClose={() => setIsOpenPromptsModalOpen(false)}
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
