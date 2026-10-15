import React, { useState, useCallback } from 'react'
import type { ZoomMode } from '../../types/cv'
import { useCanvasStore } from '../../store/useCanvasStore'
import {
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  RotateCcwIcon,
  SparklesIcon,
  PackageIcon,
  LayersIcon
} from '../Icons/ProIcons'

interface CanvasControlDockProps {
  activeZoomMode: ZoomMode
  onZoomModeChange: (zoom: ZoomMode | number) => void
  currentScale: number
  onAutoFitSinglePage?: () => void
  onAutoPackBlocks?: () => void
  isFreeCanvasActive?: boolean
  onToggleFreeCanvas?: () => void
  onResetModel?: () => void
}

export const CanvasControlDock: React.FC<CanvasControlDockProps> = ({
  activeZoomMode,
  onZoomModeChange,
  currentScale,
  onAutoFitSinglePage,
  onAutoPackBlocks,
  isFreeCanvasActive = false,
  onToggleFreeCanvas,
  onResetModel
}) => {
  const {
    activeDrawingMode,
    setDrawingMode,
    showCadRulers,
    toggleCadRulers,
    showCadGrid,
    toggleCadGrid,
    snapEnabled,
    toggleSnap,
    stylePainterFormat,
    setStylePainterFormat
  } = useCanvasStore()

  // Posição livre arrastável e modo recolhido (para tirar a barra da frente do currículo)
  const [dockOffset, setDockOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDraggingDock, setIsDraggingDock] = useState<boolean>(false)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  const handleStartDragDock = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const target = e.currentTarget
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        // Ignora
      }

      setIsDraggingDock(true)
      const startX = e.clientX
      const startY = e.clientY
      const origX = dockOffset.x
      const origY = dockOffset.y

      const onMove = (ev: PointerEvent) => {
        ev.preventDefault()
        setDockOffset({
          x: origX + (ev.clientX - startX),
          y: origY + (ev.clientY - startY)
        })
      }

      const onUp = (ev: PointerEvent) => {
        try {
          target.releasePointerCapture(ev.pointerId)
        } catch {
          // Ignora
        }
        setIsDraggingDock(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [dockOffset.x, dockOffset.y]
  )

  const handleZoomIn = () => {
    const next = Math.min(1.6, (currentScale || 1.0) + 0.1)
    onZoomModeChange(Number(next.toFixed(2)))
  }

  const handleZoomOut = () => {
    const next = Math.max(0.4, (currentScale || 1.0) - 0.1)
    onZoomModeChange(Number(next.toFixed(2)))
  }

  const handleTriggerDraw = (mode: 'rect' | 'polygon') => {
    if (!isFreeCanvasActive && onToggleFreeCanvas) {
      onToggleFreeCanvas()
    }
    setDrawingMode(activeDrawingMode === mode ? null : mode)
  }

  const handleAddFreeRichRow = () => {
    if (!isFreeCanvasActive && onToggleFreeCanvas) {
      onToggleFreeCanvas()
    }
    setDrawingMode(null)
    window.dispatchEvent(
      new CustomEvent('cv-studio-add-free-element', {
        detail: { type: 'rich_row' }
      })
    )
  }

  if (isCollapsed) {
    return (
      <div
        className="cv-pro-floating-dock cv-no-print"
        role="toolbar"
        aria-label="Controles do Estúdio PDF Recolhidos"
        style={{
          transform: `translate(calc(-50% + ${dockOffset.x}px), ${dockOffset.y}px)`,
          padding: '0.28rem 0.55rem',
          gap: '0.35rem'
        }}
      >
        <button
          type="button"
          className="cv-pro-dock-btn"
          onPointerDown={handleStartDragDock}
          onDoubleClick={() => setDockOffset({ x: 0, y: 0 })}
          style={{ cursor: isDraggingDock ? 'grabbing' : 'grab', color: 'var(--cv-pro-sky)' }}
          title="Segure e arraste para mover esta barra para qualquer lugar da tela (Duplo clique centraliza)"
        >
          <span>✥</span>
        </button>
        <button
          type="button"
          className="cv-pro-dock-btn is-active"
          onClick={() => setIsCollapsed(false)}
          title="Expandir barra de ferramentas do Estúdio PDF"
        >
          <span>🛠️ Abrir Barra ({Math.round((currentScale || 1.0) * 100)}%)</span>
        </button>
      </div>
    )
  }

  return (
    <div
      className="cv-pro-floating-dock cv-no-print"
      role="toolbar"
      aria-label="Controles do Estúdio PDF (AutoCAD + Docx + Paint)"
      style={{
        transform: `translate(calc(-50% + ${dockOffset.x}px), ${dockOffset.y}px)`
      }}
    >
      {/* Grip de Arraste Livre para tirar a barra da visão do currículo */}
      <button
        type="button"
        className="cv-pro-dock-btn"
        onPointerDown={handleStartDragDock}
        onDoubleClick={() => setDockOffset({ x: 0, y: 0 })}
        style={{
          cursor: isDraggingDock ? 'grabbing' : 'grab',
          color: 'var(--cv-pro-sky)',
          padding: '0.25rem 0.45rem',
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)'
        }}
        title="Segure e arraste para mover esta barra e tirá-la da visão do currículo (Duplo clique centraliza)"
      >
        <span>✥ Mover</span>
      </button>

      {/* Alternar Modo Canvas Livre */}
      {onToggleFreeCanvas && (
        <button
          type="button"
          className={`cv-pro-dock-btn ${isFreeCanvasActive ? 'is-active' : ''}`}
          onClick={onToggleFreeCanvas}
          title={
            isFreeCanvasActive
              ? 'Modo Estúdio Livre Ativo — Clique para travar em grid'
              : 'Ativar Modo Estúdio Livre (AutoCAD + Word + Paint)'
          }
        >
          <LayersIcon
            size={13}
            style={{ color: isFreeCanvasActive ? 'var(--cv-pro-sky)' : undefined }}
          />
          <span>Estúdio {isFreeCanvasActive ? 'Livre ✓' : 'Livre'}</span>
        </button>
      )}

      {/* Ferramentas Diretas MS Paint / AutoCAD / Word */}
      <button
        type="button"
        className={`cv-pro-dock-btn ${activeDrawingMode === 'rect' ? 'is-active' : ''}`}
        onClick={() => handleTriggerDraw('rect')}
        title="Desenhar Sidebar ou Container Retangular onde você pode colocar títulos, subtítulos e frases com fontes/cores próprias"
      >
        <span>▭ + Sidebar/Box</span>
      </button>

      <button
        type="button"
        className={`cv-pro-dock-btn ${activeDrawingMode === 'polygon' ? 'is-active' : ''}`}
        onClick={() => handleTriggerDraw('polygon')}
        title="Desenhar Polígono ou Sidebar Angulada estilo AutoCAD (clique nos vértices)"
      >
        <span>⬠ Polígono CAD</span>
      </button>

      <button
        type="button"
        className="cv-pro-dock-btn"
        onClick={handleAddFreeRichRow}
        title="Inserir Título / Frases Lado a Lado com fontes e cores independentes diretamente na folha"
      >
        <span>🔤 + Frases/Título</span>
      </button>

      {/* Indicador do Pintor de Estilo (MS Paint / Word Format Painter) */}
      {stylePainterFormat && (
        <button
          type="button"
          className="cv-pro-dock-btn is-active"
          onClick={() => setStylePainterFormat(null)}
          title="Pintor de Estilo Ativo! Clique em qualquer frase para aplicar a fonte/cor copiada, ou clique aqui para desativar."
        >
          <span>🪣 Pintor Ativo (✕)</span>
        </button>
      )}

      {/* Controles Euclidianos AutoCAD (Réguas mm, Grade e OSNAP) */}
      {isFreeCanvasActive && (
        <>
          <div className="cv-pro-dock-divider" />
          <button
            type="button"
            className={`cv-pro-dock-btn ${showCadRulers ? 'is-active' : ''}`}
            onClick={toggleCadRulers}
            title="Mostrar/Ocultar Réguas Físicas em Milímetros (0-210mm × 0-297mm)"
          >
            <span>📐 Réguas mm</span>
          </button>
          <button
            type="button"
            className={`cv-pro-dock-btn ${showCadGrid ? 'is-active' : ''}`}
            onClick={toggleCadGrid}
            title="Mostrar/Ocultar Grade Técnica Milimetrada estilo AutoCAD"
          >
            <span># Grade</span>
          </button>
          <button
            type="button"
            className={`cv-pro-dock-btn ${snapEnabled ? 'is-active' : ''}`}
            onClick={toggleSnap}
            title="Ativar/Desativar Alinhamento Magnético (OSNAP)"
          >
            <span>🧲 Snap</span>
          </button>
        </>
      )}

      <div className="cv-pro-dock-divider" />

      {/* Auto-ajustar 1 página */}
      {onAutoFitSinglePage && (
        <button
          type="button"
          className="cv-pro-dock-btn"
          onClick={onAutoFitSinglePage}
          title="Bissecção no DOM Real para encaixar exatamente em 1 página"
        >
          <SparklesIcon size={13} style={{ color: 'var(--cv-pro-sky)' }} />
          <span>1 Página</span>
        </button>
      )}

      {/* Empacotar blocos livres */}
      {isFreeCanvasActive && onAutoPackBlocks && (
        <button
          type="button"
          className="cv-pro-dock-btn"
          onClick={onAutoPackBlocks}
          title="Compactar blocos e eliminar vácuos no Canvas Livre"
        >
          <PackageIcon size={13} style={{ color: 'var(--cv-pro-accent)' }} />
          <span>Empacotar</span>
        </button>
      )}

      {/* Zoom Fit Width */}
      <button
        type="button"
        className={`cv-pro-dock-btn ${
          activeZoomMode === 'auto' || activeZoomMode === 'fit-width' ? 'is-active' : ''
        }`}
        onClick={() => onZoomModeChange('auto')}
        title="Ajustar automaticamente à largura da tela"
      >
        <MaximizeIcon size={13} />
        <span>Ajustar</span>
      </button>

      {/* Zoom 100% */}
      <button
        type="button"
        className={`cv-pro-dock-btn ${activeZoomMode === '100' ? 'is-active' : ''}`}
        onClick={() => onZoomModeChange('100')}
        title="Visualização em tamanho real (100%)"
      >
        <span>100%</span>
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        className="cv-pro-dock-btn"
        onClick={handleZoomOut}
        title="Diminuir Zoom (-10%)"
      >
        <ZoomOutIcon size={13} />
      </button>

      {/* Porcentagem Atual */}
      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: 'var(--cv-pro-sky)',
          minWidth: '2.5rem',
          textAlign: 'center'
        }}
      >
        {Math.round((currentScale || 1.0) * 100)}%
      </span>

      {/* Zoom In */}
      <button
        type="button"
        className="cv-pro-dock-btn"
        onClick={handleZoomIn}
        title="Aumentar Zoom (+10%)"
      >
        <ZoomInIcon size={13} />
      </button>

      {onResetModel && (
        <>
          <div className="cv-pro-dock-divider" />
          <button
            type="button"
            className="cv-pro-dock-btn"
            onClick={onResetModel}
            title="Restaurar modelo de exemplo padrão"
          >
            <RotateCcwIcon size={13} />
            <span>Resetar</span>
          </button>
        </>
      )}

      <div className="cv-pro-dock-divider" />
      <button
        type="button"
        className="cv-pro-dock-btn"
        onClick={() => setIsCollapsed(true)}
        title="Minimizar / recolher barra flutuante para liberar a visão do currículo"
      >
        <span>➖</span>
      </button>
    </div>
  )
}
