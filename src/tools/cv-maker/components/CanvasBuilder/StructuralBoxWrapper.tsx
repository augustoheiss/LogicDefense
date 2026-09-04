import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { SectionBoxDimensions } from '../../types/cv'

interface StructuralBoxWrapperProps {
  sectionId: string
  title: string
  isFreeCanvasActive: boolean
  dimensions?: SectionBoxDimensions
  onUpdateDimensions?: (dims: SectionBoxDimensions) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onSwapWithSection?: (targetSectionId: string) => void
  onResetDimensions?: () => void
  children: React.ReactNode
}

export const StructuralBoxWrapper: React.FC<StructuralBoxWrapperProps> = ({
  sectionId,
  title,
  isFreeCanvasActive,
  dimensions,
  onUpdateDimensions,
  onMoveUp,
  onMoveDown,
  onSwapWithSection,
  onResetDimensions,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false)
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const [isMoving, setIsMoving] = useState<boolean>(false)
  const [resizeType, setResizeType] = useState<'width' | 'height' | 'both' | null>(null)

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

  // Manipulação contínua de redimensionamento via PointerEvents (Mouse + Touch)
  const handlePointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    type: 'width' | 'height' | 'both'
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const targetEl = e.currentTarget
    targetEl.setPointerCapture(e.pointerId)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = containerRef.current?.getBoundingClientRect().width || 200
    const startHeight = containerRef.current?.getBoundingClientRect().height || 100
    const parentWidth = containerRef.current?.parentElement?.getBoundingClientRect().width || 800

    setIsResizing(true)
    setResizeType(type)

    let latestWidthPercent = dimensions?.widthPercent || 100
    let latestHeightPx = dimensions?.minHeightPx || startHeight

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const deltaX = moveEvt.clientX - startX
      const deltaY = moveEvt.clientY - startY

      if (type === 'width' || type === 'both') {
        const newWidthPx = Math.max(120, Math.min(parentWidth, startWidth + deltaX))
        latestWidthPercent = Math.round((newWidthPx / parentWidth) * 100)
        if (containerRef.current) {
          containerRef.current.style.width = `${latestWidthPercent}%`
        }
      }

      if (type === 'height' || type === 'both') {
        latestHeightPx = Math.max(36, Math.min(950, Math.round(startHeight + deltaY)))
        if (containerRef.current) {
          containerRef.current.style.minHeight = `${latestHeightPx}px`
          containerRef.current.style.maxHeight = `${latestHeightPx}px`
        }
      }
    }

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault()
      try {
        targetEl.releasePointerCapture(upEvt.pointerId)
      } catch {
        // Ignora caso já liberado
      }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      setIsResizing(false)
      setResizeType(null)

      onUpdateDimensions?.({
        ...dimensions,
        widthPercent: type === 'width' || type === 'both' ? latestWidthPercent : dimensions?.widthPercent,
        minHeightPx: type === 'height' || type === 'both' ? latestHeightPx : dimensions?.minHeightPx,
        maxHeightPx: type === 'height' || type === 'both' ? latestHeightPx : dimensions?.maxHeightPx
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [dimensions, onUpdateDimensions])

  // Manipulação de Arraste / Movimentação pelo Label
  const handleMovePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const targetEl = e.currentTarget
    targetEl.setPointerCapture(e.pointerId)
    setIsMoving(true)

    const startY = e.clientY
    const parentContainer = containerRef.current?.parentElement

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const deltaY = moveEvt.clientY - startY
      if (containerRef.current) {
        containerRef.current.style.transform = `translateY(${deltaY}px)`
        containerRef.current.style.zIndex = '120'
        containerRef.current.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.35)'
      }

      // Detecta sobre qual seção irmã o cursor está pairando para trocar de posição
      if (parentContainer) {
        const siblings = Array.from(parentContainer.querySelectorAll('.cv-structural-box')) as HTMLElement[]
        for (const sib of siblings) {
          if (sib === containerRef.current) continue
          const rect = sib.getBoundingClientRect()
          if (moveEvt.clientY >= rect.top && moveEvt.clientY <= rect.bottom) {
            const targetId = sib.getAttribute('data-section-id')
            if (targetId && onSwapWithSection) {
              const midY = rect.top + rect.height / 2
              if ((deltaY > 0 && moveEvt.clientY > midY) || (deltaY < 0 && moveEvt.clientY < midY)) {
                onSwapWithSection(targetId)
                break
              }
            }
          }
        }
      }
    }

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault()
      try {
        targetEl.releasePointerCapture(upEvt.pointerId)
      } catch {
        // Ignora caso já liberado
      }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      if (containerRef.current) {
        containerRef.current.style.transform = ''
        containerRef.current.style.zIndex = ''
        containerRef.current.style.boxShadow = ''
      }
      setIsMoving(false)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [onSwapWithSection])

  // Ajuste rápido de margem superior (incrementar / decrementar)
  const handleAdjustMargin = (delta: number) => {
    const current = dimensions?.marginTopPx || 0
    const next = Math.max(-15, Math.min(60, current + delta))
    onUpdateDimensions?.({
      ...dimensions,
      marginTopPx: next
    })
  }

  // Se o modo Canvas Livre estiver inativo, renderiza puramente o conteúdo sem custo DOM
  if (!isFreeCanvasActive) {
    return <>{children}</>
  }

  const widthStyle = dimensions?.widthPercent && dimensions.widthPercent < 100
    ? `${dimensions.widthPercent}%`
    : '100%'

  const heightStyle = dimensions?.maxHeightPx
    ? `${dimensions.maxHeightPx}px`
    : dimensions?.minHeightPx
      ? `${dimensions.minHeightPx}px`
      : undefined

  const marginStyle = typeof dimensions?.marginTopPx === 'number' && dimensions.marginTopPx !== 0
    ? `${dimensions.marginTopPx}px`
    : undefined

  return (
    <div
      ref={containerRef}
      className={`cv-structural-box cv-structural-box--active ${isResizing ? `is-resizing is-resizing-${resizeType}` : ''} ${isMoving ? 'is-moving' : ''} ${isOverflowing ? 'is-overflowing' : ''}`}
      style={{
        width: widthStyle,
        minHeight: heightStyle,
        maxHeight: dimensions?.maxHeightPx ? heightStyle : undefined,
        overflow: dimensions?.maxHeightPx ? 'hidden' : 'visible',
        marginTop: marginStyle,
        order: dimensions?.order
      }}
      data-section-id={sectionId}
    >
      {/* Barra de Ações Flutuante (Oculta na Impressão) */}
      <div className="cv-structural-box__toolbar cv-no-print" onClick={e => e.stopPropagation()}>
        {/* Tag com alça de arraste integrada */}
        <div
          className={`cv-structural-box__tag ${isMoving ? 'is-dragging' : ''}`}
          onPointerDown={handleMovePointerDown}
          title="Segure e arraste pelo label para mover este bloco e trocar de posição"
        >
          <span className="cv-drag-grip">⠿</span>
          <span>{title}</span>
        </div>

        <div className="cv-structural-box__actions">
          {/* Indicador de Margem Superior com botões de ajuste fino */}
          <div className="cv-structural-margin-ctrl" title="Ajustar margem superior deste bloco">
            <button
              type="button"
              className="cv-margin-btn"
              onClick={() => handleAdjustMargin(-4)}
              title="Reduzir margem (-4px)"
            >
              -
            </button>
            <span className="cv-margin-indicator">
              ↕ {dimensions?.marginTopPx ?? 0}px
            </span>
            <button
              type="button"
              className="cv-margin-btn"
              onClick={() => handleAdjustMargin(+4)}
              title="Aumentar margem (+4px)"
            >
              +
            </button>
          </div>

          {dimensions?.widthPercent && dimensions.widthPercent < 100 && (
            <span className="cv-structural-box__dimension-indicator">
              {dimensions.widthPercent}%
            </span>
          )}
          {dimensions?.maxHeightPx && (
            <span className="cv-structural-box__dimension-indicator">
              {dimensions.maxHeightPx}px
            </span>
          )}

          {onMoveUp && (
            <button
              type="button"
              className="cv-structural-act-btn"
              onClick={onMoveUp}
              title="Mover seção para cima"
            >
              ▲
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              className="cv-structural-act-btn"
              onClick={onMoveDown}
              title="Mover seção para baixo"
            >
              ▼
            </button>
          )}
          {onResetDimensions && (dimensions?.widthPercent || dimensions?.minHeightPx || dimensions?.marginTopPx) && (
            <button
              type="button"
              className="cv-structural-act-btn cv-structural-act-btn--reset"
              onClick={onResetDimensions}
              title="Redefinir tamanho e margem deste bloco"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo Real da Seção */}
      <div ref={contentRef} className="cv-structural-box__content">
        {children}
      </div>

      {/* Alerta de Overflow Protetivo (se o texto não couber) */}
      {isOverflowing && (
        <div className="cv-structural-box__overflow-badge cv-no-print">
          <span>⚠️</span>
          <span>Texto excede o tamanho fixado. Aumente a altura ou o excedente será cortado na impressão A4.</span>
        </div>
      )}

      {/* Resize Handle: Largura (Borda Direita) */}
      <div
        className="cv-structural-handle cv-structural-handle--x cv-no-print"
        onPointerDown={e => handlePointerDown(e, 'width')}
        title="Arrastar para alterar largura (Mouse ou Toque)"
      >
        <span className="cv-handle-pill" />
      </div>

      {/* Resize Handle: Altura (Borda Inferior) */}
      <div
        className="cv-structural-handle cv-structural-handle--y cv-no-print"
        onPointerDown={e => handlePointerDown(e, 'height')}
        title="Arrastar para alterar altura (Mouse ou Toque)"
      >
        <span className="cv-handle-pill-horizontal" />
      </div>

      {/* Resize Handle: Ambos (Canto Inferior Direito) */}
      <div
        className="cv-structural-handle cv-structural-handle--xy cv-no-print"
        onPointerDown={e => handlePointerDown(e, 'both')}
        title="Arrastar para redimensionar largura e altura simultaneamente"
      >
        <span className="cv-handle-corner" />
      </div>
    </div>
  )
}
