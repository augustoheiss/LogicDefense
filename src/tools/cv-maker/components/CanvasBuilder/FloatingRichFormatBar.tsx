import React, { useState, useCallback } from 'react'
import {
  AVAILABLE_BOX_FONTS,
  type CanvasStudioElement,
  type InlineTextSpan
} from '../../types/cv'
import { useCanvasStore } from '../../store/useCanvasStore'

interface FloatingRichFormatBarProps {
  element: CanvasStudioElement
  activeSpan: InlineTextSpan | null
  onUpdateSpan: (spanId: string, patch: Partial<InlineTextSpan>) => void
  onAddSiblingSpan: (afterSpanId?: string) => void
  onDeleteSpan: (spanId: string) => void
  onMoveSpan: (spanId: string, direction: 'left' | 'right') => void
  onUpdateElement: (patch: Partial<CanvasStudioElement>) => void
  onMoveElement?: (direction: 'up' | 'down') => void
  onDuplicateElement?: () => void
  onDeleteElement: () => void
  onClose?: () => void
  onStartDragElement?: (e: React.MouseEvent) => void
}

const QUICK_TEXT_COLORS = [
  '#ffffff',
  '#f8fafc',
  '#38bdf8',
  '#f97316',
  '#facc15',
  '#10b981',
  '#0f172a',
  '#0284c7',
  '#7c3aed',
  '#e11d48'
]

const QUICK_BG_COLORS = [
  'transparent',
  '#0284c7',
  '#0f172a',
  '#f97316',
  '#10b981',
  '#7c3aed',
  '#e2e8f0',
  'rgba(255,255,255,0.18)'
]

