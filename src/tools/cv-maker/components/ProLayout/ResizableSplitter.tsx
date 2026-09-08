import React, { useState, useEffect, useCallback } from 'react'

interface ResizableSplitterProps {
  onResize: (newWidthPx: number) => void
  onReset?: () => void
  minWidth?: number
  maxWidth?: number
}

export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  onResize,
  onReset,
  minWidth = 320,
  maxWidth = 1200
}) => {
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      // Largura da esquerda é o clientX da posição do mouse
      const newWidth = Math.min(Math.max(e.clientX, minWidth), Math.min(window.innerWidth * 0.75, maxWidth))
      onResize(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onResize, minWidth, maxWidth])

  return (
    <div
      className={`cv-pro-splitter ${isDragging ? 'is-dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={onReset}
      title="Arraste para redimensionar o painel. Dê um duplo clique para redefinir para 50/50."
      role="separator"
      aria-orientation="vertical"
    >
      <div className="cv-pro-splitter__handle" />
    </div>
  )
}
