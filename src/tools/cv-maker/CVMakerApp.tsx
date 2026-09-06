import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { CVData, CVVersions, TextVariant, ThemeVariant, LayoutVariant, ViewMode, CoverLetter, CVDesignConfig, LayoutStructureConfig, SectionBoxDimensions, PageFormat, ZoomMode } from './types/cv'
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
import { CVStoreModal } from './components/StoreModal/CVStoreModal'
import { GenerateCoverLetterModal } from './components/Modals/GenerateCoverLetterModal'
import { AgentAndAcademyLandingPage, LandingTabType } from './components/Landing/AgentAndAcademyLandingPage'
import { validateLicenseKey } from './services/cvService'
import { downloadCVZipPackage } from './services/standaloneHtmlService'
import { CVPrintEngine } from './services/CVPrintEngine'
import { PageFormatEngine } from './engine/PageFormatEngine'

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
const STORAGE_WORKSPACE_MODE_KEY = 'cv_maker_workspace_mode_v1'
const STORAGE_PAGE_FORMAT_KEY = 'cv_maker_page_format_v1'
const STORAGE_ZOOM_MODE_KEY = 'cv_maker_zoom_mode_v1'

export type WorkspaceMode = 'split' | 'canvas-focus' | 'sidebar-focus'

export const CVMakerApp: React.FC = () => {
  // Navigation & Workspace Layout Modes
  const [activeTab, setActiveTab] = useState<'chat' | 'editor' | 'history' | 'canvas'>('editor')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => {
    const saved = localStorage.getItem(STORAGE_WORKSPACE_MODE_KEY) as WorkspaceMode
    return saved || 'split'
  })
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false)

  const handleWorkspaceModeChange = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode)
    localStorage.setItem(STORAGE_WORKSPACE_MODE_KEY, mode)
    if (mode !== 'canvas-focus') setIsMobileDrawerOpen(false)
  }

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

  // Paper Format & Optical Preview Zoom (Paridade Matemática 1:1)
  const [activePageFormat, setActivePageFormat] = useState<PageFormat>(() => {
    const saved = localStorage.getItem(STORAGE_PAGE_FORMAT_KEY) as PageFormat
    return saved || 'a4'
  })
  const [activeZoomMode, setActiveZoomMode] = useState<ZoomMode>(() => {
    const saved = localStorage.getItem(STORAGE_ZOOM_MODE_KEY)
    if (!saved) return 'auto'
    if (saved === 'auto' || saved === '100' || saved === 'fit-width') return saved as ZoomMode
    const num = parseFloat(saved)
    return isNaN(num) ? 'auto' : num
  })
  const [currentScale, setCurrentScale] = useState<number>(1.0)

  const handlePageFormatChange = (format: PageFormat) => {
    setActivePageFormat(format)
    localStorage.setItem(STORAGE_PAGE_FORMAT_KEY, format)
    PageFormatEngine.applyFormat(format)
  }

  const handleZoomModeChange = (zoom: ZoomMode | number) => {
    setActiveZoomMode(zoom)
    localStorage.setItem(STORAGE_ZOOM_MODE_KEY, String(zoom))
  }

  useEffect(() => {
    PageFormatEngine.applyFormat(activePageFormat)
  }, [activePageFormat])

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
    const existing = layoutStructures[activeLayout]
    if (existing) {
      if (activeLayout === 'canvas_livre') {
        return {
          ...existing,
          isFreeCanvasActive: existing.isFreeCanvasActive ?? true
        }
      }
      return existing
    }
    return {
      isFreeCanvasActive: activeLayout === 'canvas_livre',
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

  // Compactar Blocos e Eliminar Vácuos Artificiais (Opção A)
  const handleAutoPackBlocks = () => {
    if (!currentStructureConfig || !currentStructureConfig.sectionDimensions) return
    const currentDims = currentStructureConfig.sectionDimensions
    const cleanedDims: Record<string, SectionBoxDimensions> = {}
    let countCleaned = 0

    Object.entries(currentDims).forEach(([key, dims]) => {
      if (!dims) return
      const {
        minHeightPx,
        maxHeightPx,
        marginTopPx,
        marginLeftPx,
        ...keepProperties
      } = dims

      if (minHeightPx || maxHeightPx || marginTopPx || marginLeftPx) {
        countCleaned++
      }

      cleanedDims[key] = {
        ...keepProperties
      }
    })

    const updatedConfig: LayoutStructureConfig = {
      ...currentStructureConfig,
      sectionDimensions: cleanedDims
    }

    handleUpdateStructureConfig(updatedConfig)

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cv-box-moved'))
    }, 50)

    alert(`⚡ ${countCleaned > 0 ? `${countCleaned} blocos foram compactados` : 'Blocos já se encontram compactados'}!\n• Alturas forçadas e margens desnecessárias foram eliminadas.\n• Variantes visuais, larguras de coluna e ordem foram preservadas.`)
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

  const [activeScreen, setActiveScreen] = useState<'editor' | 'landing_page'>('editor')
  const [landingInitialTab, setLandingInitialTab] = useState<LandingTabType>('academy')
  const [landingHubSubTab, setLandingHubSubTab] = useState<'agent_prompt' | 'master_synthesis' | 'prompts_library' | 'openapi_hub' | 'api_key'>('agent_prompt')
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false)
  const [isCoverLetterModalOpen, setIsCoverLetterModalOpen] = useState<boolean>(false)
  const [isPro, setIsPro] = useState<boolean>(false)
  const [tokenBalance, setTokenBalance] = useState<number>(0)
  const [saveHistoryFeedback, setSaveHistoryFeedback] = useState<boolean>(false)
  const [hasActiveKey, setHasActiveKey] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('ld_universal_api_key'))
  })

  const handleOpenLandingPage = (
    tab: LandingTabType = 'academy',
    hubSubTab: 'agent_prompt' | 'master_synthesis' | 'prompts_library' | 'openapi_hub' | 'api_key' = 'agent_prompt'
  ) => {
    setLandingInitialTab(tab)
    setLandingHubSubTab(hubSubTab)
    setActiveScreen('landing_page')
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

  // Handle Layout Change (Modelos A4 01 a 10)
  const handleLayoutChange = (newLayout: LayoutVariant) => {
    setActiveLayout(newLayout)
    localStorage.setItem(STORAGE_LAYOUT_KEY, newLayout)
    if (newLayout === 'canvas_livre') {
      setActiveTab('canvas')
      setLayoutStructures(prev => {
        const cur = prev['canvas_livre'] || { columnSplitRatio: 32, sectionDimensions: {} }
        const updated = {
          ...prev,
          canvas_livre: {
            ...cur,
            isFreeCanvasActive: true
          }
        }
        localStorage.setItem(STORAGE_STRUCTURES_KEY, JSON.stringify(updated))
        return updated
      })
    }
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

  // Non-destructive Cover Letter injection with safety history snapshot
  const handleCoverLetterGenerated = (newCoverLetter: CoverLetter) => {
    if (!cvData) return

    // 1. Snapshot de Segurança no Histórico: salva o currículo atual ANTES de injetar a carta
    if (yamlInput && yamlInput.trim().length > 20) {
      saveCVToHistory({
        yaml: yamlInput,
        persona: activePersona,
        theme: activeTheme,
        source: 'yaml_editor',
        customLabel: `${cvData.basics?.label || 'Currículo'} (Snapshot Pré-Carta)`
      })
    }

    const updatedData: CVData = {
      ...cvData,
      coverLetter: newCoverLetter
    }
    setCvData(updatedData)
    const newYaml = cvToYaml(updatedData)
    setYamlInput(newYaml)
    debouncedSaveDraft(newYaml)

    // 2. Salva a nova versão com Carta no Histórico e atualiza lista
    const updatedHistory = saveCVToHistory({
      yaml: newYaml,
      persona: activePersona,
      theme: activeTheme,
      source: 'ai_generated',
      customLabel: `${cvData.basics?.label || 'Currículo'} + Carta de Apresentação`
    })
    setHistoryList(updatedHistory)

    // 3. Muda a visualização para a Cover Letter
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
      const cvRoot = document.querySelector('.cv-root') as HTMLElement | null
      if (cvRoot) {
        const computed = window.getComputedStyle(cvRoot)
        const bgColor = computed.getPropertyValue('--cv-color-bg').trim()
        const bgImage = computed.getPropertyValue('--cv-bg-image').trim()
        if (bgColor) document.documentElement.style.setProperty('--cv-color-bg', bgColor)
        if (bgImage) document.documentElement.style.setProperty('--cv-bg-image', bgImage)
      } else if (designConfig?.colorBg) {
        document.documentElement.style.setProperty('--cv-color-bg', designConfig.colorBg)
        if (designConfig.backgroundPattern && designConfig.backgroundPattern !== 'none') {
          document.documentElement.style.setProperty('--cv-bg-image', `url("${designConfig.backgroundPattern}")`)
        }
      }
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

  // Print PDF via Unified Deterministic DOM-to-PDF Engine (P3)
  const handlePrintPdf = async () => {
    try {
      PageFormatEngine.applyFormat(activePageFormat)
      await CVPrintEngine.triggerDirectPrint({
        candidateName: cvData?.basics?.name,
        candidateLabel: cvData?.basics?.label,
        viewMode: activeViewMode,
        sourceElement: document.getElementById('cv-printable-document')
      })
    } catch (e) {
      console.warn('[CVMakerApp] Fallback direto para window.print:', e)
      window.print()
    }
  }

  // Auto-ajuste de página única via Bissecção Real-DOM (P3)
  const handleAutoFitSinglePage = async () => {
    try {
      const result = await CVPrintEngine.autoFitSinglePage(document.getElementById('cv-printable-document'))
      if (result.converged) {
        alert(`⚡ Ajuste perfeito para 1 página concluído!\n• Fator de escala: ${(result.optimalT * 100).toFixed(0)}%\n• Iterações de bissecção: ${result.iterationsUsed}\n• Altura final: ${result.finalHeightPx}px (orçamento: 1119px)`)
      } else {
        alert(`⚠️ O currículo possui volume extenso de conteúdo textual para uma folha só.\n• Densidade compactada ao limite máximo (escala 0%).\n• Dica: considere o modo Dossiê (2 páginas) ou remova itens secundários.`)
      }
    } catch (e) {
      console.error('[CVMakerApp] Erro ao executar auto-fit:', e)
    }
  }

  return (
    <div className="cv-maker-app-wrapper" style={{ minHeight: '100vh', width: '100%' }}>
      {/* ── Super Landing Page (Hub Agente, Galeria A4, Academia & Certificado) ── */}
      {activeScreen === 'landing_page' && (
        <AgentAndAcademyLandingPage
          initialTab={landingInitialTab}
          hubSubTab={landingHubSubTab}
          onReturnToEditor={() => setActiveScreen('editor')}
          activeLayout={activeLayout}
          onSelectLayout={handleLayoutChange}
          onKeyUpdated={key => setHasActiveKey(Boolean(key))}
        />
      )}

      {/* ── Editor Principal (Preservado para zero perda de estado) ── */}
      <div
        className="cv-maker-app"
        style={{ display: activeScreen === 'editor' ? 'flex' : 'none' }}
      >
        {/* ── App Top Header ── */}
        <div className="cv-app-header cv-no-print">
        <div className="cv-app-brand">
          <button
            className="cv-mobile-open-menu-btn"
            onClick={() => setIsMobileDrawerOpen(true)}
            title="Abrir Menu Lateral"
          >
            <span>☰</span> Menu & IA
          </button>
          <span className="cv-badge-pill">⚡ CV Maker 2.0</span>
          <h2 className="cv-app-title">Gerador de Currículos & Cover Letter</h2>
        </div>

        <div className="cv-app-controls">
          {/* Seletor Tri-Modal de Distribuição de Espaço (Desktop / Laptops) */}
          <div className="cv-viewmode-switcher" title="Modos de Distribuição de Espaço">
            <button
              className={`cv-viewmode-btn ${workspaceMode === 'sidebar-focus' ? 'is-active' : ''}`}
              onClick={() => handleWorkspaceModeChange('sidebar-focus')}
              title="Foco no Menu (60% da tela para YAML, IA e Elementos)"
            >
              <span>📝</span> Foco no Menu
            </button>
            <button
              className={`cv-viewmode-btn ${workspaceMode === 'split' ? 'is-active' : ''}`}
              onClick={() => handleWorkspaceModeChange('split')}
              title="Dividir Tela (50/50 balanceado)"
            >
              <span>◨</span> Dividir 50/50
            </button>
            <button
              className={`cv-viewmode-btn ${workspaceMode === 'canvas-focus' ? 'is-active' : ''}`}
              onClick={() => handleWorkspaceModeChange('canvas-focus')}
              title="Foco no Preview (Minimizar menu e usar 100% da folha A4)"
            >
              <span>🖥️</span> Foco no Preview
            </button>
          </div>

          <button className="cv-btn-secondary" onClick={handleReset} title="Restaurar modelo padrão de exemplo">
            🔄 Resetar Modelo
          </button>
        </div>
      </div>

      {/* ── Split Layout (Sidebar ↔ Preview com Suporte Tri-Modal) ── */}
      <div className={`cv-split-layout cv-layout-mode--${workspaceMode} ${isMobileDrawerOpen ? 'cv-mobile-drawer-open' : ''}`}>
        {/* Backdrop para mobile drawer */}
        <div
          className="cv-mobile-drawer-backdrop"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />

        {/* Left Column: Sidebar (Chat / YAML Editor / History / Elementos) */}
        <aside className="cv-sidebar cv-no-print" aria-label="Painel de Controle">
          {/* Barra Superior da Sidebar com Ações de Minimizar/Expandir */}
          <div className="cv-sidebar-header-bar">
            <span>
              {activeTab === 'chat' && '✨ Assistente IA'}
              {activeTab === 'editor' && '📝 Editor YAML'}
              {activeTab === 'history' && '📜 Histórico'}
              {activeTab === 'canvas' && '🎨 Elementos'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                className="cv-mobile-close-btn"
                onClick={() => setIsMobileDrawerOpen(false)}
                title="Fechar Menu"
              >
                ✕ Fechar
              </button>
              <button
                className="cv-sidebar-collapse-btn"
                onClick={() => handleWorkspaceModeChange(workspaceMode === 'canvas-focus' ? 'split' : 'canvas-focus')}
                title={workspaceMode === 'canvas-focus' ? 'Expandir Painel' : 'Minimizar Painel'}
              >
                {workspaceMode === 'canvas-focus' ? '▶ Expandir' : '◀ Minimizar'}
              </button>
            </div>
          </div>

          <div className="cv-sidebar-tabs">
            <button
              className={`cv-sidebar-tab ${activeTab === 'chat' ? 'cv-sidebar-tab--active' : ''}`}
              onClick={() => {
                setActiveTab('chat')
                if (workspaceMode === 'canvas-focus') handleWorkspaceModeChange('split')
              }}
              title="Assistente IA"
            >
              <span>✨</span> <span className="cv-sidebar-tab-text">Assistente IA</span>
            </button>
            <button
              className={`cv-sidebar-tab ${activeTab === 'editor' ? 'cv-sidebar-tab--active' : ''}`}
              onClick={() => {
                setActiveTab('editor')
                if (workspaceMode === 'canvas-focus') handleWorkspaceModeChange('split')
              }}
              title="Editor YAML"
            >
              <span>📝</span> <span className="cv-sidebar-tab-text">Editor YAML {parseError ? '⚠️' : '✓'}</span>
            </button>
            <button
              className={`cv-sidebar-tab ${activeTab === 'history' ? 'cv-sidebar-tab--active' : ''}`}
              onClick={() => {
                refreshHistory()
                setActiveTab('history')
                if (workspaceMode === 'canvas-focus') handleWorkspaceModeChange('split')
              }}
              title="Histórico"
            >
              <span>📜</span> <span className="cv-sidebar-tab-text">Histórico ({historyList.length})</span>
            </button>
            <button
              className={`cv-sidebar-tab ${activeTab === 'canvas' ? 'cv-sidebar-tab--active' : ''}`}
              onClick={() => {
                setActiveTab('canvas')
                if (workspaceMode === 'canvas-focus') handleWorkspaceModeChange('split')
              }}
              title="Paleta de Elementos e Variantes do Canvas Livre"
            >
              <span>🎨</span> <span className="cv-sidebar-tab-text">Elementos {currentStructureConfig.isFreeCanvasActive ? '✨' : ''}</span>
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
                onAutoPackBlocks={handleAutoPackBlocks}
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
            onAutoPackBlocks={handleAutoPackBlocks}
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
            onDownloadZip={handleDownloadZip}
            onPrintPdf={handlePrintPdf}
            onAutoFitSinglePage={handleAutoFitSinglePage}
            activePageFormat={activePageFormat}
            onPageFormatChange={handlePageFormatChange}
            activeZoomMode={activeZoomMode}
            onZoomModeChange={handleZoomModeChange}
            currentScale={currentScale}
            onOpenDesignModal={() => setIsDesignModalOpen(true)}
            onOpenApiKeyModal={() => handleOpenLandingPage('hub', 'agent_prompt')}
            hasActiveKey={hasActiveKey}
            isPro={isPro}
            tokenBalance={tokenBalance}
            onOpenStoreModal={() => setIsStoreModalOpen(true)}
            onOpenTemplateGallery={() => handleOpenLandingPage('gallery')}
            onOpenAcademy={() => handleOpenLandingPage('academy')}
          />

          <div className="cv-preview-viewport">
            <CVViewer
              data={cvData}
              theme={activeTheme}
              layout={activeLayout}
              viewMode={activeViewMode}
              designConfig={designConfig}
              onRequestGenerateCoverLetter={() => setIsCoverLetterModalOpen(true)}
              structureConfig={currentStructureConfig}
              onUpdateStructureConfig={handleUpdateStructureConfig}
              pageFormat={activePageFormat}
              zoomMode={activeZoomMode}
              onScaleChange={setCurrentScale}
            />
          </div>
        </main>
      </div>

      {/* ── Modais ── */}
      <DesignCustomizerDrawer
        isOpen={isDesignModalOpen}
        onClose={() => setIsDesignModalOpen(false)}
        config={designConfig}
        onChangeConfig={handleDesignConfigChange}
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
        onOpenStoreModal={() => setIsStoreModalOpen(true)}
      />
      </div>
    </div>
  )
}
