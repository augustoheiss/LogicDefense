import React from 'react'
import type { UniversalItemNode } from '../../types/universalAST'

interface KeyValueTableRendererProps {
  items: UniversalItemNode[]
  sectionKey?: string
}

export const KeyValueTableRenderer: React.FC<KeyValueTableRendererProps> = ({ items, sectionKey }) => {
  if (!items || items.length === 0) return null

  const titleColor = sectionKey ? `var(--sec-${sectionKey}-title, var(--cv-color-primary, #0284c7))` : 'var(--cv-color-primary, #0284c7)'
  const subtitleColor = sectionKey ? `var(--sec-${sectionKey}-subtitle, var(--cv-color-secondary, #0369a1))` : 'var(--cv-color-secondary, #0369a1)'
  const textColor = sectionKey ? `var(--sec-${sectionKey}-text, var(--cv-color-text, #334155))` : 'var(--cv-color-text, #334155)'
  const tableBg = sectionKey ? `var(--sec-${sectionKey}-bg, var(--sec-table-bg, rgba(255, 255, 255, 0.6)))` : 'var(--sec-table-bg, rgba(255, 255, 255, 0.6))'
  const borderColor = sectionKey ? `var(--sec-${sectionKey}-border, var(--cv-color-border, #e2e8f0))` : 'var(--cv-color-border, #e2e8f0)'

  // Flatten todos os pares de chave-valor para apresentação tabular uniforme
  const rows: Array<{ key: string; value: string; hint?: string }> = []

  items.forEach((item, idx) => {
    if (item.keyValues && Object.keys(item.keyValues).length > 0) {
      Object.entries(item.keyValues).forEach(([k, v]) => {
        rows.push({
          key: k.replace(/_/g, ' '),
          value: String(v),
          hint: item.subtitle || (items.length > 1 && item.title !== k ? item.title : undefined)
        })
      })
    } else if (item.title && item.prose) {
      rows.push({
        key: item.title.replace(/_/g, ' '),
        value: item.prose,
        hint: item.subtitle
      })
    } else if (item.title) {
      rows.push({
        key: item.title.replace(/_/g, ' '),
        value: item.subtitle || item.date || '—'
      })
    } else if (item.prose) {
      rows.push({
        key: `Item #${idx + 1}`,
        value: item.prose
      })
    }
  })

  // Se houver mais de 6 linhas, organiza em 2 colunas para otimizar o espaço do papel A4/Letter
  const isMultiColumn = rows.length >= 6

  return (
    <div
      className="cv-universal-key-value-table"
      style={{
        display: 'grid',
        gridTemplateColumns: isMultiColumn ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
        gap: '0.6rem 1.25rem',
        marginTop: '0.5rem'
      }}
    >
      <div
        style={{
          border: `1px solid ${borderColor}`,
          borderRadius: '6px',
          overflow: 'hidden',
          background: tableBg
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.78rem',
            textAlign: 'left'
          }}
        >
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: idx === rows.length - 1 ? 'none' : `1px solid ${borderColor}`,
                  background: idx % 2 === 0 ? 'transparent' : 'var(--cv-color-surface, rgba(248, 250, 252, 0.7))'
                }}
              >
                <td
                  style={{
                    padding: '0.45rem 0.75rem',
                    fontWeight: 700,
                    color: titleColor,
                    width: '40%',
                    textTransform: 'capitalize',
                    verticalAlign: 'top',
                    borderRight: `1px solid ${borderColor}`
                  }}
                >
                  {row.key}
                  {row.hint && (
                    <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: subtitleColor }}>
                      {row.hint}
                    </span>
                  )}
                </td>
                <td
                  style={{
                    padding: '0.45rem 0.75rem',
                    color: textColor,
                    fontWeight: 500,
                    verticalAlign: 'top'
                  }}
                >
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
