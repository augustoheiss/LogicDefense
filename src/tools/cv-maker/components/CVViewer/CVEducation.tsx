import React from 'react'
import type { CVEducation as CVEducationType } from '../../types/cv'

interface CVEducationProps {
  education: CVEducationType[]
}

export const CVEducation: React.FC<CVEducationProps> = ({ education }) => {
  if (!education || education.length === 0) return null

  return (
    <section className="cv-section cv-avoid-break">
      <h2 className="cv-section-title">
        <span>🎓</span> Formação Acadêmica
      </h2>

      <div className="cv-education-grid">
        {education.map((item, index) => {
          const dateRange = item.endDate
            ? (item.startDate ? `${item.startDate} — ${item.endDate}` : item.endDate)
            : (item.startDate ? `${item.startDate} — Presente` : '')

          return (
            <div key={index} className="cv-education-card cv-avoid-break">
              <div className="cv-card-top">
                <span className="cv-geo-icon">🏛️</span>
                <span className="cv-meta-tag">{dateRange}</span>
              </div>
              <h4 className="cv-item-title">
                {item.studyType ? `${item.studyType} em ${item.area || ''}` : item.area}
              </h4>
              <p className="cv-item-inst">
                <strong>{item.institution}</strong>
              </p>
              {item.score && <p className="cv-item-summary">Nota/Desempenho: {item.score}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

