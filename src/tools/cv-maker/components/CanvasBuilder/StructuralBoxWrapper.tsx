import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { SectionBoxDimensions } from '../../types/cv'
import { CATEGORY_VARIANTS_MAP } from '../../types/variants'

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
  onMoveUp,
  onMoveDown,
  onSwitchZone,
  onResetDimensions,
  onToggleHide,
  onSelectVariant,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false)
  const [hasCollision, setHasCollision] = useState<boolean>(false)
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

  // Detecção de colisão física e sobreposição com outros blocos
  useEffect(() => {
    if (!isFreeCanvasActive || isMoving) {
      setHasCollision(false)
      return
    }

    const checkCollision = () => {
      const el = containerRef.current
      if (!el) return
      const myRect = el.getBoundingClientRect()
      if (myRect.width === 0 || myRect.height === 0) return

      const allBoxes = Array.from(document.querySelectorAll('.cv-structural-box')) as HTMLElement[]
      let collided = false
      for (const other of allBoxes) {
        if (other === el) continue
        const oRect = other.getBoundingClientRect()
        const overlapX = Math.max(0, Math.min(myRect.right, oRect.right) - Math.max(myRect.left, oRect.left))
        const overlapY = Math.max(0, Math.min(myRect.bottom, oRect.bottom) - Math.max(myRect.top, oRect.top))
        if (overlapX > 20 && overlapY > 20) {
          collided = true
          break
        }
      }
      setHasCollision(collided)
    }

    const timer = setTimeout(checkCollision, 100)
    window.addEventListener('cv-box-moved', checkCollision)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('cv-box-moved', checkCollision)
    }
  }, [isFreeCanvasActive, dimensions, isMoving])

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
        // Ignora caso já liberado
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

      // Grava a nova posição livre no plano permanentemente (sem travas ou efeito elástico de retorno)
      if (Math.abs(finalDeltaX) > 3 || Math.abs(finalDeltaY) > 3) {
        const curX = dimensions?.marginLeftPx || 0
        const curY = dimensions?.marginTopPx || 0
        const nextX = Math.round(curX + finalDeltaX)
        const nextY = Math.round(curY + finalDeltaY)

        onUpdateDimensions?.({
          ...dimensions,
          marginLeftPx: nextX,
          marginTopPx: nextY,
          alignment: undefined // Limpa alinhamento estático para fixar onde foi solto
        })

        // Notifica todos os blocos para checarem sobreposição/colisão física
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('cv-box-moved'))
        }, 50)
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [canSwitchZone, currentZone, dimensions, onSwitchZone, onUpdateDimensions])

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

  // Se o item estiver ocultado pelo usuário no Canvas/Paleta, não renderiza
  if (dimensions?.hidden) {
    return null
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

  // Deslocamento 2D no plano livre (sem quebrar o fluxo de página)
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

  return (
    <div
      ref={containerRef}
      className={`cv-structural-box cv-structural-box--active ${isResizing ? `is-resizing is-resizing-${resizeType}` : ''} ${isMoving ? 'is-moving' : ''} ${isOverflowing ? 'is-overflowing' : ''} ${hasCollision ? 'is-collision' : ''}`}
      style={{
        width: widthStyle,
        minHeight: heightStyle,
        maxHeight: dimensions?.maxHeightPx ? heightStyle : undefined,
        overflow: dimensions?.maxHeightPx ? 'hidden' : 'visible',
        top: topStyle,
        left: leftStyle,
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
          {/* Seletor de Variante de Layout do Bloco */}
          {category && CATEGORY_VARIANTS_MAP[category] && onSelectVariant && (
            <select
              className="cv-toolbar-variant-select"
              value={dimensions?.variant || CATEGORY_VARIANTS_MAP[category][0].id}
              onChange={e => onSelectVariant(e.target.value)}
              title="Alterar layout / formato deste bloco"
            >
              {CATEGORY_VARIANTS_MAP[category].map(v => (
                <option key={v.id} value={v.id}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
          )}

          {/* Botão de Ocultar / Visibilidade */}
          {onToggleHide && (
            <button
              type="button"
              className="cv-structural-act-btn cv-structural-act-btn--hide"
              onClick={onToggleHide}
              title="Ocultar este item da folha A4 (restaurável na paleta)"
            >
              👁️
            </button>
          )}

          {onResetDimensions && (dimensions?.widthPercent || dimensions?.minHeightPx || dimensions?.marginTopPx || dimensions?.marginLeftPx || dimensions?.alignment || dimensions?.variant) && (
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

      {/* Alerta de Sobreposição / Colisão com outro bloco */}
      {hasCollision && !isMoving && (
        <div className="cv-structural-box__collision-badge cv-no-print">
          <span>⚠️</span>
          <span>Sobreposição detectada: este bloco está sobreposto por outro. Mova ou ajuste as margens para desobstruir.</span>
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
