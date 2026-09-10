import React from 'react'
import type { UniversalItemNode, LayoutArchetype } from '../../types/universalAST'

interface UniversalSingleItemRendererProps {
  item: UniversalItemNode
  index: number
  archetype: LayoutArchetype
  sectionKey: string
  isFreeCanvas?: boolean
}

export const UniversalSingleItemRenderer: React.FC<UniversalSingleItemRendererProps> = ({
  item,
  index: idx,
  archetype,
  sectionKey
}) => {
  const titleColor = sectionKey ? `var(--sec-${sectionKey}-title, var(--cv-color-primary, #0284c7))` : 'var(--cv-color-primary, #0284c7)'
  const subtitleColor = sectionKey ? `var(--sec-${sectionKey}-subtitle, var(--cv-color-secondary, #0369a1))` : 'var(--cv-color-secondary, #0369a1)'
  const textColor = sectionKey ? `var(--sec-${sectionKey}-text, var(--cv-color-text, #334155))` : 'var(--cv-color-text, #334155)'
  const cardBg = sectionKey ? `var(--sec-${sectionKey}-bg, var(--sec-card-bg, rgba(255, 255, 255, 0.85)))` : 'var(--sec-card-bg, rgba(255, 255, 255, 0.85))'
  const borderColor = sectionKey ? `var(--sec-${sectionKey}-border, var(--cv-color-border, rgba(226, 232, 240, 0.8)))` : 'var(--cv-color-border, rgba(226, 232, 240, 0.8))'

  const dateDisplay = item.period
    ? `${item.period.start || ''}${item.period.end ? ` - ${item.period.end}` : item.period.current ? ' - Atual' : ''}`
    : item.date

  switch (archetype) {
    case 'timeline':
      return (
        <div
          className="cv-universal-timeline-item"
          style={{
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.6rem 0.8rem 0.6rem 1.4rem'
          }}
        >
          {/* Marcador Geométrico */}
          <div
            style={{
              position: 'absolute',
              left: '0.2rem',
              top: '0.85rem',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: titleColor,
              border: '2px solid #ffffff',
              boxShadow: `0 0 0 1px ${borderColor}`,
              zIndex: 2
            }}
            aria-hidden="true"
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: titleColor, margin: 0, lineHeight: 1.3 }}>
              {item.title || `Marco #${idx + 1}`}
            </h3>
            {dateDisplay && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--cv-color-accent, #f97316)',
                  background: 'var(--cv-color-surface, #eff6ff)',
                  padding: '0.12rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid var(--cv-color-border, rgba(37, 99, 235, 0.2))',
                  whiteSpace: 'nowrap'
                }}
              >
                {dateDisplay}
              </span>
            )}
          </div>

          {item.subtitle && (
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: subtitleColor, marginBottom: '0.35rem' }}>
              {item.subtitle}
            </div>
          )}

          {item.prose && (
            <p style={{ fontSize: '0.78rem', color: textColor, lineHeight: 1.45, margin: '0 0 0.4rem 0' }}>
              {item.prose}
            </p>
          )}

          {item.badges && item.badges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.35rem' }}>
              {item.badges.map((b, bIdx) => (
                <span
                  key={bIdx}
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    padding: '0.1rem 0.45rem',
                    borderRadius: '4px',
                    background: 'var(--cv-color-surface, #f8fafc)',
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

    case 'badge_list':
      return (
        <div
          className="cv-universal-badge-item"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.4rem',
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '6px',
            padding: '0.55rem 0.8rem',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {item.title && (
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: titleColor, minWidth: '90px' }}>
              {item.title}:
            </span>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {(item.badges || (item.title ? [item.title] : [item.prose || `Item #${idx + 1}`])).map((badge, bIdx) => (
              <span
                key={bIdx}
                className="cv-universal-badge"
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: 'var(--cv-color-surface, #f8fafc)',
                  color: textColor,
                  border: `1px solid ${borderColor}`,
                  letterSpacing: '0.01em'
                }}
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      )

    case 'key_value_table': {
      const rows: Array<{ key: string; value: string; hint?: string }> = []
      if (item.keyValues && Object.keys(item.keyValues).length > 0) {
        Object.entries(item.keyValues).forEach(([k, v]) => {
          rows.push({
            key: k.replace(/_/g, ' '),
            value: String(v),
            hint: item.title && item.title !== k ? item.title : undefined
          })
        })
      } else if (item.title && item.prose) {
        rows.push({ key: item.title.replace(/_/g, ' '), value: item.prose, hint: item.subtitle })
      } else if (item.title) {
        rows.push({ key: item.title.replace(/_/g, ' '), value: item.subtitle || item.date || '—' })
      } else if (item.prose) {
        rows.push({ key: `Item #${idx + 1}`, value: item.prose })
      }

      return (
        <div
          className="cv-universal-table-item"
          style={{
            border: `1px solid ${borderColor}`,
            borderRadius: '6px',
            overflow: 'hidden',
            background: cardBg,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom: rIdx === rows.length - 1 ? 'none' : `1px solid ${borderColor}`,
                    background: rIdx % 2 === 0 ? 'transparent' : 'var(--cv-color-surface, rgba(248, 250, 252, 0.7))'
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
                  <td style={{ padding: '0.45rem 0.75rem', color: textColor, verticalAlign: 'top' }}>
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    case 'prose_flow':
      return (
        <div
          className="cv-universal-prose-block"
          style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '6px',
            padding: '0.75rem 0.95rem',
            width: '100%',
            boxSizing: 'border-box',
            lineHeight: 1.55
          }}
        >
          {item.title && (
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: titleColor, margin: '0 0 0.25rem 0' }}>
              {item.title}
            </h4>
          )}
          {item.subtitle && (
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: subtitleColor, marginBottom: '0.3rem' }}>
              {item.subtitle}
            </div>
          )}
          {item.prose && (
            <div style={{ fontSize: '0.82rem', color: textColor, whiteSpace: 'pre-line', textAlign: 'justify' }}>
              {item.prose}
            </div>
          )}
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
                    border: `1px solid ${borderColor}`
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      )

    case 'card_grid':
    default:
      return (
        <div
          className="cv-universal-card"
          style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            padding: '0.85rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.3rem' }}>
              {item.title && (
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: titleColor, margin: 0, lineHeight: 1.25 }}>
                  {item.title}
                </h3>
              )}
              {dateDisplay && (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--cv-color-text-muted, #64748b)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {dateDisplay}
                </span>
              )}
            </div>

            {item.subtitle && (
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: subtitleColor, marginBottom: '0.45rem' }}>
                {item.subtitle}
              </div>
            )}

            {item.prose && (
              <p style={{ fontSize: '0.78rem', color: textColor, lineHeight: 1.45, margin: '0 0 0.5rem 0' }}>
                {item.prose}
              </p>
            )}

            {item.keyValues && Object.keys(item.keyValues).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.35rem 0.6rem', marginBottom: '0.5rem', fontSize: '0.72rem' }}>
                {Object.entries(item.keyValues).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--cv-color-text-muted, #64748b)', fontWeight: 600, textTransform: 'capitalize' }}>
                      {k.replace(/_/g, ' ')}:
                    </span>
                    <span style={{ color: textColor, fontWeight: 500 }}>
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {item.badges && item.badges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: `1px dashed ${borderColor}` }}>
              {item.badges.map((badge, bIdx) => (
                <span
                  key={bIdx}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '999px',
                    background: 'var(--cv-color-surface, #f1f5f9)',
                    color: textColor,
                    border: `1px solid ${borderColor}`,
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
  }
}
