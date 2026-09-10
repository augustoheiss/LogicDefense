import React from 'react'
import type { UniversalItemNode } from '../../types/universalAST'

interface KeyValueTableRendererProps {
  items: UniversalItemNode[]
  sectionKey?: string
}

export const KeyValueTableRenderer: React.FC<KeyValueTableRendererProps> = ({ items }) => {
  if (!items || items.length === 0) return null

  // Flatten todos os pares de chave-valor para apresentação tabular uniforme
  const rows: Array<{ key: string; value: string; hint?: string }> = []

  items.forEach((item, idx) => {
    if (item.keyValues && Object.keys(item.keyValues).length > 0) {
      Object.entries(item.keyValues).forEach(([k, v]) => {
        rows.push({
          key: k.replace(/_/g, ' '),
          value: String(v),
          hint: item.title && item.title !== k ? item.title : undefined
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
          border: '1px solid var(--cv-color-border, #e2e8f0)',
          borderRadius: '6px',
          overflow: 'hidden',
          background: 'var(--sec-table-bg, rgba(255, 255, 255, 0.6))'
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
                  borderBottom: idx === rows.length - 1 ? 'none' : '1px solid var(--cv-color-border, #f1f5f9)',
                  background: idx % 2 === 0 ? 'transparent' : 'var(--cv-color-surface, rgba(248, 250, 252, 0.7))'
                }}
              >
                <td
                  style={{
                    padding: '0.45rem 0.75rem',
                    fontWeight: 700,
                    color: 'var(--cv-color-primary, #0284c7)',
                    width: '40%',
                    textTransform: 'capitalize',
                    verticalAlign: 'top',
                    borderRight: '1px solid var(--cv-color-border, #f1f5f9)'
                  }}
                >
                  {row.key}
                  {row.hint && (
                    <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--cv-color-secondary, #0369a1)' }}>
                      {row.hint}
                    </span>
                  )}
                </td>
                <td
                  style={{
                    padding: '0.45rem 0.75rem',
                    color: 'var(--cv-color-text, #334155)',
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
