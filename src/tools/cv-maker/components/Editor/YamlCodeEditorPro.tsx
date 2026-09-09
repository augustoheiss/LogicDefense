import React, { useRef, useState, useEffect } from 'react'
import { CheckIcon } from '../Icons/ProIcons'

interface YamlCodeEditorProProps {
  value: string
  onChange: (val: string) => void
  parseError: string | null
  onSave?: () => void
  isSavedFeedback?: boolean
}

export const YamlCodeEditorPro: React.FC<YamlCodeEditorProProps> = ({
  value,
  onChange,
  parseError,
  onSave,
  isSavedFeedback = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })

  // Escuta requisição de localização bidirecional de chaves YAML a partir da Canvas / AST Tree
  useEffect(() => {
    const handleLocateKey = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; itemTitle?: string }>
      const key = customEvent.detail?.key
      const itemTitle = customEvent.detail?.itemTitle
      if (!key || !textareaRef.current) return

      const textLines = value.split('\n')
      let targetLineIndex = -1

      // Se temos o título do item, tentamos encontrar a linha exata do item
      if (itemTitle) {
        for (let i = 0; i < textLines.length; i++) {
          if (textLines[i].includes(itemTitle)) {
            targetLineIndex = i
            break
          }
        }
      }

      // Se não encontrou pelo item ou não tem itemTitle, procura a chave de nível superior da seção
      if (targetLineIndex === -1) {
        for (let i = 0; i < textLines.length; i++) {
          const trimmed = textLines[i].trimStart()
          if (trimmed.startsWith(`${key}:`) || trimmed.startsWith(`- key: ${key}`) || textLines[i].startsWith(key + ':')) {
            targetLineIndex = i
            break
          }
        }
      }

      if (targetLineIndex !== -1) {
        let charIndex = 0
        for (let i = 0; i < targetLineIndex; i++) {
          charIndex += textLines[i].length + 1
        }
        const lineLength = textLines[targetLineIndex].length

        // Delay mínimo para garantir renderização caso tenha havido troca de aba
        setTimeout(() => {
          if (!textareaRef.current) return
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(charIndex, charIndex + lineLength)
          const lineHeight = 21
          textareaRef.current.scrollTop = Math.max(0, targetLineIndex * lineHeight - 60)
          if (gutterRef.current) {
            gutterRef.current.scrollTop = textareaRef.current.scrollTop
          }
          setCursorPos({ line: targetLineIndex + 1, col: 1 })
        }, 60)
      }
    }

    window.addEventListener('cv_locate_yaml_key', handleLocateKey)
    return () => window.removeEventListener('cv_locate_yaml_key', handleLocateKey)
  }, [value])

  // Divide linhas para calcular numeração
  const lines = value.split('\n')
  const totalLines = lines.length

  // Extrai número de linha do erro se existir
  const errorLineNumber = parseError ? (() => {
    const match = parseError.match(/line (\d+)/i) || parseError.match(/linha (\d+)/i) || parseError.match(/\((\d+):/i)
    return match ? parseInt(match[1], 10) : null
  })() : null

  // Sincroniza rolagem entre textarea e a barra lateral de números (gutter)
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Atualiza posição do cursor para barra de status
  const updateCursorPosition = () => {
    if (!textareaRef.current) return
    const selStart = textareaRef.current.selectionStart
    const textBefore = value.substring(0, selStart)
    const lineNum = textBefore.split('\n').length
    const lastNewLine = textBefore.lastIndexOf('\n')
    const colNum = lastNewLine === -1 ? selStart + 1 : selStart - lastNewLine
    setCursorPos({ line: lineNum, col: colNum })
  }

  // Intercepta Tab, Shift+Tab e Ctrl+S / Cmd+S
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      onSave?.()
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      if (e.shiftKey) {
        // Desindentação (Shift + Tab)
        const textBefore = value.substring(0, start)
        const lineStart = textBefore.lastIndexOf('\n') + 1
        const lineContent = value.substring(lineStart, end)

        if (lineContent.startsWith('  ')) {
          const nextVal = value.substring(0, lineStart) + lineContent.substring(2)
          onChange(nextVal)
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2)
          }, 0)
        }
      } else {
        // Indentação de 2 espaços
        const nextVal = value.substring(0, start) + '  ' + value.substring(end)
        onChange(nextVal)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        }, 0)
      }
    }
  }

  return (
    <div className="cv-pro-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="cv-pro-editor__workspace" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Coluna de Numeração de Linhas */}
        <div
          ref={gutterRef}
          className="cv-pro-editor__gutter"
          style={{ overflowY: 'hidden' }}
          aria-hidden="true"
        >
          {Array.from({ length: totalLines }).map((_, idx) => {
            const lineNum = idx + 1
            const isErrorLine = errorLineNumber === lineNum
            return (
              <div
                key={lineNum}
                className={isErrorLine ? 'cv-pro-editor__gutter-line--error' : ''}
                style={{
                  height: '21px',
                  lineHeight: '21px',
                  paddingRight: '6px'
                }}
              >
                {lineNum}
              </div>
            )
          })}
        </div>

        {/* Textarea de Alta Densidade com Suporte Monospace Pro */}
        <textarea
          ref={textareaRef}
          className="cv-pro-editor__textarea"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            updateCursorPosition()
          }}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onKeyUp={updateCursorPosition}
          onClick={updateCursorPosition}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          style={{
            lineHeight: '21px',
            overflowY: 'auto'
          }}
        />
      </div>

      {/* Alerta Visual Elegante de Erro Sintático se houver */}
      {parseError && (
        <div
          style={{
            padding: '0.45rem 0.75rem',
            background: 'rgba(239, 68, 68, 0.12)',
            borderTop: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.74rem',
            fontFamily: 'var(--cv-pro-font-mono)'
          }}
        >
          ⚠️ {parseError}
        </div>
      )}

      {/* Barra de Status Pro do Editor */}
      <div className="cv-pro-editor__status-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>{totalLines} linhas</span>
          <span>{value.length} caracteres</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isSavedFeedback ? (
            <span style={{ color: '#34d399', fontWeight: 700 }}>
              ✓ Salvo no Histórico
            </span>
          ) : parseError ? (
            <span style={{ color: '#f87171', fontWeight: 600 }}>
              ✗ Erro de Sintaxe
            </span>
          ) : (
            <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <CheckIcon size={12} strokeWidth={2.5} /> YAML Válido
            </span>
          )}
          <span style={{ opacity: 0.5 }}>| UTF-8</span>
        </div>
      </div>
    </div>
  )
}