export const FloatingRichFormatBar: React.FC<FloatingRichFormatBarProps> = ({
  element,
  activeSpan,
  onUpdateSpan,
  onAddSiblingSpan,
  onDeleteSpan,
  onMoveSpan,
  onUpdateElement,
  onMoveElement,
  onDuplicateElement,
  onDeleteElement,
  onClose,
  onStartDragElement
}) => {
  const { stylePainterFormat, setStylePainterFormat } = useCanvasStore()
  const [barOffset, setBarOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const handleStartDragBar = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const origX = barOffset.x
      const origY = barOffset.y

      const onMove = (ev: MouseEvent) => {
        setBarOffset({
          x: origX + (ev.clientX - startX),
          y: origY + (ev.clientY - startY)
        })
      }

      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [barOffset.x, barOffset.y]
  )

  // Caso seja um divisor puro sem spans
  if (element.type === 'divider') {
    return (
      <div
        className="cv-floating-rich-bar cv-no-print"
        data-cv-interactive="true"
        style={{
          transform:
            barOffset.x !== 0 || barOffset.y !== 0
              ? `translate(${barOffset.x}px, ${barOffset.y}px)`
              : undefined
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cv-rich-bar-row">
          {onStartDragElement && (
            <button
              type="button"
              className="cv-rich-bar-btn active"
              style={{ cursor: 'grab' }}
              onMouseDown={onStartDragElement}
              title="Arraste para mover esta linha/divisor pela folha"
            >
              ✥ Mover
            </button>
          )}
          <span
            className="cv-rich-bar-badge"
            style={{ cursor: 'grab' }}
            onMouseDown={handleStartDragBar}
            title="Arraste para mover este menu flutuante"
          >
            ➖ Divisor Técnico
          </span>
          <select
            className="cv-rich-bar-select"
            value={element.dividerStyle || 'solid'}
            onChange={(e) =>
              onUpdateElement({
                dividerStyle: e.target.value as CanvasStudioElement['dividerStyle']
              })
            }
            title="Estilo da linha"
          >
            <option value="solid">Sólida</option>
            <option value="dashed">Tracejada (CAD)</option>
            <option value="dotted">Pontilhada</option>
            <option value="double">Dupla</option>
          </select>

          <div className="cv-rich-bar-stepper" title="Espessura da linha (px)">
            <button
              type="button"
              onClick={() =>
                onUpdateElement({
                  dividerThicknessPx: Math.max(0.5, (element.dividerThicknessPx || 1.5) - 0.5)
                })
              }
            >
              -
            </button>
            <span>{element.dividerThicknessPx || 1.5}px</span>
            <button
              type="button"
              onClick={() =>
                onUpdateElement({
                  dividerThicknessPx: Math.min(8, (element.dividerThicknessPx || 1.5) + 0.5)
                })
              }
            >
              +
            </button>
          </div>

          <input
            type="color"
            className="cv-rich-bar-color-input"
            value={
              element.dividerColor && element.dividerColor.startsWith('#')
                ? element.dividerColor
                : '#0284c7'
            }
            onChange={(e) => onUpdateElement({ dividerColor: e.target.value })}
            title="Cor da linha divisória"
          />

          {onMoveElement && (
            <>
              <button
                type="button"
                className="cv-rich-bar-btn"
                onClick={() => onMoveElement('up')}
                title="Subir elemento"
              >
                ↑
              </button>
              <button
                type="button"
                className="cv-rich-bar-btn"
                onClick={() => onMoveElement('down')}
                title="Descer elemento"
              >
                ↓
              </button>
            </>
          )}

          <button
            type="button"
            className="cv-rich-bar-btn danger"
            onClick={onDeleteElement}
            title="Remover divisor"
          >
            🗑️
          </button>
        </div>
      </div>
    )
  }

  const span = activeSpan || element.spans[0]
  if (!span) return null

  const currentFontSize = span.fontSizePt ?? 10.5
  const isBold = (span.fontWeight ?? 400) >= 700
  const isItalic = span.fontStyle === 'italic'
  const isUnderline = span.textDecoration === 'underline'
  const isUppercase = Boolean(span.uppercase)

  const handleCopyStyle = () => {
    setStylePainterFormat({
      fontFamily: span.fontFamily,
      fontSizePt: span.fontSizePt,
      fontWeight: span.fontWeight,
      fontStyle: span.fontStyle,
      textDecoration: span.textDecoration,
      color: span.color,
      backgroundColor: span.backgroundColor,
      borderRadiusPx: span.borderRadiusPx,
      paddingHorizontalPx: span.paddingHorizontalPx,
      uppercase: span.uppercase
    })
  }

  return (
    <div
      className="cv-floating-rich-bar cv-no-print"
      data-cv-interactive="true"
      style={{
        transform:
          barOffset.x !== 0 || barOffset.y !== 0
            ? `translate(${barOffset.x}px, ${barOffset.y}px)`
            : undefined
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* LINHA 1: Arrastar Caixa/Menu, Fonte, Tamanho, Peso, Estilo, Alinhamento e "+ Frase ao Lado" */}
      <div className="cv-rich-bar-row">
        {onStartDragElement && (
          <button
            type="button"
            className="cv-rich-bar-btn active"
            style={{ cursor: 'grab', fontWeight: 800 }}
            onMouseDown={onStartDragElement}
            title="Segure e arraste para mover este Título/Frase para qualquer posição da folha (ou para fora dela)"
          >
            ✥ Mover Caixa
          </button>
        )}

        <button
          type="button"
          className="cv-rich-bar-btn"
          style={{ cursor: 'grab', color: '#38bdf8' }}
          onMouseDown={handleStartDragBar}
          onDoubleClick={() => setBarOffset({ x: 0, y: 0 })}
          title="Segure e arraste para tirar este menu de formatação da frente do texto (Duplo clique reseta)"
        >
          ⠿ Menu
        </button>

        <select
          className="cv-rich-bar-select"
          value={span.fontFamily || ''}
          onChange={(e) => onUpdateSpan(span.id, { fontFamily: e.target.value || undefined })}
          title="Fonte desta frase (independente das frases vizinhas)"
        >
          {AVAILABLE_BOX_FONTS.map((f) => (
            <option key={f.id} value={f.family}>
              {f.name}
            </option>
          ))}
        </select>

        {/* Tamanho em pt */}
        <div className="cv-rich-bar-stepper" title="Tamanho da fonte (pt)">
          <button
            type="button"
            onClick={() =>
              onUpdateSpan(span.id, {
                fontSizePt: Math.max(6, Number((currentFontSize - 0.5).toFixed(1)))
              })
            }
          >
            A-
          </button>
          <span>{currentFontSize}pt</span>
          <button
            type="button"
            onClick={() =>
              onUpdateSpan(span.id, {
                fontSizePt: Math.min(48, Number((currentFontSize + 0.5).toFixed(1)))
              })
            }
          >
            A+
          </button>
        </div>

        {/* Formatação estilo Word / Docx */}
        <button
          type="button"
          className={`cv-rich-bar-btn ${isBold ? 'active' : ''}`}
          onClick={() => onUpdateSpan(span.id, { fontWeight: isBold ? 400 : 700 })}
          title="Negrito (Bold)"
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          className={`cv-rich-bar-btn ${isItalic ? 'active' : ''}`}
          onClick={() => onUpdateSpan(span.id, { fontStyle: isItalic ? 'normal' : 'italic' })}
          title="Itálico"
        >
          <em>I</em>
        </button>

        <button
          type="button"
          className={`cv-rich-bar-btn ${isUnderline ? 'active' : ''}`}
          onClick={() =>
            onUpdateSpan(span.id, {
              textDecoration: isUnderline ? 'none' : 'underline'
            })
          }
          title="Sublinhado"
        >
          <u>U</u>
        </button>

        <button
          type="button"
          className={`cv-rich-bar-btn ${isUppercase ? 'active' : ''}`}
          onClick={() => onUpdateSpan(span.id, { uppercase: !isUppercase })}
          title="MAIÚSCULAS (Caixa Alta)"
        >
          AA
        </button>

        <span className="cv-rich-bar-sep" />

        {/* Alinhamento da linha */}
        <button
          type="button"
          className={`cv-rich-bar-btn ${(element.align || 'left') === 'left' ? 'active' : ''}`}
          onClick={() => onUpdateElement({ align: 'left' })}
          title="Alinhar à esquerda"
        >
          ⬅
        </button>
        <button
          type="button"
          className={`cv-rich-bar-btn ${element.align === 'center' ? 'active' : ''}`}
          onClick={() => onUpdateElement({ align: 'center' })}
          title="Centralizar linha"
        >
          ↔
        </button>
        <button
          type="button"
          className={`cv-rich-bar-btn ${element.align === 'right' ? 'active' : ''}`}
          onClick={() => onUpdateElement({ align: 'right' })}
          title="Alinhar à direita"
        >
          ➡
        </button>

        <span className="cv-rich-bar-sep" />

        {/* Botão Estrela: Adicionar outra frase AO LADO na mesma linha com fonte/cor própria */}
        <button
          type="button"
          className="cv-rich-bar-btn add-sibling-btn"
          onClick={() => onAddSiblingSpan(span.id)}
          title="Colocar outra frase ao lado na mesma linha com fonte e cor independentes"
        >
          ➕ Frase ao Lado
        </button>

        {onClose && (
          <button
            type="button"
            className="cv-rich-bar-btn"
            onClick={onClose}
            title="Fechar barra"
          >
            ✕
          </button>
        )}
      </div>

      {/* LINHA 2: Cores de Fonte, Fundo/Badge (Paint), Pintor de Estilo e Ordem */}
      <div className="cv-rich-bar-row">
        <span className="cv-rich-bar-label">Cor:</span>
        <div className="cv-rich-bar-swatches">
          {QUICK_TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`cv-rich-swatch ${span.color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => onUpdateSpan(span.id, { color: c })}
              title={`Cor da fonte: ${c}`}
            />
          ))}
          <input
            type="color"
            className="cv-rich-bar-color-input"
            value={span.color && span.color.startsWith('#') ? span.color : '#0f172a'}
            onChange={(e) => onUpdateSpan(span.id, { color: e.target.value })}
            title="Escolher qualquer cor de fonte (RGB/Hex)"
          />
        </div>

        <span className="cv-rich-bar-sep" />

        <span className="cv-rich-bar-label">Fundo/Pílula:</span>
        <div className="cv-rich-bar-swatches">
          {QUICK_BG_COLORS.map((bg) => (
            <button
              key={bg}
              type="button"
              className={`cv-rich-swatch ${
                (span.backgroundColor || 'transparent') === bg ? 'active' : ''
              }`}
              style={{
                backgroundColor: bg === 'transparent' ? '#1e293b' : bg,
                backgroundImage:
                  bg === 'transparent'
                    ? 'linear-gradient(45deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)'
                    : undefined
              }}
              onClick={() =>
                onUpdateSpan(span.id, {
                  backgroundColor: bg === 'transparent' ? undefined : bg,
                  paddingHorizontalPx: bg === 'transparent' ? 0 : span.paddingHorizontalPx || 7,
                  paddingVerticalPx: bg === 'transparent' ? 0 : span.paddingVerticalPx || 2,
                  borderRadiusPx: bg === 'transparent' ? 0 : span.borderRadiusPx || 5
                })
              }
              title={bg === 'transparent' ? 'Sem fundo' : `Fundo de pílula: ${bg}`}
            />
          ))}
          <input
            type="color"
            className="cv-rich-bar-color-input"
            value={
              span.backgroundColor && span.backgroundColor.startsWith('#')
                ? span.backgroundColor
                : '#0284c7'
            }
            onChange={(e) =>
              onUpdateSpan(span.id, {
                backgroundColor: e.target.value,
                paddingHorizontalPx: span.paddingHorizontalPx || 7,
                paddingVerticalPx: span.paddingVerticalPx || 2,
                borderRadiusPx: span.borderRadiusPx || 5
              })
            }
            title="Cor de fundo personalizada para esta frase"
          />
        </div>

        <span className="cv-rich-bar-sep" />

        {/* Pintor de Estilo (MS Paint / Word Format Painter) */}
        <button
          type="button"
          className={`cv-rich-bar-btn ${stylePainterFormat ? 'active' : ''}`}
          onClick={handleCopyStyle}
          title="Copiar fonte, cor e tamanho desta frase para pintar em outras frases com 1 clique"
        >
          🪣 Copiar Estilo
        </button>

        {/* Controles de reordenação dos spans na linha e do elemento */}
        {element.spans.length > 1 && (
          <>
            <button
              type="button"
              className="cv-rich-bar-btn"
              onClick={() => onMoveSpan(span.id, 'left')}
              title="Mover frase para a esquerda na linha"
            >
              ◀
            </button>
            <button
              type="button"
              className="cv-rich-bar-btn"
              onClick={() => onMoveSpan(span.id, 'right')}
              title="Mover frase para a direita na linha"
            >
              ▶
            </button>
            <button
              type="button"
              className="cv-rich-bar-btn danger"
              onClick={() => onDeleteSpan(span.id)}
              title="Apagar apenas esta frase da linha"
            >
              ✕ Frase
            </button>
          </>
        )}

        {onMoveElement && (
          <>
            <button
              type="button"
              className="cv-rich-bar-btn"
              onClick={() => onMoveElement('up')}
              title="Subir linha/título"
            >
              ↑
            </button>
            <button
              type="button"
              className="cv-rich-bar-btn"
              onClick={() => onMoveElement('down')}
              title="Descer linha/título"
            >
              ↓
            </button>
          </>
        )}

        {onDuplicateElement && (
          <button
            type="button"
            className="cv-rich-bar-btn"
            onClick={onDuplicateElement}
            title="Duplicar esta linha/título inteira"
          >
            ⧉
          </button>
        )}

        <button
          type="button"
          className="cv-rich-bar-btn danger"
          onClick={onDeleteElement}
          title="Excluir linha/elemento inteiro"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}
