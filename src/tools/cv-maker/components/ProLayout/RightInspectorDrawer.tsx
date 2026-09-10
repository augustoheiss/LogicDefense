import React, { useState, useRef, useMemo } from 'react'
import type { LayoutVariant, CVDesignConfig, SectionStyleOverride, PageFormat, CustomPageDimensions, CVData } from '../../types/cv'
import { LAYOUT_OPTIONS, DEFAULT_DESIGN_CONFIG } from '../../types/cv'
import { PAGE_FORMATS } from '../../engine/PageFormatEngine'
import { calculateAtsReport } from '../../engine/AtsEngine'
import { BACKGROUND_CATALOG, BACKGROUND_CATEGORIES } from '../../engine/backgroundCatalog'
import { compressImageFile } from '../../utils/imageCompressor'
import { deriveHarmoniousSecondary } from '../../utils/colorUtils'
import { UNIVERSAL_BLUEPRINTS, type DocumentBlueprint } from '../../templates/universalBlueprints'
import { ARCHETYPE_DEFINITIONS } from '../../types/universalAST'
import {
  CloseIcon,
  LayoutIcon,
  PaletteIcon,
  TargetIcon,
  CheckIcon,
  FileTextIcon,
  SlidersIcon,
  LayersIcon,
  SparklesIcon,
  UploadIcon,
  TrashIcon,
  RotateCcwIcon,
  TypeIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  ZapIcon,
  RocketIcon,
  GlobeIcon,
  AwardIcon,
  BookmarkIcon,
  MailIcon
} from '../Icons/ProIcons'

export type InspectorTab = 'templates' | 'design' | 'ats' | 'format'

interface RightInspectorDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeTab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  activeLayout: LayoutVariant
  onLayoutChange: (layout: LayoutVariant) => void
  designConfig: CVDesignConfig
  onChangeDesignConfig: (newConfig: CVDesignConfig) => void
  cvData: CVData | null
  jdText: string
  onJdTextChange: (text: string) => void
  isVisualHeatmapActive: boolean
  onToggleVisualHeatmap: () => void
  activePageFormat: PageFormat
  customPageDimensions?: CustomPageDimensions
  onPageFormatChange: (format: PageFormat, customDims?: CustomPageDimensions) => void
  onCustomPageDimensionsChange?: (dims: CustomPageDimensions) => void
  onOpenFullscreenGallery?: () => void
  isFreeCanvasActive?: boolean
  onToggleFreeCanvas?: () => void
  onSelectBlueprint?: (blueprint: DocumentBlueprint) => void
}

// Miniaturas em SVG com esqueleto arquitetônico dos layouts
const LayoutSkeletonPreview: React.FC<{ layoutId: string }> = ({ layoutId }) => {
  switch (layoutId) {
    case 'sidebar':
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="4" y="4" width="30" height="62" rx="2" fill="#1e293b" />
          <circle cx="19" cy="14" r="5" fill="#38bdf8" opacity="0.6" />
          <rect x="8" y="24" width="22" height="3" rx="1.5" fill="#64748b" />
          <rect x="8" y="30" width="16" height="2" rx="1" fill="#475569" />
          <rect x="8" y="35" width="20" height="2" rx="1" fill="#475569" />
          <rect x="38" y="6" width="40" height="5" rx="2" fill="#38bdf8" />
          <rect x="38" y="14" width="56" height="2" rx="1" fill="#64748b" />
          <rect x="38" y="22" width="56" height="12" rx="2" fill="#1e293b" />
          <rect x="38" y="38" width="56" height="12" rx="2" fill="#1e293b" />
          <rect x="38" y="54" width="56" height="10" rx="2" fill="#1e293b" />
        </svg>
      )
    case 'linear':
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="25" y="6" width="50" height="5" rx="2" fill="#38bdf8" />
          <rect x="20" y="14" width="60" height="2" rx="1" fill="#64748b" />
          <line x1="8" y1="20" x2="92" y2="20" stroke="#334155" strokeWidth="1" />
          <rect x="8" y="24" width="84" height="12" rx="2" fill="#1e293b" />
          <rect x="8" y="39" width="84" height="12" rx="2" fill="#1e293b" />
          <rect x="8" y="54" width="84" height="10" rx="2" fill="#1e293b" />
        </svg>
      )
    case 'compact_split':
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="6" y="6" width="88" height="10" rx="2" fill="#1e293b" />
          <rect x="6" y="20" width="42" height="44" rx="2" fill="#1e293b" />
          <rect x="52" y="20" width="42" height="44" rx="2" fill="#1e293b" />
        </svg>
      )
    case 'canvas_livre':
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="6" y="6" width="46" height="18" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />
          <rect x="56" y="6" width="38" height="28" rx="2" fill="#1e293b" />
          <rect x="6" y="28" width="46" height="36" rx="2" fill="#1e293b" />
          <rect x="56" y="38" width="38" height="26" rx="2" fill="#1e293b" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      )
    default:
      // Modular / Executivo padrão
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="6" y="6" width="88" height="14" rx="2" fill="#1e293b" />
          <circle cx="15" cy="13" r="4" fill="#38bdf8" opacity="0.7" />
          <rect x="23" y="10" width="40" height="3" rx="1.5" fill="#38bdf8" />
          <rect x="23" y="14" width="25" height="2" rx="1" fill="#64748b" />
          <rect x="6" y="24" width="56" height="20" rx="2" fill="#1e293b" />
          <rect x="66" y="24" width="28" height="20" rx="2" fill="#1e293b" />
          <rect x="6" y="48" width="88" height="16" rx="2" fill="#1e293b" />
        </svg>
      )
  }
}

