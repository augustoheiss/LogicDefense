import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { CVData, CVVersions, TextVariant, ThemeVariant, LayoutVariant, ViewMode, CoverLetter, CVDesignConfig, LayoutStructureConfig, SectionBoxDimensions, PageFormat, ZoomMode, CustomPageDimensions } from './types/cv'
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
import { CVHistoryTab } from './components/History/CVHistoryTab'
import { CanvasElementsPalette } from './components/CanvasBuilder/CanvasElementsPalette'
import { CVStoreModal } from './components/StoreModal/CVStoreModal'
import { GenerateCoverLetterModal } from './components/Modals/GenerateCoverLetterModal'
import { AgentAndAcademyLandingPage, LandingTabType } from './components/Landing/AgentAndAcademyLandingPage'
import { downloadCVZipPackage } from './services/standaloneHtmlService'
import { CVPrintEngine } from './services/CVPrintEngine'
import { PageFormatEngine } from './engine/PageFormatEngine'
import { calculateAtsReport } from './engine/AtsEngine'

// Pro Layout Architecture Components
import { AppHeaderPro } from './components/ProLayout/AppHeaderPro'
import { ResizableSplitter } from './components/ProLayout/ResizableSplitter'
import { RightInspectorDrawer, type InspectorTab } from './components/ProLayout/RightInspectorDrawer'
import { YamlCodeEditorPro } from './components/Editor/YamlCodeEditorPro'
import { CanvasControlDock } from './components/Toolbar/CanvasControlDock'
import {
  SparklesIcon,
  CodeIcon,
  HistoryIcon,
  PaletteIcon
} from './components/Icons/ProIcons'

import './styles/cv-themes.css'
import './styles/cv-print.css'
import './styles/cv-viewer.css'
import './styles/cv-canvas-builder.css'
import './styles/chat-interface.css'
import './styles/cv-history.css'
import './styles/cv-prompts-modal.css'
import './styles/cv-maker.css'
import './styles/cv-pro-design-system.css'

const STORAGE_DRAFT_KEY = 'cv_maker_active_yaml_draft_v1'
const STORAGE_THEME_KEY = 'cv_maker_theme_v1'
const STORAGE_LAYOUT_KEY = 'cv_maker_layout_v1'
const STORAGE_VIEW_MODE_KEY = 'cv_maker_view_mode_v1'
const STORAGE_STRUCTURES_KEY = 'cv_maker_layout_structures_v1'
const STORAGE_PAGE_FORMAT_KEY = 'cv_maker_page_format_v1'
const STORAGE_ZOOM_MODE_KEY = 'cv_maker_zoom_mode_v1'
const STORAGE_ATS_JD_KEY = 'cv_ats_jd_text'
const STORAGE_ATS_HEATMAP_KEY = 'cv_ats_heatmap_active'

