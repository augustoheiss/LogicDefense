import React from 'react'
import type { CustomCanvasZone, LayoutStructureConfig } from '../../../types/cv'
import { useCanvasStore } from '../../../store/useCanvasStore'

interface CanvasDecorationsProps {
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (newConfig: LayoutStructureConfig) => void
  isFreeCanvas: boolean
  containerRef?: React.RefObject<HTMLDivElement | null>
}

export const CanvasDecorations: React.FC<CanvasDecorationsProps> = ({
  structureConfig,
  onUpdateStructureConfig,
  isFreeCanvas,
  containerRef
}) => {
  const selectedZoneId = useCanvasStore((s) => s.selectedZoneId)
  const selectZone = useCanvasStore((s) => s.selectZone)
  const drawingMode = useCanvasStore((s) => s.activeDrawingMode)
  const setDrawingMode = useCanvasStore((s) => s.setDrawingMode)

  const [draggingZoneId, setDraggingZoneId] = React.useState<string | null>(null)
  const [drawingStart, setDrawingStart] = React.useState<{ x: number; y: number } | null>(null)
  const [drawingCurrent, setDrawingCurrent] = React.useState<{ x: number; y: number } | null>(null)
  const [polygonPoints, setPolygonPoints] = React.useState<Array<{ x: number; y: number }>>([])
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null)
  const drawingOverlayRef = React.useRef<HTMLDivElement>(null)

  // Escuta de eventos globais de desenho e seleção (compatibilidade reversa)
  React.useEffect(() => {
    const handleStartDraw = (e: any) => {
      if (!structureConfig?.isFreeCanvasActive && onUpdateStructureConfig && structureConfig) {
        onUpdateStructureConfig({
          ...structureConfig,
          isFreeCanvasActive: true
        })
      }
      setDrawingMode(e.detail?.mode || 'rect')
      setDrawingStart(null)
      setDrawingCurrent(null)
      setPolygonPoints([])
      setMousePos(null)
    }

    const handleCancelDraw = () => {
      setDrawingMode(null)
      setDrawingStart(null)
      setDrawingCurrent(null)
      setPolygonPoints([])
      setMousePos(null)
    }

    const handleSelectZoneEvent = (e: any) => {
      selectZone(e.detail?.zoneId || null)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelDraw()
      }
    }

    window.addEventListener('cv-canvas-start-draw' as any, handleStartDraw)
    window.addEventListener('cv-canvas-cancel-draw' as any, handleCancelDraw)
    window.addEventListener('cv-canvas-select-zone' as any, handleSelectZoneEvent)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('cv-canvas-start-draw' as any, handleStartDraw)
      window.removeEventListener('cv-canvas-cancel-draw' as any, handleCancelDraw)
      window.removeEventListener('cv-canvas-select-zone' as any, handleSelectZoneEvent)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [structureConfig, onUpdateStructureConfig, setDrawingMode, selectZone])

  const handleSelectZone = (zoneId: string) => {
    selectZone(zoneId)
  }

  const handleDeleteZone = (zoneId: string) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const nextZones = (structureConfig.customZones || []).filter(z => z.id !== zoneId)
    onUpdateStructureConfig({
      ...structureConfig,
      customZones: nextZones
    })
    if (selectedZoneId === zoneId) selectZone(null)
  }

  const handleCancelDrawing = () => {
    setDrawingMode(null)
    setDrawingStart(null)
    setDrawingCurrent(null)
    setPolygonPoints([])
    setMousePos(null)
  }

  const getPointFromEvent = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  }

  const handleDrawingPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (drawingMode !== 'rect') return
    e.preventDefault()
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
    const pt = getPointFromEvent(e)
    setDrawingStart(pt)
    setDrawingCurrent(pt)
  }

  const handleDrawingPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = getPointFromEvent(e)
    if (drawingMode === 'rect' && drawingStart) {
      setDrawingCurrent(pt)
    } else if (drawingMode === 'polygon') {
      setMousePos(pt)
    }
  }

  const handleDrawingPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawingMode !== 'rect' || !drawingStart) return
    e.preventDefault()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}

    const cur = drawingCurrent || drawingStart
    const minX = Math.min(drawingStart.x, cur.x)
    const minY = Math.min(drawingStart.y, cur.y)
    const rawW = Math.abs(cur.x - drawingStart.x)
    const rawH = Math.abs(cur.y - drawingStart.y)

    let finalX = minX
    let finalY = minY
    let finalW = rawW
    let finalH = rawH

    if (rawW < 2 && rawH < 2) {
      finalW = 35
      finalH = 25
      finalX = Math.max(0, Math.min(65, Math.round((drawingStart.x - 17.5) * 10) / 10))
      finalY = Math.max(0, Math.min(75, Math.round((drawingStart.y - 12.5) * 10) / 10))
    }

    const newZone: CustomCanvasZone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: finalW < 40 && finalH > 50 ? 'Sidebar Personalizada' : 'Box Personalizado',
      shape: 'rect',
      x: Math.round(finalX * 10) / 10,
      y: Math.round(finalY * 10) / 10,
      width: Math.round(finalW * 10) / 10,
      height: Math.round(finalH * 10) / 10,
      backgroundColor: 'rgba(30, 41, 59, 0.12)',
      borderColor: '#0284c7',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 6,
      backgroundOpacity: 1
    }

    const updatedZones = [...(structureConfig?.customZones || []), newZone]
    if (onUpdateStructureConfig && structureConfig) {
      onUpdateStructureConfig({
        ...structureConfig,
        isFreeCanvasActive: true,
        customZones: updatedZones
      })
    }

    selectZone(newZone.id)
    setDrawingMode(null)
    setDrawingStart(null)
    setDrawingCurrent(null)
  }

  const finishPolygon = (points: Array<{ x: number; y: number }>) => {
    const newZone: CustomCanvasZone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: 'Polígono Personalizado',
      shape: 'polygon',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: points,
      backgroundColor: 'rgba(30, 41, 59, 0.12)',
      borderColor: '#0284c7',
      borderWidth: 1,
      borderStyle: 'solid',
      borderRadius: 0,
      backgroundOpacity: 1
    }

    const updatedZones = [...(structureConfig?.customZones || []), newZone]
    if (onUpdateStructureConfig && structureConfig) {
      onUpdateStructureConfig({
        ...structureConfig,
        isFreeCanvasActive: true,
        customZones: updatedZones
      })
    }

    selectZone(newZone.id)
    setDrawingMode(null)
    setPolygonPoints([])
    setMousePos(null)
  }

  const handleDrawingClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drawingMode !== 'polygon') return
    const pt = getPointFromEvent(e)

    if (polygonPoints.length >= 3) {
      const p0 = polygonPoints[0]
      const dist = Math.hypot(pt.x - p0.x, pt.y - p0.y)
      if (dist < 4) {
        finishPolygon(polygonPoints)
        return
      }
    }

    setPolygonPoints(prev => [...prev, pt])
  }

  const handleDrawingDoubleClick = () => {
    if (drawingMode !== 'polygon' || polygonPoints.length < 3) return
    finishPolygon(polygonPoints)
  }

  const handleZoneMovePointerDown = (
    e: React.PointerEvent<HTMLElement>,
    zone: CustomCanvasZone
  ) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    selectZone(zone.id)

    const targetEl = e.currentTarget
    targetEl.setPointerCapture(e.pointerId)
    setDraggingZoneId(zone.id)

    const startX = e.clientX
    const startY = e.clientY
    const startZoneX = zone.x
    const startZoneY = zone.y

    const zoneEl = document.getElementById(`custom_zone_${zone.id}`)
    const cardEl = zoneEl?.closest('.cv-card') || containerRef?.current
    const cardRect = cardEl?.getBoundingClientRect() || { width: 794, height: 1122 }

    let latestX = startZoneX
    let latestY = startZoneY

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const dxPx = moveEvt.clientX - startX
      const dyPx = moveEvt.clientY - startY

      const dxPct = (dxPx / cardRect.width) * 100
      const dyPct = (dyPx / cardRect.height) * 100

      latestX = Math.max(0, Math.min(100 - zone.width, Math.round((startZoneX + dxPct) * 10) / 10))
      latestY = Math.max(0, Math.min(100 - zone.height, Math.round((startZoneY + dyPct) * 10) / 10))

      if (zoneEl) {
        zoneEl.style.left = `${latestX}%`
        zoneEl.style.top = `${latestY}%`
      }
    }

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault()
      try {
        targetEl.releasePointerCapture(upEvt.pointerId)
      } catch {}
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      setDraggingZoneId(null)

      if (!structureConfig || !onUpdateStructureConfig) return
      const nextZones = (structureConfig.customZones || []).map(z => {
        if (z.id === zone.id) {
          return { ...z, x: latestX, y: latestY }
        }
        return z
      })
      onUpdateStructureConfig({
        ...structureConfig,
        customZones: nextZones
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const handleZoneResizePointerDown = (
    e: React.PointerEvent<HTMLElement>,
    zone: CustomCanvasZone,
    handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'se' | 'sw'
  ) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    selectZone(zone.id)

    const targetEl = e.currentTarget
    targetEl.setPointerCapture(e.pointerId)

    const startX = e.clientX
    const startY = e.clientY
    const startZoneX = zone.x
    const startZoneY = zone.y
    const startZoneW = zone.width
    const startZoneH = zone.height

    const zoneEl = document.getElementById(`custom_zone_${zone.id}`)
    const cardEl = zoneEl?.closest('.cv-card') || containerRef?.current
    const cardRect = cardEl?.getBoundingClientRect() || { width: 794, height: 1122 }

    let latestX = startZoneX
    let latestY = startZoneY
    let latestW = startZoneW
    let latestH = startZoneH

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const dxPx = moveEvt.clientX - startX
      const dyPx = moveEvt.clientY - startY

      const dxPct = (dxPx / cardRect.width) * 100
      const dyPct = (dyPx / cardRect.height) * 100

      if (handle === 'w' || handle === 'nw' || handle === 'sw') {
        const candidateX = Math.max(0, Math.min(startZoneX + startZoneW - 4, startZoneX + dxPct))
        latestX = Math.round(candidateX * 10) / 10
        latestW = Math.round((startZoneW - (latestX - startZoneX)) * 10) / 10
      } else if (handle === 'e' || handle === 'ne' || handle === 'se') {
        const candidateW = Math.max(4, Math.min(100 - startZoneX, startZoneW + dxPct))
        latestW = Math.round(candidateW * 10) / 10
      }

      if (handle === 'n' || handle === 'nw' || handle === 'ne') {
        const candidateY = Math.max(0, Math.min(startZoneY + startZoneH - 3, startZoneY + dyPct))
        latestY = Math.round(candidateY * 10) / 10
        latestH = Math.round((startZoneH - (latestY - startZoneY)) * 10) / 10
      } else if (handle === 's' || handle === 'sw' || handle === 'se') {
        const candidateH = Math.max(3, Math.min(100 - startZoneY, startZoneH + dyPct))
        latestH = Math.round(candidateH * 10) / 10
      }

      if (zoneEl) {
        zoneEl.style.left = `${latestX}%`
        zoneEl.style.top = `${latestY}%`
        zoneEl.style.width = `${latestW}%`
        zoneEl.style.height = `${latestH}%`
      }
    }

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault()
      try {
        targetEl.releasePointerCapture(upEvt.pointerId)
      } catch {}
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      if (!structureConfig || !onUpdateStructureConfig) return
      const nextZones = (structureConfig.customZones || []).map(z => {
        if (z.id === zone.id) {
          return {
            ...z,
            x: latestX,
            y: latestY,
            width: latestW,
            height: latestH
          }
        }
        return z
      })
      onUpdateStructureConfig({
        ...structureConfig,
        customZones: nextZones
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const zones = structureConfig?.customZones || []

  return (
    <>
      {zones.length > 0 && (
        <div className="cv-custom-zones-container">
          {zones.map(zone => {
            const isSelected = selectedZoneId === zone.id

            if (zone.shape === 'polygon' && zone.points && zone.points.length >= 3) {
              const clipPathVal = `polygon(${zone.points.map(p => `${p.x}% ${p.y}%`).join(', ')})`
              return (
                <div
                  key={zone.id}
                  id={`custom_zone_${zone.id}`}
                  className={`cv-custom-zone-item cv-custom-zone-polygon ${isSelected ? 'is-selected' : ''}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    clipPath: clipPathVal,
                    backgroundColor: zone.backgroundColor || 'rgba(30, 41, 59, 0.12)',
                    opacity: zone.backgroundOpacity ?? 1,
                    backgroundImage: zone.backgroundImage && zone.backgroundImage !== 'none' ? `url("${zone.backgroundImage}")` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    zIndex: 0,
                    pointerEvents: isFreeCanvas ? 'auto' : 'none'
                  }}
                  onClick={(e) => {
                    if (isFreeCanvas) {
                      e.stopPropagation()
                      handleSelectZone(zone.id)
                    }
                  }}
                >
                  {isFreeCanvas && isSelected && (
                    <div className="cv-custom-zone-badge cv-no-print" data-cv-interactive="true" style={{ left: `${zone.points[0].x}%`, top: `${zone.points[0].y}%` }}>
                      <span>📐 {zone.label}</span>
                      <button
                        type="button"
                        className="cv-custom-zone-del"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteZone(zone.id)
                        }}
                        title="Excluir polígono"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div
                key={zone.id}
                id={`custom_zone_${zone.id}`}
                className={`cv-custom-zone-item cv-custom-zone-rect ${isSelected ? 'is-selected' : ''} ${draggingZoneId === zone.id ? 'is-dragging' : ''}`}
                style={{
                  position: 'absolute',
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  backgroundColor: zone.backgroundColor || 'rgba(30, 41, 59, 0.12)',
                  opacity: zone.backgroundOpacity ?? 1,
                  backgroundImage: zone.backgroundImage && zone.backgroundImage !== 'none' ? `url("${zone.backgroundImage}")` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderColor: zone.borderColor || 'transparent',
                  borderWidth: `${zone.borderWidth ?? 0}px`,
                  borderStyle: zone.borderStyle || 'solid',
                  borderRadius: `${zone.borderRadius ?? 0}px`,
                  zIndex: 0,
                  pointerEvents: isFreeCanvas ? 'auto' : 'none',
                  boxSizing: 'border-box'
                }}
                onClick={(e) => {
                  if (isFreeCanvas) {
                    e.stopPropagation()
                    handleSelectZone(zone.id)
                  }
                }}
                onPointerDown={(e) => {
                  if (isFreeCanvas && isSelected) {
                    handleZoneMovePointerDown(e, zone)
                  }
                }}
              >
                {isFreeCanvas && isSelected && (
                  <>
                    <div className="cv-custom-zone-badge cv-no-print" data-cv-interactive="true">
                      <span
                        className="cv-zone-drag-handle"
                        onPointerDown={(e) => handleZoneMovePointerDown(e, zone)}
                        title="Arrastar para reposicionar na folha"
                      >
                        ⠿ Mover
                      </span>
                      <span>📐 {zone.label}</span>
                      <span className="cv-zone-dim-pill">
                        L: {Math.round(zone.width)}% | A: {Math.round(zone.height)}%
                      </span>
                      <button
                        type="button"
                        className="cv-custom-zone-del"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteZone(zone.id)
                        }}
                        title="Excluir área"
                      >
                        ✕
                      </button>
                    </div>

                    <div
                      className="cv-zone-resize-handle cv-zone-resize-handle--nw cv-no-print"
                      data-cv-interactive="true"
                      onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'nw')}
                      title="Redimensionar canto superior esquerdo"
                    />
                    <div
                      className="cv-zone-resize-handle cv-zone-resize-handle--ne cv-no-print"
                      data-cv-interactive="true"
                      onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'ne')}
                      title="Redimensionar canto superior direito"
                    />
                    <div
                      className="cv-zone-resize-handle cv-zone-resize-handle--se cv-no-print"
                      data-cv-interactive="true"
                      onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'se')}
                      title="Redimensionar canto inferior direito"
                    />
                    <div
                      className="cv-zone-resize-handle cv-zone-resize-handle--sw cv-no-print"
                      data-cv-interactive="true"
                      onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'sw')}
                      title="Redimensionar canto inferior esquerdo"
                    />
                    <div
                      className="cv-zone-resize-handle cv-zone-resize-handle--n cv-no-print"
                      data-cv-interactive="true"
                      onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'n')}
                      title="Redimensionar topo (altura)"
                    />
                    <div
                      className="cv-zone-resize-handle cv-zone-resize-handle--s cv-no-print"
                      data-cv-interactive="true"
                      onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 's')}
                      title="Redimensionar base (altura)"
                    />
                    <div
                      className="cv-zone-resize-handle cv-zone-resize-handle--w cv-no-print"
                      data-cv-interactive="true"
                      onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'w')}
                      title="Redimensionar esquerda (largura)"
                    />
                    <div
                      className="cv-zone-resize-handle cv-zone-resize-handle--e cv-no-print"
                      data-cv-interactive="true"
                      onPointerDown={(e) => handleZoneResizePointerDown(e, zone, 'e')}
                      title="Redimensionar direita (largura)"
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {Boolean(drawingMode) && (
        <div
          ref={drawingOverlayRef}
          className="cv-canvas-drawing-overlay cv-no-print"
          data-cv-interactive="true"
          onPointerDown={handleDrawingPointerDown}
          onPointerMove={handleDrawingPointerMove}
          onPointerUp={handleDrawingPointerUp}
          onClick={handleDrawingClick}
          onDoubleClick={handleDrawingDoubleClick}
        >
          <div className="cv-drawing-instruction-banner">
            {drawingMode === 'rect' ? (
              <span>🖱️ <strong>Modo Desenho:</strong> Clique e arraste para desenhar (ou clique para criar um box padrão)</span>
            ) : (
              <span>📐 <strong>Modo Polígono:</strong> Clique para marcar os vértices ({polygonPoints.length} marcados). Duplo clique para fechar.</span>
            )}
            <button
              type="button"
              className="cv-drawing-cancel-btn"
              onClick={handleCancelDrawing}
            >
              Cancelar (Esc)
            </button>
          </div>

          {drawingMode === 'rect' && drawingStart && drawingCurrent && (
            <div
              style={{
                position: 'absolute',
                left: `${Math.min(drawingStart.x, drawingCurrent.x)}%`,
                top: `${Math.min(drawingStart.y, drawingCurrent.y)}%`,
                width: `${Math.abs(drawingCurrent.x - drawingStart.x)}%`,
                height: `${Math.abs(drawingCurrent.y - drawingStart.y)}%`,
                border: '2px dashed #38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                borderRadius: '6px',
                pointerEvents: 'none'
              }}
            />
          )}

          {drawingMode === 'polygon' && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            >
              {polygonPoints.length > 0 && (
                <polyline
                  points={
                    polygonPoints.map(p => `${p.x},${p.y}`).join(' ') +
                    (mousePos ? ` ${mousePos.x},${mousePos.y}` : '')
                  }
                  fill="rgba(56, 189, 248, 0.15)"
                  stroke="#38bdf8"
                  strokeWidth="0.6"
                  strokeDasharray="1 1"
                />
              )}
              {polygonPoints.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r="1"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="0.3"
                />
              ))}
            </svg>
          )}
        </div>
      )}
    </>
  )
}
