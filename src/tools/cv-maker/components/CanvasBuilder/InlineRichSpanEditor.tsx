import React, { useState, useRef, useEffect } from 'react'
import type { CanvasStudioElement, InlineTextSpan } from '../../types/cv'
import { useCanvasStore } from '../../store/useCanvasStore'
import { FloatingRichFormatBar } from './FloatingRichFormatBar'

interface InlineRichSpanEditorProps {
  element: CanvasStudioElement
  isInteractive: boolean
  darkContext?: boolean
  onChange: (updated: CanvasStudioElement) => void
  onDelete: () => void
  onMoveElement?: (direction: 'up' | 'down') => void
  onDuplicateElement?: () => void
  onStartDragElement?: (e: React.MouseEvent) => void
}

const CONTRAST_FONTS = ['Cinzel', 'Fira Code', 'Merriweather', 'Plus Jakarta Sans', 'Lora']
const CONTRAST_COLORS_DARK = ['#38bdf8', '#facc15', '#f97316', '#34d399', '#f472b6']
const CONTRAST_COLORS_LIGHT = ['#0284c7', '#ea580c', '#7c3aed', '#059669', '#be123c']

export const InlineRichSpanEditor: React.FC<InlineRichSpanEditorProps> = ({
  element,
  isInteractive,
  darkContext = false,
  onChange,
  onDelete,
  onMoveElement,
  onDuplicateElement,
  onStartDragElement
}) => {
  const {
    selectedElementId,
    selectedSpanId,
    selectElement,
    stylePainterFormat
  } = useCanvasStore()

  const [editingSpanId, setEditingSpanId] = useState<string | null>(null)
  const spanRefs = useRef<Record<string, HTMLSpanElement | null>>({})

  const isElementSelected = isInteractive && selectedElementId === element.id

  // Foca automaticamente o span quando entra em modo de edição inline (duplo clique)
  useEffect(() => {
    if (editingSpanId && spanRefs.current[editingSpanId]) {
      const node = spanRefs.current[editingSpanId]!
      node.focus()
      try {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(node)
        selection?.removeAllRanges()
        selection?.addRange(range)
      } catch {
        // Fallback silencioso
      }
    }
  }, [editingSpanId])

  const handleUpdateSpan = (spanId: string, patch: Partial<InlineTextSpan>) => {
    const nextSpans = element.spans.map((s) => (s.id === spanId ? { ...s, ...patch } : s))
    onChange({ ...element, spans: nextSpans })
  }

  const handleAddSiblingSpan = (afterSpanId?: string) => {
    const uid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
    const idx = afterSpanId ? element.spans.findIndex((s) => s.id === afterSpanId) : element.spans.length - 1
    const refSpan = element.spans[Math.max(0, idx)]
    const count = element.spans.length

    // Escolhe uma fonte e cor contrastante inteligente para que o usuário veja imediatamente a diferença
    const suggestedFont =
      CONTRAST_FONTS.find((f) => f !== refSpan?.fontFamily) || 'Cinzel'
    const palette = darkContext ? CONTRAST_COLORS_DARK : CONTRAST_COLORS_LIGHT
    const suggestedColor = palette[count % palette.length]

    const newSpan: InlineTextSpan = {
      id: `sp-${uid}`,
      text: 'Nova frase ao lado',
      fontFamily: suggestedFont,
      fontSizePt: refSpan?.fontSizePt ? Math.max(8, refSpan.fontSizePt - 0.5) : 10,
      fontWeight: 600,
      color: suggestedColor
    }

    const nextSpans = [...element.spans]
    if (idx >= 0 && idx < nextSpans.length) {
      nextSpans.splice(idx + 1, 0, newSpan)
    } else {
      nextSpans.push(newSpan)
    }

    onChange({ ...element, spans: nextSpans })
    selectElement(element.id, newSpan.id)
    setTimeout(() => setEditingSpanId(newSpan.id), 40)
  }

  const handleDeleteSpan = (spanId: string) => {
    if (element.spans.length <= 1) {
      onDelete()
      return
    }
    const nextSpans = element.spans.filter((s) => s.id !== spanId)
    onChange({ ...element, spans: nextSpans })
    selectElement(element.id, nextSpans[0]?.id || null)
  }

  const handleMoveSpan = (spanId: string, direction: 'left' | 'right') => {
    const idx = element.spans.findIndex((s) => s.id === spanId)
    if (idx === -1) return
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= element.spans.length) return
    const nextSpans = [...element.spans]
    const [removed] = nextSpans.splice(idx, 1)
    nextSpans.splice(targetIdx, 0, removed)
    onChange({ ...element, spans: nextSpans })
  }

  const handleSpanClick = (e: React.MouseEvent, span: InlineTextSpan) => {
    if (!isInteractive) return
    e.stopPropagation()

    // Se o Pintor de Estilo (MS Paint Bucket) estiver ativo, aplica o formato copiado em 1 clique!
    if (stylePainterFormat) {
      handleUpdateSpan(span.id, {
        ...stylePainterFormat
      })
      selectElement(element.id, span.id)
      return
    }

    selectElement(element.id, span.id)
  }

  const handleSpanDoubleClick = (e: React.MouseEvent, span: InlineTextSpan) => {
    if (!isInteractive) return
    e.stopPropagation()
    selectElement(element.id, span.id)
    setEditingSpanId(span.id)
  }

  const commitSpanText = (spanId: string, rawText: string) => {
    const cleaned = rawText.replace(/\r?\n/g, ' ').trim()
    setEditingSpanId(null)
    if (cleaned.length > 0) {
      handleUpdateSpan(spanId, { text: cleaned })
    }
  }

  const activeSpan =
    element.spans.find((s) => s.id === selectedSpanId) || element.spans[0] || null

  const justifyMap: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
    justify: 'space-between'
  }

  // Renderização para divisor técnico
  if (element.type === 'divider') {
    return (
      <div
        className={`cv-studio-element-wrapper ${isElementSelected ? 'selected' : ''}`}
        style={{
          position: 'relative',
          zIndex: isElementSelected ? 105 : 2,
          pointerEvents: 'auto',
          marginTop: `${element.marginTopPx ?? 6}px`,
          marginBottom: `${element.marginBottomPx ?? 6}px`,
          padding: isInteractive ? '4px 0' : 0,
          cursor: isInteractive ? 'pointer' : 'default'
        }}
        onClick={(e) => {
          if (!isInteractive) return
          e.stopPropagation()
          selectElement(element.id, null)
        }}
      >
        {isElementSelected && (
          <FloatingRichFormatBar
            element={element}
            activeSpan={null}
            onUpdateSpan={handleUpdateSpan}
            onAddSiblingSpan={handleAddSiblingSpan}
            onDeleteSpan={handleDeleteSpan}
            onMoveSpan={handleMoveSpan}
            onUpdateElement={(patch) => onChange({ ...element, ...patch })}
            onMoveElement={onMoveElement}
            onDuplicateElement={onDuplicateElement}
            onDeleteElement={onDelete}
            onClose={() => selectElement(null, null)}
            onStartDragElement={onStartDragElement}
          />
        )}
        <hr
          style={{
            border: 'none',
            borderTop: `${element.dividerThicknessPx ?? 1.5}px ${
              element.dividerStyle || 'solid'
            } ${element.dividerColor || '#0284c7'}`,
            margin: 0,
            width: '100%'
          }}
        />
      </div>
    )
  }

  return (
    <div
      className={`cv-studio-element-wrapper type-${element.type} ${
        isElementSelected ? 'selected' : ''
      }`}
      style={{
        position: 'relative',
        zIndex: isElementSelected ? 105 : 2,
        pointerEvents: 'auto',
        marginTop: `${element.marginTopPx ?? 3}px`,
        marginBottom: `${element.marginBottomPx ?? 4}px`,
        padding: element.paddingPx ? `${element.paddingPx}px` : undefined,
        backgroundColor: element.backgroundColor || undefined,
        border:
          element.borderWidthPx && element.borderWidthPx > 0
            ? `${element.borderWidthPx}px solid ${element.borderColor || '#0284c7'}`
            : undefined,
        borderRadius: element.borderRadiusPx ? `${element.borderRadiusPx}px` : undefined
      }}
      onClick={(e) => {
        if (!isInteractive) return
        e.stopPropagation()
        if (!isElementSelected) {
          selectElement(element.id, element.spans[0]?.id || null)
        }
      }}
    >
      {/* Barra Flutuante de Formatação Rica (Word / Docx + MS Paint) */}
      {isElementSelected && (
        <FloatingRichFormatBar
          element={element}
          activeSpan={activeSpan}
          onUpdateSpan={handleUpdateSpan}
          onAddSiblingSpan={handleAddSiblingSpan}
          onDeleteSpan={handleDeleteSpan}
          onMoveSpan={handleMoveSpan}
          onUpdateElement={(patch) => onChange({ ...element, ...patch })}
          onMoveElement={onMoveElement}
          onDuplicateElement={onDuplicateElement}
          onDeleteElement={onDelete}
          onClose={() => selectElement(null, null)}
          onStartDragElement={onStartDragElement}
        />
      )}

      {/* Linha Flex com Alinhamento pela Linha de Base Tipográfica (align-items: baseline) */}
      <div
        className="cv-studio-spans-line"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: justifyMap[element.align || 'left'] || 'flex-start',
          gap: `${element.gapPx ?? 6}px`,
          width: '100%'
        }}
      >
        {element.spans.map((span) => {
          const isSpanSelected = isElementSelected && selectedSpanId === span.id
          const isEditing = editingSpanId === span.id

          return (
            <span
              key={span.id}
              ref={(el) => {
                spanRefs.current[span.id] = el
              }}
              className={`cv-studio-inline-span ${isSpanSelected ? 'span-selected' : ''} ${
                isEditing ? 'span-editing' : ''
              }`}
              contentEditable={isEditing}
              suppressContentEditableWarning
              onClick={(e) => handleSpanClick(e, span)}
              onDoubleClick={(e) => handleSpanDoubleClick(e, span)}
              onBlur={(e) => {
                if (isEditing) {
                  commitSpanText(span.id, e.currentTarget.innerText)
                }
              }}
              onKeyDown={(e) => {
                if (isEditing) {
                  e.stopPropagation()
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    commitSpanText(span.id, e.currentTarget.innerText)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setEditingSpanId(null)
                  }
                }
              }}
              onPaste={(e) => {
                if (!isEditing) return
                e.preventDefault()
                const plain = e.clipboardData.getData('text/plain')
                document.execCommand('insertText', false, plain)
              }}
              title={
                isInteractive
                  ? stylePainterFormat
                    ? '🪣 Clique para pintar o estilo copiado nesta frase'
                    : 'Clique para mudar fonte/cor • Duplo clique para editar o texto'
                  : undefined
              }
              style={{
                fontFamily: span.fontFamily
                  ? `'${span.fontFamily}', sans-serif`
                  : undefined,
                fontSize: span.fontSizePt ? `${span.fontSizePt}pt` : '10pt',
                fontWeight: span.fontWeight ?? 400,
                fontStyle: span.fontStyle || 'normal',
                textDecoration: span.textDecoration || 'none',
                color: span.color || (darkContext ? '#f8fafc' : '#0f172a'),
                backgroundColor: span.backgroundColor || undefined,
                paddingLeft: span.paddingHorizontalPx
                  ? `${span.paddingHorizontalPx}px`
                  : undefined,
                paddingRight: span.paddingHorizontalPx
                  ? `${span.paddingHorizontalPx}px`
                  : undefined,
                paddingTop: span.paddingVerticalPx ? `${span.paddingVerticalPx}px` : undefined,
                paddingBottom: span.paddingVerticalPx
                  ? `${span.paddingVerticalPx}px`
                  : undefined,
                borderRadius: span.borderRadiusPx ? `${span.borderRadiusPx}px` : undefined,
                letterSpacing: span.letterSpacingEm
                  ? `${span.letterSpacingEm}em`
                  : undefined,
                textTransform: span.uppercase ? 'uppercase' : undefined,
                marginLeft: span.marginLeftPx ? `${span.marginLeftPx}px` : undefined,
                lineHeight: 1.32,
                cursor: isInteractive
                  ? stylePainterFormat
                    ? 'cell'
                    : isEditing
                    ? 'text'
                    : 'pointer'
                  : 'default',
                outline: isEditing
                  ? '2px solid #38bdf8'
                  : isSpanSelected
                  ? '1.5px dashed rgba(56, 189, 248, 0.85)'
                  : 'none',
                outlineOffset: '2px',
                transition: 'outline 0.12s ease'
              }}
            >
              {span.text}
            </span>
          )
        })}

        {/* Botão rápido "+ Frase" no fim da linha (visível quando selecionado ou no hover, oculto no PDF) */}
        {isInteractive && isElementSelected && (
          <button
            type="button"
            className="cv-inline-quick-add-span cv-no-print"
            data-cv-interactive="true"
            onClick={(e) => {
              e.stopPropagation()
              handleAddSiblingSpan(activeSpan?.id)
            }}
            title="Adicionar outra frase ao lado na mesma linha com outra fonte ou cor"
          >
            + frase ao lado
          </button>
        )}
      </div>
    </div>
  )
}
