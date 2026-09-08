import React from 'react'
import type { ZoomMode } from '../../types/cv'
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
  const handleZoomIn = () => {
    const next = Math.min(1.6, (currentScale || 1.0) + 0.1)
    onZoomModeChange(Number(next.toFixed(2)))
  }

  const handleZoomOut = () => {
    const next = Math.max(0.4, (currentScale || 1.0) - 0.1)
    onZoomModeChange(Number(next.toFixed(2)))
  }

  return (
    <div className="cv-pro-floating-dock cv-no-print" role="toolbar" aria-label="Controles do Canvas">
      {/* Alternar Modo Canvas Livre */}
      {onToggleFreeCanvas && (
        <button
          type="button"
          className={`cv-pro-dock-btn ${isFreeCanvasActive ? 'is-active' : ''}`}
          onClick={onToggleFreeCanvas}
          title={isFreeCanvasActive ? 'Modo Canvas Livre Ativo - Clique para travar em grid' : 'Ativar Modo Canvas Livre (arrastar blocos com mouse)'}
        >
          <LayersIcon size={13} style={{ color: isFreeCanvasActive ? 'var(--cv-pro-sky)' : undefined }} />
          <span>Canvas {isFreeCanvasActive ? 'Livre ✓' : 'Livre'}</span>
        </button>
      )}

      {/* Auto-ajustar 1 página */}
      {onAutoFitSinglePage && (
        <button
          type="button"
          className="cv-pro-dock-btn"
          onClick={onAutoFitSinglePage}
          title="Bissecção no DOM Real para encaixar exatamente em 1 página"
        >
          <SparklesIcon size={13} style={{ color: 'var(--cv-pro-sky)' }} />
          <span>Ajustar 1 Página</span>
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

      {(onAutoFitSinglePage || (isFreeCanvasActive && onAutoPackBlocks)) && (
        <div className="cv-pro-dock-divider" />
      )}

      {/* Zoom Fit Width */}
      <button
        type="button"
        className={`cv-pro-dock-btn ${(activeZoomMode === 'auto' || activeZoomMode === 'fit-width') ? 'is-active' : ''}`}
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
    </div>
  )
}
