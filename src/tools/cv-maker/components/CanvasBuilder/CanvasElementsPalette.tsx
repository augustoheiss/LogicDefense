import React, { useState, useEffect, useRef } from 'react'
import {
  AVAILABLE_BOX_FONTS,
  type CVData,
  type CustomCanvasZone,
  type LayoutStructureConfig,
  type SectionBoxDimensions
} from '../../types/cv'
import { UniversalLayerTree } from './UniversalLayerTree'
import type { LayoutArchetype } from '../../types/universalAST'
import { getAtomicItemId } from '../../utils/atomicIdUtils'
import { compressImageFile } from '../../utils/imageCompressor'
import {
  LayersIcon,
  SearchIcon,
  ZapIcon,
  RotateCcwIcon,
  CameraIcon,
  UploadIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  RocketIcon,
  GlobeIcon,
  AwardIcon,
  BookmarkIcon,
  GripVerticalIcon,
  SquareIcon,
  HexagonIcon,
  TypeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon
} from '../Icons/ProIcons'

interface CanvasElementsPaletteProps {
  data: CVData | null
  structureConfig: LayoutStructureConfig
  onUpdateStructureConfig: (config: LayoutStructureConfig) => void
  onResetStructure: () => void
  onAutoPackBlocks?: () => void
  onUpdatePhoto?: (photoUrlOrBase64?: string, posX?: number, posY?: number, scale?: number) => void
  onUpdateArchetypeOverride?: (sectionKey: string, archetype: LayoutArchetype) => void
}

const PHOTO_SHAPES_LIST = [
  { id: 'circle', label: 'Círculo' },
  { id: 'square', label: 'Quadrado' },
  { id: 'rounded', label: 'Cantos Suaves' },
  { id: 'vertical', label: 'Editorial 3:4' },
  { id: 'pill', label: 'Pílula' },
  { id: 'hexagon', label: 'Hexágono' },
  { id: 'diamond', label: 'Losango' },
  { id: 'shield', label: 'Brasão' },
  { id: 'octagon', label: 'Octógono' },
  { id: 'teardrop', label: 'Gota' },
  { id: 'editorial_stamp', label: 'Selo Stamp' },
] as const

