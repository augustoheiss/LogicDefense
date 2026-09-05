import React from 'react'
import {
  AVAILABLE_BOX_FONTS,
  type CVData,
  type CustomCanvasZone,
  type LayoutStructureConfig,
  type SectionBoxDimensions
} from '../../types/cv'
import { BACKGROUND_CATALOG } from '../../engine/backgroundCatalog'
import { getAtomicItemId } from '../../utils/atomicIdUtils'
import { compressImageFile } from '../../utils/imageCompressor'

interface CanvasElementsPaletteProps {
  data: CVData | null
  structureConfig: LayoutStructureConfig
  onUpdateStructureConfig: (config: LayoutStructureConfig) => void
  onResetStructure: () => void
  onUpdatePhoto?: (photoUrlOrBase64?: string, posX?: number, posY?: number, scale?: number) => void
}

const PHOTO_SHAPES_LIST = [
  { id: 'circle', label: '⚪ Círculo', icon: '⭕' },
  { id: 'square', label: '🔲 Quadrado', icon: '⏹️' },
  { id: 'rounded', label: '🔲 Cantos Suaves', icon: '🔲' },
  { id: 'vertical', label: '📱 Editorial 3:4', icon: '📱' },
  { id: 'pill', label: '💊 Pílula / Oval', icon: '💊' },
  { id: 'hexagon', label: '⬡ Hexágono', icon: '⬡' },
  { id: 'diamond', label: '💎 Losango', icon: '💎' },
  { id: 'shield', label: '🛡️ Brasão', icon: '🛡️' },
  { id: 'octagon', label: '🛑 Octógono', icon: '🛑' },
  { id: 'teardrop', label: '💧 Gota', icon: '💧' },
  { id: 'editorial_stamp', label: '📰 Selo Stamp', icon: '📰' },
] as const