interface SectionMeta {
  id: string
  name: string
  icon: React.FC<{ size?: number | string; strokeWidth?: number; className?: string; style?: React.CSSProperties }>
  description: string
}

const SECTIONS_LIST: SectionMeta[] = [
  { id: 'sidebar', name: 'Lateral / Sidebar', icon: LayersIcon, description: 'Coluna lateral com contraste' },
  { id: 'header', name: 'Cabeçalho / Header', icon: TypeIcon, description: 'Nome, cargo, contatos e topo' },
  { id: 'work', name: 'Experiência Profissional', icon: BriefcaseIcon, description: 'Cards e listas de experiências' },
  { id: 'education', name: 'Formação Acadêmica', icon: GraduationCapIcon, description: 'Faculdades, cursos e graduação' },
  { id: 'skills', name: 'Competências / Skills', icon: ZapIcon, description: 'Badges, tags e barras de nível' },
  { id: 'projects', name: 'Projetos Relevantes', icon: RocketIcon, description: 'Cards e links de projetos' },
  { id: 'languages', name: 'Idiomas & Fluência', icon: GlobeIcon, description: 'Cards de línguas e níveis' },
  { id: 'certificates', name: 'Certificações', icon: AwardIcon, description: 'Licenças e certificados' },
  { id: 'interests', name: 'Interesses & Hobbies', icon: BookmarkIcon, description: 'Hobbies e interesses' },
  { id: 'cover_letter', name: 'Carta de Apresentação', icon: MailIcon, description: 'Corpo e assinatura da Cover Letter' }
]

const FONT_PRESETS = [
  {
    id: 'tech_modern',
    label: 'Tech & Modern',
    heading: 'Plus Jakarta Sans',
    body: 'Inter',
    description: 'Silicon Valley, ATS-Friendly & Clean'
  },
  {
    id: 'executive_editorial',
    label: 'Executive Luxury',
    heading: 'Cinzel',
    body: 'Roboto',
    description: 'C-Level, Jurídico & Finanças'
  },
  {
    id: 'hacker_engineering',
    label: 'Hacker & Terminal',
    heading: 'Courier Prime',
    body: 'Courier Prime',
    description: 'Cybersecurity, DevOps & Infra'
  },
  {
    id: 'creative_design',
    label: 'Creative & Product',
    heading: 'Poppins',
    body: 'Plus Jakarta Sans',
    description: 'UX/UI, Design & Growth'
  },
  {
    id: 'humanist_academic',
    label: 'Humanist & Academic',
    heading: 'Lora',
    body: 'Open Sans',
    description: 'Medicina, Pesquisa & Letras'
  },
  {
    id: 'classic_editorial',
    label: 'Classic Editorial',
    heading: 'Merriweather',
    body: 'Inter',
    description: 'Imprensa & Gestão Tradicional'
  }
]

const COLOR_PRESETS = [
  {
    name: 'IBM Blue Executive',
    primary: '#0284c7',
    secondary: '#0369a1',
    accent: '#f97316',
    surface: '#f8fafc',
    bg: '#ffffff',
    text: '#0f172a'
  },
  {
    name: 'Emerald Matrix',
    primary: '#059669',
    secondary: '#047857',
    accent: '#10b981',
    surface: '#f0fdf4',
    bg: '#ffffff',
    text: '#064e3b'
  },
  {
    name: 'Cyber Violet',
    primary: '#7c3aed',
    secondary: '#6d28d9',
    accent: '#ec4899',
    surface: '#faf5ff',
    bg: '#ffffff',
    text: '#1e1b4b'
  },
  {
    name: 'Obsidian Gold',
    primary: '#b45309',
    secondary: '#92400e',
    accent: '#f59e0b',
    surface: '#fffbeb',
    bg: '#ffffff',
    text: '#1c1917'
  },
  {
    name: 'Slate Minimalist',
    primary: '#334155',
    secondary: '#475569',
    accent: '#0284c7',
    surface: '#f1f5f9',
    bg: '#ffffff',
    text: '#0f172a'
  },
  {
    name: 'Burgundy Prestige',
    primary: '#9f1239',
    secondary: '#881337',
    accent: '#e11d48',
    surface: '#fff1f2',
    bg: '#ffffff',
    text: '#1c1917'
  },
  {
    name: 'Crimson Executive',
    primary: '#dc2626',
    secondary: '#991b1b',
    accent: '#f97316',
    surface: '#fef2f2',
    bg: '#ffffff',
    text: '#1c1917'
  },
  {
    name: 'Deep Indigo Modern',
    primary: '#4f46e5',
    secondary: '#3730a3',
    accent: '#06b6d4',
    surface: '#eef2ff',
    bg: '#ffffff',
    text: '#0f172a'
  }
]