export const CanvasElementsPalette: React.FC<CanvasElementsPaletteProps> = ({
  data,
  structureConfig,
  onUpdateStructureConfig,
  onResetStructure,
  onAutoPackBlocks,
  onUpdatePhoto,
  onUpdateArchetypeOverride
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [paletteSubTab, setPaletteSubTab] = useState<'layers' | 'canvas_tools'>('layers')
  const [urlInputValue, setUrlInputValue] = useState<string>('')
  const [openTypoId, setOpenTypoId] = useState<string | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [activeDrawingMode, setActiveDrawingMode] = useState<'rect' | 'polygon' | null>(null)
  const [searchFilter, setSearchFilter] = useState<string>('')

  const handleToggleSectionVisibility = (secKey: string) => {
    const currentHidden = new Set(structureConfig.hiddenSections || [])
    if (currentHidden.has(secKey)) {
      currentHidden.delete(secKey)
    } else {
      currentHidden.add(secKey)
    }
    onUpdateStructureConfig({
      ...structureConfig,
      hiddenSections: Array.from(currentHidden)
    })
  }

  // Estado de colapso das seções (por padrão, apenas as primeiras abertas)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    zones: true,
    projects: false,
    skills: false,
    languages: true,
    certificates: true,
    interests: true
  })

  useEffect(() => {
    const handleZoneSelected = (e: any) => {
      setSelectedZoneId(e.detail?.zoneId || null)
    }
    const handleStartDrawEvent = (e: any) => {
      setActiveDrawingMode(e.detail?.mode || null)
    }
    const handleCancelDrawEvent = () => {
      setActiveDrawingMode(null)
    }
    window.addEventListener('cv-canvas-zone-selected' as any, handleZoneSelected)
    window.addEventListener('cv-canvas-start-draw' as any, handleStartDrawEvent)
    window.addEventListener('cv-canvas-cancel-draw' as any, handleCancelDrawEvent)
    return () => {
      window.removeEventListener('cv-canvas-zone-selected' as any, handleZoneSelected)
      window.removeEventListener('cv-canvas-start-draw' as any, handleStartDrawEvent)
      window.removeEventListener('cv-canvas-cancel-draw' as any, handleCancelDrawEvent)
    }
  }, [])

  if (!data) {
    return (
      <div className="cv-elements-palette cv-elements-palette--empty">
        <p>Nenhum dado de currículo carregado.</p>
      </div>
    )
  }

  const dimensions = structureConfig.sectionDimensions || {}
  const photoDims = dimensions['photo'] || {}
  const activeShape = (photoDims.photoShape || photoDims.variant || 'circle') as any
  const activeSize = photoDims.photoSize ?? 90
  const activeBorderWidth = photoDims.photoBorderWidth ?? 0
  const activeBorderColor = photoDims.photoBorderColor || '#0284c7'
  const activeShadow = photoDims.photoShadow ?? true
  const activeScale = photoDims.photoScale ?? data.basics?.imageScale ?? 1.0
  const activePosX = photoDims.photoPosX ?? data.basics?.imagePosX ?? 50
  const activePosY = photoDims.photoPosY ?? data.basics?.imagePosY ?? 50

  const toggleSectionCollapse = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }))
  }

  const handleUpdateSectionDimensions = (key: string, updates: Partial<SectionBoxDimensions>) => {
    const nextDims = { ...dimensions, [key]: { ...(dimensions[key] || {}), ...updates } }
    onUpdateStructureConfig({ ...structureConfig, sectionDimensions: nextDims })
  }

  const handleToggleHide = (key: string) => {
    const cur = dimensions[key] || {}
    handleUpdateSectionDimensions(key, { hidden: !cur.hidden })
  }

  const handleSelectVariant = (key: string, variant: string) => {
    handleUpdateSectionDimensions(key, { variant: variant as any })
  }

  const handleUpdatePhotoDimensions = (updates: Partial<typeof photoDims>) => {
    const nextPhotoDims = { ...photoDims, ...updates }
    onUpdateStructureConfig({
      ...structureConfig,
      sectionDimensions: {
        ...dimensions,
        ['photo']: nextPhotoDims
      }
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 })
      onUpdatePhoto?.(base64, activePosX, activePosY, activeScale)
      handleUpdatePhotoDimensions({ hidden: false })
    } catch (err) {
      console.error('[CanvasElementsPalette] Erro ao carregar foto:', err)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleApplyUrl = () => {
    const url = urlInputValue.trim()
    if (!url) return
    onUpdatePhoto?.(url, activePosX, activePosY, activeScale)
    handleUpdatePhotoDimensions({ hidden: false })
    setUrlInputValue('')
  }

  const handleRemovePhoto = () => {
    onUpdatePhoto?.('', 50, 50, 1.0)
    handleUpdatePhotoDimensions({ hidden: true })
  }

  const handleStartDraw = (mode: 'rect' | 'polygon') => {
    if (activeDrawingMode === mode) {
      setActiveDrawingMode(null)
      window.dispatchEvent(new CustomEvent('cv-canvas-cancel-draw'))
    } else {
      setActiveDrawingMode(mode)
      if (!structureConfig.isFreeCanvasActive) {
        onUpdateStructureConfig({
          ...structureConfig,
          isFreeCanvasActive: true
        })
      }
      window.dispatchEvent(new CustomEvent('cv-canvas-start-draw', { detail: { mode } }))
    }
  }

  const handleSelectZone = (zoneId: string) => {
    const nextId = selectedZoneId === zoneId ? null : zoneId
    setSelectedZoneId(nextId)
    window.dispatchEvent(new CustomEvent('cv-canvas-select-zone', { detail: { zoneId: nextId } }))
  }

  const handleDeleteZone = (zoneId: string) => {
    const next = (structureConfig.customZones || []).filter(z => z.id !== zoneId)
    onUpdateStructureConfig({ ...structureConfig, customZones: next })
    if (selectedZoneId === zoneId) setSelectedZoneId(null)
  }

  const handleAddQuickZone = (type: 'sidebar_left' | 'sidebar_right' | 'banner_top' | 'box_bottom') => {
    let newZone: CustomCanvasZone
    const existing = structureConfig.customZones || []

    if (type === 'sidebar_left') {
      newZone = {
        id: `zone_sidebar_l_${Date.now()}`,
        label: 'Sidebar Esquerda (32%)',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 32,
        height: 100,
        backgroundColor: '#0f172a',
        backgroundOpacity: 0.96
      }
    } else if (type === 'sidebar_right') {
      newZone = {
        id: `zone_sidebar_r_${Date.now()}`,
        label: 'Sidebar Direita (32%)',
        shape: 'rect',
        x: 68,
        y: 0,
        width: 32,
        height: 100,
        backgroundColor: '#0f172a',
        backgroundOpacity: 0.96
      }
    } else if (type === 'banner_top') {
      newZone = {
        id: `zone_banner_t_${Date.now()}`,
        label: 'Banner Superior (16%)',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 16,
        backgroundColor: '#1e293b',
        backgroundOpacity: 0.95
      }
    } else {
      newZone = {
        id: `zone_box_b_${Date.now()}`,
        label: 'Box de Destaque',
        shape: 'rect',
        x: 4,
        y: 65,
        width: 92,
        height: 28,
        backgroundColor: '#1e293b',
        backgroundOpacity: 0.85,
        borderRadius: 8
      }
    }

    onUpdateStructureConfig({
      ...structureConfig,
      isFreeCanvasActive: true,
      customZones: [...existing, newZone]
    })
    setSelectedZoneId(newZone.id)
    window.dispatchEvent(new CustomEvent('cv-canvas-select-zone', { detail: { zoneId: newZone.id } }))
  }

  // Filtragem de busca por texto
  const filterQuery = searchFilter.trim().toLowerCase()
  const isFiltering = filterQuery.length > 0

  const matchesFilter = (text1?: string, text2?: string) => {
    if (!isFiltering) return true
    return (
      (text1 && text1.toLowerCase().includes(filterQuery)) ||
      (text2 && text2.toLowerCase().includes(filterQuery))
    )
  }

  // Contagem de itens ocultados
  const totalHidden = Object.values(dimensions).filter(d => d.hidden).length

  // Helper de Tipografia Popover
  const renderTypographyPanel = (key: string, itemLabel?: string) => {
    if (openTypoId !== key) return null
    const curDims = dimensions[key] || {}
    const activeFont = curDims.fontFamily || 'inherit'
    const activeScale = curDims.fontSizeScale ?? 1.0
    const activePercent = Math.round(activeScale * 100)

    return (
      <div className="cv-palette-typo-panel" style={{ marginTop: '0.35rem', marginBottom: '0.45rem' }}>
        <div className="cv-palette-typo-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <TypeIcon size={13} />
            <span>{itemLabel ? `Tipografia: ${itemLabel}` : 'Tipografia & Escala'}</span>
          </span>
          <button
            type="button"
            className="cv-palette-typo-close-btn"
            onClick={() => setOpenTypoId(null)}
            title="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="cv-palette-typo-field">
          <label className="cv-palette-typo-label">Tipo de Fonte:</label>
          <select
            className="cv-palette-typo-select"
            value={activeFont}
            onChange={e => handleUpdateSectionDimensions(key, { fontFamily: e.target.value })}
          >
            {AVAILABLE_BOX_FONTS.map(f => (
              <option key={f.id} value={f.family || 'inherit'}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="cv-palette-typo-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="cv-palette-typo-label">Escala Tipográfica:</label>
            <span className="cv-palette-typo-badge">{activePercent}%</span>
          </div>
          <div className="cv-palette-typo-slider-row">
            <button
              type="button"
              className="cv-palette-stepper-btn"
              onClick={() => handleUpdateSectionDimensions(key, { fontSizeScale: Math.max(0.70, Number((activeScale - 0.02).toFixed(2))) })}
              title="Diminuir fonte em 2%"
            >
              -2%
            </button>
            <input
              type="range"
              min="0.70"
              max="1.40"
              step="0.02"
              value={activeScale}
              onChange={e => handleUpdateSectionDimensions(key, { fontSizeScale: parseFloat(e.target.value) })}
              className="cv-palette-typo-slider"
            />
            <button
              type="button"
              className="cv-palette-stepper-btn"
              onClick={() => handleUpdateSectionDimensions(key, { fontSizeScale: Math.min(1.40, Number((activeScale + 0.02).toFixed(2))) })}
              title="Aumentar fonte em 2%"
            >
              +2%
            </button>
          </div>
        </div>

        {(curDims.fontSizeScale || curDims.fontFamily) && (
          <button
            type="button"
            className="cv-palette-typo-reset-btn"
            onClick={() => handleUpdateSectionDimensions(key, { fontSizeScale: undefined, fontFamily: undefined })}
            title="Restaurar padrão do tema"
          >
            Restaurar Padrão do Tema
          </button>
        )}
      </div>
    )
  }

  const renderTypoButton = (key: string, title = 'Tipografia do bloco') => {
    const curDims = dimensions[key] || {}
    const hasCustom = Boolean(curDims.fontSizeScale || curDims.fontFamily)
    const isOpen = openTypoId === key

    return (
      <button
        type="button"
        className={`cv-palette-typo-btn ${hasCustom ? 'is-custom' : ''} ${isOpen ? 'is-open' : ''}`}
        onClick={() => setOpenTypoId(isOpen ? null : key)}
        title={hasCustom ? 'Tipografia personalizada ativa' : title}
        style={{ padding: '0.2rem 0.35rem', fontSize: '0.68rem', fontWeight: 700 }}
      >
        Aa
      </button>
    )
  }

  return (
    <div className="cv-pro-elements-palette">
      {/* Input oculto para upload de foto local */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* ── Topo do Menu: Título, Subtítulo & Ações ── */}
      <div className="cv-pro-elements-header">
        <div>
          <h4 className="cv-pro-elements-title">
            <LayersIcon size={16} style={{ color: 'var(--cv-pro-sky)' }} />
            <span>Elementos do Canvas</span>
          </h4>
          <span className="cv-pro-elements-subtitle">
            Camadas, variantes, visibilidade e proporções
          </span>
        </div>
        <div className="cv-pro-elements-actions">
          {onAutoPackBlocks && (
            <button
              type="button"
              className="cv-pro-btn"
              onClick={onAutoPackBlocks}
              title="Compactar blocos e eliminar espaços vazios automaticamente"
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}
            >
              <ZapIcon size={12} style={{ color: 'var(--cv-pro-accent)' }} />
              <span>Compactar</span>
            </button>
          )}
          <button
            type="button"
            className="cv-pro-btn"
            onClick={onResetStructure}
            title="Redefinir todas as variantes e posições para o padrão do modelo"
            style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}
          >
            <RotateCcwIcon size={12} />
            <span>Restaurar</span>
          </button>
        </div>
      </div>

      {/* ── Sub-Abas: Árvore de Camadas (AST) vs Ferramentas Clássicas de Canvas ── */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          margin: '0.75rem 0 0.85rem 0',
          background: '#090d16',
          padding: '0.25rem',
          borderRadius: '6px',
          border: '1px solid #1e293b'
        }}
      >
        <button
          type="button"
          onClick={() => setPaletteSubTab('layers')}
          style={{
            flex: 1,
            padding: '0.35rem 0.5rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            background: paletteSubTab === 'layers' ? '#1e293b' : 'transparent',
            color: paletteSubTab === 'layers' ? '#38bdf8' : '#94a3b8',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}
        >
          <LayersIcon size={13} />
          <span>Camadas (AST)</span>
        </button>
        <button
          type="button"
          onClick={() => setPaletteSubTab('canvas_tools')}
          style={{
            flex: 1,
            padding: '0.35rem 0.5rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            background: paletteSubTab === 'canvas_tools' ? '#1e293b' : 'transparent',
            color: paletteSubTab === 'canvas_tools' ? '#38bdf8' : '#94a3b8',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}
        >
          <CameraIcon size={13} />
          <span>Foto & Zonas</span>
        </button>
      </div>

      {paletteSubTab === 'layers' && (
        <UniversalLayerTree
          ast={data.meta?.universalAST}
          onUpdateArchetypeOverride={onUpdateArchetypeOverride || (() => {})}
          hiddenSections={new Set(structureConfig.hiddenSections || [])}
          onToggleSectionVisibility={handleToggleSectionVisibility}
        />
      )}

      {paletteSubTab === 'canvas_tools' && (
        <>
          {/* ── Campo de Busca Rápida de Camadas ── */}
          <div className="cv-pro-search-box">
        <SearchIcon size={13} style={{ color: 'var(--cv-pro-text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          className="cv-pro-search-input"
          placeholder="Filtrar camadas e elementos..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
        />
        {isFiltering && (
          <button
            type="button"
            className="cv-pro-search-clear"
            onClick={() => setSearchFilter('')}
            title="Limpar filtro"
          >
            ✕
          </button>
        )}
      </div>

      {/* Alerta discreto de itens ocultados */}
      {totalHidden > 0 && !isFiltering && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '6px',
            padding: '0.35rem 0.6rem',
            fontSize: '0.72rem',
            color: '#fde047',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <EyeOffIcon size={13} />
          <span>{totalHidden} {totalHidden === 1 ? 'camada ocultada' : 'camadas ocultadas'} na folha</span>
        </div>
      )}

      {/* ── Switches Mestres: Canvas Livre & Ícones nos Títulos ── */}
      <div className="cv-pro-switches-grid">
        <div className={`cv-pro-switch-card ${structureConfig.isFreeCanvasActive ? 'is-active' : ''}`}>
          <div className="cv-pro-switch-card-info">
            <span className="cv-pro-switch-card-label">Canvas Livre</span>
            <span className="cv-pro-switch-card-desc">
              {structureConfig.isFreeCanvasActive ? 'Arrastar blocos' : 'Alinhado em grid'}
            </span>
          </div>
          <label className="cv-pro-toggle">
            <input
              type="checkbox"
              checked={Boolean(structureConfig.isFreeCanvasActive)}
              onChange={e => onUpdateStructureConfig({ ...structureConfig, isFreeCanvasActive: e.target.checked })}
            />
            <span className="cv-pro-toggle-slider" />
          </label>
        </div>

        <div className={`cv-pro-switch-card ${structureConfig.showSectionIcons ? 'is-active' : ''}`}>
          <div className="cv-pro-switch-card-info">
            <span className="cv-pro-switch-card-label">Ícones Títulos</span>
            <span className="cv-pro-switch-card-desc">
              {structureConfig.showSectionIcons ? 'Exibindo na folha' : 'Apenas texto'}
            </span>
          </div>
          <label className="cv-pro-toggle">
            <input
              type="checkbox"
              checked={Boolean(structureConfig.showSectionIcons)}
              onChange={e => onUpdateStructureConfig({ ...structureConfig, showSectionIcons: e.target.checked })}
            />
            <span className="cv-pro-toggle-slider" />
          </label>
        </div>
      </div>

      {/* ── 1. Accordion: Identidade & Foto de Perfil ── */}
      {matchesFilter('foto', 'identidade') && (
        <div className={`cv-pro-layer-group ${!collapsedSections['identity'] ? 'is-open' : ''}`}>
          <div
            className="cv-pro-layer-group__header"
            onClick={() => toggleSectionCollapse('identity')}
          >
            <span className="cv-pro-layer-group__title">
              <CameraIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
              <span>Identidade & Foto</span>
            </span>
            <div className="cv-pro-layer-group__actions" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="cv-pro-btn"
                style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none' }}
                onClick={() => toggleSectionCollapse('identity')}
              >
                {!collapsedSections['identity'] ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </button>
            </div>
          </div>

          {!collapsedSections['identity'] && (
            <div className="cv-pro-layer-group__content">
              {/* Foto de Perfil: Preview, Upload e Geometria */}
              <div className="cv-pro-photo-card">
                <div className="cv-pro-photo-preview-wrap">
                  {data.basics?.image ? (
                    <img
                      src={data.basics.image}
                      alt="Foto de perfil"
                      className="cv-pro-photo-avatar"
                      style={{
                        borderRadius: activeShape === 'circle' ? '50%' : activeShape === 'rounded' ? '8px' : '0px',
                        borderWidth: `${activeBorderWidth}px`,
                        borderColor: activeBorderColor,
                        borderStyle: activeBorderWidth > 0 ? 'solid' : 'none',
                        boxShadow: activeShadow ? '0 4px 14px rgba(0,0,0,0.5)' : 'none'
                      }}
                    />
                  ) : (
                    <div
                      className="cv-pro-photo-avatar"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--cv-pro-text-muted)',
                        fontSize: '0.7rem'
                      }}
                    >
                      <CameraIcon size={20} />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        type="button"
                        className="cv-pro-btn cv-pro-btn--hero"
                        style={{ flex: 1, padding: '0.28rem 0.5rem', fontSize: '0.72rem' }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadIcon size={12} />
                        <span>{data.basics?.image ? 'Trocar Imagem' : 'Carregar Imagem'}</span>
                      </button>

                      {data.basics?.image && (
                        <button
                          type="button"
                          className="cv-pro-btn"
                          style={{ padding: '0.28rem 0.45rem', color: '#f87171' }}
                          onClick={handleRemovePhoto}
                          title="Remover foto"
                        >
                          <TrashIcon size={13} />
                        </button>
                      )}

                      <button
                        type="button"
                        className={`cv-pro-eye-btn ${dimensions['photo']?.hidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide('photo')}
                        title={dimensions['photo']?.hidden ? 'Exibir foto no currículo' : 'Ocultar foto'}
                      >
                        {dimensions['photo']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                      </button>
                    </div>

                    {/* Input de URL discreto */}
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <input
                        type="text"
                        placeholder="Ou cole URL da foto..."
                        value={urlInputValue}
                        onChange={e => setUrlInputValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleApplyUrl() }}
                        className="cv-pro-search-input"
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid var(--cv-pro-border-subtle)',
                          borderRadius: '4px',
                          padding: '0.25rem 0.45rem'
                        }}
                      />
                      <button
                        type="button"
                        className="cv-pro-btn"
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem' }}
                        onClick={handleApplyUrl}
                        disabled={!urlInputValue.trim()}
                      >
                        OK
                      </button>
                    </div>
                  </div>
                </div>

                {/* Formatos e Polígonos */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--cv-pro-text-secondary)' }}>
                      Formato da Foto
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--cv-pro-sky)', fontWeight: 600 }}>
                      {PHOTO_SHAPES_LIST.find(s => s.id === activeShape)?.label || 'Círculo'}
                    </span>
                  </div>
                  <div className="cv-pro-shapes-grid">
                    {PHOTO_SHAPES_LIST.map(shape => {
                      const isSel = activeShape === shape.id
                      return (
                        <button
                          key={shape.id}
                          type="button"
                          className={`cv-pro-shape-chip ${isSel ? 'is-active' : ''}`}
                          onClick={() => handleUpdatePhotoDimensions({ photoShape: shape.id as any })}
                        >
                          {shape.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sliders de Dimensão & Ajuste Facial */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', borderTop: '1px solid var(--cv-pro-border-subtle)', paddingTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--cv-pro-text-secondary)' }}>Tamanho:</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--cv-pro-sky)', fontWeight: 600 }}>{activeSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    step="2"
                    value={activeSize}
                    onChange={e => handleUpdatePhotoDimensions({ photoSize: parseInt(e.target.value) })}
                    className="cv-palette-typo-slider"
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--cv-pro-text-secondary)' }}>Zoom Facial:</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--cv-pro-sky)', fontWeight: 600 }}>{Number(activeScale).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="2.5"
                    step="0.05"
                    value={activeScale}
                    onChange={e => {
                      const sc = parseFloat(e.target.value)
                      handleUpdatePhotoDimensions({ photoScale: sc })
                      onUpdatePhoto?.(data.basics?.image, activePosX, activePosY, sc)
                    }}
                    className="cv-palette-typo-slider"
                  />
                </div>
              </div>

              {/* Camadas Base: Nome, Contatos, Resumo */}
              <div className="cv-pro-layer-row">
                <div className="cv-pro-layer-row__info">
                  <span className="cv-pro-layer-row__primary">Nome & Título</span>
                  <span className="cv-pro-layer-row__secondary">{data.basics?.name || 'Candidato'}</span>
                </div>
                <div className="cv-pro-layer-row__actions">
                  {renderTypoButton('header', 'Ajustar fonte do Nome & Título')}
                  <button
                    type="button"
                    className={`cv-pro-eye-btn ${dimensions['header']?.hidden ? 'is-hidden' : ''}`}
                    onClick={() => handleToggleHide('header')}
                    title={dimensions['header']?.hidden ? 'Exibir' : 'Ocultar'}
                  >
                    {dimensions['header']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                  </button>
                </div>
              </div>
              {renderTypographyPanel('header', 'Nome & Título')}

              <div className="cv-pro-layer-row">
                <div className="cv-pro-layer-row__info">
                  <span className="cv-pro-layer-row__primary">Contatos & Redes</span>
                  <span className="cv-pro-layer-row__secondary">{data.basics?.email || 'Email, telefone, links'}</span>
                </div>
                <div className="cv-pro-layer-row__actions">
                  {renderTypoButton('contacts', 'Ajustar fonte dos Contatos')}
                  <button
                    type="button"
                    className={`cv-pro-eye-btn ${dimensions['contacts']?.hidden ? 'is-hidden' : ''}`}
                    onClick={() => handleToggleHide('contacts')}
                    title={dimensions['contacts']?.hidden ? 'Exibir' : 'Ocultar'}
                  >
                    {dimensions['contacts']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                  </button>
                </div>
              </div>
              {renderTypographyPanel('contacts', 'Contatos & Redes')}

              {data.basics?.summary && (
                <>
                  <div className="cv-pro-layer-row">
                    <div className="cv-pro-layer-row__info">
                      <span className="cv-pro-layer-row__primary">Sobre Mim / Resumo</span>
                      <span className="cv-pro-layer-row__secondary">Perfil profissional</span>
                    </div>
                    <div className="cv-pro-layer-row__actions">
                      {renderTypoButton('summary', 'Ajustar fonte do Resumo')}
                      <button
                        type="button"
                        className={`cv-pro-eye-btn ${dimensions['summary']?.hidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide('summary')}
                        title={dimensions['summary']?.hidden ? 'Exibir' : 'Ocultar'}
                      >
                        {dimensions['summary']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel('summary', 'Sobre Mim / Resumo')}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 2. Accordion: Zonas, Sidebars & Boxes de Fundo ── */}
      {matchesFilter('zonas', 'sidebar') && (
        <div className={`cv-pro-layer-group ${!collapsedSections['zones'] ? 'is-open' : ''}`}>
          <div
            className="cv-pro-layer-group__header"
            onClick={() => toggleSectionCollapse('zones')}
          >
            <span className="cv-pro-layer-group__title">
              <SquareIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
              <span>Zonas & Sidebars</span>
              {(structureConfig.customZones || []).length > 0 && (
                <span className="cv-pro-layer-group__count">
                  {(structureConfig.customZones || []).length}
                </span>
              )}
            </span>
            <div className="cv-pro-layer-group__actions" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className="cv-pro-btn"
                style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none' }}
                onClick={() => toggleSectionCollapse('zones')}
              >
                {!collapsedSections['zones'] ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </button>
            </div>
          </div>

          {!collapsedSections['zones'] && (
            <div className="cv-pro-layer-group__content">
              {/* Modos de Desenho */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                <button
                  type="button"
                  className={`cv-pro-btn ${activeDrawingMode === 'rect' ? 'cv-pro-btn--active' : ''}`}
                  onClick={() => handleStartDraw('rect')}
                  title="Desenhar box ou sidebar retangular no canvas"
                  style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem' }}
                >
                  <PlusIcon size={12} />
                  <span>{activeDrawingMode === 'rect' ? 'Desenhando...' : 'Desenhar Box'}</span>
                </button>
                <button
                  type="button"
                  className={`cv-pro-btn ${activeDrawingMode === 'polygon' ? 'cv-pro-btn--active' : ''}`}
                  onClick={() => handleStartDraw('polygon')}
                  title="Desenhar polígono livre com vértices retos"
                  style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem' }}
                >
                  <HexagonIcon size={12} />
                  <span>{activeDrawingMode === 'polygon' ? 'Marcando...' : 'Polígono'}</span>
                </button>
              </div>

              {/* Atalhos Rápidos de Layout */}
              <div>
                <span style={{ fontSize: '0.66rem', color: 'var(--cv-pro-text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', margin: '0.35rem 0 0.25rem 0' }}>
                  Atalhos Rápidos:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                  <button
                    type="button"
                    className="cv-pro-shape-chip"
                    onClick={() => handleAddQuickZone('sidebar_left')}
                  >
                    Sidebar Esq (32%)
                  </button>
                  <button
                    type="button"
                    className="cv-pro-shape-chip"
                    onClick={() => handleAddQuickZone('sidebar_right')}
                  >
                    Sidebar Dir (32%)
                  </button>
                  <button
                    type="button"
                    className="cv-pro-shape-chip"
                    onClick={() => handleAddQuickZone('banner_top')}
                  >
                    Banner Topo (16%)
                  </button>
                  <button
                    type="button"
                    className="cv-pro-shape-chip"
                    onClick={() => handleAddQuickZone('box_bottom')}
                  >
                    Box Destaque
                  </button>
                </div>
              </div>

              {/* Zonas Criadas */}
              {(structureConfig.customZones || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                  {structureConfig.customZones!.map(zone => {
                    const isSelected = selectedZoneId === zone.id
                    return (
                      <div
                        key={zone.id}
                        className={`cv-pro-layer-row ${isSelected ? 'cv-pro-btn--active' : ''}`}
                        onClick={() => handleSelectZone(zone.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '2px',
                              backgroundColor: zone.backgroundColor || '#1e293b',
                              border: '1px solid var(--cv-pro-border)',
                              flexShrink: 0
                            }}
                          />
                          <span className="cv-pro-layer-row__primary">{zone.label}</span>
                        </div>
                        <button
                          type="button"
                          className="cv-pro-btn"
                          style={{ padding: '0.15rem 0.35rem', color: '#f87171' }}
                          onClick={e => {
                            e.stopPropagation()
                            handleDeleteZone(zone.id)
                          }}
                          title="Excluir zona"
                        >
                          <TrashIcon size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 3. Accordion: Experiência Profissional ── */}
      {data.work && data.work.length > 0 && (
        <div className={`cv-pro-layer-group ${!collapsedSections['work'] ? 'is-open' : ''}`}>
          <div
            className="cv-pro-layer-group__header"
            onClick={() => toggleSectionCollapse('work')}
          >
            <span className="cv-pro-layer-group__title">
              <BriefcaseIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
              <span>Experiência Profissional</span>
              <span className="cv-pro-layer-group__count">{data.work.length}</span>
            </span>
            <div className="cv-pro-layer-group__actions" onClick={e => e.stopPropagation()}>
              {renderTypoButton('work', 'Fonte de toda a seção de Experiências')}
              <button
                type="button"
                className={`cv-pro-eye-btn ${dimensions['work']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('work')}
                title={dimensions['work']?.hidden ? 'Exibir seção' : 'Ocultar seção'}
              >
                {dimensions['work']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
              </button>
              <button
                type="button"
                className="cv-pro-btn"
                style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none' }}
                onClick={() => toggleSectionCollapse('work')}
              >
                {!collapsedSections['work'] ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </button>
            </div>
          </div>
          {renderTypographyPanel('work', 'Seção: Experiência')}

          {!collapsedSections['work'] && (
            <div className="cv-pro-layer-group__content">
              {data.work.map((w, idx) => {
                const itemId = getAtomicItemId('work', w, idx)
                const itemDims = dimensions[itemId] || {}
                const isHidden = Boolean(itemDims.hidden)
                const itemLabel = w.company || w.name || `Empresa ${idx + 1}`
                const itemSub = w.position || 'Cargo'

                if (!matchesFilter(itemLabel, itemSub)) return null

                return (
                  <React.Fragment key={itemId}>
                    <div className={`cv-pro-layer-row ${isHidden ? 'is-dimmed' : ''}`}>
                      <div className="cv-pro-layer-row__handle" title="Camada atômica">
                        <GripVerticalIcon size={12} />
                      </div>
                      <div className="cv-pro-layer-row__info">
                        <span className="cv-pro-layer-row__primary" title={itemLabel}>{itemLabel}</span>
                        <span className="cv-pro-layer-row__secondary" title={itemSub}>{itemSub}</span>
                      </div>
                      <div className="cv-pro-layer-row__actions">
                        <select
                          className="cv-pro-variant-select"
                          value={itemDims.variant || 'card_box'}
                          onChange={e => handleSelectVariant(itemId, e.target.value)}
                        >
                          <option value="card_box">Box Card</option>
                          <option value="timeline">Timeline</option>
                          <option value="minimal">Minimal</option>
                          <option value="ultra_compact">1 Linha A4</option>
                        </select>
                        {renderTypoButton(itemId, `Fonte de ${itemLabel}`)}
                        <button
                          type="button"
                          className={`cv-pro-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                          onClick={() => handleToggleHide(itemId)}
                          title={isHidden ? 'Exibir cargo' : 'Ocultar cargo'}
                        >
                          {isHidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                        </button>
                      </div>
                    </div>
                    {renderTypographyPanel(itemId, itemLabel)}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 4. Accordion: Formação Acadêmica ── */}
      {data.education && data.education.length > 0 && (
        <div className={`cv-pro-layer-group ${!collapsedSections['education'] ? 'is-open' : ''}`}>
          <div
            className="cv-pro-layer-group__header"
            onClick={() => toggleSectionCollapse('education')}
          >
            <span className="cv-pro-layer-group__title">
              <GraduationCapIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
              <span>Formação Acadêmica</span>
              <span className="cv-pro-layer-group__count">{data.education.length}</span>
            </span>
            <div className="cv-pro-layer-group__actions" onClick={e => e.stopPropagation()}>
              {renderTypoButton('education', 'Fonte de Formação')}
              <button
                type="button"
                className={`cv-pro-eye-btn ${dimensions['education']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('education')}
                title={dimensions['education']?.hidden ? 'Exibir seção' : 'Ocultar seção'}
              >
                {dimensions['education']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
              </button>
              <button
                type="button"
                className="cv-pro-btn"
                style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none' }}
                onClick={() => toggleSectionCollapse('education')}
              >
                {!collapsedSections['education'] ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </button>
            </div>
          </div>
          {renderTypographyPanel('education', 'Seção: Formação')}

          {!collapsedSections['education'] && (
            <div className="cv-pro-layer-group__content">
              {data.education.map((ed, idx) => {
                const itemId = getAtomicItemId('education', ed, idx)
                const itemDims = dimensions[itemId] || {}
                const isHidden = Boolean(itemDims.hidden)
                const itemLabel = ed.area || ed.studyType || `Curso ${idx + 1}`
                const itemSub = ed.institution || 'Instituição'

                if (!matchesFilter(itemLabel, itemSub)) return null

                return (
                  <React.Fragment key={itemId}>
                    <div className={`cv-pro-layer-row ${isHidden ? 'is-dimmed' : ''}`}>
                      <div className="cv-pro-layer-row__handle">
                        <GripVerticalIcon size={12} />
                      </div>
                      <div className="cv-pro-layer-row__info">
                        <span className="cv-pro-layer-row__primary" title={itemLabel}>{itemLabel}</span>
                        <span className="cv-pro-layer-row__secondary" title={itemSub}>{itemSub}</span>
                      </div>
                      <div className="cv-pro-layer-row__actions">
                        <select
                          className="cv-pro-variant-select"
                          value={itemDims.variant || 'card_box'}
                          onChange={e => handleSelectVariant(itemId, e.target.value)}
                        >
                          <option value="card_box">Box Card</option>
                          <option value="timeline">Timeline</option>
                          <option value="ultra_compact">1 Linha A4</option>
                        </select>
                        {renderTypoButton(itemId, `Fonte de ${itemLabel}`)}
                        <button
                          type="button"
                          className={`cv-pro-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                          onClick={() => handleToggleHide(itemId)}
                          title={isHidden ? 'Exibir' : 'Ocultar'}
                        >
                          {isHidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                        </button>
                      </div>
                    </div>
                    {renderTypographyPanel(itemId, itemLabel)}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 5. Accordion: Projetos em Destaque ── */}
      {data.projects && data.projects.length > 0 && (
        <div className={`cv-pro-layer-group ${!collapsedSections['projects'] ? 'is-open' : ''}`}>
          <div
            className="cv-pro-layer-group__header"
            onClick={() => toggleSectionCollapse('projects')}
          >
            <span className="cv-pro-layer-group__title">
              <RocketIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
              <span>Projetos em Destaque</span>
              <span className="cv-pro-layer-group__count">{data.projects.length}</span>
            </span>
            <div className="cv-pro-layer-group__actions" onClick={e => e.stopPropagation()}>
              {renderTypoButton('projects', 'Fonte de Projetos')}
              <button
                type="button"
                className={`cv-pro-eye-btn ${dimensions['projects']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('projects')}
                title={dimensions['projects']?.hidden ? 'Exibir seção' : 'Ocultar seção'}
              >
                {dimensions['projects']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
              </button>
              <button
                type="button"
                className="cv-pro-btn"
                style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none' }}
                onClick={() => toggleSectionCollapse('projects')}
              >
                {!collapsedSections['projects'] ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </button>
            </div>
          </div>
          {renderTypographyPanel('projects', 'Seção: Projetos')}

          {!collapsedSections['projects'] && (
            <div className="cv-pro-layer-group__content">
              {data.projects.map((proj, idx) => {
                const itemId = getAtomicItemId('projects', proj, idx)
                const itemDims = dimensions[itemId] || {}
                const isHidden = Boolean(itemDims.hidden)
                const itemLabel = proj.name || `Projeto ${idx + 1}`
                const itemSub = proj.description || 'Descrição'

                if (!matchesFilter(itemLabel, itemSub)) return null

                return (
                  <React.Fragment key={itemId}>
                    <div className={`cv-pro-layer-row ${isHidden ? 'is-dimmed' : ''}`}>
                      <div className="cv-pro-layer-row__handle">
                        <GripVerticalIcon size={12} />
                      </div>
                      <div className="cv-pro-layer-row__info">
                        <span className="cv-pro-layer-row__primary" title={itemLabel}>{itemLabel}</span>
                        <span className="cv-pro-layer-row__secondary" title={itemSub}>{itemSub}</span>
                      </div>
                      <div className="cv-pro-layer-row__actions">
                        <select
                          className="cv-pro-variant-select"
                          value={itemDims.variant || 'card_box'}
                          onChange={e => handleSelectVariant(itemId, e.target.value)}
                        >
                          <option value="card_box">Box Card</option>
                          <option value="minimal">Minimal</option>
                          <option value="ultra_compact">1 Linha A4</option>
                        </select>
                        {renderTypoButton(itemId, `Fonte de ${itemLabel}`)}
                        <button
                          type="button"
                          className={`cv-pro-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                          onClick={() => handleToggleHide(itemId)}
                          title={isHidden ? 'Exibir' : 'Ocultar'}
                        >
                          {isHidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                        </button>
                      </div>
                    </div>
                    {renderTypographyPanel(itemId, itemLabel)}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 6. Accordion: Competências & Grupos ── */}
      {data.skills && data.skills.length > 0 && (
        <div className={`cv-pro-layer-group ${!collapsedSections['skills'] ? 'is-open' : ''}`}>
          <div
            className="cv-pro-layer-group__header"
            onClick={() => toggleSectionCollapse('skills')}
          >
            <span className="cv-pro-layer-group__title">
              <ZapIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
              <span>Competências & Habilidades</span>
              <span className="cv-pro-layer-group__count">{data.skills.length}</span>
            </span>
            <div className="cv-pro-layer-group__actions" onClick={e => e.stopPropagation()}>
              {renderTypoButton('skills', 'Fonte de Competências')}
              <button
                type="button"
                className={`cv-pro-eye-btn ${dimensions['skills']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('skills')}
                title={dimensions['skills']?.hidden ? 'Exibir seção' : 'Ocultar seção'}
              >
                {dimensions['skills']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
              </button>
              <button
                type="button"
                className="cv-pro-btn"
                style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none' }}
                onClick={() => toggleSectionCollapse('skills')}
              >
                {!collapsedSections['skills'] ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </button>
            </div>
          </div>
          {renderTypographyPanel('skills', 'Seção: Competências')}

          {!collapsedSections['skills'] && (
            <div className="cv-pro-layer-group__content">
              {data.skills.map((sk, idx) => {
                const itemId = getAtomicItemId('skills', sk, idx)
                const itemDims = dimensions[itemId] || {}
                const isHidden = Boolean(itemDims.hidden)
                const itemLabel = sk.name || `Grupo ${idx + 1}`
                const itemSub = Array.isArray(sk.keywords) ? `${sk.keywords.length} itens` : 'Habilidades'

                if (!matchesFilter(itemLabel, itemSub)) return null

                return (
                  <React.Fragment key={itemId}>
                    <div className={`cv-pro-layer-row ${isHidden ? 'is-dimmed' : ''}`}>
                      <div className="cv-pro-layer-row__handle">
                        <GripVerticalIcon size={12} />
                      </div>
                      <div className="cv-pro-layer-row__info">
                        <span className="cv-pro-layer-row__primary" title={itemLabel}>{itemLabel}</span>
                        <span className="cv-pro-layer-row__secondary">{itemSub}</span>
                      </div>
                      <div className="cv-pro-layer-row__actions">
                        <select
                          className="cv-pro-variant-select"
                          value={itemDims.variant || 'pills'}
                          onChange={e => handleSelectVariant(itemId, e.target.value)}
                        >
                          <option value="pills">Pílulas / Badges</option>
                          <option value="grid">Grade 2 Col</option>
                          <option value="bars">Barras Nível</option>
                          <option value="minimal">Minimal</option>
                        </select>
                        {renderTypoButton(itemId, `Fonte de ${itemLabel}`)}
                        <button
                          type="button"
                          className={`cv-pro-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                          onClick={() => handleToggleHide(itemId)}
                          title={isHidden ? 'Exibir' : 'Ocultar'}
                        >
                          {isHidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                        </button>
                      </div>
                    </div>
                    {renderTypographyPanel(itemId, itemLabel)}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 7. Accordion: Idiomas ── */}
      {data.languages && data.languages.length > 0 && (
        <div className={`cv-pro-layer-group ${!collapsedSections['languages'] ? 'is-open' : ''}`}>
          <div
            className="cv-pro-layer-group__header"
            onClick={() => toggleSectionCollapse('languages')}
          >
            <span className="cv-pro-layer-group__title">
              <GlobeIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
              <span>Idiomas</span>
              <span className="cv-pro-layer-group__count">{data.languages.length}</span>
            </span>
            <div className="cv-pro-layer-group__actions" onClick={e => e.stopPropagation()}>
              {renderTypoButton('languages', 'Fonte de Idiomas')}
              <button
                type="button"
                className={`cv-pro-eye-btn ${dimensions['languages']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('languages')}
                title={dimensions['languages']?.hidden ? 'Exibir seção' : 'Ocultar seção'}
              >
                {dimensions['languages']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
              </button>
              <button
                type="button"
                className="cv-pro-btn"
                style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none' }}
                onClick={() => toggleSectionCollapse('languages')}
              >
                {!collapsedSections['languages'] ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </button>
            </div>
          </div>
          {renderTypographyPanel('languages', 'Seção: Idiomas')}

          {!collapsedSections['languages'] && (
            <div className="cv-pro-layer-group__content">
              {data.languages.map((lang, idx) => {
                const itemId = getAtomicItemId('languages', lang, idx)
                const itemDims = dimensions[itemId] || {}
                const isHidden = Boolean(itemDims.hidden)
                const itemLabel = lang.language || `Idioma ${idx + 1}`
                const itemSub = lang.fluency || 'Fluência'

                if (!matchesFilter(itemLabel, itemSub)) return null

                return (
                  <React.Fragment key={itemId}>
                    <div className={`cv-pro-layer-row ${isHidden ? 'is-dimmed' : ''}`}>
                      <div className="cv-pro-layer-row__handle">
                        <GripVerticalIcon size={12} />
                      </div>
                      <div className="cv-pro-layer-row__info">
                        <span className="cv-pro-layer-row__primary" title={itemLabel}>{itemLabel}</span>
                        <span className="cv-pro-layer-row__secondary">{itemSub}</span>
                      </div>
                      <div className="cv-pro-layer-row__actions">
                        <select
                          className="cv-pro-variant-select"
                          value={itemDims.variant || 'pills'}
                          onChange={e => handleSelectVariant(itemId, e.target.value)}
                        >
                          <option value="pills">Pill Badge</option>
                          <option value="dots">Pontos</option>
                          <option value="inline">Linha</option>
                        </select>
                        {renderTypoButton(itemId, `Fonte de ${itemLabel}`)}
                        <button
                          type="button"
                          className={`cv-pro-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                          onClick={() => handleToggleHide(itemId)}
                          title={isHidden ? 'Exibir' : 'Ocultar'}
                        >
                          {isHidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                        </button>
                      </div>
                    </div>
                    {renderTypographyPanel(itemId, itemLabel)}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 8. Accordion: Licenças & Certificações ── */}
      {data.certificates && data.certificates.length > 0 && (
        <div className={`cv-pro-layer-group ${!collapsedSections['certificates'] ? 'is-open' : ''}`}>
          <div
            className="cv-pro-layer-group__header"
            onClick={() => toggleSectionCollapse('certificates')}
          >
            <span className="cv-pro-layer-group__title">
              <AwardIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
              <span>Licenças & Certificações</span>
              <span className="cv-pro-layer-group__count">{data.certificates.length}</span>
            </span>
            <div className="cv-pro-layer-group__actions" onClick={e => e.stopPropagation()}>
              {renderTypoButton('certificates', 'Fonte de Certificações')}
              <button
                type="button"
                className={`cv-pro-eye-btn ${dimensions['certificates']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('certificates')}
                title={dimensions['certificates']?.hidden ? 'Exibir seção' : 'Ocultar seção'}
              >
                {dimensions['certificates']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
              </button>
              <button
                type="button"
                className="cv-pro-btn"
                style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none' }}
                onClick={() => toggleSectionCollapse('certificates')}
              >
                {!collapsedSections['certificates'] ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </button>
            </div>
          </div>
          {renderTypographyPanel('certificates', 'Seção: Certificações')}

          {!collapsedSections['certificates'] && (
            <div className="cv-pro-layer-group__content">
              {data.certificates.map((cert, idx) => {
                const itemId = getAtomicItemId('certificates', cert, idx)
                const itemDims = dimensions[itemId] || {}
                const isHidden = Boolean(itemDims.hidden)
                const itemLabel = cert.name || `Certificado ${idx + 1}`
                const itemSub = cert.issuer || 'Emissor'

                if (!matchesFilter(itemLabel, itemSub)) return null

                return (
                  <React.Fragment key={itemId}>
                    <div className={`cv-pro-layer-row ${isHidden ? 'is-dimmed' : ''}`}>
                      <div className="cv-pro-layer-row__handle">
                        <GripVerticalIcon size={12} />
                      </div>
                      <div className="cv-pro-layer-row__info">
                        <span className="cv-pro-layer-row__primary" title={itemLabel}>{itemLabel}</span>
                        <span className="cv-pro-layer-row__secondary" title={itemSub}>{itemSub}</span>
                      </div>
                      <div className="cv-pro-layer-row__actions">
                        <select
                          className="cv-pro-variant-select"
                          value={itemDims.variant || 'card_box'}
                          onChange={e => handleSelectVariant(itemId, e.target.value)}
                        >
                          <option value="card_box">Box Card</option>
                          <option value="badges">Badge</option>
                          <option value="minimal">Minimal</option>
                        </select>
                        {renderTypoButton(itemId, `Fonte de ${itemLabel}`)}
                        <button
                          type="button"
                          className={`cv-pro-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                          onClick={() => handleToggleHide(itemId)}
                          title={isHidden ? 'Exibir' : 'Ocultar'}
                        >
                          {isHidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                        </button>
                      </div>
                    </div>
                    {renderTypographyPanel(itemId, itemLabel)}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 9. Accordion: Interesses & Pesquisa ── */}
      {data.interests && data.interests.length > 0 && (
        <div className={`cv-pro-layer-group ${!collapsedSections['interests'] ? 'is-open' : ''}`}>
          <div
            className="cv-pro-layer-group__header"
            onClick={() => toggleSectionCollapse('interests')}
          >
            <span className="cv-pro-layer-group__title">
              <BookmarkIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />
              <span>Interesses & Pesquisa</span>
              <span className="cv-pro-layer-group__count">{data.interests.length}</span>
            </span>
            <div className="cv-pro-layer-group__actions" onClick={e => e.stopPropagation()}>
              {renderTypoButton('interests', 'Fonte de Interesses')}
              <button
                type="button"
                className={`cv-pro-eye-btn ${dimensions['interests']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('interests')}
                title={dimensions['interests']?.hidden ? 'Exibir seção' : 'Ocultar seção'}
              >
                {dimensions['interests']?.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
              </button>
              <button
                type="button"
                className="cv-pro-btn"
                style={{ padding: '0.15rem 0.35rem', background: 'transparent', border: 'none' }}
                onClick={() => toggleSectionCollapse('interests')}
              >
                {!collapsedSections['interests'] ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </button>
            </div>
          </div>
          {renderTypographyPanel('interests', 'Seção: Interesses')}

          {!collapsedSections['interests'] && (
            <div className="cv-pro-layer-group__content">
              {data.interests.map((it, idx) => {
                const itemId = getAtomicItemId('interests', it, idx)
                const itemDims = dimensions[itemId] || {}
                const isHidden = Boolean(itemDims.hidden)
                const itemLabel = it.name || `Tópico ${idx + 1}`
                const itemSub = Array.isArray(it.keywords) ? `${it.keywords.length} tópicos` : 'Interesses'

                if (!matchesFilter(itemLabel, itemSub)) return null

                return (
                  <React.Fragment key={itemId}>
                    <div className={`cv-pro-layer-row ${isHidden ? 'is-dimmed' : ''}`}>
                      <div className="cv-pro-layer-row__handle">
                        <GripVerticalIcon size={12} />
                      </div>
                      <div className="cv-pro-layer-row__info">
                        <span className="cv-pro-layer-row__primary" title={itemLabel}>{itemLabel}</span>
                        <span className="cv-pro-layer-row__secondary">{itemSub}</span>
                      </div>
                      <div className="cv-pro-layer-row__actions">
                        <select
                          className="cv-pro-variant-select"
                          value={itemDims.variant || 'pills'}
                          onChange={e => handleSelectVariant(itemId, e.target.value)}
                        >
                          <option value="pills">Pill Badge</option>
                          <option value="inline">Linha</option>
                          <option value="cloud">Nuvem Tags</option>
                        </select>
                        {renderTypoButton(itemId, `Fonte de ${itemLabel}`)}
                        <button
                          type="button"
                          className={`cv-pro-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                          onClick={() => handleToggleHide(itemId)}
                          title={isHidden ? 'Exibir' : 'Ocultar'}
                        >
                          {isHidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
                        </button>
                      </div>
                    </div>
                    {renderTypographyPanel(itemId, itemLabel)}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  )
}
