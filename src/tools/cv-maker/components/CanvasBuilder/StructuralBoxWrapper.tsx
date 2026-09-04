import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { SectionBoxDimensions } from '../../types/cv'

interface StructuralBoxWrapperProps {
  sectionId: string
  title: string
  isFreeCanvasActive: boolean
  dimensions?: SectionBoxDimensions
  canSwitchZone?: boolean
  currentZone?: 'left' | 'right'
  onUpdateDimensions?: (dims: SectionBoxDimensions) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onSwapWithSection?: (targetSectionId: string) => void
  onSwitchZone?: () => void
  onResetDimensions?: () => void
  children: React.ReactNode
}

export const StructuralBoxWrapper: React.FC<StructuralBoxWrapperProps> = ({
  sectionId,
  title,
  isFreeCanvasActive,
  dimensions,
  canSwitchZone,
  currentZone,
  onUpdateDimensions,
  onMoveUp,
  onMoveDown,
  onSwapWithSection,
  onSwitchZone,
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

  // Manipulação de Arraste 2D Bidimensional pelo Label (Mouse + Touch)
  const handleMovePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

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
        // Movimentação livre no plano 2D (ambos os eixos X e Y)
        containerRef.current.style.transform = `translate(${deltaX}px, ${deltaY}px)`
        containerRef.current.style.zIndex = '120'
        containerRef.current.style.boxShadow = '0 14px 32px rgba(0, 0, 0, 0.45)'
      }

      // Detecção de migração de coluna por arraste lateral (se cruzar a divisória)
      if (canSwitchZone && onSwitchZone && !hasCrossedZone) {
        if ((currentZone === 'left' && deltaX > 180) || (currentZone === 'right' && deltaX < -180)) {
          hasCrossedZone = true
          onSwitchZone()
        }
      }

      // Detecta sobre qual seção o cursor está pairando para trocar de posição
      const allBoxes = Array.from(document.querySelectorAll('.cv-structural-box')) as HTMLElement[]
      for (const sib of allBoxes) {
        if (sib === containerRef.current) continue
        const rect = sib.getBoundingClientRect()
        if (
          moveEvt.clientY >= rect.top &&
          moveEvt.clientY <= rect.bottom &&
          moveEvt.clientX >= rect.left &&
          moveEvt.clientX <= rect.right
        ) {
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
  }, [canSwitchZone, currentZone, onSwapWithSection, onSwitchZone])

  // Ajuste rápido de margem vertical (Y)
  const handleAdjustMarginY = (delta: number) => {
    const current = dimensions?.marginTopPx || 0
    const next = Math.max(-15, Math.min(60, current + delta))
    onUpdateDimensions?.({
      ...dimensions,
      marginTopPx: next
    })
  }

  // Ajuste fino de margem / recuo horizontal (X)
  const handleAdjustMarginX = (delta: number) => {
    const current = dimensions?.marginLeftPx || 0
    const next = Math.max(-30, Math.min(350, current + delta))
    onUpdateDimensions?.({
      ...dimensions,
      marginLeftPx: next,
      alignment: undefined
    })
  }

  // Alinhamento rápido no plano
  const handleSetAlignment = (alignment: 'left' | 'center' | 'right') => {
    onUpdateDimensions?.({
      ...dimensions,
      alignment,
      marginLeftPx: undefined
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

  const marginTopStyle = typeof dimensions?.marginTopPx === 'number' && dimensions.marginTopPx !== 0
    ? `${dimensions.marginTopPx}px`
    : undefined

  const marginLeftStyle = dimensions?.alignment === 'center'
    ? 'auto'
    : dimensions?.alignment === 'right'
      ? 'auto'
      : typeof dimensions?.marginLeftPx === 'number' && dimensions.marginLeftPx !== 0
        ? `${dimensions.marginLeftPx}px`
        : undefined

  const marginRightStyle = dimensions?.alignment === 'center'
    ? 'auto'
    : dimensions?.alignment === 'right'
      ? '0'
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
        marginTop: marginTopStyle,
        marginLeft: marginLeftStyle,
        marginRight: marginRightStyle,
        order: dimensions?.order
      }}
      data-section-id={sectionId}
    >
      {/* Barra de Ações Flutuante (Oculta na Impressão) */}
      <div className="cv-structural-box__toolbar cv-no-print" onClick={e => e.stopPropagation()}>
        {/* Tag com alça de arraste 2D integrada */}
        <div
          className={`cv-structural-box__tag ${isMoving ? 'is-dragging' : ''}`}
          onPointerDown={handleMovePointerDown}
          title="Segure e arraste pelo label para mover livremente em qualquer direção no plano X/Y"
        >
          <span className="cv-drag-grip">⠿</span>
          <span>{title}</span>
        </div>

        <div className="cv-structural-box__actions">
          {/* Indicador de Margem Lateral (X) com botões de ajuste fino */}
          <div className="cv-structural-margin-ctrl" title="Ajustar recuo lateral (Eixo X)">
            <button
              type="button"
              className="cv-margin-btn"
              onClick={() => handleAdjustMarginX(-8)}
              title="Mover para esquerda (-8px)"
            >
              ◀
            </button>
            <span className="cv-margin-indicator">
              ↔ {dimensions?.marginLeftPx ?? 0}px
            </span>
            <button
              type="button"
              className="cv-margin-btn"
              onClick={() => handleAdjustMarginX(+8)}
              title="Mover para direita (+8px)"
            >
              ▶
            </button>
          </div>

          {/* Indicador de Margem Superior (Y) com botões de ajuste fino */}
          <div className="cv-structural-margin-ctrl" title="Ajustar margem superior (Eixo Y)">
            <button
              type="button"
              className="cv-margin-btn"
              onClick={() => handleAdjustMarginY(-4)}
              title="Reduzir margem vertical (-4px)"
            >
              -
            </button>
            <span className="cv-margin-indicator">
              ↕ {dimensions?.marginTopPx ?? 0}px
            </span>
            <button
              type="button"
              className="cv-margin-btn"
              onClick={() => handleAdjustMarginY(+4)}
              title="Aumentar margem vertical (+4px)"
            >
              +
            </button>
          </div>

          {/* Alinhamento rápido se largura for menor que 100% */}
          {dimensions?.widthPercent && dimensions.widthPercent < 100 && (
            <div className="cv-structural-align-ctrl" title="Alinhamento na linha">
              <button
                type="button"
                className={`cv-margin-btn ${dimensions?.alignment === 'left' || !dimensions?.alignment ? 'is-active' : ''}`}
                onClick={() => handleSetAlignment('left')}
                title="Alinhar à Esquerda"
              >
                |◀
              </button>
              <button
                type="button"
                className={`cv-margin-btn ${dimensions?.alignment === 'center' ? 'is-active' : ''}`}
                onClick={() => handleSetAlignment('center')}
                title="Centralizar"
              >
                |■|
              </button>
              <button
                type="button"
                className={`cv-margin-btn ${dimensions?.alignment === 'right' ? 'is-active' : ''}`}
                onClick={() => handleSetAlignment('right')}
                title="Alinhar à Direita"
              >
                ▶|
              </button>
            </div>
          )}

          {/* Botão de Troca de Coluna (Esquerda <-> Direita) */}
          {canSwitchZone && onSwitchZone && (
            <button
              type="button"
              className="cv-structural-act-btn cv-structural-act-btn--zone"
              onClick={onSwitchZone}
              title={`Transferir para coluna ${currentZone === 'left' ? 'Direita' : 'Esquerda'}`}
            >
              ⇄ {currentZone === 'left' ? 'Dir' : 'Esq'}
            </button>
          )}

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
          {onResetDimensions && (dimensions?.widthPercent || dimensions?.minHeightPx || dimensions?.marginTopPx || dimensions?.marginLeftPx || dimensions?.alignment) && (
            <button
              type="button"
              className="cv-structural-act-btn cv-structural-act-btn--reset"
              onClick={onResetDimensions}
              title="Redefinir tamanho, margens e posição deste bloco"
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