export const RightInspectorDrawer: React.FC<RightInspectorDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  activeLayout,
  onLayoutChange,
  designConfig,
  onChangeDesignConfig,
  cvData,
  jdText,
  onJdTextChange,
  isVisualHeatmapActive,
  onToggleVisualHeatmap,
  activePageFormat,
  customPageDimensions,
  onPageFormatChange,
  onCustomPageDimensionsChange,
  onOpenFullscreenGallery,
  isFreeCanvasActive = false,
  onToggleFreeCanvas,
  onSelectBlueprint
}) => {
  const [designSubTab, setDesignSubTab] = useState<'general' | 'textures' | 'sections'>('general')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('sidebar')
  const [selectedBgCategory, setSelectedBgCategory] = useState<string>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sectionFileInputRef = useRef<HTMLInputElement>(null)

  const atsReport = calculateAtsReport(cvData, jdText)
  const scoreColor = atsReport.overallScore >= 80 ? '#22c55e' : atsReport.overallScore >= 60 ? '#eab308' : '#ef4444'

  const handleUploadCustomBg = async (e: React.ChangeEvent<HTMLInputElement>, secId?: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await compressImageFile(file, { maxWidth: 1600, maxHeight: 1200, quality: 0.82 })
      if (secId) {
        handleUpdateSectionOverride(secId, 'bgImage', base64)
      } else {
        onChangeDesignConfig({ ...designConfig, backgroundPattern: base64 })
      }
    } catch (err) {
      console.error('Falha ao processar imagem de fundo:', err)
      alert('Não foi possível processar a imagem. Escolha outro arquivo.')
    }
  }

  const handleUpdateSectionOverride = (secId: string, field: keyof SectionStyleOverride, value: string) => {
    const currentOverrides = designConfig.sectionOverrides || {}
    const currentSec = currentOverrides[secId] || {}
    onChangeDesignConfig({
      ...designConfig,
      sectionOverrides: {
        ...currentOverrides,
        [secId]: {
          ...currentSec,
          [field]: value
        }
      }
    })
  }

  const handleResetSectionOverride = (secId: string) => {
    const currentOverrides = { ...(designConfig.sectionOverrides || {}) }
    delete currentOverrides[secId]
    onChangeDesignConfig({
      ...designConfig,
      sectionOverrides: currentOverrides
    })
  }

  const handleResetAllDesign = () => {
    onChangeDesignConfig(DEFAULT_DESIGN_CONFIG)
  }

  const dynamicSectionsList: SectionMeta[] = useMemo(() => {
    const isUniversal = Boolean(cvData?.meta?.isUniversalDocument)
    const blocks = cvData?.meta?.universalAST?.blocks || []

    if (isUniversal && blocks.length > 0) {
      const list: SectionMeta[] = [
        { id: 'header', name: 'Cabeçalho / Header', icon: TypeIcon, description: 'Título, autor, contatos e topo' }
      ]
      for (const b of blocks) {
        const arch = b.classification?.effective || 'card_grid'
        let SecIcon = LayersIcon
        if (arch === 'timeline') SecIcon = BriefcaseIcon
        else if (arch === 'badge_list') SecIcon = ZapIcon
        else if (arch === 'key_value_table') SecIcon = SlidersIcon
        else if (arch === 'prose_flow') SecIcon = FileTextIcon
        else if (arch === 'card_grid') SecIcon = RocketIcon

        const archDef = ARCHETYPE_DEFINITIONS[arch]
        list.push({
          id: b.key,
          name: b.title || b.key,
          icon: SecIcon,
          description: `${archDef?.label || 'Seção Universal'} • /${b.key} (${b.items?.length || 0} itens)`
        })
      }
      return list
    }

    return SECTIONS_LIST
  }, [cvData])

  const effectiveSectionId = dynamicSectionsList.some(s => s.id === selectedSectionId)
    ? selectedSectionId
    : (dynamicSectionsList[0]?.id || 'header')

  const activeOverridesCount = Object.keys(designConfig.sectionOverrides || {}).length
  const currentSectionMeta = dynamicSectionsList.find(s => s.id === effectiveSectionId) || dynamicSectionsList[0]
  const currentSectionOverride = designConfig.sectionOverrides?.[effectiveSectionId] || {}
  const CurrentSectionIcon = currentSectionMeta.icon

  if (!isOpen) return null

  return (
    <aside className="cv-pro-inspector cv-no-print" aria-label="Inspetor de Propriedades">
      {/* Cabeçalho do Inspetor */}
      <div className="cv-pro-inspector__header">
        <div className="cv-pro-inspector__title">
          <SlidersIcon size={16} />
          <span>Inspetor de Propriedades</span>
        </div>
        <button
          className="cv-pro-btn"
          onClick={onClose}
          style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
          title="Fechar Inspetor (Esc)"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      {/* Navegação por Abas do Inspetor */}
      <div className="cv-pro-inspector__tabs">
        <button
          className={`cv-pro-inspector__tab ${activeTab === 'templates' ? 'is-active' : ''}`}
          onClick={() => onTabChange('templates')}
        >
          <LayoutIcon size={14} />
          <span>Modelos</span>
        </button>
        <button
          className={`cv-pro-inspector__tab ${activeTab === 'design' ? 'is-active' : ''}`}
          onClick={() => onTabChange('design')}
        >
          <PaletteIcon size={14} />
          <span>Estilo</span>
        </button>
        <button
          className={`cv-pro-inspector__tab ${activeTab === 'ats' ? 'is-active' : ''}`}
          onClick={() => onTabChange('ats')}
        >
          <TargetIcon size={14} />
          <span>ATS ({atsReport.overallScore}%)</span>
        </button>
        <button
          className={`cv-pro-inspector__tab ${activeTab === 'format' ? 'is-active' : ''}`}
          onClick={() => onTabChange('format')}
        >
          <FileTextIcon size={14} />
          <span>Papel</span>
        </button>
      </div>

      {/* Conteúdo Dinâmico por Aba */}
      <div className="cv-pro-inspector__content">
        {/* ── ABA 1: MODELOS & TEMPLATES ── */}
        {activeTab === 'templates' && (
          <div>
            {/* ── Seletor de Blueprints de Documentos Universais ── */}
            <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                  Blueprints & Documentos
                </span>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  Compilador Universal
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {UNIVERSAL_BLUEPRINTS.map(bp => (
                  <button
                    key={bp.id}
                    type="button"
                    onClick={() => onSelectBlueprint && onSelectBlueprint(bp)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.7rem',
                      borderRadius: '6px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{bp.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f1f5f9', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {bp.title}
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#94a3b8', lineHeight: 1.25 }}>
                          {bp.description}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.45rem',
                        borderRadius: '4px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      Carregar
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                10 Modelos A4 Declarativos
              </span>
              {onOpenFullscreenGallery && (
                <button
                  type="button"
                  className="cv-pro-btn"
                  onClick={onOpenFullscreenGallery}
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                >
                  Tela Cheia
                </button>
              )}
            </div>

            {/* ── Switch Executivo: Ativar/Desativar Modo Canvas Livre ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.75rem',
                borderRadius: '8px',
                background: isFreeCanvasActive ? 'rgba(56, 189, 248, 0.1)' : 'rgba(30, 41, 59, 0.35)',
                border: isFreeCanvasActive ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(51, 65, 85, 0.3)',
                marginBottom: '1rem',
                gap: '0.6rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: isFreeCanvasActive ? 'var(--cv-pro-sky)' : '#1e293b',
                    color: isFreeCanvasActive ? '#090d16' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <LayersIcon size={14} />
                </div>
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: isFreeCanvasActive ? '#38bdf8' : '#e2e8f0' }}>
                    Modo Canvas Livre
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.2 }}>
                    {isFreeCanvasActive ? 'Blocos soltos arrastáveis por mouse' : 'Layout estático em grid padrão'}
                  </div>
                </div>
              </div>

              {onToggleFreeCanvas && (
                <button
                  type="button"
                  className={`cv-pro-btn ${isFreeCanvasActive ? 'cv-pro-btn--hero' : ''}`}
                  onClick={onToggleFreeCanvas}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    minWidth: '65px',
                    justifyContent: 'center'
                  }}
                >
                  {isFreeCanvasActive ? 'Ativo ✓' : 'Ativar'}
                </button>
              )}
            </div>

            <div className="cv-pro-template-grid">
              {LAYOUT_OPTIONS.map((layout) => {
                const isSelected = activeLayout === layout.id
                return (
                  <div
                    key={layout.id}
                    className={`cv-pro-template-card ${isSelected ? 'is-active' : ''}`}
                    onClick={() => onLayoutChange(layout.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div style={{ width: '100%', height: '70px', borderRadius: '4px', overflow: 'hidden' }}>
                      <LayoutSkeletonPreview layoutId={layout.id} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="cv-pro-template-card__name">{layout.name}</span>
                        {isSelected && <CheckIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />}
                      </div>
                      <div className="cv-pro-template-card__desc">
                        {layout.description}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ABA 2: DESIGN & ESTILO (ESTÚDIO INTEGRADO) ── */}
        {activeTab === 'design' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* ── Segmented Control: Sub-abas de Design ── */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(15, 23, 42, 0.7)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid rgba(51, 65, 85, 0.4)',
                gap: '3px'
              }}
            >
              <button
                type="button"
                onClick={() => setDesignSubTab('general')}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.35rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  background: designSubTab === 'general' ? 'var(--cv-pro-sky)' : 'transparent',
                  color: designSubTab === 'general' ? '#090d16' : '#94a3b8',
                  border: 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <SlidersIcon size={13} />
                <span>Geral</span>
              </button>

              <button
                type="button"
                onClick={() => setDesignSubTab('textures')}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.35rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  background: designSubTab === 'textures' ? 'var(--cv-pro-sky)' : 'transparent',
                  color: designSubTab === 'textures' ? '#090d16' : '#94a3b8',
                  border: 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <SparklesIcon size={13} />
                <span>Texturas IA</span>
              </button>

              <button
                type="button"
                onClick={() => setDesignSubTab('sections')}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.35rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  background: designSubTab === 'sections' ? 'var(--cv-pro-sky)' : 'transparent',
                  color: designSubTab === 'sections' ? '#090d16' : '#94a3b8',
                  border: 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <LayersIcon size={13} />
                <span>Por Setor</span>
                {activeOverridesCount > 0 && (
                  <span
                    style={{
                      background: designSubTab === 'sections' ? '#090d16' : '#10b981',
                      color: designSubTab === 'sections' ? 'var(--cv-pro-sky)' : '#064e3b',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: '10px'
                    }}
                  >
                    {activeOverridesCount}
                  </span>
                )}
              </button>
            </div>

            {/* ──── SUB-ABA A: GERAL (TIPOGRAFIA, SLIDERS, PALETAS & CORES DETALHADAS) ──── */}
            {designSubTab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Escala Global de Texto */}
                <div style={{ background: '#090d16', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
                      Escala Global do Texto
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--cv-pro-sky)', fontWeight: 700 }}>
                      {Math.round((designConfig.fontScale || 1.0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.80"
                    max="1.30"
                    step="0.02"
                    value={designConfig.fontScale || 1.0}
                    onChange={(e) => {
                      onChangeDesignConfig({
                        ...designConfig,
                        fontScale: parseFloat(e.target.value)
                      })
                    }}
                    style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '0.25rem' }}>
                    <span>Compacto A4</span>
                    <span style={{ color: (designConfig.fontScale || 1.0) <= 0.90 ? '#38bdf8' : (designConfig.fontScale || 1.0) >= 1.10 ? '#f59e0b' : '#10b981' }}>
                      {(designConfig.fontScale || 1.0) <= 0.90 ? 'Mais Conteúdo' : (designConfig.fontScale || 1.0) >= 1.10 ? 'Confortável' : 'Equilibrado'}
                    </span>
                    <span>Amplo</span>
                  </div>
                </div>

                {/* Pareamento Tipográfico */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.45rem' }}>
                    Combinação Tipográfica Executiva
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {FONT_PRESETS.map((font) => {
                      const isFontActive = designConfig.fontHeading === font.heading && designConfig.fontBody === font.body
                      return (
                        <button
                          key={font.id}
                          type="button"
                          className="cv-pro-btn"
                          onClick={() => {
                            onChangeDesignConfig({
                              ...designConfig,
                              fontHeading: font.heading,
                              fontBody: font.body
                            })
                          }}
                          style={{
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            padding: '0.55rem 0.7rem',
                            background: isFontActive ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                            borderColor: isFontActive ? 'var(--cv-pro-sky)' : 'rgba(51, 65, 85, 0.4)',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: isFontActive ? 'var(--cv-pro-sky)' : '#f1f5f9' }}>
                              {font.label}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              {font.heading} + {font.body}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            {font.description}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Paletas de Cores Executivas */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.45rem' }}>
                    Paletas Cromáticas Pré-definidas
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {COLOR_PRESETS.map((color) => {
                      const isColorActive = designConfig.colorPrimary === color.primary
                      return (
                        <button
                          key={color.name}
                          type="button"
                          className="cv-pro-btn"
                          onClick={() => {
                            onChangeDesignConfig({
                              ...designConfig,
                              colorPrimary: color.primary,
                              colorSecondary: color.secondary,
                              colorAccent: color.accent,
                              colorSurface: color.surface,
                              colorBg: color.bg,
                              colorText: color.text,
                              colorSidebar: color.surface || '#f8fafc'
                            })
                          }}
                          style={{
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.7rem',
                            background: isColorActive ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                            borderColor: isColorActive ? 'var(--cv-pro-sky)' : 'rgba(51, 65, 85, 0.4)'
                          }}
                        >
                          <span style={{ fontSize: '0.76rem', fontWeight: isColorActive ? 700 : 500 }}>{color.name}</span>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: color.primary }} />
                            <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: color.secondary }} />
                            <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: color.accent }} />
                            <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: color.surface, border: '1px solid #475569' }} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Seletores Manuais de Cor Granulares */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.45rem' }}>
                    Cores Estruturais Detalhadas
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                    {/* Folha A4 */}
                    <div style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Folha A4:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={designConfig.colorBg || '#ffffff'}
                          onChange={(e) => onChangeDesignConfig({ ...designConfig, colorBg: e.target.value })}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{designConfig.colorBg || '#ffffff'}</span>
                      </div>
                    </div>

                    {/* Ambiente / Workspace */}
                    <div style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Fundo Ambiente:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={designConfig.colorWorkspaceBg || '#0b1120'}
                          onChange={(e) => onChangeDesignConfig({ ...designConfig, colorWorkspaceBg: e.target.value })}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{designConfig.colorWorkspaceBg || '#0b1120'}</span>
                      </div>
                    </div>

                    {/* Boxes / Cards */}
                    <div style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Boxes / Cards:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={designConfig.colorSurface || '#f8fafc'}
                          onChange={(e) => onChangeDesignConfig({ ...designConfig, colorSurface: e.target.value })}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{designConfig.colorSurface || '#f8fafc'}</span>
                      </div>
                    </div>

                    {/* Lateral / Sidebar */}
                    <div style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Sidebar / Lateral:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={designConfig.colorSidebar || '#f8fafc'}
                          onChange={(e) => onChangeDesignConfig({ ...designConfig, colorSidebar: e.target.value })}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{designConfig.colorSidebar || '#f8fafc'}</span>
                      </div>
                    </div>

                    {/* Primária / Títulos */}
                    <div style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Primária (Títulos):</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={designConfig.colorPrimary || '#0284c7'}
                          onChange={(e) => {
                            const newPrimary = e.target.value
                            const derivedSecondary = deriveHarmoniousSecondary(newPrimary)
                            onChangeDesignConfig({
                              ...designConfig,
                              colorPrimary: newPrimary,
                              colorSecondary: derivedSecondary
                            })
                          }}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{designConfig.colorPrimary || '#0284c7'}</span>
                      </div>
                    </div>

                    {/* Secundária */}
                    <div style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Secundária:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={designConfig.colorSecondary || '#0369a1'}
                          onChange={(e) => onChangeDesignConfig({ ...designConfig, colorSecondary: e.target.value })}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{designConfig.colorSecondary || '#0369a1'}</span>
                      </div>
                    </div>

                    {/* Acento / Badges */}
                    <div style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Acento / Badges:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={designConfig.colorAccent || '#f97316'}
                          onChange={(e) => onChangeDesignConfig({ ...designConfig, colorAccent: e.target.value })}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{designConfig.colorAccent || '#f97316'}</span>
                      </div>
                    </div>

                    {/* Texto Principal */}
                    <div style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Texto Principal:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={designConfig.colorText || '#0f172a'}
                          onChange={(e) => onChangeDesignConfig({ ...designConfig, colorText: e.target.value })}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{designConfig.colorText || '#0f172a'}</span>
                      </div>
                    </div>

                    {/* Bordas & Divisores */}
                    <div style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)', gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Bordas & Linhas Divisórias:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={designConfig.colorBorder || '#e2e8f0'}
                          onChange={(e) => onChangeDesignConfig({ ...designConfig, colorBorder: e.target.value })}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{designConfig.colorBorder || '#e2e8f0'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ──── SUB-ABA B: TEXTURAS IA (CATÁLOGO DE 44 TEXTURAS, UPLOAD & LIMPEZA) ──── */}
            {designSubTab === 'textures' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Ações de Topo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <SparklesIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
                      Texturas IA (44 Opções)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleUploadCustomBg(e)}
                    />
                    <button
                      type="button"
                      className="cv-pro-btn"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderColor: 'var(--cv-pro-sky)' }}
                    >
                      <UploadIcon size={12} />
                      <span>Enviar Própria</span>
                    </button>

                    {designConfig.backgroundPattern && designConfig.backgroundPattern !== 'none' && (
                      <button
                        type="button"
                        className="cv-pro-btn"
                        onClick={() => onChangeDesignConfig({ ...designConfig, backgroundPattern: 'none' })}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderColor: '#ef4444', color: '#f87171' }}
                      >
                        <TrashIcon size={12} />
                        <span>Limpar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filtro de Categorias de Fundo */}
                <div style={{ display: 'flex', gap: '0.3rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
                  {BACKGROUND_CATEGORIES.map((cat) => {
                    const isCatActive = selectedBgCategory === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedBgCategory(cat.id)}
                        style={{
                          background: isCatActive ? 'rgba(56, 189, 248, 0.2)' : '#090d16',
                          border: isCatActive ? '1px solid var(--cv-pro-sky)' : '1px solid rgba(51, 65, 85, 0.4)',
                          color: isCatActive ? 'var(--cv-pro-sky)' : '#94a3b8',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: isCatActive ? 700 : 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {cat.label}
                      </button>
                    )
                  })}
                </div>

                {/* Grid de Texturas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                  {BACKGROUND_CATALOG
                    .filter((bg) => selectedBgCategory === 'all' || bg.zone === selectedBgCategory || bg.id === 'none')
                    .map((bg) => {
                      const isActive = (designConfig.backgroundPattern || 'none') === bg.url
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => onChangeDesignConfig({ ...designConfig, backgroundPattern: bg.url })}
                          style={{
                            background: isActive ? 'rgba(56, 189, 248, 0.15)' : '#090d16',
                            border: isActive ? '1.5px solid var(--cv-pro-sky)' : '1px solid rgba(51, 65, 85, 0.4)',
                            borderRadius: '6px',
                            padding: '0.4rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.3rem',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: '48px',
                              borderRadius: '4px',
                              background: bg.url === 'none' ? '#ffffff' : `url(${bg.url}) center/cover no-repeat`,
                              backgroundColor: bg.previewColor,
                              border: '1px solid rgba(51, 65, 85, 0.5)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative'
                            }}
                          >
                            {bg.id === 'none' && (
                              <span style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 600 }}>Branco Puro</span>
                            )}
                            {bg.aspectRatio && bg.id !== 'none' && (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: '2px',
                                  right: '2px',
                                  fontSize: '0.55rem',
                                  background: 'rgba(0,0,0,0.75)',
                                  color: '#e2e8f0',
                                  padding: '1px 3px',
                                  borderRadius: '2px',
                                  fontWeight: 700
                                }}
                              >
                                {bg.aspectRatio}
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: isActive ? 'var(--cv-pro-sky)' : '#f1f5f9',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={bg.name}
                          >
                            {bg.name}
                          </span>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}

            {/* ──── SUB-ABA C: POR SETOR (CUSTOMIZAÇÃO GRANULAR DOS 10 BLOCOS) ──── */}
            {designSubTab === 'sections' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Seletor Dropdown */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.35rem' }}>
                    Selecione o Setor do Currículo:
                  </label>
                  <select
                    value={effectiveSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#090d16',
                      color: '#f8fafc',
                      border: '1px solid var(--cv-pro-sky)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.65rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {dynamicSectionsList.map((sec) => {
                      const hasOverride = Boolean(designConfig.sectionOverrides?.[sec.id])
                      return (
                        <option key={sec.id} value={sec.id}>
                          {sec.name} {hasOverride ? '✨ (Customizado)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* Card de Configuração da Seção */}
                <div style={{ background: '#090d16', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--cv-pro-sky)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CurrentSectionIcon size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                          {currentSectionMeta.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {currentSectionMeta.description}
                        </div>
                      </div>
                    </div>

                    {Boolean(designConfig.sectionOverrides?.[effectiveSectionId]) && (
                      <button
                        type="button"
                        onClick={() => handleResetSectionOverride(effectiveSectionId)}
                        className="cv-pro-btn"
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderColor: '#ef4444', color: '#f87171' }}
                        title="Restaurar valores padrão deste setor"
                      >
                        <RotateCcwIcon size={11} />
                        <span>Restaurar</span>
                      </button>
                    )}
                  </div>

                  {/* Grid de Cores da Seção */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {/* Cor do Texto */}
                    <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Cor do Texto:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={currentSectionOverride.textColor || (effectiveSectionId === 'sidebar' ? '#cbd5e1' : designConfig.colorText || '#0f172a')}
                          onChange={(e) => handleUpdateSectionOverride(effectiveSectionId, 'textColor', e.target.value)}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                          {currentSectionOverride.textColor || 'Padrão'}
                        </span>
                      </div>
                    </div>

                    {/* Cor do Título / H2 */}
                    <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Cor do Título:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={currentSectionOverride.titleColor || (effectiveSectionId === 'sidebar' ? '#38bdf8' : designConfig.colorPrimary || '#0284c7')}
                          onChange={(e) => handleUpdateSectionOverride(effectiveSectionId, 'titleColor', e.target.value)}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                          {currentSectionOverride.titleColor || 'Padrão'}
                        </span>
                      </div>
                    </div>

                    {/* Cor do Subtítulo */}
                    <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Cor do Subtítulo:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={currentSectionOverride.subtitleColor || designConfig.colorSecondary || '#0369a1'}
                          onChange={(e) => handleUpdateSectionOverride(effectiveSectionId, 'subtitleColor', e.target.value)}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                          {currentSectionOverride.subtitleColor || 'Padrão'}
                        </span>
                      </div>
                    </div>

                    {/* Cor de Fundo / Box */}
                    <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Fundo / Box:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={currentSectionOverride.bgColor || (effectiveSectionId === 'sidebar' ? designConfig.colorSidebar || '#f8fafc' : designConfig.colorSurface || '#f8fafc')}
                          onChange={(e) => handleUpdateSectionOverride(effectiveSectionId, 'bgColor', e.target.value)}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                          {currentSectionOverride.bgColor || 'Padrão'}
                        </span>
                      </div>
                    </div>

                    {/* Bordas & Divisores */}
                    <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Bordas:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={currentSectionOverride.borderColor || designConfig.colorBorder || '#e2e8f0'}
                          onChange={(e) => handleUpdateSectionOverride(effectiveSectionId, 'borderColor', e.target.value)}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                          {currentSectionOverride.borderColor || 'Padrão'}
                        </span>
                      </div>
                    </div>

                    {/* Cor de Acento */}
                    <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.3)', gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Acento / Badges do Setor:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="color"
                          value={currentSectionOverride.accentColor || designConfig.colorAccent || '#f97316'}
                          onChange={(e) => handleUpdateSectionOverride(effectiveSectionId, 'accentColor', e.target.value)}
                          style={{ width: '28px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                          {currentSectionOverride.accentColor || 'Padrão'}
                        </span>
                      </div>
                    </div>

                    {/* Textura Específica do Setor */}
                    <div style={{ background: '#0f172a', padding: '0.55rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.3)', gridColumn: 'span 2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.68rem', color: 'var(--cv-pro-sky)', fontWeight: 600 }}>Textura Exclusiva do Setor:</label>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <input
                            ref={sectionFileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleUploadCustomBg(e, effectiveSectionId)}
                          />
                          <button
                            type="button"
                            className="cv-pro-btn"
                            onClick={() => sectionFileInputRef.current?.click()}
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.66rem', borderColor: 'var(--cv-pro-sky)' }}
                          >
                            <UploadIcon size={11} />
                            <span>Upload</span>
                          </button>
                          {Boolean(currentSectionOverride.bgImage) && (
                            <button
                              type="button"
                              className="cv-pro-btn"
                              onClick={() => handleUpdateSectionOverride(effectiveSectionId, 'bgImage', '')}
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.66rem', borderColor: '#ef4444', color: '#f87171' }}
                            >
                              <TrashIcon size={11} />
                              <span>Remover</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mini-carrossel de texturas */}
                      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                        {BACKGROUND_CATALOG
                          .filter((bg) => bg.id !== 'none')
                          .map((bg) => {
                            const isBgActive = currentSectionOverride.bgImage === bg.url
                            return (
                              <button
                                key={bg.id}
                                type="button"
                                onClick={() => handleUpdateSectionOverride(effectiveSectionId, 'bgImage', bg.url)}
                                style={{
                                  flex: '0 0 64px',
                                  height: '38px',
                                  borderRadius: '4px',
                                  background: `url(${bg.url}) center/cover no-repeat`,
                                  border: isBgActive ? '2px solid var(--cv-pro-sky)' : '1px solid rgba(51, 65, 85, 0.4)',
                                  cursor: 'pointer',
                                  position: 'relative',
                                  boxShadow: isBgActive ? '0 0 8px rgba(56, 189, 248, 0.4)' : 'none'
                                }}
                                title={bg.name}
                              >
                                <span
                                  style={{
                                    position: 'absolute',
                                    bottom: '1px',
                                    right: '1px',
                                    fontSize: '0.5rem',
                                    background: 'rgba(0,0,0,0.8)',
                                    color: '#e2e8f0',
                                    padding: '0 2px',
                                    borderRadius: '2px',
                                    fontWeight: 700
                                  }}
                                >
                                  {bg.aspectRatio}
                                </span>
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Atalhos Rápidos de Setores */}
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>
                    Atalhos de Seleção Rápida:
                  </label>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {dynamicSectionsList.map((sec) => {
                      const isSelected = sec.id === effectiveSectionId
                      const isOverridden = Boolean(designConfig.sectionOverrides?.[sec.id])
                      const SecIcon = sec.icon
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => setSelectedSectionId(sec.id)}
                          style={{
                            background: isSelected ? 'var(--cv-pro-sky)' : isOverridden ? 'rgba(56, 189, 248, 0.15)' : '#090d16',
                            color: isSelected ? '#090d16' : isOverridden ? 'var(--cv-pro-sky)' : '#94a3b8',
                            border: isSelected ? '1px solid var(--cv-pro-sky)' : isOverridden ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(51, 65, 85, 0.4)',
                            borderRadius: '4px',
                            padding: '0.25rem 0.45rem',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <SecIcon size={12} />
                          <span>{sec.name.split('/')[0].trim()}</span>
                          {isOverridden && !isSelected && <span>✨</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Botão de Reset Geral de Design */}
            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(51, 65, 85, 0.3)' }}>
              <button
                type="button"
                className="cv-pro-btn"
                onClick={handleResetAllDesign}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '0.45rem',
                  fontSize: '0.74rem',
                  color: '#f87171',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.05)'
                }}
              >
                <RotateCcwIcon size={13} />
                <span>Restaurar Todos os Padrões de Design</span>
              </button>
            </div>
          </div>
        )}

        {/* ── ABA 3: AUDITORIA ATS ── */}
        {activeTab === 'ats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#0f172a', borderRadius: '8px', border: '1px solid var(--cv-pro-border)' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: scoreColor }}>
                {atsReport.overallScore}%
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                  Score de Aderência ATS
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  {atsReport.overallScore >= 80 ? 'Excelente alinhamento para triagem' : 'Requer inclusão de termos-chave da vaga'}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.35rem' }}>
                Descrição da Vaga Alvo (Job Description):
              </label>
              <textarea
                value={jdText}
                onChange={(e) => onJdTextChange(e.target.value)}
                placeholder="Cole o texto da vaga aqui para comparar palavras-chave em tempo real..."
                style={{
                  width: '100%',
                  height: '110px',
                  background: '#070a12',
                  border: '1px solid var(--cv-pro-border)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.76rem',
                  padding: '0.5rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="button"
              className={`cv-pro-btn ${isVisualHeatmapActive ? 'cv-pro-btn--hero' : ''}`}
              onClick={onToggleVisualHeatmap}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <TargetIcon size={14} />
              <span>{isVisualHeatmapActive ? 'Desativar Heatmap na Folha' : 'Ativar Heatmap Visual na Folha'}</span>
            </button>

            {atsReport.keywordAnalysis.missingKeywords.length > 0 && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fca5a5' }}>
                  Palavras-chave ausentes ({atsReport.keywordAnalysis.missingKeywords.length}):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
                  {atsReport.keywordAnalysis.missingKeywords.slice(0, 12).map((kw) => (
                    <span
                      key={kw}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5'
                      }}
                    >
                      +{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA 4: FORMATO & GEOMETRIA DO PAPEL ── */}
        {activeTab === 'format' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
              Padrões Físicos de Impressão
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.values(PAGE_FORMATS).map((pf) => {
                const isSelected = activePageFormat === pf.id
                return (
                  <button
                    key={pf.id}
                    type="button"
                    className="cv-pro-btn"
                    onClick={() => onPageFormatChange(pf.id)}
                    style={{
                      justifyContent: 'space-between',
                      background: isSelected ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                      borderColor: isSelected ? 'var(--cv-pro-sky)' : 'rgba(51, 65, 85, 0.4)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, textAlign: 'left' }}>{pf.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'left' }}>
                        {pf.widthMm} × {pf.heightMm} mm
                      </div>
                    </div>
                    {isSelected && <CheckIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />}
                  </button>
                )
              })}
            </div>

            {activePageFormat === 'custom' && customPageDimensions && onCustomPageDimensionsChange && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Largura (mm)</label>
                  <input
                    type="number"
                    value={customPageDimensions.widthMm}
                    onChange={(e) => onCustomPageDimensionsChange({
                      ...customPageDimensions,
                      widthMm: Number(e.target.value) || 210
                    })}
                    style={{
                      width: '100%',
                      background: '#090d16',
                      border: '1px solid rgba(51, 65, 85, 0.4)',
                      borderRadius: '4px',
                      color: '#f8fafc',
                      height: '30px',
                      padding: '0.2rem 0.5rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Altura (mm)</label>
                  <input
                    type="number"
                    value={customPageDimensions.heightMm}
                    onChange={(e) => onCustomPageDimensionsChange({
                      ...customPageDimensions,
                      heightMm: Number(e.target.value) || 297
                    })}
                    style={{
                      width: '100%',
                      background: '#090d16',
                      border: '1px solid rgba(51, 65, 85, 0.4)',
                      borderRadius: '4px',
                      color: '#f8fafc',
                      height: '30px',
                      padding: '0.2rem 0.5rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
