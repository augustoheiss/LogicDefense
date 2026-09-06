import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { SectionBoxDimensions } from '../../types/cv'
import { AVAILABLE_BOX_FONTS } from '../../types/cv'

interface StructuralBoxWrapperProps {
  sectionId: string
  title: string
  isFreeCanvasActive: boolean
  dimensions?: SectionBoxDimensions
  canSwitchZone?: boolean
  currentZone?: 'left' | 'right'
  category?: string
  onUpdateDimensions?: (dims: SectionBoxDimensions) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onSwapWithSection?: (targetSectionId: string) => void
  onSwitchZone?: () => void
  onResetDimensions?: () => void
  onToggleHide?: () => void
  onSelectVariant?: (variant: string) => void
  children: React.ReactNode
}

export const StructuralBoxWrapper: React.FC<StructuralBoxWrapperProps> = ({
  sectionId,
  title,
  isFreeCanvasActive,
  dimensions,
  canSwitchZone,
  currentZone,
  category,
  onUpdateDimensions,
  onSwitchZone,
  onResetDimensions,
  onToggleHide,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false)
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const [isMoving, setIsMoving] = useState<boolean>(false)
  const [isSelected, setIsSelected] = useState<boolean>(false)
  const [resizeType, setResizeType] = useState<string | null>(null)
  const [activePopover, setActivePopover] = useState<'position' | 'font' | null>(null)

  // Gerenciamento de foco / seleção ativa global para trazer bloco sobreposto imediatamente para a frente
  useEffect(() => {
    const handleBoxSelected = (e: any) => {
      if (e.detail?.id) {
        setIsSelected(e.detail.id === sectionId)
      }
    }
    window.addEventListener('cv-select-box' as any, handleBoxSelected)
    return () => window.removeEventListener('cv-select-box' as any, handleBoxSelected)
  }, [sectionId])

  // Desseleciona e fecha popover ao clicar fora deste box na folha
  useEffect(() => {
    if (!isSelected && !activePopover) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSelected(false)
        setActivePopover(null)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [isSelected, activePopover])

  // Medição contínua de overflow para evitar estouro da folha A4
  useEffect(() => {
    if (!isFreeCanvasActive) {
      setIsOverflowing(false)
      return
    }

    const contentEl = contentRef.current
    const containerEl = containerRef.current
    if (!contentEl || !containerEl) return

    const checkOverflow = () => {
      const maxHeight = dimensions?.maxHeightPx || dimensions?.minHeightPx
      if (maxHeight && maxHeight > 0) {
        setIsOverflowing(contentEl.scrollHeight > maxHeight + 10)
      } else {
        setIsOverflowing(false)
      }
    }

    checkOverflow()
    const observer = new ResizeObserver(() => checkOverflow())
    observer.observe(contentEl)
    return () => observer.disconnect()
  }, [isFreeCanvasActive, dimensions?.minHeightPx, dimensions?.maxHeightPx, dimensions?.widthPercent])

  // Selecionar box ao clicar nele
  const handleSelectThisBox = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsSelected(true)
    window.dispatchEvent(new CustomEvent('cv-select-box', { detail: { id: sectionId } }))
  }

  // Manipulação contínua de redimensionamento nas 4 bordas e 4 cantos com área ampla de toque/mouse
  const handlePointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    type: 'width' | 'width-left' | 'height' | 'height-top' | 'corner-se' | 'corner-sw' | 'corner-ne' | 'corner-nw'
  ) => {
    e.preventDefault()
    e.stopPropagation()

    // Ao começar a redimensionar, seleciona imediatamente o box
    setIsSelected(true)
    window.dispatchEvent(new CustomEvent('cv-select-box', { detail: { id: sectionId } }))

    const targetEl = e.currentTarget
    targetEl.setPointerCapture(e.pointerId)

    const startX = e.clientX
    const startY = e.clientY
    const currentContainer = containerRef.current
    const startWidth = currentContainer?.getBoundingClientRect().width || 200
    const startHeight = currentContainer?.getBoundingClientRect().height || 100

    const a4Card = currentContainer?.closest('.cv-card') as HTMLElement | null
    const parentContainer = currentContainer?.parentElement as HTMLElement | null
    const baseWidth = a4Card?.clientWidth || parentContainer?.clientWidth || 800

    setIsResizing(true)
    setResizeType(type)

    let latestWidthPercent = dimensions?.widthPercent || 100
    let latestHeightPx = dimensions?.minHeightPx || startHeight

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const deltaX = moveEvt.clientX - startX
      const deltaY = moveEvt.clientY - startY

      // Largura
      if (type === 'width' || type === 'corner-se' || type === 'corner-ne') {
        const newWidthPx = Math.max(40, startWidth + deltaX)
        latestWidthPercent = Math.max(10, Math.min(100, Math.round((newWidthPx / baseWidth) * 100)))
        if (containerRef.current) {
          containerRef.current.style.width = `${latestWidthPercent}%`
          containerRef.current.style.flex = `0 0 ${latestWidthPercent}%`
        }
      } else if (type === 'width-left' || type === 'corner-sw' || type === 'corner-nw') {
        const newWidthPx = Math.max(40, startWidth - deltaX)
        latestWidthPercent = Math.max(10, Math.min(100, Math.round((newWidthPx / baseWidth) * 100)))
        if (containerRef.current) {
          containerRef.current.style.width = `${latestWidthPercent}%`
          containerRef.current.style.flex = `0 0 ${latestWidthPercent}%`
        }
      }

      // Altura
      if (type === 'height' || type === 'corner-se' || type === 'corner-sw') {
        latestHeightPx = Math.max(20, Math.min(1500, Math.round(startHeight + deltaY)))
        if (containerRef.current) {
          containerRef.current.style.minHeight = `${latestHeightPx}px`
          containerRef.current.style.maxHeight = `${latestHeightPx}px`
        }
        if (contentRef.current) {
          contentRef.current.style.maxHeight = `${latestHeightPx}px`
          contentRef.current.style.overflow = 'hidden'
        }
      } else if (type === 'height-top' || type === 'corner-ne' || type === 'corner-nw') {
        latestHeightPx = Math.max(20, Math.min(1500, Math.round(startHeight - deltaY)))
        if (containerRef.current) {
          containerRef.current.style.minHeight = `${latestHeightPx}px`
          containerRef.current.style.maxHeight = `${latestHeightPx}px`
        }
        if (contentRef.current) {
          contentRef.current.style.maxHeight = `${latestHeightPx}px`
          contentRef.current.style.overflow = 'hidden'
        }
      }
    }

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault()
      try {
        targetEl.releasePointerCapture(upEvt.pointerId)
      } catch {
        // Ignora
      }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      setIsResizing(false)
      setResizeType(null)

      onUpdateDimensions?.({
        ...dimensions,
        widthPercent: latestWidthPercent,
        minHeightPx: latestHeightPx,
        maxHeightPx: latestHeightPx
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [dimensions, onUpdateDimensions, sectionId])

  // Manipulação de Arraste 2D Bidimensional pelo Grip da Mini-Toolbar
  const handleMovePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    setIsSelected(true)
    window.dispatchEvent(new CustomEvent('cv-select-box', { detail: { id: sectionId } }))

    const targetEl = e.currentTarget
    targetEl.setPointerCapture(e.pointerId)
    setIsMoving(true)

    const startX = e.clientX
    const startY = e.clientY
    let hasCrossedZone = false

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const deltaX = moveEvt.clientX - startX
      const deltaY = moveEvt.clientY - startY

      if (containerRef.current) {
        containerRef.current.style.transform = `translate(${deltaX}px, ${deltaY}px)`
        containerRef.current.style.zIndex = '130'
        containerRef.current.style.boxShadow = '0 14px 32px rgba(0, 0, 0, 0.45)'
      }

      if (canSwitchZone && onSwitchZone && !hasCrossedZone) {
        if ((currentZone === 'left' && deltaX > 160) || (currentZone === 'right' && deltaX < -160)) {
          hasCrossedZone = true
          onSwitchZone()
        }
      }
    }

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault()
      try {
        targetEl.releasePointerCapture(upEvt.pointerId)
      } catch {
        // Ignora
      }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      const finalDeltaX = upEvt.clientX - startX
      const finalDeltaY = upEvt.clientY - startY

      if (containerRef.current) {
        containerRef.current.style.transform = ''
        containerRef.current.style.zIndex = ''
        containerRef.current.style.boxShadow = ''
      }
      setIsMoving(false)

      if (Math.abs(finalDeltaX) > 3 || Math.abs(finalDeltaY) > 3) {
        const curX = dimensions?.marginLeftPx || 0
        const curY = dimensions?.marginTopPx || 0
        const nextX = Math.round(curX + finalDeltaX)
        const nextY = Math.round(curY + finalDeltaY)

        onUpdateDimensions?.({
          ...dimensions,
          marginLeftPx: nextX,
          marginTopPx: nextY,
          alignment: undefined
        })

        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('cv-box-moved'))
        }, 50)
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [canSwitchZone, currentZone, dimensions, onSwitchZone, onUpdateDimensions, sectionId])

  // Ajuste rápido de margem vertical (Y)
  const handleAdjustMarginY = (delta: number) => {
    const current = dimensions?.marginTopPx || 0
    const next = Math.max(-500, Math.min(1000, current + delta))
    onUpdateDimensions?.({
      ...dimensions,
      marginTopPx: next
    })
  }

  // Ajuste fino de margem / recuo horizontal (X)
  const handleAdjustMarginX = (delta: number) => {
    const current = dimensions?.marginLeftPx || 0
    const next = Math.max(-500, Math.min(1000, current + delta))
    onUpdateDimensions?.({
      ...dimensions,
      marginLeftPx: next,
      alignment: undefined
    })
  }

  // Ajuste de nível de camada (Z-Index) em sobreposição
  const handleAdjustZIndex = (delta: number) => {
    const current = dimensions?.zIndex ?? 0
    const next = Math.max(0, Math.min(50, current + delta))
    onUpdateDimensions?.({
      ...dimensions,
      zIndex: next === 0 ? undefined : next
    })
  }

  // ⤒ Encostar no bloco de cima (elimina vácuo entre este bloco e o anterior)
  const handleSnapToAbove = (e: React.MouseEvent) => {
    e.stopPropagation()
    const el = containerRef.current
    if (!el) return

    let prev = el.previousElementSibling as HTMLElement | null
    while (prev && (prev.offsetParent === null || prev.classList.contains('cv-no-print'))) {
      prev = prev.previousElementSibling as HTMLElement | null
    }

    if (prev) {
      const prevRect = prev.getBoundingClientRect()
      const myRect = el.getBoundingClientRect()
      const visualGap = myRect.top - prevRect.bottom
      const curMarginY = dimensions?.marginTopPx || 0
      const targetMarginY = Math.round(curMarginY - visualGap)

      onUpdateDimensions?.({
        ...dimensions,
        marginTopPx: targetMarginY
      })
    } else {
      onUpdateDimensions?.({
        ...dimensions,
        marginTopPx: 0
      })
    }

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cv-box-moved'))
    }, 50)
  }

  // ⤓ Encostar no bloco de baixo (elimina vácuo entre este bloco e o próximo)
  const handleSnapToBelow = (e: React.MouseEvent) => {
    e.stopPropagation()
    const el = containerRef.current
    if (!el) return

    let next = el.nextElementSibling as HTMLElement | null
    while (next && (next.offsetParent === null || next.classList.contains('cv-no-print'))) {
      next = next.nextElementSibling as HTMLElement | null
    }

    if (next) {
      const nextRect = next.getBoundingClientRect()
      const myRect = el.getBoundingClientRect()
      const visualGap = nextRect.top - myRect.bottom
      const curMarginY = dimensions?.marginTopPx || 0
      const targetMarginY = Math.round(curMarginY + visualGap)

      onUpdateDimensions?.({
        ...dimensions,
        marginTopPx: targetMarginY
      })
    } else {
      onUpdateDimensions?.({
        ...dimensions,
        marginTopPx: 0
      })
    }

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cv-box-moved'))
    }, 50)
  }

  // Alinhamento rápido no plano
  const handleSetAlignment = (alignment: 'left' | 'center' | 'right') => {
    onUpdateDimensions?.({
      ...dimensions,
      alignment,
      marginLeftPx: undefined
    })
  }

  // Ajuste de Família Tipográfica específica do Box
  const handleSelectFontFamily = useCallback((fontFamily: string) => {
    onUpdateDimensions?.({
      ...dimensions,
      fontFamily: fontFamily === 'inherit' ? undefined : fontFamily
    })
  }, [dimensions, onUpdateDimensions])

  // Ajuste de Escala Contínua de Fonte via Botões (A- / A+)
  const handleAdjustFontScale = useCallback((deltaPercent: number) => {
    const curScale = dimensions?.fontSizeScale ?? 1.0
    const curPercent = Math.round(curScale * 100)
    const nextPercent = Math.max(70, Math.min(140, curPercent + deltaPercent))
    const nextScale = Number((nextPercent / 100).toFixed(2))
    onUpdateDimensions?.({
      ...dimensions,
      fontSizeScale: nextScale === 1.0 ? undefined : nextScale
    })
  }, [dimensions, onUpdateDimensions])

  // Ajuste de Escala Contínua de Fonte via Slider (70% a 140%)
  const handleSetFontScaleSlider = useCallback((percentVal: number) => {
    const clampedPercent = Math.max(70, Math.min(140, percentVal))
    const nextScale = Number((clampedPercent / 100).toFixed(2))
    onUpdateDimensions?.({
      ...dimensions,
      fontSizeScale: nextScale === 1.0 ? undefined : nextScale
    })
  }, [dimensions, onUpdateDimensions])

  // Se o item estiver ocultado pelo usuário no Canvas/Paleta, não renderiza
  if (dimensions?.hidden) {
    return null
  }

  // Se o modo Canvas Livre estiver inativo, renderiza puramente o conteúdo sem custo DOM
  if (!isFreeCanvasActive) {
    return <>{children}</>
  }

  const isPhoto = category === 'photo' || sectionId === 'photo'
  const photoSizePx = dimensions?.photoSize ?? 96
  const photoHeightPx = isPhoto && dimensions?.photoShape === 'vertical'
    ? Math.round(photoSizePx * 1.32)
    : photoSizePx

  const widthStyle = dimensions?.widthPercent
    ? `${dimensions.widthPercent}%`
    : isPhoto
      ? `${photoSizePx}px`
      : '100%'

  const heightStyle = dimensions?.maxHeightPx
    ? `${dimensions.maxHeightPx}px`
    : dimensions?.minHeightPx
      ? `${dimensions.minHeightPx}px`
      : isPhoto
        ? `${photoHeightPx}px`
        : undefined

  // Deslocamento 2D no plano livre
  const topStyle = typeof dimensions?.marginTopPx === 'number' && dimensions.marginTopPx !== 0
    ? `${dimensions.marginTopPx}px`
    : undefined

  const leftStyle = !dimensions?.alignment && typeof dimensions?.marginLeftPx === 'number' && dimensions.marginLeftPx !== 0
    ? `${dimensions.marginLeftPx}px`
    : undefined

  const marginLeftStyle = dimensions?.alignment === 'center'
    ? 'auto'
    : dimensions?.alignment === 'right'
      ? 'auto'
      : undefined

  const marginRightStyle = dimensions?.alignment === 'center'
    ? 'auto'
    : dimensions?.alignment === 'right'
      ? '0'
      : undefined

  const fontScaleVal = dimensions?.fontSizeScale ?? 1.0
  const fontPercentVal = Math.round(fontScaleVal * 100)
  const hasCustomizations = Boolean(
    dimensions?.widthPercent ||
    dimensions?.minHeightPx ||
    dimensions?.marginTopPx ||
    dimensions?.marginLeftPx ||
    dimensions?.alignment ||
    dimensions?.variant ||
    dimensions?.fontFamily ||
    dimensions?.zIndex ||
    (dimensions?.fontSizeScale && dimensions.fontSizeScale !== 1)
  )

  // Z-Index Soberano: Foto tem base superior (30) para flutuar naturalmente sobre cartões (10)
  const baseZIndex = isPhoto ? 30 : 10
  const activeZIndex = isMoving
    ? 130
    : isSelected
      ? 85 + (dimensions?.zIndex ?? 0)
      : typeof dimensions?.zIndex === 'number'
        ? baseZIndex + dimensions.zIndex
        : baseZIndex

  return (
    <div
      ref={containerRef}
      className={`cv-structural-box cv-structural-box--active ${isSelected ? 'is-selected' : ''} ${isResizing ? `is-resizing is-resizing-${resizeType}` : ''} ${isMoving ? 'is-moving' : ''} ${isOverflowing ? 'is-overflowing' : ''} ${isPhoto ? 'is-photo-box' : ''}`}
      onClick={handleSelectThisBox}
      style={{
        width: widthStyle,
        minHeight: heightStyle,
        maxHeight: dimensions?.maxHeightPx ? heightStyle : undefined,
        overflow: 'visible', // NUNCA corta alças ou mini-toolbar
        top: topStyle,
        left: leftStyle,
        marginLeft: marginLeftStyle,
        marginRight: marginRightStyle,
        zIndex: activeZIndex,
        order: dimensions?.order,
        fontFamily: dimensions?.fontFamily ? `"${dimensions.fontFamily}", sans-serif` : undefined,
        fontSize: dimensions?.fontSizeScale && dimensions.fontSizeScale !== 1 ? `${dimensions.fontSizeScale}em` : undefined,
        ['--cv-box-font-scale' as any]: fontScaleVal,
        ['--cv-box-font-family' as any]: dimensions?.fontFamily ? `"${dimensions.fontFamily}", sans-serif` : undefined,
        ['--cv-font-heading' as any]: dimensions?.fontFamily ? `"${dimensions.fontFamily}", sans-serif` : undefined,
        ['--cv-font-body' as any]: dimensions?.fontFamily ? `"${dimensions.fontFamily}", sans-serif` : undefined
      }}
      data-section-id={sectionId}
      data-has-custom-font={dimensions?.fontFamily ? 'true' : undefined}
      data-has-custom-scale={dimensions?.fontSizeScale && dimensions.fontSizeScale !== 1 ? 'true' : undefined}
    >
      {/* ── Mini-Toolbar Compacta Flutuante (Estilo Notion/Figma - NUNCA some ao sobrepor) ── */}
      <div
        ref={toolbarRef}
        className={`cv-box-mini-toolbar cv-no-print ${isSelected ? 'is-selected' : ''}`}
        data-cv-interactive="true"
        onClick={e => e.stopPropagation()}
      >
        {/* Grip de Arraste com Título Truncado */}
        <div
          className={`cv-mini-toolbar-drag ${isMoving ? 'is-dragging' : ''}`}
          onPointerDown={handleMovePointerDown}
          title="Segure e arraste pelo título para mover livremente no plano"
        >
          <span className="cv-mini-drag-icon">⠿</span>
          <span className="cv-mini-title-text" title={title}>{title}</span>
        </div>

        {dimensions?.widthPercent && dimensions.widthPercent < 100 && (
          <span className="cv-mini-badge">{dimensions.widthPercent}%</span>
        )}

        {/* Botão 📏 Posição & Margens & Camadas */}
        <button
          type="button"
          className={`cv-mini-btn ${activePopover === 'position' ? 'is-active' : ''}`}
          onClick={() => setActivePopover(prev => prev === 'position' ? null : 'position')}
          title="Ajustar margens, recuos, encostar e nível de camada"
        >
          📏 Posição
        </button>

        {/* Botão 🔤 Tipografia */}
        <button
          type="button"
          className={`cv-mini-btn ${activePopover === 'font' ? 'is-active' : ''}`}
          onClick={() => setActivePopover(prev => prev === 'font' ? null : 'font')}
          title="Ajustar fonte e tamanho do texto deste bloco"
        >
          🔤 Fonte
        </button>

        {/* Botão Trocar Coluna (quando aplicável) */}
        {canSwitchZone && onSwitchZone && (
          <button
            type="button"
            className="cv-mini-btn cv-mini-btn--zone"
            onClick={onSwitchZone}
            title={`Transferir para coluna ${currentZone === 'left' ? 'Direita' : 'Esquerda'}`}
          >
            ⇄ Coluna {currentZone === 'left' ? 'Dir' : 'Esq'}
          </button>
        )}

        {/* Botão Ocultar */}
        {onToggleHide && (
          <button
            type="button"
            className="cv-mini-btn cv-mini-btn--icon cv-mini-btn--hide"
            onClick={onToggleHide}
            title="Ocultar este item da folha A4 (restaurável na paleta Elementos)"
          >
            👁️
          </button>
        )}

        {/* Botão Redefinir */}
        {onResetDimensions && hasCustomizations && (
          <button
            type="button"
            className="cv-mini-btn cv-mini-btn--icon cv-mini-btn--reset"
            onClick={onResetDimensions}
            title="Redefinir tamanho, margens e formato deste bloco"
          >
            ↺
          </button>
        )}

        {/* ── Popover: Posição, Margens, Encostar & Nível de Camada ── */}
        {activePopover === 'position' && (
          <div className="cv-box-popover cv-box-popover--position" onClick={e => e.stopPropagation()}>
            <div className="cv-popover-header">
              <span>📏 Posição & Camadas</span>
              <button type="button" className="cv-popover-close" onClick={() => setActivePopover(null)}>✕</button>
            </div>
            <div className="cv-popover-body">
              {/* Botões de Encostar Rápido (Snap Acima e Abaixo) */}
              <div className="cv-popover-snap-group">
                <span className="cv-popover-sublabel">Encostar sem vão:</span>
                <div className="cv-popover-snap-buttons">
                  <button
                    type="button"
                    className="cv-snap-btn cv-snap-btn--up"
                    onClick={handleSnapToAbove}
                    title="Encostar o topo deste bloco na base do bloco de cima"
                  >
                    ⤒ Acima
                  </button>
                  <button
                    type="button"
                    className="cv-snap-btn cv-snap-btn--down"
                    onClick={handleSnapToBelow}
                    title="Encostar a base deste bloco no topo do bloco de baixo"
                  >
                    ⤓ Abaixo
                  </button>
                </div>
              </div>

              {/* Ajuste de Margem Vertical (Y) */}
              <div className="cv-popover-row">
                <span className="cv-popover-row-label">Margem Y:</span>
                <div className="cv-popover-stepper">
                  <button
                    type="button"
                    className="cv-popover-step-btn"
                    onClick={() => handleAdjustMarginY(-4)}
                    title="Reduzir margem (-4px)"
                  >
                    -
                  </button>
                  <span className="cv-popover-step-val">{dimensions?.marginTopPx ?? 0}px</span>
                  <button
                    type="button"
                    className="cv-popover-step-btn"
                    onClick={() => handleAdjustMarginY(+4)}
                    title="Aumentar margem (+4px)"
                  >
                    +
                  </button>
                  {(dimensions?.marginTopPx !== undefined && dimensions.marginTopPx !== 0) && (
                    <button
                      type="button"
                      className="cv-popover-zero-btn"
                      onClick={() => onUpdateDimensions?.({ ...dimensions, marginTopPx: 0 })}
                      title="Zerar margem Y"
                    >
                      0px
                    </button>
                  )}
                </div>
              </div>

              {/* Ajuste de Recuo Horizontal (X) */}
              <div className="cv-popover-row">
                <span className="cv-popover-row-label">Recuo X:</span>
                <div className="cv-popover-stepper">
                  <button
                    type="button"
                    className="cv-popover-step-btn"
                    onClick={() => handleAdjustMarginX(-8)}
                    title="Mover para esquerda (-8px)"
                  >
                    ◀
                  </button>
                  <span className="cv-popover-step-val">{dimensions?.marginLeftPx ?? 0}px</span>
                  <button
                    type="button"
                    className="cv-popover-step-btn"
                    onClick={() => handleAdjustMarginX(+8)}
                    title="Mover para direita (+8px)"
                  >
                    ▶
                  </button>
                  {(dimensions?.marginLeftPx !== undefined && dimensions.marginLeftPx !== 0) && (
                    <button
                      type="button"
                      className="cv-popover-zero-btn"
                      onClick={() => onUpdateDimensions?.({ ...dimensions, marginLeftPx: 0 })}
                      title="Zerar recuo X"
                    >
                      0px
                    </button>
                  )}
                </div>
              </div>

              {/* Controle de Nível de Camada / Sobreposição (Z-Index) */}
              <div className="cv-popover-row cv-popover-layer-row">
                <span className="cv-popover-row-label">Camada:</span>
                <div className="cv-popover-layer-controls">
                  <button
                    type="button"
                    className="cv-layer-btn"
                    onClick={() => handleAdjustZIndex(-1)}
                    title="Enviar bloco para trás"
                  >
                    🔽 Trás
                  </button>
                  <span className="cv-layer-val" title="Nível da camada deste bloco">
                    {dimensions?.zIndex ?? 0}
                  </span>
                  <button
                    type="button"
                    className="cv-layer-btn"
                    onClick={() => handleAdjustZIndex(+1)}
                    title="Trazer bloco para frente"
                  >
                    🔼 Frente
                  </button>
                </div>
              </div>

              {/* Alinhamento Horizontal */}
              {dimensions?.widthPercent && dimensions.widthPercent < 100 && (
                <div className="cv-popover-row cv-popover-align-row">
                  <span className="cv-popover-row-label">Alinhar:</span>
                  <div className="cv-popover-align-buttons">
                    <button
                      type="button"
                      className={`cv-popover-align-btn ${dimensions?.alignment === 'left' || !dimensions?.alignment ? 'is-active' : ''}`}
                      onClick={() => handleSetAlignment('left')}
                    >
                      ⬅ Esq
                    </button>
                    <button
                      type="button"
                      className={`cv-popover-align-btn ${dimensions?.alignment === 'center' ? 'is-active' : ''}`}
                      onClick={() => handleSetAlignment('center')}
                    >
                      ⏺ Centro
                    </button>
                    <button
                      type="button"
                      className={`cv-popover-align-btn ${dimensions?.alignment === 'right' ? 'is-active' : ''}`}
                      onClick={() => handleSetAlignment('right')}
                    >
                      ➡ Dir
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Popover: Tipografia (Fonte e Tamanho) ── */}
        {activePopover === 'font' && (
          <div className="cv-box-popover cv-box-popover--font" onClick={e => e.stopPropagation()}>
            <div className="cv-popover-header">
              <span>🔤 Tipografia do Bloco</span>
              <button type="button" className="cv-popover-close" onClick={() => setActivePopover(null)}>✕</button>
            </div>
            <div className="cv-popover-body">
              <div className="cv-popover-row">
                <span className="cv-popover-row-label">Fonte:</span>
                <select
                  className="cv-popover-select"
                  value={dimensions?.fontFamily || 'inherit'}
                  onChange={e => handleSelectFontFamily(e.target.value)}
                >
                  {AVAILABLE_BOX_FONTS.map(f => (
                    <option key={f.id} value={f.family || 'inherit'}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cv-popover-row cv-popover-font-scale-row">
                <span className="cv-popover-row-label">Tamanho:</span>
                <div className="cv-popover-slider-group">
                  <button
                    type="button"
                    className="cv-popover-step-btn"
                    onClick={() => handleAdjustFontScale(-4)}
                    title="Reduzir tamanho (-4%)"
                  >
                    A-
                  </button>
                  <input
                    type="range"
                    className="cv-popover-range"
                    min={70}
                    max={140}
                    step={2}
                    value={fontPercentVal}
                    onChange={e => handleSetFontScaleSlider(Number(e.target.value))}
                  />
                  <span className="cv-popover-font-val">{fontPercentVal}%</span>
                  <button
                    type="button"
                    className="cv-popover-step-btn"
                    onClick={() => handleAdjustFontScale(+4)}
                    title="Aumentar tamanho (+4%)"
                  >
                    A+
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conteúdo Real da Seção (Clipping interno apenas se maxHeightPx estiver definido; arraste direto para foto) */}
      <div
        ref={contentRef}
        className={`cv-structural-box__content ${isPhoto ? 'is-photo-draggable' : ''}`}
        onPointerDown={isPhoto ? handleMovePointerDown : undefined}
        style={{
          maxHeight: dimensions?.maxHeightPx ? `${dimensions.maxHeightPx}px` : undefined,
          overflow: dimensions?.maxHeightPx ? 'hidden' : 'visible',
          cursor: isPhoto ? (isMoving ? 'grabbing' : 'grab') : undefined,
          userSelect: isPhoto ? 'none' : undefined
        }}
      >
        {children}
      </div>

      {/* Alerta de Overflow Protetivo (se o texto não couber) */}
      {isOverflowing && (
        <div className="cv-structural-box__overflow-badge cv-no-print no-print" data-cv-interactive="true">
          <span>⚠️</span>
          <span>Texto excede o tamanho fixado. Aumente a altura se desejar que apareça completo no A4.</span>
        </div>
      )}

      {/* ── ALÇAS LARGAS DE REDIMENSIONAMENTO (Fáceis de acionar com mouse e toque) ── */}

      {/* Borda Direita (Largura) */}
      <div
        className="cv-structural-handle cv-structural-handle--x cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'width')}
        title="Arrastar borda direita para redimensionar largura"
      >
        <span className="cv-handle-pill" />
      </div>

      {/* Borda Esquerda (Largura) */}
      <div
        className="cv-structural-handle cv-structural-handle--x-left cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'width-left')}
        title="Arrastar borda esquerda para redimensionar largura"
      >
        <span className="cv-handle-pill" />
      </div>

      {/* Borda Inferior (Altura) */}
      <div
        className="cv-structural-handle cv-structural-handle--y cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'height')}
        title="Arrastar borda inferior para redimensionar altura"
      >
        <span className="cv-handle-pill-horizontal" />
      </div>

      {/* Borda Superior (Altura) */}
      <div
        className="cv-structural-handle cv-structural-handle--y-top cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'height-top')}
        title="Arrastar borda superior para redimensionar altura"
      >
        <span className="cv-handle-pill-horizontal" />
      </div>

      {/* 4 Cantos de Redimensionamento Bidirecional */}
      <div
        className="cv-structural-handle cv-structural-handle--xy cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'corner-se')}
        title="Canto inferior direito: redimensionar largura e altura livremente"
      >
        <span className="cv-handle-corner" />
      </div>

      <div
        className="cv-structural-handle cv-structural-handle--corner-sw cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'corner-sw')}
        title="Canto inferior esquerdo: redimensionar largura e altura livremente"
      >
        <span className="cv-handle-corner" />
      </div>

      <div
        className="cv-structural-handle cv-structural-handle--corner-ne cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'corner-ne')}
        title="Canto superior direito: redimensionar largura e altura livremente"
      >
        <span className="cv-handle-corner" />
      </div>

      <div
        className="cv-structural-handle cv-structural-handle--corner-nw cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'corner-nw')}
        title="Canto superior esquerdo: redimensionar largura e altura livremente"
      >
        <span className="cv-handle-corner" />
      </div>
    </div>
  )
}
