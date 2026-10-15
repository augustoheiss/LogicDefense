import React from 'react'
import {
  createStudioElement,
  type CustomCanvasZone,
  type CanvasStudioElement,
  type LayoutStructureConfig,
  type StudioElementType
} from '../../../types/cv'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { CanvasContainerFrame } from '../../CanvasBuilder/CanvasContainerFrame'
import { InlineRichSpanEditor } from '../../CanvasBuilder/InlineRichSpanEditor'
import { CadEuclideanRulers } from '../../CanvasBuilder/CadEuclideanRulers'

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
  const selectedElementId = useCanvasStore((s) => s.selectedElementId)
  const selectZone = useCanvasStore((s) => s.selectZone)
  const selectElement = useCanvasStore((s) => s.selectElement)
  const drawingMode = useCanvasStore((s) => s.activeDrawingMode)
  const setDrawingMode = useCanvasStore((s) => s.setDrawingMode)

  const [drawingStart, setDrawingStart] = React.useState<{ x: number; y: number } | null>(null)
  const [drawingCurrent, setDrawingCurrent] = React.useState<{ x: number; y: number } | null>(null)
  const [polygonPoints, setPolygonPoints] = React.useState<Array<{ x: number; y: number }>>([])
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null)
  const drawingOverlayRef = React.useRef<HTMLDivElement>(null)
  const fallbackContainerRef = React.useRef<HTMLDivElement | null>(null)
  const activePageRef = containerRef || fallbackContainerRef

  // Escuta de eventos globais de desenho, criação de elementos livres e seleção
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

    const handleAddFreeStudioElement = (e: any) => {
      if (!structureConfig || !onUpdateStructureConfig) return
      const type: StudioElementType = e.detail?.type || 'rich_row'
      const currentFree = structureConfig.freeStudioElements || []
      const offsetPct = (currentFree.length * 4) % 40
      const newEl = createStudioElement(type, {
        darkBackground: false,
        accentColor: '#0284c7',
        x: 34,
        y: 8 + offsetPct,
        width: 58
      })
      onUpdateStructureConfig({
        ...structureConfig,
        isFreeCanvasActive: true,
        freeStudioElements: [...currentFree, newEl]
      })
      setDrawingMode(null)
      selectElement(newEl.id, newEl.spans[0]?.id || null)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelDraw()
        selectElement(null, null)
      }
    }

    window.addEventListener('cv-canvas-start-draw' as any, handleStartDraw)
    window.addEventListener('cv-canvas-cancel-draw' as any, handleCancelDraw)
    window.addEventListener('cv-canvas-select-zone' as any, handleSelectZoneEvent)
    window.addEventListener('cv-studio-add-free-element' as any, handleAddFreeStudioElement)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('cv-canvas-start-draw' as any, handleStartDraw)
      window.removeEventListener('cv-canvas-cancel-draw' as any, handleCancelDraw)
      window.removeEventListener('cv-canvas-select-zone' as any, handleSelectZoneEvent)
      window.removeEventListener('cv-studio-add-free-element' as any, handleAddFreeStudioElement)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [structureConfig, onUpdateStructureConfig, setDrawingMode, selectZone, selectElement])

  const handleUpdateZone = (updatedZone: CustomCanvasZone) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const nextZones = (structureConfig.customZones || []).map((z) =>
      z.id === updatedZone.id ? updatedZone : z
    )
    onUpdateStructureConfig({
      ...structureConfig,
      customZones: nextZones
    })
  }

  const handleDeleteZone = (zoneId: string) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const nextZones = (structureConfig.customZones || []).filter((z) => z.id !== zoneId)
    onUpdateStructureConfig({
      ...structureConfig,
      customZones: nextZones
    })
    if (selectedZoneId === zoneId) selectZone(null)
  }

  const handleUpdateFreeElement = (elId: string, updated: CanvasStudioElement) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const nextFree = (structureConfig.freeStudioElements || []).map((el) =>
      el.id === elId ? updated : el
    )
    onUpdateStructureConfig({
      ...structureConfig,
      freeStudioElements: nextFree
    })
  }

  const handleDeleteFreeElement = (elId: string) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const nextFree = (structureConfig.freeStudioElements || []).filter((el) => el.id !== elId)
    onUpdateStructureConfig({
      ...structureConfig,
      freeStudioElements: nextFree
    })
    selectElement(null, null)
  }

  const handleDuplicateFreeElement = (elId: string) => {
    if (!structureConfig || !onUpdateStructureConfig) return
    const list = structureConfig.freeStudioElements || []
    const orig = list.find((e) => e.id === elId)
    if (!orig) return
    const uid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
    const copy: CanvasStudioElement = {
      ...orig,
      id: `${orig.id}-copy-${uid}`,
      y: Math.min(92, (orig.y ?? 10) + 4),
      spans: orig.spans.map((s, i) => ({ ...s, id: `sp-${uid}-${i}` }))
    }
    onUpdateStructureConfig({
      ...structureConfig,
      freeStudioElements: [...list, copy]
    })
    selectElement(copy.id, copy.spans[0]?.id || null)
  }

  // Arraste livre para elementos soltos diretamente na página (permite estacionar fora da visão do currículo: -45% a 115%)
  const handleStartDragFreeElement = (e: React.MouseEvent, el: CanvasStudioElement) => {
    if (!isFreeCanvas || !structureConfig || !onUpdateStructureConfig) return
    e.stopPropagation()
    e.preventDefault()

    const cardEl =
      (e.currentTarget as HTMLElement).closest('.cv-card') || activePageRef.current
    const rect = cardEl?.getBoundingClientRect() || { width: 794, height: 1122 }
    const startX = e.clientX
    const startY = e.clientY
    const origX = el.x ?? 10
    const origY = el.y ?? 10

    const onMove = (ev: MouseEvent) => {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100
      const dyPct = ((ev.clientY - startY) / rect.height) * 100
      const nextX = Math.max(-45, Math.min(115, Number((origX + dxPct).toFixed(1))))
      const nextY = Math.max(-35, Math.min(115, Number((origY + dyPct).toFixed(1))))
      handleUpdateFreeElement(el.id, { ...el, x: nextX, y: nextY })
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleCancelDrawing = () => {
    setDrawingMode(null)
    setDrawingStart(null)
    setDrawingCurrent(null)
    setPolygonPoints([])
    setMousePos(null)
  }

  const getPointFromEvent = (
    e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
  ) => {
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
      finalW = 30
      finalH = 100
      finalX = 0
      finalY = 0
    }

    const isSidebarShape = finalW <= 42 && finalH >= 45
    const starterElements: CanvasStudioElement[] = [
      createStudioElement('heading', {
        darkBackground: true,
        accentColor: '#38bdf8'
      }),
      createStudioElement('rich_row', {
        darkBackground: true,
        accentColor: '#38bdf8'
      })
    ]

    const newZone: CustomCanvasZone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: isSidebarShape ? 'Sidebar Estúdio' : 'Container / Box Estúdio',
      shape: 'rect',
      x: Math.round(finalX * 10) / 10,
      y: Math.round(finalY * 10) / 10,
      width: Math.round(finalW * 10) / 10,
      height: Math.round(finalH * 10) / 10,
      backgroundColor: '#0f172a',
      borderColor: '#0284c7',
      borderWidth: 1,
      borderStyle: 'solid',
      borderRadius: isSidebarShape ? 0 : 8,
      backgroundOpacity: 0.96,
      paddingPx: 16,
      contentGapPx: 6,
      zIndex: 2,
      elements: starterElements
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
    // Calcula a Bounding Box do polígono para permitir mover, redimensionar e colocar títulos dentro!
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const boxW = Math.max(10, maxX - minX)
    const boxH = Math.max(10, maxY - minY)

    const relativePoints = points.map((p) => ({
      x: Number((((p.x - minX) / boxW) * 100).toFixed(1)),
      y: Number((((p.y - minY) / boxH) * 100).toFixed(1))
    }))

    const starterElements: CanvasStudioElement[] = [
      createStudioElement('heading', {
        darkBackground: true,
        accentColor: '#38bdf8'
      }),
      createStudioElement('rich_row', {
        darkBackground: true,
        accentColor: '#38bdf8'
      })
    ]

    const newZone: CustomCanvasZone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: 'Polígono / Sidebar CAD',
      shape: 'polygon',
      x: Number(minX.toFixed(1)),
      y: Number(minY.toFixed(1)),
      width: Number(boxW.toFixed(1)),
      height: Number(boxH.toFixed(1)),
      points: relativePoints,
      backgroundColor: '#0f172a',
      borderColor: '#38bdf8',
      borderWidth: 1.5,
      borderStyle: 'solid',
      borderRadius: 0,
      backgroundOpacity: 0.94,
      paddingPx: 18,
      contentGapPx: 6,
      zIndex: 2,
      elements: starterElements
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

    setPolygonPoints((prev) => [...prev, pt])
  }

  const handleDrawingDoubleClick = () => {
    if (drawingMode !== 'polygon' || polygonPoints.length < 3) return
    finishPolygon(polygonPoints)
  }

  const zones = structureConfig?.customZones || []
  const freeElements = structureConfig?.freeStudioElements || []

  return (
    <div
      ref={fallbackContainerRef}
      className="cv-decorations-master-layer"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none'
      }}
    >
      {/* 1. Réguas Milimétricas Euclidianas (0-210mm x 0-297mm), Grade e Linhas Laser OSNAP (AutoCAD) */}
      <CadEuclideanRulers isInteractive={isFreeCanvas} />

      {/* 2. Sidebars, Zonas e Polígonos Vivos (CanvasContainerFrame) */}
      {zones.length > 0 && (
        <div className="cv-custom-zones-container">
          {zones.map((zone) => (
            <CanvasContainerFrame
              key={zone.id}
              zone={zone}
              isInteractive={isFreeCanvas}
              isSelected={selectedZoneId === zone.id}
              onSelect={() => selectZone(zone.id)}
              onUpdateZone={handleUpdateZone}
              onDeleteZone={() => handleDeleteZone(zone.id)}
              pageContainerRef={activePageRef}
            />
          ))}
        </div>
      )}

      {/* 3. Elementos Livres Soltos na Folha (Títulos, Frases Lado a Lado, Callouts CAD) */}
      {freeElements.length > 0 && (
        <div className="cv-free-studio-elements-layer">
          {freeElements.map((el) => {
            const isThisElSelected = selectedElementId === el.id
            return (
              <div
                key={el.id}
                className="cv-free-studio-element-box"
                style={{
                  position: 'absolute',
                  left: `${el.x ?? 35}%`,
                  top: `${el.y ?? 12}%`,
                  width: `${el.width ?? 55}%`,
                  zIndex: isThisElSelected ? 105 : el.zIndex ?? 15,
                  pointerEvents: 'auto'
                }}
              >
                {isFreeCanvas && !isThisElSelected && (
                  <div
                    className="cv-free-element-drag-pill cv-no-print"
                    data-cv-interactive="true"
                    onMouseDown={(e) => handleStartDragFreeElement(e, el)}
                    title="Arraste para posicionar este título/frase em qualquer ponto da folha (ou fora dela)"
                  >
                    ✥ Mover ({((el.x ?? 35) * 2.1).toFixed(0)}mm, {((el.y ?? 12) * 2.97).toFixed(0)}mm)
                  </div>
                )}
                <InlineRichSpanEditor
                  element={el}
                  isInteractive={isFreeCanvas}
                  darkContext={false}
                  onChange={(updated) => handleUpdateFreeElement(el.id, updated)}
                  onDelete={() => handleDeleteFreeElement(el.id)}
                  onDuplicateElement={() => handleDuplicateFreeElement(el.id)}
                  onStartDragElement={(e) => handleStartDragFreeElement(e, el)}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* 4. Overlay Interativo de Desenho Direto (MS Paint + AutoCAD Polygon) */}
      {Boolean(drawingMode) && (
        <div
          ref={drawingOverlayRef}
          className="cv-canvas-drawing-overlay cv-no-print"
          data-cv-interactive="true"
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDrawingPointerDown}
          onPointerMove={handleDrawingPointerMove}
          onPointerUp={handleDrawingPointerUp}
          onClick={handleDrawingClick}
          onDoubleClick={handleDrawingDoubleClick}
        >
          <div className="cv-drawing-instruction-banner">
            {drawingMode === 'rect' ? (
              <span>
                🖱️ <strong>Desenhar Sidebar / Container:</strong> Clique e arraste na folha (ela já
                nascerá pronta para receber títulos e frases com fontes/cores próprias!)
              </span>
            ) : (
              <span>
                📐 <strong>Polígono CAD / Sidebar Angulada:</strong> Clique nos vértices (
                {polygonPoints.length} marcados). Duplo clique ou clique no ponto inicial para fechar.
              </span>
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
                backgroundColor: 'rgba(15, 23, 42, 0.35)',
                borderRadius: '6px',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              {(((Math.abs(drawingCurrent.x - drawingStart.x)) / 100) * 210).toFixed(1)}mm ×{' '}
              {(((Math.abs(drawingCurrent.y - drawingStart.y)) / 100) * 297).toFixed(1)}mm
            </div>
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
                    polygonPoints.map((p) => `${p.x},${p.y}`).join(' ') +
                    (mousePos ? ` ${mousePos.x},${mousePos.y}` : '')
                  }
                  fill="rgba(56, 189, 248, 0.18)"
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
                  r="1.1"
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="0.3"
                />
              ))}
            </svg>
          )}
        </div>
      )}
    </div>
  )
}
