import React, { useState, useCallback } from 'react'

interface ColumnSplitterHandleProps {
  isFreeCanvasActive: boolean
  currentRatio?: number
  splitRatio?: number
  onUpdateRatio?: (newRatio: number) => void
  onUpdateSplitRatio?: (newRatio: number) => void
}

export const ColumnSplitterHandle: React.FC<ColumnSplitterHandleProps> = ({
  isFreeCanvasActive,
  currentRatio,
  splitRatio,
  onUpdateRatio,
  onUpdateSplitRatio
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const activeRatio = splitRatio ?? currentRatio ?? 32
  const handleUpdate = onUpdateSplitRatio ?? onUpdateRatio ?? (() => {})

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isFreeCanvasActive) return

    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    setIsDragging(true)

    const parentEl = target.parentElement
    const parentRect = parentEl?.getBoundingClientRect() || { left: 0, width: 800 }

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault()
      const relativeX = moveEvt.clientX - parentRect.left
      const rawPercent = (relativeX / parentRect.width) * 100
      // Limites seguros de proporção: entre 18% e 48% para a coluna lateral
      const boundedPercent = Math.max(18, Math.min(48, Math.round(rawPercent)))
      handleUpdate(boundedPercent)
    }

    const onPointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault()
      try {
        target.releasePointerCapture(upEvt.pointerId)
      } catch {
        // Ignora caso já liberado
      }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      setIsDragging(false)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [isFreeCanvasActive, handleUpdate])

  if (!isFreeCanvasActive) {
    return null
  }

  return (
    <div
      className={`cv-column-splitter cv-no-print ${isDragging ? 'is-dragging' : ''}`}
      onPointerDown={handlePointerDown}
      title="Arrastar para alterar largura da coluna lateral (estilo Excel/Splitter)"
      style={{ left: `${activeRatio}%` }}
    >
      <div className="cv-column-splitter__line" />
      <div className="cv-column-splitter__knob">
        <span>↔</span>
        <span className="cv-column-splitter__ratio-tag">{activeRatio}%</span>
      </div>
    </div>
  )
}