export const CanvasElementsPalette: React.FC<CanvasElementsPaletteProps> = ({
  data,
  structureConfig,
  onUpdateStructureConfig,
  onResetStructure,
  onUpdatePhoto
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [urlInputValue, setUrlInputValue] = React.useState<string>('')
  const [isPhotoControlsOpen, setIsPhotoControlsOpen] = React.useState<boolean>(true)
  const [openTypoId, setOpenTypoId] = React.useState<string | null>(null)
  const [selectedZoneId, setSelectedZoneId] = React.useState<string | null>(null)
  const [activeDrawingMode, setActiveDrawingMode] = React.useState<'rect' | 'polygon' | null>(null)

  React.useEffect(() => {
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
  const activeAlign = photoDims.alignment || photoDims.photoAlign || 'center'
  const activeScale = photoDims.photoScale ?? data.basics.imageScale ?? 1.0
  const activePosX = photoDims.photoPosX ?? data.basics.imagePosX ?? 50
  const activePosY = photoDims.photoPosY ?? data.basics.imagePosY ?? 50

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
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).')
      return
    }
    try {
      // Comprime a foto de perfil client-side (max 800x800, qualidade 0.85) para caber sem peso no storage (< 80KB)
      const compressedBase64 = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.85 })
      if (onUpdatePhoto) {
        onUpdatePhoto(compressedBase64, activePosX, activePosY, activeScale)
      }
      handleUpdatePhotoDimensions({ hidden: false })
    } catch (err) {
      console.error('Falha ao processar foto de perfil:', err)
      alert('Não foi possível processar a imagem. Escolha outro arquivo.')
    }
  }

  const handleApplyUrl = () => {
    if (!urlInputValue.trim()) return
    if (onUpdatePhoto) {
      onUpdatePhoto(urlInputValue.trim(), activePosX, activePosY, activeScale)
      handleUpdatePhotoDimensions({ hidden: false })
      setUrlInputValue('')
    }
  }

  const handleRemovePhoto = () => {
    if (window.confirm('Deseja remover a foto de perfil do currículo?')) {
      if (onUpdatePhoto) {
        onUpdatePhoto(undefined)
      }
    }
  }

  // Alterna visibilidade (ocultar / exibir) de um bloco ou item atômico
  const handleToggleHide = (key: string) => {
    const cur = dimensions[key] || {}
    const nextHidden = !cur.hidden
    onUpdateStructureConfig({
      ...structureConfig,
      sectionDimensions: {
        ...dimensions,
        [key]: {
          ...cur,
          hidden: nextHidden
        }
      }
    })
  }

  // Altera a variante visual de um bloco
  const handleSelectVariant = (key: string, variantId: string) => {
    const cur = dimensions[key] || {}
    onUpdateStructureConfig({
      ...structureConfig,
      sectionDimensions: {
        ...dimensions,
        [key]: {
          ...cur,
          variant: variantId
        }
      }
    })
  }

  // Atualiza propriedades parciais de dimensões de qualquer bloco ou item atômico
  const handleUpdateSectionDimensions = (key: string, updates: Partial<SectionBoxDimensions>) => {
    const cur = dimensions[key] || {}
    const titleKey = `${key}_title`
    const curTitle = dimensions[titleKey] || {}

    // Sincroniza também o box de título correspondente no canvas caso seja categoria geral
    const extraUpdates: Record<string, SectionBoxDimensions> = {}
    if (['work', 'education', 'projects', 'languages', 'skills', 'certificates', 'interests', 'references', 'awards', 'volunteer'].includes(key)) {
      extraUpdates[titleKey] = {
        ...curTitle,
        ...updates
      }
    }

    onUpdateStructureConfig({
      ...structureConfig,
      sectionDimensions: {
        ...dimensions,
        [key]: {
          ...cur,
          ...updates
        },
        ...extraUpdates
      }
    })
  }

  const handleSelectFontFamily = (key: string, fontVal: string) => {
    handleUpdateSectionDimensions(key, {
      fontFamily: fontVal === 'inherit' ? undefined : fontVal
    })
  }

  const handleSetFontScale = (key: string, scale: number) => {
    const clamped = Math.round(Math.min(1.4, Math.max(0.7, scale)) * 100) / 100
    handleUpdateSectionDimensions(key, {
      fontSizeScale: clamped === 1 ? undefined : clamped
    })
  }

  const handleAdjustFontScale = (key: string, delta: number) => {
    const curScale = dimensions[key]?.fontSizeScale ?? 1.0
    handleSetFontScale(key, curScale + delta)
  }

  const renderTypoButton = (key: string, tooltip = 'Ajustar fonte e tamanho da letra') => {
    const curDims = dimensions[key] || {}
    const hasCustom = Boolean(curDims.fontSizeScale || curDims.fontFamily)
    const isOpen = openTypoId === key

    return (
      <button
        type="button"
        className={`cv-palette-typo-btn ${hasCustom ? 'is-custom' : ''} ${isOpen ? 'is-open' : ''}`}
        onClick={() => setOpenTypoId(isOpen ? null : key)}
        title={hasCustom ? 'Tipografia personalizada ativa - Clique para editar' : tooltip}
      >
        🔤
      </button>
    )
  }

  const renderTypographyPanel = (key: string, itemLabel?: string) => {
    if (openTypoId !== key) return null
    const curDims = dimensions[key] || {}
    const activeFont = curDims.fontFamily || 'inherit'
    const activeScale = curDims.fontSizeScale ?? 1.0
    const activePercent = Math.round(activeScale * 100)

    return (
      <div className="cv-palette-typo-panel">
        <div className="cv-palette-typo-header">
          <span title={itemLabel || key}>
            🔤 {itemLabel ? `Tipografia: ${itemLabel}` : 'Tipografia & Escala'}
          </span>
          <button
            type="button"
            className="cv-palette-typo-close-btn"
            onClick={() => setOpenTypoId(null)}
            title="Fechar controles de tipografia"
          >
            ✕
          </button>
        </div>

        {/* Seletor de Família Tipográfica (Design & Estilo) */}
        <div className="cv-palette-typo-field">
          <label className="cv-palette-typo-label">Tipo de Fonte:</label>
          <select
            className="cv-palette-typo-select"
            value={activeFont}
            onChange={e => handleSelectFontFamily(key, e.target.value)}
          >
            {AVAILABLE_BOX_FONTS.map(f => {
              const fontVal = f.family || 'inherit'
              return (
                <option key={f.id} value={fontVal} style={{ fontFamily: fontVal !== 'inherit' ? fontVal : 'inherit' }}>
                  {f.label}
                </option>
              )
            })}
          </select>
        </div>

        {/* Slider Contínuo de Escala de Fonte com A- e A+ */}
        <div className="cv-palette-typo-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="cv-palette-typo-label">Tamanho da Fonte:</label>
            <span className="cv-palette-typo-badge">{activePercent}%</span>
          </div>
          <div className="cv-palette-typo-slider-row">
            <button
              type="button"
              className="cv-palette-stepper-btn"
              onClick={() => handleAdjustFontScale(key, -0.02)}
              title="Diminuir fonte em 2%"
            >
              A-
            </button>
            <input
              type="range"
              min="0.70"
              max="1.40"
              step="0.02"
              value={activeScale}
              onChange={e => handleSetFontScale(key, parseFloat(e.target.value))}
              className="cv-palette-typo-slider"
              title={`Ajuste contínuo: ${activePercent}%`}
            />
            <button
              type="button"
              className="cv-palette-stepper-btn"
              onClick={() => handleAdjustFontScale(key, 0.02)}
              title="Aumentar fonte em 2%"
            >
              A+
            </button>
          </div>
        </div>

        {/* Reset para Padrão do Tema */}
        {(curDims.fontSizeScale || curDims.fontFamily) && (
          <button
            type="button"
            className="cv-palette-typo-reset-btn"
            onClick={() => handleUpdateSectionDimensions(key, { fontSizeScale: undefined, fontFamily: undefined })}
            title="Restaurar tamanho e tipo de fonte para o padrão do tema global"
          >
            ↺ Restaurar Padrão do Tema
          </button>
        )}
      </div>
    )
  }

  const handleStartDraw = (mode: 'rect' | 'polygon') => {
    if (activeDrawingMode === mode) {
      setActiveDrawingMode(null)
      window.dispatchEvent(new CustomEvent('cv-canvas-cancel-draw'))
    } else {
      setActiveDrawingMode(mode)
      window.dispatchEvent(new CustomEvent('cv-canvas-start-draw', { detail: { mode } }))
    }
  }

  const handleSelectZone = (zoneId: string) => {
    const nextId = selectedZoneId === zoneId ? null : zoneId
    setSelectedZoneId(nextId)
    window.dispatchEvent(new CustomEvent('cv-canvas-select-zone', { detail: { zoneId: nextId } }))
  }

  const handleUpdateZone = (zoneId: string, updates: Partial<CustomCanvasZone>) => {
    const nextZones = (structureConfig.customZones || []).map(z => {
      if (z.id === zoneId) {
        return { ...z, ...updates }
      }
      return z
    })
    onUpdateStructureConfig({
      ...structureConfig,
      customZones: nextZones
    })
  }

  const handleDeleteZone = (zoneId: string) => {
    const nextZones = (structureConfig.customZones || []).filter(z => z.id !== zoneId)
    onUpdateStructureConfig({
      ...structureConfig,
      customZones: nextZones
    })
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null)
      window.dispatchEvent(new CustomEvent('cv-canvas-select-zone', { detail: { zoneId: null } }))
    }
  }

  const handleAddQuickZone = (type: 'sidebar_left' | 'sidebar_right' | 'banner_top' | 'box_bottom') => {
    let newZone: CustomCanvasZone
    const id = `zone_${Date.now()}`
    if (type === 'sidebar_left') {
      newZone = {
        id,
        label: 'Sidebar Esquerda',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 32,
        height: 100,
        backgroundColor: '#0f172a',
        backgroundOpacity: 1,
        borderRadius: 0
      }
    } else if (type === 'sidebar_right') {
      newZone = {
        id,
        label: 'Sidebar Direita',
        shape: 'rect',
        x: 68,
        y: 0,
        width: 32,
        height: 100,
        backgroundColor: '#0f172a',
        backgroundOpacity: 1,
        borderRadius: 0
      }
    } else if (type === 'banner_top') {
      newZone = {
        id,
        label: 'Banner Superior',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 16,
        backgroundColor: '#0f172a',
        backgroundOpacity: 1,
        borderRadius: 0
      }
    } else {
      newZone = {
        id,
        label: 'Box de Destaque',
        shape: 'rect',
        x: 5,
        y: 50,
        width: 45,
        height: 30,
        backgroundColor: 'rgba(30, 41, 59, 0.08)',
        borderColor: '#38bdf8',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 8,
        backgroundOpacity: 1
      }
    }

    const nextZones = [...(structureConfig.customZones || []), newZone]
    onUpdateStructureConfig({
      ...structureConfig,
      customZones: nextZones
    })
    setSelectedZoneId(newZone.id)
    window.dispatchEvent(new CustomEvent('cv-canvas-select-zone', { detail: { zoneId: newZone.id } }))
  }

  // Contagem de itens visíveis vs ocultos
  const totalHidden = Object.values(dimensions).filter(d => d.hidden).length

  return (
    <div className="cv-elements-palette">
      {/* Input invisível para upload de arquivo local */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Cabeçalho da Paleta */}
      <div className="cv-elements-palette__header">
        <div>
          <h4 className="cv-elements-palette__title">🎨 Elementos do Canvas</h4>
          <span className="cv-elements-palette__subtitle">
            Personalize variantes, visibilidade e ordem dos blocos
          </span>
        </div>
        <button
          type="button"
          className="cv-elements-palette__reset-btn"
          onClick={onResetStructure}
          title="Redefinir todas as alterações estruturais para o padrão do modelo"
        >
          ↺ Restaurar
        </button>
      </div>

      {totalHidden > 0 && (
        <div className="cv-elements-palette__alert">
          <span>👁️‍🗨️ {totalHidden} {totalHidden === 1 ? 'item ocultado' : 'itens ocultados'} da folha A4</span>
        </div>
      )}

      {/* Lista de Categorias & Itens Atômicos */}
      <div className="cv-elements-palette__sections">
        
        {/* ── Seção: Zonas, Sidebars & Boxes de Fundo (Canvas Livre) ── */}
        <div className="cv-palette-group cv-palette-zones-section">
          <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📐 Zonas, Sidebars & Boxes de Fundo</span>
            {(structureConfig.customZones || []).length > 0 && (
              <span className="cv-zones-counter-badge">
                {(structureConfig.customZones || []).length} {(structureConfig.customZones || []).length === 1 ? 'área' : 'áreas'}
              </span>
            )}
          </div>

          <div style={{ padding: '0.5rem 0.75rem 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Desenhe setores de destaque, sidebars coloridas ou boxes agrupadas para personalizar o fundo de qualquer layout:
            </p>

            {/* Botões de Ação de Desenho */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <button
                type="button"
                className={`cv-draw-mode-btn ${activeDrawingMode === 'rect' ? 'is-active' : ''}`}
                onClick={() => handleStartDraw('rect')}
                title="Clique e arraste com o mouse sobre o currículo para criar um retângulo ou sidebar"
              >
                <span>🖱️</span>
                <span>{activeDrawingMode === 'rect' ? 'Desenhando...' : 'Desenhar Box'}</span>
              </button>

              <button
                type="button"
                className={`cv-draw-mode-btn ${activeDrawingMode === 'polygon' ? 'is-active' : ''}`}
                onClick={() => handleStartDraw('polygon')}
                title="Clique para marcar vértices retos e duplo-clique para fechar a forma"
              >
                <span>📐</span>
                <span>{activeDrawingMode === 'polygon' ? 'Marcando...' : 'Polígono'}</span>
              </button>
            </div>

            {activeDrawingMode && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid #38bdf8', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>
                  Modo desenho ativo na folha!
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawingMode(null)
                    window.dispatchEvent(new CustomEvent('cv-canvas-cancel-draw'))
                  }}
                  style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline' }}
                >
                  Cancelar (Esc)
                </button>
              </div>
            )}

            {/* Atalhos de 1 Clique */}
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                Atalhos Rápidos:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="cv-quick-zone-btn"
                  onClick={() => handleAddQuickZone('sidebar_left')}
                  title="Criar sidebar vertical à esquerda (32% de largura)"
                >
                  📑 Sidebar Esq (32%)
                </button>
                <button
                  type="button"
                  className="cv-quick-zone-btn"
                  onClick={() => handleAddQuickZone('sidebar_right')}
                  title="Criar sidebar vertical à direita (32% de largura)"
                >
                  📑 Sidebar Dir (32%)
                </button>
                <button
                  type="button"
                  className="cv-quick-zone-btn"
                  onClick={() => handleAddQuickZone('banner_top')}
                  title="Criar banner superior horizontal (16% de altura)"
                >
                  🖼️ Banner Topo (16%)
                </button>
                <button
                  type="button"
                  className="cv-quick-zone-btn"
                  onClick={() => handleAddQuickZone('box_bottom')}
                  title="Criar box de destaque com fundo suave"
                >
                  🔲 Box Destaque
                </button>
              </div>
            </div>

            {/* Lista de Zonas Existentes */}
            {(structureConfig.customZones || []).length > 0 && (
              <div style={{ marginTop: '0.4rem', borderTop: '1px solid #1e293b', paddingTop: '0.5rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                  Zonas Criadas ({structureConfig.customZones!.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {structureConfig.customZones!.map(zone => {
                    const isSelected = selectedZoneId === zone.id
                    return (
                      <div
                        key={zone.id}
                        className={`cv-palette-zone-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleSelectZone(zone.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                          <span
                            className="cv-zone-color-chip"
                            style={{
                              backgroundColor: zone.backgroundColor || '#1e293b',
                              opacity: zone.backgroundOpacity ?? 1
                            }}
                          />
                          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {zone.shape === 'polygon' ? '📐' : '🔲'} {zone.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <button
                            type="button"
                            className="cv-zone-item-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteZone(zone.id)
                            }}
                            title="Excluir zona"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Inspector da Zona Ativa */}
            {selectedZoneId && (() => {
              const zone = (structureConfig.customZones || []).find(z => z.id === selectedZoneId)
              if (!zone) return null

              const ZONE_COLORS = [
                { name: 'Navy', hex: '#0f172a' },
                { name: 'Slate', hex: '#1e293b' },
                { name: 'Zinc', hex: '#27272a' },
                { name: 'Warm Charcoal', hex: '#292524' },
                { name: 'Ocean', hex: '#0284c7' },
                { name: 'Emerald', hex: '#064e3b' },
                { name: 'Burgundy', hex: '#4c0519' },
                { name: 'Light Slate', hex: '#f1f5f9' },
                { name: 'White', hex: '#ffffff' }
              ]

              return (
                <div className="cv-zone-inspector-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.35rem' }}>
                    <strong style={{ fontSize: '0.76rem', color: '#38bdf8' }}>
                      ⚙️ Editar: {zone.label}
                    </strong>
                    <button
                      type="button"
                      onClick={() => handleSelectZone(zone.id)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.7rem' }}
                    >
                      ✕ Fechar
                    </button>
                  </div>

                  {/* Nome da Zona */}
                  <div style={{ marginBottom: '0.45rem' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                      Rótulo / Nome:
                    </label>
                    <input
                      type="text"
                      className="cv-zone-text-input"
                      value={zone.label}
                      onChange={(e) => handleUpdateZone(zone.id, { label: e.target.value })}
                    />
                  </div>

                  {/* Cor de Fundo */}
                  <div style={{ marginBottom: '0.45rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Cor de Fundo:</label>
                      <input
                        type="color"
                        value={zone.backgroundColor?.startsWith('#') ? zone.backgroundColor : '#1e293b'}
                        onChange={(e) => handleUpdateZone(zone.id, { backgroundColor: e.target.value })}
                        style={{ width: '24px', height: '20px', padding: 0, border: 'none', cursor: 'pointer', background: 'transparent' }}
                      />
                    </div>
                    {/* Swatches Rápidos */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {ZONE_COLORS.map(c => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => handleUpdateZone(zone.id, { backgroundColor: c.hex })}
                          title={c.name}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '3px',
                            backgroundColor: c.hex,
                            border: zone.backgroundColor === c.hex ? '2px solid #38bdf8' : '1px solid #475569',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Opacidade de Fundo */}
                  <div style={{ marginBottom: '0.45rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                      <span>Opacidade:</span>
                      <strong style={{ color: '#f8fafc' }}>{Math.round((zone.backgroundOpacity ?? 1) * 100)}%</strong>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={zone.backgroundOpacity ?? 1}
                      onChange={(e) => handleUpdateZone(zone.id, { backgroundOpacity: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#38bdf8' }}
                    />
                  </div>

                  {/* Textura IA / Background Catalog */}
                  <div style={{ marginBottom: '0.45rem' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                      Textura / Imagem IA:
                    </label>
                    <select
                      className="cv-zone-select-input"
                      value={zone.backgroundImage || 'none'}
                      onChange={(e) => handleUpdateZone(zone.id, { backgroundImage: e.target.value === 'none' ? undefined : e.target.value })}
                    >
                      <option value="none">Nenhuma (Cor Lisa Sólida)</option>
                      {BACKGROUND_CATALOG.filter(b => b.id !== 'none').map(bg => (
                        <option key={bg.id} value={bg.url}>
                          {bg.name} ({bg.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Borda e Cantos (somente para retângulos) */}
                  {zone.shape === 'rect' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.45rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                          Borda:
                        </label>
                        <select
                          className="cv-zone-select-input"
                          value={zone.borderStyle || 'none'}
                          onChange={(e) => handleUpdateZone(zone.id, {
                            borderStyle: e.target.value as any,
                            borderWidth: e.target.value === 'none' ? 0 : (zone.borderWidth || 1),
                            borderColor: zone.borderColor || '#38bdf8'
                          })}
                        >
                          <option value="none">Sem Borda</option>
                          <option value="solid">Sólida</option>
                          <option value="dashed">Tracejada</option>
                          <option value="dotted">Pontilhada</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                          Cantos (Radius):
                        </label>
                        <select
                          className="cv-zone-select-input"
                          value={zone.borderRadius ?? 0}
                          onChange={(e) => handleUpdateZone(zone.id, { borderRadius: parseInt(e.target.value) })}
                        >
                          <option value={0}>Reto (0px)</option>
                          <option value={4}>Suave (4px)</option>
                          <option value={8}>Médio (8px)</option>
                          <option value={16}>Arredondado (16px)</option>
                          <option value={24}>Curvo (24px)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Botão de Excluir */}
                  <button
                    type="button"
                    className="cv-zone-delete-btn"
                    onClick={() => handleDeleteZone(zone.id)}
                  >
                    🗑️ Excluir esta Área
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
        
        {/* ── Categoria: Identidade & Foto com Edição Total ── */}
        <div className="cv-palette-group">
          <div className="cv-palette-group__title">👤 Identidade & Foto</div>

          <div className="cv-palette-item">
            <div className="cv-palette-item__info">
              <span className="cv-palette-item__icon">🏷️</span>
              <span className="cv-palette-item__name">Nome & Título</span>
            </div>
            <div className="cv-palette-item__actions">
              {renderTypoButton('header', 'Ajustar fonte do Nome & Título')}
              <button
                type="button"
                className={`cv-eye-btn ${dimensions['header']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('header')}
                title={dimensions['header']?.hidden ? 'Exibir na folha' : 'Ocultar da folha'}
              >
                {dimensions['header']?.hidden ? '👁️‍🗨️ Oculto' : '👁️ Visível'}
              </button>
            </div>
          </div>
          {renderTypographyPanel('header', 'Nome & Título')}

          {/* Módulo Centralizado de Foto de Perfil */}
          <div className="cv-palette-photo-card" style={{ background: '#090e1a', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.75rem', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1rem' }}>📷</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>Foto de Perfil</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  className={`cv-eye-btn ${dimensions['photo']?.hidden ? 'is-hidden' : ''}`}
                  onClick={() => handleToggleHide('photo')}
                  title={dimensions['photo']?.hidden ? 'Exibir foto no currículo' : 'Ocultar foto do currículo'}
                  style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}
                >
                  {dimensions['photo']?.hidden ? '👁️‍🗨️ Oculta' : '👁️ Visível'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPhotoControlsOpen(!isPhotoControlsOpen)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem' }}
                  title={isPhotoControlsOpen ? 'Recolher controles' : 'Expandir controles'}
                >
                  {isPhotoControlsOpen ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {/* Ações de Upload / URL / Remoção */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    background: '#0284c7',
                    color: '#ffffff',
                    border: '1px solid #38bdf8',
                    borderRadius: '6px',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem'
                  }}
                  title="Carregar imagem do seu computador ou celular"
                >
                  <span>📁</span> {data.basics.image ? 'Trocar Foto' : 'Carregar Foto'}
                </button>
                {data.basics.image && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Remover foto do currículo"
                  >
                    🗑️
                  </button>
                )}
              </div>

              {/* Campo para colar URL direta */}
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <input
                  type="text"
                  placeholder="Ou cole a URL da foto..."
                  value={urlInputValue}
                  onChange={e => setUrlInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleApplyUrl() }}
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0',
                    fontSize: '0.72rem',
                    padding: '0.3rem 0.5rem',
                    borderRadius: '4px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  disabled={!urlInputValue.trim()}
                  style={{
                    background: urlInputValue.trim() ? '#1e293b' : '#0f172a',
                    color: urlInputValue.trim() ? '#38bdf8' : '#64748b',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.72rem',
                    cursor: urlInputValue.trim() ? 'pointer' : 'default',
                    fontWeight: 600
                  }}
                >
                  OK
                </button>
              </div>
            </div>

            {/* Painel Avançado de Molduras, Tamanho e Polígonos */}
            {isPhotoControlsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem', borderTop: '1px solid #1e293b', paddingTop: '0.65rem' }}>
                
                {/* 1. Grade de Formas & Polígonos */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>
                      📐 Formato & Polígono
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>
                      {PHOTO_SHAPES_LIST.find(s => s.id === activeShape)?.label || '⚪ Círculo'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.3rem' }}>
                    {PHOTO_SHAPES_LIST.map(shape => {
                      const isSel = activeShape === shape.id
                      return (
                        <button
                          key={shape.id}
                          type="button"
                          onClick={() => handleUpdatePhotoDimensions({ photoShape: shape.id as any, variant: shape.id })}
                          style={{
                            padding: '0.35rem 0.25rem',
                            background: isSel ? 'rgba(2, 132, 199, 0.35)' : '#0f172a',
                            color: isSel ? '#38bdf8' : '#94a3b8',
                            border: isSel ? '1.5px solid #38bdf8' : '1px solid #1e293b',
                            borderRadius: '5px',
                            fontSize: '0.68rem',
                            fontWeight: isSel ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={`Selecionar moldura ${shape.label}`}
                        >
                          {shape.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Slider Contínuo de Tamanho Real em Pixels */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>
                      📏 Tamanho Real
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 800, background: 'rgba(16,185,129,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {activeSize} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="220"
                    step="5"
                    value={activeSize}
                    onChange={e => handleUpdatePhotoDimensions({ photoSize: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', accentColor: '#10b981', marginTop: '0.35rem', cursor: 'pointer' }}
                  />
                </div>

                {/* 3. Alinhamento na Coluna */}
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>
                    ↔️ Alinhamento
                  </span>
                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                    {(['left', 'center', 'right'] as const).map(align => {
                      const isSel = activeAlign === align
                      const labels = { left: '⬅️ Esq', center: '⏺️ Centro', right: '➡️ Dir' }
                      return (
                        <button
                          key={align}
                          type="button"
                          onClick={() => handleUpdatePhotoDimensions({ alignment: align, photoAlign: align })}
                          style={{
                            flex: 1,
                            padding: '0.3rem',
                            background: isSel ? '#0284c7' : '#0f172a',
                            color: isSel ? '#ffffff' : '#94a3b8',
                            border: isSel ? '1px solid #38bdf8' : '1px solid #1e293b',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {labels[align]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 4. Bordas e Sombra */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>
                      🔘 Espessura da Borda
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                      {activeBorderWidth === 0 ? 'Sem borda' : `${activeBorderWidth}px`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[0, 1, 2, 3, 4].map(bw => (
                      <button
                        key={bw}
                        type="button"
                        onClick={() => handleUpdatePhotoDimensions({ photoBorderWidth: bw })}
                        style={{
                          flex: 1,
                          padding: '0.25rem 0',
                          background: activeBorderWidth === bw ? '#0284c7' : '#0f172a',
                          color: activeBorderWidth === bw ? '#ffffff' : '#94a3b8',
                          border: '1px solid #1e293b',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {bw === 0 ? '0' : `${bw}px`}
                      </button>
                    ))}
                  </div>

                  {/* Cores Rápidas de Borda */}
                  {activeBorderWidth > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Cor:</span>
                      {['#0284c7', '#10b981', '#f97316', '#a855f7', '#ffffff', '#0f172a'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleUpdatePhotoDimensions({ photoBorderColor: c })}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: c,
                            border: activeBorderColor === c ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer'
                          }}
                          title={`Cor da borda: ${c}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Toggle Sombra */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Sombra Suave</span>
                    <button
                      type="button"
                      onClick={() => handleUpdatePhotoDimensions({ photoShadow: !activeShadow })}
                      style={{
                        padding: '0.2rem 0.5rem',
                        background: activeShadow ? 'rgba(16, 185, 129, 0.2)' : '#0f172a',
                        color: activeShadow ? '#34d399' : '#64748b',
                        border: activeShadow ? '1px solid #10b981' : '1px solid #334155',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {activeShadow ? '✓ Ativa' : 'Desativada'}
                    </button>
                  </div>
                </div>

                {/* 5. Enquadramento e Zoom */}
                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>
                    🎯 Zoom & Enquadramento Facial
                  </span>
                  
                  {/* Slider de Zoom */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
                      <span>Zoom / Escala</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>{activeScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="2.5"
                      step="0.05"
                      value={activeScale}
                      onChange={e => {
                        const nextScale = parseFloat(e.target.value)
                        handleUpdatePhotoDimensions({ photoScale: nextScale })
                        if (onUpdatePhoto) {
                          onUpdatePhoto(data.basics.image, activePosX, activePosY, nextScale)
                        }
                      }}
                      style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Sliders X e Y */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
                        <span>Pan X</span>
                        <span>{activePosX}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="2"
                        value={activePosX}
                        onChange={e => {
                          const nextX = parseInt(e.target.value, 10)
                          handleUpdatePhotoDimensions({ photoPosX: nextX })
                          if (onUpdatePhoto) {
                            onUpdatePhoto(data.basics.image, nextX, activePosY, activeScale)
                          }
                        }}
                        style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
                        <span>Pan Y</span>
                        <span>{activePosY}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="2"
                        value={activePosY}
                        onChange={e => {
                          const nextY = parseInt(e.target.value, 10)
                          handleUpdatePhotoDimensions({ photoPosY: nextY })
                          if (onUpdatePhoto) {
                            onUpdatePhoto(data.basics.image, activePosX, nextY, activeScale)
                          }
                        }}
                        style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          <div className="cv-palette-item">
            <div className="cv-palette-item__info">
              <span className="cv-palette-item__icon">📞</span>
              <span className="cv-palette-item__name">Contatos & Redes</span>
            </div>
            <div className="cv-palette-item__actions">
              {renderTypoButton('contacts', 'Ajustar fonte dos Contatos')}
              <button
                type="button"
                className={`cv-eye-btn ${dimensions['contacts']?.hidden ? 'is-hidden' : ''}`}
                onClick={() => handleToggleHide('contacts')}
                title={dimensions['contacts']?.hidden ? 'Exibir contatos' : 'Ocultar contatos'}
              >
                {dimensions['contacts']?.hidden ? '👁️‍🗨️ Oculto' : '👁️ Visível'}
              </button>
            </div>
          </div>
          {renderTypographyPanel('contacts', 'Contatos & Redes')}

          {(data.basics.driverLicense || data.basics.nationality || data.basics.age || data.basics.civilStatus) && (
            <>
              <div className="cv-palette-item">
                <div className="cv-palette-item__info">
                  <span className="cv-palette-item__icon">🪪</span>
                  <span className="cv-palette-item__name">Dados Civis</span>
                </div>
                <div className="cv-palette-item__actions">
                  {renderTypoButton('civil', 'Ajustar fonte dos Dados Civis')}
                  <button
                    type="button"
                    className={`cv-eye-btn ${dimensions['civil']?.hidden ? 'is-hidden' : ''}`}
                    onClick={() => handleToggleHide('civil')}
                    title={dimensions['civil']?.hidden ? 'Exibir dados civis' : 'Ocultar dados civis'}
                  >
                    {dimensions['civil']?.hidden ? '👁️‍🗨️ Oculto' : '👁️ Visível'}
                  </button>
                </div>
              </div>
              {renderTypographyPanel('civil', 'Dados Civis')}
            </>
          )}

          {data.basics.summary && (
            <>
              <div className="cv-palette-item">
                <div className="cv-palette-item__info">
                  <span className="cv-palette-item__icon">📝</span>
                  <span className="cv-palette-item__name">Sobre Mim / Resumo</span>
                </div>
                <div className="cv-palette-item__actions">
                  {renderTypoButton('summary', 'Ajustar fonte do Resumo')}
                  <button
                    type="button"
                    className={`cv-eye-btn ${dimensions['summary']?.hidden ? 'is-hidden' : ''}`}
                    onClick={() => handleToggleHide('summary')}
                  >
                    {dimensions['summary']?.hidden ? '👁️‍🗨️ Oculto' : '👁️ Visível'}
                  </button>
                </div>
              </div>
              {renderTypographyPanel('summary', 'Sobre Mim / Resumo')}
            </>
          )}
        </div>

        {/* ── Categoria: Experiências Profissionais (Desmembradas Atômicas) ── */}
        {data.work && data.work.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>💼 Experiência Profissional ({data.work.length})</span>
              {renderTypoButton('work', 'Ajustar fonte da seção geral de Experiências')}
            </div>
            {renderTypographyPanel('work', 'Seção Geral: Experiências')}
            {data.work.map((w, idx) => {
              const itemId = getAtomicItemId('work', w, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = w.company || w.name || `Empresa ${idx + 1}`

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">🏢</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        <span className="cv-palette-item__tiny">{w.position || 'Cargo'}</span>
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      <select
                        className="cv-palette-select"
                        value={itemDims.variant || 'card_box'}
                        onChange={e => handleSelectVariant(itemId, e.target.value)}
                        title="Variante de exibição deste cargo"
                      >
                        <option value="card_box">📦 Box Card</option>
                        <option value="timeline">⏱️ Timeline</option>
                        <option value="minimal">📄 Minimal</option>
                        <option value="ultra_compact">📏 1 Linha (A4)</option>
                      </select>
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar cargo'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel(itemId, itemLabel)}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Formação Acadêmica (Desmembrada Atômica) ── */}
        {data.education && data.education.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🎓 Formação Acadêmica ({data.education.length})</span>
              {renderTypoButton('education', 'Ajustar fonte da seção geral de Formação')}
            </div>
            {renderTypographyPanel('education', 'Seção Geral: Formação Acadêmica')}
            {data.education.map((ed, idx) => {
              const itemId = getAtomicItemId('education', ed, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = ed.area || ed.studyType || `Curso ${idx + 1}`

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">🏛️</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        <span className="cv-palette-item__tiny">{ed.institution}</span>
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      <select
                        className="cv-palette-select"
                        value={itemDims.variant || 'card_box'}
                        onChange={e => handleSelectVariant(itemId, e.target.value)}
                        title="Variante de layout desta formação"
                      >
                        <option value="card_box">📦 Box Card</option>
                        <option value="timeline">⏱️ Timeline</option>
                        <option value="ultra_compact">📏 1 Linha (A4)</option>
                      </select>
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar curso'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel(itemId, itemLabel)}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Projetos em Destaque (Desmembrados Atômicos) ── */}
        {data.projects && data.projects.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🚀 Projetos em Destaque ({data.projects.length})</span>
              {renderTypoButton('projects', 'Ajustar fonte da seção geral de Projetos')}
            </div>
            {renderTypographyPanel('projects', 'Seção Geral: Projetos')}
            {data.projects.map((p, idx) => {
              const itemId = getAtomicItemId('projects', p, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = p.name || `Projeto ${idx + 1}`

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">💻</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        {p.url && <span className="cv-palette-item__tiny">🔗 Link ativo</span>}
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      <select
                        className="cv-palette-select"
                        value={itemDims.variant || 'card_box'}
                        onChange={e => handleSelectVariant(itemId, e.target.value)}
                        title="Variante deste projeto"
                      >
                        <option value="card_box">📦 Showcase Box</option>
                        <option value="minimal">📄 Minimal Link</option>
                        <option value="ultra_compact">📏 1 Linha (A4)</option>
                      </select>
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar projeto'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel(itemId, itemLabel)}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Competências & Habilidades (Atômicas) ── */}
        {data.skills && data.skills.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚡ Competências & Grupos ({data.skills.length})</span>
              {renderTypoButton('skills', 'Ajustar fonte da seção geral de Competências')}
            </div>
            {renderTypographyPanel('skills', 'Seção Geral: Competências')}
            {data.skills.map((s, idx) => {
              const itemId = getAtomicItemId('skills', s, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = s.name || `Grupo ${idx + 1}`

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">🎯</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        <span className="cv-palette-item__tiny">{s.keywords?.length || 0} termos</span>
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      <select
                        className="cv-palette-select"
                        value={itemDims.variant || 'badges'}
                        onChange={e => handleSelectVariant(itemId, e.target.value)}
                        title="Variante deste grupo de skills"
                      >
                        <option value="badges">🏷️ Pílulas / Badges</option>
                        <option value="bars">📊 Barras de Nível</option>
                        <option value="minimal">📝 Texto Simples</option>
                      </select>
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar grupo'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel(itemId, itemLabel)}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Idiomas (Atômicos) ── */}
        {data.languages && data.languages.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🌐 Idiomas ({data.languages.length})</span>
              {renderTypoButton('languages', 'Ajustar fonte da seção geral de Idiomas')}
            </div>
            {renderTypographyPanel('languages', 'Seção Geral: Idiomas')}
            {data.languages.map((l, idx) => {
              const itemId = getAtomicItemId('languages', l, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = l.language

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">🗣️</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        <span className="cv-palette-item__tiny">{l.fluency || 'Básico'}</span>
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      <select
                        className="cv-palette-select"
                        value={itemDims.variant || 'pill_badge'}
                        onChange={e => handleSelectVariant(itemId, e.target.value)}
                        title="Variante deste idioma"
                      >
                        <option value="pill_badge">🏷️ Pill Badge</option>
                        <option value="dots">⚪ Pontos (Dots)</option>
                        <option value="minimal">📄 Texto Simples</option>
                      </select>
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar idioma'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel(itemId, itemLabel)}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Licenças & Certificações (Atômicas) ── */}
        {data.certificates && data.certificates.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📜 Licenças & Certificações ({data.certificates.length})</span>
              {renderTypoButton('certificates', 'Ajustar fonte da seção geral de Certificados')}
            </div>
            {renderTypographyPanel('certificates', 'Seção Geral: Certificados')}
            {data.certificates.map((c, idx) => {
              const itemId = getAtomicItemId('certificates', c, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = c.name || `Certificado ${idx + 1}`

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">📜</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        <span className="cv-palette-item__tiny">{c.issuer || c.date || 'Certificação'}</span>
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      <select
                        className="cv-palette-select"
                        value={itemDims.variant || 'card_box'}
                        onChange={e => handleSelectVariant(itemId, e.target.value)}
                        title="Variante visual deste certificado"
                      >
                        <option value="card_box">📦 Box Card</option>
                        <option value="pill_badge">🏷️ Badge Pill</option>
                        <option value="minimal">📄 Linha Simples</option>
                      </select>
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar certificação'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel(itemId, itemLabel)}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Interesses & Pesquisa (Atômicos) ── */}
        {data.interests && data.interests.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>💡 Interesses & Pesquisa ({data.interests.length})</span>
              {renderTypoButton('interests', 'Ajustar fonte da seção geral de Interesses')}
            </div>
            {renderTypographyPanel('interests', 'Seção Geral: Interesses')}
            {data.interests.map((it, idx) => {
              const itemId = getAtomicItemId('interests', it, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = it.name || `Interesse ${idx + 1}`

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">💡</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        <span className="cv-palette-item__tiny">{it.keywords?.length ? `${it.keywords.length} tópicos` : 'Área de interesse'}</span>
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      <select
                        className="cv-palette-select"
                        value={itemDims.variant || 'card_box'}
                        onChange={e => handleSelectVariant(itemId, e.target.value)}
                        title="Variante deste tópico de interesse"
                      >
                        <option value="card_box">📦 Card com Tags</option>
                        <option value="circles">⭕ Círculo Hobbies</option>
                        <option value="minimal">📝 Linha Textual</option>
                      </select>
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar interesse'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel(itemId, itemLabel)}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Referências (Atômicas) ── */}
        {data.references && data.references.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>👥 Referências Profissionais ({data.references.length})</span>
              {renderTypoButton('references', 'Ajustar fonte da seção geral de Referências')}
            </div>
            {renderTypographyPanel('references', 'Seção Geral: Referências')}
            {data.references.map((r, idx) => {
              const itemId = getAtomicItemId('references', r, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = r.name || `Referência ${idx + 1}`

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">👥</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        <span className="cv-palette-item__tiny">{r.company || r.position || r.reference || 'Contato'}</span>
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar referência'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel(itemId, itemLabel)}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Prêmios & Distinções (Se existir no YAML) ── */}
        {data.awards && data.awards.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🏆 Prêmios & Distinções ({data.awards.length})</span>
              {renderTypoButton('awards', 'Ajustar fonte da seção geral de Prêmios')}
            </div>
            {renderTypographyPanel('awards', 'Seção Geral: Prêmios')}
            {data.awards.map((aw, idx) => {
              const itemId = getAtomicItemId('awards', aw, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = aw.title || `Prêmio ${idx + 1}`

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">🏆</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        <span className="cv-palette-item__tiny">{aw.awarder || aw.date || 'Distinção'}</span>
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar prêmio'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
                      </button>
                    </div>
                  </div>
                  {renderTypographyPanel(itemId, itemLabel)}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* ── Categoria: Trabalho Voluntário (Se existir no YAML) ── */}
        {data.volunteer && data.volunteer.length > 0 && (
          <div className="cv-palette-group">
            <div className="cv-palette-group__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🤝 Trabalho Voluntário ({data.volunteer.length})</span>
              {renderTypoButton('volunteer', 'Ajustar fonte da seção geral de Voluntariado')}
            </div>
            {renderTypographyPanel('volunteer', 'Seção Geral: Trabalho Voluntário')}
            {data.volunteer.map((v, idx) => {
              const itemId = getAtomicItemId('volunteer', v, idx)
              const itemDims = dimensions[itemId] || {}
              const isHidden = Boolean(itemDims.hidden)
              const itemLabel = v.organization || `Voluntariado ${idx + 1}`

              return (
                <React.Fragment key={itemId}>
                  <div className={`cv-palette-item cv-palette-item--sub ${isHidden ? 'is-dimmed' : ''}`}>
                    <div className="cv-palette-item__info">
                      <span className="cv-palette-item__icon">🤝</span>
                      <div className="cv-palette-item__texts">
                        <strong className="cv-palette-item__bold">{itemLabel}</strong>
                        <span className="cv-palette-item__tiny">{v.position || 'Voluntário'}</span>
                      </div>
                    </div>
                    <div className="cv-palette-item__actions">
                      {renderTypoButton(itemId, `Ajustar fonte de ${itemLabel}`)}
                      <button
                        type="button"
                        className={`cv-eye-btn ${isHidden ? 'is-hidden' : ''}`}
                        onClick={() => handleToggleHide(itemId)}
                        title={isHidden ? 'Exibir na folha' : 'Ocultar voluntariado'}
                      >
                        {isHidden ? '👁️‍🗨️' : '👁️'}
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
    </div>
  )
}
