import React from 'react'
import type { UniversalItemNode } from '../../types/universalAST'

interface TimelineRendererProps {
  items: UniversalItemNode[]
  sectionKey?: string
}

export const TimelineRenderer: React.FC<TimelineRendererProps> = ({ items }) => {
  if (!items || items.length === 0) return null

  return (
    <div
      className="cv-universal-timeline"
      style={{
        position: 'relative',
        paddingLeft: '1.25rem',
        marginTop: '0.6rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}
    >
      {/* Linha da espinha dorsal vertical */}
      <div
        style={{
          position: 'absolute',
          left: '5px',
          top: '6px',
          bottom: '10px',
          width: '2px',
          background: 'var(--cv-color-border, #cbd5e1)',
          borderRadius: '1px'
        }}
        aria-hidden="true"
      />

      {items.map((item, idx) => {
        const itemKey = item.id || `timeline-${idx}`
        const dateDisplay = item.period
          ? `${item.period.start || ''}${item.period.end ? ` — ${item.period.end}` : item.period.current ? ' — Atual' : ''}`
          : item.date

        return (
          <div
            key={itemKey}
            className="cv-universal-timeline-item"
            style={{
              position: 'relative'
            }}
          >
            {/* Marcador Geométrico da Linha do Tempo */}
            <div
              style={{
                position: 'absolute',
                left: '-1.25rem',
                top: '4px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: 'var(--cv-color-primary, #2563eb)',
                border: '2px solid #ffffff',
                boxShadow: '0 0 0 1px var(--cv-color-border, #cbd5e1)',
                zIndex: 2
              }}
              aria-hidden="true"
            />

            {/* Cabeçalho do Item (Título + Período) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: '0.4rem',
                marginBottom: '0.2rem'
              }}
            >
              <h3
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: 'var(--cv-color-primary, #0f172a)',
                  margin: 0,
                  lineHeight: 1.3
                }}
              >
                {item.title || 'Marco'}
              </h3>
              {dateDisplay && (
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: 'var(--cv-color-accent, #2563eb)',
                    background: 'var(--cv-color-surface, #eff6ff)',
                    padding: '0.12rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--cv-color-border, rgba(37, 99, 235, 0.2))',
                    letterSpacing: '0.02em'
                  }}
                >
                  {dateDisplay}
                </span>
              )}
            </div>

            {/* Subtítulo / Cargo / Instituição */}
            {item.subtitle && (
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--cv-color-secondary, #475569)',
                  marginBottom: '0.35rem'
                }}
              >
                {item.subtitle}
              </div>
            )}

            {/* Descrição Narrativa / Prosa */}
            {item.prose && (
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--cv-color-text, #334155)',
                  lineHeight: 1.5,
                  margin: '0 0 0.4rem 0'
                }}
              >
                {item.prose}
              </p>
            )}

            {/* Pares Chave-Valor do Marco */}
            {item.keyValues && Object.keys(item.keyValues).length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem 0.8rem',
                  margin: '0.35rem 0',
                  fontSize: '0.74rem'
                }}
              >
                {Object.entries(item.keyValues).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: '0.25rem' }}>
                    <strong style={{ color: 'var(--cv-color-text-muted, #64748b)' }}>{k.replace(/_/g, ' ')}:</strong>
                    <span style={{ color: 'var(--cv-color-text, #1e293b)' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Badges / Competências */}
            {item.badges && item.badges.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.3rem',
                  marginTop: '0.35rem'
                }}
              >
                {item.badges.map((badge, bIdx) => (
                  <span
                    key={bIdx}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'var(--cv-color-surface, #f8fafc)',
                      color: 'var(--cv-color-text-muted, #475569)',
                      border: '1px solid var(--cv-color-border, #e2e8f0)'
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
