import React, { useRef, useState, useEffect } from 'react'
import type { CanvasBlockConfig, CanvasColSpan, CVData, LayoutBlueprint } from '../../types/cv'
import { AtomicBlockRenderer } from '../blocks/AtomicBlockRenderer'

interface CanvasBlockWrapperProps {
  block: CanvasBlockConfig
  index: number
  totalBlocks: number
  data: CVData
  isSelected: boolean
  onSelect: (block: CanvasBlockConfig) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onChangeColSpan: (id: string, colSpan: CanvasColSpan) => void
  onOpenInspector: (block: CanvasBlockConfig) => void
  onDelete: (id: string) => void
  onRequestGenerateCoverLetter?: () => void
  onUpdateBlock?: (updated: CanvasBlockConfig) => void
}

// Mock dummy blueprint to satisfy AtomicBlockRenderer interface
const DUMMY_CANVAS_BLUEPRINT: LayoutBlueprint = {
  id: 'modular',
  name: 'Canvas Blueprint',
  label: 'Canvas',
  icon: '🎨',
  description: '',
  gridTemplate: '1fr',
  mainZone: ['header']
}

export const CanvasBlockWrapper: React.FC<CanvasBlockWrapperProps> = ({
  block,
  index,
  totalBlocks,
  data,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onChangeColSpan,
  onOpenInspector,
  onDelete,
  onRequestGenerateCoverLetter,
  onUpdateBlock
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false)

  // Real-time Text Volume & Overflow Detector
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const checkOverflow = () => {
      // Se a altura mínima foi definida e o scrollHeight estourar a caixa
      const hasHeightLimit = Boolean(block.minHeight && block.minHeight > 0)
      const isHeightOverflow = hasHeightLimit && el.scrollHeight > (block.minHeight! + 10)
      
      // Se for um bloco pequeno (ex: colSpan 3 ou 4) com texto volumoso
      const textLen = el.innerText?.length || 0
      const isColTight = (block.colSpan === 3 && textLen > 280) || (block.colSpan === 4 && textLen > 450)

      setIsOverflowing(Boolean(isHeightOverflow || isColTight))
    }

    checkOverflow()

    const observer = new ResizeObserver(() => {
      checkOverflow()
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [block.colSpan, block.minHeight, block.fontSizeScale, data])

  // Map ColSpan to CSS class
  const colClass = `cv-col-${block.colSpan || 12}`

  // Padding styles
  const paddingMap = {
    none: '0',
    compact: '0.35rem',
    normal: '0.65rem',
    spacious: '1.15rem'
  }
  const isPhotoFloating = block.type === 'photo' && block.hideContainerBox !== false

  const customStyle: React.CSSProperties = {
    fontFamily: block.fontFamily && block.fontFamily !== 'inherit' ? `"${block.fontFamily}", sans-serif` : undefined,
    fontSize: block.fontSizeScale ? `${block.fontSizeScale}em` : undefined,
    color: block.customTextColor || undefined,
    backgroundColor: isPhotoFloating ? 'transparent' : (block.customBgColor && block.customBgColor !== 'transparent' ? block.customBgColor : undefined),
    padding: isPhotoFloating ? '0' : paddingMap[block.padding || 'normal'],
    borderRadius: block.customBgColor && block.customBgColor !== 'transparent' ? '8px' : '4px',
    minHeight: block.minHeight ? `${block.minHeight}px` : undefined
  }

  return (
    <div
      className={`cv-canvas-block ${colClass} ${isSelected ? 'cv-canvas-block--selected' : ''} ${isOverflowing ? 'cv-canvas-block--overflow' : ''}`}
      onClick={() => onSelect(block)}
    >
      {/* Floating Actions Toolbar on Hover / Focus */}
      <div className="cv-canvas-block__actions cv-no-print" onClick={e => e.stopPropagation()}>
        {/* Reorder Buttons */}
        <button
          type="button"
          className="cv-canvas-act-btn"
          disabled={index === 0}
          onClick={() => onMoveUp(index)}
          title="Mover para cima"
        >
          ▲
        </button>
        <button
          type="button"
          className="cv-canvas-act-btn"
          disabled={index === totalBlocks - 1}
          onClick={() => onMoveDown(index)}
          title="Mover para baixo"
        >
          ▼
        </button>

        {/* Column Width Selector */}
        <select
          className="cv-canvas-act-btn"
          value={block.colSpan}
          onChange={e => onChangeColSpan(block.id, Number(e.target.value) as CanvasColSpan)}
          title="Ajustar largura na página"
        >
          <option value={12}>100%</option>
          <option value={8}>66%</option>
          <option value={6}>50%</option>
          <option value={4}>33%</option>
          <option value={3}>25%</option>
        </select>

        {/* Settings Button */}
        <button
          type="button"
          className="cv-canvas-act-btn"
          onClick={() => onOpenInspector(block)}
          title="Personalizar fonte, formato da foto, cores e espaçamento deste bloco"
        >
          ⚙️
        </button>

        {/* Delete Button */}
        <button
          type="button"
          className="cv-canvas-act-btn cv-canvas-act-btn--danger"
          onClick={() => onDelete(block.id)}
          title="Excluir este bloco"
        >
          🗑️
        </button>
      </div>

      {/* Rendered Block Content with Custom Styles */}
      <div ref={contentRef} style={customStyle}>
        {block.customTitle && (
          <h4
            style={{
              fontSize: '0.9rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.4rem',
              marginTop: 0,
              color: 'currentColor',
              borderBottom: '1.5px solid currentColor',
              paddingBottom: '0.2rem'
            }}
          >
            {block.customTitle}
          </h4>
        )}

        <AtomicBlockRenderer
          blockId={block.type}
          data={data}
          blueprint={DUMMY_CANVAS_BLUEPRINT}
          zoneName="main"
          onRequestGenerateCoverLetter={onRequestGenerateCoverLetter}
          blockConfig={block}
          onUploadImage={(dataUrl) => onUpdateBlock?.({ ...block, imageUrl: dataUrl })}
        />
      </div>

      {/* Overflow Warning Badge */}
      {isOverflowing && (
        <div className="cv-canvas-overflow-badge cv-no-print" title="Ajuste o bloco para evitar cortes na impressão">
          <span>⚠️</span>
          <span>Texto muito grande para este bloco! Aumente a largura ou reduza a fonte.</span>
        </div>
      )}
    </div>
  )
}
