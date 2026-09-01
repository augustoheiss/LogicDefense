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
    <section className="cv-section cv-section-education cv-avoid-break">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-items-list">
        {education.map((item, idx) => (
          <div key={idx} className="cv-item">
            <div className="cv-item-header">
              <span className="cv-item-title">
                {item.studyType ? `${item.studyType} em ` : ''}{item.area || 'Graduação'}
              </span>
              <span className="cv-item-date">
                {item.startDate} — {item.endDate || 'Presente'}
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
