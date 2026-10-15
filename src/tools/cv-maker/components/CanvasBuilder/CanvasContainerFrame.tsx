import React, { useRef } from 'react'
import {
  createStudioElement,
  type CustomCanvasZone,
  type CanvasStudioElement,
  type StudioElementType
} from '../../types/cv'
import { useCanvasStore } from '../../store/useCanvasStore'
import { InlineRichSpanEditor } from './InlineRichSpanEditor'

interface CanvasContainerFrameProps {
  zone: CustomCanvasZone
  isInteractive: boolean
  isSelected: boolean
  onSelect: () => void
  onUpdateZone: (updated: CustomCanvasZone) => void
  onDeleteZone: () => void
  pageContainerRef: React.RefObject<HTMLDivElement | null>
}

const SNAP_TARGETS_PCT = [0, 5, 10, 25, 28, 30, 33.33, 50, 66.67, 70, 72, 75, 90, 95, 100]
const SNAP_THRESHOLD_PCT = 1.1

function isDarkHex(color?: string): boolean {
  if (!color) return true
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance < 0.55
  }
  return true
}

export const CanvasContainerFrame: React.FC<CanvasContainerFrameProps> = ({
  zone,
  isInteractive,
  isSelected,
  onSelect,
  onUpdateZone,
  onDeleteZone,
  pageContainerRef
}) => {
  const {
    snapEnabled,
    setActiveSnapLines,
    selectElement
  } = useCanvasStore()

  const frameRef = useRef<HTMLDivElement | null>(null)

  const elements = zone.elements || []
  const isDarkBg = isDarkHex(zone.backgroundColor || '#0f172a')

  // Conversão para milímetros reais (base A4 210mm x 297mm)
  const widthMm = ((zone.width / 100) * 210).toFixed(1)
  const heightMm = ((zone.height / 100) * 297).toFixed(1)
  const xMm = ((zone.x / 100) * 210).toFixed(1)
  const yMm = ((zone.y / 100) * 297).toFixed(1)

  const applyMagneticSnap = (
    rawX: number,
    rawY: number,
    rawW: number,
    rawH: number
  ): { x: number; y: number; w: number; h: number } => {
    if (!snapEnabled) {
      setActiveSnapLines([])
      return { x: rawX, y: rawY, w: rawW, h: rawH }
    }

    let x = rawX
    let y = rawY
    const w = rawW
    const h = rawH
    const guides: Array<{ type: 'x' | 'y'; posPct: number; label?: string }> = []

    for (const target of SNAP_TARGETS_PCT) {
      if (Math.abs(x - target) <= SNAP_THRESHOLD_PCT) {
        x = target
        guides.push({
          type: 'x',
          posPct: target,
          label: `${((target / 100) * 210).toFixed(0)}mm (${target}%)`
        })
        break
      }
      if (Math.abs(x + w - target) <= SNAP_THRESHOLD_PCT) {
        x = target - w
        guides.push({
          type: 'x',
          posPct: target,
          label: `${((target / 100) * 210).toFixed(0)}mm (${target}%)`
        })
        break
      }
    }

    for (const target of SNAP_TARGETS_PCT) {
      if (Math.abs(y - target) <= SNAP_THRESHOLD_PCT) {
        y = target
        guides.push({
          type: 'y',
          posPct: target,
          label: `${((target / 100) * 297).toFixed(0)}mm (${target}%)`
        })
        break
      }
      if (Math.abs(y + h - target) <= SNAP_THRESHOLD_PCT) {
        y = target - h
        guides.push({
          type: 'y',
          posPct: target,
          label: `${((target / 100) * 297).toFixed(0)}mm (${target}%)`
        })
        break
      }
    }

    setActiveSnapLines(guides)
    return { x, y, w, h }
  }

  // Arraste da Zona / Sidebar inteira
  const handleStartDragZone = (e: React.MouseEvent) => {
    if (!isInteractive) return
    e.stopPropagation()
    e.preventDefault()
    onSelect()

    const pageEl = pageContainerRef.current
    if (!pageEl) return
    const rect = pageEl.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const origX = zone.x
    const origY = zone.y

    const handleMove = (ev: MouseEvent) => {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100
      const dyPct = ((ev.clientY - startY) / rect.height) * 100

      const clampedX = Math.max(0, Math.min(100 - zone.width, origX + dxPct))
      const clampedY = Math.max(0, Math.min(100 - zone.height, origY + dyPct))

      const snapped = applyMagneticSnap(clampedX, clampedY, zone.width, zone.height)

      onUpdateZone({
        ...zone,
        x: Number(snapped.x.toFixed(2)),
        y: Number(snapped.y.toFixed(2))
      })
    }

    const handleUp = () => {
      setActiveSnapLines([])
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  // Redimensionamento contínuo da Zona / Sidebar
  const handleStartResizeZone = (
    e: React.MouseEvent,
    direction: 'e' | 's' | 'se' | 'w'
  ) => {
    if (!isInteractive) return
    e.stopPropagation()
    e.preventDefault()
    onSelect()

    const pageEl = pageContainerRef.current
    if (!pageEl) return
    const rect = pageEl.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const origW = zone.width
    const origH = zone.height
    const origX = zone.x

    const handleMove = (ev: MouseEvent) => {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100
      const dyPct = ((ev.clientY - startY) / rect.height) * 100

      let nextX = origX
      let nextW = origW
      let nextH = origH

      if (direction === 'e' || direction === 'se') {
        nextW = Math.max(8, Math.min(100 - origX, origW + dxPct))
      }
      if (direction === 'w') {
        const deltaW = Math.min(origW - 8, dxPct)
        nextX = Math.max(0, origX + deltaW)
        nextW = Math.max(8, origW - deltaW)
      }
      if (direction === 's' || direction === 'se') {
        nextH = Math.max(4, Math.min(100 - zone.y, origH + dyPct))
      }

      if (snapEnabled) {
        for (const target of SNAP_TARGETS_PCT) {
          if (Math.abs(nextX + nextW - target) <= SNAP_THRESHOLD_PCT) {
            nextW = target - nextX
            setActiveSnapLines([
              {
                type: 'x',
                posPct: target,
                label: `${((target / 100) * 210).toFixed(0)}mm (${target}%)`
              }
            ])
            break
          }
        }
      }

      onUpdateZone({
        ...zone,
        x: Number(nextX.toFixed(2)),
        width: Number(nextW.toFixed(2)),
        height: Number(nextH.toFixed(2))
      })
    }

    const handleUp = () => {
      setActiveSnapLines([])
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  // Arraste de Vértice Individual estilo AutoCAD (quando shape === 'polygon')
  const handleStartVertexDrag = (e: React.MouseEvent, vertexIdx: number) => {
    if (!isInteractive || !zone.points) return
    e.stopPropagation()
    e.preventDefault()

    const frameEl = frameRef.current
    if (!frameEl) return
    const rect = frameEl.getBoundingClientRect()

    const handleMove = (ev: MouseEvent) => {
      const relX = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100))
      const relY = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100))

      const nextPoints = (zone.points || []).map((pt, i) =>
        i === vertexIdx
          ? { x: Number(relX.toFixed(1)), y: Number(relY.toFixed(1)) }
          : pt
      )

      onUpdateZone({
        ...zone,
        points: nextPoints
      })
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  // Adicionar novo elemento rico dentro desta Sidebar / Zona
  const handleAddElement = (type: StudioElementType) => {
    const newEl = createStudioElement(type, {
      darkBackground: isDarkBg,
      accentColor: zone.borderColor || '#38bdf8'
    })
    const nextElements = [...elements, newEl]
    onUpdateZone({
      ...zone,
      elements: nextElements
    })
    selectElement(newEl.id, newEl.spans[0]?.id || null)
  }

  const handleUpdateElement = (elId: string, updated: CanvasStudioElement) => {
    const nextElements = elements.map((el) => (el.id === elId ? updated : el))
    onUpdateZone({
      ...zone,
      elements: nextElements
    })
  }

  const handleDeleteElement = (elId: string) => {
    const nextElements = elements.filter((el) => el.id !== elId)
    onUpdateZone({
      ...zone,
      elements: nextElements
    })
    selectElement(null, null)
  }

  const handleMoveElement = (elId: string, direction: 'up' | 'down') => {
    const idx = elements.findIndex((el) => el.id === elId)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= elements.length) return
    const nextElements = [...elements]
    const [removed] = nextElements.splice(idx, 1)
    nextElements.splice(targetIdx, 0, removed)
    onUpdateZone({
      ...zone,
      elements: nextElements
    })
  }

  const handleDuplicateElement = (elId: string) => {
    const idx = elements.findIndex((el) => el.id === elId)
    if (idx === -1) return
    const orig = elements[idx]
    const uid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
    const copy: CanvasStudioElement = {
      ...orig,
      id: `${orig.id}-copy-${uid}`,
      spans: orig.spans.map((s, i) => ({
        ...s,
        id: `sp-${uid}-${i}`
      }))
    }
    const nextElements = [...elements]
    nextElements.splice(idx + 1, 0, copy)
    onUpdateZone({
      ...zone,
      elements: nextElements
    })
    selectElement(copy.id, copy.spans[0]?.id || null)
  }

  // Cálculo dos pontos SVG para formas especiais (Polígono, Chanfrado CAD)
  const getPolygonPointsAttr = (): string | null => {
    if (zone.shape === 'polygon' && zone.points && zone.points.length >= 3) {
      return zone.points.map((p) => `${p.x},${p.y}`).join(' ')
    }
    if (zone.shape === 'chamfered') {
      // Cantos chanfrados estilo planta técnica AutoCAD
      return '4,0 96,0 100,4 100,96 96,100 4,100 0,96 0,4'
    }
    return null
  }

  const polygonPointsAttr = getPolygonPointsAttr()
  const fillOpacity = zone.backgroundOpacity ?? 1
  const bgColor = zone.backgroundColor || '#0f172a'
  const borderColor = zone.borderColor || '#0284c7'
  const borderWidth = zone.borderWidth ?? 0
  const borderStyle = zone.borderStyle || 'solid'
  const strokeDasharray =
    borderStyle === 'dashed'
      ? '6,4'
      : borderStyle === 'dotted'
      ? '2,3'
      : undefined

  return (
    <div
      ref={frameRef}
      className={`cv-custom-canvas-zone cv-container-frame ${isSelected ? 'selected' : ''} ${
        isInteractive ? 'interactive' : ''
      }`}
      style={{
        position: 'absolute',
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        width: `${zone.width}%`,
        height: `${zone.height}%`,
        zIndex: isSelected ? Math.max(25, zone.zIndex ?? 2) : zone.zIndex ?? 1,
        pointerEvents: isInteractive || elements.length > 0 ? 'auto' : 'none',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        borderRadius:
          zone.shape === 'rounded_arch'
            ? '999px 999px 12px 12px'
            : !polygonPointsAttr
            ? `${zone.borderRadius || 0}px`
            : undefined,
        backgroundColor: !polygonPointsAttr ? bgColor : 'transparent',
        backgroundImage:
          !polygonPointsAttr && zone.backgroundImage
            ? `url(${zone.backgroundImage})`
            : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border:
          !polygonPointsAttr && borderStyle !== 'none' && borderWidth > 0
            ? `${borderWidth}px ${borderStyle} ${borderColor}`
            : isInteractive && isSelected && !polygonPointsAttr
            ? '1.5px dashed #38bdf8'
            : 'none'
      }}
      onClick={(e) => {
        if (!isInteractive) return
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* CAMADA 1: Geometria Vetorial SVG Pura (SkPath nativo para Polígonos e Chanfrados) */}
      {polygonPointsAttr && (
        <svg
          className="cv-zone-vector-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            pointerEvents: 'none',
            overflow: 'visible'
          }}
        >
          <polygon
            points={polygonPointsAttr}
            fill={bgColor}
            fillOpacity={fillOpacity}
            stroke={
              borderStyle !== 'none' && borderWidth > 0
                ? borderColor
                : isInteractive && isSelected
                ? '#38bdf8'
                : 'none'
            }
            strokeWidth={
              borderStyle !== 'none' && borderWidth > 0
                ? borderWidth
                : isInteractive && isSelected
                ? 1.5
                : 0
            }
            strokeDasharray={
              strokeDasharray || (isInteractive && isSelected && borderWidth === 0 ? '4,3' : undefined)
            }
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* CAMADA 2: Barra de Engenharia da Sidebar/Container (AutoCAD + Docx + Paint) — Oculta no PDF */}
      {isInteractive && isSelected && (
        <div
          className="cv-container-frame-toolbar cv-no-print"
          data-cv-interactive="true"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Topo: Identificação, Cota em mm, Formato, Cores e Camada */}
          <div className="cv-frame-toolbar-top">
            <span
              className="cv-frame-drag-grip"
              onMouseDown={handleStartDragZone}
              title="Arraste para mover a Sidebar / Zona pela folha"
            >
              ✥ {zone.label}
            </span>

            <span className="cv-frame-cad-coords" title="Posição e dimensões físicas em milímetros (Escala A4)">
              📐 {widthMm}×{heightMm}mm ({xMm},{yMm}mm)
            </span>

            {/* Seletor de Geometria da Sidebar */}
            <select
              className="cv-frame-mini-select"
              value={zone.shape}
              onChange={(e) => {
                const nextShape = e.target.value as CustomCanvasZone['shape']
                const defaultPoly =
                  nextShape === 'polygon' && (!zone.points || zone.points.length < 3)
                    ? [
                        { x: 0, y: 0 },
                        { x: 100, y: 0 },
                        { x: 88, y: 100 },
                        { x: 0, y: 100 }
                      ]
                    : zone.points
                onUpdateZone({ ...zone, shape: nextShape, points: defaultPoly })
              }}
              title="Formato geométrico da Sidebar / Container"
            >
              <option value="rect">▭ Retangular</option>
              <option value="chamfered">⬡ Chanfrado CAD</option>
              <option value="rounded_arch">🏛️ Arco Editorial</option>
              <option value="polygon">⬠ Polígono Editável</option>
            </select>

            {/* Cor de Fundo (Paint Bucket) */}
            <label className="cv-frame-color-pill" title="Cor de fundo da Sidebar / Zona">
              <span>🪣</span>
              <input
                type="color"
                value={bgColor.startsWith('#') ? bgColor : '#0f172a'}
                onChange={(e) => onUpdateZone({ ...zone, backgroundColor: e.target.value })}
              />
            </label>

            {/* Cor e Espessura da Borda */}
            <label className="cv-frame-color-pill" title="Cor da borda">
              <span>✏️</span>
              <input
                type="color"
                value={borderColor.startsWith('#') ? borderColor : '#0284c7'}
                onChange={(e) =>
                  onUpdateZone({
                    ...zone,
                    borderColor: e.target.value,
                    borderWidth: Math.max(1, zone.borderWidth ?? 1),
                    borderStyle: zone.borderStyle === 'none' ? 'solid' : zone.borderStyle || 'solid'
                  })
                }
              />
            </label>

            {/* Controle de Camada Z-Index */}
            <button
              type="button"
              className="cv-frame-mini-btn"
              onClick={() =>
                onUpdateZone({ ...zone, zIndex: Math.max(0, (zone.zIndex ?? 1) - 1) })
              }
              title="Enviar para trás (Z-Index - 1)"
            >
              🔽
            </button>
            <button
              type="button"
              className="cv-frame-mini-btn"
              onClick={() =>
                onUpdateZone({ ...zone, zIndex: Math.min(40, (zone.zIndex ?? 1) + 1) })
              }
              title="Trazer para frente (Z-Index + 1)"
            >
              🔼
            </button>

            <button
              type="button"
              className="cv-frame-mini-btn danger"
              onClick={onDeleteZone}
              title="Excluir esta Sidebar / Zona"
            >
              🗑️
            </button>
          </div>

          {/* Linha de Inserção Rápida de Conteúdo dentro da Sidebar (Docx + AutoCAD) */}
          <div className="cv-frame-toolbar-insert">
            <span className="cv-frame-insert-label">Inserir dentro:</span>
            <button
              type="button"
              className="cv-frame-insert-btn primary"
              onClick={() => handleAddElement('heading')}
              title="Adicionar um novo Título editável dentro desta Sidebar"
            >
              + Título
            </button>
            <button
              type="button"
              className="cv-frame-insert-btn"
              onClick={() => handleAddElement('subtitle')}
              title="Adicionar um Subtítulo dentro desta Sidebar"
            >
              + Subtítulo
            </button>
            <button
              type="button"
              className="cv-frame-insert-btn highlight"
              onClick={() => handleAddElement('rich_row')}
              title="Adicionar duas ou mais frases lado a lado com fontes e cores diferentes na mesma linha"
            >
              + Frases Lado a Lado
            </button>
            <button
              type="button"
              className="cv-frame-insert-btn"
              onClick={() => handleAddElement('key_value_pair')}
              title="Adicionar par Rótulo + Valor (ex: Território: Setor 04, Contato, Data)"
            >
              + Rótulo:Valor
            </button>
            <button
              type="button"
              className="cv-frame-insert-btn"
              onClick={() => handleAddElement('badge_group')}
              title="Adicionar grupo de pílulas / tags coloridas"
            >
              + Pílulas
            </button>
            <button
              type="button"
              className="cv-frame-insert-btn"
              onClick={() => handleAddElement('paragraph')}
              title="Adicionar parágrafo de texto livre"
            >
              + Texto
            </button>
            <button
              type="button"
              className="cv-frame-insert-btn"
              onClick={() => handleAddElement('divider')}
              title="Adicionar linha divisória"
            >
              + Linha
            </button>
          </div>
        </div>
      )}

      {/* CAMADA 3: Conteúdo Interno da Sidebar / Container (Títulos, Subtítulos, Frases Lado a Lado) */}
      <div
        className="cv-container-frame-body"
        style={{
          position: 'relative',
          zIndex: 2,
          padding: `${zone.paddingPx ?? 16}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${zone.contentGapPx ?? 4}px`,
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          opacity: !polygonPointsAttr ? fillOpacity : 1
        }}
      >
        {elements.map((el) => (
          <InlineRichSpanEditor
            key={el.id}
            element={el}
            isInteractive={isInteractive}
            darkContext={isDarkBg}
            onChange={(updated) => handleUpdateElement(el.id, updated)}
            onDelete={() => handleDeleteElement(el.id)}
            onMoveElement={(dir) => handleMoveElement(el.id, dir)}
            onDuplicateElement={() => handleDuplicateElement(el.id)}
          />
        ))}

        {/* Placeholder interativo quando a Sidebar está vazia (apenas na tela de edição, nunca no PDF) */}
        {isInteractive && isSelected && elements.length === 0 && (
          <div
            className="cv-container-empty-hint cv-no-print"
            data-cv-interactive="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p>
              <strong>{zone.label}</strong> ({widthMm}×{heightMm}mm)
            </p>
            <span>
              Clique em <strong>+ Título</strong>, <strong>+ Subtítulo</strong> ou{' '}
              <strong>+ Frases Lado a Lado</strong> acima para colocar textos com qualquer fonte e
              cor dentro desta área!
            </span>
          </div>
        )}
      </div>

      {/* CAMADA 4: Alças de Redimensionamento e Vértices Editáveis AutoCAD (Ocultos no PDF) */}
      {isInteractive && isSelected && (
        <>
          {/* Alça Leste (Largura Direita) */}
          <div
            className="cv-zone-resize-handle handle-e cv-no-print"
            data-cv-interactive="true"
            onMouseDown={(e) => handleStartResizeZone(e, 'e')}
            title="Arraste para ajustar a largura da Sidebar (Direita)"
          />
          {/* Alça Oeste (Largura Esquerda) */}
          <div
            className="cv-zone-resize-handle handle-w cv-no-print"
            data-cv-interactive="true"
            onMouseDown={(e) => handleStartResizeZone(e, 'w')}
            title="Arraste para ajustar a borda esquerda"
          />
          {/* Alça Sul (Altura Inferior) */}
          <div
            className="cv-zone-resize-handle handle-s cv-no-print"
            data-cv-interactive="true"
            onMouseDown={(e) => handleStartResizeZone(e, 's')}
            title="Arraste para ajustar a altura"
          />
          {/* Alça Sudeste (Canto Diagonal) */}
          <div
            className="cv-zone-resize-handle handle-se cv-no-print"
            data-cv-interactive="true"
            onMouseDown={(e) => handleStartResizeZone(e, 'se')}
            title="Arraste para redimensionar largura e altura simultaneamente"
          />

          {/* Grips de Vértice Poligonal estilo AutoCAD */}
          {zone.shape === 'polygon' &&
            zone.points &&
            zone.points.map((pt, idx) => (
              <div
                key={`vtx-${idx}`}
                className="cv-cad-vertex-grip cv-no-print"
                data-cv-interactive="true"
                style={{
                  left: `${pt.x}%`,
                  top: `${pt.y}%`
                }}
                onMouseDown={(e) => handleStartVertexDrag(e, idx)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  // Duplo clique em um vértice adiciona um novo vértice adjacente para esculpir o polígono
                  const pts = zone.points || []
                  const nextPt = pts[(idx + 1) % pts.length]
                  const midPt = {
                    x: Number(((pt.x + nextPt.x) / 2).toFixed(1)),
                    y: Number(((pt.y + nextPt.y) / 2).toFixed(1))
                  }
                  const updatedPts = [...pts]
                  updatedPts.splice(idx + 1, 0, midPt)
                  onUpdateZone({ ...zone, points: updatedPts })
                }}
                title={`Vértice CAD #${idx + 1} (${pt.x}%, ${pt.y}%) — Arraste para esculpir o formato • Duplo clique para dividir aresta`}
              />
            ))}
        </>
      )}
    </div>
  )
}
