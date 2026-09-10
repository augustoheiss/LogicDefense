import React from 'react'
import type { UniversalItemNode } from '../../types/universalAST'

interface CardGridRendererProps {
  items: UniversalItemNode[]
  sectionKey?: string
}

export const CardGridRenderer: React.FC<CardGridRendererProps> = ({ items }) => {
  if (!items || items.length === 0) return null

  // Ajusta colunas dinamicamente com base na quantidade e densidade de conteúdo
  const hasDenseContent = items.some(it => (it.prose && it.prose.length > 80) || (it.badges && it.badges.length > 4))
  const gridColumns = hasDenseContent || items.length <= 2 ? 'repeat(auto-fit, minmax(260px, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))'

  return (
    <div
      className="cv-universal-card-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: gridColumns,
        gap: '0.85rem',
        marginTop: '0.5rem'
      }}
    >
      {items.map((item, idx) => {
        const itemKey = item.id || `card-${idx}`
        const dateDisplay = item.period
          ? `${item.period.start || ''}${item.period.end ? ` - ${item.period.end}` : item.period.current ? ' - Atual' : ''}`
          : item.date

        return (
          <div
            key={itemKey}
            className="cv-universal-card"
            style={{
              background: 'var(--sec-card-bg, rgba(255, 255, 255, 0.75))',
              border: '1px solid var(--cv-color-border, rgba(226, 232, 240, 0.8))',
              borderRadius: '8px',
              padding: '0.85rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease'
            }}
          >
            <div>
              {/* Header do Card com Título e Data/Período */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.3rem' }}>
                {item.title && (
                  <h3
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: 'var(--cv-color-primary, #0284c7)',
                      margin: 0,
                      lineHeight: 1.25
                    }}
                  >
                    {item.title}
                  </h3>
                )}
                {dateDisplay && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--cv-color-text-muted, #64748b)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {dateDisplay}
                  </span>
                )}
              </div>

              {/* Subtítulo / Empresa / Função */}
              {item.subtitle && (
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--cv-color-secondary, #0369a1)',
                    marginBottom: '0.45rem'
                  }}
                >
                  {item.subtitle}
                </div>
              )}

              {/* Descrição em Prosa */}
              {item.prose && (
                <p
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--cv-color-text, #334155)',
                    lineHeight: 1.45,
                    margin: '0 0 0.5rem 0'
                  }}
                >
                  {item.prose}
                </p>
              )}

              {/* Pares Chave-Valor Específicos do Item */}
              {item.keyValues && Object.keys(item.keyValues).length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                    gap: '0.35rem 0.6rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.72rem'
                  }}
                >
                  {Object.entries(item.keyValues).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--cv-color-text-muted, #64748b)', fontWeight: 600, textTransform: 'capitalize' }}>
                        {k.replace(/_/g, ' ')}:
                      </span>
                      <span style={{ color: 'var(--cv-color-text, #1e293b)', fontWeight: 500 }}>
                        {String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Badges / Tags compactas no rodapé do card */}
            {item.badges && item.badges.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.3rem',
                  marginTop: '0.4rem',
                  paddingTop: '0.4rem',
                  borderTop: '1px dashed var(--cv-color-border, rgba(226, 232, 240, 0.6))'
                }}
              >
                {item.badges.map((badge, bIdx) => (
                  <span
                    key={bIdx}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '999px',
                      background: 'var(--cv-color-surface, #f1f5f9)',
                      color: 'var(--cv-color-text, #334155)',
                      border: '1px solid var(--cv-color-border, #e2e8f0)',
                      letterSpacing: '0.01em'
                    }}
                  >
                    {badge}
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
