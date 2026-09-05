import React from 'react'
import type { CVEducation } from '../../types/cv'

interface BlockEducationProps {
  education?: CVEducation[]
  title?: string
}

export const BlockEducation: React.FC<BlockEducationProps> = ({
  education,
  title = 'Formação Acadêmica'
}) => {
  if (!education || education.length === 0) return null

  return (
    <section className="cv-section cv-section-education">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-items-list">
        {education.map((item, idx) => (
          <div key={idx} className="cv-item cv-avoid-break">
            <div className="cv-item-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                {item.logo && (
                  <img
                    src={item.logo}
                    alt={item.institution}
                    style={{ width: '22px', height: '22px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
                  />
                )}
                <span className="cv-item-title">
                  {item.studyType ? `${item.studyType} em ` : ''}{item.area || 'Graduação'}
                </span>
              </div>
              <span className="cv-item-date">
                {item.startDate} — {item.endDate || 'Presente'}
                {(item.isEstimated || item.startDate?.includes('[ESTIMADO]') || item.endDate?.includes('[ESTIMADO]')) && (
                  <span
                    className="cv-no-print"
                    data-cv-interactive="true"
                    title="Data estimada ou inferida automaticamente pela IA — por favor confira antes de exportar"
                    style={{
                      marginLeft: '0.45rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(234, 179, 8, 0.15)',
                      color: '#b45309',
                      border: '1px solid rgba(234, 179, 8, 0.4)',
                      verticalAlign: 'middle',
                      cursor: 'help'
                    }}
                  >
                    ⚠️ Estimado
                  </span>
                )}
              </span>
            </div>
            <div className="cv-item-sub">{item.institution}</div>
            {item.courses && item.courses.length > 0 && (
              <div className="cv-badges" style={{ marginTop: '0.25rem' }}>
                {item.courses.map((c, cIdx) => (
                  <span key={cIdx} className="cv-badge">{c}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
