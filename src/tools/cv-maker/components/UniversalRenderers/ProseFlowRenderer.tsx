import React from 'react'
import type { UniversalItemNode } from '../../types/universalAST'

interface ProseFlowRendererProps {
  items: UniversalItemNode[]
  sectionKey?: string
}

export const ProseFlowRenderer: React.FC<ProseFlowRendererProps> = ({ items, sectionKey }) => {
  if (!items || items.length === 0) return null

  const titleColor = sectionKey ? `var(--sec-${sectionKey}-title, var(--cv-color-primary, #0284c7))` : 'var(--cv-color-primary, #0284c7)'
  const subtitleColor = sectionKey ? `var(--sec-${sectionKey}-subtitle, var(--cv-color-secondary, #0369a1))` : 'var(--cv-color-secondary, #0369a1)'
  const textColor = sectionKey ? `var(--sec-${sectionKey}-text, var(--cv-color-text, #334155))` : 'var(--cv-color-text, #334155)'

  return (
    <div
      className="cv-universal-prose-flow"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        marginTop: '0.5rem',
        lineHeight: 1.6
      }}
    >
      {items.map((item, idx) => {
        const itemKey = item.id || `prose-${idx}`

        return (
          <div key={itemKey} className="cv-universal-prose-block">
            {/* Título de Subseção se houver */}
            {item.title && (
              <h4
                className="cv-universal-item-title"
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: titleColor,
                  margin: '0 0 0.25rem 0'
                }}
              >
                {item.title}
              </h4>
            )}

            {/* Subtítulo / Referência */}
            {item.subtitle && (
              <div
                className="cv-universal-item-subtitle"
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: subtitleColor,
                  marginBottom: '0.3rem'
                }}
              >
                {item.subtitle}
              </div>
            )}

            {/* Texto Principal */}
            {item.prose && (
              <div
                style={{
                  fontSize: '0.82rem',
                  color: textColor,
                  whiteSpace: 'pre-line',
                  textAlign: 'justify'
                }}
              >
                {item.prose}
              </div>
            )}

            {/* Badges anexadas à prosa */}
            {item.badges && item.badges.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
                {item.badges.map((b, bIdx) => (
                  <span
                    key={bIdx}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'var(--cv-color-surface, #f1f5f9)',
                      color: 'var(--cv-color-text-muted, #475569)',
                      border: '1px solid var(--cv-color-border, #e2e8f0)'
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
