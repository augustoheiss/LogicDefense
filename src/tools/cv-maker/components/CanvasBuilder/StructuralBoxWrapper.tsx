import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { SectionBoxDimensions } from '../../types/cv'
import { AVAILABLE_BOX_FONTS } from '../../types/cv'
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

  const fontScaleVal = dimensions?.fontSizeScale ?? 1.0
  const fontPercentVal = Math.round(fontScaleVal * 100)

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
      {/* Menu Interno do Canvas Livre (Preenche o interior do box ao passar o mouse) */}
      <div
        className="cv-structural-box__overlay-menu cv-no-print"
        data-cv-interactive="true"
        onClick={e => e.stopPropagation()}
      >
        <div className="cv-box-menu-inner">
          {/* Linha 1: Cabeçalho com Título Truncado, Grip de Arraste e Botões de Ação */}
          <div className="cv-box-menu-header">
            <div
              className={`cv-box-menu-title-tag ${isMoving ? 'is-dragging' : ''}`}
              onPointerDown={handleMovePointerDown}
              title="Segure e arraste pelo título para mover livremente no plano"
            >
              <span className="cv-drag-grip">⠿</span>
              <span className="cv-box-menu-title-text" title={title}>{title}</span>
            </div>

            <div className="cv-box-menu-header-actions">
              {dimensions?.widthPercent && dimensions.widthPercent < 100 && (
                <span className="cv-box-menu-badge">{dimensions.widthPercent}%</span>
              )}

              {onToggleHide && (
                <button
                  type="button"
                  className="cv-box-menu-header-btn cv-box-menu-header-btn--hide"
                  onClick={onToggleHide}
                  title="Ocultar este item da folha A4 (restaurável na paleta Elementos)"
                >
                  👁️ Ocultar
                </button>
              )}

              {onResetDimensions && (dimensions?.widthPercent || dimensions?.minHeightPx || dimensions?.marginTopPx || dimensions?.marginLeftPx || dimensions?.alignment || dimensions?.variant) && (
                <button
                  type="button"
                  className="cv-box-menu-header-btn cv-box-menu-header-btn--reset"
                  onClick={onResetDimensions}
                  title="Redefinir tamanho, margens e formato deste bloco"
                >
                  ↺ Redefinir
                </button>
              )}
            </div>
          </div>

          {/* Linha 2: Ações Principais de Layout e Movimentação com Botões Maiores */}
          <div className="cv-box-menu-main-row">
            {/* Seletor de Variante de Layout Grande e Legível */}
            {category && CATEGORY_VARIANTS_MAP[category] && onSelectVariant && (
              <div className="cv-box-menu-variant-group">
                <span className="cv-box-menu-section-label">Estilo:</span>
                <select
                  className="cv-box-menu-variant-select"
                  value={dimensions?.variant || CATEGORY_VARIANTS_MAP[category][0].id}
                  onChange={e => onSelectVariant(e.target.value)}
                  title="Alterar o formato/layout deste bloco"
                >
                  {CATEGORY_VARIANTS_MAP[category].map(v => (
                    <option key={v.id} value={v.id}>
                      {v.icon} {v.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mover para Cima e para Baixo */}
            <div className="cv-box-menu-btn-group">
              {onMoveUp && (
                <button
                  type="button"
                  className="cv-box-menu-btn cv-box-menu-btn--nav"
                  onClick={onMoveUp}
                  title="Mover seção para cima"
                >
                  ▲ Subir
                </button>
              )}
              {onMoveDown && (
                <button
                  type="button"
                  className="cv-box-menu-btn cv-box-menu-btn--nav"
                  onClick={onMoveDown}
                  title="Mover seção para baixo"
                >
                  ▼ Descer
                </button>
              )}
            </div>

            {/* Troca de Coluna em Layouts Multi-coluna */}
            {canSwitchZone && onSwitchZone && (
              <button
                type="button"
                className="cv-box-menu-btn cv-box-menu-btn--zone"
                onClick={onSwitchZone}
                title={`Transferir para coluna ${currentZone === 'left' ? 'Direita' : 'Esquerda'}`}
              >
                ⇄ Para Coluna {currentZone === 'left' ? 'Direita' : 'Esquerda'}
              </button>
            )}
          </div>

          {/* Linha 3: Ajustes Finos de Posição, Margens e Alinhamento */}
          <div className="cv-box-menu-controls-row">
            {/* Margem Vertical (Y) */}
            <div className="cv-box-menu-stepper" title="Ajustar margem vertical (Eixo Y)">
              <span className="cv-stepper-label">Margem Y:</span>
              <button
                type="button"
                className="cv-stepper-btn"
                onClick={() => handleAdjustMarginY(-4)}
                title="Reduzir margem vertical (-4px)"
              >
                -
              </button>
              <span className="cv-stepper-value">
                {dimensions?.marginTopPx ?? 0}px
              </span>
              <button
                type="button"
                className="cv-stepper-btn"
                onClick={() => handleAdjustMarginY(+4)}
                title="Aumentar margem vertical (+4px)"
              >
                +
              </button>
            </div>

            {/* Recuo Horizontal (X) */}
            <div className="cv-box-menu-stepper" title="Ajustar recuo lateral (Eixo X)">
              <span className="cv-stepper-label">Recuo X:</span>
              <button
                type="button"
                className="cv-stepper-btn"
                onClick={() => handleAdjustMarginX(-8)}
                title="Mover para esquerda (-8px)"
              >
                ◀
              </button>
              <span className="cv-stepper-value">
                {dimensions?.marginLeftPx ?? 0}px
              </span>
              <button
                type="button"
                className="cv-stepper-btn"
                onClick={() => handleAdjustMarginX(+8)}
                title="Mover para direita (+8px)"
              >
                ▶
              </button>
            </div>

            {/* Alinhamento rápido se largura for menor que 100% */}
            {dimensions?.widthPercent && dimensions.widthPercent < 100 && (
              <div className="cv-box-menu-align-group" title="Alinhamento na linha">
                <button
                  type="button"
                  className={`cv-align-btn ${dimensions?.alignment === 'left' || !dimensions?.alignment ? 'is-active' : ''}`}
                  onClick={() => handleSetAlignment('left')}
                  title="Alinhar à Esquerda"
                >
                  ⬅️ Esq
                </button>
                <button
                  type="button"
                  className={`cv-align-btn ${dimensions?.alignment === 'center' ? 'is-active' : ''}`}
                  onClick={() => handleSetAlignment('center')}
                  title="Centralizar"
                >
                  ⏺️ Centro
                </button>
                <button
                  type="button"
                  className={`cv-align-btn ${dimensions?.alignment === 'right' ? 'is-active' : ''}`}
                  onClick={() => handleSetAlignment('right')}
                  title="Alinhar à Direita"
                >
                  ➡️ Dir
                </button>
              </div>
            )}
          </div>

          {/* Linha 4: Tipografia Específica do Box (Fonte & Escala Contínua 70% a 140%) */}
          <div className="cv-box-menu-typography-row">
            {/* Seletor de Família de Fonte com Catálogo Completo */}
            <div className="cv-box-menu-font-group" title="Alterar a fonte tipográfica deste box específico">
              <span className="cv-box-menu-section-label">Fonte:</span>
              <select
                className="cv-box-menu-font-select"
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

            {/* Slider Contínuo de Tamanho com Botões A- e A+ e Porcentagem em Tempo Real */}
            <div className="cv-box-menu-font-slider-group" title="Ajuste contínuo do tamanho da fonte deste box (70% a 140%)">
              <span className="cv-box-menu-section-label">Tam:</span>
              <button
                type="button"
                className="cv-stepper-btn cv-stepper-btn--font"
                onClick={() => handleAdjustFontScale(-4)}
                title="Reduzir tamanho da fonte (-4%)"
              >
                A-
              </button>

              <input
                type="range"
                className="cv-box-menu-range"
                min={70}
                max={140}
                step={2}
                value={fontPercentVal}
                onChange={e => handleSetFontScaleSlider(Number(e.target.value))}
                title={`Tamanho: ${fontPercentVal}% (arraste para ajustar)`}
              />

              <span className="cv-box-menu-font-value">
                {fontPercentVal}%
              </span>

              <button
                type="button"
                className="cv-stepper-btn cv-stepper-btn--font"
                onClick={() => handleAdjustFontScale(+4)}
                title="Aumentar tamanho da fonte (+4%)"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Real da Seção */}
      <div ref={contentRef} className="cv-structural-box__content">
        {children}
      </div>

      {/* Alerta de Overflow Protetivo (se o texto não couber) */}
      {isOverflowing && (
        <div className="cv-structural-box__overflow-badge cv-no-print no-print" data-cv-interactive="true">
          <span>⚠️</span>
          <span>Texto excede o tamanho fixado. Aumente a altura ou o excedente será cortado na impressão A4.</span>
        </div>
      )}

      {/* Alerta de Sobreposição / Colisão com outro bloco */}
      {hasCollision && !isMoving && (
        <div className="cv-structural-box__collision-badge cv-no-print no-print" data-cv-interactive="true">
          <span>⚠️</span>
          <span>Sobreposição detectada: este bloco está sobreposto por outro. Mova ou ajuste as margens para desobstruir.</span>
        </div>
      )}

      {/* Resize Handle: Largura (Borda Direita) */}
      <div
        className="cv-structural-handle cv-structural-handle--x cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'width')}
        title="Arrastar para alterar largura (Mouse ou Toque)"
      >
        <span className="cv-handle-pill" />
      </div>

      {/* Resize Handle: Altura (Borda Inferior) */}
      <div
        className="cv-structural-handle cv-structural-handle--y cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'height')}
        title="Arrastar para alterar altura (Mouse ou Toque)"
      >
        <span className="cv-handle-pill-horizontal" />
      </div>

      {/* Resize Handle: Ambos (Canto Inferior Direito) */}
      <div
        className="cv-structural-handle cv-structural-handle--xy cv-no-print"
        data-cv-interactive="true"
        onPointerDown={e => handlePointerDown(e, 'both')}
        title="Arrastar para redimensionar largura e altura simultaneamente"
      >
        <span className="cv-handle-corner" />
      </div>
    </div>
  )
}
