import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { ZoomMode } from '../../types/cv'

interface CVPageViewportScalerProps {
  children: React.ReactNode
  pageWidthPx?: number
  pageHeightPx?: number
  zoomMode?: ZoomMode
  onScaleChange?: (currentScale: number) => void
}

/**
 * CVPageViewportScaler
 *
 * Envolve a folha de impressão e visualização com uma lente óptica proporcional (transform: scale).
 * Mantém as dimensões internas do DOM da folha rigorosamente IDÊNTICAS à folha física real
 * (793.7px para A4 / 816px para Letter), garantindo quebras de linha e larguras 100% idênticas
 * entre a tela de edição e o PDF final exportado.
 */
export const CVPageViewportScaler: React.FC<CVPageViewportScalerProps> = ({
  children,
  pageWidthPx = 793.70,
  pageHeightPx = 1122.52,
  zoomMode = 'auto',
  onScaleChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number>(1.0)
  const [contentHeight, setContentHeight] = useState<number>(pageHeightPx)

  const computeScale = useCallback(() => {
    if (!containerRef.current) return

    if (typeof zoomMode === 'number') {
      setScale(zoomMode)
      onScaleChange?.(zoomMode)
      return
    }

    if (zoomMode === '100') {
      setScale(1.0)
      onScaleChange?.(1.0)
      return
    }

    // Modo 'auto' ou 'fit-width': ajusta à largura útil da coluna do preview
    const availableWidth = containerRef.current.clientWidth - 28 // 14px de respiro lateral
    if (availableWidth <= 0) return

    // Se o espaço for menor que a folha física, aplica zoom óptico proporcional
    if (availableWidth < pageWidthPx || zoomMode === 'fit-width') {
      // Limites: não encolhe para menos de 45% nem ultrapassa 120%
      const rawScale = availableWidth / pageWidthPx
      const boundedScale = Math.max(0.45, Math.min(1.20, Math.round(rawScale * 1000) / 1000))
      setScale(boundedScale)
      onScaleChange?.(boundedScale)
    } else {
      setScale(1.0)
      onScaleChange?.(1.0)
    }
  }, [zoomMode, pageWidthPx, onScaleChange])

  // Medição contínua via ResizeObserver no container externo
  useEffect(() => {
    computeScale()
    const containerEl = containerRef.current
    if (!containerEl) return

    const observer = new ResizeObserver(() => computeScale())
    observer.observe(containerEl)
    return () => observer.disconnect()
  }, [computeScale])

  // Mede a altura real renderizada para compensar a margem pós-scale do CSS
  useEffect(() => {
    const innerEl = innerRef.current
    if (!innerEl) return

    const updateHeight = () => {
      if (innerEl) {
        setContentHeight(innerEl.scrollHeight || pageHeightPx)
      }
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(innerEl)
    return () => observer.disconnect()
  }, [pageHeightPx, children])

  // Compensação matemática de altura:
  // Como transform: scale() preserva o bounding box original no fluxo DOM,
  // aplicamos margem negativa inferior proporcional para evitar vãos vazios gigantes abaixo da folha.
  const heightCompensation = scale < 1.0
    ? -Math.round(contentHeight * (1.0 - scale))
    : Math.round(contentHeight * (scale - 1.0))

  return (
    <div
      ref={containerRef}
      className="cv-page-viewport-scaler-wrapper"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
        position: 'relative'
      }}
    >
      <div
        ref={innerRef}
        className="cv-page-viewport-scaler"
        style={{
          width: `${pageWidthPx}px`,
          minWidth: `${pageWidthPx}px`,
          maxWidth: `${pageWidthPx}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          flexShrink: 0,
          marginBottom: `${heightCompensation + 32}px`,
          boxSizing: 'border-box'
        }}
      >
        {children}
      </div>
    </div>
  )
}
