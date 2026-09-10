import React from 'react'
import type { UniversalItemNode } from '../../types/universalAST'

interface BadgeListRendererProps {
  items: UniversalItemNode[]
  sectionKey?: string
}

export const BadgeListRenderer: React.FC<BadgeListRendererProps> = ({ items }) => {
  if (!items || items.length === 0) return null

  // Verifica se temos categorias agrupadas (itens com title e badges próprios)
  const hasGroupedCategories = items.some(it => it.title && it.badges && it.badges.length > 0)

  if (hasGroupedCategories) {
    return (
      <div
        className="cv-universal-badge-groups"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          marginTop: '0.45rem'
        }}
      >
        {items.map((item, idx) => (
          <div key={item.id || `badge-group-${idx}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
            {item.title && (
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--cv-color-primary, #0284c7)',
                  marginRight: '0.25rem',
                  minWidth: '100px'
                }}
              >
                {item.title}:
              </span>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {(item.badges || (item.title ? [item.title] : [])).map((badge, bIdx) => (
                <span
                  key={bIdx}
                  className="cv-universal-badge"
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'var(--cv-color-surface, #f8fafc)',
                    color: 'var(--cv-color-text, #1e293b)',
                    border: '1px solid var(--cv-color-border, #cbd5e1)',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                    letterSpacing: '0.01em'
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Lista simples e contínua de badges compactas
  const allBadges: string[] = []
  items.forEach(it => {
    if (it.badges && it.badges.length > 0) {
      allBadges.push(...it.badges)
    } else if (it.title) {
      allBadges.push(it.title)
    } else if (it.prose) {
      allBadges.push(it.prose)
    }
  })

  return (
    <div
      className="cv-universal-badge-list"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4rem',
        marginTop: '0.45rem'
      }}
    >
      {allBadges.map((badge, idx) => (
        <span
          key={`badge-${idx}`}
          className="cv-universal-badge"
          style={{
            fontSize: '0.74rem',
            fontWeight: 600,
            padding: '0.22rem 0.65rem',
            borderRadius: '999px',
            background: 'var(--cv-color-surface, #f8fafc)',
            color: 'var(--cv-color-text, #1e293b)',
            border: '1px solid var(--cv-color-border, #cbd5e1)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            letterSpacing: '0.01em'
          }}
        >
          {badge}
        </span>
      ))}
    </div>
  )
}
