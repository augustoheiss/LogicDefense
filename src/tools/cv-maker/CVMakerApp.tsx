import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { CVData, CVVersions, TextVariant, ThemeVariant } from './types/cv'
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
import { validateLicenseKey } from './services/cvService'

import './styles/cv-themes.css'
import './styles/cv-print.css'
import './styles/cv-viewer.css'
import './styles/chat-interface.css'
import './styles/cv-history.css'
import './styles/cv-prompts-modal.css'
import './styles/cv-maker.css'

const STORAGE_DRAFT_KEY = 'ld_cv_draft_v2'
const STORAGE_THEME_KEY = 'ld_cv_theme_v2'

export const CVMakerApp: React.FC = () => {
  // Sidebar mode: 'chat' (AI Assistant), 'editor' (Raw YAML Editor) or 'history' (20 Local Versions)
  const [activeTab, setActiveTab] = useState<'chat' | 'editor' | 'history'>('chat')

  // Storage and Draft State
  const [yamlInput, setYamlInput] = useState<string>(() => {
    return localStorage.getItem(STORAGE_DRAFT_KEY) || DEFAULT_JOHN_DOE_YAML
  })
  const [cvVersions, setCvVersions] = useState<CVVersions | null>(null)
  const [cvData, setCvData] = useState<CVData | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  // Local-First History Ledger (Up to 20 items)
  const [historyList, setHistoryList] = useState<CVHistoryItem[]>(() => getCVHistory())

  // Personas & Themes
  const [activePersona, setActivePersona] = useState<TextVariant>('professional')
  const [activeTheme, setActiveTheme] = useState<ThemeVariant>(() => {
    return (localStorage.getItem(STORAGE_THEME_KEY) as ThemeVariant) || 'executive'
  })

  // Modals & Pro Licensing State
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false)
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false)
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false)
  const [isOpenPromptsModalOpen, setIsOpenPromptsModalOpen] = useState<boolean>(false)
  const [isPro, setIsPro] = useState<boolean>(false)
  const [tokenBalance, setTokenBalance] = useState<number>(0)
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
      debounce((content: string) => {
        localStorage.setItem(STORAGE_DRAFT_KEY, content)
        localStorage.setItem('ld_cv_last_modified', new Date().toISOString())
      }, 500),
    []
  )

  // Parse YAML into structured CVData
  const handleParse = useCallback((raw: string) => {
    const res = parseYamlToCV(raw)
    if (res.data) {
      setCvData(res.data)
      setParseError(null)
    } else {
      setParseError(res.error)
    }
  }, [])

  // Initial parse on mount
  useEffect(() => {
    handleParse(yamlInput)
  }, [])

  // Dynamically sync document.title with candidate name and label for clean PDF export & browser title
  useEffect(() => {
    if (cvData?.basics?.name) {
      const name = cvData.basics.name.trim()
      const label = cvData.basics.label ? ` - ${cvData.basics.label.trim()}` : ''
      document.title = `${name}${label}`
    } else {
      document.title = 'CV Maker 2.0 — Gerador de Currículos'
    }
  }, [cvData])

  // Refresh history state
  const refreshHistory = useCallback(() => {
    setHistoryList(getCVHistory())
  }, [])

  // When AI generates new versions, switch active version and save all 5 to history!
  const handleCVGenerated = (versions: CVVersions) => {
    setCvVersions(versions)
    const activeVersionText = versions[activePersona] || versions.professional
    setYamlInput(activeVersionText)
    handleParse(activeVersionText)
    debouncedSaveDraft(activeVersionText)

    // Salva automaticamente todas as 5 versões geradas no Histórico Local
    const updatedHistory = saveMultipleCVsToHistory(versions, 'ai_generated')
    setHistoryList(updatedHistory)
  }

  // Persona change
  const handlePersonaChange = (newPersona: TextVariant) => {
    setActivePersona(newPersona)
    if (cvVersions) {
      const selectedText = cvVersions[newPersona] || cvVersions.professional
      setYamlInput(selectedText)
      handleParse(selectedText)
      debouncedSaveDraft(selectedText)
    }
  }

  // Theme change
  const handleThemeChange = (newTheme: ThemeVariant) => {
    setActiveTheme(newTheme)
    localStorage.setItem(STORAGE_THEME_KEY, newTheme)
  }

  // Direct editor change
  const handleEditorChange = (val: string) => {
    setYamlInput(val)
    handleParse(val)
    debouncedSaveDraft(val)

    // Salva no histórico se for um YAML válido e não trivial
    const parsed = parseYamlToCV(val)
    if (parsed.data && parsed.data.basics.name) {
      const updated = saveCVToHistory({
        yaml: val,
        persona: activePersona,
        theme: activeTheme,
        source: 'yaml_editor',
      })
      setHistoryList(updated)
    }
  }

  // Load selected version from history into editor and active view
  const handleSelectHistoryVersion = (item: CVHistoryItem) => {
    setYamlInput(item.yaml)
    setActivePersona(item.persona)
    if (item.theme) {
      setActiveTheme(item.theme)
      localStorage.setItem(STORAGE_THEME_KEY, item.theme)
    }
    handleParse(item.yaml)
    debouncedSaveDraft(item.yaml)
  }

  // Delete version from history
  const handleDeleteHistoryVersion = (id: string) => {
    const updated = deleteHistoryItem(id)
    setHistoryList(updated)
  }

  // Full LGPD & Privacy Reset
  const handleWipeAllLGPD = () => {
    const confirmed = window.confirm(
      '⚠️ ATENÇÃO — LIMPEZA TOTAL DE PRIVACIDADE / LGPD\n\n' +
      'Esta ação irá apagar permanentemente todos os 20 currículos do histórico, ' +
      'rascunhos e preferências salvas no seu navegador, restaurando o modelo padrão de exemplo.\n\n' +
      'Deseja realmente limpar todos os seus dados deste dispositivo?'
    )
    if (!confirmed) return

    clearAllCVDataAndHistory()
    setHistoryList([])
    setCvVersions(null)
    setYamlInput(DEFAULT_JOHN_DOE_YAML)
    handleParse(DEFAULT_JOHN_DOE_YAML)
    setActivePersona('professional')
    setActiveTheme('executive')
    alert('✅ Sucesso! Todos os dados locais foram excluídos. O modelo padrão foi restaurado.')
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

    const updated = saveCVToHistory({
      yaml: newYaml,
      persona: activePersona,
      theme: activeTheme,
      source: 'yaml_editor',
    })
    setHistoryList(updated)
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

  // Download ZIP Package (.html + .yaml)
  const handleDownloadZip = async () => {
    try {
      const response = await fetch('/api/v1/cv/render?format=zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: yamlInput,
          theme: activeTheme,
          filename: `curriculo-${cvData?.basics.name.toLowerCase().replace(/\s+/g, '-') || 'cv'}`
        })
      })
      if (!response.ok) throw new Error('Falha ao gerar ZIP')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `curriculo-${cvData?.basics.name.toLowerCase().replace(/\s+/g, '-') || 'cv'}-completo.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('Erro ao gerar pacote ZIP na API. Baixando YAML diretamente...')
      handleDownloadYaml()
    }
  }

  // Print PDF
  const handlePrintPdf = () => {
    if (cvData?.basics?.name) {
      const name = cvData.basics.name.trim()
      const label = cvData.basics.label ? ` - ${cvData.basics.label.trim()}` : ''
      document.title = `${name}${label}`
    }
    window.print()
  }

  return (
    <div className="cv-maker-app">
      {/* ── App Top Header ── */}
      <div className="cv-app-header cv-no-print">
        <div className="cv-app-brand">
          <span className="cv-badge-pill">⚡ CV Maker 2.0</span>
          <h2 className="cv-app-title">Gerador de Currículos de Alta Precisão</h2>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                    Código YAML (Fonte Única de Verdade)
                  </span>
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
                activeYaml={yamlInput}
              />
            )}
          </div>
        </aside>

        {/* Right Column: Preview & Floating Toolbar */}
        <main className="cv-preview-area" aria-label="Visualização do Currículo">
          <CVToolbar
            activePersona={activePersona}
            onPersonaChange={handlePersonaChange}
            activeTheme={activeTheme}
            onThemeChange={handleThemeChange}
            onDownloadYaml={handleDownloadYaml}
            onDownloadZip={handleDownloadZip}
            onPrintPdf={handlePrintPdf}
            onOpenPhotoModal={() => setIsPhotoModalOpen(true)}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            hasActiveKey={hasActiveKey}
            isPro={isPro}
            tokenBalance={tokenBalance}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
          />

          <CVViewer data={cvData} theme={activeTheme} />
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
    </div>
  )
}