export const CVMakerApp: React.FC = () => {
  // Navigation & Workspace State
  const [activeTab, setActiveTab] = useState<'chat' | 'editor' | 'history' | 'canvas'>('editor')
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false)

  // Pro Inspector Drawer & Flexible Splitter State
  const [leftDockWidth, setLeftDockWidth] = useState<number>(() => {
    const saved = localStorage.getItem('cv_maker_left_dock_width_px')
    return saved ? Math.max(320, Math.min(1100, parseInt(saved, 10))) : 480
  })
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('templates')

  const handleOpenInspector = (tab: InspectorTab = 'templates') => {
    setInspectorTab(tab)
    setIsInspectorOpen(true)
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
  const [customPageDimensions, setCustomPageDimensions] = useState<CustomPageDimensions | undefined>(() => {
    try {
      const saved = localStorage.getItem('cv_maker_custom_dimensions')
      return saved ? JSON.parse(saved) : undefined
    } catch {
      return undefined
    }
  })
  const [activeZoomMode, setActiveZoomMode] = useState<ZoomMode>(() => {
    const saved = localStorage.getItem(STORAGE_ZOOM_MODE_KEY)
    if (!saved) return 'auto'
    if (saved === 'auto' || saved === '100' || saved === 'fit-width') return saved as ZoomMode
    const num = parseFloat(saved)
    return isNaN(num) ? 'auto' : num
  })
  const [currentScale, setCurrentScale] = useState<number>(1.0)

  const handlePageFormatChange = (format: PageFormat, customDims?: CustomPageDimensions) => {
    setActivePageFormat(format)
    if (customDims) {
      setCustomPageDimensions(customDims)
      localStorage.setItem('cv_maker_custom_dimensions', JSON.stringify(customDims))
    }
    localStorage.setItem(STORAGE_PAGE_FORMAT_KEY, format)
    PageFormatEngine.applyFormat(format, document.documentElement, customDims || customPageDimensions)
  }

  const handleCustomPageDimensionsChange = (dims: CustomPageDimensions) => {
    setCustomPageDimensions(dims)
    localStorage.setItem('cv_maker_custom_dimensions', JSON.stringify(dims))
    if (activePageFormat === 'custom') {
      PageFormatEngine.applyFormat('custom', document.documentElement, dims)
    }
  }

  const handleZoomModeChange = (zoom: ZoomMode | number) => {
    setActiveZoomMode(zoom)
    localStorage.setItem(STORAGE_ZOOM_MODE_KEY, String(zoom))
  }

  useEffect(() => {
    PageFormatEngine.applyFormat(activePageFormat, document.documentElement, customPageDimensions)
  }, [activePageFormat, customPageDimensions])

  // Pre-warm silencioso dos workers Playwright em background (evita cold start de 60s no Render)
  useEffect(() => {
    CVPrintEngine.prewarmWorkers()
  }, [])

  // Headless PDF Generation State
  const [isGeneratingDirectPdf, setIsGeneratingDirectPdf] = useState<boolean>(false)
  const [directPdfStatus, setDirectPdfStatus] = useState<string>('')

  // ATS State, Job Description & Heatmap
  const [isAtsHeatmapActive, setIsAtsHeatmapActive] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_ATS_HEATMAP_KEY) === 'true'
  })
  const [jdText, setJdText] = useState<string>(() => {
    return localStorage.getItem(STORAGE_ATS_JD_KEY) || ''
  })

  const handleJdTextChange = (text: string) => {
    setJdText(text)
    localStorage.setItem(STORAGE_ATS_JD_KEY, text)
  }

  const handleToggleAtsHeatmap = () => {
    const next = !isAtsHeatmapActive
    setIsAtsHeatmapActive(next)
    localStorage.setItem(STORAGE_ATS_HEATMAP_KEY, String(next))
    window.dispatchEvent(new CustomEvent('cv_ats_toggle'))
  }

  // Relatório de Auditoria ATS reativo em tempo real (< 5ms, 0 tokens)
  const atsReport = useMemo(() => {
    return calculateAtsReport(cvData, jdText)
  }, [cvData, jdText])

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

  const handleResetStructure = () => {
    setLayoutStructures(prev => {
      const updated = { ...prev }
      delete updated[activeLayout]
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

  const handleDesignConfigChange = (newConfig: CVDesignConfig) => {
    setDesignConfig(newConfig)
    localStorage.setItem(STORAGE_DESIGN_KEY, JSON.stringify(newConfig))
  }

  const [activeScreen, setActiveScreen] = useState<'editor' | 'landing_page'>('editor')
  const [landingInitialTab, setLandingInitialTab] = useState<LandingTabType>('academy')
  const [landingHubSubTab, setLandingHubSubTab] = useState<'agent_prompt' | 'master_synthesis' | 'prompts_library' | 'openapi_hub' | 'api_key'>('agent_prompt')
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false)
  const [isCoverLetterModalOpen, setIsCoverLetterModalOpen] = useState<boolean>(false)
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

  // Exportação Direta de PDF via Playwright Chromium Headless (Eixo 1)
  const handleDownloadDirectPdf = async () => {
    if (isGeneratingDirectPdf) {
      // Aborta a requisição estagnada anterior para liberar e reconectar imediatamente
      CVPrintEngine.abortActive()
      await new Promise((r) => setTimeout(r, 60))
    }
    setIsGeneratingDirectPdf(true)
    setDirectPdfStatus('Conectando ao worker Playwright...')
    try {
      PageFormatEngine.applyFormat(activePageFormat, document.documentElement, customPageDimensions)
      if (designConfig?.backgroundPattern && designConfig.backgroundPattern !== 'none') {
        document.documentElement.style.setProperty('--cv-bg-image', `url("${designConfig.backgroundPattern}")`)
      } else {
        document.documentElement.style.setProperty('--cv-bg-image', 'none')
      }
      if (designConfig?.colorBg) {
        document.documentElement.style.setProperty('--cv-color-bg', designConfig.colorBg)
      }

      await CVPrintEngine.downloadDirectHeadlessPdf({
        candidateName: cvData?.basics?.name,
        candidateLabel: cvData?.basics?.label,
        viewMode: activeViewMode,
        sourceElement: document.getElementById('cv-printable-document'),
        pageFormat: activePageFormat,
        customWidthMm: customPageDimensions?.widthMm,
        customHeightMm: customPageDimensions?.heightMm,
        backgroundPattern: designConfig?.backgroundPattern,
        colorBg: designConfig?.colorBg,
        onProgress: (statusText) => {
          setDirectPdfStatus(statusText)
        }
      })
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('abort') || err?.message?.includes('cancelad')) {
        console.log('[CVMakerApp] Requisição Playwright reiniciada ou cancelada pelo usuário.')
        return
      }
      console.error('[CVMakerApp] Falha na compilação direta via Playwright:', err)
      const shouldFallback = window.confirm(
        'Não foi possível conectar ao worker Playwright no backend.\n\n' +
        'Deseja abrir a caixa de diálogo nativa de impressão (Salvar como PDF no navegador)?'
      )
      if (shouldFallback) {
        handlePrintPdf()
      }
    } finally {
      setIsGeneratingDirectPdf(false)
      setDirectPdfStatus('')
    }
  }

  const handleCancelDirectPdf = () => {
    CVPrintEngine.abortActive()
    setIsGeneratingDirectPdf(false)
    setDirectPdfStatus('')
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

      {/* ── Editor Principal Pro (Preservado para zero perda de estado) ── */}
      <div
        className="cv-maker-app"
        style={{
          display: activeScreen === 'editor' ? 'flex' : 'none',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden'
        }}
      >
        {/* ── App Top Header Executivo Pro ── */}
        <AppHeaderPro
          documentTitle={
            cvData?.basics?.name
              ? `${cvData.basics.name} — ${cvData.basics.label || 'Currículo'}`
              : 'Currículo Profissional'
          }
          activeViewMode={activeViewMode}
          onViewModeChange={handleViewModeChange}
          onOpenInspector={handleOpenInspector}
          isInspectorOpen={isInspectorOpen}
          atsScore={atsReport.overallScore}
          onOpenApiKeyModal={() => handleOpenLandingPage('hub', 'agent_prompt')}
          hasActiveKey={hasActiveKey}
          onDownloadYaml={handleDownloadYaml}
          onDownloadZip={handleDownloadZip}
          onPrintPdf={handlePrintPdf}
          onDownloadDirectPdf={handleDownloadDirectPdf}
          isGeneratingPdf={isGeneratingDirectPdf}
          pdfProgressStatus={directPdfStatus}
          isSaved={!saveHistoryFeedback}
          onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)}
          onCancelDirectPdf={handleCancelDirectPdf}
        />

        {/* ── Workspace Flexível com Splitter Arrastável ── */}
        <div className={`cv-pro-workspace-container ${isMobileDrawerOpen ? 'cv-mobile-drawer-open' : ''}`}>
          {/* Backdrop para mobile drawer */}
          <div
            className="cv-mobile-drawer-backdrop"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Left Dock: Editor / IA / Histórico / Elementos */}
          <aside
            className="cv-pro-left-dock cv-no-print"
            style={{ width: `${leftDockWidth}px` }}
            aria-label="Painel de Edição e Código"
          >
            {/* Abas da Doca Esquerda com Ícones SVG Monolineares */}
            <div className="cv-sidebar-tabs">
              <button
                className={`cv-sidebar-tab ${activeTab === 'editor' ? 'cv-sidebar-tab--active' : ''}`}
                onClick={() => setActiveTab('editor')}
                title="Editor YAML Estruturado"
              >
                <CodeIcon size={14} />
                <span className="cv-sidebar-tab-text">Editor YAML</span>
              </button>
              <button
                className={`cv-sidebar-tab ${activeTab === 'chat' ? 'cv-sidebar-tab--active' : ''}`}
                onClick={() => setActiveTab('chat')}
                title="Assistente IA"
              >
                <SparklesIcon size={14} />
                <span className="cv-sidebar-tab-text">Assistente IA</span>
              </button>
              <button
                className={`cv-sidebar-tab ${activeTab === 'history' ? 'cv-sidebar-tab--active' : ''}`}
                onClick={() => {
                  refreshHistory()
                  setActiveTab('history')
                }}
                title="Histórico de Versões"
              >
                <HistoryIcon size={14} />
                <span className="cv-sidebar-tab-text">Histórico ({historyList.length})</span>
              </button>
              <button
                className={`cv-sidebar-tab ${activeTab === 'canvas' ? 'cv-sidebar-tab--active' : ''}`}
                onClick={() => setActiveTab('canvas')}
                title="Paleta de Elementos Livres"
              >
                <PaletteIcon size={14} />
                <span className="cv-sidebar-tab-text">Elementos</span>
              </button>
            </div>

            {/* Conteúdo da Doca */}
            <div className="cv-sidebar-content" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {activeTab === 'editor' && (
                <YamlCodeEditorPro
                  value={yamlInput}
                  onChange={handleEditorChange}
                  parseError={parseError}
                  onSave={handleManualSaveHistory}
                  isSavedFeedback={saveHistoryFeedback}
                />
              )}

              {activeTab === 'chat' && (
                <div style={{ height: '100%', overflowY: 'auto', padding: '1.25rem' }}>
                  <ChatInterface
                    onCVGenerated={handleCVGenerated}
                    hasGeneratedCVs={cvVersions !== null}
                    onReset={handleReset}
                    onOpenStoreModal={() => setIsStoreModalOpen(true)}
                  />
                </div>
              )}

              {activeTab === 'history' && (
                <div style={{ height: '100%', overflowY: 'auto', padding: '1.25rem' }}>
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
                </div>
              )}

              {activeTab === 'canvas' && (
                <div style={{ height: '100%', overflowY: 'auto', padding: '1.25rem' }}>
                  <CanvasElementsPalette
                    data={cvData}
                    structureConfig={currentStructureConfig}
                    onUpdateStructureConfig={handleUpdateStructureConfig}
                    onResetStructure={handleResetStructure}
                    onAutoPackBlocks={handleAutoPackBlocks}
                    onUpdatePhoto={handleSavePhoto}
                  />
                </div>
              )}
            </div>
          </aside>

          {/* Divisor Arrastável Interativo (Splitter) */}
          <ResizableSplitter
            onResize={(newWidth) => {
              setLeftDockWidth(newWidth)
              localStorage.setItem('cv_maker_left_dock_width_px', String(newWidth))
            }}
            onReset={() => {
              const defaultWidth = Math.round(window.innerWidth * 0.45)
              setLeftDockWidth(defaultWidth)
              localStorage.setItem('cv_maker_left_dock_width_px', String(defaultWidth))
            }}
            minWidth={320}
            maxWidth={1100}
          />

          {/* Área Central: Mesa de Trabalho com Sombra de Estúdio e Folha A4 */}
          <main
            className="cv-pro-canvas-area"
            aria-label="Visualização do Currículo"
            style={{
              backgroundColor: designConfig.colorWorkspaceBg || '#080c14'
            }}
          >
            {/* Visualizador da Folha com Sombra Arquitetônica */}
            <div className="cv-pro-paper-wrapper">
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
                customPageDimensions={customPageDimensions}
                zoomMode={activeZoomMode}
                onScaleChange={setCurrentScale}
              />
            </div>

            {/* Barra Flutuante de Controle do Canvas */}
            <CanvasControlDock
              activeZoomMode={activeZoomMode}
              onZoomModeChange={handleZoomModeChange}
              currentScale={currentScale}
              onAutoFitSinglePage={handleAutoFitSinglePage}
              onAutoPackBlocks={handleAutoPackBlocks}
              isFreeCanvasActive={currentStructureConfig.isFreeCanvasActive}
              onToggleFreeCanvas={handleToggleFreeCanvas}
              onResetModel={handleReset}
            />
          </main>

          {/* Inspetor Lateral Deslizante à Direita (Figma Style) */}
          <RightInspectorDrawer
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            activeLayout={activeLayout}
            onLayoutChange={handleLayoutChange}
            designConfig={designConfig}
            onChangeDesignConfig={handleDesignConfigChange}
            cvData={cvData}
            jdText={jdText}
            onJdTextChange={handleJdTextChange}
            isVisualHeatmapActive={isAtsHeatmapActive}
            onToggleVisualHeatmap={handleToggleAtsHeatmap}
            activePageFormat={activePageFormat}
            customPageDimensions={customPageDimensions}
            onPageFormatChange={handlePageFormatChange}
            onCustomPageDimensionsChange={handleCustomPageDimensionsChange}
            onOpenFullscreenGallery={() => handleOpenLandingPage('gallery')}
            isFreeCanvasActive={currentStructureConfig.isFreeCanvasActive}
            onToggleFreeCanvas={handleToggleFreeCanvas}
          />
        </div>

        {/* ── Modais de Pagamento e Geração IA ── */}
        <CVStoreModal
          isOpen={isStoreModalOpen}
          onClose={() => setIsStoreModalOpen(false)}
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
